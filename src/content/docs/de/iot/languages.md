---
title: "Sprachen der Weboberfläche"
description: "Die Weboberfläche auf Englisch und dreizehn weiteren Sprachen, Arabisch von rechts nach links gesetzt, wählbar in der oberen Leiste oder auf der Anmeldekarte."
---

:::note[Enthält, was kommt]
Diese Seite behandelt auch einige Dinge, die neuer sind als HotLoop core 4.24.0, die aktuelle Version. Manches davon ist möglicherweise nicht in dem enthalten, was Sie installiert haben. Die [Versionshinweise](/de/releases/) sagen, was sich geändert hat.
:::

Die Weboberfläche von HotLoop IoT, Edge und Gateway (und von HotLoop for CODESYS, das die Edge-Oberfläche ausführt) gibt es auf Englisch und in 13 weiteren Sprachen: Spanisch (es), Französisch (fr), Italienisch (it), Deutsch (de), Norwegisch Bokmål (nb), Bulgarisch (bg), Griechisch (el), Koreanisch (ko), Japanisch (ja), Vietnamesisch (vi), Hindi (hi), vereinfachtes Chinesisch (zh-Hans) und Arabisch (ar, von rechts nach links gesetzt).

Wählen Sie eine im Sprachfeld in der oberen Leiste oder auf der Anmeldekarte. Die Wahl wird in diesem Browser gespeichert. Ohne Wahl nimmt die Seite die erste Sprache des Browsers, die HotLoop hat, und Englisch, wenn keine passt. Eine Sprache erscheint in der Auswahl nur, wenn ihre Datei vollständig ist.

Was der Sprache folgt: jedes Wort auf jedem Bildschirm, die Reihenfolge und Zeichen der Zahlen (ein Dezimalkomma im Deutschen, Französischen und Spanischen), Datum und Uhrzeit (24-Stunden-Uhr), die Pluralformen (Arabisch hat sechs) und die Richtung der Seite. Produkt- und Protokollnamen (HotLoop, Modbus, OPC UA, MQTT, Sparkplug, CODESYS, UniFi) bleiben, wie sie geschrieben sind. Werte aus der Anlage, etwa Tag-Namen, Gerätenamen, von jemandem getippte Alarmmeldungen und vom Server zurückgesandter Fehlertext, werden so angezeigt, wie sie sind.

## Gebaut für die Menschen, die es nutzen

* Jeder Bildschirm wird aus einer Nachricht pro Satz gezeichnet, sodass eine Sprache nie eine halbe Seite eigener Wörter und eine halbe Seite Englisch ist. Eine Sprache erscheint in der Auswahl nur, wenn jeder Bildschirm vollständig ist.
* Pluralformen folgen den Unicode-CLDR-Regeln für jede Sprache, sodass "1 Gerät", "2 Geräte" und die sechs Formen des Arabischen so lesen, wie ein Muttersprachler es erwartet.
* Zahlen und Datumsangaben kommen aus der eigenen Formatierung des Browsers für die gewählte Sprache, sodass ein deutscher Leser 1.234,5 sieht und ein US-Leser 1,234.5.
* Das Wechseln der Sprache zeichnet alle Bildschirme auf einmal neu, ohne Neuladen. Englisch ist Teil der Seite und lädt mit ihr; jede andere Sprache wird nur geholt, wenn jemand sie wählt, sodass ein Werk, das in einer Sprache arbeitet, die anderen zwölf nie herunterlädt.
* Das Layout dreht sich für Arabisch von selbst: Ränder, Ausrichtung und Abstände kehren sich mit der Sprache um.

Ein Browsertest in der vollständigen Suite beweist es an der echten Seite. Er öffnet HotLoop in jeder Sprache in einer Desktop- und einer Telefonbreite und geht jeden Bildschirm durch. Die Richtung stimmt, nichts scrollt seitwärts, keine Nachricht erscheint als Platzhalter, Zahlen lesen sich so, wie es die Sprache will, und die Wahl übersteht ein Neuladen.

## Was nicht übersetzt wird

* Text, den der Server sendet: Fehlermeldungen der API, Benachrichtigungs- und Alarmmeldungen sowie die CLI. Die Oberfläche zeigt sie, wie sie ankommen.
* Die Dokumentation, die Namen des OPC-UA-Servers, der MQTT-Broker und die Werte des Helm-Charts.
