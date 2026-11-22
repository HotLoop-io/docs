---
title: "Sous-flux de HotLoop Flow"
description: "Regroupez un ensemble de nœuds en un nœud réutilisable, avec ses propres propriétés, et voyez ce qu'un sous-flux partage avec le flux qui l'entoure."
---

Chaque instance reçoit sa propre copie des nœuds du modèle, son propre contexte de flux et ses propres propriétés résolues. Le même modèle affiche `4.2 bar` dans une instance et `4.2 kPa` dans la suivante, vérifié de bout en bout par un vrai déploiement plutôt qu'affirmé dans un test unitaire.

L'expansion produit un **graphe séparé** au lieu de réécrire les flux analysés, et c'est toute la décision de conception. Le fichier de flux n'est jamais touché, donc l'aller-retour identique à l'octet près tient toujours, et le graphe développé est un graphe ordinaire : l'ordonnanceur, l'acheminement Catch, les métriques et les événements d'état de l'éditeur fonctionnent dans un sous-flux sans aucun cas particulier.

L'imbrication fonctionne. Une erreur que personne n'attrape dans un sous-flux remonte jusqu'au nœud Catch de l'onglet appelant, car sinon un sous-flux ne serait qu'un endroit où les erreurs disparaissent. Un nœud de configuration déclaré dans un modèle est **partagé** par toutes les instances au lieu d'être copié, puisqu'un broker MQTT dans un sous-flux, c'est un auteur qui dit « partage ceci », et le copier ouvrirait une connexion par instance auprès de quelque chose qui les compte presque certainement.
