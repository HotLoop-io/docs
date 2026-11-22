---
title: "HotLoop-produkter: åtte på fem linjer"
description: "Åtte produkter på fem utgivelseslinjer: hva hvert kjerneprodukt har, databasen det bruker, hvordan du installerer dem og hvordan en lokasjon går opp et produkt."
---

HotLoop er åtte produkter for fabrikkgulvet: fire som vokser med en lokasjon (IoT, Edge, Gateway og Edge Relay), pluss Flow for logikk og kobling, Cascade for arbeidsflyter, HotLoop for CODESYS for PLS-ens egen skjerm og Transmitter for å legge verdiene fra en PLS ut på nettverket.

De utgis på fem utgivelseslinjer. **HotLoop core** er IoT, Edge, Gateway og Edge Relay: fire produkter, én kodebase, én tagg. Hver kjerneutgivelse leverer alle fire samtidig, med samme versjon, hver med sitt eget image, sitt eget Helm-chart og sine egne Podman Quadlet-enheter. Velg det som passer boksen. Alle snakker alle protokollene HotLoop har, så du går aldri opp et produkt bare for å lese PLS-en på arbeidsbenken. Funksjonene skiller produktene. Protokollene gjør det ikke.

**Flow**, **Cascade**, **HotLoop for CODESYS** og **Transmitter** er egne linjer med egne versjoner, så en Flow-utgivelse flytter aldri kjernen, og omvendt. Alt under tabellen gjelder kjernen. Her starter hver av de åtte:

| Produkt | Utgivelseslinje | Dokumentasjon | Installasjon | Utgivelsesnotater | Veikart |
|---|---|---|---|---|---|
| **HotLoop IoT** | HotLoop core | <a href="/nb/iot/overview/">Dokumentasjon</a> | <a href="/nb/iot/install/">Installasjon</a> | <a href="/nb/releases/#hotloop-core">Notater</a> | <a href="/nb/roadmap/">Veikart</a> |
| **HotLoop Edge** | HotLoop core | <a href="/nb/edge/overview/">Dokumentasjon</a> | <a href="/nb/edge/install/">Installasjon</a> | <a href="/nb/releases/#hotloop-core">Notater</a> | <a href="/nb/roadmap/">Veikart</a> |
| **HotLoop Gateway** | HotLoop core | <a href="/nb/gateway/overview/">Dokumentasjon</a> | <a href="/nb/gateway/install/">Installasjon</a> | <a href="/nb/releases/#hotloop-core">Notater</a> | <a href="/nb/roadmap/">Veikart</a> |
| **HotLoop Edge Relay** | HotLoop core | <a href="/nb/edge-relay/overview/">Dokumentasjon</a> | <a href="/nb/edge-relay/install/">Installasjon</a> | <a href="/nb/releases/#hotloop-core">Notater</a> | <a href="/nb/roadmap/">Veikart</a> |
| **HotLoop Flow** | Flow | <a href="/nb/flow/overview/">Dokumentasjon</a> | <a href="/nb/flow/install/">Installasjon</a> | <a href="/nb/releases/#hotloop-flow">Notater</a> | <a href="/nb/flow/roadmap/">Veikart</a> |
| **HotLoop Cascade** | Cascade | <a href="/nb/cascade/overview/">Dokumentasjon</a> | <a href="/nb/cascade/running/">Installasjon</a> | <a href="/nb/releases/#hotloop-cascade">Notater</a> | <a href="/nb/cascade/roadmap/">Veikart</a> |
| **HotLoop for CODESYS** | HotLoop for CODESYS | <a href="/nb/codesys/overview/">Dokumentasjon</a> | <a href="/nb/codesys/install/">Installasjon</a> | <a href="/nb/releases/codesys-0-3-8/">Notater</a> | <a href="/nb/codesys/roadmap/">Veikart</a> |
| **HotLoop Transmitter** | Transmitter | <a href="/nb/transmitter/overview/">Dokumentasjon</a> | <a href="/nb/transmitter/install/">Installasjon</a> | <a href="/nb/releases/transmitter-1-1-0/">Notater</a> | <a href="/nb/transmitter/roadmap/">Veikart</a> |

Tabellen under sammenligner de fire kjerneproduktene.

