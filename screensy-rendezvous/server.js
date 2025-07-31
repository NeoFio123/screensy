"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const websocket = require("ws");
/**
 * The main entry point.
 */
function main() {
    const server = new Server();
    
    // Start servers on multiple ports for different clients
    const ports = [4000, 4001, 4002];
    
    ports.forEach(port => {
        const socket = new websocket.Server({ port: port });
        socket.on("connection", (socket) => server.onConnection(socket));
        console.log("Server started on port " + port);
    });
    
    console.log("WebSocket servers running on ports: " + ports.join(", "));
}
class Server {
    constructor() {
        /**
         * Object containing kv-pairs of room IDs and room class instances.
         *
         * @private
         */
        this.rooms = new Map();
        this.registeredDevices = new Map();
        this.adminClients = new Set();
        this.deviceClients = new Map();
    }
    /**
     * Handles a new WebSocket connection.
     *
     * @param socket
     */
    onConnection(socket) {
        console.log('New WebSocket connection established');
        
        socket.onmessage = (event) => {
            var _a;
            let message;
            try {
                message = JSON.parse(event.data);
                console.log('Received message:', message);
            }
            catch (e) {
                console.log('Invalid JSON message received');
                return;
            }
            
            // Handle different message types
            switch (message.type) {
                case 'join':
                    this.handleJoinMessage(message, socket);
                    break;
                case 'admin-connect':
                    this.handleAdminConnect(socket, message);
                    break;
                case 'register-device':
                    this.handleDeviceRegistration(socket, message);
                    break;
                case 'request-device-list':
                    this.handleDeviceListRequest(socket);
                    break;
                case 'request-sharing':
                    this.handleSharingRequest(socket, message);
                    break;
                case 'webrtc-offer':
                case 'webrtc-answer':
                case 'webrtc-candidate':
                    this.handleWebRTCMessage(socket, message);
                    break;
                case 'stop-sharing':
                    this.handleStopSharing(socket, message);
                    break;
                default:
                    console.log('Unknown message type:', message.type);
            }
        };
        
        socket.onclose = () => {
            console.log('WebSocket connection closed');
            this.handleClientDisconnect(socket);
        };
        
        socket.onerror = (error) => {
            console.log('WebSocket error:', error);
        };
    }
    
    handleJoinMessage(message, socket) {
        const roomId = message.roomId;
        if (roomId == null || roomId.length < 1) {
            return;
        }
        if (this.rooms.has(roomId)) {
            this.rooms.get(roomId)?.addViewer(socket);
        } else {
            this.newRoom(roomId, socket);
        }
    }
    
    handleAdminConnect(socket, message) {
        console.log('Admin client connected');
        this.adminClients.add(socket);
        
        // Send confirmation
        socket.send(JSON.stringify({
            type: 'admin-connected',
            adminId: 'admin-' + Date.now(),
            timestamp: Date.now()
        }));
    }
    
    handleDeviceRegistration(socket, message) {
        const deviceInfo = message.deviceInfo;
        const deviceId = message.deviceId || 'device-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        
        console.log('Device registration:', deviceId, deviceInfo);
        
        // Store device info
        this.registeredDevices.set(deviceId, {
            id: deviceId,
            ...deviceInfo,
            socket: socket,
            status: 'online',
            lastSeen: new Date()
        });
        
        // Store device client reference
        this.deviceClients.set(socket, deviceId);
        
        // Send confirmation to device
        socket.send(JSON.stringify({
            type: 'registration-success',
            deviceId: deviceId,
            timestamp: Date.now()
        }));
        
        // Notify all admin clients
        this.broadcastToAdmins({
            type: 'device-registered',
            deviceId: deviceId,
            deviceInfo: deviceInfo,
            timestamp: Date.now()
        });
        
        console.log('Device registered successfully:', deviceId);
    }
    
    handleDeviceListRequest(socket) {
        const devices = Array.from(this.registeredDevices.values()).map(device => ({
            id: device.id,
            name: device.name,
            type: device.type,
            table: device.table,
            status: device.status,
            lastSeen: device.lastSeen,
            capabilities: device.capabilities,
            userAgent: device.userAgent
        }));
        
        socket.send(JSON.stringify({
            type: 'device-list',
            devices: devices,
            timestamp: Date.now()
        }));
    }
    
    handleSharingRequest(socket, message) {
        const deviceId = message.deviceId;
        const device = this.registeredDevices.get(deviceId);
        
        if (device && device.socket) {
            // Forward sharing request to device
            device.socket.send(JSON.stringify({
                type: 'sharing-request',
                targetScreen: message.targetScreen,
                timestamp: Date.now()
            }));
            
            console.log('Sharing request forwarded to device:', deviceId);
        }
    }
    
