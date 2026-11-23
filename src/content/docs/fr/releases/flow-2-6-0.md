---
title: "Notes de version : HotLoop Flow 2.6.0"
description: "Ce que apporte HotLoop Flow 2.6.0, ce qui change à la mise à jour et ce qu'il faut lire avant de toucher à une usine en marche."
sidebar:
  label: "2.6.0"
---

HotLoop Flow 2.6.0 donne à une liaison durable un moyen de vous dire qu'elle a cessé de livrer. Rien ne change dans le fonctionnement de vos flux. Si vous faites tourner des liaisons durables sur une ligne d'usine, vous obtenez un compteur sur lequel alerter pour le seul défaut qui ressemblait auparavant à une file tranquille.

## Nouveautés

**Une liaison durable bloquée est comptée et décrite.** La pompe d'une liaison durable remarque désormais quand la liaison dit que des messages attendent et que la file ne contient rien de lisible, et que c'est toujours le cas après une courte revérification. Elle ajoute un à `hotloop_flow_durable_wire_stranded_total{wire=...}` et écrit un avertissement dans le journal du runtime, une fois par type de défaut, avec les compteurs de la liaison à côté de ce que contient sa table : jusqu'où la pompe est allée, la profondeur, les lignes sur le disque, ce qui est en vol, et combien ont été ajoutés, livrés et abandonnés. Sur une liaison saine, le compteur est à zéro et y reste, donc toute valeur au-dessus de zéro mérite une alerte.

Nous l'avons ajouté parce qu'une liaison qui abandonne le plus ancien n'a pas réussi à se vider une fois sur quelques milliers d'exécutions de test et que nous n'avons pas pu comprendre pourquoi. Cette version est l'instrument, pas un correctif. Si elle se déclenche un jour sur votre ligne, la ligne de journal est ce qu'il nous faut.

## Ce qui a changé

- Le texte de licence livré dans l'image écrit EmberNet comme le fait la copie canonique. Trois lignes, orthographe seulement.
- Les images du README sont de simples images, claire puis sombre, donc elles s'affichent sur docs.hotloop.io.

## Nouveaux réglages

Aucun. La métrique est activée et il n'y a pas d'interrupteur.

## Mise à jour

Un simple `helm upgrade` vers l'image et le chart de la 2.6.0, ou le nouveau tag dans votre unité Quadlet. Rien ne se passe au premier démarrage, il n'y a rien à migrer, et les flux, les enregistrements de déploiement et les identifiants ne sont pas touchés.

Image : `ghcr.io/hotloop-io/hotloop-flow:2.6.0`, linux/amd64 et linux/arm64. Chart : `https://hotloop.io/hotloop-flow/`. Le README à ce tag a le reste, avec des images : https://github.com/HotLoop-io/hotloop-flow/blob/v2.6.0/README.md
