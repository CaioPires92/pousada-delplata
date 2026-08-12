# Plano por fases e microtarefas — CRM IA

**Princípios:** testes primeiro, segurança por padrão, respostas rápidas, mudanças pequenas e reversíveis.
**Fonte comercial:** domínio do Mapa de Tarifas do motor de reservas.
**Canal alvo:** Evolution API. O adaptador Meta permanece preservado, isolado e inativo.
**Regra de entrega:** uma fase só termina quando seu gate de testes passa.

## Definição global de pronto

Cada microtarefa deve:

- ter um comportamento observável e um teste automatizado correspondente;
- alterar preferencialmente um único domínio por commit;
- não depender de segredo real em teste;
- possuir logs sem PII sensível;
- preservar idempotência e rollback;
- documentar variável de ambiente, migration ou contrato novo;
- passar testes unitários, integração afetada, lint e typecheck;
- respeitar orçamento de desempenho definido na fase.

Fluxo de trabalho obrigatório por microtarefa:

```text
teste falha → menor implementação possível → teste passa
→ refatoração → teste de regressão → commit pequeno
```

## Fase 0 — Baseline e proteção do legado

### Regras de negócio

- Nada existente será apagado antes de possuir substituto testado e rollback.
- Banco de produção nunca será usado por testes.
- Segredos não podem estar versionados, impressos ou enviados à IA.
- O comportamento atual deve ser medido antes de ser alterado.

### TODOs

- [x] F0.01 Criar tag Git local do baseline e registrar commit/ambiente.
- [x] F0.02 Inventariar arquivos `.env`, bancos, backups, zips e segredos versionados.
- [ ] F0.03 Remover segredos do Git de forma planejada e rotacioná-los quando necessário. _(adiado por decisão operacional até o fim das implementações)_
- [x] F0.04 Separar testes CRM, motor, WhatsApp e UI em scripts independentes.
- [x] F0.05 Corrigir suíte que excede timeout, identificando o teste responsável.
- [x] F0.06 Registrar tempos de typecheck e testes do gate CRM.
- [x] F0.07 Criar banco isolado por execução da suíte CRM.
- [x] F0.08 Criar gates separados de CI para typecheck, CRM, Mapa, reservas e UI.
- [x] F0.09 Documentar rollback local, GitHub, Vercel, Turso e troca Meta/Evolution.

### Testes/gate

- Testes nunca leem `.env.production` nem alteram `dev.db`.
- Toda suíte encerra processos e conexões.
- Gate mínimo executa de forma repetível três vezes.
- Nenhum segredo conhecido aparece no histórico novo ou nos logs do CI.

### Orçamento de rapidez

- Unitários CRM: alvo menor que 30s.
- Gate de PR: alvo menor que 5min.

## Fase 1 — Serviço único do Mapa do motor

### Regras de negócio

- Mapa do motor é a fonte única de inventário, tarifas, mínimo de noites, `stopSell`, CTA, CTD, capacidade e ocupação.
- CRM não calcula disponibilidade ou preço por conta própria.
- A tela `/admin/mapa` e o CRM consomem o mesmo serviço de domínio.
- Reservas `CONFIRMED`, `PAID` e `PENDING` ainda válidas reduzem inventário conforme regra atual.
- Quarto para quatro hóspedes respeita seu inventário específico.
- Toda cotação retorna versão/horário e prazo de validade.

### TODOs

- [x] F1.01 Caracterizar `/api/availability` com testes das regras atuais.
- [x] F1.02 Testar mínimo de noites, `stopSell`, CTA e CTD isoladamente.
- [x] F1.03 Testar inventário padrão, quatro hóspedes e reservas simultâneas.
- [x] F1.04 Testar expiração de reserva `PENDING`.
- [x] F1.05 Extrair `AvailabilityQuoteService` sem alterar resultados.
- [x] F1.06 Fazer `/api/availability` chamar o serviço extraído.
- [x] F1.07 Fazer `/api/crm/quote` chamar exatamente o mesmo serviço.
- [x] F1.08 Adicionar `quoteId`, `calculatedAt`, `expiresAt` e assinatura/hash dos dados.
- [x] F1.09 Impedir envio de cotação expirada.
- [x] F1.10 Criar teste de contrato comparando site e CRM para a mesma entrada.
- [x] F1.11 Medir e eliminar consultas N+1 do cálculo de disponibilidade.
- [x] F1.12 Documentar o Mapa como fonte oficial.

