import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { OrdersRepo } from "../src/repo/orders-repo";
import { countRows, resetToFixtures } from "./helpers";

describe("OrdersRepo.applyTransition", () => {
  beforeEach(resetToFixtures);

  it("applies the update and history row together when the expected status matches", async () => {
    const repo = new OrdersRepo(env.DB);
    const before = await countRows();

    const applied = await repo.applyTransition(
      "ord_seed_pending",
      "pending",
      "confirmed",
      "2026-02-01T00:00:00.000Z",
    );

    expect(applied).toBe(true);
    const order = await repo.findById("ord_seed_pending");
    expect(order?.status).toBe("confirmed");
    expect(order?.updatedAt).toBe("2026-02-01T00:00:00.000Z");
    expect(order?.history.at(-1)).toMatchObject({
      fromStatus: "pending",
      toStatus: "confirmed",
      at: "2026-02-01T00:00:00.000Z",
    });
    expect((await countRows()).history).toBe(before.history + 1);
  });

  it("writes nothing when the stored status no longer matches the expected status", async () => {
    const repo = new OrdersRepo(env.DB);
    const before = await repo.findById("ord_seed_confirmed");
    const rowsBefore = await countRows();

    const applied = await repo.applyTransition(
      "ord_seed_confirmed",
      "pending",
      "cancelled",
      "2026-02-01T00:00:00.000Z",
    );

    expect(applied).toBe(false);
    expect(await repo.findById("ord_seed_confirmed")).toEqual(before);
    expect(await countRows()).toEqual(rowsBefore);
  });
});
