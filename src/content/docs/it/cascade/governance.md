---
title: "Governare un'istanza di Cascade"
description: "Variabili, cartelle, esecuzioni annotate, oscuramento, insights, segreti esterni e invio dei log, per uno stabilimento con sempre più flussi di lavoro."
---

Come uno stabilimento tiene sotto controllo una pila crescente di flussi di lavoro: impostazioni condivise, cartelle, esecuzioni annotate, oscuramento, numeri nel tempo, segreti esterni, invio dei log e dove vivono i dati di grandi dimensioni. Tutto questo è gratuito ed è in ogni build.

Ogni endpoint citato qui sotto è nel documento OpenAPI in `/api/v1/openapi.json`, e per ognuno esiste un test che lo chiama, su SQLite e su Postgres.

## Variabili

Nell'editor: Variabili, nella barra in alto. Quelle valide per tutta l'istanza sono in cima, e quelle di ogni progetto sotto il suo nome. Viene offerto solo ciò che il vostro ruolo consente.

Una variabile è un valore con nome che un flusso di lavoro legge come `vars.NAME`: un limite di setpoint, il nome di uno stabilimento, un URL di base che differisce tra la linea pilota e quella vera.

```yaml
- name: Check limit
  type: core.if
  version: 1
  params:
    condition: "{{ item.json.temp > toNumber(vars.TEMP_LIMIT) }}"
```

- Una variabile è **valida per tutta l'istanza** o appartiene a **un progetto**. Quando entrambe hanno un nome, vince quella del progetto, e solo per i flussi di lavoro di quel progetto.
- Un valore è testo, fino a 8 KiB. Si usa `toNumber(vars.X)` quando serve un numero.
- Un nome è fatto di lettere, cifre e trattini bassi, inizia con una lettera o un trattino basso ed è lungo al massimo 64 caratteri, perché deve leggersi come `vars.NAME`.
- **Le variabili non sono segreti.** Chiunque possa leggere il progetto ne legge le variabili, e il valore non viene rimosso dai dati di esecuzione. Una password, un token o una chiave vanno nel deposito delle credenziali, o in un archivio di segreti esterno (più avanti).
- Un'esecuzione legge le sue variabili all'avvio, e di nuovo se riprende dopo un'attesa o un riavvio. Una modifica raggiunge l'esecuzione successiva, non una già nel mezzo di un passaggio. Un nome che non c'è si legge come niente, non come un errore.

| Chiamata | Che cosa fa |
|---|---|
| `GET /api/v1/variables` | Le variabili dell'istanza e quelle dei progetti che si possono leggere; `?project=` restringe a un progetto. |
| `POST /api/v1/variables` | Ne crea una. Con `projectId` è del progetto, senza è valida per tutta l'istanza. |
| `PUT /api/v1/variables/{variable}` | Ne cambia il nome e il valore. |
| `DELETE /api/v1/variables/{variable}` | La elimina. |

Chi può: in un progetto, l'autorizzazione `variable.read` le elenca e `variable.create`, `variable.update` e `variable.delete` le modificano. I viewer e gli operator leggono, gli editor e gli admin modificano. Le variabili valide per tutta l'istanza le legge chiunque abbia effettuato l'accesso, perché il flusso di lavoro di qualsiasi progetto può leggerle, e solo un proprietario o amministratore dell'istanza le modifica. Un ruolo personalizzato può avere una qualsiasi di queste quattro autorizzazioni. Le modifiche sono nel registro di controllo come `variable.created`, `variable.updated` e `variable.deleted`, con il nome e mai il valore.

## Cartelle

Nell'editor: l'elenco dei flussi di lavoro sono le cartelle. Se ne crea una con Nuova cartella, la si annida con Aggiungi sottocartella, e si sposta un flusso di lavoro dalla sua riga nell'elenco. Scegliere una cartella quando si crea un flusso di lavoro lo mette lì.

Le cartelle raggruppano i flussi di lavoro di un progetto e si annidano, come è organizzato uno stabilimento: area, linea, cella.

- Una cartella è in un solo progetto. I nomi sono unici tra le cartelle adiacenti, e un nome è lungo al massimo 100 caratteri.
- Le cartelle si annidano fino a 10 livelli.
- Un flusso di lavoro è in una cartella o in cima al suo progetto. Salvare una nuova versione non lo sposta.
- Una cartella che contiene flussi di lavoro o cartelle non può essere eliminata (409), quindi eliminare una cartella non è mai il modo in cui un flusso di lavoro va perso. Una cartella non può essere spostata dentro se stessa o dentro una delle sue sottocartelle, e non può essere spostata in un altro progetto.

