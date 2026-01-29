## Escopo e princípios
- Manter o MVP como está (sem novas features).
- Endurecer produção em 2 ondas: **P0 (antes de lançar)** e **P1 (logo após lançar)**.
- Evitar refatoração ampla: mudanças locais, diretas e reversíveis.

## P0 — Gestão e rotação de segredos
- **Eliminar segredos versionados**
  - Trocar qualquer valor real em docs/scripts por placeholders.
  - Garantir que `web/.env` continue ignorado e que `web/.env.example` não contenha valores reais.
- **Eliminar vazamento via logs**
  - Remover/substituir logs que imprimem PII/segredos nas rotas críticas.
  - Casos identificados para corrigir:
    - `create-preference` está logando `preferenceData` (inclui nome/email/telefone). Arquivo: [route.ts](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/web/src/app/api/mercadopago/create-preference/route.ts)
    - `admin/login` loga email de tentativa/sucesso. Arquivo: [route.ts](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/web/src/app/api/admin/login/route.ts)
    - `emails/send-confirmation` loga destinatário. Arquivo: [route.ts](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/web/src/app/api/emails/send-confirmation/route.ts)
    - `rates/bulk` loga corpo/updates completos. Arquivo: [route.ts](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/web/src/app/api/rates/bulk/route.ts)
    - `prisma.ts` loga URL do banco e queries em dev. Arquivo: [prisma.ts](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/web/src/lib/prisma.ts)
- **Remover fallback inseguro de segredo**
  - Remover `JWT_SECRET || 'your-secret-key-change-in-production'` e falhar de forma explícita quando `JWT_SECRET` não estiver definido (com mensagem clara). Arquivo: [route.ts](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/web/src/app/api/admin/login/route.ts)
- **Documentar envs obrigatórias para produção**
  - Criar/atualizar um checklist curto com envs obrigatórias, opcionais e o motivo.

## P0 — Webhook Mercado Pago (padronização + previsibilidade)
- **Definir endpoint oficial**
  - Adotar **/api/webhooks/mercadopago** como oficial (já é o `notification_url` usado no create-preference).
- **Desativar/limitar endpoint legado**
  - Transformar **/api/mercadopago/webhook** em:
    - (opção preferida) resposta `410 Gone` em produção, com mensagem “use o endpoint oficial”;
    - ou permitir como fallback somente via env `ALLOW_LEGACY_MP_WEBHOOK=true`.
- **Idempotência real (sem duplicar confirmação/e-mail)**
  - Ajustar o handler para ser idempotente mesmo sob concorrência:
    - usar `updateMany`/transação para só “confirmar” booking quando status ainda não é `CONFIRMED`;
    - enviar e-mail somente quando a atualização realmente ocorrer (`count === 1`).
  - Garantir que status internos fiquem apenas em `PENDING|APPROVED|REJECTED` (Payment) e `PENDING|CONFIRMED|CANCELLED` (Booking).
- **Respostas HTTP e logs de erro**
  - Padronizar retornos:
    - `200` quando processado com sucesso;
    - `4xx` quando payload inválido/assinatura inválida;
    - `5xx/502` quando falha dependência externa (MP API) ou erro interno.
  - Logar erros com contexto mínimo: `paymentId`, `bookingId` (curto), `errorType`, sem PII.

## P1 — Observabilidade básica (Sentry)
- **Adicionar Sentry sem overengineering**
  - Instalar `@sentry/nextjs`.
  - Criar configs padrão (`sentry.client.config.*`, `sentry.server.config.*`, `sentry.edge.config.*`) com `SENTRY_DSN` via env.
  - Habilitar captura automática em runtime do Next e usar `captureException` explicitamente nos `catch` das rotas críticas.
- **Rotas críticas com captura explícita**
  - `/api/bookings`
  - `/api/rates/bulk`
  - Webhook MP (handler unificado)
  - `/api/emails/send-confirmation`

## P1 — Logs operacionais claros e seguros
- **Padronizar formato**
  - Definir um formato único (JSON) com campos fixos: `event`, `level`, `route`, `bookingIdShort`, `paymentId`, `errorType`, `message`.
  - Remover logs de payload bruto e substituir por resumo (ex.: range de datas, quantidade de quartos afetados).
- **Evitar vazamento**
  - Nunca logar: email, telefone, access tokens, secrets, payload completo de MP, SMTP.

## Verificação e entrega
- **Rodar validação local/CI**
  - `lint`, `test:coverage`, `build`.
- **Checklist final de “pronto para produção”**
  - Lista objetiva com:
    - envs obrigatórias definidas;
    - endpoint oficial de webhook configurado no MP;
    - endpoint legado desativado/guardado por env;
    - Sentry ativo (ao menos em server) e testado;
    - logs críticos sem PII.

## Resultado entregue
- Alterações no código (P0 + P1) seguindo as restrições.
- Explicação técnica curta das decisões.
- Checklist final de prontidão para produção.