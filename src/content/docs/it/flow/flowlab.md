---
title: "FlowLab: banchi di prova"
description: "Esegui una scheda come diagramma per banchi di prova e data logger: nodi con cicli, filo di errore, porta seriale, pannello e debugger."
---

FlowLab è la parte di Flow per banchi di prova e data logger, e la sua unità è il diagramma: l'altro modo in cui Flow esegue una scheda. In un flusso un messaggio attraversa un nodo e qualsiasi ingresso lo risveglia. In un diagramma ogni nodo viene eseguito una volta per esecuzione, quando ogni ingresso che ha un filo contiene un valore. Due nodi senza un filo tra loro vengono eseguiti nello stesso momento. È così che si costruisce un banco di prova o un data logger: leggere un dispositivo, interpretare la lettura, decidere se è stabile, mostrarla, registrarla.

I flussi non sono toccati da niente di tutto questo. Una scheda che porta `ew_diagram` resta fuori dal runtime dei messaggi, e tutte le altre schede vengono eseguite esattamente come prima.

Che cosa significa per te: disegni la logica una volta, premi Esegui e guardi i valori muoversi sui fili. Chiunque abbia l'indirizzo del pannello può seguire la stessa esecuzione su un telefono.

## Il file

Un diagramma è una scheda con un oggetto `ew_diagram`. I suoi nodi sono voci normali del file di flusso. `wires` indica il nodo a cui va un filo, come sempre, e `ew_in` sul nodo di origine dice su quale ingresso della destinazione arriva ogni filo, nella stessa forma:

```json
{ "id": "a", "type": "dia-const", "z": "d", "value": "1", "x": 100, "y": 80,
  "ew_in": [["a"], []], "wires": [["sum"], []] }
```

Il file si carica e si salva byte per byte con queste chiavi. Impostazioni della scheda:

| Chiave | Che cosa fa |
|---|---|
| `autostart` | `true` avvia l'esecuzione quando parte Flow e dopo ogni distribuzione, senza nessun browser aperto. |
| `role` | `"body"` per un diagramma che esegue un ciclo. Un corpo non viene eseguito da solo. |

Ogni nodo ha anche un ingresso facoltativo `after` e un'uscita `done`. Collega il `done` di un nodo all'`after` di un altro e il secondo aspetta il primo, senza nient'altro in mezzo. L'ordine è un filo che si vede e si può confrontare con diff.

## Esecuzione

Un diagramma viene eseguito da ciò che è distribuito. Nell'editor, apri una scheda di diagramma e premi Esegui. La barra sopra la tela ha:

- **Evidenzia l'esecuzione**: ogni nodo aspetta un momento prima di essere eseguito, così puoi seguirlo, e il filo attraversato da un valore si illumina. Si disattiva da sola dopo dieci minuti.
- **Metti in pausa, Riprendi, Entra, Passa oltre, Esci**: il passo passo va nodo per nodo. Passa oltre esegue tutto il corpo di un ciclo. Entra si ferma al primo nodo al suo interno.
- **Interrompi sulla selezione**: un punto di interruzione sul nodo selezionato. Premi due volte un filo per sondarlo, così conserva i suoi ultimi 100 valori, oppure per interrompere quando vi viene messo un valore. Una sonda non cambia mai un'esecuzione.
- **Apri pannello**: la pagina dell'operatore.

Passa il puntatore su un filo dopo un'esecuzione per vedere l'ultimo valore che ha portato. Il pulsante dei problemi elenca tutti i motivi per cui un diagramma non può essere eseguito, ognuno con il nodo e l'ingresso.

| Chiamata | Che cosa fa |
|---|---|
| `GET /diagrams`, `GET /diagrams/{id}` | Ciò che è distribuito, il pannello e l'ultimo valore su ogni filo. |
| `GET /diagrams/{id}/trace` | Ciò che ha fatto l'ultima esecuzione, in ordine: ogni nodo che è partito o finito e ogni valore che ha attraversato un filo, con i millisecondi dall'inizio dell'esecuzione. Un diagramma che non è stato eseguito da quando è stato distribuito risponde 404. |
| `POST /diagrams/{id}/run`, `/stop`, `/debug` | Richiede `diagram.run`. Ognuna è nel registro di controllo con chi l'ha fatta. |
| `POST /diagrams/{id}/sub` | Invia `{flows, nodes, name}` e ricevi il file di flusso con quei nodi trasformati in un sotto-diagramma. Legge e calcola soltanto: non viene salvato né distribuito nulla. |
| `PUT /diagrams/{id}/controls/{node}` | Imposta un controllo. Verificato rispetto al suo tipo, intervallo e scelte. |
| `PUT /diagrams/{id}/breakpoints`, `/probes` | Le chiavi sono un id di nodo, `wire:<wire key>` o `diagram:<tab>`. |

Gli eventi di un'esecuzione escono sullo stesso socket di quelli dell'editor, come `diagram/<id>/node`, `token`, `run`, `paused` e `values`.

## Nodi

