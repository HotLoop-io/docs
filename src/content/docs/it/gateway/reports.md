---
title: "Report pianificati"
description: "I numeri dello storico a calendario, in CSV o HTML, salvati e inviati via e-mail: contano solo le letture buone e ogni riga dice quante sono state scartate."
---

I report programmati, da 4.14.0, eseguono report definiti dall'operatore secondo una pianificazione: interrogano l'historian, producono il risultato in CSV e HTML, lo salvano su un volume e, facoltativamente, lo inviano per email. È la controparte del modulo Reporting di Ignition per la parte di quel modulo che uno stabilimento usa più spesso, una tabella di numeri consegnata in orario. Attivo per impostazione predefinita (`HOTLOOP_REPORTS_ENABLED`), nel binario e nel chart Helm. I report sono conservati in `HOTLOOP_REPORTS_DIR`, che per impostazione predefinita è `reports` nella directory dati di HotLoop: `HOTLOOP_DATA_DIR` se impostata, `/data` quando esiste e vi si può scrivere (un volume di container), e altrimenti `~/.local/share/hotloop` (o `$XDG_DATA_HOME/hotloop`), così un binario da solo non ha bisogno di nulla di montato.

## Cosa sono e cosa non sono

- **Solo API.** In questa versione non c'è una schermata. I report si definiscono, eseguono, elencano e scaricano tramite `/api/reports`. Un'interfaccia è un lavoro a parte.
- **Solo CSV e HTML.** Niente PDF. Produrre un buon PDF in Go puro, senza binari esterni (l'immagine di runtime non ne ha, di proposito), significa scegliere una libreria PDF e un motore di impaginazione, ed è una decisione a sé. Il file HTML è autonomo e si stampa bene da qualsiasi browser, il che per ora copre il "mi serve un PDF".
- **Tabelle di aggregati, non impaginazioni libere.** Un report è un elenco di tag, una finestra, una dimensione di intervallo e un insieme di aggregazioni. Non è un editor di pagine.
- **Una sola istanza del Gateway.** Lo scheduler presume di essere l'unico a eseguire report su questo database. Due repliche lancerebbero ciascuna ogni report. Questo chart esegue una replica, e il volume dei report è `ReadWriteOnce`.
- **Non è una funzione degli allarmi.** L'e-mail degli allarmi è una funzione a sé, le [notifiche di allarme](/it/iot/notifications/). I report ne condividono le impostazioni del relay SMTP e nient'altro.

## La definizione di un report

Le definizioni sono dati modificati dall'operatore, salvati nel database come dispositivi, tag, definizioni di allarme e membri della flotta, e gestiti tramite l'API. Esempio:

```json
{
  "id": "line1-daily",
  "name": "Line 1 daily summary",
  "enabled": true,
  "tags": [
    {"deviceId": "press-01", "tagName": "Zone1_Temp"},
    {"deviceId": "press-01", "tagName": "Pressure"}
  ],
  "window": {"count": 1, "unit": "days", "end": "local_midnight"},
  "bucket": "hour",
  "aggregations": ["min", "max", "avg", "count"],
  "schedule": {"kind": "daily", "at": "03:00"},
  "format": "both",
  "recipients": ["ops@example.com"],
  "retain": 30
}
```

| Campo | Significato |
|---|---|
| `id` | Da 1 a 64 caratteri tra lettere, cifre, punto, trattino o trattino basso, che inizia con una lettera o una cifra. Dà il nome alla directory del report sul volume, quindi è validato come ogni altro id di questa applicazione. |
| `name` | Mostrato nel titolo dell'HTML e nell'oggetto dell'e-mail. Nessun carattere di controllo. |
| `enabled` | Se lo scheduler lo esegue. Un report disattivato può comunque essere eseguito a mano. |
| `tags` | Da 1 a 50 coppie di dispositivo e tag. Ciascuna deve esistere quando la definizione viene salvata e non deve essere un tag di tipo stringa. |
| `window` | L'intervallo di storico coperto da ogni esecuzione. Vedi sotto. |
| `bucket` | `window` (una riga per tag), `hour` o `day`. Il valore predefinito è `window`. |
| `aggregations` | Una o più tra `min`, `max`, `avg`, `first`, `last` o `count`, ciascuna al massimo una volta. |
| `schedule` | Vedi sotto. |
| `format` | `csv`, `html` o `both`. Il valore predefinito è `csv`. |
| `recipients` | Facoltativo. Solo indirizzi semplici (`ops@example.com`, non `Ops <ops@example.com>`). Al massimo 20. |
| `retain` | Quante esecuzioni conservare. Da 1 a 1000. Il valore predefinito è 30. |

`PUT` sostituisce l'intera definizione. Un client può leggere un report, cambiare un campo e rimandarlo così com'è: i campi di sola lettura che il server aggiunge (`nextRunAt`, `lastRun`, `lastRunAt`, `createdAt` e `updatedAt`) vengono accettati e ignorati.

Una definizione che produrrebbe più di 1000 intervalli viene rifiutata al salvataggio (intervalli orari su più di circa 41 giorni, per esempio).

## Finestre

Una finestra è relativa al momento in cui avviene l'esecuzione.

| Cosa vuole | `count` | `unit` | `end` |
|---|---|---|---|
| Le 24 ore precedenti | 24 | `hours` | `run_time` |
| Il giorno di calendario precedente | 1 | `days` | `local_midnight` |
| I 7 giorni interi precedenti | 7 | `days` | `local_midnight` |
| Una settimana mobile | 7 | `days` | `run_time` |

- `end` è il momento in cui l'esecuzione parte oppure, per `local_midnight`, la mezzanotte locale più recente uguale o precedente. Un'esecuzione alle 03:00 che termina alla mezzanotte locale copre giorni di calendario interi.
- **Le ore sono tempo trascorso. I giorni sono giorni di calendario** nel fuso orario dell'impianto. Una finestra di un giorno che termina alla mezzanotte locale è un intero giorno locale, lungo 23 ore il giorno in cui si spostano avanti gli orologi e 25 il giorno in cui si spostano indietro. "Le 24 ore precedenti" sono sempre esattamente 24 ore.
- **Una finestra è semiaperta**: include il suo inizio ed esclude la sua fine. Una lettura con marca temporale esattamente a mezzanotte appartiene al giorno che inizia lì. Due report giornalieri consecutivi non contano mai entrambi una lettura e non se la perdono mai entrambi.
- Un'esecuzione manuale e una di recupero calcolano la finestra al momento in cui vengono eseguite.

## Intervalli

- `window`: una riga per tag sull'intera finestra.
- `hour`: una riga per tag per ora di orologio locale. Una finestra che non inizia all'ora esatta comincia con un intervallo parziale più breve, e una che non termina all'ora esatta finisce con uno. Le ore restano all'ora esatta attraverso un cambio d'ora e nei fusi il cui scarto non è un numero intero di ore.
- `day`: una riga per tag per giorno di calendario locale.

Ogni tag ha una riga per ogni intervallo, compresi quelli senza nulla dentro. Il report non omette mai l'ora in cui un sensore è rimasto in silenzio, perché un report che tralasciasse la riga sembrerebbe identico a quello di un sensore che non aveva niente da dire. Ogni riga indica l'intervallo esatto che copre (`period_start` e `period_end`, con i loro scarti UTC), così un giorno di 23 ore si vede come tale.

## Aggregazioni e regola di qualità

Le aggregazioni sono `min`, `max`, `avg`, `first` (la lettura più antica del periodo per marca temporale), `last` (la più recente) e `count`.

I report seguono la regola di qualità, la stessa del grafico di trend, così un report e un trend sulla stessa ora concordano. Anche una lettura senza valore numerico (una lettura di tipo stringa) viene lasciata fuori. Non c'è un interruttore per questo: una media che mescola in silenzio letture che lo storico stesso ha segnato come inaffidabili è peggio di un report che dice quante non ne ha usate.

Ogni riga porta quindi una colonna `excluded`: quante letture di quel periodo sono state escluse. `count` è quante sono state usate. Il record dell'esecuzione e l'e-mail riportano i totali.

**Niente viene inventato.** Un tag senza alcuna lettura utilizzabile in un periodo non ha un minimo, e il report lo dice: le celle sono vuote nel CSV e riportano `no data` nell'HTML. Non sono mai zero. Lo zero è una lettura (una valvola chiusa, una portata nulla) e viene aggregato come qualsiasi altro valore. `count` è l'unica colonna che è un numero quando non ci sono dati, perché zero è un conteggio vero di niente.

## Pianificazioni e orario

Una pianificazione è una di queste:

```json
{"kind": "interval", "every": "6h"}
{"kind": "daily",    "at": "03:00"}
{"kind": "weekly",   "weekday": "monday", "at": "06:30"}
```

- Un **intervallo** è tempo trascorso (almeno un minuto) e ignora l'orologio a muro.
- Gli orari **giornalieri e settimanali** sono orari d'orologio a muro nel fuso orario dell'impianto, che è `HOTLOOP_TIMEZONE` (il `global.timezone` del chart). Deve essere un nome di fuso reale, come `America/Chicago`. Un nome inutilizzabile causa un rifiuto dell'avvio, con i report attivi o no, e non un ripiego silenzioso su UTC, perché un report previsto per le 03:00 locali che parte alle 03:00 UTC è un bug che nessuno vede finché i numeri non sono sbagliati.

### Ora legale

La prossima esecuzione viene calcolata costruendo un orario d'orologio a muro nella località dell'impianto con `time.Date`. Non viene mai calcolata aggiungendo 24 ore all'esecuzione precedente, il che partirebbe un'ora in anticipo o un'ora in ritardo da un cambio d'ora al successivo. Due orari d'orologio a muro sono scomodi nel giorno del cambio, e la regola per ciascuno è fissata nel codice anziché lasciata a `time.Date`, il cui comportamento in entrambi i casi è documentato come non specificato:

- **Un orario che non esiste** (le 02:30 nel giorno dello spostamento in avanti, quando l'orologio salta dalle 02:00 alle 03:00) parte al primo istante dopo il salto, le 03:00. Parte in ritardo al massimo della dimensione del salto e non salta il giorno.
- **Un orario che si verifica due volte** (le 01:30 nel giorno dello spostamento indietro) parte una sola volta, alla sua prima occorrenza.

### last_run_at, la prossima esecuzione e il recupero

`last_run_at` è il momento in cui lo scheduler ha **avviato** il report per l'ultima volta, che quell'esecuzione sia poi riuscita o fallita. Un'esecuzione manuale non lo sposta, quindi eseguire un report a mano alle 02:00 non annulla l'esecuzione delle 03:00 di stanotte.

La prossima esecuzione è il primo orario pianificato dopo il più recente tra la creazione della definizione, la sua ultima modifica e il suo `last_run_at`. Misurare dall'ultima modifica significa che spostare un report dalle 03:00 alle 09:00 alle 10:00 aspetta domani invece di partire subito per un orario già passato.

**Recupero.** Se la prossima esecuzione dopo `last_run_at` è già nel passato quando il Gateway si avvia, il Gateway non c'era per farla, e il report viene eseguito **una volta**, subito, con l'etichetta `catchup`. Non viene eseguito una volta per ogni orario perso: un report giornaliero che ha perso tre giorni viene eseguito una volta, il giorno in cui il Gateway torna, con la finestra che ne risulta a quel momento. I giorni persi non vengono recuperati. Poi il report torna alla sua pianificazione.

`last_run_at` viene scritto **prima** dell'avvio dell'esecuzione, così un Gateway che muore a metà esecuzione non la ripete al riavvio sopra un'e-mail che potrebbe essere già partita. L'esecuzione interrotta viene invece registrata come fallita. Un'esecuzione pianificata fallita non viene ritentata; il successivo orario pianificato viene eseguito normalmente, e `POST /api/reports/{id}/run` c'è per quando qualcuno la vuole di nuovo.

## Output

Ogni esecuzione scrive i suoi file sotto `HOTLOOP_REPORTS_DIR` (`/data/reports`, un PVC nel chart):

```
/data/reports/<report id>/<UTC timestamp>-<run id>.csv
/data/reports/<report id>/<UTC timestamp>-<run id>.html
```

- **I nomi dei file sono costruiti solo da un id validato, una marca temporale UTC e l'id intero dell'esecuzione.** Il path traversal è chiuso per costruzione: l'id del report deve soddisfare la stessa regola degli identificatori ovunque, e un nome di file riletto da un record di esecuzione viene confrontato con lo schema esatto qui sopra prima di essere aperto. Il `{run}` in un URL di download viene interpretato come intero e usato solo per cercare il record di esecuzione insieme all'id del report. Il file aperto è quello che quel record nomina. Nulla dell'URL diventa parte di un percorso.
- I file vengono creati con `O_EXCL` e modalità `0640`, e le directory con `0750`. Un file già esistente è un errore, mai sovrascritto. L'output contiene dati d'impianto e nomi di tag, quindi la modalità è un minimo, non un sostituto della protezione del volume.
- **Conservazione.** Dopo ogni esecuzione vengono conservate le `retain` esecuzioni più recenti che hanno salvato file, e le più vecchie vengono eliminate con i loro file. Le esecuzioni fallite, che non hanno file, vengono conservate a parte (le `retain` più recenti tra queste), così una serie di fallimenti non può spingere fuori l'ultimo buon report. Viene rimosso anche qualsiasi file nella directory del report che corrisponda allo schema di denominazione ma non sia referenziato da alcun record di esecuzione rimasto (il file parziale di un'esecuzione morta). Un file che non corrisponde allo schema, come uno messo lì da un operatore, viene lasciato stare.

### CSV

RFC 4180, da `encoding/csv`, con terminatori di riga CRLF. Le colonne sono `device_id`, `tag_name`, `unit`, `period_start`, `period_end`, una colonna per aggregazione nell'ordine in cui la definizione le elenca, e `excluded`. Le marche temporali sono RFC 3339 nel fuso orario dell'impianto con il loro scarto. I numeri sono scritti a precisione piena.

**Iniezione di formule nei fogli di calcolo.** Il nome di un tag o un'unità è testo che qualcuno ha digitato, e un foglio di calcolo legge come formula una cella che inizia con `=`, `+`, `-` o `@`. Ogni cella di testo che inizia con uno di questi (o con una tabulazione o un ritorno a capo, o con uno spazio seguito da uno di essi) è preceduta da un apostrofo, che i fogli di calcolo trattano come "questo è testo" e non mostrano. Le colonne numeriche sono scritte da numeri, quindi una lettura negativa resta com'è e si legge ancora come numero.

Il file non ha il byte order mark. Excel apre un CSV UTF-8 senza di esso come se fosse una vecchia tabella codici, quindi un nome di tag con caratteri non ASCII può richiedere l'importazione come UTF-8.

### HTML

Un unico file autonomo, costruito con `html/template`, così i nomi e i valori dei tag vengono sottoposti a escape secondo dove finiscono: un tag chiamato `<script>` viene scritto come testo. Il foglio di stile è inline e non c'è alcuno script, font, immagine o link verso alcun luogo, perché le installazioni possono essere isolate dalla rete. Porta anche un tag meta `Content-Security-Policy` che vieta di caricare qualsiasi cosa, e l'API lo serve con una policy che aggiunge `sandbox`, come allegato.

## Consegna via e-mail

Se un report ha `recipients`, ogni esecuzione invia i file via e-mail come allegati, tramite il relay SMTP configurato in `HOTLOOP_NOTIFY_SMTP_*` (host, porta, nome utente, password, mittente, TLS). Con il canale degli allarmi si condivide solo il relay: se quel canale è attivo e a chi vanno gli allarmi non ha alcun effetto sui report, quindi un'installazione può inviare report via e-mail senza avvisare nessuno. Il chart scrive le variabili del relay per i soli report quando il canale degli allarmi è disattivato.

È lo stesso codice SMTP del canale degli allarmi, non una seconda copia. Anche il canale degli allarmi ora invia attraverso di esso. La gestione della connessione non cambia (la porta 465 ora parla TLS dal primo byte, vedi [Notifiche di allarme](/it/iot/notifications/#tls-implicito-porta-465)): STARTTLS ogni volta che il relay lo offre, `AUTH` quando le credenziali sono impostate, e un errore netto prima di `AUTH` quando `HOTLOOP_NOTIFY_SMTP_TLS` è impostato e il relay non offre STARTTLS. Per un allarme ASCII il messaggio ha gli stessi byte di prima, a parte l'intestazione `Date`, e un test lo blocca. L'oggetto di un allarme non ASCII ora viene inviato come parola codificata RFC 2047 invece che come UTF-8 grezzo.

Il messaggio è `multipart/mixed`: una parte di testo quoted-printable, poi ogni file codificato in base64. **L'iniezione di intestazioni viene rifiutata, non ripulita.** Destinatari, mittente, oggetto e nomi dei file allegati vengono validati: un valore con un CR, un LF o un altro carattere di controllo, un destinatario in forma di nome visualizzato o che contiene un elenco, o un nome di file con una virgoletta o un percorso fa fallire il messaggio prima che venga inviato qualcosa al relay. L'oggetto proprio del canale degli allarmi è l'unica eccezione, perché un avviso deve partire comunque si chiami l'allarme: prima trasforma i caratteri di controllo in spazi.

- **Nessun relay configurato.** Un report con destinatari viene comunque eseguito e salva i suoi file, e l'esecuzione viene registrata come `failed`, con `emailStatus` `failed` e un errore che dice che il relay non è configurato. Non ha successo in silenzio.
- **Troppo grande.** `HOTLOOP_REPORTS_MAX_EMAIL_BYTES` (10 MiB) limita i dati allegati in una e-mail. Un report che lo supera viene salvato e resta scaricabile, e la sua esecuzione registra perché non è stato inviato via e-mail.
- Un'esecuzione fatta a mano può saltare l'e-mail con `?deliver=false`.

## Record di esecuzione e traccia di audit

Ogni esecuzione viene registrata in `report_runs` dal momento in cui parte: quando è iniziata e finita, il trigger (`schedule`, `catchup` o `manual`), chi l'ha richiesta, la finestra, l'esito e il testo dell'errore, il numero di tag, righe, letture aggregate e letture escluse, i file salvati, l'esito dell'e-mail e i suoi destinatari, e note (per esempio, che un tag è stato nel frattempo eliminato e viene riportato dal suo storico registrato). Successo e fallimento vengono scritti anche tramite `rt.Event`, la stessa traccia di audit usata da allarmi e azioni di flotta, con l'id del report come soggetto.

Un'esecuzione interrotta dallo spegnimento, dal suo limite di tempo (`HOTLOOP_REPORTS_RUN_TIMEOUT`) o dall'eliminazione del report viene registrata come fallita con quel motivo. Un'esecuzione lasciata in `running` da un processo morto viene marcata come fallita al successivo avvio del Gateway. È in corso una sola esecuzione di un report alla volta; una seconda richiesta mentre una è in corso riceve un `409`.

## API

| Route | Autorizzazione | <span class="sr-only">Dettagli</span> |
|---|---|---|
| `GET /api/reports` | `reports.read` | Ogni definizione, ciascuna con il suo `nextRunAt` e l'esecuzione più recente |
| `POST /api/reports` | `reports.write` | Crea. `409` se l'id esiste |
| `GET /api/reports/{id}` | `reports.read` | Una definizione |
| `PUT /api/reports/{id}` | `reports.write` | Sostituisce. L'id non può cambiare |
| `DELETE /api/reports/{id}` | `reports.write` | Elimina, con le sue esecuzioni e i suoi file. Un'esecuzione in corso viene prima annullata |
| `POST /api/reports/{id}/run` | `reports.run` | Esegui ora e attendi. `?deliver=false` salta l'e-mail |
| `GET /api/reports/{id}/runs` | `reports.read` | Record di esecuzione, dal più recente (`?limit=`, fino a 500) |
| `GET /api/reports/{id}/runs/{run}/download?format=csv\|html` | `reports.read` | Trasmette un file salvato come allegato |

`POST .../run` restituisce il record di esecuzione con `200` sia che l'esecuzione sia riuscita sia che no. Lo stato dice se la richiesta è stata eseguita, e lo `status` del record stesso dice se lo è stato il report. Un'esecuzione che fallisce è un risultato, e viene registrata in ogni caso. L'esecuzione non è legata alla connessione del client: riagganciare non interrompe un report che potrebbe aver già avviato un'e-mail.

Con la funzione disattivata, l'elenco risponde `{"reports": [], "configured": false}` e ogni altra route risponde con un errore che nomina `HOTLOOP_REPORTS_ENABLED`.

### Chi può fare cosa

| Ruolo | `reports.read` | `reports.run` | `reports.write` |
|---|---|---|---|
| visualizzatore | sì | no | no |
| operatore | sì | sì | no |
| amministratore | sì | sì | sì |

- **Leggere** è per i visualizzatori perché un report salvato è un aggregato di storico che un visualizzatore può già leggere tramite `values.read`, quindi leggerlo o scaricarlo non concede nulla di nuovo.
- **Eseguire** è per gli operatori perché eseguire un report consegna sempre e solo ai destinatari che un amministratore ha già scelto, e si può eseguire senza consegnare.
- **Scrivere è solo per gli amministratori.** Una definizione nomina gli indirizzi a cui viene inviato il suo output, quindi poterne definire una significa poter inviare dati d'impianto a un indirizzo arbitrario a calendario. È più vicino per natura a `notify.test` e `fleet.config` (anch'essi solo per amministratori, anch'essi "fare qualcosa verso il mondo esterno") che a una lettura. È una scelta di giudizio, e potrebbe essere rivista se un flusso di lavoro reale richiedesse che gli operatori costruiscano report.
- Un operatore può comunque far partire un'e-mail verso i destinatari di un report eseguendolo, e ripetutamente. C'è una protezione di una sola esecuzione alla volta e `?deliver=false`, ma nessun limite di frequenza.
- Un utente con un elenco di permessi esplicito detiene esattamente ciò che nomina; il carattere jolly `reports.*` copre tutti e tre.

## Configurazione

| Variabile | Predefinito | <span class="sr-only">Dettagli</span> |
|---|---|---|
| `HOTLOOP_REPORTS_ENABLED` | `false` | La funzione è disattivata, scheduler compreso, finché non viene impostato questo |
| `HOTLOOP_REPORTS_DIR` | `/data/reports` | Dove vengono scritti i file di ogni esecuzione. Pensato per essere un PVC (`reports.persistence` nel chart) |
| `HOTLOOP_REPORTS_RUN_TIMEOUT` | `5m` | Delimita un'esecuzione: interrogazione, rendering, scrittura ed e-mail |
| `HOTLOOP_REPORTS_MAX_EMAIL_BYTES` | `10485760` | La massima quantità di dati allegati in una e-mail |
| `HOTLOOP_TIMEZONE` | `UTC` | Il fuso orario dell'impianto. Deve essere un nome di fuso reale, altrimenti HotLoop non si avvia |
| `HOTLOOP_NOTIFY_SMTP_HOST`, `_PORT`, `_USERNAME`, `_PASSWORD`, `_FROM`, `_TLS`, `_TLS_SKIP_VERIFY` | | Il relay attraverso cui i report inviano le e-mail. Vedi [Notifiche di allarme](/it/iot/notifications/) |

Il blocco `reports` del chart ha `enabled`, `runTimeout`, `maxEmailBytes` e `persistence` (dimensione, classe di storage, modalità di accesso). `notify.smtp` fornisce il relay. I report non vengono avviati in modalità `--mcp-stdio`, in cui un agente lancia il binario come aiutante, e un secondo scheduler accanto al vero Gateway eseguirebbe ogni report dovuto due volte.

## Backup

Le definizioni dei report e i record di esecuzione sono dati utente e fanno parte del backup del database. I file di output no: stanno nel volume dei report, e ripristinare un backup in un nuovo deployment riporta i record ma non i file, quindi scaricare lì una vecchia esecuzione risponde che il file non è più su disco. Copi il volume dei report se i file contano.

Aggiungere queste due tabelle all'elenco del backup è il tipo di modifica che è facile dimenticare, quindi il pacchetto di backup ora ha delle protezioni. Un test elenca ogni tabella dello schema e fallisce se una non è né in `backup.Tables` né in un elenco di esclusione esplicito con un motivo. Un altro verifica che `Tables` sia in ordine di chiavi esterne, leggendo le chiavi esterne dal database. Il test di andata e ritorno semina una definizione di report e un'esecuzione e verifica i valori ripristinati e la sequenza.

## Cosa è stato verificato e cosa no

HotLoop è stato eseguito su apparecchiature e server reali, e su hardware reale il 2026-11-17.
