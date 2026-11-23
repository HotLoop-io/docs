---
title: "Utgivelsesnotater: HotLoop Cascade 1.0.2"
description: "Hva HotLoop Cascade 1.0.2 inneholder, hva som endres ved oppgradering og hva du bør lese før du rører et anlegg i drift."
sidebar:
  label: "1.0.2"
---

## Hva dette er

1.0.2 lar en arbeidsflyt signere og verifisere ting uten at en hemmelighet noen gang ligger i elementdata, og lar et offentlig skjema på et annet nettsted kalle en webhook fra nettleseren. Ingenting annet er endret fra 1.0.1.

## Nytt i Kode-steget

- **Krypto-hjelpere.** `sha256(text)`, `hmacSHA256(key, text)`, `randomHex(bytes)`, `base64Encode(text)`, `base64Decode(text)` og `safeEqual(a, b)`. De beregnes i Go, så svarene er standardbibliotekets, og skriptet har fortsatt ingen `require`, ingen nettverk og ingen filer.
- **En legitimasjon for steget.** Kode-steget har en legitimasjonsplass `secret`. Gi det en `HMAC key`-legitimasjon (en ny innebygd legitimasjonstype med ett hemmelig felt, `key`), og skriptet leser den som `credential.key`. Nøkkelen bor i hvelvet som enhver annen hemmelighet, og hvelvet sladder den i alt kjøringen lagrer, selv om skriptet returnerer den. Et steg uten legitimasjon ser et tomt `credential`-objekt.

Grunnen: et offentlig skjema sjekker et arbeidsbevis med en HMAC. Før dette var den eneste måten å gjøre det på i en arbeidsflyt å legge nøkkelen i et element eller en variabel, og begge havner i lagrede kjøringer eller i klartekst. Nå er nøkkelen en legitimasjon, og den lagrede kjøringen har signaturen og ingenting annet.

## Nytt på en webhook

- **`corsOrigins`.** En webhook-trigger tar en liste over nettopprinnelser (`https://example.com`, eller `*`) hvis sider kan kalle den fra en nettleser. Cascade svarer selv på nettleserens forhåndsforespørsel, uten å starte en kjøring, og legger til `Access-Control-Allow-Origin` i svaret for en oppført opprinnelse. En webhook som ikke lister noen, oppfører seg nøyaktig som før: ingen CORS-hoder, så en nettleserside kan ikke lese svaret. En oppføring må være en opprinnelse, uten sti.

## Oppgradere, og gå tilbake

Ingen migreringer. `helm upgrade` til 1.0.2, eller la `:stable` flytte Quadlet-enhetene. Arbeidsflyter som aldri bruker de nye hjelperne, oppfører seg nøyaktig som før, så det er trygt å sette 1.0.1 tilbake for dem; en arbeidsflyt som kaller en ny hjelper, feiler på 1.0.1 med hjelperen udefinert. En sikkerhetskopi før enhver oppdatering er fortsatt en god vane.
