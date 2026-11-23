---
title: "MQTT-Erkennung"
description: "ESPHome, Zigbee2MQTT, Tasmota oder Shelly am Broker anmelden: Das Gerät erscheint schreibgeschützt, bis ein admin es annimmt und jeden Punkt scharf schaltet."
---

Richten Sie ein Gerät auf den Broker von HotLoop, und es erscheint. Seine Sensoren lesen, seine Schalter zeigen ihren Zustand, seine Entitäten tragen die Namen, Einheiten und Klassen, die es angekündigt hat. Niemand tippt eine Tag-Liste.

Und es kann nichts befehlen. Jeder Punkt, den die Erkennung anlegt, ist schreibgeschützt und bleibt es, bis ein admin das Gerät annimmt und dann jeden Punkt von Hand scharf schaltet, mit Blick auf das genaue Topic, an das der Befehl geht. Ein Gerät, das sich ankündigt, ist ein Gerät, das Ihnen sagt, was es ist. Das ist nützlich. Es ist kein Gerät, das sich das Recht verdient, in Ihrer Anlage ein Relais zu schalten, und HotLoop tut nicht so, als wäre es das.

## Wer es spricht

Das Format ist das mit Topics wie `homeassistant/sensor/kitchen/power/config`. Es trägt den Namen des Projekts, das es definiert hat; HotLoop spricht es, weil die Publisher es tun, und das ist die ganze Beziehung.

| Publisher | Wie es hierher kommt | Wogegen wir es testen |
|---|---|---|
| **ESPHome** (seine `mqtt:`-Komponente) | je Komponente, standardmäßig an, retained | aufgezeichnete Ausgabe echter Knoten (siehe unten) |
| **Zigbee2MQTT** | je Komponente, mit Templates fast überall | aufgezeichnete Ausgabe echter Installationen |
| **Tasmota** | sein eigenes Format, unten | aufgezeichnete Ausgabe von neun echten Geräten |
| **Shelly** (Gen2, Gen3, Gen4) | gar keine Ankündigung; gelernt aus den Statusmeldungen, die es veröffentlicht, unten | aufgezeichnete Ausgabe von fünfzehn Sätzen echter Nachrichten und die Dokumentation des Herstellers |
| Alles andere, das das Format veröffentlicht | dasselbe | die eigenen Regeln des Formats |

ESPHome wird an Aufzeichnungen echter Knoten gemessen, genau wie Zigbee2MQTT.

Die Aufzeichnungen sind Nachrichten, die eine echte Installation veröffentlicht hat, mitgeschnitten von der Person, die sie betreibt, mit vermerktem Publisher, Version und Gerät und ohne Änderung außer den JSON-Leerzeichen.

## Tasmota

Aktuelles Tasmota veröffentlicht das `homeassistant/`-Format nicht. Seine Dokumentation sagt, es sei aus jedem Build entfernt worden. Was es retained veröffentlicht, ist sein eigenes:

- `tasmota/discovery/<MAC>/config`: das Gerät (sein Topic, sein Full-Topic-Muster, seine Relais und Lichter, seine Wörter für An und Aus, seine Last-Will-Wörter);
- `tasmota/discovery/<MAC>/sensors`: was seine Sensoren gerade lesen.

Beide werden von `TasDiscovery` in Tasmotas `xdrv_12_discovery.ino` geschrieben (gelesen auf arendst/Tasmota `development` 5c295fb, 2026-10-12). HotLoop macht aus beiden dieselben Komponenten wie jeder andere Publisher, daher ist alles Weitere (die Bildschirmseite Erkannt, Annehmen, Scharfschalten, das Schreib-Gate, das Lesen) ein einziger Codepfad. Die MAC ist die Identität des Geräts; ein Gerät, das sich zusätzlich im `homeassistant/`-Format ankündigt (eine alte Firmware mit SetOption19), ist dasselbe Gerät.

| Tasmota sagt | HotLoop erzeugt |
|---|---|
| ein Relais (`rl` 1) | einen Schalter: liest `stat/<topic>/POWER` (`POWER1`, `POWER2` und so weiter, wenn es mehrere gibt), in den eigenen An- und Aus-Wörtern des Geräts; befiehlt `cmnd/<topic>/POWER[n]` mit ON oder OFF |
| ein Licht (`rl` 2) | ein Licht: An und Aus genauso. Bei einem Dimmer ist sein Pegel der `Dimmer`-Schlüssel von `tele/<topic>/STATE`, 0 bis 100, und wird mit `cmnd/<topic>/Dimmer` gesetzt |
| jede Zahl in der Sensornachricht | je einen Sensor, gelesen aus `tele/<topic>/SENSOR` über seinen Pfad (`ENERGY` `Power`, `SCD40` `CarbonDioxide`), mit der Einheit und Klasse, die Tasmota diesem Namen gibt. Das Array eines Drehstromzählers ergibt einen Sensor je Phase |
| sein Last Will | Verfügbarkeit: `tele/<topic>/LWT`, mit den eigenen Wörtern Online und Offline des Geräts |

Topics werden so gebaut, wie Tasmota sie baut: sein Full Topic mit eingesetzten `%prefix%` und `%topic%`, sodass ein Gerät, dessen Besitzer das Full Topic geändert hat (`tasmota/35D7A0/%prefix%/`, oder `bi/test/%topic%/%prefix%`), auf den Topics liest und befiehlt, die es tatsächlich benutzt.

Was es nicht liest, sagt es, in den Problemen der Quelle und nie durch Schweigen: Rollläden, einen Schalteingang, eine Taste, einen iFan, eine Kamera, die Farben eines Farblichts und die Helligkeit eines Geräts mit mehr als einem Licht. Nichts in den Aufzeichnungen zeigt, dass eines davon funktioniert, also behauptet hier nichts, sie zu lesen.

**Nachfragen.** Tasmota meldet ein Relais, wenn es sich ändert, und alles alle fünf Minuten. Wenn also ein Gerät zu lesen beginnt, sendet HotLoop eine leere Nachricht an `cmnd/<topic>/POWER`, die Tasmota mit dem Zustand jedes Relais beantwortet, ohne etwas zu bewegen; ohne sie liest ein Gerät, das sich nicht geändert hat, bis zu fünf Minuten nach dem Start von HotLoop unbekannt. Die Nachricht ist leer, an ein Topic, das auf `POWER` endet und sonst nichts, und eine reine Mithör-Quelle sendet gar nichts.

**Die Helligkeit eines Lichts** kommt mit Tasmotas Telemetrie (alle fünf Minuten, außer der `TelePeriod` des Geräts ist kürzer), nicht in dem Moment, in dem sie sich ändert. An und Aus kommen sofort.

**An jedem Broker** ist das Format ein Schalter (`tasmota` am Broker, unter Einstellungen, MQTT). Ein jetzt hinzugefügter Broker hat ihn an; der eingebettete Broker hat ihn immer; ein bereits vorhandener Broker hört genau wie vorher zu, ist also aus, bis ihn jemand einschaltet. Aus heißt, HotLoop abonniert dort nicht einmal `tasmota/discovery/#`.

