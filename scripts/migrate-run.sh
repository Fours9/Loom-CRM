#!/usr/bin/env bash
# Single migrate entry: compose run --rm migrate + exact migration-set verify.
# After this helper, start api/web with: loom_compose <fileset> up -d --no-deps api|web
# Do NOT use plain `up api` (would re-trigger depends_on migrate).
#
# Usage: ./scripts/migrate-run.sh [--fileset production|acceptance|base]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib/compose-cli.sh
source "$ROOT/scripts/lib/compose-cli.sh"
# shellcheck source=lib/migration-verify.sh
source "$ROOT/scripts/lib/migration-verify.sh"

FILESET="${FILESET:-production}"
POSTGRES_USER="${POSTGRES_USER:-loom}"
POSTGRES_DB="${POSTGRES_DB:-loom_crm}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --fileset) FILESET="$2"; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

log() { echo "[migrate-run] $*"; }

log "compose run --rm migrate ($FILESET)"
loom_compose "$FILESET" run --rm migrate

log "verifying exact migration set vs typeorm registry"
verify_migration_set_exact "$FILESET" "$POSTGRES_USER" "$POSTGRES_DB"

log "migrate OK"
