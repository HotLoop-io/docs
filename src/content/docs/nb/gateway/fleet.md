---
title: "Flåtestyring"
description: "Følg hvert Edge Relay gjennom Sparkplug-fødsler og -dødsfall, og send rebirth, omstart eller en ny enhetsfil uten å kjøre ut til boksen."
---

Flåtestyring, siden 4.7.0, lar Gateway holde styr på registrerte edge relays, om de lever, og, for en autorisert operatør, be ett om å gjøre rebirth, starte på nytt eller ta i bruk en nylig sendt konfigurasjon. Av som standard (`HOTLOOP_FLEET_ENABLED`): en installasjon uten edge relays har ingen broker å peke den mot.

## Hva det ikke er

Flåtestyring har sin egen, adskilte MQTT-tilkobling og svarer på et annet spørsmål: lever et *registrert* edge relay, ikke hvilken verdi ett av tagene har. Å skru den på driveren som poller tags ville enten ha tvunget en operatør til å sette opp en kompatibel Enhet bare for å se flåten, eller grave i den private bokføringen per node i den pakken, som aldri var laget for deling.

**Ikke automatisk.** At et edge relay dukker opp på brokeren gjør det ikke til medlem av flåten. Medlemskap erklæres, som en rad i `fleet_members` opprettet med `POST /api/fleet`, samme skille som denne appen allerede gjør mellom et tag en driver oppdager og et tag noen konfigurerer. En NBIRTH fra en gruppe eller node ingen har registrert logges på debug-nivå og ignoreres ellers.

## Hvordan det henger sammen

- **Tilstedeværelse**, fra NBIRTH og NDEATH. Bare utgående fra relayets side: det ringer opp brokeren, slik det alltid gjør for å publisere målinger, så dette fungerer gjennom NAT uten noen innkommende tilkobling til relayet.

Kommandoer går den andre veien over Sparkplug NCMD, og utvider det et relay allerede håndterer:

- Et ufarlig, idempotent dytt.
- **Omstart** (`Node Control/Reboot`, navnet Sparkplug-spesifikasjonen selv bruker, ikke et denne appen fant på): relayet publiserer sin egen ryddige NDEATH og avslutter; veilederen (`Restart=always` i en Quadlet-enhet, eller standard `restartPolicy: Always` i en Deployment) starter det igjen med det som ligger på disken akkurat da. Ingen ny avstengingsvei: det er samme rene utgang relayet allerede tar ved `SIGTERM`.

Fordi kommandoer går over samme MQTT-tilkobling som relayet allerede ringer ut på, trenger det heller ingen innkommende tilkobling til relayet å sende en.

Et relay som vises som online kan styres, punktum. Hvert relay abonnerer på sitt NCMD-topic, og venter på at brokeren bekrefter det, før det publiserer en fødsel, ved hver tilkobling, så "Online" ligger aldri foran "nåbar". Behandleren holder seg til samme regel på sin side: den melder seg ikke startet før NBIRTH- og NDEATH-abonnementene er bekreftet, så et relay som fødes i det øyeblikket Gateway starter, blir ikke glemt. Hvis brokerens ACL avviser abonnementet på den ene eller andre siden, nekter den siden å starte og sier det, i stedet for å gå halvdøv.

## Sending av konfigurasjon

Å sende det et relay poller går ikke over NCMD, for en Sparkplug-metrikk er ikke dimensjonert for en hel enhetsfil: det går til et **retained, vanlig MQTT-topic** per relay: `hotloop/edge-relay-config/<group>/<node>`. Retained levering er det som gjør at dette fungerer uten en egen forespørsel om å bli oppdatert: det som sist ble publisert der, leveres umiddelbart til alle klienter som abonnerer, også et relay som kobler til igjen etter å ha vært frakoblet, eller som starter for aller første gang.

Relayet validerer på nytt ved mottak: denne appen kan ikke anta at bare Gateway publiserer til det topicet, bare at den selv ikke skal publisere noe ødelagt.

