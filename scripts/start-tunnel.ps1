# LoomCRM supervised demo tunnel (ops-only; no domain logic).
# Usage: .\start-tunnel.bat  |  .\scripts\start-tunnel.ps1
#
# Public URL (permanent reserved domain, same ngrok account as ProjectWeekend):
#   https://sureness-strewn-booting.ngrok-free.dev
# Do not run ProjectWeekend tunnel and LoomCRM tunnel at the same time.
#
# One-time: ngrok config add-authtoken <token from dashboard.ngrok.com>
# Does NOT auto-restore DB snapshot — use .\scripts\db-restore.ps1 explicitly.

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$NgrokDomain = 'sureness-strewn-booting.ngrok-free.dev'
$ForbiddenJwtSecrets = @(
    'dev-only-change-me-loom-crm-jwt-secret'
)
$HttpReadyTimeoutSec = 90
$NgrokVerifyTimeoutSec = 45

function Import-DotEnvFile {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return }
    Get-Content -LiteralPath $Path -Encoding UTF8 | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith('#')) { return }
        $eq = $line.IndexOf('=')
        if ($eq -lt 1) { return }
        $key = $line.Substring(0, $eq).Trim()
        $value = $line.Substring($eq + 1).Trim()
        if (
            ($value.StartsWith('"') -and $value.EndsWith('"')) -or
            ($value.StartsWith("'") -and $value.EndsWith("'"))
        ) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        if ($key -and -not [string]::IsNullOrWhiteSpace($key)) {
            Set-Item -Path "Env:$key" -Value $value
        }
    }
}

function Assert-Node22 {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        $nodeDir = 'C:\Program Files\nodejs'
        if (Test-Path "$nodeDir\node.exe") {
            $env:Path = "$nodeDir;$env:Path"
        }
    }
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        throw 'Node.js not found. Install Node.js 22.x and restart the terminal.'
    }
    $raw = (node --version).Trim()
    if ($raw -notmatch '^v?(\d+)\.') {
        throw "Could not parse node version: $raw"
    }
    $major = [int]$Matches[1]
    if ($major -ne 22) {
        throw @"
Node.js major version must be 22 (engines >=22 <23). Found: $raw

Install Node 22 (LoomCRM, not ProjectWeekend's Node 20+):
  winget uninstall --id OpenJS.NodeJS.22 -e
  winget install --id OpenJS.NodeJS.22 --version 22.23.2 -e
Then open a NEW terminal and check: node --version

Full onboarding: docs/dev/git-sync.md § «Налаштування нового ПК».
"@
    }
}

function Assert-Pnpm1015 {
    $pnpmDirs = @(
        "$env:LOCALAPPDATA\pnpm",
        "$env:LOCALAPPDATA\pnpm-global",
        "$env:LOCALAPPDATA\pnpm-global\bin"
    )
    foreach ($dir in $pnpmDirs) {
        if (Test-Path $dir) {
            $env:Path = "$dir;$env:Path"
        }
    }
    if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
        throw 'pnpm not found. Install pnpm@10.15.0 (Corepack or npm install -g pnpm@10.15.0).'
    }
    $ver = (pnpm --version).Trim()
    if ($ver -ne '10.15.0') {
        throw "pnpm must be exactly 10.15.0 (packageManager). Found: $ver"
    }
}

function Ensure-Ngrok {
    if (Get-Command ngrok -ErrorAction SilentlyContinue) { return }

    $candidates = @(
        "$env:LOCALAPPDATA\Microsoft\WinGet\Links\ngrok.exe",
        "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Ngrok.Ngrok_Microsoft.Winget.Source_8wekyb3d8bbwe\ngrok.exe",
        "${env:ProgramFiles}\ngrok\ngrok.exe"
    )
    foreach ($path in $candidates) {
        if (Test-Path $path) {
            $env:Path = "$(Split-Path $path);$env:Path"
            if (Get-Command ngrok -ErrorAction SilentlyContinue) { return }
        }
    }

    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        throw @'
ngrok not found and winget is unavailable.
Install ngrok from https://ngrok.com/download or via winget, then:
  ngrok config add-authtoken <YOUR_TOKEN>
'@
    }

    Write-Host 'ngrok not found. Installing via winget (Ngrok.Ngrok)...'
    winget install --id Ngrok.Ngrok -e --accept-source-agreements --accept-package-agreements
    $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
        [System.Environment]::GetEnvironmentVariable('Path', 'User')

    foreach ($path in $candidates) {
        if (Test-Path $path) {
            $env:Path = "$(Split-Path $path);$env:Path"
        }
    }

    if (-not (Get-Command ngrok -ErrorAction SilentlyContinue)) {
        throw 'ngrok installed, but not on PATH yet. Close this window, open a new terminal, and run start-tunnel.bat again.'
    }
}

