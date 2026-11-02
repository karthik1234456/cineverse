from pydantic import BaseModel


class CityResponse(BaseModel):
    id: int
    name: str
    slug: str
    state: str
    is_active: bool

    class Config:
        from_attributes = True

