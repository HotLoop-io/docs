---
title: "Note di rilascio: HotLoop Cascade 1.3.0"
description: "Cosa include HotLoop Cascade 1.3.0, cosa cambia con l'aggiornamento e cosa leggere prima di toccare un impianto in funzione."
sidebar:
  label: "1.3.0"
---

## Di cosa si tratta

1.3.0 porta l'editor in 14 lingue: inglese, spagnolo, francese, italiano, tedesco, norvegese bokmål, bulgaro, greco, coreano, giapponese, vietnamita, hindi, cinese semplificato e arabo. Il motore, il formato dei file dei flussi di lavoro, l'API REST e il server MCP sono quelli della 1.2.1.

## Le lingue

- Un selettore di lingua si trova nella barra in alto dell'editor e nella pagina di accesso. La scelta viene conservata nel browser, e la prima visita segue la lingua del browser.
- Ogni schermata è tradotta: flussi di lavoro, esecuzioni, analisi, variabili, credenziali, progetti, utenti, ruoli, registro di controllo, impostazioni, il tuo account, segreti, streaming dei log e editor dei passi. Lo sono anche i titoli dei passi e il loro aiuto, i tipi di credenziale e i rifiuti che il server invia quando un salvataggio, un'eliminazione o un accesso viene negato.
- Date, numeri, durate ed elenchi usano la formattazione propria del browser per la lingua scelta. L'arabo si scrive da destra a sinistra, con canvas, codice ed espressioni ancora da sinistra a destra. L'arabo usa le cifre da 0 a 9 e il calendario gregoriano.
- I nomi di prodotto, di nodo e di protocollo e i valori di esempio restano in inglese in ogni lingua. Un messaggio su come chi gestisce l'istanza ha configurato una directory, un provider SAML o OpenID, un archivio di segreti o un file di chiavi viene mostrato come l'ha scritto il server, perché l'operatore cerca quel testo.
- Le parole vengono dal glossario HotLoop condiviso. Le righe che un madrelingua dovrebbe confermare per prime sono elencate nel `_review.json` di ciascuna lingua, in `web/src/i18n/locales`. Nessuno che legga queste lingue da madrelingua le ha ancora riviste.
- Una lingua viene offerta solo quando ci sono tutte le sue righe. La build controlla che ogni lingua abbia tutte le chiavi dell'inglese, che i segnaposto e i tag sopravvivano e che le forme plurali siano corrette. Un test Go mantiene le parole inglesi dei passi e i messaggi del server uguali a ciò che il server può dire, così un nuovo passo o un nuovo rifiuto non può uscire senza una riga da tradurre.

## Anche in questa versione

- Il test dell'editor che verifica che i file compilati non puntino mai a un altro host ora ammette quattro indirizzi di esempio (`https://ntfy.sh`, `https://example.com`, `https://hotloop.plant` e `http://hotloop:8080`). Compaiono nel testo di aiuto dei passi, che ora viene fornito nell'editor per ogni lingua, e sono parole in una frase che nulla scarica. Il test del browser fallisce comunque se l'editor richiede qualcosa a un altro host.
- Il browser di test ha i font Noto per coreano, giapponese, cinese e hindi, così quelle schermate disegnano lettere e non riquadri vuoti.
- L'helper di test di OpenBao ripete una scrittura finché OpenBao dice che un nuovo mount chiave-valore si sta ancora aggiornando (26e1e13).
- HotLoop LLC è indicata come licenziante e manutentore di Cascade (0ea9cd5).

## Solo amd64, e perché

Questa versione viene costruita solo per amd64. Il multi-architettura esce in una sua esecuzione, quindi la versione dopo questa è un piccolo cambio di versione che le costruisce entrambe. `stable`, `latest`, `1.3` e `1` elencano la nuova immagine amd64 accanto all'immagine arm64 a cui già puntavano.

## Un problema noto

Nell'installazione divisa (pod server, worker e webhook su PostgreSQL), i pod partono prima che il nome del database venga risolto e si riavviano due o tre volte prima di essere pronti. Alla fine partono e l'installazione passa, ma è rumoroso. La 1.2.1 fa lo stesso, quindi non è una novità. La correzione è connettersi con nuovi tentativi finché il database è pronto, e arriva nella prossima versione.

## Aggiornare, e tornare indietro

Nessuna migrazione. `helm upgrade` alla 1.3.0, oppure lascia che `:stable` faccia avanzare le unità Quadlet. Rimettere la 1.2.1 è sicuro, perché nel database non è cambiato nulla. La lingua scelta vive nel browser, quindi tornare indietro non fa perdere altro che il selettore.
