# Restore the live PostgreSQL database from the tracked snapshot (data/app.snapshot.sql).
# WARNING: overwrites the live DB. Stop API/web (or anything writing to the DB) before running.
# Usage: .\scripts\db-restore.ps1
#
# Before overwrite, dumps the current live DB to data/app.live.bak-<timestamp>.sql (gitignored).
#
# IMPORTANT (Windows): never pipe snapshot text through PowerShell Get-Content into psql —
# that re-encodes UTF-8 and turns Ukrainian into "????". Always use psql -f / docker cp.

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$DataDir = Join-Path $Root 'data'
$Snapshot = Join-Path $DataDir 'app.snapshot.sql'
$Utf8NoBom = New-Object System.Text.UTF8Encoding $false

if (-not (Test-Path $Snapshot)) {
    throw "Snapshot not found: $Snapshot"
}

if (-not (Test-Path $DataDir)) {
    New-Item -ItemType Directory -Path $DataDir | Out-Null
}

function Get-DatabaseUrl {
    if ($env:DATABASE_URL -and $env:DATABASE_URL.Trim()) {
        return $env:DATABASE_URL.Trim()
    }
    $envFile = Join-Path $Root '.env'
    if (Test-Path $envFile) {
        foreach ($line in Get-Content $envFile -Encoding UTF8) {
            if ($line -match '^\s*#' -or $line -notmatch '=') { continue }
            $k, $v = $line.Split('=', 2)
            if ($k.Trim() -eq 'DATABASE_URL') {
                return $v.Trim().Trim('"').Trim("'")
            }
        }
    }
    return 'postgres://loom:loom@127.0.0.1:5432/loom_crm'
}

function Test-ComposePostgres {
    $docker = Get-Command docker -ErrorAction SilentlyContinue
    if (-not $docker) { return $false }
    Push-Location $Root
    try {
        $ps = & docker compose ps --status running --services 2>$null
        if ($LASTEXITCODE -ne 0) { return $false }
        return ($ps -split "`n" | ForEach-Object { $_.Trim() }) -contains 'postgres'
    } catch {
        return $false
    } finally {
        Pop-Location
    }
}

function Backup-LiveViaCompose {
    $backup = Join-Path $DataDir ("app.live.bak-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.sql')
    Push-Location $Root
    try {
        # Write dump inside the container, then copy out — avoids PowerShell UTF-8 mangling.
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
    $pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
    if (-not $pgDump) {
        Write-Host 'Note: pg_dump not found; skipping live backup.'
        return
    }
    $backup = Join-Path $DataDir ("app.live.bak-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.sql')
    & pg_dump --dbname=$Url --clean --if-exists --no-owner --no-acl --file=$backup 2>$null
    if ($LASTEXITCODE -eq 0 -and (Test-Path $backup) -and ((Get-Item $backup).Length -gt 0)) {
        Write-Host "Previous live DB backed up to: $backup"
    } else {
        Write-Host 'Note: could not backup live DB; continuing with restore.'
        if (Test-Path $backup) { Remove-Item $backup -Force }
    }
}

$useCompose = Test-ComposePostgres

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
    $url = Get-DatabaseUrl
    Backup-LiveViaLocal $url
    $psql = Get-Command psql -ErrorAction SilentlyContinue
    if (-not $psql) {
        throw @"
Neither Compose postgres nor local psql is available.
Start Postgres: docker compose up -d postgres
Or install PostgreSQL client tools.
"@
    }
    Write-Host "Restoring from snapshot via local psql -f (UTF-8 safe)..."
    # -f reads the file as bytes; do NOT pipe Get-Content (breaks Cyrillic on Windows).
    $env:PGCLIENTENCODING = 'UTF8'
    & psql --dbname=$url -v ON_ERROR_STOP=1 --file=$Snapshot
    if ($LASTEXITCODE -ne 0) {
        throw 'psql restore failed'
    }
}

Write-Host "Live database restored from: $Snapshot"
Write-Host 'Restart API/web if they were stopped (e.g. .\start.bat).'
