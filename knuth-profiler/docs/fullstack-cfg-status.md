# Knuth Profiler + CFG Backend: Implemented State (April 2026)

## 1. Scope
This document summarizes what has been implemented so far across:
- frontend (`knuth-profiler`)
- backend (`knuth-backend`)
- warm Joern integration

It also captures architecture decisions, current behavior, and known limitations.

## 2. Current High-Level Architecture

### Frontend (Angular 19)
Layered architecture:
- Core graph domain utilities: graph analysis, constants, shared types
- Feature state/services:
  - graph visualization state
  - simulation state
  - reconstruction state
- Facade orchestration:
  - `ExamplesWorkflowFacade` as a single workflow API for pages
- UI pages/components:
  - examples page
  - CFG import page
  - shared graph canvas

### Backend (FastAPI + Redis + RQ)
Async job architecture:
- API accepts source/upload and returns `jobId`
- Redis stores job meta and final result/error payload
- RQ worker executes CFG generation pipeline
- warm Joern service performs source analysis and returns CFG DOT/JSON

### Data Contract
- Success result: `cfg-json-1`
- Error result: `cfg-error-1`

## 3. Frontend: Implemented Functionality

### 3.1 Examples workflow (existing + stabilized)
- Full step workflow (0 -> 5):
  0. start
  1. weights
  2. MST
  3. instrumentation
  4. simulation
  5. reconstruction
- Simulation controls:
  - runs
  - speed
  - start/pause/resume/stop/reset
- Reconstruction controls:
  - compute next edge
  - prev/next explanation step
  - reset

### 3.2 CFG Import page (new integration)
- Source submit + file upload
- Polling for job status/result
- Rendering imported CFG in existing graph canvas
- Reuse of existing workflow controls directly on imported graph

### 3.3 CFG-to-Graph adapter behavior
Implemented adapter features:
- maps backend graph nodes/edges to frontend `GraphData`
- enforces single canonical endpoint nodes:
  - one `ENTRY`
  - one `EXIT`
- adds sentinel path endpoints:
  - entry sentinel edge: `__entry_sentinel__` (`ghost_in -> ENTRY`)
  - exit sentinel edge: `__exit_sentinel__` (`EXIT -> ghost_out`)
- chooses canonical exit by preferring `METHOD_RETURN` when available
- node label trimming rule:
  - keep only content after first comma
  - example: `addition, 14 a + b` -> `14 a + b`
- imported edge IDs are compact (`e0`, `e1`, ...), no `cfg_` prefix

### 3.4 Reconstruction UX improvements
- Clicking "Izracunaj sledecu granu" now attempts practical progression:
  - if there are no simulation counters, a fast simulation seed run is triggered
  - then reconstruction step is attempted
- If step cannot be computed, explicit diagnostic message is shown in UI
- Reconstruction explanation text now uses visible node labels (not internal numeric IDs)

## 4. Backend: Implemented Functionality

### 4.1 API endpoints
- `POST /cfg/jobs`
- `POST /cfg/jobs/upload`
- `GET /cfg/jobs/{jobId}`
- `GET /cfg/jobs/{jobId}/result`

Behavior:
- pending result -> HTTP 202 (empty)
- completed result -> `cfg-json-1`
- failed result -> `cfg-error-1`

### 4.2 Worker pipeline stages
- writing-source
- joern
- extract
- normalize
- done

Error mapping includes:
- `JOERN_FAILED`
- `TIMEOUT`
- `INTERNAL_ERROR`
- `VALIDATION_ERROR`

### 4.3 warm Joern integration
Implemented fixes for real Joern execution:
- script argument passing aligned with current Joern CLI (`--param key=value`)
- source sharing fixed for containerized setup (inline source fallback)
- DOT extraction made robust against noisy Joern stdout logs
  - marker-based extraction
  - fallback DOT regex extraction

### 4.4 DOT parsing improvements
Parser now handles Joern-style HTML labels:
- label extraction from `<...>` style attributes
- HTML entity decoding
- `<BR/>` cleanup
- better entry/exit inference (`METHOD`, `METHOD_RETURN`)

## 5. Docker/Runtime Setup

### 5.1 Compose services
- `redis`
- `warm_joern`
- `api`
- `worker`

### 5.2 Joern containerization
- dedicated warm Joern Docker image
- Joern CLI installed in container
- env-driven config for Joern binary/script and timeouts

### 5.3 Timeout tuning
Timeout chain was expanded to avoid premature failures:
- HTTP timeout to warm Joern
- subprocess timeout in warm Joern
- RQ job timeout

## 6. Key Bugs Fixed During Integration

### Frontend bugs
- EXIT traversal deadlock in animation
- counters not updating due to mutable object reference
- imported graph endpoint mapping issues (multiple exits, wrong entry target)
- reconstruction explanation showing internal node IDs instead of labels

### Backend bugs
- warm Joern returned path-not-found across containers
- Joern CLI argument mismatch for current version
- Joern output treated as DOT despite containing logs
- parser unable to read Joern HTML-like labels

## 7. Testing Status

### Frontend
- Angular tests passing (latest run): 70 SUCCESS
- Added tests for:
  - workflow integration behavior
  - CFG import polling scenario
  - adapter endpoint mapping
  - label trimming and edge ID compactness

### Backend
- Pytest suite passing in local backend environment
- Added tests for:
  - API contract behavior
  - worker pipeline
  - DOT extraction and normalization
  - warm Joern output extraction behavior

## 8. Current Known Limitations

1. CFG reconstruction step solvability still depends on available known counters and graph structure. In some graphs, not every click can produce an immediate next solved edge.
2. warm Joern runtime can still be heavy for larger inputs depending on host resources.
3. UI is functionally integrated, but can still be improved for very large imported graphs (navigation, clarity, filtering).

## 9. Suggested Next Steps

1. Add optional "why not solvable" details per node/edge in reconstruction panel.
2. Add graph filtering controls (hide sentinel edges, show only decision paths, collapse linear chains).
3. Add end-to-end smoke script that submits source and verifies result schema automatically.
4. Add production profile for Docker compose (resource limits, health retries, logging strategy).

## 10. Repository Pointers

Frontend references:
- `src/app/pages/cfg-import-page/`
- `src/app/features/cfg-import/`
- `src/app/features/examples/`

Backend references:
- `knuth-backend/app/`
- `knuth-backend/warm_joern/`
- `knuth-backend/tests/`