### Testes/gate

- Tabela de casos cobrindo limites de datas, ocupação e regras tarifárias.
- Site e CRM retornam quartos, total e restrições idênticos.
- Teste concorrente impede sobrevenda.
- Nenhum módulo CRM contém fórmula de preço ou inventário duplicada.

### Segurança e rapidez

- Endpoint administrativo do Mapa continua autenticado; CRM recebe apenas leitura necessária.
- Validar datas, hóspedes, idades e limites antes de consultar banco.
- Meta de p95 local para cotação simples: menor que 500ms após otimização e medição real.

## Fase 2 — Adaptador de canal e WhatsApp via Evolution API

### Regras de negócio

- Código de domínio não conhece payload bruto da Evolution nem da Meta.
- Um `MessagingProvider` normaliza entrada, saída, IDs e status.
- Webhook responde rápido, persiste/deduplica e delega trabalho à fila.
- Toda mensagem usa `wamid`/ID externo para idempotência.
- Evolution é o transporte ativo; regras específicas da Meta só se aplicam se esse adaptador for deliberadamente reativado no futuro.
- Status enviado, entregue, lido e falhou atualizam a mensagem existente.
- Meta permanece preservada apenas como referência/rollback futuro, nunca consumindo simultaneamente o mesmo número.

### TODOs

- [x] F2.01 Definir interface `MessagingProvider` e contratos normalizados.
- [x] F2.02 Criar fixtures sanitizadas de webhook Meta.
- [x] F2.03 Implementar desafio de verificação do webhook.
- [x] F2.04 Validar assinatura do payload antes de processar.
- [x] F2.05 Normalizar texto, botão, lista, imagem, documento e evento de status.
- [x] F2.06 Deduplicar por ID externo e tipo de evento.
- [x] F2.07 Implementar envio de texto pela Cloud API.
- [x] F2.08 Implementar template aprovado e parâmetros tipados.
- [x] F2.09 Persistir status e erro sem vazar token/payload sensível.
- [x] F2.10 Implementar retry apenas para falhas transitórias com backoff e jitter.
- [x] F2.11 Implementar circuit breaker e dead-letter.
- [x] F2.12 Adicionar variáveis Meta ao `.env.example` sem valores reais.
- [x] F2.13 Criar health check do provedor.
- [x] F2.14 Rodar teste ponta a ponta real com instância Evolution conectada.
- [x] F2.15 Executar homologação de baixo volume com recebimento, envio e status.
- [x] F2.16 Selecionar Evolution como provedor principal por feature flag.
- [x] F2.17 Manter a implementação Meta isolada e inativa, sem remover arquivos ou variáveis.

### Testes/gate

- Contrato para todos os payloads suportados e desconhecidos.
- Assinatura inválida retorna erro sem persistir.
- Entrega duplicada produz uma única Message e uma única automação.
- Teste de envio confirma correlação entre request, resposta e status webhook.
- Testes simulam 429, 5xx, timeout, token inválido e payload malformado.

### Segurança e rapidez

- Token somente no servidor/secret manager; permissões mínimas e rotação documentada.
- Webhook não chama IA nem cálculo pesado de forma síncrona.
- Meta de ACK p95 do webhook: menor que 300ms em carga controlada.

## Fase 3 — Inbox e operação humana

### Regras de negócio

- Humano sempre pode assumir e tem prioridade sobre a IA.
- Resposta humana cancela jobs incompatíveis e pausa automação.
- Retorno ao bot é explícito e auditado.
- Mensagens preservam ordem, autor, estado de entrega e correlação.

### TODOs

