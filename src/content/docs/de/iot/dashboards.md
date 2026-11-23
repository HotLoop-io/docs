---
title: "Dashboards nach Rolle"
description: "Seiten aus Karten pro Rolle oder Bildschirm: Anzeigen, Trends, Entitätenlisten und Tasten, mit demselben Layout auf Panel-PC, Laptop und Telefon."
---

Ein Dashboard ist eine Seite aus Karten, die jemand gebaut hat. Anzeigen, Trends, Listen von Entitäten, eine Taste, die die Pumpe startet, ein Hallenplan, auf dem die Temperaturen dort sitzen, wo die Zonen sind. Bauen Sie so viele, wie das Werk braucht, geben Sie jedes den Rollen, die es brauchen, oder dem einen Bildschirm, auf dem es lebt, und das alte Board ist nur eines davon.

Es ist in HotLoop IoT, Edge und Gateway. Das Edge Relay hat keine Oberfläche und keine Dashboards. Die Edge-HMI ist aus dieser Seite gebaut und aus nichts sonst, und das ist der Grund, warum der Rest so ist, wie er ist.

## Warum es so gebaut ist

**Eine Karte steuert nichts.** Die erste Entwurfsfrage für jede Seite mit Tasten ist, ob die Seite ein zweiter Weg ist, das Werk zu fahren. Das ist sie nicht. Eine Karte nennt ein Tag, eine Entität, ein Skript oder ein Rezept, und der Browser macht damit, was jeder andere Bildschirm damit macht. Eine Schreibtaste sendet `POST /api/write`. Die Bedienelemente einer Entität rufen `POST /api/services` auf. Eine Skripttaste öffnet die Startabfrage des Bildschirms Skripte, und eine Rezeptkarte öffnet die Anwenden-Schublade des Bildschirms Rezepte. Jede davon hat ihr eigenes Recht und trifft auf das Schreib-Gate, sodass auch ein Dashboard kein Weg daran vorbei sein kann. Was `dashboards.write` schützt, ist, wer entscheidet, was die Tasten sind, was eine Entscheidung des Ingenieurs ist und aus demselben Grund nur dem Administrator vorbehalten ist wie das Schreiben eines Skripts.

Die Folge: Ein von einem Administrator gespeichertes Dashboard tut nichts, bis ein Bediener etwas drückt, und was das Drücken bewirkt, ist genau das, was das Drücken auf jedem anderen Bildschirm bewirkt, bis hinunter zur Protokollzeile.

**Ein Layout ist ein Fluss, keine Koordinaten.** Karten stehen in Leserichtung. Jede sagt, wie breit sie ist, von zwölf Spalten, und wie hoch in Zeilen, und weiß nichts darüber, wo sie landet. Zwölf Spalten auf einem Panel-PC, sechs auf einem Laptop mit einem weiteren Fenster daneben, zwei auf einem Tablet, eine auf einem Telefon. Ein Layout aus Pixelpositionen ist genau auf dem Bildschirm richtig, auf dem es gezeichnet wurde, und die Edge-HMI muss auf jedem Bildschirm richtig sein, den die Maschine hat.

Die Folge: Niemand baut je die Telefonversion. Es gibt keine.

**Speichern nennt die Version.** Dass zwei Personen ein Dashboard bearbeiten, passiert beim Schichtwechsel. Ein Speichern trägt die `version`, bei der es geöffnet wurde, und ein veraltetes wird mit einem `409` abgelehnt, das sagt, wer zuerst da war. Ohne das löscht die zweite Person, die Speichern drückt, den Nachmittag der ersten, ohne dass es einer von beiden sieht.

## Das Modell

```json
{
  "id": "line-2",
  "name": "Line 2",
  "description": "The extruder, for the floor.",
  "kind": "cards",
  "roles": ["operator", "admin"],
  "homeFor": ["operator"],
  "screens": ["line-2-panel"],
  "position": 1,
  "version": 3,
  "cards": [
    {"id": "temp", "type": "gauge", "title": "Zone 1", "w": 3, "h": 3,
     "config": {"tag": "press-01/Zone1_Temp"}},
    {"id": "go", "type": "button", "w": 3, "h": 1,
     "config": {"tag": "line-02/Speed", "value": 250, "label": "Run at 250", "confirm": true}}
  ]
}
```

- **`id`** besteht aus Kleinbuchstaben, Ziffern, Bindestrichen und Unterstrichen und beginnt mit einem Buchstaben. Sie steht in der Adresse und ändert sich nie. `wall` ist die der Wandtafel.
- **`kind`** ist `cards` oder `wall` für die Wandtafel.
- **`roles`** sind die Rollen, denen das Dashboard angeboten wird. Leer heißt alle Rollen. Wer `dashboards.write` hat, sieht jedes Dashboard, was auch immer es sagt, weil er das reparieren können muss, das sonst niemand öffnen kann. Eine Rolle, der keines angeboten wird, bekommt dafür unter seinem Namen ein `404`, sodass die Liste dessen, was existiert, nichts ist, was ein Betrachter durch Fragen erfahren kann.
- **`homeFor`** sind die Rollen, für die es sich öffnet, wenn sie ohne eine Adresse kommen, die irgendetwas verlangt. Eine Rolle hat höchstens eines; das Dashboard muss den Rollen angeboten werden, für die es die Startseite ist.
- **`screens`** sind die physischen Bildschirme, für die es gedacht ist. Ein Bildschirmname gehört zu einem Dashboard.
- **`position`** ordnet die Umschaltleiste. Neue kommen ans Ende.
- **`cards`** stehen in Leserichtung, bis zu 60 pro Dashboard, 2 MB für alle zusammen.
- **`version`** steigt bei jedem Speichern um eins.

