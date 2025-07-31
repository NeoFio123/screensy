# MediaStream Troubleshooting Guide

## ⚠️ MediaStream "Not Supported" Error

### 🔍 Problem:
Browser zeigt: "MediaStream is not supported or not enabled"

### 💡 Lösungen:

#### 1. **Browser-Kompatibilität prüfen**
✅ **Empfohlene Browser:**
- **Chrome/Chromium** (beste Unterstützung)
- **Firefox** (gute Unterstützung)  
- **Edge** (gute Unterstützung)
- **Safari** (iOS/macOS - eingeschränkt)

❌ **Nicht unterstützt:**
- Internet Explorer
- Ältere Browser-Versionen
- VS Code Simple Browser (eingeschränkt)

#### 2. **Berechtigungen aktivieren**
1. **Chrome/Edge:**
   - URL-Leiste → 🔒 Schloss-Symbol klicken
   - "Kamera und Mikrofon" → "Zulassen"
   - Seite neu laden (F5)

2. **Firefox:**
   - URL-Leiste → 🛡️ Schild-Symbol klicken  
   - "Berechtigungen für diese Seite"
   - "Kamera/Mikrofon verwenden" aktivieren

#### 3. **HTTPS vs HTTP**
- **Lokales Netzwerk (10.0.1.x):** HTTP funktioniert meist
- **Internet/Domain:** HTTPS erforderlich
- **Aktueller Setup:** HTTP auf 10.0.1.216 sollte funktionieren

#### 4. **Gerätespezifische Lösungen**

**📱 Mobile Geräte (iOS/Android):**
```
- Safari (iOS): Funktioniert mit Einschränkungen
- Chrome (Android): Volle Unterstützung
- Browser-App: Unterschiedliche Unterstützung
```

**💻 Desktop/Laptop:**
```
- Chrome: Beste Performance
- Firefox: Gute Alternative  
- Edge: Windows-optimiert
```

#### 5. **Alternative Zugriffswege**

**Wenn Original Screensy (/) nicht funktioniert:**

1. **Admin Dashboard verwenden:** `http://10.0.1.216:8080/admin`
   - Vollständige Geräteverwaltung
   - WebSocket-basiert (keine MediaStream)
   - Funktioniert in allen Browsern

2. **Device Client verwenden:** `http://10.0.1.216:8080/device`
   - Geräte-Registrierung
   - Screen Sharing Anfragen
   - Mobile-optimiert

#### 6. **System-Test durchführen**

**Schritt 1:** Browser-Kompatibilität testen
```javascript
// In Browser-Konsole eingeben (F12):
console.log('getUserMedia:', !!navigator.mediaDevices?.getUserMedia);
console.log('getDisplayMedia:', !!navigator.mediaDevices?.getDisplayMedia);
```

**Schritt 2:** WebSocket-Verbindung testen
```
→ http://10.0.1.216:8080/admin öffnen
→ Status sollte von "Offline" zu "Online" wechseln
```

**Schritt 3:** Device Registration testen
```
→ http://10.0.1.216:8080/device öffnen
→ Gerät registrieren
→ Im Admin Dashboard sollte Gerät erscheinen
```

### 🎯 **Empfohlener Workflow:**

#### **Für Demo/Training:**
1. **Trainer:** Chrome → `http://10.0.1.216:8080/admin`
2. **Teilnehmer:** Chrome/Firefox → `http://10.0.1.216:8080/device`
3. **Displays:** Beliebiger Browser für Anzeige

#### **Für P2P Screen Sharing:**
1. **Broadcaster:** Chrome → `http://10.0.1.216:8080/#RaumName`
2. **Viewers:** Beliebiger Browser → Gleiche URL
3. **Berechtigungen:** Bildschirm teilen erlauben

### 📞 **Support-Kontakt:**
- Bei persistenten Problemen → Browser wechseln
- Netzwerk-Probleme → VALIDATE-SYSTEM.bat ausführen
- Geräte-Registrierung → Admin Dashboard verwenden

---
**Das System ist betriebsbereit - MediaStream-Probleme sind meist browser-spezifisch!**