    handleWebRTCMessage(socket, message) {
        // Forward WebRTC messages between admin and devices
        if (this.adminClients.has(socket)) {
            // Message from admin to device
            const device = this.registeredDevices.get(message.deviceId);
            if (device && device.socket) {
                device.socket.send(JSON.stringify(message));
            }
        } else {
            // Message from device to admin
            const deviceId = this.deviceClients.get(socket);
            if (deviceId) {
                message.deviceId = deviceId;
                this.broadcastToAdmins(message);
            }
        }
    }
    
    handleStopSharing(socket, message) {
        const deviceId = message.deviceId;
        const device = this.registeredDevices.get(deviceId);
        
        if (device && device.socket) {
            device.socket.send(JSON.stringify({
                type: 'stop-sharing-request',
                timestamp: Date.now()
            }));
        }
        
        // Notify admins
        this.broadcastToAdmins({
            type: 'sharing-stopped',
            deviceId: deviceId,
            timestamp: Date.now()
        });
    }
    
    handleClientDisconnect(socket) {
        // Remove from admin clients
        this.adminClients.delete(socket);
        
        // Check if it's a device client
        const deviceId = this.deviceClients.get(socket);
        if (deviceId) {
            this.deviceClients.delete(socket);
            
            // Mark device as offline
            const device = this.registeredDevices.get(deviceId);
            if (device) {
                device.status = 'offline';
                device.lastSeen = new Date();
                
                // Notify admins
                this.broadcastToAdmins({
                    type: 'device-disconnected',
                    deviceId: deviceId,
                    timestamp: Date.now()
                });
            }
        }
    }
    
    broadcastToAdmins(message) {
        this.adminClients.forEach(adminSocket => {
            if (adminSocket.readyState === websocket.OPEN) {
                adminSocket.send(JSON.stringify(message));
            }
        });
    }
    /**
     * Creates a new room with the given roomId and broadcaster. Throws an exception
     * if the roomId is already taken.
     *
     * @param roomId
     * @param broadcaster
     */
    newRoom(roomId, broadcaster) {
        if (this.rooms.has(roomId)) {
            throw ("Attempted to create room with the same ID as an existing room. " +
                "This likely indicates an error in the server implementation.");
        }
        this.rooms.set(roomId, new Room(broadcaster));
        broadcaster.onclose = (_event) => this.closeRoom(roomId);
    }
    /**
     * Closes the room with the given roomId.
     *
     * @param roomId The ID of the room to close
     */
    closeRoom(roomId) {
        var _a;
        (_a = this.rooms.get(roomId)) === null || _a === void 0 ? void 0 : _a.closeRoom();
        this.rooms.delete(roomId);
    }
}
/**
 * Represents a screensharing room.
 */
