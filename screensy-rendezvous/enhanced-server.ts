import * as websocket from "ws";

/**
 * Enhanced server for shop screen sharing with admin dashboard
 */

// Message interfaces for the admin dashboard
interface AdminConnectMessage {
    type: "admin-connect";
    timestamp: number;
}

interface RequestSharingMessage {
    type: "request-sharing";
    deviceId: string;
    screenId: string;
    timestamp: number;
}

interface StopSharingMessage {
    type: "stop-sharing";
    deviceId: string;
    screenId: string;
    timestamp: number;
}

interface PermissionResponseMessage {
    type: "permission-response";
    deviceId: string;
    screenId: string;
    allowed: boolean;
    timestamp: number;
}

interface WebRTCAdminMessage {
    type: "webrtc-offer" | "webrtc-answer" | "webrtc-candidate";
    deviceId: string;
    offer?: RTCSessionDescriptionInit;
    answer?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
    timestamp: number;
}

// Message interfaces for device clients
interface DeviceRegisterMessage {
    type: "register-device";
    deviceInfo: {
        name: string;
        type: "phone" | "tablet" | "laptop";
        table: string;
        userAgent: string;
        capabilities: any;
    };
    timestamp: number;
}

interface DevicePermissionResponseMessage {
    type: "permission-response";
    requestId: string;
    allowed: boolean;
    timestamp: number;
}

interface DeviceWebRTCMessage {
    type: "webrtc-offer" | "webrtc-answer" | "webrtc-candidate";
    offer?: RTCSessionDescriptionInit;
    answer?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
    timestamp: number;
}

interface DeviceStopSharingMessage {
    type: "stop-sharing";
    timestamp: number;
}

// Original screensy message interfaces
interface MessageJoin {
    type: "join";
    roomId: string;
}

interface MessageBroadcast {
    type: "broadcast";
}

interface MessageView {
    type: "view";
}

interface MessageRequestViewers {
    type: "requestviewers";
}

interface MessageViewer {
    type: "viewer";
    viewerId: string;
}

interface MessageWebRTCViewer {
    type: "webrtcviewer";
    kind: "offer" | "answer" | "candidate";
    message: any;
}

interface MessageWebRTCBroadcaster {
    type: "webrtcbroadcaster";
    viewerId: string;
    kind: "offer" | "answer" | "candidate";
    message: any;
}

interface MessageViewerDisconnected {
    type: "viewerdisconnected";
    viewerId: string;
}

interface MessageBroadcasterDisconnected {
    type: "broadcasterdisconnected";
}

type AdminMessage = 
    | AdminConnectMessage
    | RequestSharingMessage
    | StopSharingMessage
    | PermissionResponseMessage
    | WebRTCAdminMessage;

type DeviceMessage = 
    | DeviceRegisterMessage
    | DevicePermissionResponseMessage
    | DeviceWebRTCMessage
    | DeviceStopSharingMessage;

type ScreensyMessage = 
    | MessageJoin
    | MessageWebRTCBroadcaster
    | MessageRequestViewers
    | MessageWebRTCViewer;

interface RegisteredDevice {
    id: string;
    info: {
        name: string;
        type: "phone" | "tablet" | "laptop";
        table: string;
        userAgent: string;
        capabilities: any;
    };
    socket: WebSocket;
    status: "online" | "offline";
    lastSeen: number;
}

interface ActiveSharing {
    deviceId: string;
    screenId: string;
    startTime: number;
    adminSocket: WebSocket;
    deviceSocket: WebSocket;
}

/**
 * The main entry point.
 */
function main(): void {
    const screensySocket = new websocket.Server({ port: 4000 });
    const adminSocket = new websocket.Server({ port: 4001 });
    const deviceSocket = new websocket.Server({ port: 4002 });
    
    const server = new EnhancedServer();

    // Original screensy WebSocket handling
    screensySocket.on("connection", (socket: WebSocket) => server.onScreensyConnection(socket));
    
    // Admin dashboard WebSocket handling
    adminSocket.on("connection", (socket: WebSocket) => server.onAdminConnection(socket));
    
    // Device client WebSocket handling
    deviceSocket.on("connection", (socket: WebSocket) => server.onDeviceConnection(socket));

    console.log("Enhanced Screensy Server started:");
    console.log("- Screensy port: " + screensySocket.options.port);
    console.log("- Admin dashboard port: " + adminSocket.options.port);
    console.log("- Device client port: " + deviceSocket.options.port);
}

class EnhancedServer {
    // Original screensy rooms
    private screensyRooms = new Map<string, ScreensyRoom>();
    
    // Admin dashboard connections
    private adminConnections = new Set<WebSocket>();
    
