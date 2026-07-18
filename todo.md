# TODO — Melhorias no Fluxo de Pagamentos

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

Escopo ajustado: o objetivo é receber um email de recuperação quando o hóspede já informou os dados e houve desistência, rejeição ou erro no pagamento, para que a pousada possa entrar em contato e ajudar.

- [x] Enviar alerta quando o Mercado Pago rejeitar o pagamento.
- [x] Enviar alerta quando o Brick ou a API apresentar erro técnico.
- [x] Enviar alerta nos seguintes casos:
  - [x] Valor divergente.
  - [x] Pagamento duplicado.
  - [x] Dados do pagador ausentes.
  - [x] Erro inesperado.
  - [x] Falha de comunicação com o Mercado Pago.
- [x] Incluir no alerta:
  - [x] Nome do hóspede.
  - [x] Email.
  - [x] Telefone ou WhatsApp.
  - [x] Código ou identificação da reserva.
  - [x] Quarto.
  - [x] Valor.
  - [x] Erro ocorrido.
  - [x] Etapa do funil em que ocorreu o erro.

---

## 6. Email para o admin em caso de erro

- [x] Criar ou reutilizar helper/endpoint semelhante a `sendDifficultyAlertEmail`.
- [x] Enviar o alerta para `CONTACT_RECEIVER_EMAIL`.
- [x] Usar assunto claro, por exemplo:
  - [x] `Erro no pagamento - Nome do hóspede`.
- [x] Incluir resumo completo do erro.
- [x] Incluir botão ou link para contato via WhatsApp.

### Critérios de aceite

- [x] O email é enviado para erros técnicos e rejeições relevantes.
- [x] O admin recebe contexto suficiente para atender o hóspede.
- [x] O link do WhatsApp abre com a mensagem preenchida.

---

## 7. WhatsApp no fluxo de erro

- [x] Exibir botão `Falar no WhatsApp` quando ocorrer erro no pagamento.
- [x] Criar mensagem automática com o contexto da reserva.
- [x] Usar mensagem semelhante a:
  - [x] `Olá, tive um problema para pagar minha reserva código XXXX.`
- [x] Incluir, quando possível:
  - [x] Código da reserva.
  - [x] Nome do hóspede.
  - [x] Quarto.
  - [x] Valor da tentativa.
- [x] Garantir que o fluxo de suporte não dependa apenas de email.

### Critérios de aceite

- [x] O botão aparece somente em situações de erro.
- [x] O número de WhatsApp é obtido de configuração segura.
- [x] A mensagem é codificada corretamente na URL.
- [x] O link funciona em celular e desktop.

---

## 8. Recuperação automática de pagamento abandonado

- [x] Definir o tempo de espera antes do contato.
- [x] Após X minutos sem pagamento, enviar email de ajuda ao hóspede.
- [x] Garantir que o email não seja enviado para pagamentos já concluídos.
- [x] Evitar envios duplicados.
- [x] Registrar data e status da tentativa de recuperação.
- [ ] Avaliar alerta opcional para o admin. (se possivel um email de lembrete para pousada delplata e no painel adminstrativo um sino com notificacao das reservas que nao foram concluidas ou ate das que foram e ter a opcao de limpar notificacoes)
- [ ] Deixar envio por WhatsApp como melhoria futura, após estabilização da integração.

### Critérios de aceite

- [x] Apenas reservas pendentes recebem o email.
- [x] Cada abandono gera no máximo um alerta por janela definida.
- [x] O sistema cancela a recuperação caso o pagamento seja concluído.

---

## 9. Rastreamento e auditoria de erros

- [x] Salvar `lastErrorMessage` na reserva.
- [x] Registrar a etapa do erro.
- [ ] Padronizar códigos de erro, incluindo:
  - [ ] `PAYMENT_BRICK_ERROR`.
  - [ ] `PAYMENT_REJECTED`.
  - [ ] `PAYMENT_AMOUNT_MISMATCH`.
  - [ ] `PAYMENT_DUPLICATE`.
  - [ ] `PAYMENT_PAYER_MISSING`.
  - [ ] `PAYMENT_API_ERROR`.
  - [ ] `PAYMENT_UNEXPECTED_ERROR`.
- [x] Salvar data e hora do último erro.
- [x] Mostrar o erro e a etapa no admin de reservas.
- [x] Evitar salvar dados sensíveis de cartão ou credenciais.

### Critérios de aceite

- [x] O admin consegue identificar onde o pagamento falhou.
- [x] Os logs permitem correlacionar reserva, tentativa e resposta do provedor.
- [x] Nenhum dado sensível é armazenado indevidamente.

---

## 10. Validações de segurança e consistência

- [x] Recalcular valores no backend.
- [x] Não aceitar como verdade o valor enviado pelo frontend.
- [x] Validar:
  - [x] Valor original.
  - [x] Desconto PIX.
  - [x] Modo de pagamento.
  - [x] Valor final esperado.
  - [ ] Valor recebido do Mercado Pago.
- [x] Impedir processamento de pagamento duplicado.
- [x] Garantir idempotência no processamento.
- [x] Registrar divergências antes de alterar o status da reserva.
- [x] Não marcar reserva como paga antes da confirmação válida do provedor.

---

## 11. Atualizações no painel administrativo

- [x] Exibir status financeiro da reserva.
- [x] Exibir modo de pagamento:
  - [x] Total.
  - [x] Sinal de 50%.
- [x] Exibir valor total.
- [x] Exibir valor pago.
- [x] Exibir saldo restante.
- [x] Exibir método de pagamento.
- [x] Exibir último erro.
- [x] Exibir etapa do erro.
- [x] Destacar visualmente reservas com pagamento parcial.
- [x] Destacar tentativas de pagamento com falha.

