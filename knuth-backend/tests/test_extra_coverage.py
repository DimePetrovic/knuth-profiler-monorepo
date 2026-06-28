"""
Tests that fill coverage gaps in:
  worker.py (0%), joern_client.py (40%), validation.py (74%),
  queueing.py (75%), redis_store.py (85%), main.py (77%), jobs.py (92%)
"""

import json
from unittest.mock import MagicMock, patch

import fakeredis
import pytest
from fastapi.testclient import TestClient

from app.errors import CfgParsingError, WarmJoernAnalyzeError, WarmJoernTimeoutError
from app.jobs import CfgJobPayload, enqueue_payload_dict, generate_cfg_job
from app.main import app
from app.models import WarmAnalyzeRequest
from app.redis_store import (
    get_json,
    get_status,
    init_job_meta,
    key_logtail,
    key_meta,
    key_result,
    put_json,
    save_result,
    update_meta,
)
from app.services.joern_client import WarmJoernClient
from app.services.cfg_extract import dot_to_cfg
from app.validation import sanitize_filename, validate_source_limits


# ─────────────────────────── worker.py (0 → ~100%) ───────────────────────────

class TestWorkerMain:
    def test_main_creates_worker_and_calls_work(self):
        with (
            patch('app.worker.Redis') as MockRedis,
            patch('app.worker.Worker') as MockWorker,
        ):
            MockRedis.from_url.return_value = MagicMock()
            mock_worker_inst = MagicMock()
            MockWorker.return_value = mock_worker_inst

            from app.worker import main
            main()

            MockRedis.from_url.assert_called_once()
            MockWorker.assert_called_once()
            mock_worker_inst.work.assert_called_once()


# ─────────────────────── joern_client.py (40% → ~95%) ───────────────────────

def _mock_httpx_client(*, is_error: bool, status_code: int = 200, body=None, text: str = ''):
    """Return a mock that replaces httpx.Client context manager."""
    mock_resp = MagicMock()
    mock_resp.is_error = is_error
    mock_resp.status_code = status_code
    mock_resp.text = text
    if body is not None:
        mock_resp.json.return_value = body
    mock_ctx = MagicMock()
    mock_ctx.__enter__ = MagicMock(return_value=mock_ctx)
    mock_ctx.__exit__ = MagicMock(return_value=False)
    mock_ctx.post.return_value = mock_resp
    return mock_ctx


class TestWarmJoernClient:
    def test_default_base_url_from_settings(self):
        client = WarmJoernClient()
        assert client.base_url  # non-empty

    def test_custom_base_url_strips_trailing_slash(self):
        client = WarmJoernClient(base_url='http://localhost:9000/')
        assert client.base_url == 'http://localhost:9000'

    def test_custom_timeout_is_stored(self):
        client = WarmJoernClient(timeout_seconds=99)
        assert client.timeout_seconds == 99

    def test_analyze_success_returns_response_object(self):
        mock_ctx = _mock_httpx_client(
            is_error=False,
            body={
                'cfgJson': {'entryNodeId': 'n0', 'exitNodeId': 'n1', 'nodes': [], 'edges': []},
                'cfgDot': None,
                'logs': '',
                'elapsed': 0.0,
            },
        )
        with patch('httpx.Client', return_value=mock_ctx):
            client = WarmJoernClient(base_url='http://test')
            req = WarmAnalyzeRequest(
                jobId='j1', language='c', path='/tmp/x.c', filename='x.c', source='int x;'
            )
            result = client.analyze(req)
            assert result.cfgJson is not None

    def test_analyze_http_error_raises_with_status_code(self):
        mock_ctx = _mock_httpx_client(is_error=True, status_code=500, text='internal error')
        with patch('httpx.Client', return_value=mock_ctx):
            client = WarmJoernClient(base_url='http://test')
            req = WarmAnalyzeRequest(
                jobId='j2', language='c', path='/tmp/x.c', filename='x.c', source='int x;'
            )
            with pytest.raises(WarmJoernAnalyzeError, match='500'):
                client.analyze(req)

    def test_analyze_error_with_empty_body_mentions_empty_response(self):
        mock_ctx = _mock_httpx_client(is_error=True, status_code=503, text='   ')
        with patch('httpx.Client', return_value=mock_ctx):
            client = WarmJoernClient(base_url='http://test')
            req = WarmAnalyzeRequest(
                jobId='j3', language='c', path='/tmp/x.c', filename='x.c', source='int x;'
            )
            with pytest.raises(WarmJoernAnalyzeError, match='empty response body'):
                client.analyze(req)

    def test_analyze_timeout_raises_typed_timeout_error(self):
        mock_ctx = MagicMock()
        mock_ctx.__enter__ = MagicMock(return_value=mock_ctx)
        mock_ctx.__exit__ = MagicMock(return_value=False)
        mock_ctx.post.side_effect = Exception('not used')
        with patch('httpx.Client', side_effect=__import__('httpx').TimeoutException('timeout')):
            client = WarmJoernClient(base_url='http://test')
            req = WarmAnalyzeRequest(
                jobId='j4', language='c', path='/tmp/x.c', filename='x.c', source='int x;'
            )
            with pytest.raises(WarmJoernTimeoutError):
                client.analyze(req)


