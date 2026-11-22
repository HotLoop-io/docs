---
title: "Cascade avec Podman Quadlet"
description: "Exécutez Cascade en services systemd avec Podman Quadlet, sur SQLite ou avec Postgres et un worker séparé, avec une fenêtre de mise à jour à vous."
---

Il y a deux façons de l'exécuter. Les deux demandent Podman 5.0 ou plus récent et une installation en root, pour démarrer avec la machine sans que personne soit connecté. Les deux suivent `ghcr.io/hotloop-io/hotloop-cascade:stable`, l'exécutent en lecture seule, sans droits root et sans aucune capacité, et laissent systemd le relancer. Les mises à jour et leur retour arrière sont à la fin.

## Une machine, SQLite

`hotloop-cascade.container` et `hotloop-cascade-data.volume`. La base de données est un fichier dans le volume, à côté de la clé qui chiffre les identifiants enregistrés.

```sh
sudo cp hotloop-cascade.container hotloop-cascade-data.volume /etc/containers/systemd/
sudo install -D -m 600 /dev/null /etc/hotloop-cascade/cascade.env
sudo systemctl daemon-reload
sudo systemctl start hotloop-cascade
```

Ouvrez `http://this-box:8080`. La première personne qui l'ouvre crée le premier compte, faites-le donc avant de partager l'adresse.

## PostgreSQL, un serveur et des workers

`postgres/`. La base de données, le serveur et, si vous le voulez, d'autres workers. Postgres sert de file d'attente, donc les workers prennent leur travail au même endroit. La base de données est sur un réseau à part et ne publie aucun port.

D'abord trois secrets, à créer une seule fois. Les commandes sont en haut de `postgres/hotloop-cascade.container`. La clé est la plus importante : si vous la perdez, tous les identifiants enregistrés deviennent illisibles. Gardez-en une copie ailleurs que sur cette machine.

```sh
cd postgres
sudo cp hotloop-cascade.network hotloop-cascade-db.container hotloop-cascade-db.volume \
  hotloop-cascade-data.volume hotloop-cascade.container /etc/containers/systemd/
sudo install -D -m 600 /dev/null /etc/hotloop-cascade/cascade.env
sudo systemctl daemon-reload
sudo systemctl start hotloop-cascade
```

D'autres workers : `hotloop-cascade-worker.container`. Les workers partagent le volume de données, ils doivent donc être sur la même machine. Au-delà d'une machine, utilisez le chart Helm.

## Réglages

`/etc/hotloop-cascade/cascade.env`, un `NAME=value` par ligne, et il doit exister même vide (la ligne `install` le crée). Ceux dont vous aurez besoin :

| Réglage | Ce qu'il fait |
|---|---|
| `HOTLOOP_CASCADE_PUBLIC_URL` | L'adresse à laquelle les gens atteignent Cascade. Les liens des webhooks et des rappels OAuth en sont tirés. Tant que vous ne la définissez pas, elle vaut `http://localhost:8080`, qui ne fonctionne que depuis la machine elle-même. |
| `HOTLOOP_CASCADE_METRICS_TOKEN` | Exige `Authorization: Bearer` sur `/metrics`. |
| `HOTLOOP_CASCADE_FILES_DIR` | Active les étapes de fichiers, dans ce répertoire. Montez-le aussi dans le conteneur. |

Les unités ne fixent que le répertoire de données, les ports et la clé, et une valeur posée dans une unité l'emporte sur celle du fichier env : n'y touchez pas. Après un changement : `sudo systemctl restart hotloop-cascade`.

## Vérifier

```sh
sudo podman healthcheck run hotloop-cascade
curl -s http://127.0.0.1:8081/readyz
sudo podman exec hotloop-cascade /usr/local/bin/hotloop-cascade workflows import - < workflow.yaml
```

La santé et les métriques sont sur le port 8081, publié uniquement sur la boucle locale. Si autre chose utilise déjà le 8080 ou le 8081, changez la partie gauche des lignes `PublishPort=`.

## Mise à jour

Les unités de l'application suivent `:stable` et portent `AutoUpdate=registry`. Activez le minuteur de Podman une fois par machine :

```sh
sudo systemctl enable --now podman-auto-update.timer
```

