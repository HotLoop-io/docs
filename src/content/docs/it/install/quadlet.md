---
title: "Podman Quadlet su un Pi"
description: "Esegui HotLoop come veri servizi systemd su un Pi o un piccolo PC industriale con Podman Quadlet, senza Docker, senza Compose e senza cluster."
---

Per un Pi o un piccolo PC industriale che **non** fa parte di un cluster k3s. Se ne fa parte, usa invece il chart del prodotto. Questa directory e i chart sono i due modi supportati di eseguire HotLoop.

Niente Docker, e niente `podman run` isolato da una shell che muore con la sessione. Quadlet trasforma i container in veri servizi systemd: partono all'avvio senza nessun utente connesso, si riavviano in caso di errore, scrivono su journald.

| Directory | Prodotto | Immagine |
|---|---|---|
| `iot/` | HotLoop IoT, con PostgreSQL 17 | `ghcr.io/hotloop-io/hotloop-iot` |
| `edge/` | HotLoop Edge, con TimescaleDB | `ghcr.io/hotloop-io/hotloop-edge` |
| `gateway/` | HotLoop Gateway, con TimescaleDB | `ghcr.io/hotloop-io/hotloop` |
| questa directory | HotLoop Edge Relay, senza database | `ghcr.io/hotloop-io/hotloop-edge-relay` |

[La pagina dei prodotti](/it/products/) indica quale ti serve.

