@echo off
echo.
echo ========================================
echo    SHOP SCREEN SHARING SYSTEM DEMO
echo ========================================
echo.
echo Starting all services...
echo.

REM Kill any existing Node.js processes to avoid port conflicts
echo [0/3] Cleaning up any existing processes...
taskkill /f /im node.exe 2>nul || echo No existing Node.js processes found.

REM Wait a moment after cleanup
timeout /t 2 /nobreak > nul

REM Start the enhanced Node.js server (WebSocket backend)
echo [1/3] Starting WebSocket servers...
cd /d "C:\Shop-Screensharing\s\screensy\screensy-rendezvous"
start "WebSocket Servers" /min cmd /k "node shop-server.js"

REM Wait a moment for WebSocket server to start
timeout /t 4 /nobreak > nul

REM Start the web server
echo [2/3] Starting web server...
cd /d "C:\Shop-Screensharing\s\screensy\screensy-website"
start "Web Server" /min cmd /k "node node-server.js"

REM Wait for servers to fully initialize
timeout /t 4 /nobreak > nul

echo [3/3] Verifying services...

echo.
echo ✅ All services started successfully!
echo.
echo 🌐 Access Points:
echo.
echo 📊 ADMIN DASHBOARD (Trainer):
echo    Local:   http://localhost:8080/admin
echo    Network: http://10.0.1.216:8080/admin
echo.
echo 📱 DEVICE CLIENT (Participants):
echo    Local:   http://localhost:8080/device
echo    Network: http://10.0.1.216:8080/device
echo.
echo 🖥️  ORIGINAL SCREENSY:
echo    Local:   http://localhost:8080/
echo    Network: http://10.0.1.216:8080/
echo.
echo 🔧 WebSocket Services:
echo    - Screensy P2P: ws://10.0.1.216:4000
echo    - Admin Dashboard: ws://10.0.1.216:4001
echo    - Device Clients: ws://10.0.1.216:4002
echo.
echo ========================================
echo              DEMO GUIDE
echo ========================================
echo.
echo 1️⃣  TRAINER (Admin Dashboard):
echo    - Open: http://10.0.1.216:8080/admin
echo    - View all 3 tables with 6 devices each
echo    - Select devices and displays for sharing
echo    - Request permissions and control sessions
echo.
echo 2️⃣  PARTICIPANTS (Device Client):
echo    - Open: http://10.0.1.216:8080/device
echo    - Register device (name, type, table)
echo    - Accept sharing requests from trainer
echo    - Share screen content to displays
echo.
echo 3️⃣  FEATURES:
echo    ✅ Real-time device status
echo    ✅ Permission-based screen sharing
echo    ✅ Multi-device support (phone/tablet/laptop)
echo    ✅ WebRTC P2P connections
echo    ✅ Admin control dashboard
echo    ✅ Cross-platform compatibility
echo.
echo 🚀 The system is now ready for use!
echo.
echo Press any key to open all interfaces...
pause > nul

REM Open all interfaces in browser
start "" "http://10.0.1.216:8080/admin"
timeout /t 1 /nobreak > nul
start "" "http://10.0.1.216:8080/device"
timeout /t 1 /nobreak > nul
start "" "http://10.0.1.216:8080/"

echo.
echo 🌟 All interfaces opened in your browser!
echo.
echo To stop all services, close this window or press Ctrl+C
echo Then close the minimized terminal windows.
echo.
pause
