class AdminDashboard {
    constructor() {
        this.registeredDevices = new Map();
        this.devices = new Map();
        this.activeSharing = new Map();
        this.webSocket = null;
        this.selectedDevice = null;
        this.selectedScreen = null;
        this.rtcConnections = new Map();
        this.videoStreams = new Map(); // For storing video streams
        this.activePeerConnections = new Map(); // For WebRTC connections to devices
        this.selectedDevice = null;
        this.selectedScreen = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.connectToServer();
        this.updateConnectionStatus(false);
        this.updateDeviceStats();
        this.log('Admin Dashboard gestartet');
    }

    setupEventListeners() {
        // Refresh devices button
        document.getElementById('refresh-devices').addEventListener('click', () => {
            this.requestDeviceList();
        });

        // Start sharing modal button
        document.getElementById('start-sharing-modal').addEventListener('click', () => {
            this.showSharingSelectionModal();
        });

        // Start sharing button in modal
        document.getElementById('start-sharing-btn').addEventListener('click', () => {
            this.startSelectedSharing();
        });

        // Device selection
        document.querySelectorAll('.device').forEach(device => {
            device.addEventListener('click', (e) => {
                this.selectDevice(e.currentTarget);
            });
        });

        // Screen selection
        document.querySelectorAll('.screen').forEach(screen => {
            screen.addEventListener('click', (e) => {
                this.selectScreen(e.currentTarget);
            });
        });

        // Control buttons
        document.getElementById('stop-sharing').addEventListener('click', () => {
            this.stopSharing();
        });

        document.getElementById('request-permission').addEventListener('click', () => {
            this.requestPermission();
        });

        document.getElementById('refresh-devices').addEventListener('click', () => {
            this.refreshDevices();
        });

        document.getElementById('clear-logs').addEventListener('click', () => {
            this.clearLogs();
        });

        // Modal handling
        this.setupModalHandlers();

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModals();
            }
        });
    }

    setupModalHandlers() {
        // Register modal
        const registerModal = document.getElementById('register-modal');
        const registerForm = document.getElementById('register-form');
        const closeBtn = registerModal.querySelector('.close');

        closeBtn.addEventListener('click', () => {
            this.hideModal('register-modal');
        });

        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.registerDevice();
        });

        // Permission modal
        const permissionModal = document.getElementById('permission-modal');
        const allowBtn = document.getElementById('permission-allow');
        const denyBtn = document.getElementById('permission-deny');

        allowBtn.addEventListener('click', () => {
            this.handlePermissionResponse(true);
        });

        denyBtn.addEventListener('click', () => {
            this.handlePermissionResponse(false);
        });
    }

    connectToServer() {
        try {
            // Use secure WebSocket (wss://) for HTTPS pages, regular (ws://) for HTTP pages
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = window.location.hostname;
            const port = window.location.protocol === 'https:' ? '5001' : '4001';
            const wsUrl = `${protocol}//${host}:${port}/`;
            
            this.log(`Verbinde zu WebSocket: ${wsUrl}`, 'info');
            this.webSocket = new WebSocket(wsUrl);
            
            this.webSocket.onopen = () => {
                this.updateConnectionStatus(true);
                this.log('Verbindung zum Server hergestellt', 'success');
                this.sendMessage({
                    type: 'admin-connect',
                    timestamp: Date.now()
                });
                // Request current device list
                setTimeout(() => {
                    this.requestDeviceList();
                }, 500);
            };

            this.webSocket.onmessage = (event) => {
                this.handleServerMessage(JSON.parse(event.data));
            };

            this.webSocket.onclose = () => {
                this.updateConnectionStatus(false);
                this.log('Verbindung zum Server getrennt', 'error');
                // Reconnect after 3 seconds
                setTimeout(() => this.connectToServer(), 3000);
            };

            this.webSocket.onerror = (error) => {
                this.log('WebSocket Fehler: ' + error.message, 'error');
            };

        } catch (error) {
            this.log('Fehler beim Verbinden zum Server: ' + error.message, 'error');
        }
    }

    handleServerMessage(message) {
        console.log('Admin erhielt Nachricht:', message);
        
        switch (message.type) {
            case 'admin-connected':
                this.handleAdminConnected(message);
                break;
            case 'device-registered':
                this.handleDeviceRegistration(message);
                break;
            case 'device-status':
                this.updateDeviceStatus(message.deviceId, message.status);
                break;
            case 'device-disconnected':
                this.handleDeviceDisconnection(message);
                break;
            case 'device-list':
                this.handleDeviceList(message);
                break;
            case 'sharing-started':
                this.handleSharingStarted(message);
                break;
            case 'sharing-stopped':
                this.handleSharingStopped(message);
                break;
            case 'permission-request':
                this.showPermissionModal(message);
                break;
            case 'webrtc-offer':
                this.handleWebRTCOffer(message);
                break;
            case 'webrtc-answer':
                this.handleWebRTCAnswer(message);
                break;
            case 'webrtc-candidate':
                this.handleWebRTCCandidate(message);
                break;
            case 'admin-stream-offer':
                this.handleAdminStreamOffer(message);
                break;
            case 'admin-stream-answer':
                this.handleAdminStreamAnswer(message);
                break;
            case 'admin-ice-candidate':
                this.handleAdminIceCandidate(message);
                break;
                break;
            case 'webrtc-candidate':
                this.handleWebRTCCandidate(message);
                break;
            default:
                console.log('Unbekannte Nachricht:', message);
        }
    }

    selectDevice(deviceElement) {
        // Remove previous selection
        document.querySelectorAll('.device.selected').forEach(d => {
            d.classList.remove('selected');
        });

        // Select new device
        deviceElement.classList.add('selected');
        this.selectedDevice = {
            id: deviceElement.getAttribute('data-device'),
            type: deviceElement.getAttribute('data-type'),
            table: deviceElement.getAttribute('data-device').split('-')[0],
            element: deviceElement
        };

        this.updateActiveSession();
        this.updateControlButtons();
        this.log(`Gerät ausgewählt: ${deviceElement.querySelector('.device-label').textContent}`);
    }

    selectScreen(screenElement) {
        // Remove previous selection
        document.querySelectorAll('.screen.active').forEach(s => {
            s.classList.remove('active');
        });

        // Select new screen
        screenElement.classList.add('active');
        this.selectedScreen = {
            id: screenElement.getAttribute('data-screen'),
            element: screenElement
        };

        this.updateActiveSession();
        this.updateControlButtons();
        this.log(`Display ausgewählt: ${screenElement.querySelector('.screen-label').textContent}`);
    }

    updateActiveSession() {
        const activeDevice = document.getElementById('active-device');
        const activeScreen = document.getElementById('active-screen');

        if (this.selectedDevice) {
            activeDevice.textContent = `Gerät: ${this.selectedDevice.element.querySelector('.device-label').textContent}`;
            activeDevice.className = '';
        } else {
            activeDevice.textContent = 'Kein Gerät ausgewählt';
            activeDevice.className = 'no-session';
        }

        if (this.selectedScreen) {
            activeScreen.textContent = `Display: ${this.selectedScreen.element.querySelector('.screen-label').textContent}`;
            activeScreen.className = '';
        } else {
            activeScreen.textContent = 'Kein Display ausgewählt';
            activeScreen.className = 'no-session';
        }
    }

    updateControlButtons() {
        const stopBtn = document.getElementById('stop-sharing');
        const requestBtn = document.getElementById('request-permission');

        const canShare = this.selectedDevice && this.selectedScreen;
        const isSharing = this.selectedDevice && this.activeSharing.has(this.selectedDevice.id);

        requestBtn.disabled = !canShare || isSharing;
        stopBtn.disabled = !isSharing;
    }

    requestPermission() {
        if (!this.selectedDevice || !this.selectedScreen) {
            this.log('Bitte wählen Sie ein Gerät und einen Display aus', 'warning');
            return;
        }

        const message = {
            type: 'request-sharing',
            deviceId: this.selectedDevice.id,
            screenId: this.selectedScreen.id,
            timestamp: Date.now()
        };

        this.sendMessage(message);
        this.log(`Berechtigung angefragt für ${this.selectedDevice.element.querySelector('.device-label').textContent}`);
    }

    startSharing(deviceId, screenId) {
        const device = this.devices.get(deviceId);
        if (!device) {
            this.log('Gerät nicht gefunden', 'error');
            return;
        }

        // Setup WebRTC connection
        this.setupWebRTCConnection(deviceId, screenId);

        // Update UI
        const deviceElement = document.querySelector(`[data-device="${deviceId}"]`);
        if (deviceElement) {
            deviceElement.classList.add('sharing');
        }

        const screenElement = document.querySelector(`[data-screen="${screenId}"]`);
        if (screenElement) {
            const content = screenElement.querySelector('.screen-content');
            content.innerHTML = `<span>Sharing von ${deviceElement.querySelector('.device-label').textContent}</span>`;
        }

        this.activeSharing.set(deviceId, { screenId, timestamp: Date.now() });
        this.updateControlButtons();

        this.log(`Screen Sharing gestartet: ${deviceElement.querySelector('.device-label').textContent}`, 'success');
    }

    stopSharing() {
        if (!this.selectedDevice || !this.activeSharing.has(this.selectedDevice.id)) {
            return;
        }

        const sharing = this.activeSharing.get(this.selectedDevice.id);
        
        // Stop WebRTC connection
        const connection = this.rtcConnections.get(this.selectedDevice.id);
        if (connection) {
            connection.close();
            this.rtcConnections.delete(this.selectedDevice.id);
        }

        // Send stop message to server
        this.sendMessage({
            type: 'stop-sharing',
            deviceId: this.selectedDevice.id,
            screenId: sharing.screenId,
            timestamp: Date.now()
        });

        // Update UI
        this.selectedDevice.element.classList.remove('sharing');
        
        const screenElement = document.querySelector(`[data-screen="${sharing.screenId}"]`);
        if (screenElement) {
            const content = screenElement.querySelector('.screen-content');
            content.innerHTML = '<span class="no-content">Kein Inhalt</span>';
        }

        this.activeSharing.delete(this.selectedDevice.id);
        this.updateControlButtons();

        this.log(`Screen Sharing gestoppt: ${this.selectedDevice.element.querySelector('.device-label').textContent}`, 'warning');
    }

    setupWebRTCConnection(deviceId, targetScreen) {
        const connection = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'turn:' + window.location.hostname, username: 'screensy', credential: 'screensy' }
            ]
        });

        connection.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendMessage({
                    type: 'webrtc-candidate',
                    deviceId: deviceId,
                    candidate: event.candidate,
                    timestamp: Date.now()
                });
            }
        };

        connection.ontrack = (event) => {
            this.log(`Stream empfangen von Device ${deviceId}`, 'success');
            this.displayStreamOnScreen(deviceId, event.streams[0], targetScreen);
        };

        connection.onconnectionstatechange = () => {
            this.log(`WebRTC Status für ${deviceId}: ${connection.connectionState}`, 'info');
            
            // If connection is established, process any pending ICE candidates
            if (connection.connectionState === 'connected' && connection.pendingCandidates) {
                this.log(`Verarbeite ${connection.pendingCandidates.length} verzögerte ICE Candidates für ${deviceId}`, 'info');
                connection.pendingCandidates.forEach(candidate => {
                    connection.addIceCandidate(new RTCIceCandidate(candidate))
                        .catch(error => this.log(`Verzögerter ICE Candidate Fehler: ${error.message}`, 'error'));
                });
                connection.pendingCandidates = [];
            }
        };

        // Add state change monitoring
        connection.onsignalingstatechange = () => {
            this.log(`WebRTC Signaling State für ${deviceId}: ${connection.signalingState}`, 'info');
            
            // If we've set remote description, process pending candidates
            if (connection.signalingState === 'stable' && connection.pendingCandidates) {
                this.log(`Verarbeite verzögerte ICE Candidates nach Remote Description für ${deviceId}`, 'info');
                connection.pendingCandidates.forEach(candidate => {
                    connection.addIceCandidate(new RTCIceCandidate(candidate))
                        .catch(error => this.log(`Verzögerter ICE Candidate Fehler: ${error.message}`, 'error'));
                });
                connection.pendingCandidates = [];
            }
        };

        this.rtcConnections.set(deviceId, connection);
        return connection;
    }

    handleWebRTCOffer(message) {
        const deviceId = message.deviceId;
        const targetScreen = message.targetScreen || 'Unbekannt';
        
        this.log(`Device ${deviceId} startet Sharing zu Display: ${targetScreen}`, 'success');
        
        // Create WebRTC connection if it doesn't exist
        let connection = this.rtcConnections.get(deviceId);
        if (!connection) {
            connection = this.setupWebRTCConnection(deviceId, targetScreen);
        }
        
        if (connection) {
            // Check connection state before proceeding
            this.log(`WebRTC Zustand vor Offer: ${connection.signalingState}`, 'info');
            
            if (connection.signalingState === 'stable' || connection.signalingState === 'have-local-offer') {
                // Auto-show the sharing stream
                this.autoShowSharingStream(deviceId, targetScreen);
                
                connection.setRemoteDescription(new RTCSessionDescription(message.offer))
                    .then(() => {
                        this.log(`Remote Description gesetzt für ${deviceId}, Zustand: ${connection.signalingState}`, 'info');
                        return connection.createAnswer();
                    })
                    .then(answer => {
                        return connection.setLocalDescription(answer);
                    })
                    .then(() => {
                        this.sendMessage({
                            type: 'webrtc-answer',
                            deviceId: deviceId,
                            answer: connection.localDescription,
                            timestamp: Date.now()
                        });
                        this.log(`WebRTC Antwort gesendet für ${deviceId}, Zustand: ${connection.signalingState}`, 'success');
                    })
                    .catch(error => {
                        this.log(`WebRTC Fehler für ${deviceId}: ${error.message} (Zustand: ${connection.signalingState})`, 'error');
                    });
            } else {
                this.log(`WebRTC Verbindung in ungültigem Zustand: ${connection.signalingState}`, 'warning');
                // Reset connection if in wrong state
                this.rtcConnections.delete(deviceId);
                setTimeout(() => {
                    this.handleWebRTCOffer(message);
                }, 100);
            }
        }
    }

    handleWebRTCAnswer(message) {
        const connection = this.rtcConnections.get(message.deviceId);
        if (connection) {
            // Check if we're in the right state to receive an answer
            this.log(`WebRTC Zustand vor Answer: ${connection.signalingState}`, 'info');
            
            if (connection.signalingState === 'have-local-offer') {
                connection.setRemoteDescription(new RTCSessionDescription(message.answer))
                    .then(() => {
                        this.log(`WebRTC Answer verarbeitet für ${message.deviceId}, Zustand: ${connection.signalingState}`, 'success');
                    })
                    .catch(error => {
                        this.log(`WebRTC Answer Fehler für ${message.deviceId}: ${error.message} (Zustand: ${connection.signalingState})`, 'error');
                    });
            } else {
                this.log(`WebRTC Answer ignoriert - falscher Zustand: ${connection.signalingState}`, 'warning');
            }
        }
    }

    handleWebRTCCandidate(message) {
        const connection = this.rtcConnections.get(message.deviceId);
        if (connection && message.candidate) {
            // Only add ICE candidates if remote description is set
            if (connection.remoteDescription) {
                connection.addIceCandidate(new RTCIceCandidate(message.candidate))
                    .then(() => {
                        this.log(`ICE Candidate hinzugefügt für ${message.deviceId}`, 'info');
                    })
                    .catch(error => {
                        this.log(`ICE Candidate Fehler für ${message.deviceId}: ${error.message}`, 'error');
                    });
            } else {
                this.log(`ICE Candidate verzögert - Remote Description noch nicht gesetzt für ${message.deviceId}`, 'warning');
                // Store candidate for later
                if (!connection.pendingCandidates) {
                    connection.pendingCandidates = [];
                }
                connection.pendingCandidates.push(message.candidate);
            }
        }
    }

    autoShowSharingStream(deviceId, targetScreen) {
        // Find the target screen element and highlight it
        const screenElement = document.querySelector(`[data-screen="${targetScreen}"]`);
        if (screenElement) {
            // Remove any existing active highlighting
            document.querySelectorAll('.screen-panel').forEach(panel => {
                panel.classList.remove('active-sharing');
            });
            
            // Add highlighting to the target screen
            screenElement.classList.add('active-sharing');
            
            // Scroll to the screen element if it's not in view
            screenElement.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
            });
            
            this.log(`Auto-anzeige für Device ${deviceId} auf ${targetScreen}`, 'info');
        }
        
        // Update active sharing tracking
        this.activeSharing.set(deviceId, {
            deviceId: deviceId,
            targetScreen: targetScreen,
            startTime: new Date(),
            status: 'active'
        });
        
        // Update device stats
        this.updateDeviceStats();
    }

    handleAdminStreamOffer(message) {
        try {
            const peerConnection = this.activePeerConnections.get(message.deviceId);
            if (peerConnection) {
                peerConnection.setRemoteDescription(new RTCSessionDescription(message.offer))
                    .then(() => {
                        return peerConnection.createAnswer();
                    })
                    .then(answer => {
                        return peerConnection.setLocalDescription(answer);
                    })
                    .then(() => {
                        this.sendMessage({
                            type: 'admin-stream-answer',
                            deviceId: message.deviceId,
                            answer: peerConnection.localDescription
                        });
                    })
                    .catch(error => {
                        this.log(`Fehler beim Bearbeiten des Stream-Offers: ${error.message}`, 'error');
                    });
            }
        } catch (error) {
            this.log(`Fehler beim Verarbeiten des Admin Stream Offers: ${error.message}`, 'error');
        }
    }

    handleAdminStreamAnswer(message) {
        try {
            const peerConnection = this.activePeerConnections.get(message.deviceId);
            if (peerConnection) {
                peerConnection.setRemoteDescription(new RTCSessionDescription(message.answer))
                    .catch(error => {
                        this.log(`Fehler beim Setzen der Remote Description: ${error.message}`, 'error');
                    });
            }
        } catch (error) {
            this.log(`Fehler beim Verarbeiten der Admin Stream Answer: ${error.message}`, 'error');
        }
    }

    handleAdminIceCandidate(message) {
        try {
            const peerConnection = this.activePeerConnections.get(message.deviceId);
            if (peerConnection && message.candidate) {
                peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate))
                    .catch(error => {
                        this.log(`Fehler beim Hinzufügen des ICE Candidates: ${error.message}`, 'error');
                    });
            }
        } catch (error) {
            this.log(`Fehler beim Verarbeiten des Admin ICE Candidates: ${error.message}`, 'error');
        }
    }

    registerDevice() {
        const form = document.getElementById('register-form');
        const formData = new FormData(form);
        
        const deviceData = {
            name: formData.get('device-name') || document.getElementById('device-name').value,
            type: formData.get('device-type') || document.getElementById('device-type').value,
            table: formData.get('table-number') || document.getElementById('table-number').value
        };

        // Generate device ID
        const deviceId = `${deviceData.table}-${Date.now()}`;
        
        // Register device locally
        this.devices.set(deviceId, deviceData);
        
        // Send to server
        this.sendMessage({
            type: 'register-device',
            deviceId: deviceId,
            deviceData: deviceData,
            timestamp: Date.now()
        });

        this.updateDeviceRegistry();
        this.hideModal('register-modal');
        form.reset();
        
        this.log(`Gerät registriert: ${deviceData.name}`, 'success');
    }

    updateDeviceRegistry() {
        const registry = document.getElementById('device-registry');
        
        if (this.devices.size === 0) {
            registry.innerHTML = '<div class="no-devices">Keine Geräte registriert</div>';
            return;
        }

        registry.innerHTML = '';
        this.devices.forEach((device, deviceId) => {
            const deviceDiv = document.createElement('div');
            deviceDiv.className = 'registered-device';
            deviceDiv.innerHTML = `
                <div>
                    <strong>${device.name}</strong> (${device.type})
                    <br>
                    <small>Tisch ${device.table} - ID: ${deviceId}</small>
                </div>
                <button class="btn btn-danger btn-sm" onclick="dashboard.unregisterDevice('${deviceId}')">
                    Entfernen
                </button>
            `;
            registry.appendChild(deviceDiv);
        });
    }

    unregisterDevice(deviceId) {
        if (this.devices.has(deviceId)) {
            const device = this.devices.get(deviceId);
            this.devices.delete(deviceId);
            
            // Send to server
            this.sendMessage({
                type: 'unregister-device',
                deviceId: deviceId,
                timestamp: Date.now()
            });

            this.updateDeviceRegistry();
            this.log(`Gerät entfernt: ${device.name}`, 'warning');
        }
    }

    updateDeviceStatus(deviceId, status) {
        const deviceElement = document.querySelector(`[data-device="${deviceId}"]`);
        if (deviceElement) {
            const statusElement = deviceElement.querySelector('.device-status');
            statusElement.className = `device-status ${status}`;
        }

        if (this.devices.has(deviceId)) {
            this.devices.get(deviceId).status = status;
        }
    }

    refreshDevices() {
        this.sendMessage({
            type: 'refresh-devices',
            timestamp: Date.now()
        });
        this.log('Geräte werden aktualisiert...');
    }

    showPermissionModal(message) {
        const modal = document.getElementById('permission-modal');
        modal.classList.remove('hidden');
        
        this.pendingPermission = message;
        this.log(`Berechtigung angefragt von Gerät ${message.deviceId}`);
    }

    handlePermissionResponse(allowed) {
        if (this.pendingPermission) {
            this.sendMessage({
                type: 'permission-response',
                deviceId: this.pendingPermission.deviceId,
                screenId: this.pendingPermission.screenId,
                allowed: allowed,
                timestamp: Date.now()
            });

            if (allowed) {
                this.startSharing(this.pendingPermission.deviceId, this.pendingPermission.screenId);
            }

            this.pendingPermission = null;
        }

        this.hideModal('permission-modal');
    }

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    closeModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.add('hidden');
        });
    }

    updateConnectionStatus(connected) {
        const indicator = document.getElementById('connection-indicator');
        const text = document.getElementById('connection-text');
        
        if (connected) {
            indicator.className = 'status-indicator online';
            text.textContent = 'Online';
        } else {
            indicator.className = 'status-indicator offline';
            text.textContent = 'Offline';
        }
    }

    sendMessage(message) {
        if (this.webSocket && this.webSocket.readyState === WebSocket.OPEN) {
            this.webSocket.send(JSON.stringify(message));
        } else {
            this.log('Keine Verbindung zum Server', 'error');
        }
    }

    log(message, type = 'info') {
        const logs = document.getElementById('system-logs');
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        
        const timestamp = new Date().toLocaleTimeString();
        logEntry.textContent = `[${timestamp}] ${message}`;
        
        logs.appendChild(logEntry);
        logs.scrollTop = logs.scrollHeight;

        // Keep only last 100 log entries
        const entries = logs.querySelectorAll('.log-entry');
        if (entries.length > 100) {
            entries[0].remove();
        }
    }

    clearLogs() {
        const logs = document.getElementById('system-logs');
        logs.innerHTML = '<div class="log-entry">Logs gelöscht</div>';
    }

    // Real device management functions
    addRegisteredDevice(deviceInfo) {
        console.log('Neues Gerät registriert:', deviceInfo);
        
        this.registeredDevices.set(deviceInfo.id, {
            id: deviceInfo.id,
            name: deviceInfo.name,
            type: deviceInfo.type,
            table: deviceInfo.table,
            status: 'online',
            lastSeen: new Date(),
            capabilities: deviceInfo.capabilities || {},
            userAgent: deviceInfo.userAgent || 'Unknown'
        });
        
        this.updateDevicesDisplay();
        this.updateDeviceStats();
        this.log(`Gerät registriert: ${deviceInfo.name} (${deviceInfo.type})`, 'success');
    }

    updateDevicesDisplay() {
        const container = document.getElementById('registered-devices');
        
        // Update the main registered devices section
        if (this.registeredDevices.size === 0) {
            container.innerHTML = `
                <div class="no-devices-message">
                    <p>Noch keine Geräte registriert</p>
                    <p>Geräte können sich über <strong>http://localhost:8080/device</strong> registrieren</p>
                </div>
            `;
        } else {
            container.innerHTML = '';
            this.registeredDevices.forEach((device, deviceId) => {
                const deviceCard = this.createDeviceCard(device);
                container.appendChild(deviceCard);
            });
        }

        // Update devices by table
        this.updateDevicesByTable();
    }

    updateDevicesByTable() {
        // Group devices by table
        const devicesByTable = {
            1: [],
            2: [],
            3: []
        };

        this.registeredDevices.forEach((device, deviceId) => {
            // Parse table number and handle string/number conversion
            let tableNum = device.table || device.info?.table || 1;
            
            // Convert string to number if needed
            if (typeof tableNum === 'string') {
                const parsed = parseInt(tableNum);
                tableNum = isNaN(parsed) ? 1 : parsed;
            }
            
            // Ensure table number is valid (1-3)
            if (tableNum < 1 || tableNum > 3) {
                tableNum = 1;
            }
            
            if (devicesByTable[tableNum]) {
                devicesByTable[tableNum].push({...device, id: deviceId});
            }
        });

        // Update each table's device display
        for (let tableNum = 1; tableNum <= 3; tableNum++) {
            const tableDevicesContainer = document.getElementById(`table-${tableNum}-devices`);
            if (!tableDevicesContainer) continue;
            
            const devices = devicesByTable[tableNum];

            if (devices.length === 0) {
                tableDevicesContainer.innerHTML = '<div class="no-devices-at-table">Keine Geräte an diesem Tisch registriert</div>';
            } else {
                tableDevicesContainer.innerHTML = '';
                devices.forEach(device => {
                    const deviceElement = this.createTableDeviceElement(device);
                    tableDevicesContainer.appendChild(deviceElement);
                });
            }
        }
    }

    createTableDeviceElement(device) {
        const deviceElement = document.createElement('div');
        deviceElement.className = 'device';
        deviceElement.setAttribute('data-device', device.id);
        deviceElement.setAttribute('data-type', device.type);
        
        const statusClass = device.status === 'online' ? 'online' : 'offline';
        const isSharing = this.activeSharing.has(device.id);
        
        if (isSharing) {
            deviceElement.classList.add('sharing');
        }

        deviceElement.innerHTML = `
            <span class="device-label">${device.name}</span>
            <div class="device-status ${statusClass}"></div>
            ${isSharing ? '<div class="sharing-indicator">📡</div>' : ''}
        `;

        // Add click handler for sharing request
        deviceElement.addEventListener('click', () => {
            this.requestSharingFromDevice(device.id);
        });

        return deviceElement;
    }

    requestSharingFromDevice(deviceId) {
        if (this.registeredDevices.has(deviceId)) {
            const device = this.registeredDevices.get(deviceId);
            
            // Determine which screen to use - use first available screen
            const availableScreen = this.findAvailableScreenId();
            
            this.sendMessage({
                type: 'request-sharing',
                deviceId: deviceId,
                targetScreen: availableScreen,
                timestamp: Date.now()
            });
            
            this.log(`Sharing-Anfrage gesendet an ${device.name} für Screen ${availableScreen}`, 'info');
        }
    }

    showSharingSelectionModal() {
        // Update device selection
        this.updateDeviceSelection();
        
        // Show modal
        document.getElementById('sharing-selection-modal').classList.remove('hidden');
        
        // Setup screen selection listeners
        this.setupScreenSelectionListeners();
    }

    updateDeviceSelection() {
        const deviceSelection = document.getElementById('device-selection');
        deviceSelection.innerHTML = '';

        if (this.registeredDevices.size === 0) {
            deviceSelection.innerHTML = '<div class="no-devices-available">Keine Geräte verfügbar</div>';
            return;
        }

        this.registeredDevices.forEach((device, deviceId) => {
            if (device.status === 'online') {
                const deviceOption = document.createElement('div');
                deviceOption.className = 'device-option';
                deviceOption.setAttribute('data-device-id', deviceId);
                
                deviceOption.innerHTML = `
                    <div class="device-icon">${this.getDeviceIcon(device.type)}</div>
                    <div class="device-info">
                        <div class="device-name">${device.name}</div>
                        <div class="device-details">${this.getDeviceTypeLabel(device.type)} - Tisch ${device.table}</div>
                    </div>
                    <div class="device-status online">🟢</div>
                `;

                deviceOption.addEventListener('click', () => {
                    this.selectDeviceForSharing(deviceId, deviceOption);
                });

                deviceSelection.appendChild(deviceOption);
            }
        });
    }

    selectDeviceForSharing(deviceId, element) {
        // Remove previous selection
        document.querySelectorAll('.device-option.selected').forEach(el => {
            el.classList.remove('selected');
        });

        // Select new device
        element.classList.add('selected');
        this.selectedDevice = deviceId;
        
        this.updateStartSharingButton();
        this.log(`Gerät ausgewählt: ${this.registeredDevices.get(deviceId).name}`, 'info');
    }

    setupScreenSelectionListeners() {
        document.querySelectorAll('.screen-option').forEach(screenOption => {
            screenOption.addEventListener('click', () => {
                this.selectScreenForSharing(screenOption);
            });
        });
    }

    selectScreenForSharing(element) {
        // Remove previous selection
        document.querySelectorAll('.screen-option.selected').forEach(el => {
            el.classList.remove('selected');
        });

        // Select new screen
        element.classList.add('selected');
        this.selectedScreen = element.getAttribute('data-screen');
        
        this.updateStartSharingButton();
        this.log(`Display ausgewählt: ${element.querySelector('.screen-label').textContent}`, 'info');
    }

    updateStartSharingButton() {
        const startBtn = document.getElementById('start-sharing-btn');
        startBtn.disabled = !(this.selectedDevice && this.selectedScreen);
    }

    startSelectedSharing() {
        if (!this.selectedDevice || !this.selectedScreen) {
            this.log('Bitte wählen Sie ein Gerät und einen Display aus', 'error');
            return;
        }

        const device = this.registeredDevices.get(this.selectedDevice);
        
        // Send sharing request to selected device
        this.sendMessage({
            type: 'request-sharing',
            deviceId: this.selectedDevice,
            targetScreen: this.selectedScreen,
            timestamp: Date.now()
        });

        // Close modal
        document.getElementById('sharing-selection-modal').classList.add('hidden');
        
        // Reset selections
        this.selectedDevice = null;
        this.selectedScreen = null;
        document.querySelectorAll('.device-option.selected, .screen-option.selected').forEach(el => {
            el.classList.remove('selected');
        });

        this.log(`Sharing-Anfrage gesendet: ${device.name} → ${this.selectedScreen}`, 'success');
    }

    getDeviceIcon(type) {
        switch (type) {
            case 'phone': return '📱';
            case 'tablet': return '📱';
            case 'laptop': return '💻';
            default: return '📱';
        }
    }

    createDeviceCard(device) {
        const card = document.createElement('div');
        card.className = `device-card ${device.status}`;
        card.setAttribute('data-device-id', device.id);
        
        const statusIcon = device.status === 'online' ? '🟢' : '🔴';
        const sharingStatus = this.activeSharing.has(device.id) ? 'sharing' : '';
        
        if (sharingStatus) {
            card.classList.add('sharing');
        }
        
        card.innerHTML = `
            <div class="device-header">
                <div class="device-name">${device.name}</div>
                <div class="device-status">
                    <span>${statusIcon}</span>
                    <span>${device.status === 'online' ? 'Online' : 'Offline'}</span>
                </div>
            </div>
            <div class="device-info">
                <div class="device-info-item">
                    <span class="device-info-label">Typ</span>
                    <span class="device-info-value">${this.getDeviceTypeLabel(device.type)}</span>
                </div>
                <div class="device-info-item">
                    <span class="device-info-label">Tisch</span>
                    <span class="device-info-value">Tisch ${device.table}</span>
                </div>
                <div class="device-info-item">
                    <span class="device-info-label">ID</span>
                    <span class="device-info-value">${device.id}</span>
                </div>
                <div class="device-info-item">
                    <span class="device-info-label">Letzter Kontakt</span>
                    <span class="device-info-value">${this.formatLastSeen(device.lastSeen)}</span>
                </div>
            </div>
            <div class="device-actions">
                <button class="btn btn-success" onclick="dashboard.requestSharing('${device.id}')" 
                        ${device.status !== 'online' ? 'disabled' : ''}>
                    Sharing anfordern
                </button>
                <button class="btn btn-danger" onclick="dashboard.stopDeviceSharing('${device.id}')"
                        ${!this.activeSharing.has(device.id) ? 'disabled' : ''}>
                    Sharing stoppen
                </button>
            </div>
        `;
        
        return card;
    }

    getDeviceTypeLabel(type) {
        const labels = {
            'phone': 'Smartphone',
            'tablet': 'Tablet', 
            'laptop': 'Laptop',
            'desktop': 'Desktop'
        };
        return labels[type] || type;
    }

    formatLastSeen(date) {
        if (!date) return 'Unbekannt';
        
        // Convert string to Date object if necessary
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        
        // Check if valid date
        if (isNaN(dateObj.getTime())) return 'Ungültiges Datum';
        
        const now = new Date();
        const diff = now - dateObj;
        
        if (diff < 60000) return 'Gerade eben';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} Min`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} Std`;
        return dateObj.toLocaleDateString();
    }

    updateDeviceStats() {
        const total = this.registeredDevices.size;
        const online = Array.from(this.registeredDevices.values()).filter(d => d.status === 'online').length;
        
        document.getElementById('total-devices').textContent = `${total} Geräte`;
        document.getElementById('online-devices').textContent = `${online} online`;
    }

    requestDeviceList() {
        this.sendMessage({
            type: 'request-device-list',
            timestamp: Date.now()
        });
        this.log('Geräteliste angefordert');
    }

    requestSharing(deviceId) {
        if (!this.registeredDevices.has(deviceId)) {
            this.log(`Gerät ${deviceId} nicht gefunden`, 'error');
            return;
        }

        const device = this.registeredDevices.get(deviceId);
        
        this.sendMessage({
            type: 'request-sharing',
            deviceId: deviceId,
            timestamp: Date.now()
        });
        
        this.log(`Sharing-Anfrage an ${device.name} gesendet`);
    }

    stopDeviceSharing(deviceId) {
        if (!this.activeSharing.has(deviceId)) {
            this.log(`Kein aktives Sharing für Gerät ${deviceId}`, 'error');
            return;
        }

        this.sendMessage({
            type: 'stop-sharing',
            deviceId: deviceId,
            timestamp: Date.now()
        });
        
        this.activeSharing.delete(deviceId);
        this.updateDevicesDisplay();
        this.log(`Sharing für Gerät ${deviceId} gestoppt`);
    }

    handleAdminConnected(message) {
        this.log(`Admin Dashboard verbunden: ${message.adminId}`, 'success');
        this.updateConnectionStatus(true);
    }

    handleDeviceRegistration(message) {
        const device = message.device || message.deviceInfo || {};
        this.addRegisteredDevice({
            id: message.deviceId || device.id,
            name: device.name || 'Unbekanntes Gerät',
            type: device.type || 'unknown',
            table: device.table || 1,
            capabilities: device.capabilities || {},
            userAgent: device.userAgent || 'Unknown'
        });
    }

    handleDeviceDisconnection(message) {
        if (this.registeredDevices.has(message.deviceId)) {
            const device = this.registeredDevices.get(message.deviceId);
            device.status = 'offline';
            device.lastSeen = new Date();
            this.updateDevicesDisplay();
            this.updateDeviceStats();
            this.log(`Gerät ${device.name} offline`, 'warning');
        }
    }

    handleSharingStarted(message) {
        this.activeSharing.set(message.deviceId, {
            startTime: new Date(),
            screen: message.screen || 'unknown'
        });
        
        // Establish WebRTC connection to receive the stream
        this.setupViewerConnection(message.deviceId);
        
        this.updateDevicesDisplay();
        this.log(`Sharing gestartet: Gerät ${message.deviceId}`, 'success');
    }

    setupViewerConnection(deviceId) {
        try {
            const peerConnection = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' }
                ]
            });

            // Handle incoming stream
            peerConnection.ontrack = (event) => {
                this.displayStreamOnScreen(deviceId, event.streams[0]);
            };

            // Handle ICE candidates
            peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    this.sendMessage({
                        type: 'admin-ice-candidate',
                        deviceId: deviceId,
                        candidate: event.candidate
                    });
                }
            };

            this.activePeerConnections.set(deviceId, peerConnection);

            // Request offer from device
            this.sendMessage({
                type: 'admin-request-stream',
                deviceId: deviceId
            });

        } catch (error) {
            this.log(`Fehler beim Einrichten der Viewer-Verbindung: ${error.message}`, 'error');
        }
    }

    displayStreamOnScreen(deviceId, stream, targetScreen = null) {
        console.log(`Attempting to display stream for device ${deviceId} on screen ${targetScreen}`);
        
        // Use specific screen if provided, otherwise find available
        let screenElement;
        
        if (targetScreen) {
            screenElement = document.querySelector(`[data-screen="${targetScreen}"]`);
            console.log(`Looking for screen element with data-screen="${targetScreen}"`);
        }
        
        if (!screenElement) {
            // Try to find any available screen
            screenElement = this.findAvailableScreen();
            console.log('Using available screen:', screenElement);
        }
        
        if (screenElement) {
            // Create video element with better autoplay handling
            const video = document.createElement('video');
            video.srcObject = stream;
            video.autoplay = true;
            video.muted = true; // Required for autoplay in most browsers
            video.playsInline = true; // Required for mobile
            video.controls = false;
            video.style.width = '100%';
            video.style.height = '100%';
            video.style.objectFit = 'contain';
            video.style.backgroundColor = '#000';
            
            // Add event listeners for better control
            video.addEventListener('loadedmetadata', () => {
                console.log('Video metadata loaded');
            });
            
            video.addEventListener('canplay', () => {
                console.log('Video can start playing');
            });
            
            // Clear existing content and add video
            const screenContent = screenElement.querySelector('.screen-content');
            if (!screenContent) {
                console.error('No .screen-content found in screen element');
                return;
            }
            
            screenContent.innerHTML = '';
            screenContent.classList.add('has-stream');
            screenContent.appendChild(video);
            
            // Add device info overlay
            const deviceInfo = document.createElement('div');
            deviceInfo.className = 'stream-info';
            deviceInfo.style.position = 'absolute';
            deviceInfo.style.top = '10px';
            deviceInfo.style.left = '10px';
            deviceInfo.style.background = 'rgba(0,0,0,0.7)';
            deviceInfo.style.color = 'white';
            deviceInfo.style.padding = '5px 10px';
            deviceInfo.style.borderRadius = '5px';
            deviceInfo.style.fontSize = '12px';
            deviceInfo.style.zIndex = '10';
            
            const deviceName = this.registeredDevices.get(deviceId)?.name || deviceId;
            deviceInfo.textContent = `Live: ${deviceName}`;
            screenContent.appendChild(deviceInfo);
            
            // Add stream controls
            const controls = document.createElement('div');
            controls.className = 'stream-controls';
            controls.style.position = 'absolute';
            controls.style.bottom = '10px';
            controls.style.right = '10px';
            controls.style.display = 'flex';
            controls.style.gap = '5px';
            controls.style.zIndex = '10';
            
            const stopBtn = document.createElement('button');
            stopBtn.textContent = '⏹️';
            stopBtn.title = 'Stream stoppen';
            stopBtn.style.background = 'rgba(255,0,0,0.7)';
            stopBtn.style.color = 'white';
            stopBtn.style.border = 'none';
            stopBtn.style.padding = '5px 10px';
            stopBtn.style.borderRadius = '3px';
            stopBtn.style.cursor = 'pointer';
            stopBtn.onclick = () => this.stopDeviceStream(deviceId);
            
            const fullscreenBtn = document.createElement('button');
            fullscreenBtn.textContent = '⛶';
            fullscreenBtn.title = 'Vollbild';
            fullscreenBtn.style.background = 'rgba(0,0,255,0.7)';
            fullscreenBtn.style.color = 'white';
            fullscreenBtn.style.border = 'none';
            fullscreenBtn.style.padding = '5px 10px';
            fullscreenBtn.style.borderRadius = '3px';
            fullscreenBtn.style.cursor = 'pointer';
            fullscreenBtn.onclick = () => video.requestFullscreen?.();
            
            controls.appendChild(stopBtn);
            controls.appendChild(fullscreenBtn);
            screenContent.appendChild(controls);
            
            // Store stream reference
            this.videoStreams.set(deviceId, {
                stream: stream,
                screenElement: screenElement,
                video: video,
                targetScreen: targetScreen || screenElement.getAttribute('data-screen')
            });
            
            console.log(`✅ Live-Stream successfully displayed for ${deviceName}`);
            this.log(`Live-Stream angezeigt für ${deviceName} auf ${targetScreen || 'verfügbarem Display'}`, 'success');
            
            // Better video autoplay handling
            const playVideo = async () => {
                try {
                    // Ensure video is not paused before playing
                    if (video.paused) {
                        await video.play();
                        console.log('✅ Video autoplay successful');
                    }
                } catch (error) {
                    if (error.name === 'AbortError') {
                        console.log('⚠️ Video play was interrupted - retrying...');
                        // Wait a bit and try again
                        setTimeout(() => {
                            if (video.paused) {
                                video.play().catch(e => console.log('Video autoplay still prevented:', e.name));
                            }
                        }, 100);
                    } else {
                        console.log('Video autoplay prevented:', error.name);
                        // Add click-to-play fallback
                        this.addClickToPlayFallback(video, screenElement);
                    }
                }
            };
            
            playVideo();
            
        } else {
            console.error('❌ No screen element found for stream display');
            this.log('Ziel-Display nicht verfügbar', 'warning');
        }
    }

    addClickToPlayFallback(video, screenElement) {
        // Create click-to-play overlay
        const overlay = document.createElement('div');
        overlay.className = 'click-to-play-overlay';
        overlay.innerHTML = `
            <div class="play-button">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="white">
                    <path d="M8 5v14l11-7z"/>
                </svg>
                <p style="color: white; margin-top: 10px;">Klicken zum Abspielen</p>
            </div>
        `;
        overlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 1000;
            text-align: center;
        `;
        
        overlay.addEventListener('click', () => {
            video.play().then(() => {
                overlay.remove();
                console.log('✅ Video started after user interaction');
            }).catch(e => console.log('Still could not play video:', e));
        });
        
        // Add overlay to screen element
        const container = screenElement.querySelector('.screen-content') || screenElement;
        container.style.position = 'relative';
        container.appendChild(overlay);
    }

    stopDeviceStream(deviceId) {
        this.sendMessage({
            type: 'stop-sharing',
            deviceId: deviceId
        });
        this.cleanupDeviceStream(deviceId);
    }

    findAvailableScreen() {
        // Look for screens with data-screen attribute
        const screens = document.querySelectorAll('[data-screen]');
        console.log(`Found ${screens.length} screen elements with data-screen attribute`);
        
        for (const screen of screens) {
            const screenContent = screen.querySelector('.screen-content');
            if (screenContent) {
                const noContent = screenContent.querySelector('.no-content');
                const hasStream = screenContent.classList.contains('has-stream');
                
                if (noContent || (!hasStream && screenContent.children.length === 0)) {
                    console.log(`Available screen found: ${screen.getAttribute('data-screen')}`);
                    return screen;
                }
            }
        }
        
        // If no screen with data-screen found, look for any .screen element
        const genericScreens = document.querySelectorAll('.screen .screen-content');
        console.log(`Found ${genericScreens.length} generic screen elements`);
        
        for (const screenContent of genericScreens) {
            const noContent = screenContent.querySelector('.no-content');
            const hasStream = screenContent.classList.contains('has-stream');
            
            if (noContent || (!hasStream && screenContent.children.length === 0)) {
                const screen = screenContent.closest('.screen');
                if (screen) {
                    console.log(`Available generic screen found`);
                    return screen;
                }
            }
        }
        
        console.log('No available screen found');
        return null;
    }

    findAvailableScreenId() {
        const screenElement = this.findAvailableScreen();
        if (screenElement) {
            return screenElement.getAttribute('data-screen') || '1-1';
        }
        return '1-1'; // Default to first screen
    }

    handleSharingStopped(message) {
        this.activeSharing.delete(message.deviceId);
        
        // Clean up WebRTC connection and video stream
        this.cleanupDeviceStream(message.deviceId);
        
        this.updateDevicesDisplay();
        this.log(`Sharing gestoppt: Gerät ${message.deviceId}`, 'info');
    }

    cleanupDeviceStream(deviceId) {
        // Remove video stream
        if (this.videoStreams.has(deviceId)) {
            const streamData = this.videoStreams.get(deviceId);
            
            // Stop the video
            if (streamData.video) {
                streamData.video.srcObject = null;
                streamData.video.pause();
            }
            
            // Clear screen content and remove stream class
            if (streamData.screenElement) {
                const screenContent = streamData.screenElement.querySelector('.screen-content');
                screenContent.classList.remove('has-stream');
                
                // Remove any click-to-play overlays
                const overlays = screenContent.querySelectorAll('.click-to-play-overlay');
                overlays.forEach(overlay => overlay.remove());
                
                screenContent.innerHTML = '<span class="no-content">Kein Inhalt</span>';
            }
            
            this.videoStreams.delete(deviceId);
        }
        
        // Close peer connection
        if (this.activePeerConnections.has(deviceId)) {
            const peerConnection = this.activePeerConnections.get(deviceId);
            peerConnection.close();
            this.activePeerConnections.delete(deviceId);
        }
    }

    handleDeviceList(message) {
        // Clear existing devices
        this.registeredDevices.clear();
        
        // Add all devices from server
        if (message.devices && Array.isArray(message.devices)) {
            message.devices.forEach(device => {
                this.registeredDevices.set(device.id, device);
            });
        }
        
        this.updateDevicesDisplay();
        this.updateDeviceStats();
        this.log(`Geräteliste aktualisiert: ${this.registeredDevices.size} Geräte`);
    }
}

// Initialize dashboard when page loads
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new AdminDashboard();
});

// Make dashboard available globally for HTML onclick handlers
window.dashboard = dashboard;
window.dashboard = dashboard;