Eine Konfiguration ist wie jede andere nicht vertrauenswürdig. Eine unter einer MAC veröffentlichte, die nicht die ist, die sie vorgibt, ein Full Topic ohne `%topic%` oder mit Platzhalter, ein Topic mit einem Schrägstrich, ein An-Wort mit Anführungszeichen, eine Version, die es nicht kennt: jede wird mit Begründung abgelehnt, und nichts wird angelegt. Ein Sensorname mit Anführungszeichen erreicht nie ein Template.

**Wogegen das getestet wurde.** Echte Nachrichten von neun Geräten, mitgeschnitten von Tasmotas eigener Konsole:

| Aufzeichnung | Gerät | Quelle |
|---|---|---|
| esp32-8relay-13.4.0 | ESP32-Platine, 8 Relais, Tasmota 13.4.0 | github.com/arendst/Tasmota/issues/20953 |
| esp32-zigbee-gateway-reboots-15.3.0.1 | ESP32 ohne Relais, drei Starts | github.com/arendst/Tasmota/issues/24487 |
| esp8266-sps30-scd40-airsensor-14.1.0 | CO2- und Partikelsensor, 14.1.0 | github.com/arendst/Tasmota/issues/24780 |
| esp8266-sps30-scd40-airsensor-15.4.0-invalid-json | dasselbe Gerät mit 15.4.0, dessen Firmware JSON mit einem abschließenden Komma veröffentlichte | dasselbe Issue |
| nous-a1t-energy-plug-14.5.0 | NOUS-A1T-Steckdose mit Energiemessung | github.com/arendst/Tasmota/issues/23094 |
| olimex-esp32-poe-counter-custom-fulltopic-14.5.0 | Zähler und ein Drehstromzähler, Full Topic geändert | github.com/arendst/Tasmota/issues/23775 |
| shelly-dimmer2-15.3.0.3 | Shelly Dimmer 2 mit Tasmota | github.com/arendst/Tasmota/issues/24560 |
| tuyamcu-energy-meter-custom-fulltopic-14.5.0 | TuyaMCU-Energiezähler, Full Topic geändert | github.com/arendst/Tasmota/issues/23165 |
| wemos-2relay-15.1.0.1 | zwei Relais, aus dem Konsolenprotokoll des Tasmota-Autors selbst | github.com/arendst/Tasmota/issues/24006 |

Das sind Aufzeichnungen, kein Gerät auf dem Prüftisch. Was die Aufzeichnungen nicht haben, ist die Helligkeit (die `tele/STATE`-Zeile des Dimmers war in ihrem Quellprotokoll verstümmelt; sein `Dimmer`-Schlüssel steht im `STATUS11` derselben Aufzeichnung, das Tasmota mit derselben Funktion baut) und die Leistungsabfrage mit Antwort (die Aufzeichnungen zeigen Frage und Antwort, aus Tasmotas Konsole, nicht HotLoop beim Fragen).

## Shelly

Ein Shelly Gen2, Gen3 oder Gen4 kündigt nichts an. Es gibt kein Konfigurations-Topic, auf das man warten könnte. Was er tut, sobald MQTT an und seine Statusbenachrichtigungen an sind: den gesamten Status jeder Komponente auf `<prefix>/status/<component>` veröffentlichen (`switch:0`, `cover:0`, `light:0`, `input:0`, ein virtuelles `boolean:200`), jedes Mal wenn er sich ändert, und seinen Last Will auf `<prefix>/online`. HotLoop lernt das Gerät also aus dem, was es sagt: die Komponenten, die es veröffentlicht hat, die Felder, die jede getragen hat, und die MAC aus seinem `sys`-Status. Das Präfix ist standardmäßig die ID des Geräts (`shellyplus2pm-485519968144`), also sein Modell und seine MAC, ein Gerät mit seinem Standardpräfix wartet daher nicht einmal auf `sys`. Eines mit einem von jemandem getippten Präfix (`ShellyLichtGarten`) muss `sys` veröffentlichen, bevor es von einem anderen unterschieden werden kann, und bis dahin wird es in den Problemen der Quelle genannt und nicht angelegt.

Was gelernt wurde, wird je Präfix gespeichert und wächst nur. Eine Komponente, die verstummt, wurde nicht entfernt, und ein Status mit weniger Inhalt als der letzte nimmt nichts weg, ein Neustart lässt ein Gerät also keine Teile verlieren. Alles danach ist derselbe Pfad wie bei jedem anderen Publisher: die Bildschirmseite Erkannt, Annehmen, jeden Punkt scharf schalten, das Schreib-Gate, das Lesen.

| Shelly sagt | HotLoop erzeugt |
|---|---|
| `switch:n` mit einem `output` | einen Schalter: liest `output` aus `<prefix>/status/switch:n`; befiehlt `<prefix>/command/switch:n` mit `on` oder `off` |
| `light:n` | ein Licht genauso, mit `set,true` und `set,false`; mit `brightness` in seinem Status ein Pegel von 0 bis 100, gesendet als `set,true,<level>` |
| `cover:n` | eine Abdeckung: liest `state` (open, closed, opening, closing, stopped) und sendet `open`, `close` und `stop`. Eine Abdeckung, die `pos_control` sagt, ist kalibriert, liest also auch `current_pos` und bekommt `pos,<n>`; eine, die es nicht ist, öffnet und schließt nur |
| `apower`, `voltage`, `current`, `freq`, `pf`, `aenergy.total`, `temperature.tC` an einem switch, light oder cover | je einen Sensor, in W, V, A, Hz, Wh und Grad C, mit der Klasse, die Shellys Dokumentation ihnen gibt |
| `input:n` | einen Binärsensor seines `state` |
| `devicepower:n`, `voltmeter:n`, `illuminance:n`, `presencezone:n` | Sensoren und Binärsensoren für Batterie, externe Versorgung, Spannung, Helligkeitspegel, Anwesenheit und Anzahl der Objekte |
| `boolean:n`, `number:n`, `enum:n` (virtuelle Komponenten) | schreibgeschützte Sensoren. Eine virtuelle Komponente zu setzen ist ein RPC-Aufruf, den dies nicht tut, und jede wird in den Problemen der Quelle genannt |
| sein `online`-Last-Will | Verfügbarkeit, mit Shellys eigenen `true` und `false` |

Die Befehle sind die, die die MQTT-Seite des Herstellers unter MQTT Control aufführt, und die Tests halten HotLoop an diese Liste: `on`, `off` und `toggle` für einen Schalter; `set,<bool>,<brightness>` für ein Licht; `open`, `close`, `stop` und `pos,<n>` für eine Abdeckung. Jeder ist ein Schreibvorgang durch das Gate, scharf geschaltet von einer Person.

**Nachfragen.** Ein Shelly veröffentlicht eine Komponente, wenn sie sich ändert, ein Gerät, das sich nicht geändert hat, würde also unbekannt lesen, bis es sich ändert. Wenn ein Gerät zu lesen beginnt, sendet HotLoop `status_update` an `<prefix>/command`, was laut derselben Seite das Gerät den Status seiner Komponenten veröffentlichen lässt und nichts bewegt. Es ist dieses eine Wort, an ein Topic, das auf `/command` endet und sonst nichts, und eine reine Mithör-Quelle sendet gar nichts. Es geschieht jedes Mal, wenn das Lesen des Geräts beginnt, mehrere Punkte hintereinander scharf zu schalten fragt also mehrfach.

