# Plano de implementação — CRM + Evolution API

Este plano substitui o canal alvo da Fase 2 do CRM sem remover a implementação
Meta. O contrato `MessagingProvider` continua sendo a fronteira do domínio; Meta
fica isolada e inativa, disponível apenas para referência ou rollback futuro.

## Diagnóstico inicial

- [x] Confirmar branch de desenvolvimento (`codex/crm-meta-continuation`).
- [x] Inventariar alterações preexistentes e preservar o worktree do usuário.
- [x] Mapear arquitetura, testes, banco, filas, Inbox e automações do CRM.
- [x] Identificar interrupção da Meta: código até F2.13 e runner F2.14 prontos,
  sem credenciais/E2E real, canário ou ativação do provedor.
- [x] Identificar legado Evolution reutilizável: Docker, scripts operacionais,
  webhook persistente, envio de texto, resolução de JID e testes de idempotência.
- [x] Validar contratos oficiais da Evolution API v2 para instância, conexão,
  envio de texto e webhooks.

## Incrementos de implementação

- [ ] E1 Criar configuração tipada e `EvolutionMessagingProvider` com envio de
  texto, erros sanitizados e testes de contrato.
- [ ] E2 Normalizar webhooks Evolution no contrato comum, incluindo mensagens e
  estados de entrega, com fixtures sanitizadas e testes.
- [ ] E3 Criar seleção central por `WHATSAPP_PROVIDER`, mantendo Meta isolada e
  Evolution como padrão explícito.
- [ ] E4 Migrar envio humano e worker de automação para o provider central,
  preservando pausa, auditoria, circuit breaker e dead-letter.
- [ ] E5 Migrar o webhook Evolution para persistência/deduplicação compartilhada
  e atualizar estados de entrega sem regressão no fluxo CRM existente.
- [ ] E6 Implementar health check Evolution protegido e independente da Meta.
- [ ] E7 Endurecer autenticação do webhook, validação de instância, limites de
  payload, logs sem PII/segredos e documentação das variáveis.
- [ ] E8 Completar operações de instância: criar, conectar/QR, estado, webhook e
  exclusão segura, com testes sem rede real.
- [ ] E9 Preparar E2E opt-in Evolution (envio + evidência do webhook), sem exigir
  credenciais reais nos testes automatizados.
- [ ] E10 Executar typecheck, suíte CRM, testes afetados e build; corrigir todas
  as regressões atribuíveis à integração.
- [ ] E11 Atualizar arquitetura, runbook de operação/rollback e instruções de
  implantação da Evolution API.

## Gate por incremento

Cada item E1–E11 deve seguir: teste direcionado, implementação mínima, teste de
regressão, atualização deste checklist e commit pequeno. Arquivos e variáveis da
Meta não serão removidos. Alterações preexistentes e não relacionadas não serão
incluídas nos commits da integração.
