---
title: "Sauvegardes et restauration"
description: "Instantanés logiques de la base de données, restaurations qui refusent un schéma plus récent, et pourquoi la clé des mots de passe se sauvegarde à part."
---

HotLoop prend des instantanés logiques de l'historien, des données de tables seulement, et les restaure, depuis 4.12.0. Activé par défaut, tous les jours (`HOTLOOP_BACKUP_ENABLED`, `HOTLOOP_BACKUP_INTERVAL` 24h), dans le binaire et dans le chart Helm. Les sauvegardes vont sous `HOTLOOP_BACKUP_DIR`, qui vaut par défaut `backups` dans le répertoire de données de HotLoop (`HOTLOOP_DATA_DIR`, sinon `/data` quand on peut y écrire, sinon `~/.local/share/hotloop`) : un déploiement qui n'a pas configuré de volume de sauvegarde ne devrait pas voir ce processus écrire en silence dans le système de fichiers éphémère d'un conteneur.

## De quoi il s'agit

Une sauvegarde est un répertoire : un fichier par table plus un petit `manifest.json` (version de HotLoop, migrations de schéma appliquées à la base, horodatage, et nombre de lignes et colonnes avec leurs types pour chaque table).

## Ce que ce n'est pas

- **Pas `pg_dump`/`pg_restore`.** L'image d'exécution du Gateway (`gcr.io/distroless/static-debian12:nonroot`) est volontairement un binaire statique et rien d'autre : pas de shell, pas de gestionnaire de paquets, aucun binaire externe d'aucune sorte. Tout passe par la même connexion à la base de données que celle que l'application détient déjà.
- **Pas une sauvegarde du schéma.** Le schéma est reconstruit automatiquement à chaque démarrage (`HOTLOOP_DB_MIGRATE`, activé par défaut). Une sauvegarde ne capture que les *données* des tables, et une restauration suppose toujours que le schéma a d'abord été reconstruit par ces migrations.
- **Pas une reprise à un instant précis.** Il n'y a ni archivage WAL ni réplication continue ici. Une sauvegarde est un instantané au moment où elle a tourné ; tout ce qui est écrit après ce moment et avant la sauvegarde suivante n'est pas couvert.
- **Pas un stockage hors machine.** Le répertoire de sauvegarde (`HOTLOOP_BACKUP_DIR`, prévu pour reposer sur le PVC `backup.persistence` que ce chart provisionne) reste un volume unique dans le même cluster. Placer les sauvegardes sur un stockage réellement durable, répliqué ou hors ligne (copier le volume vers un stockage objet, faire un instantané du PVC, ce que fournit l'infrastructure réelle de l'exploitant) est le travail de l'exploitant, de la même façon que ce projet traite déjà le stockage durable comme une responsabilité de l'infrastructure plutôt que quelque chose pour lequel l'application réinvente un adaptateur de sauvegarde multicloud.

## Protégez les fichiers de sauvegarde

Les fichiers de sauvegarde sont sensibles. Le fichier `users.copy` contient les hachages bcrypt des mots de passe et des codes PIN de borne, et `sessions.copy` et `write_audit.copy` contiennent les enregistrements de sessions et la piste d'audit des écritures. Les fichiers sont créés avec le mode `0640` (et le répertoire de sauvegarde en `0750`), et un fichier déjà présent est une erreur plutôt qu'écrasé, mais c'est un plancher, pas un substitut à la protection du volume : gardez le volume de sauvegarde sur un stockage chiffré au repos, limitez qui et quoi peut le lire, et appliquez le même soin à toute copie hors machine que fait un exploitant.

