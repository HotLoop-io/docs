---
title: "Utgivelsesnotater: HotLoop Cascade 1.2.0"
description: "Hva HotLoop Cascade 1.2.0 inneholder, hva som endres ved oppgradering og hva du bør lese før du rører et anlegg i drift."
sidebar:
  label: "1.2.0"
---

## Hva dette er

1.2.0 fullfører verktøylisten til MCP-serveren. Motoren, filformatet for arbeidsflyter, skjermene og REST-API-et er som i 1.1.1.

## De fire verktøyene

Alle MCP-er i HotLoop-familien leser og skriver, og Cascades hadde fire ruter utelatt som en nøkkel har lov til å kalle. De er verktøy nå, 83 til sammen:

- `list_keys` og `revoke_key`: nøklene til personen nøkkelen tilhører, og å tilbakekalle en av dem. En nøkkel kan tilbakekalle seg selv, noe innehaveren av en lekket nøkkel bør kunne gjøre først. Rutens egne sjekker avgjør hvem sine nøkler en oppringer kan tilbakekalle, på samme måte som i editoren.
- `listen_workflow`: åpner test-webhook-URL-en til en arbeidsflyt for ett kall, i 1 til 600 sekunder.
- `start_oauth`: gir tilbake adressen en person åpner for å logge inn for en OAuth2-legitimasjon. Personen må fortsatt si ja.

Hvert verktøy går gjennom sin rute, så tillatelsessjekken, valideringen og revisjonsraden er rutens, og en skriving ber om en begrunnelse som alle andre skriveverktøy.

## Hva som blir utenfor

Ti ruter avviser en nøkkel selv, fordi de vil ha en innlogget person: å lage en API-nøkkel eller en tjenestekontonøkkel, å lage et SCIM-token, å legge til, endre eller slette en hemmelighetsleverandør eller et loggmål, og ditt eget passord. En nøkkel som kunne lage nøkler, eller endre hvor revisjonsloggen går, er en lekket nøkkel som holder seg i live. MCP-siden har listen og grunnen.

## Bare amd64, og hvorfor

Denne utgivelsen bygges bare for amd64. Multi-arkitektur kommer i sin egen kjøring, så utgivelsen etter denne er et lite versjonsløft som bygger begge.

## Oppgradere, og gå tilbake

Ingen migreringer. `helm upgrade` til 1.2.0, eller la `:stable` flytte Quadlet-enhetene. Det er trygt å sette 1.1.1 tilbake, fordi ingenting i databasen endret seg. Det en tilbakerulling ikke kan angre, er det en agent allerede har gjort med de nye verktøyene.
