---
title: "MCP, dans les deux sens"
description: "Un agent peut appeler un flux comme un outil, et un flux peut appeler un outil de n'importe quel serveur MCP, avec trois nœuds et un nœud de configuration."
---

Un agent qui parle le Model Context Protocol peut appeler un flux comme un outil, et un flux peut appeler un outil de n'importe quel serveur MCP, y compris celui de HotLoop. Trois nœuds et un nœud de configuration s'en chargent : `mcp tool` et `mcp result` servent un flux, `mcp client` sur une connexion `hotloop-flow-mcp-server` appelle vers l'extérieur. Si vous ne faites que relier des capteurs à des tableaux de bord, vous pouvez tout ignorer : un flux qui n'utilise aucun de ces nœuds ne fait jamais d'appel MCP, et les seuls outils que Flow sert de lui-même sont ceux qui lisent et modifient ses flux ([plus bas](#les-outils-propres-à-flow)).

Le protocole est celui du SDK Go (`github.com/modelcontextprotocol/go-sdk` v1.8.0, sous licence permissive, certains fichiers restant sous MIT le temps que le projet termine son changement de licence, maintenu par le projet MCP). Il parle la révision courante de la spécification, 2026-07-28, qui n'a pas de poignée de main et porte la version dans chaque requête, ainsi que les révisions à poignée de main jusqu'à 2025-11-25, sur le même point d'accès. Un client obtient celle avec laquelle il ouvre la connexion, donc il n'y a rien à configurer.

## Des flux comme outils

Un nœud `mcp tool` déclare un outil : un nom, une description pour le modèle qui la lit et un schéma d'entrée. Tant que le flux est déployé, Flow le sert sur `/mcp` (sous la racine d'administration, si vous l'avez déplacée). Un appel devient un message qui sort du nœud : `msg.payload` contient les arguments de l'appel, `msg.topic` le nom de l'outil, et `msg.mcp` porte `tool`, `caller` et `callId`. Un nœud `mcp result` placé plus loin renvoie la réponse, comme `http response` répond à `http in`. Tout ce qui se trouve entre les deux est un flux comme un autre.

```json
[
  {"id": "t1", "type": "tab", "label": "Line"},
  {"id": "tool", "type": "mcp tool", "z": "t1", "toolName": "line_status",
   "description": "Status of a production line: its state and speed.",
   "schema": "{\"type\":\"object\",\"properties\":{\"line\":{\"type\":\"string\",\"enum\":[\"L1\",\"L2\",\"L3\"]}},\"required\":[\"line\"],\"additionalProperties\":false}",
   "x": 100, "y": 100, "wires": [["status"]]},
  {"id": "status", "type": "function", "z": "t1", "name": "status", "outputs": 1,
   "func": "msg.payload = {line: msg.payload.line, state: 'running', askedBy: msg.mcp.caller};\nreturn msg;",
   "x": 300, "y": 100, "wires": [["answer"]]},
  {"id": "answer", "type": "mcp result", "z": "t1", "x": 500, "y": 100, "wires": []}
]
```

**Le schéma est vérifié avant l'exécution du flux.** C'est du JSON Schema, lu comme le lit le nœud `json` (brouillon 2020-12 sauf si le schéma en nomme un autre, et un `$ref` vers une autre URL est une erreur). Un schéma invalide, une racine qui n'est pas un objet, un nom d'outil que MCP n'autorise pas ou deux nœuds qui servent le même nom font échouer le déploiement de ce nœud, avec la raison. Un appel dont les arguments ne conviennent pas reçoit une erreur d'outil qui nomme le champ fautif, `arguments.line: value must be one of "L1", "L2", "L3"`, pour que le modèle corrige et réessaie, et le flux ne le voit jamais. Une charge utile objet revient comme objet et comme son texte JSON, un texte revient comme texte, et un `mcp result` alimenté par un nœud Catch, ou avec « The work failed » coché, répond par une erreur d'outil avec les mots de l'erreur elle-même. Un appel auquel rien ne répond reçoit cette information à l'expiration du délai de réponse, 30 secondes sauf réglage contraire, et l'erreur va à un nœud Catch. Un redéploiement attend les appels en cours.

**Un agent est un appelant comme un autre.** `/mcp` accepte les mêmes jetons que l'API d'administration, un jeton de session ou un jeton d'API, et rien d'autre. Il n'y a pas d'appel anonyme : pas de jeton donne un 401, un jeton que Flow ne connaît pas donne un 401, et un jeton sans la permission `mcp.call` donne un 403, avant même que le protocole voie la requête. Une instance lancée avec `HOTLOOP_FLOW_INSECURE` répond 403 à chaque requête `/mcp`, parce qu'un appel d'outil doit avoir un appelant à inscrire dans le journal d'audit. Le jeton d'un agent est un jeton comme un autre :

```yaml
auth:
  tokens:
    - name: agent
      hash: sha256:...          # from: hotloop-flow token -name agent
      permissions: ["mcp.call"]
      rateLimit: {calls: 60, per: 1m}   # optional; no rateLimit, no limit
```

