---
title: "Note di rilascio: HotLoop Cascade 1.2.0"
description: "Cosa include HotLoop Cascade 1.2.0, cosa cambia con l'aggiornamento e cosa leggere prima di toccare un impianto in funzione."
sidebar:
  label: "1.2.0"
---

## Di cosa si tratta

1.2.0 completa l'elenco degli strumenti del server MCP. Il motore, il formato dei file dei flussi di lavoro, le schermate e l'API REST sono quelli della 1.1.1.

## I quattro strumenti

Ogni MCP della famiglia HotLoop legge e scrive, e a quello di Cascade mancavano quattro route che una chiave può chiamare. Ora sono strumenti, 83 in tutto:

- `list_keys` e `revoke_key`: le chiavi della persona a cui appartiene la chiave, e la revoca di una. Una chiave può revocare sé stessa, ed è la prima cosa che dovrebbe poter fare chi ha una chiave trapelata. I controlli della route stessa decidono le chiavi di chi può revocare chi chiama, come nell'editor.
- `listen_workflow`: apre l'URL del webhook di test di un flusso di lavoro per una chiamata, da 1 a 600 secondi.
- `start_oauth`: restituisce l'indirizzo che una persona apre per accedere a una credenziale OAuth2. La persona deve comunque dire di sì.

Ognuno passa dalla sua route, quindi il controllo dei permessi, la validazione e la riga di controllo sono quelli della route, e una scrittura richiede un motivo come ogni altro strumento di scrittura.

## Cosa resta fuori

Dieci route rifiutano da sole una chiave, perché vogliono una persona che abbia effettuato l'accesso: creare una chiave API o una chiave di account di servizio, creare un token SCIM, aggiungere, modificare o eliminare un provider di segreti o una destinazione di log, e la tua password. Una chiave che potesse creare chiavi, o cambiare dove va il registro di controllo, è una chiave trapelata che si tiene in vita da sola. La pagina MCP ha l'elenco e il motivo.

## Solo amd64, e perché

Questa versione viene costruita solo per amd64. Il multi-architettura esce in una sua esecuzione, quindi la versione dopo questa è un piccolo cambio di versione che le costruisce entrambe.

## Aggiornare, e tornare indietro

Nessuna migrazione. `helm upgrade` alla 1.2.0, oppure lascia che `:stable` faccia avanzare le unità Quadlet. Rimettere la 1.1.1 è sicuro, perché nel database non è cambiato nulla. Ciò che un rollback non può annullare è ciò che un agente ha già fatto con i nuovi strumenti.
