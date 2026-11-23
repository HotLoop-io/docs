---
title: "Utgivelsesnotater: HotLoop core 4.20.0"
description: "Hva HotLoop core 4.20.0 gir deg, hva som endrer seg ved oppgradering og hva du bør lese før du rører et anlegg i drift."
sidebar:
  label: "4.20.0"
---

Det nye webgrensesnittet er nå det på `/`, og en agent kan endre alt den kan lese gjennom MCP. Det er ingen migreringer, og en vanlig `helm upgrade` eller Quadlet-auto-update tar den. Forrige versjon, [4.19.11](/nb/releases/hotloop-4-19-11/), er den siste der standardskjermene var de gamle.

Dette bygget er bare amd64, og neste versjon er en liten versjonsøkning som bygger arm-imagene, slik de to kjøringene går. `stable` beholder i mellomtiden arm-imagene den har.

## Hva som er endret

- **Det nye webgrensesnittet er standarden, og det gamle er borte.** Hver skjerm ble bygd på nytt som en statisk side (Astro, med Svelte-deler), innebygd i den ene binærfilen, uten Node på boksen og uten CDN. Det lå på `/next` gjennom 4.19.x. På `/` er det de samme nitten skjermene med de samme kontrollene, feltene, kolonnene, skjemaene og ordene, for leseren, operatøren og administratoren. Det som ser annerledes ut, med vilje:
  - Fargene er HotLoops varme grunn og oransje, de samme som nettstedet, Flow og Cascade, og merket er det offisielle.
  - Skjermene er gruppert i Operate, Plant, Build og System i en skinne på et skrivebord. På en telefon er det en linje med fem (Board, Alarms, Dashboards, Entities, More), og More åpner hver skjerm.
  - Temakontrollen sier Dark eller Light, der den før viste en måne.
  - Ikonene til den installerte appen, temafargen og splash-fargen følger det nye utseendet.
  - En skuff holder av plass til rullefeltet sitt, så et kort i den ikke flytter seg når historikken lastes.
- **Å logge inn med HotLoop utilgjengelig sier hvorfor og kommer seg selv.** En telefon som aldri logget inn, eller logget ut, og åpner siden uten tilkobling, får innloggingsskjermen med en setning som sier at HotLoop ikke svarer herfra. Siden spør på nytt hvert tredje sekund, og når tilkoblingen kommer tilbake, lastes den på nytt uten et trykk. Det er den gamle oppførselen, beholdt.
- **MCP kan endre alt det kan lese.** Det var tjuesju verktøy som leste anlegget og kommanderte utstyr; nå er det 128. Sekstifire til endrer konfigurasjon: enheter og tagger, discovery og meglere, UniFi-nettverk, entiteter, helpers, utstyr og etiketter, alarmer, automasjoner og blueprints (en agent kan nå lage regelen fra en blueprint, som den bare kunne forhåndsvise), skript, oppskrifter, dashbord og resten av det en skjerm kan lagre. Trettisju når administratorens egne funksjoner: brukere og PIN-koder, innstillinger, sikkerhetskopier, eskalering, historian-mål, megler-logins, flåten av edge relays og rapporter. Ingen er en andre implementasjon. Hver er én rute i REST-API-et kjørt gjennom den rutens egen handler, så valideringen, rettighetskontrollen, runtime-omlastingen og revisjonslinjen er rutens, med agenten som aktør.
- **Hva som står foran en endring.** Bryteren `HOTLOOP_ALLOW_MCP_WRITES` (på som standard) må være på, og en kaller med `HOTLOOP_MCP_OIDC_WRITE_ROLE` satt må ha den rollen. Kallet bærer akkurat den ene rettigheten ruten ber om (`devices.write`, `alarms.write`, `users.manage`, `settings.write` og så videre) og avvises med rutens egne ord uten den. Hver endring krever en `reason`, registrert som en `config`-linje i systemloggen ved siden av rutens egen. Å kommandere utstyr er fortsatt `write_tag`, `call_service`, `run_script`, `apply_recipe` og `trigger_automation` bak `HOTLOOP_ALLOW_WRITES`, tagens skrivbar-merke og dens område. Å gjøre en tag, en regel eller en oppskrift skrivbar er konfigurasjon og kommanderer ingenting før den brukes; det den da kommanderer, møter den samme porten. De to skrivebryterne har ingen rute, så `save_settings` avviser dem for en agent som skjermen Settings gjør, og en agent kan ikke slå på bryteren sine egne skrivinger venter på. En brukers passord går gjennom kallet som gjennom API-et, og revisjonslinjen bærer det aldri. Verktøyene finnes også under `--mcp-stdio`. [MCP](/nb/iot/mcp/#endre-konfigurasjon) har hvert verktøy, ruten og rettigheten.

## API-endringer

- `GET /next` og `GET /next/` er en `301` til roten, så et bokmerke laget mens det nye grensesnittet lå ved siden av det gamle, treffer fortsatt. `Location` er relativ, så den er riktig under en basesti.
- `GET /static/` er borte, og med den `GET /next/manifest.webmanifest`. Siden, filene, ikonene, `/manifest.webmanifest` og `/sw.js` serveres fra roten som før; det gamle stilarket og skriptene var ikke lenket fra noe sted og serveres ikke.
- `HOTLOOP_UI` leses ikke lenger. Å sette den gjør ingenting.
- Ingen andre ruter endret seg. MCP-verktøyene er ny flate, ikke REST-ruter.

## Oppgradere fra 4.19.11

En vanlig `helm upgrade`, eller Quadlet-auto-update. Det er ingen migreringer og ingenting å konfigurere. Første lasting henter den nye siden, og service workeren erstatter cachen til den gamle, så en telefon som hadde appen installert, viser de nye skjermene ved neste åpning. Ingenting kan gjøres uopprettelig ved å oppgradere, og en tilbakerulling til 4.19.11 er trygg fordi ingenting i databasen endret seg.

## Kjent

- Ingenting nytt. Det som fortsatt er åpent under Broken or missing i [veikartet](/nb/roadmap/): OPC UA X.509-brukertokener, de utdaterte policyene `Basic128Rsa15` og `Basic256` som OPC UA-serveren vår tilbyr, og passord over 64 byte (begge bibliotekets), og tester av stille enheter for S7comm og EtherNet/IP mot ekte enheter.
