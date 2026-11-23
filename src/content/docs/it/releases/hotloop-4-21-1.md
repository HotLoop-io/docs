---
title: "Note di rilascio: HotLoop core 4.21.1"
description: "Cosa porta HotLoop core 4.21.1, cosa cambia all'aggiornamento e cosa leggere prima di toccare un impianto in funzione."
sidebar:
  label: "4.21.1"
---

Questa è la build multi-architettura della [4.21.0](/it/releases/hotloop-4-21-0/). Il codice del prodotto è lo stesso della 4.21.0: accesso X.509 per il server OPC UA, password da 72 byte, policy di sicurezza obsolete disattivate per impostazione predefinita e importazione degli allarmi CODESYS ampliata. La 4.21.0 era la build amd64, e `stable` ha mantenuto le immagini arm che già aveva.

La 4.21.1 costruisce il set completo: il Gateway per amd64 e arm64, e Edge, IoT e l'Edge Relay per amd64, arm64 e arm/v7. Leggi [le note della 4.21.0](/it/releases/hotloop-4-21-0/) per tutto ciò che è cambiato dalla 4.20.2, compreso il fatto che `Basic128Rsa15` e `Basic256` sono disattivate anche negli aggiornamenti.

- Tutti e quattro i chart (`hotloop`, `hotloop-iot`, `hotloop-edge`, `hotloop-edge-relay`) sono alla 4.21.1, con tutte le versioni precedenti ancora nell'indice.
