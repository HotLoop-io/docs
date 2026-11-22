---
title: "L'API d'administration"
description: "Les appels HTTP et websocket qu'utilisent l'éditeur et la ligne de commande, ce que chacun demande et ce qu'il renvoie."
---

| Méthode et chemin | Autorisation | Remarques |
|---|---|---|
| `GET /health` | aucune | Vitalité. Le kubelet ne porte aucun jeton, et exiger une authentification sur cette route ferait redémarrer le pod en boucle pour toujours. |
| `GET /ready` | aucune | Disponibilité, signalée séparément, pour qu'une exécution qui n'a pas pu démarrer laisse le Service sans que le kubelet tue le pod. |
| `POST /auth/token` | aucune | Se connecter. Un 429 avec `Retry-After` pendant un blocage. |
| `POST /auth/revoke` | aucune | Se déconnecter. |
| `GET /auth/mode` | sans connexion | Indique si cette exécution est ouverte depuis le tableau de bord EmberCORE : `{"dashboard": bool, "hideLogin": bool}`. L'éditeur le demande avant que quiconque se soit connecté. |
| `GET /auth/mfa`, `POST /auth/mfa/setup`, `/confirm`, `/disable` | un utilisateur connecté | Votre propre connexion à deux facteurs. Setup renvoie la clé, le lien `otpauth://` et le code QR. Confirm et disable prennent `{"code": ...}`. |
| `POST /auth/mfa/reset` | `auth.admin` | Désactive la connexion à deux facteurs de quelqu'un d'autre : `{"username": ...}`. |
| `GET /metrics` | aucune | Prometheus. Des compteurs et des ids de nœud seulement, jamais le contenu des messages ni la configuration. |
| `GET /settings` | `settings.read` | |
| `GET /nodes` | `nodes.read` | Le registre, qui alimente la palette de l'éditeur et ses boîtes de dialogue. |
| `GET /plugins` | `nodes.read` | Les plugins chargés, ce que chacun demande et ce qui lui a été accordé, et ceux qui ont été refusés avec la raison. |
| `GET /flows` | `flows.read` | |
| `GET /flows/export` | `flows.read` | Le fichier de flux exactement tel qu'il est sur le disque, pour git. |
| `POST /flows` | `flows.write` | Déployer. Prend une note facultative pour le journal des déploiements. |
| `GET /deployments` | `flows.read` | Le journal des déploiements, du plus récent au plus ancien, sans les charges. `?limit=N` le borne. |
| `GET /audit` | `audit.read` | Qui a fait quoi, d'où, du plus récent au plus ancien. `?event=`, `?user=`, `?since=`, `?limit=`. |
| `GET /deployments/{seq}` | `flows.read` | Un enregistrement, avec ses flux analysés. Jamais ses identifiants. |
| `GET /deployments/{seq}/flows` | `flows.read` | Le fichier de flux de ce déploiement, octet pour octet. |
| `GET /deployments/{from}/diff/{to}` | `flows.read` | Différence nœud par nœud entre deux déploiements, structurée et en texte. |
| `POST /flows/diff` | `flows.read` | La différence entre ce qui est en ligne et le document du corps. Ne déploie rien. |
| `POST /flows/types` | `flows.read` | La vérification des fils typés qu'un déploiement effectue, sur le document du corps : `{"wires": [...]}`, vide quand tout va bien. L'éditeur dessine la réponse. Ne déploie rien. |
| `POST /deployments/{seq}/rollback` | `flows.write` | Redéploie les flux et identifiants de cet enregistrement comme un nouveau déploiement. Prend l'en-tête rev et un `{"note": ...}` facultatif. |
| `GET /tests` | `flows.read` | La suite de tests du flux conservée à côté du fichier de flux, son nom de fichier, et si les déploiements en dépendent. |
| `PUT /tests` | `flows.write` | Remplace la suite. Le corps est le YAML ; un YAML qui ne s'analyse pas donne un 400 avec la raison. |
| `POST /tests/run` | `flows.read` | Exécute la suite, ou `"tests"` du corps, contre `"flows"` du corps ou ce qui tourne. Renvoie le rapport. Ne déploie rien. |
| `POST /tests/from-debug` | `flows.read` | Rédige un test à partir de `{"node", "msgId"}`, un message qu'un nœud Debug a affiché. N'enregistre rien. |
| `POST /tests/cases` | `flows.write` | Ajoute les tests du corps, un fichier de tests à part, à la fin de la suite. |
| `GET /traces` | `flows.read` | Les traces conservées, de la plus récente à la plus ancienne, avec ce que contient le tampon et ses limites. `?limit=N`. 404 avec `trace.enabled: false`. |
| `GET /traces/find` | `flows.read` | La trace dans laquelle un message se trouvait, d'après `?msgId=` et `?node=`, l'id et le nœud Debug que montre la barre latérale. Renvoie chaque saut et le chemin jusqu'à celui demandé. |
| `GET /traces/{id}` | `flows.read` | Une trace, chaque saut avec son temps et le message tel que le nœud l'a reçu. |
| `POST /traces/{id}/test` | `flows.read` | Rédige un test de flux à partir de la trace. N'enregistre rien. |
| `POST /traces/{id}/replay` | `flows.read` | Injecte le message qui a lancé la trace dans `"flows"` du corps, ou ce qui tourne, dans un processus fils, et renvoie où il aboutit par rapport à où il avait abouti. Ne déploie rien. |
| `GET /runtime/stats` | `status.read` | |
| `POST /inject/{id}` | `inject.write` | Déclenche un nœud Inject. |
| `GET /comms` | `status.read` | Le websocket d'état et de débogage de l'éditeur. Envoyez le jeton comme sous-protocole `hotloop-flow.bearer.<token>`, proposé à côté de `hotloop-flow`. C'est ce que fait l'éditeur. `?access_token=<token>` dans l'URL fonctionne toujours pour les scripts qui l'utilisent déjà, et consigne un avertissement pour chaque connexion qui le fait, parce qu'une URL finit dans les journaux de proxy et d'accès. |
| `POST /mcp` (et `GET` et `DELETE`, pour les anciennes révisions du protocole) | `mcp.call` | Le [point de terminaison MCP](/fr/flow/mcp/), où les flux sont servis comme outils. Un jeton de session ou d'API comme les autres. Les outils proposés à un appelant, et qu'il peut appeler, sont ceux que ses autorisations atteignent. 403 quand l'authentification est désactivée. |

