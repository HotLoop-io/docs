---
title: "A che punto è Flow"
description: "Contro quale apparecchiatura reale è stato provato Flow, e da dove veniva prima di essere HotLoop Flow."
---

**Funziona.** Parte, serve l'API e l'editor, carica i flussi dal volume, sposta messaggi e torna dopo un riavvio con i suoi flussi, le credenziali e il contesto. Il chart lo distribuisce in tutte e tre le modalità di rete e l'intera catena di pubblicazione si risolve. Gira in un vero impianto.

**Verificato su infrastruttura reale**: Mosquitto, InfluxDB e PostgreSQL. Il valore di tag di InfluxDB è tornato da un vero database come `press 01,west` con lo spazio e la virgola intatti. È il bug di escape che altrimenti frammenta una serie in silenzio e costa a qualcuno un giorno per trovarlo.

**Cookie e multipart rispondono come le librerie di Node-RED**, perché sono stati confrontati con esse, su oltre cento casi, e le risposte sono finite in un file golden che i test riproducono attraverso socket reali. Ciò include i casi brutti: un nome file UTF-8 esce mal formato esattamente come lo rovina lo stack di Node-RED, e un cookie chiamato `value` perde il suo valore in `msg.responseCookies`, come là. Riprodurre i bug è il punto. Un flusso che si appoggia a uno di essi si rompe il giorno in cui non c'è più.

**Eseguito su hardware reale (2026-11-17):** i nodi S7 ed EtherNet/IP, i collegamenti durevoli (store and forward e le scritture su disco) e i plugin, con le loro trappole e i loro rifiuti e un plugin firmato in un cluster reale. I numeri di scrittura su disco e per chiamata restano etichettati con il luogo in cui sono stati misurati.

Che cosa si costruisce dopo, e in quale ordine, è nella [roadmap](/it/flow/roadmap/).

## Prima di HotLoop Flow

Si chiamava Emberwire, e `v0.1.0` è ancora dov'era, a `ghcr.io/embernet-ai/emberwire:0.1.0`. `2.0.0` è stata la prima versione con questo nome, e la 2.x non legge nulla di ciò che ha scritto il vecchio nome: le variabili `EMBERWIRE_*`, i due tipi di nodo database `emberwire-`, un modulo WASM compilato contro le vecchie esportazioni e il file di credenziali di 0.1.0 vanno rifatti. È una rottura netta voluta. Nessuno aveva costruito su 0.1.0, e un adattatore per zero utenti è solo altro codice che può sbagliare. Dalla 2.0.1 un vecchio file di credenziali riceve un messaggio chiaro che nomina il file, dice che l'ha scritto Emberwire e chiede di metterlo da parte e di inserire di nuovo le credenziali.