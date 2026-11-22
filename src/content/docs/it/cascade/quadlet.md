---
title: "Cascade con Podman Quadlet"
description: "Esegui Cascade come servizi systemd con Podman Quadlet, su SQLite o con Postgres e un worker separato, con una finestra di aggiornamento che controlli tu."
---

Ci sono due modi per eseguirlo. Entrambi richiedono Podman 5.0 o successivo e un'installazione come root, così partono all'avvio anche senza nessuno collegato. Entrambi seguono `ghcr.io/hotloop-io/hotloop-cascade:stable`, lo eseguono in sola lettura, senza privilegi di root e con tutte le capability rimosse, e lasciano che systemd lo riavvii. Gli aggiornamenti e il modo in cui tornano indietro sono alla fine.

## Una macchina, SQLite

`hotloop-cascade.container` e `hotloop-cascade-data.volume`. Il database è un file nel volume, accanto alla chiave che protegge le credenziali salvate.

```sh
sudo cp hotloop-cascade.container hotloop-cascade-data.volume /etc/containers/systemd/
sudo install -D -m 600 /dev/null /etc/hotloop-cascade/cascade.env
sudo systemctl daemon-reload
sudo systemctl start hotloop-cascade
```

Apri `http://this-box:8080`. La prima persona che lo apre crea il primo account, quindi fallo prima di condividere l'indirizzo.

## PostgreSQL, un server e dei worker

`postgres/`. Il database, il server e, se vuoi, altri worker. Postgres è la coda, quindi i worker prendono il lavoro dallo stesso posto. Il database sta su una rete a parte e non pubblica nessuna porta.

Prima tre segreti, da creare una volta sola. I comandi sono all'inizio di `postgres/hotloop-cascade.container`. Quello della chiave conta di più: se lo perdi, tutte le credenziali salvate diventano illeggibili. Tieni una copia in un posto che non sia questa macchina.

```sh
cd postgres
sudo cp hotloop-cascade.network hotloop-cascade-db.container hotloop-cascade-db.volume \
  hotloop-cascade-data.volume hotloop-cascade.container /etc/containers/systemd/
sudo install -D -m 600 /dev/null /etc/hotloop-cascade/cascade.env
sudo systemctl daemon-reload
sudo systemctl start hotloop-cascade
```

Altri worker: `hotloop-cascade-worker.container`. I worker condividono il volume dei dati, quindi devono stare sulla stessa macchina. Oltre una macchina, usa il chart Helm.

## Impostazioni

`/etc/hotloop-cascade/cascade.env`, un `NAME=value` per riga, e deve esistere anche se è vuoto (la riga `install` lo crea). Quelle che ti serviranno:

| Impostazione | Che cosa fa |
|---|---|
| `HOTLOOP_CASCADE_PUBLIC_URL` | L'indirizzo con cui le persone raggiungono Cascade. Da qui si costruiscono i link dei webhook e dei callback OAuth. Finché non la imposti vale `http://localhost:8080`, che funziona solo dalla macchina stessa. |
| `HOTLOOP_CASCADE_METRICS_TOKEN` | Richiede `Authorization: Bearer` su `/metrics`. |
| `HOTLOOP_CASCADE_FILES_DIR` | Attiva i passaggi sui file, in questa directory. Montala anche nel container. |

Le unità impostano soltanto la directory dei dati, le porte e la chiave, e un valore messo in un'unità prevale su quello del file env, quindi lasciali stare. Dopo una modifica: `sudo systemctl restart hotloop-cascade`.

## Verifica

```sh
sudo podman healthcheck run hotloop-cascade
curl -s http://127.0.0.1:8081/readyz
sudo podman exec hotloop-cascade /usr/local/bin/hotloop-cascade workflows import - < workflow.yaml
```

Stato di salute e metriche sono sulla porta 8081, pubblicata solo sul loopback. Se qualcos'altro usa già la 8080 o la 8081, cambia la parte sinistra delle righe `PublishPort=`.

## Aggiornamento

Le unità dell'applicazione seguono `:stable` e hanno `AutoUpdate=registry`. Attiva il timer di Podman una volta per macchina:

```sh
sudo systemctl enable --now podman-auto-update.timer
```

Quando scatta, Podman scarica `:stable` e, se il digest è cambiato, riavvia l'unità sulla nuova immagine. L'unità non conta come avviata finché il container non supera il controllo di salute (`Notify=healthy`; il controllo è il binario stesso che interroga il proprio `/readyz`, come array JSON perché l'immagine non ha una shell). Se la nuova immagine non ci arriva mai, Podman rimette la precedente sotto `:stable` e la avvia. L'attesa arriva a 15 minuti, perché una nuova immagine migra il database mentre si avvia.

Per trattenere gli aggiornamenti finché non lo dici tu, lascia il timer spento ed esegui `sudo podman auto-update` quando sei pronto. Per farli avvenire solo in una finestra, installa `update-window.conf` (l'intestazione spiega come).

Due cose che un ritorno indietro non può annullare. Le migrazioni vanno solo avanti, quindi fai un backup prima di attivare gli aggiornamenti. Una versione che modifica una tabella in modo che la precedente non riesca a leggerla lo dice nelle sue note di rilascio. E il database: la sua immagine è fissata a un tag esatto e non ha l'etichetta di aggiornamento, di proposito. Un nuovo server che non parte si annulla rimettendo l'immagine vecchia, mentre una nuova immagine del database può partire, modificare la directory dei dati e rivelarsi un errore solo dopo. All'interno di PostgreSQL 18 è una modifica del tag, dopo le note di rilascio e un backup.

Nella variante PostgreSQL il server e ogni worker sono unità separate, quindi un aggiornamento che non parte annulla quella sola unità e non quella accanto.

## Che cosa è stato provato

Le unità sono state eseguite davvero su Podman 6.1.3, senza root sotto systemd, con un registro locale al posto di ghcr.io e le unità fornite senza modifiche tranne le porte dell'host. Sia la variante autonoma sia quella con PostgreSQL: un primo avvio che aspetta un container sano; un aggiornamento a un nuovo digest, tornato sano con i dati intatti e, nella variante PostgreSQL, con il container del database intatto; e un aggiornamento a un'immagine che esce all'avvio, che `podman auto-update` ha segnalato come `rolled back`, con il digest precedente di nuovo sano e il flusso di lavoro precedente ancora in esecuzione. Come installazione root su Podman 4.9.3 la versione precedente delle unità è partita e ripartita sotto systemd; e `Notify=healthy` non è rispettato da Quadlet 4.9, motivo per cui le unità hanno anche `--sdnotify=healthy`.

Poi di nuovo entrambe le varianti come installazione root, che è come le unità dicono di eseguirle, su Podman 5.8.7 sotto systemd in un container privilegiato usa e getta, con lo stesso registro locale al posto di ghcr.io come mirror e le unità senza modifiche. Autonoma: l'avvio ha aspettato un container sano, un container terminato a forza è tornato sano, un aggiornamento a un'immagine buona è salito sano sul nuovo digest, un aggiornamento a un'immagine che esce all'avvio è stato segnalato `rolled back` con quella buona di nuovo in esecuzione, e dopo ogni passo è girato un flusso di lavoro. PostgreSQL, con il server e un worker in più: `systemctl start` sul server ha atteso prima il database e poi il server sani, un server terminato a forza è tornato, un aggiornamento a un'immagine buona ha spostato il server e il worker lasciando in pace il container del database, un aggiornamento a un'immagine che esce all'avvio è tornato `rolled back` con entrambi di nuovo sull'immagine buona e il database intatto, e un flusso di lavoro è girato prima, nel mezzo e dopo. Una cosa da sapere leggendo quell'output: il server e il worker condividono un'immagine, e quando il primo è tornato indietro l'altro mostrava `true` al suo posto, con un riavvio, ed è finito comunque sull'immagine buona. Quale torna indietro per primo cambiava da un'esecuzione all'altra.

Eseguito su hardware reale (2026-11-17), su un vero Raspberry Pi e con un aggiornamento automatico Quadlet contro lo stesso ghcr.io.
