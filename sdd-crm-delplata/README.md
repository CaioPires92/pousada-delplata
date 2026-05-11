# SDD — CRM WhatsApp Delplata

Este diretório contém a documentação SDD do módulo CRM WhatsApp dentro do projeto `Delplata-Motor`.

## Arquivos

1. `01-requirements.md`  
   Define o que o CRM deve fazer, o que não deve fazer e quais limites técnicos devem ser respeitados.

2. `02-design-doc.md`  
   Define arquitetura, stack, banco de dados, rotas, serviços, componentes e integração futura com n8n.

3. `03-task-list.md`  
   Lista sequencial de tarefas para implementação. Deve ser seguida em ordem, sem pular etapas.

4. `04-codex-instructions.md`  
   Regras de execução para Codex/IA: como trabalhar, o que validar, o que não alterar e como reportar progresso.

5. `05-event-contracts.md`  
   Contratos de eventos internos para permitir automação via n8n sem transformar o n8n no dono dos dados.

## Princípio central

O CRM é o sistema de registro.  
O n8n será o orquestrador de automações.  
O motor de reservas continuará sendo o domínio de disponibilidade, preço e reserva.

Regra de ouro:

```txt
Canal → CRM API → Banco → Evento → n8n → CRM API → Banco/WhatsApp/Site
```

O n8n nunca deve alterar o banco diretamente.
