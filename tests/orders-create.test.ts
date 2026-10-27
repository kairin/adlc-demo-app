import { beforeAll, describe, expect, it } from "vitest";
import { call, countRows, createOrder, newKey, resetToFixtures } from "./helpers";

describe("POST /api/orders", () => {
  beforeAll(resetToFixtures);

  it("creates a pending order with server-calculated totals", async () => {
    const { status, body, headers } = await call("POST", "/api/orders", {
      headers: { "Idempotency-Key": newKey() },
      body: {
        items: [
          { productId: "prod_mug", quantity: 2 },
          { productId: "prod_stickers", quantity: 3 },
        ],
        totalCents: 1,
      },
    });

    expect(status).toBe(201);
    const order = body.order;
    expect(headers.get("location")).toBe(`/api/orders/${order.id}`);
    expect(order).toMatchObject({
      status: "pending",
      currency: "USD",
      customerId: "cust_demo",
      totalCents: 2 * 1800 + 3 * 600,
    });
    expect(order.items).toEqual([
      {
        productId: "prod_mug",
        productName: "Enamel Camp Mug",
        unitPriceCents: 1800,
        quantity: 2,
        lineTotalCents: 3600,
      },
      {
        productId: "prod_stickers",
        productName: "Sticker Pack",
        unitPriceCents: 600,
        quantity: 3,
        lineTotalCents: 1800,
      },
    ]);
    expect(order.history).toHaveLength(1);
    expect(order.history[0]).toMatchObject({ fromStatus: null, toStatus: "pending" });
    expect(order.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("returns the created order from the detail and list endpoints", async () => {
    const created = await createOrder([{ productId: "prod_bottle", quantity: 1 }]);
    const detail = await call("GET", `/api/orders/${created.body.order.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.order).toEqual(created.body.order);

    const list = await call("GET", "/api/orders");
    expect(list.body.orders.map((o: { id: string }) => o.id)).toContain(created.body.order.id);
  });

  it("creates separate orders for separate idempotency keys", async () => {
    const items = [{ productId: "prod_tee", quantity: 1 }];
    const first = await createOrder(items, newKey());
    const second = await createOrder(items, newKey());
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.order.id).not.toBe(first.body.order.id);
  });

  describe("Idempotency-Key validation", () => {
    it.each([
      ["missing", undefined],
      ["empty", ""],
      ["too short", "abc"],
      ["illegal characters", "key with spaces!!"],
      ["too long", "k".repeat(129)],
    ])("rejects a %s key with 400 and writes nothing", async (_label, key) => {
      const before = await countRows();
      const headers: Record<string, string> = key === undefined ? {} : { "Idempotency-Key": key };
      const { status, body } = await call("POST", "/api/orders", {
        headers,
        body: { items: [{ productId: "prod_mug", quantity: 1 }] },
      });
      expect(status).toBe(400);
      expect(body.error.code).toBe("INVALID_IDEMPOTENCY_KEY");
      expect(await countRows()).toEqual(before);
    });
  });

  describe("body validation", () => {
    it.each([
      ["zero quantity", { items: [{ productId: "prod_mug", quantity: 0 }] }],
      ["negative quantity", { items: [{ productId: "prod_mug", quantity: -2 }] }],
      ["fractional quantity", { items: [{ productId: "prod_mug", quantity: 1.5 }] }],
      ["string quantity", { items: [{ productId: "prod_mug", quantity: "2" }] }],
      ["quantity above limit", { items: [{ productId: "prod_mug", quantity: 100 }] }],
      ["unknown product", { items: [{ productId: "prod_unknown", quantity: 1 }] }],
      [
        "valid line followed by unknown product",
        {
          items: [
            { productId: "prod_mug", quantity: 1 },
            { productId: "prod_unknown", quantity: 1 },
          ],
        },
      ],
      [
        "duplicate product lines",
        {
          items: [
            { productId: "prod_mug", quantity: 1 },
            { productId: "prod_mug", quantity: 2 },
          ],
        },
      ],
      ["empty items", { items: [] }],
      ["missing items", {}],
      ["array body", []],
    ])("rejects %s with 400 and leaves no rows", async (_label, payload) => {
      const before = await countRows();
      const { status, body } = await call("POST", "/api/orders", {
        headers: { "Idempotency-Key": newKey() },
        body: payload,
      });
      expect(status).toBe(400);
      expect(body.error.code).toBe("VALIDATION_FAILED");
      expect(await countRows()).toEqual(before);
    });

    it("rejects malformed JSON", async () => {
      const before = await countRows();
      const { status, body } = await call("POST", "/api/orders", {
        headers: { "Idempotency-Key": newKey() },
        body: "{not json",
      });
      expect(status).toBe(400);
      expect(body.error.code).toBe("VALIDATION_FAILED");
      expect(await countRows()).toEqual(before);
    });
  });
});

describe("GET /api/orders/:id", () => {
  it("returns 404 for a missing order", async () => {
    const { status, body } = await call("GET", "/api/orders/ord_does_not_exist");
    expect(status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
