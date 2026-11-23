---
title: "Versionshinweise: HotLoop Flow 2.3.0"
description: "Was HotLoop Flow 2.3.0 bringt, was sich beim Update ändert und was Sie lesen sollten, bevor Sie eine laufende Anlage anfassen."
sidebar:
  label: "2.3.0"
---

HotLoop Flow 2.3.0 ist die Version, in der Flow den Rest der Anlage auf drei neuen Wegen erreicht und eine Nachricht mit falscher Form abfängt, bevor sie Schaden anrichtet. Es spricht mit HotLoop, ein Agent kann einen Flow über MCP als Tool aufrufen, und ein Plugin ist eine signierte WebAssembly-Datei und kein npm-Paket. JSON Schema prüft jetzt Nachrichten am `json`-Node, an den Ports eines Nodes und an den Verbindungen im Editor. Eine Änderung kann einen bereits laufenden Flow betreffen, und sie steht als Erstes unter Was sich geändert hat.

## Neu

**HotLoop-Nodes**
- Eine `hotloop-flow-hotloop`-Verbindung, das ist eine URL und ein Konto. Sie meldet sich mit `POST /api/auth/login` an, sendet das Bearer-Token, das HotLoop zurückgibt, und meldet sich erneut an, wenn HotLoop sagt, die Sitzung sei weg. Ein Operator-Konto reicht für alles Folgende.
- `hotloop in` folgt dem Live-Feed von HotLoop und sendet für jede Entität, die den Zustand ändert, eine Nachricht: `msg.topic` ist die Entitäts-ID, `msg.payload` der neue Zustand, und `msg.hotloop` trägt den vorherigen Zustand, ihre Attribute, ihre Qualität und ihre Zeitstempel. Bricht die Verbindung ab, wird das Badge rot, und ein einziger Fehler erreicht einen Catch-Node für den Ausfall, nicht einer pro Wiederholung. Kommt sie zurück, wird eine Entität gesendet, die sich inzwischen geändert hat, und eine unveränderte nicht.
- `hotloop state` liest eine Entität, wenn eine Nachricht eintrifft. `hotloop script` führt ein HotLoop-Skript mit den Feldern aus, die Sie angeben. `hotloop recipe` wendet ein Rezept mit seinen Parametern an, und eine ältere Version, wenn Sie bewusst eine verlangen. HotLoop prüft jedes Feld und jeden Parameter, schickt jeden Schreibvorgang durch sein Schreib-Gate und führt Protokoll. Flow sendet den Grund `flow:<node id>`, und HotLoop hält ihn in seinem Schreib-Audit und seinem Logbuch fest.
- Ein abgelehnter oder fehlgeschlagener Aufruf kommt mit HotLoops eigenen Worten und seinem Status bei einem Catch-Node an. Nichts, was geschrieben wurde, wird rückgängig gemacht, denn auch das ist HotLoops Regel.

**Schreibvorgänge über HotLoops Gate**
- `modbus write`, `opcua write`, `s7 write` und `ethernetip write` haben zwei neue Felder, **Über HotLoop schreiben** und **HotLoop-Tag** (`device/tag`). Ist ein HotLoop gewählt, geht der Wert an HotLoops Schreib-Gate, das in dieser Reihenfolge entscheidet: Schreiben eingeschaltet, Tag scharf, Wert im Bereich.
- Ein Schreibvorgang, den das Gate ablehnt, erreicht die Anlage nie. Ein HotLoop, der nicht erreichbar ist, lässt den Schreibvorgang ebenfalls fehlschlagen. Es fällt nie auf direktes Schreiben zurück, denn das wäre ein Schreibvorgang, den das Gate nie gesehen hat.
- Es gelten HotLoops eigene Adresse, Datentyp und Skalierung für das Tag, daher werden Adresse und Datentyp am Flow-Node nicht benutzt. Entfernt man den HotLoop, ist der Node genau wieder wie vorher. Das Gate nimmt pro Schreibvorgang einen Bool, eine Zahl oder einen Text, eine Liste von Registern wird also mit einer entsprechenden Meldung abgelehnt.

