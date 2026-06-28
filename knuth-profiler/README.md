# Knuth Profiler

Interactive Angular application for visualizing a Knuth-style profiling workflow on directed graphs:

- choose an example control-flow graph
- compute max-weight spanning tree (MST)
- derive instrumentation set (non-tree edges)
- run simulation to collect counters
- reconstruct missing edge counts from balance equations

## Stack

- Angular 19 (standalone components + signals)
- Cytoscape.js (+ dagre and ELK layouts)
- Tailwind CSS v4
- Karma + Jasmine for unit tests

## Run Locally

Install dependencies:

```bash
npm install
```

Start development server:

```bash
npm start
```

Open:

```text
http://localhost:4200/
```

Build production bundle:

```bash
npm run build
```

Run tests:

```bash
npm test -- --watch=false --browsers=ChromeHeadless
```

## High-Level Architecture

Core folders:

- `src/app/core/graph`
	- domain types and constants
	- pure graph algorithms (`graph-analysis.ts`)
- `src/app/features/examples`
	- state orchestration services
	- reconstruction and simulation logic helpers
- `src/app/shared/graph-canvas`
	- Cytoscape rendering layer
	- extracted canvas config and overlay utilities
- `src/app/pages/examples-page`
	- page-level bindings via workflow facade

## State Model (Signals)

Main services:

- `VisualizationStateService`
	- selected graph example
	- current visualization step (0-5)
	- computed MST and instrumentation sets
- `SimulationStateService`
	- simulation config and runtime state
	- delegates traversal logic to `simulation.engine.ts` (pure engine)
- `ReconstructionStateService`
	- reconstructed counters and explanation steps
	- delegates equation-solving helpers to `reconstruction.helpers.ts`

Page orchestration:

- `ExamplesWorkflowFacade`
	- centralizes step transitions and cross-service reset rules
	- keeps page component thin and declarative

## Domain Terms

Internal terminology mapping used in code:

- ENTRY / EXIT: workflow start/end nodes
- Sentinel edges:
	- `__entry_sentinel__`
	- `__exit_sentinel__`
- Instrumented edges: edges selected for direct counting
- Reconstruction: solving unknown counts from flow-balance constraints

## Testing Notes

Current test suite includes:

- characterization tests for graph analysis and reconstruction helpers
- engine tests for pure simulation traversal logic
- state service tests for configuration and state transitions
- facade tests for examples workflow transitions

If you add new example graphs or change transition rules, update:

- corresponding service/facade tests
- helper characterization tests where behavior is intentionally preserved

## Naming Note

`VisualizationStateService` currently contains the graph-step state used by the examples workflow.
If desired, a future rename to `ExamplesGraphStateService` can improve semantic clarity.
