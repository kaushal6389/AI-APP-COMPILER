AI App Compiler

A production-grade, deterministic multi-stage pipeline that converts natural-language prompts into validated, executable application artifacts (Prisma schema, Express routes, UI schema, RBAC policies, and starter runtime).

## Overview

AI App Compiler is a compiler-style system that consumes user prompts and produces a ready-to-run application scaffold with built-in RBAC, UI schema, and validation. This repository contains the pipeline, evaluation harness, and a minimal demo server.

## Highlights

- Multi-stage DAG pipeline: intent extraction → system design → schema generation → RBAC validation/repair → UI schema → code generation
- Deterministic output hashing and canonical naming for reproducible runs
- RBAC engine with auto-fix/seed defaults and runtime middleware
- In-memory cache with atomic `getOrSet` and metrics
- Evaluation harness (20 prompts) with per-run artifacts in `.out/evaluation`

## Quick Start

Prerequisites: Node.js (16+), npm

1. Install dependencies:

```bash
npm install
```

2. Run the pipeline with a prompt (example):

```bash
AI_PIPELINE_PROMPT="Build a CRM with users, contacts, and role-based access" node packages/pipeline/run_test.js
```

3. Run the demo server (local):

```bash
node apps/demo/server.js
# POST JSON { prompt: "..." } to http://localhost:3000/generate
```

## Evaluation

- Evaluation dataset: `packages/pipeline/evaluation_prompts.json` (20 prompts)
- Runner: `scripts/run_evaluation.js`
- Latest run: 20/20 passed, pass rate 100%, average latency ~20s per run. Results are saved under `.out/evaluation/result_*.json`.

## Files of interest

- `packages/pipeline/` — pipeline implementation (stages, orchestrator, RBAC, UI compiler)
- `packages/runtime/` — code generators (Prisma, Express, RBAC policy, validators)
- `apps/demo/server.js` — minimal demo endpoint to submit prompts
- `scripts/run_evaluation.js` — evaluation runner
- `.out/app/` — generated app artifacts (schema.prisma, routes.ts, ui-schema.json, rbac-generated.js)

## Development notes

- One-off maintenance scripts were moved into `test/` to keep root clean.
- Generated caches (`.out`, `.turbo`) are ignored in `.gitignore` and removed from the repo history where possible.

## Contributing

PRs welcome. If you want help preparing a PR or a short demo, tell me and I will prepare the PR description and a Loom script.

---

_Generated artifacts and evaluation results are included to help reviewers reproduce the work._
    D -->|Manifest AST (JSON)| E{Stage 4: Validation Engine}
    E -->|Valid| G[Stage 6: Runtime Code Transpilation]
    E -->|Violations Found| F[Stage 5: Repair Engine]
    F -->|Surgical JSON Patch| E
    G --> H[Executable Output / Prisma / Express]
