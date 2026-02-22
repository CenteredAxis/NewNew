from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from ..core.llm import stream_chat_completions

router = APIRouter()


@router.post("/chat/completions")
async def chat_completions(request: Request) -> StreamingResponse:
    """
    Streaming proxy for OpenAI-compatible /v1/chat/completions.

    The frontend may pass endpoint configuration via headers:
      X-Endpoint-Url  – base URL of the local LLM (e.g. http://localhost:11434)
      X-Api-Key       – optional Bearer token
    """
    payload = await request.json()
    payload["stream"] = True  # always stream

    endpoint_url: str | None = request.headers.get("x-endpoint-url")
    api_key: str | None = request.headers.get("x-api-key") or None

    return StreamingResponse(
        stream_chat_completions(payload, endpoint_url=endpoint_url, api_key=api_key),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
