---
title: "MCP for agenter"
description: "La en agent lese hele anlegget og bare røre det du har armert, gjennom skrive-porten, med oppgitt begrunnelse logget ved siden av hver skriving."
---

Gatewayen snakker MCP i begge retninger: agenter kan lese og styre anlegget, og en automasjonsregel kan kalle et verktøy et annet sted.

Designregelen er at **en agent er en kaller som alle andre**. Verktøyene leser gjennom den samme cachen som UI-et leser og skriver gjennom den samme porten som UI-et skriver gjennom. Det finnes ingen privilegert vei, ingen omgåelse og ingen egen policy. En skriving en operatør ville fått avvist, avvises; en skriving som lykkes havner i samme revisjonstabell med `mcp:` foran aktøren.

## Tilbud

### Over HTTP

Slått på som standard på `/mcp` på appens port, beskyttet av et bearer-token som chartet genererer i releasens Secret.

```bash
kubectl -n hotloop get secret <release> \
  -o jsonpath='{.data.mcp-token}' | base64 -d
```

I klyngen er endepunktet:

```
http://<release>.<namespace>.svc.cluster.local:8080/mcp
```

Token-sjekken sitter foran håndtereren, så en uautentisert kaller kan ikke engang liste opp hva som finnes. Å la `mcp.token` stå tomt gjør at chartet genererer ett, standard-utrullingen er ikke ved et uhell den åpne. Kombiner det med NetworkPolicy; et token er en andre forsvarslinje, ikke den eneste.

Endepunktet er aldri åpent. Kjør binærfilen uten `HOTLOOP_MCP_TOKEN` (en Quadlet-enhet, en bar `hotloop`) og den lager et token ved første oppstart og beholder det i databasen sin, slik at det samme kommer tilbake etter en omstart, på hver replika og etter en gjenoppretting. `hotloop mcp-token` skriver det ut (loggen sier at den lagde ett, og aldri hva det er). Sett `HOTLOOP_MCP_TOKEN` for å velge ditt eget; med `HOTLOOP_MCP_OIDC_*` satt tar endepunktet en pålogging og har ikke noe eget token. En klient som tidligere koblet til en bar binærfil uten noe får nå en `401` til den sender `Authorization: Bearer <that token>`.

### Med en Vord-pålogging eller en hub-assertion

Det statiske tokenet sier hvilken klient som kalte; det kan ikke si hvilken person. Med OIDC satt tar `/mcp` også `Authorization: Bearer <jwt>`, og den verifiserte personens e-post blir revisjonsaktøren: en skriving havner som `mcp:pat@example.com` i stedet for `mcp:<client name>`. Oppførselen uten det er uendret, og det statiske tokenet fortsetter å virke ved siden av (uten statisk token satt slipper bare en verifisert JWT inn).

| Variabel | Chart-verdi | Gjør |
|---|---|---|
| `HOTLOOP_MCP_OIDC_ISSUER` | `mcp.oidc.issuer` | Vord-realmens URL; godtar tilgangstokenene dens |
| `HOTLOOP_MCP_OIDC_AUDIENCE` | `mcp.oidc.audience` | `aud` hvert token må bære; påkrevd med en av disse to |
| `HOTLOOP_MCP_OIDC_HUB_JWKS_URL` | `mcp.oidc.hubJwksUrl` | identitetshubens assertion-nøkler; godtar assertionene dens |
| `HOTLOOP_MCP_OIDC_REQUIRED_ROLE` | `mcp.oidc.requiredRole` | en realm-rolle kalleren må ha |
| `HOTLOOP_MCP_OIDC_WRITE_ROLE` | `mcp.oidc.writeRole` | begrenser skrivinger per kaller, se under |

Et Vord-tilgangstoken sjekkes mot utstederens JWKS (funnet via oppdagelsesdokumentet, bufret ti minutter, hentet på nytt ved en ukjent `kid`): bare RS256 eller ES256, `iss` lik utstederen, `aud` som inneholder audience, `exp` og `nbf` med 30 s slingringsmonn, og en `email`-claim (eller `preferred_username`). Vord legger som standard bare `account` i `aud`; gi klient-scopet en audience-mapper for audience du setter.

En hub-assertion er `typ` `fb-assert+jwt`, EdDSA, `iss` `fireball-hub`, `aud` den konfigurerte audience (Hub-modulen sender `hotloop`), ikke utløpt, signert av en nøkkel i Hubens JWKS. Det finnes ingen `jti`-replay-cache: ett verktøykall er flere HTTP-forespørsler (initialize, så kallet) som bærer samme assertion, som lever 60 s. Når Hubben sier at kallet handler for noen andre (`acting_as`), leses aktøren `mcp:<email> for <acting_as email>`.

Skrivinger trenger fortsatt `HOTLOOP_ALLOW_WRITES`, hovedbryteren; et token utvider den aldri. `HOTLOOP_MCP_OIDC_WRITE_ROLE` snevrer dem inn per kaller: `hotloop:hotloop.write` betyr Vord-klientrollen `hotloop.write` på klienten `hotloop` (`resource_access.hotloop.roles`), et bart navn betyr en realm-rolle, og en Hub-assertion må bære rollens navn i `abilities`. En kaller uten den kan lese, men `write_tag`, `call_service`, `run_script`, `apply_recipe`, `trigger_automation` og hvert verktøy som endrer konfigurasjon avviser. Det statiske tokenet begrenses ikke av den.

### Over stdio

Samme binærfil serverer MCP på stdin og stdout med `--mcp-stdio`, for en klient som starter den direkte. Alt annet starter også, så agenten ser et levende anlegg og ikke en hul server.

