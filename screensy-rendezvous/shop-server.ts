import * as WebSocket from "ws";

interface RegisteredDevice {
    id: string;
    info: any;
    socket: any;
    status: string;
    lastSeen: number;
}

function main(): void {
    // Create three WebSocket servers
    const screensySocket = new WebSocket.Server({ port: 4000 });
    const adminSocket = new WebSocket.Server({ port: 4001 });
    const deviceSocket = new WebSocket.Server({ port: 4002 });
    
    const server = new EnhancedServer();

    // Original screensy WebSocket handling
    screensySocket.on("connection", (socket: any) => server.onScreensyConnection(socket));
    
    // Admin dashboard WebSocket handling
    adminSocket.on("connection", (socket: any) => server.onAdminConnection(socket));
    
    // Device client WebSocket handling
    deviceSocket.on("connection", (socket: any) => server.onDeviceConnection(socket));

    console.log("Enhanced Screensy Server started:");
    console.log("- Screensy port: 4000");
    console.log("- Admin dashboard port: 4001"); 
    console.log("- Device client port: 4002");
}

class EnhancedServer {
    private screensyRooms = new Map<string, any>();
    private adminConnections = new Set<any>();
    private registeredDevices = new Map<string, RegisteredDevice>();
    private activeSharingSessions = new Map<string, any>();
    private pendingPermissionRequests = new Map<string, any>();

    onScreensyConnection(socket: any): void {
        socket.on('message', (data: any) => {
            let message;
            try {
                message = JSON.parse(data.toString());
            } catch (e) {
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
                this.screensyRooms.get(roomId)?.addViewer(socket);
            } else {
                this.newScreensyRoom(roomId, socket);
            }
        });
    }

    onAdminConnection(socket: any): void {
        this.adminConnections.add(socket);
        this.log("Admin connected");

        socket.on('message', (data: any) => {
            this.handleAdminMessage(socket, data);
        });

        socket.on('close', () => {
            this.adminConnections.delete(socket);
            this.log("Admin disconnected");
        });

        this.sendDeviceListToAdmin(socket);
    }

