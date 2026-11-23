---
title: "Notes de version: HotLoop core 4.22.1"
description: "Ce qu'apporte HotLoop core 4.22.1, ce qui change à la mise à jour et ce qu'il faut lire avant de toucher une usine en production."
sidebar:
  label: "4.22.1"
---

Ceci est la construction multi-architecture de la [4.22.0](/fr/releases/hotloop-4-22-0/). Le code du produit est le même que celui de la 4.22.0 : la page de panneau qui remplit son écran, Import from CODESYS de l'écran Alarms, les sockets OPC UA PubSub partagés et la HotLoop Free Use License 1.0. La 4.22.0 était la construction amd64, et `stable` a gardé les images arm qu'il détenait déjà.

La 4.22.1 construit le jeu complet : le Gateway pour amd64 et arm64, et Edge, IoT et l'Edge Relay pour amd64, arm64 et arm/v7. Lisez [les notes de la 4.22.0](/fr/releases/hotloop-4-22-0/) pour tout ce qui a changé depuis la 4.21.1.

- Les quatre charts (`hotloop`, `hotloop-iot`, `hotloop-edge`, `hotloop-edge-relay`) sont à la 4.22.1, avec toutes les versions antérieures toujours dans l'index.
