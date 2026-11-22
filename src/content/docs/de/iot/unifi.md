---
title: "UniFi-Netzwerk"
description: "Switches, Ports, PoE, WAN-Failover und Clients einer UniFi-Konsole als Tags, mit Bildschirmen, Ereignissen und Befehlen, die erst scharfgeschaltet wirken."
---

Das Netzwerk eines Werks ist Anlagentechnik. Wenn eine SPS verstummt, lautet die erste Frage: »Liegt es an der SPS oder an dem Switch-Port, an dem sie hängt?«, und bisher steckte die Antwort in der UniFi-App auf dem Handy von irgendwem. Deshalb liest HotLoop die UniFi-Konsole selbst: jeden Switch, jeden Port, die PoE-Leistung, die WAN-Verbindungen und den Zustand des Standorts, als ganz normale Tags. Alarme, Trends, Entitäten, Automatisierungen, OPC UA und MCP funktionieren damit, ohne zu wissen, dass es UniFi gibt.

Das hier sind der Treiber, die OT-Überwachung darauf, die Bildschirme, der Ereignisstrom und die ersten Befehle (U1 bis U5 in der [Roadmap](/de/roadmap/)). **Er liest das Netzwerk und ändert es nur, wenn ein Mensch dafür einen Tag scharfgeschaltet hat.** Jeder Tag wird schreibgeschützt angelegt. Die wenigen Punkte, die Befehle sind (unten, »Befehle«), laufen wie jeder Tag über das Schreib-Gate: Nichts sendet einen, bis jemand diesen Tag als beschreibbar markiert, und ein Konsolenkonto mit View Only wird von der Konsole selbst abgewiesen. Für alles außer den Befehlen kann das verwendete Konto View Only sein.

## Eine Konsole hinzufügen

Ein HotLoop-Gerät ist **ein Standort auf einer Konsole**. Das Cloud Gateway und der Express dahinter sind zwei Konsolen, also zwei Geräte mit zwei Anmeldungen, weil jede Konsole ihre eigenen lokalen Konten hat.

1. **Legen Sie ein lokales Konto auf der Konsole an.** Settings, Admins & Users, Add Admin, **Restrict to Local Access Only** anhaken, Rolle **View Only**. Ein Ubiquiti-Cloud-Konto kann sich nur über die App anmelden: Es verlangt MFA, und die Konsole antwortet einem Skript mit 403. Unseres heißt `hotloop-ro`.
2. **Fügen Sie das Gerät hinzu.** Protokoll `unifi`, als Adresse die URL der Konsole: `https://host` für eine Konsole mit UniFi OS (Cloud Gateway, Dream Machine, UniFi OS Server), `https://host:8443` für die selbst gehostete Network Application. Ein Abfrageintervall von 15 s passt ungefähr; der Treiber liest eine Konsole nie öfter als alle 10 s, egal was eingestellt ist.
3. **Ohne Fingerabdruck speichern.** Die erste Verbindung schlägt absichtlich fehl, mit dem Fingerabdruck des Zertifikats, das die Konsole vorgelegt hat. Prüfen Sie, dass es Ihre Konsole ist (die Konsole zeigt ihr Zertifikat, oder `openssl s_client -connect host:443` durch `openssl x509 -pubkey -noout | openssl pkey -pubin -outform der
   | sha256sum` geleitet liefert dasselbe), tragen Sie ihn in `certFingerprint` ein und speichern Sie.
4. Die Tags legen sich bei der nächsten Abfrage von selbst an. Siehe unten.

