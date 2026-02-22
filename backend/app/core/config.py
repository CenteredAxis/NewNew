from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Base URL of the upstream OpenAI-compatible endpoint.
    # The frontend sends this in the X-Endpoint-Url header per request,
    # so this env var is the server-level fallback / default.
    llm_endpoint_url: str = "http://localhost:11434"

    # Optional API key forwarded to the upstream endpoint.
    llm_api_key: str = ""

    # Directory (relative to repo root) where backend modules live.
    modules_dir: str = "backend/modules"


settings = Settings()
