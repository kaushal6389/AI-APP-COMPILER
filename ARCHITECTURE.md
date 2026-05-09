# AI App Compiler Architecture

## Core Design Philosophy
The system operates as a deterministic, deterministic multi-stage Directed Acyclic Graph (DAG). We abandon single-shot prompt engineering in favor of a compiler-like pipeline: Lexing (Intent) → Parsing (Design) → Semantic Analysis (Schema) → Optimization/Validation (Repair) → Code Generation (Runtime).

## The 6-Stage Pipeline

### Stage 1: Intent Extraction
**Goal:** Translate noisy natural language into a strict JSON Intermediate Representation (IR).
**Reliability Mechanism:** We force the LLM to explicitly declare `assumptionsMade`. If required fields (e.g., core entities or user roles) are missing, we can halt and prompt the user rather than hallucinating features.

### Stage 2: System Design Layer
**Goal:** Establish topological boundaries (modules, relationships).
**Reliability Mechanism:** By designing the system architecture *before* generating DB/API schemas, we constrain the infinite feature space. If an entity exists in Stage 1 but is omitted in Stage 2's relationships, the Validation Engine flags an orphaned entity.

### Stage 3: Schema Generation
**Goal:** Produce exact blueprints for DB (Prisma), API (Fastify/Express), and UI (React/Next).
**Tradeoff:** We use Abstract Syntax Trees (ASTs) in JSON rather than raw code. Generating code directly is brittle. Generating a JSON schema of the code allows us to validate the shape (e.g., confirming every API route references a valid DB model) before writing a single line of TypeScript.

### Stage 4: Validation Engine
**Goal:** Enforce deterministic invariants.
**Mechanism:** Uses `Zod` to check schema shapes. Cross-checks references (e.g., `ApiRoute.rolesAllowed` must only contain roles defined in `IntentSchema.roles`). 

### Stage 5: Repair Engine
**Goal:** Autonomously fix broken schemas without restarting the pipeline.
**Mechanism:** An LLM agent provided with the `ValidationReport` and the exact JSON path of the error. It outputs JSON patch operations (`add`, `replace`, `remove`) conforming to the `RepairActionSchema` to surgically fix the specific node, maintaining determinism and reducing token cost/latency.

### Stage 6: Runtime / Execution Layer
**Goal:** Transpile the validated JSON schemas into a runnable Next.js 15 + Node app.
**Mechanism:** Hardcoded AST-to-Code transpilers (e.g., mapping `DatabaseModelSchema` to Prisma `.prisma` files, Next.js App Router folders). No AI is used in this final step—guaranteeing that 100% valid JSON produces 100% valid code.

## Folder Structure (Monorepo)
- `apps/frontend`: User-facing dashboard to input prompts and view the compiler pipeline.
- `apps/backend`: The orchestration server running the DAG.
- `packages/schemas`: Shared Zod validators (The single source of truth).
- `packages/pipeline`: Custom LangGraph state machines.
- `packages/validators`: Cross-stage verification logic.
- `packages/repair-engine`: JSON patch AI agents.
- `packages/runtime`: AST to Code generators.
- `packages/evaluation`: Evals framework tracing retry bounds, latency, and success rates.