---
title: "HotLoop for CODESYS : présentation"
description: "HotLoop à côté d'un runtime CODESYS : les écrans et alarmes d'un automate CODESYS, lus par le serveur OPC UA du runtime, sans rien installer dans CODESYS."
sidebar:
  label: "Présentation"
editUrl: false
---

HotLoop for CODESYS, c'est HotLoop qui tourne sur le même nœud qu'un runtime CODESYS. Il lit les variables de l'automate par le serveur OPC UA du runtime, les met sur des écrans qui fonctionnent sur un PC de panneau, un téléphone ou un écran mural, lève des alarmes dessus et garde l'historique. Rien n'est installé dans CODESYS et rien n'écrit dans l'automate. C'est l'écran que vous construiriez autrement dans CODESYS WebVisu, dessiné hors du runtime. Ce que cela vous apporte : les opérateurs ont un écran sans téléchargement vers l'automate, et l'automate gagne une seconde paire d'yeux qui ne dépend de rien d'autre sur le nœud.

C'est l'un des huit produits HotLoop, avec sa propre ligne de versions. Le chart le plus récent est le 0.3.8, publié le 2026-11-16. En dessous se trouve HotLoop Edge, donc tout ce que disent les [pages Edge](/fr/edge/overview/) est vrai ici aussi.

![L'écran Line 2 : quatre cartes de valeur, une jauge, une courbe de quinze minutes et une liste d'alarmes](/codesys/screen.png)
![La même, en mode sombre](/codesys/screen-dark.png)

C'est un vrai essai : l'interface par défaut de HotLoop lisant un runtime CODESYS Control for Linux SL 4.22.0.0. Le programme de l'automate est le programme de démonstration de HotLoop, donc les chiffres sont ceux de la démo. Les libellés (Line 2, Mixer temperature, Riverside Bottling) sont inventés et posés par le [profil](/fr/codesys/profile/).

## Les trois parties

| Partie | Ce que c'est | Où elle se trouve |
|---|---|---|
| Le chart, `hotloop-codesys` | Une enveloppe autour de `hotloop-edge` avec des valeurs par défaut pour un runtime sur un nœud : SQLite, un réplica, et ce dont on n'a pas besoin à côté d'un automate désactivé. Chaque correctif des charts HotLoop lui parvient. | `https://hotloop.io/hotloop-codesys/` |
| Le provisioner | Un seul binaire Go statique qui applique un profil à HotLoop et le maintient correct. Il ne détient aucun profil. | `ghcr.io/hotloop-io/hotloop-provision` |
| Un profil | Un fichier JSON : l'appareil, les variables à conserver, les alarmes et un écran. La seule entrée que vous fournissez. | Un Secret dans le namespace de l'installation, [décrit ici](/fr/codesys/profile/) |

## Comment il lit l'automate

CODESYS ne documente qu'une façon pour un tiers de lire les variables d'un contrôleur : le serveur OPC UA du runtime. L'automate publie ce que vous voulez voir avec une Symbol Configuration dans l'IDE, et HotLoop lit ces variables par les noms que le programmeur leur a donnés, comme `Application.GVL_Line.rTemp`, pas par un node id. La Symbol Configuration est la seule modification du projet de l'automate. Le protocole de canal du CODESYS Gateway n'est pas documenté pour les tiers, et ceci ne le parle pas.

La lecture est faite par le connecteur CODESYS de HotLoop core, c'est-à-dire le driver OPC UA plus ce dont un automate CODESYS a besoin en plus : découverte de ce que l'application exporte, des types qu'elle a, tableaux et structures parcourus jusqu'à un point par champ, reconnexion sans intervention après un redémarrage ou un téléchargement, et chaque requête ramenée aux limites que publie le runtime. La [page des protocoles](/fr/iot/protocols/) donne la référence du connecteur à partir de HotLoop 4.19.4, et dit contre quoi il a été vérifié et contre quoi il ne l'a pas été.

## Ce qu'il fait tout seul

Quand HotLoop et le runtime du nœud répondent tous deux, le provisioner met en place l'appareil du profil, ses variables, ses alarmes et son écran. Puis il regarde de nouveau toutes les cinq minutes. Une variable du profil que l'automate a gagnée depuis est ajoutée. Une que l'automate n'a plus se lit comme mauvaise avec la raison donnée par le serveur. L'écran et les alarmes sont créés quand ils manquent et ne sont remplacés que lorsque le `revision` du profil est supérieur à celui qui les a créés, donc une modification faite par une personne survit jusqu'à ce qu'un profil plus récent soit livré exprès.

## Ce qu'il ne fera pas

- **Il n'écrira pas dans votre automate.** Chaque tag que met en place le provisioner est en lecture seule, et le profil n'en marque aucun comme inscriptible. Une personne peut armer un tag plus tard, et alors la [barrière d'écriture](/fr/gateway/write-gate/) et les propres droits de symbole de l'automate ont leur mot à dire.
- **Il ne mettra rien dans le runtime.** Pas de bibliothèque, pas de tâche, pas d'agent.
- **Il n'a pas besoin d'un pod de base de données.** SQLite sur le stockage propre du nœud, un réplica.
- **Il est conçu pour garder ses écrans malgré une liaison perdue.** Les deux pods tolèrent un nœud injoignable ou pas prêt sans limite de durée, et les tolérances sont dans le chart. [Où en est le produit](/fr/codesys/where-it-stands/) dit ce qui a tourné sur un vrai nœud.

## Où aller ensuite

[Installez-le](/fr/codesys/install/), lisez ce que contient un [profil](/fr/codesys/profile/), ou voyez [où en est le produit](/fr/codesys/where-it-stands/) et la [feuille de route](/fr/codesys/roadmap/). Vous l'utilisez dans une usine ? [Utiliser HotLoop en entreprise](/fr/business/) couvre les licences et la façon de nous joindre.
