# CRM WhatsApp Delplata — Arquitetura e SDD

## 1. Visão geral

O projeto Delplata-Motor passa a ter dois domínios dentro do mesmo repositório:

1. Motor de Reservas
2. CRM WhatsApp

O CRM deve ser criado como módulo paralelo, sem alterar o funcionamento do motor atual.

O banco atual já possui estrutura de reservas, quartos, tarifas, disponibilidade, hóspedes, pagamentos, cupons e usuários administrativos. O CRM foi adicionado de forma paralela com Contact, Conversation, Message, PipelineCard, ChatbotSettings e InternalActionLog. :contentReference[oaicite:0]{index=0}

---

## 2. Objetivo do CRM

O CRM tem como objetivo substituir gradualmente o WhatsApp Web da recepção.

Funcionalidades previstas:

- Receber mensagens via Evolution API
- Criar/atualizar contatos
- Criar conversas
- Salvar histórico de mensagens
- Exibir inbox interno
- Permitir resposta manual da recepção
- Pausar chatbot quando humano assumir
- Criar Kanban automático/manual
- Futuramente consultar disponibilidade/preços
- Futuramente operar chatbot do WhatsApp e do site

---

## 3. Stack técnica

### Aplicação

- Next.js
- App Router
- TypeScript
- Prisma ORM

### Banco

- SQLite/Turso via Prisma
- Driver adapter LibSQL

### WhatsApp

- Evolution API
- Instância: usar variável de ambiente
- API Key: usar variável de ambiente

### Automação futura

- n8n
- Chatbot com IA
- Redis opcional para fila/memória curta

---

## 4. Organização de pastas recomendada

```txt
src/
  app/
    api/
      availability/              # motor de reservas atual
      bookings/                  # motor de reservas atual
      crm/
        conversations/
          route.ts               # lista conversas
          [id]/
            route.ts             # detalhe da conversa
      whatsapp/
        webhook/
          route.ts               # recebe mensagens Evolution API
        send/
          route.ts               # envia resposta manual
    admin/
      inbox/
        page.tsx                 # lista conversas
        [id]/
          page.tsx               # histórico da conversa

  lib/
    prisma.ts                    # Prisma Client
    whatsapp/
      evolution.ts               # cliente Evolution API
    crm/
      # serviços futuros do CRM
```

---

## 5. Roadmap de implementação

### FASE 1 — BASE

- [x] Prisma CRM
- [x] Webhook
- [x] Inbox
- [x] Conversation detail
- [x] Evolution API

### FASE 2 — RESPOSTA MANUAL

- [x] Task 1 — Endpoint de envio
- [x] Task 2 — UI de resposta
- [x] Task 3 — UX conversa

### FASE 3 — CONTROLE CHATBOT

- [x] Task 1 — Endpoint PATCH chatbot
- [x] Task 2 — Toggle ON/OFF na conversa

### FASE 4 — KANBAN

- [x] Task 1 — GET pipeline
- [x] Task 2 — Tela kanban
- [x] Task 3 — Mover stage manualmente

### FASE 5 — PERSISTÊNCIA OPERACIONAL / PRODUÇÃO

- [x] Task 1 — Registrar mensagem enviada pelo CRM no banco
- [ ] Task 2 — Confirmar webhook recebendo resposta real do WhatsApp
- [ ] Task 3 — Evitar mensagem duplicada no front
- [ ] Task 4 — Atualizar preview da conversa após envio/recebimento
- [ ] Task 5 — Status visual: enviada / recebida / erro

### FASE 6 — AUTOMAÇÃO CONTROLADA

- [ ] Task 1 — Criar tabela/configuração de respostas automáticas
- [ ] Task 2 — Chatbot responder só se `chatbotEnabled = true`
- [ ] Task 3 — Criar regra básica: saudação / preço / disponibilidade
- [ ] Task 4 — Logar toda ação automática
- [ ] Task 5 — Botão “assumir conversa” para desligar bot naquela conversa

### FASE 7 — CRM DE VERDADE

- [ ] Task 1 — Criar lead manualmente
- [ ] Task 2 — Vincular contato a reserva existente
- [ ] Task 3 — Campo de valor estimado
- [ ] Task 4 — Campo de data pretendida
- [ ] Task 5 — Motivo de perda
- [ ] Task 6 — Histórico interno/anotações
