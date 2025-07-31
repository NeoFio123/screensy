const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

// Enhanced Server class
class EnhancedServer {
    constructor() {
        this.devices = new Map();
        this.admins = new Map();
        this.deviceRegistry = new Map();
        this.screensyClients = new Map();
        this.clients = new Map();
        this.sharingRequests = new Map();
    }

    handleAdminSharingRequest(message, socket) {
        const deviceId = message.deviceId;
        const targetScreen = message.targetScreen;
        
        console.log(`🎯 Admin requests sharing from device ${deviceId} to screen ${targetScreen}`);
        
        // Forward request to device
        const device = this.devices.get(deviceId);
        if (device && device.socket && device.socket.readyState === WebSocket.OPEN) {
            device.socket.send(JSON.stringify({
                type: 'sharing-request', // Korrigiert: sharing-request statt request-sharing
                targetScreen: targetScreen,
                requestId: `req_${Date.now()}`,
                timestamp: Date.now()
            }));
            console.log(`📤 Sharing request sent to device ${deviceId}`);
        } else {
            console.log(`❌ Device ${deviceId} not found or not connected`);
            socket.send(JSON.stringify({
                type: 'sharing-error',
                message: 'Device not available',
                deviceId: deviceId,
                timestamp: Date.now()
            }));
        }
    }

    handleSharingRequest(message, socket) {
        const deviceId = message.deviceId;
        const targetScreen = message.targetScreen;
        
        console.log(`🔄 Processing sharing request for device ${deviceId}`);
        
        // Store the request
        this.sharingRequests.set(deviceId, {
            targetScreen: targetScreen,
            adminSocket: socket,
            timestamp: Date.now()
        });
        
        // Forward to device
        const device = this.devices.get(deviceId);
        if (device && device.socket && device.socket.readyState === WebSocket.OPEN) {
            device.socket.send(JSON.stringify({
                type: 'sharing-request', // Korrigiert
                targetScreen: targetScreen,
                requestId: `req_${Date.now()}`,
                timestamp: Date.now()
            }));
        }
    }

