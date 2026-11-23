---
title: "Installer HotLoop IoT {{hotloop}}"
description: "Installez HotLoop IoT {{hotloop}} sur k3s avec Helm, ou sur un Pi ou un petit PC en services systemd avec Podman Quadlet, sur PostgreSQL ou un fichier SQLite."
sidebar:
  label: "Installation"
---

HotLoop IoT est sorti pour la première fois dans la 4.18.10. L'image est `ghcr.io/hotloop-io/hotloop-iot:{{hotloop}}`, construite pour amd64, arm64 et arm/v7, et le chart est `hotloop-iot` dans le même dépôt Helm que le reste de la gamme. Les deux se téléchargent sans connexion. Il n'y a pas de voie Docker ni Compose, c'est voulu, et un simple `podman run` lancé depuis un shell qui meurt avec la session n'est pas une installation.

Deux voies. Un cluster utilise Helm. Un Pi, un NUC ou un petit PC industriel sans cluster utilise Podman Quadlet. Dans les deux cas, la base de données se choisit une seule fois : PostgreSQL 17 (par défaut) ou un fichier SQLite sans aucun conteneur de base de données.

## Helm

```bash
helm repo add hotloop https://hotloop.io/hotloop
helm repo update
helm install hotloop hotloop/hotloop-iot --version {{hotloop}} \
  --namespace hotloop --create-namespace
```

Appelez la release `hotloop`, quel que soit le produit. Le nom de la release est celui que portent le volume de la base, les Secrets et le Service, et le garder permet à un site de passer plus tard à un produit supérieur.

Cela déploie IoT, avec PostgreSQL 17.11 à côté, sur un volume de 10 Gi, avec 30 jours d'historique. Le chart génère le mot de passe de la base, le jeton MCP et un mot de passe administrateur dans le Secret de la release, et les réutilise à chaque mise à niveau, si bien qu'un `helm upgrade` ne change jamais un mot de passe dans votre dos.

Pour un fichier SQLite et aucun pod de base de données, demandez-le à l'installation :

```bash
helm install hotloop hotloop/hotloop-iot --version {{hotloop}} \
  --namespace hotloop --create-namespace \
  --set database.type=sqlite
```

SQLite, c'est un seul écrivain sur un seul disque local : une seule réplique, et le volume va sur du stockage local, jamais sur NFS. Un site avec des années d'historique à la seconde veut PostgreSQL. Le chart d'IoT accepte `postgresql` ou `sqlite` et rien d'autre : lui demander `timescaledb` fait échouer l'installation. Passer de l'un à l'autre plus tard passe par une sauvegarde et une restauration, pas par un changement de valeurs, car la nouvelle base démarre vide. [Sauvegardes](/fr/iot/backup/) contient la restauration.

### Sauvegarder la clé

Le chart génère aussi `<release>-secret-key` (`hotloop-secret-key` avec les commandes ci-dessus). Il contient la clé qui chiffre chaque mot de passe d'appareil que HotLoop conserve. La clé n'est jamais dans la base ni dans une sauvegarde, elle fait donc partie de vos données : une sauvegarde ne restaure les identifiants que là où cette clé est montée. Le chart garde le Secret après un `helm uninstall`. Sauvegardez-la ailleurs qu'à côté de vos sauvegardes, car une clé posée à côté des sauvegardes qu'elle protège ne protège rien. [Installer la Gateway](/fr/gateway/install/#sauvegardez-la-clé-avant-den-avoir-besoin) raconte toute l'histoire, et c'est la même clé.

### Se connecter

L'utilisateur est `admin`. Les notes d'installation affichent la commande qui relit le mot de passe :

```bash
kubectl -n hotloop get secret hotloop \
  -o jsonpath='{.data.admin-password}' | base64 -d
kubectl -n hotloop port-forward svc/hotloop 8080:8080
```

Ouvrez `http://localhost:8080`. Ce compte administrateur est un amorçage, pas un interrupteur de réinitialisation : une fois qu'il existe, changer `auth.admin.password` et mettre à niveau ne fait rien, si bien qu'un mot de passe défini par quelqu'un dans l'interface n'est jamais écrasé par le prochain déploiement.

Ajoutez maintenant un appareil, découvrez ses tags et essayez d'en écrire un. Vous ne pouvez pas. Les écritures sont désactivées à la livraison, chaque tag est en lecture seule tant que personne ne l'arme, et `safety.allowWrites` reste à `false` jusqu'à ce que vous décidiez que ce déploiement peut déplacer des machines. [La porte d'écriture](/fr/gateway/write-gate/) détaille chaque contrôle, dans l'ordre.

### Ce qu'il faut régler avant qu'une vraie usine le voie

Mettez-les dans un fichier de valeurs et installez avec `-f`.

