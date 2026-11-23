---
title: "MCP für Agenten"
description: "Ein Agent liest die ganze Anlage und fasst nur an, was Sie scharf geschaltet haben, durch das Schreib-Gate, mit Begründung jedes Schreibvorgangs im Protokoll."
---

Das Gateway spricht MCP in beide Richtungen: Agenten können die Anlage lesen und steuern, und eine Automatisierungsregel kann ein Tool an anderer Stelle aufrufen.

Die Entwurfsregel lautet, dass **ein Agent ein Aufrufer wie jeder andere ist**. Die Tools lesen über denselben Cache, den auch die Oberfläche liest, und schreiben durch dasselbe Gate, durch das auch die Oberfläche schreibt. Es gibt keinen bevorzugten Pfad, keinen Bypass und keine eigene Richtlinie. Ein Schreibvorgang, der einem Bediener verweigert würde, wird verweigert; ein Schreibvorgang, der gelingt, landet in derselben Audit-Tabelle mit `mcp:` vor dem Akteur.

## Bereitstellung

### Über HTTP

Standardmäßig aktiviert unter `/mcp` am Port der Anwendung, geschützt durch ein Bearer-Token, das das Chart in das Secret des Releases erzeugt.

```bash
kubectl -n hotloop get secret <release> \
  -o jsonpath='{.data.mcp-token}' | base64 -d
```

Im Cluster lautet der Endpunkt:

```
http://<release>.<namespace>.svc.cluster.local:8080/mcp
```

Die Token-Prüfung sitzt vor dem Handler, sodass ein nicht authentifizierter Aufrufer nicht einmal auflisten kann, was es gibt. Wenn Sie `mcp.token` leer lassen, erzeugt das Chart eines, das Standard-Deployment ist also nicht versehentlich das offene. Kombinieren Sie es mit der NetworkPolicy; ein Token ist eine zweite Verteidigungslinie, nicht die einzige.

Der Endpunkt ist nie offen. Starten Sie die Binärdatei ohne `HOTLOOP_MCP_TOKEN` (eine Quadlet-Unit, ein nacktes `hotloop`), dann erzeugt sie beim ersten Start ein Token und behält es in ihrer Datenbank, sodass nach einem Neustart, auf jedem Replikat und nach einer Wiederherstellung dasselbe zurückkommt. `hotloop mcp-token` gibt es aus (das Protokoll sagt, dass es eines erzeugt hat, und nie, welches). Setzen Sie `HOTLOOP_MCP_TOKEN`, um ein eigenes zu wählen; bei gesetztem `HOTLOOP_MCP_OIDC_*` nimmt der Endpunkt eine Anmeldung an und führt kein eigenes Token. Ein Client, der sich früher ohne alles mit einer nackten Binärdatei verband, bekommt jetzt ein `401`, bis er `Authorization: Bearer <that token>` sendet.

### Mit einer Vord-Anmeldung oder einer Hub-Assertion

Das statische Token sagt, welcher Client aufgerufen hat; es kann nicht sagen, welche Person. Bei gesetztem OIDC nimmt `/mcp` auch `Authorization: Bearer <jwt>` an, und die E-Mail der verifizierten Person wird zum Audit-Akteur: ein Schreibvorgang landet als `mcp:pat@example.com` statt als `mcp:<client name>`. Das Verhalten ohne OIDC bleibt unverändert, und das statische Token funktioniert daneben weiter (ohne gesetztes statisches Token kommt nur ein verifiziertes JWT hinein).

| Variable | Chart-Wert | Zweck |
|---|---|---|
| `HOTLOOP_MCP_OIDC_ISSUER` | `mcp.oidc.issuer` | die URL des Vord-Realms; akzeptiert dessen Zugriffstokens |
| `HOTLOOP_MCP_OIDC_AUDIENCE` | `mcp.oidc.audience` | das `aud`, das jedes Token tragen muss; erforderlich mit einer von diesen beiden |
| `HOTLOOP_MCP_OIDC_HUB_JWKS_URL` | `mcp.oidc.hubJwksUrl` | die Assertion-Schlüssel des Identity-Hubs; akzeptiert dessen Assertionen |
| `HOTLOOP_MCP_OIDC_REQUIRED_ROLE` | `mcp.oidc.requiredRole` | eine Realm-Rolle, die der Aufrufer haben muss |
| `HOTLOOP_MCP_OIDC_WRITE_ROLE` | `mcp.oidc.writeRole` | beschränkt Schreibvorgänge je Aufrufer, siehe unten |

Ein Vord-Zugriffstoken wird gegen das JWKS des Ausstellers geprüft (gefunden über sein Discovery-Dokument, zehn Minuten gecacht, bei unbekanntem `kid` neu geholt): nur RS256 oder ES256, `iss` gleich dem Aussteller, `aud` enthält die Audience, `exp` und `nbf` mit 30 s Toleranz und ein `email`-Claim (oder `preferred_username`). Vord setzt standardmäßig nur `account` in `aud`; geben Sie dem Client-Scope einen Audience-Mapper für die Audience, die Sie setzen.

Eine Hub-Assertion ist `typ` `fb-assert+jwt`, EdDSA, `iss` `fireball-hub`, `aud` die konfigurierte Audience (das Hub-Modul sendet `hotloop`), nicht abgelaufen, signiert von einem Schlüssel im JWKS des Hubs. Es gibt keinen `jti`-Replay-Cache: ein Tool-Aufruf sind mehrere HTTP-Anfragen (initialize, dann der Aufruf), die dieselbe Assertion tragen, die 60 s lebt. Wenn der Hub sagt, der Aufruf handle für jemand anderen (`acting_as`), liest sich der Akteur `mcp:<email> for <acting_as email>`.

Schreibvorgänge brauchen weiterhin `HOTLOOP_ALLOW_WRITES`, den Hauptschalter; ein Token erweitert ihn nie. `HOTLOOP_MCP_OIDC_WRITE_ROLE` schränkt sie je Aufrufer ein: `hotloop:hotloop.write` bedeutet die Vord-Client-Rolle `hotloop.write` am Client `hotloop` (`resource_access.hotloop.roles`), ein bloßer Name bedeutet eine Realm-Rolle, und eine Hub-Assertion muss den Namen der Rolle in `abilities` tragen. Ein Aufrufer ohne sie kann lesen, aber `write_tag`, `call_service`, `run_script`, `apply_recipe`, `trigger_automation` und jedes Tool, das die Konfiguration ändert, lehnen ab. Das statische Token wird dadurch nicht eingeschränkt.

