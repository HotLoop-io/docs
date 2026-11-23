---
title: "Notes de version : HotLoop Flow 2.3.0"
description: "Ce que apporte HotLoop Flow 2.3.0, ce qui change à la mise à jour et ce qu'il faut lire avant de toucher à une usine en marche."
sidebar:
  label: "2.3.0"
---

HotLoop Flow 2.3.0 est la version où Flow atteint le reste de l'usine de trois nouvelles façons et repère un message de mauvaise forme avant qu'il ne fasse des dégâts. Il parle à HotLoop, un agent peut appeler un flux comme un outil via MCP, et un plugin est un fichier WebAssembly signé et non un paquet npm. JSON Schema vérifie désormais les messages sur le nœud `json`, sur les ports d'un nœud et sur les liaisons dans l'éditeur. Un changement peut affecter un flux qui tourne déjà, et c'est la première chose sous Ce qui a changé.

## Nouveautés

**Nœuds HotLoop**
- Une connexion `hotloop-flow-hotloop`, qui est une URL et un compte. Elle se connecte avec `POST /api/auth/login`, envoie le jeton porteur que HotLoop renvoie et se reconnecte quand HotLoop dit que la session a disparu. Un compte opérateur suffit pour tout ce qui suit.
- `hotloop in` suit le flux en direct de HotLoop et envoie un message pour chaque entité qui change d'état : `msg.topic` est l'identifiant de l'entité, `msg.payload` est le nouvel état, et `msg.hotloop` porte l'état qu'elle avait avant, ses attributs, sa qualité et ses horodatages. Si le lien tombe, le badge passe au rouge et une seule erreur arrive à un nœud Catch pour la panne, pas une par nouvelle tentative. Quand il revient, une entité qui a changé entre-temps est envoyée, et pas celle qui n'a pas changé.
- `hotloop state` lit une entité à l'arrivée d'un message. `hotloop script` exécute un script HotLoop avec les champs que vous lui donnez. `hotloop recipe` applique une recette avec ses paramètres, et une version plus ancienne si vous la demandez exprès. HotLoop vérifie chaque champ et chaque paramètre, fait passer chaque écriture par sa barrière d'écriture et garde la trace. Flow envoie la raison `flow:<node id>`, et HotLoop l'inscrit dans son audit d'écriture et son journal de bord.
- Un appel refusé ou en échec arrive à un nœud Catch avec les propres mots de HotLoop et son statut. Rien de ce qui a été écrit n'est annulé, car c'est aussi la règle de HotLoop.

**Écritures par la barrière de HotLoop**
- `modbus write`, `opcua write`, `s7 write` et `ethernetip write` ont deux nouveaux champs, **Écrire via HotLoop** et **Tag HotLoop** (`device/tag`). Avec un HotLoop choisi, la valeur va à la barrière d'écriture de HotLoop, qui décide dans l'ordre : écritures activées, tag armé, valeur dans la plage.
- Une écriture que la barrière refuse n'atteint jamais l'équipement. Un HotLoop injoignable fait aussi échouer l'écriture. Il ne se rabat jamais sur une écriture directe, car ce serait une écriture que la barrière n'a jamais vue.
- L'adresse, le type de donnée et l'échelle propres à HotLoop pour le tag s'appliquent, donc l'adresse et le type de donnée du nœud Flow ne sont pas utilisés. Retirer le HotLoop remet le nœud exactement comme il était. La barrière accepte un booléen, un nombre ou un texte par écriture, donc une liste de registres est refusée avec un message qui le dit.

**MCP, dans les deux sens**
- `mcp tool` et `mcp result` servent un flux comme un outil. Le nœud outil déclare un nom, une description et un schéma d'entrée, Flow le sert sur `/mcp`, et le nœud résultat renvoie la réponse du flux. Un agent se connecte avec une session ou un jeton d'API comme n'importe qui, l'appel s'exécute avec les permissions de ce jeton, et chaque appel et refus arrive dans le journal d'audit au nom de l'appelant. Pas de jeton, pas d'appel.
- `mcp client`, sur une connexion `hotloop-flow-mcp-server`, appelle un outil de n'importe quel serveur MCP, celui de HotLoop compris, et utilise ce qui revient. Il n'envoie jamais un appel deux fois, car un outil peut déplacer un équipement et une connexion coupée ne dit pas si l'appel a été exécuté.
- Un jeton d'API dans `auth.tokens` peut porter un `rateLimit` avec `calls` et une fenêtre, d'une minute si vous l'omettez. Un appel au-delà n'atteint jamais le flux, revient comme une erreur d'outil qui indique quand réessayer et écrit une ligne `mcp.refused` avec la raison. Un jeton sans `rateLimit` n'est jamais limité.
- Il parle la révision actuelle de la spécification, 2026-07-28, et les révisions de la négociation jusqu'à 2025-11-25, sur le même point de terminaison. Un flux qui n'utilise aucun de ces nœuds ne fait jamais d'appel MCP, et Flow ne sert aucun outil qu'on ne lui a pas donné.

