#!/usr/bin/env bash
# Fail-closed DB recreate for LoomCRM site cutover.
# Order: backup if non-empty → terminate sessions → DROP DATABASE → CREATE DATABASE.
# Never use "empty-enough" or dump --clean alone (newer target objects can survive).
#
# Usage: ./scripts/db-recreate.sh [--fileset production|acceptance|base]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib/compose-cli.sh
source "$ROOT/scripts/lib/compose-cli.sh"

FILESET="${FILESET:-production}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
POSTGRES_USER="${POSTGRES_USER:-loom}"
POSTGRES_DB="${POSTGRES_DB:-loom_crm}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --fileset) FILESET="$2"; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

log() { echo "[db-recreate] $*"; }

pg_exec() {
  loom_compose "$FILESET" exec -T postgres "$@"
}

db_is_nonempty() {
  local count
  count="$(pg_exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atqc \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null || echo "0")"
  [[ "${count:-0}" != "0" ]]
}

backup_if_nonempty() {
  if ! db_is_nonempty; then
    log "target DB empty or unreachable tables — skip backup"
    return 0
  fi
  mkdir -p "$BACKUP_DIR"
  local ts bak
  ts="$(date -u +%Y%m%d-%H%M%SZ)"
  bak="$BACKUP_DIR/loom_crm.pre-recreate.$ts.sql"
  log "non-empty DB → backup $bak (fail-closed)"
  if ! pg_exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
      --clean --if-exists --no-owner --no-acl -f /tmp/loom-pre-recreate.bak.sql; then
    echo "ERROR: backup failed — refusing recreate" >&2
    exit 1
  fi
  if ! loom_compose "$FILESET" cp postgres:/tmp/loom-pre-recreate.bak.sql "$bak"; then
    echo "ERROR: backup copy failed — refusing recreate" >&2
    exit 1
  fi
  if [[ ! -s "$bak" ]]; then
    echo "ERROR: backup file empty — refusing recreate" >&2
    exit 1
  fi
  log "backup OK: $bak"
}

recreate_database() {
  log "terminate sessions + DROP/CREATE $POSTGRES_DB"
  # Connect to maintenance DB "postgres"
  pg_exec psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 <<SQL
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '${POSTGRES_DB}' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS ${POSTGRES_DB};
CREATE DATABASE ${POSTGRES_DB} OWNER ${POSTGRES_USER};
SQL
  log "database recreated"
}

main() {
  require_compose_version
  log "ensuring postgres is up ($FILESET)"
  loom_compose "$FILESET" up -d postgres
  # wait healthy
  local i=0
  until loom_compose "$FILESET" exec -T postgres pg_isready -U "$POSTGRES_USER" -d postgres >/dev/null 2>&1; do
    i=$((i + 1))
    if (( i > 60 )); then
      echo "ERROR: postgres not ready" >&2
      exit 1
    fi
    sleep 1
  done
  backup_if_nonempty
  recreate_database
}

main "$@"
