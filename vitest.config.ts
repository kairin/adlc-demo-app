import { readFile } from "node:fs/promises";
import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  const root = import.meta.dirname;
  const migrations = await readD1Migrations(path.join(root, "migrations"));
  const seedSql = await readFile(path.join(root, "seeds", "seed.sql"), "utf8");

  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: { TEST_MIGRATIONS: migrations, TEST_SEED_SQL: seedSql },
        },
      }),
    ],
    test: {
      include: ["tests/**/*.test.ts"],
      setupFiles: ["./tests/setup/apply-migrations.ts"],
    },
  };
});