**Was am Gerät an sein muss.** MQTT aktiviert, mit der Adresse des Brokers; Statusbenachrichtigungen an (`status_ntf`); und für Befehle die Steuerung an (`enable_control`). HotLoops eigener Broker hat ein `shelly`-Zugangsprofil, benannt nach dem Präfix des Geräts, das es seine Status veröffentlichen und `<prefix>/command` hören lässt, sonst nichts.

**Was er nicht liest.** Gesagt, in den Problemen der Quelle, nie durch Schweigen: eine Komponente einer Art, die ihm nicht gezeigt wurde (`lora:100` an einem Gen4 mit dem LoRa-Add-on, ein `pm1`, ein `em`), ein switch oder cover, das das Feld ausgelassen hat, aus dem gelesen wird, und die Einstellung einer virtuellen Komponente. Eingangsereignisse (ein Doppeldruck, ein langer Druck) kommen auf dem RPC-Benachrichtigungs-Topic `<prefix>/events/rpc` und werden nicht gelesen; nur der `state` eines Eingangs wird gelesen. Ein Präfix mit mehr als zwei Ebenen (`home/garage/boiler`) wird nicht gehört; eine oder zwei schon. Per RPC wird nichts gesendet.

**An jedem Broker** ist es ein Schalter (`shelly` am Broker, unter Einstellungen, MQTT). Ein jetzt hinzugefügter Broker hat ihn an; der eingebettete Broker hat ihn immer; ein bereits vorhandener Broker hört genau wie vorher zu, ist also aus, bis ihn jemand einschaltet. Er ist ein Schalter, weil die Topics, auf denen er hört, `+/status/+`, weit sind, und ein Broker, der unter `*/status/*` etwas anderes führt, ihn aus haben will. Aus heißt, HotLoop abonniert sie dort nicht.

Es ist wie jedes andere Topic nicht vertrauenswürdig. Ein Präfix, das nicht aus Buchstaben, Ziffern und `_.-` besteht, eine Komponente, die nicht `kind:number` ist, eine Nutzlast, die kein Objekt ist oder über 64 KiB liegt, ein Gerät, das mehr als 64 Komponenten meldet, und mehr als 512 gleichzeitig gelernte Geräte werden jeweils ignoriert, und eine unter einem Präfix gehaltene Struktur, die vorgibt, ein anderes zu sein, wird abgelehnt.

**Wogegen das getestet wurde.** Fünfzehn Sätze echter Nachrichten und die eigene Dokumentation des Herstellers.

| Aufzeichnung | Gerät | Quelle |
|---|---|---|
| plus-1-fw1.4.2-switch-rpc | Plus 1, Firmware 1.4.2 | github.com/iobroker-community-adapters/ioBroker.shelly/issues/1055 |
| plus-2pm-cover-mode | Plus 2PM als Rollladen, kalibriert | dasselbe Repository, issues/1088 |
| 1pm-mini-gen3-fw2.0.0-switch | 1PM Mini Gen3, 2.0.0 | dasselbe, issues/1592 |
| 2pm-gen3-fw2.0.1-beta3-switch | 2PM Gen3, 2.0.1-beta3, zwei Kanäle | dasselbe, issues/1627 |
| 2pm-gen4-lora-addon | 2PM Gen4 mit dem LoRa-Add-on | dasselbe, issues/1349 |
| plug-s-gen3-fw2.0.1-beta1-switch | Plug S Gen3 | dasselbe, issues/1594 |
| pro4pm-gen2-fw2.0.1-switch-set | Pro 4PM, 2.0.1, mit geschwärzter MAC des Einsenders | dasselbe, issues/1640 |
| pro-dimmer-2pm-fw1.3.0-light | Pro Dimmer 2PM | dasselbe, issues/974 |
| dimmer-gen3-light-sys | Dimmer Gen3 | github.com/enesbcs/shellyteacher4domo/issues/65 |
| pill-gen3-fw1.8.99 | Pill, 1.8.99, mit einem Voltmeter | das ioBroker-Repository, issues/1232 |
| presence-gen4-fw2.1.99-dev | Presence Gen4, drei Zonen | dasselbe, issues/1228 |
| frankever-sprinkler-virtual-components | eine Bewässerungssteuerung mit eigenem Präfix, virtuelle Komponenten | dasselbe, issues/1207 |
| official-docs-component-status | die Komponentenbeispiele des Herstellers: Plus 1PM, Plus 2PM, H&T, Pro 1, WDUS | shelly-api-docs.shelly.cloud |
| official-docs-mqtt-control | die MQTT-Control-Befehle des Herstellers | dasselbe |
| official-docs-mqtt-page, official-docs-notifications | die MQTT-Seite des Herstellers und ihre Benachrichtigungsbeispiele | dasselbe |

Zwei davon lassen sich nicht zu einem Gerät bauen, und die Tests sagen das: das Präfix des Pro 4PM enthält die Schwärzung des Einsenders (`xxxx`) und kein `sys`, und das des Gartenlichts ist ein eigenes Präfix, das ebenfalls keines hat. Beide warten auf ihre MAC, wie es ein echtes täte.

**Das ist gegen Aufzeichnungen und die Dokumentation geprüft, nicht gegen einen Shelly auf dem Prüftisch.** Bisher ist keiner da. Die Status sind das, was echte Geräte veröffentlicht haben, die Topics, die HotLoop liest, sind Topics, die diese Geräte benutzt haben, und die Befehle haben die Formen, die der Hersteller dokumentiert. Was die Aufzeichnungen nicht zeigen können: ein Befehl, der tatsächlich ein Relais bewegt, eine Abdeckung, die tatsächlich eine Position anfährt, und die Antwort auf `status_update`. Wenn ein Shelly auf dem Prüftisch steht, sind das die drei Dinge, die man zuerst probiert.

## Was passiert, wenn sich etwas ankündigt

1. **Es erscheint.** Am eingebetteten Broker ist ein Gerät, das sich ankündigt, sofort ein HotLoop-Gerät: Protokoll `mqtt`, nicht im Baum platziert, benannt nach dem, wie es sich nannte (`kitchen-plug`, bei Kollision dann `-2`), lesend. Seine Tags sind nach dem benannt, was es angekündigt hat (`power`, `relay`). Seine Entitäten bekommen den Namen, die Geräteklasse, die Zustandsklasse, die Einheit, die Kategorie und das Symbol, die die Konfiguration ihnen gab, und eine Entität, die die Konfiguration als standardmäßig aus kennzeichnet, startet deaktiviert.
2. **Nichts ist scharf geschaltet.** Jeder Tag wird schreibgeschützt angelegt. Ein Schalter, eine Zahl oder ein Text bekommt sofort seine Steuer-Entität, nicht scharf (`armed: false`), sodass ein Bildschirm oder eine Automatisierung ab dem ersten Tag `switch.kitchen_plug_relay` benennen kann. Sie funktioniert, sobald eine Person den Punkt scharf schaltet, und nicht früher.
3. **Ein admin entscheidet.** Geräte, Erkannt. Wer es angekündigt hat (am eingebetteten Broker der Zugang und die Client-ID, die seine Konfiguration veröffentlicht haben), jede Komponente, die es anlegen würde, jedes Topic, das es liest, jedes Befehls-Topic vollständig, und worauf zu achten ist:

   - ein Befehls-Topic außerhalb der Topics, die die Komponente liest (eine „Lampe“, deren Befehle an `cmnd/boiler/POWER` gehen);
   - ein Befehls-Topic innerhalb des Erkennungspräfixes oder eines, das ein anderes Gerät ebenfalls beansprucht;
   - eine Konfiguration, die retained Befehle verlangt, weil ein retained Befehl bei jeder Wiederverbindung des Geräts erneut abgespielt wird;
   - Templates, die HotLoop nicht auswerten kann, und Konfigurationsschlüssel, die das Format nicht definiert.

   **Annehmen** lässt es weiterlesen und macht seine Punkte scharf schaltbar, einzeln, im Tag-Editor. Es schaltet nichts scharf. Wenn das Gerät einen Bereich vorgeschlagen hat und ein Baumknoten genau diesen Namen trägt, füllt der Annehmen-Dialog ihn vor. Ein Publisher darf sich nicht selbst unter Heizraum einsortieren; eine Person klickt auf Annehmen. **Ignorieren** verwirft das Gerät, die Tags und die Entitäten (der Verlauf bleibt, wie bei jedem Gerät) und hält es verworfen, wenn es sich erneut ankündigt. Ein erkanntes Gerät zu löschen ist dasselbe wie Ignorieren, weil eines, das sich weiter ankündigt, einfach wiederkäme.

