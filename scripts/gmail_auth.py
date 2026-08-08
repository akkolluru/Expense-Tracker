import json
import sys
from pathlib import Path

# Add project root to sys.path so 'app' can be imported
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from google_auth_oauthlib.flow import InstalledAppFlow

from app.config import get_settings
from app.core.encryption import encrypt_data

settings = get_settings()

def main():
    credentials_dir = settings.credentials_dir
    credentials_dir.mkdir(parents=True, exist_ok=True)
    
    client_secret_file = credentials_dir / "client_secret.json"
    if not client_secret_file.exists():
        if (credentials_dir / "credentials.json").exists():
            client_secret_file = credentials_dir / "credentials.json"
        else:
            print(f"Error: Neither 'client_secret.json' nor 'credentials.json' found in {credentials_dir}.")
            print("Please download your OAuth 2.0 Client ID JSON from Google Cloud Console")
            print("and save it as 'credentials/credentials.json' (or 'credentials/client_secret.json').")
            return
        
    print("Starting OAuth flow...")
    
    flow = InstalledAppFlow.from_client_secrets_file(
        str(client_secret_file), settings.gmail_scopes
    )
    
    # Run local server to capture the redirect
    creds = flow.run_local_server(port=0)
    
    # Save the credentials securely
    creds_dict = {
        "token": creds.token,
        "refresh_token": creds.refresh_token,
        "token_uri": creds.token_uri,
        "client_id": creds.client_id,
        "client_secret": creds.client_secret,
        "scopes": creds.scopes
    }
    
    # Encrypt
    encrypted_str = encrypt_data(json.dumps(creds_dict))
    
    with open(token_file, "w") as f:
        f.write(encrypted_str)
        
    print(f"Success! Token securely encrypted and saved to {token_file}")

if __name__ == "__main__":
    main()
