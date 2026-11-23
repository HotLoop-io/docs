---
title: "Vue d'ensemble de HotLoop Edge Relay"
description: "Un nœud de périphérie Sparkplug B sans interface. Il lit avec les pilotes de la Gateway, retransmet et met sur disque si la liaison tombe. Sans base ni UI."
sidebar:
  label: "Vue d'ensemble"
---

L'Edge Relay est celui qui n'a pas d'interface. Il se pose sur un Pi ou un petit PC industriel à côté des machines, les interroge avec les mêmes pilotes que la Gateway et retransmet chaque lecture en Sparkplug B vers une Gateway, quelque part, dotée d'une vraie base de données. Quand la liaison montante tombe, il met en file sur disque et rejoue au retour de la liaison, si bien que l'historien en amont reçoit la coupure comblée, et non un trou, tant que la coupure tient dans la file, plafonnée à 64 MiB par défaut. Pas de base de données, pas d'interface web, pas d'utilisateurs, pas de chemin d'écriture, et chacune de ces pièces manquantes est une chose qui ne peut pas tomber en panne à 3 h du matin.

La version actuelle est la {{hotloop}} : `ghcr.io/hotloop-io/hotloop-edge-relay:{{hotloop}}`, construite pour amd64, arm64 et arm/v7 (un Pi 3 ou une installation Pi OS 32 bits est exactement le boîtier où finit un relay), d'environ 15 Mo, téléchargeable sans connexion, et le chart `hotloop-edge-relay` depuis `https://hotloop.io/hotloop`. La 4.16.0 est la première version à l'avoir publié, et arm/v7 est arrivé avec la 4.18.10. Il partage son numéro de version avec la Gateway, et une version refuse de sortir si les deux charts ne portent pas la version du tag et si l'unité Quadlet ne suit pas `:stable`. Le relay reçoit donc une nouvelle version à chaque publication, que son code ait changé ou non. Un seul numéro de version à demander, et un chart de relay ne peut jamais pointer vers une image que personne n'a publiée. [Installez-le](/fr/edge-relay/install/).

Vous mettez à niveau un relay ? [Passer de la 4.17.0](/fr/gateway/upgrading/#ledge-relay-et-quadlet) et [passer de la 4.16.0](/fr/gateway/upgrading/#ledge-relay) ont la partie du relay.

## Ce qu'il n'est pas

**Pas une Gateway plus petite avec les options désactivées.** C'est un autre binaire. Il ne lie jamais la base de données, l'interface web et son authentification, le moteur d'automatisation, le registre des entités ni MCP, et un test demande à `go list -deps` ce que le binaire lie réellement et échoue si l'un d'eux s'y glisse par un paquet partagé. Il n'y a pas de mode relay caché dans la Gateway, car un mode est un interrupteur, et un interrupteur peut être basculé par une mauvaise variable d'environnement sur un boîtier que personne ne surveille. Un paquet qui n'a jamais été lié ne peut pas être activé.

**Incapable d'accepter une écriture, de servir un écran ou de répondre à un agent.** Les trois exigent une personne connectée à qui attribuer l'action, et ceci n'a aucun utilisateur. Il lit et il retransmet, et c'est tout son travail.

**Pas ouvert à la configuration depuis le réseau.** Les appareils et les tags viennent d'un seul fichier JSON sur le boîtier. La seule autre voie d'entrée est un fichier d'appareils poussé depuis la Gateway par la connexion au broker que le relay ouvre déjà vers l'extérieur, et celle-ci s'applique à chaud. Le relay n'écoute jamais une nouvelle configuration.

## Ce qu'il fait

- **Il interroge** avec le moteur même de la Gateway : les mêmes workers, la même reconnexion avec temporisation, et les mêmes pilotes pour OPC UA, Modbus, MQTT et Sparkplug B, EtherNet/IP, S7comm, MTConnect et HTTP. Depuis la 4.18.10, il peut aussi écouter les brokers MQTT que vous nommez dans le fichier d'appareils et lire ce qui s'y annonce (ESPHome, Zigbee2MQTT, Tasmota, Shelly), et rien de ce qu'il découvre ne peut être armé, car un relay n'a aucun chemin d'écriture. Depuis la 4.17.0, il peut aussi interroger une console UniFi, en lecture seule : les tags que déclare son fichier d'appareils et, pour le travail sur les clients, seulement le nombre de clients par réseau, sans surveillance OT. Un bogue de pilote corrigé dans la Gateway est corrigé ici.
- **Il retransmet** en nœud de périphérie Sparkplug B : naissances, numéros de séquence et morts comme le dit la spécification. Une reconnexion annonce le nœud une fois, pas deux.
- **Il survit à la chute de la liaison.** Les lectures sont mises en file dans un seul fichier sur disque. Quand le broker revient, la file se vide avant qu'aucune lecture en direct ne parte, la plus ancienne en premier, chacune marquée `is_historical` pour que l'hôte en amont ne prenne pas un rejeu pour la valeur courante du tag. La livraison est au moins une fois, donc ce qui la consomme doit tolérer un doublon après un plantage au milieu d'un rejeu. La file est plafonnée à 64 MiB par défaut, et au-delà les lectures les plus anciennes sont abandonnées et comptées. Cela fait environ 248 000 lectures, environ deux minutes à 2 000 lectures par seconde, alors dimensionnez-la d'après votre propre débit, environ 240 octets par lecture avec des noms de tags courts (mesuré sur la même file dans Edge 4.21.1). Mettez `0` et elle est illimitée, et une coupure assez longue remplit le volume. [Installation](/fr/edge-relay/install/) dit comment la régler.
- **Il répond sur deux points d'accès en lecture seule** sur le port 8081 : `/healthz` (le processus est en vie) et `/status` (nombre d'appareils par état de connexion, nombre de tags, profondeur de la file, protocoles compilés, état de connexion au broker, sa version, le digest de l'image et le mode de mise à jour, et quel fichier d'appareils tourne et lequel a été refusé). Pas de valeurs de tags, pas d'adresses, pas de configuration. Les deux sont sans authentification à dessein : il n'y a pas de base d'utilisateurs où accrocher une connexion, et un jeton partagé n'ajouterait aucune vraie protection. Gardez-les derrière le même périmètre que le boîtier.
- **Il prend ses ordres d'une Gateway.** Enregistrez un relay dans la gestion de parc de la Gateway (API seulement, il n'y a pas d'écran Parc) et la Gateway le suit par ses naissances et ses morts, et peut lui envoyer un rebirth, un redémarrage, un nouveau fichier d'appareils ou l'approbation d'une mise à jour qu'elle retient. Un fichier d'appareils poussé s'applique à chaud, sans redémarrage. Un redémarrage est sa propre commande, car il coupe la session du relay avec le broker et chaque session d'appareil qu'il tient, et un boîtier qui tourne depuis des mois ne devrait pas faire cela pour prendre un changement de configuration.

