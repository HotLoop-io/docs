---
title: "Notes de version : HotLoop Flow 2.4.0"
description: "Ce que apporte HotLoop Flow 2.4.0, ce qui change à la mise à jour et ce qu'il faut lire avant de toucher à une usine en marche."
sidebar:
  label: "2.4.0"
---

HotLoop Flow 2.4.0 permet au tableau de bord EmberCORE de connecter les personnes à Flow. Une personne qui ouvre Flow depuis le tableau de bord entre avec le rôle que son tenant lui a donné, accès complet ou lecture seule, sans seconde connexion. C'est désactivé tant que la clé du tableau de bord n'est pas configurée, et rien de ce qui fonctionnait avant ne change.

## Nouveautés

**Connexion depuis le tableau de bord EmberCORE**
- Le tableau de bord place un jeton qu'il a signé dans `X-Embernet-Assertion` sur chaque requête qu'il relaie vers Flow, websocket de l'éditeur comprise. Flow le vérifie avec la clé publique du tableau de bord : la signature (ES256), l'émetteur (`embernet-dashboard`), qu'il a été créé pour ce Flow dans ce tenant (l'audience est `<tenant>/<release>`, donc un jeton pour une autre application n'ouvre rien ici) et son expiration, environ une minute. Un jeton faux sur l'un de ces points est refusé, et rien d'autre dans la requête ne le sauve.
- Le rôle vient de la table des rôles du tenant dans le tableau de bord. `*` désigne toutes les permissions. `read` désigne les flux, la palette, les réglages et l'état, et rien de ce qui les modifie : ni déploiement, ni inject, ni journal des déploiements. Les Opérateurs et les Lecteurs reçoivent `read` par défaut. Un rôle qui n'est ni l'un ni l'autre, ou aucun, n'a pas d'accès. Une personne connectée ainsi apparaît dans le journal des déploiements et la piste d'audit sous la forme `dashboard:<email>`.
- Il n'y a pas de session. Le tableau de bord envoie un jeton neuf à chaque requête, donc un rôle modifié là-bas prend effet à la requête suivante et il n'y a rien à révoquer.
- L'éditeur affiche « Ouvrez ceci depuis le tableau de bord EmberCORE » au lieu de proposer son propre formulaire de connexion, et retire le bouton Se déconnecter quand le tableau de bord vous a connecté. `GET /auth/mode` est la façon dont il le demande, avant que quiconque ne soit connecté.
- Le chart le prend sous `embernetSignin`. L'App Store transmet la clé publique du tableau de bord ; le chart la monte, écrit les réglages, redémarre le pod et annote le Service pour que le tableau de bord sache qu'il doit connecter les gens.

## Ce qui a changé

Rien, sauf si vous définissez la clé. Sans fichier de clé, Flow ne lit pas du tout l'en-tête, et un `helm template` des valeurs par défaut est ce qu'il était.

## Mise à jour

Un simple `helm upgrade` vers l'image et le chart de la 2.4.0. Rien ne se passe au premier démarrage.

Pour l'utiliser à la main, montez la clé publique du tableau de bord (un fichier PEM) et définissez `auth.assertion.publicKeyFile` et `auth.assertion.audience`, ou `HOTLOOP_FLOW_ASSERTION_PUBLIC_KEY_FILE` et `HOTLOOP_FLOW_ASSERTION_AUDIENCE`. Flow refuse de démarrer avec une clé qu'il ne peut pas lire ou sans audience. Les autres réglages sont `auth.assertion.issuer` (`embernet-dashboard`), `header` (`X-Embernet-Assertion`) et `hideLogin` (`true`).

La connexion administrateur et les jetons d'API continuent de fonctionner à côté. Ce sont les accès de secours pour le personnel et l'automatisation, et la disparition du formulaire de l'éditeur ne les touche pas.

Image : `ghcr.io/hotloop-io/hotloop-flow:2.4.0`, linux/amd64 et linux/arm64. Chart : `https://hotloop.io/hotloop-flow/`. Le README de ce tag contient le reste : https://github.com/HotLoop-io/hotloop-flow/blob/v2.4.0/README.md
