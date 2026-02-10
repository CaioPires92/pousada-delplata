# Configuração do CI/CD com GitHub Actions e Vercel

## Passos para configurar o CI/CD:

### 1. Configurar Secrets no GitHub
Vá para Settings → Secrets and variables → Actions no seu repositório GitHub e adicione:

- **VERCEL_TOKEN**: `<SEU_VERCEL_TOKEN>`
- **ORG_ID**: (você precisa obter do seu dashboard Vercel)
- **PROJECT_ID**: (você precisa obter do seu dashboard Vercel)

### 2. Obter ORG_ID e PROJECT_ID
1. Acesse https://vercel.com/dashboard
2. Clique no seu projeto
3. Vá em Settings → General
4. Copie o Project ID e Org ID

### 3. Comandos úteis para deploy manual
```bash
# Instalar Vercel CLI
npm i -g vercel

# Login com o token
vercel login --token <SEU_VERCEL_TOKEN>

# Deploy manual (se necessário)
cd web
vercel --prod
```

### 4. Estrutura do projeto
O workflow está configurado para:
- Rodar em pushes para main/master
- Instalar dependências na pasta `./web`
- Fazer build do Next.js
- Deploy automático para Vercel

### 5. Monitoramento
Após configurar os secrets, qualquer push para a branch main irá:
1. Trigger o workflow do GitHub Actions
2. Fazer build e testes
3. Deploy automático na Vercel
4. Você pode acompanhar em: Actions tab do GitHub
