---
title: "Alarmvarsler"
description: "ntfy, Gotify, Discord, webhooks og e-post. Trykk Kvitter på telefonen, så er alarmen kvittert, signert og kan bare brukes én gang."
---

Alarmvarsler, siden 4.10.0, ringer en telefon når en alarm utløses klokken 03:00. Når en alarm **utløses**, sender HotLoop et varsel gjennom hver konfigurert, aktivert kanal hvis prioritetsgrense alarmen når. På i Helm-chartet siden 4.23.6 (`HOTLOOP_NOTIFY_ENABLED`), og sender ingenting før en kanal er slått på med målet sitt: en utrulling uten noen å varsle har ingenting å konfigurere her.

## Hvorfor bare "utløst"

`alarm.Engine.OnTransition` utløses ved hver ISA-18.2-overgang: utløst, gått til normal, kvittert, utsatt, gjenopptatt. Denne pakken lytter til alle, men handler bare på én. Å varsle ved hver overgang ville fått telefonen til en operatør til å vibrere når han kvitterer sin egen alarm, når den går til normal av seg selv eller når noen utsetter den for et skift, og lært ham å streke bort varsler uten å lese dem, slik en alarm som flakker lærer oss å ignorere alarmer. Utløst er den eneste hendelsen som betyr "noe trenger et menneske som kanskje ikke ser på en skjerm akkurat nå", og det er hele grunnen til at denne pakken finnes.

Det eneste andre varselet er en eskalering: Alarmen ble utløst, ingen har kvittert, og policyen sier at neste person skal varsles. Det er den samme alarmen som fortsatt trenger noen, sagt på nytt til en annen, ikke en ny hendelse. Se "Eskalering".

Ett tilfelle ser ut som en gjenopptakelse, men er egentlig en utløsning. Hvis tilstanden oppstår mens en alarm er utsatt, har ingen blitt varslet. Når utsettelsen tar slutt (tiden gikk ut eller den ble gjenopptatt for hånd), registrerer motoren gjenopptakelsen og deretter en utløsning, og utløsningen varsler. En alarm som allerede var i alarm da den ble utsatt og fortsatt er det, kommer tilbake ukvittert, men varsler ikke igjen: Den varslet første gang.

## Kanalene

Seks, og det er hele listen (se "Varsler" i [veikartet for HotLoop](/nb/roadmap/) for det vi ikke gjør og hvorfor). Ingen krever noen leverandør-SDK eller betalt konto, i tråd med planen for dette prosjektet: Skyintegrasjoner er valgfrie utgående forbindelser en operatør setter opp, aldri noe denne appen trenger for å kjøre.

- **ntfy**: et push-varsel til en telefon, med en **Kvitter**-knapp som kvitterer alarmen rett tilbake i HotLoop. Gratis, og du kan kjøre serveren på anleggsnettverket uten internett i det hele tatt. Se "Sette opp ntfy".
- **Gotify**: et push-varsel til en telefon. Gratis, selvhostet, fungerer uten internett. Ingen knapper og ingen iPhone-app, så det er en personsøker, ikke toveis. Se "Sette opp Gotify".
- **Discord-webhook**: en innbygging i en Discord-kanal, farget etter prioritet, med tag, verdi, grense, område og linje. Lim inn en URL, så fungerer det. Kritiske alarmer kan pinge en rolle. Ingen knapper. Se "Discord".
- **Discord-bot**: den samme meldingen, med knappene **Kvitter** og **Utsett** som virker på alarmen og registrerer hvem som trykket. Trykkene kommer tilbake over en forbindelse HotLoop åpner til Discord, så anlegget trenger ingen offentlig adresse. Se "Discord".

- **Webhook**: en POST med HotLoops egen JSON-kropp (`alarmId`, `name`, `priority`, `priorityLabel`, `message`, `deviceId`, `tagName`, `raisedAt`, `event`, som er `raised`, eller `escalated` for en eskalering) til en konfigurert URL. Den fungerer med alt som tar imot den JSON-en du sender: ditt eget skript bak en liten HTTP-lytter, Node-RED, n8n eller en "hvilken som helst webhook"-trigger i et arbeidsflytverktøy. (Rettet mot et ntfy-emne varsler den, med rå JSON som tekst; bruk ntfy-kanalen over i stedet.) En oppsummering (se "Hastighetsgrenser og oppsummeringer") har `event` satt til `summary` og en `alarms`-liste som navngir hver alarm i den. Den fungerer ikke med tjenester som vil ha kroppen i sin egen form. Discord svarer 400 fordi det mangler `content` eller `embeds`. Slack, Teams og Google Chat vil ha sitt eget tekstfelt. Pushover vil ha feltene `token`, `user` og `message`, og PagerDutys Events API vil ha en `routing_key`, en `event_action` og en `payload`. Rett webhooken mot en av disse, så mislykkes hvert varsel. Discord har egne kanaler som bygger kroppen Discord venter; bruk dem.
- **E-post over SMTP**: sendt gjennom det relaiet operatøren allerede har (en e-postserver i bedriften, SMTP-endepunktet til en leverandør av transaksjonsbaserte e-poster, et selvhostet relé). Ingen API-nøkkel, ingen leverandørbibliotek: `net/smtp` og en håndbygd ren tekstmelding. Mange telefoner viser allerede e-post som push-varsel av seg selv, og mange vaktverktøy godtar en e-post-til-SMS-adresse som "kontaktmetode", så denne ene kanalen dekker en betydelig del av "varsle en telefon" uten noen betalt avhengighet.

## Hvor alarmer går: Innstillinger

Hver kanal er på som standard og hviler til den har et sted å sende. En aktivert kanal uten mål hindrer aldri HotLoop i å starte, den venter og sier det. En administrator gir hver sitt mål under Innstillinger, "Hvor alarmer og målinger går": webhook-URL-en, e-postreléet og mottakerne, ntfy-serveren og emnet, Gotify-serveren og tokenet, Discord-webhook-URL-en, tokenet og kanalen til Discord-boten, og brokeren og Sparkplug-gruppen til edge-publisereren. Hver viser hva den gjør (sender, venter på et mål, av) og hva den mangler.

- Alarmkanalene gjelder i det øyeblikket innstillingen lagres: dispatcheren bygges om på stedet, det de gamle kanalene holdt tilbake går ut først, og Discord-botens tilkobling lukkes før en ny åpnes. **Send en test** (`POST /api/notify/test`) når da kanalen som nettopp ble lagret.
- Edge-publisereren eier en køfil og en Sparkplug-node, så målet leses når HotLoop starter. Skjermen sier "Saved, applies when HotLoop restarts".
- Det som er lagret der gjelder foran chartet eller miljøet, som bare gir startverdier. En verdi som lades stå tom beholder det som er lagret; Fjern fjerner den. En hemmelighet (en webhook-URL, et ntfy-emne, et token, et passord) vises aldri igjen, bare om den er satt, og forsegles i databasen når HotLoop har en hemmelig nøkkel.
- Et mål sjekkes slik miljøet sjekkes ved oppstart, før noe lagres, og et feil mål avvises med hva som er galt (aldri verdien).
- En bryter per kanal slår den av for godt: av betyr ingen kanal, ingen sending.
- `GET /api/destinations` og `PUT /api/destinations/{kind}` er rutene; PUT krever `settings.write`. Se [HTTP-API-et](/nb/iot/api/).

## Webhook-URL-en blir aldri skrevet ut

For mange mottakere er URL-en passordet. Discord legger tokenet i stien (`/api/webhooks/{id}/{token}`), ntfy tar det som `?auth=`, Google Chat som `?key=` og `?token=`. Alle som har URL-en kan poste i kanalen din. Derfor, når en sending mislykkes, navngir feilen skjemaet og verten og ingenting annet:

