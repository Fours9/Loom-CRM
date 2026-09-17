# Restore the live PostgreSQL database from the tracked snapshot (data/app.snapshot.sql).
# WARNING: overwrites the live DB. Stop API/web (or anything writing to the DB) before running.
# Usage: .\scripts\db-restore.ps1
#
# Before overwrite, dumps the current live DB to data/app.live.bak-<timestamp>.sql (gitignored).
#
# IMPORTANT (Windows): never pipe snapshot text through PowerShell Get-Content into psql —
# that re-encodes UTF-8 and turns Ukrainian into "????". Always use psql -f / docker cp.

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\postgres-cli.ps1')

$Root = Get-LoomRepoRoot
$DataDir = Join-Path $Root 'data'
$Snapshot = Join-Path $DataDir 'app.snapshot.sql'
$Utf8NoBom = New-Object System.Text.UTF8Encoding $false

if (-not (Test-Path $Snapshot)) {
    throw "Snapshot not found: $Snapshot"
}

if (-not (Test-Path $DataDir)) {
    New-Item -ItemType Directory -Path $DataDir | Out-Null
}

function Backup-LiveViaCompose {
    $backup = Join-Path $DataDir ("app.live.bak-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.sql')
    Push-Location $Root
    try {
        docker compose exec -T postgres pg_dump -U loom -d loom_crm --clean --if-exists --no-owner --no-acl -f /tmp/loom-live.bak.sql 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Host 'Note: could not backup live DB (empty or unreachable); continuing with restore.'
            return
        }
        docker compose cp postgres:/tmp/loom-live.bak.sql $backup 2>$null
        if ((Test-Path $backup) -and ((Get-Item $backup).Length -gt 0)) {
            Write-Host "Previous live DB backed up to: $backup"
        } else {
            Write-Host 'Note: could not backup live DB; continuing with restore.'
            if (Test-Path $backup) { Remove-Item $backup -Force }
        }
    } finally {
        Pop-Location
    }
}

function Backup-LiveViaLocal([string]$Url) {
    $pgDump = Resolve-LoomPgDump
    if (-not $pgDump) {
        Write-Host 'Note: pg_dump not found; skipping live backup.'
        return
    }
    $backup = Join-Path $DataDir ("app.live.bak-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.sql')
    & $pgDump --dbname=$Url --clean --if-exists --no-owner --no-acl --file=$backup 2>$null
    if ($LASTEXITCODE -eq 0 -and (Test-Path $backup) -and ((Get-Item $backup).Length -gt 0)) {
        Write-Host "Previous live DB backed up to: $backup"
    } else {
        Write-Host 'Note: could not backup live DB; continuing with restore.'
        if (Test-Path $backup) { Remove-Item $backup -Force }
    }
}

$useCompose = Test-LoomComposePostgres -RepoRoot $Root

if ($useCompose) {
    Backup-LiveViaCompose
    Write-Host "Restoring from snapshot via docker compose..."
    Push-Location $Root
    try {
        docker compose cp $Snapshot postgres:/tmp/app.snapshot.sql
        if ($LASTEXITCODE -ne 0) {
            throw 'docker compose cp of snapshot failed'
        }
        docker compose exec -T postgres psql -U loom -d loom_crm -v ON_ERROR_STOP=1 -f /tmp/app.snapshot.sql
        if ($LASTEXITCODE -ne 0) {
            throw 'psql restore via docker compose failed'
        }
    } finally {
        Pop-Location
    }
} else {
    $url = Get-LoomDatabaseUrl -RepoRoot $Root
    Backup-LiveViaLocal $url
    $psql = Resolve-LoomPsql
    if (-not $psql) {
        throw (Get-LoomPgToolsMissingMessage -ToolLabel 'psql')
    }
    Write-Host "Using psql: $psql"
    Write-Host "Restoring from snapshot via local psql -f (UTF-8 safe)..."
    $env:PGCLIENTENCODING = 'UTF8'
    & $psql --dbname=$url -v ON_ERROR_STOP=1 --file=$Snapshot
    if ($LASTEXITCODE -ne 0) {
        throw 'psql restore failed'
    }
}

Write-Host "Live database restored from: $Snapshot"
Write-Host 'Restart API/web if they were stopped (e.g. .\start.bat).'
