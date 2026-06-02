#!/usr/bin/env bash
set -euo pipefail

required=(
  EVOLUTION_API_URL
  EVOLUTION_API_KEY
  EVOLUTION_INSTANCE_NAME
  CRM_INTERNAL_API_TOKEN
)

missing=0
for key in "${required[@]}"; do
  value="${!key:-}"
  if [[ -z "$value" ]]; then
    echo "[MISSING] $key"
    missing=1
    continue
  fi

  if [[ "$value" == "changeme" || "$value" == "test" || "$value" == "example" ]]; then
    echo "[WEAK] $key uses placeholder value"
    missing=1
  else
    echo "[OK] $key"
  fi
done

if [[ $missing -ne 0 ]]; then
  echo "Secret check failed"
  exit 1
fi

echo "Secret check passed"
