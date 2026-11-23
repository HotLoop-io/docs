---
title: "Note di rilascio: HotLoop Flow 2.3.0"
description: "Cosa porta HotLoop Flow 2.3.0, cosa cambia con l'aggiornamento e cosa leggere prima di toccare un impianto in funzione."
sidebar:
  label: "2.3.0"
---

HotLoop Flow 2.3.0 è la versione in cui Flow raggiunge il resto dell'impianto in tre modi nuovi e intercetta un messaggio dalla forma sbagliata prima che faccia danni. Parla con HotLoop, un agente può chiamare un flusso come strumento tramite MCP, e un plugin è un file WebAssembly firmato e non un pacchetto npm. JSON Schema ora controlla i messaggi sul nodo `json`, sulle porte di un nodo e sui collegamenti nell'editor. Una modifica può riguardare un flusso che già gira, ed è la prima cosa sotto Cosa è cambiato.

## Novità

**Nodi HotLoop**
- Una connessione `hotloop-flow-hotloop`, che è un URL e un account. Accede con `POST /api/auth/login`, invia il token bearer che HotLoop restituisce e accede di nuovo quando HotLoop dice che la sessione non c'è più. Un account operatore basta per tutto quanto segue.
- `hotloop in` segue il feed in tempo reale di HotLoop e invia un messaggio per ogni entità che cambia stato: `msg.topic` è l'id dell'entità, `msg.payload` è il nuovo stato e `msg.hotloop` porta lo stato che aveva prima, i suoi attributi, la sua qualità e i suoi timestamp. Se il collegamento cade, il badge diventa rosso e un solo errore arriva a un nodo Catch per l'interruzione, non uno per tentativo. Quando torna, un'entità cambiata nel frattempo viene inviata e una che non è cambiata no.
- `hotloop state` legge un'entità quando arriva un messaggio. `hotloop script` esegue uno script HotLoop con i campi che gli dai. `hotloop recipe` applica una ricetta con i suoi parametri, e una versione più vecchia se la chiedi di proposito. HotLoop controlla ogni campo e parametro, fa passare ogni scrittura dal suo blocco di scrittura e tiene il registro. Flow invia il motivo `flow:<node id>`, e HotLoop lo registra nel suo audit delle scritture e nel suo giornale.
- Una chiamata rifiutata o fallita arriva a un nodo Catch con le parole di HotLoop e il suo stato. Nulla di ciò che è stato scritto viene annullato, perché è anche la regola di HotLoop.

**Scritture attraverso il blocco di HotLoop**
- `modbus write`, `opcua write`, `s7 write` e `ethernetip write` hanno due nuovi campi, **Scrivi tramite HotLoop** e **Tag HotLoop** (`device/tag`). Con un HotLoop scelto, il valore va al blocco di scrittura di HotLoop, che decide nel suo ordine: scritture attive, tag armato, valore nell'intervallo.
- Una scrittura che il blocco rifiuta non raggiunge mai l'apparecchiatura. Anche un HotLoop non raggiungibile fa fallire la scrittura. Non ripiega mai sulla scrittura diretta, perché sarebbe una scrittura che il blocco non ha mai visto.
- Valgono l'indirizzo, il tipo di dato e la scala propri di HotLoop per il tag, quindi indirizzo e tipo di dato sul nodo Flow non vengono usati. Togliere HotLoop rimette il nodo esattamente com'era. Il blocco accetta un booleano, un numero o un testo per scrittura, quindi un elenco di registri viene rifiutato con un messaggio che lo dice.

**MCP, in entrambe le direzioni**
- `mcp tool` e `mcp result` espongono un flusso come strumento. Il nodo strumento dichiara un nome, una descrizione e uno schema di input, Flow lo serve su `/mcp`, e il nodo risultato rimanda indietro la risposta del flusso. Un agente accede con una sessione o un token API come chiunque altro, la chiamata gira con i permessi di quel token e ogni chiamata e rifiuto finisce nel registro di audit con il nome del chiamante. Niente token, niente chiamata.
- `mcp client`, su una connessione `hotloop-flow-mcp-server`, chiama uno strumento su qualsiasi server MCP, compreso quello di HotLoop, e usa ciò che torna. Non invia mai una chiamata due volte, perché uno strumento può muovere un'apparecchiatura e una connessione caduta non dice se la chiamata è stata eseguita.
- Un token API in `auth.tokens` può avere un `rateLimit` con `calls` e una finestra, un minuto se la ometti. Una chiamata oltre il limite non raggiunge mai il flusso, torna come errore dello strumento che dice quando riprovare e scrive una riga `mcp.refused` con il motivo. Un token senza `rateLimit` non viene mai limitato.
- Parla la revisione corrente della specifica, 2026-07-28, e le revisioni dell'handshake fino alla 2025-11-25, sullo stesso endpoint. Un flusso che non usa nessuno di questi nodi non fa mai una chiamata MCP, e Flow non serve alcuno strumento che non gli sia stato dato.