## Wenn es sich anders entscheidet

**Ein anderer Zugang wird zur Prüfung zurückgehalten, was auch immer er sagt.** Am eingebetteten Broker merkt sich ein Gerät den Zugang, von dem es angenommen wurde. Dasselbe Gerät, von einem anderen Zugang angekündigt, wird zur Prüfung zurückgehalten, mit beiden Zugängen nebeneinander, auch wenn die Konfiguration Wort für Wort dieselbe ist, und das Protokoll bekommt eine Warnung. Entweder hat jemand das Gerät auf einen neuen Zugang umgezogen, oder ein Zugang kündigt ein Gerät an, das nicht seines ist. Übernehmen, und der neue Zugang ist der, von dem es angenommen wird. Ablehnen, und dieser Zugang, der dasselbe ankündigt, bleibt abgelehnt.

**Eine Konfiguration, die sich unter einem angenommenen Gerät ändert, wird zur Prüfung zurückgehalten.** Die angenommene Konfiguration läuft weiter. Die Bildschirmseite Erkannt zeigt die Änderung Feld für Feld, laufend gegen angekündigt, und ein admin übernimmt oder lehnt sie ab. Eine Einheit, die von °C auf °F wechselt, oder ein Zustands-Topic, das woandershin zeigt, ist genau die Art, wie eine falsche Zahl ein vertrauenswürdiges Gesicht bekommt. Eine Änderung zu übernehmen ändert nie, ob ein Punkt scharf geschaltet ist: das war die Entscheidung einer Person und bleibt es.

Ein Firmware-Update, ein neuer Gerätename, ein neues Modell oder ein anderes Symbol wird von selbst übernommen. Niemand sollte für einen Versionssprung klicken müssen.

Bevor jemand ein Gerät annimmt, gilt immer die neueste Ankündigung: noch hat niemand darauf aufgebaut.

**Eine leere Konfiguration zieht eine Komponente zurück.** Ihre Punkte lesen schlecht und sagen „vom Publisher um 14:02 zurückgezogen“, und nichts wird gelöscht. Ein Alarm auf diesen Punkt behält sein Ziel und sagt, warum er schlecht ist. Wenn dieselbe Komponente zurückkommt, wird sie wieder eingesetzt, und bis sie einen neuen Wert sendet, liest sie „nach einem Rückzug erneut angekündigt; wartet auf ihren nächsten Wert“, statt den Wert von vor dem Weggang auszugeben. Ein Gerät, das niemand angenommen hat und das alle seine Komponenten zurückzieht, ist weg, weil niemand darauf aufgebaut hat.

**Zigbee2MQTT beim Umbenennen eines Geräts** löscht dessen alte Konfigurations-Topics und kündigt neue mit denselben eindeutigen IDs an. HotLoop führt Komponenten über die eindeutige ID, das ist also ein Rückzug und eine Wiedereinsetzung im Abstand einer Sekunde, und nichts geht verloren.

## Lesen

Ein Zustand läuft durch das Wert-Template der Komponente, falls sie eines hat, und dann durch die eigene Zuordnung der Komponente: `payload_on`/`payload_off` für einen Binärsensor (standardmäßig `ON`/`OFF`), `state_on`/`state_off` für einen Schalter, eine Zahl für eine Zahl, eine der Optionen für ein select. **Alles, was nicht passt, ist ein schlechter Messwert mit Begründung**, auf der Kachel angezeigt:

- `"CLOSE" is neither payload_on "CLOSED" nor payload_off "OPEN"`
- `value_json has no key 'temperature'`
- `"unavailable" is not a number`
- `the publisher sent no value` (er sendete `None`, `null`, nichts oder `unknown`)
- `no update for 300 s (expire_after)`

Das erste ist echt: Zigbee2MQTT 1.41.0 kündigt den Fenstersensor eines Avatto TRV07 so an, und die Person, die es mitgeschnitten hat, eröffnete ein Issue, weil das Fenster nie erschien. HotLoop zeigt es als schlecht und sagt, warum, statt zu raten.

**Verfügbarkeit** ist die Verbindung des Geräts, kein Messwert. Solange das Gerät auf seinem Verfügbarkeits-Topic sagt, es sei offline, erscheint es getrennt, mit seinen eigenen Worten („the device says it is offline (plug/status = offline)“), und seine Entitäten sind nicht verfügbar. Bis die erste Verfügbarkeitsnachricht eintrifft, ist ein Gerät mit konfigurierter Verfügbarkeit nicht verfügbar. Das ist die Regel des Formats, und sie ist die richtige. Die Broker-Sitzung wird dafür nicht abgebaut: sie wird mit jedem anderen Gerät an diesem Broker geteilt.

`expire_after` macht einen Wert schlecht, wenn er so viele Sekunden ohne Aktualisierung bleibt. `off_delay` schaltet einen Binärsensor nach so vielen Sekunden aus, weil die Konfiguration sagt, dass das Gerät das Aus nie sendet. JSON-Attribute landen an der Entität, bis zu 64 Schlüssel und 8 KiB, unterhalb von HotLoops eigenen (`friendly_name`, `source`, `armed` und der Rest gewinnen immer).

Eine Komponente ohne Zustands-Topic liest für immer schlecht. HotLoop nimmt nie einen Zustand aus einem Befehl an.

## Befehle

Nichts wird befohlen, bis drei Dinge zutreffen, in dieser Reihenfolge:

1. **Eine Person hat das Gerät angenommen.** Bis dahin schaltet der Tag-Editor keinen Punkt daran scharf („accept the device first“), und das Schreib-Gate lehnt seine Befehle von sich aus ab, sodass auch eine von Hand bearbeitete Zeile oder ein altes Backup mit scharf geschaltetem Punkt nirgends hinkommt.
2. **Eine Person hat den Punkt scharf geschaltet**, im Tag-Editor, einzeln. Vor dem Kontrollkästchen sagt der Editor, wohin die Befehle gehen und was sie senden: „Commands go to `plug/relay/set`, sending ON or OFF.“
3. **Das Schreib-Gate lässt den Befehl durch**, wie jeden anderen Schreibvorgang: Schreiben eingeschaltet, der MCP-Schalter für einen Agenten, der Bereich des Tags, die eigenen Prüfungen der Entität, eine aktive Sitzung. Mit seiner Aufruf-ID protokolliert, abgelehnt oder nicht. Der Probelauf stellt genau dieselben Fragen.

