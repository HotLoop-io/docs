---
title: "Versionshinweise: HotLoop Flow 2.1.0"
description: "Was HotLoop Flow 2.1.0 bringt, was sich beim Update ändert und was Sie lesen sollten, bevor Sie eine laufende Anlage anfassen."
sidebar:
  label: "2.1.0"
---

HotLoop Flow 2.1.0 umfasst die Phasen 0 bis 2 der [Roadmap](/de/flow/roadmap/) und die alltäglichen Lücken, die verhindert haben, einen echten Flow darauf zu betreiben. Jeder Deploy ist jetzt ein Datensatz, den Sie vergleichen, testen, prüfen und zurückspielen können. Ein Flow kann Tests haben, die laufen, bevor ein schlechter Deploy passiert. Ein Speichern startet die geänderten Nodes neu und lässt den Rest der Anlage in Ruhe.

Nichts in dieser Version ändert, wie eine Flow-Datei gelesen oder geschrieben wird. Der byteexakte Rundlauf bleibt unangetastet, eine `flows.json`, die auf 2.0.5 lief, läuft also auf 2.1.0.

## Neu

**Deploys**
- Jeder Deploy ist ein Datensatz: wer, von wo, wann, die Notiz, die ersetzte Revision, die Flow-Datei Byte für Byte und die verschlüsselten Zugangsdaten, wie sie waren. `GET /deployments` liest sie. `history.retain` behält standardmäßig die letzten 100.
- Ein Diff, der sich wie ein Review liest: Node für Node, Eigenschaft für Eigenschaft, Layout getrennt von der Logik, Zugangsdaten werden nie angezeigt. In der API, auf der Kommandozeile (`hotloop-flow diff`) und als Diff-Treiber von git selbst.
- Ein Rollback spielt einen alten Datensatz als neuen Deploy zurück, Flows und Zugangsdaten gemeinsam, sodass ein gelöschter Node mit dem Passwort seines Brokers zurückkommt.
- Teil-Deploy: ein Speichern startet die Nodes neu, die sich geändert haben. MQTT-Sitzungen, Listener und Delay-Warteschlangen aller anderen laufen weiter. `HotLoop-Flow-Deployment-Type` (oder der Header von Node-RED) wählt Nodes, Flows oder vollständig.
- Der Editor prüft vor dem Deploy, mit dem Diff auf der Zeichenfläche und einer Notiz, und zeigt den Verlauf mit einem Rollback-Button.
- Flows als Code: `hotloop-flow deploy` gibt den Diff gegen das Laufende aus und deployt gegen die Revision, von der es ausging, sodass ein Wettlauf eine rote Pipeline ist. `hotloop-flow export` gibt die laufende Datei Byte für Byte zurück. `hotloop-flow token` erzeugt ein API-Token und den Hash, der dafür zu konfigurieren ist.
- Optionaler Git-Spiegel: Ist `history.git` gesetzt, ist jeder Deploy ein Commit, dessen Autor die Person ist, die deployt hat.

**Tests**
- Flow-Tests: `flows.test.yaml` neben `flows.json`, ausgeführt von `hotloop-flow test` (JUnit mit `-junit`) auf der echten Runtime und den echten Nodes. Delay, Trigger, Inject, Join und Batch laufen auf einer Uhr, die der Test vorstellt, sodass fünf Minuten Delay ein einziger Schritt sind. Alles, was mit der Außenwelt spricht, MQTT, HTTP, PostgreSQL, InfluxDB, TCP, UDP, WebSocket, Dateien, exec, wird ersetzt, und der Test prüft, was hinausgegangen wäre.
- Das Deploy-Gate: Schalten Sie `tests.gate` ein, und ein Deploy, dessen Flows die Suite nicht bestehen, ergibt ein 422 mit dem ganzen Bericht. Rollbacks laufen nicht durchs Gate, denn ein Rollback ist der Ausweg.
- Der Editor macht aus einer Debug-Meldung einen Test und führt ihn aus.

**Nodes und Protokolle**
- JSONata, geprüft mit der veröffentlichten Suite von jsonata-js 2.2.2: 1673 von 1686 Fällen bestehen, und die 13, die es nicht tun, sind mit Namen und Grund festgehalten.
- Inject löst per Crontab aus, in derselben Minute wie bei Node-RED, mit geprüften Zeitumstellungen in sechs Zonen.
- MQTT 5 (Eigenschaften, Abonnementoptionen, Sitzungsablauf) und das Last Will. MQTT 3.1.1 funktioniert weiterhin.
- TLS auf TCP, HTTP-Request und MQTT über einen `tls-config`-Node. Der WebSocket-Listener und der Client starten, und der Client nutzt TLS.
- Cookies und Multipart bei HTTP, geprüft gegen die Bibliotheken, die Node-RED verwendet.
- Split, Join und Batch arbeiten wie die von Node-RED: Streaming, Timeouts, Reduce, Intervalle. Link Call und der Rückgabemodus von Link Out.
- Ein Passwort kann in einem eingebundenen Secret liegen statt im Flow. Das Helm-Chart bekommt `secrets.mounts`.

**Anmeldung**
- Zwei-Faktor-Anmeldung (TOTP), kostenlos, für alle, die sie im Editor einschalten.
- Sperren, Sitzungen, die einen Neustart überstehen, und ein Audit-Log, wer was von wo getan hat (`GET /audit`, `audit.read`).

