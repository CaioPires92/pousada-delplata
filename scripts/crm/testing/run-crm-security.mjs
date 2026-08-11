import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const workspaceRoot = path.resolve(import.meta.dirname, "../../..");
const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "delplata-crm-security-"));
const databasePath = path.join(temporaryDirectory, "crm-security.db").replaceAll("\\", "/");

const testEnvironment = {
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: `file:${databasePath}`,
  DATABASE_AUTH_TOKEN: "",
  N8N_ENABLED: "false",
  N8N_WEBHOOK_URL: "",
  OPENAI_API_KEY: "",
  EVOLUTION_API_URL: "http://evolution.test",
  EVOLUTION_API_KEY: "test-key",
  EVOLUTION_INSTANCE_NAME: "test-instance",
};

const nodeExecutable = process.execPath;
const prismaCli = path.join(workspaceRoot, "node_modules/prisma/build/index.js");
const vitestCli = path.join(workspaceRoot, "node_modules/vitest/vitest.mjs");
const securityTargets = [
  "src/app/api/whatsapp/webhook/route.test.ts",
  "src/app/api/crm/internal-actions/route.test.ts",
  "src/app/api/crm/quote/route.test.ts",
  "src/app/api/crm/broadcast/route.test.ts",
  "src/app/api/crm/dead-letter/replay/route.test.ts",
  "src/app/api/coupons/grants/[grantId]/click/route.test.ts",
  "src/lib/crm/aiDecision.test.ts",
  "src/lib/crm/automationSendLimits.test.ts",
  "src/lib/messaging/circuit-breaker.test.ts",
];

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: workspaceRoot,
      env: testEnvironment,
      stdio: "inherit",
      shell: false,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) return reject(new Error(`Process terminated by signal ${signal}`));
      resolve(code ?? 1);
    });
  });
}

let exitCode = 1;
try {
  const schemaExitCode = await run(nodeExecutable, [
    prismaCli,
    "db",
    "push",
    "--schema",
    "prisma/schema.prisma",
    "--skip-generate",
  ]);
  if (schemaExitCode !== 0) {
    throw new Error(`Failed to prepare isolated security database (exit ${schemaExitCode})`);
  }

  exitCode = await run(nodeExecutable, [
    vitestCli,
    "run",
    "--no-file-parallelism",
    ...securityTargets,
  ]);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

process.exitCode = exitCode;
