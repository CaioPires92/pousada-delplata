# Roadmap e Implementações Futuras

Este documento lista melhorias identificadas, débitos técnicos aceitáveis e funcionalidades sugeridas para evoluir o painel administrativo e a segurança do sistema pós-deploy.

## 🚨 Curto Prazo (Pós-Deploy Imediato)

Estas são ações recomendadas logo após o sistema estar estável em produção.

- [ ] **Rotação de Secrets:** Estabelecer um processo para rotacionar `ADMIN_JWT_SECRET` periodicamente.
- [ ] **Monitoramento de Logs:** Verificar logs da Vercel/Sentry para garantir que tentativas de login falhas não estão gerando ruído excessivo.
- [ ] **Backup:** Configurar backup automático do banco de dados Turso (se não houver plano de retenção ativo).

## 🛡️ Segurança e Infraestrutura

Melhorias para endurecer a segurança além do básico atual.

- [ ] **Rate Limit com Redis (Upstash):**
    - *Problema:* O rate limit atual é em memória (instável em Serverless).
    - *Solução:* Migrar para `@upstash/ratelimit` para persistência global de tentativas de login.
- [ ] **MFA (Autenticação de Dois Fatores):**
    - *Motivo:* Proteger contra vazamento de senha.
    - *Sugestão:* Implementar TOTP (Google Authenticator) ou envio de código por email.
- [ ] **Invalidação de Sessão (Logout Real):**
    - *Problema:* Tokens JWT são stateless; logout apenas remove cookie do navegador.
    - *Solução:* Criar tabela `AdminSession` ou blacklist no Redis para invalidar tokens antes da expiração.
- [ ] **Auditoria (Audit Logs):**
    - *Funcionalidade:* Registrar quem fez o quê (ex: "Admin X alterou preço do quarto Y em [data]").
    - *Implementação:* Tabela `AuditLog` no banco.

## 🎨 UX e Funcionalidades (Painel Admin)

Melhorias na experiência do administrador.

- [ ] **Recuperação de Senha:**
    - Atualmente, reset de senha requer acesso direto ao banco. Implementar fluxo de "Esqueci minha senha" via email.
- [ ] **Gerenciamento de Admins:**
    - Interface para criar/remover outros administradores (atualmente só via banco/seed).
- [ ] **Dashboard de Métricas:**
    - Gráficos de ocupação, receita mensal e previsões.

## 🧹 Débito Técnico Aceitável

Coisas que funcionam hoje mas podem ser melhoradas.

- [ ] **Refatoração de Tipos:** Unificar tipos de `AdminUser` entre front e back.
- [ ] **Testes E2E:** Adicionar testes com Playwright para fluxo completo de login e gestão de reservas.

---
*Gerado em: 30/01/2026*