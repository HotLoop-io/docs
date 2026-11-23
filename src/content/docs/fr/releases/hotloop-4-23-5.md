---
title: "Notes de version: HotLoop core 4.23.5"
description: "Ce qu'apporte HotLoop core 4.23.5, ce qui change à la mise à jour et ce qu'il faut lire avant de toucher une usine en production."
sidebar:
  label: "4.23.5"
---

Construite pour amd64 seulement.

L'écran UniFi redemande à HotLoop au rythme de quatre secondes, et un battement qui partait alors que la question que quelqu'un avait pressée était encore en route prenait la place de la réponse, si bien que la vue restait sur son squelette pendant toute la question du battement aussi, et un autre battement pouvait recommencer. Le battement attend maintenant la question qui est partie. Un test de navigateur retient chaque réponse d'UniFi pendant trois secondes et compte les questions qui partent pour un appui : deux avant le correctif, une après, deux de nouveau avec le correctif retiré.

## Ce qui a changé

- **Le rafraîchissement de l'écran UniFi attend la vue qui se charge.** Une vue qui met plus longtemps que le battement de quatre secondes à répondre est interrogée une fois, pas une fois par battement.

Depuis la 4.23.4, reporté ici :

L'import d'écrans passe de CODESYS à TwinCAT. Un fichier `.TcVIS`, et les exports de cds-text-sync et de codescribe, arrivent comme un écran HotLoop avec leurs boutons, cadres et voyants, et ce qui n'a pas pu passer est listé avec son texte avant d'enregistrer quoi que ce soit. Construite pour amd64 seulement ; la construction multi-architecture suit comme version suivante.

- **Les écrans TwinCAT s'importent.** Un fichier TwinCAT `.TcVIS` est la même visualisation dans le XML d'archive de l'IDE, donc il passe par le convertisseur CODESYS. Vérifié sur le vrai exemple TwinCAT PackML (trois écrans, MIT, licence conservée à côté) : 60 éléments associés, aucun non associé. Voir [Import a CODESYS screen](/fr/iot/codesys-screen-import/).
- **Boutons.** Chaque affectation simple dans l'action d'entrée d'un bouton (`X := 5`, `X := TRUE`, un membre d'énumération) devient une carte bouton qui écrit cette valeur, avec la légende comme étiquette. Une entrée Toggle configurée devient un bouton marche et un bouton arrêt. Le code qui est plus qu'une affectation (une condition, un appel, de l'arithmétique) est signalé avec son texte. Les énumérations OMAC PackML sont connues ; toute autre va dans `enums` de l'import, et un membre sans numéro connu est écrit par son nom et on le dit.
- **Voyants et masquage par une expression.** La variable d'un voyant ou une variable d'invisibilité peut être une comparaison d'un tag avec un nombre, TRUE, FALSE ou un membre d'énumération, reliés par NOT, AND et OR et des parenthèses. Une comparaison de deux tags, l'arithmétique et les appels ne peuvent pas être repris et sont signalés.
- **Cadres.** Un cadre affiche une autre visualisation. Envoyez les autres fichiers du projet avec le premier (`codesysRelated` ; dans la boîte de dialogue, choisissez plusieurs fichiers et le premier est l'écran) et la visualisation du cadre est placée dans le cadre, chaque entrée liée à la variable donnée au cadre.
- **Les règles de symboles se combinent.** Une règle `show` ou `colors` peut être `{"all": [...]}` ou `{"any": [...]}`, le AND et le OR d'un automate, sur trois niveaux de profondeur et huit parties, et un tag perdu fait qu'un `all` ne tient pas tandis qu'un `any` tient grâce aux autres. Un voyant peut porter une règle `lit` à la place de son tag. Voir [Tableaux de bord](/fr/iot/dashboards/).
- **Tests.** Le test du compteur d'énergie borne ce que les compteurs ont compté par le temps réellement écoulé, et non par dix secondes fixes.

## Migrations

Aucun.

## Changements de l'API

`POST /api/dashboards/import` accepte `codesysRelated` et `enums` à côté de `codesys`. Aucune route n'a changé. Voir [l'API HTTP](/fr/iot/api/).

## Mise à jour depuis la 4.23.3

Un `helm upgrade` simple. Pas de migration et pas de nouveau secret. La 4.23.4 n'a jamais été publiée.

## Ce qui n'est pas éprouvé

- Les importeurs ont été éprouvés contre l'exemple TwinCAT PackML et les exports d'exemple de cds-text-sync et de codescribe, pas contre le projet propre d'un client. Un projet qui utilise davantage du langage de visualisation listera davantage d'éléments qu'il n'a pas pu placer.
- Les expressions sont des comparaisons d'un tag avec une constante reliées par NOT, AND et OR. Tout le reste est signalé, pas deviné.
