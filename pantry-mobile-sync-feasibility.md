# Pantry → iPhone: Feasibility Analysis

> Planning/feasibility analysis only — no code committed alongside this. Grounded in the
> current architecture ([schema.ts](src/lib/db/schema.ts), [src/lib/db/](src/lib/db/),
> [src/lib/domain/](src/lib/domain/), the `force-dynamic` + `"use server"` page/action layer).
> Companion doc to [pantry-technical-design.md](pantry-technical-design.md).

## TL;DR

The vision is achievable, but **standalone mode is not a "port" — it's an architectural inversion**, and **sync mode is gated almost entirely by one decision not yet made: primary keys.** Pantry today is a thin browser talking to a server that owns the database. Both halves of the vision require the database *and* the logic to run on the phone with no server in the loop. Good news: the `src/lib/domain` layer is already pure and portable — the part that's expensive to rewrite. Bad news: every table uses local `autoIncrement` integer IDs, there are no deletion tombstones, and the recipe-write path deletes-and-recreates child rows — all three obstruct sync, and all three are cheap to fix *now* and expensive to fix *later*.

Recommendation up front: **don't build any of this yet, but make ~four low-cost schema/architecture changes now** (see §7) that keep the door open. And strongly consider that the "80% of the value" version is *companion sync only* — skip standalone, or treat standalone as "the PC export, opened read-mostly on a phone."

---

## 1. Technical feasibility

**Straightforward parts:**
- Putting a SQLite database on an iPhone. iOS has had SQLite forever; every cross-platform framework has a binding. Solved problem.
- Reusing domain logic (units, scaling, cost, cook planning, recommendations). [src/lib/domain/](src/lib/domain/) is pure TypeScript with no I/O — if the phone app runs JavaScript (React Native/Expo or a Capacitor webview), this code moves over essentially as-is, tests included. Rare and valuable.
- Transferring a file PC→phone over the LAN. SQLite is a single file; shipping a copy is easy.

**Genuinely hard parts (in order):**

1. **The server assumption.** Pantry's entire data layer ([src/lib/db/](src/lib/db/)) runs server-side on `better-sqlite3`, a native Node binding in `serverExternalPackages`. Pages are `force-dynamic` server components; mutations are `"use server"` server actions (7 action files under `src/app/`). None of this executes on a phone. A standalone phone app has **no server to call** — so the DB access layer and server-action layer must be re-homed to run locally on-device. That's the inversion, and it's the real cost of standalone mode, not the UI.
2. **Identity across two databases** (see §3/§4) — the sync blocker.
3. **Bidirectional merge with no referee.** Cloudless peer-to-peer sync where *both* sides can edit means you own conflict resolution; there's no server to be the single source of truth. Solvable but consistently underestimated.

Everything else is ordinary app work.

---

## 2. Standalone-mode architecture

**What to build the phone DB on:** SQLite, not Core Data. The schema, migrations, and (critically) file-level compatibility are already SQLite. Core Data would force re-expressing the schema in an Apple-only object graph that can't be shared with the PC.

**The framework decision drives everything else.** Three realistic paths:

| Path | Code reuse | Standalone DB | Reality |
|---|---|---|---|
| **React Native / Expo** | Domain layer + Zod schemas + TS types reused; DB layer rewritten against `op-sqlite`/`expo-sqlite` | Native SQLite on-device | Best balance. Rewrite UI and the DB-access functions, keep the hard-won pure logic and validation. |
| **Capacitor (wrap the web app)** | Highest — reuse most of the UI too | SQLite via plugin, **but** must replace server components/actions with client-side calls | Tempting, but the server-component + server-action design fights you. You'd unwind `force-dynamic`/`"use server"` to run client-side. Possibly more work than RN despite "reusing" the web app. |
| **Native Swift** | ~Zero. Reimplement domain logic in Swift. | Native SQLite/GRDB | Best iOS feel, worst economics. Throws away the portable domain layer. Only worth it for a flagship native experience. |

**Recommendation:** React Native/Expo if the phone should be a real first-class app. Decisive factor: it reuses `src/lib/domain` and `src/lib/validation` verbatim — the parts that encode the actual business rules — while accepting that UI and the thin DB-access functions get rewritten.

**Relationship to current models:** The schema transfers conceptually 1:1; the phone uses the *same tables*. The only changes wanted are the sync-enablers in §7 — needed on the PC side too, so both ends stay identical. That symmetry is the point: identical schema on both ends is what makes a copied `.db` file openable on either device.

---

## 3. Sync-mode architecture

