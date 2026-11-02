import { beforeEach, describe, expect, it } from "vitest";
import { call, createOrder, resetToFixtures, setStatus } from "../helpers";

describe("issue 25 - shipped orders cannot be cancelled", () => {
  beforeEach(resetToFixtures);

  it("rejects cancelling a shipped order with 409 and leaves the order unchanged", async () => {
    const id = await createShippedOrder();

    const before = await getOrder(id);

    const { status, body } = await setStatus(id, "cancelled");

    expect(status).toBe(409);
    expect(body.error.code).toBe("INVALID_ORDER_TRANSITION");

    const after = await getOrder(id);
    expect(after.status).toBe(before.status);
    expect(after.history).toHaveLength(before.history.length);
  });
});

async function createShippedOrder(): Promise<string> {
  const id = await createOrderWithIdempotencyKey();
  setStatus(id, "pending");
  setStatus(id, "confirmed");
  setStatus(id, "shipped");
  return id;
}

async function createOrderWithIdempotencyKey(): Promise<string> {
  const key = crypto.randomUUID();
  const { body } = await createOrder([{ productId: "prod_notebook", quantity: 1 }], key);
  return body.order.id;
}

async function getOrder(id: string): Promise<any> {
  const { body } = await call("GET", `/api/orders/${id}`);
  return body.order;
}
