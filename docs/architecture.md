# Architecture

This document describes the **intended, correct behavior** of the order tracker.
When code and this document disagree, this document wins: fix the code, not the
contract. Do not weaken these rules to accommodate existing behavior.

## Overview

A single Cloudflare Worker serves a small JSON API under `/api/*` and a static,
same-origin UI from `public/` (Workers static assets). Data lives in one D1
database bound as `DB`. There is one fictional storefront and one fictional
customer (`cust_demo`). There are no payments, refunds, inventory reservations,
shipping integrations, accounts, or real customer data.

```
Browser (public/app.js)
   │  fetch /api/*
   ▼
src/index.ts ── /api/* ──► src/http/router.ts ──► src/http/handlers.ts
   │                                                │ validate input (src/http/validation.ts)
   │ everything else                                ▼
   └──► env.ASSETS (public/)             src/domain/orders.ts   (OrderService)
                                         src/domain/lifecycle.ts (transition rules)
                                                    │
                                                    ▼
                                         src/repo/*.ts  (D1 reads/writes)
                                                    │
                                                    ▼
                                         D1: migrations/*.sql
```

## Layers

| Layer      | Location         | Responsibility                                                                                                                          |
| ---------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Entry      | `src/index.ts`   | Route `/api/*` to the router; everything else to static assets.                                                                         |
| HTTP       | `src/http/`      | Parse and validate requests, call domain services, map `AppError` subclasses to JSON error responses. No SQL, no business rules.        |
| Domain     | `src/domain/`    | Order creation, lifecycle rules, idempotency semantics. Throws typed errors from `src/lib/errors.ts`.                                   |
| Repository | `src/repo/`      | All D1 access. Parameterized SQL only. Multi-statement writes use `db.batch()`, which D1 executes as a single transaction.              |
| Schema     | `migrations/`    | Tables, `CHECK` constraints, foreign keys, indexes. New schema changes go in a new numbered migration; never edit an applied migration. |
| Fixtures   | `seeds/seed.sql` | Deterministic, fictional data with fixed IDs and timestamps.                                                                            |
| UI         | `public/`        | Vanilla JS, no framework. Calls the API. Never the only enforcement point for a rule.                                                   |

## API

All responses are JSON. Errors use one shape:

```json
{ "error": { "code": "INVALID_ORDER_TRANSITION", "message": "...", "details": [] } }
```

| Method & path                 | Success                      | Notes                                                                    |
| ----------------------------- | ---------------------------- | ------------------------------------------------------------------------ |
| `GET /api/products`           | 200 `{ products }`           | Active products, prices in integer cents.                                |
| `GET /api/orders`             | 200 `{ orders }`             | Newest first: `created_at DESC, id DESC`.                                |
| `POST /api/orders`            | 201 `{ order }` + `Location` | Requires `Idempotency-Key`. Body `{ items: [{ productId, quantity }] }`. |
| `GET /api/orders/:id`         | 200 `{ order }`              | Includes `items` and chronological `history`.                            |
| `POST /api/orders/:id/status` | 200 `{ order }`              | Body `{ status }`.                                                       |

### Error codes

| HTTP | Code                       | When                                                                                            |
| ---- | -------------------------- | ----------------------------------------------------------------------------------------------- |
| 400  | `VALIDATION_FAILED`        | Malformed JSON, bad shape, unknown product, invalid quantity, unknown status.                   |
| 400  | `INVALID_IDEMPOTENCY_KEY`  | Missing, empty, or malformed `Idempotency-Key`.                                                 |
| 404  | `NOT_FOUND`                | Unknown order or route.                                                                         |
| 405  | `METHOD_NOT_ALLOWED`       | Known path, unsupported method.                                                                 |
| 409  | `INVALID_ORDER_TRANSITION` | Requested status change is not allowed from the current status.                                 |
| 409  | `IDEMPOTENCY_KEY_REUSED`   | Same `Idempotency-Key` sent with a different normalized payload.                                |
| 409  | `ORDER_UPDATE_CONFLICT`    | The order kept changing concurrently; client should reload.                                     |
| 500  | `INTERNAL_ERROR`           | Unexpected failure. Never report a database failure as success. Never leak SQL or stack traces. |