    onScreensyConnection(socket) {
        const clientId = this.generateClientId();
        this.clients.set(clientId, socket);
        
        socket.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                this.handleScreensyMessage(clientId, message, socket);
            } catch (error) {
                console.error('❌ Invalid JSON:', error);
            }
        });

        socket.on('close', () => {
            this.clients.delete(clientId);
            console.log(`🔌 Screensy client ${clientId} disconnected`);
        });

        socket.on('error', (error) => {
            console.error('❌ Screensy WebSocket error:', error);
        });
    }

    onAdminConnection(socket) {
        const adminId = this.generateClientId();
        this.admins.set(adminId, socket);
        
        socket.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                this.handleAdminMessage(adminId, message, socket);
            } catch (error) {
                console.error('❌ Invalid JSON from admin:', error);
            }
        });

        socket.on('close', () => {
            this.admins.delete(adminId);
            console.log(`👨‍💼 Admin ${adminId} disconnected`);
        });

        socket.on('error', (error) => {
            console.error('❌ Admin WebSocket error:', error);
        });
    }

    onDeviceConnection(socket) {
        const deviceId = this.generateClientId();
        this.devices.set(deviceId, {
            socket: socket,
            info: null,
            registered: false
        });
        
        socket.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                this.handleDeviceMessage(deviceId, message, socket);
            } catch (error) {
                console.error('❌ Invalid JSON from device:', error);
            }
        });

        socket.on('close', () => {
            this.devices.delete(deviceId);
            this.deviceRegistry.delete(deviceId);
            console.log(`📱 Device ${deviceId} disconnected`);
            this.broadcastToAdmins({
                type: 'device-disconnected',
                deviceId: deviceId,
                timestamp: Date.now()
            });
        });

        socket.on('error', (error) => {
            console.error('❌ Device WebSocket error:', error);
        });
    }

    handleScreensyMessage(clientId, message, socket) {
        console.log(`📨 Screensy message from ${clientId}:`, message.type);
        // Handle original screensy messages here if needed
    }

    handleAdminMessage(adminId, message, socket) {
        console.log(`📨 Admin message from ${adminId}:`, message.type);
        
        switch (message.type) {
            case 'admin-connect':
                socket.send(JSON.stringify({
                    type: 'admin-connected',
                    adminId: adminId,
                    timestamp: Date.now()
                }));
                this.log(`✅ Admin ${adminId} connected`);
                this.sendDeviceList(socket);
                break;
            case 'get-devices':
            case 'request-device-list':
            case 'refresh-devices':
                this.sendDeviceList(socket);
                break;
            case 'request-sharing':
                this.handleAdminSharingRequest(message, socket);
                break;
            case 'sharing-request':
                this.handleSharingRequest(message, socket);
                break;
            case 'stop-sharing':
                this.forwardToDevice(message);
                break;
            case 'webrtc-answer':
            case 'webrtc-candidate':
                this.forwardToDevice(message);
                break;
            case 'admin-stream-offer':
            case 'admin-stream-answer': 
            case 'admin-ice-candidate':
                this.forwardToDevice(message);
                break;
            default:
                console.log('❓ Unknown admin message type:', message.type);
        }
    }

    handleDeviceMessage(deviceId, message, socket) {
        console.log(`📨 Device message from ${deviceId}:`, message.type);
        
        switch (message.type) {
            case 'register-device':
                this.registerDevice(deviceId, message, socket);
                break;
            case 'permission-response':
            case 'sharing-response':
                this.handleSharingResponse(deviceId, message);
                break;
            case 'webrtc-offer':
            case 'webrtc-candidate':
                message.deviceId = deviceId;
                this.forwardToAdmins(message);
                break;
            case 'stop-sharing':
                this.handleStopSharing(deviceId, message);
                break;
            default:
                console.log('❓ Unknown device message type:', message.type);
        }
    }

    registerDevice(deviceId, message, socket) {
        const deviceInfo = message.deviceInfo || {};
        
        const registrationData = {
            id: deviceId,
            name: deviceInfo.name || message.deviceName || `Device ${deviceId.slice(-8)}`,
            type: deviceInfo.type || message.deviceType || 'unknown',
            table: deviceInfo.table || message.table || 'unassigned',
            capabilities: deviceInfo.capabilities || {},
            userAgent: deviceInfo.userAgent || 'Unknown',
            registeredAt: new Date(),
            lastSeen: new Date(),
            status: 'online'
        };

        this.deviceRegistry.set(deviceId, registrationData);
        
        if (this.devices.has(deviceId)) {
            this.devices.get(deviceId).info = registrationData;
            this.devices.get(deviceId).registered = true;
        }

        socket.send(JSON.stringify({
            type: 'registration-success',
            deviceId: deviceId,
            assignedTable: registrationData.table,
            timestamp: Date.now()
        }));

        this.broadcastToAdmins({
            type: 'device-registered',
            device: registrationData,
            timestamp: Date.now()
        });

        console.log(`✅ Device registered: ${registrationData.name} (${deviceId}) at table ${registrationData.table}`);
    }

    sendDeviceList(socket) {
        const devices = Array.from(this.deviceRegistry.values());
        const message = {
            type: 'device-list',
            devices: devices,
            totalDevices: devices.length,
            onlineDevices: Array.from(this.devices.values()).filter(d => d.registered).length,
            timestamp: Date.now()
        };
        
        socket.send(JSON.stringify(message));
        console.log(`📋 Sent device list to admin: ${devices.length} devices`);
    }

    handleSharingResponse(deviceId, message) {
        console.log(`📱 Device ${deviceId} sharing response:`, message);
        
        // Forward response to admin
        this.broadcastToAdmins({
            type: 'sharing-response',
            deviceId: deviceId,
            allowed: message.allowed,
            approved: message.allowed,
            requestId: message.requestId,
            timestamp: Date.now()
        });
        
        if (message.allowed) {
            console.log(`✅ Sharing approved by device ${deviceId}`);
        } else {
            console.log(`❌ Sharing denied by device ${deviceId}`);
        }
    }

    handleStopSharing(deviceId, message) {
        this.broadcastToAdmins({
            type: 'sharing-stopped',
            deviceId: deviceId,
            timestamp: Date.now()
        });
    }

    forwardToAdmins(message) {
        this.admins.forEach((socket) => {
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify(message));
            }
        });
    }

    forwardToDevice(message) {
        const device = this.devices.get(message.deviceId);
        if (device && device.socket && device.socket.readyState === WebSocket.OPEN) {
            device.socket.send(JSON.stringify(message));
        }
    }

    broadcastToAdmins(message) {
        this.admins.forEach((socket) => {
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify(message));
            }
        });
    }

    generateClientId() {
        return 'client_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }

    log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = level === 'error' ? '❌' : level === 'warning' ? '⚠️' : level === 'success' ? '✅' : 'ℹ️';
        console.log(`${prefix} [${timestamp}] ${message}`);
    }
}

