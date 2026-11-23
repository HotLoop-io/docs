---
title: "Note di rilascio: HotLoop for CODESYS 0.3.3"
description: "Chart 0.3.3 di HotLoop for CODESYS: avvolge HotLoop 4.20.0, così la nuova interfaccia web e gli strumenti MCP raggiungono i tester."
sidebar:
  label: "0.3.3"
---

## Cosa è cambiato

0.3.3 è nell'indice `{{codesysChartRepo}}`, pubblicato il 2026-11-15. Il provisioner è lo stesso che eseguiva 0.3.2.

- **Avvolge HotLoop 4.20.0.** La nuova interfaccia web è la pagina a `/`, e un agente può cambiare tutto ciò che può leggere tramite MCP, dietro il write gate.

Cosa significa per te: una box su 0.3.3 ottiene la nuova interfaccia e gli strumenti MCP con un aggiornamento del chart e nient'altro.

## Cosa è stato verificato

Un aggiornamento da 0.3.1 con un profilo applicato a 0.3.3, accanto a un runtime CODESYS Control for Linux SL 4.22.0.0: è partito un nuovo pod su 4.20.0, i dispositivi e i loro 2232 tag c'erano ancora, e i listener si sono riconnessi. È stato eseguito su hardware reale (2026-11-17).