| Valeur | Par défaut | Pourquoi la modifier |
|---|---|---|
| `plant.name`, `plant.siteId` | `HotLoop`, vide | Le nom de l'usine sur les écrans, dans les pages et pour les autres sites. |
| `plant.latitude`, `plant.longitude` | vide | L'emplacement de l'usine, en degrés décimaux. [Le soleil](/fr/iot/sun/) en est déduit sur le boîtier. Les deux ou aucune. |
| `global.timezone` | `America/New_York` | Les planifications et les changements d'équipe s'y réfèrent. Ce doit être un vrai nom de fuseau, car un nom qui ne se charge pas bloque le démarrage. |
| `publicUrl` | vide | L'adresse à laquelle un téléphone sur le Wi-Fi de l'usine joint HotLoop. Sans elle, les notifications n'ont pas de lien de retour et ntfy n'a pas de bouton Acquitter. |
| `safety.allowWrites` | `false` | Le commutateur général. Désactivé, rien n'écrit sur une machine, d'où que ce soit. |
| `safety.allowMcpWrites` | `true` | Laisse les agents écrire par la même porte, activé depuis la 4.19.4. Il suit le commutateur général : avec `safety.allowWrites` désactivé, rien n'écrit, agents compris. Mettez-le à `false` et les agents peuvent toujours lire toute l'usine sans jamais écrire. |
| `historian.retentionDays` | `30` | Nombre de jours d'historique conservés. La Gateway et Edge en gardent 90, car le disque d'un Pi est petit. |
| `logbook.retentionDays` | `90` | Jours de changements d'état d'entités que garde le [journal](/fr/iot/logbook/). |
| `database.postgresql.persistence.size` | `10Gi` | C'est là que vit votre historique. Dimensionnez-le selon votre nombre de tags et la rétention ci-dessus. |
| `secretKey.existingSecret` | vide | Un Secret que vous gérez, contenant la clé des mots de passe d'appareils. Renseignez-le si vous rendez le chart avec `helm template`, qui ne peut pas générer de clé stable. |
| `opcuaClient.persistence.enabled` | `false` | Activez-le avant d'ajouter un appareil OPC UA sécurisé, pour que les certificats du client survivent à un redémarrage. |
| `ingress` | activé, tout hôte | L'Ingress répond à tout hôte que sert votre classe d'ingress. Fixez `ingress.hosts[0].host` pour le limiter à un nom, ou `ingress.enabled: false` pour n'en avoir aucun. |

## Podman Quadlet

Pour un boîtier qui n'est pas dans un cluster. Quadlet transforme les conteneurs en vrais services systemd : ils démarrent au boot sans personne de connecté, redémarrent quand ils meurent et écrivent dans le journal. Il faut **Podman 5.0 ou plus récent**. Raspberry Pi OS Bookworm fournit la 4.3, qui n'a pas du tout Quadlet, donc un Pi demande Trixie ou plus récent. Mettez le volume de la base sur un SSD USB et non sur la carte SD, car l'historique écrit toute la journée et les cartes SD meurent exactement de cela.

Les unités sont dans le répertoire `iot/` du dépôt HotLoop, sous `deploy/quadlet/`. [Podman Quadlet](/fr/install/quadlet/) explique ce qu'est chaque fichier. La version courte pour PostgreSQL :

```bash
sudo cp hotloop.network hotloop.container hotloop-db.container \
  hotloop-db.volume hotloop-data.volume /etc/containers/systemd/

openssl rand -hex 24 | sudo podman secret create hotloop-db-password -
sudo podman run --rm ghcr.io/hotloop-io/hotloop-iot:stable gen-secret-key \
  | sudo podman secret create hotloop-secret-key -
printf '%s' 'a long admin password' \
  | sudo podman run --rm -i ghcr.io/hotloop-io/hotloop-iot:stable hash-password \
  | sudo podman secret create hotloop-admin-password-hash -

sudo systemctl daemon-reload
sudo systemctl start hotloop.service
sudo systemctl status hotloop.service hotloop-db.service
curl -s localhost:8080/api/status
```

Ouvrez ensuite `http://<this box>:8080` et connectez-vous en tant que `admin`. Les trois secrets sont le mot de passe de la base, la clé qui chiffre les mots de passe d'appareils (si vous la perdez, il faut tout ressaisir, alors gardez-en une copie ailleurs que sur ce boîtier) et le hachage bcrypt du mot de passe de l'administrateur, jamais le mot de passe lui-même.

Pour un fichier SQLite à la place, utilisez les fichiers de `iot/sqlite/` et rien du répertoire du dessus. Ils portent les mêmes noms d'unités, c'est donc un jeu ou l'autre, jamais les deux. Ce sont deux fichiers, `hotloop.container` et `hotloop-data.volume`, et deux secrets, `hotloop-secret-key` et `hotloop-admin-password-hash`. La base est `/data/hotloop.db` sur le volume `hotloop-data`.

L'unité suit `:stable`, et Podman la met à jour une fois la minuterie activée :

```bash
sudo systemctl enable --now podman-auto-update.timer
```

Une nouvelle image migre la base de données au démarrage, et si elle ne peut pas démarrer, Podman remet la précédente. Le conteneur de la base ne suit pas `:stable`, c'est voulu. [La mise à jour automatique de :stable](/fr/install/auto-update/) dit ce que fait une mise à jour, ce qu'un retour arrière ne peut pas défaire et comment suspendre les mises à jour jusqu'à votre feu vert. Faites une sauvegarde avant d'activer les mises à jour.

## Passer à un produit supérieur

D'IoT à Edge puis à la Gateway, on conserve chaque appareil, tag, entité, automatisation, alarme, utilisateur et heure d'historique, et [la gamme](/fr/products/) explique comment. Le passage a été exécuté sous Quadlet et en `helm upgrade` sur un vrai cluster. Redescendre d'un produit n'est pas un passage à faire sur un boîtier auquel vous tenez, alors faites d'abord une sauvegarde.

## Jusqu'où il a été exécuté

Les unités Quadlet d'IoT, SQLite et PostgreSQL, ont été exécutées sous systemd, sans root, depuis les fichiers validés, et un vrai Pi sous systemd en root et les images arm 32 bits ont été exécutés sur du matériel réel, sur machine physique (2026-11-17).

## Licence

HotLoop IoT est sous le HotLoop Source License Agreement 1.0. Il est gratuit et à code source disponible, pas open source au sens de l'OSI. L'usage domestique et en laboratoire est gratuit, tout comme celui des écoles, des organisations à but non lucratif et des administrations pour leur propre activité. Voir [la page de licence](/fr/license/) et [Utiliser HotLoop en entreprise](/fr/business/).
