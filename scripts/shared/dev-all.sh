#!/bin/bash

# Script mestre para subir todo o ambiente de desenvolvimento:
# - n8n + ngrok + docker (via start-tunnel.sh)
# - CRM Dashboard (Vite)
# - Motor de Reservas (Next.js)

# Cores para o terminal
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🌕 Iniciando o ecossistema completo da Delplata...${NC}"

# 1. Executar a automação do n8n e ngrok
# Isso atualiza os .env e garante que o n8n está acessível externamente
echo -e "${GREEN}1/4 Configurando n8n e Túnel ngrok...${NC}"
bash ../n8n/start-tunnel.sh

# 2. Iniciar a infraestrutura do CRM (Evolution API, Postgres, Redis)
echo -e "${GREEN}2/3 Subindo Docker do CRM (Evolution API)...${NC}"
(cd ../CRM/infra && docker rm -f evolution_api evolution_postgres evolution_redis 2>/dev/null && docker-compose up -d)

# Função para limpar processos ao sair
cleanup() {
    echo -e "\n${BLUE}🛑 Encerrando todos os serviços...${NC}"
    exit
}

# Capturar Ctrl+C
trap cleanup SIGINT SIGTERM

# 3. Iniciar o projeto principal (Motor de Reservas + CRM Integrado)
# Este comando manterá o terminal aberto
echo -e "${GREEN}3/3 Iniciando Motor de Reservas & CRM Integrado (Porta 3001)...${NC}"
npm run dev

# Caso o npm run dev termine, limpa o resto
cleanup
