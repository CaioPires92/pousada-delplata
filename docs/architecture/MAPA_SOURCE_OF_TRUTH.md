# Mapa como fonte oficial comercial

## Decisão

O domínio do Mapa do motor de reservas é a fonte oficial para:

- tarifas e preço final;
- inventário padrão e específico para quatro hóspedes;
- ocupação por reservas;
- capacidade;
- mínimo de noites;
- `stopSell`, CTA e CTD;
- disponibilidade resultante.

A tela `/admin/mapa` é a interface administrativa desse domínio. Ela não é uma
API a ser consultada ou raspada por outros módulos.

## Serviço canônico

O cálculo canônico está em
`src/lib/availability/quote-service.ts`, por meio de
`queryAvailabilityQuote`.

O consumidor público é `POST /api/availability`. A rota valida o contrato HTTP
e delega o cálculo ao mesmo serviço canônico.

## Limites de responsabilidade

Uma cotação não pode duplicar fórmulas de preço, inventário ou restrições. Uma
cotação expirada exige um novo cálculo pelo serviço canônico. Mudanças de regra
comercial devem ser implementadas no domínio de disponibilidade e validadas
pelos testes do Mapa.

Reservas e pagamentos continuam sendo confirmados pelos respectivos domínios e
eventos confiáveis; uma cotação, isoladamente, não confirma uma reserva.

## Operação e segurança

- Edição de tarifas e inventário permanece em endpoints administrativos
  autenticados.
- Integrações externas não acessam o banco diretamente para calcular preço ou
  disponibilidade.
- Toda cotação inclui identidade, versão, horário de cálculo, expiração e hash.

## Gate obrigatório

Alterações em preço, disponibilidade, inventário, reservas ou no serviço
canônico devem executar:

```bash
npm run typecheck
npm run test:mapa
```
