---
title: "Notes de version : HotLoop Cascade 0.1.2"
description: "Le contenu de HotLoop Cascade 0.1.2, ce qui change à la mise à jour et ce qu'il faut lire avant de toucher à une usine en production."
sidebar:
  label: "0.1.2"
---

## Ce dont il s'agit

0.1.2 est un correctif de build et rien d'autre. Le code est le même que 0.1.1, et tout ce que vous exécutez aussi : le chart, les unités Quadlet, les réglages, la base de données.

Cascade est maintenant construit et publié sur Podman de bout en bout, et l'image contient exactement amd64 et arm64.

## Mise à jour depuis 0.1.1

Rien à faire. `helm upgrade` vers 0.1.2, ou laissez `:stable` faire avancer les unités Quadlet. Pas de migrations, pas de nouveaux réglages, et la clé et vos flux de travail restent où ils étaient.