**Plugins sans npm**
- Un plugin est un module WebAssembly, un descripteur à partir duquel l'éditeur dessine sa boîte de dialogue et une signature ed25519 sur les deux. Les plugins non signés ou altérés refusent de se charger et disent pourquoi. `hotloop-flow plugin keygen` crée une clé, et `docs/plugins.md` donne le reste.
- Un invité qui dépasse son plafond de mémoire ou son délai part en piège vers un nœud Catch pendant que tout le reste continue de tourner. Un plugin qui demande un accès à l'hôte que l'opérateur n'a pas accordé (`clock`, `random`, `context.flow`, `context.global`) fait échouer le déploiement de tout flux qui l'utilise, avant qu'un octet ne soit écrit.
- Sans clé de confiance, tout plugin est refusé, et sans autorisation, tout plugin qui demande un accès à l'hôte échoue. Rien ne se charge par défaut.
- Le chart prend tout cela sous `plugins`, avec un volume qui accepte n'importe quelle source de volume Kubernetes. Désactivé, il ne rend rien, et un `helm template` des valeurs par défaut est ce qu'il était.

**Liaisons typées**
- Donnez au nœud `json` un JSON Schema dans ses réglages et chaque valeur qu'il traite est vérifiée contre lui. Une valeur qui ne correspond pas va à un nœud Catch au lieu de poursuivre sur la liaison, et l'erreur nomme chaque champ erroné, comme `payload.temp: got string, want number`. Sans schéma dans les réglages, le nœud valide contre `msg.schema`, comme le nœud `json` de Node-RED. C'est le brouillon 2020-12 sauf si le schéma en nomme un autre, et un `$ref` vers une autre URL ou un fichier est refusé, pas récupéré.
- Un nœud peut déclarer ce qu'il accepte et ce que promet chaque sortie, dans deux clés du fichier de flux que tous les autres outils ignorent, si bien qu'un flux qui les porte fait toujours l'aller-retour octet pour octet. Quand les deux extrémités d'une liaison déclarent un schéma et qu'aucun message ne pourrait satisfaire les deux, le déploiement est refusé avant qu'un octet ne soit écrit. Les écarts que Flow ne peut pas voir à l'avance s'arrêtent là où ils brisent le schéma, vont à Catch avec le chemin de chaque champ erroné et sont comptés dans `hotloop_flow_node_schema_mismatches_total`.
- Un `inject` qui pose un littéral que le nœud suivant ne peut jamais accepter, comme le nombre 250 dans un nœud qui accepte de 0 à 100, est refusé au déploiement de la même façon. Les horodatages, `env`, le contexte et JSONata sont ignorés, jamais devinés.
- L'éditeur écrit le type de l'émetteur sur chaque liaison. Elle est atténuée quand une seule extrémité a un type et rouge quand les deux ne pourront jamais s'accorder, et le rouge vient de la vérification du runtime lui-même, si bien que le canevas et le déploiement ne peuvent pas diverger. La section **Types** de la boîte de dialogue d'un nœud est l'endroit où les régler.

Cela fait neuf types de nœuds de plus, 79 au total : cinq pour HotLoop avec sa connexion, et quatre pour MCP avec sa connexion.

## Ce qui a changé

