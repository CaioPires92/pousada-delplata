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

## Checklist rapido de terminais abertos

Durante teste local do CRM/WhatsApp, manter aberto:

```text
Evolution API Docker
ngrok http 8080
```
