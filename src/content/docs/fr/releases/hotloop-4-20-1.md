---
title: "Notes de version: HotLoop core 4.20.1"
description: "Ce qu'apporte HotLoop core 4.20.1, ce qui change à la mise à jour et ce qu'il faut lire avant de toucher une usine en production."
sidebar:
  label: "4.20.1"
---

Ceci est la construction multi-architecture de la [4.20.0](/fr/releases/hotloop-4-20-0/). Le code du produit est le même que celui de la 4.20.0 : la nouvelle interface web sur `/` et les outils MCP qui modifient la configuration. La 4.20.0 était la construction amd64, et `stable` a gardé les images arm qu'il détenait déjà.

La 4.20.1 construit le jeu complet : le Gateway pour amd64 et arm64, et Edge, IoT et l'Edge Relay pour amd64, arm64 et arm/v7. Lisez [les notes de la 4.20.0](/fr/releases/hotloop-4-20-0/) pour tout ce qui a changé depuis la 4.19.11.

- Les quatre charts (`hotloop`, `hotloop-iot`, `hotloop-edge`, `hotloop-edge-relay`) sont à la 4.20.1, avec toutes les versions antérieures toujours dans l'index.
