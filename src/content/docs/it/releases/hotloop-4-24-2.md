---
title: "Note di rilascio: HotLoop core 4.24.2"
description: "Cosa porta HotLoop core 4.24.2, cosa cambia all'aggiornamento e cosa leggere prima di toccare un impianto in funzione."
sidebar:
  label: "4.24.2"
---

HotLoop legge e controlla direttamente i dispositivi Shelly di ogni generazione, trova le telecamere ONVIF e ne serve i flussi, le istantanee e brandeggio, inclinazione e zoom, parla con gli Arduino tramite Firmata e invia una password OPC UA di qualsiasi lunghezza come chiede la specifica. Un collegamento lento non tiene più un nodo di bordo sul suo disco, e `--version` indica il commit da cui è stata compilata un'immagine. Un'installazione predefinita di HotLoop Edge si avvia. Compilata solo per amd64; la compilazione multi-architettura segue come versione successiva.

## Cosa è cambiato

- **Shelly, di ogni generazione.** Gen2 e successive via RPC con un websocket in tempo reale, così una variazione e la pressione di un pulsante arrivano nell'istante in cui avvengono, e Gen1 tramite la propria interfaccia HTTP. La pressione di un pulsante viene registrata nel registro eventi sotto il dispositivo. Vedi SHELLY.md.
- **Telecamere ONVIF.** Trova le telecamere in rete (WS-Discovery), legge le informazioni di ogni dispositivo, l'indirizzo del flusso e dell'istantanea di ogni profilo multimediale (Media e Media2), brandeggio, inclinazione e zoom, e gli eventi propri della telecamera come tag e righe del registro eventi. L'immagine corrente di un profilo è a una route di distanza. Vedi ONVIF.md.
- **Arduino tramite Firmata.** USB seriale o TCP, con pin digitali e analogici, PWM, servo e dispositivi I2C come tag. Vedi FIRMATA.md.
- **Password OPC UA di qualsiasi lunghezza.** Le password oltre i 64 byte ora viaggiano su OPC UA come chiede la specifica (RsaEncryptedSecret, parte 4, 7.40.4), dal client e verso il server, e i server più vecchi continuano ad accettare l'accesso. Verificato contro lo stack della stessa OPC Foundation. Vedi [il server OPC UA](/it/edge/opc-ua-server/).
- **Un collegamento lento non inchioda più il nodo al disco.** Il passaggio che prende l'ultimo tratto del disco ora invia dalla memoria ciò che arriva dopo, così una coda di inoltro dietro un collegamento lento si svuota e il nodo lascia il disco invece di fare fsync a ogni interrogazione.
- **`--version` indica il commit.** Ogni immagine riporta il commit da cui è stata compilata oltre alla versione.
- **Una schermata CODESYS accanto al suo WebVisu.** L'importazione di una visualizzazione CODESYS viene eseguita contro un vero WebVisu, guidata dalle stesse variabili PLC, e i due vengono confrontati in un browser.
- **La voce della roadmap di docs/legacy è spuntata.**
- **Un'installazione predefinita di HotLoop Edge si avvia.** Il pod non legge più il token Gotify, l'URL del webhook Discord o il token del bot Discord da un Secret che non esiste: ciascuno viene inviato solo quando la sua credenziale è impostata, e il controllo del chart fallisce per ogni riferimento a quel Secret che il render non crea. Un chart con una destinazione impostata, o con un Secret esistente indicato, si renderizza come prima.
- **Il laboratorio Ignition, in entrambe le direzioni.** La prova di HotLoop con Ignition ora funziona anche nel senso opposto, si aggiunge una prova di UADP multicast attraverso un router e viene misurato il report più grande. Vedi [Report pianificati](/it/gateway/reports/).
- **I test aspettano ciò che stanno aspettando.** Il riscaldamento dell'app del telefono attende una pagina con accesso effettuato, e il modulo dell'energia compila i suoi campi in un solo passaggio.

## Migrazioni

Nessuna.

## Modifiche all'API

Due route, entrambe nuove. `POST /api/onvif/discover` (`devices.write`) sonda la rete in cerca di telecamere ONVIF e non aggiunge nulla. `GET /api/onvif/{id}/profiles/{profile}/snapshot` (`devices.read`) restituisce il JPEG corrente di un profilo di telecamera. Nessuna route esistente è cambiata. Vedi [l'API HTTP](/it/iot/api/).

## Aggiornare dalla 4.24.0

Un normale `helm upgrade`. Nessuna migrazione e nessun nuovo segreto.

## Cosa non è provato

- Shelly, ONVIF e Firmata sono stati eseguiti contro registrazioni di dispositivi reali, lo stack generato da ONVIF stesso e lo StandardFirmata del progetto Arduino su un Uno simulato. Nessuno Shelly, telecamera o Arduino fisico è ancora passato dal banco.
- Il confronto affiancato con WebVisu viene eseguito in test contro un runtime CODESYS Control for Linux SL 4.22.0.0.
