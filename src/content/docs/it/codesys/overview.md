---
title: "HotLoop for CODESYS: panoramica"
description: "HotLoop accanto a un runtime CODESYS: schermate e allarmi per un PLC CODESYS, letti dal server OPC UA del runtime stesso, senza installare nulla in CODESYS."
sidebar:
  label: "Panoramica"
editUrl: false
---

HotLoop for CODESYS è HotLoop che gira sullo stesso nodo di un runtime CODESYS. Legge le variabili del PLC dal server OPC UA del runtime stesso, le porta su schermate che funzionano su un panel PC, un telefono o una parete, genera allarmi su di esse e conserva lo storico. Non si installa nulla in CODESYS e nulla scrive nel PLC. È la schermata che altrimenti costruireste in CODESYS WebVisu, disegnata fuori dal runtime. Cosa ottenete: gli operatori hanno una schermata senza un download al PLC, e il PLC ha un secondo paio d'occhi che non dipende da nient'altro sul nodo.

È uno degli otto prodotti HotLoop, con una propria linea di rilasci. Il chart più recente è il 0.3.8, pubblicato il 2026-11-16. Sotto c'è HotLoop Edge, quindi tutto ciò che dicono le [pagine di Edge](/it/edge/overview/) vale anche qui.

![La schermata Line 2: quattro schede di valore, un indicatore, un andamento di quindici minuti e un elenco di allarmi](/codesys/screen.png)
![La stessa, in scuro](/codesys/screen-dark.png)

È una prova reale: l'interfaccia predefinita di HotLoop che legge un runtime CODESYS Control for Linux SL 4.22.0.0. Il programma del PLC è il programma demo di HotLoop, quindi i numeri sono quelli della demo. Le etichette (Line 2, Mixer temperature, Riverside Bottling) sono inventate e messe dal [profilo](/it/codesys/profile/).

## Le tre parti

| Parte | Cos'è | Dove si trova |
|---|---|---|
| Il chart, `hotloop-codesys` | Un involucro attorno a `hotloop-edge` con valori predefiniti per un runtime su un nodo: SQLite, una replica, e disattivato ciò che non serve accanto a un PLC. Ogni correzione dei chart HotLoop lo raggiunge. | `https://hotloop.io/hotloop-codesys/` |
| Il provisioner | Un solo binario Go statico che applica un profilo a HotLoop e lo mantiene corretto. Non conserva alcun profilo. | `ghcr.io/hotloop-io/hotloop-provision` |
| Un profilo | Un file JSON: il dispositivo, le variabili da conservare, gli allarmi e una schermata. L'unico input che date voi. | Un Secret nel namespace dell'installazione, [descritto qui](/it/codesys/profile/) |

## Come legge il PLC

CODESYS documenta un solo modo per una terza parte di leggere le variabili di un controllore, ed è il server OPC UA del runtime stesso. Il PLC pubblica ciò che volete vedere con una Symbol Configuration nell'IDE, e HotLoop legge quelle variabili con i nomi che ha dato il programmatore, come `Application.GVL_Line.rTemp`, non con un node id. La Symbol Configuration è l'unica modifica al progetto del PLC. Il protocollo di canale del CODESYS Gateway non è documentato per terze parti, e questo non lo parla.

La lettura è fatta dal connettore CODESYS di HotLoop core, cioè il driver OPC UA più ciò che serve in più a un PLC CODESYS: scoperta di ciò che l'applicazione esporta, dei tipi che ha, array e strutture percorsi fino a un punto per campo, una riconnessione senza intervento dopo un riavvio o un download, e ogni richiesta ridotta ai limiti che il runtime pubblica. La [pagina dei protocolli](/it/iot/protocols/) riporta il riferimento del connettore da HotLoop 4.19.4 in poi, e dice contro cosa è stato verificato e contro cosa no.

## Cosa fa da solo

Quando HotLoop e il runtime del nodo rispondono entrambi, il provisioner configura il dispositivo del profilo, le sue variabili, i suoi allarmi e la sua schermata. Poi controlla di nuovo ogni cinque minuti. Una variabile del profilo che il PLC ha acquisito nel frattempo viene aggiunta. Una che il PLC non ha più si legge come cattiva con il motivo del server. La schermata e gli allarmi vengono creati quando mancano e sostituiti solo quando il `revision` del profilo è maggiore di quello che li ha creati, quindi una modifica fatta da una persona sopravvive finché non viene consegnato di proposito un profilo più recente.

## Cosa non farà

- **Non scriverà nel vostro PLC.** Ogni tag che il provisioner configura è di sola lettura, e il profilo non ne segna nessuno come scrivibile. Una persona può armare un tag in seguito, e allora la [barriera di scrittura](/it/gateway/write-gate/) e i diritti di simbolo del PLC stesso hanno voce in capitolo.
- **Non metterà nulla nel runtime.** Nessuna libreria, nessun task, nessun agente.
- **Non avrà bisogno di un pod di database.** SQLite sullo storage del nodo, una replica.
- **È fatto per mantenere le sue schermate anche con un collegamento perso.** Entrambi i pod tollerano un nodo irraggiungibile o non pronto senza limite di tempo, e le tolleranze sono nel chart. [Stato](/it/codesys/where-it-stands/) dice cosa è stato eseguito su un nodo reale.

## Dove andare ora

[Installatelo](/it/codesys/install/), leggete cosa contiene un [profilo](/it/codesys/profile/), oppure vedete [lo stato](/it/codesys/where-it-stands/) e la [roadmap](/it/codesys/roadmap/). La usate in uno stabilimento? [Usare HotLoop in azienda](/it/business/) spiega le licenze e come contattarci.
