from typing import Optional
from pydantic import BaseModel


class ScreenFormatBase(BaseModel):
    name: str
    description: Optional[str] = None
    requires_glasses: bool = False
    is_active: bool = True


class ScreenFormatCreate(ScreenFormatBase):
    pass


class ScreenFormatUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    requires_glasses: Optional[bool] = None
    is_active: Optional[bool] = None


class ScreenFormatResponse(ScreenFormatBase):
    id: int

    class Config:
        from_attributes = True


class SoundSystemBase(BaseModel):
    name: str
    description: Optional[str] = None
    channels: Optional[str] = None
    is_active: bool = True


class SoundSystemCreate(SoundSystemBase):
    pass


class SoundSystemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    channels: Optional[str] = None
    is_active: Optional[bool] = None


class SoundSystemResponse(SoundSystemBase):
    id: int

    class Config:
        from_attributes = True


class ProjectionTypeBase(BaseModel):
    name: str
    description: Optional[str] = None
    resolution: Optional[str] = None
    is_active: bool = True


class ProjectionTypeCreate(ProjectionTypeBase):
    pass


class ProjectionTypeUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    resolution: Optional[str] = None
    is_active: Optional[bool] = None


class ProjectionTypeResponse(ProjectionTypeBase):
    id: int

    class Config:
        from_attributes = True


class AuditoriumAssignmentUpdate(BaseModel):
    screen_format_id: Optional[int] = None
    sound_system_id: Optional[int] = None
    projection_type_id: Optional[int] = None
    confirmed_with_cinema: Optional[bool] = None
    is_demo: Optional[bool] = None
