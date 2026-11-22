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

Jedes Element behält seinen Pixelplatz: Die Seite ist die Symbolkarte, als ein skaliertes Bild gezeichnet, der Bildschirm behält also in jeder Größe und auf dem Telefon seine Form.

## Was nicht mitkommt

Im Import gesagt, eine Zeile je Fall, nie stillschweigend weggelassen:

* ein Elementtyp ohne HotLoop-Symbol (ein Trend, eine Tabelle, ein Schieberegler, ein Bildelement und der Rest des Werkzeugkastens),
* eine Variable, die ein Ausdruck ist (`Temp * 2`, `a AND b`, ein Array-Element): HotLoop zeigt ein Tag, also legen Sie ein Tag für den Ausdruck an und richten eine Anzeige darauf,
* eine Sichtbarkeits-, Farb- oder Bewegungsregel, die von einem SPS-Wert gesteuert wird: Das Symbol ist immer da und wechselt die Farbe nicht,
* eine Bézierkurve wird als gerade Linien zwischen ihren Punkten gezeichnet, und ein gedrehtes Element wird nicht gedreht,
* die Seitengröße, die der Export nicht enthält: Die Seite ist so groß wie das äußerste Element, plus ein Rand,
* Text, der länger als 40 Zeichen ist, wird abgeschnitten, und die Zeiger sind Zahlen, keine Zeiger.

Die Textstile, Schriften und Farben des CODESYS-Stils sind die von HotLoop: Der Bildschirm folgt dem Theme von HotLoop.

## Wie die Datei gelesen wird

CODESYS dokumentiert, dass der native Export existiert und XML ist, und dokumentiert nicht, was darin steht. Der Leser hier folgt dem, was die IDE selbst schreibt (CODESYS 3.5 SP22, Visualization 4.10): Jedes Element speichert seine Einstellungen als Liste nummerierter Member, und die Nummer ist der CRC-32 des Pfades des Members in der Beschreibung des Elements, etwa `m_StaticPosition.iX`, den die IDE neben sich installiert. Die Tests enthalten Werte, die aus dem eigenen Export der IDE gelesen wurden. Eine Einstellung, die eine Variable trägt und nicht gelesen wird, wird wie oben gemeldet, ein Bildschirm wird also nie als vollständig importiert, wenn er es nicht ist.

## Der nächste Schritt

Öffnen Sie den Bildschirm, prüfen Sie die Anzeigen gegen die Anlage und setzen Sie die Sollwert- und Tasterkarten dorthin, wo Ihre Bediener sie erwarten. Ein von Hand gebauter und ein importierter Bildschirm sind ab hier dasselbe: Er wird als [Bildschirmdatei](/de/iot/screen-file/) exportiert, mit jedem Speichern versioniert und genauso in eine andere Installation übernommen.
