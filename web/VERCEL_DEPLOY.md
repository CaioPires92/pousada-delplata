# Guia de Deploy na Vercel

Este guia explica como colocar seu projeto **Pousada Delplata** no ar usando a Vercel.

## 1. Pré-requisitos

- Seu código deve estar no GitHub (já está!).
- Você precisa de uma conta na [Vercel](https://vercel.com).

## 2. Importar o Projeto

1.  Acesse o [Dashboard da Vercel](https://vercel.com/dashboard).
2.  Clique em **"Add New..."** -> **"Project"**.
3.  Encontre o repositório `pousada-delplata` na lista e clique em **"Import"**.

## 3. Configuração do Projeto (IMPORTANTE)

Na tela de configuração ("Configure Project"), preste atenção nestes detalhes:

### Framework Preset
- Deve detectar automaticamente como **Next.js**.

### Root Directory (Diretório Raiz)
- ⚠️ **MUITO IMPORTANTE**: Como seu projeto está dentro da pasta `web`, você precisa clicar em **"Edit"** ao lado de "Root Directory".
- Selecione a pasta `web`.

### Environment Variables (Variáveis de Ambiente)
Você precisa adicionar as variáveis de produção. Copie os valores do seu arquivo `.env` (sem espaços!):

| Nome | Valor (Exemplo) |
|------|-----------------|
| `DATABASE_URL` | `libsql://pousada-delplata...turso.io` |
| `DATABASE_AUTH_TOKEN` | `eyJhbGciOi...` (Seu token longo do Turso) |
| `NEXT_PUBLIC_MP_PUBLIC_KEY` | `TEST-...` (Sua chave pública do Mercado Pago) |
| `MP_ACCESS_TOKEN` | `TEST-...` (Seu token de acesso do Mercado Pago) |
| `MP_WEBHOOK_SECRET` | `...` (Secret para validar Webhook - Opcional mas recomendado) |
| `ADMIN_JWT_SECRET` | Crie uma senha MUITO segura e longa (ex: `openssl rand -hex 32`) |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | Seu email do Gmail |
| `SMTP_PASS` | Sua senha de app do Gmail |
| `NEXT_PUBLIC_APP_URL` | Deixe vazio por enquanto, ou coloque a URL que a Vercel gerar depois |

**Dica:** Você pode copiar todo o conteúdo do seu `.env` e colar na primeira caixa de entrada da Vercel; ela geralmente faz o parse automático.

## 4. Deploy

1.  Clique em **"Deploy"**.
2.  A Vercel vai iniciar o build.
3.  Aguarde alguns minutos.
    - Ela vai rodar `npm install`.
    - Depois `prisma generate`.
    - Depois `next build --webpack`.

Se tudo der certo, você verá a tela de "Congratulations!".

## 5. Pós-Deploy

### Webhooks do Mercado Pago
Depois que o site estiver no ar, você terá uma URL (ex: `https://pousada-delplata.vercel.app`).
Você precisará atualizar a variável `NEXT_PUBLIC_APP_URL` nas configurações do projeto na Vercel para essa nova URL e fazer um "Redeploy" (ou esperar o próximo push) para que os links de retorno do Mercado Pago funcionem corretamente.

### Monitoramento
Se der erro no build, verifique os logs na Vercel. Como já corrigimos o problema do Webpack e do Turso, deve passar direto!