    // Registered devices
    private registeredDevices = new Map<string, RegisteredDevice>();
    
    // Active sharing sessions
    private activeSharingSessions = new Map<string, ActiveSharing>();
    
    // Pending permission requests
    private pendingPermissionRequests = new Map<string, any>();

    /**
     * Handles original screensy connections
     */
    onScreensyConnection(socket: WebSocket): void {
        socket.onmessage = (event: MessageEvent) => {
            let message;

            try {
                message = JSON.parse(event.data);
            } catch (e) {
                return;
            }

            if (message.type != "join") {
                return;
            }

            const roomId = message.roomId;

            if (roomId == null || roomId.length < 1) {
                return;
            }

            if (this.screensyRooms.has(roomId)) {
                this.screensyRooms.get(roomId)?.addViewer(socket);
            } else {
                this.newScreensyRoom(roomId, socket);
            }
        };
    }

    /**
     * Handles admin dashboard connections
     */
    onAdminConnection(socket: WebSocket): void {
        this.adminConnections.add(socket);
        this.log("Admin connected");

        socket.onmessage = (event: MessageEvent) => {
            this.handleAdminMessage(socket, event);
        };

        socket.onclose = () => {
            this.adminConnections.delete(socket);
            this.log("Admin disconnected");
        };

        // Send current device list to new admin
        this.sendDeviceListToAdmin(socket);
    }

    /**
     * Handles device client connections
     */
    onDeviceConnection(socket: WebSocket): void {
        this.log("Device connected");

        socket.onmessage = (event: MessageEvent) => {
            this.handleDeviceMessage(socket, event);
        };

        socket.onclose = () => {
            // Find and remove device
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
        };
    }

    /**
     * Handles admin dashboard messages
     */
    handleAdminMessage(socket: WebSocket, event: MessageEvent): void {
        let message: AdminMessage;

        try {
            message = JSON.parse(event.data);
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

            case "permission-response":
                this.handleDevicePermissionResponse(socket, message);
                break;

            case "webrtc-offer":
            case "webrtc-answer":
            case "webrtc-candidate":
                this.handleAdminWebRTC(message);
                break;
        }
    }

