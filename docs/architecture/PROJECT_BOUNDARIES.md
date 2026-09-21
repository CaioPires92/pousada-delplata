# Limites do projeto

Este repositório contém o site e o motor de reservas da Pousada Delplata.

## Site e motor de reservas

Responsável por site público, disponibilidade, tarifas, inventário, cupons,
reservas, pagamentos e painel administrativo.

Principais caminhos:

- `src/app`;
- `src/app/reservar`;
- `src/app/admin`;
- `src/app/api/availability`;
- `src/app/api/bookings`;
- `src/app/api/mercadopago`;
- `src/lib/availability`;
- `src/lib/booking-price.ts`;
- `src/lib/coupons`;
- `prisma/schema.prisma`.

Integrações externas não escrevem diretamente no banco para alterar preço,
disponibilidade, inventário ou pagamentos.
