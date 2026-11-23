---
title: "Utgivelsesnotater: HotLoop Cascade 1.0.1"
description: "Hva HotLoop Cascade 1.0.1 inneholder, hva som endres ved oppgradering og hva du bør lese før du rører et anlegg i drift."
sidebar:
  label: "1.0.1"
---

## Hva dette er

1.0.1 retter én feil i hvordan pålogging behandler en database som ikke kan leses. Ingenting annet er endret fra 1.0.0.

## Rettelsen

Når databasen satte ut et øyeblikk, leste Cascade "jeg klarte ikke å slå det opp" som "det er ikke gyldig" og svarte 401. En øktsjekk, en API-nøkkel, et SCIM-token og en nøkkels bruker gjorde det alle, og øktsjekken fjernet også informasjonskapselen, så et kort utfall logget alle ut. Nå er bare en økt som ikke finnes eller tilhører en deaktivert bruker, en 401. Et lager som ikke kan leses, svarer 503 med Retry-After, og informasjonskapselen blir.

Den andre faktoren hadde samme problem. Under et utfall ble en riktig autentiseringskode, gjenopprettingskode eller passnøkkel besvart som en feil kode, noe som kan låse en person ute av sin egen konto. Disse stegene svarer nå 503 ved en lager- eller serverfeil og beholder 401 bare for en ekte avvisning: en feil kode, en mislykket passnøkkel, en utløpt forespørsel. Pålogging med passnøkkel leser heller ikke lenger et mislykket brukeroppslag som "ingen konto har den passnøkkelen".

## Oppgradere, og gå tilbake

Ingen migreringer. `helm upgrade` til 1.0.1, eller la `:stable` flytte Quadlet-enhetene. Siden ingenting i databasen endres, er det trygt å sette 1.0.0 tilbake. En sikkerhetskopi før enhver oppdatering er fortsatt en god vane.