**MCP, in beide Richtungen**
- `mcp tool` und `mcp result` stellen einen Flow als Tool bereit. Der Tool-Node deklariert einen Namen, eine Beschreibung und ein Eingabeschema, Flow stellt ihn unter `/mcp` bereit, und der Result-Node schickt die Antwort des Flows zurück. Ein Agent meldet sich wie jeder andere mit einer Sitzung oder einem API-Token an, der Aufruf läuft mit den Berechtigungen dieses Tokens, und jeder Aufruf und jede Ablehnung landet im Audit-Log unter dem Namen des Aufrufers. Kein Token, kein Aufruf.
- `mcp client` ruft über eine `hotloop-flow-mcp-server`-Verbindung ein Tool auf einem beliebigen MCP-Server auf, auch auf dem von HotLoop, und verwendet, was zurückkommt. Es sendet nie einen Aufruf zweimal, denn ein Tool kann Anlagen bewegen, und eine abgebrochene Verbindung sagt nicht, ob er lief.
- Ein API-Token in `auth.tokens` kann ein `rateLimit` mit `calls` und einem Zeitfenster tragen, eine Minute, wenn Sie es weglassen. Ein Aufruf darüber erreicht den Flow nie, kommt als Tool-Fehler zurück, der sagt, wann man es erneut versuchen kann, und schreibt eine `mcp.refused`-Zeile mit dem Grund. Ein Token ohne `rateLimit` wird nie gedrosselt.
- Es spricht die aktuelle Revision der Spezifikation, 2026-07-28, und die Handshake-Revisionen bis 2025-11-25 zurück, am selben Endpunkt. Ein Flow, der keinen dieser Nodes nutzt, macht nie einen MCP-Aufruf, und Flow stellt kein Tool bereit, das ihm nicht gegeben wurde.

**Plugins ohne npm**
- Ein Plugin ist ein WebAssembly-Modul, ein Deskriptor, aus dem der Editor seinen Dialog zeichnet, und eine ed25519-Signatur über beides. Unsignierte und manipulierte Plugins weigern sich zu laden und sagen warum. `hotloop-flow plugin keygen` erzeugt einen Schlüssel, und `docs/plugins.md` hat den Rest.
- Ein Gast, der sein Speicherlimit oder sein Timeout überschreitet, läuft in einen Trap zu einem Catch-Node, während alles andere weiterläuft. Ein Plugin, das Host-Zugriff verlangt, den der Operator nicht gewährt hat (`clock`, `random`, `context.flow`, `context.global`), lässt den Deploy jedes Flows scheitern, der es nutzt, bevor ein Byte geschrieben wird.
- Ohne vertrauenswürdige Schlüssel wird jedes Plugin abgelehnt, und ohne Freigaben scheitert jedes Plugin, das Host-Zugriff verlangt. Standardmäßig lädt nichts.
- Das Chart nimmt alles unter `plugins` auf, mit einem Volume, das jede Kubernetes-Volume-Quelle akzeptiert. Aus erzeugt nichts, und ein `helm template` der Standardwerte ist, was es war.

