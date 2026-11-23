---
title: "API HTTP di HotLoop"
description: "Ogni chiamata a cui HotLoop risponde via HTTP, cosa richiede, cosa accetta e cosa restituisce. L'interfaccia web non usa altro."
---

Ogni chiamata a cui il Gateway risponde via HTTP, che cosa richiede, che cosa accetta e che cosa restituisce. L'interfaccia web non usa altro: non esiste un'API privata dietro le schermate, quindi tutto ciò che l'interfaccia può fare, uno script può farlo con le stesse chiamate e gli stessi permessi.

Questa pagina viene verificata rispetto al codice. Quindi l'elenco delle route e di chi può chiamarle non è la descrizione di un'API com'era una volta. Le forme di richieste e risposte qui sotto sono state prese da un Gateway in esecuzione; i test non le controllano, quindi se modificate un handler, modificate qui anche la sua sezione.

Il contesto di ogni funzione è nella sua pagina: [Autenticazione e utenti](/it/iot/authentication/), [Entità](/it/iot/entities/), [l'albero delle apparecchiature e le etichette](/it/iot/equipment/), [Automazioni](/it/iot/automations/), [Report pianificati](/it/gateway/reports/), [Gestione della flotta](/it/gateway/fleet/), [Notifiche degli allarmi](/it/iot/notifications/), [Backup e ripristino](/it/iot/backup/) e [MCP](/it/iot/mcp/). Questa pagina è l'elenco; quelle spiegano i motivi.

## Convenzioni

### Dove si trova

Tutto passa dall'unica porta HTTP dell'applicazione (`HOTLOOP_LISTEN_ADDR`, `:8080` per impostazione predefinita). Dietro un proxy che serve l'applicazione sotto un percorso, impostate `HOTLOOP_BASE_PATH` e il Gateway lo toglie, quindi `/hotloop/api/devices` e `/api/devices` sono la stessa chiamata. I percorsi qui sotto sono scritti senza.

### Accedere: un cookie o un token bearer

Ogni route `/api/` richiede una sessione, tranne l'accesso (con password, o con PIN o badge su un pannello kiosk), i webhook in ingresso e i link per riconoscere gli allarmi, ciascuno dei quali porta la propria prova nella richiesta. `POST /api/auth/login` risponde con un token e lo imposta anche come cookie `iiot_session` (HttpOnly, SameSite=Lax, Secure quando la richiesta è arrivata via TLS o con `X-Forwarded-Proto: https`). Un browser usa il cookie e non vede mai il token. Uno script invia invece il token:

```
Authorization: Bearer 3f9c...e1
```

Sono la stessa sessione, controllata allo stesso modo. Una sessione dura `HOTLOOP_AUTH_SESSION_TTL` (12 ore per impostazione predefinita). Senza sessione, ogni route `/api/` risponde:

```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="hotloop"

{"error":"not logged in"}
```

oppure `"the session is invalid or has expired"` per un token revocato o scaduto, oppure `"this account no longer has access"` per un account disabilitato.

Con `HOTLOOP_AUTH_INSECURE=true` non c'è alcun accesso: non viene controllato nulla, tutti i permessi qui sotto sono concessi a tutti, e il nome registrato per una scrittura arriva dall'header `X-EmberNET-User`, `X-Forwarded-User`, `X-Auth-Request-User`, `X-Remote-User` o `X-Forwarded-Email` del proxy, oppure è `operator` se nessuno è impostato. Ha senso solo dietro una NetworkPolicy che lasci raggiungere il pod soltanto dal proxy della dashboard. Vedere [Autenticazione e utenti](/it/iot/authentication/#funzionare-senza-accesso).

MCP è separato: ha un proprio token bearer (`HOTLOOP_MCP_TOKEN`) e non guarda mai una sessione. Vedere [MCP](#mcp).

### Permessi

Un utente connesso ha un elenco di permessi, che vengono dal suo ruolo o sono impostati direttamente sull'account. Una route che ne richiede uno che l'utente non ha risponde:

```
HTTP/1.1 403 Forbidden

{"error":"viewer1 does not have the \"values.write\" permission"}
```

La [tabella dei permessi](#permessi) dice quale ruolo ha cosa.

### Errori

Ogni errore prodotto dall'API stessa è un JSON di una sola forma:

```json
{"error": "value is outside the tag's configured range: 120 is outside 0..95"}
```

`/readyz` aggiunge un `detail`, e una chiamata di servizio fallita aggiunge le scritture che ha fatto. Il messaggio è scritto per la persona che lo legge: dice che cosa non andava e, quando c'è, che cosa fare invece. Mostratelo così com'è.

| Stato | Quando |
|---|---|
| 400 | La richiesta è sbagliata: un corpo malformato, un campo che non supera la validazione, un campo sconosciuto, un parametro mancante, un servizio sconosciuto |
| 401 | Nessuna sessione, una sessione scaduta, o una password errata all'accesso |
| 403 | L'utente non ha il permesso, oppure il gate di scrittura ha rifiutato la scrittura per policy: scritture disattivate, tag non armato, entità disabilitata |
| 404 | Ciò che il percorso o il corpo nomina non esiste |
| 409 | Esiste già, oppure è in uno stato che non lo consente: un allarme non sospeso, un nodo che ha ancora figli, un'entità senza stato noto da commutare, uno script già in esecuzione, una ricetta rifiutata o già in applicazione |
| 422 | Un valore che il gate di scrittura ha rifiutato nel merito: fuori dall'intervallo del tag, fuori dal passo di un'entità |
| 502 | Il dispositivo ha risposto con un errore suo e il corpo contiene le sue parole; oppure una ricetta è partita e non tutte le destinazioni sono state raggiunte, e il corpo dice quali sono partite e quali no |
| 503 | Il dispositivo non è connesso, oppure il motore degli allarmi non è in esecuzione |
| 500 | Un guasto dentro il server. Il corpo è `internal error (ref …); the server log has the detail under that ref` e nient'altro, e il log contiene l'errore completo sotto quel riferimento. L'unico 500 con un messaggio vero è la pressione di un pulsante il cui rilascio non è partito, perché quel messaggio dice esattamente che cosa controllare |

Tutto ciò che l'API non sa collocare è un 500, mai un 400. Un'interruzione del database restituita come 400 dice all'operatore che ha scritto qualcosa di sbagliato, e va a cercare un errore di battitura che non c'è.

Due errori non vengono dall'API e sono testo semplice, non JSON: un percorso che non corrisponde a nessuna route risponde `404 page not found`, e un percorso noto chiamato con il metodo sbagliato risponde `405 method not allowed`.

Una scrittura rifiutata non è mai un 500. Una schermata di stabilimento che mostra un rifiuto di policy come un guasto del server insegna agli operatori a ignorare gli errori.

### Corpi

I corpi delle richieste sono JSON, al massimo 4 MiB (un webhook in ingresso, 1 MiB). **I campi sconosciuti vengono rifiutati**, non ignorati:

```json
{"error":"request body: json: unknown field \"x\""}
```

Un'impostazione scritta male che viene scartata in silenzio sembra identica a una che ha funzionato, quindi il decodificatore risponde di no.

`POST` e `PUT` su dispositivi, tag, allarmi, automazioni, membri della flotta e report sostituiscono l'intero oggetto: un campo omesso prende il valore zero, e un booleano omesso è `false`. Leggete, modificate, rimandate. Le eccezioni sono i `PUT` di entità e apparecchiature, che modificano solo i campi inviati, e le credenziali dei dispositivi, che restano quando vengono omesse (vedere sotto).

### I segreti sono solo in scrittura

Una credenziale salvata in un dispositivo (una password di broker, un header HTTP, una password nell'indirizzo) non viene mai rimandata indietro, a nessun ruolo, amministratore compreso. Appare come `[redacted]`:

```json
"config": {"clientId": "docs-api-tankfarm", "password": "[redacted]", "username": "tank"}
```

Quando salvate il dispositivo, inviate il segnaposto (o lasciate fuori la chiave) per mantenere il valore salvato, inviate un valore nuovo per sostituirlo, e inviate `""` o `null` per cancellarlo. Un dispositivo nuovo non può essere salvato con il segnaposto, e un salvataggio che sposta il dispositivo su un altro host mantenendo una credenziale viene rifiutato, così una password salvata non può essere portata a un listener altrui. Le regole complete sono in [Autenticazione e utenti](/it/iot/authentication/#le-credenziali-dei-dispositivi-sono-in-sola-scrittura). Lo stesso vale per ogni altra credenziale che il Gateway custodisce: le impostazioni mostrano `set` o `not set`, la diagnostica toglie le credenziali dai target MCP in uscita, e nulla in questa API restituisce un hash di password o un token di sessione, tranne quello che vi consegna l'accesso.

### camelCase, tranne dove è snake_case

La maggior parte dell'API è in camelCase (`deviceId`, `pollIntervalMs`, `createdAt`), come dalla prima versione e come richiede il contratto `TagValue` della dashboard EmberNet.

Gli endpoint di entità, stati, servizi, apparecchiature ed etichette sono in snake_case (`entity_id`, `last_changed`, `parent_id`, `label_id`). È voluto: l'API delle entità usa la forma comune di entità, stato e servizio, così tutto ciò che già la parla parla anche questa, e l'albero delle apparecchiature è il registro delle aree del modello di entità, con la forma attesa dagli stessi consumatori. Dove i due si incontrano, ciascun lato mantiene la propria scrittura: un dispositivo ha `equipmentId`, un'entità ha `equipment_id`.

### Orari, durate e chiavi dei tag

- **Gli orari** sono RFC 3339 in UTC, con frazioni di secondo quando ci sono: `2026-09-27T20:21:58.255869Z`. L'impostazione del fuso orario di visualizzazione cambia ciò che mostra l'interfaccia, mai ciò che restituisce l'API.
- **Un orario che non è ancora avvenuto viene omesso.** Una regola mai eseguita non ha `lastRun`, un dispositivo mai interrogato non ha `lastPoll` né `lastGood`, un allarme che nessuno ha riconosciuto non ha `ackedAt`, un membro della flotta mai visto non ha `lastSeen`. Un campo orario mancante significa mai. Non vedrete mai l'orario zero di Go, `0001-01-01T00:00:00Z`, in una risposta o in un evento del flusso. Una dozzina di campi lo inviava, e la schermata delle automazioni mostrava una regola mai eseguita come eseguita l'ultima volta 739887 giorni fa. Un test legge ogni route e ogni campo orario nel codice per mantenerlo così.
- **Gli sparkline** sono l'eccezione: lì `timestamps` è in millisecondi Unix, perché va direttamente in un grafico.
- **Le durate** dicono la loro unità nel nome: `pollIntervalMs`, `onDelaySec`, `minutes`, `durationMs`. `uptime` nello stato è una stringa di durata Go (`11m13s`).
- **Una chiave di tag** è `device/tag`, la forma che prendono tutti i parametri `?tag=` e tutti i campi `tag`. I nomi dei tag possono contenere barre (percorsi OPC UA, topic MQTT), quindi solo la prima barra separa: `plc-1/Line/Zone 1` è il tag `Line/Zone 1` del dispositivo `plc-1`.
- **Un parametro di query numerico** che non è un numero viene ignorato e si usa il valore predefinito, quindi `?limit=abc` equivale a `?limit` non impostato.
- **Le liste vuote** sono `[]`, mai `null`, in ogni risposta e in ogni evento del flusso, a qualsiasi profondità. Non serve controllare null prima di `.length`. Un `null` che vedete non è mai una lista: è uno dei campi documentati che ammettono null, come l'`equipment_id` di un'entità o il `parent_id` di un nodo radice. Un campo lista segnato come facoltativo può comunque essere omesso del tutto.

### Funzioni facoltative

Flotta, notifiche, backup e report pianificati sono disattivati finché non è impostata la loro variabile `HOTLOOP_*_ENABLED`. Con la funzione disattivata, la sua route di elenco risponde comunque 200, con `"configured": false` e una lista vuota, così una schermata può dire «non abilitato» invece di «qui non c'è niente». Ogni altra route di quella funzione risponde 400 con un errore che nomina la variabile:

```json
{"error":"backups are not enabled (HOTLOOP_BACKUP_ENABLED)"}
```

`GET /api/sites` fa lo stesso quando non è configurato alcun server MCP in uscita.

### Non presente in questo prodotto

HotLoop viene fornito come IoT, Edge, Gateway ed Edge Relay da un'unica base di codice, e una funzione che un prodotto non ha non è disattivata: non è nel binario. Su IoT, Edge e Gateway le sue route rispondono comunque, dopo lo stesso controllo dei permessi, con un 404 che lo dice e nomina entrambe le estremità, così uno script distingue «macchina sbagliata» da «URL sbagliato»:

```json
{"error":"scheduled reports are part of HotLoop Gateway; this is HotLoop IoT","product":"iot","feature":"reports"}
```

Non un 400, perché non c'è alcuna variabile che lo risolva, e non un 5xx, perché nulla è andato storto. `GET /api/status` dice subito quale prodotto ha risposto e quali funzioni ha, così un client può chiedere invece di sondare.

### Tutto ciò che cambia qualcosa viene registrato

Ogni creazione, modifica, eliminazione, scrittura, riconoscimento e accesso finisce nel log di sistema (`GET /api/events`) con il nome dell'utente, e ogni scrittura su un tag, rifiutata o no, finisce nell'audit delle scritture (`GET /api/writes`). L'API non ha un percorso silenzioso.

## Permessi

Chi ha cosa. Un account con un elenco di permessi esplicito ha esattamente ciò che quell'elenco nomina, al posto dell'insieme del suo ruolo. `*` concede tutto e `resource.*` concede tutto ciò che sta sotto una risorsa (`reports.*`). Il ruolo admin è `*`.

| Permesso | viewer | operator | admin |
|---|---|---|---|
| `status.read` | sì | sì | sì |
| `devices.read` | sì | sì | sì |
| `devices.write` | no | no | sì |
| `tags.read` | sì | sì | sì |
| `tags.write` | no | no | sì |
| `values.read` | sì | sì | sì |
| `values.write` | no | sì | sì |
| `board.write` | no | sì | sì |
| `entities.read` | sì | sì | sì |
| `entities.write` | no | no | sì |
| `helpers.write` | no | sì | sì |
| `equipment.read` | sì | sì | sì |
| `equipment.write` | no | no | sì |
| `alarms.read` | sì | sì | sì |
| `alarms.write` | no | no | sì |
| `alarms.ack` | no | sì | sì |
| `automations.read` | sì | sì | sì |
| `automations.write` | no | no | sì |
| `automations.trigger` | no | sì | sì |
| `scripts.read` | sì | sì | sì |
| `scripts.run` | no | sì | sì |
| `scripts.write` | no | no | sì |
| `recipes.read` | sì | sì | sì |
| `recipes.apply` | no | sì | sì |
| `recipes.write` | no | no | sì |
| `blueprints.read` | sì | sì | sì |
| `blueprints.apply` | no | sì | sì |
| `blueprints.write` | no | no | sì |
| `dashboards.read` | sì | sì | sì |
| `dashboards.write` | no | no | sì |
| `energy.read` | sì | sì | sì |
| `energy.write` | no | no | sì |
| `fleet.read` | sì | sì | sì |
| `fleet.write` | no | sì | sì |
| `fleet.rebirth` | no | sì | sì |
| `fleet.restart` | no | no | sì |
| `fleet.update` | no | no | sì |
| `fleet.config` | no | no | sì |
| `notify.test` | no | no | sì |
| `notify.escalation` | no | no | sì |
| `backup.read` | no | no | sì |
| `backup.run` | no | no | sì |
| `reports.read` | sì | sì | sì |
| `reports.run` | no | sì | sì |
| `reports.write` | no | no | sì |
| `sites.read` | sì | sì | sì |
| `settings.read` | sì | sì | sì |
| `settings.write` | no | no | sì |
| `events.read` | sì | sì | sì |
| `logbook.read` | sì | sì | sì |
| `users.manage` | no | no | sì |

La linea è la stessa ovunque: un operatore fa funzionare lo stabilimento (scrive valori, riconosce allarmi, attiva automazioni, dà un colpetto a un relè), e solo un amministratore cambia come è configurato lo stabilimento, o fa qualcosa verso l'esterno per conto del Gateway (riavviare un relay, inviargli la configurazione, mandare una pagina di prova, definire un report che invia dati dello stabilimento per e-mail da qualche parte).

## Indice degli endpoint

La colonna del permesso dice che cosa controlla la route. `session` significa qualsiasi utente connesso, senza altri permessi. `none` significa che non serve nemmeno la sessione, e la sezione spiega perché. `(in handler)` significa che il controllo avviene dentro l'handler e non prima di esso, e la sezione spiega perché.

La colonna del prodotto indica il più piccolo HotLoop che ha la route: `all` è IoT, Edge e Gateway, `edge` è Edge e Gateway, `gateway` è il solo Gateway. Ogni prodotto registra ogni route e controlla su di essa lo stesso permesso. Su un prodotto che non la include, la route risponde 404 e dice dove si trova; vedere [Non presente in questo prodotto](#non-presente-in-questo-prodotto).

| Metodo | Percorso | Permesso | Prodotto |
|---|---|---|---|
| `GET` | `/healthz` | none | all |
| `GET` | `/readyz` | none | all |
| `POST` | `/api/auth/login` | none | all |
| `POST` | `/api/auth/kiosk` | none | all |
| `POST` | `/api/auth/logout` | session | all |
| `POST` | `/api/auth/activity` | session | all |
| `GET` | `/api/auth/session` | session | all |
| `POST` | `/api/auth/password` | session | all |
| `GET` | `/api/users` | `users.manage` | all |
| `POST` | `/api/users` | `users.manage` | all |
| `PUT` | `/api/users/{username}` | `users.manage` | all |
| `DELETE` | `/api/users/{username}` | `users.manage` | all |
| `POST` | `/api/users/{username}/password` | `users.manage` | all |
| `DELETE` | `/api/users/{username}/lockout` | `users.manage` | all |
| `PUT` | `/api/users/{username}/pin` | `users.manage` | all |
| `DELETE` | `/api/users/{username}/pin` | `users.manage` | all |
| `GET` | `/api/opcua/certificates` | `users.manage` | all |
| `GET` | `/api/users/{username}/certificates` | `users.manage` | all |
| `POST` | `/api/users/{username}/certificates` | `users.manage` | all |
| `POST` | `/api/users/{username}/certificates/{thumbprint}/revoke` | `users.manage` | all |
| `DELETE` | `/api/users/{username}/certificates/{thumbprint}` | `users.manage` | all |
| `GET` | `/api/status` | `status.read` | all |
| `GET` | `/api/protocols` | `status.read` | all |
| `GET` | `/api/diagnostics` | `status.read` | all |
| `GET` | `/api/devices` | `devices.read` | all |
| `POST` | `/api/devices` | `devices.write` | all |
| `GET` | `/api/devices/{id}` | `devices.read` | all |
| `DELETE` | `/api/devices/{id}` | `devices.write` | all |
| `POST` | `/api/devices/{id}/enabled` | `devices.write` | all |
| `POST` | `/api/devices/{id}/browse` | `devices.read` | all |
| `POST` | `/api/devices/{id}/import` | `tags.write` | all |
| `GET` | `/api/devices/{id}/network` | `devices.read` | all |
| `PUT` | `/api/devices/{id}/network` | `devices.write` | all |
| `DELETE` | `/api/devices/{id}/network` | `devices.write` | all |
| `GET` | `/api/unifi/{id}/networks` | `devices.read` | all |
| `PUT` | `/api/unifi/{id}/networks/{network}` | `devices.write` | all |
| `POST` | `/api/unifi/{id}/networks/{network}/accept-all` | `devices.write` | all |
| `GET` | `/api/unifi/{id}/known` | `devices.read` | all |
| `PUT` | `/api/unifi/{id}/networks/{network}/known/{mac}` | `devices.write` | all |
| `DELETE` | `/api/unifi/{id}/networks/{network}/known/{mac}` | `devices.write` | all |
| `GET` | `/api/unifi/{id}/clients` | `devices.read` | all |
| `GET` | `/api/unifi/consoles` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/overview` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/topology` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/devices` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/wifi` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/events` | `devices.read` | all |
| `POST` | `/api/unifi/{id}/starter-alarms` | `alarms.write` | all |
| `GET` | `/api/discovery` | `devices.read` | all |
| `GET` | `/api/discovery/{source}/{key}` | `devices.read` | all |
| `POST` | `/api/discovery/{source}/{key}/accept` | `devices.write` | all |
| `POST` | `/api/discovery/{source}/{key}/ignore` | `devices.write` | all |
| `POST` | `/api/discovery/{source}/{key}/unignore` | `devices.write` | all |
| `POST` | `/api/discovery/{source}/{key}/review/apply` | `devices.write` | all |
| `POST` | `/api/discovery/{source}/{key}/review/reject` | `devices.write` | all |
| `GET` | `/api/network-discovery` | `devices.read` | all |
| `GET` | `/api/network-discovery/{key}` | `devices.read` | all |
| `POST` | `/api/network-discovery/{key}/accept` | `devices.write` | all |
| `POST` | `/api/network-discovery/{key}/ignore` | `devices.write` | all |
| `POST` | `/api/network-discovery/{key}/unignore` | `devices.write` | all |
| `POST` | `/api/network-discovery/probe` | `devices.write` | all |
| `GET` | `/api/integrations` | `devices.read` | all |
| `POST` | `/api/integrations/{id}/probe` | `devices.write` | all |
| `POST` | `/api/integrations/{id}/setup` | `devices.write` | all |
| `GET` | `/api/broker/logins` | `users.manage` | all |
| `POST` | `/api/broker/logins` | `users.manage` | all |
| `PUT` | `/api/broker/logins/{name}` | `users.manage` | all |
| `DELETE` | `/api/broker/logins/{name}` | `users.manage` | all |
| `GET` | `/api/mqtt/brokers` | `devices.read` | all |
| `POST` | `/api/mqtt/brokers` | `devices.write` | all |
| `PUT` | `/api/mqtt/brokers/{id}` | `devices.write` | all |
| `DELETE` | `/api/mqtt/brokers/{id}` | `devices.write` | all |
| `GET` | `/api/tags` | `tags.read` | all |
| `POST` | `/api/tags` | `tags.write` | all |
| `DELETE` | `/api/tags/{device}/{name}` | `tags.write` | all |
| `GET` | `/api/values` | `values.read` | all |
| `GET` | `/api/sparkline` | `values.read` | all |
| `GET` | `/api/board` | `values.read` | all |
| `PUT` | `/api/board` | `board.write` | all |
| `POST` | `/api/write` | `values.write` | all |
| `GET` | `/api/history` | `values.read` | all |
| `GET` | `/api/writes` | `values.read` | all |
| `GET` | `/api/entities` | `entities.read` | all |
| `GET` | `/api/entities/composites` | `entities.read` | all |
| `GET` | `/api/entities/{entity_id}` | `entities.read` | all |
| `GET` | `/api/entities/{entity_id}/image` | `entities.read` | all |
| `PUT` | `/api/entities/{entity_id}` | `entities.write` | all |
| `POST` | `/api/entities` | `entities.write` | all |
| `DELETE` | `/api/entities/{entity_id}` | `entities.write` | all |
| `GET` | `/api/states` | `entities.read` | all |
| `GET` | `/api/states/{entity_id}` | `entities.read` | all |
| `GET` | `/api/energy/meters` | `energy.read` | all |
| `POST` | `/api/energy/meters` | `energy.write` | all |
| `GET` | `/api/energy/meters/{id}` | `energy.read` | all |
| `PUT` | `/api/energy/meters/{id}` | `energy.write` | all |
| `DELETE` | `/api/energy/meters/{id}` | `energy.write` | all |
| `GET` | `/api/energy/summary` | `energy.read` | all |
| `GET` | `/api/energy/summary/{period}` | `energy.read` | all |
| `GET` | `/api/energy/series` | `energy.read` | all |
| `GET` | `/api/energy/series/{meter}/{period}/{step}` | `energy.read` | all |
| `POST` | `/api/services/{domain}/{service}` | `values.write`, `alarms.ack`, `helpers.write`, `scripts.run`, `recipes.apply` (in handler) | all |
| `GET` | `/api/helpers` | `entities.read` | all |
| `POST` | `/api/helpers` | `entities.write` | all |
| `GET` | `/api/helpers/{entity_id}` | `entities.read` | all |
| `PUT` | `/api/helpers/{entity_id}` | `entities.write` | all |
| `DELETE` | `/api/helpers/{entity_id}` | `entities.write` | all |
| `GET` | `/api/equipment` | `equipment.read` | all |
| `POST` | `/api/equipment` | `equipment.write` | all |
| `GET` | `/api/equipment/{id}` | `equipment.read` | all |
| `PUT` | `/api/equipment/{id}` | `equipment.write` | all |
| `DELETE` | `/api/equipment/{id}` | `equipment.write` | all |
| `GET` | `/api/labels` | `equipment.read` | all |
| `POST` | `/api/labels` | `equipment.write` | all |
| `GET` | `/api/labels/{label_id}` | `equipment.read` | all |
| `PUT` | `/api/labels/{label_id}` | `equipment.write` | all |
| `DELETE` | `/api/labels/{label_id}` | `equipment.write` | all |
| `PUT` | `/api/devices/{id}/labels` | `equipment.write` | all |
| `GET` | `/api/alarms` | `alarms.read` | all |
| `POST` | `/api/alarms` | `alarms.write` | all |
| `POST` | `/api/alarms/import/codesys` | `alarms.write` | all |
| `DELETE` | `/api/alarms/{id}` | `alarms.write` | all |
| `POST` | `/api/alarms/{id}/ack` | `alarms.ack` | all |
| `POST` | `/api/alarms/{id}/shelve` | `alarms.ack` | all |
| `POST` | `/api/alarms/{id}/unshelve` | `alarms.ack` | all |
| `GET` | `/api/alarms/events` | `alarms.read` | all |
| `GET` | `/api/automations` | `automations.read` | all |
| `POST` | `/api/automations` | `automations.write` | all |
| `POST` | `/api/automations/validate` | `automations.write` | all |
| `DELETE` | `/api/automations/{id}` | `automations.write` | all |
| `POST` | `/api/automations/{id}/enabled` | `automations.write` | all |
| `POST` | `/api/automations/{id}/trigger` | `automations.trigger` | all |
| `GET` | `/api/runs` | `automations.read` | all |
| `POST` | `/api/automations/{id}/blueprint-upgrade` | `blueprints.apply` | all |
| `GET` | `/api/blueprints` | `blueprints.read` | all |
| `POST` | `/api/blueprints` | `blueprints.write` | all |
| `GET` | `/api/blueprints/{id}` | `blueprints.read` | all |
| `PUT` | `/api/blueprints/{id}` | `blueprints.write` | all |
| `DELETE` | `/api/blueprints/{id}` | `blueprints.write` | all |
| `POST` | `/api/blueprints/{id}/instantiate` | `blueprints.apply` | all |
| `GET` | `/api/dashboards` | `dashboards.read` | all |
| `POST` | `/api/dashboards` | `dashboards.write` | all |
| `GET` | `/api/dashboards/{id}` | `dashboards.read` | all |
| `PUT` | `/api/dashboards/{id}` | `dashboards.write` | all |
| `DELETE` | `/api/dashboards/{id}` | `dashboards.write` | all |
| `GET` | `/api/dashboards/{id}/export` | `dashboards.read` | all |
| `POST` | `/api/dashboards/import` | `dashboards.write` | all |
| `GET` | `/api/scripts` | `scripts.read` | all |
| `POST` | `/api/scripts` | `scripts.write` | all |
| `POST` | `/api/scripts/validate` | `scripts.write` | all |
| `GET` | `/api/scripts/{id}` | `scripts.read` | all |
| `PUT` | `/api/scripts/{id}` | `scripts.write` | all |
| `DELETE` | `/api/scripts/{id}` | `scripts.write` | all |
| `POST` | `/api/scripts/{id}/run` | `scripts.run` | all |
| `POST` | `/api/scripts/{id}/stop` | `scripts.run` | all |
| `GET` | `/api/scripts/{id}/runs` | `scripts.read` | all |
| `GET` | `/api/recipes` | `recipes.read` | all |
| `POST` | `/api/recipes` | `recipes.write` | all |
| `POST` | `/api/recipes/capture` | `recipes.write` | all |
| `GET` | `/api/recipes/{id}` | `recipes.read` | all |
| `PUT` | `/api/recipes/{id}` | `recipes.write` | all |
| `DELETE` | `/api/recipes/{id}` | `recipes.write` | all |
| `GET` | `/api/recipes/{id}/versions` | `recipes.read` | all |
| `GET` | `/api/recipes/{id}/versions/{version}` | `recipes.read` | all |
| `POST` | `/api/recipes/{id}/validate` | `recipes.apply` | all |
| `POST` | `/api/recipes/{id}/apply` | `recipes.apply` | all |
| `GET` | `/api/recipes/{id}/applications` | `recipes.read` | all |
| `POST` | `/api/webhook/{path}` | none | all |
| `GET` | `/api/fleet` | `fleet.read` | gateway |
| `POST` | `/api/fleet` | `fleet.write` | gateway |
| `DELETE` | `/api/fleet/{id}` | `fleet.write` | gateway |
| `POST` | `/api/fleet/{id}/rebirth` | `fleet.rebirth` | gateway |
| `POST` | `/api/fleet/{id}/restart` | `fleet.restart` | gateway |
| `POST` | `/api/fleet/{id}/update` | `fleet.update` | gateway |
| `POST` | `/api/fleet/{id}/config` | `fleet.config` | gateway |
| `DELETE` | `/api/fleet/{id}/config` | `fleet.config` | gateway |
| `POST` | `/api/notify/test` | `notify.test` | all |
| `GET` | `/api/notify/escalation` | `notify.escalation` | all |
| `PUT` | `/api/notify/escalation` | `notify.escalation` | all |
| `POST` | `/api/notify/ack/{token}` | none | all |
| `GET` | `/api/backup` | `backup.read` | all |
| `POST` | `/api/backup` | `backup.run` | all |
| `GET` | `/api/reports` | `reports.read` | gateway |
| `POST` | `/api/reports` | `reports.write` | gateway |
| `GET` | `/api/reports/{id}` | `reports.read` | gateway |
| `PUT` | `/api/reports/{id}` | `reports.write` | gateway |
| `DELETE` | `/api/reports/{id}` | `reports.write` | gateway |
| `POST` | `/api/reports/{id}/run` | `reports.run` | gateway |
| `GET` | `/api/reports/{id}/runs` | `reports.read` | gateway |
| `GET` | `/api/reports/{id}/runs/{run}/download` | `reports.read` | gateway |
| `GET` | `/api/sites` | `sites.read` | gateway |
| `GET` | `/api/settings` | `settings.read` | all |
| `PUT` | `/api/settings` | `settings.write` | all |
| `GET` | `/api/historian/targets` | `settings.read` | all |
| `POST` | `/api/historian/targets` | `settings.write` | all |
| `PUT` | `/api/historian/targets/{id}` | `settings.write` | all |
| `DELETE` | `/api/historian/targets/{id}` | `settings.write` | all |
| `GET` | `/api/events` | `events.read` | all |
| `GET` | `/api/logbook` | `logbook.read` | all |
| `GET` | `/api/stream` | `status.read` | all |
| qualsiasi | `/mcp` | token MCP | all |
| qualsiasi | `/mcp/` | token MCP | all |
| `GET` | `/manifest.webmanifest` | none | all |
| `GET` | `/sw.js` | none | all |
| `GET` | `/next` | none | all |
| `GET` | `/next/` | none | all |
| qualsiasi | `/` | none | all |

## Salute

Per il kubelet e i load balancer. Nessuno dei due ha bisogno di una sessione: una sonda non ha un account, e nessuna dice nulla sullo stabilimento.

### `GET /healthz`

Liveness. `200` con il testo `ok` finché il processo serve HTTP. Non tocca il database, di proposito: un'interruzione del database deve togliere il pod dalla rotazione, non farlo riavviare in un ciclo.

### `GET /readyz`

Readiness. Fa un ping al database con un margine di 5 secondi.

```json
{"status":"ready"}
```

`503` quando non riesce a raggiungerlo, con il motivo in `detail` (la forma viene dall'handler; il testo del motivo è quello che ha detto il driver del database):

```json
{"error":"not ready","detail":"<why the database did not answer>"}
```

Un'applicazione che non raggiunge il proprio historian non dovrebbe ricevere traffico.

## Autenticazione

Vedere [Autenticazione e utenti](/it/iot/authentication/) per gli account, i ruoli e il primo amministratore.

### `POST /api/auth/login`

Non serve alcuna sessione, per costruzione.

| Campo | Tipo | <span class="sr-only">Dettagli</span> |
|---|---|---|
| `username` | string | Obbligatorio. Maiuscole e spazi intorno vengono ignorati |
| `password` | string | Obbligatorio |

```json
{"expiresAt":"2026-09-28T08:21:00.571794Z","permissions":["*"],"role":"admin","token":"<token>","username":"admin"}
```

Imposta anche lo stesso token nel cookie `iiot_session`. `401` `"invalid username or password"` per un nome sbagliato, una password sbagliata o un account disabilitato senza distinzione, e impiega lo stesso tempo in ogni caso: quale dei tre fosse non è una cosa da dire a uno sconosciuto. `429` per un account che ha avuto troppe password o PIN sbagliati di fila, qualunque cosa venga inviata, con un header `Retry-After`; vedere [Autenticazione e utenti](/it/iot/authentication/#il-blocco-dopo-password-e-pin-errati).

### `POST /api/auth/kiosk`

Accesso su un pannello condiviso con un PIN o un badge, come descrive [Autenticazione e utenti](/it/iot/authentication/#pannelli-kiosk-pin-o-badge-e-disconnessione-per-inattività). Non serve alcuna sessione, per costruzione.

| Campo | Tipo | <span class="sr-only">Dettagli</span> |
|---|---|---|
| `code` | string | Obbligatorio. Il PIN, o il valore digitato da un lettore di badge che emula la tastiera. Gli spazi intorno vengono ignorati |
| `username` | string | Facoltativo. Con esso viene controllato solo il PIN di quell'account e uno sbagliato conta per il blocco di quell'account. Senza, il codice viene cercato tra quelli di tutti gli account |

```json
{"expiresAt":"2026-10-21T08:21:00.571794Z","idleSec":300,"permissions":["status.read","tags.read"],"role":"operator","username":"olga"}
```

Imposta il cookie `iiot_session` e, a differenza di `POST /api/auth/login`, non risponde con il token: una sessione kiosk appartiene al browser del pannello. `idleSec` è quanto sopravvive la sessione senza che nessuno la tocchi. `401` `"that PIN or badge isn't recognized"` per un codice sbagliato, un codice troppo corto e il codice di un account disabilitato senza distinzione, e impiega lo stesso tempo in ogni caso. `429` quando l'account è bloccato (vedere [Il blocco](/it/iot/authentication/#il-blocco-dopo-password-e-pin-errati)), con un header `Retry-After`. Un codice inviato senza `username` che non corrisponde a nessuno non viene contato contro alcun account; il pannello che lo ha inviato, per indirizzo del client, aspetta mezzo secondo in più prima che il suo prossimo tentativo di quel tipo venga controllato, fino a `ui.panelDelaySeconds`, e uno giusto lo azzera. Il pannello non viene mai bloccato. `400` quando l'installazione funziona senza accesso (`HOTLOOP_AUTH_INSECURE`), perché allora non c'è nessuno con cui accedere.

### `POST /api/auth/activity`

Una persona ha toccato il pannello. Nessun corpo. `{"status":"ok"}`. Su una sessione kiosk è ciò che sposta in avanti il suo limite di inattività; lo fa anche ogni altra richiesta che non sia una lettura (una scrittura, un riconoscimento). Un `GET`, il flusso live e i caricamenti in background della pagina stessa non lo fanno: altrimenti terrebbero collegata per sempre l'ultima persona. Una sessione creata con una password non ha limite di inattività e nulla da spostare.

### `POST /api/auth/logout`

Termina la sessione con cui è arrivata la richiesta (cookie o bearer) e cancella il cookie. Nessun corpo. `{"status":"logged out"}`.

### `GET /api/auth/session`

Chi sono. Per la sequenza di avvio dell'interfaccia.

```json
{"authenticated":true,"permissions":["*"],"role":"admin","username":"admin"}
```

Una sessione creata su un pannello kiosk aggiunge `"idleSec"`, il suo limite di inattività in secondi, ed è così che la pagina sa di doversi scollegare da sola.

Con l'autenticazione disattivata (`HOTLOOP_AUTH_INSECURE`), risponde `{"authenticated":false,"insecure":true}` invece di un 401, così l'interfaccia può dire perché non c'è accesso invece di indovinarlo.

### `POST /api/auth/password`

Cambia la propria password. Nessun permesso: conoscere la password attuale è la credenziale.

| Campo | Tipo | <span class="sr-only">Dettagli</span> |
|---|---|---|
| `currentPassword` | string | Obbligatorio |
| `newPassword` | string | Obbligatorio, almeno 8 caratteri |

`{"status":"password changed; log in again"}`. **Ogni sessione dell'account termina, compresa questa**, e il cookie viene cancellato: un cambio di password che lascia funzionanti le vecchie sessioni è un cambio solo di nome. `401` se la password attuale è sbagliata, `400` se la nuova è troppo corta.

## Utenti

Tutto solo per amministratori (`users.manage`). Gli hash delle password non compaiono mai in una risposta; il campo non ha nome JSON.

### `GET /api/users`

```json
[{"username":"admin","role":"admin","disabled":false,"hasPin":false,"locked":false,"createdAt":"2026-09-27T20:19:28.036228Z","updatedAt":"2026-09-27T20:19:28.036228Z","lastLogin":"2026-09-27T20:21:00.575455Z"}]
```

`permissions` compare solo su un account che ha un elenco esplicito. `hasPin` dice se l'account ha un PIN o un badge kiosk; il valore e il suo hash non compaiono mai.

### `POST /api/users`

| Campo | Tipo | <span class="sr-only">Dettagli</span> |
|---|---|---|
| `username` | string | Obbligatorio. Lettere minuscole, cifre, punto, trattino basso, trattino, che inizia con una lettera o una cifra, da 2 a 64 caratteri |
| `password` | string | Obbligatorio, almeno 8 caratteri |
| `role` | string | `admin`, `operator` o `viewer`. Per impostazione predefinita `viewer` |
| `permissions` | string[] | Facoltativo. Sostituisce per intero l'insieme del ruolo |

Risponde con il nuovo utente. `400` per un nome, un ruolo o una password errati, `409` se il nome è già preso.

### `PUT /api/users/{username}`

| Campo | Tipo | <span class="sr-only">Dettagli</span> |
|---|---|---|
| `role` | string | Obbligatorio a meno che sia impostato `permissions` |
| `permissions` | string[] | Facoltativo. Vuoto significa «usa il ruolo» |
| `disabled` | bool | `true` disabilita l'account e termina ogni sessione che ha |

Risponde con l'utente aggiornato. `400` per un ruolo sconosciuto, o per la disabilitazione dell'ultimo amministratore abilitato: sarebbe un blocco senza nessuno che possa annullarlo. `404` per un utente sconosciuto.

### `DELETE /api/users/{username}`

`{"status":"deleted"}`. `400` per il proprio account o per l'ultimo amministratore abilitato, `404` per un utente sconosciuto.

### `POST /api/users/{username}/password`

Un amministratore imposta la password di un altro senza conoscere la vecchia. `{"password": "..."}`, almeno 8 caratteri. Risponde `{"status":"password reset"}` e termina ogni sessione di quell'account.

### `PUT /api/users/{username}/pin`

Un amministratore dà a un account un PIN o un valore di badge per accedere a un pannello kiosk, o sostituisce quello che ha. `{"code": "482913"}`: da 6 a 72 caratteri, senza spazi né caratteri di controllo, cifre o qualsiasi altra cosa digiti un lettore di badge. Risponde `{"status":"PIN set","username":"olga","hasPin":true}`. Il valore viene sottoposto a hash con bcrypt, come una password, e non viene mai registrato né rimandato indietro. `400` per un codice troppo corto, troppo lungo o con uno spazio dentro, e per un codice che un altro account ha già: un pannello trova l'account dal solo codice, quindi un codice apre un solo account. `404` per un utente sconosciuto. Non tocca la password né alcuna sessione.

### `DELETE /api/users/{username}/lockout`

Fa rientrare un account bloccato prima che il blocco scada, e riporta a zero il conteggio delle sue password e dei suoi PIN sbagliati. `{"status":"unlocked","username":"olga","locked":false}`. `404` per un utente sconosciuto. Un account bloccato mostra `"locked":true` e `"lockedUntil"` in `GET /api/users`.

### `DELETE /api/users/{username}/pin`

Toglie il PIN o il badge e scollega l'account da ogni pannello kiosk in cui è collegato. La sua password, e le sue sessioni sul proprio computer, non vengono toccate. `{"status":"PIN cleared","username":"olga","hasPin":false}`. `404` per un utente sconosciuto.

### `GET /api/opcua/certificates`

Ogni certificato X.509 associato a un utente per accedere al server OPC UA (vedere [il server OPC UA](/it/edge/opc-ua-server/#x509-user-certificates)), dal più recente: `{"serverAcceptsCertificates":false,"certificates":[...]}`. Ognuno ha `thumbprint` (SHA-256 della forma DER, in esadecimale minuscolo), `username`, `label`, `subject`, `notBefore`, `notAfter`, `addedBy`, `addedAt`, `revokedAt` e `revokedBy` una volta revocato, `lastUsed` una volta usato, e `state`: `active`, `revoked`, `expired` o `not yet valid`. Solo un certificato attivo fa accedere qualcuno. `serverAcceptsCertificates` indica se il server OPC UA è attivo e ha `HOTLOOP_OPCUA_SERVER_ALLOW_X509` impostato; i certificati vengono conservati in entrambi i casi. Viene memorizzato o inviato solo il certificato pubblico.

### `GET /api/users/{username}/certificates`

Lo stesso elenco per un utente. `404` per un utente sconosciuto.

### `POST /api/users/{username}/certificates`

Associa un certificato a un utente. `{"certificate": "<PEM text or base64 of the DER bytes>", "label": "Olga's laptop"}`; l'etichetta è facoltativa. Risponde `201` con il certificato come elencato. Il certificato deve essere RSA con una chiave di almeno 2048 bit e non deve essere scaduto. `400` dice quale di queste condizioni non è soddisfatta, e anche per qualcosa che non è un certificato: una chiave privata viene rifiutata per nome e non viene mai conservata né rimandata indietro, e così una catena. `404` per un utente sconosciuto. `409` quando il certificato è già associato, a questo utente o a un altro: un certificato è una persona. La modifica è nel registro con chi l'ha fatta.

### `POST /api/users/{username}/certificates/{thumbprint}/revoke`

Revoca un certificato. Non può più far accedere, una sessione aperta con esso termina entro i 10 secondi della cache dei permessi, e i tentativi successivi vengono rifiutati e registrati come revocati. Resta in elenco come `revoked` con chi l'ha fatto e quando, e revocarlo di nuovo mantiene il primo record. `{thumbprint}` è lo SHA-256 come elencato; sono accettati due punti, spazi e maiuscole. `404` quando il certificato non è di questo utente.

### `DELETE /api/users/{username}/certificates/{thumbprint}`

Dimentica un certificato. Associarlo di nuovo lo fa funzionare di nuovo. `404` quando non è di questo utente. Eliminare l'utente elimina i suoi certificati.

## Stato e diagnostica

### `GET /api/status`

La barra di intestazione: contatori del runtime, il riepilogo degli allarmi, il nome dello stabilimento e quale prodotto è. `product` è `iot`, `edge` o `gateway`, come `hotloop --product`. `features` indica quali tra le funzioni che differiscono tra i prodotti ha questo: `edge-publish`, `fleet`, `opcua-server`, `reports` e `sites` in un Gateway, la prima e la terza in Edge, nessuna in IoT. `version` è la build, e `imageDigest` è il digest dell'immagine da cui è stato avviato, cosa che un numero di versione non può dirvi su una macchina che segue `:stable`. C'è solo quando lo ha detto il supervisore (le unità Quadlet lo fanno, prima di ogni avvio; un binario nudo e un'installazione Helm non possono) ed è omesso altrimenti.

```json
{
  "alarms": {"critical":0,"high":1,"medium":0,"low":0,"unacked":0,"total":1},
  "features": ["edge-publish","fleet","opcua-server","reports","sites"],
  "plantName": "Demo Plant",
  "product": "gateway",
  "runtime": {
    "startedAt": "2026-09-27T20:19:28.06635851Z", "uptime": "11m13s",
    "devices": 2, "connected": 2, "degraded": 0, "disconnected": 0,
    "tags": 5, "cachedTags": 5, "writesOk": 4, "writesRefused": 3,
    "bus": {"subscribers":4,"published":653,"dropped":0},
    "historian": {"queued":1085,"written":1085,"filtered":329,"dropped":0,"failed":0,"queueLen":0,"queueCap":50000},
    "writePolicy": {"allowWrites":true,"allowMcpWrites":true,"confirmWrites":true},
    "protocols": ["codesys","ethernet-ip","http","modbus","mqtt","mtconnect","opcua","s7comm","snmp","unifi"]
  },
  "siteId": "docs",
  "version": "4.23.2"
}
```

### `GET /api/protocols`

Ogni protocollo che il Gateway conosce, e se questa build ne ha il driver.

```json
[{"id":"opcua","name":"OPC UA","description":"The universal one. ...","transport":"opc.tcp binary","defaultPort":4840,"writable":true,"browsable":true,"deviceTypes":["plc","cnc","robot","ipc","hmi","historian","gateway"],"library":"...","available":true}]
```

### `GET /api/diagnostics`

Ciò che mostra la schermata di diagnostica: il pool del database, la coda dell'historian e la dimensione dello storico, il bus dei tag, il motore delle entità, il registratore del registro, il runtime, MCP (server e connessioni in uscita) e le regole armate del motore delle automazioni, i percorsi dei webhook e la coda dei cambi di stato.

```json
{
  "automations": {"armed":[],"stateChangesDropped":0,"stateChangesPending":0,"webhooks":[]},
  "bus": {"subscribers":4,"published":654,"dropped":0},
  "database": {"type":"postgres","totalConns":3,"idleConns":3,"acquiredConns":0,"maxConns":10,"historyMode":"timescale","timescaleVersion":"2.30.1"},
  "entities": {"entities":8,"droppedBatches":0,"pendingChanges":0,"droppedChanges":0},
  "historian": {"queued":1087,"written":1085,"filtered":329,"dropped":0,"failed":0,"queueLen":0,"queueCap":50000},
  "historyStats": {"mode":"timescale","rows":996,"distinctTags":5,"oldest":"2026-09-27T20:21:38.609853Z","newest":"2026-09-27T20:30:39.507987Z","sizeBytes":73728},
  "logbook": {"recording":true,"retentionDays":90,"queued":0,"dropped":0,"written":212,"suppressed":36,"writeErrors":0},
  "mcp": {"outbound":[],"path":"/mcp","serverEnabled":true,"tokenSet":true},
  "runtime": {"...": "the same block as /api/status"}
}
```

Con server MCP in uscita configurati, `outbound` elenca ciascuno:

```json
{"name":"plant-a","target":"http://localhost:8080/mcp","connected":true,"tools":["ack_alarm","call_service","...","write_tag"],"connectedSince":"2026-09-27T20:45:50Z"}
```

Qualsiasi credenziale nel `target` o nel `lastError` di un server in uscita viene rimossa, perché un URL o una riga di comando può contenere un token e ogni ruolo può leggere questo. Il token MCP stesso è solo `tokenSet`.

## Dispositivi

Un dispositivo è una connessione su un protocollo. Ciò che va in `config` e `address` dipende dal protocollo: vedere [Protocolli e driver](/it/iot/protocols/).

### `GET /api/devices`

Tutti i dispositivi, con il loro stato di connessione in tempo reale. Le credenziali sono `[redacted]`. `?q=` mantiene i dispositivi il cui id, nome, indirizzo o protocollo contiene il testo (senza distinguere le maiuscole), `?limit=` (da 1 a 5000, qualsiasi altro valore dà `400`) i primi tra loro; con l'uno o l'altro, `X-Total-Count` dice quanti corrispondono.

```json
[{"id":"tank-farm","name":"Tank farm","protocol":"mqtt","address":"base-mqtt:1883","enabled":true,
  "site":"Demo Plant","area":"Utilities","equipmentId":4,
  "config":{"clientId":"docs-api-tankfarm","password":"[redacted]","topics":["docs-api-example/#"],"username":"tank","writeTopic":"docs-api-example/{tag}/set"},
  "createdAt":"2026-09-27T20:21:01.637319Z","updatedAt":"2026-09-27T20:21:01.637319Z",
  "state":"connected","lastPoll":"2026-09-27T20:21:39.412Z",
  "latencyMs":0.002,"tagCount":3,"pollCount":1}]
```

`state` è `connected`, `connecting`, `degraded` (attivo, ma con interrogazioni che falliscono), `disconnected` o `disabled`. `lastError`, `errorCount` e il resto compaiono quando c'è qualcosa da dire.

### `POST /api/devices`

Crea il dispositivo se l'`id` è nuovo, lo sostituisce altrimenti. Non esiste `PUT`.

| Campo | Tipo | <span class="sr-only">Dettagli</span> |
|---|---|---|
| `id` | string | Obbligatorio. Da 1 a 64 lettere, cifre, `.`, `_`, `-`, che inizia con un carattere alfanumerico. Finisce in URL, topic MQTT e argomenti MCP |
| `name` | string | Obbligatorio |
| `protocol` | string | Obbligatorio. Uno di cui questa build ha il driver (`GET /api/protocols`) |
| `address` | string | Obbligatorio. Host e porta, oppure un URL `opc.tcp://` o `http://`: decide il protocollo |
| `enabled` | bool | Se omesso, è `false` |
| `description` | string | |
| `pollIntervalMs`, `timeoutMs` | int | 0 prende il valore predefinito del runtime. L'intervallo di interrogazione ha come minimo `HOTLOOP_MIN_POLL_INTERVAL` |
| `site`, `area`, `line` | string | Colloca il dispositivo nell'albero delle apparecchiature per nome, creando i nodi se serve |
| `equipmentId` | int | Lo colloca invece su un nodo dell'albero; `site`, `area` e `line` vengono allora dal nodo. Vedere [l'albero delle apparecchiature e le etichette](/it/iot/equipment/) |
| `config` | object | Le opzioni proprie del protocollo. Le credenziali seguono le [regole di sola scrittura](#i-segreti-sono-solo-in-scrittura) |

I campi del runtime (`state`, `lastPoll`, `tagCount` e così via) sono di sola lettura; se li rimandate, vengono ignorati. Risponde con il dispositivo salvato, oscurato. `400` per un protocollo senza driver, una validazione fallita o una regola sulle credenziali; il runtime si ricarica subito con esso.

```json
{"error":"no driver for protocol \"profibus\"; this build speaks: ethernet-ip, http, modbus, mqtt, mtconnect, opcua, s7comm, snmp, unifi"}
```

### `GET /api/devices/{id}`

Il dispositivo, i suoi tag e le sue etichette.

```json
{"device":{"id":"tank-farm","name":"Tank farm","...":"..."},"labels":["critical"],"tags":[{"id":3,"deviceId":"tank-farm","name":"level","...":"..."}]}
```

`tags` è `[]` per un dispositivo che non ne ha. `404` per un id sconosciuto.

### `DELETE /api/devices/{id}`

Elimina il dispositivo, i suoi tag e le loro entità. **Il suo storico viene conservato.** `{"deleted":"tank-farm"}`, oppure `404`.

### `POST /api/devices/{id}/enabled`

`{"enabled": false}` ferma l'interrogazione senza cancellare nulla. Risponde `{"enabled":false,"id":"tank-farm"}`. `404` per un id sconosciuto.

### `POST /api/devices/{id}/browse`

Chiede al dispositivo quali punti ha. Richiede solo `devices.read`, perché legge. Nessun corpo.

```json
{"supported":true,"tags":[{"name":"Plant_Boiler_Temperature","address":"nsu=http://plant/;s=Temperature","dataType":"float","description":"Temperature","writable":true}]}
```

Un protocollo che non sa elencare i suoi punti (Modbus, S7comm, HTTP) risponde `200` con `{"supported":false,"reason":"..."}`: è un fatto sul protocollo, non un errore. `503` se il dispositivo non è connesso. `writable` qui è ciò che il dispositivo dice del punto, non se il Gateway lo scriverà.

### `POST /api/devices/{id}/import`

Trasforma i risultati dell'esplorazione in tag configurati. Richiede `tags.write`, perché crea tag.

```json
{"tags":[{"name":"Temperature","address":"nsu=http://emberburn/;s=Temperature","dataType":"float","unit":"C"}]}
```

Ogni voce accetta `name`, `address`, `dataType`, `unit`, `description`, `deviceClass` e `writable` (il risultato dell'esplorazione così come è arrivato). Risponde `{"inserted":2,"updated":0}`. **Ogni tag importato è di sola lettura**, qualunque cosa dica il dispositivo: un punto scoperto non è un punto di cui qualcuno ha deciso che si può comandare, e fare il contrario per impostazione predefinita ne armerebbe qualche migliaio in un colpo solo. Armate quelli che intendete con `POST /api/tags`. `404` per un dispositivo sconosciuto.

## UniFi: reti OT, client e dove si trova un dispositivo nella rete

Il registro proprio di HotLoop sui siti UniFi. Vedere [UniFi Network](/it/iot/unifi/). `{id}` sotto `/api/unifi` è un dispositivo UniFi (un sito su una console); `{network}` è l'ID che la console stessa dà a una rete, come lo fornisce `GET .../networks`; `{mac}` accetta qualsiasi grafia usuale e viene conservato in minuscolo con i due punti.

**Nessuna di queste chiede qualcosa alla console.** Leggono l'ultima lettura che il driver ne ha fatto, quindi una schermata lasciata aperta non costa nulla alla console. Ciò significa anche che rispondono `503` finché il dispositivo non è stato letto una volta, e sempre in un helper `--mcp-stdio`, che non accede mai a una console. E nessuna scrive su una console.

Una modifica che crea o rimuove un allarme lo dice in `change`: `{"alarmsCreated":["unifi-unknown-3f2a9c01b7de"]}`. Sono normali definizioni di allarme, sotto `/api/alarms`.

### `GET /api/devices/{id}/network`

Dove si trova nella rete un dispositivo HotLoop (un PLC, un contatore). Collegato:

```json
{"deviceId":"plc-07","link":{"deviceId":"plc-07","consoleId":"plant-net","mac":"02:48:4c:00:00:07","confirmedBy":"hana","confirmedAt":"2026-09-28T18:02:05Z"},
 "consoleName":"Plant network","client":{"mac":"02:48:4c:00:00:07","ip":"10.77.0.7","switchMac":"00:27:22:e2:1d:6f","switchName":"USW Lite 8 PoE","port":5,"portUp":false,"online":false,"lastSeen":"2026-09-28T18:01:40Z","lastSeenSec":25,"why":"its switch port 5 has no link","...":"..."},
 "readAt":"2026-09-28T18:02:05Z","summary":"on USW Lite 8 PoE port 5, link down; the console last saw it 25s ago; off the network: its switch port 5 has no link","proposals":[]}
```

Se non è collegato, `link` è `null` e `proposals` elenca i client che qualsiasi console letta da HotLoop ha all'IP del dispositivo, dal più recente. Una proposta è solo questo: gli IP della console sono in ritardo, quindi nulla viene collegato finché un amministratore non ne conferma una.

### `PUT /api/devices/{id}/network`

`{"consoleId":"plant-net","mac":"02:48:4c:00:00:07"}` conferma quale client è il dispositivo. Da lì in poi la chiave è il MAC e l'IP non è più considerato attendibile. Il client riceve dei tag (`c.<mac>.*` sulla console) e un allarme, «PLC-07 fuori dalla rete», di priorità 1 con un ritardo di attivazione di 120 s così che un riavvio non avvisi nessuno. Risponde `{"link":{...},"change":{...}}`. `400` se `consoleId` non è un dispositivo UniFi o il MAC non è un MAC, `404` per un dispositivo sconosciuto.

### `DELETE /api/devices/{id}/network`

Rimuove il collegamento, e l'allarme che HotLoop ha creato per esso a meno che il client sia ancora sorvegliato da un elenco di noti. `404` se non c'era alcun collegamento.

### `GET /api/unifi/{id}/networks`

Le reti del sito come le ha la console, con il registro di HotLoop: `ot`, `known` (quanti dispositivi ci sono nel suo elenco), `clients` (presenti ora) e `unknown` (presenti ora e non nell'elenco). Una rete di cui HotLoop ha un record e che la console non ha più torna con `"onConsole":false`.

```json
[{"networkId":"6abb23d25a95f2636a5df29c","name":"SCADA","purpose":"corporate","vlan":122,"subnet":"10.122.0.1/24","onConsole":true,"ot":true,"clients":2,"known":1,"unknown":[{"mac":"02:9b:b1:69:88:f2","ip":"10.122.0.66","switchName":"USW Lite 8 PoE","port":6,"...":"..."}],"changedBy":"hana"}]
```

### `PUT /api/unifi/{id}/networks/{network}`

`{"ot": true}` segna una rete come OT. Tutto ciò che c'è su di essa e non è nel suo elenco di noti conta in `n.<network>.unknown` e si nomina in `.unknown_last`, e HotLoop crea l'allarme «Dispositivo sconosciuto su SCADA», di priorità 1. `{"ot": false}` la deseleziona e rimuove quell'allarme; l'elenco dei noti viene conservato. `400` per una WAN o una rete che la console non ha.

### `POST /api/unifi/{id}/networks/{network}/accept-all`

Accetta tutto ciò che c'è ora sulla rete, così com'è: l'unico clic dopo averla segnata. I dispositivi già nell'elenco mantengono il loro nome e la loro sorveglianza. Nessun corpo. Risponde `{"accepted":[{known device}...]}`, quelli che ha aggiunto.

### `GET /api/unifi/{id}/known`

Ogni dispositivo noto sulle reti del sito: `[{"deviceId":"plant-net","networkId":"...","mac":"...","name":"PLC-07","watch":true,"acceptedBy":"hana","acceptedAt":"..."}]`.

### `PUT /api/unifi/{id}/networks/{network}/known/{mac}`

`{"name":"PLC-07","watch":true}` accetta un dispositivo nella rete, o ne cambia il nome o la sorveglianza. `watch` gli dà dei tag e l'allarme di disconnessione; un dispositivo ammesso ma che va e viene (un portatile di manutenzione) viene accettato senza. `400` se la rete non è mai stata segnata come OT.

### `DELETE /api/unifi/{id}/networks/{network}/known/{mac}`

Toglie un dispositivo dall'elenco. Se è sulla rete, torna sconosciuto alla lettura successiva.

### `GET /api/unifi/{id}/clients`

Ogni client che la console elenca, più ogni client sorvegliato che non elenca, ciascuno con dove si trova, se è online, e `ot`, `known`, `watched`, `linkedTo` e un `summary` di una riga. `?q=` lo restringe a un MAC, IP o nome.

### `GET /api/unifi/consoles`

Ogni dispositivo UniFi che HotLoop ha, in funzione o meno, per il selettore della schermata UniFi: `[{"id":"plant-net","name":"Plant network","address":"https://...","enabled":true,"running":true,"site":"default","version":"10.6.106","readAt":"...","devices":4,"online":4,"clients":12,"failover":false,"eventsLive":true}]`. Una console che questo processo non ha letto dice perché in `why`.

### `GET /api/unifi/{id}/overview`

La scheda panoramica: conteggi di dispositivi e client (un client conta quando HotLoop crede che sia nella rete, il test che usano i tag `n.<id>.clients`, e non semplicemente quando la console lo elenca), client per rete, lo `health` dei sottosistemi della console e, per ogni gateway, la sua fascia WAN, `gateways[]`: una voce `wans[]` per ogni WAN con `alive` (i controlli di salute del gateway stesso, mai l'`up` del blocco WAN), `known`, `active`, `backup`, latenza e disponibilità. `failover` è traffico su una WAN che non è la prima, `down` è nessuna WAN viva, e `since` è la prima lettura in cui HotLoop ha visto traffico sulla WAN su cui si trova ora, ossia quando HotLoop se n'è accorto, non quando il gateway è passato. `events` è lo stato del websocket degli eventi (`live`, `error`, `reconnects`) e i dieci eventi più recenti.

### `GET /api/unifi/{id}/topology`

La mappa. `nodes[]` sono i dispositivi adottati con il loro posto sulla griglia (`x`, `y`, `layer`: da sinistra a destra a partire dal gateway, disposti allo stesso modo per la stessa lettura), `edges[]` i cavi tra loro dalla `downlink_table` della console stessa, `wired[]` e `wifi[]` i client appesi a ogni porta di switch e a ogni AP e SSID. Un dispositivo che nulla elenca come collegato a qualcosa viene disegnato da solo con `noUplink` impostato, non appeso al gateway a intuito. Un dispositivo di un'altra console UniFi che HotLoop legge e che questa console elenca come client viene cucito come nodo con `external` impostato e un arco con `stitched`. `feeds` è, per MAC del dispositivo, i dispositivi HotLoop collegati a un client a valle di esso, con il loro `equipmentId` per l'albero dello stabilimento, e `links` quegli stessi dispositivi per MAC del client.

### `GET /api/unifi/{id}/devices`

Ogni dispositivo adottato con i suoi numeri e il suo `ports[]` per il pannello frontale: link, velocità, modalità e assorbimento PoE, i client appresi sulla porta, il dispositivo collegato, e `dropped` per una porta che era attiva a una lettura precedente e ora è caduta. Un dispositivo che la console ha perso non riporta numeri né link di porta, perché ciò che ha detto per ultimo non è attuale.

### `GET /api/unifi/{id}/wifi`

Gli SSID del sito con `enabled`, la rete su cui stanno e quanti client ci sono su ciascuno. Quando la console non mostra a questo account le sue reti wireless, `error` dice perché e `wlans` è vuoto.

### `GET /api/unifi/{id}/events`

Gli eventi più recenti che la console ha riportato da quando HotLoop si è connesso, dal più recente (`?limit=` fino a 200, 50 per impostazione predefinita), e lo stato del websocket degli eventi. Ogni evento ha la `key` del controller (`EVT_SW_Lost_Contact`), il proprio `message`, `severity` (`warning` quando il controller lo segnala come qualcosa che va storto) e il dispositivo, il client e la porta di cui parla. Sono anche nel registro, archiviati sotto lo switch o l'access point di cui parlano (vedere [UniFi Network](/it/iot/unifi/#eventi)).

### `POST /api/unifi/{id}/starter-alarms`

Crea gli allarmi consueti per il sito da ciò che la console ha ora, come normali definizioni di allarme sotto `/api/alarms`: ogni dispositivo adottato offline (priorità 2, ritardo di attivazione di 60 s), ogni porta di uplink caduta (priorità 1, 10 s), un gateway con due o più WAN che funziona su una di riserva (priorità 2, 30 s). Il corpo è facoltativo. `{"poeLimitW": 25}` aggiunge un allarme di priorità 3 sull'assorbimento `poe_w` di ogni porta PoE oltre quel numero di watt, con ritardo di 30 s; la console non dice qual è il budget di una porta, quindi HotLoop non ne indovina uno. Un limite negativo dà `400`.

```json
{"created":[{"id":"unifi-devoffline-9c1e2a77b3d0","name":"USW Lite 8 PoE offline","kind":"offline","tag":"d.002722e2e633.online","priority":2}],
 "kept":[]}
```

`kept` sono gli allarmi che l'insieme richiede e che c'erano già: i suoi di una pressione precedente, o l'allarme di qualcuno sullo stesso tag. Quindi si può premere di nuovo senza rischi dopo aver adottato altri apparecchi, e aggiunge solo i nuovi apparecchi. Gli allarmi di rete OT e di fuori dalla rete non ne fanno parte; arrivano con il segnare una rete come OT e il sorvegliare un dispositivo. `503` finché la console non è stata letta una volta.

## Rilevamento MQTT

Dispositivi che si sono annunciati via MQTT, e ciò che una persona ha deciso per ciascuno. Vedere [Rilevamento MQTT](/it/iot/mqtt-discovery/). Il rilevamento ascolta sul broker integrato quando è in funzione, e su ogni broker configurato sotto `/api/mqtt/brokers`. Senza nessuno dei due, `sources` è vuoto. In un helper `--mcp-stdio`, che non ascolta mai, `GET /api/discovery` risponde `{"running":false,"sources":[],"devices":[]}` e ogni altra route `503`.

`{source}` è il broker su cui un dispositivo si è annunciato (`embedded` per quello di HotLoop, altrimenti l'id del broker); `{key}` è ciò che ha legato i suoi annunci: il suo primo identificatore, il suo MAC come `mac:aa:bb:cc:dd:ee:ff`, o il suo id di nodo. Codificatelo come URL; gli identificatori contengono caratteri che un percorso non ammette.

**Nessuna di queste arma nulla.** Accettare un dispositivo rende armabili i suoi punti, uno alla volta, con `POST /api/tags` come ogni altro punto.

### `GET /api/discovery`

Ogni sorgente, con ciò che ha visto e rifiutato, e ogni dispositivo rilevato:

```json
{"running":true,"sources":[{"id":"embedded","name":"the embedded broker","prefix":"homeassistant","listening":true,"connected":true,
  "received":42,"dropped":0,"refused":0,"problems":[],"autoCreate":true,"anonymousAllowed":false,
  "external":false,"listenOnly":false,"enabled":true}],
 "devices":[{"source":"embedded","deviceKey":"plug-0001","deviceId":"kitchen-plug","status":"discovered",
  "device":{"identifiers":["plug-0001"],"name":"Kitchen Plug","manufacturer":"Acme","model":"P1","swVersion":"1.0.0"},
  "origin":{"name":"test-publisher","swVersion":"0.1"},"firstSeen":"2026-10-02T09:12:04Z","lastSeen":"2026-10-02T09:12:04Z",
  "components":[{"key":"plug-0001-relay","component":"switch","name":"Relay","configTopic":"homeassistant/switch/plug-0001/relay/config",
   "stateTopic":"plug/relay","commandTopic":"plug/relay/set","commandTopics":["plug/relay/set"],"tag":"relay",
   "unsupported":[],"unknownKeys":[],"flags":[]}]}]}
```

Una sorgente con `external` true è un broker configurato sotto `/api/mqtt/brokers`, e `broker` dice dove si trova. `autoCreate` false è una sorgente i cui dispositivi aspettano nella posta in arrivo: elencati `discovered` senza `deviceId`, non viene creato né letto nulla finché qualcuno non ne accetta uno. `listenOnly` è un broker su cui HotLoop non pubblica mai. `lastError` dice perché una sorgente non è connessa, compresa una password che non si riesce ad aprire.

`status` è `discovered`, `accepted` o `ignored`. Per componente, `unsupported` elenca ciò che HotLoop non può usare e perché («value template not supported: filter `regex_findall_index` is not supported at column 12»), `unknownKeys` le chiavi di configurazione che il formato non definisce, `commandTopics` ogni topic a cui possono andare i suoi comandi (il topic della velocità di un ventilatore oltre a quello principale), e `flags` ciò che una persona dovrebbe guardare prima di accettare: un topic di comando fuori dai topic che il componente legge, dentro il prefisso di rilevamento o rivendicato da un altro dispositivo, e una configurazione che chiede comandi trattenuti. `withdrawnAt` è impostato su un componente che l'editore ha ritirato. `suggestedEquipmentId` è il nodo dell'albero che il `suggested_area` del dispositivo nomina, quando esattamente un nodo ha quel nome; precompila soltanto la finestra di accettazione. Sul broker integrato, `announcedBy` e `announcedVia` sono il login del broker e l'id client che hanno pubblicato la sua ultima configurazione, e `acceptedLogin` il login da cui è stato accettato. Un dispositivo accettato il cui annuncio è cambiato, o che un login diverso ha annunciato, ha `review`:

```json
{"hash":"9a1c...","summary":["plug-0001-power: unit changed"],
 "changes":[{"key":"plug-0001-power","kind":"changed","fields":[{"field":"unit","running":"W","announced":"kW"}]}]}
```

### `GET /api/discovery/{source}/{key}`

Un dispositivo, con la stessa forma. `404` per uno che HotLoop non ha visto.

### `POST /api/discovery/{source}/{key}/accept`

Accetta un dispositivo. Un corpo facoltativo `{"equipmentId": 12}` lo colloca nell'albero nello stesso passaggio. Non arma nulla. Risponde con il dispositivo. `400` per uno ignorato.

### `POST /api/discovery/{source}/{key}/ignore`

Scarta il dispositivo: il suo dispositivo HotLoop, i tag e le entità se ne vanno (lo storico resta), e resta ignorato quando si annuncia di nuovo. Risponde con il dispositivo. `DELETE /api/devices/{id}` su un dispositivo rilevato fa lo stesso, perché un dispositivo che continua ad annunciarsi tornerebbe e basta.

### `POST /api/discovery/{source}/{key}/unignore`

Riporta un dispositivo ignorato a rilevato, da ciò che ha annunciato per ultimo. `400` se non è ignorato.

### `POST /api/discovery/{source}/{key}/review/apply`

Fa eseguire a un dispositivo accettato ciò che ha annunciato. Se ogni punto è armato o no resta com'era. `400` quando nulla è in attesa di revisione.

### `POST /api/discovery/{source}/{key}/review/reject`

Mantiene in funzione la configurazione accettata e smette di proporre questa modifica. Una modifica diversa in seguito viene riproposta. `400` quando nulla è in attesa.

Una revisione può riguardare chi l'ha annunciato: una modifica con `"kind":"publisher"` e la riga di riepilogo «announced by login garage-node; accepted from kitchen-node». Applicarla fa di quel login quello da cui il dispositivo è accettato.

## Login del broker

I login del broker integrato creati in HotLoop, ciascuno con i topic su cui può pubblicare e a cui può iscriversi. Vedere [il broker MQTT integrato](/it/iot/broker/). Un login è una chiave del broker di tutto lo stabilimento, quindi questi sono `users.manage`, di un amministratore. Qui nulla risponde mai con una password o il suo hash. Ogni modifica finisce nel registro e vale dalla successiva pubblicazione del client; nessuno deve riconnettersi.

### `GET /api/broker/logins`

```json
{"running":true,"anonymous":false,"prefix":"homeassistant","envLogins":["plant"],
 "profiles":[{"name":"shelly","about":"a Shelly Gen2 or later; name the login after its MQTT topic prefix",
   "publish":["%u/#","shellies/announce"],"subscribe":["%u/#","shellies/command","%p/status"]}],
 "logins":[{"name":"kitchen-node","profile":"esphome","publish":["%u/#","%p/+/%u/+/config","esphome/discover/%u"],
   "subscribe":["%u/#","%p/status","esphome/discover"],"createdBy":"admin","createdAt":"2026-10-02T09:12:04Z",
   "updatedAt":"2026-10-02T09:12:04Z","resolvedPublish":["kitchen-node/#","homeassistant/+/kitchen-node/+/config",
   "esphome/discover/kitchen-node"],"resolvedSubscribe":["kitchen-node/#","homeassistant/status","esphome/discover"]}]}
```

`running` è false dove questo processo non esegue il broker; i login vengono comunque conservati, e il broker li legge all'avvio. `envLogins` sono i nomi da `HOTLOOP_BROKER_USERS`, che possono fare tutto. `%u` in una regola è il nome del login stesso e `%p` il prefisso di rilevamento; `resolved*` sono le regole con entrambi compilati.

### `POST /api/broker/logins`

```json
{"name":"kitchen-node","password":"a-long-random-password","profile":"esphome"}
```

`name` è da 1 a 64 lettere, cifre, `-` e `_` (sta per `%u` nei topic). `password` è di almeno 12 caratteri. `profile` compila le regole; `publish` e `subscribe`, se indicati, le sostituiscono. Serve uno dei due. Una regola è un filtro di topic MQTT: `+` e `#` solo come livelli interi, `#` solo per ultimo, mai un topic `$`. `201` con il login; `400` per uno qualsiasi dei casi sopra o per un nome che `HOTLOOP_BROKER_USERS` ha già; `409` per un nome già preso.

### `PUT /api/broker/logins/{name}`

Uno qualsiasi tra `profile`, `publish`, `subscribe` e `password`; ciò che non viene inviato resta. `200` con il login, `404` per uno che non esiste.

### `DELETE /api/broker/logins/{name}`

`200` `{"deleted":"kitchen-node"}`. Un client ancora connesso con esso non può fare più nulla da quel momento, e non può riconnettersi. `404` per uno che non esiste.

## Rilevamento di rete

Dispositivi uditi sulla rete dello stabilimento tramite mDNS, SSDP e DHCP, e ciò che una persona ha deciso per ciascuno. Vedere [Rilevamento di rete](/it/iot/network-discovery/). In un helper `--mcp-stdio`, che non ascolta mai, `GET /api/network-discovery` risponde `{"running":false,"finds":[]}` e ogni altra route `503`.

`{key}` è come è stato udito un ritrovamento e da chi: `mdns:` e il suo nome host mDNS, `ssdp:` e il suo uuid UPnP, `dhcp:` e il suo MAC. Codificatelo come URL.

**Nessuna di queste arma nulla**, e nulla qui viene aggiunto finché qualcuno non lo accetta.

### `GET /api/network-discovery`

I listener, la sonda, le interfacce su cui si trovano e ogni ritrovamento:

```json
{"running":true,
 "status":{"leading":true,"interfaces":["eth0 10.20.0.15/24"],
  "listeners":[{"name":"mdns","enabled":true,"listening":true,"heard":120,"dropped":0,"refused":0},
   {"name":"ssdp","enabled":true,"listening":true,"heard":14,"dropped":0,"refused":0},
   {"name":"dhcp","enabled":false,"listening":false,"heard":0,"dropped":0,"refused":0}],
  "probe":{"networks":[]}},
 "finds":[{"key":"mdns:line3-ua.local","via":"mdns","kind":"opcua","name":"line3-ua","status":"discovered",
  "firstSeen":"2026-10-11T14:02:11Z","lastSeen":"2026-10-11T14:07:40Z",
  "find":{"key":"mdns:line3-ua.local","via":"mdns","kind":"opcua","name":"line3-ua",
   "summary":"OPC UA server, capabilities DA","host":"line3-ua.local","addresses":["10.20.0.31"],
   "services":[{"type":"_opcua-tcp._tcp.local","instance":"line3-ua._opcua-tcp._tcp.local","port":50000,
    "txt":{"caps":"DA","path":"/"}}],
   "proposal":{"protocol":"opcua","address":"opc.tcp://10.20.0.31:50000/","how":"Accepting makes an OPC UA device..."},
   "heard":"2026-10-11T14:07:40Z"}}]}
```

`kind` è `esphome`, `shelly`, `opcua`, `mqtt-broker`, `web`, `mdns` (ha annunciato qualcosa per cui HotLoop non ha una parola), `upnp` o `dhcp`. Un ritrovamento la cui `proposal` ha un `protocol` diventa, una volta accettato, un dispositivo di quel protocollo a `address`; uno che non lo ha dice in `how` che cosa lo farebbe entrare. `also` elenca gli altri ritrovamenti e dispositivi rilevati via MQTT che sono la stessa macchina, per MAC o indirizzo. `status` è `discovered`, `accepted` o `ignored`, e `deviceId` il dispositivo creato dall'accettazione. L'`error` di un listener dice perché non ascolta (porta 67 occupata o non consentita, nessuna interfaccia multicast); `refused` conta i nuovi ritrovamenti scartati perché il registro è pieno.

### `GET /api/network-discovery/{key}`

Un ritrovamento, con la stessa forma. `404` per uno che HotLoop non ha udito.

### `POST /api/network-discovery/{key}/accept`

Accetta un ritrovamento. Un corpo facoltativo `{"equipmentId": 12}` colloca nell'albero il dispositivo che crea. Un ritrovamento per cui HotLoop ha un driver diventa un dispositivo all'indirizzo proposto, abilitato, senza tag e senza nulla di armato; ogni altro viene registrato come noto e non crea nulla. Risponde con il ritrovamento. `400` per uno già accettato o ignorato.

### `POST /api/network-discovery/{key}/ignore`

Nasconde un ritrovamento su cui nessuno ha deciso, e lo tiene nascosto quando viene udito di nuovo. `400` per uno già deciso.

### `POST /api/network-discovery/{key}/unignore`

Riporta un ritrovamento ignorato in attesa di decisione. `400` se non è ignorato.

### `POST /api/network-discovery/probe`

Sonda ora: una query mDNS e una ricerca SSDP su ogni interfaccia la cui rete è elencata in `HOTLOOP_NETDISC_PROBE_NETWORKS`, e da nessun'altra parte. Risponde `{"status": ...}`, con ciò che non è partito in `status.probe.lastError`. `400` quando nessuna rete ha la sonda attivata: questo pulsante non può attivarla, solo l'installazione.

## Integrazioni

Il flusso di configurazione per un tipo di dispositivo a cui una persona punta HotLoop: chiedere di che cosa ha bisogno l'integrazione, guardare il dispositivo reale con le risposte e creare il dispositivo e i suoi tag da ciò che è stato trovato. Vedere [Integrazioni](/it/iot/integrations/).

**Nulla qui arma nulla.** Ogni tag creato da una configurazione è di sola lettura. Armarlo è `POST /api/tags` come ogni altro punto.

### `GET /api/integrations`

Ogni integrazione che questa build ha, con le domande che pone:

```json
[{"id":"opcua","name":"OPC UA server","description":"A PLC, CNC, gateway or SCADA server ...",
  "protocol":"opcua","addressLabel":"Endpoint","addressPlaceholder":"opc.tcp://192.168.1.20:4840","writable":true,
  "fields":[{"key":"securityMode","label":"Security","kind":"choice","required":false,"default":"None",
             "choices":[{"value":"None","label":"None"},{"value":"Sign","label":"Sign"}]},
            {"key":"password","label":"Password","kind":"secret","required":false}]}]
```

`kind` è `text`, `number`, `bool`, `choice` o `secret`. Un campo con `showWhen` (`{"version":["3"]}`) viene chiesto solo quando un'altra risposta ha uno di quei valori, e la risposta a una domanda che non viene mostrata viene ignorata.

### `POST /api/integrations/{id}/probe`

Controlla le risposte e va a guardare il dispositivo reale. Non salva nulla.

```json
{"address":"opc.tcp://192.168.1.20:4840","options":{"securityMode":"None"}}
```

Risponde `{"integration":"opcua","address":"opc.tcp://192.168.1.20:4840","found":{...}}`. `address` è l'indirizzo come l'integrazione lo ha risolto. `found` ha `name` (come il dispositivo chiama se stesso), `identity` (che cosa dice di essere), `notes` (cose da sapere prima di accettare) e `points`, ciascuno con la forma di un tag `{name, address, dataType, unit, description, writable, deviceClass}` più `group`, `sample` (ciò che ha letto quando è stato trovato) e `suggested`.

`400` per risposte che non si adattano alle domande, tutti i problemi insieme; anche una risposta a una domanda che l'integrazione non pone è un `400`, non viene ignorata. `502` quando il dispositivo non ha risposto o ha risposto con qualcosa che non è il suo protocollo, con ciò che è andato storto. `404` per un'integrazione che questa build non ha. Un segreto non compare mai in una risposta né in un errore.

### `POST /api/integrations/{id}/setup`

Guarda di nuovo il dispositivo, poi lo crea insieme ai suoi tag. Il corpo è quello della sonda, più:

| Campo | Significato |
|---|---|
| `deviceId` | L'id del nuovo dispositivo. Se vuoto, lo prende dal nome. `400` se un dispositivo lo ha già |
| `name` | Il nome del dispositivo. Se vuoto, prende come il dispositivo chiama se stesso |
| `points` | Nomi da `found.points` da configurare. Se vuoto, prende quelli segnati `suggested`. Un nome che il dispositivo non ha è un `400` |
| `site`, `area`, `line` | Dove va nell'albero delle apparecchiature, come su `POST /api/devices` |

I punti vengono controllati rispetto al dispositivo com'è adesso, non rispetto a ciò che un client dice di aver trovato un minuto fa. Risponde `{"device":{...},"tags":3,"entities":["sensor.plc_sim_..."],"notes":[]}`. Il dispositivo è abilitato e in interrogazione, ogni tag è di sola lettura, e ogni tag ha la sua entità di lettura. Una configurazione che fallisce a metà non lascia alcun dispositivo.

## Broker MQTT

Broker diversi da quello di HotLoop che il rilevamento ascolta: il Mosquitto di uno stabilimento, il broker che una macchina Zigbee2MQTT ha portato con sé. Vedere [Rilevamento MQTT](/it/iot/mqtt-discovery/#other-brokers). Le loro password sono sigillate con la chiave delle credenziali dei dispositivi (`HOTLOOP_SECRET_KEY_FILE`) e non vengono mai restituite; `passwordSet` dice se ne è memorizzata una, e `passwordProblem` perché una memorizzata non si riesce ad aprire. Ogni modifica finisce nel registro e ha effetto subito: il listener e i dispositivi di quel broker si riconnettono.

### `GET /api/mqtt/brokers`

```json
{"secretKey":true,
 "brokers":[{"id":"plant-uns","name":"Plant UNS","broker":"tcp://10.20.0.5:1883","username":"hotloop","useTls":false,
   "insecureSkipVerify":false,"prefix":"homeassistant","listenOnly":true,"autoCreate":false,"tasmota":true,"shelly":true,"enabled":true,
   "createdBy":"admin","passwordSet":true,"createdAt":"2026-10-03T09:12:04Z","updatedAt":"2026-10-03T09:12:04Z"}]}
```

`secretKey` indica se questo HotLoop ha una chiave con cui sigillare una password.

### `POST /api/mqtt/brokers`

```json
{"id":"plant-uns","name":"Plant UNS","broker":"tcp://10.20.0.5:1883","username":"hotloop",
 "password":"...","listenOnly":true}
```

`id` è da 1 a 63 lettere minuscole, cifre e `-`, non `embedded`: dà il nome al broker in ogni dispositivo che ne proviene, e non può cambiare. `broker` è `host:port` o un URL `tcp://`, `ssl://`, `tls://`, `mqtt://` o `mqtts://`, senza login. `prefix` è `homeassistant` per impostazione predefinita; `autoCreate` false (i dispositivi aspettano nella posta in arrivo); `listenOnly` false; `tasmota` (ascoltare anche il rilevamento proprio di Tasmota, `tasmota/discovery/#`) true; `shelly` (imparare i dispositivi Shelly Gen2 e successivi dai topic `<prefix>/status/<component>` che pubblicano) true; `enabled` true. Una password richiede un nome utente e una chiave: senza `HOTLOOP_SECRET_KEY_FILE` è un `400`, mai memorizzata in chiaro. `201` con il broker; `409` per un id già preso.

### `PUT /api/mqtt/brokers/{id}`

Uno qualsiasi dei campi sopra tranne `id`; ciò che non viene inviato resta. `"password":""` cancella la password. `200` con il broker.

### `DELETE /api/mqtt/brokers/{id}`

Rimuove il broker e ciò che ha annunciato e nessuno ha accettato: la posta in arrivo, e ogni dispositivo che ha creato da solo. `409` che li nomina finché esistono dispositivi accettati da esso: ignorateli o eliminateli prima, oppure spegnete il broker con `"enabled":false`. `200` `{"deleted":"plant-uns"}`.

## Tag

### `GET /api/tags`

| Query | <span class="sr-only">Dettagli</span> |
|---|---|
| `device` | Solo i tag di questo dispositivo. Senza `limit` risponde con tutti |
| `q` | Ricerca: una sottostringa, senza distinguere le maiuscole, dell'id del dispositivo, del nome del tag o della descrizione. Funziona con `device` |
| `limit` | Un numero intero da 1 a 5000. Predefinito 500 senza `device`. Qualsiasi altro valore, 5001 compreso, è `400`: viene rifiutato, mai risposto con meno (fino alla 4.19.5 qualsiasi limite sopra 1000 veniva trasformato in silenzio in 200) |
| `writable` | `true` per i soli tag marcati come scrivibili (ciò che offrono i selettori di scrittura) |
| `offset` | Dove inizia la pagina, zero o più. I tag sono ordinati per dispositivo, poi per nome |

L'header `X-Total-Count` della risposta dice quanti tag corrispondono in tutto, quindi un client pagina con `offset` finché non li ha e sa di averli. Una risposta vuota è `[]`.

```json
[{"id":5,"deviceId":"tank-farm","name":"level_sp","address":"mqtt:docs-api-example/level_sp","dataType":"float","unit":"%","enabled":true,"writable":true,"maxValue":95,"hasRange":true,"scale":1,"createdAt":"2026-09-27T20:21:39.405164Z","updatedAt":"2026-09-27T20:21:39.405164Z"}]
```

### `POST /api/tags`

Crea il tag se `deviceId` e `name` sono nuovi, lo sostituisce altrimenti.

| Campo | Tipo | <span class="sr-only">Dettagli</span> |
|---|---|---|
| `deviceId` | string | Obbligatorio. Il dispositivo deve esistere (`404` altrimenti) |
| `name` | string | Obbligatorio. Senza caratteri di controllo |
| `address` | string | Obbligatorio. L'indirizzo proprio del protocollo |
| `dataType` | string | `bool`, `int`, `float` o `string` (e i soliti alias: `int16`, `word`, `coil`...). Decide come viene codificata una scrittura |
| `unit`, `description` | string | |
| `enabled` | bool | Se omesso, è `false` |
| `writable` | bool | **Arma il tag per la scrittura, da ogni percorso: interfaccia, automazioni, entità, MCP.** Se omesso, è `false` |
| `hasRange`, `minValue`, `maxValue` | bool, number, number | Con `hasRange`, una scrittura fuori dall'intervallo viene rifiutata (mai limitata) |
| `scale`, `offset` | number | ingegneristico = grezzo x scala + offset. Una scala di 0 vale 1 |
| `noData` | list | Valori grezzi che significano «nessuna misura», ciascuno `{"raw", "reason"}`. `raw` è una stringa (`"0x8005"`, `"-32763"`) o un numero nudo, e torna come stringa. Una lettura il cui valore grezzo è nell'elenco ha qualità cattiva con quel `reason`, controllata prima di `scale` e `offset`. Fino a 32 codici. Un codice che non è un numero intero, è elencato due volte o non può essere del tipo del punto è `400`. Vedere [Protocolli e driver](/it/iot/protocols/#no-data-values) per che cosa scrivere per ogni tipo e l'esempio dello Yokogawa DX |
| `deadband`, `deadbandPercent` | number | Le variazioni più piccole di questo non vengono scritte nello storico |
| `deviceClass` | string | La classe con cui iniziano le entità del tag (`power`, `connectivity`, `temperature`...), quando significa qualcosa per il loro dominio. Presa alla creazione del tag e ignorata alla sostituzione: da lì in poi la classe è dell'entità, quindi cambiatela lì |

Risponde con il tag salvato. Salvarne uno con `writable: true` viene registrato come tale: armare un tag è una decisione di sicurezza e porta un nome accanto. Le entità del tag vengono create o aggiornate prima della risposta, quindi un client può chiederle subito.

Un tag di un dispositivo rilevato che nessuno ha accettato non si può armare: `400`, «accept the device first». Vedere [Rilevamento MQTT](/it/iot/mqtt-discovery/#commands).

### `DELETE /api/tags/{device}/{name}`

`{"deleted":"tank-farm/level"}`, oppure `404`. Lo storico resta. Le entità del tag diventano orfane (vedere [Entità](/it/iot/entities/#deleted-tags-orphans-and-re-adoption)).

## Valori, la lavagna e scritture

### `GET /api/values`

L'ultima lettura di ogni tag, dalla memoria. `?device=` la restringe a un dispositivo.

```json
[{"deviceId":"extruder-1","protocol":"opcua","tagName":"Temperature","tagValue":20.645294745260895,"unit":"C","quality":"good","timestamp":"2026-09-27T20:21:58.255722Z"}]
```

Questa forma è il `TagValue` della dashboard EmberNet ed è un contratto. `quality` è `good`, `uncertain` o `bad`; **una lettura cattiva significa che il valore non è noto, non che sia zero**. Una lettura di stringa porta `stringVal`, e il suo `tagValue` non significa nulla.

Una lettura che non è buona porta `reason` quando il driver sa perché, così una schermata può dire di più di «cattiva»:

```json
{"deviceId":"meter-01","protocol":"http","tagName":"power","tagValue":0,"quality":"bad","timestamp":"2026-09-30T09:12:04.51Z","reason":"no field at ENERGY.Power"}
```

Una lettura buona non lo ha mai, quindi il contratto sopra è byte per byte quello che era. L'historian non lo conserva: `/api/history` ha la qualità, non il motivo.

### `GET /api/sparkline`

Le ultime letture di un tag conservate in memoria (`HOTLOOP_RING_SIZE`, 30 per impostazione predefinita), per i piccoli grafici. `?tag=device/tag`, obbligatorio.

```json
{"tag":"extruder-1/Temperature","timestamps":[1790540498609,1790540499246,1790540500246],"values":[0,20.06524581530632,19.933308705395785]}
```

`timestamps` sono millisecondi Unix. Entrambi sono `[]` per un tag senza letture. `400` per una chiave malformata.

### `GET /api/board`

Quali tag sono fissati alla lavagna, e in quante colonne. È memorizzata nel database, non nel browser, perché una lavagna appartiene allo stabilimento: il PC del pannello in reparto e il portatile in ufficio mostrano la stessa.

```json
{"columns":2,"tags":["extruder-1/Temperature","tank-farm/level"],"rev":"9f2c41b07a6d3e58"}
```

`rev` nomina la lavagna come memorizzata. Rimandatelo con un salvataggio e il salvataggio viene rifiutato se la lavagna è cambiata nel frattempo (sotto).

### `PUT /api/board`

La stessa forma. `columns` fuori da 1 a 4 diventa 3; i duplicati vengono scartati. `rev` è facoltativo: con il `rev` della lavagna che avete letto, un salvataggio su una lavagna cambiata nel frattempo è un `409` e non cambia nulla, quindi una pagina che non ha mai letto la lavagna, o ne ha letta una vecchia, non può sostituire quella dello stabilimento con la sua copia. Se omesso, il salvataggio non viene controllato, cosa adatta a un client che imposta l'intera lavagna ogni volta. L'interfaccia web legge la lavagna all'avvio e invia il `rev` a ogni salvataggio. Ogni tag deve esistere (`404` che nomina quello che non esiste): una voce obsoleta è un indicatore che non si muove mai. Risponde con la lavagna come memorizzata. Gli operatori hanno `board.write`: sistemare la lavagna è far funzionare lo stabilimento, non configurarlo.

### `POST /api/write`

Scrive un valore su un tag, attraverso il gate di scrittura.

| Campo | Tipo | <span class="sr-only">Dettagli</span> |
|---|---|---|
| `tag` | string | Obbligatorio. `device/tag` |
| `value` | bool, number or string | Obbligatorio. `true` è un bool, `42` un intero, `42.5` un float, `"42"` una stringa: il tipo JSON è il tipo scritto, perché una bobina, una word e un reale sono tre cose diverse sul filo |
| `reason` | string | Facoltativo. Registrato con la scrittura |

```json
{"tag":"tank-farm/level_sp","written":"72.5"}
```

**Un valore è nelle unità del tag, come una lettura.** Su un tag con scala o offset, ciò che inviate è ciò che il tag rileggerebbe, e HotLoop invia al dispositivo il conteggio che lo produce: 55.5 su un registro con scala 0.1 mette 555 nel registro. (Fino alla 4.18, il numero andava al dispositivo così com'era, quindi 55.5 diventava 55 e si rileggeva 5.5.) Il controllo dell'intervallo e la riga di audit usano il vostro numero, nelle unità del tag. Un conteggio che dopo non sta nel registro, come 7000 su un `uint16` con scala 0.1, viene rifiutato con il conteggio e il registro nominati, e non viene inviato nulla. Una frazione di conteggio viene tagliata, come ha sempre fatto un registro a conteggio intero: 12.34 su un registro con scala di decimi contiene 12.3.

Il gate controlla, nell'ordine, che le scritture siano attivate (`HOTLOOP_ALLOW_WRITES`), che il tag sia armato e che il valore sia nell'intervallo. Ogni tentativo, rifiutato o no, è in `GET /api/writes`.

| Stato | Quando |
|---|---|
| 400 | Nessun valore, un valore `null`, una chiave malformata |
| 403 | Le scritture sono disattivate, oppure `"tank-farm/level: this tag is not marked writable"` |
| 404 | Nessun tag di questo tipo |
| 422 | `"value is outside the tag's configured range: 120 is outside 0..95"` |
| 503 | Il dispositivo non è connesso |

## Storico e audit

### `GET /api/history`

| Query | <span class="sr-only">Dettagli</span> |
|---|---|
| `tag` | Obbligatorio, ripetibile, fino a 50: `?tag=a/x&tag=b/y` |
| `minutes` | Quanto indietro da adesso. Predefinito 60 |
| `bucket` | Dimensione dell'intervallo in secondi. Predefinito: scelto in modo che la finestra abbia circa 400 intervalli, su una scala da 1 s a 1 giorno |
| `raw` | `true` per le letture stesse invece degli intervalli |
| `limit` | Predefinito 5000, al massimo 100000 |
| `carry` | `true` per dire anche che cosa conteneva ogni tag quando è iniziata la finestra (solo intervalli) |

A intervalli, dal più vecchio per tag. `badCount` è quante letture nell'intervallo non erano di buona qualità; vengono contate, non mediate. `from` e `to` sono la finestra a cui si riferisce la risposta, distanti esattamente `minutes` e che termina quando è stata fatta la domanda:

```json
{"buckets":[{"deviceId":"extruder-1","tagName":"Temperature","bucket":"2026-09-27T20:21:00Z","avg":18.986210570239944,"min":0,"max":20.83008050535897,"first":0,"last":20.83008050535897,"count":22,"badCount":1}],"from":"2026-09-27T19:22:00Z","raw":false,"to":"2026-09-27T20:22:00Z"}
```

L'historian conserva una lettura quando un valore supera la sua banda morta, non a ogni interrogazione, quindi un tag rimasto fermo non ha nulla da disegnare nella finestra. Con `carry=true` la risposta ha anche `"carry":[{"deviceId":"extruder-1","tagName":"Temperature","ts":"2026-09-27T16:40:12Z","value":21.4}]`: l'ultima lettura prima di `from`, per ogni tag la cui ultima lettura precedente era buona e conteneva un numero. Un tag la cui ultima lettura era cattiva o incerta, che non ha una lettura precedente o che è testo, non ha voce, perché ciò che conteneva non è noto e non daremo a un grafico un'ipotesi. La scheda di tendenza disegna da questo.

Grezze, dalla più recente:

```json
{"raw":true,"readings":[{"deviceId":"extruder-1","protocol":"","tagName":"Temperature","tagValue":21.021559879601448,"quality":"good","timestamp":"2026-09-27T20:22:00.267463Z"}]}
```

`400` senza `tag`, con più di 50, o con una chiave malformata.

### `GET /api/writes`

L'audit delle scritture, dalla più recente. Ogni tentativo è qui, compresi quelli rifiutati, perché «non sappiamo se quel comando è partito» è la peggiore risposta che uno stabilimento possa ricevere.

| Query | <span class="sr-only">Dettagli</span> |
|---|---|
| `tag` | Un tag, `device/tag` |
| `device` | Ogni tag di un dispositivo (ignorato se `tag` è impostato) |
| `entity` | Ogni scrittura che una chiamata di servizio su questa entità ha fatto o si è vista rifiutare, al posto di quanto sopra |
| `call` | Ogni scrittura di una chiamata, al posto di tutto quanto sopra: la pressione e il rilascio di un pulsante, o ogni destinazione dell'applicazione di una ricetta, che condividono il suo `call_id` |
| `limit` | Predefinito 100, al massimo 5000 |

```json
[{"id":2,"at":"2026-09-27T20:22:01.04226Z","deviceId":"tank-farm","tagName":"level_sp","value":"120","prior":"0 %","actor":"admin","source":"ui","succeeded":false,"error":"refused: value is outside the tag's configured range: 120 is outside 0..95"},
 {"id":4,"at":"2026-09-27T20:23:03.276962Z","deviceId":"tank-farm","tagName":"pump","value":"true","prior":"0","actor":"admin","source":"ui","succeeded":true,"latencyMs":0.317,"entityId":"switch.tank_farm_pump","service":"switch.turn_on","callId":"5c9f8545a93b5443"}]
```

`source` è `ui`, `api`, `automation` o `mcp`. `entityId`, `service` e `callId` ci sono solo sulle scritture fatte da una chiamata di servizio.

## Entità e stati

Ogni tag riceve entità senza che nessuno lo chieda; i compositi (motori, valvole, anelli, contatori, selettori, pulsanti, stazioni meteo) li costruisce un amministratore a partire dai tag. In snake_case, come ogni endpoint delle entità. Il modello completo è in [Entità](/it/iot/entities/).

### `GET /api/entities`

Ogni entità, orfane comprese.

| Query | <span class="sr-only">Dettagli</span> |
|---|---|
| `domain` | `sensor`, `switch`, `motor`... |
| `device` | Le entità di un dispositivo |
| `orphaned` | `true` per le sole orfane, `false` per nessuna |
| `q`, `limit` | Ricerca: una sottostringa, senza distinguere le maiuscole, dell'id dell'entità, del nome o dell'id del dispositivo, e al massimo `limit` di esse (da 1 a 5000, qualsiasi altro valore è `400`, mai tagliato in silenzio) ordinate per id dell'entità. `X-Total-Count` dice quante corrispondono. Se omessi, l'elenco è completo |

```json
[{"id":5,"entity_id":"switch.tank_farm_pump","unique_id":"tag-control:tank-farm/pump","domain":"switch","platform":"tag","name":"pump","device_id":"tank-farm","options":{},"disabled":false,"hidden":false,"created_at":"2026-09-27T20:21:39.153197Z","updated_at":"2026-09-27T20:21:39.153197Z","bindings":[{"role":"command","device_id":"tank-farm","tag_name":"pump"},{"role":"state","device_id":"tank-farm","tag_name":"pump"}],"equipment_id":null,"area_id":4,"labels":[]}]
```

### `GET /api/entities/composites`

Che cosa può creare `POST /api/entities`: ogni dominio, i ruoli a cui sono associati i suoi tag e i servizi che accetta. Un ruolo indica il suo `kind` di tag, se è `required`, se un servizio lo scrive (`command`) e se lo stato viene letto da esso (`feedback`). Una stazione meteo non accetta alcun servizio.

```json
{"domains":[{"domain":"weather","roles":[{"role":"temperature","kind":"number","required":true,"command":false,"feedback":true},{"role":"humidity","kind":"number","required":false,"command":false,"feedback":true}],"services":[]}]}
```

### `GET /api/entities/{entity_id}`

`{"entity": {...}, "state": {...}}`. `state` è `null` per un'entità disabilitata. `404` per una sconosciuta.

### `GET /api/entities/{entity_id}/image`

L'ultima immagine di una telecamera o di un'immagine, come i byte che HotLoop conserva: `Content-Type` è ciò che sono (`image/jpeg`, `image/png`, `image/gif` o `image/webp`), con `X-Content-Type-Options: nosniff`, una `Content-Security-Policy` di isolamento e un `ETag` (`If-None-Match` riceve un `304`). `404` per un'entità che non lo è, o prima che sia arrivata un'immagine. L'attributo `entity_picture` dello stato è questo percorso con l'hash dell'immagine.

### `PUT /api/entities/{entity_id}`

Cambia solo i campi inviati. Solo per amministratori: l'entity_id è il nome con cui ogni automazione, dashboard e agente si riferisce all'entità, e cambiarlo è configurazione.

| Campo | Tipo | <span class="sr-only">Dettagli</span> |
|---|---|---|
| `entity_id` | string | Una rinomina. Lo `unique_id` non si muove |
| `name`, `icon`, `device_class`, `state_class`, `unit_of_measurement`, `entity_category` | string | |
| `options` | object | Per dominio; vedere [Entità](/it/iot/entities/#api) |
| `disabled`, `hidden` | bool | Un'entità disabilitata non ha stato e non può essere comandata |
| `equipment_id` | int or null | La colloca nell'albero; `null` torna a seguire il suo dispositivo |
| `labels` | string[] | L'insieme completo |

`unique_id`, `domain`, `platform`, il dispositivo e le associazioni non si possono cambiare qui, e inviarli è un 400.

```json
{"entity":{"id":3,"entity_id":"sensor.tank_1_level","name":"Tank 1 level","device_class":"moisture","icon":"mdi:water-percent","...":"..."},"warnings":[]}
```

`warnings` dice quando qualcosa è lecito ma strano (un'unità che la classe di dispositivo di solito non ha). `400` per un corpo vuoto (`"the update names no field to change"`) o un valore errato, `404` per un'entità sconosciuta, `409` per un entity_id già preso.

### `POST /api/entities`

Crea un composito. Il corpo nomina il dominio e associa i tag ai suoi ruoli:

```json
{"name":"Transfer pump","domain":"motor","bindings":[{"role":"run_command","device_id":"tank-farm","tag_name":"pump"},{"role":"running","device_id":"tank-farm","tag_name":"pump"}]}
```

Anche `entity_id` (altrimenti generato dal nome), `device_class`, `unit_of_measurement`, `icon`, `entity_category` e `options`. Quali ruoli e opzioni accetta ogni dominio è in [Entità](/it/iot/entities/#composite-equipment). Risponde `201` `{"entity": {...}, "warnings": [...]}`. `400` per un dominio che non si crea qui (un `sensor` viene dal suo tag, un `alarm` dalla sua definizione), un ruolo mancante o un tag che non può ricoprirlo, `409` per un entity_id già preso.

### `DELETE /api/entities/{entity_id}`

Elimina un composito, o un'orfana il cui tag o la cui definizione di allarme non esiste più. `{"deleted":"motor.transfer_pump","entity":{...}}`. Ogni altra risponde `409` dicendo come invece sparisce:

```json
{"error":"this entity cannot be deleted: sensor.tank_1_level is kept in step with its tag; delete the tag, and then this orphan, or hide or disable it: already exists"}
```

### `GET /api/states`

Lo stato di ogni entità abilitata, ordinato per entity_id. `?domain=` filtra.

```json
[{"entity_id":"number.tank_farm_level_sp","state":"unknown","attributes":{"armed":true,"friendly_name":"level_sp","max":95,"min":0,"source":["tank-farm/level_sp"],"unit_of_measurement":"%"},"quality":"bad","last_changed":"2026-09-27T20:21:39.417193755Z","last_updated":"2026-09-27T20:21:39.417193755Z","last_reported":"2026-09-27T20:22:04.423849496Z"}]
```

`state` è sempre una stringa, anche per un numero; `unknown` e `unavailable` significano ciò che dicono. `last_reported` è il timestamp del dispositivo della lettura che sta dietro.

### `GET /api/states/{entity_id}`

Uno stato. `404` per un'entità sconosciuta, e un `404` diverso per una disabilitata, che dice come abilitarla: un'entità disabilitata non manca, e dichiararla mancante manda qualcuno a cercare un errore di battitura.

## Energia

Ciò che lo stabilimento consuma e quanto costa: chilowattora, gas, acqua, aria compressa e il costo di un'unità prodotta. Un contatore è un tag letto come quantità consumata. Il modello completo, le tariffe e ciò che fa la schermata sono in [Energia](/it/iot/energy/). Leggere è `energy.read`, che hanno tutti i ruoli; creare o modificare un contatore o una tariffa è `energy.write`, di un amministratore.

### `GET /api/energy/meters`

Ogni contatore, per tipo e poi per nome, ciascuno con come viene letto e che cosa ha consumato oggi.

```json
[{"id":"main","name":"Main panel","kind":"electricity","mode":"counter","source":{"device_id":"pm-01","tag_name":"kWh"},"unit":"kWh","factor":0.001,"tariff":{"currency":"USD","price":0.12,"bands":[{"from":"22:00","to":"06:00","price":0.07}]},"enabled":true,"status":{"state":"ok","last_read_at":"2026-11-19T21:15:00Z","resets":0,"gap_seconds":0},"today":{"value":412.6,"cost":49.51,"covered_seconds":43200,"estimated":false}}]
```

`status.state` è `ok`, `waiting` (dal tag non è ancora stato letto nulla), `bad` (la lettura del tag non è buona, e `reason` dice perché) o `disabled`.

### `POST /api/energy/meters`

Crea un contatore. `id` è fatto di lettere minuscole, cifre, `-` e `_`. `kind` è `electricity`, `gas`, `water`, `air`, `heat` o `production`. `mode` è `counter` (un tag cumulativo: ciò che è stato consumato è di quanto si è spostato, per `factor`) o `power` (una portata: ciò che è stato consumato è la portata per il tempo in cui si è mantenuta, con `power_unit` `W`, `kW` o `MW`, e `unit` `Wh`, `kWh` o `MWh`). `source` è il tag. `tariff` è un `price` fisso per unità con una `currency` facoltativa, e `bands` facoltative (`from` e `to` su un quarto d'ora, `days`, `price`) per una tariffa a fasce orarie; un contatore di produzione non ne ha. Un contatore elettrico in `Wh`, `kWh` o `MWh` può avere anche un `demand_price` nella tariffa: quanto costa un chilowatt del suo quarto d'ora più alto in una finestra. `enabled` omesso è `true`. `201` con `{"meter": {...}, "warnings": []}`. `400` che dice che cosa non va: il tag non c'è o non è un numero, una fascia non è su un quarto d'ora, un contatore di potenza con un fattore. `409` per un id già preso.

### `GET /api/energy/meters/{id}`

Un contatore, come lo mostra l'elenco. `404` per uno sconosciuto.

### `PUT /api/energy/meters/{id}`

Sostituisce la definizione di un contatore. Ciò che ha già contato resta, con il prezzo a cui è stato fatto. Puntarlo a un altro tag o modo fa dimenticare dove si era fermata l'ultima lettura, perché la lettura successiva riguarda qualcos'altro.

### `DELETE /api/energy/meters/{id}`

Rimuove un contatore e tutto ciò che ha contato. `404` per uno sconosciuto.

### `GET /api/energy/summary`

Consumo e costo di ogni contatore su una finestra, e il costo di un'unità prodotta. La finestra è `?period=` (`today`, `yesterday`, `this_week`, `last_week`, `this_month`, `last_month`, `last_7_days`, `last_30_days`, oppure un turno scritto `shift:06:00-14:00` per l'ultimo iniziato e `last_shift:06:00-14:00` per quello prima; giorni, mesi e turni sono quelli del sito) o `?from=&to=` in RFC 3339, con from incluso e to no, al massimo 400 giorni. `meters` è un elenco separato da virgole dei contatori il cui costo entra nel costo per unità, e `per` nomina l'unico contatore di produzione per cui dividere.

```json
{"period":"today","from":"2026-11-19T05:00:00Z","to":"2026-11-20T05:00:00Z",
 "meters":[{"id":"main","name":"Main panel","kind":"electricity","unit":"kWh","currency":"USD","value":412.6,"cost":49.51,"covered_seconds":43200,"coverage":1,"estimated":false}],
 "costs":[{"currency":"USD","cost":49.51}],
 "per_unit":[{"production":"parts","units":9800,"currency":"USD","cost":49.51,"cost_per_unit":0.00505}]}
```

`coverage` è la parte della finestra finora trascorsa che le letture coprono. I costi in due valute non vengono mai sommati, quindi c'è una riga `per_unit` per ciascuna. `cost_per_unit` è `null` quando non è stato prodotto nulla (`reason` è `nothing_made`) o quando è stato prodotto qualcosa e nessun contatore con prezzo ha ancora contato consumo (`nothing_counted`): non è una risposta, non è zero.

Un contatore con `demand_price` ha un `demand` nella sua riga: `peak_kw` (il quarto d'ora più alto della finestra, come i chilowatt della sua media), `peak_at` (quando è iniziato), `peak_covered_seconds` (quanta parte di quel quarto d'ora è stata letta; sotto 900 il picco è sottostimato) e `cost` (il picco per il prezzo). Il `cost` della riga resta ciò che è costata l'energia; `costs` e `per_unit` includono la quota di potenza.

### `GET /api/energy/summary/{period}`

Lo stesso del riepilogo, su un periodo (o turno) con nome indicato nel percorso. `meters` e `per` restano nella query.

### `GET /api/energy/series`

Il consumo di un contatore su una finestra, `?meter=<id>`, la finestra come sopra, e `step`: `quarter` (al massimo 8 giorni), `hour` (il valore predefinito), `day` o `month`. Un passo senza letture non compare nell'elenco.

```json
{"meter":"main","unit":"kWh","currency":"USD","step":"day","points":[{"start":"2026-11-19T05:00:00Z","value":412.6,"cost":49.51,"estimated":false}]}
```

### `GET /api/energy/series/{meter}/{period}/{step}`

Lo stesso della serie, con il contatore, il periodo con nome e il passo nel percorso, per un chiamante che ha solo un percorso da dare.

## Servizi

### `POST /api/services/{domain}/{service}`

Comanda un'entità: `switch/turn_on`, `number/set_value`, `motor/start`, `alarm/acknowledge`. Un'entità, un servizio, una chiamata. Sotto non è altro che scritture di tag attraverso lo stesso gate di scrittura di `POST /api/write`.

```json
{"entity_id":"switch.tank_farm_pump","reason":"start of shift"}
```

`entity_id` è obbligatorio ed è un'entità, non un elenco; `reason` è facoltativo; tutto il resto sono i dati del servizio (`value`, `option`, `position`, `mode`, `minutes`, `note`). I numeri mantengono il tipo con cui sono stati scritti. Il dominio nel percorso deve essere quello dell'entità. Ogni servizio e i suoi dati sono in [Entità](/it/iot/entities/#what-each-domain-takes).

```json
{"call_id":"5c9f8545a93b5443","entity_id":"switch.tank_farm_pump","service":"switch.turn_on","writes":[{"tag":"tank-farm/pump","value":"true","status":"written"}]}
```

Ogni scrittura è `written`, `not_sent` (rifiutata prima di raggiungere il dispositivo), `failed` (è partita e il dispositivo ha segnalato un errore, quindi non si sa se abbia avuto effetto) o `skipped` (una scrittura precedente della chiamata non è riuscita). Le scritture già fatte non vengono mai annullate. I servizi di un'entità allarme non scrivono alcun tag e rispondono con l'`alarm` come l'ha lasciato il motore. Neanche quelli di un helper scrivono alcun tag, e rispondono con lo `state` in cui l'hanno lasciato:

```json
{"call_id":"0f3c2a1b9d8e7f60","entity_id":"input_number.batch_target","service":"input_number.set_value","writes":[],"state":"1250"}
```

Il `turn_on` di uno script lo esegue, con i dati come suoi campi, e risponde con lo `script_run` che ha avviato; le scritture dei suoi passi sono sottoposte ad audit una per una come `script:<id>`, non qui. `turn_off` ferma ogni sua esecuzione. Vedere [Script](#script).

Il `turn_on` di una scena applica la sua ricetta, con `params` e `version` dai dati, e risponde con l'intera `recipe_application` e, in `writes`, ogni scrittura fatta dai suoi destinatari, in ordine. Fallisce a meno che ogni destinatario sia stato scritto. Vedere [Ricette](#ricette).

Una chiamata fallita risponde con lo stato dell'errore e lo stesso corpo più `error`, così si vede esattamente dove si è fermata:

```json
{"error":"value is outside the tag's configured range: 150 is outside 0..95","call_id":"3cd42f8275e5765e","entity_id":"number.tank_farm_level_sp","service":"number.set_value","writes":[{"tag":"tank-farm/level_sp","value":"150","status":"not_sent","error":"value is outside the tag's configured range: 150 is outside 0..95"}]}
```

| Stato | Quando |
|---|---|
| 400 | Nessun `entity_id`, dominio sbagliato, servizio sconosciuto, dati che il servizio non accetta |
| 403 | Il permesso, oppure il gate ha rifiutato per policy |
| 404 | Nessuna entità di questo tipo |
| 409 | Un'alternanza senza stato noto, un'apparecchiatura in uno stato sbagliato per il servizio |
| 422 | Un valore rifiutato nel merito |
| 503 | Il dispositivo non è connesso; il motore degli allarmi non è in esecuzione |
| 500 | La pressione di un pulsante è partita e il suo rilascio no. **Il tag può ancora contenere il valore di pressione**: controllatelo e rilasciatelo a mano |

**`?dry_run=true`** chiede che cosa farebbe la chiamata e non ne fa nulla: nulla viene scritto, sottoposto ad audit o registrato. La chiamata viene pianificata come quella vera e ogni scrittura è sottoposta ai controlli del gate stesso, nello stesso ordine, adesso. Un verdetto risponde 200, rifiutato o no: ogni scrittura `would_write`, oppure la prima che verrebbe rifiutata `not_sent` con il motivo e le altre `skipped`, e `error` è l'errore con cui fallirebbe la chiamata vera, parola per parola.

```json
{"dry_run":true,"error":"value is outside the tag's configured range: 150 is outside 0..95","entity_id":"number.tank_farm_level_sp","service":"number.set_value","writes":[{"tag":"tank-farm/level_sp","value":"150","status":"not_sent","error":"value is outside the tag's configured range: 150 is outside 0..95"}]}
```

Una richiesta che la chiamata vera respingerebbe prima di ogni controllo (entità inesistente, servizio sconosciuto, dati che il servizio non accetta, un'alternanza senza stato noto) risponde con lo stato e l'errore della chiamata vera; lo stesso vale per un permesso mancante. `dry_run` è `true` o `false` e nient'altro: `yes` è un 400, non un'ipotesi, perché indovinare male trasforma una domanda in un comando. Vedere [Entità](/it/iot/entities/#asking-first-the-dry-run).

**Perché il permesso viene controllato nell'handler.** Serve `values.write`, come per scrivere direttamente il tag, perché è tutto ciò che è; i servizi di un'entità `alarm` richiedono `alarms.ack`, come la schermata degli allarmi, quelli di un helper richiedono `helpers.write`, che un operatore ha, quelli di uno script richiedono `scripts.run`, come `POST /api/scripts/{id}/run`, e quelli di una scena richiedono `recipes.apply` e il permesso proprio della ricetta quando ne nomina uno, come `POST /api/recipes/{id}/apply`. Il controllo viene fatto dentro l'handler e non davanti perché un rifiuto per la sua mancanza passi dal gate di scrittura e sia **sottoposto ad audit sull'entità** come ogni altro rifiuto, con il valore richiesto. Un utente senza il permesso riceve un 403 e una riga in `GET /api/writes?entity=...`, non un 403 e nulla. Un helper non scrive alcun tag, quindi il rifiuto di un helper, questo compreso, è invece un avviso nel log di sistema (`GET /api/events`) sull'helper, e lo stesso vale per uno script. Il rifiuto di una scena è un'applicazione rifiutata nello storico della ricetta, con l'utente.

## Helper

Valori che appartengono alle persone dell'impianto e non a un PLC: `input_boolean`, `input_number`, `input_select`, `input_text`, `input_counter`, `timer` e `schedule`. Un helper è un'entità (piattaforma `helper`) e compare in `/api/entities` e `/api/states` come ogni altra; queste rotte sono la sua configurazione. Il suo valore si imposta con i servizi qui sopra, con `helpers.write`. Ogni dominio, opzione e servizio è in [Helper](/it/iot/helpers/).

### `GET /api/helpers`

Ogni helper, ciascuno con i campi della sua entità e il suo `value`, la riga memorizzata per esso:

```json
[{"id":41,"entity_id":"timer.purge","unique_id":"helper:6f1d...","domain":"timer","platform":"helper","name":"Purge","options":{"duration_sec":600},"...":"...","value":{"state":"active","finishes_at":"2026-09-27T21:10:00Z","duration_ms":600000,"changed_at":"2026-09-27T21:00:00Z","changed_by":"otto","source":"ui","call_id":"9a1b...","rev":4}}]
```

### `POST /api/helpers`

Crea un helper al suo valore iniziale. Solo per amministratori.

```json
{"name":"Batch target","domain":"input_number","unit_of_measurement":"kg","options":{"min":0,"max":5000,"step":50,"initial":1000}}
```

Anche `entity_id` (altrimenti generato dal nome) e `icon`. Risponde `201` `{"helper": {...}}`. `400` per un dominio che non è di un helper, un'opzione che il dominio non accetta o un `initial` che le sue stesse opzioni rifiuterebbero; `409` per un entity_id già in uso.

### `GET /api/helpers/{entity_id}`

Un helper, come nell'elenco. `404` per un'entità sconosciuta o che non è un helper.

### `PUT /api/helpers/{entity_id}`

Cambia `name`, `icon`, `unit_of_measurement`, `options`, `disabled`, `hidden`, `entity_id`, `equipment_id` o `labels`, gli stessi campi di `PUT /api/entities/{entity_id}`. Solo per amministratori. Nuove opzioni che non consentirebbero il valore che l'helper detiene ora (un intervallo ristretto al di sotto di esso, la scelta selezionata rimossa) danno un `400`: un valore non viene mai spostato per farlo rientrare. Risponde `{"helper": {...}, "warnings": []}`.

### `DELETE /api/helpers/{entity_id}`

Elimina l'helper e il suo valore. Solo per amministratori. `{"deleted":"timer.purge"}`. `DELETE /api/entities/{entity_id}` rifiuta un helper con un `409` che rimanda qui.

## Apparecchiature ed etichette

L'albero ISA-95 (azienda, sito, area, linea, cella, unità, apparecchiatura) e le etichette libere. In snake_case. Tutti i ruoli leggono; solo un amministratore modifica, perché rinominare o spostare un nodo riscrive sito, area e linea di ogni dispositivo sotto di esso. Vedi [l'albero delle apparecchiature e le etichette](/it/iot/equipment/).

### `GET /api/equipment`

Ogni nodo, ordinato per id, ciascuno con il suo `path` di nomi dalla radice. `?level=area` filtra. `?q=` tiene i nodi il cui percorso contiene il testo (senza distinguere maiuscole e minuscole), `?limit=` (da 1 a 5000, ogni altro valore è `400`) i primi tra questi; con uno dei due, `X-Total-Count` è quanti hanno corrisposto.

```json
[{"id":4,"parent_id":1,"level":"area","name":"Utilities","created_at":"2026-09-27T20:21:01.637319Z","updated_at":"2026-09-27T20:21:01.637319Z","path":["Demo Plant","Utilities"]}]
```

### `POST /api/equipment`

```json
{"parent_id":3,"level":"cell","name":"Die head","description":"Die and screen changer"}
```

`parent_id` nullo o omesso crea una radice. Un figlio deve essere di un livello inferiore al padre (un'apparecchiatura può stare dentro un'apparecchiatura). Risponde `{"equipment": {...}, "devices_rewritten": []}`. `400` per un livello o una collocazione errati, `409` per un fratello con lo stesso livello e nome.

### `GET /api/equipment/{id}`

Il nodo, i nodi direttamente sotto di esso, e i dispositivi e le entità collocati direttamente su di esso:

```json
{"children":[],"devices":["extruder-1"],"entities":[],"equipment":{"id":3,"parent_id":2,"level":"line","name":"Line 1","...":"...","path":["Demo Plant","Extrusion","Line 1"]}}
```

`400` per un id che non è un numero positivo, `404` per uno sconosciuto.

### `PUT /api/equipment/{id}`

Uno qualsiasi tra `name`, `description`, `level`, `parent_id` (`null` lo sposta alla radice). Cambiano solo i campi inviati; un corpo vuoto è un 400. Risponde il nodo e **ogni dispositivo il cui testo di sito, area o linea è cambiato di conseguenza**, perché quel testo è ciò che leggono i client più vecchi e gli strumenti MCP:

```json
{"devices_rewritten":["tank-farm"],"equipment":{"id":4,"parent_id":1,"level":"area","name":"Utilities East","...":"..."}}
```

### `DELETE /api/equipment/{id}`

`{"deleted":5}`. `409` finché c'è qualcosa sotto o collocato su di esso, dicendo cosa: eliminare un nodo da sotto i piedi di un dispositivo non è una decisione da prendere per caso.

### `GET /api/labels`

```json
[{"label_id":"critical","name":"Critical","color":"red","icon":"mdi:alert","description":"Stops the line if it fails","created_at":"2026-09-27T20:24:29.659126Z","updated_at":"2026-09-27T20:24:29.659126Z"}]
```

### `POST /api/labels`

`name` è obbligatorio; `label_id` (da 1 a 64 lettere minuscole, cifre e trattini bassi) è generato dal nome se omesso, e non cambia mai in seguito. `color`, `icon` (`mdi:...`) e `description` sono facoltativi. Risponde l'etichetta. `409` per un nome o un id già in uso.

### `GET /api/labels/{label_id}`

`{"label": {...}, "devices": ["tank-farm"], "entities": []}`: l'etichetta e ciò che la porta. `404` per una sconosciuta.

### `PUT /api/labels/{label_id}`

Sostituisce `name`, `color`, `icon` e `description`; un campo omesso viene azzerato. Un `label_id` nel corpo deve corrispondere al percorso: altrimenti `400`, perché un label_id non cambia mai.

### `DELETE /api/labels/{label_id}`

La toglie da tutto ciò che la porta. `{"deleted":"critical"}`, oppure `404`.

### `PUT /api/devices/{id}/labels`

`{"labels": ["critical"]}` sostituisce l'intero insieme di un dispositivo. Risponde `{"id":"tank-farm","labels":["critical"]}`. Ogni etichetta deve esistere (`400` con i nomi di quelle mancanti), e anche il dispositivo (`404`). Le etichette non fanno parte di `POST /api/devices` di proposito: ogni client che salva un dispositivo invia il dispositivo intero senza di esse, e le cancellerebbe a ogni salvataggio.

## Allarmi

ISA-18.2: scattare, essere riconosciuto e rientrare sono cose distinte, e il registro può dire quale è avvenuta.

### `GET /api/alarms`

Ogni definizione, gli allarmi attivi e il riepilogo. `?outstanding=true` esclude quelli normali e quelli silenziati.

```json
{
  "alarms": [{"definitionId":"extruder-temp-hi","name":"Extruder temperature high","deviceId":"extruder-1","tagName":"Temperature","priority":2,"state":"unack-active","message":"extruder-1/Temperature at 22.80197037650447 C, limit 5","tripValue":22.80197037650447,"raisedAt":"2026-09-27T20:25:19.67042816Z","count":1,"updatedAt":"2026-09-27T20:25:19.67042816Z"}],
  "definitions": [{"id":"extruder-temp-hi","name":"Extruder temperature high","deviceId":"extruder-1","tagName":"Temperature","condition":"hi","limit":5,"priority":2,"enabled":true,"deadband":0.5,"message":"{device}/{tag} at {value}, limit {limit}","createdAt":"2026-09-27T20:25:19.055658Z","updatedAt":"2026-09-27T20:25:19.055658Z"}],
  "summary": {"critical":0,"high":1,"medium":0,"low":0,"unacked":1,"total":1}
}
```

`state` è `normal`, `unack-active`, `ack-active`, `rtn-unack` (rientrato prima che qualcuno lo riconoscesse, e tenuto nell'elenco perché uno scatto alle 3 di notte non sparisca prima che lo veda il turno del mattino), `shelved` o `suppressed`. `tripValue` è la lettura che l'ha fatto scattare, non quella attuale.

### `POST /api/alarms`

Crea o sostituisce una definizione.

| Campo | Tipo | <span class="sr-only">Dettagli</span> |
|---|---|---|
| `id`, `name` | string | Obbligatorio. `id` segue le regole degli id dei dispositivi |
| `deviceId`, `tagName` | string | Obbligatorio |
| `condition` | string | `hihi`, `hi`, `lo`, `lolo`, `eq`, `ne`, `true`, `false`, `bad-quality`, `stale` (nessuna lettura per `limit` secondi), `roc` (velocità di variazione superiore a `limit` al secondo) |
| `limit` | number | |
| `priority` | int | Da 1 (critica) a 4 (bassa) |
| `enabled` | bool | Se omesso, è `false` |
| `deadband` | number | Di quanto deve tornare indietro il valore prima che rientri. Senza banda morta, un valore sul limite oscilla di continuo |
| `onDelaySec`, `offDelaySec` | int | Per quanto tempo la condizione deve durare prima che scatti, o essere assente prima che rientri |
| `message`, `description` | string | `message` accetta `{value}`, `{limit}`, `{tag}`, `{device}`, `{unit}`, `{condition}` e `{reason}` (perché la lettura è errata, vuoto quando è buona) |

`{value}` viene scritto come lo scrive la scheda del valore, unità compresa: i numeri interi così come sono, due decimali da 1 in su, uno da 100 in su, quattro sotto 1, e notazione scientifica oltre dieci milioni o sotto 0.01 (`8.20 pH`, `212.5 F`, `1.235e+7`). Lo abbiamo fatto perché un tag con scala 0.1 e un valore grezzo di 82 è 8.200000000000001 come float, e il banner lo mostrava così. Una lettura di testo viene detta com'è. Il tag, le scritture e le automazioni vedono ancora il numero esatto; solo la frase è arrotondata. `{limit}` è il limite come lo hai digitato.

Risponde la definizione; il motore si ricarica e l'entità dell'allarme viene creata prima della risposta. `400` se la validazione fallisce (`"alarm x: priority must be 1-4, got 9"`).

### `POST /api/alarms/import/codesys`

Legge dal corpo della richiesta il file che Export Alarms dell'IDE CODESYS scrive (l'esportazione di un gruppo di allarmi, `.csv`), così come l'ha scritto l'IDE (UTF-16 con byte order mark) o in UTF-8. `?deviceId=` è il dispositivo del PLC ed è obbligatorio. `?application=` è il nome dell'applicazione sotto cui stanno i suoi tag, `Application` se omesso: l'esportazione nomina una variabile dal suo GVL (`GVL_Alarm.bPumpFault`) e il tag è `Application.GVL_Alarm.bPumpFault`. `?defaultPriority=` (da 1 a 4) è la priorità di un allarme la cui classe non è Error, Warning o Info. Senza `?apply=true` non viene salvato nulla: la risposta dice cosa verrebbe importato.

La schermata Allarmi la offre come Importa da CODESYS (solo amministratori): scegli il dispositivo, indica l'applicazione, scegli il file, leggi l'anteprima, poi importa.

Gli allarmi digitali confrontati con `= TRUE` o `= FALSE` diventano `true` e `false`, UpperLimit con `>` diventa `hi`, LowerLimit con `<` diventa `lo`, un allarme Outside range (`OutOfArea`, con entrambi gli operatori `<`) diventa due allarmi, un `lo` al limite inferiore e un `hi` a quello superiore, il messaggio e i ritardi di attivazione e di rientro (un tempo IEC come `T#5s`) vengono riportati, ed Error è priorità 2, Warning 3, Info 4. Tutto il resto che l'IDE può scrivere non viene letto e torna in `skipped` con la sua riga e il motivo, perché il formato non è documentato da CODESYS e viene letto solo ciò che un'esportazione reale ha mostrato. Questo include il resto di ciò che offre l'IDE: Inside the range (`ForbiddenArea`) è vero solo tra due limiti e qui un allarme ne ha uno, Change non ha una durata documentata, ed Event e Alarm (API) sono generati dal programma del PLC e non hanno una variabile da osservare. `warnings` elenca ciò che è passato solo in parte (una classe non nota, il latching, un allarme a priorità più alta).

```json
{"applied": false, "version": "2.0.0.0",
 "alarms": [{"id":"codesys-GVL_Alarm.rTemp-hi","name":"Temperature high","deviceId":"plc1","tagName":"Application.GVL_Alarm.rTemp","condition":"hi","limit":90,"priority":3,"enabled":true,"message":"Temperature high"}],
 "skipped": [{"row":5,"id":"3","reason":"the observation type \"Deviation\" has not been seen in an export, so it is not read"}],
 "warnings": []}
```

`404` per un dispositivo sconosciuto, `400` per un file che non è l'esportazione di un gruppo di allarmi.

### `DELETE /api/alarms/{id}`

`{"deleted":"extruder-temp-hi"}`, oppure `404`.

### `POST /api/alarms/{id}/ack`

Corpo facoltativo `{"note": "checking the heater bands"}`. Risponde l'allarme com'è ora, con `ackedBy` e `ackNote`. `404` per un allarme sconosciuto.

### `POST /api/alarms/{id}/shelve`

`{"minutes": 30}`, obbligatorio e positivo: un silenzio indefinito è una soppressione, che è un'altra cosa e non spetta a un operatore deciderla. Risponde l'allarme, con `state` a `shelved`, con `shelvedUntil` e `shelvedBy`.

### `POST /api/alarms/{id}/unshelve`

Nessun corpo. Risponde l'allarme riportato nello stato che la sua condizione gli dà. `409` se non era sospeso.

### `GET /api/alarms/events`

Il registro di controllo degli allarmi, dal più recente. `?alarm=` una definizione, `?limit=` (200 per impostazione predefinita, al massimo 5000).

```json
[{"id":2,"definitionId":"extruder-temp-hi","type":"acked","fromState":"unack-active","toState":"ack-active","value":23.192472931395088,"message":"extruder-1/Temperature at 22.80197037650447 C, limit 5","actor":"admin","note":"checking the heater bands","at":"2026-09-27T20:25:22.920251Z"}]
```

`type` è `raised`, `acked`, `cleared`, `shelved`, `unshelved`, `suppressed`, `unsuppressed`, `escalated` o `escalation-ended`. Gli ultimi due sono scritti dall'escalation degli allarmi (`actor` è `escalation`), e la loro `note` dice chi è stato avvisato e perché la catena si è fermata. Vedi [Notifiche degli allarmi](/it/iot/notifications/#escalation).

## Automazioni

Trigger, una condizione, azioni. Il linguaggio delle regole è in [Automazioni](/it/iot/automations/).

### `GET /api/automations`

```json
{"armed":{"fill-tank":true},"automations":[{"id":"fill-tank","name":"Fill the tank","enabled":true,"triggers":[{"type":"threshold","deviceId":"tank-farm","tagName":"level","threshold":20,"direction":"falling","hysteresis":5},{"type":"webhook","webhookPath":"fill-now"}],"actions":[{"type":"call_service","name":"start the pump","params":{"service":"switch.turn_on","entityId":"switch.tank_farm_pump"}}],"mode":"skip","minIntervalSec":60,"createdAt":"2026-09-27T20:26:49.770826Z","updatedAt":"2026-09-27T20:26:49.770826Z"}],"webhooks":["fill-now"]}
```

`armed` indica quali regole sono davvero in esecuzione, il che non è lo stesso di `enabled`: una regola abilitata che ha smesso di compilare non è armata, ed è qui che lo scopri.

### `POST /api/automations`

Crea o sostituisce una regola: `id`, `name`, `description`, `enabled`, `triggers` (almeno uno), `condition`, `actions` (almeno una), `mode` (`skip`, il predefinito, `queue`, `restart` o `parallel`), `minIntervalSec`, `maxRuntimeSec`. La regola viene compilata prima di essere salvata, e una che non compila dà un 400 e non raggiunge mai il database: una regola salvata che non può essere armata è una regola che il suo autore crede in funzione.

```json
{"error":"automation fill-tank action 1 (call_service): params: json: unknown field \"entity_id\""}
```

### `POST /api/automations/validate`

Compila una regola senza salvarla, per il controllo in tempo reale dell'editor. Sempre `200`; la risposta dice se ha compilato:

```json
{"valid":true}
{"error":"automation bad: at least one trigger is required","valid":false}
```

Richiede `automations.write` perché esiste per aiutare qualcuno a scriverne una.

### `DELETE /api/automations/{id}`

`{"deleted":"fill-tank"}`, oppure `404`.

### `POST /api/automations/{id}/enabled`

`{"enabled": false}` la disarma senza eliminarla. Risponde `{"enabled":false,"id":"fill-tank"}`, oppure `404`.

### `POST /api/automations/{id}/trigger`

La esegue ora, come se un trigger fosse scattato. La condizione continua ad applicarsi (una falsa registra un'esecuzione `skipped`) e così la modalità di esecuzione; `minIntervalSec` no, perché una persona che chiede un'esecuzione non è un tag che oscilla. Nessun corpo. `202` `{"triggered":"fill-tank"}`: l'esecuzione avviene in background, e `GET /api/runs` ne ha il risultato. `400` se la regola non è armata. Gli operatori hanno `automations.trigger`; eseguire una regola scritta da un altro è operare, scriverne una no.

### `GET /api/runs`

Cronologia delle esecuzioni, dalla più recente. `?automation=` una regola, `?limit=` (100 per impostazione predefinita, al massimo 1000). `[]` quando non ce ne sono.

```json
[{"id":1,"automationId":"fill-tank","status":"succeeded","triggerType":"manual","triggerDesc":"triggered by admin","actor":"admin","startedAt":"2026-09-27T20:26:50.269792Z","finishedAt":"2026-09-27T20:26:50.282129Z","durationMs":12.337,"steps":[{"index":1,"type":"call_service","name":"start the pump","input":"switch.turn_on switch.tank_farm_pump {}","output":"true to tank-farm/pump: written; call 8fb9538c82d532be","startedAt":"2026-09-27T20:26:50.272532641Z","durationMs":9.595}]}]
```

`status` è `running`, `succeeded`, `failed`, `skipped`, `timed_out` o `cancelled`. I passi conservano gli ingressi risolti, non i modelli, perché è ciò che serve leggere alle 3 di notte.

Una regola creata da un blueprint porta tre campi in più in `GET /api/automations`: `blueprintId`, `blueprintVersion` (la versione da cui è stata creata, che è la versione a cui resta) e `blueprintInputs`. Una regola scritta a mano non ne ha nessuno. Sono del server: `POST /api/automations` li accetta e li ignora, e una modifica a mano mantiene ciò che la regola aveva.

### `POST /api/automations/{id}/blueprint-upgrade`

Porta una regola creata da un blueprint alla versione più recente del blueprint, mantenendone id, nome e se è armata. Non viene mai fatto per te. Gli operatori hanno `blueprints.apply`, come per crearne una. Guarda prima: **`?dry_run=true`** non cambia nulla e risponde cosa cambierebbe, parte per parte, e cosa farebbe poi la regola se scattasse ora, con ogni scrittura sottoposta ai controlli del write gate:

```json
{"dry_run":true,"id":"pump_1_watch","blueprint":"pump_watch","from":1,"to":2,"changes":[{"field":"actions","before":[{"params":{"message":"switch.pump_1 started, v1"},"type":"log_event"}],"after":[{"params":{"message":"switch.pump_1 started, v2"},"type":"log_event"}]}],"automation":{"id":"pump_1_watch","...":"..."},"check":{"automation_id":"pump_1_watch","steps":[{"step":"1","type":"log_event","verdict":"not_checked","detail":"a dry run checks writes to equipment; this step writes to none and runs only for real"}]}}
```

Una modifica fatta a mano dopo la creazione della regola compare in `changes` come sostituita. Quando la nuova versione richiede un ingresso per cui la regola non ha valore, o rifiuta un valore con cui è stata creata, la prova lo dice in `error` e nient'altro.

Quella vera prende `{"version": 2}`, la versione mostrata dalla prova, e `inputs` per tutto ciò che serve alla nuova versione. Un blueprint che nel frattempo è andato avanti, o una regola che qualcuno ha aggiornato nel frattempo, dà un `409`: ciò che è stato rivisto è ciò che entra, oppure non entra nulla. Un ingresso mancante dà un `400`. `200` con la stessa forma, dove `automation` è la regola così com'è salvata. Viene registrato come `automation upgraded from blueprint pump_watch version 1 to 2`. Con la stessa versione e nuovi `inputs`, è il modo per cambiare gli ingressi di una regola. `400` per una regola scritta a mano; `404` se il blueprint da cui proviene non esiste più.

## Script

Sequenze di azioni con nome, eseguite su richiesta: da qui, dal passo `call_script` di una regola, da `run_script` di MCP o tramite l'entità dello script (`script.turn_on`). La sequenza è il linguaggio di automazione. Ogni scrittura fatta da un passo passa dal write gate come `script:<id>`, con la sorgente di chi l'ha avviata. Tutto è in [Script](/it/iot/scripts/).

### `GET /api/scripts`

Ogni script, con i suoi contatori di esecuzione e quante sue esecuzioni sono in corso ora, in qualsiasi processo:

```json
[{"id":"cip_cycle","name":"CIP cycle","fields":[{"name":"minutes","type":"number","required":true,"min":1,"max":60,"unit":"min"}],"sequence":[{"type":"call_service","params":{"entityId":"switch.cip_pump","service":"switch.turn_on"}}],"mode":"skip","createdAt":"2026-09-28T10:00:00Z","updatedAt":"2026-09-28T10:00:00Z","lastRun":"2026-09-28T10:05:00Z","lastStatus":"succeeded","runCount":3,"running":0}]
```

### `POST /api/scripts`

Ne crea uno. Solo per amministratori. `id` (lettere minuscole, cifre e trattini bassi, iniziando con una lettera: è l'id oggetto dell'entità, `script.<id>`), `name`, `description`, `icon`, `fields` (ingressi tipizzati), `sequence` (almeno un'azione), `mode` (`skip`, il predefinito, `queue`, `restart` o `parallel`) e `maxRuntimeSec`. Viene compilato prima di essere salvato, come una regola, e uno script che chiamerebbe se stesso, direttamente o tramite altri script, viene rifiutato. Risponde `201` con lo script. `400` per tutto ciò che non compila; `409` per un id già in uso.

### `POST /api/scripts/validate`

Controlla uno script senza salvarlo, per il controllo in tempo reale dell'editor. `200` `{"valid":true}` oppure `{"valid":false,"error":"..."}`, con le parole con cui un salvataggio verrebbe rifiutato.

### `GET /api/scripts/{id}`

Uno script, come nell'elenco. `404` se non esiste.

### `PUT /api/scripts/{id}`

Sostituisce la sua definizione; il corpo è lo stesso della creazione, e il suo `id` può essere omesso. Solo per amministratori. Le sue esecuzioni in corso vengono annullate quando cambiano i suoi passi, i campi o la modalità: sono state avviate dalla vecchia definizione.

### `DELETE /api/scripts/{id}`

Lo elimina insieme alla cronologia delle esecuzioni, annullando le esecuzioni in corso. Solo per amministratori. `{"deleted":"cip_cycle"}`. La sua entità resta orfana, non viene eliminata.

### `POST /api/scripts/{id}/run`

Lo esegue. Gli operatori hanno `scripts.run`.

```json
{"fields":{"minutes":20},"reason":"end of shift clean","wait":false}
```

Ogni campo del corpo è facoltativo, e lo è anche il corpo. I campi vengono controllati rispetto a quelli dello script prima che venga eseguito qualcosa: un valore fuori intervallo, fuori dal suo passo, che non è una delle opzioni o è del tipo sbagliato dà un `400`, e non viene mai spostato per farlo rientrare. `202` con l'esecuzione appena avviata; con `"wait":true`, `200` con l'esecuzione una volta terminata, traccia inclusa.

```json
{"run":{"id":77,"scriptId":"cip_cycle","status":"running","actor":"otto","source":"ui","fields":{"minutes":20},"startedAt":"2026-09-28T10:05:00Z","durationMs":0}}
```

`409` quando è occupato: già in esecuzione con modalità `skip`, oppure in esecuzione con una in coda e modalità `queue`. Non è stato eseguito nulla, e nella cronologia c'è un'esecuzione `skipped` che dice perché:

```json
{"error":"script busy: script cip_cycle was not started: it is already running, and its mode is skip","run":{"id":78,"scriptId":"cip_cycle","status":"skipped","...":"..."}}
```

**`?dry_run=true`** chiede cosa farebbe un'esecuzione ora e non ne fa nulla. I campi vengono controllati allo stesso modo; poi ogni passo viene percorso rispetto all'impianto così com'è: ogni scrittura e chiamata di servizio viene sottoposta ai controlli propri del gate, una condizione viene valutata, una variabile viene legata. Un'attesa, un ritardo e tutto ciò che non scrive su alcuna apparecchiatura sono `not_checked`. La prima scrittura che verrebbe rifiutata lo termina, come terminerebbe l'esecuzione, e `error` lo dice con le parole del gate. `200` con il verdetto, rifiutato o no:

```json
{"dry_run":true,"check":{"script_id":"cip_cycle","fields":{"minutes":20},"steps":[{"step":"1","type":"call_service","input":"switch.turn_on switch.cip_pump {}","verdict":"refused","detail":"cip/pump: this tag is not marked writable"}],"error":"step 1 (call_service): cip/pump: this tag is not marked writable"}}
```

Il `verdict` di ogni passo è `would_write`, `refused`, `ends_here` (una condizione falsa ora, o uno stop), `not_checked` o `ok`. Un passo di uno script che esso chiama è numerato sotto la chiamata: `3.1`.

### `POST /api/scripts/{id}/stop`

Annulla tutte le sue esecuzioni in corso, in ogni processo, dovunque siano. `{"cancelled":1,"stopped":"cip_cycle"}`, dove `cancelled` sono le esecuzioni che aveva questo processo. Gli operatori hanno `scripts.run`: fermare ciò che si può avviare fa parte dell'avviarlo.

### `GET /api/scripts/{id}/runs`

Le sue esecuzioni, dalla più recente, con le loro tracce. `?limit=` (50 per impostazione predefinita, al massimo 1000). `parent` è ciò che ha chiamato un'esecuzione, quando qualcosa l'ha fatto: `automation_run:812`, `script_run:77`.

```json
[{"id":77,"scriptId":"cip_cycle","status":"succeeded","actor":"automation:shift-end","source":"automation","parent":"automation_run:812","fields":{"minutes":20},"startedAt":"2026-09-28T10:05:00Z","finishedAt":"2026-09-28T10:25:00Z","durationMs":1200012,"steps":[{"index":1,"type":"call_service","input":"switch.turn_on switch.cip_pump {}","output":"true to cip/pump: written; call 8fb9538c82d532be","startedAt":"2026-09-28T10:05:00Z","durationMs":9.6}]}]
```

## Ricette

Insiemi di valori applicati insieme: i setpoint di una qualità di prodotto, un cambio formato. Ciascuno è anche un'entità, `scene.<id>`. Una ricetta viene controllata per intero prima che parta qualcosa e rifiutata per intero per qualsiasi motivo; i suoi obiettivi partono poi in ordine con un unico id di chiamata, il primo che fallisce ferma gli altri e nulla viene annullato; ogni valore scritto viene riletto dal dispositivo. Tutto è in [Ricette](/it/iot/recipes/).

Il nome, la descrizione, il nodo dell'apparecchiatura e il permesso di una ricetta cambiano sul posto. Ciò che scrive (`targets`, `params`, `precondition`, `verify_sec`) è una versione, e le versioni non vengono mai modificate: salvare un nuovo contenuto memorizza la successiva.

### `GET /api/recipes`

Tutte le ricette, con il contenuto della versione corrente e la loro applicazione più recente:

```json
[{"id":"grade_a","name":"Grade A","equipment_id":7,"apply_permission":"recipes.apply","current_version":3,"params":[{"name":"speed","type":"number","min":0,"max":400,"step":10,"unit":"rpm","required":true}],"precondition":"states['input_boolean.line_ready'] == 'on'","targets":[{"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210}},{"entity_id":"number.line_02_speed","service":"set_value","data_expressions":{"value":"vars.speed"}}],"verify_sec":10,"note":"zone 1 up 5","created_at":"2026-09-28T10:00:00Z","updated_at":"2026-09-28T11:00:00Z","last_application":{"id":41,"recipe_id":"grade_a","version":3,"call_id":"7c1f0e2d9a8b6c54","actor":"otto","source":"ui","params":{"speed":250},"status":"applied","targets":[],"started_at":"2026-09-28T11:05:00Z","finished_at":"2026-09-28T11:05:01Z"}}]
```

`equipment_id` è `null` per una ricetta dell'intero impianto.

### `POST /api/recipes`

Ne crea una, come versione 1. Solo per amministratori. `id` (lettere minuscole, cifre e trattini bassi, iniziando con una lettera: è l'id oggetto dell'entità, `scene.<id>`), `name`, `description`, `equipment_id`, `apply_permission` (`recipes.apply`, il predefinito, oppure `recipes.apply.<name>`), `params` (ingressi tipizzati), `precondition` (un'espressione che deve essere vera per partire), `targets` (almeno uno, al massimo 200, ciascuno con `entity_id`, `service` e `data` oppure `data_expressions`), `verify_sec` (da 1 a 600, 10 per impostazione predefinita) e `note`. Un obiettivo imposta un valore: `set_value`, `select_option`, `set_position`, `set_speed`, `set_setpoint`, `set_mode`, `turn_on`, `turn_off`, sui domini che li accettano. Un impulso o un avvio viene rifiutato: appartiene a uno script. L'entità di ogni obiettivo deve esistere e ogni espressione deve compilare. `201` con la ricetta; `400` per qualsiasi errore, `409` per un id già usato.

### `POST /api/recipes/capture`

Prepara una bozza di ricetta da ciò che le entità hanno ora, solo per amministratori, e non salva nulla:

```json
{"entity_ids":["number.line_02_zone1_sp","switch.line_02_heater","loop.line_02_tic"]}
```

Ciascuna diventa un obiettivo che la riporta al suo valore attuale, nell'ordine dato; un anello diventa il suo modo e poi il suo setpoint. La risposta è una ricetta senza id né nome, per l'editor. Un'entità che non esiste, è disabilitata, viene letta con una qualità diversa da buona, è `unknown` o `unavailable`, o non è qualcosa che una ricetta imposta, dà un `400` che le nomina tutte: una ricetta costruita da una lettura sbagliata riscrive la lettura sbagliata.

### `GET /api/recipes/{id}`

Una ricetta, come nell'elenco. `404` se non esiste.

### `PUT /api/recipes/{id}`

La salva. Solo per amministratori. Il corpo è la ricetta come l'ha restituita `GET`, modificata; il suo `id` può essere omesso. `current_version` è la versione su cui è stata fatta la modifica: se nel frattempo qualcuno ne ha salvata un'altra, il salvataggio dà un `409` invece di sovrascrivere in silenzio la sua (`0` salta il controllo). Il nuovo contenuto diventa la versione successiva, con `note` che dice perché; una modifica solo del nome, della descrizione, dell'apparecchiatura o del permesso non ne crea nessuna.

### `DELETE /api/recipes/{id}`

La elimina insieme alle sue versioni. Solo per amministratori. `{"deleted":"grade_a"}`. Le sue applicazioni vengono conservate, perché sono ciò che è stato inviato all'impianto, e la sua entità resta orfana.

### `GET /api/recipes/{id}/versions`

Tutte le versioni, dalla più recente alla più vecchia, ciascuna esattamente come è stata salvata, con chi l'ha salvata e la nota:

```json
[{"recipe_id":"grade_a","version":3,"params":[],"targets":[{"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210}}],"verify_sec":10,"note":"zone 1 up 5","created_by":"ada","created_at":"2026-09-28T11:00:00Z"}]
```

### `GET /api/recipes/{id}/versions/{version}`

Una versione. `404` se la ricetta non ha quella versione, `400` se `{version}` non è un numero.

### `POST /api/recipes/{id}/validate`

Si applicherebbe adesso? Gli operatori hanno `recipes.apply`. Il corpo è quello di un'applicazione, e non viene scritto, registrato né annotato nulla. Si fa ogni controllo che un'applicazione fa prima di scrivere: i parametri, il permesso proprio della ricetta, la precondizione, le espressioni dei dati, se un'altra applicazione sta scrivendo su una delle sue entità, e ogni obiettivo sottoposto ai controlli del gate di scrittura. `200` con il verdetto, `would_apply` o `refused`, e quello di ogni obiettivo: `would_write`, `refused` con il motivo, oppure `not_sent`.

```json
{"dry_run":true,"application":{"recipe_id":"grade_a","version":3,"params":{"speed":250},"status":"refused","targets":[{"index":1,"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210},"status":"would_write"},{"index":2,"entity_id":"number.line_02_speed","service":"set_value","data":{"value":250},"status":"refused","error":"line-02/Speed: this tag is not marked writable"}],"started_at":"2026-09-28T11:04:00Z","error":"target 2 (set_value number.line_02_speed): line-02/Speed: this tag is not marked writable"}}
```

I parametri che non accetta danno un `400`, come lo darebbero con l'applicazione vera.

### `POST /api/recipes/{id}/apply`

La applica. Gli operatori hanno `recipes.apply`. Una ricetta che nomina un permesso proprio, `recipes.apply.<name>`, richiede anche quello, controllato qui rispetto alla ricetta; un utente che non lo ha riceve un `403` e un'applicazione rifiutata nello storico con il suo nome.

```json
{"params":{"speed":250},"reason":"grade A for the 2pm run","version":0,"resume":0}
```

Tutto è facoltativo, e il corpo pure. `version` applica di proposito una versione più vecchia; se omessa, quella corrente. `resume` è l'id di una precedente applicazione di questa ricetta che si è fermata a metà: i suoi obiettivi che non erano stati scritti partono come una nuova applicazione, con la sua versione e i suoi parametri, e `parent` dice quale completa.

Risponde quando ogni valore è stato scritto e riletto, cosa che richiede al massimo il `verify_sec` della ricetta:

```json
{"application":{"id":42,"recipe_id":"grade_a","version":3,"call_id":"9d2e4f6a8b0c1e3f","actor":"otto","source":"ui","reason":"grade A for the 2pm run","params":{"speed":250},"status":"applied","targets":[{"index":1,"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210},"status":"written","writes":[{"tag":"line-02/Zone1_SP","value":"210","status":"written"}],"verification":"verified","verify_detail":"read back 210"},{"index":2,"entity_id":"number.line_02_speed","service":"set_value","data":{"value":250},"status":"written","writes":[{"tag":"line-02/Speed","value":"250","status":"written"}],"verification":"unconfirmed","verify_detail":"not confirmed within 10s: read back 240, not 250"}],"started_at":"2026-09-28T11:05:00Z","finished_at":"2026-09-28T11:05:10Z"}}
```

Un obiettivo è `written`, `failed` (è partito e il dispositivo ha detto no, o non ha detto nulla), `not_sent`, `skipped` (uno prima di lui non è passato) o `refused` (prevalidazione). Uno scritto è `verified` quando il dispositivo ha riletto, dopo l'invio, il valore che gli era stato inviato, e `unconfirmed` quando non l'ha fatto entro `verify_sec`: è partito e potrebbe non essere stato recepito. Ogni scrittura porta il `call_id` dell'applicazione, quindi `GET /api/writes?call=<call_id>` le dà tutte.

| Stato | Quando |
|---|---|
| 200 | `applied`: ogni obiettivo scritto. Controlla la `verification` di ciascuno |
| 400 | Un parametro che la ricetta non accetta, fuori intervallo o di tipo errato; un `resume` senza nulla da applicare |
| 403 | Il permesso proprio della ricetta. Registrata come applicazione rifiutata |
| 404 | Nessuna ricetta di questo tipo, o nessuna versione di questo tipo |
| 409 | `refused`: qualsiasi motivo per non partire, ciascuno in `error` e sul suo obiettivo. Oppure un'altra applicazione sta scrivendo adesso su una delle sue entità. Non è stato scritto nulla |
| 502 | `partial` o `failed`: è partita, e non tutti gli obiettivi sono partiti. `targets` dice esattamente quali. Nulla viene annullato |

Ogni risposta tranne un `400` per un corpo malformato o un `404` porta l'applicazione, e ogni applicazione tranne una prova (dry run) è in `GET /api/recipes/{id}/applications`, compresi i rifiuti.

### `GET /api/recipes/{id}/applications`

Le sue applicazioni, dalla più recente alla più vecchia, compresi i rifiuti. `?limit=` (50 per impostazione predefinita, al massimo 1000). `parent` è ciò che l'ha applicata, quando qualcosa l'ha fatto: `automation_run:812`, `script_run:77`, `application:41`. Le applicazioni di una ricetta eliminata vengono comunque restituite.

## Blueprint

Un'automazione scritta una volta con spazi tipizzati, riempiti per creare una regola ordinaria. La regola mantiene la versione da cui è stata creata; modificare il blueprint non cambia nessuna regola, e portarne una a una versione più recente è [un aggiornamento](#post-apiautomationsidblueprint-upgrade) che qualcuno richiede. Ogni scrittura della regola passa dal gate di scrittura come `automation:<id>`. Tutto è in [Blueprint](/it/iot/blueprints/).

### `GET /api/blueprints`

Tutti i blueprint, prima quelli integrati, ciascuno con il numero di regole create da esso:

```json
[{"id":"motor_running_too_long","name":"Motor running too long","description":"Says so when a motor has been running longer than it should...","source":"builtin","version":1,"inputs":[{"name":"motor","label":"Motor","type":"entity","required":true,"domain":["motor"]},{"name":"max_run","label":"Longest it may run","type":"duration","default":3600},{"name":"stop_it","label":"Stop it as well","type":"boolean","default":false}],"template":{"triggers":[{"type":"state","entityId":{"!input":"motor"},"to":"running","forSec":{"!input":"max_run"}}],"...":"..."},"instances":2}]
```

`source` è `builtin` (incluso nel binario, sola lettura) o `user`.

### `POST /api/blueprints`

Ne scrive uno. Solo per amministratori. `id` (lettere minuscole, cifre e trattini bassi, iniziando con una lettera), `name`, `description`, `inputs` (tipizzati, come i campi di uno script) e `template`: la regola, con i suoi `description`, `triggers`, `condition`, `actions`, `mode`, `minIntervalSec` e `maxRuntimeSec`, e gli spazi che contiene. `{"!input": "motor"}` come valore viene sostituito dall'ingresso; lo stesso vale per `${motor}` in una stringa, come letterale quando la stringa è un'espressione. Viene controllato prima di essere memorizzato: ogni spazio nomina un ingresso, ogni ingresso è usato e, riempito con valori di esempio, produce una regola che compila. `201` con `version` 1. `400` per qualsiasi errore, `409` per un id già usato, compreso quello di uno integrato.

### `GET /api/blueprints/{id}`

Uno, come nell'elenco. `404` se non esiste.

### `PUT /api/blueprints/{id}`

Sostituisce la sua definizione; il corpo è lo stesso che per scriverne uno, e il suo `id` può essere omesso. Solo per amministratori. `version` sale di uno quando cambiano `inputs` o `template`, e non per un nuovo nome o una nuova descrizione. **Nessuna regola creata da esso cambia.** Ciascuna mantiene la versione da cui è stata creata, e `GET /api/automations` mostra quale. Uno integrato dà un `400`: copialo con un id tuo.

### `DELETE /api/blueprints/{id}`

Solo per amministratori. `{"deleted":"pump_watch"}`. `409` finché esiste una qualsiasi regola creata da esso, nominandole: eliminale prima. Uno integrato dà un `400`.

### `POST /api/blueprints/{id}/instantiate`

Crea una regola da esso e la arma. Gli operatori hanno `blueprints.apply`: quale pompa e per quanto tempo spetta a loro scegliere, e ciò che fa la regola è stato deciso quando il blueprint è stato scritto.

```json
{"automationId":"infeed_too_long","name":"Infeed pump ran too long","enabled":true,"inputs":{"motor":"motor.infeed_pump","max_run":"90m","stop_it":true}}
```

`name` per impostazione predefinita è quello del blueprint e `enabled` è `true`. Ogni ingresso viene controllato prima che venga creato qualcosa: un valore fuori intervallo, fuori dal suo passo, che non è una delle sue opzioni, un'entità di un altro dominio o di tipo errato dà un `400` che nomina ognuno di quelli sbagliati, e non viene mai spostato per adattarsi. Un `automationId` già usato dà un `409`: creare una regola non ne sostituisce mai una. `201` con la regola, con `blueprintId`, `blueprintVersion` e `blueprintInputs` impostati. Viene registrata come `automation made from blueprint motor_running_too_long version 1`.

**`?dry_run=true`** non crea nulla. Risponde la regola che creerebbe e cosa farebbe quella regola se scattasse ora: la condizione valutata, ogni scrittura e chiamata di servizio sottoposta ai controlli del gate come `automation:<id>`, il primo rifiuto in `check.error` con le parole del gate. Non viene memorizzato, scritto né sottoposto ad audit nulla.

```json
{"dry_run":true,"automation":{"id":"infeed_too_long","...":"..."},"check":{"automation_id":"infeed_too_long","steps":[{"step":"1","type":"log_event","verdict":"not_checked"},{"step":"2","type":"condition","input":"true","verdict":"ok","detail":"true now"},{"step":"3","type":"call_service","input":"motor.stop motor.infeed_pump {}","verdict":"would_write","detail":"would write false to line-02/M1_Run"}]}}
```

## Dashboard

Pagine di schede, per i ruoli e gli schermi che ne hanno bisogno. Una dashboard non comanda nulla: una scheda nomina un tag, un'entità, uno script o una ricetta, e il suo pulsante scrive tramite [`POST /api/write`](#post-apiwrite) come la persona che l'ha premuto. La bacheca a parete è una di queste. Tutto è in [Dashboard](/it/iot/dashboards/).

### `GET /api/dashboards`

Le dashboard offerte a chi chiama, nell'ordine in cui le mostra il selettore, bacheca a parete compresa. Chi ha `dashboards.write` se le vede offrire tutte.

```json
[{"id":"wall","name":"Wall board","description":"The tags pinned on the Board screen, as gauges.","kind":"wall","roles":[],"homeFor":[],"screens":["wall-tv"],"position":0,"cards":[],"version":2,"updatedBy":"ada"},
 {"id":"line-2","name":"Line 2","kind":"cards","roles":["operator","admin"],"homeFor":["operator"],"screens":["line-2-panel"],"position":1,"version":3,"updatedBy":"ada","cards":[{"id":"temp","type":"gauge","title":"Zone 1","w":3,"h":3,"config":{"tag":"press-01/Zone1_Temp"}}]}]
```

### `POST /api/dashboards`

Ne costruisce una. Solo per amministratori. `id` (lettere minuscole, cifre, trattini e trattini bassi, iniziando con una lettera), `name`, e facoltativamente `description`, `roles`, `homeFor`, `screens`, `position` e `cards`. `201` con `version` 1, con dimensione e configurazione di ogni scheda nella forma in cui sono state memorizzate.

Una scheda è `id`, `type`, `title`, `w` (da 1 a 12 colonne), `h` (da 1 a 8 righe) e un `config`. I tipi e le loro configurazioni sono in [Dashboard](/it/iot/dashboards/#le-schede). Viene controllata prima di essere memorizzata:

- una chiave di configurazione che il tipo non ha, un numero fuori intervallo, un indirizzo di telecamera o di planimetria con un login o un token dentro, o più di 60 schede dà un `400`;
- una scheda che nomina un tag, un'entità, uno script o una ricetta che non esiste dà un `400` che la nomina;
- un `button` su un tag non scrivibile, o con un numero fuori dall'intervallo del tag, dà un `400`: il gate rifiuterebbe ogni pressione;
- un ruolo che non esiste dà un `400`;
- un `id` già usato, uno schermo che un'altra dashboard ha già, o una home di ruolo che un'altra dashboard è già, dà un `409`.

### `GET /api/dashboards/{id}`

Una, come nell'elenco. `404` se non esiste, e anche se a chi chiama non viene offerta.

### `PUT /api/dashboards/{id}`

La sostituisce. Solo per amministratori. Il corpo è la dashboard come l'ha restituita `GET`, con `version` impostata alla versione a cui è stata letta: **è obbligatoria**, e un salvataggio che nomina una versione che non è più quella corrente dà un `409` che dice qual è quella corrente, perché l'alternativa è cancellare in silenzio ciò che l'ultima persona che ha salvato ha appena costruito. L'`id` può essere omesso dal corpo, `kind` non può cambiare, e `createdAt`, `updatedAt` e `updatedBy` sono del server e vengono ignorati. `200` con la dashboard alla versione successiva.

La bacheca a parete accetta un `PUT` per le sue assegnazioni (`roles`, `homeFor`, `screens`, `position`) e nient'altro: non ha schede, quindi una con schede dà un `400`. I suoi indicatori sono i tag della bacheca, `GET` e `PUT /api/board`.

### `DELETE /api/dashboards/{id}`

Solo per amministratori. `{"deleted":"line-2"}`. Le schede puntano a cose e non possiedono nulla, quindi nient'altro viene toccato. La bacheca a parete dà un `400`: c'è sempre.

Creazioni, salvataggi ed eliminazioni vengono registrati come eventi `config` sul soggetto `dashboard:<id>`.

### `GET /api/dashboards/{id}/export`

La dashboard come file di schermata: un documento JSON con versione che [`POST /api/dashboards/import`](#post-apidashboardsimport) carica in un'altra installazione. Risponde come un allegato chiamato `<id>.hotloop-screen.json`. Chi chiama ha bisogno di `dashboards.read` e deve vedersi offrire la dashboard, come per `GET` di una. La bacheca a parete dà un `400`: sono gli indicatori fissati di un'installazione, non un layout. Il formato è in [File di schermata](/it/iot/screen-file/).

### `POST /api/dashboards/import`

Legge un file di schermata, lo controlla rispetto a questa installazione e lo salva come nuova dashboard. Solo per amministratori, e non può salvare ciò che `POST /api/dashboards` rifiuterebbe. Il corpo è il file stesso, oppure `{"file": {...}}` con opzioni accanto:

| Opzione | <span class="sr-only">Dettagli</span> |
|---|---|
| `id`, `name` | Salvarlo con un altro id o nome. |
| `replace` | Se l'id è già usato, salvare sopra quella dashboard alla sua versione corrente. Senza, un id già usato dà un `409`. |
| `skipAssignments` | Lasciare fuori `screens` e `homeFor` del file, che appartengono all'installazione che lo ha creato. I `roles` restano. |
| `remap` | Come chiamare le cose qui: `tags` (chiave intera verso chiave intera, come il file nomina il tag o come si legge una volta che `devices` lo ha spostato), `devices` (id verso id, il che sposta anche la parte dispositivo di ogni tag non nominato in `tags`), `entities`, `scripts`, `recipes` ed `equipment` (id verso id). Una voce che nulla sullo schermo usava è un avviso. |
| `dryRun` | Rispondere con il rapporto e non salvare nulla. Sempre `200`. |
| `codesys`, `visualization` | Al posto di `file`: il testo di un'esportazione nativa CODESYS, e la visualizzazione da prendere quando ne contiene diverse. Il rapporto ha allora un `conversion` con ciò che ogni elemento è diventato e ciò che è stato lasciato fuori. Vedi [Importare una schermata CODESYS](/it/iot/codesys-screen-import/). |

La risposta è un rapporto, che sia stato salvato qualcosa o no:

```json
{"ok":false,"dryRun":true,"id":"line-2","name":"Line 2","cards":6,"replaces":false,
 "problems":[{"kind":"tag","ref":"press-01/Zone1_Temp","message":"tag press-01/Zone1_Temp does not exist here; map it to one that does, or add it on the Tags screen first"}],
 "warnings":[],"remapped":[],
 "requires":{"tags":[{"key":"press-01/Zone1_Temp","writable":false}],"entities":[],"scripts":[],"recipes":[],"devices":[],"equipment":[]}}
```

Ogni riferimento mancante è elencato, non solo il primo. Un `kind` è `file` (non è un file di schermata, il formato sbagliato, una versione di formato più recente di quella che legge questa build, o un campo che non conosce), `screen` (le regole proprie della dashboard: una scheda errata, un ruolo che non esiste, troppo grande), `tag`, `entity`, `script`, `recipe`, `device`, `equipment`, `writable` (un pulsante o setpoint su un tag non scrivibile), `assignment` (un nome di schermo o una home di ruolo che un'altra dashboard possiede) o `exists` (l'id è già usato). Un'importazione con un qualsiasi problema non salva nulla: `400`, o `409` quando l'unico problema è `exists` o `assignment`, con lo stesso rapporto. Il successo è `201`, o `200` quando ne ha sostituita una, con il rapporto e il `dashboard` salvato. Viene registrata come evento `config` sul soggetto `dashboard:<id>`.

## Webhook

### `POST /api/webhook/{path}`

Fa scattare ogni automazione con un trigger `webhook` su quel percorso. **Nessuna sessione e nessun permesso**: il percorso è il segreto dato a una terza parte, lo stesso modello di fiducia che questo endpoint ha sempre avuto, e un sistema SCADA o un callback di un SaaS non ha un account con cui accedere. Scegli un percorso che nessuno possa indovinare.

Il corpo, fino a 1 MiB, viene consegnato alla regola. `202` `{"accepted":"fill-now"}`. `404` `"no automation is listening on this webhook path"` quando non c'è nessuna: un webhook che scrive nel nulla è identico a uno che funziona, quindi lo dice.

## Flotta

Relay edge registrati, la loro presenza in tempo reale su Sparkplug e i comandi verso di essi. Richiede `HOTLOOP_FLEET_ENABLED`. Vedi [Gestione della flotta](/it/gateway/fleet/).

### `GET /api/fleet`

```json
{"configured":true,"members":[{"id":"press-relay-01","name":"Press line relay","group":"plant-a","nodeId":"press-relay-01","statusUrl":"http://press-relay-01:8081","enabled":true,"createdAt":"2026-09-27T20:28:49.448323Z","updatedAt":"2026-09-27T20:28:49.448323Z","online":false,"polled":true,"error":"Get \"http://press-relay-01:8081/status\": dial tcp: lookup press-relay-01 on 10.89.0.1:53: no such host"}]}
```

`online` deriva da NBIRTH e NDEATH. `release` è la build che il relay ha detto di eseguire nel suo ultimo birth: `version`, `imageDigest` (quando lo dice il suo supervisore; il chart Helm no) e `since`, quando il Gateway ha sentito per la prima volta quella build. Un relay troppo vecchio per riportarne una non ne ha. Per un membro con `statusUrl`, `polled` è vero e `reachable`, `forwardQueueLen`, `devices`, `connected`, `config` e `updateMode` (`auto` o `approve`) vengono dal suo `/status`; non significano nulla quando non era raggiungibile. Con la funzione disattivata: `{"members":[],"configured":false}`.

### `POST /api/fleet`

Crea o sostituisce un membro: `id`, `name`, `group` e `nodeId` (la sua identità Sparkplug) obbligatori; `description`, `statusUrl` (`http://` o `https://`) ed `enabled` facoltativi. Risponde il membro. Questo funziona con la funzione disattivata, così la flotta può essere dichiarata prima di attivarla.

### `DELETE /api/fleet/{id}`

`{"deleted":"press-relay-01"}`, oppure `404`.

### `POST /api/fleet/{id}/rebirth`

Pubblica un `Node Control/Rebirth` al relay. Nessun corpo. `{"status":"rebirth requested"}`. `404` per un membro sconosciuto.

### `POST /api/fleet/{id}/restart`

Pubblica `Node Control/Reboot`. `{"status":"restart requested"}`. Solo per amministratori: riavviare un relay gli fa perdere i dati finché non torna.

### `POST /api/fleet/{id}/update`

Approva l'aggiornamento dell'immagine che un relay tiene in attesa. Pubblica `Node Control/Update`. `{"status":"update approved"}`. Solo per amministratori: il relay esce e il suo supervisore avvia l'immagine che segue, quindi perde i dati per il tempo che serve. Fa qualcosa solo su un relay impostato su `HOTLOOP_EDGE_RELAY_UPDATE_MODE=approve`; qualsiasi altro relay registra di averlo ignorato. La richiesta non nomina nessuna immagine: non c'è dove metterla, ed è questo il punto. Vedi il [riferimento di Edge Relay](/it/edge-relay/reference/#aggiornare-un-relay).

### `POST /api/fleet/{id}/config`

Invia un nuovo file dei dispositivi al relay, che lo applica a caldo: senza riavvio, mantenendo la sessione con il broker e la coda di inoltro, e lasciando connesso ogni dispositivo che il file non ha cambiato. Il corpo è **il file dei dispositivi stesso**, JSON grezzo, non avvolto in nulla. Viene validato prima che venga pubblicato qualcosa (`400` `"invalid device file: ..."` se no). `{"status":"config pushed"}` significa che il broker lo ha preso; se il relay lo sta eseguendo lo dice `config.digest` su quel membro in `GET /api/fleet`, e un file che il relay ha rifiutato compare lì come `config.rejected`. Solo per amministratori: cambia ciò che il relay interroga. Vedi [Gestione della flotta](/it/gateway/fleet/#invio-della-configurazione).

### `DELETE /api/fleet/{id}/config`

Ritira l'invio. Cancella la configurazione trattenuta sul broker così che nessun avvio successivo la applichi, e un relay connesso proprio ora abbandona il file inviato e torna a caldo al suo file dei dispositivi locale. Nessun corpo. `{"status":"config push cleared"}`, `404` per un membro sconosciuto, `503` quando il Gateway non è connesso al broker. Solo per amministratori, come l'invio. Non riavvia nulla. Invialo mentre il relay è online: un relay offline non lo sente mai. Vedi il [riferimento di Edge Relay](/it/edge-relay/reference/#dove-sta-un-file-inviato-e-quale-file-vince).

## Notifiche

Avvisare un telefono quando scatta un allarme, tramite webhook, SMTP, ntfy o Gotify, e avvisare la persona successiva quando nessuno lo riconosce. Richiede `HOTLOOP_NOTIFY_ENABLED`.

### `POST /api/notify/test`

Invia subito una notifica di allarme sintetica attraverso ogni canale configurato, così scopri che il relay SMTP ti rifiuta prima che lo faccia un allarme vero. Nessun corpo. Richiede `HOTLOOP_NOTIFY_ENABLED`. Solo per amministratori: invia un messaggio reale e consuma la quota che il provider consente.

```json
{"results":[{"channel":"smtp","success":true}]}
```

`200` che ogni canale abbia funzionato o no; ogni risultato lo dice. Uno fallito porta `error`. Un webhook fallito nomina il suo schema e il suo host e nient'altro, perché per la maggior parte dei servizi di chiamata l'URL è la credenziale. Vedi [Notifiche degli allarmi](/it/iot/notifications/).

### `GET /api/notify/escalation`

La politica di escalation degli allarmi, i canali che un passo può nominare e le catene aperte in questo momento. `available` è `false`, con una politica disattivata e senza canali, quando `HOTLOOP_NOTIFY_ENABLED` non è impostato; la risposta resta `200`. Solo per amministratori sia in lettura sia in scrittura: la politica contiene i topic ntfy delle persone, che su un server raggiungibile da chiunque sono password.

```json
{"available":true,"policy":{"enabled":true,"minPriority":"high","contacts":[{"name":"Ana","ntfyTopic":"ana-phone-3f9c","emails":["ana@plant.test"]}],"steps":[{"afterMinutes":5,"contacts":["Ana"]},{"afterMinutes":10,"channels":["gotify"]}],"repeatEveryMinutes":15,"repeatTimes":2},"channels":["smtp","ntfy","gotify"],"active":[{"alarmId":"boiler-hi","name":"Boiler Trip","raisedAt":"2026-10-21T03:00:00Z","sent":1,"total":4,"nextAt":"2026-10-21T03:15:00Z"}],"limits":{"steps":10,"contacts":50,"repeats":20,"minutes":1440}}
```

`channels` sono quelli che questo HotLoop ha configurato, ed è tutto ciò che un passo può nominare. `active` è ogni allarme che sta percorrendo la catena: quanti invii sono partiti su quanti ne ha la politica (passi, poi ripetizioni), e quando è previsto il prossimo. Se non c'è ancora nulla di salvato è `{"policy":{"enabled":false},...}`: disattivata, senza nulla dentro.

### `PUT /api/notify/escalation`

Sostituisce l'intera politica, non è una patch, e risponde ciò che risponderebbe `GET`. Si applica agli allarmi scattati da ora in poi. `400` quando le notifiche non sono abilitate.

```json
{"enabled":true,"minPriority":"high",
 "contacts":[{"name":"Ana","ntfyTopic":"ana-phone-3f9c","emails":["ana@plant.test"]}],
 "steps":[{"afterMinutes":5,"contacts":["Ana"]},{"afterMinutes":10,"channels":["gotify"]}],
 "repeatEveryMinutes":15,"repeatTimes":2}
```

`minPriority` è `critical`, `high` (il predefinito), `medium` o `low`. Un passo scade `afterMinutes` (da 1 a 1440) dopo quello precedente, il primo dopo lo scatto, e nomina `contacts` dall'elenco, `channels` che il deployment ha, o entrambi. Al massimo 10 passi, 50 contatti e 20 ripetizioni. I campi sconosciuti vengono rifiutati.

`400` con il motivo quando la politica non può funzionare, in parole su cui si può agire: un passo che non nomina nessuno, un contatto che non è nell'elenco, un canale che questo HotLoop non ha configurato (la risposta elenca quelli che ha), un topic ntfy senza ntfy configurato o un indirizzo senza e-mail configurata, un indirizzo che non è semplice, una ripetizione senza intervallo. Non viene memorizzato nulla quando viene rifiutata. Il salvataggio compare nel log di sistema, senza i topic. Vedi [Notifiche degli allarmi](/it/iot/notifications/#escalation).

### `POST /api/notify/ack/{token}`

Il pulsante **Riconosci** di una notifica ntfy. Il telefono che lo preme non ha una sessione da inviare, quindi **nessuna sessione e nessun permesso**: il token firmato nel percorso è l'autorizzazione, e tutto ciò che autorizza è riconoscere un'occorrenza di un allarme, una volta, prima che scada (`HOTLOOP_NOTIFY_ACK_TTL`, 12 ore per impostazione predefinita). Un pulsante del viaggio di ieri non può riconoscere quello di oggi. È un `POST` di proposito: le anteprime dei link e gli scanner di sicurezza aprono i link da soli, e un allarme non deve mai essere riconosciuto da un robot. Nessun corpo. Risponde con l'allarme riconosciuto (la forma, dal gestore; gli altri esempi di questo documento sono stati catturati da un Gateway in esecuzione, questo no, perché quel Gateway non aveva ntfy):

```json
{"acknowledged":true,"alarmId":"extruder-temp-hi","name":"Extruder temperature high","state":"ack-active","ackedBy":"notify:ntfy"}
```

Con i link di riconoscimento disattivati:

```json
{"error":"acknowledge links are not enabled on this HotLoop (they need HOTLOOP_PUBLIC_URL and a channel that carries a button)"}
```

È un riconoscimento ordinario attraverso il motore degli allarmi, sottoposto ad audit sotto `notify:<channel>`. Ogni rifiuto riceve risposta e viene registrato, perché un pulsante che in silenzio non fa nulla è identico a uno che nessuno ha premuto:

| Stato | Quando |
|---|---|
| 403 | Falsificato, alterato o firmato con un altro segreto |
| 404 | L'allarme non esiste più, o i link di riconoscimento sono disattivati (richiedono `HOTLOOP_PUBLIC_URL` e un canale con un pulsante) |
| 409 | Già usato, l'allarme è scattato di nuovo da allora, o non resta nulla da riconoscere |
| 410 | Autentico, ma scaduto |
| 503 | Il riconoscimento non ha potuto essere salvato; il link viene restituito così che una seconda pressione possa ancora funzionare |

La risposta porta `Access-Control-Allow-Origin: *` così che l'app web di ntfy possa premerlo dalla propria origine; nulla su questa route legge un cookie. Il token non viene mai registrato né restituito da nessuna parte. Vedi [Notifiche degli allarmi](/it/iot/notifications/#acknowledge-links).

## Backup

Snapshot logici del database, solo dei dati delle tabelle. Richiede `HOTLOOP_BACKUP_ENABLED`. Entrambi solo per amministratori: un elenco mostra il numero di righe di ogni tabella, utenti e sessioni compresi. **Non esiste un endpoint di ripristino**, di proposito: ripristinare è un'opzione del binario, eseguita una volta da qualcuno che sa che il database è fatto per riceverlo, mai una chiamata di rete contro uno in esercizio. Vedi [Backup e ripristino](/it/iot/backup/#ripristinare-un-backup).

### `GET /api/backup`

I backup sul volume, ciascuno con il suo manifesto.

```json
{"backups":[{"name":"20260927T202912Z","bytes":98567,"manifest":{"hotloopVersion":"4.16.0","schemaMigrations":["0001_core.sql","...","0007_service_audit.sql"],"createdAt":"2026-09-27T20:29:12.970721945Z","tables":[{"name":"devices","rows":2,"columns":[{"name":"id","type":"text"},{"name":"...","type":"..."}]}]}}],"configured":true}
```

### `POST /api/backup`

Ne fa uno adesso e aspetta (fino a 30 minuti: un `tag_history` grande richiede tempo). Nessun corpo. Risponde il manifesto: versione, migrazioni, e righe e colonne di ogni tabella.

## Report pianificati

Riepiloghi dello storico in CSV e HTML, secondo una pianificazione, via e-mail o download. Richiede `HOTLOOP_REPORTS_ENABLED`. I visualizzatori leggono, gli operatori eseguono, gli amministratori definiscono: una definizione nomina dove vengono inviati per e-mail i dati dell'impianto. Vedi [Report pianificati](/it/gateway/reports/) per i campi della definizione.

### `GET /api/reports`

```json
{"configured":true,"reports":[{"id":"line1-hourly","name":"Line 1 hourly","enabled":true,"tags":[{"deviceId":"extruder-1","tagName":"Temperature"},{"deviceId":"extruder-1","tagName":"Pressure"}],"window":{"count":1,"unit":"hours","end":"run_time"},"bucket":"window","aggregations":["min","max","avg"],"schedule":{"kind":"daily","at":"06:00"},"format":"both","recipients":["shift-lead@example.com"],"retain":10,"createdAt":"2026-09-27T20:29:23.300978Z","updatedAt":"2026-09-27T20:29:23.300978Z","nextRunAt":"2026-09-28T06:00:00Z"}],"smtpConfigured":true,"timezone":"UTC"}
```

Ogni definizione porta `nextRunAt` e la sua esecuzione più recente come `lastRun`.

### `POST /api/reports`

Crea una definizione; il corpo è la definizione come sopra. `201`. `400` se la validazione fallisce (`"report line1-hourly: window end \"now\" must be run_time or local_midnight"`), `409` se l'id esiste.

### `GET /api/reports/{id}`

Una definizione, come nell'elenco. `404` per una sconosciuta.

### `PUT /api/reports/{id}`

Sostituisce l'intera definizione. L'id non può cambiare (`400` se quello del corpo è diverso). `nextRunAt` e `lastRun` vengono accettati e ignorati, così puoi rimandare ciò che hai letto.

### `DELETE /api/reports/{id}`

La elimina con le sue esecuzioni e i suoi file, annullando un'esecuzione in corso. `{"deleted":"line1-hourly"}`, oppure `404`.

### `POST /api/reports/{id}/run`

La esegue adesso e aspetta. `?deliver=false` la genera e la memorizza senza inviare e-mail a nessuno, per provare una definizione. `200` significa che l'esecuzione è avvenuta; il suo `status` dice se il report ha funzionato. Un'esecuzione che fallisce è un risultato, non una richiesta errata, e viene registrata in entrambi i casi.

```json
{"id":1,"reportId":"line1-hourly","trigger":"manual","actor":"admin","status":"succeeded","startedAt":"2026-09-27T20:29:54.06926Z","finishedAt":"2026-09-27T20:29:54.092456655Z","windowStart":"2026-09-27T19:29:54.06926Z","windowEnd":"2026-09-27T20:29:54.06926Z","tags":2,"rows":2,"readings":984,"excluded":2,"files":[{"format":"csv","name":"20260927T202954Z-1.csv","bytes":338},{"format":"html","name":"20260927T202954Z-1.html","bytes":2430}],"emailStatus":"skipped","emailTo":["shift-lead@example.com"]}
```

`400` per un `deliver` che non sia true o false, `404` per un report sconosciuto.

### `GET /api/reports/{id}/runs`

`{"runs": [...]}`, dalla più recente, `?limit=` 50 per impostazione predefinita, al massimo 500. `404` per un report sconosciuto, non un elenco vuoto.

### `GET /api/reports/{id}/runs/{run}/download`

Trasmette un file memorizzato come allegato. `?format=csv` oppure `html`.

```
HTTP/1.1 200 OK
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="20260927T202954Z-1.csv"
Cache-Control: private, no-store

device_id,tag_name,unit,period_start,period_end,min,max,avg,excluded
extruder-1,Temperature,C,2026-09-27T19:29:54+00:00,2026-09-27T20:29:54+00:00,19.50001230192043,23.499980145373126,21.508905654397623,1
```

L'HTML viene servito con una Content-Security-Policy `sandbox`: un report è un documento da leggere, non una pagina a cui è permesso eseguire qualcosa. Il file aperto è quello che nomina il record dell'esecuzione; nulla nell'URL diventa parte di un percorso. `400` per un numero di esecuzione che non lo è o un formato che non è nessuno dei due, `404` per un'esecuzione o un file che non esiste.

## Siti

### `GET /api/sites`

Ogni sito che il Gateway federa, interrogato sul suo stato dell'impianto via MCP in parallelo, 6 secondi ciascuno, così un sito morto non blocca gli altri. I siti sono i server MCP in uscita nella configurazione. Vedi [MCP](/it/iot/mcp/#federating-sites).

```json
{"configured":true,
 "rollup":{"sites":2,"reachable":1,"devices":2,"connected":2,"tags":5,"outstandingAlarms":1,"unacknowledgedAlarms":1,"criticalAlarms":0},
 "sites":[{"name":"plant-a","reachable":true,"latencyMs":14,"plant":"Demo Plant","uptime":"1m25s","devices":2,"connected":2,"degraded":0,"disconnected":0,"tags":5,"outstandingAlarms":1,"unacknowledgedAlarms":1,"criticalAlarms":0,"writesEnabled":true},
          {"name":"plant-c","reachable":false,"error":"connect to MCP server \"plant-c\": calling \"initialize\": ... no such host","latencyMs":49,"devices":0,"connected":0,"degraded":0,"disconnected":0,"tags":0,"outstandingAlarms":0,"unacknowledgedAlarms":0,"criticalAlarms":0,"writesEnabled":false}]}
```

I conteggi di un sito irraggiungibile non significano nulla e vengono lasciati fuori dal totale: contare come zero allarmi un sito che non si può raggiungere sarebbe la cosa più pericolosa che questa schermata potrebbe fare. Senza siti configurati: `{"configured":false,"sites":[]}`.

## Impostazioni

### `GET /api/settings`

Ogni impostazione, il suo valore effettivo, da dove viene il valore e la variabile che lo imposta:

```json
{"groups":["Plant","Safety","Polling","Historian","Database","MCP","Server"],
 "settings":[{"key":"ui.plantName","group":"Plant","label":"Plant name","help":"...","value":"Demo Plant East","kind":"string","source":"stored","envVar":"HOTLOOP_PLANT_NAME","editable":true},
             {"key":"safety.allowWrites","group":"Safety","label":"Writes allowed","help":"...","value":true,"kind":"bool","source":"environment","envVar":"HOTLOOP_ALLOW_WRITES","editable":false},
             {"key":"database.password","group":"Database","label":"Password","help":"Never shown. It comes from the release Secret.","value":"set","kind":"secret","source":"environment","envVar":"HOTLOOP_DB_PASSWORD","editable":false}]}
```

`source` è `stored`, `environment` o `default`. Un `secret` è solo `set` o `not set`. `envVar` è la variabile da cui è venuto il valore. Alcune impostazioni ripiegano su una seconda variabile quando quella `HOTLOOP_` è vuota (`TZ` per il fuso orario, `POSTGRES_HOST`, `POSTGRES_DB`, `POSTGRES_USER` e `POSTGRES_PASSWORD` per il database), e quando è in vigore il ripiego, `envVar` lo nomina. Una variabile impostata su una stringa vuota conta come non impostata, come la tratta la configurazione. Le impostazioni di polling sono mostrate in millisecondi, ma le loro variabili accettano una durata (`5s`, `500ms`) o un semplice numero di secondi.

`product` nel gruppo `Server` dice di quale HotLoop si tratta. Una funzione che questo prodotto non ha e che il deployment ha attivato comunque (per esempio `HOTLOOP_REPORTS_ENABLED=true` su IoT) non ne impedisce l'avvio. Viene registrata come avviso all'avvio ed elencata qui in un gruppo aggiuntivo, `Not in this product`, con la sua variabile e una riga che dice dove si trova. L'impostazione viene lasciata esattamente com'è, così la stessa configurazione su un prodotto che ha la funzione la attiva. Se non è impostato nulla del genere, il gruppo non c'è.

### `PUT /api/settings`

Modifica le impostazioni di identità dell'impianto, e solo quelle:

| Chiave | Tipo |
|---|---|
| `ui.plantName` | stringa, al massimo 200 caratteri |
| `ui.siteId` | stringa, al massimo 200 caratteri |
| `ui.timezone` | un nome IANA che questa macchina conosce (`America/Chicago`) |
| `ui.confirmWrites` | bool |
| `ui.kioskIdleSeconds` | un numero intero di secondi, da 10 a 43200: quanto sopravvive l'accesso di un chiosco senza che nessuno tocchi il pannello. Predefinito 900 |
| `ui.lockoutAttempts` | un numero intero, da 0 a 100: password o PIN errati di fila che bloccano un account. Predefinito 10, e 0 significa nessun blocco |
| `ui.panelDelaySeconds` | un numero intero di secondi, da 0 a 30: il massimo che un pannello di chiosco attende prima di controllare il PIN successivo digitato senza nome utente, dopo quelli errati. Predefinito 3, e 0 significa nessuna attesa |
| `ui.lockoutSeconds` | un numero intero di secondi, da 10 a 86400: quanto resta bloccato un account bloccato. Predefinito 300 |

```json
{"ui.plantName":"Demo Plant East","ui.timezone":"America/Chicago"}
```

Risponde con tutte le impostazioni, come fa `GET`. Qualsiasi altra chiave dà un 400 che la nomina:

```json
{"error":"safety.allowWrites is set by the deployment and cannot be changed here"}
```

È voluto. Gli interruttori di scrittura decidono se questo processo può muovere macchinari, e un controllo che si può attivare dallo stesso browser che emette le scritture non è un controllo. Cambiarli è un deployment.

## Destinazioni dello storico

I database propri dell'impianto, nei quali HotLoop scrive il suo storico oltre che nel proprio. Vedi [Destinazioni dello storico](/it/iot/historian-targets/). Ogni ruolo che legge le impostazioni le vede e vede come sta andando ciascuna. Modificarne una è solo per amministratori, perché una destinazione è un posto dove vanno i dati dell'impianto. Le password sono sigillate con la chiave delle credenziali dei dispositivi (`HOTLOOP_SECRET_KEY_FILE`) e non vengono mai restituite; `passwordSet` dice se ne è memorizzata una, e `passwordProblem` perché una memorizzata non può essere aperta. Ogni modifica va nel log e ha effetto subito.

### `GET /api/historian/targets`

```json
{"secretKey":true,
 "kinds":[{"id":"postgres","title":"PostgreSQL or TimescaleDB","defaultPort":5432,"defaultTable":"hotloop_history",
    "databaseLabel":"Database","tableLabel":"Table","passwordLabel":"Password","usesUsername":true,"usesOrg":false},
   {"id":"sqlserver","title":"Microsoft SQL Server","defaultPort":1433,"defaultTable":"hotloop_history",
    "databaseLabel":"Database","tableLabel":"Table","passwordLabel":"Password","usesUsername":true,"usesOrg":false},
   {"id":"mysql","title":"MySQL or MariaDB","defaultPort":3306,"defaultTable":"hotloop_history",
    "databaseLabel":"Database","tableLabel":"Table","passwordLabel":"Password","usesUsername":true,"usesOrg":false},
   {"id":"influxdb","title":"InfluxDB 2 or 3","defaultPort":8086,"defaultTable":"hotloop_history",
    "databaseLabel":"Bucket (InfluxDB 3: database)","tableLabel":"Measurement","passwordLabel":"API token",
    "usesUsername":false,"usesOrg":true}],
 "targets":[{"id":"plant-pg","name":"Plant historian","kind":"postgres","address":"db.plant.local:5432",
   "database":"plant","username":"hotloop","table":"hotloop_history","useTls":true,"insecureSkipVerify":false,
   "enabled":true,"createdBy":"admin","passwordSet":true,"createdAt":"2026-10-03T09:12:04Z","updatedAt":"2026-10-03T09:12:04Z",
   "status":{"state":"down","since":"2026-10-03T10:02:11Z","queued":50000,"queueCap":50000,"written":182340,
     "backfilled":0,"dropped":1210,"refused":0,"lastWrite":"2026-10-03T10:02:10Z",
     "lastError":"failed to connect to `user=hotloop database=plant`: dial tcp 10.20.0.9:5432: connect: connection refused",
     "owedFrom":"2026-10-03T10:02:09Z"}}]}
```

`kinds` sono i database su cui scrive questo HotLoop, e come ciascuno chiama i suoi campi: InfluxDB ha un token dove gli altri hanno una password (`password` lo porta), un bucket dove hanno un database (`database`), una misura dove hanno una tabella (`table`), e un'organizzazione (`org`) che nessuno degli altri ha. `status.state` è `up`, `catching-up` (attiva, e ancora impegnata a inviare ciò che le è dovuto dallo storico proprio di HotLoop), `down`, `starting` oppure `off` (disattivata). `queued` è ciò che attende in memoria, su `queueCap`. `written` conta le letture inviate in tempo reale e `backfilled` quelle inviate dallo storico proprio di HotLoop. `dropped` conta le letture che la coda ha lasciato cadere mentre la destinazione non riusciva a tenere il passo: sono dovute, non perse. `refused` conta le letture che il database stesso non ha voluto prendere, con il suo motivo in `lastRefusal`. `owedFrom` e `owedTo` sono ciò che è ancora dovuto; `owedTo` manca finché la fine è ancora aperta, il che vale finché la destinazione è giù.

### `POST /api/historian/targets`

```json
{"id":"plant-pg","name":"Plant historian","kind":"postgres","address":"db.plant.local","database":"plant",
 "username":"hotloop","password":"...","useTls":true}
```

`id` è da 1 a 63 lettere minuscole, cifre e `-`, e nomina la destinazione nel log di sistema. `address` è `host` o `host:port`, senza login dentro; la porta predefinita del tipo riempie una mancante. `table` per impostazione predefinita è il `defaultTable` del tipo e può portare uno schema (`history.hotloop`). `org` è l'organizzazione di InfluxDB 2. `enabled` per impostazione predefinita è true. Una password ha bisogno di una chiave: senza `HOTLOOP_SECRET_KEY_FILE` è un `400`, mai memorizzata in chiaro. `201` con la destinazione e il suo stato; `409` per un id già usato.

### `PUT /api/historian/targets/{id}`

Uno qualsiasi dei campi sopra tranne `id`; ciò che non viene inviato resta. `"password":""` cancella la password. Una modifica riavvia la destinazione con le sue nuove impostazioni, e ciò che le era dovuto resta dovuto. `200` con la destinazione.

### `DELETE /api/historian/targets/{id}`

Smette di scrivervi e dimentica ciò che le era dovuto. Ciò che contiene già resta nel suo database. Disattivala invece con `"enabled":false` per mantenere le impostazioni. `200` `{"deleted":"plant-pg"}`.

## Log di sistema

### `GET /api/events`

Ogni modifica, scrittura, accesso e transizione di connessione, dal più recente.

| Query | <span class="sr-only">Dettagli</span> |
|---|---|
| `category` | Ripetibile: `system`, `device`, `tag`, `write`, `alarm`, `automation`, `mcp`, `config`, `auth` |
| `severity` | Ripetibile: `debug`, `info`, `warning`, `error` |
| `subject` | Esattamente: un id di dispositivo, una chiave di tag, un entity_id, `equipment:4`, `label:critical` |
| `q` | Ricerca senza distinzione tra maiuscole e minuscole |
| `minutes` | Solo gli ultimi N minuti |
| `limit` | 200 per impostazione predefinita, al massimo 5000 |

```json
[{"id":61,"at":"2026-09-27T20:29:23.303795Z","severity":"info","category":"config","subject":"line1-hourly","actor":"admin","message":"report created"}]
```

`actor` è un utente, `system`, `automation:<id>` o `mcp:<client>`. `detail`, quando c'è, è JSON aggiuntivo come stringa.

## Registro eventi

### `GET /api/logbook`

Un'unica cronologia di ciò che è successo, dal più recente: cambi di stato delle entità, scritture, transizioni degli allarmi, esecuzioni di automazioni e script, e cambi di configurazione e chiamate di servizio dal log di sistema. Le tracce vengono lette dove sono e unite, quindi ciascuna mantiene la propria conservazione. Le letture numeriche non ci sono: è a questo che serve `GET /api/history`. Vedi [il registro eventi](/it/iot/logbook/).

| Query | <span class="sr-only">Dettagli</span> |
|---|---|
| `entity` | Solo ciò che riguarda questa entità: i suoi cambi di stato, le scritture su di essa e sui suoi tag, i suoi allarmi, le esecuzioni di automazioni che attiva o che hanno scritto su di essa, i cambi di configurazione che la riguardano |
| `equipment_id` | Solo ciò che è successo a questo nodo dell'albero delle apparecchiature o sotto di esso, con la stessa regola. Non insieme a `entity` |
| `actor` | Parte, senza distinzione tra maiuscole e minuscole, di chi lo ha fatto: un utente, `automation:<id>`, `mcp:<client>` |
| `kinds` | Separati da virgole o ripetuti: `state`, `write`, `alarm`, `automation`, `event`, `script`, `recipe` |
| `from`, `to` | Orari RFC 3339; `from` incluso, `to` escluso |
| `limit` | 100 per impostazione predefinita, al massimo 1000 |
| `before` | Il `next` della pagina precedente |

```json
{"entries":[
  {"at":"2026-09-28T09:14:02.51Z","kind":"state","id":41,"severity":"info","message":"changed to on (was off)","entity_id":"switch.tank_farm_pump","old_state":"off","state":"on","quality":"good"},
  {"at":"2026-09-28T09:14:02.18Z","kind":"write","id":88,"severity":"info","message":"wrote true to tank-farm/pump (switch.turn_on on switch.tank_farm_pump) (was 0)","actor":"admin","source":"ui","entity_id":"switch.tank_farm_pump","device_id":"tank-farm","tag":"tank-farm/pump","call_id":"5c9f8545a93b5443"},
  {"at":"2026-09-28T09:13:40.02Z","kind":"state","id":37,"severity":"info","message":"changed to closed (was open); 14 changes before this not logged, it was changing faster than the logbook records","entity_id":"valve.infeed","old_state":"open","state":"closed","quality":"good","suppressed":14}
 ],
 "next":"MjAyNi0wOS0yOFQwOToxMzo0MC4wMlp8c3RhdGV8Mzc"}
```

`id` è l'id della riga nella sua traccia (per un cambio di stato, l'id immutabile dell'entità), e con `at` e `kind` è ciò che `next` codifica: la pagina successiva è tutto ciò che è strettamente più vecchio in quell'ordine, qualunque cosa sia stata aggiunta nel frattempo. `next` è omesso sull'ultima pagina. `suppressed` è quanti cambi di quell'entità precedenti a questo non sono stati registrati, perché cambiava più velocemente di dieci alla volta e poi uno ogni due secondi.

`400` per un tipo sconosciuto, un orario malformato, `from` non prima di `to`, un limite oltre 1000, un cursore inventato, o `entity` ed `equipment_id` insieme; `404` per un nodo che non esiste. `503` quando il registro eventi non è in esecuzione nel processo che risponde.

## Flusso in tempo reale

### `GET /api/stream`

Server-sent events, a senso unico, finché lo tieni aperto. SSE invece di un WebSocket perché il traffico va solo in un senso, e un flusso di eventi si riconnette da solo quando il pod si riavvia sotto una dashboard aperta. `EventSource` invia il cookie di sessione; uno script invia il token bearer.

Alla connessione ricevi `retry: 3000` e poi il quadro attuale, così uno schermo è popolato prima che cambi qualcosa:

```
retry: 3000

event: snapshot
data: [{"deviceId":"extruder-1","protocol":"opcua","tagName":"Temperature","tagValue":19.553128777917983,"unit":"C","quality":"good","timestamp":"2026-09-27T20:34:23.619589Z"}]

event: alarms
data: {"alarms":[...outstanding alarms...],"summary":{"critical":0,"high":1,"medium":0,"low":0,"unacked":0,"total":1}}

event: entities
data: {"changed":[...every entity state...],"removed":[]}
```

Poi, man mano che le cose accadono:

| Evento | Dati | Quando |
|---|---|---|
| `values` | Un array di letture, la forma di `GET /api/values`, la più recente per tag, **solo i tag la cui lettura è cambiata** | Ogni 250 ms, se qualcuno è cambiato. Un tag il cui valore, testo, unità, qualità e motivo sono gli stessi dell'ultimo inviato viene lasciato fuori, e reinviato una volta che sono passati 30 secondi senza invio, così il `timestamp` di un valore stabile non è mai più vecchio di così. Un driver legge ogni tag a ogni polling; la 4.19.5 li inviava tutti ogni volta (circa 150 KB quattro volte al secondo per i 2232 tag di un tester) e una pagina su un collegamento lento restava indietro di minuti |
| `entities` | `{"changed": [states], "removed": [entity_ids]}` | Ogni 250 ms, se lo stato di qualche entità è cambiato. `removed` è un'entità disabilitata, eliminata o rinominata |
| `alarm` | `{"alarm": {...}, "event": "shelved"}`, l'allarme e ciò che gli è successo (`raised`, `acked`, `cleared`, `shelved`, `unshelved`, `suppressed`, `unsuppressed`) | Subito: le transizioni degli allarmi sono rare e ognuna conta |
| `device` | `{"deviceId":"tank-farm","state":"connected"}` | Subito: lo schermo deve diventare rosso quando un dispositivo cade, non al prossimo invio |
| `logbook` | `{"kinds":["state","write"]}`, quali tipi di voce del registro eventi hanno qualcosa di nuovo | Al massimo una volta al secondo. Senza voci dentro, perché ciò che uno schermo deve mostrare dipende dai suoi filtri: chiede a `GET /api/logbook` la propria pagina |

```
event: alarm
data: {"alarm":{"definitionId":"extruder-temp-hi","state":"shelved","shelvedUntil":"2026-09-27T20:39:45.839983854Z","shelvedBy":"admin","...":"..."},"event":"shelved"}

event: device
data: {"deviceId":"tank-farm","state":"connected"}
```

Una riga di commento (`: heartbeat 2026-09-27T20:35:00Z`) ogni 20 secondi impedisce ai proxy di chiudere una connessione inattiva. Ogni pagina aperta ha il proprio ritmo: il suo scrittore riposa quanto è durato il suo ultimo invio (al massimo cinque secondi), e ciò che arriva nel frattempo viene trattenuto per tag e per entità, solo il più recente, così una pagina su un collegamento lento resta indietro di uno o due invii rispetto all'impianto, mai di minuti, non perde nulla e non toglie nulla alle altre pagine. Il flusso è compresso con gzip quando la richiesta dice `Accept-Encoding: gzip` (un browser lo fa), il che porta il primo quadro di un tester da circa 326 KB a circa 11 KB sul cavo. La risposta imposta `X-Accel-Buffering: no`, perché un proxy che fa buffering trasforma un flusso in tempo reale in un download lentissimo.

Il flusso riguarda di nuovo la sua sessione ogni cinque secondi e si chiude quando la sessione non c'è più: disconnessa, scaduta, revocata, o con l'account disabilitato o non più autorizzato a `status.read`. Non invia nessun evento prima. L'`EventSource` di un browser si riconnette, riceve il `401` di cui sopra e si ferma. Con `HOTLOOP_AUTH_INSECURE=true` non c'è sessione e nulla da controllare. Il controllo non conta come uso della sessione, quindi uno schermo lasciato aperto non mantiene fresca una sessione.

## MCP

### `/mcp` e `/mcp/`

Il Model Context Protocol, trasporto HTTP in streaming, per gli agenti. Qualsiasi metodo: il trasporto usa `POST` per le chiamate, `GET` per il flusso proprio del server e `DELETE` per terminare una sessione. Il percorso è `HOTLOOP_MCP_PATH` (`/mcp` per impostazione predefinita) e l'endpoint c'è solo quando `HOTLOOP_MCP_ENABLED` è attivo.

**Non** è dietro il login di sessione. Ha un proprio token bearer, `HOTLOOP_MCP_TOKEN`, controllato davanti al gestore così che un chiamante senza di esso non possa nemmeno elencare gli strumenti:

```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="hotloop"

unauthorized
```

Senza token configurato, HotLoop ne crea uno al primo avvio e lo tiene nel suo database (`hotloop mcp-token` lo stampa), così l'endpoint non è mai aperto. Un agente è un chiamante come un altro: legge e scrive, le sue scritture passano dallo stesso gate di scrittura di tutti, e sono sottoposte ad audit come `mcp:<client name>`. Gli strumenti e le risorse sono in [MCP](/it/iot/mcp/).

```
POST /mcp
Authorization: Bearer <token>
Accept: application/json, text/event-stream

{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1"}}}
```

risponde con un'intestazione `Mcp-Session-Id` e le capacità e le istruzioni del server.

## L'interfaccia

### `GET /manifest.webmanifest`

Il manifest dell'app web che permette a un telefono di installare l'interfaccia come app: il nome del prodotto e dell'impianto, `display` `standalone`, i colori del tema, le icone (PNG da 192 e 512 pixel, una 512 maskable e l'SVG) e le scorciatoie ad Allarmi e Dashboard. Ogni URL al suo interno è relativo a quello del manifest stesso, quindi è giusto ovunque sia montato HotLoop. Il nome segue il nome dell'impianto impostato in Impostazioni, e la risposta è `Cache-Control: no-cache` così che una ridenominazione si veda alla prossima occhiata. Nessuna sessione: un telefono chiede prima che qualcuno abbia effettuato l'accesso. Vedi [Dashboard](/it/iot/dashboards/#su-un-telefono).

### `GET /sw.js`

Il service worker, alla radice di dove è montato HotLoop così che il suo ambito copra l'intera app. Conserva la pagina e l'ultima risposta alle letture che una persona guarda, e le restituisce contrassegnate come vecchie quando HotLoop non è raggiungibile. Non risponde, non conserva né mette mai in coda una scrittura. La versione in esecuzione è al suo interno, così ogni release ha una cache di pagine propria. `Cache-Control: no-cache`; nessuna sessione. Lo esegue solo un browser in un contesto sicuro (https, o `localhost`).

### `GET /next` e `GET /next/`

Dove viveva l'interfaccia quando quella vecchia era la predefinita. Entrambi sono un `301` alla radice, così un segnalibro fatto allora arriva ancora.

### `/`

L'interfaccia web, compilata da `web/` nel binario: una pagina, i suoi script, stili e font, un service worker e le icone dell'app installabile, ogni URL al loro interno relativo alla pagina così che giri alla radice di un host, sotto un percorso, dietro un proxy o dentro l'iframe della dashboard EmberNet. Il server riempie il titolo e un blocco di dati, `<script type="application/json" id="iiot">`, con ciò che solo lui sa: l'impianto, il sito, il prodotto, le funzioni, la politica di scrittura e il fuso orario. Solo `GET` e `HEAD`; qualsiasi altro metodo è `405`. Un percorso che non è uno dei suoi file è un `404`, perché servire la pagina per un errore di battitura la farebbe sembrare una schermata funzionante, e un binario compilato senza l'interfaccia lo dice in testo semplice e come compilarla. Nessuna sessione: la pagina è il modulo di login finché non accedi.