| Nodo | Che cosa fa |
|---|---|
| `dia-const`, `dia-math`, `dia-compare`, `dia-logic` | Valori e aritmetica. Le operazioni matematiche lavorano elemento per elemento sugli array. |
| `dia-wait` | Aspetta, poi passa avanti il suo ingresso. |
| `dia-bundle`, `dia-field`, `dia-array` | Record e array. |
| `dia-while`, `dia-for` | Cicli. Il corpo è un diagramma a sé, indicato dalla sua scheda. I valori riportati partono da un filo o da Start values e escono come erano all'ultimo passaggio. Un ciclo for accetta un numero o un array. Un ciclo while viene eseguito almeno una volta. |
| `dia-case` | Struttura a casi. Il valore su `selector` sceglie un corpo da eseguire, e viene eseguito solo quel corpo. Un booleano sceglie `true` o `false`, un numero sceglie il caso di quel valore comunque sia scritto, e una stringa o un enum sceglie il caso con quel nome. I casi sono un oggetto JSON da nome del caso a diagramma, e un valore che nessun caso nomina esegue il predefinito. Senza predefinito il nodo mette un errore sul suo filo di errore, e la distribuzione avvisa che manca il predefinito (un booleano con entrambi i casi è escluso). Ogni corpo deve restituire ogni risultato con lo stesso nome, e un corpo che non lo fa è un problema alla distribuzione. L'uscita `case` dice quale caso è stato eseguito. |
| `dia-body-in`, `dia-body-out` | Le due estremità di un corpo. `iter` è il numero del passaggio. `stop` termina un ciclo while. Il nome di un valore riportato lo rimanda al passaggio successivo. |
| `dia-serial-open`, `dia-serial-read`, `dia-serial-write` | Una porta seriale. Le letture terminano a un terminatore o a un numero di byte. |
| `dia-instr-open`, `dia-instr-query`, `dia-scpi-parse` | Uno strumento di prova, per indirizzo. Vedi Strumenti più avanti. |
| `dia-parse-reading`, `dia-stable` | Estraggono un numero e un'unità da una riga, e dicono se le ultime letture concordano. |
| `dia-log-text` | Aggiunge un record come riga di un file di testo, con una colonna dell'ora. |
| `dia-daq-read` | Legge campioni da un'attività di acquisizione dati su hardware NI, tramite il gRPC Device Server di NI. Vedi Acquisizione dati più avanti. |
| `dia-mqtt-out` | Pubblica il suo valore tramite un server MQTT configurato dal file di flusso, la stessa connessione usata dai nodi MQTT. Segnalo come durable e un messaggio che il broker perde viene scritto su disco e inviato, in ordine, quando il broker torna, anche dopo un riavvio. |
| `dia-postgres-out` | Scrive un record come riga di una tabella di PostgreSQL o TimescaleDB, tramite il server configurato dal file di flusso, la stessa connessione usata dal nodo postgres. Segnalo come durable e una riga che il database perde viene tenuta su disco e scritta, in ordine, quando torna. Vedi Un database che si ferma più avanti. |
| `dia-log-tdms` | Aggiunge un record a un file TDMS, un canale per campo. Vedi più avanti. |
| `dia-control`, `dia-indicator`, `dia-chart` | Il pannello. |
| `dia-stats` | La media, il valore RMS, il minimo, il massimo e la deviazione standard di un array. La deviazione standard divide per n meno uno, quindi servono due letture. |
| `dia-integral` | L'area sotto un array con la regola del trapezio, come un solo numero o come area cumulata a ogni campione. |
| `dia-derivative` | La pendenza a ogni campione di un array. |
| `dia-filter` | Un filtro Butterworth passa-basso, passa-alto, passa-banda o elimina-banda di ordine da 1 a 10 con una frequenza di taglio in hertz. |

### Filtri

Il nodo filtro è un filtro Butterworth: piatto dove lascia passare, senza ripple, e 3 dB sotto alla frequenza di taglio. È progettato a partire dal filtro analogico con la trasformata bilineare e il taglio pre-distorto, così il punto a 3 dB cade sulla frequenza che hai scritto, e viene eseguito come una catena di sezioni del secondo ordine così che un ordine alto resti accurato. Un passa-banda o un elimina-banda di ordine n ha 2n poli. Un taglio deve essere sopra zero e sotto metà della frequenza di campionamento, e un progetto che non si può costruire è elencato nei problemi prima dell'esecuzione. La frequenza di campionamento è una proprietà, o un ingresso che ha la precedenza su di essa. Il filtro conserva la sua memoria da una chiamata all'altra dentro un'esecuzione, così un array tagliato a pezzi da un ciclo esce come se fosse stato filtrato intero, e ogni nuova esecuzione parte da zero.

Che cosa non sa fare: non è un filtro a fase lineare, quindi ritarda frequenze diverse di quantità diverse, e non ha una modalità a fase zero che filtri avanti e indietro. Dove la temporizzazione tra due segnali deve restare allineata, o la forma di un'onda deve sopravvivere, è il filtro sbagliato. Integrale e derivata prendono il tempo tra i campioni da un ingresso `dt` in secondi, un ingresso `rate` in hertz o dalla proprietà Samples per second.

### Log TDMS

`dia-log-tdms` scrive le misure di un banco di prova in un file TDMS, il formato che aprono gli strumenti di acquisizione e analisi dati. Collega un record a `row`. Ogni campo del record è un canale in un solo gruppo, quindi un record con `pressure`, `ok` e `operator` fa tre canali. Un numero è memorizzato come float a 64 bit, vero o falso come bool, e tutto il resto come testo. Un campo che contiene una lista di numeri aggiunge tutta la lista, ed è così che entra un blocco di campioni. Impostazioni:

