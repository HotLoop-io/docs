---
title: "Note di rilascio: HotLoop Transmitter 1.0.0"
description: "La prima versione di HotLoop Transmitter: una libreria CODESYS che pubblica i valori del PLC come OPC UA PubSub, cosa contiene, cosa è stato eseguito e cosa no."
---

Prima versione. Una libreria CODESYS, scritta in Structured Text su UDP di SysSocket, che mette i valori del tuo PLC sulla rete come OPC UA PubSub (Parte 14, UADP). Aggiungi la libreria, dichiari un function block, aggiungi le variabili da inviare e lo chiami una volta per ciclo. Qualsiasi sottoscrittore OPC UA PubSub può leggerlo, HotLoop core compreso, dalla 4.19.4 in poi.

Cosa significa per te: un PLC senza libreria PubSub può ora alimentare un sottoscrittore PubSub con una quindicina di righe di Structured Text, e sul controllore non si installa nient'altro.

## Cosa contiene

* Un blocco, `HLTX.FB_HLTX_Publisher`. Un NetworkMessage per intervallo di pubblicazione, un DataSetMessage, un Data Key Frame, così ogni messaggio contiene tutti i campi.
* Codifiche di campo Variant e RawData, scelte per ogni publisher. Variant porta con sé i propri tipi. RawData non ne porta alcuno, quindi il ricevitore deve conoscere la disposizione, che la [pagina del formato sul cavo](/it/transmitter/wire-format/) descrive byte per byte.
* Campi BOOL, SINT, USINT, INT, UINT, DINT, UDINT, LINT, ULINT, REAL, LREAL, STRING e TIME, e array di tutti questi tranne STRING, fino a 128 campi e 1472 byte per messaggio. Un messaggio non viene mai frammentato.
* Unicast o multicast, con ID del publisher, ID del writer group, ID del dataset writer, intervallo di pubblicazione, versione del gruppo e versione della configurazione come ingressi.
* Un invio non bloccante. Un indirizzo errato, un socket morto o un elenco di campi troppo grande mettono il blocco in uno stato di errore che puoi leggere e non mandano mai in errore la tua applicazione.

## Cosa abbiamo eseguito e cosa ha mostrato

Tutto su CODESYS Control for Linux SL 4.22.0.0, con i file qui sotto.

* La libreria compila con 0 errori e 0 avvisi in CODESYS 3.5.22.30. L'applicazione di esempio compila con essa con 0 errori e 0 avvisi.
* Due publisher, uno Variant e uno RawData, di diciassette campi ciascuno. Ogni valore sul cavo è uguale a quello che il PLC riporta dal proprio server OPC UA, senza vuoti nei numeri di sequenza.
* Uno stack PubSub indipendente decodifica per intero il messaggio Variant e gli scalari RawData. Non riesce a leggere affatto un array RawData né una stringa RawData lunga, e questo è il suo limite, non quello della libreria.
* Il sottoscrittore di HotLoop core (dal suo ramo main quando è stata eseguita la prova, e in HotLoop core 4.19.4 e in tutte le versioni successive) legge entrambi i publisher, compresi la stringa, il TIME, i due array e due contatori che cambiano tra una lettura e l'altra, e non rifiuta nulla.
* Un secondo decodificatore legge tutti i 222 datagrammi catturati.
* Costo su un task da 20 ms, con due publisher: circa 10,6 us aggiunti per ciclo in media. Un ciclo che invia costa da 10 a 100 us. La coda è la chiamata `sendto`, e su un host condiviso occupato ha raggiunto una volta 14,3 ms su 12 000 cicli. Metti il publisher in un task a priorità più bassa se conta per la logica del tuo controllo. La [pagina dei tempi](/it/transmitter/timing/) ha la tabella.

## Cosa verificare sul tuo controllore

* La gestione dell'ordine dei byte per un target big endian è scritta, quindi verificala sul tuo controllore.
* Multicast: il blocco imposta TTL, loopback e interfaccia di invio per il gruppo, quindi verifica il gruppo sulla tua rete.
* Se la rete sparisce o un indirizzo non c'è, il blocco conta l'errore e rallenta i tentativi, e il programma continua a eseguire la scansione.
* In modalità demo il runtime si ferma alla fine della sua finestra di due ore, come dice CODESYS.

## Non incluso in questa versione

Timestamp di DataSetMessage e NetworkMessage, KeepAlive e Delta Frame, più di un DataSetMessage per NetworkMessage, WSTRING, uno stato per campo, la sicurezza dei messaggi e il lato sottoscrittore. La [roadmap](/it/transmitter/roadmap/) dice quali sono i prossimi.

## Se arrivi da un altro publisher

Un ricevitore che pretende un timestamp, un KeepAlive o un Delta Frame non sarà soddisfatto da questa versione, perché nessuno dei tre viene inviato. Ogni messaggio è un Key Frame, che qualsiasi ricevitore può leggere a freddo. Un array RawData qui è una lunghezza Int32, gli elementi e un riempimento di zeri fino alla dimensione dichiarata, che è come lo scrive lo stack di riferimento della OPC Foundation. A un ricevitore che si aspetta un array come elementi consecutivi senza lunghezza va detto che i campi sono scalari separati.

## Per un progetto che la usa già

Non esiste una versione precedente. Il formato sul cavo cambia solo quando cambia `udiConfigMajor`, e un progetto PLC fissato a questa versione della libreria mantiene gli stessi campi e gli stessi byte.

## File

Scarica entrambi i file e `SHA256SUMS` da https://hotloop.io/hotloop-transmitter/1.0.0/, poi installa `HotLoopTransmitter-1.0.0.library` da Strumenti, Repository librerie, Installa in CODESYS 3.5 SP22 o successivo. Il `.compiled-library` è la stessa libreria senza il suo sorgente.

```
91b8023a73870925082c170588feb43d363e6d07ce008e1471fa8f5ff8db2c0d  HotLoopTransmitter-1.0.0.library
b02b0b40e434f35e4af1def20d6cc38688463537c4800354931b8c6094a66686  HotLoopTransmitter-1.0.0.compiled-library
```
