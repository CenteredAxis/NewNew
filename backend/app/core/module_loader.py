"""
Auto-discovers backend modules in the modules/ directory.

A backend module is any .py file that exports a `router` attribute
of type fastapi.APIRouter. On startup, each discovered router is
mounted under /api/modules/{module_stem}/.

Example module (backend/modules/my_module.py):

    from fastapi import APIRouter
    router = APIRouter()

    @router.get("/hello")
    async def hello():
        return {"hello": "world"}

This becomes reachable at:  GET /api/modules/my_module/hello
"""

import importlib.util
import logging
import sys
from pathlib import Path

from fastapi import FastAPI

logger = logging.getLogger(__name__)

# Absolute path to the modules directory (two levels up from this file:
# backend/app/core/ -> backend/app/ -> backend/ -> backend/modules/)
MODULES_DIR = Path(__file__).parent.parent.parent / "modules"


class ModuleLoader:
    def __init__(self) -> None:
        self.loaded_modules: list[str] = []

    def discover_and_mount(self, app: FastAPI) -> None:
        if not MODULES_DIR.exists():
            logger.info("No modules directory found at %s, skipping.", MODULES_DIR)
            return

        for module_path in sorted(MODULES_DIR.glob("*.py")):
            if module_path.name.startswith("_"):
                continue
            self._load_module(app, module_path)

    def _load_module(self, app: FastAPI, path: Path) -> None:
        stem = path.stem
        module_name = f"llm_modules.{stem}"

        try:
            spec = importlib.util.spec_from_file_location(module_name, path)
            if spec is None or spec.loader is None:
                raise ImportError(f"Could not create spec for {path}")

            mod = importlib.util.module_from_spec(spec)
            sys.modules[module_name] = mod
            spec.loader.exec_module(mod)  # type: ignore[union-attr]

            router = getattr(mod, "router", None)
            if router is None:
                logger.warning(
                    "Module %s has no 'router' attribute, skipping.", stem
                )
                return

            app.include_router(router, prefix=f"/api/modules/{stem}")
            self.loaded_modules.append(stem)
            logger.info("Loaded backend module: %s", stem)

        except Exception:
            logger.exception("Failed to load backend module %s", stem)
