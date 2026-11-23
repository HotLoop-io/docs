---
title: "Notes de version : HotLoop Cascade 1.3.0"
description: "Le contenu de HotLoop Cascade 1.3.0, ce qui change à la mise à jour et ce qu'il faut lire avant de toucher à une usine en production."
sidebar:
  label: "1.3.0"
---

## Ce dont il s'agit

1.3.0 met l'éditeur en 14 langues : anglais, espagnol, français, italien, allemand, norvégien bokmål, bulgare, grec, coréen, japonais, vietnamien, hindi, chinois simplifié et arabe. Le moteur, le format de fichier des flux de travail, l'API REST et le serveur MCP sont ceux de 1.2.1.

## Les langues

- Un sélecteur de langue se trouve dans la barre du haut de l'éditeur et sur la page de connexion. Le choix est conservé dans le navigateur, et une première visite suit la langue du navigateur.
- Chaque écran est traduit : flux de travail, exécutions, analyses, variables, identifiants, projets, utilisateurs, rôles, journal d'audit, paramètres, votre compte, secrets, diffusion des journaux et éditeur d'étapes. Les titres des étapes et leur aide, les types d'identifiants et les refus que le serveur envoie quand un enregistrement, une suppression ou une connexion est refusé le sont aussi.
- Les dates, nombres, durées et listes viennent du formatage propre au navigateur pour la langue choisie. L'arabe s'écrit de droite à gauche, avec le canevas, le code et les expressions toujours de gauche à droite. L'arabe utilise les chiffres de 0 à 9 et le calendrier grégorien.
- Les noms de produits, de nœuds et de protocoles et les valeurs d'exemple restent en anglais dans toutes les langues. Un message sur la façon dont la personne qui exploite l'instance a configuré un annuaire, un fournisseur SAML ou OpenID, un coffre de secrets ou un fichier de clés s'affiche tel que le serveur l'a écrit, parce que l'exploitant cherche ce texte.
- Les mots viennent du glossaire HotLoop partagé. Les lignes qu'un lecteur natif devrait confirmer en premier sont listées dans le `_review.json` de chaque langue, sous `web/src/i18n/locales`. Personne qui lit ces langues en natif ne les a encore relues.
- Une langue n'est proposée que lorsque toutes ses lignes sont là. Le build vérifie que chaque langue a toutes les clés de l'anglais, que les marqueurs et les balises survivent et que les formes plurielles sont correctes. Un test Go garde les mots anglais des étapes et les messages du serveur égaux à ce que le serveur peut dire, si bien qu'une nouvelle étape ou un nouveau refus ne peut pas sortir sans une ligne à traduire.

## Aussi dans cette version

- Le test de l'éditeur qui vérifie que les fichiers construits ne pointent jamais vers un autre hôte autorise maintenant quatre adresses d'exemple (`https://ntfy.sh`, `https://example.com`, `https://hotloop.plant` et `http://hotloop:8080`). Elles apparaissent dans le texte d'aide des étapes, qui est maintenant livré dans l'éditeur pour toutes les langues, et ce sont des mots dans une phrase que rien ne télécharge. Le test navigateur échoue toujours si l'éditeur demande quoi que ce soit à un autre hôte.
- Le navigateur de test a les polices Noto pour le coréen, le japonais, le chinois et l'hindi, si bien que ces écrans dessinent des lettres et non des cases vides.
- L'assistant de test OpenBao retente une écriture tant qu'OpenBao indique qu'un nouveau montage clé-valeur est encore en cours de mise à niveau (26e1e13).
- HotLoop LLC est nommée concédant de licence et mainteneur de Cascade (0ea9cd5).

## amd64 seulement, et pourquoi

Cette version est construite uniquement en amd64. Le multi-architecture sort dans sa propre exécution, donc la version suivante est un petit changement de version qui construit les deux. `stable`, `latest`, `1.3` et `1` listent la nouvelle image amd64 à côté de l'image arm64 vers laquelle ils pointaient déjà.

## Un problème connu

Dans l'installation séparée (pods serveur, worker et webhook sur PostgreSQL), les pods démarrent avant que le nom de la base de données soit résolu et redémarrent deux ou trois fois avant d'être prêts. Ils finissent par démarrer et l'installation réussit, mais c'est bruyant. 1.2.1 fait la même chose, donc ce n'est pas nouveau. Le correctif consiste à se connecter avec des nouvelles tentatives jusqu'à ce que la base de données soit prête, et il sort dans la prochaine version.

## Mise à jour et retour arrière

Pas de migrations. `helm upgrade` vers 1.3.0, ou laissez `:stable` faire avancer les unités Quadlet. Remettre 1.2.1 est sans danger, car rien n'a changé dans la base de données. La langue choisie vit dans le navigateur, donc revenir en arrière ne fait perdre que le sélecteur.