Quand il se déclenche, Podman télécharge `:stable` et, si le digest a changé, relance l'unité sur la nouvelle image. L'unité n'est pas comptée comme démarrée tant que le conteneur n'a pas passé son contrôle de santé (`Notify=healthy` ; le contrôle, c'est le binaire qui interroge son propre `/readyz`, sous forme de tableau JSON parce que l'image n'a pas de shell). Si la nouvelle image n'y arrive jamais, Podman remet la précédente sous `:stable` et la démarre. L'attente peut aller jusqu'à 15 minutes, car une nouvelle image migre la base de données en démarrant.

Pour retenir les mises à jour jusqu'à votre feu vert, laissez le minuteur arrêté et lancez `sudo podman auto-update` quand vous êtes prêt. Pour ne les laisser passer que dans une fenêtre, installez `update-window.conf` (son en-tête explique comment).

Deux choses qu'un retour arrière ne peut pas défaire. Les migrations ne vont que vers l'avant : faites donc une sauvegarde avant d'activer les mises à jour. Une version qui modifie une table de façon que l'ancienne ne puisse plus la lire le dit dans ses notes de version. Et la base de données : son image est figée sur une étiquette exacte et ne porte pas d'étiquette de mise à jour, volontairement. Un nouveau serveur qui ne démarre pas s'annule en remettant l'ancienne image, alors qu'une nouvelle image de base de données peut démarrer, modifier le répertoire de données, et ne se révéler une erreur qu'ensuite. Au sein de PostgreSQL 18, c'est une modification de l'étiquette, après les notes de version et une sauvegarde.

Dans la variante PostgreSQL, le serveur et chaque worker sont des unités séparées : une mise à jour qui ne démarre pas annule cette unité, et pas celle d'à côté.

## Ce qui a été essayé

Les unités ont été exécutées pour de vrai sur Podman 6.1.3, sans root sous systemd, avec un registre local à la place de ghcr.io et les unités livrées sans modification, sauf les ports de l'hôte. Variante autonome et variante PostgreSQL : un premier démarrage qui attend un conteneur sain ; une mise à jour vers un nouveau digest, revenue saine avec les données intactes et, en variante PostgreSQL, le conteneur de la base de données intact ; et une mise à jour vers une image qui s'arrête au démarrage, que `podman auto-update` a signalée comme `rolled back`, avec l'ancien digest de nouveau sain et le flux de travail précédent toujours en cours. En installation root sur Podman 4.9.3, la version précédente des unités a démarré et redémarré sous systemd ; et `Notify=healthy` n'est pas pris en compte par Quadlet 4.9, ce qui explique que les unités portent aussi `--sdnotify=healthy`.

Puis les deux variantes à nouveau en installation root, ce que les unités indiquent comme mode d'exécution, sur Podman 5.8.7 sous systemd dans un conteneur privilégié jetable, avec le même registre local à la place de ghcr.io comme miroir et les unités sans modification. Autonome : le démarrage a attendu un conteneur sain, un conteneur tué est revenu sain, une mise à jour vers une bonne image est montée saine sur le nouveau digest, une mise à jour vers une image qui s'arrête au démarrage a été signalée `rolled back` avec la bonne image de nouveau en marche, et un flux de travail a tourné après chaque étape. PostgreSQL, avec le serveur et un worker supplémentaire : `systemctl start` sur le serveur a attendu que la base de données puis le serveur soient sains, un serveur tué est revenu, une mise à jour vers une bonne image a déplacé le serveur et le worker en laissant le conteneur de la base de données tranquille, une mise à jour vers une image qui s'arrête au démarrage est revenue `rolled back` avec les deux de nouveau sur la bonne image et la base de données intacte, et un flux de travail a tourné avant, entre et après. Une chose à savoir en lisant cette sortie : le serveur et le worker partagent une image, et quand le premier a été annulé, l'autre affichait `true` à la place, avec un redémarrage, et a fini sur la bonne image quand même. Lequel est annulé en premier changeait d'une exécution à l'autre.

Exécuté sur du matériel réel (2026-11-17), sur un vrai Raspberry Pi et avec une mise à jour automatique Quadlet contre ghcr.io lui-même.
