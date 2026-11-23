---
title: "HTTP-APIet"
description: "Hvert kall HotLoop svarer på over HTTP, hva det trenger, hva det tar imot og hva det gir tilbake. Nettgrensesnittet bruker ingenting annet."
---

Hvert kall Gateway svarer på over HTTP, hva det trenger, hva det tar imot og hva det gir tilbake. Nettgrensesnittet bruker ikke noe annet: det finnes ikke noe privat API bak skjermbildene, så alt grensesnittet kan gjøre, kan et skript gjøre med de samme kallene og de samme tillatelsene.

Denne siden kontrolleres mot koden. Listen over ruter og hvem som kan kalle dem er derfor ikke en beskrivelse av API-et slik det en gang var. Formene på forespørslene og svarene nedenfor er hentet fra en Gateway som kjørte; testene sjekker dem ikke, så hvis du endrer en handler, endre seksjonen dens her også.

Bakgrunnen for hver funksjon ligger på funksjonens egen side: [Autentisering og brukere](/nb/iot/authentication/), [Entiteter](/nb/iot/entities/), [utstyrstreet og etikettene](/nb/iot/equipment/), [Automasjoner](/nb/iot/automations/), [Planlagte rapporter](/nb/gateway/reports/), [Flåtestyring](/nb/gateway/fleet/), [Alarmvarsler](/nb/iot/notifications/), [Sikkerhetskopier og gjenoppretting](/nb/iot/backup/) og [MCP](/nb/iot/mcp/). Denne siden er listen, de andre gir begrunnelsene.

## Konvensjoner

### Hvor det ligger

Alt ligger på appens ene HTTP-port (`HOTLOOP_LISTEN_ADDR`, `:8080` som standard). Bak en proxy som serverer appen under en sti, sett `HOTLOOP_BASE_PATH`, så fjerner Gateway den, slik at `/hotloop/api/devices` og `/api/devices` er det samme kallet. Stiene nedenfor er skrevet uten den.

### Logge inn: en cookie eller et bearer-token

Hver `/api/`-rute trenger en økt, bortsett fra innlogging (med passord, eller med PIN eller adgangskort på et kioskpanel), innkommende webhooks og lenker for å kvittere alarmer, som hver bærer sitt eget bevis i forespørselen. `POST /api/auth/login` svarer med et token og setter det også som cookien `iiot_session` (HttpOnly, SameSite=Lax, Secure når forespørselen kom over TLS eller med `X-Forwarded-Proto: https`). En nettleser bruker cookien og ser aldri tokenet. Et skript sender tokenet i stedet:

```
Authorization: Bearer 3f9c...e1
```

Begge er den samme økten og sjekkes på samme måte. En økt varer `HOTLOOP_AUTH_SESSION_TTL` (12 timer som standard). Uten økt svarer hver `/api/`-rute:

```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="hotloop"

{"error":"not logged in"}
```

eller `"the session is invalid or has expired"` for et token som er trukket tilbake eller utløpt, eller `"this account no longer has access"` for en konto som er deaktivert.

