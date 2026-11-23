---
title: "Die HTTP-API"
description: "Jeder Aufruf, den HotLoop über HTTP beantwortet, was er braucht, was er annimmt und was er zurückgibt. Die Web-Oberfläche nutzt nichts anderes."
---

Jeder Aufruf, den das Gateway über HTTP beantwortet, was er braucht, was er annimmt und was er zurückgibt. Die Weboberfläche nutzt nichts anderes: Hinter den Bildschirmen steckt keine private API, also kann ein Skript alles, was die Oberfläche kann, mit denselben Aufrufen und denselben Berechtigungen.

Diese Seite wird gegen den Code geprüft. Die Liste der Routen und wer sie aufrufen darf, beschreibt also keine API, wie sie einmal war. Die Formen der Anfragen und Antworten unten stammen von einem laufenden Gateway; die Tests prüfen sie nicht. Wenn Sie einen Handler ändern, ändern Sie deshalb auch seinen Abschnitt hier.

Den Hintergrund zu jeder Funktion finden Sie auf ihrer eigenen Seite: [Authentifizierung und Benutzer](/de/iot/authentication/), [Entitäten](/de/iot/entities/), [der Anlagenbaum und die Bezeichnungen](/de/iot/equipment/), [Automatisierungen](/de/iot/automations/), [Geplante Berichte](/de/gateway/reports/), [Flottenverwaltung](/de/gateway/fleet/), [Alarmbenachrichtigungen](/de/iot/notifications/), [Sicherungen und Wiederherstellung](/de/iot/backup/) und [MCP](/de/iot/mcp/). Diese Seite ist die Liste, jene nennen die Gründe.

## Konventionen

### Wo sie liegt

Alles läuft über den einen HTTP-Port der Anwendung (`HOTLOOP_LISTEN_ADDR`, standardmäßig `:8080`). Hinter einem Proxy, der die Anwendung unter einem Pfad ausliefert, setzen Sie `HOTLOOP_BASE_PATH`, und das Gateway entfernt ihn, sodass `/hotloop/api/devices` und `/api/devices` derselbe Aufruf sind. Die Pfade unten sind ohne ihn geschrieben.

### Anmelden: ein Cookie oder ein Bearer-Token

Jede `/api/`-Route braucht eine Sitzung, außer der Anmeldung (mit Passwort oder mit PIN oder Ausweis an einem Kiosk-Panel), eingehenden Webhooks und Links zum Quittieren von Alarmen, die jeweils ihren eigenen Nachweis in der Anfrage mitbringen. `POST /api/auth/login` antwortet mit einem Token und setzt ihn zugleich als Cookie `iiot_session` (HttpOnly, SameSite=Lax, Secure, wenn die Anfrage über TLS oder mit `X-Forwarded-Proto: https` kam). Ein Browser nutzt das Cookie und sieht den Token nie. Ein Skript sendet stattdessen den Token:

```
Authorization: Bearer 3f9c...e1
```

Beides ist dieselbe Sitzung und wird gleich geprüft. Eine Sitzung dauert `HOTLOOP_AUTH_SESSION_TTL` (standardmäßig 12 Stunden). Ohne Sitzung antwortet jede `/api/`-Route:

```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="hotloop"

{"error":"not logged in"}
```

oder `"the session is invalid or has expired"` bei einem widerrufenen oder abgelaufenen Token, oder `"this account no longer has access"` bei einem deaktivierten Konto.

