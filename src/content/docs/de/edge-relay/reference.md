---
title: "Edge Relay Referenz"
description: "Der kopflose Sparkplug-B-Knoten zum Abfragen und Weiterleiten: Funktionen, alle Einstellungen, Warteschlange auf der Platte, Flottenkonfiguration, Betrieb."
---

Der Edge Relay ist seit 4.6.0 eine zweite Binärdatei und läuft eigenständig: ein Sparkplug-B-Edge-Knoten, der abfragt und weiterleitet, ohne Datenbank, ohne Web-Oberfläche, ohne Authentifizierung und ohne Schreibpfad. Er läuft auf einem Pi oder einem kleinen Industrie-PC am Edge und leitet alles, was er liest, über denselben Sparkplug-B-Publisher, den 4.5.0 eingeführt hat, an ein vollständiges Gateway weiter, das irgendwo mit einer echten Datenbank läuft.

Die Notiz zu 4.5.0 sagte es selbst: Edge Publish gab es als Funktion, die man im vollständigen Gateway-Prozess einschalten konnte, "noch nicht die eigenständige, schlankere Edge-Relay-Edition". Das hier ist diese Edition.

## Was es nicht ist

**Keine kleinere Gateway-Variante mit weniger Optionen.** Es ist eine andere Binärdatei mit deutlich weniger Abhängigkeiten. Sie enthält keine Datenbank, keine Web-Oberfläche, keine Authentifizierung, keinen MCP-Server oder -Client, keine Automatisierungs-Engine und kein Entitätsregister.

**Nicht in der Lage, eine Oberfläche auszuliefern, einen Schreibzugriff anzunehmen oder einen MCP-Tool-Aufruf zu beantworten.** Alle drei brauchen etwas, das diese Binärdatei bewusst nicht hat: eine authentifizierte Identität, der man die Aktion zuordnen kann. Ein Edge Relay entscheidet nichts und bestätigt einem Menschen nichts zurück; er liest und leitet weiter.

