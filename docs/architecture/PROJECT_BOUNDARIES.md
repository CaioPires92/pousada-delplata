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
- transporte atual pela Evolution durante a migração controlada para a WhatsApp Cloud API oficial da Meta;
- automações internas orientadas a eventos.

Principais caminhos:
- `src/app/admin/inbox/*`
- `src/app/admin/crm/*`
- `src/app/api/crm/*`
- `src/app/api/whatsapp/*`
- `src/lib/crm/*`
- `src/lib/whatsapp/*`
- futura orquestração descrita em `docs/product/CRM_AI_PHASES_TODO.md` (sem workflow n8n ativo nesta versão)
- `docs/ops/CRM_*`

## Regra de integração entre A e B

- integrações e orquestradores externos **não escrevem direto no banco fora das APIs do app**;
- eventos externos retornam por APIs internas autenticadas do CRM;
- o domínio do Mapa/motor é a fonte oficial de disponibilidade, tarifa, restrições e reserva.
