---
title: "Fili tipizzati"
description: "Metti uno JSON Schema sul nodo json e controlla i messaggi su un filo: una forma sbagliata arriva a un nodo Catch che nomina ogni campo errato."
---

Un messaggio con la forma sbagliata è il guasto che vogliamo meno su una linea in funzione. Una temperatura che arriva come la stringa `"hot"`, un `id` mancante, un numero dove doveva esserci una lista: niente va in crash, il flusso continua, e qualcosa più a valle fa in silenzio la cosa sbagliata. Flow porta JSON Schema su questo problema in tre passaggi.

## Schema sul nodo `json`

Dai al nodo `json` uno schema nelle sue impostazioni e ogni valore che gestisce viene controllato rispetto a esso. Un valore che corrisponde prosegue. Un valore che non corrisponde va a un nodo Catch, non continua lungo il filo, e l'errore nomina ogni campo errato:

```
does not match the schema: payload.temp: got string, want number; payload.id: missing property "id"
```

`msg.schemaError` porta la stessa cosa come elenco di oggetti `{path, keyword, message}`, per un nodo Catch che vuole instradare in base a esso. I percorsi si leggono come li scrive un nodo Change: `payload.sensors[2].temp`.

Se il nodo non ha uno schema nelle impostazioni e un messaggio porta `msg.schema`, il nodo valida rispetto a quello, come fa il nodo `json` di Node-RED. Un messaggio che passa perde `msg.schema`. Uno che fallisce lo mantiene. Lo schema nelle impostazioni vince quando ci sono entrambi.

- Lo schema è JSON Schema draft 2020-12 a meno che non nomini un'altra bozza con `$schema`. Le bozze 4, 6, 7 e 2019-09 sono accettate.
- Uno schema non valido nelle impostazioni fa fallire il deploy con il motivo del validatore. Un `msg.schema` non valido è un errore su quel messaggio.
- Uno schema è autosufficiente. Un `$ref` a un altro URL o a un file viene rifiutato, non scaricato, così un box edge senza via d'uscita si comporta come gli altri.
- `format` viene controllato per i formati che il validatore conosce e ignorato per gli altri, come nella maggior parte dei validatori.
- Un flusso senza schema da nessuna parte si comporta esattamente come prima.

Qualunque altra cosa in Flow che debba controllare un valore rispetto a uno schema usa lo stesso pacchetto.

## Schemi sulle porte

Qualsiasi nodo può dichiarare che cosa accetta e che cosa promette ciascuna porta di uscita. Due chiavi facoltative sul nodo, entrambe nel file del flusso, entrambe ignorate da ogni altro strumento che lo legge, così un flusso che le porta fa ancora il giro di andata e ritorno byte per byte:

```json
{"id":"sensor","type":"function","outputs":2,"wires":[["limit"],[]],
 "ew_outSchemas":[{"type":"object","properties":{"payload":{"type":"object",
   "required":["temp"],"properties":{"temp":{"type":"number"}}}}}, null]},
{"id":"limit","type":"switch","wires":[[],[]],
 "ew_inSchema":{"type":"object","required":["topic"]}}
```

`ew_inSchema` è ciò che il nodo accetta. `ew_outSchemas` è un elenco con uno schema o `null` per ogni porta di uscita. Uno schema descrive l'intero messaggio, quindi il payload è `properties.payload`. Le chiavi che iniziano con un trattino basso, `_msgid` e il resto della contabilità interna del runtime, sono escluse da ciò che vede, così uno schema chiuso non deve nominarle. Sono JSON Schema come quello del nodo `json`, e le controlla lo stesso pacchetto.

**Un'incompatibilità che l'editor può vedere viene rifiutata al deploy.** Quando entrambe le estremità di un filo dichiarano uno schema e nessun messaggio potrebbe soddisfarle entrambe, il deploy viene rifiutato prima che venga scritto un solo byte, come il cancello dei test: un 422, nulla riavviato, nulla salvato, e una voce nell'audit come `deploy.refused` con il motivo `typed wires`.

```
the deploy was refused because of 1 typed wire problem, and the flows already running are untouched; junction "sensor" (sensor) output 1 -> "limit" (limit): payload.temp: the sender sends string and the receiver takes number
```

