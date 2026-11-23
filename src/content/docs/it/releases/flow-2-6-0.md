---
title: "Note di rilascio: HotLoop Flow 2.6.0"
description: "Cosa porta HotLoop Flow 2.6.0, cosa cambia con l'aggiornamento e cosa leggere prima di toccare un impianto in funzione."
sidebar:
  label: "2.6.0"
---

HotLoop Flow 2.6.0 dà a un collegamento durevole un modo per dirti che ha smesso di consegnare. Nulla di come girano i tuoi flussi cambia. Se usi collegamenti durevoli su una linea d'impianto, ottieni un contatore su cui impostare un allarme per l'unico guasto che prima sembrava una coda tranquilla.

## Novità

**Un collegamento durevole bloccato viene contato e descritto.** La pompa di un collegamento durevole ora si accorge di quando il collegamento dice che ci sono messaggi in attesa e la coda non contiene nulla che possa leggere, e la situazione è la stessa dopo un breve ricontrollo. Aggiunge uno a `hotloop_flow_durable_wire_stranded_total{wire=...}` e scrive un avviso nel log del runtime, una volta per tipo di guasto, con i contatori del collegamento accanto a ciò che contiene la sua tabella: fin dove è arrivata la pompa, la profondità, le righe su disco, ciò che è in volo e quanti sono stati aggiunti, consegnati e scartati. Su un collegamento sano il contatore è zero e resta zero, quindi qualsiasi valore sopra zero merita un allarme.

L'abbiamo aggiunto perché un collegamento che scarta il più vecchio non è riuscito a svuotarsi una volta su qualche migliaio di esecuzioni di test e non siamo riusciti a capire perché. Questa versione è lo strumento, non una correzione. Se mai scatta sulla tua linea, la riga di log è ciò che ci serve.

## Cosa è cambiato

- Il testo di licenza distribuito nell'immagine scrive EmberNet come fa la copia canonica. Tre righe, solo ortografia.
- Le immagini del README sono immagini semplici, prima chiare poi scure, così si vedono su docs.hotloop.io.

## Nuove impostazioni

Nessuno. La metrica è attiva e non c'è alcun interruttore.

## Aggiornamento

Un semplice `helm upgrade` all'immagine e al chart della 2.6.0, o il nuovo tag nella tua unità Quadlet. Al primo avvio non succede nulla, non c'è niente da migrare, e i flussi, i record di deploy e le credenziali non vengono toccati.

Immagine: `ghcr.io/hotloop-io/hotloop-flow:2.6.0`, linux/amd64 e linux/arm64. Chart: `https://hotloop.io/hotloop-flow/`. Il README a questo tag ha il resto, con le immagini: https://github.com/HotLoop-io/hotloop-flow/blob/v2.6.0/README.md
