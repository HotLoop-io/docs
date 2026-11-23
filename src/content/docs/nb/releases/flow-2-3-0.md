---
title: "Utgivelsesnotater: HotLoop Flow 2.3.0"
description: "Hva HotLoop Flow 2.3.0 gir deg, hva som endres ved oppgradering og hva du bør lese før du rører et anlegg i drift."
sidebar:
  label: "2.3.0"
---

HotLoop Flow 2.3.0 er utgivelsen der Flow når resten av anlegget på tre nye måter og fanger en melding med feil form før den gjør skade. Den snakker med HotLoop, en agent kan kalle en flyt som et verktøy over MCP, og en plugin er en signert WebAssembly-fil og ikke en npm-pakke. JSON Schema sjekker nå meldinger på `json`-noden, på portene til en node og på forbindelsene i editoren. Én endring kan påvirke en flyt som allerede kjører, og den står først under Hva som er endret.

## Nytt

**HotLoop-noder**
- En `hotloop-flow-hotloop`-tilkobling, som er en URL og en konto. Den logger inn med `POST /api/auth/login`, sender bearer-tokenet HotLoop gir tilbake, og logger inn på nytt når HotLoop sier at økten er borte. En operatørkonto er nok til alt nedenfor.
- `hotloop in` følger HotLoops direktestrøm og sender en melding for hver enhet som endrer tilstand: `msg.topic` er enhets-id-en, `msg.payload` er den nye tilstanden, og `msg.hotloop` bærer tilstanden den hadde før, attributtene, kvaliteten og tidsstemplene. Hvis lenken faller, blir merket rødt og én feil når en Catch-node for avbruddet, ikke én per nytt forsøk. Når den kommer tilbake, sendes en enhet som endret seg i mellomtiden, og en som ikke gjorde det, sendes ikke.
- `hotloop state` leser én enhet når en melding kommer. `hotloop script` kjører et HotLoop-skript med feltene du gir det. `hotloop recipe` bruker en oppskrift med parameterne sine, og en eldre versjon hvis du ber om den med vilje. HotLoop sjekker hvert felt og hver parameter, sender hver skriving gjennom skriveporten sin og beholder loggen. Flow sender årsaken `flow:<node id>`, og HotLoop registrerer den i skriverevisjonen og loggboken sin.
- Et avvist eller mislykket kall når en Catch-node med HotLoops egne ord og statusen sin. Ingenting som ble skrevet blir angret, for det er også HotLoops regel.

**Skrivinger gjennom HotLoops port**
- `modbus write`, `opcua write`, `s7 write` og `ethernetip write` har to nye felt, **Skriv gjennom HotLoop** og **HotLoop-tag** (`device/tag`). Med en HotLoop valgt går verdien til HotLoops skriveport, som avgjør i denne rekkefølgen: skriving slått på, taggen armert, verdien innenfor området.
- En skriving porten avviser når aldri utstyret. En HotLoop som ikke kan nås, får også skrivingen til å feile. Den faller aldri tilbake til å skrive direkte, for det ville vært en skriving porten aldri så.
- HotLoops egen adresse, datatype og skala for taggen gjelder, så adressen og datatypen på Flow-noden brukes ikke. Å fjerne HotLoop setter noden tilbake akkurat som den var. Porten tar én bool, ett tall eller én tekst per skriving, så en liste med registre avvises med en melding som sier det.

**MCP, i begge retninger**
- `mcp tool` og `mcp result` serverer en flyt som et verktøy. Verktøynoden deklarerer et navn, en beskrivelse og et inndataskjema, Flow serverer det på `/mcp`, og resultatnoden sender flytens svar tilbake. En agent logger inn med en økt eller et API-token som alle andre, kallet kjører med tokenets tillatelser, og hvert kall og hver avvisning havner i revisjonsloggen under kallerens navn. Ingen token, ingen kall.
- `mcp client`, på en `hotloop-flow-mcp-server`-tilkobling, kaller et verktøy på en hvilken som helst MCP-server, også HotLoops egen, og bruker det som kommer tilbake. Den sender aldri et kall to ganger, for et verktøy kan flytte utstyr, og en brutt forbindelse sier ikke om det ble kjørt.
- Et API-token i `auth.tokens` kan ha en `rateLimit` med `calls` og et vindu, ett minutt hvis du utelater det. Et kall over grensen når aldri flyten, kommer tilbake som en verktøyfeil som sier når du kan prøve igjen, og skriver en `mcp.refused`-rad med årsaken. Et token uten `rateLimit` blir aldri strupet.
- Den snakker gjeldende revisjon av spesifikasjonen, 2026-07-28, og håndtrykksrevisjonene tilbake til 2025-11-25, på samme endepunkt. En flyt som ikke bruker noen av disse nodene gjør aldri et MCP-kall, og Flow serverer ikke noe verktøy den ikke har fått.

