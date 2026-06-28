# Knuth Profiler Architecture Overview

## 1. Purpose and Scope

Knuth Profiler is an Angular 19 application for visualizing and explaining a Knuth-style profiling workflow on directed control-flow graphs.

Primary goals:
- visualize graph structure and edge weights
- derive max-weight spanning tree (MST)
- identify instrumented edges
- run simulation to collect measurable counters
- reconstruct unknown tree-edge counts from flow balance constraints

This document describes current architecture, boundaries, and responsibilities.

## 2. Architectural Style

The codebase follows a layered, feature-oriented architecture:
- core domain layer for types, constants, and pure algorithms
- feature state layer for runtime state and orchestration
- shared rendering layer for graph visualization
- page layer for route-level composition

The design principle is:
- pure logic in stateless modules
- state changes in signal-based services
- page/component code as thin wiring

## 3. Directory and Responsibility Map

Top-level app responsibilities:
- src/app/core/graph
  - domain model, constants, and pure graph algorithms
- src/app/features/examples
  - use-case state services, facade orchestration, pure helper engines
- src/app/shared/graph-canvas
  - Cytoscape rendering, styles/config, and overlay application
- src/app/pages/examples-page
  - route UI template and facade binding

## 4. Domain Model

Key concepts:
- Node kinds: entry, exit, normal, decision, ghost_out
- Edge kinds: normal, entry, exit, back, chord
- Sentinel edges:
  - __entry_sentinel__
  - __exit_sentinel__
- Overlay model:
  - MST highlighting
  - instrumentation highlighting
  - simulation counters
  - current node/edge focus

Canonical domain constants are centralized in:
- src/app/core/graph/graph.constants.ts

## 5. Core Layer (Pure Domain Logic)

### 5.1 Graph Constants
File:
- src/app/core/graph/graph.constants.ts

Responsibility:
- central IDs for ENTRY/EXIT/ghost/sentinel elements
- sentinel helper guards

### 5.2 Graph Analysis
File:
- src/app/core/graph/graph-analysis.ts

Responsibility:
- computeMaxWeightSpanningTree(data)
- computeInstrumentedEdgeIds(data, mst)

Design notes:
- deterministic Kruskal-like selection (with tie-breaks)
- excludes zero-weight sentinel artifacts from measurable edge logic

### 5.3 Cytoscape Bootstrap
File:
- src/app/core/graph/cytoscape-bootstrap.ts

Responsibility:
- one-time plugin registration (dagre, elk)
- avoids duplicate global registration and side effects

## 6. Feature Layer (State + Use Cases)

### 6.1 ExamplesGraphStateService
File:
- src/app/features/examples/visualization-state.service.ts

Responsibility:
- selected example and visualization step (0-5)
- selected graph layout
- derived MST and instrumented edge IDs
- derived overlay visibility by step

Boundary:
- stateful signal service
- delegates heavy graph math to pure core helpers

### 6.2 SimulationStateService
File:
- src/app/features/examples/simulation-state.service.ts

Responsibility:
- simulation runtime state (running/paused/current run/current cursor)
- simulation config (runs/speed/fast mode)
- counters and simulation overlay exposure

Boundary:
- owns state transitions
- delegates traversal logic to simulation engine

### 6.3 Simulation Engine (Pure)
File:
- src/app/features/examples/simulation.engine.ts

Responsibility:
- runFastSimulation()
- simulateSingleRun()
- initializeAnimatedTraversal()
- tickAnimatedTraversal()
- edge selection/outgoing traversal helpers

Boundary:
- stateless logic only
- no Angular dependency

### 6.4 ReconstructionStateService
File:
- src/app/features/examples/reconstruction-state.service.ts

Responsibility:
- reconstructed counters
- explanation step history and index navigation
- pending unknown MST edges
- one-step reconstruction command

Boundary:
- owns mutable reconstruction state
- delegates equation-solving logic to pure helpers

### 6.5 Reconstruction Helpers (Pure)
File:
- src/app/features/examples/reconstruction.helpers.ts

Responsibility:
- buildKnownCounts()
- findSolvableNodeAndEdge()
- solveBalanceAtNode()
- renderBalanceText()

Boundary:
- pure balance algebra and candidate selection
- no direct service dependencies

### 6.6 Workflow Facade
File:
- src/app/features/examples/examples-workflow.facade.ts

Responsibility:
- single orchestration API for UI layer
- step transition policy
- reset/preserve rules across simulation and reconstruction
- merged overlay for graph canvas

Important transition rules:
- 4 -> 5 preserves simulation counters
- 5 -> 4 preserves simulation and clears reconstruction
- transitions outside preserve path reset derived state as needed

## 7. Shared Rendering Layer

### 7.1 Graph Canvas Component
File:
- src/app/shared/graph-canvas/graph-canvas.component.ts

Responsibility:
- initialize Cytoscape core
- react to data/layout/overlay changes
- run layout and fit viewport

### 7.2 Canvas Config
File:
- src/app/shared/graph-canvas/graph-canvas.config.ts

Responsibility:
- centralized stylesheet and base Cytoscape options
- layout options factory for dagre and elk

### 7.3 Canvas Utilities
File:
- src/app/shared/graph-canvas/graph-canvas.utils.ts

Responsibility:
- map graph domain model to Cytoscape elements
- replace graph contents
- apply overlay classes/labels/counters

## 8. UI Composition Layer

### Examples Page
Files:
- src/app/pages/examples-page/examples-page.component.ts
- src/app/pages/examples-page/examples-page.component.html

Responsibility:
- bind template controls to facade commands and computed values
- keep component logic minimal

Current model:
- component injects facade only
- all workflow logic resides in facade/services/helpers

## 9. Data and Control Flow

High-level flow:
1. user selects example
2. graph state service exposes graph data
3. graph analysis computes MST and instrumentation set
4. facade exposes step-based overlay
5. simulation service updates counters and cursor markers
6. reconstruction service computes unknown tree edges from known counts
7. facade merges overlays and page renders through graph canvas

## 10. Testing Strategy

Test layers:
- pure unit tests
  - graph-analysis.spec.ts
  - reconstruction.helpers.spec.ts
  - simulation.engine.spec.ts
- state service tests
  - simulation-state.service.spec.ts
  - reconstruction-state.service.spec.ts
  - visualization-state.service.spec.ts
- facade behavior tests
  - examples-workflow.facade.spec.ts
- integration scenario tests (facade + services)
  - examples-workflow.integration.spec.ts

Expected value:
- behavior lock for refactors
- confidence in step transitions and reset semantics
- regression protection for orchestration rules

## 11. Current Quality Baseline

Current baseline after latest refactors:
- service rename completed: VisualizationStateService -> ExamplesGraphStateService
- simulation and reconstruction logic extracted to pure modules
- graph canvas responsibilities split into config/utils/bootstrap
- full test suite green (62 tests)

## 12. Recommended Evolution Path

Near-term options:
- add explicit architecture decision records for key rules (step transitions, reconstruction assumptions)
- introduce stricter type aliases for edge IDs and node IDs
- add deterministic simulation mode hook for deeper integration tests
- expand scenario tests to include negative and dead-end graph paths

This architecture is stable and suitable for incremental feature development.
