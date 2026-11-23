---
title: "Veikart for Flow"
description: "Fasene i Flow, hva som er gjort og hva som kommer, med omskrivingen av editoren i Astro."
---

Hva HotLoop Flow skal bli, i den rekkefølgen det bygges. Står det ikke på denne listen, blir det ikke gjort, så sett det på listen.

Flow bygges ved siden av HotLoop og forblir et eget produkt. FlowLab og diagrammene, fase 9, er en egen pakke som står ved siden av meldingsmotoren.

## Hva Flow er til for

En visuell flytmotor for fabrikkgulvet. Hver utrulling blir sammenlignet, testet og er ett klikk fra tilbakerulling. Når noe går galt klokka 3 om natten, ser du nøyaktig hvilken vei en melding tok og hvordan den så ut i hvert ledd. Den kjører i én statisk binærfil som er liten nok for en Pi, og den faller ikke sammen når en sensor blir pratsom.

Den leser også dine eksisterende `flows.json` uendret. Det er en bonus, ikke poenget.

Reglene som hvert punkt under leveres etter:

- Ingen stubber. Er det ikke bygget, testet mot det virkelige og i orden, blir det ikke krysset av.
- Alt som kan styre utstyr går gjennom en port som kan si nei, og sier hvorfor.
- Ingenting kastes i det stille. Hver forkastelse, avvisning og overflyt telles og dukker opp i målingene.
- Flytfilen fortsetter å lastes og lagres byte for byte. Nye data går i nøkler som andre verktøy ignorerer, og rundturtesten dekker filer som har dem.

---

### Fase 0: si sannheten

README-en påstår ting koden ikke dekker. Det rettes før noe nytt lovet, fordi en README som lyver én gang, leses som om den alltid lyver.

- [x] WASM-sandkassen er ekte og testet, men ingen node bruker den, og den er ikke i binærfilen. Det sies slik til fase 6 gjør det sant
- [x] To kodekommentarer peker på et innebygd kontekstlager som ikke finnes. De slettes
- [x] Måle minnebruk i hvile og under last på nytt på samme måte på samme maskin, publisere kommandoen sammen med tallet og droppe alle tall ingen kan gjenskape
- [x] CVE-2025-41656 er en leverandør som leverer en annen flytmotor med autentisering slått av, ikke en CVE i den motoren. Henvisningen rettes i README-en og i `exec`-raden i `docs/compatibility.md`
- [x] Skrive om toppen av README-en rundt det Flow gjør. Import av eksisterende flyter flyttes til en egen seksjon lenger ned, med den byte-nøyaktige rundturen og `hotloop-flow import` som bevis
- [x] Utrullingsdokumentasjonen handler om Kubernetes, Podman og Quadlet, ikke ett enkelt selskaps App Store
- [x] Tester for pakkene som ikke har noen: `api` (innlogging, rettigheter, 409 ved en foreldet utrulling), `config` (hver oppstartsavvisning README-en lister) og `cmd` (utrullingen skriver flytfilen før den stopper den gamle kjøretiden), pluss `js`, sandkassen til Function-noden, som heller ikke hadde noen

### Fase 1: historikk, differanse, tilbakerulling

Hver utrulling er en post: hvem, når, et notat, de nøyaktige bytene og hva som endret seg. «Hva endret seg, hvem endret det, sett det tilbake» er det første alle spør om etter at en linje har stoppet, og i dag er svaret tre `.bak`-filer.

