# Phase 5 — Role Preservation & RBAC Hardening (Draft)

Goal: Ensure roles derived from intent are preserved through design and code generation, detect role drift, and produce enforceable RBAC matrices.

Core features (prototype):
- Role canonicalization: normalize role names (case/whitespace) and map synonyms.
- Role coverage: ensure `IntentIR.primaryRoles` are referenced in `Manifest.api[].rolesAllowed` or present in generated RBAC metadata.
- Unused role detection: find roles present in intents but never used, and roles used in APIs but not declared in intent.
- Role overlap/conflict detection: detect roles with overlapping permissions or ambiguous names.

Integration plan:
1. Implement a lightweight RBAC checker module that takes `IntentIR` + `Manifest` and returns `issues` + `roleMatrix`.
2. Integrate as a DAG node after `SEMANTIC_CHECK` and before `CODE_GENERATION` so we can stop or warn before emitting code.
3. Surface `RBAC_*` events to the `sendEvent` callback for UI display.

Next steps (this sprint):
- Add prototype checker and integrate into DAG.
- Add a follow-up task to generate an RBAC report artifact (`.out/app/rbac-report.json`).

Policy language (v1):
- `version: "1.0"`
- `roles[]`: each role has `name`, optional `inherits[]`, and `permissions[]`.
- `resources[]`: resource name + supported `actions[]` derived from API methods.
- `apiPermissions[]`: flattened mapping of `method`, `path`, `permission`, and `roles`.

Middleware mapping:
- Each API route maps to a permission string: `${entity.toLowerCase()}:${action}`.
- `action` derives from HTTP method: GET->read, POST->create, PUT/PATCH->update, DELETE->delete.
- Runtime enforces `requirePermission(permission)` by checking role-to-permission mapping.
