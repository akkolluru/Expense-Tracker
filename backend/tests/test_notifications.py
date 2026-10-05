from decimal import Decimal
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from expense_tracker.services.notifications import NotificationService


@pytest.mark.asyncio
async def test_send_alert_skips_when_no_topic(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("NTFY_TOPIC", raising=False)
    result = await NotificationService.send_alert(
        title="Test",
        message="Hello World",
    )
    assert result is False


@pytest.mark.asyncio
async def test_send_alert_success(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("NTFY_TOPIC", "my-test-expenses")
    monkeypatch.setenv("NTFY_SERVER_URL", "https://ntfy.sh")

    mock_resp = AsyncMock(spec=httpx.Response)
    mock_resp.is_success = True
    mock_resp.status_code = 200

    with patch("httpx.AsyncClient.post", return_value=mock_resp) as mock_post:
        result = await NotificationService.send_alert(
            title="Spending Warning",
            message="You spent ₹500 at Cafe",
            priority="high",
            tags=["warning", "coffee"],
        )
        assert result is True
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        assert args[0] == "https://ntfy.sh/my-test-expenses"
        assert kwargs["headers"]["Title"] == "Spending Warning"
        assert kwargs["headers"]["Priority"] == "high"
        assert kwargs["headers"]["Tags"] == "warning,coffee"
        assert kwargs["content"] == b"You spent \xe2\x82\xb9500 at Cafe"


@pytest.mark.asyncio
async def test_send_alert_network_error_graceful(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("NTFY_TOPIC", "my-test-expenses")

    with patch("httpx.AsyncClient.post", side_effect=httpx.ConnectError("Network unreachable")):
        # Must return False and NOT raise exception
        result = await NotificationService.send_alert(
            title="Alert",
            message="Test message",
        )
        assert result is False


@pytest.mark.asyncio
async def test_notify_pending_review(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("NTFY_TOPIC", "my-test-expenses")

    with patch.object(NotificationService, "send_alert", return_value=True) as mock_send:
        result = await NotificationService.notify_pending_review(
            amount=Decimal("1250.50"),
            merchant_name="Unknown Corner Store",
            vpa="store@okaxis",
        )
        assert result is True
        mock_send.assert_called_once()
        _, kwargs = mock_send.call_args
        assert "1,250.50" in kwargs["title"]
        assert "Unknown Corner Store" in kwargs["message"]
        assert "store@okaxis" in kwargs["message"]
        assert kwargs["priority"] == "high"


@pytest.mark.asyncio
async def test_notify_daily_summary(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("NTFY_TOPIC", "my-test-expenses")

    with patch.object(NotificationService, "send_alert", return_value=True) as mock_send:
        result = await NotificationService.notify_daily_summary(
            total_spent=Decimal("3450.00"),
            tx_count=5,
            date_str="2026-10-05",
        )
        assert result is True
        mock_send.assert_called_once()
        _, kwargs = mock_send.call_args
        assert "Daily Spending Summary" in kwargs["title"]
        assert "3,450.00" in kwargs["message"]
        assert "5 transactions" in kwargs["message"]
