#!/usr/bin/env bash
# Site cutover orchestrator: ProjectWeekend → LoomCRM on the same VPS.
#
# Phases:
#   preflight → pw_backup → pw_stop → loom_db_bootstrap → loom_start
#   → smoke → acceptance → go_live → done
#
# Bootstrap modes:
#   sourceMode=snapshot (default):
#     recreate → restore full baseline → migrate → verify
#   sourceMode=pw-refresh (--refresh-from-pw=/path/app.sqlite):
#     recreate → migrate → cutover importer --reset → optional dump
#
# Until go_live, web uses acceptance overlay (127.0.0.1:8080 only).
# go_live flips to production :80 and runs a second public smoke.
#
# Usage:
#   ./scripts/site-cutover.sh
#   ./scripts/site-cutover.sh --refresh-from-pw=/root/ProjectWeekend/runtime/data/app.sqlite
#   ./scripts/site-cutover.sh --resume
#   ./scripts/site-cutover.sh --phase go_live
#   ./scripts/site-cutover.sh --force-new-run
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=lib/compose-cli.sh
source "$ROOT/scripts/lib/compose-cli.sh"
# shellcheck source=lib/cutover-state.sh
source "$ROOT/scripts/lib/cutover-state.sh"
# shellcheck source=lib/migration-verify.sh
source "$ROOT/scripts/lib/migration-verify.sh"

LOOM_ENV_FILE="${LOOM_ENV_FILE:-$ROOT/.env.production}"
PW_ROOT="${PW_ROOT:-/root/ProjectWeekend}"
PW_ENV_FILE="${PW_ENV_FILE:-$PW_ROOT/.env.production}"
SOURCE_MODE="snapshot"
PW_SQLITE=""
RESUME=0
FORCE_NEW=0
ONLY_PHASE=""
SNAPSHOT="${SNAPSHOT:-$ROOT/data/app.snapshot.sql}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"

PHASES=(preflight pw_backup pw_stop loom_db_bootstrap loom_start smoke acceptance go_live done)

while [[ $# -gt 0 ]]; do
  case "$1" in
    --refresh-from-pw=*)
      SOURCE_MODE="pw-refresh"
      PW_SQLITE="${1#*=}"
      shift
      ;;
    --refresh-from-pw)
      SOURCE_MODE="pw-refresh"
      PW_SQLITE="$2"
      shift 2
      ;;
    --resume) RESUME=1; shift ;;
    --force-new-run) FORCE_NEW=1; shift ;;
    --phase) ONLY_PHASE="$2"; shift 2 ;;
    --snapshot) SNAPSHOT="$2"; shift 2 ;;
    --env-file) LOOM_ENV_FILE="$2"; shift 2 ;;
    --pw-root) PW_ROOT="$2"; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

export LOOM_ENV_FILE PW_ROOT PW_ENV_FILE BACKUP_DIR
export PW_SQLITE_HOST_PATH="${PW_SQLITE:-${PW_SQLITE_HOST_PATH:-}}"

log() { echo "[site-cutover] $*"; }

die() { echo "ERROR: $*" >&2; exit 1; }

require_env_file() {
  [[ -f "$LOOM_ENV_FILE" ]] || die "missing $LOOM_ENV_FILE"
  set -a
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" =~ ^(POSTGRES_|DATABASE_URL=|JWT_SECRET=|CORS_ORIGIN=|CUTOVER_SMOKE_) ]] || continue
    # shellcheck disable=SC2163
    export "$line"
  done < "$LOOM_ENV_FILE"
  set +a
}

sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

is_phase_complete() {
  cutover_state_has_phase "$1"
}

run_phase() {
  local phase="$1"
  if is_phase_complete "$phase"; then
    log "skip completed phase: $phase"
    return 0
  fi
  log "=== phase: $phase ==="
  "phase_$phase"
  cutover_state_mark_phase "$phase"
}