| <span class="sr-only">Detaljer</span> | HotLoop IoT | HotLoop Edge | HotLoop Gateway | HotLoop Edge Relay |
|---|---|---|---|---|
| Hva det er til | Automasjonsbasen. En Pi, en NUC, en boks i et skap | En boks ved maskinen, som fortsetter selv om forbindelsen oppover dør | Lokasjonens hjerne | Hent, videresend, overlev. Ingen database, ingen brukerflate |
| Entiteter, automasjoner, hjelpere, skript, oppskrifter, blueprints, dashbord, logg, varslinger, MCP, MQTT med oppdagelse, ISA-18.2-alarmer, sikkerhetskopier og alle drivere | ja | ja | ja | bare drivere |
| OPC UA-server, Sparkplug-publisering ved kanten med lagring og videresending | | ja | ja | bare publisering |
| Flåte, flere lokasjoner, planlagte rapporter | | | ja | |
| Image | `ghcr.io/hotloop-io/hotloop-iot` | `ghcr.io/hotloop-io/hotloop-edge` | `ghcr.io/hotloop-io/hotloop` | `ghcr.io/hotloop-io/hotloop-edge-relay` |
| Chart | `hotloop-iot` | `hotloop-edge` | `hotloop` | `hotloop-edge-relay` |
| Quadlet-enheter | `deploy/quadlet/iot/` | `deploy/quadlet/edge/` | `deploy/quadlet/gateway/` | `deploy/quadlet/edge-relay.container` |
| Quadlet-enheter på SQLite | `deploy/quadlet/iot/sqlite/` | `deploy/quadlet/edge/sqlite/` | `deploy/quadlet/gateway/sqlite/` | ingen |
| `database.type` i chartet | `postgresql` (standard), `sqlite` | `timescaledb` (standard), `postgresql`, `sqlite` | `timescaledb` (standard), `postgresql`, `sqlite` | ingen |
| Arkitekturer | amd64, arm64, arm/v7 | amd64, arm64, arm/v7 | amd64, arm64 | amd64, arm64, arm/v7 |
| Databasen chartet og Quadlet kjører | PostgreSQL 17 | TimescaleDB | TimescaleDB | ingen |
| Historikk som lagres som standard | 30 dager | 90 dager | 90 dager | ingen |
| Databaser binærfilen kjører på | SQLite eller Postgres | SQLite, Postgres eller TimescaleDB | SQLite, Postgres eller TimescaleDB | ingen |

Databasen er en innstilling, ikke et image: `HOTLOOP_DB_TYPE=sqlite` og `HOTLOOP_DB_PATH` setter hvilket som helst av de tre på en SQLite-fil, helt uten databasecontainer (DEPLOYMENT.md, «SQLite»). Chartene tar det samme valget som `database.type` og Quadlet-enhetene som `sqlite/`-katalogene, og hvert produkt tilbyr bare databasene i tabellen over: å be IoT-chartet om `timescaledb` får installasjonen til å feile. Å gå fra én database til en annen er en sikkerhetskopi og en gjenoppretting (BACKUP.md).

Gateway beholdt navnene den kom ut med til og med 4.17.0: image `ghcr.io/hotloop-io/hotloop`, chart `hotloop`. Ingen som kjører den må endre noe.

## Det som er i et produkt, er det som er i binærfilen

Et produkt er en bygging, ikke en innstilling. `-tags hotloop_iot` bygger IoT, `-tags hotloop_edge` bygger Edge, og uten tagg bygges Gateway. Det et produkt ikke har, er ikke slått av, det finnes ikke: OPC UA-serveren er ikke i IoT-imaget i det hele tatt, så ingen miljøvariabel, ingen verdifil og ingen dårlig dag kan slå den på.

Derfor svarer et mindre produkt for det det ikke har, i stedet for å late som:

- **API-et** beholder alle ruter i alle produkter. En rute for en funksjon dette produktet ikke har, svarer `404` og navngir produktet som har den: `{"error":"scheduled reports are part of HotLoop Gateway; this is HotLoop IoT","product":"iot","feature":"reports"}`. `GET /api/status` oppgir `product` og `features`, så et skript spør i stedet for å famle.
- **En innstilling som bare gjelder Gateway** på IoT eller Edge (for eksempel `HOTLOOP_REPORTS_ENABLED=true` som er med fra en gammel verdifil) gir en advarsel ved oppstart og i innstillingsbildet, og HotLoop kjører. HotLoop holder anlegget i gang selv om en rapport ikke kan lages, og advarselen sørger for at noen ser det.
- **Chartene** har ikke innstillingen i det hele tatt. `charts/hotloop-iot` har ingen `reports`-, `opcuaServer`- eller `edgePublish`-blokk, og `hotloop-edge` har ikke `reports`. Setter du en likevel, genererer den ingenting.
- **`hotloop --product`** skriver ut `iot`, `edge` eller `gateway`. `--version` skriver fortsatt bare ut versjonen, fordi skript leser den.

## Hvilket produkt

- **En Pi, smarte stikkontakter, noen få sensorer, en MQTT-broker full av Tasmota og Zigbee2MQTT, eller én PLS på en arbeidsbenk:** IoT. Det er det minste imaget (omtrent 29 MB på arm), og imaget til vanlig PostgreSQL er en sjettedel av TimescaleDBs, som på et SD-kort er tallet som teller.
- **En boks skrudd fast ved siden av en linje, som mater et SCADA over OPC UA eller publiserer oppover over Sparkplug og tåler at forbindelsen oppover faller ut:** Edge.
- **Lokasjonen: alle linjer, rapporter sendt på e-post etter plan, edge relays som rapporterer inn, mer enn én lokasjon på én skjerm:** Gateway.
- **En boks som bare skal hente og videresende, uten database å passe på:** Edge Relay. Se [Edge Relay-referansen](/nb/edge-relay/reference/).

## Størrelser

Imaget er binærfilen pluss omtrent 3 MB base.

