#!/bin/bash
# Script para obter ORG_ID e PROJECT_ID do Vercel

echo "🔍 Buscando IDs do Vercel..."
echo ""

# Verificar se o Vercel CLI está instalado
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI não encontrado!"
    echo "Instalando Vercel CLI..."
    npm install -g vercel
fi

if [ -z "${VERCEL_TOKEN}" ]; then
    echo "❌ VERCEL_TOKEN não encontrado no ambiente."
    echo "Defina a variável e rode novamente:"
    echo "  export VERCEL_TOKEN='<SEU_VERCEL_TOKEN>'"
    exit 1
fi

echo "🔐 Fazendo login com token do ambiente..."
vercel login --token "$VERCEL_TOKEN"

echo ""
echo "📋 ORG_ID e PROJECT_ID disponíveis:"
echo ""

# Listar projetos e organizações
vercel projects list
echo ""

# Obter ORG_ID
ORG_ID=$(vercel whoami --json | jq -r '.id' 2>/dev/null || echo "Não foi possível obter automaticamente")
echo "🏢 ORG_ID: $ORG_ID"

# Se houver um projeto na pasta atual, obter PROJECT_ID
if [ -f "vercel.json" ] || [ -f ".vercel/project.json" ]; then
    PROJECT_ID=$(vercel inspect --json 2>/dev/null | jq -r '.id' || echo "Não foi possível obter automaticamente")
    echo "📁 PROJECT_ID: $PROJECT_ID"
else
    echo "📁 PROJECT_ID: Não foi possível detectar automaticamente"
    echo "Você precisa escolher um projeto do dashboard"
fi

echo ""
echo "✅ Copie esses valores para os secrets do GitHub Actions!"
echo "   VERCEL_TOKEN: <SEU_VERCEL_TOKEN>"
echo "   ORG_ID: $ORG_ID"
echo "   PROJECT_ID: [verifique no dashboard]"
echo ""
echo "📖 Instruções manuais:"
echo "1. Acesse: https://vercel.com/dashboard"
echo "2. Clique no seu projeto"
echo "3. Vá em Settings → General"
echo "4. Copie o Project ID e Org ID"
