---
title: "Notes de version : HotLoop Flow 2.9.1"
description: "Ce que apporte HotLoop Flow 2.9.1, ce qui change à la mise à jour et ce qu'il faut lire avant de toucher à une usine en marche."
sidebar:
  label: "2.9.1"
---

HotLoop Flow 2.9.1 permet au nœud `modbus-server` d'écouter sur l'interface d'un VLAN, si bien qu'un seul Flow peut faire tourner un serveur sur chaque VLAN d'un port, à la même adresse et sur le même port.

## Nouveautés

- **`modbus-server` accepte une interface réseau.** Le socket d'écoute est lié à l'interface (`SO_BINDTODEVICE`) avant d'écouter, donc deux serveurs sur `192.168.1.9:10502` sur deux VLAN n'entrent plus en collision. Le réglage est le même que sur chaque client : l'**Interface réseau** du nœud lui-même, sinon `FLOW_NETWORK_INTERFACE` dans les variables d'environnement de son onglet. Sans l'un ni l'autre, il écoute comme toujours, et deux serveurs sur la même adresse et le même port entrent toujours en collision, désormais avec une erreur qui dit que chacun a besoin d'une interface.

## Ce qui a changé

- Sans configuration, il se comporte comme l'amont. NOTICE et `HOTLOOP_PATCH.txt` disent ce qui a changé.

## Nouveaux réglages

Rien en dehors du champ **Interface réseau** sur `modbus-server`. La valeur de chart `bindToInterface.netRaw` et l'exigence de réseau de l'hôte de la 2.9.0 s'appliquent à lui comme aux clients.

## Mise à jour

Un simple `helm upgrade` vers l'image et le chart 2.9.1, ou le nouveau tag dans votre unité Quadlet. Il ne se passe rien au premier démarrage et rien n'est à migrer. Un flow qui ne règle aucune interface se comporte exactement comme sur la 2.9.0.

Image : `ghcr.io/hotloop-io/hotloop-flow:2.9.1`, linux/amd64 d'abord, avec arm64 à suivre dans la 2.9.2. Chart : `https://hotloop.io/hotloop-flow/`. Le README de ce tag a le reste, avec des images : https://github.com/HotLoop-io/hotloop-flow/blob/v2.9.1/README.md
