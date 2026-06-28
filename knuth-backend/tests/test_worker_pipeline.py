import fakeredis

from app.jobs import CfgJobPayload, enqueue_payload_dict, generate_cfg_job
from app.redis_store import get_json, init_job_meta, key_meta, key_result


class FakeWarmClient:
    def analyze(self, request):
        return type('Resp', (), {
            'cfgJson': {
                'entryNodeId': 'n0',
                'exitNodeId': 'n1',
                'nodes': [
                    {'id': 'n0', 'kind': 'entry', 'label': 'ENTRY', 'range': None},
                    {'id': 'n1', 'kind': 'exit', 'label': 'EXIT', 'range': None},
                ],
                'edges': [{'from': 'n0', 'to': 'n1', 'kind': 'next', 'label': ''}],
            },
            'cfgDot': None,
        })()


def test_worker_stores_result_and_updates_meta(monkeypatch):
    fake_redis = fakeredis.FakeRedis(decode_responses=True)

    monkeypatch.setattr('app.jobs.redis_client', lambda: fake_redis)
    monkeypatch.setattr('app.jobs.WarmJoernClient', lambda: FakeWarmClient())

    payload = CfgJobPayload(
        job_id='job-1',
        language='c',
        filename='main.c',
        source='int main(){return 0;}',
        created_at='2026-04-01T00:00:00.000Z',
        source_hash='sha256:abc',
    )

    init_job_meta(
        fake_redis,
        {
            'jobId': payload.job_id,
            'status': 'queued',
            'stage': 'queued',
            'createdAt': payload.created_at,
            'startedAt': None,
            'finishedAt': None,
            'error': None,
            'language': payload.language,
            'filename': payload.filename,
            'sourceHash': payload.source_hash,
        },
    )

    generate_cfg_job(enqueue_payload_dict(payload))

    meta = get_json(fake_redis, key_meta(payload.job_id))
    result = get_json(fake_redis, key_result(payload.job_id))

    assert meta is not None
    assert meta['status'] == 'completed'
    assert meta['stage'] == 'done'
    assert result is not None
    assert result['version'] == 'cfg-json-1'
    assert fake_redis.ttl(key_meta(payload.job_id)) > 0
    assert fake_redis.ttl(key_result(payload.job_id)) > 0


def test_worker_sends_source_to_warm_client(monkeypatch):
    fake_redis = fakeredis.FakeRedis(decode_responses=True)
    captured = {}

    class CapturingWarmClient:
        def analyze(self, request):
            captured['request'] = request
            return type('Resp', (), {
                'cfgJson': {
                    'entryNodeId': 'n0',
                    'exitNodeId': 'n1',
                    'nodes': [
                        {'id': 'n0', 'kind': 'entry', 'label': 'ENTRY', 'range': None},
                        {'id': 'n1', 'kind': 'exit', 'label': 'EXIT', 'range': None},
                    ],
                    'edges': [{'from': 'n0', 'to': 'n1', 'kind': 'next', 'label': ''}],
                },
                'cfgDot': None,
            })()

    monkeypatch.setattr('app.jobs.redis_client', lambda: fake_redis)
    monkeypatch.setattr('app.jobs.WarmJoernClient', lambda: CapturingWarmClient())

    payload = CfgJobPayload(
        job_id='job-2',
        language='python',
        filename='main.py',
        source='print(1)',
        created_at='2026-04-01T00:00:00.000Z',
        source_hash='sha256:def',
    )

    init_job_meta(
        fake_redis,
        {
            'jobId': payload.job_id,
            'status': 'queued',
            'stage': 'queued',
            'createdAt': payload.created_at,
            'startedAt': None,
            'finishedAt': None,
            'error': None,
            'language': payload.language,
            'filename': payload.filename,
            'sourceHash': payload.source_hash,
        },
    )

    generate_cfg_job(enqueue_payload_dict(payload))

    request = captured['request']
    assert request.filename == payload.filename
    assert request.language == payload.language
    assert request.source == payload.source
