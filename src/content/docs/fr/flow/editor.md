---
title: "L'éditeur de HotLoop Flow"
description: "L'éditeur de Flow en clair et en sombre : le canevas, la revue avant un déploiement, un message tracé et la connexion."
---

Il suit votre système, clair ou sombre, et chaque image ci-dessous est montrée dans les deux, d'abord en clair. Toutes les images ci-dessous viennent de `web/shots/screenshots.sh`, qui lance le vrai binaire et un vrai navigateur ; elles sont donc refaites quand l'éditeur change et ne peuvent pas dériver en maquette. L'atelier sur le canevas est une ligne de fours avec deux déploiements derrière elle.

## Câbler, exécuter, surveiller

![L'éditeur sur une ligne de fours : le canevas, l'historique des déploiements et les panneaux de débogage et d'exécution](/synced/flow/docs/screenshots/editor.png)
![La même chose, en sombre](/synced/flow/docs/screenshots/editor-dark.png)

Le canevas, c'est ce qui tourne. La console de débogage dessous affiche ce que voient vos nœuds de débogage, et la table Runtime à côté compte ce qui est entré et sorti de chaque nœud, avec une barre indiquant à quel point sa file est pleine. Quand une ligne se comporte mal, vous le lisez à l'écran au lieu d'aller fouiller un journal.

## Relisez avant que cela n'atteigne la ligne

![Le panneau de revue listant un nœud modifié, avec une zone de note, à côté du canevas où ce nœud est entouré](/synced/flow/docs/screenshots/review.png)
![La même chose, en sombre](/synced/flow/docs/screenshots/review-dark.png)

Déployer ne déploie pas. Cela dessine le changement sur le canevas, l'écrit en toutes lettres et vous demande une note. La note atterrit dans l'historique à côté de votre nom, de sorte que celui qui reçoit l'appel à 2 h du matin voit ce qui a changé et pourquoi.

## Suivez un message le long des liaisons

![Un message tracé éclairé sur le canevas avec le temps passé par chaque nœud, et la console de débogage dessous](/synced/flow/docs/screenshots/debug.png)
![La même chose, en sombre](/synced/flow/docs/screenshots/debug-dark.png)

Cliquez sur Trace sur une ligne de débogage et le chemin pris par ce message s'éclaire sur le canevas, saut après saut, avec ce que chaque nœud en a fait et le temps que cela a pris. Transformez-le en test, ou rejouez-le dans un brouillon, depuis le même panneau.

## Connexion

![La carte de connexion](/synced/flow/docs/screenshots/signin.png)
![La même chose, en sombre](/synced/flow/docs/screenshots/signin-dark.png)

![L'avis qu'un runtime affiche quand le tableau de bord connecte les gens et que cette page a été ouverte autrement](/synced/flow/docs/screenshots/dashboard-signin.png)
![La même chose, en sombre](/synced/flow/docs/screenshots/dashboard-signin-dark.png)

Il ne démarre pas sans protection, donc la première chose que voit n'importe qui est une connexion. Quand le tableau de bord EmberCORE connecte les gens, un runtime ouvert autrement leur dit de passer par le tableau de bord au lieu de demander un second mot de passe.
