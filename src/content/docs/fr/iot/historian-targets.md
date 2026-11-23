---
title: "Cibles de l'historien"
description: "Envoyez chaque mesure conservée par HotLoop aussi vers la base PostgreSQL, TimescaleDB, SQL Server, InfluxDB, MySQL ou MariaDB de l'usine."
---

HotLoop conserve son propre historique, et cela ne change pas. Mais une usine a déjà une base de données. Le service informatique la sauvegarde, la met à jour, y branche Power BI et en répond lors d'un audit, et personne ne va adopter la nôtre juste pour afficher une tendance. HotLoop écrit donc aussi l'historique dans la leur.

Chaque mesure que conserve l'historien intégré va vers chaque cible : les mêmes mesures, après la même bande morte, avec la même qualité. Ni plus, ni moins. Une tendance tracée depuis la cible et une tendance tracée dans HotLoop concordent, car ce sont les mêmes lignes.

Les cibles existent dans HotLoop IoT, Edge et Gateway. Pas dans l'Edge Relay : il n'a pas d'historique propre pour remettre une cible à niveau, et le rôle d'un relais est d'amener les mesures jusqu'à un Gateway, qui peut les écrire n'importe où.

Bases de données dans lesquelles HotLoop écrit :

| Type | Versions testées | <span class="sr-only">Détails</span> |
|---|---|---|
| PostgreSQL et TimescaleDB | PostgreSQL 16 avec TimescaleDB 2.30 | [ci-dessous](#postgresql-et-timescaledb) |
| Microsoft SQL Server | SQL Server 2025 CU9 | [ci-dessous](#microsoft-sql-server) |
| InfluxDB 2 et 3 | InfluxDB 2.9.1 et InfluxDB 3 Core 3.12.0 | [ci-dessous](#influxdb-2-et-3) |
| MySQL et MariaDB | MySQL 26.7.0 et MariaDB 13.0.2 | [ci-dessous](#mysql-et-mariadb) |
| API Kafka (flux d'événements) | Apache Kafka 4.4.0 et Redpanda 26.2.6 | [ci-dessous](#api-kafka-flux-dévénements) |

## En ajouter une

**Paramètres, Cibles de l'historien, Ajouter une cible**, ou `POST /api/historian/targets` (voir [l'API HTTP](/fr/iot/api/#cibles-de-lhistorien)). Réservé aux administrateurs, car une cible est un endroit où partent les données de l'usine, et choisir lequel est une décision d'administrateur. Toute personne qui peut lire les paramètres voit les cibles et l'état de chacune.

Une cible se compose d'un type, d'une adresse (`host` ou `host:port`), d'une base de données, d'une table et d'un identifiant de connexion. Le mot de passe est chiffré avec la même clé que les identifiants des appareils (`HOTLOOP_SECRET_KEY_FILE`, voir [Sauvegardes et restauration](/fr/iot/backup/)) et ne ressort jamais de l'API. Sans clé, une cible avec mot de passe est refusée : un identifiant de base de données en clair dans une sauvegarde est exactement ce que cette clé sert à empêcher.

HotLoop crée la table si elle n'existe pas. Si elle existe mais n'a pas été créée par HotLoop (elle n'a pas les six colonnes ci-dessous), la cible est indisponible et indique quelles colonnes manquent, au lieu de refuser chaque mesure une à une.

## Ce qui arrive dans la table

Les six mêmes colonnes que l'historique propre de HotLoop, si bien qu'une requête écrite pour l'un lit l'autre :

| Colonne | <span class="sr-only">Détails</span> |
|---|---|
| `ts` | Moment où la mesure a été prise, en UTC, à la microseconde |
| `device_id` | L'appareil |
| `tag_name` | Le tag |
| `value` | Le nombre, ou vide pour une mesure de texte |
| `string_val` | Le texte, ou vide pour un nombre |
| `quality` | `good`, `bad` ou `uncertain` |

La clé primaire est `(device_id, tag_name, ts)`, appareil et tag en premier car une tendance demande un tag dans le temps. Cette clé explique aussi pourquoi envoyer une mesure deux fois est sans danger : cela donne une seule ligne. Le rattrapage ci-dessous s'appuie volontairement là-dessus.

## Quand une cible est indisponible

C'est la partie qui compte, voici donc exactement ce qui se passe.

**L'interrogation ne l'attend jamais.** Les mesures vont vers une cible par une file en mémoire, aussi grande que celle de l'historien intégré (`HOTLOOP_HISTORIAN_QUEUE_SIZE`). Remettre une mesure ne bloque jamais. Une file pleine abandonne sa plus ancienne mesure pour faire de la place, la même règle que suit l'historien intégré, pour la même raison : une file sans limite sur un pod à mémoire limitée finit en OOM kill, et vous perdez alors l'arriéré, les données en direct et le processus. Une cible derrière un pare-feu qui avale chaque paquet est testée pour ne rien retenir : ni l'interrogation, ni l'historien intégré, ni un arrêt.

**Elle se remet à niveau à son retour.** Ce qui attendait dans la file part en premier. Ce que la file a dû abandonner part ensuite, depuis l'historique propre de HotLoop, qui contient déjà chacune de ces mesures. Il n'y a pas de seconde copie sur disque à dimensionner ni à remplir, et le rattrapage fonctionne aussi longtemps que HotLoop garde son historique (`HOTLOOP_HISTORIAN_RETENTION_DAYS`, 90 jours sauf changement de votre part), et non aussi longtemps qu'un tampon dure.

**Un redémarrage en cours de route n'oublie rien.** Ce qui est dû à une cible est une plage de temps inscrite dans sa ligne, pas un tas de mesures en mémoire. Un arrêt propre note exactement ce qui est dû. Un plantage ne le peut pas, donc dès qu'une cible tombe ou se met à perdre des mesures, HotLoop note où cela a commencé, sans borne de fin. Le démarrage suivant envoie tout à partir de là.

**Elle dit à voix haute ce qu'elle ne peut pas envoyer.** Deux choses ne peuvent pas être rattrapées, et les deux vont dans le journal système, avec leur nombre et le moment où elles ont été prises :

- Les mesures plus anciennes que la rétention de HotLoop au retour de la cible. Elles ont aussi disparu de HotLoop. Le journal nomme la plage exacte.
- Les mesures que la base de données de la cible refuse net : une valeur que sa colonne ne peut pas contenir, une contrainte check posée par quelqu'un sur la table. Le lot est scindé jusqu'à trouver les mesures refusées, si bien qu'une mauvaise mesure ne retient jamais les autres, et elles sont comptées comme refusées. C'est signalé au plus une fois par minute, car un tag que la base ne peut pas contenir est refusé à chaque interrogation.

Une base de données qui ne laisse pas du tout entrer HotLoop (mauvais mot de passe, pas de droit d'insertion, une colonne manquante dans la table) est **indisponible**, jamais « en refus ». Les mesures attendent, et dès que quelqu'un corrige le problème, elles arrivent. On n'abandonne qu'un refus portant sur les mesures elles-mêmes.

Chaque étape va dans le journal système, sous le sujet `historian/<id>` :

```
warning  Historian target plant-pg (Plant historian) is down: dial tcp 10.20.0.9:5432: connect: connection refused.
         Readings wait in memory, up to 50000 of them; past that they're sent from HotLoop's own history when it's back.
info     Historian target plant-pg is back after 41m12s down. What waited in memory goes first.
warning  Historian target plant-pg couldn't keep up, and its queue dropped readings taken between
         2026-10-03T10:12:40Z and 2026-10-03T10:43:19Z (182211 readings dropped since HotLoop started).
         They go out from HotLoop's own history next.
info     Historian target plant-pg caught up: 182211 readings taken between 2026-10-03T10:12:40Z and
         2026-10-03T10:43:19Z went out from HotLoop's own history.
```

La carte Paramètres montre la même chose en direct : l'état (`writing`, `catching up`, `down`, `off`), pourquoi la cible est indisponible, combien de mesures attendent et ce qui reste dû.

Le rattrapage attend une minute derrière la mesure la plus récente qui est due, et que l'historien intégré soit à jour, car une mesure encore dans cette file n'est pas encore dans la base. Lire au-delà la ferait sauter définitivement.

## Désactiver, modifier ou supprimer une cible

Désactivée, une cible ne reçoit rien et on ne lui doit rien pour la durée de l'arrêt. Ce qu'on lui devait déjà reste dû. Une modification (nouveau mot de passe, nouvelle adresse) la relance avec les nouveaux paramètres, et ce qu'on lui devait reste dû. La supprimer fait oublier ce qu'on lui devait. Ce qu'elle contient déjà reste dans sa base de données.

Seul le HotLoop qui sert l'interface écrit vers les cibles. Un assistant `--mcp-stdio` qui tourne à côté ne le fait pas, sinon tout partirait en double.

## PostgreSQL et TimescaleDB

```json
{"id":"plant-pg","name":"Plant historian","kind":"postgres","address":"db.plant.local","database":"plant",
 "username":"hotloop","password":"...","useTls":true}
```

- Le port par défaut est 5432. La table par défaut est `hotloop_history`, et peut porter un schéma (`history.hotloop`). Le schéma doit exister.
- Si la base de données a l'extension TimescaleDB, la table créée par HotLoop est une hypertable sur `ts`. Si la conversion échoue, la table reste ordinaire, elle accepte toujours toutes les mesures, et le journal système dit pourquoi.
- L'identifiant doit pouvoir se connecter, créer la table la première fois (ou vous la créez, avec les six colonnes ci-dessus) et y insérer. Rien d'autre. Un identifiant qui peut lire la table mais pas y insérer donne une cible indisponible, pas une cible qui refuse des mesures.
- `useTls` vérifie le certificat du serveur (`sslmode=verify-full`). `insecureSkipVerify` chiffre sans le vérifier (`sslmode=require`). Sans `useTls`, la connexion n'est pas chiffrée (`sslmode=disable`).
- NaN et les infinis sont écrits tels quels : `double precision` les accepte.
- Les instructions ne sont pas préparées, donc un PgBouncer en mode transaction devant la base de données convient.

La table, si vous préférez la créer vous-même :

```sql
CREATE TABLE hotloop_history (
    ts         timestamptz      NOT NULL,
    device_id  text             NOT NULL,
    tag_name   text             NOT NULL,
    value      double precision,
    string_val text,
    quality    text             NOT NULL,
    PRIMARY KEY (device_id, tag_name, ts)
);
```

## Microsoft SQL Server

```json
{"id":"plant-sql","name":"Plant historian","kind":"sqlserver","address":"sql.plant.local","database":"plant",
 "username":"hotloop","password":"...","useTls":true}
```

- Le port par défaut est 1433, la table `hotloop_history` dans le schéma `dbo`. Un schéma placé devant (`history.hotloop`) est utilisé tel quel, et doit exister.
- La base de données doit exister. HotLoop crée la table, pas la base.
- La table créée par HotLoop a `ts` en `datetime2(6)`, les noms en `nvarchar`, `value` en `float`, `string_val` en `nvarchar(max)` et la clé primaire `(device_id, tag_name, ts)`. Cette clé explique qu'un nom de tag ne puisse pas dépasser 380 caractères, et qu'un nom plus long soit refusé comme mesure et signalé : une clé clusterisée peut faire 900 octets.
- L'identifiant doit pouvoir se connecter, créer la table la première fois (ou vous la créez, avec ces six colonnes) et y insérer. Un identifiant qui peut lire la table mais pas y insérer donne une cible indisponible, pas une cible qui refuse des mesures.
- **NaN et les infinis sont écrits avec leur heure et leur qualité, sans nombre.** Le `float` de SQL Server ne peut pas les contenir. La mesure est là, et `value` est NULL.
- SQL Server chiffre lui-même l'identifiant, donc le mot de passe ne circule jamais en clair. `useTls` chiffre aussi les mesures et vérifie le certificat du serveur ; `insecureSkipVerify` chiffre sans le vérifier.
- Une mesure déjà présente est ignorée, donc l'envoyer deux fois donne une seule ligne.

La table, si vous préférez la créer vous-même :

```sql
CREATE TABLE dbo.hotloop_history (
    ts         datetime2(6)  NOT NULL,
    device_id  nvarchar(64)  NOT NULL,
    tag_name   nvarchar(380) NOT NULL,
    value      float         NULL,
    string_val nvarchar(max) NULL,
    quality    varchar(16)   NOT NULL,
    CONSTRAINT PK_hotloop_history PRIMARY KEY CLUSTERED (device_id, tag_name, ts)
);
```

## MySQL et MariaDB

```json
{"id":"plant-mysql","name":"Plant historian","kind":"mysql","address":"mysql.plant.local","database":"plant",
 "username":"hotloop","password":"...","useTls":true}
```

Un seul type pour les deux : ils parlent le même protocole et acceptent ici les mêmes instructions, et les deux sont exécutés dans la suite de tests.

- Le port par défaut est 3306, la table `hotloop_history`. Un nom précédé de la base de données (`other.hotloop`) est utilisé tel quel. La base de données doit exister ; HotLoop crée la table, pas la base.
- La table créée par HotLoop est InnoDB, avec `ts` en `DATETIME(6)` en UTC, `value` en `DOUBLE`, `string_val` en `LONGTEXT` et la clé primaire `(device_id, tag_name, ts)`. Les noms sont en `utf8mb4_bin`, car les noms de tag de HotLoop sont sensibles à la casse et la collation par défaut des serveurs ne l'est pas : `Temp` et `TEMP` ne feraient qu'une clé. Cette clé explique qu'un nom de tag ne puisse pas dépasser 512 caractères, et qu'un nom plus long soit refusé comme mesure et signalé.
- **INSERT est le seul privilège nécessaire** une fois la table en place, et CREATE la première fois si vous préférez que HotLoop la crée. Il ne lit pas la table et n'utilise pas `ON DUPLICATE KEY UPDATE`, qui demanderait aussi UPDATE : une mesure déjà présente est un doublon sur la clé primaire, et elle est ignorée.
- **NaN et les infinis sont écrits avec leur heure et leur qualité, sans nombre.** `DOUBLE` ne peut pas les contenir. `value` est NULL.
- Un doublon sur un autre index unique ajouté par quelqu'un n'est pas la même mesure : elle est refusée et signalée, comme une contrainte check.
- `useTls` chiffre et vérifie le certificat du serveur ; `insecureSkipVerify` chiffre sans le vérifier. Sans `useTls`, le mot de passe ne circule quand même pas en clair (la connexion par défaut de MySQL 8 l'envoie chiffré avec la clé du serveur), mais quelqu'un placé au milieu pourrait remplacer cette clé, donc indiquez `useTls` pour tout ce qui n'est pas sur le réseau propre de l'usine.

La table, si vous préférez la créer vous-même :

```sql
CREATE TABLE hotloop_history (
    ts         DATETIME(6)  NOT NULL,
    device_id  VARCHAR(64)  CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    tag_name   VARCHAR(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    value      DOUBLE       NULL,
    string_val LONGTEXT     CHARACTER SET utf8mb4 NULL,
    quality    VARCHAR(16)  NOT NULL,
    PRIMARY KEY (device_id, tag_name, ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

## InfluxDB 2 et 3

```json
{"id":"plant-influx","name":"Plant historian","kind":"influxdb","address":"influx.plant.local:8086",
 "org":"plant","database":"hotloop","password":"<an API token>","useTls":true}
```

La même cible parle à InfluxDB 2 comme à InfluxDB 3, en HTTP simple (`/api/v2/write`, line protocol, horodatages à la microseconde). Les deux y répondent, donc aucun pilote à figer et rien à choisir.

- Le port par défaut est 8086, celui d'InfluxDB 2. InfluxDB 3 écoute sur 8181 sauf changement, donc indiquez le port.
- `database` est le bucket. `org` est l'organisation d'InfluxDB 2, et InfluxDB 2 en exige une : sans elle, chaque écriture est un 400 qui le dit, et la cible est indisponible avec ce message. InfluxDB 3 n'a pas d'organisations, donc omettez-la.
- `password` est le jeton d'API. Il faut le droit d'écriture sur le bucket (InfluxDB 2) ou sur la base de données (InfluxDB 3). HotLoop ne crée pas le bucket. Un bucket absent donne un 404, ce qui est la cible indisponible, pas des mesures refusées. InfluxDB 3 crée une base de données quand on y écrit.
- `table` est la mesure (measurement), `hotloop_history` sauf indication contraire.
- Une mesure est un point. L'appareil et le tag sont des tags, donc chaque tag HotLoop est une série. Le nombre (`value`) ou le texte (`string_val`) et la qualité (`quality`) sont des champs. Envoyer une mesure deux fois l'écrase elle-même.
- **NaN et les infinis sont écrits avec leur heure et leur qualité, sans champ `value`.** Le line protocol ne permet pas de les écrire.
- InfluxDB fige le type d'un champ pour de bon (par shard dans la 2, par colonne dans la 3). Si autre chose a déjà écrit un nombre dans `string_val` ou du texte dans `value`, les mesures de HotLoop de l'autre type sont refusées, comptées et nommées dans le journal système, et le reste passe.
- Un 401 ou un 403 (un jeton inconnu ou sans droit d'écriture) est la cible indisponible, pas un refus : rien n'est jeté, et les mesures passent dès que le jeton est bon.
- `useTls` passe en `https` et vérifie le certificat ; `insecureSkipVerify` ne le vérifie pas.

## API Kafka (flux d'événements)

Pas une base de données : un flux. Chaque mesure que conserve l'historien va vers un topic Kafka et, si vous lui donnez un second topic, il en va de même pour chaque ligne que HotLoop écrit dans son propre journal système (alarmes, appareils qui se connectent ou tombent, changements de configuration). Il parle l'API Kafka, donc Apache Kafka, Redpanda et tout autre serveur qui répond à ce protocole l'acceptent. La même file, le même rattrapage depuis l'historique propre de HotLoop, le même « un broker indisponible ne ralentit rien » que pour toute autre cible.

```json
{"id":"plant-stream","name":"Plant event stream","kind":"kafka","address":"kafka1.plant.local:9093,kafka2.plant.local:9093",
 "table":"hotloop.tags","username":"hotloop","password":"...","useTls":true,
 "options":{"sasl":"scram-sha-512","caCert":"-----BEGIN CERTIFICATE-----...","eventsTopic":"hotloop.events"}}
```

- `address` est une liste de brokers séparés par des virgules, port 9092 par défaut. Un seul suffit pour démarrer : le broker indique où sont les autres.
- `table` est le topic des mesures (`hotloop.tags` sauf indication contraire). `options.eventsTopic` est le topic des événements, `hotloop.events` quand vous ajoutez la cible depuis le formulaire ou l'omettez dans l'appel d'API, et vide pour aucun événement. Les deux ne peuvent pas être le même topic.
- HotLoop crée les topics s'ils n'existent pas, avec les partitions et la réplication par défaut du broker. Un identifiant qui ne peut pas les créer donne une cible indisponible avec la raison du broker, donc créez-les d'abord si le vôtre ne peut pas.
- `options.sasl` est `scram-sha-512`, `scram-sha-256` ou `plain`, avec le `username` et le `password`. PLAIN envoie le mot de passe tel quel, donc HotLoop le refuse sans `useTls`. Un identifiant que le broker rejette est **indisponible**, avec « the broker refused the login » dans l'état, jamais « refus de mesures ».
- `useTls` vérifie le certificat du broker. S'il a été signé par votre propre CA, placez la CA dans `options.caCert` au format PEM. `insecureSkipVerify` chiffre sans vérifier.
- Les certificats client (TLS mutuel), Kerberos et les connexions OAuth ne sont pas pris en charge.

**Ce qui arrive sur le topic des mesures.** Un objet JSON par mesure, avec la clé `deviceId/tag` pour que les mesures d'un tag restent dans l'ordre sur une partition :

```json
{"ts":"2026-10-31T12:00:00.123456Z","deviceId":"press-01","tag":"Zone1_Temp","value":21.5,"quality":"good","unit":"°C"}
{"ts":"2026-10-31T12:00:00Z","deviceId":"press-01","tag":"Program","value":null,"text":"Grade A","quality":"good"}
{"ts":"2026-10-31T12:00:00Z","deviceId":"press-01","tag":"Speed","value":null,"nonFinite":"NaN","quality":"bad"}
```

Un nombre est `value` ; le texte est `text` avec `value` nul ; JSON ne peut pas porter NaN ni un infini, donc ceux-ci indiquent `nonFinite` (`NaN`, `+Inf`, `-Inf`) et `value` est nul. On ne fait qu'ajouter des champs à ce format, jamais le modifier. En-têtes : `hotloop-type: reading` et `content-type: application/json`. L'horodatage propre de l'enregistrement est le moment où il a été produit ; l'heure de la mesure est `ts`.

**Ce qui arrive sur le topic des événements.** Un objet JSON par ligne du journal système, avec son sujet comme clé (ou sa catégorie quand il n'en a pas), `hotloop-type: event` :

```json
{"at":"2026-10-31T12:00:00.456Z","severity":"warning","category":"alarm","subject":"press-01/Zone1_Temp",
 "actor":"system","message":"Zone 1 is over 250","detail":{"limit":250,"value":251.5}}
```

`detail` est le JSON que portait la ligne, en JSON, ou du texte quand ce n'était pas du JSON. Les lignes concernant les cibles de l'historien elles-mêmes sont exclues, sinon un broker indisponible signalerait sa propre panne à lui-même.

**C'est au moins une fois, et les événements sont au mieux.**
- Mesures : la livraison est acquittée par chaque réplica synchronisé, et le rattrapage après une panne recouvre volontairement ce qui était déjà parti, donc une mesure peut arriver deux fois. `deviceId`, `tag` et `ts` désignent un doublon ; un consommateur qui y tient écarte la répétition. Une mesure qui n'atteint jamais le broker est due et envoyée depuis l'historique propre de HotLoop, comme pour une base de données.
- Les événements sont le flux en direct. Il n'existe pas d'historique à partir duquel les rattraper, donc un événement produit pendant l'absence du broker, ou au-delà d'un tampon plein, est perdu, et l'état de la cible le compte (`eventsLost`) et la carte Paramètres l'indique.
- Un broker qui disparaît au milieu d'une écriture rend la cible **indisponible** en 25 secondes, et les mesures de cette écriture sont dues. (franz-go attendrait sinon indéfiniment une écriture dont il ne peut pas prouver qu'elle n'est pas arrivée ; HotLoop le laisse abandonner, ce qui explique qu'un doublon soit possible.)
- Une mesure que le broker n'acceptera jamais (plus grosse que ce qu'un message peut être) est refusée isolément, comptée et nommée dans le journal système, et le reste de son lot part quand même.

HotLoop parle l'API Kafka via [franz-go](https://github.com/twmb/franz-go) (BSD-3-Clause), crédité dans `NOTICE`. Cela a ajouté environ 5 MiB au binaire.

## Comment c'est testé

Chaque type de cible a été exécuté contre la vraie base de données ou le vrai broker, à travers une panne réellement coupée puis rétablie : la cible finit par contenir exactement ce que contient HotLoop, un redémarrage pendant la panne se rattrape au démarrage suivant, et une cible qui se fige ne retient ni l'interrogation ni l'historien intégré.