| Chiamata | Che cosa fa |
|---|---|
| `GET /api/v1/folders` | Le cartelle dei progetti che si possono leggere, in piano, ognuna con il suo `parentId`; `?project=` restringe. |
| `POST /api/v1/folders` | Ne crea una in `projectId`, dentro `parentId` o in cima. |
| `PATCH /api/v1/folders/{folder}` | La rinomina, o la sposta con `parentId` (stringa vuota per la cima). |
| `DELETE /api/v1/folders/{folder}` | Elimina una cartella vuota. |
| `PUT /api/v1/workflows/{workflow}/folder` | Mette un flusso di lavoro in una cartella, o in cima con un `folderId` vuoto. |
| `GET /api/v1/workflows?folder=` | I flussi di lavoro di una cartella, o `folder=none` per la cima di ogni progetto. |

Ogni flusso di lavoro restituito dall'API indica il suo `folderId`. Le autorizzazioni `folder.read`, `folder.create`, `folder.update` e `folder.delete` funzionano come quelle delle variabili, e spostare un flusso di lavoro richiede `workflow.update`. Le modifiche alle cartelle sono nel registro di controllo, e gli spostamenti come `workflow.moved`.

## Annotazioni delle esecuzioni

Nell'editor: la pagina di ogni esecuzione ha una casella Annotazione con un pollice su o giù, una nota e dei tag, e l'elenco delle esecuzioni filtra per tag e per voto.

Una persona può dire qualcosa su un'esecuzione dopo che è avvenuta: un pollice su o giù, una nota e dei tag per ritrovarla. "Primo lotto buono dopo il cambio dello stampo" e `scrap` sono il genere di cose che vanno qui.

```sh
curl -X PUT $CASCADE/api/v1/executions/$RUN/annotation -H "Authorization: Bearer $KEY" \
  -d '{"vote":"up","note":"first good batch after the die change","tags":["die-change","first-shift"]}'
```

- Un voto è `up`, `down` o vuoto. Una nota è lunga al massimo 2000 caratteri. Un'esecuzione ha fino a 20 tag, ciascuno da 1 a 40 caratteri senza caratteri di controllo, elencati una volta sola.
- `PUT` sostituisce l'intera annotazione, quindi si invia tutto ciò che si vuole conservare. Un'annotazione che non dice nulla equivale a nessuna. `DELETE /api/v1/executions/{execution}/annotation` la cancella.
- Ogni esecuzione restituita dall'API porta la sua annotazione, e l'elenco la porta su ogni riga. `GET /api/v1/executions?tag=scrap` e `?vote=down` filtrano, e si combinano con gli altri filtri.
- L'annotazione registra chi l'ha lasciata e quando, dalla stessa identità che usa il registro di controllo.
- Annotare richiede l'autorizzazione `execution.annotate`, che hanno gli operator, gli editor e gli admin e non i viewer. I viewer leggono le annotazioni.
- Un'annotazione sparisce quando la sua esecuzione viene eliminata. Il registro di controllo conserva `execution.annotated` e `execution.annotation_cleared` con il voto e i tag, e registra solo che è stata lasciata una nota, non ciò che diceva.

## Conservare le esecuzioni concluse

Nell'editor: Impostazioni, Conserva le esecuzioni concluse per (giorni). Tramite l'API: `PATCH /api/v1/settings` con `{"retentionDays": 90}`, che richiede l'autorizzazione `instance.settings` come il resto delle impostazioni.

Per impostazione predefinita ogni esecuzione conclusa viene conservata per sempre, come è sempre stato. Si imposta un numero di giorni e un main elimina, una volta all'ora, le esecuzioni concluse (riuscite, fallite o annullate) che sono finite da più tempo di così, con i dati dei loro passaggi. 0 lo disattiva di nuovo.

- Un'esecuzione in coda, in corso o in attesa non viene mai toccata, né un'esecuzione il cui genitore è ancora in corso, perché il genitore chiederà che cosa ha fatto.
- Ogni lotto di al massimo 500 esecuzioni è una transazione a sé e scrive una riga `execution.pruned` nel registro di controllo, con quante sono state eliminate e la data limite. Cambiare l'impostazione scrive `instance.retention`.
- Ogni main esegue il passaggio, e due insieme trovano soltanto meno da fare.
- La pulizia dei blob segue lo stesso passaggio, e gira una volta all'ora che la conservazione sia attiva o no, così anche un'esecuzione eliminata a mano viene ripulita. Vedere "Pulizia dei blob" più avanti.