| Impostazione | Significato |
|---|---|
| `path` | Il file. Un file già presente viene esteso, così un'esecuzione dopo l'altra costruisce un solo file. |
| `group` | Il gruppo in cui vanno i canali. |
| `columns` | I campi da registrare, in ordine. Vuoto registra ogni campo, per nome. |
| `properties` | Un oggetto JSON di proprietà del file, come `{"title": "bench 4", "station": 4}`, scritto all'inizio dell'esecuzione. |
| `sync` | Attivo per impostazione predefinita: ogni riga arriva sul disco prima che il nodo finisca. |

Ogni riga è un segmento, scritto in un solo blocco. Se manca la corrente a metà di una, il file mostra dove è stata interrotta, un lettore restituisce tutte le righe precedenti, e l'esecuzione successiva ripara la fine del file e prosegue. Il tipo di un campo è fissato dalla prima riga di un'esecuzione. Una riga successiva che non corrisponde, come testo in una colonna numerica, va sul filo di errore come ingresso errato e il file non viene toccato. Un numero mancante viene scritto come not-a-number.

Per aprire il file usa un qualsiasi lettore TDMS. Le proprietà del canale come `unit_string` e le proprietà della forma d'onda `wf_start_time`, `wf_increment` e `wf_samples` sono supportate dalla libreria; il nodo non le imposta ancora.

Che cosa accetta il lettore: segmenti little endian e big endian, dati interlacciati e contigui, metadati omessi in un segmento quando non sono cambiati, una nuova lista di oggetti, interi a 8, 16, 32 e 64 bit, float a 32 e 64 bit, bool, testo e marche temporali. Che cosa rifiuta, per nome e senza leggere il file a metà: dati grezzi scritti da un driver di acquisizione dati, dati scalati o compressi, float a precisione estesa, numeri a virgola fissa e complessi. Che cosa scrive lo scrittore: little endian, dati contigui e quegli stessi tipi. Non scrive big endian.

### Il filo di errore

I nodi che parlano con il mondo esterno hanno `err` in ingresso e `err` in uscita. Un errore è un record: un flag, un codice numerico, il testo di origine e il nodo da cui viene. Un nodo che riceve un errore non fa alcun lavoro e lo passa avanti, quindi un guasto all'inizio di una catena fa saltare tutto ciò che segue e compare una sola volta alla fine. Collega un errore all'uscita di corpo `err` di un ciclo e il ciclo si ferma su di esso, con l'errore sull'uscita di errore del ciclo. Un indicatore di errore sul pannello diventa rosso su un guasto e si cancella quando arriva il valore successivo senza errore.

### Una destinazione che si ferma

Un `dia-mqtt-out` durable invia direttamente al broker finché risponde. Quando non risponde, il messaggio viene registrato nell'archivio durable di Flow prima che il nodo finisca, e una pompa consegna la coda, dal più vecchio, quando il collegamento torna. Ciò che arriva mentre altri aspettano va dietro di loro, quindi nulla supera nulla. La consegna dalla coda è almeno una volta: un messaggio il cui invio è scaduto perché il client non si era accorto che il collegamento era caduto può comunque essere consegnato quando il client si riconnette, quindi può arrivare due volte, una per ogni invio scaduto. La coda vive nello stesso archivio e sotto la stessa quota di disco di un filo durable, e si svuota dopo un riavvio senza un'esecuzione e senza un browser. Senza durable, un messaggio che il broker perde è un errore sul filo di errore.

### Un database che si ferma

`dia-postgres-out` scrive ogni record che riceve come una riga, nella tabella che indichi, tramite un server `hotloop-flow-postgres`. I campi di un record vanno nelle colonne con lo stesso nome, quindi un record con `n` e `sensor` riempie le colonne `n` e `sensor`. Elenca le colonne, separate da virgole, per scriverne solo alcune o fissarne l'ordine; lascia la lista vuota e il nodo usa i campi del record. Il nodo viene eseguito a ogni passaggio di un ciclo, quindi un ciclo scrive una riga per passaggio. Una tabella o una colonna che non è un nome semplice è un problema alla distribuzione, mai un'istruzione a metà esecuzione. Un numero intero va ugualmente in una colonna integer, float o numeric, e un record o un array entra così com'è, che è ciò che accetta una colonna json o jsonb.

Indica una **colonna dell'ora** e ogni riga riceve l'ora in cui è arrivata al nodo. È l'ora in cui è stata fatta la lettura, non quella in cui è stata scritta: una riga che ha atteso cinque minuti su disco porta ancora il minuto in cui è stata fatta.

Senza **Conserva ciò che il database perde**, una riga che il database non accetta è un errore sul filo di errore del nodo e va persa. Con l'opzione, la riga entra subito finché il database risponde. Quando il database non risponde, la riga viene registrata nell'archivio durable di Flow prima che il nodo finisca, e l'uscita `sent` del nodo dice `false`. Le righe aspettano su disco, sopravvivono a un riavvio e vengono scritte in ordine quando il database torna, senza che nulla di ciò che entra dopo le superi. Un arretrato viene scritto con molte righe per istruzione, fino a 256, così quello accumulato mentre il database era assente si recupera in pochi secondi e non alla velocità di un viaggio di andata e ritorno per riga. Il test lascia 30.000 righe in attesa su disco, la dimensione di cinque minuti a 100 al secondo, e tutte vengono scritte in ordine entro pochi secondi dal ritorno del database.

La consegna dal disco è almeno una volta. Una riga il cui insert è stato inviato quando il collegamento è caduto può essere stata confermata con la risposta persa, e viene inviata di nuovo, quindi può essere scritta due volte, al massimo un lotto. Se è importante, dai alla tabella una chiave univoca e scegli **Salta la riga** in In caso di conflitto: la seconda viene allora scartata dal database.

