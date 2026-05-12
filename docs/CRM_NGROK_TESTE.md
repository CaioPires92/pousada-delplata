# CRM WhatsApp — ngrok para testes

## Evolution API local

Quando a Evolution API estiver rodando localmente em `http://localhost:8080`, abra um terminal separado e rode:

```bash
ngrok http 8080
```

Deixe esse terminal aberto enquanto estiver testando envio pelo CRM em produção.

A Vercel deve usar a URL HTTPS mostrada pelo ngrok em `Forwarding`, por exemplo:

```text
EVOLUTION_API_URL=https://exemplo.ngrok-free.dev
```

Se fechar o terminal do ngrok, apertar `Ctrl+C`, reiniciar o PC ou a internet cair, a URL deixa de funcionar. Nesse caso, rode `ngrok http 8080` de novo, copie a nova URL HTTPS e atualize `EVOLUTION_API_URL` na Vercel, depois faça redeploy.

Para produção definitiva, troque o ngrok por uma Evolution hospedada em servidor/VPS com HTTPS fixo.

## n8n local

Quando o n8n estiver rodando localmente em `http://localhost:5678`, a Vercel tambem precisa de uma URL publica para chamar o webhook.

Como o ngrok ja costuma ficar ocupado com a Evolution, use Cloudflare Tunnel para o n8n:

```bash
docker run --rm -it cloudflare/cloudflared:latest tunnel --url http://host.docker.internal:5678
```

Se `host.docker.internal` nao funcionar no WSL, use:

```bash
docker run --rm -it --network host cloudflare/cloudflared:latest tunnel --url http://localhost:5678
```

A URL final do webhook fica:

```text
N8N_WEBHOOK_URL=https://exemplo.trycloudflare.com/webhook/crm-events
```

O workflow do n8n precisa estar ativo. A URL `/webhook-test/crm-events` serve apenas para teste depois de clicar em `Execute workflow`; a Vercel deve usar `/webhook/crm-events`.

## Checklist rapido de terminais abertos

Durante teste local completo, manter aberto:

```text
Evolution API Docker
n8n Docker
ngrok http 8080
cloudflared tunnel para 5678
```
