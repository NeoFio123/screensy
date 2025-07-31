# Enhanced Screensy - Shop Screen Sharing System

Ein vollständiges Screen Sharing System für Geschäfte mit Admin Dashboard und Geräte-Management.

## Features

### ✅ Admin Dashboard
- **Übersicht über alle Tische und Geräte**
- **Echtzeit-Gerätestatus** (Online/Offline)
- **Screen Sharing Steuerung**
- **Geräte-zu-Display Zuordnung**
- **Live WebRTC Verbindungen**

### ✅ Geräte-Client
- **Automatische Geräteerkennung** (Phone/Tablet/Laptop)
- **Einfache Registrierung**
- **Permission-basiertes Screen Sharing**
- **Multi-Platform Unterstützung** (iOS, Android, Windows, Mac)

### ✅ Original Screensy Funktionalität
- **Peer-to-Peer Screen Sharing**
- **Verschlüsselte Verbindungen**
- **WebRTC basiert**

## Schnellstart

### Windows
```bash
# 1. Alle Dienste starten
start-shop-system.bat

# 2. Zugriff über Browser:
# - Admin Dashboard: http://localhost:8080/admin
# - Device Client: http://localhost:8080/device
# - Original Screensy: http://localhost:8080/
```

### Linux/Mac
```bash
# 1. Ausführbar machen
chmod +x start-shop-system.sh

# 2. Alle Dienste starten  
./start-shop-system.sh
```

## System Architektur

```
Shop Screen Sharing System
├── Admin Dashboard (Port 8080/admin)
│   ├── Tisch-Übersicht (3 Tische)
│   ├── Geräte-Management (6 Geräte pro Tisch)
│   ├── Display-Steuerung (2 Displays pro Tisch)
│   └── WebSocket (Port 4001)
│
├── Device Client (Port 8080/device)
│   ├── Registrierung
│   ├── Screen Capture
│   ├── Permission Handling
│   └── WebSocket (Port 4002)
│
├── Original Screensy (Port 8080/)
│   ├── P2P Screen Sharing
│   └── WebSocket (Port 4000)
│
└── Backend Services
    ├── Go Web Server (Port 8080)
    ├── Enhanced Node.js Server (Ports 4000-4002)
    └── TURN/STUN Server (Port 3478)
```

## Verwendung

### Als Trainer (Admin)

1. **Öffnen Sie das Admin Dashboard:**
   ```
   http://localhost:8080/admin
   ```

2. **Geräte überwachen:**
   - Sehen Sie alle registrierten Geräte pro Tisch
   - Status wird in Echtzeit angezeigt (grün = online)

3. **Screen Sharing starten:**
   - Klicken Sie auf ein Gerät (wird blau markiert)
   - Klicken Sie auf einen Display (wird grün markiert)  
   - Klicken Sie "Berechtigung anfragen"
   - Das Gerät erhält eine Anfrage
   - Nach Bestätigung startet das Sharing

4. **Session kontrollieren:**
   - Wechseln zwischen Geräten
   - Stoppen des Sharings
   - Echtzeit-Logs verfolgen

### Als Teilnehmer (Device)

1. **Öffnen Sie den Device Client:**
   ```
   http://localhost:8080/device
   ```

2. **Gerät registrieren:**
   - Geben Sie einen Namen ein (z.B. "iPhone 1")
   - Wählen Sie den Gerätetyp
   - Wählen Sie den Tisch
   - Klicken Sie "Registrieren"

3. **Screen Sharing:**
   - Warten Sie auf Anfrage vom Trainer
   - Bestätigen Sie die Berechtigung
   - Wählen Sie was geteilt werden soll:
     - Gesamter Bildschirm
     - Einzelnes Fenster  
     - Browser Tab

4. **Status überwachen:**
   - Sharing-Status wird angezeigt
   - Vorschau des geteilten Inhalts
   - Logs der Aktivitäten

## Technische Details

### WebSocket Verbindungen
- **Port 4000:** Original Screensy P2P
- **Port 4001:** Admin Dashboard ↔ Server
- **Port 4002:** Device Clients ↔ Server

### WebRTC Konfiguration
- **STUN Server:** `stun:stun.l.google.com:19302`
- **TURN Server:** `turn:localhost` (username: screensy, password: screensy)
- **ICE Gathering:** Aktiviert für optimale Verbindungen

