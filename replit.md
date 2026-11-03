# MedOrbit

Arabic RTL, mobile-first university hackathon app for a fictional doctor directory, products, professional visit reports and a database-backed company dashboard.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server through its managed workflow
- `pnpm --filter @workspace/medorbit run dev` — run the web frontend through its managed workflow
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

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

## Product

- Search, add, edit and view fictional doctors; browse three fictional products; save professional visit reports; query actual saved records in the company dashboard.

## User preferences

- Arabic content, correct RTL, mobile and desktop, navy/teal/white.
- No patient information, prescription images, real phone numbers or sensitive personal traits.
- Do not add OTP, route planning, AI briefs, WhatsApp or pharmacy modules in this phase.
- Ordinary page navigation remains necessary for the requested directory/profile/edit pages; do not confuse it with the deferred route-planning module.
- Be explicit about actual verification results and incomplete features; never claim unperformed browser tests.

## Gotchas

- Schema push is development-only; managed production migrations happen through Publish. Startup seeds fictional fixtures without DDL or overwriting existing edits.
- Calendar visit dates remain YYYY-MM-DD strings; timestamps are instants.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