## Limitare una chiave API

Nell'editor: Impostazioni, Richieste API per chiave al minuto. Tramite l'API: `PATCH /api/v1/settings` con `{"apiRateLimit": 120}`, con l'autorizzazione `instance.settings`.

Per impostazione predefinita una chiave può chiamare tanto spesso quanto vuole. Si imposta un numero e ogni chiave API, e ogni agente che ha effettuato l'accesso tramite MCP con una di esse, può fare quel numero di richieste al minuto. Una chiamata oltre il limite riceve un `429` con un'intestazione `Retry-After` che indica quanti secondi attendere. Ogni chiave ha il proprio conteggio, quindi uno script impazzito non può consumare quello di un'altra. Le persone che hanno effettuato l'accesso all'editor non ne sono soggette.

Il conteggio è di ogni processo, perché è questo che protegge il processo: con tre main, una chiave può fare fino al triplo di quel numero, distribuito tra loro. Una modifica dell'impostazione raggiunge ogni main entro cinque secondi. Cambiarla scrive `instance.api_rate_limit` nel registro di controllo, con il vecchio e il nuovo numero.

Un webhook ha un proprio limite, impostato sul trigger, e un account si blocca dopo ripetute password errate; nessuno dei due cambia.

## Backup e ripristino

```
hotloop-cascade backup /backups/2026-11-20
hotloop-cascade restore /backups/2026-11-20
```

`backup` scrive una nuova directory con una copia coerente del database SQLite (presa mentre il server è in funzione, con `VACUUM INTO`), il file di chiave che sigilla ogni credenziale salvata, i file dei blob e `manifest.json` con lo SHA-256 di ciascuno. Accetta le stesse impostazioni `--database`, `--key-file` e `--blob-dir` del server, dalle stesse variabili d'ambiente. La directory non deve ancora esistere, oppure deve essere vuota; un backup non viene mai mescolato a uno vecchio. Senza file di chiave non c'è backup, perché un database senza la sua chiave contiene credenziali che nessuno può leggere.

`restore` li rimette a posto, e prima il server deve essere fermato. Controlla ogni file rispetto al manifesto prima di scrivere qualsiasi cosa, quindi un backup danneggiato o incompleto non cambia nulla. Si rifiuta di sovrascrivere un database, o un file di chiave diverso, già presente; `--replace` dice che lo si vuole davvero. Si avvia poi il server: porta lo schema aggiornato, e rifiuta un backup fatto da una versione più recente della propria.

PostgreSQL: `backup` scrive la chiave, i blob e il manifesto, e stampa il comando `pg_dump --format=custom` che produce la parte del database, perché quel programma è di PostgreSQL e l'immagine di Cascade non lo include. `restore` rimette a posto la chiave e i blob e stampa il comando `pg_restore`. I blob conservati su S3 o Azure non vengono copiati; si fa il backup del bucket lì.

Prima di aggiornare a una versione che esegue migrazioni, se ne fa uno: le migrazioni vanno solo avanti, e tornare alla vecchia immagine richiede il backup.

## Criteri di oscuramento delle esecuzioni

Nell'editor: Impostazioni, Oscuramento crea i criteri. Un flusso di lavoro ne sceglie uno nel pannello laterale dell'editor senza nulla selezionato, sotto Impostazioni del flusso di lavoro.

Il deposito delle credenziali tiene già i segreti fuori da tutto ciò che un'esecuzione memorizza. Un criterio di oscuramento serve per i dati che non sono una credenziale ma non devono stare neppure nella cronologia delle esecuzioni: un numero di badge, il nome di un operatore, un numero di carta arrivato da un webhook.

Un criterio è un nome e delle regole:

- **fields**: nomi di chiave degli elementi. Una chiave che un criterio nomina ha l'intero valore sostituito con `[redacted]`, a qualsiasi profondità, qualunque sia il tipo del valore. Il confronto ignora maiuscole e minuscole, e `*` e `?` funzionano come caratteri jolly, quindi `*secret*` prende `plant_secret` e `SecretKey`.
- **patterns**: espressioni regolari, nella sintassi RE2 di Go. Ogni corrispondenza all'interno di qualsiasi testo viene sostituita con `[redacted]`. Un pattern che corrisponde al testo vuoto viene rifiutato.
- **steps**: facoltativo. Il criterio copre solo i passaggi elencati. Vuoto significa ogni passaggio.
- **appliesToAll**: facoltativo. Il criterio copre ogni flusso di lavoro, lo nomini o no.

