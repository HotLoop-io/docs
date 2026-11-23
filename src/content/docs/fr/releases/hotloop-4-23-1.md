---
title: "Notes de version: HotLoop core 4.23.1"
description: "Ce qu'apporte HotLoop core 4.23.1, ce qui change à la mise à jour et ce qu'il faut lire avant de toucher une usine en production."
sidebar:
  label: "4.23.1"
---

Cette version porte tout ce que listent les notes de la 4.23.0. Météo et énergie, l'interface web dans treize langues de plus, des écrans qui passent d'une installation à l'autre sous forme de fichiers, et les premières commandes vers une console UniFi. Construite pour amd64 seulement ; la construction multi-architecture suit comme version suivante.

## Ce qui a changé

- **Une station météo est une seule entité.** Elle est construite à partir des tags qu'une station de toit publie déjà (température, humidité, pression, vent, pluie, solaire), avec le point de rosée, l'indice de chaleur et le refroidissement éolien calculés sur le boîtier. Un capteur que la station n'a pas reçu n'a pas de ligne, et un capteur qui a cessé de répondre se lit Unavailable, jamais zéro. Aucun service cloud n'est appelé. Voir [Weather](/fr/iot/weather/).
- **Compteurs d'énergie.** Un compteur est un tag lu comme une quantité consommée (un compteur cumulatif comme les kWh, le gaz, l'eau ou l'air, ou une puissance). Ce qui a été consommé est conservé par tranches de 15 minutes, si bien qu'un redémarrage ne perd rien et qu'une équipe, un jour ou un mois est une somme. Un tarif donne un coût à chaque tranche quand elle est créée, si bien qu'un prix modifié plus tard ne change pas ce qu'a coûté le mois dernier, et le coût d'une unité produite se calcule à partir d'un compteur de production. Il y a un écran Energy, l'API et des outils MCP. Voir [Energy](/fr/iot/energy/).
- **L'interface web arrive dans treize langues de plus** à côté de l'anglais : espagnol, français, italien, allemand, norvégien, bulgare, grec, coréen, japonais, vietnamien, hindi, chinois simplifié et arabe, disposé de droite à gauche. Choisissez-en une dans la barre du haut ou sur la carte de connexion. Voir [Languages](/fr/iot/languages/).
- **Un tableau de bord s'exporte vers un fichier et s'importe dans une autre installation.** Les écrans d'un client sont à lui et ne font jamais partie du produit : le fichier liste chaque tag, équipement, script et recette qu'il nomme, et un import signale tous les problèmes d'un coup, avec une correspondance pour les noms qui diffèrent, avant d'enregistrer quoi que ce soit. Export et Import sont des boutons de l'écran Dashboards, et `screen_export` et `screen_import` sont des outils MCP. Voir [Screen files](/fr/iot/screen-file/).
- **Des lectures MCP qui accompagnent ses écritures**, les essais à blanc des éditeurs et l'import d'alarmes CODESYS.
- **Les premières commandes vers une console UniFi.** Cinq types de point peuvent être commandés, chacun en lecture seule jusqu'à ce qu'une personne arme ce tag, par la porte d'écriture comme n'importe quel tag : la LED de localisation d'un équipement, le redémarrage d'un équipement, le cycle d'alimentation PoE d'un port de switch, un réseau sans fil activé ou désactivé, un client surveillé bloqué ou réadmis, et le mode PoE d'un port. Un cycle d'alimentation est soumis à un délai de 15 minutes conservé dans la base de données, si bien qu'un redémarrage ne l'oublie pas, et un port qui porte le réseau (un uplink, un switch, un gateway, une sauvegarde 5G, un pair que la console ne liste pas) n'est jamais cyclé. Le compte de la console avec lequel HotLoop se connecte doit être Administrator local pour cela ; un compte View Only est refusé par la console et HotLoop le dit. Un blueprint intégré cycle une fois le port d'un équipement silencieux puis déclenche une alarme. Voir [UniFi Network](/fr/iot/unifi/).
- **Le serveur OPC UA répond à HistoryRead** à partir de l'historique que garde le Gateway, brut et traité.
- **Trames delta OPC UA PubSub, en option.** `HOTLOOP_UADP_PUBLISH_DELTA_FRAMES=true` n'envoie que les champs qui ont changé entre les trames key. Désactivé par défaut.
- **Une carte d'image sur une page de panneau s'ajuste à sa carte** et ne fixe plus la hauteur de la ligne.
- **L'unité de mise à jour de la base de données d'une installation Quadlet se saute elle-même** quand le volume n'a rien à mettre à jour, parce que Podman 5.7 ne démarre pas un conteneur sans rien à exécuter, et le nom de la base de données fournie est ajusté aux 52 caractères qu'un StatefulSet peut avoir.
- **Les charts conservent leur Secret d'identifiants à la désinstallation**, comme le volume de la base : une réinstallation du même nom générait un nouveau mot de passe que la base conservée refusait. Pour repartir de zéro, supprimez le Secret à la main avec le volume.
- **La sortie Kafka attend** le broker pour un topic créé à l'instant aussi longtemps que sa connexion le permet, et les chiffres documentés de file de panne de l'Edge Relay sont ceux mesurés (environ deux minutes à 2,000 mesures par seconde).
- Correctifs trouvés par la suite de tests : les utilisateurs de test OPC UA sont hachés au coût le plus bas de bcrypt, si bien qu'une connexion dans la suite ne dépasse plus ce que le client de test attend sur un runner lent (le serveur et sa connexion ne changent pas), le flux en direct oublie ce qu'il a envoyé dès que sa dernière page part, le serveur OPC UA dit quand son listener tient le port, et plusieurs tests ne dorment plus pour des choses qui arrivent à leur propre rythme.

## Migrations

Deux, chacune ne fait qu'ajouter : `0028_unifi_port_cycles` (quand chaque port de switch a eu son dernier cycle d'alimentation) et `0029_energy` (trois tables pour les compteurs et leurs tranches). Les deux sont dans les sauvegardes. Une sauvegarde faite en 4.22.1 se restaure ici, et une sauvegarde faite ici ne se restaure pas sur une version plus ancienne.

## Changements de l'API

Nouvelles routes : `GET /api/energy/meters`, `POST /api/energy/meters`, `GET`, `PUT` et `DELETE /api/energy/meters/{id}`, `GET /api/energy/summary` et `/api/energy/summary/{period}`, `GET /api/energy/series` et `/api/energy/series/{meter}/{period}/{step}`, `GET /api/dashboards/{id}/export`, `POST /api/dashboards/import` et `GET /api/entities/composites`. Deux nouvelles permissions : `energy.read`, que tout rôle possède, et `energy.write`, que possède un administrateur. De nouveaux outils MCP pour chacune. Une station météo est un nouveau domaine d'entité, `weather`. Voir [l'API HTTP](/fr/iot/api/).

## Mise à jour depuis la 4.22.1

Un `helm upgrade` simple. Les migrations s'exécutent au premier démarrage et ajoutent des tables ; aucun nouveau secret. Rien de ce qui était désactivé n'est activé.

## Ce qui n'est pas éprouvé

- Les autres commandes n'ont pas été exécutées contre une vraie console.
- La météo et l'énergie ont été exécutées contre des enregistrements, un banc Modbus et les compteurs simulés d'Emberburn, pas contre une vraie station de toit ni les compteurs d'une usine.
- Les treize nouveaux catalogues de langues ont été écrits à partir du glossaire partagé et aucun locuteur natif ne les a relus.
