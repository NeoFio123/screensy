@echo off
echo Building and starting Enhanced Screensy Shop System...

REM Navigate to the correct directory
cd /d "%~dp0"

REM Build and start the rendezvous server
echo Building rendezvous server...
cd screensy-rendezvous
call npm install
call npx tsc shop-server.ts --target es2017 --module commonjs --esModuleInterop
echo Starting rendezvous server...
start "Rendezvous Server" node shop-server.js
cd ..

REM Build the website TypeScript
echo Building website...
cd screensy-website
call npx tsc screensy.ts --target es2017 --module esnext --outDir .
echo Starting website server...
start "Website Server" go run main.go
cd ..

echo.
echo Enhanced Screensy Shop System started!
echo.
echo Access points:
echo - Main screensy: http://localhost:8080/
echo - Admin dashboard: http://localhost:8080/admin
echo - Device client: http://localhost:8080/device
echo.
echo Press any key to stop all services...
pause > nul

REM Stop all background processes
taskkill /f /im node.exe /t 2>nul
taskkill /f /im go.exe /t 2>nul
echo All services stopped.
