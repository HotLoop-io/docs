---
title: "Der Editor von HotLoop Flow"
description: "Der Flow-Editor in Hell und Dunkel: die Zeichenfläche, die Prüfung vor einem Deployment, eine verfolgte Nachricht und die Anmeldung."
---

Er folgt Ihrem System, hell oder dunkel, und jedes Bild unten wird in beiden Varianten gezeigt, zuerst die helle. Jedes Bild unten stammt aus `web/shots/screenshots.sh`, das das echte Binary und einen echten Browser startet, sodass sie neu aufgenommen werden, wenn sich der Editor ändert, und nicht zu einer Attrappe verkommen können. Die Anlage auf der Zeichenfläche ist eine Ofenlinie mit zwei Deployments dahinter.

## Verdrahten, ausführen, beobachten

![Der Editor an einer Ofenlinie: die Zeichenfläche, der Deployment-Verlauf und die Debug- und Laufzeit-Bereiche](/synced/flow/docs/screenshots/editor.png)
![Dasselbe, in Dunkel](/synced/flow/docs/screenshots/editor-dark.png)

Die Zeichenfläche ist das, was läuft. Die Debug-Leiste darunter gibt aus, was Ihre Debug-Knoten sehen, und die Runtime-Tabelle daneben zählt, was in jeden Knoten hinein- und aus ihm herausgegangen ist, mit einem Balken dafür, wie voll seine Warteschlange ist. Wenn eine Linie spinnt, lesen Sie es vom Bildschirm ab, statt in einem Log zu wühlen.

## Prüfen, bevor es die Linie erreicht

![Der Prüfbereich mit einem geänderten Knoten und einem Notizfeld, neben der Zeichenfläche mit diesem Knoten umrandet](/synced/flow/docs/screenshots/review.png)
![Dasselbe, in Dunkel](/synced/flow/docs/screenshots/review-dark.png)

Deploy deployt nicht. Es zeichnet die Änderung auf die Zeichenfläche, schreibt sie in Worten aus und bittet Sie um eine Notiz. Die Notiz landet neben Ihrem Namen im Verlauf, sodass jeder, der um 2 Uhr nachts den Anruf bekommt, sehen kann, was sich geändert hat und warum.

## Eine Nachricht entlang der Verbindungen verfolgen

![Eine verfolgte Nachricht, auf der Zeichenfläche beleuchtet, mit der Zeit, die jeder Knoten damit verbracht hat, und die Debug-Leiste darunter](/synced/flow/docs/screenshots/debug.png)
![Dasselbe, in Dunkel](/synced/flow/docs/screenshots/debug-dark.png)

Klicken Sie in einer Debug-Zeile auf Trace, und der Weg, den diese Nachricht genommen hat, leuchtet auf der Zeichenfläche auf, Sprung für Sprung, mit dem, was jeder Knoten damit gemacht hat, und wie lange es gedauert hat. Machen Sie daraus einen Test oder spielen Sie sie in einen Entwurf ein, im selben Bereich.

## Anmelden

![Die Anmeldekarte](/synced/flow/docs/screenshots/signin.png)
![Dasselbe, in Dunkel](/synced/flow/docs/screenshots/signin-dark.png)

![Der Hinweis, den eine Runtime zeigt, wenn das Dashboard Leute anmeldet und diese Seite auf anderem Weg geöffnet wurde](/synced/flow/docs/screenshots/dashboard-signin.png)
![Dasselbe, in Dunkel](/synced/flow/docs/screenshots/dashboard-signin-dark.png)

Er startet nicht ungeschützt, also ist das Erste, was jeder sieht, eine Anmeldung. Wenn das EmberCORE-Dashboard Leute anmeldet, sagt eine auf anderem Weg geöffnete Runtime, sie sollten stattdessen über das Dashboard hereinkommen, statt ein zweites Passwort zu verlangen.
