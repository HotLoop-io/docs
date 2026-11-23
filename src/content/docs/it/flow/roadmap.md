---
title: "Roadmap di Flow"
description: "Le fasi di Flow, cosa è fatto e cosa viene dopo, compresa la riscrittura dell'editor in Astro."
---

Cosa diventerà HotLoop Flow, nell'ordine in cui viene costruito. Se non è in questo elenco non verrà fatto, quindi mettetelo nell'elenco.

Flow si costruisce accanto a HotLoop e resta un prodotto a sé. FlowLab e i suoi diagrammi, la Fase 9, sono un pacchetto separato che sta accanto al motore dei messaggi.

## A cosa serve Flow

Un motore di flussi visuale per la fabbrica. Ogni distribuzione viene confrontata, testata e a un clic dal ripristino. Quando qualcosa va storto alle 3 di notte, vedete esattamente quale strada ha fatto un messaggio e com'era a ogni passaggio. Gira in un unico binario statico abbastanza piccolo per un Pi, e non cede quando un sensore diventa chiacchierone.

Legge anche i vostri `flows.json` esistenti senza modifiche. È un vantaggio, non lo scopo.

Le regole con cui esce ogni punto qui sotto:

- Niente segnaposto. Se non è costruito, provato sul reale e funzionante, non è spuntato.
- Tutto ciò che può comandare un'apparecchiatura passa per una porta che può dire di no, e dice perché.
- Niente viene buttato via in silenzio. Ogni scarto, rifiuto e overflow viene contato e compare nelle metriche.
- Il file dei flussi continua a caricarsi e a salvarsi byte per byte. I dati nuovi vanno in chiavi che gli altri strumenti ignorano, e il test di andata e ritorno copre i file che le portano.

---

### Fase 0: dire la verità

Il README dichiara cose che il codice non sostiene. Si corregge prima di promettere qualcosa di nuovo, perché un README che mente una volta viene letto come se mentisse sempre.

