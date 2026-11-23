---
title: "Utgivelsesnotater: HotLoop core 4.19.4"
description: "Hva HotLoop core 4.19.4 gir deg, hva som endrer seg ved oppgradering og hva du bør lese før du rører et anlegg i drift."
sidebar:
  label: "4.19.4"
---

4.19.0, 4.19.1, 4.19.2 og 4.19.3 ble tagget og aldri utgitt, så ingenting med noen av de navnene finnes, og `stable` flyttet seg aldri til noen av dem. Dette er den første versjonen med alt notatene deres lister, og det inkluderer én ting som er nytt siden 4.19.1: chartene tar `hostNetwork`.

- 4.19.1 la til rettingen for det og én til (en discovery-lytter som sa den var oppe før den kunne høre, se nedenfor) og ble hoppet over før den ble utgitt.
- 4.19.2 la til `hostNetwork`.
- Begge er rettet nedenfor.
- Alt i notatene for 4.19.0 (MCP, skalerte skrivinger, store-innloggingen, CODESYS, Kafka-hendelsesstrømmen, OPC UA PubSub over UADP og rettingene) står i notatene nedenfor.

Det som er nytt siden 4.19.1: chartene har en innstilling `hostNetwork`.

## hostNetwork

Hvert HotLoop-chart med en pod (chartene for Gateway, IoT og Edge og det for Edge Relay) tar `hostNetwork: true`. Det er av som standard, og med det av rendrer chartet nøyaktig det 4.19.1 sitt gjorde.

- **Hva det er til for.** En pod som må høre det noden hører: UDP-multicast på nodens loopback (en PLS-runtime på samme boks som publiserer OPC UA PubSub til en multicast-gruppe over loopback), eller et andre nettverkskort. Et pod-nettverk bærer ingen av delene.
- **Hva det gjør.** Deployment får `hostNetwork: true` og `dnsPolicy: ClusterFirstWithHostNet`, så DNS-navnene i klyngen fortsetter å løses.
- **Hva det betyr for poden.** Den bruker nodens adresser og porter: siden svarer på hver adresse på noden på `service.targetPort`, så velg en port ingenting på noden bruker, og behold autentisering på. En NetworkPolicy gjelder ikke for en host-network-pod (klyngens nettverksplugin ignorerer dem). Fest poden til noden sin med `nodeSelector`.
- **En lytter på loopback.** OPC UA PubSub-abonnenten går inn i en gruppe på et navngitt kort, med navn eller adresse: `"interface": "127.0.0.1"` i enhetens alternativer går inn på loopback-kortet.
- **Ingenting annet.** Koden er den 4.19.1 ville ha levert. Release-vakten rendrer nå hvert chart med og uten innstillingen og feiler hvis en av renderingene er feil.

---

Resten av denne versjonen, fra 4.19.0 og 4.19.1:

To ting i 4.19.4 endrer hva et eksisterende anlegg gjør, så les dem før du rører et som er i drift. Agenter over MCP kan skrive nå, og MCP-endepunktet har alltid et token. Og en verdi du skriver til en skalert tag havner endelig i registeret slik du mente, noe som betyr at alle som gikk rundt den gamle oppførselen, må slutte. Alt etter det er nytt, eller en retting.

De fullstendige notatene står i README: Hva som er nytt i 4.19.4.

### MCP er på, det skriver, og det har alltid et token