Was hinausgeht, ist das, was die Konfiguration sagt: `payload_on` und `payload_off` für einen Schalter, `payload_press` für eine Taste, die Option für ein select, der Wert für eine Zahl oder einen Text (eine ganze Zahl als solche, `5` und nicht `5.0`), durch das Befehls-Template der Konfiguration, wenn sie eines hat. Eine Taste wird einmal gedrückt. Ihr „Loslassen“ wäre ein zweiter Befehl, den das Gerät nie verlangt hat, daher ist eine erkannte Taste einmalig.

Ein Licht bekommt `payload_on`/`payload_off` (ein Licht mit JSON-Schema, `{"state":"ON"}`) und eine Helligkeit in Prozent, auf sein eigenes `brightness_scale` skaliert und gerundet, auf seinem Helligkeits-Befehls-Topic (ein Licht mit JSON-Schema, `{"state":"ON", "brightness":128}`). Eine Abdeckung bekommt `payload_open`, `payload_close` oder `payload_stop` und eine Position, von Prozent in ihr eigenes `position_closed`..`position_open` skaliert durch `set_position_template`. Ein Ventil bekommt seine Öffnen- und Schließen-Nutzlasten (ein Ventil, das eine Position meldet, seine `position_open` und `position_closed`), eine Position auf seinem Befehls-Topic und einmal `payload_stop`: wie eine Taste ist der Stopp eines erkannten Ventils einmalig. Eine Nutzlast, die die Konfiguration mit `null` abschaltet (eine Abdeckung ohne Stopp), ist ein Befehl, den das Gate mit Begründung ablehnt.

Das Gate lehnt einen Befehl mit Begründung ab, wenn:

- niemand das Gerät angenommen hat;
- der Broker, an dem es hängt, nur mithört;
- der Publisher die Komponente zurückgezogen hat;
- sein Befehls-Template außerhalb der Teilmenge liegt („command template not supported: filter `regex_replace` is not supported at column 12“). Es heißt nie „stattdessen den Rohwert senden“;
- seine Konfiguration kein Befehls-Topic hat;
- seine Konfiguration keine Nutzlast für das Verlangte hat: ein Stopp an einer Abdeckung, deren Konfiguration `payload_stop: null` sagt, eine Option, die ein select nicht hat, eine Helligkeit über 100 %. Die Nutzlast wird in der Prüfung erzeugt, daher sagt auch der Probelauf Nein.

**Retained Befehle folgen der Konfiguration.** Wenn eine Konfiguration `retain: true` verlangt, veröffentlicht HotLoop die Befehle dieser Komponente retained und sagt das überall, wo eine Person darüber entscheidet: die Bildschirmseite Erkannt markiert es, und der Tag-Editor sagt es in klaren Worten. Verstehen Sie, was das bedeutet, bevor Sie einen scharf schalten: der Broker behält den letzten Befehl und übergibt ihn dem Gerät bei jeder Wiederverbindung, um drei Uhr nachts, ohne dass jemand Hand an irgendetwas legt. Der Befehl ging trotzdem durch das Gate und steht weiter mit einem Namen daneben im Audit-Protokoll; er geschieht nur noch einmal.

Es gibt nirgends ein „veröffentliche dies auf jenem Topic“: nicht in Automatisierungen, nicht in Skripten, nicht in MCP. Das wäre eine Seitentür am Gate vorbei mit hübscherem Namen. Im Code veröffentlichen zwei Dinge in der Erkennung: der Schreibvorgang des Treibers, den nur das Gate erreicht, und die Geburtsnachricht. Ein Wächtertest prüft die Typen des Treiberpakets und lässt den Build fehlschlagen, wenn irgendetwas anderes eines von beiden aufruft, mit einem eingepflanzten Bypass, der beweist, dass er beißt.

## Templates

Kein Python, keine Jinja-Engine. Keine Schleifen, ein Template kostet also, was seine Länge kostet.

`{% set name = value %}` ist drin, und nur diese Form: Zigbee2MQTT schreibt den Modus jedes Thermostats als `{% set values = {'manual':'heat', ...} %}` und schlägt ihn dann nach, und ein Thermostat, dessen Modus sich nicht lesen lässt, ist ein Thermostat, dem man nicht trauen kann. Kein Namensraum, kein Entpacken, keine Blockform. `.keys()` ist auch drin, nur als rechte Seite von `in`, weil das die einzige Stelle ist, an der diese Templates es benutzen.

| <span class="sr-only">Details</span> | <span class="sr-only">Details</span> |
|---|---|
| Struktur | Text, `{{ expr }}`, `{% if %}` / `{% elif %}` / `{% else %}`, `{% set name = value %}`, `{# comments #}`, Leerraumsteuerung mit `-` |
| Variablen | Wert-Templates: `value`, `value_json` (nur wenn die Nutzlast JSON ist), `entity_id`, `name`; Befehls-Templates: `value`, `entity_id`, `name` |
| Ausdrücke | Literale, `.attr`, `['key']`, `[0]`, Slices, `+ - * / // % **`, `~`, Vergleiche, `and or not`, `in`, `x if c else y`, `.get(key, default)` auf einer Map, `in mapping.keys()` |
| Tests | `defined`, `undefined`, `none`, `number`, `integer`, `float`, `boolean`, `string`, `mapping`, `sequence`, `true`, `false`, `eq`, `ne`, `lt`, `le`, `gt`, `ge`, `in`, `odd`, `even`, `divisibleby` |
| Filter | `float`, `int`, `round`, `bool`, `default`/`d`, `string`, `lower`, `upper`, `capitalize`, `title`, `trim`, `replace`, `truncate`, `abs`, `length`/`count`, `min`, `max`, `tojson`, `to_json`, `from_json`, `is_defined`, `iif` |
| Funktionen | `float()`, `int()`, `bool()`, `iif()`, `min()`, `max()` |

Wo das Format einen Filter anders dokumentiert als das Standard-Jinja, folgt HotLoop dem Format. Der wichtige: **`float` und `int` ohne Standardwert schlagen fehl**, wenn etwas keine Zahl ist. Standard-Jinja liefert stillschweigend `0`, und das ist die Null, die sagt, der Tank sei leer, wenn der Sensor aufgehört hat zu antworten.

Werte werden so dargestellt, wie es Pythons `str()` tut, weil dagegen die Konfigurationen jedes Publishers geschrieben wurden: `True`, `None`, `21.0` bleibt `21.0`. Das ist nicht kosmetisch. Zigbee2MQTTs Kontaktsensor kündigt `payload_on: false` an und passt auf das dargestellte `False`.

**Ein fehlender Schlüssel ist ein Fehler, außer er wurde behandelt.** `{{ value_json.temperature }}` bei einer Nutzlast ohne ihn ist ein schlechter Messwert, der das sagt, kein leerer String. `default`, `is defined` und ein bloßes `{% if value_json.x %}` behandeln ihn absichtlich und sind in Ordnung.

