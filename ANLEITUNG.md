# Shop Screen Sharing System - Vollständige Anleitung

## 🚀 System-Übersicht

Das Shop Screen Sharing System ermöglicht es, echte Geräte (Smartphones, Tablets, Laptops) in einem Schulungsumfeld zu verwalten und deren Bildschirme auf großen Displays zu teilen.

## 📋 Systemvoraussetzungen

- Node.js installiert
- Alle Geräte im gleichen Netzwerk (IP: 10.0.1.216)
- Moderne Browser mit WebRTC-Unterstützung

## 🔧 Server starten

1. **WebSocket-Server starten:**
   ```
   node "C:\Shop-Screensharing\s\screensy\screensy-rendezvous\shop-server.js"
   ```

2. **Web-Server starten:**
   ```
   node "C:\Shop-Screensharing\s\screensy\screensy-website\node-server.js"
   ```

## 🌐 Zugriffspunkte

### Trainer/Admin Dashboard
- **URL:** `http://10.0.1.216:8080/admin`
- **Funktion:** Geräte verwalten, Screen Sharing steuern
- **Features:**
  - Übersicht aller registrierten Geräte
  - Live-Status der Geräte (Online/Offline)
  - Screen Sharing-Anfragen senden
  - Sharing stoppen
  - Gerätestatistiken

### Teilnehmer/Geräte-Client
- **URL:** `http://10.0.1.216:8080/device`
- **Funktion:** Geräte registrieren und Screen Sharing
- **Features:**
  - Geräteregistrierung mit Name, Typ und Tisch
  - Screen Sharing-Berechtigungen verwalten
  - Live-Verbindungsstatus

## 📱 Geräte registrieren

### Schritt 1: Gerät öffnen
1. Öffnen Sie auf dem gewünschten Gerät den Browser
2. Navigieren Sie zu: `http://10.0.1.216:8080/device`

### Schritt 2: Registrierung ausfüllen
1. **Gerätename:** z.B. "iPhone Maria", "Tablet 1", "Laptop Technik"
2. **Gerätetyp:** Smartphone, Tablet oder Laptop
3. **Tisch:** Tisch 1, 2 oder 3
4. Klicken Sie auf **"Registrieren"**

### Schritt 3: Bestätigung
- Button wird grün: "Registriert ✓"
- Registrierungsformular wird ausgeblendet
- Gerät erscheint im Admin-Dashboard

## 🎛️ Admin Dashboard verwenden

### Geräte-Übersicht
- **Grüner Rahmen:** Gerät ist online
- **Blauer Rahmen:** Gerät teilt gerade den Bildschirm
- **Geräte-Info:** Name, Typ, Tisch, ID, letzter Kontakt

### Screen Sharing starten
1. Klicken Sie auf **"Sharing anfordern"** beim gewünschten Gerät
2. Auf dem Gerät erscheint eine Berechtigungsanfrage
3. Teilnehmer muss **"Erlauben"** klicken
4. Gerät wählt aus: Gesamter Bildschirm, Fenster oder Browser-Tab
5. Sharing beginnt automatisch

### Screen Sharing stoppen
1. Klicken Sie auf **"Sharing stoppen"** beim aktiven Gerät
2. Sharing wird sofort beendet

## 🔄 Workflow: Typical Training Session

### Vorbereitung
1. Server starten (WebSocket + Web-Server)
2. Admin-Dashboard öffnen: `http://10.0.1.216:8080/admin`
3. Teilnehmer-Geräte registrieren lassen

### Während der Schulung
1. **Gerät auswählen:** Im Admin-Dashboard gewünschtes Gerät finden
2. **Sharing anfordern:** "Sharing anfordern" klicken
3. **Teilnehmer bestätigt:** Auf dem Gerät "Erlauben" klicken
4. **Content auswählen:** Teilnehmer wählt was geteilt wird
5. **Display zeigen:** Bildschirm wird auf großem Display gezeigt
6. **Beenden:** "Sharing stoppen" im Admin-Dashboard

### Nach der Schulung
1. Alle Sharing-Sessions beenden
2. Server können gestoppt werden (Ctrl+C)

## 🛠️ Fehlerbehebung

### Gerät registriert sich nicht
- ✅ Überprüfen Sie die Netzwerkverbindung
- ✅ Stellen Sie sicher, dass beide Server laufen
- ✅ Browser-Konsole auf Fehler prüfen (F12)
- ✅ Alle Formularfelder ausfüllen

### Keine Verbindung zum Admin-Dashboard
- ✅ WebSocket-Server läuft auf Port 4001
- ✅ Firewall-Einstellungen prüfen
- ✅ IP-Adresse 10.0.1.216 erreichbar

### Screen Sharing funktioniert nicht
- ✅ Browser unterstützt WebRTC (Chrome, Firefox, Safari)
- ✅ Berechtigungen für Bildschirmaufnahme erteilt
- ✅ Nicht im Inkognito-Modus verwenden

### Geräte werden als offline angezeigt
- ✅ WebSocket-Verbindung unterbrochen
- ✅ Gerät-Seite neu laden
- ✅ Netzwerkstabilität prüfen

## 📊 System-Features

### ✅ Echte Geräte-Verwaltung
- Keine Simulation - nur echte registrierte Geräte
- Live-Status-Updates
- Automatische Offline-Erkennung

### ✅ Cross-Platform Unterstützung
- iOS Safari
- Android Chrome
- Windows/Mac Browser
- Responsive Design

### ✅ Benutzerfreundlich
- Intuitive Benutzeroberfläche
- Visuelle Status-Indikatoren
- Ein-Klick-Sharing-Anfragen

### ✅ Robust & Skalierbar
- WebSocket-basierte Echtzeitkommunikation
- Automatische Wiederverbindung
- Fehlerbehandlung und Logging

## 🔧 Technische Details

### Ports
- **4000:** Screensy WebSocket-Server
- **4001:** Admin Dashboard WebSocket
- **4002:** Device Client WebSocket
- **8080:** HTTP Web-Server

### Technologie-Stack
- **Backend:** Node.js + WebSocket
- **Frontend:** JavaScript + WebRTC
- **Styling:** Responsive CSS
- **Kommunikation:** JSON-basierte Nachrichten

---

**Viel Erfolg mit Ihrem Shop Screen Sharing System! 🎉**

Bei Fragen oder Problemen überprüfen Sie die Server-Logs oder die Browser-Konsole für detaillierte Fehlermeldungen.