Eine Karte ist `id` (eindeutig in ihrem Dashboard, von der Seite erzeugt), `type`, ein optionaler `title`, `w` (1 bis 12) und `h` (1 bis 8) und eine `config`, die vom Typ abhängt. Lassen Sie `w` und `h` weg, wird der Standard des Typs verwendet. Eine Config wird streng geprüft: Ein Schlüssel, den der Typ nicht hat, ist ein Fehler, und was gespeichert wird, hat jeden Standardwert ausgefüllt. Eine Karte, die ein Tag, eine Entität, ein Skript oder ein Rezept nennt, das nicht existiert, wird beim Speichern des Dashboards abgelehnt. Eine Taste auf einem Tag, das nicht als beschreibbar markiert ist, oder eine Taste, deren Zahl außerhalb des Bereichs des Tags liegt, wird ebenfalls abgelehnt: Das Gate würde jedes Drücken ablehnen, und die Person, die sie baut, soll das hören und nicht die Person, die drückt.

## Die Karten

| Typ | Was es ist | Config | Standardgröße |
|---|---|---|---|
| `status` | Geräte oben, Tags, die melden, Alarme, Historian, Laufzeit: der Streifen des Boards | keine | 12 x 1 |
| `gauge` | Ein Tag als das Zifferblatt des Boards, mit markiertem Bereich und markierten Alarmgrenzen | `tag` | 3 x 3 |
| `value` | Ein Tag als große Zahl, eingefärbt nach seinem Alarmzustand | `tag`, `decimals` | 3 x 2 |
| `trend` | Bis zu sechs Tags über 15 Minuten bis eine Woche | `tags`, `minutes`, `labels` | 6 x 3 |
| `entities` | Die Entitäten, die Sie auswählen, als eigene Kacheln mit eigenen Bedienelementen | `entities` (bis zu 30) | 6 x 3 |
| `alarms` | Die Alarmliste, mit Quittieren für den, der darf | `outstanding`, `limit`, `devices`, `equipment` | 6 x 3 |
| `button` | Schreibt einen Wert in ein Tag, nach Rückfrage | `tag`, `value`, `label`, `confirm` | 3 x 1 |
| `script` | Führt ein Skript über die Abfrage des Bildschirms Skripte aus | `script`, `label` | 3 x 1 |
| `recipe` | Wählt eines von bis zu acht Rezepten und öffnet seine Anwenden-Schublade | `recipes` | 4 x 2 |
| `markdown` | Text: Überschriften, Listen, fett, kursiv, Code, http(s)-Links | `text` | 4 x 2 |
| `camera` | Ein Standbild, das sich aktualisiert, oder ein Motion-JPEG-Strom | `url`, `stream`, `refreshSec` | 6 x 4 |
| `map` | Ein Hallenplan mit darauf platzierten Live-Tags | `image`, `markers` | 6 x 5 |
| `setpoint` | Eine für ein Tag eingegebene Zahl, mit Grenzen, einer Einheit und einer Bestätigung, und was das Gerät zurückmeldet | `tag`, `label`, `min`, `max`, `step`, `unit`, `decimals`, `confirm` | 3 x 3 |
| `symbols` | Ein Bild einer Maschine oder eines Prozesses: Symbole, pixelgenau auf einem Hintergrund platziert, durch Rohrleitungen verbunden, aus ihren Tags gezeichnet | `image`, `width`, `height`, `symbols`, `pipes`, `view` | 8 x 5 |

Was man über die nicht offensichtlichen wissen sollte:

