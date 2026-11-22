---
title: "Gouverner une instance Cascade"
description: "Variables, dossiers, exécutions annotées, masquage, insights, secrets externes et envoi des logs, pour une usine qui accumule des flux de travail."
---

Comment une usine garde le contrôle d'une pile croissante de flux de travail : paramètres partagés, dossiers, exécutions annotées, masquage, chiffres dans le temps, secrets externes, envoi des logs et emplacement des données volumineuses. Tout cela est gratuit et présent dans chaque build.

Chaque endpoint nommé ci-dessous figure dans le document OpenAPI à `/api/v1/openapi.json`, et chacun a un test qui l'appelle, sur SQLite et sur Postgres.

## Variables

Dans l'éditeur : Variables, dans la barre du haut. Celles de toute l'instance sont en haut, et celles de chaque projet sous son nom. Seul ce que votre rôle autorise est proposé.

Une variable est une valeur nommée qu'un flux de travail lit sous la forme `vars.NAME` : un plafond de consigne, le nom d'une usine, une URL de base qui diffère entre la ligne pilote et la vraie.

```yaml
- name: Check limit
  type: core.if
  version: 1
  params:
    condition: "{{ item.json.temp > toNumber(vars.TEMP_LIMIT) }}"
```

- Une variable est **à l'échelle de l'instance** ou appartient à **un projet**. Quand les deux portent un nom, celle du projet l'emporte, et seulement pour les flux de travail de ce projet.
- Une valeur est du texte, jusqu'à 8 KiB. Utilisez `toNumber(vars.X)` quand il vous faut un nombre.
- Un nom se compose de lettres, de chiffres et de tirets bas, commence par une lettre ou un tiret bas et compte jusqu'à 64 caractères, car il doit se lire `vars.NAME`.
- **Les variables ne sont pas des secrets.** Quiconque peut lire le projet lit ses variables, et la valeur n'est pas effacée des données d'exécution. Un mot de passe, un jeton ou une clé va dans le coffre des identifiants, ou dans un magasin de secrets externe (ci-dessous).
- Une exécution lit ses variables au démarrage, et de nouveau si elle reprend après une attente ou un redémarrage. Un changement atteint l'exécution suivante, pas une exécution déjà au milieu d'une étape. Un nom qui n'existe pas se lit comme rien, pas comme une erreur.

| Appel | Ce qu'il fait |
|---|---|
| `GET /api/v1/variables` | Les variables de l'instance et celles des projets que vous pouvez lire ; `?project=` limite à un projet. |
| `POST /api/v1/variables` | En crée une. Avec `projectId`, elle est au projet, sans, elle est à l'échelle de l'instance. |
| `PUT /api/v1/variables/{variable}` | Modifie son nom et sa valeur. |
| `DELETE /api/v1/variables/{variable}` | La supprime. |

Qui peut : dans un projet, l'autorisation `variable.read` les liste et `variable.create`, `variable.update` et `variable.delete` les modifient. Les viewers et les operators lisent, les editors et les admins modifient. Les variables à l'échelle de l'instance sont lisibles par toute personne connectée, car le flux de travail de n'importe quel projet peut les lire, et seul un propriétaire ou un administrateur de l'instance les modifie. Un rôle personnalisé peut porter n'importe laquelle de ces quatre autorisations. Les changements figurent dans le journal d'audit sous `variable.created`, `variable.updated` et `variable.deleted`, avec le nom et jamais la valeur.

## Dossiers

Dans l'éditeur : la liste des flux de travail, ce sont les dossiers. Créez-en un avec Nouveau dossier, imbriquez-le avec Ajouter un sous-dossier, et déplacez un flux de travail depuis sa propre ligne de la liste. Choisir un dossier en créant un flux de travail l'y place.

Les dossiers regroupent les flux de travail d'un projet et s'imbriquent, comme est organisée une usine : zone, ligne, cellule.

- Un dossier appartient à un projet. Les noms sont uniques parmi les dossiers voisins, et un nom compte jusqu'à 100 caractères.
- Les dossiers s'imbriquent sur 10 niveaux au plus.
- Un flux de travail est dans un dossier ou à la racine de son projet. Enregistrer une nouvelle version ne le déplace pas.
- Un dossier qui contient des flux de travail ou des dossiers ne peut pas être supprimé (409), donc supprimer un dossier n'est jamais la façon dont un flux de travail disparaît. Un dossier ne peut pas être déplacé dans lui-même ni dans l'un de ses propres sous-dossiers, ni vers un autre projet.

