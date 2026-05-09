# Phase 2 — Execution DAG Engine (Draft)

Goal: Replace the linear stage runner with a dependency-aware execution engine that supports caching, retries, snapshots, and parallelizable nodes where safe.

Immediate priorities (prototype → hardened):

- Prototype: small `runDAG(nodes)` runner (implemented at `src/dag/engine.ts`) that topologically orders and executes nodes.
- Add node metadata: `cacheKey`, `canRunInParallel`, `timeoutMs`.
- Add execution context: shared results map, structured events, trace IDs.

Next implementation steps (this sprint):

1. Extend `DagNode` type with optional `cacheKey?: string` and `parallelizable?: boolean`.
2. Implement a simple in-memory cache and a snapshot serializer to `.out/pipeline-cache`.
3. Add telemetry hooks: `onNodeStart`, `onNodeEnd`, `onNodeFail` to integrate with existing `sendEvent` callback.
4. Add basic parallel execution for nodes without direct or transitive deps using Promise.all with a concurrency cap.

Longer-term:

- Persisted snapshots + incremental re-run on manifest diffs.
- Deterministic hashing of node inputs for stable cache keys.
- Pluggable executors (local, remote worker, queue-based).

I will start by extending the `DagNode` shape and wiring `sendEvent` into node lifecycle hooks, then implement an in-memory cache and snapshotter.
