---
title: "La palette de nœuds"
description: "Chaque type de nœud livré avec Flow, classé complet, partiel, divergent ou propre à Flow, avec la différence par rapport à Node-RED consignée par écrit."
---

**117 types de nœuds pour les messages et 39 de plus pour les diagrammes FlowLab.**

| Catégorie | Nœuds |
|---|---|
| Commun | inject, debug, complete, catch, status, link in, link out, comment, junction |
| Fonction | function, switch, change, range, template, delay, trigger, exec, rbe |
| Réseau | ntfy out, gotify out, discord out, discord bot out, kafka out, mqtt in/out, http in, http response, http request, websocket in/out, tcp in/out, tcp request, udp in/out, modbus read/write, s7 read/write, ethernetip read/write, opcua read/write/subscribe, sparkplug in/out/command, hotloop in/state/script/recipe, mcp tool/result/client, e-mail, et les nœuds modbus-read/getter/flex-getter/write/flex-write/server de Node-RED |
| Séquence | split, join, sort, batch |
| Analyseur | csv, html, json, xml, yaml |
| Stockage | file, file in, watch, influxdb out, postgres, postgresql |
| Tableau de bord | ui_text, ui_numeric, ui_button, ui_switch, ui_text_input, ui_led, ui_gauge, ui_chart, ui_template, et les ui_base, ui_tab, ui_group, ui_link et ui_spacer qui mettent la page en forme |
| Découverte | scan, netinfo, pour inventorier un segment OT |
| Configuration | hotloop-flow-ntfy, hotloop-flow-gotify, hotloop-flow-discord-bot, hotloop-flow-kafka, mqtt-broker, websocket-listener, websocket-client, influxdb, postgres, modbus, s7, ethernetip, opcua, sparkplug, hotloop, mcp-server, modbus-client, postgreSQLConfig |
| FlowLab | constant, math, compare, logic, wait, bundle, field, build array, while loop, for loop, body in, body out, serial port, serial read, serial write, parse reading, stable value, log to text file, log to TDMS file, statistics, integral, derivative, filter, read DAQ task, mqtt out, postgres out, control, indicator, chart |

La ligne FlowLab est un autre genre de nœud. Il s'exécute sur un onglet qui est un diagramme, où un nœud s'exécute une fois quand chaque entrée a une valeur, et ne prend jamais de message. Ce qu'est FlowLab, et comment fonctionnent ses boucles, son fil d'erreur, son panneau et son débogueur, se trouve dans [FlowLab](/fr/flow/flowlab/). Un fichier de flux, donc un jeu de diagrammes, peut être poussé vers chaque installation Flow qu'un locataire exécute dans EmberNet, chacune vérifiée et celle qui échoue remise en l'état : [Pousser vers les stations d'un locataire](/fr/flow/stations/). Deux installations peuvent se partager le travail d'une seule, avec un bail et une barrière sur chaque écriture vers l'équipement pour qu'une seule écrive : [Une veille active avec un bail](/fr/flow/failover/).

## Prévenir les gens, et Kafka

Cinq nœuds envoient ailleurs ce que transporte un message et font suivre le message : **ntfy out**, **gotify out**, **discord out** (un webhook), **discord bot out** et **kafka out**. Ils prennent les mêmes réglages que ceux avec lesquels le cœur de HotLoop envoie ses alarmes et ses événements, si bien qu'une usine qui a déjà un sujet ntfy, une application Gotify, un webhook Discord ou un cluster Kafka pointe Flow vers les mêmes.

- **ntfy.** Un nœud de configuration de serveur (adresse, puis un jeton d'accès ou un nom d'utilisateur et un mot de passe, ou rien pour un serveur qui laisse tout le monde publier), et par nœud un sujet, un titre, une priorité (de min à max, ou `msg.priority`), des étiquettes et une adresse de clic. Un sujet ou un titre vide prend `msg.topic` ou `msg.title`. Sur un serveur public, le sujet est le seul secret qui existe, il est donc tenu hors de toute erreur et de tout état.
- **Gotify.** Un nœud de configuration de serveur avec le jeton de l'application, et par nœud un titre et une priorité de 0 à 10.
- **Webhook Discord.** L'URL du webhook est tout l'identifiant, sur le nœud, et n'apparaît jamais dans un état, un journal ou une erreur, pas même dans une erreur réseau qui nomme l'adresse. Un titre ou une couleur fait du message un embed. Le contenu est coupé à 2,000 caractères et la description d'un embed à 4,096, comptés comme Discord les compte, et rien dans un message ne peut mentionner qui que ce soit.
- **Bot Discord.** Un nœud de configuration de bot avec son jeton, et par nœud un ID de canal (ou `msg.channel`). Il publie en tant que bot et a besoin que le bot soit dans le canal avec la permission d'envoyer.
- **Kafka out.** Un nœud de configuration de cluster (brokers, SASL PLAIN ou SCRAM-SHA-256 ou SCRAM-SHA-512, TLS), et par nœud un sujet et une clé facultative. La valeur est `msg.payload`, en texte, ou en JSON quand ce n'est pas du texte, et le message est transmis une fois que le cluster l'a acquitté depuis tous les réplicas synchronisés. Il utilise franz-go, le client qu'utilise la sortie Kafka du cœur.

Un serveur qui refuse dit pourquoi dans l'erreur du nœud, sans rien de ce qui a été envoyé. Une limitation de débit est attendue une fois, aussi longtemps que le serveur l'indique jusqu'à une minute, puis le message échoue. Il n'y a pas de nœud Slack ni Teams, ni de nœud UADP : HotLoop reçoit UADP et Flow lit ces valeurs par les nœuds HotLoop.

Éprouvé contre un vrai ntfy, un vrai Gotify et un vrai Redpanda : le nœud publie et on demande au serveur ce qu'il contient. Les nœuds Discord suivent l'API documentée de Discord pour les webhooks et les bots.

`scan` balaie une plage CIDR et identifie les points de terminaison Modbus et EtherNet/IP, et `netinfo` indique les interfaces que l'exécution peut réellement voir, ce qui, en mode macvlan, est la façon dont un flux découvre sa propre adresse sur le VLAN OT. Les nœuds Modbus TCP, S7, EtherNet/IP, OPC UA et Sparkplug B peuvent maintenant dialoguer avec ce que `scan` trouve, et c'est la section suivante.

Un descripteur Go par type de nœud déclare ses propriétés, ses ports, ses valeurs par défaut et son texte d'aide, et l'éditeur génère la boîte de dialogue à partir de lui, si bien qu'un nœud ne peut pas être livré avec une boîte de dialogue en désaccord avec son exécution.
