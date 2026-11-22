---
title: "Où en est HotLoop for CODESYS"
description: "Contre quoi HotLoop for CODESYS a tourné sur du matériel réel, et ce qui est publié."
sidebar:
  label: "Où il en est"
editUrl: false
---

Cette page décrit ce qui est publié et jusqu'où HotLoop for CODESYS a tourné.

## Ce qui est sorti

- **Le chart.** `hotloop-codesys` 0.3.8 est dans l'index à `https://hotloop.io/hotloop-codesys/`, publié le 2026-11-19, avec toutes les versions précédentes toujours à côté. Il enveloppe HotLoop 4.22.0. Installez la 0.3.8 : [les notes de version](/fr/releases/codesys-0-3-5/) disent ce que chaque chart a changé.
- **L'image du provisioner.** `ghcr.io/hotloop-io/hotloop-provision` en 0.3.3 se récupère sans connexion, pour amd64 et pour arm64, et le chart la fait tourner.
- **La fiche App Store.** Elle est dans l'App Store EmberCORE, et EmberNet l'installe sur votre tenant.

## Jusqu'où il a tourné

Le chart sur un nœud k3s avec des valeurs au format du Store, un vrai runtime CODESYS Control for Linux SL 4.22.0.0 sur le même nœud exécutant un programme de démonstration, et une image HotLoop Edge.

- L'appareil, ses tags (aucun inscriptible), son alarme et son écran sont apparus sans aucune étape manuelle.
- Chaque valeur s'est lue correctement et a bougé.
- Les pods sont revenus après la suppression d'un pod.
- L'installation s'est lue comme mauvaise avec la raison « the PLC's runtime is not answering » pendant un redémarrage du runtime, et est revenue seule environ 88 secondes plus tard.
- Une connexion signée depuis le tableau de bord a connecté une personne comme opérateur ou comme administrateur, et une mauvaise application, un mauvais tenant, une assertion expirée, un mauvais émetteur et une assertion altérée ont chacun été refusés.
- Le chart publié se rend depuis l'index en ligne avec Helm.

Le connecteur en dessous, le driver CODESYS de HotLoop core, est vérifié en direct contre un runtime CODESYS Control for Linux SL 4.22.0.0, en lecture et en écriture, et sur machine physique sans système d'exploitation (2026-11-17). Les écritures existent dans le connecteur, et ce produit ne les active jamais.

Tout cela a aussi tourné sur machine physique sans système d'exploitation (2026-11-17).

## Ce qu'un profil ne peut pas encore faire

Un profil crée un écran. Il crée un appareil à partir de `device`, ou plusieurs de n'importe quel protocole à partir de `devices`, et il n'y a aucun moyen d'y marquer une variable comme inscriptible, volontairement.