Rifiuta solo ciò che può dimostrare. Tipi diversi sullo stesso campo, un valore fuori dall'`enum` o dall'intervallo dell'altra estremità, un campo che il ricevente richiede e che lo schema chiuso del mittente esclude, un campo che il mittente invia sempre e che lo schema chiuso del ricevente rifiuta. Un mittente che semplicemente non menziona un campo richiesto dal ricevente non viene rifiutato, perché il messaggio potrebbe benissimo portarlo, e uno schema che usa `$ref`, `allOf`, `anyOf`, `oneOf`, `not` o `if` non viene messo in discussione in quella parte. Un rifiuto falso blocca un deploy per niente, e tutto ciò che non può dimostrare viene comunque preso a runtime. Uno schema che non compila, o un `ew_outSchemas` più lungo delle uscite del nodo, viene rifiutato allo stesso modo. I rollback non vengono controllati, per la ragione per cui non sono vincolati dai test.

**I letterali di un nodo Inject contano come un tipo.** Un Inject non ha uno schema proprio, ma ciò che imposta con certezza ne vale uno. Quando un Inject è collegato direttamente a un nodo con `ew_inSchema`, il payload letterale, e ogni altra proprietà letterale che imposta, viene controllato rispetto a quello schema al deploy, e un letterale che il ricevente non potrà mai accettare viene rifiutato allo stesso modo, con lo stesso 422 e lo stesso `deploy.refused` nell'audit:

```
inject "reading" (i1) output 1 -> "limit" (l1): payload: the inject sets "hot", which the receiver does not take: got string, want number
```

Viene controllato solo un letterale: una stringa, un numero, un booleano o JSON. Un timestamp, una variabile d'ambiente, il contesto di flusso o globale, un'altra proprietà del messaggio, JSONata, un buffer o un'espressione regolare non sono noti finché il nodo non scatta, quindi vengono saltati, mai indovinati. Una proprietà richiesta che l'Inject non imposta non è nemmeno un conflitto, perché un valore non statico può impostarla. Si giudica solo il filo dall'Inject al nodo: un letterale che passa prima da un altro nodo è lasciato al controllo a runtime. L'editor disegna lo stesso conflitto su quel filo.

**Quella che non vede va a un nodo Catch e a una metrica.** Un messaggio che arriva a un nodo violando il suo `ew_inSchema` non raggiunge mai il nodo. Un messaggio che esce da una porta violando il suo schema viene fermato al mittente e mai consegnato. In ogni caso viene sollevato come errore dal nodo che teneva lo schema, e il nodo Catch lo riceve con il percorso di ogni campo errato in `msg.error.message` e come elenco in `msg.error.violations`, ciascuno `{path, keyword, message}`:

```
the message does not match the schema of output 1: payload.temp: got string, want number
```

`hotloop_flow_node_schema_mismatches_total` li conta per nodo, e conta anche le incompatibilità del nodo `json`. Un nodo senza schemi costa un controllo di nil, e un flusso senza alcuno si comporta esattamente come prima.

## Tipi sui fili, nell'editor

Un filo con un tipo a una delle due estremità lo porta con sé. L'editor scrive il tipo sul filo, a metà della curva: quello del mittente, in pochi caratteri (`payload {temp: number}`), e tutta la storia quando passi sopra il filo.

- **Entrambe le estremità dichiarano un tipo e concordano:** contorno verde, il tipo del mittente.
- **Solo un'estremità ne dichiara uno:** tratteggiato e attenuato, così vedi dove un filo non ha ancora un tipo.
- **Entrambe ne dichiarano uno e non possono mai concordare:** il filo e la sua etichetta diventano rossi e dicono quale campo, `≠ payload.temp`, e il suggerimento mostra il motivo del runtime. Il deploy lo rifiuterebbe, e ora lo vedi prima di premere Deploy.

Il rosso non è l'editor che tira a indovinare. Chiede al runtime, `POST /flows/types`, che esegue lo stesso controllo con cui il deploy rifiuta, così la tela e il deploy non possono essere in disaccordo. L'editor chiede solo quando qualcosa sulla tela ha uno schema, poco dopo l'ultima modifica. Un flusso senza schemi non fa alcuna chiamata e non disegna nulla di nuovo.

Imposta i tipi nella finestra di dialogo di un nodo, sotto **Types**: uno schema di ingresso, e uno per ogni porta di uscita. Vuoto significa nessun tipo, e un nodo che non hai mai tipizzato non acquista le chiavi. Scrivere qualcosa che non è JSON, o che non è un oggetto, viene rifiutato nella finestra di dialogo.
