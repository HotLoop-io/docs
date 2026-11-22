---
title: "Installare l'Edge Relay con Helm o Quadlet"
description: "Esegua HotLoop Edge Relay {{hotloop}} su un cluster con Helm, o su un Pi o un PC industriale come servizio systemd con Podman Quadlet. Le unità, per intero."
sidebar:
  label: "Installazione"
---

Due modi supportati, entrambi con container, entrambi con avvio al boot e riavvio se si fermano: il chart Helm su un cluster e un'unità Podman Quadlet su una macchina che non ne fa parte. Un semplice `podman run` lanciato da una sessione SSH non è nessuno dei due. È così che una macchina di edge smette in silenzio di inoltrare la prima volta che qualcuno si disconnette e il container se ne va con lui, e nessuno se ne accorge finché lo storico (historian) non ha un buco. Non esiste nemmeno una via Docker.

Qualunque strada scelga, il relay ha bisogno di due cose: un broker su cui pubblicare e un id di gruppo Sparkplug. L'immagine si scarica senza login.

:::note[Se arriva dalla 4.17.0 o dalla 4.16.0]
Dalla 4.17.0, aggiorni il chart con `--reset-then-reuse-values`, e chi usa Quadlet prende il nuovo `edge-relay.container`, che segue `:stable` invece di fissare la 4.17.0. [Aggiornare dalla 4.17.0](/it/gateway/upgrading/#the-edge-relay-and-quadlet) contiene la parte del relay. Il relay della 4.16.0 non poteva accettare un file di dispositivi inviato in nessuna delle due installazioni qui sotto: l'invio falliva su un mount in sola lettura mentre il Gateway diceva `config pushed`, e `persistence.enabled=false` non partiva nemmeno. La 4.17.0 ha corretto entrambe, e [Aggiornare dalla 4.16.0](/it/gateway/upgrading/#the-edge-relay) contiene quella parte, compreso l'invio obsoleto che il broker può restituire al primo avvio.
:::

## Il file dei dispositivi

Entrambi i modi leggono lo stesso documento: i dispositivi da interrogare e i tag da leggere su di essi.

```json
{
  "devices": [
    {
      "id": "press-01",
      "name": "Press 1",
      "protocol": "opcua",
      "address": "opc.tcp://press-01.local:4840",
      "enabled": true,
      "pollIntervalMs": 1000
    }
  ],
  "tags": [
    {
      "deviceId": "press-01",
      "name": "Zone1_Temp",
      "address": "ns=2;s=Zone1.Temp",
      "dataType": "float",
      "enabled": true
    }
  ]
}
```

Sono le stesse forme di dispositivo e tag che accetta l'API del Gateway, controllate con le stesse regole: un dispositivo ha bisogno di un protocollo che HotLoop conosca, e un tag ha bisogno di un dispositivo che esista. In più il relay rifiuta un id di dispositivo dichiarato due volte e un tag che punta a un dispositivo mai dichiarato, i due errori che commette un file modificato a mano e che un database avrebbe intercettato per lei.

Il file locale viene letto all'avvio, e di nuovo quando un invio viene cancellato. Lo modifichi, riavvii il relay. Non viene monitorato, di proposito. Un file di dispositivi inviato da un Gateway è quello che si applica in tempo reale, e prevale su questo finché esiste.

Il file può anche contenere un elenco `discovery` di broker MQTT che il relay ascolta per scoprire dispositivi che si annunciano, in sola lettura. [Il riferimento](/it/edge-relay/reference/) ha il formato.

Il blocco `config` di un dispositivo può contenere credenziali, come `username` e `password` di OPC UA. Stanno in quel file in chiaro, e il relay non ha un'API dietro cui nasconderle, quindi conta dove sta il file. Entrambi i percorsi qui sotto se ne occupano.

## Helm

```bash
helm repo add hotloop https://hotloop.io/hotloop
helm repo update
helm install press-line-3 hotloop/hotloop-edge-relay \
  --version {{hotloop}} --namespace hotloop --create-namespace \
  --set edgePublish.broker=tcp://gateway.plant.local:1883 \
  --set edgePublish.group=Plant1 \
  --set edgePublish.node=press-line-3 \
  -f devices.yaml
```

`edgePublish.broker` e `edgePublish.group` sono obbligatori, e il chart si rifiuta di renderizzare senza di essi. Imposti anche `edgePublish.node`. Se lasciato vuoto, è l'hostname del pod, e il pod di un Deployment riceve un nome nuovo a ogni sostituzione. Dopo il prossimo drain del nodo, la flotta del Gateway e ogni host Sparkplug a monte vedono un nodo di edge nuovo di zecca, e quello che aveva registrato risulta offline.

Password del broker: la metta in `edgePublish.password`, oppure indichi un Secret con una chiave `password` in `edgePublish.existingSecret`. Attivi `edgePublish.tls` se il broker parla TLS.

`devices.yaml` contiene le stesse due liste del file dei dispositivi, sotto `devices:` e `tags:`:

```yaml
devices:
  - id: press-01
    name: Press 1
    protocol: opcua
    address: "opc.tcp://press-01.local:4840"
    enabled: true
    pollIntervalMs: 1000
tags:
  - deviceId: press-01
    name: Zone1_Temp
    address: "ns=2;s=Zone1.Temp"
    dataType: float
    enabled: true
```

Finiscono in un ConfigMap e nel record della release Helm, e chiunque possa leggere i ConfigMap nel namespace può leggerle. Se un dispositivo ha una password, metta l'intero file dei dispositivi in un Secret sotto la chiave `devices.json` e lo indichi al suo posto. Il Secret viene montato al posto del ConfigMap, e `devices` e `tags` vengono ignorati:

```bash
kubectl -n hotloop create secret generic press-devices --from-file=devices.json
helm upgrade press-line-3 hotloop/hotloop-edge-relay --version {{hotloop}} \
  --reset-then-reuse-values --set devicesSecret=press-devices
```

`--reset-then-reuse-values`, non `--reuse-values`. Quello semplice riapplica i valori che la release ha già e salta qualsiasi valore predefinito aggiunto da un chart più recente. Lo esegua su un relay installato con la 4.16.0 e perde `pushedDevicesFile`, quindi un invio torna a fallire sul mount in sola lettura, e nulla fallisce per avvisarla.

Le note di installazione segnaleranno allora che non ci sono dispositivi configurati. Stanno contando l'elenco `devices` del chart, che lei ha lasciato vuoto di proposito. Controlli invece `/status`:

```bash
kubectl -n hotloop logs deploy/press-line-3
kubectl -n hotloop port-forward svc/press-line-3 8081:8081
curl localhost:8081/status
```

### La coda di inoltro e il suo volume

La coda di inoltro vive su un PVC suo, di 256Mi per impostazione predefinita (`persistence.size`), così le letture in buffer sopravvivono allo spostamento del pod. Lo stesso volume contiene il certificato client OPC UA e il suo trust store in `/data/opcua-client-pki`, in modo che un server protetto si fidi del relay una volta, non dopo ogni riavvio.

`edgePublish.queueMaxBytes` è 64 MiB per impostazione predefinita (`67108864`), mentre prima era `0`, senza limite. Oltre il tetto le letture più vecchie vengono scartate e contate. Sono circa 248.000 letture, circa due minuti a 2.000 letture al secondo, quindi lo dimensioni in base al suo ritmo, circa 240 byte a lettura con nomi di tag brevi (misurato sulla stessa coda in Edge 4.21.1), e lo tenga ben sotto `persistence.size`. Lo imposti a `0` ed è di nuovo senza limite: un'interruzione del broker abbastanza lunga riempie allora il volume invece di scartare le letture vecchie, un volume pieno è un secondo guasto sommato al primo, e le note di installazione lo dicono. Un relay aggiornato con `--reuse-values` mantiene ciò che aveva.

`persistence.enabled=false` parte dalla 4.17.0 (nella 4.16.0 uccideva il relay all'avvio), con un emptyDir su `/data` limitato a `persistence.size`. Sappia cosa costa prima di sceglierlo: ogni volta che il pod viene sostituito (un drain del nodo, uno sfratto, un `kubectl delete pod`, un `helm upgrade` che lo riavvia) perde la coda di inoltro e tutte le letture in buffer, qualsiasi file di dispositivi inviato (il relay torna in silenzio ai `devices` del chart) e il certificato client OPC UA, quindi ogni server protetto deve fidarsi di nuovo del relay. Le note di installazione stampano quell'avviso. Va bene per una prova. Per un relay le cui letture contano, tenga il PVC.

Un file di dispositivi inviato vive sullo stesso volume, in `/data/pushed-devices.json` (`pushedDevicesFile` nei valori del chart), e prevale sui `devices` del chart finché esiste, attraverso riavvii, ripianificazioni e un `helm upgrade` che cambia `devices`. Il relay registra da quale file è partito. Per tornare all'elenco del chart, cancelli l'invio con `DELETE /api/fleet/{id}/config` sul Gateway mentre il relay è connesso, e passa subito all'elenco del chart. Un invio si applica anche in tempo reale, senza riavvio.

## Quadlet

Per un Pi o un PC industriale fuori da qualsiasi cluster. Quadlet trasforma il container in un vero servizio systemd: parte al boot senza nessuno connesso, si riavvia se si ferma e scrive nel journal. Questa unità è stata eseguita su Podman 4.9.3, e le sue chiavi sono state controllate con il binario `quadlet` di Podman 5.8.6. Raspberry Pi OS Bookworm include la 4.3, che non ha Quadlet affatto, quindi usi Trixie o successivo.

L'unità e il suo volume dati sono in `deploy/quadlet/` nel repository di HotLoop, accanto a `devices.example.json`. Crei prima le directory:

```bash
sudo mkdir -p /etc/containers/systemd /etc/edge-relay
```

Salvi questo come `/etc/containers/systemd/edge-relay.container`, e cambi broker, gruppo e nodo per questa macchina:

```ini
[Unit]
Description=HotLoop Edge Relay
Documentation=https://docs.hotloop.io/edge-relay/reference/
After=network-online.target
Wants=network-online.target

[Container]
# Every box tracks :stable, so this line never needs editing.
Image=ghcr.io/hotloop-io/hotloop-edge-relay:stable
AutoUpdate=registry
ContainerName=edge-relay

# The image has no shell or curl, so the binary asks itself. A JSON array,
# not a string, because a string runs through /bin/sh -c and there isn't one.
HealthCmd=["/edge-relay", "--healthcheck"]
HealthInterval=10s
HealthRetries=3
HealthStartPeriod=20s
Notify=healthy
# Podman 4.9 reads Notify=healthy as plain true. Without this line a broken
# release is not rolled back there.
PodmanArgs=--sdnotify=healthy

# The image digest, written by the ExecStartPre below, for the Gateway's fleet list.
EnvironmentFile=/run/edge-relay/relay.env

Environment=HOTLOOP_EDGE_PUBLISH_BROKER=tcp://gateway.example.local:1883
Environment=HOTLOOP_EDGE_PUBLISH_GROUP=Plant1
Environment=HOTLOOP_EDGE_PUBLISH_NODE=press-line-3
# The outage queue's limit, 64 MiB.
Environment=HOTLOOP_EDGE_PUBLISH_QUEUE_MAX_BYTES=67108864
Environment=HOTLOOP_EDGE_RELAY_DEVICES_FILE=/etc/edge-relay/devices.json
# Where a pushed device file lands, instead of failing on the read-only
# mount below. It wins over the file above for as long as it exists.
Environment=HOTLOOP_EDGE_RELAY_PUSHED_FILE=/data/pushed-devices.json
Environment=HOTLOOP_LOG_LEVEL=info

# Delete this line if the broker takes anonymous connections.
Secret=edge-relay-broker-password,type=env,target=HOTLOOP_EDGE_PUBLISH_PASSWORD

Volume=/etc/edge-relay/devices.json:/etc/edge-relay/devices.json:ro,Z
Volume=edge-relay-data.volume:/data

# Only reachable from this host. /status has no auth, on purpose.
PublishPort=127.0.0.1:8081:8081

User=65532:65532
ReadOnly=true
Tmpfs=/tmp
NoNewPrivileges=true
DropCapability=all

[Service]
Restart=always
RestartSec=5
# Exit status 75 is a relay stopping because an operator approved an update.
SuccessExitStatus=75

RuntimeDirectory=edge-relay
ExecStartPre=/bin/sh -c '/usr/bin/podman image exists ghcr.io/hotloop-io/hotloop-edge-relay:stable || /usr/bin/podman pull ghcr.io/hotloop-io/hotloop-edge-relay:stable'
ExecStartPre=/bin/sh -c 'echo HOTLOOP_IMAGE_DIGEST=$$(/usr/bin/podman image inspect --format "{{.Digest}}" ghcr.io/hotloop-io/hotloop-edge-relay:stable) > /run/edge-relay/relay.env'

# A bad image fails three healthchecks in about a minute, and then it is rolled back.
TimeoutStartSec=120

[Install]
WantedBy=multi-user.target
```

E questo come `/etc/containers/systemd/edge-relay-data.volume`. Contiene la coda di inoltro e qualsiasi file di dispositivi inviato. È un volume con nome così sopravvive a un `podman system prune`, e così il suo proprietario corrisponde all'utente non root del container senza un chown:

```ini
[Volume]
```

Metta il file dei dispositivi in `/etc/edge-relay/devices.json`, poi:

```bash
printf '%s' 'your-broker-password' | \
  sudo podman secret create edge-relay-broker-password -
sudo systemctl daemon-reload
sudo systemctl start edge-relay.service
sudo systemctl status edge-relay.service
curl localhost:8081/status
```

Il broker accetta connessioni anonime? Salti il segreto ed elimini la riga `Secret=`. Su una rete OT isolata è una configurazione reale, non un errore da aggirare. Il `:Z` sul mount del file dei dispositivi serve a SELinux, ed è innocuo su una distribuzione che non lo ha.

Per cambiare i dispositivi dalla macchina: modifichi il file, poi `sudo systemctl restart edge-relay.service`. Un file di dispositivi inviato dal Gateway non ha bisogno di nulla di tutto ciò, perché si applica in tempo reale. Finché un invio è in vigore, è ciò che il relay esegue e da cui parte, quindi le sue modifiche al file locale non fanno nulla finché non cancella l'invio con `DELETE /api/fleet/{id}/config` sul Gateway. Quando qualcosa sembra sbagliato, `sudo journalctl -u edge-relay.service` prima di tutto. Il relay dice su quale file si trova, e perché ha rifiutato un file di dispositivi o un invio, e leggerlo richiede meno tempo che dubitare del suo JSON.

### Aggiornamenti

L'unità segue `:stable`, e Podman la aggiorna quando il suo timer è attivo:

```bash
sudo systemctl enable --now podman-auto-update.timer
```

Quando il timer scatta, Podman scarica `:stable`, e se il digest è cambiato riavvia l'unità sulla nuova immagine. L'unità non è considerata attiva finché non passa l'healthcheck del relay stesso, quindi se la nuova immagine non lo passa mai, Podman rimette la precedente e la avvia. Una release che non parte costa pochi minuti su una macchina, e non un relay che resta fermo. La coda di inoltro e un file di dispositivi inviato vivono sul volume dati, che una nuova immagine non tocca. L'elenco della flotta del Gateway mostra la versione e il digest dell'immagine di ogni relay e registra una riga quando uno cambia.

Podman aggiorna ogni container etichettato sulla macchina quando gira, non solo questo. Un sito che vuole che sia una persona a decidere quando ha due opzioni, entrambe in `deploy/quadlet/`. `edge-relay-hold.conf` trattiene gli aggiornamenti finché un amministratore sul Gateway non li approva con `POST /api/fleet/{id}/update`, e richiede il timer spento per l'intera macchina. `update-window.conf` lascia scattare il timer solo in una finestra, come la domenica alle 03:00. Il Gateway non può dirle che un aggiornamento è in attesa, solo cosa esegue ora ogni relay. La trattenuta è stata provata con un aggiornamento reale trattenuto per 30 secondi e poi applicato su approvazione, e la pagina di riferimento, [Aggiornare un relay](/it/edge-relay/reference/#updating-a-relay), ha tutto ciò che fa e non può fare.

## Poi: gestirlo da un Gateway

La gestione della flotta è disattivata nel Gateway finché non la attiva, perché un Gateway senza relay non ha un broker a cui puntare. Imposti `HOTLOOP_FLEET_ENABLED` a `true` e punti `HOTLOOP_FLEET_BROKER` allo stesso broker su cui pubblicano i relay, con `HOTLOOP_FLEET_USER`, `HOTLOOP_FLEET_PASSWORD` e `HOTLOOP_FLEET_TLS` se servono. Il chart del Gateway non ha valori di flotta propri, quindi vanno nel suo `extraEnv`:

```yaml
extraEnv:
  - name: HOTLOOP_FLEET_ENABLED
    value: "true"
  - name: HOTLOOP_FLEET_BROKER
    value: tcp://gateway.plant.local:1883
```

Poi registri ogni relay per gruppo e nodo. La registrazione è voluta: un relay che compare semplicemente sul broker non è un membro della flotta finché qualcuno non lo dice. Invii con `POST` questo a `/api/fleet` come utente con `fleet.write`:

```json
{
  "id": "press-line-3",
  "name": "Press line 3",
  "group": "Plant1",
  "nodeId": "press-line-3",
  "statusUrl": "http://press-line-3.hotloop.svc:8081"
}
```

`statusUrl` è facoltativo. Senza, il Gateway sa se è online o offline dalle nascite e dalle morti. Con, il Gateway interroga anche il `/status` del relay per la profondità della coda e il numero di dispositivi, e un relay che non riesce a raggiungere appare come irraggiungibile, mai come uno zero sano. L'unità Quadlet qui sopra pubblica 8081 solo su `127.0.0.1`, quindi un Gateway su un'altra macchina non può raggiungere `/status` finché non cambia `PublishPort=`, e a quel punto è raggiungibile anche da chiunque sia su quella rete.

Da allora il Gateway segue il relay e può inviargli `POST /api/fleet/{id}/rebirth`, `POST /api/fleet/{id}/restart`, `POST /api/fleet/{id}/update` o `POST /api/fleet/{id}/config`. Quest'ultimo è l'invio, che funziona dalla 4.17.0 e non ha mai funzionato nella 4.16.0, e si applica in tempo reale dalla 4.18.10. `DELETE /api/fleet/{id}/config` cancella un invio, e il relay torna subito al suo file locale. Tutto questo è solo API: non c'è una schermata Flotta nell'interfaccia del Gateway. Prima di fare affidamento su tutto ciò, restringa l'ACL del broker in modo che solo il Gateway possa pubblicare comandi e file di dispositivi. [La panoramica](/it/edge-relay/overview/#chi-può-comandarlo) spiega perché.
