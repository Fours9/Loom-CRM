@echo off
setlocal
cd /d "%~dp0"

set "PATH=%LOCALAPPDATA%\pnpm-global;%LOCALAPPDATA%\pnpm-global\bin;%PATH%"

where pnpm >nul 2>&1
if errorlevel 1 (
  echo pnpm not found.
  goto :end
)

if not defined DATABASE_URL set "DATABASE_URL=postgres://loom:loom@127.0.0.1:5432/loom_crm"
if not defined JWT_SECRET set "JWT_SECRET=dev-only-change-me-loom-crm-jwt-secret"

set "FAIL=0"
call pnpm check:gitignore-pw || set "FAIL=1"
call pnpm check:no-synchronize || set "FAIL=1"
call pnpm lint || set "FAIL=1"
call pnpm typecheck || set "FAIL=1"
call pnpm test || set "FAIL=1"
call pnpm build || set "FAIL=1"

:end
echo.
if "%FAIL%"=="0" (
  echo OK.
) else (
  echo FAILED. See messages above.
)
pause
endlocal
