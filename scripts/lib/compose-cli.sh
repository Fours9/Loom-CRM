#!/usr/bin/env bash
# Single Compose entry for LoomCRM ops scripts.
# Always isolates project with -p loom-crm (never rely on ambient COMPOSE_PROJECT_NAME).
# PW helpers use a subshell with -p hr-app.
#
# Filesets:
#   base         → compose.yaml
#   production   → compose.yaml + compose.production.yaml
#   acceptance   → compose.yaml + compose.production.yaml + compose.cutover-acceptance.yaml
#
# Usage (sourced):
#   source scripts/lib/compose-cli.sh
#   loom_compose production up -d postgres
#   pw_compose --env-file /root/ProjectWeekend/.env.production ps

# shellcheck shell=bash

LOOM_COMPOSE_PROJECT="${LOOM_COMPOSE_PROJECT:-loom-crm}"
PW_COMPOSE_PROJECT="${PW_COMPOSE_PROJECT:-hr-app}"
LOOM_ENV_FILE="${LOOM_ENV_FILE:-.env.production}"

_loom_repo_root() {
  local here
  here="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
  echo "$here"
}

_loom_compose_files() {
  local fileset="${1:-base}"
  local root
  root="$(_loom_repo_root)"
  case "$fileset" in
    base)
      echo "-f ${root}/compose.yaml"
      ;;
    production)
      echo "-f ${root}/compose.yaml -f ${root}/compose.production.yaml"
      ;;
    acceptance)
      echo "-f ${root}/compose.yaml -f ${root}/compose.production.yaml -f ${root}/compose.cutover-acceptance.yaml"
      ;;
    *)
      echo "Unknown compose fileset: $fileset (expected base|production|acceptance)" >&2
      return 2
      ;;
  esac
}

# loom_compose <fileset> [docker compose args…]
loom_compose() {
  local fileset="${1:?fileset required}"
  shift
  local root files
  root="$(_loom_repo_root)"
  files="$(_loom_compose_files "$fileset")"
  # shellcheck disable=SC2086
  (
    cd "$root"
    if [[ -f "$LOOM_ENV_FILE" ]]; then
      # shellcheck disable=SC2086
      exec docker compose -p "$LOOM_COMPOSE_PROJECT" --env-file "$LOOM_ENV_FILE" $files "$@"
    else
      # shellcheck disable=SC2086
      exec docker compose -p "$LOOM_COMPOSE_PROJECT" $files "$@"
    fi
  )
}

# pw_compose [docker compose args…] — isolated ProjectWeekend project (subshell).
pw_compose() {
  local pw_root="${PW_ROOT:-/root/ProjectWeekend}"
  local pw_env="${PW_ENV_FILE:-$pw_root/.env.production}"
  (
    cd "$pw_root"
    if [[ -f "$pw_env" ]]; then
      exec docker compose -p "$PW_COMPOSE_PROJECT" --env-file "$pw_env" "$@"
    else
      exec docker compose -p "$PW_COMPOSE_PROJECT" "$@"
    fi
  )
}

require_compose_version() {
  local need_major=2 need_minor=24 need_patch=4
  local ver major minor patch
  ver="$(docker compose version --short 2>/dev/null || true)"
  if [[ -z "$ver" ]]; then
    echo "ERROR: docker compose v2 not found" >&2
    return 1
  fi
  # strip leading v
  ver="${ver#v}"
  IFS=. read -r major minor patch _ <<<"$ver"
  patch="${patch%%[!0-9]*}"
  major="${major:-0}"
  minor="${minor:-0}"
  patch="${patch:-0}"
  if (( major < need_major )) || \
     (( major == need_major && minor < need_minor )) || \
     (( major == need_major && minor == need_minor && patch < need_patch )); then
    echo "ERROR: Compose >= ${need_major}.${need_minor}.${need_patch} required (!reset/!override); found $ver" >&2
    return 1
  fi
  echo "Compose version OK: $ver"
}
