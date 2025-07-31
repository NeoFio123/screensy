@echo off
echo.
echo ===============================================
echo          SYSTEM VALIDATION SCRIPT
echo ===============================================
echo.

echo [1/4] Checking WebSocket Server (Port 4000-4002)...
netstat -an | findstr ":400[0-2]" | findstr ABHÖREN >nul
if %errorlevel% equ 0 (
    echo ✅ WebSocket Server running
) else (
    echo ❌ WebSocket Server not running
)

echo.
echo [2/4] Checking Web Server (Port 8080)...
netstat -an | findstr ":8080" | findstr ABHÖREN >nul
if %errorlevel% equ 0 (
    echo ✅ Web Server running
) else (
    echo ❌ Web Server not running
)

echo.
echo [3/4] Testing HTTP endpoints...
curl -s -o nul -w "%%{http_code}" http://10.0.1.216:8080/ | findstr "200" >nul
if %errorlevel% equ 0 (
    echo ✅ Main screensy accessible
) else (
    echo ❌ Main screensy not accessible
)

curl -s -o nul -w "%%{http_code}" http://10.0.1.216:8080/admin | findstr "200" >nul
if %errorlevel% equ 0 (
    echo ✅ Admin dashboard accessible
) else (
    echo ❌ Admin dashboard not accessible
)

curl -s -o nul -w "%%{http_code}" http://10.0.1.216:8080/device | findstr "200" >nul
if %errorlevel% equ 0 (
    echo ✅ Device client accessible
) else (
    echo ❌ Device client not accessible
)

echo.
echo [4/4] System Status...
echo.
echo 🌐 Access Points:
echo    Main Screensy:    http://10.0.1.216:8080/
echo    Admin Dashboard:  http://10.0.1.216:8080/admin
echo    Device Client:    http://10.0.1.216:8080/device
echo.
echo 🔌 WebSocket Endpoints:
echo    Screensy:         ws://10.0.1.216:4000/
echo    Admin:            ws://10.0.1.216:4001/
echo    Device:           ws://10.0.1.216:4002/
echo.
echo ===============================================
echo              VALIDATION COMPLETE
echo ===============================================
echo.
pause