// Create server instance
const server = new EnhancedServer();

// Create WebSocket servers
const screensySocket = new WebSocket.Server({ port: 4000, host: '0.0.0.0' });
const adminSocket = new WebSocket.Server({ port: 4001, host: '0.0.0.0' });
const deviceSocket = new WebSocket.Server({ port: 4002, host: '0.0.0.0' });

// WebSocket connections
screensySocket.on("connection", (socket) => {
    console.log("🔌 New screensy connection");
    server.onScreensyConnection(socket);
});

adminSocket.on("connection", (socket) => {
    console.log("👨‍💼 New admin connection");
    server.onAdminConnection(socket);
});

deviceSocket.on("connection", (socket) => {
    console.log("📱 New device connection");
    server.onDeviceConnection(socket);
});

// HTTP Server functions
function getContentType(ext) {
    const contentTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.gif': 'image/gif',
        '.ico': 'image/x-icon'
    };
    return contentTypes[ext] || 'text/plain';
}

function handleRequest(req, res) {
    let filePath = '';
    
    // Parse URL to remove query parameters
    const url = new URL(req.url, `${req.connection.encrypted ? 'https' : 'http'}://${req.headers.host}`);
    const pathname = url.pathname;
    
    console.log(`📄 ${req.connection.encrypted ? 'HTTPS' : 'HTTP'} Request: ${req.method} ${pathname}`);
    
    // Route handling
    if (pathname === '/' || pathname === '/index.html') {
        filePath = path.join(__dirname, 'screensy-website/translations/en.html');
    } else if (pathname === '/admin' || pathname === '/admin/') {
        filePath = path.join(__dirname, 'admin-dashboard/index.html');
    } else if (pathname === '/device' || pathname === '/device/') {
        filePath = path.join(__dirname, 'device-client/index.html');
    } else if (pathname === '/favicon.ico') {
        res.writeHead(204);
        res.end();
        return;
    } else if (pathname.startsWith('/admin-dashboard/')) {
        filePath = path.join(__dirname, pathname.substring(1));
    } else if (pathname.startsWith('/device-client/')) {
        if (pathname === '/device-client/' || pathname === '/device-client') {
            filePath = path.join(__dirname, 'device-client/index.html');
        } else {
            filePath = path.join(__dirname, pathname.substring(1));
        }
    } else if (pathname.startsWith('/screensy-website/')) {
        filePath = path.join(__dirname, pathname.substring(1));
    } else {
        filePath = path.join(__dirname, 'screensy-website', pathname);
    }

    console.log(`📁 Resolved file path: ${filePath}`);

    // Security check
    const rootDir = path.resolve(__dirname);
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(rootDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    // Check if file exists
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            console.log(`❌ File not found: ${filePath}`);
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end(`<h1>404 - Not Found</h1><p>File not found: ${req.url}</p>`);
            return;
        }

        // Read and serve file
        fs.readFile(filePath, (err, data) => {
            if (err) {
                console.log(`❌ Error reading file: ${filePath}`, err);
                res.writeHead(500, { 'Content-Type': 'text/html' });
                res.end(`<h1>500 - Internal Server Error</h1><p>Error reading file: ${req.url}</p>`);
                return;
            }

            const ext = path.extname(filePath);
            const contentType = getContentType(ext);
            
            console.log(`✅ Serving file: ${filePath} (${contentType})`);
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
        });
    });
}

