---
title: "Prodotti HotLoop: otto su cinque linee"
description: "Otto prodotti su cinque linee di rilascio: cosa include ogni prodotto del core, il suo database, come installarli e come far crescere un sito."
---

HotLoop sono otto prodotti per il reparto produttivo: quattro che crescono insieme a un sito (IoT, Edge, Gateway ed Edge Relay), più Flow per il cablaggio logico, Cascade per i flussi di lavoro, HotLoop for CODESYS per lo schermo del PLC stesso e Transmitter per mettere in rete i valori di un PLC.

Escono su cinque linee di rilascio. **HotLoop core** è composto da IoT, Edge, Gateway e Edge Relay: quattro prodotti, un solo codice, un solo tag. Ogni rilascio del core pubblica tutti e quattro insieme, con la stessa versione, ciascuno con la propria immagine, il proprio chart Helm e le proprie unità Podman Quadlet. Scegliete quello adatto alla macchina. Ogni prodotto parla tutti i protocolli che HotLoop conosce, quindi non serve mai salire di prodotto solo per leggere il PLC che avete sul banco. Le funzioni li distinguono. I protocolli no.

**Flow**, **Cascade**, **HotLoop for CODESYS** e **Transmitter** sono linee a sé, con versioni proprie, quindi un rilascio di Flow non sposta mai il core, e viceversa. Tutto ciò che sta sotto la tabella riguarda il core. Ecco da dove parte ciascuno degli otto:

| Prodotto | Linea di rilascio | Documentazione | Installazione | Note di rilascio | Roadmap |
|---|---|---|---|---|---|
| **HotLoop IoT** | HotLoop core | <a href="/it/iot/overview/">Documentazione</a> | <a href="/it/iot/install/">Installazione</a> | <a href="/it/releases/#hotloop-core">Note</a> | <a href="/it/roadmap/">Roadmap</a> |
| **HotLoop Edge** | HotLoop core | <a href="/it/edge/overview/">Documentazione</a> | <a href="/it/edge/install/">Installazione</a> | <a href="/it/releases/#hotloop-core">Note</a> | <a href="/it/roadmap/">Roadmap</a> |
| **HotLoop Gateway** | HotLoop core | <a href="/it/gateway/overview/">Documentazione</a> | <a href="/it/gateway/install/">Installazione</a> | <a href="/it/releases/#hotloop-core">Note</a> | <a href="/it/roadmap/">Roadmap</a> |
| **HotLoop Edge Relay** | HotLoop core | <a href="/it/edge-relay/overview/">Documentazione</a> | <a href="/it/edge-relay/install/">Installazione</a> | <a href="/it/releases/#hotloop-core">Note</a> | <a href="/it/roadmap/">Roadmap</a> |
| **HotLoop Flow** | Flow | <a href="/it/flow/overview/">Documentazione</a> | <a href="/it/flow/install/">Installazione</a> | <a href="/it/releases/#hotloop-flow">Note</a> | <a href="/it/flow/roadmap/">Roadmap</a> |
| **HotLoop Cascade** | Cascade | <a href="/it/cascade/overview/">Documentazione</a> | <a href="/it/cascade/running/">Installazione</a> | <a href="/it/releases/#hotloop-cascade">Note</a> | <a href="/it/cascade/roadmap/">Roadmap</a> |
| **HotLoop for CODESYS** | HotLoop for CODESYS | <a href="/it/codesys/overview/">Documentazione</a> | <a href="/it/codesys/install/">Installazione</a> | <a href="/it/releases/codesys-0-3-8/">Note</a> | <a href="/it/codesys/roadmap/">Roadmap</a> |
| **HotLoop Transmitter** | Transmitter | <a href="/it/transmitter/overview/">Documentazione</a> | <a href="/it/transmitter/install/">Installazione</a> | <a href="/it/releases/transmitter-1-1-0/">Note</a> | <a href="/it/transmitter/roadmap/">Roadmap</a> |

La tabella seguente confronta i quattro prodotti del core.

