---
title: "Note di rilascio: HotLoop core 4.22.0"
description: "Cosa porta HotLoop core 4.22.0, cosa cambia all'aggiornamento e cosa leggere prima di toccare un impianto in funzione."
sidebar:
  label: "4.22.0"
---

Una schermata aperta come pannello (`/?screen=<name>`) ora riempie il suo display da bordo a bordo a qualsiasi dimensione, la schermata Alarms può importare un file di allarmi CODESYS, e un po' di correzioni. Costruita solo per amd64; la build multi-architettura segue come versione successiva.

## Cosa è cambiato

- **Una pagina pannello riempie il suo schermo.** A 1920x1080, 1366x768 e 3840x2160 copre il display senza spazio morto. Ha un'intestazione con il nome dell'impianto, uno stato Live con quanti dispositivi sono online e un orologio a 24 ore con la data. Numeri e indicatori crescono con lo schermo, e così l'asse e la legenda della tendenza. Cambia solo la pagina pannello; le dashboard sono com'erano e le card, le dimensioni e i nomi di un cliente sono suoi.
- **La schermata Alarms importa un file Export Alarms di CODESYS.** Solo per amministratori: scegli il dispositivo, nomina l'applicazione, scegli il file, leggi l'anteprima di ciò che passa e di ciò che non passa, poi importa. La route dell'API esisteva già.
- **I dispositivi OPC UA PubSub sullo stesso indirizzo e porta condividono un socket.** Il secondo dispositivo non poteva mai fare il bind, e le opzioni di riuso dividevano i datagrammi di un publisher tra loro.
- **Le risposte lente non si accumulano più.** Una card di telecamera più lenta del suo aggiornamento ora mostra la sua immagine, le card e la schermata UniFi richiedono di nuovo solo dopo l'ultima risposta, un batch di discovery fallito una volta viene ritentato, e un dispositivo SNMP su un nome host mantiene la sua attesa della risposta.
- **I prodotti core sono sotto la HotLoop Free Use License 1.0.** Le versioni precedenti mantengono i termini con cui sono state pubblicate. Vedi NOTICE.
- **L'icona dell'App Store** sulle pagine dei chart è il marchio HotLoop.

## Modifiche all'API

Nessuna.

## Aggiornare dalla 4.21.1

Un normale `helm upgrade`. Nessuna migrazione, nessun nuovo segreto, nulla che non si possa annullare.

## Testato

La pagina pannello è stata verificata nei test alle tre dimensioni sopra, con Emberburn che alimenta un Gateway.
