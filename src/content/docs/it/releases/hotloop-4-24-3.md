---
title: "Note di rilascio: HotLoop core 4.24.3"
description: "Cosa porta HotLoop core 4.24.3, cosa cambia all'aggiornamento e cosa leggere prima di toccare un impianto in funzione."
sidebar:
  label: "4.24.3"
---

La 4.24.3 porta tutto ciò che è nella [4.24.2](/it/releases/hotloop-4-24-2/) su ogni scheda per cui costruiamo: Shelly di ogni generazione, telecamere ONVIF, Arduino tramite Firmata, password OPC UA di qualsiasi lunghezza, una coda di inoltro che si svuota dietro un collegamento lento, `--version` che nomina il proprio commit e un'installazione predefinita di HotLoop Edge che si avvia.

Il Gateway gira su amd64 e arm64, ed Edge, IoT e l'Edge Relay girano su amd64, arm64 e arm/v7, così la stessa versione copre i vostri server, i vostri Pi e i vostri vecchi gateway ARM. Leggete le [note della 4.24.2](/it/releases/hotloop-4-24-2/) per tutto ciò che è nuovo dalla 4.24.0.

- Tutti e quattro i chart (`hotloop`, `hotloop-iot`, `hotloop-edge`, `hotloop-edge-relay`) sono alla 4.24.3, con ogni versione precedente ancora nell'indice.
- Aggiornate come sempre: un `helm upgrade` al chart 4.24.3, o il nuovo tag nella vostra unità Quadlet. Non c'è nulla da migrare.
