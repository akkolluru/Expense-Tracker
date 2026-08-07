from datetime import datetime

from app.services.email_parser import parse_hdfc_upi_email


def test_parse_hdfc_upi_email_debit_1():
    body = """Dear Customer,
Greetings from HDFC Bank!
Rs.60.00 is debited from your account ending 4762 towards VPA
q816661384@ybl (JAI MATHA DI CHAT BHANDAR) on 04-08-26.
UPI transaction reference no.: 127367628449.
If you did not authorize this transaction, please report it immediately at:"""
    
    received = datetime(2026, 8, 4, 17, 35, 0)
    parsed = parse_hdfc_upi_email(body, received)
    
    assert parsed is not None
    assert parsed.amount == 60.00
    assert parsed.direction == "debit"
    assert parsed.account_last4 == "4762"
    assert parsed.vpa == "q816661384@ybl"
    assert parsed.merchant_name == "JAI MATHA DI CHAT BHANDAR"
    assert parsed.txn_ref == "127367628449"
    assert parsed.timestamp == datetime(2026, 8, 4, 17, 35, 0)

def test_parse_hdfc_upi_email_debit_2():
    body = """Dear Customer,
Greetings from HDFC Bank!
Rs.311.00 is debited from your account ending 4762 towards VPA
zeptopgonline@ybl (ZEPTO MARKETPLACE PRIVATE LIMITED) on 04-08-26.
UPI transaction reference no.: 127377523812."""
    
    received = datetime(2026, 8, 4, 20, 11, 0)
    parsed = parse_hdfc_upi_email(body, received)
    
    assert parsed is not None
    assert parsed.amount == 311.00
    assert parsed.vpa == "zeptopgonline@ybl"
    assert parsed.merchant_name == "ZEPTO MARKETPLACE PRIVATE LIMITED"
    assert parsed.txn_ref == "127377523812"
    
def test_parse_hdfc_upi_email_newlines_replaced():
    body = """Rs.20.00 is debited from your account ending 4762 towards VPA
bharatpe.9p0i0v7z3h349961@fbpe (BEZAWADA SATYA VENKA) on 04-08-
26.

UPI transaction reference no.: 127381582562."""
    
    received = datetime(2026, 8, 4, 21, 0, 0)
    parsed = parse_hdfc_upi_email(body, received)
    
    assert parsed is not None
    assert parsed.amount == 20.00
    assert parsed.vpa == "bharatpe.9p0i0v7z3h349961@fbpe"
    assert parsed.merchant_name == "BEZAWADA SATYA VENKA"
    assert parsed.txn_ref == "127381582562"
    assert parsed.timestamp == datetime(2026, 8, 4, 21, 0, 0)

def test_parse_invalid_email():
    body = "This is a random email about some other topic."
    received = datetime.now()
    parsed = parse_hdfc_upi_email(body, received)
    assert parsed is None
