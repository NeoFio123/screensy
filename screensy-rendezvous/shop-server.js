"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const WebSocket = __importStar(require("ws"));
function main() {
    // Create three WebSocket servers
    const screensySocket = new WebSocket.Server({ port: 4000, host: '0.0.0.0' });
    const adminSocket = new WebSocket.Server({ port: 4001, host: '0.0.0.0' });
    const deviceSocket = new WebSocket.Server({ port: 4002, host: '0.0.0.0' });
    
    // Add error handling
    screensySocket.on("error", (error) => console.error("❌ Screensy WebSocket error:", error));
    adminSocket.on("error", (error) => console.error("❌ Admin WebSocket error:", error));
    deviceSocket.on("error", (error) => console.error("❌ Device WebSocket error:", error));
    const server = new EnhancedServer();
    // Original screensy WebSocket handling
    screensySocket.on("connection", (socket) => {
        console.log("🔌 New screensy connection");
        server.onScreensyConnection(socket);
    });
    // Admin dashboard WebSocket handling
    adminSocket.on("connection", (socket) => {
        console.log("👨‍💼 New admin connection");
        server.onAdminConnection(socket);
    });
    // Device client WebSocket handling
    deviceSocket.on("connection", (socket) => {
        console.log("📱 New device connection");
        server.onDeviceConnection(socket);
    });
    console.log("Enhanced Screensy Server started:");
    console.log("- Screensy port: 4000");
    console.log("- Admin dashboard port: 4001");
    console.log("- Device client port: 4002");
}
class EnhancedServer {
    constructor() {
        this.screensyRooms = new Map();
        this.adminConnections = new Set();
        this.registeredDevices = new Map();
        this.activeSharingSessions = new Map();
        this.pendingPermissionRequests = new Map();
    }
    onScreensyConnection(socket) {
        socket.on('message', (data) => {
            var _a;
            let message;
            try {
                message = JSON.parse(data.toString());
            }
            catch (e) {
                return;
            }
            if (message.type !== "join") {
                return;
            }
            const roomId = message.roomId;
            if (!roomId || roomId.length < 1) {
                return;
            }
            if (this.screensyRooms.has(roomId)) {
                (_a = this.screensyRooms.get(roomId)) === null || _a === void 0 ? void 0 : _a.addViewer(socket);
            }
            else {
                this.newScreensyRoom(roomId, socket);
            }
        });
    }
    onAdminConnection(socket) {
        this.adminConnections.add(socket);
        this.log("Admin connected");
        socket.on('message', (data) => {
            this.handleAdminMessage(socket, data);
        });
        socket.on('close', () => {
            this.adminConnections.delete(socket);
            this.log("Admin disconnected");
        });
        this.sendDeviceListToAdmin(socket);
    }
    onDeviceConnection(socket) {
        this.log("Device connected");
        socket.on('message', (data) => {
            this.handleDeviceMessage(socket, data);
        });
        socket.on('close', () => {
            for (const [deviceId, device] of this.registeredDevices) {
                if (device.socket === socket) {
                    device.status = "offline";
                    this.broadcastToAdmins({
                        type: "device-status",
                        deviceId: deviceId,
                        status: "offline",
                        timestamp: Date.now()
                    });
                    break;
                }
            }
            this.log("Device disconnected");
        });
    }
    handleAdminMessage(socket, data) {
        let message;
        try {
            message = JSON.parse(data.toString());
        }
        catch (e) {
            return;
        }
        this.log(`Admin message: ${message.type}`);
        switch (message.type) {
            case "admin-connect":
                this.sendDeviceListToAdmin(socket);
                break;
            case "request-device-list":
                this.sendDeviceListToAdmin(socket);
                break;
            case "request-sharing":
                this.handleSharingRequest(socket, message);
                break;
            case "stop-sharing":
                this.handleStopSharingRequest(socket, message);
                break;
            case "webrtc-offer":
            case "webrtc-answer":
            case "webrtc-candidate":
                this.handleAdminWebRTC(message);
                break;
        }
    }
    handleDeviceMessage(socket, data) {
        let message;
        try {
            message = JSON.parse(data.toString());
        }
        catch (e) {
            return;
        }
        this.log(`Device message: ${message.type}`);
        switch (message.type) {
            case "register-device":
                this.handleDeviceRegistration(socket, message);
                break;
            case "permission-response":
                this.handleDevicePermissionResponse(socket, message);
                break;
            case "webrtc-offer":
            case "webrtc-answer":
            case "webrtc-candidate":
                this.handleDeviceWebRTC(socket, message);
                break;
            case "stop-sharing":
                this.handleDeviceStopSharing(socket, message);
                break;
        }
    }
    handleDeviceRegistration(socket, message) {
        const deviceId = this.generateDeviceId(message.deviceInfo.table);
        const device = {
            id: deviceId,
            info: message.deviceInfo,
            socket: socket,
            status: "online",
            lastSeen: Date.now()
        };
        this.registeredDevices.set(deviceId, device);
        this.sendToDevice(socket, {
            type: "registration-success",
            deviceId: deviceId,
            timestamp: Date.now()
        });
        this.broadcastToAdmins({
            type: "device-registered",
            deviceId: deviceId,
            deviceInfo: {
                id: deviceId,
                name: message.deviceInfo.name,
                type: message.deviceInfo.type,
                table: message.deviceInfo.table,
                capabilities: message.deviceInfo.capabilities,
                userAgent: message.deviceInfo.userAgent,
                status: 'online',
                lastSeen: new Date()
            },
            timestamp: Date.now()
        });
        this.log(`Device registered: ${deviceId} (${message.deviceInfo.name})`);
    }
    handleSharingRequest(adminSocket, message) {
        const device = this.registeredDevices.get(message.deviceId);
        if (!device) {
            this.sendToAdmin(adminSocket, {
                type: "sharing-error",
                error: "Device not found",
                deviceId: message.deviceId,
                timestamp: Date.now()
            });
            return;
        }
        const requestId = this.generateRequestId();
        this.pendingPermissionRequests.set(requestId, {
            adminSocket: adminSocket,
            deviceId: message.deviceId,
            screenId: message.screenId,
            timestamp: Date.now()
        });
        this.sendToDevice(device.socket, {
            type: "sharing-request",
            requestId: requestId,
            screenId: message.screenId,
            timestamp: Date.now()
        });
        this.log(`Sharing request sent to device ${message.deviceId}`);
    }
    handleDevicePermissionResponse(socket, message) {
        const request = this.pendingPermissionRequests.get(message.requestId);
        if (!request) {
            return;
        }
        this.pendingPermissionRequests.delete(message.requestId);
        if (message.allowed) {
            const sharingSession = {
                deviceId: request.deviceId,
                screenId: request.screenId,
                startTime: Date.now(),
                adminSocket: request.adminSocket,
                deviceSocket: socket
            };
            this.activeSharingSessions.set(request.deviceId, sharingSession);
            this.sendToAdmin(request.adminSocket, {
                type: "sharing-approved",
                deviceId: request.deviceId,
                screenId: request.screenId,
                timestamp: Date.now()
            });
            this.log(`Sharing approved for device ${request.deviceId}`);
        }
        else {
            this.sendToAdmin(request.adminSocket, {
                type: "sharing-denied",
                deviceId: request.deviceId,
                screenId: request.screenId,
                timestamp: Date.now()
            });
            this.log(`Sharing denied for device ${request.deviceId}`);
        }
    }
    handleAdminWebRTC(message) {
        const device = this.registeredDevices.get(message.deviceId);
        if (!device) {
            return;
        }
        this.sendToDevice(device.socket, {
            type: message.type,
            offer: message.offer,
            answer: message.answer,
            candidate: message.candidate,
            timestamp: Date.now()
        });
    }
    handleDeviceWebRTC(socket, message) {
        let deviceId = null;
        for (const [id, device] of this.registeredDevices) {
            if (device.socket === socket) {
                deviceId = id;
                break;
            }
        }
        if (!deviceId) {
            return;
        }
        const sharingSession = this.activeSharingSessions.get(deviceId);
        if (!sharingSession) {
            return;
        }
        this.sendToAdmin(sharingSession.adminSocket, {
            type: message.type,
            deviceId: deviceId,
            offer: message.offer,
            answer: message.answer,
            candidate: message.candidate,
            timestamp: Date.now()
        });
    }
    handleStopSharingRequest(adminSocket, message) {
        const sharingSession = this.activeSharingSessions.get(message.deviceId);
        if (!sharingSession) {
            return;
        }
        this.sendToDevice(sharingSession.deviceSocket, {
            type: "stop-sharing",
            timestamp: Date.now()
        });
        this.activeSharingSessions.delete(message.deviceId);
        this.log(`Sharing stopped for device ${message.deviceId}`);
    }
    handleDeviceStopSharing(socket, message) {
        let deviceId = null;
        for (const [id, device] of this.registeredDevices) {
            if (device.socket === socket) {
                deviceId = id;
                break;
            }
        }
        if (!deviceId) {
            return;
        }
        const sharingSession = this.activeSharingSessions.get(deviceId);
        if (sharingSession) {
            this.sendToAdmin(sharingSession.adminSocket, {
                type: "sharing-stopped",
                deviceId: deviceId,
                timestamp: Date.now()
            });
            this.activeSharingSessions.delete(deviceId);
        }
        this.log(`Device ${deviceId} stopped sharing`);
    }
    sendDeviceListToAdmin(adminSocket) {
        const deviceList = Array.from(this.registeredDevices.values()).map(device => ({
            id: device.id,
            info: device.info,
            status: device.status,
            lastSeen: device.lastSeen
        }));
        this.sendToAdmin(adminSocket, {
            type: "device-list",
            devices: deviceList,
            timestamp: Date.now()
        });
    }
    broadcastToAdmins(message) {
        const messageStr = JSON.stringify(message);
        this.adminConnections.forEach(socket => {
            if (socket.readyState === 1) { // WebSocket.OPEN
                socket.send(messageStr);
            }
        });
    }
    sendToAdmin(socket, message) {
        if (socket.readyState === 1) { // WebSocket.OPEN
            socket.send(JSON.stringify(message));
        }
    }
    sendToDevice(socket, message) {
        if (socket.readyState === 1) { // WebSocket.OPEN
            socket.send(JSON.stringify(message));
        }
    }
    generateDeviceId(table) {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 5);
        return `device-${table}-${timestamp}-${random}`;
    }
    generateRequestId() {
        return 'req-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 5);
    }
    newScreensyRoom(roomId, broadcaster) {
        if (this.screensyRooms.has(roomId)) {
            throw new Error("Room already exists");
        }
        const room = new ScreensyRoom(broadcaster);
        this.screensyRooms.set(roomId, room);
        broadcaster.on('close', () => {
            this.screensyRooms.delete(roomId);
        });
    }
    log(message) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] ${message}`);
    }
}
class ScreensyRoom {
    constructor(broadcaster) {
        this.counter = 0;
        this.viewers = {};
        this.broadcaster = broadcaster;
        broadcaster.on('message', (data) => {
            let message;
            try {
                message = JSON.parse(data.toString());
            }
            catch (e) {
                return;
            }
            this.handleBroadcasterMessage(message);
        });
        broadcaster.send(JSON.stringify({ type: "broadcast" }));
    }
    handleBroadcasterMessage(msg) {
        switch (msg.type) {
            case "webrtcbroadcaster":
                const viewer = this.viewers[msg.viewerId];
                if (viewer) {
                    viewer.send(JSON.stringify({
                        type: "webrtcviewer",
                        kind: msg.kind,
                        message: msg.message,
                    }));
                }
                break;
            case "requestviewers":
                for (const viewerId in this.viewers) {
                    this.broadcaster.send(JSON.stringify({
                        type: "viewer",
                        viewerId: viewerId,
                    }));
                }
                break;
        }
    }
    addViewer(viewer) {
        const id = (this.counter++).toString();
        viewer.on('message', (data) => {
            let message;
            try {
                message = JSON.parse(data.toString());
            }
            catch (e) {
                return;
            }
            this.handleViewerMessage(id, message);
        });
        viewer.on('close', () => {
            this.handleViewerDisconnect(id);
        });
        viewer.send(JSON.stringify({ type: "view" }));
        this.broadcaster.send(JSON.stringify({
            type: "viewer",
            viewerId: id,
        }));
        this.viewers[id] = viewer;
    }
    handleViewerMessage(viewerId, msg) {
        if (msg.type === "webrtcviewer") {
            this.broadcaster.send(JSON.stringify({
                type: "webrtcbroadcaster",
                kind: msg.kind,
                message: msg.message,
                viewerId: viewerId,
            }));
        }
    }
    handleViewerDisconnect(viewerId) {
        if (this.viewers[viewerId]) {
            delete this.viewers[viewerId];
            this.broadcaster.send(JSON.stringify({
                type: "viewerdisconnected",
                viewerId: viewerId,
            }));
        }
    }
}
main();
