---
title: "Notes de version : HotLoop Cascade 1.4.1"
description: "Le contenu de HotLoop Cascade 1.4.1, ce qui change à la mise à jour et ce qu'il faut lire avant de toucher à une usine en production."
sidebar:
  label: "1.4.1"
---

## Ce dont il s'agit

1.4.1 corrige un point sur la page Paramètres et range les dossiers de langues. Le moteur, le format de fichier, l'API REST, le serveur MCP et tous les autres écrans sont ceux de 1.4.0.

## La page Paramètres garde ce que vous avez modifié

Chaque Enregistrer de la page Paramètres reçoit en réponse les paramètres tels que le serveur les a. Si vous modifiiez un champ après avoir appuyé sur Enregistrer et avant le retour de cette réponse, la réponse remettait le champ à la valeur que vous veniez de quitter, sans aucun message. Un administrateur qui enregistrait puis modifiait aussitôt le champ suivant pouvait perdre cette modification.

Désormais, un champ qui contient encore ce qui a été envoyé prend la valeur du serveur, et un champ que vous avez modifié depuis garde votre modification. Un test navigateur retient la réponse pendant une seconde et demie et modifie un champ entre-temps. Sur la page de 1.4.0 il échoue (il affiche la première valeur là où la seconde avait été saisie), et sur cette page il réussit.

## Les dossiers de langues

Les listes `_review.json` de chaque dossier de langue ont disparu, tout comme le contrôle de build qui les lisait. Rien d'autre ne les lisait, et aucune relecture par des locuteurs natifs n'est prévue. Les traductions sont celles livrées par 1.4.0.

## amd64 seulement, et pourquoi

Cette version est construite uniquement en amd64. Le multi-architecture sort dans sa propre exécution, donc la version suivante est un petit changement de version qui construit les deux. `stable`, `latest`, `1.4` et `1` listent la nouvelle image amd64 à côté de l'image arm64 vers laquelle ils pointaient déjà.

## Mise à jour et retour arrière

Pas de migrations : le schéma est celui de 1.4.0. `helm upgrade` vers 1.4.1, ou laissez `:stable` faire avancer les unités Quadlet. Remettre 1.4.0 est sans danger, car rien n'a changé dans la base de données.