L'appel s'exécute avec les droits de cette identité. Chaque appelant a besoin de `mcp.call` (ou `mcp.*`, ou `*`). Si vous mettez une autre permission dans la case « Extra permission » d'un outil, par exemple `mcp.line3`, l'appelant a aussi besoin de celle-là, et sans elle il ne voit même pas l'outil dans la liste. Deux agents peuvent partager un Flow et voir des outils différents.

**Un jeton peut être limité à un nombre d'appels.** `rateLimit` sur un jeton d'API de `auth.tokens` est `calls` dans une fenêtre, `per`, d'une minute si vous l'omettez. La fenêtre commence au premier appel du jeton, un appel au-delà du nombre est refusé jusqu'à la fin de la fenêtre, puis le décompte repart. Un appel refusé n'atteint jamais le flux et reçoit une erreur d'outil qui indique combien de secondes attendre, si bien qu'un agent pris dans une boucle se voit demander de ralentir avec des mots qu'il lit. La spécification ne nomme aucune erreur pour cela, c'est donc l'erreur d'outil qu'elle définit déjà pour un appel qui ne peut pas être exécuté. Un jeton sans `rateLimit` n'est jamais freiné, et un jeton de session n'est pas limité non plus, parce qu'il appartient à une personne. Chaque jeton compte à part, et le décompte vit en mémoire, donc un redémarrage le remet à zéro. Un refus est une ligne `mcp.refused` avec la raison `rate limit exceeded`, ce qui veut dire qu'une rafale se retrouve aussi dans le journal d'audit.

**Chaque appel est dans le journal d'audit, au nom de l'appelant.** `mcp.call` est écrit avant l'exécution du flux, avec l'outil, le nœud et un identifiant d'appel, et `mcp.result` après, avec le résultat et les millisecondes. `mcp.refused` correspond à un jeton incorrect, à un jeton sans la permission, à un outil qu'il n'a pas le droit d'appeler ou à des arguments qui ne convenaient pas. Les arguments eux-mêmes ne sont jamais écrits. Une requête sans aucun jeton n'est pas écrite non plus, parce qu'il n'y a personne à nommer de l'autre côté. `GET /audit?event=mcp.` lit tout cela, et `?user=token:agent` le limite à un seul agent.

Essayez avec l'inspecteur du projet MCP lui-même, qui n'a besoin de rien de Flow :

```bash
npx @modelcontextprotocol/inspector@2.12.0 --cli http://localhost:1880/mcp \
  --transport http --header "Authorization: Bearer $TOKEN" \
  --method tools/call --tool-name line_status --tool-arg line=L3
```

Un test de flux place le message qu'aurait produit un appel là où se trouve le nœud `mcp tool`, et `mcp result` remet au test ce qu'il aurait répondu sous la forme `{isError, text, structuredContent}`, de sorte que le flux est testé sans serveur.

## Les outils propres à Flow

Un agent qui ne pourrait appeler que ce qu'un auteur de flux a câblé ne pourrait ni voir les flux ni les modifier, c'est pourquoi Flow sert 45 outils à lui sur le même `/mcp`, à côté de ceux des flux. Ils lisent et ils écrivent. Sept concernent les flux, dans le tableau ci-dessous, et les autres sont les autres routes de l'API d'administration : les paramètres, la palette, le journal d'audit, le détail et les différences des déploiements, l'export, les tests de flux, les traces de messages, les chiffres du runtime, une réinitialisation du second facteur, ainsi que les diagrammes et les instruments : lister et lire un diagramme, l'exécuter et l'arrêter, piloter son débogueur, régler une commande de son panneau et activer ou désactiver les écritures d'un instrument. La page MCP donne chaque outil, sa route et sa permission, ainsi que les quelques routes qui ne sont pas des outils et pourquoi.

| Outil | Fonction | Permission |
|---|---|---|
| `list_flows` | chaque onglet et sous-flux : id, libellé, désactivé, nombre de nœuds et la révision | `flows.read` |
| `get_flows` | tout l'ensemble déployé tel que l'éditeur le lit, avec la révision | `flows.read` |
| `get_flow` | un onglet ou un sous-flux avec ses nœuds, par id | `flows.read` |
| `deploy_flows` | **deploy** : remplace tout l'ensemble, avec la révision que vous avez lue et une note | `flows.write` |
| `list_deployments` | l'historique des déploiements, du plus récent au plus ancien | `flows.read` |
| `rollback_deployment` | **roll back** vers un déploiement antérieur, en tant que nouveau déploiement | `flows.write` |
| `inject_node` | **press** sur un nœud inject, avec un message de votre choix | `inject.write` |

