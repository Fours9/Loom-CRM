#!/usr/bin/env bash
# Restore full baseline dump into a freshly recreated LoomCRM database.
# FORBIDDEN: "empty-enough" restore without prior DROP/CREATE (see db-recreate.sh).
#
# Prerequisites: ./scripts/db-recreate.sh already ran in this bootstrap sequence.
# Usage: ./scripts/db-restore.sh [--snapshot path] [--fileset production] [--require-fresh]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib/compose-cli.sh
source "$ROOT/scripts/lib/compose-cli.sh"

FILESET="${FILESET:-production}"
SNAPSHOT="${SNAPSHOT:-$ROOT/data/app.snapshot.sql}"
POSTGRES_USER="${POSTGRES_USER:-loom}"
POSTGRES_DB="${POSTGRES_DB:-loom_crm}"
REQUIRE_FRESH=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --snapshot) SNAPSHOT="$2"; shift 2 ;;
    --fileset) FILESET="$2"; shift 2 ;;
    --require-fresh) REQUIRE_FRESH=1; shift ;;
    --allow-non-fresh)
      echo "ERROR: empty-enough / non-fresh restore is forbidden by site-cutover policy" >&2
      exit 2
      ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

log() { echo "[db-restore] $*"; }

if [[ ! -f "$SNAPSHOT" ]]; then
  echo "ERROR: snapshot not found: $SNAPSHOT" >&2
  exit 1
fi

# Fail-closed: target must have essentially no public tables (fresh CREATE DATABASE).
table_count="$(loom_compose "$FILESET" exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atqc \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null || echo "err")"

if [[ "$table_count" == "err" ]]; then
  echo "ERROR: cannot query target DB" >&2
  exit 1
fi

if [[ "$REQUIRE_FRESH" -eq 1 && "$table_count" != "0" ]]; then
  echo "ERROR: target DB is not freshly recreated (public tables=$table_count)." >&2
  echo "        Run ./scripts/db-recreate.sh first. empty-enough restore is forbidden." >&2
  exit 1
fi

log "restoring full baseline $SNAPSHOT → $POSTGRES_DB"
loom_compose "$FILESET" cp "$SNAPSHOT" postgres:/tmp/app.snapshot.sql
loom_compose "$FILESET" exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -f /tmp/app.snapshot.sql

log "restore complete"
