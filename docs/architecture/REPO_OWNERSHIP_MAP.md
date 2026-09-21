# Mapa de responsabilidades

## Site e reservas

- `src/app` e `src/components`: interface pública e administrativa;
- `src/app/reservar`: fluxo de reserva;
- `src/app/api/availability`, `src/app/api/bookings` e `src/app/api/mercadopago`: contratos HTTP;
- `src/lib/availability`, `src/lib/booking-price.ts` e `src/lib/coupons`: regras de negócio;
- `prisma`: schema e migrations;
- `public`: imagens e arquivos públicos;
- `scripts/reservas`: tarefas de operação e deploy.

Mudanças em disponibilidade, preço, inventário, reserva ou pagamento devem ser
verificadas com testes apropriados e não podem contornar as regras do motor.
