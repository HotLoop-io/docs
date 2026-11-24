---
title: "Notes de version : HotLoop Transmitter 1.3.0"
description: "Horodatages à la milliseconde, champs WSTRING, statut par champ, plusieurs DataSets dans un NetworkMessage, trames delta avec KeepAlive, désactivées par défaut."
---

HotLoop Transmitter met les valeurs de votre automate sur le réseau en OPC UA PubSub, depuis une bibliothèque que vous ajoutez au projet CODESYS. La 1.3.0 ajoute des horodatages à la milliseconde, des champs WSTRING, un statut par champ pour qu’une mauvaise valeur parte comme mauvaise, plusieurs DataSets dans un NetworkMessage, et des Data Delta Frames avec des messages KeepAlive. C’est la bibliothèque 1.3.0.0, et HotLoop Alarms 1.0.0.0 l’accompagne, inchangée.

Ce que cela signifie pour vous : un projet d’automate qui utilise déjà la 1.2.0 envoie les mêmes octets qu’avant, avec une différence visible, l’horodatage a désormais des millisecondes. Tout le reste s’active avec un appel ou une entrée.

## Nouveautés

* **Horodatages à la milliseconde.** Le NetworkMessage et le DataSetMessage portent les millisecondes de l’horloge, si bien qu’un abonné voit quand chaque message a été construit et non la seconde où il tombe. `bStampHighRes` indique quelle horloge le dernier message a utilisée.
* **Champs WSTRING.** `AddWString(ADR(wName), N)` publie un `WSTRING(N)` comme une String OPC UA, en Variant et en RawData. Le texte part en UTF-8 : un caractère au-delà de U+FFFF, qui est une paire de substitution dans l’automate, part comme un caractère de quatre octets, et un substitut isolé part comme U+FFFD, de sorte que ce qu’un abonné lit est toujours un texte valide. En RawData, le MaxStringLength du champ est de `3 * N` octets.
* **Un statut par champ.** Après avoir ajouté un champ, `SetStatus(ADR(udiStatus))` le lie à un UDINT contenant un StatusCode OPC UA. Tant que cette variable n’est pas 0, le champ part comme le StatusCode au lieu de sa valeur, et un abonné le lit comme une mauvaise qualité. Remettez-la à 0 et la valeur repart. Un publieur RawData continue d’envoyer la valeur, car RawData n’a aucun moyen de porter un statut.
* **Plusieurs DataSets dans un NetworkMessage.** `AddDataSet(uiWriterId, udiConfigMajor)` démarre un autre DataSet dans le même bloc : les champs que vous ajoutez ensuite lui appartiennent. À chaque intervalle de publication, un NetworkMessage porte un DataSetMessage par DataSet, avec le tableau Sizes que demande la Partie 14, si bien que plus d’un writer partage un datagramme. Jusqu’à 8 DataSets. Si vous ne l’appelez jamais, le message est celui que la 1.2.0 envoyait.
* **Data Delta Frames et KeepAlive.** Un jeu de données stable n’a plus à envoyer chaque champ à chaque intervalle. Avec les trames delta activées, un publieur envoie d’abord une trame clé complète puis, tous les `uiKeyFrameEvery` messages, un Data Delta Frame avec seulement les champs modifiés entre-temps, et un KeepAlive quand rien n’a changé. `bDeltaActive`, `udiDeltaSent` et `udiKeepAliveSent` montrent ce qu’il fait.

## Ce qui change pour un projet qui utilise la 1.2.0

* Votre liste de champs et votre format sur le fil n’ont pas changé. La seule différence sur le fil est la partie millisecondes de l’horodatage.
* HotLoop Alarms 1.0.0.0 est dans la version, inchangé.

## Réglages et valeurs par défaut

* `bHighResTimestamp` vaut `TRUE` : horodate avec les millisecondes de l’horloge. Mettez-le à `FALSE` pour horodater en secondes entières, exactement comme la 1.2.0. Si le runtime ne peut pas fournir les millisecondes, le bloc horodate de lui-même en secondes entières.
* `bDeltaFrames` vaut `FALSE`. Les trames delta sont un réglage que vous activez sur un publieur, pas quelque chose que le bloc fait sans qu’on le lui demande, si bien que tous les abonnés que vous avez continuent de lire des trames clés complètes. Pour l’activer pour un writer, mettez `bDeltaFrames := TRUE` sur ce publieur et, si vous voulez un autre espacement des trames clés, `uiKeyFrameEvery` (10 si vous n’y touchez pas). Chaque publieur décide pour lui-même, si bien qu’un writer peut envoyer des deltas pendant que les autres n’en envoient pas. Un abonné qui ignore les trames delta montre un changement à la trame clé suivante, activez-le donc pour des abonnés qui les lisent. Il s’applique aux publieurs Variant avec un seul DataSet ; un publieur RawData, ou un bloc avec plus d’un DataSet, envoie des trames clés.
* `AddDataSet`, `AddWString` et `SetStatus` sont des appels que vous faites une fois au démarrage, comme les autres appels `Add`. Sans eux, rien ne change.

## Mise à jour

Installez `HotLoopTransmitter-1.3.0.library` (ou ouvrez le `.package` avec le CODESYS Installer), changez la version de la bibliothèque dans le Library Manager de votre projet en 1.3.0.0 et compilez. Rien dans votre code n’a besoin de changer. Ajoutez les nouveaux appels quand vous voulez ce qu’ils font.

## Retour en arrière

Un projet figé sur la 1.2.0 continue de fonctionner et envoie les mêmes octets qu’avant, avec des horodatages en secondes entières. HotLoop Alarms est une bibliothèque distincte et n’est pas affectée.

## Absent de cette version

La sécurité des messages, les NetworkMessages fragmentés, le côté abonné et le transport MQTT.

## Fichiers

```
e68cfc88e599ddcf278eb208ff500f4f78d3faf74edf12e38f308a009f478594  HotLoopAlarms-1.0.0.0.compiled-library
68f704fc5662bbc67ec097016a741065d705af01913a2746296c17f9e6991118  HotLoopAlarms-1.0.0.0.library
5be90a88e9e0aae1de421628fb6ca8e810dda96b4562566df345d451ecd859cf  HotLoopTransmitter-1.3.0.compiled-library
0410b98578fd55775a97b27023a0b5f30111cac0587120894354d9edca1248fc  HotLoopTransmitter-1.3.0.library
3e791358e6dc628a2d2aae760e0c49c89f1c4490f0637b65864c335fcbb3e9a0  HotLoopTransmitter-1.3.0.package
```