Med `HOTLOOP_AUTH_INSECURE=true` finnes det ingen innlogging i det hele tatt: ingenting sjekkes, alle tillatelsene nedenfor gis til alle, og navnet som registreres på en skriving kommer fra proxyens header `X-EmberNET-User`, `X-Forwarded-User`, `X-Auth-Request-User`, `X-Remote-User` eller `X-Forwarded-Email`, eller er `operator` hvis ingen er satt. Det er bare forsvarlig bak en NetworkPolicy som ikke slipper noe til poden unntatt dashbord-proxyen. Se [Autentisering og brukere](/nb/iot/authentication/#kjøre-uten-innlogging).

MCP er skilt ut: det har sitt eget bearer-token (`HOTLOOP_MCP_TOKEN`) og ser aldri på en økt. Se [MCP](#mcp).

### Tillatelser

En innlogget bruker har en liste med tillatelser, fra rollen sin eller satt direkte på kontoen. En rute som krever en tillatelse brukeren ikke har, svarer:

```
HTTP/1.1 403 Forbidden

{"error":"viewer1 does not have the \"values.write\" permission"}
```

[Tillatelsestabellen](#tillatelser) viser hvilken rolle som har hva.

### Feil

Hver feil API-et selv lager, er JSON i én form:

```json
{"error": "value is outside the tag's configured range: 120 is outside 0..95"}
```

`/readyz` legger til en `detail`, og et mislykket tjenestekall legger til skrivingene det rakk å gjøre. Meldingen er skrevet for personen som leser den: den sier hva som var galt og, når det finnes noe, hva man kan gjøre i stedet. Vis den som den er.

| Status | Når |
|---|---|
| 400 | Forespørselen er feil: en ugyldig body, et felt som ikke består valideringen, et ukjent felt, en parameter som mangler, en ukjent tjeneste |
| 401 | Ingen økt, en utløpt økt, eller feil passord ved innlogging |
| 403 | Brukeren mangler tillatelsen, eller skrive-porten avviste skrivingen av policy: skriving slått av, taggen ikke armert, entiteten deaktivert |
| 404 | Det som er nevnt i stien eller bodyen finnes ikke |
| 409 | Det finnes allerede, eller det er i feil tilstand for dette: en alarm som ikke er utsatt, en node som fortsatt har barn, en entitet uten kjent tilstand å bytte, et skript som allerede kjører, en oppskrift som ble avvist eller allerede brukes |
| 422 | En verdi skrive-porten avviste på innholdet: utenfor taggens område, utenfor trinnet til en entitet |
| 502 | Enheten svarte med en egen feil, og bodyen er ordene dens; eller en oppskrift startet og ikke alle målene ble nådd, og bodyen sier hvilke som gikk ut og hvilke som ikke gjorde det |
| 503 | Enheten er ikke tilkoblet, eller alarmmotoren kjører ikke |
| 500 | En feil inne i serveren. Bodyen er `internal error (ref …); the server log has the detail under that ref` og ingenting mer, og loggen har hele feilen under den referansen. Den eneste 500-en med en ekte melding er et knappetrykk der slippet ikke gikk ut, fordi den meldingen sier nøyaktig hva som skal sjekkes |

Alt API-et ikke kan plassere, er en 500, aldri en 400. Et databaseavbrudd som besvares med 400 forteller operatøren at hen har skrevet noe feil, og hen går og leter etter en skrivefeil som ikke finnes.

To feil kommer ikke fra API-et og er ren tekst, ikke JSON: en sti som ikke treffer noen rute svarer `404 page not found`, og en kjent sti kalt med feil metode svarer `405 method not allowed`.

En avvist skriving er aldri en 500. Et anleggsskjermbilde som viser en policy-avvisning som en serverfeil, lærer operatørene å ignorere feil.

### Bodyer

Forespørselsbodyer er JSON, høyst 4 MiB (en innkommende webhook, 1 MiB). **Ukjente felt avvises**, de ignoreres ikke:

```json
{"error":"request body: json: unknown field \"x\""}
```

En feilstavet innstilling som stille blir droppet, ser akkurat ut som en som virket, så dekoderen sier nei.

`POST` og `PUT` på enheter, tags, alarmer, automasjoner, flåtemedlemmer og rapporter erstatter hele objektet: et felt som utelates får nullverdien sin, og en boolsk som utelates er `false`. Les, endre, send tilbake. Unntakene er `PUT` for entiteter og utstyr, som bare endrer feltene du sender, og enhetenes påloggingsinformasjon, som beholdes når den utelates (se under).

### Hemmeligheter er bare skrivbare

Påloggingsinformasjon lagret i en enhet (et broker-passord, en HTTP-header, et passord i adressen) sendes aldri tilbake, til ingen rolle, administrator inkludert. Den vises som `[redacted]`:

```json
"config": {"clientId": "docs-api-tankfarm", "password": "[redacted]", "username": "tank"}
```

Når du lagrer enheten, send plassholderen (eller utelat nøkkelen) for å beholde den lagrede verdien, send en ny verdi for å erstatte den, og send `""` eller `null` for å fjerne den. En ny enhet kan ikke lagres med plassholderen, og en lagring som flytter enheten til en annen vert med en beholdt påloggingsinformasjon avvises, slik at et lagret passord ikke kan bæres bort til en annens lytter. De fullstendige reglene står i [Autentisering og brukere](/nb/iot/authentication/#enhetslegitimasjon-er-skrivebeskyttet). Det samme gjelder all annen påloggingsinformasjon Gateway holder: innstillingene viser `set` eller `not set`, diagnostikken fjerner påloggingsinformasjon fra utgående MCP-mål, og ingenting i dette API-et returnerer en passord-hash eller et øktstoken, bortsett fra det ene innloggingen gir deg.

### camelCase, unntatt der det er snake_case

Det meste av API-et er camelCase (`deviceId`, `pollIntervalMs`, `createdAt`), slik det har vært siden første versjon og slik `TagValue`-kontrakten til EmberNet-dashbordet krever.

Endepunktene for entiteter, tilstander, tjenester, utstyr og etiketter er snake_case (`entity_id`, `last_changed`, `parent_id`, `label_id`). Det er med vilje: entitets-API-et bruker den vanlige formen for entitet, tilstand og tjeneste, slik at alt som allerede snakker den, snakker dette også, og utstyrstreet er områderegisteret i entitetsmodellen, formet for de samme brukerne. Der de to møtes, beholder hver side sin egen skrivemåte: en enhet har `equipmentId`, en entitet har `equipment_id`.

### Tidspunkter, varigheter og tag-nøkler

- **Tidsstempler** er RFC 3339 i UTC, med brøkdeler av sekunder når det finnes noen: `2026-09-27T20:21:58.255869Z`. Innstillingen for visningstidssone endrer det brukergrensesnittet viser, aldri det API-et returnerer.
- **Et tidspunkt som ikke har skjedd, utelates.** En regel som aldri har kjørt, har ingen `lastRun`, en enhet som aldri er lest, har verken `lastPoll` eller `lastGood`, en alarm ingen har kvittert, har ingen `ackedAt`, et flåtemedlem som aldri er sett, har ingen `lastSeen`. Et manglende tidsfelt betyr aldri. Du vil aldri se Gos nulltid, `0001-01-01T00:00:00Z`, i et svar eller en strømhendelse. Et dusin felt pleide å sende den, og automasjonsskjermen viste en regel som aldri hadde kjørt som sist kjørt for 739887 dager siden. En test leser hver rute og hvert tidsfelt i koden for å holde det slik.
- **Sparklines** er unntaket: der er `timestamps` Unix-millisekunder, fordi det går rett inn i et diagram.
- **Varigheter** sier enheten i navnet: `pollIntervalMs`, `onDelaySec`, `minutes`, `durationMs`. `uptime` i statusen er en Go-varighetsstreng (`11m13s`).
- **En tag-nøkkel** er `device/tag`, formen som hver `?tag=`-parameter og hvert `tag`-felt tar. Tag-navn kan inneholde skråstreker (OPC UA-stier, MQTT-topics), så bare den første skråstreken skiller: `plc-1/Line/Zone 1` er taggen `Line/Zone 1` på enheten `plc-1`.
- **En numerisk spørringsparameter** som ikke er et tall, ignoreres og standardverdien brukes, så `?limit=abc` er det samme som uten `?limit`.
- **Tomme lister** er `[]`, aldri `null`, i hvert svar og hver strømhendelse, på alle nivåer. Du trenger ingen null-sjekk før `.length`. En `null` du ser, er aldri en liste: det er ett av de dokumenterte feltene som kan være null, som `equipment_id` på en entitet eller `parent_id` på en rotnode. Et listefelt merket valgfritt kan likevel utelates helt.

### Valgfrie funksjoner

Flåte, varsler, sikkerhetskopier og planlagte rapporter er av med mindre variabelen `HOTLOOP_*_ENABLED` er satt. Med funksjonen av svarer listeruten likevel 200, med `"configured": false` og en tom liste, slik at en skjerm kan si «ikke aktivert» i stedet for «ingenting her». Hver annen rute i den funksjonen svarer 400 med en feil som nevner variabelen:

```json
{"error":"backups are not enabled (HOTLOOP_BACKUP_ENABLED)"}
```

`GET /api/sites` gjør det samme når ingen utgående MCP-servere er konfigurert.

### Ikke i dette produktet

HotLoop leveres som IoT, Edge, Gateway og Edge Relay fra én kodebase, og en funksjon et produkt ikke har, er ikke slått av, den er ikke i binærfilen. På IoT, Edge og Gateway svarer rutene likevel, etter samme tillatelsessjekk, med en 404 som sier det og nevner begge ender, slik at et skript kan skille «feil boks» fra «feil URL»:

```json
{"error":"scheduled reports are part of HotLoop Gateway; this is HotLoop IoT","product":"iot","feature":"reports"}
```

Ikke en 400, fordi det ikke finnes noen variabel som fikser det, og ikke en 5xx, fordi ingenting gikk galt. `GET /api/status` sier med en gang hvilket produkt som svarte og hvilke funksjoner det har, slik at en klient kan spørre i stedet for å prøve seg fram.

### Alt som endrer noe, logges

Hver oppretting, endring, sletting, skriving, kvittering og innlogging havner i systemloggen (`GET /api/events`) med brukerens navn, og hver skriving til en tag, avvist eller ikke, havner i skriverevisjonen (`GET /api/writes`). API-et har ingen stille vei.

## Tillatelser

Hvem som har hva. En konto med en uttrykkelig tillatelsesliste har akkurat det listen nevner, i stedet for rollens sett. `*` gir alt og `resource.*` gir alt under en ressurs (`reports.*`). Rollen admin er `*`.

| Tillatelse | viewer | operator | admin |
|---|---|---|---|
| `status.read` | ja | ja | ja |
| `devices.read` | ja | ja | ja |
| `devices.write` | nei | nei | ja |
| `tags.read` | ja | ja | ja |
| `tags.write` | nei | nei | ja |
| `values.read` | ja | ja | ja |
| `values.write` | nei | ja | ja |
| `board.write` | nei | ja | ja |
| `entities.read` | ja | ja | ja |
| `entities.write` | nei | nei | ja |
| `helpers.write` | nei | ja | ja |
| `equipment.read` | ja | ja | ja |
| `equipment.write` | nei | nei | ja |
| `alarms.read` | ja | ja | ja |
| `alarms.write` | nei | nei | ja |
| `alarms.ack` | nei | ja | ja |
| `automations.read` | ja | ja | ja |
| `automations.write` | nei | nei | ja |
| `automations.trigger` | nei | ja | ja |
| `scripts.read` | ja | ja | ja |
| `scripts.run` | nei | ja | ja |
| `scripts.write` | nei | nei | ja |
| `recipes.read` | ja | ja | ja |
| `recipes.apply` | nei | ja | ja |
| `recipes.write` | nei | nei | ja |
| `blueprints.read` | ja | ja | ja |
| `blueprints.apply` | nei | ja | ja |
| `blueprints.write` | nei | nei | ja |
| `dashboards.read` | ja | ja | ja |
| `dashboards.write` | nei | nei | ja |
| `energy.read` | ja | ja | ja |
| `energy.write` | nei | nei | ja |
| `fleet.read` | ja | ja | ja |
| `fleet.write` | nei | ja | ja |
| `fleet.rebirth` | nei | ja | ja |
| `fleet.restart` | nei | nei | ja |
| `fleet.update` | nei | nei | ja |
| `fleet.config` | nei | nei | ja |
| `notify.test` | nei | nei | ja |
| `notify.escalation` | nei | nei | ja |
| `backup.read` | nei | nei | ja |
| `backup.run` | nei | nei | ja |
| `reports.read` | ja | ja | ja |
| `reports.run` | nei | ja | ja |
| `reports.write` | nei | nei | ja |
| `sites.read` | ja | ja | ja |
| `settings.read` | ja | ja | ja |
| `settings.write` | nei | nei | ja |
| `events.read` | ja | ja | ja |
| `logbook.read` | ja | ja | ja |
| `users.manage` | nei | nei | ja |

Linjen er den samme overalt: en operatør driver anlegget (skriver verdier, kvitterer alarmer, utløser automasjoner, dytter på et relé), og bare en administrator endrer hva anlegget er satt opp til å være, eller gjør noe mot omverdenen på vegne av Gateway (starte et relay på nytt, sende det konfigurasjonen, sende en testside, definere en rapport som sender anleggsdata på e-post et sted).

## Endepunktindeks

Tillatelseskolonnen sier hva ruten sjekker. `session` betyr enhver innlogget bruker, uten noen tillatelse utover det. `none` betyr at det heller ikke trengs økt, og seksjonen forklarer hvorfor. `(in handler)` betyr at sjekken gjøres inne i handleren og ikke foran den, og seksjonen forklarer hvorfor.

Produktkolonnen viser den minste HotLoop som har ruten: `all` er IoT, Edge og Gateway, `edge` er Edge og Gateway, `gateway` er Gateway alene. Hvert produkt registrerer hver rute og sjekker den samme tillatelsen på den. På et produkt som ikke har den, svarer ruten 404 og sier hvor den finnes; se [Ikke i dette produktet](#ikke-i-dette-produktet).

| Metode | Sti | Tillatelse | Produkt |
|---|---|---|---|
| `GET` | `/healthz` | none | all |
| `GET` | `/readyz` | none | all |
| `POST` | `/api/auth/login` | none | all |
| `POST` | `/api/auth/kiosk` | none | all |
| `POST` | `/api/auth/logout` | session | all |
| `POST` | `/api/auth/activity` | session | all |
| `GET` | `/api/auth/session` | session | all |
| `POST` | `/api/auth/password` | session | all |
| `GET` | `/api/users` | `users.manage` | all |
| `POST` | `/api/users` | `users.manage` | all |
| `PUT` | `/api/users/{username}` | `users.manage` | all |
| `DELETE` | `/api/users/{username}` | `users.manage` | all |
| `POST` | `/api/users/{username}/password` | `users.manage` | all |
| `DELETE` | `/api/users/{username}/lockout` | `users.manage` | all |
| `PUT` | `/api/users/{username}/pin` | `users.manage` | all |
| `DELETE` | `/api/users/{username}/pin` | `users.manage` | all |
| `GET` | `/api/opcua/certificates` | `users.manage` | all |
| `GET` | `/api/users/{username}/certificates` | `users.manage` | all |
| `POST` | `/api/users/{username}/certificates` | `users.manage` | all |
| `POST` | `/api/users/{username}/certificates/{thumbprint}/revoke` | `users.manage` | all |
| `DELETE` | `/api/users/{username}/certificates/{thumbprint}` | `users.manage` | all |
| `GET` | `/api/status` | `status.read` | all |
| `GET` | `/api/protocols` | `status.read` | all |
| `GET` | `/api/diagnostics` | `status.read` | all |
| `GET` | `/api/devices` | `devices.read` | all |
| `POST` | `/api/devices` | `devices.write` | all |
| `GET` | `/api/devices/{id}` | `devices.read` | all |
| `DELETE` | `/api/devices/{id}` | `devices.write` | all |
| `POST` | `/api/devices/{id}/enabled` | `devices.write` | all |
| `POST` | `/api/devices/{id}/browse` | `devices.read` | all |
| `POST` | `/api/devices/{id}/import` | `tags.write` | all |
| `GET` | `/api/devices/{id}/network` | `devices.read` | all |
| `PUT` | `/api/devices/{id}/network` | `devices.write` | all |
| `DELETE` | `/api/devices/{id}/network` | `devices.write` | all |
| `GET` | `/api/unifi/{id}/networks` | `devices.read` | all |
| `PUT` | `/api/unifi/{id}/networks/{network}` | `devices.write` | all |
| `POST` | `/api/unifi/{id}/networks/{network}/accept-all` | `devices.write` | all |
| `GET` | `/api/unifi/{id}/known` | `devices.read` | all |
| `PUT` | `/api/unifi/{id}/networks/{network}/known/{mac}` | `devices.write` | all |
| `DELETE` | `/api/unifi/{id}/networks/{network}/known/{mac}` | `devices.write` | all |
| `GET` | `/api/unifi/{id}/clients` | `devices.read` | all |
| `GET` | `/api/unifi/consoles` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/overview` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/topology` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/devices` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/wifi` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/events` | `devices.read` | all |
| `POST` | `/api/unifi/{id}/starter-alarms` | `alarms.write` | all |
| `GET` | `/api/discovery` | `devices.read` | all |
| `GET` | `/api/discovery/{source}/{key}` | `devices.read` | all |
| `POST` | `/api/discovery/{source}/{key}/accept` | `devices.write` | all |
| `POST` | `/api/discovery/{source}/{key}/ignore` | `devices.write` | all |
| `POST` | `/api/discovery/{source}/{key}/unignore` | `devices.write` | all |
| `POST` | `/api/discovery/{source}/{key}/review/apply` | `devices.write` | all |
| `POST` | `/api/discovery/{source}/{key}/review/reject` | `devices.write` | all |
| `GET` | `/api/network-discovery` | `devices.read` | all |
| `GET` | `/api/network-discovery/{key}` | `devices.read` | all |
| `POST` | `/api/network-discovery/{key}/accept` | `devices.write` | all |
| `POST` | `/api/network-discovery/{key}/ignore` | `devices.write` | all |
| `POST` | `/api/network-discovery/{key}/unignore` | `devices.write` | all |
| `POST` | `/api/network-discovery/probe` | `devices.write` | all |
| `GET` | `/api/integrations` | `devices.read` | all |
| `POST` | `/api/integrations/{id}/probe` | `devices.write` | all |
| `POST` | `/api/integrations/{id}/setup` | `devices.write` | all |
| `GET` | `/api/broker/logins` | `users.manage` | all |
| `POST` | `/api/broker/logins` | `users.manage` | all |
| `PUT` | `/api/broker/logins/{name}` | `users.manage` | all |
| `DELETE` | `/api/broker/logins/{name}` | `users.manage` | all |
| `GET` | `/api/mqtt/brokers` | `devices.read` | all |
| `POST` | `/api/mqtt/brokers` | `devices.write` | all |
| `PUT` | `/api/mqtt/brokers/{id}` | `devices.write` | all |
| `DELETE` | `/api/mqtt/brokers/{id}` | `devices.write` | all |
| `GET` | `/api/tags` | `tags.read` | all |
| `POST` | `/api/tags` | `tags.write` | all |
| `DELETE` | `/api/tags/{device}/{name}` | `tags.write` | all |
| `GET` | `/api/values` | `values.read` | all |
| `GET` | `/api/sparkline` | `values.read` | all |
| `GET` | `/api/board` | `values.read` | all |
| `PUT` | `/api/board` | `board.write` | all |
| `POST` | `/api/write` | `values.write` | all |
| `GET` | `/api/history` | `values.read` | all |
| `GET` | `/api/writes` | `values.read` | all |
| `GET` | `/api/entities` | `entities.read` | all |
| `GET` | `/api/entities/composites` | `entities.read` | all |
| `GET` | `/api/entities/{entity_id}` | `entities.read` | all |
| `GET` | `/api/entities/{entity_id}/image` | `entities.read` | all |
| `PUT` | `/api/entities/{entity_id}` | `entities.write` | all |
| `POST` | `/api/entities` | `entities.write` | all |
| `DELETE` | `/api/entities/{entity_id}` | `entities.write` | all |
| `GET` | `/api/states` | `entities.read` | all |
| `GET` | `/api/states/{entity_id}` | `entities.read` | all |
| `GET` | `/api/energy/meters` | `energy.read` | all |
| `POST` | `/api/energy/meters` | `energy.write` | all |
| `GET` | `/api/energy/meters/{id}` | `energy.read` | all |
| `PUT` | `/api/energy/meters/{id}` | `energy.write` | all |
| `DELETE` | `/api/energy/meters/{id}` | `energy.write` | all |
| `GET` | `/api/energy/summary` | `energy.read` | all |
| `GET` | `/api/energy/summary/{period}` | `energy.read` | all |
| `GET` | `/api/energy/series` | `energy.read` | all |
| `GET` | `/api/energy/series/{meter}/{period}/{step}` | `energy.read` | all |
| `POST` | `/api/services/{domain}/{service}` | `values.write`, `alarms.ack`, `helpers.write`, `scripts.run`, `recipes.apply` (in handler) | all |
| `GET` | `/api/helpers` | `entities.read` | all |
| `POST` | `/api/helpers` | `entities.write` | all |
| `GET` | `/api/helpers/{entity_id}` | `entities.read` | all |
| `PUT` | `/api/helpers/{entity_id}` | `entities.write` | all |
| `DELETE` | `/api/helpers/{entity_id}` | `entities.write` | all |
| `GET` | `/api/equipment` | `equipment.read` | all |
| `POST` | `/api/equipment` | `equipment.write` | all |
| `GET` | `/api/equipment/{id}` | `equipment.read` | all |
| `PUT` | `/api/equipment/{id}` | `equipment.write` | all |
| `DELETE` | `/api/equipment/{id}` | `equipment.write` | all |
| `GET` | `/api/labels` | `equipment.read` | all |
| `POST` | `/api/labels` | `equipment.write` | all |
| `GET` | `/api/labels/{label_id}` | `equipment.read` | all |
| `PUT` | `/api/labels/{label_id}` | `equipment.write` | all |
| `DELETE` | `/api/labels/{label_id}` | `equipment.write` | all |
| `PUT` | `/api/devices/{id}/labels` | `equipment.write` | all |
| `GET` | `/api/alarms` | `alarms.read` | all |
| `POST` | `/api/alarms` | `alarms.write` | all |
| `POST` | `/api/alarms/import/codesys` | `alarms.write` | all |
| `DELETE` | `/api/alarms/{id}` | `alarms.write` | all |
| `POST` | `/api/alarms/{id}/ack` | `alarms.ack` | all |
| `POST` | `/api/alarms/{id}/shelve` | `alarms.ack` | all |
| `POST` | `/api/alarms/{id}/unshelve` | `alarms.ack` | all |
| `GET` | `/api/alarms/events` | `alarms.read` | all |
| `GET` | `/api/automations` | `automations.read` | all |
| `POST` | `/api/automations` | `automations.write` | all |
| `POST` | `/api/automations/validate` | `automations.write` | all |
| `DELETE` | `/api/automations/{id}` | `automations.write` | all |
| `POST` | `/api/automations/{id}/enabled` | `automations.write` | all |
| `POST` | `/api/automations/{id}/trigger` | `automations.trigger` | all |
| `GET` | `/api/runs` | `automations.read` | all |
| `POST` | `/api/automations/{id}/blueprint-upgrade` | `blueprints.apply` | all |
| `GET` | `/api/blueprints` | `blueprints.read` | all |
| `POST` | `/api/blueprints` | `blueprints.write` | all |
| `GET` | `/api/blueprints/{id}` | `blueprints.read` | all |
| `PUT` | `/api/blueprints/{id}` | `blueprints.write` | all |
| `DELETE` | `/api/blueprints/{id}` | `blueprints.write` | all |
| `POST` | `/api/blueprints/{id}/instantiate` | `blueprints.apply` | all |
| `GET` | `/api/dashboards` | `dashboards.read` | all |
| `POST` | `/api/dashboards` | `dashboards.write` | all |
| `GET` | `/api/dashboards/{id}` | `dashboards.read` | all |
| `PUT` | `/api/dashboards/{id}` | `dashboards.write` | all |
| `DELETE` | `/api/dashboards/{id}` | `dashboards.write` | all |
| `GET` | `/api/dashboards/{id}/export` | `dashboards.read` | all |
| `POST` | `/api/dashboards/import` | `dashboards.write` | all |
| `GET` | `/api/scripts` | `scripts.read` | all |
| `POST` | `/api/scripts` | `scripts.write` | all |
| `POST` | `/api/scripts/validate` | `scripts.write` | all |
| `GET` | `/api/scripts/{id}` | `scripts.read` | all |
| `PUT` | `/api/scripts/{id}` | `scripts.write` | all |
| `DELETE` | `/api/scripts/{id}` | `scripts.write` | all |
| `POST` | `/api/scripts/{id}/run` | `scripts.run` | all |
| `POST` | `/api/scripts/{id}/stop` | `scripts.run` | all |
| `GET` | `/api/scripts/{id}/runs` | `scripts.read` | all |
| `GET` | `/api/recipes` | `recipes.read` | all |
| `POST` | `/api/recipes` | `recipes.write` | all |
| `POST` | `/api/recipes/capture` | `recipes.write` | all |
| `GET` | `/api/recipes/{id}` | `recipes.read` | all |
| `PUT` | `/api/recipes/{id}` | `recipes.write` | all |
| `DELETE` | `/api/recipes/{id}` | `recipes.write` | all |
| `GET` | `/api/recipes/{id}/versions` | `recipes.read` | all |
| `GET` | `/api/recipes/{id}/versions/{version}` | `recipes.read` | all |
| `POST` | `/api/recipes/{id}/validate` | `recipes.apply` | all |
| `POST` | `/api/recipes/{id}/apply` | `recipes.apply` | all |
| `GET` | `/api/recipes/{id}/applications` | `recipes.read` | all |
| `POST` | `/api/webhook/{path}` | none | all |
| `GET` | `/api/fleet` | `fleet.read` | gateway |
| `POST` | `/api/fleet` | `fleet.write` | gateway |
| `DELETE` | `/api/fleet/{id}` | `fleet.write` | gateway |
| `POST` | `/api/fleet/{id}/rebirth` | `fleet.rebirth` | gateway |
| `POST` | `/api/fleet/{id}/restart` | `fleet.restart` | gateway |
| `POST` | `/api/fleet/{id}/update` | `fleet.update` | gateway |
| `POST` | `/api/fleet/{id}/config` | `fleet.config` | gateway |
| `DELETE` | `/api/fleet/{id}/config` | `fleet.config` | gateway |
| `POST` | `/api/notify/test` | `notify.test` | all |
| `GET` | `/api/notify/escalation` | `notify.escalation` | all |
| `PUT` | `/api/notify/escalation` | `notify.escalation` | all |
| `POST` | `/api/notify/ack/{token}` | none | all |
| `GET` | `/api/backup` | `backup.read` | all |
| `POST` | `/api/backup` | `backup.run` | all |
| `GET` | `/api/reports` | `reports.read` | gateway |
| `POST` | `/api/reports` | `reports.write` | gateway |
| `GET` | `/api/reports/{id}` | `reports.read` | gateway |
| `PUT` | `/api/reports/{id}` | `reports.write` | gateway |
| `DELETE` | `/api/reports/{id}` | `reports.write` | gateway |
| `POST` | `/api/reports/{id}/run` | `reports.run` | gateway |
| `GET` | `/api/reports/{id}/runs` | `reports.read` | gateway |
| `GET` | `/api/reports/{id}/runs/{run}/download` | `reports.read` | gateway |
| `GET` | `/api/sites` | `sites.read` | gateway |
| `GET` | `/api/settings` | `settings.read` | all |
| `PUT` | `/api/settings` | `settings.write` | all |
| `GET` | `/api/historian/targets` | `settings.read` | all |
| `POST` | `/api/historian/targets` | `settings.write` | all |
| `PUT` | `/api/historian/targets/{id}` | `settings.write` | all |
| `DELETE` | `/api/historian/targets/{id}` | `settings.write` | all |
| `GET` | `/api/events` | `events.read` | all |
| `GET` | `/api/logbook` | `logbook.read` | all |
| `GET` | `/api/stream` | `status.read` | all |
| alle | `/mcp` | MCP-token | all |
| alle | `/mcp/` | MCP-token | all |
| `GET` | `/manifest.webmanifest` | none | all |
| `GET` | `/sw.js` | none | all |
| `GET` | `/next` | none | all |
| `GET` | `/next/` | none | all |
| alle | `/` | none | all |

## Helse

For kubelet og lastbalansererne. Ingen av dem trenger en økt: en probe har ingen konto, og ingen av dem sier noe om anlegget.

### `GET /healthz`

Liveness. `200` med teksten `ok` så lenge prosessen serverer HTTP. Den rører ikke databasen, med vilje: et databaseavbrudd skal ta poden ut av rotasjon, ikke få den startet på nytt i en løkke.

### `GET /readyz`

Readiness. Pinger databasen med et tidsbudsjett på 5 sekunder.

```json
{"status":"ready"}
```

`503` når den ikke når den, med årsaken i `detail` (formen kommer fra handleren; årsaksteksten er det databasedriveren sa):

```json
{"error":"not ready","detail":"<why the database did not answer>"}
```

En app som ikke når historianen sin, bør ikke få trafikk.

## Autentisering

Se [Autentisering og brukere](/nb/iot/authentication/) for kontoer, roller og den første administratoren.

### `POST /api/auth/login`

Ingen økt trengs, av konstruksjon.

| Felt | Type | <span class="sr-only">Detaljer</span> |
|---|---|---|
| `username` | string | Påkrevd. Store og små bokstaver og omkringliggende mellomrom ignoreres |
| `password` | string | Påkrevd |

```json
{"expiresAt":"2026-09-28T08:21:00.571794Z","permissions":["*"],"role":"admin","token":"<token>","username":"admin"}
```

Setter også cookien `iiot_session` til det samme tokenet. `401` `"invalid username or password"` for feil navn, feil passord eller en deaktivert konto uten forskjell, og det tar like lang tid uansett: hvilken av de tre det var, er ikke noe man forteller en fremmed. `429` for en konto som har hatt for mange feil passord eller PIN-koder på rad, uansett hva som sendes, med en `Retry-After`-header; se [Autentisering og brukere](/nb/iot/authentication/#låsing-etter-feil-passord-og-pin).

### `POST /api/auth/kiosk`

Logg inn på et delt panel med en PIN eller et adgangskort, slik [Autentisering og brukere](/nb/iot/authentication/#kioskpaneler-pin-eller-adgangskort-og-utlogging-ved-inaktivitet) beskriver. Ingen økt trengs, av konstruksjon.

| Felt | Type | <span class="sr-only">Detaljer</span> |
|---|---|---|
| `code` | string | Påkrevd. PIN-en, eller verdien en adgangskortleser i tastaturmodus skrev. Omkringliggende mellomrom ignoreres |
| `username` | string | Valgfritt. Med den sjekkes bare PIN-en til den kontoen, og en feil teller mot utestengingen av den kontoen. Uten den letes koden opp blant alle kontoers |

```json
{"expiresAt":"2026-10-21T08:21:00.571794Z","idleSec":300,"permissions":["status.read","tags.read"],"role":"operator","username":"olga"}
```

Setter cookien `iiot_session` og svarer, i motsetning til `POST /api/auth/login`, ikke med tokenet: en kioskøkt tilhører nettleseren på panelet. `idleSec` er hvor lenge økten overlever uten at noen rører den. `401` `"that PIN or badge isn't recognized"` for feil kode, en for kort kode og koden til en deaktivert konto uten forskjell, og det tar like lang tid uansett. `429` når kontoen er utestengt (se [Utestengingen](/nb/iot/authentication/#låsing-etter-feil-passord-og-pin)), med en `Retry-After`-header. En kode sendt uten `username` som ikke passer noen, telles ikke mot noen konto; panelet som sendte den, etter klientadresse, venter et halvt sekund lenger før neste slike forsøk sjekkes, opptil `ui.panelDelaySeconds`, og en riktig starter det på nytt. Panelet blir aldri utestengt. `400` når installasjonen kjører uten innlogging (`HOTLOOP_AUTH_INSECURE`), siden det da ikke er noen å logge inn som.

### `POST /api/auth/activity`

En person rørte panelet. Ingen body. `{"status":"ok"}`. På en kioskøkt er det dette som flytter hviletidsgrensen fram; det gjør også enhver annen forespørsel som ikke er en lesing (en skriving, en kvittering). En `GET`, direktestrømmen og sidens egne bakgrunnslastinger gjør det ikke: de ville ellers holdt den siste personen innlogget for alltid. En økt laget med passord har ingen hviletidsgrense og ingenting å flytte.

### `POST /api/auth/logout`

Avslutter økten forespørselen kom med (cookie eller bearer) og fjerner cookien. Ingen body. `{"status":"logged out"}`.

### `GET /api/auth/session`

Hvem er jeg. For oppstartssekvensen til brukergrensesnittet.

```json
{"authenticated":true,"permissions":["*"],"role":"admin","username":"admin"}
```

En økt laget på et kioskpanel legger til `"idleSec"`, hviletidsgrensen i sekunder, og det er slik siden vet at den skal logge seg selv ut.

Med autentisering slått av (`HOTLOOP_AUTH_INSECURE`) svarer den `{"authenticated":false,"insecure":true}` i stedet for en 401, slik at brukergrensesnittet kan si hvorfor det ikke finnes innlogging i stedet for å gjette.

### `POST /api/auth/password`

Bytt ditt eget passord. Ingen tillatelse: å kjenne det nåværende passordet er påloggingen.

| Felt | Type | <span class="sr-only">Detaljer</span> |
|---|---|---|
| `currentPassword` | string | Påkrevd |
| `newPassword` | string | Påkrevd, minst 8 tegn |

`{"status":"password changed; log in again"}`. **Hver økt kontoen har, avsluttes, også denne**, og cookien fjernes: en passordendring som lar de gamle øktene virke, er en endring bare i navnet. `401` hvis det nåværende passordet er feil, `400` hvis det nye er for kort.

## Brukere

Alt er bare for administratorer (`users.manage`). Passord-hasher vises aldri i et svar; feltet har ikke noe JSON-navn.

### `GET /api/users`

```json
[{"username":"admin","role":"admin","disabled":false,"hasPin":false,"locked":false,"createdAt":"2026-09-27T20:19:28.036228Z","updatedAt":"2026-09-27T20:19:28.036228Z","lastLogin":"2026-09-27T20:21:00.575455Z"}]
```

`permissions` vises bare på en konto som har en uttrykkelig liste. `hasPin` sier om kontoen har en kiosk-PIN eller et adgangskort; verdien og hashen vises aldri.

### `POST /api/users`

| Felt | Type | <span class="sr-only">Detaljer</span> |
|---|---|---|
| `username` | string | Påkrevd. Små bokstaver, sifre, punktum, understrek, bindestrek, som begynner med en bokstav eller et siffer, 2 til 64 tegn |
| `password` | string | Påkrevd, minst 8 tegn |
| `role` | string | `admin`, `operator` eller `viewer`. Standard er `viewer` |
| `permissions` | string[] | Valgfritt. Erstatter rollens sett helt |

Svarer med den nye brukeren. `400` for feil navn, rolle eller passord, `409` hvis navnet er tatt.

### `PUT /api/users/{username}`

| Felt | Type | <span class="sr-only">Detaljer</span> |
|---|---|---|
| `role` | string | Påkrevd med mindre `permissions` er satt |
| `permissions` | string[] | Valgfritt. Tom betyr «bruk rollen» |
| `disabled` | bool | `true` deaktiverer kontoen og avslutter hver økt den har |

Svarer med den oppdaterte brukeren. `400` for en ukjent rolle, eller for å deaktivere den siste aktiverte administratoren: det ville vært en utestengelse uten noen igjen til å oppheve den. `404` for en ukjent bruker.

### `DELETE /api/users/{username}`

`{"status":"deleted"}`. `400` for din egen konto eller den siste aktiverte administratoren, `404` for en ukjent bruker.

### `POST /api/users/{username}/password`

En administrator setter en annens passord uten å kjenne det gamle. `{"password": "..."}`, minst 8 tegn. Svarer `{"status":"password reset"}` og avslutter hver økt den kontoen har.

### `PUT /api/users/{username}/pin`

En administrator gir en konto en PIN eller en adgangskortverdi for innlogging på et kioskpanel, eller erstatter den den har. `{"code": "482913"}`: 6 til 72 tegn, ingen mellomrom eller kontrolltegn, sifre eller alt annet en adgangskortleser skriver. Svarer `{"status":"PIN set","username":"olga","hasPin":true}`. Verdien hashes med bcrypt, som et passord, og logges eller sendes aldri tilbake. `400` for en kode som er for kort, for lang eller har et mellomrom i seg, og for en kode en annen konto allerede har: et panel finner kontoen på koden alene, så én kode åpner én konto. `404` for en ukjent bruker. Den rører verken passordet eller noen økt.

### `DELETE /api/users/{username}/lockout`

Slipper en utestengt konto inn igjen før utestengingen går ut, og setter tellingen av feil passord og PIN-koder tilbake til null. `{"status":"unlocked","username":"olga","locked":false}`. `404` for en ukjent bruker. En utestengt konto viser `"locked":true` og `"lockedUntil"` i `GET /api/users`.

### `DELETE /api/users/{username}/pin`

Tar bort PIN-en eller adgangskortet og logger kontoen ut av hvert kioskpanel den er innlogget på. Passordet og øktene på den egne datamaskinen røres ikke. `{"status":"PIN cleared","username":"olga","hasPin":false}`. `404` for en ukjent bruker.

### `GET /api/opcua/certificates`

Hvert X.509-sertifikat knyttet til en bruker for innlogging på OPC UA-serveren (se [OPC UA-serveren](/nb/edge/opc-ua-server/#x509-brukersertifikater)), det nyeste først: `{"serverAcceptsCertificates":false,"certificates":[...]}`. Hvert har `thumbprint` (SHA-256 av DER-formen, heksadesimalt med små bokstaver), `username`, `label`, `subject`, `notBefore`, `notAfter`, `addedBy`, `addedAt`, `revokedAt` og `revokedBy` etter tilbakekalling, `lastUsed` etter bruk, og `state`: `active`, `revoked`, `expired` eller `not yet valid`. Bare et aktivt sertifikat logger noen inn. `serverAcceptsCertificates` sier om OPC UA-serveren er på og har `HOTLOOP_OPCUA_SERVER_ALLOW_X509` satt; sertifikatene beholdes uansett. Bare det offentlige sertifikatet lagres eller sendes.

### `GET /api/users/{username}/certificates`

Den samme listen for én bruker. `404` for en ukjent bruker.

### `POST /api/users/{username}/certificates`

Knytter et sertifikat til en bruker. `{"certificate": "<PEM text or base64 of the DER bytes>", "label": "Olga's laptop"}`; etiketten er valgfri. Svarer `201` med sertifikatet slik det er listet. Sertifikatet må være RSA med en nøkkel på minst 2048 bit og må ikke være utløpt. `400` sier hvilken av disse det er, og også for noe som ikke er et sertifikat: en privat nøkkel avvises ved navn og beholdes eller ekkoes aldri, og det samme gjelder en kjede. `404` for en ukjent bruker. `409` når sertifikatet allerede er knyttet, til denne brukeren eller en annen: ett sertifikat er én person. Endringen står i loggboken med hvem som gjorde den.

### `POST /api/users/{username}/certificates/{thumbprint}/revoke`

Tilbakekaller et sertifikat. Det kan ikke lenger logge inn, en økt åpnet med det avsluttes innen de 10 sekundene i tillatelsesbufferen, og senere forsøk avvises og logges som tilbakekalt. Det blir stående oppført som `revoked` med hvem som gjorde det og når, og å tilbakekalle det igjen beholder den første posten. `{thumbprint}` er SHA-256 slik den er listet; kolon, mellomrom og store bokstaver godtas. `404` når sertifikatet ikke tilhører denne brukeren.

### `DELETE /api/users/{username}/certificates/{thumbprint}`

Glemmer et sertifikat. Å knytte det til igjen får det til å virke igjen. `404` når det ikke tilhører denne brukeren. Å slette brukeren sletter sertifikatene.

## Status og diagnostikk

### `GET /api/status`

Toppraden: kjøretidstellere, alarmoppsummeringen, anleggets navn og hvilket produkt dette er. `product` er `iot`, `edge` eller `gateway`, det samme som `hotloop --product`. `features` er hvilke av funksjonene som er forskjellige mellom produktene dette har: `edge-publish`, `fleet`, `opcua-server`, `reports` og `sites` i en Gateway, den første og tredje i Edge, ingen i IoT. `version` er bygget, og `imageDigest` er digesten til imaget det ble startet fra, noe et versjonsnummer ikke kan fortelle deg på en boks som følger `:stable`. Den er der bare når supervisoren sa det (Quadlet-enhetene gjør det, før hver oppstart; en bar binærfil og en Helm-installasjon kan ikke) og utelates ellers.

```json
{
  "alarms": {"critical":0,"high":1,"medium":0,"low":0,"unacked":0,"total":1},
  "features": ["edge-publish","fleet","opcua-server","reports","sites"],
  "plantName": "Demo Plant",
  "product": "gateway",
  "runtime": {
    "startedAt": "2026-09-27T20:19:28.06635851Z", "uptime": "11m13s",
    "devices": 2, "connected": 2, "degraded": 0, "disconnected": 0,
    "tags": 5, "cachedTags": 5, "writesOk": 4, "writesRefused": 3,
    "bus": {"subscribers":4,"published":653,"dropped":0},
    "historian": {"queued":1085,"written":1085,"filtered":329,"dropped":0,"failed":0,"queueLen":0,"queueCap":50000},
    "writePolicy": {"allowWrites":true,"allowMcpWrites":true,"confirmWrites":true},
    "protocols": ["codesys","ethernet-ip","http","modbus","mqtt","mtconnect","opcua","s7comm","snmp","unifi"]
  },
  "siteId": "docs",
  "version": "4.23.2"
}
```

### `GET /api/protocols`

Hver protokoll Gateway kjenner, og om dette bygget har driveren for den.

```json
[{"id":"opcua","name":"OPC UA","description":"The universal one. ...","transport":"opc.tcp binary","defaultPort":4840,"writable":true,"browsable":true,"deviceTypes":["plc","cnc","robot","ipc","hmi","historian","gateway"],"library":"...","available":true}]
```

### `GET /api/diagnostics`

Det diagnoseskjermen viser: databasepoolen, historiankøen og historikkstørrelsen, tag-bussen, entitetsmotoren, loggbokens opptaker, kjøretiden, MCP (server og utgående tilkoblinger) og automasjonsmotorens armerte regler, webhook-stier og køen for tilstandsendringer.

```json
{
  "automations": {"armed":[],"stateChangesDropped":0,"stateChangesPending":0,"webhooks":[]},
  "bus": {"subscribers":4,"published":654,"dropped":0},
  "database": {"type":"postgres","totalConns":3,"idleConns":3,"acquiredConns":0,"maxConns":10,"historyMode":"timescale","timescaleVersion":"2.30.1"},
  "entities": {"entities":8,"droppedBatches":0,"pendingChanges":0,"droppedChanges":0},
  "historian": {"queued":1087,"written":1085,"filtered":329,"dropped":0,"failed":0,"queueLen":0,"queueCap":50000},
  "historyStats": {"mode":"timescale","rows":996,"distinctTags":5,"oldest":"2026-09-27T20:21:38.609853Z","newest":"2026-09-27T20:30:39.507987Z","sizeBytes":73728},
  "logbook": {"recording":true,"retentionDays":90,"queued":0,"dropped":0,"written":212,"suppressed":36,"writeErrors":0},
  "mcp": {"outbound":[],"path":"/mcp","serverEnabled":true,"tokenSet":true},
  "runtime": {"...": "the same block as /api/status"}
}
```

Med utgående MCP-servere konfigurert lister `outbound` hver av dem:

```json
{"name":"plant-a","target":"http://localhost:8080/mcp","connected":true,"tools":["ack_alarm","call_service","...","write_tag"],"connectedSince":"2026-09-27T20:45:50Z"}
```

Alle påloggingsdata i `target` eller `lastError` til en utgående server fjernes, fordi en URL eller en kommandolinje kan bære et token og hver rolle kan lese dette. Selve MCP-tokenet er bare noensinne `tokenSet`.

## Enheter

En enhet er én tilkobling over én protokoll. Hva som går i `config` og `address`, avhenger av protokollen: se [Protokoller og drivere](/nb/iot/protocols/).

### `GET /api/devices`

Hver enhet, med sin levende tilkoblingstilstand. Påloggingsinformasjon er `[redacted]`. `?q=` beholder enhetene der id, navn, adresse eller protokoll inneholder teksten (uten hensyn til store og små bokstaver), `?limit=` (1 til 5000, alt annet gir `400`) de første av dem; med en av dem sier `X-Total-Count` hvor mange som traff.

```json
[{"id":"tank-farm","name":"Tank farm","protocol":"mqtt","address":"base-mqtt:1883","enabled":true,
  "site":"Demo Plant","area":"Utilities","equipmentId":4,
  "config":{"clientId":"docs-api-tankfarm","password":"[redacted]","topics":["docs-api-example/#"],"username":"tank","writeTopic":"docs-api-example/{tag}/set"},
  "createdAt":"2026-09-27T20:21:01.637319Z","updatedAt":"2026-09-27T20:21:01.637319Z",
  "state":"connected","lastPoll":"2026-09-27T20:21:39.412Z",
  "latencyMs":0.002,"tagCount":3,"pollCount":1}]
```

`state` er `connected`, `connecting`, `degraded` (oppe, men avlesninger feiler), `disconnected` eller `disabled`. `lastError`, `errorCount` og resten vises når det er noe å si.

### `POST /api/devices`

Oppretter enheten hvis `id` er ny, og erstatter den ellers. Det finnes ingen `PUT`.

| Felt | Type | <span class="sr-only">Detaljer</span> |
|---|---|---|
| `id` | string | Påkrevd. 1 til 64 bokstaver, sifre, `.`, `_`, `-`, som begynner alfanumerisk. Den havner i URL-er, MQTT-topics og MCP-argumenter |
| `name` | string | Påkrevd |
| `protocol` | string | Påkrevd. En dette bygget har driver for (`GET /api/protocols`) |
| `address` | string | Påkrevd. Vert og port, eller en URL `opc.tcp://` eller `http://`: protokollen avgjør |
| `enabled` | bool | Utelatt er den `false` |
| `description` | string | |
| `pollIntervalMs`, `timeoutMs` | int | 0 tar kjøretidens standard. Avlesningsintervallet har `HOTLOOP_MIN_POLL_INTERVAL` som gulv |
| `site`, `area`, `line` | string | Plasserer enheten i utstyrstreet etter navn og oppretter noder ved behov |
| `equipmentId` | int | Plasserer den i stedet på en node i treet; `site`, `area` og `line` kommer da fra noden. Se [utstyrstreet og etikettene](/nb/iot/equipment/) |
| `config` | object | Protokollens egne alternativer. Påloggingsinformasjon følger [skrive-bare-reglene](#hemmeligheter-er-bare-skrivbare) |

Kjøretidsfelt (`state`, `lastPoll`, `tagCount` og så videre) er skrivebeskyttet; sender du dem tilbake, ignoreres de. Svarer med den lagrede enheten, sladdet. `400` for en protokoll uten driver, en mislykket validering eller en regel for påloggingsinformasjon; kjøretiden laster seg på nytt med den med en gang.

```json
{"error":"no driver for protocol \"profibus\"; this build speaks: ethernet-ip, http, modbus, mqtt, mtconnect, opcua, s7comm, snmp, unifi"}
```

### `GET /api/devices/{id}`

Enheten, tagsene og etikettene.

```json
{"device":{"id":"tank-farm","name":"Tank farm","...":"..."},"labels":["critical"],"tags":[{"id":3,"deviceId":"tank-farm","name":"level","...":"..."}]}
```

`tags` er `[]` for en enhet uten noen. `404` for en ukjent id.

### `DELETE /api/devices/{id}`

Sletter enheten, tagsene og entitetene deres. **Historikken beholdes.** `{"deleted":"tank-farm"}`, eller `404`.

### `POST /api/devices/{id}/enabled`

`{"enabled": false}` stopper avlesningen uten å slette noe. Svarer `{"enabled":false,"id":"tank-farm"}`. `404` for en ukjent id.

### `POST /api/devices/{id}/browse`

Spør enheten hvilke punkter den har. Trenger bare `devices.read`, fordi den leser. Ingen body.

```json
{"supported":true,"tags":[{"name":"Plant_Boiler_Temperature","address":"nsu=http://plant/;s=Temperature","dataType":"float","description":"Temperature","writable":true}]}
```

En protokoll som ikke kan liste punktene sine (Modbus, S7comm, HTTP), svarer `200` med `{"supported":false,"reason":"..."}`: det er en kjensgjerning om protokollen, ikke en feil. `503` hvis enheten ikke er tilkoblet. `writable` her er det enheten sier om punktet, ikke om Gateway kommer til å skrive det.

### `POST /api/devices/{id}/import`

Gjør nettleserresultater om til konfigurerte tags. Trenger `tags.write`, fordi den oppretter tags.

```json
{"tags":[{"name":"Temperature","address":"nsu=http://emberburn/;s=Temperature","dataType":"float","unit":"C"}]}
```

Hver oppføring tar `name`, `address`, `dataType`, `unit`, `description`, `deviceClass` og `writable` (nettleserresultatet slik det kom). Svarer `{"inserted":2,"updated":0}`. **Hver importerte tag er skrivebeskyttet**, uansett hva enheten sa: et oppdaget punkt er ikke et punkt noen har bestemt kan kommanderes, og å gjøre det motsatte som standard ville armert noen tusen av dem på én gang. Armer de du mener med `POST /api/tags`. `404` for en ukjent enhet.

## UniFi: OT-nettverk, klienter og hvor en enhet er i nettverket

HotLoops egen oversikt over UniFi-lokasjoner. Se [UniFi Network](/nb/iot/unifi/). `{id}` under `/api/unifi` er en UniFi-enhet (én lokasjon på én konsoll); `{network}` er konsollens egen ID for et nettverk, slik `GET .../networks` gir den; `{mac}` tar enhver vanlig skrivemåte og lagres med små bokstaver og kolon.

**Ingen av disse spør konsollen om noe.** De leser driverens siste avlesning av den, så en skjerm som står åpen koster konsollen ingenting. Det betyr også at de svarer `503` til enheten er lest én gang, og alltid i en `--mcp-stdio`-hjelper, som aldri logger inn på en konsoll. Ingen av dem skriver heller til en konsoll.

En endring som lager eller fjerner en alarm sier det i `change`: `{"alarmsCreated":["unifi-unknown-3f2a9c01b7de"]}`. Det er vanlige alarmdefinisjoner under `/api/alarms`.

### `GET /api/devices/{id}/network`

Hvor en HotLoop-enhet (en PLS, en måler) er i nettverket. Koblet:

```json
{"deviceId":"plc-07","link":{"deviceId":"plc-07","consoleId":"plant-net","mac":"02:48:4c:00:00:07","confirmedBy":"hana","confirmedAt":"2026-09-28T18:02:05Z"},
 "consoleName":"Plant network","client":{"mac":"02:48:4c:00:00:07","ip":"10.77.0.7","switchMac":"00:27:22:e2:1d:6f","switchName":"USW Lite 8 PoE","port":5,"portUp":false,"online":false,"lastSeen":"2026-09-28T18:01:40Z","lastSeenSec":25,"why":"its switch port 5 has no link","...":"..."},
 "readAt":"2026-09-28T18:02:05Z","summary":"on USW Lite 8 PoE port 5, link down; the console last saw it 25s ago; off the network: its switch port 5 has no link","proposals":[]}
```

Hvis den ikke er koblet, er `link` `null`, og `proposals` lister klientene en hvilken som helst konsoll HotLoop leser har på enhetens IP, de nyeste først. Et forslag er bare det: konsollens IP-er henger etter, så ingenting kobles før en administrator bekrefter ett.

### `PUT /api/devices/{id}/network`

`{"consoleId":"plant-net","mac":"02:48:4c:00:00:07"}` bekrefter hvilken klient enheten er. Fra da av er MAC-adressen nøkkelen, og IP-en stoles aldri på igjen. Klienten får tags (`c.<mac>.*` på konsollen) og en alarm, «PLC-07 av nettverket», prioritet 1 med 120 s påslagsforsinkelse slik at en omstart ikke varsler noen. Svarer `{"link":{...},"change":{...}}`. `400` hvis `consoleId` ikke er en UniFi-enhet eller MAC-adressen ikke er en MAC, `404` for en ukjent enhet.

### `DELETE /api/devices/{id}/network`

Fjerner koblingen, og alarmen HotLoop lagde for den, med mindre klienten fortsatt overvåkes fra en liste over kjente. `404` hvis det ikke var noen kobling.

### `GET /api/unifi/{id}/networks`

Lokasjonens nettverk slik konsollen har dem, med HotLoops oversikt: `ot`, `known` (hvor mange enheter som står på listen), `clients` (på det nå) og `unknown` (på det nå og ikke på listen). Et nettverk HotLoop har en post om og som konsollen ikke lenger har, kommer tilbake med `"onConsole":false`.

```json
[{"networkId":"6abb23d25a95f2636a5df29c","name":"SCADA","purpose":"corporate","vlan":122,"subnet":"10.122.0.1/24","onConsole":true,"ot":true,"clients":2,"known":1,"unknown":[{"mac":"02:9b:b1:69:88:f2","ip":"10.122.0.66","switchName":"USW Lite 8 PoE","port":6,"...":"..."}],"changedBy":"hana"}]
```

### `PUT /api/unifi/{id}/networks/{network}`

`{"ot": true}` merker et nettverk som OT. Alt på det som ikke står på listen over kjente, teller i `n.<network>.unknown` og navngir seg i `.unknown_last`, og HotLoop lager alarmen «Ukjent enhet på SCADA», prioritet 1. `{"ot": false}` fjerner merkingen og fjerner den alarmen; listen over kjente beholdes. `400` for et WAN eller et nettverk konsollen ikke har.

### `POST /api/unifi/{id}/networks/{network}/accept-all`

Godtar alt som er på nettverket nå, slik det er: det ene klikket etter at du har merket det. Enheter som allerede står på listen, beholder navn og overvåking. Ingen body. Svarer `{"accepted":[{known device}...]}`, de den la til.

### `GET /api/unifi/{id}/known`

Hver kjente enhet på lokasjonens nettverk: `[{"deviceId":"plant-net","networkId":"...","mac":"...","name":"PLC-07","watch":true,"acceptedBy":"hana","acceptedAt":"..."}]`.

### `PUT /api/unifi/{id}/networks/{network}/known/{mac}`

`{"name":"PLC-07","watch":true}` godtar en enhet på nettverket, eller endrer navnet eller overvåkingen. `watch` gir den tags og frakoblingsalarmen; en enhet som er tillatt, men kommer og går (en vedlikeholds-PC), godtas uten. `400` hvis nettverket aldri ble merket som OT.

### `DELETE /api/unifi/{id}/networks/{network}/known/{mac}`

Tar en enhet av listen. Er den på nettverket, er den ukjent igjen ved neste avlesning.

### `GET /api/unifi/{id}/clients`

Hver klient konsollen lister, pluss hver overvåket en den ikke lister, hver med hvor den er, om den er online, og `ot`, `known`, `watched`, `linkedTo` og en enlinjes `summary`. `?q=` snevrer inn til en MAC, IP eller et navn.

### `GET /api/unifi/consoles`

Hver UniFi-enhet HotLoop har, kjørende eller ikke, til velgeren på UniFi-skjermen: `[{"id":"plant-net","name":"Plant network","address":"https://...","enabled":true,"running":true,"site":"default","version":"10.6.106","readAt":"...","devices":4,"online":4,"clients":12,"failover":false,"eventsLive":true}]`. En konsoll denne prosessen ikke har lest, sier hvorfor i `why`.

### `GET /api/unifi/{id}/overview`

Oversiktskortet: antall enheter og klienter (en klient teller når HotLoop tror den er på nettverket, testen `n.<id>.clients`-tagsene bruker, ikke bare når konsollen lister den), klienter per nettverk, konsollens `health` for delsystemene, og for hver gateway WAN-stripen, `gateways[]`: én `wans[]`-oppføring per WAN med `alive` (gatewayens egne helsesjekker, aldri `up` i WAN-blokken), `known`, `active`, `backup`, ventetid og tilgjengelighet. `failover` er trafikk på et WAN som ikke er det første, `down` er ingen WAN i live, og `since` er den første avlesningen der HotLoop så trafikk på WAN-et den er på nå, som er da HotLoop la merke til det, ikke da gatewayen byttet. `events` er tilstanden til hendelses-websocketen (`live`, `error`, `reconnects`) og de ti nyeste hendelsene.

### `GET /api/unifi/{id}/topology`

Kartet. `nodes[]` er de adopterte enhetene med plassen sin på rutenettet (`x`, `y`, `layer`: fra venstre til høyre fra gatewayen, lagt ut på samme måte for samme avlesning), `edges[]` kablene mellom dem fra konsollens egen `downlink_table`, `wired[]` og `wifi[]` klientene som henger på hver svitsjport og hver AP og SSID. En enhet ingenting lister som koblet til noe, tegnes alene med `noUplink` satt, ikke hengt på gatewayen på en gjetning. En enhet fra en annen UniFi-konsoll HotLoop leser og som denne konsollen lister som klient, sys inn som en node med `external` satt og en kant med `stitched`. `feeds` er, per enhets-MAC, HotLoop-enhetene som er koblet til en klient nedstrøms for den, med `equipmentId` for anleggstreet, og `links` de samme enhetene per klient-MAC.

### `GET /api/unifi/{id}/devices`

Hver adopterte enhet med tallene sine og `ports[]` for frontplaten: lenke, hastighet, PoE-modus og -forbruk, klientene lært på porten, enheten som er koblet til den, og `dropped` for en port som var oppe ved en tidligere avlesning og er nede nå. En enhet konsollen har mistet, rapporterer ingen tall og ingen portlenker, fordi det den sa sist ikke er gjeldende.

### `GET /api/unifi/{id}/wifi`

Lokasjonens SSID-er med `enabled`, nettverket de ligger på og hvor mange klienter som er på hver. Når konsollen ikke viser denne kontoen de trådløse nettverkene sine, sier `error` hvorfor og `wlans` er tom.

### `GET /api/unifi/{id}/events`

De nyeste hendelsene konsollen har rapportert siden HotLoop koblet til, de nyeste først (`?limit=` opptil 200, standard 50), og tilstanden til hendelses-websocketen. Hver hendelse har kontrollerens `key` (`EVT_SW_Lost_Contact`), sin egen `message`, `severity` (`warning` når kontrolleren markerer den som noe som går galt) og enheten, klienten og porten den gjelder. De står også i loggboken, arkivert under svitsjen eller aksesspunktet de gjelder (se [UniFi Network](/nb/iot/unifi/#hendelser)).

### `POST /api/unifi/{id}/starter-alarms`

Lager de vanlige alarmene for lokasjonen ut fra det konsollen har nå, som vanlige alarmdefinisjoner under `/api/alarms`: hver adopterte enhet frakoblet (prioritet 2, 60 s påslagsforsinkelse), hver opplenkeport nede (prioritet 1, 10 s), en gateway med to eller flere WAN som kjører på et reserve-WAN (prioritet 2, 30 s). Bodyen er valgfri. `{"poeLimitW": 25}` legger til en prioritet 3-alarm på `poe_w`-forbruket til hver PoE-port over så mange watt, 30 s forsinkelse; konsollen sier ikke hva budsjettet til en port er, så HotLoop gjetter ikke på ett. En negativ grense gir `400`.

```json
{"created":[{"id":"unifi-devoffline-9c1e2a77b3d0","name":"USW Lite 8 PoE offline","kind":"offline","tag":"d.002722e2e633.online","priority":2}],
 "kept":[]}
```

`kept` er alarmer settet krever og som allerede var der: dets egne fra et tidligere trykk, eller noens egen alarm på samme tag. Det er derfor trygt å trykke igjen etter å ha adoptert mer utstyr, og det legger bare til det nye utstyret. Alarmene for OT-nettverk og for av-nettverket er ikke med; de kommer når du merker et nettverk som OT og overvåker en enhet. `503` til konsollen er lest én gang.

## MQTT-oppdagelse

Enheter som har annonsert seg over MQTT, og hva en person har bestemt om hver. Se [MQTT-oppdagelse](/nb/iot/mqtt-discovery/). Oppdagelsen lytter på den innebygde brokeren når den kjører, og på hver broker satt opp under `/api/mqtt/brokers`. Uten noen av dem er `sources` tom. I en `--mcp-stdio`-hjelper, som aldri lytter, svarer `GET /api/discovery` `{"running":false,"sources":[],"devices":[]}` og alle andre ruter `503`.

`{source}` er brokeren en enhet annonserte seg på (`embedded` for HotLoops egen, ellers brokerens id); `{key}` er det som knyttet annonseringene dens sammen: den første identifikatoren, MAC-adressen som `mac:aa:bb:cc:dd:ee:ff`, eller node-id-en. URL-kod den; identifikatorer har tegn en sti ikke tåler.

**Ingen av disse armerer noe.** Å godta en enhet gjør punktene dens armerbare, ett om gangen, gjennom `POST /api/tags` som alle andre punkter.

### `GET /api/discovery`

Hver kilde, med det den har sett og avvist, og hver oppdaget enhet:

```json
{"running":true,"sources":[{"id":"embedded","name":"the embedded broker","prefix":"homeassistant","listening":true,"connected":true,
  "received":42,"dropped":0,"refused":0,"problems":[],"autoCreate":true,"anonymousAllowed":false,
  "external":false,"listenOnly":false,"enabled":true}],
 "devices":[{"source":"embedded","deviceKey":"plug-0001","deviceId":"kitchen-plug","status":"discovered",
  "device":{"identifiers":["plug-0001"],"name":"Kitchen Plug","manufacturer":"Acme","model":"P1","swVersion":"1.0.0"},
  "origin":{"name":"test-publisher","swVersion":"0.1"},"firstSeen":"2026-10-02T09:12:04Z","lastSeen":"2026-10-02T09:12:04Z",
  "components":[{"key":"plug-0001-relay","component":"switch","name":"Relay","configTopic":"homeassistant/switch/plug-0001/relay/config",
   "stateTopic":"plug/relay","commandTopic":"plug/relay/set","commandTopics":["plug/relay/set"],"tag":"relay",
   "unsupported":[],"unknownKeys":[],"flags":[]}]}]}
```

En kilde med `external` true er en broker satt opp under `/api/mqtt/brokers`, og `broker` sier hvor den er. `autoCreate` false er en kilde der enhetene venter i innboksen: oppført som `discovered` uten `deviceId`, ingenting lages og ingenting leses før noen godtar en. `listenOnly` er en broker HotLoop aldri publiserer på. `lastError` sier hvorfor en kilde ikke er tilkoblet, også et passord som ikke lar seg åpne.

`status` er `discovered`, `accepted` eller `ignored`. Per komponent lister `unsupported` det HotLoop ikke kan bruke og hvorfor («value template not supported: filter `regex_findall_index` is not supported at column 12»), `unknownKeys` konfigurasjonsnøklene formatet ikke definerer, `commandTopics` hvert topic kommandoene kan gå til (en vifteshastighets-topic i tillegg til hovedtopicen), og `flags` det en person bør se på før de godtar: et kommando-topic utenfor topicene komponenten leser, innenfor oppdagelsesprefikset eller krevd av en annen enhet, og en konfigurasjon som ber om holdte kommandoer. `withdrawnAt` er satt på en komponent utgiveren trakk tilbake. `suggestedEquipmentId` er treknuten `suggested_area` til enheten nevner, når nøyaktig én node har det navnet; den forhåndsutfyller bare godta-dialogen. På den innebygde brokeren er `announcedBy` og `announcedVia` broker-påloggingen og klient-id-en som publiserte den nyeste konfigurasjonen, og `acceptedLogin` påloggingen den ble godtatt fra. En godtatt enhet der annonseringen endret seg, eller som en annen pålogging annonserte, har `review`:

```json
{"hash":"9a1c...","summary":["plug-0001-power: unit changed"],
 "changes":[{"key":"plug-0001-power","kind":"changed","fields":[{"field":"unit","running":"W","announced":"kW"}]}]}
```

### `GET /api/discovery/{source}/{key}`

Én enhet, samme form. `404` for en HotLoop ikke har sett.

### `POST /api/discovery/{source}/{key}/accept`

Godtar en enhet. Valgfri body `{"equipmentId": 12}` plasserer den i treet i samme steg. Armerer ingenting. Svarer med enheten. `400` for en ignorert.

### `POST /api/discovery/{source}/{key}/ignore`

Dropper enheten: HotLoop-enheten, tagsene og entitetene forsvinner (historikken blir), og den forblir ignorert når den annonserer seg igjen. Svarer med enheten. `DELETE /api/devices/{id}` på en oppdaget enhet gjør det samme, fordi en enhet som fortsetter å annonsere seg bare ville kommet tilbake.

### `POST /api/discovery/{source}/{key}/unignore`

Henter en ignorert enhet tilbake som oppdaget, fra det den sist annonserte. `400` hvis den ikke er ignorert.

### `POST /api/discovery/{source}/{key}/review/apply`

Får en godtatt enhet til å kjøre det den annonserte. Om hvert punkt er armert, forblir som det var. `400` når ingenting venter på gjennomgang.

### `POST /api/discovery/{source}/{key}/review/reject`

Lar den godtatte konfigurasjonen kjøre og slutter å tilby denne endringen. En annen endring senere tilbys på nytt. `400` når ingenting venter.

En gjennomgang kan gjelde hvem som annonserte den: en endring med `"kind":"publisher"` og sammendragslinjen «announced by login garage-node; accepted from kitchen-node». Å bruke den gjør den påloggingen til den enheten er godtatt fra.

## Broker-pålogginger

Påloggingene til den innebygde brokeren som er laget i HotLoop, hver med topicene den kan publisere og abonnere på. Se [den innebygde MQTT-brokeren](/nb/iot/broker/). En pålogging er en nøkkel til brokeren for hele anlegget, så disse er `users.manage`, en administrators. Ingenting her svarer noensinne med et passord eller hashen. Hver endring havner i loggen og gjelder fra klientens neste publisering; ingen trenger å koble til på nytt.

### `GET /api/broker/logins`

```json
{"running":true,"anonymous":false,"prefix":"homeassistant","envLogins":["plant"],
 "profiles":[{"name":"shelly","about":"a Shelly Gen2 or later; name the login after its MQTT topic prefix",
   "publish":["%u/#","shellies/announce"],"subscribe":["%u/#","shellies/command","%p/status"]}],
 "logins":[{"name":"kitchen-node","profile":"esphome","publish":["%u/#","%p/+/%u/+/config","esphome/discover/%u"],
   "subscribe":["%u/#","%p/status","esphome/discover"],"createdBy":"admin","createdAt":"2026-10-02T09:12:04Z",
   "updatedAt":"2026-10-02T09:12:04Z","resolvedPublish":["kitchen-node/#","homeassistant/+/kitchen-node/+/config",
   "esphome/discover/kitchen-node"],"resolvedSubscribe":["kitchen-node/#","homeassistant/status","esphome/discover"]}]}
```

`running` er false der denne prosessen ikke kjører brokeren; påloggingene beholdes likevel, og brokeren leser dem når den starter. `envLogins` er navnene fra `HOTLOOP_BROKER_USERS`, som kan gjøre alt. `%u` i en regel er påloggingens eget navn og `%p` oppdagelsesprefikset; `resolved*` er reglene med begge fylt ut.

### `POST /api/broker/logins`

```json
{"name":"kitchen-node","password":"a-long-random-password","profile":"esphome"}
```

`name` er 1 til 64 bokstaver, sifre, `-` og `_` (det står for `%u` i topics). `password` er minst 12 tegn. `profile` fyller ut reglene; `publish` og `subscribe`, når de er gitt, erstatter dem. En av de to trengs. En regel er et MQTT-topic-filter: `+` og `#` bare som hele nivåer, `#` bare sist, aldri et `$`-topic. `201` med påloggingen; `400` for noe av det ovenfor eller et navn `HOTLOOP_BROKER_USERS` allerede har; `409` for et navn som er tatt.

### `PUT /api/broker/logins/{name}`

Hvilken som helst av `profile`, `publish`, `subscribe` og `password`; det som ikke sendes, blir. `200` med påloggingen, `404` for en som ikke finnes.

### `DELETE /api/broker/logins/{name}`

`200` `{"deleted":"kitchen-node"}`. En klient som fortsatt er tilkoblet med den, kan ikke gjøre noe fra da av, og kan ikke koble til igjen. `404` for en som ikke finnes.

## Nettverksoppdagelse

Enheter hørt på anleggsnettverket over mDNS, SSDP og DHCP, og hva en person har bestemt om hver. Se [Nettverksoppdagelse](/nb/iot/network-discovery/). I en `--mcp-stdio`-hjelper, som aldri lytter, svarer `GET /api/network-discovery` `{"running":false,"finds":[]}` og alle andre ruter `503`.

`{key}` er hvordan et funn ble hørt og av hvem: `mdns:` og mDNS-vertsnavnet, `ssdp:` og UPnP-uuid-en, `dhcp:` og MAC-adressen. URL-kod den.

**Ingen av disse armerer noe**, og ingenting her legges til før noen godtar det.

### `GET /api/network-discovery`

Lytterne, probingen, grensesnittene de er på, og hvert funn:

```json
{"running":true,
 "status":{"leading":true,"interfaces":["eth0 10.20.0.15/24"],
  "listeners":[{"name":"mdns","enabled":true,"listening":true,"heard":120,"dropped":0,"refused":0},
   {"name":"ssdp","enabled":true,"listening":true,"heard":14,"dropped":0,"refused":0},
   {"name":"dhcp","enabled":false,"listening":false,"heard":0,"dropped":0,"refused":0}],
  "probe":{"networks":[]}},
 "finds":[{"key":"mdns:line3-ua.local","via":"mdns","kind":"opcua","name":"line3-ua","status":"discovered",
  "firstSeen":"2026-10-11T14:02:11Z","lastSeen":"2026-10-11T14:07:40Z",
  "find":{"key":"mdns:line3-ua.local","via":"mdns","kind":"opcua","name":"line3-ua",
   "summary":"OPC UA server, capabilities DA","host":"line3-ua.local","addresses":["10.20.0.31"],
   "services":[{"type":"_opcua-tcp._tcp.local","instance":"line3-ua._opcua-tcp._tcp.local","port":50000,
    "txt":{"caps":"DA","path":"/"}}],
   "proposal":{"protocol":"opcua","address":"opc.tcp://10.20.0.31:50000/","how":"Accepting makes an OPC UA device..."},
   "heard":"2026-10-11T14:07:40Z"}}]}
```

`kind` er `esphome`, `shelly`, `opcua`, `mqtt-broker`, `web`, `mdns` (den annonserte noe HotLoop ikke har et ord for), `upnp` eller `dhcp`. Et funn der `proposal` har en `protocol`, blir ved godkjenning en enhet av den protokollen på `address`; et uten sier i `how` hva som ville hentet det inn. `also` lister de andre funnene og MQTT-oppdagede enhetene som er samme boks, etter MAC eller adresse. `status` er `discovered`, `accepted` eller `ignored`, og `deviceId` enheten godkjenningen laget. En lyttrers `error` sier hvorfor den ikke lytter (port 67 opptatt eller ikke tillatt, ikke noe multicast-grensesnitt); `refused` teller nye funn som ble droppet fordi registeret er fullt.

### `GET /api/network-discovery/{key}`

Ett funn, samme form. `404` for et HotLoop ikke har hørt.

### `POST /api/network-discovery/{key}/accept`

Godtar et funn. Valgfri body `{"equipmentId": 12}` plasserer enheten det lager i treet. Et funn HotLoop har driver for, blir en enhet på den foreslåtte adressen, aktivert, uten tags og uten noe armert; alle andre registreres som kjent og lager ingenting. Svarer med funnet. `400` for et som allerede er godtatt eller ignorert.

### `POST /api/network-discovery/{key}/ignore`

Skjuler et funn ingen har bestemt noe om, og holder det skjult når det høres igjen. `400` for et som er avgjort.

### `POST /api/network-discovery/{key}/unignore`

Henter et ignorert funn tilbake slik at det kan avgjøres. `400` hvis det ikke er ignorert.

### `POST /api/network-discovery/probe`

Probér nå: en mDNS-spørring og et SSDP-søk på hvert grensesnitt der nettverket står i `HOTLOOP_NETDISC_PROBE_NETWORKS`, og ingen andre steder. Svarer `{"status": ...}`, med det som ikke gikk ut i `status.probe.lastError`. `400` når ingen nettverk har probing slått på: denne knappen kan ikke slå den på, bare installasjonen kan.

## Integrasjoner

Oppsettsflyten for en type enhet en person peker HotLoop mot: spør hva integrasjonen trenger, se på den ekte enheten med svarene, og lag enheten og tagsene ut fra det som ble funnet. Se [Integrasjoner](/nb/iot/integrations/).

**Ingenting her armerer noe.** Hver tag et oppsett lager, er skrivebeskyttet. Å armere en er `POST /api/tags` som alle andre punkter.

### `GET /api/integrations`

Hver integrasjon dette bygget har, med spørsmålene den stiller:

```json
[{"id":"opcua","name":"OPC UA server","description":"A PLC, CNC, gateway or SCADA server ...",
  "protocol":"opcua","addressLabel":"Endpoint","addressPlaceholder":"opc.tcp://192.168.1.20:4840","writable":true,
  "fields":[{"key":"securityMode","label":"Security","kind":"choice","required":false,"default":"None",
             "choices":[{"value":"None","label":"None"},{"value":"Sign","label":"Sign"}]},
            {"key":"password","label":"Password","kind":"secret","required":false}]}]
```

`kind` er `text`, `number`, `bool`, `choice` eller `secret`. Et felt med `showWhen` (`{"version":["3"]}`) spørres bare om når et annet svar har en av de verdiene, og svaret på et spørsmål som ikke vises, ignoreres.

### `POST /api/integrations/{id}/probe`

Sjekker svarene og går og ser på den ekte enheten. Lagrer ingenting.

```json
{"address":"opc.tcp://192.168.1.20:4840","options":{"securityMode":"None"}}
```

Svarer `{"integration":"opcua","address":"opc.tcp://192.168.1.20:4840","found":{...}}`. `address` er adressen slik integrasjonen løste den. `found` har `name` (hva enheten kaller seg selv), `identity` (hva den sier den er), `notes` (ting å vite før man godtar) og `points`, hver i tag-form `{name, address, dataType, unit, description, writable, deviceClass}` pluss `group`, `sample` (det den leste da den ble funnet) og `suggested`.

`400` for svar som ikke passer til spørsmålene, alle problemene på en gang; et svar på et spørsmål integrasjonen ikke stiller er også en `400`, ikke ignorert. `502` når enheten ikke svarte eller svarte med noe som ikke er protokollen dens, med det som gikk galt. `404` for en integrasjon dette bygget ikke har. En hemmelighet er aldri i et svar eller en feil.

### `POST /api/integrations/{id}/setup`

Ser på enheten igjen, og lager den deretter med tagsene. Bodyen er probens, pluss:

| Felt | Betydning |
|---|---|
| `deviceId` | Den nye enhetens id. Tom tar en fra navnet. `400` hvis en enhet har den |
| `name` | Enhetens navn. Tom tar det enheten kaller seg selv |
| `points` | Navn fra `found.points` som skal settes opp. Tom tar de merket `suggested`. Et navn enheten ikke har, er en `400` |
| `site`, `area`, `line` | Hvor den havner i utstyrstreet, som på `POST /api/devices` |

Punktene sjekkes mot enheten slik den er nå, ikke mot det en klient sier den fant for et minutt siden. Svarer `{"device":{...},"tags":3,"entities":["sensor.plc_sim_..."],"notes":[]}`. Enheten er aktivert og leses av, hver tag er skrivebeskyttet, og hver tag har sin lese-entitet. Et oppsett som feiler halvveis, etterlater ingen enhet.

## MQTT-brokere

Andre brokere enn HotLoops egen som oppdagelsen lytter til: et anleggs Mosquitto, brokeren en Zigbee2MQTT-boks hadde med seg. Se [MQTT-oppdagelse](/nb/iot/mqtt-discovery/#andre-meglere). Passordene deres er forseglet med enhetspåloggingsnøkkelen (`HOTLOOP_SECRET_KEY_FILE`) og returneres aldri; `passwordSet` sier om ett er lagret, og `passwordProblem` hvorfor et lagret ikke lar seg åpne. Hver endring havner i loggen og får virkning med en gang: lytteren og enhetene fra den brokeren kobler til på nytt.

### `GET /api/mqtt/brokers`

```json
{"secretKey":true,
 "brokers":[{"id":"plant-uns","name":"Plant UNS","broker":"tcp://10.20.0.5:1883","username":"hotloop","useTls":false,
   "insecureSkipVerify":false,"prefix":"homeassistant","listenOnly":true,"autoCreate":false,"tasmota":true,"shelly":true,"enabled":true,
   "createdBy":"admin","passwordSet":true,"createdAt":"2026-10-03T09:12:04Z","updatedAt":"2026-10-03T09:12:04Z"}]}
```

`secretKey` er om denne HotLoop har en nøkkel å forsegle et passord med.

### `POST /api/mqtt/brokers`

```json
{"id":"plant-uns","name":"Plant UNS","broker":"tcp://10.20.0.5:1883","username":"hotloop",
 "password":"...","listenOnly":true}
```

`id` er 1 til 63 små bokstaver, sifre og `-`, ikke `embedded`: den navngir brokeren i hver enhet som kom fra den, og kan ikke endres. `broker` er `host:port` eller en URL `tcp://`, `ssl://`, `tls://`, `mqtt://` eller `mqtts://`, uten pålogging i. `prefix` er som standard `homeassistant`; `autoCreate` false (enheter venter i innboksen); `listenOnly` false; `tasmota` (høre Tasmotas egen oppdagelse, `tasmota/discovery/#`, også) true; `shelly` (lære Shelly Gen2 og nyere enheter fra topicene `<prefix>/status/<component>` de publiserer) true; `enabled` true. Et passord trenger et brukernavn og en nøkkel: uten `HOTLOOP_SECRET_KEY_FILE` er det en `400`, aldri lagret i klartekst. `201` med brokeren; `409` for en id som er tatt.

### `PUT /api/mqtt/brokers/{id}`

Hvilket som helst av feltene ovenfor unntatt `id`; det som ikke sendes, blir. `"password":""` fjerner passordet. `200` med brokeren.

### `DELETE /api/mqtt/brokers/{id}`

Fjerner brokeren og det den annonserte og ingen godtok: innboksen og enhver enhet den lagde selv. `409` som nevner dem så lenge enheter godtatt fra den fortsatt finnes: ignorer eller slett dem først, eller slå av brokeren med `"enabled":false` i stedet. `200` `{"deleted":"plant-uns"}`.

## Tags

### `GET /api/tags`

| Spørring | <span class="sr-only">Detaljer</span> |
|---|---|
| `device` | Bare denne enhetens tags. Uten `limit` svarer den med alle |
| `q` | Søk: en delstreng, uten hensyn til store og små bokstaver, av enhets-id, tag-navn eller beskrivelse. Virker sammen med `device` |
| `limit` | Et helt tall fra 1 til 5000. Standard 500 uten `device`. Alt annet, 5001 inkludert, er `400`: det avvises, aldri besvart med færre (til og med 4.19.5 ble enhver grense over 1000 stille gjort om til 200) |
| `writable` | `true` for bare tagsene merket skrivbare (det skrivevelgerne tilbyr) |
| `offset` | Hvor siden starter, null eller mer. Tags er sortert etter enhet, deretter navn |

Svarets `X-Total-Count`-header sier hvor mange tags som treffer til sammen, så en klient blar med `offset` til den har dem og vet at den har dem. Et tomt svar er `[]`.

```json
[{"id":5,"deviceId":"tank-farm","name":"level_sp","address":"mqtt:docs-api-example/level_sp","dataType":"float","unit":"%","enabled":true,"writable":true,"maxValue":95,"hasRange":true,"scale":1,"createdAt":"2026-09-27T20:21:39.405164Z","updatedAt":"2026-09-27T20:21:39.405164Z"}]
```

### `POST /api/tags`

Oppretter taggen hvis `deviceId` og `name` er nye, og erstatter den ellers.

| Felt | Type | <span class="sr-only">Detaljer</span> |
|---|---|---|
| `deviceId` | string | Påkrevd. Enheten må finnes (`404` hvis ikke) |
| `name` | string | Påkrevd. Ingen kontrolltegn |
| `address` | string | Påkrevd. Protokollens egen adresse |
| `dataType` | string | `bool`, `int`, `float` eller `string` (og de vanlige aliasene: `int16`, `word`, `coil`...). Avgjør hvordan en skriving kodes |
| `unit`, `description` | string | |
| `enabled` | bool | Utelatt er den `false` |
| `writable` | bool | **Armerer taggen for skriving, fra alle veier: brukergrensesnitt, automasjoner, entiteter, MCP.** Utelatt er den `false` |
| `hasRange`, `minValue`, `maxValue` | bool, number, number | Med `hasRange` avvises en skriving utenfor området (aldri avkortet) |
| `scale`, `offset` | number | teknisk verdi = rå x skala + forskyvning. En skala på 0 regnes som 1 |
| `noData` | list | Råverdier som betyr «ingen måling», hver `{"raw", "reason"}`. `raw` er en streng (`"0x8005"`, `"-32763"`) eller et bart tall, og kommer tilbake som en streng. En avlesning der råverdien står på listen, har dårlig kvalitet med den `reason`, sjekket før `scale` og `offset`. Opptil 32 koder. En kode som ikke er et helt tall, er oppført to ganger eller ikke kan være punktets type, er `400`. Se [Protokoller og drivere](/nb/iot/protocols/#no-data-values) for hva man skriver for hver type og Yokogawa DX-eksemplet |
| `deadband`, `deadbandPercent` | number | Endringer mindre enn dette skrives ikke til historikken |
| `deviceClass` | string | Klassen entitetene til taggen starter med (`power`, `connectivity`, `temperature`...), når det betyr noe for domenet deres. Tas når taggen opprettes og ignoreres ved erstatning: fra da av eier entiteten klassen, så endre den der |

Svarer med den lagrede taggen. Å lagre en med `writable: true` logges som sådan: å armere en tag er en sikkerhetsbeslutning og får et navn ved siden av. Taggens entiteter opprettes eller oppdateres før svaret, så en klient kan be om dem med en gang.

En tag på en oppdaget enhet ingen har godtatt, kan ikke armeres: `400`, «accept the device first». Se [MQTT-oppdagelse](/nb/iot/mqtt-discovery/#kommandoer).

### `DELETE /api/tags/{device}/{name}`

`{"deleted":"tank-farm/level"}`, eller `404`. Historikken blir. Taggens entiteter blir foreldreløse (se [Entiteter](/nb/iot/entities/#deleted-tags-orphans-and-re-adoption)).

## Verdier, tavla og skrivinger

### `GET /api/values`

Siste avlesning av hver tag, fra minnet. `?device=` snevrer inn til én enhet.

```json
[{"deviceId":"extruder-1","protocol":"opcua","tagName":"Temperature","tagValue":20.645294745260895,"unit":"C","quality":"good","timestamp":"2026-09-27T20:21:58.255722Z"}]
```

Denne formen er `TagValue` til EmberNet-dashbordet og er en kontrakt. `quality` er `good`, `uncertain` eller `bad`; **en dårlig avlesning betyr at verdien ikke er kjent, ikke at den er null**. En strengavlesning bærer `stringVal`, og dens `tagValue` betyr ingenting.

En avlesning som ikke er god, bærer `reason` når driveren vet hvorfor, så en skjerm kan si mer enn «dårlig»:

```json
{"deviceId":"meter-01","protocol":"http","tagName":"power","tagValue":0,"quality":"bad","timestamp":"2026-09-30T09:12:04.51Z","reason":"no field at ENERGY.Power"}
```

En god avlesning har den aldri, så kontrakten ovenfor er byte for byte slik den var. Historianen beholder den ikke: `/api/history` har kvaliteten, ikke årsaken.

### `GET /api/sparkline`

De siste avlesningene av én tag holdt i minnet (`HOTLOOP_RING_SIZE`, 30 som standard), til de små diagrammene. `?tag=device/tag`, påkrevd.

```json
{"tag":"extruder-1/Temperature","timestamps":[1790540498609,1790540499246,1790540500246],"values":[0,20.06524581530632,19.933308705395785]}
```

`timestamps` er Unix-millisekunder. Begge er `[]` for en tag uten avlesninger. `400` for en ugyldig nøkkel.

### `GET /api/board`

Hvilke tags som er festet til tavla, og i hvor mange kolonner. Den lagres i databasen, ikke i nettleseren, fordi en tavle tilhører anlegget: panel-PC-en på gulvet og den bærbare på kontoret viser den samme.

```json
{"columns":2,"tags":["extruder-1/Temperature","tank-farm/level"],"rev":"9f2c41b07a6d3e58"}
```

`rev` navngir tavla slik den er lagret. Send den tilbake med en lagring, og lagringen avvises hvis tavla har endret seg siden (under).

### `PUT /api/board`

Samme form. `columns` utenfor 1 til 4 blir 3; duplikater droppes. `rev` er valgfri: med `rev` for tavla du leste er en lagring over en tavle som har endret seg siden, en `409` og endrer ingenting, så en side som aldri leste tavla, eller leste en gammel, ikke kan erstatte anleggets med sin kopi. Utelater du den, sjekkes ikke lagringen, noe som passer en klient som setter hele tavla hver gang. Nettgrensesnittet leser tavla ved oppstart og sender `rev` med hver lagring. Hver tag må finnes (`404` som navngir den som ikke gjør det): en utdatert oppføring er et måleinstrument som aldri beveger seg. Svarer med tavla slik den er lagret. Operatører har `board.write`: å ordne tavla er å drive anlegget, ikke å konfigurere det.

### `POST /api/write`

Skriver én verdi til én tag, gjennom skrive-porten.

| Felt | Type | <span class="sr-only">Detaljer</span> |
|---|---|---|
| `tag` | string | Påkrevd. `device/tag` |
| `value` | bool, number or string | Påkrevd. `true` er en bool, `42` et heltall, `42.5` et flyttall, `"42"` en streng: JSON-typen er typen som skrives, fordi en coil, et ord og et reelt tall er tre forskjellige ting på ledningen |
| `reason` | string | Valgfritt. Logges sammen med skrivingen |

```json
{"tag":"tank-farm/level_sp","written":"72.5"}
```

**En verdi er i taggens enheter, slik en avlesning er.** På en tag med skala eller forskyvning er det du sender, det taggen ville lest tilbake, og HotLoop sender enheten tellingen som gir det: 55.5 på et register skalert med 0.1 legger 555 i registeret. (Til og med 4.18 gikk tallet til enheten som det sto, så 55.5 ble 55 og leste tilbake som 5.5.) Områdesjekken og revisjonsraden bruker tallet ditt, i taggens enheter. En telling som etterpå ikke passer i registeret, som 7000 på en `uint16` skalert med 0.1, avvises med tellingen og registeret nevnt, og ingenting sendes. En brøkdel av en telling kuttes av, slik et heltallsregister alltid har gjort: 12.34 på et tidelsskalert register holder 12.3.

Porten sjekker, i rekkefølge, at skriving er slått på (`HOTLOOP_ALLOW_WRITES`), at taggen er armert og at verdien er innenfor området. Hvert forsøk, avvist eller ikke, står i `GET /api/writes`.

| Status | Når |
|---|---|
| 400 | Ingen verdi, en `null`-verdi, en ugyldig nøkkel |
| 403 | Skriving er av, eller `"tank-farm/level: this tag is not marked writable"` |
| 404 | Ingen slik tag |
| 422 | `"value is outside the tag's configured range: 120 is outside 0..95"` |
| 503 | Enheten er ikke tilkoblet |

## Historikk og revisjon

### `GET /api/history`

| Spørring | <span class="sr-only">Detaljer</span> |
|---|---|
| `tag` | Påkrevd, kan gjentas, opptil 50: `?tag=a/x&tag=b/y` |
| `minutes` | Hvor langt tilbake fra nå. Standard 60 |
| `bucket` | Intervallstørrelse i sekunder. Standard: valgt slik at vinduet har omtrent 400 intervaller, på en stige fra 1 s til 1 dag |
| `raw` | `true` for selve avlesningene i stedet for intervaller |
| `limit` | Standard 5000, høyst 100000 |
| `carry` | `true` for også å si hva hver tag holdt da vinduet begynte (bare intervaller) |

Intervallert, eldste først per tag. `badCount` er hvor mange avlesninger i intervallet som ikke var av god kvalitet; de telles, ikke midlet inn. `from` og `to` er vinduet svaret gjelder for, nøyaktig `minutes` fra hverandre og som slutter når spørsmålet ble stilt:

```json
{"buckets":[{"deviceId":"extruder-1","tagName":"Temperature","bucket":"2026-09-27T20:21:00Z","avg":18.986210570239944,"min":0,"max":20.83008050535897,"first":0,"last":20.83008050535897,"count":22,"badCount":1}],"from":"2026-09-27T19:22:00Z","raw":false,"to":"2026-09-27T20:22:00Z"}
```

Historianen beholder en avlesning når en verdi beveger seg forbi dødsonen sin, ikke ved hver avlesning, så en tag som har holdt seg i ro, har ingenting i vinduet å tegne. Med `carry=true` har svaret også `"carry":[{"deviceId":"extruder-1","tagName":"Temperature","ts":"2026-09-27T16:40:12Z","value":21.4}]`: den siste avlesningen før `from`, for hver tag der den siste tidligere avlesningen var god og hadde et tall. En tag der den siste avlesningen var dårlig eller usikker, som ikke har noen tidligere avlesning eller som er tekst, har ingen oppføring, fordi det den holdt ikke er kjent, og vi gir ikke et diagram en gjetning. Trendkortet tegner ut fra dette.

Rå, nyeste først:

```json
{"raw":true,"readings":[{"deviceId":"extruder-1","protocol":"","tagName":"Temperature","tagValue":21.021559879601448,"quality":"good","timestamp":"2026-09-27T20:22:00.267463Z"}]}
```

`400` uten `tag`, med mer enn 50, eller med en ugyldig nøkkel.

### `GET /api/writes`

Skriverevisjonen, nyeste først. Hvert forsøk er her, også de avviste, fordi «vi vet ikke om den kommandoen gikk ut» er det verste svaret et anlegg kan få.

| Spørring | <span class="sr-only">Detaljer</span> |
|---|---|
| `tag` | Én tag, `device/tag` |
| `device` | Hver tag på én enhet (ignoreres hvis `tag` er satt) |
| `entity` | Hver skriving et tjenestekall på denne entiteten gjorde eller fikk avvist, i stedet for det ovenfor |
| `call` | Hver skriving fra ett kall, i stedet for alt ovenfor: et knappetrykk og slipp, eller hvert mål for bruken av en oppskrift, som deler `call_id` |
| `limit` | Standard 100, høyst 5000 |

```json
[{"id":2,"at":"2026-09-27T20:22:01.04226Z","deviceId":"tank-farm","tagName":"level_sp","value":"120","prior":"0 %","actor":"admin","source":"ui","succeeded":false,"error":"refused: value is outside the tag's configured range: 120 is outside 0..95"},
 {"id":4,"at":"2026-09-27T20:23:03.276962Z","deviceId":"tank-farm","tagName":"pump","value":"true","prior":"0","actor":"admin","source":"ui","succeeded":true,"latencyMs":0.317,"entityId":"switch.tank_farm_pump","service":"switch.turn_on","callId":"5c9f8545a93b5443"}]
```

`source` er `ui`, `api`, `automation` eller `mcp`. `entityId`, `service` og `callId` står bare på skrivinger et tjenestekall gjorde.

## Entiteter og tilstander

Hver tag får entiteter uten at noen ber om det; sammensatte (motorer, ventiler, sløyfer, tellere, valg, knapper, værstasjoner) bygges av tags av en administrator. I snake_case, som alle entitets-endepunkter. Hele modellen står i [Entiteter](/nb/iot/entities/).

### `GET /api/entities`

Hver entitet, foreldreløse inkludert.

| Spørring | <span class="sr-only">Detaljer</span> |
|---|---|
| `domain` | `sensor`, `switch`, `motor`... |
| `device` | Entiteter på én enhet |
| `orphaned` | `true` for bare foreldreløse, `false` for ingen |
| `q`, `limit` | Søk: en delstreng, uten hensyn til store og små bokstaver, av entitets-id, navn eller enhets-id, og høyst `limit` av dem (1 til 5000, alt annet er `400`, aldri stille kuttet) sortert etter entitets-id. `X-Total-Count` er hvor mange som traff. Utelatt er listen hel |

```json
[{"id":5,"entity_id":"switch.tank_farm_pump","unique_id":"tag-control:tank-farm/pump","domain":"switch","platform":"tag","name":"pump","device_id":"tank-farm","options":{},"disabled":false,"hidden":false,"created_at":"2026-09-27T20:21:39.153197Z","updated_at":"2026-09-27T20:21:39.153197Z","bindings":[{"role":"command","device_id":"tank-farm","tag_name":"pump"},{"role":"state","device_id":"tank-farm","tag_name":"pump"}],"equipment_id":null,"area_id":4,"labels":[]}]
```

### `GET /api/entities/composites`

Hva `POST /api/entities` kan lage: hvert domene, rollene tagsene bindes til og tjenestene det tar imot. En rolle sier hvilken `kind` tag den har, om den er `required`, om en tjeneste skriver den (`command`) og om tilstanden leses fra den (`feedback`). En værstasjon tar ingen tjeneste.

```json
{"domains":[{"domain":"weather","roles":[{"role":"temperature","kind":"number","required":true,"command":false,"feedback":true},{"role":"humidity","kind":"number","required":false,"command":false,"feedback":true}],"services":[]}]}
```

### `GET /api/entities/{entity_id}`

`{"entity": {...}, "state": {...}}`. `state` er `null` for en deaktivert entitet. `404` for en ukjent.

### `GET /api/entities/{entity_id}/image`

Det nyeste bildet fra et kamera eller et bilde, som bytene HotLoop holder: `Content-Type` er det de er (`image/jpeg`, `image/png`, `image/gif` eller `image/webp`), med `X-Content-Type-Options: nosniff`, en isolerende `Content-Security-Policy` og en `ETag` (`If-None-Match` får en `304`). `404` for en entitet som ikke er en, eller før et bilde har kommet. Tilstandens `entity_picture`-attributt er denne stien med bildets hash på.

### `PUT /api/entities/{entity_id}`

Endrer bare feltene du sender. Bare for administratorer: entity_id er navnet hver automasjon, hvert dashbord og hver agent refererer til entiteten med, og å endre det er konfigurasjon.

| Felt | Type | <span class="sr-only">Detaljer</span> |
|---|---|---|
| `entity_id` | string | Et navnebytte. `unique_id` flytter seg ikke |
| `name`, `icon`, `device_class`, `state_class`, `unit_of_measurement`, `entity_category` | string | |
| `options` | object | Per domene; se [Entiteter](/nb/iot/entities/#api) |
| `disabled`, `hidden` | bool | En deaktivert entitet har ingen tilstand og kan ikke kommanderes |
| `equipment_id` | int or null | Plasserer den i treet; `null` følger enheten sin igjen |
| `labels` | string[] | Hele settet |

`unique_id`, `domain`, `platform`, enheten og bindingene kan ikke endres her, og å sende dem er en 400.

```json
{"entity":{"id":3,"entity_id":"sensor.tank_1_level","name":"Tank 1 level","device_class":"moisture","icon":"mdi:water-percent","...":"..."},"warnings":[]}
```

`warnings` sier når noe er lovlig, men rart (en enhet enhetsklassen vanligvis ikke har). `400` for en tom body (`"the update names no field to change"`) eller en dårlig verdi, `404` for en ukjent entitet, `409` for en entity_id som er tatt.

### `POST /api/entities`

Lager en sammensatt entitet. Bodyen navngir domenet og binder tags til rollene:

```json
{"name":"Transfer pump","domain":"motor","bindings":[{"role":"run_command","device_id":"tank-farm","tag_name":"pump"},{"role":"running","device_id":"tank-farm","tag_name":"pump"}]}
```

Også `entity_id` (ellers laget ut fra navnet), `device_class`, `unit_of_measurement`, `icon`, `entity_category` og `options`. Hvilke roller og alternativer hvert domene tar, står i [Entiteter](/nb/iot/entities/#composite-equipment). Svarer `201` `{"entity": {...}, "warnings": [...]}`. `400` for et domene som ikke lages her (en `sensor` kommer fra taggen sin, en `alarm` fra definisjonen sin), en rolle som mangler eller en tag som ikke kan fylle den, `409` for en entity_id som er tatt.

### `DELETE /api/entities/{entity_id}`

Sletter en sammensatt entitet, eller en foreldreløs der taggen eller alarmdefinisjonen er borte. `{"deleted":"motor.transfer_pump","entity":{...}}`. Alt annet svarer `409` og sier hvordan det faktisk forsvinner:

```json
{"error":"this entity cannot be deleted: sensor.tank_1_level is kept in step with its tag; delete the tag, and then this orphan, or hide or disable it: already exists"}
```

### `GET /api/states`

Tilstanden til hver aktivert entitet, sortert etter entity_id. `?domain=` filtrerer.

```json
[{"entity_id":"number.tank_farm_level_sp","state":"unknown","attributes":{"armed":true,"friendly_name":"level_sp","max":95,"min":0,"source":["tank-farm/level_sp"],"unit_of_measurement":"%"},"quality":"bad","last_changed":"2026-09-27T20:21:39.417193755Z","last_updated":"2026-09-27T20:21:39.417193755Z","last_reported":"2026-09-27T20:22:04.423849496Z"}]
```

`state` er alltid en streng, også for et tall; `unknown` og `unavailable` betyr det de sier. `last_reported` er enhetens tidsstempel for avlesningen bak.

### `GET /api/states/{entity_id}`

Én tilstand. `404` for en ukjent entitet, og en annen `404` for en deaktivert, som sier hvordan den aktiveres: en deaktivert entitet mangler ikke, og å melde den som manglende sender noen på leting etter en skrivefeil.

## Energi

Hva anlegget bruker og hva det koster: kilowattimer, gass, vann, trykkluft og kostnaden for en produsert enhet. En måler er en tag lest som en mengde brukt. Hele modellen, tariffene og hva skjermen gjør står i [Energi](/nb/iot/energy/). Å lese er `energy.read`, som hver rolle har; å lage eller endre en måler eller en tariff er `energy.write`, en administrators.

### `GET /api/energy/meters`

Hver måler, etter type og deretter navn, hver med hvordan den leses og hva den brukte i dag.

```json
[{"id":"main","name":"Main panel","kind":"electricity","mode":"counter","source":{"device_id":"pm-01","tag_name":"kWh"},"unit":"kWh","factor":0.001,"tariff":{"currency":"USD","price":0.12,"bands":[{"from":"22:00","to":"06:00","price":0.07}]},"enabled":true,"status":{"state":"ok","last_read_at":"2026-11-19T21:15:00Z","resets":0,"gap_seconds":0},"today":{"value":412.6,"cost":49.51,"covered_seconds":43200,"estimated":false}}]
```

`status.state` er `ok`, `waiting` (ingenting er lest fra taggen ennå), `bad` (taggens avlesning er ikke god, og `reason` sier hvorfor) eller `disabled`.

### `POST /api/energy/meters`

Lager en måler. `id` er små bokstaver, sifre, `-` og `_`. `kind` er `electricity`, `gas`, `water`, `air`, `heat` eller `production`. `mode` er `counter` (en kumulativ tag: det som ble brukt er hvor langt den flyttet seg, ganger `factor`) eller `power` (en rate: det som ble brukt er raten over tiden den holdt, med `power_unit` `W`, `kW` eller `MW`, og `unit` `Wh`, `kWh` eller `MWh`). `source` er taggen. `tariff` er en fast `price` per enhet med valgfri `currency`, og valgfrie `bands` (`from` og `to` på et kvarter, `days`, `price`) for en tidsdifferensiert tariff; en produksjonsmåler har ingen. En elektrisitetsmåler i `Wh`, `kWh` eller `MWh` kan også ha en `demand_price` i tariffen: hva en kilowatt av det høyeste kvarteret i et vindu koster. Utelatt `enabled` er `true`. `201` med `{"meter": {...}, "warnings": []}`. `400` som sier hva som er galt: taggen finnes ikke eller er ikke et tall, et bånd er ikke på et kvarter, en effektmåler med en faktor. `409` for en id som er tatt.

### `GET /api/energy/meters/{id}`

Én måler, slik listen viser den. `404` for en ukjent.

### `PUT /api/energy/meters/{id}`

Erstatter definisjonen til en måler. Det den allerede har talt, blir, og beholder prisen det ble gjort til. Å peke den på en annen tag eller modus glemmer hvor siste avlesning slapp, fordi neste avlesning er av noe annet.

### `DELETE /api/energy/meters/{id}`

Fjerner en måler og alt den har talt. `404` for en ukjent.

### `GET /api/energy/summary`

Hver måleres forbruk og kostnad over et vindu, og kostnaden for en produsert enhet. Vinduet er `?period=` (`today`, `yesterday`, `this_week`, `last_week`, `this_month`, `last_month`, `last_7_days`, `last_30_days`, eller et skift skrevet `shift:06:00-14:00` for det siste som har startet og `last_shift:06:00-14:00` for det før; dager, måneder og skift er lokasjonens) eller `?from=&to=` som RFC 3339, med from inkludert og to ikke, høyst 400 dager. `meters` er en kommaseparert liste over målerne hvis kostnad går inn i kostnaden per enhet, og `per` navngir den ene produksjonsmåleren å dele på.

```json
{"period":"today","from":"2026-11-19T05:00:00Z","to":"2026-11-20T05:00:00Z",
 "meters":[{"id":"main","name":"Main panel","kind":"electricity","unit":"kWh","currency":"USD","value":412.6,"cost":49.51,"covered_seconds":43200,"coverage":1,"estimated":false}],
 "costs":[{"currency":"USD","cost":49.51}],
 "per_unit":[{"production":"parts","units":9800,"currency":"USD","cost":49.51,"cost_per_unit":0.00505}]}
```

`coverage` er andelen av vinduet så langt som avlesninger dekker. Kostnader i to valutaer legges aldri sammen, så det er en `per_unit`-rad for hver. `cost_per_unit` er `null` når ingenting ble laget (`reason` er `nothing_made`) eller når noe ble laget og ingen måler med pris har talt noe forbruk ennå (`nothing_counted`): det er ikke et svar, ikke null.

En måler med `demand_price` har en `demand` i raden sin: `peak_kw` (det høyeste kvarteret i vinduet, som kilowattene det hadde i snitt), `peak_at` (når det startet), `peak_covered_seconds` (hvor mye av det kvarteret som ble lest; under 900 er toppen undervurdert) og `cost` (toppen ganger prisen). Radens `cost` forblir det energien kostet; `costs` og `per_unit` inkluderer effektleddet.

### `GET /api/energy/summary/{period}`

Det samme som sammendraget, over én navngitt periode (eller skift) gitt i stien. `meters` og `per` går fortsatt i spørringen.

### `GET /api/energy/series`

Én målers forbruk over et vindu, `?meter=<id>`, vinduet som over, og `step`: `quarter` (høyst 8 dager), `hour` (standard), `day` eller `month`. Et steg uten avlesninger står ikke i listen.

```json
{"meter":"main","unit":"kWh","currency":"USD","step":"day","points":[{"start":"2026-11-19T05:00:00Z","value":412.6,"cost":49.51,"estimated":false}]}
```

### `GET /api/energy/series/{meter}/{period}/{step}`

Det samme som serien, med måleren, den navngitte perioden og steget i stien, for en som bare har en sti å gi.

## Tjenester

### `POST /api/services/{domain}/{service}`

Kommanderer én entitet: `switch/turn_on`, `number/set_value`, `motor/start`, `alarm/acknowledge`. Én entitet, én tjeneste, ett kall. Under er det ikke noe annet enn tag-skrivinger gjennom samme skrive-port som `POST /api/write`.

```json
{"entity_id":"switch.tank_farm_pump","reason":"start of shift"}
```

`entity_id` er påkrevd og er én entitet, ikke en liste; `reason` er valgfri; alt annet er tjenestens data (`value`, `option`, `position`, `mode`, `minutes`, `note`). Tall beholder typen de ble skrevet som. Domenet i stien må være entitetens. Hver tjeneste og dens data står i [Entiteter](/nb/iot/entities/#what-each-domain-takes).

```json
{"call_id":"5c9f8545a93b5443","entity_id":"switch.tank_farm_pump","service":"switch.turn_on","writes":[{"tag":"tank-farm/pump","value":"true","status":"written"}]}
```

Hver skriving er `written`, `not_sent` (avvist før den nådde enheten), `failed` (den gikk ut og enheten meldte en feil, så om den virket er ikke kjent) eller `skipped` (en tidligere skriving i kallet lyktes ikke). Skrivinger som allerede er gjort, rulles aldri tilbake. Tjenestene til en alarmentitet skriver ingen tag og svarer med `alarm` slik motoren forlot den. En helpers skriver heller ingen tag og svarer med `state` de forlot den i:

```json
{"call_id":"0f3c2a1b9d8e7f60","entity_id":"input_number.batch_target","service":"input_number.set_value","writes":[],"state":"1250"}
```

Et skripts `turn_on` kjører det, med dataene som felt, og svarer med `script_run` det startet; skrivingene fra stegene revideres én og én som `script:<id>`, ikke her. `turn_off` stopper alle kjøringer av det. Se [Skript](#skript).

En scenes `turn_on` bruker oppskriften sin, med `params` og `version` fra dataene, og svarer med hele `recipe_application` og, i `writes`, hver skriving målene gjorde, i rekkefølge. Den feiler med mindre hvert mål ble skrevet. Se [Oppskrifter](#oppskrifter).

Et mislykket kall svarer med feilens status og samme body pluss `error`, så du kan se nøyaktig hvor det stoppet:

```json
{"error":"value is outside the tag's configured range: 150 is outside 0..95","call_id":"3cd42f8275e5765e","entity_id":"number.tank_farm_level_sp","service":"number.set_value","writes":[{"tag":"tank-farm/level_sp","value":"150","status":"not_sent","error":"value is outside the tag's configured range: 150 is outside 0..95"}]}
```

| Status | Når |
|---|---|
| 400 | Ingen `entity_id`, feil domene, en ukjent tjeneste, data tjenesten ikke tar |
| 403 | Tillatelsen, eller porten avviste av policy |
| 404 | Ingen slik entitet |
| 409 | Et bytte uten kjent tilstand, utstyr i feil tilstand for tjenesten |
| 422 | En verdi avvist på innholdet |
| 503 | Enheten er ikke tilkoblet; alarmmotoren kjører ikke |
| 500 | Et knappetrykk gikk ut og slippet gikk ikke. **Taggen kan fortsatt holde trykkverdien**: sjekk den og slipp den for hånd |

**`?dry_run=true`** spør hva kallet ville gjort og gjør ingenting av det: ingenting skrives, revideres eller logges. Kallet planlegges som det ekte, og hver skriving legges fram for portens egne sjekker, i samme rekkefølge, akkurat nå. En dom svarer 200, avvist eller ikke: hver skriving `would_write`, eller den første som ville blitt avvist `not_sent` med årsaken og resten `skipped`, og `error` er feilen det ekte kallet ville feilet med, ord for ord.

```json
{"dry_run":true,"error":"value is outside the tag's configured range: 150 is outside 0..95","entity_id":"number.tank_farm_level_sp","service":"number.set_value","writes":[{"tag":"tank-farm/level_sp","value":"150","status":"not_sent","error":"value is outside the tag's configured range: 150 is outside 0..95"}]}
```

En forespørsel det ekte kallet ville avvist før noen sjekk (ingen slik entitet, en ukjent tjeneste, data tjenesten ikke tar, et bytte uten kjent tilstand) svarer med det ekte kallets status og feil; det samme gjelder en manglende tillatelse. `dry_run` er `true` eller `false` og ingenting annet: `yes` er en 400, ikke en gjetning, fordi å gjette feil gjør et spørsmål til en kommando. Se [Entiteter](/nb/iot/entities/#asking-first-the-dry-run).

**Hvorfor tillatelsen sjekkes i handleren.** Den trenger `values.write`, det samme som å skrive taggen direkte, fordi det er alt det er; tjenestene til en `alarm`-entitet trenger `alarms.ack` i stedet, det samme som alarmskjermen, en helpers trenger `helpers.write`, som en operatør har, et skripts trenger `scripts.run`, det samme som `POST /api/scripts/{id}/run`, og en scenes trenger `recipes.apply` og oppskriftens egen tillatelse når den navngir en, det samme som `POST /api/recipes/{id}/apply`. Sjekken gjøres inne i handleren og ikke foran den slik at et avslag for manglende tillatelse sendes til skrive-porten og **revideres mot entiteten** som alle andre avslag, med verdien det ble bedt om. En bruker uten tillatelsen får en 403 og en linje i `GET /api/writes?entity=...`, ikke en 403 og ingenting. En helper skriver ingen tag, så en helpers avslag, dette inkludert, er i stedet en advarsel i systemloggen (`GET /api/events`) mot helperen, og det samme gjelder et skript. En scenes avslag er en avvist bruk i oppskriftens historikk, med brukeren på.

## Hjelpere

Verdier som tilhører folkene i anlegget og ikke en PLS: `input_boolean`, `input_number`, `input_select`, `input_text`, `input_counter`, `timer` og `schedule`. En hjelper er en entitet (plattform `helper`) og vises i `/api/entities` og `/api/states` som alle andre; disse rutene er konfigurasjonen. Verdien settes gjennom tjenestene over, med `helpers.write`. Hvert domene, hvert alternativ og hver tjeneste står i [Hjelpere](/nb/iot/helpers/).

### `GET /api/helpers`

Hver hjelper, hver med feltene til entiteten sin og `value`, raden som er lagret for den:

```json
[{"id":41,"entity_id":"timer.purge","unique_id":"helper:6f1d...","domain":"timer","platform":"helper","name":"Purge","options":{"duration_sec":600},"...":"...","value":{"state":"active","finishes_at":"2026-09-27T21:10:00Z","duration_ms":600000,"changed_at":"2026-09-27T21:00:00Z","changed_by":"otto","source":"ui","call_id":"9a1b...","rev":4}}]
```

### `POST /api/helpers`

Oppretter en hjelper med startverdien sin. Bare for administratorer.

```json
{"name":"Batch target","domain":"input_number","unit_of_measurement":"kg","options":{"min":0,"max":5000,"step":50,"initial":1000}}
```

Også `entity_id` (ellers laget ut fra navnet) og `icon`. Svarer `201` `{"helper": {...}}`. `400` for et domene som ikke hører til en hjelper, et alternativ domenet ikke tar, eller en `initial` som hjelperens egne alternativer ville avvist; `409` for en entity_id som er tatt.

### `GET /api/helpers/{entity_id}`

Én hjelper, som i listen. `404` for en ukjent entitet eller en som ikke er en hjelper.

### `PUT /api/helpers/{entity_id}`

Endrer `name`, `icon`, `unit_of_measurement`, `options`, `disabled`, `hidden`, `entity_id`, `equipment_id` eller `labels`, de samme feltene som `PUT /api/entities/{entity_id}`. Bare for administratorer. Nye alternativer som ikke ville latt verdien den holder nå stå (et område innsnevret forbi den, det valgte alternativet fjernet) gir `400`: en verdi flyttes aldri for å passe. Svarer `{"helper": {...}, "warnings": []}`.

### `DELETE /api/helpers/{entity_id}`

Sletter hjelperen og verdien. Bare for administratorer. `{"deleted":"timer.purge"}`. `DELETE /api/entities/{entity_id}` avviser en hjelper med en `409` som peker hit.

## Utstyr og etiketter

ISA-95-treet (virksomhet, lokasjon, område, linje, celle, enhet, utstyr) og frie etiketter. I snake_case. Alle roller leser; bare en administrator endrer, fordi å gi nytt navn til en node eller flytte den skriver om lokasjon, område og linje for hver enhet under den. Se [utstyrstreet og etikettene](/nb/iot/equipment/).

### `GET /api/equipment`

Hver node, sortert etter id, hver med `path` av navn fra roten. `?level=area` filtrerer. `?q=` beholder nodene der stien inneholder teksten (uten å skille store og små bokstaver), `?limit=` (1 til 5000, alt annet er `400`) de første av dem; med en av dem er `X-Total-Count` hvor mange som traff.

```json
[{"id":4,"parent_id":1,"level":"area","name":"Utilities","created_at":"2026-09-27T20:21:01.637319Z","updated_at":"2026-09-27T20:21:01.637319Z","path":["Demo Plant","Utilities"]}]
```

### `POST /api/equipment`

```json
{"parent_id":3,"level":"cell","name":"Die head","description":"Die and screen changer"}
```

`parent_id` null eller utelatt lager en rot. Et barn må ha et lavere nivå enn forelderen (utstyr kan ligge i utstyr). Svarer `{"equipment": {...}, "devices_rewritten": []}`. `400` for feil nivå eller plassering, `409` for en søsken med samme nivå og navn.

### `GET /api/equipment/{id}`

Noden, nodene rett under den, og enhetene og entitetene som er plassert rett på den:

```json
{"children":[],"devices":["extruder-1"],"entities":[],"equipment":{"id":3,"parent_id":2,"level":"line","name":"Line 1","...":"...","path":["Demo Plant","Extrusion","Line 1"]}}
```

`400` for en id som ikke er et positivt tall, `404` for en ukjent.

### `PUT /api/equipment/{id}`

Hvilke som helst av `name`, `description`, `level`, `parent_id` (`null` flytter den til roten). Bare feltene som sendes endres; en tom kropp er en 400. Svarer noden og **hver enhet der lokasjons-, område- eller linjeteksten endret seg som følge av det**, fordi den teksten er det eldre klienter og MCP-verktøyene leser:

```json
{"devices_rewritten":["tank-farm"],"equipment":{"id":4,"parent_id":1,"level":"area","name":"Utilities East","...":"..."}}
```

### `DELETE /api/equipment/{id}`

`{"deleted":5}`. `409` så lenge noe ligger under eller er plassert på den, og sier hva: å slette en node under føttene på en enhet er ikke en avgjørelse man tar ved et uhell.

### `GET /api/labels`

```json
[{"label_id":"critical","name":"Critical","color":"red","icon":"mdi:alert","description":"Stops the line if it fails","created_at":"2026-09-27T20:24:29.659126Z","updated_at":"2026-09-27T20:24:29.659126Z"}]
```

### `POST /api/labels`

`name` er påkrevd; `label_id` (1 til 64 små bokstaver, sifre og understreker) lages ut fra navnet hvis den utelates, og endres aldri etterpå. `color`, `icon` (`mdi:...`) og `description` er valgfrie. Svarer etiketten. `409` for et navn eller en id som er tatt.

### `GET /api/labels/{label_id}`

`{"label": {...}, "devices": ["tank-farm"], "entities": []}`: etiketten og det som bærer den. `404` for en ukjent.

### `PUT /api/labels/{label_id}`

Erstatter `name`, `color`, `icon` og `description`; et felt som utelates tømmes. En `label_id` i kroppen må stemme med stien: ellers `400`, fordi en label_id aldri endres.

### `DELETE /api/labels/{label_id}`

Fjerner den fra alt som bærer den. `{"deleted":"critical"}`, eller `404`.

### `PUT /api/devices/{id}/labels`

`{"labels": ["critical"]}` erstatter hele settet på en enhet. Svarer `{"id":"tank-farm","labels":["critical"]}`. Hver etikett må finnes (`400` med navnene på de som mangler), og enheten også (`404`). Etiketter er med vilje ikke en del av `POST /api/devices`: hver klient som lagrer en enhet sender hele enheten uten dem, og ville slettet dem ved hver lagring.

## Alarmer

ISA-18.2: å utløses, å kvitteres og å gå tilbake til normal er forskjellige ting, og loggen kan si hvilken som skjedde.

### `GET /api/alarms`

Hver definisjon, de levende alarmene og oppsummeringen. `?outstanding=true` utelater de normale og de dempede.

```json
{
  "alarms": [{"definitionId":"extruder-temp-hi","name":"Extruder temperature high","deviceId":"extruder-1","tagName":"Temperature","priority":2,"state":"unack-active","message":"extruder-1/Temperature at 22.80197037650447 C, limit 5","tripValue":22.80197037650447,"raisedAt":"2026-09-27T20:25:19.67042816Z","count":1,"updatedAt":"2026-09-27T20:25:19.67042816Z"}],
  "definitions": [{"id":"extruder-temp-hi","name":"Extruder temperature high","deviceId":"extruder-1","tagName":"Temperature","condition":"hi","limit":5,"priority":2,"enabled":true,"deadband":0.5,"message":"{device}/{tag} at {value}, limit {limit}","createdAt":"2026-09-27T20:25:19.055658Z","updatedAt":"2026-09-27T20:25:19.055658Z"}],
  "summary": {"critical":0,"high":1,"medium":0,"low":0,"unacked":1,"total":1}
}
```

`state` er `normal`, `unack-active`, `ack-active`, `rtn-unack` (gikk tilbake til normal før noen kvitterte, og blir stående i listen slik at en utløsning klokken 3 om natten ikke forsvinner før morgenskiftet ser den), `shelved` eller `suppressed`. `tripValue` er avlesningen som utløste den, ikke den nåværende.

### `POST /api/alarms`

Oppretter eller erstatter en definisjon.

| Felt | Type | <span class="sr-only">Detaljer</span> |
|---|---|---|
| `id`, `name` | string | Påkrevd. `id` følger reglene for enhets-id |
| `deviceId`, `tagName` | string | Påkrevd |
| `condition` | string | `hihi`, `hi`, `lo`, `lolo`, `eq`, `ne`, `true`, `false`, `bad-quality`, `stale` (ingen avlesning på `limit` sekunder), `roc` (endringshastighet over `limit` per sekund) |
| `limit` | number | |
| `priority` | int | 1 (kritisk) til 4 (lav) |
| `enabled` | bool | Utelatt er `false` |
| `deadband` | number | Hvor langt tilbake verdien må komme før alarmen går tilbake. Uten dødbånd hakker en verdi som ligger på grensen |
| `onDelaySec`, `offDelaySec` | int | Hvor lenge betingelsen må holde før alarmen utløses, eller være borte før den går tilbake til normal |
| `message`, `description` | string | `message` tar `{value}`, `{limit}`, `{tag}`, `{device}`, `{unit}`, `{condition}` og `{reason}` (hvorfor avlesningen er dårlig, tom når den er god) |

`{value}` skrives slik verdikortet skriver den, med enhet: hele tall som de er, to desimaler fra 1 og opp, én fra 100 og opp, fire under 1, og vitenskapelig notasjon over ti millioner eller under 0.01 (`8.20 pH`, `212.5 F`, `1.235e+7`). Vi gjorde det slik fordi en tag med skala 0.1 og en råverdi på 82 er 8.200000000000001 som float, og banneret pleide å si det. En tekstavlesning sies som den er. Taggen, skrivingene og automasjonene ser fortsatt det nøyaktige tallet; bare setningen avrundes. `{limit}` er grensen slik du skrev den.

Svarer definisjonen; motoren lastes på nytt og alarmentiteten lages før svaret. `400` ved mislykket validering (`"alarm x: priority must be 1-4, got 9"`).

### `POST /api/alarms/import/codesys`

Leser filen som Export Alarms i CODESYS IDE skriver (en eksport av en alarmgruppe, `.csv`) fra forespørselens kropp, slik IDE-en skrev den (UTF-16 med byte order mark) eller som UTF-8. `?deviceId=` er PLS-ens enhet og er påkrevd. `?application=` er navnet på applikasjonen taggene ligger under, `Application` hvis det utelates: eksporten navngir en variabel fra GVL-en (`GVL_Alarm.bPumpFault`) og taggen er `Application.GVL_Alarm.bPumpFault`. `?defaultPriority=` (1 til 4) er prioriteten til en alarm hvis klasse ikke er Error, Warning eller Info. Uten `?apply=true` lagres ingenting: svaret sier hva som ville kommet med.

Alarmskjermen har dette som Importer fra CODESYS (bare administratorer): velg enheten, gi applikasjonen navn, velg filen, les forhåndsvisningen og importer.

Digitale alarmer sammenlignet med `= TRUE` eller `= FALSE` blir `true` og `false`, UpperLimit med `>` blir `hi`, LowerLimit med `<` blir `lo`, en Outside range-alarm (`OutOfArea`, med begge operatorene `<`) blir to alarmer, en `lo` ved nedre grense og en `hi` ved øvre, meldingen og på- og avforsinkelsene (en IEC-tid som `T#5s`) tas med, og Error er prioritet 2, Warning 3, Info 4. Alt annet IDE-en kan skrive leses ikke og kommer tilbake i `skipped` med raden og hvorfor, fordi oppsettet ikke er dokumentert av CODESYS og bare det en ekte eksport har vist, leses. Det gjelder også resten av det IDE-en tilbyr: Inside the range (`ForbiddenArea`) er sann bare mellom to grenser og en alarm her har én, Change har ingen dokumentert varighet, og Event og Alarm (API) utløses av PLS-programmet og har ingen variabel å overvåke. `warnings` lister det som bare kom delvis med (en ukjent klasse, låsing, en alarm med høyere prioritet).

```json
{"applied": false, "version": "2.0.0.0",
 "alarms": [{"id":"codesys-GVL_Alarm.rTemp-hi","name":"Temperature high","deviceId":"plc1","tagName":"Application.GVL_Alarm.rTemp","condition":"hi","limit":90,"priority":3,"enabled":true,"message":"Temperature high"}],
 "skipped": [{"row":5,"id":"3","reason":"the observation type \"Deviation\" has not been seen in an export, so it is not read"}],
 "warnings": []}
```

`404` for en ukjent enhet, `400` for en fil som ikke er en eksport av en alarmgruppe.

### `DELETE /api/alarms/{id}`

`{"deleted":"extruder-temp-hi"}` eller `404`.

### `POST /api/alarms/{id}/ack`

Valgfri body `{"note": "checking the heater bands"}`. Svarer med alarmen slik den er nå, med `ackedBy` og `ackNote`. `404` for en ukjent alarm.

### `POST /api/alarms/{id}/shelve`

`{"minutes": 30}`, påkrevd og positivt: en tidsubegrenset stillegjøring er en undertrykking, og det er noe annet som ikke er opp til en operatør å gjøre. Svarer med alarmen, `state` `shelved`, med `shelvedUntil` og `shelvedBy`.

### `POST /api/alarms/{id}/unshelve`

Ingen body. Svarer med alarmen tilbake i den tilstanden betingelsen gir den. `409` hvis den ikke var utsatt.

### `GET /api/alarms/events`

Alarmens revisjonsspor, nyeste først. `?alarm=` én definisjon, `?limit=` (standard 200, høyst 5000).

```json
[{"id":2,"definitionId":"extruder-temp-hi","type":"acked","fromState":"unack-active","toState":"ack-active","value":23.192472931395088,"message":"extruder-1/Temperature at 22.80197037650447 C, limit 5","actor":"admin","note":"checking the heater bands","at":"2026-09-27T20:25:22.920251Z"}]
```

`type` er `raised`, `acked`, `cleared`, `shelved`, `unshelved`, `suppressed`, `unsuppressed`, `escalated` eller `escalation-ended`. De to siste skrives av alarmeskaleringen (`actor` er `escalation`), og `note` sier hvem som ble varslet og hvorfor kjeden stoppet. Se [Alarmvarsler](/nb/iot/notifications/#escalation).

## Automasjoner

Utløsere, en betingelse, handlinger. Regelspråket står i [Automasjoner](/nb/iot/automations/).

### `GET /api/automations`

```json
{"armed":{"fill-tank":true},"automations":[{"id":"fill-tank","name":"Fill the tank","enabled":true,"triggers":[{"type":"threshold","deviceId":"tank-farm","tagName":"level","threshold":20,"direction":"falling","hysteresis":5},{"type":"webhook","webhookPath":"fill-now"}],"actions":[{"type":"call_service","name":"start the pump","params":{"service":"switch.turn_on","entityId":"switch.tank_farm_pump"}}],"mode":"skip","minIntervalSec":60,"createdAt":"2026-09-27T20:26:49.770826Z","updatedAt":"2026-09-27T20:26:49.770826Z"}],"webhooks":["fill-now"]}
```

`armed` er hvilke regler som faktisk kjører, og det er ikke det samme som `enabled`: en aktivert regel som sluttet å kompilere er ikke armert, og her finner du ut av det.

### `POST /api/automations`

Oppretter eller erstatter en regel: `id`, `name`, `description`, `enabled`, `triggers` (minst én), `condition`, `actions` (minst én), `mode` (`skip`, standard, `queue`, `restart` eller `parallel`), `minIntervalSec`, `maxRuntimeSec`. Regelen kompileres før den lagres, og en som ikke kompilerer gir en 400 og når aldri databasen: en lagret regel som ikke kan armeres er en regel forfatteren tror kjører.

```json
{"error":"automation fill-tank action 1 (call_service): params: json: unknown field \"entity_id\""}
```

### `POST /api/automations/validate`

Kompilerer en regel uten å lagre den, for redigeringsprogrammets sjekk underveis. Alltid `200`; svaret sier om den kompilerte:

```json
{"valid":true}
{"error":"automation bad: at least one trigger is required","valid":false}
```

Den trenger `automations.write` fordi den finnes for å hjelpe noen med å skrive en.

### `DELETE /api/automations/{id}`

`{"deleted":"fill-tank"}` eller `404`.

### `POST /api/automations/{id}/enabled`

`{"enabled": false}` slår den av uten å slette den. Svarer med `{"enabled":false,"id":"fill-tank"}` eller `404`.

### `POST /api/automations/{id}/trigger`

Kjører den nå, som om en utløser hadde slått til. Betingelsen gjelder fortsatt (en som er usann registrerer en `skipped`-kjøring), og det samme gjør kjøremodusen; `minIntervalSec` gjør det ikke, for en person som ber om en kjøring er ikke en tag som flimrer. Ingen body. `202` `{"triggered":"fill-tank"}`: kjøringen skjer i bakgrunnen, og `GET /api/runs` har resultatet. `400` hvis regelen ikke er armert. Operatører har `automations.trigger`; å kjøre en regel noen andre har skrevet er å operere, å skrive en er det ikke.

### `GET /api/runs`

Kjørehistorikk, nyeste først. `?automation=` én regel, `?limit=` (standard 100, høyst 1000). `[]` når det ikke finnes noen.

```json
[{"id":1,"automationId":"fill-tank","status":"succeeded","triggerType":"manual","triggerDesc":"triggered by admin","actor":"admin","startedAt":"2026-09-27T20:26:50.269792Z","finishedAt":"2026-09-27T20:26:50.282129Z","durationMs":12.337,"steps":[{"index":1,"type":"call_service","name":"start the pump","input":"switch.turn_on switch.tank_farm_pump {}","output":"true to tank-farm/pump: written; call 8fb9538c82d532be","startedAt":"2026-09-27T20:26:50.272532641Z","durationMs":9.595}]}]
```

`status` er `running`, `succeeded`, `failed`, `skipped`, `timed_out` eller `cancelled`. Trinnene beholder de løste inndataene, ikke malene, fordi det er det du trenger å lese klokken tre om natten.

En regel laget fra en blueprint har tre felt til i `GET /api/automations`: `blueprintId`, `blueprintVersion` (versjonen den ble laget fra, som er versjonen den blir stående på) og `blueprintInputs`. En regel skrevet for hånd har ingen av dem. De tilhører serveren: `POST /api/automations` godtar dem og ignorerer dem, og en redigering for hånd beholder det regelen hadde.

### `POST /api/automations/{id}/blueprint-upgrade`

Flytter en regel laget fra en blueprint til blueprintens nyeste versjon, og beholder id, navn og om den er armert. Det gjøres aldri for deg. Operatører har `blueprints.apply`, det samme som for å lage en. Se først: **`?dry_run=true`** endrer ingenting og svarer hva som ville endret seg, del for del, og hva regelen da ville gjort om den utløste nå, med hver skriving lagt fram for skrive-portens kontroller:

```json
{"dry_run":true,"id":"pump_1_watch","blueprint":"pump_watch","from":1,"to":2,"changes":[{"field":"actions","before":[{"params":{"message":"switch.pump_1 started, v1"},"type":"log_event"}],"after":[{"params":{"message":"switch.pump_1 started, v2"},"type":"log_event"}]}],"automation":{"id":"pump_1_watch","...":"..."},"check":{"automation_id":"pump_1_watch","steps":[{"step":"1","type":"log_event","verdict":"not_checked","detail":"a dry run checks writes to equipment; this step writes to none and runs only for real"}]}}
```

En redigering gjort for hånd siden regelen ble laget vises i `changes` som erstattet. Når den nye versjonen trenger en inndata regelen ikke har noen verdi for, eller avviser en verdi den ble laget med, sier prøvekjøringen det i `error` og ingenting annet.

Den ekte tar `{"version": 2}`, versjonen prøvekjøringen viste, og `inputs` for alt den nye versjonen trenger. En blueprint som har gått videre siden, eller en regel noen oppgraderte i mellomtiden, gir en `409`: det som ble gjennomgått er det som går inn, eller ingenting gjør det. En manglende inndata gir en `400`. `200` med samme form, der `automation` er regelen slik den er lagret. Den logges som `automation upgraded from blueprint pump_watch version 1 to 2`. Med samme versjon og nye `inputs` er det slik en regels inndata endres. `400` for en regel skrevet for hånd; `404` hvis blueprinten den kom fra er borte.

## Skript

Navngitte sekvenser av handlinger, kjørt ved behov: herfra, fra en regels `call_script`-trinn, fra MCPs `run_script` eller gjennom skriptets entitet (`script.turn_on`). Sekvensen er automasjonsspråket. Hver skriving et trinn gjør går gjennom skrive-porten som `script:<id>`, med kilden til den som startet det. Alt står i [Skript](/nb/iot/scripts/).

### `GET /api/scripts`

Hvert skript, med kjøretellerne sine og hvor mange kjøringer av det som pågår nå, i alle prosesser:

```json
[{"id":"cip_cycle","name":"CIP cycle","fields":[{"name":"minutes","type":"number","required":true,"min":1,"max":60,"unit":"min"}],"sequence":[{"type":"call_service","params":{"entityId":"switch.cip_pump","service":"switch.turn_on"}}],"mode":"skip","createdAt":"2026-09-28T10:00:00Z","updatedAt":"2026-09-28T10:00:00Z","lastRun":"2026-09-28T10:05:00Z","lastStatus":"succeeded","runCount":3,"running":0}]
```

### `POST /api/scripts`

Oppretter ett. Bare for administratorer. `id` (små bokstaver, sifre og understreker, starter med en bokstav: det er entitetens objekt-id, `script.<id>`), `name`, `description`, `icon`, `fields` (typede inndata), `sequence` (minst én handling), `mode` (`skip`, standard, `queue`, `restart` eller `parallel`) og `maxRuntimeSec`. Det kompileres før det lagres, som en regel, og et skript som ville kalle seg selv, direkte eller gjennom andre skript, avvises. Svarer med `201` og skriptet. `400` for alt som ikke kompilerer; `409` for en id som er tatt.

### `POST /api/scripts/validate`

Sjekker et skript uten å lagre det, for redigeringsprogrammets sjekk underveis. `200` `{"valid":true}` eller `{"valid":false,"error":"..."}`, med de ordene en lagring ville blitt avvist med.

### `GET /api/scripts/{id}`

Ett skript, som i listen. `404` hvis det ikke finnes.

### `PUT /api/scripts/{id}`

Erstatter definisjonen; bodyen er den samme som for å opprette det, og `id` kan utelates. Bare for administratorer. Kjøringer av det som pågår avbrytes når trinnene, feltene eller modusen endres: de ble startet fra den gamle definisjonen.

### `DELETE /api/scripts/{id}`

Sletter det og kjørehistorikken, og avbryter kjøringene som pågår. Bare for administratorer. `{"deleted":"cip_cycle"}`. Entiteten blir foreldreløs, ikke slettet.

### `POST /api/scripts/{id}/run`

Kjører det. Operatører har `scripts.run`.

```json
{"fields":{"minutes":20},"reason":"end of shift clean","wait":false}
```

Hvert felt i bodyen er valgfritt, og det er bodyen også. Feltene kontrolleres mot skriptets før noe kjører: en verdi utenfor området, utenfor steget, som ikke er ett av alternativene eller som har feil type gir en `400`, og flyttes aldri for å passe. `202` med kjøringen så snart den har startet; med `"wait":true` `200` med kjøringen når den er ferdig, sporet inkludert.

```json
{"run":{"id":77,"scriptId":"cip_cycle","status":"running","actor":"otto","source":"ui","fields":{"minutes":20},"startedAt":"2026-09-28T10:05:00Z","durationMs":0}}
```

`409` når det er opptatt: kjører allerede og modusen er `skip`, eller kjører med én i kø og modusen er `queue`. Ingenting kjørte, og en `skipped`-kjøring står i historikken og sier hvorfor:

```json
{"error":"script busy: script cip_cycle was not started: it is already running, and its mode is skip","run":{"id":78,"scriptId":"cip_cycle","status":"skipped","...":"..."}}
```

**`?dry_run=true`** spør hva en kjøring ville gjort nå og gjør ikke noe av det. Feltene kontrolleres på samme måte; så gås hvert trinn gjennom mot anlegget slik det er: hver skriving og tjenestekall legges fram for portens egne kontroller, en betingelse evalueres, en variabel bindes. En ventetid, en forsinkelse og alt som ikke skriver til noe utstyr er `not_checked`. Den første skrivingen som ville blitt avvist avslutter det, slik den ville avsluttet kjøringen, og `error` sier det med portens ord. `200` med dommen, avvist eller ikke:

```json
{"dry_run":true,"check":{"script_id":"cip_cycle","fields":{"minutes":20},"steps":[{"step":"1","type":"call_service","input":"switch.turn_on switch.cip_pump {}","verdict":"refused","detail":"cip/pump: this tag is not marked writable"}],"error":"step 1 (call_service): cip/pump: this tag is not marked writable"}}
```

Hvert trinns `verdict` er `would_write`, `refused`, `ends_here` (en betingelse som er usann nå, eller et stopp), `not_checked` eller `ok`. Et trinn i et skript det kaller nummereres under kallet: `3.1`.

### `POST /api/scripts/{id}/stop`

Avbryter alle kjøringer av det som pågår, i alle prosesser, uansett hvor. `{"cancelled":1,"stopped":"cip_cycle"}`, der `cancelled` er kjøringene denne prosessen hadde. Operatører har `scripts.run`: å stoppe det de kan starte er en del av å starte det.

### `GET /api/scripts/{id}/runs`

Kjøringene, nyeste først, med sporene sine. `?limit=` (standard 50, høyst 1000). `parent` er det som kalte en kjøring, når noe gjorde det: `automation_run:812`, `script_run:77`.

```json
[{"id":77,"scriptId":"cip_cycle","status":"succeeded","actor":"automation:shift-end","source":"automation","parent":"automation_run:812","fields":{"minutes":20},"startedAt":"2026-09-28T10:05:00Z","finishedAt":"2026-09-28T10:25:00Z","durationMs":1200012,"steps":[{"index":1,"type":"call_service","input":"switch.turn_on switch.cip_pump {}","output":"true to cip/pump: written; call 8fb9538c82d532be","startedAt":"2026-09-28T10:05:00Z","durationMs":9.6}]}]
```

## Oppskrifter

Sett med verdier som brukes sammen: settpunktene for en produktkvalitet, en omstilling. Hver av dem er også en entitet, `scene.<id>`. En oppskrift kontrolleres i sin helhet før noe går ut og avvises i sin helhet uansett grunn; målene går deretter ut i rekkefølge under én og samme kall-id, det første som feiler stopper resten, og ingenting angres; hver skrevet verdi leses tilbake fra enheten. Alt står i [Oppskrifter](/nb/iot/recipes/).

En oppskrifts navn, beskrivelse, utstyrsnode og tillatelse endres på stedet. Det den skriver (`targets`, `params`, `precondition`, `verify_sec`) er en versjon, og versjoner endres aldri: å lagre nytt innhold lagrer den neste.

### `GET /api/recipes`

Hver oppskrift, med innholdet i gjeldende versjon og den nyeste bruken:

```json
[{"id":"grade_a","name":"Grade A","equipment_id":7,"apply_permission":"recipes.apply","current_version":3,"params":[{"name":"speed","type":"number","min":0,"max":400,"step":10,"unit":"rpm","required":true}],"precondition":"states['input_boolean.line_ready'] == 'on'","targets":[{"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210}},{"entity_id":"number.line_02_speed","service":"set_value","data_expressions":{"value":"vars.speed"}}],"verify_sec":10,"note":"zone 1 up 5","created_at":"2026-09-28T10:00:00Z","updated_at":"2026-09-28T11:00:00Z","last_application":{"id":41,"recipe_id":"grade_a","version":3,"call_id":"7c1f0e2d9a8b6c54","actor":"otto","source":"ui","params":{"speed":250},"status":"applied","targets":[],"started_at":"2026-09-28T11:05:00Z","finished_at":"2026-09-28T11:05:01Z"}}]
```

`equipment_id` er `null` for en oppskrift for hele anlegget.

### `POST /api/recipes`

Oppretter en, som versjon 1. Bare for administratorer. `id` (små bokstaver, sifre og understreker, starter med en bokstav: det er entitetens objekt-id, `scene.<id>`), `name`, `description`, `equipment_id`, `apply_permission` (`recipes.apply`, standard, eller `recipes.apply.<name>`), `params` (typede inndata), `precondition` (et uttrykk som må være sant for å starte), `targets` (minst ett, høyst 200, hvert med `entity_id`, `service` og `data` eller `data_expressions`), `verify_sec` (1 til 600, standard 10) og `note`. Et mål setter en verdi: `set_value`, `select_option`, `set_position`, `set_speed`, `set_setpoint`, `set_mode`, `turn_on`, `turn_off`, på domenene som tar imot dem. En puls eller en start avvises: den hører hjemme i et skript. Hvert måls entitet må finnes, og hvert uttrykk må kompilere. `201` med oppskriften; `400` for alt som er galt, `409` for en id som er tatt.

### `POST /api/recipes/capture`

Lager et utkast til en oppskrift fra det entiteter har nå, bare for administratorer, og lagrer ingenting:

```json
{"entity_ids":["number.line_02_zone1_sp","switch.line_02_heater","loop.line_02_tic"]}
```

Hver blir et mål som setter den tilbake til sin nåværende verdi, i oppgitt rekkefølge; en sløyfe blir modusen sin og så settpunktet sitt. Svaret er en oppskrift uten id og uten navn, for redigeringsprogrammet. En entitet som ikke finnes, er deaktivert, leses med en annen kvalitet enn god, er `unknown` eller `unavailable`, eller ikke er noe en oppskrift setter, gir en `400` som nevner hver eneste en: en oppskrift bygd på en dårlig avlesning skriver den dårlige avlesningen tilbake.

### `GET /api/recipes/{id}`

Én oppskrift, som i listen. `404` hvis det ikke finnes noen.

### `PUT /api/recipes/{id}`

Lagrer den. Bare for administratorer. Bodyen er oppskriften slik `GET` svarte, redigert; `id` kan utelates. `current_version` er versjonen redigeringen ble gjort mot: hvis noen har lagret en annen siden, gir lagringen en `409` i stedet for å stille overskrive deres (`0` hopper over sjekken). Nytt innhold blir neste versjon, med `note` som sier hvorfor; en endring bare av navn, beskrivelse, utstyr eller tillatelse lager ingen.

### `DELETE /api/recipes/{id}`

Sletter den og versjonene. Bare for administratorer. `{"deleted":"grade_a"}`. Bruken av den beholdes, fordi den er det som ble sendt til anlegget, og entiteten blir foreldreløs.

### `GET /api/recipes/{id}/versions`

Hver versjon, nyeste først, hver nøyaktig slik den ble lagret, med hvem som lagret den og notatet:

```json
[{"recipe_id":"grade_a","version":3,"params":[],"targets":[{"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210}}],"verify_sec":10,"note":"zone 1 up 5","created_by":"ada","created_at":"2026-09-28T11:00:00Z"}]
```

### `GET /api/recipes/{id}/versions/{version}`

Én versjon. `404` hvis oppskriften ikke har en slik versjon, `400` hvis `{version}` ikke er et tall.

### `POST /api/recipes/{id}/validate`

Ville den blitt brukt akkurat nå? Operatører har `recipes.apply`. Bodyen er den til en bruk, og ingenting skrives, registreres eller logges. Hver kontroll en bruk gjør før den skriver, gjøres: parameterne, oppskriftens egen tillatelse, forhåndsbetingelsen, datauttrykkene, om en annen bruk skriver til en av entitetene, og hvert mål lagt fram for skrive-portens kontroller. `200` med dommen, `would_apply` eller `refused`, og hvert måls egen: `would_write`, `refused` med grunnen, eller `not_sent`.

```json
{"dry_run":true,"application":{"recipe_id":"grade_a","version":3,"params":{"speed":250},"status":"refused","targets":[{"index":1,"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210},"status":"would_write"},{"index":2,"entity_id":"number.line_02_speed","service":"set_value","data":{"value":250},"status":"refused","error":"line-02/Speed: this tag is not marked writable"}],"started_at":"2026-09-28T11:04:00Z","error":"target 2 (set_value number.line_02_speed): line-02/Speed: this tag is not marked writable"}}
```

Parametere den ikke tar gir en `400`, slik de ville gjort for den ekte.

### `POST /api/recipes/{id}/apply`

Bruker den. Operatører har `recipes.apply`. En oppskrift som nevner en egen tillatelse, `recipes.apply.<name>`, krever også den, kontrollert her mot oppskriften; en bruker uten den får en `403` og en avvist bruk i historikken med navnet sitt på.

```json
{"params":{"speed":250},"reason":"grade A for the 2pm run","version":0,"resume":0}
```

Alt er valgfritt, og det er bodyen også. `version` bruker en eldre versjon med vilje; utelatt, den gjeldende. `resume` er id-en til en tidligere bruk av denne oppskriften som stoppet halvveis: målene som ikke ble skrevet går ut som en ny bruk, med dens versjon og parametere, og `parent` sier hvilken den fullfører.

Den svarer når hver verdi er skrevet og lest tilbake, noe som tar opptil oppskriftens `verify_sec`:

```json
{"application":{"id":42,"recipe_id":"grade_a","version":3,"call_id":"9d2e4f6a8b0c1e3f","actor":"otto","source":"ui","reason":"grade A for the 2pm run","params":{"speed":250},"status":"applied","targets":[{"index":1,"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210},"status":"written","writes":[{"tag":"line-02/Zone1_SP","value":"210","status":"written"}],"verification":"verified","verify_detail":"read back 210"},{"index":2,"entity_id":"number.line_02_speed","service":"set_value","data":{"value":250},"status":"written","writes":[{"tag":"line-02/Speed","value":"250","status":"written"}],"verification":"unconfirmed","verify_detail":"not confirmed within 10s: read back 240, not 250"}],"started_at":"2026-09-28T11:05:00Z","finished_at":"2026-09-28T11:05:10Z"}}
```

Et mål er `written`, `failed` (det gikk ut og enheten sa nei, eller sa ingenting), `not_sent`, `skipped` (et før det gikk ikke gjennom) eller `refused` (forhåndsvalidering). Et skrevet er `verified` når enheten leste tilbake verdien det ble sendt etter at det var sendt, og `unconfirmed` når den ikke gjorde det innen `verify_sec`: det gikk ut og er kanskje ikke tatt til følge. Hver skriving bærer bruken sin `call_id`, så `GET /api/writes?call=<call_id>` er alle sammen.

| Status | Når |
|---|---|
| 200 | `applied`: hvert mål skrevet. Sjekk hvert måls `verification` |
| 400 | En parameter oppskriften ikke tar, utenfor området eller av feil type; en `resume` uten noe igjen å bruke |
| 403 | Oppskriftens egen tillatelse. Registrert som en avvist bruk |
| 404 | Ingen slik oppskrift, eller ingen slik versjon |
| 409 | `refused`: enhver grunn til ikke å starte, hver i `error` og på målet sitt. Eller en annen bruk skriver akkurat nå til en av entitetene. Ingenting ble skrevet |
| 502 | `partial` eller `failed`: den startet, og ikke hvert mål gikk ut. `targets` sier nøyaktig hvilke. Ingenting angres |

Hvert svar unntatt en `400` for en ugyldig body eller en `404` bærer bruken, og hver bruk unntatt en prøvekjøring står i `GET /api/recipes/{id}/applications`, avvisninger inkludert.

### `GET /api/recipes/{id}/applications`

Bruken av den, nyeste først, avviste inkludert. `?limit=` (standard 50, høyst 1000). `parent` er det som brukte den, når noe gjorde det: `automation_run:812`, `script_run:77`, `application:41`. Bruken av en slettet oppskrift besvares fortsatt.

## Blueprints

En automasjon skrevet én gang med typede tomrom i, fylt ut for å lage en vanlig regel. Regelen beholder versjonen den ble laget fra; å redigere blueprinten endrer ingen regel, og å flytte en til en nyere versjon er [en oppgradering](#post-apiautomationsidblueprint-upgrade) noen ber om. Hver skriving regelen gjør går gjennom skrive-porten som `automation:<id>`. Alt står i [Blueprints](/nb/iot/blueprints/).

### `GET /api/blueprints`

Hver blueprint, de innebygde først, hver med hvor mange regler som er laget fra den:

```json
[{"id":"motor_running_too_long","name":"Motor running too long","description":"Says so when a motor has been running longer than it should...","source":"builtin","version":1,"inputs":[{"name":"motor","label":"Motor","type":"entity","required":true,"domain":["motor"]},{"name":"max_run","label":"Longest it may run","type":"duration","default":3600},{"name":"stop_it","label":"Stop it as well","type":"boolean","default":false}],"template":{"triggers":[{"type":"state","entityId":{"!input":"motor"},"to":"running","forSec":{"!input":"max_run"}}],"...":"..."},"instances":2}]
```

`source` er `builtin` (følger med i binærfilen, skrivebeskyttet) eller `user`.

### `POST /api/blueprints`

Skriver en. Bare for administratorer. `id` (små bokstaver, sifre og understreker, starter med en bokstav), `name`, `description`, `inputs` (typede, det samme som et skripts felt) og `template`: regelen, med sine `description`, `triggers`, `condition`, `actions`, `mode`, `minIntervalSec` og `maxRuntimeSec`, og tomrommene i den. `{"!input": "motor"}` som verdi erstattes av inndataen; det samme gjelder `${motor}` i en streng, som en literal der strengen er et uttrykk. Den kontrolleres før den lagres: hvert tomrom nevner en inndata, hver inndata brukes, og fylt ut med eksempelverdier gir den en regel som kompilerer. `201` ved `version` 1. `400` for alt som er galt med den, `409` for en id som er tatt, også en innebygdes.

### `GET /api/blueprints/{id}`

Én, som i listen. `404` hvis det ikke finnes noen.

### `PUT /api/blueprints/{id}`

Erstatter definisjonen; bodyen er den samme som for å skrive en, og `id` kan utelates. Bare for administratorer. `version` går opp med én når `inputs` eller `template` endret seg, og ikke for et nytt navn eller en ny beskrivelse. **Ingen regel laget fra den endres.** Hver beholder versjonen den ble laget fra, og `GET /api/automations` viser hvilken. En innebygd gir en `400`: kopier den under en egen id.

### `DELETE /api/blueprints/{id}`

Bare for administratorer. `{"deleted":"pump_watch"}`. `409` så lenge noen regel laget fra den finnes, med navnene deres: slett dem først. En innebygd gir en `400`.

### `POST /api/blueprints/{id}/instantiate`

Lager en regel fra den og armerer den. Operatører har `blueprints.apply`: hvilken pumpe og hvor lenge er opp til dem, og hva regelen gjør ble bestemt da blueprinten ble skrevet.

```json
{"automationId":"infeed_too_long","name":"Infeed pump ran too long","enabled":true,"inputs":{"motor":"motor.infeed_pump","max_run":"90m","stop_it":true}}
```

`name` er som standard blueprintens og `enabled` er `true`. Hver inndata kontrolleres før noe lages: en verdi utenfor området, utenfor steget, som ikke er ett av alternativene, en entitet fra et annet domene eller av feil type gir en `400` som nevner hver som er feil, og flyttes aldri for å passe. En `automationId` som er tatt gir en `409`: å lage en regel erstatter aldri en. `201` med regelen, med `blueprintId`, `blueprintVersion` og `blueprintInputs` satt. Det logges som `automation made from blueprint motor_running_too_long version 1`.

**`?dry_run=true`** lager ingenting. Den svarer med regelen den ville laget og hva regelen ville gjort om den utløste nå: betingelsen evaluert, hver skriving og tjenestekall lagt fram for portens kontroller som `automation:<id>`, den første avvisningen i `check.error` med portens ord. Ingenting lagres, skrives eller revideres.

```json
{"dry_run":true,"automation":{"id":"infeed_too_long","...":"..."},"check":{"automation_id":"infeed_too_long","steps":[{"step":"1","type":"log_event","verdict":"not_checked"},{"step":"2","type":"condition","input":"true","verdict":"ok","detail":"true now"},{"step":"3","type":"call_service","input":"motor.stop motor.infeed_pump {}","verdict":"would_write","detail":"would write false to line-02/M1_Run"}]}}
```

## Dashbord

Sider med kort, for rollene og skjermene som trenger dem. Et dashbord kommanderer ingenting: et kort nevner en tag, en entitet, et skript eller en oppskrift, og knappen skriver gjennom [`POST /api/write`](#post-apiwrite) som personen som trykket. Veggtavlen er ett av dem. Alt står i [Dashbord](/nb/iot/dashboards/).

### `GET /api/dashboards`

Dashbordene den som kaller blir tilbudt, i den rekkefølgen bytteren viser dem, veggtavlen inkludert. Den som har `dashboards.write` blir tilbudt alle.

```json
[{"id":"wall","name":"Wall board","description":"The tags pinned on the Board screen, as gauges.","kind":"wall","roles":[],"homeFor":[],"screens":["wall-tv"],"position":0,"cards":[],"version":2,"updatedBy":"ada"},
 {"id":"line-2","name":"Line 2","kind":"cards","roles":["operator","admin"],"homeFor":["operator"],"screens":["line-2-panel"],"position":1,"version":3,"updatedBy":"ada","cards":[{"id":"temp","type":"gauge","title":"Zone 1","w":3,"h":3,"config":{"tag":"press-01/Zone1_Temp"}}]}]
```

### `POST /api/dashboards`

Bygger ett. Bare for administratorer. `id` (små bokstaver, sifre, bindestreker og understreker, starter med en bokstav), `name`, og eventuelt `description`, `roles`, `homeFor`, `screens`, `position` og `cards`. `201` ved `version` 1, med hvert korts størrelse og konfigurasjon i den formen de ble lagret.

Et kort er `id`, `type`, `title`, `w` (1 til 12 kolonner), `h` (1 til 8 rader) og en `config`. Typene og konfigurasjonene deres står i [Dashbord](/nb/iot/dashboards/#kortene). Det kontrolleres før det lagres:

- en konfigurasjonsnøkkel typen ikke har, et tall utenfor området, en kamera- eller plantegningsadresse med en pålogging eller et token i, eller mer enn 60 kort gir en `400`;
- et kort som nevner en tag, entitet, skript eller oppskrift som ikke finnes gir en `400` som nevner den;
- en `button` på en tag som ikke er skrivbar, eller med et tall utenfor tagens område, gir en `400`: porten ville avvist hvert trykk;
- en rolle som ikke finnes gir en `400`;
- en `id` som er tatt, en skjerm et annet dashbord allerede har, eller en rollestartside et annet dashbord allerede er, gir en `409`.

### `GET /api/dashboards/{id}`

Ett, som i listen. `404` hvis det ikke finnes noe, og også hvis den som kaller ikke blir tilbudt det.

### `PUT /api/dashboards/{id}`

Erstatter det. Bare for administratorer. Bodyen er dashbordet slik `GET` svarte, med `version` satt til versjonen det ble lest ved: **den er påkrevd**, og en lagring som nevner en versjon som ikke lenger er gjeldende gir en `409` som sier hva den gjeldende er, fordi alternativet er å stille slette det den siste som lagret nettopp har bygd. `id` kan utelates fra bodyen, `kind` kan ikke endres, og `createdAt`, `updatedAt` og `updatedBy` tilhører serveren og ignoreres. `200` med dashbordet ved neste versjon.

Veggtavlen tar en `PUT` for tilordningene sine (`roles`, `homeFor`, `screens`, `position`) og ingenting annet: den har ingen kort, så en med kort gir en `400`. Målerne er tavlens tagger, `GET` og `PUT /api/board`.

### `DELETE /api/dashboards/{id}`

Bare for administratorer. `{"deleted":"line-2"}`. Kort peker på ting og eier ingenting, så ingenting annet røres. Veggtavlen gir en `400`: den er alltid der.

Bygging, lagring og sletting logges som `config`-hendelser på subjektet `dashboard:<id>`.

### `GET /api/dashboards/{id}/export`

Dashbordet som en skjermfil: et versjonert JSON-dokument som [`POST /api/dashboards/import`](#post-apidashboardsimport) laster inn i en annen installasjon. Det svarer som et vedlegg kalt `<id>.hotloop-screen.json`. Den som kaller trenger `dashboards.read` og må bli tilbudt dashbordet, som for `GET` av ett. Veggtavlen gir en `400`: det er en installasjons festede målere, ikke en layout. Formatet står i [Skjermfiler](/nb/iot/screen-file/).

### `POST /api/dashboards/import`

Leser en skjermfil, kontrollerer den mot denne installasjonen og lagrer den som et nytt dashbord. Bare for administratorer, og den kan ikke lagre det `POST /api/dashboards` ville avvist. Bodyen er selve filen, eller `{"file": {...}}` med alternativer ved siden av:

| Alternativ | <span class="sr-only">Detaljer</span> |
|---|---|
| `id`, `name` | Lagre det under en annen id eller et annet navn. |
| `replace` | Hvis id-en er tatt, lagre over det dashbordet ved gjeldende versjon. Uten den gir en id som er tatt en `409`. |
| `skipAssignments` | Utelat filens `screens` og `homeFor`, som tilhører installasjonen som lagde den. `roles` blir. |
| `remap` | Hva ting skal hete her: `tags` (hel nøkkel til hel nøkkel, slik filen nevner taggen eller slik den leses etter at `devices` har flyttet den), `devices` (id til id, som også flytter enhetsdelen av hver tag som ikke er nevnt i `tags`), `entities`, `scripts`, `recipes` og `equipment` (id til id). En oppføring ingenting på skjermen brukte er en advarsel. |
| `dryRun` | Svar med rapporten og lagre ingenting. Alltid `200`. |
| `codesys`, `visualization` | I stedet for `file`: teksten i en innebygd CODESYS-eksport, og visualiseringen som skal tas når den inneholder flere. Rapporten har da en `conversion` med hva hvert element ble og hva som ble utelatt. Se [Importer en CODESYS-skjerm](/nb/iot/codesys-screen-import/). |

Svaret er en rapport enten noe ble lagret eller ikke:

```json
{"ok":false,"dryRun":true,"id":"line-2","name":"Line 2","cards":6,"replaces":false,
 "problems":[{"kind":"tag","ref":"press-01/Zone1_Temp","message":"tag press-01/Zone1_Temp does not exist here; map it to one that does, or add it on the Tags screen first"}],
 "warnings":[],"remapped":[],
 "requires":{"tags":[{"key":"press-01/Zone1_Temp","writable":false}],"entities":[],"scripts":[],"recipes":[],"devices":[],"equipment":[]}}
```

Hver manglende referanse listes, ikke bare den første. En `kind` er `file` (ikke en skjermfil, feil format, en nyere formatversjon enn denne bygget leser, eller et felt den ikke kjenner), `screen` (dashbordets egne regler: et dårlig kort, en rolle som ikke finnes, for stort), `tag`, `entity`, `script`, `recipe`, `device`, `equipment`, `writable` (en knapp eller et settpunkt på en tag som ikke er skrivbar), `assignment` (et skjermnavn eller en rollestartside som et annet dashbord har) eller `exists` (id-en er tatt). En import med et eneste problem lagrer ingenting: `400`, eller `409` når det eneste problemet er `exists` eller `assignment`, med samme rapport. Suksess er `201`, eller `200` når den erstattet et, med rapporten og det lagrede `dashboard`. Det logges som en `config`-hendelse på subjektet `dashboard:<id>`.

## Webhooks

### `POST /api/webhook/{path}`

Utløser hver automasjon med en `webhook`-utløser på den stien. **Ingen sesjon og ingen tillatelse**: stien er hemmeligheten en tredjepart får, den samme tillitsmodellen dette endepunktet alltid har hatt, og et SCADA-system eller en SaaS-callback har ingen konto å logge inn med. Velg en sti ingen kunne gjette.

Bodyen, opptil 1 MiB, gis til regelen. `202` `{"accepted":"fill-now"}`. `404` `"no automation is listening on this webhook path"` når ingen lytter: en webhook som poster inn i ingenting ser lik ut som en som fungerer, så den sier det.

## Flåte

Registrerte edge-reléer, deres sanntidsnærvær over Sparkplug, og kommandoer til dem. Trenger `HOTLOOP_FLEET_ENABLED`. Se [Flåtestyring](/nb/gateway/fleet/).

### `GET /api/fleet`

```json
{"configured":true,"members":[{"id":"press-relay-01","name":"Press line relay","group":"plant-a","nodeId":"press-relay-01","statusUrl":"http://press-relay-01:8081","enabled":true,"createdAt":"2026-09-27T20:28:49.448323Z","updatedAt":"2026-09-27T20:28:49.448323Z","online":false,"polled":true,"error":"Get \"http://press-relay-01:8081/status\": dial tcp: lookup press-relay-01 on 10.89.0.1:53: no such host"}]}
```

`online` kommer fra NBIRTH og NDEATH. `release` er bygget reléet sa det kjører i sin siste birth: `version`, `imageDigest` (når veilederen dens sier det; Helm-chartet gjør det ikke) og `since`, da Gatewayen først hørte det bygget. Et relé for gammelt til å rapportere ett har ingen. For et medlem med `statusUrl` er `polled` sann, og `reachable`, `forwardQueueLen`, `devices`, `connected`, `config` og `updateMode` (`auto` eller `approve`) kommer fra dets `/status`; de betyr ingenting når det ikke var nåbart. Med funksjonen av: `{"members":[],"configured":false}`.

### `POST /api/fleet`

Oppretter eller erstatter et medlem: `id`, `name`, `group` og `nodeId` (dets Sparkplug-identitet) påkrevd; `description`, `statusUrl` (`http://` eller `https://`) og `enabled` valgfritt. Svarer med medlemmet. Dette fungerer med funksjonen av, slik at flåten kan deklareres før den slås på.

### `DELETE /api/fleet/{id}`

`{"deleted":"press-relay-01"}` eller `404`.

### `POST /api/fleet/{id}/rebirth`

Publiserer en `Node Control/Rebirth` til reléet. Ingen body. `{"status":"rebirth requested"}`. `404` for et ukjent medlem.

### `POST /api/fleet/{id}/restart`

Publiserer `Node Control/Reboot`. `{"status":"restart requested"}`. Bare for administratorer: å starte et relé på nytt mister dataene dets til det er tilbake.

### `POST /api/fleet/{id}/update`

Godkjenner bildeoppdateringen et relé holder tilbake. Publiserer `Node Control/Update`. `{"status":"update approved"}`. Bare for administratorer: reléet avslutter og veilederen starter det bildet det følger, så det mister dataene sine så lenge det tar. Det gjør bare noe med et relé satt til `HOTLOOP_EDGE_RELAY_UPDATE_MODE=approve`; ethvert annet relé logger at det ignorerte det. Forespørselen nevner ikke noe bilde: det finnes ikke noe sted å legge et, og det er poenget. Se [Edge Relay-referansen](/nb/edge-relay/reference/#oppdatere-en-relay).

### `POST /api/fleet/{id}/config`

Skyver en ny enhetsfil til reléet, som tar den i bruk live: ingen omstart, megler-sesjonen og videresendingskøen beholdes, og hver enhet filen ikke endret blir tilkoblet. Bodyen er **selve enhetsfilen**, rå JSON, ikke pakket inn i noe. Den valideres før noe publiseres (`400` `"invalid device file: ..."` hvis ikke). `{"status":"config pushed"}` betyr at megleren tok den; om reléet kjører den står i `config.digest` på det medlemmet i `GET /api/fleet`, og en fil reléet avviste vises der som `config.rejected`. Bare for administratorer: det endrer hva reléet poller. Se [Flåtestyring](/nb/gateway/fleet/#sending-av-konfigurasjon).

### `DELETE /api/fleet/{id}/config`

Tar skyvingen tilbake. Tømmer den beholdte konfigurasjonen på megleren slik at ingen senere oppstart tar den i bruk, og et relé som er tilkoblet akkurat nå slipper den skjøvne filen og går live tilbake til sin lokale enhetsfil. Ingen body. `{"status":"config push cleared"}`, `404` for et ukjent medlem, `503` når Gatewayen ikke er koblet til megleren. Bare for administratorer, som skyvingen. Den starter ingenting på nytt. Send den mens reléet er online: et frakoblet relé hører den aldri. Se [Edge Relay-referansen](/nb/edge-relay/reference/#hvor-en-sendt-fil-ligger-og-hvilken-fil-som-vinner).

## Varslinger

Å pinge en telefon når en alarm utløses, over webhook, SMTP, ntfy eller Gotify, og å si fra til neste person når ingen kvitterer. Trenger `HOTLOOP_NOTIFY_ENABLED`.

### `POST /api/notify/test`

Sender nå en syntetisk alarmvarsling gjennom hver konfigurerte kanal, slik at du finner ut at SMTP-reléet avviser deg før en ekte alarm gjør det. Ingen body. Trenger `HOTLOOP_NOTIFY_ENABLED`. Bare for administratorer: den sender en ekte melding og bruker den kvoten leverandøren tillater.

```json
{"results":[{"channel":"smtp","success":true}]}
```

`200` enten hver kanal fungerte eller ikke; hvert resultat sier det. En som feilet bærer `error`. En webhook som feilet nevner skjemaet og verten sin og ingenting annet, fordi URL-en for de fleste varslingstjenester er legitimasjonen. Se [Alarmvarsler](/nb/iot/notifications/).

### `GET /api/notify/escalation`

Alarmeskaleringspolicyen, kanalene et steg kan nevne og kjedene som er åpne akkurat nå. `available` er `false`, med en avslått policy og ingen kanaler, når `HOTLOOP_NOTIFY_ENABLED` ikke er satt; svaret er fortsatt `200`. Bare for administratorer for både lesing og skriving: policyen inneholder folks ntfy-topics, som på en server hvem som helst kan nå er passord.

```json
{"available":true,"policy":{"enabled":true,"minPriority":"high","contacts":[{"name":"Ana","ntfyTopic":"ana-phone-3f9c","emails":["ana@plant.test"]}],"steps":[{"afterMinutes":5,"contacts":["Ana"]},{"afterMinutes":10,"channels":["gotify"]}],"repeatEveryMinutes":15,"repeatTimes":2},"channels":["smtp","ntfy","gotify"],"active":[{"alarmId":"boiler-hi","name":"Boiler Trip","raisedAt":"2026-10-21T03:00:00Z","sent":1,"total":4,"nextAt":"2026-10-21T03:15:00Z"}],"limits":{"steps":10,"contacts":50,"repeats":20,"minutes":1440}}
```

`channels` er de denne HotLoop har konfigurert, som er alt et steg kan nevne. `active` er hver alarm som blir gått nedover kjeden: hvor mange utsendelser som har gått ut av hvor mange policyen har (steg, så repetisjoner), og når neste forfaller. Ingenting lagret ennå er `{"policy":{"enabled":false},...}`: av, med ingenting i.

### `PUT /api/notify/escalation`

Erstatter hele policyen, ikke en patch, og svarer det `GET` ville svart. Den gjelder alarmer som utløses fra nå av. `400` når varslinger ikke er aktivert.

```json
{"enabled":true,"minPriority":"high",
 "contacts":[{"name":"Ana","ntfyTopic":"ana-phone-3f9c","emails":["ana@plant.test"]}],
 "steps":[{"afterMinutes":5,"contacts":["Ana"]},{"afterMinutes":10,"channels":["gotify"]}],
 "repeatEveryMinutes":15,"repeatTimes":2}
```

`minPriority` er `critical`, `high` (standard), `medium` eller `low`. Et steg forfaller `afterMinutes` (1 til 1440) etter det før, det første etter utløsningen, og nevner `contacts` fra listen, `channels` som oppsettet har, eller begge. Høyst 10 steg, 50 kontakter og 20 repetisjoner. Ukjente felt avvises.

`400` med grunnen når policyen ikke kan fungere, i ord du kan handle på: et steg som ikke nevner noen, en kontakt som ikke er i listen, en kanal denne HotLoop ikke har konfigurert (svaret lister de den har), et ntfy-topic uten at ntfy er konfigurert eller en adresse uten at e-post er konfigurert, en adresse som ikke er en vanlig en, en repetisjon uten intervall. Ingenting lagres når den avvises. Lagringen står i systemloggen, uten topics. Se [Alarmvarsler](/nb/iot/notifications/#escalation).

### `POST /api/notify/ack/{token}`

**Kvitter**-knappen på en ntfy-varsling. Telefonen som trykker på den har ingen sesjon å sende, så det er **ingen sesjon og ingen tillatelse**: det signerte tokenet i stien er autorisasjonen, og alt det autoriserer er å kvittere ett tilfelle av én alarm, én gang, før det utløper (`HOTLOOP_NOTIFY_ACK_TTL`, 12 timer som standard). En knapp fra gårsdagens tur kan ikke kvittere dagens. Det er en `POST` med vilje: lenkeforhåndsvisere og sikkerhetsskannere åpner lenker på egen hånd, og en alarm må aldri kvitteres av en robot. Ingen body. Den svarer med alarmen som kvittert (formen, fra håndtereren; de andre eksemplene i dette dokumentet ble tatt opp fra en kjørende Gateway, dette ble ikke det, fordi den Gatewayen ikke hadde ntfy):

```json
{"acknowledged":true,"alarmId":"extruder-temp-hi","name":"Extruder temperature high","state":"ack-active","ackedBy":"notify:ntfy"}
```

Med kvitteringslenker slått av:

```json
{"error":"acknowledge links are not enabled on this HotLoop (they need HOTLOOP_PUBLIC_URL and a channel that carries a button)"}
```

Det er en vanlig kvittering gjennom alarmmotoren, revidert under `notify:<channel>`. Hver avvisning besvares og logges, fordi en knapp som stille ikke gjør noe ser nøyaktig ut som en ingen trykket på:

| Status | Når |
|---|---|
| 403 | Forfalsket, endret eller signert med en annen hemmelighet |
| 404 | Alarmen finnes ikke lenger, eller kvitteringslenker er av (de trenger `HOTLOOP_PUBLIC_URL` og en kanal med en knapp) |
| 409 | Allerede brukt, alarmen er utløst igjen siden, eller det er ingenting igjen å kvittere |
| 410 | Ekte, men utløpt |
| 503 | Kvitteringen kunne ikke lagres; lenken gis tilbake slik at et nytt trykk fortsatt kan fungere |

Svaret bærer `Access-Control-Allow-Origin: *` slik at ntfy-webappen kan trykke på den fra sin egen origin; ingenting på denne ruten leser en cookie. Tokenet logges eller returneres aldri noe sted. Se [Alarmvarsler](/nb/iot/notifications/#acknowledge-links).

## Sikkerhetskopier

Logiske databaseøyeblikksbilder, bare med tabelldata. Trenger `HOTLOOP_BACKUP_ENABLED`. Begge bare for administratorer: en liste viser radantallet i hver tabell, brukere og sesjoner inkludert. **Det finnes ikke noe gjenopprettingsendepunkt**, med vilje: gjenoppretting er et flagg på binærfilen, kjørt én gang av noen som vet at databasen er ment å ta imot den, aldri et nettverkskall mot en som er i drift. Se [Sikkerhetskopier og gjenoppretting](/nb/iot/backup/#gjenopprette-en-sikkerhetskopi).

### `GET /api/backup`

Sikkerhetskopiene på volumet, hver med sitt manifest.

```json
{"backups":[{"name":"20260927T202912Z","bytes":98567,"manifest":{"hotloopVersion":"4.16.0","schemaMigrations":["0001_core.sql","...","0007_service_audit.sql"],"createdAt":"2026-09-27T20:29:12.970721945Z","tables":[{"name":"devices","rows":2,"columns":[{"name":"id","type":"text"},{"name":"...","type":"..."}]}]}}],"configured":true}
```

### `POST /api/backup`

Tar en nå og venter på den (opptil 30 minutter: en stor `tag_history` tar en stund). Ingen body. Svarer med manifestet: versjon, migreringer og hver tabells rader og kolonner.

## Planlagte rapporter

Historian-sammendrag som CSV og HTML, etter en tidsplan, på e-post eller som nedlasting. Trenger `HOTLOOP_REPORTS_ENABLED`. Seere leser, operatører kjører, administratorer definerer: en definisjon nevner hvor anleggsdata sendes på e-post. Se [Planlagte rapporter](/nb/gateway/reports/) for definisjonens felt.

### `GET /api/reports`

```json
{"configured":true,"reports":[{"id":"line1-hourly","name":"Line 1 hourly","enabled":true,"tags":[{"deviceId":"extruder-1","tagName":"Temperature"},{"deviceId":"extruder-1","tagName":"Pressure"}],"window":{"count":1,"unit":"hours","end":"run_time"},"bucket":"window","aggregations":["min","max","avg"],"schedule":{"kind":"daily","at":"06:00"},"format":"both","recipients":["shift-lead@example.com"],"retain":10,"createdAt":"2026-09-27T20:29:23.300978Z","updatedAt":"2026-09-27T20:29:23.300978Z","nextRunAt":"2026-09-28T06:00:00Z"}],"smtpConfigured":true,"timezone":"UTC"}
```

Hver definisjon bærer `nextRunAt` og den nyeste kjøringen som `lastRun`.

### `POST /api/reports`

Oppretter en definisjon; bodyen er definisjonen som over. `201`. `400` ved mislykket validering (`"report line1-hourly: window end \"now\" must be run_time or local_midnight"`), `409` hvis id-en finnes.

### `GET /api/reports/{id}`

Én definisjon, som i listen. `404` for en ukjent.

### `PUT /api/reports/{id}`

Erstatter hele definisjonen. Id-en kan ikke endres (`400` hvis bodyens er en annen). `nextRunAt` og `lastRun` godtas og ignoreres, slik at du kan sende tilbake det du leste.

### `DELETE /api/reports/{id}`

Sletter den med kjøringene og filene, og avbryter en kjøring som pågår. `{"deleted":"line1-hourly"}` eller `404`.

### `POST /api/reports/{id}/run`

Kjører den nå og venter. `?deliver=false` lager og lagrer den uten å sende e-post til noen, for å prøve ut en definisjon. `200` betyr at kjøringen skjedde; dens egen `status` sier om rapporten fungerte. En kjøring som feiler er et resultat, ikke en dårlig forespørsel, og den registreres uansett.

```json
{"id":1,"reportId":"line1-hourly","trigger":"manual","actor":"admin","status":"succeeded","startedAt":"2026-09-27T20:29:54.06926Z","finishedAt":"2026-09-27T20:29:54.092456655Z","windowStart":"2026-09-27T19:29:54.06926Z","windowEnd":"2026-09-27T20:29:54.06926Z","tags":2,"rows":2,"readings":984,"excluded":2,"files":[{"format":"csv","name":"20260927T202954Z-1.csv","bytes":338},{"format":"html","name":"20260927T202954Z-1.html","bytes":2430}],"emailStatus":"skipped","emailTo":["shift-lead@example.com"]}
```

`400` for en `deliver` som ikke er true eller false, `404` for en ukjent rapport.

### `GET /api/reports/{id}/runs`

`{"runs": [...]}`, nyeste først, `?limit=` standard 50, høyst 500. `404` for en ukjent rapport, ikke en tom liste.

### `GET /api/reports/{id}/runs/{run}/download`

Strømmer en lagret fil som vedlegg. `?format=csv` eller `html`.

```
HTTP/1.1 200 OK
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="20260927T202954Z-1.csv"
Cache-Control: private, no-store

device_id,tag_name,unit,period_start,period_end,min,max,avg,excluded
extruder-1,Temperature,C,2026-09-27T19:29:54+00:00,2026-09-27T20:29:54+00:00,19.50001230192043,23.499980145373126,21.508905654397623,1
```

HTML leveres med en `sandbox`-Content-Security-Policy: en rapport er et dokument å lese, ikke en side som får kjøre noe. Filen som åpnes er den kjøringsposten nevner; ingenting i URL-en blir en del av en sti. `400` for et kjøringsnummer som ikke er et eller et format som ikke er noen av de to, `404` for en kjøring eller fil som ikke finnes.

## Lokasjoner

### `GET /api/sites`

Hver lokasjon Gatewayen føderer, spurt om anleggsstatusen sin over MCP parallelt, 6 sekunder hver, slik at én død lokasjon ikke kan holde opp resten. Lokasjonene er de utgående MCP-serverne i konfigurasjonen. Se [MCP](/nb/iot/mcp/#føderere-anlegg).

```json
{"configured":true,
 "rollup":{"sites":2,"reachable":1,"devices":2,"connected":2,"tags":5,"outstandingAlarms":1,"unacknowledgedAlarms":1,"criticalAlarms":0},
 "sites":[{"name":"plant-a","reachable":true,"latencyMs":14,"plant":"Demo Plant","uptime":"1m25s","devices":2,"connected":2,"degraded":0,"disconnected":0,"tags":5,"outstandingAlarms":1,"unacknowledgedAlarms":1,"criticalAlarms":0,"writesEnabled":true},
          {"name":"plant-c","reachable":false,"error":"connect to MCP server \"plant-c\": calling \"initialize\": ... no such host","latencyMs":49,"devices":0,"connected":0,"degraded":0,"disconnected":0,"tags":0,"outstandingAlarms":0,"unacknowledgedAlarms":0,"criticalAlarms":0,"writesEnabled":false}]}
```

Tallene fra en lokasjon som ikke kan nås betyr ingenting og utelates fra summen: å telle en lokasjon man ikke når som null alarmer ville vært det farligste dette skjermbildet kunne gjort. Uten lokasjoner konfigurert: `{"configured":false,"sites":[]}`.

## Innstillinger

### `GET /api/settings`

Hver innstilling, dens gjeldende verdi, hvor verdien kom fra og variabelen som setter den:

```json
{"groups":["Plant","Safety","Polling","Historian","Database","MCP","Server"],
 "settings":[{"key":"ui.plantName","group":"Plant","label":"Plant name","help":"...","value":"Demo Plant East","kind":"string","source":"stored","envVar":"HOTLOOP_PLANT_NAME","editable":true},
             {"key":"safety.allowWrites","group":"Safety","label":"Writes allowed","help":"...","value":true,"kind":"bool","source":"environment","envVar":"HOTLOOP_ALLOW_WRITES","editable":false},
             {"key":"database.password","group":"Database","label":"Password","help":"Never shown. It comes from the release Secret.","value":"set","kind":"secret","source":"environment","envVar":"HOTLOOP_DB_PASSWORD","editable":false}]}
```

`source` er `stored`, `environment` eller `default`. En `secret` er bare `set` eller `not set`. `envVar` er variabelen verdien kom fra. Noen innstillinger faller tilbake på en andre variabel når den med `HOTLOOP_` er tom (`TZ` for tidssonen, `POSTGRES_HOST`, `POSTGRES_DB`, `POSTGRES_USER` og `POSTGRES_PASSWORD` for databasen), og når tilbakefallet er det som gjelder, nevner `envVar` det. En variabel satt til en tom streng regnes som ikke satt, slik konfigurasjonen behandler den. Poll-innstillingene vises i millisekunder, men variablene deres tar en varighet (`5s`, `500ms`) eller et rent antall sekunder.

`product` i `Server`-gruppen sier hvilken HotLoop dette er. En funksjon dette produktet ikke har som oppsettet slo på likevel (si `HOTLOOP_REPORTS_ENABLED=true` på IoT) hindrer det ikke i å starte. Den logges som en advarsel ved oppstart og listes her i en ekstra gruppe, `Not in this product`, med variabelen sin og en linje som sier hvor den hører hjemme. Innstillingen blir stående nøyaktig som den er, slik at samme konfigurasjon på et produkt som har funksjonen slår den på. Når ingenting slikt er satt, finnes ikke gruppen.

### `PUT /api/settings`

Endrer innstillingene for anleggets identitet, og bare dem:

| Nøkkel | Type |
|---|---|
| `ui.plantName` | string, høyst 200 tegn |
| `ui.siteId` | string, høyst 200 tegn |
| `ui.timezone` | et IANA-navn denne maskinen kjenner (`America/Chicago`) |
| `ui.confirmWrites` | bool |
| `ui.kioskIdleSeconds` | et helt antall sekunder, 10 til 43200: hvor lenge en kioskpålogging overlever uten at noen rører panelet. Standard 900 |
| `ui.lockoutAttempts` | et helt tall, 0 til 100: feil passord eller PIN-koder på rad som låser en konto. Standard 10, og 0 er ingen utestengelse |
| `ui.panelDelaySeconds` | et helt antall sekunder, 0 til 30: det meste et kioskpanel venter før det sjekker neste PIN skrevet uten brukernavn, etter feil. Standard 3, og 0 er ingen venting |
| `ui.lockoutSeconds` | et helt antall sekunder, 10 til 86400: hvor lenge en låst konto forblir låst. Standard 300 |

```json
{"ui.plantName":"Demo Plant East","ui.timezone":"America/Chicago"}
```

Svarer med alle innstillingene, som `GET` gjør. Enhver annen nøkkel gir en 400 som nevner den:

```json
{"error":"safety.allowWrites is set by the deployment and cannot be changed here"}
```

Det er bevisst. Skrivebryterne avgjør om denne prosessen kan flytte maskineri, og en kontroll som kan slås på fra den samme nettleseren som utsteder skrivingene er ingen kontroll. Å endre dem er en utrulling.

## Historian-mål

Anleggets egne databaser, som HotLoop skriver historikken sin til i tillegg til sin egen. Se [Historian-mål](/nb/iot/historian-targets/). Hver rolle som leser innstillingene ser dem og hvordan hver av dem har det. Å endre ett er bare for administratorer, fordi et mål er et sted anleggsdata går. Passord forsegles med enhetslegitimasjonsnøkkelen (`HOTLOOP_SECRET_KEY_FILE`) og svares aldri med; `passwordSet` sier om ett er lagret, og `passwordProblem` hvorfor et lagret ikke kan åpnes. Hver endring går i loggen og trer i kraft med en gang.

### `GET /api/historian/targets`

```json
{"secretKey":true,
 "kinds":[{"id":"postgres","title":"PostgreSQL or TimescaleDB","defaultPort":5432,"defaultTable":"hotloop_history",
    "databaseLabel":"Database","tableLabel":"Table","passwordLabel":"Password","usesUsername":true,"usesOrg":false},
   {"id":"sqlserver","title":"Microsoft SQL Server","defaultPort":1433,"defaultTable":"hotloop_history",
    "databaseLabel":"Database","tableLabel":"Table","passwordLabel":"Password","usesUsername":true,"usesOrg":false},
   {"id":"mysql","title":"MySQL or MariaDB","defaultPort":3306,"defaultTable":"hotloop_history",
    "databaseLabel":"Database","tableLabel":"Table","passwordLabel":"Password","usesUsername":true,"usesOrg":false},
   {"id":"influxdb","title":"InfluxDB 2 or 3","defaultPort":8086,"defaultTable":"hotloop_history",
    "databaseLabel":"Bucket (InfluxDB 3: database)","tableLabel":"Measurement","passwordLabel":"API token",
    "usesUsername":false,"usesOrg":true}],
 "targets":[{"id":"plant-pg","name":"Plant historian","kind":"postgres","address":"db.plant.local:5432",
   "database":"plant","username":"hotloop","table":"hotloop_history","useTls":true,"insecureSkipVerify":false,
   "enabled":true,"createdBy":"admin","passwordSet":true,"createdAt":"2026-10-03T09:12:04Z","updatedAt":"2026-10-03T09:12:04Z",
   "status":{"state":"down","since":"2026-10-03T10:02:11Z","queued":50000,"queueCap":50000,"written":182340,
     "backfilled":0,"dropped":1210,"refused":0,"lastWrite":"2026-10-03T10:02:10Z",
     "lastError":"failed to connect to `user=hotloop database=plant`: dial tcp 10.20.0.9:5432: connect: connection refused",
     "owedFrom":"2026-10-03T10:02:09Z"}}]}
```

`kinds` er databasene denne HotLoop skriver til, og hva hver kaller feltene sine: InfluxDB har et token der de andre har et passord (`password` bærer det), en bucket der de har en database (`database`), en måling der de har en tabell (`table`), og en organisasjon (`org`) ingen av de andre har. `status.state` er `up`, `catching-up` (oppe, og sender fortsatt det den skylder fra HotLoops egen historikk), `down`, `starting` eller `off` (slått av). `queued` er det som venter i minnet, av `queueCap`. `written` teller avlesninger sendt live og `backfilled` de som er sendt fra HotLoops egen historikk. `dropped` teller avlesninger køen lot gå mens målet ikke fulgte med: de skyldes, de er ikke tapt. `refused` teller avlesninger databasen selv ikke ville ta, med grunnen i `lastRefusal`. `owedFrom` og `owedTo` er det som fortsatt skyldes; `owedTo` mangler mens slutten fortsatt er åpen, noe den er så lenge målet er nede.

### `POST /api/historian/targets`

```json
{"id":"plant-pg","name":"Plant historian","kind":"postgres","address":"db.plant.local","database":"plant",
 "username":"hotloop","password":"...","useTls":true}
```

`id` er 1 til 63 små bokstaver, sifre og `-`, og nevner målet i systemloggen. `address` er `host` eller `host:port`, uten pålogging i; typens standardport fyller inn en som mangler. `table` er som standard typens `defaultTable` og kan bære et skjema (`history.hotloop`). `org` er InfluxDB 2s organisasjon. `enabled` er som standard true. Et passord trenger en nøkkel: uten `HOTLOOP_SECRET_KEY_FILE` er det en `400`, aldri lagret i klartekst. `201` med målet og statusen; `409` for en id som er tatt.

### `PUT /api/historian/targets/{id}`

Hvilket som helst av feltene over unntatt `id`; det som ikke sendes blir stående. `"password":""` tømmer passordet. En endring starter målet på nytt med de nye innstillingene, og det det skyldtes skyldes fortsatt. `200` med målet.

### `DELETE /api/historian/targets/{id}`

Slutter å skrive til det og glemmer det det skyldtes. Det det allerede har blir stående i databasen. Slå det av med `"enabled":false` i stedet for å beholde innstillingene. `200` `{"deleted":"plant-pg"}`.

## Systemlogg

### `GET /api/events`

Hver endring, skriving, pålogging og tilkoblingsovergang, nyeste først.

| Spørring | <span class="sr-only">Detaljer</span> |
|---|---|
| `category` | Kan gjentas: `system`, `device`, `tag`, `write`, `alarm`, `automation`, `mcp`, `config`, `auth` |
| `severity` | Kan gjentas: `debug`, `info`, `warning`, `error` |
| `subject` | Nøyaktig: en enhets-id, en tag-nøkkel, en entity_id, `equipment:4`, `label:critical` |
| `q` | Søk uten forskjell på store og små bokstaver |
| `minutes` | Bare de siste N minuttene |
| `limit` | Standard 200, høyst 5000 |

```json
[{"id":61,"at":"2026-09-27T20:29:23.303795Z","severity":"info","category":"config","subject":"line1-hourly","actor":"admin","message":"report created"}]
```

`actor` er en bruker, `system`, `automation:<id>` eller `mcp:<client>`. `detail`, når det finnes, er ekstra JSON som en streng.

## Loggbok

### `GET /api/logbook`

Én tidslinje over det som skjedde, nyeste først: tilstandsendringer i entiteter, skrivinger, alarmoverganger, kjøringer av automasjoner og skript, og konfigurasjonsendringer og tjenestekall fra systemloggen. Sporene leses der de er og slås sammen, slik at hvert beholder sin egen oppbevaring. Numeriske avlesninger er ikke med: det er det `GET /api/history` er til for. Se [loggboken](/nb/iot/logbook/).

| Spørring | <span class="sr-only">Detaljer</span> |
|---|---|
| `entity` | Bare det som gjelder denne entiteten: tilstandsendringene dens, skrivinger til den og taggene dens, alarmene dens, automasjonskjøringene den utløser eller som skrev til den, konfigurasjonsendringer av den |
| `equipment_id` | Bare det som skjedde ved denne noden i utstyrstreet eller under den, etter samme regel. Ikke sammen med `entity` |
| `actor` | En del, uten forskjell på store og små bokstaver, av hvem som gjorde det: en bruker, `automation:<id>`, `mcp:<client>` |
| `kinds` | Kommaseparert eller gjentatt: `state`, `write`, `alarm`, `automation`, `event`, `script`, `recipe` |
| `from`, `to` | RFC 3339-tider; `from` inkludert, `to` ekskludert |
| `limit` | Standard 100, høyst 1000 |
| `before` | `next` fra forrige side |

```json
{"entries":[
  {"at":"2026-09-28T09:14:02.51Z","kind":"state","id":41,"severity":"info","message":"changed to on (was off)","entity_id":"switch.tank_farm_pump","old_state":"off","state":"on","quality":"good"},
  {"at":"2026-09-28T09:14:02.18Z","kind":"write","id":88,"severity":"info","message":"wrote true to tank-farm/pump (switch.turn_on on switch.tank_farm_pump) (was 0)","actor":"admin","source":"ui","entity_id":"switch.tank_farm_pump","device_id":"tank-farm","tag":"tank-farm/pump","call_id":"5c9f8545a93b5443"},
  {"at":"2026-09-28T09:13:40.02Z","kind":"state","id":37,"severity":"info","message":"changed to closed (was open); 14 changes before this not logged, it was changing faster than the logbook records","entity_id":"valve.infeed","old_state":"open","state":"closed","quality":"good","suppressed":14}
 ],
 "next":"MjAyNi0wOS0yOFQwOToxMzo0MC4wMlp8c3RhdGV8Mzc"}
```

`id` er radens id i sitt eget spor (for en tilstandsendring, entitetens uforanderlige id), og sammen med `at` og `kind` er det det `next` koder: siden etter denne er alt som strengt er eldre i den rekkefølgen, uansett hva som er lagt til i mellomtiden. `next` utelates på siste side. `suppressed` er hvor mange endringer av den entiteten før denne som ikke ble logget, fordi den endret seg raskere enn ti om gangen og så én hvert andre sekund.

`400` for en ukjent type, en ugyldig tid, `from` ikke før `to`, en grense over 1000, en oppdiktet markør, eller `entity` og `equipment_id` sammen; `404` for en node som ikke finnes. `503` når loggboken ikke kjører i prosessen som svarer.

## Direktestrøm

### `GET /api/stream`

Server-sent events, én vei, så lenge du holder den åpen. SSE i stedet for en WebSocket fordi trafikken bare går én vei, og en hendelsesstrøm kobler seg til igjen av seg selv når poden starter på nytt under et åpent dashbord. `EventSource` sender sesjonscookien; et skript sender bearer-tokenet.

Ved tilkobling får du `retry: 3000` og så det nåværende bildet, slik at en skjerm er fylt før noe endrer seg:

```
retry: 3000

event: snapshot
data: [{"deviceId":"extruder-1","protocol":"opcua","tagName":"Temperature","tagValue":19.553128777917983,"unit":"C","quality":"good","timestamp":"2026-09-27T20:34:23.619589Z"}]

event: alarms
data: {"alarms":[...outstanding alarms...],"summary":{"critical":0,"high":1,"medium":0,"low":0,"unacked":0,"total":1}}

event: entities
data: {"changed":[...every entity state...],"removed":[]}
```

Så, etter hvert som ting skjer:

| Hendelse | Data | Når |
|---|---|---|
| `values` | En matrise av avlesninger, `GET /api/values`-formen, nyeste per tag, **bare taggene hvis avlesning endret seg** | Hvert 250. ms, hvis noen gjorde det. En tag hvis verdi, tekst, enhet, kvalitet og grunn er de samme som sist sendt utelates, og sendes igjen når den har gått 30 sekunder usendt, slik at `timestamp` for en jevn verdi aldri er eldre enn det. En driver leser hver tag ved hver poll; 4.19.5 sendte alle hver gang (omtrent 150 KB fire ganger i sekundet for en testers 2232 tagger) og en side på en treg linje havnet minutter på etterskudd |
| `entities` | `{"changed": [states], "removed": [entity_ids]}` | Hvert 250. ms, hvis noen entitetstilstand endret seg. `removed` er en entitet som er deaktivert, slettet eller omdøpt |
| `alarm` | `{"alarm": {...}, "event": "shelved"}`, alarmen og hva som skjedde med den (`raised`, `acked`, `cleared`, `shelved`, `unshelved`, `suppressed`, `unsuppressed`) | Umiddelbart: alarmoverganger er sjeldne og hver enkelt betyr noe |
| `device` | `{"deviceId":"tank-farm","state":"connected"}` | Umiddelbart: skjermen skal bli rød når en enhet faller ut, ikke ved neste flush |
| `logbook` | `{"kinds":["state","write"]}`, hvilke typer loggbokoppføringer som har noe nytt | Høyst én gang i sekundet. Ingen oppføringer i den, fordi det en skjerm skal vise avhenger av filtrene dens: den ber `GET /api/logbook` om sin egen side |

```
event: alarm
data: {"alarm":{"definitionId":"extruder-temp-hi","state":"shelved","shelvedUntil":"2026-09-27T20:39:45.839983854Z","shelvedBy":"admin","...":"..."},"event":"shelved"}

event: device
data: {"deviceId":"tank-farm","state":"connected"}
```

En kommentarlinje (`: heartbeat 2026-09-27T20:35:00Z`) hvert 20. sekund hindrer proxyer i å stenge en inaktiv forbindelse. Hver åpne side har sitt eget tempo: skriveren hviler like lenge som siste utsending tok (høyst fem sekunder), og det som kommer inn i mellomtiden holdes per tag og per entitet, bare det nyeste, slik at en side på en treg linje er en utsending eller to bak anlegget, aldri minutter, ikke mister noe, og ikke tar noe fra de andre sidene. Strømmen gzip-komprimeres når forespørselen sier `Accept-Encoding: gzip` (en nettleser gjør det), noe som tar en testers første bilde fra omtrent 326 KB til omtrent 11 KB på kabelen. Svaret setter `X-Accel-Buffering: no`, fordi en bufrende proxy gjør en direktestrøm til en veldig treg nedlasting.

Strømmen ser på sesjonen sin igjen hvert femte sekund og stenger når sesjonen er borte: logget ut, utløpt, tilbakekalt, eller kontoen deaktivert eller ikke lenger tillatt `status.read`. Den sender ingen hendelse først. En nettlesers `EventSource` kobler til igjen, får `401` over, og stopper. Med `HOTLOOP_AUTH_INSECURE=true` finnes det ingen sesjon og ingenting å sjekke. Sjekken teller ikke som at sesjonen brukes, slik at en skjerm som står åpen ikke holder en sesjon fersk.

## MCP

### `/mcp` og `/mcp/`

Model Context Protocol, streamable HTTP-transport, for agenter. Enhver metode: transporten bruker `POST` for kall, `GET` for serverens egen strøm og `DELETE` for å avslutte en sesjon. Stien er `HOTLOOP_MCP_PATH` (`/mcp` som standard), og endepunktet er bare der når `HOTLOOP_MCP_ENABLED` er på.

Den ligger **ikke** bak sesjonspåloggingen. Den har sitt eget bearer-token, `HOTLOOP_MCP_TOKEN`, kontrollert foran håndtereren slik at en som kaller uten det ikke engang kan liste verktøyene:

```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="hotloop"

unauthorized
```

Uten noe token konfigurert lager HotLoop ett ved første oppstart og beholder det i databasen sin (`hotloop mcp-token` skriver det ut), slik at endepunktet aldri er åpent. En agent er en som kaller som alle andre: den leser og skriver, skrivingene går gjennom samme skrive-port som alle andres, og de revideres som `mcp:<client name>`. Verktøyene og ressursene står i [MCP](/nb/iot/mcp/).

```
POST /mcp
Authorization: Bearer <token>
Accept: application/json, text/event-stream

{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1"}}}
```

svarer med en `Mcp-Session-Id`-header og serverens egenskaper og instruksjoner.

## Brukergrensesnittet

### `GET /manifest.webmanifest`

Web-app-manifestet som lar en telefon installere grensesnittet som en app: produkt- og anleggsnavnet, `display` `standalone`, temafargene, ikonene (192 og 512 piksler PNG, en maskerbar 512 og SVG-en) og snarveier til Alarmer og Dashbord. Hver URL i det er relativ til manifestets egen, så den er riktig uansett hvor HotLoop er montert. Navnet følger anleggsnavnet satt i Innstillinger, og svaret er `Cache-Control: no-cache` slik at en omdøping vises ved neste blikk. Ingen sesjon: en telefon spør før noen har logget inn. Se [Dashbord](/nb/iot/dashboards/#på-en-telefon).

### `GET /sw.js`

Service workeren, i roten av der HotLoop er montert slik at omfanget dekker hele appen. Den beholder siden og det siste svaret på avlesningene en person ser på, og svarer med dem merket som gamle når HotLoop ikke kan nås. Den svarer aldri på, beholder eller setter en skriving i kø. Den kjørende versjonen ligger i den, slik at hver utgave får sin egen sidebuffer. `Cache-Control: no-cache`; ingen sesjon. Bare en nettleser i en sikker kontekst (https, eller `localhost`) kjører den.

### `GET /next` og `GET /next/`

Der grensesnittet bodde mens det gamle var standard. Begge er en `301` til roten, slik at et bokmerke laget da fortsatt lander.

### `/`

Nettgrensesnittet, bygd fra `web/` inn i binærfilen: en side, skriptene, stilene og skriftene, en service worker og ikonene til den installerbare appen, hver URL i dem relativ til siden slik at det kjører i roten av en vert, under en sti, bak en proxy eller inne i iframen til EmberNet-dashbordet. Serveren fyller inn tittelen og én datablokk, `<script type="application/json" id="iiot">`, med det bare den vet: anlegget, lokasjonen, produktet, funksjonene, skrivepolicyen og tidssonen. Bare `GET` og `HEAD`; enhver annen metode er `405`. En sti som ikke er en av filene er en `404`, fordi å servere siden for en skrivefeil ville fått den til å se ut som en skjerm som virker, og en binærfil bygd uten grensesnittet sier det i ren tekst og hvordan man bygger det. Ingen sesjon: siden er påloggingsskjemaet til du logger inn.
