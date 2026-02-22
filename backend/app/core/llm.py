"""
Thin async HTTP client that forwards requests to an OpenAI-compatible endpoint.

The caller supplies the endpoint URL and optional API key per request
(sent by the frontend in X-Endpoint-Url / X-Api-Key headers).
Falls back to the server-level config values when headers are absent.
"""

from typing import AsyncIterator

import httpx

from .config import settings


def _client(endpoint_url: str, api_key: str) -> httpx.AsyncClient:
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    return httpx.AsyncClient(base_url=endpoint_url, headers=headers, timeout=120)


async def stream_chat_completions(
    payload: dict,
    endpoint_url: str | None = None,
    api_key: str | None = None,
) -> AsyncIterator[bytes]:
    url = endpoint_url or settings.llm_endpoint_url
    key = api_key or settings.llm_api_key

    async with _client(url, key) as client:
        async with client.stream(
            "POST", "/v1/chat/completions", json=payload
        ) as response:
            response.raise_for_status()
            async for chunk in response.aiter_bytes():
                yield chunk


async def get_models(
    endpoint_url: str | None = None,
    api_key: str | None = None,
) -> dict:
    url = endpoint_url or settings.llm_endpoint_url
    key = api_key or settings.llm_api_key

    async with _client(url, key) as client:
        response = await client.get("/v1/models")
        response.raise_for_status()
        return response.json()
