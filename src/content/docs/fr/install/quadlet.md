---
title: "Podman Quadlet sur un Pi"
description: "Exécutez HotLoop comme de vrais services systemd sur un Pi ou un petit PC industriel avec Podman Quadlet, sans Docker, sans Compose et sans cluster."
---

Pour un Pi ou un petit PC industriel qui ne fait **pas** partie d'un cluster k3s. S'il en fait partie, utilisez plutôt le chart du produit. Ce répertoire et les charts sont les deux façons prises en charge d'exécuter HotLoop.

Pas de Docker, et pas de `podman run` isolé depuis un shell qui meurt avec la session. Quadlet transforme les conteneurs en vrais services systemd : démarrage au boot sans utilisateur connecté, redémarrage en cas d'échec, journaux dans journald.

| Répertoire | Produit | Image |
|---|---|---|
| `iot/` | HotLoop IoT, avec PostgreSQL 17 | `ghcr.io/hotloop-io/hotloop-iot` |
| `edge/` | HotLoop Edge, avec TimescaleDB | `ghcr.io/hotloop-io/hotloop-edge` |
| `gateway/` | HotLoop Gateway, avec TimescaleDB | `ghcr.io/hotloop-io/hotloop` |
| ce répertoire | HotLoop Edge Relay, sans base de données | `ghcr.io/hotloop-io/hotloop-edge-relay` |

[La page des produits](/fr/products/) indique celui qu'il vous faut.

