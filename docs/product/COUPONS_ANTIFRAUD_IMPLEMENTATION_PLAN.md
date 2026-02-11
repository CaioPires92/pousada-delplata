# Coupons Antifraud - Backlog Tecnico

## Objetivo
Implementar cupons no motor de reservas com foco em seguranca, controle de abuso e operacao previsivel.

## Escopo
- Validacao de cupom 100% no backend.
- Reserva de uso (lock) para evitar corrida de checkout.
- Confirmacao/liberacao de uso conforme status de pagamento.
- Suporte a modelos: privado 1:1, campanha controlada, parceiro/canal, reativacao.

## Fora de escopo (fase inicial)
- Personalizacao visual avancada no frontend de admin.
- Segmentacao complexa por comportamento (machine learning).

## Arquitetura proposta

### Entidades
- `Coupon`
- `CouponRedemption`
- `CouponAttemptLog`

### Estado de uso de cupom
- `RESERVED`: cupom reservado durante checkout (TTL curto).
- `CONFIRMED`: pagamento aprovado e cupom consumido.
- `RELEASED`: reserva de cupom liberada por expiracao/falha/cancelamento.

### Regras de seguranca
- Nao salvar codigo puro em banco; usar hash (`codeHash`) e prefixo para busca (`codePrefix`).
- Cupom privado: vinculo por email e/ou telefone.
- Limite global e limite por hospede.
- Rate limit no endpoint de validacao.
- Logs de tentativa invalida e bloqueios.

## Mapa de arquivos (target)

### Banco / Prisma
- `prisma/schema.prisma`
- `prisma/migrations/*_add_coupons_antifraud/migration.sql`

### Backend
- `src/lib/coupons/types.ts`
- `src/lib/coupons/hash.ts`
- `src/lib/coupons/validate.ts`
- `src/lib/coupons/reservation.ts`
- `src/lib/coupons/discount.ts`
- `src/lib/coupons/eligibility.ts`

### APIs publicas
- `src/app/api/coupons/validate/route.ts`
- `src/app/api/coupons/reserve/route.ts`
- `src/app/api/coupons/release/route.ts`

### Integracao de booking/pagamento
- `src/app/api/bookings/route.ts`
- `src/app/api/webhooks/mercadopago/route.ts`

### Admin
- `src/app/api/admin/coupons/route.ts`
- `src/app/api/admin/coupons/[id]/route.ts`
- `src/app/admin/coupons/page.tsx`

### Frontend checkout
- `src/app/reservar/page.tsx`
- `src/lib/booking-price.ts` (se necessario para breakdown)

### Testes
- `src/lib/coupons/*.test.ts`
- `src/app/api/coupons/*/route.test.ts`
- `src/app/api/bookings/route.test.ts`
- `src/app/api/webhooks/mercadopago/route.test.ts`

## Contratos de API (fase 1)

### POST /api/coupons/validate
Request:
```json
{
  "code": "WELCOME10",
  "guest": { "email": "x@y.com", "phone": "551199..." },
  "context": {
    "roomTypeId": "...",
    "checkIn": "2026-03-10",
    "checkOut": "2026-03-12",
    "subtotal": 1200,
    "source": "direct"
  }
}
```
Response (ok):
```json
{
  "valid": true,
  "couponId": "...",
  "discount": { "type": "PERCENT", "value": 10, "amount": 120 },
  "total": 1080,
  "reservationTtlSec": 900
}
```
Response (erro):
```json
{
  "valid": false,
  "reason": "EXPIRED"
}
```

### POST /api/coupons/reserve
Cria lock de uso para checkout.

### POST /api/coupons/release
Libera lock reservado nao confirmado.

## Modelo de dados (detalhado)

### Coupon
- `id` (uuid)
- `name`
- `codeHash` (unique)
- `codePrefix` (index)
- `type` (`PERCENT` | `FIXED`)
- `value` (decimal)
- `maxDiscountAmount` (nullable)
- `minBookingValue` (nullable)
- `active` (bool)
- `startsAt` (nullable)
- `endsAt` (nullable)
- `maxGlobalUses` (nullable)
- `maxUsesPerGuest` (nullable)
- `bindEmail` (nullable)
- `bindPhone` (nullable)
- `allowedRoomTypeIds` (json nullable)
- `allowedSources` (json nullable)
- `singleUse` (bool default true)
- `stackable` (bool default false)
- `createdAt`, `updatedAt`

### CouponRedemption
- `id`
- `couponId`
- `status` (`RESERVED` | `CONFIRMED` | `RELEASED`)
- `bookingId` (nullable ate confirmacao)
- `guestEmail` (nullable)
- `guestPhone` (nullable)
- `discountAmount`
- `reservedAt`
- `expiresAt`
- `confirmedAt` (nullable)
- indices: (`couponId`, `status`), (`guestEmail`, `couponId`)