- [x] F3.01 Testar listagem, paginação e ordenação da Inbox.
- [x] F3.02 Testar recebimento em tempo real/SSE e reconexão.
- [x] F3.03 Criar estados `off`, `supervised` e `auto`.
- [x] F3.03a Separar respostas do chatbot do monitoramento automático do Kanban.
- [x] F3.03b Permitir uma exceção de chatbot por conversa para testes com o bot global desligado.
- [x] F3.04 Implementar assumir, atribuir, pausar e devolver ao bot.
- [x] F3.05 Cancelar jobs pendentes na tomada humana.
- [x] F3.06 Exibir falha/entrega/leitura da mensagem.
- [x] F3.07 Criar ação segura de reenviar falha.
- [x] F3.08 Registrar nota interna sem enviá-la ao hóspede.
- [x] F3.09 Medir tempo de primeira resposta e fila sem atendimento.

### Testes/gate

- Corrida bot versus humano permite apenas um envio.
- Reconexão não duplica mensagens.
- Usuário sem papel correto não acessa conversa nem ações administrativas.
- Inbox com volume representativo permanece responsiva.

## Fase 4 — IA supervisionada

### Regras de negócio

- IA interpreta e redige; regras determinísticas autorizam ferramentas e envios.
- Resposta automática somente em intent allowlisted, risco baixo e confiança acima do limiar.
- Preço/disponibilidade sempre vêm do serviço do Mapa.
- IA nunca confirma pagamento/reserva, inventa política ou cria desconto.
- Pedido de humano, reclamação, cancelamento, reembolso, emergência e baixa confiança geram handoff.
- Duas falhas de compreensão consecutivas geram handoff.

### TODOs

- [x] F4.01 Criar dataset anonimizado de intenções reais.
- [x] F4.02 Definir schema estrito e versionado de `AiDecision`.
- [x] F4.03 Versionar prompt, modelo, FAQ e policy nos eventos de decisão.
- [x] F4.04 Implementar classificador com timeout limitado e fallback determinístico.
- [x] F4.05 Implementar extração de datas e hóspedes com validação determinística.
- [x] F4.05a Comparar diárias declaradas com o intervalo e solicitar correção do check-out.
- [x] F4.05b Exigir e validar as idades de todas as crianças antes da cotação.
- [x] F4.06 Criar allowlist de ferramentas e schemas de entrada/saída.
- [x] F4.07 Implementar busca somente em FAQ pública e aprovada, com fonte, versão e responsável.
  - [x] Priorizar gatilhos específicos e revisar respostas de estacionamento, horários e senha do Wi-Fi.
  - [x] Encaminhar dúvidas não confirmadas sobre roupa de cama e tamanho da cama para a equipe.
  - [x] Encaminhar dúvidas sobre janelas conforme a acomodação disponível.
  - [x] Responder múltiplas FAQs na mesma mensagem e informar a voltagem por acomodação.
  - [x] Confirmar senha pública do Wi-Fi e regra definitiva de janelas.
  - [x] Priorizar respostas aprovadas antes do fallback e do handoff.
  - [x] Limitar rajadas a uma resposta automática por conversa.
- [x] F4.08 Implementar regras de handoff e mensagem de transição.
- [x] F4.09 Persistir decisão, confiança, latência, tokens e resultado.
- [x] F4.10 Criar shadow mode sem envio ao cliente.
- [x] F4.11 Criar painel/amostra para revisar decisões.
- [x] F4.12 Liberar automaticamente uma intent por vez.

### Testes/gate

- Avaliação offline por intent, entidades, handoff e alucinação.
- Casos adversariais: prompt injection, PII, pedido de desconto, política inexistente e datas ambíguas.
- Nenhum teste depende de chamada real ao modelo; homologação real é suíte separada.
- Meta inicial: precisão acordada para intents liberadas e 100% de handoff nos casos críticos do dataset.

### Segurança e rapidez

- Minimizar e mascarar PII antes do modelo.
- Timeout curto, limite de tokens e teto de custo por conversa.
- Resposta inicial rápida pode confirmar recebimento; nunca inventar enquanto uma ferramenta demora.

## Fase 5 — Kanban automático e reserva

### Regras de negócio

