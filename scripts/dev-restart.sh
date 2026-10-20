#!/usr/bin/env bash
# Relance proprement la pile de développement (API 3100 + web 5273) : tue les survivants, relance en arrière-plan.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "$ROOT/.devstack"
pkill -f "nest start --watch" 2>/dev/null || true
pkill -f "vite --port 5273" 2>/dev/null || true
pkill -f "apps/api/dist/main" 2>/dev/null || true
sleep 1
cd "$ROOT"
nohup pnpm dev > .devstack/dev.log 2>&1 < /dev/null &
disown
echo "Pile relancée : http://localhost:5273 (journal : .devstack/dev.log)"
