---
title: "Installer HotLoop Gateway {{hotloop}} avec Helm"
description: "Installez HotLoop Gateway {{hotloop}} depuis le chart Helm publié sur k3s ou tout Kubernetes, connectez-vous et réglez l'essentiel avant qu'une usine ne le voie."
sidebar:
  label: "Installation"
---

HotLoop Gateway {{hotloop}} est livré sous forme d'image de conteneur pour amd64 et arm64, d'environ 37 Mo sur amd64 et 35 Mo sur arm64, et de chart Helm. Les deux se téléchargent sans connexion. Il garde les noms sous lesquels il est sorti jusqu'à la 4.17.0, image `ghcr.io/hotloop-io/hotloop` et chart `hotloop`, si bien que personne qui l'exploite n'a rien à changer. Une version plus ancienne tourne déjà ? N'installez pas par-dessus. [Mise à niveau](/fr/gateway/upgrading/) donne le chemin depuis la 4.17.0, un simple `helm upgrade`, et les chemins depuis la 4.16.0 et la 4.3.1, qui se font par étapes.

Deux façons de l'exploiter pour de bon : le chart Helm sur n'importe quel Kubernetes, k3s compris, et Podman Quadlet sur un boîtier hors cluster, plus bas. Il n'y a pas de voie Docker ni Compose, c'est voulu, et un simple `podman run` lancé depuis un shell qui meurt avec la session n'est pas une installation.

## Helm

```bash
helm repo add hotloop https://hotloop.io/hotloop
helm repo update
helm install hotloop hotloop/hotloop --version {{hotloop}} \
  --namespace hotloop --create-namespace
```

Cela déploie le Gateway, plus TimescaleDB 2.30.1 à côté sur un volume de 20 Gi, avec 90 jours d'historique. La base de données est un réglage, `database.type` : `timescaledb` est la valeur par défaut, `postgresql` fait tourner PostgreSQL 17 simple, et `sqlite` fait tourner le Gateway sur un fichier sans aucun pod de base de données, avec un seul réplica et un stockage local, jamais NFS. Passer de l'une à l'autre plus tard est une sauvegarde et une restauration, parce que la nouvelle base démarre vide. Un boîtier qui contient déjà des données PostgreSQL 16 passe en 17 à sa prochaine mise à niveau sans que vous fassiez rien, alors [lisez comment cela se passe](/fr/gateway/upgrading/#upgrading-from-41810) avant de toucher une usine en marche. Le chart génère le mot de passe de la base, le jeton MCP et un mot de passe administrateur dans le Secret de la release, et les réutilise à chaque mise à niveau, si bien qu'un `helm upgrade` ne change jamais un mot de passe dans votre dos et ne vous déconnecte pas de votre propre usine.

## Sauvegardez la clé avant d'en avoir besoin

Le chart génère aussi un second Secret, `<release>-secret-key` (`hotloop-secret-key` avec la commande ci-dessus). Il contient la clé qui chiffre chaque mot de passe que HotLoop garde pour un appareil : le `password` d'un appareil OPC UA, MQTT, HTTP, MTConnect ou UniFi, les valeurs d'en-tête HTTP et MTConnect comme les clés d'API, le mot de passe de chaque autre broker MQTT que la découverte écoute, et le mot de passe de chaque cible d'historien. La clé n'est jamais dans la base ni dans une sauvegarde, donc un dump qui sort par la porte sur un portable contient du texte chiffré, pas les clés de l'usine.

Le chart conserve ce Secret d'une mise à niveau à l'autre, et aussi après un `helm uninstall`, parce qu'une base laissée sur son volume est inutilisable pour ses identifiants sans lui. Cela veut dire aussi que **la clé fait partie de vos données.** Démarrez le Gateway sans elle et chaque appareil dont le mot de passe est scellé reste à l'arrêt, en train de réessayer, avec une erreur qui nomme la clé dont il a besoin. Une sauvegarde ne se restaure que là où cette clé est montée, et `--restore-from` la refuse par son nom partout ailleurs.