Una riga che il database rifiuta per ciò che contiene, come un valore troppo grande per la sua colonna o una chiave già presente con In caso di conflitto lasciato su Genera un errore, verrebbe rifiutata ogni volta. Viene lasciata andare con un evento di controllo, `diagram.row_rejected`, che porta la riga, e le righe dietro vengono scritte. Senza questo, una sola riga errata fermerebbe il log. Un database fermo, una tabella non ancora presente e una password errata non sono questo caso: quelle righe aspettano.

### Strumenti

`dia-instr-open` accetta un indirizzo: `10.0.0.5:5025` per uno strumento di rete su un socket grezzo, `serial:///dev/ttyUSB0?baud=19200&data=8&parity=E&stop=1` per uno seriale, oppure un semplice `/dev/ttyUSB0` o `COM3` per 9600 8N1. L'esecuzione chiude la sessione quando finisce. Se il collegamento cade, la query successiva lo riapre e la caduta viene contata sulla sessione.

`dia-instr-query` scrive un comando e il terminatore, poi legge la risposta. Scegli testo (una riga, da `reply`), none (una semplice scrittura) o block, che legge un blocco binario `#41024...` e mette i campioni fuori da `samples` come array, come int8, uint8, int16, uint16, int32, float32 o float64, big o little endian. Un blocco indefinito `#0` termina alla prima fine riga. Una risposta che non arriva in tempo è un timeout sul filo di errore con l'indirizzo.

`dia-scpi-parse` legge una risposta di testo come una lista di numeri, un numero, un'identità (`*IDN?` in produttore, modello, numero di serie e firmware) o un byte di stato (`*STB?` o `*ESR?`) nei nomi dei suoi bit attivi.

### Seriale

Una porta che sparisce, come un cavo staccato o un adattatore scollegato, è un guasto sul filo di errore della lettura. La lettura successiva prova a riaprirla, una volta al secondo, e conta la perdita e il ritorno. Una porta ha il controllo di flusso, nessuno, hardware (RTS e CTS) o software (XON e XOFF), su Linux, impostato sul terminale stesso; uno pseudo terminale mostra che l'impostazione è arrivata, e ciò che fanno le linee su un adattatore reale non è stato dimostrato.

### Acquisizione dati

`dia-daq-read` legge un'attività da hardware NI, come uno chassis CompactDAQ, tramite il gRPC Device Server aperto di NI. Flow parla con quel server in rete, quindi l'hardware può stare su una macchina diversa da Flow, e Flow non ha bisogno di alcun driver NI né di una libreria del fornitore. Resta un solo binario statico.

**Sulla macchina a cui è collegato l'hardware**, installa il driver DAQmx di NI e il gRPC Device Server di NI (https://github.com/ni/grpc-device, con licenza MIT). Il server ascolta solo su quella macchina (`localhost`, porta 31763) finché il suo file di configurazione non dice altro. Per raggiungerlo da Flow su un'altra macchina, imposta `address` nel suo `server_config.json` su `[::]` o sull'interfaccia che vuoi, e attiva TLS impostando `server_cert`, `server_key` e, per il TLS mutuo, `root_cert`, con i file nella cartella `certs` accanto alla configurazione. Il README di NI ha i dettagli per la versione che usi. Non lasciare aperta su una rete di stabilimento la porta predefinita non protetta del server: chiunque la raggiunga può comandare l'hardware.

**Nel nodo**, imposta:

* `address` su `host:port` del server.
* `tls` su `off` (solo per un server sulla stessa macchina), `on` (Flow verifica il certificato del server con `caFile`, o con le autorità di sistema se è vuoto) o `mutual` (Flow presenta anche `certFile` e `keyFile`, che il server verifica con il suo `root_cert`). `serverName` è il nome da cercare nel certificato del server quando non è l'host di `address`.
* `device` e `channels` per indicare l'hardware, come `cDAQ1Mod1` e `ai0:3`, o una lista come `ai0, ai2`. `kind` è `voltage`, `current` o `thermocouple`, con `min` e `max` per l'intervallo previsto e `terminal` per il cablaggio. Le termocoppie accettano un `tcType` e una `unit` e usano la compensazione del giunto freddo del modulo stesso.
* `mode`, `rate` e `samples`. La modalità finita esegue un'acquisizione di `samples` per canale a `rate` a ogni chiamata, riavviandola ogni volta. La modalità continua avvia l'attività alla prima chiamata e ogni chiamata legge i `samples` successivi, così un nodo nel corpo di un ciclo legge un flusso blocco per blocco. `trigger` avvia l'attività su un fronte digitale a un terminale come `/cDAQ1/PFI0`.

`y` sono i campioni come array per un canale, o un array di array, uno per canale nell'ordine in cui li hai indicati. `dt` sono i secondi tra i campioni, uno diviso la frequenza, quindi la durata di un blocco in secondi è il numero dei suoi campioni per `dt`: 1.000 campioni a 1.000 campioni al secondo coprono 1,000 s. Il clock del dispositivo stesso data i campioni, come sempre. Flow sposta soltanto i dati. Un rifiuto del server o del driver esce su `err` con il codice e il testo del driver, e un server che non risponde entro `callTimeoutSec` è un timeout. L'attività vive per tutta l'esecuzione e viene cancellata sul server quando finisce, così l'hardware torna libero.