## Order lifecycle

| Current status | Allowed next status      |
| -------------- | ------------------------ |
| `pending`      | `confirmed`, `cancelled` |
| `confirmed`    | `shipped`, `cancelled`   |
| `shipped`      | `delivered`              |
| `delivered`    | none (terminal)          |
| `cancelled`    | none (terminal)          |

The transition table in `src/domain/lifecycle.ts` (`ALLOWED_TRANSITIONS`) is the
single source of truth for which status changes are allowed.

Rules:

- A disallowed transition returns **409`INVALID_ORDER_TRANSITION`** and changes
  nothing: status, `updated_at`, and history are untouched. Cancelling a shipped
  order is a disallowed transition, not a refund or a financial operation.
- Requesting the status the order already has is a no-op: return 200 with the
  current order; do not append history or change `updated_at`.
- The status update and its history row are written atomically (one `batch()`).
- Writes are conditional on the status that was validated
  (`UPDATE ... WHERE id = ? AND status = ?expected`), so a concurrent change can
  never be applied against stale state. If the conditional write matches no row,
  re-read and re-validate; give up with `ORDER_UPDATE_CONFLICT` after a few tries.
- The same rules apply to API calls and UI buttons. The UI shows all actions and
  lets the server decide.

## Order creation and idempotency

- The server computes every price and total from the catalog. Client-supplied
  totals or prices are ignored.
- Money is stored as integer minor units (cents). One currency: `USD`.
- Validation happens **before any write**: 1–20 lines, known active products, no
  duplicate product lines, integer quantities from 1 to 99. Invalid input leaves no rows.
- The order row, all line items, and the initial `pending` history row are
  written in one atomic `batch()`.

### `Idempotency-Key` contract

Each logical create-order attempt carries an `Idempotency-Key` header
(8–128 characters, `[A-Za-z0-9_-]`).

| Situation                                              | Required result                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------------- |
| Missing or malformed key                               | 400`INVALID_IDEMPOTENCY_KEY`, nothing written.                      |
| New key                                                | 201, one new order.                                                 |
| Same key, same normalized payload (sequential retry)   | 201 with the **same order** (same `id`, items, total). No new rows. |
| Same key, same normalized payload (concurrent retries) | Exactly one order is created; every request receives that order.    |
| Same key, different normalized payload                 | 409`IDEMPOTENCY_KEY_REUSED`, nothing written.                       |

The normalized payload is the list of `(productId, quantity)` pairs sorted by
`productId`.

Uniqueness and concurrency are enforced **at the database boundary** (constraints
and atomic writes). Worker module memory, `caches`, KV, or other eventually
consistent stores are not acceptable idempotency ledgers. Idempotency
bookkeeping must commit atomically with the order it refers to, so a failed
write cannot leave a key pointing at nothing, or an order without its key.

The UI keeps the same key across timeouts and automatic retries, and generates a
new key only when the user starts a different logical order. Disabling the
submit button is a UX nicety, not the fix for duplicates.

## Data model

See `migrations/`. Summary:

- `products(id, name, description, price_cents, active)`
- `orders(id, customer_id, status, currency, total_cents, idempotency_key, created_at, updated_at)`
- `order_items(id, order_id, product_id, product_name, unit_price_cents, quantity, line_total_cents)`
- `order_status_history(id, order_id, from_status, to_status, created_at)`

Timestamps are UTC ISO-8601 strings with milliseconds. History is ordered by its
autoincrement `id`, which is deterministic even when timestamps tie.

## Environments

- Tests run against local D1 inside the Workers runtime (`@cloudflare/vitest-plugin`);
  migrations are applied in `tests/setup/apply-migrations.ts`.
- `pnpm dev` uses local D1 state in `.wrangler/state`.
- The `database_id` in `wrangler.jsonc` is a placeholder. Deploying or creating
  previews requires a separate D1 database per environment with fictional data;
  a preview must never point at a participant's persistent or shared database.
- There are deliberately no HTTP endpoints for reset, seed, or migrations.
