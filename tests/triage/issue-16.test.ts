import { beforeAll, describe, expect, it } from "vitest";
import { call, countRows, createOrder, newKey, resetToFixtures } from "../helpers";

describe("Issue #16: Idempotency with retries", () => {
  beforeAll(resetToFixtures);

  it("returns the same order when creating with the same idempotency key and items", async () => {
    const key = "retry-demo-0001";
    const items = [{ productId: "prod_mug", quantity: 1 }];

    // First request
    const firstResponse = await createOrder(items, key);
    expect(firstResponse.status).toBe(201);
    const firstOrder = firstResponse.body.order;
    const firstId = firstOrder.id;

    // Second request with same key and items
    const secondResponse = await createOrder(items, key);
    expect(secondResponse.status).toBe(201);
    const secondOrder = secondResponse.body.order;
    const secondId = secondOrder.id;

    // The expected behavior from the architecture docs:
    // "Same key, same normalized payload (sequential retry) → 201 with the same order (same id, items, total). No new rows."
    expect(secondOrder.id).toBe(firstId, "Should return the same order ID on retry");
    expect(secondOrder.items).toEqual(firstOrder.items, "Should return the same items");
    expect(secondOrder.totalCents).toBe(firstOrder.totalCents, "Should return the same total");

    // No duplicate orders should be created
    const counts = await countRows();
    expect(counts.orders).toBe(1, "Should create only one order with the same key");
    expect(counts.items).toBe(1, "Should create only one order item with the same key");
  });

  it("creates exactly one order even when concurrent requests arrive with same idempotency key and items", async () => {
    const key = "retry-demo-0002";
    const items = [{ productId: "prod_stickers", quantity: 2 }];

    // Two requests arrive simultaneously (simulating concurrent retries)
    const [firstResponse, secondResponse] = await Promise.all([
      createOrder(items, key),
      createOrder(items, key),
    ]);

    // Both should return 201 with the same order
    expect([firstResponse.status, secondResponse.status]).toEqual([201, 201]);

    const firstOrder = firstResponse.body.order;
    const secondOrder = secondResponse.body.order;

    expect(firstOrder.id).toBe(secondOrder.id, "Both should return the same order ID");

    // Only one order should be created in the database
    const counts = await countRows();
    expect(counts.orders).toBe(1, "Should create only one order with concurrent same-key requests");
    expect(counts.items).toBe(1, "Should create only one order item with concurrent same-key requests");
  });

  it("reuses the same key for different items and rejects with 409", async () => {
    const key = "retry-demo-0003";
    const items1 = [{ productId: "prod_mug", quantity: 1 }];
    const items2 = [{ productId: "prod_stickers", quantity: 1 }];

    // First request
    const firstResponse = await createOrder(items1, key);
    expect(firstResponse.status).toBe(201);

    // Second request with same key but different items should be rejected
    const secondResponse = await createOrder(items2, key);
    expect(secondResponse.status).toBe(409);
    expect(secondResponse.body.error.code).toBe("IDEMPOTENCY_KEY_REUSED");

    // No new orders should be created
    const counts = await countRows();
    expect(counts.orders).toBe(1, "Should not create a second order with same key and different items");
    expect(counts.items).toBe(1, "Should not create a second order item with same key and different items");
  });
});