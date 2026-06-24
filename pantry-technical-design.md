# Pantry — Technical Design Document

*A personal cooking & kitchen-management app. Single-user, local-first.*

---

## How to use this document with Claude Code

This document is written so you can hand it to Claude Code **in phases** (see §8). The recommended workflow:

1. Give Claude Code §1, §2, and §4 first, plus **Phase 0** from §8, to scaffold the project and data layer.
2. Then hand it one phase at a time. Each phase names its dependencies and its "done" criteria.
3. Keep the **domain logic** (§5) framework-agnostic and unit-tested — it is where correctness lives, and it is the part you'll most want to extend yourself later.

**Contents:** 1. Platform & Stack · 2. Data Models · 3. Feature Specs · 4. Architecture · 5. Key Algorithms · 6. UI/UX · 7. Additional Features · 8. Roadmap · Appendix (seed data & conventions)

---

## 1. Platform & Stack Recommendation

### 1.1 Options considered

| Option | Day-to-day friction (P1) | Data reliability + human-readable (P2) | Solo-maintainable with Claude Code (P3) | Verdict |
|---|---|---|---|---|
| **Local web app + local server + SQLite** | **Low** — works on desktop *and* phone over home Wi-Fi; the "pull up a recipe while cooking" case is native to the browser | **High** — single SQLite file on disk, trivially backed up; JSON export for human-readability | **High** — web stacks are Claude Code's strongest area; one repo, one language | ✅ **Recommended** |
| Pure browser SPA (IndexedDB/localStorage) | Low | **Poor** — storage is cleared on cache-clear, hard to back up, not human-readable | High | ❌ fails P2 |
| Electron desktop app | Medium | High | Medium — heavyweight packaging/updates; doesn't solve phone-in-kitchen | ❌ maintenance cost not worth it |
| Native macOS (Swift) / native mobile | High to build; great on its one device | Medium — export/backup more awkward, OS-specific | **Low** — single-platform lock-in, harder for you to maintain | ❌ fails P3 |
| Python + desktop UI (Tkinter/PyQt) | Medium-high — clunky UIs; no phone access | High (SQLite) | Medium — logic is easy in Python but the UI layer fights you | ❌ fails P1 |
| CLI | High for browsing/cooking | High | High | ❌ fails P1 |

### 1.2 Recommendation

Build **Pantry as a locally-run web application**, accessed in a browser on your computer (`localhost`) and on your phone via your machine's LAN address, installable as a **PWA** so it feels like a real app on the phone home screen.

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router) + React + TypeScript** | One repo for UI + server; Claude Code's most reliable framework; huge component ecosystem lowers UI effort |
| Styling / components | **Tailwind CSS + shadcn/ui** | Polished, accessible components out of the box → low-friction UI without hand-rolling everything |
| Storage | **SQLite** (file: `data/pantry.db`) | ACID-reliable, single-file, trivially backed up, queryable, ubiquitous |
| DB access | **Drizzle ORM** (`better-sqlite3` driver) | Lightweight, type-safe, schema-as-code that's easy to read and extend; first-class migrations |
| Validation | **Zod** | One schema source for forms, API boundaries, and import parsing |
| Tests | **Vitest** | Fast unit tests for the domain logic in §5 (the correctness-critical part) |
| Charts | **Recharts** | For the price-history sparkline/range chart |

> **Drop-in alternative:** swap Drizzle for **Prisma** if you'd value **Prisma Studio** (a free GUI to browse/verify your data — a nice reliability perk). The schema in §2 is shown in Drizzle; the mapping is mechanical.
>
> **Lighter-weight alternative considered:** SvelteKit (less boilerplate). Rejected only because React/Next has more Claude Code training data and a richer component ecosystem, which de-risks P3 and lowers P1 build effort.

### 1.3 Why this fits your priorities

