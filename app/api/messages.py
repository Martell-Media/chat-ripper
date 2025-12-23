from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.models import Message
from app.database.session import get_db
from app.schemas.message import MessageCreate, MessageResponse

router = APIRouter()

DbSession = Annotated[Session, Depends(get_db)]


@router.post("/messages", response_model=MessageResponse, status_code=201)
def create_message(message: MessageCreate, db: DbSession) -> MessageResponse:
    db_message = Message(content=message.content)
    db.add(db_message)
    db.commit()
    db.refresh(db_message)
    return db_message


@router.get("/messages/{message_id}", response_model=MessageResponse)
def get_message(message_id: int, db: DbSession) -> MessageResponse:
    db_message = db.query(Message).filter(Message.id == message_id).first()
    if db_message is None:
        raise HTTPException(status_code=404, detail="Message not found")
    return db_message
