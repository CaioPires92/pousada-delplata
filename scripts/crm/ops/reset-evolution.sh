#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/evolution-docker/docker-compose.yml"
ENV_FILE="$ROOT_DIR/.env"
BRIDGE_PID_FILE="$ROOT_DIR/scratch/evolution-bridge.pid"
BRIDGE_LOG_FILE="$ROOT_DIR/scratch/evolution-bridge.log"

PORTS=(8080 5432 6379 5678)
EVOLUTION_DIRS=(
  "$ROOT_DIR/evolution-api/instances"
  "$ROOT_DIR/evolution-api/store"
  "$HOME/.evolution-api"
  "$HOME/.local/share/evolution-api"
)

echo "Resetando stack local do CRM/Evolution..."

docker_compose_down() {
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" down -v --remove-orphans || true
    return
  fi

  if [[ -e /mnt/c/Windows/System32/cmd.exe ]] && command -v wslpath >/dev/null 2>&1; then
    local compose_win env_win
    compose_win="$(wslpath -w "$COMPOSE_FILE")"
    env_win="$(wslpath -w "$ENV_FILE")"
    /mnt/c/Windows/System32/cmd.exe /c docker compose --env-file "$env_win" -f "$compose_win" down -v --remove-orphans || true
  fi
}

if command -v docker >/dev/null 2>&1; then
  echo
  echo "1. Derrubando containers/volumes do compose, se o Docker estiver disponivel..."
  docker_compose_down
elif [[ -e /mnt/c/Windows/System32/cmd.exe ]]; then
  echo
  echo "1. Derrubando containers/volumes do compose via Docker Desktop do Windows..."
  docker_compose_down
fi

echo
echo "2. Encerrando processos que ocupam as portas do CRM..."
for port in "${PORTS[@]}"; do
  pids="$(fuser "${port}/tcp" 2>/dev/null || true)"
  if [[ -n "${pids}" ]]; then
    echo "Porta ${port}: encerrando PIDs ${pids}"
    kill -TERM ${pids} 2>/dev/null || true
    sleep 1
    remaining="$(fuser "${port}/tcp" 2>/dev/null || true)"
    if [[ -n "${remaining}" ]]; then
      echo "Porta ${port}: forcando PIDs ${remaining}"
      kill -KILL ${remaining} 2>/dev/null || true
    fi
  else
    echo "Porta ${port}: livre"
  fi
done

echo
echo "3. Encerrando bridge local da Evolution, se existir..."
if [[ -f "$BRIDGE_PID_FILE" ]]; then
  bridge_pid="$(cat "$BRIDGE_PID_FILE" 2>/dev/null || true)"
  if [[ -n "${bridge_pid}" ]] && kill -0 "$bridge_pid" 2>/dev/null; then
    kill "$bridge_pid" 2>/dev/null || true
  fi
  rm -f "$BRIDGE_PID_FILE"
fi

echo
echo "4. Limpando artefatos locais conhecidos do Evolution..."
for dir in "${EVOLUTION_DIRS[@]}"; do
  if [[ -e "$dir" ]]; then
    rm -rf "$dir"
    echo "Removido: $dir"
  fi
done

echo
echo "5. Removendo arquivos temporarios..."
rm -f "$ROOT_DIR/scratch/qrcode.html" "$ROOT_DIR/qr2.txt" "$ROOT_DIR/qr-success.txt" "$BRIDGE_LOG_FILE"

echo
echo "Reset concluido."
echo "Proximo passo:"
echo "  1) Garanta que o Docker Desktop esteja aberto e a integracao WSL ativa"
echo "  2) Rode: npm run crm:docker:up"
echo "  3) Rode: npm run crm:evolution:create"
echo "  4) Rode: npm run crm:evolution:qr"
echo "  5) Rode: npm run crm:evolution:webhook"