**Typisierte Leitungen**
- Geben Sie dem `json`-Node in seinen Einstellungen ein JSON Schema, und jeder Wert, den er verarbeitet, wird dagegen geprüft. Ein Wert, der nicht passt, geht an einen Catch-Node, statt die Verbindung entlangzulaufen, und der Fehler nennt jedes fehlerhafte Feld, etwa `payload.temp: got string, want number`. Ohne Schema in den Einstellungen validiert der Node gegen `msg.schema`, wie es der `json`-Node von Node-RED tut. Es ist Draft 2020-12, sofern das Schema keinen anderen Draft nennt, und ein `$ref` auf eine andere URL oder eine Datei wird abgelehnt, nicht geladen.
- Ein Node kann deklarieren, was er akzeptiert und was jeder Ausgang verspricht, in zwei Schlüsseln der Flow-Datei, die jedes andere Tool ignoriert, sodass ein Flow, der sie trägt, weiterhin Byte für Byte den Rundlauf besteht. Deklarieren beide Enden einer Verbindung ein Schema und keine Nachricht könnte beide erfüllen, wird der Deploy abgelehnt, bevor ein Byte geschrieben wird. Die Abweichungen, die Flow nicht vorab sehen kann, halten dort an, wo sie das Schema brechen, gehen mit dem Pfad jedes fehlerhaften Feldes an Catch und werden in `hotloop_flow_node_schema_mismatches_total` gezählt.
- Ein `inject`, der ein Literal setzt, das der nächste Node nie annehmen kann, etwa die Zahl 250 in einen Node, der 0 bis 100 nimmt, wird beim Deploy auf dieselbe Weise abgelehnt. Zeitstempel, `env`, Kontext und JSONata werden übersprungen, nie geraten.
- Der Editor schreibt den Typ des Senders an jede Verbindung. Sie ist gedämpft, wenn nur ein Ende einen Typ hat, und rot, wenn sich beide nie einigen können, und das Rot kommt aus der eigenen Prüfung der Runtime, sodass Zeichenfläche und Deploy nicht widersprechen können. Im Abschnitt **Typen** des Dialogs eines Nodes stellen Sie sie ein.

Das sind neun weitere Node-Typen, insgesamt 79: fünf für HotLoop mit seiner Verbindung und vier für MCP mit seiner Verbindung.

## Was sich geändert hat

- Der `json`-Node ignorierte früher `msg.schema`. Jetzt wird eine Nachricht, die `msg.schema` trägt, dagegen validiert und geht, wenn sie nicht passt, an einen Catch-Node statt die Verbindung entlang. Ein Flow, der aus einem anderen Grund ein `msg.schema` an seinen Nachrichten lässt, wird das bemerken.
- Ein Deploy kann jetzt wegen eines Typkonflikts abgelehnt werden (`deploy.refused`, Grund `typed wires`), aber nur bei einem Flow, der Schemas an seinen Ports deklariert oder ein `inject`-Literal in einen Node setzt, der eines deklariert. Ein Flow ohne irgendwelche Schemas verhält sich genau wie vorher.
- Die Schreib-Nodes tragen die zwei neuen Felder, standardmäßig leer. Ohne gewählten HotLoop verhält sich ein Schreib-Node wie in 2.2.0.
- Der Schema-Validator ist `santhosh-tekuri/jsonschema` v6 (permissiv lizenziert), und MCP ist das Go-SDK `modelcontextprotocol/go-sdk` v1.8.0. Beides sind neue Go-Module, daher hat der Lizenztext, den das Image in `/usr/share/doc/hotloop-flow/` mitbringt, mehr Einträge. Die WebAssembly-Runtime war schon in 2.2.0 enthalten.
- Drei Korrekturen an der dauerhaften Warteschlange. Eine entfernte dauerhafte Verbindung lehnt jetzt einen späten Schreibvorgang ab und zählt ihn als verworfen, und das Entfernen wartet nicht mehr das ganze Schließ-Timeout auf ein Ziel, das in einer Nachricht hängt. Vorher blieb eine Nachricht, die nach dem Verschwinden der Verbindung zurückgegeben wurde, bis zu einem Neustart auf die Quote angerechnet. Eine Verbindung mit Drop-Oldest verdrängt keine Nachricht mehr, die schon bestätigt war oder die die Pumpe gerade gelesen hatte, was denselben Platz doppelt zurückgab und Tiefe und Quote der Warteschlange unter das setzte, was auf der Platte lag. Der Text zur dauerhaften Quote in `docs/durable/README.md` sagt jetzt, dass eine umgeleitete Nachricht die Quote kurz um ein paar Nachrichten überschreiten kann.
- Die README und `docs/bench/` enthalten die Ergebnisse des Raspberry Pi 5, und die Roadmap hakt den Pi 5 ab und lässt den Pi 4, den Zero 2 W und die Schreibvorgänge auf die SD-Karte offen.

