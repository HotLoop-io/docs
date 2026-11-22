---
title: "Installer HotLoop"
description: "Comment s'installe chaque produit HotLoop : Helm sur k3s ou Kubernetes, ou Podman Quadlet sur un boîtier qui suit le tag stable et se met à jour seul."
sidebar:
  label: "Installation"
---

Il y a deux façons d'exécuter un produit HotLoop pour de bon : Helm sur k3s ou tout Kubernetes, ou Podman avec Quadlet sur un boîtier qui n'est pas dans un cluster. Pas de Docker, pas de Compose, et pas de `podman run` lancé à la main depuis un shell qui meurt avec la session. Un simple `podman run` va bien pour essayer, et la page de Flow le dit, mais ce n'est pas une installation.

## Choisir la voie

| Vous avez | Utilisez | Page |
|---|---|---|
| Un cluster k3s ou Kubernetes | Helm | [k3s et Helm](/fr/install/helm/) |
| Un Pi, un NUC ou un petit PC industriel, sans cluster | Podman Quadlet | [Podman Quadlet](/fr/install/quadlet/) |
| L'un ou l'autre, et vous voulez savoir comment se comportent les mises à jour | | [La mise à jour automatique de :stable](/fr/install/auto-update/) |

## Ce que vous pouvez installer aujourd'hui

| Produit | Dernière version | Helm | Quadlet | Pour commencer |
|---|---|---|---|---|
| [HotLoop IoT](/fr/iot/overview/) | {{hotloop}} | Oui | Oui | [Installer IoT](/fr/iot/install/) |
| [HotLoop Edge](/fr/edge/overview/) | {{hotloop}} | Oui | Oui | [Installer Edge](/fr/edge/install/) |
| [HotLoop Gateway](/fr/gateway/overview/) | {{hotloop}} | Oui | Oui | [Installer Gateway](/fr/gateway/install/) |
| [HotLoop Edge Relay](/fr/edge-relay/overview/) | {{hotloop}} | Oui | Oui | [Installer Edge Relay](/fr/edge-relay/install/) |
| [HotLoop Flow](/fr/flow/overview/) | {{flow}} | Oui | Oui | [Installer Flow](/fr/flow/install/) |
| [HotLoop Cascade](/fr/cascade/overview/) | {{cascade}} | Oui, sans connexion | Oui, sans connexion, voir [Cascade avec Podman Quadlet](/fr/cascade/quadlet/) | [Exécuter Cascade](/fr/cascade/running/) |
| [HotLoop for CODESYS](/fr/codesys/overview/) | {{codesys}} | Oui, ou l'App Store EmberCORE | Non | [Installer HotLoop for CODESYS](/fr/codesys/install/) |
| [HotLoop Transmitter](/fr/transmitter/overview/) | 1.1.0 | Non, c'est une bibliothèque CODESYS | Non, c'est une bibliothèque CODESYS | [Installer Transmitter](/fr/transmitter/install/) |

HotLoop IoT, Edge, Gateway et Edge Relay sortent d'un même tag, en bloc, donc ils partagent un numéro de version. Flow, Cascade, HotLoop for CODESYS et Transmitter ont le leur. Les unités Quadlet d'IoT, Edge et Gateway demandent Podman 5.0 ou plus, et celle du relais a tourné sur Podman 4.9.3. Raspberry Pi OS Bookworm fournit la 4.3, qui n'a pas du tout Quadlet : un Pi veut donc Trixie ou plus récent.

## Installer depuis l'App Store EmberNet

Sur EmberNet, l'installation, c'est l'App Store. Il exécute pour vous le même chart Helm, sur le nœud que vous choisissez : pas de chart à ajouter, pas de fichier de valeurs, pas de ligne de commande. Nous l'avons chronométré sur un vrai nœud : 1 minute 10 secondes entre l'ouverture de l'App Store et les mesures en direct sur le tableau.

