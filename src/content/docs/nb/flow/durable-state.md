---
title: "Varig tilstand, målt"
description: "Kontekst som overlever en omstart og varige koblinger som bare rører disken når målet slutter å svare, med tallene bak begge."
---

En historian som går ned i en time bør ikke koste deg en times målinger, så lenge avbruddet får plass i diskkvoten (256 MiB som standard: omtrent en time ved 100 målinger i sekundet med en måling på 120 byte, målt på 2.13.1), og en teller i en flyt bør ikke begynne på nytt fordi poden flyttet. Begge deler er én SQLite-fil på volumet, og denne siden forklarer hva som legges i den, hva den garanterer, hva den ikke garanterer og hva den koster et flashkort.

Én fil, `state.db`, i datakatalogen. Vedvarende kontekst og køene bak varige koblinger deler den, fordi to lagre ville vært to ting å dimensjonere, ta sikkerhetskopi av og holde i takt.

## Kontekst som overlever en omstart

Flyt-, global og nodekontekst lastes fra filen første gang et omfang brukes og lever i minnet etter det, så lesing rører aldri disken, og `CompareAndSwap`, `Increment` og `Update` er den samme koden som før, atomisk under samme lås. En omstart gir deg telleren tilbake, og den fortsetter derfra, og en `CompareAndSwap` mot en verdi som kom tilbake fra disk virker fortsatt, også for heltallet en function-node lagret.

Det du gir fra deg er med vilje: skriving går etter. En endret verdi venter `store.context.flushInterval` (30 sekunder), og alt som endret seg i det vinduet går til filen i én transaksjon. Ti tusen økninger av én teller i et vindu er én rad skrevet. En verdi satt til det den allerede var er ingen skriving i det hele tatt, og det er flyten som lagrer den samme temperaturen hvert sekund og SD-kortet som ellers ville hatet deg for det. Et rent stopp skriver alt først. Et `kill -9` eller et strømbrudd mister opptil intervallet. Sett det til `0s`, og hver endring skrives før kallet returnerer, og kortet betaler for det.

Bare det som overlever JSON, overlever en omstart: tall, strenger, boolske verdier, tidspunkter, bytebuffere, lister og objekter. Legger du en funksjon eller en socket i konteksten, feiler `set` og nevner nøkkelen, i stedet for å lagre halvparten. Konteksten til en node forsvinner når noden slettes og en flyts når fanen slettes, ved utrullingen, i den samme opprydningen som Node-RED gjør.

## Varige koblinger

Merk en kobling som varig på noden den går ut fra. Nøkkelen er `ew_durable`, en liste over id-ene til nodene koblingen går til, og flytfilen fortsetter å lastes og lagres byte for byte fordi andre verktøy ignorerer den:

```json
{
  "id": "count", "type": "function", "z": "line3", "x": 290, "y": 100,
  "ew_durable": ["influx"],
  "wires": [["influx", "reply"]]
}
```

Hver kobling fra `count` til `influx` er nå varig. Koblingen til `reply` er fortsatt en vanlig en.

Hva en varig kobling gjør:

