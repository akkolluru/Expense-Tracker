from pydantic_settings import BaseSettings
from pathlib import Path
from functools import lru_cache

class Settings(BaseSettings):
    # Paths
    project_root: Path = Path(__file__).parent.parent
    db_path: Path = Path(__file__).parent.parent / "data" / "expense_tracker.db"
    credentials_dir: Path = Path(__file__).parent.parent / "credentials"
    backup_dir: Path = Path(__file__).parent.parent / "data" / "backups"
    log_dir: Path = Path(__file__).parent.parent / "logs"
    
    # Database
    database_url: str = ""  # computed in validator
    
    # Auth
    secret_key: str = "CHANGE-ME-IN-PRODUCTION"  # override via env
    session_ttl_days: int = 30
    bcrypt_rounds: int = 12
    
    # Email polling
    email_poll_interval_minutes: int = 15
    gmail_scopes: list[str] = ["https://www.googleapis.com/auth/gmail.readonly"]
    hdfc_sender_email: str = "alerts@hdfcbank.bank.in"
    
    # LLM
    llm_server_url: str = "http://127.0.0.1:8080/v1/chat/completions"
    llm_api_key: str = ""  # set if llama-server uses --api-key
    llm_temperature: float = 0.1
    llm_max_tokens: int = 80
    llm_timeout_seconds: float = 30.0
    
    # ntfy
    ntfy_server_url: str = "https://ntfy.sh"
    ntfy_topic: str = "kaushik-expense-inbox-2026"
    
    # Server
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    flet_host: str = "0.0.0.0"
    flet_port: int = 8550
    
    # Rate limiting
    login_rate_limit: str = "5/5minutes"
    
    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }
    
    @property
    def async_database_url(self) -> str:
        return f"sqlite+aiosqlite:///{self.db_path}"

@lru_cache
def get_settings() -> Settings:
    return Settings()
