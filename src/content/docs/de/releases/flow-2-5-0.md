---
title: "Versionshinweise: HotLoop Flow 2.5.0"
description: "Was HotLoop Flow 2.5.0 bringt, was sich beim Update ändert und was Sie lesen sollten, bevor Sie eine laufende Anlage anfassen."
sidebar:
  label: "2.5.0"
---

HotLoop Flow 2.5.0 ist ein neuer Editor. Dieselben Flows, dieselbe Engine, dieselben Tastenkürzel, und er sieht endlich so aus, als gehörte er zum Rest von HotLoop, statt von einer anderen Firma zu stammen. Wenn Sie beruflich Anlagen verdrahten, bekommen Sie einen Bildschirm, der zu dem passt, was Sie den ganzen Tag tun: das Ding auf die Zeichenfläche setzen, deployen und zusehen, wie es läuft.

## Neu

**Der Editor sieht aus wie HotLoop.** Dieselben Farben, dieselbe Schrift, hell und dunkel nach Ihrem System, mit einem Button in der oberen Leiste, wenn Sie das andere möchten. Orange heißt „hier können Sie klicken“ und sonst nichts. Es bedeutet keine Warnung, keine Auswahl und keinen Weg, den eine Nachricht genommen hat.

**Debug und Runtime sind unter die Zeichenfläche gewandert.** Das Debug-Log und die Runtime-Tabelle sitzen jetzt nebeneinander in einem Dock am unteren Rand, sodass eine Debug-Zeile die ganze Breite der Zeichenfläche bekommt statt einer schmalen Spalte, in der jede Payload viermal umbrach. Die Runtime-Tabelle daneben zählt weiterhin, was in jeden Node hinein- und aus ihm herausging, mit einem Balken dafür, wie voll jede Warteschlange ist. Was das für Sie heißt: Sie sehen einen Messwert ankommen und den Node, aus dem er kam, ohne zu scrollen oder zu blinzeln.

**Verlauf, Tests und Trace bleiben rechts.** Der, in dem Sie gerade arbeiten, rückt nach oben. Drücken Sie Deploy, und die Prüfung ist das Erste in dieser Spalte, mit dem Notizfeld darunter. Klicken Sie bei einer Debug-Zeile auf Trace, und der Trace nimmt den obersten Platz ein.

**Ein Trace ist jetzt blau.** Der Weg, den eine Nachricht genommen hat, wird in Blau über die Zeichenfläche gezeichnet, mit der Zeit, die jeder Node dafür brauchte. Die Prüfung vor einem Deploy markiert hinzugefügte, geänderte, verschobene und entfernte Nodes in Grün, Bernstein, Blau und Rot. Was das für Sie heißt: Sie erkennen einen Trace jetzt auf einen Blick von einer Auswahl, weil sie sich keine Farbe mehr teilen.

**Eine Anmeldung, die aussieht wie der Rest von HotLoop.** Eine Karte, das echte Logo und dieselben Felder. Hinter dem EmberCORE-Dashboard sagt sie weiterhin, dass Sie über das Dashboard hereinkommen sollen.

**Die Suche zeigt ihr Tastenkürzel.** Der Button sagt Strg F, damit Sie nicht raten müssen.

**Ein Doppelklick direkt nach einer Änderung trifft.** Der Editor prüft die Typen Ihrer Verbindungen einen Moment nach jeder Änderung und zeichnete früher jede Verbindung neu, selbst wenn sich das Ergebnis nicht geändert hatte, sodass ein Doppelklick auf einen Node eine Verbindung treffen konnte, die mitten im Klick ausgetauscht wurde, und nichts bewirkte. Jetzt zeichnet er nur noch neu, wenn sich wirklich etwas geändert hat.

## Was sich geändert hat

Nichts an Ihren Flows. Eine Flow-Datei wird Byte für Byte geladen und gespeichert, genau wie vorher. Verdrahten, Ziehen, Rückgängig, Kopieren und Einfügen, Strg+Enter, Escape, Verschieben mit den Pfeiltasten, Zoom, Rahmenauswahl und Ziehen aus der Palette funktionieren wie bisher, und alle 60 Browsertests bestehen, ohne dass eine Zeile davon angefasst wurde. Wir sind außerdem jeden Bildschirm und jeden Dialog in 2.4.0 und in diesem Build mit demselben Anlagen-Flow durchgegangen, 48 Zustände, und nichts ging verloren.

Dinge, die absichtlich anders aussehen: Die Debug- und Runtime-Panels sind in das Dock gewandert, die Leermeldung des Tests-Panels sagt jetzt „Debug-Dock“, weil dort das Log ist, ein Trace und eine Prüfung werden in Blau und den Statusfarben gezeichnet, der Theme-Button sagt Dunkel oder Hell, und die Suche zeigt ihr Tastenkürzel.

**Eine Sache ist langsamer, und wir sagen es lieber, als dass Sie es selbst finden.** Die Seite ist einen Moment leer, bis der Editor geladen ist, während der alte zuerst seinen Rahmen zeichnete. Wir haben es bei ausgeschaltetem Browser-Cache gemessen, von der Anfrage der Anmeldeseite bis zum Formular auf dem Bildschirm. Auf dieser Maschine sind es etwa 12 ms mehr. Über eine 20-Mbit/s-Leitung sind es etwa 100 ms mehr (aus 230 ms wurden 335 ms), und über eine 1,6-Mbit/s-Leitung mit 150 ms Latenz etwa eine halbe Sekunde mehr (aus 1,46 s wurden 1,96 s). In einem Anlagen-LAN sind es ein paar Millisekunden. Auf einer schlechten Leitung sehen Sie kurz eine weiße Seite und dann den Editor. Es sind einmalige Kosten pro Seitenaufruf, nicht pro Klick.

## Neue Einstellungen

Keine. Es gibt nichts einzuschalten, und nichts hier hat einen Schalter zum Ausschalten.

## Upgrade

Ein schlichtes `helm upgrade` auf das Image und Chart von 2.5.0 oder das neue Tag in Ihrer Quadlet-Unit. Beim ersten Start passiert nichts, es gibt nichts zu migrieren, und die Flows, die Deploy-Datensätze und die Zugangsdaten werden nicht angefasst. Laden Sie den Editor-Tab nach dem Neustart des Pods einmal neu, damit Ihr Browser aufhört, den alten zu zeigen.

## Lizenzen

Der Editor liefert jetzt zwei Schriften mit, Inter und JetBrains Mono, unter der SIL Open Font License 1.1. Ihre Lizenzen stehen mit den übrigen in `/usr/share/doc/hotloop-flow/THIRD_PARTY_LICENSES`, und `NOTICE` sagt, wie diese Datei erzeugt wird.

Image: `ghcr.io/hotloop-io/hotloop-flow:2.5.0`, linux/amd64 und linux/arm64. Chart: `https://hotloop.io/hotloop-flow/`. Das README zu diesem Tag hat den Rest, mit Bildern: https://github.com/HotLoop-io/hotloop-flow/blob/v2.5.0/README.md
