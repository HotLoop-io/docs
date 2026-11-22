---
title: "HotLoop Flow, le moteur de flux visuel"
description: "Un moteur de flux visuel pour l'atelier en un binaire Go, avec un plafond par file, des déploiements relisibles et vos flux Node-RED chargés tels quels."
---

**Câblez l'usine. Relisez-la comme du code.**

HotLoop Flow est un moteur de flux visuel pour l'atelier, écrit en Go. Vous reliez capteurs, brokers, automates et bases de données sur un canevas, et il exécute ces liaisons dans un seul binaire statique assez petit pour un Pi, avec un ordonnanceur qui ne s'effondre pas quand un capteur parle plus vite que ce qui le lit.

Ce que cela veut dire par une mauvaise nuit :

- **Chaque file a un plafond, et chaque message qui n'y tient pas est compté.** Un capteur rapide devant un historien lent s'accumule, bloque ou abandonne selon la politique choisie, et cela se voit sur un graphique avant de se voir sous la forme d'un OOM kill sans rien dans le journal.
- **Un historien arrêté pendant une heure ne vous coûte pas une heure.** Marquez une liaison comme durable : quand le nœud derrière elle cesse d'accepter des messages, ils passent sur disque dans l'ordre, et ils y sont encore après un `kill -9`. Tant que tout va bien, rien n'est écrit. [Stockage et retransmission](/fr/flow/store-and-forward/) a été éprouvé contre un vrai InfluxDB arrêté pendant dix minutes.
- **Chaque nœud tourne seul.** Une goroutine par nœud : un nœud Function qui mouline une grosse charge vous coûte un cœur, pas l'éditeur ni tous les autres flux de la machine.
- **Le fichier de flux se relit.** Il se charge et s'enregistre octet pour octet, la modification d'une propriété donne un diff d'une ligne, et chaque enregistrement est atomique avec trois sauvegardes derrière. Chaque déploiement est [un enregistrement](/fr/flow/deploys/) : qui, quand, pourquoi et les octets exacts, et deux d'entre eux se [comparent nœud par nœud](/fr/flow/deploys/#the-diff-reads-like-a-review), dans l'API, en ligne de commande et dans `git diff`. N'importe lequel peut être [restauré](/fr/flow/deploys/#put-it-back), identifiants compris.
- **Il ne démarre pas sans protection.** L'absence d'authentification est une erreur au démarrage, pas une valeur par défaut. Le nœud `exec` est livré désactivé, les nœuds de fichiers sont confinés au répertoire de données, et les identifiants sont chiffrés en AES-256-GCM sous une clé Argon2id.

Il exécute aussi vos flux existants tels quels. C'est [plus bas](/fr/flow/migrating-from-node-red/), parce que c'est une fonctionnalité, pas l'essentiel.

La version actuelle est `{{flow}}`. L'image est `ghcr.io/hotloop-io/hotloop-flow:{{flow}}` pour amd64 (arm64 suit à la prochaine version corrective), le dépôt Helm est `https://hotloop.io/hotloop-flow/`, et [Déployer Flow](/fr/flow/deploying/) couvre Kubernetes, Podman et Quadlet. Il compte 117 types de nœuds pour les messages et 39 pour les diagrammes FlowLab. L'usage domestique et de laboratoire est gratuit, tout comme celui des écoles, des associations et des administrations, et l'usage via EmberNet, une plateforme partenaire, y compris professionnel, est sans restriction, sous le HotLoop Source License Agreement.

## Les chiffres

Uniquement des chiffres absolus, pour que vous puissiez les vérifier sur votre propre matériel. Trois exécutions chacun, et la plage est ce qui est affiché.

| Mesure | Résultat |
|---|---|
| Binaire, linux/amd64, statique | **41.7 MB** |
| Image, amd64 | **45.64 MB** |
| Du démarrage à la première requête servie | **0.05 s** |
| RSS, au repos | **16.4 à 16.7 MiB** |
| RSS, pic sous la charge HTTP ci-dessous | **26.4 à 28.5 MiB** |
| HTTP, flux de cinq nœuds, 8 connexions | **13.0k à 15.3k req/s** |
| Latence HTTP p50 / p99 | **0.39 à 0.41 ms / 1.78 à 4.03 ms** |
| Moteur, chaîne de cinq nœuds, sans E/S | **2.20 à 3.11 µs par message**, 3.9 KB alloués |

Sachez ce que ces chiffres ne sont pas. Le chiffre HTTP traverse toute la pile HTTP exprès, parce que c'est ce que voit un client de votre flux. Et sous saturation, tout environnement d'exécution met en file, et la file domine la queue de distribution, c'est pourquoi p99 varie plus que p50 d'une exécution à l'autre.

### Sur un Raspberry Pi 5

Le même flux et les mêmes commandes, le 2026-10-22, sur un Raspberry Pi 5 Model B (8 GB, quatre cœurs Cortex-A76) dont l'horloge est plafonnée à 2.0 GHz, avec l'image arm64 publiée `2.2.0` comme pod, sans rien d'autre sur le nœud hormis les DaemonSets du cluster. Trois exécutions, la plage est affichée.

| Mesure | Résultat |
|---|---|
| Du démarrage à la première requête servie | **0.10 à 0.46 s** |
| RSS, au repos | **88.0 à 88.3 MiB** |
| RSS, pic sous la charge HTTP | **40.3 à 40.5 MiB** |
| HTTP, flux de cinq nœuds, 8 connexions, 30 s | **13.2k à 13.4k req/s** |
| Latence HTTP p50 / p99 | **0.48 ms / 2.72 à 2.78 ms** |
| Moteur, chaîne de cinq nœuds, sans E/S | **7.74 à 8.15 µs par message**, 4.0 KB alloués |
| HTTP, la même commande tenue 600 s | **11.4k req/s**, p50 0.58 ms, p99 3.00 ms |

La dernière ligne est la plus honnête pour une machine qui reste chargée. La carte a atteint sa limite de température douce en moins d'une minute, a commencé à brider vers la deuxième minute, et est restée entre 83 et 86 C avec l'horloge entre 1.5 et 1.7 GHz pour le reste. La [page des benchmarks](/fr/flow/benchmarks/#results-on-a-raspberry-pi-5) donne l'essai complet sur le Pi.

La [page des benchmarks](/fr/flow/benchmarks/) donne la méthode et les réserves.

Vous l'utilisez dans une usine ? [Utiliser HotLoop en entreprise](/fr/business/) couvre la licence et la façon de nous joindre.
