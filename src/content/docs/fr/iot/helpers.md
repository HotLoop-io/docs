---
title: "Assistants"
description: "Les valeurs qui appartiennent aux gens de l'usine, comme l'objectif de lot ou l'équipe : interrupteurs, nombres, listes, textes, compteurs, minuteries, horaires"
---

Un assistant est une valeur qui appartient aux gens de l'usine et non à un automate. « La ligne 2 est en changement de série. » « L'objectif de lot du jour est de 1 250 kg. » « L'équipe B est en poste. » « Douze pièces rebutées depuis la dernière remise à zéro. » « Il reste neuf minutes à la purge. » Rien de tout cela ne vit dans un registre, et tout cela est exactement ce que les règles et les écrans ont besoin de savoir.

HotLoop en compte sept sortes. Un assistant est une entité comme une autre : il a un `entity_id`, un état, des attributs et des services, il se place dans l'arbre des équipements, il apparaît dans `/api/states`, sur l'écran Entités, dans `list_entities` via MCP et dans le déclencheur d'état d'une automatisation. Ce qui change, c'est l'endroit où vit sa valeur : HotLoop la garde, dans la base de données, et **aucun service d'un assistant n'écrit jamais un tag**.

## Les sept

| Domaine | État | Options | Services |
|---|---|---|---|
| `input_boolean` | `on` / `off` | `initial` (true/false), `restore` | `turn_on`, `turn_off`, `toggle` |
| `input_number` | le nombre, `"1250"` | `min`, `max` (les deux obligatoires), `step` (1 par défaut), `mode` (`slider` ou `box`), `initial`, `restore`, et une `unit_of_measurement` | `set_value {value}`, `increment`, `decrement` |
| `input_select` | le choix | `choices` (obligatoire, jusqu'à 100), `initial`, `restore` | `select_option {option}`, `select_next {cycle}`, `select_previous {cycle}` |
| `input_text` | le texte | `max_length` (par défaut et plafond 255), `pattern`, `initial`, `restore` | `set_value {value}` |
| `input_counter` | un nombre entier | `initial` (0 par défaut), `step` (1 par défaut), `min`, `max`, `restore` | `increment`, `decrement`, `reset`, `set_value {value}` |
| `timer` | `idle` / `active` / `paused` | `duration_sec` (obligatoire, de 1 seconde à 7 jours), `restore` | `start {duration}`, `pause`, `cancel`, `finish` |
| `schedule` | `on` / `off` | `schedule` (obligatoire) | aucun : il suit l'horloge |

Le compteur est `input_counter`, pas `counter`. `counter` est déjà le composite d'automate dont la remise à zéro écrit un tag, et il reste exactement ce qu'il est.

Chaque option est vérifiée quand l'assistant est enregistré, et `initial` par rapport à toutes les autres : un `input_number` de 0 à 100 qui démarre à 150 est refusé, il n'est pas démarré à 100. Une option qu'un domaine n'accepte pas est une erreur, pas un réglage ignoré en silence. Les options d'assistant (`initial`, `restore`, `choices`, `duration_sec`, `mode`, `schedule`) sont refusées sur tous les autres domaines pour la même raison.

## En créer un

Un administrateur crée des assistants (`entities.write`). Sur l'écran Entités, **Nouvel assistant**, à côté de Nouvel équipement. Par l'API :

```
POST /api/helpers
{"name": "Batch target", "domain": "input_number", "unit_of_measurement": "kg",
 "options": {"min": 0, "max": 5000, "step": 50, "initial": 1000}}
```

L'`entity_id` est fabriqué à partir du nom (`input_number.batch_target`) sauf si vous en donnez un. `PUT /api/helpers/{entity_id}` change son nom, son icône, son unité ou ses options ; `DELETE /api/helpers/{entity_id}` le supprime avec sa valeur. Toute l'API est dans [l'API HTTP](/fr/iot/api/#helpers).

Un changement d'options qui laisserait la valeur actuelle de l'assistant hors de leurs limites est refusé : resserrer une plage en dessous de la valeur, ou retirer le choix qui est sélectionné. Fixez d'abord la valeur, ou choisissez des options qui l'incluent. Une valeur n'est jamais déplacée pour entrer dans les limites.

## En fixer un

Toute personne qui a `helpers.write` fixe des assistants. Les opérateurs l'ont : manier le sélecteur d'équipe et compter les rebuts relève de l'exploitation, pas de la configuration. Les lecteurs ne l'ont pas. Ce n'est pas `values.write`, parce qu'un assistant n'écrit aucun tag.

Fixer un assistant est un appel de service d'entité, le même appel que prend toute autre entité :

```
POST /api/services/input_counter/increment   {"entity_id": "input_counter.scrap", "reason": "short shot"}
POST /api/services/timer/start               {"entity_id": "timer.purge", "duration": "0:15:00"}
```

La réponse dit ce qu'est l'assistant maintenant : `{"call_id": "...", "state": "13", "writes": []}`. `?dry_run=true` fonctionne aussi et répond dans les mêmes termes que le vrai appel, sans rien changer.

Sur l'écran Entités, un assistant a sa propre tuile, jamais fusionnée avec une autre (il n'a pas de tags par lesquels fusionner), avec ses commandes pour qui détient `helpers.write`. Chaque changement est d'abord confirmé, avec un motif, comme toute autre commande.

Côté MCP, il n'y a aucun nouvel outil : `list_entities` trouve les assistants, `get_states` les lit, `call_service` les fixe. Un agent ne change un assistant que sur un déploiement où `HOTLOOP_ALLOW_WRITES` est activé, le même commutateur qu'il faut pour écrire un tag. Un assistant ne bouge aucun équipement, mais c'est sur lui que les règles agissent, et un agent qui bascule l'interrupteur de changement de série est un agent qui lance ce que fait la règle de changement de série.

## Refusé, jamais tronqué

Une valeur qu'un assistant n'accepte pas est refusée, et rien ne change :

- un nombre hors de `min`..`max`, ou hors de son `step` (compté à partir de `min`) ;
- un `increment` qui dépasserait `max`, un `decrement` qui passerait sous `min` (refusé, pas arrêté à la limite : « arrêté à la limite » est une valeur que personne n'a demandée) ;
- une option qui ne figure pas parmi les choix possibles ; `select_next` après le dernier choix avec `cycle: false` ;
- un texte plus long que `max_length`, ou qui ne correspond pas à `pattern` (le texte entier doit correspondre) ;
- un compte qui n'est pas un nombre entier, ou qui dépasse le `min` ou le `max` du compteur ;
- une minuterie mise en pause alors qu'elle ne tourne pas, annulée ou terminée alors qu'elle est inactive, ou démarrée pour moins d'une seconde ou plus de sept jours ;
- un assistant désactivé ; un appelant sans `helpers.write` ; un agent dont les écritures MCP sont désactivées.

Chaque refus est un avertissement dans le journal système (`GET /api/events`) sur l'assistant, avec qui l'a demandé et pourquoi il a été refusé, exactement comme le refus d'un acquittement d'alarme. Une erreur dans la requête elle-même (un champ que le service n'accepte pas, `"50"` là où un nombre est attendu) est une erreur de l'appelant, répondue par un 400, et ne change ni n'enregistre rien.

## Où les changements sont enregistrés

Chaque changement est une ligne du journal système sur l'assistant : qui, de quoi, vers quoi, l'identifiant de l'appel, d'où il venait, et le motif s'il y en avait un.

```
otto   input_counter.increment: 12 -> 13; reason: short shot
system timer finished: active -> idle, due at 2026-09-27T21:10:00Z
```

La ligne est écrite dans la même transaction que la valeur, donc il n'y a jamais de changement sans sa ligne ni de ligne sans son changement.

Un changement d'état est aussi une ligne dans le [journal](/fr/iot/logbook/), dans cette même transaction, avec le même qui, la même source et le même identifiant d'appel. Elle est écrite par le processus qui a fait le changement, quel qu'il soit, donc le changement d'un agent par `--mcp-stdio` est lui aussi journalisé, et une seule fois. Les lignes d'assistant ne sont jamais limitées en fréquence : chacune est quelqu'un qui décide quelque chose. Un appel qui laisse l'état tel qu'il était (un nombre réglé à la valeur qu'il a déjà) figure dans le journal système mais pas dans le journal, parce que rien n'a changé.

## Redémarrages

Un assistant garde sa valeur après un redémarrage : le Gateway revient avec l'équipe encore B et le compteur encore à 13. Mettez `restore: false` sur celui qui doit repartir de zéro à chaque fois (un compteur « depuis le dernier redémarrage ») : le Gateway le remet à sa valeur initiale au démarrage et le dit dans le journal. Seul le Gateway lui-même le fait. Un processus `--mcp-stdio` qu'un agent lance à côté d'un Gateway en marche détient les mêmes assistants et entend chaque changement, mais ne remet jamais rien à zéro, car réinitialiser les valeurs de l'usine parce qu'un agent s'est connecté serait absurde.

## Minuteries

Une minuterie tourne sur l'horloge murale. Lancée pour dix minutes, elle se termine dix minutes plus tard quoi qu'il arrive entre-temps : un redémarrage de deux minutes lui laisse huit minutes à courir. Une minuterie en pause reste en pause, avec le temps qu'il lui restait, au fil d'un nombre quelconque de redémarrages, et `start` la reprend.

Une minuterie arrivée à échéance **alors qu'aucun HotLoop ne tournait** revient à `idle` au prochain démarrage de HotLoop, avec `finished_late_at` réglé sur l'heure à laquelle elle était due, et un avertissement dans le journal. **Rien ne se déclenche pour elle.** Une règle qui attend que cette minuterie devienne inactive ne s'exécute pas, parce que le premier regard du moteur sur elle après un démarrage est une référence, pas un changement. Ce qu'elle chronométrait (une purge, une cuisson) s'est passé il y a longtemps ou pas du tout, et le faire maintenant, en retard et sans que personne l'ait demandé, est pire que de dire qu'on l'a manqué. Cherchez `finished_late_at` et décidez.

Une minuterie n'est pas un verrouillage de sécurité. Elle tourne sur l'horloge d'un processus, à travers une base de données et un réseau, à la seconde et généralement à la milliseconde. Tout ce qui doit s'arrêter à l'heure relève de l'automate.

## Plannings

Un planning est actif dans ses blocs et inactif en dehors :

```json
{"schedule": {
  "mon": [{"from": "06:00", "to": "14:00", "data": {"crew": "A"}},
          {"from": "14:00", "to": "22:00", "data": {"crew": "B"}}],
  "fri": [{"from": "22:00", "to": "06:00", "data": {"crew": "C"}}]
}}
```

- Les jours vont de `mon` à `sun`. Une heure s'écrit `HH:MM` ou `HH:MM:SS` ; `24:00` est la fin d'une journée.
- Un bloc dont le `to` est antérieur au `from` passe minuit : de 22:00 à 06:00 le vendredi, il est actif jusqu'à samedi 06:00.
- Les blocs qui se touchent forment un seul tronçon actif ; les blocs qui se chevauchent sont refusés, parce que choisir les données de l'un ou de l'autre reviendrait à deviner.
- Pendant qu'un bloc est actif, son `data` est dans les attributs de l'entité (`crew: "B"`), et `next_event` dit toujours quand le planning change ensuite.
- Il se lit sur l'horloge murale du fuseau horaire du site (`HOTLOOP_SITE_TIMEZONE`), parce qu'une équipe qui commence à 06:00 commence à 06:00 aussi le jour du changement d'heure. La nuit où l'on avance les horloges, l'heure qui n'existe pas n'est pas active ; la nuit où on les recule, l'heure qui arrive deux fois est active les deux fois.

## Plus d'un processus

Chaque changement est annoncé par un `NOTIFY` de Postgres, et chaque processus qui détient les assistants écoute. Un assistant réglé dans un processus montre sa nouvelle valeur dans tous les autres en un aller-retour, un assistant créé ou supprimé dans l'un apparaît ou disparaît dans les autres, et un changement fait par `PUT /api/helpers/{entity_id}` est pris en compte de la même façon (un changement fait par `PUT /api/entities/{entity_id}` parvient aux autres à leur prochaine synchronisation du registre, comme celui de n'importe quelle entité). Chaque écriture est conditionnée à la révision de la ligne, donc deux processus qui comptent le même compteur en même temps ne perdent jamais un comptage, et une minuterie que les deux détiennent est terminée par un seul des deux.

## Sauvegardes

Les assistants sont dans chaque sauvegarde : leur configuration avec les entités, et leurs valeurs dans `helper_state`, révisions comprises. Une usine restaurée revient avec l'équipe, les objectifs et les comptages qu'elle avait, et une minuterie qui tournait tourne toujours sur l'horloge murale (ou, si elle est arrivée à échéance entre-temps, inactive et marquée en retard, comme ci-dessus).

## Dans les automatisations

Un assistant est ce sur quoi les règles agissent et qu'elles fixent :

```json
{"triggers": [{"type": "state", "entityId": "input_boolean.changeover", "to": "on"}],
 "actions": [{"type": "call_service", "params": {"entityId": "number.line_2_speed_sp",
   "service": "number.set_value", "data": {"value": 0}}}]}
```

L'écriture de la règle sur le tag passe par la barrière d'écriture comme n'importe quelle autre, avec la règle comme acteur. `states['input_select.shift'] == 'B'` fonctionne dans une condition, et une règle peut fixer un assistant avec `call_service` de la même façon qu'elle actionne un interrupteur.
