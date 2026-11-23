---
title: "Referanse for Edge Relay"
description: "Den hodeløse Sparkplug B-noden som spør og videresender: hva den gjør, hver innstilling, køen på disk, flåtekonfigurasjon og hvordan den settes i drift."
---

Edge Relay er siden 4.6.0 en egen binærfil som kjører for seg selv: en Sparkplug B-edge-node som spør og videresender, uten database, uten nettgrensesnitt, uten autentisering og uten skrivevei. Den er laget for å kjøre på en Pi eller en liten industri-PC ute ved kanten og videresender alt den leser til en full Gateway som kjører et annet sted med en ekte database, over den samme Sparkplug B-utgiveren som 4.5.0 la til.

Merknaden til 4.5.0 sa det selv: edge-publisering fantes som en funksjon man kunne slå på inne i den fulle Gateway-prosessen, «ennå ikke den frittstående, lettere Edge Relay-utgaven». Dette er den utgaven.

## Hva det ikke er

**Ikke en mindre Gateway med færre valg.** Det er en annen binærfil med et langt mindre sett avhengigheter. Den har ingen database, ikke noe nettgrensesnitt, ingen autentisering, ingen MCP-server eller -klient, ingen automatiseringsmotor og ikke noe enhetsregister.

**Kan ikke levere et grensesnitt, ta imot en skriving eller svare på et MCP-verktøykall.** Alle tre krever noe denne binærfilen bevisst ikke har: en autentisert identitet å tilskrive handlingen. En edge relay bestemmer ingenting og bekrefter ingenting tilbake til et menneske; den leser og videresender.

