---
title: "FlowLab: testbenker"
description: "Kjør en fane som diagram for testbenker og dataloggere: noder med løkker, feilledning, serieport, panel og feilsøker."
---

FlowLab er den delen av Flow som er laget for testbenker og dataloggere, og enheten er diagrammet: den andre måten Flow kjører en fane på. I en flyt går en melding gjennom en node, og hvilken som helst inngang vekker den. I et diagram kjøres hver node én gang per kjøring, når hver inngang som har en ledning har en verdi. To noder uten ledning mellom seg kjøres samtidig. Slik bygger du en testbenk eller en datalogger: les en enhet, tolk avlesingen, avgjør om den er stabil, vis den, skriv den ned.

Flyter påvirkes ikke av noe av dette. En fane med `ew_diagram` holdes utenfor meldingskjøretiden, og alle andre faner kjører nøyaktig som før.

Hva det betyr for deg: du tegner logikken én gang, trykker Kjør og ser verdiene bevege seg på ledningene. Alle som har paneladressen kan se den samme kjøringen på en telefon.

## Filen

Et diagram er en fane med et `ew_diagram`-objekt. Nodene er vanlige oppføringer i flytfilen. `wires` navngir noden en ledning går til, som alltid, og `ew_in` på kildenoden sier hvilken inngang på målet hver ledning lander på, i samme form:

```json
{ "id": "a", "type": "dia-const", "z": "d", "value": "1", "x": 100, "y": 80,
  "ew_in": [["a"], []], "wires": [["sum"], []] }
```

Filen lastes og lagres byte for byte med disse nøklene i seg. Innstillinger for fanen:

| Nøkkel | Hva den gjør |
|---|---|
| `autostart` | `true` starter kjøringen når Flow starter og etter hver distribusjon, uten at noen nettleser er åpen. |
| `role` | `"body"` for et diagram som en løkke kjører. En kropp kjøres ikke av seg selv. |

Hver node har også en valgfri inngang `after` og en utgang `done`. Koble `done` på én node til `after` på en annen, så venter den andre på den første, uten noe imellom. Rekkefølgen er en ledning du kan se og sammenligne med diff.

## Kjøring

Et diagram kjøres fra det som er distribuert. Åpne en diagramfane i editoren og trykk Kjør. Linjen over lerretet har:

- **Uthev kjøringen**: hver node venter et øyeblikk før den kjøres, så du kan følge med, og ledningen en verdi gikk over lyser opp. Den slår seg av etter ti minutter.
- **Sett på pause, Fortsett, Gå inn, Gå over, Gå ut**: stegvis kjøring går node for node. Gå over kjører hele kroppen til en løkke. Gå inn stopper ved den første noden i den.
- **Stopp på utvalget**: et stoppunkt på den valgte noden. Trykk to ganger på en ledning for å sondere den, noe som beholder de siste 100 verdiene, eller for å stoppe når en verdi legges på den. En sonde endrer aldri en kjøring.
- **Åpne panel**: operatørens side.

Hold pekeren over en ledning etter en kjøring for å se den siste verdien den bar. Problemknappen viser alle grunner til at et diagram ikke kan kjøres, hver med node og inngang.

| Kall | Hva det gjør |
|---|---|
| `GET /diagrams`, `GET /diagrams/{id}` | Det som er distribuert, panelet og den siste verdien på hver ledning. |
| `GET /diagrams/{id}/trace` | Hva den siste kjøringen gjorde, i rekkefølge: hver node som startet eller ble ferdig og hver verdi som gikk over en ledning, med millisekundene inn i kjøringen. Et diagram som ikke er kjørt siden det ble distribuert, svarer 404. |
| `POST /diagrams/{id}/run`, `/stop`, `/debug` | Trenger `diagram.run`. Hver av dem står i revisjonsloggen med hvem som gjorde det. |
| `POST /diagrams/{id}/sub` | Send `{flows, nodes, name}` og få flytfilen tilbake med disse nodene gjort om til et underdiagram. Leser og regner bare; ingenting lagres eller distribueres. |
| `PUT /diagrams/{id}/controls/{node}` | Setter en kontroll. Sjekkes mot sin type, sitt område og sine valg. |
| `PUT /diagrams/{id}/breakpoints`, `/probes` | Nøklene er en node-id, `wire:<wire key>` eller `diagram:<tab>`. |

Hendelser for en kjøring går ut på samme socket som editorens, som `diagram/<id>/node`, `token`, `run`, `paused` og `values`.

## Noder

