---
title: "Notes de version : HotLoop Cascade 1.5.1"
description: "Le contenu de HotLoop Cascade 1.5.1, ce qui change à la mise à jour et ce qu'il faut lire avant de toucher à une usine en production."
sidebar:
  label: "1.5.1"
---

## Ce dont il s'agit

1.5.1 est 1.5.0 avec l'image arm64 en plus. Le code est celui de 1.5.0, le chart ne change que sa version, et chaque réglage, route, écran et outil est celui de 1.5.0, y compris la suppression d'une personne par un propriétaire.

## Pourquoi c'est une version à part

Le multi-architecture sort dans sa propre exécution. 1.5.0 était construit en amd64 seulement, et voici le petit changement de version qui construit les deux. À partir de maintenant, `stable`, `latest`, `1.5`, `1` et `1.5.1` listent amd64 et arm64.

## Mise à jour et retour arrière

Pas de migrations. `helm upgrade` vers 1.5.1, ou laissez `:stable` faire avancer les unités Quadlet. Une machine arm64 qui récupérait l'image arm64 livrée par 1.4.2 reçoit maintenant celle de 1.5.1. Remettre 1.5.0 ou 1.4.2 est sans danger, car rien n'a changé dans la base de données.
