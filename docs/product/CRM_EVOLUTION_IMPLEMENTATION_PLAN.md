# Plano de implementação — CRM + Evolution API

Este plano substitui o canal alvo da Fase 2 do CRM sem remover a implementação
Meta. O contrato `MessagingProvider` continua sendo a fronteira do domínio; Meta
fica isolada e inativa, disponível apenas para referência ou rollback futuro.

Este é o plano operacional vigente para o canal WhatsApp. As referências à Meta
em `CRM_AI_PRD.md` e `CRM_AI_PHASES_TODO.md` permanecem como histórico da
tentativa anterior e não autorizam a troca do provedor ativo. A evolução das
automações continua seguindo as fases de segurança desses documentos, mas usa a
Evolution API como transporte.

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

- [x] E1 Criar configuração tipada e `EvolutionMessagingProvider` com envio de
  texto, erros sanitizados e testes de contrato.
- [x] E2 Normalizar webhooks Evolution no contrato comum, incluindo mensagens e
  estados de entrega, com fixtures sanitizadas e testes.
- [x] E3 Criar seleção central por `WHATSAPP_PROVIDER`, mantendo Meta isolada e
  Evolution como padrão explícito.
- [x] E4 Migrar envio humano e worker de automação para o provider central,
  preservando pausa, auditoria, circuit breaker e dead-letter.
- [x] E4b Migrar ações internas, follow-ups e automação do chatbot que ainda
  chamam diretamente o helper Evolution legado.
- [x] E5 Migrar o webhook Evolution para persistência/deduplicação compartilhada
  e atualizar estados de entrega sem regressão no fluxo CRM existente.
- [x] E6 Implementar health check Evolution protegido e independente da Meta.
- [x] E7 Endurecer autenticação do webhook, validação de instância, limites de
  payload, logs sem PII/segredos e documentação das variáveis.
- [x] E8 Completar operações de instância: criar, conectar/QR, estado, webhook e
  exclusão segura, com testes sem rede real.
- [x] E9 Preparar E2E opt-in Evolution (envio + evidência do webhook), sem exigir
  credenciais reais nos testes automatizados.
- [x] E10 Executar typecheck, suíte CRM, testes afetados e build; corrigir todas
  as regressões atribuíveis à integração.
- [x] E11 Atualizar arquitetura, runbook de operação/rollback e instruções de
  implantação da Evolution API.

## Estabilização funcional após a integração

- [x] E12 Validar conexão real, QR Code, webhook, recebimento, envio humano e
  estados de entrega com a instância Evolution.
- [x] E13 Corrigir reconciliação de identidades telefone/LID e garantir
  idempotência sob webhooks simultâneos.
- [x] E14 Impedir respostas duplicadas do chatbot e validar o fluxo com a
  automação pausada por atendimento humano.
- [x] E15 Corrigir a continuação da cotação quando datas e hóspedes chegam logo
  após a pergunta automática.
- [x] E16 Validar deterministicamente datas, período e quantidade de hóspedes,
  solicitando novamente somente os campos inválidos.
- [x] E16b Criar interruptor global persistente e auditado para bloquear todas as
  respostas automáticas sem interromper recebimento ou atendimento manual.
- [ ] E17 Tratar intenção desconhecida e baixa confiança com resposta segura e
  encaminhamento humano, sem inventar serviços ou políticas.
- [ ] E18 Preparar base de conhecimento aprovada e IA em modo supervisionado.
- [ ] E19 Integrar n8n apenas para orquestração externa autenticada, mantendo
  preço, disponibilidade, reserva e envio sob autoridade do CRM.

## Gate por incremento

Cada item E1–E11 deve seguir: teste direcionado, implementação mínima, teste de
regressão, atualização deste checklist e commit pequeno. Arquivos e variáveis da
Meta não serão removidos. Alterações preexistentes e não relacionadas não serão
incluídas nos commits da integração.
