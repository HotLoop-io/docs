---
title: "Autentisering og brukere"
description: "Innlogging, roller, tokens og brukerskjermen, og hva en installasjon bak en klarert proxy må si høyt for å hoppe over dem."
---

HotLoop har sin egen innlogging siden 4.4.0, og hvert produkt krever den som standard. Det er fortsatt mulig å kjøre uten, bevisst, for en installasjon som virkelig er isolert bak dashbordet og vil si det rett ut, se [Kjøre uten innlogging](#kjøre-uten-innlogging), men en vanlig `helm install` eller en Podman Quadlet-enhet starter nå med krav om innlogging.

## Kort fortalt

- **Lokale brukere, bcrypt-passord, økter på serveren.** Ingen ekstern identitetsleverandør ennå; se [MCP](/nb/iot/mcp/) for den separate bearer-token-sikringen rundt agentgrensesnittet, som dette ikke erstatter.
- **Tre roller: admin, operator, viewer.** Rollen admin kan gjøre alt, også administrere brukere. Rollen operator kan lese alt og skrive tags, kvittere alarmer og utløse automasjoner. Rollen viewer kan lese alt og ingenting annet. En bruker kan også få en eksplisitt liste med tillatelser i stedet for en rolle, for alt som skal være snevrere.
- **En økt er en cookie eller et bearer-token**, det som er enklest for klienten. Nettleserens grensesnitt bruker cookien; et skript eller en annen tjeneste bruker `Authorization: Bearer <token>`.
- **Et delt panel logger folk inn med PIN eller adgangskort** og logger dem ut når ingen rører det, så hver skriving der har en persons navn. Se [Kioskpaneler](#kioskpaneler-pin-eller-adgangskort-og-utlogging-ved-inaktivitet).
- **Økter utløper.** `HOTLOOP_AUTH_SESSION_TTL`, 12 timer som standard. Det finnes ingen «husk meg»: en økt som varer lenger enn et arbeidsskift er en økt ingen følger med på.

## Den første kontoen

Chartet lager én ved første installasjon og viser den én gang, i NOTES-utskriften fra `helm install`:

```
helm install hotloop ./charts/hotloop \
  --namespace hotloop --create-namespace
```

Hvis du kjører binærfilen direkte, generer en hash og sett to variabler:

```sh
hotloop hash-password
# Password: ********
# Confirm password: ********
# $2a$10$....................................................

export HOTLOOP_AUTH_ENABLED=true
export HOTLOOP_ADMIN_USER=admin
export HOTLOOP_ADMIN_PASSWORD_HASH='$2a$10$....................................................'
```

`hash-password` tar også `-password` direkte, for et skript som allerede har ett:

```sh
hotloop hash-password -password 'something-long'
```

Admin-kontoen som opprettes slik er en **oppstartskonto**, ikke en tilbakestillingsbryter. Når den finnes, gjør det ingenting å endre `HOTLOOP_ADMIN_PASSWORD_HASH` og starte på nytt: `EnsureAdminUser` oppretter bare kontoen hvis brukernavnet ikke finnes fra før, så en verdi her kan aldri overskrive et passord som en operatør har endret i grensesnittet siden. Dette betyr mest ved en Helm-oppgradering: å bruke den samme `values.yaml` på nytt må ikke i det stille gjenopprette noens passord.

## Roller

| Rolle | Kan |
|---|---|
| **admin** | Alt: `*`. Også opprette, deaktivere og slette brukere. |
| **operator** | Lese alle skjermer. Skrive tags (`POST /api/write`) og styre entiteter (`POST /api/services/...`), sette hjelpere (`helpers.write`, se [Hjelpere](/nb/iot/helpers/)), kjøre og stoppe skript (`scripts.run`, se [Skript](/nb/iot/scripts/)), bruke oppskrifter (`recipes.apply`, se [Oppskrifter](/nb/iot/recipes/)), lage en regel fra en blueprint og oppgradere den (`blueprints.apply`, se [Blueprints](/nb/iot/blueprints/)), se dashbordene som tilbys rollen (`dashboards.read`, se [Dashbord](/nb/iot/dashboards/)), lese energien som er brukt og hva den kostet (`energy.read`, se [Energi](/nb/iot/energy/); å lage en måler eller en tariff er `energy.write`, en admins oppgave), ordne om tavlen, kvittere, utsette og gjenoppta alarmer, utløse automasjoner. Kan ikke redigere *definisjonene* av enheter, tags, alarmer, automasjoner, skript, oppskrifter, blueprints eller dashbord, og kan ikke administrere brukere. |
| **viewer** | Lese alle skjermer. Ingenting annet. |

En bruker kan få en eksplisitt `permissions`-liste i stedet for en rolle, som **erstatter** rollen helt i stedet for å legges til: en bruker er enten «rollen operator» eller «akkurat disse tillatelsene», aldri begge, så det finnes ett sted å se for å vite hva noen kan gjøre.

Tillatelser skrives som `resource.action`, `tags.write`, `alarms.ack`, eller et ressurs-jokertegn, `tags.*`, eller det globale jokertegnet `*`.

## Kioskpaneler: PIN eller adgangskort, og utlogging ved inaktivitet

På din egen datamaskin er du allerede innlogget: du skrev passordet én gang, og en skriving går rett gjennom skriveporten og logges på deg, som den alltid har gjort. Ingenting av det er endret. Et panel på veggen er ingens datamaskin. Hvis det er innlogget som `panel-3`, sier revisjonssporet «panel-3 åpnet ventilen», og det er ikke et revisjonsspor. Derfor logger et panel inn en person med PIN eller adgangskort, hver skriving er den personens, og panelet logger vedkommende ut når ingen rører det.

### Hva operatøren ser

Et panel er en fysisk skjerm: HotLoop åpnet på `/?screen=<name>` (se [Dashbord](/nb/iot/dashboards/#roller-og-skjermer)). Når ingen er innlogget, viser det ett felt, «PIN eller adgangskort», og ingenting fra anlegget. Skriv PIN-koden og trykk Enter, eller skann adgangskortet. Panelet åpner dashbordet sitt, med hvem som er innlogget og en **Logg ut**-knapp i hjørnet, fordi toppfeltet som vanligvis ville vist det, ikke finnes på et panel. Et trykk på en skriveknapp ber om bekreftelse og begrunnelse som ellers, og skrivingen registreres på den personen.

Etter inaktivitetsgrensen, uten at noen rører skjermen, logger panelet personen ut og går tilbake til PIN-feltet. Serveren håndhever det i tillegg til siden: en kioskøkt som har vært inaktiv så lenge slettes, og en skriving som sendes etterpå med cookien blir avvist med `401`, så å lukke siden, eller en side som har hengt seg, lar ingen stå innlogget. Hvis panelet må brukes med passord, er «Bruk passord» under feltet den vanlige innloggingen, med de vanlige 12 timene og uten inaktivitetsgrense, fordi den er en persons egen innlogging.

Det som teller som å røre: et trykk, et klikk, et tastetrykk eller en skriving. Det som ikke teller: at dashbordet oppdaterer tallene sine, eller livestrømmen, som fortsetter uansett om noen er der.

### Oppsett

En admin gir hver person en kode under **Innstillinger, Brukere**: **PIN eller adgangskort** på raden deres, koden to ganger, **Sett**. Eller via API-et, som er det et skript som utsteder adgangskort ville brukt:

```sh
curl -X PUT -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"code":"482913"}' https://gateway/api/users/olga/pin

# Take it away (also signs them out of every panel)
curl -X DELETE -H "Authorization: Bearer $TOKEN" https://gateway/api/users/olga/pin
```

- **En PIN er en legitimasjon.** Den lagres som en bcrypt-hash med samme kostnad som et passord, aldri i klartekst, aldri i systemloggen og aldri i et svar. Brukerlisten sier bare `hasPin`. En sikkerhetskopi inneholder hashene akkurat som de for passord ([Sikkerhetskopier og gjenoppretting](/nb/iot/backup/)).
- **Et adgangskort er en verdi som en tastaturleser skriver.** Det finnes ingen maskinvaredriver. En leser som oppfører seg som et tastatur skriver kortets nummer i panelets ene felt og trykker Enter, som er innsendingen av skjemaet. Så et adgangskort er en kode som en PIN: det leseren skriver, 6 til 72 tegn uten mellomrom, satt på kontoen på samme sted. Å lese det fra en leser som ikke oppfører seg som et tastatur er ikke bygget.
- **Én kode, én konto.** Panelet finner personen ut fra koden alene, siden en kortleser ikke skriver brukernavn, så å sette en kode som en annen konto har, blir avvist.
- **Koden sjekkes mot hver konto som har en,** med den samme bcrypt som et passord koster, fordi en saltet hash ikke kan slås opp etter verdi. Det tar like lang tid som det er kontoer med koder, et par sekunder i verste fall med titalls, og det tar like lang tid enten koden er riktig eller feil.
- **En kode logger inn med kontoens rolle.** Gi den til noen hvis rolle er den de skal ha ved et panel. En kioskøkt har kontoens egne tillatelser og ingenting snevrere, og en viewers kode logger inn en viewer, hvis skrivinger porten avviser som alltid.
- **Å deaktivere en konto** avslutter paneløktene dens sammen med resten, og koden til en deaktivert konto logger ikke inn. **Å ta bort koden** logger kontoen ut av panelene og lar passordet og øktene på dens egen datamaskin være i fred.

### Tiden før utlogging ved inaktivitet

Femten minutter som standard. Det er lenge nok til å gjennomføre et skifte av jobb ved panelet med en skriveplate i hånden, eller til å gå bort til ventilen og se den bevege seg, og kort nok til at et panel som er igjen etter en jobb ikke fortsatt er noens navn når neste person kommer. Det er min vurdering, ikke et tall koden eller en standard fastsetter. Endre den i **Innstillinger, Anlegg, Kioskutlogging ved inaktivitet (sekunder)**, fra 10 sekunder til 12 timer, uten ny utrulling, eller sett en standard med `HOTLOOP_AUTH_KIOSK_IDLE` (en varighet, `15m`). Det som er satt i Innstillinger går foran variabelen. Økten slutter også ved `HOTLOOP_AUTH_SESSION_TTL`, som enhver økt.

### Låsing etter feil passord og PIN

Et feil passord eller en feil PIN telles mot **kontoen** det ble prøvd på. Ti feil på rad låser den kontoen i fem minutter, og ingen andres. Et riktig passord eller en riktig PIN før den tiende starter tellingen på nytt, og en utløpt lås gir ti nye forsøk. En låst konto avviser en innlogging uansett hva som skrives, riktig eller feil, med en `429` som sier hvor lenge man må vente. En lås stopper nye innlogginger og ingenting annet: en økt kontoen allerede har fortsetter, med forespørslene og livestrømmen sin, så ti feil gjetninger fra noen andre kan ikke slokke en operatørs skjerm på linjen. Den gjelder både passordinnlogging og PIN-innlogging, og hver lås står i systemloggen (kategori `auth`).

- **Hvor tallene kommer fra.** NIST SP 800-63B sier at en verifikator begrenser antall påfølgende mislykkede forsøk på én enkelt konto: revisjon 3, avsnitt 5.2.2, og revisjon 4, avsnitt 3.2.2, setter begge maksimum til 100 og sier at en operatør kan sette det lavere. Revisjon 4 tillater også å la den som prøver vente etter feil. Dette er den ventingen, ikke en permanent deaktivering. Ti er en tiendedel av NISTs tak, og mer enn noen skriver feil ved et uhell. Fem minutter er lenge nok til at ti forsøk per fem minutter holder millionen muligheter for en PIN på seks tegn utenfor rekkevidde (omtrent 350 dager for å prøve alle), og kort nok til at en operatør som tastet feil passord er tilbake etter en kaffe. Seks tegn som minimum for en PIN er revisjon 3s gulv i avsnitt 5.1.1.2 for en tildelt hemmelighet, som en PIN en admin deler ut er. Ti og fem er mitt valg innenfor NISTs grense, ikke NISTs tall.
- **Begge er innstillinger.** **Innstillinger, Anlegg**: «Lås en konto etter så mange feil passord eller PIN» (standard 10, fra 1 til 100, og 0 slår det av) og «Hvor lenge en låst konto forblir låst» (standard 5 minutter, fra 10 sekunder til ett døgn). Variablene er `HOTLOOP_AUTH_LOCKOUT_ATTEMPTS` og `HOTLOOP_AUTH_LOCKOUT_DURATION` (en varighet, `5m`). Innstillingen går foran variabelen.
- **En admin kan låse opp en konto.** **Innstillinger, Brukere** viser en låst konto som `locked` med en **Lås opp**-knapp, eller `DELETE /api/users/{username}/lockout`. Tellingen starter fra null.
- **Aldri panelet.** En feil kode skrevet på et panel telles aldri mot panelet, så én persons feil stopper ikke den neste.
- **En kode alene kan ikke telles, så panelet bremses i stedet.** En kortleser skriver bare kortet, og en PIN skrevet alene passer til ingen konto når den er feil, så det finnes ingen konto å telle den mot. Å telle den mot panelet ville stengt neste arbeider ute for den forriges feil, og panelet låses aldri. I stedet får hver påfølgende feil dette panelet til å vente et halvt sekund lenger før neste kontrolleres: 0,5 sekunder etter den første feilen, 1 etter den andre, og så videre opp til taket, 3 sekunder som standard. En riktig starter på nytt. Så neste arbeider kommer inn etter høyst taket, og den som gjetter holdes til ett forsøk per tak per panel: en million sekssifrede PIN-koder ville tatt over en måned. Forsøk som sendes samtidig står i kø, og hvert venter på sin tur. En PIN skrevet med brukernavnet bremses ikke; den tilhører kontoen og låser den som et feil passord. Lengste ventetid er **Innstillinger, Anlegg, Lengste ventetid for et panel etter feil PIN (sekunder)**, 0 til 30, med `HOTLOOP_AUTH_PANEL_DELAY_CAP` som standard (en varighet, `3s`) og 0 for å slå det av. Tre sekunder er en pause en arbeider som tastet feil tåler, og tregt nok til å merkes for noen som prøver hver kode. Steget på et halvt sekund er fast.
- **Hvilket panel som er hvilket.** Klientadressen: første hopp i `X-Forwarded-For` når en proxy har satt en, ellers tilkoblingens egen, som også er det øktlisten registrerer. Noe bedre er ikke kjent før innlogging: det finnes ingen økt ennå, og en cookie utdelt av serveren er en klienten kan kaste for å starte ventingen på nytt. Så bak en proxy som setter `X-Forwarded-For` venter hvert panel for seg. Bak en som ikke gjør det, deler alle panelene proxyens adresse og bremser hverandre, med høyst taket. Og en klient som når porten direkte kan sende sin egen `X-Forwarded-For` og unngå ventingen. Derfor er dette en bremsing og låsen på kontoen kontrollen: for gjetting som betyr noe, bruk formen med brukernavn, eller lange tilfeldige kortverdier.
- **Det sier at kontoen finnes.** `429` gjelder en konto som finnes, så den forteller den som prøver navn hvilke som finnes. Det er det en lås er.

### Hva det ikke gjør

- **En kode alene kan ikke låses ute.** Se [Låsingen](#låsing-etter-feil-passord-og-pin), som sier hvorfor.
- **Ingen advarsel før utlogging.** Panelet går tilbake til PIN-feltet når tiden er ute.
- **Et panel som står innlogget med passord** (slik et panel måtte kjøres før dette) fungerer fortsatt som før og skriver fortsatt som den kontoen. Ikke gi et delt panel en fast operatørinnlogging; gi folkene ved det PIN-koder.
- **Ingen leserdriver, ingen SSO, ingen tillatelser per panel.**

## Administrere brukere

Bare admin. I grensesnittet er det **Innstillinger, Brukere**: hver konto med rolle, om den er på, og når den sist logget inn, med Legg til en bruker, Rediger (rolle, og å slå den av), Nytt passord og Slett. Ingenting tegnes for noen uten `users.manage`, eller når autentisering er av. En konto hvis tillatelser ble listet én og én vises som `custom` med hvor mange, og Rediger beholder listen med mindre du velger en rolle, som erstatter den. De samme tingene via REST-API-et:

Et passord er 8 til 72 byte: 72 er bcrypts egen grense, og et lengre avvises med det oppgitt. Det fungerer likt over OPC UA (se [OPC UA-serveren](/nb/edge/opc-ua-server/#who-may-log-in)); i tidligere versjoner kunne et passord over 64 byte logge inn her og ikke der.

```sh
# List
curl -H "Authorization: Bearer $TOKEN" https://gateway/api/users

# Create
curl -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"username":"j.smith","password":"something-long","role":"operator"}' \
  https://gateway/api/users

# Disable (does not delete; also revokes every session that account holds)
curl -X PUT -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"role":"operator","disabled":true}' \
  https://gateway/api/users/j.smith

# Reset a password an operator forgot
curl -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"password":"a-new-one"}' \
  https://gateway/api/users/j.smith/password
```

To avvisninger er verdt å kjenne til før de overrasker noen:

- **Du kan ikke slette din egen konto mens du er innlogget med den.** Bytt til en annen admin-konto først.
- **Du kan ikke deaktivere eller slette den siste aktive admin-kontoen.** Gjør en annen konto til admin, eller la én være i fred, før du fjerner den første. Uten denne sjekken er én enkelt feil i en skriptet brukersynkronisering en utestengelse uten noen admin-økt igjen å rette det fra.

Enhver innlogget bruker kan endre sitt eget passord uten noen av begrensningene:

```sh
curl -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"currentPassword":"old","newPassword":"new"}' \
  https://gateway/api/auth/password
```

En passordendring tilbakekaller hver økt den kontoen har, også den som sendte forespørselen. Klienten forventes å logge inn på nytt.

## Enhetslegitimasjon er skrivebeskyttet

Lagt til i 4.15.1. Før det returnerte `GET /api/devices` og `GET /api/devices/{id}` en enhets `config` og `address` nøyaktig slik de var lagret, så enhver innlogget bruker, viewere inkludert, kunne lese MQTT-brokerens passord, HTTP- og MTConnect-legitimasjonen og alt annet som var lagret i en enhet. 4.15.0 skjulte bare OPC UA-passordet. Fra 4.15.1 kan en enhets legitimasjon ikke leses tilbake via API-et av noen rolle, **admin inkludert**. For å endre en sender du en ny verdi.

### Hva som regnes som legitimasjon

| Protokoll | Skjult i konfigurasjonen | Også skjult |
|---|---|---|
| MQTT | `password` | brukerinformasjon og hemmelige spørringsverdier i adressen (`mqtt://user:pass@broker`) |
| HTTP | `password`; hver verdi i `headers` unntatt noen vanlige (`Accept`, `Accept-Encoding`, `Accept-Language`, `Cache-Control`, `Content-Type`, `User-Agent`); `body` og `writeBody` når de nevner legitimasjon (`password`, `token`, `apiKey`, og lignende); en hemmelighetslignende spørringsverdi i `writeUrl` | brukerinformasjon og hemmelige spørringsverdier i adressen og i `writeUrl` |
| MTConnect | `password`; hver verdi i `headers`, med de samme unntakene | brukerinformasjon og hemmelige spørringsverdier i adressen |
| OPC UA | `password` | brukerinformasjon i adressen skjules også, og driveren ignorerer den, siden en OPC UA-endepunkt-URL ikke bærer legitimasjon |
| Modbus, S7comm, EtherNet/IP | ingen av alternativene deres er legitimasjon | brukerinformasjon i adressen skjules og ignoreres av driveren, av samme grunn |

En sti til en nøkkelfil (`keyFile`) er ikke nøkkelmateriale og vises. Det er heller ikke et flagg som `allowInsecureCredentials`.

Listene ovenfor kontrolleres i koden. En test leser hver drivers alternativstruktur og feiler når et alternativ verken står på listen over legitimasjon eller på listen over alternativer som er kjent for ikke å være det (`plainConfigKeys`), når et kart med frie oppføringer eller et fritekstfelt ikke står på legitimasjonslisten, og når en av listene nevner noe ingen driver leser. Så et nytt alternativ kan ikke slippes uten at noen bestemmer hvilket det er.

Som et sikkerhetsnett under listene skjules enhver nøkkel på enhver dybde i en enhets konfigurasjon ut fra navnet, i alle protokoller, når den inneholder `password`, `passwd`, `passphrase`, `pwd`, `secret`, `token`, `apikey`, `authorization`, `credential`, `private`, `bearer`, `cookie`, `basicauth`, `signature`, `jwt`, `oauth`, `sessionid` eller `connectionstring`, eller ender på `key`, eller har som helt ord ett av `pass`, `pw`, `pwd`, `passwd`, `auth`, `cred`, `creds`, `sig`, `signature`, `sas`, `jwt`, `otp`, `pin` eller `psk`. Ord deles ved skilletegn og ved overganger fra liten til stor bokstav, så `db_pass`, `smtp_pw`, `apiAuth` og `sasToken` teller, og `bypass`, `compass`, `passive`, `authority` og `pinned` gjør det ikke. Store og små bokstaver og skilletegn ignoreres, og det samme gjelder skrivemåter som `encoding/json` fortsatt ville lest som samme nøkkel (en lang s for s, Kelvin-tegnet for k). Regelen for korte ord er bevisst grov: en nøkkel ingen har gjennomgått, som `authMode`, er skjult til den legges til i `plainConfigKeys`.

En verdi som skjules ut fra navnet, og alt under en slik nøkkel, erstattes uansett type (et tall skjules like godt som en streng), unntatt en boolsk verdi, som ikke kan være legitimasjon. En streng som bærer legitimasjon i teksten sin skjules helt uansett hvor den står: en kommandolinje med `--password hunter2`, et `password=...`-par eller en tilkoblingsstreng, `Authorization: Bearer ...`. En enhet uten satt legitimasjon viser ingen, så «ikke noe passord» og «et passord jeg ikke kan se» kan skilles. En konfigurasjon som ikke kan leses som JSON vises som `{}` i stedet for som den er.

En skjult verdi vises som `[redacted]`. I en adresse erstatter den passordet og beholder brukernavnet (`http://svc:[redacted]@meter/api`), eller hele brukerinformasjonen når det ikke er kolon, og verdien av hver hemmelighetslignende parameter i spørringen og fragmentet (`?fmt=json&token=[redacted]`, `#access_token=[redacted]`). Parametere skilles med `&` eller `;`, eller med de prosentkodede formene `%26` og `%3B`, og hver vurderes for seg, så `?fmt=json` forblir lesbar. En parameter som heter `code` regnes som en hemmelighet i en adresse, på grunn av Azure Functions-nøkkelen i `?code=`, og ingen andre steder. En spørring som ikke kan leses rent (en ugyldig prosent-escape, et kontrolltegn) skjules helt i stedet for å bli gjettet på.

### Lagre en enhet

`POST /api/devices` oppretter en enhet når id-en er ny og erstatter den når id-en finnes. Det finnes ingen egen `PUT`. For hver legitimasjon i adressen og konfigurasjonen:

| Hva forespørselen sender | Resultat |
|---|---|
| En ny enhet med en ekte verdi | Verdien lagres som gitt. |
| En ny enhet med `[redacted]` | Avvist med en 400. Plassholderen lagres aldri som legitimasjon. |
| En eksisterende enhet, `[redacted]` | Den lagrede verdien beholdes. |
| En eksisterende enhet, nøkkelen utelatt | Den lagrede verdien beholdes. En klient som ikke kjenner til hemmeligheter kan ikke slette en ved et uhell. |
| En eksisterende enhet, en ny streng eller et nytt tall | Den erstatter den lagrede verdien. |
| En eksisterende enhet, en tom streng eller `null` | Den sletter den lagrede verdien. Dette er den eneste måten å fjerne en legitimasjon på. |
| `[redacted]`, uten noe lagret å beholde | Avvist med en 400. |

Plassholderen lagres aldri, uansett hvor den står i en konfigurasjon eller adresse: den erstattes av den lagrede verdien på samme sted, eller avvises når det ikke finnes noen.

To detaljer. Inne i `headers` (et kart hvis oppføringer personen valgte) er kartet enheten: en utelatt oppføring fjernes, `{}` sletter alle, og å utelate hele `headers`-nøkkelen beholder dem. En nøkkel sammenlignes uten hensyn til store og små bokstaver, slik driverne sammenligner den. Og alt som ikke er legitimasjon erstattes som alltid: en enhet lagret uten noen `config` beholder legitimasjonen sin og ingenting annet.

Enhetsredigereren i nettgrensesnittet viser en enhets konfigurasjon slik API-et returnerer den, plassholdere inkludert, og lagrer det den viser. Å redigere en enhet uten å røre legitimasjonen beholder den derfor. **For å endre en hemmelighet i grensesnittet, erstatt `[redacted]` i konfigurasjonen (eller i adressen) med den nye verdien.** Ingenting forhåndsutfylles med den gamle, så den som endrer en enhet må kjenne legitimasjonen for å endre den.

### Å flytte en enhet tar ikke hemmelighetene med

Beholdt legitimasjon sendes til det enheten peker på. Hvis den ble beholdt når en enhet ble flyttet, kunne alle som får lagre en enhet lese en lagret legitimasjon ved å peke den mot en lytter de selv har og la gatewayen legge den frem. Så når en lagring endrer vert eller port i adressen, eller i `writeUrl`, og ville beholdt en lagret legitimasjon (ved plassholder eller ved utelatelse), avvises den med en 400 som nevner legitimasjonen. Skriv den inn på nytt, eller send en tom streng for å slette den. Å endre stien, skjemaet eller noe annet ved enheten regnes ikke som flytting, og en enhet uten lagret legitimasjon kan flyttes fritt.

### Hvor en legitimasjon ikke dukker opp

For en enhet av hver protokoll, med en legitimasjon på hvert mulige sted, leter testene etter den i: hvert enhetsendepunkt (svar på liste, hent, opprett og oppdater) for en viewer, en operator og en admin; hvert annet lesende endepunkt; `/api/diagnostics` og `/api/status`; `/api/sites` og de utgående MCP-serverne den lister; livehendelsesstrømmen; systemloggen og skriverevisjonen; feilsvar; hvert MCP-verktøy og hver MCP-ressurs; og prosessloggen på feilsøkingsnivå, fra kjøretiden og fra driverne. En drivers feiltekst og kjøretidens hendelser og logger renses for en enhets legitimasjon, etter verdi og etter form, fordi en feil kan gjenta en adresse eller en servers svar. En legitimasjon på ett eller to tegn erstattes bare der den står som et eget ord, siden å erstatte den overalt ville ødelagt meldingen.

### Hvor legitimasjon fortsatt ligger i klartekst

Skrivebeskyttet gjelder API-et. Gatewayen trenger de ekte verdiene for å koble til, og disse stedene holder dem slik de er lagret:

- **Databasen.** Enhetslegitimasjon ligger i kolonnene `config` og `address`. Med `HOTLOOP_SECRET_KEY_FILE` satt krypteres de nøkkelbaserte i `config` (hvert `password`, topptekstverdier) med en nøkkel som holdes utenfor databasen, og det samme gjelder en adresse eller et alternativ med legitimasjon skrevet inn i teksten (`mqtt://user:pass@host`, `?token=`), forseglet i sin helhet. Se [Sikkerhetskopier og gjenoppretting](/nb/iot/backup/#enhetslegitimasjon-og-den-hemmelige-nøkkelen).
- **Sikkerhetskopier.** `devices.copy` i en sikkerhetskopi inneholder dem, kryptert eller ikke akkurat som databasen. Se [Sikkerhetskopier og gjenoppretting](/nb/iot/backup/#beskytt-sikkerhetskopifilene).
- **Enhetsfiler for Edge Relay.** Relayet leser en JSON-fil som bærer legitimasjonen til enhetene sine. Se [Edge Relay-referanse](/nb/edge-relay/reference/#credentials-in-the-device-file-4150).
- **Konfigurasjonspush til flåten.** En enhetsfil som pushes til et relay publiseres på et MQTT-topic, retained, som den er. Se [Flåteadministrasjon](/nb/gateway/fleet/).

Beskytt databasen, sikkerhetskopivolumet, relayets enhetsfil og brokeren deretter. At API-et sladdes endrer ingen av dem.

### Hvis upålitelige brukere kunne nå API-et

Før 4.15.1 kunne enhver innlogget bruker lese lagret enhetslegitimasjon via API-et. En operatør hvis gateway var tilgjengelig for brukere som ikke skulle hatt tilgang (en viewer-konto gitt til en entreprenør, for eksempel) bør rotere legitimasjonen til enhetene den holder: MQTT-brokeren, HTTP- og MTConnect-endepunktene og OPC UA-kontoene. Det har ikke vært noen offentlig versjon siden 4.3.1, så eksponeringen er begrenset til installasjoner av upubliserte bygg.

## Hva revisjonssporet registrerer

Hver skriving gikk allerede gjennom `write_audit` med en `actor`-kolonne, se skriveporten i hoved-README. Den kolonnen kommer nå fra økten, ikke fra en topptekst, og ved et kioskpanel er økten personen som logget inn med PIN eller adgangskort:

```
> write_tag tag=press-01/Zone1_Temp value=99 reason="testing"
```

registrerer `j.smith`, brukernavnet på økten som gjorde kallet, ikke det `X-Forwarded-User` tilfeldigvis sa. Innlogginger, kioskinnlogginger, utlogginger, passordendringer og hver brukeradministrasjonshandling, også å sette eller fjerne en PIN (aldri selve PIN-en), logges i systemloggen (`GET /api/events`, kategori `auth`) av samme grunn som skriverevisjonen finnes: en endring om seks måneder skal kunne forklares, ikke bare sees.

## Kjøre uten innlogging

Sett `HOTLOOP_AUTH_INSECURE=true` (eller chartets `auth.insecure: true`) for å kjøre nøyaktig som hver versjon før 4.4.0: ingen økt kreves, aktøren som registreres for en skriving kommer fra `X-EmberNET-User` eller lignende proxy-topptekster, og faller tilbake til `"operator"` hvis ingen er satt.

Dette er et reelt og forsvarlig valg for en installasjon der EmberNet-dashbordets egen NetworkPolicy er den faktiske perimeteren og ingenting annet kan nå poden. Det er ikke lenger standard fordi det er lett å tro at den betingelsen stemmer og vanskelig å bekrefte innenfra selve poden: hele poenget med 4.4.0 er at en feil i en NetworkPolicy, eller en installasjon som viser seg ikke å være bak dashbordet likevel, ikke også skal bety at `actor(r)` returnerer noe en angriper har valgt.

`config.Validate` nekter å starte når autentisering verken er slått på eller bekreftet på denne måten, nettopp for at «ingen autentisering» alltid skal være en beslutning noen har tatt med vilje, skrevet ned i installasjonens egen konfigurasjon, og ikke en standard ingen valgte.

## Innlogging fra EmberNet-dashbordet

En tenant som installerer HotLoop fra EmberNet App Store går fra LAUNCH inn i appen allerede innlogget som seg selv, uten at noe passord deles ut. Dashbordets apptjener setter `X-Embernet-Assertion` på hver forespørsel den bærer til denne poden: et ES256-token, gyldig i omtrent ett minutt, signert med en privat nøkkel bare dashbordet har. Det nevner personen (`email`), tenanten, den ene appen det ble laget for (`aud`, `<tenant>/<Service name>`) og HotLoop-rollen tenanten kobler den personens dashbordrolle til (`role`: `admin`, `operator` eller `viewer`).

Det er av med mindre en offentlig nøkkel er konfigurert, og da fungerer alt annet som før: lokale kontoer, cookien, bearer-tokenet, kioskpanelet.

| Variabel | Chart-verdi | Gjør |
|---|---|---|
| `HOTLOOP_AUTH_ASSERTION_PUBLIC_KEY` | `embernetSignin.publicKey` | dashbordets OFFENTLIGE nøkkel, PKIX PEM, ECDSA P-256. Storen fyller den inn ved en utrulling. |
| `HOTLOOP_AUTH_ASSERTION_AUDIENCE` | utledet fra namespace og release-navn | `<tenant>/<Service name>`. Påkrevd med nøkkelen; et token laget for en annen app eller tenant avvises. |
| `HOTLOOP_AUTH_ASSERTION_ISSUER` | `embernetSignin.issuer` | `embernet-dashboard` |
| `HOTLOOP_AUTH_ASSERTION_HEADER` | `embernetSignin.header` | `X-Embernet-Assertion` |

Hva en god påstand gjør: personen får en bruker her første gang dashbordet går god for dem (navngitt etter adressen deres, uten passord, så det er ingenting å gjette), brukerens rolle følger det dashbordet sendte ved hver forespørsel, og revisjonssporet nevner dem. Hva en dårlig gjør: 401, og den legges ikke i det stille til side til fordel for en øktcookie som tilfeldigvis er der. Avvist blir en dårlig signatur, enhver annen algoritme enn ES256, et utløpt eller ennå ikke gyldig token, ett som lever lenger enn ti minutter, en feil utsteder, en annen apps eller tenants audience, et tenant-krav som er uenig med audience, en rolle som ikke er en av våre og et navn uten adresse.

En lokal admin har det siste ordet om noen dashbordet slapp inn: deaktiver brukeren og de blir ute, og gi dem en eksplisitt tillatelsesliste og de beholder den. Skrivinger trenger fortsatt podens egne skrivebrytere; en påstand utvider dem aldri. Å logge ut av en økt dashbordet laget avslutter den ikke: tilgangen slutter ved neste forespørsel dashbordet slutter å signere.

## Hva dette ikke dekker ennå

- **Ingen OpenID Connect.** Lokale kontoer, pluss EmberNet-dashbordets signerte påstand beskrevet ovenfor. En integrasjon med en identitetsleverandør er ikke bygget.
- **Ingen roller per tenant eller per sted.** En brukers tillatelser er de samme overalt der Gatewayen kjører, noe som er greit for ett anlegg og ville trengt mer omtanke for flerstedsoppsummeringen i `Sites`.
- **Ingen låsing for en PIN eller et adgangskort skrevet alene,** bare for et passord og en PIN med brukernavnet sitt; se [Låsingen](#låsing-etter-feil-passord-og-pin). Sammenligningen i konstant tid i `handleLogin` hindrer at brukernavn kan telles opp ut fra svartid. En NetworkPolicy eller en proxy oppstrøms er fortsatt verdt å ha foran innloggingsendepunktet.
