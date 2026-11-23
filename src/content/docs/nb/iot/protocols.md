---
title: "Protokoller og drivere"
description: "OPC UA, Modbus, MQTT og Sparkplug B, EtherNet/IP, S7comm, MTConnect og HTTP, med hvor langt hver driver er bevist mot ekte utstyr."
---

Dette dokumentet sier nøyaktig hva gatewayen snakker, nøyaktig hvor langt hver driver er verifisert, og hva du gjør med alt annet. Det er det første du bør lese, og det du kan stole på når noe er uenig med det.

Listen over native protokoller utledes fra driverne som er kompilert inn i binærfilen: `/api/protocols`, Protokoller-skjermen og MCP-verktøyet `describe_protocol` leser alle samme register. Katalogen kan ikke love en protokoll som binærfilen ikke har.

## Verifiseringsstatus

Hver protokoll HotLoop snakker nativt har flyttet ekte verdier fra en ekte server eller enhet, og er kjørt på ekte maskinvare (2026-11-17). Der det finnes en uavhengig implementasjon, er HotLoop kjørt mot den i begge retninger.

| Protokoll | Nativ | Status |
|---|---|---|
| Modbus TCP/RTU | ja | **verifisert live** |
| OPC UA | ja | **verifisert live**, inkludert Ignition 8.3.9 i begge retninger med brukernavn og passord over en sikret kanal |
| MQTT / Sparkplug B | ja | **verifisert live** |
| MTConnect | ja | **verifisert live** |
| HTTP / REST | ja | **verifisert live** |
| S7comm | ja | **verifisert live** (ekte maskinvare, 2026-11-17) |
| EtherNet/IP | ja | **verifisert live** (ekte maskinvare, 2026-11-17) |
| UniFi Network | ja | **verifisert live**, skrivebeskyttet, på ekte konsoller og svitsjer, WAN-lenker og failover inkludert |
| SNMP | ja | **verifisert live**, skrivebeskyttet, over v1, v2c og v3 på alle sikkerhetsnivåer |
| CODESYS | ja | **verifisert live**, lesing og skriving, inkludert et program med over 100 000 variabler lest på 2,4 sekunder |
| BACnet/IP | ja | **verifisert live**, skrivebeskyttet |
| OPC UA PubSub (UADP) | ja | **verifisert live**, i begge retninger |
| Kafka-API (ut) | ja | **verifisert live** mot Apache Kafka og Redpanda, med TLS og en SASL-pålogging |

Leverandører er ulike når det gjelder standardverdier: hvilke sertifikater og tokenpolicyer en OPC UA-server tilbyr, hva en BACnet-kontroller legger i objektlisten sin, hvilke MIB-er en SNMP-enhet serverer, hvordan en PLS nummererer dataene sine. En ny enhet på et nytt anlegg er fortsatt et igangkjøringsarbeid, så sammenlign en kjent verdi på integrasjonens probe med enhetens egen visning før du stoler på et skjermbilde.

## Native protokoller

### OPC UA

Foretrekk denne når en enhet gir deg et valg. Den utforsker, den er ordentlig sikret, og den abonnerer.

Driveren **abonnerer i stedet for å polle**. Serveren sender en verdi når den endres, i et tempo den klarer, i stedet for å bli stilt det samme spørsmålet hver skanning av en klient som ikke vet om noe har beveget seg. Hvis en server avviser et abonnement, faller driveren tilbake til samlede lesinger i stedet for å la enheten feile.

Den faller også tilbake når et abonnement ikke leverer noe i det hele tatt. En server sender hver nodes gjeldende verdi i sin første publisering og ikke igjen før den endres, så en tapt første publisering betyr et settpunkt som leses som dårlig så lenge økten varer. Hvis ti publiseringsintervaller går (minst fem sekunder) uten noen verdi fra abonnementet, logger driveren en advarsel, sletter abonnementet og leser taggene ved hver polling til enheten kobler til igjen. OPC UA-klientbiblioteket driveren er bygget på kan starte publiseringsløkken sin satt på pause på en belastet vert og aldri sende en publiseringsforespørsel; det er tilfellet dette finnes for.

Den faller også tilbake når et abonnement stopper etter at verdier har kommet. Biblioteket beholder keep-alive-meldingene for seg selv, så en stoppet publiseringsløkke ser akkurat ut som et anlegg der ingenting endrer seg. Etter at et abonnement har vært stille i ti publiseringsintervaller (minst tretti sekunder), leser driveren hver node én gang og sammenligner den med det abonnementet sist leverte. Hvis en node er forskjellig i verdi eller kvalitet, holder serveren tilbake noe den ville ha sendt, så driveren logger en advarsel, sletter abonnementet og leser ved hver polling til enheten kobler til igjen. Hvis de stemmer, fortsetter den og sjekker på nytt etter samme stillhet. Et friskt, stille abonnement koster én samlet lesing hvert trettiende sekund.

**Adresser nodene med namespace-URI.** Dette betyr mer enn det ser ut:

```
nsu=http://opcua.edge.server;s=Zone1_Temperature    good
ns=3;s=Zone1_Temperature                            works until it doesn't
```

En namespace-*indeks* tildeles i den rekkefølgen serveren tilfeldigvis laster namespacene sine. Legg til et namespace, oppgrader fastvaren, og indeks 3 blir stille noe annet: hver avlesning er da feil uten noen feil noe sted. URI-en er en del av modellen og flytter seg ikke. `Browse` returnerer URI-formen nettopp av denne grunnen.

En ren streng avvises som adresse. Lest som `ns=0;s=Temperature` ville en skrivefeil bli tolket uten problemer som en node som ikke finnes, og taggen ville lese dårlig for alltid. En eksplisitt form kreves slik at feilen kommer til syne når du lagrer.

**Oppdag tagger deklarerer hver tag som den typen serveren sier noden har**: Boolean er `bool`, heltallstypene beholder bredden sin (`int16`, `uint16`, `int32`, `uint32`, `int64`, `uint64`; SByte og Byte tar neste størrelse opp), Float og Double er `float`, og String, DateTime, LocalizedText og de andre typene driveren leser som tekst er `string`. En type serveren ikke oppgir, eller en uten bedre navn (en oppregning, en struktur), forblir `float`. Frem til Ignition-arbeidet nedenfor var hver oppdaget tag `float`. Driveren leste fortsatt teksten til en String-node, men taggen sa float, og Gatewayens egen OPC UA-server publiserer en tag som den typen den er deklarert som, så en klient av den serveren fikk `Bad_TypeMismatch`. Ignition viste Emberburns `System_Status` nøyaktig slik. Tagger importert før rettelsen beholder typen sin: endre en teksttag til `string` for hånd.

