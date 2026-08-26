# Push shared commits from local master to hr586, skipping Fours9-only commits
# (dual-remote cheat sheet). Uses `git cherry` so already-mirrored patches
# (different SHAs after rewrite) are not re-applied.
#
# Usage (repo root):
#   powershell -NoProfile -File scripts/git-push-hr586.ps1

$ErrorActionPreference = 'Stop'
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '..'))

function Test-Fours9OnlyCommit([string]$sha) {
  $files = @(git diff-tree --no-commit-id --name-only -r $sha | Where-Object { $_ })
  if ($files.Count -eq 0) { return $false }
  $hasCheat = $false
  foreach ($f in $files) {
    if ($f -eq 'docs/dev/git-dual-accounts.local.md') {
      $hasCheat = $true
      continue
    }
    if ($f -eq '.gitignore') { continue }
    return $false
  }
  return $hasCheat
}

git fetch hr586 | Out-Null

$branch = '_hr586_push_tmp'
git branch -D $branch 2>$null | Out-Null

# Lines: "+ <sha>" = not on hr586; "- <sha>" = equivalent patch already there
$cherry = @(git cherry hr586/master master)
$toPick = @()
foreach ($line in $cherry) {
  if ($line -notmatch '^\+\s+([0-9a-f]+)') { continue }
  $sha = $Matches[1]
  if (Test-Fours9OnlyCommit $sha) {
    $subj = (git log -1 --format=%s $sha)
    Write-Host "Skip Fours9-only $($sha.Substring(0,7)) $subj"
    continue
  }
  $toPick += $sha
}

if ($toPick.Count -eq 0) {
  Write-Host 'hr586/master already has all shared commits (or only Fours9-only pending).'
  exit 0
}

git checkout -B $branch hr586/master
$failed = $false
try {
  foreach ($sha in $toPick) {
    Write-Host "Cherry-pick $($sha.Substring(0,7)) $(git log -1 --format=%s $sha)"
    git cherry-pick $sha
    if ($LASTEXITCODE -ne 0) {
      $failed = $true
      throw "cherry-pick failed for $sha"
    }
  }
  git push --force-with-lease hr586 "${branch}:master"
  Write-Host 'hr586/master updated.'
}
finally {
  if ($failed) { git cherry-pick --abort 2>$null | Out-Null }
  git checkout master | Out-Null
  git branch -D $branch 2>$null | Out-Null
}
