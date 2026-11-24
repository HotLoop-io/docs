---
title: "HotLoop Flow, den visuelle flytmotoren"
description: "En visuell flytmotor for fabrikkgulvet i én Go-binær, med tak på hver kø, flyter du kan se over før de settes i drift, og dine Node-RED-flyter lastet uendret."
---

**Koble anlegget. Se det over som kode.**

HotLoop Flow er en visuell flytmotor for fabrikkgulvet, skrevet i Go. Du kobler sensorer, brokere, PLS-er og databaser sammen på et lerret, og den kjører koblingene i én statisk binær som er liten nok for en Pi, med en planlegger som ikke faller sammen når en sensor begynner å snakke raskere enn det som leser den.

Hva det betyr en dårlig natt:

- **Hver kø har et tak, og hver melding som ikke får plass, telles.** En rask sensor foran en treg historian hoper seg opp, blokkerer eller forkaster etter regelen du valgte, og det vises i en graf før det vises som en OOM-kill uten noe i loggen.
- **En historian som er nede i en time, koster deg ikke en time.** Merk en kobling som varig, og når noden bak slutter å ta imot meldinger, går de til disk i rekkefølge, og de ligger der fortsatt etter en `kill -9`. Mens alt er friskt, skrives ingenting. [Lagre og send videre](/nb/flow/store-and-forward/) ble bevist mot en ekte InfluxDB som sto stoppet i ti minutter.
- **Hver node kjører for seg selv.** Én goroutine per node, så en Function-node som tygger på en stor nyttelast koster deg én kjerne, ikke editoren og alle andre flyter på maskinen.
- **Flytfilen kan du se over.** Den lastes og lagres byte for byte, en endring i én egenskap er en diff på én linje, og hver lagring er atomisk med tre sikkerhetskopier bak seg. Hver utrulling er [en post](/nb/flow/deploys/): hvem, når, hvorfor og de nøyaktige bytene, og to av dem kan [sammenlignes node for node](/nb/flow/deploys/#diffen-leses-som-en-gjennomgang), i API-et, på kommandolinjen og i `git diff`. Hver av dem kan [rulles tilbake](/nb/flow/deploys/#sett-det-tilbake), legitimasjon inkludert.
- **Den starter ikke ulåst.** Ingen autentisering er en oppstartsfeil, ikke en standardverdi. Noden `exec` leveres avslått, filnodene er stengt inne i datamappen, og legitimasjon er AES-256-GCM under en Argon2id-nøkkel.

Den kjører også de eksisterende flytene dine uendret. Det står [lenger ned](/nb/flow/migrating-from-node-red/), fordi det er en funksjon, ikke poenget.

Gjeldende utgivelse er `2.17.2`. Avbildningen er `ghcr.io/hotloop-io/hotloop-flow:2.17.2` for amd64 og arm64, Helm-repoet er `https://hotloop.io/hotloop-flow/`, og [Deploye Flow](/nb/flow/deploying/) har Kubernetes, Podman og Quadlet. Den har 117 nodetyper for meldinger og 39 for FlowLab-diagrammer. Bruk hjemme og i laboratorium er gratis, det samme er bruk i skoler, ideelle organisasjoner og offentlig sektor, og bruk gjennom EmberNet, en partnerplattform, forretningsbruk inkludert, er ubegrenset, under HotLoop Source License Agreement.

## Tallene

Bare absolutte tall, så du kan sjekke dem på din egen maskinvare. Tre kjøringer hver, og området er det som skrives ut.

| Mål | Resultat |
|---|---|
| Binær, linux/amd64, statisk | **41.7 MB** |
| Image, amd64 | **45.64 MB** |
| Fra start til første besvarte forespørsel | **0.05 s** |
| RSS, uten last | **16.4 til 16.7 MiB** |
| RSS, topp under HTTP-lasten under | **26.4 til 28.5 MiB** |
| HTTP, flyt med fem noder, 8 forbindelser | **13.0k til 15.3k req/s** |
| HTTP-latens p50 / p99 | **0.39 til 0.41 ms / 1.78 til 4.03 ms** |
| Motor, kjede med fem noder, uten I/O | **2.20 til 3.11 µs per melding**, 3.9 KB allokert |

Vit hva disse tallene ikke er. HTTP-tallet går med vilje gjennom hele HTTP-stakken, fordi det er det en klient av flyten din ser. Og under metning køer enhver kjøretid, og køingen eier halen, og det er derfor p99 svinger mer enn p50 mellom kjøringene.

### På en Raspberry Pi 5

Samme flyt og samme kommandoer, 2026-10-22, på en Raspberry Pi 5 Model B (8 GB, fire Cortex-A76-kjerner) med klokken begrenset til 2.0 GHz, med det publiserte arm64-imaget `2.2.0` som en pod og ingenting annet på noden enn klyngens DaemonSets. Tre kjøringer, området skrives ut.

| Mål | Resultat |
|---|---|
| Fra start til første besvarte forespørsel | **0.10 til 0.46 s** |
| RSS, uten last | **88.0 til 88.3 MiB** |
| RSS, topp under HTTP-lasten | **40.3 til 40.5 MiB** |
| HTTP, flyt med fem noder, 8 forbindelser, 30 s | **13.2k til 13.4k req/s** |
| HTTP-latens p50 / p99 | **0.48 ms / 2.72 til 2.78 ms** |
| Motor, kjede med fem noder, uten I/O | **7.74 til 8.15 µs per melding**, 4.0 KB allokert |
| HTTP, samme kommando holdt i 600 s | **11.4k req/s**, p50 0.58 ms, p99 3.00 ms |

Den siste raden er den ærlige for en maskin som holder seg belastet. Kortet nådde den myke temperaturgrensen på under et minutt, strupet fra omtrent to minutter og ble liggende på 83 til 86 C med klokken på 1.5 til 1.7 GHz resten av tiden. [Referansetestsiden](/nb/flow/benchmarks/#resultater-på-en-raspberry-pi-5) har hele kjøringen på Pi-en.

[Referansetestsiden](/nb/flow/benchmarks/) har metoden og forbeholdene.

Skal du bruke den i et anlegg? [Bruke HotLoop i en bedrift](/nb/business/) dekker lisensen og hvordan du når oss.
