---
title: "Note di rilascio: HotLoop Flow 2.9.1"
description: "Cosa porta HotLoop Flow 2.9.1, cosa cambia con l'aggiornamento e cosa leggere prima di toccare un impianto in funzione."
sidebar:
  label: "2.9.1"
---

HotLoop Flow 2.9.1 permette al nodo `modbus-server` di restare in ascolto sull'interfaccia di una VLAN, così un solo Flow può eseguire un server su ogni VLAN di una porta, con lo stesso indirizzo e la stessa porta.

## Novità

- **`modbus-server` accetta un'interfaccia di rete.** Il socket in ascolto viene legato all'interfaccia (`SO_BINDTODEVICE`) prima di mettersi in ascolto, quindi due server su `192.168.1.9:10502` su due VLAN non vanno più in conflitto. L'impostazione è la stessa di ogni client: l'**Interfaccia di rete** del nodo stesso, altrimenti `FLOW_NETWORK_INTERFACE` nelle variabili d'ambiente della sua scheda. Senza nessuna delle due, ascolta come sempre, e due server sullo stesso indirizzo e porta vanno ancora in conflitto, ora con un errore che dice che ognuno ha bisogno di un'interfaccia.

## Cosa è cambiato

- Se non impostato, si comporta come l'upstream. NOTICE e `HOTLOOP_PATCH.txt` dicono cosa è cambiato.

## Nuove impostazioni

Nient'altro oltre al campo **Interfaccia di rete** su `modbus-server`. Il valore del chart `bindToInterface.netRaw` e il requisito della rete dell'host della 2.9.0 valgono per esso come per i client.

## Aggiornamento

Un semplice `helm upgrade` all'immagine e al chart 2.9.1, oppure il nuovo tag nella tua unità Quadlet. Al primo avvio non succede nulla e non c'è nulla da migrare. Un flow che non imposta nessuna interfaccia si comporta esattamente come sulla 2.9.0.

Immagine: `ghcr.io/hotloop-io/hotloop-flow:2.9.1`, prima linux/amd64, con arm64 a seguire nella 2.9.2. Chart: `https://hotloop.io/hotloop-flow/`. Il README di questo tag ha il resto, con le immagini: https://github.com/HotLoop-io/hotloop-flow/blob/v2.9.1/README.md
