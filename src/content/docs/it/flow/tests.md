---
title: "Test accanto ai flussi"
description: "Scrivete un file di test accanto a un flusso, eseguitelo su un orologio simulato, subordinate il deploy al suo esito: nulla esce dal test."
---

"La mia modifica ha rotto la linea?" deve trovare risposta prima del deploy, da chi fa la modifica, non alle 3 di notte da chi è di reperibilità. Per questo un flusso può avere dei test: sono in YAML, stanno accanto al file del flusso e passano dalla stessa revisione:

```yaml
# line3.test.yaml
flows: line3.json            # relative to this file; flows.json if you leave it out
tests:
  - name: a high reading raises the alarm and nothing else
    inject:
      - node: reading                  # by name or by id
        msg: {topic: line3/temp, payload: 92.5}
    expect:
      - node: over limit?              # the Switch
        port: 1
        msg: {payload: 92.5}
        within: 500ms
      - node: over limit?
        port: 2
        nothing: true
      - node: alarm out                # a Debug: checked on what it received
        msg: {payload: HIGH}

  - name: a negative reading is caught, not alarmed on
    inject:
      - node: reading
        msg: {payload: -4}
    expect:
      - node: errors                   # a Catch node
        error: "out of range"
```

```bash
hotloop-flow test -junit report.xml line3.test.yaml
```

```
--- PASS: a high reading raises the alarm and nothing else (0.00s)
--- PASS: a negative reading is caught, not alarmed on (0.00s)
ok	line3.test.yaml	2 passed, 0 failed, 0 errors (0.00s)
```

È il vero runtime con i veri nodi, dentro il processo, senza server e senza editor. Ogni test ha un runtime tutto suo, quindi nulla di ciò che un test lascia in un Delay o in un contesto può passare al test successivo.

- **`inject`** immette messaggi, in ordine, ciascuno gestito prima che entri il successivo. Un nodo con un ingresso lo riceve lì. Una sorgente come un Inject o un MQTT In lo emette dalla sua prima uscita come se l'avesse prodotto, e a un nodo Inject senza messaggio viene premuto il pulsante.
- **`expect`** osserva l'uscita di un nodo, contando le porte da 1 come fa l'editor. Un nodo senza uscite, come un Debug, viene verificato su ciò che ha ricevuto. Un'istanza di sottoflusso è osservata sulle sue uscite, da qualunque punto al suo interno provengano.
- **`msg`** è ciò che il messaggio deve contenere. Ogni proprietà indicata deve esserci con quel valore, fino in fondo, e tutto il resto del messaggio viene ignorato, così un test sul payload non si rompe quando qualcuno comincia a impostare `msg.topic`. **`assert`** è un'espressione JSONata che deve risultare vera, per i controlli che un valore letterale non può fare. **`error`** è il testo che l'errore intercettato da un nodo Catch deve contenere.
- **`within`** è una scadenza. Un messaggio in ritardo fallisce, e il fallimento dice di quanto. **`nothing: true`** e **`count: N`** vengono verificati quando il flusso si è fermato, l'unico momento in cui "non è uscito nulla" ha un significato. Due aspettative sulla stessa porta sono due messaggi, in quell'ordine.

Un test finisce non appena è successo tutto ciò che attende e il flusso non ha più nulla da fare. Il `timeout` è di 5 secondi salvo diversa indicazione, sull'orologio del test, che è la sezione successiva.

Un fallimento dice che cosa è uscito al suo posto e dove differisce:

```
--- FAIL: the alarm says LOW (0.00s)
    expect 1: debug "alarm out" (alarm-out): 1 message(s) received and none matched; the first one differs at msg.payload: wanted "LOW", got "HIGH"
      at 0s: {"payload":"HIGH","topic":"line3/temp"}
```

Un test che non può essere eseguito è un errore, non un successo: un nodo nominato che non è nel flusso, un nome condiviso da due nodi, una porta che il nodo non ha, o un nodo del flusso che non si avvia. Lo stesso vale per una chiave scritta male. `expcet:` viene rifiutato alla lettura del file, perché un refuso ignorato in silenzio lascerebbe un test senza nulla da verificare, e un test senza nulla da verificare passa. Il codice di uscita è 1 per qualunque esito diverso da tutto superato, e `-junit` scrive il report che legge qualsiasi sistema di CI.

## Sull'orologio del test

Nessuno esegue una suite di test che aspetta un Delay di cinque minuti, quindi un test non aspetta. Tiene un proprio orologio e lo sposta direttamente alla prossima cosa che qualcosa nel flusso sta aspettando: un Delay che rilascia, il secondo messaggio di un Trigger, un Inject a intervallo o con crontab, un Join o un Batch che scade, un Link Call che si arrende. Il timer scatta, il flusso gestisce ciò che ha inviato e solo allora l'orologio cerca la scadenza successiva, nello stesso ordine in cui l'avrebbero portata i minuti reali. Cinque minuti di Delay sono un passo e circa un millisecondo.

