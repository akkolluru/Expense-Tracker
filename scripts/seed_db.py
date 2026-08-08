import asyncio
import json
import logging
import sys
from pathlib import Path

# Add project root to sys.path so 'app' can be imported
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from passlib.context import CryptContext
from sqlalchemy import select

from app.config import get_settings
from app.database import AsyncSessionLocal, Base, engine
from app.models.app_config import AppConfig
from app.models.category import Category
from app.models.email_sync_state import EmailSyncState
from app.models.user import User

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

async def seed_db():
    settings = get_settings()
    
    # 1. Create data/ directory if it doesn't exist
    data_dir = Path("data")
    data_dir.mkdir(exist_ok=True)
    
    # 2. Create all tables
    logger.info("Creating database tables if they don't exist...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async with AsyncSessionLocal() as session:
        # 3 & 4. Load and insert seed_categories.json
        categories_seeded = 0
        categories_exist = await session.execute(select(Category).limit(1))
        if not categories_exist.scalar_one_or_none():
            logger.info("Seeding categories...")
            seed_file = Path("config/seed_categories.json")
            if seed_file.exists():
                with open(seed_file, "r") as f:
                    categories_data = json.load(f)
                    
                for cat_data in categories_data:
                    # Create parent category
                    parent_cat = Category(
                        name=cat_data["name"],
                        icon=cat_data.get("icon")
                    )
                    session.add(parent_cat)
                    await session.flush() # To get parent_cat.id
                    categories_seeded += 1
                    
                    # Create subcategories
                    for sub_name in cat_data.get("sub", []):
                        sub_cat = Category(
                            name=sub_name,
                            parent_id=parent_cat.id
                        )
                        session.add(sub_cat)
                        categories_seeded += 1
            else:
                logger.warning(f"{seed_file} not found, skipping categories.")
        else:
            logger.info("Categories already exist, skipping.")
            
        # 5. Create default admin user
        admin_exists = await session.execute(select(User).where(User.username == "admin"))
        if not admin_exists.scalar_one_or_none():
            logger.info("Creating default admin user...")
            admin_user = User(
                username="admin",
                password_hash=get_password_hash("changeme")
            )
            session.add(admin_user)
        else:
            logger.info("Admin user already exists, skipping.")
            
        # 6. Insert default app_config
        config_exists = await session.execute(select(AppConfig).limit(1))
        if not config_exists.scalar_one_or_none():
            logger.info("Creating default AppConfig...")
            default_config = AppConfig(
                key="email_poll_interval_minutes",
                value="15"
            )
            session.add(default_config)
        else:
            logger.info("AppConfig already exists, skipping.")
            
        # 7. Create singleton email_sync_state
        sync_state_exists = await session.execute(select(EmailSyncState).limit(1))
        if not sync_state_exists.scalar_one_or_none():
            logger.info("Creating default EmailSyncState...")
            default_sync_state = EmailSyncState()
            session.add(default_sync_state)
        else:
            logger.info("EmailSyncState already exists, skipping.")
            
        # Commit all changes
        await session.commit()
        logger.info(f"Seed completed successfully! Seeded {categories_seeded} categories/subcategories.")

if __name__ == "__main__":
    asyncio.run(seed_db())
