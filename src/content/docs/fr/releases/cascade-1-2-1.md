---
title: "Notes de version : HotLoop Cascade 1.2.1"
description: "Le contenu de HotLoop Cascade 1.2.1, ce qui change à la mise à jour et ce qu'il faut lire avant de toucher à une usine en production."
sidebar:
  label: "1.2.1"
---

## Ce dont il s'agit

1.2.1 est 1.2.0 avec l'image arm64 en plus. Le code est celui de 1.2.0, le chart ne change que sa version, et chaque réglage, route, écran et outil est celui de 1.2.0.

## Pourquoi c'est une version à part

Le multi-architecture sort dans sa propre exécution. 1.2.0 était construit en amd64 seulement, est passé en production et y a été lu comme stable, et voici le petit changement de version qui construit les deux. À partir de maintenant, `stable`, `latest`, `1.2`, `1` et `1.2.1` listent amd64 et arm64.

## Mise à jour et retour arrière

Pas de migrations. `helm upgrade` vers 1.2.1, ou laissez `:stable` faire avancer les unités Quadlet. Une machine arm64 qui récupérait l'image arm64 livrée par 1.1.1 reçoit maintenant celle de 1.2.1. Remettre 1.2.0 ou 1.1.1 est sans danger, car rien n'a changé dans la base de données.