Un flusso di lavoro ne sceglie uno per nome nelle sue impostazioni:

```yaml
settings:
  redaction: Badges
```

Che cosa fa e quando:

- Viene eseguito **quando l'esecuzione finisce**, nella stessa transazione che la segna come conclusa: riuscita, fallita o interrotta. Fino ad allora l'esecuzione ha i suoi dati reali, perché il passaggio successivo ne ha bisogno e un riavvio riprende da essi. Un'esecuzione in attesa ha ancora i suoi dati reali.
- Ripulisce l'output memorizzato di ogni passaggio, il messaggio di errore memorizzato di ogni passaggio, l'errore proprio dell'esecuzione e una risposta di webhook memorizzata. Non tocca il contenuto dei file: un criterio legge dati di elementi, e un file è un riferimento a dei byte.
- Ciò che è stato memorizzato è il punto da cui parte una riesecuzione o un nuovo tentativo dal mezzo di quell'esecuzione, quindi una riesecuzione vede i valori ripuliti. Gli elementi del trigger del flusso di lavoro sono nell'output del primo passaggio, e vengono ripuliti anche loro.
- Legge il flusso di lavoro com'era in quell'esecuzione, quindi modificare un flusso di lavoro, o il criterio, non cambia mai un'esecuzione già conclusa.
- Un flusso di lavoro che nomina un criterio che non esiste **fallisce in modo chiuso**: le sue esecuzioni non conservano alcun dato degli elementi, come fa l'impostazione di salvataggio `metadata`, e i `problems` del flusso di lavoro lo dicono. Un criterio mancante non deve mai significare dati conservati che qualcuno voleva ripulire.
- Un criterio che dei flussi di lavoro nominano non può essere eliminato (409), e il suo nome non può cambiare. Le regole sì.

| Chiamata | Che cosa fa |
|---|---|
| `GET /api/v1/redaction-policies` | Tutti i criteri. Chiunque abbia effettuato l'accesso può leggerli, perché chi scrive flussi di lavoro ha bisogno dei nomi. |
| `POST /api/v1/redaction-policies` | Ne crea uno. |
| `PUT /api/v1/redaction-policies/{policy}` | Sostituisce la sua descrizione e le sue regole. |
| `DELETE /api/v1/redaction-policies/{policy}` | Ne elimina uno che nessun flusso di lavoro nomina. |

Creare, modificare ed eliminare un criterio richiede l'autorizzazione di istanza `redaction.manage`, che hanno i proprietari e gli amministratori. Ognuno è nel registro di controllo come `redaction.created`, `redaction.updated` e `redaction.deleted`.

## Insights

Nell'editor: Insights, nella barra in alto. Si sceglie una finestra, un progetto e un flusso di lavoro; mostra i totali, un grafico e una tabella per giorno, e una tabella per flusso di lavoro.

`GET /api/v1/insights` somma le esecuzioni in una finestra: come sono finite, quanto sono durate, per giorno e per flusso di lavoro.

```sh
curl "$CASCADE/api/v1/insights?from=2026-10-10&to=2026-10-14&project=$PROJECT" -H "Authorization: Bearer $KEY"
```

- `from` e `to` sono un orario RFC 3339 o una data (mezzanotte UTC). Senza nessuno dei due, sono gli ultimi sette giorni fino a ora. Il massimo a cui risponde è 366 giorni.
- `project` e `workflow` lo restringono. Senza, conta ogni progetto in cui chi chiama può leggere le esecuzioni, quindi i numeri di ciascuno sono i suoi.
- Un'esecuzione conta nel giorno UTC in cui è stata creata.
- `totals` e ogni riga di `days` e `workflows` portano `total`, `succeeded`, `failed`, `canceled` e `unfinished` (in coda, in corso o in attesa), il tempo medio e il più lungo di esecuzione in millisecondi sulle esecuzioni che hanno sia un inizio sia una fine, e `failureRate`.
- `failureRate` è le fallite diviso le riuscite più le fallite. Un'esecuzione annullata non è un fallimento e una non conclusa non ha ancora deciso, quindi nessuna delle due vi rientra. Vale 0 quando nulla è finito in un senso o nell'altro.
- `days` elenca ogni giorno UTC della finestra, con zeri per un giorno in cui non è girato nulla, così un grafico non ha buchi da indovinare. `workflows` sono i 50 più attivi, il più attivo per primo.

