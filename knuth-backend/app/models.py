from dataclasses import dataclass
from datetime import datetime
from typing import Literal, get_args

from pydantic import BaseModel, Field

Language = Literal['c', 'cpp', 'java', 'python', 'javascript']
ALLOWED_LANGUAGES = set(get_args(Language))
JobStatus = Literal['queued', 'running', 'completed', 'failed']
JobStage = Literal['queued', 'writing-source', 'joern', 'extract', 'normalize', 'done']


class CreateJobRequest(BaseModel):
    language: Language
    filename: str = Field(default='source.txt', min_length=1, max_length=200)
    source: str = Field(min_length=1)


class CreateJobResponse(BaseModel):
    jobId: str


class JobStatusResponse(BaseModel):
    jobId: str
    status: JobStatus
    stage: JobStage
    createdAt: str
    startedAt: str | None = None
    finishedAt: str | None = None
    error: dict | None = None


class CfgErrorPayload(BaseModel):
    version: Literal['cfg-error-1'] = 'cfg-error-1'
    jobId: str
    code: Literal[
        'JOERN_FAILED',
        'UNSUPPORTED_LANGUAGE',
        'SYNTAX_ERROR',
        'TIMEOUT',
        'INTERNAL_ERROR',
        'VALIDATION_ERROR',
    ]
    message: str
    stage: str
    details: dict = Field(default_factory=dict)


@dataclass
class CfgJobPayload:
    job_id: str
    language: Language
    filename: str
    source: str
    created_at: str
    source_hash: str


class WarmAnalyzeRequest(BaseModel):
    jobId: str
    language: Language
    path: str
    filename: str
    source: str


class WarmAnalyzeResponse(BaseModel):
    cfgJson: dict | None = None
    cfgDot: str | None = None


def now_iso() -> str:
    return datetime.utcnow().isoformat() + 'Z'
