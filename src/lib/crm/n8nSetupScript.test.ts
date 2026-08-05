import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const script = "scripts/crm/integration/setup-n8n.mjs";

function runSetup(overrides: Record<string, string>) {
  return spawnSync(process.execPath, [script], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      N8N_SETUP_ENABLED: "true",
      N8N_SETUP_DRY_RUN: "true",
      N8N_WEBHOOK_URL: "http://localhost:5678/webhook/crm-delplata-events",
      N8N_WEBHOOK_TOKEN: "n8n-exclusive-token-with-at-least-32-characters",
      CRM_INTERNAL_API_TOKEN: "different-crm-token",
      EVOLUTION_API_KEY: "different-evolution-key",
      EVOLUTION_WEBHOOK_SECRET: "different-webhook-secret",
      ...overrides,
    },
  });
}

describe("n8n local setup script", () => {
  it("validates the safe inactive workflow without importing in dry-run mode", () => {
    const result = runSetup({});

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: true,
      dryRun: true,
      workflowId: "crm-delplata-event-ingress",
    });
    expect(result.stdout).not.toContain("n8n-exclusive-token");
  });

  it("rejects reuse of the CRM internal token", () => {
    const result = runSetup({
      N8N_WEBHOOK_TOKEN: "same-token-with-at-least-32-characters-long",
      CRM_INTERNAL_API_TOKEN: "same-token-with-at-least-32-characters-long",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("deve ser um segredo exclusivo");
    expect(result.stderr).not.toContain("same-token-with-at-least");
  });

  it("rejects the ephemeral webhook-test URL", () => {
    const result = runSetup({
      N8N_WEBHOOK_URL: "http://localhost:5678/webhook-test/crm-delplata-events",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("/webhook/crm-delplata-events");
  });
});
