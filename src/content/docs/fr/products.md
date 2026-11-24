---
title: "Produits HotLoop : huit sur cinq lignes"
description: "Huit produits sur cinq lignes de versions : contenu de chaque produit du cœur, base de données, installation et passage d'un site à la gamme supérieure."
---

HotLoop, ce sont huit produits pour l'atelier : quatre qui grandissent avec un site (IoT, Edge, Gateway et Edge Relay), plus Flow pour le câblage logiciel, Cascade pour les workflows, HotLoop for CODESYS pour l'écran propre de l'automate et Transmitter pour publier les valeurs d'un automate sur le réseau.

Ils sortent sur cinq lignes de versions. **HotLoop core** regroupe IoT, Edge, Gateway et Edge Relay : quatre produits, un seul code, une seule étiquette. Chaque version du core publie les quatre en même temps, avec le même numéro de version, chacun avec sa propre image, son propre chart Helm et ses propres unités Podman Quadlet. Choisissez celui qui convient à la machine. Chaque produit parle tous les protocoles de HotLoop, donc vous ne montez jamais en gamme juste pour lire l'automate posé sur votre établi. Ce sont les fonctions qui les distinguent. Pas les protocoles.

**Flow**, **Cascade**, **HotLoop for CODESYS** et **Transmitter** ont leurs propres lignes et leurs propres versions : une version de Flow ne bouge jamais le core, et inversement. Tout ce qui suit le tableau concerne le core. Voici où commence chacun des huit :

| Produit | Ligne de versions | Documentation | Installation | Notes de version | Feuille de route |
|---|---|---|---|---|---|
| **HotLoop IoT** | HotLoop core | <a href="/fr/iot/overview/">Documentation</a> | <a href="/fr/iot/install/">Installation</a> | <a href="/fr/releases/#hotloop-core">Notes</a> | <a href="/fr/roadmap/">Feuille de route</a> |
| **HotLoop Edge** | HotLoop core | <a href="/fr/edge/overview/">Documentation</a> | <a href="/fr/edge/install/">Installation</a> | <a href="/fr/releases/#hotloop-core">Notes</a> | <a href="/fr/roadmap/">Feuille de route</a> |
| **HotLoop Gateway** | HotLoop core | <a href="/fr/gateway/overview/">Documentation</a> | <a href="/fr/gateway/install/">Installation</a> | <a href="/fr/releases/#hotloop-core">Notes</a> | <a href="/fr/roadmap/">Feuille de route</a> |
| **HotLoop Edge Relay** | HotLoop core | <a href="/fr/edge-relay/overview/">Documentation</a> | <a href="/fr/edge-relay/install/">Installation</a> | <a href="/fr/releases/#hotloop-core">Notes</a> | <a href="/fr/roadmap/">Feuille de route</a> |
| **HotLoop Flow** | Flow | <a href="/fr/flow/overview/">Documentation</a> | <a href="/fr/flow/install/">Installation</a> | <a href="/fr/releases/#hotloop-flow">Notes</a> | <a href="/fr/flow/roadmap/">Feuille de route</a> |
| **HotLoop Cascade** | Cascade | <a href="/fr/cascade/overview/">Documentation</a> | <a href="/fr/cascade/running/">Installation</a> | <a href="/fr/releases/#hotloop-cascade">Notes</a> | <a href="/fr/cascade/roadmap/">Feuille de route</a> |
| **HotLoop for CODESYS** | HotLoop for CODESYS | <a href="/fr/codesys/overview/">Documentation</a> | <a href="/fr/codesys/install/">Installation</a> | <a href="/fr/releases/codesys-0-3-10/">Notes</a> | <a href="/fr/codesys/roadmap/">Feuille de route</a> |
| **HotLoop Transmitter** | Transmitter | <a href="/fr/transmitter/overview/">Documentation</a> | <a href="/fr/transmitter/install/">Installation</a> | <a href="/fr/releases/transmitter-1-3-0/">Notes</a> | <a href="/fr/transmitter/roadmap/">Feuille de route</a> |

