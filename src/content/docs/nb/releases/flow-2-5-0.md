---
title: "Utgivelsesnotater: HotLoop Flow 2.5.0"
description: "Hva HotLoop Flow 2.5.0 gir deg, hva som endres ved oppgradering og hva du bør lese før du rører et anlegg i drift."
sidebar:
  label: "2.5.0"
---

HotLoop Flow 2.5.0 er en ny editor. Samme flyter, samme motor, samme snarveier, og den ser endelig ut som den hører hjemme ved siden av resten av HotLoop i stedet for å komme fra et annet selskap. Hvis du kobler anlegg for å leve av det, får du en skjerm som passer til det du faktisk gjør hele dagen: sette tingen på lerretet, distribuere den og se den kjøre.

## Nytt

**Editoren ser ut som HotLoop.** Samme farger, samme skrift, lys og mørk etter systemet ditt, med en knapp i toppfeltet når du vil ha den andre. Oransje betyr «du kan klikke her» og ingenting annet. Det betyr ikke en advarsel, et utvalg eller en vei en melding tok.

**Feilsøking og kjøretid flyttet under lerretet.** Feilsøkingsloggen og Runtime-tabellen ligger nå i en dokk langs bunnen, side om side, så en feilsøkingslinje får hele lerretets bredde i stedet for en smal kolonne der hver nyttelast brøt om fire ganger. Runtime-tabellen ved siden av teller fortsatt hva som gikk inn i og ut av hver node, med en stolpe for hvor full hver kø er. Det betyr for deg: du ser en måling komme inn og noden den kom fra uten å rulle eller myse.

**Historikk, Tester og Spor blir til høyre.** Den du jobber i, kommer øverst. Trykk Distribuer, og gjennomgangen er det første i den kolonnen, med notatfeltet under. Klikk på Spor på en feilsøkingslinje, og sporet tar førsteplassen.

**Et spor er blått nå.** Veien en melding tok tegnes i blått over lerretet, med tiden hver node brukte på den. Gjennomgangen før en distribusjon markerer lagt til, endrede, flyttede og fjernede noder i grønt, ravgult, blått og rødt. Det betyr for deg: du ser på et øyeblikk forskjellen på et spor og et utvalg, fordi de ikke lenger deler farge.

**En pålogging som ser ut som resten av HotLoop.** Et kort, den ekte logoen og de samme feltene. Bak EmberCORE-dashbordet sier den fortsatt at du skal komme inn via dashbordet.

**Søket viser snarveien sin.** Knappen sier Ctrl F, så du slipper å gjette.

**Et dobbeltklikk rett etter en endring treffer.** Editoren sjekker forbindelsestypene dine et øyeblikk etter hver endring, og den pleide å tegne om hver forbindelse selv når svaret ikke hadde endret seg, så et dobbeltklikk på en node kunne treffe en forbindelse som ble byttet ut midt i klikket og ikke gjøre noe. Nå tegner den bare om når noe faktisk har endret seg.

## Hva som er endret

Ingenting om flytene dine. En flytfil lastes og lagres byte for byte, akkurat som før. Kobling, dra, angre, kopier og lim inn, Ctrl+Enter, Escape, flytting med piltastene, zoom, utvalg med ramme og å dra fra paletten fungerer som før, og hver eneste av de 60 nettlesertestene består uten at en linje av dem er rørt. Vi gikk også gjennom hver skjerm og hver dialog på 2.4.0 og på denne bygget mot den samme anleggsflyten, 48 tilstander, og ingenting forsvant.

Ting som ser annerledes ut med vilje: feilsøkings- og kjøretidspanelene flyttet til dokken, den tomme meldingen i Tester-panelet sier nå «feilsøkingsdokken» fordi det er der loggen er, et spor og en gjennomgang tegnes i blått og statusfargene, temaknappen sier Mørk eller Lys, og Søk viser snarveien sin.

**Én ting er tregere, og vi sier det heller enn at du finner det selv.** Siden er blank et øyeblikk til editoren er lastet, der den gamle tegnet rammen først. Vi målte det med nettleserbufferen av, fra forespørselen om påloggingssiden til skjemaet på skjermen. På denne maskinen er det omtrent 12 ms mer. Over en 20 Mbps-lenke er det omtrent 100 ms mer (230 ms ble 335 ms), og over en 1,6 Mbps-lenke med 150 ms ventetid er det omtrent et halvt sekund mer (1,46 s ble 1,96 s). På et anleggs-LAN er det noen få millisekunder. På en dårlig lenke ser du en hvit side et øyeblikk, og så editoren. Det er en engangskostnad per sideinnlasting, ikke per klikk.

## Nye innstillinger

Ingen. Det er ingenting å slå på, og ingenting her har en bryter for å slå det av.

## Oppgradering

En enkel `helm upgrade` til 2.5.0-imaget og -charten, eller den nye taggen i Quadlet-enheten din. Ingenting skjer ved første oppstart, det er ingenting å migrere, og flytene, distribusjonspostene og påloggingsopplysningene røres ikke. Last editor-fanen på nytt én gang etter at poden har startet på nytt, så nettleseren slutter å vise den gamle.

## Lisenser

Editoren leveres nå med to skrifttyper, Inter og JetBrains Mono, under SIL Open Font License 1.1. Lisensene deres ligger i `/usr/share/doc/hotloop-flow/THIRD_PARTY_LICENSES` sammen med resten, og `NOTICE` sier hvordan den filen lages.

Image: `ghcr.io/hotloop-io/hotloop-flow:2.5.0`, linux/amd64 og linux/arm64. Chart: `https://hotloop.io/hotloop-flow/`. README-en på denne taggen har resten, med bilder: https://github.com/HotLoop-io/hotloop-flow/blob/v2.5.0/README.md
