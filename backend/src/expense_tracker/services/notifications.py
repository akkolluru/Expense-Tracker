import logging
import os
from decimal import Decimal

import httpx

logger = logging.getLogger(__name__)


class NotificationService:
    @classmethod
    def get_server_url(cls) -> str:
        return os.getenv("NTFY_SERVER_URL", "https://ntfy.sh").rstrip("/")

    @classmethod
    def get_topic(cls) -> str:
        return os.getenv("NTFY_TOPIC", "").strip()

    @classmethod
    async def send_alert(
        cls,
        title: str,
        message: str,
        priority: str = "default",
        tags: list[str] | str | None = None,
        click_url: str | None = None,
        timeout: float = 5.0,
    ) -> bool:
        """
        Sends a push notification via ntfy.sh (or self-hosted ntfy instance).
        Never raises exceptions; gracefully logs errors to protect caller flow.
        """
        topic = cls.get_topic()
        if not topic:
            logger.debug("NTFY_TOPIC is not configured; skipping push notification.")
            return False

        server_url = cls.get_server_url()
        url = f"{server_url}/{topic}"

        # Clean ASCII/Latin-1 headers for httpx compatibility
        headers: dict[str, str] = {
            "Title": title,
            "Priority": priority,
        }

        if tags:
            if isinstance(tags, list):
                headers["Tags"] = ",".join(tags)
            else:
                headers["Tags"] = tags

        if click_url:
            headers["Click"] = click_url

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    url,
                    content=message.encode("utf-8"),
                    headers=headers,
                )
                if response.is_success:
                    logger.info("ntfy alert delivered successfully: %s", title)
                    return True
                else:
                    logger.warning(
                        "ntfy server returned HTTP %d: %s",
                        response.status_code,
                        response.text,
                    )
                    return False
        except Exception as e:  # noqa: BLE001
            logger.warning("Failed to dispatch ntfy push alert: %s", e)
            return False

    @classmethod
    async def notify_pending_review(
        cls,
        amount: Decimal | float,
        merchant_name: str,
        tx_id: int | None = None,
        vpa: str | None = None,
    ) -> bool:
        """Dispatches an alert when a transaction lands in PENDING_REVIEW."""
        title = f"Review Required: ₹{amount:,.2f}"
        msg = f"New transaction at {merchant_name} requires your categorization."
        if vpa:
            msg += f" (VPA: {vpa})"
        tags = ["warning", "eyes"]
        return await cls.send_alert(
            title=title,
            message=msg,
            priority="high",
            tags=tags,
        )

    @classmethod
    async def notify_daily_summary(
        cls,
        total_spent: Decimal | float,
        tx_count: int,
        date_str: str,
    ) -> bool:
        """Dispatches a daily spending summary alert at 9:00 PM."""
        title = "Daily Spending Summary"
        msg = f"Total spend for {date_str}: ₹{total_spent:,.2f} across {tx_count} transactions."
        tags = ["moneybag", "bar_chart"]
        return await cls.send_alert(
            title=title,
            message=msg,
            priority="default",
            tags=tags,
        )