### Browser Kompatibilität
- **Chrome/Edge:** Vollständig unterstützt
- **Firefox:** Vollständig unterstützt  
- **Safari:** iOS Safari unterstützt
- **Mobile Browser:** Android Chrome/iOS Safari

### Geräte-Auto-Detection
```javascript
// Automatische Erkennung basierend auf User Agent
if (userAgent.includes('mobile') || userAgent.includes('iphone')) {
    // Phone UI
} else if (userAgent.includes('tablet') || userAgent.includes('ipad')) {
    // Tablet UI  
} else {
    // Laptop/Desktop UI
}
```

## Setup für Produktion

### 1. Domain Configuration
Ersetzen Sie `localhost` in folgenden Dateien:
- `Caddyfile`: Erste Zeile mit Ihrer Domain
- `turnserver.conf`: `external-ip` mit Ihrer IP/Domain

### 2. HTTPS (Erforderlich für WebRTC)
```
your-domain.com {
    reverse_proxy localhost:8080
    
    @admin-ws {
        header Connection *Upgrade*
        header Upgrade websocket
        path /admin-ws
    }
    
    @device-ws {
        header Connection *Upgrade*  
        header Upgrade websocket
        path /device-ws
    }
    
    reverse_proxy @admin-ws localhost:4001
    reverse_proxy @device-ws localhost:4002
}
```

### 3. Firewall Ports
```bash
# Öffnen Sie folgende Ports:
80      # HTTP
443     # HTTPS  
3478    # STUN/TURN
49152-65535  # TURN Range
```

### 4. Authentication (Optional)
```
basicauth {
    trainer $2a$14$hashed_password
}
```

## Troubleshooting

### Häufige Probleme

**🔴 "WebSocket Verbindung fehlgeschlagen"**
- Prüfen Sie ob alle Server laufen
- Firewall/Proxy Einstellungen prüfen
- Ports 4000-4002 müssen erreichbar sein

**🔴 "Screen Sharing nicht unterstützt"**  
- Verwenden Sie HTTPS in Produktion
- Browser muss WebRTC unterstützen
- Berechtigung für Screen Capture erteilen

**🔴 "Gerät erscheint nicht im Dashboard"**
- Registrierung vollständig abschließen
- WebSocket Verbindung prüfen (Port 4002)
- Browser Console auf Fehler prüfen

**🔴 "Video wird nicht angezeigt"**
- WebRTC Verbindung überprüfen
- TURN Server Konfiguration prüfen  
- NAT/Firewall könnte P2P blockieren

### Debug Modus
```javascript
// In Browser Console für detaillierte Logs:
localStorage.setItem('debug', 'true');
location.reload();
```

### Logs überprüfen
```bash
# Server Logs:
tail -f screensy-rendezvous/logs/server.log

# Admin Dashboard Logs:
Browser → F12 → Console

# Device Client Logs:
Browser → F12 → Console
```

## Entwicklung

### Lokale Entwicklung
```bash
# Backend
cd screensy-rendezvous
npm install
npm run dev

# Frontend
cd screensy-website  
go run main.go
```

### Code Struktur
```
screensy/
├── admin-dashboard/     # Admin Web UI
│   ├── index.html
│   ├── admin-styles.css
│   └── admin-dashboard.js
│
├── device-client/       # Device Web UI
│   ├── index.html
│   ├── device-styles.css
│   └── device-client.js
│
├── screensy-rendezvous/ # Backend Server
│   ├── server.ts        # Original Screensy
│   └── shop-server.ts   # Enhanced Server
│
└── screensy-website/    # Web Server
    ├── main.go          # Go HTTP Server
    ├── screensy.ts      # Original Frontend
    └── translations/    # Internationalization
```

## Lizenz

GPL-3.0-or-later - siehe Original Screensy Lizenz

## Support

Für technischen Support oder Fragen:
1. Prüfen Sie die Logs in Browser Console
2. Testen Sie WebRTC Verbindung: https://test.webrtc.org/
3. Überprüfen Sie Netzwerk-Konfiguration

---

**🎯 Vollständig funktionsfähiges Shop Screen Sharing System mit Admin Dashboard und Multi-Device Support!**
