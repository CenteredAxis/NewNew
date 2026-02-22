from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.module_loader import ModuleLoader
from .routers import chat, models


module_loader = ModuleLoader()


@asynccontextmanager
async def lifespan(app: FastAPI):
    module_loader.discover_and_mount(app)
    yield


app = FastAPI(title="Local LLM Backend", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router, prefix="/api")
app.include_router(models.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/modules")
async def list_modules():
    return {"modules": module_loader.loaded_modules}
