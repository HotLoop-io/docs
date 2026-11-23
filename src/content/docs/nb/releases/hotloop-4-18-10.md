---
title: "Utgivelsesnotater: HotLoop core 4.18.10"
description: "Hva HotLoop core 4.18.10 gir deg, hva som endrer seg ved oppgradering og hva du bør lese før du rører et anlegg i drift."
sidebar:
  label: "4.18.10"
---

Versjonen der HotLoop slutter å være ett enkelt image. IoT, Edge, Gateway og Edge Relay kommer alle fra denne ene taggen, i takt, hver med sitt eget image og sitt eget chart. I tillegg: enheter som melder seg selv over MQTT, historikk skrevet til anleggets egen database, en database du velger selv (SQLite, Postgres eller TimescaleDB), en Edge som fortsetter å virke når WAN er nede, og bokser som følger `:stable` og ruller tilbake en dårlig oppdatering av seg selv. Fra 4.17.0 er Gateway en vanlig `helm upgrade`. Les «Oppgradere fra 4.17.0» lenger ned før du rører et anlegg i drift, for et par standardverdier har flyttet seg.

Det finnes ingen 4.18.0, 4.18.1, 4.18.2, 4.18.3, 4.18.4, 4.18.5, 4.18.6, 4.18.7 eller 4.18.9 å installere, og 4.18.8 er ikke en versjon å kjøre. Ni av de taggene publiserte ingenting. 4.18.8 la igjen images på ghcr.io uten chart og uten release, og flyttet `:stable` og `:latest` for Gateway, Edge Relay og IoT, så en boks som følger `:stable` kan ha kjørt 4.18.8 til den oppdaterte seg. 4.18.10 erstatter den og har alle rettingene fra de taggene. Verdien til en oppdaget enhet kunne få et eldre tidsstempel enn sin egen «ingenting ennå»-måling, og cachen forkastet den. Dashbordet slutter å tegne om en måler som ikke har endret seg. Megleren som er bygd inn i HotLoop avviste abonnementet til en lytter når pakke-id-en samsvarte med en melding den sendte til samme klient, så enheten bak det abonnementet ble aldri oppdaget; og en klient som publiserte med samme pakke-id som en QoS 1- eller 2-melding megleren fortsatt skyldte den, fikk megleren til å forkaste sin egen melding og aldri sende den på nytt etter en gjenoppkobling. Megleren holder nå de to retningene i separate tabeller, og en megler som avviser et abonnement sier det i loggen. Et dashbord som fortsatt laster, skriver ikke lenger adressen sin over den personen nettopp hadde gått til. Hvis telefonene dine logger inn på ntfy med et passord fra samme adresse som HotLoop publiserer fra, gi den brukeren et tier også. 4.18.10 er alt 4.18.0 skulle være, pluss det som har endret seg siden 4.18.3 ble tagget.

De fullstendige notatene står i README: Hva som er nytt i 4.18.10.

## Kort fortalt