```json
{
  "mcpServers": {
    "hotloop": {
      "command": "/usr/local/bin/hotloop",
      "args": ["--mcp-stdio"],
      "env": {
        "HOTLOOP_DB_HOST": "timescale.plant.local",
        "HOTLOOP_DB_PASSWORD": "…"
      }
    }
  }
}
```

I stdio-modus går all logging til stderr. Alt som skrives til stdout ville ødelagt protokollstrømmen.

## Verktøy

Ett hundre og sytti-ett: tjuesju som leser anlegget og kommanderer det, sekstini som endrer konfigurasjonen ([under](#endre-konfigurasjon)), trettitre lesinger og prøvekjøringer som hører til ([under](#lesinger-og-prøvekjøringer)) og førtito for administrasjon ([under](#administrasjon)).

| Verktøy | Gjør |
|---|---|
| `get_plant_status` | enheter online, utestående alarmer, om skriving er slått på |
| `list_devices` | hver enhet med protokoll, adresse, tilstand, antall tagger |
| `describe_device` | én enhet i detalj, med taggene og pollingstatistikk |
| `list_tags` | søker i katalogen etter enhet, navn eller beskrivelse |
| `read_tag` | nåværende verdier, med kvalitet |
| `query_history` | historiske målinger, rå eller gruppert |
| `write_tag` | **kommanderer en tag** |
| `list_alarms` | alarmer og ISA-18.2-tilstandene deres |
| `ack_alarm` | kvitterer på vegne av en operatør |
| `list_automations` | regler, antall kjøringer, siste utfall |
| `trigger_automation` | kjører en regel nå |
| `describe_protocol` | hva dette bygget faktisk snakker |
| `recent_events` | systemloggen, for å finne ut hva som skjedde i hvilken rekkefølge |
| `list_entities` | finn entiteter etter domene, utstyrsnode eller etikett, med tjenestene hver tar |
| `get_states` | nåværende tilstand for en eller flere entiteter, med kvalitet og attributter |
| `call_service` | **kommanderer en entitet**: `switch.turn_on`, `number.set_value` |
| `get_logbook` | én tidslinje over tilstandsendringer, skrivinger, alarmer, kjøringer og konfigurasjonsendringer, etter entitet, utstyrsnode, aktør eller type |
| `list_scripts` | anleggets skript, feltene hvert tar, om det kjører, siste kjøring |
| `run_script` | **kjører et skript**, eller spør med `dryRun` hva det ville gjort akkurat nå |
| `list_recipes` | anleggets oppskrifter: mål i rekkefølge, parametere, forutsetning, versjon, siste anvendelse |
| `validate_recipe` | ville en oppskrift blitt anvendt nå? alle grunner til at den ville blitt avvist; ingenting skrives |
| `apply_recipe` | **anvender en oppskrift**: sjekket i sin helhet, skrevet i rekkefølge, lest tilbake |
| `list_blueprints` | blueprintene folk fyller ut for å lage regler, inndataene og versjonene deres |
| `preview_blueprint` | regelen et blueprint ville laget med gitte inndata, og hva den ville gjort nå; lager ingenting |
| `find_network_client` | hvor en enhet er på anleggsnettverket: switch-porten, om porten har en lenke, når UniFi-konsollen sist så den |
| `get_network_topology` | anleggsnettverket slik UniFi-konsollen tegner det: hva som er koblet til hva, tilstanden til hver enhet, og HotLoop-enhetene som mister nettverket hvis det faller |
| `get_network_events` | de nyeste hendelsene en UniFi-konsoll har rapportert, og om hendelses-websocketen er live |

### Entiteter

En entitet er det folk kaller en ting på anlegget, `sensor.zone_1_temperature` eller `switch.conveyor_run`, som omslutter en eller flere tagger. Se [Entiteter](/nb/iot/entities/). For en agent er de vanligvis det beste håndtaket: navnet betyr noe, og entiteten vet hva du kan gjøre med den.

`list_entities` filtrerer etter `domain`, etter `equipment` (en node i utstyrstreet etter id, navn eller sti av navn som `Plant A/Packing`, som matcher alt ved eller under den, der entitetens eget sted vinner over enhetens), etter `label` (label_id eller navn; en entitet matcher hvis den bærer etiketten eller enheten dens gjør det) og etter `query`, en delstreng av entity_id eller navn. Hvert resultat bærer nåværende tilstand og kvalitet og tjenestene det tar, som `domain.service`. En entitet uten tjenester er skrivebeskyttet. Tjenestene kommer fra entitetslaget, så et domene som får en der dukker opp her uten endring.

`get_states` tar `entity_ids` og svarer for hver med tilstand, kvalitet, attributter og `last_changed`. Det holder samme linje som `read_tag`: en `unknown`- eller `unavailable`-tilstand besvares med en merknad om at den ikke er en verdi, en deaktivert entitet sier at den er deaktivert i stedet for manglende, og dårlig kvalitet staves ut.

`call_service` tar `domain`, `service`, `entity_id`, `data` og en **påkrevd** `reason`:

```
> call_service domain=number service=set_value entity_id=number.press_01_sp
    data={"value": 212.5} reason="operator asked for 212.5 on zone 1"
Called number.set_value on number.press_01_sp (was 210). Writes: 212.5 to press-01/Setpoint: written
```

Det går gjennom `entity.Services`, den samme kjøreren `POST /api/services/...` bruker, som gjør kallet om til skrivinger gjennom skrive-porten. Se [Skriving](#skriving).

### Nettverket

`find_network_client` svarer på det første spørsmålet om en PLS som har gått stille: er det PLS-en, eller switch-porten? Gi den `deviceId` og den følger enhetens bekreftede lenke til UniFi-klienten; gi den `query` (en MAC, en IP eller en del av et navn) og den søker i hver konsoll HotLoop leser. Den leser UniFi-driverens siste lesing, aldri konsollen, så en agent som spør i en løkke koster konsollen ingenting. Det betyr også at en `--mcp-stdio`-hjelper svarer at ingen konsoll leses i prosessen: den logger aldri inn på en, fordi Gatewayen ved siden av allerede har økten. Spør Gatewayens endepunkt. Se [UniFi Network](/nb/iot/unifi/).

`get_network_topology` er kartet: hver switch, aksesspunkt og gateway under den den er koblet til, med porten i begge ender, lenken, hvor mange klienter som er på den og HotLoop-enhetene knyttet til en klient under den. Den siste delen er sprengradiusen: den navngir PLS-ene som mister nettverket hvis den switchen går. En switch konsollen lister som koblet til ingenting sier det og henges ikke på gatewayen. `get_network_events` er konsollens nyeste hendelser, nyeste først, med sin egen setning, et advarselsflagg der konsollen kaller den negativ, og om hendelses-websocketen er live. Begge tar konsollens `deviceId`, som kan utelates når HotLoop bare leser én, og begge leser driverens siste lesing som `find_network_client`, så de koster konsollen ingenting og sier det samme i en `--mcp-stdio`-hjelper: ingen konsoll leses i den prosessen. Eldre hendelser er i `get_logbook`, arkivert under switchen eller aksesspunktet de gjaldt.

### Loggboken

`get_logbook` er tidslinjen `GET /api/logbook` serverer (se [Loggboken](/nb/iot/logbook/)): tilstandsendringer, skrivinger, alarmoverganger, automasjonskjøringer og konfigurasjonsendringer, nyeste først. Den snevres inn etter `entity`, etter `equipment` (id, navn eller sti, og alt under; et navn som matcher to noder er en feil som lister begge), etter `actor` (en del av den: `mcp:` finner alt noen agent gjorde), etter `kinds`, og etter `minutes` tilbake (standard et døgn). En side med mer etter seg ender med å si hva som skal sendes som `before` for neste. For «hva skjedde før dette gikk galt» er den den bedre `recent_events`: utstyrets egne tilstandsendringer er i den, og skriveportens linjer er ikke der to ganger.

### Skript

Et skript er en navngitt sekvens av trinn noen skrev én gang, CIP-syklusen eller linjespylingen, så en agent kjører anleggets egen prosedyre i stedet for å finne på en. Se [Skript](/nb/iot/scripts/). `list_scripts` sier hva hvert tar. `run_script` tar `scriptId`, `fields`, en **påkrevd** `reason` og to brytere:

- `dryRun: true` går gjennom skriptet mot anlegget slik det er og sier, trinn for trinn, hva som ville blitt skrevet og det første porten ville avvist, med portens egne ord. Ingenting skrives eller revideres. Spør om dette først.
- `wait: true` svarer når kjøringen er over, med utfall og spor. Uten den er svaret kjørings-id-en, og `list_scripts` eller `get_logbook` med `kinds: ["script"]` sier hvordan den endte.

Kjøringen er skriptets, som `script:<id>`, med kilden `mcp`, så hver skriving den gjør møter porten nøyaktig som `write_tag`. Med skriving slått av (`HOTLOOP_ALLOW_WRITES`) avviser `run_script` før noe kjøres, slik `trigger_automation` gjør; en prøvekjøring besvares likevel, og sier at bryteren er grunnen.

### Oppskrifter

En oppskrift er et sett settpunkter anlegget anvender sammen, en produktkvalitet eller en omstilling, så en agent laster anleggets egne tall i stedet for å skrive dem ett om gangen. Se [Oppskrifter](/nb/iot/recipes/). `list_recipes` viser hver enkelts mål i rekkefølge og parameterne den tar. `validate_recipe` spør om en ville blitt anvendt nå og gir alle grunner til at den ikke ville, uten å skrive noe. `apply_recipe` tar `recipeId`, `params`, en valgfri `version` og en **påkrevd** `reason`.

Den sjekkes først i sin helhet og avvises i sin helhet, uten at noe skrives, hvis noen verdi ville blitt avvist; verdier utenfor området avvises, aldri justeres. Så går målene ut i rekkefølge under én kall-id, det første som feiler stopper resten, og ingenting angres. Svaret sier, mål for mål, hva som gikk ut og om enheten leste verdien tilbake. Skrivingene er agentens, med kilden `mcp`, så porten gjelder for hver; med skriving slått av (`HOTLOOP_ALLOW_WRITES`) avviser `apply_recipe` før noe sjekkes. En oppskrift som nevner sin egen anvendelsestillatelse er for personene som har fått den, og en agent er ikke en av dem.

### Blueprints

Et blueprint er en regel skrevet én gang med typede tomrom: hvilken motor, hvor lenge, hvilken grense. Se [Blueprints](/nb/iot/blueprints/). `list_blueprints` sier hva hvert tar. `preview_blueprint` tar `blueprintId`, `automationId` og `inputs`, og svarer med regelen det ville laget og hva regelen ville gjort om den utløstes nå, hver skriving lagt under portens sjekker. Inndataene sjekkes nøyaktig slik skjermen sjekker dem: utenfor området avvises, ikke justeres.

`instantiate_blueprint` lager regelen, gjennom ruten Blueprints-skjermen bruker: de samme sjekkene, og regelen havner i loggboken med agenten som opphav. En regel er en stående ordre om å kommandere utstyr hver gang utløseren utløses, så en agent ser først: `preview_blueprint` lagrer ingenting og skriver ingenting, og besvares enten skriving er på eller ikke. Hver skriving den lagde regelen går videre til å gjøre møter skrive-porten, som for en regel en person lagde. Se [Endre konfigurasjon](#endre-konfigurasjon).

## Endre konfigurasjon

Alt en agent kan lese, kan den endre. Verktøyene ovenfor som leser anlegget har motstykker som endrer det, sekstini, og ingen er en andre implementasjon: hvert er en rute i REST-API-et, og et kall kjøres gjennom den rutens egen håndterer. Valideringen, tillatelsessjekken, runtime-omlastingen og revisjonslinjen er rutens, med agenten som aktør (`mcp:<client>`, eller `mcp:<email>` med en Vord-pålogging), så en enhet uten driver, en regel som ikke kompilerer, en blueprint-inndata utenfor området eller en tag den oppdagede enheten ikke er godtatt for avvises med ordene skjermen viser, og ingenting ble endret.

Hvert tar rutens stiverdier etter navn (`id`, `device`, `name`...), `body`, den samme JSON-en API-et tar ([HTTP-API-et](/nb/iot/api/) har hver body), og en **påkrevd** `reason`. Begrunnelsen registreres som en `config`-linje i systemloggen ved siden av rutens egen, mot tingen som ble endret.

```
> save_tag reason="the setpoint, writable between 0 and 100" body={"deviceId":"press-01",
    "name":"Setpoint","address":"holding:5:uint16","dataType":"int16","enabled":true,
    "writable":true,"hasRange":true,"minValue":0,"maxValue":100}
save_tag done.
{ ...the tag as stored... }
```

Det som står foran dem er det som står foran `write_tag`, minus hovedbryteren, fordi skjermene heller ikke trenger den for å endre konfigurasjon:

1. `HOTLOOP_ALLOW_MCP_WRITES`, på som standard, må være på.
2. En kaller med `HOTLOOP_MCP_OIDC_WRITE_ROLE` satt må ha den.
3. Kallet bærer én tillatelse, den ruten ber om (tredje kolonne under), og ingenting annet. En rute svarer en agent slik den svarer en person uten den tillatelsen, og en test binder hver rad i tabellen til en ekte rute og tillatelsen den ruten ber om.
4. En begrunnelse.

Å kommandere utstyr er fortsatt `write_tag`, `call_service`, `run_script`, `apply_recipe` og `trigger_automation` med `HOTLOOP_ALLOW_WRITES` på og taggens skrivbar-merke og område å oppfylle. Å gjøre en tag, en regel, et skript eller en oppskrift skrivbar er konfigurasjon: det kommanderer ingenting før det brukes, og det det da kommanderer går gjennom porten.

Administratorens egne funksjoner er også verktøy, under [Administrasjon](#administrasjon) nedenfor. Å godta en oppdaget enhet er her, som på skjermen; punktene på den må fortsatt armeres for skriving ett om gangen.

Verktøyene finnes også i `--mcp-stdio`: prosessen bygger den samme API-serveren, og åpner aldri porten sin.

**Enheter og tagger**

| Verktøy | Rute | Tillatelse |
|---|---|---|
| `save_device` | `POST /api/devices` | `devices.write` |
| `delete_device` | `DELETE /api/devices/{id}` | `devices.write` |
| `set_device_enabled` | `POST /api/devices/{id}/enabled` | `devices.write` |
| `import_device_tags` | `POST /api/devices/{id}/import` | `tags.write` |
| `save_tag` | `POST /api/tags` | `tags.write` |
| `delete_tag` | `DELETE /api/tags/{device}/{name}` | `tags.write` |
| `set_device_labels` | `PUT /api/devices/{id}/labels` | `equipment.write` |
| `set_device_network` | `PUT /api/devices/{id}/network` | `devices.write` |
| `clear_device_network` | `DELETE /api/devices/{id}/network` | `devices.write` |

**Oppdagelse og meglere**

| Verktøy | Rute | Tillatelse |
|---|---|---|
| `accept_discovered_device` | `POST /api/discovery/{source}/{key}/accept` | `devices.write` |
| `ignore_discovered_device` | `POST /api/discovery/{source}/{key}/ignore` | `devices.write` |
| `unignore_discovered_device` | `POST /api/discovery/{source}/{key}/unignore` | `devices.write` |
| `apply_discovery_review` | `POST /api/discovery/{source}/{key}/review/apply` | `devices.write` |
| `reject_discovery_review` | `POST /api/discovery/{source}/{key}/review/reject` | `devices.write` |
| `accept_network_find` | `POST /api/network-discovery/{key}/accept` | `devices.write` |
| `ignore_network_find` | `POST /api/network-discovery/{key}/ignore` | `devices.write` |
| `unignore_network_find` | `POST /api/network-discovery/{key}/unignore` | `devices.write` |
| `probe_network` | `POST /api/network-discovery/probe` | `devices.write` |
| `create_mqtt_broker` | `POST /api/mqtt/brokers` | `devices.write` |
| `update_mqtt_broker` | `PUT /api/mqtt/brokers/{id}` | `devices.write` |
| `delete_mqtt_broker` | `DELETE /api/mqtt/brokers/{id}` | `devices.write` |
| `probe_integration` | `POST /api/integrations/{id}/probe` | `devices.write` |
| `setup_integration` | `POST /api/integrations/{id}/setup` | `devices.write` |

**UniFi**

| Verktøy | Rute | Tillatelse |
|---|---|---|
| `mark_unifi_network_ot` | `PUT /api/unifi/{id}/networks/{network}` | `devices.write` |
| `accept_unifi_known_device` | `PUT /api/unifi/{id}/networks/{network}/known/{mac}` | `devices.write` |
| `forget_unifi_known_device` | `DELETE /api/unifi/{id}/networks/{network}/known/{mac}` | `devices.write` |
| `accept_all_unifi_known_devices` | `POST /api/unifi/{id}/networks/{network}/accept-all` | `devices.write` |
| `create_unifi_starter_alarms` | `POST /api/unifi/{id}/starter-alarms` | `alarms.write` |

**Entiteter, hjelpere, utstyr, etiketter**

| Verktøy | Rute | Tillatelse |
|---|---|---|
| `create_entity` | `POST /api/entities` | `entities.write` |
| `update_entity` | `PUT /api/entities/{entity_id}` | `entities.write` |
| `delete_entity` | `DELETE /api/entities/{entity_id}` | `entities.write` |
| `create_energy_meter` | `POST /api/energy/meters` | `energy.write` |
| `update_energy_meter` | `PUT /api/energy/meters/{id}` | `energy.write` |
| `delete_energy_meter` | `DELETE /api/energy/meters/{id}` | `energy.write` |
| `create_helper` | `POST /api/helpers` | `entities.write` |
| `update_helper` | `PUT /api/helpers/{entity_id}` | `entities.write` |
| `delete_helper` | `DELETE /api/helpers/{entity_id}` | `entities.write` |
| `create_equipment` | `POST /api/equipment` | `equipment.write` |
| `update_equipment` | `PUT /api/equipment/{id}` | `equipment.write` |
| `delete_equipment` | `DELETE /api/equipment/{id}` | `equipment.write` |
| `create_label` | `POST /api/labels` | `equipment.write` |
| `update_label` | `PUT /api/labels/{label_id}` | `equipment.write` |
| `delete_label` | `DELETE /api/labels/{label_id}` | `equipment.write` |

**Alarmer**

| Verktøy | Rute | Tillatelse |
|---|---|---|
| `save_alarm` | `POST /api/alarms` | `alarms.write` |
| `delete_alarm` | `DELETE /api/alarms/{id}` | `alarms.write` |
| `shelve_alarm` | `POST /api/alarms/{id}/shelve` | `alarms.ack` |
| `unshelve_alarm` | `POST /api/alarms/{id}/unshelve` | `alarms.ack` |

**Automasjoner og blueprints**

| Verktøy | Rute | Tillatelse |
|---|---|---|
| `save_automation` | `POST /api/automations` | `automations.write` |
| `delete_automation` | `DELETE /api/automations/{id}` | `automations.write` |
| `set_automation_enabled` | `POST /api/automations/{id}/enabled` | `automations.write` |
| `upgrade_blueprint_automation` | `POST /api/automations/{id}/blueprint-upgrade` | `blueprints.apply` |
| `instantiate_blueprint` | `POST /api/blueprints/{id}/instantiate` | `blueprints.apply` |
| `create_blueprint` | `POST /api/blueprints` | `blueprints.write` |
| `update_blueprint` | `PUT /api/blueprints/{id}` | `blueprints.write` |
| `delete_blueprint` | `DELETE /api/blueprints/{id}` | `blueprints.write` |

**Skript og oppskrifter**

| Verktøy | Rute | Tillatelse |
|---|---|---|
| `create_script` | `POST /api/scripts` | `scripts.write` |
| `update_script` | `PUT /api/scripts/{id}` | `scripts.write` |
| `delete_script` | `DELETE /api/scripts/{id}` | `scripts.write` |
| `stop_script` | `POST /api/scripts/{id}/stop` | `scripts.run` |
| `create_recipe` | `POST /api/recipes` | `recipes.write` |
| `capture_recipe` | `POST /api/recipes/capture` | `recipes.write` |
| `update_recipe` | `PUT /api/recipes/{id}` | `recipes.write` |
| `delete_recipe` | `DELETE /api/recipes/{id}` | `recipes.write` |

**Dashbord og tavlen**

| Verktøy | Rute | Tillatelse |
|---|---|---|
| `create_dashboard` | `POST /api/dashboards` | `dashboards.write` |
| `update_dashboard` | `PUT /api/dashboards/{id}` | `dashboards.write` |
| `delete_dashboard` | `DELETE /api/dashboards/{id}` | `dashboards.write` |
| `save_board` | `PUT /api/board` | `board.write` |

**Importer**

| Verktøy | Rute | Tillatelse |
|---|---|---|
| `import_codesys_alarms` | `POST /api/alarms/import/codesys` | `alarms.write` |
| `screen_import` | `POST /api/dashboards/import` | `dashboards.write` |

`import_codesys_alarms` tar filen CODESYS-IDE-ets Export Alarms skrev, som `contentBase64` (bytene slik de er på disk, som IDE-et skriver som UTF-16) eller som `content` (teksten, hvis du har den som tekst), med `deviceId` alarmene hører til og, hvis du vil ha dem, `application` og `defaultPriority`. La i fred gir den bare en forhåndsvisning: den sier hvilke alarmer som ville kommet over og hvilke som ikke ville, lagrer ingenting og trenger ingen begrunnelse. Med `apply` true lagrer den dem som alarmdefinisjoner, og da trenger den en begrunnelse og MCP-skrivebryteren som hvert verktøy som endrer konfigurasjon.

`screen_export` svarer et dashbord som en HotLoop-skjermfil ([Skjermfiler](/nb/iot/screen-file/)), og `screen_import` tar imot en, på denne installasjonen eller en annen. Den spør først: `dryRun` er true med mindre du sier false, og en prøvekjøring lagrer ingenting og svarer med rapporten med hvert problem listet og referansene til `remap`. En ekte import trenger `dryRun` false, en begrunnelse og MCP-skrivebryteren, og en id som finnes avvises med mindre `replace` er true. Skjermen er kundens data, så filen er måten den flyttes mellom installasjoner, aldri kode.

### Lesinger og prøvekjøringer

En agent som kan endre et dashbord, en megler eller en node i utstyrstreet må kunne lese hva som er der først, så hvert objekt et verktøy ovenfor endrer har en lesing her, og redigerernes prøvekjøringer er også verktøy. Hver er en rute kjørt gjennom sin egen håndterer med lesetillatelsen den ruten ber om. En lesing svarer uten begrunnelse og uten skrivebryteren, og en kaller skriverollen utelater kan likevel gjøre dem, fordi de bærer en lesetillatelse og ingenting mer. De tre prøvekjøringene (`validate_automation`, `validate_script` og `browse_device`) endrer ingenting; de to som sjekker en body bærer skrivetillatelsen ruten ber om, så de blir bak skriverollen.

| Verktøy | Rute | Tillatelse |
|---|---|---|
| `list_alarm_definitions` | `GET /api/alarms` | `alarms.read` |
| `list_composite_entities` | `GET /api/entities/composites` | `entities.read` |
| `list_energy_meters` | `GET /api/energy/meters` | `energy.read` |
| `get_energy_meter` | `GET /api/energy/meters/{id}` | `energy.read` |
| `get_energy_summary` | `GET /api/energy/summary/{period}` | `energy.read` |
| `get_energy_series` | `GET /api/energy/series/{meter}/{period}/{step}` | `energy.read` |
| `list_alarm_events` | `GET /api/alarms/events` | `alarms.read` |
| `screen_export` | `GET /api/dashboards/{id}/export` | `dashboards.read` |
| `list_dashboards` | `GET /api/dashboards` | `dashboards.read` |
| `get_dashboard` | `GET /api/dashboards/{id}` | `dashboards.read` |
| `get_board` | `GET /api/board` | `values.read` |
| `list_equipment` | `GET /api/equipment` | `equipment.read` |
| `get_equipment` | `GET /api/equipment/{id}` | `equipment.read` |
| `list_labels` | `GET /api/labels` | `equipment.read` |
| `get_label` | `GET /api/labels/{label_id}` | `equipment.read` |
| `list_discovered_devices` | `GET /api/discovery` | `devices.read` |
| `get_discovered_device` | `GET /api/discovery/{source}/{key}` | `devices.read` |
| `list_network_finds` | `GET /api/network-discovery` | `devices.read` |
| `get_network_find` | `GET /api/network-discovery/{key}` | `devices.read` |
| `list_integrations` | `GET /api/integrations` | `devices.read` |
| `list_mqtt_brokers` | `GET /api/mqtt/brokers` | `devices.read` |
| `get_blueprint` | `GET /api/blueprints/{id}` | `blueprints.read` |
| `get_script` | `GET /api/scripts/{id}` | `scripts.read` |
| `list_automation_runs` | `GET /api/runs` | `automations.read` |
| `list_script_runs` | `GET /api/scripts/{id}/runs` | `scripts.read` |
| `list_unifi_consoles` | `GET /api/unifi/consoles` | `devices.read` |
| `list_unifi_networks` | `GET /api/unifi/{id}/networks` | `devices.read` |
| `list_unifi_known_devices` | `GET /api/unifi/{id}/known` | `devices.read` |
| `get_device_network` | `GET /api/devices/{id}/network` | `devices.read` |
| `get_diagnostics` | `GET /api/diagnostics` | `status.read` |
| `browse_device` | `POST /api/devices/{id}/browse` | `devices.read` |
| `validate_automation` | `POST /api/automations/validate` | `automations.write` |
| `validate_script` | `POST /api/scripts/validate` | `scripts.write` |

### Administrasjon

Brukerkontoer, innstillinger, sikkerhetskopier, eskaleringspolicyen, historikkmålene, meglerpåloggingene, flåten av edge relays og planlagte rapporter er administratorens, og de er også verktøy: førtito, samme mønster som resten. Hver er en rute kjørt gjennom sin egen håndterer med tillatelsen den ruten ber om (`users.manage`, `settings.write`, `backup.run`, `fleet.restart`...), en begrunnelse for hver endring og agenten i revisjonslinjen. En rute som avviser avviser en agent med de samme ordene. Lesingene (verktøyene `list_` og `get_`) trenger ingen begrunnelse og ingen skrivebryter, og trenger fortsatt kallerens skriverolle når en er satt, fordi tillatelsen de bærer er en administrators. Flåte- og rapportverktøyene finnes bare i et produkt som har funksjonen.

To ting er rutenes egne og verdt å vite før du stoler på et verktøy:

- **Skrivebryterne har ingen rute.** `safety.allowWrites` og `safety.allowMcpWrites` er utrullingens (`HOTLOOP_ALLOW_WRITES`, `HOTLOOP_ALLOW_MCP_WRITES`), og `PUT /api/settings` avviser dem som satt av utrullingen. Så `save_settings` endrer det Innstillinger-skjermen kan endre og svarer det avslaget for bryterne, med de ordene. En agent kan ikke slå på bryteren dens egne skrivinger venter på.
- **En brukers passord går gjennom kallet.** `create_user`, `reset_user_password` og PIN-verktøyene tar en hemmelighet i argumentene sine, som API-et. Revisjonslinjen navngir endringen og begrunnelsen og aldri hemmeligheten.

**Brukerkontoer**

| Verktøy | Rute | Tillatelse |
|---|---|---|
| `list_users` | `GET /api/users` | `users.manage` |
| `create_user` | `POST /api/users` | `users.manage` |
| `update_user` | `PUT /api/users/{username}` | `users.manage` |
| `delete_user` | `DELETE /api/users/{username}` | `users.manage` |
| `reset_user_password` | `POST /api/users/{username}/password` | `users.manage` |
| `unlock_user` | `DELETE /api/users/{username}/lockout` | `users.manage` |
| `set_user_pin` | `PUT /api/users/{username}/pin` | `users.manage` |
| `clear_user_pin` | `DELETE /api/users/{username}/pin` | `users.manage` |
| `list_opcua_certificates` | `GET /api/opcua/certificates` | `users.manage` |
| `list_user_certificates` | `GET /api/users/{username}/certificates` | `users.manage` |
| `add_user_certificate` | `POST /api/users/{username}/certificates` | `users.manage` |
| `revoke_user_certificate` | `POST /api/users/{username}/certificates/{thumbprint}/revoke` | `users.manage` |
| `delete_user_certificate` | `DELETE /api/users/{username}/certificates/{thumbprint}` | `users.manage` |

**Innstillinger, sikkerhetskopier, varsler**

| Verktøy | Rute | Tillatelse |
|---|---|---|
| `get_settings` | `GET /api/settings` | `settings.read` |
| `save_settings` | `PUT /api/settings` | `settings.write` |
| `list_backups` | `GET /api/backup` | `backup.read` |
| `run_backup` | `POST /api/backup` | `backup.run` |
| `get_escalation` | `GET /api/notify/escalation` | `notify.escalation` |
| `save_escalation` | `PUT /api/notify/escalation` | `notify.escalation` |
| `send_test_notification` | `POST /api/notify/test` | `notify.test` |

**Historikkmål og meglerpåloggingene**

| Verktøy | Rute | Tillatelse |
|---|---|---|
| `list_historian_targets` | `GET /api/historian/targets` | `settings.read` |
| `create_historian_target` | `POST /api/historian/targets` | `settings.write` |
| `update_historian_target` | `PUT /api/historian/targets/{id}` | `settings.write` |
| `delete_historian_target` | `DELETE /api/historian/targets/{id}` | `settings.write` |
| `list_broker_logins` | `GET /api/broker/logins` | `users.manage` |
| `create_broker_login` | `POST /api/broker/logins` | `users.manage` |
| `update_broker_login` | `PUT /api/broker/logins/{name}` | `users.manage` |
| `delete_broker_login` | `DELETE /api/broker/logins/{name}` | `users.manage` |

**Flåten av edge relays (Gateway)**

| Verktøy | Rute | Tillatelse |
|---|---|---|
| `list_fleet` | `GET /api/fleet` | `fleet.read` |
| `register_relay` | `POST /api/fleet` | `fleet.write` |
| `delete_relay` | `DELETE /api/fleet/{id}` | `fleet.write` |
| `rebirth_relay` | `POST /api/fleet/{id}/rebirth` | `fleet.rebirth` |
| `restart_relay` | `POST /api/fleet/{id}/restart` | `fleet.restart` |
| `update_relay` | `POST /api/fleet/{id}/update` | `fleet.update` |
| `set_relay_config` | `POST /api/fleet/{id}/config` | `fleet.config` |
| `clear_relay_config` | `DELETE /api/fleet/{id}/config` | `fleet.config` |

**Planlagte rapporter (Gateway)**

| Verktøy | Rute | Tillatelse |
|---|---|---|
| `list_reports` | `GET /api/reports` | `reports.read` |
| `get_report` | `GET /api/reports/{id}` | `reports.read` |
| `create_report` | `POST /api/reports` | `reports.write` |
| `update_report` | `PUT /api/reports/{id}` | `reports.write` |
| `delete_report` | `DELETE /api/reports/{id}` | `reports.write` |
| `run_report` | `POST /api/reports/{id}/run` | `reports.run` |

## Ressurser

| URI | Innhold |
|---|---|
| `iiot://devices` | enhetstreet med tagger, som JSON |
| `iiot://tags` | tagg-katalogen med nåværende verdier |
| `iiot://alarms` | alarmdefinisjoner, live tilstand og en tilstandsreferanse |
| `iiot://protocols` | støttede protokoller, fra de innkompilerte driverne |

Ressurser finnes slik at en klient kan hente hele navnerommet i én lesing i stedet for å oppdage det ett verktøykall om gangen.

## Hva verktøyene ikke vil gjøre

Verktøyene er skrevet slik at en modell ikke ved et uhell kan runde av usikkerhet.

**En tag uten lesing er ikke en tag som leser null.** `read_tag` sier `no reading has been taken for this tag yet`, eller `this tag is not configured` hvis den ikke finnes. Ingen av dem returnerer en verdi.

**Dårlig kvalitet oppgis, ikke antydes.** Lesinger kommer tilbake som `[quality: bad (the value is NOT known; do not treat it as a measurement)]`. Serverinstruksjonene gjentar det. Ikke ta gjennomsnitt over dårlige lesinger og ikke rapporter en som en måling.

**`describe_protocol` kan ikke lyve.** Tilgjengelighet kommer fra driverne kompilert inn i binærfilen, så verktøyet kan ikke påstå en protokoll gatewayen ikke har.

**Et avslag er et svar, ikke en transportfeil.** En avvist skriving kommer tilbake som et verktøyresultat med `isError`, som betyr at kallet var velformet og bevisst avslått. Det er ikke en protokollfeil som skal prøves på nytt.

## Skriving

MCP leser og skriver: det kommanderer utstyr, og det endrer konfigurasjon ([ovenfor](#endre-konfigurasjon)). `write_tag` flytter ekte utstyr, så de samme tingene står mellom et verktøykall og en maskin som står mellom en operatørs klikk og en:

1. `HOTLOOP_ALLOW_WRITES`, hovedbryteren for hele utrullingen, må være på. Med den av skriver ingenting: ikke UI-et, ikke API-et, ikke en agent.
2. Taggen må være merket skrivbar. Tagger er skrivebeskyttet til noen sier noe annet, én om gangen.
3. Verdien må ligge innenfor taggens konfigurerte område. Den **avvises, ikke klippes**: å sende 400 når noen ba om 500 er å i det stille gjøre noe annet enn det som ble bedt om.

En **begrunnelse er påkrevd** og registreres ved siden av skrivingen. En revisjonsrad ingen kan tolke seks måneder senere er knapt bedre enn ingen.

`call_service` får nøyaktig de samme tre, fordi det ikke er noe annet enn skrivinger gjennom samme port, og så entitetens egne sjekker oppå (et tall sitt steg og snevrere område, en tekst sitt mønster, at entiteten ikke er deaktivert). Et avslag ved noen av dem revideres mot entiteten så vel som taggen: kilde `mcp`, klienten ved navn, entity_id, tjenesten og kall-id-en, den samme raden en avvist `write_tag` etterlater pluss entiteten. Et kall uten begrunnelse avvises før noe forsøkes, som `write_tag`.

`trigger_automation` er sperret likt, fordi en regels handlinger kan kommandere utstyr; ellers ville det vært en vei utenom sjekkene `write_tag` møter.

```
> write_tag tag=press-01/Zone1_Temp value=99 reason="testing"
write refused: press-01/Zone1_Temp: this tag is not marked writable
```

Når skriving er slått av, sier serverinstruksjonene det rett ut, så en agent ikke kaster bort en runde på å oppdage det.

## Kalle utover

En automasjons `mcp_call`-handling kaller et verktøy på en annen MCP-server. Konfigurer serverne i chartet:

```yaml
mcp:
  outboundServers:
    - name: maintenance
      url: http://maintenance-mcp.default.svc.cluster.local:8080/mcp
      existingSecret: maintenance-mcp-token
      secretKey: token
```

Økter pooles og gjenbrukes; å koble til ved hvert kall ville betydd et håndtrykk, en initialize og en verktøyliste hver gang en regel utløses. En økt som har dødd kobles til igjen ved neste kall i stedet for på en tidtaker, fordi neste kall er det første øyeblikket noen bryr seg. En konfigurert server som er nede stopper ikke overvåkingen av anlegget, ingenting ringes opp før en regel trenger det.

MCP-skjermen viser hver konfigurerte server, om den er tilkoblet og verktøyene den annonserer.

## Føderere anlegg

Én gateway per anlegg er slik dette er ment å kjøre. Hvert anlegg beholder sin egen database, sin egen tavle og sitt eget navn, og ingen av dem avhenger av at en lenke et annet sted holder seg oppe, et anlegg slutter ikke å overvåkes fordi WAN falt ut.

Å se alle samtidig bruker protokollen anleggene allerede snakker. Konfigurer en gateway i skyen med anleggene som utgående MCP-servere, nøyaktig som for `mcp_call`-handlingen:

```
HOTLOOP_MCP_SERVER_1_NAME=akron
HOTLOOP_MCP_SERVER_1_URL=https://akron.example/mcp
HOTLOOP_MCP_SERVER_1_TOKEN=…
HOTLOOP_MCP_SERVER_2_NAME=ashtabula
HOTLOOP_MCP_SERVER_2_URL=https://ashtabula.example/mcp
HOTLOOP_MCP_SERVER_2_TOKEN=…
```

Anlegg-skjermen kaller så `get_plant_status` på hver av dem parallelt og slår svarene sammen. Det er ingenting å rulle ut på et anlegg for at det skal dukke opp, ingen anlegg trenger å vite at det er føderert, og ingenting kobler innover til et anleggsnettverk.

To oppførsler er bevisste og verdt å stole på:

- Et anlegg som ikke svarer vises som **utilgjengelig, med grunnen**, og utelates fra sammenslåingen. Å telle et anlegg du ikke når som null alarmer er det verste en skjerm som denne kunne gjort.
- Tallene et anlegg sist rapporterte vises aldri. De ser aktuelle ut og er det ikke.

Hvert anlegg får sin egen korte frist, så ett anlegg på en død lenke ikke kan holde opp de som er oppe.

## Verdt å fortelle en agent

Serverens egne instruksjoner dekker dette, men for alle som skriver en prompt rundt det:

- Alarmtilstander følger ISA-18.2. `rtn-unack` betyr en alarm som gikk tilbake av seg selv før noen så den, den er fortsatt verdt å rapportere, og det er tilstanden som beviser at kvittering og retur til normal er uavhengige.
- `query_history` med grupper, ikke rå, for alt lengre enn noen få minutter. Et døgn med sekunddata er 86 400 punkter per tag. Gruppene følger kvalitetsregelen: dårlige og usikre lesinger telles i `badReadings`, aldri midlet inn, og en gruppe uten noe godt har et null-gjennomsnitt.
- `recent_events` er måten å rekonstruere en hendelse på: enhetstilkoblinger, skrivinger, alarmoverganger, automasjonskjøringer og konfigurasjonsendringer, i rekkefølge, hver med aktøren som forårsaket den.
