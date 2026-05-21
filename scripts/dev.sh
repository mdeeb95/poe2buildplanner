#!/usr/bin/env bash
# Reliable dev server startup — kills stale processes on the port and optionally
# clears a corrupted .next cache before starting.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PORT="${PORT:-3000}"
CLEAN=0

for arg in "$@"; do
  case "$arg" in
    --clean) CLEAN=1 ;;
  esac
done

stop_port() {
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${PORT}/tcp" 2>/dev/null || true
  elif command -v lsof >/dev/null 2>&1; then
    local pids
    pids="$(lsof -ti ":${PORT}" 2>/dev/null || true)"
    if [ -n "$pids" ]; then
      kill $pids 2>/dev/null || true
    fi
  fi
}

stop_port
sleep 0.5

if [ "$CLEAN" = 1 ]; then
  rm -rf .next
elif [ -d .next ]; then
  # Half-written cache from a killed dev server or concurrent `pnpm build`.
  if [ ! -f .next/BUILD_ID ] && [ ! -f .next/routes-manifest.json ]; then
    rm -rf .next
  fi
fi

exec pnpm exec next dev -p "$PORT"
