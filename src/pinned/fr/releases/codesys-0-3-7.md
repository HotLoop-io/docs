---
title: "Notes de HotLoop for CODESYS 0.3.7"
description: "Chart 0.3.7 de HotLoop for CODESYS : enveloppe HotLoop 4.22.0 et exécute le provisioner 0.3.2."
sidebar:
  label: "0.3.7"
---

## Ce qui a changé

0.3.7 est dans l'index `{{codesysChartRepo}}`, publié le 2026-11-19.

- **Il enveloppe HotLoop 4.22.0,** qui donne à chaque appareil OPC UA PubSub d'une même adresse et d'un même port un socket partagé, si bien que deux écouteurs peuvent partager un port UDP.
- **Le provisioner accepte deux écouteurs sur un port.** Le provisioner 0.3.2 ne refuse plus un profil qui place deux appareils `opcua-pubsub` sur un même port.

Ce que cela change pour vous : un profil avec plusieurs éditeurs PubSub sur un même port s'installe et se lit.

## Ce qui a été vérifié

Une installation neuve avec un profil de l'appareil propre du runtime, deux écouteurs PubSub sur le même port UDP, une alarme et un écran, à côté d'un vrai runtime CODESYS Control for Linux SL 4.22.0.0 exécutant la bibliothèque Transmitter : tout a été créé sans geste manuel, les variables de l'automate se lisaient bien, l'alarme s'est déclenchée sur la valeur propre de l'automate, et les deux écouteurs se lisaient connectés. Face à un vrai éditeur dans les deux encodages, chacun des 32 champs se lisait bien et égal à l'automate. Les deux pods supprimés et le runtime redémarré : HotLoop est revenu de lui-même avec ses trois appareils.
