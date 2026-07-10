#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
PID_FILE="$ROOT_DIR/scratch/evolution-bridge.pid"
LOG_FILE="$ROOT_DIR/scratch/evolution-bridge.log"

api_url="${EVOLUTION_API_URL:-http://localhost:8080}"
bridge_url="${api_url%/}"
bridge_port="${bridge_url##*:}"
windows_target_url="${WINDOWS_EVOLUTION_API_URL:-http://localhost:${bridge_port}}"

if curl -fsS --connect-timeout 2 "$bridge_url/" >/dev/null 2>&1; then
  echo "Evolution ja acessivel em $bridge_url; bridge desnecessario."
  exit 0
fi

if [[ -f "$PID_FILE" ]]; then
  existing_pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -n "${existing_pid}" ]] && kill -0 "$existing_pid" 2>/dev/null; then
    if curl -fsS --connect-timeout 2 "$bridge_url/" >/dev/null 2>&1; then
      echo "Bridge da Evolution ja esta ativo em $bridge_url."
      exit 0
    fi
  fi
  rm -f "$PID_FILE"
fi

if [[ ! -e /mnt/c/Windows/System32/cmd.exe ]]; then
  echo "cmd.exe nao encontrado; nao foi possivel iniciar bridge WSL -> Windows."
  exit 1
fi

if ! (cd /mnt/c && /mnt/c/Windows/System32/cmd.exe /c curl -fsS "$windows_target_url/" >/dev/null 2>&1); then
  echo "Evolution nao respondeu no Windows em $windows_target_url; bridge nao iniciado."
  exit 1
fi

mkdir -p "$ROOT_DIR/scratch"
nohup env \
  EVOLUTION_BRIDGE_PORT="$bridge_port" \
  WINDOWS_EVOLUTION_API_URL="$windows_target_url" \
  node "$ROOT_DIR/scripts/crm/bridge/evolution-wsl-bridge.mjs" \
  >"$LOG_FILE" 2>&1 &

bridge_pid=$!
echo "$bridge_pid" >"$PID_FILE"
sleep 1

if ! kill -0 "$bridge_pid" 2>/dev/null; then
  echo "Bridge da Evolution falhou ao iniciar. Veja $LOG_FILE"
  exit 1
fi

if ! curl -fsS --connect-timeout 5 "$bridge_url/" >/dev/null 2>&1; then
  echo "Bridge iniciou, mas nao respondeu em $bridge_url. Veja $LOG_FILE"
  exit 1
fi

echo "Bridge da Evolution ativo em $bridge_url -> $windows_target_url"
