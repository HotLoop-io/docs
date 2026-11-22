---
title: "L'aggiornamento automatico :stable"
description: "Ogni macchina segue il tag stable. Cosa fa un aggiornamento, cosa un rollback non annulla e come sospenderlo finché non decidi tu."
---

Ogni macchina segue `:stable` e Podman la aggiorna. È la regola per tutti e quattro i prodotti, ed è il motivo per cui nessuna unità qui fissa un numero di versione: una macchina fissata a `4.17.0` ha esattamente l'età del giorno in cui qualcuno l'ha installata, e nessuno torna in stabilimento a cambiare un tag. Ogni tag di rilascio sposta `:stable`, e un rilascio le cui unità non lo seguono viene rifiutato.

Attiva il timer una sola volta per macchina:

```sh
sudo systemctl enable --now podman-auto-update.timer
```

## Cosa fa un aggiornamento

Podman scarica `:stable` quando scatta il timer e, se il digest è cambiato, riavvia l'unità dell'app sulla nuova immagine. Solo quella dell'app: il container del database non viene toccato, quindi un aggiornamento non interrompe lo storico. L'unità ha un controllo di stato che non richiede una shell (l'immagine non ne ha): `hotloop healthcheck` interroga il `/readyz` dell'app stessa, che risponde solo finché risponde il database. L'unità resta in "activating" finché non lo supera, così Podman distingue un aggiornamento tornato su da uno che non lo ha fatto, e se la nuova immagine non parte mai rimette la precedente sotto `:stable` e la avvia.

L'avvio della nuova immagine esegue prima le sue migrazioni, sul database già presente, e un database grande richiede tempo. L'unità concede all'app 15 minuti per rispondere prima di dichiarare fallito l'aggiornamento, e gli errori dei primi cinque minuti non contano, perché una migrazione non è un errore.

Due cose sono emerse eseguendolo, non leggendone, e le unità portano la correzione di ciascuna. Una semplice stringa `HealthCmd` viene eseguita con `/bin/sh -c`, e l'immagine non ha shell, quindi il controllo non poteva mai passare: è un array JSON. E i Quadlet più vecchi leggono `Notify=healthy` come un semplice `true` e passano `--sdnotify=conmon`, che dichiara l'app attiva appena parte il suo container: un aggiornamento che non riusciva ad avviarsi veniva segnalato come riuscito e nulla veniva annullato. Le unità indicano da sole `--sdnotify=healthy`.

## Perché non c'è un pod

App e database condividevano un pod. Questo costava il rollback, e lo si è scoperto eseguendolo, non leggendo il manuale. Per un container in un pod, l'aggiornamento automatico di Podman riavvia l'unità **del pod**, e l'unità del pod parte senza problemi qualunque cosa non vada nell'app al suo interno. Un rilascio che non riusciva ad avviarsi veniva segnalato come `UPDATED true`, l'app andava in crash loop (venti riavvii nei primi minuti) e `:stable` sulla macchina era l'immagine guasta. Inoltre riavviava il database a ogni aggiornamento dell'app. Con una rete al suo posto, l'app è un'unità a sé, Podman riavvia quella, e l'unità resta in "activating" finché l'app non risponde su `/readyz`: lo stesso rilascio è tornato come `UPDATED rolled back`.

## Cosa un rollback non può annullare

Una migrazione. Quando un rilascio migra il database e poi fallisce il controllo di stato, Podman rimette il rilascio precedente, che parte sullo schema lasciato da quello fallito. È sicuro, e resta sicuro in tre modi ([Le migrazioni aggiungono soltanto](/it/iot/migrations/) ha i dettagli):

- **Le migrazioni aggiungono soltanto.** Una tabella, una colonna con un valore predefinito, un indice. Mai una cancellazione, una ridenominazione o un cambio di tipo, così il rilascio precedente trova tutto ciò che conosceva dove si trovava e non guarda mai ciò che è stato aggiunto.
- **Un'app rifiuta uno schema di cui non può fidarsi.** Il database registra quale rilascio ha applicato ogni migrazione. Un rilascio tornato indietro di un passo parte, e lo dice nel suo log. Uno indietro di due o più rilasci non parte e spiega perché, nominando entrambe le versioni. È il caso in cui una macchina fallisce un aggiornamento, torna indietro, ne fallisce un altro, e il database è ormai avanzato due volte. L'app esce subito con il messaggio in `journalctl -u hotloop`, e il `Restart=always` dell'unità continua a riprovare e a essere rifiutato. Ciò che lo risolve è un rilascio che conosce lo schema: il più recente, cioè ciò che è `:stable` (`sudo podman auto-update`, oppure scaricarlo e riavviare). Oppure ripristinare un backup fatto dal rilascio in uso ([Backup e ripristino](/it/iot/backup/)).

Quindi un rollback non ha più un'avvertenza nelle note di rilascio. Ciò che ancora non può annullare sono i dati: il rilascio fallito può aver scritto righe che quello vecchio ignora. Fai un backup prima di attivare gli aggiornamenti; è l'unica cosa tra un rilascio sbagliato e un ripristino.

## Perché il database non segue `:stable`

L'app ha l'etichetta di aggiornamento automatico. Il container del database no, e il suo `Image=` è un tag esatto. Il motivo è che gli aggiornamenti dell'app si possono annullare e quelli del database no.

- Una **versione maggiore di PostgreSQL** (da 16 a 17) non è un riavvio. La politica di versioni di PostgreSQL dice che la directory dei dati non può restare retrocompatibile tra versioni maggiori, e servono un dump e ricarica, oppure `pg_upgrade` ([postgresql.org/support/versioning](https://www.postgresql.org/support/versioning/)). Un tag che oscillasse tra versioni maggiori lo farebbe allo storico di uno stabilimento durante un riavvio non correlato. Fissare la versione maggiore è il minimo, e non è un "pin dell'endpoint" nel senso della regola sopra. L'unico passaggio compiuto da HotLoop, da 16 a 17, è `hotloop-db-upgrade.container`, eseguito di proposito quando copi le nuove unità.
- Una **versione minore** (da 16.14 a 16.15) non richiede dump e ripristino. La stessa pagina aggiunge che alcune "potrebbero richiedere passaggi aggiuntivi, quindi leggi sempre prima le note di rilascio". Una macchina non presidiata non legge le note di rilascio.
- **TimescaleDB** (il Gateway e l'Edge) è l'altra metà. L'app esegue da sola `ALTER EXTENSION timescaledb UPDATE` all'avvio dopo un'immagine più recente, e un aggiornamento di estensione è una modifica a senso unico del database: rimettere dopo l'immagine precedente non la annulla. Un tag Timescale mobile farebbe quindi trascinare all'aggiornamento reversibile dell'app uno irreversibile.
- Una nuova immagine del database che parte e funziona non è per forza integra. Il controllo di stato distingue un container che non parte da uno che parte, e nient'altro. Se uno storico è sopravvissuto all'aggiornamento del motore non è qualcosa a cui risponde `pg_isready`.

Quindi il tag del database si muove con un rilascio di HotLoop testato con esso. `release_guard.sh` mantiene ogni `hotloop-db.container` uguale al database del suo chart, così una macchina Quadlet e un'installazione con chart dello stesso prodotto eseguono lo stesso, e rifiuta un `AutoUpdate=` su di esso. Il costo è che le patch di PostgreSQL arrivano su una macchina quando un rilascio le include, o quando cambi il tag a mano. Nella stessa versione maggiore si tratta di modificare `hotloop-db.container`, un `daemon-reload` e un riavvio del pod, dopo aver letto le note di rilascio e fatto un backup. Una versione maggiore è `pg_upgrade`, che HotLoop esegue per 16 a 17 e che esegui tu, o su cui ripristini, per qualsiasi altra.

## Sospendere gli aggiornamenti finché non lo decidi tu

Per impostazione predefinita non c'è sospensione: gli aggiornamenti avvengono quando scatta il timer. Un sito che vuole far decidere a una persona ha due modi, e nessuno dei due richiede che l'app sia raggiungibile.

- **Sospensione.** Lascia `podman-auto-update.timer` spento. Nulla si aggiorna. Quando sei pronto, esegui `sudo podman auto-update`: quella è l'approvazione, con lo stesso controllo di stato e lo stesso rollback. Podman aggiorna tutti i container etichettati della macchina quando viene eseguito, non solo questi, e non si può dirgli di saltarne uno, quindi una macchina che deve eseguire il timer per altri container non può anche sospendere questi.
- **Una finestra.** `update-window.conf` è un file integrativo del timer che dice quando può scattare, ad esempio la domenica alle 03:00, invece dell'impostazione predefinita di ogni giorno a mezzanotte:

  ```sh
  sudo mkdir -p /etc/systemd/system/podman-auto-update.timer.d
  sudo cp update-window.conf /etc/systemd/system/podman-auto-update.timer.d/
  sudo systemctl daemon-reload && sudo systemctl restart podman-auto-update.timer
  ```

L'Edge Relay è diverso per un aspetto: un Gateway può approvare il proprio aggiornamento dalla schermata della flotta, perché un relay è già in ascolto dei comandi del Gateway a cui inoltra. IoT, Edge e Gateway non hanno un canale simile per raggiungerli, e costruirne uno metterebbe un pulsante "riavvia questa macchina" su un'interfaccia web per una funzione che `sudo podman auto-update` già è. Vedi il [riferimento dell'Edge Relay](/it/edge-relay/reference/#updating-a-relay) per la sospensione del relay, e `edge-relay-hold.conf`.

## Cosa vede il Gateway

`GET /api/status` su uno qualsiasi dei tre indica la sua `version` e il suo `imageDigest` quando l'unità lo ha comunicato (lo fa, prima di ogni avvio). Un Edge o un Gateway con la pubblicazione Edge attiva è un nodo Sparkplug come un relay, e inserisce gli stessi due dati in ogni birth, quindi un Gateway che lo ha nel suo elenco di flotta mostra versione e digest e registra la variazione quando un aggiornamento automatico lo sposta ([Gestione della flotta](/it/gateway/fleet/)). IoT non ha upstream, quindi il suo digest è sul suo `/api/status` e da nessun'altra parte.

## Con Helm

Un pod non può sostituire sé stesso, quindi non c'è aggiornamento non presidiato per i chart: `helm upgrade` è l'aggiornamento, e l'`image.tag` del chart ha per impostazione predefinita il suo `appVersion`, cioè il rilascio.