| Node | Hva den gjør |
|---|---|
| `dia-const`, `dia-math`, `dia-compare`, `dia-logic` | Verdier og aritmetikk. Matte virker element for element på arrayer. |
| `dia-wait` | Venter, og sender så inngangen videre. |
| `dia-bundle`, `dia-field`, `dia-array` | Poster og arrayer. |
| `dia-while`, `dia-for` | Løkker. Kroppen er et eget diagram, navngitt av fanen sin. Verdier som føres videre starter fra en ledning eller fra Start values og kommer ut slik de var i siste runde. En for-løkke tar et antall eller et array. En while-løkke kjører minst én gang. |
| `dia-case` | Case-struktur. Verdien på `selector` velger én kropp som kjøres, og bare den kroppen kjøres. En boolsk verdi velger `true` eller `false`, et tall velger caset med den verdien uansett hvordan det er skrevet, og en streng eller en enum velger caset med det navnet. Casene er et JSON-objekt fra casenavn til diagram, og en verdi ingen case navngir, kjører standardcaset. Uten standard legger noden en feil på feilledningen sin, og distribusjonen advarer om at det ikke finnes noen standard (en boolsk verdi med begge case er unntatt). Hver kropp må sende ut hvert resultat under samme navn, og en kropp som ikke gjør det, er et problem ved distribusjon. Utgangen `case` sier hvilket case som ble kjørt. |
| `dia-body-in`, `dia-body-out` | De to endene av en kropp. `iter` er rundenummeret. `stop` avslutter en while-løkke. Navnet på en verdi som føres videre sender den rundt. |
| `dia-serial-open`, `dia-serial-read`, `dia-serial-write` | En serieport. Lesinger slutter ved en terminator eller et antall byte. |
| `dia-instr-open`, `dia-instr-query`, `dia-scpi-parse` | Et testinstrument med adresse. Se Instrumenter lenger ned. |
| `dia-parse-reading`, `dia-stable` | Henter et tall og en enhet ut av en linje, og sier om de siste avlesingene stemmer overens. |
| `dia-log-text` | Legger til en post som en rad i en tekstfil, med en tidskolonne. |
| `dia-daq-read` | Leser samples fra en datainnsamlingsoppgave på NI-maskinvare, gjennom NIs gRPC Device Server. Se Datainnsamling lenger ned. |
| `dia-mqtt-out` | Publiserer verdien sin gjennom en MQTT-server som flytfilen konfigurerer, samme tilkobling som MQTT-nodene bruker. Merk den som varig, så skrives en melding megleren går glipp av til disk og sendes i rekkefølge når megleren er tilbake, selv etter en omstart. |
| `dia-postgres-out` | Skriver en post som én rad i en tabell i PostgreSQL eller TimescaleDB, gjennom serveren flytfilen konfigurerer, samme tilkobling som postgres-noden bruker. Merk den som varig, så beholdes en rad databasen går glipp av på disk og skrives i rekkefølge når den er tilbake. Se En database som går ned lenger ned. |
| `dia-log-tdms` | Legger til en post i en TDMS-fil, én kanal per felt. Se lenger ned. |
| `dia-control`, `dia-indicator`, `dia-chart` | Panelet. |
| `dia-stats` | Gjennomsnitt, RMS, minste, største og standardavvik for et array. Standardavviket deler på n minus én, så det trenger to avlesinger. |
| `dia-integral` | Arealet under et array etter trapesregelen, som ett tall eller som løpende areal ved hvert sample. |
| `dia-derivative` | Stigningen ved hvert sample i et array. |
| `dia-filter` | Et Butterworth-filter av typen lavpass, høypass, båndpass eller båndstopp av orden 1 til 10 med en knekkfrekvens i hertz. |

### Filtre

Filternoden er et Butterworth-filter: flatt der det slipper gjennom, uten rippel, og 3 dB ned ved knekkfrekvensen. Det er utformet fra det analoge filteret med den bilineære transformasjonen og forhåndsforvrengt knekkfrekvens, slik at 3 dB-punktet havner på frekvensen du skrev inn, og det kjøres som en kjede av annenordens seksjoner slik at høy orden holder seg nøyaktig. Et båndpass eller båndstopp av orden n har 2n poler. En knekkfrekvens må være over null og under halve samplingsraten, og en utforming som ikke kan bygges, står i problemlisten før kjøringen. Samplingsraten er en egenskap, eller en inngang som går foran den. Filteret beholder minnet sitt fra kall til kall i en kjøring, så et array som er kuttet i biter av en løkke, kommer ut som om det var filtrert helt, og hver ny kjøring starter fra hvile.

Hva det ikke kan: det er ikke et lineærfase-filter, så det forsinker ulike frekvenser ulikt, og det har ingen nullfase-modus som filtrerer fremover og bakover. Der tidsforholdet mellom to signaler må stemme, eller formen på en bølge må bevares, er dette feil filter. Integral og derivert henter tiden mellom samples fra en `dt`-inngang i sekunder, en `rate`-inngang i hertz eller egenskapen Samples per second.

### Logg til TDMS

`dia-log-tdms` skriver målingene en testbenk tar, til en TDMS-fil, formatet som verktøy for datainnsamling og analyse åpner. Koble en post til `row`. Hvert felt i posten er en kanal i én gruppe, så en post med `pressure`, `ok` og `operator` gir tre kanaler. Et tall lagres som en 64-bits float, sant eller usant som en bool, og alt annet som tekst. Et felt som inneholder en liste med tall, legger til hele listen, og slik kommer en blokk med samples inn. Innstillinger:

