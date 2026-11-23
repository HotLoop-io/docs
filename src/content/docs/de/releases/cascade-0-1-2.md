---
title: "Versionshinweise: HotLoop Cascade 0.1.2"
description: "Was HotLoop Cascade 0.1.2 bringt, was sich beim Update ändert und was Sie lesen sollten, bevor Sie eine laufende Anlage anfassen."
sidebar:
  label: "0.1.2"
---

## Worum es geht

0.1.2 ist ein Build-Fix und sonst nichts. Der Code ist derselbe wie in 0.1.1, und alles, was Sie betreiben, bleibt auch gleich: das Chart, die Quadlet-Units, die Einstellungen, die Datenbank.

Cascade wird jetzt durchgehend auf Podman gebaut und veröffentlicht, und das Image enthält genau amd64 und arm64.

## Upgrade von 0.1.1

Nichts zu tun. `helm upgrade` auf 0.1.2, oder lassen Sie `:stable` die Quadlet-Units weiterbewegen. Keine Migrationen, keine neuen Einstellungen, und der Schlüssel und Ihre Workflows bleiben, wo sie waren.
