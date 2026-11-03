# Checkpoint 1 — Agent in a sandbox: complete ✅

Workshop step: [Checkpoint 1 — Agent in a sandbox](https://adlc.omkh.dev/checkpoints/1-agent-in-a-sandbox/)
Date: 2026-11-03
Previous: [CHECKPOINT-0.md](CHECKPOINT-0.md)

A newly opened issue on this fork now starts a reproducer agent in an isolated
Cloudflare Sandbox. The agent reproduced the bug with a failing test and saved a
Markdown report to R2, which `pnpm report <n>` prints.

## Completion criteria

| Criterion (from the workshop page)                                   | Result |
| -------------------------------------------------------------------- | ------ |
| A new issue produces `agent.dispatched` with the correct issue number | ✅ `agent.dispatched` with `agentId: "issue-11"`, `issue: 11` |
| The run produces `report.saved` and `agent.finished` with `reportSaved: true` | ✅ Report saved to R2 at 2026-11-03T08:32:50Z |
| `pnpm report <number>` prints the report from R2                      | ✅ `pnpm report 11` prints it (output below) |
| You can explain which code gives the agent a model, a sandbox and `save_report` | ✅ See [How the agent is wired](#how-the-agent-is-wired) |

## What was done

1. **Deployed checkpoint 1** of `adlc-triage-agent` (`pnpm run deploy`, Worker
   version `21a4e99b`, uploaded 2026-11-03T08:23:26Z; container app
   `adlc-triage-agent-sandbox` rolled out at 08:25:09Z).
2. **Opened the workshop's main test issue**, copied exactly from the
   [test issues page](https://adlc.omkh.dev/reference/test-issues/):
   [#11 "Shipped orders can be cancelled"](https://github.com/kairin/adlc-demo-app/issues/11).
3. **The webhook dispatched the agent.** GitHub's delivery for #11 returned
   `200 {"status":"dispatched","agentId":"issue-11"}`.
4. **The agent worked in the sandbox** (`sandbox-issue-11`) for about 5 minutes:
   explored the repo, installed dependencies, wrote
   `tests/triage/issue-11.test.ts`, ran it (failing, `exitCode: 1`) and saved
   its report.
5. **Read the report** with `pnpm report 11` from the `adlc-triage-agent` root.

## Run timeline (`wrangler tail`, local time UTC+8)

| Time    | Event | Meaning |
| ------- | ----- | ------- |
| 4:27:28 | `webhook.received`, `agent.dispatched` (`issue-11`) | Issue accepted, agent started |
| 4:27:29 | `Sandbox.configure`, `Sandbox.exists` | Sandbox container started |
| 4:27:42–4:28:30 | Short `exec` / `readFile` calls | Agent reads the code |
| 4:28:31, 4:28:49 | `exec` 16.4 s and 13.5 s | Dependency install and setup |
| 4:29:17 | `writeFile` | Agent writes its test |
| 4:29:21 | `exec`, `exitCode: 1` | Test fails: bug reproduced |
| 4:32:14 | `exec`, `exitCode: 1` | Final re-run of the failing test |
| 4:32:50 | `report.saved` | Report written to R2 |

## The report (`pnpm report 11`)

```text
# Triage report: kairin/adlc-demo-app#11

- Agent: `issue-11`
- Saved: 2026-11-03T08:32:50.184Z

Outcome: reproduced

Evidence:
- Test file: tests/triage/issue-11.test.ts
- Failing assertion: expected 200 to be 409

Expected vs observed:
- Expected: 409 CONFLICT with INVALID_ORDER_TRANSITION error code
- Observed: 200 OK with order status changed to cancelled
```

Test the agent wrote:

```typescript
import { beforeAll, describe, expect, it } from "vitest";
import { countRows, resetToFixtures, setStatus } from "../helpers";

describe("issue 11 - shipped orders cannot be cancelled", () => {
  beforeAll(resetToFixtures);

  it("rejects cancelling a shipped order with 409 INVALID_ORDER_TRANSITION", async () => {
    const orderId = "ord_seed_shipped";
    const before = await countRows();

    const { status, body } = await setStatus(orderId, "cancelled");

    expect(status).toBe(409);
    expect(body.error.code).toBe("INVALID_ORDER_TRANSITION");

    const after = await countRows();
    expect(after).toEqual(before);
  });
});
```

> This is the model's own claim. Nobody has re-run the test on a clean checkout
> yet; checkpoint 4 adds that check.

**Likely root cause (not part of the report):** in `src/domain/lifecycle.ts`,
`assertTransition` uses `canCancel()` for `cancelled`, which allows any
non-terminal status. That bypasses `ALLOWED_TRANSITIONS`, where `shipped` only
allows `delivered`. Issue #9 describes the same bug.

## How the agent is wired

All in `~/Apps/adlc-triage-agent`:

| Piece | Where | What it does |
| ----- | ----- | ------------ |
| Dispatch | `src/app.ts` → `startReproducer()` | Passed as `onIssueOpened` to `createTriageChannel`; calls Flue `dispatch(Reproducer, …)` with `id: issue-<n>` and the delivery ID as the idempotency key |
| **Model** | `src/agents/reproducer.ts` → `useModel(modelFor(env), { thinkingLevel: "low" })`; `src/models.ts` → `modelFor()` | Uses the shared AI Gateway model when `AI_GATEWAY_TOKEN` and `AI_GATEWAY_ACCOUNT_ID` are set, otherwise Workers AI (`AI` binding). Requests go through AI Gateway `adlc-triage-agent` |
| **Sandbox** | `src/agents/reproducer.ts` → `useSandbox(cloudflareSandbox(getSandbox(env.Sandbox, id)), …)`; `src/sandbox.ts`; `wrangler.jsonc` `containers` | One Sandbox Durable Object + container per agent ID (`Dockerfile`, `standard-1`, max 3 instances, hard 30-minute lifetime) |
| **`save_report` tool** | `src/agents/reproducer.ts` → `useTool({ name: "save_report", … })`; `src/reports.ts` → `saveReport()` | Writes `runs/<agentId>/report.md` to the `REPORTS` R2 binding (`adlc-triage-reports`), logs `report.saved`, and ends the run (`terminate: true`) |
| Finish log | `src/agents/reproducer.ts` → `useResponseFinish` | Logs `agent.finished` with `reportSaved`, tool-call count and tokens |
| Report reader | `scripts/show-report.ts` (`pnpm report <n>`) | `wrangler r2 object get adlc-triage-reports/runs/issue-<n>/report.md --remote --pipe` |

## Notes

- **`Durable Object reset because its code was updated`** appeared at 4:30:32
  in the sandbox's alarm handler (`@cloudflare/containers`). It was most likely
  the container rollout from the 08:23 deploy finishing during the run. It
  did not affect the agent; the report saved at 4:32:50. Lesson: wait a few
  minutes after `pnpm run deploy` before opening a test issue, and don't
  redeploy while a run is in progress.
- **Next:** checkpoint 2 — structured outcome. The agent must submit a typed,
  validated result. Test with the vague issue "Orders are broken".
