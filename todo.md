from pathlib import Path

content = """# TODO — Melhorias no Fluxo de Pagamentos

## 1. Desconto de 5% no PIX

- [x] Adicionar desconto de 5% para pagamentos via PIX.
- [x] Exibir aviso claro sobre o desconto no checkout.
- [x] Aplicar o desconto somente quando o método selecionado for PIX.
- [x] Garantir que frontend, backend e Mercado Pago utilizem o mesmo valor final.
- [ ] Salvar no banco, quando necessário:
  - [x] Valor original da reserva.
  - [ ] Valor do desconto aplicado.
  - [x] Valor efetivamente pago.

### Critérios de aceite

- [x] O desconto não é aplicado em pagamentos por cartão.
- [x] O valor exibido no checkout é igual ao valor enviado ao backend.
- [x] O valor validado pelo backend é igual ao valor enviado ao Mercado Pago.
- [x] O valor salvo no banco corresponde ao valor realmente pago.

---

## 2. Opção de pagar 50% como sinal

- [x] Adicionar as opções:
  - [x] `Pagar total`.
  - [x] `Pagar sinal de 50%`.
- [x] Definir quando a opção de sinal será exibida:
  - [ ] Sempre.
  - [x] Apenas para reservas acima de um valor mínimo.
  - [x] Por configuração administrativa.
- [x] Enviar `paymentMode` corretamente para o backend.
- [x] Validar no backend se o valor esperado corresponde:
  - [x] Ao valor total.
  - [x] A 50% do valor da reserva.
- [x] Exibir no resumo da compra:
  - [x] `Restante a pagar no check-in`.

Analise o projeto atual e implemente a configuração administrativa de pagamento parcial de reservas.

Antes de criar uma nova página, verifique se já existe uma área de configurações de pagamento, reservas, tarifas ou checkout. Caso exista, adicione a funcionalidade nessa área. Caso não exista um local adequado, crie uma nova página administrativa.

## Objetivo

Permitir que o administrador controle quando o cliente poderá pagar apenas uma parte da reserva no momento da compra.

A funcionalidade deve permitir:

- Habilitar ou desabilitar o pagamento parcial.
- Definir o percentual que será pago inicialmente.
- Definir um valor mínimo para a reserva.
- Definir a antecedência mínima em dias.
- Bloquear o pagamento parcial em reservas de última hora.
- Definir quando o saldo restante será cobrado.
- Permitir pagamento integral como opção padrão.

## Página administrativa

Criar uma página ou seção chamada:

`Configurações de pagamento parcial`

Sugestão de rota:

`/admin/settings/partial-payment`

Adapte a rota ao padrão existente no projeto.

A página deve estar disponível somente para usuários administrativos autorizados.

## Campos da configuração

### 1. Habilitar pagamento parcial

Componente:

- Switch ou checkbox.

Campo:

```ts
enabled: boolean
```

Descrição:

`Permite que o hóspede pague uma parte da reserva no momento da confirmação.`

Quando estiver desabilitado, todas as reservas devem exigir pagamento integral.

### 2. Percentual do pagamento inicial

Componente:

- Campo numérico.
- Sufixo `%`.

Campo:

```ts
percentage: number
```

Regras:

- Valor mínimo: `1`.
- Valor máximo: `99`.
- Valor padrão: `50`.
- Permitir somente números inteiros, salvo se o projeto já trabalhar com percentuais decimais.

Descrição:

`Percentual do valor total que será cobrado no momento da reserva.`

Exemplo visual:

`O cliente pagará 50% agora e 50% posteriormente.`

### 3. Valor mínimo da reserva

Componente:

- Campo monetário.

Campo:

```ts
minimumBookingAmount: number | null
```

Descrição:

`O pagamento parcial será exibido apenas quando o valor total da reserva atingir este valor.`

Exemplo:

`R$ 1.000,00`

Caso o campo esteja vazio ou seja zero, não aplicar restrição por valor mínimo.

### 4. Antecedência mínima

Componente:

- Campo numérico.
- Sufixo `dias`.

Campo:

```ts
minimumLeadTimeDays: number | null
```

Descrição:

`Quantidade mínima de dias entre a data da reserva e o check-in para permitir pagamento parcial.`

Exemplo:

Se o valor configurado for `3`, reservas com check-in em menos de três dias devem exigir pagamento integral.

Caso o campo esteja vazio ou seja zero, não aplicar restrição por antecedência.

### 5. Bloquear para reservas de última hora

Componente:

- Switch ou checkbox.

Campo:

```ts
blockLastMinuteBookings: boolean
```

Descrição:

`Exige pagamento integral em reservas feitas próximas à data do check-in.`

Quando ativado, utilizar o valor definido em `minimumLeadTimeDays`.

Evitar criar duas regras conflitantes. Caso essa configuração seja redundante com a antecedência mínima, simplifique a interface e utilize apenas a antecedência mínima, mostrando claramente que reservas abaixo desse prazo exigirão pagamento integral.

### 6. Momento de pagamento do saldo

Componente:

- Select ou radio buttons.

Campo:

```ts
balanceDueAt: 'CHECK_IN' | 'BEFORE_CHECK_IN'
```

Opções:

- `No check-in`.
- `Antes do check-in`.

Quando a opção `Antes do check-in` for selecionada, exibir:

```ts
balanceDueDaysBeforeCheckIn: number
```

Descrição:

`Quantidade de dias antes do check-in em que o saldo deverá ser cobrado.`

Exemplo:

`Cobrar o saldo 2 dias antes do check-in.`

### 7. Opção padrão no checkout

Componente:

- Select ou radio buttons.

Campo:

```ts
defaultPaymentMode: 'FULL' | 'PARTIAL'
```

Opções:

- `Pagamento integral`.
- `Pagamento parcial`.

Usar `Pagamento integral` como padrão inicial.

## Estrutura sugerida

```ts
interface PartialPaymentSettings {
  enabled: boolean
  percentage: number
  minimumBookingAmount: number | null
  minimumLeadTimeDays: number | null
  balanceDueAt: 'CHECK_IN' | 'BEFORE_CHECK_IN'
  balanceDueDaysBeforeCheckIn: number | null
  defaultPaymentMode: 'FULL' | 'PARTIAL'
}
```

Não utilize `blockLastMinuteBookings` caso a regra possa ser representada somente por `minimumLeadTimeDays`. Evite armazenar configurações redundantes.

## Comportamento da interface

Quando `enabled` estiver desativado:

- Desabilitar visualmente os demais campos.
- Manter os valores já configurados.
- Não apagar os dados automaticamente.

Adicionar uma área de pré-visualização com exemplos.

Exemplo:

```text
Reserva: R$ 2.000,00
Pagamento agora: R$ 1.000,00
Restante: R$ 1.000,00
Pagamento do saldo: no check-in
```

Caso o valor esteja abaixo do mínimo configurado:

```text
Esta reserva exigirá pagamento integral porque não atingiu o valor mínimo.
```

Caso a reserva seja de última hora:

```text
Esta reserva exigirá pagamento integral devido à proximidade do check-in.
```

## Botões

Adicionar:

- `Salvar configurações`.
- `Cancelar` ou `Restaurar alterações`.

Ao salvar:

- Exibir estado de carregamento.
- Impedir envios duplicados.
- Exibir mensagem de sucesso.
- Exibir erros retornados pelo backend.
- Atualizar os dados exibidos após a confirmação.

## Backend

Criar ou adaptar endpoints seguindo o padrão atual do projeto.

Exemplo:

```http
GET /admin/settings/partial-payment
PUT /admin/settings/partial-payment
```

O backend deve:

- Exigir autenticação administrativa.
- Validar todos os campos.
- Persistir as configurações.
- Retornar a configuração atual.
- Registrar alterações importantes em log ou auditoria, caso o sistema já possua esse recurso.

Validações mínimas:

```ts
percentage >= 1 && percentage <= 99
minimumBookingAmount >= 0
minimumLeadTimeDays >= 0
balanceDueDaysBeforeCheckIn >= 0
```

Quando `balanceDueAt` for `BEFORE_CHECK_IN`, exigir `balanceDueDaysBeforeCheckIn`.

Nunca confiar somente nas validações do frontend.

## Aplicação da regra no checkout

A opção `Pagar parcialmente` só deve aparecer quando todas as condições forem atendidas:

```ts
partialPaymentEnabled === true
totalAmount >= minimumBookingAmount
leadTimeDays >= minimumLeadTimeDays
```

Campos opcionais ou nulos não devem bloquear a opção.

O frontend do checkout pode exibir os valores, mas o cálculo oficial deve ser realizado pelo backend.

Exemplo:

```ts
amountDueNow = roundCurrency(totalAmount * percentage / 100)
remainingAmount = totalAmount - amountDueNow
```

Usar a função monetária já existente no projeto. Não calcular dinheiro usando arredondamento inconsistente ou valores de ponto flutuante sem tratamento.

## Pagamento da reserva

Ao criar o pagamento, enviar apenas o modo escolhido:

```ts
paymentMode: 'FULL' | 'PARTIAL'
```

Não confiar em valores enviados pelo frontend para decidir quanto cobrar.

O backend deve:

1. Buscar as configurações atuais.
2. Validar se a reserva pode utilizar pagamento parcial.
3. Calcular o valor devido.
4. Rejeitar tentativas de pagamento parcial que não atendam às regras.
5. Registrar o valor total, o valor pago e o saldo restante.

## Banco de dados

Antes de criar uma nova tabela, verifique como as configurações administrativas são armazenadas atualmente.

Prefira seguir o padrão existente.

Caso seja necessária uma nova estrutura, criar uma configuração equivalente a:

```ts
partialPaymentSettings: {
  enabled: boolean
  percentage: number
  minimumBookingAmount: number | null
  minimumLeadTimeDays: number | null
  balanceDueAt: 'CHECK_IN' | 'BEFORE_CHECK_IN'
  balanceDueDaysBeforeCheckIn: number | null
  defaultPaymentMode: 'FULL' | 'PARTIAL'
}
```

Criar migration se necessário.

Não armazenar valores monetários em ponto flutuante. Utilizar centavos inteiros ou o tipo decimal já adotado pelo sistema.

## Permissões

Garantir que:

- Apenas administradores autorizados possam visualizar e editar.
- Usuários comuns não tenham acesso à rota ou ao endpoint.
- A proteção exista no frontend e no backend.

## Testes

Adicionar testes para:

- Configuração desabilitada.
- Reserva abaixo do valor mínimo.
- Reserva exatamente no valor mínimo.
- Reserva com antecedência abaixo do limite.
- Reserva exatamente no limite de antecedência.
- Percentual inválido.
- Pagamento integral.
- Pagamento parcial.
- Cálculo e arredondamento monetário.
- Tentativa de alterar as configurações sem permissão.
- Tentativa de forçar `paymentMode: PARTIAL` diretamente na API.
- Cobrança do saldo no check-in.
- Cobrança do saldo antes do check-in.

## Critérios de aceite

A implementação estará concluída quando:

- O administrador conseguir habilitar e desabilitar o pagamento parcial.
- O percentual puder ser configurado.
- O valor mínimo puder ser configurado.
- A antecedência mínima puder ser configurada.
- Reservas de última hora exigirem pagamento integral.
- As regras forem validadas no backend.
- O checkout exibir corretamente as opções disponíveis.
- O resumo informar o valor pago e o saldo restante.
- Usuários sem permissão não conseguirem alterar a configuração.
- Os testes principais estiverem passando.

Siga os componentes, padrões visuais, arquitetura, nomenclatura, tratamento de erros e convenções já existentes no projeto. Não crie uma segunda solução para recursos que já existam. Antes de implementar, identifique os arquivos e módulos que serão alterados e, ao final, apresente um resumo das mudanças realizadas.

### Critérios de aceite

- [x] O backend não confia apenas no valor enviado pelo frontend.
- [x] O backend recalcula o valor esperado com base no `paymentMode`.
- [x] Reservas com sinal exibem claramente o saldo restante.
- [x] O valor de 50% respeita a regra de arredondamento definida pelo sistema.

---

## 3. Registro correto de pagamentos parciais

- [x] Salvar `Payment.amount` com o valor efetivamente pago.
- [x] Salvar indicador de pagamento parcial, caso o schema permita.
- [x] Avaliar criação ou uso de campos como:
  - [x] `paymentMode`.
  - [x] `paymentStatus`.
  - [ ] `isPartialPayment`.
  - [x] `remainingAmount`.
- [x] Exibir no admin se a reserva foi:
  - [x] Paga integralmente.
  - [x] Paga parcialmente com sinal.
  - [ ] Não paga.
- [x] Evitar que uma reserva com sinal seja tratada como totalmente paga.

### Critérios de aceite

- [x] O status financeiro da reserva reflete o valor realmente recebido.
- [x] O admin diferencia pagamento total de pagamento parcial.
- [x] O saldo restante fica disponível para consulta.

---

## 4. Emails para pagamento parcial

### Email do hóspede

- [x] Exibir o valor total da reserva.
- [x] Exibir o valor pago no momento.
- [x] Exibir o saldo restante.
- [x] Informar que o restante deverá ser pago no check-in.
- [x] Destacar visualmente quando o pagamento for parcial.

### Email do admin

- [x] Exibir o valor total da reserva.
- [x] Exibir o valor pago.
- [x] Exibir o saldo restante.
- [x] Destacar que a reserva recebeu apenas um sinal.
- [x] Informar o método de pagamento utilizado.

### Critérios de aceite

- [x] Os emails usam os mesmos valores salvos no banco.
- [x] O conteúdo não informa pagamento integral quando houve apenas sinal.
- [x] O saldo restante aparece de forma clara.

---

## 5. Alertas para erros de pagamento

- [ ] Enviar alerta quando o Mercado Pago rejeitar o pagamento.
- [ ] Enviar alerta quando o Brick ou a API apresentar erro técnico.
- [ ] Enviar alerta nos seguintes casos:
  - [ ] Valor divergente.
  - [ ] Pagamento duplicado.
  - [ ] Dados do pagador ausentes.
  - [ ] Erro inesperado.
  - [ ] Falha de comunicação com o Mercado Pago.
- [ ] Incluir no alerta:
  - [ ] Nome do hóspede.
  - [ ] Email.
  - [ ] Telefone ou WhatsApp.
  - [ ] Código ou identificação da reserva.
  - [ ] Quarto.
  - [ ] Valor.
  - [ ] Erro ocorrido.
  - [ ] Etapa do funil em que ocorreu o erro.

---

## 6. Email para o admin em caso de erro

- [ ] Criar ou reutilizar helper/endpoint semelhante a `sendDifficultyAlertEmail`.
- [ ] Enviar o alerta para `CONTACT_RECEIVER_EMAIL`.
- [ ] Usar assunto claro, por exemplo:
  - [ ] `Erro no pagamento - Nome do hóspede`.
- [ ] Incluir resumo completo do erro.
- [ ] Incluir botão ou link para contato via WhatsApp.

### Critérios de aceite

- [ ] O email é enviado para erros técnicos e rejeições relevantes.
- [ ] O admin recebe contexto suficiente para atender o hóspede.
- [ ] O link do WhatsApp abre com a mensagem preenchida.

---

## 7. WhatsApp no fluxo de erro

- [ ] Exibir botão `Falar no WhatsApp` quando ocorrer erro no pagamento.
- [ ] Criar mensagem automática com o contexto da reserva.
- [ ] Usar mensagem semelhante a:
  - [ ] `Olá, tive um problema para pagar minha reserva código XXXX.`
- [ ] Incluir, quando possível:
  - [ ] Código da reserva.
  - [ ] Nome do hóspede.
  - [ ] Quarto.
  - [ ] Valor da tentativa.
- [ ] Garantir que o fluxo de suporte não dependa apenas de email.

### Critérios de aceite

- [ ] O botão aparece somente em situações de erro.
- [ ] O número de WhatsApp é obtido de configuração segura.
- [ ] A mensagem é codificada corretamente na URL.
- [ ] O link funciona em celular e desktop.

---

## 8. Recuperação automática de pagamento abandonado

- [ ] Definir o tempo de espera antes do contato.
- [ ] Após X minutos sem pagamento, enviar email de ajuda ao hóspede.
- [ ] Garantir que o email não seja enviado para pagamentos já concluídos.
- [ ] Evitar envios duplicados.
- [ ] Registrar data e status da tentativa de recuperação.
- [ ] Avaliar alerta opcional para o admin.
- [ ] Deixar envio por WhatsApp como melhoria futura, após estabilização da integração.

### Critérios de aceite

- [ ] Apenas reservas pendentes recebem o email.
- [ ] Cada abandono gera no máximo um alerta por janela definida.
- [ ] O sistema cancela a recuperação caso o pagamento seja concluído.

---

## 9. Rastreamento e auditoria de erros

- [ ] Salvar `lastErrorMessage` na reserva.
- [ ] Registrar a etapa do erro.
- [ ] Padronizar códigos de erro, incluindo:
  - [ ] `PAYMENT_BRICK_ERROR`.
  - [ ] `PAYMENT_REJECTED`.
  - [ ] `PAYMENT_AMOUNT_MISMATCH`.
  - [ ] `PAYMENT_DUPLICATE`.
  - [ ] `PAYMENT_PAYER_MISSING`.
  - [ ] `PAYMENT_API_ERROR`.
  - [ ] `PAYMENT_UNEXPECTED_ERROR`.
- [ ] Salvar data e hora do último erro.
- [ ] Mostrar o erro e a etapa no admin de reservas.
- [ ] Evitar salvar dados sensíveis de cartão ou credenciais.

### Critérios de aceite

- [ ] O admin consegue identificar onde o pagamento falhou.
- [ ] Os logs permitem correlacionar reserva, tentativa e resposta do provedor.
- [ ] Nenhum dado sensível é armazenado indevidamente.

---

## 10. Validações de segurança e consistência

- [ ] Recalcular valores no backend.
- [ ] Não aceitar como verdade o valor enviado pelo frontend.
- [ ] Validar:
  - [ ] Valor original.
  - [ ] Desconto PIX.
  - [ ] Modo de pagamento.
  - [ ] Valor final esperado.
  - [ ] Valor recebido do Mercado Pago.
- [ ] Impedir processamento de pagamento duplicado.
- [ ] Garantir idempotência no processamento.
- [ ] Registrar divergências antes de alterar o status da reserva.
- [ ] Não marcar reserva como paga antes da confirmação válida do provedor.

---

## 11. Atualizações no painel administrativo

- [ ] Exibir status financeiro da reserva.
- [ ] Exibir modo de pagamento:
  - [ ] Total.
  - [ ] Sinal de 50%.
- [ ] Exibir valor total.
- [ ] Exibir valor pago.
- [ ] Exibir saldo restante.
- [ ] Exibir método de pagamento.
- [ ] Exibir último erro.
- [ ] Exibir etapa do erro.
- [ ] Destacar visualmente reservas com pagamento parcial.
- [ ] Destacar tentativas de pagamento com falha.

---

## 12. Testes do fluxo completo

### Pagamentos

- [ ] Testar cartão aprovado.
- [ ] Testar cartão recusado.
- [ ] Testar PIX aprovado.
- [ ] Testar PIX com desconto de 5%.
- [ ] Testar pagamento total.
- [ ] Testar pagamento de sinal de 50%.
- [ ] Testar arredondamento do valor de 50%.
- [ ] Testar divergência entre valor esperado e valor recebido.
- [ ] Testar tentativa de pagamento duplicado.

### Erros e alertas

- [ ] Simular erro técnico no Brick.
- [ ] Simular erro na API.
- [ ] Simular pagador ausente.
- [ ] Confirmar recebimento do email de alerta pelo admin.
- [ ] Confirmar conteúdo do email de erro.
- [ ] Confirmar funcionamento do link de WhatsApp.
- [ ] Confirmar mensagem automática do WhatsApp.

### Banco de dados

- [ ] Confirmar valor original salvo.
- [ ] Confirmar desconto salvo.
- [ ] Confirmar valor pago salvo.
- [ ] Confirmar saldo restante salvo ou calculado corretamente.
- [ ] Confirmar status de pagamento parcial.
- [ ] Confirmar registro de `lastErrorMessage`.
- [ ] Confirmar registro da etapa do erro.

### Emails

- [ ] Confirmar email de pagamento total.
- [ ] Confirmar email de pagamento parcial.
- [ ] Confirmar que o email do hóspede mostra o saldo restante.
- [ ] Confirmar que o email do admin destaca pagamento parcial.
- [ ] Confirmar que reservas pagas não recebem recuperação de abandono.

### Painel administrativo

- [ ] Confirmar status de pagamento total.
- [ ] Confirmar status de pagamento parcial.
- [ ] Confirmar saldo restante.
- [ ] Confirmar exibição do último erro.
- [ ] Confirmar exibição da etapa do erro.

---

## 13. Checklist antes do commit

- [x] Todos os testes críticos foram executados.
- [x] Frontend, backend e Mercado Pago usam o mesmo valor final.
- [x] O backend recalcula e valida todos os valores.
- [x] Pagamento parcial não é tratado como pagamento integral.
- [ ] Emails exibem valores corretos.
- [ ] Alertas de erro estão funcionando.
- [ ] Link do WhatsApp foi validado.
- [ ] Painel administrativo exibe status correto.
- [ ] Logs não expõem dados sensíveis.
- [ ] Variáveis de ambiente necessárias estão documentadas.
- [ ] Migrações de banco foram criadas e testadas, se aplicável.
- [ ] Código revisado antes do commit.
"""