Le tableau suivant compare les quatre produits du core.

| <span class="sr-only">Détails</span> | HotLoop IoT | HotLoop Edge | HotLoop Gateway | HotLoop Edge Relay |
|---|---|---|---|---|
| À quoi il sert | La base d'automatisation. Un Pi, un NUC, un boîtier dans un placard | Un boîtier à côté de la machine, qui continue de tourner même si la liaison montante tombe | Le cerveau du site | Interroger, transmettre, survivre. Sans base de données ni interface |
| Entités, automatisations, assistants, scripts, recettes, modèles, tableaux de bord, journal, notifications, MCP, MQTT avec découverte, alarmes ISA-18.2, sauvegardes, tous les pilotes | oui | oui | oui | pilotes seulement |
| Serveur OPC UA, publication Sparkplug en périphérie avec stockage et retransmission | | oui | oui | publication seulement |
| Parc, multi-sites, rapports planifiés | | | oui | |
| Image | `ghcr.io/hotloop-io/hotloop-iot` | `ghcr.io/hotloop-io/hotloop-edge` | `ghcr.io/hotloop-io/hotloop` | `ghcr.io/hotloop-io/hotloop-edge-relay` |
| Chart | `hotloop-iot` | `hotloop-edge` | `hotloop` | `hotloop-edge-relay` |
| Unités Quadlet | `deploy/quadlet/iot/` | `deploy/quadlet/edge/` | `deploy/quadlet/gateway/` | `deploy/quadlet/edge-relay.container` |
| Unités Quadlet sur SQLite | `deploy/quadlet/iot/sqlite/` | `deploy/quadlet/edge/sqlite/` | `deploy/quadlet/gateway/sqlite/` | aucune |
| `database.type` dans le chart | `postgresql` (par défaut), `sqlite` | `timescaledb` (par défaut), `postgresql`, `sqlite` | `timescaledb` (par défaut), `postgresql`, `sqlite` | aucun |
| Architectures | amd64, arm64, arm/v7 | amd64, arm64, arm/v7 | amd64, arm64 | amd64, arm64, arm/v7 |
| Base de données exécutée par le chart et Quadlet | PostgreSQL 17 | TimescaleDB | TimescaleDB | aucune |
| Historique conservé par défaut | 30 jours | 90 jours | 90 jours | aucun |
| Bases de données prises en charge par le binaire | SQLite ou Postgres | SQLite, Postgres ou TimescaleDB | SQLite, Postgres ou TimescaleDB | aucune |

La base de données est un réglage, pas une image : `HOTLOOP_DB_TYPE=sqlite` et `HOTLOOP_DB_PATH` placent n'importe lequel des trois sur un fichier SQLite, sans aucun conteneur de base de données (DEPLOYMENT.md, « SQLite »). Les charts acceptent le même choix sous la forme `database.type` et les unités Quadlet sous la forme des répertoires `sqlite/`, chaque produit n'offrant que les bases du tableau ci-dessus : demander `timescaledb` au chart IoT fait échouer l'installation. Passer d'une base à une autre se fait par une sauvegarde et une restauration (BACKUP.md).

Le Gateway a gardé les noms sous lesquels il est sorti jusqu'à la 4.17.0 : image `ghcr.io/hotloop-io/hotloop`, chart `hotloop`. Personne n'a rien à changer.

## Ce qu'il y a dans un produit, c'est ce qu'il y a dans le binaire

Un produit est une compilation, pas un réglage. `-tags hotloop_iot` compile IoT, `-tags hotloop_edge` compile Edge, et sans étiquette on obtient le Gateway. Ce qu'un produit n'a pas n'est pas désactivé, il n'y est pas : le serveur OPC UA n'est pas du tout dans l'image IoT, donc aucune variable d'environnement, aucun fichier de valeurs et aucun mauvais jour ne peut l'allumer.

