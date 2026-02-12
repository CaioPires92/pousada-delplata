# Cupons - Runbook Operacional

## Objetivo
Guia rapido para operar cupons no dia a dia e validar comportamento em producao com seguranca.

## Pre-requisitos
- Branch com cupons deployada.
- Migration de cupons aplicada no banco.
- Webhook Mercado Pago configurado para `POST /api/webhooks/mercadopago`.
- Admin acessivel em `/admin/cupons`.

## Fluxo recomendado (operacao)
1. Acesse `Admin > Cupons`.
2. Escolha um modelo em `Modelos antifraude` e clique `Usar modelo`.
3. Ajuste regras (valor, validade, limites, vinculo por email/telefone, fontes permitidas).
4. Salve e copie o codigo gerado.
5. Teste no checkout com uma reserva real de homologacao.

## Modelos e quando usar
- `Privado 1:1`: envio direto para 1 hospede, maior protecao.
- `Campanha controlada`: promocao publica com limite global e por hospede.
- `Parceiro/canal`: uso restrito por fonte (`allowedSources`).
- `Reativacao`: cupom para recuperar hospedes inativos.

## Guardrails obrigatorios
- Cupom privado: manter `singleUse=true`, `maxUsesPerGuest=1`, validade curta.
- Campanhas abertas: sempre definir `maxGlobalUses` e `maxUsesPerGuest`.
- Nunca remover limites sem justificativa comercial.
- Evitar `stackable=true` na fase atual.

## Checklist de validacao final (go-live)
1. Criar cupom via template.
2. Aplicar cupom valido no checkout e confirmar desconto.
3. Tentar cupom invalido e verificar bloqueio/feedback.
4. Finalizar pagamento e confirmar reserva.
5. Verificar no admin:
- `Auditoria de Tentativas` (INVALID/BLOCKED/VALID)
- `Metricas` (ativos, confirmados, invalidos, bloqueios)
6. Simular expiracao/falha e validar liberacao de reserva de cupom.

## Observabilidade
- Auditoria: `GET /api/admin/coupons/attempts`
- Metricas: `GET /api/admin/coupons/metrics`
- Templates: `GET /api/admin/coupons/templates`

## Troubleshooting rapido
- Desconto nao aplicou: validar `minBookingValue`, periodo (`startsAt/endsAt`), `allowedSources` e vinculos (`bindEmail/bindPhone`).
- Cupom aparece indisponivel: conferir `maxGlobalUses`, `maxUsesPerGuest` e tentativas bloqueadas.
- Pagamento aprovado sem refletir cupom: validar webhook ativo e logs do evento `MP_WEBHOOK_PROCESSED`.
- Muitos bloqueios legitimos: revisar limiares de rate-limit e janela de tentativas.

## Rollback operacional
1. Desativar cupons afetados no admin.
2. Se necessario, remover distribuicao de novos codigos.
3. Monitorar tentativas por 24h e reabrir campanha gradualmente.

## Comandos de validacao local
```bash
npm run test -- src/app/api/admin/coupons/templates/route.test.ts src/app/api/admin/coupons/metrics/route.test.ts src/app/api/admin/coupons/route.test.ts src/app/api/admin/coupons/attempts/route.test.ts src/app/api/webhooks/mercadopago/route.test.ts src/app/api/coupons/validate/route.test.ts src/app/api/coupons/reserve/route.test.ts src/app/api/bookings/route.test.ts
npm run typecheck
```
