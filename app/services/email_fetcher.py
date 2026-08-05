import json
import logging
from typing import Optional, List, Dict, Any
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from google.auth.transport.requests import Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone

from app.config import get_settings
from app.core.encryption import decrypt_data
from app.models.email_sync_state import EmailSyncState
from app.models.transaction import Transaction
from app.services.email_parser import parse_hdfc_upi_email

logger = logging.getLogger(__name__)
settings = get_settings()

class EmailFetcherService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.service = self._get_gmail_service()

    def _get_gmail_service(self):
        token_file = settings.credentials_dir / "token.encrypted.json"
        if not token_file.exists():
            logger.error("Gmail token not found. Please run scripts/gmail_auth.py first.")
            return None
            
        try:
            with open(token_file, "r") as f:
                encrypted_str = f.read()
            creds_dict = json.loads(decrypt_data(encrypted_str))
            
            creds = Credentials(
                token=creds_dict["token"],
                refresh_token=creds_dict["refresh_token"],
                token_uri=creds_dict["token_uri"],
                client_id=creds_dict["client_id"],
                client_secret=creds_dict["client_secret"],
                scopes=creds_dict["scopes"]
            )
            
            if creds.expired and creds.refresh_token:
                creds.refresh(Request())
                # Should re-encrypt and save if refreshed, but omitted here for simplicity
                
            return build('gmail', 'v1', credentials=creds)
            
        except Exception as e:
            logger.error(f"Failed to initialize Gmail service: {e}")
            return None

    async def fetch_and_process_emails(self):
        if not self.service:
            return
            
        # 1. Get Sync State
        sync_state_result = await self.db.execute(select(EmailSyncState).limit(1))
        sync_state = sync_state_result.scalar_one_or_none()
        
        if not sync_state:
            logger.error("EmailSyncState not found in DB.")
            return

        last_history_id = sync_state.last_history_id
        
        try:
            if not last_history_id:
                # First time: Do a full search for recent HDFC emails
                await self._initial_sync(sync_state)
            else:
                # Incremental sync using history
                await self._history_sync(sync_state, last_history_id)
                
        except Exception as e:
            logger.error(f"Error during email sync: {e}")

    async def _initial_sync(self, sync_state: EmailSyncState):
        logger.info("Performing initial Gmail sync...")
        query = f"from:{settings.hdfc_sender_email} UPI"
        
        results = self.service.users().messages().list(userId='me', q=query, maxResults=50).execute()
        messages = results.get('messages', [])
        
        if not messages:
            logger.info("No matching emails found.")
        else:
            for msg in messages:
                await self._process_message_id(msg['id'])
                sync_state.total_emails_processed += 1
                
        # Get current history ID to save for next time
        profile = self.service.users().getProfile(userId='me').execute()
        sync_state.last_history_id = str(profile.get('historyId'))
        sync_state.last_poll_at = datetime.now(timezone.utc).replace(tzinfo=None)
        
        await self.db.commit()

    async def _history_sync(self, sync_state: EmailSyncState, last_history_id: str):
        logger.info(f"Performing incremental sync from historyId: {last_history_id}")
        
        try:
            results = self.service.users().history().list(
                userId='me', 
                startHistoryId=last_history_id,
                historyTypes=['messageAdded']
            ).execute()
            
            history_records = results.get('history', [])
            
            for record in history_records:
                for msg_added in record.get('messagesAdded', []):
                    msg_id = msg_added['message']['id']
                    # Process message
                    await self._process_message_id(msg_id)
                    sync_state.total_emails_processed += 1
                    
            if 'historyId' in results:
                sync_state.last_history_id = str(results['historyId'])
                
        except Exception as e:
            # If history ID is too old, it throws a 404. We should fall back to initial sync.
            logger.warning(f"History sync failed (might be too old). Falling back to initial. Error: {e}")
            await self._initial_sync(sync_state)
            return

        sync_state.last_poll_at = datetime.now(timezone.utc).replace(tzinfo=None)
        await self.db.commit()

    async def _process_message_id(self, msg_id: str):
        msg = self.service.users().messages().get(userId='me', id=msg_id, format='full').execute()
        
        headers = msg['payload']['headers']
        sender = next((h['value'] for h in headers if h['name'] == 'From'), "")
        
        if settings.hdfc_sender_email not in sender:
            return # Ignore non-HDFC emails
            
        # Extract body
        body = self._extract_body(msg['payload'])
        if not body:
            return
            
        # Get internal date (epoch ms)
        internal_date_ms = int(msg['internalDate'])
        received_timestamp = datetime.fromtimestamp(internal_date_ms / 1000.0, tz=timezone.utc).replace(tzinfo=None)

        parsed_email = parse_hdfc_upi_email(body, received_timestamp)
        if not parsed_email:
            return # Could not parse
            
        # Deduplication check
        check_stmt = select(Transaction).where(Transaction.txn_ref == parsed_email.txn_ref)
        if (await self.db.execute(check_stmt)).scalar_one_or_none():
            logger.info(f"Transaction {parsed_email.txn_ref} already exists. Skipping.")
            return

        # Insert new transaction
        new_txn = Transaction(
            amount=parsed_email.amount,
            direction=parsed_email.direction,
            timestamp=parsed_email.timestamp,
            vpa=parsed_email.vpa,
            merchant_name=parsed_email.merchant_name,
            raw_merchant_name=parsed_email.merchant_name,
            txn_ref=parsed_email.txn_ref,
            txn_type="upi",
            account_last4=parsed_email.account_last4,
            source="email_auto",
            email_message_id=msg_id,
            status="pending_review"
        )
        
        self.db.add(new_txn)
        logger.info(f"Added new transaction from email: {parsed_email.txn_ref} - {parsed_email.amount}")
        
    def _extract_body(self, payload: Dict[str, Any]) -> str:
        """Extract plain text body from email payload."""
        import base64
        
        if payload.get('mimeType') == 'text/plain':
            data = payload['body'].get('data')
            if data:
                return base64.urlsafe_b64decode(data).decode('utf-8')
        
        if 'parts' in payload:
            for part in payload['parts']:
                body = self._extract_body(part)
                if body:
                    return body
                    
        return ""
