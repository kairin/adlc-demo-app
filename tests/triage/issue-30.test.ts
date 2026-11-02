import { beforeEach, describe, expect, it } from "vitest";
import { call, resetToFixtures, setStatus } from "../helpers";

describe("issue 30: shipped orders cannot be cancelled", () => {
  beforeEach(resetToFixtures);

  it("rejects cancelling a shipped order with 409 and leaves the order unchanged", async () => {
    const id = "ord_seed_shipped";

    const { body: before } = await call("GET", `/api/orders/${id}`);
    expect(before.order.status).toBe("shipped");

    const { status, body } = await setStatus(id, "cancelled");

    expect(status).toBe(409);
    expect(body.error.code).toBe("INVALID_ORDER_TRANSITION");

    const { body: after } = await call("GET", `/api/orders/${id}`);
    expect(after.order.status).toBe("shipped");

    expect(after.order.history.length).toBe(before.order.history.length);
    expect(after.order.history).toEqual(before.order.history);
  });
});
