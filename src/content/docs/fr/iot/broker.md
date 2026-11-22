---
title: "Le broker MQTT intégré"
description: "Un broker dans le même processus, pour qu'une petite machine suffise à toute l'installation, avec ses listeners, ses comptes et les réglages qui l'activent."
---

HotLoop peut exécuter son propre broker MQTT dans le processus, depuis la 4.11.0, de sorte qu'une petite installation HotLoop sur une seule machine n'a rien de plus à déployer. Désactivé par défaut (`HOTLOOP_BROKER_ENABLED`) : un déploiement qui exécute déjà Mosquitto ou EMQX n'a rien vers quoi le pointer, et démarrer un second broker à côté d'un broker existant n'est pas une valeur par défaut sûre qu'on puisse se permettre de deviner.

## Pourquoi il existe

La publication edge (le Gateway agissant comme nœud edge Sparkplug) et la gestion de flotte (le suivi des edge relays enregistrés) se connectent toutes deux *vers l'extérieur* à un broker MQTT via `BrokerAddress`, et n'en ont jamais exécuté elles-mêmes. C'est très bien quand un déploiement a déjà un broker, qu'il s'agisse d'une instance Mosquitto existante ou d'une instance exécutée à côté de HotLoop pour d'autres raisons. Ce n'est pas acceptable comme *seule* option : ce projet existe pour réduire le nombre de pièces mobiles dont dépend une usine, et exiger une deuxième infrastructure rien que pour avoir un hub Sparkplug pour un Gateway reviendrait à réintroduire une pièce mobile par la petite porte.

Avec `HOTLOOP_BROKER_ENABLED=true`, ce même processus écoute les connexions MQTT sur sa propre adresse. La publication edge, la gestion de flotte ou le `HOTLOOP_EDGE_PUBLISH_BROKER` d'un edge relay externe peuvent tous être pointés vers `localhost:1883` (dans le cluster, l'adresse du Service du Gateway lui-même).

## Quand l'utiliser, et quand ne pas le faire

**Utilisez-le** pour un seul Gateway, une poignée d'edge relays et des volumes de trafic qu'un broker intégré, partageant un processus avec l'historien, le moteur d'alarmes et l'API HTTP, peut absorber confortablement, le cas courant que vise tout ce projet : une usine, une machine, une infrastructure minimale.

**Ne l'utilisez pas** comme substitut d'un broker de qualité production à grande échelle : plusieurs applications hôtes Sparkplug indépendantes, une diffusion très large, un pontage entre sites, ou des charges qui exigent du clustering, une montée en charge horizontale ou les outils d'exploitation propres à un broker (métriques détaillées, ACL dynamiques, écosystèmes de plugins) sont autant de vraies raisons d'exécuter Mosquitto, EMQX ou un autre broker dédié, et de pointer vers lui les `EdgePublishConfig`/`FleetConfig` du Gateway comme tout autre déploiement peut déjà le faire. Ce paquet ne concurrence pas ce cas d'usage ; il existe pour les déploiements qui n'auraient sinon aucun broker.

## Les connexions, et ce que chacune peut toucher

Trois sortes de connexions entrent, et elles ne sont pas égales.