**Außerhalb der Teilmenge wird abgelehnt, wenn die Konfiguration eintrifft**, mit Stelle: „value template not supported: filter `regex_findall_index` is not supported at column 12“. Die Komponente wird trotzdem angelegt, damit man sieht, dass es sie gibt, und sie liest mit dieser Begründung schlecht. Es gibt kein bestmögliches Teil-Rendering und kein „stattdessen die Rohnutzlast verwenden“. Zwei echte Templates werden absichtlich abgelehnt: `now()` (ein Wert, der davon abhängt, wann HotLoop ihn ausgewertet hat, ist kein Messwert des Geräts), und ein Zigbee2MQTT-Ereignis-Template, das Regex-Muster mit Namensräumen und `regex_findall` baut.

Grenzen: 4 KiB Template, Verschachtelung 32 tief, 64 KiB Ausgabe, 64-Bit-Ganzzahlen (ein Überlauf ist ein Fehler, kein Umbruch).

Die eigenen Filter des Formats, die kein Standard-Jinja sind, haben handgeschriebene Fälle, die das dokumentierte Verhalten zitieren, auf das uns jeder festlegt. Jedes Template in den Aufzeichnungen muss sich parsen lassen.

## Was HotLoop woraus baut

| Komponente | Tag | Entitäten |
|---|---|---|
| `sensor` | `float`, wenn er eine Einheit, eine Zustandsklasse oder eine numerische Geräteklasse hat, sonst `string` | sensor |
| `binary_sensor` | `bool` | binary_sensor |
| `switch` | `bool` | binary_sensor und eine switch-Steuer-Entität, nicht scharf |
| `number` | `float`, mit `min`/`max` der Konfiguration als Bereich des Tags | sensor und eine number-Steuer-Entität, nicht scharf, mit Minimum, Maximum und Schrittweite |
| `text` | `string` | sensor und eine text-Steuer-Entität, nicht scharf |
| `select` | `string`, das nur eine seiner Optionen liest | sensor und ein select mit den Optionen der Konfiguration, nicht scharf |
| `button` | `string`, das einen Druck annimmt und nichts liest | eine einmalige Taste, nicht scharf (die eigene Lese-Entität des Tags wird versteckt angelegt) |
| `light` | `bool` an/aus; `float` Helligkeit 0 bis 100 %, wenn es eine hat | ein Licht, nicht scharf |
| `cover` | `string`-Zustand, der auch `open`, `close` und `stop` annimmt; `float` Position 0 bis 100 %, wenn es eine hat | eine Abdeckung, nicht scharf |
| `valve` | `string`-Zustand; `float` Position 0 bis 100 %, wenn es eine meldet; `bool`-Befehl (öffnen oder schließen) und `bool`-Stopp, befohlen und nie gelesen | ein Ventil, nicht scharf, sein Stopp einmalig |
| `event` | `string`, der Ereignistyp | ein Ereignis |
| `device_automation` (ein Auslöser) | `string`, `<type>_<subtype>`, wenn seine Nutzlast eintrifft | ein Ereignis, eines je Auslöser |
| `lock` | `string`, in seinen eigenen Worten gelesen und `lock`, `unlock`, `open` annehmend | ein Schloss, nicht scharf |
| `fan` | `bool` an/aus; `float` Geschwindigkeit 0 bis 100 %; `string` Preset und Richtung; `bool` Oszillation, jeweils wenn vorhanden | ein Lüfter, nicht scharf |
| `siren` | `bool` | eine Sirene, nicht scharf |
| `scene` | `bool`, ein Druck | eine einmalige Taste, nicht scharf |
| `notify` | `string`, eine Nachricht, befohlen und nie gelesen | ein Benachrichtiger, nicht scharf |
| `update` | `string` der installierten und der neuesten Version | ein Update: an, wenn sie sich unterscheiden. Sein Installationsbefehl wird nie gesendet |
| `device_tracker` | `string`, `home`, `not_home` oder eine Zone | ein Tracker |
| `tag` | `string`, die ID des Tags, wenn eines gescannt wird | ein Ereignis |
| `climate` | `string` Modus; `float` Sollwert, unterer und oberer Sollwert und Feuchtesollwert, jeweils mit `min_temp`/`max_temp` der Konfiguration (oder `min_humidity`/`max_humidity`) als Bereich; `float` Raumtemperatur und -feuchte; `string` Lüfter-, Schwenk- und Preset-Modi und Aktion; `bool` Ein/Aus, befohlen und nie gelesen; jeweils wenn vorhanden | ein Thermostat, nicht scharf |
| `humidifier` | `bool` an/aus; `float` Feuchtesollwert in seinem Bereich; `string` Modus und Aktion; `float` Raumfeuchte | ein Luftbefeuchter, nicht scharf |
| `water_heater` | `string` Modus; `float` Sollwert in seinem Bereich und aktuelle Temperatur; `bool` Ein/Aus, befohlen und nie gelesen | ein Warmwasserbereiter, nicht scharf |
| `alarm_control_panel` | `string`-Zustand, in den Worten des Formats gelesen und die Aktionen annehmend, die sein `supported_features` aufführt, jede mit eigener Nutzlast | ein Alarmpanel, nicht scharf |
| `vacuum` | `string`-Zustand, die Aktionen annehmend, die sein `supported_features` aufführt; `float` Batterie; `string` Lüftergeschwindigkeit, jeweils aus seinem JSON-Zustand | ein Staubsauger, nicht scharf |
| `lawn_mower` | `string` Aktivität; `bool` Mähen starten, Pause und Andocken, jeweils ein Druck auf einem eigenen Topic, befohlen und nie gelesen | ein Mäher, nicht scharf |
| `camera` | `string`, ein kurzer Hash des neuesten Bildes; das Bild selbst wird im Speicher gehalten | eine Kamera |
| `image` | dasselbe, für ein Bild auf `image_topic`; oder `string`, die URL aus `url_topic` | ein Bild |

Für ein Licht, eine Abdeckung, ein Ventil, ein Ereignis, einen Auslöser und jede Komponente in den Zeilen danach werden die eigenen Lese-Entitäten der Tags versteckt angelegt: die Sache ist auf den Bildschirmen eine einzige Entität. Jeder Tag wird weiterhin einzeln scharf geschaltet, eine Abdeckung, deren Position Sie vertrauen und deren Öffnen und Schließen nicht, kann also genau das sein. Etwas, das nach der Annahme einen Wert gewinnt (eine Firmware, die anfängt, eine Helligkeit zu melden), ist eine Änderung zur Prüfung, und wenn eine Person sie übernimmt, bekommt die Entität die Rolle zusammen mit dem Tag.

Die Zustandsnachrichten eines Lichts mit JSON-Schema werden zusammengeführt, weil das Schema sendet, was sich geändert hat: eine Nachricht nur mit einer Helligkeit oder Zigbee2MQTTs `last_seen` allein lässt das Licht an. Seine Farbe, Farbtemperatur und sein Effekt werden als Attribute gezeigt, nicht befohlen; An, Aus und Helligkeit werden befohlen, und die Bildschirmseite Erkannt sagt das für ein Licht mit Farbe. Die Farb-Topics eines Lichts mit Standardschema sind genauso: nicht gelesen, nicht befohlen und aufgelistet. Das Template-Schema wird nicht unterstützt und sagt das. Die Neigung einer Abdeckung wird weder gelesen noch befohlen, und sagt das.