    onDeviceConnection(socket: any): void {
        this.log("Device connected");

        socket.on('message', (data: any) => {
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

    handleAdminMessage(socket: any, data: any): void {
        let message;
        try {
            message = JSON.parse(data.toString());
        } catch (e) {
            return;
        }

        this.log(`Admin message: ${message.type}`);

        switch (message.type) {
            case "admin-connect":
                this.sendDeviceListToAdmin(socket);
                break;
            case "request-sharing":
                this.handleSharingRequest(socket, message);
                break;
            case "stop-sharing":
                this.handleStopSharingRequest(socket, message);
                break;
            case "admin-request-stream":
                this.handleAdminStreamRequest(message);
                break;
            case "admin-stream-answer":
                this.forwardAdminStreamAnswer(message);
                break;
            case "admin-ice-candidate":
                this.forwardAdminIceCandidate(message);
                break;
            case "webrtc-offer":
            case "webrtc-answer":
            case "webrtc-candidate":
                this.handleAdminWebRTC(message);
                break;
        }
    }

    handleDeviceMessage(socket: any, data: any): void {
        let message;
        try {
            message = JSON.parse(data.toString());
        } catch (e) {
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

    handleDeviceRegistration(socket: any, message: any): void {
        const deviceId = this.generateDeviceId(message.deviceInfo.table);
        
        const device: RegisteredDevice = {
            id: deviceId,
            info: message.deviceInfo,
            socket: socket,
            status: "online",
            lastSeen: Date.now()
        };

        this.registeredDevices.set(deviceId, device);

        this.sendToDevice(socket, {
            type: "device-registered",
            deviceId: deviceId,
            timestamp: Date.now()
        });

        this.broadcastToAdmins({
            type: "device-registered",
            deviceId: deviceId,
            deviceInfo: message.deviceInfo,
            timestamp: Date.now()
        });

        this.log(`Device registered: ${deviceId} (${message.deviceInfo.name})`);
    }

    handleSharingRequest(adminSocket: any, message: any): void {
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

    handleDevicePermissionResponse(socket: any, message: any): void {
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
        } else {
            this.sendToAdmin(request.adminSocket, {
                type: "sharing-denied",
                deviceId: request.deviceId,
                screenId: request.screenId,
                timestamp: Date.now()
            });

            this.log(`Sharing denied for device ${request.deviceId}`);
        }
    }

    handleAdminWebRTC(message: any): void {
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

    handleDeviceWebRTC(socket: any, message: any): void {
        let deviceId: string | null = null;
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

    handleStopSharingRequest(adminSocket: any, message: any): void {
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

    handleDeviceStopSharing(socket: any, message: any): void {
        let deviceId: string | null = null;
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

    sendDeviceListToAdmin(adminSocket: any): void {
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

    broadcastToAdmins(message: any): void {
        const messageStr = JSON.stringify(message);
        this.adminConnections.forEach(socket => {
            if (socket.readyState === 1) { // WebSocket.OPEN
                socket.send(messageStr);
            }
        });
    }

    sendToAdmin(socket: any, message: any): void {
        if (socket.readyState === 1) { // WebSocket.OPEN
            socket.send(JSON.stringify(message));
        }
    }

    sendToDevice(socket: any, message: any): void {
        if (socket.readyState === 1) { // WebSocket.OPEN
            socket.send(JSON.stringify(message));
        }
    }

    generateDeviceId(table: string): string {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 5);
        return `device-${table}-${timestamp}-${random}`;
    }

    generateRequestId(): string {
        return 'req-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 5);
    }

    newScreensyRoom(roomId: string, broadcaster: any): void {
        if (this.screensyRooms.has(roomId)) {
            throw new Error("Room already exists");
        }

        const room = new ScreensyRoom(broadcaster);
        this.screensyRooms.set(roomId, room);
        
        broadcaster.on('close', () => {
            this.screensyRooms.delete(roomId);
        });
    }

    log(message: string): void {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] ${message}`);
    }
}

class ScreensyRoom {
    private counter: number = 0;
    private broadcaster: any;
    private viewers: { [id: string]: any } = {};

    constructor(broadcaster: any) {
        this.broadcaster = broadcaster;

        broadcaster.on('message', (data: any) => {
            let message;
            try {
                message = JSON.parse(data.toString());
            } catch (e) {
                return;
            }
            this.handleBroadcasterMessage(message);
        });

        broadcaster.send(JSON.stringify({ type: "broadcast" }));
    }

    handleBroadcasterMessage(msg: any): void {
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

    addViewer(viewer: any): void {
        const id = (this.counter++).toString();

        viewer.on('message', (data: any) => {
            let message;
            try {
                message = JSON.parse(data.toString());
            } catch (e) {
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

    handleViewerMessage(viewerId: string, msg: any): void {
        if (msg.type === "webrtcviewer") {
            this.broadcaster.send(JSON.stringify({
                type: "webrtcbroadcaster",
                kind: msg.kind,
                message: msg.message,
                viewerId: viewerId,
            }));
        }
    }

    handleViewerDisconnect(viewerId: string): void {
        if (this.viewers[viewerId]) {
            delete this.viewers[viewerId];
            this.broadcaster.send(JSON.stringify({
                type: "viewerdisconnected",
                viewerId: viewerId,
            }));
        }
    }

    // New methods for admin stream handling
    handleAdminStreamRequest(message: any): void {
        const device = this.registeredDevices.get(message.deviceId);
        if (device && device.socket) {
            // Forward stream request to device
            device.socket.send(JSON.stringify({
                type: "admin-stream-request",
                adminId: "admin-dashboard"
            }));
            this.log(`Stream request sent to device ${message.deviceId}`);
        }
    }

    forwardAdminStreamAnswer(message: any): void {
        const device = this.registeredDevices.get(message.deviceId);
        if (device && device.socket) {
            device.socket.send(JSON.stringify({
                type: "admin-stream-answer",
                answer: message.answer
            }));
        }
    }

    forwardAdminIceCandidate(message: any): void {
        const device = this.registeredDevices.get(message.deviceId);
        if (device && device.socket) {
            device.socket.send(JSON.stringify({
                type: "admin-ice-candidate",
                candidate: message.candidate
            }));
        }
    }
}

main();
