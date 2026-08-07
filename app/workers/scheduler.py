import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.services.email_fetcher import EmailFetcherService
from app.services.categorizer import categorize_pending_transactions

logger = logging.getLogger(__name__)
settings = get_settings()

scheduler = AsyncIOScheduler()

async def fetch_emails_job():
    logger.info("Starting scheduled email fetch job...")
    async with AsyncSessionLocal() as db:
        fetcher = EmailFetcherService(db)
        await fetcher.fetch_and_process_emails()
    logger.info("Finished scheduled email fetch job.")

async def categorize_job():
    logger.info("Starting scheduled categorization job...")
    async with AsyncSessionLocal() as db:
        result = await categorize_pending_transactions(db)
    logger.info(f"Categorization complete: {result}")

async def combined_job():
    """Fetch emails, then categorize — runs every poll interval."""
    await fetch_emails_job()
    await categorize_job()

def start_scheduler():
    if not scheduler.running:
        scheduler.add_job(
            combined_job,
            trigger=IntervalTrigger(minutes=settings.email_poll_interval_minutes),
            id="combined_fetch_categorize_job",
            name="Fetch Emails & Categorize",
            replace_existing=True
        )
        scheduler.start()
        logger.info(f"Started APScheduler. Polling emails every {settings.email_poll_interval_minutes} minutes.")

def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Stopped APScheduler.")
