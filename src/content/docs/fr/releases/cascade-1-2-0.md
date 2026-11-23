---
title: "Notes de version : HotLoop Cascade 1.2.0"
description: "Le contenu de HotLoop Cascade 1.2.0, ce qui change à la mise à jour et ce qu'il faut lire avant de toucher à une usine en production."
sidebar:
  label: "1.2.0"
---

## Ce dont il s'agit

1.2.0 termine la liste d'outils du serveur MCP. Le moteur, le format de fichier des flux de travail, les écrans et l'API REST sont ceux de 1.1.1.

## Les quatre outils

Tous les MCP de la gamme HotLoop lisent et écrivent, et celui de Cascade avait quatre routes laissées de côté qu'une clé a le droit d'appeler. Ce sont maintenant des outils, 83 au total :

- `list_keys` et `revoke_key` : les clés de la personne à qui appartient la clé, et la révocation de l'une d'elles. Une clé peut se révoquer elle-même, ce que le détenteur d'une clé divulguée devrait pouvoir faire en premier. Les contrôles de la route elle-même décident des clés de qui l'appelant peut révoquer, comme dans l'éditeur.
- `listen_workflow` : ouvre l'URL de webhook de test d'un flux de travail pour un appel, pendant 1 à 600 secondes.
- `start_oauth` : renvoie l'adresse qu'une personne ouvre pour se connecter à un identifiant OAuth2. La personne doit toujours dire oui.

Chacun passe par sa route, donc la vérification des permissions, la validation et la ligne d'audit sont ceux de la route, et une écriture demande une raison comme tout autre outil d'écriture.

## Ce qui reste dehors

Dix routes refusent elles-mêmes une clé, parce qu'elles exigent une personne connectée : créer une clé d'API ou une clé de compte de service, créer un jeton SCIM, ajouter, modifier ou supprimer un fournisseur de secrets ou une destination de journaux, et votre propre mot de passe. Une clé qui pourrait créer des clés, ou changer la destination du journal d'audit, est une clé divulguée qui se maintient en vie. La page MCP contient la liste et la raison.

## amd64 seulement, et pourquoi

Cette version est construite uniquement en amd64. Le multi-architecture sort dans sa propre exécution, donc la version suivante est un petit changement de version qui construit les deux.

## Mise à jour et retour arrière

Pas de migrations. `helm upgrade` vers 1.2.0, ou laissez `:stable` faire avancer les unités Quadlet. Remettre 1.1.1 est sans danger, car rien n'a changé dans la base de données. Ce qu'un retour arrière ne peut pas défaire, c'est ce qu'un agent a déjà fait avec les nouveaux outils.
