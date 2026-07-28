import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REQUIRED_META_VARIABLES = [
  "META_WHATSAPP_ACCESS_TOKEN",
  "META_WHATSAPP_APP_SECRET",
  "META_WHATSAPP_VERIFY_TOKEN",
  "META_WHATSAPP_PHONE_NUMBER_ID",
  "META_WHATSAPP_BUSINESS_ACCOUNT_ID",
  "META_WHATSAPP_GRAPH_API_VERSION",
  "META_WHATSAPP_TEST_RECIPIENT",
] as const;

describe("Meta environment example", () => {
  it("declares every Meta variable exactly once without a real value", async () => {
    const contents = await readFile(
      path.join(process.cwd(), ".env.example"),
      "utf8",
    );
    const lines = contents.split(/\r?\n/);

    for (const variable of REQUIRED_META_VARIABLES) {
      const declarations = lines.filter(line => line.startsWith(`${variable}=`));
      expect(declarations, variable).toEqual([`${variable}=`]);
    }
  });

  it("keeps Evolution as the inactive-migration default", async () => {
    const contents = await readFile(
      path.join(process.cwd(), ".env.example"),
      "utf8",
    );

    expect(contents.split(/\r?\n/)).toContain("WHATSAPP_PROVIDER=evolution");
    expect(contents.split(/\r?\n/)).toContain("META_E2E_ENABLED=false");
    expect(contents.split(/\r?\n/)).toContain("META_E2E_WEBHOOK_TIMEOUT_MS=60000");
    expect(contents.split(/\r?\n/)).toContain("META_E2E_WEBHOOK_POLL_INTERVAL_MS=1000");
  });
});
