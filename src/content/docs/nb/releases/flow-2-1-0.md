---
title: "Utgivelsesnotater: HotLoop Flow 2.1.0"
description: "Hva HotLoop Flow 2.1.0 gir deg, hva som endres ved oppgradering og hva du bør lese før du rører et anlegg i drift."
sidebar:
  label: "2.1.0"
---

HotLoop Flow 2.1.0 er fase 0 til 2 av [veikartet](/nb/flow/roadmap/) pluss de hverdagslige hullene som hindret folk i å ta i bruk en ekte flyt. Hver distribusjon er nå en post du kan sammenligne, teste, gå gjennom og rulle tilbake til. En flyt kan ha tester som kjører før en dårlig distribusjon skjer. Et lagringstrykk starter nodene du endret på nytt og lar resten av anlegget være i fred.

Ingenting i denne utgivelsen endrer hvordan en flytfil leses eller skrives. Rundturen byte for byte er urørt, så en `flows.json` som kjørte på 2.0.5 kjører på 2.1.0.

## Nytt

**Distribusjoner**
- Hver distribusjon er en post: hvem, hvorfra, når, notatet, revisjonen den erstattet, flytfilen byte for byte og påloggingsopplysningene kryptert slik de var. `GET /deployments` leser dem. `history.retain` beholder de siste 100 som standard.
- En diff som leses som en gjennomgang: node for node, egenskap for egenskap, oppsett atskilt fra logikk, og påloggingsopplysninger vises aldri. I API-et, på kommandolinjen (`hotloop-flow diff`) og som gits egen diff-driver.
- Tilbakerulling legger en gammel post tilbake som en ny distribusjon, flyter og påloggingsopplysninger sammen, slik at en slettet node kommer tilbake med meglerpassordet sitt.
- Delvis distribusjon: en lagring starter nodene som ble endret på nytt. MQTT-økter, lyttere og Delay-køer på alt annet fortsetter å kjøre. `HotLoop-Flow-Deployment-Type` (eller Node-REDs header) velger noder, flyter eller full.
- Editoren går gjennom endringene før den distribuerer, med diffen tegnet på lerretet og et notat, og viser historikken med en tilbakerullingsknapp.
- Flyter som kode: `hotloop-flow deploy` skriver ut diffen mot det som kjører og distribuerer mot revisjonen den kom fra, så et kappløp blir en rød pipeline. `hotloop-flow export` gir tilbake den kjørende filen byte for byte. `hotloop-flow token` lager et API-token og hashen du må konfigurere for det.
- Valgfritt git-speil: med `history.git` satt er hver distribusjon en commit med den som distribuerte som forfatter.

**Tester**
- Flyttester: `flows.test.yaml` ved siden av `flows.json`, kjørt av `hotloop-flow test` (JUnit med `-junit`) på den ekte kjøretiden og de ekte nodene. Delay, Trigger, Inject, Join og Batch kjører på en klokke testen flytter, så fem minutter med Delay er ett steg. Alt som snakker med omverdenen, MQTT, HTTP, PostgreSQL, InfluxDB, TCP, UDP, WebSocket, filer, exec, erstattes, og testen sjekker hva som ville ha gått ut.
- Distribusjonsporten: slå på `tests.gate`, så gir en distribusjon der flytene feiler testsuiten en 422 med hele rapporten. Tilbakerullinger går ikke gjennom porten, fordi en tilbakerulling er veien ut.
- Editoren lager en test av en feilsøkingsmelding og kjører den.

**Noder og protokoller**
- JSONata, bevist mot den publiserte jsonata-js 2.2.2-suiten: 1673 av 1686 tilfeller består, og de 13 som ikke gjør det er festet med navn og årsak.
- Inject utløses på en crontab, i samme minutt som Node-RED ville gjort det, med tidsendringer i seks soner kontrollert.
- MQTT 5 (egenskaper, abonnementsvalg, øktutløp) og testamentet (last will). MQTT 3.1.1 fungerer fortsatt.
- TLS på TCP, HTTP-forespørsel og MQTT gjennom en `tls-config`-node. WebSocket-lytteren og klienten starter, og klienten bruker TLS.
- Informasjonskapsler og multipart på HTTP, kontrollert mot bibliotekene Node-RED bruker.
- Split, Join og Batch fungerer som Node-REDs: strømming, tidsavbrudd, reduksjon, intervaller. Link Call og returmodusen til Link Out.
- Et passord kan ligge i en montert Secret i stedet for i flyten. Helm-charten får `secrets.mounts`.

**Pålogging**
- Tofaktorpålogging (TOTP), gratis, for alle som slår det på fra editoren.
- Utestengelser, økter som overlever en omstart og en revisjonslogg over hvem som gjorde hva og hvorfra (`GET /audit`, `audit.read`).

