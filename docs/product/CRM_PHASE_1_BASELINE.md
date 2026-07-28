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

## F1.03 — Inventário e reservas simultâneas

Os testes de caracterização confirmam:

- o inventário padrão parte de `totalUnits`;
- ajustes manuais nunca ampliam o inventário além da capacidade física;
- numa estadia de várias noites, `remainingUnits` corresponde à noite com menor
  disponibilidade;
- cada reserva ativa sobreposta reduz uma unidade em cada noite ocupada;
- múltiplas reservas sobrepostas são descontadas individualmente;
- estadias de quatro hóspedes também dependem do inventário específico;
- reservas com menos de quatro hóspedes não consomem o inventário específico de
  quatro hóspedes;
- ajustes manuais do inventário de quatro hóspedes também são limitados pela
  configuração física do quarto.

### Evidência

- testes direcionados de availability: 28 aprovados;
- gate completo do Mapa: 7 arquivos e 63 testes aprovados;
- duração observada do gate: aproximadamente 60 segundos;
- nenhuma regra de produção foi alterada.

## F1.04 — Expiração de reservas pendentes

Os testes usam relógio controlado para congelar o limite temporal:

- `CONFIRMED` e `PAID` permanecem ativos independentemente da idade;
- `PENDING` reduz inventário somente quando `createdAt` está dentro do TTL;
- o TTL padrão é 15 minutos;
- `PENDING_BOOKING_TTL_MINUTES` permite configurar o período;
- uma reserva criada antes do instante limite deixa de reduzir inventário.

### Evidência

- testes direcionados de availability: 30 aprovados;
- gate completo do Mapa: 7 arquivos e 65 testes aprovados;
- duração observada do gate: aproximadamente 65 segundos;
- nenhuma regra de produção foi alterada.

## F1.05 — Serviço de cotação independente do CRM

O cálculo reutilizável foi movido de `src/lib/crm/availabilityQuote.ts` para
`src/lib/availability/quote-service.ts`.

Com isso:

- o domínio de disponibilidade não depende mais da pasta CRM;
- os tipos de entrada, resultado e opções permanecem exportados pelo serviço;
- os testes unitários foram movidos junto com o serviço;
- o gate CRM inclui explicitamente os testes do serviço compartilhado;
- `/api/crm/quote` continua usando o mesmo cálculo, agora pelo caminho neutro;
- não houve alteração de contrato ou regra de produção.

### Evidência

- testes direcionados do serviço e da rota CRM: 2 arquivos e 9 testes aprovados;
- typecheck aprovado;
- gate CRM: 20 arquivos e 58 testes aprovados;
- banco SQLite efêmero utilizado pelo gate.

## F1.06 — Rota pública usando o serviço compartilhado

`/api/availability` agora delega ao serviço compartilhado:

- preço base e tarifas específicas;
- precedência de tarifas;
- mínimo de noites, `stopSell`, CTA e CTD;
- inventário padrão e de quatro hóspedes;
- reservas ativas e expiração de `PENDING`;
- composição do preço por hóspedes.

A rota mantém somente responsabilidades HTTP e específicas do canal público:

- leitura dos query params;
- status e formato legado da resposta;
- dados de apresentação do quarto;
- preview e cabeçalhos de cupom.

### Evidência

- testes direcionados da rota pública: 30 aprovados;
- typecheck aprovado;
- gate completo do Mapa: 7 arquivos e 65 testes aprovados;
- o arquivo da rota deixou de conter fórmulas de disponibilidade e preço.

## F1.07 — CRM usando o mesmo serviço

`/api/crm/quote` importa e chama diretamente
`src/lib/availability/quote-service.ts`, o mesmo módulo utilizado por
`/api/availability`.

O teste da rota CRM garante que:

- a entrada validada é delegada ao serviço compartilhado;
- o CRM não recalcula preço ou inventário;
- o resultado é associado à conversa;
- o evento `QuoteRequested` registra sucesso, quantidade de opções ou erro.

### Evidência

- testes direcionados do serviço e da rota CRM: 2 arquivos e 9 testes aprovados;
- busca no código não encontra mais o antigo serviço sob `src/lib/crm`;
- site e CRM importam `queryAvailabilityQuote` do mesmo arquivo.