---

## 12. Testes do fluxo completo

### Pagamentos

- [x] Testar cartão aprovado.
- [x] Testar cartão recusado.
- [ ] Testar PIX aprovado.
- [ ] Testar PIX com desconto de 5%.
- [x] Testar pagamento total.
- [x] Testar pagamento de sinal de 50%.
- [x] Testar arredondamento do valor de 50%.
- [x] Testar divergência entre valor esperado e valor recebido.
- [x] Testar tentativa de pagamento duplicado.

### Erros e alertas

- [ ] Simular erro técnico no Brick.
- [x] Simular erro na API.
- [ ] Simular pagador ausente.
- [ ] Confirmar recebimento do email de alerta pelo admin.
- [ ] Confirmar conteúdo do email de erro.
- [x] Confirmar funcionamento do link de WhatsApp.
- [x] Confirmar mensagem automática do WhatsApp.

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
- [x] Emails exibem valores corretos.
- [x] Alertas de erro estão funcionando.
- [x] Link do WhatsApp foi validado.
- [x] Painel administrativo exibe status correto.
- [x] Logs não expõem dados sensíveis.
- [x] Variáveis de ambiente necessárias estão documentadas.
- [x] Migrações de banco foram criadas e testadas, se aplicável.
- [x] Código revisado antes do commit.

---

## 14. Backlog futuro — conversão, cupons e painel interno

Estes itens ainda não devem ser tratados como implementados. São melhorias futuras para aumentar reservas pelo motor e melhorar operação interna.

### 14.1 Reativar desconto no motor

- [ ] Revisar a regra atual de desconto já existente no projeto.
- [ ] Definir qual desconto será reativado:
  - [ ] Desconto por Pix.
  - [ ] Cupom manual.
  - [ ] Cupom automático de recuperação.
- [ ] Garantir que o desconto apareça de forma clara antes do pagamento.
- [ ] Salvar no banco:
  - [ ] Valor original.
  - [ ] Código do desconto/cupom aplicado.
  - [ ] Valor do desconto.
  - [ ] Valor final pago.
- [ ] Validar no backend que o desconto aplicado é permitido.
- [ ] Garantir que o Mercado Pago receba exatamente o valor final validado pelo backend.

#### Critérios de aceite

- [ ] O cliente entende claramente o valor original, desconto e valor final.
- [ ] O desconto não pode ser manipulado pelo frontend.
- [ ] O admin consegue identificar qual desconto foi usado na reserva.
- [ ] Os e-mails de confirmação exibem valores coerentes com o desconto aplicado.

### 14.2 Cupom automático de 5% para abandono de reserva

- [ ] Criar regra para gerar cupom de 5% quando uma reserva for abandonada.
- [ ] Definir quando uma reserva conta como abandonada:
  - [ ] Reserva criada e sem pagamento após X minutos.
  - [ ] Pagamento iniciado, mas não aprovado.
  - [ ] Reserva expirada sem pagamento.
- [ ] Definir validade do cupom:
  - [ ] Exemplo: 24h, 48h ou 72h.
- [ ] Definir se o cupom será único por reserva/hóspede.
- [ ] Vincular o cupom ao e-mail/telefone do hóspede para evitar uso indevido.
- [ ] Incluir o cupom no e-mail de recuperação de abandono.
- [ ] Exibir CTA no e-mail levando de volta para o motor de reservas com o cupom aplicado.
- [ ] Garantir que reserva já paga/confirmada não receba cupom.
- [ ] Evitar envio duplicado de cupom para a mesma reserva.
- [ ] Registrar no banco:
  - [ ] Cupom gerado.
  - [ ] Reserva original abandonada.
  - [ ] Hóspede/e-mail vinculado.
  - [ ] Data de envio.
  - [ ] Data de expiração.
  - [ ] Status: gerado, enviado, usado, expirado, cancelado.

#### Critérios de aceite

- [ ] O hóspede recebe apenas um cupom por abandono.
- [ ] O cupom concede exatamente 5%.
- [ ] O cupom não funciona após expirar.
- [ ] O cupom não funciona para outro e-mail/telefone, se a regra exigir vínculo.
- [ ] O painel administrativo mostra se o cupom foi usado para recuperar a reserva.
- [ ] O e-mail deixa claro que o desconto é para concluir a reserva pelo site.

### 14.3 Busca no dashboard interno por reserva e hóspede

- [ ] Adicionar campo de busca com ícone de lupa no dashboard/painel de reservas.
- [ ] Permitir filtro por:
  - [ ] Número/código da reserva.
  - [ ] ID completo da reserva.
  - [ ] Nome do hóspede.
  - [ ] E-mail do hóspede, se fizer sentido.
  - [ ] Telefone/WhatsApp, se fizer sentido.
- [ ] A busca deve funcionar sem recarregar a página inteira quando possível.
- [ ] A busca deve aceitar parte do texto:
  - [ ] Exemplo: buscar `CAIO` encontra `CAIO CESAR DE GODOI PIRES`.
  - [ ] Exemplo: buscar os primeiros caracteres do ID encontra a reserva.
- [ ] Exibir estado vazio claro quando nada for encontrado.
- [ ] Manter filtros atuais de status/data funcionando junto com a busca, se existirem.
- [ ] Garantir que a busca não quebre paginação ou ordenação.

#### Critérios de aceite

- [ ] Admin encontra uma reserva pelo código/ID.
- [ ] Admin encontra uma reserva pelo nome do hóspede.
- [ ] Campo tem ícone de lupa visível.
- [ ] Busca funciona em desktop e mobile.
- [ ] Busca não expõe dados sensíveis além do que o admin já pode ver.
- [ ] Testes cobrem busca por ID e nome.
