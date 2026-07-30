# Thin wrapper for questionnaire test-data reset.
# Usage:
#   .\scripts\reset-questionnaire-test-data.ps1
#   $env:ALLOW_QUESTIONNAIRE_TEST_RESET='YES'; .\scripts\reset-questionnaire-test-data.ps1 -Execute

param(
    [switch]$Execute
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if ($Execute) {
    if ($env:ALLOW_QUESTIONNAIRE_TEST_RESET -ne 'YES') {
        throw "Set ALLOW_QUESTIONNAIRE_TEST_RESET=YES before -Execute"
    }
    node scripts/reset-questionnaire-test-data.mjs --execute
} else {
    node scripts/reset-questionnaire-test-data.mjs
}

if ($LASTEXITCODE -ne 0) {
    throw "reset-questionnaire-test-data failed with exit $LASTEXITCODE"
}