| <span class="sr-only">Dettagli</span> | HotLoop IoT | HotLoop Edge | HotLoop Gateway | HotLoop Edge Relay |
|---|---|---|---|---|
| A cosa serve | La base dell'automazione. Un Pi, un NUC, una scatola in un armadio | Una scatola accanto alla macchina, che continua a funzionare anche se il collegamento a monte cade | Il cervello del sito | Interrogare, inoltrare, sopravvivere. Nessun database, nessuna interfaccia |
| Entità, automazioni, helper, script, ricette, blueprint, dashboard, logbook, notifiche, MCP, MQTT con discovery, allarmi ISA-18.2, backup e ogni driver | sì | sì | sì | solo driver |
| Server OPC UA, pubblicazione Sparkplug all'edge con store and forward | | sì | sì | solo pubblicazione |
| Flotta, multi-sito, report pianificati | | | sì | |
| Immagine | `ghcr.io/hotloop-io/hotloop-iot` | `ghcr.io/hotloop-io/hotloop-edge` | `ghcr.io/hotloop-io/hotloop` | `ghcr.io/hotloop-io/hotloop-edge-relay` |
| Chart | `hotloop-iot` | `hotloop-edge` | `hotloop` | `hotloop-edge-relay` |
| Unità Quadlet | `deploy/quadlet/iot/` | `deploy/quadlet/edge/` | `deploy/quadlet/gateway/` | `deploy/quadlet/edge-relay.container` |
| Unità Quadlet su SQLite | `deploy/quadlet/iot/sqlite/` | `deploy/quadlet/edge/sqlite/` | `deploy/quadlet/gateway/sqlite/` | nessuna |
| `database.type` nel chart | `postgresql` (predefinito), `sqlite` | `timescaledb` (predefinito), `postgresql`, `sqlite` | `timescaledb` (predefinito), `postgresql`, `sqlite` | nessuno |
| Architetture | amd64, arm64, arm/v7 | amd64, arm64, arm/v7 | amd64, arm64 | amd64, arm64, arm/v7 |
| Database eseguito da chart e Quadlet | PostgreSQL 17 | TimescaleDB | TimescaleDB | nessuno |
| Storico conservato per impostazione predefinita | 30 giorni | 90 giorni | 90 giorni | nessuno |
| Database su cui gira il binario | SQLite o Postgres | SQLite, Postgres o TimescaleDB | SQLite, Postgres o TimescaleDB | nessuno |

Il database è un'impostazione, non un'immagine: `HOTLOOP_DB_TYPE=sqlite` e `HOTLOOP_DB_PATH` portano uno qualsiasi dei tre su un file SQLite, senza alcun container di database (DEPLOYMENT.md, "SQLite"). I chart accettano la stessa scelta come `database.type` e le unità Quadlet come le directory `sqlite/`, e ogni prodotto offre solo i database della tabella qui sopra: chiedere `timescaledb` al chart di IoT fa fallire l'installazione. Passare da un database a un altro significa fare un backup e un ripristino (BACKUP.md).

Il Gateway ha mantenuto i nomi con cui è uscito fino alla 4.17.0: immagine `ghcr.io/hotloop-io/hotloop`, chart `hotloop`. Chi lo usa non deve cambiare nulla.

## Ciò che c'è in un prodotto è ciò che c'è nel binario

Un prodotto è una build, non un'impostazione. `-tags hotloop_iot` compila IoT, `-tags hotloop_edge` compila Edge, nessun tag compila il Gateway. Ciò che un prodotto non ha non è disattivato, semplicemente non c'è: il server OPC UA non è affatto nell'immagine di IoT, quindi nessuna variabile d'ambiente, nessun file di valori e nessuna giornata storta possono accenderlo.

Per questo un prodotto più piccolo risponde di ciò che non ha, invece di far finta:

- **L'API** mantiene ogni route in ogni prodotto. Una route per una funzione che questo prodotto non ha risponde `404` e indica il prodotto che la ha: `{"error":"scheduled reports are part of HotLoop Gateway; this is HotLoop IoT","product":"iot","feature":"reports"}`. `GET /api/status` indica `product` e `features`, così uno script chiede invece di tirare a indovinare.
- **Un'impostazione solo Gateway** su IoT o Edge (`HOTLOOP_REPORTS_ENABLED=true` rimasta in un vecchio file di valori, per esempio) avvisa all'avvio e nella schermata delle impostazioni, e HotLoop funziona. HotLoop tiene in marcia l'impianto nonostante un report che non può produrre, e l'avviso fa sì che qualcuno lo veda.
- **I chart** non hanno proprio l'impostazione. `charts/hotloop-iot` non ha i blocchi `reports`, `opcuaServer` o `edgePublish`, e `hotloop-edge` non ha `reports`. Se la impostate comunque, non genera nulla.
- **`hotloop --product`** stampa `iot`, `edge` o `gateway`. `--version` stampa ancora solo la versione, perché gli script la leggono.

## Quale scegliere

- **Un Pi, prese smart, qualche sensore, un broker MQTT pieno di Tasmota e Zigbee2MQTT, o un PLC su un banco:** IoT. È l'immagine più piccola (circa 29 MB su arm) e l'immagine di PostgreSQL semplice è un sesto di quella di TimescaleDB, che su una scheda SD è il numero che conta.
- **Una scatola fissata accanto a una linea, che alimenta un SCADA via OPC UA o pubblica a monte via Sparkplug e regge la caduta del collegamento a monte:** Edge.
- **Il sito: ogni linea, report inviati per e-mail in modo pianificato, edge relay che riferiscono, più di un sito su un solo schermo:** Gateway.
- **Una scatola che deve solo interrogare e inoltrare, senza un database da curare:** Edge Relay. Vedi il [riferimento di Edge Relay](/it/edge-relay/reference/).

## Dimensioni

L'immagine è il binario più circa 3 MB di base.

