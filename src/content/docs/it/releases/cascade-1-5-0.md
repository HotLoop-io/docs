---
title: "Note di rilascio: HotLoop Cascade 1.5.0"
description: "Cosa include HotLoop Cascade 1.5.0, cosa cambia con l'aggiornamento e cosa leggere prima di toccare un impianto in funzione."
sidebar:
  label: "1.5.0"
---

## Di cosa si tratta

1.5.0 permette a un proprietario di eliminare una persona. Il motore, il formato dei file e tutte le altre schermate sono quelli della 1.4.2, e non c'è nessuna migrazione.

## Eliminare una persona

Prima, l'unico modo per rimuovere un account era disattivarlo, e restava nell'elenco per sempre. Ora Utenti ha un pulsante Elimina accanto a Disattiva, mostrato ai proprietari per tutti tranne sé stessi, e chiede conferma prima di fare qualsiasi cosa. La stessa chiamata è nell'API REST, `DELETE /api/v1/users/{user}`, e nel server MCP come `delete_user`, con la stessa regola: solo un proprietario dell'istanza, mai il proprio account, e mai l'ultimo proprietario.

L'account, le sue sessioni, passkey, identità di accesso e chiavi API se ne vanno subito, così tutto ciò che è ancora connesso come quella persona smette di funzionare alla richiesta successiva. Il registro di controllo annota chi ha eliminato chi, con l'email, il ruolo e quante sessioni e chiavi sono state rimosse, e la sua catena si verifica ancora.

Il loro lavoro resta. Il loro progetto personale diventa un progetto condiviso con il loro nome seguito da "(removed)", che contiene tutti i flussi di lavoro, le credenziali e le esecuzioni che aveva, e proprietari e amministratori possono spostarne qualsiasi parte in un altro progetto o assegnarla a qualcuno. La stessa email può essere usata più tardi per creare un nuovo account, che parte con un progetto tutto suo.

Disattiva è invariato ed è la scelta giusta quando vuoi conservare l'account. Una persona che il tuo provider di identità rimuove tramite SCIM viene ancora disattivata e nascosta, non eliminata.

## Tornare indietro

Non c'è nessuna migrazione, quindi l'immagine precedente funziona sugli stessi dati. Un account eliminato non torna indietro; ripristina il backup fatto prima dell'eliminazione se ti serve.

## Solo amd64, e perché

Questa versione viene costruita solo per amd64. Il multi-architettura esce in una sua esecuzione, quindi la versione dopo questa è un piccolo cambio di versione che le costruisce entrambe. `stable`, `latest`, `1.5` e `1` elencano la nuova immagine amd64 accanto all'immagine arm64 a cui già puntavano.
