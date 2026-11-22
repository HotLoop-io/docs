---
title: "Blueprints de règles"
description: "Écrivez une règle une fois, avec des blancs, et remplissez-la pour chaque pompe. Chaque règle garde sa version du blueprint : modifier ne change pas 40 règles."
---

Un blueprint est une règle écrite une seule fois, avec des blancs. « Quand *ce moteur* tourne depuis plus de *cette durée*, signale-le, et arrête-le si *je te le demande*. » Quelqu'un qui sait ce que la règle doit faire l'écrit une fois. Tous les autres remplissent les blancs, par pompe, par cuve, par ligne, et obtiennent à l'arrivée une automatisation ordinaire.

L'alternative, c'est ce que toute usine connaît déjà : la même règle copiée sur quarante pompes, puis corrigée sur trente-sept le jour où quelqu'un trouve l'erreur. Les copies divergent. Un blueprint et quarante jeux d'entrées, non.

Ce qui en sort est une règle normale. Elle apparaît sur l'écran Automatisations à côté de celles écrites à la main, elle est armée par le même moteur, et chaque écriture qu'elle fait passe par la barrière d'écriture sous le nom `automation:<id>`, auditée, refus compris. Il n'y a ni moteur d'exécution de blueprints ni porte dérobée. Il y a un formulaire, et il y a une règle.

## La seule règle à retenir sur les blueprints

**Une règle garde la version du blueprint dont elle est issue.**

Modifiez un blueprint et sa version augmente. Aucune règle qui en est issue ne change. La règle de la pompe 7, juste le mardi, ne devient pas discrètement une autre règle parce que quelqu'un a modifié son blueprint le mercredi en pensant à la pompe 12, alors que la pompe 7 est celle qui inonde le sous-sol.

Passer une règle à la nouvelle version est une **mise à niveau**, et une mise à niveau est une chose qu'une personne demande :

1. L'écran Automatisations l'indique sur la règle : *Issue du blueprint Moteur en marche trop longtemps, version 1*, et *version 2 disponible*.
2. **Examiner la mise à niveau** montre exactement ce qui change, partie par partie, avant et après, et ce que ferait la règle si elle se déclenchait maintenant, chaque écriture étant soumise aux contrôles de la barrière. Rien n'a encore changé.
3. **Mettre à niveau** applique exactement ce qui a été examiné. Si le blueprint a encore évolué, ou si quelqu'un d'autre a mis la règle à niveau entre-temps, l'opération est refusée et vous regardez de nouveau. Ce que vous avez examiné est ce qui entre, ou rien n'entre.

Elle est journalisée avec l'auteur : *automatisation mise à niveau du blueprint pump_watch de la version 1 à la version 2*.

Si quelqu'un a modifié la règle à la main depuis sa création, l'examen montre cette modification comme remplacée. Aucune modification ne disparaît sans être passée d'abord à l'écran.

## À quoi ça ressemble

```json
{
  "id": "pump_watch",
  "name": "Pump start watch",
  "description": "Says when a pump starts, with the limit it runs to.",
  "inputs": [
    {"name": "pump", "label": "Pump", "type": "entity", "domain": ["switch"], "required": true},
    {"name": "limit", "label": "Limit", "type": "number", "min": 0, "max": 100, "step": 5, "unit": "%", "required": true}
  ],
  "template": {
    "triggers": [{"type": "state", "entityId": {"!input": "pump"}, "to": "on"}],
    "condition": "float(states['sensor.tank_level']) < ${limit}",
    "actions": [
      {"type": "log_event", "params": {"message": "${pump} started, running to ${limit}%"}}
    ],
    "mode": "skip"
  }
}
```

- **`id`** se compose de lettres minuscules, de chiffres et de traits de soulignement, et commence par une lettre.
- **`inputs`** sont les blancs, typés. Les mêmes champs que partout dans HotLoop : `number` avec `min`, `max`, `step` et `unit`, `text` avec `max_length` et `pattern`, `boolean`, `select` avec `options`, `entity` avec les `domain` qu'il accepte, `duration` (secondes, ou `90s`, `1h30m`), `alarm` et `tag`. Chacun peut être `required` ou avoir un `default`.
- **`template`** est la règle : `description`, `triggers`, `condition`, `actions`, `mode`, `minIntervalSec`, `maxRuntimeSec`, dans le langage d'automatisation ([Automatisations](/fr/iot/automations/)). Pas son `id`, son `name` ni son `enabled`. Ceux-là appartiennent à chaque règle qui en est issue.

### Les blancs

**`{"!input": "pump"}`** comme valeur est remplacé par la valeur de l'entrée, avec son type : un entity_id arrive dans `entityId` sous forme de chaîne, une durée arrive dans `forSec` sous forme de nombre. Une entrée facultative que personne n'a remplie vaut `null`.

**`${pump}`** à l'intérieur d'une chaîne est remplacé aussi, et la façon dépend de l'endroit :

