@echo off
setlocal
cd /d "%~dp0"

set "PATH=%LOCALAPPDATA%\pnpm-global;%LOCALAPPDATA%\pnpm-global\bin;%PATH%"
if exist "%ProgramFiles%\PostgreSQL\16\bin\psql.exe" set "PATH=%ProgramFiles%\PostgreSQL\16\bin;%PATH%"

where pnpm >nul 2>&1
if errorlevel 1 (
  echo pnpm not found. Install:
  echo   npm install -g pnpm@10.15.0 --prefix "%%LOCALAPPDATA%%\pnpm-global"
  goto :end
)

if not defined DATABASE_URL set "DATABASE_URL=postgres://loom:loom@127.0.0.1:5432/loom_crm"
if not defined JWT_SECRET set "JWT_SECRET=dev-only-change-me-loom-crm-jwt-secret"
if not defined CORS_ORIGIN set "CORS_ORIGIN=http://localhost:4200"

if not exist "node_modules\" (
  echo Installing dependencies...
  call pnpm install
  if errorlevel 1 goto :end
)

if not exist ".env" if exist ".env.example" (
  echo Creating .env from .env.example...
  copy /Y ".env.example" ".env" >nul
)

echo Migrations...
call pnpm migration:run
if errorlevel 1 goto :end

REM Migrations only create/alter schema. Never auto-restore snapshot on start —
REM that would wipe live data. Demo load is explicit: .\scripts\db-restore.ps1
if not exist "data\app.snapshot.sql" (
  echo NOTE: data\app.snapshot.sql missing — after empty migrate, seed admin only.
) else (
  echo NOTE: demo snapshot present but not applied automatically.
  echo   Empty DB / no login? run: .\scripts\db-restore.ps1
)

echo Starting API + Web...
echo   http://localhost:3000/api/v1/health/live
echo   http://localhost:4200
echo   Snapshot restore ^(manual^): .\scripts\db-restore.ps1
echo   Empty DB seed only: admin@loom.local / Admin123!
echo Building API...
call pnpm --filter @loom/api build
if errorlevel 1 goto :end
REM Web starts only after API health/live (no Vite proxy ECONNREFUSED race).
call pnpm dev:apps

:end
echo.
if errorlevel 1 (
  echo FAILED. See messages above.
) else (
  echo Stopped.
)
pause
endlocal
