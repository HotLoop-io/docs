---
title: "Notes de version : HotLoop Transmitter 1.2.0"
description: "HotLoop Alarms rejoint la version : une bibliothèque qui place les alarmes propres d'un automate là où HotLoop les lit. L'éditeur est inchangé."
---

Cette version ajoute HotLoop Alarms, une seconde bibliothèque qui place les alarmes propres de votre automate là où HotLoop les lit, et livre le Transmitter en 1.2.0.0 avec le même éditeur qu'en 1.1.0.

Ce que cela change pour vous : les alarmes que votre projet CODESYS lève déjà apparaissent dans la liste d'alarmes de HotLoop, et acquitter l'une d'elles dans HotLoop l'acquitte dans l'automate. Si vous n'utilisez que l'éditeur, il n'y a rien à changer.

## Ce qui change pour un projet qui utilise 1.1.0

* **HotLoop Alarms 1.0.0.0, nouveau.** `HotLoopAlarms-1.0.0.0.library` et `.compiled-library` sont dans la version. Le bloc, `HLAL.FB_HLAL_Alarms`, est un client du gestionnaire d'alarmes CODESYS. Appelé une fois par cycle, il copie les alarmes actives, en attente et acquittées dans une table de variables simples (`aAlarms`, 64 lignes) que le serveur OPC UA du runtime exporte comme n'importe quelle autre variable. `udiChanges` s'incrémente quand la table a changé, et `uiDropped` compte les alarmes actives qui n'ont pas tenu au lieu de les perdre en silence. Il n'a besoin d'aucune bibliothèque de connecteur d'alarmes générée, seulement de l'Alarm Configuration du projet.
* **L'acquittement revient.** Une écriture des variables de commande (`uiAckGroupId`, `uiAckAlarmId`, `udiAckInternalId` ou `bAckAll`, puis un nouveau numéro dans `udiAckRequest`) fait acquitter par le bloc cette alarme, ou toutes, via le gestionnaire d'alarmes. HotLoop 4.23.6 et les suivantes trouvent le bloc d'après ce qu'il contient et font tout cela pour vous.
* **L'éditeur du Transmitter n'a pas changé.** La liste des champs et le format sur le réseau n'ont pas bougé, et `bTimestamp` fonctionne comme avant. La bibliothèque est recompilée en 1.2.0.0, et le `.package` la contient.
* **La licence est la HotLoop Source License Agreement 1.0,** la même que pour tous les produits HotLoop.

## Ce que j'ai exécuté, et ce que cela a montré

Le tout au laboratoire, sur CODESYS Control for Linux SL 4.22.0.0 dans un conteneur.

* La bibliothèque Transmitter se compile avec 0 erreur et 0 avertissement dans CODESYS 3.5.22.30, de même que les applications d'exemple compilées avec elle.
* Le laboratoire : deux éditeurs, Variant et RawData, 114 messages décodés de chacun, chaque valeur égale à ce que l'automate indique par son propre serveur OPC UA, aucun trou dans les numéros de séquence, les deux horodatages dans chaque message, et les octets de 1.0.0 avec `bTimestamp := FALSE`. Une implémentation indépendante d'OPC UA PubSub lit les valeurs et les horodatages de chaque message. 128 vérifications ont réussi et aucune n'a échoué.
* L'abonné UADP de HotLoop core lit les deux éditeurs sur un runtime en service : chaque valeur égale, les deux compteurs avançant, 62 key frames reçues et aucune refusée.
* Le `.package` s'installe avec `PackageManagerCLI --install`, la bibliothèque apparaît dans le dépôt System, et l'exemple se compile avec elle, avec 0 erreur et 0 avertissement.
* HotLoop Alarms : sur un vrai runtime avec une Alarm Configuration de deux alarmes, un déclenchement dans l'automate apparaît dans HotLoop, un acquittement dans HotLoop met la table de l'automate à acquitté avec l'heure, un réarmement la met en attente de confirmation, et une confirmation dans HotLoop vide la table de l'automate. La seconde alarme suit l'ordre inverse, et l'acquittement global a acquitté les deux alarmes actives.
* Coût de l'éditeur sur une tâche de 20 ms, deux éditeurs, épinglé sur quatre coeurs : environ 15 us ajoutées par cycle en moyenne, et le cycle le plus long 144 us, sans créneau de publication sauté ni envoi refusé. Une bibliothèque 1.1.0 recompilée dans la même heure a mesuré 15,2 us et 261 us.

## Ce que je n'ai pas exécuté

* Aucun contrôleur physique, aucun runtime CODESYS autre que Control for Linux SL 4.22.0.0, et aucun processeur autre que x86-64.
* HotLoop Alarms avec une classe d'alarme autre que celle qui acquitte et demande une confirmation, ou avec plus de 64 alarmes actives à la fois.
* Le `.package` dans la fenêtre du CODESYS Installer. Il s'est installé sans interface avec PackageManagerCLI.
* Un contrôleur dont l'horloge temps réel n'est pas réglée ou est fausse, le multicast, un runtime qui perd puis retrouve son réseau, et la fin de la fenêtre démo de deux heures.

## Absent de cette version

KeepAlive et Delta Frames, plus d'un DataSetMessage par NetworkMessage, WSTRING, un état par champ, horodatages à la sous-seconde, sécurité des messages et côté abonné. La [feuille de route](/fr/transmitter/roadmap/) dit lesquels viennent ensuite.

## Retour en arrière

Un projet d'automate figé sur 1.1.0 continue de fonctionner et envoie les mêmes octets. HotLoop Alarms est une bibliothèque distincte : un projet qui ne l'ajoute pas n'est pas touché.

## Fichiers

Téléchargez-les depuis https://hotloop.io/hotloop-transmitter/1.2.0/ et vérifiez-les avec `SHA256SUMS` dans le même dossier.

```
e68cfc88e599ddcf278eb208ff500f4f78d3faf74edf12e38f308a009f478594  HotLoopAlarms-1.0.0.0.compiled-library
68f704fc5662bbc67ec097016a741065d705af01913a2746296c17f9e6991118  HotLoopAlarms-1.0.0.0.library
a404f20fc35c4a3d804aa194f29def3f8193e26e696357899d3ae5b3d44948c1  HotLoopTransmitter-1.2.0.compiled-library
05200d0279ac120fd69d2dc3eeba99d9b40cb76eba2d15d1431b94c5e8f3fc32  HotLoopTransmitter-1.2.0.library
d6b6606a5919e18d2d6d31a5529af4d76bc7058003fb26032ec1a578f78ea57d  HotLoopTransmitter-1.2.0.package
```
