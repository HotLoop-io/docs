---
title: "Notes de version : HotLoop Cascade 1.6.0"
description: "Le contenu de HotLoop Cascade 1.6.0, ce qui change à la mise à jour et ce qu'il faut lire avant de toucher à une usine en production."
sidebar:
  label: "1.6.0"
---

## Ce dont il s'agit

1.6.0 est la version où Cascade cesse d'être seulement un endroit où tournent des workflows et devient un endroit où des personnes, des modèles et d'autres serveurs participent. Une exécution peut s'arrêter et demander à une personne sur son téléphone. Une exécution peut interroger un modèle qui est à vous. Vos workflows peuvent vivre dans Git et une instance de production peut refuser d'être modifiée à la main. Et n'importe quelle API web peut devenir des étapes à partir d'un fichier. Le moteur, le format de fichier et tout le reste sont ceux de 1.5.1.

## Demander à une personne, depuis un téléphone

La nouvelle étape Demander une approbation arrête l'exécution et attend. Mettez `execution.approvalUrl` dans une notification push : la personne qui la reçoit la touche, lit ce que vous avez écrit, remplit un petit formulaire si vous en avez fait un et appuie sur Approuver ou Refuser. La page est simple, rapide, ne demande aucune connexion sauf si vous le demandez, et parle la langue du navigateur dans les quatorze. L'exécution reprend par Approuvée ou Refusée avec qui a répondu, quand et ce qui a été dit. Chaque réponse est un enregistrement : dans l'éditeur sur l'exécution, dans l'API à `GET /api/v1/approvals`, dans le serveur MCP comme `list_approvals`, et dans le journal d'audit. Faites exiger un compte connecté à l'étape et elle n'accepte que les réponses des comptes que vous listez. Un lien ne marche qu'une fois. Attendre ne coûte rien : une réponse peut arriver une semaine plus tard et survivre à n'importe quel redémarrage.

## Interroger un modèle

Deux nouvelles étapes, IA : interroger un modèle et IA : exécuter un agent. Le modèle est le vôtre : un identifiant pointe vers un serveur que vous faites tourner (Ollama, vLLM, llama.cpp) ou vers un service hébergé dont vous avez une clé, avec le protocole d'OpenAI ou celui d'Anthropic. Rien ne part là où l'identifiant ne le dit pas, il n'y a pas de service hébergé, et chaque appel passe par la politique de sortie comme tous les autres. Interroger un modèle met la réponse sur l'élément, sous forme de texte ou d'objet JSON conforme à un schéma que vous donnez. Exécuter un agent donne au modèle un objectif et une liste d'outils dont chacun est un autre de vos workflows. Il en demande un, Cascade l'exécute, rend le résultat, et cela se répète jusqu'à ce que le modèle réponde ou n'ait plus de tours. Entre deux tours, l'exécution attend dans la base de données : un outil lent ne mobilise aucun worker.

## Des workflows dans Git

Connectez un projet à un dépôt, une branche et un dossier, puis faites push ou pull. Push écrit un fichier par workflow, nommé d'après lui et portant son identifiant, et le valide au nom de la personne qui a poussé avec le message qu'elle a donné. Pull aligne le projet sur le dépôt : les nouveaux fichiers deviennent des workflows (désactivés tant que vous ne les activez pas), les fichiers modifiés deviennent de nouvelles versions, les identifiants sont conservés pour qu'un workflow soit le même sur chaque instance, et un changement fait des deux côtés est signalé et laissé intact sauf si vous dites qui l'emporte. Les suppressions n'ont lieu que sur demande. Il y a une carte sur chaque projet, six routes d'API et six outils MCP. Il parle HTTPS avec un nom d'utilisateur et un jeton ou mot de passe gardés dans le coffre, à travers la politique de sortie.

## Instances protégées

Donnez un nom à une instance (développement, préproduction, production) et il s'affiche dans un badge en haut de chaque écran. Protégez-la, depuis les Paramètres ou avec `HOTLOOP_CASCADE_PROTECTED` (la valeur `protected` du chart, qu'aucun réglage ne peut annuler), et ses workflows ne peuvent plus être créés, modifiés, restaurés ou supprimés à la main dans l'éditeur, l'API ou MCP. Ils arrivent par pull depuis Git. Les identifiants, les variables, les exécutions et l'activation ou la désactivation d'un workflow restent ouverts, car ils diffèrent d'un environnement à l'autre. Une instance protégée fait des pull et pas de push.

## Des connecteurs en fichiers

Un connecteur est un fichier qui dit où est une API, comment s'y connecter, et ce que chaque appel prend et rend. Déposez-le dans `HOTLOOP_CASCADE_CONNECTORS_DIR` (le dossier `connectors` du répertoire de données) et chaque opération est une étape, avec un formulaire, un type d'identifiant propre, la pagination et les nouvelles tentatives triées comme le font les connecteurs intégrés. Le format est publié, versionné, et a un JSON Schema (`hotloop-cascade connector schema`). Les outils pour en écrire un sont dans le binaire : `connector init`, `validate`, `call` (essayer une opération contre l'API réelle) et `index` et `install` pour partager, où un index est un ensemble de fichiers statiques avec un hash chacun. Cascade ne télécharge jamais un index que vous n'avez pas nommé. Le serveur MCP a maintenant 91 outils.

## Revenir en arrière

Cette version ajoute trois tables (approbations et deux pour Git) et les migrations ne vont que vers l'avant : revenir à 1.5.1 demande la sauvegarde faite avant la mise à jour, pas seulement l'ancienne image. Rien d'existant ne change de forme.
