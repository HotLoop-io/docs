---
title: "Feuille de route de Cascade"
description: "Ce que Cascade a déjà construit, ce que chaque version a apporté, et ce qui n'est ni construit ni planifié."
---

:::note[Couvre ce qui arrive]
Cette page couvre aussi quelques éléments plus récents que HotLoop Cascade 1.4.2, la dernière version publiée. Une partie peut ne pas figurer dans ce que vous avez installé. Les [notes de version](/fr/releases/) disent ce qui a changé.
:::

Aucune vérification de licence n'existe nulle part dans le code. Chaque phase se termine quand sa liste « réelle » a été exécutée sur de vrais systèmes, pas quand le code compile.

## 0.1.0, le MVP

Construit. Le moteur, les exécutions durables, la file Postgres et les workers, les expressions, l'étape Code dans sa cage, le coffre d'identifiants et OAuth2, les webhooks, les planifications et MQTT, des utilisateurs avec MFA obligatoire, OIDC, les projets et le RBAC, l'audit, l'historique des versions, l'API, l'éditeur, les connecteurs de la liste approuvée, l'import de flux de travail, les métriques et les traces, le chart Helm et les unités Quadlet. Publié selon `RELEASE_CHECKLIST.md`, pas avant.

## 0.2.0, identité et gouvernance

Construit, et livré dans 1.0.0 avec le nouvel éditeur. SAML, LDAP et AD, SCIM, rôles personnalisés, secrets externes, envoi des journaux, variables, dossiers, analyses, annotations d'exécution, les magasins de blobs S3 et Azure, et les politiques de masquage des exécutions. Chacune est essayée contre le vrai serveur auquel elle parle, et chacune a son écran dans l'éditeur.

## Ce qu'a apporté 1.0.x

1.0.0, c'est 0.1.0 plus 0.2.0 plus le nouvel éditeur, et rien d'autre. Nous l'avons appelée 1.0.0 parce que l'éditeur était la dernière pièce que nous voulions avant de mettre notre nom sous ce numéro, pas parce que tout ce qui suit est terminé.

1.0.1 a corrigé une erreur de connexion : une base de données illisible répondait « non connecté » et effaçait le cookie, si bien qu'une brève panne déconnectait tout le monde et pouvait transformer un bon second facteur en code erroné. Elle répond maintenant « réessayez » et garde la session. 1.0.2 a permis à une étape Code de signer et de vérifier avec une clé HMAC conservée comme identifiant, et à un webhook d'indiquer les origines web autorisées à l'appeler depuis un navigateur. Rien à migrer entre 1.0.0 et 1.0.2.

Ce que respecte aujourd'hui un flux de travail enregistré : le fichier indique la version de son format (`cascade: 1`), chaque étape porte sa propre version, et un flux de travail qui nomme une étape qui n'existe plus échoue à la validation et ne démarre pas, au lieu d'être modifié en silence. C'est ainsi que les étapes EmberOps ont été retirées en 1.0.0. Il n'y a pas encore de promesse sur le format ni sur l'API au-delà, ni de test de mise à niveau depuis chaque version antérieure : ce qui est testé figure dans `RELEASE_CHECKLIST.md`, qui met à niveau à la main depuis la dernière version. Une promesse arrive ici quand nous pouvons la tenir, et pas avant.

## 1.3.0, l'éditeur en 14 langues

Construit. Anglais, espagnol, français, italien, allemand, norvégien bokmål, bulgare, grec, coréen, japonais, vietnamien, hindi, chinois simplifié et arabe. Un sélecteur de langue dans la barre du haut et sur la page de connexion ; chaque écran, les titres et l'aide des étapes, et les refus du serveur sont traduits ; les dates, les nombres et les durées suivent la langue ; l'arabe s'écrit de droite à gauche, avec le canevas et le code de gauche à droite. Chaque langue est essayée sur chaque écran en largeur de bureau et de téléphone dans un vrai navigateur, et la compilation refuse une langue à laquelle il manque une ligne. Les mots viennent du glossaire HotLoop partagé.

## 1.5.0, supprimer une personne

Réalisé. Un propriétaire de l'instance peut supprimer une personne depuis Utilisateurs, l'API REST (`DELETE /api/v1/users/{user}`) ou le serveur MCP (`delete_user`). Son compte, ses sessions, ses passkeys, ses identités de connexion et ses clés d'API disparaissent, et le journal d'audit garde qui l'a fait et ce qui est parti. Ses workflows, ses identifiants et ses exécutions restent : le projet personnel devient un projet partagé portant son nom avec "(removed)", pour qu'un propriétaire ou un administrateur déplace le travail ou le confie à quelqu'un d'autre. Personne ne peut supprimer son propre compte, et le dernier propriétaire ne peut pas être supprimé. Désactiver quelqu'un existe toujours pour quand vous voulez garder le compte.

## 1.4.2, la page de connexion

Réalisé. La page de connexion est une carte centrée sur une page sobre, avec la marque et le nom du produit au-dessus, le bouton principal en orange HotLoop, et les autres moyens d'entrer (une passkey, l'authentification unique) en simples boutons à côté, en clair et en sombre et sur un téléphone. Le bouton d'authentification unique porte l'icône de son fournisseur quand le fournisseur est Vord. Chaque champ, chaque id et chaque chemin de connexion est resté tel qu'il était.

## 1.4.1, la page Paramètres

Construit. La page Paramètres ne remet plus un champ à son ancienne valeur quand la réponse d'un enregistrement arrive après que la personne l'a modifié : un champ qui contient encore ce qui a été envoyé prend la valeur du serveur, et un champ modifié depuis garde la modification. Et les listes de relecture des dossiers de langues ont disparu.

