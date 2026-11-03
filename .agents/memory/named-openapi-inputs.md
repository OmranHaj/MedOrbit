---
name: Named OpenAPI input schemas
description: Avoid duplicate exports when regenerating this workspace's API contracts.
---

Define object request bodies as named component input schemas and reference them from operations rather than writing inline object bodies.

**Why:** the current Orval setup exported identical operation-body names through its generated Zod and TypeScript barrels for inline bodies, causing TS2308 during code generation. Named input components resolved the collision without editing generated files.

**How to apply:** use a distinct component input name for new mutation contracts, run the normal codegen command, and retain both generated schema and type exports. Do not hand-patch generated output or remove barrel exports to hide this error.
