---
title: "Editoren i HotLoop Flow"
description: "Flow-editoren i lyst og mørkt: lerretet med feilsøkingsfeltet og kjøretidstabellen, gjennomgangen før en utrulling, en sporet melding og innloggingsskjermene."
---

Den følger systemet ditt, lyst eller mørkt, og hvert bilde nedenfor vises begge veier, det lyse først. Alle bildene nedenfor kommer fra `web/shots/screenshots.sh`, som starter den ekte binæren og en ekte nettleser, så de tas på nytt når editoren endres og kan ikke drive over til en attrapp. Anlegget på lerretet er en ovnslinje med to utrullinger bak seg.

## Koble, kjør, følg med

![Editoren på en ovnslinje: lerretet, utrullingshistorikken og feilsøkings- og kjøretidspanelene](/synced/flow/docs/screenshots/editor.png)
![Det samme, i mørkt](/synced/flow/docs/screenshots/editor-dark.png)

Lerretet er det som kjører. Feilsøkingsfeltet under skriver ut det feilsøkingsnodene dine ser, og Runtime-tabellen ved siden av teller hva som gikk inn i og ut av hver node, med en stolpe for hvor full køen er. Når en linje oppfører seg dårlig, leser du det av skjermen i stedet for å grave i en logg.

## Se det over før det når linjen

![Gjennomgangspanelet med én endret node og et notatfelt, ved siden av lerretet med den noden omrammet](/synced/flow/docs/screenshots/review.png)
![Det samme, i mørkt](/synced/flow/docs/screenshots/review-dark.png)

Deploy ruller ikke ut. Den tegner endringen på lerretet, skriver den ut i ord og ber deg om et notat. Notatet havner i historikken ved siden av navnet ditt, slik at den som får samtalen klokken 02 om natten kan se hva som endret seg og hvorfor.

## Følg en melding nedover koblingene

![En sporet melding lyst opp over lerretet med tiden hver node brukte på den, og feilsøkingsfeltet under](/synced/flow/docs/screenshots/debug.png)
![Det samme, i mørkt](/synced/flow/docs/screenshots/debug-dark.png)

Klikk Trace på en feilsøkingslinje, så lyser veien meldingen tok opp over lerretet, hopp for hopp, med det hver node gjorde med den og hvor lang tid det tok. Gjør den om til en test, eller spill den av i et utkast, fra det samme panelet.

## Logge inn

![Innloggingskortet](/synced/flow/docs/screenshots/signin.png)
![Det samme, i mørkt](/synced/flow/docs/screenshots/signin-dark.png)

![Varselet en kjøretid viser når dashbordet logger folk inn og denne siden ble åpnet på en annen måte](/synced/flow/docs/screenshots/dashboard-signin.png)
![Det samme, i mørkt](/synced/flow/docs/screenshots/dashboard-signin-dark.png)

Den starter ikke ulåst, så det første alle ser er en innlogging. Når EmberCORE-dashbordet logger folk inn, sier en kjøretid som er åpnet på en annen måte at de skal komme inn via dashbordet i stedet for å be om et nytt passord.
