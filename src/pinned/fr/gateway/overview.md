---
title: "Présentation de HotLoop Gateway"
description: "Une passerelle industrielle : douze pilotes natifs, un historien qui garde la qualité, des alarmes ISA-18.2, MCP pour les agents et une seule porte d'écriture."
sidebar:
  label: "Vue d'ensemble"
---

:::note[{{hotloop}} est disponible]
Quatre produits issus d'un même tag : [IoT](/fr/iot/overview/), [Edge](/fr/edge/overview/), la passerelle (Gateway) et l'[Edge Relay](/fr/edge-relay/overview/), chacun avec sa propre image et son propre chart. Les quatre sont compilés pour amd64 et arm64 dans {{hotloop}}, et aussi pour arm/v7 dans les trois petits. La Gateway garde `ghcr.io/hotloop-io/hotloop:{{hotloop}}` et le chart `hotloop` de `https://hotloop.io/hotloop`, et les deux se téléchargent sans connexion. [Installez-la](/fr/gateway/install/). Vous êtes en 4.18.11 ? C'est un `helm upgrade`, et les agents peuvent écrire ensuite, donc lisez les deux changements. Vous êtes en 4.17.0 ? C'est un `helm upgrade` simple, mais sans `--reuse-values`, et quelques valeurs par défaut ont bougé. Vous êtes en 4.16.0 ou 4.3.1 ? Passez d'abord par 4.17.0. Dans tous les cas, [lisez d'abord la mise à niveau](/fr/gateway/upgrading/). Mieux vaut l'apprendre ici que devant un déploiement bloqué.
:::

HotLoop Gateway lit votre usine. Elle interroge les automates et les serveurs dans leur propre protocole, garde chaque lecture et sa qualité dans un historien, lève des alarmes ISA-18.2 qui peuvent appeler un téléphone, exécute des automatisations sur l'ensemble et donne toute l'usine aux agents par MCP. Un site exécute un seul chart, la Gateway et sa base de données, au lieu d'un historien, d'un serveur d'alarmes, d'un moteur de règles et d'un tas de colle, chacun tombant en panne à son rythme.

Elle peut aussi commander ces équipements, donc toute valeur à destination d'un appareil passe par [une seule porte d'écriture](/fr/gateway/write-gate/). Les écritures sont livrées désactivées, chaque tag est en lecture seule tant que personne ne l'arme, une valeur hors plage est refusée au lieu d'être tronquée, et chaque tentative est journalisée avant d'atteindre le fil, refus compris.

Elle est écrite en Go, de zéro : un binaire statique sur une base distroless, sans sidecar ni interpréteur, exécuté par un utilisateur non root, toutes capacités retirées, sur un système de fichiers racine en lecture seule.

## Par où commencer

Le socle, dans {{hotloop}} et dans toutes les versions jusqu'à la 4.16.0 :

- [Installation](/fr/gateway/install/) : Helm depuis le chart publié ou Podman Quadlet sur un boîtier, la clé à sauvegarder et les quelques valeurs à régler avant qu'une vraie usine ne la voie.
- [Mise à niveau](/fr/gateway/upgrading/) : la procédure qui conserve vos données, depuis 4.17.0, 4.16.0 ou 4.3.1, et chaque changement d'API qui fera trébucher un script.
- [La porte d'écriture](/fr/gateway/write-gate/) : tous les contrôles entre une requête et une machine, dans l'ordre où le code les exécute, et ce que répond chaque refus.
- [Protocoles](/fr/iot/protocols/) dit exactement jusqu'où chaque pilote a été éprouvé, y compris les deux essayés sur matériel réel le 2026-11-17, S7comm et EtherNet/IP.
- [Automatisations](/fr/iot/automations/) couvre les déclencheurs, les conditions et les actions, et pourquoi une règle est compilée à l'enregistrement plutôt qu'au moment où elle se déclenche à 3 h du matin.
- [Model Context Protocol](/fr/iot/mcp/) : la Gateway comme serveur et client MCP, et comment une seule Gateway lit tous les sites.

Nouveautés de 4.19.4 par rapport à 4.18.11 : les agents écrivent par la même porte que l'écran (MCP est activé dans tous les produits et le point d'accès exige toujours un jeton), une valeur écrite dans un tag mis à l'échelle arrive dans le registre comme vous l'entendiez, un runtime CODESYS se lit par les noms de sa Symbol Configuration, un flux d'événements Kafka rejoint les destinations de l'historien, OPC UA PubSub sur UADP s'abonne et publie, et `hostNetwork` devient un réglage du chart. 4.19.5 en est la compilation multi-architecture, et 4.19.8 ajoute un correctif du Journal de bord et des sélecteurs de tags qui cherchent dans toute l'usine. [Les notes de version](/fr/releases/hotloop-4-19-4/) disent ce que chacun vous apporte et ce qu'il coûte.

