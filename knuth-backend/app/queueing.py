from redis import Redis
from rq import Queue

from .config import settings
from .redis_store import redis_client


def get_redis() -> Redis:
    return redis_client()


def get_queue() -> Queue:
    return Queue(settings.queue_name, connection=get_redis(), default_timeout=settings.hard_timeout_seconds)
