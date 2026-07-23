# Restore the live PostgreSQL database from the tracked snapshot (data/app.snapshot.sql).
# WARNING: overwrites the live DB. Stop API/web (or anything writing to the DB) before running.
# Usage: .\scripts\db-restore.ps1
#
# Before overwrite, dumps the current live DB to data/app.live.bak-<timestamp>.sql (gitignored).

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$DataDir = Join-Path $Root 'data'
$Snapshot = Join-Path $DataDir 'app.snapshot.sql'

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
        foreach ($line in Get-Content $envFile) {
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
        $dump = docker compose exec -T postgres pg_dump -U loom -d loom_crm --clean --if-exists --no-owner --no-acl 2>$null
        if ($LASTEXITCODE -eq 0 -and $dump) {
            [System.IO.File]::WriteAllText($backup, ($dump -join "`n") + "`n")
            Write-Host "Previous live DB backed up to: $backup"
            return
        }
    } finally {
        Pop-Location
    }
    Write-Host 'Note: could not backup live DB (empty or unreachable); continuing with restore.'
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
        Get-Content -Path $Snapshot -Raw | docker compose exec -T postgres psql -U loom -d loom_crm -v ON_ERROR_STOP=1
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
    Write-Host "Restoring from snapshot via local psql..."
    Get-Content -Path $Snapshot -Raw | & psql --dbname=$url -v ON_ERROR_STOP=1
    if ($LASTEXITCODE -ne 0) {
        throw 'psql restore failed'
    }
}

Write-Host "Live database restored from: $Snapshot"
Write-Host 'Restart API/web if they were stopped (e.g. .\start.bat).'
