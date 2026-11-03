# MedOrbit

Arabic RTL, mobile-first university hackathon app for a fictional doctor directory, products, professional visit reports and a database-backed company dashboard.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server through its managed workflow
- `pnpm --filter @workspace/medorbit run dev` — run the web frontend through its managed workflow
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string; persistent `SESSION_SECRET` (at least 16 characters) for OTP hashing/encryption. Never log either value.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/medorbit/src` — React/Tailwind frontend
- `artifacts/api-server/src/routes` — doctor, product, visit and dashboard endpoints
- `lib/db/src/schema` — PostgreSQL schema
- `lib/api-spec/openapi.yaml` — API contract; regenerate client and validators after edits
- `README.md` — Arabic setup, scope, privacy and testing instructions

## Architecture decisions

- Preserve one integrated app, one Node.js API and persistent PostgreSQL during later additions; the two beginner student authors requested platform-supported defaults and no microservices.
- This is a fictional-only hackathon demonstration without authentication or company isolation. Do not use real medical/company data.
- The requested clinic OTP is a separate, explicitly public-activatable DEMO simulator, not real clinic staff authentication or proof of physical presence. Representatives have server-issued opaque demo sessions, not browser-supplied identities. Preserve the separation between the representative form and the code-display page.
- OTP verification uses only a context-bound keyed hash. A separately keyed authenticated-encryption envelope exists solely so the simulated secretary can reload its delivery page without storing plaintext codes. Never send this envelope, the hash, or a generated code to representative endpoints.
- Existing reports stay unverified legacy records; only backend-verified new visits may receive `Confirmed by clinic demo code`, and each pending visit permits one report.
- Smart Route is a read-only, approximate same-day tour proposal, separate from visits and OTP verification. **Why:** a hypothetical plan must never imply attendance, create reports, or bypass clinic confirmation. **How to apply:** keep all future planning links subject to the existing verification/report flow.
- Route estimates use saved fictional doctor coordinates/windows and a disclosed fixed speed, not live roads/traffic or global optimization. **Why:** this is a beginner-friendly hackathon heuristic without an external routing service. Preserve these limits in future UI claims.
- Doctor briefings are a read-only projection of saved reports, with visit ID/date citations. The current engine uses fixed rules, labelled `ملخص آلي منظّم`, never generative AI. **Why:** no existing secure LLM integration was available, and the user explicitly requires honest disclosure and strict grounding. **How to apply:** never introduce fictional preferences, prescribing claims, personality profiles, or external model calls as silent fallbacks.
- Declared interests have profile-field provenance, not an invented visit date; the file creation timestamp is not a last-edited timestamp. Requests extracted from notes have an unknown completion state, even if another note generically mentions delivery. **Why:** neither interest-change history nor per-request completion tracking exists in the saved evidence. **How to apply:** cite only exact report mentions, distinguish the profile source explicitly, and suggest checking request completion rather than asserting it remains open.
- Pharmacy Insights Lite is fictional regional aggregate data only, independent of doctors and verified visits. Never infer an individual doctor's prescribing, preferences or score from regional sales, including in future briefings. **Why:** the user explicitly forbids this inference; regional sales cannot establish individual behavior. **How to apply:** keep the disclaimer prominent and warn that unavailable stock can drive low observed sales.
- Pharmacy entry uses a closed, monthly aggregate contract with predefined fictional regions/sources and no notes or uploads; unknown fields are rejected, not silently stripped. **Why:** the user forbids identifiable prescriptions, patient details and prescription photos, and requested a very small module. **How to apply:** preserve the privacy boundary in both client and server; missing regional data is not zero, and observations from unlike products/periods must not be summed as a sales comparison.

## Product

- Search, add, edit and view fictional doctors; browse three fictional products; save professional visit reports; query actual saved records in the company dashboard; calculate a time-window-aware fictional Smart Route tour; prepare a visit from grounded saved-report summaries; enter/edit fictional pharmacy aggregates and compare regions for the same product/month.

## User preferences

- Arabic content, correct RTL, mobile and desktop, navy/teal/white.
- No patient information, prescription images, real phone numbers or sensitive personal traits.
- Demo-code verification, the simple Smart Route planner, grounded doctor briefings, and the explicitly requested Pharmacy Insights Lite aggregate module are in scope. Use a secure existing server-side model only if actually available; otherwise disclose the structured-rule fallback. Do not add WhatsApp, SMS, prescription/patient pharmacy workflows, live traffic or external road-navigation integrations.
- Extend current code and preserve all saved data; seed additions must never overwrite edited doctor records.
- Be explicit about actual verification results and incomplete features; never claim unperformed browser tests.

## Gotchas

- Schema push is development-only; managed production migrations happen through Publish. Startup seeds fictional fixtures without DDL or overwriting existing edits.
- Calendar visit dates remain YYYY-MM-DD strings; timestamps are instants.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
