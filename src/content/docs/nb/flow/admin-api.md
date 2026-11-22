---
title: "Administrasjons-API-et"
description: "HTTP- og websocket-kallene som editoren og kommandolinjen bruker, hva hvert enkelt trenger og hva det returnerer."
---

| Metode og sti | Tillatelse | Merknader |
|---|---|---|
| `GET /health` | ingen | Liveness. Kubelet bærer ikke noe token, og autentisering på denne ruten ville fått poden til å starte på nytt i en evig løkke. |
| `GET /ready` | ingen | Beredskap, rapportert separat, slik at en kjøretid som ikke kom i gang forlater Service uten at kubelet dreper poden. |
| `POST /auth/token` | ingen | Logg inn. En 429 med `Retry-After` mens kontoen er sperret. |
| `POST /auth/revoke` | ingen | Logg ut. |
| `GET /auth/mode` | ingen pålogging | Om denne kjøretiden åpnes fra EmberCORE-dashbordet: `{"dashboard": bool, "hideLogin": bool}`. Editoren spør om dette før noen har logget inn. |
| `GET /auth/mfa`, `POST /auth/mfa/setup`, `/confirm`, `/disable` | en pålogget bruker | Din egen tofaktorpålogging. Setup returnerer nøkkelen, lenken `otpauth://` og QR-koden. Confirm og disable tar `{"code": ...}`. |
| `POST /auth/mfa/reset` | `auth.admin` | Slår av tofaktorpåloggingen til en annen: `{"username": ...}`. |
| `GET /metrics` | ingen | Prometheus. Bare tellinger og node-ider, aldri meldingsinnhold eller konfigurasjon. |
| `GET /settings` | `settings.read` | |
| `GET /nodes` | `nodes.read` | Registeret, som driver editorens palett og dialoger. |
| `GET /plugins` | `nodes.read` | Programtilleggene som ble lastet, hva hvert ber om og har fått, og de som ble avvist med årsak. |
| `GET /flows` | `flows.read` | |
| `GET /flows/export` | `flows.read` | Flytfilen nøyaktig slik den ligger på disk, for git. |
| `POST /flows` | `flows.write` | Utrulling. Tar et valgfritt notat til utrullingsloggen. |
| `GET /deployments` | `flows.read` | Utrullingsloggen, nyeste først, uten nyttelastene. `?limit=N` avgrenser den. |
| `GET /audit` | `audit.read` | Hvem som gjorde hva og hvorfra, nyeste først. `?event=`, `?user=`, `?since=`, `?limit=`. |
| `GET /deployments/{seq}` | `flows.read` | Én post, med flytene tolket. Aldri legitimasjonen. |
| `GET /deployments/{seq}/flows` | `flows.read` | Flytfilen til den utrullingen, byte for byte. |
| `GET /deployments/{from}/diff/{to}` | `flows.read` | Node-for-node-differanse mellom to utrullinger, strukturert og som tekst. |
| `POST /flows/diff` | `flows.read` | Differansen mellom det som kjører og dokumentet i kroppen. Ruller ikke ut noe. |
| `POST /flows/types` | `flows.read` | Kontrollen av typede koblinger som en utrulling gjør, på dokumentet i kroppen: `{"wires": [...]}`, tom når ingenting er galt. Editoren tegner svaret. Ruller ikke ut noe. |
| `POST /deployments/{seq}/rollback` | `flows.write` | Ruller ut flytene og legitimasjonen til den posten på nytt som en ny utrulling. Tar rev-headeren og et valgfritt `{"note": ...}`. |
| `GET /tests` | `flows.read` | Flytens testsuite som ligger ved siden av flytfilen, filnavnet og om utrullinger er avhengige av den. |
| `PUT /tests` | `flows.write` | Erstatter suiten. Kroppen er YAML-en; en som ikke lar seg tolke gir en 400 med årsaken. |
| `POST /tests/run` | `flows.read` | Kjører suiten, eller `"tests"` fra kroppen, mot `"flows"` fra kroppen eller det som kjører. Returnerer rapporten. Ruller ikke ut noe. |
| `POST /tests/from-debug` | `flows.read` | Skisserer en test fra `{"node", "msgId"}`, en melding en Debug-node viste. Lagrer ingenting. |
| `POST /tests/cases` | `flows.write` | Legger testene i kroppen, en egen testfil, til på slutten av suiten. |
| `GET /traces` | `flows.read` | Sporingene som er beholdt, nyeste først, med det bufferen holder og grensene. `?limit=N`. 404 med `trace.enabled: false`. |
| `GET /traces/find` | `flows.read` | Sporingen en melding var i, fra `?msgId=` og `?node=`, id-en og Debug-noden sidepanelet viser. Returnerer hvert hopp og veien til den det ble spurt om. |
| `GET /traces/{id}` | `flows.read` | Én sporing, hvert hopp med tidsbruken og meldingen slik noden fikk den. |
| `POST /traces/{id}/test` | `flows.read` | Skisserer en flytest fra sporingen. Lagrer ingenting. |
| `POST /traces/{id}/replay` | `flows.read` | Setter meldingen som startet sporingen inn i `"flows"` fra kroppen, eller det som kjører, i en barneprosess, og returnerer hvor den ender mot hvor den endte. Ruller ikke ut noe. |
| `GET /runtime/stats` | `status.read` | |
| `POST /inject/{id}` | `inject.write` | Utløser en Inject-node. |
| `GET /comms` | `status.read` | Editorens status- og feilsøkings-websocket. Send tokenet som underprotokollen `hotloop-flow.bearer.<token>`, tilbudt ved siden av `hotloop-flow`. Det er det editoren gjør. `?access_token=<token>` i URL-en fungerer fortsatt for skript som allerede bruker det, og logger en advarsel for hver tilkobling som gjør det, fordi en URL havner i proxy- og tilgangslogger. |
| `POST /mcp` (og `GET` og `DELETE`, for de eldre revisjonene av protokollen) | `mcp.call` | [MCP-endepunktet](/nb/flow/mcp/), der flyter serveres som verktøy. Et sesjons- eller API-token som alle andre. Verktøyene en kaller får tilbud om, og kan kalle, er de tillatelsene hens rekker til. 403 med autentisering slått av. |