- **`button`** sendet `value` als den Typ, als der es gespeichert wurde. Eine Zahl ist eine Zahl, `true` ist ein Boolean, eine Zeichenfolge ist Text. `1` und `1.0` sind auf einer SPS verschiedene Schreibzugriffe, und das Gate entscheidet nach dem JSON-Typ, deshalb macht die Karte nicht das eine zum anderen. `confirm` ist an, solange es nicht ausgeschaltet wird, und dann fragt es „das steuert echte Anlagen“ mit dem aktuellen Wert und einem Grund, der in den Prüfpfad geht (`dashboard <id> / <card>`, wenn er leer bleibt). Es auszuschalten ist für ein Panel, bei dem das Halten der Taste der Zweck ist; es ist eine Entscheidung des Ingenieurs, und „Vor dem Schreiben bestätigen“ der Einstellungen schaltet es wieder ein.
- **`alarms`** listet die Alarme des ganzen Werks, es sei denn, Sie richten sie anderswohin. `devices` ist eine Liste von Geräte-IDs. `equipment` ist eine Liste von Anlagenknoten-IDs aus `GET /api/equipment`, jeder Ebene (ein Standort, ein Bereich, eine Linie, eine Zelle), und ein Knoten steht für jedes Gerät, das an oder unter ihm platziert ist, sodass die Seite eines Bereichs die Alarme des Bereichs zeigen kann und die von sonst niemandem. Mit beiden wird ein Alarm gelistet, wenn er auf einem von beiden liegt. Lassen Sie sie weg oder leer, und die Karte ist das ganze Werk, was jede vor diesen Feldern gespeicherte Karte tat. Das Limit zählt, was nach dem Filter übrig ist, und `outstanding` lässt weiterhin weg, was wieder normal und quittiert ist. Eine Karte, die auf einen Ort ohne Alarme beschränkt ist, sagt „hier“, damit niemand sie als ruhiges Werk liest, und eine Karte, deren Anlage inzwischen gelöscht wurde, sagt das, statt eine leere Liste zu zeigen. Die Anlage wird als ID des Knotens gespeichert, sodass das Umbenennen oder Verschieben eines Knotens die Karte nicht kaputt macht. Das Dashboard wird beim Speichern abgelehnt, wenn ein Gerät oder ein Knoten nicht da ist. Im Editor tippen Sie den Pfad (`Plant 2 / Scrubbers / Kettle 3`), und er behält die ID. Diese Karte liest den Baum, deshalb braucht eine Rolle `equipment.read` (Bediener und Betrachter haben es).

  ```json
  {
    "id": "kettle-alarms", "type": "alarms", "title": "Scrubber alarms", "w": 6, "h": 3,
    "config": { "outstanding": true, "limit": 10, "equipment": [14], "devices": ["oven-1"] }
  }
  ```
- **`trend`** zeichnet das Fenster, das Sie verlangt haben, endend jetzt, und nicht nur die Spanne, die die Messwerte zufällig abgedeckt haben: `minutes: 480` ist eine Achse der letzten acht Stunden mit einem Strich bei jeder vollen Stunde, in der Zeitzone dessen, der schaut. Ein Tag, das sich nicht bewegt hat, ist eine flache Linie bei seinem letzten guten Messwert, weil so eine stehende Mühle oder ein geschlossenes Ventil aussieht, und der Historian hält einen Messwert nur, wenn ein Wert seine Totzone verlässt, sodass es im Fenster einen Messwert geben kann oder keinen. Nichts auf der Linie ist erfunden. Was das Tag hielt, als das Fenster begann, ist sein letzter guter Messwert davor (`GET /api/history` sagt es mit `carry=true`), und die Linie ist dieser Wert vom Fensteranfang bis zum ersten Messwert darin. Nach dem letzten Messwert wird sie bis zum letzten Mal gehalten, an dem vom Tag zu hören war, nie über jetzt hinaus. Vor dem ersten Messwert, den jemand hat, gibt es keine Linie, und ein Tag, dessen letzter Messwert vor dem Fenster schlecht war, hat gar keinen Übertrag, weil nicht bekannt ist, was es hielt. Eine Strecke schlechter Messwerte ist eine Lücke, wie sie es immer war. Ein einzelner Messwert ist eine Linie bis jetzt oder ein Punkt, wenn es keinen Platz gibt, sie dorthin zu zeichnen.

  Die Legende benennt jede Linie mit dem eigenen Namen des Tags, demselben Namen, den die Zahlenkarte zeigt, ohne das Gerät davor. Zwei Linien mit demselben Namen von verschiedenen Geräten behalten ihre vollständigen IDs, damit Sie sie unterscheiden können. `labels` ist ein optionales Objekt von einem Tag in `tags` zum Text, den Sie stattdessen wollen, 1 bis 80 Zeichen, und eine Beschriftung für ein Tag, das nicht gezeichnet wird, wird abgelehnt. Der Hover-Hinweis hat neben der Beschriftung immer die vollständige ID.

  ```json
  {
    "id": "mills", "type": "trend", "title": "Mill temperatures", "w": 6, "h": 3,
    "config": {
      "tags": ["plant-5-temperatures/Large Sand Mill Temperature", "plant-5-temperatures/Small Sand Mill Temperature"],
      "minutes": 480,
      "labels": { "plant-5-temperatures/Large Sand Mill Temperature": "Large mill" }
    }
  }
  ```
