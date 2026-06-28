import os

from .config import settings


def sanitize_filename(value: str) -> str:
    value = (value or '').strip().replace('\\', '/')
    if not value:
        return 'source.txt'
    if '..' in value or value.startswith('/'):
        return 'source.txt'
    base = os.path.basename(value)
    return base or 'source.txt'


def validate_source_limits(source: str) -> None:
    if not source or not source.strip():
        raise ValueError('Source must be non-empty.')
    source_bytes = len(source.encode('utf-8'))
    if source_bytes > settings.max_source_bytes:
        raise ValueError(f'Source exceeds max size ({settings.max_source_bytes} bytes).')
    lines = source.count('\n') + 1
    if lines > settings.max_source_lines:
        raise ValueError(f'Source exceeds max lines ({settings.max_source_lines}).')
