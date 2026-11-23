---
title: "Notes de version : HotLoop Cascade 1.0.1"
description: "Le contenu de HotLoop Cascade 1.0.1, ce qui change à la mise à jour et ce qu'il faut lire avant de toucher à une usine en production."
sidebar:
  label: "1.0.1"
---

## Ce dont il s'agit

1.0.1 corrige une erreur dans la façon dont la connexion traite une base de données illisible. Rien d'autre n'a changé depuis 1.0.0.

## Le correctif

Quand la base de données avait un hoquet, Cascade lisait « je n'ai pas pu vérifier » comme « ce n'est pas valide » et répondait 401. Une vérification de session, une clé d'API, un jeton SCIM et l'utilisateur d'une clé le faisaient tous, et la vérification de session effaçait aussi le cookie, si bien qu'une brève panne déconnectait tout le monde. Désormais, seule une session qui n'existe pas ou qui appartient à un utilisateur désactivé donne un 401. Un magasin illisible répond 503 avec un Retry-After, et le cookie reste.

Le second facteur avait le même problème. Pendant une panne, un bon code d'authentification, un code de récupération ou une clé d'accès valide recevait la réponse d'un mauvais code, ce qui peut verrouiller une personne hors de son propre compte. Ces étapes répondent maintenant 503 pour une erreur de magasin ou de serveur et ne gardent le 401 que pour un vrai refus : un mauvais code, une clé d'accès refusée, une demande expirée. La connexion par clé d'accès ne prend plus non plus un échec de recherche d'utilisateur pour « aucun compte n'a cette clé d'accès ».

## Mise à jour et retour arrière

Pas de migrations. `helm upgrade` vers 1.0.1, ou laissez `:stable` faire avancer les unités Quadlet. Comme rien ne change dans la base de données, remettre 1.0.0 est sans danger. Une sauvegarde avant toute mise à jour reste une bonne habitude.