// Try to create HTTPS server with self-signed certificate
function createHttpsServer() {
    try {
        // Try to read existing certificate
        const key = fs.readFileSync(path.join(__dirname, 'server.key'));
        const cert = fs.readFileSync(path.join(__dirname, 'server.crt'));
        
        const httpsServer = https.createServer({ key, cert }, handleRequest);
        return httpsServer;
    } catch (error) {
        console.log('📋 HTTPS certificate not found, creating self-signed certificate...');
        
        // Create self-signed certificate using OpenSSL (if available)
        const { execSync } = require('child_process');
        try {
            execSync(`openssl req -x509 -newkey rsa:4096 -keyout server.key -out server.crt -days 365 -nodes -subj "/C=DE/ST=State/L=City/O=Organization/CN=localhost"`, { cwd: __dirname });
            
            const key = fs.readFileSync(path.join(__dirname, 'server.key'));
            const cert = fs.readFileSync(path.join(__dirname, 'server.crt'));
            
            const httpsServer = https.createServer({ key, cert }, handleRequest);
            return httpsServer;
        } catch (opensslError) {
            console.log('❌ OpenSSL not available, falling back to HTTP only');
            return null;
        }
    }
}

// Start servers
const HTTP_PORT = 8080;
const HTTPS_PORT = 8443;

// Create HTTP server
const httpServer = http.createServer(handleRequest);

// Try to create HTTPS server
const httpsServer = createHttpsServer();

// Start HTTP server
httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
    // Get local IP address
    const os = require('os');
    const networkInterfaces = os.networkInterfaces();
    let localIP = 'localhost';
    
    for (const interfaceName of Object.keys(networkInterfaces)) {
        const addresses = networkInterfaces[interfaceName];
        for (const addr of addresses) {
            if (addr.family === 'IPv4' && !addr.internal) {
                localIP = addr.address;
                break;
            }
        }
        if (localIP !== 'localhost') break;
    }
    
    console.log('🚀 Shop Screensharing Server gestartet:');
    console.log(`📡 HTTP Server: http://localhost:${HTTP_PORT}`);
    console.log(`📡 Netzwerk HTTP: http://${localIP}:${HTTP_PORT}`);
    
    if (httpsServer) {
        httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
            console.log(`🔒 HTTPS Server: https://localhost:${HTTPS_PORT}`);
            console.log(`🔒 Netzwerk HTTPS: https://${localIP}:${HTTPS_PORT}`);
        });
    }
    
    console.log('🔌 WebSocket Servers:');
    console.log('   - Screensy: ws://localhost:4000');
    console.log('   - Admin: ws://localhost:4001'); 
    console.log('   - Device: ws://localhost:4002');
    console.log('');
    console.log('🌐 System bereit!');
    console.log(`📋 Computer HTTP: http://localhost:${HTTP_PORT}`);
    if (httpsServer) {
        console.log(`🔒 Computer HTTPS: https://localhost:${HTTPS_PORT}`);
        console.log(`🔒 Handy/Tablet HTTPS: https://${localIP}:${HTTPS_PORT}`);
        console.log(`🔧 Admin Dashboard (HTTPS): https://${localIP}:${HTTPS_PORT}/admin`);
        console.log(`📱 Device Client (HTTPS): https://${localIP}:${HTTPS_PORT}/device`);
    }
    console.log(`📱 Handy/Tablet HTTP: http://${localIP}:${HTTP_PORT}`);
    console.log(`🔧 Admin Dashboard: http://${localIP}:${HTTP_PORT}/admin`);
    console.log(`📱 Device Client: http://${localIP}:${HTTP_PORT}/device`);
    console.log('');
    console.log('💡 Tipps:');
    console.log('   - Für Screen Sharing verwenden Sie HTTPS (Port 8443)');
    console.log('   - Bei HTTPS Warnung: "Erweitert" → "Weiter zu localhost"');
    console.log('   - HTTP funktioniert für Registrierung, HTTPS für Screen Sharing');
    console.log('');
    console.log('🛑 Zum Stoppen: Ctrl+C drücken');
});

// Error handling
httpServer.on('error', (error) => {
    console.error('❌ HTTP Server error:', error);
});

if (httpsServer) {
    httpsServer.on('error', (error) => {
        console.error('❌ HTTPS Server error:', error);
    });
}

screensySocket.on("error", (error) => console.error("❌ Screensy WebSocket error:", error));
adminSocket.on("error", (error) => console.error("❌ Admin WebSocket error:", error));
deviceSocket.on("error", (error) => console.error("❌ Device WebSocket error:", error));

console.log("Enhanced HTTPS Screensy Server starting...");
