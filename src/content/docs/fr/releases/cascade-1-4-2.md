---
title: "Notes de version : HotLoop Cascade 1.4.2"
description: "Le contenu de HotLoop Cascade 1.4.2, ce qui change à la mise à jour et ce qu'il faut lire avant de toucher à une usine en production."
sidebar:
  label: "1.4.2"
---

## Ce dont il s'agit

1.4.2 donne à la page de connexion un aspect plus épuré. Le moteur, le format de fichier, l'API REST, le serveur MCP et tous les autres écrans sont ceux de 1.4.1.

## La page de connexion

La page est maintenant une carte sur un fond discret, avec la marque et le nom HotLoop Cascade centrés au-dessus. Se connecter est l'unique bouton orange. La connexion par clé d'accès et l'authentification unique sont de simples boutons dessous, et le bouton d'authentification unique affiche l'icône Vord quand Vord est le fournisseur. Elle se lit de la même façon en clair et en sombre et sur un téléphone, et les boutons de langue et de thème restent en haut à droite.

Rien ne change dans la façon de se connecter : les mêmes champs, les mêmes accès, la configuration du premier lancement, la connexion par annuaire, le second facteur, l'ajout d'une clé d'accès ou d'une application d'authentification. La page garde ses identifiants, donc les gestionnaires de mots de passe et les favoris se comportent comme avant.

## amd64 seulement, et pourquoi

Cette version est construite uniquement en amd64. Le multi-architecture sort dans sa propre exécution, donc la version suivante est un petit changement de version qui construit les deux. `stable`, `latest`, `1.4` et `1` listent la nouvelle image amd64 à côté de l'image arm64 vers laquelle ils pointaient déjà.