| Appel | Ce qu'il fait |
|---|---|
| `GET /api/v1/folders` | Les dossiers des projets que vous pouvez lire, à plat, chacun avec son `parentId` ; `?project=` limite. |
| `POST /api/v1/folders` | En crée un dans `projectId`, à l'intérieur de `parentId` ou à la racine. |
| `PATCH /api/v1/folders/{folder}` | Le renomme, ou le déplace avec `parentId` (chaîne vide pour la racine). |
| `DELETE /api/v1/folders/{folder}` | Supprime un dossier vide. |
| `PUT /api/v1/workflows/{workflow}/folder` | Place un flux de travail dans un dossier, ou à la racine avec un `folderId` vide. |
| `GET /api/v1/workflows?folder=` | Les flux de travail d'un dossier, ou `folder=none` pour la racine de chaque projet. |

Chaque flux de travail renvoyé par l'API indique son `folderId`. Les autorisations `folder.read`, `folder.create`, `folder.update` et `folder.delete` fonctionnent comme celles des variables, et déplacer un flux de travail demande `workflow.update`. Les changements de dossier figurent dans le journal d'audit, et les déplacements sous `workflow.moved`.

## Annotations d'exécution

Dans l'éditeur : la page de chaque exécution a une zone Annotation avec un pouce levé ou baissé, une note et des étiquettes, et la liste des exécutions filtre par étiquette et par vote.

Une personne peut dire quelque chose d'une exécution après coup : un pouce levé ou baissé, une note, et des étiquettes pour la retrouver. « Premier bon lot après le changement de matrice » et `scrap` sont le genre de choses qui vont ici.

```sh
curl -X PUT $CASCADE/api/v1/executions/$RUN/annotation -H "Authorization: Bearer $KEY" \
  -d '{"vote":"up","note":"first good batch after the die change","tags":["die-change","first-shift"]}'
```

- Un vote est `up`, `down` ou vide. Une note compte jusqu'à 2000 caractères. Une exécution a jusqu'à 20 étiquettes, de 1 à 40 caractères chacune, sans caractères de contrôle, listées une seule fois.
- `PUT` remplace toute l'annotation, envoyez donc tout ce que vous voulez garder. Une annotation qui ne dit rien équivaut à aucune. `DELETE /api/v1/executions/{execution}/annotation` l'efface.
- Chaque exécution renvoyée par l'API porte son annotation, et la liste la porte sur chaque ligne. `GET /api/v1/executions?tag=scrap` et `?vote=down` filtrent, et se combinent avec les autres filtres.
- L'annotation enregistre qui l'a laissée et quand, à partir de la même identité que celle du journal d'audit.
- Annoter demande l'autorisation `execution.annotate`, que les operators, les editors et les admins ont et que les viewers n'ont pas. Les viewers lisent les annotations.
- Une annotation disparaît avec la suppression de son exécution. Le journal d'audit garde `execution.annotated` et `execution.annotation_cleared` avec le vote et les étiquettes, et note seulement qu'une note a été laissée, pas ce qu'elle disait.

## Conserver les exécutions terminées

Dans l'éditeur : Paramètres, Conserver les exécutions terminées pendant (jours). Par l'API : `PATCH /api/v1/settings` avec `{"retentionDays": 90}`, ce qui demande l'autorisation `instance.settings` comme le reste des paramètres.

Par défaut, chaque exécution terminée est conservée pour toujours, comme avant. Définissez un nombre de jours et un processus main supprime, une fois par heure, les exécutions terminées (réussies, échouées ou annulées) qui ont fini il y a plus longtemps que cela, avec les données de leurs étapes. 0 le désactive de nouveau.

- Une exécution en file d'attente, en cours ou en attente n'est jamais touchée, ni une exécution dont le parent est toujours actif, car le parent va demander ce qu'elle a fait.
- Chaque lot d'au plus 500 exécutions est sa propre transaction et écrit une ligne `execution.pruned` dans le journal d'audit, avec le nombre supprimé et la date limite. Modifier le paramètre écrit `instance.retention`.
- Chaque processus main exécute le passage, et deux à la fois trouvent seulement moins à faire.
- Le nettoyage des blobs suit le même passage, et s'exécute une fois par heure que la rétention soit activée ou non, de sorte qu'une exécution supprimée à la main est aussi nettoyée. Voir « Nettoyage des blobs » ci-dessous.

