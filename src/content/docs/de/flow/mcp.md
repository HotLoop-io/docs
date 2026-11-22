---
title: "MCP in beide Richtungen"
description: "Ein Agent kann einen Flow als Werkzeug aufrufen, und ein Flow kann ein Werkzeug auf jedem MCP-Server aufrufen, mit drei Knoten und einem Konfigurationsknoten."
---

Ein Agent, der das Model Context Protocol spricht, kann einen Flow als Werkzeug aufrufen, und ein Flow kann ein Werkzeug auf jedem MCP-Server aufrufen, auch auf dem von HotLoop. Das erledigen drei Knoten und ein Konfigurationsknoten: `mcp tool` und `mcp result` stellen einen Flow bereit, `mcp client` ruft über eine `hotloop-flow-mcp-server`-Verbindung nach außen auf. Wenn Sie nur Sensoren mit Dashboards verbinden, können Sie das alles überspringen: Ein Flow, der keinen dieser Knoten nutzt, macht nie einen MCP-Aufruf, und die einzigen Werkzeuge, die Flow selbst bereitstellt, sind die, die seine Flows lesen und ändern ([weiter unten](#die-eigenen-werkzeuge-von-flow)).

Das Protokoll stammt aus dem Go-SDK (`github.com/modelcontextprotocol/go-sdk` v1.8.0, permissiv lizenziert, einige Dateien stehen noch unter MIT, während das Projekt die Umlizenzierung abschließt, gepflegt vom MCP-Projekt). Es spricht die aktuelle Fassung der Spezifikation, 2026-07-28, die keinen Handshake hat und die Version in jeder Anfrage mitträgt, sowie die Handshake-Fassungen bis 2025-11-25, am selben Endpunkt. Ein Client bekommt die, mit der er die Verbindung öffnet, also ist nichts zu konfigurieren.

## Flows als Werkzeuge

Ein `mcp tool`-Knoten deklariert ein Werkzeug: einen Namen, eine Beschreibung für das Modell, das sie liest, und ein Eingabeschema. Solange der Flow bereitgestellt ist, stellt Flow es unter `/mcp` bereit (unterhalb des Admin-Stamms, falls Sie ihn verschoben haben). Ein Aufruf wird zu einer Nachricht, die aus dem Knoten kommt: `msg.payload` sind die Argumente des Aufrufs, `msg.topic` ist der Werkzeugname, und `msg.mcp` enthält `tool`, `caller` und `callId`. Ein `mcp result`-Knoten weiter hinten schickt die Antwort zurück, so wie `http response` `http in` beantwortet. Alles dazwischen ist ein Flow wie jeder andere.

```json
[
  {"id": "t1", "type": "tab", "label": "Line"},
  {"id": "tool", "type": "mcp tool", "z": "t1", "toolName": "line_status",
   "description": "Status of a production line: its state and speed.",
   "schema": "{\"type\":\"object\",\"properties\":{\"line\":{\"type\":\"string\",\"enum\":[\"L1\",\"L2\",\"L3\"]}},\"required\":[\"line\"],\"additionalProperties\":false}",
   "x": 100, "y": 100, "wires": [["status"]]},
  {"id": "status", "type": "function", "z": "t1", "name": "status", "outputs": 1,
   "func": "msg.payload = {line: msg.payload.line, state: 'running', askedBy: msg.mcp.caller};\nreturn msg;",
   "x": 300, "y": 100, "wires": [["answer"]]},
  {"id": "answer", "type": "mcp result", "z": "t1", "x": 500, "y": 100, "wires": []}
]
```

**Das Schema wird geprüft, bevor der Flow läuft.** Es ist JSON Schema, gelesen so, wie der `json`-Knoten eines liest (Entwurf 2020-12, sofern das Schema keinen anderen nennt, und ein `$ref` auf eine andere URL ist ein Fehler). Ein ungültiges Schema, eine Wurzel, die kein Objekt ist, ein Werkzeugname, den MCP nicht erlaubt, oder zwei Knoten, die denselben Namen bereitstellen, lassen die Bereitstellung dieses Knotens scheitern, mit Begründung. Ein Aufruf, dessen Argumente nicht passen, wird mit einem Werkzeugfehler beantwortet, der das falsche Feld nennt, `arguments.line: value must be one of "L1", "L2", "L3"`, damit das Modell es korrigieren und erneut versuchen kann, und der Flow bekommt ihn nie zu sehen. Eine Objekt-Payload geht als Objekt und als ihr JSON-Text zurück, Text geht als Text zurück, und ein `mcp result`, das von einem Catch-Knoten gespeist wird oder bei dem "The work failed" angehakt ist, antwortet mit einem Werkzeugfehler in den eigenen Worten des Fehlers. Ein Aufruf, den niemand beantwortet, erfährt das nach Ablauf des Antwort-Timeouts, 30 Sekunden, wenn Sie nichts anderes einstellen, und der Fehler geht an einen Catch-Knoten. Eine erneute Bereitstellung wartet auf laufende Aufrufe.

**Ein Agent ist ein Aufrufer wie jeder andere.** `/mcp` nimmt dieselben Token an wie die Admin-API, ein Sitzungs-Token oder ein API-Token, und sonst nichts. Anonyme Aufrufe gibt es nicht: Kein Token ist ein 401, ein Token, das Flow nicht kennt, ist ein 401, und ein Token ohne die Berechtigung `mcp.call` ist ein 403, noch bevor das Protokoll die Anfrage sieht. Eine Instanz, die mit `HOTLOOP_FLOW_INSECURE` läuft, antwortet auf jede `/mcp`-Anfrage mit 403, weil ein Werkzeugaufruf einen Aufrufer braucht, den man ins Audit-Protokoll schreiben kann. Das Token eines Agenten ist ein Token wie jedes andere:

```yaml
auth:
  tokens:
    - name: agent
      hash: sha256:...          # from: hotloop-flow token -name agent
      permissions: ["mcp.call"]
      rateLimit: {calls: 60, per: 1m}   # optional; no rateLimit, no limit
```

Der Aufruf läuft mit den Rechten dieser Identität. Jeder Aufrufer braucht `mcp.call` (oder `mcp.*` oder `*`). Tragen Sie eine weitere Berechtigung in das Feld "Extra permission" eines Werkzeugs ein, etwa `mcp.line3`, braucht der Aufrufer auch diese, und ohne sie sieht er das Werkzeug nicht einmal in der Liste. Zwei Agenten können sich einen Flow teilen und unterschiedliche Werkzeuge sehen.

**Ein Token kann auf eine Zahl von Aufrufen begrenzt werden.** `rateLimit` an einem API-Token in `auth.tokens` ist `calls` in einem Zeitfenster, `per`, eine Minute, wenn Sie es weglassen. Das Fenster beginnt mit dem ersten Aufruf des Tokens, ein Aufruf über der Zahl wird abgelehnt, bis das Fenster endet, und dann beginnt die Zählung von vorn. Ein abgelehnter Aufruf erreicht den Flow nie und wird mit einem Werkzeugfehler beantwortet, der sagt, wie viele Sekunden zu warten sind, sodass ein Agent in einer Schleife in Worten, die er liest, gebeten wird, langsamer zu machen. Die Spezifikation nennt dafür keinen Fehler, also ist es der Werkzeugfehler, den sie ohnehin für einen Aufruf definiert, der nicht ausgeführt werden kann. Ein Token ohne `rateLimit` wird nie gedrosselt, und ein Sitzungs-Token wird auch nicht begrenzt, weil es einer Person gehört. Jedes Token zählt für sich, und die Zählung liegt im Speicher, ein Neustart beginnt sie also von vorn. Eine Ablehnung ist eine `mcp.refused`-Zeile mit dem Grund `rate limit exceeded`, sodass auch eine Flut von Aufrufen im Audit-Protokoll steht.

**Jeder Aufruf steht im Audit-Protokoll, unter dem Namen des Aufrufers.** `mcp.call` wird geschrieben, bevor der Flow läuft, mit dem Werkzeug, dem Knoten und einer Aufruf-ID, und `mcp.result` danach, mit dem Ergebnis und den Millisekunden. `mcp.refused` ist ein falsches Token, eines ohne die Berechtigung, ein Werkzeug, das es nicht aufrufen darf, oder Argumente, die nicht passten. Die Argumente selbst werden nie geschrieben. Eine Anfrage ganz ohne Token wird ebenfalls nicht geschrieben, weil am anderen Ende niemand ist, den man benennen könnte. `GET /audit?event=mcp.` liest das alles, und `?user=token:agent` grenzt es auf einen Agenten ein.

Probieren Sie es mit dem Inspector des MCP-Projekts selbst, der nichts von Flow braucht:

```bash
npx @modelcontextprotocol/inspector@2.12.0 --cli http://localhost:1880/mcp \
  --transport http --header "Authorization: Bearer $TOKEN" \
  --method tools/call --tool-name line_status --tool-arg line=L3
```

Ein Flow-Test legt die Nachricht, die ein Aufruf erzeugt hätte, dorthin, wo der `mcp tool`-Knoten sitzt, und `mcp result` übergibt dem Test, was er geantwortet hätte, als `{isError, text, structuredContent}`, sodass der Flow ohne Server getestet wird.

## Die eigenen Werkzeuge von Flow

Ein Agent, der nur aufrufen könnte, was ein Flow-Autor verdrahtet hat, könnte die Flows weder sehen noch ändern, deshalb stellt Flow 45 eigene Werkzeuge am selben `/mcp` bereit, neben denen der Flows. Sie lesen und sie schreiben. Sieben betreffen die Flows, in der Tabelle unten, und der Rest sind die übrigen Routen der Admin-API: die Einstellungen, die Palette, das Audit-Protokoll, Details und Unterschiede der Bereitstellungen, der Export, die Flow-Tests, die Nachrichten-Traces, die Zahlen der Laufzeit, das Zurücksetzen des zweiten Faktors sowie die Diagramme und Instrumente: ein Diagramm auflisten und lesen, es starten und stoppen, seinen Debugger steuern, ein Bedienelement auf seinem Panel setzen und die Schreibzugriffe eines Instruments umschalten. Die MCP-Seite führt jedes Werkzeug mit Route und Berechtigung auf und die wenigen Routen, die keine Werkzeuge sind, samt Begründung.

| Werkzeug | Zweck | Berechtigung |
|---|---|---|
| `list_flows` | jeder Tab und Subflow: ID, Bezeichnung, deaktiviert, Knotenzahl und die Revision | `flows.read` |
| `get_flows` | die ganze bereitgestellte Menge, wie der Editor sie liest, mit der Revision | `flows.read` |
| `get_flow` | ein Tab oder Subflow mit seinen Knoten, nach ID | `flows.read` |
| `deploy_flows` | **deploy**: ersetzt die ganze Menge, mit der Revision, die Sie gelesen haben, und einer Notiz | `flows.write` |
| `list_deployments` | der Bereitstellungsverlauf, neueste zuerst | `flows.read` |
| `rollback_deployment` | **roll back** auf eine frühere Bereitstellung, als neue Bereitstellung | `flows.write` |
| `inject_node` | **press** eines inject-Knotens, mit einer eigenen Nachricht | `inject.write` |

Keines davon ist eine zweite Implementierung. Jedes führt den Handler der Admin-API für dieselbe Aufgabe aus, als der Aufrufer, den der Endpunkt authentifiziert hat, sodass eine Bereitstellung auf alles trifft, worauf eine Bereitstellung aus dem Editor trifft: Das Dokument muss sich parsen lassen, die Revision muss die aktuelle sein (eine leere überschreibt absichtlich), Verbindungen, die sich uneinig sind, was auf ihnen läuft, werden abgelehnt, nicht erlaubte Plugins werden abgelehnt, und fehlschlagende Flow-Tests lassen die Bereitstellung scheitern, jeweils in den Worten der Route. Der Bereitstellungsverlauf hält Aufrufer und Notiz fest, und das Audit-Protokoll enthält die Zeile `deploy` oder `inject` unter dem Namen des Aufrufers, zusätzlich zu den Zeilen `mcp.call` und `mcp.result`, die jeder Werkzeugaufruf hinterlässt. Ein Aufrufer braucht `mcp.call` und die eigene Berechtigung des Werkzeugs, und ein Werkzeug, das er nicht aufrufen darf, steht nicht in seiner Liste. Die Werkzeuge bleiben über eine Bereitstellung hinweg bestehen, die nur die Werkzeuge der Flows entfernt, und ein Flow kann keinen ihrer Namen bereitstellen.

`deploy_flows` ersetzt die ganze Menge, also liest ein Agent zuerst `get_flows` und sendet es geändert zurück, mit dem `rev`, den er bekommen hat.

## Werkzeuge auf anderen Servern aufrufen

Ein `mcp client`-Knoten ruft ein Werkzeug auf, wenn eine Nachricht eintrifft, über eine `hotloop-flow-mcp-server`-Verbindung: die MCP-Adresse des Servers, ein Bearer-Token, falls er eines verlangt, und ein Timeout. Das Werkzeug und seine Argumente sind typisierte Eingaben, also kann jedes von beiden aus der Nachricht kommen. `msg.payload` ist die strukturierte Antwort des Werkzeugs, wenn es eine hat, der Text, wenn alles, was es sagte, Text war, und der Inhalt, wie er kam, wenn es etwas anderes war, und `msg.mcp` enthält den Server, das Werkzeug und die ganze Antwort. Die andere Operation, "List the tools", legt jedes Werkzeug des Servers mit Beschreibung und Eingabeschema in `msg.payload`.

Ein Werkzeug, das einen Fehler meldet, löst einen aus, mit den Worten des Servers, sodass ein Catch-Knoten sieht, was das Modell gesehen hätte. **Ein Aufruf wird nie zweimal gesendet.** Ein Werkzeug kann Anlagen bewegen, und eine abgebrochene Verbindung sagt nicht, ob der Server es ausgeführt hat, also sagt der Fehler, dass die Verbindung fehlgeschlagen ist, und die nächste Nachricht verbindet sich neu. Das Token geht an die Adresse, die Sie angegeben haben, und nirgendwohin sonst, eine Weiterleitung wird nicht verfolgt, und ein Fehler wiederholt es nie. Die Verbindung vertraut den Zertifikatsstämmen des Systems und sonst nichts.

Für HotLoop ist es die Adresse seines `/mcp` und das `mcp-token` aus dem Release-Secret, und jedes Werkzeug aus der MCP-Dokumentation von HotLoop ist dabei:

```json
{"id": "plant", "type": "mcp client", "z": "t1", "server": "hotloop",
 "tool": "get_plant_status", "toolType": "str", "arguments": "{}", "argumentsType": "json",
 "x": 300, "y": 100, "wires": [["use"]]}
```

HotLoop sieht den Aufruf als den eines MCP-Clients, nach seinen eigenen Regeln: MCP liest und schreibt, durch dasselbe Tor wie alle anderen, also geht ein `write_tag` auf ein scharfgeschaltetes Tag im Bereich durch (sobald die Schreibzugriffe von HotLoop selbst eingeschaltet sind), und eines, das es ablehnt, etwa ein Tag, das niemand als beschreibbar markiert hat, kommt als Fehler des Knotens zurück, in den Worten von HotLoop. Um aus einem Flow ohne MCP durch das Tor von HotLoop zu schreiben, nutzen Sie die HotLoop-Knoten weiter oben.

## Wogegen es getestet wurde

**Der Server** wird mit dem eigenen Client des Go-SDK über echtes HTTP getestet, in beiden Epochen: auflisten, aufrufen, abgelehnte Argumente, eine abgelehnte Berechtigung, ein abgelehntes Token, die Audit-Zeilen, ein Werkzeug, das verschwindet, wenn sein Knoten stoppt, und der ganze Admin-Server davor, mit echten API- und Sitzungs-Token und dem Audit-Protokoll auf der Platte. Die Inspector-CLI 2.12.0 des MCP-Projekts hat die Werkzeuge eines laufenden Flow aufgelistet, aufgerufen und wurde ohne Token und mit einem erfundenen abgelehnt. Der `mcp client`-Knoten wurde gegen ein echtes HotLoop 4.18.10 (das veröffentlichte IoT-Image) ausgeführt: Er listete alle 27 Werkzeuge auf, rief `get_plant_status`, `list_devices` und `get_states` auf und nutzte die Antworten, wurde mit falschem und ohne Token abgelehnt, bekam den eigenen Fehler von HotLoop für ein Werkzeug, das nicht existiert, und für einen Schreibzugriff, den MCP nicht machen darf, und ein vom Inspector aufgerufenes Flow-Werkzeug führte einen Flow aus, der das MCP von HotLoop aufrief und mit dessen Antwort antwortete.

**Nicht erledigt:** OAuth (ein Bearer-Token ist der einzige Zugang, in beide Richtungen), stdio-Server, Ressourcen, Prompts, Sampling, Elicitation und Fortschrittsmeldungen sowie das Ausgabeschema eines Werkzeugs. HotLoop 4.18.10 spricht die Handshake-Fassungen, der Knoten trifft es also so an; gegen einen Server der aktuellen Fassung ist er nur mit dem von Flow selbst getestet. Ein Handshake-Server, der eine Sitzung vergisst (ein Neustart), lässt den ersten Aufruf danach einmal scheitern, und der nächste verbindet sich neu. Die Ratenbegrenzung gilt je API-Token und ist aus, bis Sie sie setzen, ein Token ohne `rateLimit` wird also nur von den Warteschlangen begrenzt, die schon eine Obergrenze haben, und von der Anfragegröße, 4 MiB.
