from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.auth import User, RoleEnum, RefreshToken
from app.schemas.auth import (
    UserCreate, UserLogin, OtpSendRequest, OtpVerifyRequest,
    TokenResponse, UserResponse, UserBase
)
from app.services.auth_service import (
    hash_password, verify_password, create_access_token, create_refresh_token,
    get_current_user, require_user, send_sms_otp, verify_sms_otp
)

router = APIRouter()


@router.post("/register", response_model=TokenResponse)
async def register(req: UserCreate, db: AsyncSession = Depends(get_db)):
    if req.email:
        res = await db.execute(select(User).where(User.email == req.email))
        if res.scalars().first():
            raise HTTPException(status_code=400, detail="Email is already registered")

    if req.phone:
        res = await db.execute(select(User).where(User.phone == req.phone))
        if res.scalars().first():
            raise HTTPException(status_code=400, detail="Phone number is already registered")

    user = User(
        email=req.email,
        phone=req.phone,
        hashed_password=hash_password(req.password),
        full_name=req.full_name or (req.email.split("@")[0] if req.email else "CineVerse Patron"),
        role=RoleEnum.CUSTOMER,
        preferred_city_id=req.preferred_city_id,
        is_active=True,
        is_verified=True
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    access_token = create_access_token({"sub": str(user.id), "role": user.role.value})
    refresh_token = create_refresh_token(user.id)

    db_rt = RefreshToken(
        user_id=user.id,
        token=refresh_token,
        expires_at=datetime.utcnow() + timedelta(days=7)
    )
    db.add(db_rt)
    await db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=user.id,
        role=user.role.value,
        full_name=user.full_name
    )


@router.post("/login", response_model=TokenResponse)
async def login(req: UserLogin, db: AsyncSession = Depends(get_db)):
    stmt = select(User)
    if req.email:
        stmt = stmt.where(User.email == req.email)
    elif req.phone:
        stmt = stmt.where(User.phone == req.phone)
    else:
        raise HTTPException(status_code=400, detail="Email or phone must be provided")

    result = await db.execute(stmt)
    user = result.scalars().first()

    if not user or not user.hashed_password or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email/phone or password")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    access_token = create_access_token({"sub": str(user.id), "role": user.role.value})
    refresh_token = create_refresh_token(user.id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=user.id,
        role=user.role.value,
        full_name=user.full_name
    )


@router.post("/otp/send")
async def send_otp(req: OtpSendRequest):
    await send_sms_otp(req.phone)
    return {"message": "OTP sent successfully to phone", "phone": req.phone, "hint": "Use 123456 for test environment"}


@router.post("/otp/verify", response_model=TokenResponse)
async def verify_otp(req: OtpVerifyRequest, db: AsyncSession = Depends(get_db)):
    valid = await verify_sms_otp(req.phone, req.otp)
    if not valid:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    # Find or auto-register user with this phone
    result = await db.execute(select(User).where(User.phone == req.phone))
    user = result.scalars().first()
    if not user:
        user = User(
            phone=req.phone,
            full_name=f"Patron {req.phone[-4:]}",
            role=RoleEnum.CUSTOMER,
            is_active=True,
            is_verified=True
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    access_token = create_access_token({"sub": str(user.id), "role": user.role.value})
    refresh_token = create_refresh_token(user.id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=user.id,
        role=user.role.value,
        full_name=user.full_name
    )


@router.get("/me", response_model=UserResponse)
async def get_my_profile(current_user: User = Depends(require_user)):
    return current_user


@router.put("/me", response_model=UserResponse)
async def update_my_profile(
    data: UserBase,
    current_user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    if data.full_name:
        current_user.full_name = data.full_name
    if data.preferred_city_id:
        current_user.preferred_city_id = data.preferred_city_id
    if data.email and data.email != current_user.email:
        current_user.email = data.email
    await db.commit()
    await db.refresh(current_user)
    return current_user

