@echo off
setlocal EnableExtensions
call "%~dp0env.bat" || exit /b 1

set "FAIL=0"

echo === guards ===
pnpm check:gitignore-pw || set "FAIL=1"
pnpm check:no-synchronize || set "FAIL=1"

echo === lint ===
pnpm lint || set "FAIL=1"

echo === typecheck ===
pnpm typecheck || set "FAIL=1"

echo === unit tests ===
pnpm test || set "FAIL=1"

echo === build ===
pnpm build || set "FAIL=1"

if "%FAIL%"=="0" (
  echo.
  echo All checks passed.
  exit /b 0
) else (
  echo.
  echo One or more checks FAILED.
  exit /b 1
)
