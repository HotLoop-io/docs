---
title: "Utgivelsesnotater: HotLoop core 4.16.0"
description: "Hva HotLoop core 4.16.0 gir deg, hva som endrer seg ved oppgradering og hva du bør lese før du rører et anlegg i drift."
sidebar:
  label: "4.16.0"
---

Den første utgitte versjonen siden 4.3.1 i august. Alt fra 4.4.0 til 4.15.3 ble slått sammen, men aldri utgitt, så står du på 4.3.1, får du alt på én gang, med nytt navn, nytt image, nytt chart og ny lisens. **Fra 4.3.1 er det ikke en vanlig `helm upgrade`.** Les «Oppgradere fra 4.3.1» lenger ned før du rører et anlegg i drift.

De fullstendige notatene står i README: Hva som er nytt i 4.16.0, og under den hver versjon helt tilbake til 4.4.0.

## Kort fortalt

- **HotLoop Core: entiteter.** Hver tag er en entitet med en stabil id, plassert i et ISA-95-utstyrstre. Motorer, ventiler, PID-sløyfer og resten er sammensatt av taggene sine, hver alarm er en entitet, og hver entitetskommando går gjennom den samme skriveporten som en tag-skriving. Agenter (MCP), automasjoner og de nye skjermene Entities og Plant bruker dem alle. Et tjenestekall kan spørres på forhånd med `?dry_run=true`, og kommandoprompten sier «Would be refused: ...» før du bekrefter.
- **Varsler som når telefonen:** ntfy og Discord-boten med en Acknowledge-knapp, Gotify og en Discord-webhook, med hastighetsgrenser som slår en flom sammen til én oppsummering.
- **Rettinger som betyr noe i et anlegg i drift:** å oppheve utsettelse (unshelve) kunne slette en ukvittert alarm; et OPC UA-abonnement kunne bli stille for alltid mens sesjonen sa tilkoblet; en taus Modbus-enhet brukte opptil 15 minutter på å bli regnet som nede; en mislykket webhook logget URL-en sin, som for Discord og ntfy er passordet; gjenopprettingen leste kolonner etter posisjon; hver omdistribusjon byttet ut sertifikatet til OPC UA-serveren, så Ignition sluttet å stole på det; Discover tags importerte hver OPC UA-node som float; skjermen Settings nevnte pollingvariabler som ingenting leser.
- **Ignition 8.3.9 leser OPC UA-serveren vår**, verifisert fra ende til ende, og serveren oppgir nå `HotLoop` som produsent.
- **Edge Relay kommer** med eget image og eget chart, i takt med Gateway. TimescaleDB 2.30.1, og utvidelsen oppdaterer seg selv nå.

### API-endringer

- Tomme lister er `[]`, aldri `null`, overalt, også i strømmer.
- `/api/history`-intervaller uten en god måling er `null` (et hull), og dårlige målinger holdes utenfor gjennomsnittene.
- En feil API-et ikke kan plassere, er en 500 med en loggreferanse, ikke en 400. En enhet som feiler på skriving eller bla gjennom, gir en 502.
- En tjeneste en alarmentitet ikke tar imot (`alarm.turn_on`), er en 400. Før svarte den vellykket og gjorde ingenting.
- Å oppheve utsettelsen av en alarm som ikke er utsatt, er en 409.
- Tag-JSON har alltid `minValue`, `maxValue` og `hasRange`.
- Nytt: `?dry_run=true` på `POST /api/services/{domain}/{service}`. Bare `true` eller `false`; alt annet er en 400.

### Oppgradere fra 4.3.1

- Image `ghcr.io/hotloop-io/hotloop` (tidligere `ghcr.io/embernet-ai/industrial-iot`), chart-repository `https://hotloop.io/hotloop`, chart `hotloop` (tidligere `industrial-iot`), og hver `IIOT_`-variabel heter nå `HOTLOOP_`.
- Chart-navnet står i workload-selektorene, som Kubernetes ikke endrer på stedet. Behold release-navnet og namespace, og gjør så dette: ta `pg_dump` av databasen; slett den gamle Deployment (`<release>`) og StatefulSet (`<release>-postgresql`), som lar databasevolumet bli der det er; kjør `helm upgrade <release> hotloop/hotloop -f your-4.3.1-values.yaml`. Ikke `--reuse-values`. Gi nytt navn til hver `IIOT_` i `extraEnv` og fjern en overstyring av `image.repository`. Den nye database-poden monterer det gamle volumet, og Gateway migrerer det fremover ved oppstart.
- Lisens: HotLoops egne lisensvilkår, ikke dem 4.3.1 kom med. Gratis for hjem og laboratorium; bedrifter registrerer seg gratis gjennom EmberNet. De gjeldende vilkårene står i LICENSE.
- Det finnes en innlogging, skriving er av som standard, og en tidssone som ikke lar seg laste, stopper oppstarten i stedet for å gå videre på UTC.
