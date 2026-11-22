---
title: "MCP, in entrambe le direzioni"
description: "Un agente può chiamare un flusso come strumento, e un flusso può chiamare lo strumento di qualsiasi server MCP, con tre nodi e un nodo di configurazione."
---

Un agente che parla il Model Context Protocol può chiamare un flusso come strumento, e un flusso può chiamare uno strumento di qualsiasi server MCP, compreso quello di HotLoop. Lo fanno tre nodi e un nodo di configurazione: `mcp tool` e `mcp result` servono un flusso, `mcp client` su una connessione `hotloop-flow-mcp-server` chiama verso l'esterno. Se collegate soltanto sensori a dashboard, potete saltare tutto questo: un flusso che non usa nessuno di questi nodi non fa mai una chiamata MCP, e gli unici strumenti che Flow serve di suo sono quelli che leggono e modificano i suoi flussi ([più sotto](#gli-strumenti-propri-di-flow)).

Il protocollo è quello dell'SDK Go (`github.com/modelcontextprotocol/go-sdk` v1.8.0, con licenza permissiva, con alcuni file ancora sotto MIT mentre il progetto completa il cambio di licenza, mantenuto dal progetto MCP). Parla la revisione attuale della specifica, 2026-07-28, che non ha handshake e porta la versione in ogni richiesta, e le revisioni con handshake fino alla 2025-11-25, sullo stesso endpoint. Un client ottiene quella con cui apre la connessione, quindi non c'è nulla da configurare.

## Flussi come strumenti

