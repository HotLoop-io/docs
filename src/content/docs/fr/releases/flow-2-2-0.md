---
title: "Notes de version : HotLoop Flow 2.2.0"
description: "Ce que apporte HotLoop Flow 2.2.0, ce qui change à la mise à jour et ce qu'il faut lire avant de toucher à une usine en marche."
sidebar:
  label: "2.2.0"
---

HotLoop Flow 2.2.0 est la version où Flow parle aux automates, se souvient de ce qu'il savait quand il redémarre et vous montre par où est passé un message. C'est aussi la première version sous la Business Source License de HotLoop, et je le mets en premier parce que c'est la partie que vous devez lire.

## La licence a changé

La 2.2.0 et toutes les versions suivantes sont sous la Business Source License 1.1 de HotLoop, la même licence que le reste de HotLoop. Ce n'est pas une licence open source et je ne vais pas faire semblant. Le code source de Flow reste public : vous pouvez lire chaque ligne que vous exécutez.

- L'usage domestique et en laboratoire est gratuit.
- Les écoles et établissements d'enseignement accrédités, les associations à but non lucratif et les organismes publics l'utilisent gratuitement pour leurs propres activités et leur mission.
- L'usage professionnel est gratuit lorsqu'il passe par [EmberNet](https://embernet.ai). C'est la seule voie professionnelle.
- L'hébergement de Flow comme service, sa revente et son intégration dans un produit que vous vendez ne sont pas accordés.
- Chaque version passe sous GPL-3.0 ou ultérieure quatre ans après sa première publication.

`LICENSE` est le texte juridique, octet pour octet celui de HotLoop-io/HotLoop-io. La 2.1.0 et tout ce qui précède restent sous la licence avec laquelle ils ont été livrés. Rien ne change pour ces versions. Les fichiers portés de Node-RED gardent leurs en-têtes de licence et mentions d'origine, si bien que le texte de leur licence est désormais livré dans `LICENSES/` à côté de `NOTICE`, et l'image porte les deux dans `/usr/share/doc/hotloop-flow/`. `NOTICE` couvre aussi la copie corrigée de gos7 que Flow embarque désormais (plus bas).

## Nouveautés

**Traçage et rejeu**
- Chaque message reçoit une trace bornée. Cliquez sur un message de débogage et l'éditeur illumine le chemin qu'il a suivi, avec la durée et la charge utile à chaque saut, à travers les séparations, les jonctions et les sous-flux.
- Une trace devient un test de flux, ou se rejoue dans un brouillon pour essayer un correctif sur le message qui a posé problème.
- Chaque saut peut partir vers un collecteur OpenTelemetry sous forme de span (`trace.otlp.endpoint`).

**Un état qui survit à un redémarrage**
- Le contexte de flux, global et de nœud vit dans un fichier SQLite, `state.db`, sur le volume de données. Un redémarrage ne l'efface plus.
- Liaisons durables. Marquez une liaison comme durable et, tant que le nœud à l'autre bout suit, c'est une liaison ordinaire qui n'écrit rien. Quand ce nœud cesse d'accepter des messages, la liaison déborde dans le même fichier, dans l'ordre, et se vide quand la cible revient. Nous l'avons prouvé contre un vrai InfluxDB arrêté dix minutes, avec le runtime tué par `kill -9` en pleine panne et en plein vidage : aucun message perdu, aucun en double.

**Nœuds d'usine**
- Lecture et écriture Modbus TCP, lecture, écriture et abonnement OPC UA, lecture et écriture S7, lecture et écriture EtherNet/IP, et Sparkplug B comme nœud de périphérie et comme hôte. Flow peut désormais parler à ce que `scan` trouve.
- Sparkplug fait les naissances, le testament, `bdSeq`, les demandes de renaissance et les commandes que demande la spécification. Nous l'avons vérifié contre une implémentation Sparkplug indépendante dans les deux sens, nœud de périphérie et hôte.
- Un appareil silencieux fait échouer la requête dans le délai imparti et le message suivant se reconnecte. Un abonnement OPC UA remarque qu'il est tombé, le signale une seule fois et se rétablit tout seul.

**L'éditeur**
- Copier-coller, import et export d'une sélection, sous-flux avec leur propre canevas, groupes imbriqués, recherche dans tous les flux, filtres de débogage, Alt+clic pour supprimer une liaison. Un test de navigateur parcourt chaque boîte de dialogue de nœud de la liste que sert le runtime, si bien qu'un nouveau nœud est couvert dès le jour de sa sortie.
- Faire glisser une liaison sur un nœud n'a jamais fonctionné dans Chromium. C'est le cas maintenant.

**Vérifications**
- Un nœud dont le nœud de configuration n'est pas dans le fichier (un broker supprimé qu'un sous-flux nomme encore, ou une référence à un onglet ou au mauvais type de nœud de configuration) est signalé à l'import, au chargement et au déploiement, et ne démarre pas. Avant, il ne fonctionnait tout simplement jamais.
- Supprimer un flux ou un nœud retire son identifiant des périmètres de Catch, Status et Complete qui le nommaient.