# ─────────────────────── validation.py (74% → ~100%) ─────────────────────────

class TestSanitizeFilename:
    def test_empty_string_returns_default(self):
        assert sanitize_filename('') == 'source.txt'

    def test_whitespace_only_returns_default(self):
        assert sanitize_filename('   ') == 'source.txt'

    def test_path_traversal_returns_default(self):
        assert sanitize_filename('../etc/passwd') == 'source.txt'

    def test_absolute_path_returns_default(self):
        assert sanitize_filename('/etc/passwd') == 'source.txt'

    def test_backslash_path_normalized_to_basename(self):
        assert sanitize_filename('path\\to\\main.c') == 'main.c'

    def test_normal_filename_passes_through(self):
        assert sanitize_filename('main.c') == 'main.c'


class TestValidateSourceLimits:
    def test_empty_string_raises(self):
        with pytest.raises(ValueError, match='non-empty'):
            validate_source_limits('')

    def test_whitespace_only_raises(self):
        with pytest.raises(ValueError, match='non-empty'):
            validate_source_limits('   \n  ')

    def test_oversized_bytes_raises(self, monkeypatch):
        from app import validation
        monkeypatch.setattr(validation.settings, 'max_source_bytes', 10)
        with pytest.raises(ValueError, match='max size'):
            validate_source_limits('x' * 100)

    def test_too_many_lines_raises(self, monkeypatch):
        from app import validation
        monkeypatch.setattr(validation.settings, 'max_source_lines', 2)
        with pytest.raises(ValueError, match='max lines'):
            validate_source_limits('a\nb\nc')

    def test_valid_source_passes(self):
        validate_source_limits('int main() { return 0; }')  # must not raise


class TestCfgExtractErrors:
    def test_empty_dot_raises_cfg_parsing_error(self):
        with pytest.raises(CfgParsingError, match='empty'):
            dot_to_cfg('   ')


# ─────────────────────── queueing.py (75% → ~100%) ──────────────────────────

class TestQueueing:
    def test_get_redis_delegates_to_redis_client(self, monkeypatch):
        mock_redis = MagicMock()
        monkeypatch.setattr('app.queueing.redis_client', lambda: mock_redis)
        from app import queueing
        assert queueing.get_redis() is mock_redis

    def test_get_queue_creates_rq_queue(self, monkeypatch):
        mock_redis = MagicMock()
        monkeypatch.setattr('app.queueing.redis_client', lambda: mock_redis)
        with patch('app.queueing.Queue') as MockQueue:
            MockQueue.return_value = MagicMock()
            from app import queueing
            queueing.get_queue()
            MockQueue.assert_called_once()


