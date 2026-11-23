---
title: "Versionshinweise: HotLoop Cascade 1.1.1"
description: "Was HotLoop Cascade 1.1.1 bringt, was sich beim Update ändert und was Sie lesen sollten, bevor Sie eine laufende Anlage anfassen."
sidebar:
  label: "1.1.1"
---

## Worum es geht

1.1.1 ist 1.1.0 mit hinzugefügtem arm64-Image und einem Label. Der Code ist der von 1.1.0, das Chart ändert nur seine Version, und jede Einstellung, Route und jeder Bildschirm ist, was 1.1.0 hat.

Das Label ist `org.opencontainers.image.version`. Das Image trug es nie, deshalb zeigte das Lesen der Image-Konfiguration keine Version. Es nennt jetzt die Version des Releases, gesetzt aus demselben Build-Argument, aus dem auch die Version des Binarys kommt.

## Warum es ein eigenes Release ist

Multi-Arch kommt in einem eigenen Lauf. 1.1.0 wurde nur für amd64 gebaut, ging in Produktion und las sich dort als stabil, und dies ist der kleine Versionssprung, der beide baut. Ab hier führen `stable`, `latest`, `1.1`, `1` und `1.1.1` amd64 und arm64 auf.

## Upgrade und zurück

Keine Migrationen. `helm upgrade` auf 1.1.1, oder lassen Sie `:stable` die Quadlet-Units weiterbewegen. Eine arm64-Maschine, die das arm64-Image gezogen hat, das 1.0.2 auslieferte, bekommt jetzt das von 1.1.1. 1.1.0 oder 1.0.2 zurückzuspielen ist sicher, weil sich in der Datenbank nichts geändert hat.
