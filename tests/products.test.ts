import { beforeAll, describe, expect, it } from "vitest";
import { call, resetToFixtures } from "./helpers";

describe("GET /api/products", () => {
  beforeAll(resetToFixtures);

  it("lists active products with integer prices", async () => {
    const { status, body } = await call("GET", "/api/products");
    expect(status).toBe(200);
    expect(body.products).toHaveLength(5);
    for (const product of body.products) {
      expect(Number.isInteger(product.priceCents)).toBe(true);
      expect(product.priceCents).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("routing", () => {
  it("returns a JSON 404 for unknown API routes", async () => {
    const { status, body } = await call("GET", "/api/nope");
    expect(status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 405 for unsupported methods on known routes", async () => {
    const { status, body } = await call("DELETE", "/api/orders");
    expect(status).toBe(405);
    expect(body.error.code).toBe("METHOD_NOT_ALLOWED");
  });
});