Le fichier `devices.copy` contient l'adresse et la configuration de protocole de chaque appareil telles qu'elles sont stockées, ce qui inclut les identifiants avec lesquels les pilotes se connectent. Leur lisibilité dépend de la clé, ci-dessous. Depuis la 4.15.1, l'API masque tout identifiant d'appareil à tous les rôles, administrateur compris ; un fichier de sauvegarde n'est pas derrière l'API. Voir [Authentification et utilisateurs](/fr/iot/authentication/#où-les-identifiants-restent-en-clair).

## Identifiants d'appareils et clé secrète

Une sauvegarde est le fichier qui finit copié sur un portable, un partage et un ticket. Les identifiants qu'elle contient sont donc chiffrés, avec une clé qui n'est jamais dans la base de données ni dans une sauvegarde.

- **Avec `HOTLOOP_SECRET_KEY_FILE` défini** (le chart le définit, avec une clé qu'il génère à l'installation et conserve d'une mise à jour et d'une désinstallation à l'autre), chaque identifiant protégé par clé (le `password` des appareils OPC UA, CODESYS, MQTT, HTTP, MTConnect et UniFi, la `community` et les phrases secrètes des appareils SNMP, les valeurs d'en-tête HTTP et MTConnect comme les clés d'API, le mot de passe de chaque autre broker MQTT que la découverte écoute, et le mot de passe de chaque cible de l'historien) est chiffré dans la base de données, et `devices.copy`, `mqtt_sources.copy` et `historian_targets.copy` contiennent le texte chiffré. Le manifeste indique la clé utilisée sous `secretKeyIds` : un identifiant, jamais la clé.
- **Sans elle**, ces identifiants sont dans la base de données et dans `devices.copy` en clair, et HotLoop le dit dans son journal de démarrage. Les consoles UniFi, les brokers MQTT avec mot de passe et les cibles de l'historien avec mot de passe ne peuvent pas du tout être enregistrés sans clé. Définissez-en une et redémarrez : tout ce qui est déjà stocké est chiffré à ce démarrage.
- **Un identifiant écrit dans une URL ou dans un texte est scellé lui aussi** (`mqtt://user:pass@host`, une valeur de requête `?token=` ou `?api_key=`, un `body` HTTP qui mentionne un mot de passe). L'adresse ou l'option d'un appareil qui en contient un est scellée entièrement, et les pilotes la récupèrent exactement telle qu'elle a été saisie. Une URL sans rien de secret reste lisible. Sans clé, ceux-ci sont en clair comme le reste, et le journal de démarrage le dit ; avec une clé, tout ce qui est déjà stocké est scellé à ce démarrage. L'option de mot de passe reste le meilleur endroit pour en mettre un.

**La restauration exige la même clé.** `--restore-from` vérifie le manifeste avant de charger une ligne : une sauvegarde chiffrée avec une clé que le HotLoop qui restaure n'a pas est refusée, et l'erreur nomme la clé requise. Restaurez avec ce fichier de clé monté. Si la clé est définitivement perdue, ajoutez `--restore-keep-unreadable-credentials` : tout le reste revient, et chaque appareil dont l'identifiant ne peut pas être ouvert reste indisponible, en indiquant quelle clé il lui faut, jusqu'à ce que quelqu'un saisisse de nouveau l'identifiant. Une sauvegarde faite avant l'existence d'une clé se restaure n'importe où, et ses identifiants sont chiffrés dès que la restauration se termine.

**Gardez la clé là où la sauvegarde n'est pas.** Une clé stockée à côté de ses sauvegardes ne protège rien. Avec le chart, c'est le Secret `<release>-secret-key` ; sauvegardez-le comme vous sauvegardez le reste des secrets du cluster, séparément.

## Ce qui est sauvegardé, et dans quel ordre

Chaque table de données utilisateur, dans l'ordre de dépendance des clés étrangères (une table vient toujours après toutes les tables vers lesquelles pointent ses propres clés étrangères) :

```
devices → tags → tag_latest → alarm_definitions → alarm_state →
alarm_events → automations → automation_runs → blueprints → scripts → script_runs →
recipes → recipe_versions → recipe_applications → events → write_audit →
settings → users → sessions → user_certificates → energy_meters → energy_meter_state →
energy_buckets → fleet_members → report_definitions →
report_runs → entity_state_log → tag_history
```

(Abrégé ; `backup.Tables` est la liste complète, avec les tables d'entités et d'équipements et `entity_last_state`.) Le `entity_state_log` du journal de bord est partitionné par mois dans les deux modes d'historique et passe juste avant `tag_history`, la seule table plus grande. Une restauration charge ses lignes avant qu'aucune de ses partitions mensuelles n'existe, elles tombent donc dans sa partition par défaut. La maintenance du journal de bord, au démarrage d'un Gateway qui enregistre, crée les partitions du mois dernier et de ce mois autour des lignes qui leur appartiennent, et supprime les lignes plus anciennes de la partition par défaut à mesure qu'elles dépassent la rétention, de sorte que la rétention atteint chaque ligne restaurée. Voir [le journal de bord](/fr/iot/logbook/).

Les scripts reviennent avec leur historique. Une exécution que la sauvegarde a surprise en cours revient `running`, et le premier démarrage du Gateway la marque comme annulée, `interrupted by restart`, comme une exécution coupée par un plantage : rien ne reprend une exécution. Voir [Scripts](/fr/iot/scripts/).

Les recettes reviennent avec chaque version et chaque application. Une application que la sauvegarde a surprise à mi-chemin revient `applying`, et le premier démarrage du Gateway la marque `failed`, en pointant vers son identifiant d'appel dans l'audit des écritures : rien n'en reprend une, et rien n'en annule une. Voir [Recettes](/fr/iot/recipes/).

`schema_migrations` est exclue délibérément : `store.Migrate` la reconstruit, ainsi que le DDL de chaque table, à partir des migrations intégrées. C'est la seule entrée de `backup.ExcludedTables`, qui consigne pourquoi chaque table exclue l'est.

La liste est tenue à la main, et c'est ainsi qu'une table peut être ajoutée par une migration puis silencieusement absente de toutes les sauvegardes. Deux tests s'en prémunissent, et les deux s'exécutent contre une vraie base de données dans les deux modes de stockage. Les tables des rapports planifiés (`report_definitions`, `report_runs`) sont les premières tables ajoutées sous ces garde-fous. Les fichiers de sortie des rapports sont sur le volume des rapports et ne font pas partie d'une sauvegarde de base de données. `tag_history` est chargée en dernier à la restauration : elle n'a pas de clé étrangère propre et c'est de loin la plus grande table, si bien que chaque petite table de configuration échoue vite, si elle doit échouer, avant même que cette longue étape ne commence.

**`settings` a une exception délibérée.** La ligne `history_mode` est écrite par `store.ensureHistorySchema` lui-même, une seule fois, au moment où `Migrate` construit un schéma à partir de rien : elle consigne si *ce serveur* a construit `tag_history` comme hypertable TimescaleDB ou comme table partitionnée nativement, ce qui est un fait sur la base de données sur laquelle `Migrate` vient de tourner, pas un fait sur l'usine. Elle est exclue à la fois de la sauvegarde et de la restauration de `settings` : restaurer la décision historique d'une installation source sur une cible aux capacités différentes (ou même sur une nouvelle exécution de `Migrate` contre le même genre de serveur) pourrait réécrire cette ligne pour décrire une forme que la cible n'a pas réellement. Le `Migrate` de la cible a déjà pris la bonne décision avant que `Restore` ne regarde `settings`, et cette décision est laissée telle quelle.

## Sauvegardes à la demande

- `POST /api/backup` (`backup.run`, réservé aux administrateurs) fait une sauvegarde immédiatement et renvoie le manifeste.
- `GET /api/backup` (`backup.read`, réservé aux administrateurs) liste ce qui se trouve sur le volume de sauvegarde : nom, taille sur disque, et manifeste (liste des tables, nombre de lignes, version de HotLoop, horodatage) de chacune.

Les deux sont réservées aux administrateurs par omission du rôle opérateur, le même rétrécissement que `fleet.restart`/`fleet.config`/`notify.test` appliquent déjà à d'autres actions opérationnelles, de type « faites-le maintenant » ou à portée administrative. Le nombre de lignes d'une liste de sauvegardes, `users` et `sessions` compris, ressemble plus à un diagnostic administratif qu'aux lectures de l'atelier (appareils, tags, alarmes) que le rôle opérateur est censé voir, donc `backup.read` n'a pas été scindée en une permission plus basse comme certaines lectures ; c'est un jugement, pas une contrainte technique, et cela pourrait être revu si un vrai flux de travail d'opérateur en avait besoin.

## Planification et rétention

`HOTLOOP_BACKUP_INTERVAL` (p. ex. `24h`) lance une sauvegarde à intervalle fixe. C'est volontairement un simple intervalle, pas un analyseur d'expressions cron : le besoin réaliste est « sauvegarder ceci de temps en temps », et la convention de ce projet est de ne pas construire pour un besoin que personne n'a encore. Le laisser non défini (ou à `0`) désactive le planificateur ; le point d'accès à la demande fonctionne toujours, pour un opérateur ou un cron externe qui préfère la déclencher lui-même.

`HOTLOOP_BACKUP_RETAIN` (par défaut `7`) conserve les N répertoires de sauvegarde les plus récents et supprime les plus anciens après chaque sauvegarde réussie. `0` ou moins conserve tout, un choix que l'exploitant doit faire délibérément sur un petit volume.

## Restaurer une sauvegarde

**La restauration n'est volontairement pas un point d'accès de l'API.** Automatiser « restaurer maintenant » comme une action en direct, déclenchable par le réseau, contre une base de données qui peut servir du trafic de production est un vrai danger : un mauvais clic, ou une session d'administrateur compromise, écrase des données en production, et ce projet ne le construit pas sans qu'on le lui demande expressément. La restauration est une option du binaire lui-même, lancée une fois, à la main, par un exploitant qui a déjà décidé que la base de données cible doit la recevoir :

```sh
hotloop --restore-from=/data/backups/20260918T220000Z
```

Ce que cela fait, dans l'ordre :

1. Charge la configuration et se connecte à la base de données exactement comme un démarrage ordinaire : `store.Open` exécute les mêmes migrations et construit le schéma dans lequel la restauration va charger les données.
2. **Refuse une sauvegarde qu'elle ne peut pas charger sans rien perdre** : une réalisée avec un schéma plus récent que celui de cette base de données, ou une avec une table ou une colonne que cette version n'a plus. Les deux sont vérifiés avant de charger une seule ligne. Voir « Restaurer vers une version différente » ci-dessous.
3. **Refuse si une table cible contient déjà des données** au-delà de ce que `Migrate` vient lui-même d'amorcer (l'unique ligne `history_mode` de `settings`) : la restauration ne s'exécute que contre une base de données encore vide. C'est le contrôle de sécurité : une table avec ne serait-ce qu'une ligne existante arrête toute la restauration avant qu'aucun `COPY FROM STDIN` ne s'exécute.
4. Charge chaque table, dans l'ordre de dépendance, dans une seule transaction, dans les colonnes que nomme le manifeste.
5. Réinitialise la séquence sous-jacente de chaque table dont la clé primaire est `bigserial` (`tags`, `alarm_events`, `automation_runs`, `events`, `write_audit`, `sessions`) à un de plus que le plus haut identifiant restauré : `COPY FROM STDIN` charge des valeurs d'identifiant explicites sans toucher à la séquence, donc l'omettre ferait entrer en collision la toute prochaine insertion ordinaire avec une ligne restaurée.
6. Recompte chaque table et compare au nombre de lignes du manifeste, dans la même transaction toujours ouverte.
7. Valide seulement si tous les comptes correspondent. Un écart, ou une erreur à n'importe quelle étape antérieure, annule toute la transaction et laisse la base de données cible exactement aussi vide qu'elle l'était, jamais chargée partiellement.
8. Se termine. Rien d'autre ne démarre dans le processus : ni planificateur d'interrogation, ni moteur d'alarmes, ni serveur d'API. Une restauration n'a besoin d'aucun d'eux, et démarrer l'exécution contre une base de données en cours de restauration serait un danger en soi.