# ─────────────────────── redis_store.py (85% → ~100%) ────────────────────────

class TestRedisStore:
    def test_key_logtail_pattern(self):
        assert key_logtail('abc') == 'cfg:job:abc:logtail'

    def test_put_json_without_ttl_has_no_expiry(self):
        r = fakeredis.FakeRedis(decode_responses=True)
        put_json(r, 'k', {'x': 1})
        assert json.loads(r.get('k')) == {'x': 1}
        assert r.ttl('k') == -1  # persistent

    def test_put_json_with_ttl_sets_expiry(self):
        r = fakeredis.FakeRedis(decode_responses=True)
        put_json(r, 'k', {'x': 1}, ttl_seconds=300)
        assert r.ttl('k') > 0

    def test_get_json_returns_none_for_missing_key(self):
        r = fakeredis.FakeRedis(decode_responses=True)
        assert get_json(r, 'no-such-key') is None

    def test_update_meta_returns_none_for_unknown_job(self):
        r = fakeredis.FakeRedis(decode_responses=True)
        assert update_meta(r, 'ghost-job', status='running') is None

    def test_get_status_returns_none_for_unknown_job(self):
        r = fakeredis.FakeRedis(decode_responses=True)
        assert get_status(r, 'ghost-job') is None


# ─────────────────────── main.py (77% → ~95%) ────────────────────────────────

class _FakeQueue:
    def __init__(self):
        self.calls = []

    def enqueue(self, func, payload, job_timeout='20s'):
        self.calls.append((func, payload))
        return object()


def _patched_client(monkeypatch):
    fake_redis = fakeredis.FakeRedis(decode_responses=True)
    fake_queue = _FakeQueue()
    monkeypatch.setattr('app.main.redis_client', lambda: fake_redis)
    monkeypatch.setattr('app.main.get_queue', lambda: fake_queue)
    return TestClient(app), fake_redis


def _queued_meta(job_id: str, *, status: str = 'queued', stage: str = 'queued') -> dict:
    return {
        'jobId': job_id,
        'status': status,
        'stage': stage,
        'createdAt': '2026-01-01T00:00:00Z',
        'startedAt': None,
        'finishedAt': None,
        'error': None,
        'language': 'c',
        'filename': 'x.c',
        'sourceHash': 'sha256:aaa',
    }


class TestMainEndpoints:
    def test_upload_with_unsupported_language_returns_400(self, monkeypatch):
        client, _ = _patched_client(monkeypatch)
        res = client.post(
            '/cfg/jobs/upload',
            data={'language': 'cobol'},
            files={'file': ('test.cbl', b'IDENTIFICATION DIVISION.', 'text/plain')},
        )
        assert res.status_code == 400
        assert 'Unsupported language' in res.text

    def test_get_job_status_returns_404_for_unknown_job(self, monkeypatch):
        client, _ = _patched_client(monkeypatch)
        assert client.get('/cfg/jobs/no-such-id').status_code == 404

    def test_get_job_result_returns_404_for_unknown_job(self, monkeypatch):
        client, _ = _patched_client(monkeypatch)
        assert client.get('/cfg/jobs/no-such-id/result').status_code == 404

    def test_get_job_result_returns_202_while_running(self, monkeypatch):
        fake_redis = fakeredis.FakeRedis(decode_responses=True)
        monkeypatch.setattr('app.main.redis_client', lambda: fake_redis)
        init_job_meta(fake_redis, _queued_meta('job-run', status='running', stage='joern'))
        res = TestClient(app).get('/cfg/jobs/job-run/result')
        assert res.status_code == 202
        assert res.text == ''

    def test_get_job_result_returns_error_payload_for_failed_with_missing_result(self, monkeypatch):
        fake_redis = fakeredis.FakeRedis(decode_responses=True)
        monkeypatch.setattr('app.main.redis_client', lambda: fake_redis)
        init_job_meta(fake_redis, _queued_meta('job-fail', status='failed', stage='joern'))
        body = TestClient(app).get('/cfg/jobs/job-fail/result').json()
        assert body['code'] == 'INTERNAL_ERROR'
        assert body['jobId'] == 'job-fail'

    def test_get_job_result_returns_completed_result_payload(self, monkeypatch):
        fake_redis = fakeredis.FakeRedis(decode_responses=True)
        monkeypatch.setattr('app.main.redis_client', lambda: fake_redis)
        init_job_meta(fake_redis, _queued_meta('job-ok', status='completed', stage='done'))
        save_result(fake_redis, 'job-ok', {'version': 'cfg-json-1', 'graph': {}})
        res = TestClient(app).get('/cfg/jobs/job-ok/result')
        assert res.status_code == 200
        assert res.json()['version'] == 'cfg-json-1'

    def test_create_job_with_empty_source_returns_400(self, monkeypatch):
        client, _ = _patched_client(monkeypatch)
        res = client.post('/cfg/jobs', json={'language': 'c', 'filename': 'x.c', 'source': '   '})
        assert res.status_code == 400


