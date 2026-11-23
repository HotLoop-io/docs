---
title: "Plugin senza npm"
description: "Un plugin è un modulo WebAssembly firmato con limite di memoria, timeout e descrittore, e non ottiene accesso all'host a meno che tu non glielo conceda."
---

Un nodo della community di Node-RED è un pacchetto npm. Richiede Node.js sul box e, una volta installato, gira dentro il processo stesso del runtime con tutto ciò che quel processo può raggiungere. Flow non esegue quei nodi e non lo farà mai, quindi ecco cosa fa al loro posto: un plugin è un modulo WebAssembly in un sandbox con un limite di memoria e un timeout, viene con un descrittore da cui l'editor disegna la sua finestra di dialogo, è firmato, e non ottiene accesso all'host a meno che non lo chieda e tu lo conceda.

Cosa significa per te: puoi leggere l'intero contratto di un plugin in un solo file JSON prima che giri, il box rifiuta tutto ciò che non è firmato da una chiave che hai scelto, e il peggio che un plugin difettoso possa fare è far fallire i propri messaggi.

## Che cos'è un plugin

Una directory sotto `<data.dir>/plugins/` (o `plugins.dir`), col nome del plugin, con tre file:

```
plugins/
  moving-average/
    plugin.wasm     the module
    plugin.json     the descriptor: name, dialog, capabilities, limits
    plugin.sig      an ed25519 signature over both
```

Ogni plugin diventa un tipo di nodo, `wasm-<name>`, nella sezione Function della palette. I plugin vengono letti all'avvio di Flow, quindi aggiungerne o cambiarne uno richiede un riavvio. Niente viene letto al momento del messaggio.

### Il modulo

L'ABI è quella del [README](/it/flow/sandboxes/): `hotloop_flow_process` e `hotloop_flow_alloc` sono obbligatorie, `hotloop_flow_free` è facoltativa, e tutto attraversa come JSON. Un guest riceve `{"msg": {...}, "config": {...}}` e restituisce `{"send": [[msgs for output 0], [msgs for output 1]], "status": {...}, "error": "...", "logs": [...]}`. Una proprietà del messaggio che non è JSON semplice, come l'handle di risposta che un nodo HTTP In allega o un buffer binario, non viene data al guest. Il nodo la trattiene e la rimette su ogni messaggio che il guest invia, a meno che il guest non abbia impostato lui stesso quella proprietà, così un plugin può stare tra un HTTP In e un HTTP Response. `config` è ciò che contiene la finestra di dialogo del nodo. Un `error` fa fallire il messaggio verso un nodo Catch, e ciò che aveva inviato prima viene comunque inviato.

Il modulo può importare WASI e, se ha dichiarato una capability di contesto, le due funzioni di contesto qui sotto. Qualsiasi altra cosa importi viene rifiutata al caricamento del plugin, e il rifiuto nomina l'import.

### Il descrittore

`plugin.json` viene letto in modo rigoroso. Un campo che Flow non conosce è un rifiuto, così un `"capabilites"` scritto male viene individuato invece di diventare un plugin che ha silenziosamente chiesto nulla.

| Campo | <span class="sr-only">Dettagli</span> |
|---|---|
| `format` | `1`. Obbligatorio. |
| `name` | Lettere minuscole, cifre e trattini, fino a 40, iniziando con una lettera. Deve coincidere col nome della directory, perché è ciò che usano `plugins.grants` e il file del flusso. |
| `version` | Obbligatorio. Mostrata nell'aiuto del nodo e in `GET /plugins`. |
| `label`, `description`, `help` | L'etichetta della palette, una riga, e Markdown per la barra laterale delle informazioni. |
| `inputs`, `outputs` | Gli ingressi devono essere 1. Le uscite da 0 a 16, predefinito 1. |
| `props` | La finestra di dialogo. Le stesse dichiarazioni di proprietà dei nodi integrati, con i tipi `string`, `text`, `number`, `bool`, `select`, `json` e `list`. Credenziali, riferimenti a nodi di configurazione e tipi di editor di codice vengono rifiutati: un plugin non ha nulla a che fare con essi. |
| `capabilities` | L'accesso all'host che chiede. |
| `limits` | `memoryMiB` e `timeoutMs` che vuole per impostazione predefinita. |

L'editor disegna la finestra di dialogo a partire da `props` senza alcun codice del plugin nel browser. Ogni nodo plugin ottiene anche un campo per il nome, uno per il limite di memoria e uno per il timeout. Quei tre nomi sono riservati.

## Limiti, e come appare una trappola

Ogni nodo plugin ha il proprio limite di memoria e il proprio timeout. Il descrittore del plugin imposta i valori predefiniti (16 MiB e un secondo quando non dice nulla), un nodo può cambiarli nella sua finestra di dialogo, e `plugins.maxMemoryMiB` (64) e `plugins.maxTimeout` (5s) sono il massimo che il box consentirà. Un nodo che chiede più di quanto il box consente fa fallire il deploy e dice quale impostazione aumentare.