### Passer à PostgreSQL 17

Cette sauvegarde est faite par l'application en cours d'exécution, via sa connexion à la base de données en cours d'exécution, elle ne peut donc pas être la sauvegarde du passage de PostgreSQL 16 à 17 : ce passage a lieu avant le démarrage de la base de données. La sécurité de la mise à niveau elle-même est qu'elle n'écrit jamais dans le répertoire PostgreSQL 16, qu'elle garde intact sous `pgdata.pg16` (la page k3s et Helm, « PostgreSQL 17 »). Faites tout de même cette sauvegarde sur l'ancienne version avant de mettre à niveau, car c'est la copie qui vit hors de la machine. La restaurer dans la nouvelle base de données est la restauration ordinaire ci-dessous : elle transporte des lignes, pas le moteur, donc la version majeure qui les a écrites lui est indifférente.

### Restaurer vers une version différente

La version avec laquelle vous restaurez est rarement celle qui a fait la sauvegarde. La sauvegarde a été faite il y a des mois avec ce qui tournait alors, et la machine que vous reconstruisez exécute celle d'aujourd'hui. Voici donc ce qui se restaure sur quoi.

**Une ancienne sauvegarde sur un HotLoop plus récent : oui.** C'est le cas qui compte, et il est testé depuis tous les niveaux de schéma qui ont existé, de `0001_core` à aujourd'hui, sur TimescaleDB et sur PostgreSQL simple, avec l'application démarrée ensuite.

