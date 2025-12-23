from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.messages import router as messages_router
from app.database.session import Base, engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="Minimal API Boilerplate", lifespan=lifespan)
app.include_router(messages_router)


@app.get("/")
def health():
    return {"status": "ok"}
