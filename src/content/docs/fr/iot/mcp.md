---
title: "MCP pour les agents"
description: "Laissez un agent lire toute l'usine et ne toucher que ce que vous avez armé, par la porte d'écriture, avec le motif de chaque écriture consigné."
---

Le gateway parle MCP dans les deux sens : les agents peuvent lire et piloter l'usine, et une règle d'automatisation peut appeler un outil ailleurs.

La règle de conception est qu'**un agent est un appelant comme un autre**. Les outils lisent par le même cache que l'interface et écrivent par la même porte que l'interface. Il n'y a pas de chemin privilégié, pas de contournement, pas de politique séparée. Une écriture qu'on refuserait à un opérateur est refusée ; une écriture qui aboutit arrive dans la même table d'audit avec `mcp:` devant l'acteur.

## Exposition

### Par HTTP

Activé par défaut sur `/mcp` au port de l'application, protégé par un jeton bearer que le chart génère dans le Secret de la release.

```bash
kubectl -n hotloop get secret <release> \
  -o jsonpath='{.data.mcp-token}' | base64 -d
```

Dans le cluster, le point d'accès est :

```
http://<release>.<namespace>.svc.cluster.local:8080/mcp
```

La vérification du jeton se trouve devant le gestionnaire, donc un appelant non authentifié ne peut même pas énumérer ce qui existe. Laisser `mcp.token` vide fait générer un jeton au chart, le déploiement par défaut n'est pas par accident le déploiement ouvert. Combinez-le avec la NetworkPolicy ; un jeton est une seconde ligne de défense, pas la seule.

Le point d'accès n'est jamais ouvert. Lancez le binaire sans `HOTLOOP_MCP_TOKEN` (une unité Quadlet, un `hotloop` nu) et il crée un jeton à son premier démarrage et le garde dans sa base de données, de sorte que le même revient après un redémarrage, sur chaque réplica et après une restauration. `hotloop mcp-token` l'affiche (le journal dit qu'il en a créé un, et jamais lequel). Définissez `HOTLOOP_MCP_TOKEN` pour choisir le vôtre ; avec `HOTLOOP_MCP_OIDC_*` défini, le point d'accès accepte une connexion et ne garde aucun jeton propre. Un client qui se connectait autrefois à un binaire nu sans rien reçoit maintenant un `401` tant qu'il n'envoie pas `Authorization: Bearer <that token>`.

### Avec une connexion Vord ou une assertion du hub

Le jeton statique dit quel client a appelé ; il ne peut pas dire quelle personne. Avec OIDC défini, `/mcp` accepte aussi `Authorization: Bearer <jwt>`, et l'e-mail de la personne vérifiée devient l'acteur d'audit : une écriture arrive sous la forme `mcp:pat@example.com` au lieu de `mcp:<client name>`. Le comportement sans lui est inchangé, et le jeton statique continue de fonctionner à côté (sans jeton statique défini, seul un JWT vérifié entre).

| Variable | Valeur du chart | Fonction |
|---|---|---|
| `HOTLOOP_MCP_OIDC_ISSUER` | `mcp.oidc.issuer` | l'URL du realm Vord ; accepte ses jetons d'accès |
| `HOTLOOP_MCP_OIDC_AUDIENCE` | `mcp.oidc.audience` | le `aud` que chaque jeton doit porter ; obligatoire avec l'un ou l'autre de ces deux |
| `HOTLOOP_MCP_OIDC_HUB_JWKS_URL` | `mcp.oidc.hubJwksUrl` | les clés d'assertion du hub d'identité ; accepte ses assertions |
| `HOTLOOP_MCP_OIDC_REQUIRED_ROLE` | `mcp.oidc.requiredRole` | un rôle du realm que l'appelant doit détenir |
| `HOTLOOP_MCP_OIDC_WRITE_ROLE` | `mcp.oidc.writeRole` | limite les écritures par appelant, voir plus bas |

Un jeton d'accès Vord est vérifié par rapport au JWKS de l'émetteur (trouvé via son document de découverte, mis en cache dix minutes, rechargé sur un `kid` inconnu) : RS256 ou ES256 uniquement, `iss` égal à l'émetteur, `aud` contenant l'audience, `exp` et `nbf` avec 30 s de tolérance, et une revendication `email` (ou `preferred_username`). Vord ne met par défaut que `account` dans `aud` ; donnez à la portée du client un mappeur d'audience pour l'audience que vous définissez.

Une assertion du hub est `typ` `fb-assert+jwt`, EdDSA, `iss` `fireball-hub`, `aud` l'audience configurée (le module Hub envoie `hotloop`), non expirée, signée par une clé du JWKS du Hub. Il n'y a pas de cache anti-rejeu `jti` : un appel d'outil, ce sont plusieurs requêtes HTTP (initialize, puis l'appel) qui portent la même assertion, laquelle vit 60 s. Quand le Hub dit que l'appel agit pour quelqu'un d'autre (`acting_as`), l'acteur se lit `mcp:<email> for <acting_as email>`.

