---
title: "Entités"
description: "Le registre d'entités sur lequel reposent automatisations, assistants, scripts et écrans : des ids fixes, des domaines, des services et l'API qui les lit."
---

Le registre d'entités et le moteur qui calcule leur état sont le socle sur lequel reposent toutes les automatisations, tous les assistants, scripts et écrans de HotLoop.

## Pourquoi des entités, alors que nous avons déjà des tags

Un tag, c'est ce dont parle un driver : un registre de maintien, un NodeId, un décalage de DB S7. Il est identifié par l'appareil et le nom du tag, il ne peut pas être renommé, et il désigne exactement un point sur un fil.

Une entité, c'est ce dont parlent les personnes et les règles : « la température de la zone 1 », « l'interrupteur de marche du convoyeur ». Elle a son propre nom stable (`sensor.zone_1_temperature`), un type qui dit comment l'afficher et ce qu'on peut en faire, et un ensemble de liaisons vers les tags dont elle est faite.

Les entités enveloppent les tags. Elles ne les remplacent pas, et rien n'a changé dans les tags pour leur faire de la place. Il n'y a pas de second pipeline de valeurs ni de second historien : l'état d'une entité est calculé à partir du même cache en direct que lisent déjà `/api/values`, le moteur d'alarmes et le serveur OPC UA. Tous les endpoints de tags existants, le tableau, `/api/write`, les outils MCP et les règles d'automatisation qui existaient avant les entités se comportent exactement comme avant ; les entités s'ajoutent à côté, pas à leur place.

## Ce que vous obtenez sans rien faire

Chaque tag reçoit automatiquement une **entité de lecture** :

| Type de données du tag | Domaine de l'entité de lecture |
|---|---|
| `bool`, `boolean`, `bit`, `coil`, `discrete` | `binary_sensor` |
| tout le reste | `sensor` |

La première fois qu'un tag devient inscriptible, il reçoit aussi une **entité de commande** :

| Type de données du tag | Domaine de l'entité de commande |
|---|---|
| famille bool | `switch` |
| familles int et float | `number` |
| `string`, `text`, `char` | `text` |

Une entité de commande n'est jamais supprimée parce que son tag a été désarmé. La porte d'écriture refuse les écritures vers un tag désarmé comme elle l'a toujours fait, et l'attribut `armed` de l'entité passe à `false` pour qu'un écran puisse griser la commande. Garder l'entité est le but : une automatisation ou un tableau de bord qui nomme `switch.press_01_pump` ne doit pas se casser parce que quelqu'un a désarmé la pompe pour une équipe.

Les tags existants reçoivent leurs entités dans la mise à jour elle-même : la migration `0005_entities.sql` crée une entité de lecture pour chaque tag et une entité de commande pour chaque tag déjà inscriptible, dans la même transaction que celle qui crée les tables. Soit chaque tag a son entité quand la nouvelle version traite sa première requête, soit rien n'a changé.

Chaque définition d'alarme reçoit elle aussi une **entité d'alarme**, de la même façon : voir [Entités d'alarme](#entités-dalarme).

Commander une entité de commande (allumer un interrupteur, fixer un nombre) est un appel de service, et un appel de service est une série d'écritures de tags via `runtime.Manager.Write` et la porte d'écriture, comme toute autre écriture. Il n'y a pas d'autre porte. Voir [Services](#services).

Un équipement qui est plus d'un tag (une pompe avec une commande de marche, un contact de marche et un défaut ; une vanne avec ses fins de course ; une boucle PID) est un **composite** que vous construisez exprès à partir des tags dont il est fait. Voir [Équipements composites](#équipements-composites).

## ID d'entité

Un `entity_id` s'écrit `<domain>.<object_id>` : lettres minuscules, chiffres et tirets bas, 255 caractères au plus. L'ID automatique d'un tag est `<domain>.<device>_<tag>`, où les deux moitiés sont mises en minuscules et où chaque suite de caractères qui ne sont pas une lettre ou un chiffre ASCII devient un seul tiret bas :

| Appareil | Tag | Entité de lecture |
|---|---|---|
| `press-01` | `Zone1_Temp` | `sensor.press_01_zone1_temp` |
| `Line.A-2` | `Motor/Speed.PV` | `sensor.line_a_2_motor_speed_pv` |
| `press-01` | `温度` | `sensor.press_01_tag` |

Deux tags qui donnent le même résultat reçoivent `_2`, `_3` et ainsi de suite, dans l'ordre où ils ont été enregistrés. Un nom trop long pour 255 caractères est coupé avant le suffixe, jamais à travers lui.

**Un `entity_id` est généré une fois, stocké, et jamais régénéré.** Changer la description d'un tag, son type de données, le déplacer vers un autre registre : rien de tout cela ne touche l'entity_id. La seule chose qui le change est un renommage explicite via `PUT /api/entities/{entity_id}`, qui est une action d'administrateur et figure dans le journal système (catégorie `config`, sujet le nouvel id, l'ancien id dans le message et dans le détail).

Un renommage conserve le domaine. L'identité d'une entité, c'est son `id` en base et son `unique_id`, et aucun des deux ne bouge jamais :

| Entité | `unique_id` |
|---|---|
| l'entité de lecture d'un tag | `tag:<device>/<tag>` |
| l'entité de commande d'un tag | `tag-control:<device>/<tag>` |
| une entité d'alarme | `alarm:<definition id>` |
| un composite | `composite:<32 random hex digits>` |

Les trois premiers sont dérivés de ce que l'entité enveloppe, ce qui permet à un tag ou à une définition d'alarme supprimé puis revenu de récupérer son entité. Un composite n'a rien de tel dont dériver : deux pompes identiques sur un même automate sont liées à des tags différents, et les mêmes tags peuvent exprès servir à deux composites. Son `unique_id` est donc aléatoire, créé une seule fois à sa création. Il ne peut jamais coïncider avec celui d'une autre entité, y compris celui d'un composite supprimé puis reconstruit, qui est une nouvelle entité, et c'est normal.

## Tags supprimés, orphelines et réadoption

Si vous supprimez un tag, ses entités deviennent **orphelines**, elles ne sont pas supprimées : `orphaned_at` est renseigné et l'état passe à `unavailable`. Si le même tag revient, par l'éditeur de tags ou par une réimportation de l'explorateur, le registre retrouve l'orpheline par `unique_id` et la réadopte. Son entity_id, son nom, sa classe d'appareil, son icône et toutes les autres personnalisations reviennent avec elle.

C'est voulu. Dans une usine, un tag est supprimé et réimporté bien plus souvent que quelqu'un ne veut dire « oublie tout de ce point », et une automatisation qui nomme `sensor.oven_temperature` doit continuer à fonctionner malgré cela.

Supprimer un appareil entier est différent : ses entités partent avec lui, comme ses tags. Cela inclut un composite dont tous les tags sont sur cet appareil. Un composite qui s'étend sur plusieurs appareils n'appartient à aucun, et ne perd que son état quand l'un d'eux disparaît.

Les entités d'alarme suivent leurs définitions d'alarme selon les mêmes règles : supprimez la définition et son entité devient orpheline, enregistrez une définition avec le même id et elle est réadoptée.

Un composite n'est jamais orphelin. Il a été construit exprès, il reste donc jusqu'à ce que quelqu'un le supprime ; tant que l'un de ses tags manque, il est `unavailable`.

`DELETE /api/entities/{entity_id}` supprime un composite ou une orpheline. Il refuse (409) l'entité d'un tag ou d'une définition d'alarme qui a encore ce qu'elle enveloppe, et dit comment elle disparaît : supprimez le tag ou la définition, puis l'orpheline. Supprimer une entité vivante ferait seulement que la synchronisation suivante la remettrait sous un nouvel id, et casserait entre-temps tout ce qui la nomme. Pour la retirer des écrans, masquez-la ou désactivez-la.

## Comment le registre se tient à jour

Le registre ne s'accroche pas à chaque endroit où un tag peut changer. Il réconcilie : il lit chaque tag et chaque entité, crée ce qui manque, met en orpheline ce qui a perdu son tag, réadopte ce qui l'a retrouvé. Une réconciliation ne peut pas manquer un chemin que quelqu'un ajoutera l'an prochain, et la lancer deux fois revient à la lancer une fois. Elle s'exécute :

- au démarrage, ce qui couvre une mise à jour et une restauration depuis une sauvegarde ;
- après chaque rechargement du runtime, que déclenche déjà chaque changement de tag ou d'appareil ;
- de façon synchrone dans les gestionnaires d'API qui modifient les tags (`POST /api/tags`, `DELETE /api/tags/...`, `POST /api/devices/{id}/import`, `DELETE /api/devices/{id}`) et les définitions d'alarme (`POST /api/alarms`, `DELETE /api/alarms/{id}`), de sorte qu'un client qui crée un tag ou une définition et demande aussitôt son entité la trouve.

L'enregistrement est sérialisé entre les réplicas par un verrou consultatif de la base de données, si bien que deux réplicas qui importent le même appareil ne peuvent pas distribuer le même `_2`. Chaque réconciliation qui change quelque chose écrit une seule ligne dans le journal système, pas une par entité : l'import de cinq mille points est un seul événement.

## État

`GET /api/states/{entity_id}` :

```json
{
  "entity_id": "sensor.press_01_zone1_temp",
  "state": "212.5",
  "attributes": {
    "friendly_name": "Zone1_Temp",
    "unit_of_measurement": "F",
    "device_class": "temperature",
    "source": ["press-01/Zone1_Temp"]
  },
  "quality": "good",
  "last_changed": "2026-09-26T14:02:11.482Z",
  "last_updated": "2026-09-26T14:02:11.482Z",
  "last_reported": "2026-09-26T14:07:40.100Z"
}
```

`state` est la valeur affichée sans son unité : un nombre tel que l'affiche `/api/values`, `on` ou `off` pour `binary_sensor` et `switch`, le texte lui-même pour une chaîne. L'unité est un attribut. Un état qui vaut tantôt `212.5` et tantôt `212.5 F` est un état que rien ne peut comparer.

Les règles, dans l'ordre où elles s'appliquent. Ce sont les mêmes que celles du serveur OPC UA pour ses codes d'état, pour la même raison : **un état n'est jamais meilleur que les éléments qui le fondent.**

| Condition | `state` | `quality` |
|---|---|---|
| Entité orpheline, ou son tag a disparu | `unavailable` | `bad` |
| Appareil désactivé, supprimé, ou dont la liaison n'est pas établie | `unavailable` | `bad` |
| Liaison établie, rien de lu encore dans cette session | `unknown` | `bad` |
| Mauvaise lecture | la **dernière bonne valeur**, ou `unknown` s'il n'y en a jamais eu | `bad` |
| Bonne lecture, mais d'autres points de l'appareil échouent (dégradé) | la valeur | `uncertain` |
| Bonne lecture | la valeur | `good` |

La règle de la mauvaise lecture compte plus qu'il n'y paraît. Un driver signale un point qu'il n'a pas pu lire comme une mauvaise lecture de zéro, et afficher ce zéro comme état transforme « le transmetteur de niveau ne répond plus » en « le réservoir est vide ». L'entité continue d'afficher la dernière valeur à laquelle on pouvait se fier et dit, dans `quality`, qu'elle ne peut plus en répondre.

Notez la différence entre un point qui échoue et un appareil qui échoue. Un appareil Modbus dont tous les blocs échouent abandonne sa session et se reconnecte, ses entités passent donc à `unavailable`. Un appareil qui répond pour certains points et pas pour d'autres reste connecté (dégradé), et seules les entités des points en échec affichent `bad`.

**En combien de temps un appareil Modbus mort apparaît.** Un appareil qui refuse ou ferme la connexion est `unavailable` dès son interrogation suivante. Un appareil qui cesse simplement de répondre (un câble débranché, un automate bloqué, un switch qui a redémarré) garde sa socket ouverte et est jugé sur son délai d'attente d'interrogation : ses entités sont `unavailable` en un intervalle d'interrogation plus deux fois le délai d'attente de l'appareil, plus au plus une seconde pour le recalcul de secours du moteur. En général, c'est un délai d'attente ; deux, c'est quand l'appareil meurt en pleine interrogation, car la requête déjà sur le fil reçoit son délai d'attente complet. Jusque-là rien de nouveau n'a été lu, l'entité affiche donc encore sa dernière lecture telle qu'elle était. Un appareil bloqué qui accepte encore les connexions est reconnecté immédiatement, ses entités alternent donc ensuite entre `unavailable` et `unknown` (connecté, rien de lu) jusqu'à ce qu'il réponde de nouveau ; aucun des deux n'est jamais pris pour une valeur. Le délai d'attente est le réglage : un appareil avec un délai de 20 secondes peut sembler normal pendant 20 à 40 secondes après sa panne, ne le réglez donc pas plus long que ce dont l'appareil a besoin pour répondre.

Ce tableau vaut pour les entités d'un seul tag. Un composite est plus strict (une mauvaise lecture ne garde jamais sa dernière valeur, voir [Comment l'état d'un composite est décidé](#comment-létat-dun-composite-est-décidé)), et l'état d'une entité d'alarme est celui du moteur d'alarmes (voir [Entités d'alarme](#entités-dalarme)).

### Horodatages

- `last_changed` ne bouge que lorsque `state` change.
- `last_updated` bouge lorsque `state`, `quality` ou un attribut change.
- `last_reported` est l'horodatage de la lecture dont vient l'état. Il est absent tant qu'il n'y en a pas.

L'état est calculé, pas stocké, mais le journal d'activité garde l'état le plus récent de chaque entité et le moment de son dernier changement (`entity_last_state`, voir [Le journal d'activité](/fr/iot/logbook/)). Après un redémarrage, une entité dont l'état revient identique **garde son `last_changed`** : une pompe en marche depuis mardi dit toujours mardi. Les états unavailable et unknown que traverse l'entité d'un tag pendant que son appareil se reconnecte ne comptent pas comme un changement. Un état qui a bien changé pendant que le Gateway était arrêté reçoit un `last_changed` neuf, et une ligne dans le journal d'activité. Les entités numériques (capteurs, nombres, boucles, compteurs) et les boutons ne sont pas suivis, de sorte que les leurs, comme le `last_updated` de toutes les entités, repartent du redémarrage.

