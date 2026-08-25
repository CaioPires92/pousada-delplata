const fs = require("node:fs");
const path = require("node:path");

const vercelJsonPath = path.join(process.cwd(), "vercel.json");

function fail(message) {
  console.error(`[vercel-crons] ${message}`);
  process.exit(1);
}

function isDailyCron(schedule) {
  return typeof schedule === "string" && /^\d{1,2} \d{1,2} \* \* \*$/.test(schedule.trim());
}

if (!fs.existsSync(vercelJsonPath)) {
  process.exit(0);
}

let config;
try {
  config = JSON.parse(fs.readFileSync(vercelJsonPath, "utf8"));
} catch (error) {
  fail(`Cannot parse vercel.json: ${error.message}`);
}

if (!config || typeof config !== "object") {
  fail("vercel.json must contain a JSON object.");
}

if (!Array.isArray(config.crons) || config.crons.length === 0) {
  process.exit(0);
}

if (config.crons.length > 1) {
  fail(
    `Found ${config.crons.length} cron jobs. Hobby deployments here must keep a single daily cron.`,
  );
}

for (const [index, cron] of config.crons.entries()) {
  if (!cron || typeof cron !== "object") {
    fail(`Cron entry at index ${index} is invalid.`);
  }

  if (typeof cron.path !== "string" || !cron.path.startsWith("/api/cron/")) {
    fail(`Cron entry at index ${index} must target an /api/cron/* path.`);
  }

  if (!isDailyCron(cron.schedule)) {
    fail(
      `Cron "${cron.path}" uses schedule "${cron.schedule}". Hobby guardrail only allows daily schedules like "0 9 * * *".`,
    );
  }
}

process.exit(0);
