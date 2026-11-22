---
title: "La porte d'écriture : écritures sûres"
description: "Toute écriture, depuis un écran, l'API, une règle, un script, une recette ou un agent, passe par une fonction. Ce qu'elle vérifie et ce que répondent les refus."
sidebar:
  label: "La porte d'écriture"
---

Cette chose peut faire bouger des machines. Voici donc exactement ce qui se dresse entre une requête et un appareil, dans l'ordre où le code l'exécute.

Toute valeur destinée à un appareil passe par **une seule fonction impossible à contourner** : un clic sur un écran, `POST /api/write`, un appel de service d'entité, une automatisation, un script, une recette, un agent via MCP. La politique vit là et nulle part ailleurs, parce qu'un contrôle copié à six endroits est un contrôle qu'on oublie d'ajouter au septième, et le septième est toujours celui qui écrit sur la presse en production. Un test fait échouer la compilation si quoi que ce soit dans le runtime peut atteindre l'écriture d'un appareil sans passer par la porte, et il prouve qu'il peut échouer en plantant quatre sortes de contournement dans une copie du paquet et en les attrapant toutes.

Envie de le sentir plutôt que de le lire ? [hotloop.io propose une version interactive](https://hotloop.io/gateway/#the-gate). Basculez les interrupteurs, envoyez une consigne et regardez exactement où elle rebondit.

## Les contrôles, dans l'ordre

1. **L'appelant a le droit d'écrire.** Cela se passe à l'entrée de l'API, avant la porte. Un utilisateur connecté a besoin de `values.write` pour appeler `POST /api/write` : les opérateurs et les administrateurs l'ont, les lecteurs non, et sans lui l'API répond 403. L'entrée d'un agent est le jeton bearer MCP, et sans lui il reçoit un 401 et ne voit même pas la liste des outils. Dans les deux cas la porte n'en entend jamais parler, donc rien n'apparaît dans l'audit des écritures. (Un appel de service d'entité fonctionne autrement, [plus bas](#toutes-les-entrées-la-même-porte).)
2. **Les écritures sont activées.** `safety.allowWrites`, l'interrupteur général. Désactivé par défaut depuis la 4.4.0.
3. **Les écritures d'agents sont activées.** `safety.allowMcpWrites`, vérifié uniquement quand la requête est arrivée par MCP. Il restreint l'interrupteur général et ne peut jamais le contourner : avec les écritures activées et celui-ci désactivé, un opérateur peut commander un tag et un agent non. Activé alors que `safety.allowWrites` est désactivé, le Gateway refuse de démarrer, plutôt que de vous laisser deviner lequel l'emporte.
4. **Le tag est armé.** Tout tag est en lecture seule tant que quelqu'un ne le marque pas `writable`, un par un et exprès. Un import par exploration de 4 000 tags n'en arme aucun. Un tag qui n'existe pas est aussi refusé ici.
5. **La valeur est dans la plage.** Quand le tag a une plage et que la valeur est un nombre, une valeur hors plage est **refusée, jamais écrêtée**. Celui qui a tapé 500 sur un tag plafonné à 400 a fait une erreur et doit l'entendre. Envoyer 400 en silence, c'est faire quelque chose que personne n'a demandé, sans que personne le sache.
6. **Le contrôle propre à l'appelant passe.** Une entité ajoute ce que seule elle connaît : le pas et la plage plus étroite d'un nombre, le motif et la longueur d'un texte, les options d'une sélection, la sortie d'une boucle refusée sauf si la boucle est en manuel à cet instant, l'entité désactivée ou supprimée en cours d'appel. Il s'exécute dans la porte, après la politique et la plage du tag pour qu'un opérateur entende toujours d'abord ce qui concerne le tag, et avant la ligne d'audit pour qu'un refus d'entité soit enregistré exactement comme celui d'un tag. Il ne peut que refuser. Il ne peut pas changer la valeur ni laisser passer ce que la porte aurait arrêté.
7. **L'appareil fonctionne.** HotLoop a un worker actif pour lui. Un appareil désactivé, ou qui n'a jamais démarré, est refusé avec `the device is not connected` au lieu qu'une valeur soit lancée dans le vide.

**Ce n'est qu'alors que la ligne d'audit s'ouvre, et ce n'est qu'alors que la valeur part.** Si la ligne ne peut pas être écrite, l'écriture n'est pas envoyée du tout. Une écriture sans audit est une écriture dont personne ne peut rendre compte ensuite, et sur un équipement qui bouge, ce marché ne vaut pas le coup. La ligne est terminée avec le résultat et la latence dans un contexte détaché de la requête, de sorte qu'une écriture qui expire ou est annulée enregistre quand même ce qui s'est passé.

Chaque refus à partir du contrôle 2 est audité comme un refus : une ligne avec l'acteur, la source, la valeur demandée, la valeur qu'elle aurait remplacée et `refused:` avec la raison, plus un avertissement dans le journal système. Quelqu'un qui tente sans cesse de commander un tag qui lui est interdit passe inaperçu si rien n'est écrit, et un ingénieur doit pouvoir le retrouver après coup. Le contrôle 1 n'est pas dans l'audit des écritures, parce que la porte ne l'a jamais vu.

### Pourquoi cet ordre

La politique s'exécute avant l'ouverture de la ligne d'audit, donc un refus est enregistré comme un refus et non comme une tentative qui a échoué par hasard. La ligne d'audit s'ouvre avant que la valeur n'atteigne le fil, donc une écriture qui se bloque, ou qui emporte le processus avec elle, a laissé une trace de la tentative. Sur un plancher d'usine, « on ne sait pas si cette commande est partie » est la pire réponse possible.

### Un cas que le contrôle 7 ne détecte pas

Le contrôle 7 demande si l'appareil a un worker, pas si sa session est active à cet instant précis. Un appareil tombé du réseau et en train de se reconnecter le passe. La ligne d'audit s'ouvre, le pilote n'a pas de session et l'écriture échoue en `the device is not connected`, enregistrée comme tentative échouée et non comme refus. Dans les deux cas rien n'atteint l'appareil. Le [test à blanc](#demander-avant-denvoyer--le-test-à-blanc) vérifie aussi la session, et le dit d'emblée.

## Ce que répond chaque refus

Le code d'état dit à qui est le problème, parce que c'est ainsi qu'un opérateur le lit.

| Ce qui s'est passé | L'erreur dit | HTTP |
|---|---|---|
| Pas d'autorisation, à l'entrée | `<user> does not have the "values.write" permission` | 403 |
| Les écritures sont désactivées | `writes are disabled on this deployment` | 403 |
| Les écritures d'agents sont désactivées | `writes from MCP clients are disabled on this deployment` | 403 |
| Le tag n'est pas armé | `this tag is not marked writable` | 403 |
| L'entité est désactivée | `the entity is disabled` | 403 |
| Le tag n'existe pas | le tag, et `not found` | 404 |
| L'entité a disparu en cours d'appel, ou n'est pas dans un état qui l'autorise (une boucle pas en manuel) | ce qui a changé | 409 |
| La valeur est hors de la plage du tag | `value is outside the tag's configured range` | 422 |
| L'entité n'accepte pas la valeur (pas, motif, options, sa propre plage) | `the value is not one this entity accepts`, et pourquoi | 422 |
| L'appareil n'est pas connecté | `the device is not connected` | 503 |
| L'appareil a répondu non | les propres mots de l'appareil | 502 |
| L'écriture n'a pas pu être auditée, ou tout autre cas que l'API ne sait pas classer | `internal error (ref …)`, avec le détail dans le journal du serveur sous cette référence | 500 |

Tout ce que l'API ne sait pas classer est un 500. C'était un 400, ce qui voulait dire qu'une panne de base de données disait à un opérateur qu'il avait mal saisi quelque chose, et il cherchait une faute de frappe qui n'existait pas.

Via MCP, il n'y a pas de codes d'état. Un refus revient sous la forme d'un résultat d'outil marqué `isError`, dans les mots de la porte elle-même :

```
> write_tag tag=press-01/Zone1_Temp value=99 reason="testing"
write refused: press-01/Zone1_Temp: this tag is not marked writable
```

C'est une réponse, pas une panne de transport. L'appel a été compris et délibérément refusé, et le renouveler donne la même réponse.

## Demander avant d'envoyer : le test à blanc

La porte a un second point d'entrée qui demande sans agir. Il exécute les mêmes contrôles, dans le même ordre, et donne le même texte d'erreur pour un refus. Il n'ouvre aucune ligne d'audit, ne déclenche aucun événement, ne compte rien et n'atteint jamais l'appareil. Il va même un cran plus loin que l'écriture réelle : un appareil dont le worker tourne mais dont la session est tombée est signalé comme non connecté, au lieu de « cela partirait ».

Où le trouver :

- **Appels de service d'entité** : `POST /api/services/{domain}/{service}?dry_run=true`. Il répond 200 avec le verdict : chaque écriture qu'il ferait en `would_write`, ou la première qui serait refusée en `not_sent`, avec la raison mot pour mot. Une requête qu'on n'a même pas pu planifier (entité inconnue, service que le domaine ne propose pas, données erronées) répond avec le même statut que l'appel réel. `dry_run` accepte `true` ou `false` et rien d'autre, et `yes` donne un 400, parce qu'une devinette dans le mauvais sens transforme une question en commande.
- **L'invite de commande** demande pendant que vous tapez et affiche « Would be refused: ... » avant que quiconque confirme.
- **Scripts**, nouveau en 4.17.0 : `POST /api/scripts/{id}/run?dry_run=true`, **Check first** dans le tiroir d'exécution, ou `run_script` de MCP avec `dryRun`. Chaque étape est parcourue contre l'usine telle qu'elle est maintenant, et la première écriture qui serait refusée met fin au parcours dans les mots de la porte. Voir [Scripts](/fr/iot/scripts/).
- **Recettes**, nouveau en 4.17.0 : chaque cible est soumise à ces contrôles avant que la première valeur parte, et une seule mauvaise valeur refuse la recette entière sans rien écrire. `POST /api/recipes/{id}/validate` et `validate_recipe` de MCP demandent sans appliquer. Voir [Recettes](/fr/iot/recipes/).
- **Blueprints**, nouveau en 4.17.0 : **Check first** montre ce que ferait la règle si elle se déclenchait maintenant, chaque écriture soumise à ces contrôles, avant même que la règle existe. Voir [Blueprints](/fr/iot/blueprints/).

Un test à blanc propre est un conseil, pas une promesse. La porte décide toujours à l'écriture réelle, parce qu'un appareil peut tomber, ou quelqu'un peut désarmer un tag, entre votre question et votre commande.

:::caution[Toujours en 4.16.0 ? L'invite peut avaler un Set]
En 4.16.0, le verdict du test à blanc arrive environ un quart de seconde après l'arrêt de la frappe, juste quand la souris file vers Set, et l'invite grandit ou rétrécit sous elle. Set bouge d'environ 30 px, donc le clic tombe dans le vide, ou sur le fond et ferme l'invite. L'opérateur la voit se fermer, croit que la consigne est partie, et rien n'a été écrit. Corrigé en 4.17.0 : le verdict se place à côté des boutons et rien ne bouge. Tant que vous n'avez pas [mis à niveau](/fr/gateway/upgrading/), vérifiez que la valeur a bien changé après avoir appuyé sur Set.
:::

## Toutes les entrées, la même porte

- **Les écrans et `POST /api/write`.** L'acteur est le nom d'utilisateur connecté, pas un en-tête que n'importe qui pourrait fixer.
- **Services d'entité**, `POST /api/services/{domain}/{service}`. `switch.turn_on` sur `switch.press_01_pump` est une écriture de tag à travers cette porte, auditée sur l'entité avec son entity_id, le service et un identifiant d'appel. Un appui de bouton, ce sont deux écritures sous un même identifiant d'appel. Un utilisateur sans `values.write` n'est pas arrêté à l'entrée ici : la permission manquante est remise à la porte comme contrôle propre à l'appelant, de sorte qu'un appel d'entité refusé est audité sur l'entité, avec la valeur demandée, comme n'importe quel autre refus, et répond toujours 403.
- **Les automatisations** écrivent en tant que `automation:<rule-id>`. Une règle n'a pas plus de privilèges qu'une personne. Voir [Automatisations](/fr/iot/automations/).
- **Les scripts**, nouveau en 4.17.0, écrivent en tant que `script:<id>` et gardent la source de celui qui les a lancés, de sorte qu'un script lancé par un agent heurte l'interrupteur d'agents exactement comme le `write_tag` de l'agent.
- **Les recettes**, nouveau en 4.17.0, écrivent chaque cible sous un même identifiant d'appel, donc `GET /api/writes?call=<id>` est l'application entière dans la piste d'audit.
- **Les agents** écrivent en tant que `mcp:<client name>`. `write_tag` et `call_service` passent les mêmes contrôles qu'un opérateur, et tous deux refusent de s'exécuter sans motif déclaré, qui va dans le journal système à côté de l'écriture. Une ligne d'audit que personne ne sait expliquer six mois plus tard n'est qu'un horodatage avec mauvaise conscience. `trigger_automation` refuse net tant que les écritures d'agents sont désactivées, comme `run_script` et `apply_recipe`, parce qu'une règle, un script ou une recette peuvent commander des équipements et seraient sinon un moyen de contourner l'interrupteur. Voir [Model Context Protocol](/fr/iot/mcp/).

## Pourquoi les écritures sont désactivées par défaut

Avant la 4.4.0, `safety.allowWrites` et `safety.allowMcpWrites` valaient `true` par défaut. Elles valent `false` maintenant. Un tag a toujours été en lecture seule tant qu'il n'était pas armé, mais une installation neuve ne devrait pas être à un drapeau `writable` de commander des équipements avant que quiconque l'ait regardée.

Au-dessus de la porte, `safety.confirmWrites` (activé par défaut) fait demander une confirmation aux écrans avant d'envoyer quoi que ce soit. C'est une invite dans le navigateur, pas un contrôle dans la porte, et c'est le seul réglage de sécurité modifiable depuis l'écran Paramètres. `safety.allowWrites` et `safety.allowMcpWrites` y sont en lecture seule exprès : le contrôle maître qui décide si ce processus peut commander des équipements n'a pas sa place derrière la session de navigateur qui émet les écritures.

## Activer les écritures, délibérément

1. Ajoutez l'appareil et découvrez ses tags là où le protocole sait les lister. Modbus et S7comm ne peuvent pas énumérer leurs propres points, déclarez-les donc d'après la documentation de l'appareil.
2. Marquez les tags en écriture un par un, et seulement ceux que vous voulez.
3. Mettez `safety.allowWrites: true` dans votre fichier de valeurs et lancez `helm upgrade`. Tant que vous ne l'avez pas fait, rien dans les étapes 1 et 2 ne peut bouger une vanne.
4. Seulement si les agents doivent aussi commander des équipements, mettez `safety.allowMcpWrites: true`.

## Ce qu'elle ne fait pas

L'application ne peut pas tout imposer, et mieux vaut le dire que vous laisser le supposer.

- **Ce n'est pas un verrouillage de sécurité.** Un arrêt qui protège les personnes ou l'usine appartient à l'automate, câblé là où il doit l'être, pas à quoi que ce soit qui tourne sur un réseau.
- **Elle ne surveille pas votre broker.** Si vous envoyez des commandes de nœud aux edge relays par MQTT, le contrôle d'accès du broker lui-même doit restreindre aux identifiants du Gateway le droit de les publier.
- **Le serveur OPC UA ne peut pas écrire du tout.** Il est en lecture seule, sans gestionnaire d'écriture ni réglage qui en ajoute un, de sorte que le SCADA qui le lit ne peut rien commander à travers lui.