At `/metrics` og `/health` er uten autentisering er en beslutning og ikke en forglemmelse. En Prometheus-skraper bærer ikke noe bearer-token, så å kreve ett betyr enten å gi overvåkingsstakken din en legitimasjon eller å ikke ha overvåking.

En bruker med tofaktorpålogging på sender `"code"` sammen med brukernavn og passord til `POST /auth/token`. Uten den er svaret en 401 med `"mfa": "required"`.

Tillatelser er `"*"` for alt, en nøyaktig streng som `flows.read`, eller en prefiksgodkjenning som `flows.*`. En agent som kaller flyter som MCP-verktøy trenger `mcp.call`. En skrivebeskyttet konto for et dashbord som bare vil vise flytstatus er `["flows.read", "status.read"]` og ingenting mer.

Utrullinger tar en valgfri `HotLoop-Flow-Deployment-Rev`-header. Send revisjonen du leste sist, så avvises en utrulling som konkurrerer med en annen editor med en 409 i stedet for å stille overskrive noens arbeid, som er feilen du bare hører om fra den som mistet ettermiddagen sin.

En utrulling starter bare på nytt det du har endret. En node blir oppe når ingenting den støtter seg på har beveget seg: innstillingene, fanen, gruppen, miljøet, legitimasjonen og hver konfigurasjonsnode den nevner. Å dra den over lerretet eller koble den om teller ikke, fordi nye koblinger settes på den kjørende noden. Så å rette en skrivefeil i én funksjonsnode kaster ikke lenger alle MQTT-sesjoner på boksen, og en Delay-node som sitter på ti minutter med målinger fortsetter å sitte på dem. Det er hele grunnen til at det finnes: når hver lagring får anlegget til å sprette, slutter operatørene å lagre under et skift, og rettelsen venter til lørdag.

Velg hvor mye som starter på nytt med en `HotLoop-Flow-Deployment-Type`-header. Node-REDs `Node-RED-Deployment-Type` fungerer også, så et utrullingsskript du allerede har får omstarten det ber om.

| Type | Hva som starter på nytt |
|---|---|
| `nodes` (standard) | Nodene du endret, pluss alt som nevner en konfigurasjonsnode du endret. |
| `flows` | Hver node i en flyt som har en endring i seg. |
| `full` | Alt. Det samme som å starte prosessen på nytt. |

Svaret sier hva det gjorde: `type`, `started`, `restarted`, `stopped` og `unchanged`. Ingenting som er underveis går tapt. Arbeid som allerede står i kø på en node som byttes ut, blir ferdig på den gamle instansen, alt som dukker opp under byttet venter på den nye, og en melding på vei til en node du slettet telles og vises som en forkasting i stedet for å forsvinne.
