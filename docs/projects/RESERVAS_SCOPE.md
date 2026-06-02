# Escopo do Projeto: Site e Motor de Reservas

## Objetivo
Disponibilizar experiência pública, consulta de disponibilidade e confirmação de reservas/pagamentos.

## Entradas
- navegação do site;
- parâmetros de busca de datas/hóspedes;
- webhooks de pagamento.

## Saídas
- reserva criada/atualizada;
- confirmação para cliente;
- dados para operação administrativa.

## Módulos principais
- `src/app/reservar/*`
- `src/app/acomodacoes/*`
- `src/app/api/availability/*`
- `src/app/api/bookings/*`
- `src/app/api/payments/*`
- `src/lib/booking-price.ts`
- `src/lib/hospedin.ts`

## Banco
- tabelas de quarto/tarifa/disponibilidade/reserva/pagamento/cupom.