## 1.4.0, attente, rétention, limites et sauvegarde

Construit. Un pod qui démarre avant sa base de données, ce que fait le chart dans la variante séparée, l'attend maintenant et le dit, au lieu de redémarrer deux ou trois fois (l'installation n'a montré aucun redémarrage dans le test du chart). Et la rétention : un réglage pour le nombre de jours de conservation des exécutions terminées, désactivé par défaut, et un passage toutes les heures qui supprime les plus anciennes avec les données de leurs étapes. Le même passage supprime les fichiers du magasin de blobs auxquels plus aucune exécution ne renvoie : les sorties trop volumineuses pour la base de données et les pièces jointes, et un fichier partagé seulement quand la dernière exécution qui l'utilise a disparu. Et une limite de débit par clé d'API, via l'API et MCP, désactivée par défaut, qui répond 429 en indiquant combien de temps attendre. (Un webhook a sa propre limite, et un compte se verrouille après des mots de passe erronés répétés, comme avant.) Et `hotloop-cascade backup` et `restore` : la base SQLite, la clé et les fichiers de blobs avec un manifeste de hachages, et pour PostgreSQL la clé et les blobs plus la commande `pg_dump` pour la part de la base de données.

## 1.2.0, les quatre derniers outils du serveur MCP

Construit. Il manquait au serveur MCP quatre routes qu'une clé peut appeler : lister et révoquer ses propres clés, ouvrir le webhook de test d'un flux de travail et lancer une connexion OAuth2. Ce sont maintenant des outils, 83 au total, chacun passant par sa route, si bien que les mêmes contrôles de permissions que dans l'éditeur s'appliquent. Les dix routes qui exigent une personne connectée (créer des clés, des jetons SCIM, des fournisseurs de secrets et des destinations de journaux, et son propre mot de passe) restent exclues, car une clé capable de les créer pourrait se maintenir en vie ; la page MCP dit lesquelles et pourquoi.

## 1.1.0, MCP et les écrans manquants

Construit, et c'est la version. Le serveur MCP sur `/mcp` : 79 outils, chacun une route de l'API REST, de sorte que le gestionnaire de la route vérifie lui-même la permission, valide le corps, fait le changement et écrit la ligne d'audit. Il est livré activé, en lecture et en écriture, comme tous les MCP de la famille HotLoop, et ses deux interrupteurs appartiennent au déploiement (`HOTLOOP_CASCADE_MCP`, `HOTLOOP_CASCADE_MCP_WRITES`), qu'aucun outil ni aucune route ne peut modifier. La page MCP liste tous les outils et ce que chacun demande.

Et les écrans qui manquaient à l'éditeur : identifiants, projets (membres et comptes de service), utilisateurs, le journal d'audit, les paramètres et une page de compte avec les clés d'API, chacun avec les mêmes permissions que l'API et essayé dans un vrai navigateur avec chaque rôle. La page de connexion est maintenant celle de l'éditeur, avec ses couleurs et sa typographie, et non plus l'ancienne page Go.

## Non construit : environnements et échelle

Construit pour cette phase : le rôle webhook (son propre Deployment dans la variante séparée du chart), une limite de concurrence par flux de travail, et plusieurs mains contre une même base de données. Ce que nous n'avons pas fait, c'est le test fixé pour cette phase : tuer un main pendant une planification à la minute et ne trouver ni exécution en double ni exécution manquée sur une heure.

Non construit, non planifié :

- Le contrôle de source avec Git et les environnements.
- Les instances protégées.

## Non construit : connecteurs et personnes

Les connecteurs de la liste approuvée qui ont été construits sont là : HTTP, ntfy, Discord, Gotify, e-mail, HotLoop, MQTT, bases de données, fichiers, et les magasins de blobs S3 et Azure. Le connecteur EmberOps était dans 0.1.x et a disparu en 1.0.0.

Non construit, non planifié :

- La spécification déclarative de connecteurs publiée.
- Un SDK de plugins et un index.
- Des formulaires avec étapes d'approbation humaine. Les approbations doivent fonctionner depuis un téléphone, car la personne qui approuve un changement de recette est debout sur la ligne, pas assise à un bureau. (L'étape Wait retient déjà une exécution jusqu'à ce que quelqu'un appelle son URL de reprise, donc une approbation peut se construire aujourd'hui avec un lien ; ce qui manque, c'est le formulaire que l'approbateur ouvre et une trace de qui a approuvé.)

## Non construit : étapes d'IA

Des étapes de LLM et d'agents, et un constructeur qui utilise votre propre modèle. Apportez votre clé ou exécutez-le en local. Rien de tout cela n'existe encore et personne ne l'a planifié. Il n'y a pas de service hébergé et il n'y en aura pas. (Le serveur MCP, qui permet à un agent de piloter Cascade de l'extérieur, est construit : voir 1.1.0.)

## La nouvelle interface de l'éditeur

Construit, et dans 1.0.0. L'éditeur est réécrit en Astro avec des îlots Svelte, compilé en ressources statiques et intégré au binaire Go comme l'ancien, c'est donc la même histoire d'un seul binaire, sans rien de nouveau à exécuter. Il reprend ses couleurs, sa typographie et sa marque des fichiers de marque HotLoop, et suit le mode clair ou sombre du système. Chaque écran de l'ancien éditeur y est et fait ce qu'il faisait (le code du canevas est passé tel quel), les fonctions de 0.2.0 ont leurs écrans, et un test de navigateur pilote chacun d'eux contre le vrai serveur dans un vrai Chrome. Rien de tout cela n'a changé l'API, le format de fichier ni le côté Go.
