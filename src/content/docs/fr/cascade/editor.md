---
title: "L'éditeur de Cascade"
description: "L'éditeur est intégré au binaire de Cascade : dossiers, canevas avec exécution jusqu'ici, exécutions pas à pas, identifiants, projets, utilisateurs, audit."
---

L'éditeur est intégré au binaire : il n'y a rien d'autre à exécuter et il ne récupère rien nulle part. Ouvrez l'adresse sur laquelle le serveur écoute et connectez-vous. C'est une application Astro avec des îlots Svelte, compilée en fichiers statiques à la construction de l'image, avec les mêmes couleurs et la même typographie que tous les autres écrans HotLoop, en clair ou en sombre selon votre système tant que vous n'avez pas choisi.

![Flux de travail, rangés en dossiers](/synced/cascade/docs/screenshots/workflows.png)

Les flux de travail vivent dans des projets, et ceux d'un projet vivent dans des dossiers qui s'emboîtent aussi profondément que votre usine : zone, ligne, cellule. Un flux de travail change de dossier depuis sa propre ligne.

![Le canevas, une étape sélectionnée et ses réglages à côté](/synced/cascade/docs/screenshots/editor.png)
![La même vue, en sombre](/synced/cascade/docs/screenshots/editor-dark.png)

Le canevas est là où il a toujours été : glissez d'une sortie vers une entrée, déplacez une étape, `Ctrl+S` pour enregistrer, `Delete` pour retirer une étape. Exécuter jusqu'ici exécute ce qui est à l'écran, sans enregistrer, jusqu'à l'étape choisie et affiche ce qu'elle a produit sous forme de tableau, de champs ou de JSON, et vous pouvez épingler cette sortie pour que l'étape cesse de s'exécuter pendant que vous construisez les suivantes. Chaque champ accepte une expression et montre ce qu'elle donne avec la dernière exécution de test. Un enregistrement par-dessus celui de quelqu'un d'autre est signalé, pas imposé.

![Une exécution en échec, dessinée telle qu'elle s'est déroulée](/synced/cascade/docs/screenshots/run.png)

Une exécution est dessinée avec le résultat de chaque étape. Relancez-la depuis l'étape qui a échoué, depuis n'importe quelle étape, ou déboguez-la dans l'éditeur face aux modifications : les étapes avant celle que vous relancez conservent ce qu'elles ont fait, de sorte qu'une écriture déjà faite n'a pas lieu deux fois. Une personne peut laisser après coup un pouce levé ou baissé, une note et des étiquettes sur une exécution, et la liste des exécutions retrouve les exécutions grâce à eux.

![Les exécutions, avec ce que les gens en ont dit](/synced/cascade/docs/screenshots/executions.png)
![Les analyses des sept derniers jours](/synced/cascade/docs/screenshots/insights.png)
![Rôles](/synced/cascade/docs/screenshots/roles.png)
![Politiques de masquage](/synced/cascade/docs/screenshots/redaction.png)

Le reste du travail de gouvernance se trouve dans Paramètres : les rôles et qui les détient, les politiques de masquage (un flux de travail en choisit une dans ses paramètres, depuis l'éditeur), les fournisseurs de secrets externes, l'envoi des journaux, ainsi que la connexion et SCIM. Un propriétaire ou un administrateur modifie ces éléments ; tous les autres lisent ce qu'ils ont le droit de lire, ne se voient jamais proposer un bouton que le serveur refusera, et le serveur le refuse quand même.

Quatre écrans se trouvent à côté des flux de travail. Les identifiants se créent, s'ouvrent, se modifient, se partagent avec d'autres projets et se suppriment dans leur propre projet ; un champ secret se saisit une seule fois et l'écran dit seulement qu'il est défini. Projets indique qui est dans chacun et avec quel rôle, ainsi que les clés de compte de service avec lesquelles une intégration permanente se connecte. Votre compte (l'adresse dans la barre du haut) crée et révoque vos clés d'API, avec lesquelles l'API REST et le serveur MCP se connectent, et change votre mot de passe. Pour les propriétaires et les administrateurs, Paramètres propose les réglages généraux (second facteur, flux de travail d'erreur), Utilisateurs crée des personnes et les désactive, et le journal d'audit s'y lit, s'y filtre et s'y contrôle contre toute altération. La connexion est le même éditeur, à `/login`, et garde l'authentification unique, la connexion par annuaire, les passkeys et les codes de récupération.

![Identifiants, le secret n'étant jamais affiché](/synced/cascade/docs/screenshots/credentials.png)
![Projets, et qui en fait partie](/synced/cascade/docs/screenshots/projects.png)
![Le journal d'audit, et le contrôle de son intégrité](/synced/cascade/docs/screenshots/audit.png)
![Votre compte et ses clés d'API](/synced/cascade/docs/screenshots/account.png)

Ce que cela change pour vous : tout ce que Cascade sait faire, vous pouvez le faire depuis cet écran, sur une machine d'usine sans internet, sans une ligne de curl.

L'éditeur parle la langue de la personne qui l'utilise. Le sélecteur de la barre du haut (et de la page de connexion) liste chaque langue sous son propre nom, retient le choix dans ce navigateur et démarre dans la langue de votre navigateur la première fois. Les titres des étapes et leur aide, les types d'identifiants, les boutons, les refus envoyés par le serveur, les dates, les nombres et les durées sortent tous dans la langue choisie, et l'arabe s'écrit de droite à gauche, le canevas du flux de travail restant dessiné de gauche à droite comme pour tout le monde. Une langue n'est proposée que lorsque chacun de ses mots est là : `web/src/i18n/check.mjs` fait échouer la compilation quand il lui manque une ligne, un paramètre substituable ou une forme plurielle, et `web/scripts/i18n-scan.mjs` la fait échouer sur du texte saisi directement dans un écran. Les mots vivent dans `web/src/i18n/locales/<language>/`, et un test Go vérifie contre eux tout type d'étape ou refus que le serveur gagne. La sortie propre à une exécution, et tout ce que dit un programme appelé par une étape, s'affichent tels qu'ils ont été enregistrés.

Ce que cela change pour vous : vos opérateurs lisent l'écran dans leur propre langue, et un nouvel écran ne peut pas sortir avec une ligne d'anglais que personne n'a traduite.
