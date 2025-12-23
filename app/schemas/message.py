from datetime import datetime

from pydantic import BaseModel


class MessageCreate(BaseModel):
    content: str


class MessageResponse(BaseModel):
    id: int
    content: str
    created_at: datetime

    class Config:
        from_attributes = True