**Plugin senza npm**
- Un plugin è un modulo WebAssembly, un descrittore da cui l'editor disegna la sua finestra di dialogo e una firma ed25519 su entrambi. I plugin non firmati o manomessi si rifiutano di caricarsi e dicono perché. `hotloop-flow plugin keygen` crea una chiave, e `docs/plugins.md` ha il resto.
- Un guest che supera il limite di memoria o il timeout finisce in trap verso un nodo Catch mentre tutto il resto continua a girare. Un plugin che chiede un accesso all'host che l'operatore non ha concesso (`clock`, `random`, `context.flow`, `context.global`) fa fallire il deploy di qualsiasi flusso che lo usa, prima che venga scritto un solo byte.
- Senza chiavi attendibili ogni plugin viene rifiutato, e senza concessioni ogni plugin che chiede accesso all'host fallisce. Per impostazione predefinita non si carica nulla.
- Il chart accoglie tutto sotto `plugins`, con un volume che accetta qualsiasi sorgente di volume Kubernetes. Disattivato non produce nulla, e un `helm template` dei valori predefiniti è quello di prima.

**Fili tipizzati**
- Dai al nodo `json` un JSON Schema nelle sue impostazioni e ogni valore che gestisce viene controllato contro di esso. Un valore che non corrisponde va a un nodo Catch invece di proseguire sul collegamento, e l'errore nomina ogni campo errato, come `payload.temp: got string, want number`. Senza schema nelle impostazioni il nodo valida contro `msg.schema`, come fa il nodo `json` di Node-RED. È la bozza 2020-12 a meno che lo schema ne nomini un'altra, e un `$ref` a un altro URL o a un file viene rifiutato, non recuperato.
- Un nodo può dichiarare ciò che accetta e ciò che ogni uscita promette, in due chiavi del file di flussi che ogni altro strumento ignora, così un flusso che le contiene fa ancora il ciclo di andata e ritorno byte per byte. Quando entrambe le estremità di un collegamento dichiarano uno schema e nessun messaggio potrebbe soddisfare entrambi, il deploy viene rifiutato prima che venga scritto un solo byte. Le incongruenze che Flow non può vedere in anticipo si fermano dove rompono lo schema, vanno a Catch con il percorso di ogni campo errato e sono contate in `hotloop_flow_node_schema_mismatches_total`.
- Un `inject` che imposta un letterale che il nodo successivo non può mai accettare, come il numero 250 in un nodo che accetta da 0 a 100, viene rifiutato al deploy allo stesso modo. Timestamp, `env`, contesto e JSONata vengono saltati, mai indovinati.
- L'editor scrive il tipo del mittente su ogni collegamento. È attenuato quando solo un'estremità ha un tipo ed è rosso quando i due non potranno mai concordare, e il rosso viene dal controllo del runtime stesso, quindi la tela e il deploy non possono discordare. La sezione **Tipi** della finestra di dialogo di un nodo è dove li imposti.

Sono altri nove tipi di nodo, 79 in tutto: cinque per HotLoop con la sua connessione e quattro per MCP con la sua connessione.

## Cosa è cambiato

