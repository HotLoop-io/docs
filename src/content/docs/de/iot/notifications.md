---
title: "Alarmbenachrichtigungen"
description: "ntfy, Gotify, Discord, Webhooks und E-Mail. Tippen Sie auf dem Handy auf Quittieren, und der Alarm ist quittiert, signiert und nur einmal gültig."
---

Alarmbenachrichtigungen, seit 4.10.0, wecken ein Telefon, wenn um 03:00 Uhr ein Alarm ausgelöst wird. Wenn ein Alarm **ausgelöst** wird, sendet HotLoop eine Benachrichtigung über jeden konfigurierten, aktivierten Kanal, dessen Prioritätsschwelle der Alarm erreicht. Seit 4.23.6 im Helm-Chart an (`HOTLOOP_NOTIFY_ENABLED`), senden sie nichts, bis ein Kanal mit seinem Ziel aktiviert wird: Eine Bereitstellung ohne jemanden, den man alarmieren kann, hat hier nichts zu konfigurieren.

## Warum nur "kommt"

`alarm.Engine.OnTransition` löst bei jedem ISA-18.2-Übergang aus: gekommen, gegangen, quittiert, ausgeblendet, eingeblendet. Dieses Paket hört auf alle, handelt aber nur bei einem. Bei jedem Übergang zu rufen, würde das Handy eines Bedieners vibrieren lassen, wenn er seinen eigenen Alarm quittiert, wenn er von selbst geht oder wenn jemand ihn für eine Schicht ausblendet, und ihn dazu erziehen, Meldungen ungelesen wegzuwischen, so wie ein flatternder Alarm dazu erzieht, Alarme zu ignorieren. "Gekommen" ist das einzige Ereignis, das heißt: "Etwas braucht einen Menschen, der vielleicht gerade nicht auf einen Bildschirm schaut", und genau dafür gibt es dieses Paket.

Der einzige andere Ruf ist eine Eskalation: Der Alarm kam, niemand hat quittiert, und die Richtlinie sagt, dass die nächste Person gerufen wird. Es ist derselbe Alarm, der weiter jemanden braucht, noch einmal an jemand anderen gemeldet, kein neues Ereignis. Siehe "Eskalation".

Ein Fall sieht wie ein Einblenden aus und ist in Wahrheit ein Kommen. Tritt die Bedingung auf, während ein Alarm ausgeblendet ist, wurde niemand informiert. Wenn das Ausblenden endet (per Zeitablauf oder von Hand aufgehoben), erfasst die Engine das Einblenden und danach ein Kommen, und das Kommen ruft. Ein Alarm, der beim Ausblenden schon im Alarmzustand war und es noch ist, kommt unquittiert zurück, ruft aber nicht erneut: Er hat beim ersten Mal gerufen.

## Die Kanäle

Es sind sechs, und das ist die Liste (siehe "Benachrichtigungen" in der [HotLoop-Roadmap](/de/roadmap/), was wir nicht tun und warum). Keiner braucht ein Hersteller-SDK oder ein kostenpflichtiges Konto, entsprechend dem Plan dieses Projekts: Cloud-Integrationen sind optionale ausgehende Verbindungen, die ein Betreiber einrichtet, nie etwas, das diese Anwendung zum Laufen braucht.

- **ntfy**: eine Push-Nachricht aufs Handy, mit einer Schaltfläche **Quittieren**, die den Alarm direkt in HotLoop quittiert. Kostenlos, und den Server können Sie im Anlagennetz ganz ohne Internet betreiben. Siehe "ntfy einrichten".
- **Gotify**: eine Push-Nachricht aufs Handy. Kostenlos, selbst gehostet, funktioniert ohne Internet. Keine Schaltflächen und keine iPhone-App, also ein Pager, kein Zweiwegekanal. Siehe "Gotify einrichten".
- **Discord-Webhook**: eine Einbettung in einem Discord-Kanal, nach Priorität eingefärbt, mit Tag, Wert, Grenzwert, Bereich und Linie. URL einfügen, und es funktioniert. Kritische Alarme können eine Rolle erwähnen. Keine Schaltflächen. Siehe "Discord".
- **Discord-Bot**: dieselbe Nachricht, mit den Schaltflächen **Quittieren** und **Ausblenden**, die auf den Alarm wirken und festhalten, wer sie gedrückt hat. Die Klicks kommen über eine Verbindung zurück, die HotLoop zu Discord öffnet, die Anlage braucht also keine öffentliche Adresse. Siehe "Discord".

- **Webhook**: ein POST mit HotLoops eigenem JSON-Body (`alarmId`, `name`, `priority`, `priorityLabel`, `message`, `deviceId`, `tagName`, `raisedAt`, `event`, das `raised` ist, oder `escalated` bei einer Eskalation) an eine konfigurierte URL. Er funktioniert mit allem, was beliebiges JSON annimmt: Ihr eigenes Skript hinter einem kleinen HTTP-Listener, Node-RED, n8n oder ein "beliebiger Webhook"-Trigger in einem Workflow-Werkzeug. (Auf ein ntfy-Topic gerichtet, ruft er, mit dem rohen JSON als Text; nehmen Sie dafür besser den ntfy-Kanal oben.) Eine Zusammenfassung (siehe "Ratenbegrenzung und Zusammenfassungen") hat `event` mit dem Wert `summary` und eine Liste `alarms`, die jeden enthaltenen Alarm nennt. Er funktioniert nicht mit Diensten, die den Body in ihrem eigenen Format wollen. Discord antwortet 400, weil weder `content` noch `embeds` da sind. Slack, Teams und Google Chat wollen ihr eigenes Textfeld. Pushover will seine Felder `token`, `user` und `message`, und die Events-API von PagerDuty will einen `routing_key`, eine `event_action` und ein `payload`. Richten Sie den Webhook auf einen davon, und jeder Ruf schlägt fehl. Discord hat eigene Kanäle, die den Body bauen, den Discord erwartet; nehmen Sie diese.
- **E-Mail über SMTP**: gesendet über das Relay, das der Betreiber schon hat (ein Firmen-Mailserver, der SMTP-Endpunkt eines Anbieters für Transaktionsmails, ein selbst gehostetes Relay). Kein API-Schlüssel, keine Hersteller-Bibliothek: `net/smtp` und eine von Hand gebaute Nur-Text-Nachricht. Viele Handys zeigen E-Mail schon von sich aus als Push-Nachricht an, und viele Alarmierungswerkzeuge akzeptieren eine E-Mail-zu-SMS-Brückenadresse als "Kontaktmethode". Allein dieser Kanal deckt also einen großen Teil von "ein Handy rufen" ab, ganz ohne kostenpflichtige Abhängigkeit.

## Wohin Alarme gehen: Einstellungen

Jeder Kanal ist standardmäßig an und untätig, bis er ein Ziel zum Senden hat. Ein aktivierter Kanal ohne Ziel hindert HotLoop nie am Start, er wartet und sagt das. Ein Administrator gibt jedem sein Ziel unter Einstellungen, "Wohin Alarme und Messwerte gehen": die Webhook-URL, das E-Mail-Relay und die Empfänger, den ntfy-Server und das Topic, den Gotify-Server und das Token, die Discord-Webhook-URL, das Token und den Kanal des Discord-Bots sowie den Broker und die Sparkplug-Gruppe des Edge-Publishers. Jeder zeigt, was er tut (sendet, wartet auf ein Ziel, aus) und was ihm fehlt.

- Die Alarmkanäle gelten in dem Moment, in dem die Einstellung gespeichert wird: Der Dispatcher wird an Ort und Stelle neu aufgebaut, was die alten Kanäle zurückhielten, geht zuerst hinaus, und die Verbindung des Discord-Bots wird geschlossen, bevor eine neue geöffnet wird. **Test senden** (`POST /api/notify/test`) erreicht dann den eben gespeicherten Kanal.
- Der Edge-Publisher besitzt eine Warteschlangendatei und einen Sparkplug-Knoten, also wird sein Ziel beim Start von HotLoop gelesen. Der Bildschirm sagt "Saved, applies when HotLoop restarts".
- Was dort gespeichert ist, gilt vor dem Chart oder der Umgebung, die es nur vorbelegen. Ein leer gelassener Wert behält das Gespeicherte; Löschen entfernt es. Ein Geheimnis (eine Webhook-URL, ein ntfy-Topic, ein Token, ein Passwort) wird nie wieder angezeigt, nur ob es gesetzt ist, und wird in der Datenbank versiegelt, wenn HotLoop einen geheimen Schlüssel hat.
- Ein Ziel wird so geprüft wie die Umgebung beim Start, bevor etwas gespeichert wird, und ein falsches wird abgelehnt mit der Angabe, was falsch ist (nie der Wert).
- Ein Schalter pro Kanal schaltet ihn endgültig ab: aus heißt kein Kanal, kein Senden.
- `GET /api/destinations` und `PUT /api/destinations/{kind}` sind die Routen; das PUT braucht `settings.write`. Siehe [die HTTP-API](/de/iot/api/).

