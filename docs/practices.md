# Engineering practices

How to change this repository safely, especially when fixing a reported bug.
Read `docs/architecture.md` first; it defines correct behavior.

## Fixing a bug report

Fix exactly the reported problem. Do not sweep through unrelated code or fix
other defects you notice; mention them in your report instead.

1. **Reset and reproduce.** `pnpm install && pnpm db:reset:local`, then reproduce
   the report against local state (`pnpm dev` + `curl`, or a test). Record the
   exact commands and observed output.
2. **Write a failing regression test** in `tests/` that asserts the behavior from
   `docs/architecture.md`. Run it and confirm it fails _for the reported reason_
   (not because of a typo, missing fixture, or unrelated error).
3. **Patch the smallest relevant production path.** Keep the layer boundaries:
   rules in `src/domain/`, SQL in `src/repo/`, schema in a **new** migration.
4. **Re-run the unchanged regression test**, then the full checks:
   `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
5. **Report** the commands you ran with their outcomes, the files you changed,
   and any assumption you could not verify. A check that was skipped, timed out,
   or could not run is not a pass.

Never delete, skip, or weaken an existing or new test to make a branch green.
Never edit an applied migration; add `migrations/000N_description.sql`.

## Test expectations

- Integration tests call the Worker through `exports.default.fetch()` from
  `cloudflare:workers` and use real local D1, not mocks.
- Use `resetToFixtures()` from `tests/helpers.ts` when a test depends on seed data.
  Storage is isolated per test file, not per test; create your own orders when
  you need a known starting state.
- Status-change tests assert the HTTP response **and** that the database did not
  change when it should not have (`status`, `updatedAt`, history length).
- Create-order retry tests cover: sequential retries with the same key and
  payload, concurrent retries (`Promise.all`), same key with a different payload,
  and that a failed write leaves no partial rows or dangling idempotency records.
- Use deterministic synchronization (`Promise.all`, explicit ordering). Never use
  arbitrary sleeps.
- `countRows()` in `tests/helpers.ts` is the quickest way to assert "nothing was written".

## Code conventions

- TypeScript strict mode; no `any` in `src/`.
- Parameterized SQL only (`prepare(...).bind(...)`). Never interpolate input into SQL.
- Multi-statement writes that must succeed or fail together go in one `db.batch()`.
- Domain errors are thrown as `AppError` subclasses from `src/lib/errors.ts`; the
  router maps them to responses. Do not catch errors and return success.
- Error responses are safe: no SQL, stack traces, or secrets.
- Do not add dependencies or replace the architecture to fix a small domain bug.
- Do not add code comments unless asked; put explanations in `docs/`.
- Run `pnpm format` before finishing; `pnpm lint` must be clean.

## Safety boundaries

- Only local D1 for development and tests. Never run `--remote` D1 commands.
- No secrets or real personal data in fixtures, logs, tests, or reports.
- Do not commit, push, deploy, or create GitHub issues/PRs unless explicitly told to.
