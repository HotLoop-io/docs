---
title: "La mise à jour automatique :stable"
description: "Chaque machine suit l'étiquette stable. Ce que fait une mise à jour, ce qu'un retour arrière ne défait pas, et comment la suspendre à votre feu vert."
---

Chaque machine suit `:stable` et Podman la met à jour. C'est la règle pour les quatre produits, et c'est pourquoi aucune unité ici ne fige un numéro de version : une machine figée sur `4.17.0` a exactement l'âge du jour où quelqu'un l'a installée, et personne ne retourne à l'usine changer une étiquette. Chaque étiquette de version déplace `:stable`, et une version dont les unités ne la suivent pas est refusée.

Activez le minuteur une seule fois par machine :

```sh
sudo systemctl enable --now podman-auto-update.timer
```

## Ce que fait une mise à jour

Podman récupère `:stable` quand le minuteur se déclenche et, si le digest a changé, redémarre l'unité de l'application sur la nouvelle image. Seulement celle de l'application : le conteneur de la base de données n'est pas touché, donc une mise à jour n'interrompt pas l'historien. L'unité a un contrôle de santé qui n'a pas besoin de shell (l'image n'en a pas) : `hotloop healthcheck` interroge le `/readyz` de l'application elle-même, qui ne répond que tant que la base répond. L'unité reste en « activating » jusqu'à ce qu'il réussisse, si bien que Podman distingue une mise à jour qui a redémarré d'une qui ne l'a pas fait, et si la nouvelle image ne démarre jamais, il remet la précédente sous `:stable` et la démarre.

Démarrer la nouvelle image exécute d'abord ses migrations, sur la base de données déjà en place, et une grosse base prend du temps. L'unité laisse 15 minutes à l'application pour répondre avant de déclarer la mise à jour échouée, et les échecs des cinq premières minutes ne comptent pas, car une migration n'est pas un échec.

Deux choses ont été trouvées en l'exécutant, pas en lisant, et les unités portent le correctif de chacune. Une simple chaîne `HealthCmd` passe par `/bin/sh -c`, et l'image n'a pas de shell, donc le contrôle ne pouvait jamais réussir : c'est un tableau JSON. Et les anciens Quadlet lisent `Notify=healthy` comme un simple `true` et passent `--sdnotify=conmon`, qui déclare l'application démarrée dès que son conteneur démarre : une mise à jour incapable de démarrer était signalée comme un succès et rien n'était annulé. Les unités indiquent elles-mêmes `--sdnotify=healthy`.

## Pourquoi il n'y a pas de pod

L'application et la base de données partageaient un pod. Cela coûtait le retour arrière, et on l'a découvert en l'exécutant, pas en lisant le manuel. Pour un conteneur dans un pod, la mise à jour automatique de Podman redémarre l'unité **du pod**, et l'unité du pod démarre sans problème quel que soit l'état de l'application qu'elle contient. Une version incapable de démarrer était signalée `UPDATED true`, l'application bouclait en erreur dessus (vingt redémarrages dans les premières minutes) et `:stable` sur la machine était l'image cassée. Cela redémarrait aussi la base de données à chaque mise à jour de l'application. Avec un réseau à la place, l'application est sa propre unité, Podman redémarre celle-ci, et l'unité reste en « activating » jusqu'à ce que l'application réponde sur `/readyz` : la même version est revenue en `UPDATED rolled back`.

## Ce qu'un retour arrière ne peut pas défaire

Une migration. Quand une version migre la base puis échoue à son contrôle de santé, Podman remet la version précédente, qui démarre sur le schéma laissé par la version défaillante. C'est sûr, et cela reste sûr de trois façons ([Les migrations ne font qu'ajouter](/fr/iot/migrations/) donne le détail) :

- **Les migrations ne font qu'ajouter.** Une table, une colonne avec une valeur par défaut, un index. Jamais une suppression, un renommage ou un changement de type, de sorte que la version précédente retrouve tout ce qu'elle connaissait là où c'était et ne regarde jamais ce qui a été ajouté.
- **Une application refuse un schéma auquel elle ne peut pas se fier.** La base enregistre quelle version a appliqué chaque migration. Une version revenue en arrière d'un cran démarre et le dit dans son journal. Une version en retard de deux versions ou plus ne démarre pas et dit pourquoi, en nommant les deux versions. C'est le cas où une machine échoue une mise à jour, revient en arrière, en échoue une autre, et la base a maintenant avancé deux fois. L'application s'arrête aussitôt avec le message dans `journalctl -u hotloop`, et le `Restart=always` de l'unité continue d'essayer et d'être refusé. Ce qui règle le problème, c'est une version qui connaît le schéma : la plus récente, c'est-à-dire `:stable` (`sudo podman auto-update`, ou la récupérer et redémarrer). Ou restaurer une sauvegarde faite par la version que vous exécutez ([Sauvegarde et restauration](/fr/iot/backup/)).

Un retour arrière n'a donc plus de réserve dans les notes de version. Ce qu'il ne peut toujours pas défaire, ce sont les données : la version défaillante a pu écrire des lignes que l'ancienne ignore. Faites une sauvegarde avant d'activer les mises à jour ; c'est la seule chose entre une mauvaise version et une restauration.

## Pourquoi la base de données ne suit pas `:stable`

L'application porte l'étiquette de mise à jour automatique. Le conteneur de la base de données non, et son `Image=` est une étiquette exacte. La raison : les mises à jour de l'application peuvent être annulées, celles de la base de données non.