### CouponAttemptLog
- `id`
- `codePrefix`
- `guestEmail` (nullable)
- `ipHash`
- `userAgentHash`
- `result` (`VALID`, `INVALID`, `BLOCKED`)
- `reason`
- `createdAt`

## Sprint backlog (estimado)

## Sprint 1 - Fundacao segura (3-4 dias)
1. Modelagem Prisma + migration
- Arquivos: `prisma/schema.prisma`, `prisma/migrations/*`
- Estimativa: 6h
- Aceite: migrate aplica sem quebra, indices criados.

2. Hash e normalizacao de codigo
- Arquivos: `src/lib/coupons/hash.ts`
- Estimativa: 3h
- Aceite: mesmo codigo em formatos diferentes resolve para mesmo hash.

3. Servico de validacao base
- Arquivos: `src/lib/coupons/validate.ts`, `discount.ts`, `eligibility.ts`
- Estimativa: 8h
- Aceite: regras de ativo, validade, minimo e desconto funcionando.

4. Endpoint `POST /api/coupons/validate`
- Arquivos: `src/app/api/coupons/validate/route.ts`
- Estimativa: 5h
- Aceite: respostas padronizadas por motivo de rejeicao.

5. Testes unitarios e de rota (fase 1)
- Estimativa: 6h
- Aceite: cobrindo expirado, inativo, min booking, desconto percentual/fixo.

## Sprint 2 - Anti-corrida e integracao checkout (3-4 dias)
1. Reserva de uso (lock)
- Arquivos: `reservation.ts`, `POST /api/coupons/reserve`, `release`
- Estimativa: 8h
- Aceite: 2 checkouts concorrentes nao consomem o mesmo cupom.

2. Integracao em booking
- Arquivos: `src/app/api/bookings/route.ts`
- Estimativa: 6h
- Aceite: booking persiste subtotal, desconto, total final e couponId.

3. Integracao no frontend de reserva
- Arquivos: `src/app/reservar/page.tsx`
- Estimativa: 8h
- Aceite: aplicar/remover cupom, feedback claro, total atualizado.

4. Expiracao de reservas de cupom
- Estimativa: 4h
- Aceite: locks vencidos sao ignorados/liberados.

5. Testes de integracao de corrida
- Estimativa: 6h
- Aceite: cenarios concorrentes cobertos.

## Sprint 3 - Confirmacao por pagamento + Admin (4-5 dias)
1. Confirmacao no webhook de pagamento
- Arquivos: `src/app/api/webhooks/mercadopago/route.ts`
- Estimativa: 6h
- Aceite: aprovado confirma cupom; falha/cancelamento libera.

2. CRUD admin de cupons
- Arquivos: `src/app/api/admin/coupons/*`, `src/app/admin/coupons/page.tsx`
- Estimativa: 12h
- Aceite: criar/editar/ativar/desativar/revogar.

3. Geracao de lotes (modelos)
- Estimativa: 6h
- Aceite: gerar lotes para: privado 1:1, campanha, parceiro.

4. Observabilidade e auditoria
- Arquivos: `CouponAttemptLog`, `ops-log`
- Estimativa: 5h
- Aceite: loga tentativas invalidas e bloqueios.

## Modelos de cupom prontos (templates)

### 1) Privado 1:1 (mais seguro)
- `singleUse=true`
- `maxGlobalUses=1`
- `bindEmail=cliente@...`
- `startsAt/endsAt` curtos (24-72h)

### 2) Campanha controlada
- `maxGlobalUses` definido
- `maxUsesPerGuest=1`
- sem bind de email
- validade curta

### 3) Parceiro/canal
- `allowedSources=["partner_x"]`
- opcional bind por dominio/email

### 4) Reativacao
- somente para hospede antigo (regra no `eligibility.ts`)

## Guardrails de seguranca
- Rate limit por IP no validate/reserve.
- Nunca confiar no valor de desconto vindo do frontend.
- Nao expor motivos sensiveis em excesso (mensagens internas no log).
- Cupom sempre recalculado no servidor antes de criar preferencia de pagamento.
- Snapshot financeiro persistido no booking para auditoria.

## Criterios de aceite globais
- Nao permitir duplo uso em concorrencia.
- Cupom privado nao funcionar para outro email/telefone.
- Totais sempre consistentes entre checkout, booking e pagamento.
- Logs de tentativa e uso disponiveis para auditoria.
- Testes cobrindo cenarios de fraude mais comuns.

## Checklist de deploy
- Migration aplicada.
- Feature flag `COUPONS_ENABLED=true` em ambiente alvo.
- Rate limit configurado.
- Monitoramento de erro/abuso ativo.

## Riscos e mitigacoes
- Corrida de confirmacao de pagamento: usar transacao e status idempotente.
- Compartilhamento de cupom privado: bind + single-use + validade curta.
- Reuso via emails diferentes: opcional bind em telefone/CPF.