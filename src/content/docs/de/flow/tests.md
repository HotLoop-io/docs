---
title: "Tests neben den Flows"
description: "Testdatei neben dem Flow, Lauf auf simulierter Uhr, Deploy nur bei Erfolg. Nichts verlässt den Test."
---

„Hat meine Änderung die Linie kaputtgemacht?“ soll vor dem Deploy beantwortet werden, von dem, der die Änderung macht, und nicht um 3 Uhr nachts von dem, der Bereitschaft hat. Ein Flow kann deshalb Tests haben, und die sind YAML, liegen neben der Flow-Datei und gehen durch dieselbe Prüfung:

```yaml
# line3.test.yaml
flows: line3.json            # relative to this file; flows.json if you leave it out
tests:
  - name: a high reading raises the alarm and nothing else
    inject:
      - node: reading                  # by name or by id
        msg: {topic: line3/temp, payload: 92.5}
    expect:
      - node: over limit?              # the Switch
        port: 1
        msg: {payload: 92.5}
        within: 500ms
      - node: over limit?
        port: 2
        nothing: true
      - node: alarm out                # a Debug: checked on what it received
        msg: {payload: HIGH}

  - name: a negative reading is caught, not alarmed on
    inject:
      - node: reading
        msg: {payload: -4}
    expect:
      - node: errors                   # a Catch node
        error: "out of range"
```

```bash
hotloop-flow test -junit report.xml line3.test.yaml
```

```
--- PASS: a high reading raises the alarm and nothing else (0.00s)
--- PASS: a negative reading is caught, not alarmed on (0.00s)
ok	line3.test.yaml	2 passed, 0 failed, 0 errors (0.00s)
```

Das ist die echte Runtime mit den echten Knoten, im Prozess, ohne Server und ohne Editor. Jeder Test bekommt eine eigene Runtime, sodass nichts, was ein Test in einem Delay oder in einem Kontext hinterlässt, in den nächsten durchsickern kann.

- **`inject`** gibt Nachrichten der Reihe nach hinein, jede wird behandelt, bevor die nächste hineinkommt. Ein Knoten mit Eingang bekommt sie dort. Eine Quelle wie ein Inject oder ein MQTT In sendet sie über ihren ersten Ausgang, als hätte sie sie selbst erzeugt, und bei einem Inject-Knoten ohne Nachricht wird die Taste gedrückt.
- **`expect`** beobachtet den Ausgang eines Knotens, wobei die Ports wie im Editor ab 1 gezählt werden. Ein Knoten ohne Ausgänge, etwa ein Debug, wird an dem geprüft, was er empfangen hat. Eine Subflow-Instanz wird an ihren eigenen Ausgängen beobachtet, egal woher in ihrem Inneren sie kommen.
- **`msg`** ist das, was die Nachricht enthalten muss. Jede angegebene Eigenschaft muss mit diesem Wert vorhanden sein, bis ins Innerste, und alles andere an der Nachricht wird ignoriert, sodass ein Test über den Payload nicht kaputtgeht, wenn jemand anfängt, `msg.topic` zu setzen. **`assert`** ist ein JSONata-Ausdruck, der wahr ergeben muss, für Prüfungen, die ein Literal nicht leisten kann. **`error`** ist der Text, den der von einem Catch-Knoten gefangene Fehler enthalten muss.
- **`within`** ist eine Frist. Eine Nachricht, die zu spät kommt, scheitert, und der Fehlschlag sagt, wie spät. **`nothing: true`** und **`count: N`** werden geprüft, sobald der Flow zur Ruhe gekommen ist, denn nur dann bedeutet „es kam nichts heraus“ etwas. Zwei Erwartungen an einem Port sind zwei Nachrichten, in dieser Reihenfolge.

Ein Test endet, sobald alles eingetreten ist, worauf er wartet, und der Flow nichts mehr zu tun hat. Das `timeout` beträgt 5 Sekunden, sofern Sie nichts anderes angeben, auf der eigenen Uhr des Tests, die im nächsten Abschnitt beschrieben ist.

Ein Fehlschlag sagt, was stattdessen herauskam und wo es abweicht:

```
--- FAIL: the alarm says LOW (0.00s)
    expect 1: debug "alarm out" (alarm-out): 1 message(s) received and none matched; the first one differs at msg.payload: wanted "LOW", got "HIGH"
      at 0s: {"payload":"HIGH","topic":"line3/temp"}
```