Sauvegardez donc le Secret comme vous sauvegardez les autres secrets du cluster, et gardez-le ailleurs qu'à côté de vos sauvegardes. Une clé posée à côté des sauvegardes qu'elle protège ne protège rien.

**Vous rendez le chart au lieu de l'installer ? Apportez votre propre clé.** La clé est générée par un `lookup` que seuls un vrai `helm install` ou `helm upgrade` peuvent faire. Tout ce qui exécute `helm template` et applique le résultat obtient une nouvelle clé à chaque rendu, et la synchronisation suivante verrouille tous les mots de passe scellés. Créez une clé avec `hotloop gen-secret-key`, mettez-la dans un Secret que vous gérez sous la clé `secret.key`, et nommez ce Secret dans `secretKey.existingSecret`. Helm, Fleet et l'App Store EmberNet installent tous pour de vrai et n'ont pas besoin de cela.

Un identifiant écrit dans une URL (`mqtt://user:pass@host`) ou dans un texte libre reste en clair. Mettez-le dans `password`. [Identifiants des appareils](/fr/iot/protocols/#identifiants-dappareil) donne la liste complète de ce qui est chiffré.

## Se connecter

L'utilisateur est `admin`. Les notes d'installation affichent la commande qui relit le mot de passe :

```bash
kubectl -n hotloop get secret hotloop \
  -o jsonpath='{.data.admin-password}' | base64 -d
kubectl -n hotloop port-forward svc/hotloop 8080:8080
```

Ouvrez `http://localhost:8080`. Ce compte admin est un compte d'amorçage, pas un interrupteur de réinitialisation. Une fois qu'il existe, changer `auth.admin.password` et mettre à niveau ne fait rien, si bien qu'un mot de passe défini dans l'interface n'est jamais écrasé par le déploiement suivant.

Ajoutez maintenant un appareil, découvrez ses tags et essayez d'écrire dans l'un d'eux. Impossible. C'est voulu. Chaque tag démarre en lecture seule et s'arme un par un, et `safety.allowWrites` reste désactivé tant que vous n'avez pas décidé que ce pod peut déplacer des machines. Personne ne devrait finir son premier jour avec HotLoop devant une presse qui fait quelque chose que personne n'a demandé.

## Santé du boîtier et montage de l'hôte

Le serveur OPC UA du chart sert aussi la santé de ce boîtier (CPU, mémoire, disque et gigue temps réel quand un agent écrit le fichier) pour le tableau de bord EmberNet, et il crée pour le tableau de bord un identifiant qui peut lire les tags et les valeurs et rien d'autre, son mot de passe étant gardé dans le Secret `<release>-opcua-dashboard` d'une mise à niveau à l'autre. Les montages sont activés par défaut : le chart monte la racine de l'hôte sur `/host` et son `/proc` sur `/host/proc`, tous deux en lecture seule, et n'ajoute aucun privilège. Un cluster qui applique le profil Pod Security restreint refuse un hostPath ; il faut alors mettre `opcuaServer.dashboard.boxHealth.enabled: false` pour n'avoir ni appareil ni montage, ou `opcuaServer.dashboard.boxHealth.hostMount: false` pour garder l'appareil avec le disque et le CPU marqués invalides et qui dit quoi monter. Le drop-in Quadlet est `deploy/quadlet/opcua-dashboard.conf`.

## Ce qu'il faut régler avant qu'une vraie usine le voie

Mettez cela dans un fichier de valeurs et installez avec `-f`. Ne comptez pas sur `--set` pour quoi que ce soit dont vous aurez encore besoin à la prochaine mise à niveau, car vous ne vous en souviendrez pas et la mise à niveau non plus.

| Valeur | Par défaut | Pourquoi la modifier |
|---|---|---|
| `plant.name`, `plant.siteId` | `HotLoop`, vide | Le nom de l'usine sur les écrans, dans les pages et pour les autres sites. |
| `global.timezone` | `America/New_York` | Les plannings, les rapports et les changements d'équipe s'y règlent. Ce doit être un vrai nom de fuseau (`America/Chicago`, pas `CST`), car un fuseau qui ne se charge pas arrête le démarrage au lieu de tourner discrètement en UTC. |
| `publicUrl` | vide | L'adresse à laquelle un téléphone sur le Wi-Fi de l'usine joint HotLoop. Sans elle, les notifications n'ont pas de lien de retour et ntfy n'a pas de bouton Acquitter. |
| `safety.allowWrites` | `false` | L'interrupteur général. Désactivé, rien n'écrit sur une machine, d'où que ce soit. Activez-le une fois le déploiement revu. |
| `safety.allowMcpWrites` | `true` | Laisse les agents écrire par la même porte, activé depuis la 4.19.4. Il suit l'interrupteur général : avec `safety.allowWrites` désactivé, rien n'écrit, agents compris. Mettez-le à `false` et les agents peuvent toujours lire toute l'usine sans jamais écrire. Les charts définissent toujours un jeton MCP, donc `/mcp` n'est jamais ouvert. |
| `database.postgresql.persistence.size` | `20Gi` | C'est là que vit votre historique. Dimensionnez-le selon votre nombre de tags et `historian.retentionDays` (90). |
| `logbook.retentionDays` | `90` | Jours de changements d'état d'entités que garde le [journal de bord](/fr/iot/logbook/). `0` garde tout jusqu'à ce que le volume soit plein, et le Gateway vous en avertit au démarrage. |
| `secretKey.existingSecret` | vide | Un Secret que vous gérez, contenant la clé des mots de passe d'appareil. Laissez-le vide et le chart en crée un. Renseignez-le si vous rendez le chart avec `helm template`. |
| `database.type` | `timescaledb` | Sur quelle base l'application tourne : `timescaledb`, `postgresql` ou `sqlite`. Un réglage, pas une autre image. |
| `plant.latitude`, `plant.longitude` | vide | Où se trouve l'usine, en degrés décimaux, pour que [le soleil](/fr/iot/sun/) soit calculé sur le boîtier. Les deux ou aucune. |
| `edgePublish.queueMaxBytes` | `67108864` | La limite de la file de coupure quand vous publiez vers l'amont en Sparkplug, 64 MiB. Au-delà, les lectures les plus anciennes sont abandonnées et comptées. `0` signifie illimité, et une coupure assez longue remplit alors le volume. |
| `database.postgresql.enabled` | `true` | Mettez `false` et remplissez `database.external` pour utiliser votre propre PostgreSQL. Avec l'extension TimescaleDB vous avez une hypertable, sans elle un partitionnement natif. |
| `opcuaClient.persistence.enabled` | `false` | Activez-le avant d'ajouter un appareil OPC UA sécurisé. Sans lui, les certificats du client n'ont nulle part où survivre à un redémarrage, et l'appareil refuse de se connecter plutôt que de vous faire réapprouver la confiance des deux côtés après chaque redéploiement. |
| `ingress` | activé, tout hôte | L'Ingress répond à tout hôte que sert votre classe d'ingress. Fixez `ingress.hosts[0].host` pour le limiter à un nom, ou `ingress.enabled: false` pour n'en avoir aucun. |

Les écritures sont désactivées à la livraison, et c'est tout l'intérêt. Même avec `safety.allowWrites` activé, un tag est en lecture seule tant que vous ne l'armez pas séparément, et chaque valeur est vérifiée par rapport à la plage du tag, refusée et jamais écrêtée. [Le sas d'écriture](/fr/gateway/write-gate/) détaille chaque contrôle, dans l'ordre.

