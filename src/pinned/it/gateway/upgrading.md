---
title: "Aggiornare HotLoop Gateway a {{hotloop}}"
description: "Da 4.22.1 è un helm upgrade con tre migrazioni in più. Da 4.18.11 gli agenti possono scrivere. Da 4.18.10 il database passa a PostgreSQL 17."
sidebar:
  label: "Aggiornamento"
---

Sei strade verso {{hotloop}}, e non si somigliano affatto. Da 4.22.1 è un semplice `helm upgrade` che aggiunge tre tabelle e colonne e monta l'host in sola lettura per lo stato della macchina, quindi controlli il profilo Pod Security. Da 4.18.11 è un semplice `helm upgrade`, ma due cose cambiano ciò che fa un impianto in funzione, quindi le legga prima. Da 4.18.10 il motore del database cambia sotto i suoi piedi, ed è meglio saperlo prima che accada. Da 4.17.0 è un semplice `helm upgrade`, con un paio di valori predefiniti che si sono spostati. Da 4.16.0 si passa prima da 4.17.0, e dopo un nuovo Secret fa parte dei dati del suo impianto quanto il database. Da 4.3.1 è un chart rinominato che un semplice `helm upgrade` non può toccare, e si passa per 4.16.0 e 4.17.0 lungo la strada. Le note di rilascio coprono un salto alla volta, e nessuna copre il salto di una versione, quindi questa pagina non promette che funzioni. Trovi la strada che è la sua e la legga tutta prima di toccare un impianto in funzione.

:::caution[Da 4.20.2 o precedente: un client OPC UA su Basic256 smette di connettersi]
4.21.0 ha disattivato `Basic128Rsa15` e `Basic256` per impostazione predefinita, sia negli aggiornamenti sia nelle nuove installazioni. Il server non li elenca più e rifiuta un client che ne chiede uno per nome. Controlli se qualche suo client OPC UA (lo mostra la connessione di Ignition) non parla niente di più recente di `Basic256`, e lo porti a `Basic256Sha256`. Se non può passare, `HOTLOOP_OPCUA_SERVER_ALLOW_DEPRECATED_POLICIES=true` (chart `opcuaServer.allowDeprecatedPolicies: true`) riporta le due politiche, e il server lo dichiara all'avvio. 4.21.0 aggiunge anche la migrazione 0027, una nuova tabella, quindi per il resto l'aggiornamento è un semplice `helm upgrade`. Il controllo di rilascio ha avviato 4.20.2 sullo schema migrato e ha funzionato, quindi la tabella non è un motivo per cui un rollback sia rischioso.
:::

:::note[I chart più vecchi si scaricano per URL]
L'indice del repository dei chart conserva i chart del Gateway fino a 4.16.0, quindi `hotloop/hotloop --version 4.17.0` si risolve, e anche i pacchetti sono serviti per URL. I comandi qui sotto per 4.16.0 e 4.17.0 indicano il chart con il suo URL, come `https://hotloop.io/hotloop/hotloop-4.17.0.tgz`, e funziona in entrambi i casi. IoT ed Edge partono da 4.18.10.
:::

## Aggiornamento da 4.22.1

Un semplice `helm upgrade`, e nulla di ciò che è già sulla macchina cambia. Tre migrazioni girano al primo avvio e ciascuna si limita ad aggiungere: `0028_unifi_port_cycles`, `0029_energy` e `0030_energy_demand`. Un backup fatto su 4.22.1 si ripristina qui, e uno fatto qui non si ripristina su una versione più vecchia, quindi faccia prima un backup se potrebbe tornare indietro.

