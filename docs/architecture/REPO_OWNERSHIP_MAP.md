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
- decisão comercial fora do domínio oficial do Mapa/motor.

## Projeto B: CRM + automações

Pastas principais:
- `src/app/admin/inbox`
- `src/app/admin/crm`
- `src/app/api/whatsapp`
- `src/app/api/crm`
- `src/app/api/cron/crm-queue-worker`
- `src/lib/whatsapp`
- `src/lib/crm`
- `docs/product/CRM_AI_PHASES_TODO.md` define a futura orquestração; não há workflow n8n ativo versionado.

Responsabilidades:
- atendimento por conversa;
- pipeline e automacoes comerciais;
- emissao/consumo de eventos operacionais.

Nao deve fazer:
- escrita direta de orquestradores externos no banco;
- bypass das APIs internas autenticadas.

## Compartilhado entre os dois

- `prisma/schema.prisma`
- `src/components/ui`
- `src/app/globals.css` (tokens de design system)
- `docs/architecture/DESIGN_SYSTEM.md`

Regra:
- mudancas em compartilhado exigem validar impacto nos dois projetos.

## Arquivos temporários

- logs, bancos locais, dumps e experimentos devem ser ignorados, não versionados.
