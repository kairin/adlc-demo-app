import { beforeAll, describe, expect, it } from "vitest";
import { call, createOrder, resetToFixtures, setStatus } from "./helpers";

async function newPendingOrder(): Promise<string> {
  const { body } = await createOrder([{ productId: "prod_notebook", quantity: 1 }]);
  return body.order.id;
}

async function getOrder(id: string) {
  const { body } = await call("GET", `/api/orders/${id}`);
  return body.order;
}

async function orderAt(status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled") {
  const id = await newPendingOrder();
  const path: Record<string, string[]> = {
    pending: [],
    confirmed: ["confirmed"],
    shipped: ["confirmed", "shipped"],
    delivered: ["confirmed", "shipped", "delivered"],
    cancelled: ["cancelled"],
  };
  for (const step of path[status] ?? []) {
    const res = await setStatus(id, step);
    expect(res.status).toBe(200);
  }
  return id;
}

function expectConsistentHistory(order: any) {
  expect(order.history[0]).toMatchObject({ fromStatus: null, toStatus: "pending" });
  for (let i = 1; i < order.history.length; i++) {
    expect(order.history[i].fromStatus).toBe(order.history[i - 1].toStatus);
    expect(order.history[i].id).toBeGreaterThan(order.history[i - 1].id);
  }
  expect(order.history.at(-1).toStatus).toBe(order.status);
}

describe("POST /api/orders/:id/status", () => {
  beforeAll(resetToFixtures);

  it("walks the full happy path and records each step", async () => {
    const id = await newPendingOrder();
    for (const status of ["confirmed", "shipped", "delivered"]) {
      const { status: code, body } = await setStatus(id, status);
      expect(code).toBe(200);
      expect(body.order.status).toBe(status);
    }
    const order = await getOrder(id);
    expect(order.history.map((h: { toStatus: string }) => h.toStatus)).toEqual([
      "pending",
      "confirmed",
      "shipped",
      "delivered",
    ]);
    expectConsistentHistory(order);
  });

  it.each([["pending"], ["confirmed"]] as const)("allows cancelling a %s order", async (start) => {
    const id = await orderAt(start);
    const { status, body } = await setStatus(id, "cancelled");
    expect(status).toBe(200);
    expect(body.order.status).toBe("cancelled");
    expectConsistentHistory(body.order);
  });

  it.each([
    ["pending", "shipped"],
    ["pending", "delivered"],
    ["confirmed", "delivered"],
    ["confirmed", "pending"],
    ["shipped", "pending"],
    ["shipped", "confirmed"],
    ["delivered", "pending"],
    ["delivered", "shipped"],
    ["delivered", "cancelled"],
    ["cancelled", "pending"],
    ["cancelled", "confirmed"],
  ] as const)("rejects %s -> %s with 409 and leaves the order unchanged", async (start, next) => {
    const id = await orderAt(start);
    const before = await getOrder(id);

    const { status, body } = await setStatus(id, next);

    expect(status).toBe(409);
    expect(body.error.code).toBe("INVALID_ORDER_TRANSITION");
    expect(await getOrder(id)).toEqual(before);
  });

  it("treats repeating the current status as a no-op", async () => {
    const id = await orderAt("confirmed");
    const before = await getOrder(id);

    const { status, body } = await setStatus(id, "confirmed");

    expect(status).toBe(200);
    expect(body.order).toEqual(before);
  });

  it("returns 404 for a missing order", async () => {
    const { status, body } = await setStatus("ord_does_not_exist", "confirmed");
    expect(status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it.each([["refunded"], [""], [42]])("rejects unknown status %j with 400", async (value) => {
    const id = await newPendingOrder();
    const before = await getOrder(id);
    const { status, body } = await call("POST", `/api/orders/${id}/status`, {
      body: { status: value },
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_FAILED");
    expect(await getOrder(id)).toEqual(before);
  });

  it("records a concurrent duplicate confirmation only once", async () => {
    const id = await newPendingOrder();
    const results = await Promise.all([setStatus(id, "confirmed"), setStatus(id, "confirmed")]);
    for (const result of results) {
      expect(result.status).toBe(200);
    }
    const order = await getOrder(id);
    expect(order.status).toBe("confirmed");
    expect(order.history).toHaveLength(2);
    expectConsistentHistory(order);
  });

  it("keeps history consistent when different transitions race", async () => {
    const id = await newPendingOrder();
    await Promise.all([setStatus(id, "confirmed"), setStatus(id, "cancelled")]);
    const order = await getOrder(id);
    expect(order.status).toBe("cancelled");
    expectConsistentHistory(order);
  });
});
