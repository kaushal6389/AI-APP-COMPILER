# Phase 6 — Advanced Relation Inference & Prisma Generation (Draft)

Objective: Improve database relation inference to produce correct, unambiguous Prisma schemas automatically. Address self-relations, optionality, relation names, and foreign key pairing.

Key ideas:
- Detect implied opposite relation fields and generate consistent relation names to avoid Prisma ambiguity.
- Prefer explicit relation naming for self-relations: `@@relation(fields: [parentId], references: [id], name: "Task_parent_tasks")`.
- When multiple relations target the same model, append deterministic suffixes (`_2`, `_3`) to avoid collisions.
- Infer optional vs required foreign keys from domain semantics (e.g., auditing fields optional).
- Emit relation metadata used by the schema generator and the runtime to produce proper `@relation` annotations.

Next steps (prototype):
1. Implement a small inference engine `inferPrismaRelations(manifest)` that scans `manifest.database` and produces relation metadata.
2. Integrate the inference engine into the schema generator in a follow-up PR.
