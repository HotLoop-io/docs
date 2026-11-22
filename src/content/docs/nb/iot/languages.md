---
title: "Språk i nettgrensesnittet"
description: "Nettgrensesnittet på engelsk og tretten språk til, med arabisk satt fra høyre mot venstre, valgt i toppfeltet eller på innloggingskortet."
---

Nettgrensesnittet til HotLoop IoT, Edge og Gateway (og HotLoop for CODESYS, som kjører Edge-grensesnittet) finnes på engelsk og 13 språk til: spansk (es), fransk (fr), italiensk (it), tysk (de), norsk bokmål (nb), bulgarsk (bg), gresk (el), koreansk (ko), japansk (ja), vietnamesisk (vi), hindi (hi), forenklet kinesisk (zh-Hans) og arabisk (ar, satt fra høyre mot venstre).

Velg ett i språkboksen i toppfeltet, eller på innloggingskortet. Valget huskes i denne nettleseren. Er ikke noe valgt, bruker siden det første av nettleserens språk som HotLoop har, og engelsk hvis ingen passer. Et språk står i valglisten bare når filen er komplett.

Det som følger språket: hvert ord på hver skjerm, rekkefølgen og tegnene i tall (desimalkomma på tysk, fransk og spansk), datoer og klokkeslett (24-timersklokke), flertallsformer (arabisk har seks) og retningen på siden. Produkt- og protokollnavn (HotLoop, Modbus, OPC UA, MQTT, Sparkplug, CODESYS, UniFi) står som de er skrevet. Verdier fra anlegget, som tagnavn, enhetsnavn, alarmmeldinger noen har skrevet og feiltekst sendt tilbake av serveren, vises som de er.

## Slik fungerer det

* [i18next](https://www.i18next.com/) 27 slår opp meldingen, fyller inn `{{name}}` og velger flertallsformen. Den spør nettleserens egen `Intl.PluralRules`, så flertallsreglene er Unicode CLDR sine. Tall og datoer bruker `Intl.NumberFormat` og `Intl.DateTimeFormat` gjennom `web/src/lib/format.ts`.
* Meldingene ligger i `web/src/i18n/locales/<language>.json`, flatt, én nøkkel per melding. `en.json` er kilden. Hver annen fil har nøyaktig de samme nøklene.
* I en mal eller et skript skriver du `tl('area.key')` eller `tl('area.key', { name })`. En melding med et antall har én nøkkel per flertallsform (`key_one`, `key_other`, og `key_few`, `key_many`, `key_two`, `key_zero` der et språk har dem) og hentes med selve nøkkelen og `count`: `tl('overview.tags_count', { count: n })`.
* Engelsk er en del av siden. Et annet språk er en egen fil, som hentes når noen velger det.
* `web/src/i18n/index.svelte.ts` holder språket; å bytte det tegner hver skjerm på nytt. Et ord som ligger i en konstant øverst i en `.ts`-fil leses én gang når filen lastes og blir ikke oversatt: skriv det som en getter (`get label() { return tl('x.y'); }`) eller behold nøkkelen og kall `tl()` der det tegnes.
* Siden setter `<html lang dir>`. CSS-en bruker logiske egenskaper (`margin-inline-start`, `inset-inline-end`, `text-align: start`), så oppsettet snur seg av seg selv for arabisk.

## Legge til eller endre et ord

1. Legg meldingen til i `en.json` og skriv den i koden med `tl()`.
2. Legg den til i hver annen språkfil, skrevet av en som leser det språket, etter den felles termbasen i codex (`work/notes/i18n/glossary/`). Korte, enkle setninger. Produkt- og protokollnavn står på engelsk.
3. Kjør `cd web && npm run check:i18n`. Den feiler når en språkfil mangler en nøkkel, har en annen `{{placeholder}}` enn engelsk eller mangler en flertallsform språket trenger; når en nøkkel ikke brukes; og når engelsk står i en mal eller i kode uten å gå gjennom `tl()`. Den kjører før hver `npm run build` og i `npm run typecheck`, så hele testpakken og utgivelsesbygget stopper på den. Engelsk som skal bli stående (et navn, et kodeeksempel) går i `web/i18n/allow.json` med begrunnelsen.

Sett `HOTLOOP_TEST_BROWSER_GALLERY` og `HOTLOOP_TEST_BROWSER_ARTIFACTS` for å beholde et skjermbilde av hver.

## Det som ikke oversettes

* Tekst serveren sender: feilmeldinger fra API-et, varslings- og alarmmeldinger, og CLI-en. Grensesnittet viser dem slik de kommer.
* Dokumentasjonen, navnene til OPC UA-serveren, MQTT-brokeren og Helm-chartets verdier.
