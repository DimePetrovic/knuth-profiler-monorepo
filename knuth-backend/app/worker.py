from redis import Redis
from rq import Worker

from app.config import settings


def main() -> None:
    redis = Redis.from_url(settings.redis_url)
    worker = Worker([settings.queue_name], connection=redis)
    worker.work()


if __name__ == '__main__':
    main()
