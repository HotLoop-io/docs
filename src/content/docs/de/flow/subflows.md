---
title: "Subflows in HotLoop Flow"
description: "Fassen Sie mehrere Knoten zu einem wiederverwendbaren Knoten mit eigenen Eigenschaften zusammen und sehen Sie, was ein Subflow mit dem umgebenden Flow teilt."
---

Jede Instanz bekommt eine eigene Kopie der Knoten der Vorlage, einen eigenen Flow-Kontext und eigene aufgelöste Eigenschaften. Dieselbe Vorlage zeigt in einer Instanz `4.2 bar` und in der nächsten `4.2 kPa`, von Anfang bis Ende über ein echtes Deployment geprüft und nicht in einem Unit-Test nur behauptet.

Die Expansion erzeugt einen **eigenen Graphen**, statt die geparsten Flows umzuschreiben, und das ist die ganze Entwurfsentscheidung. Die Flow-Datei wird nie angefasst, also gilt der byteidentische Round Trip weiterhin, und der expandierte Graph ist ein gewöhnlicher Graph, sodass Scheduler, Catch-Routing, Metriken und die Statusereignisse des Editors innerhalb eines Subflows ohne Sonderfälle funktionieren.

Verschachtelung funktioniert. Ein Fehler, den in einem Subflow niemand abfängt, läuft bis zum Catch-Knoten des aufrufenden Tabs, denn sonst wäre ein Subflow nur ein Ort, an dem Fehler verschwinden. Ein Konfigurationsknoten, der in einer Vorlage deklariert ist, wird von allen Instanzen **geteilt** statt kopiert, denn ein MQTT-Broker in einem Subflow ist ein Autor, der sagt „teile das“, und ihn zu kopieren würde pro Instanz eine Verbindung zu etwas öffnen, das sie mit ziemlicher Sicherheit mitzählt.
