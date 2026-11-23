---
title: "Notes de version : HotLoop Flow 2.5.0"
description: "Ce que apporte HotLoop Flow 2.5.0, ce qui change à la mise à jour et ce qu'il faut lire avant de toucher à une usine en marche."
sidebar:
  label: "2.5.0"
---

HotLoop Flow 2.5.0 est un nouvel éditeur. Mêmes flux, même moteur, mêmes raccourcis, et il a enfin l'air de faire partie de HotLoop au lieu de venir d'une autre entreprise. Si vous câblez des usines pour gagner votre vie, vous obtenez un écran qui colle à ce que vous faites toute la journée : poser la chose sur le canevas, la déployer et la regarder tourner.

## Nouveautés

**L'éditeur ressemble à HotLoop.** Mêmes couleurs, même typographie, clair et sombre selon votre système, avec un bouton dans la barre du haut quand vous voulez l'autre. L'orange veut dire « vous pouvez cliquer ici » et rien d'autre. Il ne signifie ni un avertissement, ni une sélection, ni un chemin pris par un message.

**Le débogage et le runtime sont passés sous le canevas.** Le journal de débogage et la table Runtime se trouvent maintenant dans un dock le long du bas, côte à côte, si bien qu'une ligne de débogage dispose de toute la largeur du canevas au lieu d'une colonne étroite où chaque charge utile passait à la ligne quatre fois. La table Runtime juste à côté compte toujours ce qui est entré et sorti de chaque nœud, avec une barre pour indiquer à quel point chaque file est pleine. Ce que cela change pour vous : vous voyez arriver une valeur et le nœud d'où elle vient sans défiler ni plisser les yeux.

**Historique, Tests et Trace restent à droite.** Celui dans lequel vous travaillez remonte en haut. Appuyez sur Déployer et la relecture est la première chose de cette colonne, avec la zone de note dessous. Cliquez sur Trace sur une ligne de débogage et la trace prend la première place.

**Une trace est bleue maintenant.** Le chemin pris par un message est dessiné en bleu sur le canevas, avec le temps passé dans chaque nœud. La relecture avant un déploiement marque les nœuds ajoutés, modifiés, déplacés et supprimés en vert, ambre, bleu et rouge. Ce que cela change pour vous : vous distinguez maintenant une trace d'une sélection d'un coup d'œil, car elles ne partagent plus la même couleur.

**Une page de connexion qui ressemble au reste de HotLoop.** Une carte, le vrai logo et les mêmes champs. Derrière le tableau de bord EmberCORE, elle vous dit toujours d'entrer par le tableau de bord.

**La recherche affiche son raccourci.** Le bouton indique Ctrl F, pour que vous n'ayez pas à deviner.

**Un double-clic juste après une modification fonctionne.** L'éditeur vérifie les types de vos liaisons un instant après chaque modification, et il redessinait toutes les liaisons même quand la réponse n'avait pas changé, si bien qu'un double-clic sur un nœud pouvait tomber sur une liaison en train d'être remplacée en plein clic et ne rien faire. Il ne redessine plus que lorsque quelque chose a réellement changé.

## Ce qui a changé

Rien concernant vos flux. Un fichier de flux se charge et s'enregistre octet pour octet, exactement comme avant. Le câblage, le glisser, l'annulation, le copier-coller, Ctrl+Entrée, Échap, le déplacement aux flèches, le zoom, la sélection par cadre et le glisser depuis la palette fonctionnent comme avant, et chacun des 60 tests de navigateur passe sans qu'une seule de leurs lignes ait été touchée. Nous avons aussi parcouru chaque écran et chaque boîte de dialogue en 2.4.0 et sur cette version avec le même flux d'usine, 48 états, et rien n'a disparu.

Ce qui est différent volontairement : les panneaux de débogage et de runtime sont passés dans le dock, le message vide du panneau Tests dit désormais « dock de débogage » parce que c'est là que se trouve le journal, une trace et une relecture sont dessinées en bleu et dans les couleurs d'état, le bouton de thème indique Sombre ou Clair, et la recherche affiche son raccourci.

**Une chose est plus lente, et nous préférons le dire plutôt que vous la découvriez.** La page reste blanche un instant jusqu'à ce que l'éditeur soit chargé, alors que l'ancien dessinait d'abord son cadre. Nous l'avons mesuré avec le cache du navigateur désactivé, de la requête de la page de connexion jusqu'au formulaire à l'écran. Sur cette machine, c'est environ 12 ms de plus. Sur un lien de 20 Mbps, c'est environ 100 ms de plus (230 ms sont devenues 335 ms), et sur un lien de 1,6 Mbps avec 150 ms de latence, environ une demi-seconde de plus (1,46 s est devenue 1,96 s). Sur un réseau local d'usine, ce sont quelques millisecondes. Sur un mauvais lien, vous verrez une page blanche un instant, puis l'éditeur. C'est un coût unique par chargement de page, pas par clic.

## Nouveaux réglages

Aucun. Il n'y a rien à activer, et rien ici n'a d'interrupteur pour le désactiver.

## Mise à jour

Un simple `helm upgrade` vers l'image et le chart de la 2.5.0, ou le nouveau tag dans votre unité Quadlet. Rien ne se passe au premier démarrage, il n'y a rien à migrer, et les flux, les enregistrements de déploiement et les identifiants ne sont pas touchés. Rechargez l'onglet de l'éditeur une fois après le redémarrage du pod pour que votre navigateur cesse d'afficher l'ancien.

## Licences

L'éditeur embarque maintenant deux polices, Inter et JetBrains Mono, sous la SIL Open Font License 1.1. Leurs licences se trouvent dans `/usr/share/doc/hotloop-flow/THIRD_PARTY_LICENSES` avec les autres, et `NOTICE` explique comment ce fichier est produit.

Image : `ghcr.io/hotloop-io/hotloop-flow:2.5.0`, linux/amd64 et linux/arm64. Chart : `https://hotloop.io/hotloop-flow/`. Le README à ce tag a le reste, avec des images : https://github.com/HotLoop-io/hotloop-flow/blob/v2.5.0/README.md