- **Agenter kan skrive nå, der en operatør kunne.** MCP er på i hvert HotLoop-produkt og leser og skriver. `allowMcpWrites` er true som standard i koden og i alle tre chartene. Et deployment som har `allowWrites` på og aldri satte `allowMcpWrites`, får agentskrivinger etter denne oppgraderingen, gjennom samme port som skjermen: brukerens rettigheter, tagens skrivbar-merke og dens område gjelder fortsatt.
- **`allowWrites` endret seg ikke.** Det er av som standard og avgjør fortsatt om noe kan skrive, både grensesnittet og agentene. Er det av, skriver ingenting, MCP inkludert.
- **Et deployment som lagret `allowMcpWrites: false`, forblir av.** Det gjelder også ett installert fra App Store, som lagrer hvert svar. Slå det om hvis du vil at agenter skal skrive.
- **Endepunktet er aldri åpent.** Chartene setter alltid et MCP-token. En HotLoop som ble startet uten `HOTLOOP_MCP_TOKEN` (en Quadlet-enhet, en bar binærfil) serverte `/mcp` til alle som nådde porten og logget bare en advarsel. Den lager nå et token på 24 byte ved første oppstart og beholder det i databasen sin, så hver replika og hver gjenoppretting bærer det samme. Et kall uten tokenet er en `401`. Et token du har konfigurert, byttes aldri ut.
- **For å få tokenet på en bar eller Quadlet-installasjon:** `hotloop mcp-token` skriver det ut. Hvis du har en agent pekt mot `/mcp` på en slik installasjon uten token, slutter den å virke ved denne oppgraderingen til du gir den tokenet. Det er med vilje.
- **Hvem som gjorde kallet.** Et statisk token sier hvilken klient som kalte, aldri hvilken person. Med OIDC-innstillingene på gjør en Vord-innlogging eller en hub-assertion på `/mcp` at revisjonen navngir personen (`mcp:pat@example.com`), og en valgfri skriverolle snevrer inn skrivinger per kaller på toppen av bryterne ovenfor. Det er av med mindre du setter det, og tokenet fortsetter å virke ved siden av. [MCP-siden](/nb/iot/mcp/) har oppsettet.

### Skrivinger til en skalert tag

- **Hva som var galt.** En tag med skala, si 0.1 på et temperaturregister som holder tidels grader, viser deg ingeniørverdien: registeret sier 555 og skjermen sier 55.5. Skrivingen gikk den andre veien uten samme omsorg. Du skrev 55.5 som settpunkt, og HotLoop la 55 i registeret, som så leste tilbake som 5.5. Det var likt på hver skjerm, gjennom API-et, fra en automasjon, et skript, en oppskrift, en sløyfe og over MCP, fordi alle går gjennom samme skriveport. Revisjonsraden sa 55.5 hele tiden, så ingenting så galt ut i loggen.
- **Hva som endrer seg.** Tallet du skriver er i tagens egne enheter, det samme som tallet du leser. HotLoop tar skalaen og offseten tilbake av før det sender: 55.5 på en tag skalert med 0.1 legger 555 i registeret, og det leser tilbake som 55.5. En tag uten skala og uten offset røres ikke i det hele tatt. Bits, coils, strenger og Sparkplug- og MQTT-skrivinger av et flagg skaleres heller ikke.
- **Hvis du gikk rundt det, slutt.** Hvis noen har skrevet rå tellinger til en skalert tag for å få riktig tall, og skrevet 555 for å få 55.5, sender det nå 5550 og leser tilbake som 555. Skriv ingeniørverdien. Se på de skalerte taggene dine før du oppgraderer: hver tag med en skala annet enn 1, eller en offset, som noen skriver til for hånd, fra en automasjon eller fra en oppskrift, er verdt et blikk. Oppskrifter og automasjoner som skrev tellinger, må få tallene endret til ingeniørverdier i samme steg som oppgraderingen.
- **En verdi registeret ikke kan holde, avvises.** Etter at skalaen er tatt av, avvises en telling som ikke passer i registeret, 7000 på en `uint16` skalert med 0.1, med en tydelig melding som nevner tellingen og registeret, og ingenting sendes. Før løp den stille rundt: 70000 på et 16-bits register gikk ut som 4464. Det gjelder heltallstypene i Modbus, S7, EtherNet/IP og OPC UA.
- **En oppskrift med en verdi som ikke passer, avvises i sin helhet.** Før den første skrivingen kontrolleres hvert mål, så en oppskrift blir aldri halvt anvendt og så avvist. For Modbus, S7 og EtherNet/IP kjenner kontrollen registertypen til hver tag fra adressen. For OPC UA, som er veien til en CODESYS-runtime, bruker den typen taggens siste lesing kom som. En tag som aldri har blitt lest siden HotLoop startet, har ingen type å sjekke mot ennå, så en oppskrift som peker på den, avvises ved den taggens egen skriving, etter at målene før den ble skrevet, og applikasjonen logger hvilke. Å lese den én gang, noe pollingen gjør innen et sekund etter tilkobling, løser det.
- **En brøkdel av en telling kuttes bort.** Et register holder hele tellinger, så 12.34 på et register med tidelsskala holder 12.3, slik det alltid gjorde.
- **Hva som ikke endret seg.** Områdekontrollen på en tag og revisjonsraden bruker tallet du skrev. Skriveporten, rettighetene og avvisningsreglene er de samme.

