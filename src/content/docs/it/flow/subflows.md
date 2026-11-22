---
title: "Sottoflussi di HotLoop Flow"
description: "Racchiudere un insieme di nodi in un unico nodo riutilizzabile, con proprietà proprie, e che cosa condivide un sottoflusso con il flusso che lo circonda."
---

Ogni istanza riceve una copia propria dei nodi del modello, un proprio contesto di flusso e proprie proprietà risolte. Lo stesso modello mostra `4.2 bar` in un'istanza e `4.2 kPa` in quella successiva, verificato da capo a fondo con un rilascio reale e non affermato in un test unitario.

L'espansione produce un **grafo separato** invece di riscrivere i flussi analizzati, ed è tutta qui la scelta di progetto. Il file del flusso non viene mai toccato, quindi l'andata e ritorno identica byte per byte regge ancora, e il grafo espanso è un grafo ordinario, perciò lo scheduler, l'instradamento Catch, le metriche e gli eventi di stato dell'editor funzionano dentro un sottoflusso senza casi speciali.

L'annidamento funziona. Un errore che nessuno cattura dentro un sottoflusso esce fino al nodo Catch della scheda chiamante, perché altrimenti un sottoflusso sarebbe solo un posto dove gli errori spariscono. Un nodo di configurazione dichiarato dentro un modello è **condiviso** da tutte le istanze invece di essere copiato, dato che un broker MQTT in un sottoflusso è un autore che dice "condividi questo", e copiarlo aprirebbe una connessione per istanza verso qualcosa che quasi certamente le sta contando.
