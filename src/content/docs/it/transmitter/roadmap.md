---
title: "Roadmap di Transmitter"
description: "Cosa ha già costruito HotLoop Transmitter, cosa arriva dopo e cosa non è volutamente in programma."
---

Cosa c'è oggi nella confezione, cosa viene dopo e cosa non è volutamente in programma. Una voce passa a "Rilasciato" solo quando è stata eseguita sul vero runtime 4.22.0.0 e un ricevitore l'ha letta.

## Rilasciato nella 1.2.0

* HotLoop Alarms, una libreria che legge gli allarmi attivi, in attesa e riconosciuti del gestore allarmi di CODESYS in variabili semplici ed esegue il riconoscimento che HotLoop scrive di ritorno. È stata eseguita sul vero runtime 4.22.0.0 e l'elenco allarmi di HotLoop l'ha letta.

## Rilasciato nella 1.1.0

* Timestamp di DataSetMessage e NetworkMessage presi dall'orologio in tempo reale del PLC, attivi per impostazione predefinita; `bTimestamp` li disattiva.
* La libreria come `.package` CODESYS, installata con il CODESYS Installer.

## Rilasciato nella 1.0.0

* Un blocco publisher, `FB_HLTX_Publisher`: un NetworkMessage per intervallo di pubblicazione, un DataSetMessage, un Data Key Frame, UADP su UDP, da Structured Text su SysSocket.
* Codifiche dei campi Variant e RawData.
* Campi BOOL, SINT, USINT, INT, UINT, DINT, UDINT, LINT, ULINT, REAL, LREAL, STRING e TIME, e array di tutti tranne STRING, in entrambe le codifiche.
* Destinazioni unicast e multicast, publisher id, writer group id, dataset writer id, intervallo di pubblicazione, versione del gruppo e versione della configurazione, tutti impostati come ingressi del blocco.
* Un invio non bloccante, un costo limitato per chiamata, contatori di inviati, rifiutati e saltati, e uno stato di errore che non manda mai in errore l'applicazione.

## Prossimamente

* Timestamp sotto il secondo. Il timestamp della 1.1.0 è in secondi interi dell'orologio in tempo reale.
* Più DataSetMessage in un NetworkMessage (l'array Sizes), così un datagramma può portare più di un writer.
* Data Delta Frame e messaggi KeepAlive, per ridurre i byte di un dataset quasi stabile.
* Campi WSTRING.
* Uno stato per campo, così un valore Bad può essere inviato come Bad.

## Non in programma

* Sicurezza dei messaggi (firma e cifratura). Il blocco invia in chiaro, su una rete di cui lo stabilimento si fida già.
* NetworkMessage frammentati. Un messaggio che non sta in un frame da 1500 byte viene rifiutato, non diviso.
* Il lato subscriber. HotLoop core si abbona a UADP; questa libreria pubblica.
* Trasporto MQTT. UDP è ciò che un runtime CODESYS raggiunge senza altre librerie.