## Podman Quadlet

Pour un boîtier qui n'est pas dans un cluster. Quadlet transforme les conteneurs en vrais services systemd : ils démarrent au boot sans que personne soit connecté, redémarrent quand ils meurent et écrivent dans le journal. Il faut **Podman 5.0 ou plus récent**. Raspberry Pi OS Bookworm fournit la 4.3, qui n'a pas du tout Quadlet, donc un Pi demande Trixie ou plus récent. Mettez le volume de la base sur un SSD USB et non sur la carte SD.

Les unités se trouvent dans le répertoire `gateway/` du dépôt HotLoop, sous `deploy/quadlet/`. [Podman Quadlet](/fr/install/quadlet/) explique chaque fichier.

```bash
sudo cp hotloop.network hotloop.container hotloop-db.container \
  hotloop-db.volume hotloop-data.volume /etc/containers/systemd/

openssl rand -hex 24 | sudo podman secret create hotloop-db-password -
sudo podman run --rm ghcr.io/hotloop-io/hotloop:stable gen-secret-key \
  | sudo podman secret create hotloop-secret-key -
printf '%s' 'a long admin password' \
  | sudo podman run --rm -i ghcr.io/hotloop-io/hotloop:stable hash-password \
  | sudo podman secret create hotloop-admin-password-hash -

sudo systemctl daemon-reload
sudo systemctl start hotloop.service
sudo systemctl status hotloop.service hotloop-db.service
curl -s localhost:8080/api/status
```