Mit `HOTLOOP_AUTH_INSECURE=true` gibt es gar keine Anmeldung: Nichts wird geprüft, jede Berechtigung unten ist jedem gewährt, und der bei einem Schreibvorgang vermerkte Name stammt aus dem Header `X-EmberNET-User`, `X-Forwarded-User`, `X-Auth-Request-User`, `X-Remote-User` oder `X-Forwarded-Email` des Proxys, oder er lautet `operator`, wenn keiner gesetzt ist. Das ist nur hinter einer NetworkPolicy vertretbar, die nichts außer dem Dashboard-Proxy an den Pod lässt. Siehe [Authentifizierung und Benutzer](/de/iot/authentication/#ohne-anmeldung-betreiben).

MCP ist getrennt: Es hat einen eigenen Bearer-Token (`HOTLOOP_MCP_TOKEN`) und sieht nie eine Sitzung an. Siehe [MCP](#mcp).

### Berechtigungen

Ein angemeldeter Benutzer hat eine Liste von Berechtigungen, aus seiner Rolle oder ausdrücklich am Konto gesetzt. Eine Route, die eine verlangt, die der Benutzer nicht hat, antwortet:

```
HTTP/1.1 403 Forbidden

{"error":"viewer1 does not have the \"values.write\" permission"}
```

Die [Berechtigungstabelle](#berechtigungen) sagt, welche Rolle was hat.

### Fehler

Jeder Fehler, den die API selbst erzeugt, ist ein JSON in einer einzigen Form:

```json
{"error": "value is outside the tag's configured range: 120 is outside 0..95"}
```

`/readyz` fügt ein `detail` hinzu, und ein fehlgeschlagener Dienstaufruf fügt die Schreibvorgänge hinzu, die er schon gemacht hat. Die Meldung ist für die Person geschrieben, die sie liest: Sie sagt, was falsch war und, wenn es eine gibt, was stattdessen zu tun ist. Zeigen Sie sie unverändert an.

| Status | Wann |
|---|---|
| 400 | Die Anfrage ist falsch: ein fehlerhafter Body, ein Feld, das die Prüfung nicht besteht, ein unbekanntes Feld, ein fehlender Parameter, ein unbekannter Dienst |
| 401 | Keine Sitzung, eine abgelaufene, oder ein falsches Passwort bei der Anmeldung |
| 403 | Dem Benutzer fehlt die Berechtigung, oder das Schreib-Gate hat den Schreibvorgang aus Richtliniengründen abgelehnt: Schreiben ausgeschaltet, Tag nicht scharfgeschaltet, Entität deaktiviert |
| 404 | Was im Pfad oder im Body benannt ist, existiert nicht |
| 409 | Es existiert schon, oder es ist in einem Zustand, der das nicht zulässt: ein Alarm, der nicht ausgeblendet ist, ein Knoten, der noch Kinder hat, eine Entität ohne bekannten Zustand zum Umschalten, ein Skript, das schon läuft, ein Rezept, das abgelehnt wurde oder schon angewendet wird |
| 422 | Ein Wert, den das Schreib-Gate inhaltlich abgelehnt hat: außerhalb des Bereichs des Tags, neben der Schrittweite einer Entität |
| 502 | Das Gerät hat mit einem eigenen Fehler geantwortet, und der Body enthält seine Worte; oder ein Rezept wurde gestartet und nicht alle Ziele wurden erreicht, und der Body sagt, welche hinausgingen und welche nicht |
| 503 | Das Gerät ist nicht verbunden, oder die Alarm-Engine läuft nicht |
| 500 | Ein Fehler im Server. Der Body ist `internal error (ref …); the server log has the detail under that ref` und sonst nichts, und das Log enthält den ganzen Fehler unter dieser Referenz. Der einzige 500 mit einer echten Meldung ist ein Tastendruck, dessen Loslassen nicht hinausging, weil diese Meldung genau sagt, was zu prüfen ist |

Alles, was die API nicht einordnen kann, ist ein 500, nie ein 400. Ein Datenbankausfall, der als 400 beantwortet wird, sagt dem Bediener, er habe etwas falsch eingegeben, und er sucht einen Tippfehler, den es nicht gibt.

Zwei Fehler kommen nicht von der API und sind Klartext, kein JSON: Ein Pfad, der zu keiner Route passt, antwortet `404 page not found`, und ein bekannter Pfad mit der falschen Methode antwortet `405 method not allowed`.

Ein abgelehnter Schreibvorgang ist nie ein 500. Ein Anlagenbildschirm, der eine Richtlinienablehnung als Serverfehler zeigt, bringt den Bedienern bei, Fehler zu ignorieren.

### Bodys

Anfrage-Bodys sind JSON, höchstens 4 MiB (bei einem eingehenden Webhook 1 MiB). **Unbekannte Felder werden abgelehnt**, nicht ignoriert:

```json
{"error":"request body: json: unknown field \"x\""}
```

Eine falsch geschriebene Einstellung, die stillschweigend verworfen wird, sieht genau aus wie eine, die funktioniert hat, deshalb sagt der Decoder nein.

`POST` und `PUT` auf Geräte, Tags, Alarme, Automatisierungen, Flottenmitglieder und Berichte ersetzen das ganze Objekt: Ein weggelassenes Feld nimmt seinen Nullwert an, und ein weggelassener Boolean ist `false`. Lesen, ändern, zurücksenden. Die Ausnahmen sind die `PUT` für Entitäten und Anlagen, die nur die gesendeten Felder ändern, und die Gerätezugangsdaten, die beim Weglassen erhalten bleiben (siehe unten).

### Geheimnisse sind nur schreibbar

Ein in einem Gerät gespeicherter Zugang (ein Broker-Passwort, ein HTTP-Header, ein Passwort in der Adresse) wird nie zurückgesendet, an keine Rolle, auch nicht an den Administrator. Er erscheint als `[redacted]`:

```json
"config": {"clientId": "docs-api-tankfarm", "password": "[redacted]", "username": "tank"}
```

Wenn Sie das Gerät speichern, senden Sie den Platzhalter (oder lassen Sie den Schlüssel weg), um den gespeicherten Wert zu behalten, senden Sie einen neuen Wert, um ihn zu ersetzen, und senden Sie `""` oder `null`, um ihn zu löschen. Ein neues Gerät kann nicht mit dem Platzhalter gespeichert werden, und ein Speichern, das das Gerät mit einem behaltenen Zugang auf einen anderen Host umstellt, wird abgelehnt, damit ein gespeichertes Passwort nicht zu einem fremden Listener getragen werden kann. Die vollständigen Regeln stehen unter [Authentifizierung und Benutzer](/de/iot/authentication/#gerätezugangsdaten-sind-nur-schreibbar). Dasselbe gilt für jeden anderen Zugang, den das Gateway hält: Die Einstellungen zeigen `set` oder `not set`, die Diagnose entfernt Zugangsdaten aus ausgehenden MCP-Zielen, und nichts in dieser API liefert einen Passwort-Hash oder einen Sitzungstoken zurück, außer dem einen, den die Anmeldung Ihnen gibt.

### camelCase, außer wo es snake_case ist

Der größte Teil der API ist camelCase (`deviceId`, `pollIntervalMs`, `createdAt`), wie seit der ersten Version und wie es der `TagValue`-Vertrag des EmberNet-Dashboards verlangt.

Die Endpunkte für Entitäten, Zustände, Dienste, Anlagen und Bezeichnungen sind snake_case (`entity_id`, `last_changed`, `parent_id`, `label_id`). Das ist Absicht: Die Entitäten-API nutzt die gängige Form von Entität, Zustand und Dienst, damit alles, was sie schon spricht, auch diese spricht, und der Anlagenbaum ist das Bereichsregister des Entitätenmodells, geformt für dieselben Abnehmer. Wo beide aufeinandertreffen, behält jede Seite ihre eigene Schreibweise: Ein Gerät hat `equipmentId`, eine Entität hat `equipment_id`.

### Zeiten, Dauern und Tag-Schlüssel

- **Zeitstempel** sind RFC 3339 in UTC, mit Sekundenbruchteilen, wenn es welche gibt: `2026-09-27T20:21:58.255869Z`. Die Einstellung der Anzeigezeitzone ändert, was die Oberfläche zeigt, nie, was die API zurückgibt.
- **Eine Zeit, die noch nicht eingetreten ist, wird weggelassen.** Eine Regel, die nie gelaufen ist, hat kein `lastRun`, ein nie abgefragtes Gerät hat weder `lastPoll` noch `lastGood`, ein Alarm, den niemand quittiert hat, hat kein `ackedAt`, ein nie gesehenes Flottenmitglied hat kein `lastSeen`. Ein fehlendes Zeitfeld bedeutet nie. Die Nullzeit von Go, `0001-01-01T00:00:00Z`, sehen Sie nie in einer Antwort oder einem Stream-Ereignis. Ein Dutzend Felder schickte sie früher, und der Automatisierungsbildschirm zeigte eine nie gelaufene Regel als zuletzt vor 739887 Tagen gelaufen. Ein Test liest jede Route und jedes Zeitfeld im Code, damit das so bleibt.
- **Sparklines** sind die Ausnahme: Dort ist `timestamps` in Unix-Millisekunden, weil es direkt in ein Diagramm geht.
- **Dauern** nennen ihre Einheit im Namen: `pollIntervalMs`, `onDelaySec`, `minutes`, `durationMs`. `uptime` im Status ist ein Go-Dauer-String (`11m13s`).
- **Ein Tag-Schlüssel** ist `device/tag`, die Form, die jeder `?tag=`-Parameter und jedes `tag`-Feld annimmt. Tag-Namen dürfen Schrägstriche enthalten (OPC-UA-Pfade, MQTT-Topics), deshalb trennt nur der erste Schrägstrich: `plc-1/Line/Zone 1` ist der Tag `Line/Zone 1` auf dem Gerät `plc-1`.
- **Ein numerischer Abfrageparameter**, der keine Zahl ist, wird ignoriert und der Standardwert verwendet, also ist `?limit=abc` dasselbe wie ein nicht gesetztes `?limit`.
- **Leere Listen** sind `[]`, nie `null`, in jeder Antwort und jedem Stream-Ereignis, in jeder Tiefe. Vor `.length` brauchen Sie keine Null-Prüfung. Ein `null`, das Sie sehen, ist nie eine Liste: Es ist eines der dokumentierten Felder, die null sein dürfen, wie das `equipment_id` einer Entität oder das `parent_id` eines Wurzelknotens. Ein als optional markiertes Listenfeld kann trotzdem ganz fehlen.

### Optionale Funktionen

Flotte, Benachrichtigungen, Sicherungen und geplante Berichte sind aus, solange ihre Variable `HOTLOOP_*_ENABLED` nicht gesetzt ist. Bei ausgeschalteter Funktion antwortet ihre Listenroute trotzdem mit 200, mit `"configured": false` und einer leeren Liste, damit ein Bildschirm »nicht aktiviert« statt »hier ist nichts« sagen kann. Jede andere Route dieser Funktion antwortet mit 400 und einem Fehler, der die Variable nennt:

```json
{"error":"backups are not enabled (HOTLOOP_BACKUP_ENABLED)"}
```

`GET /api/sites` verhält sich genauso, wenn keine ausgehenden MCP-Server konfiguriert sind.

### Nicht in diesem Produkt

HotLoop wird als IoT, Edge, Gateway und Edge Relay aus einer Codebasis geliefert, und eine Funktion, die ein Produkt nicht hat, ist nicht ausgeschaltet, sie ist nicht in der Binärdatei. Bei IoT, Edge und Gateway antworten ihre Routen nach derselben Berechtigungsprüfung trotzdem, mit einem 404, der das sagt und beide Enden nennt, damit ein Skript »falsche Box« von »falsche URL« unterscheiden kann:

```json
{"error":"scheduled reports are part of HotLoop Gateway; this is HotLoop IoT","product":"iot","feature":"reports"}
```

Kein 400, weil es keine Variable gibt, die das behebt, und kein 5xx, weil nichts schiefgegangen ist. `GET /api/status` sagt gleich zu Beginn, welches Produkt geantwortet hat und welche Funktionen es hat, damit ein Client fragen kann, statt zu probieren.

### Alles, was etwas ändert, wird protokolliert

Jedes Anlegen, Ändern, Löschen, Schreiben, Quittieren und Anmelden landet mit dem Namen des Benutzers im Systemprotokoll (`GET /api/events`), und jeder Schreibvorgang auf einen Tag, abgelehnt oder nicht, landet im Schreib-Audit (`GET /api/writes`). Die API hat keinen stillen Weg.

## Berechtigungen

Wer was hat. Ein Konto mit ausdrücklicher Berechtigungsliste hat genau das, was sie nennt, statt des Satzes seiner Rolle. `*` gewährt alles und `resource.*` gewährt alles unter einer Ressource (`reports.*`). Die Rolle admin ist `*`.

| Berechtigung | viewer | operator | admin |
|---|---|---|---|
| `status.read` | ja | ja | ja |
| `devices.read` | ja | ja | ja |
| `devices.write` | nein | nein | ja |
| `tags.read` | ja | ja | ja |
| `tags.write` | nein | nein | ja |
| `values.read` | ja | ja | ja |
| `values.write` | nein | ja | ja |
| `board.write` | nein | ja | ja |
| `entities.read` | ja | ja | ja |
| `entities.write` | nein | nein | ja |
| `helpers.write` | nein | ja | ja |
| `equipment.read` | ja | ja | ja |
| `equipment.write` | nein | nein | ja |
| `alarms.read` | ja | ja | ja |
| `alarms.write` | nein | nein | ja |
| `alarms.ack` | nein | ja | ja |
| `automations.read` | ja | ja | ja |
| `automations.write` | nein | nein | ja |
| `automations.trigger` | nein | ja | ja |
| `scripts.read` | ja | ja | ja |
| `scripts.run` | nein | ja | ja |
| `scripts.write` | nein | nein | ja |
| `recipes.read` | ja | ja | ja |
| `recipes.apply` | nein | ja | ja |
| `recipes.write` | nein | nein | ja |
| `blueprints.read` | ja | ja | ja |
| `blueprints.apply` | nein | ja | ja |
| `blueprints.write` | nein | nein | ja |
| `dashboards.read` | ja | ja | ja |
| `dashboards.write` | nein | nein | ja |
| `energy.read` | ja | ja | ja |
| `energy.write` | nein | nein | ja |
| `fleet.read` | ja | ja | ja |
| `fleet.write` | nein | ja | ja |
| `fleet.rebirth` | nein | ja | ja |
| `fleet.restart` | nein | nein | ja |
| `fleet.update` | nein | nein | ja |
| `fleet.config` | nein | nein | ja |
| `notify.test` | nein | nein | ja |
| `notify.escalation` | nein | nein | ja |
| `backup.read` | nein | nein | ja |
| `backup.run` | nein | nein | ja |
| `reports.read` | ja | ja | ja |
| `reports.run` | nein | ja | ja |
| `reports.write` | nein | nein | ja |
| `sites.read` | ja | ja | ja |
| `settings.read` | ja | ja | ja |
| `settings.write` | nein | nein | ja |
| `events.read` | ja | ja | ja |
| `logbook.read` | ja | ja | ja |
| `users.manage` | nein | nein | ja |

Die Trennlinie ist überall dieselbe: Ein Bediener fährt die Anlage (schreibt Werte, quittiert Alarme, löst Automatisierungen aus, stupst ein Relais an), und nur ein Administrator ändert, wie die Anlage konfiguriert ist, oder tut im Auftrag des Gateways etwas nach außen (ein Relay neu starten, ihm seine Konfiguration schicken, eine Testseite senden, einen Bericht definieren, der Anlagendaten irgendwohin mailt).

## Endpunkt-Index

Die Spalte Berechtigung sagt, was die Route prüft. `session` heißt jeder angemeldete Benutzer, ohne weitere Berechtigung. `none` heißt, dass auch keine Sitzung nötig ist, und der Abschnitt sagt, warum. `(in handler)` heißt, dass die Prüfung im Handler und nicht davor stattfindet, und der Abschnitt sagt, warum.

Die Spalte Produkt nennt das kleinste HotLoop, das die Route hat: `all` ist IoT, Edge und Gateway, `edge` ist Edge und Gateway, `gateway` ist das Gateway allein. Jedes Produkt registriert jede Route und prüft dieselbe Berechtigung darauf. Bei einem Produkt, das sie nicht hat, antwortet die Route mit 404 und sagt, wo sie liegt; siehe [Nicht in diesem Produkt](#nicht-in-diesem-produkt).

| Methode | Pfad | Berechtigung | Produkt |
|---|---|---|---|
| `GET` | `/healthz` | none | all |
| `GET` | `/readyz` | none | all |
| `POST` | `/api/auth/login` | none | all |
| `POST` | `/api/auth/kiosk` | none | all |
| `POST` | `/api/auth/logout` | session | all |
| `POST` | `/api/auth/activity` | session | all |
| `GET` | `/api/auth/session` | session | all |
| `POST` | `/api/auth/password` | session | all |
| `GET` | `/api/users` | `users.manage` | all |
| `POST` | `/api/users` | `users.manage` | all |
| `PUT` | `/api/users/{username}` | `users.manage` | all |
| `DELETE` | `/api/users/{username}` | `users.manage` | all |
| `POST` | `/api/users/{username}/password` | `users.manage` | all |
| `DELETE` | `/api/users/{username}/lockout` | `users.manage` | all |
| `PUT` | `/api/users/{username}/pin` | `users.manage` | all |
| `DELETE` | `/api/users/{username}/pin` | `users.manage` | all |
| `GET` | `/api/opcua/certificates` | `users.manage` | all |
| `GET` | `/api/users/{username}/certificates` | `users.manage` | all |
| `POST` | `/api/users/{username}/certificates` | `users.manage` | all |
| `POST` | `/api/users/{username}/certificates/{thumbprint}/revoke` | `users.manage` | all |
| `DELETE` | `/api/users/{username}/certificates/{thumbprint}` | `users.manage` | all |
| `GET` | `/api/status` | `status.read` | all |
| `GET` | `/api/protocols` | `status.read` | all |
| `GET` | `/api/diagnostics` | `status.read` | all |
| `GET` | `/api/devices` | `devices.read` | all |
| `POST` | `/api/devices` | `devices.write` | all |
| `GET` | `/api/devices/{id}` | `devices.read` | all |
| `DELETE` | `/api/devices/{id}` | `devices.write` | all |
| `POST` | `/api/devices/{id}/enabled` | `devices.write` | all |
| `POST` | `/api/devices/{id}/browse` | `devices.read` | all |
| `POST` | `/api/devices/{id}/import` | `tags.write` | all |
| `GET` | `/api/devices/{id}/network` | `devices.read` | all |
| `PUT` | `/api/devices/{id}/network` | `devices.write` | all |
| `DELETE` | `/api/devices/{id}/network` | `devices.write` | all |
| `GET` | `/api/unifi/{id}/networks` | `devices.read` | all |
| `PUT` | `/api/unifi/{id}/networks/{network}` | `devices.write` | all |
| `POST` | `/api/unifi/{id}/networks/{network}/accept-all` | `devices.write` | all |
| `GET` | `/api/unifi/{id}/known` | `devices.read` | all |
| `PUT` | `/api/unifi/{id}/networks/{network}/known/{mac}` | `devices.write` | all |
| `DELETE` | `/api/unifi/{id}/networks/{network}/known/{mac}` | `devices.write` | all |
| `GET` | `/api/unifi/{id}/clients` | `devices.read` | all |
| `GET` | `/api/unifi/consoles` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/overview` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/topology` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/devices` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/wifi` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/events` | `devices.read` | all |
| `POST` | `/api/unifi/{id}/starter-alarms` | `alarms.write` | all |
| `GET` | `/api/discovery` | `devices.read` | all |
| `GET` | `/api/discovery/{source}/{key}` | `devices.read` | all |
| `POST` | `/api/discovery/{source}/{key}/accept` | `devices.write` | all |
| `POST` | `/api/discovery/{source}/{key}/ignore` | `devices.write` | all |
| `POST` | `/api/discovery/{source}/{key}/unignore` | `devices.write` | all |
| `POST` | `/api/discovery/{source}/{key}/review/apply` | `devices.write` | all |
| `POST` | `/api/discovery/{source}/{key}/review/reject` | `devices.write` | all |
| `GET` | `/api/network-discovery` | `devices.read` | all |
| `GET` | `/api/network-discovery/{key}` | `devices.read` | all |
| `POST` | `/api/network-discovery/{key}/accept` | `devices.write` | all |
| `POST` | `/api/network-discovery/{key}/ignore` | `devices.write` | all |
| `POST` | `/api/network-discovery/{key}/unignore` | `devices.write` | all |
| `POST` | `/api/network-discovery/probe` | `devices.write` | all |
| `GET` | `/api/integrations` | `devices.read` | all |
| `POST` | `/api/integrations/{id}/probe` | `devices.write` | all |
| `POST` | `/api/integrations/{id}/setup` | `devices.write` | all |
| `GET` | `/api/broker/logins` | `users.manage` | all |
| `POST` | `/api/broker/logins` | `users.manage` | all |
| `PUT` | `/api/broker/logins/{name}` | `users.manage` | all |
| `DELETE` | `/api/broker/logins/{name}` | `users.manage` | all |
| `GET` | `/api/mqtt/brokers` | `devices.read` | all |
| `POST` | `/api/mqtt/brokers` | `devices.write` | all |
| `PUT` | `/api/mqtt/brokers/{id}` | `devices.write` | all |
| `DELETE` | `/api/mqtt/brokers/{id}` | `devices.write` | all |
| `GET` | `/api/tags` | `tags.read` | all |
| `POST` | `/api/tags` | `tags.write` | all |
| `DELETE` | `/api/tags/{device}/{name}` | `tags.write` | all |
| `GET` | `/api/values` | `values.read` | all |
| `GET` | `/api/sparkline` | `values.read` | all |
| `GET` | `/api/board` | `values.read` | all |
| `PUT` | `/api/board` | `board.write` | all |
| `POST` | `/api/write` | `values.write` | all |
| `GET` | `/api/history` | `values.read` | all |
| `GET` | `/api/writes` | `values.read` | all |
| `GET` | `/api/entities` | `entities.read` | all |
| `GET` | `/api/entities/composites` | `entities.read` | all |
| `GET` | `/api/entities/{entity_id}` | `entities.read` | all |
| `GET` | `/api/entities/{entity_id}/image` | `entities.read` | all |
| `PUT` | `/api/entities/{entity_id}` | `entities.write` | all |
| `POST` | `/api/entities` | `entities.write` | all |
| `DELETE` | `/api/entities/{entity_id}` | `entities.write` | all |
| `GET` | `/api/states` | `entities.read` | all |
| `GET` | `/api/states/{entity_id}` | `entities.read` | all |
| `GET` | `/api/energy/meters` | `energy.read` | all |
| `POST` | `/api/energy/meters` | `energy.write` | all |
| `GET` | `/api/energy/meters/{id}` | `energy.read` | all |
| `PUT` | `/api/energy/meters/{id}` | `energy.write` | all |
| `DELETE` | `/api/energy/meters/{id}` | `energy.write` | all |
| `GET` | `/api/energy/summary` | `energy.read` | all |
| `GET` | `/api/energy/summary/{period}` | `energy.read` | all |
| `GET` | `/api/energy/series` | `energy.read` | all |
| `GET` | `/api/energy/series/{meter}/{period}/{step}` | `energy.read` | all |
| `POST` | `/api/services/{domain}/{service}` | `values.write`, `alarms.ack`, `helpers.write`, `scripts.run`, `recipes.apply` (in handler) | all |
| `GET` | `/api/helpers` | `entities.read` | all |
| `POST` | `/api/helpers` | `entities.write` | all |
| `GET` | `/api/helpers/{entity_id}` | `entities.read` | all |
| `PUT` | `/api/helpers/{entity_id}` | `entities.write` | all |
| `DELETE` | `/api/helpers/{entity_id}` | `entities.write` | all |
| `GET` | `/api/equipment` | `equipment.read` | all |
| `POST` | `/api/equipment` | `equipment.write` | all |
| `GET` | `/api/equipment/{id}` | `equipment.read` | all |
| `PUT` | `/api/equipment/{id}` | `equipment.write` | all |
| `DELETE` | `/api/equipment/{id}` | `equipment.write` | all |
| `GET` | `/api/labels` | `equipment.read` | all |
| `POST` | `/api/labels` | `equipment.write` | all |
| `GET` | `/api/labels/{label_id}` | `equipment.read` | all |
| `PUT` | `/api/labels/{label_id}` | `equipment.write` | all |
| `DELETE` | `/api/labels/{label_id}` | `equipment.write` | all |
| `PUT` | `/api/devices/{id}/labels` | `equipment.write` | all |
| `GET` | `/api/alarms` | `alarms.read` | all |
| `POST` | `/api/alarms` | `alarms.write` | all |
| `POST` | `/api/alarms/import/codesys` | `alarms.write` | all |
| `DELETE` | `/api/alarms/{id}` | `alarms.write` | all |
| `POST` | `/api/alarms/{id}/ack` | `alarms.ack` | all |
| `POST` | `/api/alarms/{id}/shelve` | `alarms.ack` | all |
| `POST` | `/api/alarms/{id}/unshelve` | `alarms.ack` | all |
| `GET` | `/api/alarms/events` | `alarms.read` | all |
| `GET` | `/api/automations` | `automations.read` | all |
| `POST` | `/api/automations` | `automations.write` | all |
| `POST` | `/api/automations/validate` | `automations.write` | all |
| `DELETE` | `/api/automations/{id}` | `automations.write` | all |
| `POST` | `/api/automations/{id}/enabled` | `automations.write` | all |
| `POST` | `/api/automations/{id}/trigger` | `automations.trigger` | all |
| `GET` | `/api/runs` | `automations.read` | all |
| `POST` | `/api/automations/{id}/blueprint-upgrade` | `blueprints.apply` | all |
| `GET` | `/api/blueprints` | `blueprints.read` | all |
| `POST` | `/api/blueprints` | `blueprints.write` | all |
| `GET` | `/api/blueprints/{id}` | `blueprints.read` | all |
| `PUT` | `/api/blueprints/{id}` | `blueprints.write` | all |
| `DELETE` | `/api/blueprints/{id}` | `blueprints.write` | all |
| `POST` | `/api/blueprints/{id}/instantiate` | `blueprints.apply` | all |
| `GET` | `/api/dashboards` | `dashboards.read` | all |
| `POST` | `/api/dashboards` | `dashboards.write` | all |
| `GET` | `/api/dashboards/{id}` | `dashboards.read` | all |
| `PUT` | `/api/dashboards/{id}` | `dashboards.write` | all |
| `DELETE` | `/api/dashboards/{id}` | `dashboards.write` | all |
| `GET` | `/api/dashboards/{id}/export` | `dashboards.read` | all |
| `POST` | `/api/dashboards/import` | `dashboards.write` | all |
| `GET` | `/api/scripts` | `scripts.read` | all |
| `POST` | `/api/scripts` | `scripts.write` | all |
| `POST` | `/api/scripts/validate` | `scripts.write` | all |
| `GET` | `/api/scripts/{id}` | `scripts.read` | all |
| `PUT` | `/api/scripts/{id}` | `scripts.write` | all |
| `DELETE` | `/api/scripts/{id}` | `scripts.write` | all |
| `POST` | `/api/scripts/{id}/run` | `scripts.run` | all |
| `POST` | `/api/scripts/{id}/stop` | `scripts.run` | all |
| `GET` | `/api/scripts/{id}/runs` | `scripts.read` | all |
| `GET` | `/api/recipes` | `recipes.read` | all |
| `POST` | `/api/recipes` | `recipes.write` | all |
| `POST` | `/api/recipes/capture` | `recipes.write` | all |
| `GET` | `/api/recipes/{id}` | `recipes.read` | all |
| `PUT` | `/api/recipes/{id}` | `recipes.write` | all |
| `DELETE` | `/api/recipes/{id}` | `recipes.write` | all |
| `GET` | `/api/recipes/{id}/versions` | `recipes.read` | all |
| `GET` | `/api/recipes/{id}/versions/{version}` | `recipes.read` | all |
| `POST` | `/api/recipes/{id}/validate` | `recipes.apply` | all |
| `POST` | `/api/recipes/{id}/apply` | `recipes.apply` | all |
| `GET` | `/api/recipes/{id}/applications` | `recipes.read` | all |
| `POST` | `/api/webhook/{path}` | none | all |
| `GET` | `/api/fleet` | `fleet.read` | gateway |
| `POST` | `/api/fleet` | `fleet.write` | gateway |
| `DELETE` | `/api/fleet/{id}` | `fleet.write` | gateway |
| `POST` | `/api/fleet/{id}/rebirth` | `fleet.rebirth` | gateway |
| `POST` | `/api/fleet/{id}/restart` | `fleet.restart` | gateway |
| `POST` | `/api/fleet/{id}/update` | `fleet.update` | gateway |
| `POST` | `/api/fleet/{id}/config` | `fleet.config` | gateway |
| `DELETE` | `/api/fleet/{id}/config` | `fleet.config` | gateway |
| `POST` | `/api/notify/test` | `notify.test` | all |
| `GET` | `/api/notify/escalation` | `notify.escalation` | all |
| `PUT` | `/api/notify/escalation` | `notify.escalation` | all |
| `POST` | `/api/notify/ack/{token}` | none | all |
| `GET` | `/api/backup` | `backup.read` | all |
| `POST` | `/api/backup` | `backup.run` | all |
| `GET` | `/api/reports` | `reports.read` | gateway |
| `POST` | `/api/reports` | `reports.write` | gateway |
| `GET` | `/api/reports/{id}` | `reports.read` | gateway |
| `PUT` | `/api/reports/{id}` | `reports.write` | gateway |
| `DELETE` | `/api/reports/{id}` | `reports.write` | gateway |
| `POST` | `/api/reports/{id}/run` | `reports.run` | gateway |
| `GET` | `/api/reports/{id}/runs` | `reports.read` | gateway |
| `GET` | `/api/reports/{id}/runs/{run}/download` | `reports.read` | gateway |
| `GET` | `/api/sites` | `sites.read` | gateway |
| `GET` | `/api/settings` | `settings.read` | all |
| `PUT` | `/api/settings` | `settings.write` | all |
| `GET` | `/api/historian/targets` | `settings.read` | all |
| `POST` | `/api/historian/targets` | `settings.write` | all |
| `PUT` | `/api/historian/targets/{id}` | `settings.write` | all |
| `DELETE` | `/api/historian/targets/{id}` | `settings.write` | all |
| `GET` | `/api/events` | `events.read` | all |
| `GET` | `/api/logbook` | `logbook.read` | all |
| `GET` | `/api/stream` | `status.read` | all |
| beliebig | `/mcp` | MCP-Token | all |
| beliebig | `/mcp/` | MCP-Token | all |
| `GET` | `/manifest.webmanifest` | none | all |
| `GET` | `/sw.js` | none | all |
| `GET` | `/next` | none | all |
| `GET` | `/next/` | none | all |
| beliebig | `/` | none | all |

## Zustand

Für den kubelet und Load Balancer. Keiner braucht eine Sitzung: Eine Sonde hat kein Konto, und keine sagt etwas über die Anlage.

### `GET /healthz`

Liveness. `200` mit dem Text `ok`, solange der Prozess HTTP bedient. Sie berührt die Datenbank absichtlich nicht: Ein Datenbankausfall soll den Pod aus der Rotation nehmen, nicht in einer Schleife neu starten.

### `GET /readyz`

Readiness. Pingt die Datenbank mit einem Zeitbudget von 5 Sekunden an.

```json
{"status":"ready"}
```

`503`, wenn sie sie nicht erreicht, mit dem Grund in `detail` (die Form stammt vom Handler; der Grundtext ist das, was der Datenbanktreiber gesagt hat):

```json
{"error":"not ready","detail":"<why the database did not answer>"}
```

Eine Anwendung, die ihren Historian nicht erreicht, sollte keinen Verkehr bekommen.

## Authentifizierung

Siehe [Authentifizierung und Benutzer](/de/iot/authentication/) für Konten, Rollen und den ersten Administrator.

### `POST /api/auth/login`

Keine Sitzung nötig, von Grund auf.

| Feld | Typ | <span class="sr-only">Details</span> |
|---|---|---|
| `username` | string | Pflicht. Groß- und Kleinschreibung und umgebende Leerzeichen werden ignoriert |
| `password` | string | Pflicht |

```json
{"expiresAt":"2026-09-28T08:21:00.571794Z","permissions":["*"],"role":"admin","token":"<token>","username":"admin"}
```

Setzt außerdem das Cookie `iiot_session` auf denselben Token. `401` `"invalid username or password"` bei falschem Namen, falschem Passwort oder deaktiviertem Konto gleichermaßen, und es dauert in jedem Fall gleich lang: Welches der drei es war, sagt man einem Fremden nicht. `429` für ein Konto, das zu viele falsche Passwörter oder PINs hintereinander hatte, was auch gesendet wird, mit einem `Retry-After`-Header; siehe [Authentifizierung und Benutzer](/de/iot/authentication/#die-sperre-nach-falschen-passwörtern-und-pins).

### `POST /api/auth/kiosk`

Anmeldung an einem gemeinsamen Panel mit PIN oder Ausweis, wie [Authentifizierung und Benutzer](/de/iot/authentication/#kiosk-bedienfelder-pin-oder-ausweis-und-automatische-abmeldung) es beschreibt. Keine Sitzung nötig, von Grund auf.

| Feld | Typ | <span class="sr-only">Details</span> |
|---|---|---|
| `code` | string | Pflicht. Die PIN oder der Wert, den ein Ausweisleser im Tastaturmodus getippt hat. Umgebende Leerzeichen werden ignoriert |
| `username` | string | Optional. Mit ihm wird nur die PIN dieses Kontos geprüft, und eine falsche zählt für die Sperre dieses Kontos. Ohne ihn wird der Code unter allen Konten gesucht |

```json
{"expiresAt":"2026-10-21T08:21:00.571794Z","idleSec":300,"permissions":["status.read","tags.read"],"role":"operator","username":"olga"}
```

Setzt das Cookie `iiot_session` und antwortet, anders als `POST /api/auth/login`, nicht mit dem Token: Eine Kiosk-Sitzung gehört dem Browser am Panel. `idleSec` ist, wie lange die Sitzung überlebt, ohne dass jemand sie berührt. `401` `"that PIN or badge isn't recognized"` bei falschem Code, zu kurzem Code und dem Code eines deaktivierten Kontos gleichermaßen, und es dauert in jedem Fall gleich lang. `429`, wenn das Konto gesperrt ist (siehe [Die Sperre](/de/iot/authentication/#die-sperre-nach-falschen-passwörtern-und-pins)), mit einem `Retry-After`-Header. Ein ohne `username` gesendeter Code, der zu niemandem passt, zählt gegen kein Konto; das Panel, das ihn gesendet hat, wartet nach Client-Adresse eine halbe Sekunde länger, bevor sein nächster solcher Versuch geprüft wird, bis zu `ui.panelDelaySeconds`, und ein richtiger setzt das zurück. Das Panel wird nie gesperrt. `400`, wenn die Installation ohne Anmeldung läuft (`HOTLOOP_AUTH_INSECURE`), denn dann gibt es niemanden, als den man sich anmelden könnte.

### `POST /api/auth/activity`

Jemand hat das Panel berührt. Kein Body. `{"status":"ok"}`. Bei einer Kiosk-Sitzung verschiebt das ihr Leerlauflimit; das tut auch jede andere Anfrage, die kein Lesen ist (ein Schreiben, ein Quittieren). Ein `GET`, der Live-Feed und die Hintergrundladevorgänge der Seite selbst tun das nicht: Sie würden sonst die letzte Person für immer angemeldet lassen. Eine mit Passwort erstellte Sitzung hat kein Leerlauflimit und nichts zu verschieben.

### `POST /api/auth/logout`

Beendet die Sitzung, mit der die Anfrage kam (Cookie oder Bearer), und löscht das Cookie. Kein Body. `{"status":"logged out"}`.

### `GET /api/auth/session`

Wer bin ich. Für den Startablauf der Oberfläche.

```json
{"authenticated":true,"permissions":["*"],"role":"admin","username":"admin"}
```

Eine an einem Kiosk-Panel erstellte Sitzung fügt `"idleSec"` hinzu, ihr Leerlauflimit in Sekunden, woran die Seite erkennt, dass sie sich selbst abmelden muss.

Bei ausgeschalteter Authentifizierung (`HOTLOOP_AUTH_INSECURE`) antwortet sie `{"authenticated":false,"insecure":true}` statt eines 401, damit die Oberfläche sagen kann, warum es keine Anmeldung gibt, statt zu raten.

### `POST /api/auth/password`

Ändert das eigene Passwort. Keine Berechtigung: Das aktuelle Passwort zu kennen ist die Berechtigung.

| Feld | Typ | <span class="sr-only">Details</span> |
|---|---|---|
| `currentPassword` | string | Pflicht |
| `newPassword` | string | Pflicht, mindestens 8 Zeichen |

`{"status":"password changed; log in again"}`. **Jede Sitzung des Kontos endet, auch diese**, und das Cookie wird gelöscht: Eine Passwortänderung, bei der die alten Sitzungen weiterlaufen, ist nur dem Namen nach eine Änderung. `401`, wenn das aktuelle Passwort falsch ist, `400`, wenn das neue zu kurz ist.

## Benutzer

Alles nur für Administratoren (`users.manage`). Passwort-Hashes erscheinen nie in einer Antwort; das Feld hat keinen JSON-Namen.

### `GET /api/users`

```json
[{"username":"admin","role":"admin","disabled":false,"hasPin":false,"locked":false,"createdAt":"2026-09-27T20:19:28.036228Z","updatedAt":"2026-09-27T20:19:28.036228Z","lastLogin":"2026-09-27T20:21:00.575455Z"}]
```

`permissions` erscheint nur bei einem Konto mit ausdrücklicher Liste. `hasPin` sagt, ob das Konto eine Kiosk-PIN oder einen Ausweis hat; der Wert und sein Hash erscheinen nie.

### `POST /api/users`

| Feld | Typ | <span class="sr-only">Details</span> |
|---|---|---|
| `username` | string | Pflicht. Kleinbuchstaben, Ziffern, Punkt, Unterstrich, Bindestrich, beginnend mit einem Buchstaben oder einer Ziffer, 2 bis 64 Zeichen |
| `password` | string | Pflicht, mindestens 8 Zeichen |
| `role` | string | `admin`, `operator` oder `viewer`. Standard ist `viewer` |
| `permissions` | string[] | Optional. Ersetzt den Satz der Rolle vollständig |

Antwortet mit dem neuen Benutzer. `400` bei falschem Namen, falscher Rolle oder falschem Passwort, `409`, wenn der Name vergeben ist.

### `PUT /api/users/{username}`

| Feld | Typ | <span class="sr-only">Details</span> |
|---|---|---|
| `role` | string | Pflicht, außer `permissions` ist gesetzt |
| `permissions` | string[] | Optional. Leer bedeutet »die Rolle verwenden« |
| `disabled` | bool | `true` deaktiviert das Konto und beendet jede Sitzung, die es hat |

Antwortet mit dem aktualisierten Benutzer. `400` bei unbekannter Rolle oder beim Deaktivieren des letzten aktivierten Administrators: Das wäre eine Aussperrung, und niemand wäre übrig, sie rückgängig zu machen. `404` bei unbekanntem Benutzer.

### `DELETE /api/users/{username}`

`{"status":"deleted"}`. `400` für das eigene Konto oder den letzten aktivierten Administrator, `404` bei unbekanntem Benutzer.

### `POST /api/users/{username}/password`

Ein Administrator setzt das Passwort eines anderen, ohne das alte zu kennen. `{"password": "..."}`, mindestens 8 Zeichen. Antwortet `{"status":"password reset"}` und beendet jede Sitzung dieses Kontos.

### `PUT /api/users/{username}/pin`

Ein Administrator gibt einem Konto eine PIN oder einen Ausweiswert zum Anmelden an einem Kiosk-Panel oder ersetzt die vorhandene. `{"code": "482913"}`: 6 bis 72 Zeichen, keine Leerzeichen oder Steuerzeichen, Ziffern oder alles andere, was ein Ausweisleser tippt. Antwortet `{"status":"PIN set","username":"olga","hasPin":true}`. Der Wert wird wie ein Passwort mit bcrypt gehasht und nie protokolliert oder zurückgesendet. `400` bei einem Code, der zu kurz, zu lang oder mit einem Leerzeichen ist, und bei einem Code, den ein anderes Konto schon hat: Ein Panel findet das Konto allein am Code, also öffnet ein Code ein Konto. `404` bei unbekanntem Benutzer. Es berührt weder das Passwort noch eine Sitzung.

### `DELETE /api/users/{username}/lockout`

Lässt ein gesperrtes Konto vor Ablauf der Sperre wieder hinein und setzt seinen Zähler falscher Passwörter und PINs auf null. `{"status":"unlocked","username":"olga","locked":false}`. `404` bei unbekanntem Benutzer. Ein gesperrtes Konto zeigt `"locked":true` und `"lockedUntil"` in `GET /api/users`.

### `DELETE /api/users/{username}/pin`

Nimmt die PIN oder den Ausweis weg und meldet das Konto an jedem Kiosk-Panel ab, an dem es angemeldet ist. Sein Passwort und seine Sitzungen auf dem eigenen Rechner bleiben unberührt. `{"status":"PIN cleared","username":"olga","hasPin":false}`. `404` bei unbekanntem Benutzer.

### `GET /api/opcua/certificates`

Jedes X.509-Zertifikat, das einem Benutzer für die Anmeldung am OPC-UA-Server zugeordnet ist (siehe [der OPC-UA-Server](/de/edge/opc-ua-server/#x509-user-certificates)), das neueste zuerst: `{"serverAcceptsCertificates":false,"certificates":[...]}`. Jedes hat `thumbprint` (SHA-256 der DER-Form, Hex in Kleinbuchstaben), `username`, `label`, `subject`, `notBefore`, `notAfter`, `addedBy`, `addedAt`, `revokedAt` und `revokedBy` nach dem Widerruf, `lastUsed` nach der Nutzung, und `state`: `active`, `revoked`, `expired` oder `not yet valid`. Nur ein aktives Zertifikat meldet jemanden an. `serverAcceptsCertificates` sagt, ob der OPC-UA-Server läuft und `HOTLOOP_OPCUA_SERVER_ALLOW_X509` gesetzt hat; die Zertifikate werden in beiden Fällen aufbewahrt. Gespeichert oder gesendet wird nur das öffentliche Zertifikat.

### `GET /api/users/{username}/certificates`

Dieselbe Liste für einen Benutzer. `404` bei unbekanntem Benutzer.

### `POST /api/users/{username}/certificates`

Ordnet einem Benutzer ein Zertifikat zu. `{"certificate": "<PEM text or base64 of the DER bytes>", "label": "Olga's laptop"}`; die Bezeichnung ist optional. Antwortet `201` mit dem Zertifikat, wie es aufgelistet wird. Das Zertifikat muss RSA mit einem Schlüssel von mindestens 2048 Bit sein und darf nicht abgelaufen sein. `400` sagt, welcher dieser Punkte es ist, und auch bei etwas, das kein Zertifikat ist: Ein privater Schlüssel wird namentlich abgelehnt und nie behalten oder zurückgegeben, ebenso eine Kette. `404` bei unbekanntem Benutzer. `409`, wenn das Zertifikat schon zugeordnet ist, diesem Benutzer oder einem anderen: Ein Zertifikat ist eine Person. Die Änderung steht im Logbuch mit dem, der sie gemacht hat.

### `POST /api/users/{username}/certificates/{thumbprint}/revoke`

Widerruft ein Zertifikat. Es kann sich nicht mehr anmelden, eine damit geöffnete Sitzung endet innerhalb der 10 Sekunden des Berechtigungs-Caches, und spätere Versuche werden abgelehnt und als widerrufen protokolliert. Es bleibt als `revoked` aufgelistet, mit wem und wann, und ein erneuter Widerruf behält den ersten Eintrag. `{thumbprint}` ist der SHA-256 wie aufgelistet; Doppelpunkte, Leerzeichen und Großbuchstaben werden akzeptiert. `404`, wenn das Zertifikat nicht diesem Benutzer gehört.

### `DELETE /api/users/{username}/certificates/{thumbprint}`

Vergisst ein Zertifikat. Wird es erneut zugeordnet, funktioniert es wieder. `404`, wenn es nicht diesem Benutzer gehört. Das Löschen des Benutzers löscht seine Zertifikate.

## Status und Diagnose

### `GET /api/status`

Die Kopfleiste: Laufzeitzähler, die Alarmübersicht, der Name der Anlage und welches Produkt das ist. `product` ist `iot`, `edge` oder `gateway`, wie bei `hotloop --product`. `features` sagt, welche der Funktionen, die sich zwischen den Produkten unterscheiden, dieses hat: `edge-publish`, `fleet`, `opcua-server`, `reports` und `sites` in einem Gateway, die erste und dritte in Edge, keine in IoT. `version` ist der Build, und `imageDigest` ist der Digest des Images, aus dem es gestartet wurde, was eine Versionsnummer auf einer Box, die `:stable` folgt, nicht sagen kann. Er ist nur da, wenn der Supervisor ihn gesagt hat (die Quadlet-Units tun das vor jedem Start; eine nackte Binärdatei und eine Helm-Installation können es nicht) und fehlt sonst.

```json
{
  "alarms": {"critical":0,"high":1,"medium":0,"low":0,"unacked":0,"total":1},
  "features": ["edge-publish","fleet","opcua-server","reports","sites"],
  "plantName": "Demo Plant",
  "product": "gateway",
  "runtime": {
    "startedAt": "2026-09-27T20:19:28.06635851Z", "uptime": "11m13s",
    "devices": 2, "connected": 2, "degraded": 0, "disconnected": 0,
    "tags": 5, "cachedTags": 5, "writesOk": 4, "writesRefused": 3,
    "bus": {"subscribers":4,"published":653,"dropped":0},
    "historian": {"queued":1085,"written":1085,"filtered":329,"dropped":0,"failed":0,"queueLen":0,"queueCap":50000},
    "writePolicy": {"allowWrites":true,"allowMcpWrites":true,"confirmWrites":true},
    "protocols": ["codesys","ethernet-ip","http","modbus","mqtt","mtconnect","opcua","s7comm","snmp","unifi"]
  },
  "siteId": "docs",
  "version": "4.23.2"
}
```

### `GET /api/protocols`

Jedes Protokoll, das das Gateway kennt, und ob dieser Build seinen Treiber hat.

```json
[{"id":"opcua","name":"OPC UA","description":"The universal one. ...","transport":"opc.tcp binary","defaultPort":4840,"writable":true,"browsable":true,"deviceTypes":["plc","cnc","robot","ipc","hmi","historian","gateway"],"library":"...","available":true}]
```

### `GET /api/diagnostics`

Was der Diagnosebildschirm zeigt: Datenbankpool, Historian-Warteschlange und Verlaufsgröße, der Tag-Bus, die Entitäten-Engine, der Rekorder des Logbuchs, die Laufzeit, MCP (Server und ausgehende Verbindungen) sowie die scharfen Regeln der Automatisierungs-Engine, Webhook-Pfade und die Warteschlange der Zustandsänderungen.

```json
{
  "automations": {"armed":[],"stateChangesDropped":0,"stateChangesPending":0,"webhooks":[]},
  "bus": {"subscribers":4,"published":654,"dropped":0},
  "database": {"type":"postgres","totalConns":3,"idleConns":3,"acquiredConns":0,"maxConns":10,"historyMode":"timescale","timescaleVersion":"2.30.1"},
  "entities": {"entities":8,"droppedBatches":0,"pendingChanges":0,"droppedChanges":0},
  "historian": {"queued":1087,"written":1085,"filtered":329,"dropped":0,"failed":0,"queueLen":0,"queueCap":50000},
  "historyStats": {"mode":"timescale","rows":996,"distinctTags":5,"oldest":"2026-09-27T20:21:38.609853Z","newest":"2026-09-27T20:30:39.507987Z","sizeBytes":73728},
  "logbook": {"recording":true,"retentionDays":90,"queued":0,"dropped":0,"written":212,"suppressed":36,"writeErrors":0},
  "mcp": {"outbound":[],"path":"/mcp","serverEnabled":true,"tokenSet":true},
  "runtime": {"...": "the same block as /api/status"}
}
```

Bei konfigurierten ausgehenden MCP-Servern listet `outbound` jeden auf:

```json
{"name":"plant-a","target":"http://localhost:8080/mcp","connected":true,"tools":["ack_alarm","call_service","...","write_tag"],"connectedSince":"2026-09-27T20:45:50Z"}
```

Jede Zugangsdaten-Angabe im `target` oder `lastError` eines ausgehenden Servers wird entfernt, weil eine URL oder eine Befehlszeile einen Token tragen kann und jede Rolle das hier lesen kann. Der MCP-Token selbst ist immer nur `tokenSet`.

## Geräte

Ein Gerät ist eine Verbindung über ein Protokoll. Was in `config` und `address` steht, hängt vom Protokoll ab: siehe [Protokolle und Treiber](/de/iot/protocols/).

### `GET /api/devices`

Jedes Gerät mit seinem Live-Verbindungszustand. Zugangsdaten sind `[redacted]`. `?q=` behält die Geräte, deren ID, Name, Adresse oder Protokoll den Text enthält (ohne Beachtung der Groß- und Kleinschreibung), `?limit=` (1 bis 5000, alles andere ergibt `400`) die ersten davon; bei einem von beiden sagt `X-Total-Count`, wie viele gepasst haben.

```json
[{"id":"tank-farm","name":"Tank farm","protocol":"mqtt","address":"base-mqtt:1883","enabled":true,
  "site":"Demo Plant","area":"Utilities","equipmentId":4,
  "config":{"clientId":"docs-api-tankfarm","password":"[redacted]","topics":["docs-api-example/#"],"username":"tank","writeTopic":"docs-api-example/{tag}/set"},
  "createdAt":"2026-09-27T20:21:01.637319Z","updatedAt":"2026-09-27T20:21:01.637319Z",
  "state":"connected","lastPoll":"2026-09-27T20:21:39.412Z",
  "latencyMs":0.002,"tagCount":3,"pollCount":1}]
```

`state` ist `connected`, `connecting`, `degraded` (läuft, aber Abfragen schlagen fehl), `disconnected` oder `disabled`. `lastError`, `errorCount` und der Rest erscheinen, wenn es etwas zu sagen gibt.

### `POST /api/devices`

Legt das Gerät an, wenn die `id` neu ist, und ersetzt es sonst. Es gibt kein `PUT`.

| Feld | Typ | <span class="sr-only">Details</span> |
|---|---|---|
| `id` | string | Pflicht. 1 bis 64 Buchstaben, Ziffern, `.`, `_`, `-`, beginnend alphanumerisch. Sie landet in URLs, MQTT-Topics und MCP-Argumenten |
| `name` | string | Pflicht |
| `protocol` | string | Pflicht. Eines, für das dieser Build einen Treiber hat (`GET /api/protocols`) |
| `address` | string | Pflicht. Host und Port oder eine URL `opc.tcp://` oder `http://`: Das Protokoll entscheidet |
| `enabled` | bool | Weggelassen ist es `false` |
| `description` | string | |
| `pollIntervalMs`, `timeoutMs` | int | 0 nimmt den Laufzeit-Standard. Das Abfrageintervall hat als Untergrenze `HOTLOOP_MIN_POLL_INTERVAL` |
| `site`, `area`, `line` | string | Setzt das Gerät per Name in den Anlagenbaum und legt die Knoten bei Bedarf an |
| `equipmentId` | int | Setzt es stattdessen auf einen Knoten des Baums; `site`, `area` und `line` kommen dann vom Knoten. Siehe [der Anlagenbaum und die Bezeichnungen](/de/iot/equipment/) |
| `config` | object | Die eigenen Optionen des Protokolls. Zugangsdaten folgen den [Nur-Schreib-Regeln](#geheimnisse-sind-nur-schreibbar) |

Laufzeitfelder (`state`, `lastPoll`, `tagCount` und so weiter) sind schreibgeschützt; senden Sie sie zurück, werden sie ignoriert. Antwortet mit dem gespeicherten Gerät, geschwärzt. `400` bei einem Protokoll ohne Treiber, einer fehlgeschlagenen Prüfung oder einer Zugangsdatenregel; die Laufzeit lädt sofort damit neu.

```json
{"error":"no driver for protocol \"profibus\"; this build speaks: ethernet-ip, http, modbus, mqtt, mtconnect, opcua, s7comm, snmp, unifi"}
```

### `GET /api/devices/{id}`

Das Gerät, seine Tags und seine Bezeichnungen.

```json
{"device":{"id":"tank-farm","name":"Tank farm","...":"..."},"labels":["critical"],"tags":[{"id":3,"deviceId":"tank-farm","name":"level","...":"..."}]}
```

`tags` ist `[]` bei einem Gerät ohne Tags. `404` bei unbekannter ID.

### `DELETE /api/devices/{id}`

Löscht das Gerät, seine Tags und deren Entitäten. **Sein Verlauf bleibt erhalten.** `{"deleted":"tank-farm"}`, oder `404`.

### `POST /api/devices/{id}/enabled`

`{"enabled": false}` stoppt die Abfrage, ohne etwas zu löschen. Antwortet `{"enabled":false,"id":"tank-farm"}`. `404` bei unbekannter ID.

### `POST /api/devices/{id}/browse`

Fragt das Gerät, welche Punkte es hat. Braucht nur `devices.read`, weil es liest. Kein Body.

```json
{"supported":true,"tags":[{"name":"Plant_Boiler_Temperature","address":"nsu=http://plant/;s=Temperature","dataType":"float","description":"Temperature","writable":true}]}
```

Ein Protokoll, das seine Punkte nicht aufzählen kann (Modbus, S7comm, HTTP), antwortet `200` mit `{"supported":false,"reason":"..."}`: Das ist eine Tatsache über das Protokoll, kein Fehler. `503`, wenn das Gerät nicht verbunden ist. `writable` ist hier, was das Gerät über den Punkt sagt, nicht, ob das Gateway ihn schreiben wird.

### `POST /api/devices/{id}/import`

Macht aus Browse-Ergebnissen konfigurierte Tags. Braucht `tags.write`, weil es Tags anlegt.

```json
{"tags":[{"name":"Temperature","address":"nsu=http://emberburn/;s=Temperature","dataType":"float","unit":"C"}]}
```

Jeder Eintrag nimmt `name`, `address`, `dataType`, `unit`, `description`, `deviceClass` und `writable` (das Browse-Ergebnis, wie es kam). Antwortet `{"inserted":2,"updated":0}`. **Jeder importierte Tag ist schreibgeschützt**, was auch immer das Gerät sagte: Ein entdeckter Punkt ist kein Punkt, von dem jemand entschieden hat, dass er angesteuert werden darf, und die umgekehrte Voreinstellung würde ein paar tausend davon auf einmal scharfschalten. Schalten Sie die, die Sie meinen, mit `POST /api/tags` scharf. `404` bei unbekanntem Gerät.

## UniFi: OT-Netzwerke, Clients und wo ein Gerät im Netzwerk steht

HotLoops eigener Bestand zu UniFi-Standorten. Siehe [UniFi Network](/de/iot/unifi/). `{id}` unter `/api/unifi` ist ein UniFi-Gerät (ein Standort auf einer Konsole); `{network}` ist die eigene ID der Konsole für ein Netzwerk, wie `GET .../networks` sie liefert; `{mac}` akzeptiert jede übliche Schreibweise und wird in Kleinbuchstaben mit Doppelpunkten gespeichert.

**Keiner dieser Aufrufe fragt die Konsole etwas.** Sie lesen den letzten Lesevorgang des Treibers, sodass ein offen gelassener Bildschirm die Konsole nichts kostet. Das heißt auch, dass sie `503` antworten, bis das Gerät einmal gelesen wurde, und immer in einem `--mcp-stdio`-Helfer, der sich nie an einer Konsole anmeldet. Und keiner schreibt auf eine Konsole.

Eine Änderung, die einen Alarm anlegt oder entfernt, sagt das in `change`: `{"alarmsCreated":["unifi-unknown-3f2a9c01b7de"]}`. Das sind gewöhnliche Alarmdefinitionen unter `/api/alarms`.

### `GET /api/devices/{id}/network`

Wo ein HotLoop-Gerät (eine SPS, ein Zähler) im Netzwerk steht. Verknüpft:

```json
{"deviceId":"plc-07","link":{"deviceId":"plc-07","consoleId":"plant-net","mac":"02:48:4c:00:00:07","confirmedBy":"hana","confirmedAt":"2026-09-28T18:02:05Z"},
 "consoleName":"Plant network","client":{"mac":"02:48:4c:00:00:07","ip":"10.77.0.7","switchMac":"00:27:22:e2:1d:6f","switchName":"USW Lite 8 PoE","port":5,"portUp":false,"online":false,"lastSeen":"2026-09-28T18:01:40Z","lastSeenSec":25,"why":"its switch port 5 has no link","...":"..."},
 "readAt":"2026-09-28T18:02:05Z","summary":"on USW Lite 8 PoE port 5, link down; the console last saw it 25s ago; off the network: its switch port 5 has no link","proposals":[]}
```

Nicht verknüpft, ist `link` `null`, und `proposals` listet die Clients, die jede von HotLoop gelesene Konsole unter der IP des Geräts hat, die neuesten zuerst. Ein Vorschlag ist nur das: Die IPs der Konsole hinken hinterher, also wird nichts verknüpft, bis ein Administrator einen bestätigt.

### `PUT /api/devices/{id}/network`

`{"consoleId":"plant-net","mac":"02:48:4c:00:00:07"}` bestätigt, welcher Client das Gerät ist. Von da an ist die MAC der Schlüssel, und der IP wird nie wieder getraut. Der Client bekommt Tags (`c.<mac>.*` auf der Konsole) und einen Alarm, »PLC-07 nicht im Netzwerk«, Priorität 1 mit 120 s Einschaltverzögerung, damit ein Neustart niemanden alarmiert. Antwortet `{"link":{...},"change":{...}}`. `400`, wenn `consoleId` kein UniFi-Gerät ist oder die MAC keine MAC ist, `404` bei unbekanntem Gerät.

### `DELETE /api/devices/{id}/network`

Entfernt die Verknüpfung und den Alarm, den HotLoop dafür angelegt hat, außer der Client wird weiter über eine Liste bekannter Geräte überwacht. `404`, wenn es keine Verknüpfung gab.

### `GET /api/unifi/{id}/networks`

Die Netzwerke des Standorts, wie die Konsole sie hat, mit HotLoops Bestand: `ot`, `known` (wie viele Geräte auf seiner Liste stehen), `clients` (jetzt darauf) und `unknown` (jetzt darauf und nicht auf der Liste). Ein Netzwerk, zu dem HotLoop einen Eintrag hat und das die Konsole nicht mehr hat, kommt mit `"onConsole":false` zurück.

```json
[{"networkId":"6abb23d25a95f2636a5df29c","name":"SCADA","purpose":"corporate","vlan":122,"subnet":"10.122.0.1/24","onConsole":true,"ot":true,"clients":2,"known":1,"unknown":[{"mac":"02:9b:b1:69:88:f2","ip":"10.122.0.66","switchName":"USW Lite 8 PoE","port":6,"...":"..."}],"changedBy":"hana"}]
```

### `PUT /api/unifi/{id}/networks/{network}`

`{"ot": true}` markiert ein Netzwerk als OT. Alles darauf, was nicht auf seiner Liste bekannter Geräte steht, zählt in `n.<network>.unknown` und nennt sich in `.unknown_last`, und HotLoop legt den Alarm »Unbekanntes Gerät im SCADA«, Priorität 1, an. `{"ot": false}` hebt die Markierung auf und entfernt diesen Alarm; die Liste bekannter Geräte bleibt. `400` bei einem WAN oder einem Netzwerk, das die Konsole nicht hat.

### `POST /api/unifi/{id}/networks/{network}/accept-all`

Übernimmt alles, was jetzt im Netzwerk ist, wie es ist: der eine Klick nach dem Markieren. Geräte, die schon auf der Liste stehen, behalten Namen und Überwachung. Kein Body. Antwortet `{"accepted":[{known device}...]}`, die, die es hinzugefügt hat.

### `GET /api/unifi/{id}/known`

Jedes bekannte Gerät in den Netzwerken des Standorts: `[{"deviceId":"plant-net","networkId":"...","mac":"...","name":"PLC-07","watch":true,"acceptedBy":"hana","acceptedAt":"..."}]`.

### `PUT /api/unifi/{id}/networks/{network}/known/{mac}`

`{"name":"PLC-07","watch":true}` übernimmt ein Gerät ins Netzwerk oder ändert seinen Namen oder seine Überwachung. `watch` gibt ihm Tags und den Offline-Alarm; ein Gerät, das zugelassen ist, aber kommt und geht (ein Wartungslaptop), wird ohne ihn übernommen. `400`, wenn das Netzwerk nie als OT markiert wurde.

### `DELETE /api/unifi/{id}/networks/{network}/known/{mac}`

Nimmt ein Gerät von der Liste. Ist es im Netzwerk, ist es beim nächsten Lesen wieder unbekannt.

### `GET /api/unifi/{id}/clients`

Jeder Client, den die Konsole listet, plus jeder überwachte, den sie nicht listet, jeweils mit dem Ort, an dem er sich befindet, ob er online ist, und `ot`, `known`, `watched`, `linkedTo` und einer einzeiligen `summary`. `?q=` schränkt auf eine MAC, IP oder einen Namen ein.

### `GET /api/unifi/consoles`

Jedes UniFi-Gerät, das HotLoop hat, laufend oder nicht, für die Auswahl des UniFi-Bildschirms: `[{"id":"plant-net","name":"Plant network","address":"https://...","enabled":true,"running":true,"site":"default","version":"10.6.106","readAt":"...","devices":4,"online":4,"clients":12,"failover":false,"eventsLive":true}]`. Eine Konsole, die dieser Prozess nicht gelesen hat, sagt in `why`, warum.

### `GET /api/unifi/{id}/overview`

Die Übersichtskarte: Zahlen der Geräte und Clients (ein Client zählt, wenn HotLoop glaubt, dass er im Netzwerk ist, der Test, den die Tags `n.<id>.clients` verwenden, nicht bloß, wenn die Konsole ihn listet), Clients pro Netzwerk, der `health` der Subsysteme der Konsole und für jedes Gateway sein WAN-Streifen, `gateways[]`: ein `wans[]`-Eintrag pro WAN mit `alive` (die eigenen Gesundheitsprüfungen des Gateways, nie das `up` des WAN-Blocks), `known`, `active`, `backup`, Latenz und Verfügbarkeit. `failover` ist Verkehr auf einem WAN, das nicht das erste ist, `down` ist kein WAN am Leben, und `since` ist der erste Lesevorgang, bei dem HotLoop Verkehr auf dem WAN sah, auf dem es jetzt ist, also wann HotLoop es bemerkte, nicht wann das Gateway umschaltete. `events` ist der Zustand des Event-Websockets (`live`, `error`, `reconnects`) und die zehn neuesten Ereignisse.

### `GET /api/unifi/{id}/topology`

Die Karte. `nodes[]` sind die übernommenen Geräte mit ihrem Platz im Raster (`x`, `y`, `layer`: von links nach rechts vom Gateway aus, bei gleichem Lesevorgang gleich angeordnet), `edges[]` die Kabel zwischen ihnen aus der eigenen `downlink_table` der Konsole, `wired[]` und `wifi[]` die Clients an jedem Switch-Port und jedem AP und SSID. Ein Gerät, das nirgends als an etwas angeschlossen geführt wird, wird allein gezeichnet mit gesetztem `noUplink`, nicht auf Verdacht am Gateway aufgehängt. Ein Gerät einer anderen UniFi-Konsole, die HotLoop liest und die diese Konsole als Client führt, wird als Knoten mit gesetztem `external` und einer Kante mit `stitched` eingefügt. `feeds` sind, nach Geräte-MAC, die HotLoop-Geräte, die mit einem Client unterhalb davon verknüpft sind, mit ihrer `equipmentId` für den Anlagenbaum, und `links` dieselben Geräte nach Client-MAC.

### `GET /api/unifi/{id}/devices`

Jedes übernommene Gerät mit seinen Zahlen und seinem `ports[]` für die Frontansicht: Link, Geschwindigkeit, PoE-Modus und -Leistung, die am Port gelernten Clients, das daran angeschlossene Gerät und `dropped` für einen Port, der bei einem früheren Lesen oben war und jetzt unten ist. Ein Gerät, das die Konsole verloren hat, meldet keine Zahlen und keine Port-Links, weil das, was es zuletzt sagte, nicht mehr aktuell ist.

### `GET /api/unifi/{id}/wifi`

Die SSIDs des Standorts mit `enabled`, dem Netzwerk, in dem sie liegen, und wie viele Clients auf jeder sind. Wenn die Konsole diesem Konto seine Funknetzwerke nicht zeigt, sagt `error` warum, und `wlans` ist leer.

### `GET /api/unifi/{id}/events`

Die neuesten Ereignisse, die die Konsole gemeldet hat, seit HotLoop verbunden ist, die neuesten zuerst (`?limit=` bis 200, Standard 50), und der Zustand des Event-Websockets. Jedes Ereignis hat den `key` des Controllers (`EVT_SW_Lost_Contact`), seine eigene `message`, `severity` (`warning`, wenn der Controller es als etwas Schiefgehendes markiert) und das Gerät, den Client und den Port, um die es geht. Sie stehen auch im Logbuch, abgelegt unter dem Switch oder Access Point, um den es geht (siehe [UniFi Network](/de/iot/unifi/#ereignisse)).

### `POST /api/unifi/{id}/starter-alarms`

Legt die üblichen Alarme für den Standort aus dem an, was die Konsole jetzt hat, als gewöhnliche Alarmdefinitionen unter `/api/alarms`: jedes übernommene Gerät offline (Priorität 2, 60 s Einschaltverzögerung), jeder Uplink-Port unten (Priorität 1, 10 s), ein Gateway mit zwei oder mehr WANs, das auf einem Backup läuft (Priorität 2, 30 s). Der Body ist optional. `{"poeLimitW": 25}` fügt einen Alarm der Priorität 3 auf die `poe_w`-Leistung jedes PoE-Ports über so viele Watt hinzu, mit 30 s Verzögerung; die Konsole sagt nicht, wie hoch das Budget eines Ports ist, also rät HotLoop keines. Ein negatives Limit ist ein `400`.

```json
{"created":[{"id":"unifi-devoffline-9c1e2a77b3d0","name":"USW Lite 8 PoE offline","kind":"offline","tag":"d.002722e2e633.online","priority":2}],
 "kept":[]}
```

`kept` sind Alarme, die der Satz verlangt und die schon da waren: seine eigenen von einem früheren Druck oder der Alarm von jemandem auf demselben Tag. Man kann also nach der Übernahme weiterer Geräte sicher erneut drücken, und es fügt nur die neuen Geräte hinzu. Die Alarme für OT-Netzwerke und für Geräte außerhalb des Netzwerks gehören nicht dazu; sie kommen mit dem Markieren eines Netzwerks als OT und dem Überwachen eines Geräts. `503`, bis die Konsole einmal gelesen wurde.

## MQTT-Erkennung

Geräte, die sich über MQTT angekündigt haben, und was eine Person zu jedem entschieden hat. Siehe [MQTT-Erkennung](/de/iot/mqtt-discovery/). Die Erkennung lauscht auf dem eingebauten Broker, wenn er läuft, und auf jedem Broker, der unter `/api/mqtt/brokers` eingerichtet ist. Ohne beides ist `sources` leer. In einem `--mcp-stdio`-Helfer, der nie lauscht, antwortet `GET /api/discovery` mit `{"running":false,"sources":[],"devices":[]}` und jede andere Route mit `503`.

`{source}` ist der Broker, auf dem sich ein Gerät angekündigt hat (`embedded` für HotLoops eigenen, sonst die ID des Brokers); `{key}` ist das, was seine Ankündigungen verband: seine erste Kennung, seine MAC als `mac:aa:bb:cc:dd:ee:ff` oder seine Knoten-ID. Kodieren Sie ihn als URL; Kennungen enthalten Zeichen, die ein Pfad nicht verträgt.

**Keiner dieser Aufrufe schaltet etwas scharf.** Ein Gerät zu übernehmen macht seine Punkte scharfschaltbar, einen nach dem anderen, über `POST /api/tags` wie jeden anderen Punkt.

### `GET /api/discovery`

Jede Quelle, mit dem, was sie gesehen und abgelehnt hat, und jedes erkannte Gerät:

```json
{"running":true,"sources":[{"id":"embedded","name":"the embedded broker","prefix":"homeassistant","listening":true,"connected":true,
  "received":42,"dropped":0,"refused":0,"problems":[],"autoCreate":true,"anonymousAllowed":false,
  "external":false,"listenOnly":false,"enabled":true}],
 "devices":[{"source":"embedded","deviceKey":"plug-0001","deviceId":"kitchen-plug","status":"discovered",
  "device":{"identifiers":["plug-0001"],"name":"Kitchen Plug","manufacturer":"Acme","model":"P1","swVersion":"1.0.0"},
  "origin":{"name":"test-publisher","swVersion":"0.1"},"firstSeen":"2026-10-02T09:12:04Z","lastSeen":"2026-10-02T09:12:04Z",
  "components":[{"key":"plug-0001-relay","component":"switch","name":"Relay","configTopic":"homeassistant/switch/plug-0001/relay/config",
   "stateTopic":"plug/relay","commandTopic":"plug/relay/set","commandTopics":["plug/relay/set"],"tag":"relay",
   "unsupported":[],"unknownKeys":[],"flags":[]}]}]}
```

Eine Quelle mit `external` true ist ein unter `/api/mqtt/brokers` eingerichteter Broker, und `broker` sagt, wo er ist. `autoCreate` false ist eine Quelle, deren Geräte im Posteingang warten: als `discovered` ohne `deviceId` gelistet, nichts wird angelegt und nichts gelesen, bis jemand eines übernimmt. `listenOnly` ist ein Broker, auf dem HotLoop nie veröffentlicht. `lastError` sagt, warum eine Quelle nicht verbunden ist, auch ein Passwort, das sich nicht öffnen lässt.

`status` ist `discovered`, `accepted` oder `ignored`. Je Komponente listet `unsupported`, was HotLoop nicht verwenden kann und warum (»value template not supported: filter `regex_findall_index` is not supported at column 12«), `unknownKeys` die Konfigurationsschlüssel, die das Format nicht definiert, `commandTopics` jedes Topic, an das seine Befehle gehen können (das Geschwindigkeits-Topic eines Lüfters neben dem Haupt-Topic), und `flags`, was eine Person vor dem Übernehmen ansehen sollte: ein Befehls-Topic außerhalb der Topics, die die Komponente liest, innerhalb des Erkennungspräfixes oder von einem anderen Gerät beansprucht, und eine Konfiguration, die gehaltene Befehle verlangt. `withdrawnAt` ist bei einer Komponente gesetzt, die der Herausgeber zurückgezogen hat. `suggestedEquipmentId` ist der Baumknoten, den das `suggested_area` des Geräts nennt, wenn genau ein Knoten diesen Namen hat; es füllt nur den Übernehmen-Dialog vor. Auf dem eingebauten Broker sind `announcedBy` und `announcedVia` das Broker-Login und die Client-ID, die seine neueste Konfiguration veröffentlicht haben, und `acceptedLogin` das Login, von dem es übernommen wurde. Ein übernommenes Gerät, dessen Ankündigung sich geändert hat oder das ein anderes Login angekündigt hat, hat `review`:

```json
{"hash":"9a1c...","summary":["plug-0001-power: unit changed"],
 "changes":[{"key":"plug-0001-power","kind":"changed","fields":[{"field":"unit","running":"W","announced":"kW"}]}]}
```

### `GET /api/discovery/{source}/{key}`

Ein Gerät, dieselbe Form. `404` für eines, das HotLoop nicht gesehen hat.

### `POST /api/discovery/{source}/{key}/accept`

Übernimmt ein Gerät. Ein optionaler Body `{"equipmentId": 12}` setzt es im selben Schritt in den Baum. Schaltet nichts scharf. Antwortet mit dem Gerät. `400` für ein ignoriertes.

### `POST /api/discovery/{source}/{key}/ignore`

Verwirft das Gerät: sein HotLoop-Gerät, die Tags und Entitäten verschwinden (sein Verlauf bleibt), und es bleibt ignoriert, wenn es sich wieder ankündigt. Antwortet mit dem Gerät. `DELETE /api/devices/{id}` auf ein erkanntes Gerät tut dasselbe, weil ein Gerät, das sich weiter ankündigt, sonst einfach wiederkäme.

### `POST /api/discovery/{source}/{key}/unignore`

Holt ein ignoriertes Gerät aus seiner zuletzt gemachten Ankündigung als erkannt zurück. `400`, wenn es nicht ignoriert ist.

### `POST /api/discovery/{source}/{key}/review/apply`

Lässt ein übernommenes Gerät laufen, was es angekündigt hat. Ob jeder Punkt scharf ist, bleibt, wie es war. `400`, wenn nichts auf Prüfung wartet.

### `POST /api/discovery/{source}/{key}/review/reject`

Lässt die übernommene Konfiguration weiterlaufen und bietet diese Änderung nicht mehr an. Eine andere Änderung später wird wieder angeboten. `400`, wenn nichts wartet.

Eine Prüfung kann sich darum drehen, wer es angekündigt hat: eine Änderung mit `"kind":"publisher"` und der Zusammenfassungszeile »announced by login garage-node; accepted from kitchen-node«. Wird sie angewendet, wird dieses Login zu dem, von dem das Gerät übernommen ist.

## Broker-Logins

Die in HotLoop angelegten Logins des eingebauten Brokers, jedes mit den Topics, die es veröffentlichen und abonnieren darf. Siehe [der eingebaute MQTT-Broker](/de/iot/broker/). Ein Login ist ein Schlüssel zum Broker der ganzen Anlage, also sind das `users.manage`, die eines Administrators. Nichts davon antwortet je mit einem Passwort oder seinem Hash. Jede Änderung kommt ins Protokoll und gilt ab dem nächsten Veröffentlichen des Clients; niemand muss sich neu verbinden.

### `GET /api/broker/logins`

```json
{"running":true,"anonymous":false,"prefix":"homeassistant","envLogins":["plant"],
 "profiles":[{"name":"shelly","about":"a Shelly Gen2 or later; name the login after its MQTT topic prefix",
   "publish":["%u/#","shellies/announce"],"subscribe":["%u/#","shellies/command","%p/status"]}],
 "logins":[{"name":"kitchen-node","profile":"esphome","publish":["%u/#","%p/+/%u/+/config","esphome/discover/%u"],
   "subscribe":["%u/#","%p/status","esphome/discover"],"createdBy":"admin","createdAt":"2026-10-02T09:12:04Z",
   "updatedAt":"2026-10-02T09:12:04Z","resolvedPublish":["kitchen-node/#","homeassistant/+/kitchen-node/+/config",
   "esphome/discover/kitchen-node"],"resolvedSubscribe":["kitchen-node/#","homeassistant/status","esphome/discover"]}]}
```

`running` ist false, wo dieser Prozess den Broker nicht betreibt; die Logins bleiben trotzdem erhalten, und der Broker liest sie beim Start. `envLogins` sind die Namen aus `HOTLOOP_BROKER_USERS`, die alles dürfen. `%u` in einer Regel ist der eigene Name des Logins und `%p` das Erkennungspräfix; `resolved*` sind die Regeln mit beidem eingesetzt.

### `POST /api/broker/logins`

```json
{"name":"kitchen-node","password":"a-long-random-password","profile":"esphome"}
```

`name` hat 1 bis 64 Buchstaben, Ziffern, `-` und `_` (er steht in Topics für `%u`). `password` hat mindestens 12 Zeichen. `profile` füllt die Regeln; `publish` und `subscribe` ersetzen sie, wenn angegeben. Eines der beiden ist nötig. Eine Regel ist ein MQTT-Topic-Filter: `+` und `#` nur als ganze Ebenen, `#` nur als letztes, nie ein `$`-Topic. `201` mit dem Login; `400` bei einem der obigen Fälle oder einem Namen, den `HOTLOOP_BROKER_USERS` schon hat; `409` bei einem vergebenen Namen.

### `PUT /api/broker/logins/{name}`

Beliebige von `profile`, `publish`, `subscribe` und `password`; was nicht gesendet wird, bleibt. `200` mit dem Login, `404` für eines, das nicht existiert.

### `DELETE /api/broker/logins/{name}`

`200` `{"deleted":"kitchen-node"}`. Ein Client, der noch damit verbunden ist, kann von da an nichts mehr tun und sich nicht erneut verbinden. `404` für eines, das nicht existiert.

## Netzwerkerkennung

Geräte, die im Anlagennetz über mDNS, SSDP und DHCP gehört wurden, und was eine Person zu jedem entschieden hat. Siehe [Netzwerkerkennung](/de/iot/network-discovery/). In einem `--mcp-stdio`-Helfer, der nie lauscht, antwortet `GET /api/network-discovery` mit `{"running":false,"finds":[]}` und jede andere Route mit `503`.

`{key}` ist, wie ein Fund gehört wurde und von wem: `mdns:` und sein mDNS-Hostname, `ssdp:` und seine UPnP-uuid, `dhcp:` und seine MAC. Kodieren Sie ihn als URL.

**Keiner dieser Aufrufe schaltet etwas scharf**, und nichts hier wird hinzugefügt, bis jemand es übernimmt.

### `GET /api/network-discovery`

Die Listener, das Abtasten, die Schnittstellen, auf denen sie sind, und jeder Fund:

```json
{"running":true,
 "status":{"leading":true,"interfaces":["eth0 10.20.0.15/24"],
  "listeners":[{"name":"mdns","enabled":true,"listening":true,"heard":120,"dropped":0,"refused":0},
   {"name":"ssdp","enabled":true,"listening":true,"heard":14,"dropped":0,"refused":0},
   {"name":"dhcp","enabled":false,"listening":false,"heard":0,"dropped":0,"refused":0}],
  "probe":{"networks":[]}},
 "finds":[{"key":"mdns:line3-ua.local","via":"mdns","kind":"opcua","name":"line3-ua","status":"discovered",
  "firstSeen":"2026-10-11T14:02:11Z","lastSeen":"2026-10-11T14:07:40Z",
  "find":{"key":"mdns:line3-ua.local","via":"mdns","kind":"opcua","name":"line3-ua",
   "summary":"OPC UA server, capabilities DA","host":"line3-ua.local","addresses":["10.20.0.31"],
   "services":[{"type":"_opcua-tcp._tcp.local","instance":"line3-ua._opcua-tcp._tcp.local","port":50000,
    "txt":{"caps":"DA","path":"/"}}],
   "proposal":{"protocol":"opcua","address":"opc.tcp://10.20.0.31:50000/","how":"Accepting makes an OPC UA device..."},
   "heard":"2026-10-11T14:07:40Z"}}]}
```

`kind` ist `esphome`, `shelly`, `opcua`, `mqtt-broker`, `web`, `mdns` (es hat etwas angekündigt, wofür HotLoop kein Wort hat), `upnp` oder `dhcp`. Ein Fund, dessen `proposal` ein `protocol` hat, wird beim Übernehmen zu einem Gerät dieses Protokolls unter `address`; einer ohne sagt in `how`, was ihn hereinbringen würde. `also` listet die anderen Funde und per MQTT erkannten Geräte, die dieselbe Box sind, nach MAC oder Adresse. `status` ist `discovered`, `accepted` oder `ignored`, und `deviceId` das Gerät, das das Übernehmen angelegt hat. Der `error` eines Listeners sagt, warum er nicht lauscht (Port 67 belegt oder nicht erlaubt, keine Multicast-Schnittstelle); `refused` zählt neue Funde, die verworfen wurden, weil der Bestand voll ist.

### `GET /api/network-discovery/{key}`

Ein Fund, dieselbe Form. `404` für einen, den HotLoop nicht gehört hat.

### `POST /api/network-discovery/{key}/accept`

Übernimmt einen Fund. Ein optionaler Body `{"equipmentId": 12}` setzt das angelegte Gerät in den Baum. Ein Fund, für den HotLoop einen Treiber hat, wird zu einem Gerät unter der vorgeschlagenen Adresse, aktiviert, ohne Tags und ohne etwas Scharfes; jeder andere wird als bekannt vermerkt und legt nichts an. Antwortet mit dem Fund. `400` für einen schon übernommenen oder ignorierten.

### `POST /api/network-discovery/{key}/ignore`

Verbirgt einen Fund, über den niemand entschieden hat, und hält ihn verborgen, wenn er wieder gehört wird. `400` für einen, über den schon entschieden ist.

### `POST /api/network-discovery/{key}/unignore`

Holt einen ignorierten Fund zurück, damit über ihn entschieden werden kann. `400`, wenn er nicht ignoriert ist.

### `POST /api/network-discovery/probe`

Tastet jetzt ab: eine mDNS-Anfrage und eine SSDP-Suche auf jeder Schnittstelle, deren Netzwerk in `HOTLOOP_NETDISC_PROBE_NETWORKS` steht, und sonst nirgends. Antwortet `{"status": ...}`, mit dem, was nicht hinausging, in `status.probe.lastError`. `400`, wenn kein Netzwerk das Abtasten eingeschaltet hat: Diese Schaltfläche kann es nicht einschalten, nur die Installation.

## Integrationen

Der Einrichtungsablauf für eine Art von Gerät, auf die eine Person HotLoop richtet: fragen, was die Integration braucht, mit den Antworten das echte Gerät ansehen und aus dem Gefundenen das Gerät und seine Tags anlegen. Siehe [Integrationen](/de/iot/integrations/).

**Nichts hier schaltet etwas scharf.** Jeder Tag, den eine Einrichtung anlegt, ist schreibgeschützt. Ihn scharfzuschalten ist `POST /api/tags` wie bei jedem anderen Punkt.

### `GET /api/integrations`

Jede Integration, die dieser Build hat, mit den Fragen, die sie stellt:

```json
[{"id":"opcua","name":"OPC UA server","description":"A PLC, CNC, gateway or SCADA server ...",
  "protocol":"opcua","addressLabel":"Endpoint","addressPlaceholder":"opc.tcp://192.168.1.20:4840","writable":true,
  "fields":[{"key":"securityMode","label":"Security","kind":"choice","required":false,"default":"None",
             "choices":[{"value":"None","label":"None"},{"value":"Sign","label":"Sign"}]},
            {"key":"password","label":"Password","kind":"secret","required":false}]}]
```

`kind` ist `text`, `number`, `bool`, `choice` oder `secret`. Ein Feld mit `showWhen` (`{"version":["3"]}`) wird nur gefragt, wenn eine andere Antwort einen dieser Werte hat, und die Antwort auf eine Frage, die nicht angezeigt wird, wird ignoriert.

### `POST /api/integrations/{id}/probe`

Prüft die Antworten und sieht sich das echte Gerät an. Speichert nichts.

```json
{"address":"opc.tcp://192.168.1.20:4840","options":{"securityMode":"None"}}
```

Antwortet `{"integration":"opcua","address":"opc.tcp://192.168.1.20:4840","found":{...}}`. `address` ist die Adresse, wie die Integration sie aufgelöst hat. `found` hat `name` (wie das Gerät sich selbst nennt), `identity` (was es zu sein sagt), `notes` (was man vor dem Übernehmen wissen sollte) und `points`, jeder in Tag-Form `{name, address, dataType, unit, description, writable, deviceClass}` plus `group`, `sample` (was beim Finden gelesen wurde) und `suggested`.

`400` bei Antworten, die nicht zu den Fragen passen, alle Probleme auf einmal; auch eine Antwort auf eine Frage, die die Integration nicht stellt, ist ein `400`, nicht ignoriert. `502`, wenn das Gerät nicht geantwortet hat oder mit etwas, das nicht sein Protokoll ist, mit dem, was schiefging. `404` für eine Integration, die dieser Build nicht hat. Ein Geheimnis steht nie in einer Antwort oder einem Fehler.

### `POST /api/integrations/{id}/setup`

Sieht sich das Gerät erneut an und legt es dann mit seinen Tags an. Der Body ist der des Probe, plus:

| Feld | Bedeutung |
|---|---|
| `deviceId` | Die ID des neuen Geräts. Leer nimmt eine aus dem Namen. `400`, wenn ein Gerät sie hat |
| `name` | Der Name des Geräts. Leer nimmt, wie das Gerät sich selbst nennt |
| `points` | Namen aus `found.points`, die eingerichtet werden sollen. Leer nimmt die als `suggested` markierten. Ein Name, den das Gerät nicht hat, ist ein `400` |
| `site`, `area`, `line` | Wohin es im Anlagenbaum kommt, wie bei `POST /api/devices` |

Die Punkte werden gegen das Gerät geprüft, wie es jetzt ist, nicht gegen das, was ein Client vor einer Minute gefunden zu haben angibt. Antwortet `{"device":{...},"tags":3,"entities":["sensor.plc_sim_..."],"notes":[]}`. Das Gerät ist aktiviert und wird abgefragt, jeder Tag ist schreibgeschützt, und jeder Tag hat seine Lese-Entität. Eine Einrichtung, die auf halbem Weg scheitert, hinterlässt kein Gerät.

## MQTT-Broker

Andere Broker als HotLoops eigener, auf die die Erkennung lauscht: das Mosquitto einer Anlage, der Broker, den eine Zigbee2MQTT-Box mitgebracht hat. Siehe [MQTT-Erkennung](/de/iot/mqtt-discovery/#other-brokers). Ihre Passwörter sind mit dem Gerätezugangsschlüssel (`HOTLOOP_SECRET_KEY_FILE`) versiegelt und werden nie zurückgegeben; `passwordSet` sagt, ob eines gespeichert ist, und `passwordProblem`, warum ein gespeichertes sich nicht öffnen lässt. Jede Änderung kommt ins Protokoll und wirkt sofort: Der Listener und die Geräte dieses Brokers verbinden sich neu.

### `GET /api/mqtt/brokers`

```json
{"secretKey":true,
 "brokers":[{"id":"plant-uns","name":"Plant UNS","broker":"tcp://10.20.0.5:1883","username":"hotloop","useTls":false,
   "insecureSkipVerify":false,"prefix":"homeassistant","listenOnly":true,"autoCreate":false,"tasmota":true,"shelly":true,"enabled":true,
   "createdBy":"admin","passwordSet":true,"createdAt":"2026-10-03T09:12:04Z","updatedAt":"2026-10-03T09:12:04Z"}]}
```

`secretKey` sagt, ob dieses HotLoop einen Schlüssel hat, mit dem es ein Passwort versiegeln kann.

### `POST /api/mqtt/brokers`

```json
{"id":"plant-uns","name":"Plant UNS","broker":"tcp://10.20.0.5:1883","username":"hotloop",
 "password":"...","listenOnly":true}
```

`id` hat 1 bis 63 Kleinbuchstaben, Ziffern und `-`, nicht `embedded`: Sie benennt den Broker in jedem Gerät, das von ihm stammt, und kann sich nicht ändern. `broker` ist `host:port` oder eine URL `tcp://`, `ssl://`, `tls://`, `mqtt://` oder `mqtts://`, ohne Login darin. `prefix` ist standardmäßig `homeassistant`; `autoCreate` ist false (Geräte warten im Posteingang); `listenOnly` ist false; `tasmota` (auch Tasmotas eigene Erkennung hören, `tasmota/discovery/#`) ist true; `shelly` (Shelly-Geräte der Gen2 und später aus den Topics `<prefix>/status/<component>` lernen, die sie veröffentlichen) ist true; `enabled` ist true. Ein Passwort braucht einen Benutzernamen und einen Schlüssel: ohne `HOTLOOP_SECRET_KEY_FILE` ist es ein `400`, nie im Klartext gespeichert. `201` mit dem Broker; `409` bei einer vergebenen ID.

### `PUT /api/mqtt/brokers/{id}`

Beliebige der obigen Felder außer `id`; was nicht gesendet wird, bleibt. `"password":""` löscht das Passwort. `200` mit dem Broker.

### `DELETE /api/mqtt/brokers/{id}`

Entfernt den Broker und das, was er angekündigt hat und niemand übernommen hat: den Posteingang und jedes Gerät, das er selbst angelegt hat. `409`, das sie nennt, solange noch von ihm übernommene Geräte existieren: Ignorieren oder löschen Sie diese zuerst, oder schalten Sie den Broker stattdessen mit `"enabled":false` aus. `200` `{"deleted":"plant-uns"}`.

## Tags

### `GET /api/tags`

| Abfrage | <span class="sr-only">Details</span> |
|---|---|
| `device` | Nur die Tags dieses Geräts. Ohne `limit` antwortet es mit allen |
| `q` | Suche: eine Teilzeichenkette, ohne Beachtung der Groß- und Kleinschreibung, der Geräte-ID, des Tag-Namens oder der Beschreibung. Funktioniert zusammen mit `device` |
| `limit` | Eine ganze Zahl von 1 bis 5000. Standard 500 ohne `device`. Alles andere, auch 5001, ist `400`: Es wird abgelehnt, nie mit weniger beantwortet (bis 4.19.5 wurde jedes Limit über 1000 stillschweigend zu 200) |
| `writable` | `true` für nur die als schreibbar markierten Tags (was die Schreib-Auswahlen anbieten) |
| `offset` | Wo die Seite beginnt, null oder mehr. Tags sind nach Gerät, dann nach Name sortiert |

Der Header `X-Total-Count` der Antwort sagt, wie viele Tags insgesamt passen, sodass ein Client mit `offset` blättert, bis er alle hat, und weiß, dass er sie hat. Eine leere Antwort ist `[]`.

```json
[{"id":5,"deviceId":"tank-farm","name":"level_sp","address":"mqtt:docs-api-example/level_sp","dataType":"float","unit":"%","enabled":true,"writable":true,"maxValue":95,"hasRange":true,"scale":1,"createdAt":"2026-09-27T20:21:39.405164Z","updatedAt":"2026-09-27T20:21:39.405164Z"}]
```

### `POST /api/tags`

Legt den Tag an, wenn `deviceId` und `name` neu sind, und ersetzt ihn sonst.

| Feld | Typ | <span class="sr-only">Details</span> |
|---|---|---|
| `deviceId` | string | Pflicht. Das Gerät muss existieren (`404`, wenn nicht) |
| `name` | string | Pflicht. Keine Steuerzeichen |
| `address` | string | Pflicht. Die eigene Adresse des Protokolls |
| `dataType` | string | `bool`, `int`, `float` oder `string` (und die üblichen Aliase: `int16`, `word`, `coil`...). Bestimmt, wie ein Schreibvorgang kodiert wird |
| `unit`, `description` | string | |
| `enabled` | bool | Weggelassen ist es `false` |
| `writable` | bool | **Schaltet den Tag zum Schreiben scharf, von jedem Weg aus: Oberfläche, Automatisierungen, Entitäten, MCP.** Weggelassen ist es `false` |
| `hasRange`, `minValue`, `maxValue` | bool, number, number | Mit `hasRange` wird ein Schreibvorgang außerhalb des Bereichs abgelehnt (nie begrenzt) |
| `scale`, `offset` | number | Technische Einheit = Rohwert x Skalierung + Offset. Eine Skalierung von 0 gilt als 1 |
| `noData` | list | Rohwerte, die »keine Messung« bedeuten, jeder `{"raw", "reason"}`. `raw` ist ein String (`"0x8005"`, `"-32763"`) oder eine blanke Zahl und kommt als String zurück. Ein Messwert, dessen Rohwert auf der Liste steht, hat schlechte Qualität mit diesem `reason`, geprüft vor `scale` und `offset`. Bis zu 32 Codes. Ein Code, der keine ganze Zahl ist, doppelt aufgeführt ist oder nicht der Typ des Punkts sein kann, ist `400`. Siehe [Protokolle und Treiber](/de/iot/protocols/#no-data-values) dafür, was für jeden Typ zu schreiben ist, und das Yokogawa-DX-Beispiel |
| `deadband`, `deadbandPercent` | number | Änderungen, die kleiner sind, werden nicht in den Verlauf geschrieben |
| `deviceClass` | string | Die Klasse, mit der die Entitäten des Tags beginnen (`power`, `connectivity`, `temperature`...), wenn sie für ihre Domäne etwas bedeutet. Wird beim Anlegen des Tags übernommen und beim Ersetzen ignoriert: Von da an gehört die Klasse der Entität, ändern Sie sie also dort |

Antwortet mit dem gespeicherten Tag. Das Speichern eines mit `writable: true` wird als solches protokolliert: Einen Tag scharfzuschalten ist eine Sicherheitsentscheidung und bekommt einen Namen dazu. Die Entitäten des Tags werden vor der Antwort angelegt oder aktualisiert, sodass ein Client sie gleich abfragen kann.

Ein Tag auf einem erkannten Gerät, das niemand übernommen hat, kann nicht scharfgeschaltet werden: `400`, »accept the device first«. Siehe [MQTT-Erkennung](/de/iot/mqtt-discovery/#commands).

### `DELETE /api/tags/{device}/{name}`

`{"deleted":"tank-farm/level"}`, oder `404`. Der Verlauf bleibt. Die Entitäten des Tags werden zu Waisen (siehe [Entitäten](/de/iot/entities/#deleted-tags-orphans-and-re-adoption)).

## Werte, das Board und Schreibvorgänge

### `GET /api/values`

Der letzte Messwert jedes Tags, aus dem Speicher. `?device=` schränkt auf ein Gerät ein.

```json
[{"deviceId":"extruder-1","protocol":"opcua","tagName":"Temperature","tagValue":20.645294745260895,"unit":"C","quality":"good","timestamp":"2026-09-27T20:21:58.255722Z"}]
```

Diese Form ist der `TagValue` des EmberNet-Dashboards und ein Vertrag. `quality` ist `good`, `uncertain` oder `bad`; **ein schlechter Messwert heißt, dass der Wert nicht bekannt ist, nicht dass er null ist**. Ein String-Messwert trägt `stringVal`, und sein `tagValue` bedeutet nichts.

Ein Messwert, der nicht gut ist, trägt `reason`, wenn der Treiber weiß, warum, damit ein Bildschirm mehr sagen kann als »schlecht«:

```json
{"deviceId":"meter-01","protocol":"http","tagName":"power","tagValue":0,"quality":"bad","timestamp":"2026-09-30T09:12:04.51Z","reason":"no field at ENERGY.Power"}
```

Ein guter Messwert hat es nie, der obige Vertrag ist also Byte für Byte, was er war. Der Historian behält es nicht: `/api/history` hat die Qualität, nicht den Grund.

### `GET /api/sparkline`

Die letzten im Speicher gehaltenen Messwerte eines Tags (`HOTLOOP_RING_SIZE`, standardmäßig 30), für die kleinen Diagramme. `?tag=device/tag`, Pflicht.

```json
{"tag":"extruder-1/Temperature","timestamps":[1790540498609,1790540499246,1790540500246],"values":[0,20.06524581530632,19.933308705395785]}
```

`timestamps` sind Unix-Millisekunden. Beide sind `[]` bei einem Tag ohne Messwerte. `400` bei einem fehlerhaften Schlüssel.

### `GET /api/board`

Welche Tags ans Board geheftet sind und in wie vielen Spalten. Es wird in der Datenbank gespeichert, nicht im Browser, weil ein Board der Anlage gehört: Der Panel-PC in der Halle und der Laptop im Büro zeigen dasselbe.

```json
{"columns":2,"tags":["extruder-1/Temperature","tank-farm/level"],"rev":"9f2c41b07a6d3e58"}
```

`rev` benennt das Board, wie es gespeichert ist. Senden Sie es mit einem Speichern zurück, und das Speichern wird abgelehnt, wenn sich das Board seither geändert hat (unten).

### `PUT /api/board`

Dieselbe Form. `columns` außerhalb von 1 bis 4 wird zu 3; Duplikate werden verworfen. `rev` ist optional: Mit dem `rev` des Boards, das Sie gelesen haben, ist ein Speichern über ein seither geändertes Board ein `409` und ändert nichts, sodass eine Seite, die das Board nie gelesen oder ein altes gelesen hat, das der Anlage nicht mit ihrer Kopie ersetzen kann. Lassen Sie es weg, wird das Speichern nicht geprüft, was zu einem Client passt, der jedes Mal das ganze Board setzt. Die Weboberfläche liest das Board beim Start und sendet bei jedem Speichern das `rev`. Jeder Tag muss existieren (`404`, der den nennt, der nicht existiert): Ein veralteter Eintrag ist eine Anzeige, die sich nie bewegt. Antwortet mit dem Board, wie es gespeichert ist. Bediener haben `board.write`: Das Board zu ordnen heißt die Anlage fahren, nicht sie konfigurieren.

### `POST /api/write`

Schreibt einen Wert auf einen Tag, durch das Schreib-Gate.

| Feld | Typ | <span class="sr-only">Details</span> |
|---|---|---|
| `tag` | string | Pflicht. `device/tag` |
| `value` | bool, number or string | Pflicht. `true` ist ein Bool, `42` eine Ganzzahl, `42.5` ein Float, `"42"` ein String: Der JSON-Typ ist der geschriebene Typ, weil ein Coil, ein Wort und ein Real auf der Leitung drei verschiedene Dinge sind |
| `reason` | string | Optional. Wird mit dem Schreibvorgang protokolliert |

```json
{"tag":"tank-farm/level_sp","written":"72.5"}
```

**Ein Wert steht in den Einheiten des Tags, wie ein Messwert.** Bei einem Tag mit Skalierung oder Offset ist das, was Sie senden, das, was der Tag zurücklesen würde, und HotLoop sendet dem Gerät den Zählwert, der es ergibt: 55.5 auf einem Register mit Skalierung 0.1 legt 555 ins Register. (Bis 4.18 ging die Zahl so, wie sie war, ans Gerät, sodass aus 55.5 dann 55 wurde und als 5.5 zurückgelesen wurde.) Die Bereichsprüfung und die Audit-Zeile verwenden Ihre Zahl, in den Einheiten des Tags. Ein Zählwert, der danach nicht ins Register passt, etwa 7000 auf einem `uint16` mit Skalierung 0.1, wird abgelehnt, mit Zählwert und Register genannt, und nichts wird gesendet. Ein Bruchteil eines Zählwerts wird abgeschnitten, wie es ein Register mit ganzzahligem Zählwert immer tat: 12.34 auf einem Register mit Zehntel-Skalierung enthält 12.3.

Das Gate prüft der Reihe nach, dass Schreiben eingeschaltet ist (`HOTLOOP_ALLOW_WRITES`), dass der Tag scharfgeschaltet ist und dass der Wert im Bereich liegt. Jeder Versuch, abgelehnt oder nicht, steht in `GET /api/writes`.

| Status | Wann |
|---|---|
| 400 | Kein Wert, ein `null`-Wert, ein fehlerhafter Schlüssel |
| 403 | Schreiben ist aus, oder `"tank-farm/level: this tag is not marked writable"` |
| 404 | Kein solcher Tag |
| 422 | `"value is outside the tag's configured range: 120 is outside 0..95"` |
| 503 | Das Gerät ist nicht verbunden |

## Verlauf und Audit

### `GET /api/history`

| Abfrage | <span class="sr-only">Details</span> |
|---|---|
| `tag` | Pflicht, wiederholbar, bis zu 50: `?tag=a/x&tag=b/y` |
| `minutes` | Wie weit zurück von jetzt. Standard 60 |
| `bucket` | Intervallgröße in Sekunden. Standard: so gewählt, dass das Fenster etwa 400 Intervalle hat, auf einer Stufenleiter von 1 s bis 1 Tag |
| `raw` | `true` für die Messwerte selbst statt Intervalle |
| `limit` | Standard 5000, höchstens 100000 |
| `carry` | `true`, um auch zu sagen, was jeder Tag hielt, als das Fenster begann (nur Intervalle) |

In Intervallen, pro Tag der älteste zuerst. `badCount` ist, wie viele Messwerte im Intervall nicht von guter Qualität waren; sie werden gezählt, nicht eingemittelt. `from` und `to` sind das Fenster, für das die Antwort gilt, genau `minutes` auseinander und endend, wenn die Frage gestellt wurde:

```json
{"buckets":[{"deviceId":"extruder-1","tagName":"Temperature","bucket":"2026-09-27T20:21:00Z","avg":18.986210570239944,"min":0,"max":20.83008050535897,"first":0,"last":20.83008050535897,"count":22,"badCount":1}],"from":"2026-09-27T19:22:00Z","raw":false,"to":"2026-09-27T20:22:00Z"}
```

Der Historian behält einen Messwert, wenn ein Wert über seine Totzone hinausgeht, nicht bei jeder Abfrage, sodass ein Tag, der still gehalten hat, im Fenster nichts zu zeichnen hat. Mit `carry=true` hat die Antwort außerdem `"carry":[{"deviceId":"extruder-1","tagName":"Temperature","ts":"2026-09-27T16:40:12Z","value":21.4}]`: den letzten Messwert vor `from`, für jeden Tag, dessen letzter früherer Messwert gut war und eine Zahl enthielt. Ein Tag, dessen letzter Messwert schlecht oder unsicher war, der keinen früheren Messwert hat oder der Text ist, hat keinen Eintrag, weil nicht bekannt ist, was er hielt, und wir einem Diagramm keine Vermutung geben. Die Trendkarte zeichnet daraus.

Roh, der neueste zuerst:

```json
{"raw":true,"readings":[{"deviceId":"extruder-1","protocol":"","tagName":"Temperature","tagValue":21.021559879601448,"quality":"good","timestamp":"2026-09-27T20:22:00.267463Z"}]}
```

`400` ohne `tag`, mit mehr als 50 oder mit einem fehlerhaften Schlüssel.

### `GET /api/writes`

Das Schreib-Audit, das neueste zuerst. Jeder Versuch steht hier, auch die abgelehnten, weil »wir wissen nicht, ob der Befehl hinausgegangen ist« die schlimmste Antwort ist, die eine Anlage bekommen kann.

| Abfrage | <span class="sr-only">Details</span> |
|---|---|
| `tag` | Ein Tag, `device/tag` |
| `device` | Jeder Tag eines Geräts (wird ignoriert, wenn `tag` gesetzt ist) |
| `entity` | Jeder Schreibvorgang, den ein Dienstaufruf auf dieser Entität gemacht hat oder der abgelehnt wurde, statt des Obigen |
| `call` | Jeder Schreibvorgang eines Aufrufs, statt alles Obigen: das Drücken und Loslassen einer Taste oder jedes Ziel der Anwendung eines Rezepts, die sich seine `call_id` teilen |
| `limit` | Standard 100, höchstens 5000 |

```json
[{"id":2,"at":"2026-09-27T20:22:01.04226Z","deviceId":"tank-farm","tagName":"level_sp","value":"120","prior":"0 %","actor":"admin","source":"ui","succeeded":false,"error":"refused: value is outside the tag's configured range: 120 is outside 0..95"},
 {"id":4,"at":"2026-09-27T20:23:03.276962Z","deviceId":"tank-farm","tagName":"pump","value":"true","prior":"0","actor":"admin","source":"ui","succeeded":true,"latencyMs":0.317,"entityId":"switch.tank_farm_pump","service":"switch.turn_on","callId":"5c9f8545a93b5443"}]
```

`source` ist `ui`, `api`, `automation` oder `mcp`. `entityId`, `service` und `callId` stehen nur bei Schreibvorgängen, die ein Dienstaufruf gemacht hat.

## Entitäten und Zustände

Jeder Tag bekommt Entitäten, ohne dass jemand darum bittet; Verbundobjekte (Motoren, Ventile, Regelkreise, Zähler, Auswahlen, Tasten, Wetterstationen) baut ein Administrator aus Tags. In snake_case, wie jeder Entitäten-Endpunkt. Das ganze Modell steht unter [Entitäten](/de/iot/entities/).

### `GET /api/entities`

Jede Entität, auch verwaiste.

| Abfrage | <span class="sr-only">Details</span> |
|---|---|
| `domain` | `sensor`, `switch`, `motor`... |
| `device` | Entitäten eines Geräts |
| `orphaned` | `true` für nur die verwaisten, `false` für keine |
| `q`, `limit` | Suche: eine Teilzeichenkette, ohne Beachtung der Groß- und Kleinschreibung, der Entitäts-ID, des Namens oder der Geräte-ID, und höchstens `limit` davon (1 bis 5000, alles andere ist `400`, nie stillschweigend gekürzt), nach Entitäts-ID sortiert. `X-Total-Count` sagt, wie viele gepasst haben. Weggelassen ist die Liste vollständig |

```json
[{"id":5,"entity_id":"switch.tank_farm_pump","unique_id":"tag-control:tank-farm/pump","domain":"switch","platform":"tag","name":"pump","device_id":"tank-farm","options":{},"disabled":false,"hidden":false,"created_at":"2026-09-27T20:21:39.153197Z","updated_at":"2026-09-27T20:21:39.153197Z","bindings":[{"role":"command","device_id":"tank-farm","tag_name":"pump"},{"role":"state","device_id":"tank-farm","tag_name":"pump"}],"equipment_id":null,"area_id":4,"labels":[]}]
```

### `GET /api/entities/composites`

Was `POST /api/entities` anlegen kann: jede Domäne, die Rollen, an die ihre Tags gebunden sind, und die Dienste, die sie annimmt. Eine Rolle nennt ihre `kind` des Tags, ob sie `required` ist, ob ein Dienst sie schreibt (`command`) und ob der Zustand von ihr gelesen wird (`feedback`). Eine Wetterstation nimmt keinen Dienst an.

```json
{"domains":[{"domain":"weather","roles":[{"role":"temperature","kind":"number","required":true,"command":false,"feedback":true},{"role":"humidity","kind":"number","required":false,"command":false,"feedback":true}],"services":[]}]}
```

### `GET /api/entities/{entity_id}`

`{"entity": {...}, "state": {...}}`. `state` ist `null` bei einer deaktivierten Entität. `404` bei einer unbekannten.

### `GET /api/entities/{entity_id}/image`

Das neueste Bild einer Kamera oder eines Bildes, als die Bytes, die HotLoop hält: `Content-Type` ist, was sie sind (`image/jpeg`, `image/png`, `image/gif` oder `image/webp`), mit `X-Content-Type-Options: nosniff`, einer abschottenden `Content-Security-Policy` und einem `ETag` (`If-None-Match` bekommt ein `304`). `404` bei einer Entität, die keines ist, oder bevor ein Bild eingetroffen ist. Das Attribut `entity_picture` des Zustands ist dieser Pfad mit dem Hash des Bildes.

### `PUT /api/entities/{entity_id}`

Ändert nur die Felder, die Sie senden. Nur für Administratoren: Die entity_id ist der Name, unter dem jede Automatisierung, jedes Dashboard und jeder Agent die Entität anspricht, und sie zu ändern ist Konfiguration.

| Feld | Typ | <span class="sr-only">Details</span> |
|---|---|---|
| `entity_id` | string | Eine Umbenennung. Die `unique_id` bewegt sich nicht |
| `name`, `icon`, `device_class`, `state_class`, `unit_of_measurement`, `entity_category` | string | |
| `options` | object | Je Domäne; siehe [Entitäten](/de/iot/entities/#api) |
| `disabled`, `hidden` | bool | Eine deaktivierte Entität hat keinen Zustand und kann nicht angesteuert werden |
| `equipment_id` | int or null | Setzt sie in den Baum; `null` folgt wieder ihrem Gerät |
| `labels` | string[] | Die ganze Menge |

`unique_id`, `domain`, `platform`, das Gerät und die Bindungen können hier nicht geändert werden, und sie zu senden ergibt ein 400.

```json
{"entity":{"id":3,"entity_id":"sensor.tank_1_level","name":"Tank 1 level","device_class":"moisture","icon":"mdi:water-percent","...":"..."},"warnings":[]}
```

`warnings` sagt, wann etwas zulässig, aber seltsam ist (eine Einheit, die die Geräteklasse üblicherweise nicht hat). `400` bei leerem Body (`"the update names no field to change"`) oder falschem Wert, `404` bei unbekannter Entität, `409` bei vergebener entity_id.

### `POST /api/entities`

Legt ein Verbundobjekt an. Der Body nennt die Domäne und bindet Tags an ihre Rollen:

```json
{"name":"Transfer pump","domain":"motor","bindings":[{"role":"run_command","device_id":"tank-farm","tag_name":"pump"},{"role":"running","device_id":"tank-farm","tag_name":"pump"}]}
```

Außerdem `entity_id` (sonst aus dem Namen erzeugt), `device_class`, `unit_of_measurement`, `icon`, `entity_category` und `options`. Welche Rollen und Optionen jede Domäne nimmt, steht unter [Entitäten](/de/iot/entities/#composite-equipment). Antwortet `201` `{"entity": {...}, "warnings": [...]}`. `400` bei einer Domäne, die hier nicht angelegt wird (ein `sensor` kommt von seinem Tag, ein `alarm` von seiner Definition), einer fehlenden Rolle oder einem Tag, der sie nicht ausfüllen kann, `409` bei vergebener entity_id.

### `DELETE /api/entities/{entity_id}`

Löscht ein Verbundobjekt oder eine verwaiste Entität, deren Tag oder Alarmdefinition weg ist. `{"deleted":"motor.transfer_pump","entity":{...}}`. Alles andere antwortet `409` mit der Angabe, wie es doch verschwindet:

```json
{"error":"this entity cannot be deleted: sensor.tank_1_level is kept in step with its tag; delete the tag, and then this orphan, or hide or disable it: already exists"}
```

### `GET /api/states`

Der Zustand jeder aktivierten Entität, nach entity_id sortiert. `?domain=` filtert.

```json
[{"entity_id":"number.tank_farm_level_sp","state":"unknown","attributes":{"armed":true,"friendly_name":"level_sp","max":95,"min":0,"source":["tank-farm/level_sp"],"unit_of_measurement":"%"},"quality":"bad","last_changed":"2026-09-27T20:21:39.417193755Z","last_updated":"2026-09-27T20:21:39.417193755Z","last_reported":"2026-09-27T20:22:04.423849496Z"}]
```

`state` ist immer ein String, auch bei einer Zahl; `unknown` und `unavailable` bedeuten, was sie sagen. `last_reported` ist der Zeitstempel des Geräts für den dahinterstehenden Messwert.

### `GET /api/states/{entity_id}`

Ein Zustand. `404` bei unbekannter Entität und ein anderes `404` bei einer deaktivierten, das sagt, wie man sie aktiviert: Eine deaktivierte Entität fehlt nicht, und sie als fehlend zu melden schickt jemanden auf die Suche nach einem Tippfehler.

## Energie

Was die Anlage verbraucht und was es kostet: Kilowattstunden, Gas, Wasser, Druckluft und die Kosten einer gefertigten Einheit. Ein Zähler ist ein Tag, der als verbrauchte Menge gelesen wird. Das ganze Modell, die Tarife und was der Bildschirm tut, stehen unter [Energie](/de/iot/energy/). Lesen ist `energy.read`, das jede Rolle hat; einen Zähler oder Tarif anzulegen oder zu ändern ist `energy.write`, das eines Administrators.

### `GET /api/energy/meters`

Jeder Zähler, nach Art und dann nach Name, jeweils mit der Art, wie er gelesen wird, und dem, was er heute verbraucht hat.

```json
[{"id":"main","name":"Main panel","kind":"electricity","mode":"counter","source":{"device_id":"pm-01","tag_name":"kWh"},"unit":"kWh","factor":0.001,"tariff":{"currency":"USD","price":0.12,"bands":[{"from":"22:00","to":"06:00","price":0.07}]},"enabled":true,"status":{"state":"ok","last_read_at":"2026-11-19T21:15:00Z","resets":0,"gap_seconds":0},"today":{"value":412.6,"cost":49.51,"covered_seconds":43200,"estimated":false}}]
```

`status.state` ist `ok`, `waiting` (aus dem Tag wurde noch nichts gelesen), `bad` (der Messwert des Tags ist nicht gut, und `reason` sagt warum) oder `disabled`.

### `POST /api/energy/meters`

Legt einen Zähler an. `id` besteht aus Kleinbuchstaben, Ziffern, `-` und `_`. `kind` ist `electricity`, `gas`, `water`, `air`, `heat` oder `production`. `mode` ist `counter` (ein kumulativer Tag: Der Verbrauch ist, wie weit er sich bewegt hat, mal `factor`) oder `power` (eine Rate: Der Verbrauch ist die Rate über die Zeit, in der sie anlag, mit `power_unit` `W`, `kW` oder `MW` und `unit` `Wh`, `kWh` oder `MWh`). `source` ist der Tag. `tariff` ist ein fester `price` pro Einheit mit optionaler `currency` und optionalen `bands` (`from` und `to` auf einer Viertelstunde, `days`, `price`) für einen Zeitzonentarif; ein Produktionszähler hat keine. Ein Stromzähler in `Wh`, `kWh` oder `MWh` kann im Tarif auch einen `demand_price` haben: was ein Kilowatt seiner höchsten Viertelstunde in einem Fenster kostet. Weggelassenes `enabled` ist `true`. `201` mit `{"meter": {...}, "warnings": []}`. `400` mit der Angabe, was falsch ist: Der Tag ist nicht da oder keine Zahl, ein Band liegt nicht auf einer Viertelstunde, ein Leistungszähler mit einem Faktor. `409` bei vergebener ID.

### `GET /api/energy/meters/{id}`

Ein Zähler, wie ihn die Liste zeigt. `404` bei einem unbekannten.

### `PUT /api/energy/meters/{id}`

Ersetzt die Definition eines Zählers. Was er schon gezählt hat, bleibt und behält den Preis, zu dem es entstand. Ihn auf einen anderen Tag oder Modus zu richten, vergisst, wo der letzte Messwert aufgehört hat, weil der nächste Messwert von etwas anderem stammt.

### `DELETE /api/energy/meters/{id}`

Entfernt einen Zähler und alles, was er gezählt hat. `404` bei einem unbekannten.

### `GET /api/energy/summary`

Verbrauch und Kosten jedes Zählers über ein Fenster und die Kosten einer gefertigten Einheit. Das Fenster ist `?period=` (`today`, `yesterday`, `this_week`, `last_week`, `this_month`, `last_month`, `last_7_days`, `last_30_days` oder eine Schicht, geschrieben `shift:06:00-14:00` für die zuletzt begonnene und `last_shift:06:00-14:00` für die davor; Tage, Monate und Schichten sind die des Standorts) oder `?from=&to=` als RFC 3339, from eingeschlossen und to nicht, höchstens 400 Tage. `meters` ist eine kommagetrennte Liste der Zähler, deren Kosten in die Kosten pro Einheit eingehen, und `per` nennt den einen Produktionszähler, durch den geteilt wird.

```json
{"period":"today","from":"2026-11-19T05:00:00Z","to":"2026-11-20T05:00:00Z",
 "meters":[{"id":"main","name":"Main panel","kind":"electricity","unit":"kWh","currency":"USD","value":412.6,"cost":49.51,"covered_seconds":43200,"coverage":1,"estimated":false}],
 "costs":[{"currency":"USD","cost":49.51}],
 "per_unit":[{"production":"parts","units":9800,"currency":"USD","cost":49.51,"cost_per_unit":0.00505}]}
```

`coverage` ist der Anteil des bisherigen Fensters, den Messwerte abdecken. Kosten in zwei Währungen werden nie addiert, also gibt es für jede eine `per_unit`-Zeile. `cost_per_unit` ist `null`, wenn nichts gefertigt wurde (`reason` ist `nothing_made`) oder wenn etwas gefertigt wurde und noch kein Zähler mit Preis Verbrauch gezählt hat (`nothing_counted`): Das ist keine Antwort, nicht null.

Ein Zähler mit `demand_price` hat in seiner Zeile einen `demand`: `peak_kw` (die höchste Viertelstunde des Fensters, als die Kilowatt, die sie im Mittel hatte), `peak_at` (wann sie begann), `peak_covered_seconds` (wie viel dieser Viertelstunde gelesen wurde; unter 900 ist die Spitze zu niedrig angegeben) und `cost` (die Spitze mal der Preis). Die `cost` der Zeile bleibt, was die Energie gekostet hat; `costs` und `per_unit` enthalten den Leistungspreis.

### `GET /api/energy/summary/{period}`

Dasselbe wie die Zusammenfassung, über einen benannten Zeitraum (oder eine Schicht), der im Pfad steht. `meters` und `per` gehören weiter in die Abfrage.

### `GET /api/energy/series`

Der Verbrauch eines Zählers über ein Fenster, `?meter=<id>`, das Fenster wie oben, und `step`: `quarter` (höchstens 8 Tage), `hour` (der Standard), `day` oder `month`. Ein Schritt ohne Messwerte steht nicht in der Liste.

```json
{"meter":"main","unit":"kWh","currency":"USD","step":"day","points":[{"start":"2026-11-19T05:00:00Z","value":412.6,"cost":49.51,"estimated":false}]}
```

### `GET /api/energy/series/{meter}/{period}/{step}`

Dasselbe wie die Reihe, mit Zähler, benanntem Zeitraum und Schritt im Pfad, für einen Aufrufer, der nur einen Pfad angeben kann.

## Dienste

### `POST /api/services/{domain}/{service}`

Steuert eine Entität an: `switch/turn_on`, `number/set_value`, `motor/start`, `alarm/acknowledge`. Eine Entität, ein Dienst, ein Aufruf. Darunter sind es nichts als Tag-Schreibvorgänge durch dasselbe Schreib-Gate wie `POST /api/write`.

```json
{"entity_id":"switch.tank_farm_pump","reason":"start of shift"}
```

`entity_id` ist Pflicht und ist eine Entität, keine Liste; `reason` ist optional; alles andere sind die Daten des Dienstes (`value`, `option`, `position`, `mode`, `minutes`, `note`). Zahlen behalten den Typ, als der sie eingegeben wurden. Die Domäne im Pfad muss die der Entität sein. Jeder Dienst und seine Daten stehen unter [Entitäten](/de/iot/entities/#what-each-domain-takes).

```json
{"call_id":"5c9f8545a93b5443","entity_id":"switch.tank_farm_pump","service":"switch.turn_on","writes":[{"tag":"tank-farm/pump","value":"true","status":"written"}]}
```

Jeder Schreibvorgang ist `written`, `not_sent` (abgelehnt, bevor er das Gerät erreichte), `failed` (er ging hinaus und das Gerät meldete einen Fehler, also ist nicht bekannt, ob er wirkte) oder `skipped` (ein früherer Schreibvorgang des Aufrufs war nicht erfolgreich). Schon gemachte Schreibvorgänge werden nie zurückgenommen. Die Dienste einer Alarm-Entität schreiben keinen Tag und antworten mit dem `alarm`, wie die Engine ihn hinterlassen hat. Die eines Helpers schreiben auch keinen Tag und antworten mit dem `state`, in dem sie ihn hinterlassen haben:

```json
{"call_id":"0f3c2a1b9d8e7f60","entity_id":"input_number.batch_target","service":"input_number.set_value","writes":[],"state":"1250"}
```

Das `turn_on` eines Skripts führt es aus, mit den Daten als seinen Feldern, und antwortet mit dem `script_run`, den es gestartet hat; die Schreibvorgänge seiner Schritte werden einzeln als `script:<id>` auditiert, nicht hier. `turn_off` stoppt jeden Lauf davon. Siehe [Skripte](#skripte).

Das `turn_on` einer Szene wendet ihr Rezept an, mit `params` und `version` aus den Daten, und antwortet mit der ganzen `recipe_application` und in `writes` mit jedem Schreibvorgang, den ihre Ziele gemacht haben, der Reihe nach. Es schlägt fehl, außer jedes Ziel wurde geschrieben. Siehe [Rezepte](#rezepte).

Ein fehlgeschlagener Aufruf antwortet mit dem Status des Fehlers und demselben Body plus `error`, damit man genau sieht, wo er stehen blieb:

```json
{"error":"value is outside the tag's configured range: 150 is outside 0..95","call_id":"3cd42f8275e5765e","entity_id":"number.tank_farm_level_sp","service":"number.set_value","writes":[{"tag":"tank-farm/level_sp","value":"150","status":"not_sent","error":"value is outside the tag's configured range: 150 is outside 0..95"}]}
```

| Status | Wann |
|---|---|
| 400 | Keine `entity_id`, die falsche Domäne, ein unbekannter Dienst, Daten, die der Dienst nicht annimmt |
| 403 | Die Berechtigung, oder das Gate hat aus Richtliniengründen abgelehnt |
| 404 | Keine solche Entität |
| 409 | Ein Umschalten ohne bekannten Zustand, eine Anlage im falschen Zustand für den Dienst |
| 422 | Ein Wert, der inhaltlich abgelehnt wurde |
| 503 | Das Gerät ist nicht verbunden; die Alarm-Engine läuft nicht |
| 500 | Ein Tastendruck ging hinaus und sein Loslassen nicht. **Der Tag kann noch den Druckwert halten**: Prüfen Sie ihn und lassen Sie ihn von Hand los |

**`?dry_run=true`** fragt, was der Aufruf tun würde, und tut nichts davon: Es wird nichts geschrieben, auditiert oder protokolliert. Der Aufruf wird wie der echte geplant, und jeder Schreibvorgang wird den eigenen Prüfungen des Gates unterzogen, in derselben Reihenfolge, jetzt gleich. Ein Urteil antwortet 200, abgelehnt oder nicht: jeder Schreibvorgang `would_write`, oder der erste, der abgelehnt würde, `not_sent` mit dem Grund und die übrigen `skipped`, und `error` ist der Fehler, mit dem der echte Aufruf scheitern würde, Wort für Wort.

```json
{"dry_run":true,"error":"value is outside the tag's configured range: 150 is outside 0..95","entity_id":"number.tank_farm_level_sp","service":"number.set_value","writes":[{"tag":"tank-farm/level_sp","value":"150","status":"not_sent","error":"value is outside the tag's configured range: 150 is outside 0..95"}]}
```

Eine Anfrage, die der echte Aufruf vor jeder Prüfung abweisen würde (keine solche Entität, ein unbekannter Dienst, Daten, die der Dienst nicht annimmt, ein Umschalten ohne bekannten Zustand), antwortet mit Status und Fehler des echten Aufrufs; ebenso eine fehlende Berechtigung. `dry_run` ist `true` oder `false` und sonst nichts: `yes` ist ein 400, kein Raten, weil falsches Raten aus einer Frage einen Befehl macht. Siehe [Entitäten](/de/iot/entities/#asking-first-the-dry-run).

**Warum die Berechtigung im Handler geprüft wird.** Er braucht `values.write`, dasselbe wie das direkte Schreiben des Tags, weil das alles ist, was er ist; die Dienste einer `alarm`-Entität brauchen stattdessen `alarms.ack`, wie der Alarmbildschirm, die eines Helpers brauchen `helpers.write`, das ein Bediener hat, die eines Skripts brauchen `scripts.run`, wie `POST /api/scripts/{id}/run`, und die einer Szene brauchen `recipes.apply` und die eigene Berechtigung des Rezepts, wenn es eine nennt, wie `POST /api/recipes/{id}/apply`. Die Prüfung geschieht im Handler statt davor, damit eine Ablehnung wegen ihres Fehlens an das Schreib-Gate geht und wie jede andere Ablehnung **gegen die Entität auditiert** wird, mit dem Wert, der verlangt wurde. Ein Benutzer ohne die Berechtigung bekommt ein 403 und eine Zeile in `GET /api/writes?entity=...`, nicht ein 403 und nichts. Ein Helper schreibt keinen Tag, also ist die Ablehnung eines Helpers, diese eingeschlossen, stattdessen eine Warnung im Systemprotokoll (`GET /api/events`) gegen den Helper, und ebenso die eines Skripts. Die Ablehnung einer Szene ist eine abgelehnte Anwendung im Verlauf des Rezepts, mit dem Benutzer darauf.

## Helfer

Werte, die den Leuten in der Anlage gehören und nicht einer SPS: `input_boolean`, `input_number`, `input_select`, `input_text`, `input_counter`, `timer` und `schedule`. Ein Helfer ist eine Entität (Plattform `helper`) und erscheint wie jede andere in `/api/entities` und `/api/states`; diese Routen sind seine Konfiguration. Sein Wert wird über die Dienste oben gesetzt, mit `helpers.write`. Jede Domäne, Option und jeder Dienst steht unter [Helfer](/de/iot/helpers/).

### `GET /api/helpers`

Jeder Helfer, jeweils mit den Feldern seiner Entität und seinem `value`, der für ihn gespeicherten Zeile:

```json
[{"id":41,"entity_id":"timer.purge","unique_id":"helper:6f1d...","domain":"timer","platform":"helper","name":"Purge","options":{"duration_sec":600},"...":"...","value":{"state":"active","finishes_at":"2026-09-27T21:10:00Z","duration_ms":600000,"changed_at":"2026-09-27T21:00:00Z","changed_by":"otto","source":"ui","call_id":"9a1b...","rev":4}}]
```

### `POST /api/helpers`

Legt einen Helfer mit seinem Anfangswert an. Nur für Administratoren.

```json
{"name":"Batch target","domain":"input_number","unit_of_measurement":"kg","options":{"min":0,"max":5000,"step":50,"initial":1000}}
```

Außerdem `entity_id` (sonst aus dem Namen erzeugt) und `icon`. Antwortet mit `201` `{"helper": {...}}`. `400` bei einer Domäne, die nicht zu einem Helfer gehört, einer Option, die die Domäne nicht annimmt, oder einem `initial`, das seine eigenen Optionen ablehnen würden; `409` bei einer bereits vergebenen entity_id.

### `GET /api/helpers/{entity_id}`

Ein Helfer, wie in der Liste. `404` bei einer unbekannten Entität oder einer, die kein Helfer ist.

### `PUT /api/helpers/{entity_id}`

Ändert `name`, `icon`, `unit_of_measurement`, `options`, `disabled`, `hidden`, `entity_id`, `equipment_id` oder `labels`, dieselben Felder wie `PUT /api/entities/{entity_id}`. Nur für Administratoren. Neue Optionen, die den Wert, den er jetzt hält, nicht zuließen (ein Bereich, der unter ihn verengt wird, die ausgewählte Auswahl entfernt), ergeben ein `400`: Ein Wert wird nie verschoben, damit er passt. Antwortet mit `{"helper": {...}, "warnings": []}`.

### `DELETE /api/helpers/{entity_id}`

Löscht den Helfer und seinen Wert. Nur für Administratoren. `{"deleted":"timer.purge"}`. `DELETE /api/entities/{entity_id}` lehnt einen Helfer mit einem `409` ab, der hierher verweist.

## Anlagen und Bezeichnungen

Der ISA-95-Baum (Unternehmen, Standort, Bereich, Linie, Zelle, Einheit, Anlage) und frei wählbare Bezeichnungen. In snake_case. Jede Rolle liest; nur ein Administrator ändert, denn das Umbenennen oder Verschieben eines Knotens schreibt Standort, Bereich und Linie jedes Geräts darunter neu. Siehe [der Anlagenbaum und die Bezeichnungen](/de/iot/equipment/).

### `GET /api/equipment`

Jeder Knoten, nach id sortiert, jeweils mit seinem `path` aus Namen ab der Wurzel. `?level=area` filtert. `?q=` behält die Knoten, deren Pfad den Text enthält (ohne Beachtung der Groß- und Kleinschreibung), `?limit=` (1 bis 5000, alles andere ist `400`) die ersten davon; mit einem von beiden gibt `X-Total-Count` an, wie viele passten.

```json
[{"id":4,"parent_id":1,"level":"area","name":"Utilities","created_at":"2026-09-27T20:21:01.637319Z","updated_at":"2026-09-27T20:21:01.637319Z","path":["Demo Plant","Utilities"]}]
```

### `POST /api/equipment`

```json
{"parent_id":3,"level":"cell","name":"Die head","description":"Die and screen changer"}
```

`parent_id` null oder weggelassen erzeugt eine Wurzel. Ein Kind muss eine tiefere Ebene haben als sein Elternknoten (eine Anlage darf in einer Anlage liegen). Antwortet mit `{"equipment": {...}, "devices_rewritten": []}`. `400` bei einer falschen Ebene oder Platzierung, `409` bei einem Geschwisterknoten mit gleicher Ebene und gleichem Namen.

### `GET /api/equipment/{id}`

Der Knoten, die Knoten direkt unter ihm und die Geräte und Entitäten, die direkt auf ihm liegen:

```json
{"children":[],"devices":["extruder-1"],"entities":[],"equipment":{"id":3,"parent_id":2,"level":"line","name":"Line 1","...":"...","path":["Demo Plant","Extrusion","Line 1"]}}
```

`400` bei einer id, die keine positive Zahl ist, `404` bei einer unbekannten.

### `PUT /api/equipment/{id}`

Eines oder mehrere von `name`, `description`, `level`, `parent_id` (`null` verschiebt ihn an die Wurzel). Es ändern sich nur die gesendeten Felder; ein leerer Body ist ein 400. Antwortet mit dem Knoten und **jedem Gerät, dessen Standort-, Bereichs- oder Linientext sich dadurch geändert hat**, denn dieser Text ist es, den ältere Clients und die MCP-Werkzeuge lesen:

```json
{"devices_rewritten":["tank-farm"],"equipment":{"id":4,"parent_id":1,"level":"area","name":"Utilities East","...":"..."}}
```

### `DELETE /api/equipment/{id}`

`{"deleted":5}`. `409`, solange etwas darunter oder darauf liegt, mit der Angabe, was: Einen Knoten unter einem Gerät wegzulöschen, ist keine Entscheidung, die man aus Versehen trifft.

### `GET /api/labels`

```json
[{"label_id":"critical","name":"Critical","color":"red","icon":"mdi:alert","description":"Stops the line if it fails","created_at":"2026-09-27T20:24:29.659126Z","updated_at":"2026-09-27T20:24:29.659126Z"}]
```

### `POST /api/labels`

`name` ist Pflicht; `label_id` (1 bis 64 Kleinbuchstaben, Ziffern und Unterstriche) wird aus dem Namen erzeugt, wenn er fehlt, und ändert sich danach nie. `color`, `icon` (`mdi:...`) und `description` sind optional. Antwortet mit der Bezeichnung. `409` bei einem bereits vergebenen Namen oder einer vergebenen id.

### `GET /api/labels/{label_id}`

`{"label": {...}, "devices": ["tank-farm"], "entities": []}`: die Bezeichnung und was sie trägt. `404` bei einer unbekannten.

### `PUT /api/labels/{label_id}`

Ersetzt `name`, `color`, `icon` und `description`; ein weggelassenes Feld wird geleert. Eine `label_id` im Body muss zum Pfad passen: sonst `400`, denn eine label_id ändert sich nie.

### `DELETE /api/labels/{label_id}`

Entfernt sie von allem, was sie trägt. `{"deleted":"critical"}` oder `404`.

### `PUT /api/devices/{id}/labels`

`{"labels": ["critical"]}` ersetzt die ganze Menge an einem Gerät. Antwortet mit `{"id":"tank-farm","labels":["critical"]}`. Jede Bezeichnung muss existieren (`400` mit den Namen der fehlenden), und das Gerät auch (`404`). Bezeichnungen sind absichtlich nicht Teil von `POST /api/devices`: Jeder Client, der ein Gerät speichert, sendet das ganze Gerät ohne sie und würde sie bei jedem Speichern löschen.

## Alarme

ISA-18.2: Auslösen, Quittieren und Zurückkehren in den Normalzustand sind getrennte Dinge, und das Protokoll kann sagen, welches davon geschah.

### `GET /api/alarms`

Jede Definition, die aktuellen Alarme und die Zusammenfassung. `?outstanding=true` lässt die normalen und die stummgeschalteten aus.

```json
{
  "alarms": [{"definitionId":"extruder-temp-hi","name":"Extruder temperature high","deviceId":"extruder-1","tagName":"Temperature","priority":2,"state":"unack-active","message":"extruder-1/Temperature at 22.80197037650447 C, limit 5","tripValue":22.80197037650447,"raisedAt":"2026-09-27T20:25:19.67042816Z","count":1,"updatedAt":"2026-09-27T20:25:19.67042816Z"}],
  "definitions": [{"id":"extruder-temp-hi","name":"Extruder temperature high","deviceId":"extruder-1","tagName":"Temperature","condition":"hi","limit":5,"priority":2,"enabled":true,"deadband":0.5,"message":"{device}/{tag} at {value}, limit {limit}","createdAt":"2026-09-27T20:25:19.055658Z","updatedAt":"2026-09-27T20:25:19.055658Z"}],
  "summary": {"critical":0,"high":1,"medium":0,"low":0,"unacked":1,"total":1}
}
```

`state` ist `normal`, `unack-active`, `ack-active`, `rtn-unack` (zurückgekehrt, bevor jemand quittiert hat, und auf der Liste behalten, damit ein Auslöser um 3 Uhr nachts nicht verschwindet, bevor ihn die Frühschicht sieht), `shelved` oder `suppressed`. `tripValue` ist der Messwert, der ihn ausgelöst hat, nicht der aktuelle.

### `POST /api/alarms`

Legt eine Definition an oder ersetzt sie.

| Feld | Typ | <span class="sr-only">Details</span> |
|---|---|---|
| `id`, `name` | string | Pflicht. `id` folgt den Regeln für Geräte-IDs |
| `deviceId`, `tagName` | string | Pflicht |
| `condition` | string | `hihi`, `hi`, `lo`, `lolo`, `eq`, `ne`, `true`, `false`, `bad-quality`, `stale` (kein Messwert seit `limit` Sekunden), `roc` (Änderungsrate über `limit` pro Sekunde) |
| `limit` | number | |
| `priority` | int | 1 (kritisch) bis 4 (niedrig) |
| `enabled` | bool | Weggelassen ist `false` |
| `deadband` | number | Wie weit der Wert zurückkommen muss, bevor der Alarm geht. Ohne Totband flattert ein Wert, der genau auf dem Grenzwert liegt |
| `onDelaySec`, `offDelaySec` | int | Wie lange die Bedingung anstehen muss, bevor der Alarm kommt, oder weg sein muss, bevor er in den Normalzustand zurückkehrt |
| `message`, `description` | string | `message` nimmt `{value}`, `{limit}`, `{tag}`, `{device}`, `{unit}`, `{condition}` und `{reason}` (warum der Messwert schlecht ist, leer, wenn er gut ist) |

`{value}` wird so geschrieben, wie die Wertkarte ihn schreibt, Einheit eingeschlossen: ganze Zahlen, wie sie sind, ab 1 zwei Nachkommastellen, ab 100 eine, unter 1 vier, und wissenschaftliche Notation über zehn Millionen oder unter 0.01 (`8.20 pH`, `212.5 F`, `1.235e+7`). Wir haben das so gemacht, weil ein Tag mit Skalierung 0.1 und einem Rohwert von 82 als Float 8.200000000000001 ist und das Banner das früher genau so anzeigte. Ein Textwert wird so ausgegeben, wie er ist. Der Tag, die Schreibvorgänge und die Automatisierungen sehen weiterhin die exakte Zahl; nur der Satz wird gerundet. `{limit}` ist der Grenzwert, wie Sie ihn eingegeben haben.

Antwortet mit der Definition; die Engine lädt neu, und die Alarm-Entität wird vor der Antwort angelegt. `400` bei fehlgeschlagener Prüfung (`"alarm x: priority must be 1-4, got 9"`).

### `POST /api/alarms/import/codesys`

Liest die Datei, die Export Alarms der CODESYS-IDE schreibt (ein Export einer Alarmgruppe, `.csv`), aus dem Request-Body, so wie die IDE sie geschrieben hat (UTF-16 mit Byte-Order-Mark) oder als UTF-8. `?deviceId=` ist das Gerät der SPS und Pflicht. `?application=` ist der Name der Anwendung, unter der ihre Tags liegen, ohne Angabe `Application`: Der Export nennt eine Variable mit ihrer GVL (`GVL_Alarm.bPumpFault`), und der Tag ist `Application.GVL_Alarm.bPumpFault`. `?defaultPriority=` (1 bis 4) ist die Priorität eines Alarms, dessen Klasse nicht Error, Warning oder Info ist. Ohne `?apply=true` wird nichts gespeichert: Die Antwort sagt, was übernommen würde.

Der Bildschirm Alarme bietet das als Aus CODESYS importieren an (nur Administratoren): Gerät wählen, Anwendung benennen, Datei wählen, Vorschau lesen, dann importieren.

Digitale Alarme, die mit `= TRUE` oder `= FALSE` verglichen werden, werden zu `true` und `false`, UpperLimit mit `>` wird zu `hi`, LowerLimit mit `<` wird zu `lo`, ein Outside-range-Alarm (`OutOfArea`, mit beiden Operatoren `<`) wird zu zwei Alarmen, einem `lo` an der unteren und einem `hi` an der oberen Grenze, die Meldung und die Ein- und Ausschaltverzögerungen (eine IEC-Zeit wie `T#5s`) werden übernommen, und Error ist Priorität 2, Warning 3, Info 4. Alles andere, was die IDE schreiben kann, wird nicht gelesen und kommt in `skipped` mit seiner Zeile und dem Grund zurück, denn das Layout ist von CODESYS nicht dokumentiert, und gelesen wird nur, was ein echter Export gezeigt hat. Das gilt auch für den Rest dessen, was die IDE anbietet: Inside the range (`ForbiddenArea`) ist nur zwischen zwei Grenzwerten wahr und ein Alarm hat hier einen, Change hat keine dokumentierte Dauer, und Event und Alarm (API) werden vom SPS-Programm ausgelöst und haben keine Variable, die man überwachen könnte. `warnings` listet auf, was nur teilweise übernommen wurde (eine unbekannte Klasse, Latching, ein Alarm höherer Priorität).

```json
{"applied": false, "version": "2.0.0.0",
 "alarms": [{"id":"codesys-GVL_Alarm.rTemp-hi","name":"Temperature high","deviceId":"plc1","tagName":"Application.GVL_Alarm.rTemp","condition":"hi","limit":90,"priority":3,"enabled":true,"message":"Temperature high"}],
 "skipped": [{"row":5,"id":"3","reason":"the observation type \"Deviation\" has not been seen in an export, so it is not read"}],
 "warnings": []}
```

`404` für ein unbekanntes Gerät, `400` für eine Datei, die kein Export einer Alarmgruppe ist.

### `DELETE /api/alarms/{id}`

`{"deleted":"extruder-temp-hi"}` oder `404`.

### `POST /api/alarms/{id}/ack`

Optionaler Body `{"note": "checking the heater bands"}`. Antwortet mit dem Alarm, wie er jetzt ist, samt `ackedBy` und `ackNote`. `404` für einen unbekannten Alarm.

### `POST /api/alarms/{id}/shelve`

`{"minutes": 30}`, Pflicht und positiv: ein unbefristetes Stummschalten ist eine Unterdrückung, und das ist etwas anderes, das nicht zu den Aufgaben eines Bedieners gehört. Antwortet mit dem Alarm, `state` `shelved`, mit `shelvedUntil` und `shelvedBy`.

### `POST /api/alarms/{id}/unshelve`

Kein Body. Antwortet mit dem Alarm in dem Zustand, den seine Bedingung ihm jetzt gibt. `409`, wenn er nicht ausgeblendet war.

### `GET /api/alarms/events`

Das Audit-Protokoll der Alarme, neueste zuerst. `?alarm=` eine Definition, `?limit=` (Standard 200, höchstens 5000).

```json
[{"id":2,"definitionId":"extruder-temp-hi","type":"acked","fromState":"unack-active","toState":"ack-active","value":23.192472931395088,"message":"extruder-1/Temperature at 22.80197037650447 C, limit 5","actor":"admin","note":"checking the heater bands","at":"2026-09-27T20:25:22.920251Z"}]
```

`type` ist `raised`, `acked`, `cleared`, `shelved`, `unshelved`, `suppressed`, `unsuppressed`, `escalated` oder `escalation-ended`. Die letzten beiden schreibt die Alarmeskalation (`actor` ist `escalation`), und ihr `note` sagt, wer informiert wurde und warum die Kette endete. Siehe [Alarmbenachrichtigungen](/de/iot/notifications/#escalation).

## Automatisierungen

Auslöser, eine Bedingung, Aktionen. Die Regelsprache steht unter [Automatisierungen](/de/iot/automations/).

### `GET /api/automations`

```json
{"armed":{"fill-tank":true},"automations":[{"id":"fill-tank","name":"Fill the tank","enabled":true,"triggers":[{"type":"threshold","deviceId":"tank-farm","tagName":"level","threshold":20,"direction":"falling","hysteresis":5},{"type":"webhook","webhookPath":"fill-now"}],"actions":[{"type":"call_service","name":"start the pump","params":{"service":"switch.turn_on","entityId":"switch.tank_farm_pump"}}],"mode":"skip","minIntervalSec":60,"createdAt":"2026-09-27T20:26:49.770826Z","updatedAt":"2026-09-27T20:26:49.770826Z"}],"webhooks":["fill-now"]}
```

`armed` zeigt, welche Regeln tatsächlich laufen, und das ist nicht dasselbe wie `enabled`: Eine aktivierte Regel, die nicht mehr kompiliert, ist nicht scharf geschaltet, und hier erfahren Sie es.

### `POST /api/automations`

Legt eine Regel an oder ersetzt sie: `id`, `name`, `description`, `enabled`, `triggers` (mindestens einer), `condition`, `actions` (mindestens eine), `mode` (`skip`, der Standard, `queue`, `restart` oder `parallel`), `minIntervalSec`, `maxRuntimeSec`. Die Regel wird vor dem Speichern kompiliert, und eine, die nicht kompiliert, ergibt einen 400 und erreicht nie die Datenbank: Eine gespeicherte Regel, die sich nicht scharf schalten lässt, ist eine Regel, von der ihr Autor glaubt, sie laufe.

```json
{"error":"automation fill-tank action 1 (call_service): params: json: unknown field \"entity_id\""}
```

### `POST /api/automations/validate`

Kompiliert eine Regel, ohne sie zu speichern, für die Live-Prüfung im Editor. Immer `200`; die Antwort sagt, ob sie kompiliert hat:

```json
{"valid":true}
{"error":"automation bad: at least one trigger is required","valid":false}
```

Sie braucht `automations.write`, weil sie dazu da ist, jemandem beim Schreiben einer Regel zu helfen.

### `DELETE /api/automations/{id}`

`{"deleted":"fill-tank"}` oder `404`.

### `POST /api/automations/{id}/enabled`

`{"enabled": false}` schaltet sie ab, ohne sie zu löschen. Antwortet mit `{"enabled":false,"id":"fill-tank"}` oder `404`.

### `POST /api/automations/{id}/trigger`

Führt sie jetzt aus, als hätte ein Auslöser gefeuert. Die Bedingung gilt weiterhin (eine falsche protokolliert einen `skipped`-Lauf), ebenso der Ausführungsmodus; `minIntervalSec` gilt nicht, denn eine Person, die einen Lauf anfordert, ist kein flatternder Tag. Kein Body. `202` `{"triggered":"fill-tank"}`: Der Lauf passiert im Hintergrund, und `GET /api/runs` liefert das Ergebnis. `400`, wenn die Regel nicht scharf geschaltet ist. Bediener haben `automations.trigger`; eine Regel auszuführen, die jemand anderes geschrieben hat, ist Bedienen, eine zu schreiben nicht.

### `GET /api/runs`

Der Verlauf der Läufe, neueste zuerst. `?automation=` eine Regel, `?limit=` (Standard 100, höchstens 1000). `[]`, wenn es keine gibt.

```json
[{"id":1,"automationId":"fill-tank","status":"succeeded","triggerType":"manual","triggerDesc":"triggered by admin","actor":"admin","startedAt":"2026-09-27T20:26:50.269792Z","finishedAt":"2026-09-27T20:26:50.282129Z","durationMs":12.337,"steps":[{"index":1,"type":"call_service","name":"start the pump","input":"switch.turn_on switch.tank_farm_pump {}","output":"true to tank-farm/pump: written; call 8fb9538c82d532be","startedAt":"2026-09-27T20:26:50.272532641Z","durationMs":9.595}]}]
```

`status` ist `running`, `succeeded`, `failed`, `skipped`, `timed_out` oder `cancelled`. Die Schritte behalten die aufgelösten Eingaben, nicht die Vorlagen, weil Sie genau das um 3 Uhr nachts lesen müssen.

Eine Regel, die aus einem Blueprint entstanden ist, trägt in `GET /api/automations` drei weitere Felder: `blueprintId`, `blueprintVersion` (die Version, aus der sie entstanden ist, und bei der sie bleibt) und `blueprintInputs`. Eine von Hand geschriebene Regel hat keines davon. Sie gehören dem Server: `POST /api/automations` nimmt sie an und ignoriert sie, und eine Bearbeitung von Hand behält, was die Regel hatte.

### `POST /api/automations/{id}/blueprint-upgrade`

Hebt eine aus einem Blueprint entstandene Regel auf die neueste Version des Blueprints an und behält dabei ihre id, ihren Namen und ob sie scharf geschaltet ist. Das geschieht nie von selbst. Bediener haben `blueprints.apply`, genau wie zum Anlegen einer solchen Regel. Schauen Sie zuerst: **`?dry_run=true`** ändert nichts und antwortet, was sich Teil für Teil ändern würde und was die Regel dann täte, wenn sie jetzt auslöste, wobei jeder Schreibzugriff den Prüfungen des Schreib-Gates unterzogen wird:

```json
{"dry_run":true,"id":"pump_1_watch","blueprint":"pump_watch","from":1,"to":2,"changes":[{"field":"actions","before":[{"params":{"message":"switch.pump_1 started, v1"},"type":"log_event"}],"after":[{"params":{"message":"switch.pump_1 started, v2"},"type":"log_event"}]}],"automation":{"id":"pump_1_watch","...":"..."},"check":{"automation_id":"pump_1_watch","steps":[{"step":"1","type":"log_event","verdict":"not_checked","detail":"a dry run checks writes to equipment; this step writes to none and runs only for real"}]}}
```

Eine Bearbeitung von Hand, die seit dem Anlegen der Regel erfolgt ist, erscheint in `changes` als ersetzt. Braucht die neue Version eine Eingabe, für die die Regel keinen Wert hat, oder lehnt sie einen Wert ab, mit dem die Regel angelegt wurde, sagt der Probelauf das in `error` und sonst nichts.

Der echte nimmt `{"version": 2}`, die Version, die der Probelauf gezeigt hat, und `inputs` für alles, was die neue Version braucht. Ein Blueprint, der inzwischen weitergezogen ist, oder eine Regel, die in der Zwischenzeit jemand anderes angehoben hat, ergibt einen `409`: Was geprüft wurde, wird übernommen, oder es wird gar nichts übernommen. Eine fehlende Eingabe ergibt einen `400`. `200` mit derselben Form, wobei `automation` die Regel ist, wie sie gespeichert wurde. Es wird protokolliert als `automation upgraded from blueprint pump_watch version 1 to 2`. Mit derselben Version und neuen `inputs` ändern Sie damit die Eingaben einer Regel. `400` für eine von Hand geschriebene Regel; `404`, wenn der Blueprint, aus dem sie stammt, nicht mehr existiert.

## Skripte

Benannte Abfolgen von Aktionen, die auf Abruf laufen: von hier aus, aus dem `call_script`-Schritt einer Regel, aus `run_script` von MCP oder über die Entität des Skripts (`script.turn_on`). Die Abfolge ist die Automatisierungssprache. Jeder Schreibzugriff eines Schritts läuft als `script:<id>` durch das Schreib-Gate, mit der Quelle dessen, der es gestartet hat. Alles steht unter [Skripte](/de/iot/scripts/).

### `GET /api/scripts`

Jedes Skript, mit seinen Laufzählern und der Zahl seiner Läufe, die gerade aktiv sind, in jedem Prozess:

```json
[{"id":"cip_cycle","name":"CIP cycle","fields":[{"name":"minutes","type":"number","required":true,"min":1,"max":60,"unit":"min"}],"sequence":[{"type":"call_service","params":{"entityId":"switch.cip_pump","service":"switch.turn_on"}}],"mode":"skip","createdAt":"2026-09-28T10:00:00Z","updatedAt":"2026-09-28T10:00:00Z","lastRun":"2026-09-28T10:05:00Z","lastStatus":"succeeded","runCount":3,"running":0}]
```

### `POST /api/scripts`

Legt eines an. Nur für Administratoren. `id` (Kleinbuchstaben, Ziffern und Unterstriche, beginnend mit einem Buchstaben: Es ist die Objekt-id der Entität, `script.<id>`), `name`, `description`, `icon`, `fields` (typisierte Eingaben), `sequence` (mindestens eine Aktion), `mode` (`skip`, der Standard, `queue`, `restart` oder `parallel`) und `maxRuntimeSec`. Es wird vor dem Speichern kompiliert, wie eine Regel, und ein Skript, das sich selbst aufrufen würde, direkt oder über andere Skripte, wird abgelehnt. Antwortet mit `201` und dem Skript. `400` für alles, was nicht kompiliert; `409` für eine vergebene id.

### `POST /api/scripts/validate`

Prüft ein Skript, ohne es zu speichern, für die Live-Prüfung im Editor. `200` `{"valid":true}` oder `{"valid":false,"error":"..."}`, in den Worten, mit denen ein Speichern abgelehnt würde.

### `GET /api/scripts/{id}`

Ein Skript, wie in der Liste. `404`, wenn es keines gibt.

### `PUT /api/scripts/{id}`

Ersetzt seine Definition; der Body ist derselbe wie beim Anlegen, und seine `id` darf entfallen. Nur für Administratoren. Laufende Läufe werden abgebrochen, wenn sich seine Schritte, Felder oder sein Modus ändern: Sie wurden mit der alten Definition gestartet.

### `DELETE /api/scripts/{id}`

Löscht es samt seinem Laufverlauf und bricht seine laufenden Läufe ab. Nur für Administratoren. `{"deleted":"cip_cycle"}`. Seine Entität wird verwaist, nicht gelöscht.

### `POST /api/scripts/{id}/run`

Führt es aus. Bediener haben `scripts.run`.

```json
{"fields":{"minutes":20},"reason":"end of shift clean","wait":false}
```

Jedes Feld im Body ist optional, und der Body ebenso. Die Felder werden gegen die des Skripts geprüft, bevor irgendetwas läuft: Ein Wert außerhalb des Bereichs, neben seiner Schrittweite, der keine der Optionen ist oder vom falschen Typ, ergibt einen `400` und wird nie zurechtgerückt. `202` mit dem Lauf, sobald er gestartet ist; mit `"wait":true` `200` mit dem Lauf, sobald er beendet ist, einschließlich seiner Spur.

```json
{"run":{"id":77,"scriptId":"cip_cycle","status":"running","actor":"otto","source":"ui","fields":{"minutes":20},"startedAt":"2026-09-28T10:05:00Z","durationMs":0}}
```

`409`, wenn es beschäftigt ist: Es läuft schon und sein Modus ist `skip`, oder es läuft mit einem wartenden Lauf und sein Modus ist `queue`. Es lief nichts, und im Verlauf steht ein `skipped`-Lauf, der sagt, warum:

```json
{"error":"script busy: script cip_cycle was not started: it is already running, and its mode is skip","run":{"id":78,"scriptId":"cip_cycle","status":"skipped","...":"..."}}
```

**`?dry_run=true`** fragt, was ein Lauf jetzt tun würde, und tut nichts davon. Die Felder werden genauso geprüft; dann wird jeder Schritt gegen die Anlage so durchlaufen, wie sie ist: Jeder Schreibzugriff und jeder Dienstaufruf wird den eigenen Prüfungen des Gates unterzogen, eine Bedingung wird ausgewertet, eine Variable gebunden. Ein Warten, eine Verzögerung und alles, was auf keine Anlage schreibt, sind `not_checked`. Der erste Schreibzugriff, der abgelehnt würde, beendet ihn, wie er den Lauf beenden würde, und `error` sagt das in den Worten des Gates. `200` mit dem Urteil, abgelehnt oder nicht:

```json
{"dry_run":true,"check":{"script_id":"cip_cycle","fields":{"minutes":20},"steps":[{"step":"1","type":"call_service","input":"switch.turn_on switch.cip_pump {}","verdict":"refused","detail":"cip/pump: this tag is not marked writable"}],"error":"step 1 (call_service): cip/pump: this tag is not marked writable"}}
```

Das `verdict` jedes Schritts ist `would_write`, `refused`, `ends_here` (eine Bedingung, die jetzt falsch ist, oder ein Stopp), `not_checked` oder `ok`. Ein Schritt eines Skripts, das es aufruft, wird unter dem Aufruf nummeriert: `3.1`.

### `POST /api/scripts/{id}/stop`

Bricht alle seine laufenden Läufe ab, in jedem Prozess, wo auch immer sie sind. `{"cancelled":1,"stopped":"cip_cycle"}`, wobei `cancelled` die Läufe sind, die dieser Prozess hatte. Bediener haben `scripts.run`: Zu stoppen, was sie starten dürfen, gehört zum Starten.

### `GET /api/scripts/{id}/runs`

Seine Läufe, neueste zuerst, mit ihren Spuren. `?limit=` (Standard 50, höchstens 1000). `parent` ist das, was einen Lauf aufgerufen hat, wenn etwas es getan hat: `automation_run:812`, `script_run:77`.

```json
[{"id":77,"scriptId":"cip_cycle","status":"succeeded","actor":"automation:shift-end","source":"automation","parent":"automation_run:812","fields":{"minutes":20},"startedAt":"2026-09-28T10:05:00Z","finishedAt":"2026-09-28T10:25:00Z","durationMs":1200012,"steps":[{"index":1,"type":"call_service","input":"switch.turn_on switch.cip_pump {}","output":"true to cip/pump: written; call 8fb9538c82d532be","startedAt":"2026-09-28T10:05:00Z","durationMs":9.6}]}]
```

## Rezepte

Wertesätze, die gemeinsam angewendet werden: die Sollwerte einer Produktsorte, ein Sortenwechsel. Jeder ist zugleich eine Entität, `scene.<id>`. Ein Rezept wird als Ganzes geprüft, bevor etwas hinausgeht, und aus jedem Grund als Ganzes abgelehnt; seine Ziele gehen dann der Reihe nach unter einer einzigen Aufruf-id hinaus, das erste, das fehlschlägt, stoppt die übrigen, und nichts wird rückgängig gemacht; jeder geschriebene Wert wird vom Gerät zurückgelesen. Alles steht unter [Rezepte](/de/iot/recipes/).

Name, Beschreibung, Anlagenknoten und Berechtigung eines Rezepts ändern sich an Ort und Stelle. Was es schreibt (`targets`, `params`, `precondition`, `verify_sec`), ist eine Version, und Versionen werden nie verändert: Neuer Inhalt wird als nächste Version gespeichert.

### `GET /api/recipes`

Jedes Rezept, mit dem Inhalt seiner aktuellen Version und seiner neuesten Anwendung:

```json
[{"id":"grade_a","name":"Grade A","equipment_id":7,"apply_permission":"recipes.apply","current_version":3,"params":[{"name":"speed","type":"number","min":0,"max":400,"step":10,"unit":"rpm","required":true}],"precondition":"states['input_boolean.line_ready'] == 'on'","targets":[{"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210}},{"entity_id":"number.line_02_speed","service":"set_value","data_expressions":{"value":"vars.speed"}}],"verify_sec":10,"note":"zone 1 up 5","created_at":"2026-09-28T10:00:00Z","updated_at":"2026-09-28T11:00:00Z","last_application":{"id":41,"recipe_id":"grade_a","version":3,"call_id":"7c1f0e2d9a8b6c54","actor":"otto","source":"ui","params":{"speed":250},"status":"applied","targets":[],"started_at":"2026-09-28T11:05:00Z","finished_at":"2026-09-28T11:05:01Z"}}]
```

`equipment_id` ist `null` bei einem Rezept für die ganze Anlage.

### `POST /api/recipes`

Legt eines an, als Version 1. Nur für Administratoren. `id` (Kleinbuchstaben, Ziffern und Unterstriche, beginnend mit einem Buchstaben: Es ist die Objekt-id der Entität, `scene.<id>`), `name`, `description`, `equipment_id`, `apply_permission` (`recipes.apply`, der Standard, oder `recipes.apply.<name>`), `params` (typisierte Eingaben), `precondition` (ein Ausdruck, der zum Start wahr sein muss), `targets` (mindestens eines, höchstens 200, jedes mit `entity_id`, `service` und `data` oder `data_expressions`), `verify_sec` (1 bis 600, Standard 10) und `note`. Ein Ziel setzt einen Wert: `set_value`, `select_option`, `set_position`, `set_speed`, `set_setpoint`, `set_mode`, `turn_on`, `turn_off`, auf den Domänen, die sie annehmen. Ein Impuls oder ein Start wird abgelehnt: Er gehört in ein Skript. Die Entität jedes Ziels muss existieren, und jeder Ausdruck muss kompilieren. `201` mit dem Rezept; `400` bei allem, was nicht stimmt, `409` bei einer vergebenen id.

### `POST /api/recipes/capture`

Entwirft ein Rezept aus dem, was Entitäten jetzt halten, nur für Administratoren, und speichert nichts:

```json
{"entity_ids":["number.line_02_zone1_sp","switch.line_02_heater","loop.line_02_tic"]}
```

Jede wird zu einem Ziel, das sie in der angegebenen Reihenfolge auf ihren aktuellen Wert zurücksetzt; ein Regelkreis wird zu seinem Modus und dann seinem Sollwert. Die Antwort ist ein Rezept ohne id und ohne Namen, für den Editor. Eine Entität, die nicht existiert, deaktiviert ist, mit einer anderen Qualität als gut gelesen wird, `unknown` oder `unavailable` ist oder nichts ist, was ein Rezept setzt, ergibt einen `400`, der jede einzelne nennt: Ein Rezept aus einem schlechten Messwert schreibt den schlechten Messwert zurück.

### `GET /api/recipes/{id}`

Ein Rezept, wie in der Liste. `404`, wenn es keines gibt.

### `PUT /api/recipes/{id}`

Speichert es. Nur für Administratoren. Der Body ist das Rezept, wie `GET` es geantwortet hat, bearbeitet; seine `id` darf entfallen. `current_version` ist die Version, auf die sich die Bearbeitung bezog: Hat jemand seitdem eine andere gespeichert, ergibt das Speichern einen `409`, statt seine stillschweigend zu überschreiben (`0` überspringt die Prüfung). Neuer Inhalt wird die nächste Version, mit `note`, die sagt, warum; eine Änderung nur von Name, Beschreibung, Anlage oder Berechtigung erzeugt keine.

### `DELETE /api/recipes/{id}`

Löscht es samt seinen Versionen. Nur für Administratoren. `{"deleted":"grade_a"}`. Seine Anwendungen bleiben erhalten, weil sie das sind, was an die Anlage gesendet wurde, und seine Entität wird verwaist.

### `GET /api/recipes/{id}/versions`

Jede Version, neueste zuerst, jede genau so, wie sie gespeichert wurde, mit dem, der sie gespeichert hat, und der Notiz:

```json
[{"recipe_id":"grade_a","version":3,"params":[],"targets":[{"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210}}],"verify_sec":10,"note":"zone 1 up 5","created_by":"ada","created_at":"2026-09-28T11:00:00Z"}]
```

### `GET /api/recipes/{id}/versions/{version}`

Eine Version. `404`, wenn das Rezept keine solche Version hat, `400`, wenn `{version}` keine Zahl ist.

### `POST /api/recipes/{id}/validate`

Würde es jetzt angewendet? Bediener haben `recipes.apply`. Der Body ist der einer Anwendung, und nichts wird geschrieben, aufgezeichnet oder protokolliert. Jede Prüfung, die eine Anwendung vor dem Schreiben macht, wird gemacht: die Parameter, die eigene Berechtigung des Rezepts, die Vorbedingung, die Datenausdrücke, ob eine andere Anwendung auf eine seiner Entitäten schreibt, und jedes Ziel, den Prüfungen des Schreib-Gates unterzogen. `200` mit dem Urteil, `would_apply` oder `refused`, und dem jedes Ziels: `would_write`, `refused` mit dem Grund oder `not_sent`.

```json
{"dry_run":true,"application":{"recipe_id":"grade_a","version":3,"params":{"speed":250},"status":"refused","targets":[{"index":1,"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210},"status":"would_write"},{"index":2,"entity_id":"number.line_02_speed","service":"set_value","data":{"value":250},"status":"refused","error":"line-02/Speed: this tag is not marked writable"}],"started_at":"2026-09-28T11:04:00Z","error":"target 2 (set_value number.line_02_speed): line-02/Speed: this tag is not marked writable"}}
```

Parameter, die es nicht annimmt, ergeben einen `400`, wie bei der echten Anwendung.

### `POST /api/recipes/{id}/apply`

Wendet es an. Bediener haben `recipes.apply`. Ein Rezept, das eine eigene Berechtigung nennt, `recipes.apply.<name>`, verlangt auch diese, hier gegen das Rezept geprüft; ein Benutzer ohne sie erhält einen `403` und eine abgelehnte Anwendung im Verlauf, mit seinem Namen darauf.

```json
{"params":{"speed":250},"reason":"grade A for the 2pm run","version":0,"resume":0}
```

Alles ist optional, ebenso der Body. `version` wendet absichtlich eine ältere Version an; ohne sie die aktuelle. `resume` ist die id einer früheren Anwendung dieses Rezepts, die auf halbem Weg stehen blieb: Ihre Ziele, die nicht geschrieben wurden, gehen als neue Anwendung hinaus, mit ihrer Version und ihren Parametern, und `parent` sagt, welche sie beendet.

Es antwortet, sobald jeder Wert geschrieben und zurückgelesen wurde, was bis zu `verify_sec` des Rezepts dauert:

```json
{"application":{"id":42,"recipe_id":"grade_a","version":3,"call_id":"9d2e4f6a8b0c1e3f","actor":"otto","source":"ui","reason":"grade A for the 2pm run","params":{"speed":250},"status":"applied","targets":[{"index":1,"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210},"status":"written","writes":[{"tag":"line-02/Zone1_SP","value":"210","status":"written"}],"verification":"verified","verify_detail":"read back 210"},{"index":2,"entity_id":"number.line_02_speed","service":"set_value","data":{"value":250},"status":"written","writes":[{"tag":"line-02/Speed","value":"250","status":"written"}],"verification":"unconfirmed","verify_detail":"not confirmed within 10s: read back 240, not 250"}],"started_at":"2026-09-28T11:05:00Z","finished_at":"2026-09-28T11:05:10Z"}}
```

Ein Ziel ist `written`, `failed` (es ging hinaus und das Gerät sagte nein oder nichts), `not_sent`, `skipped` (eines davor ging nicht durch) oder `refused` (Vorabprüfung). Ein geschriebenes ist `verified`, wenn das Gerät nach dem Senden den Wert zurückgelesen hat, der ihm gesendet wurde, und `unconfirmed`, wenn es das nicht innerhalb von `verify_sec` tat: Es ging hinaus und wurde womöglich nicht übernommen. Jeder Schreibzugriff trägt die `call_id` der Anwendung, sodass `GET /api/writes?call=<call_id>` alle liefert.

| Status | Wann |
|---|---|
| 200 | `applied`: jedes Ziel geschrieben. Prüfen Sie die `verification` jedes einzelnen |
| 400 | Ein Parameter, den das Rezept nicht annimmt, außerhalb des Bereichs oder vom falschen Typ; ein `resume` ohne etwas, das noch anzuwenden wäre |
| 403 | Die eigene Berechtigung des Rezepts. Als abgelehnte Anwendung aufgezeichnet |
| 404 | Kein solches Rezept oder keine solche Version |
| 409 | `refused`: jeder Grund, nicht zu starten, jeder in `error` und an seinem Ziel. Oder eine andere Anwendung schreibt gerade auf eine seiner Entitäten. Es wurde nichts geschrieben |
| 502 | `partial` oder `failed`: Es startete, und nicht jedes Ziel ging hinaus. `targets` sagt genau, welche. Nichts wird rückgängig gemacht |

Jede Antwort außer einem `400` für einen fehlerhaften Body oder einem `404` trägt die Anwendung, und jede Anwendung außer einem Probelauf steht in `GET /api/recipes/{id}/applications`, Ablehnungen eingeschlossen.

### `GET /api/recipes/{id}/applications`

Seine Anwendungen, neueste zuerst, abgelehnte eingeschlossen. `?limit=` (Standard 50, höchstens 1000). `parent` ist das, was sie angewendet hat, wenn etwas es tat: `automation_run:812`, `script_run:77`, `application:41`. Die Anwendungen eines gelöschten Rezepts werden weiterhin beantwortet.

## Blueprints

Eine einmal geschriebene Automatisierung mit typisierten Platzhaltern, ausgefüllt, um eine gewöhnliche Regel zu erzeugen. Die Regel behält die Version, aus der sie entstanden ist; das Bearbeiten des Blueprints ändert keine Regel, und eine auf eine neuere Version zu heben ist [ein Upgrade](#post-apiautomationsidblueprint-upgrade), das jemand anfordert. Jeder Schreibzugriff der Regel läuft als `automation:<id>` durch das Schreib-Gate. Alles steht unter [Blueprints](/de/iot/blueprints/).

### `GET /api/blueprints`

Jeder Blueprint, die eingebauten zuerst, jeder mit der Zahl der Regeln, die aus ihm entstanden sind:

```json
[{"id":"motor_running_too_long","name":"Motor running too long","description":"Says so when a motor has been running longer than it should...","source":"builtin","version":1,"inputs":[{"name":"motor","label":"Motor","type":"entity","required":true,"domain":["motor"]},{"name":"max_run","label":"Longest it may run","type":"duration","default":3600},{"name":"stop_it","label":"Stop it as well","type":"boolean","default":false}],"template":{"triggers":[{"type":"state","entityId":{"!input":"motor"},"to":"running","forSec":{"!input":"max_run"}}],"...":"..."},"instances":2}]
```

`source` ist `builtin` (steckt in der Binärdatei, schreibgeschützt) oder `user`.

### `POST /api/blueprints`

Schreibt einen. Nur für Administratoren. `id` (Kleinbuchstaben, Ziffern und Unterstriche, beginnend mit einem Buchstaben), `name`, `description`, `inputs` (typisiert, wie die Felder eines Skripts) und `template`: die Regel, mit ihren `description`, `triggers`, `condition`, `actions`, `mode`, `minIntervalSec` und `maxRuntimeSec`, und den Platzhaltern darin. `{"!input": "motor"}` als Wert wird durch die Eingabe ersetzt; `${motor}` in einer Zeichenkette ebenfalls, als Literal, wo die Zeichenkette ein Ausdruck ist. Er wird vor dem Speichern geprüft: Jeder Platzhalter nennt eine Eingabe, jede Eingabe wird verwendet, und mit Beispielwerten gefüllt ergibt er eine Regel, die kompiliert. `201` mit `version` 1. `400` bei allem, was daran nicht stimmt, `409` bei einer vergebenen id, die eines eingebauten eingeschlossen.

### `GET /api/blueprints/{id}`

Einer, wie in der Liste. `404`, wenn es keinen gibt.

### `PUT /api/blueprints/{id}`

Ersetzt seine Definition; der Body ist derselbe wie beim Schreiben eines solchen, und seine `id` darf entfallen. Nur für Administratoren. `version` steigt um eins, wenn sich `inputs` oder `template` geändert haben, und nicht bei einem neuen Namen oder einer neuen Beschreibung. **Keine aus ihm entstandene Regel ändert sich.** Jede behält die Version, aus der sie entstanden ist, und `GET /api/automations` zeigt, welche. Ein eingebauter ergibt einen `400`: Kopieren Sie ihn unter einer eigenen id.

### `DELETE /api/blueprints/{id}`

Nur für Administratoren. `{"deleted":"pump_watch"}`. `409`, solange irgendeine aus ihm entstandene Regel existiert, mit deren Namen: Löschen Sie diese zuerst. Ein eingebauter ergibt einen `400`.

### `POST /api/blueprints/{id}/instantiate`

Erzeugt daraus eine Regel und schaltet sie scharf. Bediener haben `blueprints.apply`: Welche Pumpe und wie lange, dürfen sie wählen, und was die Regel tut, wurde beim Schreiben des Blueprints entschieden.

```json
{"automationId":"infeed_too_long","name":"Infeed pump ran too long","enabled":true,"inputs":{"motor":"motor.infeed_pump","max_run":"90m","stop_it":true}}
```

`name` ist standardmäßig der des Blueprints und `enabled` ist `true`. Jede Eingabe wird geprüft, bevor etwas erzeugt wird: Ein Wert außerhalb des Bereichs, neben seiner Schrittweite, der keine seiner Optionen ist, eine Entität einer anderen Domäne oder vom falschen Typ ergibt einen `400`, der jede falsche nennt, und wird nie zurechtgerückt. Eine vergebene `automationId` ergibt einen `409`: Eine Regel zu erzeugen ersetzt nie eine. `201` mit der Regel, ihre `blueprintId`, `blueprintVersion` und `blueprintInputs` gesetzt. Es wird protokolliert als `automation made from blueprint motor_running_too_long version 1`.

**`?dry_run=true`** erzeugt nichts. Er antwortet mit der Regel, die er erzeugen würde, und mit dem, was diese Regel täte, wenn sie jetzt auslöste: die Bedingung ausgewertet, jeder Schreibzugriff und Dienstaufruf den Prüfungen des Gates als `automation:<id>` unterzogen, die erste Ablehnung in `check.error` in den Worten des Gates. Nichts wird gespeichert, geschrieben oder auditiert.

```json
{"dry_run":true,"automation":{"id":"infeed_too_long","...":"..."},"check":{"automation_id":"infeed_too_long","steps":[{"step":"1","type":"log_event","verdict":"not_checked"},{"step":"2","type":"condition","input":"true","verdict":"ok","detail":"true now"},{"step":"3","type":"call_service","input":"motor.stop motor.infeed_pump {}","verdict":"would_write","detail":"would write false to line-02/M1_Run"}]}}
```

## Dashboards

Seiten aus Karten, für die Rollen und die Bildschirme, die sie brauchen. Ein Dashboard befiehlt nichts: Eine Karte nennt einen Tag, eine Entität, ein Skript oder ein Rezept, und ihre Schaltfläche schreibt über [`POST /api/write`](#post-apiwrite) als die Person, die sie gedrückt hat. Die Wandtafel ist eines davon. Alles steht unter [Dashboards](/de/iot/dashboards/).

### `GET /api/dashboards`

Die Dashboards, die dem Aufrufer angeboten werden, in der Reihenfolge, in der der Umschalter sie zeigt, die Wandtafel eingeschlossen. Wer `dashboards.write` hat, dem werden alle angeboten.

```json
[{"id":"wall","name":"Wall board","description":"The tags pinned on the Board screen, as gauges.","kind":"wall","roles":[],"homeFor":[],"screens":["wall-tv"],"position":0,"cards":[],"version":2,"updatedBy":"ada"},
 {"id":"line-2","name":"Line 2","kind":"cards","roles":["operator","admin"],"homeFor":["operator"],"screens":["line-2-panel"],"position":1,"version":3,"updatedBy":"ada","cards":[{"id":"temp","type":"gauge","title":"Zone 1","w":3,"h":3,"config":{"tag":"press-01/Zone1_Temp"}}]}]
```

### `POST /api/dashboards`

Baut eines. Nur für Administratoren. `id` (Kleinbuchstaben, Ziffern, Bindestriche und Unterstriche, beginnend mit einem Buchstaben), `name`, und optional `description`, `roles`, `homeFor`, `screens`, `position` und `cards`. `201` mit `version` 1, mit Größe und Konfiguration jeder Karte in der Form, in der sie gespeichert wurden.

Eine Karte besteht aus `id`, `type`, `title`, `w` (1 bis 12 Spalten), `h` (1 bis 8 Zeilen) und einer `config`. Die Typen und ihre Konfigurationen stehen unter [Dashboards](/de/iot/dashboards/#die-karten). Es wird vor dem Speichern geprüft:

- ein Konfigurationsschlüssel, den der Typ nicht hat, eine Zahl außerhalb des Bereichs, eine Kamera- oder Grundrissadresse mit einem Login oder Token darin oder mehr als 60 Karten ergibt einen `400`;
- eine Karte, die einen Tag, eine Entität, ein Skript oder ein Rezept nennt, das nicht existiert, ergibt einen `400`, der es nennt;
- ein `button` auf einem Tag, der nicht beschreibbar ist, oder mit einer Zahl außerhalb des Bereichs des Tags ergibt einen `400`: Das Gate würde jeden Druck ablehnen;
- eine Rolle, die nicht existiert, ergibt einen `400`;
- eine vergebene `id`, ein Bildschirm, den ein anderes Dashboard schon hat, oder eine Startseite einer Rolle, die ein anderes Dashboard schon ist, ergibt einen `409`.

### `GET /api/dashboards/{id}`

Eines, wie in der Liste. `404`, wenn es keines gibt, und auch, wenn es dem Aufrufer nicht angeboten wird.

### `PUT /api/dashboards/{id}`

Ersetzt es. Nur für Administratoren. Der Body ist das Dashboard, wie `GET` es geantwortet hat, mit `version` auf die Version gesetzt, bei der es gelesen wurde: **Sie ist Pflicht**, und ein Speichern, das eine Version nennt, die nicht mehr die aktuelle ist, ergibt einen `409`, der sagt, welche die aktuelle ist, denn die Alternative ist, stillschweigend zu löschen, was die letzte Person, die gespeichert hat, gerade gebaut hat. Die `id` darf im Body entfallen, `kind` kann sich nicht ändern, und `createdAt`, `updatedAt` und `updatedBy` gehören dem Server und werden ignoriert. `200` mit dem Dashboard in der nächsten Version.

Die Wandtafel nimmt ein `PUT` nur für ihre Zuweisungen (`roles`, `homeFor`, `screens`, `position`) und sonst nichts: Sie hat keine Karten, daher ergibt eines mit Karten einen `400`. Ihre Anzeigen sind die Tags der Tafel, `GET` und `PUT /api/board`.

### `DELETE /api/dashboards/{id}`

Nur für Administratoren. `{"deleted":"line-2"}`. Karten zeigen auf Dinge und besitzen nichts, daher wird sonst nichts berührt. Die Wandtafel ergibt einen `400`: Sie ist immer da.

Anlegen, Speichern und Löschen werden als `config`-Ereignisse zum Subjekt `dashboard:<id>` protokolliert.

### `GET /api/dashboards/{id}/export`

Das Dashboard als Bildschirmdatei: ein versioniertes JSON-Dokument, das [`POST /api/dashboards/import`](#post-apidashboardsimport) in eine andere Installation lädt. Es antwortet als Anhang namens `<id>.hotloop-screen.json`. Der Aufrufer braucht `dashboards.read` und muss das Dashboard angeboten bekommen, wie bei `GET` eines einzelnen. Die Wandtafel ergibt einen `400`: Sie sind die angehefteten Anzeigen einer Installation, kein Layout. Das Format steht unter [Bildschirmdateien](/de/iot/screen-file/).

### `POST /api/dashboards/import`

Liest eine Bildschirmdatei, prüft sie gegen diese Installation und speichert sie als neues Dashboard. Nur für Administratoren, und es kann nichts speichern, was `POST /api/dashboards` ablehnen würde. Der Body ist die Datei selbst oder `{"file": {...}}` mit Optionen daneben:

| Option | <span class="sr-only">Details</span> |
|---|---|
| `id`, `name` | Unter einer anderen id oder einem anderen Namen speichern. |
| `replace` | Ist die id vergeben, über dieses Dashboard in seiner aktuellen Version speichern. Ohne sie ergibt eine vergebene id einen `409`. |
| `skipAssignments` | `screens` und `homeFor` der Datei weglassen, die zu der Installation gehören, die sie erzeugt hat. `roles` bleiben. |
| `remap` | Wie die Dinge hier heißen sollen: `tags` (ganzer Schlüssel auf ganzen Schlüssel, so wie die Datei den Tag nennt oder wie er lautet, nachdem `devices` ihn verschoben hat), `devices` (id auf id, was auch den Geräteteil jedes nicht in `tags` genannten Tags verschiebt), `entities`, `scripts`, `recipes` und `equipment` (id auf id). Ein Eintrag, den nichts auf dem Bildschirm verwendet hat, ist eine Warnung. |
| `dryRun` | Den Bericht beantworten und nichts speichern. Immer `200`. |
| `codesys`, `visualization` | Anstelle von `file`: der Text eines nativen CODESYS-Exports und die Visualisierung, die genommen wird, wenn er mehrere enthält. Der Bericht hat dann eine `conversion` mit dem, was aus jedem Element wurde und was weggelassen wurde. Siehe [Einen CODESYS-Bildschirm importieren](/de/iot/codesys-screen-import/). |

Die Antwort ist ein Bericht, ob etwas gespeichert wurde oder nicht:

```json
{"ok":false,"dryRun":true,"id":"line-2","name":"Line 2","cards":6,"replaces":false,
 "problems":[{"kind":"tag","ref":"press-01/Zone1_Temp","message":"tag press-01/Zone1_Temp does not exist here; map it to one that does, or add it on the Tags screen first"}],
 "warnings":[],"remapped":[],
 "requires":{"tags":[{"key":"press-01/Zone1_Temp","writable":false}],"entities":[],"scripts":[],"recipes":[],"devices":[],"equipment":[]}}
```

Jede fehlende Referenz wird aufgelistet, nicht nur die erste. Ein `kind` ist `file` (keine Bildschirmdatei, das falsche Format, eine neuere Formatversion, als dieser Build liest, oder ein Feld, das er nicht kennt), `screen` (die eigenen Regeln des Dashboards: eine fehlerhafte Karte, eine Rolle, die nicht existiert, zu groß), `tag`, `entity`, `script`, `recipe`, `device`, `equipment`, `writable` (eine Schaltfläche oder ein Sollwert auf einem nicht beschreibbaren Tag), `assignment` (ein Bildschirmname oder eine Startseite einer Rolle, die ein anderes Dashboard hält) oder `exists` (die id ist vergeben). Ein Import mit irgendeinem Problem speichert nichts: `400`, oder `409`, wenn das einzige Problem `exists` oder `assignment` ist, mit demselben Bericht. Erfolg ist `201`, oder `200`, wenn er eines ersetzt hat, mit dem Bericht und dem gespeicherten `dashboard`. Es wird als `config`-Ereignis zum Subjekt `dashboard:<id>` protokolliert.

## Webhooks

### `POST /api/webhook/{path}`

Löst jede Automatisierung mit einem `webhook`-Auslöser auf diesem Pfad aus. **Keine Sitzung und keine Berechtigung**: Der Pfad ist das Geheimnis, das einem Dritten gegeben wird, dasselbe Vertrauensmodell, das dieser Endpunkt schon immer hatte, und ein SCADA-System oder ein SaaS-Callback hat kein Konto zum Anmelden. Wählen Sie einen Pfad, den niemand erraten könnte.

Der Body, bis zu 1 MiB, wird an die Regel übergeben. `202` `{"accepted":"fill-now"}`. `404` `"no automation is listening on this webhook path"`, wenn nichts lauscht: Ein Webhook, der ins Leere postet, sieht genauso aus wie einer, der funktioniert, also sagt er es.

## Flotte

Registrierte Edge-Relays, ihre Live-Präsenz über Sparkplug und Befehle an sie. Braucht `HOTLOOP_FLEET_ENABLED`. Siehe [Flottenverwaltung](/de/gateway/fleet/).

### `GET /api/fleet`

```json
{"configured":true,"members":[{"id":"press-relay-01","name":"Press line relay","group":"plant-a","nodeId":"press-relay-01","statusUrl":"http://press-relay-01:8081","enabled":true,"createdAt":"2026-09-27T20:28:49.448323Z","updatedAt":"2026-09-27T20:28:49.448323Z","online":false,"polled":true,"error":"Get \"http://press-relay-01:8081/status\": dial tcp: lookup press-relay-01 on 10.89.0.1:53: no such host"}]}
```

`online` stammt aus NBIRTH und NDEATH. `release` ist der Build, den das Relay in seiner letzten Birth-Meldung als laufend angegeben hat: `version`, `imageDigest` (wenn sein Supervisor es sagt; das Helm-Chart tut es nicht) und `since`, wann das Gateway diesen Build zum ersten Mal gehört hat. Ein Relay, das zu alt ist, um einen zu melden, hat keinen. Bei einem Mitglied mit `statusUrl` ist `polled` wahr, und `reachable`, `forwardQueueLen`, `devices`, `connected`, `config` und `updateMode` (`auto` oder `approve`) stammen aus seinem `/status`; sie bedeuten nichts, wenn es nicht erreichbar war. Bei abgeschalteter Funktion: `{"members":[],"configured":false}`.

### `POST /api/fleet`

Legt ein Mitglied an oder ersetzt es: `id`, `name`, `group` und `nodeId` (seine Sparkplug-Identität) sind Pflicht; `description`, `statusUrl` (`http://` oder `https://`) und `enabled` optional. Antwortet mit dem Mitglied. Dieser funktioniert bei abgeschalteter Funktion, damit die Flotte deklariert werden kann, bevor sie eingeschaltet wird.

### `DELETE /api/fleet/{id}`

`{"deleted":"press-relay-01"}` oder `404`.

### `POST /api/fleet/{id}/rebirth`

Veröffentlicht ein `Node Control/Rebirth` an das Relay. Kein Body. `{"status":"rebirth requested"}`. `404` für ein unbekanntes Mitglied.

### `POST /api/fleet/{id}/restart`

Veröffentlicht `Node Control/Reboot`. `{"status":"restart requested"}`. Nur für Administratoren: Ein Relay neu zu starten, verliert seine Daten, bis es zurück ist.

### `POST /api/fleet/{id}/update`

Genehmigt das Image-Update, das ein Relay zurückhält. Veröffentlicht `Node Control/Update`. `{"status":"update approved"}`. Nur für Administratoren: Das Relay beendet sich und sein Supervisor startet das Image, dem es folgt, es verliert also seine Daten für die Zeit, die das dauert. Es bewirkt nur bei einem Relay etwas, das auf `HOTLOOP_EDGE_RELAY_UPDATE_MODE=approve` steht; jedes andere Relay protokolliert, dass es ihn ignoriert hat. Die Anfrage nennt kein Image: Es gibt nichts, wo man eines eintragen könnte, und das ist der Punkt. Siehe die [Edge-Relay-Referenz](/de/edge-relay/reference/#ein-relay-aktualisieren).

### `POST /api/fleet/{id}/config`

Schiebt eine neue Gerätedatei auf das Relay, das sie live anwendet: kein Neustart, seine Broker-Sitzung und Weiterleitungswarteschlange bleiben erhalten, und jedes Gerät, das die Datei nicht geändert hat, bleibt verbunden. Der Body ist **die Gerätedatei selbst**, rohes JSON, in nichts eingewickelt. Sie wird validiert, bevor etwas veröffentlicht wird (`400` `"invalid device file: ..."`, wenn nicht). `{"status":"config pushed"}` bedeutet, dass der Broker sie genommen hat; ob das Relay sie ausführt, sagt `config.digest` bei diesem Mitglied in `GET /api/fleet`, und eine Datei, die das Relay abgelehnt hat, erscheint dort als `config.rejected`. Nur für Administratoren: Es ändert, was das Relay abfragt. Siehe [Flottenverwaltung](/de/gateway/fleet/#konfiguration-senden).

### `DELETE /api/fleet/{id}/config`

Nimmt den Push zurück. Löscht die gehaltene Konfiguration auf dem Broker, damit kein späterer Start sie anwendet, und ein Relay, das gerade verbunden ist, verwirft seine geschobene Datei und kehrt live zu seiner lokalen Gerätedatei zurück. Kein Body. `{"status":"config push cleared"}`, `404` für ein unbekanntes Mitglied, `503`, wenn das Gateway nicht mit dem Broker verbunden ist. Nur für Administratoren, wie das Pushen. Es startet nichts neu. Senden Sie es, solange das Relay online ist: Ein Offline-Relay hört es nie. Siehe die [Edge-Relay-Referenz](/de/edge-relay/reference/#wo-eine-gepushte-datei-liegt-und-welche-datei-gewinnt).

## Benachrichtigungen

Ein Telefon anpiepsen, wenn ein Alarm ausgelöst wird, über Webhook, SMTP, ntfy oder Gotify, und die nächste Person informieren, wenn niemand ihn quittiert. Braucht `HOTLOOP_NOTIFY_ENABLED`.

### `POST /api/notify/test`

Sendet jetzt eine synthetische Alarmbenachrichtigung über jeden konfigurierten Kanal, damit Sie merken, dass das SMTP-Relay Sie abweist, bevor es ein echter Alarm tut. Kein Body. Braucht `HOTLOOP_NOTIFY_ENABLED`. Nur für Administratoren: Es sendet eine echte Nachricht und verbraucht, was immer der Anbieter an Kontingent erlaubt.

```json
{"results":[{"channel":"smtp","success":true}]}
```

`200`, ob jeder Kanal funktioniert hat oder nicht; jedes Ergebnis sagt es. Ein fehlgeschlagenes trägt `error`. Ein fehlgeschlagener Webhook nennt sein Schema und seinen Host und sonst nichts, denn bei den meisten Paging-Diensten ist die URL die Zugangsdaten. Siehe [Alarmbenachrichtigungen](/de/iot/notifications/).

### `GET /api/notify/escalation`

Die Alarmeskalationsrichtlinie, die Kanäle, die ein Schritt nennen darf, und die Ketten, die gerade offen sind. `available` ist `false`, mit abgeschalteter Richtlinie und ohne Kanäle, wenn `HOTLOOP_NOTIFY_ENABLED` nicht gesetzt ist; die Antwort ist trotzdem `200`. Nur für Administratoren, beim Lesen und beim Schreiben: Die Richtlinie enthält die ntfy-Topics von Personen, und das sind auf einem Server, den jeder erreicht, Passwörter.

```json
{"available":true,"policy":{"enabled":true,"minPriority":"high","contacts":[{"name":"Ana","ntfyTopic":"ana-phone-3f9c","emails":["ana@plant.test"]}],"steps":[{"afterMinutes":5,"contacts":["Ana"]},{"afterMinutes":10,"channels":["gotify"]}],"repeatEveryMinutes":15,"repeatTimes":2},"channels":["smtp","ntfy","gotify"],"active":[{"alarmId":"boiler-hi","name":"Boiler Trip","raisedAt":"2026-10-21T03:00:00Z","sent":1,"total":4,"nextAt":"2026-10-21T03:15:00Z"}],"limits":{"steps":10,"contacts":50,"repeats":20,"minutes":1440}}
```

`channels` sind die, die dieses HotLoop konfiguriert hat, und das ist alles, was ein Schritt nennen kann. `active` ist jeder Alarm, der gerade die Kette entlanggeführt wird: wie viele Sendungen von wie vielen, die die Richtlinie hat, hinausgegangen sind (Schritte, dann Wiederholungen), und wann die nächste fällig ist. Noch nichts gespeichert ist `{"policy":{"enabled":false},...}`: aus, mit nichts darin.

### `PUT /api/notify/escalation`

Ersetzt die ganze Richtlinie, kein Patch, und antwortet mit dem, was `GET` antworten würde. Sie gilt für Alarme, die ab jetzt ausgelöst werden. `400`, wenn Benachrichtigungen nicht aktiviert sind.

```json
{"enabled":true,"minPriority":"high",
 "contacts":[{"name":"Ana","ntfyTopic":"ana-phone-3f9c","emails":["ana@plant.test"]}],
 "steps":[{"afterMinutes":5,"contacts":["Ana"]},{"afterMinutes":10,"channels":["gotify"]}],
 "repeatEveryMinutes":15,"repeatTimes":2}
```

`minPriority` ist `critical`, `high` (der Standard), `medium` oder `low`. Ein Schritt ist `afterMinutes` (1 bis 1440) nach dem vorigen fällig, der erste nach dem Auslösen, und nennt `contacts` aus der Liste, `channels`, die das Deployment hat, oder beides. Höchstens 10 Schritte, 50 Kontakte und 20 Wiederholungen. Unbekannte Felder werden abgelehnt.

`400` mit dem Grund, wenn die Richtlinie nicht funktionieren kann, in Worten, mit denen sich etwas anfangen lässt: ein Schritt, der niemanden nennt, ein Kontakt, der nicht in der Liste steht, ein Kanal, den dieses HotLoop nicht konfiguriert hat (die Antwort listet die auf, die es hat), ein ntfy-Topic ohne konfiguriertes ntfy oder eine Adresse ohne konfigurierte E-Mail, eine Adresse, die keine einfache ist, eine Wiederholung ohne Intervall. Bei Ablehnung wird nichts gespeichert. Das Speichern steht im Systemprotokoll, ohne die Topics. Siehe [Alarmbenachrichtigungen](/de/iot/notifications/#escalation).

### `POST /api/notify/ack/{token}`

Die Schaltfläche **Quittieren** an einer ntfy-Benachrichtigung. Das Telefon, das sie drückt, hat keine Sitzung zum Senden, daher gibt es **keine Sitzung und keine Berechtigung**: Das signierte Token im Pfad ist die Autorisierung, und alles, was es autorisiert, ist, ein Auftreten eines Alarms einmal zu quittieren, bevor es abläuft (`HOTLOOP_NOTIFY_ACK_TTL`, standardmäßig 12 Stunden). Eine Schaltfläche von der Fahrt gestern kann den von heute nicht quittieren. Es ist absichtlich ein `POST`: Link-Vorschauen und Sicherheitsscanner öffnen Links von selbst, und ein Alarm darf nie von einem Roboter quittiert werden. Kein Body. Es antwortet mit dem quittierten Alarm (die Form, aus dem Handler; die anderen Beispiele in diesem Dokument wurden von einem laufenden Gateway aufgenommen, dieses nicht, weil dieses Gateway kein ntfy hatte):

```json
{"acknowledged":true,"alarmId":"extruder-temp-hi","name":"Extruder temperature high","state":"ack-active","ackedBy":"notify:ntfy"}
```

Bei abgeschalteten Quittierlinks:

```json
{"error":"acknowledge links are not enabled on this HotLoop (they need HOTLOOP_PUBLIC_URL and a channel that carries a button)"}
```

Es ist eine gewöhnliche Quittierung über die Alarm-Engine, auditiert unter `notify:<channel>`. Jede Ablehnung wird beantwortet und protokolliert, denn eine Schaltfläche, die stillschweigend nichts tut, sieht genauso aus wie eine, die niemand gedrückt hat:

| Status | Wann |
|---|---|
| 403 | Gefälscht, verändert oder mit einem anderen Geheimnis signiert |
| 404 | Der Alarm existiert nicht mehr, oder Quittierlinks sind aus (sie brauchen `HOTLOOP_PUBLIC_URL` und einen Kanal mit Schaltfläche) |
| 409 | Schon verwendet, der Alarm wurde seitdem erneut ausgelöst, oder es gibt nichts mehr zu quittieren |
| 410 | Echt, aber abgelaufen |
| 503 | Die Quittierung konnte nicht gespeichert werden; der Link wird zurückgegeben, damit ein zweiter Druck noch funktionieren kann |

Die Antwort trägt `Access-Control-Allow-Origin: *`, damit die ntfy-Web-App ihn von ihrer eigenen Origin aus drücken kann; nichts auf dieser Route liest ein Cookie. Das Token wird nie protokolliert oder irgendwo zurückgegeben. Siehe [Alarmbenachrichtigungen](/de/iot/notifications/#acknowledge-links).

## Sicherungen

Logische Datenbank-Snapshots, nur mit Tabellendaten. Braucht `HOTLOOP_BACKUP_ENABLED`. Beide nur für Administratoren: Eine Auflistung zeigt die Zeilenzahl jeder Tabelle, Benutzer und Sitzungen eingeschlossen. **Es gibt keinen Restore-Endpunkt**, mit Absicht: Wiederherstellen ist ein Flag der Binärdatei, einmal ausgeführt von jemandem, der weiß, dass die Datenbank sie aufnehmen soll, nie ein Netzwerkaufruf gegen eine laufende. Siehe [Sicherungen und Wiederherstellung](/de/iot/backup/#eine-sicherung-wiederherstellen).

### `GET /api/backup`

Die Sicherungen auf dem Volume, jede mit ihrem Manifest.

```json
{"backups":[{"name":"20260927T202912Z","bytes":98567,"manifest":{"hotloopVersion":"4.16.0","schemaMigrations":["0001_core.sql","...","0007_service_audit.sql"],"createdAt":"2026-09-27T20:29:12.970721945Z","tables":[{"name":"devices","rows":2,"columns":[{"name":"id","type":"text"},{"name":"...","type":"..."}]}]}}],"configured":true}
```

### `POST /api/backup`

Erstellt jetzt eine und wartet darauf (bis zu 30 Minuten: Eine große `tag_history` braucht eine Weile). Kein Body. Antwortet mit dem Manifest: Version, Migrationen und Zeilen und Spalten jeder Tabelle.

## Geplante Berichte

Historian-Zusammenfassungen als CSV und HTML, nach Zeitplan, per E-Mail oder Download. Braucht `HOTLOOP_REPORTS_ENABLED`. Betrachter lesen, Bediener führen aus, Administratoren definieren: Eine Definition nennt, wohin Anlagendaten per E-Mail gehen. Die Felder der Definition stehen unter [Geplante Berichte](/de/gateway/reports/).

### `GET /api/reports`

```json
{"configured":true,"reports":[{"id":"line1-hourly","name":"Line 1 hourly","enabled":true,"tags":[{"deviceId":"extruder-1","tagName":"Temperature"},{"deviceId":"extruder-1","tagName":"Pressure"}],"window":{"count":1,"unit":"hours","end":"run_time"},"bucket":"window","aggregations":["min","max","avg"],"schedule":{"kind":"daily","at":"06:00"},"format":"both","recipients":["shift-lead@example.com"],"retain":10,"createdAt":"2026-09-27T20:29:23.300978Z","updatedAt":"2026-09-27T20:29:23.300978Z","nextRunAt":"2026-09-28T06:00:00Z"}],"smtpConfigured":true,"timezone":"UTC"}
```

Jede Definition trägt `nextRunAt` und ihren jüngsten Lauf als `lastRun`.

### `POST /api/reports`

Legt eine Definition an; der Body ist die Definition wie oben. `201`. `400` bei fehlgeschlagener Validierung (`"report line1-hourly: window end \"now\" must be run_time or local_midnight"`), `409`, wenn die id existiert.

### `GET /api/reports/{id}`

Eine Definition, wie in der Liste. `404` für eine unbekannte.

### `PUT /api/reports/{id}`

Ersetzt die ganze Definition. Die id kann sich nicht ändern (`400`, wenn die im Body abweicht). `nextRunAt` und `lastRun` werden akzeptiert und ignoriert, sodass Sie zurücksenden können, was Sie gelesen haben.

### `DELETE /api/reports/{id}`

Löscht sie samt ihren Läufen und Dateien und bricht einen laufenden Lauf ab. `{"deleted":"line1-hourly"}` oder `404`.

### `POST /api/reports/{id}/run`

Führt sie jetzt aus und wartet. `?deliver=false` erzeugt und speichert sie, ohne jemandem eine E-Mail zu senden, zum Ausprobieren einer Definition. `200` heißt, der Lauf hat stattgefunden; sein eigener `status` sagt, ob der Bericht funktioniert hat. Ein Lauf, der fehlschlägt, ist ein Ergebnis, keine fehlerhafte Anfrage, und wird in beiden Fällen aufgezeichnet.

```json
{"id":1,"reportId":"line1-hourly","trigger":"manual","actor":"admin","status":"succeeded","startedAt":"2026-09-27T20:29:54.06926Z","finishedAt":"2026-09-27T20:29:54.092456655Z","windowStart":"2026-09-27T19:29:54.06926Z","windowEnd":"2026-09-27T20:29:54.06926Z","tags":2,"rows":2,"readings":984,"excluded":2,"files":[{"format":"csv","name":"20260927T202954Z-1.csv","bytes":338},{"format":"html","name":"20260927T202954Z-1.html","bytes":2430}],"emailStatus":"skipped","emailTo":["shift-lead@example.com"]}
```

`400` für ein `deliver`, das nicht true oder false ist, `404` für einen unbekannten Bericht.

### `GET /api/reports/{id}/runs`

`{"runs": [...]}`, neueste zuerst, `?limit=` Standard 50, höchstens 500. `404` für einen unbekannten Bericht, keine leere Liste.

### `GET /api/reports/{id}/runs/{run}/download`

Streamt eine gespeicherte Datei als Anhang. `?format=csv` oder `html`.

```
HTTP/1.1 200 OK
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="20260927T202954Z-1.csv"
Cache-Control: private, no-store

device_id,tag_name,unit,period_start,period_end,min,max,avg,excluded
extruder-1,Temperature,C,2026-09-27T19:29:54+00:00,2026-09-27T20:29:54+00:00,19.50001230192043,23.499980145373126,21.508905654397623,1
```

HTML wird mit einer `sandbox`-Content-Security-Policy ausgeliefert: Ein Bericht ist ein Dokument zum Lesen, keine Seite, die etwas ausführen darf. Die geöffnete Datei ist die, die der Laufdatensatz nennt; nichts in der URL wird Teil eines Pfads. `400` für eine Laufnummer, die keine ist, oder ein Format, das keines von beiden ist, `404` für einen Lauf oder eine Datei, die nicht existiert.

## Standorte

### `GET /api/sites`

Jeder Standort, den das Gateway föderiert, nach seinem Anlagenstatus über MCP parallel gefragt, je 6 Sekunden, sodass ein toter Standort die übrigen nicht aufhalten kann. Die Standorte sind die ausgehenden MCP-Server in der Konfiguration. Siehe [MCP](/de/iot/mcp/#federating-sites).

```json
{"configured":true,
 "rollup":{"sites":2,"reachable":1,"devices":2,"connected":2,"tags":5,"outstandingAlarms":1,"unacknowledgedAlarms":1,"criticalAlarms":0},
 "sites":[{"name":"plant-a","reachable":true,"latencyMs":14,"plant":"Demo Plant","uptime":"1m25s","devices":2,"connected":2,"degraded":0,"disconnected":0,"tags":5,"outstandingAlarms":1,"unacknowledgedAlarms":1,"criticalAlarms":0,"writesEnabled":true},
          {"name":"plant-c","reachable":false,"error":"connect to MCP server \"plant-c\": calling \"initialize\": ... no such host","latencyMs":49,"devices":0,"connected":0,"degraded":0,"disconnected":0,"tags":0,"outstandingAlarms":0,"unacknowledgedAlarms":0,"criticalAlarms":0,"writesEnabled":false}]}
```

Die Zähler eines unerreichbaren Standorts bedeuten nichts und werden aus der Summe herausgelassen: Einen Standort, den man nicht erreicht, als null Alarme zu zählen, wäre das Gefährlichste, was dieser Bildschirm tun könnte. Ohne konfigurierte Standorte: `{"configured":false,"sites":[]}`.

## Einstellungen

### `GET /api/settings`

Jede Einstellung, ihr wirksamer Wert, woher der Wert kam und die Variable, die sie setzt:

```json
{"groups":["Plant","Safety","Polling","Historian","Database","MCP","Server"],
 "settings":[{"key":"ui.plantName","group":"Plant","label":"Plant name","help":"...","value":"Demo Plant East","kind":"string","source":"stored","envVar":"HOTLOOP_PLANT_NAME","editable":true},
             {"key":"safety.allowWrites","group":"Safety","label":"Writes allowed","help":"...","value":true,"kind":"bool","source":"environment","envVar":"HOTLOOP_ALLOW_WRITES","editable":false},
             {"key":"database.password","group":"Database","label":"Password","help":"Never shown. It comes from the release Secret.","value":"set","kind":"secret","source":"environment","envVar":"HOTLOOP_DB_PASSWORD","editable":false}]}
```

`source` ist `stored`, `environment` oder `default`. Ein `secret` ist immer nur `set` oder `not set`. `envVar` ist die Variable, aus der der Wert kam. Einige Einstellungen fallen auf eine zweite Variable zurück, wenn die `HOTLOOP_`-Variable leer ist (`TZ` für die Zeitzone, `POSTGRES_HOST`, `POSTGRES_DB`, `POSTGRES_USER` und `POSTGRES_PASSWORD` für die Datenbank), und wenn der Rückfall gilt, nennt `envVar` ihn. Eine Variable, die auf eine leere Zeichenkette gesetzt ist, gilt als nicht gesetzt, so wie die Konfiguration es behandelt. Die Poll-Einstellungen werden in Millisekunden angezeigt, aber ihre Variablen nehmen eine Dauer (`5s`, `500ms`) oder eine bloße Zahl von Sekunden.

`product` in der Gruppe `Server` sagt, welches HotLoop dies ist. Eine Funktion, die dieses Produkt nicht hat und die das Deployment trotzdem eingeschaltet hat (etwa `HOTLOOP_REPORTS_ENABLED=true` bei IoT), verhindert den Start nicht. Sie wird beim Start als Warnung protokolliert und hier in einer zusätzlichen Gruppe, `Not in this product`, mit ihrer Variable und einer Zeile aufgeführt, die sagt, wo sie zu Hause ist. Die Einstellung bleibt genau, wie sie ist, sodass dieselbe Konfiguration bei einem Produkt, das die Funktion hat, sie einschaltet. Ist nichts dergleichen gesetzt, gibt es die Gruppe nicht.

### `PUT /api/settings`

Ändert die Einstellungen der Anlagenidentität, und nur diese:

| Schlüssel | Typ |
|---|---|
| `ui.plantName` | string, höchstens 200 Zeichen |
| `ui.siteId` | string, höchstens 200 Zeichen |
| `ui.timezone` | ein IANA-Name, den diese Maschine kennt (`America/Chicago`) |
| `ui.confirmWrites` | bool |
| `ui.kioskIdleSeconds` | eine ganze Zahl von Sekunden, 10 bis 43200: wie lange eine Kiosk-Anmeldung überlebt, wenn niemand das Panel berührt. Standard 900 |
| `ui.lockoutAttempts` | eine ganze Zahl, 0 bis 100: falsche Passwörter oder PINs in Folge, die ein Konto sperren. Standard 10, und 0 heißt keine Sperre |
| `ui.panelDelaySeconds` | eine ganze Zahl von Sekunden, 0 bis 30: das Meiste, was ein Kiosk-Panel nach falschen PINs wartet, bevor es die nächste ohne Benutzernamen eingegebene PIN prüft. Standard 3, und 0 heißt keine Wartezeit |
| `ui.lockoutSeconds` | eine ganze Zahl von Sekunden, 10 bis 86400: wie lange ein gesperrtes Konto gesperrt bleibt. Standard 300 |

```json
{"ui.plantName":"Demo Plant East","ui.timezone":"America/Chicago"}
```

Antwortet mit den vollständigen Einstellungen, wie `GET`. Jeder andere Schlüssel ergibt einen 400, der ihn nennt:

```json
{"error":"safety.allowWrites is set by the deployment and cannot be changed here"}
```

Das ist Absicht. Die Schreibschalter entscheiden, ob dieser Prozess Maschinen bewegen kann, und eine Kontrolle, die sich vom selben Browser einschalten lässt, der die Schreibzugriffe ausgibt, ist keine Kontrolle. Sie zu ändern ist ein Deployment.

## Historian-Ziele

Die eigenen Datenbanken der Anlage, in die HotLoop seinen Verlauf zusätzlich zu seiner eigenen schreibt. Siehe [Historian-Ziele](/de/iot/historian-targets/). Jede Rolle, die die Einstellungen liest, sieht sie und wie es jedem einzelnen geht. Eines zu ändern ist nur Administratoren erlaubt, weil ein Ziel ein Ort ist, an den Anlagendaten gehen. Passwörter werden mit dem Geräte-Zugangsdatenschlüssel (`HOTLOOP_SECRET_KEY_FILE`) versiegelt und nie zurückgegeben; `passwordSet` sagt, ob eines gespeichert ist, und `passwordProblem`, warum ein gespeichertes nicht geöffnet werden kann. Jede Änderung kommt ins Protokoll und wirkt sofort.

### `GET /api/historian/targets`

```json
{"secretKey":true,
 "kinds":[{"id":"postgres","title":"PostgreSQL or TimescaleDB","defaultPort":5432,"defaultTable":"hotloop_history",
    "databaseLabel":"Database","tableLabel":"Table","passwordLabel":"Password","usesUsername":true,"usesOrg":false},
   {"id":"sqlserver","title":"Microsoft SQL Server","defaultPort":1433,"defaultTable":"hotloop_history",
    "databaseLabel":"Database","tableLabel":"Table","passwordLabel":"Password","usesUsername":true,"usesOrg":false},
   {"id":"mysql","title":"MySQL or MariaDB","defaultPort":3306,"defaultTable":"hotloop_history",
    "databaseLabel":"Database","tableLabel":"Table","passwordLabel":"Password","usesUsername":true,"usesOrg":false},
   {"id":"influxdb","title":"InfluxDB 2 or 3","defaultPort":8086,"defaultTable":"hotloop_history",
    "databaseLabel":"Bucket (InfluxDB 3: database)","tableLabel":"Measurement","passwordLabel":"API token",
    "usesUsername":false,"usesOrg":true}],
 "targets":[{"id":"plant-pg","name":"Plant historian","kind":"postgres","address":"db.plant.local:5432",
   "database":"plant","username":"hotloop","table":"hotloop_history","useTls":true,"insecureSkipVerify":false,
   "enabled":true,"createdBy":"admin","passwordSet":true,"createdAt":"2026-10-03T09:12:04Z","updatedAt":"2026-10-03T09:12:04Z",
   "status":{"state":"down","since":"2026-10-03T10:02:11Z","queued":50000,"queueCap":50000,"written":182340,
     "backfilled":0,"dropped":1210,"refused":0,"lastWrite":"2026-10-03T10:02:10Z",
     "lastError":"failed to connect to `user=hotloop database=plant`: dial tcp 10.20.0.9:5432: connect: connection refused",
     "owedFrom":"2026-10-03T10:02:09Z"}}]}
```

`kinds` sind die Datenbanken, in die dieses HotLoop schreibt, und wie jede ihre Felder nennt: InfluxDB hat einen Token, wo die anderen ein Passwort haben (`password` trägt ihn), einen Bucket, wo sie eine Datenbank haben (`database`), eine Messung, wo sie eine Tabelle haben (`table`), und eine Organisation (`org`), die keine der anderen hat. `status.state` ist `up`, `catching-up` (oben und noch dabei, zu senden, was ihr aus dem eigenen Verlauf von HotLoop geschuldet wird), `down`, `starting` oder `off` (abgeschaltet). `queued` ist das, was im Speicher wartet, von `queueCap`. `written` zählt live gesendete Messwerte und `backfilled` die aus dem eigenen Verlauf von HotLoop gesendeten. `dropped` zählt Messwerte, die die Warteschlange fallen ließ, während das Ziel nicht mithalten konnte: Sie sind geschuldet, nicht verloren. `refused` zählt Messwerte, die die Datenbank selbst nicht annehmen wollte, mit ihrem Grund in `lastRefusal`. `owedFrom` und `owedTo` sind das, was noch geschuldet wird; `owedTo` fehlt, solange das Ende noch offen ist, was so lange der Fall ist, wie das Ziel unten ist.

### `POST /api/historian/targets`

```json
{"id":"plant-pg","name":"Plant historian","kind":"postgres","address":"db.plant.local","database":"plant",
 "username":"hotloop","password":"...","useTls":true}
```

`id` besteht aus 1 bis 63 Kleinbuchstaben, Ziffern und `-` und nennt das Ziel im Systemprotokoll. `address` ist `host` oder `host:port`, ohne Login darin; der Standardport des Typs ergänzt einen fehlenden. `table` ist standardmäßig die `defaultTable` des Typs und darf ein Schema tragen (`history.hotloop`). `org` ist die Organisation von InfluxDB 2. `enabled` ist standardmäßig true. Ein Passwort braucht einen Schlüssel: Ohne `HOTLOOP_SECRET_KEY_FILE` ist es ein `400`, nie im Klartext gespeichert. `201` mit dem Ziel und seinem Status; `409` für eine vergebene id.

### `PUT /api/historian/targets/{id}`

Beliebige der Felder oben außer `id`; was nicht gesendet wird, bleibt. `"password":""` löscht das Passwort. Eine Änderung startet das Ziel mit seinen neuen Einstellungen neu, und was ihm geschuldet wurde, bleibt geschuldet. `200` mit dem Ziel.

### `DELETE /api/historian/targets/{id}`

Hört auf, hineinzuschreiben, und vergisst, was ihm geschuldet wurde. Was es bereits hält, bleibt in seiner Datenbank. Schalten Sie es stattdessen mit `"enabled":false` ab, um die Einstellungen zu behalten. `200` `{"deleted":"plant-pg"}`.

## Systemprotokoll

### `GET /api/events`

Jede Änderung, jeder Schreibzugriff, jede Anmeldung und jeder Verbindungswechsel, neueste zuerst.

| Abfrage | <span class="sr-only">Details</span> |
|---|---|
| `category` | Wiederholbar: `system`, `device`, `tag`, `write`, `alarm`, `automation`, `mcp`, `config`, `auth` |
| `severity` | Wiederholbar: `debug`, `info`, `warning`, `error` |
| `subject` | Genau: eine Geräte-id, ein Tag-Schlüssel, eine entity_id, `equipment:4`, `label:critical` |
| `q` | Suche ohne Beachtung der Groß- und Kleinschreibung |
| `minutes` | Nur die letzten N Minuten |
| `limit` | Standard 200, höchstens 5000 |

```json
[{"id":61,"at":"2026-09-27T20:29:23.303795Z","severity":"info","category":"config","subject":"line1-hourly","actor":"admin","message":"report created"}]
```

`actor` ist ein Benutzer, `system`, `automation:<id>` oder `mcp:<client>`. `detail`, wenn es eines gibt, ist zusätzliches JSON als Zeichenkette.

## Logbuch

### `GET /api/logbook`

Eine Zeitleiste dessen, was passiert ist, neueste zuerst: Zustandsänderungen von Entitäten, Schreibzugriffe, Alarmübergänge, Läufe von Automatisierungen und Skripten sowie Konfigurationsänderungen und Dienstaufrufe aus dem Systemprotokoll. Die Spuren werden dort gelesen, wo sie liegen, und zusammengeführt, sodass jede ihre eigene Aufbewahrung behält. Numerische Messwerte sind nicht darin: dafür ist `GET /api/history` da. Siehe [das Logbuch](/de/iot/logbook/).

| Abfrage | <span class="sr-only">Details</span> |
|---|---|
| `entity` | Nur das, was diese Entität betrifft: ihre Zustandsänderungen, Schreibzugriffe auf sie und ihre Tags, ihre Alarme, die Läufe von Automatisierungen, die sie auslöst oder die auf sie geschrieben haben, Konfigurationsänderungen an ihr |
| `equipment_id` | Nur das, was an diesem Knoten des Anlagenbaums oder darunter geschah, nach derselben Regel. Nicht zusammen mit `entity` |
| `actor` | Teil dessen, wer es tat, ohne Beachtung der Groß- und Kleinschreibung: ein Benutzer, `automation:<id>`, `mcp:<client>` |
| `kinds` | Kommagetrennt oder wiederholt: `state`, `write`, `alarm`, `automation`, `event`, `script`, `recipe` |
| `from`, `to` | RFC-3339-Zeiten; `from` einschließlich, `to` ausschließlich |
| `limit` | Standard 100, höchstens 1000 |
| `before` | Das `next` der vorigen Seite |

```json
{"entries":[
  {"at":"2026-09-28T09:14:02.51Z","kind":"state","id":41,"severity":"info","message":"changed to on (was off)","entity_id":"switch.tank_farm_pump","old_state":"off","state":"on","quality":"good"},
  {"at":"2026-09-28T09:14:02.18Z","kind":"write","id":88,"severity":"info","message":"wrote true to tank-farm/pump (switch.turn_on on switch.tank_farm_pump) (was 0)","actor":"admin","source":"ui","entity_id":"switch.tank_farm_pump","device_id":"tank-farm","tag":"tank-farm/pump","call_id":"5c9f8545a93b5443"},
  {"at":"2026-09-28T09:13:40.02Z","kind":"state","id":37,"severity":"info","message":"changed to closed (was open); 14 changes before this not logged, it was changing faster than the logbook records","entity_id":"valve.infeed","old_state":"open","state":"closed","quality":"good","suppressed":14}
 ],
 "next":"MjAyNi0wOS0yOFQwOToxMzo0MC4wMlp8c3RhdGV8Mzc"}
```

`id` ist die id der Zeile in ihrer eigenen Spur (bei einer Zustandsänderung die unveränderliche id der Entität), und mit `at` und `kind` ist sie das, was `next` kodiert: Die Seite danach ist alles, was in dieser Reihenfolge strikt älter ist, was auch immer inzwischen hinzugekommen ist. `next` entfällt auf der letzten Seite. `suppressed` ist, wie viele Änderungen dieser Entität vor dieser nicht protokolliert wurden, weil sie sich schneller änderte als zehn auf einmal und dann eine alle zwei Sekunden.

`400` für eine unbekannte Art, eine fehlerhafte Zeit, `from` nicht vor `to`, ein Limit über 1000, einen erfundenen Cursor oder `entity` und `equipment_id` zusammen; `404` für einen Knoten, der nicht existiert. `503`, wenn das Logbuch nicht in dem Prozess läuft, der antwortet.

## Live-Feed

### `GET /api/stream`

Server-Sent Events, in eine Richtung, solange Sie es offen halten. SSE statt eines WebSockets, weil der Verkehr nur in eine Richtung geht und ein Ereignisstrom sich von selbst neu verbindet, wenn der Pod unter einem offenen Dashboard neu startet. `EventSource` sendet das Sitzungs-Cookie; ein Skript sendet das Bearer-Token.

Beim Verbinden erhalten Sie `retry: 3000` und dann das aktuelle Bild, sodass ein Bildschirm gefüllt ist, bevor sich etwas ändert:

```
retry: 3000

event: snapshot
data: [{"deviceId":"extruder-1","protocol":"opcua","tagName":"Temperature","tagValue":19.553128777917983,"unit":"C","quality":"good","timestamp":"2026-09-27T20:34:23.619589Z"}]

event: alarms
data: {"alarms":[...outstanding alarms...],"summary":{"critical":0,"high":1,"medium":0,"low":0,"unacked":0,"total":1}}

event: entities
data: {"changed":[...every entity state...],"removed":[]}
```

Dann, wenn etwas geschieht:

| Ereignis | Daten | Wann |
|---|---|---|
| `values` | Ein Array von Messwerten, die Form von `GET /api/values`, der neueste je Tag, **nur die Tags, deren Messwert sich geändert hat** | Alle 250 ms, wenn sich welche geändert haben. Ein Tag, dessen Wert, Text, Einheit, Qualität und Grund dieselben sind wie beim zuletzt gesendeten, bleibt weg und wird erneut gesendet, sobald er 30 Sekunden ungesendet war, sodass der `timestamp` eines stabilen Werts nie älter ist als das. Ein Treiber liest jeden Tag bei jedem Poll; 4.19.5 sendete bei jedem Mal alle (etwa 150 KB viermal pro Sekunde bei den 2232 Tags eines Testers), und eine Seite auf einer langsamen Verbindung fiel Minuten zurück |
| `entities` | `{"changed": [states], "removed": [entity_ids]}` | Alle 250 ms, wenn sich ein Entitätszustand geändert hat. `removed` ist eine Entität, die deaktiviert, gelöscht oder umbenannt wurde |
| `alarm` | `{"alarm": {...}, "event": "shelved"}`, der Alarm und was mit ihm geschah (`raised`, `acked`, `cleared`, `shelved`, `unshelved`, `suppressed`, `unsuppressed`) | Sofort: Alarmübergänge sind selten, und jeder zählt |
| `device` | `{"deviceId":"tank-farm","state":"connected"}` | Sofort: Der Bildschirm soll rot werden, wenn ein Gerät ausfällt, nicht beim nächsten Flush |
| `logbook` | `{"kinds":["state","write"]}`, welche Arten von Logbucheinträgen etwas Neues haben | Höchstens einmal pro Sekunde. Keine Einträge darin, denn was ein Bildschirm zeigen soll, hängt von seinen Filtern ab: Er fragt `GET /api/logbook` nach seiner eigenen Seite |

```
event: alarm
data: {"alarm":{"definitionId":"extruder-temp-hi","state":"shelved","shelvedUntil":"2026-09-27T20:39:45.839983854Z","shelvedBy":"admin","...":"..."},"event":"shelved"}

event: device
data: {"deviceId":"tank-farm","state":"connected"}
```

Eine Kommentarzeile (`: heartbeat 2026-09-27T20:35:00Z`) alle 20 Sekunden hält Proxys davon ab, eine ruhende Verbindung zu schließen. Jede offene Seite wird für sich getaktet: Ihr Schreiber ruht so lange, wie ihr letztes Senden gedauert hat (höchstens fünf Sekunden), und was inzwischen eintrifft, wird pro Tag und pro Entität gehalten, nur das Neueste, sodass eine Seite auf einer langsamen Verbindung ein oder zwei Sendungen hinter der Anlage bleibt, nie Minuten, nichts verliert und den anderen Seiten nichts wegnimmt. Der Strom wird mit gzip komprimiert, wenn die Anfrage `Accept-Encoding: gzip` sagt (ein Browser tut das), was das erste Bild eines Testers von etwa 326 KB auf etwa 11 KB auf der Leitung bringt. Die Antwort setzt `X-Accel-Buffering: no`, denn ein puffernder Proxy macht aus einem Live-Feed einen sehr langsamen Download.

Der Strom prüft seine Sitzung alle fünf Sekunden erneut und schließt, wenn die Sitzung weg ist: abgemeldet, abgelaufen, widerrufen oder das Konto deaktiviert oder nicht mehr für `status.read` zugelassen. Er sendet vorher kein Ereignis. Der `EventSource` eines Browsers verbindet sich neu, erhält das oben genannte `401` und hört auf. Mit `HOTLOOP_AUTH_INSECURE=true` gibt es keine Sitzung und nichts zu prüfen. Die Prüfung zählt nicht als Nutzung der Sitzung, sodass ein offen gelassener Bildschirm eine Sitzung nicht frisch hält.

## MCP

### `/mcp` und `/mcp/`

Das Model Context Protocol, Streamable-HTTP-Transport, für Agenten. Jede Methode: Der Transport nutzt `POST` für Aufrufe, `GET` für den eigenen Strom des Servers und `DELETE`, um eine Sitzung zu beenden. Der Pfad ist `HOTLOOP_MCP_PATH` (standardmäßig `/mcp`), und der Endpunkt ist nur da, wenn `HOTLOOP_MCP_ENABLED` an ist.

Er liegt **nicht** hinter der Sitzungsanmeldung. Er hat sein eigenes Bearer-Token, `HOTLOOP_MCP_TOKEN`, das vor dem Handler geprüft wird, sodass ein Aufrufer ohne es nicht einmal die Tools auflisten kann:

```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="hotloop"

unauthorized
```

Ist kein Token konfiguriert, erzeugt HotLoop beim ersten Start eines und behält es in seiner Datenbank (`hotloop mcp-token` gibt es aus), sodass der Endpunkt nie offen ist. Ein Agent ist ein Aufrufer wie jeder andere: Er liest und schreibt, seine Schreibzugriffe laufen durch dasselbe Schreib-Gate wie die aller anderen, und sie werden als `mcp:<client name>` auditiert. Die Tools und Ressourcen stehen unter [MCP](/de/iot/mcp/).

```
POST /mcp
Authorization: Bearer <token>
Accept: application/json, text/event-stream

{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1"}}}
```

antwortet mit einem `Mcp-Session-Id`-Header und den Fähigkeiten und Anweisungen des Servers.

## Die Oberfläche

### `GET /manifest.webmanifest`

Das Web-App-Manifest, mit dem ein Telefon die Oberfläche als App installieren kann: der Produkt- und Anlagenname, `display` `standalone`, die Themenfarben, die Icons (PNGs mit 192 und 512 Pixeln, ein maskierbares 512er und das SVG) und Verknüpfungen zu Alarmen und Dashboards. Jede URL darin ist relativ zu der des Manifests selbst, sodass sie dort stimmt, wo HotLoop auch eingehängt ist. Der Name folgt dem in den Einstellungen gesetzten Anlagennamen, und die Antwort ist `Cache-Control: no-cache`, damit eine Umbenennung beim nächsten Blick sichtbar ist. Keine Sitzung: Ein Telefon fragt, bevor sich jemand angemeldet hat. Siehe [Dashboards](/de/iot/dashboards/#auf-einem-telefon).

### `GET /sw.js`

Der Service Worker, an der Wurzel dessen, wo HotLoop eingehängt ist, sodass sein Geltungsbereich die ganze App abdeckt. Er behält die Seite und die letzte Antwort auf die Lesezugriffe, die sich eine Person ansieht, und antwortet damit als veraltet markiert, wenn HotLoop nicht erreichbar ist. Er beantwortet, behält oder reiht nie einen Schreibzugriff ein. Die laufende Version steckt darin, sodass jedes Release einen eigenen Seiten-Cache bekommt. `Cache-Control: no-cache`; keine Sitzung. Nur ein Browser in einem sicheren Kontext (https oder `localhost`) führt ihn aus.

### `GET /next` und `GET /next/`

Wo die Oberfläche lebte, als die alte der Standard war. Beide sind ein `301` zur Wurzel, sodass ein damals angelegtes Lesezeichen noch ankommt.

### `/`

Die Web-Oberfläche, aus `web/` in die Binärdatei gebaut: eine Seite, ihre Skripte, Stile und Schriften, ein Service Worker und die Icons der installierbaren App, jede URL darin relativ zur Seite, sodass sie an der Wurzel eines Hosts läuft, unter einem Pfad, hinter einem Proxy oder im iframe des EmberNet-Dashboards. Der Server füllt den Titel und einen Datenblock, `<script type="application/json" id="iiot">`, mit dem, was nur er weiß: die Anlage, den Standort, das Produkt, die Funktionen, die Schreibrichtlinie und die Zeitzone. Nur `GET` und `HEAD`; jede andere Methode ist `405`. Ein Pfad, der keine ihrer Dateien ist, ist ein `404`, denn die Seite bei einem Tippfehler auszuliefern, ließe sie wie einen funktionierenden Bildschirm aussehen, und eine Binärdatei, die ohne die Oberfläche gebaut wurde, sagt das im Klartext und wie man sie baut. Keine Sitzung: Die Seite ist das Anmeldeformular, bis Sie sich anmelden.
