import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("shadow rollout report", () => {
  it("uses the same rollout gate and runtime settings as production", () => {
    const source = readFileSync(
      resolve(process.cwd(), "scripts/crm/testing/report-shadow.ts"),
      "utf8",
    );

    expect(source).toContain("evaluateAutoReplyRolloutGate(now, intent)");
    expect(source).toContain("getChatbotRuntimeSettings()");
    expect(source).not.toContain("shadow.length > 0 && authorizedActions === 0");
  });
});