```yaml
  - name: a reading at 4m pushes the watchdog's off out to 9m
    clock: 2026-10-05T06:00:00Z     # when the test starts; the real time if you leave it out
    timeout: 20m
    inject:
      - {node: watchdog, msg: {payload: reading}}
      - {node: watchdog, msg: {payload: reading}, at: 4m}   # at: on the test's clock
    expect:
      - {node: watchdog, msg: {payload: "on"}}
      - {node: watchdog, msg: {payload: "off"}, within: 9m}

  - name: and not a moment before
    timeout: 8m59s
    inject:
      - {node: watchdog, msg: {payload: reading}}
      - {node: watchdog, msg: {payload: reading}, at: 4m}
    expect:
      - {node: watchdog, count: 1}  # the "on", and nothing else yet
```

**`at`** colloca un'iniezione in un momento dell'orologio del test, e tutto ciò che scade prima avviene per primo. Anche **`within`** e **`timeout`** sono su quell'orologio, quindi `timeout: 1h` su un flusso con un Inject ogni dieci minuti sono sei tick e qualche millisecondo. **`clock`** imposta quando inizia il test, per un flusso che dipende dall'ora: un crontab che scatta alle sei e mezza scatta quando l'orologio del test segna le sei e mezza. Il `Date` di un nodo Function, il timestamp di un Inject, un nodo Change che imposta una data e l'`Expires` di un cookie leggono lo stesso orologio, quindi un flusso che marca e confronta gli orari è coerente con sé stesso sotto test.

La suite verifica con esso ogni nodo di temporizzazione della palette, al millisecondo: Delay nelle modalità fissa, casuale, a frequenza e a orario, Trigger con extend, Inject a intervallo, una volta all'avvio e con crontab, scadenze di Join e Batch e un Link Call che non riceve mai la risposta. Tutto, compresa un'ora di tempo d'impianto, si esegue in molto meno di un secondo. Ciò che un test non può spostare è la CPU: un flusso ancora occupato dopo un minuto di tempo reale fa fallire il test invece di bloccare la suite. `$now()` e `$millis()` di JSONata leggono ancora l'orologio reale.

## Test dall'editor

Nessuno scrive un test per un flusso che funziona. Lo scrive il giorno in cui smette di funzionare, cioè un giorno tardi. Per questo l'editor ne ricava uno da ciò che il flusso ha appena fatto, in due clic.

Ogni messaggio nel pannello di debug ha un pulsante **Test**. Cliccatelo e l'editor prepara un test da quel messaggio: ciò che è entrato dalla sorgente da cui è entrato, immesso di nuovo, e ciò che questo nodo Debug ha mostrato, atteso qui. Cambiate ciò che volete, perché una lettura con un timestamp si verifica meglio con un `assert` che fissata al millisecondo. Cliccate **Add to tests** e il test è nella suite accanto al file del flusso, in fondo, con tutto ciò che c'era già scritto esattamente com'era, commenti compresi. Un nome che la suite ha già riceve un numero in coda invece di sostituire qualcosa.

Come fa l'editor a sapere che cosa è entrato: il runtime conserva gli ultimi 64 messaggi entrati nel flusso da una sorgente e gli ultimi 64 arrivati a un nodo Debug, con l'id che un messaggio porta da un nodo all'altro. È un anello di dimensione limitata, e un messaggio oltre 64 KB non viene conservato affatto, quindi non può mai essere ciò che fa crescere un pod. Un messaggio spinto fuori, o che un nodo ha sostituito con uno nuovo lungo la strada, non può essere trasformato in test, e l'editor lo dice invece di indovinare che cosa è entrato.

Il pannello **Tests** esegue la suite sulla copia di lavoro, distribuita o no, ed è proprio questo il punto: lo scoprite prima del deploy. Ogni nodo attraversato da un test riuscito riceve una spunta, ogni nodo a cui si riferisce un fallimento riceve una croce con il motivo al passaggio del mouse, e un clic su un fallimento porta al suo nodo. Modificate qualsiasi cosa e i segni spariscono, perché descrivono un flusso che non esiste più. **Edit** apre l'intera suite come YAML. Un deploy che il [gate](#il-gate-di-deploy) rifiuta arriva nello stesso pannello, con i fallimenti sui nodi.

Tutto questo gira in un vero browser contro il vero binario a ogni pull request.

## Il gate di deploy

I test sul portatile di qualcuno dimostrano il flusso che aveva sul suo portatile. Il gate dimostra quello che viene distribuito. Tenete la suite sull'istanza, accanto al file del flusso che prova (`data/flows.test.yaml` accanto a `data/flows.json`, tramite `PUT /tests` o l'editor), attivate `tests.gate`, e ogni deploy la esegue sui flussi che sta per mettere in funzione. Uno che non passa viene rifiutato, con un 422 e il report completo:

```
$ hotloop-flow deploy -file flows.json -note "raise the alarm at 95"
1 changed

Tab "Line 3" (t1)
  ~ switch "over limit?" (chk)
      rules[0].v: "80" -> "95"
hotloop-flow: the deploy was refused: 1 of 2 flow tests didn't pass, and the flows already running are untouched; "a high reading raises the alarm and nothing else": expect 1: switch "over limit?" (chk): nothing sent from port 1

--- FAIL: a high reading raises the alarm and nothing else (0.00s)
    expect 1: switch "over limit?" (chk): nothing sent from port 1
    expect 2: switch "over limit?" (chk): expected nothing, and 1 message(s) sent from port 2
      at 0s: {"payload":92.5,"topic":"line3/temp"}
    expect 3: debug "alarm out" (alarm-out): nothing received
--- PASS: a negative reading is caught, not alarmed on (0.00s)
FAIL	flows.test.yaml	1 passed, 1 failed, 0 errors (0.00s)
```

È un'esecuzione vera: il binario con il gate attivo, la suite dell'inizio di questa sezione tenuta accanto al suo file di flusso e un token di deploy.

**I flussi già in funzione non se ne accorgono.** Il gate gira prima che venga scritto un solo byte: nessun file di flusso, nessuna credenziale, nessun record di deploy, nessun riavvio. Il rifiuto finisce nella traccia di audit come un `deploy.refused` che dice che i test sono falliti. E i test non girano affatto nel processo del server. Girano in un processo figlio, questo stesso binario come `hotloop-flow test -stdin`, a cui si passano su stdin i flussi candidati e la suite, perché un test avvia ogni nodo del flusso e alcuni si registrano dove tutto il processo li condivide: un Link In per il suo id, una route HTTP per il suo percorso. Eseguito qui dentro, il Link In del candidato risponderebbe al posto di quello del flusso in funzione appena partito. In un figlio non può toccare nulla di ciò che usa la linea, un nodo che va in panic in una goroutine propria abbatte il test e non l'impianto, e la memoria viene restituita all'uscita. Il test lo dimostra nel modo difficile: il candidato rifiutato ha lo stesso Link In, e dopo il rifiuto un messaggio sul link del flusso in funzione arriva ancora.

Tre decisioni da conoscere. **È disattivato per impostazione predefinita**, perché un gate che l'operatore non ha chiesto è un deploy che fallisce alle 3 di notte per un motivo che nessuno del turno conosce. **I test che non possono girare non passano**: un figlio che non parte o un'esecuzione più lunga di `tests.timeout` rifiuta il deploy e dice quale dei due. E **i rollback non passano dal gate.** Un rollback è il modo di uscire da uno stato cattivo verso uno che aveva già funzionato, e trattenerlo per i test di oggi è il modo di allungare un'interruzione. Con il gate attivo e nessuna suite non c'è nulla che possa fallire, quindi il deploy procede e il log dice perché non è stato verificato.

## Contesto e credenziali

Ogni test parte con il contesto vuoto, qualunque cosa abbia lasciato il test precedente. Un contatore che un test ha portato a 42 non è il punto di partenza del successivo, perché una suite in cui il secondo test passa solo se il primo è stato eseguito prima è una suite che mente il giorno in cui qualcuno esegue un solo test. Quindi un test che ha bisogno di un contatore a 41 lo dice, e dice che cosa deve contenere il contesto alla fine:

```yaml
  - name: picks up where the line left off
    context:                        # what the test starts with
      global: {limit: 90}
      flow: {Line 3: {count: 41}}   # flow context, by tab label or id
    credentials:                    # by node name or id; never the real ones
      historian: {token: test-token}
      plc api: {password: s3cret}
    inject: [{node: count, msg: {payload: 95}}]
    expect:
      - {node: out, msg: {count: 42}}
      - context:                    # what it holds at the end
          global: {alarm: true}
          flow: {Line 3: {count: 42}}
          node: {count: {last: 95}} # node context, by node name or id
```

`context` in un'aspettativa viene confrontato come `msg`, e `null` significa che la chiave non deve essere impostata. Un fallimento dice che cosa contiene davvero l'ambito, perché la risposta abituale è un refuso: `flow context of "Line 3" (t1): cuont: not set; it holds count`.

Un test non vede mai le credenziali reali. Gira con quelle che nomina, ed è ciò che rende sicuro metterlo nel repository, e arrivano a un nodo esattamente come arriverebbero quelle vere: la password di una richiesta HTTP compare nell'intestazione `Authorization` che avrebbe inviato, e una configurazione InfluxDB che non parte senza token parte con quello del test. Un nodo che legge una password da un file montato tramite `ew_credentialFiles` riceve invece la credenziale del test per quel campo, perché un test non legge nulla dal disco, e una vuota quando il test non ne nomina.