## Limiter une clé d'API

Dans l'éditeur : Paramètres, Requêtes d'API par clé et par minute. Par l'API : `PATCH /api/v1/settings` avec `{"apiRateLimit": 120}`, avec l'autorisation `instance.settings`.

Par défaut, une clé peut appeler aussi souvent qu'elle le veut. Définissez un nombre et chaque clé d'API, et chaque agent connecté par MCP avec l'une d'elles, peut faire ce nombre de requêtes par minute. Un appel au-dessus de la limite reçoit un `429` avec un en-tête `Retry-After` qui indique combien de secondes attendre. Chaque clé a son propre compteur, donc un script emballé ne peut pas épuiser celui d'une autre. Les personnes connectées à l'éditeur n'y sont pas soumises.

Le compteur est propre à chaque processus, car c'est ce qui protège le processus : avec trois processus main, une clé peut faire jusqu'à trois fois ce nombre, répartis entre eux. Un changement du paramètre atteint chaque processus main en cinq secondes. Le modifier écrit `instance.api_rate_limit` dans le journal d'audit, avec l'ancien et le nouveau nombre.

Un webhook a sa propre limite, définie sur le déclencheur, et un compte se verrouille après des mots de passe erronés répétés ; ni l'un ni l'autre ne change.

## Sauvegarde et restauration

```
hotloop-cascade backup /backups/2026-11-20
hotloop-cascade restore /backups/2026-11-20
```

`backup` écrit un nouveau répertoire contenant une copie cohérente de la base SQLite (prise pendant que le serveur tourne, avec `VACUUM INTO`), le fichier de clé qui scelle chaque identifiant stocké, les fichiers de blobs et `manifest.json` avec le SHA-256 de chacun. Il accepte les mêmes paramètres `--database`, `--key-file` et `--blob-dir` que le serveur, depuis les mêmes variables d'environnement. Le répertoire ne doit pas encore exister, ou doit être vide ; une sauvegarde n'est jamais mélangée à une ancienne. Sans fichier de clé, il n'y a pas de sauvegarde, car une base sans sa clé contient des identifiants que personne ne peut lire.

`restore` les remet en place, et le serveur doit d'abord être arrêté. Il vérifie chaque fichier par rapport au manifeste avant d'écrire quoi que ce soit, de sorte qu'une sauvegarde endommagée ou incomplète ne change rien. Il refuse d'écraser une base, ou un fichier de clé différent, déjà présents ; `--replace` dit que vous le voulez vraiment. Démarrez ensuite le serveur : il met le schéma à jour, et refuse une sauvegarde faite par une version plus récente que la sienne.

PostgreSQL : `backup` écrit la clé, les blobs et le manifeste, et affiche la commande `pg_dump --format=custom` qui produit la part de la base de données, car ce programme est celui de PostgreSQL et l'image de Cascade ne l'inclut pas. `restore` remet la clé et les blobs en place et affiche la commande `pg_restore`. Les blobs conservés dans S3 ou Azure ne sont pas copiés ; sauvegardez le bucket à cet endroit.

Avant de mettre à niveau vers une version qui migre, faites-en une : les migrations ne vont que vers l'avant, et revenir à l'ancienne image demande la sauvegarde.

## Politiques de masquage des exécutions

Dans l'éditeur : Paramètres, Masquage crée les politiques. Un flux de travail en choisit une dans le panneau latéral de l'éditeur, sans rien sélectionner, sous Paramètres du flux de travail.

Le coffre des identifiants garde déjà les secrets hors de tout ce qu'une exécution stocke. Une politique de masquage sert aux données qui ne sont pas un identifiant mais n'ont pas leur place non plus dans l'historique d'exécution : un numéro de badge, le nom d'un opérateur, un numéro de carte arrivé par un webhook.

Une politique est un nom et des règles :

- **fields** : des noms de clés d'éléments. Une clé qu'une politique nomme voit toute sa valeur remplacée par `[redacted]`, à toute profondeur, quel que soit le type de la valeur. La comparaison ignore la casse, et `*` et `?` servent de jokers, de sorte que `*secret*` prend `plant_secret` et `SecretKey`.
- **patterns** : des expressions régulières, dans la syntaxe RE2 de Go. Chaque correspondance dans n'importe quel texte est remplacée par `[redacted]`. Un motif qui correspond au texte vide est refusé.
- **steps** : facultatif. La politique ne couvre que les étapes listées. Vide signifie toutes les étapes.
- **appliesToAll** : facultatif. La politique couvre tous les flux de travail, qu'ils la nomment ou non.