- **`camera`** lädt die Adresse im Browser, nicht auf dem Server. Die Config einer Karte ist für jede Rolle lesbar, die das Dashboard öffnet, deshalb wird eine Adresse mit einem Login oder einem Token darin beim Speichern des Dashboards abgelehnt. Verwenden Sie eine Adresse im Werksnetz, die keines braucht, oder einen Proxy, der das Login hinzufügt. Ein Standbild wird alle `refreshSec` Sekunden mit einem Abfrageparameter `_hl` neu geholt, damit der Browser nicht für immer das erste zeigt.
- **`map`** ist ein Bild und Markierungen. Das Bild ist eine http(s)-Adresse oder eines, das in die Karte hochgeladen wurde (png, jpeg, webp oder gif, bis 500 KB, in der Karte gespeichert). Markierungen sind Tags, platziert in Prozent von Breite und Höhe des Bildes, sodass sie in jeder Größe dort bleiben, wo sie hingesetzt wurden. Das ist ein Hallenplan, keine Straßenkarte: Eine Kachelkarte braucht einen Kachelserver im Internet, und den Panel-PC eines Werks erreicht normalerweise keiner.
- **`setpoint`** ist für eine Zahl, die jemand tippt: eine Temperatur, eine Drehzahl, ein Füllstand. Das Feld kennt die Einheit des Tags (oder die `unit` der Karte) und seine Grenzen: `min` und `max` zusammen oder den eigenen Bereich des Tags, wenn die Karte keine angibt. Eine Karte kann den Bereich des Tags nur verengen, nie erweitern, weil das Schreib-Gate einen Wert außerhalb des Bereichs des Tags ablehnt, was auch immer eine Karte sagt; eine Karte, die mehr anbietet, wird beim Speichern des Dashboards abgelehnt, und ebenso eine Karte auf einem Tag, das Text oder einen Schalter hält (nehmen Sie dafür einen `button`). Außerhalb der Grenzen, neben dem `step` oder keine Zahl, sagt die Eingabe das unter dem Feld, und **Setzen** bleibt aus. **Setzen** fragt zuerst, mit dem aktuellen Wert und einem Grund für den Prüfpfad, es sei denn, die Karte wurde mit ausgeschaltetem `confirm` gebaut und die Einstellungen überstimmen es nicht, dann geht es über `POST /api/write`: der Hauptschreibschalter, das Beschreibbar-Kennzeichen des Tags, das Recht der Rolle und die Protokollzeile sind dieselben wie bei jedem anderen Schreibzugriff. Die Karte wartet dann, bis der Messwert des Geräts den Wert zeigt, beobachtet ihn zwei Sekunden länger und sagt, was das Gerät hält: „70 C vom Gerät zurückgelesen: Es ist der gesendete Wert“; oder, wenn die SPS den Schreibzugriff annahm und auf ihre eigene Grenze zurückbrachte, „Das Gerät übernahm 70 C und änderte es dann auf 60 C“; oder, wenn der Messwert ihn nie zeigte, „Das Gerät meldet 60 C, nicht 70 C“. Die Zeile „jetzt im Gerät“ ist ständig der Livemesswert, sodass sie auch ein SPS-Programm zeigt, das den Wert später überschreibt. Solange das Gerät keinen guten Messwert hat (eine SPS, die aus oder nicht erreichbar ist), sind das Feld und Setzen aus, und die Karte sagt, dass das Gerät nicht antwortet, weil ein Schreibzugriff nur abgelehnt werden könnte.
- **`symbols`** ist ein Bild einer Maschine. `width` und `height` sind die eigene Größe der Seite in Pixeln (800 mal 450, wenn weggelassen), `image` ist ein optionaler Hintergrund (eine http(s)-Adresse oder ein in die Karte hochgeladenes Bild, wie bei `map`), und `symbols` ist eine Liste von Dingen, pixelgenau von der linken oberen Ecke aus platziert: `{"id": "p1", "type": "pump", "x": 120, "y": 300, "tag": "plc/bPumpRun"}`. Die Seite wird als ein einziges skaliertes Bild gezeichnet, sodass jedes Symbol bei jeder Kartengröße und auf einem Telefon seinen Platz behält. Die Typen sind `pump`, `motor` und `fan` (sie drehen sich, solange das Tag an ist), `valve` (offen oder zu), `tank` (gefüllt zwischen `min` und `max`, oder dem Bereich des Tags, oder 0 bis 100), `heater` und `lamp` (leuchten, solange an), `pipe` (was darin ist, bewegt sich, solange sein optionales Tag an ist), `readout` (die Zahl, mit `unit` und `decimals`) und `label` (fester Text). `invert` liest ein Tag andersherum, und der `tone` einer Lampe (`ok`, `warn`, `bad` oder `info`) ist die Farbe, in der sie leuchtet: Eine Betriebslampe ist grün und eine Störungslampe rot, und das Tag sagt nur, wann sie leuchtet. Jedes Symbol kann zwei Regeln tragen, die ein Tag lesen. `show` lässt es nur erscheinen, solange die Regel gilt (`"show": {"tag": "plc/bDoorOpen", "op": "off"}`): Solange sie nicht gilt, wird das Symbol nicht gezeichnet, und der Editor zeigt es ausgegraut, damit es sich noch auswählen lässt. `colors` sind bis zu vier Regeln, jede mit einem `tone` (`ok`, `warn`, `bad` oder `info`): Die erste, die gilt, färbt das Symbol in diesem Ton, was auch immer sein eigenes Tag sagt, und wenn keine gilt, wird es gezeichnet wie zuvor. Eine Regel besteht aus `tag`, einem `op` und, für die Vergleiche, die einen brauchen, einem `value`: `on` (das Tag ist nicht 0, der Standard), `off`, `eq`, `ne`, `gt`, `ge`, `lt` und `le`. Eine Regel, deren Tag keinen guten Messwert hat, gilt nicht und blendet nichts aus, sodass eine verlorene Verbindung nie ein Symbol verschwinden lässt. Eine Regel kann stattdessen Regeln kombinieren: `{"all": [...]}` gilt, solange jede davon gilt, und `{"any": [...]}`, solange eine gilt (das AND und OR einer SPS), bis zu drei Ebenen tief und acht Teile, und hat kein eigenes Tag. Ein verlorenes Tag lässt ein `all` nicht gelten, und ein `any` gilt über die anderen hinweg. Eine Lampe kann auch eine `lit`-Regel anstelle ihres Tags tragen, für eine Lampe, die durch einen Vergleich oder eine Kombination leuchtet (`"lit": {"tag": "plc/Mode", "op": "eq", "value": 3}`); dann braucht sie kein Tag. Die Tags der Regeln sind Tags, die der Bildschirm nennt, sodass eine Bildschirmdatei sie auflistet und mit dem Rest bewegt. Ein Symbol sagt seinen Zustand in Worten und in Farbe (eine Beschriftung und ein Titel), wird rot oder warm gezeichnet, wenn sein Tag im Alarm ist oder aus einem zurückgekehrt ist, und wird ausgegraut mit "no reading" gezeichnet, wenn das Tag keinen guten Messwert hat. Bewegung hört auf, wenn die Person ihr System um weniger davon gebeten hat. Die Symbole werden von HotLoop für HotLoop gezeichnet; keines ist geliehen. Ein Symbol mit einem Tag öffnet dieses Tag, wenn man darauf klickt, wie eine Stecknadel auf einem Hallenplan. Es steuert nichts: Stellen Sie dafür eine `setpoint`- oder `button`-Karte daneben. Im Editor wird ein Symbol mit dem Zeiger aufgenommen und bewegt, oder mit den Pfeiltasten (Umschalt bewegt um zehn Pixel), oder bekommt seine Pixel als Zahl.

  **Prozesssymbole und Rohrleitungen.** Eine Symbols-Karte ist auch ein P&ID. Neben den oben genannten Typen platziert sie `controlvalve`, `checkvalve`, `compressor`, `heatexchanger`, `filter`, `vessel`, `flowmeter`, `instrument` (eine ISA-Blase: ihr `label` sind die Buchstaben, und sie zeigt die Zahl ihres Tags), `junction`, `source` und `sink`. Ein Symbol hat `rot` (`90`, `180` oder `270`), um es in Vierteldrehungen um seine Mitte zu drehen; Text dreht sich nicht. Die meisten Symbole haben Anschlusspunkte: bei einer Pumpe `in` und `out`, bei einem Tank `top`, `bottom`, `left-1` bis `left-3` und `right-1` bis `right-3`, bei einem Ventil `w` und `e`, und so weiter. Eine Rohrleitung verbindet zwei davon:

  ```json
  "pipes": [
    { "id": "tank-out", "from": { "symbol": "tank-1", "port": "bottom" },
      "to": { "symbol": "p1", "port": "in" }, "medium": "water", "tag": "plc/Flow" }
  ]
  ```

  Gespeichert wird nur, was verbunden ist. Die Seite berechnet den Verlauf überall dort, wo sie die Rohrleitung zeichnet: rechte Winkel, mit Abstand um jedes Symbol der Seite herum, mit so wenigen Ecken wie möglich, und eine Rohrleitung, die ein Symbol verlässt, verlässt es in die Richtung, in die sein Anschlusspunkt zeigt. Bewegen Sie ein Symbol, und seine Rohrleitungen legen sich neu, während es sich bewegt, im Editor und in einer gespeicherten Datei. Ein T ist ein `junction`-Symbol mit drei Rohrleitungen daran (seine Punkte `n`, `e`, `s` und `w` liegen alle in seiner Mitte), und im Editor teilt das Ablegen einer Rohrleitung auf einer anderen diese Rohrleitung für Sie mit einer Verzweigung. `medium` ist eines von `process` (der Standard), `water`, `wastewater`, `fuel`, `oil`, `air`, `steam`, `gas`, `chemical`, `coolant`, `hydraulic`, `vacuum`, `nitrogen`, `power` oder `signal`. Jedes hat seine Farbe, und signal und power haben zusätzlich ihr eigenes Linienmuster, sodass eine Rohrleitung nie allein an der Farbe unterschieden wird. `tag` (mit `invert`) sagt, wann sich das Medium in der Rohrleitung bewegt, von `from` nach `to`, und `flow` sagt es mit einer Regel, denselben Regeln, die `show` und `colors` eines Symbols verwenden. Eine Rohrleitung mit keinem von beiden wird voll und ruhend gezeichnet. `label` hat bis zu 24 Zeichen entlang der Rohrleitung. Eine Rohrleitung hält ein Tag oder eine Regel, nicht beides. Eine Seite fasst bis zu 120 Symbole und 240 Rohrleitungen.

  **Die Werkzeugleiste.** Jede Symbols-Karte hat, wenn sie angezeigt und wenn sie gebaut wird, oben rechts eine Werkzeugleiste: vergrößern, verkleinern, Seite einpassen, die Minikarte und die Hochleistungsansicht. Gezoomt wird auch mit Strg und dem Mausrad (das Rad allein scrollt weiter das Dashboard), `+`, `-` und `0` auf der Seite; ziehen Sie die Seite, um sie zu verschieben. Sobald vergrößert, zeigt die Minikarte die ganze Seite mit einem Rahmen dort, wo Sie sind, und Drücken oder Ziehen darauf bringt Sie dorthin. Die Hochleistungsansicht ist die graue ISA-101-Seite: graue Anlagen und graue Rohrleitungen, eine dunklere Füllung für laufend oder offen statt Grün, das Medium der Rohrleitung als kurzer Code daneben (W für Wasser, S für Dampf, SIG für Signal) und eine Farbe nur an dem, was im Alarm ist oder von einer Regel gefärbt wird. `view` auf `hp` lässt eine Seite in ihr öffnen; die Werkzeugleiste schaltet für jeden, der schaut, in beide Richtungen um, und dabei wird nichts gespeichert. Der Fluss wird nur animiert, wenn die Person ihr System nicht um weniger Bewegung gebeten hat.
