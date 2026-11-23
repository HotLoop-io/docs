---
title: "Versionshinweise: HotLoop Cascade 1.3.1"
description: "Was HotLoop Cascade 1.3.1 bringt, was sich beim Update ändert und was Sie lesen sollten, bevor Sie eine laufende Anlage anfassen."
sidebar:
  label: "1.3.1"
---

## Worum es geht

1.3.1 ist 1.3.0 mit hinzugefügtem arm64-Image. Der Code ist der von 1.3.0, das Chart ändert nur seine Version, und jede Einstellung, Route, jeder Bildschirm und jedes Tool ist, was 1.3.0 hat.

## Warum es ein eigenes Release ist

Multi-Arch kommt in einem eigenen Lauf. 1.3.0 wurde nur für amd64 gebaut, ging in Produktion und las sich dort als stabil, und dies ist der kleine Versionssprung, der beide baut. Ab hier führen `stable`, `latest`, `1.3`, `1` und `1.3.1` amd64 und arm64 auf.

## Upgrade und zurück

Keine Migrationen. `helm upgrade` auf 1.3.1, oder lassen Sie `:stable` die Quadlet-Units weiterbewegen. Eine arm64-Maschine, die das mit 1.2.1 ausgelieferte arm64-Image gezogen hat, bekommt jetzt das von 1.3.1, mit dem Editor in 14 Sprachen. 1.3.0 oder 1.2.1 zurückzuspielen ist sicher, weil sich in der Datenbank nichts geändert hat.