Les écritures exigent toujours `HOTLOOP_ALLOW_WRITES`, l'interrupteur général ; un jeton ne l'élargit jamais. `HOTLOOP_MCP_OIDC_WRITE_ROLE` les restreint par appelant : `hotloop:hotloop.write` désigne le rôle client Vord `hotloop.write` sur le client `hotloop` (`resource_access.hotloop.roles`), un nom nu désigne un rôle du realm, et une assertion du Hub doit porter le nom du rôle dans `abilities`. Un appelant sans lui peut lire, mais `write_tag`, `call_service`, `run_script`, `apply_recipe`, `trigger_automation` et tout outil qui modifie la configuration refusent. Le jeton statique n'est pas limité par lui.

### Par stdio

Le même binaire sert MCP sur stdin et stdout avec `--mcp-stdio`, pour un client qui le lance directement. Tout le reste démarre aussi, de sorte que l'agent voit une usine vivante et non un serveur creux.

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

En mode stdio, toute la journalisation va sur stderr. Tout ce qui serait écrit sur stdout corromprait le flux du protocole.

## Outils

Cent soixante et onze : vingt-sept qui lisent l'usine et la commandent, soixante-neuf qui modifient sa configuration ([plus bas](#modifier-la-configuration)), trente-trois lectures et simulations qui vont avec ([plus bas](#lectures-et-simulations)) et quarante-deux d'administration ([plus bas](#administration)).

| Outil | Fait |
|---|---|
| `get_plant_status` | appareils en ligne, alarmes en attente, écritures activées ou non |
| `list_devices` | chaque appareil avec protocole, adresse, état, nombre de tags |
| `describe_device` | un appareil en détail, avec ses tags et ses statistiques d'interrogation |
| `list_tags` | recherche dans le catalogue par appareil, nom ou description |
| `read_tag` | valeurs actuelles, avec qualité |
| `query_history` | lectures historiques, brutes ou regroupées |
| `write_tag` | **commande un tag** |
| `list_alarms` | alarmes et leurs états ISA-18.2 |
| `ack_alarm` | acquitte au nom d'un opérateur |
| `list_automations` | règles, nombre d'exécutions, dernier résultat |
| `trigger_automation` | exécute une règle maintenant |
| `describe_protocol` | ce que cette version parle réellement |
| `recent_events` | le journal système, pour reconstituer ce qui s'est passé et dans quel ordre |
| `list_entities` | trouve des entités par domaine, nœud d'équipement ou étiquette, avec les services que chacune accepte |
| `get_states` | état actuel d'une ou plusieurs entités, avec qualité et attributs |
| `call_service` | **commande une entité** : `switch.turn_on`, `number.set_value` |
| `get_logbook` | une seule chronologie des changements d'état, écritures, alarmes, exécutions et changements de configuration, par entité, nœud d'équipement, acteur ou type |
| `list_scripts` | les scripts de l'usine, les champs que chacun prend, s'il tourne, sa dernière exécution |
| `run_script` | **exécute un script**, ou demande avec `dryRun` ce qu'il ferait maintenant |
| `list_recipes` | les recettes de l'usine : cibles dans l'ordre, paramètres, précondition, version, dernière application |
| `validate_recipe` | une recette s'appliquerait-elle maintenant ? toutes les raisons pour lesquelles elle serait refusée ; rien n'est écrit |
| `apply_recipe` | **applique une recette** : vérifiée en entier, écrite dans l'ordre, relue |
| `list_blueprints` | les blueprints que les gens remplissent pour créer des règles, leurs entrées et versions |
| `preview_blueprint` | la règle qu'un blueprint créerait avec des entrées données, et ce qu'elle ferait maintenant ; ne crée rien |
| `find_network_client` | où se trouve un appareil sur le réseau de l'usine : son port de switch, si le port a une liaison, quand la console UniFi l'a vu pour la dernière fois |
| `get_network_topology` | le réseau de l'usine tel que le dessine la console UniFi : ce qui est branché sur quoi, l'état de chaque appareil, et les appareils HotLoop qui perdent leur réseau s'il tombe |
| `get_network_events` | les événements les plus récents rapportés par une console UniFi, et si son websocket d'événements est actif |

### Entités

Une entité est ce que les gens appellent une chose de l'usine, `sensor.zone_1_temperature` ou `switch.conveyor_run`, qui enveloppe un ou plusieurs tags. Voir [Entités](/fr/iot/entities/). Pour un agent, ce sont généralement la meilleure prise : le nom veut dire quelque chose, et l'entité sait ce qu'on peut lui faire.

`list_entities` filtre par `domain`, par `equipment` (un nœud de l'arbre des équipements par id, nom ou chemin de noms comme `Plant A/Packing`, qui correspond à tout ce qui s'y trouve ou en dessous, la place propre d'une entité l'emportant sur celle de son appareil), par `label` (label_id ou nom ; une entité correspond si elle porte l'étiquette ou si son appareil la porte) et par `query`, une sous-chaîne de l'entity_id ou du nom. Chaque résultat porte son état actuel et sa qualité et les services qu'elle accepte, sous la forme `domain.service`. Une entité sans services est en lecture seule. Les services viennent de la couche d'entités, donc un domaine qui en gagne un là-bas apparaît ici sans aucun changement.

`get_states` prend `entity_ids` et répond pour chacune avec son état, sa qualité, ses attributs et `last_changed`. Il tient la même ligne que `read_tag` : un état `unknown` ou `unavailable` reçoit une note disant que ce n'est pas une valeur, une entité désactivée dit qu'elle est désactivée plutôt que manquante, et une mauvaise qualité est détaillée.

`call_service` prend `domain`, `service`, `entity_id`, `data` et un `reason` **obligatoire** :

```
> call_service domain=number service=set_value entity_id=number.press_01_sp
    data={"value": 212.5} reason="operator asked for 212.5 on zone 1"
Called number.set_value on number.press_01_sp (was 210). Writes: 212.5 to press-01/Setpoint: written
```

Il passe par `entity.Services`, le même exécuteur que `POST /api/services/...`, qui transforme l'appel en écritures par la porte d'écriture. Voir [Écriture](#écriture).

### Le réseau

`find_network_client` répond à la première question sur un PLC devenu muet : est-ce le PLC, ou son port de switch ? Donnez-lui `deviceId` et il suit la liaison confirmée de cet appareil jusqu'à son client UniFi ; donnez-lui `query` (une MAC, une IP ou une partie de nom) et il cherche dans chaque console que HotLoop lit. Il lit la dernière lecture du driver UniFi, jamais la console, donc un agent qui interroge en boucle ne coûte rien à la console. Cela signifie aussi qu'un assistant `--mcp-stdio` répond qu'aucune console n'est lue dans son processus : il ne se connecte jamais à une, parce que le Gateway à côté tient déjà la session. Interrogez le point d'accès du Gateway. Voir [UniFi Network](/fr/iot/unifi/).

`get_network_topology` est la carte : chaque switch, point d'accès et gateway sous celui sur lequel il est branché, avec le port aux deux extrémités, la liaison, combien de clients s'y trouvent et les appareils HotLoop liés à un client situé en dessous. Cette dernière partie est le rayon d'impact : elle nomme les PLC qui perdent leur réseau si ce switch tombe. Un switch que la console liste comme branché sur rien le dit et n'est pas accroché au gateway. `get_network_events` donne les événements les plus récents de la console, du plus récent au plus ancien, avec sa propre phrase, un drapeau d'avertissement quand la console le juge négatif, et si le websocket d'événements est actif. Les deux prennent le `deviceId` de la console, qu'on peut omettre quand HotLoop n'en lit qu'une, et les deux lisent la dernière lecture du driver comme `find_network_client`, donc ils ne coûtent rien à la console et disent la même chose dans un assistant `--mcp-stdio` : aucune console n'est lue dans ce processus. Les événements plus anciens sont dans `get_logbook`, classés sous le switch ou le point d'accès concerné.

### Le journal de bord

`get_logbook` est la chronologie que sert `GET /api/logbook` (voir [Le journal de bord](/fr/iot/logbook/)) : changements d'état, écritures, transitions d'alarme, exécutions d'automatisations et changements de configuration, du plus récent au plus ancien. Il se restreint par `entity`, par `equipment` (id, nom ou chemin, et tout ce qui est en dessous ; un nom qui correspond à deux nœuds est une erreur qui liste les deux), par `actor` (une partie : `mcp:` trouve tout ce qu'a fait n'importe quel agent), par `kinds`, et par `minutes` en arrière (par défaut un jour). Une page qui en a d'autres derrière elle se termine en disant quoi passer comme `before` pour la suivante. Pour « que s'est-il passé avant que ça tourne mal », c'est le meilleur `recent_events` : les propres changements d'état de l'équipement y sont, et les lignes de la porte d'écriture n'y sont pas deux fois.

### Scripts

Un script est une séquence nommée d'étapes que quelqu'un a écrite une fois, le cycle CIP ou la purge de ligne, de sorte qu'un agent exécute la procédure propre de l'usine au lieu d'en inventer une. Voir [Scripts](/fr/iot/scripts/). `list_scripts` dit ce que chacun prend. `run_script` prend `scriptId`, `fields`, un `reason` **obligatoire**, et deux interrupteurs :

- `dryRun: true` parcourt le script face à l'usine telle qu'elle est et dit, étape par étape, ce qui serait écrit et la première chose que la porte refuserait, dans les mots de la porte. Rien n'est écrit ni audité. Demandez ceci d'abord.
- `wait: true` répond une fois l'exécution terminée, avec son résultat et sa trace. Sans lui la réponse est l'id d'exécution, et `list_scripts` ou `get_logbook` avec `kinds: ["script"]` dit comment elle s'est terminée.

L'exécution est celle du script, sous la forme `script:<id>`, avec la source `mcp`, de sorte que chaque écriture qu'elle fait rencontre la porte exactement comme `write_tag`. Avec les écritures désactivées (`HOTLOOP_ALLOW_WRITES`), `run_script` refuse avant que quoi que ce soit s'exécute, comme `trigger_automation` ; une simulation reçoit quand même une réponse, qui dit que l'interrupteur en est la raison.

### Recettes

Une recette est un ensemble de consignes que l'usine applique ensemble, une qualité de produit ou un changement de série, de sorte qu'un agent charge les chiffres propres de l'usine au lieu de les écrire un par un. Voir [Recettes](/fr/iot/recipes/). `list_recipes` montre les cibles de chacune dans l'ordre et les paramètres qu'elle prend. `validate_recipe` demande si une recette s'appliquerait maintenant et donne toutes les raisons pour lesquelles non, sans rien écrire. `apply_recipe` prend `recipeId`, `params`, un `version` facultatif et un `reason` **obligatoire**.

Elle est d'abord vérifiée en entier et refusée en entier, sans rien écrire, si une valeur devait être refusée ; les valeurs hors plage sont refusées, jamais ajustées. Ensuite les cibles partent dans l'ordre sous un seul id d'appel, la première qui échoue arrête les suivantes, et rien n'est annulé. La réponse dit, cible par cible, ce qui est parti et si l'appareil a relu la valeur. Les écritures sont celles de l'agent, avec la source `mcp`, donc la porte s'applique à chacune ; avec les écritures désactivées (`HOTLOOP_ALLOW_WRITES`), `apply_recipe` refuse avant de vérifier quoi que ce soit. Une recette qui nomme sa propre permission d'application est destinée aux personnes à qui elle est accordée, et un agent n'en fait pas partie.

### Blueprints

Un blueprint est une règle écrite une fois avec des blancs typés : quel moteur, combien de temps, quelle limite. Voir [Blueprints](/fr/iot/blueprints/). `list_blueprints` dit ce que chacun prend. `preview_blueprint` prend `blueprintId`, `automationId` et `inputs`, et répond avec la règle qu'il créerait et ce que cette règle ferait si elle se déclenchait maintenant, chaque écriture soumise aux contrôles de la porte. Les entrées sont vérifiées exactement comme les vérifie l'écran : hors plage est refusé, pas ajusté.

`instantiate_blueprint` crée la règle, par la route qu'utilise l'écran Blueprints : les mêmes contrôles, et la règle arrive dans le journal de bord avec l'agent comme auteur. Une règle est un ordre permanent de commander des équipements chaque fois que son déclencheur se produit, donc un agent regarde d'abord : `preview_blueprint` ne stocke rien et n'écrit rien, et reçoit une réponse que les écritures soient activées ou non. Chaque écriture que la règle créée fait ensuite rencontre la porte d'écriture, comme pour une règle créée par une personne. Voir [Modifier la configuration](#modifier-la-configuration).

## Modifier la configuration

Tout ce qu'un agent peut lire, il peut le modifier. Les outils ci-dessus qui lisent l'usine ont des pendants qui la modifient, soixante-neuf, et aucun n'est une seconde implémentation : chacun est une route de l'API REST, et un appel passe par le gestionnaire propre à cette route. La validation, le contrôle des permissions, le rechargement du runtime et la ligne d'audit sont ceux de la route, avec l'agent comme acteur (`mcp:<client>`, ou `mcp:<email>` avec une connexion Vord), de sorte qu'un appareil sans driver, une règle qui ne compile pas, une entrée de blueprint hors plage ou un tag pour lequel l'appareil découvert n'a pas été accepté sont refusés dans les mots qu'affiche l'écran, et rien n'a été modifié.

Chacun prend les valeurs de chemin de la route par nom (`id`, `device`, `name`...), `body`, le même JSON que prend l'API ([L'API HTTP](/fr/iot/api/) donne chaque body), et un `reason` **obligatoire**. Le motif est consigné comme une ligne `config` dans le journal système à côté de celle de la route, au regard de ce qui a changé.

```
> save_tag reason="the setpoint, writable between 0 and 100" body={"deviceId":"press-01",
    "name":"Setpoint","address":"holding:5:uint16","dataType":"int16","enabled":true,
    "writable":true,"hasRange":true,"minValue":0,"maxValue":100}
save_tag done.
{ ...the tag as stored... }
```

Ce qui se tient devant eux est ce qui se tient devant `write_tag`, moins l'interrupteur général, parce que les écrans n'en ont pas besoin non plus pour modifier la configuration :

1. `HOTLOOP_ALLOW_MCP_WRITES`, activé par défaut, doit être activé.
2. Un appelant pour lequel `HOTLOOP_MCP_OIDC_WRITE_ROLE` est défini doit le détenir.
3. L'appel porte une permission, celle que demande sa route (la troisième colonne ci-dessous), et rien d'autre. Une route répond à un agent comme elle répond à une personne sans cette permission, et un test oblige chaque ligne du tableau à correspondre à une vraie route et à la permission que cette route demande.
4. Un motif.

Commander des équipements reste `write_tag`, `call_service`, `run_script`, `apply_recipe` et `trigger_automation`, avec `HOTLOOP_ALLOW_WRITES` activé et la marque d'inscriptible et la plage du tag à respecter. Rendre un tag inscriptible, créer une règle, un script ou une recette, c'est de la configuration : cela ne commande rien tant que ce n'est pas utilisé, et ce que cela commande alors passe par la porte.

Les fonctions propres de l'administrateur sont aussi des outils, sous [Administration](#administration) plus bas. Accepter un appareil découvert est ici, comme sur l'écran ; les points qu'il contient doivent encore être armés pour l'écriture un par un.

Les outils existent aussi dans `--mcp-stdio` : le processus construit le même serveur d'API, et n'ouvre jamais son port.

**Appareils et tags**

| Outil | Route | Permission |
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

**Découverte et brokers**

| Outil | Route | Permission |
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

| Outil | Route | Permission |
|---|---|---|
| `mark_unifi_network_ot` | `PUT /api/unifi/{id}/networks/{network}` | `devices.write` |
| `accept_unifi_known_device` | `PUT /api/unifi/{id}/networks/{network}/known/{mac}` | `devices.write` |
| `forget_unifi_known_device` | `DELETE /api/unifi/{id}/networks/{network}/known/{mac}` | `devices.write` |
| `accept_all_unifi_known_devices` | `POST /api/unifi/{id}/networks/{network}/accept-all` | `devices.write` |
| `create_unifi_starter_alarms` | `POST /api/unifi/{id}/starter-alarms` | `alarms.write` |

**Entités, helpers, équipements, étiquettes**

| Outil | Route | Permission |
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

**Alarmes**

| Outil | Route | Permission |
|---|---|---|
| `save_alarm` | `POST /api/alarms` | `alarms.write` |
| `delete_alarm` | `DELETE /api/alarms/{id}` | `alarms.write` |
| `shelve_alarm` | `POST /api/alarms/{id}/shelve` | `alarms.ack` |
| `unshelve_alarm` | `POST /api/alarms/{id}/unshelve` | `alarms.ack` |

**Automatisations et blueprints**

| Outil | Route | Permission |
|---|---|---|
| `save_automation` | `POST /api/automations` | `automations.write` |
| `delete_automation` | `DELETE /api/automations/{id}` | `automations.write` |
| `set_automation_enabled` | `POST /api/automations/{id}/enabled` | `automations.write` |
| `upgrade_blueprint_automation` | `POST /api/automations/{id}/blueprint-upgrade` | `blueprints.apply` |
| `instantiate_blueprint` | `POST /api/blueprints/{id}/instantiate` | `blueprints.apply` |
| `create_blueprint` | `POST /api/blueprints` | `blueprints.write` |
| `update_blueprint` | `PUT /api/blueprints/{id}` | `blueprints.write` |
| `delete_blueprint` | `DELETE /api/blueprints/{id}` | `blueprints.write` |

**Scripts et recettes**

| Outil | Route | Permission |
|---|---|---|
| `create_script` | `POST /api/scripts` | `scripts.write` |
| `update_script` | `PUT /api/scripts/{id}` | `scripts.write` |
| `delete_script` | `DELETE /api/scripts/{id}` | `scripts.write` |
| `stop_script` | `POST /api/scripts/{id}/stop` | `scripts.run` |
| `create_recipe` | `POST /api/recipes` | `recipes.write` |
| `capture_recipe` | `POST /api/recipes/capture` | `recipes.write` |
| `update_recipe` | `PUT /api/recipes/{id}` | `recipes.write` |
| `delete_recipe` | `DELETE /api/recipes/{id}` | `recipes.write` |

**Tableaux de bord et le board**

| Outil | Route | Permission |
|---|---|---|
| `create_dashboard` | `POST /api/dashboards` | `dashboards.write` |
| `update_dashboard` | `PUT /api/dashboards/{id}` | `dashboards.write` |
| `delete_dashboard` | `DELETE /api/dashboards/{id}` | `dashboards.write` |
| `save_board` | `PUT /api/board` | `board.write` |

**Imports**

| Outil | Route | Permission |
|---|---|---|
| `import_codesys_alarms` | `POST /api/alarms/import/codesys` | `alarms.write` |
| `screen_import` | `POST /api/dashboards/import` | `dashboards.write` |

`import_codesys_alarms` prend le fichier qu'a écrit Export Alarms de l'IDE CODESYS, sous la forme `contentBase64` (les octets tels qu'ils sont sur le disque, que l'IDE écrit en UTF-16) ou `content` (le texte, si vous l'avez en texte), avec le `deviceId` auquel appartiennent les alarmes et, si vous les voulez, `application` et `defaultPriority`. Laissé tel quel, il ne fait qu'un aperçu : il dit quelles alarmes passeraient et lesquelles non, n'enregistre rien et n'a pas besoin de motif. Avec `apply` true, il les enregistre comme définitions d'alarme, et il lui faut alors un motif et l'interrupteur d'écriture MCP comme à tout outil qui modifie la configuration.

`screen_export` répond un tableau de bord sous forme de fichier d'écran HotLoop ([Fichiers d'écran](/fr/iot/screen-file/)), et `screen_import` en reçoit un, sur cette installation ou une autre. Il demande d'abord : `dryRun` vaut true sauf si vous dites false, et une simulation n'enregistre rien et répond par le rapport avec chaque problème listé et les références à `remap`. Un vrai import exige `dryRun` false, un motif et l'interrupteur d'écriture MCP, et un id qui existe est refusé sauf si `replace` vaut true. L'écran est la donnée du client, donc le fichier est la façon dont il circule d'une installation à l'autre, jamais du code.

### Lectures et simulations

Un agent qui peut modifier un tableau de bord, un broker ou un nœud de l'arbre des équipements doit d'abord pouvoir lire ce qui s'y trouve, donc chaque objet qu'un outil ci-dessus modifie a ici une lecture, et les simulations des éditeurs sont aussi des outils. Chacune est une route exécutée par son propre gestionnaire avec la permission de lecture que cette route demande. Une lecture répond sans motif et sans l'interrupteur d'écriture, et un appelant que le rôle d'écriture exclut peut tout de même les faire, parce qu'elles portent une permission de lecture et rien de plus. Les trois simulations (`validate_automation`, `validate_script` et `browse_device`) ne changent rien ; les deux qui vérifient un corps portent la permission d'écriture que demande leur route, donc elles restent derrière le rôle d'écriture.

| Outil | Route | Permission |
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

### Administration

Les comptes utilisateur, les paramètres, les sauvegardes, la politique d'escalade, les cibles d'historien, les identifiants de broker, la flotte de relais edge et les rapports planifiés sont ceux de l'administrateur, et ce sont aussi des outils : quarante-deux, sur le même modèle que les autres. Chacun est une route exécutée par son propre gestionnaire avec la permission que cette route demande (`users.manage`, `settings.write`, `backup.run`, `fleet.restart`...), un motif pour chaque changement et l'agent dans la ligne d'audit. Une route qui refuse refuse un agent dans les mêmes mots. Les lectures (les outils `list_` et `get_`) n'ont besoin ni de motif ni d'interrupteur d'écriture, et exigent encore le rôle d'écriture de l'appelant quand il y en a un, parce que la permission qu'elles portent est celle d'un administrateur. Les outils de flotte et de rapports n'existent que dans un produit qui a cette fonction.

Deux choses sont propres aux routes et valent d'être connues avant de se fier à un outil :

- **Les interrupteurs d'écriture n'ont pas de route.** `safety.allowWrites` et `safety.allowMcpWrites` sont ceux du déploiement (`HOTLOOP_ALLOW_WRITES`, `HOTLOOP_ALLOW_MCP_WRITES`), et `PUT /api/settings` les refuse comme définis par le déploiement. Donc `save_settings` modifie ce que l'écran Paramètres peut modifier et répond ce refus pour les interrupteurs, dans ces mots. Un agent ne peut pas activer l'interrupteur dont dépendent ses propres écritures.
- **Le mot de passe d'un utilisateur passe par l'appel.** `create_user`, `reset_user_password` et les outils de PIN prennent un secret dans leurs arguments, comme l'API. La ligne d'audit nomme le changement et le motif et jamais le secret.

**Comptes utilisateur**

| Outil | Route | Permission |
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

**Paramètres, sauvegardes, notifications**

| Outil | Route | Permission |
|---|---|---|
| `get_settings` | `GET /api/settings` | `settings.read` |
| `save_settings` | `PUT /api/settings` | `settings.write` |
| `list_backups` | `GET /api/backup` | `backup.read` |
| `run_backup` | `POST /api/backup` | `backup.run` |
| `get_escalation` | `GET /api/notify/escalation` | `notify.escalation` |
| `save_escalation` | `PUT /api/notify/escalation` | `notify.escalation` |
| `send_test_notification` | `POST /api/notify/test` | `notify.test` |

**Cibles d'historien et identifiants de broker**

| Outil | Route | Permission |
|---|---|---|
| `list_historian_targets` | `GET /api/historian/targets` | `settings.read` |
| `create_historian_target` | `POST /api/historian/targets` | `settings.write` |
| `update_historian_target` | `PUT /api/historian/targets/{id}` | `settings.write` |
| `delete_historian_target` | `DELETE /api/historian/targets/{id}` | `settings.write` |
| `list_broker_logins` | `GET /api/broker/logins` | `users.manage` |
| `create_broker_login` | `POST /api/broker/logins` | `users.manage` |
| `update_broker_login` | `PUT /api/broker/logins/{name}` | `users.manage` |
| `delete_broker_login` | `DELETE /api/broker/logins/{name}` | `users.manage` |

**La flotte de relais edge (Gateway)**

| Outil | Route | Permission |
|---|---|---|
| `list_fleet` | `GET /api/fleet` | `fleet.read` |
| `register_relay` | `POST /api/fleet` | `fleet.write` |
| `delete_relay` | `DELETE /api/fleet/{id}` | `fleet.write` |
| `rebirth_relay` | `POST /api/fleet/{id}/rebirth` | `fleet.rebirth` |
| `restart_relay` | `POST /api/fleet/{id}/restart` | `fleet.restart` |
| `update_relay` | `POST /api/fleet/{id}/update` | `fleet.update` |
| `set_relay_config` | `POST /api/fleet/{id}/config` | `fleet.config` |
| `clear_relay_config` | `DELETE /api/fleet/{id}/config` | `fleet.config` |

**Rapports planifiés (Gateway)**

| Outil | Route | Permission |
|---|---|---|
| `list_reports` | `GET /api/reports` | `reports.read` |
| `get_report` | `GET /api/reports/{id}` | `reports.read` |
| `create_report` | `POST /api/reports` | `reports.write` |
| `update_report` | `PUT /api/reports/{id}` | `reports.write` |
| `delete_report` | `DELETE /api/reports/{id}` | `reports.write` |
| `run_report` | `POST /api/reports/{id}/run` | `reports.run` |

## Ressources

| URI | Contenu |
|---|---|
| `iiot://devices` | l'arbre des appareils avec leurs tags, en JSON |
| `iiot://tags` | le catalogue de tags avec les valeurs actuelles |
| `iiot://alarms` | définitions d'alarme, état en direct et une référence des états |
| `iiot://protocols` | protocoles pris en charge, d'après les drivers compilés |

Les ressources existent pour qu'un client puisse récupérer tout l'espace de noms en une seule lecture plutôt que de le découvrir un appel d'outil à la fois.

## Ce que les outils ne feront pas

Les outils sont écrits pour qu'un modèle ne puisse pas arrondir l'incertitude par accident.

**Un tag sans lecture n'est pas un tag qui lit zéro.** `read_tag` dit `no reading has been taken for this tag yet`, ou `this tag is not configured` s'il n'existe pas. Aucun ne renvoie de valeur.

**La mauvaise qualité est énoncée, pas suggérée.** Les lectures reviennent sous la forme `[quality: bad (the value is NOT known; do not treat it as a measurement)]`. Les instructions du serveur le répètent. Ne faites pas de moyenne sur des lectures mauvaises et n'en rapportez pas une comme une mesure.

**`describe_protocol` ne peut pas mentir.** La disponibilité vient des drivers compilés dans le binaire, donc l'outil ne peut pas revendiquer un protocole que le gateway n'a pas.

**Un refus est une réponse, pas une panne de transport.** Une écriture refusée revient comme résultat d'outil avec `isError`, ce qui signifie que l'appel était bien formé et délibérément refusé. Ce n'est pas une erreur de protocole à retenter.

## Écriture

MCP lit et écrit : il commande des équipements, et il modifie la configuration ([ci-dessus](#modifier-la-configuration)). `write_tag` déplace de vrais équipements, donc les mêmes choses se dressent entre un appel d'outil et une machine que celles qui se dressent entre le clic d'un opérateur et une machine :

1. `HOTLOOP_ALLOW_WRITES`, l'interrupteur général de tout le déploiement, doit être activé. Désactivé, rien n'écrit : ni l'interface, ni l'API, ni un agent.
2. Le tag doit être marqué inscriptible. Les tags sont en lecture seule tant que quelqu'un ne dit pas autrement, un par un.
3. La valeur doit être dans la plage configurée du tag. Elle est **rejetée, pas bornée** : envoyer 400 quand on a demandé 500, c'est faire discrètement autre chose que ce qui était demandé.

Un **motif est exigé** et il est consigné à côté de l'écriture. Une ligne d'audit que personne ne sait interpréter six mois plus tard ne vaut guère mieux que rien.

`call_service` reçoit exactement les mêmes trois, parce qu'il n'est que des écritures par la même porte, puis les contrôles propres de l'entité par-dessus (le pas et la plage plus étroite d'un nombre, le motif d'un texte, l'entité non désactivée). Un refus à l'un d'eux est audité contre l'entité autant que contre le tag : source `mcp`, le client par son nom, l'entity_id, le service et l'id d'appel, la même ligne que laisse un `write_tag` refusé plus l'entité. Un appel sans motif est refusé avant que rien soit tenté, comme `write_tag`.

`trigger_automation` est soumis à la même porte, parce que les actions d'une règle peuvent commander des équipements ; sinon ce serait un moyen de contourner les contrôles que rencontre `write_tag`.

```
> write_tag tag=press-01/Zone1_Temp value=99 reason="testing"
write refused: press-01/Zone1_Temp: this tag is not marked writable
```

Quand les écritures sont désactivées, les instructions du serveur le disent d'emblée, pour qu'un agent ne perde pas un tour à le découvrir.

## Appeler vers l'extérieur

L'action `mcp_call` d'une automatisation invoque un outil sur un autre serveur MCP. Configurez les serveurs dans le chart :

```yaml
mcp:
  outboundServers:
    - name: maintenance
      url: http://maintenance-mcp.default.svc.cluster.local:8080/mcp
      existingSecret: maintenance-mcp-token
      secretKey: token
```

Les sessions sont mises en pool et réutilisées ; se connecter à chaque appel supposerait un handshake, un initialize et une liste d'outils chaque fois qu'une règle se déclenche. Une session morte est reconnectée à l'appel suivant plutôt que sur un minuteur, parce que l'appel suivant est le premier moment où quelqu'un s'en soucie. Un serveur configuré qui est en panne n'empêche pas l'usine d'être surveillée, rien n'est appelé tant qu'une règle n'en a pas besoin.

L'écran MCP montre chaque serveur configuré, s'il est connecté et les outils qu'il annonce.

## Fédérer des sites

Un gateway par usine est la manière dont cela est censé fonctionner. Chaque site garde sa propre base de données, son propre board et son propre nom, et aucun ne dépend du maintien d'une liaison vers ailleurs, une usine ne cesse pas d'être surveillée parce que le WAN est tombé.

Les voir tous à la fois utilise le protocole que les sites parlent déjà. Configurez un gateway dans le cloud avec les sites comme serveurs MCP sortants, exactement comme pour l'action `mcp_call` :

```
HOTLOOP_MCP_SERVER_1_NAME=akron
HOTLOOP_MCP_SERVER_1_URL=https://akron.example/mcp
HOTLOOP_MCP_SERVER_1_TOKEN=…
HOTLOOP_MCP_SERVER_2_NAME=ashtabula
HOTLOOP_MCP_SERVER_2_URL=https://ashtabula.example/mcp
HOTLOOP_MCP_SERVER_2_TOKEN=…
```

L'écran Sites appelle alors `get_plant_status` sur chacun en parallèle et consolide les réponses. Il n'y a rien à déployer sur un site pour qu'il apparaisse, aucun site n'a besoin de savoir qu'il est fédéré, et rien ne se connecte vers l'intérieur d'un réseau d'usine.

Deux comportements sont délibérés et on peut s'y fier :

- Un site qui ne répond pas est affiché comme **injoignable, avec le motif**, et est laissé hors de la consolidation. Compter une usine qu'on ne peut pas joindre comme zéro alarme serait la pire chose que pourrait faire un écran comme celui-ci.
- Les chiffres qu'un site a rapportés en dernier ne sont jamais affichés. Ils semblent actuels et ne le sont pas.

Chaque site a sa propre courte échéance, de sorte qu'une usine sur une liaison morte ne peut pas retenir celles qui fonctionnent.

## Ce qui vaut d'être dit à un agent

Les instructions propres du serveur couvrent cela, mais pour qui écrit un prompt autour :

- Les états d'alarme suivent l'ISA-18.2. `rtn-unack` signifie une alarme qui s'est dissipée d'elle-même avant que quiconque la voie, elle mérite toujours d'être signalée, et c'est l'état qui prouve que l'acquittement et le retour à la normale sont indépendants.
- `query_history` avec regroupements, pas en brut, pour tout ce qui dépasse quelques minutes. Un jour de données à la seconde fait 86 400 points par tag. Les regroupements suivent la règle de qualité : les lectures mauvaises et incertaines sont comptées dans `badReadings`, jamais moyennées, et un regroupement sans rien de bon a une moyenne nulle.
- `recent_events` est la manière de reconstituer un incident : connexions d'appareils, écritures, transitions d'alarme, exécutions d'automatisations et changements de configuration, dans l'ordre, chacun avec l'acteur qui l'a causé.