function Assert-NgrokRuns {
    $null = ngrok version 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw 'ngrok is on PATH but `ngrok version` failed.'
    }
}

function Assert-PortAvailable {
    param([int]$Port)
    $busy = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($busy) {
        throw "Port $Port is already in use. Stop the process using it before starting the demo tunnel (do not run ProjectWeekend and LoomCRM tunnels together). Refusing to free the port automatically."
    }
}

function Assert-NoLocalNgrokProcess {
    $procs = Get-Process -Name 'ngrok' -ErrorAction SilentlyContinue
    if ($procs) {
        throw 'A local ngrok process is already running. Stop it before starting the LoomCRM demo tunnel (shared reserved domain).'
    }
}

function Ensure-LoomEnvFiles {
    $envFile = Join-Path $Root '.env'
    $envExample = Join-Path $Root '.env.example'
    if (-not (Test-Path $envFile)) {
        if (-not (Test-Path $envExample)) {
            throw '.env is missing and .env.example was not found.'
        }
        Copy-Item $envExample $envFile
        Write-Host 'Created .env from .env.example — set a non-placeholder JWT_SECRET (>=32 chars) before public demo.'
    }

    $dataDir = Join-Path $Root 'data'
    if (-not (Test-Path $dataDir)) {
        New-Item -ItemType Directory -Path $dataDir | Out-Null
        Write-Host 'Created data/ directory'
    }

    Import-DotEnvFile -Path $envFile
}

function Assert-TunnelSafeEnvironment {
    $jwt = $env:JWT_SECRET
    if ([string]::IsNullOrWhiteSpace($jwt)) {
        throw 'JWT_SECRET is missing in .env. Set a secret of at least 32 characters before starting the public demo tunnel.'
    }
    foreach ($bad in $ForbiddenJwtSecrets) {
        if ($jwt -eq $bad) {
            throw @"
JWT_SECRET is the repository development placeholder ($bad).
Public demo tunnel refuses to start with known secrets.
Set a unique JWT_SECRET (>=32 characters) in .env, e.g.:
  openssl rand -base64 48
"@
        }
    }
    if ($jwt.Length -lt 32) {
        throw "JWT_SECRET must be at least 32 characters for public demo (found length $($jwt.Length))."
    }

    Write-Host ''
    Write-Host 'SECURITY (public demo):'
    Write-Host '  - Public URL is not a secret — anyone with the link can reach this machine while the tunnel is up.'
    Write-Host '  - Do not leave the tunnel unsupervised.'
    Write-Host '  - Do NOT use seed admin@loom.local / Admin123! on a public URL.'
    Write-Host '  - Prefer: .\scripts\db-restore.ps1 (snapshot accounts) OR a changed seed admin password.'
    Write-Host ''
}

function Assert-NgrokConfigSyntax {
    $ngrokConfigCheck = cmd /c "ngrok config check 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Write-Host ''
        Write-Host 'ngrok config is missing or invalid. Run once (token: dashboard.ngrok.com -> Your Authtoken):'
        Write-Host '  ngrok config add-authtoken <YOUR_TOKEN>'
        Write-Host ''
        throw "ngrok config check failed: $ngrokConfigCheck"
    }
}

