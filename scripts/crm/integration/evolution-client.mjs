import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const command = process.argv[2];
const cwd = process.cwd();
const qrHtmlPath = path.join(cwd, "scratch", "qrcode.html");

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export function getConfig() {
  const apiUrl = requireEnv("EVOLUTION_API_URL").replace(/\/$/, "");
  const apiKey = requireEnv("EVOLUTION_API_KEY");
  const instanceName = requireEnv("EVOLUTION_INSTANCE_NAME");
  const appBaseUrl =
    process.env.CRM_WEBHOOK_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
    process.env.BASE_URL?.trim() ||
    "http://localhost:3001";

  return {
    apiUrl,
    apiKey,
    appBaseUrl: appBaseUrl.replace(/\/$/, ""),
    instanceName,
  };
}

function resolveWebhookBaseUrl(rawBaseUrl) {
  try {
    const url = new URL(rawBaseUrl);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      url.hostname = "host.docker.internal";
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return rawBaseUrl;
  }
}

export async function evoFetch(url, init = {}) {
  const { apiKey } = getConfig();
  const response = await fetch(url, {
    ...init,
    headers: {
      apikey: apiKey,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Evolution API request failed with status ${response.status}`);
  }
  return response.json().catch(() => null);
}

async function evoFetchAllow404(url, init = {}) {
  const { apiKey } = getConfig();
  const response = await fetch(url, {
    ...init,
    headers: {
      apikey: apiKey,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  if (response.status === 404) {
    return { notFound: true, data: null };
  }

  if (!response.ok) {
    throw new Error(`Evolution API request failed with status ${response.status}`);
  }

  return { notFound: false, data: await response.json().catch(() => null) };
}

function renderQrHtml(base64, instanceName) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>QR Code - ${instanceName}</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: #f4f6f8;
      color: #1f2937;
      font-family: Arial, sans-serif;
    }
    .card {
      width: min(92vw, 560px);
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 20px 50px rgba(15, 23, 42, 0.12);
      padding: 28px;
      text-align: center;
    }
    img {
      width: min(78vw, 380px);
      height: auto;
      margin: 16px auto;
      display: block;
      background: #fff;
      border-radius: 12px;
      border: 1px solid #e5e7eb;
    }
    code {
      background: #f3f4f6;
      border-radius: 6px;
      padding: 2px 6px;
    }
  </style>
</head>
<body>
  <main class="card">
    <h1>Conecte o WhatsApp da pousada</h1>
    <p>Instância: <code>${instanceName}</code></p>
    <p>Abra o WhatsApp no celular, vá em Aparelhos conectados e escaneie o QR code abaixo.</p>
    <img src="${base64}" alt="QR Code do WhatsApp" />
    <p>Se expirar, rode o comando de QR novamente.</p>
  </main>
</body>
</html>`;
}

function persistQr(base64, instanceName) {
  fs.mkdirSync(path.dirname(qrHtmlPath), { recursive: true });
  fs.writeFileSync(qrHtmlPath, renderQrHtml(base64, instanceName));
  console.log(`QR salvo em: ${qrHtmlPath}`);
}

export async function createInstance() {
  const { apiUrl, instanceName } = getConfig();
  const data = await evoFetch(`${apiUrl}/instance/create`, {
    method: "POST",
    body: JSON.stringify({
      instanceName,
      integration: "WHATSAPP-BAILEYS",
      qrcode: true,
    }),
  });

  console.log(`Instancia ${instanceName} criada.`);

  if (data?.qrcode?.base64) {
    persistQr(data.qrcode.base64, instanceName);
  }
}

export async function deleteInstance() {
  const { apiUrl, instanceName } = getConfig();
  const result = await evoFetchAllow404(`${apiUrl}/instance/delete/${encodeURIComponent(instanceName)}`, {
    method: "DELETE",
  });
  if (result.notFound) {
    console.log(`Instancia ${instanceName} nao existe na Evolution. Seguindo em frente.`);
    return;
  }
  console.log(`Instancia ${instanceName} removida.`);
}

export async function connectInstance() {
  const { apiUrl, instanceName } = getConfig();
  const data = await evoFetch(`${apiUrl}/instance/connect/${encodeURIComponent(instanceName)}`);
  const base64 = data?.base64 || data?.qrcode?.base64;
  if (base64) {
    persistQr(base64, instanceName);
  }
}

export async function waitForQr() {
  const { apiUrl, instanceName } = getConfig();

  for (let attempt = 1; attempt <= 20; attempt += 1) {
    const data = await evoFetch(`${apiUrl}/instance/connect/${encodeURIComponent(instanceName)}`);
    console.log(`Tentativa ${attempt}: aguardando QR.`);

    const base64 = data?.base64 || data?.qrcode?.base64;
    if (base64) {
      persistQr(base64, instanceName);
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error("QR code nao foi gerado a tempo.");
}

export async function setupWebhook() {
  const { apiUrl, appBaseUrl, instanceName } = getConfig();
  const webhookBaseUrl = resolveWebhookBaseUrl(appBaseUrl);
  const webhookUrl = process.env.CRM_WEBHOOK_URL?.trim() || `${webhookBaseUrl}/api/whatsapp/webhook`;
  const webhookSecret = requireEnv("EVOLUTION_WEBHOOK_SECRET");

  const data = await evoFetch(`${apiUrl}/webhook/set/${encodeURIComponent(instanceName)}`, {
    method: "POST",
    body: JSON.stringify({
      webhook: {
        enabled: true,
        url: webhookUrl,
        byEvents: true,
        base64: false,
        headers: { "x-evolution-secret": webhookSecret },
        events: ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "MESSAGES_DELETE", "SEND_MESSAGE"],
      },
    }),
  });

  console.log(`Webhook configurado para ${webhookUrl}`);
  return data;
}

export async function connectionState() {
  const { apiUrl, instanceName } = getConfig();
  const data = await evoFetch(`${apiUrl}/instance/connectionState/${encodeURIComponent(instanceName)}`);
  const state = data?.instance?.state || data?.instance?.status || data?.state || data?.status || "unknown";
  console.log(`Estado da instancia ${instanceName}: ${String(state).slice(0, 50)}`);
  return state;
}

export async function findWebhook() {
  const { apiUrl, instanceName } = getConfig();
  const data = await evoFetch(`${apiUrl}/webhook/find/${encodeURIComponent(instanceName)}`);
  console.log(`Webhook da instancia ${instanceName}: ${data?.enabled ? "ativo" : "inativo"}`);
  return data;
}

const commands = {
  "create-instance": createInstance,
  "delete-instance": deleteInstance,
  "connect-instance": connectInstance,
  "wait-for-qr": waitForQr,
  "setup-webhook": setupWebhook,
  "connection-state": connectionState,
  "find-webhook": findWebhook,
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!command || !commands[command]) {
    console.error("Uso: evolution-client.mjs <create-instance|delete-instance|connect-instance|wait-for-qr|setup-webhook|connection-state|find-webhook>");
    process.exitCode = 1;
  } else {
    commands[command]().catch((error) => {
      console.error(error instanceof Error ? error.message : "Evolution operation failed");
      process.exitCode = 1;
    });
  }
}