### En store-installasjon logger deg inn som deg selv

Chartet lagde et tilfeldig adminpassord i en Secret tenanten ikke kan lese, så en store-installasjon havnet på en innlogging uten vei videre. Med dashbordets offentlige nøkkel konfigurert, logger en forespørsel med en gyldig signert assertion for denne tenanten og denne Service den personen inn, lager brukeren deres første gang, holder rollen deres i takt med det dashbordet sendte, og revisjonssporet navngir dem. En dårlig, utløpt assertion, eller en for feil tenant eller feil app, avvises, og lokal innlogging er urørt. Det er av med mindre en nøkkel er satt, og de tre produktchartene henter nøkkelen fra storen. [Autentisering og brukere](/nb/iot/authentication/) har innstillingene.

### CODESYS, med navnene programmereren ga variablene

HotLoop leser og skriver en CODESYS-PLS gjennom runtimens egen OPC UA-server, slik CODESYS dokumenterer: applikasjonens Symbol Configuration, publisert under PLCopen IEC 61131-3-modellen. Discovery lister det applikasjonen eksporterer med typene og tilgangen programmereren ga dem, og går inn i arrays og strukturer, og en tag er et IEC-symbol som finnes under det prosjektet kaller PLS-en og applikasjonen sin. En omstart, en nedlasting eller en tapt link leses som dårlig med årsaken og kommer tilbake uten at noen gjør noe. Vi beviste det i testing mot en ekte 4.22.0.0-runtime som kjørte vårt eget program, med en skriving som PLS-ens egen logikk svarer på, og mot et andre program med over hundre tusen variabler, lest på 2.4 sekunder.

Dette berører en driver anlegg kjører, så uten omsvøp: OPC UA-driveren ba om 200 noder per forespørsel og leste aldri hva serveren tillater. En CODESYS-runtime publiserer OperationLimits på 100 og avviser mer, og driveren svarte med å erklære hver oppdaget tag som float og ved å lese ingen av taggene til en enhet med mer enn hundre. Forespørsler kuttes nå til grensene serveren publiserer ved tilkobling, og halveres når en server som ikke publiserer noen, sier det er for mange. En datatype som er en undertype av en standard (en CODESYS STRING, BYTE eller TIME) følges opp til standardtypen, så den types og skrives som den. Hver OPC UA-enhet får dette, ikke bare CODESYS-enheter.

### En Kafka-hendelsesstrøm

