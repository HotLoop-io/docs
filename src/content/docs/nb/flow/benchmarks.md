---
title: "Ytelsestester"
description: "Målt oppstartstid, minne, gjennomstrømning og forsinkelse for Flow på en stasjonær og en Raspberry Pi 5, hva tallene ikke er, og hvordan du kjører testen selv."
---

Bare absolutte tall. En sammenstilling side om side flytter seg hver gang boksen endres, og ender opp med å beskrive det andre mer enn dette.

Flow svarer på omtrent 15 000 forespørsler i sekundet på en stasjonær og omtrent 13 000 i sekundet på en Raspberry Pi 5, med under 30 MiB minne på den stasjonære og 42 MiB på Pi-en. Det er hele poenget med en flytmotor som er liten nok for boksen på produksjonsgulvet.

## Flyten

Fem noder: et HTTP-endepunkt, tre egenskapsendringer, et svar. Ingenting i den er rask med vilje. Det er formen på en liten ekte flyt, som er det en ytelsestest av en flytmotor bør handle om. Lastgeneratoren er lukket sløyfe: hver klient sender neste forespørsel når den forrige kom tilbake, så den måler hva den andre enden kan ta unna og kan ikke produsere den misvisende forsinkelsen en åpen sløyfe melder når målet faller etter.

## Kjør den selv

`hotloop-flow bench` følger med i binærfilen. `-launch` starter binærfilen, tar tiden til flyten svarer (kaldstart), leser prosessens residente minne to sekunder senere (ledig), og samler deretter prøver gjennom lasten og beholder toppen. `-target` uten `-launch` driver en instans som allerede kjører, en container eller en pod, over HTTP, for gjennomstrømning og forsinkelse.

```bash
hotloop-flow bench -mode http -launch ./hotloop-flow -target http://127.0.0.1:18897 -path /bench -duration 30s -warmup 5s -connections 8
hotloop-flow bench -mode engine -chain 5 -messages 200000
```

## Resultater

Målt på en x86-stasjonær (24 CPU-er), med den native statiske binærfilen, tre kjøringer av hver.

| <span class="sr-only">Detaljer</span> | Kjøring 1 | Kjøring 2 | Kjøring 3 |
|---|---|---|---|
| Kaldstart | 0.05 s | 0.05 s | 0.05 s |
| RSS, ledig | 16.7 MiB | 16.7 MiB | 16.4 MiB |
| RSS, topp under last | 26.4 MiB | 26.4 MiB | 28.5 MiB |
| HTTP-gjennomstrømning | 15.0k req/s | 15.3k req/s | 13.0k req/s |
| HTTP-forsinkelse p50 / p95 / p99 | 0.39 / 1.22 / 1.82 ms | 0.39 / 1.20 / 1.78 ms | 0.41 / 1.49 / 4.03 ms |
| Motor, per melding | 2.61 µs | 3.11 µs | 2.20 µs |
| Motor, allokert per melding | 3,868 bytes | 3,869 bytes | 3,868 bytes |

## Resultater på en Raspberry Pi 5

Målt på én Raspberry Pi 5 med 8 GB, med klokken begrenset til 2.0 GHz, som en pod på k3s, uten noe annet på noden. Samme flyt, tre kjøringer, hver i en fersk pod.

| <span class="sr-only">Detaljer</span> | Kjøring 1 | Kjøring 2 | Kjøring 3 |
|---|---|---|---|
| Kaldstart | 0.46 s | 0.15 s | 0.10 s |
| RSS, topp under last | 40.3 MiB | 40.5 MiB | 40.3 MiB |
| HTTP-gjennomstrømning | 13.2k req/s | 13.4k req/s | 13.3k req/s |
| HTTP-forsinkelse p50 / p95 / p99 | 0.48 / 1.45 / 2.78 ms | 0.48 / 1.42 / 2.72 ms | 0.48 / 1.44 / 2.74 ms |
| Motor, per melding | 8.15 µs | 7.74 µs | 7.89 µs |

Holdt i 600 sekunder legger samme kommando på samme kort seg på 11.4k req/s med p50 på 0.58 ms og p99 på 3.00 ms. Kortet går med en enkel kjøleribbe uten aktiv kjøling og strupes under så mye last, så det er det ærlige tallet for en boks som holder seg belastet.

### Hva disse tallene ikke er

**HTTP-gjennomstrømningen inkluderer HTTP-stakken.** Med vilje: det er det en klient av flyten din opplever. Det er ikke en måling av planleggeren. Motorradene er det, uten noen I/O i veien.

**Én flytform, én nyttelaststørrelse, én samtidighet.** En flyt som gjør ekte I/O, en MQTT-publisering eller en databaseskriving, domineres av I/O-en. Disse tallene er kjøretidens eget overhead, ikke et løfte om alle arbeidsmengder.

**Halen beveger seg mer enn medianen.** Under metning står alt i kø, og køen eier p99. Medianen er der kostnaden ved å håndtere en forespørsel vises.

**Dette er testflyten, ikke varige koblinger.** Ingenting her måler lagringen bak en varig kobling eller skriving til SD-kort.

## Minne

RSS er prosessens eget residente minne, lest fra `/proc`. Det er ikke det `podman stats` melder, som viser hva kjernen belaster containeren med og kan vise mye lavere enn det prosessen faktisk holder på.