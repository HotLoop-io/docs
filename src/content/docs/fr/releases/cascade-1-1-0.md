---
title: "Notes de version : HotLoop Cascade 1.1.0"
description: "Le contenu de HotLoop Cascade 1.1.0, ce qui change à la mise à jour et ce qu'il faut lire avant de toucher à une usine en production."
sidebar:
  label: "1.1.0"
---

## Ce dont il s'agit

1.1.0 donne à Cascade un serveur MCP, les écrans qui manquaient à l'éditeur, et déplace la connexion dans l'éditeur. Le moteur, le format de fichier des flux de travail et l'API REST sont ceux de 1.0.2.

## Le serveur MCP

Il se trouve à `/mcp`, sur la même adresse que l'API, il est livré activé et il écrit. Tous les MCP de la gamme HotLoop lisent et écrivent, et Cascade était le dernier à n'avoir aucun MCP.

Un agent se connecte avec une clé d'API et obtient ce que le détenteur de cette clé pourrait faire, réduit aux portées de la clé. Il y a 79 outils, et chacun est une route de l'API REST : un appel passe par le gestionnaire de la route elle-même, donc la vérification des permissions, la validation, l'écriture et la ligne d'audit sont ceux de la route. Rien n'a été copié dans le serveur MCP, donc rien ne peut diverger, et rien n'a été laissé de côté, donc rien n'est ignoré.

- Un outil qui modifie quelque chose demande une `reason`, et le journal d'audit la conserve à côté de la modification, avec la clé et le nom que le client s'est donné.
- Le secret d'un identifiant ne revient jamais, à personne. Un identifiant créé via MCP voit ses secrets scellés dès leur arrivée.
- `HOTLOOP_CASCADE_MCP` et `HOTLOOP_CASCADE_MCP_WRITES` sont les interrupteurs du déploiement, tous deux activés par défaut. Aucun outil et aucune route d'API ne peut les modifier, donc un agent qui peut modifier les réglages de l'instance ne peut toujours pas réactiver les écritures.
- Les routes qui refusent elles-mêmes une clé (création de clés d'API, de jetons SCIM, de fournisseurs de secrets et de destinations de journaux) ne sont pas des outils, car une clé qui pourrait créer des clés est une clé divulguée qui se maintient en vie. La page MCP les liste avec chaque outil et la permission qu'il demande.

## Les écrans

Identifiants, Projets, votre Compte et, pour les propriétaires et administrateurs, Paramètres, Utilisateurs et le journal d'audit. Chacun suit les mêmes permissions que l'API : chaque personne ne se voit proposer que ce que son rôle autorise, et le serveur refuse toujours le reste.

- **Identifiants** se créent, s'ouvrent, se modifient, se partagent avec d'autres projets et se suppriment. Un secret se saisit une seule fois et l'écran indique seulement qu'il est défini.
- **Projets** contient les membres et leurs rôles, ainsi que les clés de compte de service avec lesquelles une intégration permanente se connecte, affichées une seule fois.
- **Compte** crée et révoque vos clés d'API, avec lesquelles l'API et MCP se connectent, et change votre mot de passe.
- **Utilisateurs** crée des personnes et les désactive ou les réactive. Le **journal d'audit** se lit, se filtre et se vérifie contre toute altération. **Paramètres** contient l'exigence du second facteur et le flux d'erreur.

La connexion est maintenant la propre page de l'éditeur, à `/login`, aux couleurs de l'éditeur, clair et sombre, sur téléphone comme sur poste fixe. Elle fait tout ce que faisait l'ancienne page : configuration au premier lancement, mots de passe, comptes d'annuaire, authentification unique, clés d'accès, second facteur et codes de récupération.

## amd64 seulement, et pourquoi

Cette version est construite uniquement en amd64. Le multi-architecture sort dans sa propre exécution, donc la version suivante est un petit changement de version qui construit les deux. D'ici là, `stable`, `latest` et les tags courts listent cette image amd64 à côté de l'image arm64 vers laquelle ils pointaient déjà, de sorte qu'une machine arm continue de récupérer l'image. Le tag de version, `1.1.0`, est uniquement amd64.

## Mise à jour et retour arrière

Pas de migrations. `helm upgrade` vers 1.1.0, ou laissez `:stable` faire avancer les unités Quadlet. Remettre 1.0.2 est sans danger, car rien n'a changé dans la base de données. Ce qu'un retour arrière ne peut pas défaire, c'est ce qu'un agent a déjà fait : ses modifications restent faites, et les lignes d'audit qu'il a écrites restent dans le journal avec le type d'acteur `mcp`. Une sauvegarde avant toute mise à jour reste une bonne habitude.
