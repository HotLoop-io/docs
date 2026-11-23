---
title: "Utgivelsesnotater: HotLoop Flow 2.2.0"
description: "Hva HotLoop Flow 2.2.0 gir deg, hva som endres ved oppgradering og hva du bør lese før du rører et anlegg i drift."
sidebar:
  label: "2.2.0"
---

HotLoop Flow 2.2.0 er utgivelsen der Flow snakker med PLS-ene, husker hva den visste da den startet på nytt, og viser deg hvor en melding gikk. Det er også den første utgivelsen under HotLoops Business Source License, og jeg setter det først fordi det er delen du må lese.

## Lisensen er endret

2.2.0 og hver utgivelse etter den er under HotLoops Business Source License 1.1, samme lisens som resten av HotLoop. Det er ikke en åpen kildekode-lisens, og jeg skal ikke late som det. Kildekoden til Flow er fortsatt offentlig, så du kan lese hver linje du kjører.

- Bruk hjemme og i laboratorium er gratis.
- Akkrediterte skoler og utdanningsinstitusjoner, ideelle organisasjoner og offentlige organer bruker den gratis til sin egen drift og sitt oppdrag.
- Forretningsbruk er gratis når den går gjennom [EmberNet](https://embernet.ai). Det er den eneste forretningsveien.
- Å drifte Flow som en tjeneste, videreselge den og bygge den inn i et produkt du selger er ikke tillatt.
- Hver versjon går over til GPL-3.0 eller nyere fire år etter at den først ble offentliggjort.

`LICENSE` er den juridiske teksten, byte for byte den samme som i HotLoop-io/HotLoop-io. 2.1.0 og alt før den forblir under lisensen de ble levert med. Ingenting endres for de utgivelsene. De portede Node-RED-filene beholder sine opprinnelige lisensoverskrifter og kreditteringer, så lisensteksten deres følger nå med i `LICENSES/` ved siden av `NOTICE`, og imaget har begge i `/usr/share/doc/hotloop-flow/`. `NOTICE` dekker også den patchede kopien av gos7 som Flow har med nå (nedenfor).

## Nytt

**Sporing og avspilling**
- Hver melding får et avgrenset spor. Klikk på en feilsøkingsmelding, og editoren lyser opp veien den tok, med tid og nyttelast ved hvert hopp, gjennom splitter, joiner og underflyter.
- Et spor blir en flyttest, eller spilles av i et utkast slik at du kan prøve en rettelse på meldingen som ødela det.
- Hvert hopp kan gå til en OpenTelemetry-collector som en span (`trace.otlp.endpoint`).

**Tilstand som overlever en omstart**
- Flyt-, global og nodekontekst ligger i en SQLite-fil, `state.db`, på datavolumet. En omstart sletter dem ikke lenger.
- Varige forbindelser. Merk en forbindelse som varig, og så lenge noden i andre enden henger med, er den en vanlig forbindelse og skriver ingenting. Når noden slutter å ta imot meldinger, renner forbindelsen over til samme fil i rekkefølge og tømmes når målet kommer tilbake. Vi beviste det mot en ekte InfluxDB som var nede i ti minutter, med kjøretiden drept med `kill -9` midt i avbruddet og midt i tømmingen: ingen mangler, ingen er doblet.

**Anleggsnoder**
- Modbus TCP lesing og skriving, OPC UA lesing, skriving og abonnement, S7 lesing og skriving, EtherNet/IP lesing og skriving, og Sparkplug B som kantnode og som vert. Flow kan nå snakke med det `scan` finner.
- Sparkplug gjør fødslene, testamentet, `bdSeq`, rebirth-forespørsler og kommandoer slik spesifikasjonen ber om. Vi kontrollerte den mot en uavhengig Sparkplug-implementasjon i begge retninger, kantnode og vert.
- En stille enhet får forespørselen til å feile innen tidsavbruddet, og neste melding kobler til på nytt. Et OPC UA-abonnement merker at det falt ut, sier fra én gang og tar seg selv opp igjen.

**Editoren**
- Kopier og lim inn, import og eksport av et utvalg, underflyter med eget lerret, nestede grupper, søk på tvers av alle flyter, feilsøkingsfiltre, Alt-klikk for å slette en forbindelse. En nettlesertest klikker gjennom hver nodedialog fra listen kjøretiden serverer, så en ny node er dekket samme dag den kommer.
- Å dra en forbindelse til en node fungerte aldri i Chromium. Nå gjør det det.

**Kontroller**
- En node der konfigurasjonsnoden ikke er i filen (en slettet broker som en underflyt fortsatt nevner, eller en referanse til en fane eller feil type konfigurasjonsnode) rapporteres ved import, innlasting og distribusjon, og den starter ikke. Før virket den bare aldri.
- Å slette en flyt eller en node tar id-en ut av Catch-, Status- og Complete-omfangene som nevnte den.

## Hva som er endret

- Konteksten består som standard. `store.context.persist` er på, så en verdi satt før en omstart finnes etter den, mens hver omstart før startet tomt. En flyt som regnet med tom kontekst ved oppstart må nå selv tømme det den forventer tomt. Sett `persist` til `false` for den gamle oppførselen.
- Sporing er på som standard og avgrenset på alle måter: 256 forløp, 512 hopp hver, 16 MiB til sammen, 1000 nye forløp i sekundet. Det ligger bare i minnet, så en omstart starter listen på nytt. `trace.enabled: false` slår det av.
- gos7 skrev en rålinje til Gos globale logger ved hvert S7-tidsavbrudd, og ingenting på noden kunne slå det av.
- Den varige køen teller en melding som ventende etter at den er på disk, ikke før.
- Imaget bygges og pushes med Podman, ikke Docker. Samme image, samme tagger (`2.2.0`, `2.2`, `2`), fortsatt linux/amd64 og linux/arm64.

## Oppgraderingsnotater

Fra 2.1.0 er det et enkelt bytte av image (`helm upgrade`, eller den nye taggen i Quadlet-enheten din). Ingen migrering, ingen flagg. En `flows.json` og en konfigurasjonsfil som kjørte på 2.1.0 kjører på 2.2.0, og rundturen byte for byte for flytfilen er urørt.

- Første oppstart lager `state.db` i `data.dir`, på volumet. Med `persistence.enabled` satt til false i charten overlever den en omstart av containeren, men ikke utskifting av poden.
- Å gå tilbake til 2.1.0 lar `state.db` ligge. 2.1.0 har ingen kode som leser den.
- Hver skriving til `state.db` er en skriving til et SD-kort eller en SSD, så standardverdiene samler opp. Kontekstendringer venter `flushInterval` (30 sekunder) og skrives sammen, og en verdi som settes til det den allerede var skriver ingenting. En `kill -9` kan miste så mye. `docs/durable/README.md` har tallene og hva det koster et kort.

## Nye innstillinger

| YAML | Miljø | Standard |
|---|---|---|
| `store.path` | `HOTLOOP_FLOW_STORE_PATH` | tom, som betyr `state.db` i `data.dir` |
| `store.synchronous` | `HOTLOOP_FLOW_STORE_SYNCHRONOUS` | `normal`. `full` gjør fsync ved hver commit og sliter ut kortet for det. |
| `store.context.persist` | `HOTLOOP_FLOW_CONTEXT_PERSIST` | `true` |
| `store.context.flushInterval` | `HOTLOOP_FLOW_CONTEXT_FLUSH_INTERVAL` | `30s`. `0s` skriver hver endring før flyten går videre. |
| `store.durable.maxBytes` | `HOTLOOP_FLOW_DURABLE_MAX_BYTES` | 256 MiB for alle varige forbindelser til sammen |
| `store.durable.ackFlush` | `HOTLOOP_FLOW_DURABLE_ACK_FLUSH` | `100ms`. `0s` merker hver melding før den neste sendes. |
| `trace.enabled`, `trace.traces`, `trace.maxHops`, `trace.maxMessageBytes`, `trace.maxBytes`, `trace.perSecond` | | `true`, 256, 512, 16384, 16 MiB, 1000. `perSecond: 0` sporer hver melding. |
| `trace.otlp.endpoint`, `trace.otlp.serviceName`, `trace.otlp.interval` | `HOTLOOP_FLOW_TRACE_OTLP_ENDPOINT` | tom (ingen eksport), `hotloop-flow`, `2s` |
| `trace.otlp.headersSecret` (chart) | `HOTLOOP_FLOW_TRACE_OTLP_HEADERS` | ingen. En Secret-nøkkel med `Name=value`-par atskilt med komma, for API-nøkkelen til en vertsbasert collector. |

Charten har alt dette under `store` og `trace` i `values.yaml`.

Image: `ghcr.io/hotloop-io/hotloop-flow:2.2.0`, linux/amd64 og linux/arm64. Chart: `https://hotloop.io/hotloop-flow/`. README-en på denne taggen har resten: https://github.com/HotLoop-io/hotloop-flow/blob/v2.2.0/README.md
