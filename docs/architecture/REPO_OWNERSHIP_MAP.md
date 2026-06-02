# Repo Ownership Map

Objetivo: deixar explicito o que pertence a cada projeto dentro do monorepo, evitando mistura de escopo.

## Projeto A: Site + Motor de Reservas

Pastas principais:
- `src/app/(site publico)`
- `src/app/reservar`
- `src/app/api/availability`
- `src/app/api/bookings`
- `src/app/api/mercadopago`
- `src/app/api/payments` (quando aplicavel)
- `src/lib/booking-price.ts`
- `src/lib/hospedin.ts`
- `src/lib/coupons`

Responsabilidades:
- disponibilidade, preco e inventario de reservas;
- criacao/confirmacao/expiracao de booking;
- integracao de pagamento.

Nao deve depender de:
- regras internas de pipeline CRM;
- semantica de automacao n8n para decisao de disponibilidade.

## Projeto B: CRM + n8n

Pastas principais:
- `src/app/admin/inbox`
- `src/app/admin/crm`
- `src/app/api/whatsapp`
- `src/app/api/crm`
- `src/app/api/cron/crm-queue-worker`
- `src/lib/whatsapp`
- `src/lib/crm`
- `n8n/workflows`

Responsabilidades:
- atendimento por conversa;
- pipeline e automacoes comerciais;
- emissao/consumo de eventos operacionais.

Nao deve fazer:
- escrita direta de n8n no banco;
- bypass das APIs internas autenticadas.

## Compartilhado entre os dois

- `prisma/schema.prisma`
- `src/components/ui`
- `src/app/globals.css` (tokens de design system)
- `docs/architecture/DESIGN_SYSTEM.md`

Regra:
- mudancas em compartilhado exigem validar impacto nos dois projetos.

## Lixo tecnico / quarentena

- usar `trash/for-review/` para logs antigos, metadados de SO e arquivos temporarios sem uso de runtime.
- antes de remover definitivamente: revisar em PR ou checklist operacional.