Un produit plus petit répond donc de ce qu'il n'a pas, au lieu de faire semblant :

- **L'API** garde toutes les routes dans tous les produits. Une route pour une fonction que ce produit n'a pas répond `404` et nomme le produit qui l'a : `{"error":"scheduled reports are part of HotLoop Gateway; this is HotLoop IoT","product":"iot","feature":"reports"}`. `GET /api/status` indique `product` et `features`, donc un script demande au lieu de tâtonner.
- **Un réglage propre au Gateway** sur IoT ou Edge (`HOTLOOP_REPORTS_ENABLED=true` hérité d'un ancien fichier de valeurs, par exemple) émet un avertissement au démarrage et dans l'écran des réglages, et HotLoop tourne. HotLoop garde l'usine en marche malgré un rapport qu'il ne peut pas produire, et l'avertissement fait en sorte que quelqu'un le voie.
- **Les charts** n'ont tout simplement pas ce réglage. `charts/hotloop-iot` n'a aucun bloc `reports`, `opcuaServer` ou `edgePublish`, et `hotloop-edge` n'a pas `reports`. Si vous le définissez quand même, rien n'est généré.
- **`hotloop --product`** affiche `iot`, `edge` ou `gateway`. `--version` n'affiche toujours que la version, car des scripts l'analysent.

## Lequel choisir

- **Un Pi, des prises connectées, quelques capteurs, un broker MQTT plein de Tasmota et de Zigbee2MQTT, ou un automate sur un établi :** IoT. C'est la plus petite image (environ 29 Mo sur arm) et l'image de PostgreSQL classique fait un sixième de celle de TimescaleDB, ce qui, sur une carte SD, est le chiffre qui compte.
- **Un boîtier fixé à côté d'une ligne, qui alimente un SCADA en OPC UA ou publie vers le haut en Sparkplug et encaisse la perte de la liaison montante :** Edge.
- **Le site : toutes les lignes, des rapports envoyés par courriel selon un planning, des edge relays qui remontent leurs données, plus d'un site sur un seul écran :** Gateway.
- **Un boîtier qui doit seulement interroger et transmettre, sans base de données à surveiller :** Edge Relay. Voir la [référence Edge Relay](/fr/edge-relay/reference/).

## Tailles

L'image, c'est le binaire plus environ 3 Mo de base.

| <span class="sr-only">Détails</span> | image / binaire amd64 | image / binaire arm64 | image / binaire arm/v7 |
|---|---|---|---|
| IoT | 31.2 / 28.0 MB | 29.1 / 26.0 MB | 29.2 / 26.0 MB |
| Edge | 36.5 / 33.3 MB | 34.2 / 31.0 MB | 34.3 / 31.1 MB |
| Gateway | 37.1 / 33.9 MB | 34.8 / 31.6 MB | non compilé |
| Edge Relay | 15.7 / 12.5 MB | 14.9 / 11.7 MB | 15.1 / 11.9 MB |

Ce sont les tailles sur disque. Sans aucun appareil, HotLoop occupe environ 10 Mo de RSS et PostgreSQL environ 12 Mo, et c'est le plancher, pas le chiffre réel : ce qu'un produit consomme avec des appareils interrogés dépend de ces appareils.

## Installation

### Helm

Un seul dépôt, les quatre charts :

```sh
helm repo add hotloop https://hotloop.io/hotloop/

helm install hotloop hotloop/hotloop-iot  --namespace hotloop --create-namespace
helm install hotloop hotloop/hotloop-edge --namespace hotloop --create-namespace
helm install hotloop hotloop/hotloop      --namespace hotloop --create-namespace
```

Appelez la release `hotloop`, quel que soit le produit. Le nom de la release est celui que portent le volume de la base de données, les Secrets et le Service, et le conserver est ce qui permet à un site de monter plus tard d'un produit (voir plus bas).

Sur EmberNet, chacun est sa propre carte dans l'App Store : « HotLoop IoT », « HotLoop Edge », « HotLoop Gateway » et « HotLoop Edge Relay ». Un déploiement depuis la boutique intègre les étiquettes de locataire du tableau de bord dans tout ce que le chart génère, et Running Apps les affiche sous les noms `HotLoop-IoT`, `HotLoop-Edge`, `HotLoop-Gateway` et `HotLoop-Edge-Relay`.

### Podman Quadlet

Pour une machine qui n'est pas dans un cluster. Chaque répertoire de produit sous `deploy/quadlet/` contient cinq unités : `hotloop.network`, `hotloop.container` (l'application), `hotloop-db.container` (sa base de données, la même image et la même version que celles de son chart), `hotloop-db.volume` et `hotloop-data.volume`. Les étapes d'installation figurent dans l'en-tête de chaque `hotloop.container`, et [Podman Quadlet](/fr/install/quadlet/) donne le reste.