Nouveautés de 4.18.11 par rapport à 4.18.10 : la base de données est PostgreSQL 17 avec une mise à niveau qui s'exécute seule, SNMP et BACnet/IP par un seul flux d'intégrations, connexion kiosque avec verrouillage, escalade des alarmes et une interface qui s'installe sur un téléphone. [Les notes de version](/fr/releases/hotloop-4-18-11/) disent ce que chacun vous apporte et ce qu'il coûte.

Nouveautés de 4.18.10 par rapport à 4.17.0 : la gamme de quatre produits, un choix de base de données, MQTT et la découverte du réseau, des destinations d'historien et des boîtiers qui se mettent à jour seuls. [Les notes de version](/fr/releases/hotloop-4-18-10/) disent ce que chacun vous apporte.

Nouveautés de 4.17.0 par rapport à 4.16.0 :

- [Recettes](/fr/iot/recipes/), [Scripts](/fr/iot/scripts/), [Blueprints](/fr/iot/blueprints/), [Assistants](/fr/iot/helpers/), [Journal de bord](/fr/iot/logbook/) et [UniFi Network](/fr/iot/unifi/). [Les notes de version](/fr/releases/hotloop-4-17-0/) disent ce que chacun vous apporte.

## Ce qu'elle fait des données

**Historien.** TimescaleDB par défaut (sur PostgreSQL 17 depuis 4.18.11), et un PostgreSQL ordinaire ou un fichier SQLite fonctionnent aussi, car [la base de données est un réglage](/fr/releases/hotloop-4-18-10/). La table d'historique est une hypertable quand l'extension est là et partitionnée nativement par plages quand elle ne l'est pas, donc un PostgreSQL ordinaire marche au lieu d'échouer. Réglez une bande morte par tag. Sans elle, un capteur qui vacille sur son dernier bit écrit une ligne à chaque scrutation pour toujours, et mille tags lus chaque seconde font environ 86 millions de lignes par jour.

**Alarmes.** ISA-18.2, y compris l'état que manquent la plupart des systèmes maison : `rtn-unack`, une alarme revenue à la normale toute seule avant que personne ne la voie. Acquittée et revenue à la normale sont deux axes séparés, donc le déclenchement fugitif de 03 h 00 est toujours dans la liste quand l'équipe du matin arrive, au lieu de disparaître sans que personne le sache. Les bandes mortes asymétriques et les temporisations à l'activation et à la désactivation empêchent une valeur limite de faire papillonner la liste jusqu'au bruit que personne ne lit. La mise en attente plafonne à 24 heures, car une mise en attente sans fin est une suppression que personne n'a écrite.

**Qualité.** Chaque lecture porte bonne, incertaine ou mauvaise, et mauvaise veut dire que la valeur n'est pas connue. Jamais zéro. Les alarmes gardent leur état sur une mauvaise lecture au lieu de l'évaluer, si bien qu'un instrument mort apparaît comme un instrument mort et non comme un incident de procédé. Les tendances et les rapports n'agrègent que les bonnes lectures, comptent ce qu'ils ont écarté et ne donnent aucune valeur à une période sans bonne lecture. Zéro est une lecture (une vanne fermée, un débit nul), et personne ne nous l'a prise.

