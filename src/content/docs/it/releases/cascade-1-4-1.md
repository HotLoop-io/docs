---
title: "Note di rilascio: HotLoop Cascade 1.4.1"
description: "Cosa include HotLoop Cascade 1.4.1, cosa cambia con l'aggiornamento e cosa leggere prima di toccare un impianto in funzione."
sidebar:
  label: "1.4.1"
---

## Di cosa si tratta

1.4.1 corregge una cosa nella pagina Impostazioni e mette in ordine le cartelle delle lingue. Il motore, il formato dei file, l'API REST, il server MCP e tutte le altre schermate sono quelli della 1.4.0.

## La pagina Impostazioni conserva ciò che hai modificato

Ogni Salva della pagina Impostazioni riceve come risposta le impostazioni così come le ha il server. Se modificavi un campo dopo aver premuto Salva e prima che arrivasse quella risposta, la risposta rimetteva il campo al valore che avevi appena lasciato, senza alcun messaggio. Un amministratore che salvava e subito dopo modificava il campo successivo poteva perdere quella modifica.

Ora un campo che contiene ancora ciò che è stato inviato prende il valore del server, e un campo che hai modificato nel frattempo conserva la tua modifica. Un test del browser trattiene la risposta per un secondo e mezzo e cambia un campo nel frattempo. Sulla pagina della 1.4.0 fallisce (mostra il primo valore dove era stato impostato il secondo), e su questa pagina passa.

## Le cartelle delle lingue

Le liste `_review.json` in ogni cartella di lingua non ci sono più, e nemmeno il controllo di build che le leggeva. Nient'altro le leggeva, e non è prevista alcuna revisione da parte di madrelingua. Le traduzioni sono quelle distribuite dalla 1.4.0.

## Solo amd64, e perché

Questa versione viene costruita solo per amd64. Il multi-architettura esce in una sua esecuzione, quindi la versione dopo questa è un piccolo cambio di versione che le costruisce entrambe. `stable`, `latest`, `1.4` e `1` elencano la nuova immagine amd64 accanto all'immagine arm64 a cui già puntavano.

## Aggiornare, e tornare indietro

Nessuna migrazione: lo schema è quello della 1.4.0. `helm upgrade` alla 1.4.1, oppure lascia che `:stable` faccia avanzare le unità Quadlet. Rimettere la 1.4.0 è sicuro, perché nel database non è cambiato nulla.