- **Hva det er.** HotLoop kan sende målingene sine og systemloggen sin til enhver megler som snakker Kafka-API-et: Apache Kafka, Redpanda og resten av den familien. Det er en ny type historian-mål, under Settings, Historian targets, så det har køen, innhentingen fra HotLoops egen historikk og statusen de har. Målingene går til ett topic og systemloggen (alarmer, enheter som går opp og ned, endringer) til et annet, som JSON.
- **TLS og SASL.** SCRAM-SHA-256, SCRAM-SHA-512 og PLAIN (PLAIN bare over TLS), med din egen CA hvis meglerens sertifikat ikke er fra en offentlig. Klientsertifikater, Kerberos og OAuth-innlogginger støttes ikke ennå.
- **Det er minst én gang.** En måling kan komme to ganger etter et avbrudd, fordi innhentingen med vilje overlapper det som allerede har gått ut. `deviceId`, `tag` og `ts` navngir en duplikat. Hendelser er direktefeeden og har ingen historikk å hente inn, så en som produseres mens megleren er borte, går tapt, og målets status teller den.
- **En megler som forsvinner midt i en skriving.** Målet går ned innen 25 sekunder og målingene i den skrivingen skyldes, i stedet for å bli stående oppe med køen som flyter over.
- **Et topic laget et øyeblikk siden.** Det første blikket på et topic som nettopp ble laget, av deg eller av målets egen siste forsøk, venter på at det finnes og har en leder i stedet for å melde målet ned.
- **Hva det koster.** Omtrent 5 MiB på binærfilen til hvert produkt med en database. Edge Relay har ingen historian-mål og bærer det ikke. Klienten er franz-go, oppgitt i `NOTICE`.
- **Oppgradere.** Migrering 0026 legger til en `options`-kolonne på historian-målene, tom for hvert mål som finnes. Ingenting endrer seg for dem. [Historian-mål](/nb/iot/historian-targets/#kafka-api-hendelsesstrøm) har postformatene og hva som er og ikke er bevist.

### OPC UA PubSub over UADP

- **Abonnere.** En enhet med protokollen `opcua-pubsub` lytter etter en publishers DataSets sendt som UADP over UDP, unicast eller multicast. Adressen til en tag er `<DataSetWriterId>/<field index>`. Variant-, DataValue- og RawData-felt, key-, delta- og keep alive-rammer. En tapt melding merker den writerens tagger som usikre til neste key-ramme, og en taus writer leses som dårlig.
- **Publisere.** Edge og Gateway kan publisere taggene et layout nevner som UADP, av til `HOTLOOP_UADP_PUBLISH_ENABLED` settes. Key-rammer når verdiene endrer seg og keep alive når de ikke gjør det. En dårlig tag publiseres som sin status, aldri som sin siste verdi.
- **Ikke ennå.** Meldingssikkerhet (signerte eller krypterte meldinger) avvises ved navn, det samme gjelder oppdelte meldinger, discovery, hendelser og strukturfelt. Delta-rammer leses, men sendes ikke.
- **Arrays.** Et felt som er et array, leses i Variant- og DataValue-meldinger, og i RawData når enhetens DataSet sier hvordan det er lagt ut (`"Float[250]"` for et array med antallet, `"Float*250"` for 250 separate felt). En tag navngir ett element, `1000/3[17]`, og Browse lister dem.
- **Hvor den lytter.** Gruppen, porten og nettverkskortet er enhetens egne. En multicast-gruppe på et navngitt kort og en unicast-port på denne maskinen fungerer begge.
- [Protokoller og drivere](/nb/iot/protocols/#opc-ua-pubsub-uadp) har oppsettet og grensene.

### Images, og et andre sett skjermer

- **Bare amd64, denne ene gangen.** 4.19.4-imagene er bygd for amd64. Versjonstaggen lister amd64 alene, og `stable` og `latest` bærer det nye amd64-imaget ved siden av arm64- og arm/v7-imagene de allerede hadde, som er forrige versjons. En arm-boks som følger `stable`, fortsetter å hente og kjøre det den kjørte. Neste versjon bygger alle arkitekturer igjen og er en versjonsøkning uten noe annet.
- **De nye skjermene ligger på `/next`.** Et ombygd webgrensesnitt er i hvert image bak det gamle, som fortsatt er det du får på `/`. Prøv det på `/next` på en hvilken som helst installasjon; ingenting endrer seg for standarden.

### Rettinger

- **En prosess stopper ikke lenger neste kjøring av et skript med sitt eget stopp som kommer tilbake til den.** Å stoppe et skript kunngjøres til hver prosess, også den som gjorde stoppet, og kunngjøringen som ble hørt igjen et øyeblikk senere, avbrøt den kjøringen av skriptet som da pågikk: under last ble en ventet kjøring avbrutt 8 ms etter at den begynte, og en annen ble aldri ferdig. En prosess ignorerer stoppet den selv kunngjorde, og et stopp en annen prosess kunngjorde, stopper den fortsatt.
- **En discovery-lytter er oppe når megleren har svart på abonnementene sine, og først da.** En ventetid som gikk ut, telte som et svar, det samme gjorde et svar på en tilkobling som siden var borte; ingen av delene teller lenger, og et svar som kommer sent, teller fortsatt.
- **En discovery-lytter sier den er oppe når den kan høre.** MQTT-sesjonen regnet seg som tilkoblet i det øyeblikket megleren godtok den, og sendte først da ut abonnementene sine og ventet på at megleren skulle innvilge dem. En lytter som meldte seg oppe på det, sendte neste melding inn i gapet, og en enhets status eller konfig som ikke er beholdt, gikk tapt. Den melder seg oppe når abonnementene er innvilget nå, ved første tilkobling og ved hver gjenoppkobling.
- **En pin på boardet visker ikke lenger boardet.** Siden leste bare boardet da board-skjermen åpnet, så en omlasting på tag-skjermen holdt en tom liste og den første pinnen erstattet det lagrede boardet med den ene taggen. Siden leser nå boardet ved start, en pin avvises til den har gjort det, og en lagring bærer boardets `rev`, så serveren svarer `409` på en lagring over et board som har endret seg siden det ble lest. `rev` er valgfri i API-et: utelat den, og lagringen kontrolleres ikke.
- **Et OPC UA-abonnement som står fast, oppdages.** Biblioteket beholder keep alive-ene for seg selv, så en stoppet publiseringssløyfe så ut som et stille anlegg og serverte de siste verdiene som gode. Etter ti publiseringsintervaller med stillhet (minst tretti sekunder) leser driveren nodene én gang, sammenligner dem med det den har, og faller tilbake til lesing hvis noen skiller seg.
- **En PLS som blir taus med socketen åpen, er nede, ikke svekket.** Modbus, S7 og EtherNet/IP beholdt sine siste verdier til TCP ga opp, fordi pollingen kom tilbake før den bedømte sesjonen. De bedømmer den nå. Ingen S7- eller CIP-server er på kabelen i testing ennå, og veikartet sier det.
- **En legitimasjon skrevet inn i en URL eller fritekst, krypteres i hvile.** Hver skjerm skjulte allerede `mqtt://user:pass@host` og `?token=` for folk, men databasen og sikkerhetskopiene holdt dem som skrevet. En streng som bærer en, etter samme test som sladdingen skjuler den med, forsegles hel og kommer tilbake nøyaktig som skrevet, så driveren fortsatt får URL-en den fikk. En nøkkel som slås på senere, forsegler det som var lagret før, og en gjenoppretting ber om nøkkelen bare når bare en adresse trenger den.
- **Hvert tidspunkt API-et skriver, er UTC.** Et anlegg satt til New York skrev `-04:00` der et på UTC skrev `Z`, over omtrent tretti felt: `created_at`, `updated_at`, `raisedAt` til en alarm, tidspunktet til en hendelse, `lastPoll` til en enhet, tidsstempelet til en tag, en logbook-oppføring, neste kjøring av en rapport. De leses likt på begge nå. Hvis du parser disse i et skript som forventet din lokale forskyvning, får det nå `Z`.
- **Månedlige partisjoner ble hoppet over den 31.** Historikk- og logbook-tabellene lagde sin neste partisjon ved å legge en måned til i dag, og den 31. hoppet det over en måned, så radene fra en måned lå i standardpartisjonen. De starter nå fra den første i måneden.
- **UniFi-hendelsesloggen er sortert etter når hendelsen skjedde,** ikke etter når rammen kom hit, så en avspilling etter en gjenoppkobling slutter å havne øverst.
- **Frontpanelet til en svitsj passer på en telefon.** Åtte porter var bredere enn en 390 piksler bred skjerm, og siden rullet 113 piksler sidelengs. Portene er nå tette fliser, med PoE-wattene i portens detalj, og et frontpanel som fortsatt vokser ut av kortet sitt, ruller inni det.
- **En telefon uten sesjon og uten tilkobling får innloggingsskjermen og årsaken** i stedet for en tom app, og laster på nytt når HotLoop svarer.
- **En tilbakerulling er én kommando.** Chart-indeksen flettes inn i den aktive i stedet for å bygges på nytt fra versjonens egne charts, så en eldre versjon fortsatt løses.

### Oppgradere fra 4.18.11

- Les de to første delene ovenfor før du gjør noe på et anlegg i drift.
- Migrering 0026 er den eneste. Den er additiv, og hver eksisterende rad fortsetter å virke.
- En bar eller Quadlet-installasjon får et MCP-token ved første oppstart. `hotloop mcp-token` skriver det ut.
- `helm upgrade` som vanlig. Quadlet-enheter følger `:stable` og trenger ingenting. `helm rollback` til 4.18.11 er greit for denne versjonen: databasen er allerede PostgreSQL 17, og ingenting her endrer den.
