import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const CONTAINER = process.env.N8N_CONTAINER_NAME?.trim() || "n8n";
const CREDENTIAL_ID = "crm-delplata-header-auth";
const WORKFLOW_ID = "crm-delplata-event-ingress";
const EXPECTED_PATH = "/webhook/crm-delplata-events";

function requireSafeConfiguration() {
  if (process.env.N8N_SETUP_ENABLED !== "true") {
    throw new Error("Defina N8N_SETUP_ENABLED=true para autorizar a importação local.");
  }

  const token = process.env.N8N_WEBHOOK_TOKEN?.trim();
  if (!token || token.length < 32) throw new Error("N8N_WEBHOOK_TOKEN deve ter ao menos 32 caracteres.");

  const forbidden = [
    process.env.CRM_INTERNAL_API_TOKEN,
    process.env.EVOLUTION_API_KEY,
    process.env.EVOLUTION_WEBHOOK_SECRET,
  ].filter(Boolean).map(value => value.trim());
  if (forbidden.includes(token)) throw new Error("N8N_WEBHOOK_TOKEN deve ser um segredo exclusivo.");

  const webhookUrl = new URL(process.env.N8N_WEBHOOK_URL ?? "");
  if (!['http:', 'https:'].includes(webhookUrl.protocol) || webhookUrl.pathname !== EXPECTED_PATH) {
    throw new Error(`N8N_WEBHOOK_URL deve terminar em ${EXPECTED_PATH}.`);
  }

  return { token, webhookUrl: webhookUrl.toString() };
}

function runDocker(args, options = {}) {
  const result = spawnSync("docker", args, {
    encoding: "utf8",
    input: options.input,
    env: process.env,
  });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
  if (result.status !== 0) throw new Error(`Falha ao executar Docker: ${output.slice(0, 500)}`);
  return output;
}

async function main() {
  const { token, webhookUrl } = requireSafeConfiguration();
  const workflowPath = resolve("n8n/workflows/crm-event-ingress.json");
  const workflow = JSON.parse(await readFile(workflowPath, "utf8"));

  if (workflow.id !== WORKFLOW_ID || workflow.active !== false) {
    throw new Error("O workflow versionado deve possuir o ID esperado e permanecer inativo.");
  }
  const webhookNode = workflow.nodes?.find(node => node.type === "n8n-nodes-base.webhook");
  if (webhookNode?.credentials?.httpHeaderAuth?.id !== CREDENTIAL_ID) {
    throw new Error("O workflow não referencia a credencial Header Auth esperada.");
  }

  if (process.env.N8N_SETUP_DRY_RUN === "true") {
    console.log(JSON.stringify({ ok: true, dryRun: true, workflowId: WORKFLOW_ID, webhookUrl }));
    return;
  }

  runDocker(["inspect", "--format={{.State.Running}}", CONTAINER]);
  const credentials = [{
    id: CREDENTIAL_ID,
    name: "CRM Delplata - Bearer",
    type: "httpHeaderAuth",
    data: { name: "Authorization", value: `Bearer ${token}` },
  }];

  const credentialOutput = runDocker([
    "exec", "-i", CONTAINER, "n8n", "import:credentials", "--input=/dev/stdin",
  ], { input: JSON.stringify(credentials) });
  if (!credentialOutput.includes("Successfully imported 1 credential")) {
    throw new Error("O n8n não confirmou a importação da credencial.");
  }

  const workflowOutput = runDocker([
    "exec", "-i", CONTAINER, "n8n", "import:workflow", "--input=/dev/stdin",
  ], { input: JSON.stringify(workflow) });
  if (!workflowOutput.includes("Successfully imported 1 workflow")) {
    throw new Error("O n8n não confirmou a importação do workflow.");
  }

  const workflowIds = runDocker(["exec", CONTAINER, "n8n", "list:workflow", "--onlyId"]);
  if (!workflowIds.split(/\s+/).includes(WORKFLOW_ID)) {
    throw new Error("O workflow importado não apareceu na listagem do n8n.");
  }

  console.log(JSON.stringify({ ok: true, active: false, workflowId: WORKFLOW_ID, webhookUrl }));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : "n8n_setup_failed");
  process.exitCode = 1;
});
