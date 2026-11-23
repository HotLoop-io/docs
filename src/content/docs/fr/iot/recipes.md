---
title: "Recettes de produit"
description: "Les consignes d'une qualité de produit appliquées d'un coup : vérifiées en bloc, refusées en bloc, écrites dans l'ordre et relues depuis l'appareil."
---

Une recette est un ensemble de valeurs qui partent ensemble vers l'usine. Les températures de zone, la vitesse de ligne et l'ouverture de filière de la qualité A. Le passage à la bouteille de 500 ml. L'abaissement de nuit. Toute usine a cela, et toute usine a quelque part une feuille plastifiée avec les chiffres dessus et un opérateur qui les saisit un par un, et toute usine a l'histoire de la nuit où l'un d'eux a été mal saisi.

Alors les chiffres vivent ici, et ils partent d'un coup : vérifiés en bloc d'abord, envoyés dans l'ordre, relus depuis l'appareil ensuite, chacun d'eux consigné. Chaque recette est aussi une entité, `scene.<id>`. Elle est conçue pour des équipements qui peuvent blesser quelqu'un, et c'est pourquoi la plus grande partie de cette page traite de ce qui se passe quand quelque chose tourne mal.

## À quoi ça ressemble

```json
{
  "id": "grade_a",
  "name": "Grade A",
  "description": "The 2pm run. Die at 210, line at whatever the order says.",
  "equipment_id": 7,
  "apply_permission": "recipes.apply",
  "params": [
    {"name": "speed", "label": "Line speed", "type": "number", "min": 0, "max": 400, "step": 10, "unit": "rpm", "required": true}
  ],
  "precondition": "states['input_boolean.line_ready'] == 'on'",
  "targets": [
    {"entity_id": "loop.line_02_die_tic", "service": "set_mode", "data": {"mode": "auto"}},
    {"entity_id": "loop.line_02_die_tic", "service": "set_setpoint", "data": {"value": 210}},
    {"entity_id": "number.line_02_speed", "service": "set_value", "data_expressions": {"value": "vars.speed"}},
    {"entity_id": "switch.line_02_heater", "service": "turn_on"},
    {"entity_id": "input_select.product", "service": "select_option", "data": {"option": "Grade A"}}
  ],
  "verify_sec": 10
}
```

- **`id`** se compose de lettres minuscules, de chiffres et de traits de soulignement, et commence par une lettre. C'est l'id d'objet de son entité, `scene.grade_a`, et il ne change jamais.
- **`equipment_id`** est le nœud de l'arbre des équipements auquel la recette appartient, pour la retrouver. L'écran Recettes regroupe selon lui. Omettez-le pour une recette de toute l'usine.
- **`params`** sont ce que prend une application : les mêmes champs typés qu'un script (`model.Field` : `number` avec `min`, `max`, `step` et `unit`, `text`, `boolean`, `select`, `entity`, `duration`, `alarm`, `tag`). Une cible en lit un sous la forme `vars.<name>` dans une entrée de `data_expressions`.
- **`precondition`** est une expression du langage d'automatisation qui doit être vraie pour que la recette démarre. Omettez-la et il n'y en a pas.
- **`targets`** sont les valeurs, **dans l'ordre où elles partent**. Chacune est une entité, le service qui la règle et les données de ce service, comme valeur (`data`) ou calculées à partir des paramètres (`data_expressions`). Jusqu'à 200.
- **`verify_sec`** est le temps laissé à chaque valeur écrite pour apparaître dans une lecture de l'appareil. De 1 à 600, 10 par défaut.

### Ce que peut être une cible

Une recette **règle des valeurs**. Les services qu'elle accepte sont ceux qui laissent l'équipement sur une valeur :

| Domaine | Services |
|---|---|
| `switch`, `input_boolean` | `turn_on`, `turn_off` |
| `number`, `input_number`, `input_counter` | `set_value` |
| `text`, `input_text` | `set_value` |
| `select`, `input_select` | `select_option` |
| `valve` | `set_position` |
| `motor` | `set_speed` |
| `loop` | `set_setpoint`, `set_mode` |

