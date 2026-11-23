---
title: "MCP per gli agenti"
description: "Un agente legge tutto l'impianto e tocca solo ciò che avete armato, attraverso il cancello di scrittura, con il motivo di ogni scrittura registrato."
---

Il gateway parla MCP in entrambe le direzioni: gli agenti possono leggere e pilotare l'impianto, e una regola di automazione può chiamare uno strumento altrove.

La regola di progetto è che **un agente è un chiamante come ogni altro**. Gli strumenti leggono attraverso la stessa cache che legge la UI e scrivono attraverso lo stesso cancello attraverso cui scrive la UI. Non c'è alcun percorso privilegiato, nessun bypass, nessuna politica separata. Una scrittura che sarebbe rifiutata a un operatore è rifiutata; una scrittura che riesce finisce nella stessa tabella di audit con `mcp:` davanti all'attore.

## Esposizione

### Via HTTP

Abilitato per impostazione predefinita su `/mcp` sulla porta dell'applicazione, protetto da un token bearer che il chart genera nel Secret della release.

```bash
kubectl -n hotloop get secret <release> \
  -o jsonpath='{.data.mcp-token}' | base64 -d
```

Nel cluster, l'endpoint è:

```
http://<release>.<namespace>.svc.cluster.local:8080/mcp
```

Il controllo del token sta davanti al gestore, quindi un chiamante non autenticato non può nemmeno enumerare ciò che esiste. Lasciare `mcp.token` vuoto fa generare un token al chart, il deployment predefinito non è per caso quello aperto. Combinatelo con la NetworkPolicy; un token è una seconda linea di difesa, non l'unica.

L'endpoint non è mai aperto. Eseguite il binario senza `HOTLOOP_MCP_TOKEN` (un'unità Quadlet, un `hotloop` nudo) e crea un token al primo avvio e lo conserva nel proprio database, così lo stesso ritorna dopo un riavvio, su ogni replica e dopo un ripristino. `hotloop mcp-token` lo stampa (il log dice che ne ha creato uno, e mai quale). Impostate `HOTLOOP_MCP_TOKEN` per sceglierne uno vostro; con `HOTLOOP_MCP_OIDC_*` impostato l'endpoint accetta un login e non conserva alcun token proprio. Un client che prima si connetteva a un binario nudo senza nulla ora riceve un `401` finché non invia `Authorization: Bearer <that token>`.

### Con un login Vord o un'asserzione dell'hub

Il token statico dice quale client ha chiamato; non può dire quale persona. Con OIDC impostato, `/mcp` accetta anche `Authorization: Bearer <jwt>`, e l'email della persona verificata diventa l'attore di audit: una scrittura finisce come `mcp:pat@example.com` invece di `mcp:<client name>`. Il comportamento senza di esso è invariato, e il token statico continua a funzionare accanto (senza token statico impostato, entra solo un JWT verificato).

| Variabile | Valore del chart | Cosa fa |
|---|---|---|
| `HOTLOOP_MCP_OIDC_ISSUER` | `mcp.oidc.issuer` | l'URL del realm Vord; accetta i suoi token di accesso |
| `HOTLOOP_MCP_OIDC_AUDIENCE` | `mcp.oidc.audience` | il `aud` che ogni token deve portare; obbligatorio con uno qualsiasi di questi due |
| `HOTLOOP_MCP_OIDC_HUB_JWKS_URL` | `mcp.oidc.hubJwksUrl` | le chiavi di asserzione dell'hub di identità; accetta le sue asserzioni |
| `HOTLOOP_MCP_OIDC_REQUIRED_ROLE` | `mcp.oidc.requiredRole` | un ruolo del realm che il chiamante deve avere |
| `HOTLOOP_MCP_OIDC_WRITE_ROLE` | `mcp.oidc.writeRole` | limita le scritture per chiamante, vedi sotto |

Un token di accesso Vord viene controllato rispetto al JWKS dell'emittente (trovato tramite il suo documento di discovery, in cache dieci minuti, richiesto di nuovo su un `kid` sconosciuto): solo RS256 o ES256, `iss` uguale all'emittente, `aud` che contenga l'audience, `exp` e `nbf` con 30 s di tolleranza, e un claim `email` (o `preferred_username`). Vord mette per impostazione predefinita solo `account` in `aud`; date allo scope del client un mapper di audience per l'audience che impostate.

Un'asserzione dell'hub è `typ` `fb-assert+jwt`, EdDSA, `iss` `fireball-hub`, `aud` l'audience configurata (il modulo Hub invia `hotloop`), non scaduta, firmata da una chiave nel JWKS dell'Hub. Non c'è una cache anti-replay per `jti`: una chiamata a uno strumento sono più richieste HTTP (initialize, poi la chiamata) che portano la stessa asserzione, che vive 60 s. Quando l'Hub dice che la chiamata agisce per conto di qualcun altro (`acting_as`), l'attore si legge `mcp:<email> for <acting_as email>`.

