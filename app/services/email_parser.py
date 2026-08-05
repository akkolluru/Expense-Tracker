import re
from typing import Optional
from datetime import datetime
from pydantic import BaseModel

class ParsedEmail(BaseModel):
    amount: float
    direction: str
    account_last4: str
    vpa: str
    merchant_name: str
    date_str: str
    txn_ref: str
    timestamp: datetime

def parse_hdfc_upi_email(body: str, received_timestamp: datetime) -> Optional[ParsedEmail]:
    """
    Parses an HDFC Bank UPI transaction email.
    Matches strings like:
    Rs.60.00 is debited from your account ending 4762 towards VPA
    q816661384@ybl (JAI MATHA DI CHAT BHANDAR) on 04-08-26.
    
    UPI transaction reference no.: 127367628449.
    """
    body = body.replace("\n", " ").replace("\r", " ")
    
    # Updated regex to handle credits as well if they exist, though typically 'credited to'
    # For now matching debit specifically based on the provided examples.
    # Note: If credit emails differ (e.g. "is credited to your account"), adjust regex.
    pattern = r"Rs\.([\d\.,]+) is (debited|credited) (?:from|to) your account ending (\d{4}) towards VPA\s+([\w\.\-\@]+)\s*\((.*?)\)\s*on\s*(\d{2}-\d{2}-\s*\d{2})"
    
    match = re.search(pattern, body)
    if not match:
        return None
        
    amount_str, direction, account_last4, vpa, merchant_name, date_str = match.groups()
    amount = float(amount_str.replace(",", ""))
    date_str = date_str.replace(" ", "")
    
    ref_pattern = r"UPI transaction reference no\.:\s*(\d+)"
    ref_match = re.search(ref_pattern, body)
    txn_ref = ref_match.group(1) if ref_match else None
    
    if not txn_ref:
        return None

    # Parse date (04-08-26 -> 2026-08-04)
    # HDFC format is DD-MM-YY
    try:
        parsed_date = datetime.strptime(date_str, "%d-%m-%y")
        # Keep the time from the received_timestamp since the email body only has the date
        timestamp = received_timestamp.replace(
            year=parsed_date.year,
            month=parsed_date.month,
            day=parsed_date.day
        )
    except ValueError:
        timestamp = received_timestamp

    return ParsedEmail(
        amount=amount,
        direction=direction,
        account_last4=account_last4,
        vpa=vpa.strip(),
        merchant_name=merchant_name.strip(),
        date_str=date_str,
        txn_ref=txn_ref,
        timestamp=timestamp
    )