### Über stdio

Dieselbe Binärdatei bedient MCP auf stdin und stdout mit `--mcp-stdio`, für einen Client, der sie direkt startet. Alles andere startet ebenfalls, sodass der Agent eine lebendige Anlage sieht und keinen hohlen Server.

```json
{
  "mcpServers": {
    "hotloop": {
      "command": "/usr/local/bin/hotloop",
      "args": ["--mcp-stdio"],
      "env": {
        "HOTLOOP_DB_HOST": "timescale.plant.local",
        "HOTLOOP_DB_PASSWORD": "…"
      }
    }
  }
}
```

Im stdio-Modus geht die gesamte Protokollierung nach stderr. Alles, was auf stdout geschrieben würde, würde den Protokollstrom beschädigen.

## Tools

Einhunderteinundsiebzig: siebenundzwanzig, die die Anlage lesen und befehlen, neunundsechzig, die ihre Konfiguration ändern ([unten](#konfiguration-ändern)), dreiunddreißig Lesevorgänge und Probeläufe, die dazugehören ([unten](#lesevorgänge-und-probeläufe)), und zweiundvierzig für die Administration ([unten](#administration)).

| Werkzeug | Tut |
|---|---|
| `get_plant_status` | Geräte online, offene Alarme, ob Schreiben aktiviert ist |
| `list_devices` | jedes Gerät mit Protokoll, Adresse, Zustand, Anzahl der Tags |
| `describe_device` | ein Gerät im Detail, mit seinen Tags und Abfragestatistik |
| `list_tags` | durchsucht den Katalog nach Gerät, Name oder Beschreibung |
| `read_tag` | aktuelle Werte, mit Qualität |
| `query_history` | historische Messwerte, roh oder in Intervallen |
| `write_tag` | **befiehlt ein Tag** |
| `list_alarms` | Alarme und ihre ISA-18.2-Zustände |
| `ack_alarm` | quittiert im Namen eines Bedieners |
| `list_automations` | Regeln, Ausführungszähler, letztes Ergebnis |
| `trigger_automation` | führt eine Regel jetzt aus |
| `describe_protocol` | was dieser Build tatsächlich spricht |
| `recent_events` | das Systemprotokoll, um herauszufinden, was in welcher Reihenfolge geschah |
| `list_entities` | findet Entitäten nach Domäne, Ausrüstungsknoten oder Label, mit den Services, die jede annimmt |
| `get_states` | aktueller Zustand einer oder mehrerer Entitäten, mit Qualität und Attributen |
| `call_service` | **befiehlt eine Entität**: `switch.turn_on`, `number.set_value` |
| `get_logbook` | eine einzige Zeitleiste von Zustandsänderungen, Schreibvorgängen, Alarmen, Läufen und Konfigurationsänderungen, nach Entität, Ausrüstungsknoten, Akteur oder Art |
| `list_scripts` | die Skripte der Anlage, die Felder, die jedes annimmt, ob es läuft, sein letzter Lauf |
| `run_script` | **führt ein Skript aus**, oder fragt mit `dryRun`, was es jetzt tun würde |
| `list_recipes` | die Rezepte der Anlage: Ziele der Reihe nach, Parameter, Vorbedingung, Version, letzte Anwendung |
| `validate_recipe` | würde ein Rezept jetzt angewendet? alle Gründe, aus denen es abgelehnt würde; es wird nichts geschrieben |
| `apply_recipe` | **wendet ein Rezept an**: ganz geprüft, der Reihe nach geschrieben, zurückgelesen |
| `list_blueprints` | die Blueprints, die Leute ausfüllen, um Regeln zu erzeugen, ihre Eingaben und Versionen |
| `preview_blueprint` | die Regel, die ein Blueprint mit gegebenen Eingaben erzeugen würde, und was sie jetzt tun würde; erzeugt nichts |
| `find_network_client` | wo ein Gerät im Anlagennetz ist: sein Switch-Port, ob der Port eine Verbindung hat, wann die UniFi-Konsole es zuletzt gesehen hat |
| `get_network_topology` | das Anlagennetz, wie die UniFi-Konsole es zeichnet: was woran hängt, der Zustand jedes Geräts, und die HotLoop-Geräte, die ihr Netz verlieren, wenn es ausfällt |
| `get_network_events` | die neuesten Ereignisse, die eine UniFi-Konsole gemeldet hat, und ob ihr Ereignis-Websocket aktiv ist |

### Entitäten

Eine Entität ist das, was Leute ein Ding in der Anlage nennen, `sensor.zone_1_temperature` oder `switch.conveyor_run`, das ein oder mehrere Tags umhüllt. Siehe [Entitäten](/de/iot/entities/). Für einen Agenten sind sie meist der bessere Zugriff: der Name bedeutet etwas, und die Entität weiß, was man damit tun kann.

`list_entities` filtert nach `domain`, nach `equipment` (ein Knoten des Ausrüstungsbaums nach ID, Name oder Namenspfad wie `Plant A/Packing`, passt auf alles an oder unter ihm, wobei der eigene Platz einer Entität gegenüber dem ihres Geräts gewinnt), nach `label` (label_id oder Name; eine Entität passt, wenn sie das Label trägt oder ihr Gerät es trägt) und nach `query`, einer Teilzeichenfolge der entity_id oder des Namens. Jedes Ergebnis trägt seinen aktuellen Zustand und seine Qualität und die Services, die es annimmt, als `domain.service`. Eine Entität ohne Services ist schreibgeschützt. Die Services kommen aus der Entitätsschicht, sodass eine Domäne, die dort einen dazugewinnt, hier ohne Änderung auftaucht.

`get_states` nimmt `entity_ids` und antwortet für jede mit ihrem Zustand, ihrer Qualität, ihren Attributen und `last_changed`. Es hält dieselbe Linie wie `read_tag`: ein Zustand `unknown` oder `unavailable` wird mit einem Hinweis beantwortet, dass er kein Wert ist, eine deaktivierte Entität sagt, dass sie deaktiviert ist, statt zu fehlen, und schlechte Qualität wird ausgeschrieben.

`call_service` nimmt `domain`, `service`, `entity_id`, `data` und ein **erforderliches** `reason`:

```
> call_service domain=number service=set_value entity_id=number.press_01_sp
    data={"value": 212.5} reason="operator asked for 212.5 on zone 1"
Called number.set_value on number.press_01_sp (was 210). Writes: 212.5 to press-01/Setpoint: written
```

Es läuft über `entity.Services`, denselben Ausführer, den `POST /api/services/...` verwendet, der den Aufruf in Schreibvorgänge durch das Schreib-Gate verwandelt. Siehe [Schreiben](#schreiben).

### Das Netzwerk

`find_network_client` beantwortet die erste Frage zu einer SPS, die still geworden ist: liegt es an der SPS oder an ihrem Switch-Port? Geben Sie ihm `deviceId`, und es folgt der bestätigten Verbindung dieses Geräts zu seinem UniFi-Client; geben Sie ihm `query` (eine MAC, eine IP oder einen Namensteil), und es durchsucht jede Konsole, die HotLoop liest. Es liest die letzte Abfrage des UniFi-Treibers, nie die Konsole, sodass ein Agent, der in einer Schleife fragt, die Konsole nichts kostet. Das heißt auch, dass ein `--mcp-stdio`-Helfer antwortet, dass in seinem Prozess keine Konsole gelesen wird: er meldet sich nie an einer an, weil das Gateway daneben die Sitzung bereits hält. Fragen Sie den Endpunkt des Gateways. Siehe [UniFi Network](/de/iot/unifi/).

`get_network_topology` ist die Karte: jeder Switch, Access Point und jedes Gateway unter dem, an dem es hängt, mit dem Port an beiden Enden, der Verbindung, wie viele Clients daran hängen und den HotLoop-Geräten, die mit einem Client darunter verbunden sind. Dieser letzte Teil ist der Wirkungsradius: er nennt die SPSen, die ihr Netz verlieren, wenn dieser Switch ausfällt. Ein Switch, den die Konsole als an nichts angeschlossen aufführt, sagt das und wird nicht ans Gateway gehängt. `get_network_events` sind die neuesten Ereignisse der Konsole, neueste zuerst, mit ihrem eigenen Satz, einem Warnflag, wo die Konsole es negativ nennt, und ob der Ereignis-Websocket aktiv ist. Beide nehmen die `deviceId` der Konsole, die man weglassen kann, wenn HotLoop nur eine liest, und beide lesen wie `find_network_client` die letzte Abfrage des Treibers, kosten die Konsole also nichts und sagen in einem `--mcp-stdio`-Helfer dasselbe: in diesem Prozess wird keine Konsole gelesen. Ältere Ereignisse stehen in `get_logbook`, abgelegt unter dem Switch oder Access Point, um den es ging.

### Das Logbuch

`get_logbook` ist die Zeitleiste, die `GET /api/logbook` liefert (siehe [Das Logbuch](/de/iot/logbook/)): Zustandsänderungen, Schreibvorgänge, Alarmübergänge, Automatisierungsläufe und Konfigurationsänderungen, neueste zuerst. Es lässt sich einschränken nach `entity`, nach `equipment` (ID, Name oder Pfad, und alles darunter; ein Name, der auf zwei Knoten passt, ist ein Fehler, der beide aufführt), nach `actor` (ein Teil davon: `mcp:` findet alles, was ein Agent getan hat), nach `kinds` und nach `minutes` zurück (Standard ein Tag). Eine Seite mit mehr danach endet mit der Angabe, was für die nächste als `before` zu übergeben ist. Für „was geschah, bevor das schiefging“ ist es das bessere `recent_events`: die eigenen Zustandsänderungen der Ausrüstung sind darin, und die Zeilen des Schreib-Gates sind nicht doppelt darin.

### Skripte

Ein Skript ist eine benannte Folge von Schritten, die jemand einmal geschrieben hat, der CIP-Zyklus oder die Linienspülung, damit ein Agent das eigene Verfahren der Anlage ausführt, statt eines zu erfinden. Siehe [Skripte](/de/iot/scripts/). `list_scripts` sagt, was jedes annimmt. `run_script` nimmt `scriptId`, `fields`, ein **erforderliches** `reason` und zwei Schalter:

- `dryRun: true` geht das Skript gegen die Anlage durch, wie sie ist, und sagt Schritt für Schritt, was geschrieben würde und was das Gate zuerst ablehnen würde, in den Worten des Gates. Es wird nichts geschrieben oder protokolliert. Fragen Sie das zuerst.
- `wait: true` antwortet, sobald der Lauf beendet ist, mit seinem Ergebnis und Verlauf. Ohne es ist die Antwort die Lauf-ID, und `list_scripts` oder `get_logbook` mit `kinds: ["script"]` sagt, wie er endete.

Der Lauf gehört dem Skript, als `script:<id>`, mit der Quelle `mcp`, sodass jeder Schreibvorgang, den es macht, dem Gate genau wie `write_tag` begegnet. Bei abgeschaltetem Schreiben (`HOTLOOP_ALLOW_WRITES`) lehnt `run_script` ab, bevor etwas läuft, wie es `trigger_automation` tut; ein Probelauf wird trotzdem beantwortet und sagt, dass der Schalter der Grund ist.

### Rezepte

Ein Rezept ist ein Satz Sollwerte, die die Anlage gemeinsam anwendet, eine Produktsorte oder ein Umrüsten, damit ein Agent die eigenen Zahlen der Anlage lädt, statt sie einzeln zu schreiben. Siehe [Rezepte](/de/iot/recipes/). `list_recipes` zeigt die Ziele jedes Rezepts der Reihe nach und die Parameter, die es nimmt. `validate_recipe` fragt, ob eines jetzt angewendet würde, und nennt jeden Grund, aus dem nicht, ohne etwas zu schreiben. `apply_recipe` nimmt `recipeId`, `params`, ein optionales `version` und ein **erforderliches** `reason`.

Es wird zuerst ganz geprüft und ganz abgelehnt, ohne etwas zu schreiben, wenn irgendein Wert abgelehnt würde; Werte außerhalb des Bereichs werden abgelehnt, nie angepasst. Dann gehen die Ziele der Reihe nach unter einer Aufruf-ID hinaus, das erste, das fehlschlägt, stoppt den Rest, und nichts wird rückgängig gemacht. Die Antwort sagt Ziel für Ziel, was hinausging und ob das Gerät den Wert zurückgelesen hat. Die Schreibvorgänge sind die des Agenten, mit der Quelle `mcp`, das Gate gilt also für jeden; bei abgeschaltetem Schreiben (`HOTLOOP_ALLOW_WRITES`) lehnt `apply_recipe` ab, bevor irgendetwas geprüft wird. Ein Rezept, das eine eigene Anwendungsberechtigung nennt, ist für die Personen, denen sie erteilt wurde, und ein Agent gehört nicht dazu.

### Blueprints

Ein Blueprint ist eine einmal geschriebene Regel mit typisierten Lücken: welcher Motor, wie lange, welche Grenze. Siehe [Blueprints](/de/iot/blueprints/). `list_blueprints` sagt, was jeder nimmt. `preview_blueprint` nimmt `blueprintId`, `automationId` und `inputs` und antwortet mit der Regel, die es erzeugen würde, und was diese Regel täte, wenn sie jetzt ausgelöst würde, jeder Schreibvorgang den Prüfungen des Gates unterworfen. Die Eingaben werden genau so geprüft, wie der Bildschirm sie prüft: außerhalb des Bereichs wird abgelehnt, nicht angepasst.

`instantiate_blueprint` erzeugt die Regel, über die Route, die der Blueprints-Bildschirm benutzt: dieselben Prüfungen, und die Regel landet im Logbuch mit dem Agenten als Urheber. Eine Regel ist ein Dauerauftrag, Ausrüstung bei jedem Auslösen ihres Triggers zu befehlen, also schaut ein Agent zuerst: `preview_blueprint` speichert nichts und schreibt nichts und wird beantwortet, ob Schreiben an ist oder nicht. Jeder Schreibvorgang, den die erzeugte Regel danach macht, begegnet dem Schreib-Gate, wie bei einer von einer Person erzeugten Regel. Siehe [Konfiguration ändern](#konfiguration-ändern).

## Konfiguration ändern

Alles, was ein Agent lesen kann, kann er ändern. Die obigen Tools, die die Anlage lesen, haben Gegenstücke, die sie ändern, neunundsechzig, und keines ist eine zweite Implementierung: jedes ist eine Route der REST-API, und ein Aufruf läuft durch den eigenen Handler dieser Route. Die Validierung, die Berechtigungsprüfung, das Neuladen der Laufzeit und die Audit-Zeile sind die der Route, mit dem Agenten als Akteur (`mcp:<client>`, oder `mcp:<email>` mit einer Vord-Anmeldung), sodass ein Gerät ohne Treiber, eine Regel, die nicht kompiliert, eine Blueprint-Eingabe außerhalb des Bereichs oder ein Tag, für das das erkannte Gerät nicht angenommen wurde, mit den Worten abgelehnt werden, die der Bildschirm zeigt, und nichts geändert wurde.

Jedes nimmt die Pfadwerte der Route nach Namen (`id`, `device`, `name`...), `body`, dasselbe JSON, das die API nimmt ([Die HTTP-API](/de/iot/api/) hat jeden Body), und ein **erforderliches** `reason`. Die Begründung wird als `config`-Zeile im Systemprotokoll neben der der Route festgehalten, gegen das, was geändert wurde.

```
> save_tag reason="the setpoint, writable between 0 and 100" body={"deviceId":"press-01",
    "name":"Setpoint","address":"holding:5:uint16","dataType":"int16","enabled":true,
    "writable":true,"hasRange":true,"minValue":0,"maxValue":100}
save_tag done.
{ ...the tag as stored... }
```

Was davor steht, ist das, was vor `write_tag` steht, abzüglich des Hauptschalters, weil auch die Bildschirme ihn nicht brauchen, um die Konfiguration zu ändern:

1. `HOTLOOP_ALLOW_MCP_WRITES`, standardmäßig an, muss an sein.
2. Ein Aufrufer, für den `HOTLOOP_MCP_OIDC_WRITE_ROLE` gesetzt ist, muss sie besitzen.
3. Der Aufruf trägt eine Berechtigung, die, die seine Route verlangt (die dritte Spalte unten), und nichts weiter. Eine Route antwortet einem Agenten, wie sie einer Person ohne diese Berechtigung antwortet, und ein Test bindet jede Zeile der Tabelle an eine echte Route und die Berechtigung, die diese Route verlangt.
4. Eine Begründung.

Ausrüstung zu befehlen bleibt `write_tag`, `call_service`, `run_script`, `apply_recipe` und `trigger_automation` mit `HOTLOOP_ALLOW_WRITES` an und der Schreibbar-Markierung und dem Bereich des Tags zu erfüllen. Ein Tag, eine Regel, ein Skript oder ein Rezept schreibbar zu machen ist Konfiguration: es befiehlt nichts, bis es benutzt wird, und was es dann befiehlt, geht durch das Gate.

Die eigenen Funktionen des Administrators sind ebenfalls Tools, unter [Administration](#administration) weiter unten. Ein erkanntes Gerät anzunehmen ist hier, wie auf dem Bildschirm; die Punkte darauf müssen weiterhin einzeln zum Schreiben scharf geschaltet werden.

Die Tools gibt es auch in `--mcp-stdio`: der Prozess baut denselben API-Server und öffnet nie seinen Port.

**Geräte und Tags**

| Tool | Route | Berechtigung |
|---|---|---|
| `save_device` | `POST /api/devices` | `devices.write` |
| `delete_device` | `DELETE /api/devices/{id}` | `devices.write` |
| `set_device_enabled` | `POST /api/devices/{id}/enabled` | `devices.write` |
| `import_device_tags` | `POST /api/devices/{id}/import` | `tags.write` |
| `save_tag` | `POST /api/tags` | `tags.write` |
| `delete_tag` | `DELETE /api/tags/{device}/{name}` | `tags.write` |
| `set_device_labels` | `PUT /api/devices/{id}/labels` | `equipment.write` |
| `set_device_network` | `PUT /api/devices/{id}/network` | `devices.write` |
| `clear_device_network` | `DELETE /api/devices/{id}/network` | `devices.write` |

**Erkennung und Broker**

| Tool | Route | Berechtigung |
|---|---|---|
| `accept_discovered_device` | `POST /api/discovery/{source}/{key}/accept` | `devices.write` |
| `ignore_discovered_device` | `POST /api/discovery/{source}/{key}/ignore` | `devices.write` |
| `unignore_discovered_device` | `POST /api/discovery/{source}/{key}/unignore` | `devices.write` |
| `apply_discovery_review` | `POST /api/discovery/{source}/{key}/review/apply` | `devices.write` |
| `reject_discovery_review` | `POST /api/discovery/{source}/{key}/review/reject` | `devices.write` |
| `accept_network_find` | `POST /api/network-discovery/{key}/accept` | `devices.write` |
| `ignore_network_find` | `POST /api/network-discovery/{key}/ignore` | `devices.write` |
| `unignore_network_find` | `POST /api/network-discovery/{key}/unignore` | `devices.write` |
| `probe_network` | `POST /api/network-discovery/probe` | `devices.write` |
| `create_mqtt_broker` | `POST /api/mqtt/brokers` | `devices.write` |
| `update_mqtt_broker` | `PUT /api/mqtt/brokers/{id}` | `devices.write` |
| `delete_mqtt_broker` | `DELETE /api/mqtt/brokers/{id}` | `devices.write` |
| `probe_integration` | `POST /api/integrations/{id}/probe` | `devices.write` |
| `setup_integration` | `POST /api/integrations/{id}/setup` | `devices.write` |

**UniFi**

| Tool | Route | Berechtigung |
|---|---|---|
| `mark_unifi_network_ot` | `PUT /api/unifi/{id}/networks/{network}` | `devices.write` |
| `accept_unifi_known_device` | `PUT /api/unifi/{id}/networks/{network}/known/{mac}` | `devices.write` |
| `forget_unifi_known_device` | `DELETE /api/unifi/{id}/networks/{network}/known/{mac}` | `devices.write` |
| `accept_all_unifi_known_devices` | `POST /api/unifi/{id}/networks/{network}/accept-all` | `devices.write` |
| `create_unifi_starter_alarms` | `POST /api/unifi/{id}/starter-alarms` | `alarms.write` |

**Entitäten, Helfer, Ausrüstung, Labels**

| Tool | Route | Berechtigung |
|---|---|---|
| `create_entity` | `POST /api/entities` | `entities.write` |
| `update_entity` | `PUT /api/entities/{entity_id}` | `entities.write` |
| `delete_entity` | `DELETE /api/entities/{entity_id}` | `entities.write` |
| `create_energy_meter` | `POST /api/energy/meters` | `energy.write` |
| `update_energy_meter` | `PUT /api/energy/meters/{id}` | `energy.write` |
| `delete_energy_meter` | `DELETE /api/energy/meters/{id}` | `energy.write` |
| `create_helper` | `POST /api/helpers` | `entities.write` |
| `update_helper` | `PUT /api/helpers/{entity_id}` | `entities.write` |
| `delete_helper` | `DELETE /api/helpers/{entity_id}` | `entities.write` |
| `create_equipment` | `POST /api/equipment` | `equipment.write` |
| `update_equipment` | `PUT /api/equipment/{id}` | `equipment.write` |
| `delete_equipment` | `DELETE /api/equipment/{id}` | `equipment.write` |
| `create_label` | `POST /api/labels` | `equipment.write` |
| `update_label` | `PUT /api/labels/{label_id}` | `equipment.write` |
| `delete_label` | `DELETE /api/labels/{label_id}` | `equipment.write` |

**Alarme**

| Tool | Route | Berechtigung |
|---|---|---|
| `save_alarm` | `POST /api/alarms` | `alarms.write` |
| `delete_alarm` | `DELETE /api/alarms/{id}` | `alarms.write` |
| `shelve_alarm` | `POST /api/alarms/{id}/shelve` | `alarms.ack` |
| `unshelve_alarm` | `POST /api/alarms/{id}/unshelve` | `alarms.ack` |

**Automatisierungen und Blueprints**

| Tool | Route | Berechtigung |
|---|---|---|
| `save_automation` | `POST /api/automations` | `automations.write` |
| `delete_automation` | `DELETE /api/automations/{id}` | `automations.write` |
| `set_automation_enabled` | `POST /api/automations/{id}/enabled` | `automations.write` |
| `upgrade_blueprint_automation` | `POST /api/automations/{id}/blueprint-upgrade` | `blueprints.apply` |
| `instantiate_blueprint` | `POST /api/blueprints/{id}/instantiate` | `blueprints.apply` |
| `create_blueprint` | `POST /api/blueprints` | `blueprints.write` |
| `update_blueprint` | `PUT /api/blueprints/{id}` | `blueprints.write` |
| `delete_blueprint` | `DELETE /api/blueprints/{id}` | `blueprints.write` |

**Skripte und Rezepte**

| Tool | Route | Berechtigung |
|---|---|---|
| `create_script` | `POST /api/scripts` | `scripts.write` |
| `update_script` | `PUT /api/scripts/{id}` | `scripts.write` |
| `delete_script` | `DELETE /api/scripts/{id}` | `scripts.write` |
| `stop_script` | `POST /api/scripts/{id}/stop` | `scripts.run` |
| `create_recipe` | `POST /api/recipes` | `recipes.write` |
| `capture_recipe` | `POST /api/recipes/capture` | `recipes.write` |
| `update_recipe` | `PUT /api/recipes/{id}` | `recipes.write` |
| `delete_recipe` | `DELETE /api/recipes/{id}` | `recipes.write` |

**Dashboards und das Board**

| Tool | Route | Berechtigung |
|---|---|---|
| `create_dashboard` | `POST /api/dashboards` | `dashboards.write` |
| `update_dashboard` | `PUT /api/dashboards/{id}` | `dashboards.write` |
| `delete_dashboard` | `DELETE /api/dashboards/{id}` | `dashboards.write` |
| `save_board` | `PUT /api/board` | `board.write` |

**Importe**

| Tool | Route | Berechtigung |
|---|---|---|
| `import_codesys_alarms` | `POST /api/alarms/import/codesys` | `alarms.write` |
| `screen_import` | `POST /api/dashboards/import` | `dashboards.write` |

`import_codesys_alarms` nimmt die Datei, die Export Alarms der CODESYS-IDE geschrieben hat, als `contentBase64` (die Bytes, wie sie auf der Platte sind, die die IDE als UTF-16 schreibt) oder als `content` (den Text, wenn Sie ihn als Text haben), mit der `deviceId`, zu der die Alarme gehören, und, wenn Sie sie wollen, `application` und `defaultPriority`. Allein gelassen zeigt es nur eine Vorschau: es sagt, welche Alarme übernommen würden und welche nicht, speichert nichts und braucht keine Begründung. Mit `apply` true speichert es sie als Alarmdefinitionen, und dann braucht es eine Begründung und den MCP-Schreibschalter wie jedes Tool, das die Konfiguration ändert.

`screen_export` antwortet ein Dashboard als HotLoop-Bildschirmdatei ([Bildschirmdateien](/de/iot/screen-file/)), und `screen_import` nimmt eine entgegen, auf dieser Installation oder einer anderen. Es fragt zuerst: `dryRun` ist true, außer Sie sagen false, und ein Probelauf speichert nichts und antwortet mit dem Bericht mit jedem aufgeführten Problem und den Verweisen für `remap`. Ein echter Import braucht `dryRun` false, eine Begründung und den MCP-Schreibschalter, und eine ID, die existiert, wird abgelehnt, außer `replace` ist true. Der Bildschirm sind Daten des Kunden, die Datei ist also der Weg, wie er zwischen Installationen wandert, nie Code.

### Lesevorgänge und Probeläufe

Ein Agent, der ein Dashboard, einen Broker oder einen Knoten des Ausrüstungsbaums ändern kann, muss zuerst lesen können, was da ist, also hat jedes Objekt, das ein obiges Tool ändert, hier einen Lesevorgang, und die Probeläufe der Editoren sind ebenfalls Tools. Jedes ist eine Route, die durch ihren eigenen Handler läuft, mit der Leseberechtigung, die diese Route verlangt. Ein Lesevorgang antwortet ohne Begründung und ohne den Schreibschalter, und ein Aufrufer, den die Schreibrolle ausschließt, kann sie trotzdem machen, weil sie eine Leseberechtigung tragen und nichts weiter. Die drei Probeläufe (`validate_automation`, `validate_script` und `browse_device`) ändern nichts; die zwei, die einen Body prüfen, tragen die Schreibberechtigung, die ihre Route verlangt, bleiben also hinter der Schreibrolle.

| Tool | Route | Berechtigung |
|---|---|---|
| `list_alarm_definitions` | `GET /api/alarms` | `alarms.read` |
| `list_composite_entities` | `GET /api/entities/composites` | `entities.read` |
| `list_energy_meters` | `GET /api/energy/meters` | `energy.read` |
| `get_energy_meter` | `GET /api/energy/meters/{id}` | `energy.read` |
| `get_energy_summary` | `GET /api/energy/summary/{period}` | `energy.read` |
| `get_energy_series` | `GET /api/energy/series/{meter}/{period}/{step}` | `energy.read` |
| `list_alarm_events` | `GET /api/alarms/events` | `alarms.read` |
| `screen_export` | `GET /api/dashboards/{id}/export` | `dashboards.read` |
| `list_dashboards` | `GET /api/dashboards` | `dashboards.read` |
| `get_dashboard` | `GET /api/dashboards/{id}` | `dashboards.read` |
| `get_board` | `GET /api/board` | `values.read` |
| `list_equipment` | `GET /api/equipment` | `equipment.read` |
| `get_equipment` | `GET /api/equipment/{id}` | `equipment.read` |
| `list_labels` | `GET /api/labels` | `equipment.read` |
| `get_label` | `GET /api/labels/{label_id}` | `equipment.read` |
| `list_discovered_devices` | `GET /api/discovery` | `devices.read` |
| `get_discovered_device` | `GET /api/discovery/{source}/{key}` | `devices.read` |
| `list_network_finds` | `GET /api/network-discovery` | `devices.read` |
| `get_network_find` | `GET /api/network-discovery/{key}` | `devices.read` |
| `list_integrations` | `GET /api/integrations` | `devices.read` |
| `list_mqtt_brokers` | `GET /api/mqtt/brokers` | `devices.read` |
| `get_blueprint` | `GET /api/blueprints/{id}` | `blueprints.read` |
| `get_script` | `GET /api/scripts/{id}` | `scripts.read` |
| `list_automation_runs` | `GET /api/runs` | `automations.read` |
| `list_script_runs` | `GET /api/scripts/{id}/runs` | `scripts.read` |
| `list_unifi_consoles` | `GET /api/unifi/consoles` | `devices.read` |
| `list_unifi_networks` | `GET /api/unifi/{id}/networks` | `devices.read` |
| `list_unifi_known_devices` | `GET /api/unifi/{id}/known` | `devices.read` |
| `get_device_network` | `GET /api/devices/{id}/network` | `devices.read` |
| `get_diagnostics` | `GET /api/diagnostics` | `status.read` |
| `browse_device` | `POST /api/devices/{id}/browse` | `devices.read` |
| `validate_automation` | `POST /api/automations/validate` | `automations.write` |
| `validate_script` | `POST /api/scripts/validate` | `scripts.write` |

### Administration

Benutzerkonten, Einstellungen, Backups, die Eskalationsrichtlinie, die Historian-Ziele, die Broker-Zugänge, die Flotte der Edge Relays und geplante Berichte sind Sache des Administrators, und sie sind ebenfalls Tools: zweiundvierzig, im selben Muster wie der Rest. Jedes ist eine Route, die durch ihren eigenen Handler läuft, mit der Berechtigung, die diese Route verlangt (`users.manage`, `settings.write`, `backup.run`, `fleet.restart`...), einer Begründung für jede Änderung und dem Agenten in der Audit-Zeile. Eine Route, die ablehnt, lehnt einen Agenten mit denselben Worten ab. Die Lesevorgänge (die Tools `list_` und `get_`) brauchen keine Begründung und keinen Schreibschalter und brauchen weiterhin die Schreibrolle des Aufrufers, wenn eine gesetzt ist, weil die Berechtigung, die sie tragen, die eines Administrators ist. Die Flotten- und Berichts-Tools gibt es nur in einem Produkt, das die Funktion hat.

Zwei Dinge gehören den Routen und sind gut zu wissen, bevor man sich auf ein Tool verlässt:

- **Die Schreibschalter haben keine Route.** `safety.allowWrites` und `safety.allowMcpWrites` gehören dem Deployment (`HOTLOOP_ALLOW_WRITES`, `HOTLOOP_ALLOW_MCP_WRITES`), und `PUT /api/settings` lehnt sie als vom Deployment gesetzt ab. Also ändert `save_settings`, was der Einstellungsbildschirm ändern kann, und antwortet diese Ablehnung für die Schalter, in diesen Worten. Ein Agent kann den Schalter, auf den seine eigenen Schreibvorgänge warten, nicht einschalten.
- **Das Passwort eines Benutzers geht durch den Aufruf.** `create_user`, `reset_user_password` und die PIN-Tools nehmen ein Geheimnis in ihren Argumenten, wie die API. Die Audit-Zeile nennt die Änderung und die Begründung und nie das Geheimnis.

**Benutzerkonten**

| Tool | Route | Berechtigung |
|---|---|---|
| `list_users` | `GET /api/users` | `users.manage` |
| `create_user` | `POST /api/users` | `users.manage` |
| `update_user` | `PUT /api/users/{username}` | `users.manage` |
| `delete_user` | `DELETE /api/users/{username}` | `users.manage` |
| `reset_user_password` | `POST /api/users/{username}/password` | `users.manage` |
| `unlock_user` | `DELETE /api/users/{username}/lockout` | `users.manage` |
| `set_user_pin` | `PUT /api/users/{username}/pin` | `users.manage` |
| `clear_user_pin` | `DELETE /api/users/{username}/pin` | `users.manage` |
| `list_opcua_certificates` | `GET /api/opcua/certificates` | `users.manage` |
| `list_user_certificates` | `GET /api/users/{username}/certificates` | `users.manage` |
| `add_user_certificate` | `POST /api/users/{username}/certificates` | `users.manage` |
| `revoke_user_certificate` | `POST /api/users/{username}/certificates/{thumbprint}/revoke` | `users.manage` |
| `delete_user_certificate` | `DELETE /api/users/{username}/certificates/{thumbprint}` | `users.manage` |

**Einstellungen, Backups, Benachrichtigungen**

| Tool | Route | Berechtigung |
|---|---|---|
| `get_settings` | `GET /api/settings` | `settings.read` |
| `save_settings` | `PUT /api/settings` | `settings.write` |
| `list_backups` | `GET /api/backup` | `backup.read` |
| `run_backup` | `POST /api/backup` | `backup.run` |
| `get_escalation` | `GET /api/notify/escalation` | `notify.escalation` |
| `save_escalation` | `PUT /api/notify/escalation` | `notify.escalation` |
| `send_test_notification` | `POST /api/notify/test` | `notify.test` |

**Historian-Ziele und Broker-Zugänge**

| Tool | Route | Berechtigung |
|---|---|---|
| `list_historian_targets` | `GET /api/historian/targets` | `settings.read` |
| `create_historian_target` | `POST /api/historian/targets` | `settings.write` |
| `update_historian_target` | `PUT /api/historian/targets/{id}` | `settings.write` |
| `delete_historian_target` | `DELETE /api/historian/targets/{id}` | `settings.write` |
| `list_broker_logins` | `GET /api/broker/logins` | `users.manage` |
| `create_broker_login` | `POST /api/broker/logins` | `users.manage` |
| `update_broker_login` | `PUT /api/broker/logins/{name}` | `users.manage` |
| `delete_broker_login` | `DELETE /api/broker/logins/{name}` | `users.manage` |

**Die Flotte der Edge Relays (Gateway)**

| Tool | Route | Berechtigung |
|---|---|---|
| `list_fleet` | `GET /api/fleet` | `fleet.read` |
| `register_relay` | `POST /api/fleet` | `fleet.write` |
| `delete_relay` | `DELETE /api/fleet/{id}` | `fleet.write` |
| `rebirth_relay` | `POST /api/fleet/{id}/rebirth` | `fleet.rebirth` |
| `restart_relay` | `POST /api/fleet/{id}/restart` | `fleet.restart` |
| `update_relay` | `POST /api/fleet/{id}/update` | `fleet.update` |
| `set_relay_config` | `POST /api/fleet/{id}/config` | `fleet.config` |
| `clear_relay_config` | `DELETE /api/fleet/{id}/config` | `fleet.config` |

**Geplante Berichte (Gateway)**

| Tool | Route | Berechtigung |
|---|---|---|
| `list_reports` | `GET /api/reports` | `reports.read` |
| `get_report` | `GET /api/reports/{id}` | `reports.read` |
| `create_report` | `POST /api/reports` | `reports.write` |
| `update_report` | `PUT /api/reports/{id}` | `reports.write` |
| `delete_report` | `DELETE /api/reports/{id}` | `reports.write` |
| `run_report` | `POST /api/reports/{id}/run` | `reports.run` |

## Ressourcen

| URI | Inhalt |
|---|---|
| `iiot://devices` | der Geräteträger mit Tags, als JSON |
| `iiot://tags` | der Tag-Katalog mit aktuellen Werten |
| `iiot://alarms` | Alarmdefinitionen, Live-Zustand und eine Zustandsreferenz |
| `iiot://protocols` | unterstützte Protokolle, aus den einkompilierten Treibern |

Ressourcen gibt es, damit ein Client den ganzen Namensraum in einem Lesevorgang holen kann, statt ihn einen Tool-Aufruf nach dem anderen zu entdecken.

## Was die Tools nicht tun werden

Die Tools sind so geschrieben, dass ein Modell Unsicherheit nicht versehentlich abrunden kann.

**Ein Tag ohne Messwert ist kein Tag, das null liest.** `read_tag` sagt `no reading has been taken for this tag yet`, oder `this tag is not configured`, wenn es nicht existiert. Keines gibt einen Wert zurück.

**Schlechte Qualität wird benannt, nicht unterstellt.** Messwerte kommen zurück als `[quality: bad (the value is NOT known; do not treat it as a measurement)]`. Die Server-Anweisungen wiederholen es. Mitteln Sie nicht über schlechte Messwerte und melden Sie keinen als Messung.

**`describe_protocol` kann nicht lügen.** Die Verfügbarkeit kommt aus den in die Binärdatei einkompilierten Treibern, das Tool kann also kein Protokoll behaupten, das das Gateway nicht hat.

**Eine Ablehnung ist eine Antwort, kein Transportfehler.** Ein abgelehnter Schreibvorgang kommt als Tool-Ergebnis mit `isError` zurück, was bedeutet, der Aufruf war wohlgeformt und wurde absichtlich abgelehnt. Es ist kein Protokollfehler, der wiederholt werden sollte.

## Schreiben

MCP liest und schreibt: es befiehlt Ausrüstung, und es ändert die Konfiguration ([oben](#konfiguration-ändern)). `write_tag` bewegt echte Ausrüstung, also steht zwischen einem Tool-Aufruf und einer Maschine dasselbe wie zwischen dem Klick eines Bedieners und einer Maschine:

1. `HOTLOOP_ALLOW_WRITES`, der Hauptschalter für das ganze Deployment, muss an sein. Bei ausgeschaltetem Schalter schreibt nichts: nicht die Oberfläche, nicht die API, nicht ein Agent.
2. Das Tag muss als schreibbar markiert sein. Tags sind schreibgeschützt, bis jemand etwas anderes sagt, einzeln.
3. Der Wert muss im konfigurierten Bereich des Tags liegen. Er wird **abgelehnt, nicht begrenzt**: 400 zu senden, wenn jemand 500 verlangt hat, heißt stillschweigend etwas anderes zu tun, als verlangt wurde.

Eine **Begründung ist erforderlich** und wird neben dem Schreibvorgang festgehalten. Eine Audit-Zeile, die sechs Monate später niemand deuten kann, ist kaum besser als keine.

`call_service` bekommt genau dieselben drei, weil es nichts als Schreibvorgänge durch dasselbe Gate ist, und dazu die eigenen Prüfungen der Entität (Schrittweite und engerer Bereich einer Zahl, Muster eines Textes, Entität nicht deaktiviert). Eine Ablehnung bei einer davon wird gegen die Entität ebenso wie gegen das Tag protokolliert: Quelle `mcp`, der Client mit Namen, die entity_id, der Service und die Aufruf-ID, dieselbe Zeile, die ein abgelehntes `write_tag` hinterlässt, plus die Entität. Ein Aufruf ohne Begründung wird abgelehnt, bevor etwas versucht wird, wie `write_tag`.

`trigger_automation` ist identisch abgesichert, weil die Aktionen einer Regel Ausrüstung befehlen können; sonst wäre es ein Weg um die Prüfungen herum, denen `write_tag` begegnet.

```
> write_tag tag=press-01/Zone1_Temp value=99 reason="testing"
write refused: press-01/Zone1_Temp: this tag is not marked writable
```

Wenn Schreiben abgeschaltet ist, sagen es die Server-Anweisungen gleich zu Beginn, damit ein Agent keinen Zug damit verschwendet, es herauszufinden.

## Nach außen aufrufen

Die `mcp_call`-Aktion einer Automatisierung ruft ein Tool auf einem anderen MCP-Server auf. Konfigurieren Sie die Server im Chart:

```yaml
mcp:
  outboundServers:
    - name: maintenance
      url: http://maintenance-mcp.default.svc.cluster.local:8080/mcp
      existingSecret: maintenance-mcp-token
      secretKey: token
```

Sitzungen werden gepoolt und wiederverwendet; bei jedem Aufruf neu zu verbinden würde bei jedem Auslösen einer Regel einen Handshake, ein initialize und eine Tool-Auflistung bedeuten. Eine Sitzung, die gestorben ist, wird beim nächsten Aufruf wieder verbunden statt per Timer, weil der nächste Aufruf der erste Moment ist, in dem es jemanden interessiert. Ein konfigurierter Server, der ausfällt, hindert die Überwachung der Anlage nicht, es wird nichts angewählt, bis eine Regel es braucht.

Der MCP-Bildschirm zeigt jeden konfigurierten Server, ob er verbunden ist, und die Tools, die er anbietet.

## Standorte föderieren

Ein Gateway je Anlage ist, wie das gedacht ist. Jeder Standort behält seine eigene Datenbank, sein eigenes Board und seinen eigenen Namen, und keiner hängt davon ab, dass eine Verbindung irgendwohin bestehen bleibt, eine Anlage hört nicht auf, überwacht zu werden, weil das WAN ausfiel.

Alle auf einmal zu sehen, nutzt das Protokoll, das die Standorte schon sprechen. Konfigurieren Sie ein Gateway in der Cloud mit den Standorten als ausgehenden MCP-Servern, genau wie für die `mcp_call`-Aktion:

```
HOTLOOP_MCP_SERVER_1_NAME=akron
HOTLOOP_MCP_SERVER_1_URL=https://akron.example/mcp
HOTLOOP_MCP_SERVER_1_TOKEN=…
HOTLOOP_MCP_SERVER_2_NAME=ashtabula
HOTLOOP_MCP_SERVER_2_URL=https://ashtabula.example/mcp
HOTLOOP_MCP_SERVER_2_TOKEN=…
```

Der Standorte-Bildschirm ruft dann `get_plant_status` an jedem parallel auf und fasst die Antworten zusammen. Es gibt nichts an einem Standort bereitzustellen, damit er erscheint, kein Standort muss wissen, dass er föderiert ist, und nichts verbindet sich nach innen in ein Anlagennetz.

Zwei Verhaltensweisen sind Absicht, und man kann sich darauf verlassen:

- Ein Standort, der nicht antwortet, wird als **nicht erreichbar, mit dem Grund** gezeigt und aus der Zusammenfassung herausgelassen. Eine Anlage, die man nicht erreicht, als null Alarme zu zählen, wäre das Schlimmste, was ein Bildschirm wie dieser tun könnte.
- Die Zahlen, die ein Standort zuletzt gemeldet hat, werden nie gezeigt. Sie sehen aktuell aus und sind es nicht.

Jeder Standort bekommt seine eigene kurze Frist, sodass eine Anlage an einer toten Leitung die laufenden nicht aufhalten kann.

## Was man einem Agenten sagen sollte

Die eigenen Anweisungen des Servers decken das ab, aber für jeden, der einen Prompt darum herum schreibt:

- Alarmzustände folgen ISA-18.2. `rtn-unack` bedeutet einen Alarm, der von selbst zurückgegangen ist, bevor ihn jemand sah, er ist weiterhin meldenswert, und es ist der Zustand, der beweist, dass Quittierung und Rückkehr in den Normalzustand unabhängig sind.
- `query_history` mit Intervallen, nicht roh, für alles, was länger als ein paar Minuten ist. Ein Tag Sekundendaten sind 86.400 Punkte je Tag. Intervalle folgen der Qualitätsregel: schlechte und unsichere Messwerte werden in `badReadings` gezählt, nie eingemittelt, und ein Intervall ohne etwas Gutes hat einen Nullmittelwert.
- `recent_events` ist der Weg, einen Vorfall zu rekonstruieren: Geräteverbindungen, Schreibvorgänge, Alarmübergänge, Automatisierungsläufe und Konfigurationsänderungen, der Reihe nach, jeweils mit dem Akteur, der sie verursacht hat.
