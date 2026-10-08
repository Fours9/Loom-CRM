#!/usr/bin/env bash
# Daily VPS deploy for LoomCRM (no DB restore).
#
# Contract:
#   git pull → build → migrate-run.sh → up -d --no-deps api → up -d --no-deps web → smoke
#
# Migration compatibility invariant:
#   Daily deploy migrations MUST be backward-compatible with the currently running API.
#   For breaking/destructive migrations: stop api writers first (maintenance), then migrate.
#   This script stops api before migrate by default when LOOM_STOP_API_BEFORE_MIGRATE=1,
#   or always uses explicit migrate + --no-deps (never double-migrate via depends_on).
#
# Usage (on VPS, repo root):
#   ./scripts/deploy-vps.sh
#   LOOM_STOP_API_BEFORE_MIGRATE=1 ./scripts/deploy-vps.sh   # recommended for unknown migrations
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=lib/compose-cli.sh
source "$ROOT/scripts/lib/compose-cli.sh"

LOOM_ENV_FILE="${LOOM_ENV_FILE:-.env.production}"
FILESET="${FILESET:-production}"
STOP_API="${LOOM_STOP_API_BEFORE_MIGRATE:-0}"

if [[ ! -f "$LOOM_ENV_FILE" ]]; then
  echo "Missing $LOOM_ENV_FILE" >&2
  exit 1
fi

log() { echo "[deploy-vps] $*"; }

require_compose_version

# Default branch in this repo is master (origin/HEAD → master).
BRANCH="${LOOM_DEPLOY_BRANCH:-master}"
log "git fetch/pull origin ${BRANCH}"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

log "build images (api web)"
loom_compose "$FILESET" build api web

if [[ "$STOP_API" == "1" ]]; then
  log "stopping api before migrate (breaking-migration / maintenance mode)"
  loom_compose "$FILESET" stop api || true
fi

log "explicit migrate (single entry)"
"$ROOT/scripts/migrate-run.sh" --fileset "$FILESET"

log "up api --no-deps (avoids hidden second migrate via depends_on)"
loom_compose "$FILESET" up -d --no-deps api

log "wait api healthy"
i=0
until loom_compose "$FILESET" exec -T api \
  node -e 'fetch("http://127.0.0.1:3000/api/v1/health/ready").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))' \
  >/dev/null 2>&1; do
  i=$((i + 1))
  if (( i > 90 )); then
    echo "ERROR: api not ready" >&2
    exit 1
  fi
  sleep 2
done

log "up web --no-deps"
loom_compose "$FILESET" up -d --no-deps web

log "smoke (public :80)"
if [[ -n "${CUTOVER_SMOKE_EMAIL:-}" || -f "$LOOM_ENV_FILE" ]]; then
  "$ROOT/scripts/smoke-site.sh" --bind public --env-file "$LOOM_ENV_FILE" || {
    log "WARN: full smoke failed — trying health-only"
    curl -fsS "http://127.0.0.1/api/v1/health/ready"
    echo
  }
else
  curl -fsSk "https://127.0.0.1/api/v1/health/ready"
  echo
fi

log "Done. Reminder: daily migrations must stay BC with running API unless STOP_API_BEFORE_MIGRATE=1."
