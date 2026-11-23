---
title: "Note di rilascio: HotLoop Cascade 1.4.2"
description: "Cosa include HotLoop Cascade 1.4.2, cosa cambia con l'aggiornamento e cosa leggere prima di toccare un impianto in funzione."
sidebar:
  label: "1.4.2"
---

## Di cosa si tratta

1.4.2 dà alla pagina di accesso un aspetto più pulito. Il motore, il formato dei file, l'API REST, il server MCP e tutte le altre schermate sono quelli della 1.4.1.

## La pagina di accesso

La pagina ora è una sola scheda su uno sfondo sobrio, con il marchio e il nome HotLoop Cascade centrati sopra. Accedi è l'unico pulsante arancione. L'accesso con passkey e il single sign-on sono pulsanti semplici sotto, e il pulsante del single sign-on mostra l'icona di Vord quando Vord è il provider. Si legge allo stesso modo in chiaro e in scuro e su un telefono, e i pulsanti di lingua e tema restano in alto a destra.

Nulla di come accedi è cambiato: gli stessi campi, gli stessi modi di entrare, la configurazione al primo avvio, l'accesso con directory, il secondo fattore, l'aggiunta di una passkey o di un'app di autenticazione. La pagina mantiene i suoi id, quindi i gestori di password e i segnalibri si comportano come prima.

## Solo amd64, e perché

Questa versione viene costruita solo per amd64. Il multi-architettura esce in una sua esecuzione, quindi la versione dopo questa è un piccolo cambio di versione che le costruisce entrambe. `stable`, `latest`, `1.4` e `1` elencano la nuova immagine amd64 accanto all'immagine arm64 a cui già puntavano.
