---
title: "Scripts de procédure"
description: "Écrivez un cycle une fois, nommez-le, lancez-le depuis une règle, un écran ou MCP. L'essai à blanc passe par la vraie barrière d'écriture avant tout mouvement."
---

Un script est une suite d'étapes qui porte un nom. Le cycle CIP. La purge de la ligne. Le changement de série vers le produit B. Toute usine a une poignée de procédures qu'elle exécute exactement de la même façon à chaque fois, et le jour où quelqu'un en copie une dans une quatrième automatisation et corrige une étape dans trois seulement, c'est ce jour-là que ça vous mord. Alors on l'écrit une fois, on lui donne un nom, et tout ce qui en a besoin l'appelle par ce nom : un opérateur depuis l'écran Scripts, une règle avec une étape `call_script`, un agent avec `run_script`, n'importe quoi via `POST /api/services/script/turn_on`.

Un script parle le langage d'automatisation, s'exécute sur le même exécuteur de séquences que les actions d'une règle, et chaque écriture qu'il fait passe par l'unique barrière d'écriture. Pas de porte dérobée. Il n'en a jamais eu.

## À quoi ça ressemble

```json
{
  "id": "cip_cycle",
  "name": "CIP cycle",
  "description": "Caustic wash, rinse, done. Tank must be empty.",
  "fields": [
    {"name": "minutes", "label": "Wash time", "type": "number", "min": 5, "max": 60, "step": 5, "unit": "min", "required": true},
    {"name": "circuit", "type": "select", "options": ["tank_1", "tank_2"], "default": "tank_1"}
  ],
  "sequence": [
    {"type": "condition", "params": {"expression": "float(states['sensor.cip_tank_level']) < 5"}},
    {"type": "call_service", "params": {"entityId": "switch.cip_pump", "service": "switch.turn_on"}},
    {"type": "delay", "params": {"seconds": 5}},
    {"type": "wait", "params": {"expression": "float(states['sensor.cip_return_temp']) > 70", "timeoutSec": 900}},
    {"type": "log_event", "params": {"message": "CIP on {{ vars.circuit }} for {{ vars.minutes }} minutes"}},
    {"type": "call_service", "params": {"entityId": "switch.cip_pump", "service": "switch.turn_off"}}
  ],
  "mode": "skip",
  "maxRuntimeSec": 1800
}
```

- **`id`** se compose de lettres minuscules, de chiffres et de traits de soulignement, et commence par une lettre. C'est aussi l'id d'objet de son entité, donc celui-ci est `script.cip_cycle`, et il ne change jamais.
- **`fields`** sont ce que prend une exécution. Les mêmes entrées typées partout dans HotLoop (`model.Field`) : `number` avec `min`, `max`, `step` et `unit`, `text` avec `max_length` et `pattern`, `boolean`, `select` avec `options`, `entity` avec les `domain` qu'il accepte, `duration` (secondes, ou `90s`, `1h30m`), `alarm` et `tag`. Chacun peut être `required` ou avoir un `default`, et une valeur par défaut que son propre champ refuserait est refusée à l'enregistrement. Une étape lit un champ sous la forme `vars.<name>`.
- **`sequence`** est le langage d'automatisation, en entier : `call_service`, `write_tag`, `condition`, `wait`, `stop`, `call_script`, `set_variable`, `delay`, `log_event` et le reste. [Automatisations](/fr/iot/automations/) décrit chaque étape.
- **`mode`** et **`maxRuntimeSec`** sont plus bas.

Un script est compilé à l'enregistrement, comme une règle : une étape qui ne se décode pas, une expression qui ne compile pas, une attente plus longue que ce qu'une exécution peut durer, un champ qui n'a pas de sens, tout est refusé à l'enregistrement. Vous le découvrez dans l'éditeur, pas à 3 h du matin avec la pompe à mi-lavage.

## Les champs sont vérifiés, jamais corrigés

Avant l'exécution de la première étape, ce que l'exécution a reçu est vérifié par rapport aux champs : chaque valeur doit être une valeur que son champ accepte, chaque champ obligatoire doit être présent, et un champ que le script n'a pas est une erreur et non quelque chose qu'on ignore en silence. **Une valeur n'est jamais ajustée pour convenir.** 70 minutes sur un champ dont le maximum est 60 est refusé, pas ramené à 60 ; `"12"` pour un nombre est refusé, pas interprété ; 12,5 sur un pas de 5 est refusé, pas arrondi. La valeur qui va commander des équipements est exactement celle que quelqu'un a saisie, ou rien ne s'exécute du tout. Une exécution refusée ne laisse aucune exécution derrière elle : rien n'a démarré.

## Le lancer

| Depuis | Comment | Nécessite |
|---|---|---|
| L'écran Scripts | **Exécuter** sur sa carte, remplissez le formulaire | `scripts.run` |
| Son entité | **Exécuter** sur sa tuile, ou `POST /api/services/script/turn_on` avec les champs comme données | `scripts.run` |
| L'API | `POST /api/scripts/{id}/run` avec `{"fields": {...}, "reason": "..."}` | `scripts.run` |
| Une règle | une étape `call_script` | le droit de la règle elle-même |
| Un agent | `run_script` par MCP | écritures MCP activées |

