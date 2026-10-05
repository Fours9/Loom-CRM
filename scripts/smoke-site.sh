#!/usr/bin/env bash
# Semantic site smoke for LoomCRM.
#   ./scripts/smoke-site.sh --bind localhost   # acceptance (127.0.0.1:8080)
#   ./scripts/smoke-site.sh --bind public      # go_live (https://127.0.0.1)
#
# Login uses CUTOVER_SMOKE_EMAIL / CUTOVER_SMOKE_PASSWORD (not SEED_ADMIN_*).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib/compose-cli.sh
source "$ROOT/scripts/lib/compose-cli.sh"

BIND="localhost"
BASE_URL=""
ENV_FILE="${LOOM_ENV_FILE:-$ROOT/.env.production}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --bind) BIND="$2"; shift 2 ;;
    --base-url) BASE_URL="$2"; shift 2 ;;
    --env-file) ENV_FILE="$2"; LOOM_ENV_FILE="$2"; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "$BASE_URL" ]]; then
  case "$BIND" in
    localhost) BASE_URL="http://127.0.0.1:8080" ;;
    public) BASE_URL="https://127.0.0.1" ;;
    *) echo "Unknown --bind $BIND (localhost|public)" >&2; exit 2 ;;
  esac
fi

CURL_INSECURE=()
if [[ "$BASE_URL" == https://* ]]; then
  CURL_INSECURE=(-k)
fi

log() { echo "[smoke-site] $*"; }

load_smoke_creds() {
  if [[ -f "$ENV_FILE" ]]; then
    set -a
    while IFS= read -r line || [[ -n "$line" ]]; do
      [[ "$line" =~ ^[[:space:]]*# ]] && continue
      [[ "$line" =~ ^CUTOVER_SMOKE_ ]] || continue
      export "$line"
    done < "$ENV_FILE"
    set +a
  fi
  if [[ -z "${CUTOVER_SMOKE_EMAIL:-}" || -z "${CUTOVER_SMOKE_PASSWORD:-}" ]]; then
    echo "ERROR: CUTOVER_SMOKE_EMAIL / CUTOVER_SMOKE_PASSWORD required (not SEED_ADMIN_*)" >&2
    exit 1
  fi
}

assert_json_health() {
  local path="$1" body
  body="$(curl -fsS "${CURL_INSECURE[@]}" "$BASE_URL$path")"
  echo "$body" | grep -q '"status":"ok"' || echo "$body" | grep -q '"status": "ok"' || {
    echo "ERROR: health $path not ok: $body" >&2
    exit 1
  }
  log "OK $path → $body"
}

assert_spa() {
  local html
  html="$(curl -fsS "${CURL_INSECURE[@]}" "$BASE_URL/")"
  echo "$html" | grep -Eqi '<app-root|ng-version|loom' || {
    echo "ERROR: SPA marker not found at $BASE_URL/" >&2
    exit 1
  }
  log "OK SPA shell"
}

assert_login() {
  local resp code
  resp="$(mktemp)"
  code="$(curl -sS "${CURL_INSECURE[@]}" -o "$resp" -w '%{http_code}' \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"${CUTOVER_SMOKE_EMAIL}\",\"password\":\"${CUTOVER_SMOKE_PASSWORD}\"}" \
    "$BASE_URL/api/v1/auth/login")"
  if [[ "$code" != "200" && "$code" != "201" ]]; then
    echo "ERROR: login failed HTTP $code (credentials not logged)" >&2
    rm -f "$resp"
    exit 1
  fi
  if ! grep -Eqi 'accessToken|"token"|access_token' "$resp"; then
    echo "ERROR: login response missing token field" >&2
    rm -f "$resp"
    exit 1
  fi
  rm -f "$resp"
  log "OK login smoke"
}

main() {
  log "bind=$BIND base=$BASE_URL"
  load_smoke_creds
  assert_json_health "/api/v1/health/live"
  assert_json_health "/api/v1/health/ready"
  assert_spa
  assert_login
  log "all checks passed"
}

main
