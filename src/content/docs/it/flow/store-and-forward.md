---
title: "Store and forward in HotLoop Flow"
description: "Si segna un collegamento come durevole e i messaggi vanno su disco, in ordine, quando il nodo a valle smette di rispondere, e sopravvivono a un kill -9."
---

Si segna un collegamento come durevole e, finché il nodo all'altro capo sta al passo, è un collegamento normale e non scrive nulla su disco. Nel momento in cui quel nodo smette di accettare messaggi, il collegamento versa nello stesso file SQLite prima che il mittente prosegua, e una pompa li consegna dal più vecchio finché la destinazione prende ciascuno, in lotti fino a 256 per una destinazione che scrive in un database in un colpo solo (InfluxDB lo fa), e uno alla volta per le altre. Così lo historian si ferma, le letture si accumulano su disco invece di bloccare il flusso o andare perse, ed entrano, in ordine, quando torna. Il prezzo di non scrivere nulla finché è tutto sano è che un `kill -9` perde allora ciò che era in memoria, circa quello di un ciclo di lettura, e preferiamo dirlo qui piuttosto che lasciarlo scoprire.

```json
{ "id": "count", "type": "function", "ew_durable": ["influx"], "wires": [["influx", "reply"]] }
```

Non occorre scrivere la chiave a mano. Doppio clic sul collegamento nell'editor e si spunta *Durable*.

Sopravvive a un riavvio, mantiene l'ordine, rispetta una quota su disco (256 MiB per impostazione predefinita, e la politica di overflow del nodo all'altro capo decide che cosa cede quando è pieno) e mostra la propria profondità come `hotloop_flow_durable_wire_depth`. È almeno una volta, non esattamente una volta, e preferiamo dirlo qui piuttosto che farlo scoprire in un postmortem: le parole esatte, e come `influxdb out` resta comunque corretto, sono in [docs/durable](/it/flow/durable-state/).

La prova è `docs/durable/store-and-forward.sh`: un vero InfluxDB 2.9.1 in Podman con venti letture al secondo, fermato per dieci minuti, riportato su, con il runtime ucciso con `kill -9` una volta a metà dell'interruzione e una a metà dello svuotamento. 15,982 letture accettate, 15,982 righe salvate, nessuna mancante, nessuna doppia. Un collegamento durevole sano non scrive nulla di suo, e con il contesto scaricato ogni trenta secondi l'intero processo ha scritto 1.7 MiB all'ora a venti messaggi al secondo (0.04 GB al giorno). Le tabelle e i comandi sono in [docs/durable](/it/flow/durable-state/).

## Un messaggio che la destinazione rifiuta per sempre

Per impostazione predefinita un collegamento continua a riprovare un messaggio che la sua destinazione fa fallire, con una pausa che cresce fino a cinque secondi, e nulla dietro quel messaggio avanza. Per uno historian fermo è esattamente giusto. Per una singola lettura malformata che lo historian non accetterà mai, è un collegamento bloccato per sempre, quindi c'è una via d'uscita, ed è disattivata finché non la si chiede.

```json
{ "id": "count", "type": "function", "ew_durable": ["influx"], "ew_durable_attempts": { "influx": 20 }, "wires": [["influx", "reply"]] }
```

Si dà al collegamento un numero di tentativi, nella finestra del collegamento dell'editor o come sopra, e dopo che la destinazione ha rifiutato un messaggio della coda quel numero di volte, il collegamento lo solleva al flusso come errore del nodo che lo ha rifiutato, con il messaggio allegato come lo porta qualsiasi errore di nodo, e passa al successivo. Un nodo Catch su quel flusso lo riceve e può metterlo da parte, segnalarlo o scriverlo altrove. Senza Catch l'errore compare comunque nella barra laterale di debug e il messaggio è perso, quindi se ne collega uno. Il primo rifiuto, in memoria, arriva al Catch come sempre, quindi un Catch vede lo stesso messaggio due volte: quando ha fallito la prima volta e quando il collegamento si è arreso. Il conteggio è per messaggio e in memoria, quindi un riavvio lo azzera. `hotloop_flow_durable_wire_given_up_total` li conta, accanto alla profondità. Un limite che non è un numero intero pari o superiore a 1 viene segnalato e il collegamento continua a riprovare, perché ignorarlo in silenzio lascerebbe bloccato un collegamento che qualcuno aveva chiesto di fermare.