class Room {
    /**
     * Room constructor.
     *
     * @param broadcaster The WebSocket of the broadcaster of this room
     */
    constructor(broadcaster) {
        this.counter = 0;
        this.viewers = {};
        this.broadcaster = broadcaster;
        broadcaster.onmessage = (event) => {
            let message;
            try {
                message = JSON.parse(event.data);
            }
            catch (e) {
                // The JSON message is invalid
                return;
            }
            this.handleBroadcasterMessage(message);
        };
        // Tell the client that he has been assigned the role "broadcaster"
        const message = {
            type: "broadcast",
        };
        broadcaster.send(JSON.stringify(message));
    }
    /**
     * Called whenever a broadcaster sends a message.
     *
     * @param msg The message
     */
    handleBroadcasterMessage(msg) {
        if (!instanceOfFromBroadcasterMessage(msg)) {
            // The given message is not valid
            return;
        }
        switch (msg.type) {
            case "webrtcbroadcaster": {
                const viewerId = msg.viewerId;
                const viewer = this.viewers[viewerId];
                if (viewer == null) {
                    // No viewer with the ID "viewerId" exists
                    break;
                }
                const message = {
                    type: "webrtcviewer",
                    kind: msg.kind,
                    message: msg.message,
                };
                viewer.send(JSON.stringify(message));
                break;
            }
            case "requestviewers": {
                for (const viewerId in this.viewers) {
                    const messageViewer = {
                        type: "viewer",
                        viewerId: viewerId,
                    };
                    this.broadcaster.send(JSON.stringify(messageViewer));
                }
                break;
            }
        }
    }
    /**
     * Called to add a new viewer to this room.
     *
     * @param viewer The WebSocket of the viewer that joined the room
     */
    addViewer(viewer) {
        const id = (this.counter++).toString();
        viewer.onmessage = (event) => {
            let message;
            try {
                message = JSON.parse(event.data);
            }
            catch (e) {
                // The JSON message is invalid
                return;
            }
            this.handleViewerMessage(id, message);
        };
        viewer.onclose = (_event) => this.handleViewerDisconnect(id);
        // Tell the client that he has been assigned the role "viewer"
        const messageView = {
            type: "view",
        };
        viewer.send(JSON.stringify(messageView));
        // Tell the broadcaster a viewer has connected
        const messageViewer = {
            type: "viewer",
            viewerId: id,
        };
        this.broadcaster.send(JSON.stringify(messageViewer));
        this.viewers[id] = viewer;
    }
    /**
     * Called whenever a viewer sends a message.
     *
     * @param viewerId The ID of the viewer that sent the message
     * @param msg The message
     */
    handleViewerMessage(viewerId, msg) {
        if (!instanceOfFromViewerMessage(msg)) {
            // The given message is not valid
            return;
        }
        switch (msg.type) {
            case "webrtcviewer": {
                const message = {
                    type: "webrtcbroadcaster",
                    kind: msg.kind,
                    message: msg.message,
                    viewerId: viewerId,
                };
                this.broadcaster.send(JSON.stringify(message));
                break;
            }
        }
    }
    /**
     * Called whenever a viewer disconnects.
     *
     * @param viewerId The ID of the viewer that disconnected
     */
    handleViewerDisconnect(viewerId) {
        if (!(viewerId in this.viewers)) {
            throw ("Attempted to remove nonexistent viewer from room. " +
                "This likely indicates an error in the server implementation.");
        }
        delete this.viewers[viewerId];
        // Notify the broadcaster of the disconnect
        const message = {
            type: "viewerdisconnected",
            viewerId: viewerId,
        };
        this.broadcaster.send(JSON.stringify(message));
    }
    /**
     * Closes the room and tells all viewers the broadcaster has disconnected.
     */
    closeRoom() {
        for (const viewerId in this.viewers) {
            const viewer = this.viewers[viewerId];
            const messageBroadcasterDisconnected = {
                type: "broadcasterdisconnected",
            };
            viewer.send(JSON.stringify(messageBroadcasterDisconnected));
            viewer.close();
        }
    }
}
/**
 * Returns true if and only if the given object is a FromBroadcasterMessage.
 *
 * @param object
 */
function instanceOfFromBroadcasterMessage(object) {
    return (instanceOfMessageJoin(object) ||
        instanceOfMessageWebRTCBroadcaster(object) ||
        instanceOfMessageRequestViewers(object));
}
/**
 * Returns true if and only if the given object is a FromViewerMessage.
 *
 * @param object
 */
function instanceOfFromViewerMessage(object) {
    return (instanceOfMessageJoin(object) || instanceOfMessageWebRTCViewer(object));
}
/**
 * Returns true if and only if the given object is a MessageJoin.
 *
 * @param object
 */
function instanceOfMessageJoin(object) {
    const goodType = "type" in object && object.type === "join";
    const goodRoomId = "roomId" in object && typeof object.roomId === "string";
    return goodType && goodRoomId;
}
/**
 * Returns true if and only if the given object is a MessageWebRTCBroadcaster.
 *
 * @param object
 */
function instanceOfMessageWebRTCBroadcaster(object) {
    const goodType = "type" in object && object.type === "webrtcbroadcaster";
    const goodViewerId = "viewerId" in object && typeof object.viewerId === "string";
    const goodKind = "kind" in object &&
        ["offer", "answer", "candidate"].includes(object.kind);
    const goodMessage = "message" in object;
    return goodType && goodViewerId && goodKind && goodMessage;
}
/**
 * Returns true if and only if the given object is a MessageRequestViewers.
 *
 * @param object
 */
function instanceOfMessageRequestViewers(object) {
    return "type" in object && object.type === "requestviewers";
}
/**
 * Returns true if and only if the given object is a MessageWebRTCViewer.
 *
 * @param object
 */
function instanceOfMessageWebRTCViewer(object) {
    const goodType = "type" in object && object.type === "webrtcviewer";
    const goodKind = "kind" in object &&
        ["offer", "answer", "candidate"].includes(object.kind);
    const goodMessage = "message" in object;
    return goodType && goodKind && goodMessage;
}
main();
//# sourceMappingURL=server.js.map