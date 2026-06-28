# Knuth Backend

Async CFG backend for Knuth Profiler.

## Stack
- FastAPI API
- Redis
- RQ worker queue
- Warm Joern wrapper service

## Local Run

1. Install deps:

```bash
pip install -r requirements.txt
```

2. Run Redis locally.

3. Start warm Joern wrapper:

```powershell
./scripts/start_warm_joern.ps1
```

4. Start API:

```powershell
./scripts/start_api.ps1
```

5. Start worker:

```powershell
./scripts/start_worker.ps1
```

API base: http://localhost:8000
Warm wrapper: http://127.0.0.1:7070

## Notes

- If `JOERN_BIN` and `JOERN_SCRIPT` env vars are set, warm wrapper calls real Joern.
- If they are not set, wrapper falls back to mock CFG extraction for local development.
- UTF-8 source encoding is required for upload endpoint.

## Joern Script Template

Template script is provided at:

- `warm_joern/scripts/export_cfg.sc`

When using real Joern, set:

- `JOERN_BIN` to the Joern executable path
- `JOERN_SCRIPT` to `warm_joern/scripts/export_cfg.sc` (or your adapted script)

## Backend Tests

Run tests:

```bash
pytest
```