Ein Test, der nicht laufen kann, ist ein Fehler und kein Bestehen: ein genannter Knoten, der nicht im Flow ist, ein Name, den zwei Knoten tragen, ein Port, den der Knoten nicht hat, oder ein Knoten im Flow, der nicht startet. Ebenso ein falsch geschriebener Schlüssel. `expcet:` wird beim Lesen der Datei abgelehnt, denn ein stillschweigend übergangener Tippfehler ließe einen Test ohne etwas zu prüfen zurück, und ein Test ohne etwas zu prüfen besteht. Der Exit-Status ist 1 für alles, was nicht vollständiges Bestehen ist, und `-junit` schreibt den Bericht, den jedes CI-System liest.

## Auf der Uhr des Tests

Niemand führt eine Testsuite aus, die ein Delay von fünf Minuten abwartet, also wartet ein Test nicht. Er führt eine eigene Uhr und stellt sie direkt auf das Nächste, worauf irgendetwas im Flow wartet: ein Delay, das loslässt, die zweite Nachricht eines Triggers, ein Inject im Intervall oder per Crontab, ein Join oder Batch, der abläuft, ein Link Call, der aufgibt. Der Timer feuert, der Flow behandelt, was er gesendet hat, und erst dann sucht die Uhr nach dem nächsten Fälligen, in derselben Reihenfolge, die die echten Minuten gebracht hätten. Fünf Minuten Delay sind ein Schritt und etwa eine Millisekunde.

```yaml
  - name: a reading at 4m pushes the watchdog's off out to 9m
    clock: 2026-10-05T06:00:00Z     # when the test starts; the real time if you leave it out
    timeout: 20m
    inject:
      - {node: watchdog, msg: {payload: reading}}
      - {node: watchdog, msg: {payload: reading}, at: 4m}   # at: on the test's clock
    expect:
      - {node: watchdog, msg: {payload: "on"}}
      - {node: watchdog, msg: {payload: "off"}, within: 9m}

  - name: and not a moment before
    timeout: 8m59s
    inject:
      - {node: watchdog, msg: {payload: reading}}
      - {node: watchdog, msg: {payload: reading}, at: 4m}
    expect:
      - {node: watchdog, count: 1}  # the "on", and nothing else yet
```

**`at`** legt eine Einspeisung auf einen Zeitpunkt der Testuhr, und alles, was vorher fällig ist, geschieht zuerst. **`within`** und **`timeout`** laufen ebenfalls auf dieser Uhr, also sind `timeout: 1h` bei einem Flow mit einem Inject alle zehn Minuten sechs Ticks und ein paar Millisekunden. **`clock`** legt fest, wann der Test beginnt, für einen Flow, der von der Uhrzeit abhängt: Ein Crontab, der um halb sieben feuert, feuert, wenn die Uhr des Tests halb sieben zeigt. Das `Date` eines Function-Knotens, der Zeitstempel eines Inject, ein Change-Knoten, der ein Datum setzt, und das `Expires` eines Cookies lesen alle dieselbe Uhr, sodass ein Flow, der Zeiten stempelt und vergleicht, unter einem Test mit sich selbst übereinstimmt.

Die Suite belegt damit jeden Zeitknoten der Palette, auf die Millisekunde: Delay im festen, zufälligen, Raten- und Zeitmodus, Trigger mit extend, Inject im Intervall, einmal beim Start und per Crontab, Join- und Batch-Zeitüberschreitungen und einen Link Call, der nie seine Antwort bekommt. Alles, eine Stunde Anlagenzeit eingeschlossen, läuft in weit unter einer Sekunde. Was ein Test nicht verschieben kann, ist die CPU: Ein Flow, der nach einer Minute echter Zeit noch beschäftigt ist, lässt den Test scheitern, statt die Suite zu blockieren. JSONata `$now()` und `$millis()` lesen weiterhin die Wanduhr.

## Tests aus dem Editor

Niemand schreibt einen Test für einen Flow, der funktioniert. Man schreibt ihn an dem Tag, an dem er aufhört zu funktionieren, und das ist einen Tag zu spät. Deshalb macht der Editor aus dem, was der Flow gerade getan hat, einen, in zwei Klicks.

