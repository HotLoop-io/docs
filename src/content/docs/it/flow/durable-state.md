---
title: "Stato durevole, misurato"
description: "Contesto che sopravvive a un riavvio e collegamenti durevoli che toccano il disco solo quando la destinazione non risponde, con i numeri di entrambi."
---

Un Historian fermo per un'ora non dovrebbe costarvi un'ora di letture, purché il guasto stia nella quota su disco (256 MiB per impostazione predefinita: circa un'ora a 100 letture al secondo con letture da 120 byte, misurato su 2.13.1), e un contatore in un flusso non dovrebbe ripartire da zero perché il pod si è spostato. Entrambe le cose sono un file SQLite sul volume, e questa pagina dice che cosa ci finisce, che cosa garantisce, che cosa non garantisce e che cosa costa a una scheda flash.

Un solo file, `state.db`, nella directory dei dati. Il contesto persistente e le code dei collegamenti durevoli lo condividono, perché due archivi sarebbero due cose da dimensionare, salvare e tenere allineate.

## Contesto che sopravvive a un riavvio

Il contesto di flusso, globale e di nodo viene caricato dal file la prima volta che si usa un ambito e poi vive in memoria, quindi le letture non toccano mai il disco e `CompareAndSwap`, `Increment` e `Update` sono lo stesso codice di prima, atomico sotto lo stesso blocco. Un riavvio restituisce il contatore e si riparte da lì, e un `CompareAndSwap` su un valore tornato dal disco funziona ancora, compreso l'intero memorizzato da un nodo function.

Ciò a cui si rinuncia è voluto: le scritture sono differite. Un valore modificato attende `store.context.flushInterval` (30 secondi) e tutto ciò che è cambiato in quella finestra va nel file in un'unica transazione. Diecimila incrementi di un contatore in una finestra sono una riga scritta. Un valore impostato a quello che era già non è affatto una scrittura, ed è il caso del flusso che salva la stessa temperatura ogni secondo e della scheda SD che altrimenti lo odierebbe. Un arresto pulito scrive prima tutto. Un `kill -9` o un'interruzione di corrente perde fino all'intervallo. Lo si imposti a `0s` e ogni modifica è scritta prima che la chiamata ritorni, e la scheda ne paga il prezzo.

Sopravvive a un riavvio solo ciò che sopravvive a JSON: numeri, stringhe, booleani, date e ore, buffer di byte, liste e oggetti. Se si mette una funzione o un socket nel contesto, il `set` fallisce nominando la chiave, invece di salvarne metà. Il contesto di un nodo se ne va quando il nodo viene eliminato e quello di un flusso quando viene eliminata la scheda, al deploy, con lo stesso passaggio di pulizia di Node-RED.

## Collegamenti durevoli

Si segna un collegamento come durevole sul nodo da cui parte. La chiave è `ew_durable`, un elenco degli id dei nodi a cui va quel collegamento, e il file del flusso continua a caricarsi e a salvarsi byte per byte perché gli altri strumenti la ignorano:

```json
{
  "id": "count", "type": "function", "z": "line3", "x": 290, "y": 100,
  "ew_durable": ["influx"],
  "wires": [["influx", "reply"]]
}
```

Ogni collegamento da `count` a `influx` ora è durevole. Il collegamento verso `reply` resta un collegamento normale.

Che cosa fa un collegamento durevole:

- **Non scrive nulla finché la destinazione tiene il passo.** I messaggi vanno dalla memoria direttamente nella casella di ingresso della destinazione, come su un collegamento normale, e il database di stato non viene toccato. Abbiamo fissato questa regola dopo che un progetto che scriveva tutto per primo ha misurato centinaia di gigabyte al giorno su una scheda flash, per un guasto che capita poche ore all'anno.
- **Versa su disco quando non lo tiene.** Il collegamento inizia a versare appena il gestore della destinazione restituisce un errore, la sua casella è piena o non è in esecuzione. Da quel momento ogni messaggio viene confermato nel file prima che ritorni il `Send` del nodo mittente, quindi, una volta che il mittente è andato avanti, un `kill -9` non può portarselo via. I messaggi già in viaggio verso la destinazione vengono deviati su disco dietro quello che ha fallito, in ordine. Nell'esempio sopra `reply` è secondo nel cablaggio, quindi mentre il collegamento versa, un HTTP 200 significa che la lettura è su disco.
- **Si svuota in ordine, a lotti dove la destinazione li accetta.** Una pompa consegna alla destinazione i messaggi più vecchi su disco e attende che li prenda. Nulla dietro un messaggio lo supera. Una destinazione che scrive in un database può prendere una serie di fino a 256 messaggi come un'unica scrittura, e `influxdb out` lo fa: con l'Historian che risponde a una scrittura in 8 ms, un arretrato si svuotava a circa 110 letture al secondo una alla volta, cosa che un impianto che ne invia 100 al secondo non riduceva quasi, e si svuota alla velocità che le scritture consentono quando ognuna ne porta qualche centinaio. Ogni altra destinazione riceve ancora un messaggio alla volta. Se un lotto non viene preso, i messaggi prima del primo fallito sono segnati come fatti, quello viene ritentato da solo con il nuovo tentativo descritto sotto, e il resto viene inviato di nuovo come lotto. Quando la coda è vuota il collegamento torna in memoria e smette di scrivere.
- **Ritenta ciò che la destinazione rifiuta.** Lo stesso messaggio riparte dopo 250 ms, poi 500 ms, raddoppiando fino a 5 secondi, per tutto il tempo necessario. I nodi Catch del flusso vengono a sapere del primo errore e non di ogni nuovo tentativo. Una destinazione ferma, sostituita da un deploy o che non è riuscita ad avviarsi viene attesa, non saltata.
- **Sopravvive a un riavvio.** Quello che è ancora su disco quando il processo torna viene consegnato per primo.
- **Rispetta una quota su disco.** `store.durable.maxBytes` (256 MiB) copre tutti i collegamenti durevoli insieme, contando il corpo di ogni messaggio più 64 byte. Quando è piena, decide il nodo a cui va il collegamento con la politica di overflow che ha già: `block` attende fino a `blockTimeout` che ci sia spazio e poi dà errore, `drop-newest` rifiuta il messaggio in arrivo, `drop-oldest` espelle il messaggio più vecchio che non è in consegna, `error` solleva l'errore a un nodo Catch. Ognuno è contato e annunciato come evento di scarto. Un'eccezione: un messaggio già accettato in memoria che il collegamento deve spostare su disco ci entra anche oltre la quota, perché rifiutarlo vorrebbe dire scartarne uno più vecchio e tenere quelli più recenti. L'eccedenza è al massimo ciò che la destinazione contiene, la sua casella più il messaggio che la sua goroutine ha preso e non ha ancora iniziato, quindi la quota può risultare di qualche messaggio oltre per un momento. Il file è un po' più grande della quota, per il sovraccarico di pagina di SQLite e il registro di scrittura anticipata, e un test lo riempie, lo svuota e lo riempie di nuovo sei volte per dimostrare che non continua a crescere.
- **Mostra la sua profondità.** `hotloop_flow_durable_wire_depth{wire="..."}` è il numero di messaggi in attesa, con `_bytes`, `_delivered_total`, `_retries_total` e `_dropped_total` accanto, e `hotloop_flow_durable_bytes` rispetto a `hotloop_flow_durable_max_bytes` è la quota.
- **Non riavvia il nodo.** Segnare un collegamento come durevole su un flusso in esecuzione è una modifica di cablaggio, come spostare un collegamento.

Un collegamento che smette di essere durevole, o viene eliminato, vede la sua coda svuotata, contata come scartata e annunciata. Quei messaggi non hanno dove andare, e tenerli riempirebbe la quota con una coda che nessuno vede.

### Che cosa promette e che cosa no

**Finché il collegamento è sano c'è una finestra di perdita.** Ciò che è in memoria è la casella di ingresso della destinazione e la chiamata che sta facendo, e un `kill -9` o un'interruzione di corrente se lo porta via. È il prezzo del non scrivere nulla, e l'abbiamo accettato di proposito: con una casella da 1024 e una destinazione veloce sono i messaggi di circa un ciclo di lettura. Quando il collegamento versa, cioè quando la destinazione è ferma e i dati sono a rischio, non c'è nessuna finestra. Il test kill -9 qui sotto si fa a metà guasto per questo motivo, con la coda su disco. Non abbiamo ucciso il runtime mentre il collegamento era sano per contare, perché la risposta è «qualcuno va perso» e il progetto è questo.

**La consegna è almeno una volta.** La destinazione ha preso un messaggio quando il suo gestore ritorna senza errore, e il collegamento lo segna fatto su disco dopo. Un `kill -9` tra le due cose fa ripartire il messaggio dopo il riavvio. Quanti dipende da `store.durable.ackFlush`: i segni sono scritti insieme, quindi con il valore predefinito `100ms` sono i messaggi finiti negli ultimi 100 ms, e con `0s` ogni segno è scritto prima di inviare il messaggio successivo, quindi al massimo quello in volo, o il lotto in volo, fino a 256 messaggi, per una destinazione che accetta lotti.

Sembra un buco, ecco dunque che cosa lo chiude per la destinazione per cui è stato costruito. Un messaggio che attraversa un collegamento durevole riceve il timbro `msg._queuedAt` con l'ora in cui è entrato nel collegamento, e `influxdb out` senza marca temporale configurata scrive il punto a quell'ora. Una ripetizione è la stessa serie alla stessa ora, che InfluxDB tratta come una sovrascrittura, quindi il numero di righe non si muove. Corregge anche l'altro difetto dello store-and-forward: senza, ogni lettura trattenuta durante un guasto viene marcata quando InfluxDB torna, e un'ora di storico arriva in un minuto. Una destinazione che marca all'arrivo, per esempio un `now()` in un insert Postgres, salverebbe due volte una ripetizione e metterebbe anche l'ora rieseguita nel posto sbagliato. Usi `msg._queuedAt`.

**«Preso» vale quanto vale il nodo.** `influxdb out` fa la sua scrittura dentro il gestore, quindi preso significa scritto. Un nodo che passa il lavoro a un'altra goroutine e ritorna ha promesso meno, e il collegamento non può essere più durevole di ciò a cui è collegato.

**Alcune proprietà non fanno il viaggio.** Un riferimento vivo non può attraversare un riavvio né ricevere risposta a posteriori, quindi `msg.req` e `msg.res` (quelli del nodo HTTP In) e tutto ciò che non si serializza vengono lasciati fuori dai messaggi di un collegamento durevole, e la prima volta che succede su un collegamento viene registrato nel log con il nome della proprietà. Il payload non viene mai lasciato fuori: se non si può memorizzare, il messaggio è rifiutato con un errore che nomina il percorso.

**Un messaggio difettoso può bloccare un collegamento.** Una destinazione che rifiuta sempre lo stesso messaggio lo riceve sempre, con la pausa di 5 secondi tra i tentativi, e i messaggi dietro aspettano. Il contatore dei tentativi e la profondità sono il modo di vederlo. È la scelta giusta per un Historian fermo. È quella sbagliata per un messaggio malformato, quindi a un collegamento si può dare un limite: `"ew_durable_attempts": {"influx": 20}` sul nodo da cui parte, oppure la finestra del collegamento nell'editor. Dopo che la destinazione ha rifiutato un messaggio tante volte dalla coda, esso va al flusso come errore del nodo che l'ha rifiutato con il messaggio allegato, un nodo Catch può metterlo da parte, e il collegamento va avanti. Senza la chiave nulla cambia. Non esiste ancora una coda dei messaggi non recapitabili: un nodo Catch è il posto dove costruirla, e `hotloop_flow_durable_wire_given_up_total` conta ciò che ci è andato.

## Impostazioni

```yaml
store:
  path: ""              # empty is state.db in data.dir
  synchronous: normal   # normal | full
  context:
    persist: true
    flushInterval: 30s  # 0s writes every change at once
  durable:
    maxBytes: 268435456
    ackFlush: 100ms     # 0s marks each message before the next is sent
```

Ambiente: `HOTLOOP_FLOW_STORE_PATH`, `HOTLOOP_FLOW_STORE_SYNCHRONOUS`, `HOTLOOP_FLOW_CONTEXT_PERSIST`, `HOTLOOP_FLOW_CONTEXT_FLUSH_INTERVAL`, `HOTLOOP_FLOW_DURABLE_MAX_BYTES`, `HOTLOOP_FLOW_DURABLE_ACK_FLUSH`. Il chart ha gli stessi nomi sotto `store:` in `values.yaml`.

`synchronous: normal` esegue il file in modalità di scrittura anticipata senza un fsync a ogni commit. Un commit sopravvive all'uccisione del processo, ed è il test `kill -9` qui sotto. Non sopravvive a un'interruzione di corrente su ogni file system. `full` sì, e `full` è quello che consuma la scheda.

## La prova

Misurato con un vero InfluxDB 2.9.1 in Podman. Nulla è simulato.

Un produttore invia al flusso in flow.json una lettura numerata venti volte al secondo. Il flusso la conta nel contesto di flusso e la manda lungo un collegamento durevole a `influxdb out`. La lettura non ha marca temporale, quindi un messaggio consegnato due volte sarebbero due righe. Un piccolo passaggio intermedio tra il flusso e InfluxDB registra ogni scrittura che InfluxDB ha accettato, perché InfluxDB tratta un punto scritto due volte alla stessa ora come un punto solo e le sole righe non possono mostrare una ripetizione.

| Ora | Che cosa è successo |
|---|---|
| 00:13:53 | Il flusso parte, 20 letture al secondo. |
| 00:14:53 | `podman kill` su InfluxDB. Resta fermo dieci minuti. Il collegamento versa su disco. |
| 00:19:54 | Cinque minuti dopo, profondità della coda 5,989 su disco. `kill -9` sul runtime. |
| 00:19:59 | Il runtime riparte, InfluxDB ancora fermo. Trova 5,992 messaggi su disco e continua a prenderne di nuovi. |
| 00:24:59 | InfluxDB parte. Profondità della coda 11,989. |
| 00:25:25 | Svuotamento in corso, profondità della coda 5,987. `kill -9` sul runtime di nuovo, a metà coda. |
| 00:25:30 | Il runtime riparte con 5,948 su disco. |
| 00:25:53 | Arretrato svuotato. Altri novanta secondi di ingresso costante, poi un conteggio. |

```
deliveries      15987 writes InfluxDB answered 204 to
delivered twice 5 [7829, 7830, 7831, 7832, 7833]
sent            16185
accepted (200)  15982
failed          203
rows stored     15982
distinct seqs   15982
missing         0 []
doubled         0 []
unacked stored  0 []
```

Ogni lettura a cui il flusso ha risposto 200 è in InfluxDB, una volta. **Nessuna manca, nessuna doppia.** Le 203 che sono fallite erano richieste arrivate mentre il runtime era fermo, cioè il produttore a cui si dice di no, e nessuna è stata salvata.

Cinque messaggi sono stati consegnati due volte a InfluxDB. Sono quelli che il secondo kill ha colto tra il momento in cui InfluxDB li ha presi e quello in cui il segno «fatto» è arrivato su disco, dentro la finestra di `ackFlush`. Ognuno portava lo stesso `_queuedAt`, quindi la seconda scrittura ha sovrascritto la prima e il numero di righe non si è mosso. Ecco come appare [almeno una volta](#che-cosa-promette-e-che-cosa-no) quando funziona. È anche ciò che una destinazione che marca all'arrivo avrebbe salvato due volte.

Ciò che questo non copre: un `kill -9` mentre il collegamento è sano. Le letture in memoria in quel momento vanno perse, per progetto, e non le abbiamo contate.

## Che cosa scrive su disco

`write_bytes` di `/proc/<pid>/io` è ciò che al kernel è stato chiesto di inviare allo storage per il processo, tolte le scritture annullate. È il numero che interessa a una scheda flash. Ogni riga sono 300 secondi di uno scenario, dopo 30 secondi per assestarsi, con disk-writes.sh. Il flusso è quello della prova con InfluxDB dietro, quindi il carico è reale.

```bash
BIN=./hotloop-flow SECS=300 bash docs/durable/disk-writes.sh
```

| Scenario | Frequenza | Svuotamento del contesto | Scritto per ora | Al giorno |
|---|---|---|---|---|
| Inattivo, un collegamento durevole nel flusso | nessuna | 5 s | 0 byte | 0 |
| Collegamento durevole sano, carico costante | 20 msg/s | 30 s | 1.7 MiB | 0.04 GB |
| Collegamento durevole sano, carico costante | 50 msg/s | 30 s | 1.2 MiB | 0.03 GB |
| Idem, contesto svuotato ogni 5 s | 20 msg/s | 5 s | 5.1 MiB | 0.12 GB |
| Idem, contesto svuotato ogni 5 s | 50 msg/s | 5 s | 4.2 MiB | 0.10 GB |
| Solo contesto, collegamento normale | 20 msg/s | 30 s | 1.2 MiB | 0.03 GB |
| Collegamento che versa, InfluxDB fermo | 20 msg/s | 5 s | 728 MiB | 17 GB |
| Collegamento che versa, `synchronous: full` | 20 msg/s | 5 s | 1,011 MiB | 24 GB |

Si legge in tre parti.

**L'inattività non scrive nulla.** Zero byte in cinque minuti.

**Un collegamento sano non scrive nulla di suo.** Le righe sane sono contesto persistente, un contatore incrementato a ogni messaggio, e nient'altro. La riga di solo contesto con un collegamento normale è nel rumore rispetto a quelle. Lo svuotamento del contesto era di cinque secondi per impostazione predefinita fino a questa tabella: a venti messaggi al secondo erano 5.1 MiB all'ora, 0.12 GB al giorno, e trenta secondi lo portano a 1.7 MiB, ed è per questo che il valore predefinito è trenta. Un kill -9 perde allora fino a trenta secondi di contesto.

**Un collegamento che versa costa, e solo finché versa.** Ogni messaggio è un commit a sé, circa 10 KB di scritture ciascuno, perché il mittente aspetta il disco. Dieci minuti di guasto a venti al secondo sono circa 120 MiB, un guasto di un giorno intero circa 17 GB. È il costo di «su disco prima che il mittente vada avanti», pagato solo mentre l'Historian è fermo. Il commit di gruppo condivide una transazione tra mittenti concorrenti, ma un mittente fa un commit.

Un altro numero, perché mi ha sorpreso. A 100 messaggi al secondo questo banco di prova non ha tenuto sano il collegamento: la destinazione ha smesso di tenere il passo, il collegamento ha versato ed è rimasto a versare per tutta la prova, 3,548 MiB all'ora. Non abbiamo indagato se il rallentamento fosse del passaggio intermedio o di InfluxDB. È il progetto che funziona come scritto, perché «in arretrato» conta come non tenere il passo, e vuol dire che una destinazione più lenta del suo ingresso mette un collegamento durevole su disco. A 50 messaggi al secondo è rimasto sano.

Il progetto precedente scriveva prima ogni messaggio su disco. Con il primo schema (pagine da 4 KiB, una tabella e un indice) misurava 632 MiB all'ora a 20 messaggi al secondo anche con InfluxDB sano, e 1,163 MiB con ogni segno «fatto» scritto subito. Da lì viene «disco solo durante un guasto».

### Su hardware reale

Questi numeri sono stati misurati su una macchina x86 sotto WSL2, e da allora l'archivio durevole è stato eseguito su hardware reale (2026-11-17). I byte scritti sono una proprietà del codice e della dimensione di pagina, quindi le cifre sopra restano valide. Ciò che una scheda ne fa (amplificazione di scrittura, usura) no, e nemmeno memoria, tempo di avvio e messaggi al secondo sostenuti, quindi quei numeri restano indicati con dove sono stati misurati.