- **Skriver ingenting så lenge målet holder følge.** Meldinger går fra minnet rett inn i innboksen til målet, som på en vanlig kobling, og tilstandsdatabasen røres ikke. Vi satte den regelen etter at en løsning som skrev alt først, målte hundrevis av gigabyte i døgnet på et flashkort for en feil som skjer noen timer i året.
- **Renner over til disk når det ikke gjør det.** Koblingen begynner å renne over i det øyeblikket handleren til målet returnerer en feil, innboksen er full eller det ikke kjører. Fra da av skrives hver melding til filen før `Send` hos den sendende noden returnerer, så når avsenderen har gått videre, kan et `kill -9` ikke ta den. Meldingene som allerede er på vei til målet, ledes til disk bak den som feilet, i rekkefølge. I eksempelet over kommer `reply` som nummer to i koblingen, så mens koblingen renner over, betyr et HTTP 200 at målingen ligger på disk.
- **Tømmes i rekkefølge, i partier der målet tar dem.** En pumpe gir målet de eldste meldingene fra disk og venter til de er tatt. Ingenting bak en melding forbikjører den. Et mål som skriver til en database kan ta en rekke på opptil 256 meldinger som én skriving, og `influxdb out` gjør det: Med historianen som besvarer en skriving på 8 ms, tømtes et etterslep med omtrent 110 målinger i sekundet én og én, noe et anlegg som sender 100 i sekundet knapt tok igjen noe på, og det tømmes med den farten skrivingene tillater når hver bærer noen hundre. Alle andre mål får fortsatt én melding om gangen. Hvis et parti ikke blir tatt, markeres meldingene før den første som feilet som ferdige, den prøves på nytt alene med forsøket nedenfor, og resten sendes på nytt som et parti. Når køen er tom, går koblingen tilbake til minnet og slutter å skrive.
- **Prøver på nytt det målet feiler.** Den samme meldingen går igjen etter 250 ms, så 500 ms, doblet opp til 5 sekunder, så lenge det tar. Catch-nodene i flyten hører om den første feilen og ikke om hvert nye forsøk. Et mål som er stoppet, erstattet av en utrulling eller ikke fikk startet, ventes på, ikke hoppes over.
- **Overlever en omstart.** Alt som fortsatt ligger på disk når prosessen kommer tilbake, leveres først.
- **Respekterer en diskkvote.** `store.durable.maxBytes` (256 MiB) gjelder alle varige koblinger sammen og teller kroppen til hver melding pluss 64 byte. Når den er full, avgjør noden koblingen går til etter overflytpolicyen den allerede har: `block` venter opptil `blockTimeout` på plass og gir så feil, `drop-newest` avviser meldingen som kommer, `drop-oldest` kaster ut den eldste meldingen som ikke leveres, `error` melder feilen til en Catch-node. Hver av dem telles og kunngjøres som en forkastet-hendelse. Ett unntak: En melding som allerede er godtatt i minnet og som koblingen må flytte til disk, går inn over kvoten, fordi å avvise den ville bety å forkaste en eldre og beholde nyere. Overskridelsen er høyst det målet holder, innboksen pluss den ene meldingen goroutinen dens har tatt og ikke startet på, så kvoten kan et øyeblikk vise noen få meldinger over. Filen blir noe større enn kvoten, på grunn av SQLites sideoverhead og write-ahead-loggen, og en test fyller den, tømmer den og fyller den på nytt seks ganger for å bevise at den ikke fortsetter å vokse.
- **Viser dybden sin.** `hotloop_flow_durable_wire_depth{wire="..."}` er antall ventende meldinger, med `_bytes`, `_delivered_total`, `_retries_total` og `_dropped_total` ved siden av, og `hotloop_flow_durable_bytes` mot `hotloop_flow_durable_max_bytes` er kvoten.
- **Starter ikke noden på nytt.** Å merke en kobling som varig i en flyt som kjører, er en endring av koblingene, som å flytte en kobling.

En kobling som slutter å være varig, eller slettes, får køen sin tømt, telt som forkastet og kunngjort. Disse meldingene har ingen steder å gå, og å holde på dem ville fylle kvoten med en kø ingen kan se.

### Hva den lover, og hva den ikke lover

**Mens koblingen er frisk, finnes det et tapsvindu.** Det som ligger i minnet, er innboksen til målet og kallet det gjør, og et `kill -9` eller et strømbrudd tar det. Det er prisen for å ikke skrive noe, og vi godtok den med vilje: Med en innboks på 1024 og et raskt mål er det meldingene fra omtrent én polling. Når koblingen renner over, altså når målet er nede og dataene står i fare, finnes det ikke noe vindu. Testen med kill -9 nedenfor gjøres midt i avbruddet av den grunnen, med køen på disk. Vi drepte ikke kjøretiden mens koblingen var frisk, for å telle, fordi svaret er «noen få er borte», og det er designet.

**Leveringen er minst én gang.** Målet har tatt en melding når handleren returnerer uten feil, og koblingen markerer den som ferdig på disk etter det. Et `kill -9` mellom de to betyr at meldingen går igjen etter omstarten. Hvor mange avhenger av `store.durable.ackFlush`: Markeringene skrives sammen, så med standarden `100ms` er det meldingene som ble ferdige de siste 100 ms, og med `0s` skrives hver markering før neste melding sendes, så det er høyst den som er underveis, eller partiet som er underveis, opptil 256 meldinger, for et mål som tar partier.

Det høres ut som et hull, så her er det som tetter det for målet dette ble bygget for. En melding som krysser en varig kobling, stemples `msg._queuedAt` med tidspunktet den kom inn i koblingen, og `influxdb out` uten konfigurert tidsstempel skriver punktet med det tidspunktet. En gjentakelse er den samme serien til samme tid, som InfluxDB behandler som en overskriving, så radantallet endres ikke. Det retter også det andre som går galt med lagre og videresend: Uten det blir hver måling som holdes tilbake under et avbrudd stemplet når InfluxDB kommer tilbake, og en times historikk lander på ett minutt. En mottaker som stempler ved ankomst, for eksempel en `now()` i en Postgres-insert, ville lagret en gjentakelse to ganger, og den ville også satt den avspilte timen på feil sted. Bruk `msg._queuedAt`.

**«Tatt» er bare så sterkt som noden.** `influxdb out` gjør skrivingen sin inne i handleren, så tatt betyr skrevet. En node som gir arbeidet videre til en annen goroutine og returnerer, har lovet mindre, og koblingen kan ikke være mer varig enn det den er koblet til.

