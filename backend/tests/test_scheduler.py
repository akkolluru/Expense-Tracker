import pytest

from expense_tracker.workers.scheduler import AppScheduler


@pytest.mark.asyncio
async def test_scheduler_lifecycle_and_jobs() -> None:
    scheduler = AppScheduler()
    assert not scheduler.is_running

    scheduler.start()
    assert scheduler.is_running

    jobs = scheduler.scheduler.get_jobs()
    job_ids = {j.id for j in jobs}
    assert "gmail_poll_worker" in job_ids
    assert "daily_vacuum_backup" in job_ids
    assert "daily_spending_summary" in job_ids

    # Calling start again should log warning and remain running
    scheduler.start()
    assert scheduler.is_running

    await scheduler.shutdown()
    assert not scheduler.is_running