- **Il chart ora monta l'host in sola lettura per lo stato della macchina.** I chart Gateway ed Edge montano la radice dell'host e `/proc` perché la dashboard EmberNet possa leggere disco, CPU e memoria della macchina. Non viene aggiunto alcun privilegio. Un cluster con il profilo Pod Security restricted rifiuta un hostPath, quindi imposti lì `opcuaServer.dashboard.boxHealth.enabled: false` prima di aggiornare. [Installare il Gateway](/it/gateway/install/#salute-della-macchina-e-mount-dellhost) riporta i valori.
- **Le funzioni complete ora sono attive per impostazione predefinita.** Dove un chart ha la funzione, `broker.enabled`, `opcuaServer.enabled`, `reports.enabled`, `backup.enabled` (giornaliero, `backup.interval: 24h`), `notify.enabled` con ogni canale di allarme, `edgePublish.enabled`, `monitoring.serviceMonitor.enabled` (generato solo dove sono installati i CRD dell'operatore Prometheus) e `ingress.enabled` valgono true. L'Ingress non ha un nome host, quindi risponde a qualsiasi host serva la sua classe di ingress: imposti `ingress.hosts[0].host` per fissarlo a un solo nome. Un canale di allarme o il publisher Edge senza destinazione aspetta e lo dice, e un amministratore gli dà una destinazione in Impostazioni, "Dove vanno allarmi e letture". Un valore impostato dal suo file prevale ancora, e ognuno impostato a `false` non genera listener, Service, volume né Ingress.
- **Un nuovo accesso che può leggere e nient'altro.** Il chart crea `embernet-dashboard-read` e il suo Secret `<release>-opcua-dashboard` alla prima installazione di questa versione e non lo ruota mai.
- **I comandi UniFi esistono e sono disattivati.** Cinque tipi di punto possono comandare una console, e ciascuno resta in sola lettura finché una persona non arma quel tag. L'account della console deve essere Amministratore locale perché funzionino.
- **L'unità di aggiornamento Quadlet si salta da sola.** `hotloop-db-upgrade` gira solo quando il volume contiene ancora dati PostgreSQL 16, quindi su una macchina già a 17 risulta inattiva, non fallita. Prenda i nuovi file di unità da `deploy/quadlet/`.
- **I chart conservano il Secret delle credenziali alla disinstallazione,** come il volume del database. Per ripartire da zero, elimini il Secret a mano insieme al volume.

## Aggiornamento da 4.18.11

Perché farlo: gli agenti via MCP ora possono scrivere, un valore scritto su un tag con scala arriva nel registro come intendeva, un runtime CODESYS si legge con i nomi che il suo programmatore ha dato alle variabili, HotLoop può inviare letture e log di sistema a un broker Kafka, OPC UA PubSub su UADP funziona in entrambe le direzioni, e un'installazione dallo store la fa accedere come lei stesso. [Le note di rilascio di 4.19.4](/it/releases/hotloop-4-19-4/) hanno l'elenco completo, [4.19.5](/it/releases/hotloop-4-19-5/) è la build multi-architettura, e [4.19.8](/it/releases/hotloop-4-19-8/) aggiunge una correzione del Logbook e selettori di tag che cercano in tutto l'impianto. 4.19.0 a 4.19.3, 4.19.6 e 4.19.7 sono state taggate e mai pubblicate, quindi nessuna esiste come punto di partenza.

```bash
helm repo update
helm upgrade hotloop hotloop/hotloop --version {{hotloop}} \
  --namespace hotloop --reset-then-reuse-values
```

Lo stesso per `hotloop-edge`, `hotloop-iot` e `hotloop-edge-relay`. Il database è già PostgreSQL 17 da 4.18.11, e nulla qui lo cambia, quindi `helm rollback` a 4.18.11 va bene.

- **Gli agenti possono scrivere.** `allowMcpWrites` è attivo per impostazione predefinita nel codice e in tutti e tre i chart. Un deployment che ha `allowWrites` attivo e non ha mai impostato `allowMcpWrites` ottiene le scritture degli agenti con questo aggiornamento, attraverso lo stesso gate dello schermo. Un deployment che ha salvato `allowMcpWrites: false` resta disattivato. Se vuole gli agenti in sola lettura, lo imposti a `false` prima di aggiornare.
- **L'endpoint MCP ha sempre un token.** Un binario da solo o un'unità Quadlet che non ne ha mai impostato uno ne genera uno al primo avvio e lo tiene nel suo database. `hotloop mcp-token` lo stampa, e un agente puntato su `/mcp` senza token smette di funzionare finché non gli dà quello.
- **Tag con scala.** Scriva 55.5 su un tag con scala 0.1 e nel registro entra 555, dove prima entrava 55. Se qualcuno digitava valori grezzi per aggirarlo, ora invia dieci volte troppo. Controlli ogni tag con una scala o un offset che qualcuno scrive a mano, da un'automazione o da una ricetta, e cambi quei numeri in valori ingegneristici nello stesso passo dell'aggiornamento.
- **Gli orari sono in `Z`.** Ogni orario che l'API scrive è UTC. Uno script che leggeva il suo offset locale ora riceve `Z`.
- **Una migrazione,** `0026`, aggiunge una colonna `options` alle destinazioni dello storico, vuota per ogni destinazione esistente.

## Aggiornamento da 4.18.10

Perché farlo: il database ora è PostgreSQL 17, e la macchina si sposta da sola. Ottiene anche le [integrazioni](/it/iot/integrations/) con SNMP e BACnet/IP, l'accesso in modalità kiosk, l'escalation degli allarmi e un'interfaccia che si installa sul telefono. [Le note di rilascio di 4.18.11](/it/releases/hotloop-4-18-11/) hanno l'elenco. Quello che segue è la parte che morde.

PostgreSQL non apre la directory dati di un'altra versione maggiore, quindi un semplice cambio di immagine avrebbe lasciato ogni macchina esistente con un database che non parte. HotLoop non le chiede di fare dump e ricarica. Il primo avvio dopo l'aggiornamento esegue uno script prima del database, e lo script fa lo spostamento.

```bash
helm repo update hotloop
helm upgrade <release> hotloop/hotloop --version {{hotloop}} --reset-then-reuse-values
```

Lo stesso per `hotloop-edge` e `hotloop-iot`. Faccia prima un backup su 4.18.10 e lo copi fuori dalla macchina. Il backup di HotLoop lo fa l'app in esecuzione attraverso il database in esecuzione, quindi non si può fare nel passo che gira prima dell'avvio del database.

### Cosa succede al primo avvio da 4.18.10

- **Il pod del database resta in `Init`, e l'app lo aspetta.** Sul chart sono due init container nel pod del database: la vecchia immagine consegna la sua installazione PostgreSQL 16 e la nuova immagine esegue `pg_upgrade`, in modalità copia, in una nuova directory accanto alla vecchia. Avvia il nuovo server una volta per provare che si apre, e solo allora scambia i nomi. Quanto ci mette dipende dai suoi dati, quindi la prima volta su uno grande guardi il log: `kubectl logs <release>-postgresql-0 -c pg-upgrade`. Su Quadlet è `hotloop-db-upgrade.container`, un'unità oneshot richiesta dall'unità del database: `journalctl -u hotloop-db-upgrade`.
- **Serve circa tanto spazio libero quanto occupano i suoi dati, e controlla prima di partire.** Se non c'è posto, si ferma con i dati 16 esattamente come erano e il database non avviato. Liberi disco e lo riavvii.
- **`pgdata.pg16` resta sul volume, ed è lei a doverlo eliminare.** La vecchia directory viene rinominata e lasciata lì. È l'intero database PostgreSQL 16 com'era all'aggiornamento, cioè il suo backup e la sua via del ritorno, ed è grande quanto il database. Quando la macchina ha girato su 17 per tutto il tempo che vuole:

  ```bash
  # chart
  kubectl -n hotloop exec hotloop-postgresql-0 -c postgresql -- rm -rf /var/lib/postgresql/data/pgdata.pg16
  # Quadlet
  sudo rm -rf "$(sudo podman volume inspect hotloop-db --format '{{.Mountpoint}}')/pgdata.pg16"
  ```

- **Un errore la lascia dov'era.** Se qualcosa fallisce prima dello scambio, i dati 16 restano intatti e il database non parte su una directory costruita a metà. Sul chart il pod resta in `Init:Error`. Su Quadlet l'unità di aggiornamento fallisce e l'unità del database dietro non parte mai. Corregga ciò che dice il log e riavvii.
- **`helm rollback` a 4.18.10 non farà partire il suo database.** È l'avvertenza. Un rollback rimette l'immagine del database a PostgreSQL 16, e 16 non apre una directory 17. Non si perde nulla e nulla resta a metà, il database semplicemente non parte. Recuperarlo richiede lo scambio di [Tornare indietro](/it/install/helm/#tornare-indietro) nella pagina k3s e Helm: fermare il database, spostare `pgdata` in `pgdata.pg17` e `pgdata.pg16` in `pgdata`. **Questo scarta ogni scrittura fatta su 17 dall'aggiornamento,** perché `pgdata.pg16` è il database com'era in quel momento. Vada avanti quando può. Lo scambio di ritorno funziona una volta, e il prossimo aggiornamento si rifiuta di girare finché c'è un `pgdata.pg16` di mezzo. È documentato, non eseguito da un test.
- **Le macchine Quadlet non ne sono colpite.** L'aggiornamento automatico di Podman annulla solo l'app, mai il database, e l'app 4.18.10 legge senza problemi un database PostgreSQL 17, perché le migrazioni si limitano ad aggiungere. Una macchina Quadlet che annulla un aggiornamento continua a funzionare.
- **Una nuova migrazione, `0025_kiosk_pin`.** Aggiunge solo colonne, tutte con un valore predefinito, quindi 4.18.10 funziona sullo schema che lascia.
- **Ora c'è un blocco, su ogni installazione.** Dieci password o PIN errati di fila bloccano quell'account per 5 minuti, e un amministratore può sbloccarlo. Uno script che ritenta una password sbagliata più di dieci volte inizia a ricevere `429`. `HOTLOOP_AUTH_LOCKOUT_ATTEMPTS=0` lo disattiva.
- **Disattivare l'aggiornamento.** `database.postgresql.upgrade.enabled: false` elimina gli init container, e un volume ancora a 16 impedisce allora al database di partire. Lo lasci attivo. Con l'opzione attiva, una nuova installazione scarica comunque l'immagine PostgreSQL 16 una volta per nodo, perché l'immagine di un init container viene scaricata prima dell'esecuzione.

### Quadlet e l'Edge Relay

Copi i nuovi `hotloop-db.container`, `hotloop-db-upgrade.container` e `hotloop-db-upgrade.sh` dalla directory del suo prodotto in `deploy/quadlet/` nella directory delle unità, esegua `systemctl daemon-reload` e riavvii `hotloop-db.service`. L'unità del database richiede l'unità di aggiornamento, quindi una macchina che ha ricevuto solo la nuova unità del database non parte su dati 16, e dice perché. L'Edge Relay non ha database e nulla da fare. Esce a {{hotloop}} perché ogni prodotto esce in sincronia.

### Modifiche all'API da 4.18.10

- **Nuove route:** `GET` e `PUT /api/notify/escalation`, `GET /manifest.webmanifest` e `GET /sw.js` (senza sessione, perché un telefono le chiede prima che qualcuno abbia effettuato l'accesso), `GET /api/integrations` con `POST /api/integrations/{id}/probe` e `/setup`, `POST /api/auth/kiosk`, `POST /api/auth/activity`, `PUT` e `DELETE /api/users/{username}/pin`, e `DELETE /api/users/{username}/lockout`.
- **Una nuova autorizzazione, `notify.escalation`,** solo per amministratori. I ruoli visualizzatore e operatore non l'hanno ricevuta.
- **Due nuovi protocolli,** `snmp` e `bacnet`, in `GET /api/protocols`. Il registro degli allarmi ha due nuovi tipi di evento, `escalated` e `escalation-ended`, e uno script che presume il vecchio elenco li incontrerà.
- **Gli orari tornano in UTC,** tutti quelli che restituisce lo storico. Uno script che confrontava le stringhe vede l'offset diventare `Z`. Uno che confronta istanti non vede nulla.

## Aggiornamento da 4.17.0

Perché farlo: il Gateway non è più l'unica immagine. IoT ed Edge sono nuovi, il database è un'impostazione, i dispositivi che si annunciano via MQTT compaiono da soli, lo storico può essere scritto nel database dell'impianto, e una macchina che segue `:stable` annulla da sola un cattivo aggiornamento. Quest'ultimo funziona solo perché le migrazioni si limitano ad aggiungere. [Le note di rilascio di 4.18.10](/it/releases/hotloop-4-18-10/) hanno l'elenco.

È un semplice `helm upgrade`. Abbiamo generato i chart Gateway 4.17.0 e {{hotloop}} affiancati con gli stessi valori: gli stessi otto oggetti, gli stessi selettori, gli stessi volume claim.

```bash
helm repo update hotloop
helm upgrade <release> hotloop/hotloop --version {{hotloop}} --reset-then-reuse-values
```

`--reset-then-reuse-values`, oppure il suo file di valori con `-f`. `--reuse-values` da solo stavolta si genera, ma ripropone i valori di 4.17.0 e scarta ogni valore predefinito aggiunto da questa versione, ed è così che si finisce sul vecchio limite di coda qui sotto senza volerlo.

### Cosa succede al primo avvio da 4.17.0

- **Girano le migrazioni da 0016 a 0025:** `0016_mqtt_discovery`, `0017_broker_logins`, `0018_mqtt_sources`, `0019_historian_targets`, `0020_net_finds`, `0021_mqtt_source_dialects`, `0022_mqtt_source_shelly`, `0023_dashboards` (la tabella in cui si salvano le dashboard che costruisce) e `0024_tag_no_data` (una colonna `no_data` sui tag, vuota per ogni tag esistente, cioè ciò che quei tag già facevano) e `0025_kiosk_pin` (colonne per un hash del PIN, il limite di inattività di una sessione e i contatori di blocco). Tutte additive. Prima `pg_dump`, come sempre.
- **`edgePublish.queueMaxBytes` vale 64 MiB per impostazione predefinita, non illimitato.** Conta solo se pubblica a monte via Sparkplug. Oltre il limite le letture più vecchie vengono scartate e contate. Una coda illimitata riempie il volume in un'interruzione abbastanza lunga, che è peggio, ma è un valore predefinito cambiato. 64 MiB sono circa 248,000 letture, circa due minuti a 2,000 letture al secondo, quindi lo dimensioni sul suo ritmo (circa 240 byte a lettura), oppure lo imposti a `0` per il vecchio comportamento. HotLoop avvisa all'avvio quando lo fa. Una release aggiornata con `--reuse-values` mantiene ciò che aveva.
- **Accessi al broker.** Gli accessi di `HOTLOOP_BROKER_USERS` possono ancora tutto, come prima, perché nessuno dovrebbe aggiornare verso un impianto il cui traffico Sparkplug rimbalza su regole che non ha mai scritto. Gli accessi che crea in Impostazioni, MQTT portano le regole di topic di un profilo. Un broker senza `HOTLOOP_BROKER_USERS` ora parte, ed entrano solo HotLoop e gli accessi creati al suo interno.
- **Il database passa da PostgreSQL 16 a 17 a questo primo avvio,** da solo, e serve spazio libero su disco. [La sezione 4.18.10](#aggiornamento-da-41810) dice come va, ed è la parte da leggere per prima.
- **Tornare a 4.17.0 ora è uno scambio di database, non un `helm rollback`.** Lo schema è solo cresciuto e 4.17.0 ci gira sopra, ma il database di 4.17.0 è PostgreSQL 16 e non aprirà la directory 17 lasciata dall'aggiornamento; lo scambio di ritorno è nella sezione 4.18.10. Faccia comunque un backup prima di aggiornare. Da qui in poi l'app conta anche di quanto è avanti il suo database, e si rifiuta di partire, nominando entrambe le versioni, quando il database è due release avanti.
- **Vuole un altro prodotto?** Da IoT a Edge al Gateway mantiene ogni dispositivo, tag, entità, automazione, allarme, utente e ora di storico. Faccia un backup, poi `helm upgrade hotloop hotloop/hotloop-edge` sulla stessa release. [La gamma](/it/products/) spiega come. Scendere di prodotto non è una mossa da fare su una macchina a cui tiene.

### L'Edge Relay e Quadlet

Aggiorni anche il chart del relay con `--reset-then-reuse-values`. Gli utenti Quadlet prendono il nuovo `edge-relay.container`: segue `:stable` invece di fissare 4.17.0, e porta l'healthcheck e `--sdnotify=healthy` che fanno annullare un cattivo aggiornamento. Senza questi due, un aggiornamento morto viene segnalato come riuscito. Un file di dispositivi inviato dal Gateway ora si applica dal vivo, senza riavvio, mentre su 4.17.0 ne aspettava uno. [La pagina di installazione dell'Edge Relay](/it/edge-relay/install/) ha l'unità completa.

Il Gateway ora ha unità Quadlet, che 4.17.0 non aveva. Sono nella directory `gateway/` di [Podman Quadlet](/it/install/quadlet/), e [la pagina di installazione del Gateway](/it/gateway/install/#podman-quadlet) ha i passi.

### Modifiche all'API da 4.17.0

- **Nuove route:** `/api/discovery` e le sue azioni `accept`, `ignore`, `unignore` e `review`, `/api/network-discovery` e i suoi `probe`, `accept`, `ignore` e `unignore`, `/api/mqtt/brokers`, `/api/broker/logins`, `/api/historian/targets`, `GET /api/entities/{entity_id}/image` e `POST /api/fleet/{id}/update`, che approva l'aggiornamento di immagine che un relay sta trattenendo. Non è stato rimosso nulla.
- **`GET /api/status` indica `product` e `features`,** e il digest dell'immagine. Uno script chiede invece di sondare. Una route di una funzione che il prodotto non ha risponde `404` con `{"error":...,"product":...,"feature":...}`.
- **Nuova autorizzazione:** `fleet.update`, solo amministratore. Il ruolo operatore non è cambiato.

## Aggiornamento da 4.16.0

Questo è il salto a 4.17.0, e da 4.17.0 si prosegue verso {{hotloop}} con [la sezione qui sopra](#aggiornamento-da-4170). Tutto quanto segue è stato provato su 4.17.0.

Perché farlo: 4.16.0 ha bug in cui un impianto in funzione può inciampare, e 4.17.0 li corregge. La riga di comando può inghiottire un Set, così un operatore vede la riga chiudersi, crede che il setpoint sia partito, e non è stato scritto nulla. Salvare una regola nell'editor, anche solo per rinominarla, riporta in silenzio il suo budget di esecuzione a cinque minuti. Un file di dispositivi inviato a un Edge Relay non arriva mai, mentre il Gateway dice `config pushed`. E un deploy dall'App Store EmberNet perde il suo tenant. Oltre alle correzioni ottiene [ricette](/it/iot/recipes/), [script](/it/iot/scripts/), [blueprint](/it/iot/blueprints/), [helper](/it/iot/helpers/), il [logbook](/it/iot/logbook/), i nuovi passi di [automazione](/it/iot/automations/), [UniFi](/it/iot/unifi/) in sola lettura, e [MCP](/it/iot/mcp/) che passa da 16 strumenti a 25.

È un semplice `helm upgrade`. Abbiamo generato entrambi i chart nelle due versioni: ogni selettore e ogni volume claim sono identici, e l'unico oggetto nuovo è il Secret della chiave.

```bash
helm upgrade <release> https://hotloop.io/hotloop/hotloop-4.17.0.tgz --reset-then-reuse-values
```

`--reset-then-reuse-values`, oppure il suo file di valori con `-f`. **Non `--reuse-values`.** Ripropone i valori di 4.16.0 e scarta ogni valore predefinito aggiunto da questo chart, e la generazione muore al primo che le serve (`nil pointer evaluating interface {}.enabled`, da `secretKey`). Quando succede non cambia nulla sul cluster, quindi lo riesegua nel modo giusto.

### Cosa succede al primo avvio

L'abbiamo verificato eseguendo l'immagine 4.16.0 pubblicata su un database, poi 4.17.0 sullo stesso.

- **Girano le migrazioni da 0009 a 0015:** `0009_helpers`, `0010_logbook`, `0011_scripts`, `0012_tag_device_class`, `0013_recipes`, `0014_blueprints` e `0015_unifi`. Tutte additive. Su un impianto vuoto hanno richiesto un quinto di secondo. Sul suo richiedono quanto richiede il suo database. Prima `pg_dump`, come sempre.
- **Le password dei suoi dispositivi vengono cifrate.** Il chart crea `<release>-secret-key` con questo aggiornamento (non esisteva in 4.16.0), e il Gateway sigilla ogni credenziale salvata a quell'avvio e lo dice nel suo log: `encrypted stored device credentials devices=N`. I dispositivi continuano a connettersi, e nessuno deve digitare di nuovo nulla.
- **Da allora, quella chiave fa parte dei suoi dati.** Avvii il Gateway senza di essa e ogni dispositivo con una password sigillata resta giù, a ritentare, con un errore che nomina la chiave che gli serve. Un backup fatto dopo l'aggiornamento si ripristina solo dove quella chiave è montata, e `--restore-from` lo rifiuta per nome ovunque altrove. Se la chiave è persa per sempre, `--restore-keep-unreadable-credentials` riporta tutto il resto e lascia quei dispositivi giù finché qualcuno non digita di nuovo le password. Un backup di 4.16.0 si ripristina ovunque, e le sue credenziali vengono sigillate appena finisce il ripristino.
- **Tornare a 4.16.0** sullo stesso database parte (l'abbiamo provato), ma 4.16.0 non sa nulla del sigillo. Consegna a ogni dispositivo il testo sigillato come password, quindi tutto ciò che controlla una password la rifiuta. Se deve tornare indietro, ripristini il `pg_dump` fatto prima dell'aggiornamento. È l'unico motivo per cui l'ha fatto.
- **Genera il chart invece di installarlo?** La chiave è generata da un `lookup` che solo un vero `helm install` o `helm upgrade` può fare. Tutto ciò che esegue `helm template` e applica il risultato ottiene una nuova chiave a ogni generazione, e la sincronizzazione successiva chiude fuori ogni password sigillata. Crei la sua chiave con `hotloop gen-secret-key`, la metta in un Secret che gestisce lei e imposti `secretKey.existingSecret`. Helm, Fleet e l'App Store EmberNet installano davvero e non ne hanno bisogno.

Quindi il nuovo compito dopo questo aggiornamento: faccia il backup di `<release>-secret-key` come fa con gli altri secret del cluster, e la tenga altrove rispetto ai suoi backup. Una chiave accanto ai backup che protegge non protegge nulla. [Installare](/it/gateway/install/#fate-il-backup-della-chiave-prima-di-averne-bisogno) riporta il resto di ciò che copre la chiave.

### L'Edge Relay

Anche il relay è 4.17.0, rilasciato dallo stesso tag. Aggiorni il suo chart a 4.17.0, con lo stesso tipo di URL, `https://hotloop.io/hotloop/hotloop-edge-relay-4.17.0.tgz`, e con la stessa regola sui flag: `--reset-then-reuse-values` o il suo file di valori. `--reuse-values` sul relay non fallisce nemmeno. Scarta il nuovo valore predefinito `pushedDevicesFile` del chart, genera la variabile vuota, e un invio torna subito a morire sul montaggio in sola lettura. Poi sappia quattro cose.

- **Un file di dispositivi inviato vive in `/data/pushed-devices.json`** (`HOTLOOP_EDGE_RELAY_PUSHED_FILE`, il `pushedDevicesFile` del chart), sul volume del relay. Prevale sui `devices` del chart finché esiste, attraverso riavvii, riprogrammazioni e un `helm upgrade` che cambia `devices`. Il relay registra da quale file è partito. Per tornare al file locale, `DELETE /api/fleet/{id}/config` sul Gateway (`fleet.config`) mentre il relay è connesso, poi lo riavvii. Quel riavvio è di 4.17.0. Da 4.18.10 un relay connesso torna indietro subito.
- **Un vecchio invio può tornare.** Un invio fatto a un relay 4.16.0 non è mai arrivato, ma il broker lo tiene ancora, retained, e un relay 4.17.0 lo raccoglie al primo avvio e lo esegue. Se è obsoleto, lo cancelli con lo stesso `DELETE` subito dopo l'aggiornamento e riavvii il relay. Da 4.18.10 la cancellazione si applica dal vivo e il riavvio non serve.
- **Quadlet: prenda il nuovo `edge-relay.container`.** L'unità di 4.17.0 fissava 4.17.0 e impostava `HOTLOOP_EDGE_RELAY_PUSHED_FILE`, e anche quella attuale lo imposta, ma segue `:stable`. Senza quella riga un invio continua a fallire sulla radice in sola lettura. [La pagina di installazione dell'Edge Relay](/it/edge-relay/install/#quadlet) ha l'unità completa.
- **`persistence.enabled=false` ora parte,** su un emptyDir limitato a `persistence.size`. Sappia cosa costa prima di sceglierlo: a ogni sostituzione del pod perde la coda di inoltro, ogni file di dispositivi inviato e il certificato client OPC UA. Tutto ciò a cui tiene va su un PVC, che è l'impostazione predefinita.

### Cosa noterà uno script contro l'API

- **Un orario che non è accaduto viene omesso.** Non `null`, omesso. 4.16.0 inviava `0001-01-01T00:00:00Z` per `lastRun` su una regola o uno script mai eseguito, `lastPoll` e `lastGood` su un dispositivo mai interrogato, `clearedAt`, `ackedAt` e `shelvedUntil` su un allarme in corso, `raisedAt` su uno mai scattato, gli stessi campi sull'evento `alarm` del feed live, e qualche altro. È così che una regola mai eseguita diceva "Ultima esecuzione 739887 g fa". Se il suo codice verifica l'anno uno, verifichi invece che il campo ci sia.
- **Gli operatori ricevono nuove autorizzazioni appena aggiorna:** `helpers.write`, `scripts.run`, `recipes.apply` e `blueprints.apply`. Quindi i suoi operatori possono subito impostare helper, eseguire script, applicare ricette e creare regole da blueprint. Scrivere script, ricette e blueprint (`scripts.write`, `recipes.write`, `blueprints.write`) è da amministratore. Tutti li leggono. Una ricetta può anche nominare il proprio `recipes.apply.<name>`.
- **Nuove route:** `/api/helpers`, `/api/logbook`, `/api/scripts`, `/api/recipes`, `/api/blueprints`, `POST /api/automations/{id}/blueprint-upgrade`, quelle UniFi (`/api/devices/{id}/network` e `/api/unifi/{id}/...`) e `DELETE /api/fleet/{id}/config`.
- **I tag portano `deviceClass`**, e arriva fino alle loro entità.
- **Le regole portano `blueprintId`, `blueprintVersion` e `blueprintInputs`.** Una regola scritta a mano non ne ha nessuno. Salvare una regola la sostituisce ancora per intero, e un corpo non può spostare una regola su un altro blueprint o un'altra versione.

## Aggiornamento da 4.3.1

4.3.1 è stata pubblicata ad agosto, e nulla dopo di lei lo è stato fino a 4.16.0. Tutto da 4.4.0 a 4.15.3 è stato integrato e mai pubblicato, quindi lasciando 4.3.1 prende tutto in un solo salto, con un nuovo nome, una nuova immagine, un nuovo chart e una nuova licenza. Questa sezione la porta a 4.16.0, la release su cui questa procedura è stata provata. Da lì, [Aggiornamento da 4.16.0](#aggiornamento-da-4160) qui sopra è il semplice aggiornamento a 4.17.0, e [Aggiornamento da 4.17.0](#aggiornamento-da-4170) è quello dopo. Le legga tutte e tre prima di toccare un impianto in funzione. Sono brevi, e più brevi che spiegare al direttore di stabilimento perché lo storico è vuoto.

### Nuovo nome su tutto

| Cosa | 4.3.1 | 4.16.0 e successive |
|---|---|---|
| Immagine | `ghcr.io/embernet-ai/industrial-iot` | `ghcr.io/hotloop-io/hotloop` |
| Repository dei chart | il vecchio indirizzo, ora un 404 | `https://hotloop.io/hotloop` |
| Chart | `industrial-iot` | `hotloop` |
| Variabili d'ambiente | `IIOT_*` | `HOTLOOP_*` (da 4.9.0) |

### Non è un semplice helm upgrade

Il nome del chart è scritto nei selettori del Deployment e dello StatefulSet, e Kubernetes si rifiuta categoricamente di cambiare un selettore sul posto. Punti la vecchia release al nuovo chart e semplicemente fallisce. Mantenga il nome della release e il namespace, e:

1. Faccia un `pg_dump` del database. Cintura e bretelle. Sarà contento di averlo fatto.
2. Elimini il vecchio Deployment (`<release>`) e lo StatefulSet (`<release>-postgresql`). Il volume del database è un claim a sé, e resta dov'è.
3. Aggiunga il repository e aggiorni con il file di valori con cui eseguiva 4.3.1:

   ```bash
   helm upgrade <release> https://hotloop.io/hotloop/hotloop-4.16.0.tgz \
     -n <namespace> -f your-4.3.1-values.yaml
   ```

   Questo è il chart 4.16.0 per URL, che funziona prima di aggiungere il repository. Una volta su 4.16.0, aggiunga il repository (`helm repo add hotloop https://hotloop.io/hotloop`) per i salti successivi.

   Nulla in quel file è stato rimosso dal chart. Rinomini ogni `IIOT_` in `extraEnv` in `HOTLOOP_`, ed elimini un override di `image.repository` se ne aveva uno. Non usi `--reuse-values`. Salta ogni valore predefinito che questo chart ha aggiunto da 4.3.1, che sono più della metà delle sue chiavi, e si ritroverebbe a far girare un chart fatto per lo più di buchi.

I nomi, la password del database nel Secret e il volume claim si generano identici a quelli di 4.3.1, quindi il nuovo pod del database monta i vecchi dati. Il Gateway migra lo schema in avanti all'avvio, e già che c'è aggiorna TimescaleDB da 2.29.1 a 2.30.1.

L'abbiamo verificato generando i due chart affiancati. Il passo 1 è la sua via del ritorno: se l'aggiornamento la sorprende, ha un dump di cinque minuti prima, e vogliamo saperlo a [helpdesk@fireballz.ai](mailto:helpdesk@fireballz.ai).

### Cosa si comporta in modo diverso

- **C'è un accesso.** Prima di 4.4.0 non ce n'era affatto. Il chart crea un account `admin` alla prima installazione; [Installare](/it/gateway/install/#accedere) ha il comando che rilegge la password.
- **Le scritture sono disattivate per impostazione predefinita**, agenti compresi, da 4.4.0. Se il suo file di valori 4.3.1 non ha mai impostato `safety.allowWrites`, ogni scrittura che i suoi operatori e le sue regole facevano viene rifiutata dopo l'aggiornamento finché non lo imposta. È voluto, ed è il momento di rivedere cosa è armato prima di riattivarlo.
- **Un fuso orario che non si carica ferma l'avvio.** `HOTLOOP_TIMEZONE` o `TZ` impostati su qualcosa di inventato giravano prima su UTC senza dire nulla, il che sposta in silenzio ogni report, pianificazione e cambio turno di ore.
- **Le credenziali dei dispositivi si rileggono come `[redacted]`** per ogni ruolo, amministratore compreso (4.15.1). Salvare un dispositivo con il segnaposto mantiene la password salvata.
- **Le impostazioni di polling sono `HOTLOOP_POLL_INTERVAL`, `HOTLOOP_MIN_POLL_INTERVAL` e `HOTLOOP_POLL_TIMEOUT`.** La vecchia schermata Impostazioni diceva di impostare `HOTLOOP_POLL_INTERVAL_MS`, `HOTLOOP_MIN_POLL_INTERVAL_MS` e `HOTLOOP_TIMEOUT_MS`, che nessuno leggeva mai. Se le ha impostate, non facevano nulla. Le rinomini.
- **I tag OPC UA importati mantengono il tipo con cui sono stati importati.** Discover tags chiamava float ogni nodo. Ora legge il tipo reale di ogni nodo, ma i tag importati prima mantengono `float`, e il server OPC UA di HotLoop pubblica un tag con il tipo dichiarato, quindi un tag di testo arriva a Ignition come `Bad_TypeMismatch`. Dichiari i suoi tag di testo `string`.
- **Edge publish ora ha un blocco di valori.** Se lo impostava tramite `extraEnv`, lo sposti in `edgePublish:` ed elimini le variabili, o risultano impostati due volte.
- **Il server OPC UA dice `HotLoop`** come produttore, dove le versioni precedenti usavano un altro nome di produttore. Se un client o uno script di inventario confronta con quella stringa, la cambi prima che smetta di corrispondere.
- **La licenza.** I termini sono cambiati dopo 4.3.1. Quelli attuali sono sulla [pagina Licenza]({{LICENSE_URL}}).

### Modifiche all'API da 4.3.1

Se ha uno script o un'integrazione contro l'API, questo è l'elenco. Tutto il resto sono aggiunte. Le modifiche da 4.16.0 a 4.17.0 [qui sopra](#cosa-noterà-uno-script-contro-lapi) si sommano a queste, e così quelle da 4.17.0 a {{hotloop}} [sopra di esse](#modifiche-allapi-da-4170).

- **Le liste vuote sono `[]`, mai `null`,** in ogni risposta e in ogni evento di stream, a qualsiasi profondità. `GET /api/runs`, le automazioni, i tag di un dispositivo, l'audit delle scritture, gli utenti, gli eventi di allarme, le sparkline e una finestra di storico vuota rispondevano `null`. Un `null` che vede ancora non è mai una lista; è un campo nullable documentato, come l'`equipment_id` di un'entità.
- **Gli intervalli di `/api/history` senza letture buone sono `null`,** e si disegnano come vuoti, e le letture cattive restano fuori dalle medie dei trend. Un trend e un report sulla stessa ora ora dicono la stessa cosa.
- **Un errore che l'API non sa collocare è un 500** con un riferimento nel log del server, non un 400. Un dispositivo che dà errore su una scrittura o un browse è un 502. [Il gate di scrittura](/it/gateway/write-gate/#cosa-risponde-ogni-rifiuto) ha ogni stato che una scrittura può ricevere.
- **`alarm.turn_on`, e ogni altro servizio che un'entità di allarme non accetta, è un 400** ("unknown service"). Prima rispondeva successo e non faceva nulla, che è la peggiore risposta possibile.
- **Togliere dal differimento un allarme che non è differito è un 409.** Prima portava l'allarme a normale qualunque cosa stesse facendo, il che poteva cancellare dalla lista un allarme rientrato e non riconosciuto, proprio l'allarme che l'ISA-18.2 esiste per tenervi.
- **Il JSON di un tag porta sempre `minValue`, `maxValue` e `hasRange`,** e solo `hasRange` dice se c'è un intervallo. Un intervallo che partiva da 0 prima sembrava non avere minimo.
- **Nuovo: `?dry_run=true` su `POST /api/services/{domain}/{service}`.** Esegue i controlli del gate, non scrive nulla, non registra nulla e risponde con il rifiuto che darebbe la chiamata vera. `dry_run` accetta `true` o `false` e nient'altro; `yes` è un 400, perché un'ipotesi sbagliata trasforma una domanda in un comando.
- **`GET /api/settings`** nomina in `envVar` la variabile da cui un valore è realmente arrivato, fallback compresi, e una variabile impostata a una stringa vuota conta come non impostata.

Le [note di rilascio](https://hotloop.io/releases/core/) hanno il resto di ciò che è cambiato, versione per versione fino a 4.4.0. Una volta su 4.16.0 e con lo storico ancora pieno, passi a [Aggiornamento da 4.16.0](#aggiornamento-da-4160), e poi a [Aggiornamento da 4.17.0](#aggiornamento-da-4170).
