@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22.12 or newer before running StatLab.
  pause
  exit /b 1
)
if not exist node_modules (
  call npm.cmd ci --cache .runtime/npm-cache --no-fund --no-audit
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
echo Open http://127.0.0.1:4307 after the server is ready.
echo Sign in with your account or choose Create an account.
call npm.cmd start
pause