Les opérateurs exécutent les scripts. Les administrateurs les écrivent. Lancer le cycle CIP, c'est à cela que sert le bouton ; décider quelles vannes le cycle CIP ouvre est un choix d'ingénieur, et il le reste.

Une exécution répond dès qu'elle a démarré, avec son id. Demandez-lui d'attendre (`wait`) et elle répond quand elle se termine, avec son résultat et la trace de chaque étape. **Arrêter** (`POST /api/scripts/{id}/stop`, ou `script.turn_off`) annule chaque exécution du script là où elle en est, dans chaque processus, attente ou temporisation comprise. Tout ce qu'une étape avait déjà écrit reste écrit. Annuler est aussi une écriture, faite sans que personne ne la demande, sur des équipements qui ont déjà bougé, et c'est la décision de l'opérateur, pas la nôtre.

## Chaque écriture passe par la barrière

Un script s'exécute sous le nom **`script:<id>`**. Chaque écriture qu'il fait, chaque appel de service, chaque ligne de journal porte ce nom comme acteur, et chaque écriture est auditée à ce nom dans `GET /api/writes`, refusée ou non. La **source** est celui qui l'a lancé : `ui` depuis l'écran, `automation` depuis une règle, `mcp` depuis un agent. Cela compte parce que la barrière décide d'après la source. Un script qu'un agent lance écrit en tant que `mcp`, et avec `HOTLOOP_ALLOW_WRITES` désactivé chacune de ses écritures est refusée, exactement comme le serait le `write_tag` de l'agent lui-même. `run_script` et le `script.turn_on` d'un agent refusent d'emblée dans ce cas plutôt que d'exécuter un script dont chaque écriture va être rejetée.

L'exécution enregistre qui l'a demandée (`actor`), comment (`source`) et ce qui l'a appelée (`parent` : `automation_run:812`, `script_run:77`), si bien que vous pouvez remonter d'une écriture à la règle, au script, puis à la personne ou à l'agent derrière.

## Demandez d'abord : l'essai à blanc

`POST /api/scripts/{id}/run?dry_run=true`, **Vérifier d'abord** dans le tiroir d'exécution, ou `run_script` avec `dryRun`. Les champs sont vérifiés de la même façon, puis chaque étape est parcourue par rapport à l'usine telle qu'elle est en ce moment :

- chaque `write_tag` et `call_service` est soumis aux propres contrôles de la barrière d'écriture (`CheckWrite`, `Services.Check`), le même code que celui de l'écriture réelle, de sorte qu'un essai à blanc ne peut pas dire oui à quelque chose que l'écriture réelle refuserait pour une raison qu'il n'a pas vérifiée. Rien n'est écrit, rien n'est audité ;
- une `condition` est évaluée maintenant, et une condition fausse met fin au parcours là où elle mettrait fin à l'exécution ;
- un `set_variable` est lié, si bien que les étapes suivantes voient ce qu'elles verraient ;
- un `call_script` parcourt le script qu'il appelle, ses étapes numérotées sous l'appel (`3.1`, `3.2`) ;
- un `wait`, un `delay` et tout ce qui n'écrit sur aucun équipement (un message, un appel HTTP, une alarme levée) est `not_checked`. Un essai à blanc n'attend pas quinze minutes pour vous dire ce que la cuve indiquera alors.

La première écriture qui serait refusée met fin au parcours, parce qu'elle mettrait fin à l'exécution, et la réponse le dit dans les mots de la barrière : `step 2 (call_service): cip/pump: this tag is not marked writable`. Un essai à blanc qui revient propre est un conseil, pas une promesse. Un appareil peut tomber, quelqu'un peut désarmer un tag, et une attente laisse à l'usine tout le temps qu'il lui faut pour changer d'avis entre votre vérification et l'étape.

## Modes d'exécution

Ce que devient une exécution demandée pendant qu'une autre du même script est en cours. Les mêmes mots que ceux d'une règle, avec une différence.

| Mode | Une deuxième exécution |
|---|---|
| `skip` | refusée, `409`, et une exécution `skipped` dans l'historique qui dit pourquoi. **Le défaut**, et la bonne réponse pour tout ce qui commande des équipements |
| `queue` | attend son tour et démarre quand celle qui la précède est terminée. Un seul rang : une troisième est refusée |
| `restart` | annule celle en cours là où elle en est, puis démarre une fois qu'elle est arrêtée. Deux exécutions ne se chevauchent jamais |
| `parallel` | s'exécute en parallèle |

La différence : la file d'une règle abandonne en silence l'exécution en attente la plus ancienne, et la file d'un script refuse à voix haute la plus récente. Une règle est déclenchée par un déclencheur qui s'en moque. Un script est demandé par quelqu'un, ou quelque chose, qui attend peut-être la réponse, et « votre exécution n'a tout simplement pas eu lieu » n'est pas une réponse.

