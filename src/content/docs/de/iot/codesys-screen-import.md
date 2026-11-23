---
title: "Einen CODESYS-Bildschirm importieren"
description: "Exportieren Sie eine CODESYS-Visualisierung aus der IDE und importieren Sie sie als HotLoop-Bildschirm auf SPS-Variablen, nicht platzierbare Elemente zuerst."
---

Ihre Bediener haben schon einen CODESYS-Bildschirm. Exportieren Sie ihn aus der IDE, importieren Sie ihn in HotLoop, und er öffnet sich als HotLoop-Bildschirm auf den Variablen derselben SPS. Das ist der Weg weg von WebVisu: Die SPS führt weiter ihr Programm aus, HotLoop liest es über den OPC-UA-Connector, und der Bildschirm gehört HotLoop. HotLoop for CODESYS führt Edge aus, also ist dies auch sein Import.

## So geht es

Wählen Sie in der CODESYS-IDE die Visualisierung im Projektbaum aus und verwenden Sie **Projekt, Exportieren** (der native CODESYS-Export, eine `.export`-Datei). Nicht **PLCopenXML exportieren**: Diese Datei enthält keine Visualisierung, und HotLoop sagt das, wenn Sie sie wählen.

Auf dem Bildschirm Dashboards **Importieren**, die `.export`-Datei wählen, **Datei lesen**. Es zeigt Ihnen:

* die gefundene Visualisierung (bei einer Datei mit mehreren fragt es, welche),
* jedes Tag, das der Bildschirm liest und das diese Installation nicht hat. Die Variablen kommen als `plc/<GVL>.<variable>` an: Ordnen Sie das Gerät `plc` dem HotLoop-Gerät zu, an dem die SPS hängt, und alle Tags ziehen auf einmal um, oder ordnen Sie die Tags einzeln zu,
* **Prüfen Sie das**: jedes Element, das es nicht auf den Bildschirm setzen konnte, mit dem Grund, bevor irgendetwas gespeichert wird.

Gespeichert wird erst, wenn nichts mehr im Weg steht. Der Import braucht `dashboards.write`, und eine Schaltfläche oder ein Sollwert auf einem Tag, das nicht als beschreibbar markiert ist, wird hier abgelehnt, genau wie beim Aufbau, damit der Bildschirm nie ein Bedienelement hat, das das Gate ablehnen würde.

Über die API ist es `POST /api/dashboards/import` mit `codesys` (dem Text der Datei) anstelle von `file`, und `visualization`, um eine von mehreren zu benennen:

```json
{"codesys": "<ExportFile>...", "visualization": "Overview", "dryRun": true,
 "remap": {"devices": {"plc": "line-3"}}}
```

Der Bericht hat die üblichen `problems`, `warnings` und `remapped` und ein `conversion` mit `mapped` (jedes Element und was daraus wurde) und `unmapped` (jedes Element und warum nicht).

## Was mitkommt

