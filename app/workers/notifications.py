import httpx
import logging
from app.config import get_settings

logger = logging.getLogger(__name__)

async def send_ntfy_alert(title: str, message: str, priority: str = "default", tags: str = ""):
    """
    Send a push notification via ntfy.sh (or self-hosted ntfy server).
    Priority can be: 1-5, or min, low, default, high, max
    Tags is a comma separated string of emojis or tags (e.g., 'warning,skull')
    """
    settings = get_settings()
    
    url = f"{settings.ntfy_server_url}/{settings.ntfy_topic}"
    headers = {
        "Title": title.encode("utf-8"),
        "Priority": priority.encode("utf-8"),
    }
    if tags:
        headers["Tags"] = tags.encode("utf-8")
        
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, data=message.encode('utf-8'), headers=headers)
            response.raise_for_status()
            logger.info(f"Sent ntfy alert: {title}")
    except Exception as e:
        logger.error(f"Failed to send ntfy alert: {e}")
