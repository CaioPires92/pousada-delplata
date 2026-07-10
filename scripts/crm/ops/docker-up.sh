#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/evolution-docker/docker-compose.yml"
ENV_FILE="$ROOT_DIR/.env"
BRIDGE_SCRIPT="$ROOT_DIR/scripts/crm/ops/start-evolution-bridge.sh"

docker_compose_up() {
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d
    return
  fi

  if [[ -e /mnt/c/Windows/System32/cmd.exe ]] && command -v wslpath >/dev/null 2>&1; then
    local compose_win env_win
    compose_win="$(wslpath -w "$COMPOSE_FILE")"
    env_win="$(wslpath -w "$ENV_FILE")"
    /mnt/c/Windows/System32/cmd.exe /c docker compose --env-file "$env_win" -f "$compose_win" up -d
    return
  fi

  echo "Docker daemon nao esta acessivel nem via WSL nem via Docker Desktop do Windows."
  exit 1
}

if ! command -v docker >/dev/null 2>&1; then
  if [[ ! -e /mnt/c/Windows/System32/cmd.exe ]]; then
    echo "Docker nao esta instalado ou nao esta no PATH."
    exit 1
  fi
fi

docker_compose_up

if [[ -x "$BRIDGE_SCRIPT" ]]; then
  bash "$BRIDGE_SCRIPT"
else
  echo "Script de bridge nao encontrado/executavel: $BRIDGE_SCRIPT"
  exit 1
fi