| CODESYS-Element | In HotLoop |
|---|---|
| Rechteck, abgerundetes Rechteck, Ellipse mit Text und einer Variablen (`Temperature: %2.1f C`) | eine Anzeige: das Tag der Variablen, der Text davor als Beschriftung, der Text danach als Einheit, die Dezimalstellen aus dem Format |
| Dasselbe mit Text und ohne Variable | eine Beschriftung |
| Lampe | eine Lampe, von der Variablen eingeschaltet und in der eigenen Farbe der Lampe gefärbt (Rot ist eine Störung, Gelb eine Warnung, Blau eine Information, alles andere eine Betriebslampe). `NOT x` liest das Tag andersherum |
| Zeigerinstrument, Potentiometer | eine Anzeige der Variablen. Ein Drehknopf, der einen Wert gesetzt hat, bekommt außerdem eine Sollwertkarte mit der Skala des Rads als Grenzen |
| Wippschalter, Kippschalter, Taster | eine Lampe, die den Zustand zeigt, und eine Tasterkarte: Ein und Aus für einen Schalter, der eine Wert für einen Tipp |
| Polygon, Polylinie und Formen ohne Text und ohne Variable (die Rohre, der Behälter, die Rahmen) | das Bild hinter den Symbolen, aus ihren Punkten und Farben gezeichnet |
| Gruppe | ihre Mitglieder, von der Ecke der Gruppe aus platziert |
| Die Variable **Invisible** eines Elements (`bInvisible`) oder die seiner Gruppe | eine `show`-Regel auf dem Symbol: Es wird nur gezeichnet, solange die Variable sagt, dass das Element sichtbar wäre (`NOT x` kehrt es um) |
| Die Variable **Toggle color** eines Elements | eine `colors`-Regel auf dem Symbol: Solange die Variable an ist, wird es im Ton gefärbt, der der eigenen Alarmfarbe des Elements am nächsten kommt (Rot ist `bad`, Gelb und Orange `warn`, Blau `info`, Grün `ok`; ein Element ohne eigene Alarmfarbe ist `bad`, wie der Standard-Alarmrahmen von CODESYS rot ist) |

Jedes Element behält seinen Pixelplatz: Die Seite ist die Symbolkarte, als ein skaliertes Bild gezeichnet, der Bildschirm behält also in jeder Größe und auf dem Telefon seine Form.

## Was nicht mitkommt

Im Import gesagt, eine Zeile je Fall, nie stillschweigend weggelassen:

* ein Elementtyp ohne HotLoop-Symbol (ein Trend, eine Tabelle, ein Schieberegler, ein Bildelement und der Rest des Werkzeugkastens),
* eine Variable, die ein Ausdruck ist (`Temp * 2`, `a AND b`, ein Array-Element): HotLoop zeigt ein Tag, also legen Sie ein Tag für den Ausdruck an und richten eine Anzeige darauf,
* eine Invisible- oder Toggle-color-Variable an einer Form, die in das Hintergrundbild gezeichnet ist (eine Rohrleitung, ein Behälter, ein Rahmen): Das Bild ist ein einziges Bild, also ist die Form immer da und behält ihre Farbe. Wird im Import mit der Variablen gemeldet,
* jede andere von einem SPS-Wert gesteuerte Einstellung (eine Farbvariable für Füllung, Rahmen oder Text, eine Bewegung, ein Blinken, eine Textliste): Das Symbol ist da, wie es gezeichnet war, und die Regel wird gemeldet, wenn ihre Variable eine einfache Variable ist,
* eine Bézierkurve wird als gerade Linien zwischen ihren Punkten gezeichnet, und ein gedrehtes Element wird nicht gedreht,
* die Seitengröße, die der Export nicht enthält: Die Seite ist so groß wie das äußerste Element, plus ein Rand,
* Text, der länger als 40 Zeichen ist, wird abgeschnitten, und die Zeiger sind Zahlen, keine Zeiger.

Die Textstile, Schriften und Farben des CODESYS-Stils sind die von HotLoop: Der Bildschirm folgt dem Theme von HotLoop.

## Wie die Datei gelesen wird

CODESYS dokumentiert, dass der native Export existiert und XML ist, und dokumentiert nicht, was darin steht. Der Leser hier folgt dem, was die IDE selbst schreibt (CODESYS 3.5 SP22, Visualization 4.10): Jedes Element speichert seine Einstellungen als Liste nummerierter Member, und die Nummer ist der CRC-32 des Pfads des Members in der Beschreibung des Elements, etwa `m_StaticPosition.iX`, den die IDE neben sich installiert. Die Elementbäume der IDE listen jeden Pfad mit seiner ID (`ITypeNode.CompletePath` und `CRCIdNumber`); die IDs der Invisible-Variablen (`m_pStateVariables..State.bInvisible`, 2880254039) und der Toggle-color-Variablen (`m_pColorVariables..ToggleColor`, 1999528970) stammen von dort, und die erste ist die ID, unter der das CODESYS-Beispiel Refrigerator das `NOT Glob_Var.DoorOpen` seiner Gruppe speichert. Die Tests enthalten Werte, die aus dem Export der IDE selbst gelesen wurden. Eine Einstellung, die eine Variable trägt und nicht gelesen wird, wird wie oben gemeldet, sodass ein Bildschirm nie als vollständig importiert wird, wenn er es nicht ist.

