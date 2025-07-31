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

    // ... (alle anderen Methoden bleiben gleich - ich kopiere sie für Vollständigkeit)
    handleAdminSharingRequest(message, socket) {
        const deviceId = message.deviceId;
        const targetScreen = message.targetScreen;
        
        console.log(`🎯 Admin requests sharing from device ${deviceId} to screen ${targetScreen}`);
        
        const device = this.devices.get(deviceId);
        if (device && device.socket && device.socket.readyState === WebSocket.OPEN) {
            device.socket.send(JSON.stringify({
                type: 'sharing-request',
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
            console.log(`🔌 Client ${clientId} disconnected`);
        });

        socket.on('error', (error) => {
            console.error('❌ WebSocket error:', error);
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
            case 'webrtc-answer':
            case 'webrtc-candidate':
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

// Create HTTP server
const httpServer = http.createServer(handleRequest);

// Create HTTPS server with WebSocket support
let httpsServer = null;
try {
    const key = fs.readFileSync(path.join(__dirname, 'server.key'));
    const cert = fs.readFileSync(path.join(__dirname, 'server.crt'));
    httpsServer = https.createServer({ key, cert }, handleRequest);
} catch (error) {
    console.log('❌ HTTPS certificate not found');
}

// Create regular WebSocket servers (for HTTP)
const regularWSS = {
    admin: new WebSocket.Server({ port: 4001, host: '0.0.0.0' }),
    device: new WebSocket.Server({ port: 4002, host: '0.0.0.0' })
};

// Create secure WebSocket servers (for HTTPS)
let secureWSS = null;
if (httpsServer) {
    try {
        const key = fs.readFileSync(path.join(__dirname, 'server.key'));
        const cert = fs.readFileSync(path.join(__dirname, 'server.crt'));
        
        // Create separate HTTPS servers for WebSocket upgrades
        const adminHTTPS = https.createServer({ key, cert });
        const deviceHTTPS = https.createServer({ key, cert });
        
        secureWSS = {
            admin: new WebSocket.Server({ server: adminHTTPS }),
            device: new WebSocket.Server({ server: deviceHTTPS })
        };
        
        // Start HTTPS servers for WebSocket
        adminHTTPS.listen(5001, '0.0.0.0', () => {
            console.log('🔒 Secure Admin WebSocket server listening on port 5001');
        });
        
        deviceHTTPS.listen(5002, '0.0.0.0', () => {
            console.log('🔒 Secure Device WebSocket server listening on port 5002');
        });
        
    } catch (error) {
        console.log('❌ Could not create secure WebSocket servers:', error.message);
    }
}

// Setup WebSocket connection handlers
function setupWebSocketHandlers(wss, type) {
    wss.on('connection', (socket, req) => {
        const clientIP = req.socket.remoteAddress;
        const isSecure = req.connection.encrypted;
        console.log(`${type} ${isSecure ? '🔒' : '🔌'} New ${type.toLowerCase()} connection from ${clientIP}`);
        
        if (type === 'Admin') {
            server.onAdminConnection(socket);
        } else if (type === 'Device') {
            server.onDeviceConnection(socket);
        }
    });
    
    wss.on('error', (error) => {
        console.error(`❌ ${type} WebSocket error:`, error);
    });
}

// Setup regular WebSocket handlers
setupWebSocketHandlers(regularWSS.admin, 'Admin');
setupWebSocketHandlers(regularWSS.device, 'Device');

// Setup secure WebSocket handlers if available
if (secureWSS) {
    setupWebSocketHandlers(secureWSS.admin, 'Admin');
    setupWebSocketHandlers(secureWSS.device, 'Device');
}

// Start servers
const HTTP_PORT = 8080;
const HTTPS_PORT = 8443;

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
    console.log('   - Regular Admin: ws://localhost:4001 (für HTTP)');
    console.log('   - Regular Device: ws://localhost:4002 (für HTTP)');
    
    if (secureWSS) {
        console.log('🔒 Secure WebSocket Servers:');
        console.log('   - Secure Admin: wss://localhost:5001 (für HTTPS)');
        console.log('   - Secure Device: wss://localhost:5002 (für HTTPS)');
    }
    
    console.log('');
    console.log('🌐 System bereit!');
    console.log(`📋 HTTP: http://${localIP}:${HTTP_PORT}`);
    if (httpsServer) {
        console.log(`🔒 HTTPS: https://${localIP}:${HTTPS_PORT}`);
        console.log(`🔧 Admin Dashboard (HTTPS): https://${localIP}:${HTTPS_PORT}/admin`);
        console.log(`📱 Device Client (HTTPS): https://${localIP}:${HTTPS_PORT}/device`);
    }
    console.log('');
    console.log('💡 Mixed Content Problem gelöst:');
    console.log('   - HTTPS-Seiten verwenden WSS (sichere WebSockets)');
    console.log('   - HTTP-Seiten verwenden WS (normale WebSockets)');
    console.log('   - Automatische Protokoll-Erkennung implementiert');
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

console.log("🚀 Enhanced HTTPS+WSS Screensy Server starting with Mixed Content fix...");