Che cosa è fatto: ingresso analogico di tensione, ingresso analogico di corrente e temperatura da termocoppia, finiti o continui, con un clock di campionamento e un trigger digitale di avvio facoltativo. Che cosa no: ingressi e uscite digitali e contatori usano altre chiamate di lettura e non sono costruiti, come non lo sono le scritture, altri tipi di trigger o la scala oltre ciò che fa il modulo.

Il nodo è stato eseguito contro un server sostitutivo che parla le stesse chiamate e risponde con una sinusoide, e su hardware reale (2026-11-17).

## Il pannello

`/panel/<diagram id>` su un runtime apre una pagina con i controlli, gli indicatori e i grafici del diagramma, con l'accesso fatto come per l'editor. È fatta per essere usata con il pollice: niente al suo interno è più piccolo di un dito. Un grafico conserva i suoi ultimi 1.024 punti a meno che tu non lo cambi, e dice quanti ne ha lasciati cadere. Un grafico sostituisce i suoi dati a ogni array. Un grafico XY traccia x contro y e tiene anche la storia. Un grafico a intensità accetta una griglia, un array di righe di numeri tutte della stessa lunghezza (fino a 512 per 512), e disegna ogni valore come un colore dal più piccolo al più grande che contiene, sostituendo l'immagine a ogni griglia; un array piatto o una griglia irregolare è un errore sul filo di errore del nodo.

Più persone possono seguire una stessa esecuzione. Impostare un controllo dal browser richiede `diagram.run`, viene verificato sul server e scritto nel registro di controllo.

## Controlli

Un `dia-control` ha un **tipo** (che cosa contiene) e un **aspetto** (come lo disegna il pannello). Il server verifica ogni valore rispetto al tipo, qualunque sia l'aspetto, quindi uno script che chiama `PUT /diagrams/{id}/controls/{node}` è soggetto alle stesse regole di un dito. Ciò che un operatore imposta è sul pannello appena il diagramma è distribuito, prima della prima esecuzione, e il nodo di controllo dà al diagramma quel valore a ogni esecuzione.

| Tipo | Aspetti | Che cosa legge il diagramma |
|---|---|---|
| `number` | `entry` (digitato), `spin` (digitato, con un pulsante meno e un pulsante più che avanzano di `step` e si fermano all'intervallo), `slider`, `knob` | un numero, limitato a `min` e `max` quando sono impostati |
| `bool` | `switch`, `button` (una pressione lo imposta a true, e `latch` lo riporta quando il diagramma lo legge), `led` (un LED che si preme) | vero o falso |
| `string` | una casella di testo | testo |
| `enum` | un menu a discesa di `options` | una delle opzioni |
| `array` | una lista a cui l'operatore aggiunge e toglie voci | una lista di numeri, interruttori o testo, secondo `elem`; `min` e `max` limitano ogni numero, e `maxlen` limita la lunghezza |
| `record` | un ingresso per campo | un oggetto con esattamente i `fields` (`rate:number, on:bool, note:string`), ogni campo sempre presente |

Uno slider e un knob hanno bisogno di un valore minimo e di uno massimo. Un knob senza entrambi è un avviso alla distribuzione e viene disegnato come una voce digitata finché non li ha (uno slider faceva già lo stesso). Il knob è una manopola che gira di 270 gradi: trascinala con il mouse o con un dito, premi su di essa per portarla lì, oppure usa i tasti freccia (un `step`), Pagina su e Pagina giù (dieci passi), Home e Fine. Scrive quando lo rilasci. Il valore iniziale di un array è JSON (`[1, 2, 3]`) o una semplice lista separata da virgole (`1, 2, 3`), e il valore iniziale di un record è un oggetto JSON (`{"rate": 3}`); un campo omesso parte vuoto. Un record senza campi, un nome di campo sconosciuto o un valore iniziale che non va bene è un problema alla distribuzione.

Ogni pulsante, campo, interruttore e manopola del pannello è grande almeno 44 pixel in entrambe le direzioni, e la pagina non scorre di lato su un telefono da 390 pixel.

Un controllo viene scritto quando cambia, e il diagramma lo legge quando il nodo di controllo viene eseguito; non esiste un controllo che avvii un'esecuzione o faccia scattare un nodo da solo quando cambia. È la struttura a eventi, e non è costruita.

## Che cosa non è

Un diagramma gira in un processo Go su un sistema operativo generico. Il garbage collector e lo scheduler possono ritardare un nodo di millisecondi, quindi un nodo non può promettere una scadenza. Il lavoro che deve rispettarne una appartiene a un PLC o a un runtime costruito per questo. La temporizzazione dei campioni di un dispositivo di acquisizione dati non è toccata da niente di tutto questo: la fa il clock del dispositivo, e Flow sposta soltanto i dati.

## Test di un diagramma

Un file di test di flusso può contenere un test di un diagramma accanto ai test dei messaggi. Imposta i controlli del diagramma, lo esegue una volta con il vero motore dei diagrammi e dice che cosa contengono i suoi indicatori:

```yaml
tests:
  - name: weighs and flags a heavy load
    diagram:
      name: Scale logger          # the diagram's name or id
      controls: {Limit: 10}       # by label or id, checked like an operator's entry
      expect:
        Weight: 12.5              # a number matches to within a millionth
        Heavy: true
        Reading: {min: 12, max: 13}
```

Un controllo che il diagramma non ha, un valore che rifiuta, un indicatore che non lo è, un nome condiviso da due elementi e un diagramma che non può essere eseguito sono errori con il loro motivo. Un diagramma con un nodo che uscirebbe dal test (una porta seriale, uno strumento, un dispositivo di acquisizione dati, MQTT in uscita, una scrittura HotLoop, un file di log) viene rifiutato, perché un test di diagramma non ha un sostituto per loro. Un dispositivo seriale simulato, per provare un cavo staccato o una serie di frame spazzatura, non è costruito.

## L'elenco errori in CI/CD

`hotloop-flow test` e il controllo di distribuzione eseguono la verifica dell'editor su ogni diagramma del file di flusso. Un diagramma che non può essere eseguito è elencato come `--- DIAGRAM: <diagram>: <node> input <port>: <reason>` e fa fallire il file anche se tutti i test passano; il rapporto JUnit riporta ognuno come errore di tipo `diagram`. Un avviso, come una struttura a casi senza predefinito, è elencato e non fa fallire.

## Forme d'onda

Una forma d'onda è un blocco di campioni equidistanti che sa quando è iniziato e quanto distano tra loro, come record sul filo: `{"type": "waveform", "t0": "2026-11-14T12:00:00Z", "dt": 0.001, "y": [...], "attrs": {"unit_string": "V"}}`. `dia-wave` ne costruisce una da un array (il passo da `dt`, altrimenti `rate`, altrimenti la sua impostazione; l'inizio da `t0`, altrimenti dal momento in cui viene eseguito) e `dia-wave-parts` ne scompone una, compresa la durata che copre. Una forma d'onda contiene al massimo `maxSamples` campioni (1.048.576 per impostazione predefinita); il resto viene tagliato e contato su `dropped`. I nodi di analisi accettano una forma d'onda dove prendono un array e ne usano il passo. `dia-log-tdms` scrive una colonna di forma d'onda come un canale con `wf_start_time`, `wf_increment`, `wf_samples` e gli attributi come proprietà del canale.

