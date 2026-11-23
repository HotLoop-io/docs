---
title: "Notes de version : HotLoop Cascade 1.0.0"
description: "Le contenu de HotLoop Cascade 1.0.0, ce qui change à la mise à jour et ce qu'il faut lire avant de toucher à une usine en production."
sidebar:
  label: "1.0.0"
---

## Ce dont il s'agit

1.0.0 regroupe le travail sur l'identité et la gouvernance et un nouvel éditeur, en une seule version. Tout ce qui était dans 0.1.2 est toujours là et fonctionne comme avant : le moteur, les connecteurs, l'importeur, le chart Helm, les unités Quadlet et le format de fichier des flux de travail. Ce qui change, c'est ce qu'un site peut faire d'une instance, et son apparence pendant ce temps.

Nous l'appelons 1.0.0 parce que l'éditeur est la dernière pièce qu'il nous fallait avant de mettre notre nom sous ce numéro. Chaque écran fonctionne avec la vraie API, et chaque fonction ci-dessous a été testée contre le vrai serveur auquel elle parle, pas contre un substitut.

## Le nouvel éditeur

Il est reconstruit avec Astro et des îlots Svelte, aux couleurs et à la typographie de HotLoop, et il suit le mode clair ou sombre de votre système jusqu'à ce que vous en choisissiez un. Il reste intégré au binaire et ne récupère rien nulle part : une machine sans internet l'exécute aussi bien qu'une autre. Chaque écran de l'ancien éditeur est là et fait ce qu'il faisait, canevas compris : nous avons repris son code au lieu de le réécrire, et nous avons compté chaque écran, bouton, champ et appel d'API avant et après pour vérifier que rien ne manquait.

Les URL que vous aviez enregistrées fonctionnent toujours. `#/w/<id>`, `#/x/<id>`, `#/executions` et les liens de débogage ouvrent les mêmes écrans, et `/app/main.js` et `/app/main.css` répondent toujours.

## Les nouveautés

SAML, testé avec Keycloak, réponses signées uniquement. LDAP et Active Directory, testés avec OpenLDAP et un contrôleur de domaine Samba, avec des rôles issus des groupes. SCIM, testé avec scim2-tester, pour qu'un fournisseur crée et désactive des comptes sans que personne ne touche un écran. Des rôles personnalisés, construits à partir des permissions du projet. Des secrets externes dans OpenBao ou HashiCorp Vault, de sorte que le mot de passe d'un identifiant vit dans le coffre et y fait sa rotation. La diffusion du journal d'audit et des exécutions terminées vers syslog (TCP, UDP ou TLS) et OTLP, testée avec un vrai serveur syslog et Loki. Des variables, des dossiers, des analyses, des annotations sur les exécutions, des politiques de masquage, et des stockages de blobs S3 et Azure, testés avec Garage et Azurite.

L'éditeur a un écran pour chacun : Variables, Analyses et, dans Paramètres, Rôles, Masquage, Secrets externes, Diffusion des journaux, et Connexion et SCIM. Chaque personne ne se voit proposer que ce que son rôle autorise, et le serveur refuse toujours le reste.

## Les étapes EmberOps disparaissent

Nous avons retiré le connecteur EmberOps. Les neuf étapes (`erpnext.trigger`, `getList`, `getDoc`, `create`, `update`, `delete`, `submit`, `cancel` et `call`), le déclencheur « Quand un document EmberOps est créé ou modifié », le type d'identifiant EmberOps et les écrans et la documentation qui les proposaient ne sont plus dans 1.0.0. Si vous devez joindre EmberOps, l'étape HTTP appelle son API REST avec un identifiant, et cela fonctionne dès aujourd'hui.

Un flux de travail enregistré avec l'une de ces étapes n'est ni supprimé ni modifié en silence. Il échoue à la validation et ne démarre pas, et le message nomme l'étape et indique que les étapes EmberOps ont été retirées dans 1.0.0. Supprimez l'étape, ou remplacez-la par une étape HTTP, et il se relance. Un identifiant de type EmberOps reste dans votre liste, inutilisé, et vous pouvez le supprimer. L'importeur ne reprend plus de nœud EmberOps : il arrive désactivé, avec ses réglages dans ses notes, comme tout nœud pour lequel il n'a pas d'étape.

## Mise à jour depuis 0.1.2

`helm upgrade` vers 1.0.0, ou laissez `:stable` faire avancer les unités Quadlet. Huit migrations (0018 à 0025) s'exécutent pendant la montée de version. Elles créent des tables pour les rôles, les variables, les dossiers, les annotations, les politiques de masquage, SCIM, les fournisseurs de secrets et les destinations de journaux, et ajoutent une colonne : le dossier où se trouve un flux de travail. Elles ne touchent pas à ce que vous avez : vos flux de travail, identifiants et exécutions sont là où ils étaient et la clé les ouvre toujours. SAML, LDAP, SCIM et les stockages de blobs restent désactivés tant que vous n'avez pas défini leurs réglages `HOTLOOP_CASCADE_*`, décrits dans `docs/IDENTITY.md` et `docs/GOVERNANCE.md`. Rien ne change pour une instance qui n'en définit aucun, sauf si l'un de vos flux de travail utilise une étape EmberOps (voir plus haut).

## À savoir

Les migrations ne vont que vers l'avant. Un retour arrière remet l'ancienne image, il n'annule pas la migration de votre base de données : faites donc une sauvegarde avant la mise à jour, et considérez-la comme le chemin du retour. Rien dans ces migrations ne modifie ni ne supprime ce qui existait, mais nous n'avons pas exécuté l'ancienne image sur le nouveau schéma, donc nous ne le promettons pas.

Les secrets externes exigent des chemins autorisés. Un fournisseur sans aucun est refusé, volontairement, parce que le jeton du coffre peut en général lire bien plus que ce que devrait pouvoir nommer quiconque modifie des identifiants.

SCIM ne montre jamais le propriétaire de l'instance à un fournisseur, et un DELETE venant d'un fournisseur désactive et masque le compte au lieu de l'effacer, si bien qu'un fournisseur ne peut pas supprimer la dernière personne pouvant se connecter. Une recréation ramène le même compte.

Les variables ne sont pas des secrets. Toute personne qui peut lire un projet lit ses variables, et la valeur n'est pas masquée dans les données d'exécution. Les mots de passe vont dans les identifiants ou dans un coffre externe.

## Licence

Cascade est sous la Business Source License 1.1 (`BUSL-1.1`) de HotLoop, comme le reste de la gamme HotLoop. Ce n'est pas de l'open source et je ne vais pas faire semblant. Chaque version devient GPL-3.0 ou ultérieure quatre ans après sa première publication. L'usage domestique et en laboratoire est gratuit, tout comme l'usage en production par les écoles, les associations à but non lucratif et les administrations. L'usage professionnel passe par EmberNet, où l'inscription est gratuite, tout comme l'usage professionnel. L'hébergement en tant que service pour des tiers, la revente et l'intégration dans un produit que vous vendez ne sont pas accordés. Le fichier `LICENSE` est le texte juridique et il l'emporte sur ce paragraphe.