Une étape `call_script` qui attend un script occupé échoue (`script busy`) ; une étape qui n'attend pas le note dans la trace et continue, parce que tout ce qu'elle devait faire, c'était le démarrer.

`maxRuntimeSec` borne une exécution, cinq minutes quand il vaut zéro. Une exécution qui dépasse cette durée passe en `timed_out`, qu'elle ait été entre deux étapes ou au milieu d'une attente.

## Des scripts qui appellent des scripts

Une étape `call_script` exécute un script depuis une règle ou depuis un autre script. Avec `wait`, l'étape prend le résultat du script pour le sien, et le script fait partie de l'exécution qui l'a appelé : annulez l'appelant, ou laissez-le manquer de temps, et le script qu'il attend s'arrête aussi. Sans `wait`, le script est démarré puis laissé finir de son côté.

Deux limites, toutes deux là parce que l'alternative est un script qui boucle :

- **Un script qui s'appellerait lui-même est refusé à l'enregistrement**, directement ou à travers n'importe quelle chaîne d'autres scripts : `script b would call itself: b calls a calls b`. Il en va de même pour une modification qui ferme une boucle.
- **Cinq niveaux, à l'exécution.** Un sixième script dans une chaîne fait échouer l'étape qui l'aurait appelé, et la chaîne avec elle. Et si une boucle passe un jour l'enregistrement (deux processus qui enregistrent ses deux moitiés au même moment), l'exécution la détecte : un script déjà en cours dans sa propre chaîne est refusé, pas exécuté une seconde fois.

## Son entité

Chaque script est une entité, `script.<id>`, plateforme `script`. Son état est `on` tant qu'une de ses exécutions est en cours, dans n'importe quel processus, et `off` quand il n'y en a aucune ; ses attributs portent son `mode`, le nombre d'exécutions en cours (`current`), ses `fields`, ainsi que son dernier démarrage et la façon dont il s'est terminé. Elle est sur l'écran Entités avec un bouton **Exécuter**, dans `list_entities` par MCP, dans `/api/states`, et une règle peut avoir un déclencheur d'état dessus : « quand le cycle CIP passe à off, journalise le lot ». Supprimer un script rend son entité orpheline, comme supprimer une définition d'alarme : un administrateur supprime l'orpheline quand plus rien n'y fait référence.

## L'historique des exécutions

Chaque exécution est une ligne de `script_runs` : qui, comment, les champs reçus après vérification, la trace de chaque étape (entrées résolues, pas des modèles), comment elle s'est terminée et pourquoi. `GET /api/scripts/{id}/runs`, le tiroir d'exécution et le [journal de bord](/fr/iot/logbook/), où les exécutions de scripts sont du genre `script`, retrouvées par l'entité du script ou par tout ce qu'une exécution a écrit. L'historique garde les 500 exécutions les plus récentes de chaque script, la même limite que pour les exécutions d'automatisations.

La ligne d'une exécution est ouverte avant sa première étape et terminée après sa dernière. L'arrêt du processus annule chaque exécution en cours là où elle en est et l'enregistre comme `cancelled: interrupted by restart`. Une exécution coupée par une panne, sans personne pour terminer sa ligne, est marquée de la même façon au prochain démarrage du Gateway. **Rien ne reprend une exécution.** Reprendre à l'étape quatre d'un cycle CIP une heure plus tard, sans qu'on le demande, sur une usine qui a changé d'état, est pire que de dire qu'il s'est arrêté.

## Plus d'un processus

Le Gateway et un processus `--mcp-stdio` à côté (ou deux pods en plein déploiement) exécutent tous les deux des scripts. L'état d'une exécution vit dans la base de données, et chaque processus écoute les changements sur `hotloop_script`, donc :

- un script lancé dans un processus affiche `on` dans l'entité de chaque processus ;
- un script enregistré sur un pod est le script de l'autre, et ses exécutions y sont annulées si ses étapes ont changé ;
- **Arrêter** arrête chaque exécution du script, dans chaque processus.

Le mode d'exécution est conservé par processus. Deux processus peuvent chacun démarrer une exécution d'un script `skip` au même instant. Une usine qui lance la même procédure depuis le processus auxiliaire d'un agent et depuis l'écran de l'opérateur dans la même seconde a une conversation à avoir qu'aucun verrou de notre part ne réglerait.

## Sauvegardes

`scripts` et `script_runs` figurent dans chaque sauvegarde et reviennent à la restauration, avec l'historique. Une exécution que la sauvegarde a prise en cours de route revient `running` et est marquée `interrupted by restart` au premier démarrage, comme toute autre. Voir [Sauvegarde et restauration](/fr/iot/backup/).

## L'API

Chaque route, son droit et ses réponses se trouvent dans [l'API HTTP](/fr/iot/api/#scripts).

| Droit | lecteur | opérateur | administrateur |
|---|---|---|---|
| `scripts.read` : les lister, leurs exécutions | oui | oui | oui |
| `scripts.run` : exécuter, essai à blanc, arrêter, `script.turn_on`/`turn_off` | non | oui | oui |
| `scripts.write` : créer, modifier, supprimer | non | non | oui |
