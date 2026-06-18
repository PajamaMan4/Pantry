# Pantry

Personal, local-first, single-user cooking and kitchen management app. Manage recipes, track pantry inventory, scale servings, and monitor ingredient costs — all stored locally in SQLite with no cloud dependency.

## License

This project is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE).
In short: you're free to use, modify, and share this code for personal,
educational, or other noncommercial purposes. Commercial use (selling it,
using it in a paid product, etc.) is not permitted without a separate
agreement.

## Features

- **Recipe management** — create, edit, and organize recipes with ingredients, steps, tags, and notes
- **Serving scaler** — scale any recipe up or down at render time without modifying stored data
- **Pantry inventory** — track what you have on hand with quantities and units
- **Cost tracking** — estimate per-serving and total recipe costs from ingredient prices
- **Shopping lists** — generate lists from recipes or missing inventory
- **Cooking mode** — step-through view optimized for use while cooking
- **Recommendations** — suggestions based on what's in your pantry

## Stack

- **Next.js 16 (App Router) + React 19 + TypeScript**
- **SQLite** (`data/pantry.db`, WAL mode) via **Drizzle ORM** + `better-sqlite3`
- **Tailwind v4 + shadcn/ui**
- **Zod** for validation, **Vitest** for domain logic, **Recharts** for charts

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The database is created and migrated automatically on first run at `data/pantry.db`.

To seed example data:

```bash
npm run db:seed
```

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Dev server at http://localhost:3000 |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm test` | Run Vitest suite |
| `npm run db:generate` | Generate a migration after editing `schema.ts` |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:seed` | Seed example data (idempotent) |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run backup` | Timestamped backup of `pantry.db` (keeps 10 newest) |

## Project Structure

```
src/
  app/              # App Router pages and layouts
  lib/
    db/             # Drizzle schema, client, migrations, per-entity access
    domain/         # Pure business logic — units, scaling, cost, recommendations
    validation/     # Zod schemas shared by forms and server actions
  components/
    ui/             # shadcn/ui primitives
scripts/            # migrate.ts, seed.ts, backup.ts (run via tsx)
drizzle/            # Generated SQL migrations (committed)
data/               # pantry.db and backups/ (gitignored)
```

## Data Notes

- Times are stored in **minutes**; timestamps as Unix epoch integers
- Recipe scaling is a render-time transform — the base recipe is never mutated
- All unit and cost math lives in `src/lib/domain` so it stays unit-testable