| Innstilling | Betydning |
|---|---|
| `path` | Filen. En fil som allerede finnes, fylles på, så én kjøring etter en annen bygger én fil. |
| `group` | Gruppen kanalene havner i. |
| `columns` | Feltene som skal logges, i rekkefølge. Tom logger alle felt, med navn. |
| `properties` | Et JSON-objekt med egenskaper for filen, for eksempel `{"title": "bench 4", "station": 4}`, skrevet når kjøringen starter. |
| `sync` | På som standard: hver rad når disken før noden er ferdig. |

Hver rad er ett segment, skrevet i ett stykke. Hvis strømmen går midt i en, viser filen hvor den ble kuttet, en leser gir tilbake hver rad før den, og neste kjøring reparerer slutten av filen og fortsetter. Typen til et felt settes av den første raden i en kjøring. En senere rad som ikke passer, for eksempel tekst i en tallkolonne, går til feilledningen som en dårlig inngang, og filen røres ikke. Et manglende tall skrives som not-a-number.

For å åpne filen kan du bruke en hvilken som helst TDMS-leser. Kanalegenskaper som `unit_string` og bølgeformegenskapene `wf_start_time`, `wf_increment` og `wf_samples` støttes av biblioteket; noden setter dem ikke ennå.

Hva leseren godtar: little endian- og big endian-segmenter, sammenflettede og sammenhengende data, metadata utelatt fra et segment når de ikke har endret seg, en ny objektliste, heltall på 8, 16, 32 og 64 bit, floats på 32 og 64 bit, bools, tekst og tidsstempler. Hva den avviser, med navn og uten å lese filen halvveis: rådata skrevet av en datainnsamlingsdriver, skalerte eller komprimerte data, floats med utvidet presisjon, fastpunkt- og komplekse tall. Hva skriveren skriver: little endian, sammenhengende data og de samme typene. Den skriver ikke big endian.

### Feilledningen

Noder som snakker med omverdenen har `err` inn og `err` ut. En feil er en post: et flagg, en numerisk kode, kildeteksten og noden den kom fra. En node med en feil inn gjør ikke noe arbeid og sender feilen videre, så én feil i starten av en kjede hopper over alt etter og vises én gang på slutten. Koble en feil til `err`-kroppsutgangen på en løkke, så stopper løkken på den, med feilen på løkkens feilutgang. En feilindikator i panelet blir rød ved en feil og slukker når neste verdi kommer uten feil.

### Et mål som går ned

En varig `dia-mqtt-out` sender rett til megleren så lenge den svarer. Når den ikke gjør det, lagres meldingen i Flows varige lager før noden er ferdig, og en pumpe leverer køen, eldste først, når forbindelsen er tilbake. Alt som legges inn mens andre venter, havner bak dem, så ingenting forbikjører noe. Levering fra køen skjer minst én gang: en melding der sendingen fikk tidsavbrudd fordi klienten ikke hadde merket at forbindelsen var borte, kan likevel leveres når klienten kobler til igjen, så den kan komme to ganger, én for hver sending som fikk tidsavbrudd. Køen ligger i samme lager og under samme diskkvote som en varig ledning, og den tømmes etter en omstart uten kjøring og uten nettleser. Uten varig er en melding megleren går glipp av, en feil på feilledningen.

### En database som går ned

`dia-postgres-out` skriver hver post den får som én rad, i tabellen du navngir, gjennom en `hotloop-flow-postgres`-server. Feltene i en post går inn i kolonnene med samme navn, så en post med `n` og `sensor` fyller kolonnene `n` og `sensor`. List kolonnene, kommaseparert, for å skrive bare noen av dem eller bestemme rekkefølgen; la listen stå tom, så bruker noden feltene i posten. Noden kjøres én gang for hver runde i en løkke, så en løkke skriver én rad per runde. En tabell eller kolonne som ikke er et vanlig navn, er et problem ved distribusjon, aldri en setning midt i en kjøring. Et heltall går like godt inn i en integer-, float- eller numeric-kolonne, og en post eller et array går inn som det er, noe en json- eller jsonb-kolonne tar imot.

Navngi en **tidskolonne**, så får hver rad tidspunktet den kom til noden. Det er tidspunktet avlesingen ble gjort, ikke tidspunktet den ble skrevet: en rad som ventet fem minutter på disk, bærer fortsatt minuttet den ble laget.

Uten **Behold det databasen går glipp av** er en rad databasen ikke tar imot, en feil på nodens feilledning, og den er borte. Med alternativet går raden rett inn så lenge databasen svarer. Når databasen ikke svarer, lagres raden i Flows varige lager før noden er ferdig, og nodens utgang `sent` sier `false`. Radene venter på disk, overlever en omstart og skrives i rekkefølge når databasen er tilbake, uten at noe som legges inn etter dem, forbikjører dem. Et etterslep skrives med mange rader per setning, opptil 256, så et som har bygd seg opp mens databasen var borte, tas igjen på sekunder og ikke i tempoet til én rundtur per rad. Testen lar 30 000 rader vente på disk, størrelsen på fem minutter med 100 i sekundet, og alle skrives i rekkefølge i løpet av sekunder etter at databasen er tilbake.

Levering fra disk skjer minst én gang. En rad der innsettingen ble sendt da forbindelsen døde, kan ha blitt lagret med svaret tapt, og den sendes på nytt, så den kan skrives to ganger, i verste fall én batch. Hvis det har noe å si, gi tabellen en unik nøkkel og velg **Hopp over raden** for Ved konflikt: den andre kastes da av databasen.