### Attributs

Chaque entité porte `friendly_name` et `source` (les clés de tag auxquelles elle est liée). Puis, quand ils s'appliquent :

| Attribut | Quand |
|---|---|
| `unit_of_measurement` | `sensor` et `number` : l'unité propre de l'entité, ou celle de son tag |
| `device_class`, `state_class`, `icon` | quand ils sont définis sur l'entité |
| `armed` | entités de commande : si le tag est inscriptible à l'instant |
| `min`, `max` | `number` : les options de l'entité, sinon la plage du tag s'il en a une |
| `step` | `number` : l'option de l'entité, sinon 1 pour un tag entier |
| `max_length`, `pattern` | `text` : les options de l'entité, `max_length` valant 255 par défaut |
| `quality_reason` | entités de tag, tant que la lecture n'est pas bonne et que le driver sait pourquoi : `no field at ENERGY.Power`, `payload is not JSON`. Disparaît à la bonne lecture suivante |

### Désactivées et masquées

Une entité **désactivée** n'a aucun état : elle est absente de `/api/states`, et la demander par son id répond qu'elle est désactivée plutôt qu'introuvable. Une entité **masquée** a son état comme d'habitude ; l'indicateur sert aux écrans pour la laisser hors des vues par défaut.

### Comment le moteur fonctionne

Le moteur s'abonne au bus de tags sous le nom `entities` avec une file de 256 lots, le même contrat avec pertes que les moteurs d'alarmes et d'automatisation : un consommateur lent perd des lots, il ne bloque jamais une interrogation. Un lot perdu ici coûte une seconde au plus, car le moteur recalcule aussi toutes les entités depuis le cache une fois par seconde. Ce cycle attrape aussi les changements que rien n'annonce, comme l'arrivée de la première interrogation d'un appareil.

Les abonnés dans le processus s'enregistrent avec `Engine.OnStateChanged`. Ils sont appelés sur la goroutine propre du moteur, dans l'ordre où les changements se sont produits, ce dont a besoin une règle qui s'intéresse à « de X à Y ». Ils doivent être rapides. Le moteur ne les attend jamais ; s'ils prennent plus de 10 000 changements de retard, les plus anciens sont abandonnés et comptés.

`GET /api/diagnostics` le rapporte sous `entities` :

| Champ | Signification |
|---|---|
| `entities` | combien d'entités ont un état |
| `droppedBatches` | lots du bus que le moteur a été trop lent à prendre (aussi sous `bus.droppedPerSubscriber.entities`) |
| `pendingChanges`, `droppedChanges` | la file du crochet de changement d'état. Un retard qui grossit, ou la moindre perte, signifie qu'un crochet est trop lent |

## Classes d'appareil et unités

Une classe d'appareil dit ce qu'est une valeur (`temperature`, `pressure`, `volume_flow_rate`, `running`, `problem`) pour qu'un écran puisse choisir une icône et qu'un consommateur de statistiques sache quoi en faire. Chaque classe a les unités dans lesquelles elle vient d'ordinaire. Le tableau complet est `model.DeviceClasses`.

- Une classe d'appareil inconnue pour le domaine est refusée.
- Une unité que la classe n'a pas d'ordinaire est **enregistrée, avec un avertissement** dans la réponse. Les usines libellent les choses comme les usines libellent les choses, et `degF` sur une température ne vaut pas qu'on bloque un enregistrement. `F` et `C` seuls sont acceptés pour la température sans avertissement, car c'est ce que portent réellement la plupart des bases de tags d'automates.
- `state_class` (`measurement`, `total`, `total_increasing`) ne concerne que les capteurs.
- **Il n'y a pas de conversion d'unités.** L'unité est un libellé.

## API

Les endpoints d'entités utilisent des noms de champs en snake_case (`entity_id`, `last_changed`) plutôt que le camelCase habituel de cette API. C'est voulu : l'API d'entités existe pour que tout ce qui comprend déjà cette forme comprenne celle-ci.

