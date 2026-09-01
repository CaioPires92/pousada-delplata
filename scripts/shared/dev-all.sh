#!/bin/bash

# Inicia somente o Motor de Reservas local.
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"
exec npm run dev:web