Chacun des trois premiers a aussi un répertoire `sqlite/` : le même produit avec la base de données sous forme de fichier et sans conteneur de base de données. Voir [SQLite au lieu de PostgreSQL](#sqlite-au-lieu-de-postgresql).

## IoT, Edge et le Gateway

Chaque répertoire contient les mêmes unités et un script :

- **`hotloop.network`** : le réseau que partagent l'application et sa base de données. L'application joint la base par son nom (`hotloop-db:5432`) et rien d'autre sur la machine ne le peut, car la base ne publie aucun port. Seul le 8080 de l'application est publié.
- **`hotloop.container`** : l'application. Son en-tête contient les étapes d'installation ; lisez-le avant de copier quoi que ce soit.
- **`hotloop-db.container`** : la base de données, la même image et la même version que celles du chart de ce produit. Elle se déclare démarrée dès qu'elle répond, si bien que l'application attend une base utilisable.
- **`hotloop-db-upgrade.container`** et **`hotloop-db-upgrade.sh`** : le passage de la base de PostgreSQL 16 à 17, une seule fois. Il s'exécute avant l'unité de la base et seulement quand le volume contient encore des données 16 ; sur un volume neuf, ou déjà en 17, systemd l'ignore. Voir [PostgreSQL 16 vers 17](#postgresql-16-vers-17).
- **`hotloop-db.volume`** et **`hotloop-data.volume`** : la base de données, et tout ce que l'application écrit sous `/data` (sauvegardes, certificats, file de transfert, rapports). Ce sont des volumes Podman nommés, donc `podman system prune` n'y touche pas.

Trois secrets Podman contiennent ce qui n'a pas sa place dans un fichier : `hotloop-db-password`, `hotloop-secret-key` (chiffre les mots de passe des appareils dans la base ; gardez-en une copie hors de la machine) et `hotloop-admin-password-hash` (le hash bcrypt du mot de passe du premier administrateur, jamais le mot de passe).

**Podman 5.0 ou plus récent.** Raspberry Pi OS Bookworm fournit Podman 4.3, qui n'a aucun Quadlet : utilisez Raspberry Pi OS Trixie (Podman 5.4) ou plus récent. Les mises à jour décrites ci-dessous ont été exécutées sur Podman 6.1.3 ; l'unité de l'Edge Relay, qui partage les mêmes clés, sur 4.9.3. Et placez le volume de la base sur un SSD USB, pas sur la carte SD. L'historique écrit toute la journée, et les cartes SD meurent exactement de cela.

### Pourquoi tous les produits utilisent les mêmes noms

Les noms d'unités, de volumes et de secrets sont identiques dans `iot/`, `edge/` et `gateway/`, volontairement. Faire monter une machine d'un produit, c'est copier le `hotloop.container` et le `hotloop-db.container` du produit supérieur par-dessus les vôtres :

```sh
sudo cp gateway/hotloop.container gateway/hotloop-db.container \
  gateway/hotloop-db-upgrade.container gateway/hotloop-db-upgrade.sh /etc/containers/systemd/
sudo systemctl daemon-reload
sudo systemctl restart hotloop.service hotloop-db.service
```

Les volumes et les secrets restent, et avec eux chaque appareil, balise, alarme, utilisateur et heure d'historique. Faites quand même une sauvegarde avant (`POST /api/backup`). Ce passage a été exécuté, d'IoT à Edge puis au Gateway sur un même jeu de volumes. Redescendre d'un produit n'est pas un passage à faire sur une machine à laquelle vous tenez.

Cela signifie aussi un seul HotLoop par machine. Deux se disputeraient de toute façon le port 8080.

### Vérifié

Les fichiers livrés d'IoT, d'Edge et du Gateway, non modifiés, se génèrent avec le générateur `quadlet` de Podman 6.1.3 avec la même structure : l'application exige la base de données et le réseau, publie son propre port et porte l'étiquette de mise à jour automatique, tandis que la base n'en porte aucune et ne publie rien.

Les unités du Gateway ont ensuite été exécutées pour de vrai : sans privilèges, sous systemd, avec un registre local à la place de ghcr.io et le propre `podman auto-update` des produits. Un premier démarrage avec la base saine puis l'application saine ; une mise à jour vers une version qui ajoute une migration à une table que l'application utilise déjà, réalisée avec l'appareil existant et ses données intacts et sans jamais redémarrer le conteneur de la base ; et une mise à jour vers une version qui migre la base puis ne peut pas démarrer, que Podman a annulée, la version précédente redémarrant saine sur la base que la défaillante avait déjà migrée. Edge et IoT fonctionnent avec les mêmes unités et ont été exécutés sous systemd sur un vrai Pi, sur du matériel réel (2026-11-17).

## PostgreSQL 16 vers 17

La base de données de HotLoop est PostgreSQL 17 à partir de cette version. Une machine qui exécutait une version antérieure a des données PostgreSQL 16, que PostgreSQL 17 n'ouvrira pas : le passage est donc une unité qui s'exécute avant la base. Mettez les nouveaux fichiers en place et redémarrez la base, et c'est tout :

```sh
sudo cp hotloop-db.container hotloop-db-upgrade.container hotloop-db-upgrade.sh \
  /etc/containers/systemd/
sudo systemctl daemon-reload
sudo systemctl restart hotloop-db.service
journalctl -u hotloop-db-upgrade.service      # what it did
```

`hotloop-db.container` exige l'unité de mise à niveau, donc une machine qui n'a copié que la nouvelle unité de base ne démarre pas sur des données 16 et le journal dit pourquoi. L'unité de mise à niveau exécute `pg_upgrade` en mode copie vers un nouveau répertoire à côté de l'ancien, démarre une fois le nouveau serveur pour prouver qu'il s'ouvre, et seulement ensuite échange les noms ; les anciennes données restent sur le volume sous `pgdata.pg16`. Elle ne récupère l'image PostgreSQL 16 que si le volume en a besoin. Un échec laisse les données 16 telles qu'elles étaient et la base non démarrée. La description complète, le retour en arrière et la suppression de `pgdata.pg16` sont dans [k3s et Helm](/fr/install/helm/#postgresql-17). Pour une installation sans privilèges, le chemin du script dans l'unité est `~/.config/containers/systemd`, à partir de `%E`.

## SQLite au lieu de PostgreSQL

La base de données est un réglage, pas une image (la page k3s et Helm, « SQLite »). Avec Quadlet, cela signifie un second jeu de fichiers, pas une seconde image. Le répertoire `sqlite/` de chaque produit en contient deux :

- **`sqlite/hotloop.container`** : l'application seule. Pas de `Requires=` sur une base de données, pas de réseau, pas de mot de passe de base, et `HOTLOOP_DB_TYPE=sqlite` avec le fichier dans `HOTLOOP_DB_PATH=/data/hotloop.db`. Elle suit `:stable` et annule une mauvaise mise à jour exactement comme l'unité PostgreSQL : même contrôle de santé, même `--sdnotify=healthy`.
- **`sqlite/hotloop-data.volume`** : le volume `hotloop-data`, où se trouvent le fichier de base et ses `-wal` et `-shm`. C'est le même nom de volume que celui des fichiers PostgreSQL, donc le même volume de données si vous changez un jour.

| Répertoire | Installation | Secrets |
|---|---|---|
| `iot/`, `edge/`, `gateway/` | `hotloop.network`, `hotloop.container`, `hotloop-db.container`, `hotloop-db.volume`, `hotloop-data.volume` | trois |
| `iot/sqlite/`, `edge/sqlite/`, `gateway/sqlite/` | `hotloop.container`, `hotloop-data.volume` | deux : `hotloop-secret-key` et `hotloop-admin-password-hash` |

Installez un jeu ou l'autre, jamais les deux : ils utilisent les mêmes noms d'unités. L'en-tête de `sqlite/hotloop.container` donne les étapes exactes. En bref :

```sh
cd iot/sqlite        # or edge/sqlite, gateway/sqlite
sudo cp hotloop.container hotloop-data.volume /etc/containers/systemd/
# make hotloop-secret-key and hotloop-admin-password-hash as the header says
sudo systemctl daemon-reload
sudo systemctl start hotloop.service
curl -s localhost:8080/api/status
```

Quelques points à connaître avant de choisir. SQLite est un seul écrivain sur un seul disque local : sur un Pi, le volume va sur un SSD USB, et le stockage réseau n'est pas une option parce que SQLite s'y corrompt. L'historique est une table avec un index, pas des partitions ni une hypertable, donc un site avec des années d'historique à la seconde veut les fichiers PostgreSQL. Et passer une machine de SQLite à PostgreSQL, ou l'inverse, est une sauvegarde et une restauration ([Sauvegarde et restauration](/fr/iot/backup/)), pas un échange d'unités : la nouvelle base démarre vide. Ne copiez pas un `sqlite/hotloop.container` sur une installation PostgreSQL en marche pour « basculer » ; il ne lit pas les données du volume PostgreSQL.

PostgreSQL simple sur Edge ou le Gateway, c'est l'unité TimescaleDB avec `Environment=HOTLOOP_HISTORIAN_TIMESCALE=false` ajouté à `hotloop.container`. L'unité d'IoT est déjà du PostgreSQL simple, et IoT n'a aucune unité TimescaleDB.

### Vérifié (SQLite)

`iot/sqlite/hotloop.container` et son volume ont été exécutés sans privilèges sur Podman 4.9.3 sous systemd (`systemctl --user`) à partir des fichiers validés, modifiés seulement pour les noms, le port, l'image (construite depuis le même arbre) et le répertoire d'exécution dont un gestionnaire utilisateur a besoin. L'unité est montée saine, `/healthz` et `/readyz` ont répondu 200, l'administrateur s'est connecté à partir du secret de hash, `/api/status` a répondu, `hotloop.db`, `hotloop.db-wal` et `hotloop.db-shm` sont apparus sur le volume, et un redémarrage n'a appliqué aucune migration et a reconnecté l'administrateur. Les unités `sqlite/` d'Edge et du Gateway sont le même fichier à l'image et à la rétention par défaut près, et ont été exécutées sous systemd en root sur un vrai Pi, sur du matériel réel (2026-11-17).

## Edge Relay

- **`edge-relay-hold.conf`** : optionnel : suspend les mises à jour d'image jusqu'à ce qu'un opérateur les approuve. Un fichier complémentaire systemd, qui ne fait pas partie d'une installation par défaut.
- **`edge-relay.container`**, le service lui-même. Les étapes d'installation complètes sont dans le commentaire de son propre en-tête ; lisez-le avant de copier quoi que ce soit.
- **`edge-relay-data.volume`**, un volume Podman nommé pour la file de transfert, afin que les lectures en tampon survivent à un redémarrage du conteneur. Podman le crée automatiquement au premier démarrage du service.
- **`devices.example.json`**, un point de départ pour le fichier des appareils. Copiez-le vers `/etc/edge-relay/devices.json` et modifiez-le pour les appareils réels de ce site ; voir [la référence du Edge Relay](/fr/edge-relay/reference/) pour le format complet.

### Démarrage rapide

```sh
sudo mkdir -p /etc/containers/systemd /etc/edge-relay
sudo cp edge-relay.container edge-relay-data.volume /etc/containers/systemd/
sudo cp devices.example.json /etc/edge-relay/devices.json   # then edit it
sudo "$EDITOR" /etc/containers/systemd/edge-relay.container  # broker, group, node

# Skip this if the broker takes anonymous connections.
printf '%s' 'your-broker-password' | sudo podman secret create edge-relay-broker-password -

sudo systemctl daemon-reload
sudo systemctl start edge-relay.service
sudo systemctl status edge-relay.service
curl localhost:8081/status
```

**Mises à jour.** L'unité suit `:stable` et se met à jour toute seule dès que le minuteur de Podman est activé :

```sh
sudo systemctl enable --now podman-auto-update.timer
```

Si une nouvelle image ne passe pas son contrôle de santé, Podman remet l'ancienne. La liste de flotte du Gateway affiche la version et le digest d'image de chaque relais et consigne chaque changement. Pour suspendre les mises à jour jusqu'à l'approbation d'un administrateur sur le Gateway, installez `edge-relay-hold.conf` comme l'indique le commentaire en tête de ce fichier, et désactivez le minuteur. Tout ce que cela fait, et ce qu'il ne peut pas faire, est dans [la référence du Edge Relay](/fr/edge-relay/reference/#mettre-à-jour-un-relay).

Pour prendre en compte une modification du fichier local : modifiez-le, puis `sudo systemctl restart edge-relay.service`. Le relais lit ce fichier au démarrage et ne le surveille pas.

Un fichier d'appareils poussé par le Gateway n'a besoin de rien de tout cela : il s'applique en direct, sans redémarrage. Il ne peut pas être écrit dans `/etc/edge-relay/devices.json` (monté `:ro` sur une racine en lecture seule), donc il va sur le volume de données sous `/data/pushed-devices.json`, et tant qu'il existe, c'est celui que le relais exécute et dont il démarre. Vos modifications du fichier local restent sans effet jusqu'à ce que vous effaciez ce qui a été poussé : `DELETE /api/fleet/{id}/config` sur le Gateway pendant que le relais tourne, et il revient aussitôt au fichier local. Le journal indique quel fichier est utilisé, vérifiez-le avant de douter de votre JSON.

Vérifié avec le vrai binaire `quadlet` (`/usr/libexec/podman/quadlet -dryrun` de `podman-5.8.6`) : les deux unités s'analysent sans erreur et génèrent l'appel `podman run` attendu, avec la dépendance du volume et le secret branchés automatiquement.
