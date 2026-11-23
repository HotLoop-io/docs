---
title: "Notes de version : HotLoop Flow 2.8.0"
description: "Ce que apporte HotLoop Flow 2.8.0, ce qui change à la mise à jour et ce qu'il faut lire avant de toucher à une usine en marche."
sidebar:
  label: "2.8.0"
---

HotLoop Flow 2.8.0 ajoute quatre choses à FlowLab, l'onglet de diagrammes pour les bancs d'essai et les enregistreurs de données : des nœuds d'analyse, un nœud d'acquisition de données pour le matériel NI, une sortie MQTT qui garde ce que le broker rate et un journal TDMS. Les flows fonctionnent exactement comme avant, un fichier de flows que vous avez aujourd'hui se charge et s'enregistre octet pour octet, et un onglet qui n'est pas un diagramme n'en voit rien.

## Nouveautés

**Analyse.** Quatre nœuds travaillent sur un tableau de mesures : statistiques (moyenne, RMS, minimum, maximum et écart type), intégrale (l'aire sous le tableau par la règle des trapèzes, en un seul nombre ou en aire cumulée), dérivée (la pente à chaque échantillon) et un filtre de Butterworth d'ordre 1 à 10 en passe-bas, passe-haut, passe-bande ou coupe-bande, avec la fréquence de coupure en hertz.

**Un nœud d'acquisition de données.** `read DAQ task` lit des échantillons du matériel NI, comme un châssis CompactDAQ, via le Device Server gRPC de NI. Le client est aussi petit que possible : le HTTP/2 propre à Go avec des messages écrits à la main, si bien que le binaire n'a pas pris de bibliothèque gRPC.

**Une sortie MQTT qui ne perd rien.** `mqtt out` publie par le broker que configure le fichier de flows, la même connexion que celle des nœuds MQTT. Marquez-la durable et un message que le broker rate est écrit sur disque avant que le nœud ne termine, puis envoyé, le plus ancien d'abord, quand le broker revient, même après un redémarrage. Rien ne double ce qui attend devant lui. Sa sortie d'envoi indique si le message est parti directement.

**Un journal TDMS.** `log to TDMS file` ajoute un enregistrement à un fichier TDMS, un canal par champ, et le fichier s'ouvre dans les outils qu'un laboratoire a déjà. Un fichier dont la dernière écriture a été coupée par une panne de courant se lit encore jusqu'à la dernière valeur complète.

## Ce qui a changé

- Il y a maintenant 28 types de nœuds dans la section FlowLab de la palette, contre 21, et le README le dit.
- Une étape qui a échoué une fois dans l'exécution de la 2.7.1 n'a rien affiché, et la cause était le test du collecteur qui comparait un intervalle avant que le journal qu'il lit ne le contienne en entier ; il attend désormais l'intervalle complet. Deux autres tests ont été faits pour attendre ce qu'ils vérifient. Rien de tout cela n'est livré.
- Les images du README ont été refaites pour que la barre du haut indique v2.8.0.
- Les tailles du binaire et de l'image dans le README ont été relues pour cette version.

## Nouveaux réglages

Aucun.

## Mise à jour

Sur amd64, un simple `helm upgrade` vers l'image et le chart 2.8.0, ou le nouveau tag dans votre unité Quadlet. Sur arm64, restez où vous êtes jusqu'à la 2.8.1, qui est cette version avec arm64 en plus et rien d'autre. Il ne se passe rien au premier démarrage et rien n'est à migrer.

Image : `ghcr.io/hotloop-io/hotloop-flow:2.8.0`, linux/amd64 uniquement. Nous construisons d'abord l'amd64, le laissons s'établir comme stable en production, puis une petite 2.8.1 sans rien d'autre ajoute l'arm64. D'ici là, le tag `2` contient la nouvelle image amd64 et l'image arm64 de la 2.7.1, si bien qu'une machine arm64 qui suit `2` ou `2.7` garde ce qu'elle a, et une machine figée sur `2.8.0` a besoin de l'amd64. Chart : `https://hotloop.io/hotloop-flow/`. Le README de ce tag contient le reste, avec des images : https://github.com/HotLoop-io/hotloop-flow/blob/v2.8.0/README.md
