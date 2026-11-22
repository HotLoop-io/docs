---
title: "Stato di HotLoop for CODESYS"
description: "Contro cosa è stato eseguito HotLoop for CODESYS su hardware reale, e cosa è pubblicato."
sidebar:
  label: "Stato"
editUrl: false
---

Questa pagina dice cosa è pubblicato e fin dove è stato eseguito HotLoop for CODESYS.

## Cosa è uscito

- **Il chart.** `hotloop-codesys` 0.3.8 è nell'indice su `https://hotloop.io/hotloop-codesys/`, pubblicato il 2026-11-19, con tutte le versioni precedenti ancora accanto. Racchiude HotLoop 4.22.0. Installi la 0.3.8: [le note di rilascio](/it/releases/codesys-0-3-5/) dicono cosa ha cambiato ogni chart.
- **L'immagine del provisioner.** `ghcr.io/hotloop-io/hotloop-provision` alla 0.3.3 si scarica senza login, per amd64 e per arm64, e il chart la esegue.
- **La scheda dell'App Store.** È nell'App Store di EmberCORE, e EmberNet la installa sul vostro tenant.

## Fin dove è stato eseguito

Il chart su un nodo k3s con valori a forma di Store, un vero runtime CODESYS Control for Linux SL 4.22.0.0 sullo stesso nodo che esegue un programma demo, e un'immagine HotLoop Edge.

- Il dispositivo, i suoi tag (nessuno scrivibile), il suo allarme e la sua schermata sono comparsi senza alcun passaggio manuale.
- Ogni valore si è letto bene e si è mosso.
- I pod sono tornati dopo l'eliminazione di un pod.
- L'installazione si è letta come cattiva con il motivo "the PLC's runtime is not answering" durante un riavvio del runtime, ed è tornata da sola circa 88 secondi dopo.
- Un accesso firmato dal dashboard ha fatto entrare una persona come operatore o come amministratore, e un'app sbagliata, un tenant sbagliato, uno scaduto, un emittente sbagliato e uno manomesso sono stati rifiutati ciascuno.
- Il chart pubblicato si genera dall'indice in linea con Helm.

Il connettore sottostante, il driver CODESYS di HotLoop core, è verificato dal vivo contro un runtime CODESYS Control for Linux SL 4.22.0.0, per letture e scritture, e su hardware senza sistema operativo (2026-11-17). Le scritture ci sono nel connettore, e questo prodotto non le attiva mai.

Tutto questo è stato eseguito anche su hardware senza sistema operativo (2026-11-17).

## Cosa un profilo non può ancora fare

Un profilo crea una schermata. Crea un dispositivo da `device`, o più dispositivi di qualsiasi protocollo da `devices`, e non c'è modo di segnare una variabile come scrivibile da esso, di proposito.
