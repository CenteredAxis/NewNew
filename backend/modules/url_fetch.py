"""
URL Fetch module — fetches web page content and stores a preview.

Creates nodes of type "fetch" that retrieve URL content.

Node metadata.input schema:
    {"url": str}

Node metadata.output schema:
    {"url": str, "statusCode": int, "contentType": str, "body": str}
"""

from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError

from fastapi import APIRouter

router = APIRouter()

MAX_BODY_SIZE = 4000  # characters to store


class UrlFetchHandler:
    node_type = "fetch"

    async def execute(self, node_data: dict, db: object) -> "ExecutionResult":
        from app.core.node_types import ExecutionResult

        meta = node_data.get("metadata", {})
        input_data = meta.get("input", {})
        url = input_data.get("url", "")

        if not url.strip():
            return ExecutionResult(
                content="(no URL provided)",
                output={},
                status="error",
                error="No URL provided",
            )

        try:
            req = Request(url, headers={"User-Agent": "Keystone/0.1"})
            with urlopen(req, timeout=15) as resp:
                status_code = resp.status
                content_type = resp.headers.get("Content-Type", "unknown")
                raw = resp.read(MAX_BODY_SIZE * 4)  # read extra to account for encoding
                body = raw.decode("utf-8", errors="replace")[:MAX_BODY_SIZE]

            content = f"Fetched [{url}]({url}) (HTTP {status_code}):\n```\n{body}\n```"

            return ExecutionResult(
                content=content,
                output={
                    "url": url,
                    "statusCode": status_code,
                    "contentType": content_type,
                    "body": body,
                },
                status="complete",
            )

        except HTTPError as e:
            return ExecutionResult(
                content=f"HTTP error fetching {url}: {e.code} {e.reason}",
                output={"url": url, "statusCode": e.code},
                status="error",
                error=f"HTTP {e.code}: {e.reason}",
            )
        except URLError as e:
            return ExecutionResult(
                content=f"Failed to fetch {url}: {e.reason}",
                output={"url": url},
                status="error",
                error=str(e.reason),
            )
        except Exception as e:
            return ExecutionResult(
                content=f"Error fetching {url}: {e}",
                output={"url": url},
                status="error",
                error=str(e),
            )

    def validate_input(self, input_data: dict) -> bool:
        url = input_data.get("url", "")
        return isinstance(url, str) and url.startswith(("http://", "https://"))


NODE_TYPES = {"fetch": UrlFetchHandler()}