## Der nächste Schritt

Öffnen Sie den Bildschirm, prüfen Sie die Anzeigen gegen die Anlage und setzen Sie die Sollwert- und Tasterkarten dorthin, wo Ihre Bediener sie erwarten. Ein von Hand gebauter und ein importierter Bildschirm sind ab hier dasselbe: Er wird als [Bildschirmdatei](/de/iot/screen-file/) exportiert, mit jedem Speichern versioniert und genauso in eine andere Installation übernommen.

## TwinCAT-Visualisierungen (.TcVIS)

Eine TwinCAT-Datei `.TcVIS` ist dieselbe Visualisierung im Objektarchiv-XML der IDE, mit denselben Elementtypen und denselben Member-IDs, also geht sie durch denselben Konverter. Geprüft am echten PackML-Beispiel von TwinCAT.

- Schaltflächen: Jede einfache Zuweisung in der Eingabeaktion einer Schaltfläche (`X := 5`, `X := TRUE`, `X := E_PMLCommand.ePMLCommand_Start`) wird zu einer Schaltflächen-Karte, die diesen Wert in X schreibt, und die Beschriftung kommt als Label mit. Ein konfigurierter Toggle-Eingang wird zum Schaltflächenpaar, ein und aus. Code, der mehr als eine Zuweisung ist (eine Bedingung, ein Aufruf, eine Rechnung), wird mit seinem Text gemeldet.
- Aufzählungen: Die OMAC-PackML-Member (`E_PMLCommand`, `E_PMLUnitMode`) sind bekannt, mit den Nummern aus Beckhoffs Konfiguration PackML_HMI_Example und der Deklaration `E_PMLUnitMode` der SPT-Libraries. Jede andere Aufzählung kommt in die `enums` des Imports (`{"E_Own.eOwn_Go": 7}`). Ein Member ohne bekannte Nummer wird mit seinem Namen geschrieben, und der Bericht sagt das.
- Ausdrücke: Die Variable einer Lampe und eine Invisible-Variable können ein Vergleich eines Tags mit einer Zahl, TRUE, FALSE oder einem Aufzählungs-Member sein (`=`, `<>`, `<`, `<=`, `>`, `>=`), NOT, AND und OR, mit Klammern. Sie werden zu einer Symbolregel (siehe DASHBOARDS.md: die `lit`-Regel einer Lampe, die `show`- und `colors`-Regeln eines Symbols, die Regeln mit `all` und `any` kombinieren können). Ein Vergleich zweier Tags, Rechnungen und Aufrufe lassen sich nicht ausdrücken und werden mit dem Teil gemeldet, der nicht ging.
- Rahmen: Ein Rahmen zeigt eine andere Visualisierung. Senden Sie die anderen Dateien des Projekts mit der ersten (`codesysRelated` in der API; im Dialog mehrere Dateien wählen, und die erste ist der Bildschirm). Die Visualisierung des Rahmens wird in den Rahmen gesetzt, wobei jeder Eingang, den sie nimmt, an die Variable gebunden wird, die dem Rahmen gegeben wurde (das `HMI` von V_Module wird zu `MAIN.VFFSDemo.Sealer.PackMLBaseModule_HMI`). Ein Rahmen, dessen Visualisierung nicht unter den Dateien ist, wird mit seinem Namen gemeldet.

Der PackML-Satz (V_Main mit V_Module und V_MachineModule): 60 Elemente zugeordnet, keines nicht zugeordnet.
