---
title: "Note di rilascio: HotLoop for CODESYS 0.3.7"
description: "Chart 0.3.7 di HotLoop for CODESYS: avvolge HotLoop 4.22.0 ed esegue il provisioner 0.3.2."
sidebar:
  label: "0.3.7"
---

## Cosa è cambiato

0.3.7 è nell'indice `{{codesysChartRepo}}`, pubblicato il 2026-11-19.

- **Avvolge HotLoop 4.22.0,** che dà a ogni dispositivo OPC UA PubSub sullo stesso indirizzo e porta un socket condiviso, così due listener possono stare sulla stessa porta UDP.
- **Il provisioner accetta due listener su una porta.** Il provisioner 0.3.2 non rifiuta più un profilo che mette due dispositivi `opcua-pubsub` sulla stessa porta.

Cosa significa per te: un profilo con più publisher PubSub sulla stessa porta si installa e si legge.

## Cosa è stato verificato

Un'installazione nuova con un profilo del dispositivo proprio del runtime, due listener PubSub sulla stessa porta UDP, un allarme e una schermata, accanto a un vero runtime CODESYS Control for Linux SL 4.22.0.0 che esegue la libreria Transmitter: tutto è stato creato senza passaggi manuali, le variabili del PLC si leggevano bene, l'allarme è scattato sul valore proprio del PLC, e entrambi i listener risultavano connessi. Contro un vero publisher in entrambe le codifiche ognuno dei 32 campi si leggeva bene e uguale al PLC. Entrambi i pod eliminati e il runtime riavviato: HotLoop è tornato da solo con i suoi tre dispositivi.