**Nicht über eine Datenbank konfiguriert, und es gibt keine eigene Konfigurations-API.** Geräte und Tags kommen aus einer lokalen JSON-Datei, die beim Start gelesen wird, oder aus einer Datei, die das Gateway über den Broker schickt und die live angewendet wird (siehe [Konfigurations-Push](#konfigurations-push-480)). Auf dem Relay lauscht nichts auf eine neue Konfiguration: Der einzige Weg hinein ist die Broker-Verbindung, die er ohnehin nach außen aufbaut.

## Wie alles zusammenspielt

Intern nutzt er die tatsächliche Abfrage-Engine des Gateways, keine Nachbildung: derselbe Worker, dieselbe Wiederverbindungs- und Backoff-Logik und derselbe Abfrage-Schleifen-Code, die als Teil des Gateways in Produktion laufen, laufen hier unverändert. Anders ist nur, *wohin Konfiguration und Verlauf gehen*.

Alles nach einer Abfrage, der Treiber, der Tag-Bus, der Sparkplug-Publisher und die Weiterleitungswarteschlange auf der Platte, ist exakt derselbe Code, den das Gateway verwendet, wenn `HOTLOOP_EDGE_PUBLISH_ENABLED` gesetzt ist. Was dieser Publisher genau tut, steht auf der Seite Edge Publish: Births, Sequenznummern, Pufferung über einen Ausfall hinweg, Wiedergabe nach dem Wiederverbinden. Nichts davon hat sich hier geändert; diese Binärdatei ist nur ein anderer Weg zum selben Aufruf `Offer()`.

## Die Gerätedatei

```json
{
  "devices": [
    {
      "id": "press-01",
      "name": "Press 1",
      "protocol": "opcua",
      "address": "opc.tcp://press-01.local:4840",
      "enabled": true,
      "pollIntervalMs": 1000
    }
  ],
  "tags": [
    {
      "deviceId": "press-01",
      "name": "Zone1_Temp",
      "address": "ns=2;s=Zone1.Temp",
      "dataType": "float",
      "enabled": true
    }
  ]
}
```

Ein Tag unterstützt alles, was die Tags des Gateways können, auch `noData`: eine Liste roher Werte, die "keine Messung" bedeuten (die 0x8005 eines Schreibers), jeweils mit einem Grund, damit ein toter Kanal auf dem Relay und im Sparkplug-Stream als schlecht erscheint und nicht als Zahl. Siehe [Keine-Daten-Werte](/de/iot/protocols/#no-data-values).

Alle sieben Protokolltreiber des Gateways sind einkompiliert: OPC UA, Modbus, MQTT/Sparkplug B, EtherNet/IP, S7comm, MTConnect und HTTP. Am Format der Gerätedatei ist nichts Edge-Relay-spezifisch.

### Discovery (4.18.10)

Ein Relay kann einen MQTT-Broker auf Geräte abhören, die sich selbst melden, so wie es das Gateway tut (siehe [MQTT-Discovery](/de/iot/mqtt-discovery/)), und alles lesen und weiterleiten, was er hört. Nennen Sie die Broker in der Gerätedatei:

```json
{
  "devices": [],
  "tags": [],
  "discovery": [
    {
      "id": "yard",
      "broker": "10.0.0.5:1883",
      "username": "hotloop",
      "password": "...",
      "prefix": "homeassistant",
      "listenOnly": true,
      "tasmota": true,
      "shelly": true
    }
  ]
}
```

`id` besteht aus 1 bis 63 Kleinbuchstaben, Ziffern und `-` und ist nicht `embedded`. `broker`, `username`, `password`, `useTls` und `insecureSkipVerify` entsprechen dem, was die Gateway-Einstellungen unter MQTT annehmen, geprüft vom selben Code. `prefix` ist standardmäßig `homeassistant`, und `tasmota` und `shelly` sind standardmäßig an. Eine Datei ohne Broker ändert nichts daran, wie ein Relay läuft.

Was er hört, wird zu Geräten und Tags, erzeugt vom selben Code, den das Gateway ausführt (das Format `homeassistant/`, Tasmotas eigenes, die Status von Shelly), und sie werden wie alle anderen abgefragt und über Sparkplug weitergeleitet. Die ID eines Geräts entsteht aus der ID des Brokers und der Angabe des Geräts, wer es ist, und ist jedes Mal gleich (`disc-<identity>-<hash>`), sodass ein Relay, das neu startet, seine Metriken gleich benennt. Ein Gerät erscheint ein paar Sekunden nach seiner Meldung, ein zurückgezogenes verschwindet bei einem Rebirth aus dem Birth des Knotens, und beides kostet weder die Sparkplug-Sitzung noch die Weiterleitungswarteschlange. Eine gepushte Datei, die einen Broker hinzufügt oder entfernt, wird ebenfalls live angewendet.

**Nichts, was er entdeckt, kann scharfgeschaltet werden.** Nicht weil eine Prüfung es sagt. Jeder Tag, den Discovery erzeugt, ist schreibgeschützt, wie auf dem Gateway; jedes Gerät, das er erzeugt, ist nicht akzeptiert; auf einem Relay gibt es niemanden, der eines akzeptieren könnte; und ein Relay hat überhaupt keinen Schreibpfad, sodass ein Befehl an einen entdeckten Punkt oder an irgendeinen Punkt abgewiesen wird, bevor er in die Nähe eines Geräts kommt. Der Test dafür bittet ein Relay mit erlaubten Schreibzugriffen, eine entdeckte Pumpe zu schalten, und prüft, dass das Befehls-Topic der Pumpe still blieb.

Ein Gerät, das Sie ansteuern können, erreicht ein Relay auf dem umgekehrten Weg: Sie akzeptieren es auf einem Gateway, schalten die gewünschten Punkte scharf und pushen die Datei. Hat eine Datei ein Gerät, das das Relay auch hört (dieselbe Broker-ID oder dieselbe Adresse und dieselbe Identität), gewinnt die Datei und die entdeckte Kopie wird nicht erzeugt, sodass ein Gerät nie doppelt weitergeleitet wird.

`listenOnly` ist an, solange Sie es nicht ausschalten; dann veröffentlicht das Relay nichts an diesen Broker: weder die Birth-Nachricht, mit der sich ein Publisher erneut meldet, noch das `status_update` eines Shelly, noch die Strom-Abfrage eines Tasmota. Ein Gerät, das nur bei einer Änderung spricht, gilt als unbekannt, bis es das tut. Schalten Sie es aus, sind das die einzigen Dinge, die es sendet, an die Topics, die DISCOVERY.md nennt.

Ein Relay behält nichts von dem, was er gehört hat. Die `homeassistant/`- und Tasmota-Konfigurationen sind auf ihrem Broker retained und kommen beim Start zurück; ein Shelly meldet seinen Status, sobald sich etwas ändert, ein Gerät, das seit dem Start des Relays still war, ist also erst da, wenn es spricht. Das, und dass es keine Datenbank gibt, die ein akzeptiertes Gerät speichert, ist der Unterschied zum Gateway.

`/status` nennt unter `discovery` für jeden Broker: ob er lauscht und verbunden ist, wie viele Nachrichten er empfangen, verworfen und abgelehnt hat, wie viele Probleme anstehen, und die Zahl der Geräte und Tags, die Discovery erzeugt hat. Es sagt nicht, wo ein Broker steht oder in welchem Topic ein Problem auftrat.

### Zugangsdaten in der Gerätedatei (4.15.0)

Der OPC-UA-Treiber des Relays ist der des Gateways, daher kann ein Gerät in seinem Block `config` einen OPC-UA-`username` und `password` tragen (und die Sicherheitsoptionen aus [Protokolle und Treiber](/de/iot/protocols/#opc-ua-security-and-credentials)), und ebenso ein Gerät jedes anderen Protokolls (MQTT- und HTTP-Passwörter, HTTP-Header, Zugangsdaten in einer Adresse). Sie stehen im Klartext in der Gerätedatei, und das Relay hat keine API, hinter der man sie verstecken könnte (die API-Schwärzung, die 4.15.1 im Gateway ergänzt hat, gilt dafür nicht; siehe [Authentifizierung und Benutzer](/de/iot/authentication/#wo-zugangsdaten-noch-im-klartext-liegen)), daher kommt es darauf an, wo die Datei liegt:

- **Im Helm-Chart `devicesSecret` verwenden.** Geräte, die in den Werten `devices` und `tags` des Charts stehen, werden in eine ConfigMap gerendert, die jeder lesen kann, der ConfigMaps im Namespace lesen darf, und sie liegen im Helm-Release-Datensatz. Legen Sie für Geräte mit Zugangsdaten die ganze Gerätedatei in ein Secret unter dem Schlüssel `devices.json` und nennen Sie es in `devicesSecret`; das Secret wird anstelle der ConfigMap eingehängt, die dann nicht erstellt wird.
- **Auch eine gepushte Gerätedatei enthält sie.** Eine Datei, die mit `POST /api/fleet/{id}/config` gepusht wird, wird retained in ein MQTT-Topic veröffentlicht; der Broker muss also TLS verwenden und einschränken, wer `hotloop/edge-relay-config/#` lesen darf, sonst kann jeder, der es abonnieren kann, alle Zugangsdaten darin lesen. Das Relay schreibt eine gepushte Datei mit dem Modus `0600` auf sein Datenvolume (`/data/pushed-devices.json` im Chart und in der Quadlet-Unit), sie liegt also auch auf dem PVC und nicht in einem Secret.
- **Ein gesichertes OPC-UA-Gerät behält ein Zertifikat und einen Trust-Store.** Sie liegen unter `/data/opcua-client-pki` (`HOTLOOP_OPCUA_CLIENT_PKI_DIR`), auf demselben Persistenz-Volume wie die Weiterleitungswarteschlange. Bei ausgeschalteter Persistenz des Charts ist das ein emptyDir, sodass jeder neue Pod ein neues Zertifikat erzeugt und jeder gesicherte Server ihm erneut vertrauen muss (siehe "Persistence off" weiter unten); ein anonymes Gerät auf einem ungesicherten Kanal stört das nicht. Das Zertifikat eines Servers zu genehmigen ist derselbe Handgriff wie auf dem Gateway, `rejected/` nach `trusted/`, nur auf dem Volume des Relays.

## Remote-Befehle (4.7.0)

Zwei Sparkplug-NCMD-Befehle, beide über dieselbe Verbindung, die dieses Relay ohnehin nach außen aufbaut, ohne eingehende Verbindung:

- **Restart** (`Node Control/Reboot`), seit 4.7.0: Das Relay veröffentlicht sein eigenes ordnungsgemäßes NDEATH und beendet sich und verlässt sich darauf, dass sein Supervisor (das `Restart=always` einer Quadlet-Unit oder die Standard-`restartPolicy: Always` eines Deployments) es wieder hochfährt.

- **Update** (`Node Control/Update`): ein Operator, der das Image-Update freigibt, auf das ein Relay wartet. Es bewirkt nur etwas bei einem Relay, das Updates zurückhält; siehe [Ein Relay aktualisieren](#ein-relay-aktualisieren).

Auf der Seite des Relays entscheidet nichts, wer diese Befehle senden darf. Siehe die Seite zur Flottenverwaltung für den Flottenmanager auf Gateway-Seite, der sie sendet, und die Broker-ACL-Anforderung, die die eigentliche Autorisierungsgrenze ist.

## Ein Relay aktualisieren

Ein Relay wird nicht vom Gateway aktualisiert. Das geht nicht: Das Gateway hat keinen Weg auf den Rechner, und das Relay kann seinen eigenen Container nicht ersetzen. "Remote-Update" bedeutet also für die zwei Installationsarten etwas anderes, und diese Seite sagt welches, denn ein Versprechen, das die Plattform nicht halten kann, ist schlimmer als keines.

**Die Regel ist die, der jede HotLoop-Box folgt: `:stable` verfolgen, nie pinnen.** Ein auf `4.17.0` gepinntes Relay ist genau so alt wie am Tag der Installation, und niemand denkt daran, zurück auf den Hallenboden zu gehen und es anzuheben. Das Image, dem ein Relay folgt, ist daher `ghcr.io/hotloop-io/hotloop-edge-relay:stable`, und jedes Release verschiebt diesen Tag. Der Unterschied liegt darin, wer das Relay darauf neu startet.

### Quadlet (ein Pi oder ein kleiner Industrie-PC): aktualisiert sich selbst

Die Unit in [`deploy/quadlet`](/de/install/quadlet/) folgt `:stable` und trägt das Label, nach dem Podmans Auto-Update sucht. Schalten Sie den Timer einmal pro Rechner ein:

```sh
sudo systemctl enable --now podman-auto-update.timer
```

Wenn der Timer auslöst, lädt Podman `:stable`, und ändert sich der Digest, startet es die Unit mit dem neuen Image neu. Drei Dinge machen das sicher genug, um es allein zu lassen, und alle drei wurden durch Ausführen bewiesen, nicht durch Lesen:

- **Ein Relay, das nicht zurückkommt, wird zurückgesetzt.** Die Unit hat einen Healthcheck (`/edge-relay --healthcheck`, weil das Image keine Shell und kein curl dafür hat) und meldet systemd erst als gestartet, wenn er besteht. Besteht ihn das neue Image nie, stellt Podman das vorherige Image unter `:stable` zurück und startet dieses. Ein Release, das nicht startet, kostet einige Minuten auf einer Box, kein Relay, das ausfällt. Unter Podman 4.9 (Ubuntu 24.04) leistet `Notify=healthy` allein das nicht: Es wird als einfaches `true` gelesen, das Relay gilt als oben, sobald sein Container startet, und Podman meldet das Update als Erfolg, während das Relay tot ist. Die Unit setzt deshalb ausdrücklich `--sdnotify=healthy`.
- **Das Gateway sieht jedes Update.** Ein Relay trägt seine Version und den Digest seines Images in jeden Birth ein. Die Flottenliste des Gateways zeigt beides pro Relay und schreibt eine Zeile ins Systemprotokoll, wenn sich eines ändert: was es war, was es jetzt ist und beide Digests. Das ist der Audit-Trail, und er deckt ein Update aus jeder Ursache ab, auch durch einen Operator auf der Box.
- **Ein Update lässt die Daten in Ruhe.** Die Weiterleitungswarteschlange und eine gepushte Gerätedatei liegen auf dem Datenvolume, das ein neues Image nicht anfasst. Verloren geht höchstens die Abfrage, während das Relay neu startet, wenige Sekunden.

Der Digest, den ein Relay meldet, ist das, was `podman image inspect --format '{{.Digest}}'` auf dieser Box ausgibt, also das, dem Auto-Update folgt. Podman kann ein Image unter mehr als einem Digest kennen (es listet sie unter `RepoDigests`), wenn eine Registry ein anderes Manifestformat speichert als das, mit dem es arbeitet. Vergleichen Sie ihn daher auf jedem Relay auf dieselbe Weise und nicht mit dem Header einer Registry.

### Quadlet, Updates zurückhalten, bis ein Operator freigibt (optional)

Manche Standorte wollen selbst bestimmen, wann: ein Relay an einer Linie, die während einer Schicht nicht flackern darf. Das ist `edge-relay-hold.conf`, ein systemd-Drop-in, und es ist nie der Standard. Damit meldet das Relay `"updateMode": "approve"`, der Timer ist aus, und nichts wird aktualisiert, bis ein Admin `POST /api/fleet/{id}/update` vom Gateway sendet. Das Relay beendet sich dann mit Status 75, systemd startet es mit dem vorhandenen Image neu, und ein separater Job wartet, bis es gesund ist, und führt `podman auto-update` aus: das neue Image, falls es eines gibt, mit demselben Rollback, und ein Relay, das umsonst geflackert hat, falls nicht. Bewiesen mit einem echten Update, das 30 Sekunden zurückgehalten wurde, während das Relay unberührt lief, und dann nach Freigabe übernommen wurde.

Wissen Sie, was es kostet. Der Timer muss für die ganze Maschine aus sein, weil Podmans Auto-Update jeden gelabelten Container behandelt und keinen überspringen kann; eine Box, die ihn für anderes braucht, kann dieses Relay nicht zurückhalten. Und das Gateway kann Ihnen nicht sagen, dass ein Update wartet, nur was jedes Relay gerade ausführt. Vergleichen Sie also die Flottenliste mit dem aktuellen `:stable`, bevor Sie freigeben. Eine Freigabe enthält kein Image: Das Relay kann nur angewiesen werden, auf das zu aktualisieren, dem seine eigene Unit folgt.

### Helm: Sie führen `helm upgrade` aus

Ein Pod kann sich nicht selbst ersetzen, und ein Deployment gehört Helm, also gibt es kein Remote-Update für das Chart. Das `image.tag` des Charts ist standardmäßig seine `appVersion`, also das Release, daher:

```sh
helm repo update
helm upgrade edge-relay hotloop/hotloop-edge-relay --reuse-values
```

bringt den Pod auf das neue Release. Die Strategie des Charts stoppt den alten Pod, bevor der neue startet (`maxSurge: 0`, weil die Weiterleitungswarteschlange eine Datei mit einem einzigen Schreiber auf einem Volume ist), es gibt also eine Lücke, bis er hochkommt. Das Gateway sieht die neue Version im nächsten Birth des Relays und protokolliert die Änderung. Unter Helm meldet ein Relay keinen Image-Digest (ein Container sieht seinen eigenen nicht, und Kubernetes reicht ihn nicht weiter), nur seine Version. `Node Control/Update` bewirkt hier nichts, und das Relay sagt das in seinem Log; Helm ist die Freigabe.

### Was nicht dabei ist, und warum

- **Signierte Images und eine Digest-Allowlist.** Das Gateway kann beides auf einer Box, auf die es keinen Weg hat, nicht durchsetzen, und eine Prüfung, die das Relay an sich selbst ausführt, überspringt ein kompromittiertes Relay. Podman kann Signaturen beim Pull prüfen (`policy.json`), und das ist der Ort, an dem es funktioniert; nichts hier richtet diese Richtlinie für Sie ein, und `:stable` wird so vertraut wie jedem Tag.
- **Gestaffelter Rollout.** Jedes Relay auf einer Box folgt auf seinem eigenen Timer demselben Tag, eine Flotte wird also über die Streuung des Timers aktualisiert und nicht in Wellen, und das Rollback oben begrenzt ein schlechtes Release. Um bewusst zu staffeln, halten Sie die Standorte, die warten sollen, mit dem Hold-Drop-in zurück und geben Sie sie in der gewünschten Reihenfolge frei.

## Konfigurations-Push (4.8.0)

Eine neue Gerätedatei kann auf einem eigenen, einfachen (nicht Sparkplug), retained MQTT-Topic gepusht werden. Die Gateway-Seite steht im Abschnitt "Config push" der Seite zur Flottenverwaltung. Bis 4.17 hat ein Push die Datei nur bereitgestellt, und das Relay fragte die alte Liste weiter ab, bis etwas es neu startete. Das machte jede Änderung an dem, was ein Relay abfragt, zu einem Neustart des Relays, seiner Broker-Sitzung und jeder Gerätesitzung, auf einer Box, die monatelang unberührt dastehen soll. Jetzt wirkt ein Push in dem Moment, in dem er ankommt.

- Gepusht, während dieses Relay **läuft**: Die Bytes werden mit denselben Regeln validiert, die `LoadDeviceFile` beim Booten anwendet, in `HOTLOOP_EDGE_RELAY_PUSHED_FILE` gespeichert (oder über `HOTLOOP_EDGE_RELAY_DEVICES_FILE`, wenn das nicht gesetzt ist; siehe unten) und live angewendet. Mit Absicht zuerst gespeichert: Eine Liste, die lief, aber nie gespeichert wurde, würde beim nächsten Boot stillschweigend zurückfallen.
- **Ein fehlerhafter Push wird abgelehnt, und die alte Liste läuft weiter.** Einer, der sich nicht parsen oder validieren lässt (ein doppeltes Gerät, ein Tag an einem Gerät, das niemand deklariert hat, ein unbekanntes Protokoll) oder sich nicht speichern lässt, ändert nichts: weder die laufenden Geräte noch die Datei auf der Platte. Das Log sagt warum, ebenso `/status` unter `config.rejected`, woher die Flottenansicht des Gateways es übernimmt.
- Gepusht, während das Relay **offline** war: Es ist nichts da, was ihn bis zum nächsten Boot entgegennimmt; dann gibt das Relay einem retained Push ein paar Sekunden, um anzukommen, *bevor* es seine lokale Gerätedatei lädt, und bootet so direkt damit. Ein Push, der nach diesen zwei Sekunden eintrifft, wird wie jeder andere live angewendet.
- Der Broker liefert den retained Push bei jedem Wiederverbinden zurück. Das Relay kennt die Datei, die es ausführt, an ihrem sha256, sodass dieselben Bytes, die erneut ankommen, nichts ändern.

### Was ein Live-Apply beibehält und was er ändert

Das Relay ermittelt Gerät für Gerät, was sich zwischen der laufenden und der neuen Datei geändert hat, und fasst nur das an:

- **Ein unverändertes Gerät behält seine Sitzung.** Dieselbe TCP-Verbindung zur SPS, dasselbe OPC-UA-Abonnement, keine Lücke in seinen Messwerten.
- **Ein geändertes Gerät** (Adresse, Protokoll, Abfrageintervall, Timeout, Konfigurationsblock oder Tags) wird mit der neuen Definition neu verbunden.
- **Ein neues Gerät** wird verbunden und beginnt mit der Abfrage.
- **Ein entferntes Gerät** (oder eines, das jetzt `"enabled": false` hat) wird getrennt.
- **Die Sparkplug-Sitzung bleibt oben.** Kein NDEATH, kein Wiederverbinden, dieselbe bdSeq, und die Weiterleitungswarteschlange wird nicht berührt. Ein Reload während eines Broker-Ausfalls lässt jeden gepufferten Messwert in der Warteschlange; sie laufen ab, wenn der Broker wieder da ist, genau wie ohne Reload.

Auf der Leitung gilt Sparkplug B. Das Relay ist ein Edge-Knoten, und jeder Tag ist eine Knoten-Metrik namens `device/tag`; geändert wird also der Metrik-Satz des Knotens, und Sparkplug gibt einem Knoten genau einen Weg dafür: einen neuen NBIRTH, der den letzten vollständig ersetzt. Daher:

- **Metriken, die weggefallen sind** (ein entferntes Gerät, ein entfernter oder deaktivierter Tag) werden noch einmal in einem NDATA als null gesendet, dann erzeugt der Knoten ohne sie einen Rebirth: dieselbe Sitzung, dieselbe bdSeq, seq zurück auf 0, derselbe Rebirth wie bei `Node Control/Rebirth`. Das null ist da, weil ein Host den letzten Wert einer Metrik behalten darf, die ein neuer Birth auslässt, und der Sparkplug-Host des Gateways genau das tut. Ohne das null würde ein Ventil, das Sie vom Relay genommen haben, ewig auf seinem letzten guten Messwert stehen und gesund aussehen.
- **Neue Metriken** kommen bei der ersten Abfrage ihres Geräts in einen Birth, genauso wie jede Metrik beim Boot. Ein Birth nennt nie eine Metrik, bevor ein Messwert dahintersteht.
- **Messwerte eines entfernten Tags, die noch in der Weiterleitungswarteschlange liegen**, werden beim Leeren der Warteschlange verworfen, mit einer Logzeile, die sie zählt. Der Birth des Knotens trägt diese Metrik nicht mehr, und Sparkplug kennt keinen zulässigen Weg, eine zu senden, die er nicht trägt; sie zu senden hieße, einen Alias zu verwenden, von dem nie ein Host erfahren hat.

Die lokale Gerätedatei von Hand zu bearbeiten erfordert weiterhin einen Neustart: Das Relay liest sie beim Boot und wenn ein Push gelöscht wird, und überwacht sie nicht. Unter dem Chart tut das ein `helm upgrade`, das `devices` ändert, ohnehin.

### Wo eine gepushte Datei liegt und welche Datei gewinnt

Beide unterstützten Installationen hängen die lokale Gerätedatei schreibgeschützt ein: das Chart aus einer ConfigMap (oder einem Secret), die Quadlet-Unit als `:ro`-Bind, beide auf einem schreibgeschützten Root-Dateisystem. Bis 4.16.0 schrieb das Relay einen Push direkt neben diese Datei, sodass auf beiden Installationen jeder einzelne Push scheiterte mit

```
a pushed config was rejected; keeping the current one and continuing to run
error="write /etc/edge-relay/devices.json.tmp: open /etc/edge-relay/devices.json.tmp: read-only file system"
```

und das Relay die alte Liste weiter abfragte. Das Gateway meldete `config pushed`, der Neustart lief durch, und nichts änderte sich. Behoben ist das dadurch, dass der Push ein eigenes Zuhause bekommt:

- **`HOTLOOP_EDGE_RELAY_PUSHED_FILE`** ist der Ort, an den ein Push geschrieben wird. Das Chart setzt ihn auf `/data/pushed-devices.json` auf dem PVC (`pushedDevicesFile` in values.yaml), und die Quadlet-Unit setzt denselben Pfad auf ihrem benannten Datenvolume. Beide überleben den Container, und das PVC überlebt ein Neuansetzen. Das Letzte ist Absicht: Ein emptyDir wäre auch beschreibbar, ist aber weg, sobald der Pod umzieht, und ein Relay, das nach einem Node-Drain stillschweigend zu seiner alten Geräteliste zurückkehrt, ist derselbe Fehler mit zusätzlichen Schritten.
- **Die gepushte Datei gewinnt.** Beim Boot lädt das Relay die gepushte Datei, wenn sie existiert, und die lokale nur, wenn nicht. Das gilt nach einem Neustart, nach einem Neuansetzen, nachdem der Broker den retained Push verloren hat (ein Mosquitto-Neustart ohne Persistenz) und nach einem `helm upgrade`, das `devices` oder `tags` ändert. Der Push ist die neuere, bewusste Änderung, und der Broker würde die retained Kopie beim nächsten Boot ohnehin sofort zurückgeben, sodass ein Sieg der lokalen Datei nur bis zum nächsten Neustart hielte. Die ersten Zeilen des Logs sagen, von welcher Datei es gebootet hat: `booting from the pushed device file; the local one is ignored until the push is cleared`.
- **Zurück zur lokalen Datei** (die `devices` des Charts oder `/etc/edge-relay/devices.json` unter Quadlet) geht mit `DELETE /api/fleet/{id}/config` auf dem Gateway. Das Löschen entfernt den retained Push auf dem Broker, sodass ihn kein späterer Boot anwendet, und ein Relay, das gerade verbunden ist, lädt seine lokale Datei, löscht seine gepushte Datei, protokolliert `the config push was cleared; the local device file takes over` und wendet die lokale Datei live an, genau wie ein Push angewendet wird. Lässt sich die lokale Datei nicht laden, behält das Relay die gepushte Datei laufend und auf der Platte und sagt das im Log und in `/status`: Sie zuerst zu löschen, ließe ein Relay zurück, das beim nächsten Neustart in eine kaputte Datei bootet. Korrigieren Sie die lokale Datei und senden Sie das Löschen erneut. Tun Sie es, solange das Relay **online** ist. Ein Löschen ist nicht retained, sodass ein Relay, das dabei offline war, nie davon erfährt und seine gepushte Datei behält; fahren Sie es hoch und senden Sie das Löschen erneut. Es lässt sich gefahrlos wiederholen.
- Eine gepushte Datei, die existiert, sich aber nicht laden lässt (ein Plattenfehler oder ein späteres Release mit strengeren Regeln), wird als Fehler protokolliert, und das Relay bootet von der lokalen Datei, statt deswegen auszufallen.
- Ist `HOTLOOP_EDGE_RELAY_PUSHED_FILE` nicht gesetzt, überschreibt ein Push `HOTLOOP_EDGE_RELAY_DEVICES_FILE` selbst, das Verhalten von 4.8.0. Das taugt nur für eine bloße Binärdatei mit beschreibbarer Gerätedatei, und dann gibt es keine getrennte Kopie, die ein Löschen verwerfen könnte.

Wenn ein Push "nicht angekommen" ist, schauen Sie vor allem anderen ins Log des Relays. Entweder steht dort, von welcher Datei es gebootet hat, oder warum der Push abgelehnt wurde.

## Die HTTP-Oberfläche

Zwei Endpunkte, beide ohne Authentifizierung, beide schreibgeschützt:

- `GET /healthz`: Der Prozess läuft. Mehr nicht; ein getrenntes Gerät heißt nicht, dass dieser Prozess ungesund ist.
- `GET /status`, eine Momentaufnahme: Geräteanzahl nach Verbindungszustand, Tag-Anzahl, aktuelle Tiefe der Weiterleitungswarteschlange, die einkompilierte Protokollliste und `uplink`: ob der Broker verbunden ist, ob eine Wiedergabe läuft und was die Weiterleitungswarteschlange hält, wie viel sie auf der Platte wiegt und was sie an ihrer Grenze verworfen hat (siehe die Seite Edge Publish, "When the uplink is down"). Keine Tag-Werte, keine Geräteadressen, keine Konfiguration: Das ist eine Überwachungsoberfläche, keine kleinere Kopie des Gateway-Dashboards. `version`, `imageDigest` und `updateMode` sagen, welcher Build es ist und ob er Updates zurückhält. Unter `config` sagt es auch, welche Gerätedatei läuft: `source` (`local` oder `pushed`), `path`, ihren sha256-`digest`, `appliedAt` und `rejected`, die letzte Datei, die das Relay abgelehnt hat, samt Grund, bis ein späterer Push angewendet wird. Der Digest, nicht die Datei: Das Gateway kann ihn mit dem abgleichen, was es gepusht hat, ohne dass Adressen und Zugangsdaten der Datei über einen unauthentifizierten Port hinausgehen. Steht ein `discovery`-Broker in der Datei, sagt es unter `discovery` außerdem, wie es jedem geht und wie viele Geräte er gefunden hat (siehe [Discovery](#discovery-41810)).

Absichtlich keine Authentifizierung vor beiden: Ein Edge Relay hat keine Benutzerdatenbank, keinen Sitzungsspeicher und kein Identitätssystem, aus dem sich eine bauen ließe, und ein einzelnes gemeinsames Token wäre Theater statt Sicherheit für zwei Endpunkte, die nichts Sensibles preisgeben. Betreiben Sie ihn hinter dem Netzwerkperimeter, hinter dem das Gerät selbst sitzt, dieselbe Erwartung, die der `auth.insecure`-Modus des Gateways für den Betrieb hinter einem vertrauenswürdigen Proxy bereits dokumentiert.

## Konfiguration

| Variable | Standard | <span class="sr-only">Details</span> |
|---|---|---|
| `HOTLOOP_EDGE_RELAY_DEVICES_FILE` | n/a | Erforderlich. Pfad zur oben beschriebenen Gerätedatei |
| `HOTLOOP_EDGE_RELAY_PUSHED_FILE` | unset | Wo eine gepushte Gerätedatei liegt; sie gewinnt gegenüber der obigen, solange sie existiert. Muss beschreibbar und persistent sein; das Chart und die Quadlet-Unit verwenden `/data/pushed-devices.json`. Siehe [Wo eine gepushte Datei liegt](#wo-eine-gepushte-datei-liegt-und-welche-datei-gewinnt) |
| `HOTLOOP_EDGE_RELAY_LISTEN_ADDR` | `:8081` | Der Server für `/healthz` und `/status` |
| `HOTLOOP_EDGE_RELAY_UPDATE_MODE` | `auto` | `auto` überlässt das Aktualisieren dem Supervisor und ignoriert eine Freigabe vom Gateway; `approve` hält Updates zurück, bis eine eintrifft. Siehe [Ein Relay aktualisieren](#ein-relay-aktualisieren) |
| `HOTLOOP_IMAGE_DIGEST` | unset | Der Digest des Images, mit dem dieses Relay läuft, wie sein Supervisor ihn kennt. Die Quadlet-Unit setzt ihn vor jedem Start. Wird in `/status` und in jedem Birth gemeldet; leer ist in Ordnung |
| `HOTLOOP_LOG_LEVEL` | `info` | |
| `HOTLOOP_POLL_INTERVAL` | `5s` | Standard-Abfrageintervall; das eigene `pollIntervalMs` eines Geräts hat Vorrang |
| `HOTLOOP_MIN_POLL_INTERVAL` | `100ms` | Untergrenze, die für jedes Gerät gilt, unabhängig von seiner eigenen Einstellung |
| `HOTLOOP_POLL_TIMEOUT` | `10s` | Standard-Timeout pro Abfrage; das eigene `timeoutMs` eines Geräts hat Vorrang |
| `HOTLOOP_MAX_CONCURRENT_POLLS` | `32` | Geräte, die gleichzeitig mitten in einer Abfrage sein dürfen |
| `HOTLOOP_RECONNECT_MIN` / `HOTLOOP_RECONNECT_MAX` | `1s` / `60s` | Backoff-Grenzen zwischen Wiederverbindungsversuchen, mit Jitter |
| `HOTLOOP_RING_SIZE` | `120` | Messwerte pro Tag, die für Diagnosen rund um `/status` gehalten werden |
| `HOTLOOP_OPCUA_CLIENT_PKI_DIR` | `/data/opcua-client-pki` | Das Zertifikat des OPC-UA-Treibers und seine Speicher `trusted/` und `rejected/`; das eigene `pkiDir` eines Geräts hat Vorrang. Nur ein gesichertes OPC-UA-Gerät berührt es |

Variablennamen und Standardwerte sind identisch mit der `RuntimeConfig` des Gateways; dieselben Einstellungen als Helm-Werte stehen im Abschnitt "Polling" auf der Seite zu k3s und Helm, denn beide Binärdateien laden diese Konfiguration über dieselbe Funktion `config.LoadRuntimeConfig()`, nicht über zwei Kopien, die auseinanderlaufen könnten.

Dazu jede Variable `HOTLOOP_EDGE_PUBLISH_*`, die die Seite Edge Publish dokumentiert, mit einem Unterschied: `HOTLOOP_EDGE_PUBLISH_ENABLED` wird ignoriert, und das Weiterleiten ist immer an. Das, was es liest, zu veröffentlichen, ist der ganze Zweck dieser Binärdatei, keine Option wie auf dem Gateway.

## Was verifiziert ist und was nicht

HotLoop wurde mit echten Geräten und echten Servern betrieben, und am 2026-11-17 auf echter Hardware.

## Bereitstellung

Zwei unterstützte Wege, beide Container, kein bloßes `podman run` aus einer Shell, die mit der Sitzung stirbt, und kein Docker:

- **`charts/hotloop-edge-relay`**, ein k3s-Helm-Chart, getrennt vom eigenen Chart des Gateways (`charts/hotloop`), weil ein Edge Relay ein wirklich anderes Artefakt ist, das oft in einem anderen, kleineren Cluster läuft als das Gateway, an das er weiterleitet. Geräte und Tags werden in `values.yaml` deklariert und in eine ConfigMap gerendert; die Weiterleitungswarteschlange liegt auf einem kleinen PVC (siehe "Persistence off" unten, bevor Sie es abschalten).
- **`deploy/quadlet`**, eine Podman-Quadlet-Unit für einen Pi oder einen kleinen Industrie-PC, der gar nicht Teil eines k3s-Clusters ist. Quadlet macht den Container zu einem echten systemd-Dienst: startet beim Booten, startet bei Fehlern neu, schreibt ins journald; die Installationsschritte stehen in der README dieses Verzeichnisses.

Beide nutzen dasselbe Image und dieselben oben dokumentierten Umgebungsvariablen.

Jedes Release veröffentlicht beide, ab 4.16.0. Das Image ist `ghcr.io/hotloop-io/hotloop-edge-relay`, getaggt mit der Release-Version (dazu `major.minor`, `major`, `latest` und `stable`; die Quadlet-Unit folgt `stable`, siehe [Ein Relay aktualisieren](#ein-relay-aktualisieren)). Es gibt es für amd64 und arm64 und ab dem ersten Release nach 4.17.0 auch für 32-Bit-arm (arm/v7), denn ein Pi 3 oder eine 32-Bit-Pi-OS-Installation ist genau die Box, auf der ein Relay landet. Das Chart liegt im selben Helm-Repository wie das des Gateways:

```sh
helm repo add hotloop https://hotloop.io/hotloop/
helm install edge-relay hotloop/hotloop-edge-relay \
  --namespace hotloop --create-namespace \
  --set edgePublish.broker=tcp://gateway.example.local:1883 \
  --set edgePublish.group=Plant1
```

### Persistence off

`persistence.enabled=false` gibt Ihnen ein Relay, das ohne PVC läuft, und genau das. Unter 4.16.0 lief es dann gar nicht: Nichts war unter `/data` eingehängt, das Root ist schreibgeschützt, und das Relay starb beim Boot mit `open forward queue at /data/forward.db: no such file or directory`. Jetzt ist `/data` ein emptyDir, begrenzt auf `persistence.size`, und alles, was das Relay schreibt, landet dort.

Ein emptyDir lebt so lange wie der Pod. Ein Container-Neustart im selben Pod behält es. Ein neuer Pod nicht, und Sie bekommen einen neuen Pod bei einem Node-Drain, einem Node-Ausfall, einer Eviction, einem `kubectl delete pod` und jedem `helm upgrade`, das das Deployment neu ausrollt. Jedes Mal verlieren Sie:

- **Die Weiterleitungswarteschlange.** Jeder Messwert, der gepuffert wurde, während der Broker aus war, ist weg, und auf der Gateway-Seite weiß nichts, dass er fehlt.
- **Eine gepushte Gerätedatei.** Das Relay bootet wieder ohne Beschwerde mit den `devices` des Charts, bis das Gateway erneut pusht oder der Broker einen retained Push wiedergibt. Genau diesen Fehler soll das PVC verhindern, und es abzuschalten setzt Sie ihm wieder aus.
- **Das OPC-UA-Client-Zertifikat und den Trust-Store.** Jeder gesicherte Server muss dem neuen Zertifikat vertrauen, und der Operator muss das Zertifikat jedes Servers erneut genehmigen.

Eine Warteschlange ohne Grenze (`queueMaxBytes: 0`; der Standard ist 64 MiB) füllt die Obergrenze in einem langen genug Ausfall, und dann wird der Pod evictet und alle drei gehen auf einmal verloren. Das ist immer noch besser, als die Platte des Nodes unter allem anderen darauf vollzuschreiben. Die Installationshinweise geben eine Warnung aus, wenn Persistenz aus ist. Für einen Test ist es in Ordnung. Für ein Relay, dessen Messwerte zählen, geben Sie ihm das PVC.

### Aus dem EmberNet App Store

Der Store listet das Relay als HotLoop Edge Relay, eines pro Node. Ein Store-Deploy übergibt dem Chart drei Dinge: den Anzeigenamen (der Release-Name), einen Node-Selector und die Tenant-Labels. Er hat kein Formular für sonst etwas, und das Relay kann ohne Broker und Sparkplug-Gruppe nicht laufen. Deshalb bleibt ein Store-Deploy des Relays absichtlich beim Rendern stehen, mit einem Fehler im Log des helm-install-Jobs, der nennt, was fehlt, und den genauen Befehl zur Behebung ausgibt.

Wir haben ihm keinen Standard-Broker gegeben, weil es keinen gibt, der für irgendjemandes Anlage stimmt, und ein Relay, das auf eine erfundene Adresse zeigt, würde bereitgestellt aussehen, während es nichts weiterleitet. Es kann auch nicht einfach auf eine gepushte Gerätedatei warten: Ein Push kommt über die Broker-Verbindung, die es noch nicht hat.

Die Lösung ist, die beiden Werte in das einzutragen, was der Store geschrieben hat, und die Installation versucht es von selbst erneut:

```sh
# a node on the local cluster: add them under spec.valuesContent
kubectl -n default edit helmchart hotloop-edge-relay-<node>

# a tenant on its own cluster (Fleet): add them under spec.helm.values
kubectl -n fleet-default edit helmop hotloop-edge-relay-<node>
```

```yaml
edgePublish:
  broker: tcp://<gateway-or-broker>:1883
  group: <sparkplug group id>
```

Sobald es läuft, erscheint es unter Laufende Apps mit dem Namen, den der Store vergeben hat, mit dem HotLoop-Symbol, begrenzt auf den Tenant, der es bereitgestellt hat, und ohne Schaltfläche STARTEN. Das Letzte ist Absicht: Das Chart labelt es `embernet.ai/gui-type: none`, weil `/healthz` und `/status` für eine Probe und das curl eines Operators gedacht sind, nicht für eine Seite in einem iframe.

Relay und Gateway teilen sich eine Versionsnummer. Ein Release startet nicht, wenn nicht beide Charts die Version des Tags tragen und die Quadlet-Unit des Relays `:stable` folgt, daher bekommt das Relay mit jedem Release eine neue Version, ob sich sein eigener Code geändert hat oder nicht. Das ist Absicht: eine Nummer zum Nachfragen, und kein Relay-Chart, das auf ein Relay-Image zeigt, das niemand gepusht hat. Die Quadlet-Unit hat früher die Release-Nummer gepinnt, das Gegenteil dessen, wie eine Box funktioniert, die sich selbst aktualisiert.