## Hva som er endret

- Utestengelse er på som standard: 5 feil for én konto fra én adresse, eller 20 fra én adresse, låser den i 15 minutter med en 429. `auth.lockout` endrer tallene.
- Økter lagres i `data/sessions.json` som hasher og følger konfigurasjonen ved hver forespørsel, så å ta en tillatelse eller en bruker ut av konfigurasjonen virker ved neste forespørsel.
- En tilbakerulling er en full omstart med mindre du ber om mindre.
- Imaget har med `LICENSE`, `NOTICE` og `THIRD_PARTY_LICENSES` i `/usr/share/doc/hotloop-flow/`. `THIRD_PARTY_LICENSES` lister hver Go-modul og npm-pakke i binærfilen med versjon og lisenstekst, generert ved bygging. Byggingen feiler på en GPL-, AGPL- eller LGPL-avhengighet eller en ingen kan identifisere.
- `NOTICE` var feil. Den sa at ingen Node-RED-kode var med her. Cron, Split, Join, Batch, Link Call, tls-config og HTTP-arbeidet med informasjonskapsler og multipart er portinger, og den lister nå hver portet fil med hvor den kom fra, hvem som har opphavsretten og lisensen, med full ISC-tekst for cronosjs og MIT-teksten for resten. Hver portet fil sier det samme øverst.
- En avvist distribusjon fjerner ikke lenger påloggingsopplysninger i minnet, og dobbeltklikk på en node i Chromium åpner dialogen. Begge ble funnet under arbeidet med dette.

## Oppgraderingsnotater

Fra 2.0.5 er det en enkel bytte av image (`helm upgrade`, eller den nye taggen i Quadlet-enheten din). Ingen migrering, ingen flagg.

- Første oppstart lager `sessions.json`, `audit.log` og en `deployments`-mappe under `data.dir`. Økter lå i minnet før, så alle logger inn én gang etter oppgraderingen.
- Alt nytt i konfigurasjonen er valgfritt og av eller ufarlig som standard. Ingenting du har slutter å virke.
- WebSocket-tokener: editoren sender nå tokenet sitt som en underprotokoll, `hotloop-flow.bearer.<token>`, tilbudt ved siden av `hotloop-flow`. Det er den foretrukne måten for alt som kobler til `/comms`. Et skript som sender `?access_token=` i URL-en fungerer fortsatt, og serveren logger en advarsel for hver slik tilkobling om at tokenet lekker inn i proxy- og tilgangslogger og hva som bør sendes i stedet. Selve URL-en skrives aldri til Flows logg eller revisjonssporet. Fjerning av URL-formen venter til en fremtidig hovedversjon.

## Nye innstillinger

| YAML | Miljø | Standard |
|---|---|---|
| `tests.gate` | `HOTLOOP_FLOW_TESTS_GATE` | `false`. `true` avviser en distribusjon der flytene feiler `flows.test.yaml`. |
| `tests.timeout` | | `2m`, veggklokketiden for én kjøring av testene. En kjøring som ikke rekker å bli ferdig avviser distribusjonen. |
| `secrets.allowedPaths` | `HOTLOOP_FLOW_SECRET_ALLOWED_PATHS` | tom. Ekstra trær en `tls-config` eller en påloggingsfil kan leses fra, i tillegg til `data.dir`. Ikke filnodenes omfang: en File In-node kan fortsatt ikke lese dem. |
| `secrets.mounts` (chart) | | tom. Kubernetes-Secrets montert skrivebeskyttet, hver lagt til i hemmelighetsomfanget. |
| `auth.tokens` | `HOTLOOP_FLOW_DEPLOY_TOKEN_HASH` | ingen. API-tokener for maskiner, lagret som hasher. Miljøvariabelen lager et `deploy`-token som kan lese og distribuere og ikke noe mer. Lag ett med `hotloop-flow token`. |
| `auth.lockout` | | `attempts: 5`, `perAddress: 20`, `window: 15m`, `duration: 15m` |
| `history.retain` | | `100`. `0` beholder alle poster. |
| `history.git` | `HOTLOOP_FLOW_GIT_URL`, `HOTLOOP_FLOW_GIT_USERNAME`, `HOTLOOP_FLOW_GIT_PASSWORD` | av. |
| `audit.maxBytes`, `audit.keep` | | 16 MiB, 4 filer. |

Image: `ghcr.io/hotloop-io/hotloop-flow:2.1.0`, linux/amd64 og linux/arm64. Chart: `https://hotloop.io/hotloop-flow/`. README-en på denne taggen har resten: https://github.com/HotLoop-io/hotloop-flow/blob/v2.1.0/README.md
