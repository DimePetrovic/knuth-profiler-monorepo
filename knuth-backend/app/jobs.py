import hashlib
import os
import shutil
import tempfile
from pathlib import Path

from app.config import settings
from app.errors import JobProcessingError, WarmJoernError, WarmJoernTimeoutError
from app.models import CfgErrorPayload, CfgJobPayload, WarmAnalyzeRequest, now_iso
from app.redis_store import get_meta, key_logtail, redis_client, save_result, update_meta
from app.services.cfg_extract import dot_to_cfg, normalize_cfg
from app.services.joern_client import WarmJoernClient


def enqueue_payload_dict(payload: CfgJobPayload) -> dict:
    return {
        'job_id': payload.job_id,
        'language': payload.language,
        'filename': payload.filename,
        'source': payload.source,
        'created_at': payload.created_at,
        'source_hash': payload.source_hash,
    }


def generate_cfg_job(payload_dict: dict) -> None:
    payload = CfgJobPayload(**payload_dict)
    redis = redis_client()
    temp_dir = tempfile.mkdtemp(prefix=f'cfg-{payload.job_id}-')

    try:
        update_meta(redis, payload.job_id, status='running', stage='writing-source', startedAt=now_iso())

        source_path = Path(temp_dir) / payload.filename
        source_path.write_text(payload.source, encoding='utf-8')

        update_meta(redis, payload.job_id, stage='joern')
        warm_client = WarmJoernClient()
        warm_response = warm_client.analyze(
            WarmAnalyzeRequest(
                jobId=payload.job_id,
                language=payload.language,
                path=str(source_path),
                filename=payload.filename,
                source=payload.source,
            )
        )

        update_meta(redis, payload.job_id, stage='extract')
        if warm_response.cfgJson is not None:
            graph = warm_response.cfgJson
        elif warm_response.cfgDot is not None:
            graph = dot_to_cfg(warm_response.cfgDot)
        else:
            raise RuntimeError('Warm Joern response did not contain cfgJson or cfgDot.')

        update_meta(redis, payload.job_id, stage='normalize')
        graph = normalize_cfg(graph)

        result_payload = {
            'version': 'cfg-json-1',
            'language': payload.language,
            'filename': payload.filename,
            'sourceHash': payload.source_hash,
            'graph': graph,
        }

        save_result(redis, payload.job_id, result_payload)
        update_meta(
            redis,
            payload.job_id,
            status='completed',
            stage='done',
            finishedAt=now_iso(),
            error=None,
        )
    except JobProcessingError as exc:
        message = str(exc)
        code = exc.code
        stderr_tail = exc.stderr_tail

        error_payload = CfgErrorPayload(
            jobId=payload.job_id,
            code=code,
            message=message,
            stage=(get_meta(redis, payload.job_id) or {}).get('stage', 'joern'),
            details={'stderrTail': stderr_tail, 'hint': 'Check warm Joern service and source syntax.'},
        ).model_dump()

        save_result(redis, payload.job_id, error_payload)
        update_meta(
            redis,
            payload.job_id,
            status='failed',
            finishedAt=now_iso(),
            error=error_payload,
        )
        redis.setex(key_logtail(payload.job_id), settings.redis_ttl_seconds, stderr_tail)
    except Exception as exc:  # pragma: no cover - runtime safeguard
        message = str(exc)
        code = 'INTERNAL_ERROR'
        stderr_tail = ''

        error_payload = CfgErrorPayload(
            jobId=payload.job_id,
            code=code,
            message=message,
            stage=(get_meta(redis, payload.job_id) or {}).get('stage', 'joern'),
            details={'stderrTail': stderr_tail, 'hint': 'Check warm Joern service and source syntax.'},
        ).model_dump()

        save_result(redis, payload.job_id, error_payload)
        update_meta(
            redis,
            payload.job_id,
            status='failed',
            finishedAt=now_iso(),
            error=error_payload,
        )
        redis.setex(key_logtail(payload.job_id), settings.redis_ttl_seconds, stderr_tail)
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def hash_source(source: str) -> str:
    digest = hashlib.sha256(source.encode('utf-8')).hexdigest()
    return f'sha256:{digest}'