<figure>
<video controls preload="none" playsinline width="1920" height="1080" poster="/embernet-install/poster.webp" aria-label="Installation de HotLoop Gateway depuis l'App Store EmberNet, du départ aux données en direct en 1 minute 10 secondes" style="width:100%;height:auto;aspect-ratio:16/9">
<source src="/embernet-install/install-hotloop-on-embernet.mp4" type="video/mp4" />
<source src="/embernet-install/install-hotloop-on-embernet.webm" type="video/webm" />
Votre navigateur ne peut pas lire cette vidéo. <a href="/embernet-install/install-hotloop-on-embernet.mp4">La télécharger</a>.
</video>
<figcaption>Une seule prise, en temps réel. L'horloge tourne de l'ouverture de l'App Store jusqu'à ce que HotLoop lise des données, et l'attente de l'installation est montrée en vitesse quadruple.</figcaption>
</figure>

1. Dans EmberCORE, ouvrez l'**App Store**.

   ![L'App Store EmberCORE avec ses filtres Catégorie, Éditeur et Tri](/embernet-install/hotloop-install-01-app-store.webp)

2. Choisissez la catégorie **HotLoop**, puis appuyez sur **Déployer** sur HotLoop Gateway. Chaque produit HotLoop a sa propre carte dans cette catégorie.

   ![L'App Store filtré sur la catégorie HotLoop, avec les cartes HotLoop Cascade, Edge, Edge Relay, Flow, Gateway et IoT](/embernet-install/hotloop-install-02-hotloop-apps.webp)

3. Choisissez le nœud, puis appuyez de nouveau sur **Déployer**.

   ![La boîte de dialogue de déploiement de HotLoop Gateway avec un nœud choisi](/embernet-install/hotloop-install-03-choose-node.webp)

4. EmberCORE confirme l'installation, et HotLoop Gateway apparaît sous **Applications en cours** avec sa version et son adresse Flux.

   ![Le message d'EmberCORE indiquant que HotLoop Gateway s'installe sur le nœud](/embernet-install/hotloop-install-04-installing.webp)

   ![Applications en cours avec HotLoop Gateway en fonctionnement, sa version, son adresse Flux en ligne et les boutons Lancer, Ouvrir, Shell du pod, Shell de l'appareil et Supprimer](/embernet-install/hotloop-install-05-running.webp)

5. Appuyez sur **Lancer**. EmberCORE vous connecte, et HotLoop s'ouvre avec l'état de la machine déjà en lecture : la première chose que vous voyez, ce sont des données en direct.

   ![HotLoop Gateway ouvert dans EmberCORE et connecté, avec un appareil, 4 tags sur 4 qui remontent et aucune alarme](/embernet-install/hotloop-install-06-hotloop-signed-in.webp)

6. Épinglez les tags qui comptent pour vous, et ils deviennent des jauges en direct sur le tableau.

   ![La boîte de dialogue pour épingler des tags, avec les tags de processeur, de mémoire et de disque du nœud](/embernet-install/hotloop-install-07-pin-a-tag.webp)

   ![Le tableau HotLoop avec des jauges en direct pour le processeur, la mémoire et le disque du nœud](/embernet-install/hotloop-install-08-board-live.webp)

La documentation EmberNet déroule la même installation page par page : [HotLoop Gateway sur EmberNet](https://docs.embernet.ai/docs/app-store/hotloop).

## Avant de le mettre sur une vraie usine

- Lisez [le sas d'écriture](/fr/gateway/write-gate/). Il est identique dans chaque produit, et c'est pour cela que rien ne déplace une machine que vous n'avez pas armée.
- Mettez la base de données sur un SSD USB et non sur la carte SD, si c'est un Pi. L'historique écrit toute la journée, tous les jours, et les cartes SD meurent exactement de cela.
- Sauvegardez la clé des mots de passe d'appareils. Elle n'est ni dans la base ni dans une sauvegarde, donc elle fait partie de vos données. [Sauvegardes](/fr/iot/backup/) explique comment.
- Faites une sauvegarde avant de faire monter un site d'un produit ou de mettre à niveau entre deux versions, et copiez-la hors du boîtier.
