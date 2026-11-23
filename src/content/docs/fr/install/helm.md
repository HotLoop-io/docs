---
title: "k3s et Helm"
description: "Déployez tout chart HotLoop sur k3s ou Kubernetes : les valeurs à régler, le choix de la base de données, les mises à jour et les retours en arrière."
---

Le chart déploie deux charges de travail : le gateway (un Deployment, qui ne garde aucun état durable en propre) et TimescaleDB (un StatefulSet avec un volume). C'est le réglage par défaut. `database.type` choisit une autre base de données : PostgreSQL simple, ou SQLite, qui n'est plus du tout une seconde charge de travail ([SQLite](#sqlite), plus bas).

## Installation

Par l'App Store du tableau de bord EmberNet, ou directement :

```bash
helm install hotloop ./charts/hotloop \
  --namespace hotloop --create-namespace
```

Ou depuis le dépôt de charts, qui est aussi l'URL vers laquelle pointe l'App Store :

```bash
helm repo add hotloop https://hotloop.io/hotloop
helm install hotloop hotloop/hotloop \
  --namespace hotloop --create-namespace
```

Cette seconde forme fonctionne à partir de la 4.16.0, la première version publiée sous le nom `hotloop`. La dernière avant elle était `industrial-iot` 4.3.1, sous l'ancien nom, et en partir est une procédure à part : voir « Upgrading from 4.3.1 » dans les notes de la 4.16.0 du README. L'ancienne adresse du dépôt, `https://embernet-ai.github.io/industrial-iot/`, renvoie une 404.

Une installation nue fonctionne. Le chart génère un mot de passe de base de données et un jeton MCP dans le Secret de la release et les réutilise à chaque mise à jour : il n'y a rien à fournir, et une mise à jour ne change pas le mot de passe sous une base de données en marche.

L'atteindre ne demande ni ingress ni sous-domaine. Le tableau de bord découvre l'application par ses étiquettes de store et la sert par proxy à l'adresse interne du cluster :

```
<release>.<namespace>.svc.cluster.local:8080
```

Pour la voir directement :

```bash
kubectl -n hotloop port-forward svc/hotloop 8080:8080
```

## Valeurs à régler

### Authentification

Depuis la 4.4.0. Voir [Authentification et utilisateurs](/fr/iot/authentication/) pour le modèle complet ; ceci est le côté chart.

```yaml
auth:
  enabled: true    # the default; requires a login
  insecure: false  # set true only for a deployment truly isolated behind the
                    # dashboard's own NetworkPolicy -- see AUTH.md
```

Avec `enabled: true` (la valeur par défaut), le chart génère un compte administrateur dans le Secret de la release à la première installation, comme il génère le mot de passe de la base de données et le jeton MCP, et le réutilise à chaque mise à jour :

```bash
kubectl get secret hotloop -n hotloop \
  -o jsonpath='{.data.admin-password}' | base64 -d
```

Définir `auth.admin.password` explicitement remplace celui qui est généré.

### Sécurité

Les valeurs qui décident si ce pod peut déplacer des machines.

```yaml
safety:
  allowWrites: false      # the master switch -- off by default since 4.4.0
  allowMcpWrites: true    # agents (MCP) write wherever an operator could, once writes are on
  confirmWrites: true     # the UI asks before writing
```

Les écritures sont désactivées par défaut. Un tag reste en lecture seule tant que son propre drapeau `writable` n'est pas activé, une valeur hors de la plage configurée du tag est refusée (jamais tronquée : envoyer 250 quand quelqu'un a saisi 500, c'est faire autre chose en silence), et chaque tentative, **y compris chaque refus**, est enregistrée avec l'acteur et la source. Mais une installation neuve ne devrait pas avoir besoin que ces trois éléments s'alignent pour être sûre : l'interrupteur général commence donc fermé.

Pour activer les écritures une fois le déploiement revu :

```yaml
safety:
  allowWrites: true
```

C'est tout : les clients MCP lisent et écrivent comme un opérateur, avec les mêmes autorisations, tags inscriptibles et plages. `allowMcpWrites` est activé dans chaque chart ; il existe pour un déploiement qui en déciderait autrement, et ce n'est un réglage par défaut nulle part.

### Historien

```yaml
historian:
  retentionDays: 90     # 0 keeps everything until the volume fills
  useTimescale: true

logbook:
  retentionDays: 90     # entity state changes; 0 keeps everything (see LOGBOOK.md)

database:
  postgresql:
    persistence:
      size: 20Gi
      storageClass: longhorn
```

Le dimensionnement dépend du nombre de tags, de la cadence de lecture et des zones mortes. Mille tags à une seconde sans zones mortes représentent environ 86 millions de lignes par jour ; la même usine avec des zones mortes raisonnables en compte généralement un ordre de grandeur de moins. Réglez les zones mortes avant d'acheter du stockage.

`useTimescale: false` force le chemin du partitionnement natif, c'est ce à quoi ressemble un fonctionnement sur un PostgreSQL simple. Utile pour reproduire un déploiement en périphérie.

**Quand l'image TimescaleDB change.** L'image embarque la bibliothèque de chaque version antérieure : une base de données créée avec une image plus ancienne continue donc de fonctionner avec la nouvelle, mais sur l'ancienne version de l'extension, et y reste tant que personne n'exécute `ALTER EXTENSION timescaledb UPDATE`. Le Gateway le fait au démarrage : il compare la version installée à celle que livre le serveur et, si elles diffèrent, exécute la mise à jour comme première instruction d'une connexion neuve (TimescaleDB la refuse dans une session qui a déjà chargé l'ancienne version). Le journal indique `timescaledb extension updated from=... to=...`. Cela demande un superutilisateur, ce qu'est l'utilisateur de la base de données incluse. Avec une base externe ou gérée où il ne l'est pas, vous obtenez un avertissement avec la commande à exécuter, et l'historique continue de fonctionner sur l'ancienne version en attendant. Cela n'arrive que si `useTimescale` est activé et que les migrations s'exécutent au démarrage (`HOTLOOP_DB_MIGRATE`, activé par défaut).

### Interrogation

```yaml
runtime:
  defaultPollIntervalMs: 1000
  minPollIntervalMs: 100      # a floor applied to every device
  timeoutMs: 10000
  maxConcurrentPolls: 32
```

`minPollIntervalMs` est imposé plutôt que supposé respecté. Une interrogation à 10 ms sur un gateway série est un déni de service avec des étapes en plus.

### Client OPC UA

```yaml
opcuaClient:
  persistence:
    enabled: true      # off by default
    size: 64Mi
```

Un appareil qui se connecte à un serveur OPC UA sécurisé, ou qui s'authentifie avec un nom d'utilisateur et un mot de passe que le serveur exige chiffrés, garde un certificat et un magasin de confiance des certificats de serveur approuvés (`HOTLOOP_OPCUA_CLIENT_PKI_DIR`, `/data/opcua-client-pki`). Activez-le avant d'ajouter un tel appareil : le système de fichiers racine est en lecture seule, donc sans le volume l'appareil signale une erreur qui le dit au lieu de se connecter avec des certificats qui seraient perdus au prochain redémarrage. Il est désactivé par défaut parce qu'il ajoute un PersistentVolumeClaim à une installation existante, qui reste en Pending sur un cluster sans StorageClass par défaut. Les appareils anonymes sur un canal non sécurisé ne l'utilisent pas. Approuver le certificat d'un serveur, et tout le reste de ces appareils, est dans [Protocoles et drivers](/fr/iot/protocols/#opc-ua-sécurité-et-identifiants).

### Réseau

```yaml
networkPolicy:
  enabled: true
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: dashboard-system
      ports:
        - protocol: TCP
          port: 8080
```

Restreignez l'ingress au namespace du tableau de bord dès qu'il est connu. L'egress est volontairement illimité : cette application existe pour joindre des équipements à des adresses que personne ne peut énumérer d'avance, et une politique d'egress qui bloque une interrogation en silence ressemble à un driver cassé plutôt qu'à une règle de pare-feu.

### Matériel : radios USB, adaptateurs série et Bluetooth

Depuis la 4.19.7, chaque chart HotLoop (Gateway, IoT, Edge et Edge Relay) livre activé l'accès dont le matériel a besoin : une installation simple depuis l'App Store ou depuis helm voit ce qui est branché sur le nœud sans aucune modification manuelle, sur le réseau des pods. C'est le bloc `hardware:` de `values.yaml` : trois interrupteurs activés par défaut, et une option désactivée par défaut :

| Valeur | Par défaut | Ce que ça fait |
|---|---|---|
| `hardware.privileged` | `true` | Le conteneur de l'application s'exécute en privilégié (`privileged: true`, `allowPrivilegeEscalation: true`) et en root (`runAsUser: 0`, `runAsNonRoot: false`, sans retrait de capacités). Root parce qu'un nœud série USB est `root:dialout 0660` et que la politique D-Bus de BlueZ laisse entrer root et le groupe `bluetooth` ; un utilisateur de conteneur dans aucun des deux n'ouvre rien. Le système de fichiers racine reste en lecture seule, et le conteneur d'initialisation et la base de données incluse gardent leur propre contexte non root, toutes capacités retirées. |
| `hardware.usbDevices.enabled` | `true` | Le `/dev` du nœud (`hardware.usbDevices.hostPath`) est monté sur `/dev` : adaptateurs série USB (`/dev/ttyUSB*`, `/dev/ttyACM*`, `/dev/serial/by-id/*`), y compris un branché après le démarrage du pod. Un conteneur privilégié ne reçoit que les appareils qui existaient à son démarrage ; c'est le montage qui fait apparaître une clé rebranchée. |
| `hardware.bluetooth.enabled` | `true` | Le répertoire D-Bus du nœud (`hardware.bluetooth.dbusPath`, `/run/dbus`, qui contient `system_bus_socket`) est monté au même chemin, de sorte qu'un client atteint le BlueZ du nœud. Il est créé vide sur un nœud sans D-Bus, donc le pod démarre quand même. |
| `hardware.bluetooth.hostNetwork` | `false` | L'option à activer soi-même, désactivée par défaut, pour ce qui a besoin du réseau du nœud : les sockets Bluetooth du noyau (HCI, L2CAP) n'existent que dans l'espace de noms réseau du nœud, donc un client qui en ouvre un directement, et la découverte qui écoute sur le réseau propre du nœud (mDNS, SSDP, le multicast d'une radio), en ont besoin. Un client qui passe par l'API D-Bus de BlueZ n'a besoin que du socket monté et fonctionne depuis le réseau des pods. Activé, le pod s'exécute sur le réseau du nœud avec les conséquences décrites sous [Réseau](#réseau). |

Ce que HotLoop en fait aujourd'hui : rien encore. HotLoop n'a pas de code Bluetooth, Z-Wave ou série USB à lui (Zigbee passe par un pont Zigbee2MQTT sur MQTT, voir [le broker MQTT intégré](/fr/iot/broker/)) ; c'est l'accès dont a besoin une fonction, ou un sidecar qui lit une radio, mis en place avant qu'on le demande.

Ce que ça coûte, volontairement et par décision : le pod est root sur le nœud (privilégié, avec le `/dev` du nœud), et la NetworkPolicy par défaut du chart reste activée pour ce qu'elle couvre. Le pod reste sur le réseau des pods. Désactivez n'importe quelle partie avec `--set hardware.privileged=false --set hardware.usbDevices.enabled=false --set hardware.bluetooth.enabled=false` ; avec les trois désactivées, le rendu est, ligne pour ligne, celui du pod de la 4.19.6 (non root, toutes capacités retirées, racine en lecture seule, réseau des pods). Pour ce qui a besoin du réseau du nœud, définissez `hardware.bluetooth.hostNetwork=true` (ou `hostNetwork=true`) : la page répond alors sur chaque adresse du nœud à `service.targetPort`, un HotLoop par nœud et par port, une NetworkPolicy ne s'applique pas au pod, et `nodeSelector` l'épingle au nœud dont il doit voir la radio.

### Déploiements en périphérie

L'image de l'application est construite pour amd64 et arm64, et TimescaleDB 2.30.1-pg17 est multi-architecture : l'historien n'est donc pas ce qui bloque une installation en périphérie.

```yaml
resources:
  requests: {cpu: 100m, memory: 128Mi}
  limits:   {cpu: 500m, memory: 256Mi}

database:
  postgresql:
    persistence: {size: 5Gi}
    resources:
      requests: {cpu: 100m, memory: 256Mi}
      limits:   {cpu: 500m, memory: 512Mi}

historian:
  retentionDays: 30

nodeSelector:
  kubernetes.io/arch: arm64
```

### Publier vers l'amont avec Sparkplug

Un Gateway en périphérie peut aussi publier tout ce qu'il lit vers un Gateway central, comme nœud de périphérie Sparkplug B. Voir [Publication en périphérie et stockage et retransmission](/fr/edge/edge-publish/) pour ce qu'il publie et le comportement de la file de retransmission ; ceci est le côté chart.

```yaml
edgePublish:
  enabled: true
  broker: tcp://central.example.local:1883
  group: Plant1
  node: press-line-3          # empty uses the release name
  username: press-line-3
  existingSecret: central-mqtt # key "password", or set secretKey
  tls: false
  queueMaxBytes: 536870912     # 512 MiB; the default is 64 MiB, and 0 is unbounded
  persistence:
    size: 1Gi
```

Ce que change l'activation, et pourquoi :

- **Un PVC de 1Gi pour la file de retransmission**, monté sur `/data/edge-publish`. C'est là que s'accumulent les lectures tant que la liaison montante est coupée, donc il doit survivre au pod. `persistence.enabled: false` le place sur un emptyDir, qui survit à un redémarrage du conteneur et à rien d'autre.
- **Le Deployment se met à jour avec `Recreate`.** La file est un seul fichier verrouillé. Une mise à jour progressive démarre d'abord le nouveau pod, le nouveau pod ne peut pas ouvrir la file, ne devient jamais prêt, et le déploiement reste bloqué pour toujours. Recreate arrête d'abord l'ancien ; vous perdez quelques secondes d'interrogation par mise à jour.
- **`replicaCount` doit valoir 1**, et le chart refuse le rendu sinon. Deux réplicas seraient deux éditeurs revendiquant un même nœud Sparkplug.
- **L'identifiant du nœud est par défaut le nom de la release**, pas le nom d'hôte du pod. Le nom d'hôte change à chaque déploiement, et un hôte Sparkplug verrait un nouveau nœud de périphérie à chaque fois.

Le mot de passe n'est jamais dans une valeur par défaut en clair. Laissez `password` et `existingSecret` vides pour un broker anonyme et aucun Secret n'est créé ; définissez `password` et le chart le place dans `<release>-edge-publish` ; définissez `existingSecret` pour en utiliser un que vous gérez.

### Base de données externe

```yaml
database:
  postgresql:
    enabled: false
    auth:
      existingSecret: my-db-credentials
      secretKey: password
  external:
    host: timescale.plant.local
    port: 5432
    database: industrial
    username: industrial
  sslMode: require
```

L'application détecte TimescaleDB et promeut `tag_history` en hypertable quand l'extension est présente. Sur un PostgreSQL simple, elle se rabat sur le partitionnement natif par plages au lieu d'échouer.

La décision est enregistrée et **définitive**. Une base de données créée en hypertable refuse de démarrer sur un serveur sans l'extension plutôt que d'écrire ailleurs en silence ; si vous voyez cette erreur, vous avez pointé l'application vers une autre base de données que celle sur laquelle elle a été construite.

### SQLite

La base de données est un réglage, pas une image. Chaque produit fonctionne sur SQLite, Postgres ou TimescaleDB avec le même binaire (IoT laisse TimescaleDB de côté, voir plus bas) :

| Variable | Par défaut | Ce que ça fait |
|---|---|---|
| `HOTLOOP_DB_TYPE` | `postgres` | `postgres` ou `sqlite`. TimescaleDB est `postgres` avec l'extension sur le serveur |
| `HOTLOOP_DB_PATH` | `/data/hotloop.db` | Le fichier SQLite. Seul SQLite le lit |

SQLite est la version pure Go (`modernc.org/sqlite`), compilée dans chaque image : pas de second conteneur, pas d'image Postgres de 300 Mo sur une carte SD, et les builds arm restent statiques. Mettez le fichier sur un volume qui survit au conteneur, et sur un Pi mettez ce volume sur un SSD USB. Un historien qui écrit toute la journée sur une carte SD, c'est le moyen d'acheter beaucoup de cartes SD.

Ce qui est identique : chaque table, chaque colonne, chaque fonctionnalité. Ce qui diffère :

- L'historique est une table avec un index, pas des partitions ni une hypertable, et la rétention supprime les anciennes lignes au lieu de supprimer des mois. Un site avec des années d'historique à la seconde veut Postgres ou TimescaleDB, et y passer est une sauvegarde et une restauration (BACKUP.md).
- Un seul écrivain à la fois. SQLite alterne les écritures et lit en parallèle (WAL), ce qui suffit largement pour un HotLoop et un assistant `--mcp-stdio` à côté sur le même fichier. Ce n'est pas fait pour deux réplicas sur du stockage réseau : SQLite sur NFS se corrompt, donc un déploiement SQLite est un pod avec un volume local.
- Les validations sont en `synchronous=FULL` : quand l'API dit qu'elle a enregistré, c'est sur le disque, coupure de courant ou non.

**HotLoop IoT** utilise par défaut 30 jours d'historique (`HOTLOOP_HISTORIAN_RETENTION_DAYS` l'emporte toujours quand il est défini) et ne construit jamais d'hypertable : TimescaleDB fait partie d'Edge et du Gateway. Définissez `HOTLOOP_HISTORIAN_TIMESCALE=true` sur IoT et il le dit au démarrage et fonctionne sur des partitions simples. Une base de données descendue d'un Edge ou d'un Gateway qui a déjà une hypertable la garde et continue de fonctionner.

#### Choisir la base de données dans le chart

Une valeur, `database.type`, et chaque produit accepte celles sur lesquelles il fonctionne :

| `database.type` | Ce qui est déployé | IoT | Edge | Gateway |
|---|---|---|---|---|
| `timescaledb` | L'application et TimescaleDB (un StatefulSet et son volume). Historique dans une hypertable | refusé | par défaut | par défaut |
| `postgresql` | L'application et PostgreSQL 17 simple (un StatefulSet et son volume). Historique en partitions natives | par défaut | oui | oui |
| `sqlite` | L'application seule, avec le fichier de base de données sur un volume à part | oui | oui | oui |

```bash
helm install hotloop hotloop/hotloop-iot --namespace hotloop --create-namespace   --set database.type=sqlite
```

Demander `timescaledb` à IoT fait échouer l'installation et dit sur quoi IoT fonctionne (`database.type is "timescaledb", and HotLoop IoT runs on sqlite, postgresql`), et le formulaire de l'App Store ne le propose pas. `helm lint` ne l'attrape pas (helm 3.22 le déclare propre), c'est donc le rendu qui refuse. Omettre `database.type` donne le défaut du produit lui-même, si bien qu'une mise à jour avec `--reuse-values` depuis avant l'existence de la clé garde la base de données qu'elle avait.

`sqlite` produit :

- `HOTLOOP_DB_TYPE=sqlite` et `HOTLOOP_DB_PATH=/data/db/hotloop.db`, et aucun des réglages de connexion Postgres. Pas de pod de base de données, pas de mot de passe de base de données dans le Secret, pas de conteneur d'initialisation qui en attend un.
- Un PersistentVolumeClaim nommé `<release>-db` (`database.sqlite.persistence` : `size`, `storageClass`, `accessMode`, 10Gi et le défaut du cluster pour commencer), monté sur `/data/db`. Le répertoire, pas le fichier : SQLite garde un `-wal` et un `-shm` à côté de la base. Mettez-le sur un stockage local ; SQLite sur NFS se corrompt.
- Le Deployment en `Recreate`, pas en mise à jour progressive, parce que le volume est `ReadWriteOnce` et que le fichier n'a qu'un seul écrivain. Un `replicaCount` supérieur à 1 fait échouer l'installation.

La NetworkPolicy ne change pas et reste activée : la politique propre de l'application s'applique toujours, et la politique de la base de données n'est produite que s'il y a un pod de base de données à protéger.

Changer `database.type` sur une release qui a déjà des données ne déplace pas les données. La nouvelle base de données démarre vide, donc passer une usine d'une base à une autre est une sauvegarde et une restauration (BACKUP.md), comme avec la variable. En particulier, une base de données créée en hypertable TimescaleDB refuse de démarrer sur PostgreSQL simple : ne faites pas passer un Edge ou un Gateway existant de `timescaledb` à `postgresql` en espérant qu'il démarre.

#### Choisir la base de données dans Quadlet

Le répertoire de chaque produit sous `deploy/quadlet/` contient les fichiers PostgreSQL ou TimescaleDB tels qu'ils étaient, et un répertoire `sqlite/` à côté : `hotloop.container` et `hotloop-data.volume`, l'application seule avec le fichier à `/data/hotloop.db` sur le volume `hotloop-data`. Il suit `:stable` et annule une mauvaise mise à jour de la même façon. Installez ces deux fichiers à la place des autres (ils utilisent les mêmes noms d'unité), et créez deux secrets au lieu de trois : il n'y a pas de mot de passe de base de données. [`deploy/quadlet/README.md`](/fr/install/quadlet/) donne les étapes.

Pour des partitions Postgres simples sur Edge ou le Gateway sous Quadlet, gardez l'unité TimescaleDB et ajoutez `Environment=HOTLOOP_HISTORIAN_TIMESCALE=false` à `hotloop.container`. L'unité d'IoT fait déjà tourner PostgreSQL simple.

### La clé des identifiants d'appareils

```yaml
secretKey:
  enabled: true
  existingSecret: ""     # or a Secret you manage, with the key under secret.key
```

Les mots de passe d'appareils (identifiant d'une console UniFi, mot de passe OPC UA ou MQTT, clés d'API HTTP) sont chiffrés dans la base de données avec cette clé : un dump ou une sauvegarde ne contient donc que du texte chiffré. Par défaut, le chart en génère une dans `<release>-secret-key` à la première installation, la conserve à chaque mise à jour, et la conserve aussi à `helm uninstall` (`helm.sh/resource-policy: keep`), car une base de données conservée sur son volume ne sert à rien pour ses identifiants sans elle. Elle est montée comme fichier et passée en `HOTLOOP_SECRET_KEY_FILE`, jamais comme variable d'environnement.

Sauvegardez le Secret séparément des sauvegardes de la base de données : une clé posée à côté des sauvegardes qu'elle protège ne protège rien. Pour apporter la vôtre, `hotloop gen-secret-key` en affiche une. En dehors de Kubernetes, écrivez-la dans un fichier que seul HotLoop peut lire et pointez `HOTLOOP_SECRET_KEY_FILE` vers lui. Sans clé, HotLoop fonctionne, dit dans son journal de démarrage que les mots de passe d'appareils sont stockés tels que saisis, et refuse d'enregistrer une console UniFi. Les identifiants déjà stockés sont chiffrés au premier démarrage avec une clé. Voir [Sauvegardes et restauration](/fr/iot/backup/#identifiants-dappareils-et-clé-secrète) pour ce que cela implique pour une restauration.

## Configuration, et ce que l'écran Paramètres peut modifier

Presque chaque paramètre vient d'une variable d'environnement que le chart définit à partir d'une valeur Helm. C'est le bon endroit : la configuration qui décide si ce processus peut commander des machines appartient au déploiement, revue, pas à un formulaire sur une page web.

L'écran **Paramètres** les montre tous, chaque paramètre, sa valeur effective, s'il vient de la base de données, d'une variable d'environnement ou de la valeur intégrée par défaut, et la variable qui le change. L'essentiel est en lecture seule, et c'est voulu : la question à laquelle il répond est « pourquoi fait-il cela, et que dois-je changer ? »

Quatre paramètres relèvent de l'identité de l'usine et non du comportement, et sont modifiables là. Ils sont stockés dans la base de données et prennent effet immédiatement, parce qu'on renomme une usine bien plus souvent qu'on ne la redéploie :

| paramètre | variable qu'il remplace |
|---|---|
| Nom de l'usine | `HOTLOOP_PLANT_NAME` |
| ID du site | `HOTLOOP_SITE_ID` |
| Fuseau horaire | `HOTLOOP_TIMEZONE` |
| Confirmer avant d'écrire | `HOTLOOP_CONFIRM_WRITES` |

Sous les paramètres se trouvent des cartes qui sont des données et non de la configuration, et elles sont modifiables pour la même raison : **Utilisateurs** ([Authentification et utilisateurs](/fr/iot/authentication/)), **Escalade des alarmes**, qui dit qui est prévenu ensuite quand personne n'acquitte une alarme et quand ([Notifications d'alarme](/fr/iot/notifications/#escalade)), et les cibles de l'historien et les identifiants MQTT. Les canaux qu'une escalade peut utiliser restent ceux du déploiement, définis par `HOTLOOP_NOTIFY_*`.

Une valeur stockée l'emporte sur la variable d'environnement : la valeur du chart devient donc le point de départ plutôt que le dernier mot. Un fuseau horaire que la machine ne sait pas résoudre est refusé plutôt qu'accepté puis ignoré en silence, ce qui ferait retomber tous les horodatages sur UTC sans que rien n'explique pourquoi.

Il en va de même pour la valeur du déploiement lui-même. Si `HOTLOOP_TIMEZONE` (ou `TZ`, quand elle n'est pas définie) désigne un fuseau qui ne se charge pas, HotLoop refuse de démarrer et l'erreur nomme la variable et la valeur. Il haussait les épaules et tournait en UTC. Les rapports, les planifications et les horaires d'équipe suivent l'horloge de l'usine, et une supposition décalée de plusieurs heures est pire qu'un pod qui dit pourquoi il ne démarre pas.

L'emplacement du site est `HOTLOOP_SITE_LATITUDE` et `HOTLOOP_SITE_LONGITUDE` (chart : `plant.latitude`, `plant.longitude`), en degrés décimaux, nord et est positifs. Le lever et le coucher du soleil ainsi que les entités et déclencheurs du soleil en sont calculés sur la machine ([Le soleil](/fr/iot/sun/)). Les deux ou aucune, et une valeur incorrecte arrête le démarrage en nommant la variable. L'écran Paramètres les affiche en lecture seule : des règles se déclenchent sur un lever de soleil, donc le déplacer est un déploiement.

**Les interrupteurs de sécurité ne sont pas modifiables et ne le seront pas.** `HOTLOOP_ALLOW_WRITES` est le contrôle maître de la capacité de ce processus à commander l'équipement ; un contrôle qu'on peut réactiver depuis la session de navigateur même qui émet les écritures n'est pas un contrôle. `HOTLOOP_HISTORIAN_RETENTION_DAYS` est lui aussi réservé au déploiement : la politique de rétention est appliquée à la base de données au démarrage, donc un champ sur un écran semblerait fonctionner sans déplacer aucune donnée. Le point d'accès refuse toute clé hors de l'ensemble modifiable **par son nom**, au lieu de l'ignorer.

Une limite, énoncée parce que l'écran l'énonce aussi : le serveur MCP construit ses instructions au démarrage, donc il annonce le nom d'usine avec lequel il a démarré jusqu'au redémarrage du pod. Tout le reste prend en compte un changement de nom à la requête suivante.

## PostgreSQL 17

La base de données de HotLoop est PostgreSQL 17 (avec TimescaleDB 2.30.1 pour Edge et le Gateway, PostgreSQL 17.11 simple pour IoT et pour `database.type: postgresql`). Les versions précédentes tournaient sur PostgreSQL 16, et PostgreSQL n'ouvre pas le répertoire de données d'une autre version majeure. Le passage est donc fait pour vous, à la mise à jour, et il n'y a rien à exécuter.

**Sur le chart,** le pod de la base de données reçoit deux conteneurs d'initialisation. Le premier exécute l'image PostgreSQL 16 et, seulement quand le volume contient des données 16, copie cette installation dans un volume temporaire. Le second exécute la nouvelle image et fait `pg_upgrade` vers un nouveau répertoire à côté de l'ancien. Tous deux laissent tranquille un volume neuf ou déjà en 17. La mise à jour, c'est `helm upgrade`, rien de plus. Attendez-vous à ce que le pod de la base de données reste en `Init` le temps qu'une copie des données prenne, et que l'application l'attende ; `kubectl logs <release>-postgresql-0 -c pg-upgrade` en est le journal.

**Sur Quadlet,** `hotloop-db-upgrade.container` s'exécute avant `hotloop-db.service` et fait la même chose dans une unité oneshot. Copiez le nouveau `hotloop-db.container`, `hotloop-db-upgrade.container` et `hotloop-db-upgrade.sh` du répertoire de votre produit dans le répertoire des unités et redémarrez l'unité de la base de données ; le [README de Quadlet](/fr/install/quadlet/) donne les commandes. L'unité de la base de données exige l'unité de mise à niveau : une machine qui n'a reçu que la nouvelle unité de base de données ne démarre donc pas sur des données 16 et dit pourquoi : elle échoue, elle ne devine pas. `journalctl -u hotloop-db-upgrade` en est le journal. L'unité ne s'exécute que lorsque le volume contient des données 16 : sur une machine neuve, et à chaque démarrage après la mise à niveau, systemd la saute (elle apparaît inactive, pas en échec) et l'image PostgreSQL 16 n'est jamais téléchargée. Quand le volume contient bien des données 16, l'unité télécharge d'abord cette image.

Ce qu'elle fait, dans l'ordre, le tout dans `hotloop-pg-upgrade.sh` (un seul fichier, le même que ceux qu'exécutent le chart et les unités) :

1. Pas de répertoire de données, ou un répertoire déjà en 17 : rien, et elle le dit. Toute autre version majeure est refusée, sans rien changer.
2. Démarre l'ancien serveur une fois sur un socket privé et l'arrête proprement, ce qui rejoue le journal après une coupure de courant et lit l'encodage et la locale que le nouveau cluster doit reprendre.
3. Fait un `initdb` d'un nouveau répertoire à côté de l'ancien avec ces réglages, exécute `pg_upgrade` en mode copie (l'ancien répertoire n'est que lu) et reporte `postgresql.conf`, `postgresql.auto.conf`, `pg_hba.conf` et `pg_ident.conf`.
4. Démarre le nouveau serveur une fois pour prouver qu'il s'ouvre avec les réglages définitifs et rassemble les statistiques du planificateur que `pg_upgrade` ne reporte pas.
5. Seulement alors, échange les noms : l'ancien répertoire devient `pgdata.pg16`, le nouveau `pgdata`.

Il faut à peu près autant d'espace libre à côté des données que les données en occupent, et elle le vérifie avant de commencer. Si quoi que ce soit échoue avant l'étape 5, la mise à niveau se termine avec un code non nul, les données 16 restent exactement comme elles étaient, et la base de données ne démarre pas sur un répertoire à moitié construit : sur le chart, le pod reste en `Init:Error`, sur Quadlet, l'unité de mise à niveau échoue et l'unité de la base de données derrière elle ne démarre jamais. Corrigez ce que dit le journal et relancez ; une tentative inachevée est supprimée et refaite. L'extension TimescaleDB passe à la version où elle était, et l'application la met à la version livrée à son prochain démarrage, comme toujours. La consigne de TimescaleDB pour une mise à niveau de PostgreSQL sur place est `pg_upgrade` avec les anciens et les nouveaux binaires ([Tiger Data, « Upgrade PostgreSQL »](https://www.tigerdata.com/docs/deploy/self-hosted/upgrades/upgrade-pg)).

La sauvegarde, c'est l'ancien répertoire lui-même. `pg_upgrade` en mode copie n'y écrit jamais, donc `pgdata.pg16` est toute la base de données PostgreSQL 16 telle qu'elle était, ce qui vaut mieux qu'un dump et rend seul possible le retour en arrière décrit plus bas. La sauvegarde propre de HotLoop ([Sauvegardes et restauration](/fr/iot/backup/)) est faite par l'application en marche à travers la base de données en marche : elle ne peut donc pas être prise à l'étape qui s'exécute avant le démarrage de la base de données. Faites-en une quand même sur l'ancienne version avant de mettre à niveau, et copiez-la hors de la machine.

### Revenir en arrière

`helm rollback`, ou la remise de l'ancien `hotloop-db.container`, ramène la base de données à l'image PostgreSQL 16 (la mise à jour automatique de Podman ne le fait pas : elle ne déplace que l'application), et PostgreSQL 16 n'ouvre pas un répertoire 17 (`database files are incompatible with server`, le journal dit que le répertoire a été initialisé par la version 16). Rien n'est perdu et rien n'est à moitié changé ; la base de données ne démarre simplement pas. Ce dont a besoin la version précédente, c'est de son propre répertoire 16, qui est `pgdata.pg16`. Arrêtez la base de données, puis remettez les noms :

```sh
# chart: after the rollback, stop the database, swap in a one-off pod, start it
kubectl -n hotloop scale statefulset/hotloop-postgresql --replicas=0
kubectl -n hotloop run pgswap --rm -it --restart=Never --image=busybox \
  --overrides='{"spec":{"securityContext":{"runAsUser":999,"fsGroup":999},"containers":[{"name":"pgswap","image":"busybox","command":["sh","-c","cd /d && mv pgdata pgdata.pg17 && mv pgdata.pg16 pgdata"],"volumeMounts":[{"name":"d","mountPath":"/d"}]}],"volumes":[{"name":"d","persistentVolumeClaim":{"claimName":"data-hotloop-postgresql-0"}}]}}'
kubectl -n hotloop scale statefulset/hotloop-postgresql --replicas=1

# Quadlet: the volume is named hotloop-db
sudo systemctl stop hotloop.service hotloop-db.service
d=$(sudo podman volume inspect hotloop-db --format '{{.Mountpoint}}')
sudo mv "$d/pgdata" "$d/pgdata.pg17" && sudo mv "$d/pgdata.pg16" "$d/pgdata"
```

C'est la base de données telle qu'elle était à la mise à niveau, et rien de ce qui a été écrit depuis. Le retour ne marche qu'une fois : la mise à niveau refuse de s'exécuter tant qu'un `pgdata.pg16` est dans le chemin, donc la prochaine tentative exige d'abord de s'occuper de `pgdata.pg17` et de l'ancien répertoire. Aller de l'avant est la voie, et un retour en arrière est pour une machine qui ne peut pas du tout faire tourner la 17. La règle de retour de l'application ne change pas : le schéma du répertoire 16 est celui que la version avant la mise à niveau a laissé, et une version qui trouve des migrations qu'elle ne connaît pas le dit, voir [Les migrations ne font qu'ajouter](/fr/iot/migrations/).

### Quand vous êtes satisfait

`pgdata.pg16` reste jusqu'à ce que vous le supprimiez, car le supprimer, c'est supprimer le seul chemin de retour. Il est aussi gros que la base de données. Une fois que la machine a tourné en 17 aussi longtemps que vous le souhaitez :

```sh
# chart
kubectl -n hotloop exec hotloop-postgresql-0 -c postgresql -- rm -rf /var/lib/postgresql/data/pgdata.pg16
# Quadlet
sudo rm -rf "$(sudo podman volume inspect hotloop-db --format '{{.Mountpoint}}')/pgdata.pg16"
```

### Le désactiver

`database.postgresql.upgrade.enabled: false` supprime les conteneurs d'initialisation. Un volume encore en 16 empêche alors la base de données de démarrer, et le passage vous revient. Laissez-le activé : activé, une installation neuve télécharge quand même l'image PostgreSQL 16 une fois par nœud, parce que l'image d'un conteneur d'initialisation est téléchargée avant son exécution, puis ne l'exécute jamais.

## Mise à niveau depuis la 3.x

**C'est un remplacement, pas une mise à niveau.** La 3.x était un autre produit. Il n'y a aucun chemin de migration pour ses données, car elle ne partage aucun modèle de données avec un historien de tags.

```bash
helm uninstall hotloop -n hotloop
# keep or delete the old PVCs deliberately, they hold the HA recorder database
helm install hotloop ./charts/hotloop -n hotloop
```

Ce qui n'existe plus et sera rejeté si défini : `sidecarProxy`, `homeassistant`, les modules `mqtt`/`nodered`/`esphome`/`zigbee2mqtt`, `devices`, `cameras`, `customConfig`, `network.hostNetwork`.

## Annuler une mise à jour

`helm rollback hotloop -n hotloop` remet l'image de la version précédente. Il ne remet pas la base de données : une version migre au démarrage, et cela reste fait. La règle et la vérification sont dans [Les migrations ne font qu'ajouter](/fr/iot/migrations/).

La seule chose qu'un retour en arrière à travers la version PostgreSQL 17 remet, c'est le moteur de la base de données : l'image de base de données du chart revient à la 16, qui n'ouvrira pas le répertoire mis à niveau. [Revenir en arrière](#revenir-en-arrière) est la sortie.

C'est sûr pour une version en arrière. La base de données enregistre quelle version a appliqué chaque migration, et une version qui trouve des migrations de deux versions ou plus plus récentes qu'elle refuse de démarrer :

```
refusing to start: this database's schema is more than one release ahead of
HotLoop 4.18.10. ...
```

Ce n'est pas un défaut à contourner. Cela signifie que la base de données a avancé plus loin que cette version n'a jamais tourné. Avancez vers une version qui connaît le schéma, la plus récente, ou restaurez une sauvegarde faite par la version que vous utilisez ([Sauvegardes et restauration](/fr/iot/backup/)). Exactement une version en arrière démarre, avec un avertissement dans le journal qui nomme les deux versions. Faites une sauvegarde avant de mettre à niveau ; le retour en arrière ne peut pas défaire les données que la version plus récente a écrites.

## Vérifier une installation

```bash
kubectl -n hotloop get pods
kubectl -n hotloop logs deploy/hotloop | head -20
```

Un démarrage sain dit les protocoles qu'il parle, applique les migrations, indique le mode d'historique et avertit de tout ce qui mérite d'être su :

```
msg=starting version=4.0.0 protocols="[ethernet-ip http modbus mqtt mtconnect opcua s7comm]"
msg="writes are ENABLED: the UI, API, automations and MCP can all command devices"
msg="tag_history promoted to a hypertable" timescale=2.30.1
msg="history schema ready" mode=timescale
msg=listening addr=:8080 mcp=/mcp writes=true
```

Vérifiez ensuite les étiquettes dont le tableau de bord a besoin. C'est la vérification qui détecte la dérive : vérifiez l'**ensemble**, pas le nombre, car une vérification du nombre passe alors que l'ensemble est faux :

```bash
kubectl -n hotloop get svc <release> -o json \
  | jq -r '.metadata.labels | keys[] | select(startswith("embernet.ai/"))'
```

Exactement quatre, sur le Service et sur le pod :

```
embernet.ai/app-name
embernet.ai/gui-port
embernet.ai/gui-type
embernet.ai/store-app
```

Si l'application tourne mais manque dans Applications en cours d'exécution, les étiquettes du Service sont le premier endroit à regarder : le tableau de bord interroge les Services par `embernet.ai/store-app`.

Un déploiement depuis l'App Store en ajoute cinq autres, à partir des `tenantLabels` que transmet le tableau de bord : `embernet.ai/tenant`, `app-id`, `source`, `deployed-by` et `deployment-id`. Elles vont sur chaque ressource que rend le chart et sur le pod du gateway. Le tableau de bord lit le tenant sur le Service et nulle part ailleurs : un Gateway déployé depuis le store sans `embernet.ai/tenant` sur son Service n'appartient à personne. Un simple `helm install` n'en rend aucune des cinq.

## Sondes

- `/healthz`, liveness. Répond tant que le processus est en marche.
- `/readyz`, readiness. Exige en plus la base de données : un pod qui a perdu son historien cesse de recevoir du trafic au lieu de servir une interface qui ne peut rien répondre.

La sonde de démarrage accorde deux minutes, car une première installation exécute les migrations et la sonde de liveness ne doit pas la tuer en pleine migration.

## Arrêt

`terminationGracePeriodSeconds: 45`. Sur SIGTERM, l'application cesse d'accepter des requêtes, puis vide la file de l'historien pour que les lectures déjà prises soient écrites plutôt que jetées. Raccourcir trop le délai de grâce perd tout ce qui était en vol.

## Dépannage

**Un appareil reste en `connecting`.** Regardez `lastError` sur la carte de l'appareil. Le plus souvent, un pare-feu entre le pod et l'équipement, ou un mauvais port. Le chart ne restreint pas l'egress, donc une NetworkPolicy qui le bloque est autre chose sur le cluster.

**Les tags lisent une mauvaise qualité.** L'appareil a répondu, mais pas le point. Pour Modbus, vérifiez la base d'adresses, `oneBased` si vos plans utilisent la numérotation 40001. Pour OPC UA, vérifiez que l'identifiant de nœud s'est résolu ; préférez la forme `nsu=`.

**Les valeurs semblent plausibles mais fausses.** Sur Modbus, c'est l'ordre des mots, essayez `CDAB`. C'est la panne qui ne s'annonce pas, car le nombre n'est pas manifestement faux.

**Rien n'est historisé.** Vérifiez les diagnostics de l'écran Protocoles. `filtered` compte les lectures supprimées par la zone morte, ce qui fonctionne comme prévu ; `dropped` compte les lectures perdues parce que la base de données n'a pas suivi, ce qui n'est pas le cas.

**MCP renvoie 401.** Le jeton bearer. Lisez-le dans le Secret de la release.

**Chaque requête `/api/` renvoie 401.** C'est attendu dès que `auth.enabled` est true et que personne ne s'est encore connecté, c'est le but de la 4.4.0. Lisez le mot de passe administrateur généré dans le Secret de la release (voir [Authentification](#authentification)) et connectez-vous par l'interface, ou `POST /api/auth/login` directement. Voir [Authentification et utilisateurs](/fr/iot/authentication/).

**Mot de passe administrateur perdu et aucun autre compte administrateur.** Générez un nouveau hash et corrigez le Secret, puis redémarrez le pod pour qu'il relise l'environnement ; `EnsureAdminUser` ne touchera pas à un compte qui existe déjà, donc ceci remplace directement la ligne au lieu de passer par le chart :

```bash
hotloop hash-password -password 'a-new-one'
kubectl exec -n hotloop deploy/hotloop -- \
  psql "$DATABASE_URL" -c \
  "UPDATE users SET password_hash = '<the hash>' WHERE username = 'admin'"
```

**Une automatisation est activée mais ne tourne pas.** Elle n'a pas compilé. L'écran Automatisations l'affiche comme NOT ARMED avec la raison, et le journal du système contient l'erreur.
