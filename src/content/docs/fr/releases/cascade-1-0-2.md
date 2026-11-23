---
title: "Notes de version : HotLoop Cascade 1.0.2"
description: "Le contenu de HotLoop Cascade 1.0.2, ce qui change à la mise à jour et ce qu'il faut lire avant de toucher à une usine en production."
sidebar:
  label: "1.0.2"
---

## Ce dont il s'agit

1.0.2 permet à un flux de travail de signer et de vérifier des choses sans qu'un secret se trouve jamais dans les données d'un élément, et permet à un formulaire public hébergé sur un autre site d'appeler un webhook depuis le navigateur. Rien d'autre n'a changé depuis 1.0.1.

## Nouveautés de l'étape Code

- **Fonctions de cryptographie.** `sha256(text)`, `hmacSHA256(key, text)`, `randomHex(bytes)`, `base64Encode(text)`, `base64Decode(text)` et `safeEqual(a, b)`. Elles sont calculées en Go, donc les résultats sont ceux de la bibliothèque standard, et le script n'a toujours ni `require`, ni réseau, ni fichiers.
- **Un identifiant pour l'étape.** L'étape Code a un emplacement d'identifiant `secret`. Donnez-lui un identifiant `HMAC key` (un nouveau type d'identifiant intégré avec un seul champ secret, `key`) et le script le lit comme `credential.key`. La clé vit dans le coffre comme tout autre secret, et le coffre la masque dans tout ce que l'exécution enregistre, même si le script la renvoie. Une étape sans identifiant voit un objet `credential` vide.

La raison : un formulaire public vérifie une preuve de travail avec un HMAC. Jusqu'ici, la seule façon de le faire dans un flux de travail était de mettre la clé dans un élément ou une variable, et les deux se retrouvent dans les exécutions stockées ou en clair. Maintenant la clé est un identifiant et l'exécution stockée contient la signature et rien d'autre.

## Nouveautés d'un webhook

- **`corsOrigins`.** Un déclencheur webhook accepte une liste d'origines web (`https://example.com`, ou `*`) dont les pages peuvent l'appeler depuis un navigateur. Cascade répond lui-même à la requête préliminaire du navigateur, sans démarrer d'exécution, et ajoute `Access-Control-Allow-Origin` à la réponse pour une origine listée. Un webhook qui n'en liste aucune se comporte exactement comme avant : pas d'en-têtes CORS, donc une page de navigateur ne peut pas lire la réponse. Une entrée doit être une origine, sans chemin.

## Mise à jour et retour arrière

Pas de migrations. `helm upgrade` vers 1.0.2, ou laissez `:stable` faire avancer les unités Quadlet. Les flux de travail qui n'utilisent jamais les nouvelles fonctions se comportent exactement comme avant, donc remettre 1.0.1 est sans danger pour eux ; un flux de travail qui appelle une nouvelle fonction échoue sur 1.0.1 avec la fonction non définie. Une sauvegarde avant toute mise à jour reste une bonne habitude.