En rad databasen avviser på grunn av innholdet, for eksempel en verdi som er for stor for kolonnen eller en nøkkel som allerede finnes mens Ved konflikt står på Gi en feil, ville blitt avvist hver gang. Den slippes med en revisjonshendelse, `diagram.row_rejected`, som bærer raden, og radene bak den skrives. Uten det ville én dårlig rad stoppet loggen. En database som er nede, en tabell som ikke finnes ennå og et feil passord er ikke dette: de radene venter.

### Instrumenter

`dia-instr-open` tar en adresse: `10.0.0.5:5025` for et LAN-instrument på en rå socket, `serial:///dev/ttyUSB0?baud=19200&data=8&parity=E&stop=1` for et serielt, eller bare `/dev/ttyUSB0` eller `COM3` for 9600 8N1. Kjøringen lukker økten når den slutter. Hvis forbindelsen faller ut, åpner neste spørring den igjen, og bruddet telles på økten.

`dia-instr-query` skriver en kommando og terminatoren, og leser så svaret. Velg tekst (en linje, ut av `reply`), none (en ren skriving) eller block, som leser en binær blokk `#41024...` og legger samplene ut av `samples` som et array, som int8, uint8, int16, uint16, int32, float32 eller float64, big eller little endian. En ubestemt `#0`-blokk slutter ved første linjeslutt. Et svar som ikke kommer i tide, er et tidsavbrudd på feilledningen med adressen.

`dia-scpi-parse` leser et tekstsvar som en liste med tall, ett tall, en identitet (`*IDN?` til produsent, modell, serienummer og firmware) eller en statusbyte (`*STB?` eller `*ESR?`) til navnene på de satte bitene.

### Serie

En port som forsvinner, for eksempel en frakoblet kabel eller en utplugget adapter, er en feil på feilledningen til lesingen. Neste lesing prøver å åpne den igjen, én gang i sekundet, og teller tapet og returen. En port har flytkontroll, ingen, maskinvare (RTS og CTS) eller programvare (XON og XOFF), på Linux, satt på selve terminalen; en pseudoterminal viser at innstillingen kom frem, og hva linjene gjør på en ekte adapter, er ikke vist.

### Datainnsamling

`dia-daq-read` leser en oppgave fra NI-maskinvare, for eksempel et CompactDAQ-chassis, gjennom NIs egen åpne gRPC Device Server. Flow snakker med serveren over nettverket, så maskinvaren kan stå på en annen maskin enn Flow, og Flow trenger ingen NI-driver og intet eget leverandørbibliotek. Det forblir én statisk binærfil.

