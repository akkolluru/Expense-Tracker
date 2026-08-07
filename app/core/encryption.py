import base64

from cryptography.fernet import Fernet

from app.config import get_settings

settings = get_settings()

def get_fernet() -> Fernet:
    """
    Returns a Fernet instance for encrypting/decrypting sensitive tokens.
    Uses the app's secret_key. If the secret key is not 32 bytes URL-safe base64,
    it derives one using a simple hash.
    """
    key_bytes = settings.secret_key.encode('utf-8')
    # Pad or truncate to 32 bytes
    if len(key_bytes) < 32:
        key_bytes = key_bytes.ljust(32, b'0')
    elif len(key_bytes) > 32:
        key_bytes = key_bytes[:32]
        
    url_safe_key = base64.urlsafe_b64encode(key_bytes)
    return Fernet(url_safe_key)

def encrypt_data(data: str) -> str:
    f = get_fernet()
    return f.encrypt(data.encode('utf-8')).decode('utf-8')

def decrypt_data(encrypted_data: str) -> str:
    f = get_fernet()
    return f.decrypt(encrypted_data.encode('utf-8')).decode('utf-8')