- Chaque manifeste consigne les colonnes de chaque table, noms et types. La restauration charge chaque fichier exactement dans ces colonnes, par nom. Une colonne ajoutée depuis la sauvegarde prend sa valeur par défaut. `entity_id`, `service` et `call_id` de `write_audit` reviennent vides sur chaque ligne d'audit antérieure aux services d'entités, ce qui est ce que ces lignes étaient : de simples écritures de tags.
- Une table ajoutée depuis la sauvegarde reste vide, et l'application remplit ce qu'elle peut au démarrage. La première synchronisation du registre d'entités donne à chaque tag restauré son entité de lecture, à chaque tag armé son entité de commande et à chaque définition d'alarme son entité d'alarme, avec les noms que le registre leur aurait donnés. Les appareils d'une sauvegarde antérieure à l'arbre des équipements y sont placés selon le texte de leur site, zone et ligne pendant la restauration elle-même, comme la mise à niveau les y a placés. Ce qui n'a jamais été dans la sauvegarde ne peut pas revenir : libellés, entités composites, et noms d'entités qu'un opérateur a personnalisés après la sauvegarde.

**Une sauvegarde plus récente sur un HotLoop plus ancien : non, refusée.** Le manifeste consigne chaque migration appliquée à la base de données de la sauvegarde. S'il en contient une que cette base de données n'a jamais exécutée, la restauration s'arrête avant de charger une ligne et le dit :

