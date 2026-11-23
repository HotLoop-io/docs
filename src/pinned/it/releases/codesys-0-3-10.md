---
title: "Note di rilascio: HotLoop for CODESYS 0.3.10"
description: "Chart 0.3.10 di HotLoop for CODESYS: avvolge HotLoop 4.24.0 ed esegue il provisioner 0.4.1, così un profilo può portare più schermate."
sidebar:
  label: "0.3.10"
---

## Cosa è cambiato

0.3.10 è nell'indice `{{codesysChartRepo}}`, pubblicato il 2026-11-23. È quello da installare, e porta tutto ciò che ha aggiunto 0.3.9.

- **Avvolge HotLoop 4.24.0,** che mostra gli allarmi propri di un PLC CODESYS nell'elenco allarmi e disegna le schermate come P&ID.
- **Esegue il provisioner 0.4.1.** Un profilo accetta un elenco di schermate accanto alla singola, così un progetto con più pagine WebVisu torna completo.
- **Il profilo di esempio si connette subito.** I suoi tag usano l'indice di campo OPC UA PubSub, quindi il dispositivo che crea non ritenta la connessione.
- **Il chart lascia fuori i canali di allarme Gotify e Discord finché non hanno una credenziale,** così il pod parte su un'installazione semplice. Imposta `enabled` di un canale a true con il suo token o URL per usarlo.

Cosa significa per te: installa questo. Un aggiornamento da 0.3.8 mantiene il dispositivo e i suoi tag.

## Cosa è stato verificato

Installato dall'indice su un cluster reale con un profilo di un listener OPC UA PubSub e due schermate: il provisioner ha creato il dispositivo, i suoi due tag e entrambe le schermate senza passaggi manuali, il dispositivo risultava connesso, e il log di HotLoop non aveva avvisi né errori. Eliminare entrambi i pod li ha riportati da soli con il dispositivo ancora configurato, un aggiornamento da [0.3.8](/it/releases/codesys-0-3-8/) ha mantenuto il dispositivo e i suoi tag, e un'installazione senza profilo ha dato solo HotLoop.

L'immagine 4.24.0 è costruita per amd64, quindi su un nodo arm64 fissi HotLoop su uno amd64.
