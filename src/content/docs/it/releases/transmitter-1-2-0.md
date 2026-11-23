---
title: "Note di rilascio: HotLoop Transmitter 1.2.0"
description: "HotLoop Alarms entra nella versione: una libreria che porta gli allarmi propri di un PLC dove HotLoop li legge. Il publisher non cambia."
---

Questa versione aggiunge HotLoop Alarms, una seconda libreria che porta gli allarmi propri del tuo PLC dove HotLoop li legge, e distribuisce il Transmitter come 1.2.0.0 con lo stesso publisher che aveva nella 1.1.0.

Cosa significa per te: gli allarmi che il tuo progetto CODESYS già genera compaiono nell'elenco allarmi di HotLoop, e riconoscerne uno in HotLoop lo riconosce nel PLC. Se usi solo il publisher, non c'è nulla da cambiare.

## Cosa cambia per un progetto che usa la 1.1.0

* **HotLoop Alarms 1.0.0.0, nuova.** `HotLoopAlarms-1.0.0.0.library` e `.compiled-library` sono nella versione. Il blocco, `HLAL.FB_HLAL_Alarms`, è un client del gestore allarmi di CODESYS. Chiamato una volta per ciclo, copia gli allarmi attivi, in attesa e riconosciuti in una tabella di variabili semplici (`aAlarms`, 64 righe) che il server OPC UA del runtime esporta come qualsiasi altra variabile. `udiChanges` aumenta quando la tabella è cambiata, e `uiDropped` conta gli allarmi attivi che non ci stavano invece di perderli in silenzio. Non richiede alcuna libreria connettore di allarmi generata, solo l'Alarm Configuration del progetto.
* **Il riconoscimento torna indietro.** Una scrittura delle variabili di comando (`uiAckGroupId`, `uiAckAlarmId`, `udiAckInternalId` o `bAckAll`, poi un nuovo numero in `udiAckRequest`) fa riconoscere al blocco quell'allarme, o tutti, tramite il gestore allarmi. HotLoop 4.23.6 e successive trova il blocco da ciò che contiene e fa tutto questo per te.
* **Il publisher del Transmitter non è cambiato.** L'elenco dei campi e il formato sul cavo non si sono mossi, e `bTimestamp` funziona come prima. La libreria è ricompilata come 1.2.0.0, e il `.package` la contiene.
* **La licenza è la HotLoop Source License Agreement 1.0,** la stessa di ogni prodotto HotLoop.

## Cosa ho eseguito e cosa ha mostrato

Tutto in laboratorio, su CODESYS Control for Linux SL 4.22.0.0 in un container.

* La libreria Transmitter compila con 0 errori e 0 avvisi in CODESYS 3.5.22.30, e lo stesso vale per le applicazioni di esempio compilate con essa.
* Il laboratorio: due publisher, Variant e RawData, 114 messaggi decodificati per ciascuno, ogni valore uguale a quello che il PLC riporta dal proprio server OPC UA, nessun vuoto nei numeri di sequenza, entrambi i timestamp in ogni messaggio, e i byte della 1.0.0 con `bTimestamp := FALSE`. Un'implementazione indipendente di OPC UA PubSub legge i valori e i timestamp di ogni messaggio. 128 verifiche superate e nessuna fallita.
* Il sottoscrittore UADP di HotLoop core legge entrambi i publisher su un runtime attivo: ogni valore uguale, entrambi i contatori che avanzano, 62 key frame ricevuti e nessuno rifiutato.
* Il `.package` si installa con `PackageManagerCLI --install`, la libreria compare nel repository System, e l'esempio compila con essa con 0 errori e 0 avvisi.
* HotLoop Alarms: su un runtime reale con un'Alarm Configuration di due allarmi, uno scatto nel PLC compare in HotLoop, un riconoscimento in HotLoop porta la tabella del PLC a riconosciuto con l'ora, un reset la porta a in attesa di conferma, e una conferma in HotLoop svuota la tabella del PLC. Il secondo allarme segue l'ordine inverso, e riconosci-tutti ha riconosciuto entrambi gli allarmi attivi.
* Costo del publisher su un task da 20 ms, due publisher, fissato a quattro core: circa 15 us aggiunti per ciclo in media, e il ciclo più lungo 144 us, senza slot di pubblicazione saltati né invii rifiutati. Una libreria 1.1.0 ricompilata nella stessa ora ha misurato 15,2 us e 261 us.

## Cosa non ho eseguito

* Nessun controllore fisico, nessun runtime CODESYS diverso da Control for Linux SL 4.22.0.0, e nessuna CPU diversa da x86-64.
* HotLoop Alarms con una classe di allarme diversa da quella che riconosce e chiede conferma, o con più di 64 allarmi attivi contemporaneamente.
* Il `.package` nella finestra del CODESYS Installer. Si è installato senza interfaccia con PackageManagerCLI.
* Un controllore il cui orologio real-time non è impostato o è sbagliato, il multicast, un runtime che perde e riacquista la rete, e la fine della finestra demo di due ore.

## Non incluso in questa versione

KeepAlive e Delta Frame, più di un DataSetMessage per NetworkMessage, WSTRING, uno stato per campo, timestamp sotto il secondo, sicurezza dei messaggi e il lato sottoscrittore. La [roadmap](/it/transmitter/roadmap/) dice quali sono i prossimi.

## Tornare indietro

Un progetto PLC fissato alla 1.1.0 continua a funzionare e invia gli stessi byte. HotLoop Alarms è una libreria separata: un progetto che non la aggiunge non ne è toccato.

## File

Scaricali da https://hotloop.io/hotloop-transmitter/1.2.0/ e controllali con `SHA256SUMS` nella stessa cartella.

```
e68cfc88e599ddcf278eb208ff500f4f78d3faf74edf12e38f308a009f478594  HotLoopAlarms-1.0.0.0.compiled-library
68f704fc5662bbc67ec097016a741065d705af01913a2746296c17f9e6991118  HotLoopAlarms-1.0.0.0.library
a404f20fc35c4a3d804aa194f29def3f8193e26e696357899d3ae5b3d44948c1  HotLoopTransmitter-1.2.0.compiled-library
05200d0279ac120fd69d2dc3eeba99d9b40cb76eba2d15d1431b94c5e8f3fc32  HotLoopTransmitter-1.2.0.library
d6b6606a5919e18d2d6d31a5529af4d76bc7058003fb26032ec1a578f78ea57d  HotLoopTransmitter-1.2.0.package
```
