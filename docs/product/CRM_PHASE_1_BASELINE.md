# Fase 1 — Baseline do serviço de disponibilidade

**Data:** 2026-07-28

## F1.01 — Caracterização de `/api/availability`

O endpoint atual permanece inalterado. A primeira microentrega adicionou testes
para congelar o contrato observado antes da extração do serviço compartilhado.

### Entrada

- `checkIn` e `checkOut` são obrigatórios;
- intervalo com zero noites retorna `400` e `invalid_date_range`;
- adultos têm default igual a `2`;
- idades das crianças são recebidas em `childrenAges`;
- cupom pode ser informado em `promo` ou `coupon`.

### Regras observadas

- tarifa específica substitui tarifa base por noite;
- ausência de tarifa usa `basePrice`;
- qualquer noite com `stopSell` elimina o quarto;
- CTA no check-in elimina o quarto;
- CTD no check-out elimina o quarto;
- se todos os quartos falham em mínimo de noites, a API retorna:

  ```json
  {
    "error": "min_stay_required",
    "minLos": 3
  }
  ```

- ajustes de inventário e reservas ativas reduzem unidades;
- inventário especial para quatro hóspedes é validado separadamente;
- crianças de 6 a 11 anos usam taxa infantil;
- criança com 12 anos ou mais conta como adulto;
- cupom é validado como preview e não é consumido pela consulta.

### Saída de quarto disponível

O contrato atual inclui:

- dados do `RoomType`;
- `totalPrice`;
- `priceOriginal`;
- `priceDiscounted`, quando aplicável;
- `discountAmount`;
- `promoApplied` e `promoMessage`;
- `priceBreakdown`;
- `isAvailable`;
- `remainingUnits`;
- `minLos`.

### Evidência

- testes direcionados de availability: 21 aprovados;
- gate do Mapa: 7 arquivos e 56 testes aprovados;
- nenhuma regra de produção foi alterada.

## F1.02 — Limites e precedência das restrições

Os testes isolam as restrições tarifárias sem alterar o endpoint de produção.

### Matriz congelada

- `stopSell` em qualquer noite ocupada bloqueia o quarto;
- `stopSell` apenas na data de checkout não bloqueia a estadia;
- CTA bloqueia somente quando aplicado à data de chegada;
- CTA posterior à chegada não bloqueia;
- CTD bloqueia somente quando aplicado à data de saída;
- CTD anterior à saída não bloqueia;
- o maior `minLos` entre as noites ocupadas determina o mínimo exigido;
- em tarifas sobrepostas, o registro mais recente prevalece;
- uma tarifa mais recente aberta substitui um `stopSell` mais antigo e fornece o
  preço usado na cotação.

### Evidência

- testes direcionados de availability: 25 aprovados;
- gate completo do Mapa: 7 arquivos e 60 testes aprovados;
- duração observada do gate: aproximadamente 71 segundos;
- nenhuma regra de produção foi alterada.

## Próxima microtarefa

F1.03 deve caracterizar inventário padrão, inventário específico para quatro
hóspedes e o efeito de reservas simultâneas.
