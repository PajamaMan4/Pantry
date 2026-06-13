@AGENTS.md

# Pantry

Personal, local-first, single-user cooking & kitchen-management app. The full
spec and phased roadmap live in [pantry-technical-design.md](pantry-technical-design.md);
read the relevant section before working on a phase.

## Stack

- **Next.js 16 (App Router) + React 19 + TypeScript** — one repo for UI + server.
- **SQLite** (`data/pantry.db`, WAL mode) via **Drizzle ORM** + `better-sqlite3`.
- **Tailwind v4 + shadcn/ui** (Base UI primitives, "base-nova" style).
- **Zod** for validation, **Vitest** for the domain layer, **Recharts** for charts.

> `better-sqlite3` is native — it's listed in `serverExternalPackages` in
> `next.config.ts` so Next doesn't try to bundle the binding.

## Layout (see §4.2 of the design)

- `src/app/` — App Router pages. DB-reading pages set `export const dynamic = "force-dynamic"`.
- `src/lib/db/` — Drizzle `schema.ts`, `client.ts` (connection + WAL + auto-migrate), `migrate.ts`, `paths.ts`, per-entity access (e.g. `settings.ts`).
- `src/lib/domain/` — **pure, framework-agnostic, unit-tested** logic (units, scaling, cost, recommendations). The heart of the app; no I/O here.
- `src/lib/validation/` — Zod schemas shared by forms + actions.
- `src/components/ui/` — shadcn components.
- `scripts/` — `migrate.ts`, `seed.ts`, `backup.ts` (run via tsx; use **relative** imports, not the `@/` alias).
- `drizzle/` — generated SQL migrations (committed).
- `data/` — `pantry.db` + `backups/` (gitignored).

## Commands

- `npm run dev` — dev server at http://localhost:3000
- `npm run build` / `npm start` — production
- `npm run db:generate` — generate a migration after editing `schema.ts`
- `npm run db:migrate` — apply migrations (also runs automatically on first DB connection)
- `npm run db:seed` — idempotent seed data
- `npm run backup` — timestamped backup of `pantry.db` (keeps newest `BACKUP_KEEP`, default 10)
- `npm run db:studio` — Drizzle Studio
- `npm test` — Vitest

## Conventions

- Times stored in **minutes**; timestamps as **Unix epoch** (Drizzle `mode: "timestamp"`).
- **Scaling never mutates stored data** — it's a render-time transform over the base recipe.
- All unit/cost math goes through `src/lib/domain` so it stays testable; the UI never does unit math inline.

## Status

Phase 0 (project & data layer) is done. Phases 1–8 (recipes, scaling, inventory,
cooking, cost, recommendations, extras, polish) are described in §8 of the design.