**Entités.** La pompe d'alimentation, pas le registre 40001. Chaque tag reçoit gratuitement une entité, un moteur, une vanne ou une boucle PID est une seule entité construite à partir des tags qu'elle est vraiment, et tout est rattaché à un seul arbre d'équipements ISA-95. Les règles, les écrans et les agents se lisent comme l'usine et non comme une carte de registres. Un moteur tourne quand son contact de marche le dit, jamais parce que nous lui avons dit de démarrer.

**Notifications.** ntfy, Gotify, Discord, webhook et e-mail. Appuyez sur Acquitter sur votre téléphone et l'alarme est acquittée dans la Gateway, avec un lien signé, qui expire et ne sert qu'une fois. Le bot Discord a été testé face à un substitut qui applique le protocole documenté de Discord.

## Les écrans

**Tableau** est celui qu'on laisse sur un mur. Les tags épinglés sont des jauges dont les limites d'alarme sont dessinées là où elles tombent vraiment sur l'arc, avec la dernière minute d'historique dessous. La disposition est stockée avec l'usine, pas dans un navigateur, donc le PC de panneau de l'atelier et l'ordinateur du bureau affichent le même tableau.

**Entités** est l'usine telle que les gens en parlent, chaque chose sous sa place dans l'arbre. La qualité est dessinée avant la valeur : une mauvaise lecture montre sa dernière bonne valeur grisée et hachurée, et rien de peu fiable ne ressemble jamais à quelque chose de fiable. Un opérateur qui se fie à un chiffre périmé, c'est ainsi qu'un réservoir déborde. **Usine** est l'éditeur de l'arbre.

**Vue d'ensemble, Appareils, Tags, Tendances, Alarmes, Automatisations et Protocoles** sont les écrans de travail. 4.17.0 en ajoute quatre : **Journal de bord** est la chronologie, **Scripts** exécute des séquences nommées avec un formulaire pour leurs champs, **Recettes** applique un jeu de consignes et montre exactement ce qui est parti (une valeur qui n'a pas été relue s'affiche en orange, jamais en vert), et **Blueprints** transforme une règle à trous en vraie règle, avec **Vérifier d'abord** qui montre ce qu'elle ferait avant qu'elle existe. Depuis 4.18.10, **Appareils** liste aussi ce que la découverte a trouvé, en lecture seule jusqu'à ce qu'un administrateur l'accepte. **Sites** lit sur plusieurs usines, et un site qui ne répond pas est affiché comme injoignable, avec la raison, et laissé hors de la synthèse. Compter une usine injoignable comme zéro alarme, c'est ainsi qu'un siège décide que tout va bien la pire nuit de l'année.

**Paramètres** montre avec quoi la Gateway tourne réellement : chaque paramètre, sa valeur effective, et si elle vient de la base de données, d'une variable d'environnement ou de la valeur par défaut. Quand elle fait quelque chose d'inattendu, c'est ici qu'on trouve pourquoi. Les interrupteurs de sécurité y sont en lecture seule exprès, car le contrôle maître qui décide si ce processus peut commander des équipements n'a pas sa place derrière la même session de navigateur que celle qui émet les écritures.

## Sa place dans la gamme

HotLoop est une seule base de code livrée en quatre produits, tous publiés ensemble depuis un même tag : IoT, Edge, la Gateway et l'Edge Relay. La Gateway en est le sommet : tout ce qu'il y a dans IoT et Edge, plus la gestion de parc, les synthèses multisites et les rapports planifiés. Les fonctions séparent les produits. Les protocoles jamais : chaque produit parle tous les protocoles que nous avons, pour que personne n'ait à monter en gamme pour lire l'automate de son banc. [La gamme](/fr/products/) détaille ce que porte chacun.

Les quatre sont installables aujourd'hui, tous en {{hotloop}}. Le relais a sa propre image et son propre chart, environ 15 Mo contre 37 pour la Gateway, sans base de données ni interface. La gestion de parc de la Gateway suit et commande chaque relais enregistré, et elle n'existe que par l'API (`/api/fleet`) : il n'y a pas d'écran Parc dans l'interface.

Vous l'utilisez dans une usine ? [Utiliser HotLoop en entreprise](/fr/business/) couvre les licences et la façon de nous joindre.

