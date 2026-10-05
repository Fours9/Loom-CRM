#!/usr/bin/env bash
# Exact migration-set consistency: every DB row known to typeorm-options.ts,
# and every registered migration present in DB. Protects against
# "snapshot from newer commit than deployed HEAD".
#
# Sourced by migrate-run.sh / site-cutover.sh

# shellcheck shell=bash

_migration_registry_names() {
  local opts="$(_loom_repo_root)/apps/api/src/platform/database/typeorm-options.ts"
  if [[ ! -f "$opts" ]]; then
    echo "ERROR: typeorm-options.ts not found: $opts" >&2
    return 1
  fi
  # Class names ending with 13-digit timestamps inside migrations: [ ... ]
  grep -E '^\s+[A-Za-z0-9_]+173[0-9]+,' "$opts" \
    | sed -E 's/^[[:space:]]+//;s/,[[:space:]]*$//' \
    | sort
}

verify_migration_set_exact() {
  local fileset="${1:?}"
  local user="${2:-loom}"
  local db="${3:-loom_crm}"
  local tmp_reg tmp_db
  tmp_reg="$(mktemp)"
  tmp_db="$(mktemp)"

  _migration_registry_names > "$tmp_reg"
  if [[ ! -s "$tmp_reg" ]]; then
    echo "ERROR: no migrations parsed from typeorm-options.ts" >&2
    rm -f "$tmp_reg" "$tmp_db"
    return 1
  fi

  loom_compose "$fileset" exec -T postgres \
    psql -U "$user" -d "$db" -Atqc \
    "SELECT name FROM migrations ORDER BY timestamp, id;" \
    | sed '/^$/d' | sort > "$tmp_db"

  if ! diff -u "$tmp_reg" "$tmp_db" >/dev/null; then
    echo "ERROR: migration set mismatch (registry vs DB)" >&2
    echo "--- registered (typeorm-options.ts)" >&2
    cat "$tmp_reg" >&2
    echo "--- applied (migrations table)" >&2
    cat "$tmp_db" >&2
    echo "--- diff" >&2
    diff -u "$tmp_reg" "$tmp_db" >&2 || true
    rm -f "$tmp_reg" "$tmp_db"
    return 1
  fi

  local n
  n="$(wc -l < "$tmp_reg" | tr -d ' ')"
  echo "[migration-verify] exact match: $n migrations"
  rm -f "$tmp_reg" "$tmp_db"
  return 0
}
