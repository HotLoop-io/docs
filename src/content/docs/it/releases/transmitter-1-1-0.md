---
title: "Note di rilascio: HotLoop Transmitter 1.1.0"
description: "Ogni messaggio porta un timestamp dall'orologio del PLC e la libreria si installa da un pacchetto CODESYS: cosa è cambiato, cosa è stato eseguito e cosa no."
---

Ogni messaggio porta ora un timestamp dall'orologio del PLC, e la libreria ora si installa da un `.package` CODESYS.

Cosa significa per te: un sottoscrittore che vuole sapere quando un valore è stato campionato lo ricava dal pacchetto invece di dedurlo da quando è arrivato, e puoi installare la libreria con il CODESYS Installer come qualsiasi altro componente.

## Cosa cambia per un progetto che usa la 1.0.0

* **Timestamp, attivi per impostazione predefinita.** Il NetworkMessage e il DataSetMessage portano ciascuno un Timestamp (Parte 14, 7.2.4.4.2 e 7.2.4.5.4), lo stesso DateTime, letto dall'orologio real-time del PLC una volta per messaggio. ExtendedFlags1 passa da `01` a `21`, DataSetFlags1 da `69` o `6B` a `E9` o `EB`, e viene aggiunto un byte DataSetFlags2 `10`. Un messaggio è più lungo di 17 byte. L'elenco dei campi e i valori non sono cambiati, e `udiConfigMajor` è lo stesso.
* **`bTimestamp := FALSE` invia esattamente i byte della 1.0.0.** Impostalo se un tuo ricevitore rifiuta i timestamp. È stato verificato: messaggi da 1142 e 1144 byte, nessuno con timestamp, le dimensioni che inviava la 1.0.0.
* **La risoluzione è di un secondo.** L'orologio si legge con `SysTimeRtcGet`, che dà secondi interi, quindi un ricevitore vede lo stesso timestamp su ogni messaggio entro un secondo e può essere indietro fino a un secondo rispetto all'istante in cui il messaggio è stato costruito. I timestamp sotto il secondo sono nella roadmap.
* **Una nuova uscita, `diLastClockResult`.** Se l'orologio non si può leggere, il messaggio parte senza timestamp, cosa che la Parte 14 consente, e questa uscita dice perché.
* **Una nuova libreria di sistema, SysTimeRtc.** La libreria la nomina come segnaposto, come SysSocket, e il runtime la fornisce. Control for Linux SL 4.22.0.0 la fornisce. Un target che non l'ha non può usare la 1.1.0 con i timestamp; resta sulla 1.0.0.
* **Il `.package`.** `HotLoopTransmitter-1.1.0.package` è stato creato dal PackageManagerCLI di CODESYS stesso e mette la stessa libreria nel repository delle librerie tramite l'Installer. Vedi la [pagina di installazione](/it/transmitter/install/).

## Cosa abbiamo eseguito e cosa ha mostrato

Tutto su CODESYS Control for Linux SL 4.22.0.0, con i file qui sotto.

* La libreria compila con 0 errori e 0 avvisi in CODESYS 3.5.22.30. L'applicazione di esempio compila con essa con 0 errori e 0 avvisi.
* Due publisher, Variant e RawData, con i timestamp. Un decodificatore indipendente scritto dalla specifica decodifica ogni messaggio e ogni valore è uguale a quello che il PLC riporta dal proprio server OPC UA. Ogni messaggio ha entrambi i timestamp, sono lo stesso istante, non vanno mai indietro, rientrano nella tolleranza di secondo intero dell'orologio su cui è girata la cattura, e in una cattura di 11 secondi il timestamp si è spostato di 11 secondi. Il container condivide l'orologio dell'host, quindi questo mostra che il timestamp è la lettura dell'orologio del PLC e non uno inventato; non prova un controllore con l'orologio sbagliato.
* Uno stack PubSub indipendente legge il Timestamp del NetworkMessage e del DataSetMessage di tutti i 113 messaggi di ciascun writer con i propri decodificatori di intestazione, e decodifica i valori come per la 1.0.0.
* Il sottoscrittore di HotLoop core (dal suo ramo main quando è stata eseguita la prova, e in HotLoop core 4.19.4 e in tutte le versioni successive) legge entrambi i publisher su un runtime attivo: 21 valori ciascuno, entrambi i contatori che avanzano, nulla rifiutato. Ogni lettura porta come orario il timestamp a secondo intero del publisher, e il timestamp si è mosso con l'orologio del PLC durante un'attesa di 3 secondi.
* Il `.package` si installa con `PackageManagerCLI --install`, la libreria compare nel repository System (prima non c'era), e l'esempio compila con la libreria come l'Installer l'ha messa, con 0 errori e 0 avvisi.
* Costo su un task da 20 ms, con due publisher: circa 9,6 us aggiunti per ciclo in media, da 10 a 100 us nei cicli che inviano, e il ciclo più lungo della prova 81 us. In quella prova sono stati saltati tre slot di pubblicazione, e nessun invio è stato rifiutato. Il timestamp in sé non si vede nei numeri. La [pagina dei tempi](/it/transmitter/timing/) ha la tabella.

## Cosa verificare sul tuo controllore

* La gestione dell'ordine dei byte per un target big endian è scritta, quindi verificala sul tuo controllore.
* Multicast: il blocco imposta TTL, loopback e interfaccia di invio per il gruppo, quindi verifica il gruppo sulla tua rete.
* Se la rete sparisce o un indirizzo non c'è, il blocco conta l'errore e rallenta i tentativi, e il programma continua a eseguire la scansione.
* In modalità demo il runtime si ferma alla fine della sua finestra di due ore, come dice CODESYS.
* Un controllore il cui orologio real-time non è impostato o è sbagliato metterà il timestamp che l'orologio indica.

## Non incluso in questa versione

KeepAlive e Delta Frame, più di un DataSetMessage per NetworkMessage, WSTRING, uno stato per campo, timestamp sotto il secondo, sicurezza dei messaggi e il lato sottoscrittore. La [roadmap](/it/transmitter/roadmap/) dice quali sono i prossimi.

## Tornare indietro

Un progetto PLC fissato alla 1.0.0 continua a funzionare e a inviare i byte della 1.0.0. Dentro la 1.1.0, `bTimestamp := FALSE` dà gli stessi byte.

## File

Scaricali da https://hotloop.io/hotloop-transmitter/1.1.0/HotLoopTransmitter-1.1.0.library e controllali con `SHA256SUMS` nella stessa cartella.

```
5ec021b23f5d57460016834a03b2b196d6dbc83aeb5d0ad60ace8d7b4fbbb4a7  HotLoopTransmitter-1.1.0.library
e172f4674f6cbfce2aeaf017d5a6c733245b1b9aa3e527369c753bf07b6ce0c2  HotLoopTransmitter-1.1.0.compiled-library
b3686bdebd052f1ddea46d1f1ff409f3b6c9a016ca5f3e8f4cd6f7922ccb479c  HotLoopTransmitter-1.1.0.package
```