## Was sich geändert hat

- Die Sperre ist standardmäßig an: 5 Fehlversuche für ein Konto von einer Adresse oder 20 von einer Adresse sperren es für 15 Minuten mit einem 429. `auth.lockout` ändert die Zahlen.
- Sitzungen liegen als Hashes in `data/sessions.json` und folgen bei jeder Anfrage der Konfiguration, sodass das Entfernen einer Berechtigung oder eines Benutzers aus der Konfiguration bei der nächsten Anfrage wirkt.
- Ein Rollback ist ein vollständiger Neustart, es sei denn, Sie verlangen weniger.
- Das Image enthält `LICENSE`, `NOTICE` und `THIRD_PARTY_LICENSES` in `/usr/share/doc/hotloop-flow/`. `THIRD_PARTY_LICENSES` listet jedes Go-Modul und npm-Paket im Binary mit Version und Lizenztext auf, beim Build erzeugt. Der Build schlägt bei einer GPL-, AGPL- oder LGPL-Abhängigkeit fehl oder bei einer, die niemand identifizieren kann.
- `NOTICE` war falsch. Es hieß, hier sei kein Node-RED-Code enthalten. Cron, Split, Join, Batch, Link Call, tls-config und die HTTP-Cookie- und Multipart-Arbeit sind Portierungen, und es listet jetzt jede portierte Datei mit Herkunft, Urheberrechtsinhaber und Lizenz auf, mit dem vollen ISC-Text für cronosjs und dem MIT-Text für den Rest. Jede portierte Datei sagt oben dasselbe.
- Ein abgelehnter Deploy bereinigt keine Zugangsdaten mehr im Speicher, und ein Doppelklick auf einen Node in Chromium öffnet seinen Dialog. Beides wurde beim Bauen gefunden.

## Hinweise zum Update

Ab 2.0.5 genügt es, das Image zu wechseln (`helm upgrade` oder das neue Tag in Ihrer Quadlet-Unit). Keine Migration, kein Flag.

- Der erste Start legt `sessions.json`, `audit.log` und ein Verzeichnis `deployments` unter `data.dir` an. Sitzungen lagen zuvor im Speicher, daher melden sich nach dem Update alle einmal neu an.
- Alles Neue in der Konfiguration ist optional und standardmäßig aus oder harmlos. Nichts, was Sie haben, hört auf zu funktionieren.
- WebSocket-Token: Der Editor sendet sein Token jetzt als Subprotokoll, `hotloop-flow.bearer.<token>`, angeboten neben `hotloop-flow`. Das ist der bevorzugte Weg für alles, was sich mit `/comms` verbindet. Ein Skript, das `?access_token=` in der URL sendet, funktioniert weiterhin, und der Server schreibt für jede solche Verbindung eine Warnung, dass das Token in Proxy- und Zugriffslogs gelangt und was stattdessen zu senden ist. Die URL selbst wird nie ins Flow-Log oder den Audit-Trail geschrieben. Die URL-Form entfällt erst in einer künftigen Hauptversion.

## Neue Einstellungen

| YAML | Umgebung | Standard |
|---|---|---|
| `tests.gate` | `HOTLOOP_FLOW_TESTS_GATE` | `false`. `true` lehnt einen Deploy ab, dessen Flows `flows.test.yaml` nicht bestehen. |
| `tests.timeout` | | `2m`, die Echtzeit für einen Testlauf. Ein Lauf, der nicht fertig werden kann, lehnt den Deploy ab. |
| `secrets.allowedPaths` | `HOTLOOP_FLOW_SECRET_ALLOWED_PATHS` | leer. Zusätzliche Verzeichnisbäume, aus denen ein `tls-config` oder eine Zugangsdaten-Datei gelesen werden darf, zusätzlich zu `data.dir`. Nicht der Bereich der Datei-Nodes: Ein File-In-Node kann sie weiterhin nicht lesen. |
| `secrets.mounts` (Chart) | | leer. Kubernetes-Secrets, schreibgeschützt eingebunden, jedes dem Secret-Bereich hinzugefügt. |
| `auth.tokens` | `HOTLOOP_FLOW_DEPLOY_TOKEN_HASH` | keine. API-Tokens für Maschinen, als Hashes gespeichert. Die Umgebungsvariable erzeugt ein `deploy`-Token, das lesen und deployen kann und sonst nichts. Erzeugen Sie eines mit `hotloop-flow token`. |
| `auth.lockout` | | `attempts: 5`, `perAddress: 20`, `window: 15m`, `duration: 15m` |
| `history.retain` | | `100`. `0` behält jeden Datensatz. |
| `history.git` | `HOTLOOP_FLOW_GIT_URL`, `HOTLOOP_FLOW_GIT_USERNAME`, `HOTLOOP_FLOW_GIT_PASSWORD` | aus. |
| `audit.maxBytes`, `audit.keep` | | 16 MiB, 4 Dateien. |

Image: `ghcr.io/hotloop-io/hotloop-flow:2.1.0`, linux/amd64 und linux/arm64. Chart: `https://hotloop.io/hotloop-flow/`. Die README zu diesem Tag enthält den Rest: https://github.com/HotLoop-io/hotloop-flow/blob/v2.1.0/README.md