- [x] Utrullingslogg: hver utrulling er en uforanderlig post med bruker, tidspunkt, et valgfritt notat, flytbytene og de krypterte påloggingsdataene slik de var. Oppbevaringstid er en innstilling. `GET /deployments`
- [x] Semantisk differanse: node for node, egenskap for egenskap. Lagt til, fjernet, endret, koblet om. Å dra en node rundt vises som oppsett, aldri som en logikkendring. Over API-et og som `hotloop-flow diff a.json b.json`
- [x] Differansen fungerer som git difftool, så en pull request på en flyt lyder «terskel for regel 2 fra 7,5 til 8,0» i stedet for en JSON-blokk
- [x] Tilbakerulling: ruller ut en gammel post på nytt som en ny, påloggingsdata med, så en node du slettet kommer tilbake med passordet til brokeren sin. Historikken forblir bare-tillegg
- [x] Editor: historikkpanel, differansen tegnet på lerretet, «gjennomgå og rull ut» med et notat, en knapp for tilbakerulling. En utrullingskonflikt viser hva den andre endret i stedet for en ja/nei-boks
- [x] Flyter som kode: `hotloop-flow deploy` og `hotloop-flow export` for CI/CD, med et token som bare kan rulle ut, så en pipeline aldri holder et administratorpassord
- [x] Valgfritt git-speil: hver utrulling pushet som en commit signert av den som rullet ut. Ren Go, og kontrollen av binærstørrelsen består fortsatt
- [x] Revisjonslogg: innlogginger, mislykkede innlogginger, utrullinger, tilbakerullinger og inject, hver med hvem og hvorfra. Utrullingsloggen er den første tabellen
- [x] MFA (TOTP), gratis og på for alle som vil ha den. Ingenting som handler om å logge trygt inn blir noen gang gjort betalt
- [x] Begrensning av innloggingsforsøk og utestenging, økter som overlever en omstart, og websocket-tokenet sendt som en underprotokoll i stedet for i URL-en. Et token i URL-en virker fortsatt for eksisterende skript og logger en advarsel, fordi å ødelegge dem ved en oppgradering var verre enn lekkasjen; å fjerne det venter til en hovedversjon

### Fase 2: flyttester

«Ødela endringen min linjen?» besvares før utrullingen, ikke etter. Testene er YAML ved siden av flytene, så de sammenlignes og gjennomgås på samme måte.

- [x] `hotloop-flow test`: den virkelige kjøretiden og de virkelige nodene, i prosess. Send inn en melding, forvent det som kommer ut av en port innen en frist, forvent ingenting, forvent at en feil når en Catch. JUnit-utdata for CI/CD
- [x] Virtualisert I/O: en MQTT out, en databaseskriving eller en HTTP-forespørsel i en test registrerer hva den ville ha sendt og rører aldri nettverket
- [x] Virtuell klokke: en Delay på fem minutter kjører på millisekunder, og hver tidsnode er bevist mot den
- [x] Kontekst- og påloggingsfikstures, og påstander om konteksten etterpå. En test kan ikke lene seg på det en annen etterlot
- [x] Utrullingsport: når den er på, avvises en utrulling som feiler testene sine med de påstandene som feiler, og flytene som allerede kjører, merker ingenting
- [x] Editor: gjør en fanget feilsøkingsmelding om til en test med to klikk, kjør suiten fra editoren, bestått og feilet vist på nodene

### Fase 3: sporing og avspilling

- [x] Klikk på en feilsøkingsmelding, og lerretet lyser opp veien den tok, med tid og nyttelast i hvert ledd, gjennom delinger, sammenslåinger og underflyter
- [x] Begrenset sporbuffer. Minnet holder seg flatt under en utholdenhetstest på en million meldinger, og tallet publiseres
- [x] Spill av en fanget melding i et utkast av flyten og sammenlign utdataene
- [x] Et fanget spor blir en test fra fase 2
- [x] OpenTelemetry-eksport, bevist mot en ekte collector

### Fase 4: varig tilstand

En historian som er nede i en time, bør ikke koste deg en time med målinger.

