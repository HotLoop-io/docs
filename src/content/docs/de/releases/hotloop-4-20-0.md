---
title: "Versionshinweise: HotLoop core 4.20.0"
description: "Was HotLoop core 4.20.0 bringt, was sich beim Update ändert und was Sie lesen sollten, bevor Sie eine laufende Anlage anfassen."
sidebar:
  label: "4.20.0"
---

Die neue Web-Oberfläche ist jetzt die unter `/`, und ein Agent kann über MCP alles ändern, was er lesen kann. Es gibt keine Migrationen, und ein normales `helm upgrade` oder das Quadlet-Auto-Update nimmt sie mit. Die vorige Version, die [4.19.11](/de/releases/hotloop-4-19-11/), ist die letzte, deren Standardbildschirme die alten waren.

Dieser Build ist nur amd64, und die nächste Version ist eine kleine Versionserhöhung, die die arm-Images baut, so wie die beiden Läufe ablaufen. `stable` behält in der Zwischenzeit die arm-Images, die es hält.

## Was sich geändert hat

- **Die neue Web-Oberfläche ist der Standard, und die alte ist weg.** Jeder Bildschirm wurde als statische Seite neu gebaut (Astro, mit Svelte-Teilen), in das eine Binary eingebettet, ohne Node auf der Box und ohne CDN. Sie lag während der 4.19.x unter `/next`. Unter `/` sind es dieselben neunzehn Bildschirme mit denselben Bedienelementen, Feldern, Spalten, Formularen und Worten, für Betrachter, Operator und Administrator. Was absichtlich anders aussieht:
  - Die Farben sind HotLoops warmer Grund und Orange, dieselben wie auf der Website, bei Flow und bei Cascade, und das Zeichen ist das offizielle.
  - Die Bildschirme sind in Operate, Plant, Build und System gruppiert, in einer Leiste auf einem Schreibtisch. Auf einem Handy gibt es eine Leiste mit fünf (Board, Alarms, Dashboards, Entities, More), und More öffnet jeden Bildschirm.
  - Die Theme-Steuerung sagt Dark oder Light, wo sie früher einen Mond zeigte.
  - Die Icons, die Themenfarbe und die Startbildschirmfarbe der installierten App folgen dem neuen Aussehen.
  - Eine Schublade lässt Platz für ihre Bildlaufleiste, sodass sich eine Karte darin nicht bewegt, wenn ihr Verlauf lädt.
- **Die Anmeldung bei nicht erreichbarem HotLoop sagt, warum, und erholt sich von selbst.** Ein Handy, das sich nie angemeldet hat oder abgemeldet wurde und die Seite ohne Verbindung öffnet, bekommt den Anmeldebildschirm mit einem Satz, dass HotLoop von hier aus nicht antwortet. Die Seite fragt alle drei Sekunden erneut, und wenn die Verbindung zurückkehrt, lädt sie ohne Zutun neu. Es ist das alte Verhalten, beibehalten.
- **MCP kann alles ändern, was es lesen kann.** Es gab siebenundzwanzig Werkzeuge, die die Anlage lasen und Anlagenteile steuerten; jetzt sind es 128. Vierundsechzig weitere ändern die Konfiguration: Geräte und Tags, Discovery und Broker, UniFi-Netzwerke, Entitäten, Helper, Ausrüstung und Labels, Alarme, Automatisierungen und Blueprints (ein Agent kann jetzt die Regel aus einem Blueprint erzeugen, die er vorher nur in der Vorschau sehen konnte), Skripte, Rezepte, Dashboards und den Rest dessen, was ein Bildschirm speichern kann. Siebenunddreißig erreichen die eigenen Funktionen des Administrators: Benutzer und PINs, Einstellungen, Backups, Eskalation, Historian-Ziele, Broker-Logins, die Flotte der Edge Relays und Berichte. Keines ist eine zweite Implementierung. Jedes ist eine Route der REST-API, ausgeführt vom eigenen Handler dieser Route, sodass Validierung, Berechtigungsprüfung, Runtime-Reload und Audit-Zeile die der Route sind, mit dem Agenten als Akteur.
- **Was vor einer Änderung steht.** Der Schalter `HOTLOOP_ALLOW_MCP_WRITES` (standardmäßig an) muss an sein, und ein Aufrufer mit gesetztem `HOTLOOP_MCP_OIDC_WRITE_ROLE` muss diese Rolle haben. Der Aufruf trägt genau die eine Berechtigung, die seine Route verlangt (`devices.write`, `alarms.write`, `users.manage`, `settings.write` und so weiter), und wird ohne sie mit den Worten der Route selbst abgelehnt. Jede Änderung braucht ein `reason`, aufgezeichnet als `config`-Zeile im Systemlog neben der der Route. Das Steuern von Anlagenteilen bleibt `write_tag`, `call_service`, `run_script`, `apply_recipe` und `trigger_automation` hinter `HOTLOOP_ALLOW_WRITES`, der Beschreibbar-Markierung des Tags und seinem Bereich. Ein Tag, eine Regel oder ein Rezept beschreibbar zu machen, ist Konfiguration und steuert nichts, bis es benutzt wird; was es dann steuert, trifft dasselbe Tor. Die beiden Schreibschalter haben keine Route, daher lehnt `save_settings` sie für einen Agenten ab wie der Bildschirm Settings, und ein Agent kann den Schalter, auf den seine eigenen Schreibzugriffe warten, nicht einschalten. Das Passwort eines Benutzers geht durch den Aufruf wie durch die API, und die Audit-Zeile trägt es nie. Die Werkzeuge gibt es auch unter `--mcp-stdio`. [MCP](/de/iot/mcp/#konfiguration-ändern) hat jedes Werkzeug, seine Route und seine Berechtigung.

## API-Änderungen

- `GET /next` und `GET /next/` sind ein `301` auf die Wurzel, sodass ein Lesezeichen, das gemacht wurde, als die neue Oberfläche neben der alten lag, weiter ankommt. Das `Location` ist relativ, also unter einem Basispfad richtig.
- `GET /static/` ist weg, und mit ihm `GET /next/manifest.webmanifest`. Die Seite, ihre Dateien, die Icons, `/manifest.webmanifest` und `/sw.js` werden wie bisher von der Wurzel ausgeliefert; das alte Stylesheet und die alten Skripte waren von nirgends verlinkt und werden nicht ausgeliefert.
- `HOTLOOP_UI` wird nicht mehr gelesen. Es zu setzen bewirkt nichts.
- Keine andere Route hat sich geändert. Die MCP-Werkzeuge sind neue Oberfläche, keine REST-Routen.

## Update von 4.19.11

Ein normales `helm upgrade` oder das Quadlet-Auto-Update. Es gibt keine Migrationen und nichts zu konfigurieren. Der erste Ladevorgang holt die neue Seite, und der Service Worker ersetzt den Cache des alten, sodass ein Handy, auf dem die App installiert war, beim nächsten Öffnen die neuen Bildschirme zeigt. Beim Update lässt sich nichts unumkehrbar machen, und ein Rollback auf 4.19.11 ist sicher, weil sich in der Datenbank nichts geändert hat.

## Bekannt

- Nichts Neues. Was unter Broken or missing in der [Roadmap](/de/roadmap/) noch offen ist: OPC-UA-X.509-Benutzertoken, die veralteten Richtlinien `Basic128Rsa15` und `Basic256`, die unser OPC-UA-Server anbietet, und Passwörter über 64 Byte (beides der Bibliothek) sowie Tests mit stillen Geräten für S7comm und EtherNet/IP gegen echte Geräte.