# ─────────────────────── jobs.py (92% → ~100%) ───────────────────────────────

def _job_fixture(job_id: str) -> CfgJobPayload:
    return CfgJobPayload(
        job_id=job_id,
        language='c',
        filename='x.c',
        source='int x;',
        created_at='2026-01-01T00:00:00Z',
        source_hash='sha256:x',
    )


def _init(redis, job_id: str) -> None:
    init_job_meta(redis, {
        'jobId': job_id, 'status': 'queued', 'stage': 'queued',
        'createdAt': '2026-01-01T00:00:00Z', 'startedAt': None,
        'finishedAt': None, 'error': None,
        'language': 'c', 'filename': 'x.c', 'sourceHash': 'sha256:x',
    })


class TestJobsBranches:
    def test_uses_cfg_dot_path_when_cfg_json_is_none(self, monkeypatch):
        """Covers lines 52-53: cfgDot branch in generate_cfg_job."""
        fake_redis = fakeredis.FakeRedis(decode_responses=True)
        monkeypatch.setattr('app.jobs.redis_client', lambda: fake_redis)

        dot_src = 'digraph {\n  "n0" [label="ENTRY"];\n  "n1" [label="EXIT"];\n  "n0" -> "n1";\n}'

        class DotClient:
            def analyze(self, req):
                return type('R', (), {'cfgJson': None, 'cfgDot': dot_src})()

        monkeypatch.setattr('app.jobs.WarmJoernClient', lambda: DotClient())

        payload = _job_fixture('j-dot')
        _init(fake_redis, payload.job_id)
        generate_cfg_job(enqueue_payload_dict(payload))

        assert get_json(fake_redis, key_meta('j-dot'))['status'] == 'completed'

    def test_marks_job_failed_when_neither_cfg_json_nor_cfg_dot(self, monkeypatch):
        """Covers lines 54-55: RuntimeError raised when response carries no graph."""
        fake_redis = fakeredis.FakeRedis(decode_responses=True)
        monkeypatch.setattr('app.jobs.redis_client', lambda: fake_redis)

        class EmptyClient:
            def analyze(self, req):
                return type('R', (), {'cfgJson': None, 'cfgDot': None})()

        monkeypatch.setattr('app.jobs.WarmJoernClient', lambda: EmptyClient())

        payload = _job_fixture('j-empty')
        _init(fake_redis, payload.job_id)
        generate_cfg_job(enqueue_payload_dict(payload))

        # Exception is caught; job must be marked failed with an error result
        meta = get_json(fake_redis, key_meta('j-empty'))
        assert meta['status'] == 'failed'
        result = get_json(fake_redis, key_result('j-empty'))
        assert result is not None
        assert result['code'] in ('INTERNAL_ERROR', 'JOERN_FAILED', 'TIMEOUT')
