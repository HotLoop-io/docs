---
title: "HotLoop Cascade : flux de travail"
description: "Des flux de travail qui font parler l'usine à tout le reste, avec points de reprise : un nouvel essai n'est qu'une ligne en base. Un seul binaire Go statique."
---

Cascade fait parler l'usine à tout le reste. Une alarme, un webhook, une planification, une nouvelle ligne ou une rafale MQTT devient un lot d'éléments, et ces éléments traversent des étapes qui appellent de vrais systèmes avec de vrais identifiants. Si une API tombe ou si la machine redémarre en cours de route, le travail se termine quand même, car chaque étape est enregistrée comme point de reprise et un nouvel essai est une ligne dans la base de données.

C'est un seul binaire Go statique. SQLite sur un Raspberry Pi, ou Postgres avec autant de workers que vous voulez sur k3s. Postgres sert aussi de file d'attente : pas de Redis à surveiller sur un cluster d'usine.

## Ce qu'il ne fait pas

**Il n'écrit pas sur vos équipements.** Cascade lit et s'abonne. Tout ce qui actionne une vanne ou change une consigne passe par la porte d'écriture de HotLoop, si bien que l'audit de cette porte voit chaque écriture, quel que soit le flux de travail qui l'a lancée. Un moteur de flux de travail avec une porte dérobée vers l'automate, c'est ainsi qu'une piste d'audit cesse d'être honnête.

**Il n'exécute pas de JavaScript dans vos champs.** Les expressions de champ utilisent expr, le même petit langage que les automatisations de HotLoop. Elles ne peuvent toucher ni au système d'exploitation, ni au réseau, ni au système de fichiers, et elles se terminent toujours. JavaScript vit à un seul endroit, l'étape Code, qui s'exécute dans un processus séparé et cloisonné, sans secrets, sans réseau et sans système de fichiers. Le tenir hors de tous les autres champs garde aussi l'exécution de code à distance hors de ces champs.

**Il ne bride rien.** SSO, MFA obligatoire, RBAC, audit, historique des versions, clés d'API restreintes et workers en haute disponibilité sont tous dans le même binaire. Il n'y a aucune vérification de licence nulle part dans le code.

**Il ne renvoie rien à la maison.** Pas de serveur de licences, pas de dépendance au cloud. La télémétrie est optionnelle, désactivée par défaut, et documentée champ par champ le jour où elle arrive.

## Où aller ensuite

[Exécuter Cascade](/fr/cascade/running/), l'exécuter [avec Podman Quadlet](/fr/cascade/quadlet/), ou lire [la feuille de route de Cascade](/fr/cascade/roadmap/). Vous l'utilisez dans une usine ? [Utiliser HotLoop en entreprise](/fr/business/) explique les licences et comment nous joindre.
