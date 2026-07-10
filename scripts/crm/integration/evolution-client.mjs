import fs from "node:fs";
import path from "node:path";

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

function getConfig() {
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

async function evoFetch(url, init = {}) {
  const { apiKey } = getConfig();
  const response = await fetch(url, {
    ...init,
    headers: {
      apikey: apiKey,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(`Evolution API error ${response.status}: ${JSON.stringify(data)}`);
  }

  return data;
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

  const data = await response.json().catch(() => null);

  if (response.status === 404) {
    return { notFound: true, data };
  }

  if (!response.ok) {
    throw new Error(`Evolution API error ${response.status}: ${JSON.stringify(data)}`);
  }

  return { notFound: false, data };
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

async function createInstance() {
  const { apiUrl, instanceName } = getConfig();
  const data = await evoFetch(`${apiUrl}/instance/create`, {
    method: "POST",
    body: JSON.stringify({
      instanceName,
      token: instanceName,
      integration: "WHATSAPP-BAILEYS",
      qrcode: true,
    }),
  });

  console.log(JSON.stringify(data, null, 2));

  if (data?.qrcode?.base64) {
    persistQr(data.qrcode.base64, instanceName);
  }
}

async function deleteInstance() {
  const { apiUrl, instanceName } = getConfig();
  const result = await evoFetchAllow404(`${apiUrl}/instance/delete/${encodeURIComponent(instanceName)}`, {
    method: "DELETE",
  });
  if (result.notFound) {
    console.log(`Instancia ${instanceName} nao existe na Evolution. Seguindo em frente.`);
    return;
  }
  console.log(JSON.stringify(result.data, null, 2));
}

async function connectInstance() {
  const { apiUrl, instanceName } = getConfig();
  const data = await evoFetch(`${apiUrl}/instance/connect/${encodeURIComponent(instanceName)}`);
  console.log(JSON.stringify(data, null, 2));

  const base64 = data?.base64 || data?.qrcode?.base64;
  if (base64) {
    persistQr(base64, instanceName);
  }
}

async function waitForQr() {
  const { apiUrl, instanceName } = getConfig();

  for (let attempt = 1; attempt <= 20; attempt += 1) {
    const data = await evoFetch(`${apiUrl}/instance/connect/${encodeURIComponent(instanceName)}`);
    console.log(`Tentativa ${attempt}:`, JSON.stringify(data));

    const base64 = data?.base64 || data?.qrcode?.base64;
    if (base64) {
      persistQr(base64, instanceName);
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error("QR code nao foi gerado a tempo.");
}

async function setupWebhook() {
  const { apiUrl, appBaseUrl, instanceName } = getConfig();
  const webhookBaseUrl = resolveWebhookBaseUrl(appBaseUrl);
  const webhookUrl = process.env.CRM_WEBHOOK_URL?.trim() || `${webhookBaseUrl}/api/whatsapp/webhook`;

  const data = await evoFetch(`${apiUrl}/webhook/set/${encodeURIComponent(instanceName)}`, {
    method: "POST",
    body: JSON.stringify({
      webhook: {
        enabled: true,
        url: webhookUrl,
        byEvents: true,
        base64: false,
        events: ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "MESSAGES_DELETE", "SEND_MESSAGE"],
      },
    }),
  });

  console.log(`Webhook configurado para ${webhookUrl}`);
  console.log(JSON.stringify(data, null, 2));
}

const commands = {
  "create-instance": createInstance,
  "delete-instance": deleteInstance,
  "connect-instance": connectInstance,
  "wait-for-qr": waitForQr,
  "setup-webhook": setupWebhook,
};

if (!command || !commands[command]) {
  console.error("Uso: node --env-file=.env scripts/crm/integration/evolution-client.mjs <create-instance|delete-instance|connect-instance|wait-for-qr|setup-webhook>");
  process.exit(1);
}

commands[command]().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
