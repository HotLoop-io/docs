---
title: "Solen"
description: "Soloppgang, solnedgang, demring og solens posisjon regnet ut på boksen fra breddegrad og lengdegrad, uten værtjeneste og uten internett."
---

Si fra til HotLoop hvor anlegget ligger, så vet det hvor solen er. Soloppgang, solnedgang, demring, solhøyde midt på dagen, solens høyde og retning, alt regnet ut på boksen fra en breddegrad og en lengdegrad. Ingen værtjeneste, ingen API-nøkkel, ikke noe internett. Et anlegg som mistet oppkoblingen for tre uker siden slår fortsatt på gårdslyset når det skumrer, og det er hele grunnen til at dette ikke er et kall til skyen til noen andre.

## Slik setter du det opp

To variabler, desimalgrader, nord og øst positive:

| Variabel | Eksempel | <span class="sr-only">Detaljer</span> |
|---|---|---|
| `HOTLOOP_SITE_LATITUDE` | `41.4993` | nord positiv |
| `HOTLOOP_SITE_LONGITUDE` | `-81.6944` | øst positiv, så hele Amerika er negativ |

I chartet heter de `plant.latitude` og `plant.longitude`. Begge eller ingen. En halv posisjon, et tall utenfor planeten eller `41°29'58"N` stopper HotLoop ved oppstart og nevner variabelen, fordi en soloppgang regnet ut fra en tastefeil er flere timer feil og ser helt rimelig ut på skjermen. Hent tallene fra et hvilket som helst kart: høyreklikk, kopier koordinatene.

Utelater du dem, finnes det ingen sol-entiteter, og en regel med solutløser blir ikke armert (systemloggen sier hvilke to variabler som skal settes). Innstillinger-skjermen viser begge, bare for lesing. En soloppgang er noe regler utløses på, så den endres med en gjennomgått utrulling.

## Entitetene

| Entitet | Tilstand | <span class="sr-only">Detaljer</span> |
|---|---|---|
| `binary_sensor.sun_up` | `on` fra soloppgang til solnedgang | attributter `next_dawn`, `next_sunrise`, `next_noon`, `next_sunset`, `next_dusk`, i anleggets tidssone |
| `sensor.sun_elevation` | grader over horisonten, negativ under | hele grader |
| `sensor.sun_azimuth` | grader med klokken fra sann nord, 90 er øst | hele grader |

De er plattform `sun`, de leses, og de tar ingen tjenester. `sun_up` regnes ut nøyaktig, så den skifter i samme sekund som utløserne for soloppgang og solnedgang utløses, ikke etter den avrundede høyden.

Høyde og asimut er hele grader med vilje. Solen flytter seg omtrent en kvart grad i minuttet. Med en tiendedels grad ville det blitt en ny tilstand, en loggbokrad og et historikkpunkt hvert 24. sekund, hele dagen, hver dag, per sensor, for en presisjon ingen automatiserer på. En regel som vil ha «solen står mer enn 10 grader opp» får det på graden.

Under midnattssolen eller i mørketiden kan neste solnedgang eller soloppgang være uker unna, og attributtet sier når. Finnes det ingen innen et år, står det `none within a year` i stedet for at den bare uteblir i det stille.

## Utløsere

```json
{"type": "sun", "event": "sunset", "offsetSec": -1800}
```

`dawn`, `sunrise`, `noon`, `sunset` eller `dusk`, flyttet med `offsetSec` (negativ er før, høyst seks timer til hver side). Se [Automasjoner](/nb/iot/automations/#solutløsere). `binary_sensor.sun_up` fungerer også med en vanlig `state`-utløser, og med `states['binary_sensor.sun_up'] == 'off'` i en betingelse, for «bare etter mørkets frembrudd».

## Hva tallene betyr

- **Soloppgang og solnedgang** er når solens øvre kant er på horisonten, med det vanlige tillegget for at lufta bøyer lyset: sentrum 0,833 grader under horisonten. Det er det alle almanakker og alle telefoner mener med soloppgang.
- **Demring og skumring** er borgerlig tussmørke, sentrum 6 grader under. Det er linjen utendørsbelysning skrives rundt: etter borgerlig skumring trenger du lys for å jobbe ute.
- **Solhøyde midt på dagen** er når solen står rett mot sør (rett mot nord, sør for ekvator) og er høyest. Det er sjelden 12:00 på klokka; på vestkanten av en tidssone om sommeren er det godt over ett.
- **Høyden** er der solen ser ut til å stå, korrigert for refraksjon. Asimut regnes fra sann nord, ikke magnetisk.

Forbeholdet om flat horisont: disse verdiene gjelder en horisont på havnivå. Et anlegg i en dal mister solen bak åsryggen før solnedgang, og HotLoop kjenner ikke åsryggen. Legg en forskyvning på utløseren.

## Hvordan vi vet at det stemmer

Matematikken er NOAAs: likningene bak solkalkulatoren til Global Monitoring Laboratory (gml.noaa.gov/grad/solcalc), som er Jean Meeus' *Astronomical Algorithms*. Overført slik de er, rarheten inkludert (NOAAs solhøyde midt på dagen leser tidsekvasjonen rundt midnatt UT i stedet for ved middag, verdt sekunder, og beholdt slik at vi treffer NOAA på sekundet).

Testen leser alle 4 380 cellene for soloppgang og solnedgang og holder hver passering til minuttet NOAA trykket, pluss to sekunder, og hver av de 2 190 middagene til innen ett sekund. Rundt 97 prosent runder av til nøyaktig samme minutt; resten ligger omtrent ett sekund fra et halvt minutt, som er to kalkulatorer som er uenige i siste siffer, ikke om solen. Hver dag NOAA sier har ingen soloppgang eller ingen solnedgang, sier HotLoop det samme.

NOAA publiserer ingen tabell for tussmørke, så demring og skumring holdes mot definisjonen sin: i øyeblikket HotLoop sier det er skumring, setter den samme posisjonsmatematikken solens sentrum 6 grader nede, til en femtiendedels grad.

NOAA sier at metoden er god til omtrent ett minutt mellom polarsirklene og blir dårligere mot polene, der solen skraper horisonten og en liten feil i høyden blir minutter på klokka. Utqiagvik består samme prøve som alle andre steder. På selve polene kan dag-for-dag-metoden gå glipp av den ene soloppgangen i året; driver du et anlegg på Sydpolen, legg en tidsplan på det.
