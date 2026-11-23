---
title: "Notes de version: HotLoop core 4.21.1"
description: "Ce qu'apporte HotLoop core 4.21.1, ce qui change à la mise à jour et ce qu'il faut lire avant de toucher une usine en production."
sidebar:
  label: "4.21.1"
---

Ceci est la construction multi-architecture de la [4.21.0](/fr/releases/hotloop-4-21-0/). Le code du produit est le même que celui de la 4.21.0 : connexion X.509 pour le serveur OPC UA, mots de passe de 72 octets, politiques de sécurité obsolètes désactivées par défaut et import d'alarmes CODESYS élargi. La 4.21.0 était la construction amd64, et `stable` a gardé les images arm qu'il détenait déjà.

La 4.21.1 construit le jeu complet : le Gateway pour amd64 et arm64, et Edge, IoT et l'Edge Relay pour amd64, arm64 et arm/v7. Lisez [les notes de la 4.21.0](/fr/releases/hotloop-4-21-0/) pour tout ce qui a changé depuis la 4.20.2, y compris le fait que `Basic128Rsa15` et `Basic256` sont aussi désactivées lors des mises à jour.

- Les quatre charts (`hotloop`, `hotloop-iot`, `hotloop-edge`, `hotloop-edge-relay`) sont à la 4.21.1, avec toutes les versions antérieures toujours dans l'index.
