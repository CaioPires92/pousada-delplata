// scripts/setup-webhook.ts
const API_URL = 'http://localhost:8080';
const API_KEY = '8129ABA9826B-420A-88E0-6B2DDE20482B';
const INSTANCE_NAME = 'delplata2026';

// URL do seu Next.js (Webhook)
// Se a Evolution estiver no Docker, usamos host.docker.internal
// Se estiver fora do Docker, usamos localhost
const WEBHOOK_URL = 'http://host.docker.internal:3001/api/whatsapp/webhook';

async function setupWebhook() {
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
          webhook_by_events: true,
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
      console.log('\n---');
      console.log('💡 Dica: Se as mensagens ainda não aparecerem e você NÃO usa Docker, rode o script novamente mudando a linha 8 para localhost.');
    } else {
      console.error('❌ Erro da Evolution:', JSON.stringify(data, null, 2));
    }
  } catch (error: any) {
    console.error('❌ Erro de conexão:', error.message);
  }
}

setupWebhook();
