---
title: "Flottenverwaltung"
description: "Verfolgen Sie jedes Edge Relay über seine Sparkplug-Births und -Deaths und senden Sie Rebirth, Neustart oder eine neue Gerätedatei, ohne zur Box zu fahren."
---

Die Flottenverwaltung, seit 4.7.0, lässt das Gateway registrierte Edge Relays verfolgen, zeigt, ob sie leben, und erlaubt einem berechtigten Bediener, eines zu einem Rebirth, einem Neustart oder zur Übernahme einer neu gesendeten Konfiguration aufzufordern. Standardmäßig aus (`HOTLOOP_FLEET_ENABLED`): Eine Installation ohne Edge Relays hat keinen Broker, auf den man sie richten könnte.

## Was es nicht ist

Die Flottenverwaltung hat ihre eigene, getrennte MQTT-Verbindung und beantwortet eine andere Frage: ob ein *registriertes* Edge Relay lebt, nicht welchen Wert eines seiner Tags hat. Sie an den Treiber zu hängen, der Tags abfragt, hätte entweder erzwungen, ein kompatibles Gerät nur für die Flottensicht zu konfigurieren, oder in die private Knotenbuchhaltung dieses Pakets einzugreifen, die nie zum Teilen gedacht war.

**Nicht automatisch.** Ein Edge Relay, das am Broker auftaucht, wird dadurch nicht Mitglied der Flotte. Die Mitgliedschaft wird erklärt, als Zeile in `fleet_members`, angelegt über `POST /api/fleet`, dieselbe Unterscheidung, die diese Anwendung schon zwischen einem von einem Treiber entdeckten und einem von jemandem konfigurierten Tag macht. Ein NBIRTH aus einer Gruppe oder einem Knoten, den niemand registriert hat, wird auf Debug-Ebene protokolliert und sonst ignoriert.

## Wie alles zusammenspielt

- **Präsenz**, aus NBIRTH und NDEATH. Von der Seite des Relays nur ausgehend: Es wählt den Broker an, wie immer, wenn es Messwerte veröffentlicht, daher funktioniert das durch NAT ohne eingehende Verbindung zum Relay.

Befehle laufen in die andere Richtung über Sparkplug NCMD und erweitern, was ein Relay ohnehin verarbeitet:

- Ein harmloser, idempotenter Anstoß.
- **Neustart** (`Node Control/Reboot`, der Name aus der Sparkplug-Spezifikation selbst, kein von dieser Anwendung erfundener): Das Relay veröffentlicht sein eigenes geordnetes NDEATH und beendet sich; sein Supervisor (das `Restart=always` einer Quadlet-Unit oder das Standard-`restartPolicy: Always` eines Deployments) startet es mit dem, was in diesem Moment auf der Platte liegt, wieder. Kein neuer Abschaltweg: Es ist derselbe saubere Ausstieg, den das Relay bei seinem `SIGTERM` ohnehin nimmt.

Da Befehle über dieselbe MQTT-Verbindung laufen, die das Relay ohnehin nach außen aufbaut, braucht auch das Senden eines Befehls keine eingehende Verbindung zum Relay.

Ein Relay, das online erscheint, kann gesteuert werden, ohne Ausnahme. Jedes Relay abonniert sein NCMD-Topic und wartet auf die Bestätigung des Brokers, bevor es ein Birth veröffentlicht, bei jeder Verbindung, sodass "Online" nie vor "erreichbar" liegt. Der Manager hält sich auf seiner Seite an dieselbe Regel: Er meldet sich erst als gestartet, wenn seine NBIRTH- und NDEATH-Abonnements bestätigt sind, sodass ein Relay, das im Moment des Gateway-Starts sein Birth sendet, nicht verpasst wird. Lehnt die ACL des Brokers das Abonnement einer der beiden Seiten ab, weigert sich diese Seite zu starten und sagt es, statt halb taub zu laufen.

## Konfiguration senden

Das Senden dessen, was ein Relay abfragt, läuft nicht über NCMD, denn eine Sparkplug-Metrik ist nicht für eine ganze Gerätedatei bemessen: Es geht an ein **retained, einfaches MQTT-Topic** pro Relay: `hotloop/edge-relay-config/<group>/<node>`. Die Retained-Zustellung sorgt dafür, dass das ohne gesonderte Aufholanfrage funktioniert: Was zuletzt dort veröffentlicht wurde, geht sofort an jeden Client, der abonniert, auch an ein Relay, das sich nach einer Offline-Zeit wieder verbindet oder zum allerersten Mal startet.

Das Relay prüft beim Empfang erneut: Diese Anwendung kann nicht davon ausgehen, dass nur das Gateway auf dieses Topic veröffentlicht, nur dass sie selbst nichts Kaputtes veröffentlichen sollte.

