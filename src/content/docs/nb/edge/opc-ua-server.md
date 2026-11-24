---
title: "OPC UA-serveren"
description: "Publiser konfigurerte enheter og tags som et skrivebeskyttet OPC UA-adresserom, så SCADA-systemet du allerede eier ser alle tags uten ny driver."
---

OPC UA-serveren i HotLoop publiserer, siden 4.13.0, enhetene og taggene som er konfigurert i Gateway som et OPC UA-adresserom. En OPC UA-klient fra en tredjepart, en SCADA-pakke, en HMI, en historian eller et testverktøy som UaExpert kan dermed lese Gatewayens live tags uten at noen skriver en HotLoop-driver for den andre siden.

På som standard (`HOTLOOP_OPCUA_SERVER_ENABLED`), i binærfilen og i Helm-chartet. Den starter med HotLoop-autentisering på og en egen innlogging, `opcua-reader`, som HotLoop lager med et generert passord som Innstillinger viser en administrator (`GET /api/opcua/server`); den kan lese tagger og verdier og ingenting annet. Med HotLoop-autentisering av finnes det ingen brukere å logge inn som, så serveren venter og sier fra (den nekter ikke å starte). Er 4840 allerede tatt av en annen OPC UA-server på boksen, venter den og sier fra; en port du valgte som ikke kan åpnes, er en feil: å åpne en lytter på et anleggsnettverk er noe en driftsetting gjør med vilje. Standardport 4840.

