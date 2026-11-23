---
title: "Notes de version : HotLoop Flow 2.9.0"
description: "Ce que apporte HotLoop Flow 2.9.0, ce qui change à la mise à jour et ce qu'il faut lire avant de toucher à une usine en marche."
sidebar:
  label: "2.9.0"
---

HotLoop Flow 2.9.0 ajoute des nœuds connecteurs natifs pour la migration d'une vraie usine. Il exécute les nœuds Node-RED sur lesquels s'appuient les flows d'une usine, Modbus, le tableau de bord, PostgreSQL et e-mail, ainsi que les `Buffer` et `setInterval` qu'appellent les nœuds de fonction qui les entourent. Un flow capturé sur une machine Node-RED qui les utilise se charge, s'exécute et s'enregistre sans changement. Il permet aussi à un seul Flow de garder un onglet pour chaque machine sur un équipement dont l'unique port porte un VLAN pour chacune, même quand tous les VLAN ont le même sous-réseau et les mêmes adresses d'appareil.

## Nouveautés

- **Modbus de Node-RED.** `modbus-client`, `modbus-read`, `modbus-getter`, `modbus-flex-getter`, `modbus-write`, `modbus-flex-write`, `modbus-server` et le `modbustcp-server` passif. La sortie est celle qu'envoient les nœuds de la communauté : `msg.payload` comme liste de valeurs, `msg.responseBuffer` comme `{data, buffer}`, `msg.input`, et les erreurs par la deuxième sortie.
- **Le tableau de bord.** `ui_base`, `ui_tab`, `ui_group`, `ui_link`, `ui_spacer`, `ui_text`, `ui_numeric`, `ui_button`, `ui_switch`, `ui_text_input`, `ui_led`, `ui_gauge`, `ui_chart` et `ui_template`, servis sur `/ui` depuis le binaire, sans rien récupérer en dehors de l'usine. Ce qu'un opérateur fait sur la page sort du nœud sous forme de message. `ui_template` exécute le sous-ensemble de style AngularJS qu'utilisent les usines : `{{ }}`, `ng-click`, `ng-class`, `ng-init`, `ng-show`, `ng-hide`, `ng-if`, `ng-bind`, `scope.$watch`, `scope.send`.
- **PostgreSQL.** `postgreSQLConfig` et `postgresql`. La connexion s'ouvre à la première requête, si bien qu'une base de données qui n'est pas encore démarrée n'arrête pas le flow.
- **E-mail.** Le nœud de sortie `e-mail` via SMTP, avec STARTTLS, un commutateur de certificat et XOAUTH2.
- **`Buffer`, `setInterval` et `setTimeout` dans le nœud de fonction.** Les minuteurs suivent l'horloge du nœud, chaque rappel a la même limite de CPU qu'un message, et tous les minuteurs sont arrêtés quand le flow s'arrête ou est redéployé.
- **Une interface réseau pour chaque client.** Un nœud, un onglet ou une configuration de client peut nommer l'interface à laquelle ses connexions se lient (`SO_BINDTODEVICE`), si bien qu'un onglet pour le séchoir 14 n'atteint que le `192.168.1.5` du VLAN 14. Côté onglet, c'est la variable d'environnement `FLOW_NETWORK_INTERFACE` de l'onglet, dont héritent tous les nœuds clients qu'il contient. Elle est présente sur les nœuds Modbus, PostgreSQL, e-mail, requête TCP, sortie UDP et requête HTTP.

Le README a une nouvelle section, `docs/node-red-types.md` dit ce qui s'exécute et en quoi cela diffère, et `docs/compatibility.md` est régénéré à partir du registre.

## Ce qui a changé

- Le nœud de fonction n'avait volontairement ni `Buffer`, ni `setTimeout`, ni `setInterval`, et deux tests le verrouillaient. Ils sont présents maintenant, parce que les fonctions d'une usine s'en servent. Rien d'autre n'a changé dans le bac à sable : il n'y a toujours ni `require`, ni `process`, ni bibliothèque standard de Node.
- Sans le crochet configuré, il se comporte comme l'amont. NOTICE et `HOTLOOP_PATCH.txt` disent ce qui a changé.
- La raison, ce sont les nœuds connecteurs Node-RED natifs pour la migration d'une vraie usine.

## Nouveaux réglages

- `HOTLOOP_FLOW_UI_PATH`, par défaut `/ui` : l'endroit où le tableau de bord est servi.
- `FLOW_NETWORK_INTERFACE`, une variable d'environnement d'onglet, de sous-flux ou de processus : l'interface à laquelle se lient les clients de cet onglet. Vide par défaut, ce qui laisse l'hôte choisir, comme avant.
- Un champ **Interface réseau** sur chaque nœud client et chaque configuration.
- Valeur de chart `bindToInterface.netRaw`, par défaut `false`. Lier un socket à une interface ne demande aucune capacité sous Linux 5.7 et plus récent. Sur un noyau plus ancien, il faut `CAP_NET_RAW`, et la mettre à `true` ajoute cette seule capacité au pod et rien d'autre. Le pod a aussi besoin du réseau de l'hôte (`network.mode: host`) pour voir une interface VLAN.

## Mise à jour

Un simple `helm upgrade` vers l'image et le chart 2.9.0, ou le nouveau tag dans votre unité Quadlet. Il ne se passe rien au premier démarrage, rien n'est à migrer, et un flow qui n'utilisait aucun des nouveaux types fonctionne comme avant. Un flow qui contient déjà ces types (un fichier Node-RED capturé) les démarre maintenant, là où il signalait chacun comme un type de nœud inconnu.

## Un changement dans NOTICE et les licences

NOTICE gagne l'entrée de la bibliothèque Modbus, qui est maintenant une copie modifiée. Aucun nouveau module tiers n'est dans l'image.

Image : `ghcr.io/hotloop-io/hotloop-flow:2.9.0`, linux/amd64 d'abord, avec arm64 à suivre dans la 2.9.1. Chart : `https://hotloop.io/hotloop-flow/`. Le README de ce tag a le reste, avec des images : https://github.com/HotLoop-io/hotloop-flow/blob/v2.9.0/README.md
