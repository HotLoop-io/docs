---
title: "UniFi-nettverk"
description: "Svitsjer, porter, PoE, WAN-failover og klienter fra en UniFi-konsoll som vanlige tags, med skjermbilder, hendelser og kommandoer som er av til du slår dem på."
---

Nettverket på et anlegg er utstyr. Når en PLS blir stille, er det første spørsmålet «er det PLS-en, eller porten på svitsjen den er koblet til», og til nå lå svaret i UniFi-appen på telefonen til noen. Derfor leser HotLoop selve UniFi-konsollen: hver svitsj, hver port, PoE-forbruk, WAN-lenkene og helsen til lokasjonen, som vanlige tags. Da fungerer alarmer, trender, entiteter, automasjoner, OPC UA og MCP på dem uten å vite at UniFi finnes.

Dette er driveren, OT-overvåkingen som bygger på den, skjermbildene, hendelsesstrømmen og de første kommandoene (U1 til U5 i [veikartet](/nb/roadmap/)). **Den leser nettverket, og endrer det bare når en person har armert en tag for det.** Hver tag lages skrivebeskyttet. De få punktene som er kommandoer (nedenfor, «Kommandoer») går gjennom skrive-porten som alle andre tags: ingenting sender en før noen markerer den taggen som skrivbar, og en konsollkonto som er View Only blir avvist av selve konsollen. For alt unntatt kommandoene kan kontoen den bruker være View Only.

## Legge til en konsoll

Én HotLoop-enhet er **én lokasjon på én konsoll**. Cloud Gateway og Express bak den er to konsoller, altså to enheter, med to innlogginger, fordi hver konsoll har sine egne lokale kontoer.

1. **Opprett en lokal konto på konsollen.** Settings, Admins & Users, Add Admin, huk av **Restrict to Local Access Only**, rolle **View Only**. En Ubiquiti-skykonto kan bare logge inn fra appen: den krever MFA, og konsollen svarer et skript med 403. Vår heter `hotloop-ro`.
2. **Legg til enheten.** Protokoll `unifi`, adresse konsollens URL: `https://host` for en konsoll som kjører UniFi OS (Cloud Gateway, Dream Machine, UniFi OS Server), `https://host:8443` for den selvdrevne Network Application. Et pollingintervall på 15 s er passe; driveren leser aldri en konsoll oftere enn hvert 10. sekund, uansett hva den er satt til.
3. **Lagre uten fingeravtrykk.** Den første tilkoblingen feiler, med vilje, med fingeravtrykket til sertifikatet konsollen viste frem. Sjekk at det er din konsoll (konsollen viser sertifikatet sitt, eller `openssl s_client -connect host:443` sendt gjennom `openssl x509 -pubkey -noout | openssl pkey -pubin -outform der
   | sha256sum` gir det samme), lim det inn i `certFingerprint` og lagre.
4. Taggene opprettes av seg selv ved neste polling. Se nedenfor.

