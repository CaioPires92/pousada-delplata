import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const contents = readFileSync(resolve(process.cwd(), ".env.example"), "utf8");
const requiredEmptyKeys = [
  "EVOLUTION_API_URL",
  "EVOLUTION_API_KEY",
  "EVOLUTION_INSTANCE_NAME",
  "EVOLUTION_WEBHOOK_SECRET",
  "EVOLUTION_TEST_RECIPIENT",
];

describe("sanitized Evolution environment example", () => {
  it.each(requiredEmptyKeys)("documents %s once without a value", key => {
    const matches = contents.match(new RegExp(`^${key}=$`, "gm")) ?? [];
    expect(matches).toHaveLength(1);
  });

  it("keeps Evolution active by default and E2E disabled", () => {
    expect(contents.split(/\r?\n/)).toContain("WHATSAPP_PROVIDER=evolution");
    expect(contents.split(/\r?\n/)).toContain("EVOLUTION_E2E_ENABLED=false");
  });
});
