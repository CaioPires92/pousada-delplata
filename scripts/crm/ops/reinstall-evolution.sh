#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT_DIR"

bash ./scripts/crm/ops/reset-evolution.sh
bash ./scripts/crm/ops/docker-up.sh
node --env-file=.env ./scripts/crm/integration/evolution-client.mjs create-instance
node --env-file=.env ./scripts/crm/integration/evolution-client.mjs wait-for-qr
node --env-file=.env ./scripts/crm/integration/evolution-client.mjs setup-webhook

echo
echo "Reinstalacao concluida."
echo "Se o QR foi salvo, abra: scratch/qrcode.html"
