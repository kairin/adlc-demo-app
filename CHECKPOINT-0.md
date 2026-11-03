# Checkpoint 0 — Setup: complete ✅

Workshop step: [Setup → Test](https://adlc.omkh.dev/setup/test/)
Date: 2026-11-03

A new GitHub issue on this fork reaches the triage-agent Worker, the Worker
verifies and logs it, and GitHub records a `200 {"status":"received"}` response.

| Component     | Value                                                                        |
| ------------- | ---------------------------------------------------------------------------- |
| Demo app fork | [`kairin/adlc-demo-app`](https://github.com/kairin/adlc-demo-app)            |
| Worker        | `adlc-triage-agent`                                                          |
| Webhook URL   | `https://adlc-triage-agent.experimental-workflow.workers.dev/channels/github/webhook` |
| Webhook ID    | `706783763`                                                                  |

## Completion criteria

| Criterion (from the workshop page)                                        | Result |
| ------------------------------------------------------------------------- | ------ |
| The fork has a webhook whose `ping` returned `200`                        | ✅ Two pings, both `200` (07:42:04Z and 07:51:09Z) |
| Opening an issue produces a `webhook.received` log with repo and issue no. | ✅ Logged for issues #5–#9 in `wrangler tail` |
| The GitHub delivery shows `{"status":"received"}`                         | ✅ All five `issues/opened` deliveries |

## What was done

1. **Found the webhook.** The fork already had a webhook pointing at the Worker,
   but it was **inactive** and subscribed to **no events**.
2. **Fixed the webhook.** Turned it on and subscribed it to **Issues** only, as the
   setup page requires. Final config:
   - Active: `true`
   - Events: `issues`
   - Content type: `json`
   - SSL verification: on (`insecure_ssl: 0`)
   - Secret: set (value not recorded here)
3. **Pinged it.** The ping returned `200 OK`.
4. **Opened test issues.** Instead of a single "Hello triage bot" issue, I opened
   five realistic issues based on the order-tracker code:

   | Issue | Label            | Title |
   | ----- | ---------------- | ----- |
   | [#5](https://github.com/kairin/adlc-demo-app/issues/5) | bug              | Duplicate orders possible: `idempotency_key` has no unique constraint |
   | [#6](https://github.com/kairin/adlc-demo-app/issues/6) | documentation    | README links to `AGENTS.md`, which does not exist |
   | [#7](https://github.com/kairin/adlc-demo-app/issues/7) | enhancement      | Add pagination to the order list |
   | [#8](https://github.com/kairin/adlc-demo-app/issues/8) | accessibility    | Status action buttons have no accessible context |
   | [#9](https://github.com/kairin/adlc-demo-app/issues/9) | good first issue | Add a test for cancelling a shipped order |

5. **Checked both sides.** The Worker logs and GitHub's Recent Deliveries agree:
   10 `issues` events (5 × `opened`, 5 × `labeled`), all delivered and accepted.

## Evidence

### Worker logs (`pnpm exec wrangler tail adlc-triage-agent --format pretty`)

Times are local (UTC+8).

```text
POST .../channels/github/webhook - Ok @ 03/11/2026, 3:51:09 pm      ← ping
POST .../channels/github/webhook - Ok @ 03/11/2026, 3:52:16 pm
  (log) {"event":"webhook.received","deliveryId":"7c354060-d75b-11f1-9f91-67b24e31e55b","githubEvent":"issues","action":"opened","repo":"kairin/adlc-demo-app","issue":5,"sender":"kairin"}
  (log) {"event":"webhook.received","deliveryId":"7d8ef910-d75b-11f1-9b08-f87ec25f67d5","githubEvent":"issues","action":"opened","repo":"kairin/adlc-demo-app","issue":6,"sender":"kairin"}
  (log) {"event":"webhook.received","deliveryId":"7e3fdcda-d75b-11f1-89f4-5f17ffcecc21","githubEvent":"issues","action":"opened","repo":"kairin/adlc-demo-app","issue":7,"sender":"kairin"}
  (log) {"event":"webhook.received","deliveryId":"7f7bebf2-d75b-11f1-8ba7-77684df9a349","githubEvent":"issues","action":"opened","repo":"kairin/adlc-demo-app","issue":8,"sender":"kairin"}
  (log) {"event":"webhook.received","deliveryId":"80e010c2-d75b-11f1-91df-ba92a493ccf0","githubEvent":"issues","action":"opened","repo":"kairin/adlc-demo-app","issue":9,"sender":"kairin"}
  (+ one "labeled" event per issue)
```

### GitHub Recent Deliveries (`issues` / `opened`)

| Issue | Delivered (UTC)      | Status | Response body |
| ----- | -------------------- | ------ | ------------- |
| #5    | 2026-11-03 07:52:16Z | 200    | `{"status":"received","deliveryId":"7c354060-…","event":"issues"}` |
| #6    | 2026-11-03 07:52:18Z | 200    | `{"status":"received","deliveryId":"7d8ef910-…","event":"issues"}` |
| #7    | 2026-11-03 07:52:19Z | 200    | `{"status":"received","deliveryId":"7e3fdcda-…","event":"issues"}` |
| #8    | 2026-11-03 07:52:21Z | 200    | `{"status":"received","deliveryId":"7f7bebf2-…","event":"issues"}` |
| #9    | 2026-11-03 07:52:24Z | 200    | `{"status":"received","deliveryId":"80e010c2-…","event":"issues"}` |

The delivery IDs match the Worker log lines one for one.

## Notes

- **No agent runs yet, as expected.** At checkpoint 0, `src/app.ts` in
  `adlc-triage-agent` calls `createTriageChannel` without an `onIssueOpened`
  handler, so the Worker logs and acknowledges each event but starts nothing.
  The issues therefore have no bot comments.
- **Next:** checkpoint 1 (`dev/checkpoint-1`). A newly opened issue starts an
  agent in a sandbox. Needs Docker running for `pnpm run deploy`. Issues #5–#9
  will not trigger it, because their `opened` events were already delivered.