phase_preflight() {
  require_compose_version
  require_env_file
  [[ -f "$SNAPSHOT" ]] || die "snapshot missing: $SNAPSHOT"

  local mig_url api_url
  mig_url="$(loom_compose production config 2>/dev/null | awk '
    $0 ~ /^  migrate:/ {s=1; next}
    s && $0 ~ /^  [a-z]/ {s=0}
    s && /DATABASE_URL:/ {gsub(/.*DATABASE_URL:[[:space:]]*/,""); gsub(/"/,""); print; exit}
  ')"
  api_url="$(loom_compose production config 2>/dev/null | awk '
    $0 ~ /^  api:/ {s=1; next}
    s && $0 ~ /^  [a-z]/ {s=0}
    s && /DATABASE_URL:/ {gsub(/.*DATABASE_URL:[[:space:]]*/,""); gsub(/"/,""); print; exit}
  ')"
  [[ -n "$mig_url" && -n "$api_url" ]] || die "could not resolve migrate/api DATABASE_URL from compose config"
  [[ "$mig_url" == "$api_url" ]] || die "migrate DATABASE_URL != api DATABASE_URL"

  case "$api_url" in
    *replace-with*|*change-me*) die "DATABASE_URL still looks like a placeholder" ;;
  esac

  local jwt
  jwt="$(loom_compose production config 2>/dev/null | awk '
    $0 ~ /^  api:/ {s=1; next}
    s && $0 ~ /^  [a-z]/ {s=0}
    s && /JWT_SECRET:/ {gsub(/.*JWT_SECRET:[[:space:]]*/,""); gsub(/"/,""); print; exit}
  ')"
  case "$jwt" in
    ''|*change-me*|*replace-with*) die "JWT_SECRET missing or placeholder" ;;
  esac

  [[ -n "${CUTOVER_SMOKE_EMAIL:-}" && -n "${CUTOVER_SMOKE_PASSWORD:-}" ]] \
    || die "CUTOVER_SMOKE_EMAIL/PASSWORD required in $LOOM_ENV_FILE"

  if [[ "$SOURCE_MODE" == "pw-refresh" ]]; then
    [[ -n "$PW_SQLITE" && -f "$PW_SQLITE" ]] || die "pw-refresh requires existing --refresh-from-pw sqlite"
    export PW_SQLITE_HOST_PATH="$PW_SQLITE"
  fi

  log "building api web cutover images on HEAD"
  loom_compose production build api web
  loom_compose production --profile cutover build cutover

  local acc_cfg
  acc_cfg="$(loom_compose acceptance config 2>/dev/null || true)"
  if ! echo "$acc_cfg" | grep -q '127.0.0.1:8080:80' \
    && ! echo "$acc_cfg" | grep -qE 'host_ip:[[:space:]]*127\.0\.0\.1' ; then
    die "acceptance overlay missing 127.0.0.1:8080 bind"
  fi
  if ! echo "$acc_cfg" | grep -qE '8080|: "8080"|published:[[:space:]]*"?8080"?|target:[[:space:]]*80'; then
    die "acceptance overlay missing host port 8080"
  fi

  log "preflight OK (sourceMode=$SOURCE_MODE)"
}

phase_pw_backup() {
  [[ -d "$PW_ROOT" ]] || die "PW_ROOT not found: $PW_ROOT"
  mkdir -p "$BACKUP_DIR"
  local ts dest
  ts="$(date -u +%Y%m%d-%H%M%SZ)"
  dest="$BACKUP_DIR/pw-pre-cutover-$ts"
  mkdir -p "$dest"

  if [[ -x "$PW_ROOT/scripts/backup.sh" ]]; then
    log "running PW backup.sh"
    (cd "$PW_ROOT" && ./scripts/backup.sh) || die "PW backup.sh failed"
    if [[ -d "$PW_ROOT/backups" ]]; then
      local newest
      newest="$(find "$PW_ROOT/backups" -mindepth 1 -maxdepth 1 -type d | sort | tail -n1 || true)"
      if [[ -n "$newest" ]]; then
        cp -a "$newest" "$dest/pw-backup"
      fi
    fi
  else
    log "PW backup.sh missing — copying sqlite + uploads if present"
    mkdir -p "$dest/runtime"
    [[ -f "$PW_ROOT/runtime/data/app.sqlite" ]] && cp -a "$PW_ROOT/runtime/data/app.sqlite" "$dest/runtime/"
    [[ -d "$PW_ROOT/runtime/uploads" ]] && cp -a "$PW_ROOT/runtime/uploads" "$dest/runtime/"
  fi

  if [[ ! -f "$dest/runtime/app.sqlite" && ! -f "$dest/pw-backup/app.sqlite" && ! -f "$PW_ROOT/runtime/data/app.sqlite" ]]; then
    die "PW sqlite not found for backup verification"
  fi
  echo "$dest" > "$BACKUP_DIR/pw-backup-latest.path"
  log "PW backup at $dest (keep off-box copy before go_live)"
}

phase_pw_stop() {
  log "stopping ProjectWeekend (hr-app)"
  [[ -d "$PW_ROOT" ]] || die "PW_ROOT missing"
  pw_compose down || die "PW compose down failed"
  if command -v ss >/dev/null 2>&1; then
    if ss -lnt | grep -qE ':80\s'; then
      log "WARN: something still listening on :80 — investigate before go_live"
    fi
  fi
}

phase_loom_db_bootstrap() {
  require_env_file
  loom_compose production up -d postgres

  "$ROOT/scripts/db-recreate.sh" --fileset production

  if [[ "$SOURCE_MODE" == "snapshot" ]]; then
    log "sourceMode=snapshot: restore → migrate"
    "$ROOT/scripts/db-restore.sh" --fileset production --snapshot "$SNAPSHOT"
    "$ROOT/scripts/migrate-run.sh" --fileset production
  else
    log "sourceMode=pw-refresh: migrate → importer (never importer on unmigrated DB)"
    "$ROOT/scripts/migrate-run.sh" --fileset production
    export PW_SQLITE_HOST_PATH="$PW_SQLITE"
    loom_compose production --profile cutover run --rm --no-deps \
      -e "DATABASE_URL=${DATABASE_URL}" \
      -v "${PW_SQLITE}:/pw/app.sqlite:ro" \
      cutover \
      node scripts/cutover/import-from-projectweekend.mjs \
      --reset --sqlite /pw/app.sqlite \
      --database-url "${DATABASE_URL}"
    mkdir -p "$BACKUP_DIR"
    local dump="$BACKUP_DIR/post-import.$(date -u +%Y%m%d-%H%M%SZ).sql"
    log "optional post-import dump → $dump"
    loom_compose production exec -T postgres \
      pg_dump -U "${POSTGRES_USER:-loom}" -d "${POSTGRES_DB:-loom_crm}" \
      --clean --if-exists --no-owner --no-acl -f /tmp/post-import.sql || true
    loom_compose production cp postgres:/tmp/post-import.sql "$dump" 2>/dev/null || true
  fi

  verify_migration_set_exact production "${POSTGRES_USER:-loom}" "${POSTGRES_DB:-loom_crm}"
  log "loom_db_bootstrap complete ($SOURCE_MODE)"
}

wait_api_ready() {
  local fileset="$1"
  local i=0
  until loom_compose "$fileset" exec -T api \
    node -e 'fetch("http://127.0.0.1:3000/api/v1/health/ready").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))' \
    >/dev/null 2>&1; do
    i=$((i + 1))
    (( i > 90 )) && die "api not ready"
    sleep 2
  done
}

phase_loom_start() {
  log "starting api --no-deps, then web with acceptance overlay"
  loom_compose acceptance up -d --no-deps api
  wait_api_ready acceptance
  loom_compose acceptance up -d --no-deps web
  log "web bound to 127.0.0.1:8080 (not public :80)"
}

phase_smoke() {
  "$ROOT/scripts/smoke-site.sh" --bind localhost --env-file "$LOOM_ENV_FILE"
}

phase_acceptance() {
  log "ADMIN ACCEPTANCE REQUIRED"
  log "  UI: http://127.0.0.1:8080 (SSH tunnel if remote)"
  log "  Confirm checklist, then re-run: ./scripts/site-cutover.sh --resume --phase go_live"
  if [[ "${CUTOVER_AUTO_ACCEPT:-}" == "1" ]]; then
    log "CUTOVER_AUTO_ACCEPT=1 — skipping interactive gate"
    return 0
  fi
  if [[ -t 0 ]]; then
    read -r -p "Type 'ACCEPT' after admin verification: " ans
    [[ "$ans" == "ACCEPT" ]] || die "acceptance not confirmed"
  else
    die "non-interactive shell: set CUTOVER_AUTO_ACCEPT=1 after manual verification, or run --phase go_live later"
  fi
}

phase_go_live() {
  log "go_live: recreate web with production fileset (:80)"
  loom_compose production up -d --no-deps api
  loom_compose production up -d --no-deps --force-recreate web
  local i=0
  until curl -fsSk "https://127.0.0.1/api/v1/health/ready" >/dev/null 2>&1; do
    i=$((i + 1))
    (( i > 60 )) && die "public health not ready"
    sleep 2
  done
  "$ROOT/scripts/smoke-site.sh" --bind public --env-file "$LOOM_ENV_FILE"
  cutover_state_set_go_live
  log "go_live complete — Loom is authoritative; data-safe PW rollback no longer guaranteed"
}

phase_done() {
  log "cutover done. Retain /root/ProjectWeekend. Do not auto-rollback PW after live writes."
  log "Daily updates: ./scripts/deploy-vps.sh (BC migrations or LOOM_STOP_API_BEFORE_MIGRATE=1)"
}

main() {
  require_env_file
  local commit snapshot_sha fp pw_bak
  if git rev-parse HEAD >/dev/null 2>&1; then
    commit="$(git rev-parse HEAD)"
  else
    # Stable across resume invocations when tree has no .git
    commit="no-git-transfer"
    log "WARN: no git repo — using synthetic commit id $commit"
  fi
  snapshot_sha="$(sha256_file "$SNAPSHOT")"
  fp="$(safe_config_fingerprint production)"
  pw_bak=""
  [[ -f "$BACKUP_DIR/pw-backup-latest.path" ]] && pw_bak="$(cat "$BACKUP_DIR/pw-backup-latest.path")"

  local state_path
  state_path="$(_cutover_state_path)"

  if [[ "$FORCE_NEW" == "1" ]]; then
    rm -f "$state_path"
  fi

  if [[ -f "$state_path" && "$RESUME" != "1" && -z "$ONLY_PHASE" ]]; then
    die "cutover-state exists ($state_path). Use --resume or --force-new-run"
  fi

  if [[ -f "$state_path" && "$RESUME" == "1" ]]; then
    local prev_commit prev_sha prev_mode
    prev_commit="$(cutover_state_get repoCommit || true)"
    prev_sha="$(cutover_state_get snapshotSha256 || true)"
    prev_mode="$(cutover_state_get sourceMode || true)"
    if [[ "$prev_commit" != "$commit" || "$prev_sha" != "$snapshot_sha" || "$prev_mode" != "$SOURCE_MODE" ]]; then
      die "resume refused: commit/snapshot/sourceMode drift (use --force-new-run)"
    fi
    log "resuming from $state_path"
  else
    if [[ ! -f "$state_path" ]]; then
      cutover_state_init "$commit" "$snapshot_sha" "$SOURCE_MODE" "$pw_bak" "$fp"
    fi
  fi

  if [[ -n "$ONLY_PHASE" ]]; then
    run_phase "$ONLY_PHASE"
    exit 0
  fi

  local p
  for p in "${PHASES[@]}"; do
    run_phase "$p"
  done
}

main
