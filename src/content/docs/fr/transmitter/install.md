---
title: "Installer HotLoop Transmitter"
description: "Installez la bibliothèque dans le dépôt de bibliothèques CODESYS, ajoutez-la à un projet, et voyez quoi faire quand le bloc signale une erreur."
---

Il vous faut un système de développement CODESYS 3.5 SP22 ou ultérieur, et un runtime dont la cible possède les composants SysSocket et SysTimeRtc, que les runtimes CODESYS Control pour Linux SL fournissent (le second est nouveau en 1.1.0, pour l'horodatage).

## Depuis le CODESYS Installer

Depuis 1.1.0, la version comprend aussi `HotLoopTransmitter-1.1.0.package`, à l'adresse https://hotloop.io/hotloop-transmitter/1.1.0/HotLoopTransmitter-1.1.0.package. Installez-le avec le CODESYS Installer (dans l'IDE : Tools, CODESYS Installer), ou sans fenêtre avec sa ligne de commande, `PackageManagerCLI.exe --profile="<your profile>" --install=<file>.package --targetProfiles="<your profile>"`. L'Installer place la bibliothèque dans le dépôt de bibliothèques de ce profil, sous la société HotLoop, et vous passez à l'étape 3 ci-dessous. Le paquet est la même bibliothèque que le fichier `.library`, dans un ZIP que lit l'Installer, donc les deux voies donnent la même bibliothèque.

## Depuis le fichier de bibliothèque

1. Téléchargez `HotLoopTransmitter-1.1.0.library` depuis https://hotloop.io/hotloop-transmitter/1.1.0/HotLoopTransmitter-1.1.0.library, et vérifiez-le avec `SHA256SUMS` dans le même dossier (`sha256sum -c SHA256SUMS`).
2. Dans l'IDE CODESYS : Tools, Library Repository, Install, puis choisissez le fichier. Elle est maintenant dans le dépôt sous la société HotLoop.
3. Dans votre projet, ouvrez le Library Manager de l'application, Add Library, et choisissez HotLoop Transmitter. SysSocket, SysTimeRtc et leurs bibliothèques d'interface arrivent avec elle comme dépendances et ne demandent rien de votre part.
4. Déclarez un `HLTX.FB_HLTX_Publisher`, ajoutez vos champs, appelez-le à chaque cycle (le README donne l'exemple).
5. Téléchargez vers le contrôleur. La destination doit être joignable depuis le réseau du contrôleur ; pour le multicast, les commutateurs du réseau doivent acheminer le groupe.

Le fichier `.compiled-library` est la même bibliothèque sans son source. Installez celui-là si vous ne voulez pas que le Structured Text soit visible dans le Library Manager. Il est dans le même dossier, sous le nom `HotLoopTransmitter-1.1.0.compiled-library`.

Pour vérifier ce qui arrive, n'importe quel récepteur UDP sur le port de destination convient. Un petit programme Go qui écoute sur un port ou rejoint un groupe multicast et affiche chaque datagramme sous forme d'une ligne JSON avec son hexadécimal fonctionne très bien.

## Si le bloc signale une erreur

| `eError` | Signification | À faire |
|---|---|---|
| `NoFields` | aucun champ n'a été ajouté | appelez une méthode `Add` avant d'activer |
| `BadInterval` | `tPublishingInterval` est inférieur à 1 ms | renseignez-le |
| `BadAddress` | `sDestination` n'est pas une adresse IPv4 en notation pointée | corrigez-la |
| `SocketCreate`, `SocketOption` | le runtime a refusé un appel de socket ; `diLastSocketResult` donne son code | le bloc réessaie seul après `tRetry` |
| `TooBig` | les champs ne tiennent pas dans 1472 octets | publiez-en moins, ou utilisez deux éditeurs avec des writer id différents |
| `BadField` | une adresse stockée a été effacée | `Clear()` puis ajoutez de nouveau les champs |