Ciascuno dei primi tre ha anche una directory `sqlite/`: lo stesso prodotto con il database come file e senza container del database. Vedi [SQLite invece di PostgreSQL](#sqlite-invece-di-postgresql).

## IoT, Edge e il Gateway

Ogni directory ha le stesse unità e uno script:

- **`hotloop.network`**: la rete condivisa dall'app e dal suo database. L'app raggiunge il database per nome (`hotloop-db:5432`) e nient'altro sulla macchina può farlo, perché il database non pubblica alcuna porta. Viene pubblicata solo la 8080 dell'app.
- **`hotloop.container`**: l'app. La sua intestazione contiene i passaggi di installazione; leggila prima di copiare qualsiasi cosa.
- **`hotloop-db.container`**: il database, la stessa immagine e versione eseguite dal chart di quel prodotto. Si dichiara avviato appena risponde, così l'app attende un database utilizzabile.
- **`hotloop-db-upgrade.container`** e **`hotloop-db-upgrade.sh`**: il passaggio del database da PostgreSQL 16 a 17, una sola volta. Viene eseguito prima dell'unità del database e solo se il volume contiene ancora dati della 16; su un volume nuovo, o già alla 17, systemd lo salta. Vedi [PostgreSQL da 16 a 17](#postgresql-da-16-a-17).
- **`hotloop-db.volume`** e **`hotloop-data.volume`**: il database, e tutto ciò che l'app scrive sotto `/data` (backup, certificati, la coda di inoltro, report). Sono volumi Podman con nome, quindi `podman system prune` non li tocca.

Tre secret di Podman contengono ciò che non va in un file: `hotloop-db-password`, `hotloop-secret-key` (cifra le password dei dispositivi nel database; tieni una copia fuori dalla macchina) e `hotloop-admin-password-hash` (l'hash bcrypt della password del primo amministratore, mai la password).

**Podman 5.0 o successivo.** Raspberry Pi OS Bookworm include Podman 4.3, che non ha Quadlet: usa Raspberry Pi OS Trixie (Podman 5.4) o successivo. Gli aggiornamenti descritti sotto sono stati eseguiti su Podman 6.1.3; l'unità dell'Edge Relay, che condivide le stesse chiavi, su 4.9.3. E metti il volume del database su un SSD USB, non sulla scheda SD. Lo storico scrive tutto il giorno, e le schede SD muoiono proprio per questo.

### Perché tutti i prodotti usano gli stessi nomi

I nomi delle unità, dei volumi e dei secret sono identici in `iot/`, `edge/` e `gateway/`, di proposito. Passare una macchina a un prodotto superiore significa copiare `hotloop.container` e `hotloop-db.container` del prodotto maggiore sopra i tuoi:

```sh
sudo cp gateway/hotloop.container gateway/hotloop-db.container \
  gateway/hotloop-db-upgrade.container gateway/hotloop-db-upgrade.sh /etc/containers/systemd/
sudo systemctl daemon-reload
sudo systemctl restart hotloop.service hotloop-db.service
```

I volumi e i secret restano, e con loro ogni dispositivo, tag, allarme, utente e ora di storico. Fai comunque un backup prima (`POST /api/backup`). Questo passaggio è stato eseguito, da IoT a Edge al Gateway sullo stesso insieme di volumi. Tornare a un prodotto inferiore non è un passaggio da fare su una macchina a cui tieni.

Significa anche un solo HotLoop per macchina. Due si contenderebbero comunque la porta 8080.

### Verificato

I file distribuiti di IoT, Edge e Gateway, non modificati, vengono generati dal generatore `quadlet` di Podman 6.1.3 con la stessa struttura: l'app richiede il database e la rete, pubblica la propria porta e porta l'etichetta di aggiornamento automatico, mentre il database non ne porta nessuna e non pubblica nulla.

Le unità del Gateway sono poi state eseguite davvero: senza privilegi, sotto systemd, con un registry locale al posto di ghcr.io e il `podman auto-update` dei prodotti stessi. Un primo avvio con il database sano e poi l'app sana; un aggiornamento a un rilascio che aggiunge una migrazione a una tabella già usata dall'app, eseguito con il dispositivo esistente e i suoi dati intatti e senza mai riavviare il container del database; e un aggiornamento a un rilascio che migra il database e poi non riesce ad avviarsi, che Podman ha annullato, con il rilascio precedente che è ripartito sano sul database già migrato da quello fallito. Edge e IoT usano le stesse unità e sono stati eseguiti sotto systemd su un vero Pi, su hardware reale (2026-11-17).

## PostgreSQL da 16 a 17

Il database di HotLoop è PostgreSQL 17 da questo rilascio. Una macchina che eseguiva un rilascio precedente ha dati PostgreSQL 16, che PostgreSQL 17 non apre, quindi il passaggio è un'unità che viene eseguita prima del database. Metti a posto i nuovi file e riavvia il database, e basta:

```sh
sudo cp hotloop-db.container hotloop-db-upgrade.container hotloop-db-upgrade.sh \
  /etc/containers/systemd/
sudo systemctl daemon-reload
sudo systemctl restart hotloop-db.service
journalctl -u hotloop-db-upgrade.service      # what it did
```

`hotloop-db.container` richiede l'unità di aggiornamento, quindi una macchina che ha copiato solo la nuova unità del database non parte su dati 16 e il journal dice perché. L'unità di aggiornamento esegue `pg_upgrade` in modalità copia in una nuova directory accanto alla vecchia, avvia una volta il nuovo server per provare che si apre e solo allora scambia i nomi; i vecchi dati restano sul volume come `pgdata.pg16`. Scarica l'immagine PostgreSQL 16 solo quando il volume ne ha bisogno. Un errore lascia i dati 16 com'erano e il database non avviato. La descrizione completa, la strada del ritorno e come eliminare `pgdata.pg16` sono in [k3s e Helm](/it/install/helm/#postgresql-17). Per un'installazione senza privilegi il percorso dello script nell'unità è `~/.config/containers/systemd`, a partire da `%E`.

## SQLite invece di PostgreSQL

Il database è un'impostazione, non un'immagine (la pagina k3s e Helm, "SQLite"). Con Quadlet significa un secondo insieme di file, non una seconda immagine. La directory `sqlite/` di ogni prodotto ne ha due:

- **`sqlite/hotloop.container`**: solo l'app. Nessun `Requires=` su un database, nessuna rete, nessuna password del database, e `HOTLOOP_DB_TYPE=sqlite` con il file in `HOTLOOP_DB_PATH=/data/hotloop.db`. Segue `:stable` e annulla un cattivo aggiornamento esattamente come l'unità PostgreSQL: stesso controllo di stato, stesso `--sdnotify=healthy`.
- **`sqlite/hotloop-data.volume`**: il volume `hotloop-data`, dove si trovano il file del database e i suoi `-wal` e `-shm`. Ha lo stesso nome del volume dei file PostgreSQL, quindi è lo stesso volume di dati se mai cambierai.

| Directory | Installazione | Secret |
|---|---|---|
| `iot/`, `edge/`, `gateway/` | `hotloop.network`, `hotloop.container`, `hotloop-db.container`, `hotloop-db.volume`, `hotloop-data.volume` | tre |
| `iot/sqlite/`, `edge/sqlite/`, `gateway/sqlite/` | `hotloop.container`, `hotloop-data.volume` | due: `hotloop-secret-key` e `hotloop-admin-password-hash` |

Installa un insieme o l'altro, mai entrambi: usano gli stessi nomi di unità. L'intestazione di `sqlite/hotloop.container` ha i passaggi esatti. In breve:

```sh
cd iot/sqlite        # or edge/sqlite, gateway/sqlite
sudo cp hotloop.container hotloop-data.volume /etc/containers/systemd/
# make hotloop-secret-key and hotloop-admin-password-hash as the header says
sudo systemctl daemon-reload
sudo systemctl start hotloop.service
curl -s localhost:8080/api/status
```

Alcune cose da sapere prima di sceglierlo. SQLite è un solo scrittore su un solo disco locale: su un Pi il volume va su un SSD USB, e lo storage di rete non è un'opzione perché SQLite vi si corrompe. Lo storico è una tabella con un indice, non partizioni né un hypertable, quindi un sito con anni di storico al secondo vuole i file PostgreSQL. E spostare una macchina tra SQLite e PostgreSQL è un backup e un ripristino ([Backup e ripristino](/it/iot/backup/)), non uno scambio di unità: il nuovo database parte vuoto. Non copiare un `sqlite/hotloop.container` su un'installazione PostgreSQL in funzione per "passare"; non legge i dati del volume PostgreSQL.

PostgreSQL semplice su Edge o sul Gateway è l'unità TimescaleDB con `Environment=HOTLOOP_HISTORIAN_TIMESCALE=false` aggiunto a `hotloop.container`. L'unità di IoT è già PostgreSQL semplice, e IoT non ha alcuna unità TimescaleDB.

### Verificato (SQLite)

`iot/sqlite/hotloop.container` e il suo volume sono stati eseguiti senza privilegi su Podman 4.9.3 sotto systemd (`systemctl --user`) dai file di cui è stato fatto il commit, modificati solo nei nomi, nella porta, nell'immagine (costruita dallo stesso albero) e nella directory di runtime che serve a un gestore utente. L'unità è partita sana, `/healthz` e `/readyz` hanno risposto 200, l'amministratore ha effettuato l'accesso dal secret dell'hash, `/api/status` ha risposto, `hotloop.db`, `hotloop.db-wal` e `hotloop.db-shm` sono comparsi sul volume, e un riavvio non ha applicato migrazioni e ha fatto accedere di nuovo l'amministratore. Le unità `sqlite/` di Edge e Gateway sono lo stesso file a parte l'immagine e il valore predefinito di conservazione, e sono state eseguite sotto systemd come root su un vero Pi, su hardware reale (2026-11-17).

## Edge Relay

- **`edge-relay-hold.conf`**: facoltativo: trattiene gli aggiornamenti dell'immagine finché un operatore non li approva. Un file integrativo systemd, non parte di un'installazione predefinita.
- **`edge-relay.container`**, il servizio vero e proprio. I passaggi completi di installazione sono nel commento della sua intestazione; leggilo prima di copiare qualsiasi cosa.
- **`edge-relay-data.volume`**, un volume Podman con nome per la coda di inoltro, così le letture in buffer sopravvivono al riavvio del container. Podman lo crea automaticamente al primo avvio del servizio.
- **`devices.example.json`**, un punto di partenza per il file dei dispositivi. Copialo in `/etc/edge-relay/devices.json` e modificalo per i dispositivi reali di questo sito; vedi [il riferimento dell'Edge Relay](/it/edge-relay/reference/) per il formato completo.

### Avvio rapido

```sh
sudo mkdir -p /etc/containers/systemd /etc/edge-relay
sudo cp edge-relay.container edge-relay-data.volume /etc/containers/systemd/
sudo cp devices.example.json /etc/edge-relay/devices.json   # then edit it
sudo "$EDITOR" /etc/containers/systemd/edge-relay.container  # broker, group, node

# Skip this if the broker takes anonymous connections.
printf '%s' 'your-broker-password' | sudo podman secret create edge-relay-broker-password -

sudo systemctl daemon-reload
sudo systemctl start edge-relay.service
sudo systemctl status edge-relay.service
curl localhost:8081/status
```

**Aggiornamenti.** L'unità segue `:stable` e si aggiorna da sola una volta attivato il timer di Podman:

```sh
sudo systemctl enable --now podman-auto-update.timer
```

Se una nuova immagine non supera il controllo di stato, Podman rimette quella vecchia. L'elenco della flotta del Gateway mostra versione e digest dell'immagine di ogni relay e registra ogni modifica. Per trattenere gli aggiornamenti finché un amministratore non li approva sul Gateway, installa `edge-relay-hold.conf` come indica il commento in cima a quel file e spegni il timer. Tutto ciò che fa, e ciò che non può fare, è nel [riferimento dell'Edge Relay](/it/edge-relay/reference/#updating-a-relay).

Per applicare una modifica al file locale: modificalo, poi `sudo systemctl restart edge-relay.service`. Il relay legge quel file all'avvio e non lo controlla.

Un file dei dispositivi inviato dal Gateway non ha bisogno di nulla di tutto questo: si applica dal vivo, senza riavvio. Non può essere scritto in `/etc/edge-relay/devices.json` (è montato `:ro` su una root di sola lettura), quindi va sul volume dei dati come `/data/pushed-devices.json`, e finché esiste è quello che il relay esegue e da cui parte. Le tue modifiche al file locale restano inutilizzate finché non cancelli l'invio: `DELETE /api/fleet/{id}/config` sul Gateway mentre il relay è in esecuzione, e torna subito al file locale. Il journal dice quale file sta usando, quindi controlla lì prima di dubitare del tuo JSON.

Verificato con il vero binario `quadlet` (`/usr/libexec/podman/quadlet -dryrun` di `podman-5.8.6`): entrambe le unità vengono analizzate senza errori e generano la chiamata `podman run` prevista, con la dipendenza del volume e il secret collegati automaticamente.