Jede Nachricht in der Debug-Seitenleiste hat eine Schaltfläche **Test**. Klicken Sie darauf, und der Editor entwirft aus genau dieser Nachricht einen Test: was an der Quelle hereinkam, über die es hereinkam, dort wieder eingespeist, und was dieser Debug-Knoten zeigte, hier erwartet. Ändern Sie, was Sie wollen, denn eine Messung mit Zeitstempel prüft man besser mit einem `assert`, als sie auf die Millisekunde festzunageln. Klicken Sie auf **Add to tests**, und er steht in der Suite neben der Flow-Datei, am Ende, wobei alles, was dort schon stand, genau so bleibt, Kommentare eingeschlossen. Ein Name, den die Suite schon hat, bekommt hinten eine Nummer, statt etwas zu ersetzen.

Woher der Editor weiß, was hereinkam: Die Runtime behält die letzten 64 Nachrichten, die an einer Quelle in den Flow kamen, und die letzten 64, die einen Debug-Knoten erreichten, unter der ID, die eine Nachricht von Knoten zu Knoten trägt. Das ist ein Ring mit Größenobergrenze, und eine Nachricht über 64 KB wird gar nicht behalten, sie kann also nie das sein, was einen Pod wachsen lässt. Eine Nachricht, die hinausgeschoben wurde oder die ein Knoten unterwegs durch eine neue ersetzt hat, lässt sich nicht entwerfen, und der Editor sagt das, statt zu raten, was hereinkam.