- Le nœud `json` ignorait `msg.schema`. Désormais, un message qui porte `msg.schema` est validé contre lui et, s'il ne correspond pas, va à un nœud Catch au lieu de poursuivre sur la liaison. Un flux qui laisse un `msg.schema` sur ses messages pour une autre raison le verra.
- Un déploiement peut maintenant être refusé pour une incohérence de types (`deploy.refused`, raison `typed wires`), mais seulement pour un flux qui déclare des schémas sur ses ports ou pose un littéral `inject` dans un nœud qui en déclare un. Un flux sans aucun schéma se comporte exactement comme avant.
- Les nœuds d'écriture portent les deux nouveaux champs, vides par défaut. Sans HotLoop choisi, un nœud d'écriture se comporte comme en 2.2.0.
- Le validateur de schémas est `santhosh-tekuri/jsonschema` v6 (sous licence permissive) et MCP est le SDK Go, `modelcontextprotocol/go-sdk` v1.8.0. Ce sont deux nouveaux modules Go, donc le texte de licence que l'image embarque dans `/usr/share/doc/hotloop-flow/` compte plus d'entrées. Le runtime WebAssembly était déjà dans la 2.2.0.
- Trois correctifs de la file durable. Une liaison durable supprimée refuse désormais une écriture tardive et la compte comme abandonnée, et en supprimer une n'attend plus tout le délai de fermeture sur une cible bloquée sur un message. Avant, un message rendu après la disparition de la liaison restait imputé au quota jusqu'à un redémarrage. Une liaison qui abandonne le plus ancien n'évince plus un message déjà acquitté ou que la pompe venait de lire, ce qui rendait deux fois le même espace et laissait la profondeur de la file et le quota sous ce qu'il y avait sur le disque. Le texte sur le quota durable dans `docs/durable/README.md` précise maintenant qu'un message dérivé peut dépasser le quota de quelques messages un instant.
- Le README et `docs/bench/` portent les résultats du Raspberry Pi 5, et la feuille de route coche le Pi 5 et laisse ouverts le Pi 4, le Zero 2 W et les écritures sur la carte SD.

## Notes de mise à jour

Depuis la 2.2.0, il suffit de changer l'image (`helm upgrade`, ou le nouveau tag dans votre unité Quadlet). Pas de migration, pas d'option, rien de nouveau au premier démarrage. Un `flows.json` et un fichier de configuration qui tournaient en 2.2.0 tournent en 2.3.0, et l'aller-retour octet pour octet du fichier de flux reste intact.

- Revenir à la 2.2.0 est sans risque pour tout flux qui n'utilise ni les nouveaux nœuds ni les nouvelles clés. Un nœud HotLoop, MCP ou plugin ne démarre pas en 2.2.0 (type de nœud inconnu), et un nœud d'écriture avec un HotLoop choisi y écrit directement dans son équipement, car la 2.2.0 ne lit pas ce champ. Retirez le HotLoop de ces nœuds d'écriture avant de revenir en arrière.
- HotLoop enregistre le compte avec lequel Flow se connecte. L'API ne donne au client aucun moyen de nommer son propre acteur, donc l'identifiant du nœud Flow part comme raison et le compte est celui de la connexion. Utilisez un compte créé pour Flow si vous voulez retrouver facilement ses écritures.
- MCP est une nouvelle porte d'entrée dans Flow, et elle exige un jeton. Rien n'est servi tant qu'un flux n'a pas de nœud `mcp tool`, et un appel sans jeton ou avec un jeton inventé est refusé.

## Nouveaux réglages

| YAML | Environnement | Par défaut |
|---|---|---|
| `plugins.dir` | `HOTLOOP_FLOW_PLUGINS_DIR` | vide, ce qui signifie `plugins` dans `data.dir` |
| `plugins.trustedKeys` | `HOTLOOP_FLOW_PLUGIN_TRUSTED_KEYS` | aucune. Chacune est `ed25519:<base64>`, une clé publique PEM ou un fichier qui en contient une. Sans aucune, tout plugin est refusé. |
| `plugins.grants` | `HOTLOOP_FLOW_PLUGIN_GRANTS` | aucune. Le nom d'un plugin vers `clock`, `random`, `context.flow`, `context.global`. La variable est `name=cap,cap;name=cap`. |
| `plugins.maxMemoryMiB` | `HOTLOOP_FLOW_PLUGIN_MAX_MEMORY_MIB` | 64, de 1 à 4095 |
| `plugins.maxTimeout` | `HOTLOOP_FLOW_PLUGIN_MAX_TIMEOUT` | `5s` |
| `auth.tokens[].rateLimit.calls`, `.per` | | 0 appel, c'est-à-dire aucune limite. `per` vaut `1m` quand vous définissez `calls` et pas `per`. |

Les connexions HotLoop et MCP se règlent dans l'éditeur : URL, compte et délai d'attente. Le chart a tous les réglages des plugins sous `plugins` dans `values.yaml`, avec `enabled: false`, et rien d'autre de nouveau.

Image : `ghcr.io/hotloop-io/hotloop-flow:2.3.0`, linux/amd64 et linux/arm64. Chart : `https://hotloop.io/hotloop-flow/`. Le README de ce tag contient le reste : https://github.com/HotLoop-io/hotloop-flow/blob/v2.3.0/README.md
