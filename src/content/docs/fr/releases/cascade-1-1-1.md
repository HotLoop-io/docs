---
title: "Notes de version : HotLoop Cascade 1.1.1"
description: "Le contenu de HotLoop Cascade 1.1.1, ce qui change à la mise à jour et ce qu'il faut lire avant de toucher à une usine en production."
sidebar:
  label: "1.1.1"
---

## Ce dont il s'agit

1.1.1 est 1.1.0 avec l'image arm64 en plus, et une étiquette. Le code est celui de 1.1.0, le chart ne change que sa version, et chaque réglage, route et écran est celui de 1.1.0.

L'étiquette est `org.opencontainers.image.version`. L'image ne la portait jamais, donc la lecture de la configuration de l'image n'indiquait aucune version. Elle indique maintenant la version de la publication, issue du même argument de build que la version du binaire.

## Pourquoi c'est une version à part

Le multi-architecture sort dans sa propre exécution. 1.1.0 était construit en amd64 seulement, est passé en production et y a été lu comme stable, et voici le petit changement de version qui construit les deux. À partir de maintenant, `stable`, `latest`, `1.1`, `1` et `1.1.1` listent amd64 et arm64.

## Mise à jour et retour arrière

Pas de migrations. `helm upgrade` vers 1.1.1, ou laissez `:stable` faire avancer les unités Quadlet. Une machine arm64 qui récupérait l'image arm64 livrée par 1.0.2 reçoit maintenant celle de 1.1.1. Remettre 1.1.0 ou 1.0.2 est sans danger, car rien n'a changé dans la base de données.
