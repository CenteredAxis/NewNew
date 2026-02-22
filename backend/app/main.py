from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.module_loader import ModuleLoader
from .core.database import Base, engine
from .core.node_types import node_type_registry
from .routers import chat, graph, models


module_loader = ModuleLoader()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure tables exist (dev convenience; production uses alembic)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    module_loader.discover_and_mount(app)
    yield


app = FastAPI(title="Keystone", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router, prefix="/api")
app.include_router(models.router, prefix="/api")
app.include_router(graph.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/modules")
async def list_modules():
    return {"modules": module_loader.loaded_modules}


@app.get("/api/node-types")
async def list_node_types():
    return {"types": node_type_registry.registered_types}
