import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const root = path.resolve(import.meta.dirname, "../../..");
const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "delplata-crm-drill-"));
const databaseUrl = `file:${path.join(temporaryDirectory, "drill.db").replaceAll("\\", "/")}`;
const environment = {
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: databaseUrl,
  DATABASE_AUTH_TOKEN: "",
  N8N_ENABLED: "false",
  OPENAI_API_KEY: "",
  EVOLUTION_API_URL: "",
  EVOLUTION_API_KEY: "",
};

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: root, env: environment, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", code => resolve(code ?? 1));
  });
}

let exitCode = 1;
try {
  const schemaCode = await run([
    path.join(root, "node_modules/prisma/build/index.js"),
    "db", "push", "--schema", "prisma/schema.prisma", "--skip-generate",
  ]);
  if (schemaCode !== 0) throw new Error(`Failed to prepare drill database (exit ${schemaCode})`);
  exitCode = await run([
    path.join(root, "node_modules/vitest/vitest.mjs"),
    "run", "--no-file-parallelism", "scripts/crm/testing/crm-operational-drill.test.ts",
  ]);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

process.exitCode = exitCode;
