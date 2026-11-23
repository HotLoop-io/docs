---
title: "Notes de version : HotLoop Flow 2.7.1"
description: "Ce que apporte HotLoop Flow 2.7.1, ce qui change à la mise à jour et ce qu'il faut lire avant de toucher à une usine en marche."
sidebar:
  label: "2.7.1"
---

HotLoop Flow 2.7.1 est la 2.7.0 avec l'image arm64 en plus, et rien d'autre. La 2.7.0 est sortie en amd64 seulement pour arriver d'abord en production et passer stable, et voici le petit pas qui construit les deux. Le code, le chart, les réglages et vos flows ne changent pas.

## Ce qui a changé

- L'image est de nouveau construite pour linux/amd64 et linux/arm64. Les tags `2.7.1`, `2.7` et `2` contiennent les deux.
- Le README et les pages d'installation nomment la 2.7.1 et parlent d'amd64 et d'arm64, comme avant la 2.7.0.

## Nouveaux réglages

Aucun.

## Mise à jour

Un simple `helm upgrade` vers l'image et le chart de la 2.7.1, ou le nouveau tag dans votre unité Quadlet. Si vous êtes sur arm64 et êtes resté en 2.6.0 pendant que la 2.7.0 était amd64 uniquement, c'est votre passage à FlowLab : lisez les notes de la 2.7.0 pour savoir ce que c'est et ce que ce n'est pas encore. Rien ne se passe au premier démarrage et rien n'est à migrer.

Image : `ghcr.io/hotloop-io/hotloop-flow:2.7.1`, linux/amd64 et linux/arm64. Chart : `https://hotloop.io/hotloop-flow/`. Le README à ce tag a le reste, avec des images : https://github.com/HotLoop-io/hotloop-flow/blob/v2.7.1/README.md