Un appui sur un bouton, un démarrage de moteur, une remise à zéro de compteur, un arrêt de vanne : refusé à l'enregistrement. Ce sont des actions, pas des valeurs, et elles appartiennent à un [script](/fr/iot/scripts/). « Appliquer la qualité A » qui appuie sur un bouton de remise à zéro chaque fois que quelqu'un l'applique n'est pas ce que quiconque entend par recette, et le jour où cela arrive en pleine production est le jour où vous l'apprenez. L'inversion (toggle) est refusée aussi : une recette qui bascule un interrupteur fait le contraire une fois sur deux.

L'entité d'une cible doit exister à l'enregistrement, ses expressions doivent compiler, et la même entité ne peut pas être réglée deux fois par le même service (deux valeurs pour un seul réglage, et celle qui l'emporterait dépendrait d'un ordre que personne ne lit). Le mode et la consigne d'une boucle sont deux réglages et les deux peuvent être réglés ; réglez le mode d'abord, car une consigne pour l'automatique ne veut rien dire pour une boucle restée en manuel.

## L'appliquer

Depuis l'écran Recettes, la tuile de la recette sur l'écran Entités, une étape `apply_recipe` d'une règle ou d'un script, le `apply_recipe` de MCP ou `POST /api/services/scene/turn_on`. Chacun fait exactement ceci :

### 1. Vérifiée en bloc, refusée en bloc

Avant qu'une seule valeur parte où que ce soit :

- Les paramètres sont vérifiés par rapport à leurs champs. **Une valeur n'est jamais ajustée pour convenir.** 450 sur un champ dont le maximum est 400 est refusé, pas ramené à
  400. `"250"` pour un nombre est refusé, pas interprété. 255 sur un pas de 10 est refusé, pas arrondi. Le nombre qui part vers l'usine est exactement celui que quelqu'un a saisi, ou rien ne part.
- Le droit propre de la recette, quand elle en nomme un (plus bas), et les interrupteurs d'écriture de MCP, pour un agent.
- La précondition est évaluée par rapport à l'usine telle qu'elle est maintenant.
- Chaque expression de données est évaluée. Une seule qui échoue refuse la recette ; une cible n'est jamais envoyée sans la valeur qu'elle devait avoir.
- Rien d'autre dans ce processus ne doit être en train d'écrire sur l'une de ses entités (plus bas).
- **Chaque cible est soumise aux propres contrôles de la barrière d'écriture**, ceux que rencontrera son écriture : écritures activées, tag inscriptible, valeur dans la plage du tag, entité activée et d'accord avec la valeur (son pas, ses options, une boucle en manuel pour sa sortie), appareil connecté. `Services.Check`, qui pour un tag est `runtime.Manager.CheckWrite`. Rien n'est écrit ni audité.

**Si quoi que ce soit échoue, toute la recette est refusée et rien n'est écrit.** Pas les dix premières cibles puis un refus. Rien. Et vous recevez toutes les raisons, pas seulement la première : un opérateur à qui on dit un problème le corrige puis on lui dit le suivant, et une recette de quarante cibles doit se corriger d'un coup. Chaque cible dit laquelle elle était : `would_write`, `refused` avec les mots de la barrière, ou `not_sent`.

### 2. Écrite dans l'ordre, un id d'appel, jamais annulée

Ensuite les cibles partent dans l'ordre, chacune par `Services.Call` et donc par `runtime.Manager.Write`, l'unique barrière d'écriture. Il n'y a pas de porte dérobée. Chaque écriture porte l'**id d'appel** de l'application, si bien que toute l'application est `GET /api/writes?call=<id>`, dans la piste d'audit, à côté de toutes les autres écritures que l'usine ait jamais acceptées.

Un contrôle peut passer et l'écriture échouer un instant plus tard. Un automate répond à une écriture par une exception. Quelqu'un arrache un câble. Quelqu'un désarme un tag entre le contrôle et l'écriture. **La première cible qui ne passe pas arrête l'application.** Les suivantes ne sont pas envoyées et indiquent `skipped`.