Le scritture richiedono ancora `HOTLOOP_ALLOW_WRITES`, l'interruttore generale; un token non lo amplia mai. `HOTLOOP_MCP_OIDC_WRITE_ROLE` le restringe per chiamante: `hotloop:hotloop.write` significa il ruolo client Vord `hotloop.write` sul client `hotloop` (`resource_access.hotloop.roles`), un nome nudo significa un ruolo del realm, e un'asserzione dell'Hub deve portare il nome del ruolo in `abilities`. Un chiamante senza di esso può leggere ma `write_tag`, `call_service`, `run_script`, `apply_recipe`, `trigger_automation` e ogni strumento che modifica la configurazione rifiutano. Il token statico non ne è limitato.

### Via stdio

Lo stesso binario serve MCP su stdin e stdout con `--mcp-stdio`, per un client che lo avvia direttamente. Parte anche tutto il resto, così l'agente vede un impianto vivo e non un server vuoto.

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

In modalità stdio tutto il logging va su stderr. Qualsiasi cosa scritta su stdout corromperebbe il flusso del protocollo.

## Strumenti

Centosettantuno: ventisette che leggono l'impianto e lo comandano, sessantanove che ne modificano la configurazione ([sotto](#modificare-la-configurazione)), trentatré letture e simulazioni che le accompagnano ([sotto](#letture-e-simulazioni)) e quarantadue per l'amministrazione ([sotto](#amministrazione)).

| Strumento | Cosa fa |
|---|---|
| `get_plant_status` | dispositivi online, allarmi in sospeso, se le scritture sono abilitate |
| `list_devices` | ogni dispositivo con protocollo, indirizzo, stato, numero di tag |
| `describe_device` | un dispositivo in dettaglio, con i suoi tag e le statistiche di polling |
| `list_tags` | cerca nel catalogo per dispositivo, nome o descrizione |
| `read_tag` | valori attuali, con qualità |
| `query_history` | letture storiche, grezze o raggruppate |
| `write_tag` | **comanda un tag** |
| `list_alarms` | allarmi e i loro stati ISA-18.2 |
| `ack_alarm` | riconosce a nome di un operatore |
| `list_automations` | regole, numero di esecuzioni, ultimo esito |
| `trigger_automation` | esegue una regola adesso |
| `describe_protocol` | ciò che questa build parla davvero |
| `recent_events` | il log di sistema, per ricostruire cosa è successo e in che ordine |
| `list_entities` | trova entità per dominio, nodo di equipaggiamento o etichetta, con i servizi che ognuna accetta |
| `get_states` | stato attuale di una o più entità, con qualità e attributi |
| `call_service` | **comanda un'entità**: `switch.turn_on`, `number.set_value` |
| `get_logbook` | un'unica cronologia di cambi di stato, scritture, allarmi, esecuzioni e modifiche di configurazione, per entità, nodo di equipaggiamento, attore o tipo |
| `list_scripts` | gli script dell'impianto, i campi che ciascuno richiede, se è in esecuzione, la sua ultima esecuzione |
| `run_script` | **esegue uno script**, o chiede con `dryRun` cosa farebbe adesso |
| `list_recipes` | le ricette dell'impianto: obiettivi in ordine, parametri, precondizione, versione, ultima applicazione |
| `validate_recipe` | una ricetta si applicherebbe adesso? ogni motivo per cui verrebbe rifiutata; non viene scritto nulla |
| `apply_recipe` | **applica una ricetta**: controllata per intero, scritta in ordine, riletta |
| `list_blueprints` | i blueprint che le persone compilano per creare regole, i loro input e le versioni |
| `preview_blueprint` | la regola che un blueprint creerebbe con certi input, e cosa farebbe adesso; non crea nulla |
| `find_network_client` | dove si trova un dispositivo sulla rete dell'impianto: la sua porta dello switch, se la porta ha un link, quando la console UniFi lo ha visto l'ultima volta |
| `get_network_topology` | la rete dell'impianto come la disegna la console UniFi: cosa è collegato a cosa, lo stato di ogni dispositivo, e i dispositivi HotLoop che perdono la rete se cade |
| `get_network_events` | gli eventi più recenti riportati da una console UniFi, e se il suo websocket degli eventi è attivo |

### Entità

Un'entità è ciò che le persone chiamano una cosa dell'impianto, `sensor.zone_1_temperature` o `switch.conveyor_run`, che racchiude uno o più tag. Vedi [Entità](/it/iot/entities/). Per un agente di solito sono la presa migliore: il nome significa qualcosa, e l'entità sa cosa si può fare con essa.

`list_entities` filtra per `domain`, per `equipment` (un nodo dell'albero degli equipaggiamenti per id, nome o percorso di nomi come `Plant A/Packing`, che corrisponde a tutto ciò che è in esso o sotto, e il posto proprio di un'entità vince su quello del suo dispositivo), per `label` (label_id o nome; un'entità corrisponde se porta l'etichetta o se la porta il suo dispositivo) e per `query`, una sottostringa dell'entity_id o del nome. Ogni risultato porta il suo stato attuale e la qualità e i servizi che accetta, come `domain.service`. Un'entità senza servizi è in sola lettura. I servizi vengono dal livello delle entità, quindi un dominio che ne acquisisce uno là compare qui senza alcuna modifica.

`get_states` prende `entity_ids` e risponde per ognuna con il suo stato, la qualità, gli attributi e `last_changed`. Mantiene la stessa linea di `read_tag`: uno stato `unknown` o `unavailable` riceve una nota che dice che non è un valore, un'entità disabilitata dice di essere disabilitata anziché mancante, e la cattiva qualità è esplicitata.

`call_service` prende `domain`, `service`, `entity_id`, `data` e un `reason` **obbligatorio**:

```
> call_service domain=number service=set_value entity_id=number.press_01_sp
    data={"value": 212.5} reason="operator asked for 212.5 on zone 1"
Called number.set_value on number.press_01_sp (was 210). Writes: 212.5 to press-01/Setpoint: written
```

Passa per `entity.Services`, lo stesso esecutore che usa `POST /api/services/...`, che trasforma la chiamata in scritture attraverso il cancello di scrittura. Vedi [Scrittura](#scrittura).

### La rete

`find_network_client` risponde alla prima domanda su un PLC che è diventato muto: è il PLC, o la sua porta dello switch? Dategli `deviceId` e segue il link confermato di quel dispositivo fino al suo client UniFi; dategli `query` (un MAC, un IP o parte di un nome) e cerca in ogni console che HotLoop legge. Legge l'ultima lettura del driver UniFi, mai la console, quindi un agente che interroga in loop non costa nulla alla console. Ciò significa anche che un helper `--mcp-stdio` risponde che nel suo processo non viene letta alcuna console: non accede mai a nessuna, perché il Gateway accanto tiene già la sessione. Interrogate l'endpoint del Gateway. Vedi [UniFi Network](/it/iot/unifi/).

`get_network_topology` è la mappa: ogni switch, access point e gateway sotto quello a cui è collegato, con la porta a entrambe le estremità, il link, quanti client ci sono su di esso e i dispositivi HotLoop collegati a un client sotto di esso. Quest'ultima parte è il raggio d'azione: nomina i PLC che perdono la rete se quello switch cade. Uno switch che la console elenca come collegato a nulla lo dice e non viene appeso al gateway. `get_network_events` sono gli eventi più recenti della console, dal più nuovo, con la sua stessa frase, un flag di avviso dove la console lo giudica negativo, e se il websocket degli eventi è attivo. Entrambi prendono il `deviceId` della console, che si può omettere quando HotLoop ne legge una sola, ed entrambi leggono l'ultima lettura del driver come `find_network_client`, quindi non costano nulla alla console e dicono la stessa cosa in un helper `--mcp-stdio`: in quel processo non viene letta alcuna console. Gli eventi più vecchi sono in `get_logbook`, archiviati sotto lo switch o l'access point a cui si riferivano.

### Il registro eventi

`get_logbook` è la cronologia che serve `GET /api/logbook` (vedi [Il registro eventi](/it/iot/logbook/)): cambi di stato, scritture, transizioni di allarme, esecuzioni di automazioni e modifiche di configurazione, dal più nuovo. Si restringe per `entity`, per `equipment` (id, nome o percorso, e tutto ciò che sta sotto; un nome che corrisponde a due nodi è un errore che li elenca entrambi), per `actor` (una parte di esso: `mcp:` trova tutto ciò che ha fatto qualsiasi agente), per `kinds`, e per `minutes` indietro (predefinito un giorno). Una pagina con altro dopo di essa termina dicendo cosa passare come `before` per la successiva. Per "cosa è successo prima che andasse storto" è il `recent_events` migliore: i cambi di stato propri dell'equipaggiamento sono in esso, e le righe del cancello di scrittura non ci sono due volte.

### Script

Uno script è una sequenza di passi con un nome che qualcuno ha scritto una volta, il ciclo CIP o la spurgo di linea, così un agente esegue la procedura propria dell'impianto invece di inventarne una. Vedi [Script](/it/iot/scripts/). `list_scripts` dice cosa richiede ciascuno. `run_script` prende `scriptId`, `fields`, un `reason` **obbligatorio**, e due interruttori:

- `dryRun: true` percorre lo script contro l'impianto così com'è e dice, passo per passo, cosa verrebbe scritto e la prima cosa che il cancello rifiuterebbe, con le parole del cancello. Nulla viene scritto né registrato. Chiedete prima questo.
- `wait: true` risponde quando l'esecuzione è terminata, con il suo esito e la traccia. Senza di esso la risposta è l'id dell'esecuzione, e `list_scripts` o `get_logbook` con `kinds: ["script"]` dice come è finita.

L'esecuzione è dello script, come `script:<id>`, con la sorgente `mcp`, così ogni scrittura che fa incontra il cancello esattamente come `write_tag`. Con le scritture disattivate (`HOTLOOP_ALLOW_WRITES`), `run_script` rifiuta prima che qualcosa venga eseguito, come fa `trigger_automation`; una simulazione riceve comunque risposta, e dice che il motivo è l'interruttore.

### Ricette

Una ricetta è un insieme di setpoint che l'impianto applica insieme, una qualità di prodotto o un cambio formato, così un agente carica i numeri propri dell'impianto invece di scriverli uno alla volta. Vedi [Ricette](/it/iot/recipes/). `list_recipes` mostra gli obiettivi di ciascuna in ordine e i parametri che richiede. `validate_recipe` chiede se una si applicherebbe adesso e dà ogni motivo per cui non lo farebbe, senza scrivere nulla. `apply_recipe` prende `recipeId`, `params`, un `version` facoltativo e un `reason` **obbligatorio**.

Viene controllata prima per intero e rifiutata per intero, senza scrivere nulla, se un valore dovesse essere rifiutato; i valori fuori intervallo sono rifiutati, mai corretti. Poi gli obiettivi escono in ordine con un solo id di chiamata, il primo che fallisce ferma i successivi, e nulla viene annullato. La risposta dice, obiettivo per obiettivo, cosa è uscito e se il dispositivo ha riletto il valore. Le scritture sono dell'agente, con la sorgente `mcp`, quindi il cancello si applica a ciascuna; con le scritture disattivate (`HOTLOOP_ALLOW_WRITES`), `apply_recipe` rifiuta prima di controllare qualsiasi cosa. Una ricetta che nomina un proprio permesso di applicazione è per le persone a cui è concesso, e un agente non è tra queste.

### Blueprint

Un blueprint è una regola scritta una volta con spazi tipizzati: quale motore, quanto tempo, quale limite. Vedi [Blueprint](/it/iot/blueprints/). `list_blueprints` dice cosa richiede ciascuno. `preview_blueprint` prende `blueprintId`, `automationId` e `inputs`, e risponde con la regola che creerebbe e cosa farebbe quella regola se scattasse adesso, con ogni scrittura sottoposta ai controlli del cancello. Gli input sono controllati esattamente come li controlla la schermata: fuori intervallo viene rifiutato, non corretto.

`instantiate_blueprint` crea la regola, attraverso la via che usa la schermata Blueprint: gli stessi controlli, e la regola finisce nel registro eventi con l'agente come autore. Una regola è un ordine permanente di comandare apparecchiature ogni volta che scatta il suo trigger, quindi un agente guarda prima: `preview_blueprint` non memorizza nulla e non scrive nulla, e riceve risposta che le scritture siano attive o no. Ogni scrittura che la regola creata passa poi a fare incontra il cancello di scrittura, come per una regola creata da una persona. Vedi [Modificare la configurazione](#modificare-la-configurazione).

## Modificare la configurazione

Tutto ciò che un agente può leggere, può modificarlo. Gli strumenti sopra che leggono l'impianto hanno controparti che lo modificano, sessantanove, e nessuno è una seconda implementazione: ciascuno è una route dell'API REST, e una chiamata viene eseguita attraverso il gestore proprio di quella route. La validazione, il controllo dei permessi, il ricaricamento del runtime e la riga di audit sono della route, con l'agente come attore (`mcp:<client>`, o `mcp:<email>` con un login Vord), così un dispositivo senza driver, una regola che non compila, un input di blueprint fuori intervallo o un tag per cui il dispositivo rilevato non è stato accettato vengono rifiutati con le parole che mostra la schermata, e nulla è stato modificato.

Ognuno prende i valori di percorso della route per nome (`id`, `device`, `name`...), `body`, lo stesso JSON che prende l'API ([L'API HTTP](/it/iot/api/) ha ogni body), e un `reason` **obbligatorio**. Il motivo è registrato come riga `config` nel log di sistema accanto a quella della route, a carico di ciò che è stato modificato.

```
> save_tag reason="the setpoint, writable between 0 and 100" body={"deviceId":"press-01",
    "name":"Setpoint","address":"holding:5:uint16","dataType":"int16","enabled":true,
    "writable":true,"hasRange":true,"minValue":0,"maxValue":100}
save_tag done.
{ ...the tag as stored... }
```

Ciò che sta davanti a essi è ciò che sta davanti a `write_tag`, meno l'interruttore generale, perché le schermate non ne hanno bisogno nemmeno per modificare la configurazione:

1. `HOTLOOP_ALLOW_MCP_WRITES`, attivo per impostazione predefinita, deve essere attivo.
2. Un chiamante con `HOTLOOP_MCP_OIDC_WRITE_ROLE` impostato deve possederlo.
3. La chiamata porta un solo permesso, quello che chiede la sua route (la terza colonna sotto), e nient'altro. Una route risponde a un agente come risponde a una persona senza quel permesso, e un test obbliga ogni riga della tabella a corrispondere a una route reale e al permesso che quella route chiede.
4. Un motivo.

Comandare apparecchiature resta `write_tag`, `call_service`, `run_script`, `apply_recipe` e `trigger_automation`, con `HOTLOOP_ALLOW_WRITES` attivo e il contrassegno di scrivibile e l'intervallo del tag da rispettare. Rendere scrivibile un tag, creare una regola, uno script o una ricetta è configurazione: non comanda nulla finché non viene usata, e ciò che comanda allora passa per il cancello.

Le funzioni proprie dell'amministratore sono anch'esse strumenti, sotto [Amministrazione](#amministrazione) più avanti. Accettare un dispositivo rilevato è qui, come sulla schermata; i punti su di esso devono comunque essere armati per la scrittura uno alla volta.

Gli strumenti esistono anche in `--mcp-stdio`: il processo costruisce lo stesso server API, e non apre mai la sua porta.

**Dispositivi e tag**

| Strumento | Route | Permesso |
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

**Rilevamento e broker**

| Strumento | Route | Permesso |
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

| Strumento | Route | Permesso |
|---|---|---|
| `mark_unifi_network_ot` | `PUT /api/unifi/{id}/networks/{network}` | `devices.write` |
| `accept_unifi_known_device` | `PUT /api/unifi/{id}/networks/{network}/known/{mac}` | `devices.write` |
| `forget_unifi_known_device` | `DELETE /api/unifi/{id}/networks/{network}/known/{mac}` | `devices.write` |
| `accept_all_unifi_known_devices` | `POST /api/unifi/{id}/networks/{network}/accept-all` | `devices.write` |
| `create_unifi_starter_alarms` | `POST /api/unifi/{id}/starter-alarms` | `alarms.write` |

**Entità, helper, equipaggiamenti, etichette**

| Strumento | Route | Permesso |
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

**Allarmi**

| Strumento | Route | Permesso |
|---|---|---|
| `save_alarm` | `POST /api/alarms` | `alarms.write` |
| `delete_alarm` | `DELETE /api/alarms/{id}` | `alarms.write` |
| `shelve_alarm` | `POST /api/alarms/{id}/shelve` | `alarms.ack` |
| `unshelve_alarm` | `POST /api/alarms/{id}/unshelve` | `alarms.ack` |

**Automazioni e blueprint**

| Strumento | Route | Permesso |
|---|---|---|
| `save_automation` | `POST /api/automations` | `automations.write` |
| `delete_automation` | `DELETE /api/automations/{id}` | `automations.write` |
| `set_automation_enabled` | `POST /api/automations/{id}/enabled` | `automations.write` |
| `upgrade_blueprint_automation` | `POST /api/automations/{id}/blueprint-upgrade` | `blueprints.apply` |
| `instantiate_blueprint` | `POST /api/blueprints/{id}/instantiate` | `blueprints.apply` |
| `create_blueprint` | `POST /api/blueprints` | `blueprints.write` |
| `update_blueprint` | `PUT /api/blueprints/{id}` | `blueprints.write` |
| `delete_blueprint` | `DELETE /api/blueprints/{id}` | `blueprints.write` |

**Script e ricette**

| Strumento | Route | Permesso |
|---|---|---|
| `create_script` | `POST /api/scripts` | `scripts.write` |
| `update_script` | `PUT /api/scripts/{id}` | `scripts.write` |
| `delete_script` | `DELETE /api/scripts/{id}` | `scripts.write` |
| `stop_script` | `POST /api/scripts/{id}/stop` | `scripts.run` |
| `create_recipe` | `POST /api/recipes` | `recipes.write` |
| `capture_recipe` | `POST /api/recipes/capture` | `recipes.write` |
| `update_recipe` | `PUT /api/recipes/{id}` | `recipes.write` |
| `delete_recipe` | `DELETE /api/recipes/{id}` | `recipes.write` |

**Dashboard e la board**

| Strumento | Route | Permesso |
|---|---|---|
| `create_dashboard` | `POST /api/dashboards` | `dashboards.write` |
| `update_dashboard` | `PUT /api/dashboards/{id}` | `dashboards.write` |
| `delete_dashboard` | `DELETE /api/dashboards/{id}` | `dashboards.write` |
| `save_board` | `PUT /api/board` | `board.write` |

**Importazioni**

| Strumento | Route | Permesso |
|---|---|---|
| `import_codesys_alarms` | `POST /api/alarms/import/codesys` | `alarms.write` |
| `screen_import` | `POST /api/dashboards/import` | `dashboards.write` |

`import_codesys_alarms` prende il file che Export Alarms dell'IDE CODESYS ha scritto, come `contentBase64` (i byte così come sono su disco, che l'IDE scrive in UTF-16) o come `content` (il testo, se lo avete come testo), con il `deviceId` a cui appartengono gli allarmi e, se li volete, `application` e `defaultPriority`. Lasciato così fa solo un'anteprima: dice quali allarmi passerebbero e quali no, non salva nulla e non richiede un motivo. Con `apply` true li salva come definizioni di allarme, e allora richiede un motivo e l'interruttore di scrittura MCP come ogni strumento che modifica la configurazione.

`screen_export` risponde una dashboard come file di schermata HotLoop ([File di schermata](/it/iot/screen-file/)), e `screen_import` ne accetta uno, su questa installazione o su un'altra. Chiede prima: `dryRun` è true a meno che diciate false, e una simulazione non salva nulla e risponde con il rapporto con ogni problema elencato e i riferimenti per `remap`. Un vero import richiede `dryRun` false, un motivo e l'interruttore di scrittura MCP, e un id che esiste viene rifiutato a meno che `replace` sia true. La schermata sono dati del cliente, quindi il file è il modo in cui si sposta tra installazioni, mai codice.

### Letture e simulazioni

Un agente che può modificare una dashboard, un broker o un nodo dell'albero degli equipaggiamenti deve poter leggere prima ciò che c'è, quindi ogni oggetto che uno strumento sopra modifica ha qui una lettura, e anche le simulazioni degli editor sono strumenti. Ciascuna è una route eseguita dal suo gestore con il permesso di lettura che quella route chiede. Una lettura risponde senza motivo e senza l'interruttore di scrittura, e un chiamante che il ruolo di scrittura esclude può comunque farle, perché portano un permesso di lettura e nient'altro. Le tre simulazioni (`validate_automation`, `validate_script` e `browse_device`) non cambiano nulla; le due che controllano un corpo portano il permesso di scrittura che chiede la loro route, quindi restano dietro il ruolo di scrittura.

| Strumento | Route | Permesso |
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

### Amministrazione

Gli account utente, le impostazioni, i backup, la politica di escalation, le destinazioni dello storico, gli accessi al broker, la flotta di edge relay e i report pianificati sono dell'amministratore, e sono anch'essi strumenti: quarantadue, con lo stesso schema degli altri. Ciascuno è una route eseguita dal suo gestore con il permesso che quella route chiede (`users.manage`, `settings.write`, `backup.run`, `fleet.restart`...), un motivo per ogni modifica e l'agente nella riga di audit. Una route che rifiuta rifiuta un agente con le stesse parole. Le letture (gli strumenti `list_` e `get_`) non richiedono né motivo né interruttore di scrittura, e richiedono comunque il ruolo di scrittura del chiamante quando ne è impostato uno, perché il permesso che portano è da amministratore. Gli strumenti di flotta e di report esistono solo in un prodotto che ha la funzione.

Due cose sono proprie delle route e vale la pena conoscerle prima di fidarsi di uno strumento:

- **Gli interruttori di scrittura non hanno una route.** `safety.allowWrites` e `safety.allowMcpWrites` sono del deployment (`HOTLOOP_ALLOW_WRITES`, `HOTLOOP_ALLOW_MCP_WRITES`), e `PUT /api/settings` li rifiuta perché impostati dal deployment. Quindi `save_settings` modifica ciò che la schermata Impostazioni può modificare e risponde quel rifiuto per gli interruttori, con quelle parole. Un agente non può attivare l'interruttore da cui dipendono le sue stesse scritture.
- **La password di un utente passa per la chiamata.** `create_user`, `reset_user_password` e gli strumenti PIN prendono un segreto nei loro argomenti, come l'API. La riga di audit nomina la modifica e il motivo e mai il segreto.

**Account utente**

| Strumento | Route | Permesso |
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

**Impostazioni, backup, notifiche**

| Strumento | Route | Permesso |
|---|---|---|
| `get_settings` | `GET /api/settings` | `settings.read` |
| `save_settings` | `PUT /api/settings` | `settings.write` |
| `list_backups` | `GET /api/backup` | `backup.read` |
| `run_backup` | `POST /api/backup` | `backup.run` |
| `get_escalation` | `GET /api/notify/escalation` | `notify.escalation` |
| `save_escalation` | `PUT /api/notify/escalation` | `notify.escalation` |
| `send_test_notification` | `POST /api/notify/test` | `notify.test` |

**Destinazioni dello storico e accessi al broker**

| Strumento | Route | Permesso |
|---|---|---|
| `list_historian_targets` | `GET /api/historian/targets` | `settings.read` |
| `create_historian_target` | `POST /api/historian/targets` | `settings.write` |
| `update_historian_target` | `PUT /api/historian/targets/{id}` | `settings.write` |
| `delete_historian_target` | `DELETE /api/historian/targets/{id}` | `settings.write` |
| `list_broker_logins` | `GET /api/broker/logins` | `users.manage` |
| `create_broker_login` | `POST /api/broker/logins` | `users.manage` |
| `update_broker_login` | `PUT /api/broker/logins/{name}` | `users.manage` |
| `delete_broker_login` | `DELETE /api/broker/logins/{name}` | `users.manage` |

**La flotta di edge relay (Gateway)**

| Strumento | Route | Permesso |
|---|---|---|
| `list_fleet` | `GET /api/fleet` | `fleet.read` |
| `register_relay` | `POST /api/fleet` | `fleet.write` |
| `delete_relay` | `DELETE /api/fleet/{id}` | `fleet.write` |
| `rebirth_relay` | `POST /api/fleet/{id}/rebirth` | `fleet.rebirth` |
| `restart_relay` | `POST /api/fleet/{id}/restart` | `fleet.restart` |
| `update_relay` | `POST /api/fleet/{id}/update` | `fleet.update` |
| `set_relay_config` | `POST /api/fleet/{id}/config` | `fleet.config` |
| `clear_relay_config` | `DELETE /api/fleet/{id}/config` | `fleet.config` |

**Report pianificati (Gateway)**

| Strumento | Route | Permesso |
|---|---|---|
| `list_reports` | `GET /api/reports` | `reports.read` |
| `get_report` | `GET /api/reports/{id}` | `reports.read` |
| `create_report` | `POST /api/reports` | `reports.write` |
| `update_report` | `PUT /api/reports/{id}` | `reports.write` |
| `delete_report` | `DELETE /api/reports/{id}` | `reports.write` |
| `run_report` | `POST /api/reports/{id}/run` | `reports.run` |

## Risorse

| URI | Contenuto |
|---|---|
| `iiot://devices` | l'albero dei dispositivi con i tag, come JSON |
| `iiot://tags` | il catalogo dei tag con i valori attuali |
| `iiot://alarms` | definizioni degli allarmi, stato live e un riferimento degli stati |
| `iiot://protocols` | protocolli supportati, dai driver compilati |

Le risorse esistono perché un client possa prendere l'intero namespace in una sola lettura anziché scoprirlo una chiamata di strumento alla volta.

## Cosa gli strumenti non faranno

Gli strumenti sono scritti in modo che un modello non possa arrotondare l'incertezza per caso.

**Un tag senza lettura non è un tag che legge zero.** `read_tag` dice `no reading has been taken for this tag yet`, oppure `this tag is not configured` se non esiste. Nessuno dei due restituisce un valore.

**La cattiva qualità è dichiarata, non sottintesa.** Le letture tornano come `[quality: bad (the value is NOT known; do not treat it as a measurement)]`. Le istruzioni del server lo ripetono. Non fate la media tra letture cattive e non riportatene una come misura.

**`describe_protocol` non può mentire.** La disponibilità viene dai driver compilati nel binario, quindi lo strumento non può dichiarare un protocollo che il gateway non ha.

**Un rifiuto è una risposta, non un guasto di trasporto.** Una scrittura rifiutata torna come risultato dello strumento con `isError`, il che significa che la chiamata era ben formata ed è stata declinata deliberatamente. Non è un errore di protocollo da ritentare.

## Scrittura

MCP legge e scrive: comanda apparecchiature, e modifica la configurazione ([sopra](#modificare-la-configurazione)). `write_tag` muove apparecchiature reali, quindi le stesse cose che stanno tra il clic di un operatore e una macchina stanno tra la chiamata di uno strumento e una macchina:

1. `HOTLOOP_ALLOW_WRITES`, l'interruttore generale di tutto il deployment, deve essere attivo. Con esso spento non scrive nulla: né la UI, né l'API, né un agente.
2. Il tag deve essere contrassegnato come scrivibile. I tag sono in sola lettura finché qualcuno non dice altrimenti, uno alla volta.
3. Il valore deve rientrare nell'intervallo configurato del tag. Viene **rifiutato, non limitato**: inviare 400 quando qualcuno ne ha chiesto 500 significa fare in silenzio qualcosa di diverso da ciò che era stato chiesto.

Un **motivo è richiesto** e viene registrato accanto alla scrittura. Una riga di audit che nessuno sa interpretare sei mesi dopo è appena meglio di nessuna.

`call_service` riceve esattamente le stesse tre, perché non è altro che scritture attraverso lo stesso cancello, e poi i controlli propri dell'entità in aggiunta (il passo e l'intervallo più stretto di un numero, il pattern di un testo, l'entità non disabilitata). Un rifiuto in uno qualsiasi di essi viene registrato a carico dell'entità oltre che del tag: sorgente `mcp`, il client per nome, l'entity_id, il servizio e l'id di chiamata, la stessa riga che lascia un `write_tag` rifiutato più l'entità. Una chiamata senza motivo viene rifiutata prima che si tenti qualcosa, come `write_tag`.

`trigger_automation` è soggetto allo stesso cancello, perché le azioni di una regola possono comandare apparecchiature; altrimenti sarebbe un modo per aggirare i controlli che incontra `write_tag`.

```
> write_tag tag=press-01/Zone1_Temp value=99 reason="testing"
write refused: press-01/Zone1_Temp: this tag is not marked writable
```

Quando le scritture sono disattivate, le istruzioni del server lo dicono subito, così un agente non spreca un turno a scoprirlo.

## Chiamare all'esterno

L'azione `mcp_call` di un'automazione invoca uno strumento su un altro server MCP. Configurate i server nel chart:

```yaml
mcp:
  outboundServers:
    - name: maintenance
      url: http://maintenance-mcp.default.svc.cluster.local:8080/mcp
      existingSecret: maintenance-mcp-token
      secretKey: token
```

Le sessioni vengono messe in pool e riutilizzate; connettersi a ogni chiamata significherebbe un handshake, un initialize e un elenco di strumenti ogni volta che scatta una regola. Una sessione morta viene riconnessa alla chiamata successiva anziché su un timer, perché la chiamata successiva è il primo momento in cui a qualcuno importa. Un server configurato che è giù non impedisce di monitorare l'impianto, non si chiama nulla finché una regola non ne ha bisogno.

La schermata MCP mostra ogni server configurato, se è connesso e gli strumenti che annuncia.

## Federare i siti

Un gateway per impianto è il modo in cui è pensato che giri. Ogni sito conserva il proprio database, la propria board e il proprio nome, e nessuno dipende dal fatto che un link verso altrove resti attivo, un impianto non smette di essere monitorato perché è caduta la WAN.

Vederli tutti insieme usa il protocollo che i siti parlano già. Configurate un gateway nel cloud con i siti come server MCP in uscita, esattamente come per l'azione `mcp_call`:

```
HOTLOOP_MCP_SERVER_1_NAME=akron
HOTLOOP_MCP_SERVER_1_URL=https://akron.example/mcp
HOTLOOP_MCP_SERVER_1_TOKEN=…
HOTLOOP_MCP_SERVER_2_NAME=ashtabula
HOTLOOP_MCP_SERVER_2_URL=https://ashtabula.example/mcp
HOTLOOP_MCP_SERVER_2_TOKEN=…
```

La schermata Siti poi chiama `get_plant_status` su ciascuno in parallelo e consolida le risposte. Non c'è nulla da distribuire su un sito perché compaia, nessun sito deve sapere di essere federato, e nulla si connette verso l'interno di una rete d'impianto.

Due comportamenti sono deliberati e ci si può fare affidamento:

- Un sito che non risponde è mostrato come **irraggiungibile, con il motivo**, ed è lasciato fuori dal consolidamento. Contare un impianto che non si riesce a raggiungere come zero allarmi sarebbe la cosa peggiore che una schermata come questa potrebbe fare.
- I numeri che un sito ha riportato per ultimi non vengono mai mostrati. Sembrano attuali e non lo sono.

Ogni sito ha una propria breve scadenza, così un impianto su un link morto non può trattenere quelli attivi.

## Cosa vale la pena dire a un agente

Le istruzioni proprie del server coprono questo, ma per chiunque scriva un prompt attorno a esso:

- Gli stati di allarme seguono ISA-18.2. `rtn-unack` significa un allarme rientrato da solo prima che qualcuno lo vedesse, merita comunque di essere segnalato, ed è lo stato che dimostra che il riconoscimento e il rientro alla normalità sono indipendenti.
- `query_history` con raggruppamenti, non grezzo, per qualsiasi cosa più lunga di pochi minuti. Un giorno di dati al secondo sono 86.400 punti per tag. I raggruppamenti seguono la regola della qualità: le letture cattive e incerte sono contate in `badReadings`, mai incluse nella media, e un raggruppamento senza nulla di buono ha una media nulla.
- `recent_events` è il modo di ricostruire un incidente: connessioni dei dispositivi, scritture, transizioni di allarme, esecuzioni di automazioni e modifiche di configurazione, in ordine, ciascuno con l'attore che lo ha causato.
