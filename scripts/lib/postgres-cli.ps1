# Single entry for LoomCRM Postgres CLI resolution (snapshot / restore).
# Dot-source from scripts/db-snapshot.ps1 and scripts/db-restore.ps1 only.
#
# Resolution order (deterministic):
#   1) docker compose service "postgres" if running (callers prefer this path)
#   2) pg_dump / psql on PATH
#   3) Windows install dirs under Program Files\PostgreSQL\<ver>\bin (highest ver first)

Set-StrictMode -Version Latest

# This file: <repo>/scripts/lib/postgres-cli.ps1
$script:LoomRepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

function Get-LoomRepoRoot {
    return $script:LoomRepoRoot
}

function Get-LoomDatabaseUrl {
    param([string]$RepoRoot = (Get-LoomRepoRoot))

    if ($env:DATABASE_URL -and $env:DATABASE_URL.Trim()) {
        return $env:DATABASE_URL.Trim()
    }
    $envFile = Join-Path $RepoRoot '.env'
    if (Test-Path $envFile) {
        foreach ($line in Get-Content $envFile -Encoding UTF8) {
            $trim = $line.Trim()
            if (-not $trim -or $trim.StartsWith('#')) { continue }
            if ($trim -notmatch '=') { continue }
            $k, $v = $trim.Split('=', 2)
            if ($k.Trim() -eq 'DATABASE_URL') {
                return $v.Trim().Trim('"').Trim("'")
            }
        }
    }
    return 'postgres://loom:loom@127.0.0.1:5432/loom_crm'
}

function Test-LoomComposePostgres {
    param([string]$RepoRoot = (Get-LoomRepoRoot))

    $docker = Get-Command docker -ErrorAction SilentlyContinue
    if (-not $docker) { return $false }
    Push-Location $RepoRoot
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

function Get-LoomPostgresBinCandidates {
    $roots = @(
        ${env:ProgramFiles},
        ${env:ProgramFiles(x86)}
    )
    if ($env:LOCALAPPDATA) {
        $roots += (Join-Path $env:LOCALAPPDATA 'Programs')
    }
    $roots = $roots | Where-Object { $_ -and (Test-Path $_) }

    $bins = New-Object System.Collections.Generic.List[string]
    foreach ($root in $roots) {
        $pgRoot = Join-Path $root 'PostgreSQL'
        if (-not (Test-Path $pgRoot)) { continue }
        Get-ChildItem -Path $pgRoot -Directory -ErrorAction SilentlyContinue |
            ForEach-Object {
                $bin = Join-Path $_.FullName 'bin'
                if (Test-Path $bin) { [void]$bins.Add($bin) }
            }
    }
    # Highest version directory name first (e.g. 16 before 15).
    return @($bins | Sort-Object -Descending)
}

function Resolve-LoomPgTool {
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet('pg_dump', 'psql')]
        [string]$Name
    )

    $onPath = Get-Command $Name -ErrorAction SilentlyContinue
    if ($onPath) {
        return $onPath.Source
    }

    $exe = "$Name.exe"
    foreach ($bin in Get-LoomPostgresBinCandidates) {
        $candidate = Join-Path $bin $exe
        if (Test-Path $candidate) {
            return $candidate
        }
    }
    return $null
}

function Resolve-LoomPgDump {
    return Resolve-LoomPgTool -Name 'pg_dump'
}

function Resolve-LoomPsql {
    return Resolve-LoomPgTool -Name 'psql'
}

function Get-LoomPgToolsMissingMessage {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ToolLabel
    )

    return @"
Neither Compose postgres nor local $ToolLabel is available.
Start Postgres: docker compose up -d postgres
Or install PostgreSQL client tools (pg_dump / psql).
Scripts also discover 'C:\Program Files\PostgreSQL\<ver>\bin' when PATH has no client tools.
Add that bin folder to User PATH for other CLIs, or keep using these scripts.
"@
}
