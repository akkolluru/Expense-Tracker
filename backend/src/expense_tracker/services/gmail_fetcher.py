import asyncio
import base64
import json
import logging
import os
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import Resource, build  # type: ignore[import-untyped]
from sqlalchemy.ext.asyncio import AsyncSession


from expense_tracker.concurrency import db_write_lock
from expense_tracker.parsers.registry import BankParserRegistry
from expense_tracker.services.reconciliation import ReconciliationService
from expense_tracker.services.staging import StagingService

logger = logging.getLogger(__name__)


@dataclass
class GmailFetchResult:
    messages_fetched: int
    transactions_created: int
    transactions_merged: int
    status: str
    error: str | None = None


def _extract_body_sync(payload: dict[str, Any]) -> str:
    """Recursively extract plain text or HTML body from a Gmail message payload."""
    mime_type = payload.get("mimeType", "")
    data = payload.get("body", {}).get("data")

    if mime_type == "text/plain" and data:
        try:
            return base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")
        except Exception:  # noqa: BLE001, S110
            pass

    if "parts" in payload:
        plain_body = ""
        for part in payload["parts"]:
            body = _extract_body_sync(part)
            if body:
                return body
        return plain_body

    if mime_type == "text/html" and data:
        try:
            return base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")
        except Exception:  # noqa: BLE001, S110
            pass


    return ""


def _extract_headers_sync(payload: dict[str, Any]) -> dict[str, str]:
    headers_list = payload.get("headers", [])
    headers: dict[str, str] = {}
    for h in headers_list:
        name = h.get("name", "").lower()
        value = h.get("value", "")
        headers[name] = value
    return headers


def _build_service_sync(token_path: Path) -> Resource | None:
    """Builds and refreshes the synchronous Google API client."""
    if not token_path.exists():
        return None

    try:
        content = token_path.read_text(encoding="utf-8")
        creds_dict = json.loads(content)

        creds = Credentials(
            token=creds_dict.get("token"),
            refresh_token=creds_dict.get("refresh_token"),
            token_uri=creds_dict.get("token_uri", "https://oauth2.googleapis.com/token"),
            client_id=creds_dict.get("client_id"),
            client_secret=creds_dict.get("client_secret"),
            scopes=creds_dict.get(
                "scopes", ["https://www.googleapis.com/auth/gmail.readonly"]
            ),
        )

        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
            # Save refreshed token back to disk
            token_path.write_text(creds.to_json(), encoding="utf-8")

        return build("gmail", "v1", credentials=creds, cache_discovery=False)
    except Exception as e:  # noqa: BLE001
        logger.warning("Failed to initialize Gmail API service from %s: %s", token_path, e)
        return None



def _sync_list_messages(service: Resource, query: str, max_results: int = 50) -> list[dict[str, Any]]:
    res = (
        service.users()
        .messages()
        .list(userId="me", q=query, maxResults=max_results)
        .execute()
    )
    return res.get("messages", [])  # type: ignore[no-any-return]


def _sync_get_message(service: Resource, msg_id: str) -> dict[str, Any]:
    return service.users().messages().get(userId="me", id=msg_id, format="full").execute()  # type: ignore[no-any-return]


class GmailFetcherService:
    @classmethod
    def get_token_path(cls) -> Path:
        env_token = os.getenv("GMAIL_TOKEN_PATH")
        if env_token:
            return Path(env_token)
        creds_dir = os.getenv("GMAIL_CREDENTIALS_DIR", "./credentials")
        return Path(creds_dir) / "token.json"

    @classmethod
    def get_query(cls) -> str:
        return os.getenv(
            "GMAIL_QUERY",
            "from:alerts@hdfcbank.net OR from:creditcards@icicibank.com OR subject:UPI OR subject:debited",
        )

    @classmethod
    async def fetch_and_process_emails(
        cls,
        session: AsyncSession,
        max_results: int = 50,
        custom_service: Resource | None = None,
    ) -> GmailFetchResult:
        """
        Polls Gmail API for bank notification emails in non-blocking worker threads.
        Parses messages using BankParserRegistry and reconciles against the double-entry ledger.
        """
        token_path = cls.get_token_path()
        service = custom_service or await asyncio.to_thread(_build_service_sync, token_path)

        if not service:
            logger.info(
                "Gmail credentials not present or invalid at %s. Skipping automated poll.",
                token_path,
            )
            return GmailFetchResult(
                messages_fetched=0,
                transactions_created=0,
                transactions_merged=0,
                status="CREDENTIALS_MISSING",
            )

        query = cls.get_query()
        logger.info("Executing background Gmail poll with query: '%s'", query)

        try:
            raw_msg_stubs = await asyncio.to_thread(
                _sync_list_messages, service, query, max_results
            )
        except Exception as e:  # noqa: BLE001
            logger.error("Failed to query Gmail messages: %s", e)
            return GmailFetchResult(
                messages_fetched=0,
                transactions_created=0,
                transactions_merged=0,
                status="ERROR",
                error=str(e),
            )

        if not raw_msg_stubs:
            logger.info("No new bank notification emails found in Gmail.")
            return GmailFetchResult(
                messages_fetched=0,
                transactions_created=0,
                transactions_merged=0,
                status="SUCCESS",
            )

        created_count = 0
        merged_count = 0
        registry = BankParserRegistry.get_default()

        for stub in raw_msg_stubs:
            msg_id = stub.get("id")
            if not msg_id:
                continue

            try:
                full_msg = await asyncio.to_thread(_sync_get_message, service, msg_id)
            except Exception as e:  # noqa: BLE001
                logger.warning("Failed to fetch full message %s: %s", msg_id, e)
                continue

            payload = full_msg.get("payload", {})
            headers = _extract_headers_sync(payload)
            body = _extract_body_sync(payload)

            if not body:
                snippet = full_msg.get("snippet", "")
                body = snippet

            sender = headers.get("from")
            subject = headers.get("subject")

            internal_date_ms = int(full_msg.get("internalDate", "0"))
            received_at = (
                datetime.fromtimestamp(internal_date_ms / 1000.0, tz=UTC)
                if internal_date_ms > 0
                else datetime.now(UTC)
            )

            async with db_write_lock():
                raw_msg, is_new = await StagingService.ingest_raw_message(
                    session=session,
                    source="GMAIL",
                    external_id=msg_id,
                    raw_body=body,
                    sender=sender,
                    subject=subject,
                    received_at=received_at,
                )

                if not is_new:
                    # Message already ingested and processed
                    continue

                drafts = registry.parse_raw_message(raw_msg)
                for draft in drafts:
                    try:
                        _, is_created = await ReconciliationService.process_draft(
                            session=session,
                            draft=draft,
                        )
                        if is_created:
                            created_count += 1
                        else:
                            merged_count += 1
                    except Exception as e:  # noqa: BLE001
                        logger.warning(
                            "Failed to process draft for message %s: %s", msg_id, e
                        )


        logger.info(
            "Gmail sync complete. Fetched %d messages, created %d tx, merged %d tx.",
            len(raw_msg_stubs),
            created_count,
            merged_count,
        )

        return GmailFetchResult(
            messages_fetched=len(raw_msg_stubs),
            transactions_created=created_count,
            transactions_merged=merged_count,
            status="SUCCESS",
        )
