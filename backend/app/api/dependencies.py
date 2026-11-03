from typing import Optional
from fastapi import Depends
from app.models.auth import User, RoleEnum
from app.services.auth_service import get_current_user, require_user, require_role

require_admin = require_role([RoleEnum.ADMIN])
require_cinema_manager = require_role([RoleEnum.ADMIN, RoleEnum.CINEMA_MANAGER])

__all__ = [
    "get_current_user",
    "require_user",
    "require_role",
    "require_admin",
    "require_cinema_manager"
]
