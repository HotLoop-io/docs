---
title: "HotLoop-veikart"
description: "Hva HotLoop er, hva som gjenstår å bygge og hva som er ødelagt, i den rekkefølgen det gjøres, for HotLoop core. Flow og Cascade lenker til sine egne."
---

Hva HotLoop er, hva som gjenstår å bygge og hva som er ødelagt. Står det ikke på denne listen, blir det ikke gjort, så sett det på listen.

## Hva HotLoop er

**HotLoop er en automasjonsplattform for fabrikkgulvet, skrevet fra bunnen av i Go.** Én statisk binærfil. Ingen Python, ingen runtime å passe på, ingen privilegert container, ingen capability den ikke trenger. Entiteter, automasjoner, hjelpere, skript, en logg, dashbord, varslinger, MCP og MQTT med oppdagelse, oppå det industrielle laget: ekte PLS-protokoller, en ekte historian, ISA-18.2-alarmer, OPC UA, Sparkplug B.

Hver eneste linje er vår. Ingenting er innebygd, brokoblet eller forket, så når noe går i stykker klokka 03 om natten, er det én kodebase å lese og ingen andres feil å vente på.

HotLoop er åtte produkter for fabrikkgulvet: fire som vokser med en lokasjon (IoT, Edge, Gateway og Edge Relay), pluss Flow for kobling, Cascade for arbeidsflyter, HotLoop for CODESYS for PLS-ens egen skjerm og Transmitter for å legge verdiene fra en PLS ut på nettverket. Dette veikartet gjelder HotLoop core, de fire produktene som kommer fra én kodebase. Se [Produkter](#produkter). Flow, Cascade, HotLoop for CODESYS og Transmitter har sine egne, i <a href="/nb/flow/roadmap/">Flow-veikartet</a>, <a href="/nb/cascade/roadmap/">Cascade-veikartet</a>, <a href="/nb/codesys/roadmap/">veikartet for HotLoop for CODESYS</a> og <a href="/nb/transmitter/roadmap/">Transmitter-veikartet</a>.

## Produkter

HotLoop core er fire produkter, én kodebase, én tagg. Hver kjerneutgivelse leverer alle fire samtidig, med samme versjon, hver med sitt eget image og sitt eget Helm-chart. Du velger det som passer boksen, ikke det som tilfeldigvis har driveren du trenger.

| Produkt | Hva det er | Databaser | Status |
|---|---|---|---|
| **HotLoop IoT** | Entiteter, automasjoner, hjelpere, skript, loggen, dashbord, varslinger, MCP, MQTT med oppdagelse, ISA-18.2-alarmmotoren, sikkerhetskopier og alle drivere. Basen Edge og Gateway er bygget på | SQLite eller Postgres | Utskilt: eget image (`hotloop-iot`, amd64, arm64, arm/v7), chart og Quadlet-enheter, bygget og publisert ved hver tagg. Levert i 4.18.10 |
| **HotLoop Edge** | IoT, pluss OPC UA-serveren, lagring og videresending oppover og lokale skjermer ved maskinen | SQLite, Postgres eller TimescaleDB | Utskilt: eget image (`hotloop-edge`, amd64, arm64, arm/v7), chart og Quadlet-enheter, bygget og publisert ved hver tagg. Levert i 4.18.10 (Gateway kjører ved kanten og publiserer Sparkplug oppover siden 4.5.0) |
| **HotLoop Gateway** | Edge, pluss flåte, flere lokasjoner og planlagte rapporter. Lokasjonens hjerne | SQLite, Postgres eller TimescaleDB | Tilgjengelig |
| **HotLoop Edge Relay** | Enkel og tøff: hent, videresend, overlev. Ingen database, ingen brukerflate. Et eget produkt, ikke Edge med skjermen trukket ut | ingen | Tilgjengelig. Hver utgivelse publiserer image og chart fra 4.16.0 |

**Funksjoner skiller produktene. Protokoller gjør det ikke.** Alle produkter snakker MQTT i tillegg til alle driverne vi har. En hobbyist med en brukt S7-1200 på benken er en IoT-bruker, og IoT snakker med den PLS-en uten oppgradering.

- [x] Selve delingen, i koden. `-tags hotloop_edge` er Edge, `-tags hotloop_iot` er IoT, og begge samtidig lar seg ikke kompilere. API-rutene svarer 404 og sier hvilket produkt som har dem. `hotloop --product` og `GET /api/status` sier hvilket du snakker med
- [x] Fire images og fire charts fra én tagg, bygget parallelt, publisert til samme Helm-repositorium. Utgivelsen avviser en tagg som ett av de fire chartene ikke stemmer med. Gateway beholder `ghcr.io/hotloop-io/hotloop` og chartet `hotloop`, så ingen på 4.16 våkner med noe ødelagt
- [x] Databasen er en innstilling, ikke et image. SQLite, Postgres eller TimescaleDB, valgt ved kjøring, alle i samme binærfil. SQLite er den rene Go-varianten, uten cgo, så arm-byggene forblir statiske og en Pi trenger ikke en kompilatorkjede for å eksistere. Hele testsuiten kjører mot alle tre, for en database vi ikke tester er en database vi ikke støtter
- [x] Å flytte en lokasjon fra IoT til Edge til Gateway beholder hver enhet, tag, alarm, bruker og time med historikk: bytt image, ferdig. Å gå ned igjen sletter ingenting, funksjonene som mangler ligger bare i dvale til du kommer tilbake
- [x] En innstilling som bare gjelder Gateway, på IoT eller Edge, gir en advarsel og kjører, og den vises og lagres fortsatt i Innstillinger. Du ser nøyaktig hva du har satt og hvorfor det ikke gjør noe, i stedet for å gjette
- [x] IoT beholder 30 dager med historikk som standard. Pi-disker er små, og Gateway er stedet for lang historikk
- [x] Ingen lisensnøkler og ingen opplåsing ved kjøring. Ingen nivå er betalt. Et nivå er et image, og å gå opp er å bytte image på de samme dataene
- [x] **Hver boks følger `:stable` og oppdaterer seg selv.** Quadlet-enhetene til Gateway, Edge og IoT følger `:stable` som reléets, med Podmans automatiske oppdatering, en helsesjekk som ikke trenger shell og en tilbakerulling når det nye imaget ikke kommer opp. `release_guard.sh` avviser en utgivelse der enhetene er festet, ikke kan meldes usunne eller oppdaterer databasen sin automatisk. Databasen forblir festet til taggen chartet kjører: en PostgreSQL-hovedversjon er en dump og en gjeninnlasting, og oppdateringen av appens TimescaleDB-utvidelse går bare én vei, så i motsetning til appen kan den ikke angres. Kjørt på ekte på Gateway: en oppdatering som legger til en migrering, tatt med dataene intakte, og en som migrerer og så ikke starter, rullet tilbake. Den kjøringen er grunnen til at poden er borte: med appen i en pod startet Podman podens enhet på nytt, som kom fint opp, så en ødelagt utgivelse ble meldt som en suksess og aldri rullet tilbake. Se [Quadlet-README-en](/nb/install/auto-update/)
- [x] Lisensens omfangslinje nevner alle fire produktene, i den kanoniske lisensen og alle kopier av den. Den pleide å si Gateway, noe som uten tvil lot de tre andre stå uten noen rettighet
- [x] **Delingen ble levert i 4.18.10 sammen med MQTT-oppdagelse** (fase 4). IoTs første utgivelse finner Shelly- og ESPHome-enheter rett ut av boksen

## Automasjonsbasen

I rekkefølge. Hver fase leveres som egne, testede PR-er, og hver bygger på den forrige. Alt havner i HotLoop IoT, som betyr at alt også er i Edge og Gateway.

### Fase 1: entiteter

Fundamentet. Hver automasjon, hjelper, skript og skjerm i HotLoop snakker om entiteter, så de kom først. Slått sammen i PR 1 til 6, etter 4.15.3, og først levert i 4.16.0. Alt står i [Entiteter](/nb/iot/entities/) og i [utstyrstreet og etikettene](/nb/iot/equipment/).

- [x] Entitetsmodell: typede domener (sensor, binær sensor, bryter, tall, valg, knapp, tekst, pluss OT-domener: ventil, motor, PID-sløyfe, teller, alarm), en tilstand, attributter, stabile entitets-ID-er. Pumper, vifter, transportbånd og kompressorer er slags motorer, ikke egne domener
- [x] Sammensatt utstyr: én motorentitet bygget av taggene for start, stopp, tilbakestilling, i gang, feil og hastighet, fordi det er det en motor faktisk er
- [x] Koble eksisterende tagger til entiteter uten å ødelegge en eneste tag, API-kall, MCP-verktøy, OPC UA-node, automasjon eller enhetsfil for edge relay
- [x] Tjenester (`switch.turn_on`, `number.set_value` og lignende) som går gjennom den eksisterende skriveporten og ingen andre steder
- [x] Ett ISA-95-utstyrstre (foretak, lokasjon, område, linje, celle, enhet, utstyr), pluss etiketter. Feltene lokasjon / område / linje vi allerede har fortsetter å virke
- [x] Enheter og enhetsklasser
- [x] Entiteter i MCP, i automasjonene og i direktestrømmen, og skjermene Entiteter og Anlegg
- [x] Et `for:`-varighetsvilkår på tilstandsutløsere for entiteter («pumpen har vært av i 5 minutter»). Levert i fase 2 som `forSec` på en `state`-utløser; en pågående venting overlever ikke en omstart ([Automasjoner](/nb/iot/automations/#å-holde-en-tilstand-forsec))

### Fase 2: hjelpere, skript, scener, logg

- [x] Hjelpere: inngangs-boolsk, tall, valg og tekst; tidtakere, tellere, tidsplaner. På et fabrikkgulv er dette settpunkter og skiftplaner. Beholdes over omstarter og i sikkerhetskopier, tidtakere etter veggklokka; se [Hjelpere](/nb/iot/helpers/)
- [x] Skript: navngitte sekvenser av handlinger, som kan kalles fra automasjoner, brukerflaten og MCP. Typede felt, kjøremoduser, en prøvekjøring gjennom den ekte porten, hver skriving som `script:<id>`, i loggen og i sikkerhetskopier; se [Skript](/nb/iot/scripts/)
- [x] Scener som **oppskrifter**: fang et sett med settpunkter, bruk dem sammen, med revisjonsspor. Sjekket som helhet og avvist som helhet, aldri avkortet, skrevet i rekkefølge under én kall-ID og aldri rullet tilbake, lest tilbake fra enheten, uforanderlige versjoner, brukt fra brukerflaten, en regel, et skript eller MCP; se [Oppskrifter](/nb/iot/recipes/)
- [x] Logg: én tidslinje over hver tilstandsendring, skriving, alarm og automasjonskjøring, per entitet og per område ([Loggen](/nb/iot/logbook/))
- [x] Blueprints: gjenbrukbare automasjonsmaler. Typede inndata utenfor område avvises, aldri avkortes; en regel beholder versjonen den ble laget fra til noen gjennomgår oppgraderingen og tar den; fire innebygde; se [Blueprints](/nb/iot/blueprints/)
- [x] Automasjonsspråket: betingelses-, vente- og stoppsteg i en sekvens, og `forSec` på en tilstandsutløser («på i fem minutter»)

### Fase 3: dashbord

Her må «bedre og kulere» være åpenbart fra den andre siden av rommet.

- [x] Dashbordbygger: kort, dra og slipp, så mange dashbord du vil. Lagringer nevner versjonen de startet fra, så to personer som bygger samme side ikke kan overskrive hverandre usett; se [Dashbord](/nb/iot/dashboards/)
- [x] Skjermfiler: et dashbord lagret som en versjonert fil og importert i en annen installasjon, så en kundes skjermer er deres og aldri en del av produktet; hver manglende tag eller enhet listes og kobles før noe lagres. Se [Skjermfiler](/nb/iot/screen-file/)
- [x] Kortsett: målere, tall, trender, entitetslister, skriveknapper med bekreftelse, skriptknapper, alarmlister, markdown, kamera, en plantegning med live tagger, oppskriftsvelgere og anleggets statuslinje. Et kort styrer ingenting selv; en knapp skriver gjennom skriveporten
- [x] Dashbord per rolle og per skjerm; veggtavlen er ett av dem, i samme veksler og med de samme tildelingene
- [x] Ser likt ut på en panel-PC, en bærbar og en telefon: ett oppsett som foldes fra tolv kolonner til én, testet ved fem bredder
- [x] Nettgrensesnittet på engelsk og 13 språk til: spansk, fransk, italiensk, tysk, norsk, bulgarsk, gresk, koreansk, japansk, vietnamesisk, hindi, forenklet kinesisk og arabisk (høyre til venstre), valgt i toppfeltet og husket i nettleseren. Se [Språk](/nb/iot/languages/)
- Bygget slik at Edge-HMI-en kan lages av det: et dashbord knyttet til et skjermnavn åpnes på `/?screen=<name>` uten topptekst og uten faner
### Fase 4: integrasjoner og oppdagelse

- [x] Integrasjonsrammeverk: en integrasjon legger til enheter og entiteter, har et konfigurasjonsflyt og testes mot den ekte tingen
- [x] **MQTT-oppdagelse**: Zigbee2MQTT og ESPHome i formatet de publiserer, Tasmota i sitt eget, Shelly Gen2 og senere fra statusene den publiserer. Enheter dukker opp som lesing, på den innebygde megleren eller en annen, og ingenting armeres før en person godtar enheten og armerer hvert punkt. En Edge Relay oppdager også, bare lesing og videresending. Frigate er ikke med: MQTT-siden dens dokumenterer ingen oppdagelsesmeldinger. Alt er verifisert mot opptak fra ekte enheter, og Tasmota og Shelly også mot produsentenes dokumentasjon, ikke mot en enhet på benken. Se [MQTT-oppdagelse](/nb/iot/mqtt-discovery/) og [Edge Relay-referansen](/nb/edge-relay/reference/#discovery-41810). Delingen i fire produkter ventet på den
- [x] Nettverksoppdagelse (mDNS, SSDP, DHCP): enheter som høres på anleggets nettverk dukker opp i skjermbildet Oppdaget med hva de er og hvordan HotLoop kan snakke med dem, og en person godtar eller ignorerer hver. En OPC UA-server blir en OPC UA-enhet, en Shelly en HTTP-enhet, en ESPHome-node peker deg til MQTT; ingenting legges til av seg selv og ingenting armeres. Bare lytting som standard; sondering slås på per nettverk av utrullingen. DHCP trenger vertsnettverk og port 67, så det er av til en utrulling gir det begge. Testet mot ekte avahi, MiniDLNA og udhcpc; ennå ikke mot ekte enheter på benken. Se [Nettverksoppdagelse](/nb/iot/network-discovery/)
- [x] CODESYS, PLS-ens variabler med navnene programmereren ga dem, gjennom runtimens egen OPC UA-server: oppdagelse av det applikasjonen eksporterer, lesing og skriving, et første dashbord fra oppsettet og en gjenkobling uten hender etter en omstart eller en nedlasting. Bevist mot en 4.22.0.0-runtime i en container som kjørte HotLoops laboratorieprogram og et annet, mye større program, og på bar metall (2026-11-17). Se [CODESYS](/nb/iot/protocols/#codesys)
- [x] BACnet/IP og SNMP, bare lesing, se [Protokoller og drivere](/nb/iot/protocols/)
- [ ] ONVIF-kameraer, Shelly nativt
- [ ] **Firmata**, for Arduino-er på USB. Verifisert bare på ekte kort: Arduino-er og noen andre Firmata-enheter er på vei til benken, og en Firmata-emulator ville bare vært oss som er enige med oss selv
- [ ] UniFi, se [UniFi](#unifi)
- [x] Sol, for alt utendørs: `binary_sensor.sun_up`, solens høyde og asimut, og `sun`-utløsere ved demring, soloppgang, middag, solnedgang og skumring med en forskyvning. Beregnet på boksen fra lokasjonens breddegrad og lengdegrad med NOAAs ligninger, uten noen tjeneste, og holdt mot hver soloppgang, solnedgang og middag NOAA publiserte for 2026 på seks steder fra Utqiagvik til Quito. Se [solen](/nb/iot/sun/)
- [x] Vær. Ikke fra en sky-vær-API: HotLoop ringer ingen for å få vite at det regner. En `weather`-entitet er en stasjon på anleggets eget tak, med taggene bundet i roller (temperatur, fuktighet, trykk, vind, regn, sollys), med duggpunkt, varmeindeks og vindkjøling beregnet på boksen og holdt mot NWS-tabellene. En sensor som ikke kan leses er utilgjengelig, aldri null. Ett kort, 14 språk, og agenter bygger og leser ett over MCP. Se [Vær](/nb/iot/weather/)

### Fase 5: energi, telefoner, varslinger

- [x] Energi: kWh, gass, vann, trykkluft og kostnad per produsert enhet. Ett energidashbord, rettet mot et fabrikkgulv. En måler er en tag lest som en teller eller en effekt, lagret i 15-minuttersbolker i databasen (migrering 0029), prisfastsatt etter hvert som den telles, med en fast tariff eller en tidstariff, så en pris endret senere endrer aldri hva forrige måned kostet. Kostnaden for en produsert enhet er kostnaden delt på det en produksjonsteller telte, og «Ingenting produsert» når ingenting ble det. Energiskjermen, sensorer for hver regel, 14 språk og MCP. Et effektledd på det høyeste kvarteret (migrering 0030) og summene for et navngitt skift, fra skjermen, API-et eller en agent. Se [Energi](/nb/iot/energy/)
- [x] Nettapp som installeres på en telefon og virker uten nett
- [x] Varslinger, se under

---

## Varslinger

Webhook, e-post, ntfy, Gotify, en Discord-webhook og en Discord-bot finnes, alle på samme rørlegging. Se [Alarmvarslinger](/nb/iot/notifications/).

- [x] **Rørleggingen først:** en frekvensbegrenser per kanal, sammenslåing («7 alarmer til det siste minuttet» som én melding) og begrenset nytt forsøk som respekterer `Retry-After`
- [x] **Signerte kvitteringslenker:** en kvittering fra en telefon kommer som en ekte ISA-18.2-kvittering, og en utdatert knapp kan ikke kvittere neste gang den samme alarmen utløses. ntfy sier ikke hvem som trykket, så navnet som står på den er kanalens (`notify:ntfy`); Discord-boten setter personens

Fire kanaler. Det er listen.

- [x] **ntfy, først.** Gratis, selvhostet, virker på et anleggsnettverk uten internett (Android; iPhone trenger at serveren videresender via ntfy.sh), og handlingsknappen kvitterer alarmen rett tilbake i HotLoop over anleggsnettverket.
- [x] **Gotify.** Gratis, selvhostet, virker uten internett. Ingen kvitteringsknapp og ingen iPhone-app, så det er en personsøker, ikke toveis.
- [x] **Discord-webhook.** Lim inn en URL, ferdig. `allowed_mentions` er låst ned så et alarmnavn ikke kan nevne @everyone, og kritiske alarmer kan pinge en rolle. En webhook Discord avviser, slås av, ikke prøves på nytt til en IP-utestengelse.
- [x] **Discord-bot.** Kvitterings- og utsett-knapper rett i kanalen, styrt av Discord-roller (ingen før du navngir dem), registrert på personen som trykket. Snakker med Discord over en utgående tilkobling (Gateway), så anlegget trenger ingen offentlig adresse.
- [x] Eskalering: ingen kvitterte innen N minutter, gå og vekk neste person eller neste kanal
- Gjør vi ikke: SMS og Google Messages (RCS krever godkjenning fra operatøren per selskap og per land, og en selvhostet boks kan ikke få det), Slack, Teams, Google Chat, Pushover, PagerDuty, Telegram, Opsgenie, Signal, Matrix

---

## UniFi

Et anleggs nettverk er utstyr. Når en PLS går stille, er det første spørsmålet «er det PLS-en eller switchen», og i dag svarer du på det ved å gå til UniFi-appen. Derfor kommer UniFi inn som en **protokolldriver**, ikke et sidesystem: hver switch, port, PoE-budsjett og WAN er en tag. Det gir skriveporten, revisjonssporet, prøvekjøringen, alarmene, trendene, entitetene, automasjonene, OPC UA og MCP gratis, i stedet for å bygge halvparten av hver på nytt for én leverandør.

Det havner i IoT-basen, så alle fire produktene får det, og Edge Relay kan hente fra en konsoll som en hvilken som helst annen enhet.

### Nettverk

I rekkefølge. Ingenting her skriver til en kontroller før U5.

- [x] **U1: skrivebeskyttet driver.** Én økt per konsoll, gjenbrukt til alt, med et innloggingsbudsjett. Å logge inn ved hver sjekk fikk vår egen Cloud Gateway til å svare 429 og låse oss ute, to ganger, så HotLoop logger inn én gang og venter ut en utestengelse i stedet for å forlenge den. Konsollens sertifikat festes ved første bruk, ikke vinkes gjennom. Enheter, switchporter, PoE-trekk, WAN og failover kommer inn som tagger som synkroniserer seg selv: en switch som tas i bruk i morgen dukker opp av seg selv, og en som er borte får dårlig kvalitet i stedet for å forsvinne under alarmene sine. Den første ekte lesingen meldte 5G-reserven som oppe da den hadde vært død i to dager, fordi den stolte på det utdaterte `up` i WAN-blokken på samme måte som konsollens sammendrag. Helsesjekkene visste det, så driveren leser dem nå og en test fester det. Ferdig, se [UniFi Network](/nb/iot/unifi/)
- [ ] **U2: klienter og OT-overvåking.** Klienter identifisert etter MAC, aldri IP, fordi kontrollerens klienttabell viser adresser en maskin forlot for timer siden. Merk et nettverk som OT, godta det som er på det, og alt nytt på det utløser en alarm. Koble en HotLoop-enhet til switchporten sin én gang, og en stille PLS forteller hvilken port den sitter på og om den lenken er oppe. Boksen krysses av etter de to trinnene som trenger noen ved racket: et ekte kabeltrekk og en telefon som blir med i SCADA. Se [UniFi Network](/nb/iot/unifi/)
- [x] **U3: skjermer og topologikartet.** Oversikt med WAN-stripen (blir gul når lokasjonen går på 5G-reserven), et topologikart lagt ut på samme måte hver gang så ingenting vingler på en veggtavle, switchfronter, klienter, nettverk og WiFi. To konsoller sydd sammen til ett bilde. Klikk på en switch og se hvilke linjer på anleggstreet den mater. Kablene er konsollens egen nedlenketabell, så en switch som ingenting oppgir som tilkoblet noe, står for seg selv i stedet for å henges på gatewayen på en gjetning. Ikke sett på ekte utstyr ennå. Kartet kan klypes, dras og zoomes åtte ganger, det finnes et Anlegg-overlegg som grupperer de koblede HotLoop-enhetene under linjene sine, forsinkelsen står ved siden av hver WAN og inn og ut på en port spores, og en administrator kan lage de vanlige alarmene (enhet frakoblet, opplenke nede, gateway på reserven, PoE over en grense de oppgir) med ett trykk. Disse ble bevist 2026-10-19, med berøring emulert i stedet for på en skjerm, og en WAN-gjennomstrømningssporing er ikke bygget: ingen konsollfelt for den er lest fra en ekte gateway. Se [UniFi Network](/nb/iot/unifi/#skjermbildene)
- [x] **U4: hendelser.** Kontrollerens hendelses-websocket, så en switch som faller ut vises på sekunder i stedet for ved neste henting, og havner i loggen. Henting forblir sannheten; en død websocket koster fart, aldri korrekthet. En brutt websocket og en stille en kobler til igjen uten innlogging. Hendelser føres i loggen under switchen eller aksesspunktet de gjelder, og utstyrsfilteret finner dem fra en koblet enhet gjennom switchene som mater den. Agentverktøyene `get_network_topology` og `get_network_events` leser kartet og hendelsene. Se [UniFi Network](/nb/iot/unifi/#hendelser)
- [ ] **U5: skriving gjennom porten.** Lokaliserings-LED først: null risiko, synlig fra den andre siden av rommet, og den beviser hele skrivestien på ekte utstyr. Så PoE-modus, strømsyklus for en port, WLAN av og på, blokkering av klient og deaktivering av porten til en ukjent enhet, når den formen er bevist på en ekte kontroller og en tom port. Strømsyklus har en pause på 15 minutter per port, fordi en automasjon som syklerer en PLS annethvert minutt er slik du koker en strømforsyning. Beskyttede porter kommer fra topologien: HotLoop vil ikke sykle en opplenke eller porten som driver 5G-reserven, uansett hvem som ber. Omstart av enhet er en vanlig knapp: trykk, enheten starter på nytt, uten bekreftelse, og det revideres likevel
- [ ] **U6: selvreparasjon.** En innebygd blueprint: enhet stille i N minutter, sykle porten én gang, så alarm. Én gang, ikke for alltid

### Protect, Access og strøm

Bygget etter Ubiquitis dokumentasjon, og hver slås sammen når den er kjørt mot ekte utstyr på benken, ikke før.

- [ ] **Protect.** Kameraer som entiteter, bevegelse og smarte deteksjoner som binære sensorer og automasjonsutløsere, øyeblikksbilder på forespørsel og vedlagt alarmvarslinger. En HotLoop-alarm kan utløse en Protect-alarmutløser så kameraene tar opp. Direktevideo kommer med kamerakortet i fase 3
- [ ] **Access.** Dørposisjon, dørhendelser i loggen og opplåsing som en skriving gjennom porten. Opplåsing fra MCP er tillatt gjennom skriveporten som enhver annen skriving, og revideres som enhver annen skriving
- [ ] **SmartPower PDU.** Uttakseffekt, på, av og syklus som tagger, som mater energiarbeidet i fase 5

## Historian-mål

Den innebygde historianen blir. Oppå den skriver HotLoop historikk ut til databasene et anlegg allerede kjører, fordi IT-avdelingen har en SQL Server de tar sikkerhetskopi av og oppdaterer, og de tar ikke i bruk vår for å se en trend.

- [x] Postgres og TimescaleDB (andres, ikke den HotLoop kjører på). Se [Historian-mål](/nb/iot/historian-targets/)
- [x] SQL Server
- [x] InfluxDB (2 og 3)
- [x] MySQL og MariaDB
- [x] Et mål som er nede bremser aldri henting eller den innebygde historianen. Det tar igjen når det er tilbake, eller sier høyt hva det droppet. Det tar igjen fra HotLoops egen historikk, så en omstart midt i et utfall mister heller ingenting
- [x] Kafka-API-hendelsesstrøm: målinger og systemloggen ut til enhver Kafka-kompatibel megler, TLS og SASL, gjennom samme kø og innhenting som en database. Bevist mot Apache Kafka 4.4.0 og Redpanda 26.2.6. Se [Historian-mål](/nb/iot/historian-targets/#kafka-api-hendelsesstrøm). Ikke ennå: gjensidig TLS, Kerberos- og OAuth-innlogginger, et skjemaregister og innhenting for hendelser (de har ingen historikk å sendes fra)

---

## OPC UA PubSub

- [x] Abonner på UADP over UDP, unicast eller multicast, som en enhet (`opcua-pubsub`): Variant-, DataValue- og RawData-felt, nøkkel-, delta- og keep alive-rammer, håndtering av tapte meldinger og konfigurasjonsendringer. Se [Protokoller og drivere](/nb/iot/protocols/#opc-ua-pubsub-uadp)
- [x] Publiser tagger som UADP, i Edge og Gateway, ved siden av OPC UA-serveren
- [x] OPC UA-serveren svarer på HistoryRead fra historikken Gateway holder, rå og bearbeidet, så en klient leser en tags fortid fra HotLoop selv. Bare en variabel økten kan lese leveres. Se [OPC UA-serveren](/nb/edge/opc-ua-server/)
- [x] En CODESYS-utgiver mot den: HotLoop Transmitter 1.1.0, CODESYS-biblioteket for UADP-publisering, lest av denne abonnenten (4.19.2) mot en levende CODESYS Control for Linux SL-runtime
- [ ] Meldingssikkerhet (signerte og krypterte NetworkMessages)
- [x] Delta-rammer fra utgiveren, som et alternativ (`HOTLOOP_UADP_PUBLISH_DELTA_FRAMES`): bare de endrede feltene mellom nøkkelrammer. Se [Protokoller og drivere](/nb/iot/protocols/)
- [ ] DataSetMetaData og oppdagelsesmeldinger så en abonnent kan navngi feltene; matrise- og strukturfelt i det utgiveren sender, og strukturfelt i det abonnenten leser; hendelser
- [ ] Mot en Siemens- eller Beckhoff-utgiver, og over en ruter (multicast-ruting og TTL)

---

## Samspill med Ignition

Hvert produkt sjekkes mot den gjeldende stabile Ignition-utgivelsen, så et anlegg som kjører Ignition kobler HotLoop til det.

| Tilkobling | Status |
|---|---|
| Gateways OPC UA-klient → Ignitions OPC UA-server, sikret, innlogget | **Verifisert** (4.15.2) |
| Ignitions OPC UA-klient → Gateways OPC UA-server | **Verifisert** (27. september 2026, Ignition 8.3.9 mot 4.15.3), alle policyer Ignition tilbyr |
| Gateways Sparkplug-edge-node → Ignition MQTT Engine | Neste. Trenger modulen Cirrus Link MQTT Engine 5.x for 8.3 |
| Edge Relay → Ignition MQTT Engine | Neste, med samme modul |
| Gateway som Sparkplug-vert ← Ignition MQTT Transmission | Neste |

---

## HotLoop Edge

- [x] Eget image og chart, se [Produkter](#produkter)
- [x] Lokale skjermer og logikk som fortsetter å kjøre når opplenken er nede. En test starter den ekte Edge-binærfilen med Sparkplug-opplenken pekt mot en forbindelse som sluker alt og ikke svarer på noe, og bruker så skjermen, skriveporten, et skript, en oppskrift, en automasjon, en alarm og ntfy-varslingen på LAN, og gir forbindelsen tilbake for å se køen spilles av igjen. Det eneste som blokkerte på opplenken var starten av edge-utgiveren, og den tok hele Edge med seg ved oppstart; rettet med lagring og videresending. Selve HMI-skjermene kommer med dashbordene i fase 3
- [x] HMI-skrivinger som nevner et menneske. På din egen datamaskin er du allerede innlogget, så en skriving går rett gjennom og logger deg. Et delt kiosk-panel logger operatører inn med en PIN eller et adgangskort og ut igjen ved inaktivitet, fordi «panel-3 åpnet ventilen» ikke er et revisjonsspor
- Den første kjøringen på den gamle koden mistet 86 % av et fem minutters utfall uten et ord. Nå er rekkefølgen nøyaktig, filen holder seg under grensen sin, og hver måling grensen koster telles. Tall på Edge-publiseringssiden

## HotLoop Edge Relay

- [x] **Faktisk utgi imaget.** Utgivelsen bygde bare Gateway. Nå pusher en utgivelse også `ghcr.io/hotloop-io/hotloop-edge-relay` (amd64 og arm64) og publiserer `hotloop-edge-relay` til samme Helm-repositorium, og den avviser en tagg som relé-chartet ikke stemmer med. Den første virkelige pushen skjer med neste tagg
- [x] **Oppdateringer på avstand gjennom flåtestyring.** Hva «på avstand» ærlig kan bety er forskjellig for hver installasjon, så det er det. Et Quadlet-relé følger `:stable`, og Podmans automatiske oppdatering starter det på nytt på hver utgivelse, med en helsesjekk som får Podman til å sette det gamle imaget tilbake hvis det nye ikke kommer opp. Et sted kan velge å holde tilbake oppdateringer til en administrator godkjenner én på Gateway. Et Helm-relé oppdateres med `helm upgrade`, og dokumentasjonen sier det rett ut. Hvert relé melder sin versjon og image-digest, flåtelisten viser dem, og hver endring havner i systemloggen. Bevist med ekte kjøringer av Podmans automatiske oppdatering mot et ekte register: en oppdatering, en utgivelse som ikke kan starte rullet tilbake og en tilbakeholdt oppdatering godkjent. Ikke bygget, med vilje: signerte eller digest-festede images (Gateway kan ikke håndheve noen av delene på en boks den ikke når; Podmans pull-policy er der signaturer hører hjemme) og en trinnvis utrulling (tilbakerullingen begrenser en dårlig utgivelse, og tilbakeholdte steder gir deg rekkefølgen). Se [Edge Relay-referansen](/nb/edge-relay/reference/#oppdatere-en-relay)
- [x] **Live konfigurasjonslasting.** En pushet enhetsfil ble liggende på disken til noe startet reléet på nytt, noe som betydde å droppe meglerøkten og hver enhetsøkt for å endre én tag. Nå gjelder den i det øyeblikket den kommer: nye enheter kobler til, fjernede slipper, endrede kobler til på nytt, og resten beholder øktene sine. Sparkplug-økten og videresendingskøen blir oppe, noden fødes på nytt med sitt nye metrikksett, og en fjernet metrikk går først ut som null så ingen vert blir sittende på sin siste gode verdi. En dårlig fil avvises og den gamle fortsetter å kjøre, og `/status` sier hvilken fil som kjører og hvilken som ble avvist.

---

## Rettet i gjennomgang

Funnet i kodegjennomgang og rettet på `main`. Utgivelsesnotatene for hver versjon sier hva som endret seg for et sted i drift.

- [x] **Gjenoppretting kunne ikke laste en sikkerhetskopi fra et eldre skjema, og sjekket ikke kopiens `hotloopVersion` i det hele tatt.** Manifestet registrerer nå kolonnene i hver tabell og skjemamigreringene som er brukt. Gjenoppretting laster hver fil inn i disse kolonnene etter navn, lar nyere kolonner få standardverdiene sine, lar nyere tabeller være igjen til appen, og avviser en kopi fra et nyere skjema, eller med en kolonne denne versjonen fjernet, døpte om eller endret typen på, før en eneste rad lastes. Kopier fra før dette gjenopprettes fortsatt etter posisjon. Testet fra hvert skjemanivå som har eksistert. Rettet, se [Sikkerhetskopier og gjenoppretting](/nb/iot/backup/#gjenopprette-til-en-annen-versjon)
- [x] **Varslings-webhooken lekket URL-en sin** i feil, loggen, revisjonshendelsen og svaret fra `/api/notify/test`, og en feiltastet i oppstartsloggen. For Discord og ntfy er URL-en passordet. Rettet
- [x] siden om alarmvarslinger hevdet at den generiske webhooken virker for Discord, Pushover og PagerDuty. Det gjør den ikke, og nå sier den det. Rettet
- [x] Loggrenseren åt ordet etter `token:` i vanlige loggmeldinger. Rettet, og hver ekte legitimasjon etter disse navnene er fortsatt skjult
- [x] Et tagområde som startet på 0 viste en strek for 0 i skrive-verktøytipset: API-et utelot et minimum på null. Det sender nå alltid `minValue`, `maxValue` og `hasRange`, og `list_tags` i MCP sender området nøyaktig når det finnes ett. Rettet
- [x] Lokale testkjøringer som deler én MQTT-megler eller én Mailpit tråkker på hverandre: Sparkplug-topics kolliderer, og rapport-e-posten fra én kjøring havner i den andres postkasse. Hver test har nå sitt eget topic-navnerom, sin egen postkasse og sitt eget UniFi-sted, så parallelle kjøringer ikke kan kollidere. Rettet
- [x] Trenddiagrammer og rapporter var uenige om dårlige data: `store.HistoryBuckets` tok dårlige og usikre målinger med i gjennomsnittet, rapportene utelot dem. Begge følger nå kvalitetsregelen (README, «Kvalitetsregelen»), og en bolk uten noe godt er et hull i diagrammet. Rettet
- [x] `HOTLOOP_DB_STATEMENT_CACHE=false` brøt opprettelsen av en enhet (`invalid input syntax for type json`), og hver annen jsonb-skriving med den: på den enkle protokollen går en `[]byte` ut som bytea. Hver json-parameter går nå ut som tekst. Rettet
- [x] `writeError` gjorde hver ukjent feil til en 400, også en nedstenging og et databaseutfall. Nå er det en 500 som peker til loggraden og ikke lekker noe, og hver feil som virkelig er kallerens markeres der den oppstår. Rettet
- [x] En tidssone som ikke ville laste falt tilbake til UTC uten et ord. Nå nekter HotLoop å starte og navngir variabelen og verdien, og Innstillinger-skjermen avviste allerede en. Rettet
- [x] Rundturstesten for sikkerhetskopi dekket bare TimescaleDB-modus. Den kjører nå på hver database, og fra hver inn i de andre: SQLite til Postgres og tilbake, vanlige partisjoner til en hypertable og tilbake. Rettet
- [x] Ingen utestenging eller frekvensbegrensning ved mislykkede innlogginger. Ti gale passord eller PIN-koder låser kontoen i fem minutter, et panel bremses i stedet for å låses, og en administrator kan låse opp. Rettet, se [Autentisering og brukere](/nb/iot/authentication/#låsing-etter-feil-passord-og-pin)
- [x] Det fantes ingen skjerm for brukeradministrasjon, bare API-et. Innstillinger har nå et Brukere-kort for alle med `users.manage`: legg til en bruker, endre en rolle, slå en av, sett nytt passord, slett. Serverens egne avvisninger (den siste aktive administratoren, din egen konto) vises i dialogen slik de er. Et passord over 72 byte kom tidligere tilbake fra API-et som en 500; det er nå en 400 som sier grensen. Rettet, se [Autentisering og brukere](/nb/iot/authentication/#administrere-brukere)
- [x] Edge-publisering hadde ingen `edgePublish:`-blokk i Helm-chartet. Nå har den det: legitimasjon gjennom en Secret, køen på egen PVC, Recreate-utrullinger og en standardgjengivelse som ikke endret seg med en byte
- [x] E-post gjorde bare STARTTLS, så et relé på port 465 fikk en klartekst-hilsen og sendingen døde i håndtrykket. Port 465 er nå implisitt TLS, og `HOTLOOP_NOTIFY_SMTP_IMPLICIT_TLS` overstyrer portens oppførsel begge veier. Alarm-e-poster og planlagte rapporter begge. Bevist mot en ekte SMTP-server med en TLS-only-lytter og mot Mailpit med `--smtp-require-tls`; en kommersiell leverandørs 465 er ikke prøvd. Rettet, se [Alarmvarslinger](/nb/iot/notifications/#implisitt-tls-port-465)
- [x] Enhetslegitimasjon lå i databasen og i sikkerhetskopier i klartekst. Hver nøkkelbasert legitimasjon (hvert `password`, API-nøkkelhoder) krypteres nå med en nøkkel som holdes utenfor databasen, chartet genererer og beholder én, og en gjenoppretting avviser en kopi den ikke kan åpne med mindre den får vite at nøkkelen er borte. Rettet, se [Sikkerhetskopier og gjenoppretting](/nb/iot/backup/#enhetslegitimasjon-og-den-hemmelige-nøkkelen)
- [x] En legitimasjon skrevet inn i en enhets adresse eller et URL-alternativ (`mqtt://user:pass@host`, `?token=`) eller i fri tekst ble lagret i klartekst: hver skjerm skjulte den, databasen og sikkerhetskopiene gjorde ikke det. Enhver streng som bærer en, etter samme test som maskeringen bruker for å skjule den, forsegles nå hel, adressekolonnen inkludert, og en nøkkel som slås på senere forsegler det som ble lagret før. Rettet, se [Sikkerhetskopier og gjenoppretting](/nb/iot/backup/#enhetslegitimasjon-og-den-hemmelige-nøkkelen)
- [x] OPC UA-bla merket hver node `float` i stedet for å lese datatypen, så en tekst-tag servert tilbake gjennom vår egen OPC UA-server kom tilbake som `Bad_TypeMismatch`. Ignition 8.3.9 fanget det. Rettet (#42)
- Discover tags utelater den nå. Sett `browseServerNodes` på enheten for å få den tilbake, eller pek `browseRoot` på `i=2253` for å se inni den med vilje. Rettet
- [x] OPC UA X.509-brukertokener, klient og server. Et sertifikat en administrator knytter til en bruker (Innstillinger, API-et, MCP) logger en klient inn på vår OPC UA-server som den brukeren, med brukerens tillatelser; tilbakekalling virker, og hver innlogging og avvisning står i loggen. Av til `HOTLOOP_OPCUA_SERVER_ALLOW_X509` er satt. Enhetsdriveren logger inn på samme måte med `userCertificate` og `userPrivateKey` (RSA, nøkkelen forseglet som et passord). En betrodd CA med en navneregel er ikke bygget; se [OPC UA-serveren](/nb/edge/opc-ua-server/#x509-brukersertifikater)
- [x] Vår OPC UA-server tilbød alltid de utdaterte policyene `Basic128Rsa15` og `Basic256`. Av som standard nå, med `HOTLOOP_OPCUA_SERVER_ALLOW_DEPRECATED_POLICIES` for å slå dem på igjen for en eldre klient; med den av er de ikke listet og en kanal som ber om en avvises. Rettet i en kopi av biblioteket
- [x] Chartet fester TimescaleDB 2.29.1; 2.30.1 er ute. Hevet, testene kjører på samme versjon, og utvidelsen i en eksisterende installasjon oppdateres nå faktisk ved oppstart i stedet for å bli på den gamle versjonen for alltid
- [x] Edge-utgiveren kunne publisere NBIRTH før den abonnerte på NCMD, noe Sparkplug B 3.0 avsnitt 5 forbyr, så en verts umiddelbare Rebirth eller Reboot ble droppet. Fleet hadde samme hull ved lytting etter fødsler. Rettet
- [x] Sparkplug vil ha NBIRTH og NDATA på QoS 0 og vi publiserte dem på QoS 1, fordi en PUBACK var det eneste beviset på at megleren tok en måling før videresendingskøen slapp den. Nå går de ut på QoS 0, NDEATH-testamentet blir på QoS 1, og en bit forlater disken først etter at megleren har svart på en forespørsel sendt bak den, noe som på én ordnet tilkobling beviser at den leste alt foran. En QoS 0-skriving inn i en død forbindelse er nå en test: uten den bekreftelsen forlot alle 30 målingene disken. MQTT-klientbiblioteket sender heller ikke lenger noe på nytt inn i neste økt, fordi edge-utgiveren gjør sin egen gjenkobling på en ren en
- Driveren faller nå tilbake til hentede lesinger når et nytt abonnement forblir stille. Rettet
- [x] Samme bibliotek: hvis publiseringssløyfen stoppet etter at verdier hadde kommet, fortsatte driveren å servere de siste verdiene som gode, fordi biblioteket skjuler keep-alives. Etter en stille periode leser driveren nå nodene og sammenligner, og faller tilbake til lesinger når serveren holder noe abonnementet burde ha sendt. Selve race-tilstanden, som ligger i biblioteket, må fortsatt rapporteres oppstrøms. Rettet
- [x] **En loggers «ingen data»-koder leste som gode målinger.** En Yokogawa DX-kanal som ga tilbake 0x8005 (udefinert) på `input:1:int16` med skala 0.1 kom tilbake som god, -3276.3, og ble historisert som en temperatur. En tag lister nå de rå verdiene som betyr «ingen måling», hver med en grunn; én sjekkes før skala og forskyvning og leses som dårlig med grunnen, og utløser aldri en verdialarm. Modbus sjekker registerets bitmønster (hver heltallsbredde, byte- og ordrekkefølge, flyttallsmønstre i hex), og hver annen driver som dekoder et tall sjekker den samme listen. Bevist mot en Modbus-server som ikke er vår, med alle åtte DX-kodene. Rettet, se [Protokoller og drivere](/nb/iot/protocols/#verdier-uten-data)
- [x] En Modbus-enhet som ble stille med åpen socket (trukket kabel, hengt PLS) ble merket degradert, ikke nede, og entitetene satt på sin siste verdi til TCP ga opp. Nå er den nede innen én henting pluss to ganger tidsavbruddet. Rettet
- [x] S7comm og EtherNet/IP hadde samme tidlige retur når en henting gikk tom for tid, så en PLS som ble stille med åpen socket ble degradert i stedet for nede. Begge slutter nå å lese og vurderer økten, slik Modbus gjør. Bevist gjennom hentesløyfen med en lesing som blokkerer til fristen (den feiler med den gamle returen og består med rettelsen, og en PLS som svarer på noen blokker forblir oppe), ikke på ledningen. Rettet
- [x] Testene for stille S7comm- og EtherNet/IP-enheter over drev hentesløyfen, ikke en socket. De kjører nå på en: testene starter en S7-server i prosessen (ISO-on-TCP-tilkobling, kommunikasjonsoppsett, lese variabel) og en CIP-server (RegisterSession, forward open, en tilkoblet lesing og multiple-service-lesingen), som hver svarer fra en tabell og blir stille på kommando, og driverne henter fra dem over TCP. En stille PLS er nede innen én henting pluss to ganger tidsavbruddet, en som svarer på noen blokker forblir oppe, og tilbakerulling av den tidligere rettelsen får dem til å feile. Rettet
- [x] **En EtherNet/IP-enhet med to eller flere tagger i en batch fikk henteløkken til å panikke.** Driveren leste en batch gjennom bibliotekets `ReadMulti`, som tar en struct av taggede felt eller et map, og gitt et tagnavn panikker den i reflect før noe sendes. Det kom aldri frem fordi ingen test kjørte en batch mot en server. Batchen går nå gjennom `ReadList`, og en kontroller som ikke svarer blir ikke lenger spurt på nytt tag for tag, noe som holdt hentingen i et tidsavbrudd per tag. Rettet
- [x] **En Pin fra en side åpnet på Tags lagret et brett av én tag over det ekte brettet.** Siden leste bare brettet når Brett-skjermen åpnet, så en omlasting på `#tags` hadde en tom liste og den første Pin erstattet anleggets brett med den ene taggen. Siden leser nå brettet når den starter, Pin og Unpin nekter til den har det, og en lagring bærer brettets `rev`: serveren avviser en lagring over et brett som er endret siden det ble lest (en `409`), så en utdatert fane kan heller ikke gjøre det. Rettet, se [HTTP-API-et](/nb/iot/api/#get-apiboard)
- [x] **MCP ble levert med skriving av.** Serveren var på, men `allowMcpWrites` var false som standard i koden og i alle tre chartene, så en agent kunne lese anlegget og ikke noe mer, og å slå det på betydde også å sette en andre bryter som hovedbryteren allerede dekker. MCP leser og skriver nå i hvert HotLoop-produkt: core og Flow leveres på med skriving, og Cascades vil gjøre det samme når det er bygget. `allowMcpWrites` er true som standard og følger `allowWrites`, som forblir hovedbryteren for brukerflaten, API-et og agenter likt (av som standard); en brukers tillatelser, en tags skrivbar-merke og dens område gjelder for en agent som for skjermen. Dokumentasjonen ber ikke lenger noen kjøre en skrivebeskyttet agent. Rettet, se [MCP](/nb/iot/mcp/#skriving)
- [x] **MCP kunne lese det meste av det den ikke kunne endre.** Tjuesju verktøy styrte utstyr, kjørte skript og brukte oppskrifter, og en blueprint kunne forhåndsvises men aldri gjøres om til en regel, en alarm kunne kvitteres men ikke utsettes, og ingen enhet, tag, hjelper, regel, skript, oppskrift, dashbord eller UniFi-nettverk kunne lages eller endres i det hele tatt. Sekstifire verktøy gjør det nå, og førtito til når administratorens egne funksjoner (brukere, innstillinger, sikkerhetskopier, eskalering, historian-mål, megler-innlogginger, flåten, rapporter), hvert en rute i API-et kjørt gjennom sin egen handler med tillatelsen den ruten ber om, en grunn og agenten i loggen. Skrivebryterne tilhører utrullingen og har ingen rute, så innstillingsruten avviser dem for en agent som for en skjerm. Rettet, se [MCP](/nb/iot/mcp/#endre-konfigurasjon)
- [x] **MCP kunne ikke ta inn en CODESYS-alarmeksport, lese tilbake det meste av det den endret eller sjekke en body før lagring.** Alarmskjermen importerer en CODESYS Export Alarms-fil, og den eneste måten å gjøre det fra en agent var curl. `import_codesys_alarms` forhåndsviser og bruker den gjennom samme rute, med en grunn ved bruk. Tjuefire lesinger står nå ved siden av skrivingene de hører til (alarmdefinisjoner, dashbord, brettet, utstyrstreet, etiketter, oppdagede enheter, nettverksfunn, meglere, integrasjoner, blueprints, skript, kjøringer, UniFi-konsollene og nettverkene deres), og `validate_automation`, `validate_script` og `browse_device` er redigerernes prøvekjøringer. En kaller skriverollen utelater kan gjøre de vanlige lesingene og ingenting annet. Ett hundre og sekstitre verktøy. `screen_export` og `screen_import` bærer en skjerm mellom installasjoner, importen er en prøvekjøring med mindre noe annet sies. Rettet, se [MCP](/nb/iot/mcp/#lesinger-og-prøvekjøringer)
- [x] MCP-endepunktet var åpent for alle som kunne nå porten når ingen `HOTLOOP_MCP_TOKEN` var satt (hvert chart setter en; en bar binærfil eller en Quadlet-enhet gjorde det ikke), og prosessen sa det bare i loggen sin. Den lager nå et token ved første oppstart og beholder det i databasen sin, `hotloop mcp-token` skriver det ut, og et kall uten det får en `401`. Bevist mot den bygde binærfilen: ingen token 401, et galt 401, det riktige 200, det samme etter en omstart. Rettet, se [MCP](/nb/iot/mcp/)
- [x] **Fronten på en 8-ports switch gjorde hele siden omtrent 115 px bredere på en telefon.** Hver kolonne ba om 54 px, så de åtte var bredere enn skjermen og toppfeltet og hvert kort gled sidelengs med dem. En port er nå en stram 34 px-flis, PoE-wattene flyttet fra flisen til portens detalj og verktøytipset (lynet markerer PoE på flisen), og hvis en front noen gang vokser ut av kortet sitt, ruller den inni det. En nettlesertest gir sidens egen frontkode åtte porter ved 390 px: 113 px bredere før, siden nøyaktig like bred som vinduet etter. Rettet

- [x] **En UniFi-skjerm kunne tegne et tall eldre enn sporet ved siden av.** Den gamle skjermens Oversikt og en ports detalj på begge skjermene ba om tallet og så om sporet, så en måling som kom imellom satt i sporet og ikke i tallet («5 ms» ved siden av en linje som endte på 6). De ber om sporene først nå. Bevist i en nettleser: den gamle rekkefølgen feiler testen, den nye består den, og den gamle feiler den igjen. Rettet
- [x] **Et Kafka- eller Redpanda-mål der megleren nektet skriving på grunn av diskmangel sa bare «records have timed out».** Etter et tidsavbrudd spør målet megleren én gang hvorfor, med en produce uten poster, og sier svaret (Redpanda under sin grense for ledig plass: `KAFKA_STORAGE_ERROR`, disken under megleren). Målingene gikk aldri tapt: de er skyldt og sendes når megleren tar imot skriving igjen. Bevist mot Redpanda med grensen satt over disken, og mot en fungerende Redpanda og Apache Kafka for å si ingenting. Rettet

## Sist: et moderne brukergrensesnitt

Dette kommer etter alt annet på denne siden, med vilje. Et nytt brukergrensesnitt er det morsomste å bygge og den enkleste måten å bruke et kvartal på mens anlegget fortsatt ikke kan det det trenger. Så det venter, og ingenting over utsettes for det.

- [x] **Skriv om nettgrensesnittet til HotLoop IoT, Edge og Gateway i Astro,** det samme rammeverket HotLoop-nettstedet er bygget med. Det bygges til statiske ressurser som bygges inn i den ene Go-binærfilen, nøyaktig som grensesnittet nå, så hvert produkt leveres fortsatt som ett image uten noe å installere ved siden av. Ingen Node på boksen, ingen andre prosess, ingen CDN. Målet er et moderne grensesnitt i hvert HotLoop-prosjekt, ett utseende og ett sett deler i stedet for en skjerm per epoke
- [x] **Et designarbeid kommer først.** Før en eneste komponent skrives: skjermene, navigasjonen, hvordan en alarm ser ut klokka 03 om natten på en telefon, og ett designsystem nettstedet og hvert produkt deler. Å skrive om skjermer uten det flytter bare rotet inn i et nyere rammeverk
- [x] **Ingenting går bakover.** Hver skjerm nettlesertestene styrer i dag fortsetter å virke og å bli styrt, og API-et endres ikke for grensesnittets skyld. En omskriving som mister en skjerm noen bruker på gulvet er ikke ferdig

### Hvor det står

Ferdig, og standard. Nettgrensesnittet bygges fra `web/` (Astro, Svelte-øyer, statiske filer innebygd i den ene binærfilen, ingen Node på boksen) og er det `/` serverer på hver installasjon. Det gamle grensesnittet og malene er borte; `/next` omdirigerer til roten for alle som hadde det som bokmerke.

- [x] Designarbeidet: HotLoops kanoniske tokens, det offisielle merket, fire grupper med skjermer (Betjene, Anlegg, Bygge, System) med en rail på en pult og en linje med fem faner på en telefon
- [x] Telefonappen i det nye grensesnittet: kan installeres, beholder siden og de siste svarene, åpnes uten nett merket som gammel, nekter å sende noe, og et første besøk uten tilkobling sier det på innloggingsskjermen
- [x] Hver skjerm likeverdig med den gamle, bevist i en nettleser
- [x] Nettlesertestene som består mot det nye grensesnittet uendret, så ble det nye grensesnittet standard og `assets/` forsvant