```
refusing to restore: this backup was taken by HotLoop <its version> with the
database schema at <its newest migration>, which is newer than this database's
schema at <this database's newest migration> (HotLoop <this version>). ...
Restore it with HotLoop <its version> or a later release
```

« Plus récente » désigne des migrations, pas des chaînes de version. Une chaîne de version dit quel binaire a fait la sauvegarde, et les builds de développement, les versions candidates et les branches de correctif font de leur comparaison une supposition. Les migrations disent ce qu'était réellement le schéma, et elles sont comparées comme un ensemble, donc une migration manquante est repérée où qu'elle tombe dans l'ordre. Les versions figurent dans le message parce que la version est ce sur quoi vous pouvez agir : avec quelle version restaurer.

**Une sauvegarde avec une colonne que cette version n'a plus : refusée, par nom.** Le jour où une migration supprime, renomme ou change le type d'une colonne, une sauvegarde antérieure contient des données pour lesquelles la nouvelle table n'a pas de place. La restauration ne devine pas. Elle nomme chacune de ces colonnes, dans toutes les tables, avant de charger quoi que ce soit :

- une colonne que la table en cours n'a pas est refusée, sauf si `backup.columnRenames` l'associe à son nouveau nom. Une migration qui renomme une colonne ajoute cette entrée, et un test restaurant une sauvegarde antérieure, dans le même changement. Il n'y a aucun renommage aujourd'hui, donc la table est vide ;
- une colonne dont le type a changé est refusée. Le COPY binaire ne transporte pas de types, donc les octets seraient lus comme le nouveau type ou rejetés en cours de route ;
- une colonne que la table en cours a ajoutée en `NOT NULL` sans valeur par défaut est refusée, car rien ne pourrait la remplir.

La sortie est la même pour les trois : restaurer avec la version qui a fait la sauvegarde, puis mettre à niveau cette base de données sur place, ce qui est la manière dont la migration était prévue pour rencontrer ces données.

Charger par nom couvre aussi le changement que personne ne remarque : une colonne supprimée puis rajoutée, ou une table reconstruite, de sorte que les colonnes se retrouvent dans un autre ordre. Charger par position mettrait les valeurs d'une colonne dans une autre sans erreur chaque fois que les types concordent. Par nom, chacune tombe où elle doit.

**Les sauvegardes faites avant que les manifestes ne consignent tout cela** (toute sauvegarde faite avant cette version) n'ont ni listes de colonnes ni schéma. Elles se restaurent quand même :

- Sans listes de colonnes, la restauration se rabat sur la position. Un fichier avec moins de colonnes que la table va dans les premières colonnes de la table, et le reste prend ses valeurs par défaut. C'est correct pour tous les schémas jusqu'ici, car toutes les migrations à ce jour n'ont fait qu'ajouter des colonnes, et `ALTER TABLE ADD COLUMN` ajoute toujours à la fin. Un fichier avec plus de colonnes que la table est refusé par PostgreSQL lui-même.
- Sans schéma, la restauration suppose que la sauvegarde est aussi récente qu'elle puisse l'être : `0007_service_audit.sql`, la migration la plus récente qui existait quand les manifestes ont commencé à la consigner. Cette hypothèse ne peut que refuser une restauration qui aurait fonctionné, jamais en laisser passer une qui n'aurait pas fonctionné. En pratique elle ne refuse rien, car tout HotLoop doté de ce contrôle a déjà exécuté toutes les migrations jusqu'à celle-là.