- **P1 — low day-to-day friction.** The three daily actions (add a recipe, decide what's for dinner, log a grocery purchase) are all fast in a browser, and the **phone access** means the recipe and a "cooking mode" view are with you at the stove. PWA install makes it one tap from the home screen.
- **P2 — data reliability.** SQLite in **WAL mode** is crash-safe. The app keeps **automated timestamped backups** of the `.db` file and supports **full JSON export/import** (human-readable). Your recipes and inventory live in a single portable file you control.
- **P3 — maintainable solo with Claude Code.** One language (TypeScript) across the stack, a conventional Next.js structure Claude Code knows well, and all the tricky math isolated into **pure, tested functions** you can read and modify without touching the UI.

### 1.4 How you run and use it

- **Develop:** `npm run dev` → open `http://localhost:3000`.
- **Run it "for real":** `npm run build && npm start` on an always-on machine (your desktop, a spare laptop, or a Raspberry Pi). Access from any device on your network at `http://<machine-ip>:3000`.
- **On your phone:** open that URL once, then "Add to Home Screen" → it launches full-screen like an app (PWA).
- **No accounts, no cloud.** Everything stays on your machine.

---

## 2. Data Models

### 2.1 Entity relationships

```
Ingredient (master) ──1:N── RecipeIngredient ──N:1── Recipe ──1:N── (steps: JSON column)
        │                                                  │
        ├──1:N── InventoryItem ──N:1── StorageLocation     └──N:M── Tag  (via RecipeTag)
        │
        ├──1:N── PriceEntry
        │
Recipe ──1:N── CookLog ──1:N── CookLogLine
Settings (single row)
```

The **`Ingredient` master table is the hub.** Recipes reference ingredients (not free-text strings), and inventory + prices attach to the same ingredient records. This is what makes cost calculation, "I made this" deduction, and recommendations possible — they all join on `ingredientId`.

### 2.2 Core value objects (domain, not DB tables)

```ts
// lib/domain/units.ts
export type UnitCategory = "volume" | "mass" | "count";
export type UnitSystem  = "metric" | "imperial";

export interface UnitDef {
  id: string;            // "tbsp", "g", "cup", "each"...
  label: string;         // display label
  category: UnitCategory;
  system: UnitSystem | "either";
  toBase: number;        // multiply to convert to the category base (ml for volume, g for mass, 1 for count)
}

// A quantity is amount + unit, with support for ranges and non-numeric descriptors.
export interface Quantity {
  amount: number | null;   // null => non-numeric (e.g. "to taste")
  amountMax?: number | null; // for ranges, e.g. 2–3 tbsp
  unit: string | null;      // UnitDef.id, or null for counts / non-numeric
  raw?: string | null;      // original descriptor when non-numeric ("a pinch", "to taste")
  approximate?: boolean;    // true for "pinch", "to taste", etc. → never scaled
}
```

> See the **Appendix** for the full `UNITS` factor table and default densities.

### 2.3 Drizzle schema

```ts
// lib/db/schema.ts
import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";

// ---- Step type embedded as JSON on the recipe (see modeling note 2.4.a) ----
export interface StepQuantity {
  ingredientId: number | null; // link to master ingredient (enables conversion display)
  amount: number;
  amountMax?: number | null;
  unit: string | null;         // UnitDef.id
}
export interface Step {
  id: string;                  // stable within the recipe (nanoid)
  text: string;                // may contain {q1}, {q2}... placeholders
  quantities?: Record<string, StepQuantity>; // keyed by placeholder name
}

export const ingredients = sqliteTable("ingredients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  category: text("category"),                 // 'produce' | 'dairy' | 'meat' | 'pantry' | 'spice' | ...
  defaultUnit: text("default_unit"),          // canonical unit used when normalizing prices/inventory
  density: real("density"),                   // grams per millilitre; optional, enables volume<->weight
  isStaple: integer("is_staple", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const recipes = sqliteTable("recipes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  steps: text("steps", { mode: "json" }).$type<Step[]>().notNull().default([]),
  prepTimeMin: integer("prep_time_min"),      // totalTime is derived = prep + cook
  cookTimeMin: integer("cook_time_min"),
  baseServings: real("base_servings").notNull().default(1),
  notes: text("notes"),
  isFavorite: integer("is_favorite", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const recipeIngredients = sqliteTable("recipe_ingredients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  recipeId: integer("recipe_id").notNull().references(() => recipes.id, { onDelete: "cascade" }),
  ingredientId: integer("ingredient_id").notNull().references(() => ingredients.id),
  amount: real("amount"),                     // null => non-numeric (raw holds "to taste")
  amountMax: real("amount_max"),              // ranges
  unit: text("unit"),                         // UnitDef.id, or null for counts
  raw: text("raw"),                           // non-numeric descriptor
  prep: text("prep"),                         // "finely diced", optional
  optional: integer("optional", { mode: "boolean" }).notNull().default(false),
  displayOrder: integer("display_order").notNull().default(0),
}, (t) => ({ byRecipe: index("ri_recipe_idx").on(t.recipeId) }));

export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
});
export const recipeTags = sqliteTable("recipe_tags", {
  recipeId: integer("recipe_id").notNull().references(() => recipes.id, { onDelete: "cascade" }),
  tagId: integer("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
});

export const storageLocations = sqliteTable("storage_locations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),      // 'Fridge', 'Freezer', 'Pantry', ...
  sortOrder: integer("sort_order").notNull().default(0),
});

export const inventoryItems = sqliteTable("inventory_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ingredientId: integer("ingredient_id").notNull().references(() => ingredients.id),
  locationId: integer("location_id").references(() => storageLocations.id),
  quantity: real("quantity").notNull(),
  unit: text("unit").notNull(),               // UnitDef.id
  expiryDate: integer("expiry_date", { mode: "timestamp" }),
  openedDate: integer("opened_date", { mode: "timestamp" }),
  notes: text("notes"),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (t) => ({ byIngredient: index("inv_ing_idx").on(t.ingredientId) }));

export const priceEntries = sqliteTable("price_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ingredientId: integer("ingredient_id").notNull().references(() => ingredients.id),
  price: real("price").notNull(),             // total paid, in the configured currency
  quantity: real("quantity").notNull(),       // for THIS much...
  unit: text("unit").notNull(),               // ...of THIS unit  → unit price = price / quantity (then normalized)
  store: text("store"),
  purchasedAt: integer("purchased_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (t) => ({ byIngredient: index("price_ing_idx").on(t.ingredientId) }));

export const cookLogs = sqliteTable("cook_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  recipeId: integer("recipe_id").references(() => recipes.id, { onDelete: "set null" }),
  recipeName: text("recipe_name"),            // snapshot, survives recipe deletion
  servingsMade: real("servings_made").notNull(),
  totalCost: real("total_cost"),              // cost snapshot at time of cooking (nullable)
  cookedAt: integer("cooked_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  notes: text("notes"),
});
export const cookLogLines = sqliteTable("cook_log_lines", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cookLogId: integer("cook_log_id").notNull().references(() => cookLogs.id, { onDelete: "cascade" }),
  inventoryItemId: integer("inventory_item_id"), // which item was decremented (nullable if later deleted)
  ingredientId: integer("ingredient_id").notNull(),
  amountDeducted: real("amount_deducted").notNull(),
  unit: text("unit").notNull(),
});

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey().default(1),  // single row
  unitSystem: text("unit_system").notNull().default("imperial"),   // 'metric' | 'imperial'
  priceMode: text("price_mode").notNull().default("average"),      // 'current' | 'average'
  averageWindowMonths: integer("average_window_months").notNull().default(6), // 3–6
  currency: text("currency").notNull().default("USD"),
  roundingMode: text("rounding_mode").notNull().default("cooking"), // 'cooking' | 'exact'
});
```

### 2.4 Key modeling decisions

- **(a) Steps as a JSON column, ingredients as a table.** Recipe steps are always loaded with their recipe and never queried independently, so a JSON array (`Step[]`) keeps ordering and editing trivial. Recipe *ingredients*, by contrast, must join to the `Ingredient` master for cost/inventory/recs — so they are a proper table. *(If you prefer fully relational steps, a `recipe_steps` table with a `position` column is a clean swap.)*
- **(b) Inline step quantities are structured, not parsed from prose.** A step stores text with `{q1}` placeholders plus a `quantities` map. This is the linchpin of safe scaling/conversion — see §3.2 and §5.1. It means the app *knows* which numbers are scalable amounts, so it never accidentally scales an oven temperature or a resting time.
- **(c) Prices store `price for quantity of unit`.** Unit price is derived (`price / quantity`, normalized via §5.2). Storing it raw lets you record exactly what the receipt said ("$4.50 for 1 kg") without pre-dividing.
- **(d) `CookLog` + `CookLogLine` exist for history *and* undo.** Recording each deduction line lets "I made this" be reversed cleanly (mis-clicks happen).
- **(e) Snapshots on cook logs** (`recipeName`, `totalCost`) preserve history even if the recipe is later edited or deleted.

---

## 3. Feature Specifications

> Format for each: **What it does · How the UI presents it · Edge cases · Implementation notes.**

### 3.1 Recipe Repository

**What it does.** Stores recipes (name, description, ingredients with amounts/units, ordered steps, prep/cook time, servings, tags, notes). Supports search and filtering by name, tag, ingredient, and max cook time.

**UI.**
- *Recipes list:* a search box + filter chips (tags, "max cook time", "makeable now" toggle — see §3.8). Each card shows name, total time, per-serving cost (§3.7), last-made date, and a favorite star.
- *Recipe detail:* header (times, **servings stepper**, cost, "I made this", Edit, Cook mode), ingredient list, steps, tags, notes.
- *Recipe editor:* fields for name/description/times/servings/tags; ingredient rows (typeahead → master ingredient, amount, unit dropdown, optional/prep toggles); step editor with the quantity-linking assist (§3.2); optional **Import** entry point (§7).

**Edge cases.**
- Ingredient typed that doesn't exist yet → inline "Create '<name>'" in the typeahead (creates a master `Ingredient`).
- Near-duplicate ingredient names ("tomato" vs "tomatoes") → handled by the **merge tool** in Settings (§7) and by surfacing close matches in the typeahead.
- Non-numeric amounts ("to taste", "a pinch") → stored in `raw`, `amount = null`, never scaled.
- Ranges ("2–3 cloves") → `amount`/`amountMax`.

**Implementation notes.** Total time is derived (`prepTimeMin + cookTimeMin`), not stored. Search: SQLite `LIKE` is fine at personal scale; for nicer fuzzy search add an FTS5 virtual table later. Filter "by ingredient" joins `recipeIngredients`.

### 3.2 Serving Scaler — *including inline step text* (the hard one)

**What it does.** Changing the target servings recalculates every ingredient amount **and** every quantity mentioned inside the step text (e.g. doubling turns "add 2 tbsp butter" into "add 4 tbsp butter"), while **never** altering times, temperatures, or other incidental numbers.

**Why the naive approach is wrong.** Regex-scaling every number in a step is unsafe: "Bake at 350°F for 20 minutes" must not become "Bake at 700°F for 40 minutes." The robust solution is to make scalable quantities **structured** (the `{qN}` placeholders + `quantities` map from §2.3). Because the app knows exactly which spans are amounts, scaling and unit conversion become deterministic and correct. Everything else in the text is literal and untouched.

**UI.**
- A **servings stepper** (− / value / +, plus a quick "×2 / ×½" and a "reset to original") on the recipe detail.
- Ingredient list and steps re-render instantly. Scaled amounts are formatted nicely (½, 1¾ in imperial; rounded grams/ml in metric — §5.3).
- **Authoring assist** in the step editor: as you type or paste a step, detected amount spans (number + known unit) are underlined; click one to convert it into a linked `{qN}` placeholder (it auto-suggests the matching ingredient from this recipe's list). One click = friction-free linking.

**Edge cases.**
- Non-numeric / approximate amounts ("to taste") → displayed unchanged at any scale.
- Ranges → both ends scale.
- Fractional results → formatted to friendly fractions (imperial) or sensible decimals (metric).
- **Untokenized legacy steps** (typed quickly, not linked) → a clearly-labeled, opt-in **best-effort fallback** scales only `number + measurement-unit` spans and explicitly skips anything followed by a time or temperature word (§5.1). The UI nudges you to "link quantities for exact scaling."
- Scaling never mutates stored data — it's a pure render-time transform over the base recipe.

**Implementation notes.** Scale factor = `targetServings / baseServings`. See §5.1 for the exact rendering pipeline. Keep this entirely in `lib/domain` and unit-test it hard.

### 3.3 Unit Conversion (imperial ↔ metric)

**What it does.** Converts amounts between imperial and metric in both the ingredient list and the step text. Handles volume (tsp, tbsp, cup, fl oz, ml, L) and mass (oz, lb, g, kg).

**UI.** A global unit-system toggle (metric / imperial / "as written") in Settings and a quick toggle on the recipe detail. Conversions render live, same as scaling.

**Edge cases.**
- **`oz` (mass) vs `fl oz` (volume)** are distinct units — never conflated.
- **Within-category** conversions (cup↔ml, oz↔g, lb↔kg) are exact and density-free — this covers essentially all the imperial↔metric pairs you listed.
- **Cross-category** (e.g. "1 cup flour" → grams) requires the ingredient's **density** (`g/ml`). If density is set on the ingredient, the app converts; if not, it keeps the original unit and **flags** that a weight/volume conversion needs a density. (Densities are optional and seeded for common items — see Appendix.)
- "cooking" rounding mode rounds to friendly values (1 cup ≈ 240 ml, 1 tbsp ≈ 15 ml); "exact" uses precise factors. Default: cooking.

**Implementation notes.** All conversion goes through one `convert()` function (§5.2). Step-text conversion is just re-rendering `{qN}` placeholders in the target system — same code path as the list.

### 3.4 Ingredient Inventory

**What it does.** Tracks ingredients across storage locations (fridge/freezer/pantry/…) with current quantity, unit, and optional expiry date. Manual add/edit/remove.

**UI.**
- *Inventory screen:* grouped by location (collapsible sections). Each row: ingredient, quantity + unit, expiry (with a colored "use soon"/"expired" badge), and a small price summary (range + average, §3.5). Highlights for low/expiring items at the top.
- *Add/edit item:* ingredient typeahead, quantity, unit, location, optional expiry/opened date, notes.
- *Log purchase* flow (also reachable from the dashboard): pick ingredient(s), quantity, unit, location, price paid, store → writes both an `InventoryItem` (adds to stock) **and** a `PriceEntry`. This is the everyday "I just got back from the store" action.

**Edge cases.**
- Same ingredient in two locations → two rows (both count toward recommendations/cost).
- Unit on inventory differs from a recipe's unit → reconciled via conversion at deduction/cost time; unconvertible pairs (e.g. inventory in "each", recipe in grams, no density) are flagged.
- Quantity hitting zero → keep the row at 0 (so price history and location persist) or offer "remove"; default keep at 0 with a subtle "out of stock" tag.

**Implementation notes.** Inventory units should be consistent with or convertible to recipe units; the UI defaults a new item's unit to the ingredient's `defaultUnit`.

### 3.5 Price Tracking

**What it does.** Stores multiple dated price entries per ingredient, shows a **price range over the last 3–6 months**, and computes an **average**. Average and current price both feed the cost calculator.

**UI.**
- On each inventory row and on the **ingredient detail** view: "low–high" range, average, latest, and a small Recharts line/sparkline over the window. Source store shown per point on hover.
- Add price via the *log purchase* flow or directly on ingredient detail.

**Edge cases.**
- Entries recorded in different units (e.g. "$4.50/kg" once, "$0.50/100g" another) → all normalized to the ingredient's `defaultUnit` before ranging/averaging (§5.4).
- Sparse data (1 entry) → show that single value, no misleading "range".
- Window with no entries → "no recent prices; showing all-time" fallback.

**Implementation notes.** Unit price for an entry = `price / quantity`, then converted into the ingredient's `defaultUnit`. Average = mean of normalized unit prices within `averageWindowMonths`. Keep min/max for the range badge.

### 3.6 "I Made This" (automatic inventory deduction)

**What it does.** One click on a recipe marks it cooked and deducts the ingredient amounts used from inventory, with full unit reconciliation. Records a `CookLog` (with per-line detail) for history and **undo**.

**UI.**
- "I made this" button on recipe detail. Clicking opens a small confirm dialog: **servings actually made** (defaults to the currently-displayed servings), and a preview of what will be deducted (with any warnings). Confirm → deduct + log; a toast offers **Undo**.

**Edge cases (the meat of this feature).**
- **Insufficient stock** → warn and (configurable) either clamp to 0 or allow negative; default: clamp to 0 and flag "ran low on X".
- **Ingredient not in inventory** → skip that line, note it ("X not in inventory — not deducted").
- **Unit unconvertible** (no density bridging volume↔mass) → skip + flag.
- **Multiple inventory rows for one ingredient** (across locations) → deduct from a chosen location, defaulting to **soonest-expiry first** (FIFO-by-expiry), spilling to the next row if needed.
- **Staple ingredients** (salt, water) → optionally not tracked precisely; deduct only if a tracked quantity exists.
- **Undo** → reads `CookLogLine`s and adds the amounts back to the exact inventory items.

**Implementation notes.** Run the whole deduction inside a single SQLite transaction so a partial failure can't corrupt inventory. Snapshot the computed cost onto the `CookLog`.

### 3.7 Recipe Cost Calculator

**What it does.** Estimates a recipe's cost from `amount used × price-per-unit` for each ingredient, showing **per-serving** and **total batch** cost, and clearly flagging ingredients with no price data.

**UI.** On recipe detail: a cost summary ("≈ $1.85 / serving · $7.40 total"), expandable to a per-ingredient breakdown. Ingredients with missing/unconvertible prices are listed under "cost unknown for: …" so the total is honest about what it excludes. Also surfaced compactly on recipe cards and as a recommendation sort key.

**Edge cases.**
- **No price data** → exclude from total, list under "unknown", show count.
- **Price unit ≠ recipe unit** → convert (within category, or via density); if impossible → flag as unconvertible.
- **`current` vs `average` price** → per the `priceMode` setting; average uses the 3–6 month window.
- **Per-serving cost is scale-invariant** (linear scaling), which is a useful built-in correctness check; total batch cost scales with servings.

**Implementation notes.** See §5.4. Compute on base servings and scale; surface both numbers.

### 3.8 Recipe Recommendations (bonus)

**What it does.** Given current inventory, suggests recipes you can make fully or partially. Sortable by: **most ingredients available**, **soonest-expiring ingredients used first**, or **lowest cost**. Flags recipes missing only 1–2 ingredients.

**UI.** A "What can I make?" view (and a dashboard widget). Each result shows coverage ("8/10 ingredients"), the **missing** items, an "almost there" badge for 1–2 missing, and a quick "add missing to shopping list" action (§7).

**Edge cases.**
- **Optional ingredients** (`optional = true`) don't count against makeability.
- **Staples** (`isStaple = true`) are assumed available and excluded from "missing".
- **Unit-unconvertible** required ingredient → treated as "unknown availability" and flagged rather than silently counted.
- Recipe with zero required (all optional/staple) → trivially makeable.

**Implementation notes.** See §5.5 for coverage + the three sort scorings.

---

## 4. Application Architecture

### 4.1 Layered design

Three clean layers, with the rule that **domain logic has no I/O**:

1. **Presentation** (`app/`, `components/`) — React Server Components render reads by calling the data layer directly in server context; mutations go through server actions / route handlers that call services.
2. **Domain** (`lib/domain/`) — *pure, framework-agnostic, fully unit-tested* functions: units, scaling, quantity formatting, cost, recommendations. **This is the heart of the app and the part you'll extend most.**
3. **Data** (`lib/db/`, `lib/services/`) — Drizzle schema + client; services orchestrate domain + DB (e.g. `cookThisRecipe()`, `importRecipe()`, `priceSummary()`).

### 4.2 File / folder structure

```
pantry/
  src/
    app/                      # Next.js App Router
      page.tsx                # Dashboard
      recipes/
        page.tsx              # list + search/filter
        [id]/page.tsx         # recipe detail (servings stepper, cost, "I made this")
        [id]/cook/page.tsx    # cooking mode (large text, screen-awake)
        new/page.tsx, [id]/edit/page.tsx
      inventory/page.tsx
      ingredients/[id]/page.tsx   # price history, where stored, recipes using it
      shopping/page.tsx
      settings/page.tsx
      api/                    # route handlers for mutations & export/import
    components/               # shadcn/ui-based components (RecipeCard, ServingStepper, QuantityText, PriceChart, ...)
    lib/
      db/
        schema.ts             # §2.3
        client.ts             # better-sqlite3 + drizzle, WAL pragma
        migrate.ts
      domain/
        units.ts              # UNITS table + convert() (§5.2)
        quantity.ts           # formatQuantity() (§5.3)
        scaling.ts            # scaleRecipe(), renderStep() (§5.1)
        cost.ts               # recipeCost(), unitPrice(), priceSummary() (§5.4)
        recommend.ts          # recommendRecipes() (§5.5)
        __tests__/            # Vitest specs for ALL of the above
      services/
        cook.ts               # cookThisRecipe(), undoCook()  (transactional)
        import.ts             # parseRecipeText() / parseWithClaude() (§7)
        backup.ts, export.ts
      validation/             # Zod schemas shared by forms + API + import
  drizzle/                    # generated migrations
  data/                       # pantry.db (gitignored) + backups/
  scripts/                    # seed.ts, backup.ts, export.ts
```

### 4.3 Data flow

- **Read:** Server Component → `lib/db` query (+ `lib/domain` transforms like cost/scaling) → rendered HTML. The browser stays thin.
- **Write:** form/button → server action or `api/` route → `lib/services` (validates with Zod, runs domain logic, writes via Drizzle in a transaction) → revalidate the affected route.
- **Live scaling/unit toggle:** handled client-side by passing the base recipe + the current servings/system into pure `lib/domain` functions — no server round-trip, so it feels instant.

### 4.4 Testing strategy

Unit-test the **domain layer** with Vitest: conversion correctness (round-trips, oz vs fl oz, density bridging), scaling (fractions, ranges, "to taste", time/temperature left alone), step rendering, cost (missing/unconvertible prices, current vs average), and recommendation coverage/sorting. These are the correctness-critical bits (P2) and they're cheap to test because they're pure.

### 4.5 Backups & export/import (reliability, P2)

- **SQLite in WAL mode** (`PRAGMA journal_mode = WAL`) for crash safety.
- **Automated backups:** a `scripts/backup.ts` (run on app start and/or daily) copies `pantry.db` to `data/backups/pantry-YYYYMMDD-HHmm.db`, keeping the last N.
- **Export/Import:** Settings offers "Export all data" → a single human-readable JSON file (recipes, ingredients, inventory, prices, logs), and "Import" to restore. This is your portable, inspectable backup and your migration path.

### 4.6 Sync-enabler invariants (forward-looking, P3)

These exist so a future iPhone companion/sync feature stays cheap; see
[pantry-mobile-sync-feasibility.md](pantry-mobile-sync-feasibility.md) §7. **No sync is
built** — these are just invariants new data-layer code must preserve:

- **`publicId` (sync identity).** Every independently-syncable entity carries a
  `publicId` (`text`, unique, `$defaultFn(newPublicId)` from `lib/db/ids.ts`) alongside its
  local integer `id`. Local `id` is for joins within one database; `publicId` is the stable
  id that travels across databases. Aggregate children (`recipe_ingredients`,
  `recipe_tags`, `cook_log_lines`) and the `settings` singleton intentionally have none —
  they travel with their parent / are special-cased.
- **Tombstones (deletion log).** A hard delete leaves no trace for a peer to replay, so
  **every user-facing delete records a row in `tombstones`** via `recordTombstone(tx, …)` /
  `recordTombstones(tx, …)` (`lib/db/tombstones.ts`), inside the same transaction as the
  delete. Two rules: (a) cascade-deleted children that have their own `publicId` must be
  tombstoned explicitly (SQLite FK cascade won't do it); (b) **wholesale-replace deletes are
  NOT deletions** — e.g. `updateRecipe` deletes & re-inserts `recipe_ingredients`/`recipe_tags`
  as an edit mechanism and must never tombstone them, or every edit churns the log.
- **`updatedAt` everywhere syncable.** Mutable syncable tables carry a maintained
  `updatedAt` (for a future last-write-wins merge). Bump it manually in update paths, as the
  existing code already does (`updatedAt: new Date()`).
- **Connection injection (convention, not yet done).** New data-access code should be
  written so it can later accept an injected connection rather than hard-importing the `db`
  singleton from `lib/db/client.ts` — a standalone phone app has no server and must run the
  data layer against an on-device handle. Existing `lib/db/*.ts` are intentionally left
  as-is until the mobile effort starts; just don't add *new* hard singleton dependencies.

---

## 5. Key Algorithms

### 5.1 Serving scaler + inline step rewriting

```ts
// lib/domain/scaling.ts
import { convert } from "./units";
import { formatQuantity } from "./quantity";

export function scaleFactor(base: number, target: number) {
  return base > 0 ? target / base : 1;
}

// Ingredient list: scale numeric amounts (and range max); leave non-numeric ("to taste") alone.
export function scaleIngredientAmount(amount: number | null, amountMax: number | null, factor: number) {
  return {
    amount: amount == null ? null : amount * factor,
    amountMax: amountMax == null ? null : amountMax * factor,
  };
}

// Step rendering: substitute {qN} placeholders with scaled + converted + formatted amounts.
// Literal numbers in the prose (times, temperatures) are NOT placeholders, so they are untouched.
export function renderStep(step: Step, factor: number, system: UnitSystem,
                           densityFor: (id: number | null) => number | undefined): string {
  if (!step.quantities) return maybeFallbackScale(step.text, factor, system); // see below
  return step.text.replace(/\{(\w+)\}/g, (_, key) => {
    const q = step.quantities![key];
    if (!q) return `{${key}}`;
    const scaled = q.amount * factor;
    const max = q.amountMax != null ? q.amountMax * factor : null;
    const display = toSystem({ amount: scaled, amountMax: max, unit: q.unit },
                             system, densityFor(q.ingredientId));
    return formatQuantity(display, system); // e.g. "4 tbsp" or "60 ml" or "2–3 cups"
  });
}

// CONSERVATIVE fallback for steps that were never tokenized (opt-in, clearly labeled).
// Scales ONLY <number><measurement-unit> spans. Skips anything followed by time/temperature words.
const MEASURE = /(\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?|\d+\s+\d+\/\d+|\d+\/\d+|[½⅓⅔¼¾⅛⅜⅝⅞])\s*(cups?|tbsp|tablespoons?|tsp|teaspoons?|fl\s?oz|ounces?\s+\(fl\)|ml|millilit(?:re|er)s?|l|lit(?:re|er)s?|oz|ounces?|lb|lbs|pounds?|g|grams?|kg|kilograms?)\b/gi;
// NOTE: a separate guard rejects matches where the trailing token is a time/temp unit
// (min, minute, hour, sec, second, °, degree(s), F, C). Implement as a negative check, not in the regex above.
```

The fallback exists only so quickly-typed recipes degrade gracefully; the **primary, reliable path is the `{qN}` placeholders**. The authoring assist (§3.2) turns detected `MEASURE` spans into placeholders on one click, so most recipes end up fully structured.

### 5.2 Unit conversion (+ density bridging)

```ts
// lib/domain/units.ts
export class UnconvertibleError extends Error {
  constructor(public from: string | null, public to: string | null) {
    super(`Cannot convert ${from} → ${to} (different categories and no density).`);
  }
}

export function convert(value: number, from: string, to: string, densityGperMl?: number): number {
  const f = UNITS[from], t = UNITS[to];
  if (!f || !t) throw new UnconvertibleError(from, to);
  if (f.category === t.category) {
    return (value * f.toBase) / t.toBase;              // same category → exact
  }
  if (densityGperMl) {                                  // bridge volume <-> mass via density
    if (f.category === "volume" && t.category === "mass")
      return ((value * f.toBase) * densityGperMl) / t.toBase;   // ml → g → target mass
    if (f.category === "mass" && t.category === "volume")
      return ((value * f.toBase) / densityGperMl) / t.toBase;   // g → ml → target volume
  }
  throw new UnconvertibleError(from, to);
}
```

`toSystem()` (used by step/list rendering) picks a sensible target unit in the requested system and converts to it (e.g. metric volume small → ml, large → L; mass small → g, large → kg), preserving the unit when conversion is impossible and surfacing a flag.

### 5.3 Quantity formatting

```ts
// lib/domain/quantity.ts
const FRACTIONS: [number, string][] = [
  [0.125,"⅛"],[0.25,"¼"],[0.333,"⅓"],[0.375,"⅜"],[0.5,"½"],
  [0.625,"⅝"],[0.667,"⅔"],[0.75,"¾"],[0.875,"⅞"],
];

export function formatQuantity(q: Quantity, system: UnitSystem): string {
  if (q.amount == null) return q.raw ?? "";              // "to taste"
  const fmt = (n: number) => system === "imperial" ? toFriendlyFraction(n) : toMetricNumber(n, q.unit);
  const main = fmt(q.amount);
  const range = q.amountMax != null ? `–${fmt(q.amountMax)}` : "";
  return `${main}${range}${q.unit ? " " + (UNITS[q.unit]?.label ?? q.unit) : ""}`.trim();
}

function toFriendlyFraction(n: number): string {        // 1.75 → "1¾", 0.5 → "½"
  const whole = Math.floor(n); const frac = n - whole;
  let best = ""; let bestErr = 0.06;
  for (const [v, g] of FRACTIONS) if (Math.abs(frac - v) < bestErr) { best = g; bestErr = Math.abs(frac - v); }
  if (!best) return (Math.round(n * 100) / 100).toString();
  return whole > 0 ? `${whole}${best}` : best;
}

function toMetricNumber(n: number, unit: string | null): string {
  // round grams/ml to whole, kg/L to 2dp (tune in "cooking" mode)
  if (unit === "g" || unit === "ml") return Math.round(n).toString();
  return (Math.round(n * 100) / 100).toString();
}
```

### 5.4 Cost calculation

```ts
// lib/domain/cost.ts
export interface LineCost { ingredientId: number; cost: number | null; reason?: "no-price" | "unconvertible"; }

export function unitPrice(entries: PriceEntry[], ingredient: Ingredient, mode: "current"|"average",
                          windowMonths: number, now: Date): number | null {
  const normalized = entries
    .map(e => {
      try { const perUnit = e.price / e.quantity;                       // price per 1 of e.unit
            const factor = convert(1, e.unit, ingredient.defaultUnit!, ingredient.density ?? undefined);
            return { date: e.purchasedAt, perDefaultUnit: perUnit / factor }; }
      catch { return null; }                                            // unconvertible price unit → drop
    })
    .filter(Boolean) as { date: Date; perDefaultUnit: number }[];
  if (!normalized.length) return null;
  if (mode === "current") return normalized.sort((a,b)=>+b.date-+a.date)[0].perDefaultUnit;
  const since = monthsAgo(now, windowMonths);
  const win = normalized.filter(x => x.date >= since);
  const pool = win.length ? win : normalized;                          // fallback to all-time
  return pool.reduce((s,x)=>s+x.perDefaultUnit,0) / pool.length;
}

export function recipeCost(ri: RecipeIngredient[], priceByIng: Map<number, number|null>,
                           ingById: Map<number, Ingredient>, servings: number) {
  let total = 0; const lines: LineCost[] = []; const unknown: number[] = [];
  for (const r of ri) {
    if (r.optional) continue;                                          // optionals excluded from estimate
    const price = priceByIng.get(r.ingredientId);                      // already in ingredient.defaultUnit
    const ing = ingById.get(r.ingredientId)!;
    if (price == null || r.amount == null) { unknown.push(r.ingredientId); lines.push({ingredientId:r.ingredientId,cost:null,reason:"no-price"}); continue; }
    try {
      const amtInDefault = convert(r.amount, r.unit!, ing.defaultUnit!, ing.density ?? undefined);
      const cost = amtInDefault * price; total += cost;
      lines.push({ ingredientId: r.ingredientId, cost });
    } catch { unknown.push(r.ingredientId); lines.push({ingredientId:r.ingredientId,cost:null,reason:"unconvertible"}); }
  }
  return { total, perServing: servings > 0 ? total / servings : total, lines, unknownIngredientIds: unknown };
}
```

### 5.5 Recipe recommendation scoring

```ts
// lib/domain/recommend.ts
export function recommendRecipes(recipes: RecipeWithIngredients[], inventory: InventoryItem[],
                                 ingById: Map<number, Ingredient>, sort: "available"|"expiring"|"cost",
                                 costByRecipe: Map<number, number|null>) {
  const stockByIng = aggregateStock(inventory, ingById);              // ingredientId → { qty, unit } per category

  const scored = recipes.map(rec => {
    const required = rec.ingredients.filter(i => !i.optional && !ingById.get(i.ingredientId)?.isStaple);
    const missing: number[] = []; let unknownUnits = 0;
    for (const req of required) {
      const stock = stockByIng.get(req.ingredientId);
      if (!stock) { missing.push(req.ingredientId); continue; }
      try {
        const have = convert(stock.qty, stock.unit, req.unit!, ingById.get(req.ingredientId)?.density ?? undefined);
        if (have < (req.amount ?? 0)) missing.push(req.ingredientId);
      } catch { unknownUnits++; missing.push(req.ingredientId); }     // can't compare → treat as missing + flag
    }
    const coverage = required.length ? (required.length - missing.length) / required.length : 1;
    return { recipe: rec, coverage, missing, almost: missing.length >= 1 && missing.length <= 2,
             makeable: missing.length === 0, expiryUrgency: expiryScore(rec, inventory, ingById),
             cost: costByRecipe.get(rec.id) ?? Infinity, unknownUnits };
  });

  const cmp = {
    available: (a,b) => b.coverage - a.coverage || a.missing.length - b.missing.length || a.cost - b.cost,
    expiring:  (a,b) => Number(b.makeable) - Number(a.makeable) || b.expiryUrgency - a.expiryUrgency,
    cost:      (a,b) => Number(b.makeable) - Number(a.makeable) || a.cost - b.cost,
  }[sort];
  return scored.sort(cmp);
}

// expiryScore: sum of urgency over the recipe's ingredients that exist in inventory,
// where urgency rises as expiry approaches within a window (e.g. (windowDays - daysLeft)/windowDays, clamped ≥ 0).
```

---

## 6. UI/UX Outline

### 6.1 Navigation

Persistent **sidebar on desktop**, **bottom tab bar on mobile** (PWA): **Home · Recipes · Inventory · Shopping · Settings.** A global "+" quick-action (Add recipe / Log purchase) is always reachable.

### 6.2 Screens

- **Dashboard / Home** — built around "what's for dinner": quick actions (Add recipe, Log purchase, What can I make?), a **"use soon"** strip of expiring inventory, **suggested recipes** from current stock, and **recently made**.
- **Recipes list** — search + filter chips (tags, max cook time, "makeable now"); cards with name, total time, $/serving, last-made, favorite.
- **Recipe detail** — header with times, **servings stepper**, **unit-system toggle**, cost summary, **"I made this"**, **Cook mode**, Edit. Ingredient list and steps re-render live as you scale/convert. Notes + tags below.
- **Cooking mode** — distraction-light, large type, step-by-step, screen kept awake; ingredient amounts reflect the chosen servings/units.
- **Recipe editor** — metadata + ingredient rows (typeahead → master, amount, unit, optional/prep) + step editor with **quantity-linking assist** + optional **Import** (paste / Claude).
- **Inventory** — grouped by location; quantity/unit, expiry badges, price summary; add/edit/remove; **Log purchase** flow.
- **Ingredient detail** — price-history chart (range + average over 3–6 months), where it's stored, recipes that use it, density field.
- **Shopping list** — items (often auto-added from "missing" in recommendations), check off while shopping, **"add purchased to inventory"** (which also records prices) — closing the loop.
- **Settings** — unit system, price mode + window, currency, rounding, locations, **ingredient merge/dedupe**, export/import, backups.

### 6.3 The three daily flows (optimized)

- **Add a recipe** — "+", fill metadata, type ingredients with typeahead (create-on-the-fly), paste steps and one-click-link quantities (or use **Import** to skip most typing). Save.
- **What's for dinner** — open Home → glance at suggestions and "use soon" → tap a recipe → set servings → Cook mode. Two or three taps.
- **Log a grocery purchase** — "+ Log purchase" → pick items, quantity, unit, location, price, store → one save updates **inventory and price history** together.

---

## 7. Suggested Additional Features

**High-value, recommended (fit naturally, low bloat):**

- **Claude-assisted recipe import.** Paste raw recipe text (or a URL's text) and call the Anthropic Messages API to return structured JSON: ingredients with amounts/units **and steps with `{qN}` quantities already linked**. This removes the single biggest friction point (manual entry) *and* elegantly solves step tokenization. Keep a manual path so the app fully works without it; gate the API behind an optional key in Settings.
- **Shopping list (loop-closing).** Auto-populate from recommendation "missing" lists or from low-stock thresholds; check off while shopping; "add purchased to inventory" writes stock + prices. Turns three separate chores into one.
- **Cooking mode.** Large-text, screen-awake, step-by-step view that respects the chosen servings/units. Big win for the at-the-stove use case (P1).
- **Expiry / "use soon" dashboard + recommendation weighting.** Reuses expiry data you already track; reduces waste.
- **Favorites, ratings, "times cooked" & "last made"** (from `CookLog`). Cheap, and directly helps "what's for dinner."

**Medium-value, optional:**

- **Meal planning calendar** — assign recipes to days; generate an aggregated shopping list.
- **Recipe photos** — one image per recipe (store path under `data/`); pleasant but adds storage handling.
- **Spending insights** — monthly cost from `CookLog` snapshots.

**Explicitly deferred (avoid scope creep):**

- **Nutrition facts** (needs a nutrition database / external API) — note as future.
- **Multi-user, accounts, cloud sync** — out of scope per your brief; the SQLite + JSON export design leaves a clean path if you ever want it.

---

## 8. Implementation Roadmap

Each phase is a self-contained Claude Code handoff. **Phases 1–3 already give you a usable app** before the trickier logic lands.

- **Phase 0 — Project & data layer.** Scaffold Next.js + TS + Tailwind + shadcn/ui; add Drizzle + `better-sqlite3` (WAL); implement §2.3 schema + migrations; `scripts/seed.ts` (units, locations, sample ingredients/densities, one recipe); `scripts/backup.ts`; Settings table + screen. *Done when:* app runs, DB initializes, seed + backup work.
- **Phase 1 — Recipe repository (CRUD) + Ingredient master.** Recipe list/detail/create/edit/delete; ingredient typeahead with create-on-the-fly; tags; steps as plain text (linking comes next); search + filters. *Done when:* you can fully manage recipes and ingredients.
- **Phase 2 — Serving scaler + unit conversion.** Build `units.ts`, `quantity.ts`, `scaling.ts` (with the `{qN}` model, formatting, and the conservative fallback) + Vitest specs; wire the servings stepper and unit toggle into recipe detail; add the step **quantity-linking assist** in the editor. *Done when:* scaling/converting is correct and times/temperatures are never altered.
- **Phase 3 — Inventory + locations + price entries.** Inventory CRUD grouped by location; expiry badges; price entries + history chart + range/average; the **Log purchase** flow. *Done when:* you can track stock and prices and see ranges.
- **Phase 4 — "I made this" + CookLog + undo.** Transactional deduction with unit reconciliation, confirm-servings dialog, edge-case handling, history, and undo. *Done when:* cooking a recipe correctly updates inventory and can be undone.
- **Phase 5 — Cost calculator.** `cost.ts` (current vs average, unit/density conversion, missing-price flagging) + tests; surface $/serving and total on detail and cards. *Done when:* costs are honest about unknowns.
- **Phase 6 — Recommendations.** `recommend.ts` (coverage, three sort modes, almost-makeable, staples) + tests; "What can I make?" view + dashboard widget. *Done when:* suggestions sort correctly and flag near-misses.
- **Phase 7 — High-value extras.** Shopping list (+ purchase→inventory loop), cooking mode, expiry dashboard, **Claude-assisted import**, ratings/last-made.
- **Phase 8 — Polish & reliability.** PWA install/manifest, automated backups + export/import UI, ingredient merge/dedupe tool, performance pass, final test coverage.

---

## Appendix — Seed data & conventions

### A. Unit factor table (`UNITS`)

Base units: **ml** (volume), **g** (mass), **1** (count). Factors are exact; use the `"cooking"` rounding mode for friendlier display values.

| id | label | category | system | toBase |
|---|---|---|---|---|
| `tsp` | tsp | volume | imperial | 4.92892 |
| `tbsp` | tbsp | volume | imperial | 14.78676 |
| `fl_oz` | fl oz | volume | imperial | 29.57353 |
| `cup` | cup | volume | imperial | 236.5882 |
| `ml` | ml | volume | metric | 1 |
| `l` | L | volume | metric | 1000 |
| `oz` | oz | mass | imperial | 28.34952 |
| `lb` | lb | mass | imperial | 453.59237 |
| `g` | g | mass | metric | 1 |
| `kg` | kg | mass | metric | 1000 |
| `each` | — | count | either | 1 |
| `pinch` | pinch | volume | either | 0.31 *(approximate; treat as `approximate=true`, not scaled)* |

*Cooking-mode rounded conventions for display:* 1 cup ≈ 240 ml, 1 tbsp ≈ 15 ml, 1 tsp ≈ 5 ml, 1 oz ≈ 28 g, 1 lb ≈ 454 g.

### B. Default densities (g/ml) for volume↔weight bridging (optional, seed-able)

| Ingredient | density |
|---|---|
| Water | 1.00 |
| Milk | 1.03 |
| All-purpose flour | 0.53 |
| Granulated sugar | 0.85 |
| Butter | 0.96 |
| Honey | 1.42 |
| Vegetable oil | 0.92 |

(These let "1 cup flour → grams" work; ingredients without a density simply stay within their own measurement category and flag cross-category requests.)

### C. Conventions

- **Times stored in minutes** (`prepTimeMin`, `cookTimeMin`); total is derived.
- **Money** stored as a real in the configured `currency`; format at display time.
- **Timestamps** stored as Unix epoch (Drizzle `mode: "timestamp"`).
- **Scaling never mutates stored data** — it's always a render-time transform over the base recipe.
- **All conversion and cost math go through `lib/domain`** so they're testable and reusable; the UI never does unit math inline.
