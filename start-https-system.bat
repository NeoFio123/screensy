@echo off
title Shop Screensharing HTTPS Server
cls
echo.
echo 🚀 Starting Shop Screensharing HTTPS Server...
echo.
echo 🔒 HTTPS Support enabled for secure screen sharing
echo 📱 Mobile device support with network IP detection
echo ⚡ WebSocket servers on ports 4000-4002
echo.

REM Stop any existing Node.js processes
taskkill /F /IM node.exe >nul 2>&1

REM Start the HTTPS server
echo ⏳ Starting server...
node https-server.js

pause
