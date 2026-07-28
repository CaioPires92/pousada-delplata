import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const workspaceRoot = path.resolve(import.meta.dirname, "../../..");
const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "delplata-crm-tests-"));
const databasePath = path.join(temporaryDirectory, "crm-test.db").replaceAll("\\", "/");
const databaseUrl = `file:${databasePath}`;

const testEnvironment = {
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: databaseUrl,
  DATABASE_AUTH_TOKEN: "",
  N8N_ENABLED: "false",
  N8N_WEBHOOK_URL: "",
  OPENAI_API_KEY: "",
  EVOLUTION_API_URL: "",
  EVOLUTION_API_KEY: "",
};

const nodeExecutable = process.execPath;
const prismaCli = path.join(workspaceRoot, "node_modules/prisma/build/index.js");
const vitestCli = path.join(workspaceRoot, "node_modules/vitest/vitest.mjs");
const crmTestTargets = [
  "src/lib/crm",
  "src/lib/availability/quote-service.test.ts",
  "src/lib/availability/routes-contract.test.ts",
  "src/app/api/crm",
  "src/app/api/whatsapp",
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
      if (signal) {
        reject(new Error(`Process terminated by signal ${signal}`));
        return;
      }

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
    throw new Error(`Failed to prepare isolated CRM database (exit ${schemaExitCode})`);
  }

  exitCode = await run(nodeExecutable, [
    vitestCli,
    "run",
    ...crmTestTargets,
    ...process.argv.slice(2),
  ]);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

process.exitCode = exitCode;
