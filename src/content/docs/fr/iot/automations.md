---
title: "Automatisations"
description: "Des règles à dix types de déclencheurs, avec conditions et séquences, compilées à l'enregistrement, chaque écriture passant par la porte d'écriture."
---

Une règle, c'est trois choses : quelque chose se produit, une condition est remplie, des actions s'exécutent.

Les règles peuvent commander des équipements, donc deux propriétés ne se négocient pas.

**Les conditions sont compilées à l'enregistrement de la règle, pas quand elle se déclenche.** Une erreur de syntaxe, l'auteur la voit alors qu'il a encore l'éditeur sous les yeux, au lieu d'une règle qui ne s'exécute jamais en silence ou, pire, qui plante à 3 h du matin au milieu d'une séquence déjà à moitié exécutée. L'éditeur valide pendant la saisie ; une règle qui ne compile pas est refusée à l'enregistrement.

**Les conditions sont évaluées dans un bac à sable.** [expr-lang](https://expr-lang.org) n'a aucune E/S, ne peut atteindre ni le système de fichiers ni le réseau, vérifie les types à la compilation et est garanti de se terminer. Cette dernière propriété compte le plus : une condition est évaluée sur le chemin qui mène à une écriture, et un langage d'expressions qui peut boucler sans fin est un langage qui peut bloquer le moteur qui tient le verrou d'écriture.

## Déclencheurs

Il suffit qu'un seul déclencheur se produise pour que la règle s'exécute.

| Type | Se déclenche quand | Champs clés |
|---|---|---|
| `tag_change` | la valeur d'un tag change | `deviceId`, `tagName` |
| `threshold` | une valeur **franchit** une limite | `deviceId`, `tagName`, `threshold`, `direction`, `hysteresis` |
| `state` | l'état d'une entité change, ou reste le même pendant un certain temps | `entityId`, `from`, `to`, `forSec` |
| `schedule` | une expression cron arrive à échéance | `cron` |
| `interval` | toutes les N secondes | `intervalSec` |
| `alarm` | une alarme entre dans un état | `alarmId`, `alarmState` |
| `device_state` | un appareil se connecte ou se déconnecte | `deviceId`, `toState` |
| `webhook` | un POST entrant arrive | `webhookPath` |
| `mqtt` | un message arrive sur un topic | `topic` |
| `startup` | le processus démarre | n/a |
| `sun` | l'aube, le lever du soleil, le midi solaire, le coucher du soleil ou le crépuscule sur le site, avec un décalage éventuel | `event`, `offsetSec` |

### Les seuils se déclenchent au franchissement

`threshold` se déclenche quand une valeur *franchit* la limite, pas tant qu'elle reste au-dessus. Se déclencher sur « la valeur est au-dessus de 200 » veut dire que la règle se déclenche à chaque cycle où la valeur reste haute, ce qui, pour une règle qui commande quelque chose, est une tempête de commandes.

`hysteresis` empêche une valeur qui hésite autour de la limite de réarmer la règle à chaque oscillation : une fois au-dessus, la valeur doit retomber sous `threshold - hysteresis` avant que le déclencheur puisse se redéclencher.

```json
{
  "type": "threshold",
  "deviceId": "press-01", "tagName": "Zone1_Temp",
  "threshold": 200, "direction": "rising", "hysteresis": 5
}
```

`direction` vaut `rising`, `falling` ou `either`. La première lecture après le démarrage établit une référence et ne déclenche pas, sinon chaque règle de seuil se déclencherait une fois au démarrage, quelle que soit la valeur.

### Les déclencheurs d'état suivent les entités

`state` se déclenche quand la chaîne d'état d'une entité change : de `off` à `on`, de `212.5` à `213`, de `on` à `unavailable`. `from` et `to` le restreignent. Si vous omettez les deux, il se déclenche à chaque changement, y compris vers et depuis `unavailable`, ce qui est généralement ce qu'on veut pour « prévenir quelqu'un » et jamais ce qu'on veut pour « commander quelque chose ». Dites `to`.

```json
{
  "type": "state",
  "entityId": "binary_sensor.press_01_run",
  "from": "off", "to": "on"
}
```

Il se déclenche sur l'état et rien d'autre. Un attribut qui change, ou une qualité qui devient mauvaise alors que l'état garde sa dernière bonne valeur, n'est pas un changement d'état.

Voici exactement quand il se déclenche, parce qu'une règle qui commande des équipements mérite de le savoir. Le déclencheur suit le propre registre du moteur d'entités de ce qui a changé, pas le bus de tags. Le moteur calcule l'état d'une entité à mesure que les lectures arrivent, et une fois par seconde recalcule tout par sécurité pour un lot qu'il n'a pas pu absorber à temps. Chaque changement qu'il calcule est signalé une fois, dans l'ordre, et le déclencheur les voit tous. Donc :

- **Il se déclenche une fois par changement.** Le recalcul à la seconde ne signale que ce qui a bougé depuis le dernier passage du moteur, il ne peut donc pas signaler un changement deux fois, et le rechargement d'une règle ne réinitialise rien dont dépend un déclencheur d'état.
- **Il ne rate pas un changement que le moteur a vu.** Un bus lent coûte une seconde de latence, pas le changement.
- **Il ne peut pas voir un changement que personne n'a vu.** Une bobine qui passe à off, on, off entre deux interrogations n'a jamais changé pour l'usine. Un déclencheur d'état vaut le balayage qui est derrière lui, pas plus. Si vous avez besoin de chaque front d'un signal rapide, verrouillez-le dans l'automate.
- **Le démarrage est une référence.** Toute entité qui apparaît au démarrage de la Gateway, ou quand on en active une, n'est pas un changement et ne déclenche pas.

Si les règles accusent un jour 10 000 changements de retard (la base de données trop lente pour enregistrer les exécutions qu'ils lancent), les plus anciens sont abandonnés, comptés et journalisés, et `GET /api/diagnostics` montre `stateChangesPending` et `stateChangesDropped` sous `automations`.

Renommez une entité et toute règle qui nomme son ancien `entity_id` cesse de se déclencher. C'est le prix de noms qui ont un sens ; renommez en connaissance de cause, et cherchez d'abord dans les règles.

### Tenir un état : forSec

« La pompe tourne depuis cinq minutes » est un déclencheur d'état avec `forSec`. Le changement lance un minuteur au lieu de déclencher la règle ; la règle se déclenche quand l'état vers lequel il a changé a tenu ce nombre de secondes.

```json
{
  "type": "state",
  "entityId": "binary_sensor.press_01_run",
  "from": "off", "to": "on",
  "forSec": 300
}
```

- **Tout changement d'état l'annule.** De on à off puis de nouveau à on dans les cinq minutes, ce sont deux changements : le premier met fin à l'attente, le second en démarre une nouvelle à zéro. Le temps ne s'additionne pas. Un passage à `unavailable` est aussi un changement d'état, donc un appareil qui se tait en pleine attente l'annule.
- **Seul l'état compte.** Un attribut qui change, ou une qualité qui devient mauvaise alors que l'état tient, ne l'annule pas, comme il ne déclenche pas un simple déclencheur d'état. Si une attente ne doit pas survivre à une mauvaise lecture, protégez la condition de la règle avec `qualities`.
- **Il se déclenche une fois par attente.** Tenir une heure déclenche une règle de cinq minutes une seule fois, à cinq minutes, pas toutes les cinq minutes.
- **Chaque règle a son propre minuteur**, un par déclencheur. Deux règles sur la même entité avec des `forSec` différents se déclenchent chacune à son heure.
- **La trace le dit.** Une exécution déclenchée par une attente indique `binary_sensor.press_01_run changed from off to on and held for 300s`, et `fromState`, `toState` et `entity` sont ceux du changement qui a lancé l'attente.
- **Une attente ne survit pas à un redémarrage.** Elle est gardée en mémoire et rien ne la réarme : les minutes qu'une presse avait tenues avant le redémarrage ne comptent plus après. Ce que le processus voit en revenant, c'est chaque entité qui apparaît (une référence, pas un changement), généralement en `unknown`, puis la première lecture de l'appareil qui la fait passer à ce qu'il lit. Avec `"from": "off"`, ça ne correspond pas : une presse qui tournait avant le redémarrage ne lance aucune attente, et la règle se déclenche la prochaine fois que la presse passe de off à on et tourne cinq minutes. Sans `from`, cela dépend d'une course que vous ne maîtrisez pas. Si la première lecture arrive après que les règles écoutent, c'est un changement, de `unknown` à `on`, et il lance une attente à zéro : la règle se déclenche cinq minutes plus tard, et sa trace dit `changed from unknown to on`. Si l'appareil répond avant que la Gateway soit en ligne, la presse est simplement `on` dès le départ, rien n'a changé, et rien ne se déclenche avant qu'elle ne change. Précisez `from` quand un redémarrage ne doit pas compter comme un démarrage, et n'écrivez pas une règle qui a besoin qu'il compte. Modifier, désarmer ou supprimer la règle abandonne aussi ses attentes ; enregistrer une autre règle, non.
- **Une entité qui disparaît pendant l'attente** (désactivée, ou supprimée avec son appareil) ne la déclenche jamais.

`forSec` vaut au plus un jour (86400), et seul un déclencheur `state` l'accepte. Il est vérifié à l'enregistrement comme tout le reste.

### Déclencheurs solaires

Éclairage de cour, traçage chauffant, un parking, tout ce qui se soucie de savoir s'il fait nuit dehors. `sun` se déclenche à `dawn`, `sunrise`, `noon`, `sunset` ou `dusk` sur ce site, décalé par `offsetSec` : négatif veut dire avant, donc ceci est une demi-heure avant le coucher du soleil.

```json
{"type": "sun", "event": "sunset", "offsetSec": -1800}
```

- **Il est calculé sur la machine.** À partir de la latitude et de la longitude du site (`HOTLOOP_SITE_LATITUDE`, `HOTLOOP_SITE_LONGITUDE`), avec les équations solaires de la NOAA, sans service ni internet. Une usine qui a perdu sa liaison allume quand même les lumières au crépuscule. Voir [le soleil](/fr/iot/sun/).
- **Pas de position, pas d'armement.** Une règle avec un déclencheur solaire sur un site sans latitude ni longitude n'est pas armée, et le journal système dit quelles deux variables définir. C'était le genre de chose qui reste armée et muette pour toujours, et personne ne s'en aperçoit avant que la cour soit dans le noir.
- **Il se déclenche une fois par événement du jour,** à l'heure de ce jour-là. Les couchers de soleil d'octobre arrivent environ une minute plus tôt chaque soir et le déclencheur les suit.
- **L'aube et le crépuscule sont le crépuscule civil**, le centre du soleil à 6 degrés sous l'horizon. C'est la ligne « il fait assez sombre pour allumer » autour de laquelle l'éclairage extérieur est conçu.
- **Sous le soleil de minuit, il n'y a pas de coucher sur lequel se déclencher**, donc un déclencheur de coucher attend le suivant, même dans des semaines, et se déclenche alors.
- `offsetSec` vaut au plus six heures de chaque côté (21600). Au-delà, c'est un `schedule`.

La trace dit ce qui l'a déclenché et quand : `30m before sunset at 2026-10-01T22:38:00Z`, et `trigger` vaut `sun` dans la condition.

## Conditions

Une expression qui renvoie un booléen. Vide veut dire sans condition.

Ce qu'une expression peut voir :

| Nom | Signification |
|---|---|
| `value`, `string`, `quality` | la lecture qui a déclenché la règle |
| `previous` | la lecture précédente |
| `tag`, `device` | ce qui l'a déclenchée |
| `tags["device/tag"]` | chaque lecture numérique actuelle |
| `strings["device/tag"]` | chaque lecture textuelle actuelle |
| `qualities["device/tag"]` | chaque qualité actuelle |
| `states["sensor.x"]` | l'état de chaque entité activée, sous forme de chaîne |
| `attrs["sensor.x"]["unit_of_measurement"]` | les attributs de chaque entité activée |
| `qualities["sensor.x"]` | la qualité de chaque entité, à côté de celle des tags (la clé d'un tag contient un `/`, un entity_id jamais) |
| `entity`, `fromState`, `toState` | le changement d'état qui a déclenché la règle |
| `alarm`, `alarmState` | l'alarme qui a déclenché la règle |
| `deviceState` | l'état de l'appareil qui l'a déclenchée |
| `now`, `hour`, `minute`, `weekday` | l'horloge ; weekday 0 est dimanche |
| `trigger` | quel déclencheur s'est produit |
| `vars` | les valeurs liées par les étapes précédentes |

```
value > 200
value > 200 and quality == 'good'
tags['press-01/Zone1_Temp'] > 200 and tags['press-01/Pressure'] < 50
hour >= 6 and hour < 18 and weekday != 0 and weekday != 6
qualities['press-01/Zone1_Temp'] == 'good'
strings['cnc-01/Program'] == 'PART_4471.NC'
value > previous
states['switch.press_01_pump'] == 'off' and toState == 'on'
float(states['sensor.press_01_zone1_temp']) > 200 and qualities['sensor.press_01_zone1_temp'] == 'good'
attrs['switch.press_01_pump']['armed'] == true
```

**Protégez avec la qualité.** `value > 200` est vrai pour une mauvaise lecture de 250, et une mauvaise lecture est une lecture que le système vous dit ne pas connaître. Pour tout ce qui commande des équipements, écrivez `value > 200 and quality == 'good'`. Pareil pour les entités : une entité mauvaise continue d'afficher sa dernière bonne valeur, et `qualities['sensor.x']` est le moyen pour une règle de le savoir.

**Un état est une chaîne.** C'est `"212.5"`, `"on"` ou `"unavailable"`, jamais un nombre, donc `states['sensor.x'] > 200` est refusé à l'enregistrement comme erreur de type au lieu d'être enregistré comme une comparaison discrètement toujours fausse. Écrivez `float(states['sensor.x']) > 200`, et protégez-le : `float('unavailable')` est une erreur, et une condition qui renvoie une erreur fait échouer l'exécution.

`string` est la lecture qui a déclenché la règle, ce qui veut dire que ce n'est pas aussi la fonction `string()` d'expr-lang. Pour mettre un nombre dans une chaîne, utilisez `toJSON(value)`.

Une condition doit renvoyer un booléen. Une condition qui renvoie un nombre ou une chaîne est rejetée à l'enregistrement plutôt que convertie en une valeur de vérité que personne n'avait voulue.

## Actions

Les actions s'exécutent dans l'ordre. Une étape en échec arrête la règle sauf si elle pose `continueOnError` : une étape censée fermer une vanne et qui ne l'a pas fait ne doit pas être suivie d'étapes qui supposent la vanne fermée.

### write_tag

```json
{
  "type": "write_tag",
  "params": {
    "deviceId": "press-01", "tagName": "Cooling",
    "value": true
  }
}
```

Ou calculé :

```json
{
  "type": "write_tag",
  "params": {
    "deviceId": "press-01", "tagName": "Setpoint",
    "expression": "tags['press-01/Zone1_Temp'] - 10"
  }
}
```

**Cela passe par la même porte que tout le reste.** Une automatisation n'a pas plus de privilège qu'une personne : les écritures doivent être activées, le tag doit être marqué inscriptible, la valeur doit être dans la plage, et la tentative est auditée comme `automation:<rule-id>`.

### call_service

Commande une entité par son service, comme le font `POST /api/services/...` et l'outil MCP `call_service`. Voir [Entités](/fr/iot/entities/#services) pour ce que prend chaque domaine.

```json
{
  "type": "call_service",
  "params": {
    "entityId": "switch.press_01_pump",
    "service": "switch.turn_on"
  }
}
```

Avec des données, littérales ou calculées :

```json
{
  "type": "call_service",
  "params": {
    "entityId": "number.press_01_zone1_sp",
    "service": "number.set_value",
    "dataExpressions": {"value": "float(states['sensor.press_01_zone1_temp']) - 10"}
  }
}
```

`service` est `domain.service` et son domaine doit être celui de l'entité, donc une règle qui nomme un nombre avec le service d'un interrupteur est refusée à l'enregistrement. Un service que le domaine n'accepte pas l'est aussi, et la liste de ce que prend chaque domaine vient de la couche d'entités elle-même : quand un domaine y gagne un service, les règles peuvent l'utiliser sans aucun changement ici. `data` est la donnée littérale du service ; `dataExpressions` sont évaluées à l'exécution et fusionnées par-dessus.

C'est `write_tag` avec un nom dessus. L'appel devient des écritures de tags par la même porte, auditées comme `automation:<rule-id>` avec l'entité, le service et l'id d'appel sur chaque ligne. Un refus (écritures désactivées, tag désarmé, une valeur hors du pas de l'entité) fait échouer l'étape et l'exécution, avec le refus dans la trace, exactement comme un `write_tag` refusé, et chaque écriture que l'appel a faite ou qu'on lui a refusée figure dans la sortie de l'étape. Un appel n'est jamais annulé : un composite qui a réussi deux écritures sur trois s'arrête là et le dit.

### condition

Une condition au milieu d'une séquence. Quand elle est fausse, la séquence s'arrête là, et l'exécution **a réussi** : la règle a fait ce pour quoi elle a été écrite, c'est-à-dire s'arrêter. La sortie de l'étape dit `false; the steps after this one did not run`.

```json
{
  "type": "condition",
  "params": {
    "expression": "states['binary_sensor.press_01_run'] == 'on' and qualities['binary_sensor.press_01_run'] == 'good'"
  }
}
```

Ce n'est pas la `condition` de la règle. Celle-là est vérifiée une fois, avant que quoi que ce soit s'exécute, par rapport à l'usine telle qu'elle était quand le déclencheur s'est produit, et une condition fausse enregistre l'exécution comme ignorée. Une étape condition lit l'usine **telle qu'elle est quand l'étape s'exécute**, ce qui est l'intérêt d'en placer une après un `delay` ou un `wait` : « la presse tourne-t-elle encore, trente secondes plus tard ? » `entity`, `toState`, `value` et le reste de ce qui a déclenché la règle restent ce qu'ils étaient, et `vars` aussi.

Une condition qui ne peut pas être évaluée (`float('unavailable')`) fait échouer l'étape et l'exécution, comme la condition de la règle. `continueOnError` est refusé sur une condition à l'enregistrement : continuer au-delà d'une condition reviendrait à ce qu'elle n'arrête jamais rien.

### wait

Retient la séquence jusqu'à ce qu'une expression soit vraie, au plus `timeoutSec`.

```json
{
  "type": "wait",
  "params": {
    "expression": "states['binary_sensor.press_01_valve_closed'] == 'on'",
    "timeoutSec": 30
  }
}
```

Elle regarde tout de suite, de nouveau **chaque fois qu'une entité nommée par l'expression change** (son état, sa qualité ou un attribut), et une fois par seconde dans tous les cas. Les entités qu'elle surveille sont celles écrites en littéraux dans `states['...']`, `attrs['...']` et `qualities['...']` ; une lecture de tag, l'horloge ou une entité nommée autrement est attrapée par le coup d'œil à la seconde. Une attente sur une bobine Modbus est donc aussi rapide que l'interrogation qui est derrière, pas une seconde en retard.

Quand elle devient vraie, l'étape suivante s'exécute, et les étapes d'après voient l'usine telle que l'attente l'a vue en dernier. Si le délai expire d'abord, l'étape **échoue**, et l'exécution avec elle, en disant `still false after 30s`, sauf si l'attente indique de continuer :

```json
{
  "type": "wait",
  "params": {
    "expression": "float(states['sensor.press_01_zone1_temp']) < 60",
    "timeoutSec": 240,
    "continueOnTimeout": true
  }
}
```

Dans les deux cas, `vars.wait.completed` est vrai ou faux ensuite, et `vars.wait.waitedSec` est la durée de l'attente, de sorte qu'une étape condition après une attente avec poursuite peut décider : `vars.wait.completed == true`.

`timeoutSec` est obligatoire et vaut au plus une heure. Une attente sans fin garde son créneau d'exécution jusqu'à ce que le budget de l'exécution le lui reprenne, ce qui, sous `skip`, veut dire que la règle cesse de se déclencher. Elle doit aussi tenir dans le budget de l'exécution (`maxRuntimeSec`, cinq minutes par défaut) : une attente de dix minutes demande `"maxRuntimeSec": 900` ou à peu près sur sa règle, et sans cela la règle est refusée à l'enregistrement au lieu d'expirer en exécution. Une expression qui lève une erreur pendant l'attente fait échouer l'étape.

### stop

Termine la séquence. `reason` est obligatoire et accepte la substitution `{{ expression }}` ; la trace l'affiche.

```json
{
  "type": "stop",
  "params": {"reason": "pump already running, nothing to do"}
}
```

Sans `error`, l'exécution a réussi. Avec `"error": true`, l'exécution a échoué, avec la raison comme erreur, et elle est journalisée et comptée comme un échec comme n'importe quel autre :

```json
{
  "type": "stop",
  "params": {"reason": "valve did not close in time", "error": true}
}
```

`continueOnError` est refusé sur un stop à l'enregistrement.

### call_script

Exécute un [script](/fr/iot/scripts/) : une séquence nommée que quelqu'un a écrite une fois pour que chaque règle qui a besoin d'un cycle CIP ou d'une purge de ligne appelle la même au lieu de porter sa propre copie. `fields` sont ses entrées, `fieldExpressions` sont évaluées quand l'étape s'exécute et fusionnées par-dessus, et le script vérifie le tout par rapport à ses propres champs exactement comme pour une exécution depuis l'écran. Une valeur qu'il refuse fait échouer cette étape ; elle n'est jamais déplacée pour convenir.

```json
{
  "type": "call_script",
  "params": {
    "scriptId": "cip_cycle",
    "fields": {"circuit": "tank_2"},
    "fieldExpressions": {"minutes": "states['input_number.cip_minutes']"},
    "wait": true
  }
}
```

Avec `"wait": true`, l'étape attend la fin de l'exécution du script et reprend son résultat : un script qui échoue fait échouer l'étape, et la règle s'arrête là sauf si l'étape dit `continueOnError`. L'exécution du script fait partie de celle-ci : si cette exécution est annulée ou épuise son budget, le script aussi. Sans `wait`, le script est lancé et la règle continue ; le script se termine de lui-même.

Le script s'exécute comme `script:<id>`, avec la source de cette règle, `automation`, sur chaque écriture qu'il fait, et son exécution indique que `automation_run:<id>` était son parent. Un script occupé dont le mode refuse une autre exécution fait échouer une étape qui attend (`script busy`) et est noté, sans échec, par une étape qui n'attend pas. Les scripts qui appellent des scripts vont à cinq niveaux au plus, et un script qui s'appellerait lui-même est refusé à son enregistrement.

### apply_recipe

Applique une [recette](/fr/iot/recipes/) : un ensemble de consignes qui partent ensemble, une qualité de produit ou un changement de série. `params` sont ses paramètres et `paramExpressions` sont évaluées quand l'étape s'exécute et fusionnées par-dessus ; `version` applique volontairement une version plus ancienne, et omise, c'est la version courante.

```json
{
  "type": "apply_recipe",
  "params": {
    "recipeId": "grade_a",
    "params": {"line_speed": 120},
    "paramExpressions": {"batch": "states['input_number.next_batch']"}
  }
}
```

La recette fait ce qu'elle fait depuis l'écran Recettes, avec cette règle comme celle qui l'applique. Elle est d'abord vérifiée en entier, et si une cible devait être refusée rien n'est écrit et l'étape échoue avec toutes les raisons. Ensuite ses cibles partent dans l'ordre sous un même id d'appel, comme `automation:<id>` avec la source `automation`, et la première qui échoue arrête les suivantes et fait échouer l'étape ; ce qui a été écrit reste écrit. L'étape ne réussit que quand chaque cible a été écrite. Une valeur envoyée mais non relue depuis l'appareil n'est pas un échec, parce qu'elle est bien partie, mais la trace dit `NOT confirmed by read-back`, et l'application aussi. Le parent de l'application est cette exécution, `automation_run:<id>`.

### Le reste

| Action | Fait |
|---|---|
| `mqtt_publish` | publie sur la connexion existante d'un appareil MQTT |
| `http_request` | appelle un point de terminaison ; `bindTo` stocke le corps dans `vars` |
| `raise_alarm` / `clear_alarm` | pilote une alarme que le moteur ne peut pas voir lui-même |
| `log_event` | écrit dans le journal système |
| `set_variable` | lie une valeur pour les étapes suivantes |
| `delay` | fait une pause, jusqu'à une heure |
| `mcp_call` | invoque un outil sur un serveur MCP configuré |

`mqtt_publish`, `http_request`, `log_event` et `stop` acceptent la substitution `{{ expression }}` dans leurs chaînes.

```json
{
  "type": "mcp_call",
  "params": {
    "server": "maintenance",
    "tool": "create_work_order",
    "args": {"priority": "high"},
    "argExpressions": {"note": "'Zone 1 reached ' + toJSON(value)"},
    "bindTo": "workOrder"
  }
}
```

## Modes d'exécution

Ce qui se passe quand une règle est déclenchée alors qu'une exécution précédente est encore en cours.

| Mode | Comportement |
|---|---|
| `skip` | abandonne le nouveau déclenchement, **la valeur par défaut**, et la bonne réponse près d'un appareil |
| `queue` | l'exécute après, avec au plus une en attente |
| `restart` | abandonne l'exécution en cours et recommence |
| `parallel` | exécute les deux |

`queue` est plafonnée à une exécution en attente, exprès. Une règle qui n'arrive pas à suivre accumulerait sinon un retard de commandes qui partiraient toutes contre une usine dont l'état a changé entre-temps.

`minIntervalSec` limite le débit quel que soit le rythme des déclenchements, une sécurité contre un tag qui vibre et use un appareil jusqu'à la corde. Une exécution manuelle depuis l'interface ou MCP contourne la limite de débit (quelqu'un l'a voulu) mais pas le mode d'exécution (deux exécutions simultanées sont aussi dangereuses, qui que ce soit qui les lance).

`maxRuntimeSec` borne toute une exécution ; la valeur par défaut est de cinq minutes. Sans lui, une règle suspendue à un point de terminaison injoignable garde son créneau d'exécution pour toujours, et sous `skip` cela veut dire qu'elle ne se déclenche plus jamais. Une exécution qui l'épuise est enregistrée comme expirée, qu'elle ait été entre deux étapes ou au milieu d'un `delay` ou d'un `wait`.

### Attentes, délais et modes d'exécution

Une exécution qui se trouve dans un `wait` ou un `delay` est une exécution en cours, et le mode d'exécution décide de ce qu'un déclenchement lui fait :

| Mode | Un déclenchement pendant qu'une exécution attend |
|---|---|
| `skip` | est abandonné et enregistré comme ignoré. L'exécution en attente continue. |
| `queue` | s'exécute une fois l'exécution en attente terminée, quelle que soit sa fin. |
| `restart` | annule l'exécution en attente là où elle est et en démarre une nouvelle. L'ancienne exécution est enregistrée comme **annulée**, `a newer trigger restarted the rule`. C'est le schéma de la « lumière à détecteur de mouvement » : chaque déclenchement repousse la fin. |
| `parallel` | démarre une autre exécution, qui attend de son côté. |

Une exécution est annulée là où elle est, attente ou délai compris, et enregistrée comme **annulée** avec la raison, quand :

- **sa règle est désarmée ou supprimée** : `the rule was disarmed or deleted`. Son exécution en file et ses attentes `forSec` sont abandonnées aussi.
- **sa règle est modifiée** : `the rule was edited`. Une exécution qui attend une condition que l'auteur vient de changer ne continue pas comme si de rien n'était ; la règle modifiée repart à neuf. Enregistrer une *autre* règle ne touche à rien : les exécutions, attentes, exécutions en file, créneau d'exécution et minuteurs d'intervalle de chaque règle inchangée continuent comme avant.
- **le processus s'arrête** : `the process is stopping`. L'arrêt n'attend pas la fin d'une attente. Rien ne reprend l'exécution au démarrage suivant ; une exécution que le processus n'a pas pu enregistrer comme annulée (un plantage, une coupure de courant) est marquée annulée au démarrage suivant.

Une étape annulée ou à court de budget arrête l'exécution même avec `continueOnError` : cet indicateur vaut pour une étape qui a échoué, pas pour une exécution que quelqu'un a arrêtée. Tout ce que l'étape avait déjà fait reste fait : une écriture partie avant l'annulation n'est pas défaite, et elle est dans la trace.

## Historique des exécutions

Chaque exécution est enregistrée avec une trace par étape : les entrées **résolues**, les sorties, les durées et les erreurs. Pas les modèles : quand une règle déraille à 3 h du matin, `wrote 212.5 to press-01/Setpoint` est ce qui vaut la peine d'être su, et `wrote {{expression}}` non.

Développez une exécution sur l'écran Automatisations pour voir ses étapes. Une exécution encore en cours quand le processus s'est arrêté est annulée à l'arrêt, et celle que le processus n'a pas pu enregistrer (un plantage) est marquée annulée au démarrage suivant, plutôt que d'avoir l'air de s'exécuter depuis mardi dernier.

## Un exemple concret

Lancer le refroidissement quand une zone chauffe pendant une équipe, au plus une fois toutes les dix minutes, et prévenir quelqu'un.

```json
{
  "id": "cool-zone-1",
  "name": "Cool zone 1 when hot",
  "enabled": true,
  "mode": "skip",
  "minIntervalSec": 600,
  "triggers": [{
    "type": "threshold",
    "deviceId": "press-01", "tagName": "Zone1_Temp",
    "threshold": 200, "direction": "rising", "hysteresis": 5
  }],
  "condition": "quality == 'good' and hour >= 6 and hour < 18",
  "actions": [
    {"type": "write_tag", "params": {
      "deviceId": "press-01", "tagName": "Cooling", "value": true}},
    {"type": "delay", "params": {"seconds": 30}},
    {"type": "log_event", "params": {
      "severity": "warning",
      "message": "Cooling started, zone 1 at {{ value }}"}}
  ]
}
```

Lisez les garde-fous dans l'ordre : elle se déclenche au franchissement et non en continu ; l'hystérésis l'empêche de se réarmer sur une oscillation ; la condition refuse d'agir sur une lecture à laquelle elle ne peut pas se fier et ne s'exécute que pendant l'équipe ; et la limite de débit fait que, même si tout le reste est faux, elle ne peut pas commander l'usine plus d'une fois toutes les dix minutes.

La même idée avec des entités : démarrer le ventilateur d'extraction quand la presse se met à tourner, mais seulement si personne n'a désarmé le ventilateur.

```json
{
  "id": "fan-with-press",
  "name": "Extraction fan follows the press",
  "enabled": true,
  "mode": "skip",
  "triggers": [{
    "type": "state",
    "entityId": "binary_sensor.press_01_run",
    "from": "off", "to": "on"
  }],
  "condition": "qualities['binary_sensor.press_01_run'] == 'good' and attrs['switch.press_01_fan']['armed'] == true",
  "actions": [
    {"type": "call_service", "params": {
      "entityId": "switch.press_01_fan", "service": "switch.turn_on"}},
    {"type": "log_event", "params": {
      "message": "{{ entity }} went {{ toState }}, fan started"}}
  ]
}
```

`from` et `to` font qu'une reconnexion (`unavailable` vers `on`) ne démarre pas le ventilateur toute seule ; la condition fait qu'un ventilateur désarmé est une exécution ignorée plutôt qu'une écriture refusée dans la piste d'audit à chaque démarrage de la presse.

Et une qui utilise les étapes de séquence : une fois que la presse tourne depuis dix minutes, ouvrir la vanne de refroidissement si elle n'est pas déjà ouverte, attendre son fin de course, et échouer bruyamment si elle ne ferme jamais le contact.

```json
{
  "id": "cool-after-warmup",
  "name": "Open cooling after ten minutes of running",
  "enabled": true,
  "mode": "restart",
  "maxRuntimeSec": 120,
  "triggers": [{
    "type": "state",
    "entityId": "binary_sensor.press_01_run",
    "from": "off", "to": "on",
    "forSec": 600
  }],
  "actions": [
    {"type": "condition", "params": {
      "expression": "states['valve.press_01_cooling'] != 'open'"}},
    {"type": "call_service", "params": {
      "entityId": "valve.press_01_cooling", "service": "valve.open"}},
    {"type": "wait", "params": {
      "expression": "states['valve.press_01_cooling'] == 'open'",
      "timeoutSec": 60, "continueOnTimeout": true}},
    {"type": "condition", "params": {
      "expression": "vars.wait.completed == false"}},
    {"type": "stop", "params": {
      "reason": "cooling valve did not open within 60s, it is {{ states['valve.press_01_cooling'] }}",
      "error": true}}
  ]
}
```

Lisez-la de haut en bas : l'attente fait qu'une presse qui déclenche après deux minutes n'ouvre jamais la vanne, et `from` fait qu'un redémarrage de la Gateway n'est pas un démarrage de presse ; la première condition fait d'une vanne déjà ouverte une exécution réussie qui ne commande rien ; l'attente se réveille à l'instant où l'entité de la vanne change ; et quand elle ne s'ouvre jamais, la seconde condition laisse l'exécution aller jusqu'à un stop qui la fait échouer, avec l'état réel de la vanne dans la raison et un avertissement dans le journal système. Quand la vanne s'ouvre, cette même condition est fausse et l'exécution s'arrête là, réussie.

## Webhooks

Un déclencheur `webhook` enregistre `POST /api/webhook/<path>`. Le corps est disponible comme `vars.body`. Un chemin que nulle règle ne réclame renvoie 404 au lieu d'accepter en silence : un webhook qui publie dans le vide ressemble exactement à un webhook qui fonctionne.

Deux règles ne peuvent pas réclamer le même chemin ; la seconde est refusée au chargement avec une ligne de journal qui nomme les deux.

## Quand une règle ne s'arme pas

Une règle activée mais qui n'a pas compilé apparaît comme **NOT ARMED** sur l'écran Automatisations, avec un point rouge et une explication, et une erreur dans le journal système. C'est l'état qu'il faut signaler le plus fort : l'auteur croit qu'elle tourne.

Une mauvaise règle ne désarme pas les autres. Le rechargement abandonne celle qui a échoué et arme tout le reste.
