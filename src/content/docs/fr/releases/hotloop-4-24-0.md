---
title: "Notes de version: HotLoop core 4.24.0"
description: "Ce qu'apporte HotLoop core 4.24.0, ce qui change à la mise à jour et ce qu'il faut lire avant de toucher une usine en production."
sidebar:
  label: "4.24.0"
---

Les écrans HotLoop sont des P&ID. Les propres alarmes d'un automate CODESYS apparaissent dans la liste d'alarmes de HotLoop et un acquittement revient vers l'automate, une exécution de script se termine toujours, le volume de données d'un boîtier se lit toujours, et les lignes de la feuille de route UniFi Protect, Access et alimentation sont livrées. Construite pour amd64 seulement ; la construction multi-architecture suit comme version suivante.

## Ce qui a changé

- **Les écrans sont des P&ID.** Déposez réservoirs, pompes, vannes, échangeurs de chaleur, filtres, instruments et jonctions sur une page de symboles, puis glissez d'un point de connexion à un autre : la tuyauterie se trace toute seule à angle droit autour de tout ce qui est sur la page, se dérive avec une jonction là où vous la déposez sur une autre conduite, et se retrace pendant que vous déplacez un symbole. Chaque conduite porte son fluide (eau, vapeur, carburant, air, énergie, signal et autres, chacun avec une couleur, un code et un motif de ligne, si bien que la couleur n'est jamais le seul porteur) et bouge avec son tag ou une règle. Chaque page de symboles reçoit une barre d'outils pour zoomer, se déplacer, afficher une mini-carte et passer à la vue grise haute performance, et un P&ID s'enregistre, s'exporte et s'importe dans le même fichier d'écran. Voir [Tableaux de bord](/fr/iot/dashboards/) et [Screen files](/fr/iot/screen-file/).
- **Les propres alarmes d'un automate CODESYS apparaissent dans la liste d'alarmes de HotLoop.** L'Alarm Configuration d'un projet garde des groupes et des classes d'alarmes, et des alarmes qui surveillent une variable. Un équipement CODESYS lit maintenant celles que détient le gestionnaire d'alarmes de son automate (actives, en attente d'acquittement, acquittées alors que la condition tient encore), et un acquittement fait dans HotLoop revient vers l'automate. Un automate qui n'en a aucune à donner est laissé tranquille. Il faut la bibliothèque HotLoop Alarms et un bloc dans le projet. Voir CODESYS-ALARMS.md.
- **Le volume de données du boîtier se lit toujours.** Un boîtier sans rien de monté sous `/data` n'a pas de `/data`, et le tag `data_util_pct` de santé du boîtier se lisait mauvais avec « no such file or directory ». Il lit maintenant le volume sur lequel le dossier de données sera créé. Voir [Protocoles et pilotes](/fr/iot/protocols/#santé-de-la-machine).
- **Une exécution de script se termine toujours.** Quand la base de données refusait l'écriture de la fin d'une exécution de script, HotLoop le journalisait et abandonnait, si bien que l'exécution se lisait « running » pendant toute la vie du processus alors que sa place était libre depuis longtemps. L'écriture est maintenant redemandée, jusqu'à cinq fois avec une courte attente entre chaque.
- **UniFi Protect, Access et les prises de PDU SmartPower sont livrés dans la feuille de route.** Ils sont arrivés comme équipements en 4.23.6, construits d'après les API publiées, chaque chemin de Protect correspondant au document 7.4.102. Voir [la feuille de route de HotLoop](/fr/roadmap/).
- **Un écran TwinCAT est éprouvé dans un navigateur.** L'exemple TwinCAT PackML est importé avec ses cadres, rendu, et un voyant suit un registre en direct.
- **Les tests attendent ce qu'ils attendent.** L'attente du throttle de panneau est vérifiée comme de l'arithmétique, le minuteur de la retenue forSec est entre les mains du test et non en course contre une pause, le test de topics Apache Kafka supprime ses topics tout de suite et dispose du temps qu'il faut à un boîtier lent, et un test d'API ne borne plus une connexion par un seul échantillon, parce qu'un boîtier chargé répond quatre fois plus lentement qu'une seconde plus tôt.

## Migrations

Aucun.

## Changements de l'API

Aucun. Aucune route n'a changé. La configuration d'une page de symboles accepte `pipes`, `view` et le `rot` d'un symbole, et un fichier d'écran enregistré les porte.

## Mise à jour depuis la 4.23.6

Un `helm upgrade` simple. Pas de migration et pas de nouveau secret. Une page de symboles sans conduites est dessinée comme avant.

## Ce qui n'est pas éprouvé

- Le chemin d'alarmes de l'automate a été exécuté contre un vrai runtime CODESYS Control for Linux SL 4.22.0.0 avec le programme de laboratoire d'alarmes.
- Protect, Access et les prises de la PDU suivent les API publiées, et l'essai sur banc avec du vrai matériel suit au bureau.
