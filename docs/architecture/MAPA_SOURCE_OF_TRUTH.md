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

Os consumidores atuais são:

- site público: `POST /api/availability`;
- CRM: `POST /api/crm/quote`.

As duas rotas validam e adaptam seus contratos HTTP, mas delegam o cálculo ao
mesmo serviço. O teste
`src/lib/availability/routes-contract.test.ts` impede divergência entre os
resultados dos dois canais.

## Limites de responsabilidade

O CRM pode armazenar e exibir uma cotação, mas não pode:

- duplicar fórmulas de preço, inventário ou restrições;
- corrigir ou completar valores retornados pelo serviço;
- inventar descontos, disponibilidade ou políticas;
- enviar uma cotação expirada.

Quando uma cotação expira, o CRM deve solicitar um novo cálculo ao serviço
canônico. Mudanças de regra comercial devem ser implementadas no domínio de
disponibilidade e validadas pelos gates do Mapa e do CRM.

Reservas e pagamentos continuam sendo confirmados pelos respectivos domínios e
eventos confiáveis; uma cotação, isoladamente, não confirma uma reserva.

## Operação e segurança

- Edição de tarifas e inventário permanece em endpoints administrativos
  autenticados.
- O CRM recebe somente o resultado de leitura necessário para o atendimento.
- Integrações externas não acessam o banco diretamente para calcular preço ou
  disponibilidade.
- Toda cotação inclui identidade, versão, horário de cálculo, expiração e hash.

## Gate obrigatório

Alterações em preço, disponibilidade, inventário, reservas ou no serviço
canônico devem executar:

```bash
npm run typecheck
npm run test:mapa
npm run test:crm
```

