import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const workspaceRoot = path.resolve(import.meta.dirname, "../../..");
const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "delplata-crm-load-"));
const databaseUrl = `file:${path.join(temporaryDirectory, "crm-load.db").replaceAll("\\", "/")}`;
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

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: workspaceRoot, env: environment, stdio: "inherit", shell: false });
    child.once("error", reject);
    child.once("exit", code => resolve(code ?? 1));
  });
}

let exitCode = 1;
try {
  const prismaCli = path.join(workspaceRoot, "node_modules/prisma/build/index.js");
  const vitestCli = path.join(workspaceRoot, "node_modules/vitest/vitest.mjs");
  const schemaCode = await run(process.execPath, [prismaCli, "db", "push", "--schema", "prisma/schema.prisma", "--skip-generate"]);
  if (schemaCode !== 0) throw new Error(`Failed to prepare load database (exit ${schemaCode})`);
  exitCode = await run(process.execPath, [vitestCli, "run", "scripts/crm/testing/crm-load-profile.test.ts", "--no-file-parallelism"]);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
process.exitCode = exitCode;
