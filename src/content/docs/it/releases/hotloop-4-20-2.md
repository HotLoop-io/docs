---
title: "Note di rilascio: HotLoop core 4.20.2"
description: "Cosa porta HotLoop core 4.20.2, cosa cambia all'aggiornamento e cosa leggere prima di toccare un impianto in funzione."
sidebar:
  label: "4.20.2"
---

Due correzioni sopra la [4.20.1](/it/releases/hotloop-4-20-1/), e la licenza. Questa è la prima versione del core sotto la EmberNet Source License 1.0 (`LicenseRef-EmberNet-Source-1.0`): LICENSE, NOTICE, il README, le annotazioni dei chart e le etichette delle immagini lo dicono.

- **EtherNet/IP con più di un tag in un batch.** Il driver chiedeva un batch a `ReadMulti` della libreria, che prende una struct di campi etichettati o una map, e un semplice nome di tag la fa andare in panic in reflect prima che esca un solo byte. Quindi qualsiasi dispositivo EtherNet/IP con due o più tag in un batch mandava in panic il suo polling (i batch sono di venti per impostazione predefinita). Nessuno lo vide in un test perché nessun test aveva mai messo un batch contro un server. Ora i test eseguono un server EtherNet/IP e un server S7 nel processo, i driver li leggono via TCP, e il batch passa da `ReadList`. Un controllore che tace con il socket aperto è giù entro un polling più il suo timeout, come previsto, e non viene più interrogato di nuovo tag per tag, il che teneva il polling fermo un timeout per tag. S7comm ed EtherNet/IP non sono ancora provati contro un PLC fisico.
- **`version` è una parola.** `podman run ghcr.io/hotloop-io/hotloop:4.20.1 version` moriva con «database password is not set», perché solo `--version` veniva gestito prima di leggere la configurazione. Ora `version` stampa la versione con un ambiente vuoto, per Gateway, Edge e IoT, e per l'Edge Relay.

- Nessuna migrazione, nessun nuovo segreto, nessuna modifica all'API. Un normale `helm upgrade` o l'auto-update di Quadlet la prende.
- Tutti e quattro i chart (`hotloop`, `hotloop-iot`, `hotloop-edge`, `hotloop-edge-relay`) sono alla 4.20.2, con tutte le versioni precedenti ancora nell'indice.
- Questa build è solo amd64, e `stable` mantiene le immagini arm che ha. La versione successiva è un piccolo incremento di versione che costruisce le immagini arm.