    /**
     * Handles device client messages
     */
    handleDeviceMessage(socket: WebSocket, event: MessageEvent): void {
        let message: DeviceMessage;

        try {
            message = JSON.parse(event.data);
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

    /**
     * Handles device registration
     */
    handleDeviceRegistration(socket: WebSocket, message: DeviceRegisterMessage): void {
        const deviceId = this.generateDeviceId(message.deviceInfo.table);
        
        const device: RegisteredDevice = {
            id: deviceId,
            info: message.deviceInfo,
            socket: socket,
            status: "online",
            lastSeen: Date.now()
        };

        this.registeredDevices.set(deviceId, device);

        // Send success response to device
        this.sendToDevice(socket, {
            type: "device-registered",
            deviceId: deviceId,
            timestamp: Date.now()
        });

        // Notify all admins
        this.broadcastToAdmins({
            type: "device-registered",
            deviceId: deviceId,
            deviceInfo: message.deviceInfo,
            timestamp: Date.now()
        });

        this.log(`Device registered: ${deviceId} (${message.deviceInfo.name})`);
    }

    /**
     * Handles sharing request from admin
     */
    handleSharingRequest(adminSocket: WebSocket, message: RequestSharingMessage): void {
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
        
        // Store pending request
        this.pendingPermissionRequests.set(requestId, {
            adminSocket: adminSocket,
            deviceId: message.deviceId,
            screenId: message.screenId,
            timestamp: Date.now()
        });

        // Send permission request to device
        this.sendToDevice(device.socket, {
            type: "sharing-request",
            requestId: requestId,
            screenId: message.screenId,
            timestamp: Date.now()
        });

        this.log(`Sharing request sent to device ${message.deviceId}`);
    }

    /**
     * Handles permission response from device
     */
    handleDevicePermissionResponse(socket: WebSocket, message: DevicePermissionResponseMessage): void {
        const request = this.pendingPermissionRequests.get(message.requestId);
        
        if (!request) {
            return;
        }

        this.pendingPermissionRequests.delete(message.requestId);

        if (message.allowed) {
            // Start sharing session
            const sharingSession: ActiveSharing = {
                deviceId: request.deviceId,
                screenId: request.screenId,
                startTime: Date.now(),
                adminSocket: request.adminSocket,
                deviceSocket: socket
            };

            this.activeSharingSessions.set(request.deviceId, sharingSession);

            // Notify admin
            this.sendToAdmin(request.adminSocket, {
                type: "sharing-approved",
                deviceId: request.deviceId,
                screenId: request.screenId,
                timestamp: Date.now()
            });

            this.log(`Sharing approved for device ${request.deviceId}`);
        } else {
            // Notify admin of denial
            this.sendToAdmin(request.adminSocket, {
                type: "sharing-denied",
                deviceId: request.deviceId,
                screenId: request.screenId,
                timestamp: Date.now()
            });

            this.log(`Sharing denied for device ${request.deviceId}`);
        }
    }

    /**
     * Handles WebRTC messages from admin
     */
    handleAdminWebRTC(message: WebRTCAdminMessage): void {
        const device = this.registeredDevices.get(message.deviceId);
        
        if (!device) {
            return;
        }

        // Forward WebRTC message to device
        this.sendToDevice(device.socket, {
            type: message.type,
            ...message,
            timestamp: Date.now()
        });
    }

    /**
     * Handles WebRTC messages from device
     */
    handleDeviceWebRTC(socket: WebSocket, message: DeviceWebRTCMessage): void {
        // Find device ID by socket
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

        // Forward WebRTC message to admin
        this.sendToAdmin(sharingSession.adminSocket, {
            type: message.type,
            deviceId: deviceId,
            ...message,
            timestamp: Date.now()
        });
    }

    /**
     * Handles stop sharing request from admin
     */
    handleStopSharingRequest(adminSocket: WebSocket, message: StopSharingMessage): void {
        const sharingSession = this.activeSharingSessions.get(message.deviceId);
        
        if (!sharingSession) {
            return;
        }

        // Notify device to stop sharing
        this.sendToDevice(sharingSession.deviceSocket, {
            type: "stop-sharing",
            timestamp: Date.now()
        });

        // Clean up session
        this.activeSharingSessions.delete(message.deviceId);

        this.log(`Sharing stopped for device ${message.deviceId}`);
    }

    /**
     * Handles stop sharing from device
     */
    handleDeviceStopSharing(socket: WebSocket, message: DeviceStopSharingMessage): void {
        // Find device ID by socket
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
            // Notify admin
            this.sendToAdmin(sharingSession.adminSocket, {
                type: "sharing-stopped",
                deviceId: deviceId,
                timestamp: Date.now()
            });

            // Clean up session
            this.activeSharingSessions.delete(deviceId);
        }

        this.log(`Device ${deviceId} stopped sharing`);
    }

    /**
     * Sends device list to admin
     */
    sendDeviceListToAdmin(adminSocket: WebSocket): void {
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

    /**
     * Broadcasts message to all admin connections
     */
    broadcastToAdmins(message: any): void {
        const messageStr = JSON.stringify(message);
        this.adminConnections.forEach(socket => {
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(messageStr);
            }
        });
    }

    /**
     * Sends message to specific admin
     */
    sendToAdmin(socket: WebSocket, message: any): void {
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(message));
        }
    }

    /**
     * Sends message to specific device
     */
    sendToDevice(socket: WebSocket, message: any): void {
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(message));
        }
    }

    /**
     * Generates unique device ID
     */
    generateDeviceId(table: string): string {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 5);
        return `device-${table}-${timestamp}-${random}`;
    }

    /**
     * Generates unique request ID
     */
    generateRequestId(): string {
        return 'req-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 5);
    }

    /**
     * Original screensy room creation
     */
    newScreensyRoom(roomId: string, broadcaster: WebSocket): void {
        if (this.screensyRooms.has(roomId)) {
            throw (
                "Attempted to create room with the same ID as an existing room. " +
                "This likely indicates an error in the server implementation."
            );
        }

        this.screensyRooms.set(roomId, new ScreensyRoom(broadcaster));
        broadcaster.onclose = (_event: CloseEvent) => this.closeScreensyRoom(roomId);
    }

    /**
     * Original screensy room closing
     */
    closeScreensyRoom(roomId: string): void {
        this.screensyRooms.get(roomId)?.closeRoom();
        this.screensyRooms.delete(roomId);
    }

    /**
     * Logging utility
     */
    log(message: string): void {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] ${message}`);
    }
}

/**
 * Original screensy room class (unchanged)
 */
class ScreensyRoom {
    private counter: number = 0;
    private broadcaster: WebSocket;
    private viewers: { [id: string]: WebSocket } = {};

    constructor(broadcaster: WebSocket) {
        this.broadcaster = broadcaster;

        broadcaster.onmessage = (event: MessageEvent) => {
            let message;

            try {
                message = JSON.parse(event.data);
            } catch (e) {
                return;
            }

            this.handleBroadcasterMessage(message);
        };

        const message: MessageBroadcast = {
            type: "broadcast",
        };

        broadcaster.send(JSON.stringify(message));
    }

    handleBroadcasterMessage(msg: any): void {
        if (!instanceOfFromBroadcasterMessage(msg)) {
            return;
        }

        switch (msg.type) {
            case "webrtcbroadcaster": {
                const viewerId = msg.viewerId;
                const viewer = this.viewers[viewerId];

                if (viewer == null) {
                    break;
                }

                const message: MessageWebRTCViewer = {
                    type: "webrtcviewer",
                    kind: msg.kind,
                    message: msg.message,
                };

                viewer.send(JSON.stringify(message));
                break;
            }
            case "requestviewers": {
                for (const viewerId in this.viewers) {
                    const messageViewer: MessageViewer = {
                        type: "viewer",
                        viewerId: viewerId,
                    };

                    this.broadcaster.send(JSON.stringify(messageViewer));
                }
                break;
            }
        }
    }

    addViewer(viewer: WebSocket): void {
        const id: string = (this.counter++).toString();

        viewer.onmessage = (event: MessageEvent) => {
            let message;

            try {
                message = JSON.parse(event.data);
            } catch (e) {
                return;
            }

            this.handleViewerMessage(id, message);
        };

        viewer.onclose = (_event: CloseEvent) =>
            this.handleViewerDisconnect(id);

        const messageView: MessageView = {
            type: "view",
        };

        viewer.send(JSON.stringify(messageView));

        const messageViewer: MessageViewer = {
            type: "viewer",
            viewerId: id,
        };

        this.broadcaster.send(JSON.stringify(messageViewer));
        this.viewers[id] = viewer;
    }

    handleViewerMessage(viewerId: string, msg: any): void {
        if (!instanceOfFromViewerMessage(msg)) {
            return;
        }

        switch (msg.type) {
            case "webrtcviewer": {
                const message: MessageWebRTCBroadcaster = {
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

    handleViewerDisconnect(viewerId: string): void {
        if (!(viewerId in this.viewers)) {
            throw (
                "Attempted to remove nonexistent viewer from room. " +
                "This likely indicates an error in the server implementation."
            );
        }

        delete this.viewers[viewerId];

        const message: MessageViewerDisconnected = {
            type: "viewerdisconnected",
            viewerId: viewerId,
        };

        this.broadcaster.send(JSON.stringify(message));
    }

    closeRoom(): void {
        for (const viewerId in this.viewers) {
            const viewer = this.viewers[viewerId];
            const messageBroadcasterDisconnected: MessageBroadcasterDisconnected =
                {
                    type: "broadcasterdisconnected",
                };

            viewer.send(JSON.stringify(messageBroadcasterDisconnected));
            viewer.close();
        }
    }
}

// Original type guards
type FromBroadcasterMessage =
    | MessageJoin
    | MessageWebRTCBroadcaster
    | MessageRequestViewers;
type FromViewerMessage = MessageJoin | MessageWebRTCViewer;

function instanceOfFromBroadcasterMessage(
    object: any
): object is FromBroadcasterMessage {
    return (
        instanceOfMessageJoin(object) ||
        instanceOfMessageWebRTCBroadcaster(object) ||
        instanceOfMessageRequestViewers(object)
    );
}

function instanceOfFromViewerMessage(object: any): object is FromViewerMessage {
    return (
        instanceOfMessageJoin(object) || instanceOfMessageWebRTCViewer(object)
    );
}

function instanceOfMessageJoin(object: any): object is MessageJoin {
    const goodType = "type" in object && object.type === "join";
    const goodRoomId = "roomId" in object && typeof object.roomId === "string";

    return goodType && goodRoomId;
}

function instanceOfMessageWebRTCBroadcaster(
    object: any
): object is MessageWebRTCBroadcaster {
    const goodType = "type" in object && object.type === "webrtcbroadcaster";
    const goodViewerId =
        "viewerId" in object && typeof object.viewerId === "string";
    const goodKind =
        "kind" in object &&
        ["offer", "answer", "candidate"].includes(object.kind);
    const goodMessage = "message" in object;

    return goodType && goodViewerId && goodKind && goodMessage;
}

function instanceOfMessageRequestViewers(
    object: any
): object is MessageRequestViewers {
    return "type" in object && object.type === "requestviewers";
}

function instanceOfMessageWebRTCViewer(
    object: any
): object is MessageWebRTCViewer {
    const goodType = "type" in object && object.type === "webrtcviewer";
    const goodKind =
        "kind" in object &&
        ["offer", "answer", "candidate"].includes(object.kind);
    const goodMessage = "message" in object;

    return goodType && goodKind && goodMessage;
}

main();
