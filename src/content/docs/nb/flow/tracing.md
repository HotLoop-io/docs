---
title: "Sporing og avspilling"
description: "Klikk på en feilsøkingsmelding og se hvor den gikk, spill den av i et utkast, gjør et spor om til en test og send spans til OpenTelemetry."
---

En verdi går galt klokken 02 om natten, og feilsøkingsfeltet forteller deg verdien. Det forteller ikke hvilken av de ni nodene den gikk gjennom som endret den, hvor lenge den trege satt på den, eller hvordan den så ut på vei inn. Det finner du ut ved å strø Debug-noder utover flyten, utrulle, vente på at det skjer igjen og ta dem bort.

Derfor får hver melding som kommer inn i flyten et spor. Hver feilsøkingsmelding i feltet har en **Trace**-knapp, og ett klikk lyser opp veien meldingen tok på lerretet: nodene den gikk gjennom, ledningene den fulgte, og alt den aldri rørte, nedtonet. Hver node på veien viser hvor lenge den hadde meldingen (`8.3 µs`, eller `8.3 µs ×3` når den behandlet tre deler av den), og Trace-panelet ved siden av lister hvert hopp i rekkefølge med meldingen slik den noden fikk den. Klikk på en rad, og du er ved noden. Et hopp som feilet er rødt, med feilen under.

Det følger meldingen dit den faktisk går:

- **Gjennom en Split.** Én måling blir til tre, og alle tre er i sporet, hver som sitt eget hopp i hver node etter delingen.
- **Gjennom en Join.** Hoppet etter en Join har alle meldingene som Join tok inn for det som foreldre, ikke bare den som tilfeldigvis kom sist. De tre grenene som matet det, lyser alle.
- **Gjennom en underflyt.** Nodene inni kjører som kopier med egne id-er, og hoppene noteres under disse id-ene. Lerretet lyser opp underflytinstansen, fordi det er noden på fanen du ser på.
- **Inn i en Catch.** Noden som feilet har feilen på sitt hopp, og Catch-noden som fikk den er neste hopp, markert som nådd av en feil.

Sporet reiser med meldingen, men er ikke i den. Ingen flyt kan lese det eller ødelegge det med `msg = {...}`, og det dukker aldri opp i en Debug-node, en test eller en payload på ledningen.

## Det kan ikke vokse

Dette kjører på linjen det overvåker, så alle retninger er begrenset, og grensene står under `trace:` i [konfigurasjonen](/nb/flow/configuration/):

| Grense | Standard |
|---|---|
| Spor som beholdes, de nyeste | 256 |
| Hopp ett spor beholder, slik at en løkke ikke kan skrive seg ned i evighet | 512 |
| Største melding et hopp beholder en kopi av | 16 KiB |
| Alt til sammen, grovt regnet, eldste glemmes først | 16 MiB |
| Nye spor startet per sekund | 1,000 |

En melding over 16 KiB beholder tidsmålingen og markeres som for stor til å vises, og kan ikke spilles av eller gjøres om til en test. Over 1,000 nye spor per sekund går resten av meldingene i det sekundet usporet, fordi en sensor som snakker hundre tusen ganger i sekundet ellers ville betalt for et spor på hver eneste en. En melding som ble hoppet over, eller hvis spor ble presset ut mens den fortsatt var på vei, forblir usporet resten av reisen; å starte et nytt spor halvveis ville bare fylt bufferen med haler av reiser som har mistet hodet. Alt telles på `/metrics`, så du kan se når det skjer.