Ein Geräte-Auslöser feuert nur auf seine eigene `payload`: Zigbee2MQTT legt jede Aktion einer Taste auf ein Topic, und jeder Auslöser ist eine davon. Ein Auslöser ohne `payload` feuert auf alles auf seinem Topic.

Die Geschwindigkeit eines Lüfters wird auf dem eigenen `speed_range_min`..`speed_range_max` der Konfiguration gelesen, wie es das Format tut: der erste Schritt über Aus ist das erste Prozent. Ein Pegel, den die Konfiguration für unmöglich erklärt (ein ESPHome-Lüfter, der vier Stufen ankündigt und 25 meldet), ist ein schlechter Messwert, der das sagt, nicht 625 Prozent.

Die Bildschirmseite Erkannt listet jedes Topic, an das die Befehle einer Komponente gehen können: das Helligkeits-Topic eines Lichts, das Geschwindigkeits-Topic eines Lüfters, zusätzlich zum Haupt-Topic, und markiert jedes, das außerhalb dessen liegt, was die Komponente liest, innerhalb des Präfixes oder von einem anderen Gerät beansprucht wird.

Der Sollwertbereich eines Thermostats oder Warmwasserbereiters ist der der Konfiguration, und der Standard des Formats, wenn sie keinen angibt (7 bis 35 °C für einen Thermostat, 43,3 bis 60 °C für einen Warmwasserbereiter, in °F, wenn die Konfiguration `temperature_unit: F` sagt). Es ist der Bereich des Tags, das Gate lehnt also 31 °C für ein Heizkörperventil ab, das bei 30 endet, bevor irgendetwas gesendet wird. Seine Modi sind die Liste der Konfiguration, und ein Modus, den sie nicht aufführt, wird genauso abgelehnt. Die Bildschirme bieten genau diese an, und wenn eine übernommene Änderung einen neuen Modus mitbringt, bekommen ihn die Bildschirme auch.

Der `code` eines Alarmpanels ist das, was der Bildschirm eines Verbrauchers verlangt, bevor er etwas sendet. In HotLoop ist es Sache des Gates, wer scharf oder unscharf schalten darf, mit dem von einer Person scharf geschalteten Tag und jedem protokollierten Befehl, die Aktion geht also so hinaus, wie die Konfiguration es sagt. Ein Panel, dessen Befehls-Template den Code selbst will (`{{ code }}`), kann nicht befohlen werden: HotLoop hat keinen Code, den es dort einsetzen könnte, und die Bildschirmseite Erkannt sagt das. Das `send_command_topic` eines Staubsaugers wird nicht benutzt: ein beliebiger Befehl ist genau das, was HotLoop nicht gegen die Konfiguration prüfen kann.

Das Bild einer Kamera oder eines image wird im Speicher gehalten, das neueste je Komponente, bis 4 MiB, und über `GET /api/entities/{entity_id}/image` ausgeliefert. HotLoop behält es nur, wenn die Bytes ein JPEG, PNG, GIF oder WebP sind, was auch immer der `content_type` der Konfiguration behauptet: ein SVG ist ein Dokument, das Skript ausführt, und ein „Bild“, das Skript bei jedem ausführt, der das Dashboard öffnet, ist ein Loch. Sein Tag hält einen kurzen Hash, sodass der Verlauf sagt, wann sich das Bild geändert hat, ohne eine Datenbank voller JPEGs. Ein per URL angekündigtes Bild ist ein Link: HotLoop zeigt ihn, nur wenn er http oder https ist, und lädt ihn nie, weil ein Server, der jede Adresse lädt, die ein Gerät nennt, auf alles im Netzwerk gerichtet werden kann. Keines wird im Logbuch protokolliert; eine Kamera ändert sich jede Sekunde, und tag_history hat bereits jede Änderung.

Jede Komponente, die das Format definiert, wird zu etwas. Eine Komponente, die es nicht definiert (ein `kettle`), wird mit dem gespeichert, was sie angekündigt hat, und als nichts erzeugend aufgelistet. Das Format hat keine Datums-, Zeit- oder Datetime-Komponente, diese Liste also auch nicht.

Entitäts-IDs sind die von HotLoop, aus Gerät und Tag gebildet. Das `object_id` und das `default_entity_id` einer Konfiguration werden ignoriert: eine Konfiguration wählt keinen Namen im Namensraum von HotLoop, und eine feindliche würde `switch.boiler_main` wählen.

## Alles ist nicht vertrauenswürdig

Alles, was eine Konfiguration sagt, stammt von dem, der auf dem Präfix veröffentlichen kann. Deshalb:

- Namen und Texte werden gekappt und von Steuerzeichen befreit, und der Bildschirm setzt sie als Text auf die Seite, nie als HTML;
- ein Topic mit Platzhalter, ein `$`-Topic oder ein `~` ohne Basis, die man einsetzen könnte, wird mit Begründung abgelehnt;
- eine Konfiguration über 64 KiB wird abgelehnt; ein Gerät kann nicht mehr als 512 Komponenten haben; nicht mehr als 256 Geräte können an einem Broker auf eine Entscheidung warten; Konfigurationsnachrichten über 200 pro Sekunde werden verworfen und gezählt. Jede Ablehnung wird gezählt und auf der Bildschirmseite Erkannt angezeigt, nie wortlos verworfen;
- HotLoop abonniert `<prefix>/+/+/config` und `<prefix>/+/+/+/config`, nie `#` unter dem Präfix, sodass ein verirrtes tiefes Topic es nichts parsen lassen kann;
- eine Zustandsnutzlast über 256 KiB oder eine, die kein UTF-8 ist, ist ein schlechter Messwert.

Bei erlaubten anonymen Verbindungen am eingebetteten Broker kann jeder im Netzwerk Geräte ankündigen und auf jedes Befehls-Topic veröffentlichen, und die Bildschirmseite Erkannt sagt das in Rot. Geben Sie jedem Gerät seinen eigenen Zugang, in HotLoop aus seinem Profil erstellt und nach seinem Topic benannt ([Der eingebettete MQTT-Broker](/de/iot/broker/)): dann kann es sich ankündigen und sonst nichts, und es kann das Befehls-Topic eines anderen Geräts nicht berühren.

## Die Broker-Seite

Die Erkennung läuft am eingebetteten Broker (siehe [den eingebetteten MQTT-Broker](/de/iot/broker/)), standardmäßig an, wann immer der Broker an ist. HotLoops eigener Client meldet sich mit einem Zugang an, der bei jedem Start erzeugt und nur im Speicher gehalten wird: es gibt nichts zu konfigurieren und nichts in einem Backup, das durchsickern könnte. Er veröffentlicht eine einzige eigene Sache, die Geburtsnachricht (`<prefix>/status` = `online`), die Publisher, die darauf hören, sich erneut ankündigen lässt.

| Variable | Standard | <span class="sr-only">Details</span> |
|---|---|---|
| `HOTLOOP_BROKER_DISCOVERY` | `true` | Auf Ankündigungen am eingebetteten Broker hören |
| `HOTLOOP_BROKER_DISCOVERY_PREFIX` | `homeassistant` | Das Topic-Präfix, unter dem sie eintreffen |

