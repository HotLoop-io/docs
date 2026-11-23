---
title: "Versionshinweise: HotLoop core 4.17.0"
description: "Was HotLoop core 4.17.0 bringt, was sich beim Update ändert und was Sie lesen sollten, bevor Sie eine laufende Anlage anfassen."
sidebar:
  label: "4.17.0"
---

Phase 2 der Automatisierungsbasis, UniFi nur lesend und Gerätepasswörter im Ruhezustand verschlüsselt. Von 4.16.0 aus ist es ein normales `helm upgrade`, aber Ihre Gerätepasswörter werden beim ersten Start verschlüsselt, und ab dann gehört der Schlüssel zu Ihren Daten. Lesen Sie unten „Update von 4.16.0“, bevor Sie eine laufende Anlage anfassen.

Die vollständigen Hinweise stehen im README: Was sich in 4.17.0 geändert hat.

## Kurz gesagt

- **Die Automatisierungsbasis, Phase 2.** Helper (die Werte, die den Leuten der Anlage gehören, abgelehnt und nie gekappt), das Logbook (eine einzige Zeitleiste aus Zustandswechseln, Schreibzugriffen, Alarmen, Läufen und Konfiguration), Bedingungs-, Warte- und Stopp-Schritte und `forSec` an einem Zustandstrigger, Skripte (den CIP-Zyklus einmal schreiben, von überall starten), Rezepte (alle Sollwerte einer Sorte gehen gemeinsam raus oder keiner, vom Gerät zurückgelesen) und Blueprints (eine Regel einmal geschrieben, je Pumpe ausgefüllt, an ihre Version gebunden, bis jemand das Update geprüft hat). MCP wächst von 16 auf 25 Werkzeuge.
- **UniFi Network, nur lesend.** Switches, Ports, PoE, WAN und Clients als Tags, ein Login pro Konsole, das Zertifikat angeheftet. Die Schublade einer stillen SPS sagt, an welchem Switch-Port sie hängt und ob die Verbindung steht, und ein Fremder in einem als OT markierten Netz löst einen Alarm aus. Nur lesend auf echten Konsolen bewiesen. **Noch nicht bewiesen:** ein echtes Kabelziehen an einem überwachten Gerät und ein Handy, das einem als OT markierten Netz beitritt. Diese beiden Alarme sind im Test bewiesen und sonst nirgends, bis jemand beides am Rack macht.
- **Gerätepasswörter werden verschlüsselt**, in der Datenbank und in Backups, mit einem Schlüssel, den das Chart in `<release>-secret-key` erzeugt und behält.
- **Korrekturen, über die eine Anlage auf 4.16.0 stolpern kann:** Ein Edge Relay aus dem Chart oder der Quadlet-Unit ignorierte jede gesendete Konfiguration, und einer ohne Persistenz startete nicht; eine manuelle Änderung im Regeleditor setzte das Laufbudget der Regel zurück; das Urteil der Befehlsabfrage konnte Set unter dem Klick wegschieben; ein verspätetes Update konnte den Bildschirm Entities in der Zeit zurücksetzen; eine Regel, die nie lief, sagte, sie sei vor 739887 Tagen gelaufen; App-Store-Deployments trugen keinen Tenant.

### API-Änderungen

- Eine Zeit, die noch nicht eingetreten ist, wird weggelassen, nicht als `0001-01-01T00:00:00Z` gesendet: `lastRun`, `lastPoll`, `lastGood`, `clearedAt`, `ackedAt`, `shelvedUntil`, `raisedAt` und der Rest, auch im Live-Feed.
- Neue Routen: `/api/helpers`, `/api/logbook`, `/api/scripts`, `/api/recipes`, `/api/blueprints`, `POST /api/automations/{id}/blueprint-upgrade`, `/api/devices/{id}/network`, `/api/unifi/{id}/...` und `DELETE /api/fleet/{id}/config`. Alle in docs/API.md.
- Neue Berechtigungen, und die Rolle Operator hat sie: `helpers.write`, `scripts.run`, `recipes.apply`, `blueprints.apply`. Skripte, Rezepte und Blueprints zu schreiben ist Sache des Admins.
- Tags tragen `deviceClass`; Regeln tragen `blueprintId`, `blueprintVersion` und `blueprintInputs`.

### Update von 4.16.0

- `helm upgrade <release> hotloop/hotloop --version 4.17.0 --reset-then-reuse-values`. Nicht `--reuse-values`, das die neuen Standardwerte verwirft und beim Rendern scheitert. Selektoren und Volume Claims bleiben gleich; das einzige neue Objekt ist das Secret des Schlüssels.
- Die Migrationen 0009 bis 0015 laufen beim Start (Helper, Logbook, Skripte, Tag-Geräteklasse, Rezepte, Blueprints, UniFi). Alle additiv. Vorher `pg_dump`.
- `HOTLOOP_SECRET_KEY_FILE`: Das Chart erzeugt den Schlüssel bei diesem Update, und das Gateway verschlüsselt bei diesem Start jedes gespeicherte Gerätepasswort. Ohne den Schlüssel bleiben diese Geräte danach mit einem Fehler, der den Schlüssel nennt, ausgefallen. Ein Backup nach dem Update lässt sich nur mit diesem Schlüssel wiederherstellen, oder mit `--restore-keep-unreadable-credentials`, das diese Geräte ausgefallen lässt, bis jemand die Passwörter neu eingibt. Sichern Sie das Secret getrennt von Ihren Backups. Zurück auf 4.16.0 heißt, Ihren Dump von vor dem Update einzuspielen.
- Sie rendern das Chart mit `helm template`, statt es zu installieren? Bringen Sie Ihren eigenen Schlüssel in `secretKey.existingSecret` mit, sonst erzeugt jedes Rendern einen neuen.
- Edge Relay: Eine gesendete Geräte-Datei liegt unter `/data/pushed-devices.json` und hat Vorrang vor den `devices` des Charts, solange sie existiert; `DELETE /api/fleet/{id}/config` löscht sie. Ein Push, der auf 4.16.0 fehlschlug, bleibt am Broker erhalten und kommt beim ersten Start der 4.17.0 an. Quadlet-Nutzer nehmen die neue Unit. Mit `persistence.enabled=false` startet er jetzt, verliert aber bei jedem Ersetzen des Pods die Weiterleitungswarteschlange, jede gesendete Datei und das OPC-UA-Zertifikat.