Konfigurasjon: sikkerhets-, identitets- og sertifikatalternativene er beskrevet under [OPC UA: sikkerhet og legitimasjon](#opc-ua-sikkerhet-og-legitimasjon). De øvrige er `subscribe`, `publishIntervalMs`, `samplingIntervalMs`, `queueSize`, `sessionTimeoutMs`, `browseMaxNodes`, `browseRoot` og `browseServerNodes`. Et alternativnavn driveren ikke kjenner er en feil som lister de den kjenner, ikke en innstilling som stille ignoreres: en skrivefeil i `securityMode` ville ellers koble til helt uten sikkerhet og se akkurat ut som en fungerende enhet.

**Oppdag tagger utelater serverens eget `Server`-objekt** (`i=2253`: status, kapabiliteter, diagnostikk, namespace-tabell og konfigurasjon). Hver OPC UA-server har ett, og det kan være hundrevis av variabler blandet med anleggets egne. Sett `browseServerNodes` til `true` på enheten for å få dem tilbake, eller sett `browseRoot` til `i=2253` for å se inni det med vilje; en browsing som starter der går likevel gjennom det.

### OPC UA: sikkerhet og legitimasjon

Frem til 4.15.0 kunne driveren bare lage en anonym, usikret tilkobling, og ikke til noen server som følger spesifikasjonen: den spurte aldri serveren hvilke identitetstoken-policyer den tilbød, så den sendte en tom token-policy-id, som en samsvarende server avviser. Det inkluderte HotLoops egen OPC UA-server. Driveren oppdager nå serverens endepunkter, velger ett som passer enheten, og gjentar policy-id-en det endepunktet listet.

#### Enhetsalternativer

| Alternativ | Standard | Hva det gjør |
|---|---|---|
| `securityMode` | `None` | `None`, `Sign` eller `SignAndEncrypt`. Utelatt sammen med en `securityPolicy` som ikke er `None`, er den `SignAndEncrypt`. |
| `securityPolicy` | den beste serveren tilbyr for modusen | `None`, `Basic256Sha256`, `Aes128_Sha256_RsaOaep` eller `Aes256_Sha256_RsaPss`. `Basic128Rsa15` og `Basic256` avvises. |
| `username`, `password` | anonym | Autentisering med brukernavn. |
| `userCertificate`, `userPrivateKey` | ingen | X.509-brukerautentisering: økten logger inn som den brukeren serveren tilordner dette sertifikatet til, uten passord. Begge som PEM, satt sammen. Nøkkelen er RSA (OPC UA-biblioteket signerer bare med RSA; en EC-nøkkel avvises med det oppgitt) og er en hemmelighet som passordet: forseglet i hvile, sladdet i hvert API-svar, aldri logget. Sertifikatet er brukerens, ikke klientapplikasjonssertifikatet i `certFile`. Er det også satt et `username`, brukes sertifikatet. Mot HotLoops egen server må sertifikatet først knyttes til en bruker ([OPC UA-serveren](/nb/edge/opc-ua-server/#x509-brukersertifikater)). |
| `allowInsecureCredentials` | `false` | Tillater at et passord sendes over en usikret kanal (`securityMode` `None`), eller når ingenting krypterer det. |
| `certFile`, `keyFile` | generert | Denne klientens applikasjonssertifikat og RSA-nøkkelen, for en sikret modus. Sett begge eller ingen. |
| `pkiDir` | `HOTLOOP_OPCUA_CLIENT_PKI_DIR` (`/data/opcua-client-pki`) | Hvor det genererte sertifikatet og lagrene `trusted/` og `rejected/` ligger. |
| `serverCertThumbprints` | ingen | SHA-1 (40 heksadesimale sifre) eller SHA-256 (64) fingeravtrykk av serversertifikater som skal stoles på uten en fil i `trusted/`. Kolon og mellomrom ignoreres. |
| `insecureSkipVerify` | `false` | Godta ethvert serversertifikat. |

En enhet uten noen av disse er det den alltid har vært: anonym, over en usikret kanal.

#### Hvordan driveren velger et endepunkt

Driveren ber serveren om endepunktene sine over en usikret kanal, noe spesifikasjonen krever at servere tillater for oppdagelse og som ikke bærer noe hemmelig, siden endepunktlisten er offentlig av design. Den beholder endepunktene der sikkerhetsmodus og policy samsvarer med enheten, og blant dem token-policyen for enhetens identitet (anonym, eller brukernavn når et `username` er satt). Identitetstokenet den deretter sender bærer policy-id-en det endepunktet listet; den sender aldri en tom.

- **Den velger aldri `Basic128Rsa15` eller `Basic256`.** Begge er foreldet hos OPC Foundation. Dette gjelder når en har høyeste sikkerhetsnivå på listen, som er slik servere rangerer dem, og når en er det eneste serveren tilbyr, og da feiler tilkoblingen med en feil som sier det. En enhet kan ikke konfigureres til å bruke en, og en token-policy som ville kryptert et passord med en av dem avvises også. HotLoops egen server tilbyr begge ved siden av de moderne policyene og kan ikke slå dem av, så dette prøves mot en ekte server, og testene sjekker at URI-en til ingen av dem dukker opp i det driveren sender.
- **Når enheten ikke nevner noen policy, foretrekker den `Basic256Sha256`, så `Aes128_Sha256_RsaOaep`, så `Aes256_Sha256_RsaPss`**, uansett hvilket sikkerhetsnivå serveren gir dem. Rekkefølgen er etter hvor utbredt hver er, ikke etter styrke. Noen servere klarer ikke å åpne en kanal med `Aes256_Sha256_RsaPss` og lukker tilkoblingen uten å si hvorfor, så den brukes bare når en enhet nevner den.
- **Hvis ingenting samsvarer, lister feilen det serveren faktisk tilbyr**, med policy og token-policy-id for hvert endepunkt, slik at konfigurasjonen kan rettes ut fra meldingen alene.

#### Klientens eget sertifikat

Enhver sikret modus trenger et applikasjonssertifikat. Hvis enheten nevner en `certFile` og en `keyFile`, brukes de som de er, etter kontroller (RSA, minst 2048 bit, ikke utløpt). Ellers genereres et selvsignert ved første bruk og lagres i PKI-mappen: RSA-2048, fem år, applikasjons-URI-en `urn:hotloop:client:<host name>` i subject alternative names, nøkkelen med modus `0600`, sertifikatet med modus `0644` og mappene med `0750`. Oppsettet speiler OPC UA-serverens:

```
own/cert.pem, own/key.pem   this client's certificate
trusted/                    server certificates an operator has approved
rejected/                   server certificates the driver turned away
```

Det genereres ikke på nytt ved en vanlig oppstart, så en server som er bedt om å stole på det blir ikke bedt om det igjen. Det erstattes, med en advarsel om at hver server må godkjenne det nye, bare hvis det ikke kan leses, ikke er RSA på minst 2048 bit eller har under 30 dager igjen. Enheter som starter samtidig deler ett sertifikat i stedet for at hver skriver sitt eget.

Mappen må være skrivbar og vedvarende. I Helm-charten er det `opcuaClient.persistence.enabled` (av som standard, fordi det legger et volum til en eksisterende installasjon); på edge relay er det det eksisterende `/data`-volumet. Uten en skrivbar mappe melder en sikret enhet en feil som navngir variabelen som må settes, i stedet for å koble til med sertifikater som ville gått tapt ved neste omstart.

**Serveren** må også stole på dette sertifikatet, som er serverens egen innstilling. For HotLoops egen server er det samme grep: driverens sertifikat dukker opp i serverens `rejected/`-mappe etter det første avviste forsøket, og å flytte det til `trusted/` godkjenner det. Når en server lukker tilkoblingen mens den sikre kanalen åpnes, som er slik mange servere avviser et sertifikat de ikke stoler på, navngir feilen denne klientens sertifikatfil og fingeravtrykket, slik at operatøren vet hva han skal lete etter på serveren.

#### Godkjenne en servers sertifikat

For en sikret modus, eller for et passord som skal krypteres til serverens nøkkel, **godtar ikke driveren hvilket som helst sertifikat serveren presenterer.** Den stoler på sertifikatet bare hvis det er festet i enhetens `serverCertThumbprints` eller er nøyaktig sertifikatet i `trusted/`. Alt annet skrives til `rejected/<thumbprint>.der` og tilkoblingen feiler, før noen legitimasjon er sendt, med en melding som denne:

```
opcua: the server at opc.tcp://plc-01:4840 presented a certificate that is not
trusted (subject "CN=PLC01", SHA-1 thumbprint 5A6DB35A..., expires 2031-09-18).
It has been saved to /data/opcua-client-pki/rejected/5A6DB35A....der. To approve
it, first check that the thumbprint matches the one the server shows, then move
that file into /data/opcua-client-pki/trusted (the next connection attempt picks
it up; no restart is needed). Alternatively pin it by adding the thumbprint to
this device's serverCertThumbprints. Until then this device will not connect
```

Sjekk fingeravtrykket mot serverens egen visning før du godkjenner: den sammenligningen er hele tillitsavgjørelsen. Deretter `mv` filen inn i `trusted/` (både PEM- og DER-filer leses), og enheten kobler til ved neste forsøk, som kommer innenfor runtimens gjentilkoblingsintervall. Noen detaljer:

- Tilliten gjelder det nøyaktige sertifikatet, ikke en kjede. En server hvis sertifikat er utstedt av en CA godkjennes ved å legge serverens eget sertifikat i `trusted/`, på samme måte som et selvsignert. Å stole på en CA støttes ikke.
- Et sertifikat som er utløpt, men godkjent av en operatør, stoles det fortsatt på, med en advarsel i loggen ved hver tilkobling. Å avvise et en operatør godkjente med vilje ville bare presset ham mot `insecureSkipVerify`.
- En fil i `trusted/` som ikke er et sertifikat hoppes over og rapporteres, og gjør ikke de andre godkjente serverne utilgjengelige.
- `rejected/` rommer høyst 256 filer, så en server som presenterer et annet sertifikat ved hver tilkobling ikke kan fylle disken. Utover det avvises tilkoblingen fortsatt, og meldingen sier at filen ikke ble beholdt og hvordan sertifikatet likevel kan godkjennes.
- `insecureSkipVerify` slår kontrollen av. En part på veien kan da utgi seg for serveren og lese det som sendes til den, passordet inkludert. Den er av som standard og advarer, med sertifikatets fingeravtrykk, ved hver tilkobling.

En anonym enhet på en usikret kanal trenger ingenting av dette, fordi ingenting signeres eller krypteres til serverens nøkkel.

#### Legitimasjon

Et passord avvises, før det sendes, med mindre kanalen er sikret og noe krypterer passordet. Hva driveren bestemmer, ut fra det serveren tilbyr for endepunktet som ble valgt:

| Kanal | Serverens token-policy for brukernavn | Resultat |
|---|---|---|
| `SignAndEncrypt` | krypterer passordet (det vanlige) | kobler til |
| `SignAndEncrypt` | gjør det ikke | kobler til: den krypterte kanalen bærer det, og loggen sier det |
| `Sign` | krypterer passordet | kobler til |
| `Sign` | gjør det ikke | **avvist** med mindre `allowInsecureCredentials`. `Sign` autentiserer meldinger, men skjuler dem ikke. |
| `None` | krypterer passordet | **avvist** med mindre `allowInsecureCredentials`. På en usikret kanal kommer nøkkelen passordet krypteres til fra et svar ingenting autentiserer, så alle som kan endre trafikken kan gjenvinne det. Med opt-in kobler det til, med en advarsel. |
| `None` | gjør det ikke | **avvist** med mindre `allowInsecureCredentials` |

**Et brukernavn over `securityMode` `None` avvises selv når serverens token-policy krypterer passordet.** Kryptering der en angriper kan velge nøkkelen beskytter ikke mot den angriperen, og på en usikret kanal hentes sertifikatet passordet krypteres til fra serverens svar på `CreateSession`, som ingenting autentiserer (testen nedenfor bytter ut et sertifikat og gjenvinner passordet). Feilen sier dette og navngir løsningen, `securityMode` `SignAndEncrypt`. Anonyme økter påvirkes ikke.

`allowInsecureCredentials` er den ene bryteren som lar et passord gå ut på de vilkårene. Den er av som standard og advarer ved hver tilkobling når det er den som tillot tilkoblingen. Der token-policyen krypterer passordet, endrer den hva en lytter kan lese, ikke hva en part som endrer trafikken kan: se [hva som går over nettverket](#hva-som-går-over-nettverket). Selv med den må serverens sertifikat godkjennes først når passordet krypteres til det.

Passordet er en hemmelighet overalt der driveren og API-et håndterer det:

- **API-svar.** Det erstattes med `[redacted]` i hvert svar som returnerer en enhet (`GET /api/devices`, `GET /api/devices/{id}` og svaret på en lagring), så en seer, som har `devices.read`, ikke kan lese det. Fra 4.15.1 gjelder dette for alle roller, administrator inkludert, og for legitimasjonen til alle protokoller, ikke bare denne. Å lagre en enhet tilbake med plassholderen beholder det lagrede passordet; en ny verdi erstatter det; en tom streng fjerner det; plassholderen for en enhet uten passord avvises i stedet for å lagres. Å utelate feltet beholder det nå (i 4.15.0 fjernet det det). De fullstendige reglene står i [Autentisering og brukere](/nb/iot/authentication/#enhetslegitimasjon-er-skrivebeskyttet). Nettgrensesnittets enhetsredigering viser konfigurasjonen slik API-et returnerer den og lagrer det den viser, noe dette håndterer, så redigering av en enhet mister ikke passordet. (Testene prøver dette gjennom API-et, ikke gjennom en nettleser.)
- **Logger og feil.** Verken driverens loggmeldinger eller noen feil den returnerer bærer passordet: meldingene bygges fra statuskoder og enhetens ikke-hemmelige innstillinger. Testene fanger prosessloggen, serverens logg og feilene, og søker i alle etter passordet.
- **MCP-verktøy og ressurser, den levende hendelsesstrømmen, systemloggen.** Ingen returnerer en enhets konfigurasjon (hver beskriver en enhet gjennom et fast sett felt), og testene kaller hvert verktøy og hver ressurs, åpner strømmen og leser systemloggen med et passord konfigurert, og finner det ingen steder.
- **Databasen og sikkerhetskopier.** Passordet lagres i enhetens `config`-kolonne, som de andre driverne sine. Opp til 4.16.0 ligger det i klartekst, og en sikkerhetskopi inneholder det. Fra 4.17.0 er det kryptert med en nøkkel som oppbevares utenfor databasen (se "Encrypted at rest" nedenfor), så en dump eller sikkerhetskopi inneholder chiffertekst. Uansett, se [Sikkerhetskopier og gjenoppretting](/nb/iot/backup/#beskytt-sikkerhetskopifilene) og beskytt databasen og sikkerhetskopivolumet deretter.
- **Edge relay.** En enhetsfil bærer også passordet. I Helm-charten legger du en enhetsfil med legitimasjon i en Secret og navngir den i `devicesSecret`; enheter satt direkte i chartens verdier havner i en ConfigMap. En enhetsfil som sendes med fleet config push publiseres, retained, til et MQTT-topic, så megleren må bruke TLS og begrense hvem som kan lese det topicet.

Et feil passord er en tydelig feil, i ett forsøk, uten heng og uten gjentatte forsøk inne i driveren:

```
opcua: authentication rejected: the server at opc.tcp://plc-01:4840 rejected the
user name and password for "svc-hotloop" (StatusBadUserAccessDenied). ...
```

Runtimen venter deretter **ti minutter** (med jitter mellom fem og ti) før neste forsøk, i stedet for å klatre gjennom sin vanlige gjentilkoblings-backoff (`HOTLOOP_RECONNECT_MAX`, 60 sekunder som standard). To ting gjør en avvist pålogging dyrere å gjenta enn en nettverksfeil. En server som låser en konto etter noen få feil gjør hvert raske nytt forsøk til et avbrudd for alle andre som bruker kontoen. Og hver avviste pålogging kan etterlate en **økt som ble opprettet og aldri aktivert** på serveren, som teller mot øktgrensen til den går ut (biblioteket ber om tjue minutter; `sessionTimeoutMs` endrer det): mot HotLoops egen server fylte en enhet med feil passord som prøvde på nytt hvert par sekunder standardgrensen på tjue økter, og deretter avviste serveren alle andre klienter med `BadTooManySessions`. En kontroller med en liten øktstabell er enda mer utsatt. Enheten slutter ikke å prøve, så en server der passordet rettes på dens side kommer seg innen ti minutter uten at noen rører HotLoop; å rette passordet på enheten, eller å slå den av og på, starter en ny worker, som prøver med en gang.

#### Hva som går over nettverket

Målt, ikke resonnert: testene setter en opptakende proxy mellom driveren og en server og søker gjennom hver byte i begge retninger. Søket finner byte som er kjent for å være der (serverens endepunktliste, sendt i klartekst), noe som viser at proxyen tok opp samtalen.

| Konfigurasjon | Passord | Brukernavn | Node-id-er og verdier for tagger |
|---|---|---|---|
| `SignAndEncrypt` | ikke synlig | ikke synlig | ikke synlig |
| `Sign` | ikke synlig (token-policyen krypterer det) | **lesbart** | **lesbart** |
| `None`, brukernavn, serverens token-policy krypterer (krever `allowInsecureCredentials`) | ikke synlig | **lesbart** | **lesbart** |
| `None`, anonym | ikke aktuelt | ikke aktuelt | **lesbart** |
| en server som tilbyr et ukryptert passord, med `allowInsecureCredentials` | **lesbart** | **lesbart** | avhenger av modusen |

Den siste raden prøves mot en server som egentlig ikke tilbyr dette: en part foran en ekte server skriver om endepunktlisten for å si at passordet er ukryptert, på kanalen oppdagelsen bruker, som ingenting autentiserer. Det er også slik testene viser avvisningen: uten opt-in avviser driveren, åpner bare oppdagelsestilkoblingen, og ingen legitimasjon er på ledningen. Endepunktlisten er akkurat det en part på veien kan skrive om, og derfor brukes driverens regel på det den får vite og overlates ikke til serveren å håndheve.

En usikret kanal med et passord har en grense tabellen ikke viser, og en test gjør det; det er derfor driveren avviser den kombinasjonen uten opt-in. Passordet krypteres til serverens sertifikat, som holder det unna en lytter, og driveren sender det ikke før det sertifikatet er godkjent. Men sertifikatet OPC UA-biblioteket krypterer til er det i serverens svar når økten opprettes, og på en usikret kanal er det svaret ikke autentisert. En part som kan endre trafikken legger inn sitt eget sertifikat, og passordet krypteres da til den partens nøkkel: testen gjør dette, dekrypterer passordet med den utskiftede nøkkelen og får det tilbake. **Over `Sign` eller `SignAndEncrypt` kan den samme parten ikke det**, fordi svaret er beskyttet av nøkler den ikke har. Uten `allowInsecureCredentials` nekter driveren å sende passordet i det hele tatt, og testen viser at den samme parten da ikke får noe; med den advarer driveren ved hver tilkobling. Bruk `SignAndEncrypt` overalt serveren tilbyr det; en usikret kanal med et passord, med opt-in, er beskyttelse mot en lytter og ikke noe mer.

#### Gjentilkobling

OPC UA-bibliotekets egen gjentilkobling er slått av, og runtimen kobler til på nytt. Biblioteket åpner, når en økt er tapt, en ny med legitimasjonen det fikk, og når serveren avviser den, prøver det på nytt med en gang uten noen forsinkelse: omtrent tjue avviste pålogginger på tolv sekunder ble målt, mot en server der passordet var endret. Slik blir en konto låst for alle som deler den. Nå får en tapt økt `Poll` til å rapportere en feil, runtimens worker lukker driveren og åpner en ny, og den nye oppdager endepunktene, sjekker serverens sertifikat og logger inn igjen, med runtimens jitter-backoff og ti minutters ventetid etter en autentiseringsfeil. En omstart av serveren overleves på samme måte: enheten leser den nye verdien etter omstarten, etter å ha logget inn igjen, noe testene sjekker ved å telle serverens pålogginger og endre verdien etter omstarten.

En enhet uten tagger har ingenting å lese, og frem til 4.15.2 betydde det at pollingen ikke sendte noe i det hele tatt. Serveren lukket den ledige økten ved øktens tidsavbrudd, enheten fortsatte å si at den var tilkoblet fordi ingen hadde spurt serveren om noe, og hver browsing feilet med `BadSessionIDInvalid` til prosessen ble startet på nytt. Det er hver enhet i det øyeblikket noen legger den til og klikker Oppdag tagger. Ignition fanget det. Nå leser en enhet uten tagger serverens tilstand ved hver polling, noe som holder økten i live og oppdager når den dør, og en browsing som finner økten borte rapporterer det slik at runtimen kobler til på nytt.

En tag som ikke har endret seg siden før økten startet leser nå sin gjeldende verdi med god kvalitet. Før var plassholderavlesningen som ble rapportert mens man ventet på første verdi nyere enn verdiens egen kildetidsstempel, og runtimen beholder den nyeste avlesningen og forkastet verdien, så en stabil tag leste dårlig til den endret seg neste gang.

#### Hva som ble testet, og hva som ikke ble det

OPC UA er kjørt mot Ignition 8.3.9 og mot uavhengige OPC UA-servere, med anonym pålogging og med brukernavn og passord over `None`, `Sign` og `SignAndEncrypt`, og på ekte maskinvare 2026-11-17. Hver produksjonsserver har sine egne vaner for hvilke policyer den tilbyr og hvordan den avviser et sertifikat, så behandle en første tilkobling til en ny leverandørs server som igangkjøring.

Det du bør vite:

- Hver tilkobling spør nå serveren om endepunktene først, og en enhet uten sikkerhetsalternativer trenger et usikret endepunkt som lister en anonym token-policy med en id. En server som godtok anonyme økter uten å liste en avvises med en feil som lister hva den tilbyr.
- X.509-sertifikat og utstedt-token-brukerautentisering er ikke implementert for driveren. En enhets `certFile` er dens applikasjonssertifikat.
- Tilliten gjelder det nøyaktige sertifikatet. Å stole på en sertifiseringsinstans, og tilbakekalling av sertifikater, støttes ikke.
- Sikkerhetspolicyer med elliptiske kurver støttes ikke, og heller ikke servere som avviser oppdagelse på en usikret kanal.
- En nettverksvei som faller ut uten at noen av endene ser lukkingen lar enheten stå på sine siste verdier til operativsystemet gir opp tilkoblingen.
- Noen servere klarer ikke å åpne en kanal med `Aes256_Sha256_RsaPss`.
- HotLoops egen server godtar passord på opptil 72 byte. En annen server kan ha sin egen grense.

#### Ignition 8.3

Verifisert mot **Ignition 8.3.9**, den gjeldende stabile utgaven, i Inductive Automations eget containerbilde: HotLoops driver som klient, Ignitions OPC UA-server i den andre enden, `Basic256Sha256` med `SignAndEncrypt`, pålogget med brukernavn og passord. Browse fant Ignitions tagger under `nsu=urn:inductiveautomation:ignition:opcua:tags`, og taggene `[System]/Gateway` for klokke, CPU, minne og oppetid ble importert og lest med god kvalitet, sendt via abonnement.

En standard Ignition 8.3-gateway stopper deg fire ganger før HotLoop får sagt et ord:

1. **OPC UA-serveren lytter bare på localhost.** Rett ut av boksen binder 8.3 port 62541 til `localhost`, så en HotLoop et annet sted får tilkobling avvist og ingenting mer. I Gatewayen, under innstillingene for OPC UA-serveren, sett Bind Addresses til `0.0.0.0`. Vi la også vertsnavnet HotLoop ringer til i Endpoint Addresses; om driveren trenger det ble ikke testet.
2. **Tagger er ikke på OPC UA som standard.** Slå på Expose Tag Providers, ellers finner en browsing bare serverens egen diagnostikk og enhetsmappene.
3. **Sertifikater, begge veier.** HotLoop avviser Ignitions sertifikat til du godkjenner det, som ovenfor. Ignition avviser HotLoops til du stoler på det i Gatewayens OPC UA-serversertifikater. På disk er det å flytte det fra `data/config/local/com.inductiveautomation.opcua/server/security/pki/rejected/certs` til `.../trusted/certs`, uten omstart. **Ignition navngir ikke den filen etter SHA-1-fingeravtrykket HotLoop logger.** Åpne sertifikatet og sammenlign fingeravtrykket; filnavnet vil ikke stemme, og det er ikke et tegn på en bedrager.
4. **OPC UA-påloggingen er `opcuauser` / `password`** i brukerkilden `opcua-module`, på hver nye installasjon. Endre den før noe ekte kobler til.

Bare det 8.3-serveren tilbyr rett ut av boksen ble prøvd i denne retningen: `Basic256Sha256` og `SignAndEncrypt`.

**Den andre retningen er også verifisert: Ignition 8.3.9 sin OPC UA-klient leser HotLoops OPC UA-server**, pålogget som en HotLoop-seer, over hver sikkerhetspolicy og modus Ignition tilbyr. Oppsettet, sertifikattilliten begge veier, fallgruvene og policymatrisen står i [OPC UA-serveren](/nb/edge/opc-ua-server/#ignition-83-som-klient). Den fant to HotLoop-feil, begge rettet: serveren laget et nytt sertifikat hver gang containeren ble gjenopprettet, noe som brøt Ignitions tillit etter hver oppgradering, og Oppdag tagger deklarerte hver tag som float, så en teksttag nådde Ignition som `Bad_TypeMismatch` (ovenfor).

HotLoops Sparkplug-edge-node og Edge Relay mot Ignitions MQTT Engine er neste, og er ikke gjort.

### OPC UA PubSub (UADP)

Den andre OPC UA: ikke en klient som spør en server, men en publisher som sender DataSets som UDP-datagrammer til alle som lytter, unicast eller multicast (OPC 10000-14, UADP-kodingen). HotLoop abonnerer, som en enhet, og publiserer, som en innstilling.

**Abonner.** Legg til en enhet med protokollen `opcua-pubsub`. Adressen er hva det skal lyttes på: `udp://239.0.0.1:4840` blir med i en multicast-gruppe, `udp://:4840` lytter på unicast. En tags adresse er `<DataSetWriterId>/<field index>`, feltets posisjon i publisherens DataSet talt fra 0: `1000/3` er det fjerde feltet writer 1000 publiserer. UADP bærer ingen feltnavn (de bor i en DataSetMetaData publisheren serverer på annen måte, eller ikke i det hele tatt), så posisjonen er det et datagram kan si. Et felt som er en matrise leses ett element om gangen: `1000/3[17]` er den attende verdien i matrisen som er det fjerde feltet. Browse lister feltene som er hørt, med typene deres, og en matrise som elementene sine (de første 1000).

```json
{"publisherId":"2234","writerGroupId":100,"interface":"eth0","timeoutMs":30000,
 "dataSets":[{"writerId":62541,"types":["Float","UInt16","Boolean","Int32","Double"]}]}
```

- `publisherId` og `writerGroupId` holder en enhet til én publisher og gruppe. Tom og null tar alt. Slik deler flere enheter en adresse: en publisher som sender to WriterGroups til `udp://:4840` er to enheter der, én med `"writerGroupId":1` og én med `"writerGroupId":2`.
- Enheter kan dele adresse og port. HotLoop åpner én socket for den (én tilslutning, for en multicast-gruppe på ett kort) og gir hvert datagram til hver enhet på den. Hver enhet bruker så sine egne `publisherId`, `writerGroupId` og `dataSets`, så hver ser hele strømmen fra sin publisher og ingen deles mellom enheter. Socketen lukkes når den siste enheten på den fjernes eller stoppes, og den neste som starter åpner den igjen. Enheter matches på adressen slik den er skrevet: `udp://:4840`, `udp://0.0.0.0:4840` og `udp://[::]:4840` er tre adresser for HotLoop, og om de kan sameksistere er opp til operativsystemet, som alltid. En multicast-gruppe som er med på to ulike kort er to sockets. Ingenting endrer seg for en enhet som er alene på adressen sin.
- Gruppen, porten og kortet er enhetens: ingenting er fast i HotLoop. `udp://239.192.0.1:4850` med `"interface":"eth0"` blir med i den gruppen på det kortet, og `udp://127.0.0.1:4842` lytter etter en publisher på samme maskin. Flere enheter kan lytte på ulike grupper og porter samtidig, eller på den samme.
- `interface` er nettverkskortet en multicast-gruppe tilsluttes på, ved navn (`eth0`, `lo`) eller ved en av IPv4-adressene (`127.0.0.1`). En maskin med mer enn ett kort trenger det. En publisher på samme maskin som sender til en gruppe over loopback (`IP_MULTICAST_IF` 127.0.0.1, TTL 0, loopback på, ingen rute) høres av en enhet med `"interface":"lo"` eller `"127.0.0.1"`; uten oppgitt grensesnitt og uten rute feiler tilslutningen med `no such device` og sier det.
- `dataSets` er bare for RawData, som ikke bærer typer på ledningen: publisherens felttyper, i rekkefølge, slik at bytene kan leses. Variant- og DataValue-meldinger bærer sine egne. Hver oppføring er et typenavn (`"Float"`), og kan også si hvordan en blokk med verdier er lagt ut: `"Float*250"` er 250 felt etter hverandre uten lengde foran, slik en PLS som sender en blokk REAL som separate felt skriver det; `"Float[250]"` er ett matrisefelt på høyst 250 verdier, skrevet slik OPC Foundation-stakken skriver en RawData-matrise (en Int32-telling, verdiene og nullfylling opp til 250 av dem); og `"String(40)"` er en String fylt til 40 byte, alene eller som `"String(40)[4]"`.
- Key frames erstatter feltene i et DataSet; delta frames endrer de de nevner; keep alives beviser at publisheren lever. En tapt melding (et hull i sekvensnumrene) merker den DataSetWriterens tagger som **usikre** til neste key frame, siden en delta kan ha forsvunnet med den. En endring i DataSetets konfigurasjonsversjon får alle felt til å glemmes til en key frame sier hva de betyr nå.
- En writer som er stille i `timeoutMs` (30 sekunder om ikke satt) leses **dårlig** med det oppgitt, og en enhet det ikke er hørt noe fra publisheren til innen tidsavbruddet er nede. Et felt publisheren merker Bad er dårlig, og et den merker Uncertain er usikkert; årsaken er statuskoden.
- Avlesningens tid er publisherens, fra feltet, DataSetMessage eller NetworkMessage, når den er satt og ikke mer enn ett minutt foran denne klokken, og ankomsttiden ellers.
- Matriser leses i Variant- og DataValue-meldinger (en Int32-telling og verdiene, OPC 10000-6 5.2.2.16; en flerdimensjonal kommer flat, rad for rad) og, med et oppsett, i RawData. En telling datagrammet ikke kan romme avvises før noe opprettes for den.
- Skrivebeskyttet. Meldingssikkerhet (signerte eller krypterte NetworkMessages), oppdelte meldinger, discovery-meldinger, hendelser og strukturfelt støttes ikke; et datagram med noe av dette avvises, telles etter årsak og gjettes aldri på.

**Publiser.** Av til `HOTLOOP_UADP_PUBLISH_ENABLED` er satt, i Edge og Gateway (produktene som har OPC UA-serveren). Den sender taggene et oppsett navngir:

```json
{"dataSets":[{"writerId":1,"name":"press","configMajor":1,"fields":[
  {"device":"press-01","tag":"Zone1_Temp","type":"Float"},
  {"device":"press-01","tag":"Cycle","type":"UInt32"}]}]}
```

| Variabel | Standard | <span class="sr-only">Detaljer</span> |
|---|---|---|
| `HOTLOOP_UADP_PUBLISH_ADDRESS` | | `udp://239.0.0.1:4840` for en multicast-gruppe, `udp://host:4840` for én abonnent |
| `HOTLOOP_UADP_PUBLISH_LAYOUT_FILE` eller `_LAYOUT` | | oppsettet ovenfor, som fil eller inline (filen vinner) |
| `HOTLOOP_UADP_PUBLISH_PUBLISHER_ID` | `1` | et tall eller en tekst |
| `HOTLOOP_UADP_PUBLISH_WRITER_GROUP_ID` | `1` | |
| `HOTLOOP_UADP_PUBLISH_INTERVAL` | `1s` | |
| `HOTLOOP_UADP_PUBLISH_KEY_FRAME_EVERY` | `10` | høyst så mange intervaller mellom key frames |
| `HOTLOOP_UADP_PUBLISH_DATAVALUE` | `false` | DataValue-felt (verdi, status, tid) i stedet for Variants |
| `HOTLOOP_UADP_PUBLISH_DELTA_FRAMES` | `false` | et DataSet som endret seg går ut som en delta frame (bare de endrede feltene) mellom key frames |
| `HOTLOOP_UADP_PUBLISH_INTERFACE`, `_TTL` | systemets, `1` | kortet multicast forlater på, og hopp-grensen |

Hvert DataSet går ut på sin egen DataSetWriter, én NetworkMessage hver. Et DataSet hvis verdier endret seg går ut som en key frame (hvert felt), ett som ikke endret seg som en keep alive, og en key frame minst hvert `KEY_FRAME_EVERY` intervall slik at en abonnent som ble med sent konvergerer. Delta frames er av som standard: en key frame er komplett, så et tapt datagram koster ett intervall og ikke en feil verdi. Med `HOTLOOP_UADP_PUBLISH_DELTA_FRAMES=true` går et DataSet som endret seg i stedet ut som en delta frame, med bare feltene som har endret seg siden forrige melding og posisjonene deres, og key framen kommer fortsatt minst hvert `KEY_FRAME_EVERY` intervall; en tapt delta koster da opptil så mange intervaller med et utdatert felt, som er prisen for en mindre melding på en treg lenke. HotLoops egen abonnent leser delta frames. verdi. En tag som er dårlig publiseres som sin status og aldri som sin siste verdi; en det ikke er lest noe for ennå publiseres som `BadWaitingForInitialData`. Verdier begrenses til sin publiserte type, de brytes ikke rundt. Meldingssikkerhet støttes ikke, så dette hører hjemme på et nettverk anlegget stoler på. Taggene i det samme oppsettet kan leses av HotLoops egen abonnent på en annen boks.

**Hva som ble bevist.** En uavhengig OPC UA PubSub-stakk publiserer til HotLoops abonnent og abonnerer på HotLoops publisher over multicast, og HotLoops publisher leses korrekt av HotLoops egen abonnent.
### CODESYS

En PLS som kjører en CODESYS Control-runtime (Linux SL, ARM64, Raspberry Pi, Windows, den virtuelle PLS-en), lest og skrevet med navnene programmereren ga variablene: `Application.GVL_Line.rTemp`, ikke en node-id. Det er OPC UA-driveren med det en CODESYS-PLS trenger i tillegg, så alt under [OPC UA: sikkerhet og legitimasjon](#opc-ua-sikkerhet-og-legitimasjon) gjelder for den, og alternativene er de alternativene.

**Hvorfor OPC UA-serveren, og hva det betyr for PLS-en.** CODESYS dokumenterer én måte for en tredjepart å lese en kontrollers variabler på, og det er runtimens egen OPC UA-server: applikasjonens Symbol Configuration (eller, fra CODESYS 3.5 SP18, et IEC Symbol Set under Communication Manager) sier hvilke variabler som publiseres og med hvilken tilgang, og serveren serverer dem. CODESYS Gateways kanalprotokoll er ikke dokumentert for tredjeparter, og denne driveren snakker den ikke. Så PLS-en må publisere det du vil se:

1. I IDE-en legger du til en **Symbol Configuration** i applikasjonen, med *Support OPC UA features* på, og huker av variablene, eller merker dem i deklarasjonen med `{attribute 'symbol' := 'readwrite'}` (`'read'` for skrivebeskyttet).
2. Last ned. En PLS uten Symbol Configuration svarer på oppsettet med en melding som sier at du må legge til en.
3. En variabel er skrivbar fra HotLoop bare når symbolet er `readwrite` og brukeren den kobler til som har lov til å skrive den (enhetens *Symbol Rights*). HotLoop leser tilgangsnivået og sier hvilken av de to som avviste en skriving.

Kilder: [CODESYS help, Symbol Configuration](https://content.helpme-codesys.com/en/CODESYS%20Communication/_cds_symbolconfiguration.html) og [IEC Symbol Set](https://content.helpme-codesys.com/en/CODESYS%20Communication/_comm_symbol_configuration.html) (symbolnavnet er `<application>.<POU>.<variable>`, tilgangen er lese, skrive eller utføre per symbol, gruppenes rettigheter ligger på enhetens Symbol Rights-fane, og OPC UA trenger et sertifikat på kontrolleren); [PLCopen OPC UA information model for IEC 61131-3](https://plcopen.org/system/files/downloads/plcopen_opc_ua_information_model_for_iec61131-3_version1.02.pdf) (utgave 1.02, oppsettet nedenfor); OPC UA Part 5 (OperationLimits). Node-id-ene er det en 4.22.0.0-runtime svarte, som denne driveren ble skrevet mot; den nøyaktige stavemåten av `|var|` er runtimens, ikke en publisert kontrakt, og derfor adresseres en tag med symbol og driveren bygger node-id-en.

**Oppsett.** Runtimen publiserer, i OPC UA Device Integration-`DeviceSet`, én enhet for PLS-en, `Resources` under den, og applikasjonen under det, med `GlobalVars` (variabellistene) og `Programs` nedenfor. En variabels node er `ns=<n>;s=|var|<device>.<application>.<list or program>.<variable>` i namespacet `CODESYSSPV3/3S/IecVarAccess`. Driveren finner enheten og applikasjonen ved å browse, så en tag overlever at prosjektet får nytt navn.

**Adresser.** Et IEC-symbol, med eller uten applikasjonen:

```
Application.GVL_Line.rTemp        a variable of a variable list
GVL_Line.rTemp                    the same; the application is assumed
Application.PLC_PRG.nCount        a program's variable
GVL.motors[2].speed               a field of an element of an array of structures
nsu=CODESYSSPV3/3S/IecVarAccess;s=|var|CODESYS Control for Linux SL.Application.GVL.x
                                  a node id, if you have one
```

**Oppdag tagger** lister det applikasjonen eksporterer, som typene den har: en STRING er `string`, en BYTE `uint16`, en TIME `int64` (millisekunder), en oppregning `int32`, heltallsbreddene beholder sine, REAL og LREAL er `float`. Runtimen sier at en STRING, BYTE eller TIME er en type i PLCopen-modellen (for eksempel `ns=3;i=3013`); driveren følger `HasSubtype`-referansene til standardtypen den er en slags av, og det er også slik en skriving til en BYTE sendes som Byte. Hver variabel bærer tilgangen symbolet ble gitt. En struktur og en matrise gås inn i: ett punkt per felt og per element. Den utelater runtimens egne egenskaper (`|vprop|`), oppgavelisten og Server-objektet.

En matrise lister sine første 32 elementer (`arrayElements`), fordi en buffer på tusen elementer ikke er tusen ting for et dashbord, og en tag kan adressere hvilket som helst element med symbolet uansett. Listen stopper ved `browseMaxNodes` og sier det; `browseRoot` satt til et symbol (`Application.GVL_Demo`) lister én del av applikasjonen. Browsingen er bredde først, så variablene i en liste kommer før elementene i matrisene deres, og svarene holdes til en størrelse runtimen godtar (den lukker tilkoblingen ved et svar på hundre matriser på tusen elementer).

Konfigurasjon: OPC UA-alternativene, og `device` (PLS-ens navn, bare hvis runtimen lister mer enn én), `application` (bare hvis ingen heter Application), `arrayElements`. Et feilstavet alternativ er en feil som lister de gyldige. Passordet er en hemmelighet, lagret og sladdet som enhver enhetshemmelighet.

**Hva runtimen krever av en klient.** Den publiserer `OperationLimits` på 100 for lesinger, browsinger og overvåkede elementer per forespørsel, og avviser en større med `BadTooManyOperations`. Driveren leser disse grensene ved tilkobling og skjærer hver forespørsel til dem, for hver OPC UA-enhet (en CODESYS-runtime var den første det betydde noe for: før dette rapporterte driveren hver oppdaget tag som float og leste ingen av taggene til en enhet med mer enn 100). Samplingen er ett sekund som standard og køen ett element, fordi en PLS har en skanning å holde og en Ignition-gateway som allerede leser den ikke skal få den tatt fra seg; sett `samplingIntervalMs` for å be om mer.

**Nedlastinger, omstarter og en tapt forbindelse.** En omstart av runtimen, eller et nytt program som lastes, bryter økten. Enheten blir frakoblet, hver tag leser dårlig med årsaken "PLS-ens runtime svarer ikke", og HotLoop kobler til på nytt av seg selv med backoff og leser symbolene slik de er nå. Et symbol som ble lest og avvises som borte to ganger på rad regnes som en nedlasting der runtimen beholdt økten, og økten gis opp for den samme gjentilkoblingen. En tag for en variabel programmet ikke har leser dårlig med serverens årsak og forårsaker ingen gjentilkobling.

**Sikre runtimens OPC UA-server.** En CODESYS Control-runtime tilbyr bare usikrede endepunkter til OPC UA-serveren har et sertifikat, og da tilbyr den også policyene i sin `CommunicationPolicy` (AES128-SHA256-RSAOAEP som standard, Basic256Sha256, AES256-SHA256-RSAPSS) med Sign og SignAndEncrypt. CODESYS dokumenterer hvordan man lager dette sertifikatet i Security Screen (CODESYS Security Agent, Devices, kontrolleren, OPC UA Server) og hvordan man stoler på en klient ved å flytte sertifikatet fra "Certificates in Quarantine" til "Trusted Certificates". Linux-runtimens PLC-shell gjør det samme uten IDE-en, med kommandoer CODESYS lister for enhetsredigerens PLC-shell (`cert-getapplist`, `cert-genselfsigned <n>`, `cert-getcertlist quarantine`, `cert-export`, `cert-import trusted`), over Unix-socketen Linux-runtimen dokumenterer for det (`/var/opt/codesyscontrolapi/plcshell.sock`, "Accessing the PLC Shell"). Sett enheten til `securityMode` `SignAndEncrypt` med en `securityPolicy`, koble til én gang (HotLoops eget sertifikat havner i runtimens karantene og tilkoblingen avvises, med en melding som sier det), stol på det sertifikatet, og enheten leser. Ikke vist: IDE-ens Security Screen, et CA-signert sertifikat, brukeradministrasjon med en sikret runtime.

**En runtime uten lisens stopper seg selv.** En CODESYS Control-runtime som ikke har noen lisens kjører i demomodus og slår seg av etter omtrent to timer (runtimens logg sier `no runtime license - running in demo mode(~2 hours)` ved hver oppstart). Fra HotLoops side er det en runtime-omstart som alle andre: enheten blir frakoblet med "PLS-ens runtime svarer ikke" og kommer tilbake av seg selv når noe starter runtimen igjen (en containers omstartspolicy, en systemd-enhet). Ingenting i HotLoop teller de to timene eller behandler stoppen annerledes, og ingenting starter runtimen for deg; en runtime som ikke startes igjen forblir frakoblet. Kjørt mot en 4.22.0.0-runtime i en container uten lisens: den stoppet seg selv 2 timer og 5 minutter etter at den startet, med exit-kode 0; containerens omstartspolicy startet den igjen 31 sekunder senere, applikasjonen kjørte 82 sekunder etter det, og enheten leste bra igjen 35 sekunder etter at applikasjonen startet (2 minutter og 28 sekunder fra stoppen), uten noe håndtrinn.

**Skriving.** En tag er skrivebeskyttet til noen merker den som skrivbar, som for alle enheter, og ingenting et oppsett oppretter er det. Deretter er skriveporten som for OPC UA, med PLS-ens halvdel foran: en skriving til et symbol som er eksportert skrivebeskyttet, eller som brukeren ikke har lov til å skrive, avvises med PLS-ens egne ord og sendes aldri.

**Oppsett fra integrasjonsflyten** (`codesys`): runtimens adresse, OPC UA-sikkerhetsspørsmålene og eventuelt et første dashbord med punktene som lagres (skjermen WebVisu ville ha vært; se [Integrasjoner](/nb/iot/integrations/#codesys)). Verifisert mot en 4.22.0.0-runtime i en container; se statustabellen for hva det ikke dekker.

### Modbus TCP/RTU

Arbeidshesten fra 1979. PLS-er, frekvensomformere, effektmålere, RTU-er, og reserveløsningen til hver gateway som ikke har noe bedre.

```
holding:100:float32:CDAB    a float across registers 100-101, word-swapped
holding:40:bit3             bit 3 of register 40
holding:200:string16        16 characters from register 200
input:12:int16              a signed input register
coil:5                      a single coil
```

**Ordrekkefølgen** er innstillingen folk tar feil på, og en float lest med feil rekkefølge er ikke åpenbart feil på en skjerm, det er et plausibelt tall som ikke er sannheten. Alle fire permutasjonene støttes med navnene leverandørenes håndbøker trykker: `ABCD`, `CDAB`, `BADC`, `DCBA`. Sett en enhetsstandard med `byteOrder` og overstyr per tag med det fjerde adressefeltet.

**Adressering** er rå og nullbasert. Hvis tegningene dine bruker den tradisjonelle nummereringen i 40001-stil, sett `oneBased: true` og skriv tallene fra tegningene. Å ta feil med én er den eldste Modbus-feilen som finnes.

Lesinger slås sammen til blokker: tilstøtende og nesten tilstøtende registre blir én forespørsel. `maxGap` styrer hvor mange ubrukte registre det er verdt å lese for å unngå en ekstra runde (standard 8), `maxBlock` setter tak på én forespørsel (standard 120, protokollens tak 125).

Å skrive én enkelt bit i et holding-register er en les-endre-skriv, fordi Modbus ikke har noen atomisk bitsetting der. De andre femten bitene bevares.

### MQTT og Sparkplug B

Ren MQTT, eller Sparkplug B som en **fullverdig primær vertsapplikasjon**.

Rene topics:
```
mqtt:plant/line1/temperature              a scalar payload
mqtt:plant/line1/state|data.temperature   JSON, extracted by path
mqtt:plant/+/flow                         wildcards work
```

Sparkplug-metrikker:
```
spb:GroupId|EdgeNodeId|DeviceId|Metric/Name
spb:Plant|Edge1||Node/Uptime               empty device = a node-level metric
```

Som primær vert gjør driveren det spesifikasjonen ber om og de fleste integrasjoner hopper over:

- Publiserer en retained `STATE`-fødsel med en tilhørende will, slik at edge-noder ser verten falle ut i stedet for å utlede det fra et tidsavbrudd. Sparkplug 3.0-formen (`spBv1.0/STATE/<host>` med JSON) som standard; sett `legacyState` for `ONLINE`/`OFFLINE`-strengen fra før 3.0.
- Sporer hver nodes rullerende sekvensnummer og ber en node om å føde på nytt når den hopper over ett, fordi et hull betyr at meldinger er gått glipp av og aliastabellen ikke lenger kan stoles på.
- Ber om rebirth etter sin egen gjentilkobling. En vert som var borte har ingen ide om hva som endret seg mens den var borte.
- Matcher `NDEATH` til `NBIRTH` med `bdSeq`, slik at et dødssertifikat som er til overs fra en tidligere økt ikke kan drepe den gjeldende.

Meldingsrekkefølgen håndheves. Å levere Sparkplug-meldinger samtidig bytter om på rekkefølgen, noe som får en frisk node til å se ut som den mister meldinger og utløser en rebirth-storm.

### EtherNet/IP (CIP)

Allen-Bradley ControlLogix, CompactLogix og Micro820. Tagger har navn, så kontrolleren kan spørres om hva den holder.

```
Temperature                    type from the tag's declared dataType
Speed:dint                     an explicit type wins
Program:MainProgram.Speed      a program-scoped tag, the colon is part of the path
Zones[0].Heater.On:bool        array elements and UDT members
```

CIP er sterkt typet, og kontrolleren avviser en lesing der den deklarerte typen ikke stemmer, så typen må komme fra et sted. Den hentes fra taggens `dataType`, eller fra et `:type`-suffiks som vinner. Ukjent faller tilbake til `REAL`, som de fleste prosessverdier er.

Lesinger samles i multi-service-forespørsler, og faller tilbake til enkeltlesinger når en gruppe feiler, slik at én dårlig tag-bane ikke blinder de nitten andre.

### S7comm

Siemens S7-300, 400, 1200 og 1500, over ISO-on-TCP med rack og slot.

```
db1:0:real        a REAL at DB1.DBD0
db1:4:dint        a DINT at DB1.DBD4
db1:8.3:bool      bit 3 of DB1.DBB8
db2:20:string32   a 32-character STRING
m:10:word         merker word MW10
i:0.1:bool        input I0.1
q:2:byte          output byte QB2
```

Typen er påkrevd for alt som er bredere enn en byte. Protokollen kan ikke fortelle deg om fire byte er en REAL eller en DINT, det er et faktum om PLS-programmet, ikke om ledningen.

Standard er rack 0, slot 1 (S7-1200/1500). S7-300/400 er vanligvis slot 2. `connectType` er 3 som standard (S7 Basic) slik at gatewayen ikke opptar PG-tilkoblingsplassen en ingeniør vil ha for TIA Portal.

Det finnes ingen browsing. En S7-CPU publiserer ikke oppsettet av datablokkene sine, det ligger i TIA Portal-prosjektet.

### MTConnect

Skrivebeskyttet telemetri fra verktøymaskiner. Det finnes ingen kommandokanal i MTConnect, og denne driveren later ikke som noe annet.

Adresser med `dataItemId` eller med navn; agenter er inkonsekvente om hvilket som er stabilt, og maskindokumentasjonen viser det ene eller det andre.

To detaljer som skiller en fungerende integrasjon fra en som bare virker plausibel: `UNAVAILABLE` er agenten som eksplisitt sier at den ikke har noen avlesning, det blir dårlig kvalitet, ikke teksten "UNAVAILABLE" og ikke null. Og en Conditions betydning er elementnavnet (`Normal`, `Warning`, `Fault`, `Unavailable`), ikke tegndataene, som vanligvis er tomme.

`Browse` leser `/probe` og går gjennom komponenttreet til hvilken som helst dybde.

### HTTP / REST

Samlepunktet, for energimålere, miljøsensorer, OEM-kontrollere og REST-siden av en gateway som snakker noe proprietært nedenunder.

```
power.kw                      nested fields
readings[0].value             array indexing
zones[name=Zone1].temp        select an array element by a field value
$.data.temperature            a leading $. is accepted
```

Den tredje formen er den som betyr noe: disse API-ene elsker å returnere en uordnet matrise av `{name, value}`-objekter, og å indeksere etter posisjon er en feil som venter på en fastvareoppdatering.

Én forespørsel betjener hver tag på enheten. `Browse` går gjennom dokumentet og rapporterer hver skalar med banen som leder til den.

### Boksens helse

Maskinen HotLoop kjører på, som en skrivebeskyttet enhet: `cpu_util_pct` (CPU-tid som ikke er inaktiv siden forrige lesing), `mem_util_pct` (MemTotal mot MemAvailable), `disk_util_pct` (boksens disk, en statfs av vertens rot montert skrivebeskyttet på `diskPath`, `/host` som standard), `data_util_pct` (volumet på `dataPath`, `/data`), og `rtos_jitter_core1_us` til `core3_us` når `jitterFile` navngir JSON-filen `{"core1_us":3.2,"core2_us":2.9,"core3_us":4.1}` som en sanntidsagent skriver om (en fil eldre enn fem minutter leser dårlig). CPU og minne kommer fra `procRoot` (`/proc`, eller `/host/proc` når vertens er montert). En verdi som ikke kan leses er dårlig kvalitet med årsaken, aldri null. Enheten lages av `HOTLOOP_BOX_HEALTH_NODE` ([OPC UA-serveren](/nb/edge/opc-ua-server/#maskinhelse-for-embernet-dashbordet)).

### UniFi Network

Anleggsnettverket som en enhet: ett område på én UniFi-konsoll, svitsjene, hver svitsjport, PoE-uttak, WAN-lenkene og områdets helse, som tagger som oppretter seg selv etter hvert som utstyr adopteres, skrivebeskyttet til den armeres. Én pålogging per konsoll, sertifikatet festet og konsollpassordet kryptert i databasen. Den endrer bare konsollen gjennom de få kommandotaggene en person armerer (en lokaliseringslampe, en omstart, en PoE-strømsyklus på en port; se UNIFI.md). Den lytter også på konsollens hendelses-websocket, så en svitsj som faller ut står i loggboken når det skjer, med pollingen som sannhet under, og UniFi-fanen tegner oversikten, kartet, frontpanelene, klientene, nettverkene og WiFi. Alt om den står i [UniFi Network](/nb/iot/unifi/).

### SNMP

Alt med en SNMP-agent: svitsjer, UPS-er, PDU-er, effektmålere og hver Linux-maskin som kjører en SNMP-agent. Skrivebeskyttet. HotLoop sender aldri en SNMP SET, fordi en SET kan endre konfigurasjonen til en svitsj, og poenget med denne driveren er å se anleggsnettverket, ikke å drifte det.

```
1.3.6.1.2.1.1.5.0             sysName
.1.3.6.1.2.1.1.3.0            sysUpTime, a leading dot is accepted
1.3.6.1.2.1.2.2.1.8.2         ifOperStatus of the interface with ifIndex 2
```

En tags adresse er OID-en til én instans, tall adskilt med punktum. En skalar ender på `.0`; en tabellcelle ender på radens indeks. Taggens `dataType` avgjør hva den blir:

* Et tall agenten sendte (Integer, Gauge32, Counter32, Counter64, TimeTicks) er det tallet. Skala og offset brukes som overalt ellers.
* En OCTET STRING er tekst, med mindre taggen er et tall, og da tolkes den. Slik kommer et lastgjennomsnitt (`laLoad` er teksten `0.15`) eller en temperatur bak en agent. Tekst som ikke er et tall er en dårlig avlesning som sier det, aldri null.
* En OCTET STRING som ikke kan skrives ut (en MAC-adresse) er `0x` og heksadesimale sifre.

**Tellere er rå.** En Counter32 eller Counter64 går bare opp og går rundt. Taggen holder det agenten sendte, og en rate er opp til det som leser taggen. Counter64 holdes som en float, som er eksakt til 2^53; en port på linjehastighet bruker tiår på å komme dit.

**TimeTicks er hundredeler av et sekund**, så `sysUpTime` lest som en vanlig tag er i 1/100 s. Integrasjonen skalerer den til sekunder for deg; en tag laget for hånd bør sette `scale` til `0.01`.

**Et objekt agenten ikke har er en dårlig avlesning med årsaken**, og de andre i den samme forespørselen leses likevel: v2c og v3 sier hvilke som manglet, og for v1, som svarer på et manglende objekt med en feil for hele forespørselen, tar driveren det ut og spør på nytt om resten. Et svar som er for stort for agenten etterspørres på nytt i halvdeler.

Enhetsalternativer (`config`):

| Alternativ | Betydning |
|---|---|
| `version` | `1`, `2c` eller `3`. Standard `2c` |
| `community` | v1- og v2c-communityen. Påkrevd for disse, og **det finnes ingen standard**: `public` er slik et anleggs svitsjer blir lest av hvem som helst som spør. En hemmelighet |
| `username` | v3-brukeren |
| `securityLevel` | `noAuthNoPriv`, `authNoPriv` eller `authPriv`. Standard: `authPriv` med en personvern-passfrase, `authNoPriv` med bare en autentiserings-passfrase, ellers `noAuthNoPriv` |
| `authProtocol` | `MD5`, `SHA`, `SHA224`, `SHA256`, `SHA384` eller `SHA512`. Standard `SHA` |
| `authPassword` | Autentiserings-passfrasen. En hemmelighet |
| `privProtocol` | `DES`, `AES`, `AES192`, `AES256`, `AES192C` eller `AES256C`. Standard `AES` |
| `privPassword` | Personvern-passfrasen. En hemmelighet |
| `contextName` | v3-konteksten. Nesten alltid tom |
| `transport` | `udp` (standard) eller `tcp` |
| `retries` | Hvor mange ganger en forespørsel som ikke fikk svar sendes på nytt, 0 til 10. Standard 1 |
| `maxRepetitions` | Rader per GETBULK i en gjennomgang. Standard 10, som de minste agentene svarer på |
| `browseRoots` | OID-er som skal gås gjennom ved oppdagelse av punkter. Standard: system, grensesnitttabellene, host resources, lasttabellen og en SNMP-agents extend-utdata |
| `browseMaxNodes` | Hvor en browsing stopper. Standard 2000 |

Adressen er `host` eller `host:port`, port 161 som standard.

**En feil community svarer med ingenting.** En SNMPv1- eller v2c-agent forkaster en forespørsel med en community den ikke kjenner, så en feil community, en feil port, en brannmur og en agent som er nede ser alle ut som et tidsavbrudd, og HotLoops melding nevner alle fire. SNMPv3 skiller dem: en feil passfrase eller en ukjent bruker avvises som sådan (`ErrAuthRejected`), og HotLoop venter lenge før den prøver den samme legitimasjonen igjen.

`Browse` går gjennom undertrærne HotLoop kan navngi og gir hvert objekt et navn: MIB-ens, som `sysName`, `ifOperStatus.2`, `ifHCInOctets.2`, `laLoad.1`, eller OID-en som `oid.1.3.6.1...` for et objekt den ikke kjenner. Navnene, og OID-ene, typene og enhetene bak dem, kommer fra MIB-ene som definerer dem: SNMPv2-MIB (RFC 3418), IF-MIB (RFC 2863), HOST-RESOURCES-MIB (RFC 2790) og en SNMP-agents UCD-SNMP-MIB og NET-SNMP-EXTEND-MIB. Alt annet agenten har kan fortsatt leses; legg det til som en tag med OID.

Integrasjonen (se [Integrasjoner](/nb/iot/integrations/#snmp)) gjør forespørslene for deg.

### BACnet/IP

En bygningsautomasjonskontroller, en måler, en termostat: alt på IP-nettverket som snakker BACnet. Skrivebeskyttet. HotLoop skriver aldri en BACnet-egenskap, fordi en skriving lander på en kommanderbar utgang gjennom en prioritetsmatrise, og en prioritet som blir stående holder utstyret der det ble satt lenge etter at den som satte den har gått hjem. Det er en funksjon som skal utformes med hensikt, ikke en som skal bli liggende igjen.

Den holdes til rammer tatt opp fra en ekte enhet, dekodet av tester som alltid kjører, og til den enheten i testing.

```
analog-input:1                present value of analog input 1
ai:1                          the same, abbreviated
av:3.units                    a property other than the present value, by name
analog-input:1.117            or by number
multi-state-value:2           present value of a multi-state value
```

En tags adresse er objektet, `<type>:<instance>`, og et punktum og en egenskap når det ikke er present value. Typene, med navn eller forkortelse: `analog-input` (`ai`), `analog-output` (`ao`), `analog-value` (`av`), `binary-input` (`bi`), `binary-output` (`bo`), `binary-value` (`bv`), `multi-state-input` (`msi`), `multi-state-output` (`mso`), `multi-state-value` (`msv`), `accumulator` (`acc`), `integer-value` (`iv`), `positive-integer-value` (`piv`), `large-analog-value` (`lav`) og `characterstring-value` (`csv`). Egenskapene med navn er `present-value`, `object-name`, `description`, `units`, `status-flags`, `out-of-service`, `reliability`, `number-of-states`, `state-text`, `object-type`, `object-identifier`, `object-list`, `vendor-name`, `vendor-identifier`, `model-name`, `firmware-revision` og `application-software-version`; enhver annen egenskap er nummeret sitt.

Hva en tag blir følger `dataType`: et tall enheten sendte (real, double, unsigned, signed, enumerated, boolean) er det tallet, og et binært objekts `active` er 1 og `inactive` er 0; en tegnstreng er tekst, eller et tall hvis taggen er det og teksten er et tall; en present value på `null` er en dårlig avlesning som sier at enheten ikke har noe å rapportere. En egenskap som holder mer enn én verdi (en objektliste) kan ikke være en tag.

**Statusflagg er en del av avlesningen.** Hver polling ber om et objekts statusflagg i samme forespørsel som present value, og et objekt der **fault**-flagget er satt leses **dårlig**, med årsaken. Et som er **ute av drift** eller **overstyrt** leses **usikkert**: present value er noe en person eller et program la der, ikke en måling, og trenddiagrammene og rapportene utelater usikre avlesninger som dårlige (kvalitetsregelen). **I alarm** alene er en god avlesning av et punkt som er i alarm.

**Det enheten ikke har er en dårlig avlesning med årsaken, og resten leses likevel.** ReadPropertyMultiple svarer på hver egenskap for seg, så et objekt som ikke finnes (`unknown-object`) eller en egenskap det ikke har (`unknown-property`) får den taggen til å feile og ingen andre. En enhet som avviser ReadPropertyMultiple leses én egenskap om gangen fra da av.

**Ingenting segmenteres.** Klienten forteller enheten at den ikke kan ta imot et segmentert svar. En enhet hvis svar ikke ville passe i én ramme avbryter (`segmentation-not-supported`), og HotLoop ber om halvparten så mange objekter om gangen; en enhet hvis objektliste er for stor til å sendes hel leses ett element om gangen.

Enhetsalternativer (`config`):

| Alternativ | Betydning |
|---|---|
| `deviceInstance` | Instansnummeret enheten på denne adressen forventes å ha. Når det er satt og enheten sier et annet, avvises tilkoblingen: en annen enhet som svarer på en gjenbrukt adresse, eller en kontroller som ble byttet, er slik et anlegg får et feil tall som ser rent ut |
| `localAddress` | Adressen til denne maskinens nettverkskort å sende fra, for en vert med mer enn ett. Vanligvis tom |
| `retries` | Hvor mange ganger en forespørsel som ikke fikk svar sendes på nytt, 0 til 10. Standard 1 |
| `browseMaxObjects` | Hvor en browsing stopper. Standard 1000 |

Adressen er `host` eller `host:port`, port 47808 som standard. Ingenting i BACnet/IP er legitimasjon, så det finnes ingen å skjule.

**Tilkoblingen spør enheten hvem den er.** HotLoop sender enheten en unicast Who-Is og henter enhetsinstansen fra I-Am. En enhet som ikke svarer på en blir spurt om sitt eget enhetsobjekt under jokerinstansen (4194303), som standarden sier at en enhet svarer på som seg selv. En enhet som ikke svarer på noen av dem rapporteres med begge forsøkt, fordi de vanlige årsakene ser like ut: en feil adresse eller port, en brannmur, en enhet som er nede, eller en enhet på et nettverk bak en ruter.

**Ruting er ikke bygget.** HotLoop snakker med en enhet den kan sende et UDP-datagram til. En kontroller på en MS/TP-stamme bak en BACnet-ruter, eller på et annet BACnet-nettverk, kan ikke nås, og det kan heller ikke en enhet bare en BBMD kan nå (foreign device-registrering). Adresser ruterens egen BACnet/IP-side, eller sett en gateway foran: se [gateway-modus](#alt-annet-gateway-modus).

`Browse` leser enhetens eget objekt (navn, leverandør, modell og fastvare), objektlisten og hvert objekt HotLoop leser: navn, beskrivelse, enheter, present value og statusflagg, og tilstandsteksten til et multi-state-objekt. En tag får objektets eget navn, med adressen lagt til når to objekter deler det. Enheter blir en etikett og, der de betyr en, en entitetsklasse: grader Celsius er `°C` og `temperature`, prosent relativ fuktighet er `%` og `humidity`, kilowattimer er `kWh` og `energy`. En enhet HotLoop ikke har en etikett for blir stående uten etikett og navngis i beskrivelsen med nummeret sitt. Numrene og navnene på disse enhetene er holdt mot en ekte enhet, som sender nummeret sin egen tabell gir hvert navn. Integrasjonen (se [Integrasjoner](/nb/iot/integrations/#bacnetip)) gjør forespørslene for deg.

## Ut: Kafka-API-et

Alt ovenfor henter inn en enhets verdier. HotLoop kan også sende dem ut til en Kafka-megler som en hendelsesstrøm: hver avlesning historian lagrer, og hver linje i systemloggen (alarmer, enheter som faller ut og kommer tilbake, endringer), som JSON på topics du navngir. Det er et historian-mål, satt opp under Innstillinger, Historikkmål, og det tar Apache Kafka, Redpanda og alt annet som snakker Kafka-API-et, over TLS med en SASL-pålogging. Postformatene, hva "minst én gang" betyr her, og hva som er og ikke er bevist står i [Historian-mål](/nb/iot/historian-targets/#kafka-api-hendelsesstrøm). Klienten er [franz-go](https://github.com/twmb/franz-go).

## Alt annet: gateway-modus

**PROFINET · EtherCAT · HART · DNP3 · FINS · MELSEC/SLMP · CANopen · FANUC FOCAS**

Disse snakkes ikke nativt, og det finnes ingen driver for dem. Det er et bevisst valg, ikke et hull som venter på å bli fylt med en stub.

Anlegg som kjører disse protokollene har nesten alltid allerede en gateway som republiserer på OPC UA eller Modbus: en PROFINET IO-kontroller med en OPC UA-server, en HART-multiplekser med et Modbus-kart. Pek en enhet mot det endepunktet og konfigurer den som OPC UA eller Modbus.

Å skrive åtte drivere til som hver duplikerer det et anleggs eksisterende gateway allerede gjør, ville lagt til åtte ting til å gjøre subtilt feil, for protokoller der utstyret er vanskeligst å teste mot. Hvis et anlegg virkelig ikke har noen gateway og trenger en av disse nativt, er det et reelt stykke arbeid å planlegge, ikke en fil å legge til som logger "not implemented".

**Det finnes ingen plassholderdrivere i dette treet.** En protokoll har enten en fungerende implementasjon eller står i denne delen. En test sikrer at hver protokoll modellen deklarerer har en driver kompilert inn, og omvendt.

## Enhetslegitimasjon

En enhets `config` og `address` er der en driver finner det den logger inn med. Dette er legitimasjonen hver protokoll leser, og alle er kun skrivbare gjennom API-et, aldri lesbare (4.15.1): de vises som `[redacted]` for alle roller, en lagring som sender plassholderen eller utelater nøkkelen beholder den lagrede verdien, og en ny streng erstatter den. Reglene, og det som ikke går gjennom API-et, står i [Autentisering og brukere](/nb/iot/authentication/#enhetslegitimasjon-er-skrivebeskyttet).

| Protokoll | Legitimasjon i konfigurasjonen | Legitimasjon i adressen |
|---|---|---|
| OPC UA | `password` (med `username`) | ingen: brukerinformasjon i adressen skjules, og driveren ignorerer den |
| MQTT / Sparkplug B | `password` (med `username`) | `mqtt://user:pass@host`, som klienten bruker |
| HTTP / REST | `password` (med `username`, sendt som basic auth); hver verdi i `headers` unntatt vanlige som `Accept` og `Content-Type`, som er der en API-nøkkel eller en `Authorization`-header hører hjemme; `body` og `writeBody` hvis de nevner legitimasjon | `http://user:pass@host` og spørringsverdier i `?api_key=`-stil, i adressen og i `writeUrl` |
| MTConnect | `password` (med `username`); hver verdi i `headers`, med de samme unntakene | `http://user:pass@host` og spørringsverdier |
| UniFi Network | `password` (med `username`). Lagres bare kryptert: uten en nøkkel (nedenfor) kan enheten ikke lagres | ingen: adressen er konsollens `https://`-URL |
| BACnet/IP | ingen | ingen: adressen er `host` eller `host:port` |
| CODESYS | `password` (med `username`), som for OPC UA | ingen: brukerinformasjon i adressen skjules, og driveren ignorerer den |
| SNMP | `community` (v1, v2c); `authPassword` og `privPassword` (v3), med `username` | ingen: adressen er `host` eller `host:port` |
| Modbus, S7comm, EtherNet/IP | ingen | ingen: brukerinformasjon i adressen skjules, og driveren ignorerer den |

**Kryptert i hvile.** Med `HOTLOOP_SECRET_KEY_FILE` satt (charten setter den, med en nøkkel den genererer) er hver legitimasjon i konfigurasjonskolonnen ovenfor kryptert i databasen med den nøkkelen, som ligger utenfor databasen, så en dump eller sikkerhetskopi inneholder chiffertekst. Resten av HotLoop, og driverne, ser aldri forskjellen. En legitimasjon skrevet inn i en URL (`mqtt://user:pass@host`, `?api_key=`) eller i fritekst som en HTTP-`body` krypteres også: hele adressen eller alternativet forsegles og kommer tilbake nøyaktig som skrevet, og en URL uten noe hemmelig blir stående lesbar. `password`-alternativet er fortsatt det ryddigste stedet for en. Se [Sikkerhetskopier og gjenoppretting](/nb/iot/backup/#enhetslegitimasjon-og-den-hemmelige-nøkkelen).

Ethvert annet alternativ med et navn som ser ut som legitimasjon (det inneholder `password`, `token`, `secret`, `apikey`, `authorization`, `private`, `passphrase`, eller ender på `key`, eller har et helt ord som `pass`, `pw`, `auth`, `cred` eller `sig`, blant andre) skjules også, uansett hvilken protokoll det er i, så et alternativ som legges til en driver senere er skjult til noen bestemmer at det ikke skal være det. En test går gjennom hver drivers alternativer og feiler til hvert er på listen over legitimasjon eller listen over alternativer som er kjent for ikke å være det. Se [Autentisering og brukere](/nb/iot/authentication/#enhetslegitimasjon-er-skrivebeskyttet) for de fullstendige reglene.

## Legge til en enhet

1. **Enheter → Legg til enhet.** Velg protokollen, gi den en adresse.
2. **Oppdag tagger** der protokollen støtter det: OPC UA, EtherNet/IP, MTConnect, MQTT (etter en Sparkplug-fødsel), HTTP, SNMP, BACnet/IP, CODESYS. Modbus og S7comm kan ikke telle opp sine egne punkter, så deklarer dem fra enhetens dokumentasjon.
3. Importerte tagger opprettes **skrivebeskyttet**. Et punkt enheten tilfeldigvis eksponerer er ikke et punkt noen har bestemt kan kommanderes. Merk tagger som skrivbare én om gangen, med vilje.
4. Sett `scale` og `offset` for rå tellinger: `engineering = raw × scale + offset`. Hvis instrumentet sender en kode når en kanal er død eller utenfor område, list den under [Verdier uten data](#verdier-uten-data) slik at den leses dårlig i stedet for som et tall.
5. Sett en `deadband` på alt som er støyende. Den undertrykker historian-skriving for endringer som er for små til å bety noe, og uten den skriver en 12-bits sensor som jitrer i siste bit en rad hver skanning for alltid.

## Verdier uten data

En skriver med et utbrent termoelement går ikke stille. Den fortsetter å svare, og det den legger i registeret er en kode: 0x8005 for "undefined", 0x7FFF for "over range". Lest som en int16 med skala 0,1 er 0x8005 -3276,3 grader, og inntil vi rettet dette kom det tilbake med **god** kvalitet, gikk inn i historian som en ekte temperatur og ble liggende der for alarmene å dømme. En død sensor så ut som en kald.

Så en tag kan liste de rå verdiene som betyr "ingen måling". Hver har en årsak. Når en avlesnings rå verdi står på listen, er avlesningen **dårlig**, årsaken følger med, og skala og offset rører den aldri.

```json
{
  "deviceId": "dx-1", "name": "ch01", "address": "input:1:int16",
  "dataType": "float", "unit": "C", "scale": 0.1, "enabled": true,
  "noData": [
    {"raw": "0x7FFF", "reason": "+over"},
    {"raw": "0x8001", "reason": "-over"},
    {"raw": "0x8002", "reason": "skip"},
    {"raw": "0x8004", "reason": "error"},
    {"raw": "0x8005", "reason": "undefined"},
    {"raw": "0x7F7F", "reason": "power fail"},
    {"raw": "0x7FFA", "reason": "burnout up"},
    {"raw": "0x8006", "reason": "burnout down"}
  ]
}
```

Disse åtte er kodene til Yokogawa DX-familien, fra DX-kommunikasjonshåndboken (IM 04L41B01-17E, avsnitt 4.3, side 4-35). De er ikke spesielle for HotLoop: det er det samme feltet på hver tag i hver protokoll, og DX-listen er bare den som bet oss først. Hver står på taggen, så en skriverkanal som virkelig kan lese 0x7F7F i en annen enhet beholder den som en avlesning.

| Felt | <span class="sr-only">Detaljer</span> |
|---|---|
| `raw` | Enhetens kode, skrevet slik håndboken trykker den: `"0x8005"` (heksadesimal), `"-32763"` eller `32773` (desimal). En streng eller et rent tall. Påkrevd |
| `reason` | Hva avlesningens kvalitet sier. Opptil 120 tegn. Utelatt leses den `raw value 0x8005 means no measurement`, så en avlesning blir aldri dårlig uten å si hvorfor |

I tag-redigereren er det boksen **Verdier uten data**: én kode per linje, koden, et mellomrom, årsaken.

### Hvilket tall du skriver

For et registerbasert Modbus-punkt er koden heltallet enheten holder, etter at punktets byte- og ordrekkefølge er brukt. Det er det samme tallet punktet dekodes til, så en håndbok som sier "instrumentet returnerer 8005h" betyr nøyaktig `"0x8005"` her.

- **int16 og de andre fortegnstypene.** `0x8005` og `-32763` er det samme registeret, og det er `32773` også. Skriv det håndboken skriver; alle tre samsvarer. En kode som ikke passer i typen (`0x10000` på en int16) avvises når enheten kobler til, fordi en liste som aldri kan samsvare er verre enn en feil. To skrivemåter av én verdi på én tag avvises også.
- **uint16 og de andre typene uten fortegn.** `0` opp til typens maksimum. Et negativt tall avvises.
- **int32, uint32, int64, uint64.** De samme reglene ved 32 og 64 bit. `0x7FFFFFFF` på en int32 med ordrekkefølgen `CDAB` er verdien etter at ordene er satt riktig vei, ikke rekkefølgen de kom av ledningen i.
- **float32 og float64.** Koden er registerets bitmønster, så den må være heksadesimal: `0x7FC00000` for en stille NaN. Et desimaltall avvises, fordi 32773 som float og 32773 som bitmønster er forskjellige ting og vi gjetter ikke.
- **Bits, coils, diskrete innganger og strenger.** Ikke noe rått tall å sammenligne med, så `noData` på en av dem avvises når enheten kobler til.

Kontrollen gjøres på de rå bitene, før dekoding, før skala, før offset.

### Andre protokoller

Hver driver som leverer et allerede dekodet tall sjekker den samme listen: S7comm, EtherNet/IP, OPC UA, HTTP og MQTT (inkludert oppdagede enheter). Det de sammenligner er det dekodede tallet, som et heltall, så skriv det som tallet det er. En S7 INT som holder 0x8005 er -32763, så skriv `-32763`. Heksadesimal er her bare en annen måte å skrive det samme tallet på, fordi et dekodet tall har mistet bredden sin og ikke kan leses tilbake som et bitmønster. En brøkverdi samsvarer aldri. Listen er bare verdt å sette der enheten sender koder som disse; det meste MTConnect og UniFi rapporterer gjør det aldri.

### Hva en vaktverdi gjør

- **Kvaliteten** er `bad` og avlesningen bærer årsaken. Den vises på `GET /api/values` og den levende strømmen (`reason`), ved siden av kvaliteten på Tagger-skjermen, og på taggens entiteter som attributtet `quality_reason`.
- **Verdien** er tom, ikke null og ikke den skalerte koden. Skala og offset brukes ikke.
- **Historian** registrerer kvaliteten som dårlig, på samme måte som enhver annen dårlig avlesning, og verdikolonnen holder ingenting meningsfullt. En bøtte uten noen god avlesning vises som et hull i en trend, som for enhver dårlig avlesning.
- **Alarmer.** En dårlig avlesning utløser aldri en verdialarm: høy, lav, lik og endringsrate beholder alle sin forrige tilstand, som for enhver dårlig avlesning. En `bad-quality`-alarm på taggen utløses derimot, og standardmeldingen bærer årsaken (`dx-1/ch01 bad-quality: undefined`). Bruk `{reason}` i din egen melding for å legge den inn.
- **Loggboken** registrerer at taggens entitet blir dårlig, og årsaken er entitetens `quality_reason`-attributt.

### Hvor det bor

På taggen, lagret med den. Gjennom API-et er det `noData`-listen på `POST /api/tags` (se [HTTP-API-et](/nb/iot/api/#post-apitags)), i redigereren er det boksen ovenfor, og i en Edge Relay er det den samme JSON-en i enhetsfilens tag (se [Edge Relay-referanse](/nb/edge-relay/reference/)). Å lagre taggen laster den kjørende enheten på nytt, så en endring trer i kraft ved neste polling og ingenting startes på nytt for hånd. En ny oppdagelse lar en tags liste være i fred.

## Kvalitet

Hver avlesning bærer `good`, `uncertain` eller `bad`.

**Dårlig betyr at verdien ikke er kjent. Det betyr ikke null.** En driver som ikke kan lese et punkt sender likevel en avlesning, merket dårlig, fordi stillhet ikke kan skilles fra en verdi som ikke har endret seg, og på en trend er forskjellen mellom "sensoren leser 0" og "sensoren sluttet å svare" forskjellen mellom et prosessproblem og et instrumentproblem.

Alarmevalueringen beholder sin forrige tilstand ved en dårlig avlesning i stedet for å evaluere den. En sensor som feiler til null ville ellers utløst hver lavalarm på enheten og sett ut som en prosesshendelse.
