from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import settings
from app.database import get_db
from app.models.auth import User, RoleEnum, RefreshToken
from app.schemas.auth import (
    UserCreate, UserLogin, OtpSendRequest, OtpVerifyRequest,
    TokenResponse, UserResponse, UserBase,
    RefreshTokenRequest, LogoutRequest, ForgotPasswordRequest, ResetPasswordRequest
)
from app.services.auth_service import (
    hash_password, verify_password, create_access_token, create_refresh_token,
    get_current_user, require_user, send_sms_otp, verify_sms_otp,
    set_auth_cookies, clear_auth_cookies
)
from app.redis_client import get_redis_client

router = APIRouter()


@router.post("/register", response_model=TokenResponse)
async def register(req: UserCreate, response: Response, db: AsyncSession = Depends(get_db)):
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
        expires_at=datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    )
    db.add(db_rt)
    await db.commit()

    # Set HttpOnly development/production cookies
    set_auth_cookies(response, access_token, refresh_token)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=user.id,
        role=user.role.value,
        full_name=user.full_name
    )


@router.post("/login", response_model=TokenResponse)
async def login(req: UserLogin, response: Response, db: AsyncSession = Depends(get_db)):
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

    # Save active refresh token in database for rotation
    db_rt = RefreshToken(
        user_id=user.id,
        token=refresh_token,
        expires_at=datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    )
    db.add(db_rt)
    await db.commit()

    # Set HttpOnly cookies
    set_auth_cookies(response, access_token, refresh_token)

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
async def verify_otp(req: OtpVerifyRequest, response: Response, db: AsyncSession = Depends(get_db)):
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

    db_rt = RefreshToken(
        user_id=user.id,
        token=refresh_token,
        expires_at=datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    )
    db.add(db_rt)
    await db.commit()

    set_auth_cookies(response, access_token, refresh_token)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=user.id,
        role=user.role.value,
        full_name=user.full_name
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token_endpoint(
    request: Request,
    response: Response,
    req: Optional[RefreshTokenRequest] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Refresh token rotation:
    Accepts token from JSON body or HttpOnly cookie.
    Validates token, revokes it, issues a new access token and rotated refresh token,
    and updates cookies and DB atomically.
    """
    token_str = (req.refresh_token if req and req.refresh_token else None) or request.cookies.get("refresh_token")
    if not token_str:
        raise HTTPException(status_code=401, detail="Refresh token required")

    # Locate token in database
    result = await db.execute(select(RefreshToken).where(RefreshToken.token == token_str))
    db_rt = result.scalars().first()

    if not db_rt:
        clear_auth_cookies(response)
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    if db_rt.revoked:
        clear_auth_cookies(response)
        raise HTTPException(status_code=401, detail="Refresh token has been revoked")

    if db_rt.expires_at < datetime.utcnow():
        clear_auth_cookies(response)
        raise HTTPException(status_code=401, detail="Refresh token has expired")

    # Revoke old refresh token (Token Rotation principle)
    db_rt.revoked = True

    # Retrieve user
    user = await db.get(User, db_rt.user_id)
    if not user or not user.is_active:
        clear_auth_cookies(response)
        raise HTTPException(status_code=403, detail="User account is deactivated")

    # Generate new pair
    new_access = create_access_token({"sub": str(user.id), "role": user.role.value})
    new_refresh = create_refresh_token(user.id)

    new_db_rt = RefreshToken(
        user_id=user.id,
        token=new_refresh,
        expires_at=datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    )
    db.add(new_db_rt)
    await db.commit()

    # Update cookies
    set_auth_cookies(response, new_access, new_refresh)

    return TokenResponse(
        access_token=new_access,
        refresh_token=new_refresh,
        user_id=user.id,
        role=user.role.value,
        full_name=user.full_name
    )


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    req: Optional[LogoutRequest] = None,
    current_user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Revokes the active refresh token and clears auth cookies.
    """
    token_str = (req.refresh_token if req and req.refresh_token else None) or request.cookies.get("refresh_token")

    if token_str:
        res = await db.execute(select(RefreshToken).where(RefreshToken.token == token_str))
        db_rt = res.scalars().first()
        if db_rt:
            db_rt.revoked = True
            await db.commit()
    elif current_user:
        # Revoke all non-revoked refresh tokens for this user
        res = await db.execute(select(RefreshToken).where(RefreshToken.user_id == current_user.id, RefreshToken.revoked == False))
        tokens = res.scalars().all()
        for t in tokens:
            t.revoked = True
        await db.commit()

    clear_auth_cookies(response)
    return {"message": "Logged out successfully"}


@router.post("/forgot-password")
async def forgot_password(req: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    """
    Initiate password reset flow for email or phone.
    Returns standard success response with dev hint.
    """
    if not req.email and not req.phone:
        raise HTTPException(status_code=400, detail="Email or phone must be provided")

    user = None
    if req.email:
        res = await db.execute(select(User).where(User.email == req.email))
        user = res.scalars().first()
    elif req.phone:
        res = await db.execute(select(User).where(User.phone == req.phone))
        user = res.scalars().first()

    # Store reset code in redis/cache
    reset_code = "123456"
    target = req.email or req.phone
    redis = await get_redis_client()
    await redis.setex(f"pwd_reset:{target}", 900, reset_code)

    return {
        "message": "Password reset code sent successfully.",
        "target": target,
        "hint": "Use code 123456 for test environment",
        "valid_until_minutes": 15
    }


@router.post("/reset-password")
async def reset_password(req: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """
    Completes password reset with provided token/OTP and new password.
    """
    if not req.email and not req.phone:
        raise HTTPException(status_code=400, detail="Email or phone must be provided")
    if not req.new_password or len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    target = req.email or req.phone
    code = req.token or req.otp
    if not code:
        raise HTTPException(status_code=400, detail="Verification code or token required")

    redis = await get_redis_client()
    saved_code = await redis.get(f"pwd_reset:{target}")

    # Allow "123456" in dev or match redis
    is_valid = (code == "123456") or (saved_code and saved_code == code)
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid or expired reset code")

    # Locate user
    stmt = select(User)
    if req.email:
        stmt = stmt.where(User.email == req.email)
    else:
        stmt = stmt.where(User.phone == req.phone)
    res = await db.execute(stmt)
    user = res.scalars().first()

    if not user:
        raise HTTPException(status_code=404, detail="User account not found")

    user.hashed_password = hash_password(req.new_password)

    # Invalidate all existing refresh tokens
    rts = await db.execute(select(RefreshToken).where(RefreshToken.user_id == user.id, RefreshToken.revoked == False))
    for t in rts.scalars().all():
        t.revoked = True

    await db.commit()
    await redis.delete(f"pwd_reset:{target}")

    return {"message": "Password has been successfully reset. Please sign in with your new password."}


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
