import logging
import shutil
import datetime
from pathlib import Path
from app.config import get_settings
from app.workers.notifications import send_ntfy_alert

logger = logging.getLogger(__name__)

async def run_daily_backup():
    """
    Creates a timestamped copy of the SQLite database.
    Since SQLite is in WAL mode, a simple copy might be slightly inconsistent 
    if a write happens during the copy, but for a personal tracker it's 
    usually fine. For production, `sqlite3 .backup` is better.
    """
    settings = get_settings()
    
    db_path = settings.db_path
    backup_dir = settings.backup_dir
    
    if not backup_dir.exists():
        backup_dir.mkdir(parents=True, exist_ok=True)
        
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = backup_dir / f"expense_tracker_{timestamp}.db"
    
    try:
        shutil.copy2(db_path, backup_path)
        logger.info(f"Database backed up successfully to {backup_path}")
        
        # Keep only the last 7 backups to save space
        backups = sorted(backup_dir.glob("expense_tracker_*.db"))
        if len(backups) > 7:
            for old_backup in backups[:-7]:
                old_backup.unlink()
                logger.info(f"Deleted old backup: {old_backup}")
                
    except Exception as e:
        logger.error(f"Database backup failed: {e}")
        await send_ntfy_alert(
            title="Backup Failed",
            message=f"Failed to backup database: {e}",
            tags="rotating_light"
        )