Un flux de travail en choisit une par son nom dans ses paramètres :

```yaml
settings:
  redaction: Badges
```

Ce qu'elle fait et quand :

- Elle s'exécute **quand l'exécution se termine**, dans la même transaction qui la marque terminée : réussie, échouée ou arrêtée. Jusque-là, l'exécution a ses vraies données, car l'étape suivante en a besoin et un redémarrage reprend à partir d'elles. Une exécution en attente détient toujours ses vraies données.
- Elle nettoie la sortie stockée de chaque étape, le message d'erreur stocké de chaque étape, l'erreur propre de l'exécution et une réponse de webhook stockée. Elle ne touche pas au contenu des fichiers : une politique lit des données d'éléments, et un fichier est une référence à des octets.
- Ce qui a été stocké est le point de départ d'une relecture ou d'une nouvelle tentative au milieu de cette exécution, donc une relecture voit les valeurs nettoyées. Les éléments du déclencheur du flux de travail sont dans la sortie de la première étape, et ils sont nettoyés aussi.
- Elle lit le flux de travail tel que cette exécution l'avait, donc modifier un flux de travail, ou la politique, ne change jamais une exécution déjà terminée.
- Un flux de travail qui nomme une politique qui n'existe pas **échoue en fermant** : ses exécutions ne gardent aucune donnée d'élément, comme le fait le paramètre d'enregistrement `metadata`, et les `problems` du flux de travail le disent. Une politique manquante ne doit jamais signifier des données conservées que quelqu'un voulait nettoyer.
- Une politique que des flux de travail nomment ne peut pas être supprimée (409), et son nom ne peut pas changer. Les règles, si.

| Appel | Ce qu'il fait |
|---|---|
| `GET /api/v1/redaction-policies` | Toutes les politiques. Toute personne connectée peut les lire, car celles qui écrivent des flux de travail ont besoin des noms. |
| `POST /api/v1/redaction-policies` | En crée une. |
| `PUT /api/v1/redaction-policies/{policy}` | Remplace sa description et ses règles. |
| `DELETE /api/v1/redaction-policies/{policy}` | En supprime une qu'aucun flux de travail ne nomme. |

Créer, modifier et supprimer une politique demande l'autorisation d'instance `redaction.manage`, que les propriétaires et les administrateurs ont. Chacune figure dans le journal d'audit sous `redaction.created`, `redaction.updated` et `redaction.deleted`.

## Insights

Dans l'éditeur : Insights, dans la barre du haut. Choisissez une fenêtre, un projet et un flux de travail ; il montre les totaux, un graphique et un tableau par jour, et un tableau par flux de travail.

`GET /api/v1/insights` additionne les exécutions d'une fenêtre : comment elles se sont terminées, combien de temps elles ont pris, par jour et par flux de travail.

```sh
curl "$CASCADE/api/v1/insights?from=2026-10-10&to=2026-10-14&project=$PROJECT" -H "Authorization: Bearer $KEY"
```

- `from` et `to` sont une heure RFC 3339 ou une date (minuit UTC). Sans aucun des deux, ce sont les sept derniers jours jusqu'à maintenant. Le maximum auquel il répond est de 366 jours.
- `project` et `workflow` le restreignent. Sans eux, il compte chaque projet dans lequel l'appelant peut lire des exécutions, donc les chiffres de chacun sont les siens.
- Une exécution compte le jour UTC où elle a été créée.
- `totals` et chaque ligne de `days` et `workflows` portent `total`, `succeeded`, `failed`, `canceled` et `unfinished` (en file, en cours ou en attente), la durée moyenne et la plus longue d'exécution en millisecondes sur les exécutions qui ont un début et une fin, et `failureRate`.
- `failureRate` est les échecs divisés par les réussites plus les échecs. Une exécution annulée n'est pas un échec et une exécution non terminée n'a pas tranché, donc aucune n'y entre. Il vaut 0 quand rien n'a fini dans un sens ou dans l'autre.
- `days` liste chaque jour UTC de la fenêtre, avec des zéros pour un jour sans exécution, de sorte qu'un graphique n'a pas de trous à deviner. `workflows` sont les 50 plus actifs, le plus actif d'abord.

Il lit les mêmes lignes d'exécution que la liste des exécutions, donc il demande l'autorisation `execution.read` et une clé qui l'autorise.

