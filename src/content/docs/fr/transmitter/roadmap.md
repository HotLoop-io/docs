---
title: "Feuille de route de Transmitter"
description: "Ce que HotLoop Transmitter a déjà construit, ce qui vient ensuite et ce qui n'est volontairement pas prévu."
---

Ce qu'il y a aujourd'hui dans la boîte, ce qui vient ensuite et ce qui n'est volontairement pas prévu. Une ligne passe dans « Livré » seulement quand elle a tourné sur le vrai runtime 4.22.0.0 et qu'un récepteur l'a lue.

## Livré en 1.1.0

* Horodatages des DataSetMessage et NetworkMessage pris sur l'horloge temps réel de l'automate, activés par défaut ; `bTimestamp` les désactive.
* La bibliothèque sous forme de `.package` CODESYS, installée avec le CODESYS Installer.

## Livré en 1.0.0

* Un bloc éditeur, `FB_HLTX_Publisher` : un NetworkMessage par intervalle de publication, un DataSetMessage, un Data Key Frame, UADP sur UDP, depuis du Structured Text sur SysSocket.
* Encodages de champ Variant et RawData.
* Champs BOOL, SINT, USINT, INT, UINT, DINT, UDINT, LINT, ULINT, REAL, LREAL, STRING et TIME, et tableaux de chacun sauf STRING, dans les deux encodages.
* Destinations unicast et multicast, publisher id, writer group id, dataset writer id, intervalle de publication, version de groupe et version de configuration, tous réglés comme entrées du bloc.
* Un envoi non bloquant, un coût borné par appel, des compteurs d'envoyés, de refusés et d'ignorés, et un état d'erreur qui ne met jamais l'application en défaut.

## Ensuite

* Des horodatages sous la seconde. L'horodatage de 1.1.0 est en secondes entières de l'horloge temps réel.
* Plusieurs DataSetMessages dans un NetworkMessage (le tableau Sizes), pour qu'un datagramme puisse porter plus d'un writer.
* Des Data Delta Frames et des messages KeepAlive, pour réduire les octets d'un jeu de données presque stable.
* Des champs WSTRING.
* Un statut par champ, pour qu'une valeur Bad puisse être envoyée comme Bad.

## Pas prévu

* La sécurité des messages (signature et chiffrement). Le bloc envoie en clair, sur un réseau auquel l'usine fait déjà confiance.
* Les NetworkMessages fragmentés. Un message qui ne tient pas dans une trame de 1500 octets est refusé, pas découpé.
* Le côté abonné. HotLoop core s'abonne à UADP ; cette bibliothèque publie.
* Le transport MQTT. UDP est ce qu'un runtime CODESYS atteint sans autre bibliothèque.
