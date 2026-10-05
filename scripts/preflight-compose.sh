#!/usr/bin/env bash
# Local / CI preflight for site cutover prerequisites (no destructive DB ops).
# Checks: Compose >= 2.24.4, migrate/api DATABASE_URL identity, overlays, builds.
#
# Usage:
#   ./scripts/preflight-compose.sh
#   ./scripts/preflight-compose.sh --env-file .env.production
#   ./scripts/preflight-compose.sh --build
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=lib/compose-cli.sh
source "$ROOT/scripts/lib/compose-cli.sh"

LOOM_ENV_FILE="${LOOM_ENV_FILE:-$ROOT/.env.production}"
DO_BUILD=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file) LOOM_ENV_FILE="$2"; shift 2 ;;
    --build) DO_BUILD=1; shift ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

export LOOM_ENV_FILE

log() { echo "[preflight] $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

require_compose_version

# Prefer example if real env missing (local dry check with placeholders will fail secret asserts)
if [[ ! -f "$LOOM_ENV_FILE" ]]; then
  if [[ -f "$ROOT/.env.production.example" ]]; then
    log "WARN: $LOOM_ENV_FILE missing — validating compose merge with example (secret asserts may fail)"
    LOOM_ENV_FILE="$ROOT/.env.production.example"
    export LOOM_ENV_FILE
  else
    die "no env file"
  fi
fi

extract_svc_env() {
  local fileset="$1" svc="$2" key="$3"
  loom_compose "$fileset" config 2>/dev/null | awk -v svc="$svc" -v key="$key" '
    $0 ~ "^  "svc":" {s=1; next}
    s && $0 ~ /^  [a-z]/ {s=0}
    s && $0 ~ ("^[[:space:]]*" key ":") {
      sub(/^[^:]*:[[:space:]]*/, "");
      gsub(/"/, "");
      print;
      exit
    }
  '
}

log "assert migrate/api DATABASE_URL identical (production fileset)"
mig="$(extract_svc_env production migrate DATABASE_URL)"
api="$(extract_svc_env production api DATABASE_URL)"
[[ -n "$mig" && -n "$api" ]] || die "could not resolve DATABASE_URL"
[[ "$mig" == "$api" ]] || die "migrate DATABASE_URL != api DATABASE_URL ($mig vs $api)"
log "DATABASE_URL match OK"

log "assert acceptance web bind"
acc="$(loom_compose acceptance config 2>/dev/null || true)"
if ! echo "$acc" | grep -q '127.0.0.1:8080:80' \
  && ! echo "$acc" | grep -qE 'host_ip:[[:space:]]*127\.0\.0\.1'; then
  die "acceptance missing 127.0.0.1 bind"
fi
log "acceptance overlay OK"

log "assert production web :80"
prod="$(loom_compose production config 2>/dev/null || true)"
echo "$prod" | grep -Eq '80:80|published: 80' || die "production missing web :80"
log "production overlay OK"

log "assert nginx client_max_body_size"
grep -q 'client_max_body_size 12m' "$ROOT/docker/nginx.conf" || die "nginx body size"

log "assert backups/ gitignored"
grep -qE '^backups/' "$ROOT/.gitignore" || die "backups/ not in .gitignore"

log "assert cutover Dockerfile exists"
[[ -f "$ROOT/docker/cutover.Dockerfile" ]] || die "missing cutover Dockerfile"

if [[ "$DO_BUILD" == "1" ]]; then
  log "building api web cutover"
  loom_compose production build api web
  loom_compose production --profile cutover build cutover
fi

log "preflight passed"
