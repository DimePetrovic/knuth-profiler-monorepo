import json
from typing import Any

from redis import Redis

from .config import settings
from .models import JobStatusResponse


def redis_client() -> Redis:
    return Redis.from_url(settings.redis_url, decode_responses=True)


def key_meta(job_id: str) -> str:
    return f'cfg:job:{job_id}:meta'


def key_result(job_id: str) -> str:
    return f'cfg:job:{job_id}:result'


def key_logtail(job_id: str) -> str:
    return f'cfg:job:{job_id}:logtail'


def put_json(client: Redis, key: str, value: Any, ttl_seconds: int | None = None) -> None:
    data = json.dumps(value, ensure_ascii=False)
    if ttl_seconds is None:
        client.set(key, data)
    else:
        client.setex(key, ttl_seconds, data)


def get_json(client: Redis, key: str) -> Any | None:
    raw = client.get(key)
    if raw is None:
        return None
    return json.loads(raw)


def init_job_meta(client: Redis, payload: dict) -> None:
    put_json(client, key_meta(payload['jobId']), payload, settings.redis_ttl_seconds)


def get_meta(client: Redis, job_id: str) -> dict | None:
    return get_json(client, key_meta(job_id))


def update_meta(client: Redis, job_id: str, **fields: Any) -> dict | None:
    meta = get_meta(client, job_id)
    if meta is None:
        return None
    meta.update(fields)
    put_json(client, key_meta(job_id), meta, settings.redis_ttl_seconds)
    return meta


def save_result(client: Redis, job_id: str, result: dict) -> None:
    put_json(client, key_result(job_id), result, settings.redis_ttl_seconds)


def get_status(client: Redis, job_id: str) -> JobStatusResponse | None:
    meta = get_json(client, key_meta(job_id))
    if meta is None:
        return None
    return JobStatusResponse(**meta)