```
webhook request to https://discord.com failed: context deadline exceeded
webhook https://ntfy.example.com returned 401 Unauthorized
```

Det er den samme teksten i loggen, i revisjonshendelsen og i svaret fra `POST /api/notify/test`. Verten er nok til å se hvilken mottaker som feilet; stien og spørringen forlater aldri prosessen. En URL som ikke består valideringen ved oppstart, gjentas heller ikke i den feilen. Trenger du å se URL-en, se på `HOTLOOP_NOTIFY_WEBHOOK_URL` der du satte den.

## Sette opp ntfy

[ntfy](https://ntfy.sh) er en publiser/abonner-push-server. HotLoop publiserer hver alarm til et emne; ntfy-appen på telefonen abonnerer på det.

1. Kjør en server, eller bruk ntfy.sh. På et anleggsnettverk kjører du din egen (`binwiederhier/ntfy`, én container) og låser den ned: Sett `auth-default-access: deny-all`, opprett en bruker for HotLoop som kan skrive til emnet, og én per person som kan lese det. På ntfy.sh, eller en hvilken som helst server alle kan nå, **er emnenavnet passordet**: Alle som gjetter det, leser alarmene dine. Gjør det langt og tilfeldig.
2. Gi HotLoop et tilgangstoken (`ntfy token add hotloop`) eller et brukernavn og passord for den brukeren.
3. Sett `HOTLOOP_PUBLIC_URL` til adressen en telefon når HotLoop på, for eksempel `https://hotloop.plant.example`. Uten den kommer varselet likevel frem, men uten Kvitter-knapp og uten trykk for å åpne, fordi telefonen ikke ville hatt noe sted å sende noen av dem.
4. Konfigurer det og start på nytt:

```
HOTLOOP_NOTIFY_ENABLED=true
HOTLOOP_NOTIFY_NTFY_ENABLED=true
HOTLOOP_NOTIFY_NTFY_URL=https://ntfy.plant.example
HOTLOOP_NOTIFY_NTFY_TOPIC=boiler-house-alarms
HOTLOOP_NOTIFY_NTFY_TOKEN=tk_...
HOTLOOP_PUBLIC_URL=https://hotloop.plant.example
```

5. `POST /api/notify/test` sender et testvarsel. Det har ingen Kvitter-knapp, fordi det ikke finnes noen alarm bak det å kvittere.

URL-en er bare serveren. Emnet har sin egen innstilling, aldri i URL-en: Slik vet HotLoop hvilken del som er hemmeligheten og holder den utenfor hver feil, loggline og revisjonshendelse.

Det som kommer frem:

| <span class="sr-only">Detaljer</span> | <span class="sr-only">Detaljer</span> |
|---|---|
| Tittel | Navnet på alarmen |
| Innhold | Alarmens melding, prioriteten, hvor den kom fra (`device/tag`) og når den ble utløst |
| Prioritet | Kritisk 5 (maks: på Android kan den bryte gjennom Ikke forstyrr, hvis du tillater det), Høy 4, Middels 3, Lav 2 |
| Merker | En emoji etter alvorlighet og prioriteten som et ord, så listen på telefonen kan skannes |
| Trykk | Åpner alarmlisten i HotLoop, når `HOTLOOP_PUBLIC_URL` er satt |
| Knapp | **Kvitter**, når `HOTLOOP_PUBLIC_URL` er satt. Se "Kvitteringslenker" |

### Forbeholdet for iPhone

Android fungerer helt uten internett: ntfy-appen holder sin egen forbindelse til serveren din og får hver melding umiddelbart over Wi-Fi på anlegget.

iPhone gjør ikke det. Apple slipper bare push gjennom sine egne servere (APNs), og bare ntfy.sh kan snakke med APNs. En selvhostet server må konfigureres med `upstream-base-url: https://ntfy.sh`, og da videresender den en henteforespørsel (uten meldingsinnhold, bare "noe kom inn på dette emnet") til ntfy.sh, som vekker telefonen, som deretter henter meldingen fra serveren din. Så på et anlegg uten internett får ikke iPhone umiddelbare varsler fra en selvhostet ntfy. De ser dem når appen åpnes. Hvis folkene dine bruker iPhone og anlegget er avskåret fra internett, er ikke ntfy personsøkeren din; e-post gjennom et relé er det, eller Discord hvis anlegget kan nå det. Gotify har ingen iPhone-app i det hele tatt.

Kvitter-knappen er en forespørsel fra telefonen til `HOTLOOP_PUBLIC_URL`, så telefonen må kunne nå den adressen: på Wi-Fi på anlegget, eller gjennom det VPN-et du bruker. Den fungerer likt på begge plattformer.

## Sette opp Gotify

[Gotify](https://gotify.net) er en liten selvhostet push-server med en Android-app. Ingen internett nødvendig, ingen konto noe sted.

1. Kjør `gotify/server` og logg inn i nettgrensesnittet.
2. Under **Apps**, opprett et program som heter HotLoop. Kopier tokenet.
3. Konfigurer det og start på nytt:

```
HOTLOOP_NOTIFY_ENABLED=true
HOTLOOP_NOTIFY_GOTIFY_ENABLED=true
HOTLOOP_NOTIFY_GOTIFY_URL=https://gotify.plant.example
HOTLOOP_NOTIFY_GOTIFY_TOKEN=A...
HOTLOOP_PUBLIC_URL=https://hotloop.plant.example
```

Tokenet går i `X-Gotify-Key`-headeren, aldri som `?token=` i URL-en, der det ville havnet i tilgangsloggen til hver proxy.

Prioritetene tilsvarer det Android-appen gjør med dem: Kritisk 10 og Høy 8 er høy viktighet (lyd og et varsel som dukker opp), Middels 5 er et vanlig varsel med lyd, Lav 2 er stille. Meldingen er Markdown (alarmens navn i fet, detaljene som liste, alarmens egen tekst escapet slik at et navn med en stjerne leses som det navnet), og et trykk åpner alarmlisten i HotLoop når `HOTLOOP_PUBLIC_URL` er satt.

**Ingen kvittering.** Gotify-varsler har ingen handlingsknapper, så det er ingen måte å legge en Kvitter-knapp på et, og vi later ikke som med en lenke som kvitterer på en vanlig GET: Lenkeforhåndsvisere og sikkerhetsskannere åpner lenker av seg selv, og en alarm må aldri kvitteres av en robot. Kvitter i HotLoop. **Ingen iPhone-app** heller.

## Discord

To veier inn. Webhooken er en personsøker: lim inn en URL, få alarmer i en kanal. Boten er toveis: de samme meldingene med knappene **Kvitter** og **Utsett**, og revisjonssporet sier hvilken person som trykket. Begge trenger at anlegget når Discord over internett (utgående HTTPS til `discord.com`, og for boten en WebSocket til `*.discord.gg`). Ingen av dem trenger at Discord når anlegget.

### Det som kommer frem

| <span class="sr-only">Detaljer</span> | <span class="sr-only">Detaljer</span> |
|---|---|
| Tekst | `[Critical] Boiler Trip`, som er det push-varselet på en telefon viser. På en kritisk alarm, et ping til den konfigurerte rollen foran |
| Tittel på innbyggingen | Den samme, med en lenke til alarmlisten i HotLoop når `HOTLOOP_PUBLIC_URL` er satt |
| Farge | Kritisk rød, høy oransje, middels gul, lav blå |
| Beskrivelse | Alarmens melding |
| Felt | Tag (`device/tag`), Verdi (avlesningen som utløste den), Grense (`hi 90`, fra definisjonen), Område / Linje (fra enheten), Utløst (i hver lesers egen tidssone) |
| Bunntekst | `HotLoop | <HOTLOOP_PLANT_NAME>`, slik at en server med flere anlegg kan skille dem (bare `HotLoop` når anleggsnavnet ikke er satt) |
| Knapper (bare bot) | Kvitter, Utsett 1 t, Åpne i HotLoop |

En flom blir en oppsummering, som på alle andre kanaler: De fem første går ut, så én melding som lister resten, med så mange navn som får plass og et tall for de andre, slik at tallet aldri kuttes.

Discord avviser en melding som er for lang (2000 tegn tekst, 256 tittel, 4096 beskrivelse, 25 felt, 6000 til sammen), og en avvist melding er et varsel som ikke gikk ut. Derfor kutter HotLoop til den passer, ved en tegngrense, med `...` der det ble kuttet.

### Ingen blir pinget ved en feil

Hver melding går ut med `allowed_mentions: {"parse": []}`. Uten den pinger Discord alt teksten nevner, så en alarm som noen kalte "@everyone tank overflow" ville vekket hele serveren. Med den pinger ingenting i teksten noen. Det eneste unntaket er rollen du konfigurerer for Kritisk (`..._CRITICAL_ROLE`), som er navngitt eksplisitt som den eneste tillatte omtalen, og bare på en kritisk alarm eller en oppsummering med en kritisk alarm i. Et testvarsel pinger aldri. Alarmens egen tekst escapes også som Markdown, så et navn med `*` leses som det navnet, og en `<@&role>` i et navn vises, ikke brukes.

For at pinget skal virke, må rollen kunne nevnes: Slå på **Tillat alle å nevne denne rollen** i rolleinnstillingene på serveren, eller gi boten tillatelsen **Nevn @everyone, @here og alle roller**.

### Discords hastighetsgrenser og utestengelser

Discord svarer "for fort" med en 429 og sier hvor lenge du skal vente, i kroppen (`retry_after`, på millisekundet) og i `X-RateLimit-Reset-After`. Så lenge venter HotLoop før nytt forsøk, innenfor de vanlige tre forsøkene og 30 sekundene (se "Nye forsøk"). Når Discord sier at budsjettet er brukt opp før det avviser (`X-RateLimit-Remaining: 0`), venter neste sending på tilbakestillingen i stedet for å trekke en 429.

Discord utestenger adressen til alt som samler 10 000 avviste forespørsler (401, 403, 429) på ti minutter, og utestengelsen tar med seg alle Discord-integrasjoner på den adressen. Derfor, når Discord svarer **401, 403 eller 404** (en feil eller slettet webhook, et dårlig bot-token, en kanal boten ikke ser), **slår HotLoop av den kanalen** etter den ene forespørselen. Den logger det én gang, hver alarm etter det avvises uten forespørsel (og revideres som ikke sendt, så "ble noen varslet" fortsatt har et svar), og det vises i `GET /api/diagnostics` under `notify.channels`, med årsaken og når:

```json
{"channel": "discord-webhook", "broken": true,
 "reason": "discord webhook https://discord.com returned 404 Not Found: Unknown Webhook (Discord error 10015)",
 "since": "2026-09-27T03:00:01Z"}
```

Rett innstillingen og start HotLoop på nytt. En 500 eller ingen svar i det hele tatt slår ingenting av; de prøves på nytt som på alle andre kanaler.

### Sette opp webhooken

1. Åpne kanalens innstillinger i Discord (tannhjulet), **Integrasjoner**, **Webhooker**, **Ny webhook**. Gi den navnet HotLoop. **Kopier webhook-URL**.
2. Valgfritt: en rolle som pinges på Kritisk. Slå på **Utviklermodus** (Brukerinnstillinger, Avansert), høyreklikk deretter på rollen i Serverinnstillinger, Roller, og **Kopier rolle-ID**. Det er et tall, ikke et navn.
3. Konfigurer det og start på nytt:

```
HOTLOOP_NOTIFY_ENABLED=true
HOTLOOP_NOTIFY_DISCORD_WEBHOOK_ENABLED=true
HOTLOOP_NOTIFY_DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/1234.../AbCd...
HOTLOOP_NOTIFY_DISCORD_WEBHOOK_CRITICAL_ROLE=123456789012345678
HOTLOOP_PUBLIC_URL=https://hotloop.plant.example
```

4. `POST /api/notify/test` sender en testmelding.

**Hele URL-en er passordet.** Alle som har den kan poste i kanalen din som webhooken. HotLoop skriver den aldri ut: ikke i loggen, ikke i en feil, ikke i en revisjonshendelse, ikke i et API-svar, og en URL som ikke består valideringen ved oppstart, gjentas heller ikke i den feilen. I Helm-chartet går den i en Secret. Hvis den lekker, slett webhooken i Discord og lag en ny.

En webhook kan ikke bære en knapp som gjør noe, så det finnes ingen Kvitter her. Tittelen lenker til alarmlisten i HotLoop. For knapper, bruk boten.

### Sette opp boten

1. Gå til [Discords utviklerportal](https://discord.com/developers/applications), **New Application**, kall den HotLoop. **Application ID** på siden General Information er det invitasjonslenken trenger.
2. Fanen **Bot**: **Reset Token** og kopier det. Discord viser det bare én gang. Det er `HOTLOOP_NOTIFY_DISCORD_BOT_TOKEN`. På samme side slår du av **Public Bot**, så ingen andre enn du kan legge den til på en server, og lar alle tre **Privileged Gateway Intents** stå av. HotLoop ber Discord om ingen hendelser i det hele tatt (intents 0); knappetrykk kommer uansett.
3. Inviter den til serveren din med det minste den trenger, View Channels, Send Messages og Embed Links (tillatelser `19456`), og ingen annen scope enn `bot`:

```
https://discord.com/oauth2/authorize?client_id=<APPLICATION ID>&scope=bot&permissions=19456
```

   Legg til **Mention @everyone, @here, and All Roles** (`permissions=150528`) bare hvis Kritisk-rollen ikke kan nevnes og du helst ikke vil gjøre den det. Å redigere sin egen melding etter et trykk krever ingen tillatelse; det går gjennom selve trykket.
4. Kanalen: Med Utviklermodus på, høyreklikk på den, **Kopier kanal-ID**. Hvis kanalen er privat, legg til rollen til boten.
5. Rollene som kan trykke på knappene. Lag en rolle (si "Alarm ack"), gi den til de som kan kvittere fra Discord, og kopier id-en. Utsett tar en alarm av listen i én time, så den har en egen innstilling; den kan være den samme rollen eller en snevrere.
6. Konfigurer det og start på nytt:

```
HOTLOOP_NOTIFY_ENABLED=true
HOTLOOP_NOTIFY_DISCORD_BOT_ENABLED=true
HOTLOOP_NOTIFY_DISCORD_BOT_TOKEN=MTIz...
HOTLOOP_NOTIFY_DISCORD_BOT_CHANNEL=223456789012345678
HOTLOOP_NOTIFY_DISCORD_BOT_ACK_ROLES=323456789012345678
HOTLOOP_NOTIFY_DISCORD_BOT_SHELVE_ROLES=423456789012345678
HOTLOOP_NOTIFY_DISCORD_BOT_CRITICAL_ROLE=323456789012345678
HOTLOOP_PUBLIC_URL=https://hotloop.plant.example
```

7. Loggen sier `connected to the Discord Gateway; Discord buttons work`, og `GET /api/diagnostics` viser `"gateway": {"connected": true}` under `discord`-kanalen. `POST /api/notify/test` poster en testmelding (uten knapper, det finnes ingen alarm bak den).

**Før du setter rollene, kan ingen trykke på noe.** Med `HOTLOOP_NOTIFY_DISCORD_BOT_ACK_ROLES` eller `_SHELVE_ROLES` tomme, avvises hvert trykk på den knappen, personen som trykker får vite hvilken innstilling som er tom, og HotLoop sier det ved oppstart:

```
WARN NOBODY can acknowledge alarms from Discord, because HOTLOOP_NOTIFY_DISCORD_BOT_ACK_ROLES is empty...
```

Det er med vilje. En knapp som hvem som helst på serveren kan trykke på, er ikke en standard å levere: Servere samler folk.

**Hvem som trykket.** En kvittering fra Discord registreres under `discord:<username>#<user id>` (id-en, fordi et Discord-brukernavn kan endres og id-en ikke), med notatet "acknowledged from Discord by alice (1010...)". For å registrere den under HotLoop-brukeren i stedet, tilordne dem: `HOTLOOP_NOTIFY_DISCORD_BOT_USERS=101010101010101010=alice,202020202020202020=bob`. Tilordningen navngir bare aktøren. Den sjekker ikke HotLoop-brukerens tillatelser: Discord-rollen avgjør hvem som kan trykke.

**Utsett** utsetter i `HOTLOOP_NOTIFY_DISCORD_BOT_SHELVE`, en time som standard, høyst 24 timer som enhver utsettelse. Det er en fast tid, ikke en meny: Klokken 03:00 slår én knapp som gjør én kjent ting en nedtrekksliste. Den avviser en alarm som er tilbake til normal (å utsette den ville skjult det som utløser den neste gang) og en som allerede er utsatt.

Etter et trykk sier meldingen hvem som gjorde hva og når, og begge knappene blir grå, så neste person som ser i kanalen ser at det er håndtert. Et avvist trykk besvares bare overfor personen som trykket, med årsaken, og registreres i systemloggen.

### Hvordan et trykk godkjennes

Samme maskineri som ntfys Kvitter-lenke (se "Kvitteringslenker"), pluss Discords eget ord om hvem som trykket:

- **Knappen er signert.** Hver knapp bærer et token signert med den samme hemmeligheten som kvitteringslenkene, for den handlingen (kvittere eller utsette, signert inn, så den ene ikke kan spilles av på nytt som den andre), på den alarmen, utløst i det øyeblikket. Discord tillater en knapp 100 tegn data og en alarm-id kan være 64, så dette er en kompakt form av samme påstand: 8 byte utløsningstid, 4 utløpstid og en 96-bits HMAC. Å forfalske ett betyr å gjette 96 bit, ett Discord-trykk per gjetning, fra innsiden av serveren og med riktig rolle.
- **Personen har en rolle du har navngitt.** Discord forteller boten rollene til den som trykker sammen med trykket, over botens egen autentiserte forbindelse. Alle som kan dele ut roller på serveren din kan dele ut denne, så behandle de rollene som tillatelsen de er.
- **Forekomsten er fortsatt gjeldende.** Motoren sjekker, under sin egen lås, at alarmens nåværende utløsning er den på knappen. Gårsdagens melding kan ikke kvittere dagens utløsning.
- **Én gang.** Den første handlingen på en forekomst fra et hvilket som helst varsel (ntfy eller Discord) registreres, og hver senere avvises. To som trykker samtidig: Én vinner, den andre får beskjed.
- **Utløper.** Etter `HOTLOOP_NOTIFY_ACK_TTL` (12 timer) slutter knappene å virke; handle i HotLoop i stedet.

Bot-tokenet er en legitimasjon for hele boten. Det logges aldri, står aldri i en feil, aldri i et API-svar; i Helm-chartet går det i en Secret. Det samme gjelder interaksjonstokenet til hvert trykk, som Discord gir boten i femten minutter til å svare. Hvis bot-tokenet lekker, tilbakestill det i utviklerportalen.

### Gateway-forbindelsen

Trykkene kommer over Discord Gateway, en WebSocket HotLoop åpner til Discord og holder åpen. Klienten er HotLoops egen, på [gorilla/websocket](https://github.com/gorilla/websocket) (v1.5.3, festet; den lå allerede i avhengighetsgrafen til denne modulen, den er liten og den mest brukte WebSocket-biblioteket i Go). Vi tok ikke et Discord-bibliotek som discordgo: Det er en hel Discord-SDK (REST, tale, en tilstandsbuffer) for den ene hendelsen vi trenger, og dette prosjektet bærer ikke leverandør-SDK-er. Klienten:

- identifiserer seg med intents 0, så Discord sender den ingenting annet enn trykk;
- sender heartbeat med det intervallet Discord oppgir, svarer umiddelbart på en heartbeat-forespørsel og behandler en heartbeat som ikke bekreftes som en død forbindelse;
- gjenopptar økten etter et brudd, en Reconnect (op 7) eller en gjenopptakbar Invalid Session (op 9), så et trykk gjort mens den koblet til på nytt spilles av, ikke går tapt; en økt som ikke kan gjenopptas venter ett til fem sekunder og starter en ny;
- identifiserer seg høyst én gang hvert femte sekund, og ikke i det hele tatt når Discord sier at dagens øktstarter er brukt opp, før de nullstilles;
- kobler til på nytt med en ventetid som dobles fra ett sekund til ett minutt;
- stopper for godt på et avvist token eller avviste intents, slår av kanalen og viser det i `/api/diagnostics`, i stedet for å koble til på nytt i det uendelige.

Discord gir boten tre sekunder til å svare på et trykk, så det første HotLoop gjør er å svare "mottatt" (en utsatt oppdatering), og så gjøre jobben. Det svaret er også det som hindrer to HotLoop-replikaer i å handle på ett trykk: Begge mottar det, Discord tar det første svaret og avviser det andre, og replikaen som ble avvist stopper. Kjørt som MCP-hjelper (`--mcp-stdio`) åpner HotLoop ingen Gateway-forbindelse i det hele tatt; den ekte håndterer trykkene.

## Hastighetsgrenser og oppsummeringer

Et spenningsfall eller en PLS-omstart utløser førti alarmer på et sekund. Én sending per alarm får IP-en til en Discord-webhook utestengt, utløser ntfys grense per IP og begraver den ene alarmen som betyr noe under trettini som ikke gjør det, på telefonen som får dem. Derfor har hver kanal et budsjett, en token-bøtte: en salve som kan gå ut på én gang, så én til for hver påfylling.

| Kanal | Standard salve | Deretter én hvert |
|---|---|---|
| ntfy | 10 | 5 s (under ntfy.sh egen grense på 60, så én hvert 5. s, per IP) |
| Gotify | 10 | 5 s |
| Webhook | 10 | 5 s |
| SMTP | 5 | 12 s |
| Discord-webhook | 5 | 2 s (Discord tillater en webhook omtrent 5 forespørsler hvert 2. s, og en kanal 30 meldinger i minuttet) |
| Discord-bot | 5 | 2 s |

Endre dem per kanal med `HOTLOOP_NOTIFY_<CHANNEL>_BURST` og `HOTLOOP_NOTIFY_<CHANNEL>_REFILL` (`WEBHOOK`, `SMTP`, `NTFY`, `GOTIFY`, `DISCORD_WEBHOOK`, `DISCORD_BOT`).

Det budsjettet tillater, går ut av seg selv, med en gang. Det det ikke tillater, holdes tilbake, og når neste sending er forfalt, går alt som er holdt tilbake ut som **én** oppsummering:

```
7 more alarms raised in the last 12 s:
- [High] Line 3 Stopped
- [Critical] Boiler Trip
...
```

Ingen alarm går tapt: Oppsummeringen navngir hver eneste, opptil 25, og teller resten ("...and 13 more"). Den er like alvorlig som den verste alarmen i den, og revisjonshendelsen lister hver alarm-id den sto for. Den har ingen Kvitter-knapp, fordi det ikke finnes én enkelt alarm den kan kvittere. Hvis bare én alarm ble holdt tilbake, går den ut som seg selv, knapp og alt. Når alarmer først holdes tilbake, blir nye med i gruppen selv om budsjettet er tilbake, så en oppsummering aldri kommer etter en alarm som ble utløst senere enn alt i den. Ved nedstenging går alt som fortsatt holdes tilbake ut med en gang, over budsjett: Valget da er mellom én sending for mye og alarmer ingen noen gang får vite om.

Budsjettet er per kanal, så en flom som får SMTP-relaiet til å køe, holder ikke igjen ntfy, og hver kanals grense gjelder fortsatt: En Lav-alarm ender aldri i oppsummeringen til en kanal satt til Høy og over.

## Nye forsøk

En sending som får en 429, en 5xx eller ingen svar i det hele tatt (avvist, tilbakestilt, tidsavbrudd) prøves på nytt, opptil tre forsøk til sammen, alle innen 30 sekunder etter det første. Når mottakeren sier hvor lenge man skal vente (`Retry-After`, i sekunder eller som dato), venter vi så lenge; ellers ett sekund, så to. En mottaker som ber om lenger enn de 30 sekundene som er igjen, ventes det ikke på: Feilen rapporteres nå, med den beskjeden. Etter 30 sekunder er det bedre å rapportere et varsel som ikke gikk ut som mislykket, i loggen og revisjonssporet, enn å prøve det stille på nytt i minutter mens alarmen bare står der.

Alle andre 4xx (et feil token, et emne brukeren ikke kan skrive til, en misdannet forespørsel) prøves aldri på nytt. Det blir det samme svaret hver gang til noen retter opp konfigurasjonen, og Discord utestenger en IP som fortsetter å sende forespørsler det allerede har avvist.

`POST /api/notify/test` gjør nøyaktig ett forsøk per kanal. En test spør hva kanalen gjør akkurat nå, og et nytt forsøk ville fått en ustabil mottaker til å se frisk ut.

## Kvitteringslenker

Kvitter-knappen på et ntfy-varsel er en forespørsel til `POST /api/notify/ack/{token}` på `HOTLOOP_PUBLIC_URL`. Personen som trykker på den klokken 03:00 er ikke logget inn noe sted, så **tokenet er hele autorisasjonen**. Det fungerer bare hvis tokenet er umulig å forfalske, snevert, engangs og kortvarig, og hver av disse håndheves:

- **Umulig å forfalske.** Tokenet er en påstand (hvilken alarm, når den ble utløst, hvilken kanal, når lenken utløper) pluss en HMAC-SHA256 av den med en serverhemmelighet. Endre én byte, eller signer med en annen nøkkel, og den avvises. Hemmeligheten er `HOTLOOP_NOTIFY_ACK_SECRET` hvis du setter den (minst 32 tegn; `openssl rand -hex 32`). Hvis ikke, genererer HotLoop 32 tilfeldige byte første gang den trenger dem og lagrer dem i databasen sin (tabellen `settings`, nøkkel `notify.ackSecret`), så lenkene fortsetter å virke etter en omstart og alle replikaer er enige. Den vises aldri på innstillingsskjermen eller i noe API-svar. Den ligger i databasesikkerhetskopier, som alt annet i databasen; hvis det er et problem for deg, sett variabelen fra en Kubernetes-Secret (`notify.ackSecret.existingSecret` i chartet), så berører den aldri databasen. Å endre hemmeligheten gjør alle allerede sendte lenker ugyldige, som også er måten å trekke dem alle tilbake på én gang.
- **Snever.** Påstanden navngir én alarm **og øyeblikket den ble utløst**. En knapp fra gårsdagens utløsning av samme alarm kan ikke kvittere dagens, som ingen har sett ennå: Motoren sjekker, under samme lås som kvitteringen, at alarmens nåværende utløsning er den i påstanden (`alarm.Engine.AckOccurrence`). Lenken kan kvittere og ingenting annet. Den kan ikke utsette, nullstille, skrive en tag eller lese noe, så det verste en lekket lenke kan gjøre er nøyaktig det et trykk på knappen ville gjort.
- **Engangs.** Den første bruken av en lenke for en forekomst registreres i databasen (`notify_ack_links`), og hver senere bruk avvises, selv når alarmen må kvitteres igjen uten ny utløsning (utsatt mens den fortsatt var i alarm og gjenopptatt, kommer den tilbake ukvittert). Alarmens egen tilstand er ikke nok til dette; registreringen er det.
- **Kortvarig.** Den utløper, som standard 12 timer etter at den ble sendt (`HOTLOOP_NOTIFY_ACK_TTL`, høyst 168 t). Lenge nok til "jeg ser på det når jeg kommer inn", kort nok til at et skjermbilde av et varsel ikke er en varig legitimasjon.

Et vellykket trykk er en vanlig ISA-18.2-kvittering gjennom alarmmotoren, revidert nøyaktig som en fra alarmskjermen: en alarmhendelse og en systemloggoppføring med aktøren `notify:ntfy` og notatet "acknowledged from the ntfy notification". ntfys HTTP-handlinger sier ikke hvilken telefon som trykket på knappen, så det er ikke noe personnavn å legge til. Når flere deler et emne, sier revisjonssporet at telefonen gjorde det, ikke hvem. Discord-boten kjenner brukeren og setter det inn (se "Discord").

Hvert avslag besvares med hva som gikk galt og registreres i systemloggen under `notify:<channel>` (eller `notify:ack-link` for et token som er for ødelagt til å si hvilken kanal som sendte det), fordi en knapp som stille ikke gjør noe, ikke kan skilles fra en ingen trykket på:

| Svar | Hvorfor |
|---|---|
| 403 | Forfalsket, endret eller signert med en annen hemmelighet |
| 410 | Ekte, men utløpt |
| 409 | Allerede brukt, eller alarmen ble utløst på nytt siden, eller det er ingenting igjen å kvittere |
| 404 | Alarmen finnes ikke lenger, eller kvitteringslenker er av |

Selve tokenet logges aldri, settes aldri i en revisjonshendelse og returneres aldri av noe API: Så lenge det er gyldig er det en legitimasjon. Det står i ntfy-meldingen, nødvendigvis, så alle som kan lese ntfy-emnet ditt kan trykke på knappen. Lås ned emnet.

Endepunktet svarer med `Access-Control-Allow-Origin: *` så knappen også virker fra ntfy-nettappen, som trykker på den fra sin egen opprinnelse. Det gir ingenting bort: Ingenting på denne ruten leser en informasjonskapsel eller en økt.

## Eskalering

Ingen kvitterte alarmen på N minutter, så neste person får den. Det første varselet går ut nøyaktig som det alltid har gjort, til hver kanal der alarmen når grensen. Eskalering er det som skjer etter det, hvis alarmen fortsatt står der ukvittert. Et varsel som gikk til en telefon ingen holdt i hånden er feilen dette finnes for: Klokken 03:00 sover vaktpersonen, og alarmen skal ikke vente på dem.

Du setter den opp under **Innstillinger, Alarmeskalering**, eller over API-et (`GET` og `PUT /api/notify/escalation`). Den er bare for administratorer, fordi den inneholder folks ntfy-emner og avgjør hvem som vekkes. I motsetning til kanalene, som leses fra miljøet når HotLoop starter, er policyen data du redigerer, og den trer i kraft når du lagrer. Kanalene den kan bruke er de anlegget allerede har konfigurert. Ingenting nytt legges til i listen på fire, pluss webhook og e-post.

### Policyen

| Felt | <span class="sr-only">Detaljer</span> |
|---|---|
| `enabled` | Av til du slår den på. En avslått policy eskalerer ingenting |
| `minPriority` | Den minst alvorlige alarmen som eskalerer: `critical`, `high`, `medium` eller `low`. Standard `high`. En Middels-alarm som har stått i en time er en arbeidsordre, ikke en telefon klokken 03:00 |
| `contacts` | Menneskene. Hver har et `name`, og et `ntfyTopic`, `emails`, eller begge. Opptil 50 |
| `steps` | Opptil 10. Hvert har `afterMinutes` (1 til 1440) og hvem som skal varsles: `contacts` etter navn, `channels` etter navn, eller begge |
| `repeatEveryMinutes`, `repeatTimes` | Etter siste trinn, send det igjen så ofte, så mange ganger til (høyst 20). Begge null for ingen gjentakelse |

En **person** får et eget varsel. Deres `ntfyTopic` er et emne på ntfy-serveren denne HotLoop allerede publiserer til, med samme innlogging, så telefonen deres abonnerer på et emne som bare er deres. Deres `emails` går gjennom SMTP-relaiet HotLoop allerede har. En person med et emne trenger ntfy konfigurert, og en med en adresse trenger e-post konfigurert, og policyen avvises med den beskjeden hvis de ikke er det. På en server alle kan nå er et emne et passord: Gjør det langt og tilfeldig. API-et viser emner til administratorer og ingen andre, og de står aldri i loggboken, systemloggen eller en feil.

En **kanal** i et trinn er en av anleggets egne (`ntfy`, `gotify`, `smtp`, `webhook`, `discord-webhook`, `discord`) og når den som er på den: den delte Discord-kanalen, en Gotify-app et mannskap deler, en webhook inn i noe som varsler. Policyen avvises hvis et trinn navngir en denne HotLoop ikke har konfigurert, og svaret lister de den har.

### Når ting går ut

Et trinn forfaller `afterMinutes` etter det forrige, og det første trinnet `afterMinutes` etter at alarmen ble utløst. Det er en sum fra utløsningen, ikke fra da forrige sending var ferdig, så et tregt relé eller en omstart strekker ikke tidsplanen du skrev. Med trinn på 5 og 10 og en gjentakelse på 15 minutter, to ganger:

```
 0 min  alarm raised: the first page, as always
 5 min  step 1
15 min  step 2
30 min  step 2 again (repeat 1)
45 min  step 2 again (repeat 2), and that is the last
```

### Hva som stopper den

Kjeden gjelder én forekomst av én alarm, og den stopper, med en rad som sier hvorfor, når noe av dette skjer:

- **Noen kvitterer den.** Fra hvor som helst: alarmskjermen, Kvitter-knappen i ntfy eller Discord, API-et, en automatisering. Alle ender i alarmmotoren, og før hvert trinn går ut spør eskalatoren motoren om denne forekomsten fortsatt er ukvittert. En krok som kommer sent kan ikke få den til å varsle for en alarm noen allerede har svart på.
- **Den går til normal.** Alarmen står fortsatt på alarmlisten og trenger noen som kvitterer, men ingen vekkes for noe som ordnet seg selv. Det er et valg vi tok med vilje; endre grensen eller trinnene hvis du vil ha et annet.
- **Den utsettes.**
- **Den utløses igjen.** Det er en ny forekomst med sin egen kjede, regnet fra sin egen utløsning. Gårsdagens kjede varsler aldri for dagens alarm.

En alarm noen svarer på før trinn 1 forfaller, etterlater ingen spor i eskaleringssporet i det hele tatt, som er systemet som virker.

### Det som kommer frem

En eskalering er alarmens eget varsel med tittelen endret og en linje lagt til:

```
NOT ACKNOWLEDGED 15 min: Boiler Trip
Nobody has acknowledged this alarm in 15 minutes (step 2 of 4). boiler/Pressure hi 90 (now 95)
```

Den beholder alarmens prioritet, så en Kritisk er fortsatt maks prioritet på Android. Den bærer den samme signerte Kvitter-knappen som det første varselet i ntfy og Discord (se "Kvitteringslenker"), så personen den vekker kan kvittere der de ble varslet. Gotify og e-post har ingen knapp. En webhook får HotLoops vanlige JSON med `event` satt til `escalated`.

En delt kanal får sin takt som alle andre (se "Hastighetsgrenser og oppsummeringer"), så et spenningsfall som lar førti alarmer stå ukvittert eskalerer som én oppsummering, "40 alarms nobody has acknowledged", ikke førti varsler og en utestengelse. En persons eget varsel er en sending for seg.

### Revisjonssporet

Hver eskalering er en rad i alarmens eget spor, som er det [loggboken](/nb/iot/logbook/) leser, så den dukker opp der uten ekstra oppsett, ført under alarmen med aktøren `escalation`:

```
alarm Boiler Trip escalated: boiler/Pressure hi 90 (now 95) (note: step 1 of 2: nobody acknowledged it in 5 min; notified Ana (email), Ana (ntfy))
alarm Boiler Trip escalation-ended: boiler/Pressure hi 90 (now 95) (note: escalation stopped after 1 sent: acknowledged by notify:ntfy)
```

`GET /api/alarms/events` og loggbokens `alarm`-art bærer de samme radene som typene `escalated` og `escalation-ended`. Et trinn som ikke nådde noen, sier det med store bokstaver (`NOBODY WAS REACHED`) med hver feil etter, og kjeden går videre til neste trinn uansett: Ett dødt relé skal ikke stoppe varselet som går ut en annen vei. Lagring av policyen står i systemloggen uten emnene.

### Omstarter, og hvor den kjører

Kjedene lever i minnet, så en omstart klokken 03:00 midt i en kan ikke få lov til å miste den. Når HotLoop starter, ser den på hver alarm som fortsatt er ukvittert, leser hvor mange trinn revisjonsradene sier gikk ut for den forekomsten, og fortsetter derfra: Den sender ikke trinn 1 igjen og hopper ikke over trinn 2. Et trinn som forfalt mens HotLoop var nede, går ut i løpet av de første sekundene etter at den er tilbake. Et trinn som var underveis da prosessen ble drept, kan gå ut to ganger, som er riktig vei å ta feil for en alarm.

En lagret policy gjelder alarmer utløst etter at du lagrer den. En omstart plukker opp hver alarm som fortsatt er ukvittert, uansett når den ble utløst.

Gatewayen kjører den. En `--mcp-stdio`-hjelper gjør det ikke, så én alarm eskaleres aldri av to prosesser.

## TLS på SMTP-kanalen

Kanalen oppgraderer til TLS via STARTTLS automatisk så snart relaiet annonserer utvidelsen, uansett innstillingene under. Dette er ikke valgfri oppførsel du må slå på: Gos egen `net/smtp.PlainAuth` nekter å sende brukernavn og passord over en forbindelse som ikke allerede er TLS (eller til en server som bokstavelig talt heter `localhost`), og i praksis alle ekte leverandører som krever autentisering, Gmail, SendGrid, Mailgun, en nettleverandørs relé, krever STARTTLS på port 587 eller implisitt TLS på 465 (se under) for å komme dit. Et relé uten konfigurert autentisering, nåbart på et isolert nettverk, tilbyr kanskje ikke STARTTLS i det hele tatt, og denne kanalen krever det ikke i det tilfellet.

`HOTLOOP_NOTIFY_SMTP_TLS` slår ikke oppgraderingen på, den gjør *fraværet* av den til en hard feil: Hvis den er satt og relaiet ikke annonserer STARTTLS, nekter `Send` før den i det hele tatt prøver `AUTH`, i stedet for stille å autentisere i klartekst mot et relé som bare tilfeldigvis kan nås som `localhost`. `HOTLOOP_NOTIFY_SMTP_TLS_SKIP_VERIFY` hopper over sertifikatkontrollen ved oppgraderingen, den samme nødutgangen `HOTLOOP_EDGE_PUBLISH_TLS_SKIP_VERIFY` og `HOTLOOP_FLEET_TLS_SKIP_VERIFY` allerede gir for sine egne MQTT-forbindelser, for et relé som presenterer et selvsignert sertifikat.

### Implisitt TLS, port 465

Et relé på port 465 forventer at hele forbindelsen er TLS fra første byte (RFC 8314), ikke en klarteksthilsen og en oppgradering. HotLoop gjorde tidligere bare oppgraderingen, så på 465 var det første den sa klartekst til et relé som ventet på et TLS-håndtrykk, og sendingen døde. Nå er **port 465 implisitt TLS** og alle andre porter STARTTLS som før, uten noen innstilling å røre:

```
HOTLOOP_NOTIFY_SMTP_PORT=465
```

Hvis et relé gjør implisitt TLS på en egen port, eller snakker STARTTLS på 465, sier `HOTLOOP_NOTIFY_SMTP_IMPLICIT_TLS` hvilket, `true` eller `false`, og går foran porten. I Helm-chartet setter du den under `extraEnv`. Alt annet er likt på begge: Brukernavn og passord går over den krypterte forbindelsen, `HOTLOOP_NOTIFY_SMTP_TLS` er oppfylt av den (det er ingenting å kreve), og `HOTLOOP_NOTIFY_SMTP_TLS_SKIP_VERIFY` hopper over sertifikatkontrollen i dens håndtrykk. Reléets sertifikat kontrolleres med mindre du slår det av. Planlagte rapporter bruker de samme relé-innstillingene og dermed den samme regelen.

Hvis håndtrykket mislykkes, sier feilen det og navngir `HOTLOOP_NOTIFY_SMTP_IMPLICIT_TLS=false`, som er det et relé som starter i klartekst trenger.

Bevist mot et ekte SMTP-serverbibliotek med en ren TLS-lytter, og mot Mailpit kjørt med `--smtp-require-tls`, den festede laboratorieversjonen v1.31.2. Ikke verifisert mot 465-endepunktet til en kommersiell leverandør.

## Én SMTP-vei, delt med planlagte rapporter

Siden 4.14.0 sender alarmkanalen gjennom `notify.SendMessage`, en generell funksjon som sender én melding, med valgfrie vedlegg, til en liste med mottakere. Planlagte rapporter (se [Planlagte rapporter](/nb/gateway/reports/)) sender CSV- og HTML-filene sine gjennom den samme funksjonen og de samme relé-innstillingene (`HOTLOOP_NOTIFY_SMTP_HOST`, `_PORT`, `_USERNAME`, `_PASSWORD`, `_FROM`, `_TLS`, `_TLS_SKIP_VERIFY`), så det er ett sted som ringer opp, oppgraderer med STARTTLS, autentiserer og avgjør hva en header kan inneholde. Bare reléet deles: `HOTLOOP_NOTIFY_ENABLED`, `HOTLOOP_NOTIFY_SMTP_ENABLED` og `HOTLOOP_NOTIFY_SMTP_TO` gjelder alarmer, og et relé konfigurert for rapporter slår ikke på alarmkanalen.

To oppførsler i alarm-e-posten er endret, begge i retning av sikkerhet. Avsenderen og hver mottaker valideres nå som vanlige adresser før noe ringes opp, der en misdannet tidligere feilet ved reléet. Og et emne med ikke-ASCII-tegn sendes som et RFC 2047-kodet ord i stedet for rå UTF-8. Et alarmnavn som inneholder et kontrolltegn flates ut til mellomrom i stedet for å bli avvist, fordi et varsel må gå ut uansett hva en alarm heter.

## Prioritetsgrenser

Hver kanal har sin egen `MinPriority`, den minst alvorlige alarmprioriteten den fortsatt utløses for. `model.AlarmPriority` går fra 1 (Kritisk, mest alvorlig) til 4 (Lav), så "Høy og over" er `MinPriority = 2`: En alarm når en kanals grense når dens eget prioritetstall er mindre enn eller lik grensen. En webhook konfigurert bare for Kritisk og et SMTP-relé konfigurert for Middels og over kan se på den samme alarmmotoren og utløses på helt ulike sett med alarmer; ingenting krever at de er enige.

## Hva det ikke er

**Ikke en live-omlasting av kanalene.** Kanalene leses én gang, fra konfigurasjonen, ved prosessoppstart, på samme måte som `EdgePublishConfig` og `FleetConfig`. Å endre `HOTLOOP_NOTIFY_*` krever en omstart for å tre i kraft, og det finnes ikke noe API for å legge til eller fjerne en kanal under kjøring i denne MVP-en. Eskaleringspolicyen er unntaket: Hvem som varsles neste gang, og når, er data du redigerer, og det trer i kraft når du lagrer (se "Eskalering").

**Ikke en egen tabell.** Hvert varselforsøk, vellykket eller ikke, skrives gjennom `runtime.Manager.Event`, den samme generiske revisjonshendelsesmekanismen hver alarm- og flåtehandling allerede logger gjennom. Det var ikke behov for å finne på en egen `notifications`-tabell for en funksjon av denne størrelsen; systemloggen svarer allerede på "ble et varsel sendt, og virket det".

**Ikke en varig kø.** Nye forsøk er begrenset (tre forsøk, 30 sekunder, se "Nye forsøk"), og tilbakeholdte alarmer lever i minnet til oppsummeringen deres går ut. Et varsel som fortsatt mislykkes logges og revideres, og utsenderen går videre. En alarm som forblir utløst fordi ingen kvitterte den, er fortsatt synlig på alarmskjermen og i `alarm_events` uansett om et varsel noen gang kom frem: Varselet er en bekvemmelighet oppå alarmsystemet, ikke en erstatning for det.

## Konfigurasjon

| Variabel | Standard | <span class="sr-only">Detaljer</span> |
|---|---|---|
| `HOTLOOP_NOTIFY_ENABLED` | `false` | Funksjonen er av til dette er satt |
| `HOTLOOP_NOTIFY_WEBHOOK_ENABLED` | `false` | |
| `HOTLOOP_NOTIFY_WEBHOOK_URL` | n/a | Påkrevd når webhook-kanalen er aktivert. Må være `http://` eller `https://` |
| `HOTLOOP_NOTIFY_WEBHOOK_MIN_PRIORITY` | `high` | `critical`, `high`, `medium`, `low`, eller `1`-`4` |
| `HOTLOOP_NOTIFY_SMTP_ENABLED` | `false` | |
| `HOTLOOP_NOTIFY_SMTP_HOST` | n/a | Påkrevd når SMTP-kanalen er aktivert |
| `HOTLOOP_NOTIFY_SMTP_PORT` | `25` | |
| `HOTLOOP_NOTIFY_SMTP_USERNAME` / `_PASSWORD` | n/a | Valgfritt. Utelat begge for et anonymt relé |
| `HOTLOOP_NOTIFY_SMTP_FROM` | n/a | Påkrevd når SMTP-kanalen er aktivert |
| `HOTLOOP_NOTIFY_SMTP_TO` | n/a | Påkrevd når SMTP-kanalen er aktivert. Adresser adskilt med komma |
| `HOTLOOP_NOTIFY_SMTP_TLS` | `false` | Krev at reléet tilbyr STARTTLS; se "TLS på SMTP-kanalen" over, STARTTLS brukes automatisk når det tilbys, uansett denne innstillingen |
| `HOTLOOP_NOTIFY_SMTP_TLS_SKIP_VERIFY` | `false` | Hopp over sertifikatkontrollen ved STARTTLS-oppgraderingen, eller i håndtrykket for implisitt TLS. Valg per anlegg; sett aldri denne som standard |
| `HOTLOOP_NOTIFY_SMTP_IMPLICIT_TLS` | `true` på port 465, ellers `false` | TLS fra første byte i stedet for STARTTLS; se "Implisitt TLS, port 465". Sett den for å overstyre porten |
| `HOTLOOP_NOTIFY_SMTP_MIN_PRIORITY` | `high` | De samme verdiene som for webhooken |
| `HOTLOOP_NOTIFY_NTFY_ENABLED` | `false` | |
| `HOTLOOP_NOTIFY_NTFY_URL` | none | Påkrevd. Bare serveren, `https://ntfy.example.com`, uten sti |
| `HOTLOOP_NOTIFY_NTFY_TOPIC` | none | Påkrevd. 1 til 64 bokstaver, sifre, `-` og `_`. På en offentlig server er det passordet |
| `HOTLOOP_NOTIFY_NTFY_TOKEN` | none | Et ntfy-tilgangstoken (`tk_...`), sendt som et bearer-token |
| `HOTLOOP_NOTIFY_NTFY_USERNAME` / `_PASSWORD` | none | Grunnleggende autentisering i stedet for et token. Ikke begge |
| `HOTLOOP_NOTIFY_NTFY_ACK` | `true` | Legg en Kvitter-knapp på hver alarm (trenger `HOTLOOP_PUBLIC_URL`) |
| `HOTLOOP_NOTIFY_NTFY_MIN_PRIORITY` | `high` | De samme verdiene som for webhooken |
| `HOTLOOP_NOTIFY_GOTIFY_ENABLED` | `false` | |
| `HOTLOOP_NOTIFY_GOTIFY_URL` | none | Påkrevd. `https://gotify.example.com` |
| `HOTLOOP_NOTIFY_GOTIFY_TOKEN` | none | Påkrevd. Program-tokenet Gotify ga deg for HotLoop |
| `HOTLOOP_NOTIFY_GOTIFY_MIN_PRIORITY` | `high` | De samme verdiene som for webhooken |
| `HOTLOOP_NOTIFY_DISCORD_WEBHOOK_ENABLED` | `false` | |
| `HOTLOOP_NOTIFY_DISCORD_WEBHOOK_URL` | none | Påkrevd. URL-en Kopier webhook-URL i Discord gir. Hele den er passordet |
| `HOTLOOP_NOTIFY_DISCORD_WEBHOOK_CRITICAL_ROLE` | none | En rolle-id som pinges på kritiske alarmer |
| `HOTLOOP_NOTIFY_DISCORD_WEBHOOK_MIN_PRIORITY` | `high` | De samme verdiene som for webhooken |
| `HOTLOOP_NOTIFY_DISCORD_BOT_ENABLED` | `false` | |
| `HOTLOOP_NOTIFY_DISCORD_BOT_TOKEN` | none | Påkrevd. Botens token, alene, uten `Bot ` foran |
| `HOTLOOP_NOTIFY_DISCORD_BOT_CHANNEL` | none | Påkrevd. Kanal-id-en det skal postes i |
| `HOTLOOP_NOTIFY_DISCORD_BOT_ACK_ROLES` | none | Rolle-id-er adskilt med komma hvis medlemmer kan trykke Kvitter. **Tom betyr ingen** |
| `HOTLOOP_NOTIFY_DISCORD_BOT_SHELVE_ROLES` | none | Det samme for Utsett. **Tom betyr ingen** |
| `HOTLOOP_NOTIFY_DISCORD_BOT_USERS` | none | `discordUserId=hotloopUser`, adskilt med komma: hvis handlinger registreres under deres HotLoop-navn |
| `HOTLOOP_NOTIFY_DISCORD_BOT_SHELVE` | `1h` | Hvor lenge Utsett utsetter. Høyst `24h` |
| `HOTLOOP_NOTIFY_DISCORD_BOT_CRITICAL_ROLE` | none | En rolle-id som pinges på kritiske alarmer |
| `HOTLOOP_NOTIFY_DISCORD_BOT_MIN_PRIORITY` | `high` | De samme verdiene som for webhooken |
| `HOTLOOP_NOTIFY_DISCORD_API_URL` | `https://discord.com/api/v10` | Bare for å sende botens forespørsler gjennom en proxy |
| `HOTLOOP_NOTIFY_<CHANNEL>_BURST` / `_REFILL` | per kanal | Hastighetsgrensen; se "Hastighetsgrenser og oppsummeringer". `<CHANNEL>` er `WEBHOOK`, `SMTP`, `NTFY`, `GOTIFY`, `DISCORD_WEBHOOK` eller `DISCORD_BOT` |
| `HOTLOOP_PUBLIC_URL` | none | Adressen en telefon når HotLoop på, grunnsti inkludert. Trengs for trykk for å åpne og Kvitter-knappen |
| `HOTLOOP_NOTIFY_ACK_SECRET` | generert | Signerer kvitteringslenker. Minst 32 tegn. Ikke satt: generert én gang og lagret i databasen |
| `HOTLOOP_NOTIFY_ACK_TTL` | `12h` | Hvor lenge en kvitteringslenke virker. Høyst `168h` |

I Helm-chartet ligger de under `notify.ntfy`, `notify.gotify`, `notify.discordWebhook`, `notify.discordBot`, `notify.ackSecret`, `notify.ackTtl` og `publicUrl` på toppnivå. Tokens, passord og Discord-webhook-URL-en går i en Secret chartet styrer, eller oppgi din egen med `existingSecret`.

## API

| Rute | Tillatelse | <span class="sr-only">Detaljer</span> |
|---|---|---|
| `POST /api/notify/test` | `notify.test` | Sender et syntetisk testvarsel gjennom hver konfigurerte kanal akkurat nå |
| `POST /api/notify/ack/{token}` | ingen; tokenet er autorisasjonen | Kvitterer alarmforekomsten tokenet ble utstedt for. Se "Kvitteringslenker" |
| `GET /api/notify/escalation` | `notify.escalation` | Eskaleringspolicyen, kanalene et trinn kan navngi og kjedene som er åpne akkurat nå. Se "Eskalering" |
| `PUT /api/notify/escalation` | `notify.escalation` | Erstatter hele policyen. Avvises med årsaken hvis et trinn ikke navngir noen eller en kanal som ikke er konfigurert |
| `GET /api/diagnostics` | `status.read` | Under `notify.channels`, hver kanals stilling: om Discord har avvist den (og hvorfor, og siden når), og Discord-botens Gateway-forbindelse |

`notify.escalation` er bare for administratorer på samme måte. Å lese policyen krever den også, fordi den inneholder folks ntfy-emner.

`notify.test` er bare for administratorer, gitt av jokertegnet administratorrollen allerede har og bevisst ikke lagt til i operatørrollens tillatelsesliste: Å sende en ekte ekstern melding og bruke opp den kvoten en varselleverandør eller et SMTP-relé tillater, er nærmere `fleet.restart` og `fleet.config` (også bare for administratorer, også "gjør noe mot omverdenen akkurat nå") enn en lesing, den samme innsnevringen denne appen allerede bruker på de to.

Svaret rapporterer hver kanals eget utfall i stedet for én enkelt suksess eller feil for forespørselen:

```json
{
  "results": [
    {"channel": "webhook", "success": true},
    {"channel": "smtp", "success": false, "error": "dial smtp server mail.example.com:587: i/o timeout"}
  ]
}
```

## Hva som er og ikke er verifisert

HotLoop er kjørt mot ekte utstyr og ekte servere, og på bare metal 2026-11-17.