## Sotto-diagrammi

`dia-sub` è un diagramma usato come nodo: i suoi ingressi e le sue uscite sono il connettore, ogni ingresso un `dia-body-in` con quel nome nel suo corpo e ogni uscita un `dia-body-out`. Un ingresso è obbligatorio a meno che il suo nome finisca con `?` (facoltativo) o `~` (consigliato: viene eseguito senza e la distribuzione avvisa quando non è collegato). Seleziona dei nodi e fanne un sotto-diagramma (`POST /diagrams/{id}/sub`) e i nodi passano in una nuova scheda di corpo, un `dia-sub` prende il loro posto, e il connettore viene ricavato dai fili che attraversano il bordo della selezione: un ingresso per ogni uscita sorgente che alimenta la selezione, un'uscita per ogni uscita selezionata che alimenta i nodi esterni. I fili esterni vengono ricollegati, quindi un'esecuzione dà le risposte di prima.

## Tipi di record condivisi

Un tipo di record viene indicato una volta sola, nelle impostazioni di una scheda di diagramma, sotto `types`, e ogni `dia-bundle` o `dia-field` che imposta `shape` al suo nome viene verificato rispetto a quell'unica definizione:

```json
{"types": {"Reading": {"fields": {"pressure": "number", "ok": "boolean", "state": {"enum": ["idle", "run"]}}}}}
```

Un campo è `number`, `integer`, `boolean`, `string`, `timestamp`, `array`, `waveform`, `record:Name` (un altro tipo condiviso) o un enum. Rinomina un campo nella definizione e ogni bundle che usa ancora il vecchio nome è un problema alla distribuzione successiva, nello stesso elenco di errori di un ingresso non collegato, con il nodo e il campo. Un bundle vincola ogni valore al tipo del suo campo quando viene eseguito, e il filo di errore porta un valore che non va bene. `Set.Schema` dà lo stesso tipo come JSON Schema, che è ciò che controllano i fili tipizzati.

## Rotazione e conservazione

`dia-log-text` e `dia-log-tdms` possono iniziare un nuovo file quando quello attivo raggiunge `rotateMB` megabyte o `rotateHours` ore, e tenere solo i `keep` file terminati più recenti. Il file terminato prende il nome del log con l'ora di chiusura prima dell'estensione (`bench.csv` diventa `bench-20261114T120000Z.csv`) e il log prosegue in `bench.csv`, con una nuova intestazione, o con le proprietà del file scritte di nuovo per TDMS. La conservazione elimina solo i file che corrispondono a quel modello, mai il log attivo e mai un file che sta soltanto accanto. L'età conta da quando un'esecuzione scrive per la prima volta nel file. Il log di testo si apre in un foglio di calcolo e il log TDMS è il formato binario per i dati grandi.

## Modificare una struttura a casi e scegliere un diagramma

I casi di una struttura a casi sono righe con un nome di caso e un selettore di diagramma, con un secondo selettore per il caso predefinito, e la proprietà che indica il diagramma che un ciclo o un sotto-diagramma esegue è anch'essa un selettore. I selettori elencano i diagrammi FlowLab del file di flusso e memorizzano l'id della scheda; un nome scritto a mano in un vecchio file di flusso viene mostrato come quella scheda e salvato come il suo id, che il runtime legge allo stesso modo. I valori memorizzati sono lo stesso JSON di prima (`cases` è un oggetto da nome del caso a diagramma), quindi un file di flusso modificato nella finestra e uno modificato a mano sono lo stesso file.

