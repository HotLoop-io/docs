---
title: "Feuille de route de Cascade"
description: "Ce que Cascade a déjà construit, ce que chaque version a apporté, et ce qui n'est ni construit ni planifié."
---

Aucune vérification de licence n'existe nulle part dans le code. Chaque phase se termine quand sa liste « réelle » a été exécutée sur de vrais systèmes, pas quand le code compile.

## 0.1.0, le MVP

Construit. Le moteur, les exécutions durables, la file Postgres et les workers, les expressions, l'étape Code dans sa cage, le coffre d'identifiants et OAuth2, les webhooks, les planifications et MQTT, des utilisateurs avec MFA obligatoire, OIDC, les projets et le RBAC, l'audit, l'historique des versions, l'API, l'éditeur, les connecteurs de la liste approuvée, l'import de flux de travail, les métriques et les traces, le chart Helm et les unités Quadlet. Publié selon `RELEASE_CHECKLIST.md`, pas avant.

## 0.2.0, identité et gouvernance

Construit, et livré dans 1.0.0 avec le nouvel éditeur. SAML, LDAP et AD, SCIM, rôles personnalisés, secrets externes, envoi des journaux, variables, dossiers, analyses, annotations d'exécution, les magasins de blobs S3 et Azure, et les politiques de masquage des exécutions. Chacune est essayée contre le vrai serveur auquel elle parle, et chacune a son écran dans l'éditeur.

## Ce qu'a apporté 1.0.x

1.0.0, c'est 0.1.0 plus 0.2.0 plus le nouvel éditeur, le tout dans une seule version. L'éditeur était la dernière pièce que nous voulions avant de mettre notre nom sous le numéro.

1.0.1 a corrigé une erreur de connexion : une base de données illisible répondait « non connecté » et effaçait le cookie, si bien qu'une brève panne déconnectait tout le monde et pouvait transformer un bon second facteur en code erroné. Elle répond maintenant « réessayez » et garde la session. 1.0.2 a permis à une étape Code de signer et de vérifier avec une clé HMAC conservée comme identifiant, et à un webhook d'indiquer les origines web autorisées à l'appeler depuis un navigateur. Rien à migrer entre 1.0.0 et 1.0.2.

Ce à quoi un workflow enregistré tient aujourd'hui : le fichier dit de quelle version de son format il est (`cascade: 1`), chaque étape porte sa propre version, et un workflow qui nomme une étape qui n'existe plus échoue à la validation et ne démarre pas, au lieu d'être modifié en silence. C'est ainsi que les étapes EmberOps ont été retirées en 1.0.0. Chaque version est démarrée sur les données de la précédente avant de sortir : le workflow est toujours là et l'identifiant s'ouvre toujours.

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

## 1.6.0, approbations, IA, Git et connecteurs

Fait. Quatre choses qui figuraient sur cette page comme non réalisées arrivent dans une seule version : des formulaires avec des étapes d'approbation humaine, des étapes d'IA, le contrôle de source avec Git avec des environnements et des instances protégées, et la spécification déclarative des connecteurs avec les outils qui l'entourent. Chacune a sa section plus bas.

## Formulaires avec étapes d'approbation humaine

Fait. L'étape Demander une approbation arrête une exécution et interroge une personne. Elle ouvre sur son téléphone le lien d'approbation de l'exécution, lit ce que vous avez écrit, remplit un formulaire s'il y en a un et appuie sur Approuver ou Refuser ; l'exécution reprend par Approuvée ou Refusée avec qui a répondu, quand et ce qui a été dit, et Cascade conserve la réponse comme un enregistrement lisible dans l'éditeur, l'API (`GET /api/v1/approvals`) et le serveur MCP (`list_approvals`), avec une ligne d'audit pour chacune. La page est du HTML simple sans script, dans les quatorze langues de l'éditeur. Elle nomme l'approbateur par le nom qu'il saisit ou par son compte connecté.

## Contrôle de source avec Git, environnements et instances protégées

Fait. Les workflows d'un projet vivent dans un dépôt Git, un fichier chacun, nommé d'après le workflow et portant son identifiant. Push les écrit et les valide au nom de la personne qui l'a fait ; pull aligne le projet sur le dépôt, en gardant les identifiants, en laissant désactivés les nouveaux workflows, en faisant des versions nouvelles des workflows modifiés et en laissant intact un changement fait des deux côtés sauf si vous dites qui l'emporte. C'est un écran du projet, six routes d'API et six outils MCP. Une instance peut recevoir un nom, affiché en haut de chaque écran, et une instance protégée refuse que ses workflows soient créés, modifiés, restaurés ou supprimés à la main dans l'éditeur, l'API ou MCP : ils arrivent par pull depuis Git, et les identifiants, les variables, les exécutions et l'activation ou la désactivation d'un workflow restent ouverts.

## Mise à l'échelle

Construit pour cette phase : le rôle webhook (son propre Deployment dans la variante séparée du chart), une limite de concurrence par flux de travail, et plusieurs mains contre une même base de données. Ce que nous n'avons pas fait, c'est le test fixé pour cette phase : tuer un main pendant une planification à la minute et ne trouver ni exécution en double ni exécution manquée sur une heure.

## Connecteurs

Les connecteurs de la liste approuvée qui ont été construits sont là : HTTP, ntfy, Discord, Gotify, e-mail, HotLoop, MQTT, bases de données, fichiers, et les magasins de blobs S3 et Azure. Le connecteur EmberOps était dans 0.1.x et a disparu en 1.0.0.

Et un connecteur peut désormais être un fichier : la spécification déclarative des connecteurs est publiée (un format versionné avec un JSON Schema), et toute API décrite par un fichier devient des étapes sans code. Les outils pour en écrire, essayer, publier et installer un sont dans le binaire (`connector init`, `validate`, `call`, `index` et `install`), et un index est un fichier statique que chacun peut héberger, avec un hash pour chaque fichier.

## Étapes d'IA

Fait. Interroger un modèle et Exécuter un agent. Le modèle est le vôtre, un serveur local comme Ollama ou un service hébergé avec votre clé, désigné par un identifiant, et les protocoles d'OpenAI et d'Anthropic sont tous deux parlés. Un agent utilise d'autres workflows comme outils et attend entre les tours dans la base de données.

Non réalisé, non planifié : un assistant qui écrit des workflows avec votre modèle. Il n'y a pas de service hébergé et il n'y en aura pas. (Le serveur MCP, qui permet à un agent de piloter Cascade de l'extérieur, est réalisé : voir 1.1.0.)

## La nouvelle interface de l'éditeur

Construit, et dans 1.0.0. L'éditeur est réécrit en Astro avec des îlots Svelte, compilé en ressources statiques et intégré au binaire Go comme l'ancien, c'est donc la même histoire d'un seul binaire, sans rien de nouveau à exécuter. Il reprend ses couleurs, sa typographie et sa marque des fichiers de marque HotLoop, et suit le mode clair ou sombre du système. Chaque écran de l'ancien éditeur y est et fait ce qu'il faisait (le code du canevas est passé tel quel), les fonctions de 0.2.0 ont leurs écrans, et un test de navigateur pilote chacun d'eux contre le vrai serveur dans un vrai Chrome. Rien de tout cela n'a changé l'API, le format de fichier ni le côté Go.