Legge le stesse righe di esecuzione dell'elenco delle esecuzioni, quindi richiede l'autorizzazione `execution.read` e una chiave abilitata per essa.

## Segreti esterni

Nell'editor: Impostazioni, Segreti esterni. Si aggiunge un provider, lo si prova su un percorso dalla stessa scheda e si vede com'è fatto il riferimento che lo indica.

Il campo segreto di una credenziale può puntare a un segreto conservato in HashiCorp Vault o OpenBao invece di contenere il segreto stesso. Si ruota la password nell'archivio e ogni flusso di lavoro usa quella nuova alla sua esecuzione successiva, senza che nessuno modifichi una credenziale, e una copia del vostro database non contiene mai la password.

Un riferimento ha questo aspetto, in qualsiasi campo segreto di una credenziale:

```
secret://bao/plant/line-3/db#password
```

È il provider chiamato `bao`, il segreto in `plant/line-3/db` e la sua chiave `password`. La credenziale memorizza quel testo, sigillato come qualsiasi segreto. Nulla di ciò a cui punta viene mai memorizzato qui: il valore viene letto quando un'esecuzione apre la credenziale, tenuto in memoria per il tempo di cache del provider e ripulito da tutto ciò che l'esecuzione salva, come una password del deposito. Solo i campi segreti accettano riferimenti. Un riferimento digitato in un campo che non è segreto è solo testo.

### Configurare un provider

Un provider è il server, il modo in cui Cascade vi accede e dove può leggere. Crearlo, modificarlo e rimuoverlo spetta a un proprietario o amministratore dell'istanza, con l'autorizzazione `secrets.manage`, e deve essere fatto da una persona che ha effettuato l'accesso, non da una chiave API.

```sh
curl -X POST $CASCADE/api/v1/secret-providers -H "X-CSRF-Token: ..." -d '{
  "name": "bao",
  "address": "https://bao.plant.example:8200",
  "authMethod": "approle", "roleId": "...", "secretId": "...",
  "allowedPaths": ["plant"]
}'
```

| Campo | Che cosa fa |
|---|---|
| `name` | Da 1 a 40 lettere minuscole, cifre e trattini. È in ogni riferimento, quindi non può cambiare in seguito. |
| `address` | L'URL del server. |
| `mount`, `kvVersion` | Dove è montato il motore KV (`secret` per impostazione predefinita) e se è la versione 1 o 2 (2 per impostazione predefinita). |
| `namespace` | Inviato come `X-Vault-Namespace`, per un namespace del server. |
| `authMethod` | `token` con `token`, oppure `approle` con `roleId` e `secretId`. `authMount` è dove è montato AppRole (`approle` per impostazione predefinita). AppRole accede da sé e di nuovo quando il suo token scade. |
| `caCert` | Una autorità di certificazione PEM di cui fidarsi per il server, quando il suo certificato non è di una di cui il sistema si fida. |
| `allowedPaths` | **Obbligatorio.** Gli unici posti da cui un riferimento può leggere. `plant` consente `plant` e tutto ciò che c'è sotto, e non `plantation`. |
| `projects` | Facoltativo. Gli unici progetti che possono usare il provider. Se vuoto, può ogni progetto. |
| `cacheSeconds` | Per quanto tempo un segreto letto resta in memoria, da 0 a 3600. 30 per impostazione predefinita. 0 legge ogni volta. |