Aucun n'est une seconde implémentation. Chacun exécute le gestionnaire de l'API d'administration pour le même travail, au nom de l'appelant que le point d'accès a authentifié, de sorte qu'un déploiement rencontre tout ce que rencontre un déploiement depuis l'éditeur : le document doit s'analyser, la révision doit être la courante (une révision vide écrase volontairement), les liaisons qui ne s'accordent pas sur ce qui y circule sont refusées, les plugins non autorisés sont refusés, et les tests de flux qui échouent refusent le déploiement, chacun avec les mots de la route. L'historique des déploiements enregistre l'appelant et la note, et le journal d'audit contient la ligne `deploy` ou `inject` au nom de l'appelant, en plus des lignes `mcp.call` et `mcp.result` que laisse chaque appel d'outil. Un appelant a besoin de `mcp.call` et de la permission propre à l'outil, et un outil qu'il n'a pas le droit d'appeler ne figure pas dans sa liste. Les outils restent d'un déploiement à l'autre, qui ne retire que les outils des flux, et un flux ne peut pas servir un de leurs noms.

`deploy_flows` remplace tout l'ensemble, donc un agent lit d'abord `get_flows` et le renvoie modifié, avec le `rev` qu'on lui a donné.

## Appeler des outils sur d'autres serveurs

Un nœud `mcp client` appelle un outil à l'arrivée d'un message, sur une connexion `hotloop-flow-mcp-server` : l'adresse MCP du serveur, un jeton porteur s'il en demande un, et un délai. L'outil et ses arguments sont des entrées typées, donc l'un comme l'autre peut venir du message. `msg.payload` est la réponse structurée de l'outil quand il en a une, le texte quand tout ce qu'il a dit était du texte, et le contenu tel qu'il est arrivé dans les autres cas, et `msg.mcp` contient le serveur, l'outil et la réponse complète. L'autre opération, « List the tools », met dans `msg.payload` tous les outils du serveur avec leur description et leur schéma d'entrée.

Un outil qui signale une erreur en lève une, avec les mots du serveur, de sorte qu'un nœud Catch voit ce qu'aurait vu le modèle. **Un appel n'est jamais envoyé deux fois.** Un outil peut déplacer un équipement, et une connexion coupée ne dit pas si le serveur l'a exécuté, donc l'erreur dit que la connexion a échoué et le message suivant se reconnecte. Le jeton va à l'adresse que vous avez donnée et nulle part ailleurs, une redirection n'est pas suivie, et une erreur ne le répète jamais. La connexion fait confiance aux racines de certificats du système et à rien d'autre.

Pour HotLoop, c'est l'adresse de son `/mcp` et le `mcp-token` du Secret de sa version, et tous les outils de la documentation MCP de HotLoop sont là :

```json
{"id": "plant", "type": "mcp client", "z": "t1", "server": "hotloop",
 "tool": "get_plant_status", "toolType": "str", "arguments": "{}", "argumentsType": "json",
 "x": 300, "y": 100, "wires": [["use"]]}
```

HotLoop voit l'appel comme celui d'un client MCP, selon ses propres règles : MCP lit et écrit, par la même porte que tout le monde, donc un `write_tag` sur une balise armée et dans la plage passe (une fois activées les écritures propres à HotLoop) et un que HotLoop refuse, une balise que personne n'a marquée comme inscriptible par exemple, revient comme l'erreur du nœud, avec les mots de HotLoop. Pour écrire par la porte de HotLoop depuis un flux sans MCP, utilisez les nœuds HotLoop vus plus haut.

## Ce contre quoi il a été testé

**Le serveur** est testé avec le client du SDK Go lui-même sur du vrai HTTP, dans les deux époques : lister, appeler, arguments refusés, une permission refusée, un jeton refusé, les lignes d'audit, un outil qui disparaît quand son nœud s'arrête, et tout le serveur d'administration devant lui avec de vrais jetons d'API et de session et le journal d'audit sur disque. La CLI Inspector du projet MCP 2.12.0 a listé les outils d'un Flow en marche, les a appelés, et a été refusée sans jeton et avec un jeton inventé. Le nœud `mcp client` a été exécuté contre un vrai HotLoop 4.18.10 (l'image IoT publiée) : il a listé ses 27 outils, appelé `get_plant_status`, `list_devices` et `get_states` et utilisé les réponses, a été refusé avec un mauvais jeton et sans jeton, a reçu l'erreur propre à HotLoop pour un outil qui n'existe pas et pour une écriture que MCP n'a pas le droit de faire, et un outil Flow appelé par l'Inspector a exécuté un flux qui a appelé le MCP de HotLoop et répondu avec ce qu'il a dit.

**Non fait :** OAuth (un jeton porteur est la seule entrée, dans les deux sens), les serveurs stdio, les ressources, les prompts, l'échantillonnage, l'élicitation et les notifications de progression, ainsi que le schéma de sortie d'un outil. HotLoop 4.18.10 parle les révisions à poignée de main, donc le nœud le rencontre ainsi ; face à un serveur de la révision courante, il n'est testé qu'avec celui de Flow. Un serveur à poignée de main qui oublie une session (un redémarrage) fait échouer le premier appel suivant, une seule fois, et le suivant se reconnecte. La limitation du débit se fait par jeton d'API et reste désactivée tant que vous ne la réglez pas, donc un jeton sans `rateLimit` n'est borné que par les files, qui ont déjà un plafond, et par la taille de la requête, 4 MiB.
