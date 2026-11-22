---
title: "L'API di amministrazione"
description: "Le chiamate HTTP e websocket usate dall'editor e dalla riga di comando, cosa richiede ciascuna e cosa restituisce."
---

| Metodo e percorso | Permesso | Note |
|---|---|---|
| `GET /health` | nessuno | Liveness. Il kubelet non porta alcun token, e richiedere l'autenticazione su questa route farebbe riavviare il pod in loop per sempre. |
| `GET /ready` | nessuno | Readiness, riportata separatamente, così un runtime che non è riuscito ad avviarsi lascia il Service senza che il kubelet uccida il pod. |
| `POST /auth/token` | nessuno | Accedi. Un 429 con `Retry-After` durante un blocco. |
| `POST /auth/revoke` | nessuno | Esci. |
| `GET /auth/mode` | senza accesso | Indica se questo runtime è aperto dalla dashboard EmberCORE: `{"dashboard": bool, "hideLogin": bool}`. L'editor lo chiede prima che qualcuno abbia effettuato l'accesso. |
| `GET /auth/mfa`, `POST /auth/mfa/setup`, `/confirm`, `/disable` | un utente connesso | Il tuo accesso a due fattori. Setup restituisce la chiave, il link `otpauth://` e il codice QR. Confirm e disable accettano `{"code": ...}`. |
| `POST /auth/mfa/reset` | `auth.admin` | Disattiva l'accesso a due fattori di qualcun altro: `{"username": ...}`. |
| `GET /metrics` | nessuno | Prometheus. Solo conteggi e id di nodo, mai contenuti dei messaggi o configurazione. |
| `GET /settings` | `settings.read` | |
| `GET /nodes` | `nodes.read` | Il registro, che alimenta la palette dell'editor e le sue finestre di dialogo. |
| `GET /plugins` | `nodes.read` | I plugin caricati, cosa chiede ciascuno e cosa gli è stato concesso, e quelli rifiutati con il motivo. |
| `GET /flows` | `flows.read` | |
| `GET /flows/export` | `flows.read` | Il file dei flussi esattamente com'è sul disco, per git. |
| `POST /flows` | `flows.write` | Deploy. Accetta una nota facoltativa per il registro dei deploy. |
| `GET /deployments` | `flows.read` | Il registro dei deploy, dal più recente, senza i payload. `?limit=N` lo limita. |
| `GET /audit` | `audit.read` | Chi ha fatto cosa e da dove, dal più recente. `?event=`, `?user=`, `?since=`, `?limit=`. |
| `GET /deployments/{seq}` | `flows.read` | Un record, con i suoi flussi analizzati. Mai le sue credenziali. |
| `GET /deployments/{seq}/flows` | `flows.read` | Il file dei flussi di quel deploy, byte per byte. |
| `GET /deployments/{from}/diff/{to}` | `flows.read` | Differenza nodo per nodo tra due deploy, strutturata e come testo. |
| `POST /flows/diff` | `flows.read` | La differenza tra ciò che è in linea e il documento nel corpo. Non distribuisce nulla. |
| `POST /flows/types` | `flows.read` | Il controllo dei fili tipizzati che fa un deploy, sul documento nel corpo: `{"wires": [...]}`, vuoto quando non c'è nulla di sbagliato. L'editor disegna la risposta. Non distribuisce nulla. |
| `POST /deployments/{seq}/rollback` | `flows.write` | Distribuisce di nuovo i flussi e le credenziali di quel record come nuovo deploy. Accetta l'intestazione rev e un `{"note": ...}` facoltativo. |
| `GET /tests` | `flows.read` | La suite di test del flusso tenuta accanto al file dei flussi, il suo nome file, e se i deploy dipendono da essa. |
| `PUT /tests` | `flows.write` | Sostituisce la suite. Il corpo è lo YAML; uno che non si analizza dà un 400 con il motivo. |
| `POST /tests/run` | `flows.read` | Esegue la suite, o `"tests"` dal corpo, contro `"flows"` dal corpo o ciò che è in esecuzione. Restituisce il rapporto. Non distribuisce nulla. |
| `POST /tests/from-debug` | `flows.read` | Redige un test da `{"node", "msgId"}`, un messaggio mostrato da un nodo Debug. Non salva nulla. |
| `POST /tests/cases` | `flows.write` | Aggiunge i test del corpo, un file di test a sé, in fondo alla suite. |
| `GET /traces` | `flows.read` | Le tracce conservate, dalla più recente, con ciò che contiene il buffer e i suoi limiti. `?limit=N`. 404 con `trace.enabled: false`. |
| `GET /traces/find` | `flows.read` | La traccia in cui si trovava un messaggio, da `?msgId=` e `?node=`, l'id e il nodo Debug che mostra la barra laterale. Restituisce ogni passaggio e il percorso fino a quello richiesto. |
| `GET /traces/{id}` | `flows.read` | Una traccia, ogni passaggio con i suoi tempi e il messaggio come è stato consegnato al nodo. |
| `POST /traces/{id}/test` | `flows.read` | Redige un test di flusso dalla traccia. Non salva nulla. |
| `POST /traces/{id}/replay` | `flows.read` | Inserisce il messaggio che ha avviato la traccia in `"flows"` dal corpo, o in ciò che è in esecuzione, in un processo figlio, e restituisce dove finisce rispetto a dove era finito. Non distribuisce nulla. |
| `GET /runtime/stats` | `status.read` | |
| `POST /inject/{id}` | `inject.write` | Fa scattare un nodo Inject. |
| `GET /comms` | `status.read` | Il websocket di stato e debug dell'editor. Invia il token come sottoprotocollo `hotloop-flow.bearer.<token>`, offerto accanto a `hotloop-flow`. È ciò che fa l'editor. `?access_token=<token>` nell'URL funziona ancora per gli script che già lo usano, e registra un avviso per ogni connessione che lo fa, perché un URL finisce nei log del proxy e degli accessi. |
| `POST /mcp` (e `GET` e `DELETE`, per le revisioni precedenti del protocollo) | `mcp.call` | L'[endpoint MCP](/it/flow/mcp/), dove i flussi sono serviti come strumenti. Un token di sessione o di API come gli altri. Gli strumenti offerti a un chiamante, e che può invocare, sono quelli che i suoi permessi raggiungono. 403 con l'autenticazione disattivata. |