La première sauvegarde que fait cette version consigne tout, donc le repli ne compte que pour les sauvegardes déjà présentes sur un volume de sauvegarde.

### Procédure de restauration, pas à pas

1. Amenez le répertoire de sauvegarde sur la machine ou le volume que le binaire `hotloop` du déploiement cible peut lire : c'est le moment où la copie hors machine du volume de sauvegarde faite par l'exploitant revient en jeu.
2. Pointez `HOTLOOP_DB_*` vers la base de données **cible**. Elle doit être joignable et ne contenir encore aucune donnée dans les tables sauvegardées (une base de données neuve et vide est le cas normal ; le schéma sera construit à l'étape 3).
3. Lancez `hotloop --restore-from=<path to the backup directory>`.
4. Lisez la dernière ligne du journal : `restore complete` avec le nombre de tables et de lignes, ou une erreur expliquant exactement ce qui a été refusé et pourquoi.
5. Démarrez `hotloop` normalement contre cette même base de données.

## Passer d'une base de données à une autre

Une sauvegarde est la même chose quelle que soit la base de données qui l'a faite : des fichiers COPY binaires de PostgreSQL et un manifeste qui nomme le type Postgres de chaque colonne. Passer une usine d'une base de données à une autre revient donc à une sauvegarde sur l'ancienne et une restauration dans la nouvelle. Rien d'autre.

- **De SQLite vers Postgres ou TimescaleDB.** Le Pi que son fichier ne suffit plus. Faites une sauvegarde, pointez `HOTLOOP_DB_*` vers le nouveau serveur (`HOTLOOP_DB_TYPE=postgres`), restaurez. Sur un serveur TimescaleDB, l'historique atterrit dans une hypertable.
- **De Postgres ou TimescaleDB vers SQLite.** Une usine qui redescend sur une petite machine. La même chose dans l'autre sens, avec `HOTLOOP_DB_TYPE=sqlite`.
- **De Postgres simple vers TimescaleDB, et inversement.** Le mode d'historique est persistant, donc pointer un Gateway vers le Postgres simple d'une machine IoT conserve ses partitions. Pour obtenir une hypertable, restaurez dans un TimescaleDB neuf. Dans l'autre sens, vous obtenez des partitions.

Ce qui est vérifié à l'entrée est ce qui est vérifié pour toute restauration : chaque colonne par nom et par type face à la cible, avec les colonnes de SQLite lues comme leurs types Postgres, si bien qu'une sauvegarde de l'un se restaure dans l'autre ou est refusée pour la même raison qu'ailleurs. `history_mode` n'est jamais copié : la cible garde ce que ses propres migrations ont décidé. Les séquences sont correctes des deux côtés : sur Postgres, `fixSequences` les déplace, et l'AUTOINCREMENT de SQLite avance tout seul au-delà de tout identifiant qui y est restauré.

## Configuration

| Variable | Valeur par défaut | <span class="sr-only">Details</span> |
|---|---|---|
| `HOTLOOP_BACKUP_ENABLED` | `false` | La fonction est désactivée, routes de l'API comprises, tant que ceci n'est pas défini |
| `HOTLOOP_BACKUP_DIR` | `/data/backups` | Où les sauvegardes sont écrites ; prévu pour être un PVC (`backup.persistence` dans le chart) |
| `HOTLOOP_BACKUP_RETAIN` | `7` | Les N sauvegardes les plus récentes sont conservées ; `0` ou moins conserve tout |
| `HOTLOOP_BACKUP_INTERVAL` | non défini | p. ex. `24h` ; non défini signifie à la demande seulement |

`--restore-from=<dir>` est une option de ligne de commande du binaire `hotloop`, pas une variable d'environnement ; voir « Restaurer une sauvegarde » ci-dessus.

## Ce qui a été vérifié et ce qui ne l'a pas été

HotLoop a été exécuté sur de vrais équipements et de vrais serveurs, et sur du bare metal le 2026-11-17.
