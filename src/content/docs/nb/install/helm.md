---
title: "k3s og Helm"
description: "Distribuer et hvilket som helst HotLoop-chart på k3s eller Kubernetes: verdiene som er verdt å sette, valg av database, oppgraderinger og tilbakerullinger."
---

Chartet distribuerer to arbeidslaster: gatewayen (en Deployment, som ikke har noen varig tilstand selv) og TimescaleDB (et StatefulSet med et volum). Det er standarden. `database.type` velger en annen database: ren PostgreSQL, eller SQLite, som ikke er noen andre arbeidslast i det hele tatt ([SQLite](#sqlite), lenger ned).

## Installasjon

Gjennom App Store i EmberNet-dashbordet, eller direkte:

```bash
helm install hotloop ./charts/hotloop \
  --namespace hotloop --create-namespace
```

Eller fra chart-depotet, som også er URL-en App Store peker på:

```bash
helm repo add hotloop https://hotloop.io/hotloop
helm install hotloop hotloop/hotloop \
  --namespace hotloop --create-namespace
```

Den andre formen fungerer fra 4.16.0, den første versjonen som ble publisert som `hotloop`. Den siste før den var `industrial-iot` 4.3.1, under det gamle navnet, og oppgradering fra den er en egen prosedyre: se "Upgrading from 4.3.1" i README-ens notater for 4.16.0. Den gamle depotadressen, `https://embernet-ai.github.io/industrial-iot/`, gir 404.

En enkel installasjon fungerer. Chartet genererer et databasepassord og et MCP-token i releasens Secret og gjenbruker dem ved oppgraderinger, så ingenting må oppgis og en oppgradering bytter ikke ut passordet under en database som kjører.

Å nå den krever hverken ingress eller underdomene. Dashbordet finner appen ved hjelp av butikketikettene og proxyer den på adressen inne i klyngen:

```
<release>.<namespace>.svc.cluster.local:8080
```

For å se på den direkte:

```bash
kubectl -n hotloop port-forward svc/hotloop 8080:8080
```

## Verdier verdt å sette

### Autentisering

Siden 4.4.0. Se [Autentisering og brukere](/nb/iot/authentication/) for hele modellen; dette er chartets side av den.

```yaml
auth:
  enabled: true    # the default; requires a login
  insecure: false  # set true only for a deployment truly isolated behind the
                    # dashboard's own NetworkPolicy -- see AUTH.md
```

Med `enabled: true` (standarden) genererer chartet en administratorkonto i releasens Secret ved første installasjon, på samme måte som det genererer databasepassordet og MCP-tokenet, og gjenbruker den ved oppgraderinger:

```bash
kubectl get secret hotloop -n hotloop \
  -o jsonpath='{.data.admin-password}' | base64 -d
```

Å sette `auth.admin.password` eksplisitt overstyrer det genererte.

### Sikkerhet

Verdiene som avgjør om denne poden kan bevege maskiner.

```yaml
safety:
  allowWrites: false      # the master switch -- off by default since 4.4.0
  allowMcpWrites: true    # agents (MCP) write wherever an operator could, once writes are on
  confirmWrites: true     # the UI asks before writing
```

Skriving er av som standard. En tag er skrivebeskyttet til dens eget `writable`-flagg er satt uansett, en verdi utenfor tagens konfigurerte område avvises (aldri klippet: å sende 250 når noen skrev 500 er å gjøre noe annet i det stille), og hvert forsøk, **inkludert hver avvisning**, logges med aktør og kilde. Men en ny installasjon bør ikke trenge at alle tre stemmer overens før den er sikker, så selve hovedbryteren starter lukket.

For å slå på skriving når distribusjonen er gjennomgått:

```yaml
safety:
  allowWrites: true
```

Det er alt som skal til: MCP-klienter leser og skriver som en operatør, under de samme tillatelsene, skrivbare tagger og områder. `allowMcpWrites` leveres på i alle chart; den finnes for en distribusjon som bestemmer noe annet, og er ingen standard noe sted.

### Historiker

```yaml
historian:
  retentionDays: 90     # 0 keeps everything until the volume fills
  useTimescale: true

logbook:
  retentionDays: 90     # entity state changes; 0 keeps everything (see LOGBOOK.md)

database:
  postgresql:
    persistence:
      size: 20Gi
      storageClass: longhorn
```

Dimensjoneringen styres av antall tagger, skannefrekvens og dødbånd. Tusen tagger ved ett sekund uten dødbånd er omtrent 86 millioner rader om dagen; det samme anlegget med fornuftige dødbånd har vanligvis en størrelsesorden mindre. Sett dødbånd før du kjøper lagring.

`useTimescale: false` tvinger frem stien med innebygd partisjonering, som er slik det ser ut å kjøre mot en ren PostgreSQL. Nyttig for å gjenskape en edge-distribusjon.

**Når TimescaleDB-imaget endres.** Imaget har med biblioteket til hver eldre versjon, så en database laget med et eldre image fortsetter å kjøre på det nye, men på den gamle utvidelsesversjonen, og blir der til noen kjører `ALTER EXTENSION timescaledb UPDATE`. Gatewayen gjør det ved oppstart: den sammenligner den installerte versjonen med den serveren leverer og, hvis de er ulike, kjører oppdateringen som første setning i en ny tilkobling (TimescaleDB avviser den i en økt som allerede har lastet den gamle versjonen). Loggen sier `timescaledb extension updated from=... to=...`. Det krever en superbruker, noe brukeren til den medfølgende databasen er. Mot en ekstern eller administrert database der den ikke er det, får du en advarsel med kommandoen som må kjøres, og historikken fortsetter å fungere på den gamle versjonen i mellomtiden. Det skjer bare med `useTimescale` på og migreringer som kjører ved oppstart (`HOTLOOP_DB_MIGRATE`, på som standard).

### Polling

```yaml
runtime:
  defaultPollIntervalMs: 1000
  minPollIntervalMs: 100      # a floor applied to every device
  timeoutMs: 10000
  maxConcurrentPolls: 32
```

`minPollIntervalMs` håndheves i stedet for å stoles på. En polling på 10 ms mot en seriell gateway er et tjenestenektangrep med ekstra steg.

### OPC UA-klient

```yaml
opcuaClient:
  persistence:
    enabled: true      # off by default
    size: 64Mi
```

En enhet som kobler til en sikret OPC UA-server, eller som logger inn med et brukernavn og passord serveren krever kryptert, har et sertifikat og et tillitslager med godkjente serversertifikater (`HOTLOOP_OPCUA_CLIENT_PKI_DIR`, `/data/opcua-client-pki`). Slå dette på før du legger til en slik enhet: rotfilsystemet er skrivebeskyttet, så uten volumet melder enheten en feil som sier det i stedet for å koble til med sertifikater som ville gått tapt ved neste omstart. Det er av som standard fordi det legger en PersistentVolumeClaim til en eksisterende installasjon, som blir stående i Pending på en klynge uten standard StorageClass. Anonyme enheter på en usikret kanal bruker det ikke. Å godkjenne en servers sertifikat, og alt annet om disse enhetene, står i [Protokoller og drivere](/nb/iot/protocols/#opc-ua-sikkerhet-og-legitimasjon).

### Nettverk

```yaml
networkPolicy:
  enabled: true
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: dashboard-system
      ports:
        - protocol: TCP
          port: 8080
```

Begrens ingress til dashbordets namespace når det er kjent. Egress er med vilje ubegrenset: denne appen finnes for å nå utstyr på adresser ingen kan liste opp på forhånd, og en egress-policy som i det stille blokkerer en polling ser ut som en ødelagt driver, ikke en brannmurregel.

### Maskinvare: USB-radioer, serielle adaptere og Bluetooth

Fra 4.19.7 leveres hvert HotLoop-chart (Gateway, IoT, Edge og Edge Relay) med tilgangen maskinvare trenger, på, så en vanlig installasjon fra App Store eller fra helm ser det som er koblet til noden uten manuell redigering, på pod-nettverket. Det er `hardware:`-blokken i `values.yaml`: tre brytere som er på som standard, og ett tilvalg som er av som standard:

| Verdi | Standard | Hva den gjør |
|---|---|---|
| `hardware.privileged` | `true` | App-containeren kjører privilegert (`privileged: true`, `allowPrivilegeEscalation: true`) og som root (`runAsUser: 0`, `runAsNonRoot: false`, ingen fjerning av capabilities). Root fordi en seriell USB-node er `root:dialout 0660` og BlueZs D-Bus-policy slipper inn root og gruppen `bluetooth`; en containerbruker i ingen av dem åpner ingenting. Rotfilsystemet forblir skrivebeskyttet, og init-containeren og den medfølgende databasen beholder sin egen kontekst uten root og uten capabilities. |
| `hardware.usbDevices.enabled` | `true` | Nodens `/dev` (`hardware.usbDevices.hostPath`) monteres på `/dev`: serielle USB-adaptere (`/dev/ttyUSB*`, `/dev/ttyACM*`, `/dev/serial/by-id/*`), også en som ble koblet til etter at poden startet. En privilegert container får bare enhetene som fantes da den startet; monteringen er det som får en gjenoppkoblet pinne til å dukke opp. |
| `hardware.bluetooth.enabled` | `true` | Nodens D-Bus-katalog (`hardware.bluetooth.dbusPath`, `/run/dbus`, som inneholder `system_bus_socket`) monteres på samme sti, slik at en klient når nodens BlueZ. Den opprettes tom på en node uten D-Bus, så poden starter likevel der. |
| `hardware.bluetooth.hostNetwork` | `false` | Tilvalget, av som standard, for det som trenger nodens nettverk: Bluetooth-sockets i kjernen (HCI, L2CAP) finnes bare i nodens nettverksnavnerom, så en klient som åpner en direkte, og oppdagelse som lytter på nodens eget nettverk (mDNS, SSDP, en radios multicast), trenger det. En klient som går gjennom BlueZs D-Bus-API trenger bare den monterte socketen og fungerer fra pod-nettverket. På kjører poden på nodens nettverk med konsekvensene under [Nettverk](#nettverk). |

Hva HotLoop gjør med det i dag: ingenting ennå. HotLoop har ingen egen kode for Bluetooth, Z-Wave eller seriell USB (Zigbee kommer gjennom en Zigbee2MQTT-bro over MQTT, se [den innebygde MQTT-megleren](/nb/iot/broker/)); dette er tilgangen en funksjon, eller en sidecar som leser en radio, trenger, på plass før den etterspørres.

Hva det koster, med vilje og avgjort: poden er root på noden (privilegert, med nodens `/dev`), og chartets standard NetworkPolicy forblir på for det den dekker. Poden blir værende på pod-nettverket. Slå av hvilken som helst del med `--set hardware.privileged=false --set hardware.usbDevices.enabled=false --set hardware.bluetooth.enabled=false`; med alle tre av er renderingen, linje for linje, poden 4.19.6 rendret (uten root, alle capabilities fjernet, skrivebeskyttet rot, pod-nettverk). For det som trenger nodens nettverk, sett `hardware.bluetooth.hostNetwork=true` (eller `hostNetwork=true`): siden svarer da på hver adresse på noden ved `service.targetPort`, ett HotLoop per node per port, en NetworkPolicy gjelder ikke for poden, og `nodeSelector` fester den til noden hvis radio den skal se.

### Edge-distribusjoner

App-imaget bygges for amd64 og arm64, og TimescaleDB 2.30.1-pg17 er multi-arch, så historikeren er ikke det som stopper en edge-installasjon.

```yaml
resources:
  requests: {cpu: 100m, memory: 128Mi}
  limits:   {cpu: 500m, memory: 256Mi}

database:
  postgresql:
    persistence: {size: 5Gi}
    resources:
      requests: {cpu: 100m, memory: 256Mi}
      limits:   {cpu: 500m, memory: 512Mi}

historian:
  retentionDays: 30

nodeSelector:
  kubernetes.io/arch: arm64
```

### Publisere oppover over Sparkplug

En edge-Gateway kan også publisere alt den leser til en sentral, som en Sparkplug B-edge-node. Se [Edge-publisering og store-and-forward](/nb/edge/edge-publish/) for hva den publiserer og hvordan videresendingskøen oppfører seg; dette er chartets side.

```yaml
edgePublish:
  enabled: true
  broker: tcp://central.example.local:1883
  group: Plant1
  node: press-line-3          # empty uses the release name
  username: press-line-3
  existingSecret: central-mqtt # key "password", or set secretKey
  tls: false
  queueMaxBytes: 536870912     # 512 MiB; the default is 64 MiB, and 0 is unbounded
  persistence:
    size: 1Gi
```

Hva det endrer å slå det på, og hvorfor:

- **En 1Gi PVC for videresendingskøen**, montert på `/data/edge-publish`. Det er dit målingene hoper seg opp mens oppkoblingen er nede, så den må overleve poden. `persistence.enabled: false` legger den på en emptyDir, som overlever en omstart av containeren og ingenting annet.
- **Deployment ruller med `Recreate`.** Køen er én fil med en lås. En rullende oppdatering starter den nye poden først, den nye poden kan ikke åpne køen, blir aldri klar, og utrullingen står fast for alltid. Recreate stopper den gamle først; du mister noen sekunder med polling per oppgradering.
- **`replicaCount` må være 1**, og chartet nekter å rendre ellers. To replikaer ville vært to publisherer som krever én Sparkplug-node.
- **Node-id-en er som standard release-navnet**, ikke podens vertsnavn. Vertsnavnet endres ved hver utrulling, og en Sparkplug-vert ville sett en splitter ny edge-node hver gang.

Passordet står aldri i en standardverdi i klartekst. La `password` og `existingSecret` stå tomme for en anonym megler og ingen Secret opprettes; sett `password` og chartet legger det i `<release>-edge-publish`; sett `existingSecret` for å bruke en du administrerer selv.

### Ekstern database

```yaml
database:
  postgresql:
    enabled: false
    auth:
      existingSecret: my-db-credentials
      secretKey: password
  external:
    host: timescale.plant.local
    port: 5432
    database: industrial
    username: industrial
  sslMode: require
```

Appen oppdager TimescaleDB og gjør `tag_history` til en hypertable når utvidelsen finnes. Mot en ren PostgreSQL faller den tilbake på innebygd områdepartisjonering i stedet for å feile.

Valget registreres og er **fast**. En database laget som hypertable nekter å starte mot en server uten utvidelsen i stedet for å skrive et annet sted i det stille; hvis du ser den feilen, har du pekt appen mot en annen database enn den ble bygget på.

### SQLite

Databasen er en innstilling, ikke et image. Hvert produkt kjører på SQLite, Postgres eller TimescaleDB fra samme binærfil (IoT hopper over TimescaleDB, se nedenfor):

| Variabel | Standard | Hva den gjør |
|---|---|---|
| `HOTLOOP_DB_TYPE` | `postgres` | `postgres` eller `sqlite`. TimescaleDB er `postgres` med utvidelsen på serveren |
| `HOTLOOP_DB_PATH` | `/data/hotloop.db` | SQLite-filen. Bare SQLite leser den |

SQLite er den rene Go-versjonen (`modernc.org/sqlite`), kompilert inn i hvert image, så det er ingen andre container, ikke noe 300 MB Postgres-image på et SD-kort, og arm-byggene forblir statiske. Legg filen på et volum som overlever containeren, og på en Pi legger du det volumet på en USB-SSD. En historiker som skriver til et SD-kort hele dagen er måten å kjøpe mange SD-kort på.

Hva som er likt: hver tabell, hver kolonne, hver funksjon. Hva som er annerledes:

- Historikken er én tabell med en indeks, ikke partisjoner eller en hypertable, og oppbevaring sletter gamle rader i stedet for å droppe måneder. Et anlegg med år med historikk på ett sekund vil ha Postgres eller TimescaleDB, og å flytte dit er en sikkerhetskopi og en gjenoppretting (BACKUP.md).
- Én skriver om gangen. SQLite tar turer på skriving og leser ved siden av (WAL), som er rikelig for ett HotLoop og en `--mcp-stdio`-hjelper ved siden av på samme fil. Det er ikke for to replikaer på nettverkslagring: SQLite på NFS blir ødelagt, så en SQLite-distribusjon er én pod med et lokalt volum.
- Commits er `synchronous=FULL`: når API-et sier at det lagret, er det på disk, strømbrudd eller ei.

**HotLoop IoT** har som standard 30 dagers historikk (`HOTLOOP_HISTORIAN_RETENTION_DAYS` vinner fortsatt når den er satt) og bygger aldri en hypertable: TimescaleDB er en del av Edge og Gateway. Sett `HOTLOOP_HISTORIAN_TIMESCALE=true` på IoT og den sier fra ved oppstart og kjører på vanlige partisjoner. En database flyttet ned fra en Edge eller en Gateway som allerede har en hypertable beholder den og fortsetter å fungere.

#### Velge database i chartet

Én verdi, `database.type`, og hvert produkt tar de det kjører på:

| `database.type` | Hva som distribueres | IoT | Edge | Gateway |
|---|---|---|---|---|
| `timescaledb` | Appen og TimescaleDB (et StatefulSet og volumet). Historikk i en hypertable | avvist | standard | standard |
| `postgresql` | Appen og ren PostgreSQL 17 (et StatefulSet og volumet). Historikk i innebygde partisjoner | standard | ja | ja |
| `sqlite` | Appen alene, med databasefilen på et eget volum | ja | ja | ja |

```bash
helm install hotloop hotloop/hotloop-iot --namespace hotloop --create-namespace   --set database.type=sqlite
```

Å be IoT om `timescaledb` får installasjonen til å feile og sier hva IoT kjører på (`database.type is "timescaledb", and HotLoop IoT runs on sqlite, postgresql`), og skjemaet i App Store tilbyr det ikke. `helm lint` fanger det ikke (helm 3.22 linter det rent), så det er renderingen som avviser. Å utelate `database.type` gir produktets egen standard, så en oppgradering med `--reuse-values` fra før nøkkelen fantes beholder databasen den hadde.

`sqlite` rendrer:

- `HOTLOOP_DB_TYPE=sqlite` og `HOTLOOP_DB_PATH=/data/db/hotloop.db`, og ingen av Postgres-tilkoblingsinnstillingene. Ingen databasepod, ikke noe databasepassord i Secret, ingen init-container som venter på ett.
- En PersistentVolumeClaim som heter `<release>-db` (`database.sqlite.persistence`: `size`, `storageClass`, `accessMode`, 10Gi og klyngens standard til å begynne med), montert på `/data/db`. Katalogen, ikke filen: SQLite har en `-wal` og en `-shm` ved siden av databasen. Legg den på lokal lagring; SQLite på NFS blir ødelagt.
- Deployment på `Recreate`, ikke en rullende oppdatering, fordi volumet er `ReadWriteOnce` og filen har én skriver. Et `replicaCount` over 1 får installasjonen til å feile.

NetworkPolicy er uendret og på: appens egen policy gjelder fortsatt, og databasepolicyen rendres bare når det er en databasepod å beskytte.

Å endre `database.type` på en release som allerede har data flytter ikke dataene. Den nye databasen starter tom, så å flytte et anlegg mellom databaser er en sikkerhetskopi og en gjenoppretting (BACKUP.md), på samme måte som med variabelen. Særlig nekter en database laget som en TimescaleDB-hypertable å starte mot ren PostgreSQL, så ikke bytt en eksisterende Edge eller Gateway fra `timescaledb` til `postgresql` og forvent at den kommer opp.

#### Velge database i Quadlet

Hvert produkts katalog under `deploy/quadlet/` har PostgreSQL- eller TimescaleDB-filene som de var, og en `sqlite/`-katalog ved siden av: `hotloop.container` og `hotloop-data.volume`, appen alene med filen på `/data/hotloop.db` på volumet `hotloop-data`. Den følger `:stable` og ruller tilbake en dårlig oppdatering på samme måte. Installer de to filene i stedet for de andre (de bruker de samme enhetsnavnene), og lag to secrets i stedet for tre: det er ikke noe databasepassord. [`deploy/quadlet/README.md`](/nb/install/quadlet/) har trinnene.

For vanlige Postgres-partisjoner på Edge eller Gateway under Quadlet beholder du TimescaleDB-enheten og legger `Environment=HOTLOOP_HISTORIAN_TIMESCALE=false` til `hotloop.container`. IoTs enhet kjører allerede ren PostgreSQL.

### Nøkkelen til enhetenes legitimasjon

```yaml
secretKey:
  enabled: true
  existingSecret: ""     # or a Secret you manage, with the key under secret.key
```

Enhetspassord (en UniFi-konsollinnlogging, et OPC UA- eller MQTT-passord, HTTP API-nøkler) krypteres i databasen med denne nøkkelen, så et dump eller en sikkerhetskopi inneholder bare chiffertekst. Ut av boksen genererer chartet en i `<release>-secret-key` ved første installasjon, beholder den ved oppgraderinger, og beholder den også ved `helm uninstall` (`helm.sh/resource-policy: keep`), fordi en database som beholdes på volumet sitt er til ingen nytte for legitimasjonen uten den. Den monteres som en fil og sendes som `HOTLOOP_SECRET_KEY_FILE`, aldri som miljøvariabel.

Ta sikkerhetskopi av Secret adskilt fra databasekopiene: en nøkkel som ligger ved siden av sikkerhetskopiene den beskytter, beskytter ingenting. For å ta med din egen skriver `hotloop gen-secret-key` ut en. Utenfor Kubernetes skriver du den til en fil bare HotLoop kan lese og peker `HOTLOOP_SECRET_KEY_FILE` på den. Uten nøkkel kjører HotLoop, sier i oppstartsloggen at enhetspassord lagres slik de ble skrevet, og nekter å lagre en UniFi-konsoll. Legitimasjon som allerede er lagret krypteres første gang den starter med en nøkkel. Se [Sikkerhetskopi og gjenoppretting](/nb/iot/backup/#enhetslegitimasjon-og-den-hemmelige-nøkkelen) for hva det betyr for en gjenoppretting.

## Konfigurasjon, og hva Innstillinger-skjermen kan endre

Nesten hver innstilling kommer fra en miljøvariabel som chartet setter fra en Helm-verdi. Det er riktig sted: konfigurasjon som avgjør om denne prosessen kan styre maskiner hører hjemme i distribusjonen, gjennomgått, ikke i et skjema på en nettside.

Skjermen **Innstillinger** viser alt, hver innstilling, dens gjeldende verdi, om den kom fra databasen, en miljøvariabel eller den innebygde standarden, og variabelen som endrer den. Det meste er skrivebeskyttet, og det er poenget: spørsmålet den svarer på er "hvorfor gjør den det, og hva endrer jeg?"

Fire innstillinger er anleggsidentitet og ikke oppførsel, og kan redigeres der. De lagres i databasen og får effekt umiddelbart, fordi et anlegg får nytt navn langt oftere enn det distribueres på nytt:

| innstilling | variabelen den overstyrer |
|---|---|
| Anleggsnavn | `HOTLOOP_PLANT_NAME` |
| Anleggs-ID | `HOTLOOP_SITE_ID` |
| Tidssone | `HOTLOOP_TIMEZONE` |
| Bekreft før skriving | `HOTLOOP_CONFIRM_WRITES` |

Under innstillingene er det kort som er data og ikke konfigurasjon, og de kan redigeres av samme grunn: **Brukere** ([Autentisering og brukere](/nb/iot/authentication/)), **Alarmeskalering**, som sier hvem som varsles neste gang ingen kvitterer en alarm og når ([Alarmvarsler](/nb/iot/notifications/#eskalering)), og historikermålene og MQTT-innloggingene. Kanalene en eskalering kan bruke er fortsatt distribusjonens, satt av `HOTLOOP_NOTIFY_*`.

En lagret verdi vinner over miljøvariabelen, så chartets verdi blir utgangspunktet i stedet for siste ord. En tidssone maskinen ikke kan løse avvises i stedet for å bli akseptert og ignorert i det stille, noe som ville latt hvert tidsstempel falle tilbake på UTC uten at noe sier hvorfor.

Det samme gjelder distribusjonens egen verdi. Hvis `HOTLOOP_TIMEZONE` (eller `TZ`, når den er usatt) navngir en sone som ikke lastes, nekter HotLoop å starte og feilen nevner variabelen og verdien. Den pleide å trekke på skuldrene og kjøre på UTC. Rapporter, tidsplaner og skifttider går etter anleggets klokke, og en gjetning som er timer feil er verre enn en pod som sier hvorfor den ikke kommer opp.

Anleggets plassering er `HOTLOOP_SITE_LATITUDE` og `HOTLOOP_SITE_LONGITUDE` (chart: `plant.latitude`, `plant.longitude`), desimalgrader, nord og øst positive. Soloppgang, solnedgang og solens entiteter og utløsere regnes ut fra dem på boksen ([Solen](/nb/iot/sun/)). Begge eller ingen, og en feil stopper oppstarten med variabelen nevnt. Innstillinger-skjermen viser dem skrivebeskyttet: regler utløses på en soloppgang, så å flytte den er en distribusjon.

**Sikkerhetsbryterne kan ikke redigeres og kommer ikke til å bli det.** `HOTLOOP_ALLOW_WRITES` er hovedkontrollen over om denne prosessen kan styre utstyr; en kontroll som kan slås på igjen fra den samme nettleserøkten som sender skrivingene er ikke en kontroll. `HOTLOOP_HISTORIAN_RETENTION_DAYS` er likeledes bare for distribusjonen: oppbevaringspolicyen brukes på databasen ved oppstart, så et felt på en skjerm ville sett ut som det virket og flyttet ingen data. Endepunktet avviser enhver nøkkel utenfor det redigerbare settet **ved navn**, i stedet for å ignorere den.

En begrensning, oppgitt fordi skjermen også oppgir den: MCP-serveren bygger instruksjonene sine ved oppstart, så den annonserer anleggsnavnet den startet med til poden startes på nytt. Alt annet fanger opp et navnebytte ved neste forespørsel.

## PostgreSQL 17

HotLoops database er PostgreSQL 17 (TimescaleDB 2.30.1 på den for Edge og Gateway, ren PostgreSQL 17.11 for IoT og for `database.type: postgresql`). Tidligere utgivelser kjørte PostgreSQL 16, og PostgreSQL åpner ikke datakatalogen til en annen hovedversjon. Så flyttingen gjøres for deg, ved oppgraderingen, og det er ingenting å kjøre.

**På chartet** får databasepoden to init-containere. Den første kjører PostgreSQL 16-imaget og, bare når volumet har 16-data, kopierer den installasjonen til et midlertidig volum. Den andre kjører det nye imaget og `pg_upgrade`r til en ny katalog ved siden av den gamle. Begge lar et nytt volum, eller ett som allerede er på 17, være i fred. Oppgraderingen er `helm upgrade`, ikke noe mer. Regn med at databasepoden blir stående i `Init` så lenge en kopi av dataene tar, og at appen venter på den; `kubectl logs <release>-postgresql-0 -c pg-upgrade` er loggen.

**På Quadlet** kjører `hotloop-db-upgrade.container` før `hotloop-db.service` og gjør det samme i en oneshot-enhet. Kopier de nye `hotloop-db.container`, `hotloop-db-upgrade.container` og `hotloop-db-upgrade.sh` fra produktets katalog til enhetskatalogen og start databaseenheten på nytt; [Quadlet-README-en](/nb/install/quadlet/) har kommandoene. Databaseenheten krever oppgraderingsenheten, så en maskin som bare fikk den nye databaseenheten starter ikke på 16-data og sier hvorfor: den feiler, den gjetter ikke. `journalctl -u hotloop-db-upgrade` er loggen. Enheten kjører bare når volumet har 16-data: på en ny maskin, og ved hver oppstart etter oppgraderingen, hopper systemd over den (den vises som inaktiv, ikke feilet) og PostgreSQL 16-imaget hentes aldri. Når volumet har 16-data, henter enheten først det imaget.

Hva den gjør, i rekkefølge, alt i `hotloop-pg-upgrade.sh` (én fil, den samme som chartet og enhetene kjører):

1. Ingen datakatalog, eller en som allerede er på 17: ingenting, og den sier det. Enhver annen hovedversjon avvises, uten at noe endres.
2. Starter den gamle serveren én gang på en privat socket og stopper den rent, som spiller av loggen etter et strømbrudd og leser kodingen og lokaliteten den nye klyngen må matche.
3. Kjører `initdb` på en ny katalog ved siden av den gamle med de innstillingene, kjører `pg_upgrade` i kopimodus (den gamle katalogen leses bare) og fører `postgresql.conf`, `postgresql.auto.conf`, `pg_hba.conf` og `pg_ident.conf` over.
4. Starter den nye serveren én gang for å bevise at den åpner med de endelige innstillingene og samler planleggerstatistikken `pg_upgrade` ikke fører over.
5. Først da bytter den navnene: den gamle katalogen blir `pgdata.pg16`, den nye `pgdata`.

Den trenger omtrent like mye ledig plass ved siden av dataene som dataene tar, og sjekker før den starter. Hvis noe feiler før trinn 5, avslutter oppgraderingen med en verdi som ikke er null, 16-dataene er akkurat som de var, og databasen starter ikke på en halvbygd katalog: på chartet blir poden stående i `Init:Error`, på Quadlet feiler oppgraderingsenheten og databaseenheten bak den starter aldri. Rett det loggen sier og start på nytt; et uferdig forsøk fjernes og gjøres om. TimescaleDB-utvidelsen kommer over på versjonen den var på, og appen oppdaterer den til den leverte ved neste oppstart, som den alltid har gjort. TimescaleDBs egen veiledning for en PostgreSQL-oppgradering på stedet er `pg_upgrade` med de gamle og nye binærfilene ([Tiger Data, "Upgrade PostgreSQL"](https://www.tigerdata.com/docs/deploy/self-hosted/upgrades/upgrade-pg)).

Sikkerhetskopien er selve den gamle katalogen. `pg_upgrade` i kopimodus skriver aldri til den, så `pgdata.pg16` er hele PostgreSQL 16-databasen slik den sto, som er en bedre sikkerhetskopi enn et dump og det eneste som gjør veien tilbake nedenfor mulig. HotLoops egen sikkerhetskopi ([Sikkerhetskopi og gjenoppretting](/nb/iot/backup/)) tas av den kjørende appen gjennom den kjørende databasen, så den kan ikke tas i trinnet som kjører før databasen starter. Ta en på den gamle utgivelsen før du oppgraderer likevel, og kopier den av boksen.

### Gå tilbake

`helm rollback`, eller å sette tilbake den forrige `hotloop-db.container`, bringer databasen tilbake til PostgreSQL 16-imaget (Podmans automatiske oppdatering gjør ikke det: den flytter bare appen), og PostgreSQL 16 åpner ikke en 17-katalog (`database files are incompatible with server`, loggen sier at katalogen ble initialisert av versjon 16). Ingenting går tapt og ingenting er halvveis endret; databasen starter bare ikke. Det forrige utgivelsen trenger er sin egen 16-katalog, som er `pgdata.pg16`. Stopp databasen, og sett så navnene tilbake:

```sh
# chart: after the rollback, stop the database, swap in a one-off pod, start it
kubectl -n hotloop scale statefulset/hotloop-postgresql --replicas=0
kubectl -n hotloop run pgswap --rm -it --restart=Never --image=busybox \
  --overrides='{"spec":{"securityContext":{"runAsUser":999,"fsGroup":999},"containers":[{"name":"pgswap","image":"busybox","command":["sh","-c","cd /d && mv pgdata pgdata.pg17 && mv pgdata.pg16 pgdata"],"volumeMounts":[{"name":"d","mountPath":"/d"}]}],"volumes":[{"name":"d","persistentVolumeClaim":{"claimName":"data-hotloop-postgresql-0"}}]}}'
kubectl -n hotloop scale statefulset/hotloop-postgresql --replicas=1

# Quadlet: the volume is named hotloop-db
sudo systemctl stop hotloop.service hotloop-db.service
d=$(sudo podman volume inspect hotloop-db --format '{{.Mountpoint}}')
sudo mv "$d/pgdata" "$d/pgdata.pg17" && sudo mv "$d/pgdata.pg16" "$d/pgdata"
```

Det er databasen slik den var ved oppgraderingen, og ingenting skrevet siden. Tilbakebyttet virker bare én gang: oppgraderingen nekter å kjøre mens en `pgdata.pg16` står i veien, så neste oppgraderingsforsøk trenger først `pgdata.pg17` og at den gamle katalogen tas hånd om. Å gå fremover er veien, og en tilbakerulling er for en boks som ikke kan kjøre 17 i det hele tatt. Appens egen tilbakerullingsregel er uendret: 16-katalogens skjema er det utgivelsen før oppgraderingen etterlot, og en utgivelse som finner migreringer den ikke kjenner sier fra, se [Migreringer legger bare til](/nb/iot/migrations/).

### Når du er fornøyd

`pgdata.pg16` blir stående til du sletter den, fordi å slette den er å slette den eneste veien tilbake. Den er like stor som databasen. Når boksen har kjørt på 17 så lenge du vil:

```sh
# chart
kubectl -n hotloop exec hotloop-postgresql-0 -c postgresql -- rm -rf /var/lib/postgresql/data/pgdata.pg16
# Quadlet
sudo rm -rf "$(sudo podman volume inspect hotloop-db --format '{{.Mountpoint}}')/pgdata.pg16"
```

### Slå det av

`database.postgresql.upgrade.enabled: false` fjerner init-containerne. Et volum som fortsatt er på 16 hindrer da databasen i å starte, og flyttingen er din å gjøre. La det stå på: med det på henter en ny installasjon likevel PostgreSQL 16-imaget én gang per node, fordi imaget til en init-container hentes før det kjøres, og så kjører den det aldri.

## Oppgradere fra 3.x

**Dette er en erstatning, ikke en oppgradering.** 3.x var et annet produkt. Det finnes ingen migreringsvei for dataene, fordi det ikke deler noen datamodell med en taggistoriker.

```bash
helm uninstall hotloop -n hotloop
# keep or delete the old PVCs deliberately, they hold the HA recorder database
helm install hotloop ./charts/hotloop -n hotloop
```

Ting som ikke finnes lenger og avvises hvis de settes: `sidecarProxy`, `homeassistant`, tilleggene `mqtt`/`nodered`/`esphome`/`zigbee2mqtt`, `devices`, `cameras`, `customConfig`, `network.hostNetwork`.

## Rulle tilbake en oppdatering

`helm rollback hotloop -n hotloop` setter tilbake den forrige utgivelsens image. Det setter ikke databasen tilbake: en utgivelse migrerer ved oppstart, og det blir stående gjort. Regelen og sjekken står i [Migreringer legger bare til](/nb/iot/migrations/).

Det eneste en tilbakerulling over PostgreSQL 17-utgivelsen setter tilbake er databasemotoren: chartets databaseimage går tilbake til 16, som ikke åpner den oppgraderte katalogen. [Gå tilbake](#gå-tilbake) er veien ut.

Det er trygt én utgivelse tilbake. Databasen registrerer hvilken utgivelse som brukte hver migrering, og en utgivelse som finner migreringer fra to eller flere utgivelser nyere enn seg selv nekter å starte:

```
refusing to start: this database's schema is more than one release ahead of
HotLoop 4.18.10. ...
```

Det er ikke en feil å jobbe seg rundt. Det betyr at databasen har gått lenger enn denne utgivelsen noen gang er kjørt mot. Gå fremover til en utgivelse som kjenner skjemaet, som er den nyeste, eller gjenopprett en sikkerhetskopi tatt av utgivelsen du er på ([Sikkerhetskopi og gjenoppretting](/nb/iot/backup/)). Nøyaktig én utgivelse tilbake starter, med en advarsel i loggen som nevner begge versjonene. Ta en sikkerhetskopi før du oppgraderer; tilbakerullingen kan ikke angre data den nyere utgivelsen skrev.

## Verifisere en installasjon

```bash
kubectl -n hotloop get pods
kubectl -n hotloop logs deploy/hotloop | head -20
```

En frisk oppstart sier hvilke protokoller den snakker, bruker migreringene, melder historikkmodusen og advarer om alt som er verdt å vite:

```
msg=starting version=4.0.0 protocols="[ethernet-ip http modbus mqtt mtconnect opcua s7comm]"
msg="writes are ENABLED: the UI, API, automations and MCP can all command devices"
msg="tag_history promoted to a hypertable" timescale=2.30.1
msg="history schema ready" mode=timescale
msg=listening addr=:8080 mcp=/mcp writes=true
```

Sjekk så etikettene dashbordet trenger. Dette er sjekken som fanger avvik, kontroller **settet**, ikke antallet, fordi en antallssjekk passerer mens settet er feil:

```bash
kubectl -n hotloop get svc <release> -o json \
  | jq -r '.metadata.labels | keys[] | select(startswith("embernet.ai/"))'
```

Nøyaktig fire, på Service og på poden:

```
embernet.ai/app-name
embernet.ai/gui-port
embernet.ai/gui-type
embernet.ai/store-app
```

Hvis appen kjører men mangler i Kjørende apper, er Service-etikettene det første stedet å se: dashbordet spør etter Services på `embernet.ai/store-app`.

En distribusjon fra App Store legger til fem til, fra `tenantLabels` dashbordet sender: `embernet.ai/tenant`, `app-id`, `source`, `deployed-by` og `deployment-id`. De havner på hver ressurs chartet rendrer og på gateway-poden. Dashbordet leser tenanten fra Service og ingen andre steder, så en butikkdistribuert Gateway uten `embernet.ai/tenant` på sin Service tilhører ingen. En vanlig `helm install` rendrer ingen av de fem.

## Prober

- `/healthz`, liveness. Svarer så lenge prosessen kjører.
- `/readyz`, readiness. Krever i tillegg databasen, så en pod som har mistet historikeren sin slutter å ta trafikk i stedet for å vise et grensesnitt som ikke kan svare på noe.

Oppstartsproben gir to minutter, fordi en første installasjon kjører migreringer og liveness-proben ikke må drepe den midt i en migrering.

## Nedstengning

`terminationGracePeriodSeconds: 45`. Ved SIGTERM slutter appen å ta imot forespørsler, og tømmer så historikerkøen slik at målinger som allerede er tatt skrives i stedet for å kastes. Hvis nådeperioden kuttes for kort, går det som var underveis tapt.

## Feilsøking

**En enhet blir stående i `connecting`.** Se på `lastError` på enhetskortet. Oftest en brannmur mellom poden og utstyret, eller feil port. Chartet begrenser ikke egress, så en NetworkPolicy som blokkerer det er noe annet på klyngen.

**Tagger leser dårlig kvalitet.** Enheten svarte, men punktet gjorde det ikke. For Modbus, sjekk adressebasen, `oneBased` hvis tegningene dine bruker 40001-nummerering. For OPC UA, sjekk at node-id-en ble løst; foretrekk `nsu=`-formen.

**Verdiene ser plausible ut, men er feil.** På Modbus er det ordrekkefølgen, prøv `CDAB`. Dette er feilen som ikke melder seg selv, fordi tallet ikke er åpenbart feil.

**Ingenting blir historisert.** Sjekk diagnostikken på Protokoller-skjermen. `filtered` teller målinger undertrykt av dødbåndet, som fungerer som tiltenkt; `dropped` teller målinger tapt fordi databasen ikke holdt følge, som ikke er det.

**MCP gir 401.** Bearer-tokenet. Les det fra releasens Secret.

**Hver `/api/`-forespørsel gir 401.** Forventet når `auth.enabled` er true og ingen har logget inn ennå, det er poenget med 4.4.0. Les det genererte administratorpassordet fra releasens Secret (se [Autentisering](#autentisering)) og logg inn gjennom grensesnittet, eller `POST /api/auth/login` direkte. Se [Autentisering og brukere](/nb/iot/authentication/).

**Mistet administratorpassordet og det finnes ingen annen administratorkonto.** Generer en ny hash og patch Secret, start deretter poden på nytt slik at den leser miljøet på nytt; `EnsureAdminUser` rører ikke en konto som allerede finnes, så dette erstatter raden direkte i stedet for å gå gjennom chartet:

```bash
hotloop hash-password -password 'a-new-one'
kubectl exec -n hotloop deploy/hotloop -- \
  psql "$DATABASE_URL" -c \
  "UPDATE users SET password_hash = '<the hash>' WHERE username = 'admin'"
```

**En automatisering er aktivert men kjører ikke.** Den kompilerte ikke. Automasjoner-skjermen viser den som NOT ARMED med årsaken, og systemloggen har feilen.