Utholdenhetstesten: **en million meldinger gjennom fem noder, 2026-10-18**, på samme maskin som [tallene over](/nb/flow/overview/#tallene). Heap etter en tvungen GC, målt for hver hundre tusen meldinger:

| Sporing | Heap, ved hvert kontrollpunkt | Meldinger per sekund |
|---|---|---|
| Sporing av | **1.3 MiB** | 192,596 |
| Sporing av hver melding (`perSecond: 0`) | **2.7 MiB** | 115,770 |
| Standardgrenser | **4.0 MiB** | 195,199 |

Det er samme tall ved alle ti kontrollpunktene. Sporeren holdt 808,448 byte i 256 spor fra første til siste kontrollpunkt, glemte 999,744 av millionen underveis, og kom aldri i nærheten av sine 16 MiB. Å spore hver melding koster: det tok denne kjeden fra 192k i sekundet til 116k. Derfor finnes standardgrensen. Ved 1,000 spor i sekundet forsvinner kostnaden i støyen, og under det er et spor omtrent 3 KB. Vil du ha hver melding uansett, sett `perSecond: 0` og les første rad i den tabellen før du bestemmer deg. Reproduser det med:

Hvis heapen slutter å være flat, feiler testen.

## Spill den av i et utkast

Du fant den dårlige verdien, du tror du vet rettingen, og du har endret en node på lerretet. Ikke utrull for å finne ut av det. **Replay into draft** tar meldingen som startet sporet, legger den inn i flyten slik den er på lerretet ditt akkurat nå, utrullet eller ikke, og forteller deg hvor den ender sammenlignet med hvor den endte første gang.

«Ender» betyr stedene meldingen stoppet: en Debug-node, en MQTT Out, en Switch som ikke traff noe, en Join som fortsatt venter. For hvert av dem sier sammenligningen at det er det samme, eller hvilke egenskaper som endret seg (`payload: "HIGH" -> "CRITICAL"`), eller at originalen endte der og avspillingen ikke gjorde det, eller omvendt. Avspillingens egen vei lyser opp på lerretet, så du ser hvor utkastet sendte den. **Back to the original trace** setter det første tilbake.

Den kjører slik en [flyttest](/nb/flow/tests/) kjører, i en barneprosess med den virkelige kjøretiden og de virkelige nodene, og av samme grunn: utkastet ditt starter hver node i det, og ingenting i det kan røre anlegget. Det betyr at en node som ville ha kalt en nettjeneste svarer med ingenting, så en flyt hvis utdata avhenger av et svar viser seg som en forskjell. Det er det ærlige resultatet. Den vil ikke late som om den har snakket med en PLS den aldri har snakket med.

## Et spor blir en test

**Make test** i Trace-panelet lager et utkast til en [flyttest](/nb/flow/tests/#tester-fra-editoren) fra hele sporet: meldingen som startet det, lagt inn ved kilden den kom inn gjennom, og hvert sted den endte som en test kan overvåke, med det den noden fikk forventet der. Det er de samme to klikkene som en test fra en feilsøkingsmelding, og det er bedre for de kronglete flytene, fordi et spor husker hver ende en melding nådde. En deling til tre Debug-noder blir tre forventninger, der én feilsøkingsmelding var én.

Den sier hvorfor når den ikke kan. Et spor som startet inne i en underflyt, fra en kildes andre utgang eller fra en melding som er for stor til å beholdes, kan ikke legges inn slik en test trenger. Og en melding som ble forkastet av en Switch ender ingen steder en test kan se, så den avvises i stedet for å skrives som en test uten innhold, for en test uten noe å sjekke består.

## OpenTelemetry

Pek den mot en kollektor, og hvert hopp går ut som en span:

```yaml
trace:
  otlp:
    endpoint: http://collector:4318   # OTLP over HTTP; /v1/traces is added
    headers: {x-api-key: ...}         # if the collector wants one
    serviceName: hotloop-flow
```

Et spor er et OpenTelemetry-spor og et hopp er en span, med hoppet som sendte meldingen som forelder. En Joins span har det første som forelder og resten som lenker. Hver span bærer node-id-en, nodetypen, meldings-id-en, hvor mange meldinger noden sendte videre og utgangsporten den ble nådd gjennom, og en feil er en span med feilstatus. **Meldingene forlater aldri anlegget.** En payload er et anleggs data og en kollektor er en annens server, så det som går ut er formen på reisen og tidsmålingen.

Den snakker OTLP/HTTP med JSON-kodingen spesifikasjonen definerer, skrevet for hånd i én fil, i stedet for å dra inn OpenTelemetry-SDK-en med protobuf og gRPC for å gjøre den samme ene POST-en. Binærfilen har et størrelsesbudsjett, og det bruker vi ikke på det. Hver span-id, forelder, lenke, navn, attributt og feilstatus må stemme. Det finnes ingen mock noe sted i den testen. Hvis kollektoren er nede, forkaster eksporten spans og teller dem, og flyten merker det aldri; at `hotloop_flow_otlp_spans_failed_total` går over null er slik du finner ut av det.
