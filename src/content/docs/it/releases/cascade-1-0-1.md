---
title: "Note di rilascio: HotLoop Cascade 1.0.1"
description: "Cosa include HotLoop Cascade 1.0.1, cosa cambia con l'aggiornamento e cosa leggere prima di toccare un impianto in funzione."
sidebar:
  label: "1.0.1"
---

## Di cosa si tratta

1.0.1 corregge un errore nel modo in cui l'accesso tratta un database che non si riesce a leggere. Nient'altro è cambiato rispetto alla 1.0.0.

## La correzione

Quando il database vacillava, Cascade leggeva "non sono riuscito a controllare" come "non è valido" e rispondeva 401. Lo facevano un controllo di sessione, una chiave API, un token SCIM e l'utente di una chiave, e il controllo di sessione cancellava anche il cookie, quindi una breve interruzione disconnetteva tutti. Ora solo una sessione che non esiste o che appartiene a un utente disattivato è un 401. Un archivio che non si legge risponde 503 con un Retry-After, e il cookie resta.

Il secondo fattore aveva lo stesso problema. Durante un'interruzione, un codice dell'autenticatore, un codice di recupero o una passkey corretti ricevevano la risposta di un codice sbagliato, cosa che può chiudere fuori una persona dal proprio account. Questi passaggi ora rispondono 503 per un errore dell'archivio o del server e riservano il 401 a un vero rifiuto: un codice sbagliato, una passkey fallita, una richiesta scaduta. Anche l'accesso con passkey non scambia più una ricerca utente fallita per "nessun account ha questa passkey".

## Aggiornare, e tornare indietro

Nessuna migrazione. `helm upgrade` alla 1.0.1, oppure lascia che `:stable` faccia avanzare le unità Quadlet. Poiché nel database non cambia nulla, rimettere la 1.0.0 è sicuro. Un backup prima di ogni aggiornamento resta una buona abitudine.
