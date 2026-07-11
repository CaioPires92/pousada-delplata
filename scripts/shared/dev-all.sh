#!/bin/bash

# Script mestre para subir o ambiente local atual:
# - infraestrutura do CRM
# - aplicação principal

# Cores para o terminal
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🌕 Iniciando o ecossistema completo da Delplata...${NC}"

# 1. Iniciar a infraestrutura do CRM (Evolution API, Postgres, Redis)
echo -e "${GREEN}1/2 Subindo Docker do CRM (Evolution API)...${NC}"
bash ./scripts/crm/ops/docker-up.sh

# Função para limpar processos ao sair
cleanup() {
    echo -e "\n${BLUE}🛑 Encerrando todos os serviços...${NC}"
    exit
}

# Capturar Ctrl+C
trap cleanup SIGINT SIGTERM

# 2. Iniciar o projeto principal (Motor de Reservas + CRM Integrado)
# Este comando manterá o terminal aberto
echo -e "${GREEN}2/2 Iniciando Motor de Reservas & CRM Integrado (Porta 3001)...${NC}"
npm run dev

# Caso o npm run dev termine, limpa o resto
cleanup
