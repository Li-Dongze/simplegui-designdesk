@echo off
setlocal

cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo.
  echo [ERROR] No npm command found.
  echo Please install Node.js first, then try again.
  echo Download: https://nodejs.org/
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo.
  echo [INFO] Installing dependencies for first run...
  call npm install
  if errorlevel 1 (
    echo.
    echo [ERROR] npm install failed.
    echo.
    pause
    exit /b 1
  )
)

echo.
echo [INFO] Starting SimpleGUI Design Desk...
echo [INFO] URL: http://127.0.0.1:5173
echo [INFO] Close this window or press Ctrl+C to stop.
echo.

start "" "http://127.0.0.1:5173"
call npm run dev

if errorlevel 1 (
  echo.
  echo [ERROR] Startup failed, please check logs above.
  echo.
  pause
  exit /b 1
)

exit /b 0
