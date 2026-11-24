---
title: "Notes de version: HotLoop core 4.24.3"
description: "Ce qu'apporte HotLoop core 4.24.3, ce qui change à la mise à jour et ce qu'il faut lire avant de toucher une usine en production."
sidebar:
  label: "4.24.3"
---

La 4.24.3 porte tout ce qui est dans la [4.24.2](/fr/releases/hotloop-4-24-2/) sur chaque carte pour laquelle nous construisons : Shelly de toute génération, caméras ONVIF, Arduino via Firmata, mots de passe OPC UA de toute longueur, une file de transfert qui se vide derrière une liaison lente, `--version` qui nomme son commit, et une installation par défaut de HotLoop Edge qui démarre.

La Gateway tourne en amd64 et arm64, et Edge, IoT et l'Edge Relay tournent en amd64, arm64 et arm/v7, de sorte que la même version couvre vos serveurs, vos Pi et vos anciennes passerelles ARM. Lisez les [notes de la 4.24.2](/fr/releases/hotloop-4-24-2/) pour tout ce qui est nouveau depuis la 4.24.0.

- Les quatre charts (`hotloop`, `hotloop-iot`, `hotloop-edge`, `hotloop-edge-relay`) sont en 4.24.3, avec toutes les versions précédentes toujours dans l'index.
- Mettez à jour comme d'habitude : un `helm upgrade` vers le chart 4.24.3, ou le nouveau tag dans votre unité Quadlet. Rien à migrer.