## Qui peut lui donner des ordres

Rien sur le relay ne décide qui peut le redémarrer ou lui pousser un fichier d'appareils. C'est la Gateway qui vérifie, à son API : `fleet.rebirth` pour un rebirth, et `fleet.restart`, `fleet.update` et `fleet.config` pour un redémarrage, une approbation de mise à jour et une poussée, tous réservés aux administrateurs. Mais les commandes passent par le broker, donc tout ce qui peut publier sur le topic NCMD Sparkplug du relay ou sur `hotloop/edge-relay-config/#` peut faire exactement ce que fait la Gateway.

Verrouillez donc le broker. Son ACL ne doit laisser publier NCMD et le topic de configuration qu'aux identifiants de la Gateway elle-même. Et mettez TLS sur le broker avant de pousser un fichier d'appareils contenant des mots de passe : une poussée est publiée en retenu, et quiconque peut s'abonner à ce topic peut lire tous les identifiants du fichier.

## Jusqu'où il a été éprouvé

Edge Relay a été exécuté de bout en bout face à un vrai broker Mosquitto, avec une lecture traversant tout le binaire et arrivant à un abonné MQTT ordinaire sous forme d'un NDATA Sparkplug B à la valeur correcte. Les commandes de parc et la poussée de configuration, y compris une poussée retenue avant même le démarrage du relay, ont été exécutées face à un vrai broker, et l'application à chaud a été exécutée face à de vrais appareils Modbus TCP et OPC UA : une poussée ajoute un appareil, en retire un, en modifie un autre et en laisse un quatrième tranquille, sans NDEATH et sans session coupée sur celui qui n'a pas changé. Un changement appliqué pendant que le broker est coupé et que les lectures s'accumulent vide ensuite toute la file.

Les mises à jour ont aussi été exécutées : le retour arrière de l'unité Quadlet et la retenue optionnelle, avec une vraie mise à jour retenue pendant que le relay tournait sans être touché, puis acceptée sur approbation. Sous Podman 4.9, l'unité doit dire `--sdnotify=healthy` elle-même, sans quoi une mise à jour morte est rapportée comme réussie, et elle le dit.

Ce binaire a été exécuté sur machine physique (2026-11-17). Ses pilotes OPC UA, Modbus, EtherNet/IP et S7comm sont le même code que celui de la Gateway.

Vous l'utilisez dans une usine ? [Utiliser HotLoop en entreprise](/fr/business/) couvre la licence et la façon de nous joindre.

## Licence

L'Edge Relay est sous le HotLoop Source License Agreement 1.0, comme tout produit HotLoop. Il est gratuit et à code source disponible, pas open source au sens de l'OSI, et chaque version passe sous AGPL-3.0 ou ultérieure quatre ans après sa publication. L'usage domestique et en laboratoire est gratuit, tout comme celui des écoles, des organisations à but non lucratif et des administrations pour leur propre activité. [La page de licence](/fr/license/) contient le texte.
