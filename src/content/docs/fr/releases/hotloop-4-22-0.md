---
title: "Notes de version: HotLoop core 4.22.0"
description: "Ce qu'apporte HotLoop core 4.22.0, ce qui change à la mise à jour et ce qu'il faut lire avant de toucher une usine en production."
sidebar:
  label: "4.22.0"
---

Un écran ouvert comme panneau (`/?screen=<name>`) remplit maintenant son affichage de bord à bord à toute taille, l'écran Alarms peut importer un fichier d'alarmes CODESYS, et quelques correctifs. Construite pour amd64 seulement ; la construction multi-architecture suit comme version suivante.

## Ce qui a changé

- **Une page de panneau remplit son écran.** En 1920x1080, 1366x768 et 3840x2160, elle couvre l'affichage sans espace perdu. Elle a un en-tête avec le nom de l'usine, un état Live avec le nombre d'équipements en ligne, et une horloge 24 heures avec la date. Les nombres et les jauges grandissent avec l'écran, tout comme l'axe et la légende de la tendance. Seule la page de panneau change ; les tableaux de bord sont comme avant et les cartes, tailles et noms d'un client sont les siens.
- **L'écran Alarms importe un fichier Export Alarms de CODESYS.** Réservé aux administrateurs : choisissez l'équipement, nommez l'application, choisissez le fichier, lisez l'aperçu de ce qui passe et de ce qui ne passe pas, puis importez. La route de l'API existait déjà.
- **Les équipements OPC UA PubSub sur une même adresse et un même port partagent un socket.** Le second équipement ne pouvait jamais se lier, et les options de réutilisation répartissaient les datagrammes d'un éditeur entre eux.
- **Les réponses lentes ne s'empilent plus.** Une carte de caméra plus lente que son rafraîchissement montre maintenant son image, les cartes et l'écran UniFi ne redemandent qu'après la dernière réponse, un lot de découverte qui a échoué une fois est retenté, et un équipement SNMP sur un nom d'hôte garde sa propre attente de la réponse.
- **Les produits du cœur sont sous la HotLoop Free Use License 1.0.** Les versions précédentes gardent les conditions sous lesquelles elles ont été publiées. Voir NOTICE.
- **L'icône de l'App Store** sur les pages des charts est la marque HotLoop.

## Changements de l'API

Aucun.

## Mise à jour depuis la 4.21.1

Un `helm upgrade` simple. Pas de migration, pas de nouveau secret, rien qui ne puisse être annulé.

## Testé

La page de panneau a été vérifiée en test aux trois tailles ci-dessus, avec Emberburn alimentant un Gateway.