## Secrets externes

Dans l'éditeur : Paramètres, Secrets externes. Ajoutez un fournisseur, essayez-le sur un chemin depuis la même carte, et voyez à quoi ressemble la référence qui le désigne.

Le champ secret d'un identifiant peut pointer vers un secret conservé dans HashiCorp Vault ou OpenBao au lieu de contenir le secret lui-même. Changez le mot de passe dans le magasin et chaque flux de travail utilise le nouveau à sa prochaine exécution, sans que personne modifie un identifiant, et une copie de votre base de données ne contient jamais le mot de passe.

Une référence ressemble à ceci, dans n'importe quel champ secret d'un identifiant :

```
secret://bao/plant/line-3/db#password
```

C'est le fournisseur nommé `bao`, le secret à `plant/line-3/db`, et sa clé `password`. L'identifiant stocke ce texte, scellé comme n'importe quel secret. Rien de ce qu'il désigne n'est jamais stocké ici : la valeur est lue quand une exécution ouvre l'identifiant, gardée en mémoire pendant la durée de cache du fournisseur et effacée de tout ce que l'exécution enregistre, comme un mot de passe du coffre. Seuls les champs secrets acceptent des références. Une référence saisie dans un champ qui n'est pas secret n'est que du texte.

### Configurer un fournisseur

Un fournisseur, c'est le serveur, la façon dont Cascade s'y connecte et où il peut lire. Le créer, le modifier et le retirer revient à un propriétaire ou un administrateur de l'instance, avec l'autorisation `secrets.manage`, et doit être fait par une personne connectée, pas par une clé d'API.

```sh
curl -X POST $CASCADE/api/v1/secret-providers -H "X-CSRF-Token: ..." -d '{
  "name": "bao",
  "address": "https://bao.plant.example:8200",
  "authMethod": "approle", "roleId": "...", "secretId": "...",
  "allowedPaths": ["plant"]
}'
```

| Champ | Ce qu'il fait |
|---|---|
| `name` | De 1 à 40 lettres minuscules, chiffres et tirets. Il est dans chaque référence, donc il ne peut pas changer ensuite. |
| `address` | L'URL du serveur. |
| `mount`, `kvVersion` | Où le moteur KV est monté (`secret` par défaut) et s'il est en version 1 ou 2 (2 par défaut). |
| `namespace` | Envoyé en `X-Vault-Namespace`, pour un espace de noms du serveur. |
| `authMethod` | `token` avec `token`, ou `approle` avec `roleId` et `secretId`. `authMount` est l'endroit où AppRole est monté (`approle` par défaut). AppRole se connecte de lui-même, et de nouveau quand son jeton expire. |
| `caCert` | Une autorité de certification PEM à approuver pour le serveur, quand son certificat ne vient pas d'une autorité approuvée par le système. |
| `allowedPaths` | **Obligatoire.** Les seuls endroits où une référence peut lire. `plant` autorise `plant` et tout ce qui est dessous, et pas `plantation`. |
| `projects` | Facultatif. Les seuls projets qui peuvent utiliser le fournisseur. Laissé vide, tous les projets le peuvent. |
| `cacheSeconds` | Combien de temps un secret lu reste en mémoire, de 0 à 3600. 30 par défaut. 0 lit à chaque fois. |

