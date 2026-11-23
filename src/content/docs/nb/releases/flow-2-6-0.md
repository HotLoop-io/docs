---
title: "Utgivelsesnotater: HotLoop Flow 2.6.0"
description: "Hva HotLoop Flow 2.6.0 gir deg, hva som endres ved oppgradering og hva du bør lese før du rører et anlegg i drift."
sidebar:
  label: "2.6.0"
---

HotLoop Flow 2.6.0 gir en varig forbindelse en måte å si fra at den har sluttet å levere. Ingenting ved hvordan flytene dine kjører endres. Hvis du kjører varige forbindelser på en anleggslinje, får du en teller du kan varsle på for den ene feilen som før så ut som en rolig kø.

## Nytt

**En fastlåst varig forbindelse telles og beskrives.** Pumpen til en varig forbindelse merker nå når forbindelsen sier at meldinger venter og køen ikke inneholder noe den kan lese, og det fortsatt er slik etter en kort ny sjekk. Den legger til én på `hotloop_flow_durable_wire_stranded_total{wire=...}` og skriver én advarsel i kjøretidsloggen, én gang per type feil, med forbindelsens tellere ved siden av det tabellen inneholder: hvor langt pumpen kom, dybden, radene på disk, hva som er underveis, og hvor mange som ble lagt til, levert og forkastet. På en frisk forbindelse er telleren null og forblir null, så enhver verdi over null er verdt et varsel.

Vi la det til fordi en forbindelse som forkaster eldste, én gang på noen tusen testkjøringer ikke tømte seg, og vi klarte ikke å fange hvorfor. Denne utgivelsen er instrumentet, ikke en rettelse. Hvis det noen gang utløses på linjen din, er loggmeldingen det vi trenger.

## Hva som er endret

- Lisensteksten som følger med imaget staver EmberNet slik den kanoniske kopien gjør. Tre linjer, bare skrivemåte.
- Bildene i README-en er vanlige bilder, lyse så mørke, så de vises på docs.hotloop.io.

## Nye innstillinger

Ingen. Metrikken er på, og det er ingen bryter.

## Oppgradering

En enkel `helm upgrade` til 2.6.0-imaget og -charten, eller den nye taggen i Quadlet-enheten din. Ingenting skjer ved første oppstart, det er ingenting å migrere, og flytene, distribusjonspostene og påloggingsopplysningene røres ikke.

Image: `ghcr.io/hotloop-io/hotloop-flow:2.6.0`, linux/amd64 og linux/arm64. Chart: `https://hotloop.io/hotloop-flow/`. README-en på denne taggen har resten, med bilder: https://github.com/HotLoop-io/hotloop-flow/blob/v2.6.0/README.md