Il modo in cui Cascade accede (il token, oppure l'id e il segreto di AppRole) è sigillato con la chiave dell'istanza, riavvolto da una rotazione delle chiavi con tutto il resto, e non viene mai mostrato da nessuna chiamata. Se lo si omette in una modifica, quello memorizzato resta.

`POST /api/v1/secret-providers/{provider}/test` accede e, con un `path`, lo legge, e dice se ha funzionato. Non restituisce mai un valore. `GET /api/v1/secret-providers` elenca i provider per chiunque abbia effettuato l'accesso, perché chi crea le credenziali ha bisogno dei nomi. Le chiamate sono nel registro di controllo come `secrets.provider_created`, `_updated` e `_deleted`.

### Che cosa non farà

- **Un provider ha bisogno di percorsi consentiti.** Un token per Vault di solito può leggere molto più di quanto chi modifica le credenziali dovrebbe poter nominare, e senza un elenco chiunque possa creare una credenziale potrebbe puntarne una a qualsiasi segreto che il token raggiunga e far inviare quel segreto da un flusso di lavoro a un altro posto. Si danno al provider i percorsi di cui hanno bisogno le sue credenziali, e alla sua policy lo stesso.
- **Un riferimento viene controllato quando la credenziale viene salvata**, non solo quando un'esecuzione la usa: il provider deve esistere, essere aperto al progetto della credenziale e consentire il percorso. Un percorso con una parte vuota, un punto o un `..` viene rifiutato.
- **Un'esecuzione che non riesce a leggere il segreto fallisce e dice perché**, nominando il provider, il percorso e la chiave e mai un valore: provider inesistente, un percorso che il provider non consente, nessun segreto lì, chiave inesistente, o il rifiuto del server stesso (una policy che non consente la lettura dà "permission denied").
- **Eliminare un provider non modifica le credenziali.** Quelle che puntano a esso falliscono quando un'esecuzione le apre, dicendo che il provider non c'è più.
- Un valore segreto che inizia davvero con `secret://` non può essere memorizzato come segreto, perché si legge come un riferimento.
- I valori che sono numeri o vero o falso vengono letti come testo. Un valore che è un oggetto intero o una lista viene rifiutato.
## Invio dei log

Nell'editor: Impostazioni, Invio dei log (proprietari e amministratori). Ogni destinazione mostra quanto ha inviato, quando ha consegnato per l'ultima volta e il suo ultimo errore, con un pulsante che invia un evento di prova.

Si invia il registro di controllo, e una riga per ogni esecuzione che finisce, dove uno stabilimento tiene già i suoi log: un server syslog, o qualsiasi cosa che accetti log OTLP su HTTP (un collector OpenTelemetry, Loki, una piattaforma di log). Gli eventi partono man mano che accadono, quindi un SIEM vede un accesso fallito in pochi secondi, e la traccia di controllo esiste da qualche parte dove un amministratore di questa istanza non può riscriverla.

Una destinazione è un posto. Se ne creano quante ne servono:

```sh
curl -X POST $CASCADE/api/v1/log-destinations -H "X-CSRF-Token: ..." -d '{
  "name": "plant syslog", "kind": "syslog",
  "address": "syslog.plant.example:6514", "network": "tls",
  "caCert": "-----BEGIN CERTIFICATE-----..."
}'
curl -X POST $CASCADE/api/v1/log-destinations -H "X-CSRF-Token: ..." -d '{
  "name": "collector", "kind": "otlp", "endpoint": "https://otel.plant.example/v1/logs",
  "headers": {"Authorization": "Bearer ..."}
}'
```

Creare, modificare e rimuovere destinazioni spetta ai proprietari e agli amministratori dell'istanza (`logstream.manage`), da una persona che ha effettuato l'accesso e non da una chiave API, perché una destinazione è il posto dove va il registro di controllo. Le chiamate sono nel registro di controllo come `logstream.destination_created`, `_updated` e `_deleted`.

### Che cosa viene inviato

- **Eventi di controllo**: ogni riga del registro di controllo, con il suo numero di sequenza e il suo hash. Il numero di sequenza e l'hash sono il modo in cui un ricevente riconosce una ripetizione, e l'hash è quello della riga stessa, quindi la catena può essere verificata da ciò che è arrivato. Un accesso fallito o rifiutato è un avviso, tutto il resto una notifica.
- **Eventi di esecuzione**: uno per ogni esecuzione che finisce, comunque finisca: l'id dell'esecuzione, l'id e il nome del flusso di lavoro, il suo progetto, stato, modalità, quando è stata creata, avviata e conclusa, quanto è durata, e il suo errore e il passaggio in cui è fallita. Un'esecuzione fallita è un errore, una interrotta una notifica, una riuscita informativa. Vengono inviati un paio di secondi dopo la fine dell'esecuzione.
- **Mai dati degli elementi.** Ciò che i passaggi di un'esecuzione hanno visto e prodotto resta nell'esecuzione, dove lo proteggono i criteri di oscuramento. Il registro di controllo non contiene mai un segreto.

`events` sceglie uno o entrambi (`["audit"]`, `["execution"]`, entrambi per impostazione predefinita). `start` dice dove inizia una nuova destinazione: `now`, il valore predefinito, invia ciò che accade dopo che è stata creata, e `beginning` invia prima l'intero registro di controllo e ogni esecuzione conclusa.

### Syslog

Un messaggio è RFC 5424: `<priority>1 time host hotloop-cascade pid msgid - {json}`, con l'evento come una riga di JSON. La priorità è la facility per otto più la severità. Il msgid è l'azione di controllo (`workflow.saved`) o lo stato dell'esecuzione.

| Campo | Che cosa fa |
|---|---|
| `address` | `host:port`. |
| `network` | `tcp` (il predefinito), `udp` o `tls`. |
| `framing` | Per `tcp` e `tls`: `octet` (il conteggio degli ottetti della RFC 6587, il predefinito) o `newline`. UDP è un datagramma ciascuno. |
| `facility` | `local0` per impostazione predefinita; qualsiasi nome di facility syslog. |
| `appName` | L'APP-NAME dell'intestazione, `hotloop-cascade` per impostazione predefinita. |
| `caCert`, `serverName` | Per `tls`: l'autorità di cui fidarsi, e il nome per cui il certificato deve essere emesso quando non è l'host. Non esiste alcuna impostazione che salti il controllo. |

### OTLP

I log vanno a `endpoint` come OTLP su HTTP con un corpo JSON: un record di log per ogni evento, con l'evento come JSON nel corpo e le sue parti come attributi (`cascade.event`, `cascade.action`, `cascade.status`, `cascade.project`, `cascade.actor.name` e così via) in modo che un ricevente possa filtrare senza analizzare. La risorsa indica `service.name=hotloop-cascade`, la sua versione e l'host. Gli `headers` vengono inviati con ogni richiesta, per un token o un tenant. Sono sigillati con la chiave dell'istanza, riavvolti da una rotazione delle chiavi e mai mostrati: l'elenco indica solo i loro nomi. `caCert` e `serverName` funzionano come per syslog.

### Come si comporta la consegna

- **Almeno una volta, in ordine.** Una destinazione ricorda l'ultima riga di controllo e l'ultima esecuzione conclusa che ha inviato. Una che è giù riceve tutto ciò che ha perso quando torna, in ordine, e un riavvio prosegue da dove si era fermata. Se il mittente viene interrotto tra l'invio e l'annotazione, quegli eventi vengono inviati di nuovo, ed è a questo che servono i numeri di sequenza.
- **Una destinazione che fallisce rallenta**, un secondo e raddoppiando fino a cinque minuti, e il suo stato dice che cosa è andato storto e quando: `lastError`, `lastErrorAt`. Un successo lo azzera. Nulla viene scartato mentre è giù, quindi il limite è il registro di controllo, non una coda.
- **Un solo mittente alla volta.** Con più main, quello che detiene il lease di una destinazione vi invia; gli altri attendono e subentrano se si ferma.
- **Modificare una destinazione ne mantiene la posizione.** Spostarla a un altro indirizzo non reinvia né salta mai nulla. Le intestazioni lasciate fuori da una modifica vengono conservate, e un oggetto vuoto le cancella. Il nome e il tipo non possono cambiare.
- `POST /api/v1/log-destinations/{destination}/test` invia un evento fittizio attraverso lo stesso percorso e dice se è arrivato, con il motivo quando non è arrivato. Non sposta nulla.
- `GET /api/v1/log-destinations` mostra lo stato di ciascuna: quanti eventi ha inviato, l'ultimo numero di sequenza di controllo consegnato, quando ha avuto successo l'ultima volta e il suo ultimo errore.

## Dove vivono i dati di grandi dimensioni

I file e i payload grandi che un'esecuzione porta con sé (un PDF scaricato, un fotogramma di una telecamera, un foglio di calcolo) sono memorizzati come blob, separati dal database. Per impostazione predefinita stanno sul disco dell'istanza. Si imposta `HOTLOOP_CASCADE_BLOB_STORE` per metterli invece in un bucket S3 o in un contenitore di blob Azure, così il main può essere ricostruito senza portarli con sé e più main condividono un'unica copia.

| Impostazione | Significato |
| --- | --- |
| `HOTLOOP_CASCADE_BLOB_STORE` | `fs` (il predefinito), `s3` oppure `azure`. |
| `HOTLOOP_CASCADE_BLOB_SPOOL_DIR` | Dove un blob attende mentre ne viene calcolato l'hash prima del caricamento. Per impostazione predefinita `blob-spool` nella directory dei dati. |
| `HOTLOOP_CASCADE_BLOB_S3_BUCKET`, `_ACCESS_KEY`, `_SECRET_KEY` | Obbligatori per `s3`. Il segreto legge anche `_SECRET_KEY_FILE`. |
| `HOTLOOP_CASCADE_BLOB_S3_ENDPOINT`, `_REGION` | Si omette l'endpoint per AWS. Lo si imposta per Garage, MinIO o Ceph. |
| `HOTLOOP_CASCADE_BLOB_S3_PATH_STYLE` | `true` o `false`. Lo stile path è il predefinito ogni volta che è impostato un endpoint. |
| `HOTLOOP_CASCADE_BLOB_S3_CA_FILE` | Un bundle di CA per un endpoint con certificato privato. |
| `HOTLOOP_CASCADE_BLOB_S3_PREFIX` | Una cartella dentro il bucket, così un bucket può contenere più di un'istanza. |
| `HOTLOOP_CASCADE_BLOB_AZURE_CONTAINER` | Obbligatorio per `azure`. |
| `HOTLOOP_CASCADE_BLOB_AZURE_CONNECTION_STRING`, oppure `_ACCOUNT` con `_KEY`, oppure `_SAS` | Un modo per accedere. I segreti leggono anche una forma `_FILE`. |
| `HOTLOOP_CASCADE_BLOB_AZURE_ENDPOINT`, `_PREFIX` | Un endpoint per Azurite o un cloud privato, e una cartella dentro il contenitore. |

Sul chart, si impostano tramite `env` e `extraEnv`, con i segreti che arrivano da un Secret di Kubernetes.

- **Indirizzato per contenuto.** Un blob è memorizzato sotto il suo SHA-256 (`sha256/ab/cdef...`), quindi lo stesso file è memorizzato una sola volta quante che siano le esecuzioni che lo portano. Rimetterlo non fa nulla, anche quando due esecuzioni lo fanno nello stesso momento.
- **Hash prima del caricamento.** I dati vengono letti una volta nel file di spool, ne viene calcolato l'hash e poi vengono inviati, quindi la memoria resta piatta per qualsiasi dimensione. Un blob oltre il limite di dimensione viene rifiutato, e un caricamento annullato non lascia nulla nel bucket.
- **Controllato in uscita.** Una lettura viene verificata rispetto al suo hash mentre scorre, quindi un oggetto corrotto fallisce in modo evidente invece di consegnare dati errati a un'esecuzione.
- **Dimensione.** Un singolo caricamento parte come trasferimento multipart su S3 e a blocchi su Azure, quindi il consueto limite di 5 GiB per richiesta non si applica.
- **Pulizia dei blob.** Una volta all'ora un passaggio rimuove i blob a cui nessuna riga punta: un output di passaggio memorizzato come file perché troppo grande per il database, e gli allegati che portano gli elementi. Un blob viene conservato finché una qualsiasi esecuzione di passaggio, output parziale, risposta salvata o flusso di lavoro lo nomina ancora, direttamente o tramite un output memorizzato che contiene l'allegato, così un file condiviso da due esecuzioni con output identico resta finché non scompare l'ultima. Vengono esaminati solo i blob scritti l'ultima volta più di 24 ore fa, e mettere byte già memorizzati conta come scriverli di nuovo dopo la prima ora, quindi un file che un passaggio ha appena memorizzato e non ha ancora registrato non viene mai rimosso. Un passaggio che non riesce a leggere un output memorizzato non rimuove nulla. Scrive una riga `blobs.collected` nel registro di controllo con quanti file e byte sono stati eliminati. Il passaggio presuppone che l'archivio di blob appartenga a un'istanza (i worker e il main di una installazione lo condividono); due installazioni puntate allo stesso bucket o alla stessa cartella rimuoverebbero ciascuna i file dell'altra, quindi se ne dà a ciascuna uno proprio (`HOTLOOP_CASCADE_BLOB_S3_PREFIX` esiste per questo).
- **Cambiare archivio in seguito.** I blob esistenti restano dove sono stati scritti. Si spostano nel nuovo archivio prima di cambiare, perché un riferimento a un blob che il nuovo archivio non ha è un file mancante.

Questi due backend sono provati contro Garage e Azurite nello stack di test, con la stessa suite di conformità dell'archivio su disco: scrittura e lettura, blob vuoti, deduplicazione sotto concorrenza, corruzione, il limite, id errati, eliminazione, elenco, un caricamento annullato e un caricamento in streaming da 192 MiB con un controllo dell'heap.

Che cosa significa per voi: un main ricostruito o sostituito trova ogni file che le sue esecuzioni portavano, senza copie.
