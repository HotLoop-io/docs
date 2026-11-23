---
title: "Notes de version: HotLoop core 4.23.6"
description: "Ce qu'apporte HotLoop core 4.23.6, ce qui change à la mise à jour et ce qu'il faut lire avant de toucher une usine en production."
sidebar:
  label: "4.23.6"
---

Les cases de la feuille de route Protect, Access et boîtiers d'alimentation reçoivent du code, l'équipement Shelly parle directement au Shelly, et OPC UA PubSub reçoit la sécurité des messages et les métadonnées. Construite pour amd64 seulement ; la construction multi-architecture suit comme version suivante.

## Ce qui a changé

- **UniFi Protect, comme équipement.** Protocole `unifi-protect`, avec une clé d'API de la page Integrations de la console, scellée comme un mot de passe de console et avec le certificat épinglé. Les caméras, capteurs, lumières et sirènes sont des tags qui s'ajoutent d'eux-mêmes. Le mouvement et les détections intelligentes d'une caméra (personne, véhicule, colis, plaque d'immatriculation, visage, animal) viennent du websocket d'événements et se lisent mauvais tant qu'il est coupé, jamais « pas de mouvement ». Une sirène peut être armée pour sonner, et `alarm.<trigger>.fire` envoie le webhook du gestionnaire d'alarmes pour qu'une alarme HotLoop fasse enregistrer les caméras. L'instantané d'une caméra est une route. Chaque événement est dans le logbook. Voir [UniFi Network](/fr/iot/unifi/#unifi-protect).
- **UniFi Access, comme équipement.** Protocole `unifi-access`, avec un jeton d'API. La position et le verrou de chaque porte sont des tags, tenus à jour par le websocket de notifications, et chaque changement est dans le logbook. Déverrouiller est une écriture qu'une personne arme, par la porte d'écriture, auditée. Voir [UniFi Network](/fr/iot/unifi/#unifi-access).
- **Prises de PDU SmartPower.** Le relais, la puissance, le courant, la tension et le facteur de puissance d'une prise sont des tags de l'équipement UniFi Network, et la consommation totale d'une PDU en est un. Écrire `on` sur une prise la commute et garde le nom de chaque autre prise ; `cycle` l'éteint, attend et la rallume, au plus une fois par 15 minutes, et finit toujours allumée. Voir [UniFi Network](/fr/iot/unifi/#prises-de-pdu-smartpower).
- **Un équipement Shelly.** Protocole `shelly` : RPC Gen2 et ultérieur avec la connexion digest propre à l'équipement, des tags pour chaque composant qu'il signale, des écritures pour un switch, une lumière, un volet et un thermostat. Le Gen1 est refusé avec un message qui l'envoie vers MQTT.
- Réponses DataSetMetaData et de découverte, par morceaux quand elles sont grandes, lues dans les messages capturés d'un éditeur Siemens. L'éditeur annonce ses métadonnées tous les dix intervalles par défaut (`HOTLOOP_UADP_PUBLISH_METADATA_EVERY`, 0 le désactive). Voir [Protocoles et pilotes](/fr/iot/protocols/).
- **Le vidangeur de la file de transfert regarde de nouveau, et dit quand il échoue.** Une passe qui n'envoyait rien alors que des mesures attendaient attendait un coup de pouce qu'une interrogation tranquille n'envoie jamais, et une passe échouée reculait une demi-minute sans aucune ligne dans le journal.
- **Les tests attendent ce qu'ils attendent.** Six tests d'énergie attendent les mesures du banc au lieu d'une pause fixe.

- **Un équipement Modbus silencieux se lit mauvais sur chaque point.** Sur une ligne série, une requête qui expirait utilisait toute l'échéance de l'interrogation, si bien que seul le premier bloc passait en mauvais et que chaque point suivant gardait sa dernière bonne valeur tant que le câble restait débranché. Maintenant, un équipement qui ne répond rien marque chaque point mauvais dans la même interrogation. Voir [Protocoles et pilotes](/fr/iot/protocols/).
- **Les fonctions terminées sont livrées activées.** Dans le chart Helm et dans le binaire : le broker MQTT intégré (ses logins se créent dans HotLoop), le serveur OPC UA (authentification activée, avec un login `opcua-reader` généré que Settings montre à un administrateur), les rapports planifiés, la sauvegarde locale quotidienne (toutes les 24 heures, volume de 5 Gi), le ServiceMonitor (rendu seulement là où existent les CRD de l'opérateur Prometheus, si bien qu'un cluster sans eux s'installe comme avant), et un Ingress sans nom d'hôte, qui répond à tout hôte que la classe sert jusqu'à ce que `ingress.hosts[0].host` soit défini. Les rapports, les sauvegardes, les certificats OPC UA et la file edge utilisent par défaut un répertoire inscriptible sous le répertoire de données de HotLoop, et un port qu'un autre service tient déjà reste inactif et le dit. Les charts `hotloop` et les charts générés d'IoT et d'Edge le portent.
- **Les canaux d'alarme et l'éditeur edge sont activés, et attendent une destination.** Les canaux webhook, e-mail, ntfy, Gotify, webhook Discord et bot Discord, et `edgePublish`, sont activés dès le premier démarrage. Un canal sans destination n'arrête plus l'installation ni le démarrage : il attend et le dit. Un administrateur saisit chaque destination dans Settings, « Where alarms and readings go », et ce qui y est enregistré l'emporte sur les valeurs du chart. Les canaux d'alarme s'appliquent à l'enregistrement ; la destination de l'éditeur edge s'applique au prochain redémarrage. Settings a aussi une carte de serveur OPC UA avec le point d'accès et le login généré.
- **La cible Kafka attend qu'un broker place un nouveau topic.** Un broker unique qu'un hôte occupé isole un instant faisait échouer la première consultation avec `INVALID_REPLICATION_FACTOR` ; la cible attend maintenant jusqu'à la fin de son délai et dit ce que le broker a répondu.
- **Le vidangeur de la file de transfert regarde de nouveau, et dit quand il échoue.** Une passe qui n'envoyait rien alors que des mesures attendaient attendait un coup de pouce qu'une interrogation tranquille n'envoie jamais, et une passe échouée reculait une demi-minute sans aucune ligne dans le journal.

- **Reporté des 4.23.4 et 4.23.5.** Les écrans TwinCAT `.TcVIS` et ceux de cds-text-sync et de codescribe s'importent avec leurs boutons, cadres, voyants et règles d'expression, et le rafraîchissement de l'écran UniFi attend la vue qui se charge. Aucune des deux versions n'a été publiée, donc les deux sont ici. Voir [4.23.4](/fr/releases/hotloop-4-23-4/) et [4.23.5](/fr/releases/hotloop-4-23-5/).

## Migrations

Aucun.

## Changements de l'API

`GET /api/unifi-protect/{id}/cameras/{camera}/snapshot` renvoie le JPEG courant de la caméra. La liste des protocoles contient `unifi-protect` et `unifi-access`. Voir [l'API HTTP](/fr/iot/api/).

## Mise à jour depuis la 4.23.5

Un `helm upgrade` simple. Pas de migration et pas de nouveau secret. Les 4.23.4 et 4.23.5 ont été taguées et leurs exécutions de version ont échoué dans le job de tests avant que quoi que ce soit soit publié, donc la dernière version avant celle-ci est la 4.23.3, et celle-ci porte les changements des deux. Un fichier de valeurs qui définit l'une des fonctions ci-dessus l'emporte toujours ; mettez-en une à `false` et elle ne rend ni listener, ni Service, ni volume, ni Ingress.

## Ce qui n'est pas éprouvé

- Protect, Access et les prises de la PDU ont été construits d'après les API publiées et soumis à des consoles de substitution qui gardent un état. Aucun n'a été sur une vraie console ou PDU, donc leurs cases dans la feuille de route ne sont pas cochées.
- Un instantané joint à une notification d'alarme n'est pas réalisé.
- PubSub : un Security Key Service n'est pas réalisé (les clés sont statiques), et aucun éditeur Siemens, CODESYS ou Beckhoff n'a été sur un banc.
- La désactivation de port UniFi attend toujours la requête de l'interface web d'une vraie console 10.6.