- Samme fire images, samme tagger, samme arkitekturer.
- **Siden 4.18.4 ble tagget.** Verdien til en oppdaget enhet kunne gå tapt bak sin egen «ingenting ennå»-måling, og gjør ikke det lenger. En UPnP-enhet der beskrivelsen ikke lot seg lese, leses på nytt i løpet av sekunder, ikke etter 15 minutter. OK i kortredigereren virker ved første klikk, Save i entitetsskuffen blir stående, dashbordet slutter å tegne om det som ikke har endret seg, og en teller som to prosesser hamrer på, avviser ikke lenger den som stadig taper.
- **Lisensen har endret seg.** Alle fire produktene er nå under HotLoops Business Source License 1.1. Bruk hjemme og i laboratorium er gratis, det samme er bruk i skoler, ideelle organisasjoner og offentlig sektor, og bedriftsbruk går gjennom EmberNet. Hver versjon blir GPL-3.0 eller nyere fire år etter at den først kom ut. Den er ikke åpen kildekode før da, og jeg skal ikke late som om den er det. Les LICENSE før du setter den på et anlegg.
- **Siden 4.18.3 ble tagget.** UniFi på en veggskjerm og en telefon: nettverkskartet kan zoomes og klypes, WAN-latens og porttrafikk får kurver, og én knapp lager de vanlige alarmene. En agent kan spørre over MCP etter nettverkets kart (`get_network_topology`) og hva konsollen nettopp sa (`get_network_events`). Logbook viser UniFi-hendelser under svitsjen de gjelder. Én MQTT-enhet kunne få to klienter med samme id, og megleren kastet dem ut etter tur; det er rettet. Alarmmeldinger skriver en verdi slik verdikortet gjør, alarmkortet kan rettes mot enheter eller utstyr, og trenden til en tag som står stille, er en linje over hele vinduet.
- **Fire produkter, fire images, fire charts, én tag.** `hotloop-iot` og `hotloop-edge` er nye på ghcr.io og i chart-repositoryet. Gateway beholder `ghcr.io/hotloop-io/hotloop` og chartet `hotloop`, så ingen som kjører den, trenger å endre noe. Et produkt er en bygging, ikke en innstilling: OPC UA-serveren er ikke slått av i IoT-imaget, den er ikke i det. Se [produktsiden](/nb/products/).
- **MQTT-discovery.** Pek ESPHome, Zigbee2MQTT, Tasmota eller en Shelly mot megleren, så dukker den opp, allerede lesende. Den kan ikke kommandere noe før en admin godtar den og armerer hvert punkt for hånd. Nettverksdiscovery (mDNS, SSDP, DHCP) lytter og sender ingenting, med mindre du oppgir et nett som skal sondes.
- **Historian-mål.** Hver måling HotLoop beholder, går også til anleggets egen PostgreSQL, TimescaleDB, SQL Server, InfluxDB eller MySQL/MariaDB, de samme radene med samme kvalitet.
- **Databasen er en innstilling.** SQLite, PostgreSQL eller TimescaleDB per produkt, fra samme binærfil. En Pi trenger ikke et database-image på 300 MB.
- **Edge holder anlegget i gang med WAN nede**, og køen for lagre og send videre overlever de stygge tilfellene: en oppstart under et avbrudd, en link som dør uten tilbakestilling, en avspilling som må løpe fra anlegget.
- **Hver boks følger `:stable` og oppdaterer seg selv**, og en versjon som ikke kan starte, rulles tilbake. Migreringer legger bare til, og en app nekter å starte på et skjema som ligger to versjoner foran, så den tilbakerullingen er alltid trygg.
- **Edge Relay** tar imot en sendt konfigurasjon live, uten omstart og uten å miste Sparkplug-sesjonen, og oppdager enheter på en megler slik Gateway gjør.
- **Hvert image har alle tredjepartslisenser med seg**, og en GPL-modul stopper bygget.
- **Solen.** Soloppgang, solnedgang og solens høyde, regnet ut på boksen fra en breddegrad og en lengdegrad.

### API-endringer

- Nye ruter: `/api/discovery`, `/api/network-discovery`, `/api/mqtt/brokers`, `/api/broker/logins`, `/api/historian/targets`, `GET /api/entities/{entity_id}/image` og `POST /api/fleet/{id}/update`. Alle i docs/API.md.
- `GET /api/status` oppgir `product` og `features`, og image-digesten. En rute for en funksjon produktet du snakker med ikke har, svarer `404` med produktet som har den, i stedet for å late som. Hver rute finnes fortsatt i hvert produkt.
- Ny rettighet `fleet.update`, bare for admin. Operatørrollen er uendret.

### Oppgradere fra 4.17.0

- `helm upgrade <release> hotloop/hotloop --version 4.18.10 --reset-then-reuse-values`. Vi rendret Gateway-chartene for 4.17.0 og 4.18.10 side om side: de samme åtte objektene, de samme selektorene, de samme volume claims. Et vanlig `--reuse-values` rendrer også denne gangen, men det spiller av verdiene fra 4.17.0 og mister alle nye standardverdier, så bruk reset-formen eller verdifilen din.
- Migreringene 0016 til 0024 kjøres ved oppstart (MQTT-discovery, megler-logins, MQTT-kilder, historian-mål, nettverksfunn, to til for det MQTT-kildene snakker, tabellen dashbord lagres i, og en `no_data`-kolonne på tagger som er tom for hver tag som allerede finnes). Alle er additive. Ta `pg_dump` først, som alltid.
- **`edgePublish.queueMaxBytes` er nå som standard 64 MiB, ikke ubegrenset.** Utover det forkastes de eldste målingene og telles. En ubegrenset kø fylte volumet i et langt avbrudd, noe som er verre, men det er en endret standardverdi: dimensjoner den etter din egen målingsrate (omtrent 180 byte per måling) eller sett den til `0` for å beholde gammel oppførsel. En oppgradering med `--reuse-values` beholder det du hadde.
- **Megler-logins.** Logins du lager i Settings, MQTT bærer topic-regler fra en profil. Logins fra `HOTLOOP_BROKER_USERS` er urørt og kan gjøre alt, akkurat som før. En megler uten `HOTLOOP_BROKER_USERS` starter nå, og bare HotLoop og loginene laget i den slipper inn.
- Fra nå av teller appen også hvor langt foran databasen er, og nekter ved navn ved to versjoner, så en tilbakerulling aldri er en overraskelse.
- **Edge Relay:** oppgrader den også med `--reset-then-reuse-values`. Quadlet-brukere tar den nye `edge-relay.container`, som følger `:stable` i stedet for å feste 4.17.0, og healthchecken som får en dårlig oppdatering til å rulles tilbake.
- **Quadlet-enhetene for IoT, Edge og Gateway er nye.** 4.17.0 hadde bare reléets. De ligger under `deploy/quadlet/`, én katalog per produkt.
