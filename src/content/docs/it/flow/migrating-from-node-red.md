---
title: "Porta i tuoi flussi Node-RED"
description: "Importa un flows.json di Node-RED senza modifiche, vedi a cosa corrisponde ogni nodo e cosa Flow rifiuta di eseguire e perché."
---

Flow legge il formato v1 di `flows.json` di Node-RED, l'array JSON piatto in cui è scritta ogni esportazione e ogni voce della libreria di flussi di Node-RED. Indicagli il tuo file e funziona.

**Carica e salva byte per byte.** Carica un file, salvalo senza modificare nulla e ottieni esattamente gli stessi byte: stesso ordine delle chiavi, stessi spazi, nessun escape riscritto di sua iniziativa. Modifica una proprietà e la differenza è una riga, non l'intero nodo.

In Go è più difficile di quanto sembri. Un oggetto JavaScript conserva l'ordine di inserimento delle chiavi, quindi un runtime JavaScript lo ottiene gratis da `JSON.parse` e `JSON.stringify` senza che nessuno ci pensi. Una mappa di Go non ha alcun ordine e `encoding/json` ordina le chiavi di proposito. Invece di imporre una mappa che conserva l'ordine su ogni percorso di lettura del codice, i byte originali di ogni voce vengono conservati e riemessi quando la forma analizzata non cambia, poi ricodificati secondo l'ordine originale delle chiavi quando cambia. `json.Compact` e `json.Indent` sono trasformazioni a livello di byte, quindi re-indentano senza riordinare nulla.

Conta per due motivi, entrambi noiosi ed entrambi reali. Il tuo file di flussi vive su un volume e in git, e non deve cambiare solo perché un pod si è riavviato. E quando un operatore rivede la differenza di un deploy prima di inviarla a una linea, deve vedere cosa è cambiato e assolutamente nient'altro. Questa regola resta valida anche quando test e tipi entrano nel file: i nuovi dati vanno in chiavi che gli altri strumenti ignorano, e il test di andata e ritorno copre i file che le contengono.

Un tipo di nodo che questa versione non ha mai visto sopravvive a un caricamento e salvataggio con tutte le proprietà intatte, quindi è sicuro eseguire un flusso qui e restituirlo dopo. Il `flows_cred.json` di Node-RED, cifrato con AES-256-CTR, si importa in sola lettura, e ciò che si legge così viene ricifrato con GCM al salvataggio successivo.

**Prima di distribuire qualsiasi cosa, chiedi cosa succederà:**

```bash
hotloop-flow import flows.json
```

Segnala ogni tipo di nodo nel file, compresi quelli dentro i sottoflussi, divisi in supportati, parzialmente supportati con la lacuna spiegata e non supportati. Gli interni di un sottoflusso sono contati sul grafo espanso e non sul file, quindi un'istanza non viene mai segnalata come "supportata" tacendo ciò che contiene. È la differenza tra scoprirlo alla scrivania e scoprirlo quando una linea si ferma.

Un nodo può anche puntare a un nodo di configurazione che non è nel file. Elimini un flusso e il suo broker MQTT se ne va con lui, mentre un sottoflusso che usava quel broker continua a puntare a un id che non indica nulla. Lo stesso succede con una modifica a mano o con un'esportazione copiata a metà. Prima lo scoprivamo quando il primo messaggio arrivava al nodo, e i nodi che cercano soltanto il loro server allora non dicevano nulla. Ora il rapporto di importazione ha una sezione per questo che nomina ogni nodo e l'id che non trova, l'editor scrive le stesse righe nel log al caricamento, e un deploy risponde con quelle e segna quei nodi come non avviati, con la proprietà che contiene l'id errato. Il resto del flusso continua a funzionare. Un nodo che hai disattivato, e un'impostazione TLS vuota o con `true` o `false`, non vengono segnalati, perché non sono errori.

Un id che esiste non è un id che funziona. La prima volta ci era sfuggito. Se l'impostazione punta a una scheda, un sottoflusso, un gruppo o un nodo semplice, oppure a un nodo di configurazione del tipo sbagliato, come un'impostazione TLS rivolta a un broker MQTT, riceve lo stesso rapporto e lo stesso mancato avvio, e la riga dice cosa è davvero l'id e di che tipo lo vuole l'impostazione. L'editor offre solo il tipo giusto, quindi questo viene solo da una modifica a mano o da un id incollato, che è proprio dove fa male.

