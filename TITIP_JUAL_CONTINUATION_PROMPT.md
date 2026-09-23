# Titip Jual — Continuation Brief for AI Assistant

You are picking up an in-progress build of the **Consignment Sales & Product Distribution Management System** ("Sistem Titip Jual") — a family business app for pudding, croquettes, and Sosis Solo consignment sales + direct orders. This document is a snapshot of everything decided and built so far. **The original PRD document (`PRD_Sistem_Titip_Jual_Revisi.docx`) is the full source of truth for requirements — read it first if it's included in this project's files.** This brief supplements it with implementation state the PRD doesn't contain.

---

## 1. Operating Rules (recap — full detail in the PRD doc)

- **Incremental only**: work phase-by-phase, one checkpoint at a time. Never dump more than the current checkpoint's commands. Format: `STEP 1 <command>`, `STEP 2 <command>`, `STEP 3 <expected result / what to send back>`, then **STOP** and wait for real results.
- **No fabricated progress**: don't mark a feature 100% without implementation + testing + integration + E2E evidence. Use `NOT RUNTIME TESTED` / `SOURCE VERIFIED ONLY` / `TEST FAILED` / `BLOCKED` honestly.
- **On error**: STOP → ANALYZE → ROOT CAUSE → FIX → RETEST → CONTINUE. Never guess at a root cause without evidence — ask for logs/output first if unclear.
- **Don't invent** endpoints, tables, columns, or requirements. Mark unclear items as `UNCLEAR`, use `ASSUMPTION` only when necessary and flag it explicitly for the user to confirm or correct.
- **User prefers**: concise replies (don't paste every test output back individually — pass/fail summary is enough), Postman over curl for API verification.
- **User (goes by "B")** is on Windows, PowerShell, developing at `D:\1\titip-jual\`.

---

## 2. Confirmed Tech Stack

| Layer | Choice |
|---|---|
| Mobile | Flutter 3.47.5 + BLoC, Android 8.0+ target |
| Mobile local storage | SQLite (`sqflite`) — chosen over Hive because the data is relational and needs filtered/range queries (dropping history by store/date etc.) |
| Web | Next.js 16.3.6 (Turbopack) + Tailwind CSS |
| Backend | Node.js + Express.js (NestJS was considered and flagged as a possible alternative given the module count, but never adopted — still Express) |
| Database | **Supabase Postgres** (switched from local Postgres) — connection requires `ssl: { rejectUnauthorized: false }` in the `pg` Pool config |
| Auth | JWT (`jsonwebtoken`), bcrypt password hashing, token currently `JWT_EXPIRES_IN=12h` (bumped up from an initial 1h that caused a real bug — see §7) |
| Migrations | Hand-rolled: raw `.sql` files in `backend/database/migrations/`, applied via a custom runner (`backend/database/migrate.js`) that tracks applied files in a `_migrations` table. No ORM. |

---

## 3. Confirmed Design Decisions

- **Droppings and returns use a header + line-items pattern** (multi-product per store visit): `droppings`→`dropping_items`, `returns`→`return_items`. **Confirmed by user.**
- **Invoices are generated automatically per return/visit** (not batched on a weekly/monthly cycle). One invoice per `returns` row (`invoices.return_id` is `UNIQUE`). **Confirmed by user.**
- Offline sync idempotency: every offline-created `droppings`/`returns`/`direct_orders` row carries a client-generated `client_id UUID UNIQUE`. Server upserts on conflict = no-op (returns existing record), preventing duplicate creation from retried syncs.
- No separate server-side `sync_queue` table — that concept lives **only on the mobile client** (local SQLite). Server-side idempotency is handled via the `client_id` unique constraint directly on the transactional tables.
- Soft deletes (`deleted_at`) on `stores` and `products` — hard delete would break FK integrity against historical droppings/invoices.

## 4. Standing Assumptions — NOT yet explicitly confirmed by the user (revisit these)

- **No self-service registration.** Admin/Courier accounts are created via a CLI seed script (`backend/database/seed.js`), not a signup endpoint. User never explicitly confirmed this — it was proposed and unchallenged.
- **Each `dropping_item` is returnable exactly once** (enforced by a `UNIQUE(dropping_item_id)` constraint on `return_items`, migration `006`). If partial returns across multiple visits per drop are actually needed, the sold-qty/invoice math needs redesigning — flag this to the user if it comes up.
- **Overpayment is rejected** (`422 OVERPAYMENT`) rather than allowed as store credit.
- **Offline mode is input-only** — recording new droppings/returns works offline, but browsing transaction history assumes connectivity. If full offline history browsing turns out to be needed, that requires a local read-model, not just the write-queue that exists now.
- **JWT stored in `localStorage` on web** (XSS-exposed) — flagged as a Phase 16 (Security Hardening) candidate, not fixed yet.
- **Correction mechanism for dropping history (FR-07)** is still genuinely **UNCLEAR** — not designed or built. FR-07 says dropping history "should not be freely editable" and corrections need "an official mechanism," but what that mechanism is (reversal transaction? admin-only edit + audit log?) was never resolved. **Ask the user before building anything here.**
- **Invoice/billing edge cases** beyond the basic per-visit flow (e.g., what if a store never gets revisited to trigger a return/invoice?) haven't been discussed.

---

## 5. Local Environment Notes (things that caused real debugging sessions — don't relitigate these)

- **Supabase connection needs SSL**: any new `pg.Pool` instantiation in this project must include `ssl: { rejectUnauthorized: false }`, or connections fail. Already done in `database/migrate.js` and `src/config/db.js` — replicate this pattern for any new DB-connecting file.
- **Physical Android device (USB) testing requires `adb reverse tcp:4000 tcp:4000`** to be re-run every time the phone reconnects via USB or `adb` restarts — it is a session tunnel, not permanent. Symptom when it's missing: `ECONNREFUSED` (errno 111) on the phone even though Postman on the PC works fine, because Postman hits the PC's own localhost while the phone's "localhost" is the phone itself. `adb reverse --list` should show a mapping; if empty, that's the bug.
- **Flutter tests can't touch platform channels** (`path_provider`, `flutter_secure_storage`, `connectivity_plus` all use them). Pattern used throughout: define an interface (`TokenStorage`, `ConnectivityChecker`) and inject a fake/in-memory implementation in tests. `LocalDb` has a `setTestPath()` static method for the same reason (bypasses `path_provider` in tests via `sqflite_common_ffi`'s `inMemoryDatabasePath`).
- **JWT expiry bit offline testers**: a real offline field test (recording data, closing app, waiting, reconnecting) can easily exceed a short token lifetime. `JWT_EXPIRES_IN` is `12h` now specifically because of this. `AppRoot` in `main.dart` currently only checks *token exists*, not *token still valid* — a token can be present but expired, leading to silent `401`s on sync. **Known gap**: no token-refresh or expiry-check-on-launch logic exists yet.
- Backend `.env` requires: `PORT`, `DATABASE_URL` (Supabase URI), `JWT_SECRET`, `JWT_EXPIRES_IN`.
- Web requires `web/.env.local` with `NEXT_PUBLIC_API_URL=http://localhost:4000`.

---

## 6. Current Progress

**Overall: ~72–75%** (Phase 8 fully done and runtime-verified; Phase 9 checkpoint 1 of several in progress — confirm latest status with the user before trusting this exact number, since it may have moved since this doc was written).

| Phase | Status | Notes |
|---|---|---|
| 0 — Audit + Design | DONE | |
| 1 — Project Foundation | DONE | Backend/mobile/web all scaffolded and boot-verified |
| 2 — Database | DONE | 12 tables on Supabase, 5 migrations applied (+1 more, #006, in Phase 6) |
| 3 — Authentication | DONE | Login + JWT issuance + `/auth/me` protected-route check, all runtime-verified via curl |
| 4 — Master Data | DONE | Stores, Products (with duplicate-name rejection), Store-Specific Pricing (FR-05 special-price-overrides-base logic) — all Postman-verified |
| 5 — Dropping | DONE | Header+items creation, idempotent on `client_id`, filterable list — Postman-verified incl. idempotency replay |
| 6 — Returns + Sales Calc | DONE | Return validated against `dropping_items`, sold qty computed, invoice auto-created, duplicate-return and over-return rejection all Postman-verified |
| 7 — Payments | DONE | Partial/full payment, outstanding balance calc, auto PAID status, overpayment rejection — Postman-verified |
| 8 — Offline-First | **DONE, heavily runtime-tested** | Full real-device E2E: offline record → force-close → reopen (session persistence) → reconnect → sync → server-verified. 3 real bugs found and fixed during testing (see §7). This is the most thoroughly evidenced phase so far. |
| 9 — Web Dashboard | IN PROGRESS | Checkpoint 1 (auth + protected shell + sidebar nav) just delivered, **awaiting user's test results** (5-point checklist: unauth redirect, wrong-password error, successful login, refresh persistence, logout) |
| 10 — Direct Orders | NOT STARTED | No backend module yet |
| 11 — Reporting | NOT STARTED | |
| 12 — Search & Filter | NOT STARTED | Basic filtering exists ad hoc in droppings list (store/product/date) but no unified search |
| 13 — Notifications | NOT STARTED | Store visit reminder (FR-15) not built |
| 14 — Export | NOT STARTED | Phase 3 priority, non-blocking |
| 15 — WhatsApp | NOT STARTED | Phase 3 priority, non-blocking |
| 16–19 | NOT STARTED | Security hardening, perf, E2E, final audit |

**Not yet built at all**: Direct Orders (backend + mobile + web), Reports, Notifications/reminders, Search/Filter UI, Export, WhatsApp. The offline sync engine's endpoint map already has placeholders for `return` and `direct_order` entity types, but only `dropping` has an actual mobile repository wired to it — Returns and Direct Orders need their own `*Repository` classes on mobile following the exact same pattern as `DroppingRepository`.

**Transaction type (FR-21) note**: not implemented as an explicit column/field anywhere yet. Currently "transaction type" is implicit in which table a record lives in (droppings/returns = consignment, direct_orders = direct order). This may be sufficient, or the PRD's dashboard/reports aggregation (FR-22, revenue by channel) may need an explicit unified view — worth deciding when Phase 10/11 come up.

---

## 7. Real Bugs Found & Fixed (for context, don't redo this debugging)

1. **`path_provider`/`flutter_secure_storage` platform channel errors in tests** → fixed by dependency-injecting `TokenStorage`/`ConnectivityChecker` interfaces and using fakes/`sqflite_common_ffi` in-memory DB for tests.
2. **Stale default `widget_test.dart`** (Flutter's scaffolded counter test) → replaced with a real smoke test of the actual `LoginScreen`.
3. **No session persistence on mobile** → `AppRoot` widget added to `main.dart` to check for an existing token on launch and skip straight to `HomeScreen` if present (needed for the offline-restart E2E scenario to even be testable).
4. **`adb reverse` tunnel dropped silently** → not a code bug, but cost real debugging time; documented in §5 above.
5. **JWT expired mid-test** (1h default was too short for a realistic offline test session) → bumped to `12h`; flagged that proper token refresh is still a gap.

---

## 8. Dev/Test Data (local Supabase instance — not production credentials)

- Seeded user: username `Wangi Ambar Hapsari`, email `WangiAmbar@titipjual.local`, password `Hapsari`, `id=1`. **Rotate this before any real deployment** — it's a weak dev-only password.
- At least one test store (`id=1`) and one test product (`id=1`, "Pudding Coklat", base price 8000) exist from Phase 4/5/6 testing, along with test droppings/returns/invoices/payments created during verification.

---

## 9. Immediate Next Step

Waiting on the user to run the Phase 9 checkpoint 1 test (5-point checklist in the last message before this handoff: unauthenticated redirect to `/login`, wrong-password error display, successful login redirect to `/dashboard`, refresh-persists-session, logout-then-redirect). **Do not proceed to wiring real Overview dashboard data (FR-13: sold qty / returns / revenue with period filters) until that checkpoint is confirmed.**

After that: Overview data → Stores/Products/Prices CRUD screens on web → Droppings/Returns/Invoices/Payments list+detail views on web → then Phase 10 (Direct Orders, full stack) → Phase 11 onward per the PRD's roadmap.