Un guest che cresce oltre il suo limite finisce in trappola. Un guest ancora in esecuzione allo scadere del timeout viene fermato. In entrambi i casi il messaggio va al nodo Catch più vicino, l'istanza viene buttata via così il messaggio successivo parte pulito, e nessun altro nodo viene toccato. Ciò che il nodo Catch vede in `msg.error.message`:

```
plugin hog: wasm guest exceeded its memory limit (calling hotloop_flow_process): wasm error: out of bounds memory access
plugin spin: wasm guest timed out while calling hotloop_flow_process
```

Il limite viene riservato in anticipo: un nodo con un limite di 64 MiB contabilizza 64 MiB dello heap Go finché la sua istanza esiste, che il guest lo tocchi o no, perché far crescere un buffer copiandolo permetterebbe all'host di trattenere brevemente più volte il limite. Il test che lo dimostra misura quanto una chiamata ha allocato in tutto (256 MiB per un limite di 256 MiB) e che lo heap torna dov'era dopo la trappola. Quindi imposta i limiti su ciò che serve a un plugin, non sul numero più grande che riesci a scrivere.

## Capability

Nessuna capability, nessun accesso. Ognuna viene collegata solo quando il descrittore la chiede e `plugins.grants` la concede a quel plugin per nome.

| Capability | Cosa dà | Senza di essa |
|---|---|---|
| `clock` | I veri orologi, di parete e monotonico. | Il guest vede un orologio sostitutivo che parte il 2022-01-01 e non ha nulla a che fare con quello dell'impianto. |
| `random` | I byte casuali del sistema operativo. | La stessa sequenza fissa ogni volta. |
| `context.flow` | Leggere e scrivere il contesto del flusso del flusso stesso del nodo. | Le funzioni di contesto non esistono per lui. |
| `context.global` | Leggere e scrivere il contesto globale. | Come sopra. |

```yaml
plugins:
  trustedKeys: ["ed25519:..."]
  grants:
    stamp: [clock]
    remember: [context.flow]
```

Chiedere qualcosa che non è concesso non fallisce al momento del messaggio. Fa fallire il deploy: il flusso viene rifiutato con un 422 prima che venga scritto qualsiasi cosa, i flussi in esecuzione non se ne accorgono, e il messaggio nomina il nodo e la riga da aggiungere:

```
the deploy was refused because of its plugins: node stamp (n1) is a wasm-stamp: the plugin asks for host access the operator has not granted: clock. Add it to plugins.grants.stamp, or remove the capability from the plugin
```

Un rollback è un deploy, quindi un rollback a flussi che usano un plugin la cui concessione è stata nel frattempo revocata viene rifiutato allo stesso modo. Un plugin installato ma non concesso compare comunque nella palette, con le sue capability nel suo aiuto.

### Le funzioni di contesto

Un guest che dichiara una capability di contesto può importare queste dal modulo `hotloop_flow`. I valori attraversano come JSON.

```
context_get(scope i32, keyPtr i32, keyLen i32, outPtr i32, outCap i32) -> i32
context_set(scope i32, keyPtr i32, keyLen i32, valPtr i32, valLen i32) -> i32
```

L'ambito è `0` per il flusso e `1` per il globale. `context_get` restituisce la lunghezza del JSON e lo scrive solo se entra in `outCap`, così un guest che riceve più di quanto ha offerto riprova con un buffer più grande. Una chiave che non c'è è `-1`, e `-2` significa negato: l'ambito non era concesso, la chiave o il JSON erano errati, o lo store ha detto no. Un guest non può leggere un ambito che non gli è stato concesso provando.

## Firma, e fidarsi di un autore

Un plugin è firmato con una chiave ed25519. La firma copre entrambi i file, non solo il modulo, perché il descrittore è dove un plugin chiede l'accesso. Se si firma solo il modulo, chiunque abbia accesso in scrittura alla directory potrebbe aggiungere una capability a un plugin firmato. Il messaggio firmato è:

```
hotloop-flow-plugin-v1
module sha256 <hex of plugin.wasm>
descriptor sha256 <hex of plugin.json>
```

Niente viene consultato quando un plugin si carica: né rete, né log di trasparenza, né catena di certificati. Il controllo è la firma, la chiave che nomina e il tuo elenco di chiavi. È una scelta deliberata per un box su una rete di impianto che può non avere via d'uscita. Significa anche che non c'è un servizio di revoca, quindi revocare una chiave è toglierla da `plugins.trustedKeys` e riavviare.

### Come autore

```bash
hotloop-flow plugin keygen -out acme            # acme.key (private) and acme.pub
hotloop-flow plugin sign -key acme.key plugins/moving-average
hotloop-flow plugin verify -trust acme.pub plugins/moving-average
```

`keygen` scrive una chiave privata PKCS #8 e una chiave pubblica PKIX come PEM, gli stessi file che producono `openssl genpkey -algorithm ed25519` e `openssl pkey -pubout`, e si rifiuta di sovrascrivere l'uno o l'altro. Stampa l'id della chiave e la forma su una riga della chiave pubblica. Tieni la chiave privata fuori da git. Nessuna chiave viene committata.