**Plugins uten npm**
- En plugin er en WebAssembly-modul, en deskriptor editoren tegner dialogen sin fra, og en ed25519-signatur over begge. Usignerte og manipulerte plugins nekter å laste og sier hvorfor. `hotloop-flow plugin keygen` lager en nøkkel, og `docs/plugins.md` har resten.
- En gjest som går over minnegrensen eller tidsavbruddet sitt, havner i en felle mot en Catch-node mens alt annet fortsetter å kjøre. En plugin som ber om vertstilgang operatøren ikke har gitt (`clock`, `random`, `context.flow`, `context.global`), får distribusjonen av hver flyt som bruker den til å feile, før en eneste byte er skrevet.
- Uten klarerte nøkler avvises alle plugins, og uten tillatelser feiler alle plugins som ber om vertstilgang. Ingenting lastes som standard.
- Charten tar alt under `plugins`, med et volum som godtar enhver Kubernetes-volumkilde. Av gir ingenting, og en `helm template` av standardverdiene er det den var.

**Typede ledninger**
- Gi `json`-noden et JSON Schema i innstillingene, så sjekkes hver verdi den håndterer mot det. En verdi som ikke stemmer går til en Catch-node i stedet for nedover forbindelsen, og feilen nevner hvert feil felt, som `payload.temp: got string, want number`. Uten skjema i innstillingene validerer noden mot `msg.schema`, slik Node-REDs `json`-node gjør. Det er utkast 2020-12 med mindre skjemaet nevner et annet, og en `$ref` til en annen URL eller en fil avvises, ikke hentes.
- En node kan deklarere hva den godtar og hva hver utgang lover, i to nøkler i flytfilen som alle andre verktøy ignorerer, så en flyt som har dem fortsatt gjør rundturen byte for byte. Når begge ender av en forbindelse deklarerer et skjema og ingen melding kan tilfredsstille begge, avvises distribusjonen før en eneste byte er skrevet. Avvikene Flow ikke kan se på forhånd stopper der de bryter skjemaet, går til Catch med stien til hvert feil felt og telles i `hotloop_flow_node_schema_mismatches_total`.
- En `inject` som setter en literal neste node aldri kan ta imot, som tallet 250 inn i en node som tar 0 til 100, avvises ved distribusjon på samme måte. Tidsstempler, `env`, kontekst og JSONata hoppes over, aldri gjettet.
- Editoren skriver avsenderens type på hver forbindelse. Den er dempet når bare én ende har en type og rød når de to aldri kan bli enige, og det røde kommer fra kjøretidens egen sjekk, så lerretet og distribusjonen kan ikke være uenige. **Typer**-delen i dialogen til en node er der du setter dem.

Det er ni nodetyper til, 79 til sammen: fem for HotLoop med tilkoblingen, og fire for MCP med tilkoblingen.

## Hva som er endret