- **`markdown`** wird in DOM-Knoten gebaut und nie in HTML, sodass nichts, was darin getippt wird, zu Markup oder einem Skript werden kann.
- **`gauge`, `value`, `map`, `setpoint`** zeigen „nicht mehr auf diesem Gateway“, wenn ihr Tag gelöscht wird, nachdem das Dashboard gespeichert wurde, statt eines Zifferblatts, das sich nie bewegt.

## Die Wandtafel

Die Wandtafel ist das Dashboard `wall`, Art `wall`. Sie ist immer da, kann nicht gelöscht werden und hat keine Karten: Ihre Anzeigen sind die auf dem Bildschirm Board angehefteten Tags, gehalten in der eigenen Einstellung der Tafel, wo sie schon immer waren. `GET` und `PUT /api/board`, die Adresse `#board`, die Anheft-Auswahl und das Ziehen zum Anordnen sind unberührt.

Was sie davon hat, ein Dashboard zu sein, ist die Umschaltleiste (sie ist die erste Pille auf jedem Dashboard, und das Board hat die Leiste auch) und die Zuweisungen: Sie kann manchen Rollen angeboten werden, die Startseite einer Rolle sein und die eines physischen Bildschirms. Ein Fernseher an der Wand öffnet `/?screen=wall-tv` und bekommt das Board ohne Kopfzeile und Tabs.

