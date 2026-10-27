import { beforeEach, describe, expect, it } from "vitest";
import { ORDER_STATUSES } from "../src/domain/types";
import { call, resetToFixtures } from "./helpers";

describe("seed fixtures", () => {
  beforeEach(resetToFixtures);

  it("contains one order in each lifecycle state", async () => {
    const { status, body } = await call("GET", "/api/orders");
    expect(status).toBe(200);
    const statuses = body.orders.map((order: { status: string }) => order.status).sort();
    expect(statuses).toEqual([...ORDER_STATUSES].sort());
  });

  it("lists orders newest first", async () => {
    const { body } = await call("GET", "/api/orders");
    expect(body.orders.map((order: { id: string }) => order.id)).toEqual([
      "ord_seed_pending",
      "ord_seed_confirmed",
      "ord_seed_shipped",
      "ord_seed_delivered",
      "ord_seed_cancelled",
    ]);
  });

  it("has totals and history that agree with each order", async () => {
    const { body } = await call("GET", "/api/orders");
    for (const summary of body.orders) {
      const { body: detail } = await call("GET", `/api/orders/${summary.id}`);
      const order = detail.order;
      const lineSum = order.items.reduce(
        (sum: number, item: { lineTotalCents: number }) => sum + item.lineTotalCents,
        0,
      );
      expect(order.totalCents).toBe(lineSum);
      expect(order.history[0]).toMatchObject({ fromStatus: null, toStatus: "pending" });
      expect(order.history.at(-1).toStatus).toBe(order.status);
      for (let i = 1; i < order.history.length; i++) {
        expect(order.history[i].fromStatus).toBe(order.history[i - 1].toStatus);
      }
    }
  });

  it("is deterministic across resets", async () => {
    const first = await call("GET", "/api/orders/ord_seed_delivered");
    await resetToFixtures();
    const second = await call("GET", "/api/orders/ord_seed_delivered");
    expect(second.body).toEqual(first.body);
  });
});
