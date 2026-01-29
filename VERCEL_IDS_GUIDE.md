# 📋 GUIA COMPLETO: Como obter ORG_ID e PROJECT_ID do Vercel

## Método 1: Dashboard Web (Recomendado)

### Passo a Passo Visual:
1. **Acesse**: https://vercel.com/dashboard
2. **Clique no seu projeto** (ex: "delplata-motor")
3. **Vá em Settings** (menu lateral esquerdo)
4. **Clique em General** (aba superior)
5. **Role até a seção "General Settings"**
6. **Copie os IDs**:
   - **Org ID**: Estará em "Organization ID"
   - **Project ID**: Estará em "Project ID"

### Onde encontrar os IDs no dashboard:
```
┌─────────────────────────────────────┐
│  ⚙️ Settings → General              │
├─────────────────────────────────────┤
│  General Settings                   │
│  ├─ Organization ID: org_abc123   │ ← ORG_ID
│  └─ Project ID: prj_xyz789          │ ← PROJECT_ID
└─────────────────────────────────────┘
```

## Método 2: Vercel CLI (Automático)

### Instalar e executar:
```bash
# Instalar Vercel CLI (se ainda não tiver)
npm install -g vercel

# Executar o script auxiliar
./get-vercel-ids.sh
```

## Método 3: URL do Projeto

### Analisar a URL:
Quando você está no dashboard do seu projeto, a URL mostra os IDs:
```
https://vercel.com/[ORG_ID]/[PROJECT_ID]/settings
```

Exemplo real:
```
https://vercel.com/seu-usuario/delplata-motor/settings
```
- **ORG_ID**: `seu-usuario`
- **PROJECT_ID**: `delplata-motor`

## ⚠️ IMPORTANTE: Configurar no GitHub

### Adicionar os Secrets:
1. **Vá para seu repositório no GitHub**
2. **Clique em Settings** (configurações do repo)
3. **Vá para Secrets and variables → Actions**
4. **Clique em "New repository secret"**
5. **Adicione os 3 secrets**:

```bash
# Secret 1
Name: VERCEL_TOKEN
Value: <SEU_VERCEL_TOKEN>

# Secret 2  
Name: ORG_ID
Value: [cole o Org ID aqui]

# Secret 3
Name: PROJECT_ID  
Value: [cole o Project ID aqui]
```

## 🎯 Verificação Final

Após configurar, você pode testar criando um novo commit:
```bash
git add .
git commit -m "Configura CI/CD com Vercel"
git push origin main
```

O GitHub Actions irá:
1. ✅ Rodar automaticamente
2. ✅ Fazer build do projeto
3. ✅ Deploy para Vercel
4. ✅ Você pode acompanhar em: Actions tab do GitHub

## 📞 Precisa de Ajuda?

Se tiver problemas para encontrar os IDs:
1. Verifique se está logado na conta correta do Vercel
2. Certifique-se de ter acesso ao projeto
3. Os IDs são diferentes do nome do projeto - procure exatamente por "Organization ID" e "Project ID"

## 🚀 Próximos Passos

1. Obtenha os IDs usando um dos métodos acima
2. Configure os 3 secrets no GitHub
3. Faça push das alterações
4. Acompanhe o deploy em: https://github.com/seu-usuario/seu-repo/actions