| Endpoint | Autorisation | Rôle |
|---|---|---|
| `GET /api/entities` | `entities.read` | Toutes les entités, orphelines comprises. Filtres : `?domain=`, `?device=`, `?orphaned=true\|false` |
| `GET /api/entities/{entity_id}` | `entities.read` | `{"entity": ..., "state": ...}` ; `state` est null pour une entité désactivée |
| `GET /api/entities/{entity_id}/image` | `entities.read` | la dernière image d'une caméra ou d'une image |
| `PUT /api/entities/{entity_id}` | `entities.write` | Modifie des champs du registre, y compris un renommage. Répond `{"entity": ..., "warnings": [...]}` |
| `POST /api/entities` | `entities.write` | Crée un composite. Répond 201 `{"entity": ..., "warnings": [...]}`. Voir [Équipements composites](#équipements-composites) |
| `DELETE /api/entities/{entity_id}` | `entities.write` | Supprime un composite ou une orpheline. Tout le reste donne 409 |
| `GET /api/states` | `entities.read` | L'état de chaque entité activée, trié par entity_id. Filtre : `?domain=` |
| `GET /api/states/{entity_id}` | `entities.read` | Un état |
| `POST /api/services/{domain}/{service}` | `values.write` (`alarms.ack` pour `alarm`) | Appelle un service sur une entité. Voir [Services](#services). `?dry_run=true` demande ce qu'il ferait au lieu de le faire ; voir [Demander d'abord](#demander-dabord--la-simulation) |
| `GET /api/writes?entity={entity_id}` | `values.read` | Toutes les écritures que des appels de service ont faites ou vu refuser sur une entité, la plus récente d'abord |

Tous les rôles détiennent `entities.read` : l'état d'une entité est la valeur d'un tag sous un autre nom, qu'un lecteur peut déjà lire. Seul l'administrateur détient `entities.write` : l'entity_id est le nom par lequel chaque automatisation, tableau de bord et agent désigne l'entité, et le changer relève de la configuration, pas de l'exploitation.

Un corps `PUT` ne modifie que les champs qu'il nomme. Les champs inconnus sont refusés, ainsi que les champs d'identité (`unique_id`, `domain`, `platform`, l'appareil et les liaisons) :

```json
{
  "entity_id": "sensor.zone_1_temperature",
  "name": "Zone 1 temperature",
  "device_class": "temperature",
  "state_class": "measurement",
  "unit_of_measurement": "°F",
  "icon": "mdi:thermometer",
  "entity_category": "",
  "options": {},
  "disabled": false,
  "hidden": false
}
```

`options` accepte `min`, `max` et `step` sur un `number` (ils restreignent ce qu'un écran propose ; la porte d'écriture vérifie toujours la plage propre du tag) et `max_length` et `pattern` sur un `text`. Les options d'un composite lui sont propres (voir chaque domaine plus bas), et un `PUT` qui les modifie est vérifié contre ses tags exactement comme l'a été la création. `sensor`, `binary_sensor`, `switch` et `alarm` n'en acceptent aucune.

Une entité a aussi une place dans l'arbre des équipements et un ensemble de libellés : `equipment_id` (null pour suivre son appareil), le `area_id` en lecture seule selon lequel les clients regroupent, et `labels`. `PUT` accepte `equipment_id` et `labels` comme n'importe quel autre champ. Voir [l'arbre des équipements et les libellés](/fr/iot/equipment/).

## Services

Un service est ce qu'on peut faire à une entité : `switch.turn_on`, `number.set_value`. Il nomme ce que vous voulez qu'on fasse à l'entité, et dessous il n'y a rien d'autre que des écritures de tags.

```
POST /api/services/switch/turn_on
{"entity_id": "switch.press_01_pump", "reason": "start of shift"}

POST /api/services/number/set_value
{"entity_id": "number.press_01_zone1_sp", "value": 212.5}
```

Le corps est `entity_id`, un `reason` facultatif et les données du service. Une entité par appel, jamais une liste, car la réponse à « qu'est-ce qui est parti » doit porter sur une seule entité.

### Ce que prend chaque domaine

| Service | Données | Écrit |
|---|---|---|
| `switch.turn_on`, `switch.turn_off` | aucune | `true` ou `false` dans le tag de commande |
| `switch.toggle` | aucune | l'inverse de l'état actuel, lu dans le cache en direct selon les mêmes règles que l'état lui-même. Si l'état est `unknown`, `unavailable` ou de mauvaise qualité, l'appel est refusé : basculer quelque chose dont on ignore l'état, c'est deviner dans quel sens le déplacer. Dites `turn_on` ou `turn_off` |
| `number.set_value` | `value`, un nombre | la valeur, dans le tag de commande |
| `text.set_value` | `value`, une chaîne | la chaîne, dans le tag de commande |
| `select.select_option` | `option` | la valeur brute de l'option, dans le tag de commande |
| `button.press` | aucune | `press_value`, puis, `pulse_ms` plus tard, `release_value`, dans le tag de commande ; un bouton `single_shot` écrit `press_value` une fois et rien ensuite |
| `motor.start`, `motor.stop` | aucune | `true` ou `false` dans `run_command` |
| `motor.reset` | aucune | une impulsion sur `reset_command` : `true`, puis, `pulse_ms` plus tard, `false` |
| `motor.set_speed` | `value`, un nombre | la valeur, dans `speed_command` |
| `valve.open`, `valve.close` | aucune | `true` ou `false` dans `command` ; sur une vanne modulante, 100 ou 0 dans `position_command` |
| `valve.stop` | aucune | une impulsion sur `stop_command` ; une vanne `single_shot` écrit `true` une fois |
| `valve.set_position` | `position`, de 0 à 100 | la position, dans `position_command` |
| `loop.set_setpoint` | `value`, un nombre | la valeur, dans `setpoint` |
| `loop.set_mode` | `mode` : `auto`, `manual` ou `cascade` | la valeur brute du mode, dans `mode` |
| `loop.set_output` | `value`, un nombre | la valeur, dans `output`, **seulement tant que la boucle est lue en manuel** |
| `counter.reset` | aucune | 0 dans un `reset_command` numérique, ou une impulsion sur un bool |
| `alarm.acknowledge` | `note`, facultative | aucun tag : l'acquittement du moteur d'alarmes |
| `alarm.shelve` | `minutes`, de 1 à 1440 | aucun tag : la mise en attente du moteur d'alarmes |
| `alarm.unshelve` | aucune | aucun tag : la levée de mise en attente du moteur d'alarmes, seulement sur une alarme en attente |
| `script.turn_on` | les champs du script | aucun tag directement : exécute le [script](/fr/iot/scripts/), dont les étapes écrivent à travers la porte sous le nom `script:<id>` |
| `script.turn_off` | aucune | aucun tag : arrête toutes les exécutions du script |
| `scene.turn_on` | `params`, les paramètres de la recette, et `version`, tous deux facultatifs | aucun tag directement : applique la [recette](/fr/iot/recipes/), dont les cibles écrivent à travers la porte sous un même id d'appel |
| `light.turn_on` | `brightness`, de 0 à 100, facultatif | `true` dans `command`, puis la luminosité dans `brightness_command` |
| `light.turn_off` | aucune | `false` dans `command` |
| `light.toggle` | aucune | l'inverse de ce que dit le retour d'état de la lumière ; refusé quand il est illisible |
| `cover.open`, `cover.close`, `cover.stop` | aucune | `open`, `close` ou `stop` dans `command` |
| `cover.set_position` | `position`, de 0 à 100 | la position, dans `position_command` |
| `lock.lock`, `lock.unlock`, `lock.open` | aucune | `lock`, `unlock` ou `open` dans `state` |
| `fan.turn_on` | `percentage`, `preset_mode`, tous deux facultatifs | `true` dans `state`, puis chacun de ceux fournis |
| `fan.turn_off`, `fan.toggle` | aucune | `false`, ou l'inverse de ce que dit son retour d'état, dans `state` |
| `fan.set_percentage` | `percentage`, de 0 à 100 | dans `percentage` |
| `fan.set_preset_mode`, `fan.set_direction` | `preset_mode`, `direction` | dans `preset_mode`, `direction` |
| `fan.oscillate` | `oscillating`, true ou false | dans `oscillating` |
| `siren.turn_on`, `siren.turn_off`, `siren.toggle` | aucune | comme un interrupteur, dans `state` |
| `notify.send_message` | `message` | le message, dans `message` |

Un service composite dont le rôle n'est pas lié (`set_speed` sur un moteur sans `speed_command`) est refusé avant que rien ne soit planifié, comme un service inconnu.

`sensor` et `binary_sensor` sont en lecture seule et n'acceptent aucun service. Des données de service avec un champ que le service n'accepte pas sont refusées, comme un champ mal orthographié dans n'importe quel autre corps : un appel qui passe sans le champ que vous vouliez est pire qu'un appel qui dit non.

Un nombre entier arrive dans un tag entier comme entier : `42.0` devient `42`.

### Chaque appel passe par la porte d'écriture

Un appel de service devient une liste ordonnée d'écritures, et chacune passe par `runtime.Manager.Write`. Tout ce que la porte impose à une écriture vers un tag, elle l'impose donc à un appel de service, dans le même ordre :

1. écritures activées (`safety.allowWrites`), et pour un agent, écritures d'agent activées ;
2. le tag armé (`writable`) ;
3. la valeur dans la plage du tag, refusée, jamais écrêtée ;
4. puis ce que seule l'entité sait, vérifié dans la porte contre l'entité et le tag tels qu'ils sont à cet instant :
   - l'entité n'est pas désactivée (commander quelque chose qui n'a pas d'état n'est pas permis) ;
   - le `min` et le `max` propres d'un `number`, qui ne peuvent que resserrer la plage du tag ;
   - le `step` d'un `number`, compté depuis son minimum (le sien, sinon le minimum de la plage du tag, sinon zéro). Un tag entier a un pas de 1 sauf si l'entité dit autre chose, de sorte que `1.5` vers un registre de maintien est refusé au lieu qu'un driver le tronque discrètement en `1` ;
   - le `max_length` d'un `text` (en caractères, 255 par défaut) et son `pattern`, auquel la valeur entière doit correspondre ;
   - une option de `select` ou un mode de boucle qui n'est pas de l'entité. Il est envoyé à la porte comme l'option ou le mode demandé, et refusé là, de sorte que celui qui essaie des options qui n'existent pas est consigné ;
   - une position de vanne hors de 0 à 100 ;
   - un `set_output` de boucle tant que son tag de mode, lu dans le cache en direct à cet instant, est autre chose que manuel (auto, cascade, une valeur qui n'est aucun des modes, ou illisible).

Chaque refus, à chacune de ces étapes, est **audité** : une ligne `write_audit` avec l'entité, le service et l'id d'appel, `succeeded` à false et le motif commençant par `refused:`. Cela inclut un utilisateur sans `values.write`. L'API ne se contente pas de répondre 403 et d'oublier : elle envoie l'appel à la porte marqué comme refusé, la porte le refuse avant que rien ne soit écrit, et le refus figure dans l'historique de l'entité avec la valeur demandée.

Elle correspond à la forme d'une écriture vers un appareil, pas à un nom, de sorte qu'un contournement par une nouvelle enveloppe ou une interface déclarée sur place est détecté aussi.

### Ce que répond un appel

```json
{
  "call_id": "9f2c4e1a7b3d5c60",
  "entity_id": "switch.press_01_pump",
  "service": "switch.turn_on",
  "writes": [
    {"tag": "press-01/pump", "value": "true", "status": "written"}
  ]
}
```

Chaque écriture a un statut :

| Statut | Signification |
|---|---|
| `written` | l'appareil l'a acceptée |
| `not_sent` | la porte l'a écartée avant qu'elle atteigne l'appareil : un refus, pas de session, une ligne d'audit qui n'a pas pu être ouverte |
| `failed` | elle est partie et l'appareil ou la connexion a signalé une erreur. On ignore si elle a pris effet |
| `skipped` | jamais tentée, parce qu'une écriture précédente du même appel n'a pas réussi |

Un appel en échec répond avec le code de statut de l'erreur (403 refusé par la politique ou l'autorisation, 422 valeur refusée, 409 une bascule sans état connu ou un équipement dans un état inadapté au service, 503 appareil non connecté, 502 l'appareil a pris l'écriture et signalé une erreur, 404 aucune telle entité, 400 appel mal formé, 500 un appui dont le relâchement n'a pas abouti, ou une panne dans le Gateway, dont l'`error` n'est qu'une référence au journal du serveur) et le même corps avec `error` ajouté.

Les écritures d'un appel partent dans l'ordre, la première qui ne réussit pas termine l'appel, et **rien de ce qui est déjà écrit n'est annulé**. Annuler est lui-même une écriture, faite sans que personne l'ait demandée, vers un équipement qui a déjà bougé. En décider est le travail de l'opérateur, et la réponse lui dit exactement où l'appel s'est arrêté. Toutes les écritures d'un appel partagent son `call_id`, dans la piste d'audit et dans la réponse.

Il y a une exception, c'est la commande momentanée : l'appui d'un bouton, le reset d'un moteur, l'arrêt d'une vanne, le reset d'un compteur sur un bit. Ce sont deux écritures, l'appui et, pulse_ms plus tard, le relâchement, et le relâchement ne se saute pas à la légère, car le sauter laisse un bouton-poussoir enfoncé. Donc :

- Le relâchement est quand même envoyé lorsque l'appui est parti et a signalé une erreur (`failed`) : il a peut-être pris effet. Il n'est sauté que lorsque l'appui était `not_sent`, car alors rien n'est maintenu.
- Le relâchement est envoyé même si l'appelant raccroche pendant l'impulsion. L'appel continue sans lui.
- Si l'appui a été écrit et que le relâchement a été refusé ou a échoué, l'appel échoue avec un 500 et le dit : le tag **peut encore tenir la valeur d'appui**, vérifiez-le et relâchez-le à la main. Le refus ou l'échec du relâchement figure dans la piste d'audit sous le même id d'appel, et l'appel est consigné sous l'entité avec la gravité erreur, pas avertissement.

Une impulsion dure `pulse_ms`, 500 par défaut, 10 000 au plus. L'appel répond quand le relâchement est fait, l'appelant attend donc l'impulsion.

Chaque appel est aussi une ligne dans le journal système, sous l'entity_id, catégorie `write`, avec le motif et, dans le détail, l'id d'appel, la source et chaque écriture avec son statut. Les écritures de tag individuelles gardent leurs propres lignes sous leurs tags, comme toujours.

`GET /api/writes?entity=switch.press_01_pump` est la piste d'audit de cette entité, refus compris, la plus récente d'abord. Les lignes ont `entityId`, `service` et `callId` ; une écriture directe vers un tag les omet, de sorte que tout lecteur existant de `/api/writes` voit exactement ce qu'il voyait avant. La migration `0007_service_audit.sql` ajoute les trois colonnes, vides pour toutes les lignes existantes.

### Demander d'abord : la simulation

`POST /api/services/{domain}/{service}?dry_run=true` demande à la porte ce qu'elle ferait d'un appel, et n'en fait rien. Même corps, même autorisation.

```json
{"dry_run":true,"entity_id":"number.press_01_zone1_sp","service":"number.set_value","writes":[{"tag":"press-01/zone1_sp","value":"212.5","status":"would_write"}]}
```

```json
{"dry_run":true,"error":"press-01/zone1_sp: this tag is not marked writable","entity_id":"number.press_01_zone1_sp","service":"number.set_value","writes":[{"tag":"press-01/zone1_sp","value":"212.5","status":"not_sent","error":"press-01/zone1_sp: this tag is not marked writable"}]}
```

L'appel est planifié exactement comme le réel, et chaque écriture qu'il ferait est soumise aux propres vérifications de la porte, dans le même ordre, contre les tags, l'entité et l'appareil tels qu'ils sont à l'instant : écritures activées, l'interrupteur des agents, le tag armé, sa plage, tout ce que seule l'entité sait (pas, motif, une boucle en manuel, une entité désactivée) et une session vers l'appareil. La première écriture qui serait refusée est `not_sent` avec le motif, les autres `skipped`, et `error` est l'erreur avec laquelle l'appel réel échouerait, **mot pour mot**. Une écriture qui partirait est `would_write`. C'est une seule fonction de la porte (`precheck`) qui répond aux deux, de sorte qu'une simulation ne peut pas passer des vérifications que l'écriture réelle fait. Une entité `alarm` n'écrit aucun tag, sa simulation fait donc les vérifications d'alarme (le moteur en marche, la définition toujours là, l'entité activée, seule une alarme en attente peut être sortie d'attente) et répond sans écritures ; l'alarme n'est pas touchée et la piste d'alarmes ne reçoit rien.

C'est une question, donc un verdict, refusé ou non, répond 200. Une requête que l'appel réel écarterait avant toute vérification (aucune telle entité, un service que le domaine n'accepte pas, des données qu'il n'accepte pas, une bascule sans état connu, le mauvais domaine dans le chemin) répond avec le même statut et la même erreur que l'appel réel. Un utilisateur sans l'autorisation reçoit le même 403.

Une simulation n'écrit rien, n'ouvre aucune ligne d'audit, ne met rien dans le journal système et ne dépense aucun id d'appel : rien n'a été tenté, il n'y a donc rien à justifier.

Elle dit ce qui se passerait **à l'instant**. Entre la simulation et l'appel réel, l'appareil peut tomber et quelqu'un peut désarmer le tag ; l'appel réel est de nouveau vérifié, en entier, au moment de l'écriture. Un cas est traité plus précisément que les vérifications de l'appel réel lui-même : un appareil dont la session est tombée pendant que son worker se reconnecte. L'écriture réelle va jusqu'au driver et y échoue (`failed`, 503, et une ligne d'audit pour la tentative) ; la simulation dit d'emblée `not_sent`, avec la même erreur.

L'invite de commande de l'écran Entités et du panneau de l'entité l'utilise : à l'ouverture de l'invite et pendant la saisie d'une valeur, elle pose la question, et un refus s'affiche dans l'invite, avec les mots de la porte, avant que quiconque appuie sur confirmer. C'est un conseil, pas un verrou : confirmer va toujours à la porte, qui décide de nouveau.

## Équipements composites

Un tag correspond à une entité. Une pompe ne correspond pas à un tag : elle a une commande de marche, un contact de marche, un défaut, un reset et peut-être une vitesse, et l'opérateur la voit comme une seule chose. Un composite est cette seule chose, liée à chacun de ses tags par un **rôle** nommé.

Un administrateur en construit un avec `POST /api/entities` :

```json
{
  "domain": "motor",
  "name": "Infeed pump",
  "device_class": "pump",
  "options": {"pulse_ms": 500},
  "bindings": [
    {"role": "running",       "device_id": "press-01", "tag_name": "P101_Running"},
    {"role": "run_command",   "device_id": "press-01", "tag_name": "P101_RunCmd"},
    {"role": "fault",         "device_id": "press-01", "tag_name": "P101_Fault"},
    {"role": "reset_command", "device_id": "press-01", "tag_name": "P101_Reset"}
  ]
}
```

`entity_id` est facultatif. Omettez-le et il est fabriqué à partir du nom (`motor.infeed_pump`, puis `_2` et ainsi de suite). Donnez-le et il est utilisé tel quel, et un id déjà pris donne un 409, pas un `_2` silencieux : vous avez demandé ce nom. `name`, `device_class`, `unit_of_measurement`, `icon`, `entity_category` et `options` sont les mêmes champs de registre que chaque entité possède. Placez-le dans l'arbre des équipements et étiquetez-le ensuite avec `PUT`.

La création vérifie tout ce qu'elle peut contre les tags tels qu'ils sont maintenant, et refuse (400, en disant quoi corriger) tout ce qui n'est pas correct :

- le domaine est l'un de `select`, `button`, `motor`, `valve`, `loop`, `counter`, `weather` (`GET /api/entities/composites` dit lesquels, et les rôles de chacun). Les domaines de tags sont fabriqués pour vous à partir des tags, et `alarm` à partir des définitions d'alarme ;
- chaque rôle obligatoire est lié, et aucun rôle que le domaine n'a pas ;
- **chaque tag lié existe** ;
- **le type de chaque tag convient à son rôle** : le `running` d'un moteur est un bool, le `position` d'une vanne est un nombre, le compte d'un compteur est un entier ;
- **chaque tag dans lequel un service écrit est déjà armé** (`writable`). Un composite n'arme jamais rien. Armer un point reste une décision que quelqu'un prend sur le tag, un par un, comme toujours ;
- chaque valeur brute des options (la valeur d'une option de select, les valeurs d'appui et de relâchement d'un bouton, les modes d'une boucle) en est une que son tag peut prendre. `1.5` est refusé dès maintenant pour un registre entier, pas quand quelqu'un appuie sur le bouton.

Un composite part avec son appareil quand tous ses tags sont sur un seul appareil, et n'appartient à aucun quand ils s'étendent sur plusieurs. Ses liaisons sont fixes : un autre ensemble de tags est une autre entité, supprimez-le donc et construisez-en un autre.

Chaque création et chaque suppression est une ligne dans le journal système sous l'entity_id, catégorie `config`, avec les liaisons.

### Rôles

| Domaine | Rôle | Type de tag | <span class="sr-only">Détails</span> |
|---|---|---|---|
| `select` | `state` | tout | obligatoire. Retour d'état : relu pour trouver l'option |
| | `command` | tout | obligatoire, armé. Écrit avec la valeur brute de l'option. Peut être le même tag que `state` |
| `button` | `command` | tout | obligatoire, armé. Impulsion |
| `motor` | `running` | bool | obligatoire. Retour d'état : le contact de marche |
| | `run_command` | bool | obligatoire, armé. `start` écrit true, `stop` false |
| | `fault` | bool | retour d'état |
| | `reset_command` | bool | armé. Impulsion par `reset` |
| | `speed` | nombre | retour d'état, l'attribut `speed` |
| | `speed_command` | nombre | armé. Écrit par `set_speed` |
| `valve` | `state` | tout | retour d'état : où dit être, en mots, une vanne qui s'est annoncée |
| | `opened`, `closed` | bool | retour d'état : les fins de course |
| | `position` | nombre | retour d'état, de 0 à 100 pour cent |
| | `fault` | bool | retour d'état |
| | `command` | bool | armé. Une vanne tout ou rien : `open` écrit true, `close` false |
| | `position_command` | nombre | armé. Une vanne modulante : `set_position`, et `open`/`close` comme 100/0 |
| | `stop_command` | bool | armé. Impulsion par `stop` |
| `loop` | `pv` | nombre | obligatoire. L'état |
| | `setpoint` | nombre | obligatoire, armé. Lu pour l'attribut, écrit par `set_setpoint` |
| | `output` | nombre | obligatoire, armé. Lu pour l'attribut, écrit par `set_output` |
| | `mode` | tout | obligatoire, armé. Lu pour connaître le mode, écrit par `set_mode` |
| `counter` | `state` | entier | obligatoire. Le compte |
| | `reset_command` | bool ou nombre | armé. Impulsion si bool, écrit avec 0 si nombre (ce peut être le registre de comptage lui-même) |
| `weather` | `temperature` | nombre | obligatoire. L'état |
| | `humidity`, `pressure`, `wind_speed`, `wind_gust`, `wind_bearing`, `rain_rate`, `rain_today`, `solar_radiation`, `uv_index` | nombre | retour d'état, chacun un attribut. Aucun n'est armé : une station se lit, elle ne se commande jamais |

Une vanne a besoin d'au moins un parmi `state`, `opened`, `closed` et `position` (il faut que quelque chose dise où elle est) et d'exactement un parmi `command` et `position_command`. Les deux à la fois seraient deux réponses à « où lui a-t-on dit d'aller », et l'état entre les fins de course dépend de cette réponse. Si l'automate a vraiment les deux, faites deux entités.

### Options

| Option | Domaine | <span class="sr-only">Détails</span> |
|---|---|---|
| `select_options` | `select` | obligatoire : `[{"option": "low", "value": 1}, ...]`, dans l'ordre où un écran les propose. Noms uniques, valeurs uniques (deux options de même valeur feraient de l'état une conjecture), chaque valeur un nombre, un bool ou une chaîne |
| `press_value`, `release_value` | `button` | ensemble ou pas du tout. Omises sur un tag bool, elles valent `true` et `false`, écrites dans les options pour que ce que fait le bouton soit consigné. Tout autre type de tag a besoin des deux |
| `pulse_ms` | `button`, `motor`, `valve`, `counter` | combien de temps une commande momentanée est maintenue. De 1 à 10 000, 500 si non défini |
| `single_shot` | `button`, `valve` | `true` écrit `press_value` une fois et ne relâche jamais : l'appui est toute la commande. Un bouton MQTT découvert en est un, car son « relâchement » serait une seconde commande que l'appareil n'a jamais demandée. Accepte `press_value` et ni `release_value` ni `pulse_ms`. Sur une vanne, son `stop` écrit `true` une fois au lieu d'une impulsion : l'arrêt d'une vanne découverte est une commande à part entière |
| `event_types` | `event` | les types d'événement qu'il peut déclencher, quand il les indique |
| `role_choices` | `lock`, `fan`, `siren`, `notify`, `update`, `device_tracker`, `climate`, `humidifier`, `water_heater` | les mots que propose chaque rôle commandé, par rôle, de 1 à 64 distincts chacun : les modes d'un thermostat. La découverte le définit à partir de la configuration |
| `modes` | `loop` | obligatoire : la valeur brute du tag de mode pour chaque mode, `{"auto": 1, "manual": 0}` au minimum, `cascade` si le régulateur l'a |

### Comment l'état d'un composite est décidé

L'état d'un composite vient de son **retour d'état**. Il n'est jamais calculé à partir du fait que HotLoop a envoyé une commande. Un moteur à qui l'on a dit de démarrer et dont le contact de marche ne s'est pas fermé ne tourne pas, il démarre, et si le contact ne se ferme jamais il reste en démarrage jusqu'à ce que quelqu'un regarde. La relecture d'un tag de commande compte comme retour d'état : c'est l'automate qui dit ce qu'il détient, pas HotLoop qui se souvient de ce qu'il a écrit.

Un composite n'est **jamais optimiste**. Un capteur seul continue d'afficher sa dernière bonne valeur malgré une mauvaise lecture ; un composite non. Chaque rôle de retour d'état qui décide de l'état doit avoir une bonne lecture, sinon :

| Condition | `state` | `quality` |
|---|---|---|
| un tag décisif a disparu, ou son appareil est hors service | `unavailable` | `bad` |
| un tag décisif n'a pas encore de lecture, ou en a une mauvaise | `unknown` | `bad` |
| tous les tags décisifs bons, l'un d'eux incertain ou sur un appareil dégradé | l'état | `uncertain` |
| tous les tags décisifs bons | l'état | `good` |

Un moteur dont l'entrée de défaut a cessé de répondre est `unknown`, pas le `running` qu'il était il y a une seconde. Les rôles qui décident sont indiqués plus bas ; les autres ne font que remplir des attributs, et un rôle illisible est simplement omis.

L'attribut `armed` d'un composite n'est vrai que lorsque tous les tags dans lesquels l'un de ses services écrit sont armés à l'instant. Un moteur qu'on peut démarrer mais pas arrêter d'ici n'est pas de ceux qu'un écran devrait proposer.

### `motor`

Rôles décisifs : `running`, et `fault` s'il est lié. État, la première règle qui correspond :

1. `fault` actif : **`fault`**, quoi qu'il en soit du reste. Marche et défaut ensemble sont contradictoires, et ce qui demande une personne, c'est le défaut ; l'attribut `running` dit toujours qu'il tourne.
2. en marche, et la commande de marche relue à l'arrêt : **`stopping`**.
3. en marche : **`running`**.
4. pas en marche, et la commande de marche relue active : **`starting`**.
5. sinon : **`stopped`**.

Si la relecture de la commande de marche est illisible, elle ne décide rien : le moteur est alors `running` ou `stopped` selon son seul contact. HotLoop ne met pas de délai à un démarrage qui n'aboutit pas : c'est un échec de démarrage, et il relève de l'automate ou d'une définition d'alarme sur le contact de marche.

Attributs : `running`, `fault` (s'il est lié), `command` (la relecture), `speed` (si lié et lisible), `device_class` (`pump`, `fan`, `conveyor`, `compressor`, `agitator`).

### `valve`

Une vanne qui s'est annoncée (découverte MQTT) dit en mots où elle est sur son rôle `state` : `open`, `closed`, `opening`, `closing` ou `stopped`, et c'est son état, avec `current_position` tiré de `position` quand elle en rapporte un. Un mot qui n'est aucun de ceux-là donne `unknown`, avec ce qu'elle a dit dans `raw_value`. Le reste de cette section concerne une vanne construite à partir de tags d'automate.

Rôles décisifs : chacun de ceux qui sont liés parmi `opened`, `closed`, `position`, `fault`. État, la première règle qui correspond :

1. `fault` actif : **`fault`**.
2. les deux fins de course atteintes : **`fault`**, avec `limit_conflict: true`. Une vanne ne peut pas être ouverte et fermée, donc un contact ment, et lequel n'est pas une chose à deviner.
3. fin de course d'ouverture atteinte : **`open`**. Fin de course de fermeture atteinte : **`closed`**.
4. pas de fins de course, seulement une position : à 1 % ou moins **`closed`**, à 99 % ou plus **`open`**.
5. entre les extrémités, en déplacement ou arrêtée selon ce qui lui est commandé : une commande de position relue à plus de 1 % au-dessus de la position est **`opening`**, à plus de 1 % en dessous **`closing`**, à moins de 1 % **`stopped`** ; une commande tout ou rien relue active est **`opening`**, inactive **`closing`** ; sans rien à quoi se fier, **`stopped`**.

Une vanne tout ou rien arrêtée entre ses fins de course alors qu'elle est toujours commandée ouverte se lit `opening`. Si vous avez besoin de la voir arrêtée là, liez `position`.

`current_position` est le retour de position quand il est lié, sinon 100 sur la fin de course d'ouverture et 0 sur celle de fermeture, et absent entre les deux. Autres attributs : `open_limit`, `closed_limit`, `fault`, `device_class` (`water`, `gas`, `steam`, `air`).

### `loop`

L'état est la variable de process, affichée comme celle d'un capteur, à partir de `pv` seul. Les attributs sont `setpoint` et `output` (présents quand ils sont lisibles), `mode` (le nom du mode que lit le tag de mode, ou `unknown` quand il est illisible ou contient une valeur qui n'est aucun des modes), `modes` (les noms configurés) et `unit_of_measurement` (celle de l'entité, sinon celle du tag PV). Une boucle prend les classes d'appareil des capteurs : une boucle de température, une boucle de pression.

`set_output` est refusé dans la porte sauf si la boucle est lue en manuel **au moment de l'écriture**. Une sortie écrite sur une boucle en auto se bat contre le régulateur, et en cascade contre deux. Un mode illisible n'est pas manuel. Le refus est une ligne `write_audit` comme les autres, avec l'entité, le service, l'id d'appel et la valeur demandée, et l'appel répond 409. Mettez d'abord la boucle en manuel avec `set_mode`.

### `counter`

L'état est le compte, un tag entier. `reset` écrit 0 dans un `reset_command` numérique (liez le registre de comptage lui-même si c'est ainsi que l'automate le remet à zéro) ou envoie une impulsion sur un bool. Un compteur sans `reset_command` est en lecture seule. `unit_of_measurement` est celle de l'entité, sinon celle du tag.

### `weather`

Une station de toit comme une seule entité : voir [Météo](/fr/iot/weather/). L'état est la température ; toutes les autres lectures sont des attributs, présents seulement quand leur capteur est lisible, avec le point de rosée, l'indice de chaleur et le refroidissement éolien calculés à partir d'elles. Une lecture liée qui ne peut pas être lue est nommée dans `unavailable`, jamais affichée comme zéro. Elle n'accepte aucun service.

### `select`

L'état est l'option dont la valeur brute est lue par le tag `state`. Une valeur qui n'est aucune des options est `unknown`, avec la valeur brute dans `raw_value`, plutôt que l'option la plus proche ou la dernière. L'attribut `options` énumère les noms des options dans l'ordre. Une option qui n'est pas celle du select est refusée dans la porte et auditée avec l'option demandée.

### `button`

Un bouton n'a pas de retour d'état. Son état est l'heure de son dernier appui via ce Gateway, ou `unknown` s'il n'a pas été appuyé depuis le démarrage du Gateway. Il est `unavailable` quand son tag de commande a disparu ou que son appareil est hors service, car appuyer dessus ne peut alors pas fonctionner. Le dernier appui est gardé en mémoire, il est donc remis à zéro à un redémarrage ; la piste d'audit a chaque appui de toute façon, et c'est aussi pourquoi le journal d'activité ne consigne pas l'état d'un bouton.

## Lumières, volets et événements

Créés par la [découverte MQTT](/fr/iot/mqtt-discovery/) pour un appareil qui s'est annoncé, liés aux tags que la découverte a créés pour lui. Personne ne construit cela à partir de tags d'automate, donc `POST /api/entities` ne les accepte pas. Mêmes règles que tout composite : l'état est ce que dit le retour d'état, jamais ce que HotLoop a envoyé en dernier, et chaque service est une série d'écritures à travers la porte, chaque tag armé d'abord par une personne.

| Domaine | Rôle | Type de tag | <span class="sr-only">Détails</span> |
|---|---|---|---|
| `light` | `state` | bool | retour d'état : allumée ou éteinte |
| | `command` | bool | armé. `turn_on` écrit true, `turn_off` false. Le même tag que `state` |
| | `brightness` | nombre | retour d'état, de 0 à 100 pour cent, l'attribut `brightness` |
| | `brightness_command` | nombre | armé. `turn_on` avec un `brightness`. Le même tag que `brightness` |
| `cover` | `state` | tout | retour d'état : `open`, `closed`, `opening`, `closing` ou `stopped` |
| | `command` | tout | armé. `open`, `close` ou `stop`. Le même tag que `state` |
| | `position` | nombre | retour d'état, de 0 (fermé) à 100 (ouvert), `current_position` |
| | `position_command` | nombre | armé. `set_position`. Le même tag que `position` |
| `event` | `state` | tout | le type d'événement qu'il a déclenché en dernier |
| `lock` | `state` | tout | lu et écrit : `locked`, `unlocked`, `locking`, `unlocking`, `jammed`, `open`, `opening` ; accepte `lock`, `unlock`, `open` |
| `fan` | `state` | bool | lu et écrit : marche ou arrêt |
| | `percentage` | nombre | lu et écrit, de 0 à 100 |
| | `preset_mode`, `direction` | tout | lu et écrit |
| | `oscillating` | bool | lu et écrit |
| `siren` | `state` | bool | lu et écrit : marche ou arrêt |
| `notify` | `message` | tout | écrit : le message. Rien à lire |
| `update` | `installed_version`, `latest_version` | tout | lu |
| `device_tracker` | `state` | tout | lu : `home`, `not_home`, ou la zone qu'il nomme |
| `climate` | `mode` | tout | lu et écrit : l'état. `set_hvac_mode` avec `hvac_mode` |
| | `temperature`, `target_temp_low`, `target_temp_high` | nombre | lu et écrit. `set_temperature` avec l'un d'eux |
| | `target_humidity` | nombre | lu et écrit. `set_humidity` avec `humidity` |
| | `fan_mode`, `swing_mode`, `swing_horizontal_mode`, `preset_mode` | tout | lu et écrit, chacun par son propre service `set_` |
| | `current_temperature`, `current_humidity`, `action` | nombre, nombre, tout | lu |
| | `power` | bool | écrit : `turn_on` true, `turn_off` false. Rien à lire |
| `humidifier` | `state` | bool | lu et écrit : marche ou arrêt |
| | `target_humidity` | nombre | lu et écrit. `set_humidity` avec `humidity` |
| | `mode` | tout | lu et écrit. `set_mode` avec `mode` |
| | `current_humidity`, `action` | nombre, tout | lu |
| `water_heater` | `mode` | tout | lu et écrit : l'état. `set_operation_mode` avec `operation_mode` |
| | `temperature` | nombre | lu et écrit. `set_temperature` |
| | `current_temperature` | nombre | lu |
| | `power` | bool | écrit : `turn_on`, `turn_off` |
| `alarm_control_panel` | `state` | tout | lu : `disarmed`, `armed_home`, `armed_away`, `armed_night`, `armed_vacation`, `armed_custom_bypass`, `pending`, `triggered`, `arming`, `disarming` ; écrit par `alarm_arm_home`, `alarm_arm_away`, `alarm_arm_night`, `alarm_arm_vacation`, `alarm_arm_custom_bypass`, `alarm_disarm`, `alarm_trigger` |
| `vacuum` | `state` | tout | lu : `cleaning`, `docked`, `paused`, `idle`, `returning`, `error` ; écrit par `start`, `pause`, `stop`, `return_to_base`, `clean_spot`, `locate` |
| | `battery_level` | nombre | lu |
| | `fan_speed` | tout | lu et écrit. `set_fan_speed` avec `fan_speed` |
| `lawn_mower` | `activity` | tout | lu : `mowing`, `paused`, `docked`, `error`, `returning` |
| `camera` | `image` | tout | lu : un hash de la dernière image. L'état est le moment où elle a changé ; `entity_picture` est l'endroit où l'obtenir |
| `image` | `image` ou `url` | tout | lu : une image conservée comme pour une caméra, ou un lien (`url`, http ou https seulement, jamais récupéré) |
| | `start_mowing`, `pause`, `dock` | bool | écrit : un appui chacun, par le service du même nom |

L'état est la lecture du rôle d'état (marche ou arrêt pour un bool), `unknown` quand elle est illisible, et chaque autre rôle lisible est un attribut sous son propre nom : le `percentage`, `preset_mode`, `oscillating` et `direction` d'un ventilateur. `toggle` se règle sur le retour d'état et est refusé quand il n'y en a pas. Un notificateur n'a rien à lire : son état est `unknown` avec `feedback: none`. Une mise à jour est `on` quand ce qui est installé n'est pas la dernière version, et n'accepte aucun service : HotLoop n'installe jamais de firmware, car un flashage raté est une panne. Une scène découverte est un bouton à coup unique, son appui étant la charge utile de la scène.

Ce qu'on peut envoyer à un équipement figure dans ses attributs, selon sa configuration : les `hvac_modes`, `fan_modes`, `preset_modes` et `swing_modes` d'un thermostat, les `available_modes` d'un humidificateur, l'`operation_list` d'un chauffe-eau, les `preset_modes` d'un ventilateur, la `fan_speed_list` d'un aspirateur (issue de l'option `role_choices` de l'entité, que la découverte tient alignée sur la configuration), et les `min_temp`/`max_temp` et `min_humidity`/`max_humidity` de la consigne (issus de la plage du tag). C'est ce que proposent les écrans. Ce n'est pas ce qui fait la règle : la porte tient la consigne dans la plage du tag et le driver refuse un mot que la configuration ne liste pas, quoi que dise un attribut. `set_temperature` sans aucune de ses trois clés est refusé, ce n'est pas un appel qui ne fait rien. `turn_on` sur un thermostat sans topic de marche est refusé aussi, plutôt que de deviner quel mode veut dire « marche ».

### `light`

Allumée ou éteinte selon son retour d'état `state` ; `unknown` quand il est illisible, et sans aucun topic d'état, `unknown` pour de bon avec `feedback: none`. La luminosité est un attribut, et le `color_mode`, `color`, `color_temp` et `effect` d'une lumière au schéma JSON sont aussi des attributs : affichés, pas commandés. `toggle` se règle sur le retour d'état et est refusé quand il n'y en a pas.

### `cover`

Son retour d'état `state` quand elle en a un. Avec seulement une position : à 1 % ou moins `closed`, tout ce qui est au-dessus `open`. Un mot qui n'est aucun des cinq est `unknown`, avec `raw_value`. `current_position` est la position quand il y en a une.

### `event`

L'état d'un événement est **le moment** où il s'est déclenché pour la dernière fois (RFC 3339), et `event_type` ce que c'était ; `event_types` énumère ce qu'il peut déclencher. `unknown` tant qu'il ne s'est pas déclenché depuis que HotLoop a commencé à le lire. Il n'accepte aucun service : rien ne commande un événement. Deux événements dans une même interrogation apparaissent comme le plus tardif ; le journal d'activité et l'historique ont chaque lecture telle qu'elle est arrivée.

## Entités d'alarme

Chaque définition d'alarme est une entité : `alarm.<definition id>` (au même format de slug que celui d'un tag, donc `oven-temp-hi` donne `alarm.oven_temp_hi`), plateforme `alarm`, `unique_id` `alarm:<definition id>`, nommée d'après la définition. Elle n'a ni liaisons ni appareil : son état est celui du moteur d'alarmes, pas celui d'un tag, et une définition n'appartient pas à son appareil comme un tag (supprimer un appareil laisse ses définitions d'alarme). Le tag qu'elle surveille est son attribut `source`.

L'état est l'état ISA-18.2 que détient le moteur d'alarmes, écrit comme s'écrit un état d'entité :

| Moteur d'alarmes | État de l'entité | <span class="sr-only">Détails</span> |
|---|---|---|
| `normal` | `normal` | condition levée, rien en suspens |
| `unack-active` | `active_unack` | condition vraie, personne ne l'a acquittée |
| `ack-active` | `active_ack` | condition vraie, acquittée |
| `rtn-unack` | `rtn_unack` | levée avant que quiconque l'ait acquittée |
| `shelved` | `shelved` | mise en silence par un opérateur, pour une durée limitée |
| `suppressed` | `suppressed` | mise en silence par conception |

La qualité est `good` : l'état du moteur n'est pas une lecture. L'entité est `unavailable` quand elle est orpheline ou que le Gateway n'a pas de moteur d'alarmes. Elle suit chaque transition au moment où elle se produit, acquittements compris.

Attributs : `definition_id`, `source`, `condition`, `limit`, `priority` (de 1 à 4), `priority_label`, `enabled`, `message`, `count`, `active`, `needs_ack`, `trip_value`, `raised_at`, `cleared_at`, `acked_at`, `acked_by`, `shelved_until`, `shelved_by`, les derniers présents quand ils s'appliquent.

Ses services, `acknowledge`, `shelve` et `unshelve`, n'écrivent aucun tag, ils ne passent donc pas par la porte d'écriture. Ils appellent les `Ack`, `Shelve` et `Unshelve` du moteur d'alarmes lui-même, les mêmes que l'écran d'alarmes et `POST /api/alarms/{id}/ack`, de sorte qu'ils arrivent dans la piste d'alarmes (`alarm_events`) et dans le journal système exactement comme eux. Ils demandent **`alarms.ack`**, pas `values.write` : un opérateur acquitte les alarmes, un lecteur non. Un appel refusé répond 403 et est consigné sous l'entité avec qui a essayé. L'appel est aussi une ligne dans le journal système sous l'entité, avec le motif.

`unshelve` est refusé (409) sur une alarme qui n'est pas en attente. Le moteur d'alarmes le refuse aussi, et ramène une alarme en attente dans l'état où sa condition est réellement, pas aveuglément à normal. Un service que les alarmes n'acceptent pas (`turn_on`) est refusé comme service inconnu (400) avant d'approcher le moteur.

### Plateformes avec fournisseur

Les entités d'alarme sont la première plateforme à **fournisseur** : des entités dont la source de vérité est ailleurs que dans un tag. Un fournisseur dit quelles entités sa plateforme a à l'instant, rend leur état, exécute leurs services et répond à leurs simulations ; le registre dérive, met en orpheline et réadopte ses entités par `unique_id` exactement comme il le fait pour celles d'un tag, le moteur d'état les recalcule sur les événements propres du fournisseur et sur son cycle d'une fois par seconde, et un appel de service sur l'une va au fournisseur au lieu d'être planifié en écritures de tags. Un fournisseur qui écrit un tag l'écrit toujours à travers la porte.

Les assistants sont la deuxième : `input_boolean`, `input_number`, `input_select`, `input_text`, `input_counter`, `timer` et `schedule`, des valeurs que possèdent les personnes de l'usine plutôt qu'un automate, conservées par HotLoop et fixées avec `helpers.write`. Ils n'écrivent aucun tag. Voir [Assistants](/fr/iot/helpers/).

Les scripts sont la troisième : chaque script est une entité `script`, `script.<id>`, active tant qu'une exécution en cours existe dans un processus quelconque et inactive quand il n'y en a aucune. `turn_on` l'exécute avec les données du service comme champs, `turn_off` l'arrête, tous deux avec `scripts.run`. Supprimer un script met son entité en orpheline, comme supprimer une définition d'alarme. Voir [Scripts de procédure](/fr/iot/scripts/).

Les recettes sont la quatrième : chaque recette est une entité `scene`, `scene.<id>`, dont l'état est le moment de sa dernière écriture vers l'usine et dont les attributs disent comment s'est passée sa plus récente application. `turn_on` l'applique, avec `recipes.apply` et l'autorisation propre de la recette quand elle en nomme une. Supprimer une recette met son entité en orpheline. Voir [Recettes de produit](/fr/iot/recipes/).

Le soleil est la cinquième : `binary_sensor.sun_up`, `sensor.sun_elevation` et `sensor.sun_azimuth`, calculés chaque seconde à partir de la latitude et de la longitude du site, sur la machine. Ils se lisent et n'acceptent aucun service. Un site sans position n'en a pas, et ceux qui restent de l'époque où il en avait une apparaissent indisponibles et disent quelles variables définir. Voir [le soleil](/fr/iot/sun/).

## Les entités partout ailleurs

### Le flux en direct

`GET /api/stream` porte un événement `entities` à côté de `values`. Il est regroupé de la même façon, quatre fois par seconde au plus, l'état le plus récent de chaque entité :

```
event: entities
data: {"changed":[{"entity_id":"sensor.press_01_zone1_temp","state":"212.5",...}],"removed":[]}
```

`changed` est l'état complet de chaque entité qui a changé depuis le dernier événement, au même format que `GET /api/states/{entity_id}`. `removed` est la liste des entity_id qui n'ont plus d'état du tout : désactivés, supprimés avec leur appareil, ou renommés (le nouveau nom arrive dans `changed`). Le premier événement `entities` d'une nouvelle connexion porte tous les états, comme `snapshot` porte toutes les lectures, de sorte qu'un écran est rempli avant que quoi que ce soit change. Les événements `values`, `snapshot`, `alarm` et `device` sont exactement ce qu'ils étaient.

### MCP

Les agents disposent de `list_entities`, `get_states` et `call_service`. `call_service` passe par le même exécuteur de services que `POST /api/services/...`, de sorte que l'appel d'un agent est contrôlé par l'interrupteur MCP comme `write_tag` et audité contre l'entité avec la source `mcp`. Voir [MCP](/fr/iot/mcp/#entités).

### Automatisations

Un déclencheur `state` active une règle quand l'état d'une entité change, les conditions peuvent lire `states`, `attrs` et les `qualities` des entités, et une action `call_service` commande une entité à travers la porte, auditée sous `automation:<rule-id>`. Voir [Automatisations](/fr/iot/automations/#les-déclencheurs-détat-suivent-les-entités).

Les deux suivent le crochet `OnStateChanged` du moteur, et c'est pourquoi les règles de [Comment le moteur fonctionne](#comment-le-moteur-fonctionne) comptent : un déclencheur d'état voit chaque changement que calcule le moteur, une fois, dans l'ordre, et rien de ce que le moteur n'a jamais vu.

## Écrans

**Entités** liste toutes les entités sous leur place dans l'arbre des équipements (la leur, sinon celle de leur appareil), avec l'arbre sur le côté, et filtre par lieu, domaine, libellé, texte et qualité. Dans un lieu, les équipements viennent d'abord (alarmes, moteurs, vannes, boucles, selects, boutons, compteurs), puis ce qui peut être commandé, puis les lectures brutes.

Par défaut, l'écran montre chaque signal une seule fois. Le modèle d'entités donne exprès plusieurs entités à un même point, et chacune garde son id, mais dessinées en tuiles cela fait le même signal deux ou trois fois : un tag armé est un capteur et un interrupteur, et un tag lié à un moteur reste son propre capteur. Sur une vraie ligne, cela doublait à peu près les tuiles et noyait les équipements. L'écran regroupe donc :

- L'entité de lecture d'un tag se tient derrière son entité de commande. L'interrupteur ou le nombre est la tuile, puisqu'il montre déjà l'état en direct, et son panneau dit « aussi disponible comme » avec l'entity_id du capteur, pour qui câble une automatisation ou un agent dessus.
- Un tag lié à un composite se trouve dans le composite, avec ses deux entités. Le panneau du composite liste ses signaux : les rôles, le tag, ce qu'il lit maintenant, et ses entity_id de lecture et de commande. Un tag présent dans deux composites va dans le premier par ordre de nom.
- Seule une commande ou un composite qui n'est ni masqué ni désactivé accueille quoi que ce soit. Masquez ou désactivez l'interrupteur et son capteur retrouve sa tuile.
- Une alarme sur un signal regroupé signale la tuile dans laquelle il est regroupé, avec le nom de l'alarme, et ouvre l'alarme à partir de là. Regrouper range l'écran ; cela ne cache jamais une alarme.
- Le compte à côté de la barre de qualité dit « 13 affichés · 25 regroupées », et une tuile qui en contient d'autres le dit dans son pied (« 5 signaux », « + sensor »). Les pastilles de domaine, les comptes de l'arbre et la barre de qualité comptent les tuiles affichées.
- La recherche et le filtre de libellés regardent à l'intérieur des tuiles. Cherchez un entity_id ou un tag qui est regroupé et vous obtenez la tuile qui le contient, entourée, avec « Trouvé ici : » et l'entity_id. Nous l'avons préféré à basculer tout l'écran sur toutes les entités : vous arrivez sur la pompe que vous cherchiez, pas sur un mur de tuiles.

« Afficher toutes les entités » désactive le regroupement et donne à chaque entité sa propre tuile, pour un ingénieur qui veut le registre brut. Il est désactivé par défaut et ce navigateur s'en souvient (stockage local ; une fenêtre privée l'oublie). L'écran de personne d'autre ne change.

Les états arrivent par l'événement `entities` du flux en direct ; l'écran ne les interroge jamais. Une tuile se redessine quand son état change, et se redessine même quand un bouton qu'elle contient a le focus, car une tuile qui garderait un ancien état pour cette raison montrerait le passé comme le présent. La qualité est dessinée avant la valeur :

| Qualité | À l'écran |
|---|---|
| bonne | la valeur, sans marque |
| incertaine | la valeur, un bord ambre et un badge « incertain » |
| mauvaise | la dernière bonne valeur, grisée sur une trame, « mauvais », et « dernière bonne valeur, lecture mauvaise », avec le motif derrière quand le driver l'a donné |
| pas encore de lecture | « Inconnu », en italique, et « lecture mauvaise » avec le motif quand il y en a un |
| indisponible | « Indisponible », toute la tuile hachurée |

Les commandes suivent le domaine et le rôle. Un lecteur n'en voit aucune. Un opérateur voit celles qui relèvent de `values.write` (et celles d'une alarme, de `alarms.ack`), désactivées avec le motif affiché quand les écritures sont coupées sur ce déploiement ou qu'un tag dans lequel l'entité écrit n'est pas armé. La sortie d'une boucle n'est proposée que lorsqu'elle est lue en manuel, car c'est le seul moment où la porte le permet. Chaque commande ouvre une invite qui dit quel service, quels tags, et ce que lit l'entité maintenant, et demande un motif pour la piste d'audit. Un refus garde l'invite ouverte avec les mots de la porte et chaque écriture qui est partie ou non. Le nouvel état n'est jamais présumé à partir de la commande : il revient sur le flux quand l'appareil le relit, ou il ne revient pas.

Le panneau contient l'état et ses horodatages, les commandes, une heure, six heures ou un jour d'historique du tag lié (un tracé en escalier, la dernière valeur prolongée jusqu'à maintenant, les mauvaises lectures marquées), les autres entités du même signal, les liaisons (pour un composite, ses signaux), les attributs, et chaque commande faite ou refusée via l'entité. Un administrateur obtient aussi l'entity_id, le nom, la place dans l'arbre, les libellés, masquée et désactivée, et supprimer pour un composite ou une orpheline.

**Nouvel équipement** (administrateur) construit un composite : choisissez le domaine, nommez-le, et choisissez un tag pour chaque rôle. Chaque rôle ne se voit proposer que des tags d'un type qui lui convient, et un rôle de commande montre les tags qui ne sont pas armés comme désactivés au lieu de les cacher. Ce qui est obligatoire est marqué mais n'est pas imposé par le formulaire : le registre décide, et son refus est affiché tel qu'il l'a écrit.

**Usine** est l'arbre des équipements et les libellés. Voir [L'arbre des équipements et les libellés](/fr/iot/equipment/).

## Sauvegarde et restauration

`entities` et `entity_bindings` sont dans la sauvegarde, entity_id, personnalisations et tout. Cela inclut les composites, avec chaque rôle et chaque option, ce qui compte plus pour eux que pour tout le reste : l'entité d'un tag pourrait être reconstruite à partir de son tag, mais rien ne peut reconstruire un composite, sauf la sauvegarde. Les entités d'alarme reviennent avec leurs définitions, et une définition restaurée sans entité en reçoit une à la première synchronisation. Une sauvegarde faite avant cette version n'a aucune des deux tables ; restaurez-la, démarrez le Gateway, et la première synchronisation du registre donne à chaque tag restauré son entité. `entity_labels` est aussi dans la sauvegarde, et la restauration d'une sauvegarde antérieure à l'arbre des équipements est traitée dans [L'arbre des équipements et les libellés](/fr/iot/equipment/).

La migration 0007 ajoute trois colonnes à `write_audit`. Une sauvegarde faite avant elle se restaure toujours : la restauration charge un fichier qui a moins de colonnes que la table d'aujourd'hui dans les premières colonnes et laisse les nouvelles prendre leurs valeurs par défaut, car une migration qui ajoute une colonne l'ajoute toujours à la fin. Une sauvegarde d'une version plus récente est toujours refusée. Voir [Sauvegardes et restauration](/fr/iot/backup/).

## Ce qui n'est pas encore là

Le noyau, l'arbre des équipements, la commande des entités à travers la porte d'écriture, les équipements composites, les entités d'alarme, les entités dans MCP, les automatisations et le flux en direct, et les écrans sont tous là. Voir la [feuille de route HotLoop](/fr/roadmap/). Le `forSec` d'un déclencheur d'état (« actif pendant cinq minutes ») figure dans [Automatisations](/fr/iot/automations/#tenir-un-état--forsec).
