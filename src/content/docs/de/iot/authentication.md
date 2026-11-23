---
title: "Authentifizierung und Benutzer"
description: "Anmeldung, Rollen, Tokens und die Benutzerverwaltung, und was ein Deployment hinter einem vertrauenswürdigen Proxy erklären muss, um darauf zu verzichten."
---

HotLoop hat seit 4.4.0 eine eigene Anmeldung, und jedes Produkt verlangt sie standardmäßig. Ohne Anmeldung zu laufen ist weiterhin möglich, bewusst, für ein Deployment, das wirklich hinter dem Dashboard isoliert ist und das ausdrücklich so erklären will, siehe [Ohne Anmeldung betreiben](#ohne-anmeldung-betreiben), aber ein einfaches `helm install` oder eine Podman-Quadlet-Unit startet jetzt mit Anmeldepflicht.

## Das Wichtigste in Kürze

- **Lokale Benutzer, bcrypt-Passwörter, serverseitige Sitzungen.** Noch kein externer Identitätsanbieter; siehe [MCP](/de/iot/mcp/) für den getrennten Bearer-Token-Schutz der Agentenschnittstelle, den dies nicht ersetzt.
- **Drei Rollen: admin, operator, viewer.** Die Rolle admin darf alles, auch Benutzer verwalten. Die Rolle operator darf alles lesen sowie Tags schreiben, Alarme quittieren und Automatisierungen auslösen. Die Rolle viewer darf alles lesen und sonst nichts. Ein Benutzer kann statt einer Rolle auch eine ausdrückliche Berechtigungsliste bekommen, für alles Engere.
- **Eine Sitzung ist ein Cookie oder ein Bearer-Token**, je nachdem, was dem Client leichter fällt. Die Browseroberfläche nutzt das Cookie; ein Skript oder ein anderer Dienst nutzt `Authorization: Bearer <token>`.
- **Ein gemeinsam genutztes Bedienfeld meldet Personen mit PIN oder Ausweis an** und wieder ab, wenn es niemand berührt, sodass jeder Schreibzugriff dort den Namen einer Person trägt. Siehe [Kiosk-Bedienfelder](#kiosk-bedienfelder-pin-oder-ausweis-und-automatische-abmeldung).
- **Sitzungen laufen ab.** `HOTLOOP_AUTH_SESSION_TTL`, standardmäßig 12 Stunden. Es gibt kein „Angemeldet bleiben“: Eine Sitzung, die eine Arbeitsschicht überdauert, ist eine Sitzung, die niemand beobachtet.

## Das erste Konto

Das Chart erzeugt bei der Erstinstallation eines und zeigt es einmal an, in der NOTES-Ausgabe von `helm install`:

```
helm install hotloop ./charts/hotloop \
  --namespace hotloop --create-namespace
```

Wenn Sie die Binärdatei direkt starten, erzeugen Sie einen Hash und setzen zwei Variablen:

```sh
hotloop hash-password
# Password: ********
# Confirm password: ********
# $2a$10$....................................................

export HOTLOOP_AUTH_ENABLED=true
export HOTLOOP_ADMIN_USER=admin
export HOTLOOP_ADMIN_PASSWORD_HASH='$2a$10$....................................................'
```

`hash-password` akzeptiert auch direkt `-password`, für ein Skript, das schon eines hat:

```sh
hotloop hash-password -password 'something-long'
```

Das so angelegte Admin-Konto ist ein **Startkonto**, kein Rücksetzschalter. Sobald es existiert, bewirkt eine Änderung von `HOTLOOP_ADMIN_PASSWORD_HASH` mit anschließendem Neustart nichts: `EnsureAdminUser` legt das Konto nur an, wenn dieser Benutzername noch nicht existiert, sodass ein Wert hier niemals ein Passwort überschreiben kann, das ein Operator inzwischen in der Oberfläche geändert hat. Das ist vor allem bei einem Helm-Upgrade wichtig: Das erneute Anwenden derselben `values.yaml` darf das Passwort von niemandem stillschweigend zurücksetzen.

## Rollen

| Rolle | Darf |
|---|---|
| **admin** | Alles: `*`. Auch Benutzer anlegen, deaktivieren und löschen. |
| **operator** | Alle Ansichten lesen. Tags schreiben (`POST /api/write`) und Entitäten ansteuern (`POST /api/services/...`), Helper setzen (`helpers.write`, siehe [Helper](/de/iot/helpers/)), Skripte starten und stoppen (`scripts.run`, siehe [Skripte](/de/iot/scripts/)), Rezepte anwenden (`recipes.apply`, siehe [Rezepte](/de/iot/recipes/)), aus einem Blueprint eine Regel erstellen und aktualisieren (`blueprints.apply`, siehe [Blueprints](/de/iot/blueprints/)), die der Rolle angebotenen Dashboards sehen (`dashboards.read`, siehe [Dashboards](/de/iot/dashboards/)), den Energieverbrauch und seine Kosten lesen (`energy.read`, siehe [Energie](/de/iot/energy/); einen Zähler oder einen Tarif anzulegen ist `energy.write`, Sache eines admin), die Tafel umordnen, Alarme quittieren, zurückstellen und wieder aufnehmen, Automatisierungen auslösen. Darf die *Definitionen* von Geräten, Tags, Alarmen, Automatisierungen, Skripten, Rezepten, Blueprints oder Dashboards nicht bearbeiten und keine Benutzer verwalten. |
| **viewer** | Alle Ansichten lesen. Sonst nichts. |

Ein Benutzer kann statt einer Rolle eine ausdrückliche `permissions`-Liste bekommen, die die Rolle **vollständig ersetzt**, statt sie zu ergänzen: Ein Benutzer ist entweder „die Rolle operator“ oder „genau diese Berechtigungen“, nie beides, sodass es genau eine Stelle gibt, an der man sieht, was jemand darf.

Berechtigungen haben die Form `resource.action`, `tags.write`, `alarms.ack`, oder einen Ressourcen-Platzhalter, `tags.*`, oder den globalen Platzhalter `*`.

## Kiosk-Bedienfelder: PIN oder Ausweis und automatische Abmeldung

Auf Ihrem eigenen Rechner sind Sie bereits angemeldet: Sie haben Ihr Passwort einmal eingegeben, und ein Schreibzugriff geht direkt durch das Schreibtor und wird Ihnen zugeordnet, wie immer. Daran hat sich nichts geändert. Ein Bedienfeld an der Wand ist niemandes Rechner. Wäre es als `panel-3` angemeldet, stünde im Audit-Trail „panel-3 hat das Ventil geöffnet“, und das ist kein Audit-Trail. Deshalb meldet ein Bedienfeld eine Person mit PIN oder Ausweis an, jeder Schreibzugriff gehört dieser Person, und das Bedienfeld meldet sie ab, wenn es niemand berührt.

### Was der Operator sieht

Ein Bedienfeld ist ein physischer Bildschirm: HotLoop, geöffnet unter `/?screen=<name>` (siehe [Dashboards](/de/iot/dashboards/#rollen-und-bildschirme)). Solange niemand angemeldet ist, zeigt es ein einziges Feld, „PIN oder Ausweis“, und nichts von der Anlage. PIN eintippen und Enter drücken, oder den Ausweis scannen. Das Bedienfeld öffnet sein Dashboard, mit dem Namen der angemeldeten Person und einer Schaltfläche **Abmelden** in der Ecke, weil die Kopfzeile, die das sonst anzeigen würde, auf einem Bedienfeld fehlt. Ein Druck auf eine Schreib-Schaltfläche fragt wie überall nach Bestätigung und Grund, und der Schreibzugriff wird dieser Person zugeordnet.

Nach Ablauf der Inaktivitätsgrenze, ohne dass jemand den Bildschirm berührt, meldet das Bedienfeld die Person ab und kehrt zum PIN-Feld zurück. Der Server erzwingt das zusätzlich zur Seite: Eine Kiosk-Sitzung, die so lange inaktiv war, wird gelöscht, und ein danach mit ihrem Cookie gesendeter Schreibzugriff wird mit `401` abgelehnt, sodass das Schließen der Seite oder eine hängende Seite niemanden angemeldet zurücklässt. Muss das Bedienfeld mit einem Passwort bedient werden, ist „Passwort verwenden“ unter dem Feld die gewöhnliche Anmeldung, mit den üblichen 12 Stunden und ohne Inaktivitätsgrenze, weil es die eigene Anmeldung einer Person ist.

Als Berühren zählt: ein Tippen, ein Klick, eine Taste oder ein Schreibzugriff. Nicht dazu zählt: dass das Dashboard seine Zahlen aktualisiert oder der Live-Feed, die weiterlaufen, ob jemand da ist oder nicht.

### Einrichtung

Ein admin gibt jeder Person einen Code unter **Einstellungen, Benutzer**: **PIN oder Ausweis** in ihrer Zeile, den Code zweimal, **Setzen**. Oder über die API, was ein Skript nutzen würde, das Ausweise ausgibt:

```sh
curl -X PUT -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"code":"482913"}' https://gateway/api/users/olga/pin

# Take it away (also signs them out of every panel)
curl -X DELETE -H "Authorization: Bearer $TOKEN" https://gateway/api/users/olga/pin
```

- **Eine PIN ist eine Zugangsdaten.** Sie wird als bcrypt-Hash mit denselben Kosten wie ein Passwort gespeichert, nie im Klartext, nie im Systemprotokoll und nie in einer Antwort. Die Benutzerliste sagt nur `hasPin`. Eine Sicherung enthält die Hashes genau wie die der Passwörter ([Sicherungen und Wiederherstellung](/de/iot/backup/)).
- **Ein Ausweis ist ein Wert, den ein Tastatur-Lesegerät eintippt.** Es gibt keinen Hardwaretreiber. Ein Lesegerät, das sich wie eine Tastatur verhält, tippt die Nummer des Ausweises in das einzige Feld des Bedienfelds und drückt Enter, was das Absenden des Formulars ist. Ein Ausweis ist also ein Code wie eine PIN: was immer das Lesegerät tippt, 6 bis 72 Zeichen ohne Leerzeichen, am Konto an derselben Stelle gesetzt. Das Lesen von einem Gerät, das sich nicht wie eine Tastatur verhält, ist nicht gebaut.
- **Ein Code, ein Konto.** Das Bedienfeld findet die Person allein am Code, da ein Ausweisleser keinen Benutzernamen tippt, deshalb wird das Setzen eines Codes, den ein anderes Konto schon hat, abgelehnt.
- **Der Code wird gegen jedes Konto geprüft, das einen hat,** mit demselben bcrypt, das ein Passwort kostet, weil sich ein gesalzener Hash nicht nach Wert nachschlagen lässt. Das dauert so lange, wie es Konten mit Codes gibt, höchstens ein paar Sekunden bei Dutzenden, und es dauert gleich lang, ob der Code stimmt oder nicht.
- **Ein Code meldet mit der Rolle des Kontos an.** Geben Sie ihn jemandem, dessen Rolle die ist, die er an einem Bedienfeld haben soll. Eine Kiosk-Sitzung hat die Berechtigungen des Kontos und nichts Engeres, und der Code eines viewer meldet einen viewer an, dessen Schreibzugriffe das Tor wie immer ablehnt.
- **Ein Konto zu deaktivieren** beendet seine Bedienfeld-Sitzungen mit den übrigen, und der Code eines deaktivierten Kontos meldet nicht an. **Den Code zu entfernen** meldet das Konto von den Bedienfeldern ab und lässt sein Passwort und die Sitzung seines eigenen Rechners in Ruhe.

### Die Zeit bis zur automatischen Abmeldung

Standardmäßig fünfzehn Minuten. Das ist lang genug, um mit einem Klemmbrett am Bedienfeld einen Auftragswechsel zu fahren oder zum Ventil zu gehen und zu sehen, wie es sich bewegt, und kurz genug, dass ein am Ende eines Auftrags zurückgelassenes Bedienfeld nicht noch der Name von jemandem ist, wenn die nächste Person herantritt. Es ist meine Einschätzung, keine Zahl, die der Code oder ein Standard vorgibt. Ändern Sie sie unter **Einstellungen, Werk, Kiosk-Abmeldung bei Inaktivität (Sekunden)**, von 10 Sekunden bis 12 Stunden, ohne Neu-Deployment, oder setzen Sie einen Standard mit `HOTLOOP_AUTH_KIOSK_IDLE` (eine Dauer, `15m`). Was in den Einstellungen gesetzt ist, hat Vorrang vor der Variablen. Die Sitzung endet außerdem bei `HOTLOOP_AUTH_SESSION_TTL`, wie jede Sitzung.

### Die Sperre nach falschen Passwörtern und PINs

Ein falsches Passwort oder eine falsche PIN wird gegen das **Konto** gezählt, auf dem es versucht wurde. Zehn falsche in Folge sperren dieses Konto für fünf Minuten, und kein anderes. Ein richtiges Passwort oder eine richtige PIN vor dem zehnten beginnt die Zählung von vorn, und eine abgelaufene Sperre gibt wieder zehn Versuche. Ein gesperrtes Konto lehnt eine Anmeldung ab, was auch eingegeben wird, richtig oder falsch, mit einem `429`, das sagt, wie lange zu warten ist. Eine Sperre stoppt neue Anmeldungen und sonst nichts: Eine Sitzung, die das Konto schon hat, läuft weiter, mit ihren Anfragen und ihrem Live-Feed, sodass zehn falsche Versuche von jemand anderem den Bildschirm eines Operators an der Linie nicht leer machen können. Sie gilt für die Passwort-Anmeldung und die PIN-Anmeldung gleichermaßen, und jede Sperre steht im Systemprotokoll (Kategorie `auth`).

- **Woher die Zahlen kommen.** NIST SP 800-63B sagt, dass ein Verifizierer die aufeinanderfolgenden Fehlversuche für ein einzelnes Konto begrenzt: Revision 3, Abschnitt 5.2.2, und Revision 4, Abschnitt 3.2.2, legen beide höchstens 100 fest und sagen, ein Betreiber dürfe niedriger ansetzen. Revision 4 erlaubt auch, den Antragsteller nach Fehlversuchen warten zu lassen. Das hier ist dieses Warten, keine dauerhafte Deaktivierung. Zehn ist ein Zehntel der NIST-Obergrenze und mehr, als sich jemand versehentlich vertippt. Fünf Minuten sind lang genug, dass zehn Versuche je fünf Minuten die Million Möglichkeiten einer sechsstelligen PIN außer Reichweite halten (etwa 350 Tage, um alle zu probieren), und kurz genug, dass ein Operator, der sich beim Passwort vertippt hat, nach einem Kaffee wieder dabei ist. Sechs Zeichen als Minimum für eine PIN ist die Untergrenze aus Revision 3, Abschnitt 5.1.1.2, für ein zugewiesenes Geheimnis, was eine von einem admin vergebene PIN ist. Zehn und fünf sind meine Wahl innerhalb der NIST-Grenze, nicht die Zahlen des NIST.
- **Beides sind Einstellungen.** **Einstellungen, Werk**: „Konto nach so vielen falschen Passwörtern oder PINs sperren“ (Standard 10, von 1 bis 100, und 0 schaltet es ab) und „Wie lange ein gesperrtes Konto gesperrt bleibt“ (Standard 5 Minuten, von 10 Sekunden bis zu einem Tag). Die Variablen sind `HOTLOOP_AUTH_LOCKOUT_ATTEMPTS` und `HOTLOOP_AUTH_LOCKOUT_DURATION` (eine Dauer, `5m`). Die Einstellung hat Vorrang vor der Variablen.
- **Ein admin kann ein Konto entsperren.** **Einstellungen, Benutzer** zeigt ein gesperrtes Konto als `locked` mit einer Schaltfläche **Entsperren**, oder `DELETE /api/users/{username}/lockout`. Die Zählung beginnt wieder bei null.
- **Nie das Bedienfeld.** Ein falscher Code, der an einem Bedienfeld getippt wird, wird nie gegen das Bedienfeld gezählt, sodass die Fehler einer Person die nächste dort nicht aufhalten.
- **Ein Code allein lässt sich nicht zählen, also wird das Bedienfeld gebremst.** Ein Ausweisleser tippt nur den Ausweis, und eine allein getippte PIN passt, wenn sie falsch ist, auf kein Konto, es gibt also kein Konto, gegen das man sie zählen könnte. Sie gegen das Bedienfeld zu zählen, würde den nächsten Mitarbeiter für die Fehler des letzten aussperren, und das Bedienfeld wird nie gesperrt. Stattdessen lässt jeder weitere falsche Versuch dieses Bedienfeld eine halbe Sekunde länger warten, bevor der nächste geprüft wird: 0,5 Sekunden nach dem ersten Fehlversuch, 1 nach dem zweiten und so weiter bis zur Obergrenze, standardmäßig 3 Sekunden. Ein richtiger beginnt von vorn. So kommt der nächste Mitarbeiter nach höchstens der Obergrenze hinein, und wer rät, wird auf einen Versuch pro Obergrenze und Bedienfeld begrenzt: Eine Million sechsstellige PINs würden über einen Monat dauern. Gleichzeitig gesendete Versuche stellen sich an, und jeder wartet auf seine Reihe. Eine PIN, die mit ihrem Benutzernamen getippt wird, wird nicht gebremst; sie gehört dem Konto und sperrt es wie ein falsches Passwort. Die längste Wartezeit steht unter **Einstellungen, Werk, Längste Wartezeit eines Bedienfelds nach falschen PINs (Sekunden)**, 0 bis 30, mit `HOTLOOP_AUTH_PANEL_DELAY_CAP` als Standard (eine Dauer, `3s`) und 0 zum Abschalten. Drei Sekunden sind eine Pause, die ein Mitarbeiter, der sich vertippt hat, aushält, und langsam genug, um für jemanden ins Gewicht zu fallen, der jeden Code durchprobiert. Der Schritt von einer halben Sekunde ist fest.
- **Welches Bedienfeld welches ist.** Die Client-Adresse: der erste Hop von `X-Forwarded-For`, wenn ein Proxy einen gesetzt hat, sonst die der Verbindung selbst, was auch die Sitzungsliste aufzeichnet. Etwas Besseres ist vor der Anmeldung nicht bekannt: Es gibt noch keine Sitzung, und ein vom Server ausgegebenes Cookie kann der Client wegwerfen, um die Wartezeit neu zu beginnen. Hinter einem Proxy, der `X-Forwarded-For` setzt, wartet also jedes Bedienfeld für sich. Hinter einem, der das nicht tut, teilen sich alle Bedienfelder die Adresse des Proxys und bremsen einander, höchstens um die Obergrenze. Und ein Client, der den Port direkt erreicht, kann ein eigenes `X-Forwarded-For` senden und der Wartezeit ausweichen. Deshalb ist dies eine Bremse und die Sperre des Kontos die eigentliche Kontrolle: Für Raten, auf das es ankommt, nutzen Sie die Form mit Benutzername oder lange, zufällige Ausweiswerte.
- **Es verrät, dass das Konto existiert.** Das `429` gilt für ein Konto, das existiert, und sagt damit jemandem, der Namen ausprobiert, welche es gibt. Das ist es, was eine Sperre ist.

### Was es nicht tut

- **Ein Code allein lässt sich nicht sperren.** Siehe [Die Sperre](#die-sperre-nach-falschen-passwörtern-und-pins), die erklärt, warum.
- **Keine Warnung vor der Abmeldung.** Das Bedienfeld kehrt zum PIN-Feld zurück, wenn die Zeit um ist.
- **Ein Bedienfeld, das mit einem Passwort angemeldet gelassen wurde** (wie ein Bedienfeld vor dieser Änderung betrieben werden musste), funktioniert weiter wie bisher und schreibt weiter als dieses Konto. Geben Sie einem gemeinsamen Bedienfeld keine dauerhafte Operator-Anmeldung; geben Sie den Personen daran PINs.
- **Kein Lesegerätetreiber, kein SSO, keine Berechtigungen pro Bedienfeld.**

## Benutzer verwalten

Nur admin. In der Oberfläche unter **Einstellungen, Benutzer**: jedes Konto mit Rolle, ob es aktiv ist, und wann es sich zuletzt angemeldet hat, mit Benutzer hinzufügen, Bearbeiten (Rolle und Abschalten), Neues Passwort und Löschen. Für jemanden ohne `users.manage` wird nichts gezeichnet, auch nicht, wenn die Authentifizierung aus ist. Ein Konto, dessen Berechtigungen einzeln aufgelistet wurden, erscheint als `custom` mit der Anzahl, und Bearbeiten behält die Liste, außer Sie wählen eine Rolle, die sie ersetzt. Dasselbe über die REST-API:

Ein Passwort hat 8 bis 72 Bytes: 72 ist bcrypts eigene Grenze, und ein längeres wird mit entsprechendem Hinweis abgelehnt. Es funktioniert genauso über OPC UA (siehe [Der OPC-UA-Server](/de/edge/opc-ua-server/#who-may-log-in)); in früheren Versionen konnte sich ein Passwort über 64 Bytes hier anmelden und dort nicht.

```sh
# List
curl -H "Authorization: Bearer $TOKEN" https://gateway/api/users

# Create
curl -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"username":"j.smith","password":"something-long","role":"operator"}' \
  https://gateway/api/users

# Disable (does not delete; also revokes every session that account holds)
curl -X PUT -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"role":"operator","disabled":true}' \
  https://gateway/api/users/j.smith

# Reset a password an operator forgot
curl -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"password":"a-new-one"}' \
  https://gateway/api/users/j.smith/password
```

Zwei Ablehnungen sollte man kennen, bevor sie jemanden überraschen:

- **Sie können Ihr eigenes Konto nicht löschen, solange Sie damit angemeldet sind.** Wechseln Sie zuerst zu einem anderen admin-Konto.
- **Sie können das letzte aktive admin-Konto weder deaktivieren noch löschen.** Befördern Sie ein zweites Konto zum admin, oder lassen Sie eines in Ruhe, bevor Sie das erste entfernen. Ohne diese Prüfung ist ein einziger Fehler in einem skriptgesteuerten Benutzerabgleich eine Aussperrung, ohne dass noch eine admin-Sitzung übrig wäre, um sie rückgängig zu machen.

Jeder angemeldete Benutzer kann sein eigenes Passwort ohne eine der beiden Einschränkungen ändern:

```sh
curl -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"currentPassword":"old","newPassword":"new"}' \
  https://gateway/api/auth/password
```

Eine Passwortänderung widerruft jede Sitzung, die dieses Konto hat, auch die, die die Anfrage gestellt hat. Der Client soll sich erneut anmelden.

## Gerätezugangsdaten sind nur schreibbar

Hinzugefügt in 4.15.1. Davor gaben `GET /api/devices` und `GET /api/devices/{id}` das `config` und die `address` eines Geräts genau so zurück, wie sie gespeichert waren, sodass jeder angemeldete Benutzer, auch viewer, das MQTT-Broker-Passwort, die HTTP- und MTConnect-Zugangsdaten und alles andere lesen konnte, was in einem Gerät gespeichert war. 4.15.0 verbarg nur das OPC-UA-Passwort. Ab 4.15.1 können die Zugangsdaten eines Geräts von keiner Rolle über die API zurückgelesen werden, **auch nicht von admin**. Um eines zu ändern, senden Sie einen neuen Wert.

### Was als Zugangsdaten zählt

| Protokoll | In der Konfiguration verborgen | Außerdem verborgen |
|---|---|---|
| MQTT | `password` | Benutzerinformationen und geheime Query-Werte in der Adresse (`mqtt://user:pass@broker`) |
| HTTP | `password`; jeder Wert in `headers` außer einigen harmlosen (`Accept`, `Accept-Encoding`, `Accept-Language`, `Cache-Control`, `Content-Type`, `User-Agent`); `body` und `writeBody`, wenn sie Zugangsdaten erwähnen (`password`, `token`, `apiKey` und Ähnliches); ein geheim wirkender Query-Wert in `writeUrl` | Benutzerinformationen und geheime Query-Werte in der Adresse und in `writeUrl` |
| MTConnect | `password`; jeder Wert in `headers`, mit denselben Ausnahmen | Benutzerinformationen und geheime Query-Werte in der Adresse |
| OPC UA | `password` | Benutzerinformationen in der Adresse werden ebenfalls verborgen, und der Treiber ignoriert sie, da eine OPC-UA-Endpunkt-URL keine Zugangsdaten trägt |
| Modbus, S7comm, EtherNet/IP | keine ihrer Optionen sind Zugangsdaten | Benutzerinformationen in der Adresse werden verborgen und vom Treiber aus demselben Grund ignoriert |

Ein Pfad zu einer Schlüsseldatei (`keyFile`) ist kein Schlüsselmaterial und wird angezeigt. Ebenso wenig ein Flag wie `allowInsecureCredentials`.

Die obigen Listen werden im Code geprüft. Ein Test liest die Optionsstruktur jedes Treibers und schlägt fehl, wenn eine Option weder in der Liste der Zugangsdaten noch in der Liste der bekanntermaßen unproblematischen Optionen (`plainConfigKeys`) steht, wenn eine Map mit freien Einträgen oder ein Freitextfeld nicht in der Liste der Zugangsdaten steht, und wenn eine der beiden Listen etwas nennt, das kein Treiber liest. So kann eine neue Option nicht erscheinen, ohne dass jemand entscheidet, welche sie ist.

Als Netz unter den Listen wird jeder Schlüssel in beliebiger Tiefe der Konfiguration eines Geräts anhand seines Namens verborgen, in jedem Protokoll, wenn er `password`, `passwd`, `passphrase`, `pwd`, `secret`, `token`, `apikey`, `authorization`, `credential`, `private`, `bearer`, `cookie`, `basicauth`, `signature`, `jwt`, `oauth`, `sessionid` oder `connectionstring` enthält, oder auf `key` endet, oder als ganzes Wort eines von `pass`, `pw`, `pwd`, `passwd`, `auth`, `cred`, `creds`, `sig`, `signature`, `sas`, `jwt`, `otp`, `pin` oder `psk` enthält. Wörter werden an Satzzeichen und an Übergängen von Klein- zu Großbuchstaben getrennt, sodass `db_pass`, `smtp_pw`, `apiAuth` und `sasToken` zählen und `bypass`, `compass`, `passive`, `authority` und `pinned` nicht. Groß- und Kleinschreibung und Satzzeichen werden ignoriert, ebenso Schreibweisen, die `encoding/json` noch als denselben Schlüssel lesen würde (ein langes s für s, das Kelvin-Zeichen für k). Die Regel für kurze Wörter ist absichtlich grob: Ein Schlüssel, den niemand geprüft hat, wie `authMode`, ist verborgen, bis er zu `plainConfigKeys` hinzugefügt wird.

Ein Wert, der nach Namen verborgen wird, und alles unter einem solchen Schlüssel, wird unabhängig vom Typ ersetzt (eine Zahl wird ebenso verborgen wie ein String), außer einem Boolean, der keine Zugangsdaten sein kann. Ein String, der Zugangsdaten in seinem Text trägt, wird überall, wo er steht, ganz verborgen: eine Befehlszeile mit `--password hunter2`, ein Paar `password=...` oder ein Verbindungsstring, `Authorization: Bearer ...`. Ein Gerät ohne gesetzte Zugangsdaten zeigt keine, sodass sich „kein Passwort“ von „ein Passwort, das ich nicht sehen kann“ unterscheiden lässt. Eine Konfiguration, die sich nicht als JSON lesen lässt, wird als `{}` angezeigt statt wie sie ist.

Ein verborgener Wert erscheint als `[redacted]`. In einer Adresse ersetzt er das Passwort und behält den Benutzernamen (`http://svc:[redacted]@meter/api`), oder die gesamten Benutzerinformationen, wenn es keinen Doppelpunkt gibt, und den Wert jedes geheim wirkenden Parameters der Query und des Fragments (`?fmt=json&token=[redacted]`, `#access_token=[redacted]`). Parameter werden durch `&` oder `;` getrennt, oder durch ihre prozentkodierten Formen `%26` und `%3B`, und jeder wird für sich beurteilt, sodass `?fmt=json` lesbar bleibt. Ein Parameter namens `code` gilt in einer Adresse als Geheimnis, wegen des Azure-Functions-Schlüssels in `?code=`, und nirgendwo sonst. Eine Query, die sich nicht sauber lesen lässt (eine ungültige Prozent-Escape-Folge, ein Steuerzeichen), wird ganz verborgen statt geraten.

### Ein Gerät speichern

`POST /api/devices` legt ein Gerät an, wenn die ID neu ist, und ersetzt es, wenn die ID existiert. Es gibt kein separates `PUT`. Für jede Zugangsdaten in der Adresse und der Konfiguration:

| Was die Anfrage sendet | Ergebnis |
|---|---|
| Ein neues Gerät mit einem echten Wert | Der Wert wird wie angegeben gespeichert. |
| Ein neues Gerät mit `[redacted]` | Mit einem 400 abgelehnt. Der Platzhalter wird nie als Zugangsdaten gespeichert. |
| Ein vorhandenes Gerät, `[redacted]` | Der gespeicherte Wert bleibt erhalten. |
| Ein vorhandenes Gerät, Schlüssel weggelassen | Der gespeicherte Wert bleibt erhalten. Ein Client, der nichts von Geheimnissen weiß, kann keines versehentlich löschen. |
| Ein vorhandenes Gerät, ein neuer String oder eine neue Zahl | Er ersetzt den gespeicherten Wert. |
| Ein vorhandenes Gerät, ein leerer String oder `null` | Er löscht den gespeicherten Wert. Das ist der einzige Weg, Zugangsdaten zu entfernen. |
| `[redacted]`, ohne dass etwas Gespeichertes zu behalten wäre | Mit einem 400 abgelehnt. |

Der Platzhalter wird nie gespeichert, wo immer er in einer Konfiguration oder Adresse erscheint: Er wird durch den gespeicherten Wert an derselben Stelle ersetzt oder abgelehnt, wenn es keinen gibt.

Zwei Einzelheiten. In `headers` (einer Map, deren Einträge die Person gewählt hat) ist die Map die Einheit: Ein weggelassener Eintrag wird entfernt, `{}` löscht alle, und das Weglassen des ganzen `headers`-Schlüssels behält sie. Ein Schlüssel wird ohne Beachtung der Groß- und Kleinschreibung verglichen, wie die Treiber ihn vergleichen. Und alles, was keine Zugangsdaten sind, wird wie immer ersetzt: Ein ohne jedes `config` gespeichertes Gerät behält seine Zugangsdaten und sonst nichts.

Der Geräteeditor der Weboberfläche zeigt die Konfiguration eines Geräts so, wie die API sie zurückgibt, einschließlich der Platzhalter, und speichert, was er zeigt. Ein Gerät zu bearbeiten, ohne Zugangsdaten anzufassen, behält sie also. **Um ein Geheimnis in der Oberfläche zu ändern, ersetzen Sie das `[redacted]` in der Konfiguration (oder in der Adresse) durch den neuen Wert.** Nichts wird mit dem alten vorausgefüllt, wer ein Gerät ändert, muss die Zugangsdaten also kennen, um sie zu ändern.

### Ein Gerät zu verschieben nimmt seine Geheimnisse nicht mit

Behaltene Zugangsdaten werden an das gesendet, worauf das Gerät zeigt. Würden sie beim Verschieben eines Geräts behalten, könnte jeder, der ein Gerät speichern darf, gespeicherte Zugangsdaten auslesen, indem er es auf einen eigenen Listener richtet und das Gateway sie vorlegen lässt. Wenn deshalb ein Speichern den Host oder Port in der Adresse oder in `writeUrl` ändert und gespeicherte Zugangsdaten behalten würde (per Platzhalter oder durch Weglassen), wird es mit einem 400 abgelehnt, das die Zugangsdaten nennt. Geben Sie sie erneut ein, oder senden Sie einen leeren String, um sie zu löschen. Den Pfad, das Schema oder sonst etwas am Gerät zu ändern zählt nicht als Verschieben, und ein Gerät ohne gespeicherte Zugangsdaten kann frei verschoben werden.

### Wo Zugangsdaten nicht erscheinen

Für ein Gerät jedes Protokolls, mit Zugangsdaten an jeder möglichen Stelle, suchen die Tests danach in: jedem Geräte-Endpunkt (Antworten von Liste, Abruf, Anlegen und Aktualisieren) für einen viewer, einen operator und einen admin; jedem anderen Lese-Endpunkt; `/api/diagnostics` und `/api/status`; `/api/sites` und den ausgehenden MCP-Servern, die es auflistet; dem Live-Ereignisstrom; dem Systemprotokoll und dem Schreib-Audit; Fehlerantworten; jedem MCP-Werkzeug und jeder MCP-Ressource; und dem Prozessprotokoll auf Debug-Ebene, von der Laufzeit und von den Treibern. Der Fehlertext eines Treibers und die Ereignisse und Protokolle der Laufzeit werden von den Zugangsdaten eines Geräts bereinigt, nach Wert und nach Form, weil ein Fehler eine Adresse oder die Antwort eines Servers wiederholen kann. Zugangsdaten aus einem oder zwei Zeichen werden nur dort ersetzt, wo sie als eigenes Wort stehen, da ein Ersetzen überall die Meldung ruinieren würde.

### Wo Zugangsdaten noch im Klartext liegen

Nur schreibbar betrifft die API. Das Gateway braucht die echten Werte zum Verbinden, und diese Orte halten sie so, wie sie gespeichert sind:

- **Die Datenbank.** Gerätezugangsdaten liegen in den Spalten `config` und `address`. Mit gesetztem `HOTLOOP_SECRET_KEY_FILE` werden die Schlüsselfelder in `config` (jedes `password`, Header-Werte) mit einem Schlüssel verschlüsselt, der außerhalb der Datenbank liegt, ebenso eine Adresse oder eine Option mit Zugangsdaten im Text (`mqtt://user:pass@host`, `?token=`), ganz versiegelt. Siehe [Sicherungen und Wiederherstellung](/de/iot/backup/#gerätezugangsdaten-und-der-geheime-schlüssel).
- **Sicherungen.** `devices.copy` in einer Sicherung enthält sie, verschlüsselt oder nicht genau wie die Datenbank. Siehe [Sicherungen und Wiederherstellung](/de/iot/backup/#sicherungsdateien-schützen).
- **Gerätedateien des Edge Relay.** Das Relay liest eine JSON-Datei, die die Zugangsdaten seiner Geräte enthält. Siehe [Edge-Relay-Referenz](/de/edge-relay/reference/#credentials-in-the-device-file-4150).
- **Konfigurations-Push an die Flotte.** Eine an ein Relay gepushte Gerätedatei wird unverändert auf einem MQTT-Topic veröffentlicht, retained. Siehe [Flottenverwaltung](/de/gateway/fleet/).

Schützen Sie die Datenbank, das Sicherungsvolume, die Gerätedatei des Relays und den Broker entsprechend. Das Schwärzen in der API ändert an keinem davon etwas.

### Wenn nicht vertrauenswürdige Benutzer die API erreichen konnten

Vor 4.15.1 konnte jeder angemeldete Benutzer gespeicherte Gerätezugangsdaten über die API lesen. Ein Betreiber, dessen Gateway für Benutzer erreichbar war, die es nicht hätten erreichen sollen (ein an einen Auftragnehmer vergebenes viewer-Konto, zum Beispiel), sollte die Zugangsdaten der darin gehaltenen Geräte erneuern: den MQTT-Broker, die HTTP- und MTConnect-Endpunkte und die OPC-UA-Konten. Seit 4.3.1 gab es keine öffentliche Version, die Gefährdung beschränkt sich also auf Deployments unveröffentlichter Builds.

## Was der Audit-Trail festhält

Jeder Schreibzugriff ging schon durch `write_audit` mit einer Spalte `actor`, siehe das Schreibtor im Haupt-README. Diese Spalte stammt jetzt aus der Sitzung, nicht aus einem Header, und an einem Kiosk-Bedienfeld ist die Sitzung die Person, die sich mit PIN oder Ausweis angemeldet hat:

```
> write_tag tag=press-01/Zone1_Temp value=99 reason="testing"
```

zeichnet `j.smith` auf, den Benutzernamen der Sitzung, die den Aufruf gemacht hat, nicht das, was `X-Forwarded-User` gerade sagte. Anmeldungen, Kiosk-Anmeldungen, Abmeldungen, Passwortänderungen und jede Benutzerverwaltungsaktion, auch das Setzen oder Löschen einer PIN (nie die PIN selbst), werden im Systemprotokoll (`GET /api/events`, Kategorie `auth`) festgehalten, aus demselben Grund, aus dem es das Schreib-Audit gibt: Eine Änderung in sechs Monaten soll erklärbar sein, nicht nur sichtbar.

## Ohne Anmeldung betreiben

Setzen Sie `HOTLOOP_AUTH_INSECURE=true` (oder `auth.insecure: true` im Chart), um genau wie jede Version vor 4.4.0 zu laufen: keine Sitzung erforderlich, der bei einem Schreibzugriff aufgezeichnete Akteur stammt aus `X-EmberNET-User` oder ähnlichen Proxy-Headern und fällt auf `"operator"` zurück, wenn keiner gesetzt ist.

Das ist eine echte, vertretbare Wahl für ein Deployment, bei dem die NetworkPolicy des EmberNet-Dashboards selbst der tatsächliche Perimeter ist und nichts anderes den Pod erreichen kann. Es ist nicht mehr der Standard, weil man leicht glaubt, diese Bedingung sei erfüllt, und sie von innerhalb des Pods nur schwer prüfen kann: Der ganze Sinn von 4.4.0 ist, dass ein Fehler in einer NetworkPolicy oder ein Deployment, das sich doch nicht hinter dem Dashboard befindet, nicht auch noch bedeuten darf, dass `actor(r)` etwas zurückgibt, das ein Angreifer gewählt hat.

`config.Validate` verweigert den Start, wenn die Authentifizierung weder aktiviert noch auf diese Weise bestätigt ist, gerade damit „keine Authentifizierung“ immer eine Entscheidung ist, die jemand bewusst getroffen hat, in der eigenen Konfiguration des Deployments festgehalten, und kein Standard, den niemand gewählt hat.

## Anmeldung über das EmberNet-Dashboard

Ein Tenant, der HotLoop aus dem EmberNet App Store installiert, geht mit LAUNCH bereits als er selbst angemeldet in die App, ohne dass ein Passwort herausgegeben wird. Der App-Host des Dashboards setzt `X-Embernet-Assertion` auf jede Anfrage, die er an diesen Pod weiterreicht: ein ES256-Token, etwa eine Minute gültig, signiert mit einem privaten Schlüssel, den nur das Dashboard besitzt. Es nennt die Person (`email`), den Tenant, die eine App, für die es ausgestellt wurde (`aud`, `<tenant>/<Service name>`), und die HotLoop-Rolle, auf die der Tenant die Dashboard-Rolle dieser Person abbildet (`role`: `admin`, `operator` oder `viewer`).

Es ist aus, solange kein öffentlicher Schlüssel konfiguriert ist, und dann funktioniert alles andere wie bisher: lokale Konten, das Cookie, das Bearer-Token, das Kiosk-Bedienfeld.

| Variable | Chart-Wert | Zweck |
|---|---|---|
| `HOTLOOP_AUTH_ASSERTION_PUBLIC_KEY` | `embernetSignin.publicKey` | der ÖFFENTLICHE Schlüssel des Dashboards, PKIX-PEM, ECDSA P-256. Der Store trägt ihn bei einem Deploy ein. |
| `HOTLOOP_AUTH_ASSERTION_AUDIENCE` | aus Namespace und Release-Name abgeleitet | `<tenant>/<Service name>`. Mit dem Schlüssel erforderlich; ein für eine andere App oder einen anderen Tenant ausgestelltes Token wird abgelehnt. |
| `HOTLOOP_AUTH_ASSERTION_ISSUER` | `embernetSignin.issuer` | `embernet-dashboard` |
| `HOTLOOP_AUTH_ASSERTION_HEADER` | `embernetSignin.header` | `X-Embernet-Assertion` |

Was eine gute Assertion bewirkt: Die Person bekommt hier einen Benutzer, sobald das Dashboard das erste Mal für sie bürgt (benannt nach ihrer Adresse, ohne Passwort, sodass nichts zu erraten ist), die Rolle des Benutzers folgt bei jeder Anfrage dem, was das Dashboard gesendet hat, und der Audit-Trail nennt sie. Was eine schlechte bewirkt: 401, und sie wird nicht stillschweigend zugunsten eines zufällig vorhandenen Sitzungs-Cookies beiseitegelegt. Abgelehnt werden eine falsche Signatur, jeder Algorithmus außer ES256, ein abgelaufenes oder noch nicht gültiges Token, eines, das länger als zehn Minuten lebt, ein falscher Aussteller, die Audience einer anderen App oder eines anderen Tenants, ein Tenant-Claim, der der Audience widerspricht, eine Rolle, die keine der unseren ist, und ein Name ohne Adresse.

Ein lokaler admin behält das letzte Wort über jemanden, den das Dashboard hereingelassen hat: Deaktivieren Sie den Benutzer, und er bleibt draußen, und geben Sie ihm eine ausdrückliche Berechtigungsliste, und er behält sie. Schreibzugriffe brauchen weiterhin die eigenen Schreibschalter des Pods; eine Assertion erweitert sie nie. Das Abmelden von einer vom Dashboard erzeugten Sitzung beendet sie nicht: Der Zugriff endet bei der nächsten Anfrage, die das Dashboard nicht mehr signiert.

## Was dies noch nicht abdeckt

- **Kein OpenID Connect.** Lokale Konten, dazu die oben beschriebene signierte Assertion des EmberNet-Dashboards. Eine Integration eines Identitätsanbieters ist nicht gebaut.
- **Keine Rollen pro Tenant oder pro Standort.** Die Berechtigungen eines Benutzers sind überall gleich, wo das Gateway läuft, was für ein Werk in Ordnung ist und für die Mehrstandort-Zusammenfassung in `Sites` mehr Überlegung bräuchte.
- **Keine Sperre für eine allein getippte PIN oder einen allein getippten Ausweis,** nur für ein Passwort und eine PIN mit ihrem Benutzernamen; siehe [Die Sperre](#die-sperre-nach-falschen-passwörtern-und-pins). Der zeitkonstante Vergleich in `handleLogin` verhindert das Aufzählen von Benutzernamen über die Antwortzeit. Eine NetworkPolicy oder ein vorgeschalteter Proxy vor dem Anmelde-Endpunkt bleibt sinnvoll.
