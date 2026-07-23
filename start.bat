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

echo Migrations...
call pnpm migration:run
if errorlevel 1 goto :end

echo Starting API + Web...
echo   http://localhost:3000/api/v1/health/live
echo   http://localhost:4200
echo   admin@loom.local / Admin123!
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
