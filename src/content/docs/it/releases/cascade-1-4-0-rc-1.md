---
title: "Note di rilascio: HotLoop Cascade 1.4.0-rc.1"
description: "Cosa include HotLoop Cascade 1.4.0-rc.1, cosa cambia con l'aggiornamento e cosa leggere prima di toccare un impianto in funzione."
sidebar:
  label: "1.4.0-rc.1"
---

Questa è una release candidate della 1.4.0. Non sposta alcun tag `stable`, `latest`, `1.4` o `1` e non è nell'indice dell'App Store, quindi nulla la scarica per impostazione predefinita. È il codice che la 1.4.0 distribuirà, scaricato ed eseguito su un vero host Podman prima del tag vero, e la 1.4.0 sarà questo codice con solo le stringhe di versione cambiate. Leggi le note della 1.4.0 per vedere cosa contiene.

## Di cosa si tratta

1.4.0 rende un'installazione di Cascade più facile da gestire a lungo: il server aspetta il database invece di andare in crash, le esecuzioni concluse possono essere conservate per un certo numero di giorni e ripulite insieme ai loro file, un proprietario può limitare la frequenza con cui una chiave API fa chiamate, e l'intera istanza può essere salvata e ripristinata. Chiude anche l'unico test di scala che la roadmap aveva lasciato aperto. Il motore, il formato dei file dei flussi di lavoro, l'API REST, il server MCP (83 strumenti) e le 14 lingue sono quelli della 1.3.0.

## Aspetta il database

Nell'installazione divisa (pod server, worker e webhook su PostgreSQL), i pod partivano prima che il nome del database venisse risolto e si riavviavano due o tre volte prima di essere pronti. Lo facevano anche la 1.2.1 e la 1.3.0. Un server, un worker o un webhook che non riesce a raggiungere il database ora lo dice nel suo log ("waiting for the database", con da quanto aspetta) e riprova, fino a cinque minuti, poi si connette quando il database risponde. Una password sbagliata, un indirizzo malformato o un database che non esiste lo fermano comunque subito, perché aspettare non può risolverli. La probe di avvio del chart aspetta quanto il programma. Una nuova installazione divisa su un vero k3s non ha mostrato riavvii, in tutte e tre le esecuzioni del test del chart.

## Conservare le esecuzioni concluse

Impostazioni ha un nuovo campo, Conserva le esecuzioni concluse per (giorni), e `PATCH /api/v1/settings` accetta `retentionDays`. È disattivato per impostazione predefinita (0), e ogni esecuzione viene conservata come sempre. Imposta un numero e una volta all'ora un nodo principale elimina le esecuzioni riuscite, fallite e annullate terminate da più tempo di così, con i loro dati dei passi. Un'esecuzione ancora in corso non viene mai toccata, e nemmeno un'esecuzione il cui padre lo è. Ogni lotto scrive `execution.pruned` nel registro di controllo, e la modifica dell'impostazione scrive `instance.retention`.

Lo stesso passaggio orario ora ripulisce anche l'archivio dei blob, che la retention sia attiva o meno: gli output troppo grandi per il database e gli allegati a cui nessuna esecuzione punta più. Un file condiviso da due esecuzioni resta finché non se ne va l'ultima, e vengono esaminati solo i file scritti più di 24 ore prima, quindi un file che un passo ha appena salvato non viene mai rimosso. Questo vale ora anche per le esecuzioni che elimini a mano; prima, un'esecuzione eliminata lasciava per sempre i suoi output grandi sul disco. Un passaggio che non riesce a leggere ciò che gli serve non rimuove nulla, e ogni passaggio scrive `blobs.collected` nel registro di controllo.

## Un limite per ogni chiave API

Impostazioni ha un nuovo campo, Richieste API per chiave al minuto, e `PATCH /api/v1/settings` accetta `apiRateLimit`. È disattivato per impostazione predefinita. Imposta un numero e ogni chiave API, e ogni agente che accede tramite MCP con una di esse, può fare quel numero di richieste al minuto. Una chiamata oltre il limite riceve 429 con un `Retry-After`. Ogni chiave ha il suo conteggio, e le persone che hanno effettuato l'accesso all'editor non ne sono soggette. Il conteggio è quello di ciascun processo, quindi con tre nodi principali una chiave può fare fino a tre volte quel numero. Modificarlo scrive `instance.api_rate_limit` nel registro di controllo.

## Backup e ripristino

`hotloop-cascade backup DIR` scrive una nuova directory con una copia coerente del database SQLite fatta mentre il server è in funzione, il file della chiave che sigilla tutte le credenziali salvate, i file dei blob e un `manifest.json` con i loro hash. `hotloop-cascade restore DIR` li rimette a posto, dopo aver controllato ogni file contro il manifest, e si rifiuta di sovrascrivere un database o una chiave diversa a meno che tu indichi `--replace`. Per PostgreSQL il backup contiene la chiave, i blob e il manifest, e stampa il comando `pg_dump` per la parte del database; il ripristino stampa quello di `pg_restore`. I blob conservati in S3 o Azure non vengono copiati. `docs/GOVERNANCE.md` ha i dettagli.

## I test che ci stanno dietro

- Il test di scala fissato dalla roadmap è fatto. Due nodi principali su un solo PostgreSQL hanno eseguito per un'ora un flusso di lavoro che scatta ogni minuto mentre uno dei due veniva terminato con SIGKILL al confine dello slot, sette volte di fila e lasciato fermo circa 25 secondi ogni volta: 61 esecuzioni per 61 slot di un minuto, nessuna mancata, nessuna doppia.
- Il server OAuth dello stack di test (Hydra) ora gira su Postgres. Prima falliva nelle esecuzioni in parallelo, dopo passava, e con la modifica annullata falliva di nuovo. Nessun codice di Cascade ispeziona i token.
- Il test del chart ora fallisce se un pod si riavvia durante l'installazione.
- I due nuovi rifiuti delle impostazioni sono tradotti in ogni lingua, e la guida delle impostazioni dice che gli output grandi se ne vanno con le loro esecuzioni.

## Solo amd64, e perché

Questa versione viene costruita solo per amd64. Il multi-architettura esce in una sua esecuzione, quindi la versione dopo questa è un piccolo cambio di versione che le costruisce entrambe. `stable`, `latest`, `1.4` e `1` elencano la nuova immagine amd64 accanto all'immagine arm64 a cui già puntavano.

## Aggiornare, e tornare indietro

Nessuna migrazione: lo schema è quello della 1.3.0. `helm upgrade` alla 1.4.0, oppure lascia che `:stable` faccia avanzare le unità Quadlet. Rimettere la 1.3.1 è sicuro, perché nel database non è cambiato nulla. Ciò che un rollback non può annullare è una potatura: le esecuzioni eliminate dalla retention non ci sono più, e nemmeno i blob rimossi dalla pulizia oraria. La retention è disattivata finché non la attivi, quindi fai prima un backup; la pulizia dei blob gira anche senza.