La façon dont Cascade se connecte (le jeton, ou l'identifiant et le secret AppRole) est scellée sous la clé de l'instance, ré-enveloppée par une rotation de clé comme tout le reste, et jamais montrée par aucun appel. Omettez-la dans un changement et celle qui est stockée reste.

`POST /api/v1/secret-providers/{provider}/test` se connecte et, avec un `path`, le lit, et dit si cela a fonctionné. Il ne renvoie jamais de valeur. `GET /api/v1/secret-providers` liste les fournisseurs pour toute personne connectée, car celles qui créent des identifiants ont besoin des noms. Les appels figurent dans le journal d'audit sous `secrets.provider_created`, `_updated` et `_deleted`.

### Ce qu'il ne fera pas

- **Un fournisseur a besoin de chemins autorisés.** Un jeton pour Vault peut en général lire bien plus que ce que devrait pouvoir nommer quiconque modifie des identifiants, et sans liste, quiconque peut créer un identifiant pourrait en pointer un vers n'importe quel secret que le jeton atteint et faire envoyer ce secret quelque part par un flux de travail. Donnez au fournisseur les chemins dont ses identifiants ont besoin, et à sa politique la même chose.
- **Une référence est vérifiée quand l'identifiant est enregistré**, pas seulement quand une exécution l'utilise : le fournisseur doit exister, être ouvert au projet de l'identifiant et autoriser le chemin. Un chemin avec une partie vide, un point ou un `..` est refusé.
- **Une exécution qui ne peut pas lire le secret échoue et dit pourquoi**, en nommant le fournisseur, le chemin et la clé et jamais une valeur : fournisseur inexistant, chemin que le fournisseur n'autorise pas, aucun secret à cet endroit, clé inexistante, ou le refus du serveur lui-même (une politique qui n'autorise pas la lecture donne « permission denied »).
- **Supprimer un fournisseur ne modifie pas les identifiants.** Ceux qui le désignent échouent quand une exécution les ouvre, en disant que le fournisseur a disparu.
- Une valeur secrète qui commence réellement par `secret://` ne peut pas être stockée comme secret, car elle se lit comme une référence.
- Les valeurs qui sont des nombres ou vrai ou faux sont lues comme du texte. Une valeur qui est un objet entier ou une liste est refusée.
## Envoi des logs

Dans l'éditeur : Paramètres, Envoi des logs (propriétaires et administrateurs). Chaque destination montre combien elle a envoyé, quand elle a livré pour la dernière fois et sa dernière erreur, avec un bouton qui envoie un événement de test.

Envoyez le journal d'audit, et une ligne pour chaque exécution qui se termine, là où une usine garde déjà ses logs : un serveur syslog, ou tout ce qui accepte des logs OTLP en HTTP (un collecteur OpenTelemetry, Loki, une plateforme de logs). Les événements partent au fil de l'eau, de sorte qu'un SIEM voit une connexion échouée en quelques secondes, et la piste d'audit existe quelque part où un administrateur de cette instance ne peut pas la réécrire.

Une destination, c'est un endroit. Créez-en autant qu'il vous en faut :

```sh
curl -X POST $CASCADE/api/v1/log-destinations -H "X-CSRF-Token: ..." -d '{
  "name": "plant syslog", "kind": "syslog",
  "address": "syslog.plant.example:6514", "network": "tls",
  "caCert": "-----BEGIN CERTIFICATE-----..."
}'
curl -X POST $CASCADE/api/v1/log-destinations -H "X-CSRF-Token: ..." -d '{
  "name": "collector", "kind": "otlp", "endpoint": "https://otel.plant.example/v1/logs",
  "headers": {"Authorization": "Bearer ..."}
}'
```

Créer, modifier et retirer des destinations revient aux propriétaires et administrateurs de l'instance (`logstream.manage`), par une personne connectée et non par une clé d'API, car une destination est l'endroit où va le journal d'audit. Les appels figurent dans le journal d'audit sous `logstream.destination_created`, `_updated` et `_deleted`.

### Ce qui est envoyé

- **Événements d'audit** : chaque ligne du journal d'audit, avec son numéro de séquence et son hash. Le numéro de séquence et le hash permettent à un récepteur de repérer une répétition, et le hash est celui de la ligne, de sorte que la chaîne peut être vérifiée à partir de ce qui est arrivé. Une connexion échouée ou refusée est un avertissement, tout le reste un avis.
- **Événements d'exécution** : un par exécution qui se termine, quelle que soit sa fin : l'id de l'exécution, l'id et le nom du flux de travail, son projet, son statut, son mode, quand elle a été créée, démarrée et terminée, combien de temps elle a duré, et son erreur et l'étape où elle a échoué. Une exécution échouée est une erreur, une arrêtée un avis, une réussie une information. Ils sont envoyés quelques secondes après la fin de l'exécution.
- **Jamais de données d'éléments.** Ce que les étapes d'une exécution ont vu et produit reste dans l'exécution, où les politiques de masquage le protègent. Le journal d'audit ne contient jamais de secret.

`events` choisit l'un ou les deux (`["audit"]`, `["execution"]`, les deux par défaut). `start` dit où une nouvelle destination commence : `now`, la valeur par défaut, envoie ce qui se passe après sa création, et `beginning` envoie d'abord tout le journal d'audit et chaque exécution terminée.

### Syslog

Un message est au format RFC 5424 : `<priority>1 time host hotloop-cascade pid msgid - {json}`, avec l'événement en une ligne de JSON. La priorité est la facility fois huit plus la sévérité. Le msgid est l'action d'audit (`workflow.saved`) ou le statut de l'exécution.

