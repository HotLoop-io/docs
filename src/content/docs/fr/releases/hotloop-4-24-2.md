---
title: "Notes de version: HotLoop core 4.24.2"
description: "Ce qu'apporte HotLoop core 4.24.2, ce qui change à la mise à jour et ce qu'il faut lire avant de toucher une usine en production."
sidebar:
  label: "4.24.2"
---

HotLoop lit et pilote directement les appareils Shelly de toutes les générations, trouve les caméras ONVIF et sert leurs flux, leurs instantanés et le panoramique, l'inclinaison et le zoom, dialogue avec les Arduino par Firmata, et envoie un mot de passe OPC UA de n'importe quelle longueur comme le demande la spécification. Une liaison lente ne retient plus un nœud en périphérie sur son disque, et `--version` nomme le commit dont une image est issue. Une installation par défaut de HotLoop Edge démarre. Compilée pour amd64 uniquement; la compilation multi-architecture suit comme prochaine version.

## Ce qui a changé

- **Shelly, toutes générations.** Les Gen2 et suivantes par RPC avec un websocket en direct, si bien qu'un changement et un appui sur un bouton arrivent à l'instant où ils se produisent, et les Gen1 par leur propre interface HTTP. Un appui sur un bouton est consigné dans le journal sous l'appareil. Voir SHELLY.md.
- **Caméras ONVIF.** Trouvez les caméras sur le réseau (WS-Discovery), lisez les informations de chaque appareil, l'adresse du flux et de l'instantané de chaque profil média (Media et Media2), le panoramique, l'inclinaison et le zoom, ainsi que les événements propres à la caméra sous forme de tags et de lignes du journal. L'image actuelle d'un profil est à une route de distance. Voir ONVIF.md.
- **Arduino par Firmata.** USB série ou TCP, avec des broches numériques et analogiques, du PWM, des servos et des appareils I2C comme tags. Voir FIRMATA.md.
- **Des mots de passe OPC UA de n'importe quelle longueur.** Les mots de passe de plus de 64 octets passent désormais par OPC UA comme le demande la spécification (RsaEncryptedSecret, partie 4, 7.40.4), du client vers le serveur, et les serveurs plus anciens acceptent toujours la connexion. Éprouvé face à la pile propre de l'OPC Foundation. Voir [le serveur OPC UA](/fr/edge/opc-ua-server/).
- **Une liaison lente ne fixe plus le nœud sur son disque.** La passe qui prend la fin du disque envoie désormais depuis la mémoire ce qui arrive derrière elle, de sorte qu'une file d'envoi derrière une liaison lente se vide et que le nœud quitte le disque au lieu de faire un fsync à chaque interrogation.
- **`--version` nomme le commit.** Chaque image indique le commit dont elle est issue, en plus de sa version.
- **Un écran CODESYS à côté de son WebVisu.** L'import d'une visualisation CODESYS est exécuté face à un vrai WebVisu, piloté par les mêmes variables d'automate, et les deux sont comparés dans un navigateur.
- **La ligne de la feuille de route docs/legacy est cochée.**
- **Une installation par défaut de HotLoop Edge démarre.** Le pod ne lit plus le jeton Gotify, l'URL du webhook Discord ni le jeton du bot Discord dans un Secret qui n'existe pas : chacun n'est envoyé que lorsque son identifiant est renseigné, et la vérification du chart échoue pour toute référence à ce Secret que le rendu ne crée pas. Un chart avec une destination renseignée, ou un Secret existant nommé, se rend comme avant.
- **Le laboratoire Ignition, dans les deux sens.** La preuve de HotLoop avec Ignition fonctionne maintenant aussi dans l'autre sens, une preuve d'UADP multicast à travers un routeur s'y ajoute, et le plus gros rapport est mesuré. Voir [Rapports planifiés](/fr/gateway/reports/).
- **Les tests attendent ce qu'ils attendent.** Le préchauffage de l'application du téléphone attend une page connectée, et le formulaire d'énergie remplit ses champs en une seule fois.

## Migrations

Aucun.

## Changements de l'API

Deux routes, toutes deux nouvelles. `POST /api/onvif/discover` (`devices.write`) sonde le réseau à la recherche de caméras ONVIF et n'ajoute rien. `GET /api/onvif/{id}/profiles/{profile}/snapshot` (`devices.read`) renvoie le JPEG actuel d'un profil de caméra. Aucune route existante n'a changé. Voir [l'API HTTP](/fr/iot/api/).

## Mise à jour depuis la 4.24.0

Un `helm upgrade` simple. Pas de migration et pas de nouveau secret.

## Ce qui n'est pas éprouvé

- Shelly, ONVIF et Firmata ont été exécutés face à des enregistrements d'appareils réels, à la pile générée d'ONVIF lui-même et au StandardFirmata du projet Arduino sur un Uno simulé. Aucun Shelly, aucune caméra ni aucun Arduino physique n'est encore passé sur le banc.
- La comparaison côte à côte avec WebVisu s'exécute en test face à un runtime CODESYS Control for Linux SL 4.22.0.0.
