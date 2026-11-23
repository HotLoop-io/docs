---
title: "Notes de version : HotLoop Cascade 0.1.1"
description: "Le contenu de HotLoop Cascade 0.1.1, ce qui change à la mise à jour et ce qu'il faut lire avant de toucher à une usine en production."
sidebar:
  label: "0.1.1"
---

## Ce dont il s'agit

0.1.1 est la première version qui n'est pas une candidate. Il y a eu un tag 0.1.0 qui n'a jamais rien publié : il a été annulé avant d'atteindre le registre. Un tag ne bouge pas, c'est donc le même code, cette fois publié.

Ce que c'est : le moteur de flux de travail qu'il nous fallait pour un site industriel. Un seul binaire Go statique, SQLite sur une machine ou Postgres avec des workers quand il faut plus, et l'éditeur intégré au binaire, donc rien d'autre à exécuter.

## Ce qu'il contient

Le moteur, dont chaque étape est enregistrée en point de contrôle : un `kill -9` en plein milieu d'une exécution reprend exactement là où elle s'était arrêtée. Attentes durables, nouvelles tentatives, ports d'erreur et flux d'erreur. Des expressions, et une étape Code qui exécute du JavaScript isolé dans son propre processus.

Des webhooks avec une boîte de réception durable, des planifications qui se déclenchent exactement une fois par créneau quel que soit le nombre de nœuds principaux qui les surveillent, MQTT, et un déclencheur pour les fichiers qui arrivent dans un répertoire. Une étape HTTP pour tout ce qui a une API, et des connecteurs pour HotLoop, Postgres, EmberOps, e-mail, ntfy, Gotify et Discord. Pas d'autres, volontairement.

Un coffre d'identifiants avec rotation des clés, OAuth2 pour tous les modes d'autorisation dont un site a besoin, connexion par mot de passe, TOTP, clés d'accès ou votre fournisseur OpenID Connect, MFA obligatoire, projets et rôles, un journal d'audit vérifiable, chaque enregistrement conservé comme version, et une API à portées avec un document OpenAPI. Des métriques, des traces et des sondes, pour que quelqu'un d'autre que moi puisse voir quand quelque chose est bloqué.

## Le déployer

L'image existe en amd64 et en arm64. Récupérez-la par le digest ci-dessus si vous voulez un déploiement qui ne peut pas bouger.

Sur k3s : le chart Helm, autonome ou séparé en serveur et workers.

Sur une machine ordinaire : les unités Quadlet de `deploy/quadlet`, SQLite sur une machine ou Postgres avec des workers supplémentaires. Elles suivent `:stable`, et le minuteur de mise à jour automatique de Podman les fait avancer. Une mise à jour qui ne démarre pas en bonne santé revient à l'image qui tournait. Nous l'avons fait tourner pour de vrai, dans les deux variantes, sur Podman 5.8.7 sous systemd : le démarrage attend l'état sain, un conteneur tué revient, une bonne mise à jour passe, une mauvaise est annulée, et un flux s'exécute après chacune.

## À savoir

Les migrations ne vont que vers l'avant. Un retour arrière remet l'ancienne image, il n'annule pas la migration de votre base de données : faites donc une sauvegarde avant d'activer les mises à jour.

Le registre était privé pour cette version, il fallait donc d'abord un `podman login ghcr.io` en root. L'image et le chart sont publics à partir de 0.1.2 et se récupèrent sans connexion.

Si vous perdez la clé qui scelle les identifiants stockés, tous deviennent illisibles. Gardez-en une copie ailleurs que sur la machine.

## Licence

Cascade est sous la Business Source License 1.1 (`BUSL-1.1`) de HotLoop, comme le reste de la gamme HotLoop. Ce n'est pas de l'open source et je ne vais pas faire semblant. Chaque version devient GPL-3.0 ou ultérieure quatre ans après sa première publication. L'usage domestique et en laboratoire est gratuit, tout comme l'usage en production par les écoles, les associations à but non lucratif et les administrations. L'usage professionnel passe par EmberNet, où l'inscription est gratuite, tout comme l'usage professionnel. L'hébergement en tant que service pour des tiers, la revente et l'intégration dans un produit que vous vendez ne sont pas accordés. Le fichier `LICENSE` est le texte juridique et il l'emporte sur ce paragraphe.

## Ce qui n'est pas encore là

SAML, LDAP, SCIM, environnements, l'ordonnanceur haute disponibilité avec baux, plus de connecteurs, étapes d'IA. C'est pour 0.2.0 et la suite, et tout est dans la feuille de route.
