# Instruções para Codex/IA — CRM WhatsApp Delplata

## 1. Papel da IA

Você deve atuar como engenheiro responsável por implementar o módulo CRM WhatsApp dentro do projeto `Delplata-Motor` seguindo SDD.

Não invente arquitetura nova. Siga estes arquivos:

- `01-requirements.md`
- `02-design-doc.md`
- `03-task-list.md`
- `05-event-contracts.md`

## 2. Regra principal

O CRM é módulo paralelo ao motor de reservas.

Não quebre o motor existente.

## 3. Proibições

Não fazer:

- renomear tabelas antigas;
- apagar migrations;
- alterar regras do motor de reservas sem pedido explícito;
- colocar segredo no código;
- deixar n8n escrever direto no banco;
- tratar LID como telefone;
- implementar IA autônoma fora do escopo;
- criar features não listadas nas tasks;
- fazer refactor grande sem necessidade;
- misturar regra de negócio dentro de componente visual.

## 4. Guardrails (Proteção do Sistema)

### 4.1. Motor de Reservas e Site
O código das pastas e arquivos que não pertencem ao módulo CRM (ex: lógica de preços, disponibilidade, checkout do site) é **intocável**. Qualquer alteração que impacte o motor de reservas deve ser validada e solicitada explicitamente.

### 4.2. Segurança do Banco de Dados
- **Produção (Turso):** Nunca sugerir ou executar `migrate dev` ou comandos que incluam `--force` ou `--reset` contra o banco de produção.
- **Migrações:** Toda migração deve ser revisada para garantir que não cause perda de dados (Data Loss) em colunas legadas.
- **Campos do Motor:** Nunca alterar tipos ou constraints de tabelas do motor de reservas (`RoomType`, `Booking`, etc).

## 5. Forma correta de trabalho

Para cada task:

1. Ler a task inteira.
2. Inspecionar arquivos existentes.
3. Fazer a menor alteração possível.
4. Rodar validações.
5. Reportar resultado.

## 5. Formato obrigatório de resposta ao concluir task

```txt
Task concluída: [número e nome]

Arquivos alterados:
- ...

O que foi feito:
- ...

Como testar:
- ...

Comandos executados:
- ...

Pendências/riscos:
- ...
```

## 6. Comandos de validação

Rodar quando fizer sentido:

```bash
npm run prisma:generate
npm run typecheck
npm run lint
npm run dev
```

Se `npm run typecheck` falhar por erro antigo em `.next/dev/types`, informar como erro pré-existente.

## 7. Banco de dados

Toda migration deve ser aditiva.

Permitido:

- criar tabela nova;
- criar campo novo;
- criar índice;
- criar enum/constante no app.

Evitar:

- drop table;
- rename table;
- alterar campo legado;
- mudar tipo de campo antigo sem justificativa.

## 8. n8n

O n8n será usado futuramente para fluxo de reserva no WhatsApp e site.

Mas a regra é:

```txt
n8n → API CRM → banco
```

Nunca:

```txt
n8n → banco direto
```

## 9. LID WhatsApp

LID é identificador do WhatsApp, não telefone.

Se receber:

```txt
23961740038256@lid
```

Salvar em campo `lid`, não em `phone`.

Telefone real deve vir de JID como:

```txt
5511999999999@s.whatsapp.net
```

## 10. Kanban

O Kanban pode ser atualizado manualmente ou automaticamente.

Toda alteração deve passar por serviço/API do CRM e gerar log.

## 11. Mensagens

Toda mensagem enviada pelo CRM deve:

- ser enviada pela Evolution API;
- ser salva no banco;
- atualizar conversa;
- registrar log;
- pausar automação temporariamente.

## 12. Automação

Antes de bot/n8n responder, verificar:

- `chatbotEnabled`;
- `automationPausedUntil`;
- status da conversa;
- se humano assumiu.

## 13. Resultado esperado

O sistema deve evoluir para:

```txt
WhatsApp + Site Chat → CRM → Kanban → n8n → Reserva/Orçamento → Histórico
```

Sem gambiarra de dados paralelos.