**Noen egenskaper blir ikke med på turen.** Et levende håndtak kan ikke krysse en omstart og kan ikke besvares i etterkant, så `msg.req` og `msg.res` (de fra HTTP In-noden) og alt annet som ikke lar seg serialisere, utelates fra meldinger på en varig kobling, og første gang det skjer på en kobling, logges det med navnet på egenskapen. Nyttelasten utelates aldri: Hvis den ikke kan lagres, avvises meldingen med en feil som nevner stien.

**Én dårlig melding kan holde en kobling.** Et mål som feiler den samme meldingen for alltid, får den for alltid, med pausen på 5 sekunder mellom forsøkene, og meldingene bak venter. Forsøkstelleren og dybden er måten du ser det på. Det er riktig valg for en historian som er nede. Det er feil for en melding som er ugyldig, så en kobling kan gis en grense: `"ew_durable_attempts": {"influx": 20}` på noden den går ut fra, eller koblingsdialogen i editoren. Når målet har avvist én melding så mange ganger fra køen, går den til flyten som en feil fra noden som avviste den, med meldingen vedlagt, en Catch-node kan parkere den, og koblingen går videre. Uten nøkkelen endres ingenting. Det finnes fortsatt ingen dead-letter-kø: En Catch-node er stedet du bygger den, og `hotloop_flow_durable_wire_given_up_total` teller det som havnet der.

## Innstillinger

```yaml
store:
  path: ""              # empty is state.db in data.dir
  synchronous: normal   # normal | full
  context:
    persist: true
    flushInterval: 30s  # 0s writes every change at once
  durable:
    maxBytes: 268435456
    ackFlush: 100ms     # 0s marks each message before the next is sent
```

Miljø: `HOTLOOP_FLOW_STORE_PATH`, `HOTLOOP_FLOW_STORE_SYNCHRONOUS`, `HOTLOOP_FLOW_CONTEXT_PERSIST`, `HOTLOOP_FLOW_CONTEXT_FLUSH_INTERVAL`, `HOTLOOP_FLOW_DURABLE_MAX_BYTES`, `HOTLOOP_FLOW_DURABLE_ACK_FLUSH`. Chartet har de samme navnene under `store:` i `values.yaml`.

`synchronous: normal` kjører filen i write-ahead-modus uten fsync ved hver commit. En commit overlever at prosessen drepes, som er `kill -9`-testen nedenfor. Den overlever ikke et strømbrudd på alle filsystemer. `full` gjør det, og `full` er den som sliter ut kortet.

## Beviset

Målt med en ekte InfluxDB 2.9.1 i Podman. Ingenting er simulert.

En produsent poster en nummerert måling til flyten i flow.json tjue ganger i sekundet. Flyten teller den i flytkonteksten og sender den nedover en varig kobling til `influxdb out`. Målingen har ikke noe tidsstempel, så en melding levert to ganger ville vært to rader. Et lite gjennomgangsledd mellom flyten og InfluxDB logger hver skriving InfluxDB godtok, fordi InfluxDB behandler et punkt skrevet to ganger til samme tid som ett punkt, og radene alene kan ikke vise en gjentakelse.

| Tid | Hva som skjedde |
|---|---|
| 00:13:53 | Flyten startet, 20 målinger i sekundet. |
| 00:14:53 | `podman kill` på InfluxDB. Den forblir død i ti minutter. Koblingen renner over til disk. |
| 00:19:54 | Fem minutter inn, kødybde 5,989 på disk. `kill -9` på kjøretiden. |
| 00:19:59 | Kjøretiden startet igjen, InfluxDB fortsatt nede. Den finner 5,992 meldinger på disk og tar imot nye. |
| 00:24:59 | InfluxDB startet. Kødybde 11,989. |
| 00:25:25 | Tømmer, kødybde 5,987. `kill -9` på kjøretiden igjen, midt i køen. |
| 00:25:30 | Kjøretiden startet igjen med 5,948 på disk. |
| 00:25:53 | Etterslepet tømt. Nitti sekunder til med jevn inngang, så en telling. |

```
deliveries      15987 writes InfluxDB answered 204 to
delivered twice 5 [7829, 7830, 7831, 7832, 7833]
sent            16185
accepted (200)  15982
failed          203
rows stored     15982
distinct seqs   15982
missing         0 []
doubled         0 []
unacked stored  0 []
```

Hver måling flyten svarte 200 på, ligger i InfluxDB, én gang. **Ingen mangler, ingen er doblet.** De 203 som feilet, var forespørsler som kom mens kjøretiden var død, altså produsenten som får nei, og ingen av dem ble lagret.

