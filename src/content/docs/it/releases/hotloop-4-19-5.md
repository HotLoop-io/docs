---
title: "Note di rilascio: HotLoop core 4.19.5"
description: "Cosa porta HotLoop core 4.19.5, cosa cambia all'aggiornamento e cosa leggere prima di toccare un impianto in funzione."
sidebar:
  label: "4.19.5"
---

Questa è la build multi-architettura della [4.19.4](/it/releases/hotloop-4-19-4/) e nient'altro. Il codice è quello dello stesso commit con la versione incrementata: nessuna correzione, nessuna funzione, nessun cambiamento di comportamento.

La 4.19.4 è stata costruita solo per amd64, in modo da arrivare in produzione e risultare stable prima che le immagini arm fossero costruite. La 4.19.5 costruisce il set completo: il Gateway per amd64 e arm64, e Edge, IoT e l'Edge Relay per amd64, arm64 e arm/v7. Un box arm passa dalle immagini che eseguiva al codice della 4.19.4 scaricando `stable`.

Leggi [le note della 4.19.4](/it/releases/hotloop-4-19-4/) per tutto ciò che è cambiato dall'ultima versione pubblicata.

- Tutti e quattro i chart (`hotloop`, `hotloop-iot`, `hotloop-edge`, `hotloop-edge-relay`) sono alla 4.19.5, con tutte le versioni precedenti ancora nell'indice.
- La prossima versione che porta modifiche lo riporta a `linux/amd64`.
