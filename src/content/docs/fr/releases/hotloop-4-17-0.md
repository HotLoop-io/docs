---
title: "Notes de version: HotLoop core 4.17.0"
description: "Ce qu'apporte HotLoop core 4.17.0, ce qui change à la mise à jour et ce qu'il faut lire avant de toucher une usine en production."
sidebar:
  label: "4.17.0"
---

La phase 2 de la base d'automatisation, UniFi en lecture seule et les mots de passe des équipements chiffrés au repos. Depuis la 4.16.0, c'est un simple `helm upgrade`, mais les mots de passe de vos équipements sont chiffrés au premier démarrage, et à partir de là la clé fait partie de vos données. Lisez « Mise à jour depuis la 4.16.0 » plus bas avant de toucher une usine en production.

Les notes complètes sont dans le README : Ce qui change dans la 4.17.0.

## En bref

- **La base d'automatisation, phase 2.** Les helpers (les valeurs qui appartiennent aux gens de l'usine, refusées et jamais tronquées), le logbook (une seule chronologie des changements d'état, écritures, alarmes, exécutions et configuration), les étapes condition, attente et arrêt et `forSec` sur un déclencheur d'état, les scripts (écrivez le cycle CIP une fois, lancez-le de n'importe où), les recettes (tous les setpoints d'une qualité partent ensemble ou aucun ne part, relus depuis l'équipement) et les blueprints (une règle écrite une fois, remplie pour chaque pompe, figée sur sa version tant que personne n'a relu la mise à jour). MCP passe de 16 à 25 outils.
- **UniFi Network, en lecture seule.** Switches, ports, PoE, WAN et clients sous forme de tags, une connexion par console, certificat épinglé. Le tiroir d'un automate silencieux indique sur quel port du switch il est branché et si le lien est actif, et un inconnu sur un réseau marqué OT déclenche une alarme. Éprouvé en lecture seule sur de vraies consoles. **Pas encore éprouvé :** un vrai câble débranché sur un équipement surveillé et un téléphone qui rejoint un réseau marqué OT. Ces deux alarmes sont validées en test et nulle part ailleurs tant que quelqu'un n'a pas fait les deux au rack.
- **Les mots de passe des équipements sont chiffrés** dans la base et dans les sauvegardes, avec une clé que le chart génère dans `<release>-secret-key` et conserve.
- **Correctifs sur lesquels une usine en 4.16.0 peut trébucher :** un Edge Relay issu du chart ou de l'unité Quadlet ignorait chaque configuration poussée, et un Edge Relay sans persistance ne démarrait pas ; une modification manuelle dans l'éditeur de règles remettait à zéro le budget d'exécutions de la règle ; le verdict de l'invite de commande pouvait déplacer Set juste sous le clic ; une mise à jour tardive pouvait ramener l'écran Entities dans le passé ; une règle jamais exécutée disait s'être exécutée il y a 739887 jours ; les déploiements de l'App Store ne portaient aucun tenant.

### Changements de l'API

- Une heure qui n'est pas encore arrivée est omise, et non envoyée comme `0001-01-01T00:00:00Z` : `lastRun`, `lastPoll`, `lastGood`, `clearedAt`, `ackedAt`, `shelvedUntil`, `raisedAt` et le reste, y compris sur le flux en direct.
- Nouvelles routes : `/api/helpers`, `/api/logbook`, `/api/scripts`, `/api/recipes`, `/api/blueprints`, `POST /api/automations/{id}/blueprint-upgrade`, `/api/devices/{id}/network`, `/api/unifi/{id}/...` et `DELETE /api/fleet/{id}/config`. Toutes dans docs/API.md.
- Nouvelles permissions, que le rôle opérateur possède : `helpers.write`, `scripts.run`, `recipes.apply`, `blueprints.apply`. Écrire des scripts, des recettes et des blueprints relève de l'administrateur.
- Les tags portent `deviceClass` ; les règles portent `blueprintId`, `blueprintVersion` et `blueprintInputs`.

### Mise à jour depuis la 4.16.0

- `helm upgrade <release> hotloop/hotloop --version 4.17.0 --reset-then-reuse-values`. Pas avec `--reuse-values`, qui perd les nouvelles valeurs par défaut et échoue au rendu. Les sélecteurs et les volume claims ne changent pas ; le seul nouvel objet est le Secret de la clé.
- Les migrations 0009 à 0015 s'exécutent au démarrage (helpers, logbook, scripts, classe d'équipement des tags, recettes, blueprints, UniFi). Toutes additives. Faites un `pg_dump` avant.
- `HOTLOOP_SECRET_KEY_FILE` : le chart génère la clé lors de cette mise à jour, et le Gateway chiffre à ce démarrage chaque mot de passe d'équipement stocké. Sans la clé ensuite, ces équipements restent hors ligne avec une erreur qui nomme la clé. Une sauvegarde faite après la mise à jour ne se restaure qu'avec cette clé, ou avec `--restore-keep-unreadable-credentials`, qui laisse ces équipements hors ligne jusqu'à ce que quelqu'un ressaisisse les mots de passe. Sauvegardez le Secret à part de vos sauvegardes. Revenir à la 4.16.0 veut dire restaurer votre dump d'avant la mise à jour.
- Vous rendez le chart avec `helm template` au lieu de l'installer ? Apportez votre propre clé dans `secretKey.existingSecret`, sinon chaque rendu en crée une nouvelle.
- Edge Relay : un fichier d'équipements poussé se trouve dans `/data/pushed-devices.json` et l'emporte sur les `devices` du chart tant qu'il existe ; `DELETE /api/fleet/{id}/config` l'efface. Une poussée qui a échoué en 4.16.0 reste retenue sur le broker et arrive au premier démarrage de la 4.17.0. Les utilisateurs de Quadlet prennent la nouvelle unité. Avec `persistence.enabled=false`, il démarre désormais, mais perd la file de transfert, tout fichier poussé et le certificat OPC UA à chaque remplacement du pod.