## Rollen und Bildschirme

**Pro Rolle.** `roles` entscheidet, wem ein Dashboard angeboten wird. `homeFor` entscheidet, wo eine Rolle landet. Ein Bediener, dessen Startseite `line-2` ist, öffnet HotLoop auf Linie 2. Mit einem URL-Fragment in der Adresse (`#alarms`) öffnet sich die Seite dort, wo die Adresse es sagt.

**Pro Bildschirm.** Ein Bildschirm ist ein physisches Display. Öffnen Sie HotLoop unter `/?screen=<name>`, und es zeigt das Dashboard, dessen `screens` diesen Namen hat, ohne Kopfzeile, ohne Tabs und mit größeren Touch-Flächen, weil niemand, der an einem Panel-PC vorbeigeht, einen Ausweg aus der Seite braucht. Ein Name, den kein Dashboard hat, sagt das, statt etwas anderes zu zeigen.

**Ein Panel meldet Personen an, nicht sich selbst.** Wenn niemand angemeldet ist, zeigt es ein einziges Feld „PIN oder Ausweis“. Ein Bediener tippt seine PIN oder scannt seinen Ausweis (ein Leser nach Tastaturprinzip tippt sie ins Feld), und das Panel öffnet das Dashboard. Sein Name und eine Taste **Abmelden** sitzen in der Ecke, da die Kopfzeile, die sie zeigen würde, weg ist. Jeder Schreibzugriff, den eine Taste dieses Dashboards macht, geht als diese Person durch das Schreib-Gate, und Prüfpfad und Logbuch nennen sie: „olga schrieb 250 nach line-02/Speed“, nicht „panel-3“. Nach fünfzehn Minuten, in denen niemand den Bildschirm berührt (eine Einstellung), meldet das Panel sie ab und kehrt zum Feld zurück, und ein danach gesendeter Schreibzugriff wird abgelehnt. Ein Administrator gibt jeder Person einen Code unter **Einstellungen, Benutzer**. Das Ganze, was ein Ausweis ist, wie der Code gespeichert wird und was er nicht tut, steht in [Authentifizierung und Benutzer](/de/iot/authentication/#kiosk-bedienfelder-pin-oder-ausweis-und-automatische-abmeldung).

Auf Ihrem eigenen Computer gilt nichts davon: Sie sind mit Ihrem Passwort angemeldet, der Schreibzugriff einer Taste geht direkt durch das Gate und protokolliert Sie, und es gibt keine Abmeldung bei Inaktivität. Ein Panel, das mit einem dauerhaften Bedienerkonto angemeldet war, so wie ein Panel vor den PINs betrieben werden musste, funktioniert weiter und schreibt weiter als dieses Konto. Geben Sie einem gemeinsamen Panel kein solches Login.

Das ist, was die Edge-HMI ist: ein Dashboard mit gesetztem `screens`, auf einer Maschine, die diese Adresse öffnet, wobei sich die Personen daran per PIN oder Ausweis anmelden.

## Bauen

Wer `dashboards.write` hat (Administratoren), sieht **Bearbeiten** auf einem Dashboard und **Neues Dashboard** in der Leiste. Beim Bearbeiten:

- sind Karten inaktiv, sodass das Greifen einer Taste zum Verschieben sie nicht drücken kann;
- ziehen Sie eine Karte auf eine andere, um sie dorthin zu setzen, oder benutzen Sie die Pfeile in ihrer Werkzeugleiste, die das sind, was ein Telefon hat, weil ein Touchscreen kein Ziehen startet;
- ziehen Sie die Ecke zum Skalieren: Die Breite rastet auf eine Spalte von zwölf ein, die Höhe auf eine Zeile;
- das Zahnrad bearbeitet die Karte, die Kopieren-Taste dupliziert sie, das Kreuz löscht sie;
- **Einstellungen** sind der Name, wem es angeboten wird, für wen es sich zuerst öffnet, seine physischen Bildschirme und sein Platz in der Umschaltleiste.

Nichts wird gespeichert, bis **Speichern**. **Verwerfen** wirft die Änderungen weg. Ein `409` beim Speichern heißt, jemand hat zuerst gespeichert: Die Seite bietet an, dessen Version zu laden.

**Exportieren** (neben Bearbeiten) speichert das Dashboard auf dem Bildschirm als Datei, und **Importieren** (in der Leiste neben Neues Dashboard, für wen `dashboards.write` hat) lädt eines in diese Installation, sodass ein Bildschirm ein Datensatz des Kunden ist und zwischen Installationen wandert, ohne dass ihn jemand neu baut. Siehe [Bildschirmdateien](/de/iot/screen-file/).

## Layout

| Breite | Spalten | Eine Karte mit `w` nimmt |
|---|---|---|
| Über 1100 px | 12 | `w` |
| 700 bis 1100 px | 6 | die Hälfte von `w`, aufgerundet |
| 480 bis 700 px | 2 | eine, oder beide, wenn `w` über 4 liegt |
| Unter 480 px | 1 | alles |

Zeilen sind 76 px hoch mit einem Abstand von 16 px bei den breiten Layouts. Auf einem Telefon ist eine Karte so hoch wie ihr Inhalt mit einer Untergrenze aus ihren Zeilen, sodass nichts abgeschnitten wird. Die Umschaltleiste scrollt seitlich in sich selbst, und die Seite nie.

## Auf einem Telefon

Die Web-Oberfläche lässt sich auf einem Telefon installieren und öffnet sich ohne Verbindung. Es ist dieselbe Seite mit einem Manifest, Symbolen und einem Service Worker, ausgeliefert von HotLoop selbst, sodass es nichts zu bauen und nichts auf dem Server zu installieren gibt.

**Installieren.** Unter Android hat das Menü von Chrome **App installieren**. Auf einem iPhone hat das Teilen-Blatt von Safari **Zum Home-Bildschirm**. Sie öffnet sich im Vollbild, mit dem Namen des Werks, und unter Android bietet ein langer Druck auf ihr Symbol Alarme und Dashboards an. Ein Browser installiert eine Seite und führt einen Service Worker nur über **https** oder auf `localhost` aus. Auf der einfachen `http://`-Adresse eines Werks öffnet sich HotLoop weiterhin in einem Tab genau wie immer, kann aber nicht installiert werden und funktioniert nicht offline. Stellen Sie für Telefone ein Zertifikat davor (den Ingress oder den Reverse-Proxy, den Sie schon haben). Der Browser sagt Ihnen, warum er nicht installiert: Entwicklertools von Chrome, Application, Manifest.

**Was sie behält.** Die Seite selbst und die letzte Antwort auf die Abfragen, die sich eine Person ansieht: die Alarmliste, die Dashboards, die Messwerte und Entitätszustände, die Geräte und Tags, den Status, den Anlagenbaum und das Board. Solange die Seite offen und verbunden ist, fragt sie diese einmal pro Minute ab, damit es etwas zum Öffnen gibt, und nicht, während das Telefon in der Tasche steckt. Öffnen Sie sie ohne Verbindung, und die Seite lädt, die Alarmliste und die Dashboards zeigen, was das Telefon zuletzt gesehen hat, und eine Leiste am unteren Rand sagt es, mit der Uhrzeit:

```
Offline. This is what this phone last saw as of 10/22/2026, 05:42:23. Nothing you
do here is sent until the connection is back.
```

Wenn die Verbindung wieder da ist, innerhalb weniger Sekunden, verschwindet die Leiste, der Bildschirm aktualisiert sich aus Live-Antworten und der Live-Strom verbindet sich neu.

**Offline und nie angemeldet.** Ein Telefon, das die App hat, aber nicht angemeldet ist (es war es nie, oder es hat sich abgemeldet, was leert, was es behalten hatte), hat ohne Verbindung nichts zu zeigen, also zeigt es den Anmeldebildschirm und sagt, warum: HotLoop antwortet von hier aus nicht, und sie versucht es weiter. In dem Moment, in dem HotLoop antwortet, lädt sich die Seite von selbst in die echte Anmeldung neu. Sie zeigt nie eine App mit nichts darin.

**Was sie nie tut.** Nichts, was irgendetwas ändert, wird von einer Offline-Seite gesendet. Ein Schreibzugriff, sei es ein Wert für ein Tag, ein Skript, ein Rezept oder eine Quittierung, wird abgelehnt, bevor er die Seite verlässt, mit dem Grund:

```
You are offline, so nothing was sent. Everything here is as of 10/22/2026, 05:42:23.
Try again when the connection is back.
```

Der Service Worker beantwortet, behält und reiht keinen Schreibzugriff ein, und es gibt in ihm keine Hintergrundsynchronisierung. Ein Befehl an eine Anlage wird nur von einer Person gesendet, die eine Live-Antwort ansieht, und eine ohne Verbindung gedrückte Taste wartet nirgends darauf, später hinauszugehen. Das Quittieren aus einer Benachrichtigung ist etwas Eigenes und braucht das Netz genauso: Die ntfy-App drückt ihre eigene Taste.

**Was sie nicht behält.** Den Live-Strom, Trends und Verlauf, das Logbuch, die Einstellungen, die Benutzer, die Eskalationsrichtlinie und alles zu Benachrichtigungen. Manches ist zu groß und jedes Mal anders, um es aufzubewahren, und manches enthält Dinge (die ntfy-Themen der Personen, Konten), die nicht in den Cache eines Telefons gehören, deshalb brauchen diese Bildschirme eine Antwort von HotLoop.

**Auf dem Telefon.** Was behalten wird, lebt im Cache-Speicher des Browsers auf diesem Telefon, höchstens 200 Antworten, die ältesten zuerst verworfen. **Abmelden leert ihn**, und das tut auch eine abgelaufene oder widerrufene Sitzung (das erste `401` leert ihn). Es wird nur eine angemeldete Sitzung behalten, sodass sich ein Offline-Telefon nie auf den Daten von jemand anderem öffnet. Eine neue HotLoop-Version bekommt einen eigenen Seiten-Cache, und der alte wird gelöscht; die Seite wird immer live geholt, wenn es eine Verbindung gibt, sodass eine neue Version oder ein umbenanntes Werk beim nächsten Öffnen erscheint.

Derselbe Test nimmt den Server weg, für Seite und Worker gleichermaßen, und lädt neu: Die Seite öffnet sich, die Alarmliste und ein Dashboard zeigen, was behalten wurde, ein Schreibzugriff auf ein Tag und ein Quittieren werden beide abgelehnt, der Alarm ist weiterhin unquittiert und das Schreibprotokoll leer, nachdem die Verbindung zurück ist, und das Abmelden leert, was behalten wurde. Ausgeführt auf echter Hardware (2026-11-17), einschließlich Installation auf einem echten Telefon, Safari auf einem iPhone und dem Ausfall des WLANs eines echten Werks.

## Rechte

| Recht | Betrachter | Bediener | Administrator |
|---|---|---|---|
| `dashboards.read` | ja | ja | ja |
| `dashboards.write` | nein | nein | ja |

Lesen ist das Recht jeder Rolle, gefiltert durch `roles`. Schreiben ist das des Administrators. Was eine Karte beim Drücken tun kann, sind die eigenen Rechte der drückenden Person: Ein Betrachter sieht eine Schreibtaste deaktiviert, und der Server würde sie ablehnen, wenn er daran vorbeikäme.

## Die API

| Methode | Route | Recht |
|---|---|---|
| `GET` | `/api/dashboards` | `dashboards.read` |
| `POST` | `/api/dashboards` | `dashboards.write` |
| `GET` | `/api/dashboards/{id}` | `dashboards.read` |
| `PUT` | `/api/dashboards/{id}` | `dashboards.write` |
| `DELETE` | `/api/dashboards/{id}` | `dashboards.write` |
| `GET` | `/api/dashboards/{id}/export` | `dashboards.read` |
| `POST` | `/api/dashboards/import` | `dashboards.write` |

Die Referenz mit Bodys und Fehlern steht in [der HTTP-API](/de/iot/api/#dashboards). Jedes Anlegen, Speichern und Löschen ist als `config`-Ereignis zum Subjekt `dashboard:<id>` aktenkundig, sodass das Logbuch sagt, wer geändert hat, was ein Panel zeigt.

Die Tabelle ist `dashboards`, hinzugefügt in Migration 0023 für PostgreSQL, TimescaleDB und SQLite. Sie fügt nur hinzu ([Migrationen fügen nur hinzu](/de/iot/migrations/)). Die Zeile der Wandtafel wird von der Anwendung angelegt, wenn sie zum ersten Mal verlangt wird, nicht von der Migration, sodass eine aus einem Backup von vor den Dashboards wiederhergestellte Datenbank sie wieder hat.

## Was nicht dabei ist

- **Pixelgenaue Layouts.** Absichtlich, siehe oben. Wenn die HMI einer Maschine wirklich ein Bedienelement an einer festen Stelle braucht, ist das ein für diese Maschine gebauter Bildschirm, und es ist nicht das, was dies hier ist.
- **Sichtbarkeit pro Karte.** Ein Dashboard wird Rollen angeboten; eine Karte nicht. Zwei Zielgruppen mit verschiedenen Karten sind zwei Dashboards.
- **Eine Kachelkarte.** Siehe die Karte `map`.
- **Eine Taste halten.** Eine Taste schreibt einmal beim Drücken. Ein Tippschalter, der beim Drücken und beim Loslassen schreibt, ist eine andere Karte und nicht gebaut.
- **Dashboards im Edge Relay.** Es hat keine Oberfläche.