Un nodo `mcp tool` dichiara uno strumento: un nome, una descrizione per il modello che la legge e uno schema di input. Finché il flusso è distribuito, Flow lo serve su `/mcp` (sotto la radice di amministrazione, se l'avete spostata). Una chiamata diventa un messaggio in uscita dal nodo: `msg.payload` sono gli argomenti della chiamata, `msg.topic` è il nome dello strumento e `msg.mcp` contiene `tool`, `caller` e `callId`. Un nodo `mcp result` più a valle rimanda la risposta, come `http response` risponde a `http in`. Tutto ciò che sta in mezzo è un flusso come un altro.

```json
[
  {"id": "t1", "type": "tab", "label": "Line"},
  {"id": "tool", "type": "mcp tool", "z": "t1", "toolName": "line_status",
   "description": "Status of a production line: its state and speed.",
   "schema": "{\"type\":\"object\",\"properties\":{\"line\":{\"type\":\"string\",\"enum\":[\"L1\",\"L2\",\"L3\"]}},\"required\":[\"line\"],\"additionalProperties\":false}",
   "x": 100, "y": 100, "wires": [["status"]]},
  {"id": "status", "type": "function", "z": "t1", "name": "status", "outputs": 1,
   "func": "msg.payload = {line: msg.payload.line, state: 'running', askedBy: msg.mcp.caller};\nreturn msg;",
   "x": 300, "y": 100, "wires": [["answer"]]},
  {"id": "answer", "type": "mcp result", "z": "t1", "x": 500, "y": 100, "wires": []}
]
```

**Lo schema viene controllato prima che il flusso giri.** È JSON Schema, letto come lo legge il nodo `json` (bozza 2020-12 salvo che lo schema ne indichi un'altra, e un `$ref` a un altro URL è un errore). Uno schema non valido, una radice che non è un oggetto, un nome di strumento che MCP non consente o due nodi che servono lo stesso nome fanno fallire la distribuzione di quel nodo, con il motivo. Una chiamata i cui argomenti non vanno bene riceve come risposta un errore dello strumento che nomina il campo sbagliato, `arguments.line: value must be one of "L1", "L2", "L3"`, così il modello può correggere e riprovare, e il flusso non lo vede mai. Un payload oggetto torna indietro come oggetto e come testo JSON, il testo torna come testo, e un `mcp result` alimentato da un nodo Catch, o con "The work failed" spuntato, risponde con un errore dello strumento con le parole dell'errore stesso. Una chiamata a cui nessuno risponde viene avvisata allo scadere del timeout di risposta, 30 secondi se non ne impostate un altro, e l'errore va a un nodo Catch. Una nuova distribuzione aspetta le chiamate in corso.

**Un agente è un chiamante come gli altri.** `/mcp` accetta gli stessi token dell'API di amministrazione, un token di sessione o un token API, e nient'altro. Non esiste la chiamata anonima: nessun token è un 401, un token che Flow non conosce è un 401, e un token senza il permesso `mcp.call` è un 403, prima che il protocollo veda la richiesta. Un'istanza che gira con `HOTLOOP_FLOW_INSECURE` risponde 403 a ogni richiesta a `/mcp`, perché una chiamata a uno strumento deve avere un chiamante da scrivere nel registro di controllo. Il token di un agente è un token come un altro:

```yaml
auth:
  tokens:
    - name: agent
      hash: sha256:...          # from: hotloop-flow token -name agent
      permissions: ["mcp.call"]
      rateLimit: {calls: 60, per: 1m}   # optional; no rateLimit, no limit
```

La chiamata gira con i diritti di quell'identità. Ogni chiamante ha bisogno di `mcp.call` (oppure `mcp.*`, oppure `*`). Se mettete un altro permesso nella casella "Extra permission" di uno strumento, per esempio `mcp.line3`, serve anche quello, e senza di esso il chiamante non vede nemmeno lo strumento nell'elenco. Due agenti possono condividere un Flow e vedere strumenti diversi.

**Un token può essere limitato a un numero di chiamate.** `rateLimit` su un token API in `auth.tokens` è `calls` in una finestra, `per`, un minuto se lo omettete. La finestra inizia con la prima chiamata del token, una chiamata oltre il numero viene rifiutata fino alla fine della finestra, poi il conteggio riparte. Una chiamata rifiutata non arriva mai al flusso e riceve un errore dello strumento che dice quanti secondi attendere, così un agente in un ciclo viene invitato a rallentare con parole che sa leggere. La specifica non nomina alcun errore per questo caso, quindi si usa l'errore dello strumento che già definisce per una chiamata che non si può eseguire. Un token senza `rateLimit` non viene mai frenato, e nemmeno un token di sessione, perché è di una persona. Ogni token conta per conto suo, e il conteggio sta in memoria, quindi un riavvio lo azzera. Un rifiuto è una riga `mcp.refused` con il motivo `rate limit exceeded`, il che significa che anche un'ondata di chiamate finisce nel registro di controllo.

**Ogni chiamata è nel registro di controllo, con il nome del chiamante.** `mcp.call` viene scritto prima che il flusso giri, con lo strumento, il nodo e un id di chiamata, e `mcp.result` dopo, con l'esito e i millisecondi. `mcp.refused` è un token sbagliato, uno privo del permesso, uno strumento che non può chiamare o argomenti che non andavano bene. Gli argomenti in sé non vengono mai scritti. Nemmeno una richiesta senza alcun token viene scritta, perché dall'altra parte non c'è nessuno da nominare. `GET /audit?event=mcp.` legge tutto questo, e `?user=token:agent` lo restringe a un solo agente.

Provatelo con l'inspector del progetto MCP, che non richiede nulla da Flow:

```bash
npx @modelcontextprotocol/inspector@2.12.0 --cli http://localhost:1880/mcp \
  --transport http --header "Authorization: Bearer $TOKEN" \
  --method tools/call --tool-name line_status --tool-arg line=L3
```

Un test di flusso mette il messaggio che una chiamata avrebbe prodotto dove si trova il nodo `mcp tool`, e `mcp result` consegna al test ciò che avrebbe risposto come `{isError, text, structuredContent}`, così il flusso si prova senza server.

## Gli strumenti propri di Flow

Un agente che potesse chiamare solo ciò che l'autore di un flusso ha collegato non potrebbe vedere i flussi né modificarli, perciò Flow serve 45 strumenti suoi sullo stesso `/mcp`, accanto a quelli dei flussi. Leggono e scrivono. Sette riguardano i flussi, nella tabella qui sotto, e gli altri sono le altre rotte dell'API di amministrazione: le impostazioni, la palette, il registro di controllo, il dettaglio e le differenze delle distribuzioni, l'esportazione, i test di flusso, le tracce dei messaggi, i numeri del runtime, il ripristino del secondo fattore, e i diagrammi e gli strumenti di misura: elencare e leggere un diagramma, avviarlo e fermarlo, guidare il suo debugger, impostare un controllo del suo pannello e attivare o disattivare le scritture di uno strumento. La pagina MCP riporta ogni strumento, la sua rotta e il suo permesso, e le poche rotte che non sono strumenti e perché.

| Strumento | Cosa fa | Permesso |
|---|---|---|
| `list_flows` | ogni scheda e sottoflusso: id, etichetta, disabilitato, numero di nodi e la revisione | `flows.read` |
| `get_flows` | l'intero insieme distribuito come lo legge l'editor, con la revisione | `flows.read` |
| `get_flow` | una scheda o un sottoflusso con i suoi nodi, per id | `flows.read` |
| `deploy_flows` | **deploy**: sostituisce l'intero insieme, con la revisione che avete letto e una nota | `flows.write` |
| `list_deployments` | la cronologia delle distribuzioni, dalla più recente | `flows.read` |
| `rollback_deployment` | **roll back** a una distribuzione precedente, come una nuova | `flows.write` |
| `inject_node` | **press** di un nodo inject, con un messaggio vostro | `inject.write` |

Nessuno è una seconda implementazione. Ognuno esegue il gestore dell'API di amministrazione per lo stesso compito, come il chiamante che l'endpoint ha autenticato, quindi una distribuzione incontra tutto ciò che incontra una distribuzione dall'editor: il documento deve essere analizzabile, la revisione deve essere quella corrente (una vuota sovrascrive di proposito), i collegamenti che non concordano su ciò che vi transita vengono rifiutati, i plugin non consentiti vengono rifiutati, e i test di flusso che falliscono rifiutano la distribuzione, ciascuno con le parole della rotta. La cronologia delle distribuzioni registra il chiamante e la nota, e il registro di controllo ha la riga `deploy` o `inject` con il nome del chiamante, oltre alle righe `mcp.call` e `mcp.result` che ogni chiamata a uno strumento lascia. Un chiamante ha bisogno di `mcp.call` e del permesso dello strumento, e uno strumento che non può chiamare non compare nel suo elenco. Gli strumenti restano a ogni distribuzione, che toglie solo quelli dei flussi, e un flusso non può servire uno dei loro nomi.

`deploy_flows` sostituisce l'intero insieme, quindi un agente legge prima `get_flows` e lo rimanda modificato, con il `rev` che gli è stato dato.

## Chiamare strumenti su altri server

Un nodo `mcp client` chiama uno strumento quando arriva un messaggio, su una connessione `hotloop-flow-mcp-server`: l'indirizzo MCP del server, un token bearer se lo richiede e un timeout. Lo strumento e i suoi argomenti sono input tipizzati, quindi entrambi possono arrivare dal messaggio. `msg.payload` è la risposta strutturata dello strumento quando ne ha una, il testo quando tutto ciò che ha detto era testo, e il contenuto così com'è arrivato in ogni altro caso, e `msg.mcp` contiene il server, lo strumento e l'intera risposta. L'altra operazione, "List the tools", mette in `msg.payload` tutti gli strumenti del server con la loro descrizione e il loro schema di input.

Uno strumento che segnala un errore ne solleva uno, con le parole del server, così un nodo Catch vede ciò che avrebbe visto il modello. **Una chiamata non viene mai inviata due volte.** Uno strumento può muovere un impianto, e una connessione caduta non dice se il server l'ha eseguita, quindi l'errore dice che la connessione è fallita e il messaggio successivo si riconnette. Il token va all'indirizzo che avete dato e da nessun'altra parte, un reindirizzamento non viene seguito, e un errore non lo ripete mai. La connessione si fida delle radici dei certificati di sistema e di nient'altro.

Per HotLoop è l'indirizzo del suo `/mcp` e il `mcp-token` del Secret della sua release, e ci sono tutti gli strumenti della documentazione MCP di HotLoop:

```json
{"id": "plant", "type": "mcp client", "z": "t1", "server": "hotloop",
 "tool": "get_plant_status", "toolType": "str", "arguments": "{}", "argumentsType": "json",
 "x": 300, "y": 100, "wires": [["use"]]}
```

HotLoop vede la chiamata come quella di un client MCP, con le sue regole: MCP legge e scrive, attraverso lo stesso varco di tutti gli altri, quindi un `write_tag` su un tag armato e nell'intervallo passa (una volta attivate le scritture di HotLoop) e uno che rifiuta, per esempio un tag che nessuno ha segnato come scrivibile, torna come errore del nodo, con le parole di HotLoop. Per scrivere dal varco di HotLoop da un flusso senza MCP, usate i nodi HotLoop qui sopra.

## Con cosa è stato provato

**Il server** è provato con il client dell'SDK Go stesso su vero HTTP, in entrambe le epoche: elencare, chiamare, argomenti rifiutati, un permesso rifiutato, un token rifiutato, le righe di controllo, uno strumento che sparisce quando il suo nodo si ferma, e l'intero server di amministrazione davanti, con veri token API e di sessione e il registro di controllo su disco. La CLI Inspector del progetto MCP 2.12.0 ha elencato gli strumenti di un Flow in esecuzione, li ha chiamati, ed è stata rifiutata senza token e con uno inventato. Il nodo `mcp client` è stato eseguito contro un vero HotLoop 4.18.10 (l'immagine IoT pubblicata): ha elencato tutti i suoi 27 strumenti, ha chiamato `get_plant_status`, `list_devices` e `get_states` e ha usato le risposte, è stato rifiutato con un token sbagliato e senza token, ha ricevuto l'errore proprio di HotLoop per uno strumento che non esiste e per una scrittura che MCP non può fare, e uno strumento di Flow chiamato dall'Inspector ha eseguito un flusso che ha chiamato l'MCP di HotLoop e ha risposto con ciò che questo ha detto.

**Non fatto:** OAuth (un token bearer è l'unico ingresso, in entrambe le direzioni), i server stdio, le risorse, i prompt, il campionamento, l'elicitation e le notifiche di avanzamento, e lo schema di output di uno strumento. HotLoop 4.18.10 parla le revisioni con handshake, quindi il nodo lo incontra così; contro un server della revisione attuale è provato solo con quello di Flow. Un server con handshake che dimentica una sessione (un riavvio) fa fallire la prima chiamata successiva, una volta, e la successiva si riconnette. Il limite di chiamate è per token API ed è disattivato finché non lo impostate, quindi un token senza `rateLimit` è limitato solo dalle code, che hanno già un tetto, e dalla dimensione della richiesta, 4 MiB.
