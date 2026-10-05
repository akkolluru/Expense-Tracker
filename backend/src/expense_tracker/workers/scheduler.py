import logging
import os
from datetime import UTC, datetime
from decimal import Decimal

from apscheduler.schedulers.asyncio import AsyncIOScheduler  # type: ignore[import-untyped]
from apscheduler.triggers.cron import CronTrigger  # type: ignore[import-untyped]
from apscheduler.triggers.interval import IntervalTrigger  # type: ignore[import-untyped]
from sqlalchemy import func, select

from expense_tracker.database import get_session_maker
from expense_tracker.models.transaction import Transaction
from expense_tracker.services.backup import BackupService
from expense_tracker.services.gmail_fetcher import GmailFetcherService
from expense_tracker.services.notifications import NotificationService

logger = logging.getLogger(__name__)


async def run_gmail_poll_job() -> None:
    """15-minute background Gmail polling worker."""
    logger.info("Executing scheduled Gmail ingestion worker job...")
    session_maker = get_session_maker()
    async with session_maker() as session:
        try:
            res = await GmailFetcherService.fetch_and_process_emails(session)
            logger.info("Scheduled Gmail poll completed with status: %s", res.status)
        except Exception as e:  # noqa: BLE001
            logger.error("Scheduled Gmail poll job failed: %s", e)


async def run_daily_backup_job() -> None:
    """Scheduled daily 2:00 AM SQLite VACUUM INTO backup snapshot."""
    logger.info("Executing scheduled SQLite VACUUM INTO daily backup...")
    session_maker = get_session_maker()
    async with session_maker() as session:
        try:
            res = await BackupService.create_backup(session)
            logger.info(
                "Scheduled daily backup succeeded: %s (%d bytes)",
                res.backup_file,
                res.size_bytes,
            )
        except Exception as e:  # noqa: BLE001
            logger.error("Scheduled daily backup failed: %s", e)
            await NotificationService.send_alert(
                title="Backup Failed",
                message=f"Scheduled daily database backup failed: {e}",
                priority="high",
                tags=["rotating_light", "warning"],
            )


async def run_daily_summary_job() -> None:
    """Scheduled 9:00 PM daily spending summary notification."""
    logger.info("Executing scheduled 9:00 PM daily spending summary...")
    session_maker = get_session_maker()
    async with session_maker() as session:
        try:
            now = datetime.now(UTC)
            start_of_day = datetime(now.year, now.month, now.day, 0, 0, 0, tzinfo=UTC)
            stmt = select(
                func.coalesce(func.sum(Transaction.amount), 0),
                func.count(Transaction.id),
            ).where(
                Transaction.timestamp >= start_of_day,
                Transaction.is_expense.is_(True),
                Transaction.is_transfer.is_(False),
                Transaction.status != "IGNORED",
            )
            query_res = await session.execute(stmt)
            total_spent, count = query_res.one()
            today_str = now.strftime("%d %b %Y")
            await NotificationService.notify_daily_summary(
                total_spent=Decimal(str(total_spent)),
                tx_count=count,
                date_str=today_str,
            )
        except Exception as e:  # noqa: BLE001
            logger.error("Daily summary job failed: %s", e)


class AppScheduler:
    def __init__(self) -> None:
        self.scheduler = AsyncIOScheduler()

    @property
    def is_running(self) -> bool:
        return self.scheduler.running  # type: ignore[no-any-return]

    def start(self) -> None:
        if self.scheduler.running:
            logger.warning("APScheduler is already running.")
            return

        poll_minutes = int(os.getenv("EMAIL_POLL_INTERVAL_MINUTES", "15"))
        backup_hour = int(os.getenv("BACKUP_CRON_HOUR", "2"))
        backup_minute = int(os.getenv("BACKUP_CRON_MINUTE", "0"))
        summary_hour = int(os.getenv("SUMMARY_CRON_HOUR", "21"))
        summary_minute = int(os.getenv("SUMMARY_CRON_MINUTE", "0"))

        # Job 1: Gmail Poller (15 minutes)
        self.scheduler.add_job(
            run_gmail_poll_job,
            trigger=IntervalTrigger(minutes=poll_minutes),
            id="gmail_poll_worker",
            name="15-Minute Background Gmail Ingestion",
            replace_existing=True,
        )

        # Job 2: Daily 2:00 AM SQLite VACUUM Backup
        self.scheduler.add_job(
            run_daily_backup_job,
            trigger=CronTrigger(hour=backup_hour, minute=backup_minute),
            id="daily_vacuum_backup",
            name="Daily 2:00 AM SQLite VACUUM Backup",
            replace_existing=True,
        )

        # Job 3: Daily 9:00 PM Summary
        self.scheduler.add_job(
            run_daily_summary_job,
            trigger=CronTrigger(hour=summary_hour, minute=summary_minute),
            id="daily_spending_summary",
            name="Daily 9:00 PM Spending Summary",
            replace_existing=True,
        )

        self.scheduler.start()
        logger.info(
            "APScheduler started successfully: Gmail poll (%dm), Daily backup (%02d:%02d), Summary (%02d:%02d)",
            poll_minutes,
            backup_hour,
            backup_minute,
            summary_hour,
            summary_minute,
        )

    async def shutdown(self) -> None:
        if self.scheduler.running:
            self.scheduler.shutdown(wait=False)
            import asyncio
            await asyncio.sleep(0)
            logger.info("APScheduler stopped.")



# Global scheduler singleton
app_scheduler = AppScheduler()
