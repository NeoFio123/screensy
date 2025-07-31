@echo off
title Shop Screensharing - Mobile Screen Sharing Fixed
cls
echo.
echo 🚀 Starting Enhanced Shop Screensharing Server...
echo.
echo 🔧 New Features:
echo    - ✅ Mobile Screen Sharing (Kamera-Fallback)
echo    - ✅ Robustes WebRTC State Management
echo    - ✅ Enhanced Error Handling
echo    - ✅ ICE Candidate Queuing
echo    - ✅ Automatische Verbindungswiederherstellung
echo.
echo 📱 Mobile Support:
echo    - Automatische Kamera-Aktivierung auf Handys
echo    - Intelligente Fallback-Logik
echo    - Optimierte Constraints für mobile Geräte
echo.

REM Stop any existing Node.js processes
echo ⏳ Stopping existing servers...
taskkill /F /IM node.exe >nul 2>&1

REM Start the enhanced server
echo ⏳ Starting enhanced server with mobile fixes...
node mixed-content-fixed-server.js

pause
