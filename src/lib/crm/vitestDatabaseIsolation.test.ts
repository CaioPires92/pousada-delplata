import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Vitest database isolation", () => {
  it("never defaults direct Vitest runs to prisma/dev.db", () => {
    const setup = readFileSync(
      resolve(process.cwd(), "scripts/crm/testing/vitest-isolated-database.mjs"),
      "utf8",
    );
    const browserConfig = readFileSync(resolve(process.cwd(), "vitest.config.ts"), "utf8");
    const nodeConfig = readFileSync(resolve(process.cwd(), "vitest.node.config.ts"), "utf8");

    expect(setup).toContain("mkdtempSync");
    expect(setup).toContain("process.env.DATABASE_URL = `file:${databasePath}`");
    expect(browserConfig).toContain("vitest-isolated-database.mjs");
    expect(nodeConfig).toContain("vitest-isolated-database.mjs");
  });
});
