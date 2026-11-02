# Order Tracker Demo

A deliberately small order-tracking app on Cloudflare Workers + D1, used as the
target application in the ADLC workshop. All data is fictional.

## Quick start

```sh
pnpm install
pnpm db:reset:local   # local D1 only: migrate + seed fixtures
pnpm dev              # http://localhost:8787
```

Run the checks:

```sh
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

CI (`.github/workflows/ci.yml`) runs the same checks on every pull request and on
pushes to `main`. GitHub turns Actions off on new forks: open your fork's
**Actions** tab once and enable workflows.

## What it does

- Browse a small fictional catalog and place orders (server-calculated totals,
  integer cents, `Idempotency-Key` per logical order).
- View orders, line items, and a chronological status history.
- Move orders through `pending → confirmed → shipped → delivered`, or cancel.

## Docs

- [`docs/architecture.md`](docs/architecture.md) — intended behavior and design.
- [`docs/practices.md`](docs/practices.md) — how to reproduce and fix bugs.
- [`AGENTS.md`](AGENTS.md) — instructions for coding agents.

## Fixtures

`pnpm db:reset:local` recreates the same data every time, including one order in
each status:

| Order                | Status    |
| -------------------- | --------- |
| `ord_seed_pending`   | pending   |
| `ord_seed_confirmed` | confirmed |
| `ord_seed_shipped`   | shipped   |
| `ord_seed_delivered` | delivered |
| `ord_seed_cancelled` | cancelled |

## Deploying

Not required for the workshop. `wrangler.jsonc` uses a placeholder
`database_id`; create a dedicated D1 database with fictional data before
deploying anywhere, and never point a preview at a shared database.