- [x] Vedvarende kontekst i SQLite, ren Go uten cgo, med de atomiske operasjonene (sammenlign-og-bytt, øk, oppdater). Ett lager for kontekst nå og varige køer etterpå, ikke to. I dag er flyt- og global kontekst borte ved hver omstart, som er hullet som mest sannsynlig biter noen først. Skrevet bak i én transaksjon hvert tredje sekund, og en verdi satt til det den allerede var, skriver ingenting
- [x] Varige koblinger: merk en kobling som varig, og køen går over til det samme lageret i stedet for å blokkere eller droppe. Den overlever en omstart, beholder rekkefølgen, holder en diskkvote, og dybden er en måling. Merket i flytfilen med `ew_durable`, så rundturen forblir byte for byte. Dobbeltklikk på en kobling i editoren for å merke den
- [x] Lagre-og-videresend bevist på den harde måten: drep den virkelige InfluxDB i ti minutter under jevn inngang, ta den opp igjen, tell rader. Ingen mangler, ingen er doblet. Så kill -9 på kjøretiden midt i køen og telle på nytt. Skriptet, tallene og diskskrivingene per time står i [durable/](/nb/flow/durable-state/)
- [x] Bevist på en ekte Pi 5: minne, starttid og vedvarende gjennomstrømning, i [docs/bench](/nb/flow/benchmarks/#resultater-på-en-raspberry-pi-5), med strupingen den viste
- [ ] Bevist på en Pi 4 og en Zero 2 W, og SD-kortskrivinger per time på et kort, fordi et kontekstlager som sliter ut et SD-kort er en feil. Åpent fordi det trenger brettene. Pi 5 er målt; et tall fra en annen maskin ville vært oppdiktet

### Fase 5: fabrikkgulvet

`scan` finner en PLS i dag, og ingenting i paletten kan snakke med den. Det er det største hullet i et produkt bygget for fabrikker.

- [x] Modbus TCP lesing og skriving
- [x] OPC UA lesing, abonnement og skriving
- [x] S7 lesing og skriving
- [x] Sparkplug B, som edge-node og som vert
- [x] EtherNet/IP lesing og skriving
- Alt på simulatorer. Ingen Siemens-CPU eller Logix-kontroller har stått foran noe av dette
- [x] HotLoop-noder: entitetsendringer inn, entitetstilstand, kall et skript, bruk en oppskrift. Hver kommando går gjennom HotLoops skriveport og havner i loggboken som `flow:<node id>`, og en skriving porten avviser, kommer til en Catch-node med portens begrunnelse
- [x] Når HotLoop er der, går Flows skrivinger til utstyr gjennom HotLoops port i stedet for rett til PLS-en. Begge kom i 2.3.0. En skriving gjennom den virkelige porten er bevist for Modbus mot et publisert HotLoop-image; skrivenodene for OPC UA, S7 og EtherNet/IP sender gjennom den samme koden, og en test sjekker at hver av dem tilbyr porten.

### Fase 6: plugins uten npm

- [x] En `wasm`-node på verten som allerede finnes: hardt minnetak, en tidsgrense, og en gjest som overskrider den ene eller den andre, stopper uten å ta noe annet med seg
- [x] Pluginformat: modulen, en deskriptor så editoren tegner dialogen sin, og en signatur. Usignerte eller tuklede plugins nekter å laste og sier hvorfor
- [x] Evner: en plugin får ingen vertstilgang med mindre manifestet ber om det og operatøren gir den. Å be om noe som ikke er gitt, feiler utrullingen

### Fase 7: typede koblinger og MCP

- [x] Skjemavalidering på `json`-noden, den første delen
- [x] Valgfrie skjemaer på porter. En uoverensstemmelse editoren ser, avvises ved utrulling; en den ikke ser, går til en Catch-node med stien til det feile feltet, og til en måling
- [x] Typer tegnet på koblingene i editoren
- [x] Flyter som MCP-verktøy: en verktøynode erklærer et navn, en beskrivelse og et inndataskjema, og Flow serverer `/mcp`. En agent som kaller en flyt, får de samme rettighetene og den samme revisjonsloggen som et menneske
- [x] En MCP-klientnode, så en flyt kan kalle verktøy på andre servere, HotLoops inkludert
- [x] Flows egne MCP-verktøy: list, les, rull ut og rull tilbake flyter, list utrullingene og trykk på en inject-node, gjennom admin-API-ets egne behandlere med de samme rettighetene, utrullingskontrollene og revisjonssporet, fordi en MCP som bare kunne kalle det en flytforfatter hadde koblet opp, ikke kunne lese eller skrive Flow selv
- [x] Flows egne MCP-verktøy for diagrammer og instrumenter: list og les diagrammene, kjør og stopp ett, styr feilsøkeren, sett en kontroll på panelet, sett bruddpunkter og prober, lag et underdiagram, og les og bytt skrivingene til et instrument, hvert som en adminrute kjørt av sin egen behandler med rettigheten den ruten ber om (`status.read`, `diagram.run`, `instrument.write`). Til nå hadde ikke diagramrutene noe verktøy, så en agent kunne rulle ut et diagram og ikke kjøre det. Hver adminrute er nå et verktøy eller er navngitt i en test som en et menneske må ta, og testen feiler når en ny rute legges til uten. 44 verktøy nå, med de for stasjoner, failover og spor

### Fase 8: editoren, omskrevet i Astro

Ferdig, og flyttet frem. Den skulle komme sist, og vi flyttet den foran Flows første skjermbilder, fordi ingen bør se de første i en editor som ser ut som den kommer fra et annet selskap.

Hvert HotLoop-prosjekt får ett moderne grensesnitt, og denne editoren var den som ikke passet. Den var håndbygd TypeScript uten rammeverk på innebygd SVG, som var det riktige valget da målet var en liten statisk binærfil uten noe å revidere. Nå er den Astro med Svelte-øyer, den samme stacken som Cascades editor, på de samme HotLoop-tokenene, lys og mørk.

- [x] Først en designrunde, før én eneste linje Astro. Hva editoren skal se ut og føles som ved siden av resten av HotLoop, avgjort på papir og i de delte tokenene, så omskrivingen bygger noe noen allerede har bestemt i stedet for å bestemme underveis
- [x] Editoren bygget om i Astro med lerret, dialoger, historikk, gjennomgang, tester, sporing, søk og grupper ført over, og ingen av dem fikk bli dårligere. Nettlesertestene i `web/e2e` er listen: de består mot den nye editoren uendret
- [x] Fortsatt innebygd i den ene statiske binærfilen, fortsatt uten nettverk på en edge-boks, fortsatt innenfor budsjettet for binærstørrelse, og lisensporten dekker fortsatt alt som følger med i pakken

Lerretet og grafen under det ble ikke skrevet om. De flyttet til `web/src/lib` som TypeScriptet de var, med et nytt skall, så kobling, dra, angre og den byte-nøyaktige rundturen av flytfilen er koden som allerede var testet. Alt rundt er Svelte.

Flow forblir et eget produkt gjennom alt dette. Det deler utseendet med HotLoop, ikke koden, og er aldri innebygd i HotLoop.

### Fase 9: FlowLab, diagrammer

En annen måte å kjøre en fane på, ved siden av meldinger og aldri i stedet for dem. I et diagram kjører hver node én gang, når hver av de tilkoblede inngangene har en verdi, og grener uten kobling mellom seg kjører samtidig. Det er det en testbenk eller en datalogger trenger: løkker som bærer en verdi fra én runde til neste, en feil som reiser på en egen kobling, et panel en operatør kan åpne på telefonen og en feilsøker som kan pause en kjøring og vise hva som ligger på hver kobling. Eksisterende flyter endres ikke, og flytfilen fortsetter å lastes og lagres byte for byte: et diagram er en fane med en `ew_diagram`-nøkkel, og hvilken inngang en kobling lander på, lagres i `ew_in` på noden den går ut fra. [FlowLab](/nb/flow/flowlab/) har resten.

- [x] Planleggeren: alle tilkoblede innganger klare, uavhengige grener parallelt, og en `after`-kobling for rekkefølge der ingen data flyter
- [x] While- og for-løkker med medbrakte verdier, og en feilkobling som hopper over nodene etter en feil, stopper en løkke og bærer kilden og koden sin
- [x] En seriell port, med lesing til en terminator eller et antall byte, en tidsgrense på feilkoblingen, og en port som åpnes på nytt etter en trukket kabel og telles
- [x] En måleverditolker, deteksjon av stabil verdi og en tekstlogg med en tidskolonne
- [x] Et panel servert av Flow: kontroller, indikatorer og et diagram eller en graf, åpent på en telefon mens en kjøring er i gang, med en ekstra tilskuer på en pc, hver og en følger kjøringen innen ett sekund
- [x] Kjør, stopp, utheving av kjøringen, prober på hvilken som helst kobling, bruddpunkter på noder, koblinger og runder, og gå inn i, over og ut
- [x] Editoren tegner navngitte porter og koblinger til den du slipper på, og den samme siden kjører og feilsøker
- [x] Case-struktur, poster og delte typer, bølgeformer
- [x] TDMS- og binærlogging, og en database- og MQTT-utgang
- [x] Instrumentøkter, over rå socket og seriell, bevist mot en simulator og en pty
- [ ] En datainnsamlingsklient bevist mot NIs egen server. Den er bygget og levert, og bare testet mot en stand-in-server, så den forblir åpen til den har kjørt mot NIs server og en enhet
- [x] Analyse: statistikk og filtre
- [x] Underdiagrammer, en feilliste i CI/CD, og editorens zoom- og layoutarbeid
- [x] Avspilling av en ferdig kjøring: hver nodestart og -slutt og hver koblingsverdi registreres, og diagramlinjen spiller av den siste kjøringen på lerretet. `GET /diagrams/{id}/trace`, verktøyet `get_diagram_trace`
- [x] En databasesluk som beholder det en database går glipp av: `postgres out`, varig, skrevet i rekkefølge og i partier når databasen er tilbake, bevist på en ekte TimescaleDB
- [x] Skyv én flytfil, og dermed ett sett diagrammer, til hver Flow-installasjon en tenant kjører i EmberNet, med en sjekk etter hver og en mislykket satt tilbake ([Sending til en tenants stasjoner](/nb/flow/stations/)), bevist på tre ekte Flow-prosesser
- [ ] Bevist på en Pi i en dag, som trenger brettet og en lang kjøring

---

## Hverdagens hull

Disse går ved siden av fasene. Ingen velger en flytmotor fordi den har dem, men mange dropper en som ikke har dem.

- [x] Delvis utrulling: bare endrede noder og koblingene deres starter på nytt. I dag dropper hver lagring alle MQTT-økter og alle meldinger underveis, noe som lærer operatørene å ikke rulle ut under et skift
- [x] JSONata, bevist mot de publiserte eksemplene, siden det er det en importert flyt oftest snubler på
- [x] Inject i cron-stil
- [x] Returmodus for Link Call og Link Out
- [x] Join etter tidsgrense og reduce, batch etter tid, split som strøm
- [x] MQTT v5 og last will
- [x] TLS over TCP, informasjonskapsler og multipart over HTTP
- [x] Editor: kopier og lim inn, import og eksport av et utvalg, redigering av underflyter og grupper, søk på tvers av flyter, feilsøkingsfiltrering
- [x] Editorhull den første runden etterlot: legg til en konfigurasjonsnode fra paletten (dialogen ba deg om det, og du kunne ikke), gjør et utvalg om til en underflyt, gi nytt navn til og slett en flyt, og merk en kobling som varig med dobbeltklikk
- [x] En utvei for en melding målet til en varig kobling avviser for alltid: en valgfri forsøksgrense per kobling. Etter så mange avvisninger går meldingen til flytens Catch som en feil med meldingen vedlagt, og koblingen går videre. Av som standard, så en kobling holder på og prøver på nytt akkurat som før
- `store.*` var allerede der fra arbeidet med det varige og har nå den samme kontrollen
- [x] En node som peker på en konfigurasjonsnode som ikke er i filen (en flyt slettet sammen med sin egen broker mens en underflyt, en håndredigering eller en import fortsatt nevner den), rapporteres av `hotloop-flow import`, i editoren ved lasting og ved utrulling, og i utrullingssvaret, og noden er en oppstartsfeil i stedet for en node som i det stille aldri virker
- [x] Hullene den ene etterlot: en konfigurasjonsreferanse som nevner en fane, en underflyt, en gruppe, en vanlig node eller feil type konfigurasjonsnode rapporteres og feiler ved oppstart som en som ikke nevner noe, en tilbakerulling legger filens advarsler i editorloggen én gang og ikke to, og `hotloop-flow import` skriver rapporten sin til en writer slik `deploy` gjør, så testene slutter å bytte ut standard ut
- Opprinnelsesprosjektet har fortsatt linjen; vi ba dem ikke om å ta imot endringen
- [x] Utrensktesten for den varige koblingen kunne telle én mer droppet enn den hadde sett som i kø. Det var testen som var feil, ikke køen: den ventet på 28 av 30 meldinger på disk og holdt så utrenskingen til nøyaktig det den hadde sett, mens spoolen fortsatt telte de siste. Hvor mange av de 30 som er på disk når koblingen går, avhenger av timing, så nå holder den utrenskingen til det den så som gulv og til de 30 sendte som tak
- [x] Drepetesten for den varige koblingen besto lokalt og feilet på en tregere runner. Køen telte en melding som ventende før den var på disk, så en kopi tatt i det øyeblikket telleren nådde 100 kunne være én for kort. Den teller etter commit nå
- [x] Editoren, nodeteksten og dashbordsiden på 13 språk i tillegg til engelsk, med én felles ordliste
- [x] Kafka out, og ntfy, gotify og discord out, med varslingsinnstillingene core allerede har
- [x] En varig kobling til InfluxDB tar igjen i partier på opptil 256, så en times etterslep tømmes på sekunder og ikke minutter
- [x] Node-RED-koblingsnodene en fabrikkmigrering trenger (Modbus-server på et nettverksgrensesnitt, e-post, postgres og dashbordnodene), kjørt naturlig
- [x] Chart-verdier og en render-sjekk for sending til stasjoner
- [x] Hemmeligheter ved referanse: en node leser et passord fra en montert Kubernetes-Secret eller en fil, så det aldri bor i flytfilen
- [x] Ta med flytene dine: `hotloop-flow import` fortsetter å rapportere nøyaktig hva som vil kjøre og ikke før noe rulles ut. Den lister nodetypene som kjører, de som kjører med en forskjell og hva forskjellen er, de som ikke vil starte, og en node som peker på en konfigurasjonsnode som ikke er i filen

## Senere

- [x] Aktiv/standby: en lease i en PostgreSQL med et fencing-nummer, en fence på hver skriving til utstyr, og en standby som holder tilbake skrivingene sine til den tar over leasen ([Varm standby med lease](/nb/flow/failover/)). Bevist på to ekte Flow-prosesser mot en ekte PostgreSQL og en Modbus-server som logger hver skriving: drept midt i strømmen, frosset og tint opp, og stoppet rent, uten noen skriving fra begge. Konteksten blir på hver installasjons disk og ikke i Postgres, som var det første utkastet og ikke trengs for å holde to skrivere fra hverandre

## Avgjort

Hvert spørsmål denne listen pleide å ha, er besvart. De blir stående her med svarene, fordi begrunnelsene er det som hindrer noen i å åpne dem på nytt.

Avgjort 2026-10-03:

- **Industrielle noder bygges i Flow,** på de samme åpen kildekode-bibliotekene som HotLoop-driverne bruker. HotLoops drivere forblir HotLoops. Flow beholder sin egen lisens, som var en annen da dette ble avgjort og nå er HotLoop Source License Agreement 1.0, som erstattet EmberNet Source License 1.0 og, før den, Business Source License 1.1 som den hadde fra 2.2.0.
- **Flow forblir et eget produkt og blir aldri innebygd i HotLoop.** Det kjører ved siden av HotLoop og snakker med HotLoops API utenfra, som er det HotLoop-nodene i fase 5 gjør, og det er hele forholdet.
- **README-en åpner med det Flow gjør.** «Koble opp fabrikken. Gjennomgå den som kode.» Import av eksisterende flyter ligger lenger ned i «Ta med flytene dine», og ingenting øverst sammenligner Flow med noe. Flow står på egne bein.
- **Vedvarende kontekst er SQLite fra starten,** ren Go uten cgo. Ett lager for kontekst nå og varige køer senere, ikke et fillager først og et annet etterpå.
- **Produktet for arbeidsflytautomatisering er sin egen greie** og deler ikke Flows motor. Historikk, differanse og resten er fortsatt motorpakker her, fordi API-et, CLI-en, editoren og git alle må få det samme svaret.

Avgjort før fase 1 begynte:

- **MFA og revisjonsloggen kommer i fase 1,** foran de morsomme tingene. Begge kom.
- **Den byte-nøyaktige rundturen av eksisterende flytfiler forblir en hard regel,** selv med typer og tester i filen. Nye data går i nøkler som andre verktøy ignorerer, og rundturtesten dekker filer som har dem.
- **Benchmarks er bare absolutte tall,** hvert med kommandoen som lagde det. En side-ved-side-tabell flytter seg hver gang maskinen endres, og ender opp med å beskrive den andre motoren mer enn denne.
