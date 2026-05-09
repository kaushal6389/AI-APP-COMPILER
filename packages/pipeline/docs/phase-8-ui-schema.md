# Phase 8 — UI Schema Compiler (Draft)

Objective: Generate a UI-oriented JSON schema from the `manifest` to drive automatic form generation and admin UIs.

Prototype goals:
- Emit `ui-schema.json` describing forms for each model: fields, types, required flags, and simple input hints.
- Keep schema framework-agnostic (JSON Schema inspired) so frontends can map to React/Next form components.
- Integrate as a non-blocking artifact produced during code generation.

Next steps:
1. Implement `generateUiSchema(manifest)` prototype to produce minimal schema.
2. Emit `ui-schema.json` to `.out/<app>` and surface in `summary.json`.
3. Later: map widget hints, validation rules (zod → JSON Schema), and UI layout metadata.