### Come operatore

Sul chart Helm sono `plugins.trustedKeys`, `plugins.grants` e `plugins.volume`, in [Distribuire Flow](/it/flow/deploying/).

Ti fidi di un autore mettendo la sua chiave pubblica in `plugins.trustedKeys`, o in `HOTLOOP_FLOW_PLUGIN_TRUSTED_KEYS`, separate da virgole. Ogni voce è la riga `ed25519:<base64>`, una chiave pubblica PEM o il percorso di un file che ne contiene una, che è il modo in cui entra un Secret o un ConfigMap montato:

```yaml
plugins:
  trustedKeys:
    - ed25519:/iYdLE7lAGb2YFglPYjhoPItgdiQ9xEPVMqQNrD8Hqg=
    - /etc/hotloop-flow/keys/acme.pub
```

Senza chiavi fidate, ogni plugin viene rifiutato. Una chiave che non si riesce ad analizzare è un errore di avvio. La fiducia è per chiave e non per plugin, quindi fidarsi di un autore significa fidarsi di tutto ciò che firma. Ciò che un plugin può poi usare è una decisione separata, presa in `plugins.grants` per nome.

## Quando rifiuta

Un plugin che non si carica viene registrato all'avvio, elencato con il suo motivo in `GET /plugins`, assente dalla palette e nominato nel rifiuto quando si distribuisce un flusso che lo usa. Un plugin difettoso non impedisce mai al resto di Flow di avviarsi. `hotloop-flow plugin verify` esegue gli stessi controlli, così un autore vede ciò che vedrebbe un operatore.

| Cosa non va | Cosa dice |
|---|---|
| Nessun `plugin.sig` | `unsigned: plugin.sig is missing` |
| Modulo o descrittore modificato dopo la firma | `signature does not match: plugin.wasm or plugin.json was changed after it was signed with key <id>, or the signature is damaged` |
| Firmato da una chiave di cui non ti fidi | `signing key is not trusted: it was signed with key <id>, which is not in plugins.trustedKeys` |
| Nessuna chiave configurata | `signing key is not trusted: no trusted keys are configured, so no plugin can load (plugins.trustedKeys)` |
| File di firma danneggiato | `signature file is malformed: ...` |
| Descrittore con un campo sconosciuto, un tipo errato o una capability errata | `plugin.json is not valid: ...` con il nome del campo |
| Il modulo importa qualcosa che l'host non fornisce | `the module is not usable: guest imports env.reach_out, which the host does not provide` |
| Il modulo usa le funzioni di contesto senza dichiarare una capability | `the module is not usable: guest imports hotloop_flow.context_set but was not given a context capability` |
| Il nome della directory e `name` differiscono | `the directory is called "x" and plugin.json says the plugin is "y"; they have to match` |

La firma viene controllata prima che il descrittore venga analizzato e prima che il modulo venga compilato, quindi il codice non firmato non viene mai compilato.

## I due esempi

* `moving-average` è Rust. Fa la media di una lettura sugli ultimi N messaggi e tiene la sua finestra nella propria memoria. Non chiede nulla. `cargo build --locked --release --target wasm32-wasip1`, poi `plugin.wasm` è il `moving_average.wasm` che produce.
* `stamp` è TinyGo. Aggiunge l'ora a ogni messaggio, quindi chiede `clock`. Si compila con il container di TinyGo, usando Podman: `podman run --rm -v "$PWD/stamp:/src:ro" -v "$PWD/out:/out" -w /src docker.io/tinygo/tinygo:0.43.0 tinygo build -target=wasip1 -buildmode=c-shared -o /out/plugin.wasm .`

Flow è una casa Go. L'host, la firma, la CLI e ogni test sono in Go, e l'esempio TinyGo è Go. L'esempio Rust c'è perché un formato di plugin che funzionasse solo per il linguaggio in cui è scritto l'host non sarebbe un formato di plugin, e perché Rust è ciò in cui è più probabile che sia già scritta una libreria di elaborazione del segnale. Questa è la ragione scritta dell'unico esempio non Go. I crate con cui si compila sono `serde` e `serde_json`, entrambi con licenza permissiva, compilati nel modulo di esempio e non in Flow.

## Cosa non è dimostrato

* I plugin sono stati eseguiti su hardware reale (2026-11-17).
* Su Kubernetes i file del plugin arrivano tramite `plugins.volume`, qualsiasi sorgente di volume. Un ConfigMap contiene un plugin solo fino al suo limite di 1 MiB, quindi un plugin grande come l'esempio TinyGo richiede un claim.
* Non c'è una capability di rete. Un plugin non può fare una richiesta, ed è voluto finché qualcuno non ha un motivo con un elenco di host consentiti da affiancare.
* I test di Flow eseguono i plugin per davvero, nello stesso processo figlio di ogni altro nodo. Le capability di un plugin sono le stesse che gli darebbe il deploy.
* `hotloop-flow test` lanciato a mano da una shell non carica i plugin. Il cancello di deploy e le esecuzioni dei test dell'editor sì.
