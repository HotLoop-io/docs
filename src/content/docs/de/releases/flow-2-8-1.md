---
title: "Versionshinweise: HotLoop Flow 2.8.1"
description: "Was HotLoop Flow 2.8.1 bringt, was sich beim Update ändert und was Sie lesen sollten, bevor Sie eine laufende Anlage anfassen."
sidebar:
  label: "2.8.1"
---

HotLoop Flow 2.8.1 ist 2.8.0 mit dem arm64-Image dazu, und sonst nichts. 2.8.0 erschien nur für amd64, damit es zuerst in Produktion kam und als stabil galt, und dies ist der eine kleine Folgeschritt, der beide baut. An Code, Chart, Einstellungen oder Ihren Flows ändert sich nichts.

## Was sich geändert hat

- Das Image wird wieder für linux/amd64 und linux/arm64 gebaut. Die Tags `2.8.1`, `2.8` und `2` enthalten beide.
- README und Installationsseiten nennen 2.8.1 und sagen amd64 und arm64, wie vor 2.8.0.

## Neue Einstellungen

Keine.

## Upgrade

Ein schlichtes `helm upgrade` auf das Image und Chart von 2.8.1 oder das neue Tag in Ihrer Quadlet-Unit. Wenn Sie auf arm64 sind und auf 2.7.1 geblieben sind, während 2.8.0 nur amd64 war, ist das Ihr Schritt zu den Analyse-Nodes, dem Messdatenerfassungs-Node, der dauerhaften MQTT-Ausgabe und dem TDMS-Log: Lesen Sie die Hinweise zu 2.8.0, was sie sind und was nicht belegt ist. Beim ersten Start passiert nichts, und es gibt nichts zu migrieren.

Image: `ghcr.io/hotloop-io/hotloop-flow:2.8.1`, linux/amd64 und linux/arm64. Chart: `https://hotloop.io/hotloop-flow/`. Das README zu diesem Tag hat den Rest, mit Bildern: https://github.com/HotLoop-io/hotloop-flow/blob/v2.8.1/README.md
