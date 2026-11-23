---
title: "Notes de version: HotLoop core 4.23.2"
description: "Ce qu'apporte HotLoop core 4.23.2, ce qui change à la mise à jour et ce qu'il faut lire avant de toucher une usine en production."
sidebar:
  label: "4.23.2"
---

Un écran CODESYS arrive maintenant comme un écran HotLoop, le boîtier remonte sa propre santé au tableau de bord EmberNet et un compteur d'énergie peut porter une prime de puissance. C'est aussi un balayage des échecs de nœud lent de la suite de tests, chacun une attente ou une course réelle corrigée. Construite pour amd64 seulement ; la construction multi-architecture suit comme version suivante.

## Ce qui a changé

- **Une visualisation CODESYS s'importe comme un écran.** Exportez-la depuis l'IDE (Project, Export, le fichier natif `.export`, pas PLCopenXML), et l'Import de l'écran Dashboards la lit comme un écran HotLoop sur les variables de l'automate. Chaque tag que l'écran lit et que cette installation n'a pas est listé, avec une correspondance d'équipements, et chaque élément que HotLoop n'a pas pu placer est listé avec la raison avant d'enregistrer quoi que ce soit. Un bouton ou une consigne sur un tag non inscriptible est refusé, comme pour une construction. Voir [Import a CODESYS screen](/fr/iot/codesys-screen-import/).
- **Santé du boîtier pour le tableau de bord EmberNet.** Un équipement nommé d'après le nœud Kubernetes publie l'usage CPU, mémoire, disque et volume de données du boîtier, et le jitter temps réel de trois cœurs quand un agent écrit le fichier pour lui. Les valeurs impossibles à lire sont de mauvaise qualité avec la raison, jamais zéro. Le serveur OPC UA sert leur historique. Voir [le serveur OPC UA](/fr/edge/opc-ua-server/#santé-de-la-machine-pour-le-tableau-de-bord-embernet) et [Protocoles et pilotes](/fr/iot/protocols/#santé-de-la-machine).
- **Une connexion qui peut lire et rien d'autre.** Un déploiement peut créer un compte avec exactement `tags.read` et `values.read` (`HOTLOOP_READER_USER` et `HOTLOOP_READER_PASSWORD_HASH`). Le chart crée `embernet-dashboard-read` à la première installation, garde son mot de passe dans le Secret `<release>-opcua-dashboard` et ne le fait jamais tourner lors d'une mise à jour.
- **Le certificat du tableau de bord est approuvé depuis un Secret.** Le chart monte `<release>-opcua-trust` (facultatif) et le serveur OPC UA tient son dossier de confiance à jour : un nouveau certificat est ajouté en 30 secondes, celui qui quitte le Secret est retiré, et un fichier qu'un opérateur a placé à la main n'est jamais touché. Le serveur n'accepte toujours que Basic256Sha256 SignAndEncrypt, pas de sessions anonymes, pas de confiance en tout. Le Service de la version liste maintenant le port 4840 quand le serveur est activé.
- **Énergie : une prime de puissance et des équipes.** Un compteur en Wh, kWh ou MWh accepte un `demand_price`, ce que coûte un kilowatt de son quart d'heure le plus élevé dans une fenêtre, et le résumé montre le pic, quand il a commencé et quelle part de ce quart d'heure a été lue. Une équipe est une fenêtre, `shift:06:00-14:00` pour la dernière commencée et `last_shift:06:00-14:00` pour la précédente. L'écran Energy a une case Shift et un prix de puissance, dans les treize langues.
- **Un coût par unité produite ne se lit plus comme gratuit.** Quand des choses ont été produites et qu'aucun compteur avec prix n'a encore compté de consommation, la réponse est aucune, avec la raison `nothing_counted`, et non zéro.
- **Les runtimes CODESYS en test, mis par écrit.** Le serveur OPC UA d'un vrai runtime est sécurisé avec les commandes shell de l'automate que documente CODESYS, et une lecture Basic256Sha256 SignAndEncrypt est prouvée contre lui. Une vraie alarme se déclenche, est acquittée et s'efface d'après ce que rapporte un automate en marche. Ce que fait un équipement quand la fenêtre de démonstration de deux heures d'un runtime sans licence se termine est consigné, avec le script de chronologie. Ce sont des tests et des notes dans [Protocoles et pilotes](/fr/iot/protocols/) ; le pilote n'a pas changé.
- **Correctifs trouvés par la suite.** Le moteur d'énergie ne lit plus un compteur pendant qu'il est supprimé ou modifié (la base de données cassait l'interblocage en faisant échouer la suppression). Le manifeste d'une sauvegarde est écrit sous un nom temporaire puis renommé en place, si bien qu'un listage ne voit jamais un demi-fichier. Le rattrapage de l'historian attend d'avoir tout écrit jusqu'à un repère. Le reste, ce sont des tests qui attendent maintenant ce qu'ils affirment, sur un nœud chargé, au lieu d'un nombre fixe de secondes.

## La santé du boîtier est active par défaut

Le chart monte la racine de l'hôte sur `/host` et son `/proc` sur `/host/proc`, tous deux en lecture seule, et n'ajoute aucun privilège : seuls un statfs et les compteurs de CPU et de mémoire sont lus. Un cluster qui applique le profil restricted de Pod Security refuse un hostPath. Dans ce cas, définissez `opcuaServer.dashboard.boxHealth.enabled: false` (ni équipement ni montages) ou `hostMount: false` (l'équipement, avec le disque et le CPU du boîtier lus comme mauvais et disant quoi monter). Le drop-in Quadlet est `deploy/quadlet/opcua-dashboard.conf`.

## Migrations

Une, et elle ne fait qu'ajouter : `0030_energy_demand` (une colonne `demand_price` sur les compteurs et sur leurs tranches, à 0 par défaut, si bien que rien de déjà compté ou tarifé ne change). Une sauvegarde faite en 4.23.1 se restaure ici, et une sauvegarde faite ici ne se restaure pas sur une version plus ancienne.

## Changements de l'API

`demand_price` dans le tarif d'un compteur d'énergie, un bloc `demand` dans une ligne de résumé, `shift:` et `last_shift:` comme période d'énergie, et `reason` sur `cost_per_unit` quand il est null. `POST /api/dashboards/import` accepte `codesys` et `visualization` à la place de `file`, et son rapport porte une `conversion`. Voir [l'API HTTP](/fr/iot/api/).

## Mise à jour depuis la 4.23.1

Un `helm upgrade` simple. La migration s'exécute au premier démarrage. Le chart crée le compte en lecture seule et son Secret à la première installation de cette version et ne le fait jamais tourner ; rien de ce qui est déjà sur le boîtier ne change.

## Ce qui n'est pas éprouvé

- Les éléments qu'il ne connaît pas sont listés et laissés de côté, jamais devinés, et un écran d'un autre projet peut en lister davantage.
- Les tags de jitter temps réel demandent un agent qui écrit le fichier, et cette version n'en installe aucun.
- La connexion en lecture seule et la confiance du certificat ont été démontrées avec le client propre de HotLoop. Le côté du tableau de bord EmberNet est sa propre version.
- Le point d'accès sécurisé CODESYS a été éprouvé en test sur une version de runtime. Le pilote de HotLoop n'a pas changé pour cela, et aucun écran de configuration du point d'accès sécurisé ne fait partie de cette version.
- Les tarifs de puissance ont été vérifiés sur des relevés enregistrés, pas sur la facture d'un fournisseur.