function Start-DevWindow {
    param(
        [string]$Title,
        [string]$WorkingDirectory,
        [string]$Command
    )
    $cmdLine = "title $Title && cd /d `"$WorkingDirectory`" && $Command"
    Start-Process -FilePath 'cmd.exe' -ArgumentList '/k', $cmdLine | Out-Null
}

function Wait-ForHttp {
    param(
        [string]$Url,
        [int]$TimeoutSec = 90,
        [switch]$RequireOk
    )
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    $lastError = $null
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
            if (-not $RequireOk -or [int]$response.StatusCode -eq 200) {
                return
            }
            $lastError = "HTTP $($response.StatusCode)"
        } catch {
            $lastError = $_.Exception.Message
        }
        Start-Sleep -Seconds 2
    }
    throw "Timed out after ${TimeoutSec}s waiting for $Url. Last error: $lastError"
}

function Wait-ForNgrokReservedDomain {
    param(
        [string]$Domain,
        [int]$TimeoutSec = 45
    )
    $api = 'http://127.0.0.1:4040/api/tunnels'
    $expected = "https://$Domain"
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    $lastError = $null

    while ((Get-Date) -lt $deadline) {
        $ngrokProcs = Get-Process -Name 'ngrok' -ErrorAction SilentlyContinue
        if (-not $ngrokProcs) {
            $lastError = 'ngrok process exited (invalid token, wrong account, domain busy, or network error). Check the Tunnel window log.'
            Start-Sleep -Seconds 1
            continue
        }
        try {
            $json = Invoke-RestMethod -Uri $api -TimeoutSec 3
            $urls = @()
            if ($json.tunnels) {
                foreach ($t in $json.tunnels) {
                    if ($t.public_url) { $urls += [string]$t.public_url }
                }
            }
            if ($urls -contains $expected) {
                $random = $urls | Where-Object { $_ -ne $expected -and $_ -match 'ngrok' }
                if ($random) {
                    Write-Host "NOTE: ngrok also reported other URLs ($($random -join ', ')); reserved domain $expected is active."
                }
                return
            }
            if ($urls.Count -gt 0) {
                $lastError = "ngrok is up but reserved domain $expected was not found. URLs: $($urls -join ', '). Random URL fallback is not allowed."
            } else {
                $lastError = 'ngrok API returned no tunnels yet.'
            }
        } catch {
            $lastError = $_.Exception.Message
        }
        Start-Sleep -Seconds 2
    }

    throw @"
Failed to verify reserved ngrok domain https://$Domain within ${TimeoutSec}s.
$lastError
Fix authtoken / account / domain reservation, then retry. Do not use a random ngrok URL.
"@
}

# --- main ---

Set-Location $Root

Assert-Node22
Assert-Pnpm1015
Ensure-Ngrok
Assert-NgrokRuns
Assert-PortAvailable -Port 3000
Assert-PortAvailable -Port 4200
Assert-NoLocalNgrokProcess
Ensure-LoomEnvFiles
Assert-TunnelSafeEnvironment

if (-not (Test-Path (Join-Path $Root 'node_modules'))) {
    Write-Host 'Installing dependencies (pnpm install)...'
    pnpm install
    if ($LASTEXITCODE -ne 0) { throw 'pnpm install failed.' }
}

Assert-NgrokConfigSyntax

Write-Host 'Running migrations (pnpm migration:run)...'
pnpm migration:run
if ($LASTEXITCODE -ne 0) {
    throw 'pnpm migration:run failed. Fix Postgres / DATABASE_URL / schema, then retry. No demo windows were started.'
}

$snapshot = Join-Path $Root 'data\app.snapshot.sql'
if (Test-Path $snapshot) {
    Write-Host 'NOTE: demo snapshot present but not applied automatically.'
    Write-Host '  Empty DB / known seed only? Prefer: .\scripts\db-restore.ps1 (then restart tunnel).'
} else {
    Write-Host 'NOTE: data\app.snapshot.sql missing — public demo with empty seed admin is unsafe.'
}

Write-Host ''
Write-Host 'Starting supervised demo (local + public tunnel)...'
Write-Host '  Backend:  http://localhost:3000/api/v1'
Write-Host '  Frontend: http://localhost:4200'
Write-Host "  Public:   https://$NgrokDomain"
Write-Host ''

Start-DevWindow -Title 'LoomCRM API' -WorkingDirectory $Root -Command 'pnpm --filter @loom/api dev'
Write-Host "Waiting for API health (up to ${HttpReadyTimeoutSec}s)..."
Wait-ForHttp -Url 'http://127.0.0.1:3000/api/v1/health/live' -TimeoutSec $HttpReadyTimeoutSec -RequireOk

# Must match apps/web package.json dev:tunnel --allowed-hosts (reserved ngrok domain).
$webCmd = 'set NG_CLI_ANALYTICS=false&& pnpm --filter @loom/web dev:tunnel'
Start-DevWindow -Title 'LoomCRM Web' -WorkingDirectory $Root -Command $webCmd
Write-Host "Waiting for web (up to ${HttpReadyTimeoutSec}s)..."
Wait-ForHttp -Url 'http://127.0.0.1:4200/' -TimeoutSec $HttpReadyTimeoutSec

Start-DevWindow -Title 'LoomCRM Tunnel' -WorkingDirectory $Root -Command "ngrok http --domain=$NgrokDomain 4200"
Write-Host "Verifying reserved ngrok domain (up to ${NgrokVerifyTimeoutSec}s)..."
Wait-ForNgrokReservedDomain -Domain $NgrokDomain -TimeoutSec $NgrokVerifyTimeoutSec

Write-Host ''
Write-Host 'Done. Three windows: API, Web, Tunnel.'
Write-Host "Permanent public link: https://$NgrokDomain"
Write-Host 'Keep all three windows open. Closing them stops the demo.'
Write-Host 'Public URL is not a secret — supervise the session; stop when finished.'
Write-Host ''
Write-Host 'Press any key to close this launcher (servers keep running)...'
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