## Aprire un sotto-diagramma sul posto

Un nodo di sotto-diagramma ha una piccola casella nell'angolo in alto a destra. Premila, oppure seleziona il nodo e premi **Apri sul posto** nella barra del diagramma, e il nodo viene disegnato aperto dov'era: una cornice con il nome del sotto-diagramma, il suo connettore indicato sui due bordi (gli ingressi a sinistra, le uscite a destra, con le porte `after` e `done` e il filo di errore come ogni nodo), e dentro i nodi e i fili del suo corpo. Niente si apre in una seconda finestra e la scheda in cui sei non cambia. I fili che portavano al nodo portano al connettore della cornice, e una linea tratteggiata tenue va da ogni nome del connettore al nodo body in o body out con quel nome. La casella nella barra del titolo della cornice (o **Chiudi sul posto**) la richiude.

Ciò che è disegnato dentro la cornice sono i nodi del corpo stesso, non una copia. Selezionane uno, trascinalo, fai doppio clic per le sue proprietà, cambia il suo valore o eliminalo, e hai modificato il corpo, come un solo passo annullabile, e una distribuzione lo salva. Spostare la cornice dalla sua barra del titolo sposta il nodo di sotto-diagramma, e il corpo lo segue. Un filo collega due nodi dello stesso diagramma, quindi un filo da un nodo esterno a un nodo interno viene rifiutato a parole; collega al connettore della cornice. Zoom, spostamento, adatta e selezione ad area funzionano come ovunque.

Quali sotto-diagrammi sono aperti è il modo in cui stai guardando il diagramma. Non è nel file di flusso, non è un passo di annullamento, e un ricaricamento li chiude tutti, quindi aprirne uno non cambia mai ciò che invia una distribuzione. Un sotto-diagramma dentro uno aperto ha la sua casella e si può aprire anch'esso, fino a tre livelli. Un corpo già aperto altrove non viene aperto una seconda volta, e un sotto-diagramma il cui corpo porta a un diagramma già aperto viene disegnato chiuso, quindi un diagramma che contiene se stesso non può mandare in ciclo l'editor. Un corpo non indicato da nulla, o da un nome che due diagrammi condividono, non ha casella, perché neanche il runtime riesce a trovarlo. Anche i cicli e le strutture a casi hanno corpi e non si aprono ancora sul posto.

## Creare un sotto-diagramma nell'editor

Con dei nodi selezionati su un diagramma, **Selezione in sotto-diagramma** nella barra chiede un nome, chiama `POST /diagrams/{id}/sub` con il file di flusso che ha l'editor e carica la risposta come una modifica annullabile: i nodi passano in una scheda a parte e un nodo di sotto-diagramma prende il loro posto, con ingressi e uscite ricavati dai fili che attraversano la selezione. Non viene salvato nulla finché non si distribuisce.

## Riprodurre un'esecuzione

Evidenzia l'esecuzione rallenta un'esecuzione mentre procede. **Riproduci l'ultima esecuzione**, in basso nella tela, riproduce un'esecuzione già finita, da ciò che ha registrato, così puoi seguirla a posteriori. Illumina i fili e segna i nodi come ha fatto l'esecuzione in diretta, un evento alla volta, alla velocità che scegli (Lenta, Normale, Veloce o Molto veloce), e alla fine la tela mostra ciò che l'esecuzione ha lasciato. **Interrompi la riproduzione** la termina prima. Non cambia nulla nel runtime e non avvia nulla: il pulsante è disattivato mentre un'esecuzione è in corso, e una riproduzione termina quando passi a un'altra scheda.

Ogni esecuzione registra gli inizi e le fini dei suoi nodi e ogni valore che ha attraversato un filo, fino a 20.000 eventi. Un'esecuzione più lunga conserva i suoi primi 20.000, lo dice quando la riproduci, e la riproduzione mostra quell'inizio, perché una riproduzione che iniziasse a metà non avrebbe da dove partire. I valori sono conservati come le brevi anteprime che mostrano i fili, quindi un array di migliaia di campioni è la sua lunghezza e i suoi primi valori. La registrazione è quella dell'ultima esecuzione, e una nuova la sostituisce; non viene salvata dopo un riavvio. `GET /diagrams/{id}/trace` è la stessa registrazione per uno script.

## Layout ordinato

**Riordina il layout**, nella barra delle schede, dispone i nodi visibili in modo che i dati si leggano da sinistra a destra e nessun filo attraversi un nodo. La colonna di un nodo è la catena di fili più lunga che porta a esso. Un filo che salta delle colonne riceve una corsia attraverso di esse, i nodi di una colonna vengono ordinati per sbrogliare gli incroci, e poi ogni filo lungo viene controllato lungo la curva con cui è disegnato rispetto ai nodi delle colonne che attraversa, e un nodo d'intralcio viene spostato. Il blocco conserva il suo angolo in alto a sinistra, e il tutto è una sola modifica annullabile. In un ciclo di cablaggio il filo che lo chiude viene lasciato fuori dalla classifica, quindi va all'indietro invece di far andare in ciclo il layout.

## Nomi dei fili

Un filo di un diagramma è indicato nel suo punto medio, con l'uscita da cui viene (`sum`, `result`, `iterations`), accanto al suo tipo quando un'estremità ne dichiara uno, e passandoci sopra si vede ancora l'ultimo valore che ha portato.

## Zoom

La tela fa zoom dal 5 % al 400 % intorno al puntatore, e legge il suo zoom come `data-zoom` sulla tela.

