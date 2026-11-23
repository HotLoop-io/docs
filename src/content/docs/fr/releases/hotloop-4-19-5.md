---
title: "Notes de version: HotLoop core 4.19.5"
description: "Ce qu'apporte HotLoop core 4.19.5, ce qui change à la mise à jour et ce qu'il faut lire avant de toucher une usine en production."
sidebar:
  label: "4.19.5"
---

Ceci est la construction multi-architecture de la [4.19.4](/fr/releases/hotloop-4-19-4/), et rien d'autre. Le code est celui du même commit avec la version incrémentée : aucun correctif, aucune fonctionnalité, aucun changement de comportement.

La 4.19.4 a été construite pour amd64 seul, afin d'atteindre la production et de passer en stable avant que les images arm soient construites. La 4.19.5 construit le jeu complet : le Gateway pour amd64 et arm64, et Edge, IoT et l'Edge Relay pour amd64, arm64 et arm/v7. Un boîtier arm passe des images qu'il faisait tourner au code de la 4.19.4 en téléchargeant `stable`.

Lisez [les notes de la 4.19.4](/fr/releases/hotloop-4-19-4/) pour tout ce qui a changé depuis la dernière version publiée.

- Les quatre charts (`hotloop`, `hotloop-iot`, `hotloop-edge`, `hotloop-edge-relay`) sont à la 4.19.5, avec toutes les versions antérieures toujours dans l'index.
- La prochaine version qui porte des changements le remet sur `linux/amd64`.
