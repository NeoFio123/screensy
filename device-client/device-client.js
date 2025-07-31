class DeviceClient {
    constructor() {
        this.deviceId = null;
        this.deviceInfo = null;
        this.webSocket = null;
        this.mediaStream = null;
        this.peerConnection = null;
        this.isRegistered = false;
        this.isSharing = false;
        this.pendingPermissionRequest = null;
        this.selectedScreen = null;
        
        this.init();
    }

    init() {
        this.detectDevice();
        this.checkBrowserCompatibility();
        this.setupEventListeners();
        this.connectToServer();
        this.updateConnectionStatus(false);
        this.log('Device Client gestartet');
        
        // Try to restore device info from localStorage
        this.restoreDeviceInfo();
    }

    selectCaptureType(type) {
        this.hideModal('capture-selection-modal');
        
        if (type === 'camera') {
            this.startMobileCameraCapture();
        } else {
            this.startScreenCapture(type);
        }
    }

    checkBrowserCompatibility() {
        const issues = [];
        const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
        
        // Check WebRTC support
        if (!window.RTCPeerConnection) {
            issues.push('WebRTC wird nicht unterstützt');
        }
        
        // Check WebSocket support
        if (!window.WebSocket) {
            issues.push('WebSocket wird nicht unterstützt');
        }
        
        // Check Screen Capture support
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
            if (isMobile) {
                // Mobile fallback to camera
                if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                    this.log('Screen Sharing nicht verfügbar - Kamera wird als Fallback verwendet', 'warning');
                    // Update UI for mobile
                    const shareButtons = document.querySelectorAll('#share-screen, #share-window, #share-tab');
                    shareButtons.forEach(btn => btn.textContent = btn.textContent.replace('Bildschirm', 'Kamera'));
                    document.getElementById('share-screen').textContent = 'Kamera teilen';
                } else {
                    issues.push('Kamera-Zugriff wird nicht unterstützt');
                    document.getElementById('start-sharing').disabled = true;
                    document.getElementById('start-sharing').textContent = 'Nicht verfügbar';
                }
            } else {
                issues.push('Screen Sharing wird nicht unterstützt');
                document.getElementById('start-sharing').disabled = true;
                document.getElementById('start-sharing').textContent = 'Nicht verfügbar';
            }
            
            // Show compatibility warning
            const warning = document.getElementById('browser-compatibility');
            if (warning) {
                warning.style.display = 'block';
                if (isMobile) {
                    warning.querySelector('.compatibility-warning').innerHTML = `
                        📱 <strong>Mobile Gerät erkannt</strong><br>
                        Screen Sharing nicht verfügbar - Kamera wird verwendet<br>
                        <small>Für echtes Screen Sharing verwenden Sie einen Desktop-Browser</small>
                    `;
                }
            }
        }
        
        if (issues.length > 0) {
            this.log(`Browser-Kompatibilitätsprobleme: ${issues.join(', ')}`, 'warning');
        } else {
            this.log(`Browser ist kompatibel${isMobile ? ' (mobile Optimierung aktiv)' : ''}`, 'success');
        }
    }

    detectDevice() {
        const userAgent = navigator.userAgent.toLowerCase();
        const container = document.querySelector('.device-container');
        
        if (userAgent.includes('mobile') || userAgent.includes('android') || userAgent.includes('iphone')) {
            container.classList.add('device-phone');
            this.suggestDeviceType('phone');
        } else if (userAgent.includes('tablet') || userAgent.includes('ipad')) {
            container.classList.add('device-tablet');
            this.suggestDeviceType('tablet');
        } else {
            container.classList.add('device-laptop');
            this.suggestDeviceType('laptop');
        }
    }

    suggestDeviceType(type) {
        const select = document.getElementById('reg-device-type');
        select.value = type;
    }

    setupEventListeners() {
        // Registration form
        const registrationForm = document.getElementById('device-registration-form');
        registrationForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.registerDevice();
        });

        // Sharing controls
        document.getElementById('start-sharing').addEventListener('click', () => {
            this.startSharing();
        });

        document.getElementById('stop-sharing').addEventListener('click', () => {
            this.stopSharing();
        });

        // Log controls
        document.getElementById('clear-device-logs').addEventListener('click', () => {
            this.clearLogs();
        });

        // Permission modal handlers
        document.getElementById('allow-sharing').addEventListener('click', () => {
            this.handlePermissionResponse(true);
        });

        document.getElementById('deny-sharing').addEventListener('click', () => {
            this.handlePermissionResponse(false);
        });

        // Capture selection modal
        document.getElementById('share-screen').addEventListener('click', () => {
            this.selectCaptureType('screen');
        });

        document.getElementById('share-window').addEventListener('click', () => {
            this.selectCaptureType('window');
        });

        document.getElementById('share-tab').addEventListener('click', () => {
            this.selectCaptureType('tab');
        });

        document.getElementById('share-camera').addEventListener('click', () => {
            this.selectCaptureType('camera');
        });

        document.getElementById('cancel-capture').addEventListener('click', () => {
            this.hideModal('capture-selection-modal');
        });

        // Error modal
        document.getElementById('close-error').addEventListener('click', () => {
            this.hideModal('error-modal');
        });

        // Page visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.isSharing) {
                this.log('App versteckt - Sharing könnte unterbrochen werden', 'warning');
            }
        });

        // Before unload
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });

        // Screen selection handlers
        document.querySelectorAll('.screen-option').forEach(option => {
            option.addEventListener('click', () => {
                this.selectTargetScreen(option.dataset.screen);
            });
        });
    }

    connectToServer() {
        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            // Use the same host as the webpage for WebSocket connection
            const host = window.location.hostname;
            const wsUrl = `${protocol}//${host}:4002/`;
            
            this.log(`Verbinde zu WebSocket: ${wsUrl}`, 'info');
            this.webSocket = new WebSocket(wsUrl);
            
            this.webSocket.onopen = () => {
                this.updateConnectionStatus(true);
                this.log('Verbindung zum Server hergestellt', 'success');
                
                // Re-register if we were registered before
                if (this.isRegistered && this.deviceInfo) {
                    this.sendDeviceRegistration();
                }
            };

            this.webSocket.onmessage = (event) => {
                this.handleServerMessage(JSON.parse(event.data));
            };

            this.webSocket.onclose = () => {
                this.updateConnectionStatus(false);
                this.log('Verbindung zum Server getrennt', 'error');
                
                // Try to reconnect after 3 seconds
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
        switch (message.type) {
            case 'registration-success':
                this.handleRegistrationSuccess(message);
                break;
            case 'registration-failed':
                this.handleRegistrationError(message);
                break;
            case 'sharing-request':
                this.handleSharingRequest(message);
                break;
            case 'sharing-approved':
                this.handleSharingApproved(message);
                break;
            case 'sharing-denied':
                this.handleSharingDenied(message);
                break;
            case 'stop-sharing':
                this.handleStopSharing(message);
                break;
            case 'admin-stream-request':
                this.handleAdminStreamRequest(message);
                break;
            case 'admin-stream-answer':
                this.handleAdminStreamAnswer(message);
                break;
            case 'admin-ice-candidate':
                this.handleAdminIceCandidate(message);
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
            default:
                console.log('Unbekannte Nachricht:', message);
        }
    }

    registerDevice() {
        console.log('Registrierung gestartet...');
        
        const deviceName = document.getElementById('reg-device-name').value.trim();
        const deviceType = document.getElementById('reg-device-type').value;
        const tableNumber = document.getElementById('reg-table-number').value;

        console.log('Formulardaten:', { deviceName, deviceType, tableNumber });

        if (!deviceName || !deviceType || !tableNumber) {
            this.showError('Bitte füllen Sie alle Felder aus');
            console.error('Fehlende Formulardaten');
            return;
        }

        this.deviceInfo = {
            name: deviceName,
            type: deviceType,
            table: tableNumber,
            userAgent: navigator.userAgent,
            capabilities: this.getDeviceCapabilities()
        };

        console.log('Geräte-Info erstellt:', this.deviceInfo);
        this.sendDeviceRegistration();
        this.log(`Registrierung gesendet: ${this.deviceInfo.name} (Tisch ${this.deviceInfo.table})`);
    }

    sendDeviceRegistration() {
        if (!this.deviceInfo) {
            console.error('Keine Geräte-Info verfügbar');
            this.showError('Keine Geräte-Info verfügbar');
            return;
        }

        console.log('Sende Registrierung an Server:', this.deviceInfo);

        const message = {
            type: 'register-device',
            deviceInfo: this.deviceInfo,
            timestamp: Date.now()
        };

        console.log('Nachricht an Server:', message);
        this.sendMessage(message);
        
        // Visual feedback
        const button = document.querySelector('#device-registration-form button[type="submit"]');
        const originalText = button.textContent;
        button.textContent = 'Registriere...';
        button.disabled = true;
        
        // Reset button after 3 seconds if no response
        setTimeout(() => {
            if (!this.isRegistered) {
                button.textContent = originalText;
                button.disabled = false;
            }
        }, 3000);
    }

    getDeviceCapabilities() {
        return {
            screenCapture: navigator.mediaDevices && 'getDisplayMedia' in navigator.mediaDevices,
            webRTC: 'RTCPeerConnection' in window,
            webSocket: 'WebSocket' in window,
            mediaDevices: 'mediaDevices' in navigator
        };
    }

    handleRegistrationSuccess(message) {
        console.log('Registrierung erfolgreich:', message);
        
        this.deviceId = message.deviceId;
        this.isRegistered = true;
        
        // Update UI
        document.getElementById('device-id').textContent = this.deviceId;
        document.getElementById('device-type').textContent = this.deviceInfo.type;
        document.getElementById('table-number').textContent = this.deviceInfo.table;
        document.getElementById('device-name').textContent = this.deviceInfo.name;
        
        // Enable sharing controls
        document.getElementById('start-sharing').disabled = false;
        
        // Update registration button
        const button = document.querySelector('#device-registration-form button[type="submit"]');
        button.textContent = 'Registriert ✓';
        button.disabled = true;
        button.style.backgroundColor = '#28a745';
        
        // Hide registration form
        document.querySelector('.registration-card').style.display = 'none';
        
        // Save to localStorage
        this.saveDeviceInfo();
        
        this.log(`Gerät erfolgreich registriert: ${this.deviceInfo.name} (ID: ${this.deviceId})`, 'success');
    }

    handleRegistrationError(message) {
        this.showError(`Registrierung fehlgeschlagen: ${message.error || 'Unbekannter Fehler'}`);
        this.log(`Registrierung fehlgeschlagen: ${message.error}`, 'error');
    }

    handleSharingRequest(message) {
        this.pendingPermissionRequest = message;
        this.showModal('permission-request-modal');
        this.log(`Sharing-Anfrage vom Admin erhalten`, 'warning');
    }

    handlePermissionResponse(allowed) {
        if (!this.pendingPermissionRequest) return;

        this.sendMessage({
            type: 'permission-response',
            requestId: this.pendingPermissionRequest.requestId,
            allowed: allowed,
            timestamp: Date.now()
        });

        if (allowed) {
            this.log('Sharing-Berechtigung erteilt', 'success');
            this.hideModal('permission-request-modal');
            this.showModal('capture-selection-modal');
        } else {
            this.log('Sharing-Berechtigung verweigert', 'warning');
            this.hideModal('permission-request-modal');
        }

        this.pendingPermissionRequest = null;
    }

    selectCaptureType(type) {
        this.hideModal('capture-selection-modal');
        this.startScreenCapture(type);
    }

    async startScreenCapture(type = 'screen') {
        try {
            // Check if screen capture is supported
            if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
                // For mobile devices without getDisplayMedia, try getUserMedia with video
                return this.startMobileCameraCapture();
            }

            let constraints = {
                video: {
                    width: { ideal: 1920, max: 1920 },
                    height: { ideal: 1080, max: 1080 },
                    frameRate: { ideal: 30, max: 30 }
                },
                audio: true
            };

            // Adjust constraints based on capture type
            if (type === 'tab') {
                constraints.video.mediaSource = 'browser';
            } else if (type === 'window') {
                constraints.video.mediaSource = 'window';
            } else {
                constraints.video.mediaSource = 'screen';
            }

            this.log(`Starte Screen Capture (${type})...`);
            this.mediaStream = await navigator.mediaDevices.getDisplayMedia(constraints);
            
            // Show preview
            const preview = document.getElementById('local-preview');
            preview.srcObject = this.mediaStream;
            
            // Track when sharing stops
            this.mediaStream.getVideoTracks()[0].addEventListener('ended', () => {
                this.handleStreamEnded();
            });

            this.updateSharingStatus('sharing');
            this.log(`Screen Capture gestartet (${type})`, 'success');
            
            // Start WebRTC connection
            this.setupWebRTCConnection();
            
        } catch (error) {
            this.handleCaptureError(error);
        }
    }

    async startMobileCameraCapture() {
        try {
            this.log('Screen Sharing nicht verfügbar - verwende Kamera...', 'warning');
            
            const constraints = {
                video: {
                    width: { ideal: 1280, max: 1920 },
                    height: { ideal: 720, max: 1080 },
                    frameRate: { ideal: 30 },
                    facingMode: 'environment' // Use back camera
                },
                audio: true
            };

            this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
            
            // Show preview
            const preview = document.getElementById('local-preview');
            preview.srcObject = this.mediaStream;
            
            // Track when sharing stops
            this.mediaStream.getVideoTracks()[0].addEventListener('ended', () => {
                this.handleStreamEnded();
            });

            this.updateSharingStatus('sharing');
            this.log('Kamera-Sharing gestartet (mobile Fallback)', 'success');
            
            // Start WebRTC connection
            this.setupWebRTCConnection();
            
        } catch (error) {
            this.handleCaptureError(error);
        }
    }

    handleCaptureError(error) {
        console.error('Screen Capture Fehler:', error);
        this.log(`Screen Capture Fehler: ${error.message}`, 'error');
        this.updateSharingStatus('error');
        
        let userMessage = '';
        
        if (error.name === 'NotAllowedError') {
            userMessage = 'Berechtigung für Screen Sharing wurde verweigert. Klicken Sie auf "Erlauben" wenn der Browser nach Berechtigungen fragt.';
        } else if (error.name === 'NotSupportedError') {
            userMessage = 'Screen Sharing wird von diesem Browser nicht unterstützt. Verwenden Sie Chrome, Firefox oder Edge.';
        } else if (error.message.includes('nicht unterstützt')) {
            userMessage = error.message + '\n\nTipp: Verwenden Sie einen modernen Browser wie Chrome, Firefox oder Edge.';
        } else {
            userMessage = `Screen Capture Fehler: ${error.message}\n\nStellen Sie sicher, dass Sie einen modernen Browser verwenden und alle Berechtigungen erteilt haben.`;
        }
        
        this.showError(userMessage);
        
        // Reset sharing controls
        document.getElementById('start-sharing').disabled = false;
        document.getElementById('stop-sharing').disabled = true;
    }

    setupWebRTCConnection() {
        this.peerConnection = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'turn:' + window.location.hostname, username: 'screensy', credential: 'screensy' }
            ]
        });

        // Add media stream to connection
        this.mediaStream.getTracks().forEach(track => {
            this.peerConnection.addTrack(track, this.mediaStream);
        });

        // Handle ICE candidates
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendMessage({
                    type: 'webrtc-candidate',
                    candidate: event.candidate,
                    timestamp: Date.now()
                });
            }
        };

        // Handle connection state changes
        this.peerConnection.onconnectionstatechange = () => {
            const state = this.peerConnection.connectionState;
            this.log(`WebRTC Verbindungsstatus: ${state}`);
            
            if (state === 'connected') {
                this.updateSharingStatus('sharing');
            } else if (state === 'disconnected' || state === 'failed') {
                this.updateSharingStatus('error');
            }
        };

        // Create and send offer
        this.createAndSendOffer();
    }

    async createAndSendOffer() {
        try {
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            
            this.sendMessage({
                type: 'webrtc-offer',
                offer: offer,
                targetScreen: this.selectedScreen,
                timestamp: Date.now()
            });
            
            this.log('WebRTC Offer gesendet');
        } catch (error) {
            this.log(`WebRTC Offer Fehler: ${error.message}`, 'error');
        }
    }

    async handleWebRTCAnswer(message) {
        try {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(message.answer));
            this.log('WebRTC Answer empfangen');
        } catch (error) {
            this.log(`WebRTC Answer Fehler: ${error.message}`, 'error');
        }
    }

    async handleWebRTCCandidate(message) {
        try {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate));
        } catch (error) {
            this.log(`WebRTC Candidate Fehler: ${error.message}`, 'error');
        }
    }

    startSharing() {
        if (!this.isRegistered) {
            this.showError('Gerät muss zuerst registriert werden');
            return;
        }

        if (!this.selectedScreen) {
            this.showError('Bitte wählen Sie zuerst ein Ziel-Display aus');
            return;
        }

        this.showModal('capture-selection-modal');
    }

    stopSharing() {
        this.cleanup();
        this.updateSharingStatus('ready');
        
        this.sendMessage({
            type: 'stop-sharing',
            timestamp: Date.now()
        });
        
        this.log('Screen Sharing gestoppt', 'warning');
    }

    selectTargetScreen(screenId) {
        // Remove selection from all screens
        document.querySelectorAll('.screen-option').forEach(option => {
            option.classList.remove('selected');
        });

        // Add selection to clicked screen
        const selectedOption = document.querySelector(`[data-screen="${screenId}"]`);
        if (selectedOption) {
            selectedOption.classList.add('selected');
            this.selectedScreen = screenId;
            
            // Update selection text
            const screenLabel = selectedOption.querySelector('.screen-label').textContent;
            document.getElementById('selected-screen-text').textContent = `Ausgewählt: ${screenLabel}`;
            
            // Enable start sharing button
            document.getElementById('start-sharing').disabled = false;
            
            this.log(`Ziel-Display ausgewählt: ${screenLabel}`, 'success');
        }
    }

    handleStreamEnded() {
        this.log('Screen Sharing vom Benutzer beendet', 'warning');
        this.stopSharing();
    }

    handleStopSharing(message) {
        this.log('Sharing vom Admin gestoppt', 'warning');
        this.cleanup();
        this.updateSharingStatus('ready');
    }

    cleanup() {
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }

        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        const preview = document.getElementById('local-preview');
        preview.srcObject = null;

        this.isSharing = false;
        document.getElementById('start-sharing').disabled = false;
        document.getElementById('stop-sharing').disabled = true;
    }

    updateSharingStatus(status) {
        const indicator = document.getElementById('sharing-indicator');
        const statusText = document.getElementById('sharing-status');
        const startBtn = document.getElementById('start-sharing');
        const stopBtn = document.getElementById('stop-sharing');

        indicator.className = `sharing-indicator ${status}`;

        switch (status) {
            case 'ready':
                indicator.querySelector('.indicator-text').textContent = 'Bereit für Sharing';
                statusText.textContent = 'Bereit';
                startBtn.disabled = false;
                stopBtn.disabled = true;
                this.isSharing = false;
                break;
            case 'sharing':
                indicator.querySelector('.indicator-text').textContent = 'Sharing aktiv';
                statusText.textContent = 'Sharing läuft';
                startBtn.disabled = true;
                stopBtn.disabled = false;
                this.isSharing = true;
                break;
            case 'error':
                indicator.querySelector('.indicator-text').textContent = 'Fehler beim Sharing';
                statusText.textContent = 'Fehler';
                startBtn.disabled = false;
                stopBtn.disabled = true;
                this.isSharing = false;
                break;
        }
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

    showError(message) {
        document.getElementById('error-message').textContent = message;
        this.showModal('error-modal');
        this.log(`Fehler: ${message}`, 'error');
    }

    sendMessage(message) {
        if (this.webSocket && this.webSocket.readyState === WebSocket.OPEN) {
            message.deviceId = this.deviceId;
            this.webSocket.send(JSON.stringify(message));
        } else {
            this.log('Keine Verbindung zum Server', 'error');
        }
    }

    log(message, type = 'info') {
        const logs = document.getElementById('device-logs');
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        
        const timestamp = new Date().toLocaleTimeString();
        logEntry.textContent = `[${timestamp}] ${message}`;
        
        logs.appendChild(logEntry);
        logs.scrollTop = logs.scrollHeight;

        // Keep only last 50 log entries
        const entries = logs.querySelectorAll('.log-entry');
        if (entries.length > 50) {
            entries[0].remove();
        }
    }

    clearLogs() {
        const logs = document.getElementById('device-logs');
        logs.innerHTML = '<div class="log-entry">Logs gelöscht</div>';
    }

    saveDeviceInfo() {
        if (this.deviceInfo) {
            localStorage.setItem('deviceInfo', JSON.stringify({
                ...this.deviceInfo,
                deviceId: this.deviceId,
                isRegistered: this.isRegistered
            }));
        }
    }

    restoreDeviceInfo() {
        try {
            const saved = localStorage.getItem('deviceInfo');
            if (saved) {
                const data = JSON.parse(saved);
                this.deviceInfo = data;
                this.deviceId = data.deviceId;
                this.isRegistered = data.isRegistered;

                if (this.isRegistered) {
                    // Update UI
                    document.getElementById('reg-device-name').value = data.name;
                    document.getElementById('reg-device-type').value = data.type;
                    document.getElementById('reg-table-number').value = data.table;
                    
                    this.handleRegistrationSuccess({ deviceId: this.deviceId });
                    this.log('Geräteinformationen wiederhergestellt', 'success');
                }
            }
        } catch (error) {
            this.log('Fehler beim Wiederherstellen der Geräteinformationen', 'warning');
        }
    }

    // Admin stream handling methods
    handleAdminStreamRequest(message) {
        try {
            if (this.mediaStream && this.isSharing) {
                // Create peer connection for admin
                const adminPeerConnection = new RTCPeerConnection({
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' }
                    ]
                });

                // Add stream to peer connection
                this.mediaStream.getTracks().forEach(track => {
                    adminPeerConnection.addTrack(track, this.mediaStream);
                });

                // Handle ICE candidates
                adminPeerConnection.onicecandidate = (event) => {
                    if (event.candidate) {
                        this.sendMessage({
                            type: 'admin-stream-offer',
                            deviceId: this.deviceId,
                            candidate: event.candidate
                        });
                    }
                };

                // Create offer for admin
                adminPeerConnection.createOffer()
                    .then(offer => {
                        return adminPeerConnection.setLocalDescription(offer);
                    })
                    .then(() => {
                        this.sendMessage({
                            type: 'admin-stream-offer',
                            deviceId: this.deviceId,
                            offer: adminPeerConnection.localDescription
                        });
                    })
                    .catch(error => {
                        this.log(`Fehler beim Erstellen des Admin Stream Offers: ${error.message}`, 'error');
                    });

                // Store admin peer connection
                this.adminPeerConnection = adminPeerConnection;
                this.log('Admin Stream Request verarbeitet', 'info');
            } else {
                this.log('Kein aktiver Stream für Admin verfügbar', 'warning');
            }
        } catch (error) {
            this.log(`Fehler beim Verarbeiten der Admin Stream Anfrage: ${error.message}`, 'error');
        }
    }

    handleAdminStreamAnswer(message) {
        try {
            if (this.adminPeerConnection) {
                this.adminPeerConnection.setRemoteDescription(new RTCSessionDescription(message.answer))
                    .catch(error => {
                        this.log(`Fehler beim Setzen der Admin Stream Answer: ${error.message}`, 'error');
                    });
            }
        } catch (error) {
            this.log(`Fehler beim Verarbeiten der Admin Stream Answer: ${error.message}`, 'error');
        }
    }

    handleAdminIceCandidate(message) {
        try {
            if (this.adminPeerConnection && message.candidate) {
                this.adminPeerConnection.addIceCandidate(new RTCIceCandidate(message.candidate))
                    .catch(error => {
                        this.log(`Fehler beim Hinzufügen des Admin ICE Candidates: ${error.message}`, 'error');
                    });
            }
        } catch (error) {
            this.log(`Fehler beim Verarbeiten des Admin ICE Candidates: ${error.message}`, 'error');
        }
    }
}

// Initialize device client when page loads
let deviceClient;
document.addEventListener('DOMContentLoaded', () => {
    deviceClient = new DeviceClient();
});

// Make device client available globally
window.deviceClient = deviceClient;