**Eine Gerätedatei kann Zugangsdaten enthalten, und ein Senden veröffentlicht sie.** Der `config`-Block eines Geräts enthält, womit sich sein Treiber anmeldet, etwa den OPC-UA-`username` und das `password` (4.15.0), und die Datei wird so veröffentlicht, wie sie ist, retained. Jeder, der `hotloop/edge-relay-config/#` abonnieren kann, kann sie lesen, daher braucht der Broker TLS und eine ACL auf diesem Topic, bevor eine Datei mit Zugangsdaten gesendet wird. Die API des Gateways verbirgt Gerätezugangsdaten seit 4.15.1 vor jeder Rolle, aber eine gesendete Datei liegt nicht hinter der API und wird davon nicht verändert. Siehe die [Edge-Relay-Referenz](/de/edge-relay/reference/#zugangsdaten-in-der-gerätedatei-4150) und [Authentifizierung und Benutzer](/de/iot/authentication/#wo-zugangsdaten-noch-im-klartext-liegen).

**Ein Senden wirkt sofort und startet nie etwas neu.** Bis 4.17 hielt ein Senden die Datei nur bereit, und damit sie zählte, brauchte es eine zweite Aktion, ein `POST /api/fleet/{id}/restart`, das die Broker-Sitzung des Relays und jede Gerätesitzung abriss, nur um ein Tag zu ändern. Jetzt gilt:

- **Ein laufendes Relay** prüft die Datei, speichert sie und wendet sie an Ort und Stelle an: Neue Geräte verbinden sich, entfernte trennen sich, geänderte verbinden sich neu, und jedes unveränderte Gerät behält seine Sitzung. Die Sparkplug-Sitzung und die Weiterleitungswarteschlange bleiben die ganze Zeit bestehen. Der Knoten sendet ein Rebirth mit seinem neuen Metrikensatz und setzt die entfernten Metriken zuerst auf null, sodass ein Host nicht den letzten guten Wert eines entfernten Geräts weiter anzeigt. Die [Edge-Relay-Referenz](/de/edge-relay/reference/#was-ein-live-apply-beibehält-und-was-er-ändert) sagt genau, was auf die Leitung geht und warum.
- **Eine Datei, die das Relay ablehnt** (sie lässt sich nicht parsen, nicht validieren, nicht speichern), ändert nichts am Relay, und der `/status` des Relays sagt das unter `config.rejected`. `GET /api/fleet` zeigt das für jedes Mitglied mit einer `statusUrl`, neben dem Digest der Datei, die es ausführt, sodass "Ich habe sie gesendet" und "Es führt sie aus" zwei prüfbare Dinge sind und nicht eines, das man annimmt. Das Gateway validiert auch vor dem Veröffentlichen, in der Praxis ist es also ein Relay einer neueren oder älteren Version, das bei den Regeln anderer Meinung ist, oder etwas anderes als das Gateway, das auf das Topic veröffentlicht.
- **Ein Relay, das offline ist,** bekommt das retained gesendete, sobald es sich verbindet. Beim Start wartet es ein paar Sekunden darauf, bevor es seine lokale Datei lädt, sodass es gleich mit der gesendeten Liste hochkommt, statt mit der alten zu starten und dann umzuschalten.

Eine gesendete Datei landet auf dem Datenvolume des Relays, nicht über seiner lokalen Gerätedatei, und hat Vorrang vor der lokalen, bis das Senden zurückgenommen wird. Die [Edge-Relay-Referenz](/de/edge-relay/reference/#wo-eine-gepushte-datei-liegt-und-welche-datei-gewinnt) hat die Vorrangregeln und den Fehler aus 4.16.0, der sie nötig machte.

**Ein Senden zurücknehmen** geht mit `DELETE /api/fleet/{id}/config` (`fleet.config`, wie das Senden). Es veröffentlicht eine leere retained Nachricht auf dem Konfigurationstopic des Mitglieds, so löscht MQTT einen retained Wert, sodass kein späterer Start das Gesendete anwendet. Ein zu diesem Zeitpunkt verbundenes Relay verwirft seine gesendete Datei und wechselt live zu seiner lokalen zurück, so wie ein Senden angewendet wird, es sei denn, seine lokale Datei lädt nicht, dann behält es die gesendete und sagt es. Ein Relay, das offline war, hört das Löschen nie (eine leere Nachricht wird nicht gehalten), senden Sie es also erneut, sobald das Relay wieder da ist.

## Was jedes Relay ausführt und wie es aktualisiert wird

Jedes Relay trägt seine Version und den Digest seines Images in jedes Birth ein, ebenso ein Edge oder ein Gateway mit eingeschalteter Edge-Veröffentlichung, sodass eine hier als Mitglied registrierte Box dasselbe zeigt (String-Metriken namens `Node Info/Version` und `Node Info/ImageDigest`, ohne Alias, sodass ein Sparkplug-Host, der sie nicht kennt, sie ignoriert). `GET /api/fleet` zeigt sie als `release` bei jedem Mitglied: `version`, `imageDigest` und `since`, wann das Gateway diesen Build zum ersten Mal gehört hat. Ein älteres Relay meldet keine, und das Gateway sagt dazu nichts, statt einen "unbekannten Build" zu erfinden.

Ändert sich der Build eines Mitglieds, schreibt das Gateway das als `config`-Ereignis zu diesem Mitglied ins Systemprotokoll, mit alter und neuer Version und Digest im Detail (`{"kind":"fleet.release",...}`). Auch der erste Build, den es je hört, wird protokolliert, als Basis, an der der nächste gemessen wird. Das übersteht einen Neustart des Gateways, weil der letzte Eintrag aus dem Protokoll zurückgelesen wird: Ein Neustart erfindet nie ein Update. Das ist die Audit-Spur jedes Updates, das ein Relay bekommt, auf welchem Weg auch immer (Podmans Timer, eine Freigabe, `helm upgrade`, jemand an der Box), weil das Gateway kein Update auslöst und nur darüber berichten kann. Ein beweglicher Tag ist, wie `:stable` aktualisiert, daher wird auch ein geänderter Digest unter derselben Version protokolliert, als "ein anderes Image derselben Version".

`POST /api/fleet/{id}/update` (`fleet.update`, nur Administratoren) gibt das Update frei, das ein Relay zurückhält. Es bewirkt nur bei einem Relay etwas, das Updates zurückhalten soll; jedes andere Relay protokolliert, dass es das ignoriert hat. Die Anfrage nennt kein Image. Was das für jede Installationsart tut und nicht tut, steht in der [Edge-Relay-Referenz](/de/edge-relay/reference/#ein-relay-aktualisieren).

## Befehlsautorisierung

Zwei Ebenen, bewusst nicht eine:

- **An der API** braucht ein Bediener `fleet.rebirth`, um ein Rebirth anzufordern; Neustart, Update-Freigabe oder Konfigurationssenden brauchen jeweils `fleet.restart`, `fleet.update` oder `fleet.config`, nur dem Administrator gewährt. Ein Neustart stört einen laufenden Abfragezyklus stärker als ein Rebirth-Anstoß, und das Senden dessen, was ein Relay abfragt, wird genauso behandelt, dieselbe Einengung, die `alarms.ack` und `automations.trigger` für andere "Tu es jetzt"-Aktionen schon abbilden.
- **Am Broker** kann diese Anwendung nichts erzwingen: Das NCMD-Veröffentlichen und das Konfigurationstopic müssen beide über die eigenen ACLs des Brokers auf die MQTT-Zugangsdaten des Gateways beschränkt sein. Ohne das kann jeder, der den Broker erreicht und Gruppe und Knoten eines Relays kennt, denselben Befehl oder dieselbe Konfiguration veröffentlichen wie diese Funktion. Konfigurieren Sie das beim Deployment; es ist nicht optional, nur weil es außerhalb des Codes dieser Anwendung liegt.

## API

| Route | Berechtigung | <span class="sr-only">Details</span> |
|---|---|---|
| `GET /api/fleet` | `fleet.read` | Jedes registrierte Mitglied, mit Live-Präsenz und, wo konfiguriert, einem abgefragten `/status` |
| `POST /api/fleet` | `fleet.write` | Legt ein Mitglied an oder aktualisiert es (ein Body mit vorhandener `id` aktualisiert) |
| `DELETE /api/fleet/{id}` | `fleet.write` | Entfernt ein registriertes Mitglied |
| `POST /api/fleet/{id}/rebirth` | `fleet.rebirth` | Veröffentlicht `Node Control/Rebirth` |
| `POST /api/fleet/{id}/restart` | `fleet.restart` | Veröffentlicht `Node Control/Reboot` |
| `POST /api/fleet/{id}/update` | `fleet.update` | Gibt das Image-Update frei, das ein Relay zurückhält (bewirkt nichts bei einem, das nichts zurückhält) |
| `POST /api/fleet/{id}/config` | `fleet.config` | Sendet eine neue Gerätedatei (rohes JSON im Body, vor dem Veröffentlichen validiert); ein laufendes Relay wendet sie live an |
| `DELETE /api/fleet/{id}/config` | `fleet.config` | Nimmt das Senden zurück, sodass das Relay zu seiner lokalen Gerätedatei zurückkehrt, live, wenn es verbunden ist |

## Konfiguration

| Variable | Standard | <span class="sr-only">Details</span> |
|---|---|---|
| `HOTLOOP_FLEET_ENABLED` | `false` | Die Funktion ist aus, bis dies gesetzt ist |
| `HOTLOOP_FLEET_BROKER` | n/a | Pflicht, wenn aktiviert. Ein reiner Host, `host:port` oder eine vollständige URL |
| `HOTLOOP_FLEET_USER` / `_PASSWORD` | n/a | Broker-Zugangsdaten |
| `HOTLOOP_FLEET_TLS` | `false` | |
| `HOTLOOP_FLEET_TLS_SKIP_VERIFY` | `false` | Opt-in pro Deployment; nie standardmäßig setzen |

## Was geprüft wurde und was nicht

HotLoop wurde gegen echte Anlagen und echte Server betrieben, und am 2026-11-17 auf echter Hardware.