- Il nodo `json` ignorava `msg.schema`. Ora un messaggio che porta `msg.schema` viene validato contro di esso e, se non corrisponde, va a un nodo Catch e non prosegue sul collegamento. Un flusso che lascia un `msg.schema` sui suoi messaggi per un altro scopo lo noterà.
- Un deploy ora può essere rifiutato per un'incongruenza di tipi (`deploy.refused`, motivo `typed wires`), ma solo per un flusso che dichiara schemi sulle sue porte o imposta un letterale `inject` in un nodo che ne dichiara uno. Un flusso senza schemi da nessuna parte si comporta esattamente come prima.
- I nodi di scrittura hanno i due nuovi campi, vuoti per impostazione predefinita. Senza un HotLoop scelto, un nodo di scrittura si comporta come nella 2.2.0.
- Il validatore di schemi è `santhosh-tekuri/jsonschema` v6 (con licenza permissiva) e MCP è l'SDK Go, `modelcontextprotocol/go-sdk` v1.8.0. Entrambi sono nuovi moduli Go, quindi il testo di licenza che l'immagine porta in `/usr/share/doc/hotloop-flow/` ha più voci. Il runtime WebAssembly era già nella 2.2.0.
- Tre correzioni alla coda durevole. Un collegamento durevole rimosso ora rifiuta una scrittura in ritardo e la conta come scartata, e rimuoverne uno non attende più l'intero timeout di chiusura su una destinazione bloccata su un messaggio. Prima, un messaggio restituito dopo che il collegamento era sparito restava addebitato alla quota fino a un riavvio. Un collegamento che scarta il più vecchio non espelle più un messaggio già confermato o che la pompa aveva appena letto, cosa che restituiva due volte lo stesso spazio e lasciava la profondità della coda e la quota sotto ciò che era su disco. Il testo sulla quota durevole in `docs/durable/README.md` ora dice che un messaggio deviato può portare la quota di qualche messaggio oltre il limite per un momento.
- Il README e `docs/bench/` riportano i risultati del Raspberry Pi 5, e la roadmap spunta il Pi 5 e lascia aperti il Pi 4, lo Zero 2 W e le scritture sulla scheda SD.

## Note di aggiornamento

Dalla 2.2.0 basta cambiare l'immagine (`helm upgrade`, o il nuovo tag nella tua unità Quadlet). Nessuna migrazione, nessun flag, niente di nuovo al primo avvio. Un `flows.json` e un file di configurazione che giravano sulla 2.2.0 girano sulla 2.3.0, e il ciclo di andata e ritorno byte per byte del file di flussi resta intatto.

- Tornare alla 2.2.0 è sicuro per qualsiasi flusso che non usi i nodi o le chiavi nuove. Un nodo HotLoop, MCP o plugin non parte sulla 2.2.0 (tipo di nodo sconosciuto), e un nodo di scrittura con un HotLoop scelto scrive direttamente sull'apparecchiatura, perché la 2.2.0 non legge il campo. Togli HotLoop da quei nodi di scrittura prima di tornare indietro.
- HotLoop registra l'account con cui Flow accede. L'API non dà al client modo di indicare il proprio attore, quindi l'id del nodo Flow va come motivo e l'account è quello della connessione. Usa un account creato per Flow se vuoi ritrovare facilmente le sue scritture.
- MCP è un nuovo modo di entrare in Flow, e richiede un token. Non viene servito nulla finché un flusso non ha un nodo `mcp tool`, e una chiamata senza token o con uno inventato viene rifiutata.

## Nuove impostazioni

| YAML | Ambiente | Predefinito |
|---|---|---|
| `plugins.dir` | `HOTLOOP_FLOW_PLUGINS_DIR` | vuoto, cioè `plugins` in `data.dir` |
| `plugins.trustedKeys` | `HOTLOOP_FLOW_PLUGIN_TRUSTED_KEYS` | nessuna. Ognuna è `ed25519:<base64>`, una chiave pubblica PEM o un file che ne contiene una. Senza nessuna, ogni plugin viene rifiutato. |
| `plugins.grants` | `HOTLOOP_FLOW_PLUGIN_GRANTS` | nessuna. Il nome di un plugin verso `clock`, `random`, `context.flow`, `context.global`. La variabile è `name=cap,cap;name=cap`. |
| `plugins.maxMemoryMiB` | `HOTLOOP_FLOW_PLUGIN_MAX_MEMORY_MIB` | 64, da 1 a 4095 |
| `plugins.maxTimeout` | `HOTLOOP_FLOW_PLUGIN_MAX_TIMEOUT` | `5s` |
| `auth.tokens[].rateLimit.calls`, `.per` | | 0 chiamate, cioè nessun limite. `per` è `1m` quando imposti `calls` e non `per`. |

Le connessioni HotLoop e MCP si impostano nell'editor: URL, account e un timeout. Il chart ha tutte le impostazioni dei plugin sotto `plugins` in `values.yaml`, con `enabled: false`, e nient'altro di nuovo.

Immagine: `ghcr.io/hotloop-io/hotloop-flow:2.3.0`, linux/amd64 e linux/arm64. Chart: `https://hotloop.io/hotloop-flow/`. Il README di questo tag contiene il resto: https://github.com/HotLoop-io/hotloop-flow/blob/v2.3.0/README.md
