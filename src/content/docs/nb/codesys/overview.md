---
title: "HotLoop for CODESYS: oversikt"
description: "HotLoop ved siden av en CODESYS-kjøretid: skjermbilder og alarmer for en CODESYS-PLS, lest gjennom kjøretidens OPC UA-server, uten installasjon i CODESYS."
sidebar:
  label: "Oversikt"
editUrl: false
---

HotLoop for CODESYS er HotLoop som kjører på samme node som en CODESYS-kjøretid. Det leser PLS-ens variabler gjennom kjøretidens egen OPC UA-server, legger dem på skjermbilder som fungerer på en panel-PC, en telefon eller en vegg, utløser alarmer på dem og beholder historikken. Ingenting installeres i CODESYS og ingenting skriver til PLS-en. Det er skjermbildet du ellers ville bygget i CODESYS WebVisu, tegnet utenfor kjøretiden. Hva det gir deg: operatørene får et skjermbilde uten nedlasting til PLS-en, og PLS-en får et ekstra par øyne som ikke er avhengig av noe annet på noden.

Det er ett av de åtte HotLoop-produktene, og har sin egen utgivelseslinje. Det nyeste chartet er 0.3.8, publisert 2026-11-16. Under det ligger HotLoop Edge, så alt på [Edge-sidene](/nb/edge/overview/) gjelder også her.

![Skjermbildet Line 2: fire verdikort, en måler, en femten minutters trend og en alarmliste](/codesys/screen.png)
![Det samme, i mørkt](/codesys/screen-dark.png)

Dette er en ekte kjøring: HotLoops standardgrensesnitt som leser en CODESYS Control for Linux SL 4.22.0.0-kjøretid. PLS-programmet er HotLoops eget demoprogram, så tallene er demoens. Etikettene (Line 2, Mixer temperature, Riverside Bottling) er funnet på og satt inn av [profilen](/nb/codesys/profile/).

## De tre delene

| Del | Hva det er | Hvor det ligger |
|---|---|---|
| Chartet `hotloop-codesys` | En innpakning rundt `hotloop-edge` med standardverdier for en kjøretid på en node: SQLite, én replika, og det du ikke trenger ved siden av en PLS slått av. Hver chart-rettelse i HotLoop når det. | `https://hotloop.io/hotloop-codesys/` |
| Provisioneren | Én statisk Go-binær som bruker en profil på HotLoop og holder den riktig. Den har ingen profil selv. | `ghcr.io/hotloop-io/hotloop-provision` |
| En profil | Én JSON-fil: enheten, variablene som skal beholdes, alarmene og ett skjermbilde. Den ene inndataen du gir. | En Secret i installasjonens navnerom, [beskrevet her](/nb/codesys/profile/) |

## Hvordan den leser PLS-en

CODESYS dokumenterer én måte for en tredjepart å lese en kontrollers variabler på, og det er kjøretidens egen OPC UA-server. PLS-en publiserer det du vil se med en Symbol Configuration i IDE-en, og HotLoop leser variablene med navnene programmereren ga dem, som `Application.GVL_Line.rTemp`, ikke med en node-id. Symbol Configuration er den eneste endringen i PLS-prosjektet. Kanalprotokollen til CODESYS Gateway er ikke dokumentert for tredjeparter, og dette snakker den ikke.

Lesingen gjøres av CODESYS-konnektoren i HotLoop core, som er OPC UA-driveren pluss det en CODESYS-PLS trenger på toppen: oppdagelse av hva applikasjonen eksporterer, typene den har, matriser og strukturer gått ut i ett punkt per felt, en gjentilkobling uten inngrep etter en omstart eller nedlasting, og hver forespørsel kuttet til grensene kjøretiden publiserer. [Protokollsiden](/nb/iot/protocols/) har konnektorens referanse fra HotLoop 4.19.4 og utover, og forteller hva den ble verifisert mot og hva den ikke ble det.

## Hva den gjør av seg selv

Så snart både HotLoop og nodens egen kjøretid svarer, setter provisioneren opp profilens enhet, variabler, alarmer og skjermbilde. Deretter ser den etter igjen hvert femte minutt. En variabel i profilen som PLS-en har fått siden, legges til. En som PLS-en ikke lenger har, leses som dårlig med serverens grunn. Skjermbildet og alarmene lages når de mangler og erstattes bare når profilens `revision` er høyere enn den som laget dem, så en endring en person har gjort overlever til en nyere profil leveres med vilje.

## Hva den ikke gjør

- **Den skriver ikke til PLS-en din.** Hver tag provisioneren setter opp er skrivebeskyttet, og profilen markerer ingen som skrivbar. En person kan aktivere en tag senere, og da har [skriveporten](/nb/gateway/write-gate/) og PLS-ens egne symbolrettigheter begge noe å si.
- **Den legger ingenting i kjøretiden.** Ikke noe bibliotek, ingen oppgave, ingen agent.
- **Den trenger ingen database-pod.** SQLite på nodens egen lagring, én replika.
- **Den er bygget for å beholde skjermbildene sine gjennom en tapt forbindelse.** Begge podene tåler en utilgjengelig eller ikke-klar node uten tidsgrense, og toleransene ligger i chartet. [Status](/nb/codesys/where-it-stands/) sier hva som har kjørt på en ekte node.

## Hvor du går videre

[Installer det](/nb/codesys/install/), les hva en [profil](/nb/codesys/profile/) inneholder, eller se [statusen](/nb/codesys/where-it-stands/) og [veikartet](/nb/codesys/roadmap/). Bruker du det på et anlegg? [Bruke HotLoop i en bedrift](/nb/business/) forklarer lisensiering og hvordan du når oss.
