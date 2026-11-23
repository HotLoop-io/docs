---
title: "Versionshinweise: HotLoop Cascade 1.5.1"
description: "Was HotLoop Cascade 1.5.1 bringt, was sich beim Update ändert und was Sie lesen sollten, bevor Sie eine laufende Anlage anfassen."
sidebar:
  label: "1.5.1"
---

## Worum es geht

1.5.1 ist 1.5.0 mit hinzugefügtem arm64-Image. Der Code ist der von 1.5.0, das Chart ändert nur seine Version, und jede Einstellung, Route, jeder Bildschirm und jedes Tool ist, was 1.5.0 hat, einschließlich dessen, dass ein Eigentümer eine Person löscht.

## Warum es ein eigenes Release ist

Multi-Arch kommt in einem eigenen Lauf. 1.5.0 wurde nur für amd64 gebaut, und dies ist der kleine Versionssprung, der beide baut. Ab hier führen `stable`, `latest`, `1.5`, `1` und `1.5.1` amd64 und arm64 auf.

## Upgrade und zurück

Keine Migrationen. `helm upgrade` auf 1.5.1, oder lassen Sie `:stable` die Quadlet-Units weiterbewegen. Eine arm64-Maschine, die das arm64-Image gezogen hat, das 1.4.2 auslieferte, bekommt jetzt das von 1.5.1. 1.5.0 oder 1.4.2 zurückzuspielen ist sicher, weil sich in der Datenbank nichts geändert hat.