Ein UniFi-Gerät lässt sich nur speichern, wenn HotLoop einen Schlüssel hat, um das Passwort zu verschlüsseln (`HOTLOOP_SECRET_KEY_FILE`, den das Chart selbst einrichtet). Siehe [Backups und Wiederherstellung](/de/iot/backup/#device-credentials-and-the-secret-key).

| Option | Standard | Was sie bewirkt |
|---|---|---|
| `site` | `default` | Der Kurzname des Standorts, der in den URLs der Konsole steht. `default` ist der erste Standort jeder Konsole |
| `username`, `password` | erforderlich | Das lokale Konto. Das Passwort ist über die API nur schreibbar und in der Datenbank verschlüsselt |
| `certFingerprint` | keiner | Der SHA-256 des öffentlichen Schlüssels im Zertifikat der Konsole, als Hex. Doppelpunkte, Leerzeichen und Großbuchstaben sind in Ordnung |
| `caFile` | keine | Vertraut einer CA statt einem Pin, für Konsolen mit echten Zertifikaten |
| `insecureSkipVerify` | `false` | Vertraut jedem Zertifikat. Für einen Prüfstand, nie für ein Werk |
| `clientTimeoutSec` | `90` | Wie lange nach der letzten Sichtung durch die Konsole ein Client noch als im Netzwerk gilt. Untergrenze 30. Siehe [Clients](#clients-ot-netzwerke-und-wo-eine-sps-eingesteckt-ist) |

### Warum das Zertifikat angeheftet wird

Konsolen werden mit selbstsignierten Zertifikaten ausgeliefert, und die faule Antwort ist, die Prüfung zu überspringen. Für das Lesen eines Zählers ist das in Ordnung. Für eine Anmeldung, die das gesamte Werksnetz sehen und ab den Schreib-PRs dessen Ports zyklisch aus- und einschalten kann, ist es das nicht. Eine angeheftete Konsole, die ein anderes Zertifikat vorlegt, wird beim TLS-Handshake abgewiesen, **bevor Benutzername oder Passwort gesendet werden**, und der Fehler nennt beide Fingerabdrücke. Der Pin sitzt auf dem öffentlichen Schlüssel, daher funktioniert eine Konsole weiter, die ihr Zertifikat mit demselben Schlüssel neu ausstellt.

Es gibt kein stilles »Trust on first use«. Der einzige Moment, in dem das Vertrauen in ein Zertifikat etwas bedeutet, ist, wenn ein Mensch es ansieht, und genau dann geschieht es.

## Anmeldungen: einmal, und nicht wieder, außer es ist nötig

Bei jeder Prüfung neu anzumelden brachte unser eigenes Cloud Gateway dazu, mit 429 zu antworten und das Konto zu sperren. Zweimal. Deshalb:

- **Eine Sitzung pro Konsole und Prozess.** Jede Abfrage und jeder Standort der Konsole läuft über dieselbe Anmeldung. Zwei Geräte für zwei Standorte auf einer Konsole mit demselben Konto sind eine Sitzung.
- **Es meldet sich nur neu an, wenn die Konsole sagt, dass die Sitzung weg ist** (401), ein Aufrufer nach dem anderen, und **nie öfter als einmal pro Minute**, was auch passiert. Eine Sitzung, die innerhalb einer Minute zweimal stirbt, lässt das Gerät schlecht lesen, bis die Minute um ist, und das ist der Kompromiss, den wir wollen.
- **Eine abgelehnte Anmeldung wird nicht wiederholt.** Ein falsches Passwort, ein Cloud-Konto oder eine 429-Sperre wartet mindestens fünf Minuten, länger, wenn das `Retry-After` der Konsole es sagt, und der Fehler des Geräts nennt den Fall. Das Gerät aus- und wieder einzuschalten erkauft keinen neuen Versuch: Der Prozess merkt es sich.
- **Es meldet sich ab,** wenn das letzte Gerät, das eine Konsole nutzt, stoppt, damit Neustarts keine Sitzungen auf der Konsole anhäufen.
- **Ein `--mcp-stdio`-Helfer meldet sich nie an.** Er läuft neben dem Gateway, das die Sitzung schon hält, und eine zweite Anmeldung von derselben Maschine ist genau das, was die 429 einbringt. Seine UniFi-Geräte bleiben dort aus, während sie im Gateway laufen.

## Tags

Jeder Tag wird vom Treiber angelegt, ist schreibgeschützt, bis ein Mensch ihn scharfschaltet, und wird nach MAC-Adressen und Portnummern benannt, nie nach Anzeigenamen, sodass das Umbenennen eines Switches in der UniFi-App nichts kaputt macht. `<mac>` ist die MAC des Geräts in Kleinbuchstaben ohne Trennzeichen, `<nn>` die Portnummer zweistellig.

| Tag | Typ | Was es ist |
|---|---|---|
| `d.<mac>.state` | Text | `connected`, `disconnected`, `pending`, `upgrading`, `provisioning`, `heartbeat_missed`, `adopting`, ... |
| `d.<mac>.online` | bool, connectivity | Mit der Konsole verbunden |
| `d.<mac>.uptime_s` | int, s | Betriebszeit |
| `d.<mac>.cpu_pct`, `.mem_pct` | float, % | CPU und Speicher |
| `d.<mac>.temp_c` | float, °C | Temperatur, bei Geräten mit Sensor |
| `d.<mac>.clients` | int | Über das Gerät verbundene Clients |
| `d.<mac>.fw` | Text | Firmware-Version |
| `d.<mac>.wan<N>.up` | bool, connectivity | WAN N ist nach den eigenen Zustandsprüfungen des Gateways **am Leben** (`last_wan_interfaces`, dann `last_wan_status`). Nicht das `up` des WAN-Blocks, das »konfiguriert« bedeutet. Eine Konsole, die keines von beiden liefert, liest schlecht, nie up |
| `d.<mac>.wan<N>.latency_ms` | float, ms | Die Latenz, gut nur, solange das WAN am Leben ist |
| `d.<mac>.wan<N>.availability_pct` | float, % | Verfügbarkeit nach den eigenen Monitoren des Gateways über sein Fenster (einen Tag), wenn es eine meldet |
| `d.<mac>.wan.active` | Text | Welches WAN den Verkehr trägt: das WAN des Uplinks, wenn es lebt, sonst das erste lebende, `none`, wenn keines lebt |
| `d.<mac>.wan.failover` | bool, problem | Der Verkehr läuft über etwas anderes als das erste WAN: Das Werk hängt am Backup |
| `p.<mac>.<nn>.up` | bool, connectivity | Link des Ports |
| `p.<mac>.<nn>.speed_mbps` | int, Mbit/s | Link-Geschwindigkeit; 0, gut, bei einem Port ohne Link |
| `p.<mac>.<nn>.rx_bps`, `.tx_bps` | float, bit/s | Datenverkehr |
| `p.<mac>.<nn>.errors` | int | Empfangs- plus Sendefehler |
| `p.<mac>.<nn>.poe_w` | float, W, power | PoE-Leistung, bei Ports, die PoE liefern können |
| `p.<mac>.<nn>.poe_mode` | Text | `auto`, `off`, `pasv24`, `passthrough` |
| `site.<subsystem>.status` | Text | Der Zustand des Standorts: `wan`, `www`, `lan`, `wlan`, `vpn` |
| `site.www.latency_ms` | float, ms | Internet-Latenz, wenn gemeldet |
| `site.network_version` | Text | Die Network-Version, die die Konsole ausführt |
| `site.events_live` | bool, connectivity | Der Ereignis-Websocket der Konsole ist verbunden. 0 heißt, HotLoop fragt nur ab, was Geschwindigkeit kostet und sonst nichts |
| `site.last_event` | Text | Das neueste Ereignis, das die Konsole für den Standort gemeldet hat, in ihren eigenen Worten |
| `d.<mac>.last_event` | Text | Das neueste Ereignis zu diesem Gerät. Leer, bis es eines hatte |

Die Geräteklassen setzen sich in den Entitäten fort, sodass der Link eines Ports als binärer Konnektivitätssensor und seine PoE-Leistung als Leistungssensor erscheinen, ohne dass jemand etwas einstellt.

**Tags legen sich selbst an und verschwinden nie von allein.** Ein Switch, der nächste Woche adoptiert wird, erscheint bei der nächsten Abfrage als Tags, in derselben Sitzung, ohne dass etwas neu gestartet wird. Ein abgesteckter Switch liest `online` 0, und seine Ports gehen auf schlechte Qualität, sodass ein Alarm darauf es sagt, statt mit ihm zu verschwinden. Seine Tags zu löschen ist eine Entscheidung eines Menschen. Ein Tag, den jemand ausgeschaltet hat, bleibt aus: Der Treiber hat keine Stimme.

Nur adoptierte Geräte bekommen Tags. Ein Switch, den jemand eingesteckt und niemand adoptiert hat, gehört noch nicht zum Netzwerk des Werks. Ein Punkt, den die Konsole nicht meldet, liest schlecht, nie eine erfundene Null: Ein Switch, der keine PoE-Leistung meldet, hat schlecht lesende `poe_w`-Tags.

Auch das Edge Relay kann eine Konsole abfragen. Es liest die Tags, die seine Gerätedatei deklariert, und legt keine an, weil es keinen Ort hat, sie aufzubewahren.

## Befehle

Fünf Arten von Punkten sind Befehle. Jeder wird wie jeder andere Tag schreibgeschützt angelegt und tut nichts, bis jemand ihn als beschreibbar markiert. Das Konto, mit dem sich HotLoop anmeldet, muss dafür lokaler Administrator sein; mit View Only antwortet die Konsole mit HTTP 403, HotLoop sagt das, und nichts ändert sich.

| Tag | Schreiben | Was die Konsole tut |
|---|---|---|
| `d.<mac>.locate` | `true` oder `false` | Lässt die LED des Geräts blinken, bis sie ausgeschaltet wird. Liest zurück, was die Konsole sagt. |
| `d.<mac>.restart` | `true` | Startet das Gerät neu, wenn es sich das nächste Mal meldet. `false` tut nichts. Liest 0. |
| `p.<mac>.<nn>.power_cycle` | `true` | Schaltet das PoE des Ports aus und wieder ein. `false` tut nichts. Liest 0. |
| `w.<id>.enabled` | `true` oder `false` | Schaltet ein WLAN ein oder aus. Es wird nur dieses eine Feld gesendet, sodass die Passphrase und alle anderen Einstellungen bleiben. `<id>` ist die Kennung des Netzwerks auf der Konsole, die eine Umbenennung nicht ändert. |
| `c.<mac>.blocked` | `true` oder `false` | Sperrt einen beobachteten Client im Netzwerk oder lässt ihn wieder hinein. Der Punkt existiert für einen Client, den die Konsole gesehen hat. |

Ein Power-Cycle kann einem Werk schaden (eine Automatisierung, die alle zwei Minuten eine SPS neu startet, brät deren Netzteil), daher gelten zwei Regeln, wer auch fragt: Ein Port wird höchstens einmal in 15 Minuten zyklisch geschaltet (der Zeitpunkt des letzten Zyklus liegt in der Datenbank, ein Neustart vergisst ihn also nicht, und ein Zyklus, dessen Zeitpunkt sich nicht prüfen lässt, wird abgewiesen), und ein Port, der das Netzwerk trägt, wird nie zyklisch geschaltet. Das ist ein Uplink und jeder Port, an dem ein anderes Gerät hängt, laut der Topologie der Konsole selbst; der Port, der ein 5G-Backup speist, ist einer davon. Eine Ablehnung nennt die Regel. Ein Befehl, den die Konsole selbst ablehnt, verbraucht die Sperrzeit nicht.

## Clients, OT-Netzwerke und wo eine SPS eingesteckt ist

Zwei Aufgaben, beide schreibgeschützt.

**Wo ist sie eingesteckt.** Eine SPS verstummt, und die erste Frage ist, ob es die SPS oder der Switch-Port ist. Verknüpfen Sie das HotLoop-Gerät einmal mit seinem Client im Netzwerk, und seine Schublade sagt »an USW Lite 8 PoE Port 5, Link down«, bevor jemand die UniFi-App öffnet. Die Verknüpfung liefert auch Client-Tags auf dem Gerät der Konsole, sodass der Zustand des Ports neben den Modbus-Werten, die ausgeblieben sind, als Trend und Alarm erscheint.

**Was im SCADA-Netzwerk ist.** Markieren Sie ein Netzwerk als OT, akzeptieren Sie, was dazugehört, und alles andere, was darin auftaucht, löst einen Alarm aus, der es nennt. Jemand steckt um 2 Uhr nachts einen Laptop in den SCADA-Switch, Sie wissen es um 2 Uhr nachts.

### Nichts wird über die IP geführt

Die Client-Liste der Konsole hinkt. Deshalb:

- **Ein Client ist seine MAC.** Beim Verknüpfen wird ein Client per IP vorgeschlagen, weil Sie die von Ihrer SPS kennen, aber ein Mensch bestätigt ihn einmal, und von da an ist die MAC der Schlüssel. Der IP-Tag sagt, dass es die Meinung der Konsole ist.
- **Online heißt nicht »in der Liste«.** Ein Client ist online, wenn die Konsole ihn innerhalb von `clientTimeoutSec` (90 s) gesehen hat **und**, bei einem kabelgebundenen, der Port seines Switches einen Link hat. Der Port ist die schnelle Hälfte: Man zieht das Kabel, und der Port liest bei der nächsten Abfrage down, während die Liste noch nachzieht.

### Ein Gerät verknüpfen

Öffnen Sie die Schublade eines Geräts. Wenn eine von HotLoop gelesene UniFi-Konsole einen Client mit der IP des Geräts auflistet, schlägt der Abschnitt Network ihn vor; ein Administrator klickt auf **Link**. Keine IP als Ausgangspunkt (ein Gerät, das per Namen adressiert wird): verknüpfen Sie es per MAC. Oder über die API, `PUT /api/devices/{id}/network`, siehe [die HTTP-API](/de/iot/api/#put-apidevicesidnetwork).

Der Client eines verknüpften Geräts bekommt Tags und einen Alarm, **»PLC-07 off the network«**, Priorität 1, mit 120 s Einschaltverzögerung, damit eine SPS, die neu startet, niemanden anpiept.

### OT-Netzwerke und die Liste der Bekannten

Markieren Sie ein Netzwerk als OT (`PUT /api/unifi/{id}/networks/{network}` mit `{"ot": true}`), und akzeptieren Sie dann, was darin ist: alles, wie es jetzt ist, in einem Aufruf (`POST .../accept-all`), oder ein Gerät nach dem anderen. Das Markieren erzeugt den Alarm **»Unknown device on SCADA«**, Priorität 1, auf `n.<network>.unknown`. Der neueste Fremde steht in `n.<network>.unknown_last`, mit seiner MAC, wie er sich nennt, seiner IP und dem Switch-Port oder der SSID, über die er hereinkam.

Ein bekanntes Gerät kann **beobachtet** werden (`"watch": true`): Es bekommt dieselben Tags und denselben Alarm »vom Netz« wie ein verknüpftes. Eine SPS wird beobachtet. Ein Wartungslaptop, der erlaubt ist, aber kommt und geht, ist bekannt und nicht beobachtet, sonst piept er jedes Mal jemanden an, wenn er geht.

Die Alarme sind gewöhnliche Alarmdefinitionen. Stellen Sie sie zurück, quittieren Sie sie, senden Sie sie an Discord, ändern Sie ihre Verzögerung. Nehmen Sie die Beobachtung, die Verknüpfung oder die OT-Markierung weg, und HotLoop nimmt den dafür erzeugten Alarm weg, sodass ein Tag, den niemand mehr liest, keinen Alarm offen hält. Ein von einem Administrator von Hand geschriebener wird nie angetastet.

Der Datensatz gehört HotLoop, in dessen eigener Datenbank (`unifi_networks`, `unifi_known`, `unifi_links`, alle in den Backups), nie der Konsole. Eine Änderung erreicht den laufenden Treiber bei seiner nächsten Abfrage, in der Sitzung, die er schon hat: Er startet das Gerät nicht neu, weil ein Neustart abmeldet und das Budget von einer Anmeldung pro Minute ihn dann eine Minute draußen hielte.

### Die Tags

| Tag | Typ | Was es ist |
|---|---|---|
| `n.<network>.clients` | int | Clients jetzt im Netzwerk, online nach dem Test oben. Jedes LAN-Netzwerk bekommt einen |
| `n.<network>.unknown` | int | In einem OT-Netzwerk: Online-Clients, die nicht auf seiner Liste der Bekannten stehen |
| `n.<network>.unknown_last` | Text | Der neueste davon, in Worten. Leer, wenn es keinen gibt |
| `c.<mac>.online` | bool, connectivity | Beobachteter oder verknüpfter Client im Netzwerk |
| `c.<mac>.ip` | Text | Seine IP, wie die Konsole sie zuletzt sah |
| `c.<mac>.sw_mac`, `.sw_port` | Text, int | Der Switch und Port, an dem ein kabelgebundener Client hängt. Bleibt nach dem Abziehen erhalten: wo er *war*, ist der Punkt |
| `c.<mac>.port_up` | bool, connectivity | Der Link dieses Ports. Schlecht, wenn der Switch selbst von der Konsole abgefallen ist, denn dann weiß es niemand |
| `c.<mac>.last_seen_s` | int, s | Sekunden seit der letzten Sichtung durch die Konsole |

`<network>` ist die ID des Netzwerks auf der Konsole, sodass das Umbenennen von SCADA in der App nichts kaputt macht. Ein als OT markiertes Netzwerk, das die Konsole inzwischen gelöscht hat, liest schlecht mit diesem Grund, nie eine stille Null. Ein Client, den die Konsole nie gesehen hat, liest `online` 0 und den Rest schlecht, und sagt das.

Nur beobachtete und verknüpfte Clients bekommen `c.*`-Tags. Ein Gastnetzwerk, in dem 300 Handys kommen und gehen, erzeugt keine 300 Tag-Sätze.

### Lesen, ohne die Konsole zu fragen

`GET /api/unifi/{id}/networks`, `/clients` und `/known`, die Schublade und das MCP-Werkzeug `find_network_client` lesen alle die letzte Lesung des Treibers. Keines stellt eine eigene Anfrage, sodass ein offen gelassener Bildschirm oder ein Agent, der in einer Schleife fragt, die Konsole nichts kostet und nicht das sein kann, was die 429 einbringt. Die Kehrseite: Ein `--mcp-stdio`-Helfer, der sich nie anmeldet, sagt, dass es in seinem Prozess keine Konsolenlesung gibt.

## Die Bildschirme

Der Reiter UniFi hat sechs Ansichten und eine Konsolenauswahl. Alles darin ist die letzte Lesung der Konsole durch den Treiber, sodass ihn offen zu lassen die Konsole nichts kostet und nicht das sein kann, was eine 429 einbringt. Er fragt HotLoop alle paar Sekunden erneut und zeichnet nur neu, wenn sich etwas geändert hat, sodass eine Karte, die jemand in die Ecke geschoben hat, dort bleibt.

- **Übersicht.** Eine Karte pro Konsole. Oben auf der eines Gateways steht der WAN-Streifen: ein Segment pro WAN, grün, wenn die eigene Zustandsprüfung des Gateways sagt, dass es lebt, rot, wenn nicht, das den Verkehr tragende umrandet. Läuft der Standort auf einem Backup, wird der ganze Streifen bernsteinfarben und nennt, welches und seit wann. Dieses »seit« ist, wann HotLoop es zum ersten Mal so gelesen hat, nicht wann das Gateway umgeschaltet hat, und ein HotLoop, das gestartet ist, als der Standort schon auf 5G war, sagt das ab seinem eigenen Start. Wir drucken keine Uhrzeit, die wir nicht haben. Darunter: Geräte online, kabelgebundene und drahtlose Clients, Clients pro Netzwerk, die Geräte, die die Konsole verloren hat, und die letzten Ereignisse. Ein WAN, zu dem die Konsole nichts sagt, ist grau und sagt »no liveness reported«, nie grün. Jedes WAN, das eine Latenz meldet, hat neben der Zahl eine Spur, dieselbe Linie wie in den Entitätskacheln, aus dem eigenen Puffer von HotLoop für diesen Tag. Ein Administrator findet unten auf der Karte **Create the usual alarms**, siehe [die Start-Alarme](#die-start-alarme).
- **Karte.** Von links nach rechts ab dem Gateway. Sie wird jedes Mal gleich gezeichnet (ein aufgeräumter Baum, keine Physik, gleiche Eingabe und gleiche Pixel), sodass sie auf einer Wandtafel nicht zappelt. Die Kabel sind die eigene `downlink_table` der Konsole: Ein Switch hängt nur an einem anderen, weil die Konsole es sagt. Ein Gerät, das nichts als an etwas angeschlossen aufführt, steht für sich und sagt »no uplink listed«. Wir hängen es nicht auf eine Vermutung ans Gateway, um uns dann darin zu irren, wohin das Netz der SPS führt. Kabelgebundene Clients sitzen an dem Switch und Port, an dem die Konsole sie gelernt hat, drahtlose an ihrem AP und ihrer SSID, gezählt in einem Chip auf der Karte. Klicken Sie ein Gerät an, und alles, was nicht hinter ihm liegt, wird abgedunkelt, und das Seitenfenster listet auf, was dahinter liegt, seine Clients und die Linien des Plant-Baums, die es speist: die HotLoop-Geräte, die mit einem Client darunter verknüpft sind, jedes mit dem Anlagenpfad, an dem es steht. Die Karte zoomt und verschiebt sich: mit zwei Fingern spreizen, mit einem ziehen, Strg und Scrollrad oder das Spreizen eines Trackpads um den Zeiger, oder die Tasten Plus, Minus und Fit, von der ganzen Karte bis auf das Achtfache. Sie ist reines SVG, bleibt also in jedem Maßstab scharf, und wo Sie sie hinstellen, bleibt sie beim Aktualisieren des Bildschirms. Ein Ziehen, das auf einem Gerät endet, wählt es nicht aus. **Plant overlay** setzt die mit einem Client verknüpften HotLoop-Geräte in einen gestrichelten Kasten pro Linie des Plant-Baums, rechts vom Netzwerk und mit dem Pfad der Linie beschriftet, jedes mit einem Kabel zum Switch-Port, an dem es hängt, dem, was das Netzwerk über es sagt (up, down oder nicht gesehen), und dem, was HotLoop über es sagt. Ein verknüpftes Gerät, das an keiner Linie hängt, steht in einem Kasten namens »Not on the Plant tree«. Es bleibt eingeschaltet, sobald Sie es einschalten. Zwei Konsolen sind ein Bild: Eine Maschine einer anderen von HotLoop gelesenen Konsole, die diese Konsole als kabelgebundenen Client auflistet, wird hier mit ihrem eigenen Teilbaum gezeichnet, gestrichelt und mit »separate console« markiert. Die Karte lässt sich als SVG für die Standortmappe exportieren.
- **Geräte.** Eine Tabelle, und ein Klick auf eines zeigt seine Frontplatte: die Ports gezeichnet wie die Vorderseite, eine Reihe für einen kleinen Switch, zwei für 24 und 48 Ports, die ungeraden über den geraden. Grün für einen Link, grau für keinen, **rot für einen Port, der oben war und ausgefallen ist** (HotLoop merkt sich, dass er oben war, seit es zu beobachten begann), gestrichelt für einen deaktivierten, ein PoE-Blitz (die Watt stehen im Tooltip und im Detail des Ports), ein Pfeil am Uplink. Klicken Sie einen Port an, um zu sehen, wer daran hängt, was angeschlossen ist, PoE-Modus, Watt und Datenverkehr, mit einer Spur dessen, was er empfangen und gesendet hat. Ein Gerät, das die Konsole verloren hat, zeigt keine Zahlen und keine Port-Links, weil das, was es zuletzt gesagt hat, nicht aktuell ist.
- **Clients.** Durchsuchbar nach Name, MAC oder IP, mit dem Ort, wann die Konsole ihn zuletzt gesehen hat, bekannt oder unbekannt in einem OT-Netzwerk und dem damit verknüpften HotLoop-Gerät. Administratoren akzeptieren einen unbekannten direkt aus der Zeile.
- **Netzwerke.** Der OT-Schalter, pro Netzwerk, und »alles akzeptieren, wie es ist«. Das ändert den Datensatz von HotLoop, nicht die Konsole.
- **WiFi.** Die SSIDs, ob jede sendet, in welchem Netzwerk sie liegt und wie viele Clients daran hängen. Zeigt die Konsole dem Konto ihre WLANs nicht, sagt der Bildschirm das, statt zu behaupten, es gebe keine.

Die Routen dahinter sind `GET /api/unifi/consoles`, `.../overview`, `.../topology`, `.../devices`, `.../wifi` und `.../events`, dokumentiert in [Die HTTP-API](/de/iot/api/).

### Die Start-Alarme

Die Alarme, die ein Werk auf seinem Netzwerk haben will, bevor jemand darüber nachdenken musste, erzeugt aus dem, was die Konsole jetzt hat. **Create the usual alarms** in der Übersicht (oder `POST /api/unifi/{id}/starter-alarms`, siehe [die HTTP-API](/de/iot/api/)) erzeugt:

| Alarm | Auf | Priorität | Einschaltverzögerung |
|---|---|---|---|
| ein Gerät offline | `d.<mac>.online`, für jeden adoptierten Switch, AP und jedes Gateway | 2 | 60 s, damit ein Firmware-Neustart niemanden anpiept |
| ein Uplink down | `p.<mac>.<nn>.up` an dem Port, über den jedes Gerät mit seinem Upstream verbunden ist | 1 | 10 s |
| ein Gateway auf einem Backup-WAN | `d.<mac>.wan.failover`, für ein Gateway mit zwei oder mehr WANs | 2 | 30 s |
| ein PoE-Port über einem Limit | `p.<mac>.<nn>.poe_w`, nur wenn Sie ein Limit in Watt angeben | 3 | 30 s |

Es sind gewöhnliche Alarmdefinitionen: zurückstellen, quittieren, an Discord senden, Verzögerung oder Limit ändern, einen löschen. Erneutes Drücken nach dem Adoptieren weiterer Geräte fügt nur die neuen hinzu, und ein Tag, der schon einen Alarm hat, von Hand oder durch einen früheren Druck erzeugt, bleibt unberührt. Der PoE-Alarm nimmt ein Limit, das Sie angeben, statt eines, das HotLoop wählt, weil keine Konsole, die wir lesen, das Budget eines Ports nennt und eine geratene Zahl eine Zahl wäre, der jemand vertraut. »Unknown device on an OT network« und »a watched client off the network« sind nicht in der Schaltfläche: Sie entstehen, wenn ein Netzwerk als OT markiert und wenn ein Gerät beobachtet oder verknüpft wird, mit dem Datensatz, der ihnen eine Bedeutung gibt.

## Ereignisse

Der Ereignis-Websocket der Konsole (`/proxy/network/wss/s/<site>/events` auf UniFi OS, `/wss/s/<site>/events` auf der selbst gehosteten Anwendung), in derselben Sitzung wie alles andere. Er meldet sich nie von selbst an: Ein abgelehnter Handshake mit 401 läuft durch dasselbe Anmeldebudget wie eine Lesung, und eine abgelehnte Anmeldung wird abgewartet, nicht wiederholt.

**Die Abfrage bleibt die Wahrheit.** Ein Ereignis schreibt nie einen Tag. Was es tut:

1. Es landet im **Logbuch**, sobald es eintrifft, mit dem eigenen Satz des Controllers (»Switch[...] was disconnected«) und seinem Schlüssel. Ein ausfallender Switch steht auf der Zeitleiste, wenn es passiert, nicht wenn die nächste Abfrage es bemerkt. Es wird unter dem Switch, Access Point oder Gateway abgelegt, um das es geht, nicht unter dem Gerät der Konsole selbst, weil die Konsole die Maschine ist, auf der der Controller läuft, und nicht das, was ausgefallen ist. Ein Ereignis, das nur einen Client nennt (die Konsole sagt, wer beigetreten ist, nicht wo), wird unter dem Switch oder AP abgelegt, an dem die letzte Lesung diesen Client hat, und wenn der Client neu ist, wartet es auf die Lesung, die das Ereignis gerade angefordert hat, bis zu dreißig Sekunden, und landet dann unter der Konsole, falls diese Lesung ihn nie hat. Der Filter **Where** des Logbuchs findet ein Ereignis vom Werk aus: ein mit seinem Client verknüpftes HotLoop-Gerät, den Switch, an dem die Konsole diesen Client sieht, und jeden Switch von dort bis zum Gateway nach der Downlink-Tabelle der Konsole selbst. Ein ausgefallener Switch steht auf der Zeitleiste jeder Linie, die er speist, und auf keiner, die er nicht speist. Die Konsole selbst abzufragen funktioniert wie immer: das Systemlog nach `subject` gleich der ID der Konsole und das Logbuch mit der Konsole unter den Geräten im Geltungsbereich liefern alle Ereignisse dieser Konsole, auch die einzelner Switches.
2. Es geht in das Log, das die Übersicht zeigt, und in `site.last_event` und `d.<mac>.last_event`, sodass eine Automatisierung auf eines reagieren kann.
3. Es fordert sofort die nächste Lesung an. Die Mindestzeit zwischen Lesungen beträgt zehn Sekunden; ein Ereignis kürzt sie auf fünf, sodass Tags und Entitäten bei der nächsten Abfrage aufholen statt bis zu zehn Sekunden später. Ein ausgelastetes WiFi sendet ein Ereignis für jedes Handy, das vorbeiläuft, und die Konsole wird nicht für jedes gelesen.

Der Controller kennzeichnet die Ereignisse, die bedeuten, dass etwas schiefgegangen ist (`is_negative`: Ein Switch, der den Kontakt verliert, ist eines, ein Client, der sich trennt, nicht), und diese sind Warnungen im Logbuch. Alles andere ist Information, auch Schlüssel, die HotLoop noch nie gesehen hat.

**Ein toter Websocket kostet Geschwindigkeit, nie Korrektheit.** Er verbindet sich neu mit einem Backoff von zwei Sekunden bis zu einer Minute. Er pingt, und ein Strom, der 90 Sekunden nichts antwortet, ist tot, was das Netzwerk auch sagt, also wird er geschlossen und neu geöffnet. Solange er unten ist, liest `site.events_live` 0, die Übersicht sagt »polling only« mit dem Grund, und die Abfrage läuft genau wie zuvor weiter.
## Was verifiziert ist

Der UniFi-Treiber und die Bildschirme wurden gegen echte UniFi Network Applications und UniFi-OS-Konsolen betrieben, schreibgeschützt mit einem View-Only-Konto, und am 2026-11-17 auf echter Hardware: die Anmeldung und ihre eine Sitzung, die Tags für Gerät, Port, PoE, WAN und Client, der Live-Ereignisstrom und die darauf aufbauenden Bildschirme.