| Champ | Ce qu'il fait |
|---|---|
| `address` | `host:port`. |
| `network` | `tcp` (par défaut), `udp` ou `tls`. |
| `framing` | Pour `tcp` et `tls` : `octet` (le comptage d'octets de la RFC 6587, par défaut) ou `newline`. UDP est un datagramme chacun. |
| `facility` | `local0` par défaut ; n'importe quel nom de facility syslog. |
| `appName` | L'APP-NAME de l'en-tête, `hotloop-cascade` par défaut. |
| `caCert`, `serverName` | Pour `tls` : l'autorité à approuver, et le nom pour lequel le certificat doit être émis quand ce n'est pas l'hôte. Aucun paramètre ne permet de sauter la vérification. |

### OTLP

Les logs vont à `endpoint` en OTLP sur HTTP avec un corps JSON : un enregistrement de log pour chaque événement, son corps étant l'événement en JSON, et ses parties en attributs (`cascade.event`, `cascade.action`, `cascade.status`, `cascade.project`, `cascade.actor.name` et ainsi de suite) pour qu'un récepteur puisse filtrer sans analyser. La ressource indique `service.name=hotloop-cascade`, sa version et l'hôte. `headers` sont envoyés avec chaque requête, pour un jeton ou un tenant. Ils sont scellés sous la clé de l'instance, ré-enveloppés par une rotation de clé et jamais montrés : la liste n'indique que leurs noms. `caCert` et `serverName` fonctionnent comme pour syslog.

### Comment se comporte la livraison

- **Au moins une fois, dans l'ordre.** Une destination se souvient de la dernière ligne d'audit et de la dernière exécution terminée qu'elle a envoyées. Une destination en panne reçoit tout ce qu'elle a manqué à son retour, dans l'ordre, et un redémarrage reprend là où elle s'était arrêtée. Si l'expéditeur est coupé entre l'envoi et la prise de note, ces événements sont renvoyés, et c'est à cela que servent les numéros de séquence.
- **Une destination en échec temporise**, une seconde puis en doublant jusqu'à cinq minutes, et son statut dit ce qui s'est mal passé et quand : `lastError`, `lastErrorAt`. Un succès l'efface. Rien n'est abandonné pendant la panne, donc la limite est le journal d'audit, pas une file d'attente.
- **Un seul expéditeur à la fois.** Avec plusieurs processus main, celui qui détient le bail d'une destination lui envoie ; les autres attendent et prennent le relais s'il s'arrête.
- **Modifier une destination garde sa place.** La déplacer vers une autre adresse ne renvoie ni n'omet jamais rien. Les en-têtes laissés de côté lors d'un changement sont conservés, et un objet vide les efface. Le nom et le type ne peuvent pas changer.
- `POST /api/v1/log-destinations/{destination}/test` envoie un événement fictif par le même chemin et dit s'il est arrivé, avec la raison quand il ne l'est pas. Il ne déplace rien.
- `GET /api/v1/log-destinations` montre le statut de chacune : combien d'événements elle a envoyés, le dernier numéro de séquence d'audit livré, quand elle a réussi pour la dernière fois et sa dernière erreur.

## Où vivent les données volumineuses

Les fichiers et les grosses charges qu'une exécution transporte (un PDF téléchargé, une image de caméra, un tableur) sont stockés sous forme de blobs, à part de la base de données. Par défaut, ils sont sur le disque de l'instance. Définissez `HOTLOOP_CASCADE_BLOB_STORE` pour les mettre dans un bucket S3 ou un conteneur de blobs Azure à la place, de sorte que le processus main puisse être reconstruit sans les emporter et que plusieurs processus main partagent une seule copie.

| Paramètre | Signification |
| --- | --- |
| `HOTLOOP_CASCADE_BLOB_STORE` | `fs` (par défaut), `s3` ou `azure`. |
| `HOTLOOP_CASCADE_BLOB_SPOOL_DIR` | L'endroit où un blob attend pendant qu'on calcule son hash avant l'envoi. Par défaut `blob-spool` dans le répertoire de données. |
| `HOTLOOP_CASCADE_BLOB_S3_BUCKET`, `_ACCESS_KEY`, `_SECRET_KEY` | Obligatoires pour `s3`. Le secret lit aussi `_SECRET_KEY_FILE`. |
| `HOTLOOP_CASCADE_BLOB_S3_ENDPOINT`, `_REGION` | Omettez l'endpoint pour AWS. Définissez-le pour Garage, MinIO ou Ceph. |
| `HOTLOOP_CASCADE_BLOB_S3_PATH_STYLE` | `true` ou `false`. Le style de chemin est le choix par défaut dès qu'un endpoint est défini. |
| `HOTLOOP_CASCADE_BLOB_S3_CA_FILE` | Un bundle d'AC pour un endpoint à certificat privé. |
| `HOTLOOP_CASCADE_BLOB_S3_PREFIX` | Un dossier dans le bucket, pour qu'un bucket puisse contenir plus d'une instance. |
| `HOTLOOP_CASCADE_BLOB_AZURE_CONTAINER` | Obligatoire pour `azure`. |
| `HOTLOOP_CASCADE_BLOB_AZURE_CONNECTION_STRING`, ou `_ACCOUNT` avec `_KEY`, ou `_SAS` | Une façon de se connecter. Les secrets lisent aussi une forme `_FILE`. |
| `HOTLOOP_CASCADE_BLOB_AZURE_ENDPOINT`, `_PREFIX` | Un endpoint pour Azurite ou un cloud privé, et un dossier dans le conteneur. |

Sur le chart, définissez-les par `env` et `extraEnv`, les secrets provenant d'un Secret Kubernetes.

- **Adressé par son contenu.** Un blob est stocké sous son SHA-256 (`sha256/ab/cdef...`), de sorte que le même fichier n'est stocké qu'une fois, quel que soit le nombre d'exécutions qui le transportent. Le remettre ne fait rien, y compris quand deux exécutions le font au même instant.
- **Haché avant l'envoi.** Les données sont lues une fois dans le fichier de spool, hachées, puis envoyées, de sorte que la mémoire reste plate quelle que soit la taille. Un blob au-dessus de la limite de taille est refusé, et un envoi annulé ne laisse rien dans le bucket.
- **Vérifié à la sortie.** Une lecture est vérifiée par rapport à son hash pendant qu'elle est diffusée, de sorte qu'un objet corrompu échoue bruyamment au lieu de donner de mauvaises données à une exécution.
- **Taille.** Un envoi unique part en transfert multipart sur S3 et par blocs sur Azure, de sorte que la limite habituelle de 5 GiB par requête ne s'applique pas.
- **Nettoyage des blobs.** Une fois par heure, un passage supprime les blobs que plus aucune ligne ne désigne : une sortie d'étape stockée comme fichier parce qu'elle était trop grosse pour la base de données, et les pièces jointes que portent les éléments. Un blob est conservé tant qu'une exécution d'étape, une sortie partielle, une réponse enregistrée ou un flux de travail le nomme encore, directement ou par une sortie stockée qui contient la pièce jointe, de sorte qu'un fichier partagé par deux exécutions de sortie identique reste jusqu'à la disparition de la dernière. Seuls les blobs écrits pour la dernière fois il y a plus de 24 heures sont examinés, et remettre des octets déjà stockés compte comme les écrire de nouveau après la première heure, de sorte qu'un fichier qu'une étape vient de stocker et n'a pas encore enregistré n'est jamais supprimé. Un passage qui ne peut pas lire une sortie stockée ne supprime rien. Il écrit une ligne `blobs.collected` dans le journal d'audit avec le nombre de fichiers et d'octets supprimés. Le passage suppose que le magasin de blobs appartient à une seule instance (les workers et le processus main d'une installation le partagent) ; deux installations pointant vers le même bucket ou dossier supprimeraient chacune les fichiers de l'autre, donnez donc à chacune le sien (`HOTLOOP_CASCADE_BLOB_S3_PREFIX` existe pour cela).
- **Changer de magasin plus tard.** Les blobs existants restent là où ils ont été écrits. Déplacez-les vers le nouveau magasin avant de basculer, car une référence à un blob que le nouveau magasin n'a pas est un fichier manquant.

Ces deux backends sont éprouvés contre Garage et Azurite dans la pile de tests, avec la même suite de conformité que le magasin sur disque : écriture et lecture, blobs vides, déduplication sous concurrence, corruption, la limite, ids invalides, suppression, listage, un envoi annulé et un envoi en streaming de 192 MiB avec une vérification du heap.

Ce que cela signifie pour vous : un processus main reconstruit ou remplacé retrouve tous les fichiers que ses exécutions transportaient, sans copie.
