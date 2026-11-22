---
title: "Importer un écran CODESYS"
description: "Exportez une visualisation CODESYS depuis l'IDE et importez-la comme écran HotLoop sur les variables de l'automate, avec les éléments non placés en tête."
---

Vos opérateurs ont déjà un écran CODESYS. Exportez-le depuis l'IDE, importez-le dans HotLoop, et il s'ouvre comme un écran HotLoop sur les variables du même automate. C'est la sortie de WebVisu : l'automate continue d'exécuter son programme, HotLoop le lit par le connecteur OPC UA, et l'écran est celui de HotLoop. HotLoop for CODESYS exécute Edge, donc c'est aussi son import.

## L'utiliser

Dans l'IDE CODESYS, sélectionnez la visualisation dans l'arborescence du projet et utilisez **Projet, Exporter** (l'export natif de CODESYS, un fichier `.export`). Pas **Exporter PLCopenXML** : ce fichier ne contient aucune visualisation, et HotLoop vous le dit si vous le choisissez.

Sur l'écran Tableaux de bord, **Importer**, choisissez le fichier `.export`, **Lire le fichier**. Il vous indique :

* la visualisation trouvée (un fichier qui en contient plusieurs vous demande laquelle),
* chaque tag que l'écran lit et que cette installation n'a pas. Les variables arrivent sous la forme `plc/<GVL>.<variable>` : associez l'appareil `plc` à l'appareil HotLoop sur lequel se trouve l'automate et tous les tags suivent d'un coup, ou associez les tags un par un,
* **à vérifier** : chaque élément qu'il n'a pas pu placer à l'écran, avec la raison, avant que rien ne soit enregistré.

Rien n'est enregistré tant que rien ne gêne. L'import demande `dashboards.write`, et un bouton ou une consigne sur un tag non marqué comme inscriptible est refusé ici, comme dans une construction, de sorte que l'écran n'a jamais une commande que la porte refuserait.

Par l'API, c'est `POST /api/dashboards/import` avec `codesys` (le texte du fichier) à la place de `file`, et `visualization` pour en nommer une parmi plusieurs :

```json
{"codesys": "<ExportFile>...", "visualization": "Overview", "dryRun": true,
 "remap": {"devices": {"plc": "line-3"}}}
```

Le rapport comporte les habituels `problems`, `warnings` et `remapped`, et un `conversion` avec `mapped` (chaque élément et ce qu'il est devenu) et `unmapped` (chaque élément et pourquoi non).

## Ce qui passe

| Élément CODESYS | Dans HotLoop |
|---|---|
| Rectangle, rectangle arrondi, ellipse avec texte et une variable (`Temperature: %2.1f C`) | un afficheur : le tag de la variable, le texte avant elle comme légende, le texte après comme unité, les décimales issues du format |
| La même chose avec du texte et sans variable | une étiquette |
| Voyant | un voyant, allumé par la variable et coloré d'après la propre couleur du voyant (rouge est un défaut, jaune un avertissement, bleu une information, toute autre un voyant de marche). `NOT x` lit le tag dans l'autre sens |
| Indicateur, potentiomètre | un afficheur de la variable. Un bouton qui réglait une valeur reçoit aussi une carte de consigne avec l'échelle du cadran comme limites |
| Interrupteur à bascule, bascule, bouton-poussoir | un voyant qui montre l'état et une carte bouton : marche et arrêt pour une bascule, la valeur unique pour une pression |
| Polygone, polyligne et formes sans texte et sans variable (les tuyaux, la cuve, les cadres) | l'image derrière les symboles, dessinée d'après leurs points et leurs couleurs |
| Groupe | ses membres, placés à partir du coin du groupe |

Chaque élément garde sa place en pixels : la page est la carte des symboles, dessinée comme une seule image mise à l'échelle, donc l'écran garde sa forme à toute taille et sur un téléphone.

## Ce qui ne passe pas

Dit dans l'import, une ligne chacun, jamais abandonné en silence :

* un type d'élément sans symbole HotLoop (une courbe, un tableau, un curseur, un élément image et le reste de la boîte à outils),
* une variable qui est une expression (`Temp * 2`, `a AND b`, un élément de tableau) : HotLoop affiche un tag, donc ajoutez un tag pour l'expression et pointez un afficheur dessus,
* une règle de visibilité, de couleur ou de mouvement pilotée par une valeur de l'automate : le symbole est là tout le temps et ne change pas de couleur,
* une courbe de Bézier est dessinée en lignes droites entre ses points, et un élément pivoté n'est pas pivoté,
* la taille de la page, que l'export ne contient pas : la page est aussi grande que l'élément le plus extérieur, plus une marge,
* un texte de plus de 40 caractères est coupé, et les cadrans sont des nombres, pas des cadrans.

Les styles de texte, les polices et les couleurs du style CODESYS sont ceux de HotLoop : l'écran suit le thème de HotLoop.

## Comment il lit le fichier

CODESYS documente que l'export natif existe et qu'il est en XML, et ne documente pas ce qu'il contient. Le lecteur d'ici suit ce que l'IDE écrit lui-même (CODESYS 3.5 SP22, Visualization 4.10) : chaque élément stocke ses réglages comme une liste de membres numérotés, et le numéro est le CRC-32 du chemin du membre dans la description de l'élément, tel que `m_StaticPosition.iX`, que l'IDE installe à côté de lui. Les tests contiennent des valeurs lues dans l'export de l'IDE lui-même. Un réglage qui porte une variable et n'est pas lu est signalé comme ci-dessus, de sorte qu'un écran n'est jamais importé comme complet quand il ne l'est pas.

## L'étape suivante

Ouvrez l'écran, comparez les afficheurs avec l'usine et placez les cartes de consigne et de bouton là où vos opérateurs les attendent. Un écran construit à la main et un écran importé sont la même chose à partir de là : il s'exporte comme un [fichier d'écran](/fr/iot/screen-file/), se versionne à chaque enregistrement et passe à une autre installation de la même façon.
