---
title: "Note di rilascio: HotLoop for CODESYS 0.3.2"
description: "Chart 0.3.2 di HotLoop for CODESYS: avvolge HotLoop 4.19.11, e HotLoop usa la porta 8090 per girare accanto a un runtime sulla rete del nodo."
sidebar:
  label: "0.3.2"
---

## Cosa è cambiato

0.3.2 è nell'indice `{{codesysChartRepo}}`, pubblicato il 2026-11-15, e l'immagine del provisioner che esegue si scarica senza accesso. Niente in esso scrive sul PLC.

- **Avvolge HotLoop 4.19.11** ed esegue il provisioner 0.3.1.
- **La pagina di HotLoop ascolta sulla 8090 dentro il pod.** Un runtime sulla rete del nodo occupa la porta host 8080, e lo scheduler rifiutava di collocare la pagina di HotLoop accanto. Il Service resta sulla 8080, quindi il tile dell'App Store e il provisioner raggiungono HotLoop come prima. Qualsiasi cosa parlasse direttamente con il pod sulla 8080 passa alla 8090.
- **Il provisioner rifiuta un profilo che mette due listener OPC UA PubSub sulla stessa porta UDP.** HotLoop lega una porta in modo esclusivo, quindi il secondo dispositivo restava in connessione con "address already in use". Ora il provisioner lo dice subito.
- **Ogni chart precedente resta nell'indice.**

Cosa significa per te: un runtime CODESYS sulla rete propria del nodo e HotLoop girano fianco a fianco su un solo nodo.

## Cosa è stato verificato

Il chart si renderizza dall'indice live con Helm, ed è stato eseguito su hardware reale (2026-11-17). [A che punto siamo](/it/codesys/where-it-stands/) dice rispetto a cosa è stato eseguito.
