# PR: Home + Acomodações - Datas Especiais e CTA de Conversão

## Objetivo
Implementar melhorias de conversão no front-end, sem alterar motor, APIs, disponibilidade, inventário, cupons ou pagamento.

## Escopo aplicado
- Config central para datas especiais e helpers de URL/banner.
- Banner discreto e temporário na Home (controlado por configuração).
- Seção "📅 Próximas Datas Especiais" com cards e CTA para o motor.
- Página de Acomodações com microcopy de preço variável + CTA "Ver disponibilidade e preços".
- Remoção de preço fixo "Diárias a partir de" da página de detalhe de acomodação.
- Tracking leve nos novos cliques de conversão (quando GA4 client existir):
  - `home_special_dates_click`
  - `home_banner_special_date_click`
  - `acomodacoes_cta_reservar_click`

## Arquivos alterados
- `src/constants/specialDates.ts`
- `src/components/SpecialDatesSection.tsx`
- `src/components/HomeContent.tsx`
- `src/components/RoomCard.tsx`
- `src/app/acomodacoes/[id]/page.tsx`
- `src/app/acomodacoes/[id]/room-details.module.css`
- `src/constants/specialDates.test.ts`
- `src/components/SpecialDatesSection.test.tsx`

## Testes automatizados
- `npm run test` ✅
- `npm run typecheck` ✅

## Checklist manual
- [ ] Home carrega sem erro.
- [ ] Banner aparece apenas quando configurado e ativo pela regra temporal.
- [ ] Clique em "Ver datas" abre `/reservar` com `checkIn/checkOut/adults/children` válidos.
- [ ] Fallback para `/reservar` sem parâmetros quando datas inválidas/ausentes.
- [ ] Seção "Datas Especiais" aparece e é responsiva (mobile/desktop).
- [ ] Página Acomodações exibe microcopy e botão "Ver disponibilidade e preços".
- [ ] Página de detalhe de acomodação não exibe preço fixo.
- [ ] Sem layout encavalado ou scroll anômalo.
- [ ] Fluxo do motor `/reservar` segue inalterado.