| <span class="sr-only">Detaljer</span> | image / binærfil amd64 | image / binærfil arm64 | image / binærfil arm/v7 |
|---|---|---|---|
| IoT | 31.2 / 28.0 MB | 29.1 / 26.0 MB | 29.2 / 26.0 MB |
| Edge | 36.5 / 33.3 MB | 34.2 / 31.0 MB | 34.3 / 31.1 MB |
| Gateway | 37.1 / 33.9 MB | 34.8 / 31.6 MB | ikke bygget |
| Edge Relay | 15.7 / 12.5 MB | 14.9 / 11.7 MB | 15.1 / 11.9 MB |

Dette er størrelsen på disk. Uten enheter ligger HotLoop på rundt 10 MB RSS og PostgreSQL på rundt 12 MB, og det er bunnen, ikke tallet i drift: hva et produkt bruker med enheter som poller, avhenger av enhetene.

## Installasjon

### Helm

Ett repositorium, alle fire chartene:

```sh
helm repo add hotloop https://hotloop.io/hotloop/

helm install hotloop hotloop/hotloop-iot  --namespace hotloop --create-namespace
helm install hotloop hotloop/hotloop-edge --namespace hotloop --create-namespace
helm install hotloop hotloop/hotloop      --namespace hotloop --create-namespace
```

Kall releasen `hotloop`, uansett produkt. Release-navnet er det databasens volum, Secrets og Service er oppkalt etter, og å beholde det er det som lar en lokasjon gå opp et produkt senere (under).

På EmberNet er hvert av dem sitt eget kort i App Store: «HotLoop IoT», «HotLoop Edge», «HotLoop Gateway» og «HotLoop Edge Relay». En utrulling fra butikken legger dashbordets tenant-etiketter inn i alt chartet genererer, og Running Apps viser dem som `HotLoop-IoT`, `HotLoop-Edge`, `HotLoop-Gateway` og `HotLoop-Edge-Relay`.

### Podman Quadlet

For en boks som ikke står i en klynge. Hver produktkatalog under `deploy/quadlet/` har fem enheter: `hotloop.network`, `hotloop.container` (appen), `hotloop-db.container` (databasen, samme image og versjon som chartet kjører), `hotloop-db.volume` og `hotloop-data.volume`. Installasjonstrinnene står i toppen av hver `hotloop.container`, og [Podman Quadlet](/nb/install/quadlet/) har resten.

De trenger Podman 5.0 eller nyere. Raspberry Pi OS Bookworm leveres med 4.3, som ikke har Quadlet i det hele tatt, så en Pi trenger Raspberry Pi OS Trixie eller nyere. Appen følger `:stable`, og Podmans automatiske oppdatering flytter den, mens databasen er festet: [Quadlet-README-en](/nb/install/auto-update/) forklarer hvordan og hvorfor. Uansett hvordan den installeres: legg databasen på en USB-SSD og ikke på SD-kortet. Historikken skriver hele dagen, hver dag, og SD-kort dør nettopp av det.

## Å gå opp et produkt

Fra IoT til Edge til Gateway beholdes alle enheter, tagger, entiteter, automasjoner, alarmer, brukere og timer med historikk. Hvert produkt kjører alle migreringer, så databasen har samme form i alle tre, og det største produktet starter med tomme tilleggsfunksjoner.

- **Quadlet:** enhetsnavnene, volumene og hemmelighetene er de samme i hver produktkatalog. Kopier `hotloop.container` og `hotloop-db.container` fra det største produktet over dine egne, kjør `systemctl daemon-reload` og start på nytt.
- **Helm:** `helm upgrade hotloop hotloop/hotloop-edge` (eller `hotloop/hotloop`) på samme release. De tre chartene velger podene sine med de samme etikettene og gir StatefulSet og volum for databasen de samme navnene, så oppgraderingen er tillatt og volumet forblir bundet.

Ta en sikkerhetskopi først (`POST /api/backup`, se [Sikkerhetskopier og gjenoppretting](/nb/iot/backup/)) og kopier den av boksen. Overgangen er kjørt på Quadlet, IoT, så Edge, så Gateway på ett databasevolum med den samme enheten til stede i hvert trinn, med IoTs PostgreSQL-katalog som starter under Gateways TimescaleDB-image, og som `helm upgrade` på en ekte klynge. Der IoTs vanlige katalog ikke har TimescaleDB-utvidelsen, blir historikken liggende i native partisjoner etter den overgangen, og en hypertable krever en sikkerhetskopi og en gjenoppretting inn i en fersk TimescaleDB. Å gå ned igjen til et mindre produkt er ikke noe du bør gjøre på en boks du bryr deg om.

## Hvordan de utgis

Én `v`-tagg utgir alle fire, så IoT, Edge, Gateway og Edge Relay deler alltid versjon. Før noe bygges, kontrolleres det at versjon og image for hvert chart stemmer med taggen, at hver Quadlet-appenhet følger `:stable` med en helsesjekk, og at hver databaseenhet stemmer med chartet sitt og aldri oppdateres automatisk. IoT- og Edge-chartene genereres fra Gateway-chartet, så en rettelse i ett når alle tre.
