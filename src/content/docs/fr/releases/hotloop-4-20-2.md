---
title: "Notes de version: HotLoop core 4.20.2"
description: "Ce qu'apporte HotLoop core 4.20.2, ce qui change à la mise à jour et ce qu'il faut lire avant de toucher une usine en production."
sidebar:
  label: "4.20.2"
---

Deux correctifs au-dessus de la [4.20.1](/fr/releases/hotloop-4-20-1/), et la licence. C'est la première version du cœur sous la EmberNet Source License 1.0 (`LicenseRef-EmberNet-Source-1.0`) : LICENSE, NOTICE, le README, les annotations des charts et les étiquettes des images le disent.

- **EtherNet/IP avec plus d'un tag dans un lot.** Le pilote demandait un lot à `ReadMulti` de la bibliothèque, qui prend une structure de champs étiquetés ou une map, et un simple nom de tag la fait paniquer dans reflect avant qu'un octet ne parte. Donc tout équipement EtherNet/IP avec deux tags ou plus dans un lot faisait paniquer son interrogation (les lots sont de vingt par défaut). Personne ne l'a vu en test parce qu'aucun test n'avait jamais mis un lot face à un serveur. Maintenant les tests font tourner un serveur EtherNet/IP et un serveur S7 dans le processus, les pilotes les lisent par TCP, et le lot passe par `ReadList`. Un contrôleur qui se tait avec son socket ouvert est hors ligne dans une interrogation plus son timeout, comme prévu, et n'est plus interrogé de nouveau tag par tag, ce qui retenait l'interrogation un timeout par tag. S7comm et EtherNet/IP ne sont toujours pas éprouvés contre un automate physique.
- **`version` est un mot.** `podman run ghcr.io/hotloop-io/hotloop:4.20.1 version` mourait avec « database password is not set », parce que seul `--version` était traité avant la lecture de la configuration. `version` affiche maintenant la version avec un environnement vide, pour le Gateway, Edge et IoT, et pour l'Edge Relay.

- Pas de migrations, pas de nouveaux secrets, pas de changements d'API. Un `helm upgrade` simple ou la mise à jour automatique de Quadlet la prend.
- Les quatre charts (`hotloop`, `hotloop-iot`, `hotloop-edge`, `hotloop-edge-relay`) sont à la 4.20.2, avec toutes les versions antérieures toujours dans l'index.
- Cette construction est uniquement amd64, et `stable` garde les images arm qu'il détient. La version suivante est un petit changement de version qui construit les images arm.