- Une **version majeure de PostgreSQL** (16 vers 17) n'est pas un redémarrage. La politique de versions de PostgreSQL indique que le répertoire de données ne peut pas rester compatible d'une majeure à l'autre, et qu'un export et rechargement, ou `pg_upgrade`, est requis ([postgresql.org/support/versioning](https://www.postgresql.org/support/versioning/)). Une étiquette flottant entre versions majeures le ferait à l'historien d'une usine lors d'un redémarrage sans rapport. Figer la majeure est le minimum, et ce n'est pas une « épingle de point de terminaison » au sens de la règle ci-dessus. Le seul passage fait par HotLoop, de 16 à 17, est `hotloop-db-upgrade.container`, exécuté volontairement quand vous copiez les nouvelles unités.
- Une **version mineure** (16.14 vers 16.15) n'exige ni export ni restauration. La même page ajoute que certaines « peuvent exiger des étapes supplémentaires, alors lisez toujours d'abord les notes de version ». Une machine sans surveillance ne lit pas les notes de version.
- **TimescaleDB** (le Gateway et l'Edge) est l'autre moitié. L'application exécute elle-même `ALTER EXTENSION timescaledb UPDATE` au démarrage après une image plus récente, et une mise à jour d'extension est un changement à sens unique de la base : remettre l'ancienne image ensuite ne l'annule pas. Une étiquette Timescale flottante ferait donc traîner une mise à jour irréversible derrière la mise à jour réversible de l'application.
- Une nouvelle image de base de données qui démarre et tourne n'est pas une image saine. Le contrôle de santé distingue un conteneur qui ne démarre pas d'un conteneur qui démarre, et c'est tout. Savoir si un historien a survécu à une mise à niveau du moteur, `pg_isready` ne le dit pas.

L'étiquette de la base de données évolue donc avec une version de HotLoop testée avec elle. `release_guard.sh` maintient chaque `hotloop-db.container` identique à la base de son chart, de sorte qu'une machine Quadlet et une installation par chart du même produit exécutent la même, et refuse un `AutoUpdate=` dessus. Le prix : les correctifs de PostgreSQL arrivent sur une machine quand une version les embarque, ou quand vous changez l'étiquette à la main. Dans la même majeure, cela revient à modifier `hotloop-db.container`, un `daemon-reload` et un redémarrage du pod, après lecture des notes de version et une sauvegarde. Une version majeure passe par `pg_upgrade`, que HotLoop exécute pour 16 vers 17 et que vous exécutez vous-même, ou vers laquelle vous restaurez, pour toute autre.

## Suspendre les mises à jour jusqu'à votre feu vert

Par défaut, il n'y a pas de suspension : les mises à jour ont lieu quand le minuteur se déclenche. Un site qui veut qu'une personne décide a deux moyens, et aucun n'exige que l'application soit joignable.

- **Suspendre.** Laissez `podman-auto-update.timer` désactivé. Rien ne se met à jour. Quand vous êtes prêt, lancez `sudo podman auto-update` : c'est l'approbation, avec le même contrôle de santé et le même retour arrière. Podman met à jour tous les conteneurs étiquetés de la machine quand il s'exécute, pas seulement ceux-ci, et on ne peut pas lui dire d'en ignorer un, donc une machine qui doit faire tourner le minuteur pour d'autres conteneurs ne peut pas aussi suspendre ceux-ci.
- **Une fenêtre.** `update-window.conf` est un fichier complémentaire du minuteur qui dit quand il peut se déclencher, par exemple le dimanche à 03:00, au lieu du réglage par défaut, tous les jours à minuit :

  ```sh
  sudo mkdir -p /etc/systemd/system/podman-auto-update.timer.d
  sudo cp update-window.conf /etc/systemd/system/podman-auto-update.timer.d/
  sudo systemctl daemon-reload && sudo systemctl restart podman-auto-update.timer
  ```

Le Edge Relay diffère sur un point : un Gateway peut approuver sa mise à jour depuis l'écran de flotte, parce qu'un relais écoute déjà les commandes du Gateway vers lequel il transmet. IoT, Edge et Gateway n'ont pas de tel canal pour les joindre, et en construire un mettrait un bouton « redémarrer cette machine » sur une interface web pour une fonction que `sudo podman auto-update` est déjà. Voir la [référence du Edge Relay](/fr/edge-relay/reference/#mettre-à-jour-un-relay) pour la suspension du relais, et `edge-relay-hold.conf`.

## Ce que voit le Gateway

`GET /api/status` sur n'importe lequel des trois indique sa `version`, et son `imageDigest` quand l'unité l'a fourni (elle le fait, avant chaque démarrage). Un Edge ou un Gateway dont la publication Edge est activée est un nœud Sparkplug comme un relais, et place les deux mêmes informations dans chaque naissance, donc un Gateway qui l'a dans sa liste de flotte affiche la version et le digest et consigne le changement quand une mise à jour automatique le déplace ([Gestion de flotte](/fr/gateway/fleet/)). IoT n'a pas d'amont, donc son digest est sur son propre `/api/status` et nulle part ailleurs.

## Avec Helm

Un pod ne peut pas se remplacer lui-même, donc il n'y a pas de mise à jour sans surveillance pour les charts : `helm upgrade` est la mise à jour, et le `image.tag` du chart vaut par défaut son `appVersion`, c'est-à-dire la version.