**Ikke konfigurert gjennom en database, og den har ikke noe eget konfigurasjons-API.** Enheter og tagger kommer fra en lokal JSON-fil som leses ved oppstart, eller fra en fil Gateway sender over megleren, som tas i bruk direkte (se [Konfigurasjonssending](#konfigurasjonssending-480)). Ingenting på relayen lytter etter ny konfigurasjon: den eneste veien inn er meglerforbindelsen den allerede ringer ut på.

## Hvordan det henger sammen

Internt gjenbruker den Gateways faktiske spørremotor, ikke en gjenskaping: den samme workeren, den samme gjenoppkoblingen med backoff og den samme spørsløyfen som har kjørt i produksjon som en del av Gateway, kjører her uendret. Det som er annerledes er *hvor konfigurasjon og historikk går*.

Alt etter en spørring, driveren, tagg-bussen, Sparkplug-utgiveren og videresendingskøen på disk, er nøyaktig den samme koden Gateway bruker når `HOTLOOP_EDGE_PUBLISH_ENABLED` er satt. Se siden Edge publish for hva den utgiveren faktisk gjør: births, sekvensnumre, buffring gjennom et avbrudd, avspilling ved gjenoppkobling. Ingenting av det er endret her; denne binærfilen er bare en annen vei til det samme kallet `Offer()`.

## Enhetsfilen

```json
{
  "devices": [
    {
      "id": "press-01",
      "name": "Press 1",
      "protocol": "opcua",
      "address": "opc.tcp://press-01.local:4840",
      "enabled": true,
      "pollIntervalMs": 1000
    }
  ],
  "tags": [
    {
      "deviceId": "press-01",
      "name": "Zone1_Temp",
      "address": "ns=2;s=Zone1.Temp",
      "dataType": "float",
      "enabled": true
    }
  ]
}
```

En tagg tar alt Gateways tagger tar, `noData` inkludert: en liste med rå verdier som betyr «ingen måling» (en logers 0x8005), hver med en årsak, slik at en død kanal vises som dårlig på relayen og i Sparkplug-strømmen i stedet for som et tall. Se [Verdier uten data](/nb/iot/protocols/#no-data-values).

Alle Gateways sju protokolldrivere er kompilert inn: OPC UA, Modbus, MQTT/Sparkplug B, EtherNet/IP, S7comm, MTConnect og HTTP. Ingenting i formatet på enhetsfilen er spesifikt for edge relay.

### Discovery (4.18.10)

En relay kan lytte på en MQTT-megler etter enheter som melder seg selv, slik Gateway gjør (se [MQTT-oppdagelse](/nb/iot/mqtt-discovery/)), og lese og videresende det den hører. Navngi meglerne i enhetsfilen:

```json
{
  "devices": [],
  "tags": [],
  "discovery": [
    {
      "id": "yard",
      "broker": "10.0.0.5:1883",
      "username": "hotloop",
      "password": "...",
      "prefix": "homeassistant",
      "listenOnly": true,
      "tasmota": true,
      "shelly": true
    }
  ]
}
```

`id` er 1 til 63 små bokstaver, sifre og `-`, og er ikke `embedded`. `broker`, `username`, `password`, `useTls` og `insecureSkipVerify` er det Gateways innstillinger for MQTT tar, sjekket av den samme koden. `prefix` er som standard `homeassistant`, og `tasmota` og `shelly` er på. En fil som ikke navngir noen megler, endrer ingenting ved hvordan en relay kjører.

Det den hører, blir til enheter og tagger, laget av den samme koden som Gateway kjører (`homeassistant/`-formatet, Tasmotas eget, Shellys statuser), og de spørres og videresendes over Sparkplug som alle andre. En enhets id lages av meglerens id og hvem enheten sier den er, og er den samme hver gang (`disc-<identity>-<hash>`), slik at en relay som starter på nytt, gir metrikkene sine de samme navnene. En enhet dukker opp et par sekunder etter at den melder seg, en trukket enhet forsvinner fra nodens birth i en rebirth, og ingen av delene koster Sparkplug-økten eller videresendingskøen. En sendt fil som legger til eller fjerner en megler, tas også i bruk direkte.

**Ingenting den oppdager kan armeres.** Ikke fordi en sjekk sier det. Hver tagg oppdagelsen lager, er skrivebeskyttet, som på Gateway; hver enhet den lager, er ikke godkjent; det finnes ingen på en relay som kan godkjenne en; og en relay har ingen skrivevei i det hele tatt, så en kommando til et oppdaget punkt, eller til et hvilket som helst punkt, avvises før den kommer i nærheten av en enhet. Testen ber en relay med skriving tillatt om å slå på en oppdaget pumpe, og kontrollerer at pumpens kommandotopic holdt seg stille.

En enhet du kan kommandere, kommer til en relay den andre veien: du godkjenner den på en Gateway, armerer punktene du mener, og sender filen. Når en fil har en enhet relayen også hører (samme megler-id, eller samme adresse, og samme identitet), vinner filen og den oppdagede kopien lages ikke, slik at en enhet aldri videresendes to ganger.

`listenOnly` er på med mindre du slår det av, og da publiserer relayen ingenting til den megleren: verken birth-meldingen som får en utgiver til å melde seg på nytt, Shellys `status_update` eller Tasmotas strømforespørsel. En enhet som bare snakker når den endrer seg, vises som ukjent til den gjør det. Slår du det av, er det de eneste tingene den sender, til topicene DISCOVERY.md nevner.

En relay beholder ingenting av det den hørte. Konfigurasjonene fra `homeassistant/` og Tasmota er retained på megleren og kommer tilbake ved oppstart; en Shelly sier statusene sine når noe endrer seg, så en enhet som har vært stille siden relayen startet, er ikke der før den snakker. Det, og at det ikke finnes noen database å huske en godkjent enhet i, er forskjellen fra Gateway.

`/status` viser, under `discovery`, for hver megler: om den lytter og er tilkoblet, hvor mange meldinger den har mottatt, droppet og avvist, hvor mange problemer den har, og antall enheter og tagger oppdagelsen har laget. Den sier ikke hvor en megler står eller hvilket topic et problem kom på.

### Legitimasjon i enhetsfilen (4.15.0)

Relayens OPC UA-driver er Gateways, så en enhet kan ha et OPC UA-`username` og -`password` (og sikkerhetsvalgene i [Protokoller og drivere](/nb/iot/protocols/#opc-ua-security-and-credentials)) i `config`-blokken sin, og det kan en enhet med et hvilket som helst annet protokoll også (MQTT- og HTTP-passord, HTTP-headere, legitimasjon i en adresse). Disse står i klartekst i enhetsfilen, og relayen har ikke noe API å skjule dem bak (API-sladdingen som ble lagt til Gateway i 4.15.1 gjelder ikke den; se [Autentisering og brukere](/nb/iot/authentication/#hvor-legitimasjon-fortsatt-ligger-i-klartekst)), så det har betydning hvor filen ligger:

- **I Helm-charten, bruk `devicesSecret`.** Enheter satt i chartens verdier `devices` og `tags` rendres til et ConfigMap, som alle med lov til å lese ConfigMaps i namespacet kan lese, og de blir liggende i Helm-releasens post. For enheter med legitimasjon legger du hele enhetsfilen i en Secret under nøkkelen `devices.json` og navngir den i `devicesSecret`; Secreten monteres i stedet for ConfigMapet, som da ikke lages.
- **En sendt enhetsfil har dem også.** En fil sendt med `POST /api/fleet/{id}/config` publiseres, retained, til et MQTT-topic, så megleren må bruke TLS og begrense hvem som kan lese `hotloop/edge-relay-config/#`, ellers kan alle som kan abonnere på det, lese all legitimasjonen i det. Relayen skriver en sendt fil med modus `0600` på datavolumet sitt (`/data/pushed-devices.json` i charten og Quadlet-enheten), så den ligger også på PVC-en, ikke i en Secret.
- **En sikret OPC UA-enhet beholder et sertifikat og et tillitslager.** De ligger under `/data/opcua-client-pki` (`HOTLOOP_OPCUA_CLIENT_PKI_DIR`), på samme persistensvolum som videresendingskøen. Med chartens persistens av er det en emptyDir, så hver ny pod lager et nytt sertifikat og hver sikret server må stole på det på nytt (se «Persistence off» nedenfor); en anonym enhet på en usikret kanal bryr seg ikke. Å godkjenne en servers sertifikat er det samme grepet som på Gateway, `rejected/` til `trusted/`, gjort på relayens volum.

## Fjernkommandoer (4.7.0)

To Sparkplug NCMD-kommandoer, begge over den samme forbindelsen relayen allerede ringer ut på, uten innkommende forbindelse:

- **Restart** (`Node Control/Reboot`), siden 4.7.0: relayen publiserer sin egen ryddige NDEATH og avslutter, og stoler på at supervisoren (`Restart=always` i en Quadlet-enhet, eller standard `restartPolicy: Always` i en Deployment) starter den igjen.

- **Update** (`Node Control/Update`): en operatør som godkjenner image-oppdateringen en relay holder tilbake. Den gjør bare noe på en relay satt til å holde tilbake oppdateringer; se [Oppdatere en relay](#oppdatere-en-relay).

Ingenting på relayens egen side avgjør hvem som får sende disse; se siden om flåtestyring for flåtebehandleren på Gateway-siden som sender dem, og ACL-kravet på megleren, som er den egentlige autorisasjonsgrensen.

## Oppdatere en relay

En relay oppdateres ikke av Gateway. Det kan den ikke: Gateway har ingen vei inn på maskinen, og relayen kan ikke erstatte sin egen container, så «fjernoppdatering» betyr ulike ting for de to måtene å installere på, og denne siden sier hvilken, for et løfte plattformen ikke kan holde, er verre enn ingen.

**Regelen er den hver HotLoop-boks følger: følg `:stable`, aldri pin.** En relay pinnet til `4.17.0` er akkurat så gammel som dagen noen installerte den, og ingen husker å gå tilbake til fabrikkgulvet og løfte den. Imaget en relay følger er derfor `ghcr.io/hotloop-io/hotloop-edge-relay:stable`, og hver release flytter den taggen. Det som er forskjellig, er hvem som starter relayen på det.

### Quadlet (en Pi eller en liten industri-PC): den oppdaterer seg selv

Enheten i [`deploy/quadlet`](/nb/install/quadlet/) følger `:stable` og bærer etiketten Podmans automatiske oppdatering leter etter. Slå på timeren én gang per boks:

```sh
sudo systemctl enable --now podman-auto-update.timer
```

Når timeren utløses, henter Podman `:stable`, og hvis digesten har endret seg, starter den enheten på nytt på det nye imaget. Tre ting gjør det trygt å la stå, og alle tre er bevist ved å kjøre dem, ikke ved å lese om dem:

- **En relay som ikke kommer tilbake, settes tilbake.** Enheten har en healthcheck (`/edge-relay --healthcheck`, fordi imaget ikke har shell eller curl å kjøre en med) og sier til systemd at den ikke er oppe før den består. Hvis det nye imaget aldri gjør det, flytter Podman det forrige imaget tilbake under `:stable` og starter det. En release som ikke starter, koster noen minutter på én boks, ikke en relay som blir nede. På Podman 4.9 (Ubuntu 24.04) gjør ikke `Notify=healthy` alene dette: det leses som et vanlig `true`, relayen regnes som oppe i det containeren starter, og Podman rapporterer oppdateringen som vellykket mens relayen er død. Enheten setter derfor `--sdnotify=healthy` eksplisitt.
- **Gateway ser hver oppdatering.** En relay legger versjonen sin og digesten til imaget sitt i hver birth. Gateways flåteliste viser begge per relay og skriver en linje i systemloggen når en endres: hva det var, hva det er nå og begge digestene. Det er revisjonssporet, og det dekker en oppdatering uansett årsak, også en operatør på boksen.
- **En oppdatering lar dataene være i fred.** Videresendingskøen og en sendt enhetsfil ligger på datavolumet, som et nytt image ikke rører. Det som går tapt, er spørringen mens relayen starter på nytt, noen få sekunder på det meste.

Digesten en relay rapporterer, er det `podman image inspect --format '{{.Digest}}'` skriver ut på den boksen, som er det automatisk oppdatering følger. Podman kan kjenne ett image under mer enn én digest (den lister dem under `RepoDigests`) når et register lagrer et annet manifestformat enn det den jobber med, så sammenlign den på samme måte på hver relay, ikke mot headeren fra et register.

### Quadlet, holde tilbake oppdateringer til en operatør godkjenner (valgfritt)

Noen steder vil heller bestemme når: en relay på en linje som ikke kan blunke under et skift. Det er `edge-relay-hold.conf`, et systemd-drop-in, og det er aldri standard. Med det rapporterer relayen `"updateMode": "approve"`, timeren er av, og ingenting oppdateres før en admin sender `POST /api/fleet/{id}/update` fra Gateway. Relayen avslutter da med status 75, systemd starter den igjen på imaget den har, og en egen jobb venter til den er frisk og kjører `podman auto-update`: det nye imaget hvis det finnes ett, med samme rollback, og en relay som blunket for ingenting hvis ikke. Bevist med en ekte oppdatering holdt tilbake i 30 sekunder mens relayen kjørte urørt, så tatt ved godkjenning.

Vit hva det koster. Timeren må være av for hele maskinen, fordi Podmans automatiske oppdatering virker på hver merket container og ikke kan be om å hoppe over én; en boks som må kjøre den for andre ting, kan ikke holde tilbake denne relayen. Og Gateway kan ikke si at en oppdatering venter, bare hva hver relay kjører nå, så sammenlign flåtelisten med hva `:stable` er før du godkjenner. En godkjenning bærer ikke noe image: relayen kan bare bes om å oppdatere til det enheten selv følger.

### Helm: du kjører `helm upgrade`

En pod kan ikke erstatte seg selv, og en Deployment er Helms å endre, så det finnes ingen fjernoppdatering for charten. Chartens `image.tag` er som standard dens `appVersion`, som er releasen, så:

```sh
helm repo update
helm upgrade edge-relay hotloop/hotloop-edge-relay --reuse-values
```

ruller poden over på den nye releasen. Chartens strategi stopper den gamle poden før den nye starter (`maxSurge: 0`, fordi videresendingskøen er en fil med én skriver på ett volum), så det blir et gap mens den kommer opp. Gateway ser fortsatt den nye versjonen i relayens neste birth og logger endringen. Under Helm rapporterer ikke en relay noen image-digest (en container kan ikke se sin egen, og Kubernetes gir den ikke videre), bare versjonen. `Node Control/Update` gjør ingenting her, og relayen sier det i loggen sin; Helm er godkjenningen.

### Hva som ikke er her, og hvorfor

- **Signerte images og en digest-tillatelsesliste.** Gateway kan ikke håndheve noen av delene på en boks den ikke har vei inn på, og en sjekk relayen kjører på seg selv, er en en kompromittert relay hopper over. Podman kan verifisere signaturer ved pull (`policy.json`), som er stedet det virker; ingenting her setter opp den policyen for deg, og `:stable` stoles på slik enhver tagg gjør.
- **Trinnvis utrulling.** Hver relay på en boks følger den samme taggen på sin egen timer, så en flåte oppdateres over timerens spredning, ikke i bølger, og rollbacken ovenfor er det som begrenser en dårlig release. For å trinnvis med vilje, hold tilbake stedene som skal vente med hold-drop-in og godkjenn dem i den rekkefølgen du vil.

## Konfigurasjonssending (4.8.0)

En ny enhetsfil kan sendes på et eget, enkelt (ikke Sparkplug), retained MQTT-topic. Se avsnittet «Config push» på siden om flåtestyring for Gateway-siden. Frem til 4.17 la en sending bare filen klar, og relayen fortsatte å spørre den gamle listen til noe startet den på nytt. Det gjorde hver endring i det en relay spør om, til en omstart av relayen, meglerøkten og hver enhetsøkt den holdt, på en boks som skal stå i månedsvis uten å røres. Nå tas en sending i bruk i det den kommer.

- Sendt mens relayen **kjører**: bytene valideres med de samme reglene som `LoadDeviceFile` bruker ved oppstart, lagres i `HOTLOOP_EDGE_RELAY_PUSHED_FILE` (eller over `HOTLOOP_EDGE_RELAY_DEVICES_FILE` når den ikke er satt; se nedenfor) og tas i bruk direkte. Lagret først, med vilje: en liste som kjørte men aldri ble lagret, ville stille gått tilbake ved neste oppstart.
- **En dårlig sending avvises, og den gamle listen kjører videre.** En som ikke lar seg tolke, ikke valideres (en dobbel enhet, en tagg på en enhet ingen har deklarert, et ukjent protokoll) eller ikke kan lagres, endrer ingenting: verken de kjørende enhetene eller filen på disk. Loggen sier hvorfor, og det gjør `/status` også, under `config.rejected`, som er der Gateways flåtevisning henter det.
- Sendt mens relayen var **frakoblet**: ingenting er der til å motta den før neste oppstart, og da gir relayen en retained sending et par sekunder på å komme *før* den laster den lokale enhetsfilen sin, så den starter rett på den. En sending som kommer etter de to sekundene, tas i bruk direkte som alle andre.
- Megleren gir den retained sendingen tilbake ved hver gjenoppkobling. Relayen kjenner filen den kjører på sha256-en, så de samme bytene som kommer igjen, endrer ingenting.

### Hva en direkte bruk beholder, og hva den endrer

Relayen finner ut hva som er endret mellom filen den kjører og den nye, enhet for enhet, og rører bare det:

- **En enhet som ikke er endret, beholder økten sin.** Samme TCP-forbindelse til PLS-en, samme OPC UA-abonnement, ingen lakune i målingene.
- **En endret enhet** (adresse, protokoll, spørreintervall, tidsavbrudd, konfigurasjonsblokk eller tagger) kobles til på nytt med den nye definisjonen.
- **En ny enhet** kobles til og begynner å bli spurt.
- **En fjernet enhet** (eller en som nå har `"enabled": false`) kobles fra.
- **Sparkplug-økten holder seg oppe.** Ingen NDEATH, ingen gjenoppkobling, samme bdSeq, og videresendingskøen røres ikke. En omlasting under et megleravbrudd lar hver bufret måling bli i køen; de tømmes når megleren er tilbake, akkurat som uten omlasting.

På ledningen, etter Sparkplug B. Relayen er én edge-node og hver tagg er en nodemetrikk kalt `device/tag`, så det som endres er nodens metrikksett, og Sparkplug gir en node bare én måte å endre det på: en ny NBIRTH, som erstatter den siste helt. Derfor:

- **Metrikker som er borte** (en fjernet enhet, en fjernet eller deaktivert tagg) sendes én gang til i en NDATA som null, og så gjør noden en rebirth uten dem: samme økt, samme bdSeq, seq tilbake til 0, den samme rebirthen som `Node Control/Rebirth` gir. Null-en er der fordi en vert har lov til å beholde siste verdi av en metrikk en ny birth utelater, og Gateways egen Sparkplug-vert gjør nettopp det. Uten null ville en ventil du tok bort fra relayen, stått på sin siste gode måling for alltid og sett frisk ut.
- **Nye metrikker** kommer med i en birth ved første spørring av enheten, på samme måte som hver metrikk ved oppstart. En birth nevner aldri en metrikk før det er en måling bak.
- **Målinger av en fjernet tagg som fortsatt ligger i videresendingskøen**, droppes når køen tømmes, med en loggelinje som teller dem. Nodens birth har ikke lenger den metrikken, og Sparkplug har ingen lovlig måte å sende en den ikke har; å sende dem ville bety et alias ingen vert noen gang fikk vite om.

Å redigere den lokale enhetsfilen for hånd krever fortsatt en omstart: relayen leser den ved oppstart og når en sending fjernes, og følger ikke med på den. Under charten er det uansett det en `helm upgrade` som endrer `devices`, gjør.

### Hvor en sendt fil ligger, og hvilken fil som vinner

Begge de støttede installasjonene monterer den lokale enhetsfilen skrivebeskyttet: charten fra et ConfigMap (eller en Secret), Quadlet-enheten som en `:ro`-binding, og begge på et skrivebeskyttet rotfilsystem. Frem til 4.16.0 skrev relayen en sending rett ved siden av den filen, så på begge installasjonene døde hver eneste sending med

```
a pushed config was rejected; keeping the current one and continuing to run
error="write /etc/edge-relay/devices.json.tmp: open /etc/edge-relay/devices.json.tmp: read-only file system"
```

og relayen fortsatte å spørre den gamle listen. Gateway sa `config pushed`, omstarten gikk gjennom, og ingenting endret seg. Det er rettet ved å gi sendingen sitt eget hjem:

- **`HOTLOOP_EDGE_RELAY_PUSHED_FILE`** er der en sending skrives. Charten setter den til `/data/pushed-devices.json` på PVC-en (`pushedDevicesFile` i values.yaml), og Quadlet-enheten setter samme sti på sitt navngitte datavolum. Begge overlever containeren, og PVC-en overlever en omplanlegging. Det siste er bevisst: en emptyDir ville også vært skrivbar, men den er borte i det poden flytter, og en relay som stille går tilbake til den gamle enhetslisten etter en node-drain, er den samme feilen med ekstra steg.
- **Den sendte filen vinner.** Ved oppstart laster relayen den sendte filen hvis den finnes, og den lokale bare hvis ikke. Det gjelder etter en omstart, etter en omplanlegging, etter at megleren har mistet den retained sendingen (en Mosquitto-omstart uten persistens) og etter en `helm upgrade` som endrer `devices` eller `tags`. Sendingen er den nyere, bevisste endringen, og megleren ville gitt den retained kopien rett tilbake ved neste oppstart uansett, så å la den lokale filen vinne ville bare vart én omstart. De første linjene i loggen sier hvilken fil den startet fra: `booting from the pushed device file; the local one is ignored until the push is cleared`.
- **Å gå tilbake til den lokale filen** (chartens `devices`, eller `/etc/edge-relay/devices.json` under Quadlet) er `DELETE /api/fleet/{id}/config` på Gateway. Slettingen fjerner den retained sendingen på megleren, så ingen senere oppstart tar den i bruk, og en relay som er tilkoblet da, laster sin lokale fil, sletter den sendte filen, logger `the config push was cleared; the local device file takes over` og tar den lokale filen i bruk direkte, på samme måte som en sending tas i bruk. Hvis den lokale filen ikke lar seg laste, beholder relayen den sendte filen i drift og på disk og sier det i loggen og i `/status`: å slette den først ville latt en relay være igjen som ved neste omstart starter på en ødelagt fil. Rett den lokale filen og send slettingen på nytt. Gjør det mens relayen er **online**. En sletting er ikke retained, så en relay som var offline da, hører aldri om den og beholder den sendte filen; få den opp igjen og send slettingen på nytt. Den kan trygt gjentas.
- En sendt fil som finnes men ikke lar seg laste (en diskfeil, eller en senere release med strengere regler), logges som en feil, og relayen starter fra den lokale filen i stedet for å bli stående nede på grunn av det.
- Med `HOTLOOP_EDGE_RELAY_PUSHED_FILE` ikke satt overskriver en sending selve `HOTLOOP_EDGE_RELAY_DEVICES_FILE`, atferden fra 4.8.0. Det er bare til nytte for en naken binærfil med en skrivbar enhetsfil, og da finnes det ingen egen kopi en sletting kan droppe.

Hvis en sending «ikke tok», se i relayens logg før noe annet. Enten sier den hvilken fil den startet fra, eller så sier den hvorfor sendingen ble avvist.

## HTTP-flaten

To endepunkter, begge uten autentisering, begge skrivebeskyttet:

- `GET /healthz`: prosessen er oppe. Ikke noe mer; at en enhet er frakoblet, betyr ikke at denne prosessen er usunn.
- `GET /status`, et øyeblikksbilde: antall enheter per tilkoblingstilstand, antall tagger, videresendingskøens nåværende dybde, den innkompilerte protokolllisten og `uplink`: om megleren er tilkoblet, om en avspilling pågår, og hva videresendingskøen holder, veier på disk og har droppet ved grensen sin (se siden Edge publish, «When the uplink is down»). Ingen tagg-verdier, ingen enhetsadresser, ingen konfigurasjon: dette er en overvåkingsflate, ikke en mindre kopi av Gateways dashbord. `version`, `imageDigest` og `updateMode` sier hvilken build det er og om den holder tilbake oppdateringer. Den sier også, under `config`, hvilken enhetsfil som kjører: `source` (`local` eller `pushed`), `path`, dens sha256-`digest`, `appliedAt` og `rejected`, den siste filen relayen avviste og hvorfor, til en senere sending tas i bruk. Digesten, ikke filen: Gateway kan sammenligne den med det den sendte uten at filens adresser og legitimasjon går ut på en uautentisert port. Med en `discovery`-megler i filen sier den også, under `discovery`, hvordan hver av dem har det og hvor mange enheter den fant (se [Discovery](#discovery-41810)).

Bevisst ingen autentisering foran noen av dem: en edge relay har ingen brukerdatabase, ingen øktlagring og ikke noe identitetssystem å bygge en av, og å legge til ett felles token ville vært teater, ikke sikkerhet, for to endepunkter som ikke eksponerer noe sensitivt. Kjør den bak det nettverksperimeteret selve enheten sitter bak, den samme forventningen som Gateways egen `auth.insecure`-modus allerede dokumenterer for en driftsetting bak en betrodd proxy.

## Konfigurasjon

| Variabel | Standard | <span class="sr-only">Details</span> |
|---|---|---|
| `HOTLOOP_EDGE_RELAY_DEVICES_FILE` | n/a | Påkrevd. Sti til enhetsfilen beskrevet ovenfor |
| `HOTLOOP_EDGE_RELAY_PUSHED_FILE` | unset | Hvor en sendt enhetsfil oppbevares, og den vinner over den ovenfor så lenge den finnes. Må være skrivbar og persistent; charten og Quadlet-enheten bruker `/data/pushed-devices.json`. Se [Hvor en sendt fil ligger](#hvor-en-sendt-fil-ligger-og-hvilken-fil-som-vinner) |
| `HOTLOOP_EDGE_RELAY_LISTEN_ADDR` | `:8081` | Serveren for `/healthz` og `/status` |
| `HOTLOOP_EDGE_RELAY_UPDATE_MODE` | `auto` | `auto` overlater oppdatering til supervisoren og ignorerer en godkjenning fra Gateway; `approve` holder tilbake oppdateringer til en kommer. Se [Oppdatere en relay](#oppdatere-en-relay) |
| `HOTLOOP_IMAGE_DIGEST` | unset | Digesten til imaget denne relayen kjører fra, slik supervisoren kjenner den. Quadlet-enheten setter den før hver oppstart. Rapporteres i `/status` og i hver birth; tom er greit |
| `HOTLOOP_LOG_LEVEL` | `info` | |
| `HOTLOOP_POLL_INTERVAL` | `5s` | Standard spørreintervall; en enhets eget `pollIntervalMs` overstyrer det |
| `HOTLOOP_MIN_POLL_INTERVAL` | `100ms` | Gulv som gjelder hver enhet, uansett dens egen innstilling |
| `HOTLOOP_POLL_TIMEOUT` | `10s` | Standard tidsavbrudd per spørring; en enhets eget `timeoutMs` overstyrer det |
| `HOTLOOP_MAX_CONCURRENT_POLLS` | `32` | Enheter som kan være midt i en spørring samtidig |
| `HOTLOOP_RECONNECT_MIN` / `HOTLOOP_RECONNECT_MAX` | `1s` / `60s` | Backoff-grenser mellom gjenoppkoblingsforsøk, med jitter |
| `HOTLOOP_RING_SIZE` | `120` | Målinger per tagg som beholdes til diagnostikk i nærheten av `/status` |
| `HOTLOOP_OPCUA_CLIENT_PKI_DIR` | `/data/opcua-client-pki` | OPC UA-driverens sertifikat og lagrene `trusted/` og `rejected/`; en enhets eget `pkiDir` overstyrer det. Bare en sikret OPC UA-enhet rører det |

Samme variabelnavn og standardverdier som Gateways egen `RuntimeConfig`; se avsnittet «Polling» på siden om k3s og Helm for de samme innstillingene som Helm-verdier, for begge binærfilene laster denne konfigurasjonen gjennom den samme funksjonen `config.LoadRuntimeConfig()`, ikke to kopier som kunne glidd fra hverandre.

Pluss hver `HOTLOOP_EDGE_PUBLISH_*`-variabel siden Edge publish dokumenterer, med én forskjell: `HOTLOOP_EDGE_PUBLISH_ENABLED` ignoreres og videresendingen er alltid på; å publisere det den leser er hele hensikten med denne binærfilen, ikke et valg slik det er på Gateway.

## Hva som er verifisert og hva som ikke er det

HotLoop er kjørt mot ekte utstyr og ekte servere, og på ekte maskinvare 2026-11-17.

## Driftsetting

To støttede veier, begge containere, ingen løs `podman run` kjørt fra et shell som dør med økten, og ingen Docker:

- **`charts/hotloop-edge-relay`**, en k3s-Helm-chart, adskilt fra Gateways egen chart (`charts/hotloop`), fordi en edge relay er en virkelig annerledes artefakt som ofte kjører i en annen, mindre klynge enn Gateway den videresender til. Enheter og tagger deklareres i `values.yaml` og rendres til et ConfigMap; videresendingskøen ligger på en liten PVC (se «Persistence off» nedenfor før du slår den av).
- **`deploy/quadlet`**, en Podman Quadlet-enhet for en Pi eller en liten industri-PC som slett ikke er en del av en k3s-klynge. Quadlet gjør containeren til en ekte systemd-tjeneste: starter ved oppstart, starter på nytt ved feil, logger til journald; se README-en i den mappen for installasjonstrinn.

Begge bruker det samme imaget og de samme miljøvariablene dokumentert ovenfor.

Hver release publiserer begge, fra 4.16.0. Imaget er `ghcr.io/hotloop-io/hotloop-edge-relay`, merket med release-versjonen (pluss `major.minor`, `major`, `latest` og `stable`; Quadlet-enheten følger `stable`, se [Oppdatere en relay](#oppdatere-en-relay)). Det er amd64 og arm64, og 32-bits arm (arm/v7) fra første release etter 4.17.0, fordi en Pi 3 eller en 32-bits Pi OS-installasjon er nettopp boksen en relay ender på. Charten ligger i samme Helm-repo som Gateways:

```sh
helm repo add hotloop https://hotloop.io/hotloop/
helm install edge-relay hotloop/hotloop-edge-relay \
  --namespace hotloop --create-namespace \
  --set edgePublish.broker=tcp://gateway.example.local:1883 \
  --set edgePublish.group=Plant1
```

### Persistence off

`persistence.enabled=false` gir deg en relay som kjører uten PVC, og akkurat det. På 4.16.0 kjørte den ikke engang: ingenting var montert på `/data`, roten er skrivebeskyttet, og relayen døde ved oppstart med `open forward queue at /data/forward.db: no such file or directory`. Nå er `/data` en emptyDir, begrenset til `persistence.size`, og alt relayen skriver, havner der.

En emptyDir lever så lenge poden. En container-omstart i samme pod beholder den. En ny pod gjør ikke det, og du får en ny pod ved en node-drain, at en node dør, en eviction, en `kubectl delete pod` og enhver `helm upgrade` som ruller Deployment. Hver gang mister du:

- **Videresendingskøen.** Hver måling bufret mens megleren var nede, er borte, og ingenting på Gateway-siden vet at den mangler.
- **En sendt enhetsfil.** Relayen starter igjen fra chartens `devices` uten å klage, til Gateway sender på nytt eller megleren spiller av en retained sending. Det er akkurat den feilen PVC-en er der for å hindre, og å slå den av setter deg ut for den igjen.
- **OPC UA-klientsertifikatet og tillitslageret.** Hver sikret server må stole på det nye sertifikatet, og operatøren må godkjenne hver servers sertifikat på nytt.

Å fylle taket, noe en ubegrenset kø (`queueMaxBytes: 0`; standard er 64 MiB) vil gjøre i et langt nok avbrudd, får poden evicted og mister alle tre samtidig. Det er fortsatt bedre enn å fylle nodens disk under alt annet på den. Installasjonsnotatene skriver ut en advarsel når persistens er av. Det går fint for en prøve. For en relay hvis målinger betyr noe, gi den PVC-en.

### Fra EmberNet App Store

Butikken lister relayen som HotLoop Edge Relay, én per node. En butikk-utrulling gir charten tre ting: visningsnavnet (release-navnet), en nodevelger og tenant-etikettene. Den har intet skjema å spørre om noe annet, og relayen kan ikke kjøre uten en megler og en Sparkplug-gruppe. Derfor stopper en butikk-utrulling av relayen ved rendringen, med vilje, med en feil i loggen til helm-install-jobben som navngir det som mangler og skriver ut den nøyaktige kommandoen for å rette det.

Vi ga den ingen standardmegler, fordi det ikke finnes noen som stemmer for noens anlegg, og en relay pekt mot en oppdiktet adresse ville sett utrullet ut mens den videresender ingenting. Den kan heller ikke bare sitte og vente på en sendt enhetsfil: en sending kommer over meglerforbindelsen den ennå ikke har.

Løsningen er å legge de to verdiene inn i det butikken skrev, så prøver installasjonen på nytt av seg selv:

```sh
# a node on the local cluster: add them under spec.valuesContent
kubectl -n default edit helmchart hotloop-edge-relay-<node>

# a tenant on its own cluster (Fleet): add them under spec.helm.values
kubectl -n fleet-default edit helmop hotloop-edge-relay-<node>
```

```yaml
edgePublish:
  broker: tcp://<gateway-or-broker>:1883
  group: <sparkplug group id>
```

Når den er oppe, vises den i Kjørende apper under navnet butikken ga den, med HotLoop-ikonet, avgrenset til tenanten som rullet den ut, og uten STARTE-knapp. Det siste er bevisst: charten merker den `embernet.ai/gui-type: none`, fordi `/healthz` og `/status` er for en probe og en operatørs curl, ikke en side i en iframe.

Relayen og Gateway deler et versjonsnummer. En release starter ikke med mindre begge chartene har taggens versjon og relayens Quadlet-enhet følger `:stable`, så relayen får en ny versjon hver release enten dens egen kode er endret eller ikke. Det er med vilje: ett nummer å spørre om, og ingen relay-chart som peker på et relay-image ingen har pushet. Quadlet-enheten pleide å pinne release-nummeret, det motsatte av hvordan en boks som oppdaterer seg selv, fungerer.
