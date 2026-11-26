---
title: "Notes de version : HotLoop Transmitter 1.0.0"
description: "La première version de HotLoop Transmitter : une bibliothèque CODESYS qui publie les valeurs de l'automate en OPC UA PubSub, son contenu et ce qui a tourné."
---

Première version. Une bibliothèque CODESYS, écrite en Structured Text sur l'UDP de SysSocket, qui met les valeurs de votre automate sur le réseau en OPC UA PubSub (Partie 14, UADP). Vous ajoutez la bibliothèque, déclarez un bloc fonctionnel, ajoutez les variables à envoyer et l'appelez une fois par cycle. Tout ce qui s'abonne à OPC UA PubSub peut la lire, HotLoop core compris, à partir de 4.19.4.

Ce que cela change pour vous : un automate sans bibliothèque PubSub peut désormais alimenter un abonné PubSub avec une quinzaine de lignes de Structured Text, sans rien installer d'autre sur le contrôleur.

## Ce que contient la bibliothèque

* Un bloc, `HLTX.FB_HLTX_Publisher`. Un NetworkMessage par intervalle de publication, un DataSetMessage, une Data Key Frame, de sorte que chaque message contient tous les champs.
* Des encodages de champs Variant et RawData, choisis par éditeur. Variant porte ses propres types. RawData n'en porte aucun, le récepteur doit donc connaître la disposition, que la [page du format sur le réseau](/fr/transmitter/wire-format/) détaille octet par octet.
* Des champs BOOL, SINT, USINT, INT, UINT, DINT, UDINT, LINT, ULINT, REAL, LREAL, STRING et TIME, et des tableaux de tous ces types sauf STRING, jusqu'à 128 champs et 1472 octets par message. Un message n'est jamais fragmenté.
* Unicast ou multicast, avec l'identifiant de l'éditeur, l'identifiant du groupe d'écriture, l'identifiant de l'écrivain du jeu de données, l'intervalle de publication, la version du groupe et la version de la configuration en entrées.
* Un envoi non bloquant. Une mauvaise adresse, un socket mort ou une liste de champs trop grande mettent le bloc dans un état d'erreur que vous pouvez lire, et ne font jamais tomber votre application.

## Ce que nous avons exécuté, et ce que cela a montré

Le tout sur CODESYS Control for Linux SL 4.22.0.0, avec les fichiers ci-dessous.

* La bibliothèque se compile avec 0 erreur et 0 avertissement dans CODESYS 3.5.22.30. L'application d'exemple se compile avec elle, avec 0 erreur et 0 avertissement.
* Deux éditeurs, l'un en Variant et l'autre en RawData, de dix-sept champs chacun. Chaque valeur sur le réseau est égale à ce que l'automate indique par son propre serveur OPC UA, sans aucun trou dans les numéros de séquence.
* Une pile PubSub indépendante décode entièrement le message Variant et les scalaires RawData. Elle ne sait pas lire un tableau RawData ni une longue chaîne RawData, ce qui est sa limite et non celle de la bibliothèque.
* L'abonné de HotLoop core (depuis sa branche main au moment de l'essai, et dans HotLoop core 4.19.4 et toutes les versions suivantes) lit les deux éditeurs, y compris la chaîne, le TIME, les deux tableaux et deux compteurs qui bougent entre les lectures, et ne refuse rien.
* Un second décodeur lit les 222 datagrammes capturés.
* Coût sur une tâche de 20 ms, avec deux éditeurs : environ 10,6 us ajoutées par cycle en moyenne. Un cycle qui envoie coûte de 10 à 100 us. La queue de distribution est l'appel `sendto`, et sur un hôte partagé chargé elle a atteint une fois 14,3 ms sur 12 000 cycles. Placez l'éditeur dans sa propre tâche, de priorité plus basse, si cela compte pour la logique de votre commande. La [page sur les temps](/fr/transmitter/timing/) donne le tableau.

## Ce qu'il faut vérifier sur votre contrôleur

* La gestion de l'ordre des octets pour une cible big endian est écrite, vérifiez-la donc sur votre propre contrôleur.
* Multicast : le bloc règle le TTL, le bouclage et l'interface d'envoi pour le groupe, vérifiez donc le groupe sur votre propre réseau.
* Si le réseau disparaît ou si une adresse est absente, le bloc compte l'échec et espace ses essais, et le programme continue de scruter.
* En mode démo, le runtime s'arrête à la fin de sa fenêtre de deux heures, comme l'indique CODESYS.

## Absent de cette version

Les horodatages de DataSetMessage et de NetworkMessage, KeepAlive et les Delta Frames, plus d'un DataSetMessage par NetworkMessage, WSTRING, un état par champ, la sécurité des messages et le côté abonné. La [feuille de route](/fr/transmitter/roadmap/) dit lesquels viennent ensuite.

## Si vous venez d'un autre éditeur

Un récepteur qui exige un horodatage, un KeepAlive ou une Delta Frame ne sera pas satisfait par cette version, car aucun n'est envoyé. Chaque message est une Key Frame, que n'importe quel récepteur peut lire à froid. Un tableau RawData est ici une longueur Int32, les éléments, puis du remplissage de zéros jusqu'à la taille déclarée, ce qui est la façon dont la pile de référence de l'OPC Foundation l'écrit. Un récepteur qui attend un tableau sous forme d'éléments bout à bout sans longueur doit être informé que les champs sont des scalaires séparés.

## Pour un projet qui l'utilise déjà

Il n'y a pas de version antérieure. Le format sur le réseau ne change que lorsque `udiConfigMajor` change, et un projet d'automate figé sur cette version de la bibliothèque garde les mêmes champs et les mêmes octets.

## Fichiers

Téléchargez les deux fichiers et `SHA256SUMS` depuis https://hotloop.io/hotloop-transmitter/1.0.0/HotLoopTransmitter-1.0.0.library, puis installez `HotLoopTransmitter-1.0.0.library` par Outils, Dépôt de bibliothèques, Installer dans CODESYS 3.5 SP22 ou une version ultérieure. Le `.compiled-library` est la même bibliothèque sans son code source.

```
91b8023a73870925082c170588feb43d363e6d07ce008e1471fa8f5ff8db2c0d  HotLoopTransmitter-1.0.0.library
b02b0b40e434f35e4af1def20d6cc38688463537c4800354931b8c6094a66686  HotLoopTransmitter-1.0.0.compiled-library
```
