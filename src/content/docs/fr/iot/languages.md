---
title: "Langues de l'interface web"
description: "L'interface web en anglais et treize autres langues, l'arabe étant disposé de droite à gauche, à choisir dans la barre du haut ou sur la carte de connexion."
---

L'interface web de HotLoop IoT, Edge et Gateway (et de HotLoop for CODESYS, qui exécute l'interface d'Edge) existe en anglais et en 13 autres langues : espagnol (es), français (fr), italien (it), allemand (de), norvégien bokmål (nb), bulgare (bg), grec (el), coréen (ko), japonais (ja), vietnamien (vi), hindi (hi), chinois simplifié (zh-Hans) et arabe (ar, disposé de droite à gauche).

Choisissez-en une dans la liste des langues de la barre du haut, ou sur la carte de connexion. Le choix est conservé dans ce navigateur. Sans choix, la page prend la première des langues du navigateur que HotLoop propose, et l'anglais si aucune ne correspond. Une langue n'apparaît dans la liste que lorsque son fichier est complet.

Ce qui suit la langue : chaque mot de chaque écran, l'ordre et les signes des nombres (une virgule décimale en allemand, en français et en espagnol), les dates et les heures (horloge de 24 heures), les formes du pluriel (l'arabe en a six) et le sens de la page. Les noms de produits et de protocoles (HotLoop, Modbus, OPC UA, MQTT, Sparkplug, CODESYS, UniFi) restent tels qu'écrits. Les valeurs de l'usine, comme les noms de tags, les noms d'appareils, les messages d'alarme saisis par quelqu'un et le texte d'erreur renvoyé par le serveur, sont affichées telles quelles.

## Pensé pour ceux qui l'utilisent

* Chaque écran est dessiné à partir d'un message par phrase, si bien qu'une langue n'est jamais une demi-page de ses propres mots et une demi-page d'anglais. Une langue n'apparaît dans le sélecteur que lorsque chaque écran est complet.
* Les pluriels suivent les règles CLDR d'Unicode pour chaque langue, si bien que "1 appareil", "2 appareils" et les six formes de l'arabe se lisent comme un locuteur natif s'y attend.
* Les nombres et les dates viennent du formatage propre au navigateur pour la langue choisie, si bien qu'un lecteur allemand voit 1.234,5 et un lecteur américain voit 1,234.5.
* Changer de langue redessine tous les écrans d'un coup, sans rechargement. L'anglais fait partie de la page et se charge avec elle ; chaque autre langue n'est récupérée que quand quelqu'un la choisit, si bien qu'une usine qui travaille dans une seule langue ne télécharge jamais les douze autres.
* La mise en page se retourne toute seule pour l'arabe : marges, alignement et espacement s'inversent avec la langue.

Un test de navigateur de la suite complète le prouve sur la vraie page. Il ouvre HotLoop dans chaque langue à une largeur de bureau et de téléphone et parcourt tous les écrans. Le sens est correct, rien ne défile sur le côté, aucun message ne s'affiche comme un espace réservé, les nombres se lisent à la manière de la langue, et le choix survit à un rechargement.

## Ce qui n'est pas traduit

* Le texte envoyé par le serveur : les messages d'erreur de l'API, les messages de notification et d'alarme, et la CLI. L'interface les affiche tels qu'ils arrivent.
* La documentation, les noms du serveur OPC UA, le broker MQTT et les valeurs du chart Helm.
