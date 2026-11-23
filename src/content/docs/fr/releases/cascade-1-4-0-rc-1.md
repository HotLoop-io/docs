---
title: "Notes de version : HotLoop Cascade 1.4.0-rc.1"
description: "Le contenu de HotLoop Cascade 1.4.0-rc.1, ce qui change à la mise à jour et ce qu'il faut lire avant de toucher à une usine en production."
sidebar:
  label: "1.4.0-rc.1"
---

Ceci est une version candidate de 1.4.0. Elle ne déplace aucun tag `stable`, `latest`, `1.4` ou `1` et n'est pas dans l'index de l'App Store, donc rien ne la récupère par défaut. C'est le code que 1.4.0 livrera, récupéré et exécuté sur un vrai hôte Podman avant le vrai tag, et 1.4.0 sera ce code avec seulement ses chaînes de version modifiées. Lisez les notes de 1.4.0 pour voir ce qu'elle contient.

## Ce dont il s'agit

1.4.0 rend une installation de Cascade plus facile à exploiter dans la durée : le serveur attend sa base de données au lieu de planter, les exécutions terminées peuvent être conservées un nombre de jours et nettoyées avec leurs fichiers, un propriétaire peut plafonner la fréquence des appels d'une clé d'API, et toute l'instance peut être sauvegardée et restaurée. Elle règle aussi le seul test de montée en charge que la feuille de route avait laissé ouvert. Le moteur, le format de fichier des flux de travail, l'API REST, le serveur MCP (83 outils) et les 14 langues sont ceux de 1.3.0.

## Attend sa base de données

Dans l'installation séparée (pods serveur, worker et webhook sur PostgreSQL), les pods démarraient avant que le nom de la base de données soit résolu et redémarraient deux ou trois fois avant d'être prêts. 1.2.1 et 1.3.0 faisaient de même. Un serveur, un worker ou un webhook qui ne peut pas joindre sa base de données le dit désormais dans son journal (« waiting for the database », avec la durée d'attente) et réessaie, jusqu'à cinq minutes, puis se connecte quand la base répond. Un mauvais mot de passe, une adresse mal formée ou une base qui n'existe pas l'arrêtent toujours immédiatement, car attendre n'y changerait rien. La sonde de démarrage du chart attend aussi longtemps que le programme. Une installation séparée neuve sur un vrai k3s n'a montré aucun redémarrage, dans les trois exécutions du test du chart.

## Conserver les exécutions terminées

Les Paramètres ont un nouveau champ, Conserver les exécutions terminées pendant (jours), et `PATCH /api/v1/settings` accepte `retentionDays`. Il est désactivé par défaut (0), et toutes les exécutions sont conservées comme toujours. Indiquez un nombre et, une fois par heure, un nœud principal supprime les exécutions réussies, échouées et annulées terminées depuis plus longtemps que cela, avec leurs données d'étape. Une exécution en cours n'est jamais touchée, ni une exécution dont le parent l'est. Chaque lot écrit `execution.pruned` dans le journal d'audit, et la modification du réglage écrit `instance.retention`.

Le même passage horaire nettoie désormais le magasin de blobs, que la rétention soit activée ou non : les sorties trop volumineuses pour la base de données et les pièces jointes vers lesquelles plus aucune exécution ne pointe. Un fichier partagé par deux exécutions reste jusqu'à ce que la dernière disparaisse, et seuls les fichiers écrits depuis plus de 24 heures sont examinés, si bien qu'un fichier qu'une étape vient de stocker n'est jamais supprimé. C'est nouveau aussi pour les exécutions que vous supprimez à la main : avant, une exécution supprimée laissait ses grosses sorties sur le disque pour toujours. Un passage qui ne peut pas lire ce dont il a besoin ne supprime rien, et chaque passage écrit `blobs.collected` dans le journal d'audit.

## Une limite par clé d'API

Les Paramètres ont un nouveau champ, Requêtes d'API par clé et par minute, et `PATCH /api/v1/settings` accepte `apiRateLimit`. Il est désactivé par défaut. Indiquez un nombre et chaque clé d'API, ainsi que chaque agent connecté via MCP avec l'une d'elles, peut faire ce nombre de requêtes par minute. Un appel au-delà de la limite reçoit un 429 avec un `Retry-After`. Chaque clé a son propre compteur, et les personnes connectées à l'éditeur n'y sont pas soumises. Le compteur est propre à chaque processus : avec trois nœuds principaux, une clé peut faire jusqu'à trois fois ce nombre. Le modifier écrit `instance.api_rate_limit` dans le journal d'audit.

## Sauvegarde et restauration

`hotloop-cascade backup DIR` écrit un nouveau répertoire contenant une copie cohérente de la base SQLite prise pendant que le serveur tourne, le fichier de clé qui scelle tous les identifiants stockés, les fichiers de blobs et un `manifest.json` de leurs empreintes. `hotloop-cascade restore DIR` les remet en place, après avoir vérifié chaque fichier par rapport au manifeste, et refuse d'écraser une base de données ou une clé différente sauf si vous indiquez `--replace`. Pour PostgreSQL, la sauvegarde contient la clé, les blobs et le manifeste, et affiche la commande `pg_dump` pour la part de la base ; la restauration affiche celle de `pg_restore`. Les blobs conservés dans S3 ou Azure ne sont pas copiés. `docs/GOVERNANCE.md` donne les détails.

## Les tests qui sont derrière

- Le test de montée en charge fixé par la feuille de route est fait. Deux nœuds principaux sur un même PostgreSQL ont exécuté pendant une heure un flux de travail qui se déclenche chaque minute pendant que l'un d'eux était tué par SIGKILL à la limite du créneau, sept fois de suite et laissé arrêté environ 25 secondes à chaque fois : 61 exécutions pour 61 créneaux d'une minute, aucune manquée, aucune doublée.
- Le serveur OAuth de la pile de test (Hydra) tourne maintenant sur Postgres. Il échouait en exécution parallèle avant, passait après, et échouait de nouveau quand le changement était annulé. Aucun code de Cascade n'inspecte les jetons.
- Le test du chart échoue désormais si un pod redémarre à l'installation.
- Les deux nouveaux refus de paramètres sont traduits dans toutes les langues, et l'aide des paramètres dit que les grosses sorties partent avec leurs exécutions.

## amd64 seulement, et pourquoi

Cette version est construite uniquement en amd64. Le multi-architecture sort dans sa propre exécution, donc la version suivante est un petit changement de version qui construit les deux. `stable`, `latest`, `1.4` et `1` listent la nouvelle image amd64 à côté de l'image arm64 vers laquelle ils pointaient déjà.

## Mise à jour et retour arrière

Pas de migrations : le schéma est celui de 1.3.0. `helm upgrade` vers 1.4.0, ou laissez `:stable` faire avancer les unités Quadlet. Remettre 1.3.1 est sans danger, car rien n'a changé dans la base de données. Ce qu'un retour arrière ne peut pas défaire, c'est un élagage : les exécutions supprimées par la rétention sont perdues, tout comme les blobs retirés par le nettoyage horaire. La rétention est désactivée tant que vous ne l'activez pas, faites donc d'abord une sauvegarde ; le nettoyage des blobs tourne sans elle.
