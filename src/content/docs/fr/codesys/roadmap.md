---
title: "Feuille de route de HotLoop for CODESYS"
description: "Ce que HotLoop for CODESYS a construit, publié et fait tourner sur du matériel réel."
sidebar:
  label: "Feuille de route"
editUrl: false
---

Voici la liste de ce qui est fait et de ce qui reste, dans l'ordre où cela se fait. Elle ne promet rien qui ne soit dans le code ou dans un plan de test, et [Où en est le produit](/fr/codesys/where-it-stands/) dit jusqu'où il a tourné.

## Construit

- [x] Un chart autour de HotLoop Edge avec des valeurs par défaut pour un runtime sur un nœud : SQLite, un réplica, des tolérances qui gardent les deux pods en cas de perte du plan de contrôle.
- [x] Un provisioner qui applique un profil et le maintient correct, avec une révision qui protège ce qu'une personne a modifié.
- [x] Un profil qui porte une liste d'appareils de tout protocole que HotLoop parle, de sorte qu'un listener revienne configuré sans automate.
- [x] L'appareil, les tags, l'alarme et l'écran créés sans étape manuelle, face à un runtime CODESYS Control for Linux SL 4.22.0.0 dans un conteneur.
- [x] Reprise après redémarrage du runtime sans intervention, en environ 88 secondes.
- [x] Une connexion signée depuis le tableau de bord EmberCORE, avec les refus.

## Livré

- [x] HotLoop 4.22.0, la version qu'enveloppe le chart.
- [x] Le chart publié sur `https://hotloop.io/hotloop-codesys/`, 0.3.8 étant le plus récent.
- [x] L'image du provisioner publique, donc récupérable sans connexion, 0.3.3.
- [x] Une image multi-architecture du provisioner, amd64 et arm64, depuis 0.3.3 et le chart 0.3.8.
- [x] Deux listeners OPC UA PubSub sur un même port UDP, avec HotLoop 4.22.0 et le chart 0.3.7.
- [x] [Notes de version](/fr/releases/codesys-0-3-10/) pour chaque chart, de 0.3.0 à 0.3.10.

## Éprouvé sur machine physique

- [x] Exécuté sur machine physique sans système d'exploitation (2026-11-17), y compris une installation depuis la vraie page de l'App Store comme le fait le personnel, k3s v1.35.7, un nœud qui perd réellement sa liaison avec le plan de contrôle en gardant les pods, un téléchargement depuis l'IDE CODESYS pendant que le runtime reste actif, un runtime sur le réseau propre de l'hôte à côté du pod HotLoop sur un nœud, et un runtime avec gestion des utilisateurs activée et un endpoint OPC UA sécurisé par certificat.

## À construire

- [ ] Plus d'un écran dans un profil.
