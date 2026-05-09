# Phase 4 — Semantic Consistency Engine (Draft)

Goal: Detect semantic drift, hallucinations, and structural mismatches between `IntentIR`, `DesignIR`, and the generated `Manifest` before codegen.

Principles:
- Deterministic rules first: checks must be simple, explainable, and fast.
- Score and short-circuit: produce a semantic score and a list of issues. Fail-fast only for critical issues.
- Pluggable policies: allow adding domain-specific rule sets later.

Initial rule set (prototype):
- Intent vs Manifest entity coverage: ensure required entities from `IntentIR` exist in `Manifest.database`.
- Role preservation: roles listed in `IntentIR.primaryRoles` must appear in generated RBAC metadata.
- Hallucination threshold: if `intentIR.hallucinationRisk === 'High'` mark low confidence and surface to user.
- API touch verification: each `api` entry in `Manifest.api` must reference existing `database` entities.

Next steps:
1. Implement prototype rule engine and integrate as a DAG node between Validation and CodeGen.
2. Emit structured `SEMANTIC_*` events for UI and logs.
3. Add auto-repair suggestions (Phase 9) for fixable issues.
