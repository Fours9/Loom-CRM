#!/usr/bin/env bash
# Cutover resume marker helpers (no secrets).
# State file: backups/cutover-state.json (gitignored).

# shellcheck shell=bash

CUTOVER_STATE_FILE="${CUTOVER_STATE_FILE:-}"

_cutover_state_path() {
  if [[ -n "$CUTOVER_STATE_FILE" ]]; then
    echo "$CUTOVER_STATE_FILE"
  else
    echo "$(_loom_repo_root)/backups/cutover-state.json"
  fi
}

cutover_state_init() {
  local commit="$1"
  local snapshot_sha="$2"
  local source_mode="$3"
  local pw_backup="${4:-}"
  local fingerprint="${5:-}"
  local path
  path="$(_cutover_state_path)"
  mkdir -p "$(dirname "$path")"
  cat > "$path" <<EOF
{
  "startedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "repoCommit": "$commit",
  "snapshotSha256": "$snapshot_sha",
  "sourceMode": "$source_mode",
  "pwBackupPath": "$pw_backup",
  "composeProject": "${LOOM_COMPOSE_PROJECT:-loom-crm}",
  "databaseName": "${POSTGRES_DB:-loom_crm}",
  "publicPort": 80,
  "safeConfigFingerprint": "$fingerprint",
  "completedPhases": [],
  "goLiveAt": null
}
EOF
  echo "[cutover-state] initialized $path"
}

cutover_state_get() {
  local key="$1"
  local path
  path="$(_cutover_state_path)"
  [[ -f "$path" ]] || return 1
  sed -n "s/.*\"$key\"[[:space:]]*:[[:space:]]*\"\\([^\"]*\\)\".*/\\1/p" "$path" | head -n1
}

cutover_state_has_phase() {
  local phase="$1"
  local path
  path="$(_cutover_state_path)"
  [[ -f "$path" ]] || return 1
  grep -q "\"$phase\"" "$path"
}

cutover_state_mark_phase() {
  local phase="$1"
  local path tmp
  path="$(_cutover_state_path)"
  [[ -f "$path" ]] || { echo "ERROR: no cutover state at $path" >&2; return 1; }
  if cutover_state_has_phase "$phase"; then
    echo "[cutover-state] phase already completed: $phase"
    return 0
  fi
  tmp="$(mktemp)"
  if command -v python3 >/dev/null 2>&1; then
    python3 - "$path" "$phase" "$tmp" <<'PY'
import json, sys
src, phase, dst = sys.argv[1], sys.argv[2], sys.argv[3]
with open(src, encoding="utf-8") as f:
    data = json.load(f)
phases = list(data.get("completedPhases") or [])
if phase not in phases:
    phases.append(phase)
data["completedPhases"] = phases
with open(dst, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
    f.write("\n")
PY
  else
    if grep -q '"completedPhases": \[\]' "$path"; then
      sed "s/\"completedPhases\": \[\]/\"completedPhases\": [\"$phase\"]/" "$path" > "$tmp"
    else
      sed "s/\"completedPhases\": \[/\"completedPhases\": [\"$phase\", /" "$path" > "$tmp"
    fi
  fi
  mv "$tmp" "$path"
  echo "[cutover-state] marked phase: $phase"
}

cutover_state_set_go_live() {
  local path tmp ts
  path="$(_cutover_state_path)"
  tmp="$(mktemp)"
  ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  if command -v python3 >/dev/null 2>&1; then
    python3 - "$path" "$ts" "$tmp" <<'PY'
import json, sys
src, ts, dst = sys.argv[1], sys.argv[2], sys.argv[3]
with open(src, encoding="utf-8") as f:
    data = json.load(f)
data["goLiveAt"] = ts
phases = list(data.get("completedPhases") or [])
if "go_live" not in phases:
    phases.append("go_live")
data["completedPhases"] = phases
with open(dst, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
    f.write("\n")
PY
    mv "$tmp" "$path"
  else
    sed "s/\"goLiveAt\": null/\"goLiveAt\": \"$ts\"/" "$path" > "$tmp"
    mv "$tmp" "$path"
    cutover_state_mark_phase "go_live"
  fi
}

safe_config_fingerprint() {
  local fileset="${1:-production}"
  local raw
  raw="$(loom_compose "$fileset" config 2>/dev/null || true)"
  if [[ -z "$raw" ]]; then
    echo "unavailable"
    return 0
  fi
  if command -v sha256sum >/dev/null 2>&1; then
    echo "$raw" \
      | sed -E 's/(password|secret|PASSWORD|SECRET|JWT)[^[:space:]]*/\1=REDACTED/gi' \
      | sha256sum \
      | awk '{print $1}'
  else
    echo "$raw" \
      | sed -E 's/(password|secret|PASSWORD|SECRET|JWT)[^[:space:]]*/\1=REDACTED/gi' \
      | shasum -a 256 \
      | awk '{print $1}'
  fi
}
