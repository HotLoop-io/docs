---
title: "Note di rilascio: HotLoop Cascade 1.0.2"
description: "Cosa include HotLoop Cascade 1.0.2, cosa cambia con l'aggiornamento e cosa leggere prima di toccare un impianto in funzione."
sidebar:
  label: "1.0.2"
---

## Di cosa si tratta

1.0.2 permette a un flusso di lavoro di firmare e verificare cose senza che un segreto stia mai nei dati di un elemento, e permette a un modulo pubblico su un altro sito di chiamare un webhook dal browser. Nient'altro è cambiato rispetto alla 1.0.1.

## Novità del passo Code

- **Funzioni crittografiche.** `sha256(text)`, `hmacSHA256(key, text)`, `randomHex(bytes)`, `base64Encode(text)`, `base64Decode(text)` e `safeEqual(a, b)`. Sono calcolate in Go, quindi i risultati sono quelli della libreria standard, e lo script continua a non avere `require`, rete né file.
- **Una credenziale per il passo.** Il passo Code ha uno slot di credenziale `secret`. Assegnagli una credenziale `HMAC key` (un nuovo tipo di credenziale integrato con un solo campo segreto, `key`) e lo script la legge come `credential.key`. La chiave vive nell'archivio come ogni altro segreto, e l'archivio la oscura in tutto ciò che l'esecuzione salva, anche se lo script la restituisce. Un passo senza credenziale vede un oggetto `credential` vuoto.

Il motivo: un modulo pubblico verifica una prova di lavoro con un HMAC. Prima, l'unico modo per farlo in un flusso di lavoro era mettere la chiave in un elemento o in una variabile, e entrambi finiscono nelle esecuzioni salvate o in chiaro. Ora la chiave è una credenziale e l'esecuzione salvata contiene la firma e nient'altro.

## Novità di un webhook

- **`corsOrigins`.** Un trigger webhook accetta un elenco di origini web (`https://example.com`, oppure `*`) le cui pagine possono chiamarlo da un browser. Cascade risponde da solo alla richiesta preliminare del browser, senza avviare un'esecuzione, e aggiunge `Access-Control-Allow-Origin` alla risposta per un'origine in elenco. Un webhook che non ne elenca nessuna si comporta esattamente come prima: nessuna intestazione CORS, quindi una pagina del browser non può leggere la risposta. Una voce deve essere un'origine, senza percorso.

## Aggiornare, e tornare indietro

Nessuna migrazione. `helm upgrade` alla 1.0.2, oppure lascia che `:stable` faccia avanzare le unità Quadlet. I flussi di lavoro che non usano mai le nuove funzioni si comportano esattamente come prima, quindi rimettere la 1.0.1 è sicuro per loro; un flusso che chiama una funzione nuova fallisce sulla 1.0.1 con la funzione non definita. Un backup prima di ogni aggiornamento resta una buona abitudine.
