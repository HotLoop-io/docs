---
title: "Notes de version : HotLoop Transmitter 1.1.0"
description: "Chaque message porte un horodatage de l'horloge de l'automate, et la bibliothèque s'installe depuis un paquet CODESYS : ce qui a changé et ce qui a tourné."
---

Chaque message porte désormais un horodatage issu de l'horloge de l'automate, et la bibliothèque s'installe désormais depuis un `.package` CODESYS.

Ce que cela change pour vous : un abonné qui veut savoir quand une valeur a été échantillonnée l'obtient du paquet au lieu de le deviner d'après l'heure d'arrivée, et vous pouvez installer la bibliothèque avec le CODESYS Installer comme n'importe quel autre module.

## Ce qui change pour un projet qui utilise 1.0.0

* **Horodatages, activés par défaut.** Le NetworkMessage et le DataSetMessage portent chacun un Timestamp (Partie 14, 7.2.4.4.2 et 7.2.4.5.4), le même DateTime, lu sur l'horloge temps réel de l'automate une fois par message. ExtendedFlags1 passe de `01` à `21`, DataSetFlags1 de `69` ou `6B` à `E9` ou `EB`, et un octet DataSetFlags2 `10` est ajouté. Un message est plus long de 17 octets. La liste des champs et les valeurs n'ont pas bougé, et `udiConfigMajor` est le même.
* **`bTimestamp := FALSE` envoie exactement les octets de 1.0.0.** Figez-le si l'un de vos récepteurs refuse les horodatages. Cela a été vérifié : messages de 1142 et 1144 octets, aucun horodaté, les tailles qu'envoyait 1.0.0.
* **La résolution est d'une seconde.** L'horloge est lue avec `SysTimeRtcGet`, qui donne des secondes entières, si bien qu'un récepteur voit le même horodatage sur tous les messages d'une même seconde et qu'il peut avoir jusqu'à une seconde de retard sur l'instant où le message a été construit. Les horodatages à la sous-seconde sont sur la feuille de route.
* **Une nouvelle sortie, `diLastClockResult`.** Si l'horloge ne peut pas être lue, le message part sans horodatage, ce que la Partie 14 autorise, et cette sortie dit pourquoi.
* **Une nouvelle bibliothèque système, SysTimeRtc.** La bibliothèque la nomme comme un espace réservé, comme SysSocket, et le runtime la fournit. Control for Linux SL 4.22.0.0 la fournit. Une cible qui ne l'a pas ne peut pas utiliser 1.1.0 avec horodatages ; restez sur 1.0.0.
* **Le `.package`.** `HotLoopTransmitter-1.1.0.package` a été fait par le PackageManagerCLI de CODESYS lui-même et place la même bibliothèque dans le dépôt de bibliothèques via l'Installer. Voir la [page d'installation](/fr/transmitter/install/).

## Ce que nous avons exécuté, et ce que cela a montré

Le tout sur CODESYS Control for Linux SL 4.22.0.0, avec les fichiers ci-dessous.

* La bibliothèque se compile avec 0 erreur et 0 avertissement dans CODESYS 3.5.22.30. L'application d'exemple se compile avec elle, avec 0 erreur et 0 avertissement.
* Deux éditeurs, Variant et RawData, horodatages activés. Un décodeur indépendant écrit d'après la spécification décode chaque message et chaque valeur est égale à ce que l'automate indique par son propre serveur OPC UA. Chaque message porte les deux horodatages, ils sont le même instant, ne reculent jamais, restent dans la tolérance à la seconde entière de l'horloge sur laquelle la capture a tourné, et sur une capture de 11 secondes l'horodatage a avancé de 11 secondes. Le conteneur partage l'horloge de l'hôte, ce qui montre que l'horodatage est bien la lecture de l'horloge de l'automate et non une valeur inventée ; cela ne teste pas un contrôleur dont l'horloge est fausse.
* Une pile PubSub indépendante lit le Timestamp du NetworkMessage et du DataSetMessage des 113 messages de chaque écrivain avec ses propres décodeurs d'en-tête, et décode les valeurs comme pour 1.0.0.
* L'abonné de HotLoop core (depuis sa branche main au moment de l'essai, et dans HotLoop core 4.19.4 et toutes les versions suivantes) lit les deux éditeurs sur un runtime en service : 21 valeurs chacun, les deux compteurs avançant, rien de refusé. Chaque lecture porte comme heure l'horodatage à la seconde entière de l'éditeur, et l'horodatage a suivi l'horloge de l'automate pendant une attente de 3 secondes.
* Le `.package` s'installe avec `PackageManagerCLI --install`, la bibliothèque apparaît dans le dépôt System (elle n'y était pas avant), et l'exemple se compile avec la bibliothèque telle que l'Installer l'y a placée, avec 0 erreur et 0 avertissement.
* Coût sur une tâche de 20 ms, avec deux éditeurs : environ 9,6 us ajoutées par cycle en moyenne, de 10 à 100 us sur les cycles qui envoient, et le cycle le plus long de l'essai 81 us. Trois créneaux de publication ont été sautés pendant cet essai, et aucun envoi n'a été refusé. L'horodatage lui-même ne se voit pas dans les chiffres. La [page sur les temps](/fr/transmitter/timing/) donne le tableau.

## Ce qu'il faut vérifier sur votre contrôleur

* La gestion de l'ordre des octets pour une cible big endian est écrite, vérifiez-la donc sur votre propre contrôleur.
* Multicast : le bloc règle le TTL, le bouclage et l'interface d'envoi pour le groupe, vérifiez donc le groupe sur votre propre réseau.
* Si le réseau disparaît ou si une adresse est absente, le bloc compte l'échec et espace ses essais, et le programme continue de scruter.
* En mode démo, le runtime s'arrête à la fin de sa fenêtre de deux heures, comme l'indique CODESYS.
* Un contrôleur dont l'horloge temps réel n'est pas réglée ou est fausse horodatera ce que l'horloge indique.

## Absent de cette version

KeepAlive et Delta Frames, plus d'un DataSetMessage par NetworkMessage, WSTRING, un état par champ, horodatages à la sous-seconde, sécurité des messages et côté abonné. La [feuille de route](/fr/transmitter/roadmap/) dit lesquels viennent ensuite.

## Retour en arrière

Un projet d'automate figé sur 1.0.0 continue de fonctionner et d'envoyer les octets de 1.0.0. Dans 1.1.0, `bTimestamp := FALSE` donne les mêmes octets.

## Fichiers

Téléchargez-les depuis https://hotloop.io/hotloop-transmitter/1.1.0/ et vérifiez-les avec `SHA256SUMS` dans le même dossier.

```
5ec021b23f5d57460016834a03b2b196d6dbc83aeb5d0ad60ace8d7b4fbbb4a7  HotLoopTransmitter-1.1.0.library
e172f4674f6cbfce2aeaf017d5a6c733245b1b9aa3e527369c753bf07b6ce0c2  HotLoopTransmitter-1.1.0.compiled-library
b3686bdebd052f1ddea46d1f1ff409f3b6c9a016ca5f3e8f4cd6f7922ccb479c  HotLoopTransmitter-1.1.0.package
```
