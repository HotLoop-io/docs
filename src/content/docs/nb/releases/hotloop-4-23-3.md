---
title: "Utgivelsesnotater: HotLoop core 4.23.3"
description: "Hva HotLoop core 4.23.3 gir deg, hva som endrer seg ved oppgradering og hva du bør lese før du rører et anlegg i drift."
sidebar:
  label: "4.23.3"
---

En WebVisu-skjerm beholder skjulingen og alarmfargene sine når den kommer over, og ethvert symbol på enhver skjerm kan nå vises og males av en regel på en tag. En liten retting i sikkerhetskopilisten følger med. Bygd bare for amd64; multi-arch-bygget følger som neste versjon.

## Hva som er endret

- **Et symbol kan vises og males av regler.** `show` tegner et symbol bare så lenge en regel på en tag holder, så en dør, et vern eller en pumpe tegnet for én tilstand, er der bare i den tilstanden. `colors` er opptil fire regler, hver med en tone (`ok`, `warn`, `bad` eller `info`): den første som holder, maler symbolet i den tonen, og når ingen holder, tegnes det som det var. En regel er en tag og en sammenligning (`on`, `off`, `eq`, `ne`, `gt`, `ge`, `lt`, `le`). En regel der taggen ikke har noen god måling, holder ikke og skjuler ingenting, så en tapt tilkobling får aldri et symbol til å forsvinne. Symbolskjemaet i byggeren har begge, og en skjermfil lister og flytter regelens tagger sammen med resten. Se [Dashbord](/nb/iot/dashboards/).
- **CODESYS-skjermimporten bærer Invisible og Toggle color.** Et elements Invisible-variabel (gruppens også) blir en `show`-regel, med `NOT x` som snur den, og Toggle color-variabelen blir en `colors`-regel i tonen nærmest elementets egen alarmfarge. De finnes på id-ene CODESYS-IDE-ens egne elementtrær gir dem. Det den ikke kan bære, sies i importen, med variabelen: disse to på en form tegnet inn i bakgrunnsbildet (et rør, et kar, en ramme), fordi bildet er ett bilde, og hver annen variabelstyrt innstilling (en fyllfarge, en ramme- eller tekstfarge, en bevegelse, en blink, en tekstliste). Se [Import a CODESYS screen](/nb/iot/codesys-screen-import/).
- **Sikkerhetskopilisten feiler ikke mens en sikkerhetskopi ryddes bort.** Den planlagte sikkerhetskopien rydder bort gamle sikkerhetskopier på sin egen goroutine, og en liste som havnet midt i, feilet på den manglende filen, noe API-et svarte som en serverfeil. En sikkerhetskopi som er borte, utelates nå fra listen.

## Migreringer

Ingen.

## API-endringer

Et symbols konfigurasjon tar `show` og `colors`. Ingen rute endret seg. Se [HTTP-API-et](/nb/iot/api/).

## Oppgradere fra 4.23.2

En vanlig `helm upgrade`. Ingen migrering og ingen ny secret. Et symbol uten noen av reglene tegnes som før.

## Hva som ikke er bevist

- CODESYS-importen ble bevist mot IDE-ens egen eksport av én visualisering og gruppevariabelen i CODESYS-eksempelet Refrigerator. En skjerm fra et annet prosjekt kan liste mer den ikke kunne plassere.
- De nye symbolreglene ble bevist av pakkens tester, ikke på et anleggs skjerm.
