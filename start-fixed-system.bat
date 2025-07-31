@echo off
title Shop Screensharing - Mixed Content Fixed
cls
echo.
echo 🚀 Starting Shop Screensharing Server with Video Autoplay Fix...
echo.
echo 🔧 Features:
echo    - HTTPS + WSS für sichere Verbindungen
echo    - HTTP + WS für einfache Tests
echo    - Video Autoplay Fix implementiert
echo    - Click-to-Play Fallback
echo    - Mixed Content Problem gelöst
echo.

REM Stop any existing Node.js processes
echo ⏳ Stopping existing servers...
taskkill /F /IM node.exe >nul 2>&1

REM Start the improved server
echo ⏳ Starting enhanced server...
node mixed-content-fixed-server.js

pause
