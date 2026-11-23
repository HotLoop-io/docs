---
title: "Notes de version: HotLoop core 4.21.0"
description: "Ce qu'apporte HotLoop core 4.21.0, ce qui change à la mise à jour et ce qu'il faut lire avant de toucher une usine en production."
sidebar:
  label: "4.21.0"
---

Cette version ajoute la connexion X.509 au serveur OPC UA, lui retire la limite de mots de passe de 64 octets et désactive par défaut les politiques de sécurité obsolètes. Elle élargit aussi l'import d'alarmes CODESYS. Construite sur la [4.20.2](/fr/releases/hotloop-4-20-2/).

## Ce qui a changé

- **Un client peut se connecter au serveur OPC UA avec un certificat X.509.** Un administrateur attache le certificat public du client à un utilisateur HotLoop (Settings, OPC UA certificates, ou l'API, ou les outils MCP), et un client qui détient la clé privée se connecte en tant que cet utilisateur avec ses permissions. Révoquer un certificat met fin à sa session active en dix secondes, et chaque connexion par certificat et chaque refus est dans le logbook. C'est désactivé tant que `HOTLOOP_OPCUA_SERVER_ALLOW_X509=true` (chart `opcuaServer.allowX509`). Le pilote d'équipement peut se connecter de la même façon avec `userCertificate` et `userPrivateKey` (RSA, la clé scellée comme un mot de passe). Une CA de confiance avec une règle de nom n'est pas réalisée.
- **Les mots de passe de 65 à 72 octets se connectent maintenant par OPC UA.** Ils ont toujours fonctionné dans l'interface web. La bibliothèque sur laquelle le serveur est construit refusait tout jeton de nom d'utilisateur dont le mot de passe dépassait 64 octets.
- **Les politiques de sécurité obsolètes `Basic128Rsa15` et `Basic256` sont désactivées par défaut.** Le serveur ne les liste plus et un client qui en demande une par son nom est refusé à l'ouverture du canal. Cela vaut pour les nouvelles installations et pour les mises à jour. Un client ancien qui ne parle rien de plus récent se reconnecte avec `HOTLOOP_OPCUA_SERVER_ALLOW_DEPRECATED_POLICIES=true` (chart `opcuaServer.allowDeprecatedPolicies: true`), et le serveur le dit au démarrage. L'option de les désactiver est aussi ouverte en amont (pull request 66).
- **L'import d'alarmes CODESYS lit une alarme Outside range.** Export Alarms de l'IDE écrit `OutOfArea` pour elle, et elle passe sous la forme de deux alarmes, une `lo` à la limite basse et une `hi` à la limite haute. Inside the range, Change, Event et Alarm (API) sont listées comme ignorées avec la raison : rien ici ne les dit honnêtement. L'importeur a été élargi à partir d'un export de tous les types d'observation que propose l'IDE, conservé comme fixture de test.

## Changements de l'API

- Nouveau : `GET /api/opcua/certificates`, `GET` et `POST /api/users/{username}/certificates`, `POST /api/users/{username}/certificates/{thumbprint}/revoke`, `DELETE /api/users/{username}/certificates/{thumbprint}`, toutes `users.manage`. Cinq nouveaux outils MCP, 133 au total.
- Une migration, la 0027 : la table `user_certificates` (certificats publics seulement). Elle est dans la sauvegarde.

## Mise à jour

Un `helm upgrade` simple, ou la mise à jour automatique de Quadlet. Vérifiez d'abord si l'un de vos clients OPC UA est en `Basic256` ou `Basic128Rsa15` (la connexion d'Ignition l'indique) : ce client cesse de se connecter après la mise à jour tant que vous ne l'avez pas passé à `Basic256Sha256` ou activé l'interrupteur hérité ci-dessus. Un rollback vers la version précédente n'a pas été essayé avec la nouvelle table en place.

- Les quatre charts (`hotloop`, `hotloop-iot`, `hotloop-edge`, `hotloop-edge-relay`) sont à la 4.21.0, avec toutes les versions antérieures toujours dans l'index.

- Cette construction est uniquement amd64, et `stable` garde les images arm qu'il détient. La version suivante est un petit changement de version qui construit les images arm.