## Hinweise zum Update

Ab 2.2.0 genügt es, das Image zu wechseln (`helm upgrade` oder das neue Tag in Ihrer Quadlet-Unit). Keine Migration, kein Flag, nichts Neues beim ersten Start. Eine `flows.json` und eine Konfigurationsdatei, die auf 2.2.0 liefen, laufen auf 2.3.0, und der byteexakte Rundlauf der Flow-Datei bleibt unangetastet.

- Der Rückschritt auf 2.2.0 ist sicher für jeden Flow, der die neuen Nodes oder Schlüssel nicht nutzt. Ein HotLoop-, MCP- oder Plugin-Node startet auf 2.2.0 nicht (unbekannter Node-Typ), und ein Schreib-Node mit gewähltem HotLoop schreibt dort direkt in seine Anlage, weil 2.2.0 das Feld nicht liest. Nehmen Sie den HotLoop von diesen Schreib-Nodes ab, bevor Sie zurückgehen.
- HotLoop protokolliert das Konto, mit dem Flow sich anmeldet. Die API gibt einem Client keine Möglichkeit, seinen eigenen Akteur zu nennen, daher geht die Flow-Node-ID als Grund ein, und das Konto ist das der Verbindung. Nehmen Sie ein eigens für Flow angelegtes Konto, wenn Sie seine Schreibvorgänge leicht finden wollen.
- MCP ist ein neuer Weg in Flow hinein, und er verlangt ein Token. Es wird nichts bereitgestellt, bis ein Flow einen `mcp tool`-Node hat, und ein Aufruf ohne Token oder mit einem erfundenen wird abgelehnt.

## Neue Einstellungen

| YAML | Umgebung | Standard |
|---|---|---|
| `plugins.dir` | `HOTLOOP_FLOW_PLUGINS_DIR` | leer, das ist `plugins` in `data.dir` |
| `plugins.trustedKeys` | `HOTLOOP_FLOW_PLUGIN_TRUSTED_KEYS` | keine. Jeder ist `ed25519:<base64>`, ein öffentlicher PEM-Schlüssel oder eine Datei, die einen enthält. Ohne einen wird jedes Plugin abgelehnt. |
| `plugins.grants` | `HOTLOOP_FLOW_PLUGIN_GRANTS` | keine. Der Name eines Plugins auf `clock`, `random`, `context.flow`, `context.global`. Die Variable ist `name=cap,cap;name=cap`. |
| `plugins.maxMemoryMiB` | `HOTLOOP_FLOW_PLUGIN_MAX_MEMORY_MIB` | 64, von 1 bis 4095 |
| `plugins.maxTimeout` | `HOTLOOP_FLOW_PLUGIN_MAX_TIMEOUT` | `5s` |
| `auth.tokens[].rateLimit.calls`, `.per` | | 0 Aufrufe, das heißt keine Grenze. `per` ist `1m`, wenn Sie `calls` setzen und nicht `per`. |

Die HotLoop- und MCP-Verbindungen werden im Editor eingestellt: URL, Konto und ein Timeout. Das Chart hat alle Plugin-Einstellungen unter `plugins` in `values.yaml`, mit `enabled: false`, und sonst nichts Neues.

Image: `ghcr.io/hotloop-io/hotloop-flow:2.3.0`, linux/amd64 und linux/arm64. Chart: `https://hotloop.io/hotloop-flow/`. Die README zu diesem Tag enthält den Rest: https://github.com/HotLoop-io/hotloop-flow/blob/v2.3.0/README.md
