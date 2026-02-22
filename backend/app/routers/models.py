from fastapi import APIRouter, Request, HTTPException

from ..core.llm import get_models

router = APIRouter()


@router.get("/models")
async def list_models(request: Request) -> dict:
    """
    Proxy for OpenAI-compatible GET /v1/models.

    Accepts optional X-Endpoint-Url and X-Api-Key headers from the frontend.
    """
    endpoint_url: str | None = request.headers.get("x-endpoint-url")
    api_key: str | None = request.headers.get("x-api-key") or None

    try:
        data = await get_models(endpoint_url=endpoint_url, api_key=api_key)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    # Normalise to { models: [{ id }] } regardless of upstream shape
    raw = data.get("data") or data.get("models") or []
    models = [
        {"id": m["id"] if isinstance(m, dict) else m} for m in raw
    ]
    return {"models": models}
