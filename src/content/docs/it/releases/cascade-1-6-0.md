---
title: "Note di rilascio: HotLoop Cascade 1.6.0"
description: "Cosa include HotLoop Cascade 1.6.0, cosa cambia con l'aggiornamento e cosa leggere prima di toccare un impianto in funzione."
sidebar:
  label: "1.6.0"
---

## Di cosa si tratta

1.6.0 è la versione in cui Cascade smette di essere solo un posto dove girano i workflow e diventa un posto dove partecipano persone, modelli e altri server. Un'esecuzione può fermarsi e chiedere a una persona sul telefono. Un'esecuzione può interrogare un modello che è tuo. I tuoi workflow possono vivere in Git e un'istanza di produzione può rifiutarsi di essere modificata a mano. E qualsiasi API web può diventare passi a partire da un file. Il motore, il formato del file e tutto il resto sono quelli di 1.5.1.

## Chiedere a una persona, da un telefono

Il nuovo passo Chiedi approvazione ferma l'esecuzione e aspetta. Metti `execution.approvalUrl` in una notifica push, e chi la riceve la tocca, legge ciò che hai scritto, compila un piccolo modulo se ne hai fatto uno e preme Approva o Rifiuta. La pagina è semplice, veloce, non richiede accesso a meno che tu non lo chieda, e parla la lingua del browser in tutte e quattordici. L'esecuzione prosegue da Approvata o Rifiutata con chi ha risposto, quando e che cosa ha detto. Ogni risposta è un record: nell'editor sull'esecuzione, nell'API a `GET /api/v1/approvals`, nel server MCP come `list_approvals` e nel registro di audit. Fai in modo che il passo richieda un account autenticato e accetta risposte solo dagli account che elenchi. Un link funziona una sola volta. Aspettare non costa nulla, quindi una risposta può arrivare una settimana dopo e sopravvivere a qualsiasi riavvio.

## Chiedere a un modello

Due passi nuovi, IA: chiedi a un modello e IA: esegui un agente. Il modello è tuo: una credenziale punta a un server che esegui tu (Ollama, vLLM, llama.cpp) o a un servizio ospitato per cui hai una chiave, con il protocollo di OpenAI o quello di Anthropic. Nulla va dove la credenziale non indica, non c'è un servizio ospitato e ogni chiamata passa per la politica di uscita come tutte le altre. Chiedi a un modello mette la risposta sull'elemento, come testo o come oggetto JSON conforme a uno schema che fornisci. Esegui un agente dà al modello un obiettivo e un elenco di strumenti in cui ogni strumento è un altro tuo workflow. Il modello ne chiede uno, Cascade lo esegue, restituisce il risultato, e questo si ripete finché il modello risponde o finisce i turni. Tra un turno e l'altro l'esecuzione attende nel database, quindi uno strumento lento non occupa alcun worker.

## Workflow in Git

Collega un progetto a un repository, un branch e una cartella, e fai push o pull. Push scrive un file per workflow, con il suo nome e il suo id, e lo registra come la persona che ha fatto push con il messaggio che ha dato. Pull allinea il progetto al repository: i file nuovi diventano workflow (disattivati finché non li attivi), i file modificati diventano versioni nuove, gli id vengono mantenuti così un workflow è lo stesso su ogni istanza, e una modifica fatta su entrambi i lati viene segnalata e lasciata intatta salvo che tu dica chi vince. Le eliminazioni avvengono solo quando le chiedi. C'è una scheda su ogni progetto, sei route API e sei strumenti MCP. Parla HTTPS con un nome utente e un token o una password conservati nel vault, attraverso la politica di uscita.

## Istanze protette

Dai un nome a un'istanza (sviluppo, collaudo, produzione) e compare in un badge in cima a ogni schermata. Proteggila, dalle Impostazioni o con `HOTLOOP_CASCADE_PROTECTED` (il valore `protected` del chart, che nessuna impostazione può annullare), e i suoi workflow non possono essere creati, modificati, ripristinati o eliminati a mano nell'editor, nell'API o in MCP. Arrivano con un pull da Git. Le credenziali, le variabili, le esecuzioni e l'attivazione o disattivazione di un workflow restano aperte, perché cambiano da un ambiente all'altro. Un'istanza protetta fa pull e non fa push.

## Connettori come file

Un connettore è un file che dice dove si trova un'API, come accedere e che cosa riceve e restituisce ogni chiamata. Mettilo in `HOTLOOP_CASCADE_CONNECTORS_DIR` (la cartella `connectors` nella directory dei dati) e ogni operazione è un passo, con un modulo, un tipo di credenziale proprio, la paginazione e i tentativi ordinati come fanno i connettori integrati. Il formato è pubblicato, con versione, e ha un JSON Schema (`hotloop-cascade connector schema`). Gli strumenti per scriverne uno sono nel binario: `connector init`, `validate`, `call` (provare un'operazione contro l'API reale) e `index` e `install` per condividere, dove un indice è fatto di file statici con un hash ciascuno. Cascade non scarica mai un indice che non hai indicato. Il server MCP ora ha 91 strumenti.

## Tornare indietro

Questa versione aggiunge tre tabelle (approvazioni e due per Git) e le migrazioni vanno solo avanti, quindi tornare a 1.5.1 richiede il backup fatto prima dell'aggiornamento, non solo la vecchia immagine. Niente di ciò che esiste cambia forma.
