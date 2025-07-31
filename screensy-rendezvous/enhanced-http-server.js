const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

// Enhanced Server class (same as shop-server.js)
class EnhancedServer {
    constructor() {
        this.devices = new Map();
        this.admins = new Map();
        this.deviceRegistry = new Map();
        this.screensyClients = new Map();
        
        this.createServers();
    }

    handleAdminSharingRequest(message, socket) {
        const deviceId = message.deviceId;
        const targetScreen = message.targetScreen;
        
        console.log(`🎯 Admin requests sharing from device ${deviceId} to screen ${targetScreen}`);
        
        // Forward request to device
        const device = this.devices.get(deviceId);
        if (device && device.socket && device.socket.readyState === WebSocket.OPEN) {
            device.socket.send(JSON.stringify({
                type: 'request-sharing',
                targetScreen: targetScreen,
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
                type: 'request-sharing',
                targetScreen: targetScreen,
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
                // Admin connection acknowledgment
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

    handleAdminSharingRequest(message, socket) {
        const deviceId = message.deviceId;
        const targetScreen = message.targetScreen;
        
        console.log(`🎯 Admin requests sharing from device ${deviceId} to screen ${targetScreen}`);
        
        // Forward request to device
        const device = this.devices.get(deviceId);
        if (device && device.socket && device.socket.readyState === WebSocket.OPEN) {
            device.socket.send(JSON.stringify({
                type: 'request-sharing',
                targetScreen: targetScreen,
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

    handleDeviceMessage(deviceId, message, socket) {
        console.log(`📨 Device message from ${deviceId}:`, message.type);
        
        switch (message.type) {
            case 'register-device':
                this.registerDevice(deviceId, message, socket);
                break;
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
        // Extract device info from the message
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

    handleSharingRequest(message, adminSocket) {
        const deviceId = message.deviceId;
        const device = this.devices.get(deviceId);
        
        if (device && device.socket) {
            device.socket.send(JSON.stringify({
                type: 'sharing-request',
                requestId: message.requestId,
                requestedBy: 'admin',
                timestamp: Date.now()
            }));
            
            this.sharingRequests.set(message.requestId, {
                adminSocket: adminSocket,
                deviceId: deviceId,
                timestamp: Date.now()
            });
        }
    }

    handleSharingResponse(deviceId, message) {
        const request = this.sharingRequests.get(message.requestId);
        if (request && request.adminSocket) {
            request.adminSocket.send(JSON.stringify({
                type: 'sharing-response',
                deviceId: deviceId,
                approved: message.approved,
                requestId: message.requestId,
                timestamp: Date.now()
            }));
            
            if (message.approved) {
                console.log(`✅ Sharing approved by device ${deviceId}`);
            } else {
                console.log(`❌ Sharing denied by device ${deviceId}`);
            }
        }
        this.sharingRequests.delete(message.requestId);
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

// HTTP Server Setup
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

// HTTP Server for static files
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

const httpServer = http.createServer((req, res) => {
    let filePath = '';
    
    // Parse URL to remove query parameters
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    
    console.log(`📄 HTTP Request: ${req.method} ${pathname}`);
    
    // Route handling
    if (pathname === '/' || pathname === '/index.html') {
        // Serve main screensy page
        filePath = path.join(__dirname, '../screensy-website/translations/en.html');
    } else if (pathname === '/admin' || pathname === '/admin/') {
        // Serve admin dashboard
        filePath = path.join(__dirname, '../admin-dashboard/index.html');
    } else if (pathname === '/device' || pathname === '/device/') {
        // Serve device client
        filePath = path.join(__dirname, '../device-client/index.html');
    } else if (pathname.startsWith('/admin-dashboard/')) {
        // Serve admin dashboard static files
        filePath = path.join(__dirname, '..', pathname);
    } else if (pathname.startsWith('/device-client/')) {
        // Serve device client static files - handle both with and without trailing slash
        if (pathname === '/device-client/' || pathname === '/device-client') {
            filePath = path.join(__dirname, '../device-client/index.html');
        } else {
            filePath = path.join(__dirname, '..', pathname);
        }
    } else if (pathname.startsWith('/screensy-website/')) {
        // Serve screensy website static files
        filePath = path.join(__dirname, '..', pathname);
    } else {
        // Try to serve from screensy-website directory
        filePath = path.join(__dirname, '../screensy-website', pathname);
    }

    console.log(`📁 Resolved file path: ${filePath}`);

    // Security check - prevent directory traversal
    const rootDir = path.join(__dirname, '..');
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(path.resolve(rootDir))) {
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
});

// Start HTTP server
const HTTP_PORT = 8080;
httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
    console.log('🚀 Shop Screensharing Server gestartet:');
    console.log(`📡 HTTP Server: http://localhost:${HTTP_PORT}`);
    console.log('🔌 WebSocket Servers:');
    console.log('   - Screensy: ws://localhost:4000');
    console.log('   - Admin: ws://localhost:4001'); 
    console.log('   - Device: ws://localhost:4002');
    console.log('📋 Öffnen Sie http://localhost:8080 in Ihrem Browser');
    console.log('');
    console.log('🌐 System bereit!');
    console.log(`📋 Öffnen Sie: http://localhost:${HTTP_PORT}`);
    console.log(`🔧 Für lokales Netzwerk: http://[IHRE-IP]:${HTTP_PORT}`);
    console.log('⚡ WebSocket läuft auf Port: 4000-4002');
    console.log('');
    console.log('💡 Tipps:');
    console.log(`   - Stellen Sie sicher, dass Port ${HTTP_PORT} und 4000-4002 frei sind`);
    console.log('   - Für Smartphones: Verwenden Sie die IP-Adresse Ihres PCs');
    console.log('   - Firewall-Einstellungen prüfen für lokales Netzwerk');
    console.log('');
    console.log('🛑 Zum Stoppen: Ctrl+C drücken');
});

// Error handling
httpServer.on('error', (error) => {
    console.error('❌ HTTP Server error:', error);
});

screensySocket.on("error", (error) => console.error("❌ Screensy WebSocket error:", error));
adminSocket.on("error", (error) => console.error("❌ Admin WebSocket error:", error));
deviceSocket.on("error", (error) => console.error("❌ Device WebSocket error:", error));

console.log("Enhanced Screensy Server starting...");