- `json`-noden pleide å ignorere `msg.schema`. Nå valideres en melding som bærer `msg.schema` mot det, og hvis den ikke stemmer, går den til en Catch-node og ikke nedover forbindelsen. En flyt som tilfeldigvis lar en `msg.schema` ligge igjen på meldingene sine av en annen grunn, vil merke det.
- En distribusjon kan nå avvises på grunn av en typefeil (`deploy.refused`, årsak `typed wires`), men bare for en flyt som deklarerer skjemaer på portene sine eller setter en `inject`-literal inn i en node som deklarerer ett. En flyt uten skjemaer noe sted oppfører seg akkurat som før.
- Skrivenodene har de to nye feltene, tomme som standard. Uten en HotLoop valgt oppfører en skrivenode seg som i 2.2.0.
- Skjemavalidatoren er `santhosh-tekuri/jsonschema` v6 (permissivt lisensiert) og MCP er Go-SDK-en `modelcontextprotocol/go-sdk` v1.8.0. Begge er nye Go-moduler, så lisensteksten imaget har med i `/usr/share/doc/hotloop-flow/` har flere oppføringer. WebAssembly-kjøretiden var allerede i 2.2.0.
- Tre rettelser av den varige køen. En fjernet varig forbindelse avviser nå en sen skriving og teller den som forkastet, og å fjerne en venter ikke lenger hele lukketidsavbruddet på et mål som står fast i en melding. Før ble en melding som ble levert tilbake etter at forbindelsen var borte, værende belastet kvoten til en omstart. En forbindelse som forkaster eldste, kaster ikke lenger ut en melding som allerede var bekreftet eller som pumpen nettopp hadde lest, noe som ga tilbake samme plass to ganger og lot køens dybde og kvoten ligge under det som var på disk. Teksten om den varige kvoten i `docs/durable/README.md` sier nå at en omdirigert melding kan sette kvoten noen få meldinger over for et øyeblikk.
- README-en og `docs/bench/` har med resultatene fra Raspberry Pi 5, og veikartet krysser av Pi 5 og lar Pi 4, Zero 2 W og skrivingene til SD-kortet stå åpne.

## Oppgraderingsnotater

Fra 2.2.0 er det et enkelt bytte av image (`helm upgrade`, eller den nye taggen i Quadlet-enheten din). Ingen migrering, ingen flagg, ingenting nytt ved første oppstart. En `flows.json` og en konfigurasjonsfil som kjørte på 2.2.0 kjører på 2.3.0, og rundturen byte for byte for flytfilen er urørt.

- Å gå tilbake til 2.2.0 er trygt for enhver flyt som ikke bruker de nye nodene eller nøklene. En HotLoop-, MCP- eller plugin-node starter ikke på 2.2.0 (ukjent nodetype), og en skrivenode med en HotLoop valgt skriver rett til utstyret der, fordi 2.2.0 ikke leser feltet. Ta HotLoop av disse skrivenodene før du går tilbake.
- HotLoop registrerer kontoen Flow logger inn som. API-et gir ikke en klient noen måte å navngi sin egen aktør på, så Flow-nodens id går inn som årsak og kontoen er den på tilkoblingen. Bruk en konto laget for Flow hvis du vil finne skrivingene dens enkelt.
- MCP er en ny vei inn i Flow, og den krever et token. Ingenting serveres før en flyt har en `mcp tool`-node, og et kall uten token eller med et oppdiktet avvises.

## Nye innstillinger

| YAML | Miljø | Standard |
|---|---|---|
| `plugins.dir` | `HOTLOOP_FLOW_PLUGINS_DIR` | tom, som betyr `plugins` i `data.dir` |
| `plugins.trustedKeys` | `HOTLOOP_FLOW_PLUGIN_TRUSTED_KEYS` | ingen. Hver er `ed25519:<base64>`, en offentlig PEM-nøkkel eller en fil som inneholder en. Uten noen avvises alle plugins. |
| `plugins.grants` | `HOTLOOP_FLOW_PLUGIN_GRANTS` | ingen. Navnet på en plugin til `clock`, `random`, `context.flow`, `context.global`. Variabelen er `name=cap,cap;name=cap`. |
| `plugins.maxMemoryMiB` | `HOTLOOP_FLOW_PLUGIN_MAX_MEMORY_MIB` | 64, fra 1 til 4095 |
| `plugins.maxTimeout` | `HOTLOOP_FLOW_PLUGIN_MAX_TIMEOUT` | `5s` |
| `auth.tokens[].rateLimit.calls`, `.per` | | 0 kall, som betyr ingen grense. `per` er `1m` når du setter `calls` og ikke `per`. |

HotLoop- og MCP-tilkoblingene settes i editoren: URL, konto og et tidsavbrudd. Charten har alle plugin-innstillingene under `plugins` i `values.yaml`, med `enabled: false`, og ellers ingenting nytt.

Image: `ghcr.io/hotloop-io/hotloop-flow:2.3.0`, linux/amd64 og linux/arm64. Chart: `https://hotloop.io/hotloop-flow/`. README-en på denne taggen har resten: https://github.com/HotLoop-io/hotloop-flow/blob/v2.3.0/README.md
