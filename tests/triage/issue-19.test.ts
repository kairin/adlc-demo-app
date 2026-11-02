import { beforeEach, describe, expect, it } from "vitest";
import { call, resetToFixtures, setStatus } from "../helpers";

describe("issue 19 - cancel shipped order", () => {
  beforeEach(resetToFixtures);

  it("rejects cancelling a shipped order with 409 and leaves the order unchanged", async () => {
    const id = "ord_seed_shipped";
    const { body: before } = await call("GET", `/api/orders/${id}`);

    const { status, body } = await setStatus(id, "cancelled");

    expect(status).toBe(409);
    expect(body.error.code).toBe("INVALID_ORDER_TRANSITION");
    const { body: after } = await call("GET", `/api/orders/${id}`);
    expect(after.history).toEqual(before.history);
    expect(after.status).toEqual(before.status);
  });
});