Ein Client je Broker, `hotloop-disc-embedded`, geteilt vom Listener und vom Treiber jedes erkannten Geräts. Ein `--mcp-stdio`-Helfer öffnet keinen: ein zweiter Client mit derselben ID würde den des Gateways alle paar Sekunden vom Broker werfen. Bei mehreren Replikas auf einer Datenbank hört nur die zu, die die Erkennungssperre hält.

## Andere Broker

Viele Anlagen betreiben schon einen Broker: einen Mosquitto, der die UNS ist, den, den eine Zigbee2MQTT-Box mitgebracht hat. HotLoop hört auch auf diese. Einstellungen, MQTT, Broker hinzufügen: eine ID (sie benennt den Broker in jedem Gerät, das von ihm kam), wo er ist, ein Zugang und das Präfix, unter dem seine Publisher ankündigen. Der Broker muss nicht an sein, und HotLoop braucht dafür nicht den eingebetteten.

Drei Dinge sind anders als bei HotLoops eigenem Broker, mit Absicht:

- **Geräte warten im Posteingang.** An einem betriebsamen Anlagen-Broker heißt „von selbst erscheinen“ dreihundert Geräte auf dem Bildschirm vor dem Mittagessen. Ein angekündigtes Gerät wird also auf der Bildschirmseite Erkannt aufgelistet, ohne etwas anzulegen und ohne zu lesen, bis jemand es annimmt. Dann wird es angelegt, es liest, und seine Punkte lassen sich wie jeder andere scharf schalten. Ein Broker, dem Sie zutrauen, alles bei Ihnen abzuladen, lässt sich auf „Geräte erscheinen von selbst“ umstellen.
- **Kein Last Will.** HotLoop verbindet sich ohne einen. Ein `offline`-Will an einem gemeinsamen Broker würde jedem anderen Publisher darauf sagen, dass etwas verschwunden ist, obwohl es nur HotLoop war. Die Tests prüfen das CONNECT-Paket selbst und ziehen der Verbindung den Stecker, um zu beweisen, dass nichts gesagt wird.
- **Seine ACLs sind seine eigenen.** HotLoop kann am Broker eines anderen nicht sehen, wer was veröffentlicht hat, daher gibt es dort kein „angekündigt von Zugang“, und was jeder Zugang berühren darf, ist Sache dieses Brokers. Geben Sie HotLoop einen Zugang, der das Präfix und die Topics der von Ihnen angenommenen Geräte liest und die Geburtsnachricht und die Befehls-Topics schreibt, sonst nichts. Für Mosquitto:

  ```
  user hotloop
  topic read homeassistant/+/+/config
  topic read homeassistant/+/+/+/config
  topic write homeassistant/status
  # the devices you accept, for example a Zigbee2MQTT bridge:
  topic read zigbee2mqtt/#
  topic write zigbee2mqtt/+/set
  ```

**Nur Mithören** ist für einen Broker, auf dem HotLoop nicht sprechen darf: die Produktions-UNS, die Anlage eines anderen. HotLoop veröffentlicht dort nie etwas. Keine Geburtsnachricht, kein Befehl. Das ist die Regel der Sitzung, nicht des Bildschirms: ihr Veröffentlichen wird abgelehnt, und das Schreib-Gate lehnt jeden Befehl an ihre Geräte mit „the broker plant-uns is listen-only“ ab, Probelauf eingeschlossen, auch an einem Gerät, das jemand angenommen hat, und einem Punkt, den jemand scharf geschaltet hat. Sein Zugang braucht nichts als `topic read`-Zeilen.

Das Passwort wird mit dem Geräte-Zugangsdaten-Schlüssel (`HOTLOOP_SECRET_KEY_FILE`) versiegelt, wie das einer UniFi-Konsole, und kommt nie wieder aus der API heraus. Ohne Schlüssel wird ein Broker mit Passwort abgelehnt, nicht im Klartext gespeichert. Ein Backup trägt es versiegelt und stellt es unter derselben Regel wieder her wie die Zugangsdaten eines Geräts ([Backups und Wiederherstellung](/de/iot/backup/)). Ein Broker, dessen Passwort sich nicht öffnen lässt, wird aufgelistet, nicht verbunden, und sagt, warum.

Ändern Sie einen Broker, und der Listener und jedes Gerät von ihm verbinden sich mit den neuen Einstellungen neu. Schalten Sie einen aus, und seine Geräte bleiben, lesen schlecht und sagen, dass ihr Broker hier nicht läuft. Einen zu entfernen nimmt den Posteingang mit und wird abgelehnt, mit Nennung der Geräte, solange von ihm angenommene Geräte noch existieren.

## An einem Edge Relay

Ein Edge Relay erkennt auch, mit demselben Code, hat aber keine Datenbank, in der es eine Entscheidung halten könnte, und keinen Bildschirm, auf dem man eine treffen könnte. Es nimmt also, was es hört, liest es und leitet es über Sparkplug weiter, und nichts, was es findet, lässt sich scharf schalten: seine Tags sind wie jeder erkannte Tag schreibgeschützt, seine Geräte werden nie angenommen, und das Relay hat gar keinen Schreibpfad. Benennen Sie die Broker in seiner Geräte-Datei; siehe die [Edge-Relay-Referenz](/de/edge-relay/reference/#discovery-41810). Ein Gerät, das Sie befehlen können, kommt von der anderen Seite dorthin: angenommen und scharf geschaltet an einem Gateway, in einer Datei, die dieses pusht. Es vergisst, was es gehört hat, wenn es stoppt, und hört es vom Broker erneut.

## Neustarts und Wiederholungen

Angenommene Geräte laufen aus ihren Gerätezeilen. HotLoop braucht keine einzige retained Nachricht, um mit seiner Anlage wieder hochzukommen.

Der eingebettete Broker behält nach einem Neustart nichts, jede Konfiguration „fehlt“ also danach. **Eine fehlende Konfiguration ist kein Rückzug**: nur eine ausdrücklich leere ist es. Alles andere würde jedes Mal die ganze Anlage zurückziehen, wenn die Box neu startet. Bis ein Gerät seinen nächsten Zustand sendet, lesen seine Entitäten unbekannt, nie den Wert von vor dem Neustart als aktuell verkleidet.

Ein Broker, der Hunderte retained Konfigurationen auf einmal wiederholt, ist ein einziger Stapel: zwei Sekunden Ruhe, ein Durchgang, ein Neuladen. Eine Wiederholung dessen, was schon vorliegt, ändert nichts und lädt nichts neu.

## Backups

`mqtt_devices` (wer was angenommen und ignoriert hat), `mqtt_configs` (jede Konfiguration, wie sie eintraf, Byte für Byte) und `mqtt_discovered` (jede Komponente, normalisiert) sind in jedem Backup. Die Entscheidungen sind der Teil, den kein Gerät zurückmelden kann.

## Die API

Unter `/api/discovery`. Siehe [die HTTP-API](/de/iot/api/#mqtt-erkennung).

## Im Netzwerk gefunden

Dieselbe Bildschirmseite listet Geräte, die HotLoop im Anlagennetz über mDNS, SSDP und DHCP gehört hat, auf dieselbe Weise entschieden. Siehe [Netzwerkerkennung](/de/iot/network-discovery/).
