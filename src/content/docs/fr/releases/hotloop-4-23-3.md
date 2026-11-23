---
title: "Notes de version: HotLoop core 4.23.3"
description: "Ce qu'apporte HotLoop core 4.23.3, ce qui change à la mise à jour et ce qu'il faut lire avant de toucher une usine en production."
sidebar:
  label: "4.23.3"
---

Un écran WebVisu garde son masquage et ses couleurs d'alarme à l'arrivée, et n'importe quel symbole de n'importe quel écran peut maintenant être affiché et coloré par une règle sur un tag. Un petit correctif de la liste des sauvegardes l'accompagne. Construite pour amd64 seulement ; la construction multi-architecture suit comme version suivante.

## Ce qui a changé

- **Un symbole peut être affiché et coloré par des règles.** `show` ne dessine un symbole que tant qu'une règle sur un tag est vraie, si bien qu'une porte, un carter ou une pompe dessinés pour un état n'existent que dans cet état. `colors` fait jusqu'à quatre règles, chacune avec une teinte (`ok`, `warn`, `bad` ou `info`) : la première qui est vraie colore le symbole de cette teinte, et quand aucune n'est vraie il est dessiné comme avant. Une règle est un tag et une comparaison (`on`, `off`, `eq`, `ne`, `gt`, `ge`, `lt`, `le`). Une règle dont le tag n'a pas de bonne mesure n'est vraie pour rien et ne cache rien, si bien qu'une connexion perdue ne fait jamais disparaître un symbole. Le formulaire de symboles du constructeur a les deux, et un fichier d'écran liste et déplace les tags des règles avec le reste. Voir [Tableaux de bord](/fr/iot/dashboards/).
- **L'import d'écran CODESYS reprend Invisible et Toggle color.** La variable Invisible d'un élément (et celle de son groupe) devient une règle `show`, avec `NOT x` pour l'inverser, et sa variable Toggle color devient une règle `colors` dans la teinte la plus proche de la propre couleur d'alarme de l'élément. Elles se trouvent aux ids que donnent les propres arbres d'éléments de l'IDE CODESYS. Ce qu'il ne peut pas reprendre est dit dans l'import, avec la variable : ces deux-là sur une forme dessinée dans l'image de fond (un tuyau, un réservoir, un cadre), parce que l'image est une seule image, et tout autre réglage piloté par variable (un remplissage, une couleur de cadre ou de texte, un mouvement, un clignotement, une liste de textes). Voir [Import a CODESYS screen](/fr/iot/codesys-screen-import/).
- **La liste des sauvegardes n'échoue plus pendant qu'une sauvegarde est élaguée.** La sauvegarde planifiée élague les anciennes sauvegardes dans sa propre goroutine, et un listage qui tombait au milieu échouait sur le fichier manquant, ce que l'API répondait comme une erreur serveur. Une sauvegarde partie est maintenant laissée hors de la liste.

## Migrations

Aucun.

## Changements de l'API

La configuration d'un symbole accepte `show` et `colors`. Aucune route n'a changé. Voir [l'API HTTP](/fr/iot/api/).

## Mise à jour depuis la 4.23.2

Un simple `helm upgrade`. Pas de migration et aucun nouveau secret. Un symbole sans aucune des deux règles est dessiné comme avant.

## Ce qui n'est pas éprouvé

- L'import CODESYS a été éprouvé contre l'export de l'IDE lui-même d'une visualisation et la variable de groupe de l'exemple Refrigerator de CODESYS. Un écran d'un autre projet peut lister davantage d'éléments qu'il n'a pas pu placer.
- Les nouvelles règles de symboles ont été éprouvées par les tests de la suite, pas sur l'écran d'une usine.
