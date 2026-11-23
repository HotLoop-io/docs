---
title: "Notes de version : HotLoop Cascade 1.5.0"
description: "Le contenu de HotLoop Cascade 1.5.0, ce qui change à la mise à jour et ce qu'il faut lire avant de toucher à une usine en production."
sidebar:
  label: "1.5.0"
---

## Ce dont il s'agit

1.5.0 permet à un propriétaire de supprimer une personne. Le moteur, le format de fichier et tous les autres écrans sont ceux de 1.4.2, et rien ne migre.

## Supprimer une personne

Auparavant, la seule façon de retirer un compte était de le désactiver, et il restait dans la liste pour toujours. Maintenant, Utilisateurs a un bouton Supprimer à côté de Désactiver, affiché aux propriétaires pour tous les comptes sauf le leur, et il demande confirmation avant d'agir. Le même appel existe dans l'API REST, `DELETE /api/v1/users/{user}`, et dans le serveur MCP sous le nom `delete_user`, avec la même règle : uniquement un propriétaire de l'instance, jamais votre propre compte, et jamais le dernier propriétaire.

Le compte, ses sessions, clés d'accès, identités de connexion et clés d'API disparaissent aussitôt, si bien que tout ce qui est encore connecté en tant que cette personne cesse de fonctionner à sa prochaine requête. Le journal d'audit enregistre qui a supprimé qui, avec l'e-mail, le rôle et le nombre de sessions et de clés supprimées, et sa chaîne se vérifie toujours.

Leur travail reste. Leur projet personnel devient un projet partagé à leur nom suivi de « (removed) », qui contient tous les flux de travail, identifiants et exécutions qu'il avait, et les propriétaires et administrateurs peuvent en déplacer n'importe quel élément vers un autre projet ou le confier à quelqu'un. Le même e-mail peut servir plus tard à créer un nouveau compte, qui démarre avec son propre projet.

Désactiver est inchangé et reste le bon choix quand vous voulez conserver le compte. Une personne que votre fournisseur d'identité retire via SCIM est toujours désactivée et masquée, pas supprimée.

## Revenir en arrière

Il n'y a pas de migration, donc l'image précédente fonctionne sur les mêmes données. Un compte supprimé ne revient pas ; restaurez la sauvegarde faite avant la suppression si vous en avez besoin.

## amd64 seulement, et pourquoi

Cette version est construite uniquement en amd64. Le multi-architecture sort dans sa propre exécution, donc la version suivante est un petit changement de version qui construit les deux. `stable`, `latest`, `1.5` et `1` listent la nouvelle image amd64 à côté de l'image arm64 vers laquelle ils pointaient déjà.