- Estágios mudam por eventos comprovados e transições válidas.
- IA pode sugerir estágio, mas a máquina de estados decide.
- `BookingConfirmed` e pagamento vêm do motor/gateway.
- Cada card ativo pertence a uma oportunidade clara; duplicatas são impedidas.
- Transição manual exige ator e motivo.

### TODOs

- [x] F5.01 Unificar `lossReason`/`lostReason` por migration aditiva.
- [x] F5.02 Normalizar default para `NOVO_LEAD`.
- [x] F5.03 Definir vínculo Booking ↔ Contact ↔ Conversation ↔ PipelineCard.
- [x] F5.04 Testar matriz completa de transições permitidas/negadas.
- [x] F5.05 Emitir eventos de orçamento, início de reserva, pagamento e confirmação.
- [x] F5.06 Tornar handlers idempotentes por `eventId`.
- [x] F5.07 Cancelar follow-ups comerciais em resposta/reserva.
- [x] F5.08 Criar reconciliação periódica entre Booking e Kanban.
- [x] F5.09 Exibir motivo, ator e horário no histórico.

### Testes/gate

- Eventos fora de ordem convergem ao estado correto.
- Reprocessamento não duplica histórico nem card.
- Reserva confirmada nunca permanece em lead perdido/pagamento pendente.
- Teste concorrente cobre confirmação durante follow-up.

## Fase 6 — Follow-ups confiáveis

### Regras de negócio

- Cadência inicial configurável: 2h, 24h e 72h.
- Resposta, reserva, opt-out ou ação humana cancelam envios incompatíveis.
- Quiet hours usam `America/Sao_Paulo`.
- Cada etapa envia no máximo uma vez por jornada.
- Fora da janela permitida pelo WhatsApp, somente template aprovado.
- Oferta expirada deve ser recalculada no Mapa antes de ser citada.

### TODOs

- [x] F6.01 Adicionar `scheduledAt`, `dedupeKey`, `journeyType` e cancelamento à fila.
- [x] F6.02 Criar scheduler que reivindica jobs atomicamente.
- [x] F6.03 Implementar cadência configurável.
- [x] F6.04 Implementar cancelamento por resposta, reserva, opt-out e humano.
- [x] F6.05 Implementar quiet hours e reagendamento.
- [x] F6.06 Aplicar as restrições do provedor ativo; validar janela/template somente se Meta for reativada.
- [x] F6.07 Revalidar cotação no serviço do Mapa.
- [x] F6.08 Criar limite por contato e limite global.
- [x] F6.09 Criar métricas de envio, resposta, conversão e cancelamento.
- [x] F6.10 Criar tela simples de jobs pendentes/falhos.

### Testes/gate

- Usar relógio falso para 2h/24h/72h e quiet hours.
- Scheduler concorrente não envia duas vezes.
- Resposta recebida no limite temporal vence o envio pendente.
- Opt-out bloqueia imediatamente todos os jobs futuros.

## Fase 7 — Pós-venda, avaliação e cupom 10%

### Regras de negócio

- Somente `CheckoutConfirmed` do Booking inicia pós-venda.
- Uma hospedagem gera uma única jornada.
- Reclamação/sentimento negativo abre atendimento e pausa avaliação pública.
- Desconto é benefício de retorno, nunca pagamento por avaliação positiva.
- Cupom: 10%, individual, uso único, não cumulativo, direto, vinculado ao hóspede e com validade configurável.
- O site e o CRM usam o mesmo motor de validação de cupons.

### TODOs

- [x] F7.01 Emitir `CheckoutConfirmed` idempotente.
- [x] F7.02 Mover card para `POS_VENDA`.
- [x] F7.03 Agendar agradecimento/satisfação após 3h.
- [x] F7.04 Classificar resposta positiva, neutra ou problema com regra de fallback humano.
- [x] F7.05 Configurar URL oficial de avaliação.
- [x] F7.06 Agendar pedido de avaliação após 24h quando elegível.
- [x] F7.07 Criar `CouponGrant` ligado a contato, booking e cupom.
- [x] F7.08 Gerar cupom 10% com uso único e vínculo antifraude.
- [x] F7.09 Criar link do site com cupom pré-aplicado.
- [x] F7.10 Enviar código/link pelo provedor ativo com o mecanismo aprovado aplicável.
- [x] F7.11 Registrar emissão, envio, clique e resgate.
- [x] F7.12 Impedir segunda emissão para a mesma hospedagem.
- [x] F7.13 Revisar texto conforme política da plataforma de avaliação.

