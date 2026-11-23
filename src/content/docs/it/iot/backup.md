---
title: "Backup e ripristino"
description: "Istantanee logiche del database, ripristini che rifiutano uno schema più recente e perché la chiave delle password dei dispositivi va salvata a parte."
---

HotLoop esegue snapshot logici dell'historian, solo dei dati delle tabelle, e li ripristina, da 4.12.0. Attivo per impostazione predefinita, ogni giorno (`HOTLOOP_BACKUP_ENABLED`, `HOTLOOP_BACKUP_INTERVAL` 24h), nel binario e nel chart Helm. I backup vanno in `HOTLOOP_BACKUP_DIR`, che per impostazione predefinita è `backups` nella directory dati di HotLoop (`HOTLOOP_DATA_DIR`, altrimenti `/data` quando vi si può scrivere, altrimenti `~/.local/share/hotloop`): un deployment che non ha configurato un volume di backup non dovrebbe avere questo processo che scrive in silenzio nel filesystem effimero di un container.

## Che cos'è

Un backup è una directory: un file per tabella più un piccolo `manifest.json` (versione di HotLoop, migrazioni di schema applicate dal database, data e ora, e numero di righe e colonne con i loro tipi per ogni tabella).

## Che cosa non è

- **Non è `pg_dump`/`pg_restore`.** L'immagine di esecuzione del Gateway (`gcr.io/distroless/static-debian12:nonroot`) è volutamente un binario statico e nient'altro: niente shell, niente gestore di pacchetti, nessun binario esterno di alcun tipo. Tutto passa dalla stessa connessione al database che l'applicazione già tiene aperta.
- **Non è un backup dello schema.** Lo schema viene ricostruito automaticamente a ogni avvio (`HOTLOOP_DB_MIGRATE`, attivo per impostazione predefinita). Un backup cattura solo i *dati* delle tabelle, e un ripristino presuppone sempre che lo schema sia già stato ricostruito da quelle migrazioni.
- **Non è un ripristino a un istante preciso.** Qui non ci sono archiviazione WAL né replica continua. Un backup è un'istantanea del momento in cui è stato eseguito; ciò che viene scritto dopo quel momento e prima del backup successivo non è coperto.
- **Non è archiviazione fuori macchina.** La directory dei backup (`HOTLOOP_BACKUP_DIR`, pensata per poggiare sul PVC `backup.persistence` che questo chart predispone) resta un singolo volume nello stesso cluster. Portare i backup su un'archiviazione davvero durevole, replicata o offline (copiare il volume su archiviazione a oggetti, fare uno snapshot del PVC, ciò che offre l'infrastruttura reale di chi gestisce) è compito di chi gestisce l'impianto, così come questo progetto già tratta l'archiviazione durevole come responsabilità dell'infrastruttura e non come qualcosa per cui l'applicazione reinventa un adattatore di backup multicloud.

## Proteggere i file di backup

I file di backup sono sensibili. Il file `users.copy` contiene gli hash bcrypt delle password e dei PIN del chiosco, mentre `sessions.copy` e `write_audit.copy` contengono i record delle sessioni e la traccia di audit delle scritture. I file vengono creati con modalità `0640` (e la directory dei backup con `0750`), e un file già esistente è un errore anziché essere sovrascritto, ma questo è un minimo, non un sostituto della protezione del volume: tenga il volume dei backup su un'archiviazione cifrata a riposo, limiti chi e che cosa può leggerlo e applichi la stessa cura a qualsiasi copia fuori macchina fatta da chi gestisce l'impianto.

Il file `devices.copy` contiene l'indirizzo e la configurazione di protocollo di ogni dispositivo così come sono memorizzati, il che include le credenziali con cui i driver accedono. Quanto siano leggibili dipende dalla chiave, qui sotto. Dalla 4.15.1 l'API nasconde ogni credenziale di dispositivo a ogni ruolo, amministratore compreso; un file di backup non sta dietro l'API. Vedere [Autenticazione e utenti](/it/iot/authentication/#dove-le-credenziali-restano-in-chiaro).

## Credenziali dei dispositivi e chiave segreta

Un backup è il file che finisce copiato su un portatile, su una condivisione e in un ticket. Per questo le credenziali al suo interno sono cifrate, con una chiave che non sta mai nel database né in un backup.

