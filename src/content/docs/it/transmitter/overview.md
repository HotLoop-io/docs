---
title: "HotLoop Transmitter: panoramica"
description: "Una libreria CODESYS in Structured Text su SysSocket UDP che pubblica i valori del PLC come OPC UA PubSub (UADP), senza altre librerie né configuratore."
---

HotLoop Transmitter mette in rete i valori di un PLC come OPC UA PubSub, come prescrive la Parte 14 della specifica OPC UA, da una libreria che si aggiunge al progetto CODESYS. È un trasmettitore nel senso dell'anello di strumentazione: la parte che mette sul cavo il valore di processo perché qualcun altro lo legga.

È scritta in Structured Text su `SysSocket` UDP e non richiede altre librerie, licenze aggiuntive o configuratori. Si aggiunge la libreria, si chiama un function block una volta per ciclo, e un NetworkMessage UADP parte a ogni intervallo di pubblicazione verso un indirizzo unicast o un gruppo multicast.

Cosa significa per voi: un PLC senza libreria PubSub può comunque alimentare qualsiasi cosa si abboni a OPC UA PubSub, HotLoop compreso, con poche righe di Structured Text. Ogni messaggio porta un timestamp dall'orologio del PLC, a meno che non lo disattivi con `bTimestamp`.

## Perché Structured Text e non Go

Ogni nuovo strumento HotLoop è scritto in Go, salvo un motivo reale. Questo è il motivo reale: deve girare dentro il ciclo di scansione del PLC, nel runtime IEC 61131-3, come libreria che il programmatore richiama dal suo progetto. Un runtime CODESYS esegue Structured Text, non Go. I test e gli strumenti attorno alla libreria (lo strumento di cattura, il verificatore) sono in Go.

## Come usarla

1. Installi `HotLoopTransmitter-1.2.0.library` nel repository delle librerie CODESYS (Tools, Library Repository, Install), oppure installi `HotLoopTransmitter-1.2.0.package` con il CODESYS Installer, poi la aggiunga al Library Manager del progetto. La [pagina di installazione](/it/transmitter/install/) ha i download e i dettagli.
2. Dichiari un publisher, aggiunga una volta all'avvio le variabili da pubblicare e lo chiami a ogni ciclo:

```iecst
PROGRAM PLC_PRG
VAR
    pub : HLTX.FB_HLTX_Publisher;
    bInit : BOOL;
END_VAR

IF NOT bInit THEN
    bInit := TRUE;
    pub.sDestination := '239.0.0.22';        // a unicast host or a multicast group
    pub.uiPort := 4840;
    pub.uiPublisherId := 1;
    pub.uiWriterGroupId := 1;
    pub.uiDataSetWriterId := 1;
    pub.tPublishingInterval := T#100MS;
    pub.AddReal(ADR(GVL.rTemperature));
    pub.AddBool(ADR(GVL.bRunning));
    pub.AddArray(ADR(GVL.aValues), HLTX.E_HLTX_Type.REAL_T, 250);
END_IF
pub.bEnable := TRUE;
pub();
```

La [pagina dell'API](/it/transmitter/api/) elenca ogni ingresso, uscita e metodo. La [pagina del formato sul cavo](/it/transmitter/wire-format/) descrive il pacchetto byte per byte, con le sezioni della specifica che definiscono ogni byte.

## Cosa farà e cosa non farà al vostro ciclo

* Non blocca mai. Il socket è non bloccante e il messaggio viene costruito in un buffer fisso.
* Il costo di una chiamata è il costo di costruire un messaggio, e si paga solo nei cicli in cui parte un messaggio. Misurato su un task da 20 ms con due publisher e timestamp attivi: circa 9,6 us aggiunti per ciclo in media, da 10 a 100 us nei cicli che inviano, e il ciclo più lungo della prova è stato di 81 us. Un host occupato ha allungato un singolo invio fino a millisecondi. I numeri misurati e i loro limiti sono nella [pagina dei tempi](/it/transmitter/timing/).
* Un errore di socket, un indirizzo errato o una lista di campi troppo grande non manda mai in errore l'applicazione. Il blocco riporta un `eState` e un `eError`, conta il guasto, e il programma continua a scansionare.
* Non frammenta. Un messaggio è al massimo di 1472 byte. Una lista di campi che non ci sta mette il blocco in `ConfigError` e non invia nulla.

## Testata con

Il runtime CODESYS Control for Linux SL 4.22.0.0, e su hardware senza sistema operativo (2026-11-17). Vedi la [pagina dei tempi](/it/transmitter/timing/) e la [pagina delle prove](/it/transmitter/proof/) per cosa è stato eseguito e riletto.

La usate in uno stabilimento? [Usare HotLoop in azienda](/it/business/) spiega le licenze e come contattarci.

## Licenza

L'HotLoop Source License Agreement 1.0, come ogni prodotto HotLoop. È gratuita da usare e con sorgente disponibile, non open source secondo l'OSI, e la sua sezione 5 permette di integrare la libreria nei propri progetti PLC e di consegnare o vendere il risultato compilato, mai la libreria stessa. La [pagina della licenza](https://hotloop.io/license/) ha il testo.
