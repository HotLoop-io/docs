---
title: "Roadmap di HotLoop for CODESYS"
description: "Ciò che HotLoop for CODESYS ha costruito, pubblicato ed eseguito su hardware reale."
sidebar:
  label: "Roadmap"
editUrl: false
---

Questo è l'elenco di ciò che è fatto e di ciò che resta, nell'ordine in cui si fa. Non promette nulla che non sia nel codice o in un piano di test, e [Stato](/it/codesys/where-it-stands/) dice fin dove è stato eseguito.

## Costruito

- [x] Un chart attorno a HotLoop Edge con valori predefiniti per un runtime su un nodo: SQLite, una replica, tolleranze che mantengono entrambi i pod in caso di perdita del control plane.
- [x] Un provisioner che applica un profilo e lo mantiene corretto, con una revisione che protegge ciò che una persona ha modificato.
- [x] Un profilo che porta una lista di dispositivi di qualsiasi protocollo parlato da HotLoop, così un listener torna configurato senza bisogno di un PLC.
- [x] Dispositivo, tag, allarme e schermata creati senza passaggi manuali, contro un runtime CODESYS Control for Linux SL 4.22.0.0 in un container.
- [x] Ripristino dopo un riavvio del runtime senza intervento, in circa 88 secondi.
- [x] Un accesso firmato dal dashboard EmberCORE, con i rifiuti.

## Rilasciato

- [x] HotLoop 4.22.0, la release che il chart racchiude.
- [x] Il chart pubblicato su `https://hotloop.io/hotloop-codesys/`, con 0.3.8 il più recente.
- [x] L'immagine del provisioner pubblica, quindi scaricabile senza login, 0.3.3.
- [x] Un'immagine multi-architettura del provisioner, amd64 e arm64, da 0.3.3 e dal chart 0.3.8.
- [x] Due listener OPC UA PubSub su una stessa porta UDP, con HotLoop 4.22.0 e il chart 0.3.7.
- [x] [Note di rilascio](/it/releases/codesys-0-3-10/) per ogni chart, da 0.3.0 a 0.3.10.

## Provato su hardware senza sistema operativo

- [x] Eseguito su hardware senza sistema operativo (2026-11-17), compresa un'installazione dalla vera pagina dell'App Store come la fa il personale, k3s v1.35.7, un nodo che perde davvero il collegamento con il control plane mantenendo i pod, un download dall'IDE CODESYS mentre il runtime resta attivo, un runtime sulla rete propria dell'host accanto al pod HotLoop su un nodo, e un runtime con la gestione utenti attiva e un endpoint OPC UA protetto da certificato.

## Da costruire

- [ ] Più di una schermata in un profilo.