- **Con `HOTLOOP_SECRET_KEY_FILE` impostato** (il chart lo imposta, con una chiave che genera all'installazione e conserva tra aggiornamenti e disinstallazioni), ogni credenziale protetta da chiave (la `password` dei dispositivi OPC UA, CODESYS, MQTT, HTTP, MTConnect e UniFi, la `community` e le passphrase dei dispositivi SNMP, i valori degli header HTTP e MTConnect come le chiavi API, la password di ogni altro broker MQTT che la discovery ascolta e la password di ogni destinazione dello storico) è cifrata nel database, e `devices.copy`, `mqtt_sources.copy` e `historian_targets.copy` contengono il testo cifrato. Il manifest indica la chiave usata come `secretKeyIds`: un identificativo, mai la chiave.
- **Senza di essa**, quelle credenziali sono nel database e in `devices.copy` in chiaro, e HotLoop lo dice nel suo log di avvio. Le console UniFi, i broker MQTT con password e le destinazioni dello storico con password non possono essere salvati affatto senza una chiave. Ne imposti una e riavvii: tutto ciò che è già memorizzato viene cifrato a quell'avvio.
- **Anche una credenziale scritta in un URL o in un testo viene sigillata** (`mqtt://user:pass@host`, un valore di query `?token=` o `?api_key=`, un `body` HTTP che menziona una password). L'indirizzo o l'opzione di un dispositivo che ne contiene una viene sigillato per intero, e i driver lo ricevono esattamente come è stato digitato. Un URL senza nulla di segreto resta leggibile. Senza chiave anche queste sono in chiaro come il resto, e il log di avvio lo dice; con una chiave, tutto ciò che è già memorizzato viene sigillato a quell'avvio. L'opzione password resta il posto migliore per metterne una.

**Il ripristino richiede la stessa chiave.** `--restore-from` controlla il manifest prima di caricare una riga: un backup cifrato con una chiave che l'HotLoop che ripristina non ha viene rifiutato, e l'errore indica la chiave necessaria. Ripristini con quel file di chiave montato. Se la chiave è persa per sempre, aggiunga `--restore-keep-unreadable-credentials`: tutto il resto torna, e ogni dispositivo la cui credenziale non può essere aperta resta non attivo, indicando quale chiave gli serve, finché qualcuno non reinserisce la credenziale. Un backup fatto prima che esistesse una chiave si ripristina ovunque, e le sue credenziali vengono cifrate non appena il ripristino finisce.

**Tenga la chiave dove il backup non c'è.** Una chiave conservata accanto ai suoi backup non protegge nulla. Con il chart è il Secret `<release>-secret-key`; ne faccia il backup come fa con il resto dei secret del cluster, separatamente.

## Che cosa viene salvato, e in che ordine

Ogni tabella di dati utente, nell'ordine di dipendenza delle chiavi esterne (una tabella viene sempre dopo tutte le tabelle a cui puntano le sue chiavi esterne):

```
devices → tags → tag_latest → alarm_definitions → alarm_state →
alarm_events → automations → automation_runs → blueprints → scripts → script_runs →
recipes → recipe_versions → recipe_applications → events → write_audit →
settings → users → sessions → user_certificates → energy_meters → energy_meter_state →
energy_buckets → fleet_members → report_definitions →
report_runs → entity_state_log → tag_history
```

(Abbreviato; `backup.Tables` è l'elenco completo, con le tabelle di entità e attrezzature e `entity_last_state`.) L'`entity_state_log` del registro è partizionato per mese in entrambe le modalità di storico e viene subito prima di `tag_history`, l'unica tabella più grande. Un ripristino carica le sue righe prima che esista una qualsiasi delle sue partizioni mensili, quindi finiscono nella partizione predefinita. La manutenzione del registro, quando parte un Gateway che registra, crea le partizioni del mese scorso e di questo mese attorno alle righe che vi appartengono, ed elimina le righe più vecchie dalla partizione predefinita man mano che superano la conservazione, così la conservazione raggiunge ogni riga ripristinata. Vedere [il registro](/it/iot/logbook/).

Gli script tornano con la loro cronologia. Un'esecuzione che il backup ha colto a metà torna come `running`, e il primo avvio del Gateway la segna come annullata, `interrupted by restart`, come un'esecuzione interrotta da un crash: nulla riprende un'esecuzione. Vedere [Script](/it/iot/scripts/).

Le ricette tornano con ogni versione e ogni applicazione. Un'applicazione che il backup ha colto a metà torna come `applying`, e il primo avvio del Gateway la segna come `failed`, puntando al suo id di chiamata nell'audit delle scritture: nulla ne riprende una, e nulla ne annulla una. Vedere [Ricette](/it/iot/recipes/).

`schema_migrations` è esclusa di proposito: `store.Migrate` la ricostruisce, insieme al DDL di ogni tabella, dalle migrazioni incorporate. È l'unica voce di `backup.ExcludedTables`, che registra perché ogni tabella esclusa è esclusa.

L'elenco è tenuto a mano, ed è così che una tabella può essere aggiunta da una migrazione e finire silenziosamente fuori da ogni backup. Due test lo impediscono, ed entrambi girano contro un database reale in entrambe le modalità di archiviazione. Le tabelle dei report pianificati (`report_definitions`, `report_runs`) sono le prime tabelle aggiunte sotto queste protezioni. I file di output dei report sono sul volume dei report e non fanno parte di un backup del database. `tag_history` viene caricata per ultima nel ripristino: non ha chiavi esterne proprie ed è di gran lunga la tabella più grande, così ogni piccola tabella di configurazione fallisce subito, se deve fallire, prima ancora che quel lungo passaggio inizi.

**`settings` ha un'eccezione voluta.** La riga `history_mode` è scritta da `store.ensureHistorySchema` stesso, una sola volta, nel momento in cui `Migrate` costruisce uno schema da zero: registra se *questo server* ha costruito `tag_history` come hypertable TimescaleDB o come tabella partizionata nativamente, un fatto sul database su cui `Migrate` è appena girato, non sull'impianto. È esclusa sia dal backup sia dal ripristino di `settings`: ripristinare la decisione storica di un'installazione di origine su una destinazione con capacità diverse (o anche solo su una nuova esecuzione di `Migrate` contro lo stesso tipo di server) potrebbe riscrivere questa riga per descrivere una forma che la destinazione non ha davvero. Il `Migrate` della destinazione ha già preso la decisione giusta prima che `Restore` guardi `settings`, e quella decisione viene lasciata com'è.

## Backup su richiesta

- `POST /api/backup` (`backup.run`, solo amministratori) fa un backup subito e restituisce il manifest.
- `GET /api/backup` (`backup.read`, solo amministratori) elenca ciò che c'è sul volume dei backup: nome, dimensione su disco e il manifest (elenco delle tabelle, numero di righe, versione di HotLoop, data e ora) di ciascuno.

Entrambi sono solo per amministratori per omissione dal ruolo operatore, la stessa restrizione che `fleet.restart`/`fleet.config`/`notify.test` già applicano ad altre azioni operative, del tipo "fallo ora" o di ambito amministrativo. I conteggi di righe di un elenco di backup, compresi `users` e `sessions`, somigliano più a una diagnostica amministrativa che alle letture di reparto (dispositivi, tag, allarmi) che il ruolo operatore deve vedere, quindi `backup.read` non è stato separato in un permesso più basso come alcune letture; è una valutazione, non un vincolo tecnico, e potrebbe essere rivista se un flusso di lavoro reale di un operatore lo richiedesse.

## Pianificazione e conservazione

`HOTLOOP_BACKUP_INTERVAL` (ad es. `24h`) esegue un backup a intervalli fissi. È volutamente un semplice intervallo, non un parser di espressioni cron: l'esigenza realistica è "salva questo ogni tanto", e la convenzione di questo progetto è non costruire per un'esigenza che ancora nessuno ha. Lasciarlo non impostato (o a `0`) disattiva il pianificatore; l'endpoint su richiesta continua a funzionare, per un operatore o un cron esterno che preferisce avviarlo da sé.

`HOTLOOP_BACKUP_RETAIN` (predefinito `7`) mantiene le N directory di backup più recenti, eliminando quelle più vecchie dopo ogni backup riuscito. `0` o meno mantiene tutto, una scelta che chi gestisce l'impianto deve fare deliberatamente su un volume piccolo.

## Ripristinare un backup

**Il ripristino non è volutamente un endpoint dell'API.** Automatizzare "ripristina ora" come azione in tempo reale, attivabile dalla rete, contro un database che può servire traffico di produzione è un pericolo reale: un clic sbagliato, o una sessione di amministratore compromessa, sovrascrive dati in produzione, e questo progetto non lo costruisce se non gli viene chiesto esplicitamente. Il ripristino è un'opzione del binario stesso, eseguita una volta, a mano, da chi gestisce l'impianto e ha già deciso che il database di destinazione deve riceverlo:

```sh
hotloop --restore-from=/data/backups/20260918T220000Z
```

Che cosa fa, in ordine:

1. Carica la configurazione e si connette al database esattamente come un avvio normale: `store.Open` esegue le stesse migrazioni, costruendo lo schema in cui il ripristino sta per caricare i dati.
2. **Rifiuta un backup che non può caricare senza perdere qualcosa**: uno fatto con uno schema più recente di quello di questo database, o uno con una tabella o una colonna che questa versione non ha più. Entrambe le cose vengono controllate prima di caricare una sola riga. Vedere "Ripristinare su una versione diversa" più sotto.
3. **Rifiuta se una tabella di destinazione contiene già dati** oltre a quanto `Migrate` stesso ha appena inserito (l'unica riga `history_mode` in `settings`): il ripristino gira solo contro un database ancora vuoto. È il controllo di sicurezza: una tabella con anche una sola riga esistente ferma l'intero ripristino prima che venga eseguito un qualsiasi `COPY FROM STDIN`.
4. Carica ogni tabella, nell'ordine di dipendenza, in una singola transazione, nelle colonne indicate dal manifest.
5. Reimposta la sequenza sottostante di ogni tabella con chiave primaria `bigserial` (`tags`, `alarm_events`, `automation_runs`, `events`, `write_audit`, `sessions`) a uno oltre l'id ripristinato più alto: `COPY FROM STDIN` carica valori di id espliciti senza toccare la sequenza, quindi saltare questo passaggio farebbe collidere il prossimo inserimento normale con una riga ripristinata.
6. Riconta ogni tabella e confronta con i conteggi di righe del manifest, nella stessa transazione ancora aperta.
7. Conferma solo se tutti i conteggi coincidono. Una discrepanza, o un errore in un passaggio precedente, annulla l'intera transazione, lasciando il database di destinazione esattamente vuoto com'era, mai caricato a metà.
8. Termina. Nient'altro nel processo parte: né pianificatore di polling, né motore degli allarmi, né server API. Un ripristino non ne ha bisogno, e avviare il runtime contro un database a metà ripristino sarebbe di per sé un pericolo.

### Passare a PostgreSQL 17

Questo backup viene fatto dall'applicazione in esecuzione, tramite la sua connessione al database in esecuzione, quindi non può essere il backup per il passaggio da PostgreSQL 16 a 17: quel passaggio avviene prima che il database parta. La sicurezza dell'aggiornamento stesso è che non scrive mai nella directory di PostgreSQL 16, che conserva intera come `pgdata.pg16` (la pagina su k3s e Helm, "PostgreSQL 17"). Faccia comunque questo backup sulla vecchia versione prima di aggiornare, perché è la copia che vive fuori macchina. Ripristinarlo sul nuovo database è il normale ripristino qui sotto: porta righe, non il motore, quindi non importa quale versione maggiore le abbia scritte.

### Ripristinare su una versione diversa

La versione con cui ripristina raramente è quella che ha fatto il backup. Il backup è stato fatto mesi fa con ciò che girava allora, e la macchina che sta ricostruendo esegue quella di oggi. Ecco quindi che cosa si ripristina su che cosa.

**Un backup più vecchio su un HotLoop più recente: sì.** È il caso che conta, ed è testato da ogni livello di schema che c'è stato, da `0001_core` a oggi, su TimescaleDB e su PostgreSQL semplice, con l'applicazione avviata dopo.

- Ogni manifest registra le colonne di ogni tabella, nomi e tipi. Il ripristino carica ogni file esattamente in quelle colonne, per nome. Una colonna aggiunta dopo il backup prende il suo valore predefinito. `entity_id`, `service` e `call_id` di `write_audit` tornano vuoti su ogni riga di audit precedente ai servizi di entità, che è ciò che quelle righe erano: semplici scritture di tag.
- Una tabella aggiunta dopo il backup resta vuota, e l'applicazione riempie ciò che può all'avvio. La prima sincronizzazione del registro delle entità dà a ogni tag ripristinato la sua entità di lettura, a ogni tag armato la sua entità di controllo e a ogni definizione di allarme la sua entità di allarme, con i nomi che il registro avrebbe dato loro. I dispositivi di un backup precedente all'albero delle attrezzature vengono collocati al suo interno in base al testo di sito, area e linea durante il ripristino stesso, nello stesso modo in cui li ha collocati l'aggiornamento. Ciò che non è mai stato nel backup non può tornare: etichette, entità composite e nomi di entità che un operatore ha personalizzato dopo il backup.

**Un backup più recente su un HotLoop più vecchio: no, rifiutato.** Il manifest registra ogni migrazione applicata dal database del backup. Se ne ha una che questo database non ha mai eseguito, il ripristino si ferma prima di caricare una riga e lo dice:

```
refusing to restore: this backup was taken by HotLoop <its version> with the
database schema at <its newest migration>, which is newer than this database's
schema at <this database's newest migration> (HotLoop <this version>). ...
Restore it with HotLoop <its version> or a later release
```

"Più recente" significa migrazioni, non stringhe di versione. Una stringa di versione dice quale binario ha fatto il backup, e le build di sviluppo, le release candidate e i rami di hotfix rendono un'ipotesi il confronto. Le migrazioni dicono com'era davvero lo schema, e vengono confrontate come insieme, quindi una migrazione mancante viene colta ovunque cada nell'ordine. Le versioni sono nel messaggio perché la versione è ciò su cui può agire: con quale release ripristinare.

**Un backup con una colonna che questa versione non ha più: rifiutato, per nome.** Il giorno in cui una migrazione elimina, rinomina o cambia il tipo di una colonna, un backup precedente ha dati per cui la nuova tabella non ha posto. Il ripristino non tira a indovinare. Nomina ogni colonna di questo tipo, in ogni tabella, prima di caricare qualsiasi cosa:

- una colonna che la tabella in uso non ha viene rifiutata, a meno che `backup.columnRenames` non la associ al suo nuovo nome. Una migrazione che rinomina una colonna aggiunge quella voce, e un test che ripristina un backup precedente, nella stessa modifica. Oggi non ci sono ridenominazioni, quindi la mappa è vuota;
- una colonna il cui tipo è cambiato viene rifiutata. Il COPY binario non porta tipi, quindi i byte verrebbero letti come il nuovo tipo o respinti a metà;
- una colonna che la tabella in uso ha aggiunto come `NOT NULL` senza valore predefinito viene rifiutata, perché nulla potrebbe riempirla.

La via d'uscita è la stessa per tutti e tre: ripristinare con la release che ha fatto il backup, poi aggiornare quel database sul posto, che è il modo in cui la migrazione era pensata per incontrare quei dati.

Caricare per nome copre anche il cambiamento che nessuno nota: una colonna eliminata e riaggiunta, o una tabella ricostruita, così le colonne finiscono in un ordine diverso. Caricare per posizione metterebbe i valori di una colonna in un'altra senza errore ogni volta che i tipi coincidono. Per nome, ognuno finisce dove deve.

**I backup fatti prima che i manifest registrassero tutto questo** (ogni backup fatto prima di questa release) non hanno elenchi di colonne né schema. Si ripristinano comunque:

- Senza elenchi di colonne, il ripristino ricade sulla posizione. Un file con meno colonne della tabella va nelle prime colonne della tabella, e il resto prende i valori predefiniti. È corretto per ogni schema finora, perché ogni migrazione fino a oggi ha solo aggiunto colonne, e `ALTER TABLE ADD COLUMN` aggiunge sempre in fondo. Un file con più colonne della tabella viene rifiutato da PostgreSQL stesso.
- Senza schema, il ripristino presume che il backup sia il più recente possibile: `0007_service_audit.sql`, la migrazione più recente che c'era quando i manifest hanno iniziato a registrarla. Questa ipotesi può solo rifiutare un ripristino che avrebbe funzionato, mai lasciarne passare uno che non avrebbe funzionato. In pratica non rifiuta nulla, perché qualsiasi HotLoop con questo controllo ha già eseguito ogni migrazione fino a quella.

Il primo backup che questa release fa registra tutto, quindi il ripiego conta solo per i backup già presenti su un volume di backup.

### Procedura di ripristino, passo per passo

1. Porti la directory del backup sulla macchina o sul volume che il binario `hotloop` dell'installazione di destinazione può leggere: è il punto in cui rientra in gioco la copia fuori macchina del volume dei backup fatta da chi gestisce l'impianto.
2. Punti `HOTLOOP_DB_*` al database di **destinazione**. Deve essere raggiungibile e non avere ancora dati in nessuna delle tabelle salvate (un database nuovo e vuoto è il caso normale; lo schema verrà costruito al passo 3).
3. Esegua `hotloop --restore-from=<path to the backup directory>`.
4. Legga l'ultima riga del log: `restore complete` con il numero di tabelle e righe, oppure un errore che spiega esattamente che cosa è stato rifiutato e perché.
5. Avvii `hotloop` normalmente contro quello stesso database.

## Passare da un database a un altro

Un backup è la stessa cosa qualunque database lo abbia fatto: file COPY binari di PostgreSQL e un manifest che nomina il tipo Postgres di ogni colonna. Spostare un impianto da un database a un altro è quindi un backup sul vecchio e un ripristino nel nuovo. Nient'altro.

- **Da SQLite a Postgres o TimescaleDB.** Il Pi che ha superato il suo file. Faccia un backup, punti `HOTLOOP_DB_*` al nuovo server (`HOTLOOP_DB_TYPE=postgres`) e ripristini. Su un server TimescaleDB lo storico finisce in una hypertable.
- **Da Postgres o TimescaleDB a SQLite.** Un impianto che scende su una macchina piccola. Lo stesso nell'altro senso, con `HOTLOOP_DB_TYPE=sqlite`.
- **Da Postgres semplice a TimescaleDB, e viceversa.** La modalità di storico è persistente, quindi puntare un Gateway al Postgres semplice di una macchina IoT mantiene le sue partizioni. Per ottenere una hypertable, ripristini in un TimescaleDB nuovo. Nell'altro senso si ottengono partizioni.

Ciò che viene controllato in ingresso è ciò che viene controllato per qualsiasi ripristino: ogni colonna per nome e tipo rispetto alla destinazione, con le colonne di SQLite lette come i loro tipi Postgres, così un backup dell'uno si ripristina nell'altro o viene rifiutato per lo stesso motivo che avrebbe ovunque. `history_mode` non viene mai copiato: la destinazione mantiene ciò che hanno deciso le sue migrazioni. Le sequenze risultano corrette in entrambi: su Postgres le sposta `fixSequences`, e l'AUTOINCREMENT di SQLite avanza da solo oltre qualsiasi id ripristinato al suo interno.

## Configurazione

| Variabile | Valore predefinito | <span class="sr-only">Dettagli</span> |
|---|---|---|
| `HOTLOOP_BACKUP_ENABLED` | `false` | La funzione è disattivata, comprese le route dell'API, finché questo non è impostato |
| `HOTLOOP_BACKUP_DIR` | `/data/backups` | Dove vengono scritti i backup; pensata per essere un PVC (`backup.persistence` nel chart) |
| `HOTLOOP_BACKUP_RETAIN` | `7` | Vengono mantenuti gli N backup più recenti; `0` o meno mantiene tutto |
| `HOTLOOP_BACKUP_INTERVAL` | non impostato | ad es. `24h`; non impostato significa solo su richiesta |

`--restore-from=<dir>` è un'opzione da riga di comando del binario `hotloop`, non una variabile d'ambiente; vedere "Ripristinare un backup" più sopra.

## Che cosa è stato verificato e che cosa no

HotLoop è stato eseguito su apparecchiature reali e server reali, e su bare metal il 2026-11-17.
