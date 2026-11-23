---
title: "Notes de version : HotLoop Flow 2.7.0"
description: "Ce que apporte HotLoop Flow 2.7.0, ce qui change à la mise à jour et ce qu'il faut lire avant de toucher à une usine en marche."
sidebar:
  label: "2.7.0"
---

HotLoop Flow 2.7.0 est la première version de FlowLab, une seconde façon d'exécuter un onglet pour les bancs d'essai et les enregistreurs de données. Les flux tournent exactement comme avant, et un fichier de flux que vous avez aujourd'hui se charge et s'enregistre octet pour octet. FlowLab ne démarre que lorsque vous lui ajoutez un onglet, donc si vous ne le faites pas, la seule chose qui change pour vous est le correctif des sessions, le dernier point ci-dessous.

## Nouveautés

**Diagrammes FlowLab.** Un diagramme est un onglet où chaque nœud s'exécute une fois, quand chaque entrée reliée a une valeur, et où deux nœuds sans liaison entre eux s'exécutent en même temps. Ajoutez-en un avec le nouveau bouton FlowLab à côté du bouton de sous-flux. Il reçoit une barre au-dessus du canevas avec Exécuter et Arrêter, et tout ce qu'il dessine se trouve sur les liaisons : la dernière valeur sur chaque liaison après une exécution, une sonde sur n'importe quelle liaison qui garde les 100 dernières valeurs, et un point d'arrêt sur un nœud ou une liaison. Pause, pas vers l'intérieur, pas par-dessus et pas vers l'extérieur fonctionnent nœud par nœud, et la mise en évidence de l'exécution la ralentit assez pour la suivre et se désactive d'elle-même après dix minutes. Rien dans le débogage ne change ce que fait une exécution, et un test vérifie qu'une exécution avec une sonde se termine avec la même valeur sur chaque liaison qu'une sans sonde.

**Ce qu'il y a dans la boîte.** Des boucles while et for avec des valeurs transmises d'un passage au suivant, une boucle for sur un nombre ou un tableau, et une liaison d'erreur : un nœud qui reçoit une erreur ne fait rien et la transmet, et une erreur reliée à une boucle l'arrête avec la source et un code sur la sortie d'erreur de la boucle. Une liaison `after` fixe l'ordre de deux nœuds qui ne partagent aucune donnée. Il y a 21 types de nœuds dans la nouvelle section FlowLab de la palette : constante, maths, comparaison, logique, attente, regroupement, champ, construction de tableau, les deux boucles avec leur entrée et sortie de corps, un port série avec lecture et écriture, un analyseur de lectures, un détecteur de valeur stable, un journal vers un fichier texte, et un contrôle, un indicateur et un graphique pour le panneau. docs/diagrams.md détaille chacun.

**Un panneau qu'un opérateur peut ouvrir sur un téléphone.** `/panel/<diagram id>` se connecte comme l'éditeur et affiche les contrôles, indicateurs et graphiques du diagramme pendant qu'une exécution est active. Un graphique garde les 1 024 derniers points sauf si vous le changez et compte ce qu'il a laissé partir. Un contrôle est vérifié côté serveur selon son type, sa plage et ses choix, et la personne qui l'a défini apparaît dans le journal d'audit.

**Un port série qui survit à un câble débranché.** Une lecture qui ne reçoit rien, ou un port qui disparaît, est un défaut sur la liaison d'erreur. La lecture suivante essaie de rouvrir le port une fois par seconde, et compte la perte et le retour. L'exemple de `examples/diagram-scale-logger` lit une balance, analyse le poids et l'unité, indique quand les cinq dernières lectures concordent, affiche le tout sur le panneau avec un graphique de tendance et l'ajoute à un fichier CSV. Activez `autostart` sur l'onglet et il tourne sans aucun navigateur ouvert, et de nouveau après chaque déploiement.

**Nouvelle API.** `GET /diagrams`, `GET /diagrams/{id}`, et `POST` pour `run`, `stop` et `debug`, `PUT` pour `controls/{node}`, `breakpoints` et `probes`. La lecture demande `status.read`. Exécuter, arrêter, définir un contrôle et déboguer demandent une nouvelle permission, `diagram.run`, et chacun figure dans le journal d'audit avec son auteur.

**Les sessions ne sont plus écrasées par une lecture ratée.** Un fichier de sessions qui existe mais ne peut pas être lu, une erreur d'E/S ou un volume arrivé en retard, n'est plus remplacé par la connexion suivante, et un fichier dont le JSON est illisible est conservé à côté de l'original au lieu d'être perdu.

## Ce qui a changé

- Un onglet qui porte `ew_diagram` est exclu du runtime de messages. Tous les autres onglets tournent comme avant. Les nouvelles clés sont `ew_diagram` sur l'onglet et `ew_in` sur un nœud, et les deux survivent à l'aller-retour, que deux nouveaux tests et l'ancien vérifient.
- Le README comptait 79 types de nœuds et « environ 36 000 lignes de Go », et les deux étaient périmés. Il indique maintenant 79 types de nœuds pour les messages et 21 pour FlowLab.
- Le test du nœud client MCP de HotLoop écrit désormais par la barrière de HotLoop, car HotLoop livre ses écritures MCP activées.
- Un déploiement redémarre l'exécution de chaque diagramme, même de celui qu'il n'a pas modifié.
- FlowLab a ajouté environ 370 Ko au binaire, mesurés sur une machine avant et après. Le binaire fait 41,4 Mo et l'image amd64 45,34 Mo.
- Les images du README ont été refaites pour le nouveau bouton et la nouvelle section de la palette.

## Nouveaux réglages

Aucun. La permission `diagram.run` est nouvelle. Un utilisateur dont la liste de permissions est `["*"]` l'a. Quelqu'un avec une liste explicite peut lire un diagramme et son panneau avec `status.read` et ne peut pas en exécuter un tant que vous n'ajoutez pas `diagram.run`.

## Mise à jour

Sur amd64, un simple `helm upgrade` vers l'image et le chart de la 2.7.0 ; sur arm64, restez où vous êtes jusqu'à la 2.7.1, ou utilisez le nouveau tag dans votre unité Quadlet. Rien ne se passe au premier démarrage, il n'y a rien à migrer, et vos flux, enregistrements de déploiement et identifiants ne sont pas touchés. Si vous revenez en arrière après avoir enregistré un fichier de flux contenant un diagramme, la version précédente conserve le fichier octet pour octet et affiche `unknown node type` pour chaque nœud FlowLab, qui ne s'exécutent alors pas. Nous l'avons vérifié contre la version précédant celle-ci.

Image : `ghcr.io/hotloop-io/hotloop-flow:2.7.0`, linux/amd64 uniquement. Nous construisons d'abord l'amd64, le laissons s'établir comme stable en production, puis une petite 2.7.1 sans rien d'autre ajoute l'arm64. D'ici là, le tag `2` contient la nouvelle image amd64 et l'image arm64 de la 2.6.0, si bien qu'une machine arm64 qui suit `2` ou `2.6` garde ce qu'elle a, et une machine figée sur `2.7.0` a besoin de l'amd64. Chart : `https://hotloop.io/hotloop-flow/`. Le README de ce tag contient le reste, avec des images : https://github.com/HotLoop-io/hotloop-flow/blob/v2.7.0/README.md
