import os
from typing import List

from pydantic import BaseModel


def _parse_cors_allowed_origins(value: str | None) -> List[str]:
    if value is None or not value.strip():
        return ['*']

    parts = [part.strip() for part in value.split(',') if part.strip()]
    return parts or ['*']


class Settings(BaseModel):
    redis_url: str = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
    redis_ttl_seconds: int = int(os.getenv('REDIS_TTL_SECONDS', '3600'))
    queue_name: str = os.getenv('QUEUE_NAME', 'cfg')
    max_source_bytes: int = 200 * 1024
    max_source_lines: int = 5000
    hard_timeout_seconds: int = int(os.getenv('HARD_TIMEOUT_SECONDS', '120'))
    queue_job_timeout_seconds: int = int(os.getenv('QUEUE_JOB_TIMEOUT_SECONDS', '180'))
    warm_joern_url: str = os.getenv('WARM_JOERN_URL', 'http://127.0.0.1:7070')
    cors_allowed_origins: List[str] = _parse_cors_allowed_origins(os.getenv('CORS_ALLOWED_ORIGINS'))


settings = Settings()
