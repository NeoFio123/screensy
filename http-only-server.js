const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;

// MIME types
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    
    let filePath = req.url;
    
    // Route handling
    if (filePath === '/') {
        actualPath = path.join(__dirname, 'screensy-website', 'index.html');
    } else if (filePath === '/admin') {
        actualPath = path.join(__dirname, 'admin-dashboard', 'index.html');
    } else if (filePath === '/device') {
        actualPath = path.join(__dirname, 'device-client', 'index.html');
    } else if (filePath.startsWith('/admin-dashboard/')) {
        // Admin dashboard files
        actualPath = path.join(__dirname, filePath);
    } else if (filePath.startsWith('/device-client/')) {
        // Device client files
        actualPath = path.join(__dirname, filePath);
    } else if (filePath.startsWith('/screensy-website/')) {
        // Screensy website files
        actualPath = path.join(__dirname, filePath);
    } else {
        // Try to find file in each directory
        const possiblePaths = [
            path.join(__dirname, 'screensy-website', filePath),
            path.join(__dirname, 'admin-dashboard', filePath),
            path.join(__dirname, 'device-client', filePath)
        ];
        
        // Use the first path that exists
        actualPath = possiblePaths.find(p => {
            try {
                require('fs').accessSync(p);
                return true;
            } catch {
                return false;
            }
        }) || path.join(__dirname, 'screensy-website', filePath);
    }
    
    // Get file extension
    const extname = path.extname(actualPath).toLowerCase();
    const contentType = mimeTypes[extname] || 'text/plain';
    
    // Check if file exists and serve it
    fs.readFile(actualPath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                // File not found
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end(`
                    <html>
                        <body>
                            <h1>404 - Seite nicht gefunden</h1>
                            <p>Die angeforderte Seite "${req.url}" wurde nicht gefunden.</p>
                            <p>Verfügbare Seiten:</p>
                            <ul>
                                <li><a href="/">Startseite</a></li>
                                <li><a href="/admin">Admin Dashboard</a></li>
                                <li><a href="/device">Device Client</a></li>
                            </ul>
                        </body>
                    </html>
                `);
            } else {
                // Server error
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Server Error: ' + err.code);
            }
        } else {
            // Success
            res.writeHead(200, { 
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            });
            res.end(content);
        }
    });
});

server.listen(PORT, () => {
    console.log(`🌐 HTTP Server läuft auf Port ${PORT}`);
    console.log(`📊 Admin Dashboard: http://localhost:${PORT}/admin`);
    console.log(`📱 Device Client: http://localhost:${PORT}/device`);
    console.log(`🏠 Hauptseite: http://localhost:${PORT}/`);
});

server.on('error', (err) => {
    console.error('❌ HTTP Server Fehler:', err);
});
