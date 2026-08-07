"""
Categorization Orchestrator — the 3-layer pipeline:

  Layer 1: Rule Engine  (VPA exact match)
  Layer 2: LLM Inference (local llama-server)
  Layer 3: Human-in-the-loop (pending_review)

Each path writes a CategorizationLog entry for auditability.
"""

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.categorization_log import CategorizationLog
from app.models.category import Category
from app.models.rule import Rule
from app.models.transaction import Transaction
from app.services.llm_client import classify_transaction

logger = logging.getLogger(__name__)


# ── Layer 1: Rule Engine ──────────────────────────────────────────────────────

async def check_rule(vpa: str, db: AsyncSession) -> Rule | None:
    """Exact VPA match against the rules table."""
    result = await db.execute(select(Rule).where(Rule.vpa == vpa))
    return result.scalar_one_or_none()


# ── Helper: build category tree string for LLM prompt ─────────────────────────

async def build_category_tree_string(db: AsyncSession) -> str:
    """
    Build a compact text representation of the category tree
    for the LLM prompt context.
    """
    result = await db.execute(
        select(Category)
        .where(Category.parent_id == None, Category.is_active == True)
        .options(selectinload(Category.children))
        .order_by(Category.name)
    )
    parents = result.scalars().all()

    lines: list[str] = []
    for parent in parents:
        active_children = [c for c in parent.children if c.is_active]
        if active_children:
            child_names = ", ".join(c.name for c in active_children)
            lines.append(f"- {parent.name}: [{child_names}]")
        else:
            lines.append(f"- {parent.name}")

    return "\n".join(lines)


# ── Helper: resolve category name → id ────────────────────────────────────────

async def resolve_category_id(
    name: str, parent_id: int | None, db: AsyncSession
) -> int | None:
    """Look up a category by name and optional parent_id."""
    if not name or name == "null":
        return None

    stmt = select(Category).where(
        Category.name == name,
        Category.parent_id == parent_id,
        Category.is_active == True,
    )
    result = await db.execute(stmt)
    cat = result.scalar_one_or_none()
    return cat.id if cat else None


# ── Main Orchestrator ─────────────────────────────────────────────────────────

async def categorize_transaction(txn: Transaction, db: AsyncSession) -> str:
    """
    Run the full categorization pipeline for a single transaction.

    Returns the resulting status: "categorized" or "pending_review".
    """

    # ── Layer 1: Rule Engine ──────────────────────────────────────────────
    if txn.vpa:
        rule = await check_rule(txn.vpa, db)
        if rule:
            txn.category_id = rule.category_id
            txn.sub_category_id = rule.sub_category_id
            txn.status = "categorized"
            txn.categorized_by = "rule_engine"

            rule.hit_count += 1

            log = CategorizationLog(
                transaction_id=txn.id,
                action="auto_rule",
                to_category_id=rule.category_id,
                to_sub_category_id=rule.sub_category_id,
            )
            db.add(log)
            logger.info(
                f"[Rule Engine] Transaction {txn.id} categorized by rule "
                f"(VPA={txn.vpa}, cat={rule.category_id})"
            )
            return "categorized"

    # ── Layer 2: LLM Inference ────────────────────────────────────────────
    category_tree = await build_category_tree_string(db)

    llm_result = await classify_transaction(
        merchant_name=txn.merchant_name or txn.vpa or "Unknown",
        amount=txn.amount,
        direction=txn.direction,
        category_tree=category_tree,
    )

    if llm_result.is_success and llm_result.is_high_confidence:
        # Resolve the category name to an ID
        cat_id = await resolve_category_id(llm_result.category, None, db)

        if cat_id is not None:
            sub_cat_id = None
            if llm_result.sub_category:
                sub_cat_id = await resolve_category_id(
                    llm_result.sub_category, cat_id, db
                )

            txn.category_id = cat_id
            txn.sub_category_id = sub_cat_id
            txn.status = "categorized"
            txn.categorized_by = "llm"

            log = CategorizationLog(
                transaction_id=txn.id,
                action="auto_llm",
                to_category_id=cat_id,
                to_sub_category_id=sub_cat_id,
                llm_response_raw=llm_result.raw_response,
                llm_inference_time_ms=llm_result.inference_time_ms,
            )
            db.add(log)
            logger.info(
                f"[LLM] Transaction {txn.id} categorized as "
                f"{llm_result.category}/{llm_result.sub_category} "
                f"(confidence={llm_result.confidence}, {llm_result.inference_time_ms}ms)"
            )
            return "categorized"

        # Category name from LLM didn't match any known category
        logger.warning(
            f"[LLM] Category '{llm_result.category}' not found in DB "
            f"for txn {txn.id}. Falling through to pending_review."
        )

    # ── Layer 3: Human-in-the-Loop ────────────────────────────────────────
    txn.status = "pending_review"
    txn.categorized_by = "pending"  # Mark as attempted to prevent infinite retry loop

    # Log the LLM attempt for debugging (only if we have a valid category to reference)
    # We skip logging here to avoid FK violation since to_category_id is NOT NULL
    # and we have no valid category. The raw LLM response is still visible in server logs.
    if llm_result.error:
        logger.warning(
            f"[LLM Error] Transaction {txn.id}: {llm_result.error}"
        )

    logger.info(
        f"[Pending Review] Transaction {txn.id} sent to inbox "
        f"(llm_error={llm_result.error}, confidence={llm_result.confidence})"
    )
    
    # Fire off push notification for manual review
    try:
        from app.workers.notifications import send_ntfy_alert
        import asyncio
        asyncio.ensure_future(
            send_ntfy_alert(
                title="Action Required: Review Transaction",
                message=f"Rs.{txn.amount} at {txn.merchant_name or txn.vpa or 'Unknown'} needs review.",
                tags="warning,mag"
            )
        )
    except Exception as e:
        logger.error(f"Failed to send notification: {e}")

    return "pending_review"


# ── Batch Categorizer (for scheduler integration) ─────────────────────────────

async def categorize_pending_transactions(db: AsyncSession) -> dict:
    """
    Fetch all pending_review transactions that came from email_auto
    and haven't been categorized yet, then run them through the pipeline.

    Returns a summary dict: {"categorized": N, "still_pending": M}
    """
    result = await db.execute(
        select(Transaction).where(
            Transaction.status == "pending_review",
            Transaction.source == "email_auto",
            Transaction.categorized_by == None,  # noqa: E711
        ).limit(50)  # Prevent processing too many at once
    )
    pending_txns = result.scalars().all()

    categorized = 0
    still_pending = 0

    for txn in pending_txns:
        status = await categorize_transaction(txn, db)
        if status == "categorized":
            categorized += 1
        else:
            still_pending += 1

    await db.commit()

    logger.info(
        f"Batch categorization complete: {categorized} categorized, "
        f"{still_pending} still pending"
    )
    return {"categorized": categorized, "still_pending": still_pending}