## F1.08 — Identidade e validade da cotação

Toda cotação bem-sucedida agora contém:

- `quoteId`, derivado do hash da versão calculada;
- `quoteVersion`, atualmente igual a `1`;
- `calculatedAt`, em ISO 8601 UTC;
- `expiresAt`, em ISO 8601 UTC;
- `quoteHash`, SHA-256 dos dados determinísticos da cotação.

O TTL padrão é 15 minutos e pode ser configurado por
`AVAILABILITY_QUOTE_TTL_MINUTES`. A variável foi adicionada ao `.env.example`.

O CRM recebe os metadados no objeto `quote` e os registra no evento
`QuoteRequested`. Para preservar o array legado de `/api/availability`, a rota
pública expõe os mesmos valores nos cabeçalhos `x-quote-*`.

### Evidência

- testes direcionados do serviço, site e CRM: 3 arquivos e 40 testes aprovados;
- teste com relógio controlado confirma cálculo e expiração;
- ID e hash têm formato validado;
- typecheck aprovado;
- gate CRM: 20 arquivos e 59 testes aprovados;
- gate do Mapa: 7 arquivos e 65 testes aprovados.

## F1.09 — Bloqueio de envio após expiração

O fluxo automático de WhatsApp valida `expiresAt` imediatamente antes de montar
e enviar a mensagem de cotação.

A validação é fechada por padrão:

- validade ausente bloqueia;
- data malformada bloqueia;
- `expiresAt` anterior ao relógio atual bloqueia;
- o instante exato de `expiresAt` já é considerado expirado;
- somente uma validade estritamente futura permite avançar.

Quando bloqueada, a automação:

- não chama `SEND_WHATSAPP_MESSAGE` com o preço vencido;
- registra o evento `QuoteExpired` com os metadados disponíveis;
- mantém a conversa em `ready_to_quote`;
- libera o lock para permitir um novo cálculo.

### Evidência

- teste unitário cobre ausência, formato inválido e os dois lados do limite;
- testes direcionados do fluxo: 5 aprovados;
- typecheck aprovado;
- gate CRM: 20 arquivos e 60 testes aprovados.

## F1.10 — Contrato comparativo entre site e CRM

O teste `src/lib/availability/routes-contract.test.ts` executa as duas rotas
reais sobre a mesma fixture de banco.

Os contratos são comparados por:

- `roomTypeId`;
- preço total e detalhamento;
- unidades restantes;
- mínimo de noites;
- erro e valor de `minLos` quando a estadia é curta.

O teste faz parte dos gates CRM e Mapa, portanto qualquer divergência futura
entre os canais bloqueia ambos.

### Evidência

- teste de contrato direcionado: 2 testes aprovados;
- typecheck aprovado;
- gate CRM: 21 arquivos e 62 testes aprovados;
- gate do Mapa: 8 arquivos e 67 testes aprovados.

## F1.11 — Consultas constantes no cálculo

Antes desta mudança, uma cotação executava uma consulta de quartos e, para
cada tipo de quarto, três novas consultas de reservas e ajustes. O custo era
`1 + 3R`, sendo `R` a quantidade de tipos de quarto.

Reservas, ajustes de inventário padrão e ajustes para quatro hóspedes agora
são carregados em lote para todos os quartos e agrupados em memória. Assim,
uma cotação executa quatro consultas, independentemente da quantidade de
tipos de quarto:

1. tipos de quarto e tarifas;
2. reservas ativas;
3. ajustes de inventário padrão;
4. ajustes de inventário para quatro hóspedes.

### Evidência

- teste com três quartos confirma uma chamada por coleção e o filtro em lote;
- testes direcionados: 3 arquivos e 38 testes aprovados;
- typecheck aprovado;
- gate CRM: 21 arquivos e 63 testes aprovados;
- gate do Mapa: 8 arquivos e 67 testes aprovados.

## Próxima microtarefa

F1.12 deve documentar explicitamente o Mapa como fonte oficial de
disponibilidade e tarifas.