```

## ✨ Core Features
1. **Deterministic Stages**: Using highly constrained LangGraph-like states with strict Zod parsing instead of single-shot completions.
2. **Abstract Syntax Trees (AST)**: LLM outputs JSON schema architecture mapping completely before transpiling down to raw TS/Prisma Code files.
3. **Cross-Schema Validation**: Detects unreferenced tables, hallucinated roles, and mismatched boundaries dynamically.
4. **Self-Healing LLM (Repair Engine)**: Auto-trims and patches JSON nodes (RFC6902-style patches) when logic is fundamentally invalid without re-running the entire prompt and losing context.
5. **Evaluation Submodule**: Batch tests limits, cost, and reliability metrics.

AI App Compiler

AI App Compiler is a production-grade, deterministic multi-stage pipeline that converts natural-language prompts into validated, executable application artifacts (Prisma schema, Express routes, UI schema, RBAC policies, and a starter runtime).

## Overview

This repository contains a compiler-style system that consumes user prompts and produces a ready-to-run application scaffold with built-in RBAC, UI schema, and validation. It includes the pipeline implementation, an evaluation harness, and a minimal demo server.

## Highlights

- Multi-stage DAG pipeline: intent extraction → system design → schema generation → RBAC validation/repair → UI schema → code generation
- Deterministic output hashing and canonical naming for reproducible runs
- RBAC engine with auto-fix/seed defaults and runtime middleware
- In-memory cache with atomic `getOrSet` and runtime metrics
- Evaluation harness (20 prompts) with per-run artifacts in `.out/evaluation`

## Quick Start

Prerequisites: Node.js (16+) and npm

1. Install dependencies:

```bash
npm install
```

2. Run the pipeline with a prompt (example):

```bash
AI_PIPELINE_PROMPT="Build a CRM with users, contacts, and role-based access" node packages/pipeline/run_test.js
```

3. Run the demo server (local):

```bash
node apps/demo/server.js
# POST JSON { "prompt": "..." } to http://localhost:3000/generate
```

## Evaluation

- Evaluation dataset: `packages/pipeline/evaluation_prompts.json` (20 prompts)
- Runner: `scripts/run_evaluation.js`
- Latest run: 20/20 passed, pass rate 100%, average latency ~20s per run. Results are saved under `.out/evaluation/result_*.json`.

## Files of interest

- `packages/pipeline/` — pipeline implementation (stages, orchestrator, RBAC, UI compiler)
- `packages/runtime/` — code generators (Prisma, Express, RBAC policy, validators)
- `apps/demo/server.js` — minimal demo endpoint to submit prompts
- `scripts/run_evaluation.js` — evaluation runner
- `.out/app/` — generated app artifacts (schema.prisma, routes.ts, ui-schema.json, rbac-generated.js)

## Development notes

- One-off maintenance scripts were moved into `test/` to keep the repository root clean.
- Generated caches (`.out`, `.turbo`) are ignored in `.gitignore` and removed from the git index to keep the repo lightweight.

## Core Features

1. **Deterministic Stages** — Uses constrained LangGraph-like states and strict schema parsing to ensure reproducible outputs.
2. **Abstract Syntax Trees (AST)** — LLM outputs are validated as JSON ASTs before transpiling to TypeScript/Prisma artifacts.
3. **Cross-Schema Validation** — Detects unreferenced tables, hallucinated roles, and mismatched boundaries across layers.
4. **Self-Healing Repair Engine** — Applies surgical JSON patches (RFC6902-style) to fix validation issues without re-running the entire prompt.
5. **Evaluation Submodule** — Batch-testing harness for reliability and cost/latency metrics.

## Repository Structure (short)

- `apps/frontend` — Next.js UI for the AI App Compiler Dashboard
- `apps/backend` — Orchestrator runner entry points
- `packages/schemas` — Core AST data types for Intent, Architecture, Databases, and APIs
- `packages/validators` — Zod invariants and relational rule engines
- `packages/repair-engine` — Deterministic JSON patching system
- `packages/runtime` — AST-to-code generators for Prisma and Express

## Running the full suite (developer)

To run the automated suite (compilation + validation/repair + code transpile + evaluation batch):

```bash
npm install
node packages/pipeline/run_test.js
node scripts/run_evaluation.js
```

## Generated Artifacts

The pipeline emits a complete artifact set into `.out/app`, including:

`schema.prisma`, `routes.ts`, `server.ts`, `rbac.ts`, `rbac-policy.json`, `validators.ts`, `ui-schema.json`, `artifact-tests.js`, and a runnable `Dockerfile`.

## Validation & CI

Generated artifacts are validated with Prisma checks, TypeScript compilation, and artifact tests. A Docker smoke test is attempted in CI but is tolerant to failures (optional) to avoid blocking PRs when the environment lacks Docker.

## Frontend (developer)

```bash
cd apps/frontend
npm install
npm run dev
```

## Cost vs Quality

- The pipeline prioritizes structured, multi-stage validation (higher latency, lower hallucination). Faster modes are possible by relaxing validation or caching more aggressively.

## Demo server (local)

```bash
node apps/demo/server.js
# then POST to http://localhost:3000/generate with JSON: { "prompt": "..." }
```

---

#   A I - A P P - C O M P I L E R  
 #   A I - A P P - C O M P I L E R  
 