Das Panel **Tests** führt die Suite gegen die Arbeitskopie aus, deployt oder nicht, und das ist der Punkt: Sie erfahren es vor dem Deploy. Jeder Knoten, durch den ein bestandener Test lief, bekommt ein Häkchen, jeder Knoten, um den es bei einem Fehlschlag geht, ein Kreuz mit dem Grund beim Darüberfahren, und ein Klick auf einen Fehlschlag führt zu seinem Knoten. Ändern Sie irgendetwas, und die Markierungen verschwinden, weil sie einen Flow beschreiben, den es nicht mehr gibt. **Edit** öffnet die ganze Suite als YAML. Ein Deploy, den das [Gate](#das-deploy-gate) abweist, landet im selben Panel, die Fehlschläge an den Knoten.

All das läuft bei jedem Pull Request in einem echten Browser gegen die echte Binärdatei.

## Das Deploy-Gate

Tests auf dem Laptop von irgendwem belegen den Flow, den er auf seinem Laptop hatte. Das Gate belegt den, der deployt wird. Halten Sie die Suite auf der Instanz, neben der Flow-Datei, die sie testet (`data/flows.test.yaml` neben `data/flows.json`, über `PUT /tests` oder den Editor), schalten Sie `tests.gate` ein, und jeder Deploy führt sie gegen die Flows aus, die er gleich in Kraft setzt. Einer, der nicht besteht, wird abgewiesen, mit einem 422 und dem ganzen Bericht:

```
$ hotloop-flow deploy -file flows.json -note "raise the alarm at 95"
1 changed

Tab "Line 3" (t1)
  ~ switch "over limit?" (chk)
      rules[0].v: "80" -> "95"
hotloop-flow: the deploy was refused: 1 of 2 flow tests didn't pass, and the flows already running are untouched; "a high reading raises the alarm and nothing else": expect 1: switch "over limit?" (chk): nothing sent from port 1

--- FAIL: a high reading raises the alarm and nothing else (0.00s)
    expect 1: switch "over limit?" (chk): nothing sent from port 1
    expect 2: switch "over limit?" (chk): expected nothing, and 1 message(s) sent from port 2
      at 0s: {"payload":92.5,"topic":"line3/temp"}
    expect 3: debug "alarm out" (alarm-out): nothing received
--- PASS: a negative reading is caught, not alarmed on (0.00s)
FAIL	flows.test.yaml	1 passed, 1 failed, 0 errors (0.00s)
```

Das ist ein echter Lauf: die Binärdatei mit eingeschaltetem Gate, die Suite vom Anfang dieses Abschnitts neben ihrer Flow-Datei und ein Deploy-Token.

**Die bereits laufenden Flows merken nichts.** Das Gate läuft, bevor ein Byte geschrieben wird: keine Flow-Datei, keine Zugangsdaten, kein Deploy-Eintrag, kein Neustart. Die Abweisung landet im Audit-Trail als ein `deploy.refused`, das besagt, dass die Tests fehlgeschlagen sind. Und die Tests laufen gar nicht im Serverprozess. Sie laufen in einem Kindprozess, genau dieser Binärdatei als `hotloop-flow test -stdin`, dem die Kandidaten-Flows und die Suite über stdin übergeben werden, denn ein Test startet jeden Knoten im Flow, und manche registrieren sich dort, wo der ganze Prozess sie teilt: ein Link In über seine ID, eine HTTP-Route über ihren Pfad. Hier drinnen ausgeführt, würde der Link In des Kandidaten für den des laufenden Flows antworten, sobald er gestartet ist. In einem Kind kann er nichts berühren, was die Linie benutzt, ein Knoten, der in einer eigenen Goroutine in Panik gerät, reißt den Test mit und nicht die Anlage, und der Speicher geht beim Beenden zurück. Der Test beweist es auf die harte Tour: Der abgewiesene Kandidat hat denselben Link In, und nach der Abweisung kommt eine Nachricht über den Link des laufenden Flows weiterhin an.

Drei Entscheidungen, die man kennen sollte. **Es ist standardmäßig aus**, denn ein Gate, das ein Bediener nicht verlangt hat, ist ein Deploy, der um 3 Uhr nachts aus einem Grund scheitert, von dem niemand in der Schicht gehört hat. **Tests, die nicht laufen können, bestehen nicht**: Ein Kind, das nicht startet, oder ein Lauf, der länger dauert als `tests.timeout`, weist den Deploy ab und sagt, welches von beidem. Und **Rollbacks werden nicht geprüft.** Ein Rollback ist der Weg aus einem schlechten Zustand in einen, der schon lief, und ihn wegen der Tests von heute aufzuhalten, ist der Weg, einen Ausfall zu verlängern. Bei eingeschaltetem Gate und ohne Suite gibt es nichts, was scheitern könnte, also geht der Deploy durch, und das Log sagt, warum nicht geprüft wurde.

## Kontext und Zugangsdaten

Jeder Test beginnt mit leerem Kontext, was auch immer der Test davor hinterlassen hat. Ein Zähler, den ein Test auf 42 getrieben hat, ist nicht der Startpunkt des nächsten, denn eine Suite, in der der zweite Test nur besteht, wenn der erste vorher lief, ist eine Suite, die an dem Tag lügt, an dem jemand einen einzelnen Test ausführt. Ein Test, der einen Zähler auf 41 braucht, sagt das also, und er sagt, was der Kontext am Ende enthalten muss:

```yaml
  - name: picks up where the line left off
    context:                        # what the test starts with
      global: {limit: 90}
      flow: {Line 3: {count: 41}}   # flow context, by tab label or id
    credentials:                    # by node name or id; never the real ones
      historian: {token: test-token}
      plc api: {password: s3cret}
    inject: [{node: count, msg: {payload: 95}}]
    expect:
      - {node: out, msg: {count: 42}}
      - context:                    # what it holds at the end
          global: {alarm: true}
          flow: {Line 3: {count: 42}}
          node: {count: {last: 95}} # node context, by node name or id
```

`context` in einer Erwartung wird wie `msg` verglichen, und `null` bedeutet, dass der Schlüssel nicht gesetzt sein darf. Ein Fehlschlag sagt, was der Bereich tatsächlich enthält, denn die übliche Antwort ist ein Tippfehler: `flow context of "Line 3" (t1): cuont: not set; it holds count`.

Ein Test sieht nie die echten Zugangsdaten. Er läuft mit denen, die er nennt, und das macht es sicher, ihn einzuchecken. Sie erreichen einen Knoten genau so, wie die echten es würden: Das Passwort einer HTTP-Anfrage taucht in dem `Authorization`-Header auf, den sie gesendet hätte, und eine InfluxDB-Konfiguration, die ohne Token nicht startet, startet mit dem des Tests. Ein Knoten, der ein Passwort über `ew_credentialFiles` aus einer eingebundenen Datei liest, bekommt stattdessen die Zugangsdaten des Tests für dieses Feld, denn ein Test liest nichts von der Platte, und ein leeres, wenn der Test keines nennt.

Der Kontext lebt für einen Test im Speicher, nie in der Zustandsdatenbank, sodass ein Test nicht lesen kann, was die laufenden Flows hinterlassen haben, und ihnen nichts hinterlassen kann. Ein Fixture ist YAML im Test, keine Datei, die eine Datenbank vortäuscht.

## Nichts verlässt den Test

Ein Test, der Ihren MQTT Out wirklich ausführte, würde auf den Broker der Anlage veröffentlichen, und dann ist er kein Test, sondern ein Deploy. Deshalb bekommt unter einem Test jeder Knoten, der mit der Welt außerhalb des Prozesses spricht, einen Stellvertreter: MQTT ein und aus, HTTP in, response und request, PostgreSQL, InfluxDB, TCP und UDP ein, aus und request, WebSocket ein und aus samt Listener und Client dahinter, die Dateiknoten, `exec`, `scan` und `netinfo`.

Der Knoten erledigt weiterhin seine ganze Arbeit bis kurz vor die Leitung. Der MQTT Out ermittelt weiterhin Topic, QoS und Bytes; der HTTP Request rendert weiterhin die URL, baut den Body und folgt Weiterleitungen; der PostgreSQL-Knoten baut weiterhin das SQL und seine Parameter. Dann übergibt er das dem Stellvertreter, der es aufzeichnet und mit dem antwortet, was der Test vorgegeben hat. Ohne Vorgabe lautet die Antwort nichts und Erfolg: keine Zeilen, ein leeres 200, ein Befehl, der mit 0 endete. Die Quellen (MQTT In, HTTP In, TCP und UDP In, WebSocket In, Watch) abonnieren, lauschen und fragen nicht ab, also kommt an, was der Test einspeist.

```yaml
  - name: the limit comes from the database and the alarm goes to the broker
    inject:
      - node: reading
        msg: {topic: "3", payload: 92.5}
    replies:
      - node: lookup limit                   # a PostgreSQL query
        reply: {rows: [{limit_c: 90}]}
      - node: maintenance api                # an HTTP Request
        reply: {statusCode: 503, payload: {error: down for maintenance}}
      - node: historian                      # InfluxDB, and it's down
        error: connection refused
    expect:
      - node: lookup limit
        sent: {query: "select limit_c from limits where line = $1", params: ["3"]}
      - node: to the plant                   # an MQTT Out
        sent: {topic: line3/alarm, payload: HIGH, qos: 1, retain: true}
      - node: errors
        error: connection refused
```

**`sent`** ist das, was der Knoten gesendet hätte, verglichen wie `msg`. **`replies`** gibt vor, was zurückkommt: Die erste für einen Knoten aufgeführte Antwort beantwortet seinen ersten Aufruf, die nächste den zweiten, und die letzte antwortet weiter, sodass „er antwortete, dann nicht mehr“ zwei Zeilen sind. **`error`** lässt den Aufruf so scheitern wie das Echte, damit der Weg, den Ihr Flow nimmt, wenn der Historian ausfällt, getestet wird, bevor er ausfällt.

| Knoten | `sent` | `reply` |
|---|---|---|
| MQTT Out | `topic`, `payload`, `qos`, `retain` | |
| HTTP Request | `method`, `url`, `headers`, `payload` | `statusCode` (200), `headers`, `payload` |
| HTTP Response | `statusCode`, `headers`, `payload` | |
| PostgreSQL | `query`, `params` | `rows` bei einer Abfrage, `rowCount` bei einem Insert |
| InfluxDB | `line`, das Line Protocol | |
| TCP Out, UDP Out | `host`, `port`, `payload` (`session` beim Antworten) | |
| TCP Request | `host`, `port`, `payload` | `payload`, gelesen, wie der Knoten eine echte Antwort liest |
| WebSocket Out | `payload` (`session` beim Antworten) | |
| File | `filename`, `action`, `payload` | |
| File In | `filename` | `payload`, der Inhalt |
| exec | `command`, `args` | `stdout`, `stderr`, `code` (0) |
| scan | `range`, `ports` | `devices` |
| netinfo | | `interfaces` |

Einiges prüft ein Test absichtlich nicht, weil es zur Maschine gehört und nicht zum Flow: die Positivliste von `exec`, die Pfad- und Discovery-Bereiche und die Zertifikate einer `tls-config`. Unter einem Test wird nichts ausgeführt, geöffnet, sondiert oder angewählt, es gibt also nichts einzugrenzen oder zu verschlüsseln, und der Deploy muss sich auf der Maschine, auf der er landet, weiterhin an all das halten.

Der Beleg ist ein Test, der jeden dieser Knoten auf einen TCP-Port, einen UDP-Port und ein Verzeichnis richtet, die der Test hält, eine Messung durch alle schickt, Byte für Byte prüft, was jeder gesendet hätte, und dann zählt: null Verbindungen, null Datagramme, keine Dateien geschrieben, nichts ausgeführt. Ein Knoten, der nach außen greift und keinen Stellvertreter hat, wird mit Namen abgewiesen, bevor irgendetwas läuft, und der Palettentest scheitert, wenn jemand einen hinzufügt.
