---
title: "L'API HTTP"
description: "Chaque appel auquel HotLoop répond en HTTP, ce qu'il exige, ce qu'il accepte et ce qu'il renvoie. L'interface web n'utilise rien d'autre."
---

Tous les appels que le Gateway accepte en HTTP, ce dont chacun a besoin, ce qu'il reçoit et ce qu'il renvoie. L'interface web n'utilise rien d'autre : il n'y a aucune API privée derrière les écrans, donc tout ce que l'interface sait faire, un script le fait avec les mêmes appels et les mêmes autorisations.

Cette page est vérifiée par rapport au code. La liste des routes et de qui peut les appeler n'est donc pas la description d'une API telle qu'elle a été un jour. Les formes des requêtes et des réponses ci-dessous ont été relevées sur un Gateway en marche ; les tests ne les vérifient pas, donc si vous modifiez un gestionnaire, modifiez aussi sa section ici.

Le contexte de chaque fonction se trouve dans sa propre page : [Authentification et utilisateurs](/fr/iot/authentication/), [Entités](/fr/iot/entities/), [l'arbre des équipements et les libellés](/fr/iot/equipment/), [Automatisations](/fr/iot/automations/), [Rapports planifiés](/fr/gateway/reports/), [Gestion de parc](/fr/gateway/fleet/), [Notifications d'alarme](/fr/iot/notifications/), [Sauvegardes et restauration](/fr/iot/backup/) et [MCP](/fr/iot/mcp/). Cette page est la liste ; celles-là donnent les raisons.

## Conventions

### Où elle se trouve

Tout passe par le seul port HTTP de l'application (`HOTLOOP_LISTEN_ADDR`, `:8080` par défaut). Derrière un proxy qui sert l'application sous un chemin, définissez `HOTLOOP_BASE_PATH` et le Gateway le retire, si bien que `/hotloop/api/devices` et `/api/devices` sont le même appel. Les chemins ci-dessous sont écrits sans lui.

### Se connecter : un cookie ou un jeton bearer

Toute route `/api/` demande une session, sauf la connexion (par mot de passe, ou par code PIN ou badge sur un panneau en libre-service), les webhooks entrants et les liens d'acquittement d'alarme, qui portent chacun leur propre preuve dans la requête. `POST /api/auth/login` répond avec un jeton et le place aussi dans le cookie `iiot_session` (HttpOnly, SameSite=Lax, Secure quand la requête est arrivée en TLS ou avec `X-Forwarded-Proto: https`). Un navigateur utilise le cookie et ne voit jamais le jeton. Un script envoie le jeton à la place :

```
Authorization: Bearer 3f9c...e1
```

Les deux sont la même session, vérifiée de la même façon. Une session dure `HOTLOOP_AUTH_SESSION_TTL` (12 heures par défaut). Sans session, toute route `/api/` répond :

```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="hotloop"

{"error":"not logged in"}
```

ou `"the session is invalid or has expired"` pour un jeton révoqué ou arrivé à échéance, ou `"this account no longer has access"` pour un compte désactivé.

