from datetime import datetime, timezone
import re
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from expense_tracker.models.rule import MerchantMemory

class MerchantMemoryService:
    @staticmethod
    def normalize_key(merchant_name: str, merchant_vpa: Optional[str] = None) -> str:
        if merchant_vpa and merchant_vpa.strip():
            return merchant_vpa.strip().lower()

        # Sanitize merchant name: strip terminal tags, location codes, numbers
        s = merchant_name.lower()
        # Remove terminal codes like #0492 or POS-123
        s = re.sub(r"#\d+", " ", s)
        s = re.sub(r"\bpos[- ]?\d+\b", " ", s)
        # Remove common city codes and country 'in'
        s = re.sub(r"\b(?:in|blr|del|mum|hyd|che|kol)\b", " ", s)
        # Remove 5+ digit postal codes or reference IDs
        s = re.sub(r"\b\d{5,}\b", " ", s)
        # Remove punctuation
        s = re.sub(r"[^\w\s]", " ", s)
        # Collapse multiple spaces
        s = re.sub(r"\s+", " ", s).strip()
        return s or merchant_name.strip().lower()

    @classmethod
    async def lookup(
        cls,
        session: AsyncSession,
        merchant_name: str,
        merchant_vpa: Optional[str] = None,
    ) -> Optional[MerchantMemory]:
        key = cls.normalize_key(merchant_name, merchant_vpa)
        stmt = select(MerchantMemory).where(MerchantMemory.merchant_key == key)
        res = await session.execute(stmt)
        memory = res.scalar_one_or_none()

        if memory:
            memory.hit_count += 1
            memory.last_used_at = datetime.now(timezone.utc)
            await session.commit()
            await session.refresh(memory)
            return memory

        return None

    @classmethod
    async def learn_merchant(
        cls,
        session: AsyncSession,
        category_id: int,
        merchant_name: str,
        merchant_vpa: Optional[str] = None,
    ) -> MerchantMemory:
        key = cls.normalize_key(merchant_name, merchant_vpa)
        stmt = select(MerchantMemory).where(MerchantMemory.merchant_key == key)
        res = await session.execute(stmt)
        memory = res.scalar_one_or_none()

        now = datetime.now(timezone.utc)
        if memory:
            memory.category_id = category_id
            memory.hit_count += 1
            memory.updated_at = now
            memory.last_used_at = now
        else:
            memory = MerchantMemory(
                merchant_key=key,
                merchant_name=merchant_name,
                merchant_vpa=merchant_vpa,
                category_id=category_id,
                hit_count=1,
                confidence=1.0,
                last_used_at=now,
                created_at=now,
                updated_at=now,
            )
            session.add(memory)

        await session.commit()
        await session.refresh(memory)
        return memory