En UniFi-enhet kan bare lagres når HotLoop har en nøkkel å kryptere passordet med (`HOTLOOP_SECRET_KEY_FILE`, som chartet setter opp selv). Se [Sikkerhetskopier og gjenoppretting](/nb/iot/backup/#enhetslegitimasjon-og-den-hemmelige-nøkkelen).

| Valg | Standard | Hva det gjør |
|---|---|---|
| `site` | `default` | Kortnavnet på lokasjonen, det som står i konsollens URL-er. `default` er den første lokasjonen på hver konsoll |
| `username`, `password` | påkrevd | Den lokale kontoen. Passordet er skrivbart men ikke lesbart gjennom API-et og er kryptert i databasen |
| `certFingerprint` | ingen | SHA-256 av den offentlige nøkkelen i konsollens sertifikat, som hex. Kolon, mellomrom og store bokstaver går fint |
| `caFile` | ingen | Stol på en CA i stedet for en pin, for konsoller med ekte sertifikater |
| `insecureSkipVerify` | `false` | Stol på ethvert sertifikat. For en testbenk, aldri for et anlegg |
| `clientTimeoutSec` | `90` | Hvor lenge etter at konsollen sist så en klient den fortsatt regnes som på nettverket. Minimum 30. Se [klienter](#klienter-ot-nettverk-og-hvor-en-pls-er-koblet-til) |

### Hvorfor sertifikatet pinnes

Konsoller leveres med selvsignerte sertifikater, og det late svaret er å hoppe over verifiseringen. Det går fint for å lese en måler. Det går ikke for en innlogging som kan se hele anleggsnettverket og, fra skrive-PR-ene og utover, slå portene av og på. En pinnet konsoll som viser et annet sertifikat blir avvist under TLS-håndtrykket, **før brukernavn eller passord sendes**, og feilen nevner begge fingeravtrykkene. Pinnen sitter på den offentlige nøkkelen, så en konsoll som utsteder sertifikatet på nytt med samme nøkkel fortsetter å virke.

Det finnes ingen stille «trust on first use». Det eneste øyeblikket det betyr noe å stole på et sertifikat, er når et menneske ser på det, og det er da det skjer.

## Innlogginger: én gang, og ikke igjen med mindre det må

Å logge inn ved hver sjekk fikk vår egen Cloud Gateway til å svare 429 og låse kontoen. To ganger. Derfor:

- **Én sesjon per konsoll per prosess.** Hver polling, og hver lokasjon på konsollen, bruker samme innlogging. To enheter for to lokasjoner på én konsoll med samme konto er én sesjon.
- **Den logger inn på nytt bare når konsollen sier at sesjonen er borte** (401), én kaller om gangen, og **aldri oftere enn én gang i minuttet**, uansett hva som skjer. En sesjon som dør to ganger i løpet av ett minutt gjør at enheten leser dårlig til minuttet er over, og det er avveiningen vi vil ha.
- **En avvist innlogging prøves ikke på nytt.** Feil passord, en skykonto eller en 429-sperre venter minst fem minutter, lenger hvis konsollens `Retry-After` sier det, og enhetens feil sier hvilken det var. Å slå enheten av og på kjøper ikke et nytt forsøk: prosessen husker det.
- **Den logger ut** når den siste enheten som bruker en konsoll stopper, så omstarter ikke hoper opp sesjoner på konsollen.
- **En `--mcp-stdio`-hjelper logger aldri inn.** Den kjører ved siden av Gateway, som allerede har sesjonen, og en ekstra innlogging fra samme boks er akkurat det som gir 429. UniFi-enhetene dens står nede der mens de kjører i Gateway.

## Tags

Hver tag lages av driveren, er skrivebeskyttet til en person armerer den, og navngis etter MAC-adresser og portnumre, aldri visningsnavn, så å gi en svitsj nytt navn i UniFi-appen ødelegger ingenting. `<mac>` er enhetens MAC med små bokstaver uten skilletegn, `<nn>` portnummeret med to sifre.

| Tag | Type | Hva det er |
|---|---|---|
| `d.<mac>.state` | tekst | `connected`, `disconnected`, `pending`, `upgrading`, `provisioning`, `heartbeat_missed`, `adopting`, ... |
| `d.<mac>.online` | bool, connectivity | Koblet til konsollen |
| `d.<mac>.uptime_s` | int, s | Oppetid |
| `d.<mac>.cpu_pct`, `.mem_pct` | float, % | CPU og minne |
| `d.<mac>.temp_c` | float, °C | Temperatur, på enheter som har en sensor |
| `d.<mac>.clients` | int | Klienter som er koblet til gjennom den |
| `d.<mac>.fw` | tekst | Fastvareversjon |
| `d.<mac>.wan<N>.up` | bool, connectivity | WAN N er **i live** etter gatewayens egne helsesjekker (`last_wan_interfaces`, deretter `last_wan_status`). Ikke `up` i WAN-blokken, som betyr konfigurert. En konsoll som ikke gir noen av dem, leser dårlig, aldri oppe |
| `d.<mac>.wan<N>.latency_ms` | float, ms | Forsinkelsen, god bare så lenge WAN er i live |
| `d.<mac>.wan<N>.availability_pct` | float, % | Tilgjengelighet etter gatewayens egne overvåkere over vinduet (ett døgn), når den rapporterer en |
| `d.<mac>.wan.active` | tekst | Hvilken WAN som bærer trafikken: opplenkens WAN hvis den lever, ellers den første som lever, `none` hvis ingen gjør det |
| `d.<mac>.wan.failover` | bool, problem | Trafikken går over noe annet enn den første WAN-en: anlegget er på reserven |
| `p.<mac>.<nn>.up` | bool, connectivity | Portens lenke |
| `p.<mac>.<nn>.speed_mbps` | int, Mbit/s | Lenkehastighet; 0, god, på en port uten lenke |
| `p.<mac>.<nn>.rx_bps`, `.tx_bps` | float, bit/s | Trafikk |
| `p.<mac>.<nn>.errors` | int | Mottaks- pluss sendefeil |
| `p.<mac>.<nn>.poe_w` | float, W, power | PoE-forbruk, på porter som kan levere PoE |
| `p.<mac>.<nn>.poe_mode` | tekst | `auto`, `off`, `pasv24`, `passthrough` |
| `site.<subsystem>.status` | tekst | Helsen til lokasjonen: `wan`, `www`, `lan`, `wlan`, `vpn` |
| `site.www.latency_ms` | float, ms | Internett-forsinkelse, når den rapporteres |
| `site.network_version` | tekst | Network-versjonen konsollen kjører |
| `site.events_live` | bool, connectivity | Konsollens hendelses-websocket er tilkoblet. 0 betyr at HotLoop bare poller, noe som koster fart og ingenting annet |
| `site.last_event` | tekst | Den nyeste hendelsen konsollen rapporterte på lokasjonen, med sine egne ord |
| `d.<mac>.last_event` | tekst | Den nyeste hendelsen om den enheten. Tom til den har hatt en |

Enhetsklassene går videre til entitetene, så en ports lenke kommer ut som en binær tilkoblingssensor og PoE-forbruket som en effektsensor uten at noen setter det opp.

**Tags legger seg til selv og forsvinner aldri av seg selv.** En svitsj som adopteres neste uke dukker opp som tags ved neste polling, på samme sesjon, uten at noe startes på nytt. En svitsj som er koblet fra, leser `online` 0 og portene får dårlig kvalitet, så en alarm på den sier det i stedet for å forsvinne sammen med den. Å slette taggene er en persons avgjørelse. En tag som noen har slått av, forblir av: driveren har ingen stemme.

Bare adopterte enheter får tags. En svitsj som noen har koblet til og ingen har adoptert, er ikke en del av anleggets nettverk ennå. Et punkt konsollen ikke rapporterer, leser dårlig, aldri en funnet opp null: en svitsj som ikke rapporterer PoE-forbruk, har `poe_w`-taggene sine dårlige.

Edge Relay kan også polle en konsoll. Den leser taggene enhetsfilen deklarerer og legger ikke til noen, fordi den ikke har noe sted å lagre dem.

## Kommandoer

Fem typer punkter er kommandoer. Hver lages skrivebeskyttet som alle andre tags, og gjør ingenting før noen markerer den som skrivbar. Kontoen HotLoop logger inn med, må være lokal Administrator for disse; som View Only svarer konsollen HTTP 403, HotLoop sier det, og ingenting endres.

| Tag | Skriv | Hva konsollen gjør |
|---|---|---|
| `d.<mac>.locate` | `true` eller `false` | Blinker enhetens LED til den slås av. Leser tilbake det konsollen sier. |
| `d.<mac>.restart` | `true` | Starter enheten på nytt neste gang den melder seg. `false` gjør ingenting. Leser 0. |
| `p.<mac>.<nn>.power_cycle` | `true` | Slår portens PoE av og på. `false` gjør ingenting. Leser 0. |
| `w.<id>.enabled` | `true` eller `false` | Slår et trådløst nettverk på eller av. Bare det feltet sendes, så passordfrasen og alle andre innstillinger blir. `<id>` er konsollens id for nettverket, som ikke endres av å gi det nytt navn. |
| `c.<mac>.blocked` | `true` eller `false` | Blokkerer en overvåket klient fra nettverket, eller slipper den inn igjen. Punktet finnes for en klient konsollen har sett. |

En strømsyklus kan skade et anlegg (en automasjon som slår en PLS av og på hvert andre minutt koker strømforsyningen), så to regler gjelder uansett hvem som ber om det: en port sykles høyst én gang per 15 minutter (tidspunktet for siste syklus lagres i databasen, så en omstart glemmer det ikke, og en syklus der tidspunktet ikke kan sjekkes, avvises), og en port som bærer nettverket sykles aldri. Det er en opplenke, og enhver port annet utstyr henger på, etter konsollens egen topologi; porten som forsyner en 5G-reserve er en av dem. Et avslag sier hvilken regel det var. En kommando konsollen selv avviser, bruker ikke opp ventetiden.

## Klienter, OT-nettverk og hvor en PLS er koblet til

To oppgaver, begge skrivebeskyttet.

**Hvor er den koblet til.** En PLS blir stille, og det første spørsmålet er om det er PLS-en eller svitsjporten. Koble HotLoop-enheten til klienten sin på nettverket én gang, så sier skuffen «på USW Lite 8 PoE port 5, lenke nede» før noen åpner UniFi-appen. Koblingen gir også klient-tags på konsollens enhet, så portens tilstand går i trend og alarm ved siden av Modbus-verdiene som stoppet.

**Hva som er på SCADA-nettverket.** Marker et nettverk som OT, godta det som hører hjemme der, og alt annet som dukker opp, gir en alarm som nevner det. Noen kobler en laptop til SCADA-svitsjen klokken 2 om natten, du vet det klokken 2 om natten.

### Ingenting identifiseres med IP

Konsollens klientliste henger etter. Derfor:

- **En klient er MAC-en sin.** Koblingen foreslår en klient etter IP, fordi det er det du vet om PLS-en din, men en person bekrefter den én gang, og fra da av er MAC-en nøkkelen. IP-taggen sier at det er konsollens oppfatning.
- **Online betyr ikke «i listen».** En klient er online når konsollen så den innenfor `clientTimeoutSec` (90 s) **og**, for en kablet, svitsjporten dens har lenke. Porten er den raske halvdelen: trekk ut kabelen, og porten leser nede ved neste lesing, mens listen fortsatt henger etter.

### Koble til en enhet

Åpne en enhets skuff. Hvis en UniFi-konsoll HotLoop leser, lister en klient på enhetens IP, foreslår Network-delen den; en administrator klikker **Link**. Ingen IP å gå på (en enhet adressert med navn): koble den med MAC. Eller gjennom API-et, `PUT /api/devices/{id}/network`, se [HTTP-API-et](/nb/iot/api/#put-apidevicesidnetwork).

Klienten til en tilkoblet enhet får tags og en alarm, **«PLC-07 off the network»**, prioritet 1, med 120 s på-forsinkelse så en PLS som starter på nytt ikke varsler noen.

### OT-nettverk og listen over kjente

Marker et nettverk som OT (`PUT /api/unifi/{id}/networks/{network}` med `{"ot": true}`), og godta så det som er der: alt slik det er nå i ett kall (`POST .../accept-all`), eller én enhet om gangen. Markeringen lager alarmen **«Unknown device on SCADA»**, prioritet 1, på `n.<network>.unknown`. Den nyeste fremmede nevnes i `n.<network>.unknown_last`, med MAC, hva den kaller seg selv, IP-en og svitsjporten eller SSID-en den kom inn på.

En kjent enhet kan **overvåkes** (`"watch": true`): den får de samme taggene og den samme alarmen for «borte fra nettverket» som en tilkoblet. En PLS overvåkes. En vedlikeholdslaptop som er tillatt men kommer og går, er kjent og ikke overvåket, ellers varsler den noen hver gang den drar.

Alarmene er vanlige alarmdefinisjoner. Utsett dem, kvitter dem, send dem til Discord, endre forsinkelsen. Fjern overvåkingen, koblingen eller OT-markeringen, så fjerner HotLoop alarmen den lagde for den, så en tag ingen leser lenger, holder ikke en alarm åpen. En som en administrator har skrevet for hånd, røres aldri.

Oppføringen tilhører HotLoop, i HotLoops egen database (`unifi_networks`, `unifi_known`, `unifi_links`, alle i sikkerhetskopiene), aldri konsollen. En endring når den kjørende driveren ved neste lesing, på sesjonen den allerede har: den starter ikke enheten på nytt, fordi en omstart logger ut og budsjettet på én innlogging i minuttet da ville holde den ute i et minutt.

### Taggene

| Tag | Type | Hva det er |
|---|---|---|
| `n.<network>.clients` | int | Klienter på nettverket nå, online etter testen over. Hvert LAN-nettverk får en |
| `n.<network>.unknown` | int | På et OT-nettverk: online klienter som ikke står på listen over kjente |
| `n.<network>.unknown_last` | tekst | Den nyeste av dem, i ord. Tom når det ikke er noen |
| `c.<mac>.online` | bool, connectivity | Overvåket eller tilkoblet klient på nettverket |
| `c.<mac>.ip` | tekst | IP-en, slik konsollen sist så den |
| `c.<mac>.sw_mac`, `.sw_port` | tekst, int | Svitsjen og porten en kablet klient er på. Beholdes etter at kabelen er trukket ut: hvor den *var* er poenget |
| `c.<mac>.port_up` | bool, connectivity | Lenken på den porten. Dårlig når selve svitsjen har falt ut av konsollen, for da vet ingen |
| `c.<mac>.last_seen_s` | int, s | Sekunder siden konsollen sist så den |

`<network>` er konsollens ID for nettverket, så å gi SCADA nytt navn i appen ødelegger ingenting. Et nettverk markert OT som konsollen siden har slettet, leser dårlig med den grunnen, aldri en stille null. En klient konsollen aldri har sett, leser `online` 0 og resten dårlig, og sier det.

Bare overvåkede og tilkoblede klienter får `c.*`-tags. Et gjestenettverk med 300 telefoner som kommer og går, lager ikke 300 tag-sett.

### Lese uten å spørre konsollen

`GET /api/unifi/{id}/networks`, `/clients` og `/known`, skuffen og MCP-verktøyet `find_network_client` leser alle driverens siste lesing. Ingen av dem gjør en egen forespørsel, så et skjermbilde som står åpent, eller en agent som spør i en løkke, koster konsollen ingenting og kan ikke være det som gir 429. Baksiden: en `--mcp-stdio`-hjelper, som aldri logger inn, sier at det ikke finnes noen konsolllesing i prosessen sin.

## Skjermbildene

UniFi-fanen har seks visninger og en konsollvelger. Alt på den er driverens siste lesing av konsollen, så å la den stå åpen koster konsollen ingenting og kan ikke være det som gir 429. Den spør HotLoop på nytt hvert par sekunder, og tegner bare om når noe har endret seg, så et kart noen har rullet til hjørnet blir stående der de la det.

- **Oversikt.** Ett kort per konsoll. Øverst på en gateways kort er WAN-stripen: ett segment per WAN, grønt når gatewayens egen helsesjekk sier at det lever, rødt når det ikke gjør det, og det som bærer trafikken har kontur. Når lokasjonen går på en reserve, blir hele stripen gul og sier hvilken og siden når. Det «siden» er når HotLoop først leste det slik, ikke når gatewayen byttet, og en HotLoop som startet mens lokasjonen allerede var på 5G, sier det fra sin egen start. Vi skriver ikke ut et klokkeslett vi ikke har. Under: enheter online, kablede og trådløse klienter, klienter per nettverk, enhetene konsollen har mistet og de siste hendelsene. En WAN konsollen ikke sier noe om, er grå og sier «no liveness reported», aldri grønn. Hver WAN som rapporterer en forsinkelse har et spor ved siden av tallet, den samme linjen entitetsflisene tegner, fra HotLoops eget buffer for den taggen. En administrator får **Create the usual alarms** nederst på kortet, se [startalarmene](#startalarmene).
- **Kart.** Fra venstre til høyre fra gatewayen. Det tegnes likt hver gang (et ryddig tre, ingen fysikk, samme innlesing og samme piksler ut), så det hopper ikke på en veggtavle. Kablene er konsollens egen `downlink_table`: en svitsj er koblet til en annen bare fordi konsollen sier det. En enhet ingenting lister som koblet til noe, står for seg selv og sier «no uplink listed». Vi henger den ikke på gatewayen på en gjetning for så å ta feil om hvor PLS-nettverket går. Kablede klienter sitter på svitsjen og porten konsollen lærte dem på, trådløse på AP-en og SSID-en sin, talt i en brikke på kortet. Klikk på en enhet, og alt som ikke er nedstrøms fra den, dempes, og sidepanelet lister det som er det, klientene dens og linjene i Plant-treet den mater: HotLoop-enhetene som er koblet til en klient under den, hver med utstyrsbanen den står på. Kartet zoomer og flyttes: klyp med to fingre, dra med én, ctrl og rulling eller klyping på en pekeplate rundt pekeren, eller knappene pluss, minus og Fit, fra hele kartet og opp til åtte ganger. Det er ren SVG, så det forblir skarpt i alle skalaer, og der du legger det, blir det liggende mens skjermen oppdateres. Et drag som slutter på en enhet, velger den ikke. **Plant overlay** setter HotLoop-enhetene som er koblet til en klient i en stiplet boks per linje i Plant-treet, til høyre for nettverket og merket med linjens bane, hver med en kabel til svitsjporten den er koblet til, hva nettverket sier om den (oppe, nede eller ikke sett) og hva HotLoop sier om den. En enhet som er koblet men ikke på noen linje, står i en boks som heter «Not on the Plant tree». Den forblir på når du har slått den på. To konsoller er ett bilde: en boks fra en annen konsoll HotLoop leser, som denne konsollen lister som kablet klient, tegnes her med sitt eget undertre, stiplet og merket «separate console». Kartet eksporteres som SVG til anleggsmappen.
- **Enheter.** En tabell, og klikk på en for frontplaten: portene tegnet som frontpanelet, én rad for en liten svitsj, to for 24 og 48 porter med de odde over de like. Grønt for en lenke, grått for ingen, **rødt for en port som var oppe og gikk ned** (HotLoop husker at den var oppe siden den begynte å følge med), stiplet for en deaktivert, et PoE-lyn (wattene står i verktøytipset og detaljene til porten), en pil på opplenken. Klikk på en port for å se hvem som er på den, hva som er koblet til den, PoE-modus, watt og trafikk, med et spor av hva den har mottatt og sendt. En enhet konsollen har mistet, viser ingen tall og ingen portlenker, fordi det den sa sist, ikke er aktuelt.
- **Klienter.** Søkbar på navn, MAC eller IP, med hvor den er, når konsollen sist så den, kjent eller ukjent på et OT-nettverk, og HotLoop-enheten som er koblet til den. Administratorer godtar en ukjent fra raden.
- **Nettverk.** OT-bryteren, per nettverk, og «godta alt slik det er». Det endrer HotLoops oppføring, ikke konsollen.
- **WiFi.** SSID-ene, om hver sender, hvilket nettverk den ligger på og hvor mange klienter som er på den. Hvis konsollen ikke viser kontoen de trådløse nettverkene sine, sier skjermen det i stedet for å påstå at det ikke finnes noen.

Rutene bak er `GET /api/unifi/consoles`, `.../overview`, `.../topology`, `.../devices`, `.../wifi` og `.../events`, dokumentert i [HTTP-API-et](/nb/iot/api/).

### Startalarmene

Alarmene et anlegg vil ha på nettverket sitt før noen har måttet tenke over det, laget av det konsollen har nå. **Create the usual alarms** på Oversikt (eller `POST /api/unifi/{id}/starter-alarms`, se [HTTP-API-et](/nb/iot/api/)) lager:

| Alarm | På | Prioritet | På-forsinkelse |
|---|---|---|---|
| en enhet offline | `d.<mac>.online`, for hver adopterte svitsj, AP og gateway | 2 | 60 s, så en fastvareomstart ikke varsler noen |
| en opplenke nede | `p.<mac>.<nn>.up` på porten hver enhet er koblet til oppstrøms på | 1 | 10 s |
| en gateway på en reserve-WAN | `d.<mac>.wan.failover`, for en gateway med to eller flere WAN | 2 | 30 s |
| en PoE-port over en grense | `p.<mac>.<nn>.poe_w`, bare når du oppgir en grense i watt | 3 | 30 s |

De er vanlige alarmdefinisjoner: utsett dem, kvitter dem, send dem til Discord, endre forsinkelsen eller grensen, slett en. Å trykke igjen etter at du har adoptert mer utstyr, legger bare til det nye, og en tag som allerede har en alarm, laget for hånd eller av et tidligere trykk, lar vi være. PoE-alarmen tar en grense du oppgir i stedet for en HotLoop velger, fordi ingen konsoll vi leser sier hva budsjettet til en port er, og et tall vi hadde gjettet, ville vært et tall noen stolte på. «Unknown device on an OT network» og «a watched client off the network» er ikke med i knappen: de lages når et nettverk markeres som OT og når en enhet overvåkes eller kobles til, sammen med oppføringen som gir dem en mening.

## Hendelser

Konsollens hendelses-websocket (`/proxy/network/wss/s/<site>/events` på UniFi OS, `/wss/s/<site>/events` på den selvdrevne applikasjonen), på samme sesjon som alt annet. Den logger aldri inn på egen hånd: et avvist håndtrykk med 401 går gjennom samme innloggingsbudsjett som en lesing, og en avvist innlogging avventes, ikke prøves på nytt.

**Pollingen er fortsatt sannheten.** En hendelse skriver aldri en tag. Det den gjør:

1. Den havner i **loggboken** i det øyeblikket den kommer, med kontrollerens egen setning («Switch[...] was disconnected») og nøkkelen sin. En svitsj som faller ut, står på tidslinjen når det skjer, ikke når neste polling merker det. Den føres under svitsjen, tilgangspunktet eller gatewayen den handler om, ikke under konsollens egen enhet, fordi konsollen er boksen kontrolleren kjører på og ikke det som falt ut. En hendelse som bare nevner en klient (konsollen sier hvem som koblet seg til, ikke hvor) føres under svitsjen eller AP-en siste lesing har den klienten på, og hvis klienten er ny, venter den på lesingen hendelsen nettopp har bedt om, opptil tretti sekunder, og havner så under konsollen hvis den lesingen fortsatt ikke har den. Loggbokens **Where**-filter finner en hendelse fra anlegget: en HotLoop-enhet koblet til klienten sin, svitsjen konsollen sier den klienten er på, og hver svitsj mellom der og gatewayen etter konsollens egen downlink-tabell. En svitsj som har falt ut, står på tidslinjen til hver linje den mater og på ingen den ikke mater. Å spørre om selve konsollen fungerer som det alltid har gjort: systemloggen på `subject` lik konsollens id, og loggboken med konsollen blant enhetene i omfanget, gir alle hendelsene til den konsollen, også de per svitsj.
2. Den går i loggen Oversikt viser, og inn i `site.last_event` og `d.<mac>.last_event`, så en automasjon kan utløses av en.
3. Den ber om neste lesing nå. Lesegulvet er ti sekunder; en hendelse forkorter det til fem, så taggene og entitetene tar igjen ved neste polling i stedet for opptil ti sekunder senere. Et travelt WiFi sender en hendelse for hver telefon som går forbi, og konsollen leses ikke for hver av dem.

Kontrolleren flagger hendelsene som betyr at noe gikk galt (`is_negative`: en svitsj som mister kontakten er en, en klient som kobler fra er det ikke), og disse er advarsler i loggboken. Alt annet er informasjon, også nøkler HotLoop aldri har sett.

**En død websocket koster fart, aldri korrekthet.** Den kobler til igjen med en backoff fra to sekunder opp til ett minutt. Den pinger, og en strøm som ikke svarer på 90 sekunder er død uansett hva nettverket sier, så den lukkes og åpnes på nytt. Mens den er nede, leser `site.events_live` 0, Oversikt sier «polling only» med grunnen, og pollingen fortsetter akkurat som før.
## Hva som er verifisert

UniFi-driveren og skjermbildene er kjørt mot ekte UniFi Network Applications og UniFi OS-konsoller, skrivebeskyttet som en View Only-konto, og på ekte maskinvare 2026-11-17: innloggingen og den ene sesjonen, tagene for enhet, port, PoE, WAN og klient, den levende hendelsesstrømmen og skjermbildene bygget på dem.