Ouvrez ensuite `http://<this box>:8080` et connectez-vous en tant que `admin`. Les trois secrets sont le mot de passe de la base, la clé des mots de passe d'appareil (sauvegardez-la ailleurs que sur ce boîtier, pour la même raison que plus haut) et le hash bcrypt du mot de passe de l'admin, jamais le mot de passe lui-même. L'unité garde 90 jours d'historique et suit `:stable`.

PostgreSQL simple au lieu de TimescaleDB, c'est la même unité avec `Environment=HOTLOOP_HISTORIAN_TIMESCALE=false` ajouté à `hotloop.container`. Un fichier SQLite, ce sont les fichiers de `gateway/sqlite/` et rien du répertoire au-dessus, parce qu'ils partagent des noms d'unités : `hotloop.container` et `hotloop-data.volume`, et deux secrets, `hotloop-secret-key` et `hotloop-admin-password-hash`.

Activez le minuteur de Podman une fois par boîtier et le Gateway se met à jour tout seul :

```bash
sudo systemctl enable --now podman-auto-update.timer
```

Le conteneur de la base ne suit pas `:stable`, c'est voulu, et une mise à jour qui ne peut pas démarrer est annulée. [La mise à jour automatique de :stable](/fr/install/auto-update/) dit ce que fait une mise à jour, ce qu'un retour arrière ne peut pas défaire et comment suspendre les mises à jour jusqu'à ce que vous le disiez. Ce sont les unités qui ont réellement tourné : sans root sous systemd, y compris une mise à jour qui migre, puis ne peut pas démarrer et est annulée. Elles ont depuis tourné sur du matériel réel (2026-11-17).

## Ensuite

Ajoutez un appareil, découvrez ses tags et regardez-les arriver. [Protocoles](/fr/iot/protocols/) dit jusqu'où chaque pilote a été éprouvé, y compris les deux qui ont tourné sur du matériel réel le 2026-11-17, S7comm et EtherNet/IP. Si vous l'exploitez sous EmberCORE, EmberCORE le trouve tout seul et le relaie à l'adresse interne du cluster, sans ingress.

## Licence

HotLoop Gateway est sous la HotLoop Source License Agreement 1.0. Il est gratuit à utiliser et à code source disponible, pas un logiciel libre au sens de l'OSI. L'usage domestique et de laboratoire est gratuit, tout comme celui des écoles, des organisations à but non lucratif et des administrations pour leurs propres opérations. Voir [la page de licence](/fr/license/) et [Utiliser HotLoop en entreprise](/fr/business/).
