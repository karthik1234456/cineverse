import uuid
from datetime import datetime, timedelta
from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.auth import User
from app.models.operations import (
    LoyaltyAccount, LoyaltyLedger, LoyaltyTierEnum,
    LoyaltyActionEnum, CinePassSubscription
)
from app.api.dependencies import require_user

router = APIRouter(prefix="/api/v1/loyalty", tags=["Membership & Loyalty"])


class ReferralClaimRequest(BaseModel):
    referral_code: str


@router.get("/account")
async def get_loyalty_account(
    current_user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieves user's loyalty account, tier, points balance, and ledger history."""
    stmt = (
        select(LoyaltyAccount)
        .where(LoyaltyAccount.user_id == current_user.id)
        .options(selectinload(LoyaltyAccount.ledger_entries))
    )
    res = await db.execute(stmt)
    account = res.scalars().first()

    if not account:
        # Auto-create loyalty account
        account = LoyaltyAccount(
            user_id=current_user.id,
            points_balance=50,  # 50 welcome bonus points
            tier=LoyaltyTierEnum.SILVER,
            total_lifetime_points=50,
            referral_code=f"CINE{current_user.id:04d}{uuid.uuid4().hex[:4].upper()}"
        )
        db.add(account)
        await db.flush()

        ledger = LoyaltyLedger(
            account_id=account.id,
            points_delta=50,
            action=LoyaltyActionEnum.BONUS,
            description="Welcome bonus for joining CineVerse"
        )
        db.add(ledger)
        await db.commit()

        # Re-fetch with ledger
        res = await db.execute(stmt)
        account = res.scalars().first()

    # Check CinePass status
    pass_stmt = select(CinePassSubscription).where(
        CinePassSubscription.user_id == current_user.id,
        CinePassSubscription.is_active == True
    )
    pass_res = await db.execute(pass_stmt)
    cinepass = pass_res.scalars().first()

    return {
        "user_id": current_user.id,
        "points_balance": account.points_balance,
        "tier": account.tier,
        "total_spent_inr": account.total_spent_inr,
        "referral_code": account.referral_code,
        "cinepass": {
            "has_active_pass": cinepass is not None,
            "tickets_remaining": (cinepass.monthly_ticket_quota - cinepass.tickets_used_this_period) if cinepass else 0,
            "quota": cinepass.monthly_ticket_quota if cinepass else 0,
            "period_end": cinepass.period_end.isoformat() if cinepass else None
        } if cinepass else None,
        "ledger": [
            {
                "points_delta": l.points_delta,
                "action": l.action,
                "description": l.description,
                "created_at": l.created_at.isoformat() if l.created_at else None
            }
            for l in sorted(account.ledger_entries, key=lambda x: x.created_at, reverse=True)[:10]
        ]
    }


@router.post("/cinepass/subscribe")
async def subscribe_cinepass(
    current_user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    """Subscribes user to CinePass monthly pass (4 tickets/month, cancel anytime)."""
    stmt = select(CinePassSubscription).where(
        CinePassSubscription.user_id == current_user.id,
        CinePassSubscription.is_active == True
    )
    res = await db.execute(stmt)
    existing = res.scalars().first()
    if existing:
        return {
            "status": "already_subscribed",
            "plan": existing.plan_name,
            "monthly_ticket_quota": existing.monthly_ticket_quota,
            "tickets_remaining": existing.monthly_ticket_quota - existing.tickets_used_this_period,
            "period_end": existing.period_end.isoformat()
        }

    subscription = CinePassSubscription(
        user_id=current_user.id,
        plan_name="CinePass Premium",
        monthly_price=799.0,
        monthly_ticket_quota=4,
        tickets_used_this_period=0,
        period_start=datetime.utcnow(),
        period_end=datetime.utcnow() + timedelta(days=30),
        is_active=True,
        auto_renew=True
    )
    db.add(subscription)
    await db.commit()

    return {
        "status": "success",
        "plan": subscription.plan_name,
        "monthly_ticket_quota": subscription.monthly_ticket_quota,
        "period_end": subscription.period_end.isoformat()
    }


@router.post("/cinepass/cancel")
async def cancel_cinepass(
    current_user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    """Cancels CinePass renewal without dark patterns; retains benefits until period end."""
    stmt = select(CinePassSubscription).where(
        CinePassSubscription.user_id == current_user.id,
        CinePassSubscription.is_active == True
    )
    res = await db.execute(stmt)
    sub = res.scalars().first()
    if not sub:
        raise HTTPException(status_code=404, detail="No active CinePass subscription found")

    sub.auto_renew = False
    sub.is_active = False
    await db.commit()

    return {"status": "success", "message": "CinePass cancelled. No further charges will occur."}


@router.post("/referral/claim")
async def claim_referral_reward(
    req: ReferralClaimRequest,
    current_user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    """Claims a friend's referral code, granting 100 loyalty points to both parties."""
    # Find referrer
    stmt = select(LoyaltyAccount).where(LoyaltyAccount.referral_code == req.referral_code.strip())
    res = await db.execute(stmt)
    referrer_acc = res.scalars().first()

    if not referrer_acc:
        raise HTTPException(status_code=404, detail="Invalid referral code")

    if referrer_acc.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Self-referrals are not permitted")

    # Find or create current user's account
    user_stmt = select(LoyaltyAccount).where(LoyaltyAccount.user_id == current_user.id)
    user_res = await db.execute(user_stmt)
    user_acc = user_res.scalars().first()

    if user_acc and user_acc.referred_by_user_id is not None:
        raise HTTPException(status_code=400, detail="Referral code already redeemed on this account")

    if not user_acc:
        user_acc = LoyaltyAccount(
            user_id=current_user.id,
            points_balance=0,
            tier=LoyaltyTierEnum.SILVER,
            referral_code=f"CINE{current_user.id:04d}{uuid.uuid4().hex[:4].upper()}"
        )
        db.add(user_acc)
        await db.flush()

    # Credit 100 points to both
    user_acc.points_balance += 100
    user_acc.total_lifetime_points += 100
    user_acc.referred_by_user_id = referrer_acc.user_id

    referrer_acc.points_balance += 100
    referrer_acc.total_lifetime_points += 100

    # Add ledger entries
    db.add(LoyaltyLedger(account_id=user_acc.id, points_delta=100, action=LoyaltyActionEnum.REFERRAL, description="Bonus for using friend's referral code"))
    db.add(LoyaltyLedger(account_id=referrer_acc.id, points_delta=100, action=LoyaltyActionEnum.REFERRAL, description="Referral reward for inviting a friend"))

    await db.commit()
    return {"status": "success", "points_awarded": 100, "new_balance": user_acc.points_balance}