- [x] Il sandbox WASM è reale e testato, ma nessun nodo lo usa e non è nel binario. Lo si dice finché la Fase 6 non lo rende vero
- [x] Due commenti nel codice rimandano a un archivio di contesto incorporato che non esiste. Si cancellano
- [x] Rimisurare la memoria a riposo e sotto carico nello stesso modo sulla stessa macchina, pubblicare il comando insieme al numero e scartare ogni cifra che nessuno può riprodurre
- [x] CVE-2025-41656 è un fornitore che consegna un altro motore di flussi con l'autenticazione disattivata, non una CVE di quel motore. Si corregge l'attribuzione nel README e nella riga `exec` di `docs/compatibility.md`
- [x] Riscrivere l'inizio del README attorno a ciò che Flow fa. L'importazione di flussi esistenti passa in una sezione propria più in basso, con l'andata e ritorno esatta al byte e `hotloop-flow import` come prova
- [x] La documentazione di distribuzione parla di Kubernetes, Podman e Quadlet, non dell'App Store di una sola azienda
- [x] Test per i pacchetti che non ne hanno: `api` (accesso, permessi, il 409 su una distribuzione obsoleta), `config` (ogni rifiuto all'avvio che elenca il README) e `cmd` (la distribuzione scrive il file dei flussi prima di fermare il vecchio runtime), più `js`, il sandbox del nodo Function, che non ne aveva nemmeno

### Fase 1: storico, differenze, ripristino

Ogni distribuzione è un record: chi, quando, una nota, i byte esatti e cosa è cambiato. «Cosa è cambiato, chi l'ha cambiato, rimettetelo a posto» è la prima cosa che tutti chiedono dopo il fermo di una linea, e oggi la risposta sono tre file `.bak`.

- [x] Registro delle distribuzioni: ogni distribuzione è un record immutabile con utente, ora, una nota facoltativa, i byte del flusso e le credenziali cifrate com'erano. La conservazione è un'impostazione. `GET /deployments`
- [x] Differenza semantica: nodo per nodo, proprietà per proprietà. Aggiunto, rimosso, cambiato, ricablato. Trascinare un nodo compare come layout, mai come cambio di logica. Via API e come `hotloop-flow diff a.json b.json`
- [x] La differenza funziona come difftool di git, così una pull request su un flusso si legge «soglia della regola 2 da 7,5 a 8,0» invece di un blocco di JSON
- [x] Ripristino: ridistribuisce un vecchio record come uno nuovo, credenziali comprese, così un nodo che avete eliminato torna con la password del suo broker. Lo storico resta solo in aggiunta
- [x] Editor: pannello dello storico, la differenza disegnata sulla tela, «rivedi e distribuisci» con una nota, un pulsante di ripristino. Un conflitto di distribuzione mostra cosa ha cambiato l'altra persona invece di una finestra sì/no
- [x] Flussi come codice: `hotloop-flow deploy` e `hotloop-flow export` per la CI/CD, con un token solo per la distribuzione, così una pipeline non tiene mai una password di amministratore
- [x] Mirror git facoltativo: ogni distribuzione inviata come commit firmato da chi ha distribuito. Go puro, e il controllo sulla dimensione del binario continua a passare
- [x] Registro di controllo: accessi, accessi falliti, distribuzioni, ripristini e iniezioni, ciascuno con chi e da dove. Il registro delle distribuzioni ne è la prima tabella
- [x] MFA (TOTP), gratuita e attivabile da chiunque la voglia. Niente di ciò che riguarda l'accesso sicuro viene mai messo a pagamento
- [x] Limite ai tentativi di accesso e blocco, sessioni che sopravvivono a un riavvio, e il token del websocket inviato come sottoprotocollo invece che nell'URL. Un token nell'URL funziona ancora per gli script esistenti e registra un avviso, perché romperli a un aggiornamento era peggio della fuga; toglierlo aspetta una versione maggiore

### Fase 2: test dei flussi

«La mia modifica ha rotto la linea?» trova risposta prima della distribuzione, non dopo. I test sono YAML accanto ai flussi, quindi si confrontano e si rivedono allo stesso modo.

- [x] `hotloop-flow test`: il runtime vero e i nodi veri, nello stesso processo. Iniettate un messaggio, aspettate ciò che esce da una porta entro un termine, aspettate niente, aspettate che un errore arrivi a un Catch. Output JUnit per la CI/CD
- [x] I/O virtualizzato: un MQTT out, una scrittura su database o una richiesta HTTP in un test registrano ciò che avrebbero inviato e non toccano mai la rete
- [x] Orologio virtuale: un Delay di cinque minuti gira in millisecondi, e ogni nodo di temporizzazione è provato su di esso
- [x] Fixture di contesto e di credenziali, e asserzioni sul contesto dopo. Un test non può appoggiarsi a ciò che ne ha lasciato un altro
- [x] Barriera di distribuzione: se attiva, una distribuzione che fallisce i suoi test viene rifiutata con le asserzioni che falliscono, e i flussi già in esecuzione non se ne accorgono
- [x] Editor: trasformate un messaggio di debug catturato in un test con due clic, eseguite la suite dall'editor, con esito positivo e negativo sui nodi

### Fase 3: tracciamento e riproduzione

- [x] Cliccate un messaggio di debug e la tela illumina il percorso che ha fatto, con tempi e payload a ogni passaggio, attraverso divisioni, unioni e sottoflussi
- [x] Buffer di traccia limitato. La memoria resta piatta in un soak test da un milione di messaggi, e il numero viene pubblicato
- [x] Riprodurre un messaggio catturato in una bozza del flusso e confrontare l'output
- [x] Una traccia catturata diventa un test della Fase 2
- [x] Esportazione OpenTelemetry, provata su un collector vero

### Fase 4: stato durevole

Un historian fermo per un'ora non dovrebbe costarvi un'ora di letture.

- [x] Contesto persistente in SQLite, Go puro senza cgo, con le operazioni atomiche (confronta e scambia, incrementa, aggiorna). Un solo archivio per il contesto ora e per le code durevoli dopo, non due. Oggi il contesto del flusso e quello globale spariscono a ogni riavvio, ed è la lacuna che più probabilmente morderà qualcuno per prima. Scritto in differita in una transazione ogni trenta secondi, e un valore impostato a ciò che era già non scrive nulla
- [x] Collegamenti durevoli: segnate un collegamento come durevole e la sua coda si riversa in quello stesso archivio invece di bloccarsi o scartare. Sopravvive a un riavvio, mantiene l'ordine, rispetta una quota di disco, e la profondità è una metrica. Segnato nel file dei flussi con `ew_durable`, così l'andata e ritorno resta esatta al byte. Doppio clic su un collegamento nell'editor per segnarlo
- [x] Store-and-forward provato nel modo duro: uccidere l'InfluxDB vero per dieci minuti con un ingresso costante, rimetterlo in piedi, contare le righe. Nessuna mancante, nessuna doppia. Poi kill -9 al runtime a metà coda e contare di nuovo. Lo script, i conteggi e le scritture su disco all'ora sono in [durable/](/it/flow/durable-state/)
- [x] Provato su un Pi 5 vero: memoria, tempo di avvio e throughput sostenuto, in [docs/bench](/it/flow/benchmarks/#risultati-su-un-raspberry-pi-5), con il throttling che ha mostrato
- [ ] Provato su un Pi 4 e uno Zero 2 W, e le scritture all'ora su una scheda SD, perché un archivio di contesto che consuma una scheda SD è un bug. Aperto perché servono le schede. Il Pi 5 è misurato; un numero preso da un'altra macchina sarebbe inventato

### Fase 5: la fabbrica

`scan` oggi trova un PLC e nulla nella palette può parlargli. È il buco più grande di un prodotto fatto per gli impianti.

- [x] Modbus TCP lettura e scrittura
- [x] OPC UA lettura, sottoscrizione e scrittura
- [x] S7 lettura e scrittura
- [x] Sparkplug B, come nodo di bordo e come host
- [x] EtherNet/IP lettura e scrittura
- Tutto su simulatori. Nessuna CPU Siemens né controllore Logix ha avuto davanti nulla di tutto questo
- [x] Nodi HotLoop: cambi di entità in ingresso, stato di entità, chiamata di uno script, applicazione di una ricetta. Ogni comando passa per la porta di scrittura di HotLoop e finisce nel suo registro come `flow:<node id>`, e una scrittura che la porta rifiuta arriva a un nodo Catch con il motivo della porta
- [x] Quando HotLoop c'è, le scritture di Flow sulle apparecchiature passano per la porta di HotLoop invece di andare dritte al PLC. Entrambe sono uscite nella 2.3.0. Una scrittura attraverso la porta vera è provata per Modbus su un'immagine HotLoop pubblicata; i nodi di scrittura OPC UA, S7 ed EtherNet/IP inviano con lo stesso codice e un test verifica che ciascuno offra la porta.

### Fase 6: plugin senza npm

- [x] Un nodo `wasm` sull'host che esiste già: tetto di memoria rigido, un timeout, e un guest che supera l'uno o l'altro si ferma senza trascinare giù nient'altro
- [x] Formato dei plugin: il modulo, un descrittore perché l'editor disegni la sua finestra, e una firma. I plugin non firmati o manomessi rifiutano di caricarsi e dicono perché
- [x] Capacità: un plugin non ha alcun accesso all'host a meno che il suo manifesto lo chieda e l'operatore lo conceda. Chiedere ciò che non è concesso fa fallire la distribuzione

### Fase 7: collegamenti tipizzati e MCP

- [x] Validazione dello schema sul nodo `json`, la prima parte
- [x] Schemi facoltativi sulle porte. Una discrepanza che l'editor vede viene rifiutata alla distribuzione; una che non vede va a un nodo Catch con il percorso del campo sbagliato, e a una metrica
- [x] Tipi disegnati sui collegamenti nell'editor
- [x] Flussi come strumenti MCP: un nodo strumento dichiara un nome, una descrizione e uno schema di ingresso, e Flow serve `/mcp`. Un agente che chiama un flusso ottiene gli stessi permessi e lo stesso registro di controllo di una persona
- [x] Un nodo client MCP, così un flusso può chiamare gli strumenti di altri server, compreso quello di HotLoop
- [x] Gli strumenti MCP propri di Flow: elencare, leggere, distribuire e ripristinare flussi, elencare le distribuzioni e premere un nodo inject, tramite i gestori stessi dell'API di amministrazione con gli stessi permessi, gli stessi controlli di distribuzione e la stessa traccia di controllo, perché un MCP che potesse chiamare solo ciò che l'autore di un flusso ha cablato non potrebbe leggere né scrivere Flow stesso
- [x] Gli strumenti MCP propri di Flow per diagrammi e strumenti di misura: elencare e leggere i diagrammi, eseguirne e fermarne uno, pilotarne il debugger, impostare un controllo sul suo pannello, mettere breakpoint e sonde, creare un sottodiagramma, e leggere e commutare le scritture di uno strumento, ciascuno come una rotta di amministrazione eseguita dal proprio gestore con il permesso che quella rotta richiede (`status.read`, `diagram.run`, `instrument.write`). Finora le rotte dei diagrammi non avevano uno strumento, quindi un agente poteva distribuire un diagramma e non eseguirlo. Ogni rotta di amministrazione ora è uno strumento o è nominata in un test come una che deve fare una persona, e il test fallisce quando si aggiunge una rotta nuova senza. Ora gli strumenti sono 44, con quelli per stazioni, failover e tracce

### Fase 8: l'editor, riscritto in Astro

Fatto, e anticipato. Doveva essere l'ultimo, e l'abbiamo messo prima dei primi screenshot di Flow, perché nessuno dovrebbe vedere i primi in un editor che sembra venire da un'altra azienda.

Ogni progetto HotLoop sta ricevendo un'unica interfaccia moderna, e questo editor era quello che non combaciava. Era TypeScript fatto a mano su SVG nativo, la scelta giusta quando l'obiettivo era un piccolo binario statico senza nulla da verificare. Ora è Astro con isole Svelte, lo stesso stack dell'editor di Cascade, sugli stessi token di HotLoop, chiaro e scuro.

- [x] Prima una passata di progettazione, prima di una sola riga di Astro. Come l'editor deve apparire e sentirsi accanto al resto di HotLoop, deciso su carta e nei token condivisi, così la riscrittura costruisce qualcosa che qualcuno ha già deciso invece di decidere strada facendo
- [x] L'editor ricostruito in Astro con la tela, le finestre, lo storico, la revisione, i test, il tracciamento, la ricerca e i gruppi riportati, senza che nessuno peggiori. I test del browser in `web/e2e` sono l'asticella: passano sul nuovo editor senza modifiche
- [x] Ancora incorporato nell'unico binario statico, ancora senza bisogno di rete su una scatola di bordo, ancora dentro il budget di dimensione del binario, e la barriera delle licenze copre ancora tutto ciò che va nel bundle

La tela e il grafo sotto di essa non sono stati riscritti. Sono passati in `web/src/lib` come il TypeScript che erano, con una pelle nuova, così il cablaggio, il trascinamento, l'annulla e l'andata e ritorno esatta al byte del file dei flussi sono il codice già testato. Tutto ciò che li circonda è Svelte.

Flow resta un prodotto a sé per tutto questo. Condivide l'aspetto con HotLoop, non il codice, e non viene mai incorporato in HotLoop.

### Fase 9: FlowLab, diagrammi

Un secondo modo di eseguire una scheda, accanto ai messaggi e mai al loro posto. In un diagramma ogni nodo viene eseguito una volta, quando ciascuno dei suoi ingressi cablati ha un valore, e i rami senza collegamento tra loro vengono eseguiti nello stesso momento. È ciò che serve a un banco di prova o a un registratore di dati: cicli che portano un valore da un passaggio al successivo, un errore che viaggia su un collegamento tutto suo, un pannello che un operatore può aprire sul telefono e un debugger che può mettere in pausa un'esecuzione e mostrare cosa c'è su ogni collegamento. I flussi esistenti non cambiano, e il file dei flussi continua a caricarsi e a salvarsi byte per byte: un diagramma è una scheda con una chiave `ew_diagram`, e l'ingresso su cui arriva un collegamento è conservato in `ew_in` sul nodo da cui parte. [FlowLab](/it/flow/flowlab/) dice il resto.

- [x] Lo scheduler: tutti gli ingressi cablati pronti, rami indipendenti in parallelo, e un collegamento `after` per l'ordine dove non scorrono dati
- [x] Cicli while e for con valori portati, e un collegamento di errore che salta i nodi dopo un guasto, ferma un ciclo e porta la sua origine e il suo codice
- [x] Una porta seriale, con letture fino a un terminatore o a un numero di byte, un timeout sul collegamento di errore, e una porta che si riapre dopo un cavo staccato e viene contata
- [x] Un parser di letture, il rilevamento del valore stabile e un log di testo con una colonna dell'ora
- [x] Un pannello servito da Flow: controlli, indicatori e un grafico, aperto su un telefono mentre l'esecuzione è in corso, con un secondo osservatore su un desktop, ciascuno al passo dell'esecuzione entro un secondo
- [x] Esegui, ferma, evidenzia l'esecuzione, sonde su qualsiasi collegamento, breakpoint su nodi, collegamenti e passaggi, e entra, passa oltre ed esci
- [x] L'editor disegna porte con nome e collegamenti a quella su cui rilasciate, e la stessa pagina esegue e fa il debug
- [x] Struttura Case, record e tipi condivisi, forme d'onda
- [x] Registrazione TDMS e binaria, e uscita su database e su MQTT
- [x] Sessioni di strumento, su socket grezzo e seriale, provate su un simulatore e su un pty
- [ ] Un client di acquisizione dati provato sul server stesso di NI. È costruito e consegnato, e provato solo su un server di prova, quindi resta aperto finché non avrà girato sul server di NI e su un dispositivo
- [x] Analisi: statistiche e filtri
- [x] Sottodiagrammi, un elenco di errori nella CI/CD, e il lavoro di zoom e di disposizione dell'editor
- [x] Riproduzione di un'esecuzione finita: ogni inizio e fine di nodo e ogni valore di collegamento sono registrati, e la barra del diagramma riproduce l'ultima esecuzione sulla tela. `GET /diagrams/{id}/trace`, lo strumento `get_diagram_trace`
- [x] Una destinazione database che tiene ciò che un database perde: `postgres out`, durevole, scritta in ordine e a lotti quando il database torna, provata su un vero TimescaleDB
- [x] Inviare un file dei flussi, e quindi un insieme di diagrammi, a ogni installazione Flow che un tenant gestisce in EmberNet, con un controllo dopo ciascuna e una fallita rimessa a posto ([Invio alle stazioni di un tenant](/it/flow/stations/)), provato su tre veri processi Flow
- [ ] Provato su un Pi per un giorno, il che richiede la scheda e una lunga esecuzione

---

## Lacune di ogni giorno

Vanno in parallelo alle fasi. Nessuno sceglie un motore di flussi perché le ha, ma molti ne abbandonano uno che non le ha.

- [x] Distribuzione parziale: ripartono solo i nodi modificati e i loro collegamenti. Oggi ogni salvataggio butta giù tutte le sessioni MQTT e tutti i messaggi in volo, il che insegna agli operatori a non distribuire durante un turno
- [x] JSONata, provato sugli esempi pubblicati, perché è ciò su cui più spesso inciampa un flusso importato
- [x] Inject in stile cron
- [x] Modalità di ritorno di Link Call e Link Out
- [x] Join per timeout e reduce, batch per tempo, split in streaming
- [x] MQTT v5 e last will
- [x] TLS su TCP, cookie e multipart su HTTP
- [x] Editor: copia e incolla, importazione ed esportazione di una selezione, modifica di sottoflussi e gruppi, ricerca tra i flussi, filtro del debug
- [x] Lacune dell'editor lasciate dalla prima passata: aggiungere un nodo di configurazione dalla palette (la finestra lo diceva e non si poteva), trasformare una selezione in un sottoflusso, rinominare ed eliminare un flusso, e segnare un collegamento come durevole con il doppio clic
- [x] Una via d'uscita per un messaggio che la destinazione di un collegamento durevole rifiuta per sempre: un limite di tentativi facoltativo per collegamento. Dopo quel numero di rifiuti il messaggio va al Catch del flusso come errore con il messaggio allegato e il collegamento va avanti. Disattivato di default, quindi un collegamento resiste e riprova esattamente come prima
- `store.*` c'era già dal lavoro sul durevole e ora ha lo stesso controllo
- [x] Un nodo che punta a un nodo di configurazione che non è nel file (un flusso eliminato insieme al suo broker mentre un sottoflusso, una modifica a mano o un'importazione lo nominano ancora) viene segnalato da `hotloop-flow import`, dall'editor al caricamento e alla distribuzione, e dalla risposta della distribuzione, e il nodo è un errore di avvio invece di un nodo che in silenzio non funziona mai
- [x] Le lacune che quella ha lasciato: un riferimento di configurazione che nomina una scheda, un sottoflusso, un gruppo, un nodo semplice o il tipo sbagliato di nodo di configurazione viene segnalato e fallisce all'avvio come uno che non nomina nulla, un ripristino mette gli avvisi del file nel log dell'editor una volta e non due, e `hotloop-flow import` scrive il suo rapporto su un writer come fa `deploy`, così i suoi test smettono di sostituire lo standard output
- Il progetto originale ha ancora la riga; non abbiamo chiesto loro di accettare la modifica
- [x] Il test di svuotamento del collegamento durevole poteva contare uno scartato in più di quelli campionati come in coda. Il test era sbagliato, non la coda: aspettava 28 messaggi su 30 su disco e poi teneva lo svuotamento esattamente a ciò che aveva visto, mentre lo spool contava ancora gli ultimi. Quanti dei 30 sono su disco quando il collegamento va via dipende dai tempi, quindi ora tiene lo svuotamento a ciò che ha visto come minimo e ai 30 inviati come massimo
- [x] Il test di kill del collegamento durevole passava in locale e falliva su un runner più lento. La coda contava un messaggio come in attesa prima che fosse su disco, così una copia presa nel momento in cui il conteggio arrivava a 100 poteva essere corta di uno. Ora conta dopo il commit
- [x] L'editor, il testo dei nodi e la pagina della dashboard in 13 lingue oltre all'inglese, con un glossario condiviso
- [x] Kafka out, e ntfy, gotify e discord out, con le impostazioni di notifica che core ha già
- [x] Un collegamento durevole verso InfluxDB si mette in pari a lotti fino a 256, così un'ora di arretrato si svuota in secondi e non in minuti
- [x] I nodi connettore di Node-RED che serve a una migrazione di impianto (server Modbus su un'interfaccia di rete, e-mail, postgres e i nodi della dashboard), eseguiti in modo nativo
- [x] Valori del chart e un controllo di rendering per l'invio alle stazioni
- [x] Segreti per riferimento: un nodo legge una password da un Secret Kubernetes montato o da un file, così non vive mai nel file dei flussi
- [x] Portate i vostri flussi: `hotloop-flow import` continua a dire esattamente cosa girerà e cosa no prima che venga distribuito qualcosa. Elenca i tipi di nodo che girano, quelli che girano con una differenza e quale, quelli che non partiranno, e un nodo che punta a un nodo di configurazione che non è nel file

## Più avanti

- [x] Attivo/standby: un lease in un PostgreSQL con un numero di fencing, un fence su ogni scrittura verso le apparecchiature, e uno standby che trattiene le sue scritture finché non rileva il lease ([Standby caldo con un lease](/it/flow/failover/)). Provato su due veri processi Flow contro un vero PostgreSQL e un server Modbus che registra ogni scrittura: uccisi a metà flusso, congelati e scongelati, e fermati in modo pulito, senza alcuna scrittura da entrambi. Il contesto resta sul disco di ogni installazione e non in Postgres, che era il primo schizzo e non serve a tenere separati due scrittori

## Deciso

Ogni domanda che questo elenco portava ha una risposta. Restano qui con le risposte, perché sono le ragioni a impedire che qualcuno le riapra.

Deciso il 2026-10-03:

- **I nodi industriali si costruiscono in Flow,** sulle stesse librerie open source che usano i driver di HotLoop. I driver di HotLoop restano di HotLoop. Flow tiene la sua licenza, che era un'altra quando la decisione è stata presa e ora è l'HotLoop Source License Agreement 1.0, che ha sostituito l'EmberNet Source License 1.0 e, prima ancora, la Business Source License 1.1 che portava dalla 2.2.0.
- **Flow resta un prodotto a sé e non viene mai incorporato in HotLoop.** Gira accanto a HotLoop e parla con l'API di HotLoop dall'esterno, che è ciò che fanno i nodi HotLoop della Fase 5, ed è tutta la relazione.
- **Il README parte da ciò che Flow fa.** «Cablate la fabbrica. Rivedetela come codice.» L'importazione di flussi esistenti vive più in basso in «Portate i vostri flussi», e nulla in cima confronta Flow con altro. Flow sta in piedi da solo.
- **Il contesto persistente è SQLite fin dall'inizio,** Go puro senza cgo. Un solo archivio per il contesto ora e per le code durevoli dopo, non un archivio su file prima e un secondo dopo.
- **Il prodotto di automazione dei flussi di lavoro è una cosa a sé** e non condivide il motore di Flow. Storico, differenze e il resto restano qui pacchetti del motore, perché l'API, la CLI, l'editor e git devono avere tutti la stessa risposta.

Deciso prima che iniziasse la Fase 1:

- **MFA e registro di controllo escono nella Fase 1,** prima delle cose divertenti. Sono usciti entrambi.
- **L'andata e ritorno esatta al byte dei file dei flussi esistenti resta una regola ferma,** anche con tipi e test nel file. I dati nuovi vanno in chiavi che gli altri strumenti ignorano, e il test di andata e ritorno copre i file che le portano.
- **I benchmark sono solo numeri assoluti,** ciascuno con il comando che l'ha prodotto. Una tabella affiancata cambia a ogni cambio di macchina, e finisce per descrivere l'altro motore più di questo.