**En enhetsfil kan inneholde påloggingsopplysninger, og en sending publiserer den.** `config`-blokken til en enhet har det driveren logger inn med, som OPC UA `username` og `password` (4.15.0), og filen publiseres som den er, retained. Alle som kan abonnere på `hotloop/edge-relay-config/#` kan lese den, så brokeren trenger TLS og en ACL på det topicet før en fil med påloggingsopplysninger sendes. API-et i Gateway skjuler enhetenes påloggingsopplysninger for alle roller siden 4.15.1, men en sendt fil ligger ikke bak API-et og endres ikke av det. Se [Edge Relay-referansen](/nb/edge-relay/reference/#credentials-in-the-device-file-4150) og [Autentisering og brukere](/nb/iot/authentication/#where-credentials-are-still-in-the-clear).

**En sending gjelder umiddelbart, og den starter aldri noe på nytt.** Til og med 4.17 la en sending bare filen klar, og for å få den til å gjelde trengtes en ny handling, en `POST /api/fleet/{id}/restart`, som kuttet relayets brokerøkt og hver enhetsøkt det holdt, for å endre ett tag. Nå:

- **Et relay som kjører** validerer filen, lagrer den og bruker den på stedet: nye enheter kobler til, fjernede kobler fra, endrede kobler til igjen, og hver enhet som ikke endret seg beholder økta si. Sparkplug-økta og videresendingskøen holder seg oppe hele tiden. Noden gjør rebirth med det nye metrikksettet og nullstiller først metrikkene den droppet, så en host ikke fortsetter å vise siste gode verdi fra en fjernet enhet. [Edge Relay-referansen](/nb/edge-relay/reference/#what-a-live-apply-keeps-and-what-it-changes) har nøyaktig hva som går ut på ledningen og hvorfor.
- **En fil relayet avviser** (den lar seg ikke tolke, ikke validere, ikke lagre) endrer ingenting på relayet, og relayets `/status` sier det under `config.rejected`. `GET /api/fleet` viser det for hvert medlem med en `statusUrl`, ved siden av sammendraget av filen det kjører, så "jeg sendte den" og "den kjører den" er to ting du kan sjekke, ikke én du antar. Gateway validerer også før den publiserer, så i praksis er dette et relay på en nyere eller eldre utgivelse som er uenig om reglene, eller noe annet enn Gateway som publiserer til topicet.
- **Et relay som er frakoblet** får den retained sendingen i det øyeblikket det kobler til. Ved oppstart venter det et par sekunder på den før det laster sin lokale fil, så det kommer opp med den sendte lista i stedet for å starte på den gamle og bytte.

En sendt fil havner på relayets datavolum, ikke oppå dens lokale enhetsfil, og vinner over den lokale til sendingen fjernes. [Edge Relay-referansen](/nb/edge-relay/reference/#where-a-pushed-file-lives-and-which-file-wins) har forrangsreglene og 4.16.0-feilen som gjorde dem nødvendige.

**Å ta en sending tilbake** er `DELETE /api/fleet/{id}/config` (`fleet.config`, samme som å sende). Den publiserer en tom retained melding til medlemmets konfigurasjonstopic, som er måten MQTT sletter en retained verdi på, så ingen senere oppstart bruker sendingen. Et relay som er tilkoblet da, slipper den sendte filen og går tilbake til sin lokale live, på samme måte som en sending gjelder, med mindre den lokale filen ikke lastes, og da beholder det den sendte og sier det. Et relay som var frakoblet hører aldri slettingen (en tom melding beholdes ikke), så send den på nytt når relayet er tilbake.

## Hva hvert relay kjører, og oppdateringer

Hvert relay legger versjonen sin og sammendraget av imaget i hver fødsel, og det gjør også en Edge eller en Gateway med edge-publisering på, så en boks registrert her som medlem viser det samme (strengmetrikker som heter `Node Info/Version` og `Node Info/ImageDigest`, uten alias, så en Sparkplug-host som ikke kjenner dem ignorerer dem). `GET /api/fleet` viser dem som `release` på hvert medlem: `version`, `imageDigest` og `since`, da Gateway først hørte den utgaven. Et relay fra før dette rapporterer ingen, og Gateway sier ingenting om det i stedet for å finne opp en "ukjent utgave".

Når et medlems utgave endres, skriver Gateway det til systemloggen som en `config`-hendelse på det medlemmet, med gammel og ny versjon og sammendrag i detaljene (`{"kind":"fleet.release",...}`). Den første utgaven den noen gang hører logges også, som utgangspunktet det neste måles mot. Det overlever en omstart av Gateway, fordi den siste posten leses tilbake fra loggen: en omstart finner aldri opp en oppdatering. Dette er revisjonssporet for hver oppdatering et relay tar, uansett vei (Podmans tidtaker, en godkjenning, `helm upgrade`, noen på boksen), fordi Gateway ikke forårsaker en oppdatering og bare kan rapportere den. En flyttbar tag er måten `:stable` oppdateres på, så et endret sammendrag under samme versjon logges også, som "et annet image av samme versjon".

`POST /api/fleet/{id}/update` (`fleet.update`, bare administrator) godkjenner oppdateringen et relay holder tilbake. Den gjør bare noe med et relay som er satt til å holde tilbake oppdateringer; ethvert annet relay logger at det ignorerte den. Forespørselen nevner ikke noe image. Hva dette gjør og ikke gjør for hver installasjonstype står i [Edge Relay-referansen](/nb/edge-relay/reference/#updating-a-relay).

## Kommandoautorisasjon

To lag, med vilje ikke ett:

- **I API-et** trenger en operatør `fleet.rebirth` for å be om et rebirth; omstart, godkjenning av en oppdatering eller sending av en konfigurasjon trenger hver sin `fleet.restart`, `fleet.update` eller `fleet.config`, gitt bare til administrator. En omstart forstyrrer en pågående pollingsyklus mer enn et rebirth-dytt, og å sende det et relay poller behandles på samme måte, den samme innsnevringen som `alarms.ack` og `automations.trigger` allerede modellerer for andre "gjør det nå"-handlinger.
- **På brokeren** kan ikke denne appen håndheve noe: NCMD-publisering og konfigurasjonstopicet må begge begrenses av brokerens egne ACL-er til Gateways egne MQTT-påloggingsopplysninger. Uten det kan alle som når brokeren og kjenner gruppen og noden til et relay, publisere samme kommando eller konfigurasjon som denne funksjonen. Sett det opp ved utrulling; det er ikke valgfritt bare fordi det ligger utenfor denne appens egen kode.

## API

| Rute | Tillatelse | <span class="sr-only">Detaljer</span> |
|---|---|---|
| `GET /api/fleet` | `fleet.read` | Hvert registrerte medlem, med levende tilstedeværelse og, der det er konfigurert, en pollet `/status` |
| `POST /api/fleet` | `fleet.write` | Oppretter eller oppdaterer et medlem (en body med en eksisterende `id` oppdaterer det) |
| `DELETE /api/fleet/{id}` | `fleet.write` | Fjerner et registrert medlem |
| `POST /api/fleet/{id}/rebirth` | `fleet.rebirth` | Publiserer `Node Control/Rebirth` |
| `POST /api/fleet/{id}/restart` | `fleet.restart` | Publiserer `Node Control/Reboot` |
| `POST /api/fleet/{id}/update` | `fleet.update` | Godkjenner imageoppdateringen et relay holder tilbake (gjør ingenting med et som ikke gjør det) |
| `POST /api/fleet/{id}/config` | `fleet.config` | Sender en ny enhetsfil (rå JSON-body, validert før publisering); et relay som kjører bruker den live |
| `DELETE /api/fleet/{id}/config` | `fleet.config` | Fjerner sendingen, så relayet går tilbake til sin lokale enhetsfil, live hvis det er tilkoblet |

## Konfigurasjon

| Variabel | Standard | <span class="sr-only">Detaljer</span> |
|---|---|---|
| `HOTLOOP_FLEET_ENABLED` | `false` | Funksjonen er av til dette er satt |
| `HOTLOOP_FLEET_BROKER` | n/a | Påkrevd når aktivert. En ren host, `host:port` eller en full URL |
| `HOTLOOP_FLEET_USER` / `_PASSWORD` | n/a | Påloggingsopplysninger til brokeren |
| `HOTLOOP_FLEET_TLS` | `false` | |
| `HOTLOOP_FLEET_TLS_SKIP_VERIFY` | `false` | Opt-in per utrulling; sett aldri dette som standard |

## Hva som er verifisert og hva som ikke er det

HotLoop er kjørt mot ekte utstyr og ekte servere, og på fysisk maskinvare 2026-11-17.