Per livello di compatibilità, i 108 tipi di nodo di messaggi sono 12 completi, 50 parziali, 14 volutamente divergenti e 32 propri di Flow. Ogni nodo dichiara in che rapporto sta con il nodo di Node-RED dallo stesso nome, e **un test fa fallire la build se un nodo dichiara compatibilità parziale senza scrivere cosa manca.** Un nodo compatibile al 90 % che tace sul restante 10 % è più pericoloso di uno palesemente assente, perché il primo lascia che un flusso sembri funzionare. La matrice completa è [Compatibilità con Node-RED](/it/flow/compatibility/), generata dal registro e non mantenuta a mano, perché un documento di compatibilità mantenuto a mano è una bugia con la data.

Le divergenze sono volute e ciascuna è scritta lì: ogni destinatario di una diramazione riceve la propria copia, il nodo `exec` ha una lista di consentiti e nessuna shell, i nodi file hanno un ambito limitato, e tutto ciò che è elencato in [Back-pressure, in piena vista](/it/flow/back-pressure/) ha un tetto.

**La maggior parte dei nodi della community di Node-RED non funziona qui.** Sono pacchetti npm che richiedono Node.js, e non ci sarà una versione futura in cui un pacchetto che richiede Node funzioni all'improvviso. È il prezzo dell'ingombro ridotto e del sandbox, dichiarato chiaramente perché tu possa decidere contro. I plugin WASM firmati sono la risposta di Flow per ciò che scrivi tu stesso: vedi [Plugin senza npm](/it/flow/plugins/).

I nodi della community su cui si appoggia uno stabilimento sono un'altra cosa. Flow esegue in modo nativo, in Go, i tipi Node-RED per Modbus, dashboard, PostgreSQL ed e-mail, con i propri nomi di tipo, quindi un flusso che li usa si carica e funziona senza modifiche, così come `Buffer` e `setInterval` che i nodi funzione attorno a loro chiamano. Cosa funziona, cosa differisce e cosa è stato dimostrato si trova in docs/node-red-types.md. Qualsiasi altro nodo della community in un flusso fallisce da solo con il suo tipo indicato, e il resto del flusso parte.

JSONata era in cima alla lista di ciò che fa inciampare un flusso importato. Le 13 funzioni che non funzionano sono fissate in un test con il motivo di ciascuna, e dieci di queste sollevano ancora un errore, solo con un codice diverso. `$moment` è l'unica funzione di Node-RED che ti mancherà, e ti dice cosa usare al suo posto invece di fallire in silenzio.

I nodi Inject pianificati con cron erano i successivi in quella lista. Ora scattano, e nello stesso minuto di quelli di Node-RED: il crontab è letto da un port di cronosjs 1.7.1, lo scheduler del nodo Inject di Node-RED stesso, e verificato su 22.620 attivazioni prodotte da cronosjs in sei fusi orari, prima e dopo veri cambi d'ora. Alle 2 di notte conta. L'inizio di un turno che cade nell'ora che sparisce in primavera parte nell'istante in cui gli orologi saltano, e l'ora che si ripete in autunno parte una volta, non due. La pianificazione rilegge anche l'orologio ogni minuto, quindi un box che si avvia con l'ora sbagliata e viene corretto da NTP più tardi inizia a scattare all'ora giusta invece che con ore di ritardo.

Link Call era l'ultimo dei tre. Ora funziona, insieme alla modalità di ritorno di Link Out: una sola logica, "cerca questo lotto", "controlla questo interblocco", scritta una volta nella sua scheda e chiamata da ogni linea, con la via del ritorno conservata sul messaggio come una pila, così un flusso chiamato può fare a sua volta delle chiamate. Una chiamata che non torna mai solleva un errore dopo il suo timeout invece di restare appesa. Un ritorno che arriva in ritardo parte comunque, come in Node-RED. E un ritorno senza nulla a cui tornare è un errore che vede un nodo Catch, invece dell'avviso che Node-RED registra e che nessuno legge.
