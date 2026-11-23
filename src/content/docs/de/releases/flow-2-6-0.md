---
title: "Versionshinweise: HotLoop Flow 2.6.0"
description: "Was HotLoop Flow 2.6.0 bringt, was sich beim Update ändert und was Sie lesen sollten, bevor Sie eine laufende Anlage anfassen."
sidebar:
  label: "2.6.0"
---

HotLoop Flow 2.6.0 gibt einer dauerhaften Verbindung eine Möglichkeit, Ihnen zu sagen, dass sie nicht mehr zustellt. Nichts daran, wie Ihre Flows laufen, ändert sich. Wenn Sie dauerhafte Verbindungen an einer Anlagenlinie betreiben, bekommen Sie einen Zähler, auf den Sie alarmieren können, für den einen Fehler, der früher wie eine ruhige Warteschlange aussah.

## Neu

**Eine hängende dauerhafte Verbindung wird gezählt und beschrieben.** Die Pumpe einer dauerhaften Verbindung bemerkt jetzt, wenn die Verbindung meldet, dass Nachrichten warten, und die Warteschlange nichts Lesbares enthält, und das nach einer kurzen erneuten Prüfung immer noch so ist. Sie erhöht `hotloop_flow_durable_wire_stranded_total{wire=...}` um eins und schreibt eine Warnung ins Runtime-Log, einmal pro Fehlerart, mit den Zählern der Verbindung neben dem, was ihre Tabelle enthält: wie weit die Pumpe kam, die Tiefe, die Zeilen auf der Platte, was unterwegs ist und wie viele angehängt, zugestellt und verworfen wurden. Auf einer gesunden Verbindung ist der Zähler null und bleibt null, jeder Wert über null ist also einen Alarm wert.

Wir haben es eingebaut, weil eine Drop-Oldest-Verbindung bei einigen Tausend Testläufen einmal nicht leerlief und wir nicht herausfinden konnten, warum. Diese Version ist das Messinstrument, keine Korrektur. Falls es je auf Ihrer Linie auslöst, brauchen wir die Logzeile.

## Was sich geändert hat

- Der im Image mitgelieferte Lizenztext schreibt EmberNet so, wie es die kanonische Kopie tut. Drei Zeilen, nur Schreibweise.
- Die Bilder der README sind schlichte Bilder, erst hell, dann dunkel, sodass sie auf docs.hotloop.io erscheinen.

## Neue Einstellungen

Keine. Die Metrik ist an, und es gibt keinen Schalter.

## Upgrade

Ein schlichtes `helm upgrade` auf das Image und Chart von 2.6.0 oder das neue Tag in Ihrer Quadlet-Unit. Beim ersten Start passiert nichts, es gibt nichts zu migrieren, und die Flows, die Deploy-Datensätze und die Zugangsdaten werden nicht angefasst.

Image: `ghcr.io/hotloop-io/hotloop-flow:2.6.0`, linux/amd64 und linux/arm64. Chart: `https://hotloop.io/hotloop-flow/`. Das README zu diesem Tag hat den Rest, mit Bildern: https://github.com/HotLoop-io/hotloop-flow/blob/v2.6.0/README.md
