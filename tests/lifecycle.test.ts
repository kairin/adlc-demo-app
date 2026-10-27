import { describe, expect, it } from "vitest";
import { ALLOWED_TRANSITIONS, canTransition, isTerminal } from "../src/domain/lifecycle";
import { ORDER_STATUSES } from "../src/domain/types";

describe("order lifecycle table", () => {
  it("matches the documented transitions", () => {
    expect(ALLOWED_TRANSITIONS).toEqual({
      pending: ["confirmed", "cancelled"],
      confirmed: ["shipped", "cancelled"],
      shipped: ["delivered"],
      delivered: [],
      cancelled: [],
    });
  });

  it("never allows returning to pending", () => {
    for (const status of ORDER_STATUSES) {
      expect(canTransition(status, "pending")).toBe(false);
    }
  });

  it("marks delivered and cancelled as terminal", () => {
    expect(ORDER_STATUSES.filter(isTerminal)).toEqual(["delivered", "cancelled"]);
  });
});
