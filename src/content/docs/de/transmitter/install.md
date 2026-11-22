---
title: "HotLoop Transmitter installieren"
description: "Installieren Sie die Bibliothek im CODESYS-Bibliotheksrepository, fügen Sie sie einem Projekt hinzu und sehen Sie, was bei einem Bausteinfehler zu tun ist."
---

Sie brauchen ein CODESYS-Entwicklungssystem ab 3.5 SP22 und eine Runtime, deren Zielsystem die Komponenten SysSocket und SysTimeRtc hat, die die CODESYS-Control-Runtimes für Linux SL mitbringen (die zweite ist neu in 1.1.0, wegen des Zeitstempels).

## Mit dem CODESYS Installer

Seit 1.1.0 enthält das Release auch `HotLoopTransmitter-1.1.0.package`, unter https://hotloop.io/hotloop-transmitter/1.1.0/HotLoopTransmitter-1.1.0.package. Installieren Sie es mit dem CODESYS Installer (in der IDE: Tools, CODESYS Installer) oder ohne Fenster über die Kommandozeile, `PackageManagerCLI.exe --profile="<your profile>" --install=<file>.package --targetProfiles="<your profile>"`. Der Installer legt die Bibliothek im Bibliotheksrepository dieses Profils unter der Firma HotLoop ab, und Sie machen mit Schritt 3 unten weiter. Das Paket ist dieselbe Bibliothek wie die Datei `.library`, in einem ZIP, das der Installer liest, beide Wege liefern also dieselbe Bibliothek.

## Aus der Bibliotheksdatei

1. Laden Sie `HotLoopTransmitter-1.1.0.library` von https://hotloop.io/hotloop-transmitter/1.1.0/HotLoopTransmitter-1.1.0.library herunter und prüfen Sie sie gegen `SHA256SUMS` im selben Ordner (`sha256sum -c SHA256SUMS`).
2. In der CODESYS-IDE: Tools, Library Repository, Install, und die Datei auswählen. Sie liegt jetzt im Repository unter der Firma HotLoop.
3. Öffnen Sie in Ihrem Projekt den Library Manager der Anwendung, Add Library, und wählen Sie HotLoop Transmitter. SysSocket, SysTimeRtc und ihre Schnittstellenbibliotheken kommen als Abhängigkeiten mit und brauchen nichts von Ihnen.
4. Deklarieren Sie einen `HLTX.FB_HLTX_Publisher`, fügen Sie Ihre Felder hinzu und rufen Sie ihn in jedem Zyklus auf (das README hat das Beispiel).
5. Laden Sie auf die Steuerung. Das Ziel muss aus dem Netz der Steuerung erreichbar sein; bei Multicast müssen die Switches des Netzes die Gruppe weiterleiten.

Die Datei `.compiled-library` ist dieselbe Bibliothek ohne Quelltext. Installieren Sie diese, wenn der Structured Text im Library Manager nicht sichtbar sein soll. Sie liegt im selben Ordner, als `HotLoopTransmitter-1.1.0.compiled-library`.

Um zu prüfen, was ankommt, genügt jeder UDP-Listener auf dem Zielport. Ein kleines Go-Programm, das auf einem Port lauscht oder einer Multicast-Gruppe beitritt und jedes Datagramm als JSON-Zeile mit seinem Hex ausgibt, funktioniert gut.

## Wenn der Baustein einen Fehler meldet

| `eError` | Bedeutung | Was zu tun ist |
|---|---|---|
| `NoFields` | es wurde kein Feld hinzugefügt | vor dem Aktivieren eine `Add`-Methode aufrufen |
| `BadInterval` | `tPublishingInterval` liegt unter 1 ms | setzen Sie es |
| `BadAddress` | `sDestination` ist keine IPv4-Adresse in Punktschreibweise | korrigieren Sie sie |
| `SocketCreate`, `SocketOption` | die Runtime hat einen Socket-Aufruf abgelehnt; `diLastSocketResult` enthält den Code | der Baustein versucht es nach `tRetry` selbst erneut |
| `TooBig` | die Felder passen nicht in 1472 Byte | weniger veröffentlichen oder zwei Publisher mit unterschiedlichen Writer-IDs nutzen |
| `BadField` | eine gespeicherte Adresse wurde gelöscht | `Clear()` und die Felder neu hinzufügen |
