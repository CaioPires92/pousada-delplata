# Project Boundaries

Este repositório contém **dois projetos** no mesmo código-fonte.

## Projeto A — Site + Motor de Reservas

Responsável por:
- site público;
- busca de disponibilidade;
- fluxo de reserva e pagamento;
- páginas institucionais.

Principais caminhos:
- `src/app/(rotas públicas e reserva)`
- `src/app/api/availability/*`
- `src/app/api/bookings/*`
- `src/app/api/payments/*` e `src/lib/mercadopago/*`
- `src/lib/hospedin.ts`
- `src/lib/booking-price.ts`
- `src/lib/coupons/*`
- `prisma/schema.prisma` (modelos de reservas)

## Projeto B — CRM + Fluxos n8n

Responsável por:
- inbox de atendimento;
- histórico de conversa;
- pipeline comercial;
- automações controladas por eventos;
- integração com Evolution API e n8n.

Principais caminhos:
- `src/app/admin/inbox/*`
- `src/app/admin/crm/*`
- `src/app/api/crm/*`
- `src/app/api/whatsapp/*`
- `src/lib/crm/*`
- `src/lib/whatsapp/*`
- `n8n/workflows/*`
- `docs/ops/CRM_*`

## Regra de integração entre A e B

- CRM e n8n **não escrevem direto no banco fora das APIs do app**.
- Eventos do CRM são emitidos para n8n; n8n devolve ações via API autenticada do CRM.
- O motor de reservas segue como fonte oficial de disponibilidade, tarifa e reserva.