## Ce qui a changé, version par version

Chaque version a ses propres notes, et le détail s'y trouve, donc il est à un seul endroit et non à deux.

- [4.24.0](/fr/releases/hotloop-4-24-0/) : les écrans sont des P&ID, avec des cuves, des pompes et des vannes reliées par des tuyaux qui tracent eux-mêmes leur chemin en angles droits, transportent un fluide et se retracent quand un symbole bouge ; les alarmes propres à un automate CODESYS apparaissent dans la liste des alarmes et un acquittement retourne à l'automate ; une exécution de script se termine toujours, et le volume de données d'une machine se lit toujours. Cette version est amd64 seulement, et la suivante est le petit correctif qui construit les images arm.
- [4.23.6](/fr/releases/hotloop-4-23-6/) : UniFi Protect, Access et les prises de PDU, un appareil Shelly, la sécurité et les métadonnées d'OPC UA PubSub, un appareil Modbus muet qui lit mauvais sur chaque point, et les fonctions terminées activées dès le premier démarrage, avec les canaux d'alarme et le publieur edge qui attendent une destination sous Paramètres. Elle porte aussi les changements de 4.23.4 et 4.23.5, parce qu'aucune des deux n'a été publiée. Cette version est amd64 seulement, et la suivante est le petit correctif qui construit les images arm.
- [4.23.3](/fr/releases/hotloop-4-23-3/) : n'importe quel symbole de n'importe quel écran peut être affiché et coloré par une règle sur un tag, et un écran WebVisu garde ses masquages et ses couleurs d'alarme quand il arrive. Cette version est amd64 seulement.
- [4.23.2](/fr/releases/hotloop-4-23-2/) : une visualisation CODESYS s'importe comme un écran, la machine remonte sa propre santé au tableau de bord EmberNet derrière un identifiant qui peut lire et rien d'autre, et un compteur d'énergie peut porter une charge de puissance. Cette version est amd64 seulement, et la suivante est le petit correctif qui construit les images arm.
- [4.23.1](/fr/releases/hotloop-4-23-1/) : stations météo et compteurs d'énergie, l'interface web en treize langues de plus, des tableaux de bord qui s'exportent vers un fichier et s'importent dans une autre installation, et les premières commandes vers une console UniFi. 4.23.0 a été taguée et jamais publiée, donc cette version porte ce que ses notes listent. Cette compilation est amd64 uniquement.
- [4.22.1](/fr/releases/hotloop-4-22-1/) : la compilation multi-architecture de 4.22.0, sans changement du produit.
- [4.22.0](/fr/releases/hotloop-4-22-0/) : une page de panneau remplit son écran de bord à bord, à toute taille, l'écran Alarmes importe un fichier Export Alarms de CODESYS, et les appareils OPC UA PubSub sur une même adresse et un même port partagent un socket. Cette compilation est amd64 uniquement, et 4.22.1 est le petit incrément qui construit les images arm.
- [4.21.1](/fr/releases/hotloop-4-21-1/) : la compilation multi-architecture de 4.21.0, sans changement du produit.
- [4.21.0](/fr/releases/hotloop-4-21-0/) : un client peut se connecter au serveur OPC UA avec un certificat X.509 qu'un administrateur a rattaché à un utilisateur (désactivé jusqu'à `HOTLOOP_OPCUA_SERVER_ALLOW_X509=true`), les mots de passe OPC UA de 65 à 72 octets fonctionnent, et les politiques de sécurité obsolètes `Basic128Rsa15` et `Basic256` sont désactivées par défaut, y compris lors des mises à niveau (`HOTLOOP_OPCUA_SERVER_ALLOW_DEPRECATED_POLICIES=true` les rétablit pour un ancien client). L'import d'alarmes CODESYS lit une alarme Outside range comme un lo et un hi. Une migration, 0027, qui ne fait qu'ajouter une table.
- [4.20.2](/fr/releases/hotloop-4-20-2/) : un appareil EtherNet/IP avec deux tags ou plus dans un lot ne fait plus paniquer sa scrutation, et `version` affiche la version sans configuration. La première version du cœur sous l'EmberNet Source License 1.0.
- [4.20.1](/fr/releases/hotloop-4-20-1/) : la compilation multi-architecture de 4.20.0, sans changement du produit.
- [4.20.0](/fr/releases/hotloop-4-20-0/) : la nouvelle interface web est la page à `/` et l'ancienne disparaît, avec les mêmes écrans et commandes, les couleurs de HotLoop, les écrans regroupés en Exploiter, Usine, Construire et Système, et une barre de cinq sur téléphone. MCP peut changer tout ce qu'il peut lire : 128 outils, soixante-quatre qui modifient la configuration et trente-sept pour les fonctions propres à l'administrateur, chacun étant une route de l'API exécutée par son propre gestionnaire avec l'autorisation de cette route, un motif obligatoire et l'agent dans la ligne d'audit, derrière `allowMcpWrites`. Cette compilation est amd64 uniquement, et la version suivante construit les images arm.
- [4.19.11](/fr/releases/hotloop-4-19-11/) : les cartes de tableau de bord de consigne et de page de symboles, une écriture vers un tag CODESYS ou OPC UA relue depuis l'automate, un appareil CODESYS lu une fois par seconde, des alarmes importées depuis un projet CODESYS, les écrans UniFi qui tracent une courbe avant le chiffre à côté, et une destination Kafka ou Redpanda qui dit pourquoi un broker refuse les écritures. Cette compilation est amd64 uniquement, et la version suivante est le petit incrément qui construit les images arm.
- [4.19.10](/fr/releases/hotloop-4-19-10/) : la compilation multi-architecture de 4.19.8, sans changement du produit. Il n'y a pas de 4.19.9.
- [4.19.8](/fr/releases/hotloop-4-19-8/) : le bouton Entrées plus anciennes du Journal de bord garde sa page, et chaque sélecteur de tag cherche dans toute l'usine. Elle porte aussi les changements de 4.19.6 et 4.19.7, car aucune n'a été publiée.
- [4.19.5](/fr/releases/hotloop-4-19-5/) : la compilation multi-architecture de 4.19.4, sans rien d'autre.
- [4.19.4](/fr/releases/hotloop-4-19-4/) : écritures des agents et un jeton sur chaque point d'accès MCP, écritures mises à l'échelle qui tombent juste, CODESYS par nom de symbole, un flux d'événements Kafka, OPC UA PubSub sur UADP et `hostNetwork`. Il n'y a pas de 4.19.0 à 4.19.3, et les notes disent pourquoi.
- [4.18.11](/fr/releases/hotloop-4-18-11/) : PostgreSQL 17 avec une mise à niveau qui s'exécute seule (lisez celle-ci avant de mettre à niveau une usine en marche), SNMP et BACnet/IP par un seul flux d'intégrations, connexion kiosque avec verrouillage, escalade des alarmes et une interface qui s'installe sur un téléphone.
- [4.18.10](/fr/releases/hotloop-4-18-10/) : la gamme de quatre produits, un choix de base de données, MQTT et la découverte du réseau, des destinations d'historien et des boîtiers qui se mettent à jour seuls. Il n'y a pas de 4.18.0 à 4.18.9, et les notes disent pourquoi.
- [4.17.0](/fr/releases/hotloop-4-17-0/) : recettes, scripts, blueprints, assistants, le journal de bord et UniFi Network, en lecture seule.

## Licence

HotLoop Gateway est sous la HotLoop Source License Agreement 1.0, comme tous les produits HotLoop. Elle est gratuite à l'usage et à code source disponible, pas open source au sens de l'OSI, et chaque version passe sous AGPL-3.0 ou ultérieure quatre ans après sa publication. L'usage domestique et de laboratoire est gratuit, tout comme celui des écoles, des associations et des administrations pour leurs propres activités. Il n'y a aucune clé de licence et rien ne se débloque à l'exécution. [La page Licence](/fr/license/) donne le texte, et [Utiliser HotLoop en entreprise](/fr/business/) couvre les deux façons de l'exploiter au travail.