`/metrics` e `/health` senza autenticazione è una decisione e non una dimenticanza. Un raccoglitore Prometheus non porta alcun token bearer, quindi richiederne uno significa consegnare una credenziale al tuo stack di monitoraggio o non avere monitoraggio.

Un utente con l'accesso a due fattori attivo invia `"code"` insieme a nome utente e password a `POST /auth/token`. Senza, la risposta è un 401 con `"mfa": "required"`.

I permessi sono `"*"` per tutto, una stringa esatta come `flows.read`, o una concessione per prefisso come `flows.*`. Un agente che chiama i flussi come strumenti MCP ha bisogno di `mcp.call`. Un account di sola lettura per una dashboard che vuole solo mostrare lo stato dei flussi è `["flows.read", "status.read"]` e nient'altro.

I deploy accettano un'intestazione facoltativa `HotLoop-Flow-Deployment-Rev`. Invia la revisione che hai letto per ultima e un deploy in competizione con un altro editor viene rifiutato con un 409 invece di sovrascrivere in silenzio il lavoro di qualcuno, che è il guasto di cui senti parlare solo da chi ha perso il pomeriggio.

Un deploy riavvia solo ciò che hai cambiato. Un nodo resta attivo quando nulla di ciò da cui dipende si è mosso: le sue impostazioni, la sua scheda, il suo gruppo, il suo ambiente, le sue credenziali e ogni nodo di configurazione che nomina. Trascinarlo sulla tela o ricollegarlo non conta, perché i nuovi fili si agganciano al nodo in esecuzione. Così correggere un refuso in un nodo funzione non butta più giù tutte le sessioni MQTT del box, e un nodo Delay che trattiene dieci minuti di letture continua a trattenerle. È l'intera ragione per cui esiste: quando ogni salvataggio fa rimbalzare lo stabilimento, gli operatori smettono di salvare durante un turno e la correzione aspetta il sabato.

Scegli quanto riavviare con un'intestazione `HotLoop-Flow-Deployment-Type`. Funziona anche `Node-RED-Deployment-Type` di Node-RED, così uno script di deploy che hai già ottiene il riavvio che chiede.

| Tipo | Cosa si riavvia |
|---|---|
| `nodes` (predefinito) | I nodi che hai cambiato, più tutto ciò che nomina un nodo di configurazione che hai cambiato. |
| `flows` | Ogni nodo di qualsiasi flusso che contiene una modifica. |
| `full` | Tutto. Come riavviare il processo. |

La risposta dice cosa ha fatto: `type`, `started`, `restarted`, `stopped` e `unchanged`. Nulla di ciò che è in corso va perso per strada. Il lavoro già in coda su un nodo sostituito finisce sulla vecchia istanza, ciò che arriva durante la sostituzione aspetta la nuova, e un messaggio diretto a un nodo che hai eliminato viene contato e compare come scarto invece di svanire.