Il contesto vive in memoria per un test, mai nel database di stato, quindi un test non può leggere ciò che i flussi in funzione hanno lasciato né lasciare nulla a loro. Una fixture è YAML nel test, non un file che finge di essere un database.

## Nulla esce dal test

Un test che eseguisse davvero il vostro MQTT Out pubblicherebbe sul broker dell'impianto, e a quel punto non è un test, è un deploy. Quindi sotto test ogni nodo che parla con il mondo fuori dal processo riceve una controparte: MQTT in ingresso e in uscita, HTTP in, response e request, PostgreSQL, InfluxDB, TCP e UDP in ingresso, uscita e richiesta, WebSocket in ingresso e in uscita con il listener e il client che stanno dietro, i nodi file, `exec`, `scan` e `netinfo`.

Il nodo fa comunque tutto il suo lavoro fino al cavo. L'MQTT Out calcola ancora il topic, la QoS e i byte; l'HTTP Request compone ancora l'URL, costruisce il corpo e segue i reindirizzamenti; il nodo PostgreSQL costruisce ancora l'SQL e i suoi parametri. Poi li consegna alla controparte, che li registra e risponde con ciò che il test ha scritto. Senza copione, la risposta è niente e successo: nessuna riga, un 200 vuoto, un comando terminato con 0. Le sorgenti (MQTT In, HTTP In, TCP e UDP In, WebSocket In, Watch) non si sottoscrivono, non restano in ascolto e non interrogano, quindi arriva solo ciò che il test inietta.

```yaml
  - name: the limit comes from the database and the alarm goes to the broker
    inject:
      - node: reading
        msg: {topic: "3", payload: 92.5}
    replies:
      - node: lookup limit                   # a PostgreSQL query
        reply: {rows: [{limit_c: 90}]}
      - node: maintenance api                # an HTTP Request
        reply: {statusCode: 503, payload: {error: down for maintenance}}
      - node: historian                      # InfluxDB, and it's down
        error: connection refused
    expect:
      - node: lookup limit
        sent: {query: "select limit_c from limits where line = $1", params: ["3"]}
      - node: to the plant                   # an MQTT Out
        sent: {topic: line3/alarm, payload: HIGH, qos: 1, retain: true}
      - node: errors
        error: connection refused
```

**`sent`** è ciò che il nodo avrebbe inviato, confrontato come `msg`. **`replies`** scrive ciò che torna: la prima risposta elencata per un nodo risponde alla sua prima chiamata, la successiva alla seconda, e l'ultima continua a rispondere, così "ha risposto, poi si è fermato" sono due righe. **`error`** fa fallire la chiamata come farebbe quella vera, quindi il percorso che il vostro flusso prende quando lo storico è fermo si prova prima che lo sia.

| Nodo | `sent` | `reply` |
|---|---|---|
| MQTT Out | `topic`, `payload`, `qos`, `retain` | |
| HTTP Request | `method`, `url`, `headers`, `payload` | `statusCode` (200), `headers`, `payload` |
| HTTP Response | `statusCode`, `headers`, `payload` | |
| PostgreSQL | `query`, `params` | `rows` per una query, `rowCount` per un insert |
| InfluxDB | `line`, il line protocol | |
| TCP Out, UDP Out | `host`, `port`, `payload` (`session` quando risponde) | |
| TCP Request | `host`, `port`, `payload` | `payload`, letto come il nodo legge una risposta vera |
| WebSocket Out | `payload` (`session` quando risponde) | |
| File | `filename`, `action`, `payload` | |
| File In | `filename` | `payload`, il contenuto |
| exec | `command`, `args` | `stdout`, `stderr`, `code` (0) |
| scan | `range`, `ports` | `devices` |
| netinfo | | `interfaces` |

Alcune cose un test non le verifica, di proposito, perché appartengono alla macchina e non al flusso: la lista di consentiti di `exec`, gli ambiti di percorsi e discovery e i certificati di un `tls-config`. Sotto test nulla viene eseguito, aperto, sondato o chiamato, quindi non c'è nulla da delimitare o cifrare, e il deploy risponde ancora di tutto questo sulla macchina su cui arriva.

La prova è un test che punta ciascuno di quei nodi a una porta TCP, a una porta UDP e a una directory che il test possiede, fa passare una lettura da tutti, verifica byte per byte che cosa ciascuno avrebbe inviato e poi conta: zero connessioni, zero datagrammi, nessun file scritto, nulla eseguito. Un nodo che esce all'esterno e non ha controparte viene rifiutato per nome prima che giri qualunque cosa, e il test della palette fallisce se qualcuno ne aggiunge uno.