**Den er skrivebeskyttet.** Se [Hvorfor den er skrivebeskyttet](#hvorfor-den-er-skrivebeskyttet). Den leverer også historikken til hver tag: se [Historikk](#historikk).

## Hva som eksponeres

Én **Object**-node per aktivert enhet, rett under standardmappen *Objects*, og én **Variable**-node per aktivert tag under enheten sin. Enheter og tags som er slått av publiseres ikke: de har ingen worker og ingen måling, så å publisere dem ville bare satt en permanent Bad-node foran en klient. Adresserommet er nøyaktig det runtime avspør.

Alt ligger i ett enkelt navneområde, `urn:hotloop:ua:gateway`. Navneområde-URI-en er en konstant og utledes verken fra vertsnavnet eller applikasjons-URI-en: en klient lagrer en node som URI pluss identifikator og finner navneområdeindeksen på nytt ved hver tilkobling, og en URI som endret seg med navnet på en pod ville gjort alle abonnementer i et SCADA-prosjekt foreldreløse. Slå opp indeksen i serverens navneområdeliste med URI-en, slik en ekte klient gjør; ikke anta `ns=2`.

### NodeIds

Identifikatorene er strenger, og de er stabile:

| Node | NodeId-identifikator |
|---|---|
| Enhet | `<deviceId>` |
| Tag | `<deviceId>/<tagName>` |
| Egenskapen `EngineeringUnits` / `EURange` på en tag | `~EngineeringUnits/<deviceId>/<tagName>` og `~EURange/…` |

Tag-formen er `model.TagKey.String()`, skrivemåten `device/tag` som resten av koden allerede bruker, så en NodeId og en tag-nøkkel kan gjøres om til hverandre med `model.ParseTagKey`. Skilletegnet `.` ville ikke fungert: enhets-ID-er kan inneholde punktum, så `a.b.c` kunne vært enheten `a` med taggen `b.c` eller enheten `a.b` med taggen `c`. En enhets-ID kan ikke inneholde skråstrek, så den første skråstreken er alltid grensen, og et tag-navn som inneholder skråstreker (OPC UA-nettleserstier og MQTT-topics har det) blir fortsatt koblet til riktig enhet. Egenskaps-ID-er starter med `~`, noe en enhets-ID ikke kan, så en egenskap kan aldri kollidere med en tag, uansett hva taggen heter.

### Attributter

| Attributt | Verdi |
|---|---|
| `BrowseName` | enhets-ID-en / tag-navnet, i HotLoop-navneområdet |
| `DisplayName` | enhetens navn / tagens navn |
| `Description` | beskrivelsen av enheten eller taggen |
| `DataType` | se under |
| `ValueRank` | skalar (-1) |
| `AccessLevel`, `UserAccessLevel` | bare `CurrentRead` (0x01) |
| `MinimumSamplingInterval` | enhetens effektive avspørringsintervall i ms; verdier kan ikke endre seg raskere enn runtime avspør dem, så en klient som ber om raskere samplingsrate får den justert opp til dette intervallet |
| `Historizing` | false |

En tag med enhet får en egenskap `EngineeringUnits` (`EUInformation`, enhets-ID -1 = «ikke en UNECE-kode», enhetsteksten i `DisplayName`), og en tag med område får en egenskap `EURange`. En tag uten noen av delene har ingen av dem.

### Datatyper

Runtime reduserer hver numeriske måling til en float64 i tekniske enheter, så den deklarerte typen er et presentasjonsvalg som gjøres i `kindForTag`, og den må være en type verdien alltid kan uttrykkes i:

| `dataType` for tag | OPC UA-type |
|---|---|
| `bool`, `boolean`, `bit`, `coil`, `discrete` | Boolean |
| `string`, `text`, `char` | String |
| `int16` | Int16 |
| `uint16`, `word` | UInt16 |
| `int32`, `dint` | Int32 |
| `uint32`, `dword` | UInt32 |
| `uint64` | UInt64 |
| `int`, `int64` | Int64 (den bredeste fortegnstypen, så ingenting går over bredden) |
| alt annet, inkludert `float` | Double |
| **enhver heltallstype med skala eller offset** | **Double** |

Den siste raden er viktig: et `int16`-register skalert med 0,1 leser 23,4, og å kutte det til Int16 ville gitt klienten 23 med status Good. En verdi som ikke passer i den deklarerte typen, for eksempel en `int16`-tag som leverer 70000, rapporteres som `BadOutOfRange` uten verdi, aldri brettet rundt eller klippet til noe som ser troverdig ut. En numerisk tag der målingen inneholder tekst er `BadTypeMismatch`.

### Verdi, kvalitet og tidsstempler

Hver lesing (og hver abonnementsprøve) besvares fra runtime sin live-cache, samme kilde som `/api/values` bruker, aldri fra databasen. Statuskoden utledes fra den målingen **og tilstanden til enhetsforbindelsen bak**, fordi cachen alene ikke er nok: den beholder den siste målingen en enhet ga, og en enhet som siden har falt av nettverket har fortsatt en siste måling som ser helt god ut.

| Enhetsforbindelse | Måling | Status | Verdi |
|---|---|---|---|
| Tilkoblet, minst én avspørring levert i denne økten | god | **Good** | sendt |
| | usikker | Uncertain | sendt |
| | dårlig, eller en kvalitet som ikke gjenkjennes | Bad | ingen |
| Tilkoblet, ingen avspørring levert ennå i denne økten | hvilken som helst | BadWaitingForInitialData | ingen |
| Tilkoblet, ingenting i cachen i det hele tatt | n/a | BadWaitingForInitialData | ingen |
| Redusert (økten oppe, avspørringer feiler eller er ufullstendige) | god | **UncertainLastUsableValue** | sendt |
| | usikker | Uncertain | sendt |
| | dårlig | Bad | ingen |
| Frakoblet, kobler til, deaktivert | hvilken som helst | **BadNoCommunication** | ingen |
| Ingen worker for enheten | hvilken som helst | BadOutOfService | ingen |
| Tag eller enhet fjernet | n/a | BadNodeIdUnknown | ingen |

Good rapporteres bare for en tilkoblet enhet, på en avspørring fra den gjeldende økten, der målingen er god. En tag på en frakoblet enhet leser Bad, ikke siste verdi med status Good.

Alder er bevisst ikke med. Hendelsesdrevne kilder (en MQTT/Sparkplug-tag, et OPC UA-abonnement) kan med rette holde en verdi i timevis fordi ingenting har endret seg, og å kalle den utdatert etter klokka ville vært feil; om en enhet fortsatt leverer, er forbindelsens oppgave.

**Kildetidsstempelet** er målingens eget tidsstempel, tidspunktet enheten sist ble hørt fra, og det rapporteres også ved status Bad. **Servertidsstempelet** er tidspunktet lesingen ble besvart. Begge er i UTC.

## Abonnementer

Klienter kan opprette abonnementer og overvåkede elementer på tag-variabler og få varsler om dataendringer, som er slik SCADA-klienter faktisk bruker tags. Overvåkingen i dette biblioteket skjer ved sampling: serveren leser hvert overvåkede element med samplingsintervallet sitt (minst 100 ms, og minst enhetens avspørringsintervall) gjennom samme behandler som en lesing bruker, og varsler når verdien eller statusen endres. En endring i *kvalitet*, en enhet som faller ut, meldes derfor på samme måte som en endring i verdi.

Et overvåket element på en tag som fjernes blir ikke hengende: det får `BadNodeIdUnknown`.

## Hva en klient ser mens konfigurasjonen endres

Når en tag fjernes, får lesinger og overvåkede elementer på den `BadNodeIdUnknown` med en gang, og den forsvinner med en gang fra nettleseren til enheten sin. Selve noden blir i serverens nodetabell i omtrent 5 sekunder etterpå, utilgjengelig, og slettes så. En fjernet enhet fungerer på samme måte under Objects-mappen.

En redigering etterlater aldri et hull. En redigert tag eller enhet byttes ut med den nye versjonen under samme NodeId i ett steg, så en lesing eller nettleserforespørsel i det øyeblikket ser den gamle versjonen eller den nye, aldri «ukjent». Abonnementer på den fortsetter.

Forsinkelsen før sletting er ikke pynt. Bibliotekets Browse leser en nodes referanseliste og slår deretter opp hvert mål uten å holde en lås mellom de to, og hvis et mål har forsvunnet imens, feiler nettlesingen av *forelderen* med `BadNodeIdUnknown`, som om enheten eller Objects-mappen ikke fantes. Vi pleide å slette noder umiddelbart, og en klient som nettleste en enhet mens en tag ble fjernet, eller leste en tag mens enheten ble redigert, kunne få beskjed om at en helt ekte node ikke fantes.

## Hvorfor den er skrivebeskyttet

Dette trinnet implementerer ikke skriving, og sier det på tre steder samtidig, slik at ingen enkeltendring i det stille kan legge det til:

- hver publiserte node har `AccessLevel = CurrentRead | HistoryRead`, og ingen skrivebehandler er installert, så en skriving avvises med `BadNotWritable` og en klient kan se før den prøver at noden ikke kan skrives til;
- testene skriver til en tag som viewer, operator og admin, og kontrollerer at svaret er `BadNotWritable` **og at registeret på enheten bak taggen ikke endret seg**.

En OPC UA-skrivevei måtte gå gjennom den porten, bære prinsipalen sin inn i revisjonssporet og respektere hovedbryteren. Det er en endring med sin egen gjennomgang, ikke noe som skal komme som et biprodukt av å publisere tags, og det finnes bevisst ingen innstilling i denne versjonen som slår det på.

## Historikk

Hver tag-node er historisert og har tilgangsnivået HistoryRead. Serveren besvarer OPC UA-tjenesten HistoryRead fra HotLoops egen historikk, de samme målingene som `/api/history` leverer, så en klient i den andre enden av en OPC UA-forbindelse leser det Gateway har lagret uten en andre database. En bruker trenger det en verdilesing trenger (`tags.read` og `values.read`), kontrollert slik en verdilesing kontrolleres, for brukeren i økten, ikke bare én gang ved pålogging.

- **Raw** (`ReadRawModifiedDetails`): målingene i et vindu, hver med sin egen kvalitet som status og sitt eget tidsstempel. En start før slutten leser forover og en start etter slutten leser bakover, nyeste først. Starten er med og slutten er utelatt (OPC UA 10000-11, avsnitt 4.6), med mindre klienten ber om grenser, og da legges målingen ved eller før starten og den første målingen utenfor vinduet ved slutten til. `NumValuesPerNode` er hvor mange ett kall returnerer for en node; mer enn det, eller mer enn 10 000, kommer i sider, hver med et fortsettelsespunkt som er gyldig i fem minutter og for én bruk (høyst 1 000 holdes samtidig). Et vindu uten noe er `Good_NoData`. Endret historikk avvises (`BadHistoryOperationUnsupported`): her blir ingenting noen gang endret eller slettet.
- **Processed** (`ReadProcessedDetails`): Average, Minimum, Maximum, Count, Start, End og Total, over intervaller av `ProcessingInterval` fra starttidspunktet, etter kvalitetsregelen (README, «The quality rule»): bare gode målinger med et endelig tall teller. Et intervall uten noen er `Good_NoData` (Count sier 0), og et der målinger er utelatt leser `Uncertain_DataSubNormal`, så tallet er aldri bedre enn det som var i det. Et annet aggregat avvises for den noden (`BadAggregateNotSupported`), en tekst-tag har ingen, og et vindu på mer enn 10 000 intervaller eller 500 000 målinger avvises (`BadTooManyOperations`) i stedet for å bli kuttet. Bare et forovervindu med begge ender besvares.
- **At time** (`ReadAtTimeDetails`): hva taggen hadde på hvert tidspunkt, altså siste måling ved eller før det, stemplet med tidspunktet det ble spurt om. Den interpolerer aldri, fordi en måling er en verdi noen har tatt; et tidspunkt før taggens første måling er `Bad_NoData`.
- **Hendelser** leveres ikke: `BadHistoryOperationUnsupported`. En enhet eller et annet objekt har heller ingen historikk, og en egenskapsnode (`EngineeringUnits`, `EURange`) har ikke HistoryRead.

Historian lagrer en måling når den går ut av dødbåndet, ikke ved hver avspørring, så en rolig tag har få rader: les At time, eller et Processed-vindu rundt siste måling på en tag, når du trenger det den hadde og ikke bare når den endret seg. `HistoryServerCapabilities` sier at historikk kan leses og at ett kall returnerer høyst 10 000 verdier.

## Maskinhelse, for EmberNet-dashbordet

Oppgavebehandleren i dashbordet leser CPU, minne, disk og sanntidsjitter fra selve maskinen: HotLoop publiserer dem som en enhet og serveren leverer historikken deres ([Historikk](#historikk)), så dashbordet leser aldri sin egen database for dem. Hva som er bygget, og hvordan det slås på:

* **Enheten.** Med `HOTLOOP_BOX_HEALTH_NODE` satt (chartet setter den til navnet på Kubernetes-noden) lager HotLoop en enhet med nøyaktig det navnet som ID, med protokollen `boxhealth` ([Protokoller og drivere](/nb/iot/protocols/#boksens-helse)). Taggene er `cpu_util_pct`, `mem_util_pct`, `disk_util_pct` (maskinens egen disk), `data_util_pct` (volumet HotLoop holder dataene sine på) og, bare når `HOTLOOP_BOX_HEALTH_JITTER_FILE` peker på JSON-filen en sanntidsagent skriver, `rtos_jitter_core1_us`, `rtos_jitter_core2_us` og `rtos_jitter_core3_us`. OPC UA-node-ID-ene deres ligger i navneområdet `urn:hotloop:ua:gateway` med streng-identifikatoren `<device id>/<tag>`.
* **Maskinens tall.** Chartet monterer vertens rot på `/host` og dens `/proc` på `/host/proc`, begge skrivebeskyttet, og setter nodenavnet, **som standard** (`opcuaServer.dashboard.boxHealth.enabled: true`), så oppgavebehandleren i dashbordet fungerer med en gang HotLoop er installert. Bare en statfs av `/host` og tellerne for CPU og minne leses, og ingen rettigheter legges til. En klynge som håndhever den begrensede Pod Security-profilen avviser en hostPath: der setter du `enabled: false` (ingen enhet, ingen monteringer) eller `hostMount: false` (enheten, men maskinens disk og CPU leser Bad og sier hva som må monteres). Enheten trenger ikke OPC UA-serveren.
* **En pålogging som kan lese og ingenting annet.** Chartet lager brukeren `embernet-dashboard-read` med nøyaktig `tags.read` og `values.read` (en eksplisitt tillatelsesliste, aldri en rolle) ved første installasjon, og holder det genererte passordet i Secret `<release>-opcua-dashboard` (nøklene `username`, `password` og `password-hash`). En oppgradering roterer det aldri. En konto som finnes endres aldri av en omstart.
* **Dashbordets sertifikat.** Dashbordet lager Secret `<release>-opcua-trust`, én nøkkel per sertifikat med navnet `<sha1 thumbprint>.crt`. Chartet monterer den, valgfritt, på `/etc/hotloop/opcua-trust`, og serveren holder disse filene i `trusted/` (`HOTLOOP_OPCUA_SERVER_TRUST_DIR`): ved oppstart og hvert 30. sekund legges en ny fil til, en endret skrives på nytt, og en som forsvinner fra Secret fjernes igjen. En fil en operatør har lagt i `trusted/` røres aldri, og vinner over en Secret-nøkkel med samme navn.
* **Porten.** Releasens egen Service (den dashbordet oppdager) lister OPC UA-porten 4840 når serveren er på, ved siden av OPC UA-serverens egen Service.

Serveren er som den var: Basic256Sha256 SignAndEncrypt, ingen anonyme økter, ingen tillit til alt.

## Sikkerhetsmodell

### Transport

Sikre kanaler bruker bibliotekets policyer i Sign og SignAndEncrypt. **`Basic256Sha256` tilbys i begge moduser**, og det er den en klient bør velge.

**Sikkerhetspolicyen None er et eksplisitt valg** (`HOTLOOP_OPCUA_SERVER_ALLOW_INSECURE`, false som standard), med en advarsel ved oppstart når den er på. Når den er av, annonseres ingen None-endepunkt, og en klient som åpner en None-kanal likevel kan bare gjøre discovery: alle andre tjenester avvises. Selv når den er på, reiser brukernavn og passord fortsatt inne i et kryptert token (token-policyen er `Basic256Sha256`, aldri None), selv om hver verdi klienten leser etterpå er ubeskyttet.

**De utdaterte policyene er av som standard.** OPC Foundation har erklært `Basic128Rsa15` (RSA med PKCS#1 v1.5-padding) og `Basic256` (SHA-1) som utdatert. I tidligere utgaver ble begge tilbudt i hver endepunktliste uten noen måte å fjerne dem på. `HOTLOOP_OPCUA_SERVER_ALLOW_DEPRECATED_POLICIES` (chart: `opcuaServer.allowDeprecatedPolicies`, `false` som standard) bestemmer:

- **Av (standarden, for nye installasjoner og oppgraderinger).** Ingen av de to policyene står i noe endepunkt en klient får vite om, og en klient som åpner en sikker kanal med en av dem likevel, avvises når kanalen åpnes, før noen økt eller pålogging. Klienter på `Basic256Sha256`, `Aes128_Sha256_RsaOaep` eller `Aes256_Sha256_RsaPss` påvirkes ikke.
- **På.** Begge tilbys igjen i Sign og SignAndEncrypt, for en eldre klient som ikke snakker noe nyere, med en advarsel ved oppstart. Slå den bare på til klienten er oppdatert.

En klient som sluttet å koble til etter oppgraderingen og bruker en av disse to policyene, viser at kanalen avvises; sett innstillingen, eller flytt klienten til `Basic256Sha256`.

### Serversertifikat

Hvis `HOTLOOP_OPCUA_SERVER_CERT_FILE` og `_KEY_FILE` er satt, brukes det RSA-paret som det er. Ellers **genereres et selvsignert applikasjonsinstans-sertifikat ved første oppstart og lagres** under `HOTLOOP_OPCUA_SERVER_PKI_DIR` (`own/cert.pem`, `own/key.pem`, nøkkel i modus 0600), så neste oppstart presenterer det samme sertifikatet og en klient som en gang ble bedt om å stole på det, ikke spørres på nytt. Ved hver oppstart logges en advarsel så lenge sertifikatet er selvsignert, med SHA-1-avtrykket, formen OPC UA-verktøy viser, så en operatør kan sammenligne det med det en klient viser.

Sertifikatet sier det OPC UA-klienter sjekker, noe et vanlig TLS-sertifikat ikke gjør: **applikasjons-URI-en** (`HOTLOOP_OPCUA_SERVER_APPLICATION_URI`, standard `urn:hotloop:gateway`, pluss `:<siteId>` når en er konfigurert) i URI-feltene for alternative subjektnavn, vertsnavnene og adressene klienter bruker (endepunktverten, `HOTLOOP_OPCUA_SERVER_CERT_HOSTS`, `localhost`, loopback, denne maskinens vertsnavn) som DNS- og IP-SAN-er, og nøkkelbruken Del 6 lister for en applikasjonsinstans. RSA-2048, fem år.

Et lagret sertifikat erstattes, med en advarsel om at klienter må stole på det nye, bare hvis det ikke lenger kan gjøre jobben sin: mindre enn 30 dager igjen, en applikasjons-URI som ikke lenger stemmer med konfigurasjonen, en konfigurert vert det ikke dekker, eller en nøkkel som ikke kan leses.

**Maskinens vertsnavn er ikke en konfigurert vert.** Det havner i et nytt sertifikat, men et lagret sertifikat beholdes når vertsnavnet endres. I en container er vertsnavnet container-ID-en, og i Kubernetes er det navnet på poden, så det endres ved hver ny utrulling. Inntil dette ble rettet telte det, og hver oppgradering av en Gateway i container laget et nytt sertifikat: Ignition, som var bedt om å stole på det gamle, avviste serveren med `Bad_SecurityChecksFailed` til noen stolte på det igjen, på hver klient, etter hver utrulling. Klienter når serveren via `HOTLOOP_OPCUA_SERVER_ENDPOINT_HOST` og `_CERT_HOSTS`; sett dem, så lever sertifikatet til utløpet nærmer seg. (En Gateway uten endepunktvert satt bruker maskinens vertsnavn som endepunktvert, og det teller, siden det er det klientene får vite. Enda en grunn til å sette den.)

**En nøkkel kan være ubrukelig, og serveren avviser den.** Omtrent én av tjue RSA-nøkler kan ikke bære en kryptert OPC UA-pålogging, og hver kryptert pålogging mot den nøkkelen feiler da, hver gang, og klienten ser bare «den sikre kanalen er lukket». Anonyme og ukrypterte økter påvirkes ikke, og det er det som gjør det lett å feildiagnostisere. En generert nøkkel trekkes på nytt til den ikke er en av disse; en nøkkel fra en operatør som er det, avvises ved oppstart med en feil som sier hvorfor.

### Klientenes applikasjonssertifikater

OPC UA autentiserer applikasjonen i tillegg til brukeren. Serveren holder en tillitsliste i `<PKI_DIR>/trusted/`: en klient hvis sertifikat ikke står der, avvises på den sikre kanalen, og sertifikatet skrives til `<PKI_DIR>/rejected/`. **For å godkjenne en klient, flytt sertifikatet fra `rejected/` til `trusted/`**, uten omstart; mappen leses ved hver tilkobling. `<PKI_DIR>/issuers/` og `<PKI_DIR>/crl` slippes gjennom for CA-utstedte klientsertifikater.

`HOTLOOP_OPCUA_SERVER_TRUST_ALL_CLIENT_CERTS` (false som standard, med en advarsel ved oppstart) hopper over dette trinnet. Det fjerner bare autentiseringen av applikasjonen: en bruker må fortsatt autentisere seg med et HotLoop-brukernavn og passord.

### Hvem som kan logge inn

**Brukernavn og passord, mot HotLoops egne brukere.** Det er én brukerdatabase, ikke et nytt lager for legitimasjon: autentisereren slår opp brukeren med samme `store.User` som HTTP-påloggingen bruker, sammenligner med de samme bcrypt-hashene (`auth.CheckPassword`), normaliserer brukernavnet på samme måte (små bokstaver, uten mellomrom i endene), kjører én bcrypt-sammenligning enten brukeren finnes eller ikke, så svartiden ikke røper hvilke navn som er ekte, og avviser en deaktivert konto. Ukjent bruker, feil passord, deaktivert bruker og en bruker uten tillatelsen får alle samme svar, `BadUserAccessDenied`.

**En bruker kan bare lese tags hvis rollen gir `tags.read` og `values.read`**, det samme paret HTTP-API-et beskytter `/api/tags` og `/api/values` med, løst gjennom de samme `auth.Permissions` og `auth.Allows`, så en innebygd rolle og en eksplisitt tillatelsesliste oppfører seg nøyaktig som der. Begge kreves fordi en OPC UA-klient blar i taglisten og leser verdier gjennom én tilkobling, og en bruker med bare én av dem ellers ville fått den andre gratis. Hver innebygde rolle som har `values.read` har også `tags.read`; dette gjelder bare for en bruker med en eksplisitt tillatelsesliste.

**Tillatelser sjekkes ved bruk, ikke bare ved pålogging.** Biblioteket ber om en økts roller ved hver nettlesing, lesing og abonnementsprøve; de besvares fra en kortlivet cache (10 s) av brukerdatabasen. En bruker som deaktiveres, slettes eller mister tillatelser, mister tilgangen på en aktiv økt innen dette intervallet, og de overvåkede elementene blir Bad, i stedet for når klienten neste gang kobler til. Et oppslag som feiler regnes som «nei».

**Anonyme økter er av** (`HOTLOOP_OPCUA_SERVER_ALLOW_ANONYMOUS`), og ingen anonym token tilbys med mindre det velges, med en advarsel ved oppstart. X.509-brukeridentitetstokens er også av, og tilbys når `HOTLOOP_OPCUA_SERVER_ALLOW_X509` er satt (se [X.509-brukersertifikater](#x509-brukersertifikater)). Hvis HotLoops egen autentisering er av (`HOTLOOP_AUTH_INSECURE`), finnes det ingen brukere å logge inn som, og serveren nekter å starte med mindre anonym tilgang er valgt.

En vellykket pålogging registreres i systemloggen på samme måte som en HTTP-pålogging. Mislykkede påloggingsforsøk logges bare i prosessloggen, med årsak, så en uautentisert oppringer ikke kan fylle revisjonssporet. Høyst fire passordkontroller kjører samtidig, siden hver er en bevisst treg bcrypt-sammenligning og OPC UA ikke har noe tilsvarende ratebegrenser foran seg som HTTP; utover det er det ingen utestenging eller ratebegrensning, på samme måte som for HTTP-påloggingen.

Biblioteket holder den dekrypterte brukeridentiteten, passord inkludert, i øktobjektet så lenge økten lever. Den ligger bare i minnet og logges aldri, men et heap-dump av en kjørende Gateway ville inneholdt passordene til brukerne som er koblet til akkurat da.

**Passord av enhver lengde HotLoop godtar, opptil 72 byte (bcrypts grense), kan logge inn.** I tidligere utgaver kunne et passord på 65 til 72 byte logge inn i nettgrensesnittet og ikke her (`BadIdentityTokenRejected`). Lengden talte passordet pluss serverens nonce på 32 byte, så passordet stoppet på 64 byte. Ingenting i RSA eller spesifikasjonen krever det: tokenet krypteres i så mange blokker det trenger, og dekoderen leser allerede alle. Kontrollen er nå at lengden er minst 32 og ikke mer enn bytene som faktisk ble dekryptert, som er det kontrollen var der for å garantere, siden den dimensjonerer bufferen som lages etterpå. En lengde som påstår mer enn det som kom, avvises fortsatt, så en klient kan ikke få serveren til å reservere det den ikke sendte. Upstream-grenen `main` (sjekket 2026-11-16) har fortsatt grensen; endringen er tilbudt upstream som en pull request fra HotLoop-io/opcua.

### X.509-brukersertifikater

En klient kan logge inn med et sertifikat i stedet for et passord. Av som standard: sett `HOTLOOP_OPCUA_SERVER_ALLOW_X509=true` (chart `opcuaServer.allowX509`), så tilbyr serveren brukertokenet Certificate på de sikrede endepunktene og sier fra om det ved oppstart. Uten den tilbyr ingen endepunkter det, og en sertifikatpålogging avvises.

**Hvordan et sertifikat knyttes til en bruker.** En admin kobler sertifikatet til en HotLoop-bruker: Innstillinger, OPC UA-sertifikater, Koble til et sertifikat (eller API-et, `POST /api/users/{username}/certificates`, eller MCP-verktøyet `add_user_certificate`). Registeret holder det offentlige sertifikatet, SHA-256-avtrykket, hvem som koblet det til og når, om det er tilbakekalt, og når det sist logget inn. En klient som presenterer det og beviser at den har den private nøkkelen, logger inn **som den brukeren**. Ingenting annet konfigureres, og det stoles ikke på noe i selve sertifikatet: common name ses ikke på, det er ingen CA å drive, og et sertifikat ingen har koblet til, gjør ingenting.

**Hva tokenet bærer.** En klient kan sende sertifikatet sitt etterfulgt av dem som utstedte det; det første er sertifikatet som ble koblet til, og resten ignoreres.

**Bevis på nøkkelen.** Biblioteket sjekker tokenets signatur over serversertifikatet og øktens nonce, som bare innehaveren av den private nøkkelen kan lage; et sertifikat presentert med signaturen til en annen nøkkel avvises.

**Hva det kan gjøre.** Nøyaktig det brukeren kan gjøre. Påloggingen krever at brukeren er aktivert og har `tags.read` og `values.read`, det samme paret som en passordpålogging, og økten sjekkes hvert 10. sekund som en slik: en bruker som deaktiveres eller mister tillatelsen, mister en aktiv sertifikatøkt innen dette intervallet. Den er skrivebeskyttet som alle økter her; en sertifikatøkt kan ikke skrive, uansett hvilken rolle brukeren har.

**Avvist, med årsak i loggen.** Et sertifikat som ikke er registrert, er tilbakekalt, er utløpt, ikke er gyldig ennå, eller hvis bruker er borte, deaktivert eller uten tillatelsen, får `BadUserAccessDenied`, samme svar for alle, så en klient lærer ingenting om hvilket tilfelle det er. Årsaken går til prosessloggen og revisjonssporet.

**Tilbakekalle.** Kall det tilbake på samme skjermbilde (eller med `POST .../{thumbprint}/revoke`). Det slutter å logge inn med en gang, og en økt åpnet med det avsluttes innen 10 sekunder. Et tilbakekalt sertifikat blir stående i listen, med hvem som kalte det tilbake og når, så en avvist pålogging sier «tilbakekalt» og ikke «ukjent»; slett det for å glemme det. Sikkerhetskopier tar med registeret, tilbakekallinger inkludert.

**Revisjon.** Hver sertifikatpålogging er en loggbokpost (kategori auth) som nevner brukeren, sertifikatets avtrykk og subjekt, og klientapplikasjonen. Hver avvisning er også en, med årsak. En klient som gjentar samme avvisning skriver én post i minuttet for det sertifikatet og den årsaken, ikke én per forsøk; hver avvisning står likevel i prosessloggen. Å koble til, kalle tilbake og slette et sertifikat er poster med hvem som gjorde det. Den private nøkkelen er aldri i noen av dem, og HotLoop har aldri en: bare offentlige sertifikater sendes eller lagres.

**Ikke applikasjonenes tillitsliste.** Et klientapplikasjonssertifikat i `<PKI_DIR>/trusted/` lar klienten åpne en sikker kanal; det er ikke en pålogging. Et brukersertifikat er et annet objekt: en persons, koblet til en bruker. Ett sertifikat kan tjene som begge på klientsiden, men serveren behandler dem som to handlinger.

**HotLoops egen klient** logger inn på denne måten også: se `userCertificate` og `userPrivateKey` i [Protokoller og drivere](/nb/iot/protocols/#opc-ua).

Ikke bygget: en sertifiseringsinstans det stoles på for å gå god for klientsertifikater, og en navneregel som kobler dem til brukere. Registeret dekker et anlegg som kobler klientsertifikatene sine til én og én; en CA ville vært et tillegg til det, ikke en erstatning.

**RsaEncryptedSecret, formatet OPC UA ber om over 64 byte.** OPC 10000-4 7.40.4 sier at en klient krypterer et passord på over 64 byte på en RSA-sikkerhetspolicy som en RsaEncryptedSecret (7.40.2.4), ikke i det gamle formatet. OPC Foundations egen klient gjør akkurat det, og det gjør nå også HotLoops OPC UA-klient. Serveren leser begge. Den ser først på starten av tokenet: En RsaEncryptedSecret kontrolleres for sikkerhetspolicy, sertifikat, signeringstidspunkt, signatur, utfylling og øktens nonce, og gir fra seg passordet bare når alt stemmer; alt annet går til den gamle dekoderen, slik at en klient som sender det gamle formatet over 64 byte fortsatt logger inn. Alle RSA-policyer er dekket, `Basic256Sha256`, `Aes128_Sha256_RsaOaep` og `Aes256_Sha256_RsaPss`, og `Basic128Rsa15` og `Basic256` når de er slått på. Det er bevist mot OPC Foundations Reference Server og ConsoleReferenceClient (UA-.NETStandard 2.0.2) i begge retninger, med en bruker hvis passord er på 10, 64, 65, 72, 100 og 200 byte.

### Serverdiagnostikk er fjernet

Bibliotekets diagnostikknoder per økt ville latt enhver pålogget bruker bla i brukernavn og klientadresse for alle andre økter, så de er slått av, og objektet `Server/ServerDiagnostics` er fjernet fra adresserommet (biblioteket skriver dessuten tellerne sine uten lås).

## Endringer i adresserommet under kjøring

Enheter og tags legges til, redigeres og fjernes mens Gateway kjører, og adresserommet følger med uten omstart. **Mekanisme: en runtime-callback, pluss en timer som sikkerhetsnett.**

- `runtime.Manager.OnReload` kaller tilbake etter hver vellykket `Reload`. Hver enhets- og tag-endring API-et gjør ender i en `Reload`, så en endring gjort fra grensesnittet eller API-et publiseres i løpet av øyeblikk. Callbacken signaliserer bare en avstemmings-goroutine; den gjør aldri selve jobben, så en treg avstemming kan ikke stoppe API-forespørselen som utløste den.
- En periodisk avstemming (`HOTLOOP_OPCUA_SERVER_RECONCILE_INTERVAL`, standard 30 s) fanger alt som endrer konfigurasjonen uten en `Reload`.

Begge kjører den samme idempotente sammenligningen mot de aktiverte enhetene og taggene i databasen. Den rører bare det som avviker: en redigert tag byttes ut, en fjernet slettes, og alt annet, inkludert de overvåkede elementene klienter holder på den, blir akkurat som det var. Nodene til en ny enhet kommer inn i rommet i ett kall, så en klient som blar midt i en avstemming ser en enhet med alle taggene sine eller ingen.

En callback ble foretrukket framfor ren avspørring fordi runtime allerede har det rene signalet (`Reload`) og det gjør en endring synlig på millisekunder i stedet for opptil et helt intervall; timeren blir, fordi adresserommet ikke skal avhenge av at hver framtidig skriver av konfigurasjon husker å laste på nytt.

## Koble til en klient

Endepunktet er `opc.tcp://<HOTLOOP_OPCUA_SERVER_ENDPOINT_HOST>:<port>`. I en klynge setter chartet verten som standard til DNS-navnet på releasens Service; utenfor en klynge setter du det til navnet eller adressen klienter faktisk bruker (en LoadBalancer-adresse, en DNS-post): det annonseres i hver endepunkt-URL og skrives inn i det genererte sertifikatet. Det er **ikke** der serveren binder seg: biblioteket lytter på alle grensesnitt og tar bare en port.

Med UaExpert eller en annen klient:

1. Legg til serveren med den URL-en og velg `Basic256Sha256` / `Sign & Encrypt`.
2. Velg *Username* og logg inn med en HotLoop-bruker som har `tags.read` og `values.read`; eller, med `HOTLOOP_OPCUA_SERVER_ALLOW_X509` på, velg *Certificate* og oppgi brukersertifikatet og nøkkelen en admin koblet til en bruker.
3. Den første tilkoblingen avvises fordi serveren ennå ikke stoler på klientens sertifikat. Finn det i `<PKI_DIR>/rejected/` (på PKI-volumet i en klynge), flytt det til `trusted/` og koble til igjen.
4. Første gang spør klienten om den skal stole på serverens sertifikat; sammenlign avtrykket med det i oppstartsloggen.
5. Bla gjennom *Objects* → enheten → taggene dens, og dra tags inn i datatilgangsvisningen; de abonnerer.

## Ignition 8.3 som klient

**Verifisert 2026-09-27 mot Ignition 8.3.9**, den gjeldende stabile utgaven, i Inductive Automations eget containerbilde (`inductiveautomation/ignition:8.3.9`, standardutgaven på prøveperiode), mot en HotLoop-Gateway der demoenheten `extruder-1` mates av en simulator. Det som ble vist, fra ende til ende:

- en OPC UA-tilkobling fra Ignition til `opc.tcp://<gateway>:4840` med `Basic256Sha256` og `SignAndEncrypt`, innlogget som HotLoop-**viewer**;
- sertifikattilliten i begge retninger, som under;
- OPC-tags i Ignitions `[default]`-leverandør som peker på HotLoop-noder, lest med kvalitet Good og endret mens simulatoren beveget seg. Hver verdi Ignition viste var en HotLoops egen `/api/values` hadde holdt: den samme double går uendret over ledningen, så de sammenlignes for likhet, ikke nærhet. En tekst-tag deklarert som `string` i HotLoop leste «RUNNING» i en String-tag i Ignition;
- en skriving fra Ignition avvist: Ignition sendte skrivingen, HotLoop svarte `Bad_NotWritable` (lest på ledningen over en ren Sign-kanal, der svaret er signert men ikke kryptert), og HotLoops verdi rørte seg ikke;
- hver sikkerhetspolicy og modus Ignition tilbyr, under.

### Oppsett

På HotLoop-siden, før Ignition:

1. Slå på serveren og sett `HOTLOOP_OPCUA_SERVER_ENDPOINT_HOST` til navnet Ignition når Gateway på. Det navnet står i hver endepunkt-URL serveren annonserer og i sertifikatet.
2. Lag en HotLoop-bruker for Ignition med rollen **viewer** (en admin gjør det med `POST /api/users`; se [Autentisering og brukere](/nb/iot/authentication/)). Enhver rolle med `tags.read` og `values.read` kan logge inn; ingenting mer tilbys, siden serveren er skrivebeskyttet.

I Ignition Gateway (nettgrensesnittet på port 8088):

3. På siden **OPC Connections** under Connections (`/app/connections/opc-client-connections`), opprett en **OPC UA**-tilkobling. Endepunkt-URL `opc.tcp://<gateway>:4840`; velg endepunktet `Basic256Sha256` / `SignAndEncrypt`; autentisering **Username**, med HotLoop-brukeren og passordet. Tilkoblingen går straks til Faulted, som forventet: trinn 4.
4. **Godkjenn Ignition i HotLoop.** Ignitions klientsertifikat ligger nå i Gatewayens `<PKI_DIR>/rejected/` (`/data/opcua-pki/rejected` i containeren og chartet), oppkalt etter SHA-1-avtrykket, `<thumbprint>.crt`. Sammenlign avtrykket med Ignitions eget OPC UA-klientsertifikat, vist på siden for OPC-sertifikater (`/app/connections/opc/security/certificates`). Flytt deretter filen til `trusted/`. Ingen omstart på noen av sidene. HotLoop logger ikke avvisningen; filen er det eneste tegnet.
5. **Godkjenn HotLoop i Ignition.** Tilkoblingen feiler nå andre veien: statusen sier `Bad_SecurityChecksFailed ... unable to find valid certification path`. HotLoops sertifikat ligger i Ignitions avviste **klient**-sertifikater på samme side. Sjekk avtrykket mot det HotLoop logger ved oppstart (`generated a self-signed OPC UA application certificate ... thumbprint=`) og stol på det. Ingen omstart; tilkoblingen kommer opp i løpet av sekunder.
6. **Tags.** Opprett OPC-tags med tilkoblingen som OPC-server og elementstier i navneområde-URI-formen, som Ignition godtar som den er:

   ```
   nsu=urn:hotloop:ua:gateway;s=extruder-1/Emberburn_Temperature
   ```

   Deklarer hver som det HotLoop publiserer (se [Datatyper](#datatyper)): Float8 for en float, Boolean, String, Int2 for en `int16`, Int4 for en `uint16` eller `int32`, Int8 for de bredere heltallene. De abonnerer med taggruppens rate, og HotLoop justerer en raskere samplingsrate opp til enhetens avspørringsintervall.

Det samme, som filer eller via REST-API-et:

- Tilkoblingen er ressursen `data/config/resources/core/ignition/opc-connection/<name>/config.json`, profiltype `com.inductiveautomation.OpcUaServerType`, eller `POST /data/api/v1/resources/ignition/opc-connection`. To ting i den er ikke åpenbare. Passordet er en innebygd hemmelighet, en JWE som `POST /data/api/v1/encryption/encrypt` lager av klarteksten; en vanlig streng godtas ikke. Og blokken `security` trenger aliaset til gatewayens klientnøkkellager og passordet dets: utelater du den, feiler tilkoblingen med en NullPointerException, og med tomt alias feiler den med `Unable to retrieve KeyPair for alias 'client'`. Kopier blokken fra den medfølgende loopback-tilkoblingen `Ignition OPC UA Server`, som har begge.
- Sertifikatene ligger under `data/config/local/com.inductiveautomation.opcua/client/security/pki/` (`rejected/certs`, `trusted/certs`), eller via `GET /data/opc-ua/api/v1/client/pki/certificates/rejected` og `POST .../trusted/<sha1>` gjennom API-et. **Ignition navngir ikke filene etter avtrykket**; API-ets felt `signature` er SHA-1-avtrykket, og det stemmer med det HotLoop logger.
- Tags importeres med `POST /data/api/v1/tags/import?provider=default&type=json`.
- Hvert API-kall trenger en API-nøkkel (siden API Keys, `/app/platform/security/api-keys`), og en nøkkel slipper bare gjennom hvis ett av sikkerhetsnivåene står i gatewayens lese- eller skrivetillatelser (ressursen `security-properties`).

### Hva du kan vente

- **`Bad_SecurityChecksFailed` betyr to forskjellige ting.** Ignition viser samme status når HotLoop avviser Ignitions sertifikat (trinn 4; meldingen har ingen årsak) og når Ignition avviser HotLoops (trinn 5; meldingen sier *unable to find valid certification path*). Se først i HotLoops `rejected/`.
- **En ny utrulling av HotLoop beholder sertifikatet.** Til og med 4.15.3 gjorde den ikke det: sertifikatet måtte dekke containerens vertsnavn, som endres hver gang containeren lages på nytt, så hver oppgradering laget et nytt sertifikat og Ignition avviste serveren til noen stolte på det igjen. Se [Serversertifikat](#serversertifikat). Sertifikatet endres fortsatt hvis PKI-volumet går tapt.
- **En tekst-tag deklarert som numerisk leser `Bad_TypeMismatch`.** HotLoop publiserer en tag som typen den er deklarert som, og en `float`-tag som inneholder «RUNNING» kan ikke være en Double. Tags laget av Discover tags til og med 4.15.3 var alle deklarert som `float`; se [Protokoller og drivere](/nb/iot/protocols/#opc-ua). Deklarer dem som `string`.
- **Skriving avvises, og Ignition gjør årsaken uklar.** HotLoop svarer `Bad_NotWritable`. Ignitions egen OPC UA-server, bedt om å skrive til samme tag, sender bare et generisk `Bad` (0x80000000) videre. Verdien til Ignition-taggen endres ikke.
- **De utdaterte policyene fungerer bare når de er slått på.** Ignition tilbyr `Basic128Rsa15` og `Basic256`. Velg `Basic256Sha256` eller en av `Aes`-policyene i tilkoblingen.
- **Prøveperioden.** En Ignition 8.3-gateway uten lisens kjører i to timer og slutter så å kjøre til prøveperioden nullstilles i Gatewayens nettgrensesnitt. Tags blir utdaterte når den går ut; det er Ignition, ikke tilkoblingen.

### Policymatrise

Hver rad er en fersk økt med den policyen og modusen, som leser live-verdier. De to utdaterte radene ble målt med `HOTLOOP_OPCUA_SERVER_ALLOW_DEPRECATED_POLICIES` på; når den er av, som den er som standard, tilbys ikke de to policyene, og en kanal som ber om en av dem avvises:

| Policy | SignAndEncrypt | Sign |
|---|---|---|
| `Basic256Sha256` | fungerer | fungerer |
| `Aes128_Sha256_RsaOaep` | fungerer | fungerer |
| `Aes256_Sha256_RsaPss` | fungerer | fungerer |
| `Basic256` (utdatert) | fungerer | fungerer |
| `Basic128Rsa15` (utdatert) | fungerer | fungerer |

`None` tilbys ikke med mindre `HOTLOOP_OPCUA_SERVER_ALLOW_INSECURE` er satt, og ble ikke prøvd.

## Konfigurasjon

| Variabel | Standard | <span class="sr-only">Detaljer</span> |
|---|---|---|
| `HOTLOOP_OPCUA_SERVER_ENABLED` | `true` | På i binærfilen og chartet; `false` slår serveren av |
| `HOTLOOP_OPCUA_SERVER_PORT` | `4840` | TCP-port, på alle grensesnitt |
| `HOTLOOP_OPCUA_SERVER_ENDPOINT_HOST` | denne maskinens vertsnavn | Det klienter får beskjed om å koble til; skrives også inn i et generert sertifikat. **Sett denne.** |
| `HOTLOOP_OPCUA_SERVER_APPLICATION_URI` | `urn:hotloop:gateway[:<siteId>]` | Må være stabil mellom omstarter; må være en URI |
| `HOTLOOP_OPCUA_SERVER_PKI_DIR` | `/data/opcua-pki` | Sertifikat, nøkkel, `trusted/`, `rejected/`. Legg det på et volum |
| `HOTLOOP_OPCUA_SERVER_CERT_FILE` / `_KEY_FILE` | n/a | Bruk dette RSA-paret i stedet for å generere ett; sett begge eller ingen |
| `HOTLOOP_OPCUA_SERVER_CERT_HOSTS` | n/a | Ekstra DNS-navn / IP-er for et generert sertifikat |
| `HOTLOOP_OPCUA_SERVER_ALLOW_INSECURE` | `false` | Tilby sikkerhetspolicyen None. Advares om ved oppstart |
| `HOTLOOP_OPCUA_SERVER_ALLOW_ANONYMOUS` | `false` | Godta økter uten identitet. Advares om ved oppstart |
| `HOTLOOP_OPCUA_SERVER_TRUST_ALL_CLIENT_CERTS` | `false` | Hopp over godkjenning av klientsertifikater. Advares om ved oppstart |
| `HOTLOOP_OPCUA_SERVER_ALLOW_X509` | `false` | Tilby brukertokenet Certificate: en klient logger inn med et sertifikat koblet til en bruker ([X.509-brukersertifikater](#x509-brukersertifikater)). Noteres ved oppstart |
| `HOTLOOP_OPCUA_SERVER_ALLOW_DEPRECATED_POLICIES` | `false` | Tilby de utdaterte policyene `Basic128Rsa15` og `Basic256` for en eldre klient ([Transport](#transport)). Advares om ved oppstart |
| `HOTLOOP_OPCUA_SERVER_MAX_SESSIONS` | `20` | 0 = ubegrenset |
| `HOTLOOP_OPCUA_SERVER_MAX_SUBSCRIPTIONS` | `200` | 0 = ubegrenset |
| `HOTLOOP_OPCUA_SERVER_RECONCILE_INTERVAL` | `30s` | Perioden for sikkerhetsnett-avstemmingen |

Serveren startes ikke i modusen `--mcp-stdio`: der starter en agent denne binærfilen som hjelper, og at en andre prosess konkurrerer med den ekte Gateway om port 4840 skal ikke kunne skje.

### Helm

`opcuaServer.*` i `charts/hotloop/values.yaml`. Å slå den på legger til en Service (`<release>-opcua`, ClusterIP som standard; LoadBalancer eller NodePort er et bevisst valg for en klient utenfor klyngen), en PVC for PKI-mappen (`opcuaServer.persistence`; å miste den betyr at hver klient må stole på et nytt sertifikat), containerporten og, slik at `networkPolicy.enabled` og `opcuaServer.enabled` sammen ikke i det stille etterlater en lyttende server ingenting når fram til, porten i ingress-regelen til standard NetworkPolicy. En egen `networkPolicy.ingress` erstatter den regelen, som for megleren, og må da selv liste porten. `opcuaServer.tls.existingSecret` leverer en Secret av typen `kubernetes.io/tls` i stedet for et generert sertifikat.

## Hva som er verifisert og hva som ikke er det

HotLoop er kjørt mot ekte utstyr og ekte servere, og på ekte maskinvare 2026-11-17.
