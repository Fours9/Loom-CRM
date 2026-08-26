# Push current master commits to hr586 WITHOUT Fours9-only commits
# (e.g. docs/dev/git-dual-accounts.local.md).
#
# Usage (from repo root):
#   pwsh -File scripts/git-push-hr586.ps1
#
# Local master may contain Fours9-only history; this replays only shared commits
# onto hr586/master and force-with-lease updates that remote.

$ErrorActionPreference = 'Stop'
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '..'))

$fours9OnlyPaths = @(
  'docs/dev/git-dual-accounts.local.md'
)

function Test-Fours9OnlyCommit([string]$sha) {
  $files = git diff-tree --no-commit-id --name-only -r $sha
  if (-not $files) { return $false }
  $list = @($files | Where-Object { $_ -and $_.Trim() })
  if ($list.Count -eq 0) { return $false }
  foreach ($f in $list) {
    if ($fours9OnlyPaths -notcontains $f -and $f -ne '.gitignore') {
      # Allow .gitignore-only together with cheat sheet as Fours9-only bundle
      return $false
    }
  }
  # All files are in fours9-only set (and optional .gitignore)
  $hasCheat = $list | Where-Object { $_ -eq 'docs/dev/git-dual-accounts.local.md' }
  return [bool]$hasCheat
}

git fetch hr586
git fetch origin

$start = (git rev-parse hr586/master).Trim()
$tip = (git rev-parse master).Trim()

$shas = @(git rev-list --reverse "$start..$tip")
if ($shas.Count -eq 0) {
  Write-Host "hr586/master already has all shared commits from master."
  exit 0
}

$toPick = @()
foreach ($sha in $shas) {
  $sha = $sha.Trim()
  if (Test-Fours9OnlyCommit $sha) {
    Write-Host "Skip Fours9-only commit $($sha.Substring(0,7)) $(git log -1 --format=%s $sha)"
    continue
  }
  $toPick += $sha
}

if ($toPick.Count -eq 0) {
  Write-Host "Nothing to push to hr586 after filtering Fours9-only commits."
  exit 0
}

$branch = "_hr586_push_tmp"
git branch -D $branch 2>$null | Out-Null
git checkout -B $branch hr586/master

try {
  foreach ($sha in $toPick) {
    git cherry-pick $sha
    if ($LASTEXITCODE -ne 0) {
      throw "cherry-pick failed for $sha"
    }
  }
  git push --force-with-lease hr586 "HEAD:master"
  Write-Host "hr586/master updated (skipped Fours9-only commits)."
}
finally {
  git cherry-pick --abort 2>$null | Out-Null
  git checkout master
  git branch -D $branch 2>$null | Out-Null
}
