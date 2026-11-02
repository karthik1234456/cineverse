from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr
from app.models.auth import RoleEnum


class UserBase(BaseModel):
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    full_name: str = ""
    preferred_city_id: Optional[int] = None


class UserCreate(UserBase):
    password: str


class UserLogin(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    password: str


class OtpSendRequest(BaseModel):
    phone: str


class OtpVerifyRequest(BaseModel):
    phone: str
    otp: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    refresh_token: str
    user_id: int
    role: str
    full_name: str


class UserResponse(UserBase):
    id: int
    role: RoleEnum
    is_active: bool
    is_verified: bool
    created_at: datetime

    class Config:
        from_attributes = True