`/metrics` et `/health` sans authentification, c'est une décision et non un oubli. Un collecteur Prometheus ne porte aucun jeton porteur, donc en exiger un revient à remettre un identifiant à votre pile de supervision ou à ne pas avoir de supervision.

Un utilisateur dont la connexion à deux facteurs est activée envoie `"code"` avec le nom d'utilisateur et le mot de passe à `POST /auth/token`. Sans lui, la réponse est un 401 avec `"mfa": "required"`.

Les autorisations sont `"*"` pour tout, une chaîne exacte comme `flows.read`, ou une attribution par préfixe comme `flows.*`. Un agent qui appelle des flux comme outils MCP a besoin de `mcp.call`. Un compte en lecture seule pour un tableau de bord qui veut seulement afficher l'état des flux est `["flows.read", "status.read"]` et rien de plus.

Les déploiements acceptent un en-tête facultatif `HotLoop-Flow-Deployment-Rev`. Envoyez la révision que vous avez lue en dernier et un déploiement en concurrence avec un autre éditeur est rejeté par un 409 au lieu d'écraser en silence le travail de quelqu'un, ce qui est l'échec dont seul celui qui a perdu son après-midi entend parler.

Un déploiement ne redémarre que ce que vous avez changé. Un nœud reste actif quand rien de ce dont il dépend n'a bougé : ses réglages, son onglet, son groupe, son environnement, ses identifiants et chaque nœud de configuration qu'il nomme. Le déplacer sur le canevas ou le recâbler ne compte pas, parce que les nouveaux fils se branchent sur le nœud en cours d'exécution. Ainsi, corriger une faute de frappe dans un nœud de fonction ne coupe plus toutes les sessions MQTT du boîtier, et un nœud Delay qui garde dix minutes de mesures continue de les garder. C'est toute la raison de son existence : quand chaque enregistrement fait rebondir l'usine, les opérateurs cessent d'enregistrer pendant une équipe et le correctif attend samedi.

Choisissez ce qui redémarre avec un en-tête `HotLoop-Flow-Deployment-Type`. Le `Node-RED-Deployment-Type` de Node-RED fonctionne aussi, si bien qu'un script de déploiement que vous avez déjà obtient le redémarrage qu'il demande.

| Type | Ce qui redémarre |
|---|---|
| `nodes` (par défaut) | Les nœuds que vous avez changés, plus tout ce qui nomme un nœud de configuration que vous avez changé. |
| `flows` | Chaque nœud de tout flux qui contient un changement. |
| `full` | Tout. Comme redémarrer le processus. |

La réponse dit ce qu'elle a fait : `type`, `started`, `restarted`, `stopped` et `unchanged`. Rien de ce qui est en cours ne se perd en route. Le travail déjà en file sur un nœud remplacé se termine sur l'ancienne instance, tout ce qui arrive pendant le remplacement attend la nouvelle, et un message destiné à un nœud supprimé est compté et apparaît comme un abandon au lieu de s'évanouir.