| <span class="sr-only">Dettagli</span> | immagine / binario amd64 | immagine / binario arm64 | immagine / binario arm/v7 |
|---|---|---|---|
| IoT | 31.2 / 28.0 MB | 29.1 / 26.0 MB | 29.2 / 26.0 MB |
| Edge | 36.5 / 33.3 MB | 34.2 / 31.0 MB | 34.3 / 31.1 MB |
| Gateway | 37.1 / 33.9 MB | 34.8 / 31.6 MB | non compilato |
| Edge Relay | 15.7 / 12.5 MB | 14.9 / 11.7 MB | 15.1 / 11.9 MB |

Sono le dimensioni su disco. Senza dispositivi, HotLoop sta intorno ai 10 MB di RSS e PostgreSQL intorno ai 12 MB, ed è il minimo, non il valore reale: ciò che un prodotto usa con dispositivi in polling dipende dai dispositivi.

## Installazione

### Helm

Un solo repository, tutti e quattro i chart:

```sh
helm repo add hotloop https://hotloop.io/hotloop/

helm install hotloop hotloop/hotloop-iot  --namespace hotloop --create-namespace
helm install hotloop hotloop/hotloop-edge --namespace hotloop --create-namespace
helm install hotloop hotloop/hotloop      --namespace hotloop --create-namespace
```

Chiamate la release `hotloop`, qualunque sia il prodotto. Il nome della release è quello che portano il volume del database, i Secret e il Service, e mantenerlo è ciò che permette a un sito di salire di prodotto più avanti (sotto).

Su EmberNet ciascuno è una scheda a sé nell'App Store: "HotLoop IoT", "HotLoop Edge", "HotLoop Gateway" e "HotLoop Edge Relay". Un deploy dallo store inserisce le etichette del tenant della dashboard in tutto ciò che il chart genera, e Running Apps le mostra come `HotLoop-IoT`, `HotLoop-Edge`, `HotLoop-Gateway` e `HotLoop-Edge-Relay`.

### Podman Quadlet

Per una macchina che non è in un cluster. Ogni directory di prodotto sotto `deploy/quadlet/` ha cinque unità: `hotloop.network`, `hotloop.container` (l'app), `hotloop-db.container` (il suo database, la stessa immagine e versione che esegue il suo chart), `hotloop-db.volume` e `hotloop-data.volume`. I passaggi di installazione sono nell'intestazione di ogni `hotloop.container`, e [Podman Quadlet](/it/install/quadlet/) ha il resto.

Serve Podman 5.0 o successivo. Raspberry Pi OS Bookworm include la 4.3, che non ha alcun Quadlet, quindi un Pi richiede Raspberry Pi OS Trixie o successivo. L'app segue `:stable` e l'aggiornamento automatico di Podman la sposta, con il database fissato: [il README di Quadlet](/it/install/auto-update/) spiega come e perché. In ogni caso, mettete il database su un SSD USB e non sulla scheda SD. Lo storico scrive tutto il giorno, ogni giorno, e le schede SD muoiono proprio di questo.

## Far crescere un sito al prodotto successivo

Da IoT a Edge al Gateway si conservano tutti i dispositivi, tag, entità, automazioni, allarmi, utenti e ore di storico. Ogni prodotto esegue ogni migrazione, quindi il database ha la stessa forma in tutti e tre, e il prodotto più grande parte con le sue funzioni aggiuntive vuote.

- **Quadlet:** i nomi delle unità, i volumi e i secret sono gli stessi in ogni directory di prodotto. Copiate `hotloop.container` e `hotloop-db.container` del prodotto più grande sopra i vostri, eseguite `systemctl daemon-reload` e riavviate.
- **Helm:** `helm upgrade hotloop hotloop/hotloop-edge` (oppure `hotloop/hotloop`) sulla stessa release. I tre chart selezionano i loro pod con le stesse etichette e danno lo stesso nome allo StatefulSet e al volume del database, quindi l'aggiornamento è consentito e il volume resta collegato.

Fate prima un backup (`POST /api/backup`, vedi [Backup e ripristino](/it/iot/backup/)) e copiatelo fuori dalla macchina. Il passaggio è stato eseguito su Quadlet, da IoT a Edge al Gateway su un solo volume di database con lo stesso dispositivo presente a ogni passo, con la directory PostgreSQL di IoT che parte sotto l'immagine TimescaleDB del Gateway, e come `helm upgrade` su un cluster reale. Dove la directory semplice di IoT non contiene l'estensione TimescaleDB, lo storico resta in partizioni native dopo quel passaggio, e una hypertable richiede un backup e un ripristino in una TimescaleDB nuova. Tornare a un prodotto più piccolo non è un passaggio da fare su una macchina a cui tenete.

## Come vengono rilasciati

Un solo tag `v` rilascia tutti e quattro, quindi IoT, Edge, il Gateway e l'Edge Relay condividono sempre la stessa versione. Prima di compilare qualsiasi cosa, si verifica che versione e immagine di ogni chart corrispondano al tag, che ogni unità Quadlet dell'app segua `:stable` con un controllo di stato, e che ogni unità di database corrisponda al suo chart e non venga mai aggiornata in automatico. I chart di IoT e Edge sono generati dal chart del Gateway, quindi una correzione a uno raggiunge tutti e tre.
