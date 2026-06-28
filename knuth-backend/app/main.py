import uuid

from fastapi import FastAPI, File, Form, HTTPException, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.jobs import enqueue_payload_dict, generate_cfg_job, hash_source
from app.config import settings
from app.models import (
    ALLOWED_LANGUAGES,
    CfgErrorPayload,
    CfgJobPayload,
    CreateJobRequest,
    CreateJobResponse,
    JobStatusResponse,
    now_iso,
)
from app.queueing import get_queue
from app.redis_store import get_json, get_status, init_job_meta, key_result, redis_client
from app.validation import sanitize_filename, validate_source_limits

app = FastAPI(title='Knuth CFG Backend', version='1.0.0')

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_methods=['*'],
    allow_headers=['*'],
    allow_credentials=False,
)


def _enqueue_job(language: str, filename: str, source: str) -> CreateJobResponse:
    validate_source_limits(source)

    job_id = str(uuid.uuid4())
    safe_filename = sanitize_filename(filename)
    payload = CfgJobPayload(
        job_id=job_id,
        language=language,  # validated by request model / endpoint
        filename=safe_filename,
        source=source,
        created_at=now_iso(),
        source_hash=hash_source(source),
    )

    redis = redis_client()
    init_job_meta(
        redis,
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

    queue = get_queue()
    queue.enqueue(
        generate_cfg_job,
        enqueue_payload_dict(payload),
        job_timeout=f'{settings.queue_job_timeout_seconds}s',
    )
    return CreateJobResponse(jobId=job_id)


@app.post('/cfg/jobs', response_model=CreateJobResponse, status_code=202)
def create_cfg_job(request: CreateJobRequest) -> CreateJobResponse:
    try:
        return _enqueue_job(request.language, request.filename, request.source)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post('/cfg/jobs/upload', response_model=CreateJobResponse, status_code=202)
async def create_cfg_job_upload(language: str = Form(...), file: UploadFile = File(...)) -> CreateJobResponse:
    try:
        if language not in ALLOWED_LANGUAGES:
            raise HTTPException(status_code=400, detail='Unsupported language.')
        body = await file.read()
        try:
            source = body.decode('utf-8')
        except UnicodeDecodeError as exc:
            raise HTTPException(
                status_code=400,
                detail='File must be UTF-8 encoded source text.',
            ) from exc
        return _enqueue_job(language, file.filename or 'uploaded.txt', source)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get('/cfg/jobs/{job_id}', response_model=JobStatusResponse)
def get_cfg_job_status(job_id: str) -> JobStatusResponse:
    status = get_status(redis_client(), job_id)
    if status is None:
        raise HTTPException(status_code=404, detail='Job not found.')
    return status


@app.get('/cfg/jobs/{job_id}/result')
def get_cfg_job_result(job_id: str):
    redis = redis_client()
    status = get_status(redis, job_id)
    if status is None:
        raise HTTPException(status_code=404, detail='Job not found.')

    if status.status in ('queued', 'running'):
        return Response(status_code=202)

    result = get_json(redis, key_result(job_id))
    if result is None:
        if status.status == 'failed':
            error = CfgErrorPayload(
                jobId=job_id,
                code='INTERNAL_ERROR',
                message='Job failed but result payload is missing.',
                stage=status.stage,
                details={'hint': 'Check worker logs.'},
            ).model_dump()
            return error
        return Response(status_code=202)

    return result
