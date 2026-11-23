---
title: "Utgivelsesnotater: HotLoop Flow 2.7.0"
description: "Hva HotLoop Flow 2.7.0 gir deg, hva som endres ved oppgradering og hva du bør lese før du rører et anlegg i drift."
sidebar:
  label: "2.7.0"
---

HotLoop Flow 2.7.0 er det første snittet av FlowLab, en andre måte å kjøre en fane på for testbenker og datalogger. Flyter kjører akkurat som før, og en flytfil du har i dag lastes og lagres byte for byte. FlowLab starter bare når du legger til en fane for det, så hvis du ikke gjør det, er det eneste som endres for deg øktrettelsen, det siste punktet nedenfor.

## Nytt

**FlowLab-diagrammer.** Et diagram er en fane der hver node kjører én gang, når hver tilkoblet inngang har en verdi, og to noder uten forbindelse mellom seg kjører samtidig. Legg til ett med den nye FlowLab-knappen ved siden av underflyt-knappen. Det får en linje over lerretet med Kjør og Stopp, og alt det tegner ligger på forbindelsene: siste verdi på hver forbindelse etter en kjøring, en probe på hvilken som helst forbindelse som beholder de siste 100 verdiene, og et bruddpunkt på en node eller en forbindelse. Pause, trinn inn, trinn over og trinn ut fungerer node for node, og uthev kjøring bremser en kjøring nok til at du kan følge den og slår seg av etter ti minutter. Ingenting ved feilsøkingen endrer hva en kjøring gjør, og en test sjekker at en kjøring med en probe ender med samme verdi på hver forbindelse som en uten.

**Hva som er i esken.** While- og for-løkker med verdier båret fra én runde til neste, en for-løkke over et antall eller en tabell, og en feilforbindelse: en node som får en feil inn gjør ingenting og sender den videre, og en feil koblet til en løkke stopper den med kilden og en kode på løkkens feilutgang. En `after`-forbindelse setter rekkefølgen på to noder som ikke deler data. Det er 21 nodetyper i den nye FlowLab-delen av paletten: konstant, matte, sammenlign, logikk, vent, bunt, felt, bygg tabell, de to løkkene med kroppens inngang og utgang, en serieport med lesing og skriving, en målingsparser, en detektor for stabil verdi, en logg til en tekstfil, og en kontroll, en indikator og et diagram for panelet. docs/diagrams.md har hver enkelt.

**Et panel en operatør kan åpne på telefonen.** `/panel/<diagram id>` logger inn på samme måte som editoren og viser diagrammets kontroller, indikatorer og diagrammer mens en kjøring er aktiv. Et diagram beholder de siste 1 024 punktene med mindre du endrer det, og teller det den lot gå. En kontroll sjekkes på serveren mot sin type, sitt område og sine valg, og hvem som satte den, havner i revisjonsloggen.

**En serieport som overlever en utrukket kabel.** En lesing som ikke får noe, eller en port som forsvinner, er en feil på feilforbindelsen. Neste lesing prøver å åpne porten igjen én gang i sekundet, og teller tapet og tilbakekomsten. Eksemplet i `examples/diagram-scale-logger` leser en vekt, parser vekt og enhet, sier fra når de siste fem målingene stemmer overens, viser alt på panelet med et trenddiagram og legger det til en CSV-fil. Sett `autostart` på fanen, så kjører den uten at noen nettleser er åpen, og på nytt etter hver distribusjon.

**Nytt API.** `GET /diagrams`, `GET /diagrams/{id}`, og `POST` for `run`, `stop` og `debug`, `PUT` for `controls/{node}`, `breakpoints` og `probes`. Lesing krever `status.read`. Kjøring, stopp, innstilling av en kontroll og feilsøking krever en ny tillatelse, `diagram.run`, og hver er i revisjonsloggen med hvem som gjorde det.

**Økter overskrives ikke av en mislykket lesing.** En øktfil som finnes men ikke kan leses, en I/O-feil eller et volum som kom opp sent, erstattes ikke lenger av neste pålogging, og en fil med uleselig JSON beholdes ved siden av originalen i stedet for å gå tapt.

## Hva som er endret

- En fane som bærer `ew_diagram` holdes utenfor meldingskjøretiden. Alle andre faner kjører som før. De nye nøklene er `ew_diagram` på fanen og `ew_in` på en node, og begge overlever rundturen, som to nye tester og den gamle sjekker.
- README-en telte 79 nodetyper og «omtrent 36 000 linjer Go», og begge var utdaterte. Nå står det 79 nodetyper for meldinger og 21 for FlowLab.
- Testen av HotLoop MCP-klientnoden skriver nå gjennom HotLoops port, fordi HotLoop leverer MCP-skrivingene sine slått på.
- En distribusjon starter hvert diagrams kjøring på nytt, selv et den ikke endret.
- FlowLab la til omtrent 370 KB i binærfilen, målt på én maskin før og etter. Binærfilen er 41,4 MB og amd64-imaget 45,34 MB.
- Bildene i README-en ble tatt på nytt for den nye knappen og den nye palettdelen.

## Nye innstillinger

Ingen. Tillatelsen `diagram.run` er ny. En bruker hvis tillatelsesliste er `["*"]` har den. Noen med en eksplisitt liste kan lese et diagram og panelet med `status.read` og kan ikke kjøre ett før du legger til `diagram.run`.

## Oppgradering

På amd64 en enkel `helm upgrade` til 2.7.0-imaget og -charten; på arm64 blir du der du er til 2.7.1, eller bruker den nye taggen i Quadlet-enheten din. Ingenting skjer ved første oppstart, det er ingenting å migrere, og flytene dine, distribusjonspostene og påloggingsopplysningene røres ikke. Hvis du ruller tilbake etter å ha lagret en flytfil med et diagram i, beholder det eldre bygget filen byte for byte og sier `unknown node type` for hver FlowLab-node, som da ikke kjører. Vi kontrollerte det mot bygget før dette.

Image: `ghcr.io/hotloop-io/hotloop-flow:2.7.0`, bare linux/amd64. Vi bygger amd64 først, lar det lese som stabilt i produksjon, og så legger en liten 2.7.1 uten noe annet til arm64. Til da har taggen `2` det nye amd64-imaget og arm64-imaget fra 2.6.0, så en maskin på arm64 som følger `2` eller `2.6` beholder det den har, og en maskin festet til `2.7.0` trenger amd64. Chart: `https://hotloop.io/hotloop-flow/`. README-en på denne taggen har resten, med bilder: https://github.com/HotLoop-io/hotloop-flow/blob/v2.7.0/README.md
