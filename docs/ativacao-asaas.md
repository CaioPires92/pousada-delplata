# Ativação do Asaas (Pousada Delplata)

Esta branch troca o pagamento das reservas **novas** do Mercado Pago para o Asaas (checkout hospedado, Pix e cartão em até 3x). Ao fazer o merge, o site passa a abrir o checkout do Asaas. Faça os passos abaixo **antes** do merge.

Não há migração de banco: CPF e endereço vão do navegador direto para o checkout e não são gravados.

## 1. Conta Asaas da pousada

- [ ] Conta aprovada e com Pix e cartão de crédito habilitados.
- [ ] Em *Minha conta → Informações*, cadastre o site `https://www.pousadadelplata.com.br`. O checkout manda o hóspede de volta para `/reservar/confirmacao/...`, e o Asaas pode recusar URLs de retorno de um domínio diferente do cadastrado.
- [ ] Gere a chave de API de **produção** (*Integrações → Chaves de API*). Nunca use a chave de outra pousada.

## 2. Webhook no painel do Asaas

*Integrações → Webhooks → Adicionar*:

- URL: `https://www.pousadadelplata.com.br/api/webhooks/asaas`
- Token de autenticação: um segredo novo com 32 caracteres ou mais (ex.: `openssl rand -hex 32`). É o mesmo valor de `ASAAS_WEBHOOK_TOKEN`.
- Fila ativa e e-mail para avisos de falha preenchido.
- Tipo de envio: **não sequencial** (`NON_SEQUENTIALLY`). Com envio sequencial, um único evento recusado trava todos os seguintes, e a reserva paga não confirma. No cartão parcelado, o Asaas manda um `PAYMENT_CONFIRMED` por parcela, com o valor da parcela; o webhook aceita isso, mas o envio não sequencial evita que outro erro bloqueie a fila.
- Eventos:
  - `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`
  - `PAYMENT_AWAITING_RISK_ANALYSIS`, `PAYMENT_REPROVED_BY_RISK_ANALYSIS`
  - `PAYMENT_REFUNDED`, `PAYMENT_CHARGEBACK_REQUESTED`, `PAYMENT_DELETED`
  - `CHECKOUT_PAID`, `CHECKOUT_CANCELED`, `CHECKOUT_EXPIRED`

Se o webhook responder com erro várias vezes, o Asaas **pausa a fila**. Depois do deploy, confira se ela está ativa.

## 3. Variáveis na Vercel (Production)

| Variável | Valor |
|---|---|
| `ASAAS_API_KEY` | chave de produção do passo 1 |
| `ASAAS_WEBHOOK_TOKEN` | token do passo 2 |
| `ASAAS_ENVIRONMENT` | `production` |

Mantenha `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET`: o webhook do Mercado Pago continua recebendo estornos e chargebacks de pagamentos antigos.

O build de produção (`scripts/check-production-security.js`) **falha** se faltar alguma dessas variáveis, se `ASAAS_ENVIRONMENT` não for `production` ou se o token tiver menos de 32 caracteres. Assim o deploy não vai ao ar com o pagamento quebrado.

## 4. Teste antes do merge (opcional, recomendado)

Num preview da Vercel com `ASAAS_ENVIRONMENT=sandbox` e chave do sandbox, cadastre um webhook do sandbox apontando para a URL do preview e faça:

- reserva com Pix e com cartão (inclusive parcelado), conferindo se a reserva vira **Confirmada** e se os e-mails saem;
- link de pagamento pelo admin (*Reservas → Gerar link* e *Reserva manual*);
- checkout expirando sem pagamento (a reserva expira pelo cron).

## 5. Depois do merge

- [ ] Faça uma reserva real de valor baixo, confirme que ela vira Confirmada e estorne pelo painel do Asaas. A reserva deve passar para Cancelada.
- [ ] Confira em *Integrações → Webhooks* que a fila está ativa e sem erros.

## O que mudou

- `/api/asaas/checkout`: checkout do hóspede, com o mesmo prazo da reserva (`PENDING_BOOKING_PAYMENT_WINDOW_MINUTES`), pagamento parcial, CPF obrigatório e pagador terceiro (que preenche os próprios dados no Asaas).
- `/api/webhooks/asaas`: confirma a reserva, valida o valor, trata análise de risco, pagamento atrasado sem quarto, estorno e chargeback.
- Link do admin (`/api/admin/bookings/[id]/payment-link`) e reserva manual passam a usar o Asaas. O Brick do Mercado Pago na reserva manual foi desligado (`USE_MERCADO_PAGO_BRICK`).
- "Cartão em análise" vale para os dois provedores: tentativa do MP (`PaymentAttempt`) ou `Payment.status = UNDER_REVIEW` do Asaas. A reserva segura o quarto e não expira por até 3 dias.
- Formulário: endereço com busca de CEP (`/api/cep/[cep]`) quando o hóspede é o pagador, para o checkout abrir preenchido.

## Ainda com Mercado Pago (remover em PR separado, depois de ~120 dias)

- Webhooks `/api/webhooks/mercadopago` e `/api/mercadopago/webhook`: **manter** enquanto puder chegar estorno ou chargeback de pagamento antigo.
- Rotas de criação `/api/mercadopago/{checkout-pro,create-preference,payment}`, `src/lib/mercadopago/*`, SDK/script de Device ID em `src/app/reservar/layout.tsx`, Brick em `src/app/reservar/page.tsx`, CSP do MP em `next.config.ts` e o pacote `mercadopago`. O site não chama mais essas rotas.