Discard the weakest options first:
- **Manual export/import** (AirDrop a file): trivially easy, a fine *v0*, but whole-file replacement is last-saver-wins at the database level — it silently destroys whatever the other side did. A safety hatch, not "sync."
- **QR code:** great for *pairing/discovery* (exchange a device key or IP:port), useless as the data channel — the DB is far too big for QR. Use it for the handshake, not the payload.

**The realistic mechanism: LAN sync with the PC as host.** The PC already runs an HTTP server (Next.js). Add a small authenticated sync endpoint. The phone discovers the PC on the local network (Bonjour/mDNS, a paired IP, or a QR-encoded address+token), then they exchange *changes* — not whole files. The PC is the natural hub: the only always-on, already-serving node; the phone connects when it can.

**Sync as change-exchange, not file-copy.** The unit of sync is "rows that changed since we last talked," reconciled per-row. Requires the three enablers in §7 (stable IDs, tombstones, reliable `updatedAt`). With those, the protocol is boring: each side sends rows changed since the last sync watermark, both apply the other's changes under a conflict rule, both advance the watermark.

**A pragmatic asymmetry worth considering:** make the **PC authoritative for "library" data** (recipes, ingredients, prices, aliases) and let the **phone own "transactional" data captured in the field** (purchases logged, cooks recorded, inventory adjustments, shopping-list checkoffs). Most real-world phone-in-the-field edits are *append* operations (I bought this, I cooked that) rather than concurrent edits to the same recipe. Lean into that and the scary part of conflict resolution mostly evaporates — you're appending logs and adjusting counters, not merging simultaneous edits to a recipe body. This is the "80% of the value for 40% of the effort" path.

---

## 4. Conflict resolution

Don't build one universal merge algorithm. Resolve per *kind* of data:

1. **Append-only logs** (`cook_logs`, `cook_log_lines`, `price_entries`): no conflicts possible by construction. Two devices each add rows; union them. With stable IDs this is trivial. The majority of field activity.
2. **Counters / inventory quantities** (`inventory_items.quantity`): the dangerous case. If the phone deducts 200g (cooked) and the PC adds 500g (restocked) before sync, **field-level last-write-wins is wrong** — it throws away one real-world event. Sync the *deltas* (the cook log line and the purchase), not the absolute quantity, and recompute. Strongest argument for the §3 asymmetry: treat inventory changes as events, not a field to overwrite.
3. **Editable records** (`recipes`, `ingredients`, `settings`): **last-write-wins per row, by `updatedAt`,** is the right default for a single-user app. Genuine simultaneous edits to the same record on two devices are rare; "most recent save wins" matches intuition. Add a lightweight **conflict log** ("phone changed recipe X at 10:02, PC's 10:05 edit won — here's the discarded version") so nothing is *silently* lost. Don't build interactive 3-way merge UI; not worth it for one user.
4. **Child-collection replacement is a trap.** Today [`updateRecipe`](src/lib/db/recipes.ts) deletes *all* `recipe_ingredients` and re-inserts them on every edit. Locally clean; for sync, poison: every recipe edit looks like "deleted 12 ingredient rows, created 12 new ones with new IDs," fighting any row-level merge and churning tombstones. Cleanest rule: **treat the recipe + its ingredients + steps as one aggregate** and apply LWW to the whole aggregate by the recipe's `updatedAt`. Don't merge individual ingredient rows across devices.

**Bottom line:** LWW-per-row for editable records, event-union for logs, delta-application for inventory, aggregate-level LWW for recipes. No CRDTs, no operational transforms — overkill for a single-user kitchen app.

---

## 5. Codebase implications

Better positioned than average, but not free:

- **Domain layer: ready.** [src/lib/domain/](src/lib/domain/) is already the swappable, portable core. No restructuring needed — the payoff of existing discipline.
- **DB-access layer: needs to become an interface.** Functions like `listRecipes`, `logPurchase`, `cookThisRecipe` are written directly against the `db` Drizzle proxy and called from both server actions *and* server-component pages. For the phone they must run against an on-device connection. The functions are mostly portable (Drizzle queries); the *connection acquisition* ([client.ts](src/lib/db/client.ts), built around `better-sqlite3`) is Node-specific. Want the data layer to depend on an injected connection rather than a singleton import. Moderate, mechanical refactor — not a rewrite.
- **The page/action coupling is the real friction.** Pages read the DB directly as server components. On a serverless phone app, "data fetch" must become a local call, not a server round-trip. In RN this is natural (everything's a client call); in a Capacitor wrap it means dismantling the server-component model. This is why framework choice (§2) dominates the cost.
- **Schema: four targeted additions** (§7), not a restructuring.

So: **moderate refactor of the data layer + schema additions, not a major rearchitecture** — *provided* you choose React Native. Capacitor or "reuse the Next.js app on-device" is where it balloons, fighting the server-first design.

---

## 6. Effort & risk

**Complexity tiers:**
- *Standalone phone app (no sync):* **Major lift.** New UI in a new framework + re-homing the data layer on-device. Domain reuse helps, but it's still a second full app.
- *Companion sync (on top of standalone):* **Moderate, mostly sync logic** — *if* the §7 enablers exist. Without them, sync is a major lift (retrofitting identity into a live schema).
- *Field-events-only companion (the §3 asymmetry):* **The cheapest real win.** Phone captures purchases/cooks/inventory deltas offline, pushes to the PC's existing server. Much smaller than full bidirectional editing.

**Biggest risks / unknowns:**
1. **Primary-key identity.** `autoIncrement` integer PKs across two independent databases collide. The #1 risk and it's silent — everything appears to work until two devices both have a recipe id=7 meaning different things. Fixing later means rewriting every FK and migrating live data. Fix before there's a second database.
2. **Inventory quantity merges** corrupting stock counts if done as field-LWW instead of deltas (§4.2).
3. **Hard deletes are invisible to sync.** A row deleted on the phone reappears from the PC on next sync — no tombstone says "this was deleted." All deletes cascade via FK with no trace.
4. **Two-app maintenance burden.** Every schema change and domain rule must ship to both ends and migrate both databases — an ongoing tax, not a one-time cost. Arguably the most underrated risk for a solo maintainer.
5. **Framework lock-in regret.** Picking Capacitor to "reuse the web app," discovering the server-component model doesn't fit offline, and redoing it in RN.

---

## 7. Keeping the door open (do this now, build nothing)

If nothing else changes, these four make a future sync *dramatically* cheaper and cost almost nothing today, because right now there's only one database and no migration pain:

1. **Add a stable, globally-unique identity to every syncable table.** Keep integer PKs for local joins if you like, but add a `uuid`/`publicId` column (generated on insert) that travels with the row across devices. The single most important change. Retrofitting it once a second populated database exists is the difference between "an afternoon" and "a dangerous migration." Do it while the only DB is yours.
2. **Stop hard-deleting syncable rows; add tombstones.** A `deletedAt` (soft-delete) column on user-editable tables, with deletes flipping the flag instead of removing the row. Without this, sync can never propagate a deletion. Keep cascade behavior at the app layer.
3. **Make `updatedAt` universal and trustworthy.** Several tables have it (`ingredients`, `recipes`, `inventory_items`); others (`recipe_ingredients`, `tags`, `recipe_tags`, `settings`) don't. For LWW you need a reliable "last changed" on everything that syncs. Decide now whether each table syncs at all, and give the ones that do a maintained `updatedAt`.
4. **Keep the data-access layer connection-injectable.** As you touch [src/lib/db/](src/lib/db/) files, nudge them toward "operate on a passed-in connection" rather than importing the `db` singleton. Don't refactor it all today — just stop *adding* new hard dependencies on the Node-specific client, so the layer can later run against an on-device SQLite handle.

Two more, lower priority: **model inventory changes as events** (you already have `cook_log_lines` and `price_entries` — lean on those as the source of truth and treat `quantity` as derived/cached where you can), and **reconsider the delete-and-recreate child pattern** in `updateRecipe` *only if* you go down the sync road (it's fine as-is otherwise).

What **not** to do now: don't add UUIDs and tombstones and then contort the current single-user PC app around them for no present benefit beyond the above; don't pick a mobile framework; don't build a sync protocol. The four changes above are the entire "keep the door open" investment.

---

## Honest recommendation

The full vision — a standalone phone app *and* bidirectional cloudless sync — is sound but is effectively **building and maintaining a second application forever.** For a personal, single-user app, weigh that ongoing tax seriously.

Highest-value, lowest-regret path:
1. **Now:** make the four §7 changes. Cheap insurance, no commitment.
2. **If/when you want mobile:** build the **companion** first, scoped to **field events** (log purchases, record cooks, adjust inventory offline → push to the PC's existing server over LAN). Delivers the "take it grocery shopping" experience — the actual motivating use case — without solving general bidirectional recipe merging.
3. **Standalone** (no PC at all) is the expensive, lower-value half. Most of its value is captured by "export the PC database and open it on the phone." Treat true standalone as a later, separate decision, not a launch requirement.

Pushback on one part of the vision: **"the phone holds a full copy and freely edits everything, syncing both ways"** is the most expensive interpretation and mostly serves a concurrency pattern (editing the same recipe on two devices simultaneously) that a single user rarely hits. Constrain what the phone edits and the whole problem gets an order of magnitude smaller.