Avec `HOTLOOP_AUTH_INSECURE=true`, il n'y a plus de connexion du tout : rien n'est vérifié, toutes les autorisations ci-dessous sont accordées à tout le monde, et le nom enregistré pour une écriture vient de l'en-tête `X-EmberNET-User`, `X-Forwarded-User`, `X-Auth-Request-User`, `X-Remote-User` ou `X-Forwarded-Email` du proxy, ou vaut `operator` si aucun n'est défini. Cela n'a de sens que derrière une NetworkPolicy qui ne laisse atteindre le pod qu'au proxy du tableau de bord. Voir [Authentification et utilisateurs](/fr/iot/authentication/#fonctionner-sans-connexion).

MCP est à part : il a son propre jeton bearer (`HOTLOOP_MCP_TOKEN`) et ne regarde jamais une session. Voir [MCP](#mcp).

### Autorisations

Un utilisateur connecté détient une liste d'autorisations, qui vient de son rôle ou qui est fixée sur le compte. Une route qui en exige une que l'utilisateur n'a pas répond :

```
HTTP/1.1 403 Forbidden

{"error":"viewer1 does not have the \"values.write\" permission"}
```

Le [tableau des autorisations](#autorisations) indique quel rôle détient quoi.

### Erreurs

Tout échec produit par l'API elle-même est un JSON d'une seule forme :

```json
{"error": "value is outside the tag's configured range: 120 is outside 0..95"}
```

`/readyz` ajoute un `detail`, et un appel de service qui échoue ajoute les écritures qu'il a faites. Le message est écrit pour la personne qui le lit : il dit ce qui n'allait pas et, quand il y en a une, ce qu'il faut faire à la place. Affichez-le tel quel.

| Statut | Quand |
|---|---|
| 400 | La requête est incorrecte : un corps mal formé, un champ qui échoue à la validation, un champ inconnu, un paramètre manquant, un service inconnu |
| 401 | Pas de session, une session expirée, ou un mauvais mot de passe à la connexion |
| 403 | L'utilisateur n'a pas l'autorisation, ou la porte d'écriture a refusé l'écriture pour une raison de politique : écritures désactivées, tag non armé, entité désactivée |
| 404 | Ce que nomme le chemin ou le corps n'existe pas |
| 409 | Cela existe déjà, ou c'est dans un état qui ne le permet pas : une alarme qui n'est pas mise en attente, un nœud qui a encore des enfants, une entité sans état connu à basculer, un script déjà en cours, une recette refusée ou déjà en cours d'application |
| 422 | Une valeur que la porte d'écriture a refusée sur le fond : hors de la plage du tag, hors du pas d'une entité |
| 502 | L'appareil a répondu avec une erreur à lui et le corps reprend ses mots ; ou une recette a démarré sans que toutes les cibles soient atteintes, et le corps dit lesquelles sont parties et lesquelles non |
| 503 | L'appareil n'est pas connecté, ou le moteur d'alarmes ne tourne pas |
| 500 | Une panne à l'intérieur du serveur. Le corps est `internal error (ref …); the server log has the detail under that ref` et rien de plus, et le journal contient l'erreur complète sous cette référence. Le seul 500 avec un vrai message est un appui sur un bouton dont le relâchement n'est pas parti, parce que ce message dit exactement quoi vérifier |

Tout ce que l'API ne sait pas classer est un 500, jamais un 400. Une panne de base de données renvoyée en 400 dit à l'opérateur qu'il a mal saisi quelque chose, et il part chercher une faute de frappe qui n'existe pas.

Deux échecs ne viennent pas de l'API et sont du texte brut, pas du JSON : un chemin qui ne correspond à aucune route répond `404 page not found`, et un chemin connu appelé avec la mauvaise méthode répond `405 method not allowed`.

Une écriture refusée n'est jamais un 500. Un écran d'usine qui montre un refus de politique comme une panne du serveur apprend aux opérateurs à ignorer les erreurs.

### Corps

Les corps de requête sont du JSON, de 4 Mio au plus (un webhook entrant, 1 Mio). **Les champs inconnus sont refusés**, pas ignorés :

```json
{"error":"request body: json: unknown field \"x\""}
```

Un réglage mal écrit qui disparaît en silence ressemble exactement à un réglage qui a fonctionné, donc le décodeur répond non.

`POST` et `PUT` sur les appareils, tags, alarmes, automatisations, membres du parc et rapports remplacent l'objet entier : un champ omis prend sa valeur zéro, et un booléen omis vaut `false`. Lisez, modifiez, renvoyez. Les exceptions sont les `PUT` des entités et des équipements, qui ne changent que les champs envoyés, et les identifiants des appareils, qui sont conservés quand on les omet (voir plus bas).

### Les secrets sont en écriture seule

Un identifiant stocké dans un appareil (un mot de passe de broker, un en-tête HTTP, un mot de passe dans l'adresse) n'est jamais renvoyé, à aucun rôle, administrateur compris. Il apparaît sous la forme `[redacted]` :

```json
"config": {"clientId": "docs-api-tankfarm", "password": "[redacted]", "username": "tank"}
```

Quand vous enregistrez l'appareil, envoyez le marqueur (ou laissez la clé de côté) pour garder la valeur stockée, envoyez une nouvelle valeur pour la remplacer, et envoyez `""` ou `null` pour l'effacer. Un nouvel appareil ne peut pas être enregistré avec le marqueur, et un enregistrement qui déplace l'appareil vers un autre hôte en gardant un identifiant est refusé, pour qu'un mot de passe stocké ne puisse pas être emporté vers l'écouteur de quelqu'un d'autre. Les règles complètes sont dans [Authentification et utilisateurs](/fr/iot/authentication/#les-identifiants-dappareil-sont-en-écriture-seule). Il en va de même pour tout autre identifiant que détient le Gateway : les réglages affichent `set` ou `not set`, le diagnostic retire les identifiants des cibles MCP sortantes, et rien dans cette API ne renvoie un hachage de mot de passe ni un jeton de session, hormis celui que la connexion vous remet.

### camelCase, sauf là où c'est du snake_case

La plus grande partie de l'API est en camelCase (`deviceId`, `pollIntervalMs`, `createdAt`), comme depuis la première version et comme l'exige le contrat `TagValue` du tableau de bord EmberNet.

Les endpoints des entités, états, services, équipements et libellés sont en snake_case (`entity_id`, `last_changed`, `parent_id`, `label_id`). C'est voulu : l'API des entités reprend la forme courante d'entité, d'état et de service, de sorte que tout ce qui la parle déjà parle aussi celle-ci, et l'arbre des équipements est le registre des zones du modèle d'entités, mis en forme pour les mêmes consommateurs. Là où les deux se rejoignent, chaque côté garde sa casse : un appareil a `equipmentId`, une entité a `equipment_id`.

### Horodatages, durées et clés de tag

- **Les horodatages** sont en RFC 3339 en UTC, avec des fractions de seconde quand il y en a : `2026-09-27T20:21:58.255869Z`. Le réglage de fuseau horaire d'affichage change ce que montre l'interface, jamais ce que renvoie l'API.
- **Une heure qui n'a pas eu lieu est omise.** Une règle qui ne s'est jamais exécutée n'a pas de `lastRun`, un appareil jamais interrogé n'a ni `lastPoll` ni `lastGood`, une alarme que personne n'a acquittée n'a pas de `ackedAt`, un membre du parc jamais vu n'a pas de `lastSeen`. Un champ d'heure absent veut dire jamais. Vous ne verrez jamais l'heure zéro de Go, `0001-01-01T00:00:00Z`, dans une réponse ni dans un événement de flux. Une douzaine de champs l'envoyaient, et l'écran des automatisations montrait une règle jamais exécutée comme exécutée pour la dernière fois il y a 739887 jours. Un test parcourt chaque route et chaque champ d'heure du code pour que cela reste ainsi.
- **Les sparklines** sont l'exception : `timestamps` y est en millisecondes Unix, parce qu'il va directement dans un graphique.
- **Les durées** disent leur unité dans leur nom : `pollIntervalMs`, `onDelaySec`, `minutes`, `durationMs`. `uptime` dans l'état est une chaîne de durée Go (`11m13s`).
- **Une clé de tag** est `device/tag`, la forme que prennent tous les paramètres `?tag=` et tous les champs `tag`. Les noms de tag peuvent contenir des barres obliques (chemins OPC UA, topics MQTT), donc seule la première barre sépare : `plc-1/Line/Zone 1` est le tag `Line/Zone 1` de l'appareil `plc-1`.
- **Un paramètre de requête numérique** qui n'est pas un nombre est ignoré et la valeur par défaut est utilisée, donc `?limit=abc` revient à ne pas mettre `?limit`.
- **Les listes vides** sont `[]`, jamais `null`, dans chaque réponse et chaque événement de flux, à toute profondeur. Inutile de tester null avant `.length`. Un `null` que vous voyez n'est jamais une liste : c'est l'un des champs documentés qui acceptent null, comme l'`equipment_id` d'une entité ou le `parent_id` d'un nœud racine. Un champ de liste marqué facultatif peut quand même être omis entièrement.

### Fonctions facultatives

Le parc, les notifications, les sauvegardes et les rapports planifiés sont désactivés tant que leur variable `HOTLOOP_*_ENABLED` n'est pas définie. Fonction désactivée, sa route de liste répond quand même 200, avec `"configured": false` et une liste vide, pour qu'un écran puisse dire « non activé » plutôt que « rien ici ». Toutes les autres routes de cette fonction répondent 400 avec une erreur qui nomme la variable :

```json
{"error":"backups are not enabled (HOTLOOP_BACKUP_ENABLED)"}
```

`GET /api/sites` fait de même quand aucun serveur MCP sortant n'est configuré.

### Absent de ce produit

HotLoop est livré en IoT, Edge, Gateway et Edge Relay à partir d'une seule base de code, et une fonction qu'un produit n'a pas n'est pas désactivée : elle n'est pas dans le binaire. Sur IoT, Edge et Gateway, ses routes répondent quand même, après la même vérification d'autorisation, par un 404 qui le dit et nomme les deux bouts, pour qu'un script distingue « mauvais boîtier » de « mauvaise URL » :

```json
{"error":"scheduled reports are part of HotLoop Gateway; this is HotLoop IoT","product":"iot","feature":"reports"}
```

Pas un 400, parce qu'aucune variable ne règle cela, ni un 5xx, parce que rien n'a mal tourné. `GET /api/status` dit d'emblée quel produit a répondu et quelles fonctions il a, pour qu'un client puisse demander au lieu de sonder.

### Tout ce qui change quelque chose est journalisé

Chaque création, modification, suppression, écriture, acquittement et connexion arrive dans le journal système (`GET /api/events`) avec le nom de l'utilisateur, et chaque écriture sur un tag, refusée ou non, arrive dans l'audit des écritures (`GET /api/writes`). L'API n'a pas de chemin discret.

## Autorisations

Qui détient quoi. Un compte avec une liste d'autorisations explicite détient exactement ce qu'elle nomme, à la place de l'ensemble de son rôle. `*` accorde tout et `resource.*` accorde tout ce qui se trouve sous une ressource (`reports.*`). Le rôle admin est `*`.

| Autorisation | viewer | operator | admin |
|---|---|---|---|
| `status.read` | oui | oui | oui |
| `devices.read` | oui | oui | oui |
| `devices.write` | non | non | oui |
| `tags.read` | oui | oui | oui |
| `tags.write` | non | non | oui |
| `values.read` | oui | oui | oui |
| `values.write` | non | oui | oui |
| `board.write` | non | oui | oui |
| `entities.read` | oui | oui | oui |
| `entities.write` | non | non | oui |
| `helpers.write` | non | oui | oui |
| `equipment.read` | oui | oui | oui |
| `equipment.write` | non | non | oui |
| `alarms.read` | oui | oui | oui |
| `alarms.write` | non | non | oui |
| `alarms.ack` | non | oui | oui |
| `automations.read` | oui | oui | oui |
| `automations.write` | non | non | oui |
| `automations.trigger` | non | oui | oui |
| `scripts.read` | oui | oui | oui |
| `scripts.run` | non | oui | oui |
| `scripts.write` | non | non | oui |
| `recipes.read` | oui | oui | oui |
| `recipes.apply` | non | oui | oui |
| `recipes.write` | non | non | oui |
| `blueprints.read` | oui | oui | oui |
| `blueprints.apply` | non | oui | oui |
| `blueprints.write` | non | non | oui |
| `dashboards.read` | oui | oui | oui |
| `dashboards.write` | non | non | oui |
| `energy.read` | oui | oui | oui |
| `energy.write` | non | non | oui |
| `fleet.read` | oui | oui | oui |
| `fleet.write` | non | oui | oui |
| `fleet.rebirth` | non | oui | oui |
| `fleet.restart` | non | non | oui |
| `fleet.update` | non | non | oui |
| `fleet.config` | non | non | oui |
| `notify.test` | non | non | oui |
| `notify.escalation` | non | non | oui |
| `backup.read` | non | non | oui |
| `backup.run` | non | non | oui |
| `reports.read` | oui | oui | oui |
| `reports.run` | non | oui | oui |
| `reports.write` | non | non | oui |
| `sites.read` | oui | oui | oui |
| `settings.read` | oui | oui | oui |
| `settings.write` | non | non | oui |
| `events.read` | oui | oui | oui |
| `logbook.read` | oui | oui | oui |
| `users.manage` | non | non | oui |

La ligne de partage est la même partout : un opérateur fait tourner l'usine (écrit des valeurs, acquitte des alarmes, déclenche des automatisations, relance un relais), et seul un administrateur change ce que l'usine est configurée pour être, ou fait quelque chose vers l'extérieur au nom du Gateway (redémarrer un relais, lui envoyer sa configuration, envoyer une page de test, définir un rapport qui envoie des données d'usine par courriel quelque part).

## Index des endpoints

La colonne d'autorisation dit ce que la route vérifie. `session` veut dire tout utilisateur connecté, sans autre autorisation. `none` veut dire pas de session non plus, et la section explique pourquoi. `(in handler)` veut dire que la vérification se fait dans le gestionnaire plutôt qu'en amont, et la section explique pourquoi.

La colonne de produit indique le plus petit HotLoop qui a la route : `all` est IoT, Edge et Gateway, `edge` est Edge et Gateway, `gateway` est le Gateway seul. Chaque produit enregistre toutes les routes et y vérifie la même autorisation. Sur un produit qui ne l'a pas, la route répond 404 et dit où elle se trouve ; voir [Absent de ce produit](#absent-de-ce-produit).

| Méthode | Chemin | Autorisation | Produit |
|---|---|---|---|
| `GET` | `/healthz` | none | all |
| `GET` | `/readyz` | none | all |
| `POST` | `/api/auth/login` | none | all |
| `POST` | `/api/auth/kiosk` | none | all |
| `POST` | `/api/auth/logout` | session | all |
| `POST` | `/api/auth/activity` | session | all |
| `GET` | `/api/auth/session` | session | all |
| `POST` | `/api/auth/password` | session | all |
| `GET` | `/api/users` | `users.manage` | all |
| `POST` | `/api/users` | `users.manage` | all |
| `PUT` | `/api/users/{username}` | `users.manage` | all |
| `DELETE` | `/api/users/{username}` | `users.manage` | all |
| `POST` | `/api/users/{username}/password` | `users.manage` | all |
| `DELETE` | `/api/users/{username}/lockout` | `users.manage` | all |
| `PUT` | `/api/users/{username}/pin` | `users.manage` | all |
| `DELETE` | `/api/users/{username}/pin` | `users.manage` | all |
| `GET` | `/api/opcua/certificates` | `users.manage` | all |
| `GET` | `/api/users/{username}/certificates` | `users.manage` | all |
| `POST` | `/api/users/{username}/certificates` | `users.manage` | all |
| `POST` | `/api/users/{username}/certificates/{thumbprint}/revoke` | `users.manage` | all |
| `DELETE` | `/api/users/{username}/certificates/{thumbprint}` | `users.manage` | all |
| `GET` | `/api/status` | `status.read` | all |
| `GET` | `/api/protocols` | `status.read` | all |
| `GET` | `/api/diagnostics` | `status.read` | all |
| `GET` | `/api/devices` | `devices.read` | all |
| `POST` | `/api/devices` | `devices.write` | all |
| `GET` | `/api/devices/{id}` | `devices.read` | all |
| `DELETE` | `/api/devices/{id}` | `devices.write` | all |
| `POST` | `/api/devices/{id}/enabled` | `devices.write` | all |
| `POST` | `/api/devices/{id}/browse` | `devices.read` | all |
| `POST` | `/api/devices/{id}/import` | `tags.write` | all |
| `GET` | `/api/devices/{id}/network` | `devices.read` | all |
| `PUT` | `/api/devices/{id}/network` | `devices.write` | all |
| `DELETE` | `/api/devices/{id}/network` | `devices.write` | all |
| `GET` | `/api/unifi/{id}/networks` | `devices.read` | all |
| `PUT` | `/api/unifi/{id}/networks/{network}` | `devices.write` | all |
| `POST` | `/api/unifi/{id}/networks/{network}/accept-all` | `devices.write` | all |
| `GET` | `/api/unifi/{id}/known` | `devices.read` | all |
| `PUT` | `/api/unifi/{id}/networks/{network}/known/{mac}` | `devices.write` | all |
| `DELETE` | `/api/unifi/{id}/networks/{network}/known/{mac}` | `devices.write` | all |
| `GET` | `/api/unifi/{id}/clients` | `devices.read` | all |
| `GET` | `/api/unifi/consoles` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/overview` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/topology` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/devices` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/wifi` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/events` | `devices.read` | all |
| `POST` | `/api/unifi/{id}/starter-alarms` | `alarms.write` | all |
| `GET` | `/api/discovery` | `devices.read` | all |
| `GET` | `/api/discovery/{source}/{key}` | `devices.read` | all |
| `POST` | `/api/discovery/{source}/{key}/accept` | `devices.write` | all |
| `POST` | `/api/discovery/{source}/{key}/ignore` | `devices.write` | all |
| `POST` | `/api/discovery/{source}/{key}/unignore` | `devices.write` | all |
| `POST` | `/api/discovery/{source}/{key}/review/apply` | `devices.write` | all |
| `POST` | `/api/discovery/{source}/{key}/review/reject` | `devices.write` | all |
| `GET` | `/api/network-discovery` | `devices.read` | all |
| `GET` | `/api/network-discovery/{key}` | `devices.read` | all |
| `POST` | `/api/network-discovery/{key}/accept` | `devices.write` | all |
| `POST` | `/api/network-discovery/{key}/ignore` | `devices.write` | all |
| `POST` | `/api/network-discovery/{key}/unignore` | `devices.write` | all |
| `POST` | `/api/network-discovery/probe` | `devices.write` | all |
| `GET` | `/api/integrations` | `devices.read` | all |
| `POST` | `/api/integrations/{id}/probe` | `devices.write` | all |
| `POST` | `/api/integrations/{id}/setup` | `devices.write` | all |
| `GET` | `/api/broker/logins` | `users.manage` | all |
| `POST` | `/api/broker/logins` | `users.manage` | all |
| `PUT` | `/api/broker/logins/{name}` | `users.manage` | all |
| `DELETE` | `/api/broker/logins/{name}` | `users.manage` | all |
| `GET` | `/api/mqtt/brokers` | `devices.read` | all |
| `POST` | `/api/mqtt/brokers` | `devices.write` | all |
| `PUT` | `/api/mqtt/brokers/{id}` | `devices.write` | all |
| `DELETE` | `/api/mqtt/brokers/{id}` | `devices.write` | all |
| `GET` | `/api/tags` | `tags.read` | all |
| `POST` | `/api/tags` | `tags.write` | all |
| `DELETE` | `/api/tags/{device}/{name}` | `tags.write` | all |
| `GET` | `/api/values` | `values.read` | all |
| `GET` | `/api/sparkline` | `values.read` | all |
| `GET` | `/api/board` | `values.read` | all |
| `PUT` | `/api/board` | `board.write` | all |
| `POST` | `/api/write` | `values.write` | all |
| `GET` | `/api/history` | `values.read` | all |
| `GET` | `/api/writes` | `values.read` | all |
| `GET` | `/api/entities` | `entities.read` | all |
| `GET` | `/api/entities/composites` | `entities.read` | all |
| `GET` | `/api/entities/{entity_id}` | `entities.read` | all |
| `GET` | `/api/entities/{entity_id}/image` | `entities.read` | all |
| `PUT` | `/api/entities/{entity_id}` | `entities.write` | all |
| `POST` | `/api/entities` | `entities.write` | all |
| `DELETE` | `/api/entities/{entity_id}` | `entities.write` | all |
| `GET` | `/api/states` | `entities.read` | all |
| `GET` | `/api/states/{entity_id}` | `entities.read` | all |
| `GET` | `/api/energy/meters` | `energy.read` | all |
| `POST` | `/api/energy/meters` | `energy.write` | all |
| `GET` | `/api/energy/meters/{id}` | `energy.read` | all |
| `PUT` | `/api/energy/meters/{id}` | `energy.write` | all |
| `DELETE` | `/api/energy/meters/{id}` | `energy.write` | all |
| `GET` | `/api/energy/summary` | `energy.read` | all |
| `GET` | `/api/energy/summary/{period}` | `energy.read` | all |
| `GET` | `/api/energy/series` | `energy.read` | all |
| `GET` | `/api/energy/series/{meter}/{period}/{step}` | `energy.read` | all |
| `POST` | `/api/services/{domain}/{service}` | `values.write`, `alarms.ack`, `helpers.write`, `scripts.run`, `recipes.apply` (in handler) | all |
| `GET` | `/api/helpers` | `entities.read` | all |
| `POST` | `/api/helpers` | `entities.write` | all |
| `GET` | `/api/helpers/{entity_id}` | `entities.read` | all |
| `PUT` | `/api/helpers/{entity_id}` | `entities.write` | all |
| `DELETE` | `/api/helpers/{entity_id}` | `entities.write` | all |
| `GET` | `/api/equipment` | `equipment.read` | all |
| `POST` | `/api/equipment` | `equipment.write` | all |
| `GET` | `/api/equipment/{id}` | `equipment.read` | all |
| `PUT` | `/api/equipment/{id}` | `equipment.write` | all |
| `DELETE` | `/api/equipment/{id}` | `equipment.write` | all |
| `GET` | `/api/labels` | `equipment.read` | all |
| `POST` | `/api/labels` | `equipment.write` | all |
| `GET` | `/api/labels/{label_id}` | `equipment.read` | all |
| `PUT` | `/api/labels/{label_id}` | `equipment.write` | all |
| `DELETE` | `/api/labels/{label_id}` | `equipment.write` | all |
| `PUT` | `/api/devices/{id}/labels` | `equipment.write` | all |
| `GET` | `/api/alarms` | `alarms.read` | all |
| `POST` | `/api/alarms` | `alarms.write` | all |
| `POST` | `/api/alarms/import/codesys` | `alarms.write` | all |
| `DELETE` | `/api/alarms/{id}` | `alarms.write` | all |
| `POST` | `/api/alarms/{id}/ack` | `alarms.ack` | all |
| `POST` | `/api/alarms/{id}/shelve` | `alarms.ack` | all |
| `POST` | `/api/alarms/{id}/unshelve` | `alarms.ack` | all |
| `GET` | `/api/alarms/events` | `alarms.read` | all |
| `GET` | `/api/automations` | `automations.read` | all |
| `POST` | `/api/automations` | `automations.write` | all |
| `POST` | `/api/automations/validate` | `automations.write` | all |
| `DELETE` | `/api/automations/{id}` | `automations.write` | all |
| `POST` | `/api/automations/{id}/enabled` | `automations.write` | all |
| `POST` | `/api/automations/{id}/trigger` | `automations.trigger` | all |
| `GET` | `/api/runs` | `automations.read` | all |
| `POST` | `/api/automations/{id}/blueprint-upgrade` | `blueprints.apply` | all |
| `GET` | `/api/blueprints` | `blueprints.read` | all |
| `POST` | `/api/blueprints` | `blueprints.write` | all |
| `GET` | `/api/blueprints/{id}` | `blueprints.read` | all |
| `PUT` | `/api/blueprints/{id}` | `blueprints.write` | all |
| `DELETE` | `/api/blueprints/{id}` | `blueprints.write` | all |
| `POST` | `/api/blueprints/{id}/instantiate` | `blueprints.apply` | all |
| `GET` | `/api/dashboards` | `dashboards.read` | all |
| `POST` | `/api/dashboards` | `dashboards.write` | all |
| `GET` | `/api/dashboards/{id}` | `dashboards.read` | all |
| `PUT` | `/api/dashboards/{id}` | `dashboards.write` | all |
| `DELETE` | `/api/dashboards/{id}` | `dashboards.write` | all |
| `GET` | `/api/dashboards/{id}/export` | `dashboards.read` | all |
| `POST` | `/api/dashboards/import` | `dashboards.write` | all |
| `GET` | `/api/scripts` | `scripts.read` | all |
| `POST` | `/api/scripts` | `scripts.write` | all |
| `POST` | `/api/scripts/validate` | `scripts.write` | all |
| `GET` | `/api/scripts/{id}` | `scripts.read` | all |
| `PUT` | `/api/scripts/{id}` | `scripts.write` | all |
| `DELETE` | `/api/scripts/{id}` | `scripts.write` | all |
| `POST` | `/api/scripts/{id}/run` | `scripts.run` | all |
| `POST` | `/api/scripts/{id}/stop` | `scripts.run` | all |
| `GET` | `/api/scripts/{id}/runs` | `scripts.read` | all |
| `GET` | `/api/recipes` | `recipes.read` | all |
| `POST` | `/api/recipes` | `recipes.write` | all |
| `POST` | `/api/recipes/capture` | `recipes.write` | all |
| `GET` | `/api/recipes/{id}` | `recipes.read` | all |
| `PUT` | `/api/recipes/{id}` | `recipes.write` | all |
| `DELETE` | `/api/recipes/{id}` | `recipes.write` | all |
| `GET` | `/api/recipes/{id}/versions` | `recipes.read` | all |
| `GET` | `/api/recipes/{id}/versions/{version}` | `recipes.read` | all |
| `POST` | `/api/recipes/{id}/validate` | `recipes.apply` | all |
| `POST` | `/api/recipes/{id}/apply` | `recipes.apply` | all |
| `GET` | `/api/recipes/{id}/applications` | `recipes.read` | all |
| `POST` | `/api/webhook/{path}` | none | all |
| `GET` | `/api/fleet` | `fleet.read` | gateway |
| `POST` | `/api/fleet` | `fleet.write` | gateway |
| `DELETE` | `/api/fleet/{id}` | `fleet.write` | gateway |
| `POST` | `/api/fleet/{id}/rebirth` | `fleet.rebirth` | gateway |
| `POST` | `/api/fleet/{id}/restart` | `fleet.restart` | gateway |
| `POST` | `/api/fleet/{id}/update` | `fleet.update` | gateway |
| `POST` | `/api/fleet/{id}/config` | `fleet.config` | gateway |
| `DELETE` | `/api/fleet/{id}/config` | `fleet.config` | gateway |
| `POST` | `/api/notify/test` | `notify.test` | all |
| `GET` | `/api/notify/escalation` | `notify.escalation` | all |
| `PUT` | `/api/notify/escalation` | `notify.escalation` | all |
| `POST` | `/api/notify/ack/{token}` | none | all |
| `GET` | `/api/backup` | `backup.read` | all |
| `POST` | `/api/backup` | `backup.run` | all |
| `GET` | `/api/reports` | `reports.read` | gateway |
| `POST` | `/api/reports` | `reports.write` | gateway |
| `GET` | `/api/reports/{id}` | `reports.read` | gateway |
| `PUT` | `/api/reports/{id}` | `reports.write` | gateway |
| `DELETE` | `/api/reports/{id}` | `reports.write` | gateway |
| `POST` | `/api/reports/{id}/run` | `reports.run` | gateway |
| `GET` | `/api/reports/{id}/runs` | `reports.read` | gateway |
| `GET` | `/api/reports/{id}/runs/{run}/download` | `reports.read` | gateway |
| `GET` | `/api/sites` | `sites.read` | gateway |
| `GET` | `/api/settings` | `settings.read` | all |
| `PUT` | `/api/settings` | `settings.write` | all |
| `GET` | `/api/historian/targets` | `settings.read` | all |
| `POST` | `/api/historian/targets` | `settings.write` | all |
| `PUT` | `/api/historian/targets/{id}` | `settings.write` | all |
| `DELETE` | `/api/historian/targets/{id}` | `settings.write` | all |
| `GET` | `/api/events` | `events.read` | all |
| `GET` | `/api/logbook` | `logbook.read` | all |
| `GET` | `/api/stream` | `status.read` | all |
| tous | `/mcp` | jeton MCP | all |
| tous | `/mcp/` | jeton MCP | all |
| `GET` | `/manifest.webmanifest` | none | all |
| `GET` | `/sw.js` | none | all |
| `GET` | `/next` | none | all |
| `GET` | `/next/` | none | all |
| tous | `/` | none | all |

## Santé

Pour le kubelet et les répartiteurs de charge. Aucun n'a besoin d'une session : une sonde n'a pas de compte, et aucune ne dit quoi que ce soit sur l'usine.

### `GET /healthz`

Liveness. `200` avec le texte `ok` tant que le processus sert du HTTP. Elle ne touche pas la base de données, volontairement : une panne de la base doit sortir le pod de la rotation, pas le faire redémarrer en boucle.

### `GET /readyz`

Readiness. Interroge la base de données par un ping avec un délai de 5 secondes.

```json
{"status":"ready"}
```

`503` quand elle ne peut pas l'atteindre, avec la raison dans `detail` (la forme vient du gestionnaire ; le texte de la raison est ce que le pilote de la base a dit) :

```json
{"error":"not ready","detail":"<why the database did not answer>"}
```

Une application qui n'atteint pas son historien ne doit pas recevoir de trafic.

## Authentification

Voir [Authentification et utilisateurs](/fr/iot/authentication/) pour les comptes, les rôles et le premier administrateur.

### `POST /api/auth/login`

Aucune session nécessaire, par construction.

| Champ | Type | <span class="sr-only">Détails</span> |
|---|---|---|
| `username` | string | Obligatoire. La casse et les espaces autour sont ignorés |
| `password` | string | Obligatoire |

```json
{"expiresAt":"2026-09-28T08:21:00.571794Z","permissions":["*"],"role":"admin","token":"<token>","username":"admin"}
```

Place aussi le même jeton dans le cookie `iiot_session`. `401` `"invalid username or password"` pour un mauvais nom, un mauvais mot de passe ou un compte désactivé sans distinction, et la réponse prend le même temps dans tous les cas : savoir lequel des trois c'était n'est pas une chose à dire à un inconnu. `429` pour un compte qui a eu trop de mots de passe ou de PIN faux d'affilée, quoi qu'on envoie, avec un en-tête `Retry-After` ; voir [Authentification et utilisateurs](/fr/iot/authentication/#le-verrouillage-après-des-mots-de-passe-et-des-pin-erronés).

### `POST /api/auth/kiosk`

Connexion sur un panneau partagé avec un PIN ou un badge, comme le décrit [Authentification et utilisateurs](/fr/iot/authentication/#panneaux-kiosque--pin-ou-badge-et-déconnexion-à-linactivité). Aucune session nécessaire, par construction.

| Champ | Type | <span class="sr-only">Détails</span> |
|---|---|---|
| `code` | string | Obligatoire. Le PIN, ou la valeur qu'un lecteur de badge en mode clavier a saisie. Les espaces autour sont ignorés |
| `username` | string | Facultatif. Avec lui, seul le PIN de ce compte est vérifié et un PIN faux compte pour le verrouillage de ce compte. Sans lui, le code est cherché parmi ceux de tous les comptes |

```json
{"expiresAt":"2026-10-21T08:21:00.571794Z","idleSec":300,"permissions":["status.read","tags.read"],"role":"operator","username":"olga"}
```

Place le cookie `iiot_session` et, contrairement à `POST /api/auth/login`, ne répond pas avec le jeton : une session de borne appartient au navigateur du panneau. `idleSec` est la durée pendant laquelle la session survit sans que personne y touche. `401` `"that PIN or badge isn't recognized"` pour un mauvais code, un code trop court et le code d'un compte désactivé sans distinction, et la réponse prend le même temps dans tous les cas. `429` quand le compte est verrouillé (voir [Le verrouillage](/fr/iot/authentication/#le-verrouillage-après-des-mots-de-passe-et-des-pin-erronés)), avec un en-tête `Retry-After`. Un code envoyé sans `username` qui ne correspond à personne n'est compté contre aucun compte ; le panneau qui l'a envoyé, par adresse client, attend une demi-seconde de plus avant que son prochain essai de ce genre soit vérifié, jusqu'à `ui.panelDelaySeconds`, et un bon code remet le compteur à zéro. Le panneau n'est jamais verrouillé. `400` quand le déploiement tourne sans connexion (`HOTLOOP_AUTH_INSECURE`), puisqu'il n'y a alors personne avec qui se connecter.

### `POST /api/auth/activity`

Quelqu'un a touché le panneau. Pas de corps. `{"status":"ok"}`. Sur une session de borne, c'est ce qui repousse sa limite d'inactivité ; toute autre requête qui n'est pas une lecture le fait aussi (une écriture, un acquittement). Un `GET`, le flux en direct et les chargements d'arrière-plan de la page elle-même ne le font pas : sinon ils garderaient la dernière personne connectée pour toujours. Une session ouverte avec un mot de passe n'a pas de limite d'inactivité et rien à repousser.

### `POST /api/auth/logout`

Met fin à la session avec laquelle la requête est arrivée (cookie ou bearer) et efface le cookie. Pas de corps. `{"status":"logged out"}`.

### `GET /api/auth/session`

Qui suis-je. Pour la séquence de démarrage de l'interface.

```json
{"authenticated":true,"permissions":["*"],"role":"admin","username":"admin"}
```

Une session ouverte sur un panneau de borne ajoute `"idleSec"`, sa limite d'inactivité en secondes, ce qui permet à la page de savoir qu'elle doit se déconnecter d'elle-même.

Avec l'authentification désactivée (`HOTLOOP_AUTH_INSECURE`), elle répond `{"authenticated":false,"insecure":true}` au lieu d'un 401, pour que l'interface puisse dire pourquoi il n'y a pas de connexion plutôt que de le deviner.

### `POST /api/auth/password`

Change votre propre mot de passe. Aucune autorisation : connaître votre mot de passe actuel est l'identifiant.

| Champ | Type | <span class="sr-only">Détails</span> |
|---|---|---|
| `currentPassword` | string | Obligatoire |
| `newPassword` | string | Obligatoire, au moins 8 caractères |

`{"status":"password changed; log in again"}`. **Toutes les sessions du compte prennent fin, celle-ci comprise**, et le cookie est effacé : un changement de mot de passe qui laisse fonctionner les anciennes sessions n'est un changement que de nom. `401` si le mot de passe actuel est faux, `400` si le nouveau est trop court.

## Utilisateurs

Tout est réservé aux administrateurs (`users.manage`). Les hachages de mot de passe n'apparaissent jamais dans une réponse ; le champ n'a pas de nom JSON.

### `GET /api/users`

```json
[{"username":"admin","role":"admin","disabled":false,"hasPin":false,"locked":false,"createdAt":"2026-09-27T20:19:28.036228Z","updatedAt":"2026-09-27T20:19:28.036228Z","lastLogin":"2026-09-27T20:21:00.575455Z"}]
```

`permissions` n'apparaît que sur un compte qui a une liste explicite. `hasPin` dit si le compte a un PIN ou un badge de borne ; la valeur et son hachage n'apparaissent jamais.

### `POST /api/users`

| Champ | Type | <span class="sr-only">Détails</span> |
|---|---|---|
| `username` | string | Obligatoire. Lettres minuscules, chiffres, point, tiret bas, trait d'union, commençant par une lettre ou un chiffre, de 2 à 64 caractères |
| `password` | string | Obligatoire, au moins 8 caractères |
| `role` | string | `admin`, `operator` ou `viewer`. Par défaut `viewer` |
| `permissions` | string[] | Facultatif. Remplace entièrement l'ensemble du rôle |

Répond avec le nouvel utilisateur. `400` pour un nom, un rôle ou un mot de passe incorrect, `409` si le nom est pris.

### `PUT /api/users/{username}`

| Champ | Type | <span class="sr-only">Détails</span> |
|---|---|---|
| `role` | string | Obligatoire sauf si `permissions` est défini |
| `permissions` | string[] | Facultatif. Vide signifie « utiliser le rôle » |
| `disabled` | bool | `true` désactive le compte et met fin à toutes ses sessions |

Répond avec l'utilisateur mis à jour. `400` pour un rôle inconnu, ou pour la désactivation du dernier administrateur activé : ce serait un verrouillage sans personne pour l'annuler. `404` pour un utilisateur inconnu.

### `DELETE /api/users/{username}`

`{"status":"deleted"}`. `400` pour votre propre compte ou le dernier administrateur activé, `404` pour un utilisateur inconnu.

### `POST /api/users/{username}/password`

Un administrateur définit le mot de passe de quelqu'un d'autre sans connaître l'ancien. `{"password": "..."}`, au moins 8 caractères. Répond `{"status":"password reset"}` et met fin à toutes les sessions de ce compte.

### `PUT /api/users/{username}/pin`

Un administrateur donne à un compte un PIN ou une valeur de badge pour se connecter sur un panneau de borne, ou remplace celui qu'il a. `{"code": "482913"}` : de 6 à 72 caractères, sans espace ni caractère de contrôle, des chiffres ou tout ce qu'un lecteur de badge saisit. Répond `{"status":"PIN set","username":"olga","hasPin":true}`. La valeur est hachée avec bcrypt, comme un mot de passe, et n'est jamais journalisée ni renvoyée. `400` pour un code trop court, trop long ou contenant un espace, et pour un code qu'un autre compte a déjà : un panneau trouve le compte par le code seul, donc un code ouvre un seul compte. `404` pour un utilisateur inconnu. Il ne touche ni au mot de passe ni à aucune session.

### `DELETE /api/users/{username}/lockout`

Laisse rentrer un compte verrouillé avant la fin de son verrouillage, et remet à zéro son compte de mots de passe et de PIN faux. `{"status":"unlocked","username":"olga","locked":false}`. `404` pour un utilisateur inconnu. Un compte verrouillé affiche `"locked":true` et `"lockedUntil"` dans `GET /api/users`.

### `DELETE /api/users/{username}/pin`

Retire le PIN ou le badge et déconnecte le compte de tous les panneaux de borne où il est connecté. Son mot de passe, et ses sessions sur son propre ordinateur, ne sont pas touchés. `{"status":"PIN cleared","username":"olga","hasPin":false}`. `404` pour un utilisateur inconnu.

### `GET /api/opcua/certificates`

Tous les certificats X.509 rattachés à un utilisateur pour se connecter au serveur OPC UA (voir [le serveur OPC UA](/fr/edge/opc-ua-server/#x509-user-certificates)), du plus récent au plus ancien : `{"serverAcceptsCertificates":false,"certificates":[...]}`. Chacun a `thumbprint` (SHA-256 de la forme DER, en hexadécimal minuscule), `username`, `label`, `subject`, `notBefore`, `notAfter`, `addedBy`, `addedAt`, `revokedAt` et `revokedBy` une fois révoqué, `lastUsed` une fois utilisé, et `state` : `active`, `revoked`, `expired` ou `not yet valid`. Seul un certificat actif permet de se connecter. `serverAcceptsCertificates` dit si le serveur OPC UA est actif et a `HOTLOOP_OPCUA_SERVER_ALLOW_X509` défini ; les certificats sont conservés dans les deux cas. Seul le certificat public est stocké ou envoyé.

### `GET /api/users/{username}/certificates`

La même liste pour un utilisateur. `404` pour un utilisateur inconnu.

### `POST /api/users/{username}/certificates`

Rattache un certificat à un utilisateur. `{"certificate": "<PEM text or base64 of the DER bytes>", "label": "Olga's laptop"}` ; le libellé est facultatif. Répond `201` avec le certificat tel qu'il est listé. Le certificat doit être RSA avec une clé d'au moins 2048 bits et ne pas avoir expiré. `400` dit lequel de ces points pose problème, et aussi pour ce qui n'est pas un certificat : une clé privée est refusée par son nom et n'est jamais conservée ni renvoyée, et une chaîne l'est aussi. `404` pour un utilisateur inconnu. `409` quand le certificat est déjà rattaché, à cet utilisateur ou à un autre : un certificat, c'est une personne. La modification est dans le journal de bord avec son auteur.

### `POST /api/users/{username}/certificates/{thumbprint}/revoke`

Révoque un certificat. Il ne peut plus servir à se connecter, une session ouverte avec lui prend fin dans les 10 secondes du cache d'autorisations, et les tentatives suivantes sont refusées et journalisées comme révoquées. Il reste listé comme `revoked` avec qui l'a fait et quand, et le révoquer de nouveau garde le premier enregistrement. `{thumbprint}` est le SHA-256 tel qu'il est listé ; les deux-points, les espaces et les majuscules sont acceptés. `404` quand le certificat n'est pas à cet utilisateur.

### `DELETE /api/users/{username}/certificates/{thumbprint}`

Oublie un certificat. Le rattacher de nouveau le fait refonctionner. `404` quand il n'est pas à cet utilisateur. Supprimer l'utilisateur supprime ses certificats.

## État et diagnostics

### `GET /api/status`

La barre d'en-tête : compteurs du runtime, le résumé des alarmes, le nom de l'usine et quel produit c'est. `product` vaut `iot`, `edge` ou `gateway`, comme `hotloop --product`. `features` dit lesquelles des fonctions qui diffèrent d'un produit à l'autre celui-ci a : `edge-publish`, `fleet`, `opcua-server`, `reports` et `sites` dans un Gateway, la première et la troisième dans Edge, aucune dans IoT. `version` est le build, et `imageDigest` est le digest de l'image dont il a démarré, ce qu'un numéro de version ne peut pas vous dire sur un boîtier qui suit `:stable`. Il n'est présent que lorsque le superviseur l'a indiqué (les unités Quadlet le font, avant chaque démarrage ; un binaire seul et une installation Helm ne le peuvent pas) et il est omis sinon.

```json
{
  "alarms": {"critical":0,"high":1,"medium":0,"low":0,"unacked":0,"total":1},
  "features": ["edge-publish","fleet","opcua-server","reports","sites"],
  "plantName": "Demo Plant",
  "product": "gateway",
  "runtime": {
    "startedAt": "2026-09-27T20:19:28.06635851Z", "uptime": "11m13s",
    "devices": 2, "connected": 2, "degraded": 0, "disconnected": 0,
    "tags": 5, "cachedTags": 5, "writesOk": 4, "writesRefused": 3,
    "bus": {"subscribers":4,"published":653,"dropped":0},
    "historian": {"queued":1085,"written":1085,"filtered":329,"dropped":0,"failed":0,"queueLen":0,"queueCap":50000},
    "writePolicy": {"allowWrites":true,"allowMcpWrites":true,"confirmWrites":true},
    "protocols": ["codesys","ethernet-ip","http","modbus","mqtt","mtconnect","opcua","s7comm","snmp","unifi"]
  },
  "siteId": "docs",
  "version": "4.23.2"
}
```

### `GET /api/protocols`

Tous les protocoles que connaît le Gateway, et si ce build en a le pilote.

```json
[{"id":"opcua","name":"OPC UA","description":"The universal one. ...","transport":"opc.tcp binary","defaultPort":4840,"writable":true,"browsable":true,"deviceTypes":["plc","cnc","robot","ipc","hmi","historian","gateway"],"library":"...","available":true}]
```

### `GET /api/diagnostics`

Ce que montre l'écran de diagnostic : le pool de la base de données, la file de l'historien et la taille de l'historique, le bus de tags, le moteur d'entités, l'enregistreur du journal de bord, le runtime, MCP (serveur et connexions sortantes) et les règles armées du moteur d'automatisations, les chemins de webhook et la file des changements d'état.

```json
{
  "automations": {"armed":[],"stateChangesDropped":0,"stateChangesPending":0,"webhooks":[]},
  "bus": {"subscribers":4,"published":654,"dropped":0},
  "database": {"type":"postgres","totalConns":3,"idleConns":3,"acquiredConns":0,"maxConns":10,"historyMode":"timescale","timescaleVersion":"2.30.1"},
  "entities": {"entities":8,"droppedBatches":0,"pendingChanges":0,"droppedChanges":0},
  "historian": {"queued":1087,"written":1085,"filtered":329,"dropped":0,"failed":0,"queueLen":0,"queueCap":50000},
  "historyStats": {"mode":"timescale","rows":996,"distinctTags":5,"oldest":"2026-09-27T20:21:38.609853Z","newest":"2026-09-27T20:30:39.507987Z","sizeBytes":73728},
  "logbook": {"recording":true,"retentionDays":90,"queued":0,"dropped":0,"written":212,"suppressed":36,"writeErrors":0},
  "mcp": {"outbound":[],"path":"/mcp","serverEnabled":true,"tokenSet":true},
  "runtime": {"...": "the same block as /api/status"}
}
```

Avec des serveurs MCP sortants configurés, `outbound` liste chacun d'eux :

```json
{"name":"plant-a","target":"http://localhost:8080/mcp","connected":true,"tools":["ack_alarm","call_service","...","write_tag"],"connectedSince":"2026-09-27T20:45:50Z"}
```

Tout identifiant dans le `target` ou le `lastError` d'un serveur sortant est effacé, parce qu'une URL ou une ligne de commande peut porter un jeton et que tous les rôles peuvent lire ceci. Le jeton MCP lui-même n'est jamais que `tokenSet`.

## Appareils

Un appareil est une connexion sur un protocole. Ce qui va dans `config` et `address` dépend du protocole : voir [Protocoles et pilotes](/fr/iot/protocols/).

### `GET /api/devices`

Tous les appareils, avec leur état de connexion en direct. Les identifiants sont `[redacted]`. `?q=` garde les appareils dont l'id, le nom, l'adresse ou le protocole contient le texte (sans tenir compte de la casse), `?limit=` (de 1 à 5000, toute autre valeur donne `400`) les premiers d'entre eux ; avec l'un ou l'autre, `X-Total-Count` dit combien ont correspondu.

```json
[{"id":"tank-farm","name":"Tank farm","protocol":"mqtt","address":"base-mqtt:1883","enabled":true,
  "site":"Demo Plant","area":"Utilities","equipmentId":4,
  "config":{"clientId":"docs-api-tankfarm","password":"[redacted]","topics":["docs-api-example/#"],"username":"tank","writeTopic":"docs-api-example/{tag}/set"},
  "createdAt":"2026-09-27T20:21:01.637319Z","updatedAt":"2026-09-27T20:21:01.637319Z",
  "state":"connected","lastPoll":"2026-09-27T20:21:39.412Z",
  "latencyMs":0.002,"tagCount":3,"pollCount":1}]
```

`state` vaut `connected`, `connecting`, `degraded` (actif, mais avec des interrogations qui échouent), `disconnected` ou `disabled`. `lastError`, `errorCount` et le reste apparaissent quand il y a quelque chose à dire.

### `POST /api/devices`

Crée l'appareil si l'`id` est nouveau, le remplace sinon. Il n'y a pas de `PUT`.

| Champ | Type | <span class="sr-only">Détails</span> |
|---|---|---|
| `id` | string | Obligatoire. De 1 à 64 lettres, chiffres, `.`, `_`, `-`, commençant par un caractère alphanumérique. Il se retrouve dans des URL, des topics MQTT et des arguments MCP |
| `name` | string | Obligatoire |
| `protocol` | string | Obligatoire. Un protocole dont ce build a le pilote (`GET /api/protocols`) |
| `address` | string | Obligatoire. Hôte et port, ou une URL `opc.tcp://` ou `http://` : le protocole décide |
| `enabled` | bool | Omis, il vaut `false` |
| `description` | string | |
| `pollIntervalMs`, `timeoutMs` | int | 0 prend la valeur par défaut du runtime. L'intervalle d'interrogation a pour plancher `HOTLOOP_MIN_POLL_INTERVAL` |
| `site`, `area`, `line` | string | Place l'appareil dans l'arbre des équipements par nom, en créant les nœuds au besoin |
| `equipmentId` | int | Le place plutôt sur un nœud de l'arbre ; `site`, `area` et `line` viennent alors du nœud. Voir [l'arbre des équipements et les libellés](/fr/iot/equipment/) |
| `config` | object | Les options propres au protocole. Les identifiants suivent les [règles d'écriture seule](#les-secrets-sont-en-écriture-seule) |

Les champs du runtime (`state`, `lastPoll`, `tagCount` et ainsi de suite) sont en lecture seule ; renvoyez-les et ils sont ignorés. Répond avec l'appareil enregistré, expurgé. `400` pour un protocole sans pilote, une validation échouée ou une règle d'identifiants ; le runtime se recharge aussitôt avec lui.

```json
{"error":"no driver for protocol \"profibus\"; this build speaks: ethernet-ip, http, modbus, mqtt, mtconnect, opcua, s7comm, snmp, unifi"}
```

### `GET /api/devices/{id}`

L'appareil, ses tags et ses libellés.

```json
{"device":{"id":"tank-farm","name":"Tank farm","...":"..."},"labels":["critical"],"tags":[{"id":3,"deviceId":"tank-farm","name":"level","...":"..."}]}
```

`tags` vaut `[]` pour un appareil qui n'en a pas. `404` pour un id inconnu.

### `DELETE /api/devices/{id}`

Supprime l'appareil, ses tags et leurs entités. **Son historique est conservé.** `{"deleted":"tank-farm"}`, ou `404`.

### `POST /api/devices/{id}/enabled`

`{"enabled": false}` arrête l'interrogation sans rien supprimer. Répond `{"enabled":false,"id":"tank-farm"}`. `404` pour un id inconnu.

### `POST /api/devices/{id}/browse`

Demande à l'appareil quels points il a. Ne demande que `devices.read`, parce qu'il lit. Pas de corps.

```json
{"supported":true,"tags":[{"name":"Plant_Boiler_Temperature","address":"nsu=http://plant/;s=Temperature","dataType":"float","description":"Temperature","writable":true}]}
```

Un protocole qui ne sait pas énumérer ses points (Modbus, S7comm, HTTP) répond `200` avec `{"supported":false,"reason":"..."}` : c'est un fait sur le protocole, pas une erreur. `503` si l'appareil n'est pas connecté. `writable` ici est ce que l'appareil dit du point, pas si le Gateway l'écrira.

### `POST /api/devices/{id}/import`

Transforme les résultats de l'exploration en tags configurés. Demande `tags.write`, parce qu'il crée des tags.

```json
{"tags":[{"name":"Temperature","address":"nsu=http://emberburn/;s=Temperature","dataType":"float","unit":"C"}]}
```

Chaque entrée accepte `name`, `address`, `dataType`, `unit`, `description`, `deviceClass` et `writable` (le résultat de l'exploration tel qu'il est venu). Répond `{"inserted":2,"updated":0}`. **Tout tag importé est en lecture seule**, quoi que dise l'appareil : un point découvert n'est pas un point dont quelqu'un a décidé qu'on peut le commander, et faire l'inverse par défaut en armerait quelques milliers d'un coup. Armez ceux que vous voulez avec `POST /api/tags`. `404` pour un appareil inconnu.

## UniFi : réseaux OT, clients, et où se trouve un appareil sur le réseau

Le registre propre de HotLoop sur les sites UniFi. Voir [UniFi Network](/fr/iot/unifi/). `{id}` sous `/api/unifi` est un appareil UniFi (un site sur une console) ; `{network}` est l'ID que la console elle-même donne à un réseau, tel que `GET .../networks` le fournit ; `{mac}` accepte toute graphie courante et est conservé en minuscules avec des deux-points.

**Aucun de ces appels ne demande quoi que ce soit à la console.** Ils lisent la dernière lecture que le pilote en a faite, donc un écran laissé ouvert ne coûte rien à la console. Cela veut aussi dire qu'ils répondent `503` tant que l'appareil n'a pas été lu une fois, et toujours dans un assistant `--mcp-stdio`, qui ne se connecte jamais à une console. Aucun d'eux n'écrit non plus sur une console.

Un changement qui crée ou supprime une alarme le dit dans `change` : `{"alarmsCreated":["unifi-unknown-3f2a9c01b7de"]}`. Ce sont des définitions d'alarme ordinaires, sous `/api/alarms`.

### `GET /api/devices/{id}/network`

Où se trouve sur le réseau un appareil HotLoop (un automate, un compteur). Lié :

```json
{"deviceId":"plc-07","link":{"deviceId":"plc-07","consoleId":"plant-net","mac":"02:48:4c:00:00:07","confirmedBy":"hana","confirmedAt":"2026-09-28T18:02:05Z"},
 "consoleName":"Plant network","client":{"mac":"02:48:4c:00:00:07","ip":"10.77.0.7","switchMac":"00:27:22:e2:1d:6f","switchName":"USW Lite 8 PoE","port":5,"portUp":false,"online":false,"lastSeen":"2026-09-28T18:01:40Z","lastSeenSec":25,"why":"its switch port 5 has no link","...":"..."},
 "readAt":"2026-09-28T18:02:05Z","summary":"on USW Lite 8 PoE port 5, link down; the console last saw it 25s ago; off the network: its switch port 5 has no link","proposals":[]}
```

Non lié, `link` vaut `null` et `proposals` liste les clients que toute console lue par HotLoop a à l'IP de l'appareil, du plus récent au plus ancien. Une proposition n'est que cela : les IP de la console sont en retard, donc rien n'est lié tant qu'un administrateur n'en a pas confirmé une.

### `PUT /api/devices/{id}/network`

`{"consoleId":"plant-net","mac":"02:48:4c:00:00:07"}` confirme quel client est l'appareil. À partir de là, la clé est l'adresse MAC et l'IP n'est plus jamais crue. Le client reçoit des tags (`c.<mac>.*` sur la console) et une alarme, « PLC-07 hors du réseau », de priorité 1 avec un délai d'activation de 120 s pour qu'un redémarrage n'alerte personne. Répond `{"link":{...},"change":{...}}`. `400` si `consoleId` n'est pas un appareil UniFi ou si la MAC n'en est pas une, `404` pour un appareil inconnu.

### `DELETE /api/devices/{id}/network`

Retire le lien, et l'alarme que HotLoop a créée pour lui sauf si le client est encore surveillé depuis une liste de connus. `404` s'il n'y avait pas de lien.

### `GET /api/unifi/{id}/networks`

Les réseaux du site tels que la console les a, avec le registre de HotLoop : `ot`, `known` (combien d'appareils sont sur sa liste), `clients` (dessus maintenant) et `unknown` (dessus maintenant et pas sur la liste). Un réseau dont HotLoop a un enregistrement et que la console n'a plus revient avec `"onConsole":false`.

```json
[{"networkId":"6abb23d25a95f2636a5df29c","name":"SCADA","purpose":"corporate","vlan":122,"subnet":"10.122.0.1/24","onConsole":true,"ot":true,"clients":2,"known":1,"unknown":[{"mac":"02:9b:b1:69:88:f2","ip":"10.122.0.66","switchName":"USW Lite 8 PoE","port":6,"...":"..."}],"changedBy":"hana"}]
```

### `PUT /api/unifi/{id}/networks/{network}`

`{"ot": true}` marque un réseau comme OT. Tout ce qui s'y trouve sans être sur sa liste de connus compte dans `n.<network>.unknown` et se nomme dans `.unknown_last`, et HotLoop crée l'alarme « Appareil inconnu sur le SCADA », de priorité 1. `{"ot": false}` le démarque et retire cette alarme ; la liste de connus est conservée. `400` pour un WAN ou un réseau que la console n'a pas.

### `POST /api/unifi/{id}/networks/{network}/accept-all`

Accepte maintenant tout ce qui est sur le réseau, tel quel : le seul clic après l'avoir marqué. Les appareils déjà sur la liste gardent leur nom et leur surveillance. Pas de corps. Répond `{"accepted":[{known device}...]}`, ceux qu'il a ajoutés.

### `GET /api/unifi/{id}/known`

Tous les appareils connus sur les réseaux du site : `[{"deviceId":"plant-net","networkId":"...","mac":"...","name":"PLC-07","watch":true,"acceptedBy":"hana","acceptedAt":"..."}]`.

### `PUT /api/unifi/{id}/networks/{network}/known/{mac}`

`{"name":"PLC-07","watch":true}` accepte un appareil sur le réseau, ou change son nom ou sa surveillance. `watch` lui donne des tags et l'alarme de déconnexion ; un appareil autorisé mais qui va et vient (un portable de maintenance) est accepté sans elle. `400` si le réseau n'a jamais été marqué OT.

### `DELETE /api/unifi/{id}/networks/{network}/known/{mac}`

Retire un appareil de la liste. S'il est sur le réseau, il redevient inconnu à la lecture suivante.

### `GET /api/unifi/{id}/clients`

Tous les clients que la console liste, plus tous ceux qui sont surveillés et qu'elle ne liste pas, chacun avec où il se trouve, s'il est en ligne, et `ot`, `known`, `watched`, `linkedTo` et un `summary` d'une ligne. `?q=` restreint à une MAC, une IP ou un nom.

### `GET /api/unifi/consoles`

Tous les appareils UniFi que HotLoop a, en marche ou non, pour le sélecteur de l'écran UniFi : `[{"id":"plant-net","name":"Plant network","address":"https://...","enabled":true,"running":true,"site":"default","version":"10.6.106","readAt":"...","devices":4,"online":4,"clients":12,"failover":false,"eventsLive":true}]`. Une console que ce processus n'a pas lue dit pourquoi dans `why`.

### `GET /api/unifi/{id}/overview`

La carte de vue d'ensemble : nombres d'appareils et de clients (un client compte quand HotLoop croit qu'il est sur le réseau, le test qu'utilisent les tags `n.<id>.clients`, et pas simplement quand la console le liste), clients par réseau, le `health` des sous-systèmes de la console, et pour chaque gateway sa bande WAN, `gateways[]` : une entrée `wans[]` par WAN avec `alive` (les contrôles de santé du gateway lui-même, jamais le `up` du bloc WAN), `known`, `active`, `backup`, latence et disponibilité. `failover` est du trafic sur un WAN qui n'est pas le premier, `down` est aucun WAN vivant, et `since` est la première lecture où HotLoop a vu du trafic sur le WAN où il est maintenant, soit le moment où HotLoop l'a remarqué, pas celui où le gateway a basculé. `events` est l'état du websocket d'événements (`live`, `error`, `reconnects`) et les dix événements les plus récents.

### `GET /api/unifi/{id}/topology`

La carte. `nodes[]` sont les appareils adoptés avec leur place sur la grille (`x`, `y`, `layer` : de gauche à droite depuis le gateway, disposés de la même façon pour la même lecture), `edges[]` les câbles entre eux d'après la propre `downlink_table` de la console, `wired[]` et `wifi[]` les clients accrochés à chaque port de switch et à chaque AP et SSID. Un appareil que rien ne liste comme branché sur quoi que ce soit est dessiné seul avec `noUplink` activé, sans être accroché au gateway par supposition. Un appareil d'une autre console UniFi que HotLoop lit et que cette console liste comme client est raccordé comme nœud avec `external` activé et une arête avec `stitched`. `feeds` est, par MAC d'appareil, les appareils HotLoop liés à un client en aval de lui, avec leur `equipmentId` pour l'arbre de l'usine, et `links` ces mêmes appareils par MAC de client.

### `GET /api/unifi/{id}/devices`

Tous les appareils adoptés avec leurs chiffres et leur `ports[]` pour la face avant : lien, vitesse, mode et consommation PoE, les clients appris sur le port, l'appareil qui y est branché, et `dropped` pour un port qui était actif à une lecture précédente et est tombé maintenant. Un appareil que la console a perdu ne rapporte ni chiffres ni liens de port, parce que ce qu'il a dit en dernier n'est plus d'actualité.

### `GET /api/unifi/{id}/wifi`

Les SSID du site avec `enabled`, le réseau sur lequel ils se trouvent et combien de clients sont sur chacun. Quand la console ne montre pas à ce compte ses réseaux sans fil, `error` dit pourquoi et `wlans` est vide.

### `GET /api/unifi/{id}/events`

Les événements les plus récents que la console a signalés depuis que HotLoop s'est connecté, du plus récent au plus ancien (`?limit=` jusqu'à 200, 50 par défaut), et l'état du websocket d'événements. Chaque événement a la `key` du contrôleur (`EVT_SW_Lost_Contact`), son propre `message`, `severity` (`warning` quand le contrôleur le signale comme quelque chose qui tourne mal) et l'appareil, le client et le port concernés. Ils sont aussi dans le journal de bord, classés sous le switch ou le point d'accès concerné (voir [UniFi Network](/fr/iot/unifi/#événements)).

### `POST /api/unifi/{id}/starter-alarms`

Crée les alarmes habituelles du site à partir de ce que la console a maintenant, comme des définitions d'alarme ordinaires sous `/api/alarms` : chaque appareil adopté hors ligne (priorité 2, délai d'activation de 60 s), chaque port de liaison montante tombé (priorité 1, 10 s), un gateway avec deux WAN ou plus qui fonctionne sur un WAN de secours (priorité 2, 30 s). Le corps est facultatif. `{"poeLimitW": 25}` ajoute une alarme de priorité 3 sur la consommation `poe_w` de chaque port PoE au-delà de ce nombre de watts, avec 30 s de délai ; la console ne dit pas quel est le budget d'un port, donc HotLoop n'en devine pas un. Une limite négative donne `400`.

```json
{"created":[{"id":"unifi-devoffline-9c1e2a77b3d0","name":"USW Lite 8 PoE offline","kind":"offline","tag":"d.002722e2e633.online","priority":2}],
 "kept":[]}
```

`kept` sont les alarmes que l'ensemble demande et qui étaient déjà là : les siennes d'un appui précédent, ou l'alarme de quelqu'un sur le même tag. On peut donc appuyer de nouveau sans risque après avoir adopté plus de matériel, et il n'ajoute que le nouveau matériel. Les alarmes de réseau OT et de sortie du réseau n'en font pas partie ; elles viennent avec le marquage d'un réseau OT et la surveillance d'un appareil. `503` tant que la console n'a pas été lue une fois.

## Découverte MQTT

Les appareils qui se sont annoncés en MQTT, et ce qu'une personne a décidé pour chacun. Voir [Découverte MQTT](/fr/iot/mqtt-discovery/). La découverte écoute sur le broker intégré quand il tourne, et sur chaque broker défini sous `/api/mqtt/brokers`. Sans aucun des deux, `sources` est vide. Dans un assistant `--mcp-stdio`, qui n'écoute jamais, `GET /api/discovery` répond `{"running":false,"sources":[],"devices":[]}` et toutes les autres routes `503`.

`{source}` est le broker sur lequel un appareil s'est annoncé (`embedded` pour celui de HotLoop, sinon l'id du broker) ; `{key}` est ce qui a relié ses annonces : son premier identifiant, sa MAC sous la forme `mac:aa:bb:cc:dd:ee:ff`, ou son id de nœud. Encodez-la comme une URL ; les identifiants portent des caractères qu'un chemin n'accepte pas.

**Aucun de ces appels n'arme quoi que ce soit.** Accepter un appareil rend ses points armables, un par un, par `POST /api/tags` comme tout autre point.

### `GET /api/discovery`

Toutes les sources, avec ce qu'elles ont vu et refusé, et tous les appareils découverts :

```json
{"running":true,"sources":[{"id":"embedded","name":"the embedded broker","prefix":"homeassistant","listening":true,"connected":true,
  "received":42,"dropped":0,"refused":0,"problems":[],"autoCreate":true,"anonymousAllowed":false,
  "external":false,"listenOnly":false,"enabled":true}],
 "devices":[{"source":"embedded","deviceKey":"plug-0001","deviceId":"kitchen-plug","status":"discovered",
  "device":{"identifiers":["plug-0001"],"name":"Kitchen Plug","manufacturer":"Acme","model":"P1","swVersion":"1.0.0"},
  "origin":{"name":"test-publisher","swVersion":"0.1"},"firstSeen":"2026-10-02T09:12:04Z","lastSeen":"2026-10-02T09:12:04Z",
  "components":[{"key":"plug-0001-relay","component":"switch","name":"Relay","configTopic":"homeassistant/switch/plug-0001/relay/config",
   "stateTopic":"plug/relay","commandTopic":"plug/relay/set","commandTopics":["plug/relay/set"],"tag":"relay",
   "unsupported":[],"unknownKeys":[],"flags":[]}]}]}
```

Une source dont `external` vaut true est un broker défini sous `/api/mqtt/brokers`, et `broker` dit où il se trouve. `autoCreate` à false est une source dont les appareils attendent dans la boîte de réception : listés `discovered` sans `deviceId`, rien n'est créé et rien ne lit tant que personne n'en accepte un. `listenOnly` est un broker sur lequel HotLoop ne publie jamais. `lastError` dit pourquoi une source n'est pas connectée, y compris un mot de passe qui ne peut pas être ouvert.

`status` vaut `discovered`, `accepted` ou `ignored`. Par composant, `unsupported` liste ce que HotLoop ne peut pas utiliser et pourquoi (« value template not supported: filter `regex_findall_index` is not supported at column 12 »), `unknownKeys` les clés de configuration que le format ne définit pas, `commandTopics` tous les topics où ses commandes peuvent aller (le topic de vitesse d'un ventilateur en plus du principal), et `flags` ce qu'une personne doit regarder avant d'accepter : un topic de commande hors des topics que le composant lit, dans le préfixe de découverte ou revendiqué par un autre appareil, et une configuration qui demande des commandes retenues. `withdrawnAt` est défini sur un composant que l'éditeur a retiré. `suggestedEquipmentId` est le nœud de l'arbre que nomme le `suggested_area` de l'appareil, quand exactement un nœud porte ce nom ; il ne fait que préremplir la boîte de dialogue d'acceptation. Sur le broker intégré, `announcedBy` et `announcedVia` sont le login du broker et l'id client qui ont publié sa dernière configuration, et `acceptedLogin` le login depuis lequel il a été accepté. Un appareil accepté dont l'annonce a changé, ou qu'un autre login a annoncé, a `review` :

```json
{"hash":"9a1c...","summary":["plug-0001-power: unit changed"],
 "changes":[{"key":"plug-0001-power","kind":"changed","fields":[{"field":"unit","running":"W","announced":"kW"}]}]}
```

### `GET /api/discovery/{source}/{key}`

Un appareil, de même forme. `404` pour un appareil que HotLoop n'a pas vu.

### `POST /api/discovery/{source}/{key}/accept`

Accepte un appareil. Un corps facultatif `{"equipmentId": 12}` le place dans l'arbre dans la même étape. N'arme rien. Répond avec l'appareil. `400` pour un appareil ignoré.

### `POST /api/discovery/{source}/{key}/ignore`

Écarte l'appareil : son appareil HotLoop, ses tags et ses entités disparaissent (son historique reste), et il reste ignoré quand il s'annonce de nouveau. Répond avec l'appareil. `DELETE /api/devices/{id}` sur un appareil découvert fait la même chose, parce qu'un appareil qui continue de s'annoncer reviendrait tout simplement.

### `POST /api/discovery/{source}/{key}/unignore`

Remet un appareil ignoré à l'état découvert, à partir de sa dernière annonce. `400` s'il n'est pas ignoré.

### `POST /api/discovery/{source}/{key}/review/apply`

Fait fonctionner un appareil accepté selon ce qu'il a annoncé. L'armement de chaque point reste ce qu'il était. `400` quand rien n'attend de revue.

### `POST /api/discovery/{source}/{key}/review/reject`

Garde la configuration acceptée en marche et cesse de proposer ce changement. Un changement différent plus tard est proposé de nouveau. `400` quand rien n'attend.

Une revue peut porter sur qui l'a annoncé : un changement avec `"kind":"publisher"` et la ligne de résumé « announced by login garage-node; accepted from kitchen-node ». L'appliquer fait de ce login celui depuis lequel l'appareil est accepté.

## Logins du broker

Les logins du broker intégré créés dans HotLoop, chacun avec les topics où il peut publier et auxquels il peut s'abonner. Voir [le broker MQTT intégré](/fr/iot/broker/). Un login est une clé du broker de toute l'usine, donc ceci relève de `users.manage`, celui d'un administrateur. Rien ici ne répond jamais avec un mot de passe ou son hachage. Chaque changement est journalisé et s'applique dès la prochaine publication du client ; personne n'a besoin de se reconnecter.

### `GET /api/broker/logins`

```json
{"running":true,"anonymous":false,"prefix":"homeassistant","envLogins":["plant"],
 "profiles":[{"name":"shelly","about":"a Shelly Gen2 or later; name the login after its MQTT topic prefix",
   "publish":["%u/#","shellies/announce"],"subscribe":["%u/#","shellies/command","%p/status"]}],
 "logins":[{"name":"kitchen-node","profile":"esphome","publish":["%u/#","%p/+/%u/+/config","esphome/discover/%u"],
   "subscribe":["%u/#","%p/status","esphome/discover"],"createdBy":"admin","createdAt":"2026-10-02T09:12:04Z",
   "updatedAt":"2026-10-02T09:12:04Z","resolvedPublish":["kitchen-node/#","homeassistant/+/kitchen-node/+/config",
   "esphome/discover/kitchen-node"],"resolvedSubscribe":["kitchen-node/#","homeassistant/status","esphome/discover"]}]}
```

`running` vaut false là où ce processus ne fait pas tourner le broker ; les logins sont quand même conservés, et le broker les lit à son démarrage. `envLogins` sont les noms de `HOTLOOP_BROKER_USERS`, qui peuvent tout faire. `%u` dans une règle est le nom du login lui-même et `%p` le préfixe de découverte ; `resolved*` sont les règles avec les deux renseignés.

### `POST /api/broker/logins`

```json
{"name":"kitchen-node","password":"a-long-random-password","profile":"esphome"}
```

`name` est de 1 à 64 lettres, chiffres, `-` et `_` (il remplace `%u` dans les topics). `password` fait au moins 12 caractères. `profile` remplit les règles ; `publish` et `subscribe`, s'ils sont donnés, les remplacent. L'un des deux est nécessaire. Une règle est un filtre de topic MQTT : `+` et `#` seulement comme niveaux entiers, `#` seulement en dernier, jamais un topic `$`. `201` avec le login ; `400` pour l'un des cas ci-dessus ou un nom que `HOTLOOP_BROKER_USERS` a déjà ; `409` pour un nom déjà pris.

### `PUT /api/broker/logins/{name}`

N'importe lesquels de `profile`, `publish`, `subscribe` et `password` ; ce qui n'est pas envoyé reste. `200` avec le login, `404` pour un login qui n'existe pas.

### `DELETE /api/broker/logins/{name}`

`200` `{"deleted":"kitchen-node"}`. Un client encore connecté avec lui ne peut plus rien faire à partir de là, et ne peut plus se reconnecter. `404` pour un login qui n'existe pas.

## Découverte réseau

Les appareils entendus sur le réseau de l'usine par mDNS, SSDP et DHCP, et ce qu'une personne a décidé pour chacun. Voir [Découverte réseau](/fr/iot/network-discovery/). Dans un assistant `--mcp-stdio`, qui n'écoute jamais, `GET /api/network-discovery` répond `{"running":false,"finds":[]}` et toutes les autres routes `503`.

`{key}` est la façon dont une trouvaille a été entendue et par qui : `mdns:` et son nom d'hôte mDNS, `ssdp:` et son uuid UPnP, `dhcp:` et sa MAC. Encodez-la comme une URL.

**Aucun de ces appels n'arme quoi que ce soit**, et rien ici n'est ajouté tant que quelqu'un ne l'a pas accepté.

### `GET /api/network-discovery`

Les écouteurs, la sonde, les interfaces où ils se trouvent, et toutes les trouvailles :

```json
{"running":true,
 "status":{"leading":true,"interfaces":["eth0 10.20.0.15/24"],
  "listeners":[{"name":"mdns","enabled":true,"listening":true,"heard":120,"dropped":0,"refused":0},
   {"name":"ssdp","enabled":true,"listening":true,"heard":14,"dropped":0,"refused":0},
   {"name":"dhcp","enabled":false,"listening":false,"heard":0,"dropped":0,"refused":0}],
  "probe":{"networks":[]}},
 "finds":[{"key":"mdns:line3-ua.local","via":"mdns","kind":"opcua","name":"line3-ua","status":"discovered",
  "firstSeen":"2026-10-11T14:02:11Z","lastSeen":"2026-10-11T14:07:40Z",
  "find":{"key":"mdns:line3-ua.local","via":"mdns","kind":"opcua","name":"line3-ua",
   "summary":"OPC UA server, capabilities DA","host":"line3-ua.local","addresses":["10.20.0.31"],
   "services":[{"type":"_opcua-tcp._tcp.local","instance":"line3-ua._opcua-tcp._tcp.local","port":50000,
    "txt":{"caps":"DA","path":"/"}}],
   "proposal":{"protocol":"opcua","address":"opc.tcp://10.20.0.31:50000/","how":"Accepting makes an OPC UA device..."},
   "heard":"2026-10-11T14:07:40Z"}}]}
```

`kind` vaut `esphome`, `shelly`, `opcua`, `mqtt-broker`, `web`, `mdns` (il a annoncé quelque chose pour quoi HotLoop n'a pas de mot), `upnp` ou `dhcp`. Une trouvaille dont la `proposal` a un `protocol` devient, une fois acceptée, un appareil de ce protocole à `address` ; une qui n'en a pas dit dans `how` ce qui la ferait entrer. `also` liste les autres trouvailles et appareils découverts par MQTT qui sont le même boîtier, par MAC ou adresse. `status` vaut `discovered`, `accepted` ou `ignored`, et `deviceId` l'appareil que l'acceptation a créé. L'`error` d'un écouteur dit pourquoi il n'écoute pas (port 67 pris ou non autorisé, aucune interface multicast) ; `refused` compte les nouvelles trouvailles écartées parce que le registre est plein.

### `GET /api/network-discovery/{key}`

Une trouvaille, de même forme. `404` pour une que HotLoop n'a pas entendue.

### `POST /api/network-discovery/{key}/accept`

Accepte une trouvaille. Un corps facultatif `{"equipmentId": 12}` place dans l'arbre l'appareil qu'elle crée. Une trouvaille pour laquelle HotLoop a un pilote devient un appareil à l'adresse proposée, activé, sans tags et sans rien d'armé ; toute autre est enregistrée comme connue et ne crée rien. Répond avec la trouvaille. `400` pour une déjà acceptée ou ignorée.

### `POST /api/network-discovery/{key}/ignore`

Masque une trouvaille sur laquelle personne n'a décidé, et la garde masquée quand elle est entendue de nouveau. `400` pour une déjà tranchée.

### `POST /api/network-discovery/{key}/unignore`

Remet une trouvaille ignorée pour qu'on décide à son sujet. `400` si elle n'est pas ignorée.

### `POST /api/network-discovery/probe`

Sonde maintenant : une requête mDNS et une recherche SSDP sur chaque interface dont le réseau figure dans `HOTLOOP_NETDISC_PROBE_NETWORKS`, et nulle part ailleurs. Répond `{"status": ...}`, avec ce qui n'est pas parti dans `status.probe.lastError`. `400` quand aucun réseau n'a la sonde activée : ce bouton ne peut pas l'activer, seul le déploiement le peut.

## Intégrations

Le flux de configuration d'un type d'appareil vers lequel une personne oriente HotLoop : demander ce dont l'intégration a besoin, regarder le vrai appareil avec les réponses, et créer l'appareil et ses tags d'après ce qui a été trouvé. Voir [Intégrations](/fr/iot/integrations/).

**Rien ici n'arme quoi que ce soit.** Tout tag créé par une configuration est en lecture seule. L'armer se fait par `POST /api/tags` comme tout autre point.

### `GET /api/integrations`

Toutes les intégrations de ce build, avec les questions qu'elles posent :

```json
[{"id":"opcua","name":"OPC UA server","description":"A PLC, CNC, gateway or SCADA server ...",
  "protocol":"opcua","addressLabel":"Endpoint","addressPlaceholder":"opc.tcp://192.168.1.20:4840","writable":true,
  "fields":[{"key":"securityMode","label":"Security","kind":"choice","required":false,"default":"None",
             "choices":[{"value":"None","label":"None"},{"value":"Sign","label":"Sign"}]},
            {"key":"password","label":"Password","kind":"secret","required":false}]}]
```

`kind` vaut `text`, `number`, `bool`, `choice` ou `secret`. Un champ avec `showWhen` (`{"version":["3"]}`) n'est demandé que lorsqu'une autre réponse a l'une de ces valeurs, et la réponse à une question qui ne s'affiche pas est ignorée.

### `POST /api/integrations/{id}/probe`

Vérifie les réponses et va regarder le vrai appareil. N'enregistre rien.

```json
{"address":"opc.tcp://192.168.1.20:4840","options":{"securityMode":"None"}}
```

Répond `{"integration":"opcua","address":"opc.tcp://192.168.1.20:4840","found":{...}}`. `address` est l'adresse telle que l'intégration l'a résolue. `found` a `name` (comment l'appareil se nomme lui-même), `identity` (ce qu'il dit être), `notes` (ce qu'il faut savoir avant d'accepter) et `points`, chacun de la forme d'un tag `{name, address, dataType, unit, description, writable, deviceClass}` plus `group`, `sample` (ce qu'il a lu quand il a été trouvé) et `suggested`.

`400` pour des réponses qui ne correspondent pas aux questions, tous les problèmes à la fois ; une réponse à une question que l'intégration ne pose pas est aussi un `400`, pas ignorée. `502` quand l'appareil n'a pas répondu ou a répondu autre chose que son protocole, avec ce qui s'est mal passé. `404` pour une intégration que ce build n'a pas. Un secret n'apparaît jamais dans une réponse ni dans une erreur.

### `POST /api/integrations/{id}/setup`

Regarde de nouveau l'appareil, puis le crée avec ses tags. Le corps est celui de la sonde, plus :

| Champ | Signification |
|---|---|
| `deviceId` | L'id du nouvel appareil. Vide, il est tiré du nom. `400` si un appareil l'a déjà |
| `name` | Le nom de l'appareil. Vide, il prend la façon dont l'appareil se nomme lui-même |
| `points` | Des noms de `found.points` à configurer. Vide, il prend ceux marqués `suggested`. Un nom que l'appareil n'a pas est un `400` |
| `site`, `area`, `line` | Où il va dans l'arbre des équipements, comme sur `POST /api/devices` |

Les points sont vérifiés par rapport à l'appareil tel qu'il est maintenant, pas par rapport à ce qu'un client dit avoir trouvé il y a une minute. Répond `{"device":{...},"tags":3,"entities":["sensor.plc_sim_..."],"notes":[]}`. L'appareil est activé et interrogé, chaque tag est en lecture seule, et chaque tag a son entité de lecture. Une configuration qui échoue en route ne laisse aucun appareil derrière elle.

## Brokers MQTT

Des brokers autres que celui de HotLoop que la découverte écoute : le Mosquitto d'une usine, le broker qu'une boîte Zigbee2MQTT a apporté. Voir [Découverte MQTT](/fr/iot/mqtt-discovery/#other-brokers). Leurs mots de passe sont scellés avec la clé d'identifiants des appareils (`HOTLOOP_SECRET_KEY_FILE`) et jamais renvoyés ; `passwordSet` dit si l'un est stocké, et `passwordProblem` pourquoi un mot de passe stocké ne peut pas être ouvert. Chaque changement est journalisé et prend effet aussitôt : l'écouteur et les appareils de ce broker se reconnectent.

### `GET /api/mqtt/brokers`

```json
{"secretKey":true,
 "brokers":[{"id":"plant-uns","name":"Plant UNS","broker":"tcp://10.20.0.5:1883","username":"hotloop","useTls":false,
   "insecureSkipVerify":false,"prefix":"homeassistant","listenOnly":true,"autoCreate":false,"tasmota":true,"shelly":true,"enabled":true,
   "createdBy":"admin","passwordSet":true,"createdAt":"2026-10-03T09:12:04Z","updatedAt":"2026-10-03T09:12:04Z"}]}
```

`secretKey` dit si ce HotLoop a une clé pour sceller un mot de passe.

### `POST /api/mqtt/brokers`

```json
{"id":"plant-uns","name":"Plant UNS","broker":"tcp://10.20.0.5:1883","username":"hotloop",
 "password":"...","listenOnly":true}
```

`id` est de 1 à 63 lettres minuscules, chiffres et `-`, pas `embedded` : il nomme le broker dans chaque appareil qui en vient, et ne peut pas changer. `broker` est `host:port` ou une URL `tcp://`, `ssl://`, `tls://`, `mqtt://` ou `mqtts://`, sans login dedans. `prefix` vaut `homeassistant` par défaut ; `autoCreate` false (les appareils attendent dans la boîte de réception) ; `listenOnly` false ; `tasmota` (entendre aussi la découverte propre à Tasmota, `tasmota/discovery/#`) true ; `shelly` (apprendre les appareils Shelly Gen2 et suivants d'après les topics `<prefix>/status/<component>` qu'ils publient) true ; `enabled` true. Un mot de passe demande un nom d'utilisateur et une clé : sans `HOTLOOP_SECRET_KEY_FILE`, c'est un `400`, jamais stocké en clair. `201` avec le broker ; `409` pour un id déjà pris.

### `PUT /api/mqtt/brokers/{id}`

N'importe lesquels des champs ci-dessus sauf `id` ; ce qui n'est pas envoyé reste. `"password":""` efface le mot de passe. `200` avec le broker.

### `DELETE /api/mqtt/brokers/{id}`

Supprime le broker et ce qu'il a annoncé sans que personne l'accepte : la boîte de réception, et tout appareil qu'il a créé de lui-même. `409` qui les nomme tant que des appareils acceptés depuis lui existent : ignorez-les ou supprimez-les d'abord, ou éteignez le broker avec `"enabled":false`. `200` `{"deleted":"plant-uns"}`.

## Tags

### `GET /api/tags`

| Requête | <span class="sr-only">Détails</span> |
|---|---|
| `device` | Seulement les tags de cet appareil. Sans `limit`, il répond avec tous |
| `q` | Recherche : une sous-chaîne, sans tenir compte de la casse, de l'id de l'appareil, du nom du tag ou de la description. Fonctionne avec `device` |
| `limit` | Un nombre entier de 1 à 5000. 500 par défaut sans `device`. Toute autre valeur, 5001 comprise, donne `400` : elle est refusée, jamais traitée par une réponse plus courte (jusqu'à la 4.19.5, toute limite supérieure à 1000 était discrètement ramenée à 200) |
| `writable` | `true` pour seulement les tags marqués inscriptibles (ce que proposent les sélecteurs d'écriture) |
| `offset` | Où la page commence, zéro ou plus. Les tags sont triés par appareil, puis par nom |

L'en-tête `X-Total-Count` de la réponse dit combien de tags correspondent en tout, donc un client pagine avec `offset` jusqu'à les avoir tous et sait qu'il les a. Une réponse vide est `[]`.

```json
[{"id":5,"deviceId":"tank-farm","name":"level_sp","address":"mqtt:docs-api-example/level_sp","dataType":"float","unit":"%","enabled":true,"writable":true,"maxValue":95,"hasRange":true,"scale":1,"createdAt":"2026-09-27T20:21:39.405164Z","updatedAt":"2026-09-27T20:21:39.405164Z"}]
```

### `POST /api/tags`

Crée le tag si `deviceId` et `name` sont nouveaux, le remplace sinon.

| Champ | Type | <span class="sr-only">Détails</span> |
|---|---|---|
| `deviceId` | string | Obligatoire. L'appareil doit exister (`404` sinon) |
| `name` | string | Obligatoire. Pas de caractères de contrôle |
| `address` | string | Obligatoire. L'adresse propre au protocole |
| `dataType` | string | `bool`, `int`, `float` ou `string` (et les alias habituels : `int16`, `word`, `coil`...). Décide comment une écriture est encodée |
| `unit`, `description` | string | |
| `enabled` | bool | Omis, il vaut `false` |
| `writable` | bool | **Arme le tag pour l'écriture, par tous les chemins : interface, automatisations, entités, MCP.** Omis, il vaut `false` |
| `hasRange`, `minValue`, `maxValue` | bool, number, number | Avec `hasRange`, une écriture hors de la plage est refusée (jamais écrêtée) |
| `scale`, `offset` | number | ingénierie = brut x échelle + décalage. Une échelle de 0 vaut 1 |
| `noData` | list | Valeurs brutes qui signifient « pas de mesure », chacune `{"raw", "reason"}`. `raw` est une chaîne (`"0x8005"`, `"-32763"`) ou un nombre nu, et revient sous forme de chaîne. Une lecture dont la valeur brute figure dans la liste est de mauvaise qualité avec ce `reason`, vérifié avant `scale` et `offset`. Jusqu'à 32 codes. Un code qui n'est pas un nombre entier, qui est listé deux fois ou qui ne peut pas être du type du point donne `400`. Voir [Protocoles et pilotes](/fr/iot/protocols/#no-data-values) pour ce qu'il faut écrire pour chaque type et l'exemple du Yokogawa DX |
| `deadband`, `deadbandPercent` | number | Les variations plus petites que cela ne sont pas écrites dans l'historique |
| `deviceClass` | string | La classe avec laquelle commencent les entités du tag (`power`, `connectivity`, `temperature`...), quand elle a un sens pour leur domaine. Prise à la création du tag et ignorée au remplacement : ensuite l'entité possède sa classe, donc changez-la là |

Répond avec le tag enregistré. En enregistrer un avec `writable: true` est journalisé comme tel : armer un tag est une décision de sécurité et reçoit un nom en face. Les entités du tag sont créées ou mises à jour avant la réponse, donc un client peut les demander tout de suite.

Un tag d'un appareil découvert que personne n'a accepté ne peut pas être armé : `400`, « accept the device first ». Voir [Découverte MQTT](/fr/iot/mqtt-discovery/#commands).

### `DELETE /api/tags/{device}/{name}`

`{"deleted":"tank-farm/level"}`, ou `404`. L'historique reste. Les entités du tag deviennent orphelines (voir [Entités](/fr/iot/entities/#deleted-tags-orphans-and-re-adoption)).

## Valeurs, le tableau et écritures

### `GET /api/values`

La dernière lecture de chaque tag, depuis la mémoire. `?device=` la restreint à un appareil.

```json
[{"deviceId":"extruder-1","protocol":"opcua","tagName":"Temperature","tagValue":20.645294745260895,"unit":"C","quality":"good","timestamp":"2026-09-27T20:21:58.255722Z"}]
```

Cette forme est le `TagValue` du tableau de bord EmberNet et c'est un contrat. `quality` vaut `good`, `uncertain` ou `bad` ; **une mauvaise lecture veut dire que la valeur n'est pas connue, pas qu'elle vaut zéro**. Une lecture de chaîne porte `stringVal`, et son `tagValue` ne veut rien dire.

Une lecture qui n'est pas bonne porte `reason` quand le pilote sait pourquoi, pour qu'un écran puisse dire plus que « mauvaise » :

```json
{"deviceId":"meter-01","protocol":"http","tagName":"power","tagValue":0,"quality":"bad","timestamp":"2026-09-30T09:12:04.51Z","reason":"no field at ENERGY.Power"}
```

Une bonne lecture ne l'a jamais, donc le contrat ci-dessus est octet pour octet ce qu'il était. L'historien ne le garde pas : `/api/history` a la qualité, pas la raison.

### `GET /api/sparkline`

Les dernières lectures d'un tag gardées en mémoire (`HOTLOOP_RING_SIZE`, 30 par défaut), pour les petits graphiques. `?tag=device/tag`, obligatoire.

```json
{"tag":"extruder-1/Temperature","timestamps":[1790540498609,1790540499246,1790540500246],"values":[0,20.06524581530632,19.933308705395785]}
```

`timestamps` sont des millisecondes Unix. Les deux sont `[]` pour un tag sans lectures. `400` pour une clé mal formée.

### `GET /api/board`

Quels tags sont épinglés au tableau, et en combien de colonnes. Il est stocké dans la base de données, pas dans le navigateur, parce qu'un tableau appartient à l'usine : le PC de panneau à l'atelier et le portable au bureau montrent le même.

```json
{"columns":2,"tags":["extruder-1/Temperature","tank-farm/level"],"rev":"9f2c41b07a6d3e58"}
```

`rev` nomme le tableau tel qu'il est stocké. Renvoyez-le avec un enregistrement et l'enregistrement est refusé si le tableau a changé depuis (plus bas).

### `PUT /api/board`

La même forme. `columns` hors de 1 à 4 devient 3 ; les doublons sont écartés. `rev` est facultatif : avec le `rev` du tableau que vous avez lu, un enregistrement sur un tableau qui a changé depuis est un `409` et ne change rien, donc une page qui n'a jamais lu le tableau, ou en a lu un ancien, ne peut pas remplacer celui de l'usine par sa copie. Omis, l'enregistrement n'est pas vérifié, ce qui convient à un client qui définit tout le tableau à chaque fois. L'interface web lit le tableau au démarrage et envoie le `rev` à chaque enregistrement. Chaque tag doit exister (`404` qui nomme celui qui n'existe pas) : une entrée périmée est une jauge qui ne bouge jamais. Répond avec le tableau tel qu'il est stocké. Les opérateurs ont `board.write` : organiser le tableau, c'est conduire l'usine, pas la configurer.

### `POST /api/write`

Écrit une valeur sur un tag, par la porte d'écriture.

| Champ | Type | <span class="sr-only">Détails</span> |
|---|---|---|
| `tag` | string | Obligatoire. `device/tag` |
| `value` | bool, number or string | Obligatoire. `true` est un bool, `42` un entier, `42.5` un flottant, `"42"` une chaîne : le type JSON est le type écrit, parce qu'une bobine, un mot et un réel sont trois choses différentes sur le fil |
| `reason` | string | Facultatif. Journalisé avec l'écriture |

```json
{"tag":"tank-farm/level_sp","written":"72.5"}
```

**Une valeur est dans les unités du tag, comme une lecture.** Sur un tag avec une échelle ou un décalage, ce que vous envoyez est ce que le tag relirait, et HotLoop envoie à l'appareil le compte qui le donne : 55.5 sur un registre à l'échelle 0.1 met 555 dans le registre. (Jusqu'à la 4.18, le nombre allait à l'appareil tel quel, donc 55.5 devenait 55 et se relisait 5.5.) Le contrôle de plage et la ligne d'audit utilisent votre nombre, dans les unités du tag. Un compte qui ne tient pas ensuite dans le registre, comme 7000 sur un `uint16` à l'échelle 0.1, est refusé avec le compte et le registre nommés, et rien n'est envoyé. Une fraction de compte est coupée, comme l'a toujours fait un registre à compte entier : 12.34 sur un registre à l'échelle du dixième contient 12.3.

La porte vérifie, dans l'ordre, que les écritures sont activées (`HOTLOOP_ALLOW_WRITES`), que le tag est armé et que la valeur est dans la plage. Chaque tentative, refusée ou non, est dans `GET /api/writes`.

| Statut | Quand |
|---|---|
| 400 | Pas de valeur, une valeur `null`, une clé mal formée |
| 403 | Les écritures sont désactivées, ou `"tank-farm/level: this tag is not marked writable"` |
| 404 | Pas de tel tag |
| 422 | `"value is outside the tag's configured range: 120 is outside 0..95"` |
| 503 | L'appareil n'est pas connecté |

## Historique et audit

### `GET /api/history`

| Requête | <span class="sr-only">Détails</span> |
|---|---|
| `tag` | Obligatoire, répétable, jusqu'à 50 : `?tag=a/x&tag=b/y` |
| `minutes` | Jusqu'où remonter depuis maintenant. 60 par défaut |
| `bucket` | Taille de l'intervalle en secondes. Par défaut : choisie pour que la fenêtre fasse environ 400 intervalles, sur une échelle de 1 s à 1 jour |
| `raw` | `true` pour les lectures elles-mêmes au lieu des intervalles |
| `limit` | 5000 par défaut, 100000 au plus |
| `carry` | `true` pour dire aussi ce que chaque tag tenait quand la fenêtre a commencé (intervalles seulement) |

Par intervalles, du plus ancien au plus récent par tag. `badCount` est le nombre de lectures de l'intervalle qui n'étaient pas de bonne qualité ; elles sont comptées, pas intégrées à la moyenne. `from` et `to` sont la fenêtre à laquelle la réponse correspond, écartées d'exactement `minutes` et se terminant quand la question a été posée :

```json
{"buckets":[{"deviceId":"extruder-1","tagName":"Temperature","bucket":"2026-09-27T20:21:00Z","avg":18.986210570239944,"min":0,"max":20.83008050535897,"first":0,"last":20.83008050535897,"count":22,"badCount":1}],"from":"2026-09-27T19:22:00Z","raw":false,"to":"2026-09-27T20:22:00Z"}
```

L'historien garde une lecture quand une valeur dépasse sa bande morte, pas à chaque interrogation, donc un tag qui est resté immobile n'a rien à dessiner dans la fenêtre. Avec `carry=true`, la réponse a aussi `"carry":[{"deviceId":"extruder-1","tagName":"Temperature","ts":"2026-09-27T16:40:12Z","value":21.4}]` : la dernière lecture avant `from`, pour chaque tag dont la dernière lecture antérieure était bonne et contenait un nombre. Un tag dont la dernière lecture était mauvaise ou incertaine, qui n'a pas de lecture antérieure, ou qui est du texte, n'a pas d'entrée, parce que ce qu'il tenait n'est pas connu et que nous ne donnerons pas une supposition à un graphique. La carte de tendance dessine à partir de cela.

Brut, du plus récent au plus ancien :

```json
{"raw":true,"readings":[{"deviceId":"extruder-1","protocol":"","tagName":"Temperature","tagValue":21.021559879601448,"quality":"good","timestamp":"2026-09-27T20:22:00.267463Z"}]}
```

`400` sans `tag`, avec plus de 50, ou avec une clé mal formée.

### `GET /api/writes`

L'audit des écritures, du plus récent au plus ancien. Chaque tentative est ici, y compris les refusées, parce que « nous ne savons pas si cette commande est partie » est la pire réponse qu'une usine puisse recevoir.

| Requête | <span class="sr-only">Détails</span> |
|---|---|
| `tag` | Un tag, `device/tag` |
| `device` | Tous les tags d'un appareil (ignoré si `tag` est défini) |
| `entity` | Toute écriture qu'un appel de service sur cette entité a faite ou vu refuser, au lieu de ce qui précède |
| `call` | Toute écriture d'un appel, au lieu de tout ce qui précède : l'appui et le relâchement d'un bouton, ou chaque cible de l'application d'une recette, qui partagent leur `call_id` |
| `limit` | 100 par défaut, 5000 au plus |

```json
[{"id":2,"at":"2026-09-27T20:22:01.04226Z","deviceId":"tank-farm","tagName":"level_sp","value":"120","prior":"0 %","actor":"admin","source":"ui","succeeded":false,"error":"refused: value is outside the tag's configured range: 120 is outside 0..95"},
 {"id":4,"at":"2026-09-27T20:23:03.276962Z","deviceId":"tank-farm","tagName":"pump","value":"true","prior":"0","actor":"admin","source":"ui","succeeded":true,"latencyMs":0.317,"entityId":"switch.tank_farm_pump","service":"switch.turn_on","callId":"5c9f8545a93b5443"}]
```

`source` vaut `ui`, `api`, `automation` ou `mcp`. `entityId`, `service` et `callId` ne figurent que sur les écritures qu'un appel de service a faites.

## Entités et états

Chaque tag reçoit des entités sans que personne le demande ; les composites (moteurs, vannes, boucles, compteurs, sélecteurs, boutons, stations météo) sont construits à partir de tags par un administrateur. En snake_case, comme tout endpoint d'entités. Le modèle complet est dans [Entités](/fr/iot/entities/).

### `GET /api/entities`

Toutes les entités, orphelines comprises.

| Requête | <span class="sr-only">Détails</span> |
|---|---|
| `domain` | `sensor`, `switch`, `motor`... |
| `device` | Les entités d'un appareil |
| `orphaned` | `true` pour seulement les orphelines, `false` pour aucune |
| `q`, `limit` | Recherche : une sous-chaîne, sans tenir compte de la casse, de l'id de l'entité, du nom ou de l'id de l'appareil, et au plus `limit` d'entre elles (de 1 à 5000, toute autre valeur donne `400`, jamais coupé en silence) triées par id d'entité. `X-Total-Count` dit combien ont correspondu. Omis, la liste est complète |

```json
[{"id":5,"entity_id":"switch.tank_farm_pump","unique_id":"tag-control:tank-farm/pump","domain":"switch","platform":"tag","name":"pump","device_id":"tank-farm","options":{},"disabled":false,"hidden":false,"created_at":"2026-09-27T20:21:39.153197Z","updated_at":"2026-09-27T20:21:39.153197Z","bindings":[{"role":"command","device_id":"tank-farm","tag_name":"pump"},{"role":"state","device_id":"tank-farm","tag_name":"pump"}],"equipment_id":null,"area_id":4,"labels":[]}]
```

### `GET /api/entities/composites`

Ce que `POST /api/entities` peut créer : chaque domaine, les rôles auxquels ses tags sont liés et les services qu'il accepte. Un rôle indique son `kind` de tag, s'il est `required`, si un service l'écrit (`command`) et si l'état est lu depuis lui (`feedback`). Une station météo n'accepte aucun service.

```json
{"domains":[{"domain":"weather","roles":[{"role":"temperature","kind":"number","required":true,"command":false,"feedback":true},{"role":"humidity","kind":"number","required":false,"command":false,"feedback":true}],"services":[]}]}
```

### `GET /api/entities/{entity_id}`

`{"entity": {...}, "state": {...}}`. `state` vaut `null` pour une entité désactivée. `404` pour une inconnue.

### `GET /api/entities/{entity_id}/image`

La dernière image d'une caméra ou d'une image, sous forme des octets que HotLoop détient : `Content-Type` est ce qu'ils sont (`image/jpeg`, `image/png`, `image/gif` ou `image/webp`), avec `X-Content-Type-Options: nosniff`, une `Content-Security-Policy` d'isolation et un `ETag` (`If-None-Match` reçoit un `304`). `404` pour une entité qui n'en est pas une, ou avant qu'une image soit arrivée. L'attribut `entity_picture` de l'état est ce chemin avec le hachage de l'image.

### `PUT /api/entities/{entity_id}`

Ne change que les champs envoyés. Réservé aux administrateurs : l'entity_id est le nom par lequel toute automatisation, tout tableau de bord et tout agent la désigne, et le changer relève de la configuration.

| Champ | Type | <span class="sr-only">Détails</span> |
|---|---|---|
| `entity_id` | string | Un renommage. Le `unique_id` ne bouge pas |
| `name`, `icon`, `device_class`, `state_class`, `unit_of_measurement`, `entity_category` | string | |
| `options` | object | Par domaine ; voir [Entités](/fr/iot/entities/#api) |
| `disabled`, `hidden` | bool | Une entité désactivée n'a pas d'état et ne peut pas être commandée |
| `equipment_id` | int or null | La place dans l'arbre ; `null` la fait suivre de nouveau son appareil |
| `labels` | string[] | L'ensemble complet |

`unique_id`, `domain`, `platform`, l'appareil et les liaisons ne peuvent pas être changés ici, et les envoyer donne un 400.

```json
{"entity":{"id":3,"entity_id":"sensor.tank_1_level","name":"Tank 1 level","device_class":"moisture","icon":"mdi:water-percent","...":"..."},"warnings":[]}
```

`warnings` dit quand quelque chose est légal mais étrange (une unité que la classe d'appareil n'a pas d'habitude). `400` pour un corps vide (`"the update names no field to change"`) ou une valeur incorrecte, `404` pour une entité inconnue, `409` pour un entity_id déjà pris.

### `POST /api/entities`

Crée un composite. Le corps nomme le domaine et lie des tags à ses rôles :

```json
{"name":"Transfer pump","domain":"motor","bindings":[{"role":"run_command","device_id":"tank-farm","tag_name":"pump"},{"role":"running","device_id":"tank-farm","tag_name":"pump"}]}
```

Aussi `entity_id` (sinon généré à partir du nom), `device_class`, `unit_of_measurement`, `icon`, `entity_category` et `options`. Les rôles et options que prend chaque domaine sont dans [Entités](/fr/iot/entities/#composite-equipment). Répond `201` `{"entity": {...}, "warnings": [...]}`. `400` pour un domaine qui n'est pas créé ici (un `sensor` vient de son tag, une `alarm` de sa définition), un rôle manquant ou un tag qui ne peut pas le remplir, `409` pour un entity_id déjà pris.

### `DELETE /api/entities/{entity_id}`

Supprime un composite, ou une orpheline dont le tag ou la définition d'alarme a disparu. `{"deleted":"motor.transfer_pump","entity":{...}}`. Toute autre répond `409` en disant comment elle disparaît vraiment :

```json
{"error":"this entity cannot be deleted: sensor.tank_1_level is kept in step with its tag; delete the tag, and then this orphan, or hide or disable it: already exists"}
```

### `GET /api/states`

L'état de chaque entité activée, trié par entity_id. `?domain=` filtre.

```json
[{"entity_id":"number.tank_farm_level_sp","state":"unknown","attributes":{"armed":true,"friendly_name":"level_sp","max":95,"min":0,"source":["tank-farm/level_sp"],"unit_of_measurement":"%"},"quality":"bad","last_changed":"2026-09-27T20:21:39.417193755Z","last_updated":"2026-09-27T20:21:39.417193755Z","last_reported":"2026-09-27T20:22:04.423849496Z"}]
```

`state` est toujours une chaîne, même pour un nombre ; `unknown` et `unavailable` veulent dire ce qu'ils disent. `last_reported` est l'horodatage de l'appareil pour la lecture qui est derrière.

### `GET /api/states/{entity_id}`

Un état. `404` pour une entité inconnue, et un `404` différent pour une entité désactivée, qui dit comment l'activer : une entité désactivée n'est pas absente, et la déclarer absente envoie quelqu'un chercher une faute de frappe.

## Énergie

Ce que l'usine consomme et ce que cela coûte : kilowattheures, gaz, eau, air comprimé, et le coût d'une unité produite. Un compteur est un tag lu comme une quantité consommée. Le modèle complet, les tarifs et ce que fait l'écran sont dans [Énergie](/fr/iot/energy/). Lire relève de `energy.read`, que tous les rôles ont ; créer ou modifier un compteur ou un tarif relève de `energy.write`, celui d'un administrateur.

### `GET /api/energy/meters`

Tous les compteurs, par genre puis par nom, chacun avec la façon dont il est lu et ce qu'il a consommé aujourd'hui.

```json
[{"id":"main","name":"Main panel","kind":"electricity","mode":"counter","source":{"device_id":"pm-01","tag_name":"kWh"},"unit":"kWh","factor":0.001,"tariff":{"currency":"USD","price":0.12,"bands":[{"from":"22:00","to":"06:00","price":0.07}]},"enabled":true,"status":{"state":"ok","last_read_at":"2026-11-19T21:15:00Z","resets":0,"gap_seconds":0},"today":{"value":412.6,"cost":49.51,"covered_seconds":43200,"estimated":false}}]
```

`status.state` vaut `ok`, `waiting` (rien n'a encore été lu depuis le tag), `bad` (la lecture du tag n'est pas bonne, et `reason` dit pourquoi) ou `disabled`.

### `POST /api/energy/meters`

Crée un compteur. `id` est composé de lettres minuscules, de chiffres, de `-` et de `_`. `kind` vaut `electricity`, `gas`, `water`, `air`, `heat` ou `production`. `mode` vaut `counter` (un tag cumulatif : ce qui a été consommé est ce dont il a avancé, multiplié par `factor`) ou `power` (un débit : ce qui a été consommé est le débit sur la durée où il a tenu, avec `power_unit` `W`, `kW` ou `MW`, et `unit` `Wh`, `kWh` ou `MWh`). `source` est le tag. `tariff` est un `price` fixe par unité avec une `currency` facultative, et des `bands` facultatives (`from` et `to` sur un quart d'heure, `days`, `price`) pour un tarif horosaisonnier ; un compteur de production n'en a aucun. Un compteur d'électricité en `Wh`, `kWh` ou `MWh` peut aussi avoir un `demand_price` dans le tarif : ce que coûte un kilowatt de son quart d'heure le plus élevé dans une fenêtre. `enabled` omis vaut `true`. `201` avec `{"meter": {...}, "warnings": []}`. `400` en disant ce qui ne va pas : le tag n'existe pas ou n'est pas un nombre, une bande n'est pas sur un quart d'heure, un compteur de puissance avec un facteur. `409` pour un id déjà pris.

### `GET /api/energy/meters/{id}`

Un compteur, tel que la liste le montre. `404` pour un inconnu.

### `PUT /api/energy/meters/{id}`

Remplace la définition d'un compteur. Ce qu'il a déjà compté reste, avec le prix auquel il a été fait. Le pointer vers un autre tag ou un autre mode oublie où la dernière lecture s'était arrêtée, parce que la lecture suivante porte sur autre chose.

### `DELETE /api/energy/meters/{id}`

Supprime un compteur et tout ce qu'il a compté. `404` pour un inconnu.

### `GET /api/energy/summary`

La consommation et le coût de chaque compteur sur une fenêtre, et le coût d'une unité produite. La fenêtre est `?period=` (`today`, `yesterday`, `this_week`, `last_week`, `this_month`, `last_month`, `last_7_days`, `last_30_days`, ou un poste écrit `shift:06:00-14:00` pour le dernier qui a commencé et `last_shift:06:00-14:00` pour celui d'avant ; les jours, les mois et les postes sont ceux du site) ou `?from=&to=` en RFC 3339, from inclus et to non, au plus 400 jours. `meters` est une liste séparée par des virgules des compteurs dont le coût entre dans le coût par unité, et `per` nomme le compteur de production par lequel diviser.

```json
{"period":"today","from":"2026-11-19T05:00:00Z","to":"2026-11-20T05:00:00Z",
 "meters":[{"id":"main","name":"Main panel","kind":"electricity","unit":"kWh","currency":"USD","value":412.6,"cost":49.51,"covered_seconds":43200,"coverage":1,"estimated":false}],
 "costs":[{"currency":"USD","cost":49.51}],
 "per_unit":[{"production":"parts","units":9800,"currency":"USD","cost":49.51,"cost_per_unit":0.00505}]}
```

`coverage` est la part de la fenêtre écoulée que des lectures étayent. Les coûts en deux devises ne sont jamais additionnés, donc il y a une ligne `per_unit` pour chacune. `cost_per_unit` vaut `null` quand rien n'a été produit (`reason` vaut `nothing_made`) ou quand des unités ont été produites et qu'aucun compteur avec prix n'a encore compté de consommation (`nothing_counted`) : ce n'est pas une réponse, ce n'est pas zéro.

Un compteur avec un `demand_price` a un `demand` dans sa ligne : `peak_kw` (le quart d'heure le plus élevé de la fenêtre, en kilowatts de sa moyenne), `peak_at` (quand il a commencé), `peak_covered_seconds` (quelle part de ce quart d'heure a été lue ; en dessous de 900 la pointe est sous-estimée) et `cost` (la pointe multipliée par le prix). Le `cost` de la ligne reste ce que l'énergie a coûté ; `costs` et `per_unit` incluent la charge de puissance.

### `GET /api/energy/summary/{period}`

La même chose que le résumé, sur une période (ou un poste) nommée donnée dans le chemin. `meters` et `per` restent dans la requête.

### `GET /api/energy/series`

La consommation d'un compteur sur une fenêtre, `?meter=<id>`, la fenêtre comme ci-dessus, et `step` : `quarter` (8 jours au plus), `hour` (par défaut), `day` ou `month`. Un pas sans lectures ne figure pas dans la liste.

```json
{"meter":"main","unit":"kWh","currency":"USD","step":"day","points":[{"start":"2026-11-19T05:00:00Z","value":412.6,"cost":49.51,"estimated":false}]}
```

### `GET /api/energy/series/{meter}/{period}/{step}`

La même chose que la série, avec le compteur, la période nommée et le pas dans le chemin, pour un appelant qui n'a qu'un chemin à donner.

## Services

### `POST /api/services/{domain}/{service}`

Commande une entité : `switch/turn_on`, `number/set_value`, `motor/start`, `alarm/acknowledge`. Une entité, un service, un appel. En dessous, ce ne sont que des écritures de tags par la même porte d'écriture que `POST /api/write`.

```json
{"entity_id":"switch.tank_farm_pump","reason":"start of shift"}
```

`entity_id` est obligatoire et désigne une entité, pas une liste ; `reason` est facultatif ; tout le reste est la donnée du service (`value`, `option`, `position`, `mode`, `minutes`, `note`). Les nombres gardent le type avec lequel ils ont été saisis. Le domaine du chemin doit être celui de l'entité. Chaque service et ses données sont dans [Entités](/fr/iot/entities/#what-each-domain-takes).

```json
{"call_id":"5c9f8545a93b5443","entity_id":"switch.tank_farm_pump","service":"switch.turn_on","writes":[{"tag":"tank-farm/pump","value":"true","status":"written"}]}
```

Chaque écriture est `written`, `not_sent` (refusée avant d'atteindre l'appareil), `failed` (elle est partie et l'appareil a signalé une erreur, donc on ne sait pas si elle a pris) ou `skipped` (une écriture antérieure de l'appel n'a pas réussi). Les écritures déjà faites ne sont jamais annulées. Les services d'une entité d'alarme n'écrivent aucun tag et répondent avec l'`alarm` telle que le moteur l'a laissée. Ceux d'un helper n'écrivent aucun tag non plus et répondent avec le `state` dans lequel ils l'ont laissé :

```json
{"call_id":"0f3c2a1b9d8e7f60","entity_id":"input_number.batch_target","service":"input_number.set_value","writes":[],"state":"1250"}
```

Le `turn_on` d'un script l'exécute, avec les données comme champs, et répond avec le `script_run` qu'il a démarré ; les écritures de ses étapes sont auditées une à une sous `script:<id>`, pas ici. `turn_off` arrête toutes ses exécutions. Voir [Scripts](#scripts).

Le `turn_on` d'une scène applique sa recette, avec `params` et `version` tirés des données, et répond avec la `recipe_application` complète et, dans `writes`, chaque écriture qu'ont faite ses cibles, dans l'ordre. Il échoue sauf si toutes les cibles ont été écrites. Voir [Recettes](#recettes).

Un appel qui échoue répond avec le statut de l'erreur et le même corps plus `error`, pour qu'on voie exactement où il s'est arrêté :

```json
{"error":"value is outside the tag's configured range: 150 is outside 0..95","call_id":"3cd42f8275e5765e","entity_id":"number.tank_farm_level_sp","service":"number.set_value","writes":[{"tag":"tank-farm/level_sp","value":"150","status":"not_sent","error":"value is outside the tag's configured range: 150 is outside 0..95"}]}
```

| Statut | Quand |
|---|---|
| 400 | Pas d'`entity_id`, mauvais domaine, service inconnu, données que le service n'accepte pas |
| 403 | L'autorisation, ou la porte a refusé pour une raison de politique |
| 404 | Pas d'entité de ce nom |
| 409 | Une bascule sans état connu, un équipement dans un mauvais état pour le service |
| 422 | Une valeur refusée sur le fond |
| 503 | L'appareil n'est pas connecté ; le moteur d'alarmes ne tourne pas |
| 500 | Un appui de bouton est parti et son relâchement non. **Le tag peut encore tenir la valeur d'appui** : vérifiez-le et relâchez-le à la main |

**`?dry_run=true`** demande ce que l'appel ferait et n'en fait rien : rien n'est écrit, audité ni journalisé. L'appel est planifié comme le vrai et chaque écriture est soumise aux contrôles de la porte elle-même, dans le même ordre, tout de suite. Un verdict répond 200, refusé ou non : chaque écriture `would_write`, ou la première qui serait refusée `not_sent` avec la raison et les autres `skipped`, et `error` est l'erreur avec laquelle le vrai appel échouerait, mot pour mot.

```json
{"dry_run":true,"error":"value is outside the tag's configured range: 150 is outside 0..95","entity_id":"number.tank_farm_level_sp","service":"number.set_value","writes":[{"tag":"tank-farm/level_sp","value":"150","status":"not_sent","error":"value is outside the tag's configured range: 150 is outside 0..95"}]}
```

Une requête que le vrai appel écarterait avant tout contrôle (entité inexistante, service inconnu, données que le service n'accepte pas, une bascule sans état connu) répond avec le statut et l'erreur du vrai appel ; il en va de même pour une autorisation manquante. `dry_run` vaut `true` ou `false` et rien d'autre : `yes` est un 400, pas une supposition, parce que deviner de travers transforme une question en commande. Voir [Entités](/fr/iot/entities/#asking-first-the-dry-run).

**Pourquoi l'autorisation est vérifiée dans le gestionnaire.** Il faut `values.write`, comme pour écrire le tag directement, parce que ce n'est rien d'autre ; les services d'une entité `alarm` demandent `alarms.ack`, comme l'écran des alarmes, ceux d'un helper demandent `helpers.write`, qu'un opérateur détient, ceux d'un script demandent `scripts.run`, comme `POST /api/scripts/{id}/run`, et ceux d'une scène demandent `recipes.apply` et l'autorisation propre à la recette quand elle en nomme une, comme `POST /api/recipes/{id}/apply`. La vérification est faite dans le gestionnaire plutôt qu'en amont pour qu'un refus faute de cette autorisation passe par la porte d'écriture et soit **audité contre l'entité** comme tout autre refus, avec la valeur demandée. Un utilisateur sans l'autorisation reçoit un 403 et une ligne dans `GET /api/writes?entity=...`, pas un 403 et rien. Un helper n'écrit aucun tag, donc le refus d'un helper, celui-ci compris, est plutôt un avertissement dans le journal système (`GET /api/events`) contre le helper, et il en va de même pour un script. Le refus d'une scène est une application refusée dans l'historique de la recette, avec l'utilisateur.

## Assistants

Des valeurs qui appartiennent aux gens de l'usine plutôt qu'à un automate : `input_boolean`, `input_number`, `input_select`, `input_text`, `input_counter`, `timer` et `schedule`. Un assistant est une entité (plateforme `helper`) et apparaît dans `/api/entities` et `/api/states` comme toute autre ; ces routes sont sa configuration. Sa valeur se fixe par ses services ci-dessus, avec `helpers.write`. Chaque domaine, option et service est décrit dans [Assistants](/fr/iot/helpers/).

### `GET /api/helpers`

Tous les assistants, chacun avec les champs de son entité et sa `value`, la ligne stockée pour lui :

```json
[{"id":41,"entity_id":"timer.purge","unique_id":"helper:6f1d...","domain":"timer","platform":"helper","name":"Purge","options":{"duration_sec":600},"...":"...","value":{"state":"active","finishes_at":"2026-09-27T21:10:00Z","duration_ms":600000,"changed_at":"2026-09-27T21:00:00Z","changed_by":"otto","source":"ui","call_id":"9a1b...","rev":4}}]
```

### `POST /api/helpers`

Crée un assistant à sa valeur initiale. Réservé aux administrateurs.

```json
{"name":"Batch target","domain":"input_number","unit_of_measurement":"kg","options":{"min":0,"max":5000,"step":50,"initial":1000}}
```

Aussi `entity_id` (sinon généré à partir du nom) et `icon`. Répond `201` `{"helper": {...}}`. `400` pour un domaine qui n'est pas celui d'un assistant, une option que le domaine n'accepte pas ou un `initial` que ses propres options refuseraient ; `409` pour un entity_id déjà pris.

### `GET /api/helpers/{entity_id}`

Un assistant, comme dans la liste. `404` pour une entité inconnue ou qui n'est pas un assistant.

### `PUT /api/helpers/{entity_id}`

Modifie son `name`, `icon`, `unit_of_measurement`, `options`, `disabled`, `hidden`, `entity_id`, `equipment_id` ou `labels`, les mêmes champs que `PUT /api/entities/{entity_id}`. Réservé aux administrateurs. De nouvelles options qui n'autoriseraient pas la valeur qu'il détient (une plage rétrécie en dessous, le choix sélectionné retiré) donnent un `400` : une valeur n'est jamais déplacée pour s'adapter. Répond `{"helper": {...}, "warnings": []}`.

### `DELETE /api/helpers/{entity_id}`

Supprime l'assistant et sa valeur. Réservé aux administrateurs. `{"deleted":"timer.purge"}`. `DELETE /api/entities/{entity_id}` refuse un assistant avec un `409` qui renvoie ici.

## Équipements et libellés

L'arborescence ISA-95 (entreprise, site, zone, ligne, cellule, unité, équipement) et les libellés libres. En snake_case. Tous les rôles lisent ; seul un administrateur modifie, car renommer ou déplacer un nœud réécrit le site, la zone et la ligne de chaque appareil qui en dépend. Voir [l'arbre des équipements et les libellés](/fr/iot/equipment/).

### `GET /api/equipment`

Tous les nœuds, triés par id, chacun avec son `path` de noms depuis la racine. `?level=area` filtre. `?q=` garde les nœuds dont le chemin contient le texte (sans tenir compte de la casse), `?limit=` (de 1 à 5000, toute autre valeur donne `400`) les premiers d'entre eux ; avec l'un ou l'autre, `X-Total-Count` indique combien ont correspondu.

```json
[{"id":4,"parent_id":1,"level":"area","name":"Utilities","created_at":"2026-09-27T20:21:01.637319Z","updated_at":"2026-09-27T20:21:01.637319Z","path":["Demo Plant","Utilities"]}]
```

### `POST /api/equipment`

```json
{"parent_id":3,"level":"cell","name":"Die head","description":"Die and screen changer"}
```

Un `parent_id` nul ou omis crée une racine. Un enfant doit être d'un niveau inférieur à son parent (un équipement peut se trouver dans un équipement). Répond `{"equipment": {...}, "devices_rewritten": []}`. `400` pour un niveau ou un emplacement incorrect, `409` pour un frère de même niveau et de même nom.

### `GET /api/equipment/{id}`

Le nœud, les nœuds placés directement sous lui, et les appareils et entités placés directement sur lui :

```json
{"children":[],"devices":["extruder-1"],"entities":[],"equipment":{"id":3,"parent_id":2,"level":"line","name":"Line 1","...":"...","path":["Demo Plant","Extrusion","Line 1"]}}
```

`400` pour un id qui n'est pas un nombre positif, `404` pour un id inconnu.

### `PUT /api/equipment/{id}`

Un ou plusieurs de `name`, `description`, `level`, `parent_id` (`null` le déplace à la racine). Seuls les champs envoyés changent ; un corps vide donne un 400. Répond le nœud et **chaque appareil dont le texte de site, de zone ou de ligne a changé en conséquence**, car c'est ce texte que lisent les anciens clients et les outils MCP :

```json
{"devices_rewritten":["tank-farm"],"equipment":{"id":4,"parent_id":1,"level":"area","name":"Utilities East","...":"..."}}
```

### `DELETE /api/equipment/{id}`

`{"deleted":5}`. `409` tant que quelque chose se trouve dessous ou dessus, en disant quoi : supprimer un nœud sous les pieds d'un appareil n'est pas une décision à prendre par accident.

### `GET /api/labels`

```json
[{"label_id":"critical","name":"Critical","color":"red","icon":"mdi:alert","description":"Stops the line if it fails","created_at":"2026-09-27T20:24:29.659126Z","updated_at":"2026-09-27T20:24:29.659126Z"}]
```

### `POST /api/labels`

`name` est obligatoire ; `label_id` (de 1 à 64 lettres minuscules, chiffres et tirets bas) est généré à partir du nom s'il est omis, et ne change jamais ensuite. `color`, `icon` (`mdi:...`) et `description` sont facultatifs. Répond le libellé. `409` pour un nom ou un id déjà pris.

### `GET /api/labels/{label_id}`

`{"label": {...}, "devices": ["tank-farm"], "entities": []}` : le libellé et ce qui le porte. `404` pour un libellé inconnu.

### `PUT /api/labels/{label_id}`

Remplace `name`, `color`, `icon` et `description` ; un champ omis est effacé. Un `label_id` dans le corps doit correspondre au chemin : `400` sinon, car un label_id ne change jamais.

### `DELETE /api/labels/{label_id}`

Le retire de tout ce qui le porte. `{"deleted":"critical"}`, ou `404`.

### `PUT /api/devices/{id}/labels`

`{"labels": ["critical"]}` remplace tout l'ensemble d'un appareil. Répond `{"id":"tank-farm","labels":["critical"]}`. Chaque libellé doit exister (`400` avec le nom de ceux qui manquent), et l'appareil aussi (`404`). Les libellés ne font volontairement pas partie de `POST /api/devices` : tout client qui enregistre un appareil envoie l'appareil complet sans eux, et les effacerait à chaque enregistrement.

## Alarmes

ISA-18.2 : se déclencher, être acquittée et revenir à la normale sont trois choses distinctes, et le journal peut dire laquelle s'est produite.

### `GET /api/alarms`

Toutes les définitions, les alarmes en cours et le récapitulatif. `?outstanding=true` laisse de côté les alarmes normales et mises en silence.

```json
{
  "alarms": [{"definitionId":"extruder-temp-hi","name":"Extruder temperature high","deviceId":"extruder-1","tagName":"Temperature","priority":2,"state":"unack-active","message":"extruder-1/Temperature at 22.80197037650447 C, limit 5","tripValue":22.80197037650447,"raisedAt":"2026-09-27T20:25:19.67042816Z","count":1,"updatedAt":"2026-09-27T20:25:19.67042816Z"}],
  "definitions": [{"id":"extruder-temp-hi","name":"Extruder temperature high","deviceId":"extruder-1","tagName":"Temperature","condition":"hi","limit":5,"priority":2,"enabled":true,"deadband":0.5,"message":"{device}/{tag} at {value}, limit {limit}","createdAt":"2026-09-27T20:25:19.055658Z","updatedAt":"2026-09-27T20:25:19.055658Z"}],
  "summary": {"critical":0,"high":1,"medium":0,"low":0,"unacked":1,"total":1}
}
```

`state` vaut `normal`, `unack-active`, `ack-active`, `rtn-unack` (revenue à la normale avant que quiconque l'ait acquittée, et conservée dans la liste pour qu'un déclenchement à 3 h du matin ne disparaisse pas avant que l'équipe du matin le voie), `shelved` ou `suppressed`. `tripValue` est la lecture qui l'a déclenchée, pas la lecture actuelle.

### `POST /api/alarms`

Crée ou remplace une définition.

| Champ | Type | <span class="sr-only">Détails</span> |
|---|---|---|
| `id`, `name` | string | Obligatoire. `id` suit les règles d'id des appareils |
| `deviceId`, `tagName` | string | Obligatoire |
| `condition` | string | `hihi`, `hi`, `lo`, `lolo`, `eq`, `ne`, `true`, `false`, `bad-quality`, `stale` (aucune lecture pendant `limit` secondes), `roc` (vitesse de variation supérieure à `limit` par seconde) |
| `limit` | number | |
| `priority` | int | De 1 (critique) à 4 (faible) |
| `enabled` | bool | Omis, vaut `false` |
| `deadband` | number | De combien la valeur doit revenir en arrière avant que l'alarme ne s'efface. Sans bande morte, une valeur posée sur la limite oscille sans cesse |
| `onDelaySec`, `offDelaySec` | int | Combien de temps la condition doit durer avant de déclencher l'alarme, ou être absente avant son retour à la normale |
| `message`, `description` | string | `message` accepte `{value}`, `{limit}`, `{tag}`, `{device}`, `{unit}`, `{condition}` et `{reason}` (pourquoi la lecture est mauvaise, vide quand elle est bonne) |

`{value}` s'écrit comme l'écrit la carte de valeur, unité comprise : les nombres entiers tels quels, deux décimales à partir de 1, une à partir de 100, quatre en dessous de 1, et la notation scientifique au-delà de dix millions ou en dessous de 0.01 (`8.20 pH`, `212.5 F`, `1.235e+7`). Nous avons fait ainsi parce qu'un tag d'échelle 0.1 avec une valeur brute de 82 vaut 8.200000000000001 en flottant, et que le bandeau l'affichait tel quel. Une lecture textuelle est dite telle quelle. Le tag, les écritures et les automatisations voient toujours le nombre exact ; seule la phrase est arrondie. `{limit}` est la limite telle que vous l'avez saisie.

Répond la définition ; le moteur se recharge et l'entité de l'alarme est créée avant la réponse. `400` en cas d'échec de la validation (`"alarm x: priority must be 1-4, got 9"`).

### `POST /api/alarms/import/codesys`

Lit le fichier que l'Export Alarms de l'IDE CODESYS écrit (l'export d'un groupe d'alarmes, `.csv`) depuis le corps de la requête, tel que l'IDE l'a écrit (UTF-16 avec marque d'ordre des octets) ou en UTF-8. `?deviceId=` est l'appareil de l'automate et il est obligatoire. `?application=` est le nom de l'application sous laquelle se trouvent ses tags, `Application` s'il est omis : l'export nomme une variable par son GVL (`GVL_Alarm.bPumpFault`) et le tag est `Application.GVL_Alarm.bPumpFault`. `?defaultPriority=` (de 1 à 4) est la priorité d'une alarme dont la classe n'est ni Error, ni Warning, ni Info. Sans `?apply=true`, rien n'est enregistré : la réponse dit ce qui serait importé.

L'écran Alarmes propose cette fonction sous le nom Importer depuis CODESYS (administrateurs seulement) : choisissez l'appareil, nommez l'application, choisissez le fichier, lisez l'aperçu, puis importez.

Les alarmes numériques comparées à `= TRUE` ou `= FALSE` deviennent `true` et `false`, UpperLimit avec `>` devient `hi`, LowerLimit avec `<` devient `lo`, une alarme Outside range (`OutOfArea`, avec deux opérateurs `<`) devient deux alarmes, une `lo` à la limite basse et une `hi` à la limite haute, le message et les temporisations d'activation et de retour (un temps IEC comme `T#5s`) sont repris, et Error vaut la priorité 2, Warning 3, Info 4. Tout le reste de ce que l'IDE peut écrire n'est pas lu et revient dans `skipped` avec sa ligne et la raison, car CODESYS ne documente pas le format et seul ce qu'un export réel a montré est lu. Cela inclut le reste de ce que propose l'IDE : Inside the range (`ForbiddenArea`) n'est vrai qu'entre deux limites alors qu'une alarme n'en a qu'une ici, Change n'a pas de durée documentée, et Event et Alarm (API) sont déclenchées par le programme de l'automate et n'ont aucune variable à surveiller. `warnings` liste ce qui n'est passé qu'en partie (une classe inconnue, le verrouillage, une alarme de priorité supérieure).

```json
{"applied": false, "version": "2.0.0.0",
 "alarms": [{"id":"codesys-GVL_Alarm.rTemp-hi","name":"Temperature high","deviceId":"plc1","tagName":"Application.GVL_Alarm.rTemp","condition":"hi","limit":90,"priority":3,"enabled":true,"message":"Temperature high"}],
 "skipped": [{"row":5,"id":"3","reason":"the observation type \"Deviation\" has not been seen in an export, so it is not read"}],
 "warnings": []}
```

`404` pour un appareil inconnu, `400` pour un fichier qui n'est pas l'export d'un groupe d'alarmes.

### `DELETE /api/alarms/{id}`

`{"deleted":"extruder-temp-hi"}`, ou `404`.

### `POST /api/alarms/{id}/ack`

Corps facultatif `{"note": "checking the heater bands"}`. Répond l'alarme telle qu'elle est maintenant, avec `ackedBy` et `ackNote`. `404` pour une alarme inconnue.

### `POST /api/alarms/{id}/shelve`

`{"minutes": 30}`, obligatoire et positif : un silence indéfini est une suppression, ce qui est autre chose et n'est pas à un opérateur d'en décider. Répond l'alarme, `state` à `shelved`, avec `shelvedUntil` et `shelvedBy`.

### `POST /api/alarms/{id}/unshelve`

Pas de corps. Répond l'alarme remise dans l'état que sa condition lui donne. `409` si elle n'était pas en attente.

### `GET /api/alarms/events`

Le journal d'audit des alarmes, de la plus récente à la plus ancienne. `?alarm=` une définition, `?limit=` (200 par défaut, 5000 au plus).

```json
[{"id":2,"definitionId":"extruder-temp-hi","type":"acked","fromState":"unack-active","toState":"ack-active","value":23.192472931395088,"message":"extruder-1/Temperature at 22.80197037650447 C, limit 5","actor":"admin","note":"checking the heater bands","at":"2026-09-27T20:25:22.920251Z"}]
```

`type` vaut `raised`, `acked`, `cleared`, `shelved`, `unshelved`, `suppressed`, `unsuppressed`, `escalated` ou `escalation-ended`. Les deux derniers sont écrits par l'escalade des alarmes (`actor` vaut `escalation`), et leur `note` dit qui a été prévenu et pourquoi la chaîne s'est arrêtée. Voir [Notifications d'alarmes](/fr/iot/notifications/#escalation).

## Automatisations

Des déclencheurs, une condition, des actions. Le langage des règles est dans [Automatisations](/fr/iot/automations/).

### `GET /api/automations`

```json
{"armed":{"fill-tank":true},"automations":[{"id":"fill-tank","name":"Fill the tank","enabled":true,"triggers":[{"type":"threshold","deviceId":"tank-farm","tagName":"level","threshold":20,"direction":"falling","hysteresis":5},{"type":"webhook","webhookPath":"fill-now"}],"actions":[{"type":"call_service","name":"start the pump","params":{"service":"switch.turn_on","entityId":"switch.tank_farm_pump"}}],"mode":"skip","minIntervalSec":60,"createdAt":"2026-09-27T20:26:49.770826Z","updatedAt":"2026-09-27T20:26:49.770826Z"}],"webhooks":["fill-now"]}
```

`armed` indique quelles règles tournent réellement, ce qui n'est pas la même chose que `enabled` : une règle activée qui ne compile plus n'est pas armée, et c'est ici qu'on le découvre.

### `POST /api/automations`

Crée ou remplace une règle : `id`, `name`, `description`, `enabled`, `triggers` (au moins un), `condition`, `actions` (au moins une), `mode` (`skip`, par défaut, `queue`, `restart` ou `parallel`), `minIntervalSec`, `maxRuntimeSec`. La règle est compilée avant d'être enregistrée, et une règle qui ne compile pas donne un 400 et n'atteint jamais la base : une règle enregistrée qui ne peut pas être armée est une règle que son auteur croit en marche.

```json
{"error":"automation fill-tank action 1 (call_service): params: json: unknown field \"entity_id\""}
```

### `POST /api/automations/validate`

Compile une règle sans l'enregistrer, pour la vérification en direct de l'éditeur. Toujours `200` ; la réponse dit si elle a compilé :

```json
{"valid":true}
{"error":"automation bad: at least one trigger is required","valid":false}
```

Elle demande `automations.write`, car elle existe pour aider à en écrire une.

### `DELETE /api/automations/{id}`

`{"deleted":"fill-tank"}`, ou `404`.

### `POST /api/automations/{id}/enabled`

`{"enabled": false}` la désarme sans la supprimer. Répond `{"enabled":false,"id":"fill-tank"}`, ou `404`.

### `POST /api/automations/{id}/trigger`

La lance maintenant, comme si un déclencheur s'était produit. La condition s'applique toujours (une condition fausse enregistre une exécution `skipped`), tout comme le mode d'exécution ; `minIntervalSec` non, car une personne qui demande une exécution n'est pas un tag qui oscille. Pas de corps. `202` `{"triggered":"fill-tank"}` : l'exécution se fait en arrière-plan, et `GET /api/runs` en donne le résultat. `400` si la règle n'est pas armée. Les opérateurs détiennent `automations.trigger` ; lancer une règle écrite par quelqu'un d'autre, c'est exploiter, en écrire une, non.

### `GET /api/runs`

L'historique des exécutions, de la plus récente à la plus ancienne. `?automation=` une règle, `?limit=` (100 par défaut, 1000 au plus). `[]` quand il n'y en a aucune.

```json
[{"id":1,"automationId":"fill-tank","status":"succeeded","triggerType":"manual","triggerDesc":"triggered by admin","actor":"admin","startedAt":"2026-09-27T20:26:50.269792Z","finishedAt":"2026-09-27T20:26:50.282129Z","durationMs":12.337,"steps":[{"index":1,"type":"call_service","name":"start the pump","input":"switch.turn_on switch.tank_farm_pump {}","output":"true to tank-farm/pump: written; call 8fb9538c82d532be","startedAt":"2026-09-27T20:26:50.272532641Z","durationMs":9.595}]}]
```

`status` vaut `running`, `succeeded`, `failed`, `skipped`, `timed_out` ou `cancelled`. Les étapes conservent les entrées résolues, pas les modèles, car c'est ce qu'il faut lire à 3 h du matin.

Une règle issue d'un blueprint porte trois champs de plus dans `GET /api/automations` : `blueprintId`, `blueprintVersion` (la version dont elle est issue, qui est la version où elle reste) et `blueprintInputs`. Une règle écrite à la main n'en a aucun. Ils appartiennent au serveur : `POST /api/automations` les accepte et les ignore, et une modification à la main conserve ce que la règle avait.

### `POST /api/automations/{id}/blueprint-upgrade`

Fait passer une règle issue d'un blueprint à la version la plus récente du blueprint, en gardant son id, son nom et son état armé ou non. Cela n'est jamais fait à votre place. Les opérateurs détiennent `blueprints.apply`, comme pour en créer une. Regardez d'abord : **`?dry_run=true`** ne change rien et répond ce qui changerait, partie par partie, et ce que la règle ferait si elle se déclenchait maintenant, chaque écriture étant soumise aux contrôles de la porte d'écriture :

```json
{"dry_run":true,"id":"pump_1_watch","blueprint":"pump_watch","from":1,"to":2,"changes":[{"field":"actions","before":[{"params":{"message":"switch.pump_1 started, v1"},"type":"log_event"}],"after":[{"params":{"message":"switch.pump_1 started, v2"},"type":"log_event"}]}],"automation":{"id":"pump_1_watch","...":"..."},"check":{"automation_id":"pump_1_watch","steps":[{"step":"1","type":"log_event","verdict":"not_checked","detail":"a dry run checks writes to equipment; this step writes to none and runs only for real"}]}}
```

Une modification faite à la main depuis la création de la règle apparaît dans `changes` comme remplacée. Quand la nouvelle version a besoin d'une entrée pour laquelle la règle n'a pas de valeur, ou refuse une valeur avec laquelle elle a été créée, l'essai à blanc le dit dans `error` et rien d'autre.

La vraie demande prend `{"version": 2}`, la version qu'a montrée l'essai à blanc, et `inputs` pour tout ce dont la nouvelle version a besoin. Un blueprint qui a évolué depuis, ou une règle que quelqu'un a mise à niveau entre-temps, donne un `409` : ce qui a été examiné est ce qui entre, ou rien n'entre. Une entrée manquante donne un `400`. `200` avec la même forme, `automation` étant la règle telle qu'enregistrée. Elle est journalisée sous la forme `automation upgraded from blueprint pump_watch version 1 to 2`. Avec la même version et de nouveaux `inputs`, c'est ainsi qu'on change les entrées d'une règle. `400` pour une règle écrite à la main ; `404` si le blueprint dont elle est issue a disparu.

## Scripts

Des séquences d'actions nommées, lancées à la demande : d'ici, depuis l'étape `call_script` d'une règle, depuis `run_script` de MCP, ou par l'entité du script (`script.turn_on`). La séquence est le langage d'automatisation. Chaque écriture d'une étape passe par la porte d'écriture sous la forme `script:<id>`, avec la source de la personne qui l'a lancée. Tout est dans [Scripts](/fr/iot/scripts/).

### `GET /api/scripts`

Tous les scripts, avec leurs compteurs d'exécution et le nombre d'exécutions en cours, dans n'importe quel processus :

```json
[{"id":"cip_cycle","name":"CIP cycle","fields":[{"name":"minutes","type":"number","required":true,"min":1,"max":60,"unit":"min"}],"sequence":[{"type":"call_service","params":{"entityId":"switch.cip_pump","service":"switch.turn_on"}}],"mode":"skip","createdAt":"2026-09-28T10:00:00Z","updatedAt":"2026-09-28T10:00:00Z","lastRun":"2026-09-28T10:05:00Z","lastStatus":"succeeded","runCount":3,"running":0}]
```

### `POST /api/scripts`

En crée un. Réservé aux administrateurs. `id` (lettres minuscules, chiffres et tirets bas, en commençant par une lettre : c'est l'id d'objet de l'entité, `script.<id>`), `name`, `description`, `icon`, `fields` (entrées typées), `sequence` (au moins une action), `mode` (`skip`, par défaut, `queue`, `restart` ou `parallel`) et `maxRuntimeSec`. Il est compilé avant d'être enregistré, comme une règle, et un script qui s'appellerait lui-même, directement ou par d'autres scripts, est refusé. Répond `201` avec le script. `400` pour tout ce qui ne compile pas ; `409` pour un id déjà pris.

### `POST /api/scripts/validate`

Vérifie un script sans l'enregistrer, pour la vérification en direct de l'éditeur. `200` `{"valid":true}` ou `{"valid":false,"error":"..."}`, dans les mots avec lesquels un enregistrement serait refusé.

### `GET /api/scripts/{id}`

Un script, comme dans la liste. `404` s'il n'y en a pas.

### `PUT /api/scripts/{id}`

Remplace sa définition ; le corps est le même que pour en créer un, et son `id` peut être omis. Réservé aux administrateurs. Ses exécutions en cours sont annulées quand ses étapes, ses champs ou son mode changent : elles ont été lancées depuis l'ancienne définition.

### `DELETE /api/scripts/{id}`

Le supprime avec son historique d'exécutions, en annulant ses exécutions en cours. Réservé aux administrateurs. `{"deleted":"cip_cycle"}`. Son entité devient orpheline, elle n'est pas supprimée.

### `POST /api/scripts/{id}/run`

Le lance. Les opérateurs détiennent `scripts.run`.

```json
{"fields":{"minutes":20},"reason":"end of shift clean","wait":false}
```

Tous les champs du corps sont facultatifs, et le corps aussi. Les champs sont vérifiés par rapport à ceux du script avant que quoi que ce soit s'exécute : une valeur hors plage, hors de son étape, qui n'est pas l'une des options ou qui est du mauvais type donne un `400`, et n'est jamais déplacée pour convenir. `202` avec l'exécution dès qu'elle a démarré ; avec `"wait":true`, `200` avec l'exécution une fois terminée, sa trace comprise.

```json
{"run":{"id":77,"scriptId":"cip_cycle","status":"running","actor":"otto","source":"ui","fields":{"minutes":20},"startedAt":"2026-09-28T10:05:00Z","durationMs":0}}
```

`409` quand il est occupé : déjà en cours avec le mode `skip`, ou en cours avec une exécution en file et le mode `queue`. Rien n'a tourné, et une exécution `skipped` figure dans l'historique pour dire pourquoi :

```json
{"error":"script busy: script cip_cycle was not started: it is already running, and its mode is skip","run":{"id":78,"scriptId":"cip_cycle","status":"skipped","...":"..."}}
```

**`?dry_run=true`** demande ce qu'une exécution ferait maintenant et n'en fait rien. Les champs sont vérifiés de la même façon ; puis chaque étape est parcourue face à l'usine telle qu'elle est : chaque écriture et chaque appel de service est soumis aux contrôles propres de la porte, une condition est évaluée, une variable est liée. Une attente, un délai et tout ce qui n'écrit sur aucun équipement sont `not_checked`. La première écriture qui serait refusée y met fin, comme elle mettrait fin à l'exécution, et `error` le dit dans les mots de la porte. `200` avec le verdict, refusé ou non :

```json
{"dry_run":true,"check":{"script_id":"cip_cycle","fields":{"minutes":20},"steps":[{"step":"1","type":"call_service","input":"switch.turn_on switch.cip_pump {}","verdict":"refused","detail":"cip/pump: this tag is not marked writable"}],"error":"step 1 (call_service): cip/pump: this tag is not marked writable"}}
```

Le `verdict` de chaque étape vaut `would_write`, `refused`, `ends_here` (une condition fausse maintenant, ou un arrêt), `not_checked` ou `ok`. Une étape d'un script qu'il appelle est numérotée sous l'appel : `3.1`.

### `POST /api/scripts/{id}/stop`

Annule toutes ses exécutions en cours, dans tous les processus, où qu'elles soient. `{"cancelled":1,"stopped":"cip_cycle"}`, `cancelled` étant les exécutions que ce processus détenait. Les opérateurs détiennent `scripts.run` : arrêter ce qu'on peut lancer fait partie du lancer.

### `GET /api/scripts/{id}/runs`

Ses exécutions, de la plus récente à la plus ancienne, avec leurs traces. `?limit=` (50 par défaut, 1000 au plus). `parent` est ce qui a appelé une exécution, quand quelque chose l'a fait : `automation_run:812`, `script_run:77`.

```json
[{"id":77,"scriptId":"cip_cycle","status":"succeeded","actor":"automation:shift-end","source":"automation","parent":"automation_run:812","fields":{"minutes":20},"startedAt":"2026-09-28T10:05:00Z","finishedAt":"2026-09-28T10:25:00Z","durationMs":1200012,"steps":[{"index":1,"type":"call_service","input":"switch.turn_on switch.cip_pump {}","output":"true to cip/pump: written; call 8fb9538c82d532be","startedAt":"2026-09-28T10:05:00Z","durationMs":9.6}]}]
```

## Recettes

Des jeux de valeurs appliqués ensemble : les consignes d'une qualité de produit, un changement de série. Chacun est aussi une entité, `scene.<id>`. Une recette est vérifiée en entier avant que rien ne parte et refusée en entier pour n'importe quelle raison ; ses cibles partent ensuite dans l'ordre sous un même identifiant d'appel, la première qui échoue arrête les autres, et rien n'est annulé ; chaque valeur écrite est relue depuis l'appareil. Tout est dans [Recettes](/fr/iot/recipes/).

Le nom, la description, le nœud d'équipement et la permission d'une recette changent sur place. Ce qu'elle écrit (`targets`, `params`, `precondition`, `verify_sec`) est une version, et les versions ne sont jamais modifiées : enregistrer un nouveau contenu stocke la suivante.

### `GET /api/recipes`

Toutes les recettes, avec le contenu de leur version courante et leur application la plus récente :

```json
[{"id":"grade_a","name":"Grade A","equipment_id":7,"apply_permission":"recipes.apply","current_version":3,"params":[{"name":"speed","type":"number","min":0,"max":400,"step":10,"unit":"rpm","required":true}],"precondition":"states['input_boolean.line_ready'] == 'on'","targets":[{"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210}},{"entity_id":"number.line_02_speed","service":"set_value","data_expressions":{"value":"vars.speed"}}],"verify_sec":10,"note":"zone 1 up 5","created_at":"2026-09-28T10:00:00Z","updated_at":"2026-09-28T11:00:00Z","last_application":{"id":41,"recipe_id":"grade_a","version":3,"call_id":"7c1f0e2d9a8b6c54","actor":"otto","source":"ui","params":{"speed":250},"status":"applied","targets":[],"started_at":"2026-09-28T11:05:00Z","finished_at":"2026-09-28T11:05:01Z"}}]
```

`equipment_id` vaut `null` pour une recette de toute l'usine.

### `POST /api/recipes`

En crée une, en version 1. Réservé aux administrateurs. `id` (lettres minuscules, chiffres et tirets bas, en commençant par une lettre : c'est l'identifiant d'objet de l'entité, `scene.<id>`), `name`, `description`, `equipment_id`, `apply_permission` (`recipes.apply`, par défaut, ou `recipes.apply.<name>`), `params` (entrées typées), `precondition` (une expression qui doit être vraie pour démarrer), `targets` (au moins une, au plus 200, chacune avec `entity_id`, `service` et `data` ou `data_expressions`), `verify_sec` (de 1 à 600, 10 par défaut) et `note`. Une cible fixe une valeur : `set_value`, `select_option`, `set_position`, `set_speed`, `set_setpoint`, `set_mode`, `turn_on`, `turn_off`, sur les domaines qui les acceptent. Une impulsion ou un démarrage est refusé : sa place est dans un script. L'entité de chaque cible doit exister, et chaque expression doit compiler. `201` avec la recette ; `400` pour toute erreur, `409` pour un identifiant déjà pris.

### `POST /api/recipes/capture`

Rédige une recette à partir de ce que les entités contiennent maintenant, réservé aux administrateurs, et n'enregistre rien :

```json
{"entity_ids":["number.line_02_zone1_sp","switch.line_02_heater","loop.line_02_tic"]}
```

Chacune devient une cible qui la remet à sa valeur actuelle, dans l'ordre donné ; une boucle devient son mode puis sa consigne. La réponse est une recette sans identifiant ni nom, pour l'éditeur. Une entité qui n'existe pas, est désactivée, est lue avec une qualité autre que bonne, est `unknown` ou `unavailable`, ou n'est pas quelque chose qu'une recette fixe, donne un `400` qui les nomme toutes : une recette construite sur une mauvaise lecture réécrit la mauvaise lecture.

### `GET /api/recipes/{id}`

Une recette, comme dans la liste. `404` s'il n'y en a pas.

### `PUT /api/recipes/{id}`

L'enregistre. Réservé aux administrateurs. Le corps est la recette telle que `GET` l'a renvoyée, modifiée ; son `id` peut être omis. `current_version` est la version sur laquelle la modification a été faite : si quelqu'un en a enregistré une autre depuis, l'enregistrement donne un `409` plutôt que d'écraser discrètement la sienne (`0` saute la vérification). Un nouveau contenu devient la version suivante, avec `note` pour dire pourquoi ; un changement du seul nom, de la description, de l'équipement ou de la permission n'en crée aucune.

### `DELETE /api/recipes/{id}`

La supprime avec ses versions. Réservé aux administrateurs. `{"deleted":"grade_a"}`. Ses applications sont conservées, parce que c'est ce qui a été envoyé à l'usine, et son entité devient orpheline.

### `GET /api/recipes/{id}/versions`

Toutes les versions, de la plus récente à la plus ancienne, chacune exactement comme elle a été enregistrée, avec qui l'a enregistrée et la note :

```json
[{"recipe_id":"grade_a","version":3,"params":[],"targets":[{"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210}}],"verify_sec":10,"note":"zone 1 up 5","created_by":"ada","created_at":"2026-09-28T11:00:00Z"}]
```

### `GET /api/recipes/{id}/versions/{version}`

Une version. `404` si la recette n'a pas cette version, `400` si `{version}` n'est pas un nombre.

### `POST /api/recipes/{id}/validate`

S'appliquerait-elle maintenant ? Les opérateurs détiennent `recipes.apply`. Le corps est celui d'une application, et rien n'est écrit, enregistré ni journalisé. Chaque vérification qu'une application fait avant d'écrire est faite : les paramètres, la permission propre de la recette, la précondition, les expressions de données, si une autre application écrit sur l'une de ses entités, et chaque cible soumise aux contrôles de la porte d'écriture. `200` avec le verdict, `would_apply` ou `refused`, et celui de chaque cible : `would_write`, `refused` avec la raison, ou `not_sent`.

```json
{"dry_run":true,"application":{"recipe_id":"grade_a","version":3,"params":{"speed":250},"status":"refused","targets":[{"index":1,"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210},"status":"would_write"},{"index":2,"entity_id":"number.line_02_speed","service":"set_value","data":{"value":250},"status":"refused","error":"line-02/Speed: this tag is not marked writable"}],"started_at":"2026-09-28T11:04:00Z","error":"target 2 (set_value number.line_02_speed): line-02/Speed: this tag is not marked writable"}}
```

Les paramètres qu'elle n'accepte pas donnent un `400`, comme pour l'application réelle.

### `POST /api/recipes/{id}/apply`

L'applique. Les opérateurs détiennent `recipes.apply`. Une recette qui nomme une permission propre, `recipes.apply.<name>`, exige aussi celle-là, vérifiée ici sur la recette ; un utilisateur qui ne l'a pas reçoit un `403` et une application refusée dans l'historique avec son nom dessus.

```json
{"params":{"speed":250},"reason":"grade A for the 2pm run","version":0,"resume":0}
```

Tout est facultatif, et le corps aussi. `version` applique volontairement une version plus ancienne ; omis, la version courante. `resume` est l'identifiant d'une application précédente de cette recette qui s'est arrêtée à mi-chemin : ses cibles qui n'ont pas été écrites partent comme une nouvelle application, avec sa version et ses paramètres, et `parent` dit laquelle elle termine.

Il répond une fois chaque valeur écrite et relue, ce qui prend au plus le `verify_sec` de la recette :

```json
{"application":{"id":42,"recipe_id":"grade_a","version":3,"call_id":"9d2e4f6a8b0c1e3f","actor":"otto","source":"ui","reason":"grade A for the 2pm run","params":{"speed":250},"status":"applied","targets":[{"index":1,"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210},"status":"written","writes":[{"tag":"line-02/Zone1_SP","value":"210","status":"written"}],"verification":"verified","verify_detail":"read back 210"},{"index":2,"entity_id":"number.line_02_speed","service":"set_value","data":{"value":250},"status":"written","writes":[{"tag":"line-02/Speed","value":"250","status":"written"}],"verification":"unconfirmed","verify_detail":"not confirmed within 10s: read back 240, not 250"}],"started_at":"2026-09-28T11:05:00Z","finished_at":"2026-09-28T11:05:10Z"}}
```

Une cible est `written`, `failed` (elle est partie et l'appareil a dit non, ou n'a rien dit), `not_sent`, `skipped` (une cible précédente n'est pas passée) ou `refused` (prévalidation). Une cible écrite est `verified` quand l'appareil a relu la valeur qui lui a été envoyée après l'envoi, et `unconfirmed` quand il ne l'a pas fait dans `verify_sec` : elle est partie et a peut-être été ignorée. Chaque écriture porte le `call_id` de l'application, donc `GET /api/writes?call=<call_id>` les donne toutes.

| Statut | Quand |
|---|---|
| 200 | `applied` : chaque cible écrite. Vérifiez la `verification` de chacune |
| 400 | Un paramètre que la recette n'accepte pas, hors plage ou du mauvais type ; un `resume` sans rien à appliquer |
| 403 | La permission propre de la recette. Enregistré comme une application refusée |
| 404 | Pas de telle recette, ou pas de telle version |
| 409 | `refused` : toute raison de ne pas démarrer, chacune dans `error` et sur sa cible. Ou une autre application écrit en ce moment sur l'une de ses entités. Rien n'a été écrit |
| 502 | `partial` ou `failed` : elle a démarré, et toutes les cibles ne sont pas parties. `targets` dit exactement lesquelles. Rien n'est annulé |

Toute réponse sauf un `400` pour un corps mal formé ou un `404` porte l'application, et toute application sauf un essai à blanc est dans `GET /api/recipes/{id}/applications`, refus compris.

### `GET /api/recipes/{id}/applications`

Ses applications, de la plus récente à la plus ancienne, refusées comprises. `?limit=` (50 par défaut, au plus 1000). `parent` est ce qui l'a appliquée, quand quelque chose l'a fait : `automation_run:812`, `script_run:77`, `application:41`. Les applications d'une recette supprimée sont toujours renvoyées.

## Blueprints

Une automatisation écrite une fois avec des blancs typés, remplis pour fabriquer une règle ordinaire. La règle garde la version dont elle est issue ; modifier le blueprint ne change aucune règle, et passer une règle à une version plus récente est [une mise à niveau](#post-apiautomationsidblueprint-upgrade) que quelqu'un demande. Chaque écriture de la règle passe par la porte d'écriture sous la forme `automation:<id>`. Tout est dans [Blueprints](/fr/iot/blueprints/).

### `GET /api/blueprints`

Tous les blueprints, les intégrés d'abord, chacun avec le nombre de règles qui en sont issues :

```json
[{"id":"motor_running_too_long","name":"Motor running too long","description":"Says so when a motor has been running longer than it should...","source":"builtin","version":1,"inputs":[{"name":"motor","label":"Motor","type":"entity","required":true,"domain":["motor"]},{"name":"max_run","label":"Longest it may run","type":"duration","default":3600},{"name":"stop_it","label":"Stop it as well","type":"boolean","default":false}],"template":{"triggers":[{"type":"state","entityId":{"!input":"motor"},"to":"running","forSec":{"!input":"max_run"}}],"...":"..."},"instances":2}]
```

`source` vaut `builtin` (livré dans le binaire, en lecture seule) ou `user`.

### `POST /api/blueprints`

En écrit un. Réservé aux administrateurs. `id` (lettres minuscules, chiffres et tirets bas, en commençant par une lettre), `name`, `description`, `inputs` (typées, comme les champs d'un script) et `template` : la règle, avec ses `description`, `triggers`, `condition`, `actions`, `mode`, `minIntervalSec` et `maxRuntimeSec`, et les blancs qu'elle contient. `{"!input": "motor"}` comme valeur est remplacé par l'entrée ; `${motor}` dans une chaîne aussi, comme littéral quand la chaîne est une expression. Il est vérifié avant d'être stocké : chaque blanc nomme une entrée, chaque entrée est utilisée, et rempli avec des valeurs d'exemple il donne une règle qui compile. `201` en `version` 1. `400` pour tout défaut, `409` pour un identifiant déjà pris, celui d'un blueprint intégré compris.

### `GET /api/blueprints/{id}`

Un blueprint, comme dans la liste. `404` s'il n'y en a pas.

### `PUT /api/blueprints/{id}`

Remplace sa définition ; le corps est le même que pour en écrire un, et son `id` peut être omis. Réservé aux administrateurs. `version` augmente de un quand `inputs` ou `template` ont changé, et pas pour un nouveau nom ou une nouvelle description. **Aucune règle qui en est issue ne change.** Chacune garde la version dont elle est issue, et `GET /api/automations` indique laquelle. Un blueprint intégré donne un `400` : copiez-le sous un identifiant à vous.

### `DELETE /api/blueprints/{id}`

Réservé aux administrateurs. `{"deleted":"pump_watch"}`. `409` tant qu'une règle qui en est issue existe, en les nommant : supprimez-les d'abord. Un blueprint intégré donne un `400`.

### `POST /api/blueprints/{id}/instantiate`

En fait une règle et l'arme. Les opérateurs détiennent `blueprints.apply` : quelle pompe et combien de temps, c'est à eux de choisir, et ce que fait la règle a été décidé quand le blueprint a été écrit.

```json
{"automationId":"infeed_too_long","name":"Infeed pump ran too long","enabled":true,"inputs":{"motor":"motor.infeed_pump","max_run":"90m","stop_it":true}}
```

`name` vaut par défaut celui du blueprint et `enabled` vaut `true`. Chaque entrée est vérifiée avant que rien ne soit créé : une valeur hors plage, hors de son pas, qui n'est pas l'une de ses options, une entité d'un autre domaine ou du mauvais type donne un `400` qui nomme chaque entrée fautive, et n'est jamais déplacée pour convenir. Un `automationId` déjà pris donne un `409` : créer une règle n'en remplace jamais une. `201` avec la règle, ses `blueprintId`, `blueprintVersion` et `blueprintInputs` renseignés. Elle est journalisée sous la forme `automation made from blueprint motor_running_too_long version 1`.

**`?dry_run=true`** ne crée rien. Il répond la règle qu'il créerait et ce que cette règle ferait si elle se déclenchait maintenant : la condition évaluée, chaque écriture et appel de service soumis aux contrôles de la porte sous la forme `automation:<id>`, le premier refus dans `check.error` avec les mots de la porte. Rien n'est stocké, écrit ni audité.

```json
{"dry_run":true,"automation":{"id":"infeed_too_long","...":"..."},"check":{"automation_id":"infeed_too_long","steps":[{"step":"1","type":"log_event","verdict":"not_checked"},{"step":"2","type":"condition","input":"true","verdict":"ok","detail":"true now"},{"step":"3","type":"call_service","input":"motor.stop motor.infeed_pump {}","verdict":"would_write","detail":"would write false to line-02/M1_Run"}]}}
```

## Tableaux de bord

Des pages de cartes, pour les rôles et les écrans qui en ont besoin. Un tableau de bord ne commande rien : une carte nomme un tag, une entité, un script ou une recette, et son bouton écrit via [`POST /api/write`](#post-apiwrite) au nom de la personne qui l'a pressé. Le tableau mural en est un. Tout est dans [Tableaux de bord](/fr/iot/dashboards/).

### `GET /api/dashboards`

Les tableaux de bord proposés à l'appelant, dans l'ordre où le sélecteur les montre, tableau mural compris. Quiconque détient `dashboards.write` se les voit tous proposer.

```json
[{"id":"wall","name":"Wall board","description":"The tags pinned on the Board screen, as gauges.","kind":"wall","roles":[],"homeFor":[],"screens":["wall-tv"],"position":0,"cards":[],"version":2,"updatedBy":"ada"},
 {"id":"line-2","name":"Line 2","kind":"cards","roles":["operator","admin"],"homeFor":["operator"],"screens":["line-2-panel"],"position":1,"version":3,"updatedBy":"ada","cards":[{"id":"temp","type":"gauge","title":"Zone 1","w":3,"h":3,"config":{"tag":"press-01/Zone1_Temp"}}]}]
```

### `POST /api/dashboards`

En construit un. Réservé aux administrateurs. `id` (lettres minuscules, chiffres, tirets et tirets bas, en commençant par une lettre), `name`, et facultativement `description`, `roles`, `homeFor`, `screens`, `position` et `cards`. `201` en `version` 1, avec la taille et la config de chaque carte sous la forme où elles ont été stockées.

Une carte est `id`, `type`, `title`, `w` (de 1 à 12 colonnes), `h` (de 1 à 8 lignes) et un `config`. Les types et leurs configs sont dans [Tableaux de bord](/fr/iot/dashboards/#les-cartes). Il est vérifié avant d'être stocké :

- une clé de config que le type n'a pas, un nombre hors plage, une adresse de caméra ou de plan avec un identifiant ou un jeton dedans, ou plus de 60 cartes donne un `400` ;
- une carte qui nomme un tag, une entité, un script ou une recette qui n'existe pas donne un `400` qui le nomme ;
- un `button` sur un tag non inscriptible, ou avec un nombre hors de la plage du tag, donne un `400` : la porte refuserait chaque pression ;
- un rôle qui n'existe pas donne un `400` ;
- un `id` déjà pris, un écran qu'un autre tableau de bord a déjà, ou une page d'accueil de rôle qu'un autre tableau de bord est déjà, donne un `409`.

### `GET /api/dashboards/{id}`

Un tableau de bord, comme dans la liste. `404` s'il n'y en a pas, et aussi si l'appelant ne se le voit pas proposer.

### `PUT /api/dashboards/{id}`

Le remplace. Réservé aux administrateurs. Le corps est le tableau de bord tel que `GET` l'a renvoyé, avec `version` fixée à la version à laquelle il a été lu : **elle est obligatoire**, et un enregistrement qui nomme une version qui n'est plus la courante donne un `409` disant laquelle est la courante, parce que l'alternative est de supprimer discrètement ce que la dernière personne à enregistrer vient de construire. L'`id` peut être omis du corps, `kind` ne peut pas changer, et `createdAt`, `updatedAt` et `updatedBy` sont ceux du serveur et ignorés. `200` avec le tableau de bord à la version suivante.

Le tableau mural accepte un `PUT` pour ses affectations (`roles`, `homeFor`, `screens`, `position`) et rien d'autre : il n'a pas de cartes, donc un avec des cartes donne un `400`. Ses jauges sont les tags du tableau, `GET` et `PUT /api/board`.

### `DELETE /api/dashboards/{id}`

Réservé aux administrateurs. `{"deleted":"line-2"}`. Les cartes pointent vers des choses et ne possèdent rien, donc rien d'autre n'est touché. Le tableau mural donne un `400` : il est toujours là.

Les créations, enregistrements et suppressions sont journalisés comme des événements `config` sur le sujet `dashboard:<id>`.

### `GET /api/dashboards/{id}/export`

Le tableau de bord sous forme de fichier d'écran : un document JSON versionné que [`POST /api/dashboards/import`](#post-apidashboardsimport) charge dans une autre installation. Il répond comme une pièce jointe nommée `<id>.hotloop-screen.json`. L'appelant a besoin de `dashboards.read` et doit se voir proposer le tableau de bord, comme pour `GET` d'un seul. Le tableau mural donne un `400` : ce sont les jauges épinglées d'une installation, pas une mise en page. Le format est décrit dans [Fichiers d'écran](/fr/iot/screen-file/).

### `POST /api/dashboards/import`

Lit un fichier d'écran, le vérifie par rapport à cette installation et l'enregistre comme un nouveau tableau de bord. Réservé aux administrateurs, et il ne peut pas enregistrer ce que `POST /api/dashboards` refuserait. Le corps est le fichier lui-même, ou `{"file": {...}}` avec des options à côté :

| Option | <span class="sr-only">Détails</span> |
|---|---|
| `id`, `name` | L'enregistrer sous un autre identifiant ou un autre nom. |
| `replace` | Si l'identifiant est pris, enregistrer par-dessus ce tableau de bord à sa version courante. Sans elle, un identifiant pris donne un `409`. |
| `skipAssignments` | Laisser de côté les `screens` et `homeFor` du fichier, qui appartiennent à l'installation qui l'a créé. Les `roles` restent. |
| `remap` | Comment nommer les choses ici : `tags` (clé entière vers clé entière, telle que le fichier nomme le tag ou telle qu'elle se lit une fois que `devices` l'a déplacé), `devices` (identifiant vers identifiant, ce qui déplace aussi la partie appareil de chaque tag non nommé dans `tags`), `entities`, `scripts`, `recipes` et `equipment` (identifiant vers identifiant). Une entrée dont rien sur l'écran ne se servait est un avertissement. |
| `dryRun` | Répondre le rapport et ne rien enregistrer. Toujours `200`. |
| `codesys`, `visualization` | À la place de `file` : le texte d'un export natif CODESYS, et la visualisation à prendre quand il en contient plusieurs. Le rapport comporte alors un `conversion` avec ce que chaque élément est devenu et ce qui a été laissé de côté. Voir [Importer un écran CODESYS](/fr/iot/codesys-screen-import/). |

La réponse est un rapport, qu'on ait enregistré quelque chose ou non :

```json
{"ok":false,"dryRun":true,"id":"line-2","name":"Line 2","cards":6,"replaces":false,
 "problems":[{"kind":"tag","ref":"press-01/Zone1_Temp","message":"tag press-01/Zone1_Temp does not exist here; map it to one that does, or add it on the Tags screen first"}],
 "warnings":[],"remapped":[],
 "requires":{"tags":[{"key":"press-01/Zone1_Temp","writable":false}],"entities":[],"scripts":[],"recipes":[],"devices":[],"equipment":[]}}
```

Chaque référence manquante est listée, pas seulement la première. Un `kind` est `file` (pas un fichier d'écran, le mauvais format, une version de format plus récente que celle que lit cette version, ou un champ qu'elle ne connaît pas), `screen` (les règles propres du tableau de bord : une mauvaise carte, un rôle qui n'existe pas, trop grand), `tag`, `entity`, `script`, `recipe`, `device`, `equipment`, `writable` (un bouton ou une consigne sur un tag non inscriptible), `assignment` (un nom d'écran ou une page d'accueil de rôle qu'un autre tableau de bord détient) ou `exists` (l'identifiant est pris). Un import qui a le moindre problème n'enregistre rien : `400`, ou `409` quand le seul souci est `exists` ou `assignment`, avec le même rapport. Le succès est `201`, ou `200` quand il en a remplacé un, avec le rapport et le `dashboard` enregistré. Il est journalisé comme un événement `config` sur le sujet `dashboard:<id>`.

## Webhooks

### `POST /api/webhook/{path}`

Déclenche chaque automatisation ayant un déclencheur `webhook` sur ce chemin. **Ni session ni permission** : le chemin est le secret remis à un tiers, le même modèle de confiance que ce point d'accès a toujours eu, et un système SCADA ou un rappel d'un SaaS n'a pas de compte pour se connecter. Choisissez un chemin que personne ne pourrait deviner.

Le corps, jusqu'à 1 MiB, est remis à la règle. `202` `{"accepted":"fill-now"}`. `404` `"no automation is listening on this webhook path"` quand rien n'écoute : un webhook qui poste dans le vide ressemble à s'y méprendre à un qui marche, alors il le dit.

## Parc

Les relais de périphérie enregistrés, leur présence en direct sur Sparkplug, et les commandes qui leur sont envoyées. Nécessite `HOTLOOP_FLEET_ENABLED`. Voir [Gestion du parc](/fr/gateway/fleet/).

### `GET /api/fleet`

```json
{"configured":true,"members":[{"id":"press-relay-01","name":"Press line relay","group":"plant-a","nodeId":"press-relay-01","statusUrl":"http://press-relay-01:8081","enabled":true,"createdAt":"2026-09-27T20:28:49.448323Z","updatedAt":"2026-09-27T20:28:49.448323Z","online":false,"polled":true,"error":"Get \"http://press-relay-01:8081/status\": dial tcp: lookup press-relay-01 on 10.89.0.1:53: no such host"}]}
```

`online` vient de NBIRTH et NDEATH. `release` est la version que le relais a dit exécuter dans sa dernière naissance : `version`, `imageDigest` (quand son superviseur le dit ; le chart Helm ne le fait pas) et `since`, le moment où le Gateway a entendu cette version pour la première fois. Un relais trop ancien pour en signaler une n'en a pas. Pour un membre avec `statusUrl`, `polled` est vrai et `reachable`, `forwardQueueLen`, `devices`, `connected`, `config` et `updateMode` (`auto` ou `approve`) viennent de son `/status` ; ils ne signifient rien quand il n'était pas joignable. Fonction désactivée : `{"members":[],"configured":false}`.

### `POST /api/fleet`

Crée ou remplace un membre : `id`, `name`, `group` et `nodeId` (son identité Sparkplug) obligatoires ; `description`, `statusUrl` (`http://` ou `https://`) et `enabled` facultatifs. Répond le membre. Celui-ci fonctionne fonction désactivée, de sorte que le parc peut être déclaré avant d'être activé.

### `DELETE /api/fleet/{id}`

`{"deleted":"press-relay-01"}`, ou `404`.

### `POST /api/fleet/{id}/rebirth`

Publie un `Node Control/Rebirth` vers le relais. Pas de corps. `{"status":"rebirth requested"}`. `404` pour un membre inconnu.

### `POST /api/fleet/{id}/restart`

Publie `Node Control/Reboot`. `{"status":"restart requested"}`. Réservé aux administrateurs : redémarrer un relais lui fait perdre ses données jusqu'à son retour.

### `POST /api/fleet/{id}/update`

Approuve la mise à jour d'image qu'un relais tient en attente. Publie `Node Control/Update`. `{"status":"update approved"}`. Réservé aux administrateurs : le relais sort et son superviseur démarre l'image qu'il suit, donc il perd ses données le temps que cela prend. Cela ne fait quelque chose que sur un relais réglé sur `HOTLOOP_EDGE_RELAY_UPDATE_MODE=approve` ; tout autre relais journalise qu'il l'a ignoré. La requête ne nomme aucune image : il n'y a nulle part où en mettre une, et c'est le but. Voir la [référence Edge Relay](/fr/edge-relay/reference/#mettre-à-jour-un-relay).

### `POST /api/fleet/{id}/config`

Envoie au relais un nouveau fichier d'appareils, qu'il applique à chaud : sans redémarrage, avec sa session de broker et sa file d'envoi conservées, et chaque appareil que le fichier n'a pas changé laissé connecté. Le corps est **le fichier d'appareils lui-même**, du JSON brut, sans rien autour. Il est validé avant que rien ne soit publié (`400` `"invalid device file: ..."` sinon). `{"status":"config pushed"}` signifie que le broker l'a pris ; savoir si le relais l'exécute se lit dans `config.digest` sur ce membre dans `GET /api/fleet`, et un fichier que le relais a refusé y apparaît comme `config.rejected`. Réservé aux administrateurs : cela change ce que le relais interroge. Voir [Gestion du parc](/fr/gateway/fleet/#envoi-de-configuration).

### `DELETE /api/fleet/{id}/config`

Reprend l'envoi. Efface la config retenue sur le broker pour qu'aucun démarrage ultérieur ne l'applique, et un relais connecté à cet instant abandonne son fichier envoyé et revient à chaud à son fichier d'appareils local. Pas de corps. `{"status":"config push cleared"}`, `404` pour un membre inconnu, `503` quand le Gateway n'est pas connecté au broker. Réservé aux administrateurs, comme l'envoi. Cela ne redémarre rien. Envoyez-le pendant que le relais est en ligne : un relais hors ligne ne l'entend jamais. Voir la [référence Edge Relay](/fr/edge-relay/reference/#où-vit-un-fichier-poussé-et-quel-fichier-lemporte).

## Notifications

Prévenir un téléphone quand une alarme est levée, par webhook, SMTP, ntfy ou Gotify, et prévenir la personne suivante quand personne ne l'acquitte. Nécessite `HOTLOOP_NOTIFY_ENABLED`.

### `POST /api/notify/test`

Envoie tout de suite une notification d'alarme synthétique par chaque canal configuré, pour que vous découvriez que le relais SMTP vous rejette avant qu'une vraie alarme ne le fasse. Pas de corps. Nécessite `HOTLOOP_NOTIFY_ENABLED`. Réservé aux administrateurs : il envoie un vrai message et consomme le quota que le fournisseur autorise.

```json
{"results":[{"channel":"smtp","success":true}]}
```

`200` que chaque canal ait fonctionné ou non ; chaque résultat le dit. Un échec porte `error`. Un webhook en échec nomme son schéma et son hôte et rien d'autre, parce que pour la plupart des services d'appel l'URL est l'identifiant secret. Voir [Notifications d'alarmes](/fr/iot/notifications/).

### `GET /api/notify/escalation`

La politique d'escalade des alarmes, les canaux qu'une étape peut nommer et les chaînes ouvertes en ce moment. `available` vaut `false`, avec une politique désactivée et aucun canal, quand `HOTLOOP_NOTIFY_ENABLED` n'est pas défini ; la réponse reste `200`. Réservé aux administrateurs en lecture comme en écriture : la politique contient les sujets ntfy des personnes, qui sur un serveur accessible à tous sont des mots de passe.

```json
{"available":true,"policy":{"enabled":true,"minPriority":"high","contacts":[{"name":"Ana","ntfyTopic":"ana-phone-3f9c","emails":["ana@plant.test"]}],"steps":[{"afterMinutes":5,"contacts":["Ana"]},{"afterMinutes":10,"channels":["gotify"]}],"repeatEveryMinutes":15,"repeatTimes":2},"channels":["smtp","ntfy","gotify"],"active":[{"alarmId":"boiler-hi","name":"Boiler Trip","raisedAt":"2026-10-21T03:00:00Z","sent":1,"total":4,"nextAt":"2026-10-21T03:15:00Z"}],"limits":{"steps":10,"contacts":50,"repeats":20,"minutes":1440}}
```

`channels` sont ceux que ce HotLoop a configurés, ce qui est tout ce qu'une étape peut nommer. `active` est chaque alarme parcourant la chaîne : combien d'envois sont partis sur combien la politique en compte (étapes, puis répétitions), et quand le suivant est dû. Rien d'enregistré donne `{"policy":{"enabled":false},...}` : désactivée, sans rien dedans.

### `PUT /api/notify/escalation`

Remplace toute la politique, ce n'est pas un correctif partiel, et répond ce que `GET` répondrait. Elle s'applique aux alarmes levées à partir de maintenant. `400` quand les notifications ne sont pas activées.

```json
{"enabled":true,"minPriority":"high",
 "contacts":[{"name":"Ana","ntfyTopic":"ana-phone-3f9c","emails":["ana@plant.test"]}],
 "steps":[{"afterMinutes":5,"contacts":["Ana"]},{"afterMinutes":10,"channels":["gotify"]}],
 "repeatEveryMinutes":15,"repeatTimes":2}
```

`minPriority` vaut `critical`, `high` (par défaut), `medium` ou `low`. Une étape est due `afterMinutes` (de 1 à 1440) après la précédente, la première après la levée, et nomme des `contacts` de la liste, des `channels` que le déploiement a, ou les deux. Au plus 10 étapes, 50 contacts et 20 répétitions. Les champs inconnus sont refusés.

`400` avec la raison quand la politique ne peut pas fonctionner, en mots sur lesquels on peut agir : une étape qui ne nomme personne, un contact qui n'est pas dans la liste, un canal que ce HotLoop n'a pas configuré (la réponse liste ceux qu'il a), un sujet ntfy sans ntfy configuré ou une adresse sans e-mail configuré, une adresse qui n'est pas simple, une répétition sans intervalle. Rien n'est stocké quand elle est refusée. Son enregistrement figure dans le journal système, sans les sujets. Voir [Notifications d'alarmes](/fr/iot/notifications/#escalation).

### `POST /api/notify/ack/{token}`

Le bouton **Acquitter** d'une notification ntfy. Le téléphone qui le presse n'a pas de session à envoyer, donc il n'y a **ni session ni permission** : le jeton signé du chemin est l'autorisation, et tout ce qu'il autorise, c'est acquitter une occurrence d'une alarme, une fois, avant son expiration (`HOTLOOP_NOTIFY_ACK_TTL`, 12 heures par défaut). Un bouton du déplacement d'hier ne peut pas acquitter celle d'aujourd'hui. C'est un `POST` exprès : les aperçus de liens et les scanners de sécurité ouvrent les liens tout seuls, et une alarme ne doit jamais être acquittée par un robot. Pas de corps. Il répond avec l'alarme acquittée (la forme, tirée du gestionnaire ; les autres exemples de ce document ont été capturés sur un Gateway en marche, celui-ci non, parce que ce Gateway n'avait pas ntfy) :

```json
{"acknowledged":true,"alarmId":"extruder-temp-hi","name":"Extruder temperature high","state":"ack-active","ackedBy":"notify:ntfy"}
```

Avec les liens d'acquittement désactivés :

```json
{"error":"acknowledge links are not enabled on this HotLoop (they need HOTLOOP_PUBLIC_URL and a channel that carries a button)"}
```

C'est un acquittement ordinaire par le moteur d'alarmes, audité sous `notify:<channel>`. Chaque refus reçoit une réponse et est journalisé, parce qu'un bouton qui ne fait silencieusement rien ressemble exactement à un bouton que personne n'a pressé :

| Statut | Quand |
|---|---|
| 403 | Falsifié, altéré, ou signé avec un autre secret |
| 404 | L'alarme n'existe plus, ou les liens d'acquittement sont désactivés (ils exigent `HOTLOOP_PUBLIC_URL` et un canal avec un bouton) |
| 409 | Déjà utilisé, l'alarme a été levée de nouveau depuis, ou il ne reste rien à acquitter |
| 410 | Authentique, mais expiré |
| 503 | L'acquittement n'a pas pu être enregistré ; le lien est rendu pour qu'une seconde pression puisse encore fonctionner |

La réponse porte `Access-Control-Allow-Origin: *` pour que l'application web ntfy puisse le presser depuis sa propre origine ; rien sur cette route ne lit de cookie. Le jeton n'est jamais journalisé ni renvoyé nulle part. Voir [Notifications d'alarmes](/fr/iot/notifications/#acknowledge-links).

## Sauvegardes

Des instantanés logiques de la base de données, des seules données de tables. Nécessite `HOTLOOP_BACKUP_ENABLED`. Les deux réservés aux administrateurs : une liste montre le nombre de lignes de chaque table, utilisateurs et sessions compris. **Il n'y a pas de point d'accès de restauration**, exprès : restaurer est une option du binaire, lancée une fois par quelqu'un qui sait que la base est faite pour la recevoir, jamais un appel réseau contre une base en service. Voir [Sauvegardes et restauration](/fr/iot/backup/#restaurer-une-sauvegarde).

### `GET /api/backup`

Les sauvegardes sur le volume, chacune avec son manifeste.

```json
{"backups":[{"name":"20260927T202912Z","bytes":98567,"manifest":{"hotloopVersion":"4.16.0","schemaMigrations":["0001_core.sql","...","0007_service_audit.sql"],"createdAt":"2026-09-27T20:29:12.970721945Z","tables":[{"name":"devices","rows":2,"columns":[{"name":"id","type":"text"},{"name":"...","type":"..."}]}]}}],"configured":true}
```

### `POST /api/backup`

En prend une maintenant et attend (jusqu'à 30 minutes : un gros `tag_history` prend du temps). Pas de corps. Répond le manifeste : version, migrations, et les lignes et colonnes de chaque table.

## Rapports planifiés

Des synthèses de l'historien en CSV et HTML, selon un calendrier, par e-mail ou en téléchargement. Nécessite `HOTLOOP_REPORTS_ENABLED`. Les lecteurs lisent, les opérateurs lancent, les administrateurs définissent : une définition nomme l'endroit où les données de l'usine sont envoyées par e-mail. Voir [Rapports planifiés](/fr/gateway/reports/) pour les champs de la définition.

### `GET /api/reports`

```json
{"configured":true,"reports":[{"id":"line1-hourly","name":"Line 1 hourly","enabled":true,"tags":[{"deviceId":"extruder-1","tagName":"Temperature"},{"deviceId":"extruder-1","tagName":"Pressure"}],"window":{"count":1,"unit":"hours","end":"run_time"},"bucket":"window","aggregations":["min","max","avg"],"schedule":{"kind":"daily","at":"06:00"},"format":"both","recipients":["shift-lead@example.com"],"retain":10,"createdAt":"2026-09-27T20:29:23.300978Z","updatedAt":"2026-09-27T20:29:23.300978Z","nextRunAt":"2026-09-28T06:00:00Z"}],"smtpConfigured":true,"timezone":"UTC"}
```

Chaque définition porte `nextRunAt` et son exécution la plus récente sous `lastRun`.

### `POST /api/reports`

Crée une définition ; le corps est la définition ci-dessus. `201`. `400` si la validation échoue (`"report line1-hourly: window end \"now\" must be run_time or local_midnight"`), `409` si l'identifiant existe.

### `GET /api/reports/{id}`

Une définition, comme dans la liste. `404` pour une définition inconnue.

### `PUT /api/reports/{id}`

Remplace toute la définition. L'identifiant ne peut pas changer (`400` si celui du corps diffère). `nextRunAt` et `lastRun` sont acceptés et ignorés, pour que vous puissiez renvoyer ce que vous avez lu.

### `DELETE /api/reports/{id}`

La supprime avec ses exécutions et ses fichiers, en annulant une exécution en cours. `{"deleted":"line1-hourly"}`, ou `404`.

### `POST /api/reports/{id}/run`

La lance maintenant et attend. `?deliver=false` la génère et la stocke sans envoyer d'e-mail à personne, pour essayer une définition. `200` signifie que l'exécution a eu lieu ; son propre `status` dit si le rapport a fonctionné. Une exécution qui échoue est un résultat, pas une mauvaise requête, et elle est enregistrée dans les deux cas.

```json
{"id":1,"reportId":"line1-hourly","trigger":"manual","actor":"admin","status":"succeeded","startedAt":"2026-09-27T20:29:54.06926Z","finishedAt":"2026-09-27T20:29:54.092456655Z","windowStart":"2026-09-27T19:29:54.06926Z","windowEnd":"2026-09-27T20:29:54.06926Z","tags":2,"rows":2,"readings":984,"excluded":2,"files":[{"format":"csv","name":"20260927T202954Z-1.csv","bytes":338},{"format":"html","name":"20260927T202954Z-1.html","bytes":2430}],"emailStatus":"skipped","emailTo":["shift-lead@example.com"]}
```

`400` pour un `deliver` qui n'est ni true ni false, `404` pour un rapport inconnu.

### `GET /api/reports/{id}/runs`

`{"runs": [...]}`, du plus récent au plus ancien, `?limit=` 50 par défaut, au plus 500. `404` pour un rapport inconnu, pas une liste vide.

### `GET /api/reports/{id}/runs/{run}/download`

Diffuse un fichier stocké comme pièce jointe. `?format=csv` ou `html`.

```
HTTP/1.1 200 OK
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="20260927T202954Z-1.csv"
Cache-Control: private, no-store

device_id,tag_name,unit,period_start,period_end,min,max,avg,excluded
extruder-1,Temperature,C,2026-09-27T19:29:54+00:00,2026-09-27T20:29:54+00:00,19.50001230192043,23.499980145373126,21.508905654397623,1
```

Le HTML est servi avec une Content-Security-Policy `sandbox` : un rapport est un document à lire, pas une page qui a le droit d'exécuter quoi que ce soit. Le fichier ouvert est celui que nomme l'enregistrement de l'exécution ; rien dans l'URL ne devient une partie d'un chemin. `400` pour un numéro d'exécution qui n'en est pas un ou un format qui n'est aucun des deux, `404` pour une exécution ou un fichier qui n'existe pas.

## Sites

### `GET /api/sites`

Chaque site que le Gateway fédère, interrogé sur son état d'usine par MCP en parallèle, 6 secondes chacun, pour qu'un site mort ne retienne pas les autres. Les sites sont les serveurs MCP sortants de la config. Voir [MCP](/fr/iot/mcp/#federating-sites).

```json
{"configured":true,
 "rollup":{"sites":2,"reachable":1,"devices":2,"connected":2,"tags":5,"outstandingAlarms":1,"unacknowledgedAlarms":1,"criticalAlarms":0},
 "sites":[{"name":"plant-a","reachable":true,"latencyMs":14,"plant":"Demo Plant","uptime":"1m25s","devices":2,"connected":2,"degraded":0,"disconnected":0,"tags":5,"outstandingAlarms":1,"unacknowledgedAlarms":1,"criticalAlarms":0,"writesEnabled":true},
          {"name":"plant-c","reachable":false,"error":"connect to MCP server \"plant-c\": calling \"initialize\": ... no such host","latencyMs":49,"devices":0,"connected":0,"degraded":0,"disconnected":0,"tags":0,"outstandingAlarms":0,"unacknowledgedAlarms":0,"criticalAlarms":0,"writesEnabled":false}]}
```

Les comptes d'un site injoignable ne signifient rien et sont laissés hors du total : compter à zéro alarme un site qu'on ne peut pas joindre serait la chose la plus dangereuse que cet écran pourrait faire. Sans aucun site configuré : `{"configured":false,"sites":[]}`.

## Paramètres

### `GET /api/settings`

Chaque paramètre, sa valeur effective, d'où la valeur vient et la variable qui le définit :

```json
{"groups":["Plant","Safety","Polling","Historian","Database","MCP","Server"],
 "settings":[{"key":"ui.plantName","group":"Plant","label":"Plant name","help":"...","value":"Demo Plant East","kind":"string","source":"stored","envVar":"HOTLOOP_PLANT_NAME","editable":true},
             {"key":"safety.allowWrites","group":"Safety","label":"Writes allowed","help":"...","value":true,"kind":"bool","source":"environment","envVar":"HOTLOOP_ALLOW_WRITES","editable":false},
             {"key":"database.password","group":"Database","label":"Password","help":"Never shown. It comes from the release Secret.","value":"set","kind":"secret","source":"environment","envVar":"HOTLOOP_DB_PASSWORD","editable":false}]}
```

`source` vaut `stored`, `environment` ou `default`. Un `secret` est seulement `set` ou `not set`. `envVar` est la variable d'où la valeur est venue. Quelques paramètres se rabattent sur une seconde variable quand celle en `HOTLOOP_` est vide (`TZ` pour le fuseau horaire, `POSTGRES_HOST`, `POSTGRES_DB`, `POSTGRES_USER` et `POSTGRES_PASSWORD` pour la base de données), et quand c'est le repli qui est en vigueur, `envVar` le nomme. Une variable définie à une chaîne vide compte comme non définie, comme la config la traite. Les paramètres d'interrogation sont affichés en millisecondes, mais leurs variables acceptent une durée (`5s`, `500ms`) ou un simple nombre de secondes.

`product` dans le groupe `Server` dit de quel HotLoop il s'agit. Une fonction que ce produit n'a pas et que le déploiement a activée quand même (par exemple `HOTLOOP_REPORTS_ENABLED=true` sur IoT) n'empêche pas son démarrage. Elle est journalisée comme avertissement au démarrage et listée ici dans un groupe supplémentaire, `Not in this product`, avec sa variable et une ligne disant où elle se trouve. Le paramètre est laissé exactement tel quel, de sorte que la même configuration sur un produit qui a la fonction l'active. Quand rien de tel n'est défini, le groupe n'est pas là.

### `PUT /api/settings`

Modifie les paramètres d'identité de l'usine, et seulement ceux-là :

| Clé | Type |
|---|---|
| `ui.plantName` | chaîne, d'au plus 200 caractères |
| `ui.siteId` | chaîne, d'au plus 200 caractères |
| `ui.timezone` | un nom IANA que cette machine connaît (`America/Chicago`) |
| `ui.confirmWrites` | bool |
| `ui.kioskIdleSeconds` | un nombre entier de secondes, de 10 à 43200 : combien de temps une connexion de borne survit sans que personne touche le panneau. 900 par défaut |
| `ui.lockoutAttempts` | un nombre entier, de 0 à 100 : mots de passe ou codes PIN erronés d'affilée qui verrouillent un compte. 10 par défaut, et 0 signifie pas de verrouillage |
| `ui.panelDelaySeconds` | un nombre entier de secondes, de 0 à 30 : le temps maximal qu'un panneau de borne attend avant de vérifier le code PIN suivant saisi sans nom d'utilisateur, après des codes erronés. 3 par défaut, et 0 signifie pas d'attente |
| `ui.lockoutSeconds` | un nombre entier de secondes, de 10 à 86400 : combien de temps un compte verrouillé reste verrouillé. 300 par défaut |

```json
{"ui.plantName":"Demo Plant East","ui.timezone":"America/Chicago"}
```

Répond tous les paramètres, comme `GET`. Toute autre clé donne un 400 qui la nomme :

```json
{"error":"safety.allowWrites is set by the deployment and cannot be changed here"}
```

C'est voulu. Les interrupteurs d'écriture décident si ce processus peut mouvoir des machines, et un contrôle qu'on peut activer depuis le navigateur même qui émet les écritures n'est pas un contrôle. Les changer est un déploiement.

## Cibles de l'historien

Les bases de données propres à l'usine, dans lesquelles HotLoop écrit son historique en plus de la sienne. Voir [Cibles de l'historien](/fr/iot/historian-targets/). Tout rôle qui lit les paramètres les voit, ainsi que la façon dont chacune se porte. En modifier une est réservé aux administrateurs, parce qu'une cible est un endroit où vont les données de l'usine. Les mots de passe sont scellés avec la clé d'identifiants d'appareil (`HOTLOOP_SECRET_KEY_FILE`) et jamais renvoyés ; `passwordSet` dit si un est stocké, et `passwordProblem` pourquoi un mot de passe stocké ne peut pas être ouvert. Chaque changement va dans le journal et prend effet immédiatement.

### `GET /api/historian/targets`

```json
{"secretKey":true,
 "kinds":[{"id":"postgres","title":"PostgreSQL or TimescaleDB","defaultPort":5432,"defaultTable":"hotloop_history",
    "databaseLabel":"Database","tableLabel":"Table","passwordLabel":"Password","usesUsername":true,"usesOrg":false},
   {"id":"sqlserver","title":"Microsoft SQL Server","defaultPort":1433,"defaultTable":"hotloop_history",
    "databaseLabel":"Database","tableLabel":"Table","passwordLabel":"Password","usesUsername":true,"usesOrg":false},
   {"id":"mysql","title":"MySQL or MariaDB","defaultPort":3306,"defaultTable":"hotloop_history",
    "databaseLabel":"Database","tableLabel":"Table","passwordLabel":"Password","usesUsername":true,"usesOrg":false},
   {"id":"influxdb","title":"InfluxDB 2 or 3","defaultPort":8086,"defaultTable":"hotloop_history",
    "databaseLabel":"Bucket (InfluxDB 3: database)","tableLabel":"Measurement","passwordLabel":"API token",
    "usesUsername":false,"usesOrg":true}],
 "targets":[{"id":"plant-pg","name":"Plant historian","kind":"postgres","address":"db.plant.local:5432",
   "database":"plant","username":"hotloop","table":"hotloop_history","useTls":true,"insecureSkipVerify":false,
   "enabled":true,"createdBy":"admin","passwordSet":true,"createdAt":"2026-10-03T09:12:04Z","updatedAt":"2026-10-03T09:12:04Z",
   "status":{"state":"down","since":"2026-10-03T10:02:11Z","queued":50000,"queueCap":50000,"written":182340,
     "backfilled":0,"dropped":1210,"refused":0,"lastWrite":"2026-10-03T10:02:10Z",
     "lastError":"failed to connect to `user=hotloop database=plant`: dial tcp 10.20.0.9:5432: connect: connection refused",
     "owedFrom":"2026-10-03T10:02:09Z"}}]}
```

`kinds` sont les bases de données dans lesquelles ce HotLoop écrit, et comment chacune appelle ses champs : InfluxDB a un jeton là où les autres ont un mot de passe (`password` le porte), un bucket là où elles ont une base de données (`database`), une mesure là où elles ont une table (`table`), et une organisation (`org`) qu'aucune autre n'a. `status.state` vaut `up`, `catching-up` (actif, et envoyant encore ce qu'on lui doit depuis l'historique propre de HotLoop), `down`, `starting` ou `off` (désactivé). `queued` est ce qui attend en mémoire, sur `queueCap`. `written` compte les lectures envoyées en direct et `backfilled` celles envoyées depuis l'historique propre de HotLoop. `dropped` compte les lectures que la file a lâchées pendant que la cible ne suivait pas : elles sont dues, pas perdues. `refused` compte les lectures que la base elle-même n'a pas voulu prendre, avec sa raison dans `lastRefusal`. `owedFrom` et `owedTo` sont ce qui est encore dû ; `owedTo` est absent tant que la fin reste ouverte, ce qui dure autant que la cible est en panne.

### `POST /api/historian/targets`

```json
{"id":"plant-pg","name":"Plant historian","kind":"postgres","address":"db.plant.local","database":"plant",
 "username":"hotloop","password":"...","useTls":true}
```

`id` fait de 1 à 63 lettres minuscules, chiffres et `-`, et nomme la cible dans le journal système. `address` est `host` ou `host:port`, sans identifiant dedans ; le port par défaut du type complète un port manquant. `table` vaut par défaut le `defaultTable` du type et peut porter un schéma (`history.hotloop`). `org` est l'organisation d'InfluxDB 2. `enabled` vaut true par défaut. Un mot de passe a besoin d'une clé : sans `HOTLOOP_SECRET_KEY_FILE` c'est un `400`, jamais stocké en clair. `201` avec la cible et son statut ; `409` pour un identifiant déjà pris.

### `PUT /api/historian/targets/{id}`

N'importe lequel des champs ci-dessus sauf `id` ; ce qui n'est pas envoyé reste. `"password":""` efface le mot de passe. Un changement redémarre la cible avec ses nouveaux paramètres, et ce qui lui était dû reste dû. `200` avec la cible.

### `DELETE /api/historian/targets/{id}`

Cesse d'y écrire et oublie ce qui lui était dû. Ce qu'elle contient déjà reste dans sa base de données. Désactivez-la plutôt avec `"enabled":false` pour garder les paramètres. `200` `{"deleted":"plant-pg"}`.

## Journal système

### `GET /api/events`

Chaque changement, écriture, connexion et transition de connexion, du plus récent au plus ancien.

| Requête | <span class="sr-only">Détails</span> |
|---|---|
| `category` | Répétable : `system`, `device`, `tag`, `write`, `alarm`, `automation`, `mcp`, `config`, `auth` |
| `severity` | Répétable : `debug`, `info`, `warning`, `error` |
| `subject` | Exactement : un identifiant d'appareil, une clé de tag, un entity_id, `equipment:4`, `label:critical` |
| `q` | Recherche insensible à la casse |
| `minutes` | Seulement les N dernières minutes |
| `limit` | 200 par défaut, au plus 5000 |

```json
[{"id":61,"at":"2026-09-27T20:29:23.303795Z","severity":"info","category":"config","subject":"line1-hourly","actor":"admin","message":"report created"}]
```

`actor` est un utilisateur, `system`, `automation:<id>` ou `mcp:<client>`. `detail`, quand il y en a un, est du JSON supplémentaire sous forme de chaîne.

## Journal de bord

### `GET /api/logbook`

Une seule chronologie de ce qui s'est passé, du plus récent au plus ancien : changements d'état d'entités, écritures, transitions d'alarmes, exécutions d'automatisations et de scripts, et changements de configuration et appels de service issus du journal système. Les pistes sont lues là où elles sont et fusionnées, donc chacune garde sa propre rétention. Les lectures numériques n'y figurent pas : c'est à quoi sert `GET /api/history`. Voir [le journal de bord](/fr/iot/logbook/).

| Requête | <span class="sr-only">Détails</span> |
|---|---|
| `entity` | Seulement ce qui concerne cette entité : ses changements d'état, les écritures sur elle et sur ses tags, ses alarmes, les exécutions d'automatisations qu'elle déclenche ou qui ont écrit sur elle, les changements de config qui la touchent |
| `equipment_id` | Seulement ce qui s'est passé à ce nœud de l'arborescence des équipements ou en dessous, selon la même règle. Pas avec `entity` |
| `actor` | Partie, insensible à la casse, de qui l'a fait : un utilisateur, `automation:<id>`, `mcp:<client>` |
| `kinds` | Séparés par des virgules ou répétés : `state`, `write`, `alarm`, `automation`, `event`, `script`, `recipe` |
| `from`, `to` | Heures RFC 3339 ; `from` inclus, `to` exclu |
| `limit` | 100 par défaut, au plus 1000 |
| `before` | Le `next` de la page précédente |

```json
{"entries":[
  {"at":"2026-09-28T09:14:02.51Z","kind":"state","id":41,"severity":"info","message":"changed to on (was off)","entity_id":"switch.tank_farm_pump","old_state":"off","state":"on","quality":"good"},
  {"at":"2026-09-28T09:14:02.18Z","kind":"write","id":88,"severity":"info","message":"wrote true to tank-farm/pump (switch.turn_on on switch.tank_farm_pump) (was 0)","actor":"admin","source":"ui","entity_id":"switch.tank_farm_pump","device_id":"tank-farm","tag":"tank-farm/pump","call_id":"5c9f8545a93b5443"},
  {"at":"2026-09-28T09:13:40.02Z","kind":"state","id":37,"severity":"info","message":"changed to closed (was open); 14 changes before this not logged, it was changing faster than the logbook records","entity_id":"valve.infeed","old_state":"open","state":"closed","quality":"good","suppressed":14}
 ],
 "next":"MjAyNi0wOS0yOFQwOToxMzo0MC4wMlp8c3RhdGV8Mzc"}
```

`id` est l'identifiant de la ligne dans sa propre piste (pour un changement d'état, l'identifiant immuable de l'entité), et avec `at` et `kind` c'est ce que `next` encode : la page suivante est tout ce qui est strictement plus ancien dans cet ordre, quoi qu'on ait ajouté entre-temps. `next` est omis sur la dernière page. `suppressed` est le nombre de changements de cette entité avant celui-ci qui n'ont pas été journalisés, parce qu'elle changeait plus vite que dix d'un coup puis un toutes les deux secondes.

`400` pour un type inconnu, une heure mal formée, `from` pas avant `to`, une limite supérieure à 1000, un curseur inventé, ou `entity` et `equipment_id` ensemble ; `404` pour un nœud qui n'existe pas. `503` quand le journal de bord ne tourne pas dans le processus qui répond.

## Flux en direct

### `GET /api/stream`

Des événements envoyés par le serveur, à sens unique, tant que vous le gardez ouvert. SSE plutôt qu'un WebSocket parce que le trafic ne va que dans un sens, et qu'un flux d'événements se reconnecte tout seul quand le pod redémarre sous un tableau de bord ouvert. `EventSource` envoie le cookie de session ; un script envoie le jeton bearer.

À la connexion vous recevez `retry: 3000` puis l'image courante, pour qu'un écran soit rempli avant que quoi que ce soit change :

```
retry: 3000

event: snapshot
data: [{"deviceId":"extruder-1","protocol":"opcua","tagName":"Temperature","tagValue":19.553128777917983,"unit":"C","quality":"good","timestamp":"2026-09-27T20:34:23.619589Z"}]

event: alarms
data: {"alarms":[...outstanding alarms...],"summary":{"critical":0,"high":1,"medium":0,"low":0,"unacked":0,"total":1}}

event: entities
data: {"changed":[...every entity state...],"removed":[]}
```

Puis, au fil des événements :

| Événement | Données | Quand |
|---|---|---|
| `values` | Un tableau de lectures, la forme de `GET /api/values`, la plus récente par tag, **seulement les tags dont la lecture a changé** | Toutes les 250 ms, si certains ont changé. Un tag dont la valeur, le texte, l'unité, la qualité et la raison sont les mêmes que ceux du dernier envoi est laissé de côté, et renvoyé une fois qu'il a passé 30 secondes sans envoi, de sorte que le `timestamp` d'une valeur stable n'a jamais plus que cet âge. Un pilote lit chaque tag à chaque interrogation ; la 4.19.5 les envoyait tous à chaque fois (environ 150 Ko quatre fois par seconde pour les 2232 tags d'un banc de test) et une page sur une liaison lente prenait des minutes de retard |
| `entities` | `{"changed": [states], "removed": [entity_ids]}` | Toutes les 250 ms, si l'état d'une entité a changé. `removed` est une entité désactivée, supprimée ou renommée |
| `alarm` | `{"alarm": {...}, "event": "shelved"}`, l'alarme et ce qui lui est arrivé (`raised`, `acked`, `cleared`, `shelved`, `unshelved`, `suppressed`, `unsuppressed`) | Immédiatement : les transitions d'alarme sont rares et chacune compte |
| `device` | `{"deviceId":"tank-farm","state":"connected"}` | Immédiatement : l'écran doit passer au rouge quand un appareil tombe, pas au prochain envoi groupé |
| `logbook` | `{"kinds":["state","write"]}`, quels types d'entrée du journal de bord ont du nouveau | Au plus une fois par seconde. Sans entrées dedans, parce que ce qu'un écran doit montrer dépend de ses filtres : il demande à `GET /api/logbook` sa propre page |

```
event: alarm
data: {"alarm":{"definitionId":"extruder-temp-hi","state":"shelved","shelvedUntil":"2026-09-27T20:39:45.839983854Z","shelvedBy":"admin","...":"..."},"event":"shelved"}

event: device
data: {"deviceId":"tank-farm","state":"connected"}
```

Une ligne de commentaire (`: heartbeat 2026-09-27T20:35:00Z`) toutes les 20 secondes empêche les proxys de fermer une connexion inactive. Chaque page ouverte est cadencée à part : son rédacteur se repose aussi longtemps que son dernier envoi a duré (au plus cinq secondes), et ce qui arrive entre-temps est retenu par tag et par entité, le plus récent seulement, de sorte qu'une page sur une liaison lente reste en retard d'un envoi ou deux sur l'usine, jamais de minutes, ne perd rien, et ne prend rien aux autres pages. Le flux est compressé en gzip quand la requête dit `Accept-Encoding: gzip` (un navigateur le fait), ce qui ramène la première image d'un banc de test d'environ 326 Ko à environ 11 Ko sur le réseau. La réponse définit `X-Accel-Buffering: no`, parce qu'un proxy qui met en tampon transforme un flux en direct en un très lent téléchargement.

Le flux regarde de nouveau sa session toutes les cinq secondes et se ferme quand la session a disparu : déconnectée, expirée, révoquée, ou compte désactivé ou n'ayant plus le droit `status.read`. Il n'envoie aucun événement avant. L'`EventSource` d'un navigateur se reconnecte, reçoit le `401` ci-dessus, et s'arrête. Avec `HOTLOOP_AUTH_INSECURE=true` il n'y a pas de session et rien à vérifier. La vérification ne compte pas comme une utilisation de la session, donc un écran laissé ouvert ne garde pas une session fraîche.

## MCP

### `/mcp` et `/mcp/`

Le Model Context Protocol, transport HTTP en streaming, pour les agents. N'importe quelle méthode : le transport utilise `POST` pour les appels, `GET` pour le flux propre du serveur et `DELETE` pour terminer une session. Le chemin est `HOTLOOP_MCP_PATH` (`/mcp` par défaut) et le point d'accès n'est là que quand `HOTLOOP_MCP_ENABLED` est activé.

Il n'est **pas** derrière la connexion de session. Il a son propre jeton bearer, `HOTLOOP_MCP_TOKEN`, vérifié devant le gestionnaire pour qu'un appelant qui ne l'a pas ne puisse même pas lister les outils :

```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="hotloop"

unauthorized
```

Sans jeton configuré, HotLoop en crée un à son premier démarrage et le garde dans sa base de données (`hotloop mcp-token` l'affiche), de sorte que le point d'accès n'est jamais ouvert. Un agent est un appelant comme un autre : il lit et écrit, ses écritures passent par la même porte d'écriture que celles de tout le monde, et elles sont auditées sous `mcp:<client name>`. Les outils et les ressources sont dans [MCP](/fr/iot/mcp/).

```
POST /mcp
Authorization: Bearer <token>
Accept: application/json, text/event-stream

{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1"}}}
```

répond avec un en-tête `Mcp-Session-Id` et les capacités et instructions du serveur.

## L'interface

### `GET /manifest.webmanifest`

Le manifeste d'application web qui permet à un téléphone d'installer l'interface comme une application : le nom du produit et de l'usine, `display` `standalone`, les couleurs du thème, les icônes (PNG de 192 et 512 pixels, un 512 masquable et le SVG) et des raccourcis vers Alarmes et Tableaux de bord. Chaque URL qu'il contient est relative à celle du manifeste lui-même, donc elle est juste où que HotLoop soit monté. Le nom suit le nom d'usine défini dans Paramètres, et la réponse est `Cache-Control: no-cache` pour qu'un renommage se voie au prochain coup d'œil. Pas de session : un téléphone demande avant que quiconque se soit connecté. Voir [Tableaux de bord](/fr/iot/dashboards/#sur-un-téléphone).

### `GET /sw.js`

Le service worker, à la racine de l'endroit où HotLoop est monté pour que sa portée couvre toute l'application. Il garde la page et la dernière réponse aux lectures qu'une personne consulte, et les renvoie marquées comme anciennes quand HotLoop est injoignable. Il ne répond, ne garde ni ne met jamais en file une écriture. La version en cours d'exécution y figure, donc chaque version a son propre cache de pages. `Cache-Control: no-cache` ; pas de session. Seul un navigateur dans un contexte sécurisé (https, ou `localhost`) l'exécute.

### `GET /next` et `GET /next/`

L'endroit où vivait l'interface quand l'ancienne était celle par défaut. Les deux sont un `301` vers la racine, donc un favori fait à l'époque arrive toujours.

### `/`

L'interface web, compilée depuis `web/` dans le binaire : une page, ses scripts, styles et polices, un service worker et les icônes de l'application installable, chaque URL y étant relative à la page pour qu'elle tourne à la racine d'un hôte, sous un chemin, derrière un proxy ou dans l'iframe du tableau de bord EmberNet. Le serveur remplit le titre et un bloc de données, `<script type="application/json" id="iiot">`, avec ce que lui seul sait : l'usine, le site, le produit, les fonctions, la politique d'écriture et le fuseau horaire. `GET` et `HEAD` seulement ; toute autre méthode est `405`. Un chemin qui n'est pas l'un de ses fichiers est un `404`, parce que servir la page pour une faute de frappe la ferait passer pour un écran qui marche, et un binaire compilé sans l'interface le dit en texte brut ainsi que comment le compiler. Pas de session : la page est le formulaire de connexion tant que vous ne vous connectez pas.