Il faut Podman 5.0 ou plus récent. Raspberry Pi OS Bookworm fournit la 4.3, qui n'a aucun Quadlet, donc un Pi demande Raspberry Pi OS Trixie ou plus récent. L'application suit `:stable` et la mise à jour automatique de Podman la déplace, la base de données restant épinglée : [le README de Quadlet](/fr/install/auto-update/) explique comment et pourquoi. Quelle que soit la méthode, placez la base de données sur un SSD USB et non sur la carte SD. L'historique écrit toute la journée, tous les jours, et les cartes SD meurent justement de cela.

## Passer un site à un produit supérieur

D'IoT à Edge puis au Gateway, on garde tous les appareils, tags, entités, automatisations, alarmes, utilisateurs et heures d'historique. Chaque produit exécute toutes les migrations, donc la base de données a la même forme dans les trois, et le produit supérieur démarre avec ses fonctions supplémentaires vides.

- **Quadlet :** les noms d'unités, les volumes et les secrets sont les mêmes dans chaque répertoire de produit. Copiez `hotloop.container` et `hotloop-db.container` du produit supérieur par-dessus les vôtres, faites `systemctl daemon-reload`, puis redémarrez.
- **Helm :** `helm upgrade hotloop hotloop/hotloop-edge` (ou `hotloop/hotloop`) sur la même release. Les trois charts sélectionnent leurs pods avec les mêmes étiquettes et nomment pareillement le StatefulSet et le volume de la base de données, donc la mise à niveau est permise et le volume reste lié.

Faites d'abord une sauvegarde (`POST /api/backup`, voir [Sauvegardes et restauration](/fr/iot/backup/)) et copiez-la hors de la machine. Ce passage a été exécuté sur Quadlet, d'IoT à Edge puis au Gateway sur un même volume de base de données avec le même appareil présent à chaque étape, avec le répertoire PostgreSQL d'IoT démarrant sous l'image TimescaleDB du Gateway, et sous forme de `helm upgrade` sur un vrai cluster. Là où le répertoire d'IoT, sans extension TimescaleDB, n'en a pas, l'historique reste dans des partitions natives après ce passage, et une hypertable demande une sauvegarde puis une restauration dans une TimescaleDB neuve. Redescendre d'un produit n'est pas une opération à faire sur une machine à laquelle vous tenez.

## Comment ils sont publiés

Une seule étiquette `v` publie les quatre, donc IoT, Edge, le Gateway et l'Edge Relay partagent toujours la même version. Avant toute compilation, on vérifie que la version et l'image de chaque chart correspondent à l'étiquette, que chaque unité Quadlet d'application suit `:stable` avec un contrôle de santé, et que chaque unité de base de données correspond à son chart sans jamais être mise à jour automatiquement. Les charts IoT et Edge sont générés à partir du chart du Gateway, donc une correction apportée à l'un atteint les trois.