## Die Webhook-URL wird nie ausgegeben

Bei vielen Empfängern ist die URL das Passwort. Discord legt das Token in den Pfad (`/api/webhooks/{id}/{token}`), ntfy nimmt es als `?auth=`, Google Chat als `?key=` und `?token=`. Wer die URL hat, kann in Ihren Kanal schreiben. Deshalb nennt der Fehler bei einem fehlgeschlagenen Senden nur das Schema und den Host und sonst nichts:

```
webhook request to https://discord.com failed: context deadline exceeded
webhook https://ntfy.example.com returned 401 Unauthorized
```

Das ist derselbe Text im Log, im Audit-Ereignis und in der Antwort von `POST /api/notify/test`. Der Host genügt, um zu erkennen, welcher Empfänger ausgefallen ist; Pfad und Query verlassen den Prozess nie. Eine URL, die beim Start die Prüfung nicht besteht, wird in diesem Fehler ebenfalls nicht wiederholt. Wenn Sie die URL sehen müssen, schauen Sie in `HOTLOOP_NOTIFY_WEBHOOK_URL`, wo Sie sie gesetzt haben.

## ntfy einrichten

[ntfy](https://ntfy.sh) ist ein Publish/Subscribe-Push-Server. HotLoop veröffentlicht jeden Alarm in einem Topic; die ntfy-App auf dem Handy abonniert es.

1. Starten Sie einen Server oder nutzen Sie ntfy.sh. In einem Anlagennetz betreiben Sie Ihren eigenen (`binwiederhier/ntfy`, ein Container) und sichern ihn ab: Setzen Sie `auth-default-access: deny-all`, legen Sie für HotLoop einen Benutzer an, der das Topic beschreiben darf, und je Person einen, der es lesen darf. Auf ntfy.sh oder jedem Server, den jeder erreichen kann, **ist der Topic-Name das Passwort**: Wer ihn errät, liest Ihre Alarme. Wählen Sie ihn lang und zufällig.
2. Geben Sie HotLoop ein Zugriffstoken (`ntfy token add hotloop`) oder einen Benutzernamen und ein Passwort für diesen Benutzer.
3. Setzen Sie `HOTLOOP_PUBLIC_URL` auf die Adresse, unter der ein Handy HotLoop erreicht, zum Beispiel `https://hotloop.plant.example`. Ohne sie kommt die Benachrichtigung trotzdem an, aber ohne Schaltfläche Quittieren und ohne Tippen zum Öffnen, weil das Handy für beides kein Ziel hätte.
4. Konfigurieren Sie es und starten Sie neu:

```
HOTLOOP_NOTIFY_ENABLED=true
HOTLOOP_NOTIFY_NTFY_ENABLED=true
HOTLOOP_NOTIFY_NTFY_URL=https://ntfy.plant.example
HOTLOOP_NOTIFY_NTFY_TOPIC=boiler-house-alarms
HOTLOOP_NOTIFY_NTFY_TOKEN=tk_...
HOTLOOP_PUBLIC_URL=https://hotloop.plant.example
```

5. `POST /api/notify/test` sendet eine Testbenachrichtigung. Sie hat keine Schaltfläche Quittieren, weil kein Alarm dahinter steht, den man quittieren könnte.

Die URL ist nur der Server. Das Topic steht in einer eigenen Einstellung, nie in der URL: So weiß HotLoop, welcher Teil das Geheimnis ist, und hält ihn aus jedem Fehler, jeder Logzeile und jedem Audit-Ereignis heraus.

Was ankommt:

| <span class="sr-only">Details</span> | <span class="sr-only">Details</span> |
|---|---|
| Titel | Der Name des Alarms |
| Text | Die Meldung des Alarms, seine Priorität, woher er kam (`device/tag`) und wann er kam |
| Priorität | Kritisch 5 (max: Auf Android kann sie Nicht stören durchbrechen, wenn Sie es erlauben), Hoch 4, Mittel 3, Niedrig 2 |
| Tags | Ein Emoji nach Schweregrad und die Priorität als Wort, damit sich die Liste auf dem Handy überfliegen lässt |
| Tippen | Öffnet HotLoops Alarmliste, wenn `HOTLOOP_PUBLIC_URL` gesetzt ist |
| Schaltfläche | **Quittieren**, wenn `HOTLOOP_PUBLIC_URL` gesetzt ist. Siehe "Quittierlinks" |

### Der Vorbehalt beim iPhone

Android funktioniert ganz ohne Internet: Die ntfy-App hält eine eigene Verbindung zu Ihrem Server und bekommt jede Nachricht sofort über das WLAN der Anlage.

iPhones nicht. Apple lässt Push nur über die eigenen Server (APNs) durch, und nur ntfy.sh kann mit APNs sprechen. Ein selbst gehosteter Server muss mit `upstream-base-url: https://ntfy.sh` konfiguriert werden und leitet dann eine Abfrageanforderung (ohne Nachrichteninhalt, nur "auf diesem Topic ist etwas angekommen") an ntfy.sh weiter, das das Handy weckt, das die Nachricht dann von Ihrem Server holt. In einer Anlage ohne Internet bekommen iPhones also keine sofortigen Benachrichtigungen von einem selbst gehosteten ntfy. Sie sehen sie, wenn die App geöffnet wird. Wenn Ihre Leute iPhones tragen und die Anlage vom Internet getrennt ist, ist ntfy nicht Ihr Pager; E-Mail über ein Relay ist es, oder Discord, wenn die Anlage es erreichen kann. Gotify hat gar keine iPhone-App.

Die Schaltfläche Quittieren ist eine Anfrage vom Handy an `HOTLOOP_PUBLIC_URL`, das Handy muss diese Adresse also erreichen können: im WLAN der Anlage oder über das VPN, das Sie nutzen. Sie funktioniert auf beiden Plattformen gleich.

## Gotify einrichten

[Gotify](https://gotify.net) ist ein kleiner selbst gehosteter Push-Server mit einer Android-App. Kein Internet nötig, kein Konto irgendwo.

1. Starten Sie `gotify/server` und melden Sie sich in der Weboberfläche an.
2. Legen Sie unter **Apps** eine Anwendung namens HotLoop an. Kopieren Sie ihr Token.
3. Konfigurieren Sie es und starten Sie neu:

```
HOTLOOP_NOTIFY_ENABLED=true
HOTLOOP_NOTIFY_GOTIFY_ENABLED=true
HOTLOOP_NOTIFY_GOTIFY_URL=https://gotify.plant.example
HOTLOOP_NOTIFY_GOTIFY_TOKEN=A...
HOTLOOP_PUBLIC_URL=https://hotloop.plant.example
```

Das Token kommt in den Header `X-Gotify-Key`, nie als `?token=` in die URL, wo es im Zugriffslog jedes Proxys landen würde.

Die Prioritäten entsprechen dem, was die Android-App daraus macht: Kritisch 10 und Hoch 8 sind hohe Wichtigkeit (Ton und Heads-up-Einblendung), Mittel 5 ist eine normale Benachrichtigung mit Ton, Niedrig 2 ist lautlos. Die Nachricht ist Markdown (der Alarmname fett, die Details als Liste, der eigene Alarmtext maskiert, damit ein Name mit Sternchen als dieser Name erscheint), und Antippen öffnet HotLoops Alarmliste, wenn `HOTLOOP_PUBLIC_URL` gesetzt ist.

**Kein Quittieren.** Gotify-Benachrichtigungen haben keine Aktionsschaltflächen, also lässt sich keine Schaltfläche Quittieren anbringen, und wir täuschen sie nicht mit einem Link vor, der bei einem einfachen GET quittiert: Link-Vorschauen und Sicherheitsscanner öffnen Links von selbst, und ein Alarm darf nie von einem Roboter quittiert werden. Quittieren Sie in HotLoop. Auch **keine iPhone-App**.

## Discord

Zwei Wege. Der Webhook ist ein Pager: URL einfügen, Alarme in einem Kanal erhalten. Der Bot ist ein Zweiwegekanal: dieselben Nachrichten mit den Schaltflächen **Quittieren** und **Ausblenden**, und die Audit-Spur sagt, welche Person sie gedrückt hat. Beide brauchen eine Verbindung der Anlage zu Discord über das Internet (ausgehendes HTTPS zu `discord.com` und für den Bot ein WebSocket zu `*.discord.gg`). Keiner braucht, dass Discord die Anlage erreicht.

### Was ankommt

| <span class="sr-only">Details</span> | <span class="sr-only">Details</span> |
|---|---|
| Text | `[Critical] Boiler Trip`, das zeigt die Push-Benachrichtigung eines Handys. Bei einem kritischen Alarm davor eine Erwähnung der konfigurierten Rolle |
| Titel der Einbettung | Derselbe, mit einem Link auf HotLoops Alarmliste, wenn `HOTLOOP_PUBLIC_URL` gesetzt ist |
| Farbe | Kritisch rot, Hoch orange, Mittel gelb, Niedrig blau |
| Beschreibung | Die Meldung des Alarms |
| Felder | Tag (`device/tag`), Wert (der Messwert, der ihn ausgelöst hat), Grenzwert (`hi 90`, aus der Definition), Bereich / Linie (vom Gerät), Gekommen (in der Zeitzone des jeweiligen Lesers) |
| Fußzeile | `HotLoop | <HOTLOOP_PLANT_NAME>`, damit ein Server mit mehreren Anlagen sie unterscheiden kann (nur `HotLoop`, wenn kein Anlagenname gesetzt ist) |
| Schaltflächen (nur Bot) | Quittieren, 1 h ausblenden, In HotLoop öffnen |

Eine Flut wird zur Zusammenfassung, wie bei jedem anderen Kanal: Die ersten fünf gehen raus, dann eine Nachricht mit dem Rest, so vielen Namen, wie hineinpassen, und der Anzahl der übrigen, damit die Anzahl nie abgeschnitten wird.

Discord lehnt eine zu lange Nachricht ab (2000 Zeichen Text, 256 Titel, 4096 Beschreibung, 25 Felder, 6000 insgesamt), und eine abgelehnte Nachricht ist ein Ruf, der nicht rausging. Deshalb kürzt HotLoop passend, an einer Zeichengrenze, mit `...` an der Schnittstelle.

### Niemand wird aus Versehen erwähnt

Jede Nachricht geht mit `allowed_mentions: {"parse": []}` raus. Ohne das alarmiert Discord alles, was der Text erwähnt, ein Alarm, den jemand "@everyone tank overflow" genannt hat, würde also den ganzen Server wecken. Mit dem Parameter alarmiert nichts im Text irgendwen. Die einzige Ausnahme ist die Rolle, die Sie für Kritisch konfigurieren (`..._CRITICAL_ROLE`), die ausdrücklich als einzige erlaubte Erwähnung genannt wird, und nur bei einem kritischen Alarm oder einer Zusammenfassung mit einem kritischen Alarm darin. Eine Testbenachrichtigung erwähnt nie jemanden. Auch der Alarmtext wird als Markdown maskiert, ein Name mit `*` erscheint also als dieser Name, und ein `<@&role>` in einem Namen wird angezeigt, nicht ausgeführt.

Damit die Erwähnung funktioniert, muss die Rolle erwähnbar sein: Schalten Sie in den Rolleneinstellungen des Servers **Jeder darf diese Rolle erwähnen** ein, oder geben Sie dem Bot die Berechtigung **@everyone, @here und alle Rollen erwähnen**.

### Discords Ratenbegrenzung und Sperren

Discord antwortet auf "zu schnell" mit einem 429 und sagt, wie lange zu warten ist, im Body (`retry_after`, auf die Millisekunde) und in `X-RateLimit-Reset-After`. So lange wartet HotLoop vor dem erneuten Versuch, innerhalb der üblichen drei Versuche und 30 Sekunden (siehe "Wiederholungen"). Meldet Discord, dass das Budget aufgebraucht ist, bevor es ablehnt (`X-RateLimit-Remaining: 0`), wartet das nächste Senden auf das Zurücksetzen, statt ein 429 zu ziehen.

Discord sperrt die Adresse von allem, was in zehn Minuten 10.000 abgelehnte Anfragen (401, 403, 429) ansammelt, und die Sperre reißt jede Discord-Integration auf dieser Adresse mit. Wenn Discord also mit **401, 403 oder 404** antwortet (ein falscher oder gelöschter Webhook, ein falsches Bot-Token, ein Kanal, den der Bot nicht sieht), **schaltet HotLoop diesen Kanal ab** nach dieser einen Anfrage. Es protokolliert das einmal, jeder weitere Alarm wird ohne Anfrage abgelehnt (und als nicht gesendet auditiert, damit "wurde jemand informiert" weiter eine Antwort hat), und es erscheint in `GET /api/diagnostics` unter `notify.channels`, mit Grund und Zeitpunkt:

```json
{"channel": "discord-webhook", "broken": true,
 "reason": "discord webhook https://discord.com returned 404 Not Found: Unknown Webhook (Discord error 10015)",
 "since": "2026-09-27T03:00:01Z"}
```

Korrigieren Sie die Einstellung und starten Sie HotLoop neu. Ein 500 oder gar keine Antwort schaltet nichts ab; sie werden wie bei jedem anderen Kanal wiederholt.

### Den Webhook einrichten

1. Öffnen Sie in Discord die Einstellungen des Kanals (das Zahnrad), **Integrationen**, **Webhooks**, **Neuer Webhook**. Nennen Sie ihn HotLoop. **Webhook-URL kopieren**.
2. Optional: eine Rolle, die bei Kritisch erwähnt wird. Schalten Sie den **Entwicklermodus** ein (Benutzereinstellungen, Erweitert), klicken Sie dann in den Servereinstellungen unter Rollen mit rechts auf die Rolle und wählen Sie **Rollen-ID kopieren**. Es ist eine Zahl, kein Name.
3. Konfigurieren Sie es und starten Sie neu:

```
HOTLOOP_NOTIFY_ENABLED=true
HOTLOOP_NOTIFY_DISCORD_WEBHOOK_ENABLED=true
HOTLOOP_NOTIFY_DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/1234.../AbCd...
HOTLOOP_NOTIFY_DISCORD_WEBHOOK_CRITICAL_ROLE=123456789012345678
HOTLOOP_PUBLIC_URL=https://hotloop.plant.example
```

4. `POST /api/notify/test` sendet eine Testnachricht.

**Die ganze URL ist das Passwort.** Wer sie hat, kann als der Webhook in Ihren Kanal schreiben. HotLoop gibt sie nie aus: nicht im Log, nicht in einem Fehler, nicht in einem Audit-Ereignis, nicht in einer API-Antwort, und eine URL, die beim Start die Prüfung nicht besteht, wird in diesem Fehler ebenfalls nicht wiederholt. Im Helm-Chart kommt sie in ein Secret. Wenn sie durchsickert, löschen Sie den Webhook in Discord und legen einen neuen an.

Ein Webhook kann keine Schaltfläche tragen, die etwas bewirkt, also gibt es hier kein Quittieren. Der Titel verlinkt auf die Alarmliste in HotLoop. Für Schaltflächen nehmen Sie den Bot.

### Den Bot einrichten

1. Gehen Sie zum [Discord-Entwicklerportal](https://discord.com/developers/applications), **New Application**, nennen Sie sie HotLoop. Die **Application ID** auf der Seite General Information braucht der Einladungslink.
2. Reiter **Bot**: **Reset Token** und kopieren Sie es. Discord zeigt es nur einmal. Das ist `HOTLOOP_NOTIFY_DISCORD_BOT_TOKEN`. Schalten Sie auf derselben Seite **Public Bot** aus, damit niemand außer Ihnen ihn zu einem Server hinzufügen kann, und lassen Sie alle drei **Privileged Gateway Intents** aus. HotLoop fragt bei Discord keinerlei Ereignisse an (intents 0); Klicks auf Schaltflächen kommen trotzdem an.
3. Laden Sie ihn mit dem Mindesten auf Ihren Server ein, View Channels, Send Messages und Embed Links (Berechtigungen `19456`), und mit keinem anderen Scope als `bot`:

```
https://discord.com/oauth2/authorize?client_id=<APPLICATION ID>&scope=bot&permissions=19456
```

   Fügen Sie **Mention @everyone, @here, and All Roles** (`permissions=150528`) nur hinzu, wenn die Kritisch-Rolle nicht erwähnbar ist und Sie sie lieber nicht erwähnbar machen. Die eigene Nachricht nach einem Klick zu bearbeiten, braucht keine Berechtigung; das läuft über den Klick selbst.
4. Der Kanal: Klicken Sie bei eingeschaltetem Entwicklermodus mit rechts darauf, **Kanal-ID kopieren**. Ist der Kanal privat, fügen Sie die Rolle des Bots hinzu.
5. Die Rollen, die die Schaltflächen drücken dürfen. Legen Sie eine Rolle an (etwa "Alarm ack"), geben Sie sie den Personen, die von Discord aus quittieren dürfen, und kopieren Sie ihre ID. Ausblenden nimmt einen Alarm für eine Stunde aus der Liste, hat also eine eigene Einstellung; es kann dieselbe Rolle sein oder eine engere.
6. Konfigurieren Sie es und starten Sie neu:

```
HOTLOOP_NOTIFY_ENABLED=true
HOTLOOP_NOTIFY_DISCORD_BOT_ENABLED=true
HOTLOOP_NOTIFY_DISCORD_BOT_TOKEN=MTIz...
HOTLOOP_NOTIFY_DISCORD_BOT_CHANNEL=223456789012345678
HOTLOOP_NOTIFY_DISCORD_BOT_ACK_ROLES=323456789012345678
HOTLOOP_NOTIFY_DISCORD_BOT_SHELVE_ROLES=423456789012345678
HOTLOOP_NOTIFY_DISCORD_BOT_CRITICAL_ROLE=323456789012345678
HOTLOOP_PUBLIC_URL=https://hotloop.plant.example
```

7. Das Log sagt `connected to the Discord Gateway; Discord buttons work`, und `GET /api/diagnostics` zeigt `"gateway": {"connected": true}` unter dem Kanal `discord`. `POST /api/notify/test` sendet eine Testnachricht (ohne Schaltflächen, es steht kein Alarm dahinter).

**Solange Sie die Rollen nicht setzen, kann niemand etwas drücken.** Sind `HOTLOOP_NOTIFY_DISCORD_BOT_ACK_ROLES` oder `_SHELVE_ROLES` leer, wird jeder Klick auf diese Schaltfläche abgelehnt, der Person, die klickt, wird gesagt, welche Einstellung leer ist, und HotLoop meldet es beim Start:

```
WARN NOBODY can acknowledge alarms from Discord, because HOTLOOP_NOTIFY_DISCORD_BOT_ACK_ROLES is empty...
```

Das ist Absicht. Eine Schaltfläche, die jeder auf dem Server drücken kann, ist keine Voreinstellung, die man ausliefert: Server sammeln Leute.

**Wer gedrückt hat.** Eine Quittierung aus Discord wird unter `discord:<username>#<user id>` erfasst (die ID, weil sich ein Discord-Benutzername ändern kann und die ID nicht), mit dem Vermerk "acknowledged from Discord by alice (1010...)". Um sie stattdessen unter dem HotLoop-Benutzer zu erfassen, ordnen Sie sie zu: `HOTLOOP_NOTIFY_DISCORD_BOT_USERS=101010101010101010=alice,202020202020202020=bob`. Die Zuordnung benennt nur den Akteur. Sie prüft nicht die Berechtigungen des HotLoop-Benutzers: Die Discord-Rolle entscheidet, wer drücken darf.

**Ausblenden** blendet für `HOTLOOP_NOTIFY_DISCORD_BOT_SHELVE` aus, standardmäßig eine Stunde, höchstens 24 Stunden wie jedes Ausblenden. Es ist eine feste Zeit, kein Menü: Um 03:00 ist eine Schaltfläche, die eine bekannte Sache tut, besser als eine Auswahlliste. Es lehnt einen Alarm ab, der wieder normal ist (ihn auszublenden würde verbergen, was ihn als Nächstes auslöst), und einen, der schon ausgeblendet ist.

Nach einem Klick nennt die Nachricht, wer was wann getan hat, und beide Schaltflächen werden grau, damit die nächste Person, die in den Kanal schaut, sieht, dass es erledigt ist. Ein abgelehnter Klick wird nur der Person beantwortet, die geklickt hat, mit dem Grund, und im Systemlog erfasst.

### Wie ein Klick autorisiert wird

Dieselbe Mechanik wie der Quittierlink von ntfy (siehe "Quittierlinks"), plus Discords eigene Aussage, wer geklickt hat:

- **Die Schaltfläche ist signiert.** Jede Schaltfläche trägt ein Token, signiert mit demselben Geheimnis wie die Quittierlinks, für diese Aktion (quittieren oder ausblenden, in die Signatur eingeschlossen, damit sich eine nicht als die andere wiederverwenden lässt), für diesen Alarm, gekommen zu diesem Zeitpunkt. Discord erlaubt einer Schaltfläche 100 Zeichen Daten, und eine Alarm-ID kann 64 haben, dies ist also eine kompakte Form derselben Aussage: 8 Byte Zeitpunkt des Kommens, 4 Byte Ablauf und ein 96-Bit-HMAC. Eines zu fälschen heißt 96 Bit zu raten, ein Discord-Klick pro Versuch, von innerhalb des Servers und mit der richtigen Rolle.
- **Die Person hat eine Rolle, die Sie benannt haben.** Discord teilt dem Bot die Rollen der klickenden Person mit dem Klick mit, über die eigene authentifizierte Verbindung des Bots. Wer auf Ihrem Server Rollen vergeben kann, kann diese vergeben, behandeln Sie diese Rollen also wie die Berechtigung, die sie sind.
- **Das Vorkommnis ist noch aktuell.** Die Engine prüft unter ihrer eigenen Sperre, dass das aktuelle Kommen des Alarms das auf der Schaltfläche ist. Die Nachricht von gestern kann den Auslöser von heute nicht quittieren.
- **Einmal.** Die erste Aktion auf ein Vorkommnis aus irgendeiner Benachrichtigung (ntfy oder Discord) wird erfasst, und jede spätere wird abgelehnt. Klicken zwei Personen gleichzeitig: Eine gewinnt, der anderen wird es gesagt.
- **Verfallend.** Nach `HOTLOOP_NOTIFY_ACK_TTL` (12 Stunden) funktionieren die Schaltflächen nicht mehr; handeln Sie dann in HotLoop.

Das Bot-Token ist ein Zugangsdatum für den ganzen Bot. Es wird nie geloggt, nie in einem Fehler, nie in einer API-Antwort ausgegeben; im Helm-Chart kommt es in ein Secret. Dasselbe gilt für das Interaktionstoken jedes Klicks, das Discord dem Bot für fünfzehn Minuten zum Antworten gibt. Wenn das Bot-Token durchsickert, setzen Sie es im Entwicklerportal zurück.

### Die Gateway-Verbindung

Klicks kommen über das Discord-Gateway an, einen WebSocket, den HotLoop zu Discord öffnet und offen hält. Der Client ist HotLoops eigener, auf [gorilla/websocket](https://github.com/gorilla/websocket) (v1.5.3, festgelegt; sie war schon im Abhängigkeitsgraphen dieses Moduls, ist klein und ist die meistgenutzte WebSocket-Bibliothek in Go). Eine Discord-Bibliothek wie discordgo haben wir nicht genommen: Sie ist ein vollständiges Discord-SDK (REST, Sprache, ein Statuscache) für das eine Ereignis, das wir brauchen, und dieses Projekt trägt keine Hersteller-SDKs. Der Client:

- identifiziert sich mit intents 0, Discord sendet ihm also nichts außer Klicks;
- sendet Heartbeats im von Discord vorgegebenen Intervall, antwortet sofort auf eine Heartbeat-Anforderung und behandelt einen unbestätigten Heartbeat als tote Verbindung;
- setzt die Sitzung nach einem Abbruch, einem Reconnect (op 7) oder einer fortsetzbaren Invalid Session (op 9) fort, damit ein Klick während des Wiederverbindens nachgespielt wird, nicht verloren geht; eine Sitzung, die sich nicht fortsetzen lässt, wartet eine bis fünf Sekunden und startet eine neue;
- identifiziert sich höchstens alle fünf Sekunden einmal und gar nicht, wenn Discord sagt, dass die Sitzungsstarts des Tages aufgebraucht sind, bis sie zurückgesetzt werden;
- verbindet sich mit einer Wartezeit neu, die sich von einer Sekunde bis zu einer Minute verdoppelt;
- hält bei einem abgelehnten Token oder abgelehnten Intents endgültig an, schaltet den Kanal ab und zeigt es in `/api/diagnostics`, statt endlos neu zu verbinden.

Discord gibt dem Bot drei Sekunden, um auf einen Klick zu antworten, also antwortet HotLoop zuerst "angekommen" (ein verzögertes Update) und erledigt dann die Arbeit. Diese Antwort verhindert auch, dass zwei HotLoop-Replikate auf einen Klick handeln: Beide empfangen ihn, Discord nimmt die erste Antwort und lehnt die zweite ab, und das abgelehnte Replikat hört auf. Als MCP-Helfer (`--mcp-stdio`) öffnet HotLoop gar keine Gateway-Verbindung; die echte bearbeitet die Klicks.

## Ratenbegrenzung und Zusammenfassungen

Ein Spannungseinbruch oder ein SPS-Neustart löst vierzig Alarme in einer Sekunde aus. Ein Senden pro Alarm bringt die IP eines Discord-Webhooks auf die Sperrliste, überschreitet das Limit pro IP von ntfy und begräbt auf dem Handy, das sie empfängt, den einen wichtigen Alarm unter neununddreißig unwichtigen. Deshalb hat jeder Kanal ein Budget, einen Token-Bucket: eine Salve, die auf einmal rausgehen darf, dann eines mehr bei jedem Auffüllen.

| Kanal | Standard-Salve | Danach eines alle |
|---|---|---|
| ntfy | 10 | 5 s (unter dem eigenen Limit von ntfy.sh von 60, dann eines alle 5 s, je IP) |
| Gotify | 10 | 5 s |
| Webhook | 10 | 5 s |
| SMTP | 5 | 12 s |
| Discord-Webhook | 5 | 2 s (Discord erlaubt einem Webhook etwa 5 Anfragen alle 2 s und einem Kanal 30 Nachrichten pro Minute) |
| Discord-Bot | 5 | 2 s |

Ändern Sie sie je Kanal mit `HOTLOOP_NOTIFY_<CHANNEL>_BURST` und `HOTLOOP_NOTIFY_<CHANNEL>_REFILL` (`WEBHOOK`, `SMTP`, `NTFY`, `GOTIFY`, `DISCORD_WEBHOOK`, `DISCORD_BOT`).

Was das Budget erlaubt, geht von selbst sofort raus. Was nicht, wird zurückgehalten, und wenn das nächste Senden fällig ist, geht alles Zurückgehaltene als **eine** Zusammenfassung raus:

```
7 more alarms raised in the last 12 s:
- [High] Line 3 Stopped
- [Critical] Boiler Trip
...
```

Kein Alarm geht verloren: Die Zusammenfassung nennt jeden, bis zu 25, und zählt den Rest ("...and 13 more"). Sie ist so schwer wie der schlimmste Alarm darin, und das Audit-Ereignis listet jede Alarm-ID auf, für die sie stand. Sie hat keine Schaltfläche Quittieren, weil es keinen einzelnen Alarm gibt, den sie quittieren könnte. Wurde nur ein Alarm zurückgehalten, geht er als er selbst raus, mit Schaltfläche und allem. Sobald Alarme zurückgehalten werden, schließen sich neue dem Stapel an, auch wenn das Budget wieder da ist, damit eine Zusammenfassung nie nach einem Alarm ankommt, der später kam als alles darin. Beim Herunterfahren geht alles noch Zurückgehaltene sofort raus, über Budget: Die Wahl besteht dann zwischen einem Senden zu viel und Alarmen, von denen nie jemand erfährt.

Das Budget gilt je Kanal, eine Flut, die das SMTP-Relay in die Warteschlange zwingt, hält also ntfy nicht auf, und die Grenze jedes Kanals gilt weiter: Ein Alarm mit Priorität Niedrig landet nie in der Zusammenfassung eines Kanals, der auf Hoch und höher steht.

## Wiederholungen

Ein Senden, das ein 429, ein 5xx oder gar keine Antwort bekommt (abgelehnt, zurückgesetzt, Zeitüberschreitung), wird wiederholt, insgesamt bis zu drei Versuche, alle innerhalb von 30 Sekunden nach dem ersten. Sagt der Empfänger, wie lange zu warten ist (`Retry-After`, in Sekunden oder als Datum), wird so lange gewartet; sonst eine Sekunde, dann zwei. Auf einen Empfänger, der mehr als die verbleibenden 30 Sekunden verlangt, wird nicht gewartet: Der Fehler wird sofort gemeldet, mit diesem Hinweis. Nach 30 Sekunden ist es besser, einen nicht rausgegangenen Ruf im Log und in der Audit-Spur als fehlgeschlagen zu melden, als ihn minutenlang still zu wiederholen, während der Alarm einfach da steht.

Jedes andere 4xx (ein falsches Token, ein Topic, auf das der Benutzer nicht schreiben darf, eine fehlerhafte Anfrage) wird nie wiederholt. Es bleibt jedes Mal dieselbe Antwort, bis jemand die Konfiguration korrigiert, und Discord sperrt eine IP, die weiter Anfragen sendet, die es schon abgelehnt hat.

`POST /api/notify/test` macht genau einen Versuch pro Kanal. Ein Test fragt, was der Kanal jetzt gerade tut, und eine Wiederholung würde einen unzuverlässigen Empfänger gesund aussehen lassen.

## Quittierlinks

Die Schaltfläche Quittieren auf einer ntfy-Benachrichtigung ist eine Anfrage an `POST /api/notify/ack/{token}` auf `HOTLOOP_PUBLIC_URL`. Die Person, die sie um 03:00 drückt, ist nirgends angemeldet, also **ist das Token die gesamte Autorisierung**. Das funktioniert nur, wenn das Token unfälschbar, eng gefasst, einmalig und kurzlebig ist, und jedes davon wird durchgesetzt:

- **Unfälschbar.** Das Token ist eine Aussage (welcher Alarm, wann er kam, welcher Kanal, wann der Link abläuft) plus ein HMAC-SHA256 davon mit einem Server-Geheimnis. Ändern Sie ein Byte oder signieren Sie mit einem anderen Schlüssel, und es wird abgelehnt. Das Geheimnis ist `HOTLOOP_NOTIFY_ACK_SECRET`, wenn Sie es setzen (mindestens 32 Zeichen; `openssl rand -hex 32`). Wenn nicht, erzeugt HotLoop beim ersten Bedarf 32 Zufallsbytes und hält sie in seiner Datenbank (Tabelle `settings`, Schlüssel `notify.ackSecret`), damit die Links nach einem Neustart weiter funktionieren und alle Replikate übereinstimmen. Es wird nie auf dem Einstellungsbildschirm oder in einer API-Antwort angezeigt. Es steckt in Datenbank-Backups wie alles andere in der Datenbank; wenn das für Sie ein Problem ist, setzen Sie die Variable aus einem Kubernetes-Secret (`notify.ackSecret.existingSecret` im Chart), und es berührt nie die Datenbank. Das Geheimnis zu ändern, macht jeden bereits gesendeten Link ungültig, und so widerrufen Sie auch alle auf einmal.
- **Eng gefasst.** Die Aussage nennt einen Alarm **und den Moment, in dem er kam**. Eine Schaltfläche vom gestrigen Auslösen desselben Alarms kann das heutige nicht quittieren, das noch niemand gesehen hat: Die Engine prüft unter derselben Sperre wie die Quittierung, dass das aktuelle Kommen des Alarms das in der Aussage ist (`alarm.Engine.AckOccurrence`). Der Link kann quittieren und sonst nichts. Er kann nicht ausblenden, nicht zurücksetzen, keinen Tag schreiben und nichts lesen, das Schlimmste, was ein durchgesickerter Link anrichten kann, ist also genau das, was der Klick auf die Schaltfläche getan hätte.
- **Einmalig.** Die erste Nutzung eines Links für ein Vorkommnis wird in der Datenbank erfasst (`notify_ack_links`), und jede spätere wird abgelehnt, auch wenn der Alarm erneut quittiert werden muss, ohne dass er neu kam (im Alarmzustand ausgeblendet und eingeblendet, kommt er unquittiert zurück). Der eigene Zustand des Alarms genügt dafür nicht; die Erfassung schon.
- **Kurzlebig.** Er läuft ab, standardmäßig 12 Stunden nach dem Senden (`HOTLOOP_NOTIFY_ACK_TTL`, höchstens 168 h). Lang genug für "ich schaue, wenn ich da bin", kurz genug, dass der Screenshot einer Benachrichtigung kein Dauerzugang ist.

Ein erfolgreicher Klick ist eine gewöhnliche ISA-18.2-Quittierung durch die Alarm-Engine, auditiert genau wie eine vom Alarmbildschirm: ein Alarmereignis und ein Systemlog-Eintrag mit dem Akteur `notify:ntfy` und dem Vermerk "acknowledged from the ntfy notification". Die HTTP-Aktionen von ntfy sagen nicht, welches Handy die Schaltfläche gedrückt hat, es gibt also keinen Personennamen hinzuzufügen. Wenn sich mehrere Personen ein Topic teilen, sagt die Audit-Spur, dass das Handy es war, nicht wer. Der Discord-Bot kennt den Benutzer und trägt ihn ein (siehe "Discord").

Jede Ablehnung wird mit dem Grund beantwortet und im Systemlog unter `notify:<channel>` erfasst (oder `notify:ack-link` bei einem Token, das zu kaputt ist, um zu sagen, welcher Kanal es gesendet hat), denn eine Schaltfläche, die still nichts tut, ist von einer, die niemand gedrückt hat, nicht zu unterscheiden:

| Antwort | Grund |
|---|---|
| 403 | Gefälscht, verändert oder mit einem anderen Geheimnis signiert |
| 410 | Echt, aber abgelaufen |
| 409 | Schon benutzt, oder der Alarm kam seitdem erneut, oder es gibt nichts mehr zu quittieren |
| 404 | Der Alarm existiert nicht mehr, oder Quittierlinks sind aus |

Das Token selbst wird nie geloggt, nie in ein Audit-Ereignis geschrieben und von keiner API zurückgegeben: Solange es gültig ist, ist es ein Zugangsdatum. Es steht notwendigerweise in der ntfy-Nachricht, wer also Ihr ntfy-Topic lesen kann, kann die Schaltfläche drücken. Sichern Sie das Topic ab.

Der Endpunkt antwortet mit `Access-Control-Allow-Origin: *`, damit die Schaltfläche auch aus der ntfy-Web-App funktioniert, die sie von ihrem eigenen Ursprung aus drückt. Das verschenkt nichts: Nichts auf dieser Route liest ein Cookie oder eine Sitzung.

## Eskalation

Niemand hat den Alarm in N Minuten quittiert, also bekommt ihn die nächste Person. Der erste Ruf geht genau so raus wie immer, an jeden Kanal, dessen Grenze der Alarm erreicht. Die Eskalation ist das, was danach geschieht, wenn der Alarm noch unquittiert da steht. Ein Ruf, der auf einem Handy landete, das niemand in der Hand hatte, ist der Fehler, für den es das gibt: Um 03:00 schläft die Person in Bereitschaft, und der Alarm darf nicht auf sie warten.

Sie richten sie unter **Einstellungen, Alarmeskalation** ein oder über die API (`GET` und `PUT /api/notify/escalation`). Sie ist nur für Administratoren, weil sie die ntfy-Topics der Personen enthält und entscheidet, wer geweckt wird. Anders als die Kanäle, die beim Start von HotLoop aus der Umgebung gelesen werden, ist die Richtlinie ein Datensatz, den Sie bearbeiten, und sie gilt, sobald Sie speichern. Die Kanäle, die sie nutzen kann, sind die, die die Installation schon konfiguriert hat. Zur Liste der vier kommt nichts Neues hinzu, außer dem Webhook und der E-Mail.

### Die Richtlinie

| Feld | <span class="sr-only">Details</span> |
|---|---|
| `enabled` | Aus, bis Sie sie einschalten. Eine ausgeschaltete Richtlinie eskaliert nichts |
| `minPriority` | Der am wenigsten schwere Alarm, der eskaliert: `critical`, `high`, `medium` oder `low`. Standard `high`. Ein Alarm mit Priorität Mittel, der eine Stunde steht, ist ein Arbeitsauftrag, kein Anruf um 03:00 |
| `contacts` | Die Personen. Jede hat einen `name` und einen `ntfyTopic`, `emails` oder beides. Bis zu 50 |
| `steps` | Bis zu 10. Jeder hat `afterMinutes` (1 bis 1440) und wen er informiert: `contacts` nach Name, `channels` nach Name oder beides |
| `repeatEveryMinutes`, `repeatTimes` | Nach dem letzten Schritt in diesem Abstand noch einmal senden, so oft zusätzlich (höchstens 20). Beide null für keine Wiederholung |

Eine **Person** bekommt eine eigene Benachrichtigung. Ihr `ntfyTopic` ist ein Topic auf dem ntfy-Server, auf dem dieses HotLoop schon veröffentlicht, mit demselben Login, ihr Handy abonniert also ein Topic, das nur ihr gehört. Ihre `emails` laufen über das SMTP-Relay, das HotLoop schon hat. Eine Person mit Topic braucht konfiguriertes ntfy, eine mit Adresse konfigurierte E-Mail, und die Richtlinie wird mit dieser Aussage abgelehnt, wenn sie es nicht sind. Auf einem Server, den jeder erreichen kann, ist ein Topic ein Passwort: Wählen Sie es lang und zufällig. Die API zeigt Topics Administratoren und sonst niemandem, und sie stehen nie im Logbuch, im Systemlog oder in einem Fehler.

Ein **Kanal** in einem Schritt ist einer der Installation selbst (`ntfy`, `gotify`, `smtp`, `webhook`, `discord-webhook`, `discord`) und erreicht, wer darauf ist: den gemeinsamen Discord-Kanal, eine Gotify-App, die sich eine Crew teilt, einen Webhook in etwas, das ruft. Die Richtlinie wird abgelehnt, wenn ein Schritt einen nennt, den dieses HotLoop nicht konfiguriert hat, und die Antwort listet die, die es hat.

### Wann was rausgeht

Ein Schritt ist `afterMinutes` nach dem vorherigen fällig, der erste Schritt `afterMinutes` nach dem Kommen des Alarms. Es ist eine Summe ab dem Kommen, nicht ab dem Ende des letzten Sendens, ein langsames Relay oder ein Neustart dehnt den von Ihnen geschriebenen Zeitplan also nicht. Mit Schritten von 5 und 10 und einer Wiederholung alle 15 Minuten, zweimal:

```
 0 min  alarm raised: the first page, as always
 5 min  step 1
15 min  step 2
30 min  step 2 again (repeat 1)
45 min  step 2 again (repeat 2), and that is the last
```

### Was sie stoppt

Die Kette gilt für ein Vorkommnis eines Alarms und stoppt, mit einer Zeile, die den Grund nennt, wenn eines davon eintritt:

- **Jemand quittiert ihn.** Von überall: Alarmbildschirm, die Schaltfläche Quittieren in ntfy oder Discord, die API, eine Automatisierung. Alle enden in der Alarm-Engine, und vor jedem Schritt fragt der Eskalator die Engine, ob dieses Vorkommnis noch unquittiert ist. Ein verspäteter Hook kann ihn nicht dazu bringen, einen Alarm zu melden, den schon jemand bearbeitet hat.
- **Er wird wieder normal.** Der Alarm steht weiter auf der Alarmliste und braucht jemanden zum Quittieren, aber niemand wird für etwas geweckt, das sich von selbst erledigt hat. Das ist eine Entscheidung, die wir mit Absicht getroffen haben; ändern Sie Grenze oder Schritte, wenn Sie eine andere wollen.
- **Er wird ausgeblendet.**
- **Er löst erneut aus.** Das ist ein neues Vorkommnis mit eigener Kette, gezählt ab seinem eigenen Kommen. Die Kette von gestern ruft nie für den Alarm von heute.

Ein Alarm, den jemand beantwortet, bevor Schritt 1 fällig ist, hinterlässt gar keine Spur in der Eskalationsspur, und das ist das System bei der Arbeit.

### Was ankommt

Eine Eskalation ist die eigene Benachrichtigung des Alarms mit geändertem Titel und einer zusätzlichen Zeile:

```
NOT ACKNOWLEDGED 15 min: Boiler Trip
Nobody has acknowledged this alarm in 15 minutes (step 2 of 4). boiler/Pressure hi 90 (now 95)
```

Sie behält die Priorität des Alarms, ein kritischer ist auf Android also weiter höchste Priorität. Sie trägt dieselbe signierte Schaltfläche Quittieren wie der erste Ruf in ntfy und Discord (siehe "Quittierlinks"), die geweckte Person kann also dort quittieren, wo sie gerufen wurde. Gotify und E-Mail haben keine Schaltfläche. Ein Webhook bekommt HotLoops übliches JSON mit `event` auf `escalated`.

Ein gemeinsamer Kanal wird wie jeder andere getaktet (siehe "Ratenbegrenzung und Zusammenfassungen"), ein Spannungseinbruch, der vierzig Alarme unquittiert lässt, eskaliert also als eine Zusammenfassung, "40 alarms nobody has acknowledged", nicht als vierzig Rufe und eine Sperre. Die eigene Benachrichtigung einer Person ist ein eigenes Senden.

### Die Audit-Spur

Jede Eskalation ist eine Zeile in der eigenen Spur des Alarms, die das [Logbuch](/de/iot/logbook/) liest, sie erscheint dort also ohne zusätzliche Einrichtung, unter dem Alarm abgelegt mit dem Akteur `escalation`:

```
alarm Boiler Trip escalated: boiler/Pressure hi 90 (now 95) (note: step 1 of 2: nobody acknowledged it in 5 min; notified Ana (email), Ana (ntfy))
alarm Boiler Trip escalation-ended: boiler/Pressure hi 90 (now 95) (note: escalation stopped after 1 sent: acknowledged by notify:ntfy)
```

`GET /api/alarms/events` und die Art `alarm` des Logbuchs führen dieselben Zeilen als Typen `escalated` und `escalation-ended`. Ein Schritt, der niemanden erreicht hat, sagt das in Großbuchstaben (`NOBODY WAS REACHED`), mit jedem Fehler danach, und die Kette läuft trotzdem zum nächsten Schritt weiter: Ein toter Relay darf den Ruf, der auf anderem Weg rausgeht, nicht aufhalten. Das Speichern der Richtlinie steht im Systemlog ohne die Topics.

### Neustarts, und wo es läuft

Die Ketten liegen im Speicher, ein Neustart um 03:00 mitten in einer darf sie also nicht verlieren. Beim Start schaut HotLoop auf jeden noch unquittierten Alarm, liest, wie viele Schritte laut Audit-Zeilen für dieses Vorkommnis rausgegangen sind, und macht dort weiter: Es sendet Schritt 1 nicht noch einmal und überspringt Schritt 2 nicht. Ein Schritt, der fällig wurde, während HotLoop aus war, geht in den ersten Sekunden nach der Rückkehr raus. Ein Schritt, der beim Beenden des Prozesses gerade lief, kann doppelt rausgehen, und das ist bei einem Alarm die richtige Seite, auf der man sich irrt.

Eine gespeicherte Richtlinie gilt für Alarme, die nach dem Speichern kamen. Ein Neustart nimmt jeden noch unquittierten Alarm auf, wann auch immer er kam.

Das Gateway führt sie aus. Ein `--mcp-stdio`-Helfer nicht, damit ein Alarm nie von zwei Prozessen eskaliert wird.

## TLS auf dem SMTP-Kanal

Der Kanal wechselt per STARTTLS automatisch zu TLS, sobald das Relay die Erweiterung anbietet, unabhängig von jeder Einstellung unten. Das ist kein optionales Verhalten zum Einschalten: `net/smtp.PlainAuth` von Go weigert sich, Benutzername und Passwort über eine Verbindung zu senden, die nicht schon TLS ist (oder zu einem Server, der buchstäblich `localhost` heißt), und praktisch jeder echte Anbieter, der Authentifizierung verlangt, Gmail, SendGrid, Mailgun, das Relay eines Providers, verlangt dafür STARTTLS auf Port 587 oder implizites TLS auf 465 (siehe unten). Ein Relay ohne konfigurierte Authentifizierung, in einem isolierten Netz erreichbar, bietet STARTTLS womöglich gar nicht an, und dieser Kanal verlangt es in dem Fall nicht.

`HOTLOOP_NOTIFY_SMTP_TLS` schaltet den Wechsel nicht ein, es macht sein *Fehlen* zu einem harten Fehler: Ist es gesetzt und das Relay bietet STARTTLS nicht an, verweigert `Send` schon vor dem Versuch von `AUTH`, statt sich im Klartext bei einem Relay anzumelden, das nur zufällig als `localhost` erreichbar ist. `HOTLOOP_NOTIFY_SMTP_TLS_SKIP_VERIFY` überspringt die Zertifikatsprüfung beim Wechsel, derselbe Notausgang, den `HOTLOOP_EDGE_PUBLISH_TLS_SKIP_VERIFY` und `HOTLOOP_FLEET_TLS_SKIP_VERIFY` für ihre eigenen MQTT-Verbindungen schon bieten, für ein Relay mit selbst signiertem Zertifikat.

### Implizites TLS, Port 465

Ein Relay auf Port 465 erwartet, dass die ganze Verbindung ab dem ersten Byte TLS ist (RFC 8314), keinen Klartext-Gruß mit anschließendem Wechsel. HotLoop machte früher nur den Wechsel, also sagte es auf 465 als Erstes Klartext zu einem Relay, das auf einen TLS-Handshake wartete, und das Senden starb. Jetzt ist **Port 465 implizites TLS** und jeder andere Port STARTTLS wie zuvor, ohne Einstellung, die Sie anfassen müssten:

```
HOTLOOP_NOTIFY_SMTP_PORT=465
```

Wenn ein Relay implizites TLS auf einem eigenen Port macht oder STARTTLS auf 465 spricht, sagt `HOTLOOP_NOTIFY_SMTP_IMPLICIT_TLS`, welches, `true` oder `false`, und hat Vorrang vor dem Port. Im Helm-Chart setzen Sie es unter `extraEnv`. Alles andere ist bei beiden gleich: Benutzername und Passwort gehen über die verschlüsselte Verbindung, `HOTLOOP_NOTIFY_SMTP_TLS` ist dadurch erfüllt (es gibt nichts zu verlangen), und `HOTLOOP_NOTIFY_SMTP_TLS_SKIP_VERIFY` überspringt die Zertifikatsprüfung bei deren Handshake. Das Zertifikat des Relays wird geprüft, es sei denn, Sie schalten das aus. Geplante Berichte nutzen dieselben Relay-Einstellungen und damit dieselbe Regel.

Schlägt der Handshake fehl, sagt der Fehler das und nennt `HOTLOOP_NOTIFY_SMTP_IMPLICIT_TLS=false`, was ein Relay braucht, das im Klartext beginnt.

Geprüft gegen eine echte SMTP-Server-Bibliothek mit einem reinen TLS-Listener und gegen Mailpit, gestartet mit `--smtp-require-tls`, die festgelegte Laborversion v1.31.2. Nicht geprüft gegen den 465-Endpunkt eines kommerziellen Anbieters.

## Ein SMTP-Pfad, geteilt mit geplanten Berichten

Seit 4.14.0 sendet der Alarmkanal über `notify.SendMessage`, eine allgemeine Funktion, die eine Nachricht, mit optionalen Anhängen, an eine Liste von Empfängern sendet. Geplante Berichte (siehe [Geplante Berichte](/de/gateway/reports/)) senden ihre CSV- und HTML-Dateien über dieselbe Funktion und dieselben Relay-Einstellungen (`HOTLOOP_NOTIFY_SMTP_HOST`, `_PORT`, `_USERNAME`, `_PASSWORD`, `_FROM`, `_TLS`, `_TLS_SKIP_VERIFY`), es gibt also eine Stelle, die wählt, per STARTTLS wechselt, sich anmeldet und entscheidet, was ein Header enthalten darf. Geteilt wird nur das Relay: `HOTLOOP_NOTIFY_ENABLED`, `HOTLOOP_NOTIFY_SMTP_ENABLED` und `HOTLOOP_NOTIFY_SMTP_TO` betreffen Alarme, und ein für Berichte konfiguriertes Relay schaltet den Alarmkanal nicht ein.

Zwei Verhaltensweisen der Alarm-E-Mail haben sich geändert, beide in Richtung Sicherheit. Absender und jeder Empfänger werden jetzt als einfache Adressen geprüft, bevor etwas gewählt wird, während früher eine fehlerhafte erst am Relay scheiterte. Und ein Betreff mit Nicht-ASCII-Zeichen wird als RFC-2047-codiertes Wort gesendet statt als rohes UTF-8. Ein Alarmname mit einem Steuerzeichen wird zu Leerzeichen eingeebnet statt abgelehnt, weil ein Ruf rausgehen muss, wie auch immer ein Alarm heißt.

## Prioritätsgrenzen

Jeder Kanal hat sein eigenes `MinPriority`, die am wenigsten schwere Alarmpriorität, bei der er noch auslöst. `model.AlarmPriority` läuft von 1 (Kritisch, am schwersten) bis 4 (Niedrig), "Hoch und höher" ist also `MinPriority = 2`: Ein Alarm erreicht die Grenze eines Kanals, wenn seine eigene Prioritätszahl kleiner oder gleich der Grenze ist. Ein Webhook, der nur auf Kritisch konfiguriert ist, und ein SMTP-Relay, das auf Mittel und höher konfiguriert ist, können dieselbe Alarm-Engine beobachten und bei ganz verschiedenen Alarmmengen auslösen, nichts verlangt, dass sie übereinstimmen.

## Was es nicht ist

**Kein Live-Neuladen der Kanäle.** Kanäle werden einmal aus der Konfiguration gelesen, beim Prozessstart, wie `EdgePublishConfig` und `FleetConfig`. Änderungen an `HOTLOOP_NOTIFY_*` brauchen einen Neustart, und es gibt in diesem MVP keine API, um zur Laufzeit einen Kanal hinzuzufügen oder zu entfernen. Die Eskalationsrichtlinie ist die Ausnahme: Wer als Nächstes informiert wird und wann, ist ein Datensatz, den Sie bearbeiten, und er gilt, sobald Sie speichern (siehe "Eskalation").

**Keine eigene Tabelle.** Jeder Benachrichtigungsversuch, ob erfolgreich oder nicht, wird über `runtime.Manager.Event` geschrieben, denselben generischen Audit-Ereignismechanismus, über den schon jede Alarm- und Flottenaktion läuft. Für eine Funktion dieser Größe musste keine eigene Tabelle `notifications` erfunden werden; das Systemlog beantwortet schon "wurde eine Benachrichtigung gesendet, und hat es funktioniert".

**Keine dauerhafte Warteschlange.** Wiederholungen sind begrenzt (drei Versuche, 30 Sekunden, siehe "Wiederholungen"), und zurückgehaltene Alarme leben im Speicher, bis ihre Zusammenfassung rausgeht. Ein Ruf, der weiter scheitert, wird geloggt und auditiert, und der Dispatcher macht weiter. Ein Alarm, der aktiv bleibt, weil ihn niemand quittiert hat, bleibt auf dem Alarmbildschirm und in `alarm_events` sichtbar, egal ob je ein Ruf ankam: Die Benachrichtigung ist eine Annehmlichkeit auf dem Alarmsystem, kein Ersatz dafür.

## Konfiguration

| Variable | Standard | <span class="sr-only">Details</span> |
|---|---|---|
| `HOTLOOP_NOTIFY_ENABLED` | `false` | Die Funktion ist aus, bis dies gesetzt ist |
| `HOTLOOP_NOTIFY_WEBHOOK_ENABLED` | `false` | |
| `HOTLOOP_NOTIFY_WEBHOOK_URL` | n/a | Erforderlich, wenn der Webhook-Kanal aktiviert ist. Muss `http://` oder `https://` sein |
| `HOTLOOP_NOTIFY_WEBHOOK_MIN_PRIORITY` | `high` | `critical`, `high`, `medium`, `low` oder `1`-`4` |
| `HOTLOOP_NOTIFY_SMTP_ENABLED` | `false` | |
| `HOTLOOP_NOTIFY_SMTP_HOST` | n/a | Erforderlich, wenn der SMTP-Kanal aktiviert ist |
| `HOTLOOP_NOTIFY_SMTP_PORT` | `25` | |
| `HOTLOOP_NOTIFY_SMTP_USERNAME` / `_PASSWORD` | n/a | Optional. Beide weglassen für ein anonymes Relay |
| `HOTLOOP_NOTIFY_SMTP_FROM` | n/a | Erforderlich, wenn der SMTP-Kanal aktiviert ist |
| `HOTLOOP_NOTIFY_SMTP_TO` | n/a | Erforderlich, wenn der SMTP-Kanal aktiviert ist. Durch Komma getrennte Adressen |
| `HOTLOOP_NOTIFY_SMTP_TLS` | `false` | Verlangt, dass das Relay STARTTLS anbietet; siehe "TLS auf dem SMTP-Kanal" oben, STARTTLS wird automatisch genutzt, sobald es angeboten wird, unabhängig von dieser Einstellung |
| `HOTLOOP_NOTIFY_SMTP_TLS_SKIP_VERIFY` | `false` | Überspringt die Zertifikatsprüfung beim STARTTLS-Wechsel oder beim Handshake des impliziten TLS. Entscheidung je Installation; nie als Standard setzen |
| `HOTLOOP_NOTIFY_SMTP_IMPLICIT_TLS` | `true` auf Port 465, sonst `false` | TLS ab dem ersten Byte statt STARTTLS; siehe "Implizites TLS, Port 465". Setzen Sie es, um den Port zu übersteuern |
| `HOTLOOP_NOTIFY_SMTP_MIN_PRIORITY` | `high` | Dieselben Werte wie beim Webhook |
| `HOTLOOP_NOTIFY_NTFY_ENABLED` | `false` | |
| `HOTLOOP_NOTIFY_NTFY_URL` | none | Erforderlich. Nur der Server, `https://ntfy.example.com`, ohne Pfad |
| `HOTLOOP_NOTIFY_NTFY_TOPIC` | none | Erforderlich. 1 bis 64 Buchstaben, Ziffern, `-` und `_`. Auf einem öffentlichen Server ist es das Passwort |
| `HOTLOOP_NOTIFY_NTFY_TOKEN` | none | Ein ntfy-Zugriffstoken (`tk_...`), als Bearer-Token gesendet |
| `HOTLOOP_NOTIFY_NTFY_USERNAME` / `_PASSWORD` | none | Basic-Auth statt eines Tokens. Nicht beides |
| `HOTLOOP_NOTIFY_NTFY_ACK` | `true` | Setzt auf jeden Alarm eine Schaltfläche Quittieren (braucht `HOTLOOP_PUBLIC_URL`) |
| `HOTLOOP_NOTIFY_NTFY_MIN_PRIORITY` | `high` | Dieselben Werte wie beim Webhook |
| `HOTLOOP_NOTIFY_GOTIFY_ENABLED` | `false` | |
| `HOTLOOP_NOTIFY_GOTIFY_URL` | none | Erforderlich. `https://gotify.example.com` |
| `HOTLOOP_NOTIFY_GOTIFY_TOKEN` | none | Erforderlich. Das Anwendungstoken, das Gotify Ihnen für HotLoop gegeben hat |
| `HOTLOOP_NOTIFY_GOTIFY_MIN_PRIORITY` | `high` | Dieselben Werte wie beim Webhook |
| `HOTLOOP_NOTIFY_DISCORD_WEBHOOK_ENABLED` | `false` | |
| `HOTLOOP_NOTIFY_DISCORD_WEBHOOK_URL` | none | Erforderlich. Die URL, die Webhook-URL kopieren in Discord liefert. Sie ist als Ganzes das Passwort |
| `HOTLOOP_NOTIFY_DISCORD_WEBHOOK_CRITICAL_ROLE` | none | Eine Rollen-ID, die bei kritischen Alarmen erwähnt wird |
| `HOTLOOP_NOTIFY_DISCORD_WEBHOOK_MIN_PRIORITY` | `high` | Dieselben Werte wie beim Webhook |
| `HOTLOOP_NOTIFY_DISCORD_BOT_ENABLED` | `false` | |
| `HOTLOOP_NOTIFY_DISCORD_BOT_TOKEN` | none | Erforderlich. Das Token des Bots, allein, ohne `Bot ` davor |
| `HOTLOOP_NOTIFY_DISCORD_BOT_CHANNEL` | none | Erforderlich. Die Kanal-ID, in die gepostet wird |
| `HOTLOOP_NOTIFY_DISCORD_BOT_ACK_ROLES` | none | Durch Komma getrennte Rollen-IDs, deren Mitglieder Quittieren drücken dürfen. **Leer heißt niemand** |
| `HOTLOOP_NOTIFY_DISCORD_BOT_SHELVE_ROLES` | none | Dasselbe für Ausblenden. **Leer heißt niemand** |
| `HOTLOOP_NOTIFY_DISCORD_BOT_USERS` | none | `discordUserId=hotloopUser`, durch Komma getrennt: wessen Aktionen unter ihrem HotLoop-Namen erfasst werden |
| `HOTLOOP_NOTIFY_DISCORD_BOT_SHELVE` | `1h` | Wie lange Ausblenden ausblendet. Höchstens `24h` |
| `HOTLOOP_NOTIFY_DISCORD_BOT_CRITICAL_ROLE` | none | Eine Rollen-ID, die bei kritischen Alarmen erwähnt wird |
| `HOTLOOP_NOTIFY_DISCORD_BOT_MIN_PRIORITY` | `high` | Dieselben Werte wie beim Webhook |
| `HOTLOOP_NOTIFY_DISCORD_API_URL` | `https://discord.com/api/v10` | Nur, um die Anfragen des Bots über einen Proxy zu schicken |
| `HOTLOOP_NOTIFY_<CHANNEL>_BURST` / `_REFILL` | je Kanal | Die Ratenbegrenzung; siehe "Ratenbegrenzung und Zusammenfassungen". `<CHANNEL>` ist `WEBHOOK`, `SMTP`, `NTFY`, `GOTIFY`, `DISCORD_WEBHOOK` oder `DISCORD_BOT` |
| `HOTLOOP_PUBLIC_URL` | none | Die Adresse, unter der ein Handy HotLoop erreicht, einschließlich Basispfad. Nötig für Tippen zum Öffnen und die Schaltfläche Quittieren |
| `HOTLOOP_NOTIFY_ACK_SECRET` | erzeugt | Signiert Quittierlinks. Mindestens 32 Zeichen. Nicht gesetzt: einmal erzeugt und in der Datenbank gehalten |
| `HOTLOOP_NOTIFY_ACK_TTL` | `12h` | Wie lange ein Quittierlink funktioniert. Höchstens `168h` |

Im Helm-Chart stehen sie unter `notify.ntfy`, `notify.gotify`, `notify.discordWebhook`, `notify.discordBot`, `notify.ackSecret`, `notify.ackTtl` und dem `publicUrl` auf oberster Ebene. Tokens, Passwörter und die Discord-Webhook-URL kommen in ein Secret, das das Chart verwaltet, oder nennen Sie Ihr eigenes mit `existingSecret`.

## API

| Route | Berechtigung | <span class="sr-only">Details</span> |
|---|---|---|
| `POST /api/notify/test` | `notify.test` | Sendet sofort eine synthetische Testbenachrichtigung über jeden konfigurierten Kanal |
| `POST /api/notify/ack/{token}` | keine; das Token ist die Autorisierung | Quittiert das Alarmvorkommnis, für das das Token ausgestellt wurde. Siehe "Quittierlinks" |
| `GET /api/notify/escalation` | `notify.escalation` | Die Eskalationsrichtlinie, die Kanäle, die ein Schritt nennen darf, und die gerade offenen Ketten. Siehe "Eskalation" |
| `PUT /api/notify/escalation` | `notify.escalation` | Ersetzt die ganze Richtlinie. Wird mit Begründung abgelehnt, wenn ein Schritt niemanden nennt oder einen nicht konfigurierten Kanal |
| `GET /api/diagnostics` | `status.read` | Unter `notify.channels` der Stand jedes Kanals: ob Discord ihn abgelehnt hat (und warum und seit wann) und die Gateway-Verbindung des Discord-Bots |

`notify.escalation` ist genauso nur für Administratoren. Auch das Lesen der Richtlinie braucht sie, weil sie die ntfy-Topics der Personen enthält.

`notify.test` ist nur für Administratoren, gewährt durch den Platzhalter, den die Administratorrolle schon trägt, und bewusst nicht in die Berechtigungsliste der Bedienerrolle aufgenommen: Eine echte externe Nachricht zu senden und das Kontingent eines Alarmierungsanbieters oder SMTP-Relays zu verbrauchen, ähnelt eher `fleet.restart` und `fleet.config` (ebenfalls nur für Administratoren, ebenfalls "jetzt etwas mit der Außenwelt tun") als einem Lesezugriff, dieselbe Einschränkung, die diese Anwendung auf diese beiden schon anwendet.

Die Antwort meldet das Ergebnis jedes Kanals für sich statt eines einzigen Erfolgs oder Fehlers der Anfrage:

```json
{
  "results": [
    {"channel": "webhook", "success": true},
    {"channel": "smtp", "success": false, "error": "dial smtp server mail.example.com:587: i/o timeout"}
  ]
}
```

## Was geprüft wurde und was nicht

HotLoop wurde gegen echte Anlagen und echte Server betrieben, und auf Bare Metal am 2026-11-17.
