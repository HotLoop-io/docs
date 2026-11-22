---
title: "Mottrykk, synlig"
description: "Et tak på hver kø, en regel for hva som skjer ved taket, og en graf over hver melding som ikke fikk plass, før det ender som en OOM-kill."
---

Dette er hele prosjektet. Den typiske feilen til en flytmotor på en kantboks er en pod som sakte blåser seg opp til kubelet dreper den, og loggen den etterlater forklarer ingenting for den som har vaktrapporten i hånden. Derfor har hvert sted der en melding eller en byte kan hope seg opp et tak, og hvert tak er en skrevet og dokumentert beslutning i [Node-RED-kompatibilitet](/nb/flow/compatibility/), ikke en grense vi satte og aldri nevnte.

| Hva som kan hope seg opp | Hva som stopper det |
|---|---|
| Innboksen til en node | Et tak (1024 som standard) og en av fire overflytpolicyer |
| Forsinkelses- og hastighetsbegrensningskøer | Et tak; forbi det avvises meldingen til en Catch-node |
| Trigger-tidtakere | Et tak |
| Utdata fra `exec` | Begrenset per strøm; avkorting gir en feil |
| `exec`-prosesser | En samtidighetsgrense; forbi den avvises de |
| Fillesing | Begrenset, med moduser per linje og i biter |
| HTTP-forespørselskropper | Begrenset |
| Venting på et HTTP-svar | En 504 etter tidsavbrudd |
| TCP-tilkoblinger og rammer | Avgrenset |
| WebSocket-sendekøer | Avgrenset; en treg klient kobles fra |

Overflytpolicyene, satt globalt og kan overstyres per node:

| Policy | Hva som skjer |
|---|---|
| `block` | Avsenderen venter på plass, opptil `blockTimeout`. Mottrykket går oppstrøms, som er det riktige svaret nesten hver gang. |
| `drop-newest` | Meldingen som ankommer forkastes. Telt og varslet. |
| `drop-oldest` | Starten av køen går for å gi plass. Telt og varslet. For «bare den siste målingen betyr noe». |
| `error` | Sendingen avvises og heves til en Catch-node, slik at flyten bestemmer. |

Ingenting kastes i stillhet. Hver forkasting telles, sendes til editoren som en hendelse og eksporteres som en måledata du kan varsle på. Når en grense biter, finner du det ut fra en graf, ikke fra en operatør.

## Én goroutine per node

Hver nodeinstans får sin egen goroutine og sin egen innboks. Ordnet innenfor en node, parallelt mellom noder. En Function-node som gjør ekte arbeid opptar én kjerne mens editoren, API-et, websocketen og alle andre flyter fortsetter å bevege seg.

## Hver mottaker får sin egen kopi

Når en kobling forgrener seg, får hver node i den andre enden sin egen kopi av meldingen, slik at to grener som begge tror de eier den ikke kan ødelegge for hverandre, og en gren aldri oppfører seg annerledes enn søsknene som ser like ut på grunn av rekkefølgen du koblet dem i. Det er en feil som oppstår på tirsdager, og den finnes ikke her.

Det er ikke gratis. Å kopiere en liten melding (en måling og et emne) koster 411 til 453 ns og 680 byte, og en kjede på fem noder flytter en melding hvert 1,14 til 1,40 µs, kopier inkludert. Der kopiering gjør vondt, er en stor binær nyttelast: en 1 MiB-buffer koster 128 til 156 µs og en megabyte til på heapen for hver mottaker. Derfor reiser store binære nyttelaster som `ImmutableBytes`, som deler bufferen i stedet for å kopiere den: **250 til 279 ns og 360 byte for den samme 1 MiB-meldingen.** Fil- og HTTP-nodene leverer allerede binære nyttelaster på den måten, så du får det uten å be om det.

## Kontekst som kan telle

Flyt- og global kontekst har `get` og `set`, og også `CompareAndSwap`, `Increment` og `Update`. To grener som gjør get-modify-set på én teller konkurrerer og taper oppdateringer, og med bare get og set kan du ikke gjøre noe med det. Med `Increment` er det ingenting å konkurrere om.

Og den overlever en omstart. Flyt-, global og nodekontekst ligger i en SQLite-fil på volumet, lastes første gang et omfang brukes og skrives med forsinkelse, så en teller eller en lås i en flyt står der du forlot den når poden kommer tilbake. De atomære operasjonene er den samme koden som før. Endringer samles i én skriving hvert 30. sekund og en verdi som settes til det den allerede var skriver ingenting, fordi vi bryr oss mer om hva dette gjør med et SD-kort enn om å være smarte. En ren stopp skriver alt; en `kill -9` mister opptil de tretti sekundene, og `store.context.flushInterval` er rattet. Detaljer, og hva det koster et kort, står i [docs/durable](/nb/flow/durable-state/).