## Ce qui a changé

- Le contexte persiste par défaut. `store.context.persist` est activé : une valeur définie avant un redémarrage est toujours là après, alors qu'avant chaque redémarrage repartait de zéro. Un flux qui comptait sur un contexte vide au démarrage doit maintenant vider ce qu'il attend vide. Mettez `persist` à `false` pour retrouver l'ancien comportement.
- Le traçage est activé par défaut et borné de toutes parts : 256 parcours, 512 sauts chacun, 16 MiB au total, 1000 nouveaux parcours par seconde. Il reste en mémoire, donc un redémarrage repart d'une liste vide. `trace.enabled: false` le désactive.
- gos7 écrivait une ligne brute dans le journal global de Go à chaque expiration S7, et rien sur le nœud ne permettait de le désactiver.
- La file durable compte un message comme en attente une fois qu'il est sur le disque, pas avant.
- L'image est construite et poussée avec Podman, pas Docker. Même image, mêmes tags (`2.2.0`, `2.2`, `2`), toujours linux/amd64 et linux/arm64.

## Notes de mise à jour

Depuis la 2.1.0, il suffit de changer l'image (`helm upgrade`, ou le nouveau tag dans votre unité Quadlet). Pas de migration, pas d'option. Un `flows.json` et un fichier de configuration qui tournaient en 2.1.0 tournent en 2.2.0, et l'aller-retour octet pour octet du fichier de flux reste intact.

- Le premier démarrage crée `state.db` dans `data.dir`, sur le volume. Avec `persistence.enabled` à false dans le chart, il survit au redémarrage du conteneur mais pas au remplacement du pod.
- Revenir à la 2.1.0 laisse `state.db` en place. La 2.1.0 n'a aucun code qui le lise.
- Chaque écriture dans `state.db` est une écriture sur une carte SD ou un SSD, donc les valeurs par défaut regroupent. Les changements de contexte attendent `flushInterval` (30 secondes) et sont écrits ensemble, et une valeur remise à ce qu'elle était n'écrit rien. Un `kill -9` peut perdre cet intervalle. `docs/durable/README.md` donne les chiffres et ce que cela coûte à une carte.

## Nouveaux réglages

| YAML | Environnement | Par défaut |
|---|---|---|
| `store.path` | `HOTLOOP_FLOW_STORE_PATH` | vide, ce qui signifie `state.db` dans `data.dir` |
| `store.synchronous` | `HOTLOOP_FLOW_STORE_SYNCHRONOUS` | `normal`. `full` fait un fsync à chaque commit et use la carte en conséquence. |
| `store.context.persist` | `HOTLOOP_FLOW_CONTEXT_PERSIST` | `true` |
| `store.context.flushInterval` | `HOTLOOP_FLOW_CONTEXT_FLUSH_INTERVAL` | `30s`. `0s` écrit chaque changement avant que le flux ne continue. |
| `store.durable.maxBytes` | `HOTLOOP_FLOW_DURABLE_MAX_BYTES` | 256 MiB pour toutes les liaisons durables ensemble |
| `store.durable.ackFlush` | `HOTLOOP_FLOW_DURABLE_ACK_FLUSH` | `100ms`. `0s` marque chaque message avant l'envoi du suivant. |
| `trace.enabled`, `trace.traces`, `trace.maxHops`, `trace.maxMessageBytes`, `trace.maxBytes`, `trace.perSecond` | | `true`, 256, 512, 16384, 16 MiB, 1000. `perSecond: 0` trace chaque message. |
| `trace.otlp.endpoint`, `trace.otlp.serviceName`, `trace.otlp.interval` | `HOTLOOP_FLOW_TRACE_OTLP_ENDPOINT` | vide (pas d'export), `hotloop-flow`, `2s` |
| `trace.otlp.headersSecret` (chart) | `HOTLOOP_FLOW_TRACE_OTLP_HEADERS` | aucun. Une clé de Secret contenant des paires `Name=value` séparées par des virgules, pour la clé d'API d'un collecteur hébergé. |

Le chart a tout cela sous `store` et `trace` dans `values.yaml`.

Image : `ghcr.io/hotloop-io/hotloop-flow:2.2.0`, linux/amd64 et linux/arm64. Chart : `https://hotloop.io/hotloop-flow/`. Le README de ce tag contient le reste : https://github.com/HotLoop-io/hotloop-flow/blob/v2.2.0/README.md