## Impostare un oggetto del pannello per nome

`dia-panel-set` cambia una proprietà di un controllo o di un indicatore mentre il diagramma è in esecuzione, tramite l'etichetta dell'oggetto (o il suo id): `visible` e `enabled` accettano true o false, `color` accetta red, amber, green, blue, gray o default, `label` accetta testo, e `min` e `max` accettano un numero per un controllo numerico. Un controllo disattivato rifiuta ciò che imposta un operatore, un oggetto nascosto non viene disegnato, e il pannello che un operatore ha aperto lo segue. Un nome che non corrisponde a nessun oggetto, o a più di uno, è un problema alla distribuzione quando è scritto sul nodo e un errore sul filo quando arriva da un filo, e un'esecuzione parte dal pannello com'era stato progettato.

## Simboli

Ogni tipo di nodo FlowLab è disegnato con un simbolo nostro al centro del suo corpo (un più per la matematica, una sigma per la statistica, una sinusoide per una forma d'onda, una spina per una porta seriale), accanto alla sua etichetta di testo. Sono semplici tratti disegnati in `web/src/lib/symbols.ts`, non un font di icone né l'opera di qualcun altro, e un test fallisce quando un tipo di nodo di diagramma nomina un'icona non disegnata.

## Scrivere sulle apparecchiature: la porta di scrittura

Un diagramma comanda un'apparecchiatura in un solo modo: `dia-hotloop-write`. Invia il suo valore a un tag in HotLoop (`device/tag`, impostato sul nodo o ricevuto da un filo) attraverso la porta di scrittura di HotLoop, che decide, nel proprio ordine, che le scritture sono attive, che il tag è armato e che il valore è nell'intervallo. Flow non scrive mai da solo su una macchina. HotLoop registra ogni tentativo, rifiutato o no, con il motivo `flow:<diagram>/<node id>`, così il suo registro di controllo indica il diagramma e il nodo. Un rifiuto è un errore sul filo di errore del nodo con il motivo della porta stessa (codice 5006), e lo è anche un HotLoop non raggiungibile; in entrambi i casi la scrittura non avviene, e il nodo rifiuta di essere distribuito senza un HotLoop selezionato. I nodi seriale e strumento grezzi parlano con strumenti da banco (multimetri, alimentatori, carichi), che non hanno un tag in HotLoop, quindi hanno un interruttore proprio (sotto).

## L'interruttore di scrittura degli strumenti

Leggere uno strumento non cambia nulla ed è sempre aperto. Scriverlo può cambiare qualcosa: l'uscita di un alimentatore, l'alta tensione di un hipot, la corrente di un carico. Per questo ogni strumento parte con le scritture **disattivate**, e una scrittura da un diagramma viene rifiutata finché qualcuno con il permesso `instrument.write` attiva le scritture di quello strumento, uno strumento alla volta.

- **Che cosa conta come scrittura.** `dia-serial-write` è sempre una scrittura. `dia-instr-query` è una lettura quando il suo comando è una query (ogni istruzione SCPI al suo interno finisce con `?`, come `*IDN?` o `MEAS:VOLT?;MEAS:CURR?`) e una scrittura altrimenti (`OUTP ON`, `VOLT 5`, `*RST` o `VOLT 5;MEAS:VOLT?`). Un comando ricevuto da un filo viene contato come uno che può scrivere.
- **Quale strumento.** Lo strumento è il suo indirizzo: `tcp://host:port` o `serial:///dev/ttyUSB0`, senza le impostazioni seriali, così uno strumento aperto in due modi è un solo interruttore.
- **Un rifiuto** è un errore sul filo di errore del nodo (codice 5007) che dice che le scritture su quello strumento sono disattivate, e lo strumento non sente mai il comando.
- **Attivarlo.** `PUT /instruments/writes` con `{"instrument": "tcp://10.0.0.5:5025", "allowed": true, "note": "bench 2"}`, che richiede `instrument.write` (un amministratore lo ha) e viene conservato in `instrument-writes.json` nella cartella dei dati, così un riavvio non cambia nulla. `GET /instruments` elenca ogni strumento con un interruttore o con un diagramma distribuito che vi scriverebbe, con chi l'ha impostato e i diagrammi e i nodi coinvolti.
- **Controllo.** Ogni cambio di interruttore è `instrument.switch`, e ogni scrittura di un diagramma è `instrument.write` o, quando rifiutata, `instrument.refused`, con il diagramma, il nodo, lo strumento e il comando.
- **La distribuzione lo dice.** Un nodo che scriverebbe su uno strumento è una nota sul diagramma (le **note** della barra, e l'elenco che stampa `hotloop-flow test`), che indica lo strumento e dice che le sue scritture sono disattivate finché qualcuno non le attiva. I file di flusso che si limitano a leggere non cambiano.

## Portare un VI LabVIEW

Importa un `.vi` nella finestra Importa dell'editor (o `import_vi` via MCP, o `POST /flows/import-vi`) e FlowLab legge ciò che può ed elenca, prima di aggiungere qualsiasi cosa, ciò che non ha potuto leggere. Leggi docs/labview-import.md: dice esattamente che cosa passa e che cosa no. La versione breve: il nome del VI, la sua descrizione, la sua versione, i nomi del pannello frontale e i VI che chiama passano, come nota su un flusso a parte. I fili e le primitive del diagramma a blocchi non passano, quindi il diagramma lo disegni tu con quei nomi accanto.
