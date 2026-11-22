---
title: "L'editor di HotLoop Flow"
description: "L'editor di Flow in chiaro e scuro: la tela, la revisione prima di un rilascio, un messaggio tracciato e l'accesso."
---

Segue il sistema, chiaro o scuro, e ogni immagine qui sotto è mostrata in entrambi i modi, prima quella chiara. Tutte le immagini qui sotto vengono da `web/shots/screenshots.sh`, che avvia il vero binario e un vero browser, quindi vengono rifatte quando l'editor cambia e non possono scivolare in un mockup. L'impianto sulla tela è una linea di forni con due rilasci alle spalle.

## Cablare, eseguire, osservare

![L'editor su una linea di forni: la tela, la cronologia dei rilasci e i pannelli di debug e di esecuzione](/synced/flow/docs/screenshots/editor.png)
![Lo stesso, in scuro](/synced/flow/docs/screenshots/editor-dark.png)

La tela è ciò che sta girando. Il pannello di debug sotto stampa ciò che vedono i nodi di debug, e la tabella Runtime accanto conta ciò che è entrato e uscito da ogni nodo, con una barra che indica quanto è piena la sua coda. Quando una linea si comporta male, lo si legge sullo schermo invece di andare a frugare in un log.

## Rivederlo prima che arrivi alla linea

![Il pannello di revisione con un nodo modificato e una casella di nota, accanto alla tela con quel nodo evidenziato](/synced/flow/docs/screenshots/review.png)
![Lo stesso, in scuro](/synced/flow/docs/screenshots/review-dark.png)

Distribuire non distribuisce. Disegna la modifica sulla tela, la scrive a parole e chiede una nota. La nota finisce nella cronologia accanto al nome, così chi riceve la chiamata alle 2 di notte può vedere che cosa è cambiato e perché.

## Seguire un messaggio lungo i collegamenti

![Un messaggio tracciato illuminato lungo la tela con il tempo speso da ogni nodo, e il pannello di debug sotto](/synced/flow/docs/screenshots/debug.png)
![Lo stesso, in scuro](/synced/flow/docs/screenshots/debug-dark.png)

Si fa clic su Trace su una riga di debug e il percorso fatto da quel messaggio si illumina sulla tela, salto dopo salto, con ciò che ogni nodo ne ha fatto e quanto ci ha messo. Lo si trasforma in un test, o lo si riproduce in una bozza, dallo stesso pannello.

## Accesso

![La scheda di accesso](/synced/flow/docs/screenshots/signin.png)
![Lo stesso, in scuro](/synced/flow/docs/screenshots/signin-dark.png)

![L'avviso che un runtime mostra quando la dashboard fa accedere le persone e questa pagina è stata aperta in un altro modo](/synced/flow/docs/screenshots/dashboard-signin.png)
![Lo stesso, in scuro](/synced/flow/docs/screenshots/dashboard-signin-dark.png)

Non parte senza protezione, quindi la prima cosa che chiunque vede è un accesso. Quando la dashboard EmberCORE fa accedere le persone, un runtime aperto in un altro modo dice di entrare dalla dashboard invece di chiedere una seconda password.
