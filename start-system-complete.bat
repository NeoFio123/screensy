@echo off
echo Starte Shop Screen Sharing System...
echo.

echo 1. Starte WebSocket Server...
start "WebSocket Server" cmd /k "cd /d C:\Shop-Screensharing\s\screensy\screensy-rendezvous && node server.js"

timeout /t 2 /nobreak > nul

echo 2. Starte HTTP Server...
start "HTTP Server" cmd /k "cd /d C:\Shop-Screensharing\s\screensy && node http-only-server.js"

timeout /t 3 /nobreak > nul

echo.
echo ============================================
echo   Shop Screen Sharing System gestartet!
echo ============================================
echo.
echo Admin Dashboard: http://localhost:8080/admin
echo Device Client:   http://localhost:8080/device
echo WebSocket Ports:  4000, 4001, 4002
echo HTTP Port:        8080
echo.
echo Beide Server laufen in separaten Fenstern.
echo Schließen Sie diese Batch-Datei, um fortzufahren.
echo.
pause