- Dans une expression (la `condition` d'une règle, l'`expression` d'une action, une valeur de `dataExpressions`, `argExpressions`, `fieldExpressions` ou `paramExpressions`, et tout ce qui se trouve entre `{{` et `}}` dans un message), il entre comme **littéral**. Une chaîne est entre guillemets, un nombre est un nombre, `true`, `false`, `nil`. Ainsi la condition ci-dessus, avec une limite de 40, devient `float(states['sensor.tank_level']) < 40`.
- Partout ailleurs, c'est du texte brut : `switch.pump_1 started, running to 40%`.

**`${counter.domain}`** est le domaine d'une entrée de type entité, pour un nom de service qui doit correspondre au type d'entité choisi : `"${counter.domain}.reset"` donne `counter.reset` pour le compteur d'un automate et `input_counter.reset` pour un compteur auxiliaire.

Cette mise entre guillemets est toute la raison pour laquelle une entrée de texte peut s'utiliser sans risque dans une expression. Saisissez `' || true || '` dans une entrée de texte et la condition compare à cette chaîne, exactement telle que saisie. Elle ne devient jamais une partie de l'expression. Et une entrée de texte ne peut pas contenir `{{` du tout : chaque message envoyé par une règle exécute comme une expression ce qui se trouve entre `{{` et `}}` au moment de l'envoi, et une valeur saisie dans un formulaire ne peut jamais en devenir une.

### Vérifié à l'enregistrement

Un blueprint est vérifié avant d'être stocké, et non quand quelqu'un l'essaie :

- chaque blanc nomme une entrée, et `.domain` ne suit qu'une entrée de type entité ;
- chaque entrée est utilisée quelque part. Une entrée que le modèle ignore est un champ de formulaire qui ne fait rien, et quelqu'un y perdra un après-midi ;
- remplie avec des valeurs d'exemple du type de chaque entrée (sa valeur par défaut quand elle en a une), le modèle produit une règle qui compile. Une entrée de texte qui devient une URL a besoin d'un `pattern` qui le dit, `https?://\S+`, sinon la vérification d'URL refuse l'exemple.

## Le remplir

Sur l'écran **Blueprints**, **Utiliser** ouvre le formulaire : l'id et le nom de la règle, et chaque entrée sous la forme du bon contrôle, un nombre avec sa plage, une liste, un sélecteur d'entité. Ensuite :

- **Vérifier d'abord** indique la règle qui serait créée et ce qu'elle ferait si elle se déclenchait maintenant : la condition évaluée, chaque écriture et appel de service soumis aux propres contrôles de la barrière d'écriture sous le nom `automation:<id>`, et le premier refus dans les mots de la barrière. Rien n'est stocké, écrit ni audité.
- **Créer la règle** la crée, armée sauf si vous décochez cette option, et elle apparaît sur l'écran Automatisations avec son origine.

Chaque entrée est vérifiée d'abord et **jamais ajustée pour convenir**. 150 pour une entrée dont le maximum est 100 est refusé, pas ramené discrètement à 100. `"12"` pour un nombre est refusé, pas interprété. Toutes les entrées erronées sont signalées d'un coup, de sorte que le formulaire revient avec la liste complète. Une valeur que la règle elle-même refuse (une durée de deux jours pour une temporisation d'un jour au plus) est refusée dans les mots de la règle. Rien n'est créé tant que tout n'est pas correct.

Créer une règle **n'en remplace jamais une**. Un id déjà pris, par une règle écrite à la main ou issue d'un blueprint, est refusé.

Par l'API, c'est `POST /api/blueprints/{id}/instantiate`, avec `?dry_run=true` pour la vérification. Voir [l'API HTTP](/fr/iot/api/#blueprints).

## Les blueprints intégrés

Ils sont livrés dans le binaire. Ils sont en lecture seule ; **Copier** en crée un à vous sous un nouvel id, à partir de la version 1, à modifier comme vous voulez.

| Blueprint | Entrées | Ce que fait la règle |
|---|---|---|
| `motor_running_too_long` | un moteur, la durée de marche permise (une heure par défaut), s'il faut l'arrêter | Quand le moteur est resté `running` aussi longtemps d'une traite, journalise un avertissement. Si on le demande, l'arrête avec `motor.stop`. |
| `tank_high_level_stop_pump` | un capteur de niveau, la limite, la pompe (un moteur) | Quand le niveau est à la limite ou au-dessus, que la qualité de la mesure est bonne et que la pompe n'est pas déjà arrêtée, arrête la pompe et le journalise. |
| `alarm_to_notify` | une alarme, l'état sur lequel agir (`unack-active` par défaut), une URL de webhook | Quand l'alarme passe à cet état, envoie en POST `{"text": "Alarm temp-hi is unack-active"}` à l'URL. |
| `device_silent_cycle_its_port` | le capteur de présence d'un appareil, la durée de silence permise (5 minutes par défaut), le tag de cycle d'alimentation de l'appareil UniFi et de son port, le délai d'attente ensuite (3 minutes par défaut), une alarme, l'écart minimal entre deux exécutions (une heure par défaut) | Quand l'appareil est éteint depuis cette durée, coupe et rétablit une fois l'alimentation du port de son commutateur par la barrière d'écriture, attend son retour et, s'il n'est pas revenu, lève l'alarme. Le pilote refuse un second cycle du même port dans les 15 minutes et ne cycle jamais un port qui porte le réseau. |
| `shift_schedule_counter_reset` | un auxiliaire de planification, un compteur (d'automate ou auxiliaire) | Quand la planification passe à actif, remet le compteur à zéro et le journalise. |

Quelques remarques franches à leur sujet :

- **`tank_high_level_stop_pump` est un confort, pas un verrouillage.** Un déclenchement qui protège des personnes ou l'usine appartient à l'automate, câblé là où il faut, pas à quoi que ce soit qui tourne sur un réseau. Celui-ci évite à quelqu'un de surveiller un niveau. Il ne remplace pas le contacteur de niveau haut.
- Il n'agit pas sur une mesure en laquelle il ne peut pas avoir confiance. Un niveau de mauvaise qualité n'arrête rien, parce qu'un arrêt fondé sur un chiffre absurde reste un arrêt.
- **`shift_schedule_counter_reset` se déclenche quand la planification passe à actif**, et deux plages de planification qui se touchent ne forment qu'un seul intervalle d'activité. Donnez donc à chaque équipe sa propre plage, avec la planification éteinte entre elles, ne serait-ce qu'une minute (06:00 à 13:59, 14:00 à 21:59), faute de quoi seule la première équipe de la série remet le compteur à zéro.
- **`alarm_to_notify`** convient à un salon de discussion ou à un système de tickets. Pour appeler un téléphone, avec limites de fréquence, nouvelles tentatives et liens d'acquittement, utilisez les notifications qu'envoie HotLoop lui-même ([Notifications d'alarme](/fr/iot/notifications/)).

## Qui peut faire quoi

| <span class="sr-only">Détails</span> | lecteur | opérateur | administrateur |
|---|---|---|---|
| Voir les blueprints (`blueprints.read`) | oui | oui | oui |
| En faire une règle, mettre une règle à niveau (`blueprints.apply`) | non | oui | oui |
| Écrire, modifier, copier, supprimer un blueprint (`blueprints.write`) | non | non | oui |

Pourquoi les opérateurs peuvent créer des règles : le blueprint est l'endroit où un ingénieur a décidé ce que fait la règle, et choisir quelle pompe elle surveille est exactement la décision qu'un opérateur prend toute la journée. La partie dangereuse, ce que la règle commande, a été décidée à l'écriture du blueprint, par quelqu'un qui détient `blueprints.write`. Supprimer ou modifier la règle à la main ensuite reste `automations.write`, administrateur.

Supprimer un blueprint dont une règle est issue est refusé, avec le nom des règles. Supprimez-les d'abord. Un blueprint intégré ne peut être ni modifié ni supprimé.

## Agents

Un agent reçoit `list_blueprints`, `preview_blueprint` et `instantiate_blueprint` (ainsi que `upgrade_blueprint_automation`, `create_blueprint`, `update_blueprint` et `delete_blueprint`) : il trouve le bon blueprint, détermine les entrées, montre ce que ferait la règle et la crée, par la route que l'écran utilise, avec les mêmes contrôles d'entrées et le nom de l'agent inscrit dans le journal de bord. Une règle est un ordre permanent de commander des équipements chaque fois que son déclencheur se produit, donc l'aperçu vient d'abord, et chaque écriture que la règle fait ensuite rencontre la barrière d'écriture. Voir [MCP](/fr/iot/mcp/#blueprints).

## Où tout cela est conservé

- **Les blueprints** écrits par l'usine sont dans la table `blueprints`. Les blueprints intégrés sont dans le binaire et ne sont jamais stockés.
- **Une règle issue d'un blueprint** est une ligne de `automations` comme les autres, avec `blueprint_id`, `blueprint_version` et `blueprint_inputs` qui indiquent son origine. `GET /api/automations` les renvoie sous les noms `blueprintId`, `blueprintVersion` et `blueprintInputs`.
- **Chaque modification** figure dans le journal système et le journal de bord, avec son auteur : *blueprint créé*, *blueprint enregistré, désormais version 2*, *automatisation créée à partir du blueprint motor_running_too_long version 1*, *automatisation mise à niveau du blueprint pump_watch de la version 1 à la version 2*, *blueprint supprimé*.
- **Les sauvegardes** contiennent à la fois les blueprints et la version épinglée de chaque règle, si bien qu'une usine restaurée propose exactement les mises à niveau qu'elle proposait avant. Une sauvegarde antérieure aux blueprints restaure chaque règle comme écrite à la main.
- Une règle dont le blueprint a disparu (un blueprint intégré qu'une version ultérieure a retiré, par exemple) continue de fonctionner exactement comme elle est. Il n'y a simplement rien vers quoi la mettre à niveau.
