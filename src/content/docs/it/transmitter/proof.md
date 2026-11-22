---
title: "Cosa è stato eseguito"
description: "Con cosa è stata compilata la libreria, dove è stata eseguita, chi l'ha riletta, e l'unico punto su cui due lettori non concordano."
---

Questa pagina riguarda la prova della 1.0.0. La prova della 1.1.0, con timestamp e `.package`, è nelle [note di rilascio 1.1.0](/it/releases/transmitter-1-1-0/). Da allora la libreria è stata eseguita su hardware senza sistema operativo (2026-11-17).

## La compilazione

* Libreria: compila con 0 errori e 0 avvisi nel ScriptEngine di CODESYS 3.5.22.30 (SP22 Patch 3).
* Applicazione di esempio, compilata con la libreria installata, per il dispositivo CODESYS Control for Linux SL (4102, 0000 0005, 4.20.0.0): 0 errori, 0 avvisi, pronta per il download.

## Il runtime

CODESYS Control for Linux SL 4.22.0.0 carica l'applicazione come progetto di avvio e riporta `Application started`, `CODESYS Control ready`. Funziona in modalità demo, perché non c'è una licenza runtime.

## Cosa è passato sul cavo e chi l'ha letto

L'applicazione di esempio ha due publisher: writer group 1 e dataset writer 1 in codifica Variant (1142 byte), e writer group 2 e dataset writer 2 in codifica RawData (1144 byte). Diciassette campi ciascuno: uno per ogni tipo supportato dalla libreria, un array REAL da 250 elementi, un array INT da 4 elementi e due contatori.

Lo hanno letto quattro lettori indipendenti.

| Lettore | Cos'è | Variant | RawData |
|---|---|---|---|
| Un decoder scritto dalla specifica | scritto solo da OPC 10000-14 e 10000-6, che legge anche le stesse variabili dal server OPC UA del runtime e le confronta | ogni campo uguale a quello del PLC, nessun buco nelle sequenze di NetworkMessage e DataSetMessage durante la cattura | lo stesso |
| Uno stack OPC UA PubSub indipendente | un subscriber con metadati DataSet dei 17 campi | tutti i 15 valori controllati sono uguali, compresi la stringa, entrambi gli array e il TIME | gli 11 scalari numerici sono uguali. Quello stack non legge stringhe RawData di alcuna lunghezza né array RawData |
| Il subscriber UADP di HotLoop core | il driver di HotLoop core 4.19.4 e di tutte le release successive, eseguito su un runtime attivo con il layout RawData indicato nei suoi tipi DataSet | 21 valori controllati uguali, compresi la stringa, il TIME e gli elementi 0, 1, 124 e 249 dell'array REAL da 250 e tutti e quattro dell'array INT, e i due contatori che avanzano tra due letture a 3 secondi di distanza | gli stessi 21 valori e gli stessi due contatori. 62 key frame ricevuti, nessuno rifiutato |
| Un secondo decoder | il decoder UADP del nostro codice ricevente, eseguito su 222 datagrammi catturati con il layout dei 17 campi | tutti i 111 messaggi decodificati, ogni valore controllato corretto | tutti i 111 messaggi decodificati, ogni valore controllato corretto, gli array con la loro lunghezza Int32 e il padding |

## Array e stringhe RawData

Questa libreria scrive un conteggio di elementi Int32 prima di ogni array RawData, e una stringa come lunghezza Int32, i suoi byte e poi padding di zeri fino a MaxStringLength. È ciò che fa lo stack di riferimento della OPC Foundation, e segue il testo della specifica: OPC 10000-14 7.2.4.5.11 ("handled like a Structure DataType", padding "to the maximum size indicated by ArrayDimensions or MaxStringLength") con OPC 10000-6 5.2.5 ("One dimensional Arrays are encoded as a sequence of elements preceded by the number of elements encoded as an Int32 value").

Il subscriber di HotLoop core e il secondo decoder leggono entrambi gli array RawData in questo modo, con la lunghezza e il padding, ed entrambi decodificano il RawData di questa libreria.

Una differenza rispetto allo stack di riferimento: dove quello solleva un'eccezione quando una stringa supera MaxStringLength, questa libreria la taglia al limite di un carattere, perché un task PLC non ha dove sollevare un'eccezione.

## Da sapere

* La prova è stata fatta su CODESYS Control for Linux SL 4.22.0.0 su x86-64. La libreria è Structured Text, e la gestione dell'ordine dei byte per un target big endian è scritta, ma va verificata sul vostro controllore.
* Multicast: il blocco imposta TTL, loopback e interfaccia di invio per un gruppo multicast. Controlli il gruppo sulla sua rete.
* Il blocco conta i fallimenti di invio e attende quando la rete scompare o un indirizzo non c'è, e il programma continua a scansionare.
* In modalità demo il runtime si ferma alla fine della sua finestra di due ore, come dice CODESYS.
