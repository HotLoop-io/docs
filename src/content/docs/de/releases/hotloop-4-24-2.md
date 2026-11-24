---
title: "Versionshinweise: HotLoop core 4.24.2"
description: "Was HotLoop core 4.24.2 bringt, was sich beim Update ändert und was Sie lesen sollten, bevor Sie eine laufende Anlage anfassen."
sidebar:
  label: "4.24.2"
---

HotLoop liest und steuert Shelly-Geräte jeder Generation direkt, findet ONVIF-Kameras und liefert ihre Streams, Schnappschüsse sowie Schwenken, Neigen und Zoom, spricht über Firmata mit Arduinos und sendet ein OPC-UA-Passwort beliebiger Länge so, wie es die Spezifikation verlangt. Eine langsame Verbindung hält einen Edge-Knoten nicht mehr auf seiner Platte fest, und `--version` nennt den Commit, aus dem ein Image gebaut wurde. Eine Standardinstallation von HotLoop Edge startet. Nur für amd64 gebaut; der Multi-Arch-Build folgt als nächste Version.

## Was sich geändert hat

- **Shelly, jede Generation.** Gen2 und neuer über RPC mit einem Live-Websocket, sodass eine Änderung und ein Tastendruck in dem Moment ankommen, in dem sie passieren, und Gen1 über die eigene HTTP-Schnittstelle. Ein Tastendruck wird im Logbuch unter dem Gerät abgelegt. Siehe SHELLY.md.
- **ONVIF-Kameras.** Kameras im Netz finden (WS-Discovery), die Geräteinformationen jeder Kamera lesen, die Stream- und Schnappschuss-Adresse jedes Medienprofils (Media und Media2), Schwenken, Neigen und Zoom sowie die eigenen Ereignisse der Kamera als Tags und Logbuchzeilen. Das aktuelle Bild eines Profils ist eine Route entfernt. Siehe ONVIF.md.
- **Arduinos über Firmata.** USB-seriell oder TCP, mit digitalen und analogen Pins, PWM, Servos und I2C-Geräten als Tags. Siehe FIRMATA.md.
- **OPC-UA-Passwörter beliebiger Länge.** Passwörter über 64 Byte gehen jetzt so über OPC UA, wie es die Spezifikation verlangt (RsaEncryptedSecret, Teil 4, 7.40.4), vom Client und zum Server, und ältere Server melden weiterhin an. Gegen den eigenen Stack der OPC Foundation bewiesen. Siehe [den OPC-UA-Server](/de/edge/opc-ua-server/).
- **Eine langsame Verbindung nagelt den Knoten nicht mehr an seine Platte.** Der Durchlauf, der das Letzte von der Platte nimmt, sendet jetzt aus dem Speicher, was dahinter hereinkommt, sodass sich eine Weiterleitungswarteschlange hinter einer langsamen Verbindung leert und der Knoten die Platte verlässt, statt bei jeder Abfrage ein fsync zu machen.
- **`--version` nennt den Commit.** Jedes Image nennt neben seiner Version den Commit, aus dem es gebaut wurde.
- **Ein CODESYS-Bildschirm neben seinem WebVisu.** Der Import einer CODESYS-Visualisierung läuft gegen ein echtes WebVisu, angetrieben von denselben SPS-Variablen, und beide werden in einem Browser verglichen.
- **Die Roadmap-Zeile zu docs/legacy ist abgehakt.**
- **Eine Standardinstallation von HotLoop Edge startet.** Der Pod liest das Gotify-Token, die Discord-Webhook-URL und das Discord-Bot-Token nicht mehr aus einem Secret, das es nicht gibt: Jedes wird nur gesendet, wenn seine Zugangsdaten gesetzt sind, und die Chart-Prüfung schlägt bei jeder Referenz auf dieses Secret fehl, das der Render nicht erzeugt. Ein Chart mit gesetztem Ziel oder mit benanntem vorhandenem Secret rendert wie zuvor.
- **Das Ignition-Labor, in beide Richtungen.** HotLoops Ignition-Nachweis läuft jetzt auch in die andere Richtung, ein Nachweis für UADP-Multicast über einen Router kommt dazu, und der größte Bericht ist vermessen. Siehe [Geplante Berichte](/de/gateway/reports/).
- **Tests warten auf das, worauf sie warten.** Das Aufwärmen der Handy-App wartet auf eine angemeldete Seite, und das Energieformular füllt seine Felder in einem Schritt.

## Migrationen

Keine.

## API-Änderungen

Zwei Routen, beide neu. `POST /api/onvif/discover` (`devices.write`) sucht im Netz nach ONVIF-Kameras und fügt nichts hinzu. `GET /api/onvif/{id}/profiles/{profile}/snapshot` (`devices.read`) liefert das aktuelle JPEG eines Kameraprofils. Keine bestehende Route hat sich geändert. Siehe [die HTTP-API](/de/iot/api/).

## Update von 4.24.0

Ein normales `helm upgrade`. Keine Migration und kein neues Secret.

## Was nicht bewiesen ist

- Shelly, ONVIF und Firmata liefen gegen Aufzeichnungen echter Geräte, ONVIFs eigenen generierten Stack und das StandardFirmata des Arduino-Projekts auf einem simulierten Uno. Noch ist kein physischer Shelly, keine Kamera und kein Arduino auf dem Prüfstand gewesen.
- Der Seite-an-Seite-Vergleich mit WebVisu läuft im Test gegen eine CODESYS-Control-for-Linux-SL-4.22.0.0-Runtime.
