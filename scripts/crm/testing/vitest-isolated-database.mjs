import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

function isDatabaseCreatedByCrmRunner(databaseUrl) {
  return /delplata-crm-(tests|security|load|drill)-/.test(databaseUrl ?? "");
}

export default function setup() {
  if (isDatabaseCreatedByCrmRunner(process.env.DATABASE_URL)) return;

  const workspaceRoot = process.cwd();
  const temporaryDirectory = mkdtempSync(path.join(tmpdir(), "delplata-vitest-"));
  const databasePath = path.join(temporaryDirectory, "vitest.db").replaceAll("\\", "/");

  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = `file:${databasePath}`;
  process.env.DATABASE_AUTH_TOKEN = "";
  process.env.N8N_ENABLED = "false";
  process.env.N8N_WEBHOOK_URL = "";
  process.env.OPENAI_API_KEY = "";
  process.env.GEMINI_API_KEY = "";
  process.env.GOOGLE_API_KEY = "";
  process.env.EVOLUTION_API_URL = "";
  process.env.EVOLUTION_API_KEY = "";

  execFileSync(process.execPath, [
    path.join(workspaceRoot, "node_modules/prisma/build/index.js"),
    "db",
    "push",
    "--schema",
    "prisma/schema.prisma",
    "--skip-generate",
  ], {
    cwd: workspaceRoot,
    env: process.env,
    stdio: "inherit",
  });

  return () => {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  };
}
