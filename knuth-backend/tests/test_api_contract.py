import fakeredis
from fastapi.testclient import TestClient

from app.main import app


class FakeQueue:
    def __init__(self) -> None:
        self.calls = []

    def enqueue(self, func, payload, job_timeout='20s'):
        self.calls.append((func, payload, job_timeout))
        return object()


def test_create_job_and_pending_result(monkeypatch):
    fake_redis = fakeredis.FakeRedis(decode_responses=True)
    fake_queue = FakeQueue()

    monkeypatch.setattr('app.main.redis_client', lambda: fake_redis)
    monkeypatch.setattr('app.main.get_queue', lambda: fake_queue)

    client = TestClient(app)
    res = client.post('/cfg/jobs', json={'language': 'c', 'filename': 'main.c', 'source': 'int main(){return 0;}'} )

    assert res.status_code == 202
    job_id = res.json()['jobId']

    status = client.get(f'/cfg/jobs/{job_id}')
    assert status.status_code == 200
    body = status.json()
    assert body['status'] == 'queued'
    assert body['stage'] == 'queued'

    result = client.get(f'/cfg/jobs/{job_id}/result')
    assert result.status_code == 202
    assert result.text == ''


def test_upload_requires_utf8(monkeypatch):
    fake_redis = fakeredis.FakeRedis(decode_responses=True)
    fake_queue = FakeQueue()

    monkeypatch.setattr('app.main.redis_client', lambda: fake_redis)
    monkeypatch.setattr('app.main.get_queue', lambda: fake_queue)

    client = TestClient(app)
    res = client.post(
        '/cfg/jobs/upload',
        data={'language': 'python'},
        files={'file': ('x.py', b'\xff\xfe\x00', 'application/octet-stream')},
    )

    assert res.status_code == 400
    assert 'UTF-8' in res.text
