# AI App Compiler

A production-grade, deterministic multi-stage code generation architecture that converts natural language product requirements into strict, executable application configurations and code.

## 🚀 Architecture Pipeline Diagram

```mermaid
graph TD
    A[Natural Language Prompt] --> B[Stage 1: Intent Extraction]
    B -->|IntentIR (JSON)| C[Stage 2: System Design]
    C -->|DesignIR (JSON)| D[Stage 3: Schema Generation]
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

## 📁 Repository Structure
* `apps/frontend` - Next.js 15 UI for the AI App Compiler Dashboard.
* `apps/backend` - Execution entry points (Orchestrator runner).
* `packages/schemas` - Core AST data types mapping Intent, Architecture, Databases, and APIs.
* `packages/validators` - Zod invariants and relational rule engines.
* `packages/repair-engine` - Deterministic Node patching system.
* `packages/runtime` - Hardcoded AST-to-Code generator strings (Prisma, Express).

## 💻 Running the Compiler Engine
To run the automated suite (Compilation + Validation/Repair + Code transpile + Evaluation batch):
```sh
npm install
npx ts-node -r tsconfig-paths/register apps/backend/src/index.ts
```

## ✅ Generated Artifacts
The pipeline now emits a complete artifact set into `.out/app`, including:
`schema.prisma`, `routes.ts`, `server.ts`, `rbac.ts`, `rbac-policy.json`, `validators.ts`, `ui-schema.json`, `artifact-tests.js`, and a runnable `Dockerfile`.

## 🔍 Validation
The generated artifacts are validated end-to-end with Prisma validation, TypeScript compile checks, artifact tests, and a Docker smoke path in CI.

## 🖥 Frontend Console Dev
```sh
cd apps/frontend
npm install
npm run dev
```