Fem meldinger ble gitt til InfluxDB to ganger. Det er de som det andre drapet fanget mellom at InfluxDB tok dem og at «ferdig»-markeringen nådde disken, innenfor `ackFlush`-vinduet. Hver bar samme `_queuedAt`, så den andre skrivingen overskrev den første og radantallet beveget seg ikke. Slik ser [minst én gang](#hva-den-lover-og-hva-den-ikke-lover) ut når det virker. Det er også det en mottaker som stempler ved ankomst, ville lagret to ganger.

Det dette ikke dekker: et `kill -9` mens koblingen er frisk. Målingene i minnet i det øyeblikket er borte, etter design, og vi telte dem ikke.

## Hva den skriver til disk

`write_bytes` fra `/proc/<pid>/io` er det kjernen ble bedt om å sende til lagring for prosessen, med avbrutte skrivinger trukket fra. Det er tallet et flashkort bryr seg om. Hver rad er 300 sekunder av ett scenario, etter 30 sekunder for å stabilisere seg, fra disk-writes.sh. Flyten er bevisflyten med InfluxDB bak, så belastningen er ekte.

```bash
BIN=./hotloop-flow SECS=300 bash docs/durable/disk-writes.sh
```

| Scenario | Rate | Kontekst-flush | Skrevet per time | Per døgn |
|---|---|---|---|---|
| Ledig, en varig kobling i flyten | ingen | 5 s | 0 byte | 0 |
| Frisk varig kobling, jevn last | 20 msg/s | 30 s | 1.7 MiB | 0.04 GB |
| Frisk varig kobling, jevn last | 50 msg/s | 30 s | 1.2 MiB | 0.03 GB |
| Samme, kontekst flushet hvert 5. s | 20 msg/s | 5 s | 5.1 MiB | 0.12 GB |
| Samme, kontekst flushet hvert 5. s | 50 msg/s | 5 s | 4.2 MiB | 0.10 GB |
| Bare kontekst, vanlig kobling | 20 msg/s | 30 s | 1.2 MiB | 0.03 GB |
| Kobling som renner over, InfluxDB nede | 20 msg/s | 5 s | 728 MiB | 17 GB |
| Kobling som renner over, `synchronous: full` | 20 msg/s | 5 s | 1,011 MiB | 24 GB |

Les det i tre deler.

**Ledig skriver ingenting.** Null byte på fem minutter.

**En frisk kobling skriver ingenting selv.** De friske radene er vedvarende kontekst, en teller som økes ved hver melding, og ingenting annet. Raden med bare kontekst og en vanlig kobling ligger innenfor støyen til dem. Kontekst-flushen var fem sekunder som standard frem til denne tabellen: Ved tjue meldinger i sekundet var det 5.1 MiB i timen, 0.12 GB i døgnet, og tretti sekunder tar det ned til 1.7 MiB, og derfor er standarden tretti. Et kill -9 mister da opptil tretti sekunder kontekst.

**En kobling som renner over er dyr, og bare mens den renner over.** Hver melding er sin egen commit, omtrent 10 KB skriving hver, fordi avsenderen venter på disken. Ti minutter avbrudd ved tjue i sekundet er omtrent 120 MiB, et døgns avbrudd omtrent 17 GB. Det er prisen for «på disk før avsenderen går videre», betalt bare mens historianen er nede. Gruppe-commit deler en transaksjon mellom samtidige avsendere, men én avsender gir én commit.

Ett tall til, fordi det overrasket meg. Ved 100 meldinger i sekundet holdt ikke dette oppsettet koblingen frisk: Målet holdt ikke lenger følge, koblingen rant over og ble værende i det gjennom hele kjøringen, 3,548 MiB i timen. Vi fant ikke ut om gjennomgangsleddet eller InfluxDB var det trege. Det er designet som virker slik det er skrevet, for «etterslep» teller som å ikke holde følge, og det betyr at et mål som er tregere enn inngangen, legger en varig kobling på disken. Ved 50 meldinger i sekundet holdt den seg frisk.

Designet før dette skrev hver melding til disk først. På det første skjemaet (4 KiB-sider, en tabell og en indeks) målte det 632 MiB i timen ved 20 meldinger i sekundet selv med InfluxDB frisk, og 1,163 MiB med hver «ferdig»-markering skrevet med en gang. Derfra kommer «disk bare under et avbrudd».

### På bare metal

Disse tallene ble målt på en x86-maskin under WSL2, og det varige lageret har siden kjørt på bare metal (2026-11-17). Skrevne byte er en egenskap ved koden og sidestørrelsen, så tallene over gjelder fortsatt. Det et kort gjør med dem (skriveforsterkning, slitasje) gjør ikke det, og det gjør heller ikke minne, starttid og vedvarende meldinger i sekundet, så de tallene forblir merket med hvor de ble målt.
