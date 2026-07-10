const API_URL = String(process.env.EVOLUTION_API_URL || 'http://localhost:8080').replace(/\/$/, '');
const API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME;
const WEBHOOK_BASE_URL = String(
  process.env.CRM_WEBHOOK_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.BASE_URL ||
    'http://localhost:3001',
).replace(/\/$/, '');

function resolveWebhookBaseUrl(rawBaseUrl: string) {
  try {
    const url = new URL(rawBaseUrl);
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      url.hostname = 'host.docker.internal';
    }
    return url.toString().replace(/\/$/, '');
  } catch {
    return rawBaseUrl;
  }
}

const WEBHOOK_URL = process.env.CRM_WEBHOOK_URL || `${resolveWebhookBaseUrl(WEBHOOK_BASE_URL)}/api/whatsapp/webhook`;

async function setupWebhook() {
  if (!API_KEY || !INSTANCE_NAME) {
    throw new Error('Missing EVOLUTION_API_KEY or EVOLUTION_INSTANCE_NAME in environment');
  }

  console.log(`🚀 Iniciando configuração do Webhook para instância: ${INSTANCE_NAME}`);
  console.log(`🔗 Alvo: ${WEBHOOK_URL}`);

  try {
    const response = await fetch(`${API_URL}/webhook/set/${INSTANCE_NAME}`, {
      method: 'POST',
      headers: {
        apikey: API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url: WEBHOOK_URL,
          byEvents: true,
          base64: false,
          events: [
            "MESSAGES_UPSERT",
            "MESSAGES_UPDATE",
            "MESSAGES_DELETE",
            "SEND_MESSAGE"
          ]
        }
      })
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ Webhook configurado com sucesso!');
      console.log('Resposta da Evolution:', JSON.stringify(data, null, 2));
    } else {
      console.error('❌ Erro da Evolution:', JSON.stringify(data, null, 2));
    }
  } catch (error: any) {
    console.error('❌ Erro de conexão:', error.message);
  }
}

setupWebhook();