**Rien de ce qui est déjà écrit n'est annulé.** C'est délibéré, et c'est la règle que suit chaque écriture HotLoop. Annuler est en soi une écriture : faite sans que personne ne la demande, sur des équipements qui ont déjà bougé, d'après ce que nous croyons avoir été la valeur avant, au moment précis où quelque chose vient de prouver que l'usine ne se comporte pas comme prévu. C'est ainsi qu'une recette à moitié appliquée devient une ligne complètement déroutée. Décider quoi faire d'une recette à moitié appliquée est le travail de l'opérateur, et il reçoit exactement les informations pour le faire :

```text
PARTIAL v3: 2 of 5 written before one failed, nothing undone
  1. set_mode loop.line_02_die_tic: written, verified
  2. set_setpoint loop.line_02_die_tic: written, verified
  3. set_value number.line_02_speed: failed: the device answered the write with an exception
  4. turn_on switch.line_02_heater: skipped
  5. select_option input_select.product: skipped
```

Une cible est `written`, `failed` (elle est partie et l'appareil a dit non, ou n'a rien dit, si bien qu'on ignore si elle a été prise en compte), `not_sent` (la barrière l'a refusée au dernier moment) ou `skipped`. L'application est `applied` (toutes les cibles écrites), `partial` (certaines l'ont été) ou `failed` (la première ne l'a pas été).

L'écran Recettes propose alors **Appliquer les cibles restantes**. C'est une nouvelle application, des cibles qui n'ont pas été écrites, avec la même version et les mêmes paramètres, vérifiée de nouveau en bloc d'abord, auditée sous un id d'appel qui lui est propre, avec `application:<id>` pour parent afin que les deux se retrouvent ensemble. Elle n'est jamais automatique. Quelqu'un regarde ce qui s'est passé, corrige ce qui l'a arrêtée et appuie sur le bouton.

### 3. Relue

Écrit n'est pas la même chose que pris en compte. Un automate peut accepter une écriture et sa propre logique l'écraser au cycle suivant. Un registre mis à l'échelle peut prendre 12,34 et garder 12,3. Donc après la dernière écriture, chaque valeur écrite est relue :

- pour une cible sur un appareil, uniquement à partir d'une lecture **faite après son écriture**, pour que le cache qui se souvient de ce que l'appareil a dit avant ne puisse rien confirmer ;
- à partir de l'état de l'entité ou, pour une vanne, un moteur et une boucle, de l'attribut que règle le service (`current_position`, `speed`, `setpoint`, `mode`) ;
- un nombre à un millionième près (un registre flottant rend 0,1 sous la forme 0,10000000149, qui est la même consigne), tout le reste exactement.

Chaque cible écrite est **`verified`** une fois relue, ou **`unconfirmed`** si elle ne l'a pas été dans le délai `verify_sec`, avec ce qui a été lu à la place :

```text
  3. set_value number.line_02_speed: written, unconfirmed (not confirmed within 10s: read back 240, not 250)
```

Le non confirmé est affiché en **ambre**, jamais en vert, sur l'écran Recettes, et c'est un avertissement dans le journal de bord et le journal système. Ce n'est pas un échec : la valeur est partie et l'appareil l'a acceptée, et l'application reste `applied`. C'est un signal qui dit d'aller voir, parce qu'elle n'a peut-être pas été prise en compte. Un auxiliaire garde sa propre valeur, donc une cible auxiliaire est vérifiée directement à partir de lui.

La réponse revient une fois la relecture terminée, si bien qu'appliquer une recette prend jusqu'à `verify_sec`.

## Chevauchement

Deux recettes qui entremêlent leurs écritures vers la même consigne la laissent à celle qui est arrivée en dernier, qui n'est la recette de personne. Donc, pendant qu'une application écrit et relit, elle retient chaque entité qu'elle cible, et une autre application qui en cible une est refusée, `409`, avec la recette qui est en travers. Attendez-la, puis appliquez.

Cela est retenu dans le processus : une application du Gateway et une d'un processus `--mcp-stdio` à côté ne se retiennent pas l'une l'autre. Faites tourner un seul écrivain, ou gardez les recettes de l'agent et celles des opérateurs sur des équipements différents.

## Versions

Le nom, la description, le nœud d'équipement et le droit d'une recette sont ceux de la recette et changent sur place. **Ce qu'elle écrit est une version, et une version ne change jamais.** Enregistrer d'autres cibles, d'autres paramètres, une autre précondition ou un autre `verify_sec` stocke la version suivante et en fait la version courante. La version 3 est exactement ce qu'elle était le jour où elle a été enregistrée, pour toujours, et chaque application consigne la version et les paramètres avec lesquels elle a tourné. Ce qui est parti vers l'usine mardi dernier a toujours une réponse.

- Ne changer que le nom, ou que la note, ne crée pas de version.
- Un enregistrement fait sur une version que quelqu'un d'autre a remplacée depuis est refusé, `409`, plutôt que de jeter discrètement son changement. L'éditeur envoie la version qu'il éditait.
- Une version plus ancienne peut être appliquée exprès : choisissez-la dans le tiroir d'application, ou `"version": 2`. L'application indique que c'était la version 2.
- Le tiroir Versions montre chaque version avec son auteur, sa note, et ce qui a changé par rapport à la précédente, cible par cible.

Supprimer une recette supprime ses versions. Ses applications sont conservées : elles sont ce qui a été envoyé à l'usine, et cet historique survit à la recette.

## En capturer une

Personne n'écrit à la main une recette de quarante cibles quand la ligne tourne déjà en qualité A. **Capturer** prend les entités que vous choisissez et rédige une recette qui remet chacune à ce qu'elle contient maintenant, dans l'ordre où vous les avez choisies : la valeur d'un nombre, le marche ou l'arrêt d'un interrupteur, l'option d'un sélecteur, la position d'une vanne, la vitesse d'un moteur, le mode d'une boucle puis sa consigne. Vous la nommez, vous l'élaguez, vous transformez en paramètres les nombres qui changent à chaque commande, et vous l'enregistrez.

Une entité dont la valeur n'est pas connue, ou pas fiable, est **refusée, pas capturée** : une lecture de qualité autre que bonne, `unknown`, `unavailable`, une entité désactivée. Une recette construite à partir d'une mauvaise lecture réécrit cette mauvaise lecture dans l'usine, chaque fois que quelqu'un l'applique.

## Qui peut en appliquer une

Les opérateurs appliquent les recettes (`recipes.apply`) ; les administrateurs les écrivent (`recipes.write`) ; tout le monde les lit (`recipes.read`). Charger la qualité A, c'est ce pour quoi l'opérateur est là. Décider ce qu'est la qualité A est un choix d'ingénieur.

Une recette peut nommer un droit plus étroit qui lui est propre : `"apply_permission": "recipes.apply.night_setback"`. L'appliquer demande alors aussi celui-là, que le rôle d'opérateur n'a pas. Donnez-le aux personnes qui peuvent appliquer cette recette, par leur propre liste de droits :

```json
["recipes.read", "recipes.apply", "recipes.apply.night_setback"]
```

`recipes.apply.*` accorde celui de chaque recette, et un administrateur détient tout. Un utilisateur qui ne l'a pas est refusé, et **le refus est consigné** : une application refusée dans l'historique de la recette, avec son nom, comme n'importe quelle autre. Il en va de même par l'entité scene.

Un agent ne détient les droits d'aucun utilisateur, donc **un agent n'applique jamais une recette qui nomme son propre droit**. Il peut la lire et demander si elle s'appliquerait ; la réponse dit pourquoi non.

## La précondition

```json
"precondition": "states['input_boolean.line_ready'] == 'on' and float(states['sensor.line_02_die_temp']) < 250"
```

Le langage d'automatisation, évalué par rapport à l'usine telle qu'elle est quand quelqu'un appuie sur Appliquer, avec les paramètres sous la forme `vars`. Faux refuse la recette, en le disant. C'est une protection contre l'application des bons chiffres au mauvais moment, pas un verrouillage : un verrouillage vit dans l'automate, où il fonctionne encore quand le réseau ne le fait plus.

## Depuis une règle, un script ou un agent

Une règle ou un script en applique une avec une étape `apply_recipe` (voir [Automatisations](/fr/iot/automations/)) :

```json
{"type": "apply_recipe", "params": {"recipeId": "grade_a", "params": {"speed": 250}}}
```

Elle l'applique sous le nom de la règle, `automation:<id>`, ou du script, `script:<id>`, avec la source de cette exécution sur chaque écriture, et le parent de l'application est l'exécution. L'étape échoue sauf si chaque cible a été écrite ; une valeur non confirmée ne la fait pas échouer, et la trace dit `NOT confirmed by read-back`. L'essai à blanc d'un script vérifie aussi la recette.

Par MCP, `list_recipes` montre chaque recette avec ses cibles et ses paramètres, `validate_recipe` demande si elle s'appliquerait maintenant, et `apply_recipe` l'applique, avec une raison **obligatoire**. Les écritures d'un agent portent la source `mcp`, donc la barrière s'applique à chacune d'elles, et avec les écritures désactivées (`HOTLOOP_ALLOW_WRITES`) `apply_recipe` est refusé avant que quoi que ce soit ne soit vérifié. Voir [MCP](/fr/iot/mcp/#recettes).

## Son entité

Chaque recette est une entité `scene`, `scene.<id>`. Son état est le moment de sa dernière application (une application qui a écrit quelque chose), sous forme d'horodatage, et `unknown` tant qu'elle n'en a jamais eu. Ses attributs disent comment s'est passée la dernière application : `last_result`, `last_version`, `last_applied_by`, `last_application`, et `unconfirmed` quand autant de valeurs d'une application réussie n'ont pas été relues. Sa tuile a un bouton Appliquer. `scene.turn_on` l'applique, avec `params` et `version` dans les données. Une règle peut se déclencher sur son état, qui change une fois par application ayant écrit quelque chose.

Supprimer une recette rend son entité orpheline, comme supprimer un script.

## Le registre

Chaque application, refusées comprises, est une ligne de `recipe_applications` : la recette, la version, les paramètres, qui, d'où, pourquoi, l'id d'appel, ce qu'est devenue chaque cible et si elle a été relue. Elle est ouverte avant la première écriture et terminée après la relecture, si bien que celle dans laquelle le processus meurt au milieu dit quand même qu'elle a commencé. Le démarrage suivant du Gateway la marque `failed`, `interrupted by restart`, avec un renvoi vers son id d'appel dans l'audit des écritures. Rien ne la reprend.

Chaque application est une ligne dans le journal système sous la scène, et une entrée du [journal de bord](/fr/iot/logbook/), de genre `recipe`, à côté des écritures qu'elle a faites. L'historique d'une recette garde ses 5000 applications les plus récentes.

## Plus d'un processus

Chaque modification d'une recette et chaque application est annoncée à tous les processus sur la base de données, si bien qu'une recette enregistrée sur un pod est celle que l'autre applique, et qu'une application faite par un processus `--mcp-stdio` fait bouger l'entité scene du Gateway.

## Sauvegardes

Les recettes, chaque version et chaque application figurent dans les sauvegardes et reviennent exactement comme elles étaient. Une application que la sauvegarde a prise en cours de route revient `applying` et est marquée `failed` au premier démarrage, comme après un plantage. Voir [Sauvegarde et restauration](/fr/iot/backup/).

## L'API

[L'API HTTP](/fr/iot/api/#recettes) a chaque route. En bref :

| <span class="sr-only">Détails</span> | <span class="sr-only">Détails</span> |
|---|---|
| `GET /api/recipes` | chaque recette, son contenu actuel et sa dernière application |
| `POST /api/recipes` | en créer une, en version 1 |
| `POST /api/recipes/capture` | un brouillon d'après ce que contiennent les entités maintenant |
| `PUT /api/recipes/{id}` | enregistrer ; un nouveau contenu est une nouvelle version |
| `GET /api/recipes/{id}/versions` | chaque version, telle qu'enregistrée |
| `POST /api/recipes/{id}/validate` | s'appliquerait-elle maintenant ? rien n'est écrit |
| `POST /api/recipes/{id}/apply` | l'appliquer : `200` appliquée, `409` refusée, `502` partielle ou en échec |
| `GET /api/recipes/{id}/applications` | chaque application, refus compris |
