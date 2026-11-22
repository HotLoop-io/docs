---
title: "MCP, i begge retninger"
description: "En agent kan kalle en flyt som verktøy, og en flyt kan kalle et verktøy på hvilken som helst MCP-server, med tre noder og én konfigurasjonsnode."
---

En agent som snakker Model Context Protocol kan kalle en flyt som et verktøy, og en flyt kan kalle et verktøy på hvilken som helst MCP-server, også HotLoops egen. Tre noder og én konfigurasjonsnode gjør det: `mcp tool` og `mcp result` serverer en flyt, `mcp client` på en `hotloop-flow-mcp-server`-tilkobling kaller utover. Hvis du bare kobler sensorer til dashbord, kan du hoppe over alt dette: en flyt som ikke bruker noen av disse nodene, gjør aldri et MCP-kall, og de eneste verktøyene Flow serverer selv, er de som leser og endrer flytene ([lenger ned](#flows-egne-verktøy)).

Protokollen er Go-SDK-ens (`github.com/modelcontextprotocol/go-sdk` v1.8.0, med fri lisens, der noen filer fortsatt er MIT mens prosjektet fullfører lisensbyttet, vedlikeholdt av MCP-prosjektet). Den snakker den gjeldende revisjonen av spesifikasjonen, 2026-07-28, som ikke har noe håndtrykk og bærer versjonen på hver forespørsel, og revisjonene med håndtrykk fram til 2025-11-25, på samme endepunkt. En klient får den den åpner med, så ingenting må konfigureres.

## Flyter som verktøy

En `mcp tool`-node deklarerer et verktøy: et navn, en beskrivelse for modellen som leser den, og et inndataskjema. Så lenge flyten er distribuert, serverer Flow det på `/mcp` (under admin-roten, hvis du har flyttet den). Et kall blir en melding ut av noden: `msg.payload` er argumentene i kallet, `msg.topic` er verktøynavnet, og `msg.mcp` inneholder `tool`, `caller` og `callId`. En `mcp result`-node et sted lenger ned sender svaret tilbake, slik `http response` svarer `http in`. Alt mellom dem er en flyt som alle andre.

```json
[
  {"id": "t1", "type": "tab", "label": "Line"},
  {"id": "tool", "type": "mcp tool", "z": "t1", "toolName": "line_status",
   "description": "Status of a production line: its state and speed.",
   "schema": "{\"type\":\"object\",\"properties\":{\"line\":{\"type\":\"string\",\"enum\":[\"L1\",\"L2\",\"L3\"]}},\"required\":[\"line\"],\"additionalProperties\":false}",
   "x": 100, "y": 100, "wires": [["status"]]},
  {"id": "status", "type": "function", "z": "t1", "name": "status", "outputs": 1,
   "func": "msg.payload = {line: msg.payload.line, state: 'running', askedBy: msg.mcp.caller};\nreturn msg;",
   "x": 300, "y": 100, "wires": [["answer"]]},
  {"id": "answer", "type": "mcp result", "z": "t1", "x": 500, "y": 100, "wires": []}
]
```

**Skjemaet kontrolleres før flyten kjører.** Det er JSON Schema, lest slik `json`-noden leser det (utkast 2020-12 med mindre skjemaet nevner et annet, og en `$ref` til en annen URL er en feil). Et skjema som ikke er gyldig, en rot som ikke er et objekt, et verktøynavn MCP ikke tillater, eller to noder som serverer samme navn, får distribusjonen av den noden til å feile, med årsaken. Et kall der argumentene ikke passer, får svar som en verktøyfeil som nevner feltet det gjelder, `arguments.line: value must be one of "L1", "L2", "L3"`, slik at modellen kan rette og prøve igjen, og flyten ser det aldri. En objekt-payload går tilbake som objekt og som JSON-tekst, tekst går tilbake som tekst, og en `mcp result` som mates av en Catch-node, eller med "The work failed" avkrysset, svarer med en verktøyfeil med feilens egne ord. Et kall som ingenting svarer på, får beskjed når svartidsgrensen er ute, 30 sekunder hvis du ikke setter noe annet, og feilen går til en Catch-node. En ny distribusjon venter på kall som pågår.

**En agent er en oppringer som alle andre.** `/mcp` tar de samme tokenene som admin-API-et, et øktstoken eller et API-token, og ingenting annet. Det finnes ingen anonyme kall: uten token er det 401, et token Flow ikke kjenner er 401, og et token uten tillatelsen `mcp.call` er 403, før protokollen ser forespørselen. En instans som kjører med `HOTLOOP_FLOW_INSECURE`, svarer 403 på alle `/mcp`-forespørsler, fordi et verktøykall må ha en oppringer å skrive inn i revisjonsloggen. Tokenet til en agent er et token som alle andre:

```yaml
auth:
  tokens:
    - name: agent
      hash: sha256:...          # from: hotloop-flow token -name agent
      permissions: ["mcp.call"]
      rateLimit: {calls: 60, per: 1m}   # optional; no rateLimit, no limit
```

Kallet kjører med den identitetens rettigheter. Hver oppringer trenger `mcp.call` (eller `mcp.*`, eller `*`). Legger du en annen tillatelse i feltet "Extra permission" på et verktøy, for eksempel `mcp.line3`, trenger oppringeren også den, og uten den ser vedkommende ikke verktøyet i listen. To agenter kan dele en Flow og se ulike verktøy.

**Et token kan begrenses til et antall kall.** `rateLimit` på et API-token i `auth.tokens` er `calls` i et vindu, `per`, ett minutt hvis du utelater det. Vinduet starter med tokenets første kall, et kall over antallet avvises til vinduet er slutt, og så begynner tellingen på nytt. Et avvist kall når aldri flyten, og får svar som en verktøyfeil som sier hvor mange sekunder det skal vente, slik at en agent i en løkke får beskjed om å senke tempoet med ord den leser. Spesifikasjonen navngir ingen feil for dette, så det er verktøyfeilen den allerede definerer for et kall som ikke kan gjøres. Et token uten `rateLimit` bremses aldri, og et øktstoken begrenses heller ikke, fordi det tilhører et menneske. Hvert token teller for seg, og tellingen ligger i minnet, så en omstart begynner på nytt. Et avslag er en `mcp.refused`-rad med årsaken `rate limit exceeded`, så en flom av kall står også i revisjonsloggen.

**Hvert kall står i revisjonsloggen, under oppringerens navn.** `mcp.call` skrives før flyten kjører, med verktøyet, noden og en kall-id, og `mcp.result` etterpå, med utfallet og millisekundene. `mcp.refused` er et feil token, ett som mangler tillatelsen, et verktøy det ikke får kalle, eller argumenter som ikke passet. Selve argumentene skrives aldri. En forespørsel uten noe token skrives heller ikke, fordi ingen står i andre enden å navngi. `GET /audit?event=mcp.` leser alt dette, og `?user=token:agent` snevrer det inn til én agent.

Prøv det med MCP-prosjektets egen inspektør, som ikke trenger noe fra Flow:

```bash
npx @modelcontextprotocol/inspector@2.12.0 --cli http://localhost:1880/mcp \
  --transport http --header "Authorization: Bearer $TOKEN" \
  --method tools/call --tool-name line_status --tool-arg line=L3
```

En flyttest legger meldingen et kall ville ha laget der `mcp tool`-noden sitter, og `mcp result` gir testen det den ville svart som `{isError, text, structuredContent}`, så flyten testes uten server.

## Flows egne verktøy

En agent som bare kunne kalle det en flytforfatter har koblet opp, kunne verken se flytene eller endre dem, så Flow serverer 45 egne verktøy på samme `/mcp`, ved siden av flytenes. De leser og de skriver. Sju handler om flytene, i tabellen under, og resten er admin-API-ets øvrige ruter: innstillingene, paletten, revisjonsloggen, detaljer og diff for distribusjoner, eksporten, flyttestene, meldingssporene, kjøretidens tall, tilbakestilling av andre faktor, og diagrammene og instrumentene: liste og lese et diagram, kjøre og stanse det, styre feilsøkeren, sette en kontroll på panelet og slå et instruments skriving av og på. MCP-siden har hvert verktøy, ruten og tillatelsen, og de få rutene som ikke er verktøy, og hvorfor.

| Verktøy | Gjør | Tillatelse |
|---|---|---|
| `list_flows` | hver fane og underflyt: id, etikett, deaktivert, antall noder og revisjonen | `flows.read` |
| `get_flows` | hele det distribuerte settet slik editoren leser det, med revisjonen | `flows.read` |
| `get_flow` | én fane eller underflyt med nodene sine, etter id | `flows.read` |
| `deploy_flows` | **deploy**: erstatter hele settet, med revisjonen du leste og et notat | `flows.write` |
| `list_deployments` | distribusjonshistorikken, nyeste først | `flows.read` |
| `rollback_deployment` | **roll back** til en tidligere distribusjon, som en ny | `flows.write` |
| `inject_node` | **press** på en inject-node, med en melding du lager selv | `inject.write` |

Ingen av dem er en andre implementasjon. Hver kjører admin-API-ets egen håndterer for den samme jobben som oppringeren endepunktet autentiserte, så en distribusjon møter alt en distribusjon fra editoren møter: dokumentet må kunne parses, revisjonen må være den gjeldende (en tom overskriver med vilje), koblinger som er uenige om hva som går over dem, avvises, plugin-er som ikke er tillatt, avvises, og flyttester som feiler, avviser distribusjonen, hver med rutens egne ord. Distribusjonshistorikken registrerer oppringeren og notatet, og revisjonsloggen har raden `deploy` eller `inject` under oppringerens navn, i tillegg til radene `mcp.call` og `mcp.result` som hvert verktøykall legger igjen. En oppringer trenger `mcp.call` og verktøyets egen tillatelse, og et verktøy vedkommende ikke får kalle, står ikke i listen. Verktøyene blir stående gjennom en distribusjon, som bare fjerner flytenes egne verktøy, og en flyt kan ikke servere et av navnene deres.

`deploy_flows` erstatter hele settet, så en agent leser `get_flows` først og sender det tilbake endret, med `rev` den fikk.

## Kalle verktøy på andre servere

En `mcp client`-node kaller et verktøy når en melding kommer, på en `hotloop-flow-mcp-server`-tilkobling: serverens MCP-adresse, et bearer-token hvis den krever det, og en tidsgrense. Verktøyet og argumentene er typede inndata, så begge kan komme fra meldingen. `msg.payload` er verktøyets strukturerte svar når det har ett, teksten når alt det sa var tekst, og innholdet slik det kom når det var noe annet, og `msg.mcp` har serveren, verktøyet og hele svaret. Den andre operasjonen, "List the tools", legger alle verktøyene serveren har i `msg.payload`, med beskrivelse og inndataskjema.

Et verktøy som melder en feil, utløser en, med serverens ord, så en Catch-node ser det modellen ville ha sett. **Et kall sendes aldri to ganger.** Et verktøy kan flytte utstyr, og en brutt forbindelse sier ikke om serveren kjørte det, så feilen sier at forbindelsen feilet, og neste melding kobler til på nytt. Tokenet går til adressen du oppga og ingen andre steder, en omdirigering følges ikke, og en feil gjentar det aldri. Forbindelsen stoler på systemets sertifikatrøtter og ingenting annet.

For HotLoop er det adressen til `/mcp` og `mcp-token` fra utgivelsens Secret, og alle verktøyene i HotLoops MCP-dokumentasjon er der:

```json
{"id": "plant", "type": "mcp client", "z": "t1", "server": "hotloop",
 "tool": "get_plant_status", "toolType": "str", "arguments": "{}", "argumentsType": "json",
 "x": 300, "y": 100, "wires": [["use"]]}
```

HotLoop ser kallet som en MCP-klients, under sine egne regler: MCP leser og skriver, gjennom samme port som alle andre, så en `write_tag` til et armert tag innenfor området går gjennom (når HotLoops egen skriving er slått på), og en den avviser, et tag ingen har merket som skrivbart for eksempel, kommer tilbake som nodens feil, med HotLoops ord. For å skrive gjennom HotLoops port fra en flyt uten MCP, bruk HotLoop-nodene lenger opp.

## Hva den ble testet mot

**Serveren** testes med Go-SDK-ens egen klient over ekte HTTP, i begge epoker: liste, kalle, argumenter avvist, en tillatelse avvist, et token avvist, revisjonsradene, et verktøy som forsvinner når noden stopper, og hele admin-serveren foran med ekte API- og øktstoken og revisjonsloggen på disk. MCP-prosjektets Inspector CLI 2.12.0 listet verktøyene til en Flow som kjørte, kalte dem, og ble avvist uten token og med et påfunnet. `mcp client`-noden ble kjørt mot en ekte HotLoop 4.18.10 (det publiserte IoT-imaget): den listet alle 27 verktøyene, kalte `get_plant_status`, `list_devices` og `get_states` og brukte svarene, ble avvist med feil token og uten, fikk HotLoops egen feil for et verktøy som ikke finnes og for en skriving MCP ikke har lov til å gjøre, og et Flow-verktøy kalt fra Inspector kjørte en flyt som kalte HotLoops MCP og svarte med det den sa.

**Ikke gjort:** OAuth (et bearer-token er eneste vei inn, i begge retninger), stdio-servere, ressurser, prompter, sampling, elicitation og fremdriftsvarsler, og et verktøys utdataskjema. HotLoop 4.18.10 snakker revisjonene med håndtrykk, så noden møter det slik; mot en server med den gjeldende revisjonen er den bare testet med Flows egen. En server med håndtrykk som glemmer en økt (en omstart), lar det første kallet etterpå feile, én gang, og det neste kobler til på nytt. Hastighetsbegrensning er per API-token og av til du setter den, så et token uten `rateLimit` begrenses bare av køene, som allerede har et tak, og av forespørselsstørrelsen, 4 MiB.