### Testes/gate

- Checkout duplicado gera um cupom/jornada.
- Reclamação impede pedido automático de avaliação.
- Cupom errado, vencido, reutilizado, cumulativo ou de outro hóspede é recusado.
- Reserva direta válida recebe exatamente 10% conforme limites configurados.

## Fase 8 — Piloto, carga e produção

### Regras de negócio

- Começar em shadow mode, depois supervisionado e só então automático.
- Ativar por intent e percentual, com kill switch imediato.
- Falha do bot nunca bloqueia atendimento humano ou reserva pelo site.
- Deploy e migration devem ser reversíveis.

### TODOs

- [x] F8.01 Criar dashboard de saúde, latência, erro, custo e conversão.
- [x] F8.02 Criar alertas de webhook, fila, Evolution, IA, Mapa e dead-letter.
- [x] F8.03 Executar carga no webhook, Inbox, cotação e scheduler.
- [x] F8.04 Executar testes de segurança e abuso.
- [ ] F8.05 Executar shadow mode e revisar amostra diária.
  - [x] Permitir Gemini como provider alternativo e validar uma chamada real em shadow.
  - [ ] Coletar e revisar a amostra persistida do piloto.
    - [x] Permitir aprovação ou rejeição auditável de cada decisão shadow no painel.
    - [x] Impor o schema de decisão no structured output do Gemini.
    - [x] Exigir amostra humana e aprovação mínima antes de expandir o rollout.
    - [x] Excluir fallbacks heurísticos da amostra válida do Gemini.
    - [x] Exibir fila central de sugestões supervisionadas pendentes.
    - [x] Vincular revisões humanas somente à amostra válida das últimas 24 horas.
    - [x] Priorizar decisões válidas e pendentes na tela de revisão das últimas 24 horas.
    - [x] Impedir que FAQs aprovadas contornem a liberação gradual por intenção.
    - [x] Revalidar o gate operacional durante o rollout e voltar a bloquear quando a evidência expirar.
    - [x] Exigir evidência específica da intenção antes de autorizar sua resposta automática.
    - [x] Exibir no painel o gate e as pendências de cada intenção separadamente.
    - [x] Impedir que revisões supervisionadas de uma intenção validem outra intenção.
    - [x] Permitir filtrar rapidamente decisões pendentes e amostras válidas de FAQ no painel.
    - [x] Resumir amostra, revisões e aprovação humana por intenção nas últimas 24 horas.
- [x] F8.06 Ativar modo supervisionado para equipe piloto.
- [ ] F8.07 Ativar FAQ segura em pequeno percentual.
  - [x] Exibir quantas conversas abertas seriam elegíveis antes de aumentar o percentual.
- [ ] F8.08 Expandir uma intent por vez conforme métricas.
- [x] F8.09 Ensaiar kill switch, rollback e replay de fila.
- [x] F8.10 Criar runbook de incidentes e responsável de plantão.
- [x] F8.11 Preservar Meta isolada e inativa; não remover seus arquivos nem variáveis.

### Testes/gate

- Carga não causa duplicação, perda ou mistura entre contatos.
- Falhas injetadas demonstram retry, circuit breaker, dead-letter e recuperação.
- Zero incidente crítico no período piloto acordado.
- Métricas mínimas e aprovação humana antes de aumentar o rollout.

## Ordem obrigatória

```text
F0 → F1 → F2 → F3 → F4 → F5 → F6 → F7 → F8
```

Fases podem ter pesquisa em paralelo, mas nenhuma automação dependente entra em produção antes dos gates anteriores. Segurança, testes e desempenho não são fases finais: são critérios de conclusão em todas as fases.
