const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const port = 8080;

// MIME types
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml'
};

function serveFile(filePath, response) {
    fs.readFile(filePath, (err, data) => {
        if (err) {
            response.writeHead(404);
            response.end('File not found');
            return;
        }

        const ext = path.extname(filePath);
        const contentType = mimeTypes[ext] || 'text/plain';
        
        response.writeHead(200, { 'Content-Type': contentType });
        response.end(data);
    });
}

const server = http.createServer((request, response) => {
    const parsedUrl = url.parse(request.url, true);
    const pathname = parsedUrl.pathname;

    console.log(`${new Date().toISOString()} - ${request.method} ${pathname}`);

    // Route handling
    if (pathname === '/' || pathname === '/index.html') {
        // Serve original screensy
        serveFile(path.join(__dirname, 'translations', 'en.html'), response);
    } else if (pathname === '/admin') {
        // Serve admin dashboard
        serveFile(path.join(__dirname, '..', 'admin-dashboard', 'index.html'), response);
    } else if (pathname === '/device') {
        // Serve device client
        serveFile(path.join(__dirname, '..', 'device-client', 'index.html'), response);
    } else if (pathname === '/favicon.ico') {
        // Serve favicon
        serveFile(path.join(__dirname, 'favicon.svg'), response);
    } else if (pathname === '/device-styles.css') {
        // Serve device client CSS
        serveFile(path.join(__dirname, '..', 'device-client', 'device-styles.css'), response);
    } else if (pathname === '/device-client.js') {
        // Serve device client JS
        serveFile(path.join(__dirname, '..', 'device-client', 'device-client.js'), response);
    } else if (pathname === '/admin-styles.css') {
        // Serve admin dashboard CSS
        serveFile(path.join(__dirname, '..', 'admin-dashboard', 'admin-styles.css'), response);
    } else if (pathname === '/admin-dashboard.js') {
        // Serve admin dashboard JS
        serveFile(path.join(__dirname, '..', 'admin-dashboard', 'admin-dashboard.js'), response);
    } else if (pathname === '/admi' || pathname === '/admn') {
        // Redirect common typos to admin
        response.writeHead(301, { 'Location': '/admin' });
        response.end();
    } else if (pathname.startsWith('/admin-dashboard/')) {
        // Serve admin dashboard static files
        const filePath = path.join(__dirname, '..', pathname);
        serveFile(filePath, response);
    } else if (pathname.startsWith('/device-client/')) {
        // Serve device client static files
        const filePath = path.join(__dirname, '..', pathname);
        serveFile(filePath, response);
    } else {
        // Serve other static files (original screensy)
        const filePath = path.join(__dirname, pathname.slice(1));
        serveFile(filePath, response);
    }
});

server.listen(port, '0.0.0.0', () => {
    console.log(`Enhanced Screensy Web Server started on port ${port}`);
    console.log('');
    console.log('Access points:');
    console.log(`- Main screensy: http://10.0.1.216:${port}/`);
    console.log(`- Admin dashboard: http://10.0.1.216:${port}/admin`);
    console.log(`- Device client: http://10.0.1.216:${port}/device`);
    console.log('');
    console.log('WebSocket servers running on:');
    console.log('- Screensy: ws://10.0.1.216:4000');
    console.log('- Admin: ws://10.0.1.216:4001');
    console.log('- Devices: ws://10.0.1.216:4002');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down Enhanced Screensy Web Server...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
