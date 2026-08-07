import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger
import datetime
from sqlalchemy import select, func

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.services.email_fetcher import EmailFetcherService
from app.services.categorizer import categorize_pending_transactions
from app.models.transaction import Transaction
from app.workers.notifications import send_ntfy_alert
from app.workers.backup import run_daily_backup

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

async def daily_summary_job():
    """Calculates total spent today and sends a push notification."""
    logger.info("Running daily summary job...")
    today = datetime.datetime.now().date()
    start_of_day = datetime.datetime.combine(today, datetime.time.min)
    
    async with AsyncSessionLocal() as db:
        stmt = select(func.sum(Transaction.amount)).where(
            Transaction.timestamp >= start_date,
            Transaction.direction == "debit",
            Transaction.status != "ignored"
        )
        # Fix start_date variable to start_of_day
        stmt = select(func.sum(Transaction.amount)).where(
            Transaction.timestamp >= start_of_day,
            Transaction.direction == "debit",
            Transaction.status != "ignored"
        )
        result = await db.execute(stmt)
        total_spent = result.scalar() or 0.0
        
    await send_ntfy_alert(
        title="Daily Expense Summary",
        message=f"You spent ₹{total_spent:,.0f} today.",
        tags="moneybag"
    )

def start_scheduler():
    if not scheduler.running:
        scheduler.add_job(
            combined_job,
            trigger=IntervalTrigger(minutes=settings.email_poll_interval_minutes),
            id="combined_fetch_categorize_job",
            name="Fetch Emails & Categorize",
            replace_existing=True
        )
        # Run daily backup at 2:00 AM
        scheduler.add_job(
            run_daily_backup,
            trigger=CronTrigger(hour=2, minute=0),
            id="daily_backup_job",
            name="Daily Database Backup",
            replace_existing=True
        )
        # Run daily summary at 9:00 PM
        scheduler.add_job(
            daily_summary_job,
            trigger=CronTrigger(hour=21, minute=0),
            id="daily_summary_job",
            name="Daily Spending Summary",
            replace_existing=True
        )
        scheduler.start()
        logger.info(f"Started APScheduler. Polling emails every {settings.email_poll_interval_minutes} minutes.")

def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Stopped APScheduler.")
