import { beforeEach, describe, expect, it } from "vitest";
import { call, resetToFixtures, setStatus } from "../helpers";

describe("issue 23 - shipped orders cannot be cancelled", () => {
  beforeEach(resetToFixtures);

  it("rejects cancelling a shipped order with 409 and leaves everything unchanged", async () => {
    const id = "ord_seed_shipped";

    // Fetch the original order using the API
    const { status: get1Status, body: getOrder1 } = await call("GET", `/api/orders/${id}`);

    // Should exist
    expect(get1Status).toBe(200);
    expect(getOrder1.order.status).toBe("shipped");
    const originalStatus = getOrder1.order.status;
    const originalHistoryIds = getOrder1.order.history.map((h: any) => h.id);

    // Try to cancel it - should fail
    const { status, body } = await setStatus(id, "cancelled");

    // Should return 409 conflict
    expect(status).toBe(409);
    expect(body.error.code).toBe("INVALID_ORDER_TRANSITION");

    // Fetch the order again - should be unchanged
    const { status: get2Status, body: getOrder2 } = await call("GET", `/api/orders/${id}`);

    // Should still exist
    expect(get2Status).toBe(200);
    expect(getOrder2.order.status).toBe(originalStatus);
    const finalHistoryIds = getOrder2.order.history.map((h: any) => h.id);

    // History should be unchanged
    expect(finalHistoryIds).toEqual(originalHistoryIds);
  });
});
