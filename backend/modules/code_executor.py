"""
Code Executor module — runs Python code snippets in a sandboxed subprocess.

Creates nodes of type "code" that execute user-provided code and
capture stdout/stderr output.

Node metadata.input schema:
    {"code": str, "language": str}

Node metadata.output schema:
    {"stdout": str, "stderr": str, "exitCode": int}
"""

import asyncio

from fastapi import APIRouter

router = APIRouter()


class CodeExecutorHandler:
    node_type = "code"

    async def execute(self, node_data: dict, db: object) -> "ExecutionResult":
        from app.core.node_types import ExecutionResult

        meta = node_data.get("metadata", {})
        input_data = meta.get("input", {})
        code = input_data.get("code", "")
        language = input_data.get("language", "python")

        if not code.strip():
            return ExecutionResult(
                content="(no code to execute)",
                output={"stdout": "", "stderr": "", "exitCode": 0},
                status="complete",
            )

        if language != "python":
            return ExecutionResult(
                content=f"Unsupported language: {language}",
                output={},
                status="error",
                error=f"Only Python execution is currently supported, got: {language}",
            )

        try:
            proc = await asyncio.create_subprocess_exec(
                "python", "-c", code,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout_bytes, stderr_bytes = await asyncio.wait_for(
                proc.communicate(), timeout=10.0
            )

            stdout = stdout_bytes.decode("utf-8", errors="replace")
            stderr = stderr_bytes.decode("utf-8", errors="replace")
            exit_code = proc.returncode or 0

            # Build human-readable content for LLM context
            content_parts = [f"```{language}\n{code}\n```"]
            if stdout.strip():
                content_parts.append(f"Output:\n```\n{stdout.rstrip()}\n```")
            if stderr.strip():
                content_parts.append(f"Stderr:\n```\n{stderr.rstrip()}\n```")

            return ExecutionResult(
                content="\n".join(content_parts),
                output={
                    "stdout": stdout,
                    "stderr": stderr,
                    "exitCode": exit_code,
                },
                status="complete" if exit_code == 0 else "error",
                error=stderr.strip() if exit_code != 0 else None,
            )

        except asyncio.TimeoutError:
            return ExecutionResult(
                content=f"```{language}\n{code}\n```\n\nExecution timed out (10s limit)",
                output={"stdout": "", "stderr": "Timeout", "exitCode": -1},
                status="error",
                error="Execution timed out (10 second limit)",
            )
        except Exception as e:
            return ExecutionResult(
                content=f"```{language}\n{code}\n```\n\nExecution error: {e}",
                output={},
                status="error",
                error=str(e),
            )

    def validate_input(self, input_data: dict) -> bool:
        return isinstance(input_data.get("code"), str)


NODE_TYPES = {"code": CodeExecutorHandler()}