**På maskinen maskinvaren er koblet til**, installer NIs DAQmx-driver og NIs gRPC Device Server (https://github.com/ni/grpc-device, MIT-lisensiert). Serveren lytter bare på den maskinen (`localhost`, port 31763) til konfigurasjonsfilen sier noe annet. For å nå den fra Flow på en annen maskin, sett `address` i `server_config.json` til `[::]` eller grensesnittet du vil bruke, og slå på TLS ved å sette `server_cert`, `server_key` og, for gjensidig TLS, `root_cert`, med filene i mappen `certs` ved siden av konfigurasjonen. NIs README har detaljene for versjonen du kjører. La ikke serverens usikrede standardport stå åpen på et fabrikknettverk: alle som kommer til den, kan styre maskinvaren.

**I noden** setter du:

* `address` til `host:port` for serveren.
* `tls` til `off` (bare for en server på samme maskin), `on` (Flow sjekker serverens sertifikat mot `caFile`, eller systemets sertifiseringsinstanser hvis den er tom) eller `mutual` (Flow legger også frem `certFile` og `keyFile`, som serveren sjekker mot sin `root_cert`). `serverName` er navnet det skal letes etter i serverens sertifikat når det ikke er verten i `address`.
* `device` og `channels` for å navngi maskinvaren, for eksempel `cDAQ1Mod1` og `ai0:3`, eller en liste som `ai0, ai2`. `kind` er `voltage`, `current` eller `thermocouple`, med `min` og `max` for området du venter og `terminal` for koblingen. Termoelementer tar en `tcType` og en `unit` og bruker modulens egen kaldsammenkoblingskompensasjon.
* `mode`, `rate` og `samples`. Endelig modus tar én innsamling av `samples` per kanal med `rate` ved hvert kall, og starter den på nytt hver gang. Kontinuerlig modus starter oppgaven ved første kall, og hvert kall leser neste `samples`, så en node i kroppen til en løkke leser en strøm blokk for blokk. `trigger` starter oppgaven på en digital flanke på en terminal som `/cDAQ1/PFI0`.

`y` er samplene som et array for én kanal, eller et array av arrayer, ett per kanal i den rekkefølgen du navngav dem. `dt` er sekundene mellom samples, én delt på raten, så lengden på en blokk i sekunder er antall samples ganger `dt`: 1 000 samples med 1 000 samples i sekundet dekker 1,000 s. Enhetens egen klokke tidfester samplene, som alltid. Flow flytter bare dataene. En avvisning fra serveren eller driveren kommer ut på `err` med driverens egen kode og tekst, og en server som ikke svarer innen `callTimeoutSec`, er et tidsavbrudd. Oppgaven lever så lenge kjøringen og ryddes bort på serveren når kjøringen slutter, så maskinvaren er fri igjen.

Hva som er gjort: analog spenning inn, analog strøm inn og termoelementtemperatur inn, endelig eller kontinuerlig, med samplingsklokke og en valgfri digital starttrigger. Hva som ikke er: digitale inn- og utganger og tellere bruker andre lesekall og er ikke bygd, og det samme gjelder skriving, andre triggertyper eller skalering ut over det modulen selv gjør.

Noden er kjørt mot en stand-in-server som snakker de samme kallene og svarer med en sinusbølge, og på ekte maskinvare (2026-11-17).

## Panelet

`/panel/<diagram id>` på en kjøretid åpner en side med kontrollene, indikatorene og diagrammene til diagrammet, pålogget på samme måte som editoren. Den er bygd for å brukes med tommelen: ingenting på den er mindre enn en finger. Et diagram beholder de siste 1 024 punktene hvis du ikke endrer det, og sier hvor mange det har sluppet. En graf erstatter dataene sine med hvert array. Et XY-diagram tegner x mot y og beholder også historikk. Et intensitetsdiagram tar et rutenett, et array av rader med tall som alle er like lange (opptil 512 ganger 512), og tegner hver verdi som en farge fra den minste til den største i det, og erstatter bildet med hvert rutenett; et flatt array eller et ujevnt rutenett er en feil på nodens feilledning.

Flere personer kan se på én kjøring. Å sette en kontroll fra nettleseren trenger `diagram.run`, sjekkes på serveren og skrives i revisjonsloggen.

## Kontroller

En `dia-control` har en **type** (hva den holder) og et **utseende** (hvordan panelet tegner den). Serveren sjekker hver verdi mot typen, uansett utseende, så et skript som kaller `PUT /diagrams/{id}/controls/{node}`, holdes til de samme reglene som en finger. Det en operatør setter, står i panelet så snart diagrammet er distribuert, før første kjøring, og kontrollnoden gir diagrammet den verdien hver gang den kjøres.

| Type | Utseender | Hva diagrammet leser |
|---|---|---|
| `number` | `entry` (skrevet), `spin` (skrevet, med en minus- og en plussknapp som går i steg av `step` og stopper ved området), `slider`, `knob` | et tall, holdt til `min` og `max` når de er satt |
| `bool` | `switch`, `button` (et trykk setter den til true, og `latch` setter den tilbake når diagrammet leser den), `led` (en LED du trykker på) | sant eller usant |
| `string` | en tekstboks | tekst |
| `enum` | en nedtrekksliste med `options` | ett av alternativene |
| `array` | en liste operatøren legger elementer til i og fjerner elementer fra | en liste med tall, brytere eller tekst, etter `elem`; `min` og `max` holder hvert tall, og `maxlen` holder lengden |
| `record` | én inngang per felt | et objekt med nøyaktig `fields` (`rate:number, on:bool, note:string`), hvert felt alltid til stede |

En slider og en knob trenger en minste og en største verdi. En knob uten begge er en advarsel ved distribusjon og tegnes som en skrevet inngang til den har dem (en slider gjorde allerede det samme). Knoben er en skive som sveiper 270 grader: dra rundt den med en mus eller en finger, trykk på den for å sette den dit, eller bruk piltastene (ett `step`), Page Up og Page Down (ti steg), Home og End. Den skriver når du slipper. Startverdien til et array er JSON (`[1, 2, 3]`) eller en vanlig kommaliste (`1, 2, 3`), og startverdien til en post er et JSON-objekt (`{"rate": 3}`); et felt som er utelatt, starter tomt. En post uten felt, et ukjent feltnavn eller en startverdi som ikke passer, er et problem ved distribusjon.

Hver knapp, inngang, bryter og skive i panelet er minst 44 piksler i begge retninger, og siden ruller ikke sidelengs på en telefon på 390 piksler.

En kontroll skrives når den endres, og diagrammet leser den når kontrollnoden kjøres; det finnes ingen kontroll som starter en kjøring eller utløser en node av seg selv når den endres. Det er hendelsesstrukturen, og den er ikke bygd.

## Hva dette ikke er

Et diagram kjøres i en Go-prosess på et generelt operativsystem. Søppelrydding og planleggeren kan forsinke en node med millisekunder, så en node kan ikke love en frist. Arbeid som må holde en frist, hører hjemme i en PLS eller en kjøretid bygd for det. Tidsstyringen av samples fra en datainnsamlingsenhet påvirkes ikke av noe av dette: enhetens egen klokke tar seg av den, og Flow flytter bare dataene.

## Tester av et diagram

En flyttestfil kan inneholde en test av et diagram ved siden av meldingstestene. Den setter diagrammets kontroller, kjører det én gang med den ekte diagrammotoren og sier hva indikatorene holder:

```yaml
tests:
  - name: weighs and flags a heavy load
    diagram:
      name: Scale logger          # the diagram's name or id
      controls: {Limit: 10}       # by label or id, checked like an operator's entry
      expect:
        Weight: 12.5              # a number matches to within a millionth
        Heavy: true
        Reading: {min: 12, max: 13}
```

En kontroll diagrammet ikke har, en verdi det avviser, en indikator som ikke er en, et navn to ting deler, og et diagram som ikke kan kjøres, er feil med årsak. Et diagram med en node som ville nådd utenfor testen (en serieport, et instrument, en datainnsamlingsenhet, MQTT ut, en HotLoop-skriving, en loggfil), avvises, fordi en diagramtest ikke har noen stand-in for dem. En skriptet serieenhet, for å teste en frakoblet kabel eller en rekke søppelrammer, er ikke bygd.

## Feillisten i CI/CD

`hotloop-flow test` og distribusjonsporten kjører editorens sjekk på hvert diagram i flytfilen. Et diagram som ikke kan kjøres, listes som `--- DIAGRAM: <diagram>: <node> input <port>: <reason>` og lar filen feile selv om hver test består; JUnit-rapporten bærer hver som en feil av typen `diagram`. En advarsel, for eksempel en case-struktur uten standard, listes og lar ikke noe feile.

## Bølgeformer

En bølgeform er en blokk med jevnt fordelte samples som vet når den startet og hvor langt det er mellom dem, som en post på ledningen: `{"type": "waveform", "t0": "2026-11-14T12:00:00Z", "dt": 0.001, "y": [...], "attrs": {"unit_string": "V"}}`. `dia-wave` bygger en fra et array (steget fra `dt`, ellers `rate`, ellers innstillingen; starten fra `t0`, ellers øyeblikket den kjøres) og `dia-wave-parts` tar en fra hverandre, inkludert hvor lenge den varer. En bølgeform holder høyst `maxSamples` samples (1 048 576 som standard); resten kuttes og telles på `dropped`. Analysenodene godtar en bølgeform der de tar et array og bruker steget dens. `dia-log-tdms` skriver en bølgeformkolonne som en kanal med `wf_start_time`, `wf_increment`, `wf_samples` og attributtene som kanalegenskaper.

## Underdiagrammer

`dia-sub` er et diagram brukt som en node: inngangene og utgangene er kontakten, hver inngang en `dia-body-in` med det navnet i kroppen sin og hver utgang en `dia-body-out`. En inngang er påkrevd med mindre navnet slutter på `?` (valgfri) eller `~` (anbefalt: den kjøres uten, og distribusjonen advarer når den ikke er koblet). Velg noder og lag et underdiagram av dem (`POST /diagrams/{id}/sub`), så flytter nodene til en ny kroppsfane, en `dia-sub` tar plassen deres, og kontakten utledes av ledningene som krysser kanten av utvalget: en inngang for hver kildeutgang som mater utvalget, en utgang for hver valgte utgang som mater nodene utenfor. Ledningene utenfor kobles til igjen, så en kjøring gir de samme svarene som før.

## Delte posttyper

En posttype navngis én gang, i innstillingene til en diagramfane, under `types`, og hver `dia-bundle` eller `dia-field` som setter `shape` til navnet, sjekkes mot den ene definisjonen:

```json
{"types": {"Reading": {"fields": {"pressure": "number", "ok": "boolean", "state": {"enum": ["idle", "run"]}}}}}
```

Et felt er `number`, `integer`, `boolean`, `string`, `timestamp`, `array`, `waveform`, `record:Name` (en annen delt type) eller en enum. Gi et felt nytt navn i definisjonen, og hver bundle som fortsatt bruker det gamle navnet, er et problem ved neste distribusjon, i samme feilliste som en ukoblet inngang, med noden og feltet. En bundle holder hver verdi til typen til feltet sitt når den kjøres, og feilledningen bærer en verdi som ikke passer. `Set.Schema` gir den samme typen som JSON Schema, som er det typede ledninger sjekker.

## Rotasjon og oppbevaring

`dia-log-text` og `dia-log-tdms` kan starte en ny fil når den aktive når `rotateMB` megabyte eller `rotateHours` timer, og beholde bare de nyeste `keep` ferdige filene. Den ferdige filen får navnet til loggen med tidspunktet den ble lukket før filendelsen (`bench.csv` blir `bench-20261114T120000Z.csv`), og loggen fortsetter i `bench.csv`, med en ny overskrift, eller med filegenskapene skrevet på nytt for TDMS. Oppbevaringen sletter bare filer som passer det mønsteret, aldri den aktive loggen og aldri en fil som bare ligger ved siden av. Alderen telles fra første gang en kjøring skriver til filen. Tekstloggen åpnes i et regneark, og TDMS-loggen er det binære formatet for store data.

## Redigere en case-struktur og velge et diagram

Casene i en case-struktur er rader med et casenavn og en diagramvelger, med en andre velger for standardcaset, og egenskapen som navngir diagrammet en løkke eller et underdiagram kjører, er også en velger. Velgerne lister FlowLab-diagrammene i flytfilen og lagrer id-en til fanen; et navn skrevet for hånd i en eldre flytfil vises som den fanen og lagres som id-en dens, som kjøretiden leser på samme måte. De lagrede verdiene er den samme JSON-en som før (`cases` er et objekt fra casenavn til diagram), så en flytfil redigert i dialogen og en redigert for hånd er den samme filen.

## Åpne et underdiagram på stedet

En underdiagramnode har en liten boks i øvre høyre hjørne. Trykk på den, eller velg noden og trykk **Åpne på stedet** i diagramlinjen, så tegnes noden åpen der den var: en ramme med navnet på underdiagrammet, kontakten navngitt på de to kantene (inngangene til venstre, utgangene til høyre, med portene `after` og `done` og feilledningen som på enhver node), og inni den nodene og ledningene i kroppen. Ingenting åpnes i et andre vindu, og fanen du er på, endres ikke. Ledninger som gikk til noden, går til kontakten på rammen, og en svak stiplet linje går fra hvert kontaktnavn til body in- eller body out-noden med det navnet. Boksen i tittellinjen til rammen (eller **Lukk på stedet**) lukker den igjen.

Det som tegnes inni rammen, er kroppens egne noder, ikke en kopi. Velg en, dra den, dobbeltklikk for egenskapene, endre verdien eller slett den, så har du redigert kroppen, som ett steg som kan angres, og en distribusjon lagrer det. Å flytte rammen i tittellinjen flytter underdiagramnoden, og kroppen følger med. En ledning forbinder to noder i ett diagram, så en ledning fra en node utenfor til en node inni avvises med ord; koble til kontakten på rammen. Zoom, panorering, tilpasning og markeringsrammen virker som ellers.

Hvilke underdiagrammer som er åpne, er måten du ser på diagrammet. Det står ikke i flytfilen, det er ikke et angresteg, og en omlasting lukker alle, så å åpne ett endrer aldri det en distribusjon sender. Et underdiagram inni et åpent har sin egen boks og kan også åpnes, tre nivåer ned. En kropp som allerede er åpen et annet sted, åpnes ikke en gang til, og et underdiagram der kroppen fører til et diagram som allerede er åpent, tegnes lukket, så et diagram som inneholder seg selv, ikke kan sende editoren i løkke. En kropp som ikke er navngitt av noe, eller av et navn to diagrammer deler, har ingen boks, fordi kjøretiden heller ikke kan finne den. Løkker og case-strukturer eier også kropper og åpnes ikke på stedet ennå.

## Lage et underdiagram i editoren

Med noder valgt i et diagram ber **Utvalg til underdiagram** i linjen om et navn, kaller `POST /diagrams/{id}/sub` med flytfilen editoren holder, og laster svaret som én redigering som kan angres: nodene flytter til en egen fane og en underdiagramnode tar plassen deres, med inn- og utganger utledet av ledningene som krysser utvalget. Ingenting lagres før det distribueres.

## Spille av en kjøring

Uthev kjøringen bremser en kjøring mens den pågår. **Spill av siste kjøring**, nederst på lerretet, spiller av en kjøring som allerede er over, fra det den tok opp, så du kan følge den i etterkant. Den lyser opp ledningene og markerer nodene slik den levende kjøringen gjorde, én hendelse om gangen, i farten du velger (Sakte, Normal, Rask eller Veldig rask), og når den er ferdig, viser lerretet det kjøringen etterlot. **Stopp avspilling** avslutter den tidlig. Den endrer ingenting i kjøretiden og starter ingenting: knappen er av mens en kjøring pågår, og en avspilling slutter når du går til en annen fane.

Hver kjøring tar opp start og slutt for nodene og hver verdi som gikk over en ledning, opptil 20 000 hendelser. En lengre kjøring beholder de første 20 000, sier det når du spiller den av, og avspillingen viser den starten, fordi en avspilling som begynte midt i, ikke ville hatt noe å starte fra. Verdiene lagres som de korte forhåndsvisningene ledningene viser, så et array med tusenvis av samples er lengden og de første verdiene. Opptaket er det fra siste kjøring, og en ny kjøring erstatter det; det lagres ikke over en omstart. `GET /diagrams/{id}/trace` er det samme opptaket for et skript.

## Ryddig oppsett

**Rydd opp i oppsettet** i fanelinjen legger ut nodene i visningen slik at data leses fra venstre mot høyre og ingen ledning går gjennom en node. Kolonnen til en node er den lengste kjeden av ledninger som fører til den. En ledning som hopper over kolonner, får en bane gjennom dem, nodene i en kolonne ordnes for å løse opp kryssene, og så sjekkes hver lang ledning langs kurven den faktisk tegnes med, mot nodene i kolonnene den krysser, og en node i veien flyttes unna. Blokken beholder øvre venstre hjørne, og det hele er én redigering som kan angres. I en løkke i koblingen holdes ledningen som lukker den, utenfor rangeringen, så den går baklengs i stedet for å sende oppsettet i løkke.

## Ledningsnavn

En ledning i et diagram navngis midt på, etter utgangen den kommer fra (`sum`, `result`, `iterations`), ved siden av typen når en av endene deklarerer en, og å holde pekeren over viser fortsatt den siste verdien den bar.

## Zoom

Lerretet zoomer fra 5 prosent til 400 prosent rundt pekeren, og leser zoomen som `data-zoom` på lerretet.

## Sette et panelobjekt med navn

`dia-panel-set` endrer én egenskap på en kontroll eller en indikator mens diagrammet kjøres, etter navnet på objektet (eller id-en): `visible` og `enabled` tar true eller false, `color` tar red, amber, green, blue, gray eller default, `label` tar tekst, og `min` og `max` tar et tall for en tallkontroll. En deaktivert kontroll avviser det en operatør setter, et skjult objekt tegnes ikke, og panelet en operatør har åpent, følger med. Et navn som ikke treffer noe objekt, eller mer enn ett, er et problem ved distribusjon når det skrives på noden, og en feil på ledningen når det kobles inn, og en kjøring starter fra panelet slik det ble utformet.

## Symboler

Hver FlowLab-nodetype tegnes med et eget symbol midt i kroppen (et pluss for matte, en sigma for statistikk, en sinus for en bølgeform, en plugg for en serieport), ved siden av tekstetiketten. De er enkle streker tegnet i `web/src/lib/symbols.ts`, ikke en ikonfont eller noens kunstverk, og en test feiler når en diagramnodetype navngir et ikon som ikke er tegnet.

## Skrive til utstyr: skriveporten

Et diagram styrer utstyr på én måte: `dia-hotloop-write`. Den sender verdien sin til en tag i HotLoop (`device/tag`, satt på noden eller koblet inn) gjennom HotLoops skriveport, som i sin egen rekkefølge avgjør at skriving er slått på, at taggen er armert og at verdien er i området. Flow skriver aldri til en maskin selv. HotLoop registrerer hvert forsøk, avvist eller ikke, med årsaken `flow:<diagram>/<node id>`, så revisjonssporet navngir diagrammet og noden. Et avslag er en feil på nodens feilledning med portens egen årsak (kode 5006), og det samme er en HotLoop som ikke kan nås; i begge tilfeller skjer ikke skrivingen, og noden nekter å distribueres uten at en HotLoop er valgt. De rå seriell- og instrumentnodene snakker med benkinstrumenter (multimetre, strømforsyninger, laster), som ikke har noen tag i HotLoop, så de har en egen bryter (under).

## Instrumentenes skrivebryter

Å lese et instrument endrer ingenting og er alltid åpent. Å skrive til et kan endre noe: utgangen på en strømforsyning, høyspenningen i en hipot, strømmen i en last. Derfor starter hvert instrument med skriving **av**, og en skriving fra et diagram avvises til noen med tillatelsen `instrument.write` slår på skriving for det instrumentet, ett instrument om gangen.

- **Hva som regnes som skriving.** `dia-serial-write` er alltid skriving. `dia-instr-query` er lesing når kommandoen er en spørring (hver SCPI-setning i den slutter på `?`, som `*IDN?` eller `MEAS:VOLT?;MEAS:CURR?`) og skriving ellers (`OUTP ON`, `VOLT 5`, `*RST` eller `VOLT 5;MEAS:VOLT?`). En kommando som kobles inn, regnes som en som kan skrive.
- **Hvilket instrument.** Instrumentet er adressen sin: `tcp://host:port` eller `serial:///dev/ttyUSB0`, uten serieinnstillingene, så ett instrument åpnet på to måter er én bryter.
- **Et avslag** er en feil på nodens feilledning (kode 5007) som sier at skriving til det instrumentet er slått av, og instrumentet hører aldri kommandoen.
- **Slå det på.** `PUT /instruments/writes` med `{"instrument": "tcp://10.0.0.5:5025", "allowed": true, "note": "bench 2"}`, som trenger `instrument.write` (en administrator har den) og lagres i `instrument-writes.json` i datamappen, så en omstart endrer ingenting. `GET /instruments` lister hvert instrument med en bryter eller et distribuert diagram som ville skrevet til det, med hvem som satte den og diagrammene og nodene det gjelder.
- **Revisjon.** Hver endring av bryteren er `instrument.switch`, og hver skriving et diagram gjør, er `instrument.write` eller, når den avvises, `instrument.refused`, med diagram, node, instrument og kommando.
- **Distribusjonen sier fra.** En node som ville skrevet til et instrument, er en merknad på diagrammet (**merknadene** i linjen, og listen `hotloop-flow test` skriver ut), som navngir instrumentet og sier at skriving er av til noen slår den på. Flytfiler som bare leser, er uendret.

## Ta med en LabVIEW-VI

Importer en `.vi` i editorens importdialog (eller `import_vi` over MCP, eller `POST /flows/import-vi`), så leser FlowLab det den kan, og lister, før noe legges til, det den ikke kunne. Les docs/labview-import.md: den sier nøyaktig hva som kommer med og hva som ikke gjør det. Kortversjonen: navnet på VI-en, beskrivelsen, versjonen, navnene på frontpanelet og VI-ene den kaller, kommer med, som en merknad på en egen flyt. Ledningene og primitivene i blokkdiagrammet kommer ikke med, så diagrammet tegner du selv, med de navnene ved siden av.
