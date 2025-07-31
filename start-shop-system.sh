#!/bin/bash

echo "Building and starting Enhanced Screensy Shop System..."

# Navigate to the correct directory
cd "$(dirname "$0")"

# Build and start the rendezvous server
echo "Building rendezvous server..."
cd screensy-rendezvous
npm install
npx tsc shop-server.ts --target es2017 --module commonjs --esModuleInterop
echo "Starting rendezvous server..."
node shop-server.js &
cd ..

# Build and start the website server
echo "Building website..."
cd screensy-website
npx tsc screensy.ts --target es2017 --module esnext --outDir .
echo "Starting website server..."
go run main.go &
cd ..

echo "Enhanced Screensy Shop System started!"
echo ""
echo "Access points:"
echo "- Main screensy: http://localhost/"
echo "- Admin dashboard: http://localhost/admin"
echo "- Device client: http://localhost/device"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for user to stop
wait
