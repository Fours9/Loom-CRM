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

REM Migrations only create schema. Demo data lives in data/app.snapshot.sql (PW-style).
REM If users table is empty and snapshot exists, restore automatically unless skipped.
if /I "%SKIP_SNAPSHOT_RESTORE%"=="1" goto :after_restore
if not exist "data\app.snapshot.sql" (
  echo WARNING: data\app.snapshot.sql missing — DB will stay empty of demo accounts.
  goto :after_restore
)
where psql >nul 2>&1
if errorlevel 1 (
  echo NOTE: psql not in PATH — cannot auto-check empty DB.
  echo If login fails, run: .\scripts\db-restore.ps1
  goto :after_restore
)
for /f "usebackq delims=" %%C in (`psql --dbname="%DATABASE_URL%" -w -tAc "SELECT COUNT(*) FROM users" 2^>nul`) do set "USER_COUNT=%%C"
set "USER_COUNT=%USER_COUNT: =%"
if "%USER_COUNT%"=="0" (
  echo.
  echo users table is empty — restoring demo state from data\app.snapshot.sql
  echo ^(same as ProjectWeekend: migrate != restore^)
  echo To skip next time: set SKIP_SNAPSHOT_RESTORE=1
  echo.
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\db-restore.ps1"
  if errorlevel 1 goto :end
) else if "%USER_COUNT%"=="" (
  echo NOTE: could not count users — if login fails, run: .\scripts\db-restore.ps1
)

:after_restore
echo Starting API + Web...
echo   http://localhost:3000/api/v1/health/live
echo   http://localhost:4200
echo   After snapshot restore: accounts from data\app.snapshot.sql ^(e.g. hr@tier.ua^)
echo   Empty DB seed only: admin@loom.local / Admin123!
echo Building API...
call pnpm --filter @loom/api build
if errorlevel 1 goto :end
call pnpm -r --parallel dev

:end
echo.
if errorlevel 1 (
  echo FAILED. See messages above.
) else (
  echo Stopped.
)
pause
endlocal