**Les connexions créées dans HotLoop** (Settings, MQTT, ou `/api/broker/logins` dans [L'API HTTP](/fr/iot/api/)) portent des règles : les topics sur lesquels la connexion peut publier et ceux auxquels elle peut s'abonner. `%u` dans une règle est le nom de la connexion elle-même et `%p` le préfixe de découverte. Elles partent d'un profil et vous pouvez les modifier ensuite :

| Profil | Publier | S'abonner | Pour |
|---|---|---|---|
| `shelly` | `%u/#`, `shellies/announce` | `%u/#`, `shellies/command`, `%p/status` | un Shelly Gen2 ou plus récent, connexion nommée d'après le préfixe de son topic MQTT |
| `esphome` | `%u/#`, `%p/+/%u/+/config`, `esphome/discover/%u` | `%u/#`, `%p/status`, `esphome/discover` | un nœud ESPHome, connexion nommée d'après le nœud |
| `tasmota` | `tele/%u/#`, `stat/%u/#`, `tasmota/discovery/+/config`, `tasmota/discovery/+/sensors` | `cmnd/%u/#`, `cmnd/tasmotas/#` | un appareil Tasmota, connexion nommée d'après son topic |
| `zigbee2mqtt` | `%u/#`, `%p/#` | `%u/#`, `%p/status` | un pont Zigbee2MQTT, connexion nommée d'après son topic de base |
| `integration` | rien | `#` | un tableau de bord, un historien, vous avec MQTT Explorer |
| `full` | `#` | `#` | n'importe quoi, toute l'usine |

Nommez la connexion d'un Shelly d'après le préfixe de son topic et il peut s'annoncer et rendre compte en son nom, et rien de plus. Il ne peut pas publier sur `cmnd/boiler/POWER`, il ne peut pas annoncer un appareil au nom d'un autre et il ne peut pas s'abonner à `#` pour lire toute l'usine. Le broker vérifie chaque publication, chaque abonnement et chaque message sur son chemin vers un abonné, de sorte qu'une règle ne peut pas être étirée avec un joker astucieux. Un testament (last will) est lui aussi vérifié à la connexion du client : la bibliothèque du broker publie les testaments sans demander à personne, donc une connexion dont le testament vise un endroit où elle n'a pas le droit de publier n'entre pas. Sans cela, une prise bon marché pourrait laisser un `ON` retenu sur la chaudière et se débrancher elle-même.

Un changement sur une connexion s'applique dès le paquet suivant de ce client. Restreignez une connexion et son appareil connecté perd les topics sur-le-champ ; supprimez-en une et le client toujours accroché ne peut plus rien faire et ne peut plus se reconnecter. Les mots de passe sont des hachages bcrypt dans `broker_logins`, qui figure dans chaque sauvegarde ; l'API ne répond jamais avec l'un ni l'autre.

Zigbee2MQTT est un cas à part : un pont annonce tous les appareils de sa radio, donc son profil peut publier n'importe où sous le préfixe. C'est le rôle du pont, et c'est pourquoi l'écran Discovered montre qui a annoncé quoi.

**`HOTLOOP_BROKER_USERS`** est l'ancienne liste de paires `user:password` (seul le premier deux-points sépare, donc un mot de passe peut en contenir un). Celles-ci peuvent tout faire, sur tous les topics, exactement comme en 4.16 et 4.17. C'est voulu : personne ne met à jour vers une usine dont le trafic Sparkplug se heurte soudain à une ACL qu'il n'a jamais écrite. Cela signifie aussi que chacune de ces connexions est une clé de toute l'usine. Déplacez les appareils vers des connexions créées dans HotLoop et gardez celles des variables d'environnement pour ce qui a vraiment besoin de tout : la flotte, un edge relay, le publisher edge. Vérifiées en temps constant ; un nom d'utilisateur avec un mauvais mot de passe est refusé.

**Anonyme** (`HOTLOOP_BROKER_ALLOW_ANONYMOUS`, `false` par défaut) donne tout à quiconque peut atteindre le port. C'est un choix par déploiement pour un LAN de confiance ou un banc d'essai, jamais quelque chose que ce processus juge acceptable de lui-même, et l'écran Discovered l'indique en rouge tant qu'il est actif. Il n'assouplit rien pour un client qui envoie un nom d'utilisateur : un mauvais mot de passe reste un mauvais mot de passe.

Un broker sans `HOTLOOP_BROKER_USERS` et avec l'anonyme désactivé démarre sans problème. Tant que personne ne crée de connexion dans HotLoop, la seule chose qui puisse se connecter est HotLoop.

Les autres brokers sont leur propre affaire. Sur Mosquitto ou EMQX, les ACL sont à faire appliquer par ce broker, la même frontière que trace [la gestion de flotte](/fr/gateway/fleet/), et [la découverte MQTT](/fr/iot/mqtt-discovery/) y donne une ACL pour la connexion propre de HotLoop.

## La découverte, et la connexion propre de HotLoop

Avec le broker activé, HotLoop y écoute les appareils qui s'annoncent (voir [la découverte MQTT](/fr/iot/mqtt-discovery/)). Le broker note quelle connexion et quel client ont publié chaque configuration de découverte. L'écran Discovered l'affiche, et un appareil accepté depuis une connexion puis annoncé par une autre est retenu pour une personne, avec un avertissement dans le journal ("Kitchen re-announced by login garage-node; it was accepted from kitchen-node"). Soit quelqu'un a déplacé l'appareil vers une nouvelle connexion, soit une connexion se fait passer pour un appareil qu'elle n'est pas. Une personne tranche.

Le client propre de HotLoop sur ce broker (le listener de découverte et les pilotes des appareils découverts) se connecte avec une connexion que le broker crée à chaque démarrage et ne conserve qu'en mémoire. Elle peut tout faire. Il n'y a rien à configurer pour elle, rien sur le disque et rien dans une sauvegarde ; c'est une autre après chaque redémarrage.

## TLS

Un listener TCP en clair (`HOTLOOP_BROKER_LISTEN_ADDR`, `:1883` par défaut) est toujours disponible dès que le broker est activé. Définir `HOTLOOP_BROKER_TLS_ENABLED=true` avec `HOTLOOP_BROKER_TLS_CERT_FILE` et `HOTLOOP_BROKER_TLS_KEY_FILE` ajoute un second listener indépendant (`HOTLOOP_BROKER_TLS_LISTEN_ADDR`, `:8883` par défaut) terminé avec ce certificat. Les deux listeners fonctionnent en même temps quand TLS est activé, rien ne ferme celui en clair, donc un opérateur qui veut une accessibilité TLS uniquement l'impose au niveau du réseau (une NetworkPolicy, une règle de pare-feu), comme ce chart laisse déjà les décisions d'exposition réseau plus larges à `networkPolicy.ingress` plutôt que de laisser l'application décider seule lesquels de ses ports peuvent être atteints.

Contrairement à la montée en STARTTLS au sein d'une même connexion du canal SMTP, le listener TLS du broker est un second socket distinct, la même forme qu'utilisent Mosquitto, EMQX et la plupart des brokers MQTT pour un port en clair à côté d'un port TLS, et le choix le plus naturel pour MQTT, qui (contrairement à SMTP) n'a pas de montée en connexion largement implémentée.

Ce paquet ne génère pas de certificat de lui-même, auto-signé ou autre, car rien en aval ne finirait par faire confiance à un certificat qu'il aurait inventé : un vrai certificat (d'une CA interne, de `cert-manager` ou de toute autre source) est donc toujours à fournir par l'opérateur.

## Configuration

| Variable | Par défaut | <span class="sr-only">Details</span> |
|---|---|---|
| `HOTLOOP_BROKER_ENABLED` | `false` | La fonctionnalité est désactivée tant que ce n'est pas défini |
| `HOTLOOP_BROKER_LISTEN_ADDR` | `:1883` | Le listener TCP en clair |
| `HOTLOOP_BROKER_TLS_ENABLED` | `false` | Ajoute un second listener TLS indépendant |
| `HOTLOOP_BROKER_TLS_LISTEN_ADDR` | `:8883` | Utilisé seulement quand TLS est activé |
| `HOTLOOP_BROKER_TLS_CERT_FILE` / `_KEY_FILE` | n/a | Obligatoires quand TLS est activé |
| `HOTLOOP_BROKER_ALLOW_ANONYMOUS` | `false` | Choix par déploiement ; ne l'activez jamais par défaut |
| `HOTLOOP_BROKER_USERS` | aucun | `user:password,user2:password2`. Chacun peut tout faire ; voir plus haut. Les connexions avec règles se créent dans HotLoop |
| `HOTLOOP_BROKER_DISCOVERY` | `true` | Écoute les appareils qui s'annoncent ; voir [la découverte MQTT](/fr/iot/mqtt-discovery/) |
| `HOTLOOP_BROKER_DISCOVERY_PREFIX` | `homeassistant` | Le préfixe de topic sous lequel arrivent les annonces |

## Ce qui a été vérifié ou non

HotLoop a été exécuté sur du vrai matériel et de vrais serveurs, et sur du matériel réel le 2026-11-17.
