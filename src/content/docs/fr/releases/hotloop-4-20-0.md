---
title: "Notes de version: HotLoop core 4.20.0"
description: "Ce qu'apporte HotLoop core 4.20.0, ce qui change à la mise à jour et ce qu'il faut lire avant de toucher une usine en production."
sidebar:
  label: "4.20.0"
---

La nouvelle interface web est maintenant celle qui se trouve sur `/`, et un agent peut modifier tout ce qu'il peut lire via MCP. Il n'y a pas de migrations, et un `helm upgrade` simple ou la mise à jour automatique de Quadlet la prend. La version précédente, la [4.19.11](/fr/releases/hotloop-4-19-11/), est la dernière dont les écrans par défaut étaient les anciens.

Cette construction est uniquement amd64, et la version suivante est un petit changement de version qui construit les images arm, comme se déroulent les deux passes. En attendant, `stable` garde les images arm qu'il détient.

## Ce qui a changé

- **La nouvelle interface web est celle par défaut, et l'ancienne a disparu.** Chaque écran a été reconstruit en page statique (Astro, avec des parties en Svelte), intégrée dans l'unique binaire, sans Node sur le boîtier et sans CDN. Elle était sur `/next` pendant la 4.19.x. Sur `/`, ce sont les mêmes dix-neuf écrans avec les mêmes commandes, champs, colonnes, formulaires et mots, pour le lecteur, l'opérateur et l'administrateur. Ce qui paraît différent, volontairement :
  - Les couleurs sont le fond chaud et l'orange de HotLoop, les mêmes que le site, Flow et Cascade, et la marque est la marque officielle.
  - Les écrans sont regroupés en Operate, Plant, Build et System dans un rail sur un poste de travail. Sur un téléphone, il y a une barre de cinq (Board, Alarms, Dashboards, Entities, More), et More ouvre tous les écrans.
  - Le contrôle de thème dit Dark ou Light, là où il montrait une lune.
  - Les icônes de l'application installée, la couleur du thème et la couleur de l'écran de démarrage suivent le nouveau style.
  - Un tiroir garde la place de sa barre de défilement, si bien qu'une carte à l'intérieur ne bouge pas quand son historique se charge.
- **Se connecter quand HotLoop est injoignable dit pourquoi et récupère tout seul.** Un téléphone qui ne s'est jamais connecté, ou qui s'est déconnecté, et qui ouvre la page sans connexion obtient l'écran de connexion avec une phrase disant que HotLoop ne répond pas d'ici. La page redemande toutes les trois secondes, et quand la connexion revient elle se recharge sans qu'on y touche. C'est l'ancien comportement, conservé.
- **MCP peut modifier tout ce qu'il peut lire.** Il y avait vingt-sept outils qui lisaient l'usine et commandaient des équipements ; il y en a 128. Soixante-quatre de plus modifient la configuration : équipements et tags, découverte et brokers, réseaux UniFi, entités, helpers, matériel et étiquettes, alarmes, automatisations et blueprints (un agent peut maintenant créer la règle à partir d'un blueprint, qu'il ne pouvait que prévisualiser), scripts, recettes, tableaux de bord et le reste de ce qu'un écran peut enregistrer. Trente-sept atteignent les fonctions propres à l'administrateur : utilisateurs et PIN, réglages, sauvegardes, escalade, cibles historian, logins du broker, la flotte d'edge relays et les rapports. Aucun n'est une seconde implémentation. Chacun est une route de l'API REST exécutée par le gestionnaire propre à cette route, si bien que la validation, le contrôle des permissions, le rechargement du runtime et la ligne d'audit sont ceux de la route, avec l'agent comme acteur.
- **Ce qui se tient devant un changement.** L'interrupteur `HOTLOOP_ALLOW_MCP_WRITES` (activé par défaut) doit être activé, et un appelant pour lequel `HOTLOOP_MCP_OIDC_WRITE_ROLE` est défini doit détenir ce rôle. L'appel porte exactement l'unique permission que demande sa route (`devices.write`, `alarms.write`, `users.manage`, `settings.write`, etc.) et il est refusé dans les mots de la route elle-même sans elle. Chaque changement exige un `reason`, enregistré comme une ligne `config` dans le journal système à côté de celle de la route. Commander des équipements reste `write_tag`, `call_service`, `run_script`, `apply_recipe` et `trigger_automation` derrière `HOTLOOP_ALLOW_WRITES`, l'indicateur inscriptible du tag et sa plage. Rendre un tag, une règle ou une recette inscriptible relève de la configuration et ne commande rien tant qu'on ne s'en sert pas ; ce qu'il commande alors passe par la même porte. Les deux interrupteurs d'écriture n'ont pas de route, donc `save_settings` les refuse à un agent comme l'écran Settings, et un agent ne peut pas activer l'interrupteur dont dépendent ses propres écritures. Le mot de passe d'un utilisateur passe par l'appel comme par l'API, et la ligne d'audit ne le porte jamais. Les outils existent aussi avec `--mcp-stdio`. [MCP](/fr/iot/mcp/#modifier-la-configuration) donne chaque outil, sa route et sa permission.

## Changements de l'API

- `GET /next` et `GET /next/` sont une `301` vers la racine, si bien qu'un favori fait quand la nouvelle interface était à côté de l'ancienne arrive toujours. Le `Location` est relatif, donc correct sous un chemin de base.
- `GET /static/` a disparu, et avec lui `GET /next/manifest.webmanifest`. La page, ses fichiers, les icônes, `/manifest.webmanifest` et `/sw.js` sont servis depuis la racine comme avant ; l'ancienne feuille de style et les anciens scripts n'étaient liés depuis nulle part et ne sont pas servis.
- `HOTLOOP_UI` n'est plus lu. Le définir ne fait rien.
- Aucune autre route n'a changé. Les outils MCP sont une surface nouvelle, pas des routes REST.

## Mise à jour depuis la 4.19.11

Un `helm upgrade` simple, ou la mise à jour automatique de Quadlet. Il n'y a pas de migrations et rien à configurer. Le premier chargement récupère la nouvelle page et le service worker remplace le cache de l'ancien, si bien qu'un téléphone qui avait l'application installée affiche les nouveaux écrans à sa prochaine ouverture. Rien ne peut être défait en mettant à jour, et un rollback vers la 4.19.11 est sûr parce que rien n'a changé dans la base de données.

## Connu

- Rien de nouveau. Ce qui reste ouvert sous Broken or missing dans la [feuille de route](/fr/roadmap/) : les jetons utilisateur X.509 d'OPC UA, les politiques obsolètes `Basic128Rsa15` et `Basic256` que propose notre serveur OPC UA et les mots de passe de plus de 64 octets (les deux de la bibliothèque), et les tests d'équipement silencieux de S7comm et EtherNet/IP contre des équipements réels.
