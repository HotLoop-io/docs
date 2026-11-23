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
| La variable **Invisible** d'un élément (`bInvisible`), ou celle de son groupe | une règle `show` sur le symbole : il n'est dessiné que tant que la variable dit que l'élément serait visible (`NOT x` l'inverse) |
| La variable **Toggle color** d'un élément | une règle `colors` sur le symbole : tant que la variable est active, il est peint de la teinte la plus proche de la couleur d'alarme de l'élément (le rouge est `bad`, le jaune et l'orange `warn`, le bleu `info`, le vert `ok` ; un élément sans couleur d'alarme propre est `bad`, comme le cadre d'alarme par défaut de CODESYS est rouge) |

Chaque élément garde sa place en pixels : la page est la carte des symboles, dessinée comme une seule image mise à l'échelle, donc l'écran garde sa forme à toute taille et sur un téléphone.

## Ce qui ne passe pas

Dit dans l'import, une ligne chacun, jamais abandonné en silence :

* un type d'élément sans symbole HotLoop (une courbe, un tableau, un curseur, un élément image et le reste de la boîte à outils),
* une variable qui est une expression (`Temp * 2`, `a AND b`, un élément de tableau) : HotLoop affiche un tag, donc ajoutez un tag pour l'expression et pointez un afficheur dessus,
* une variable d'invisibilité ou de changement de couleur sur une forme dessinée dans l'image d'arrière-plan (un tuyau, un réservoir, un cadre) : l'image est une seule image, donc la forme est toujours là et garde sa couleur. Dit dans l'import, avec la variable,
* tout autre réglage piloté par une valeur de l'automate (une variable de couleur pour le remplissage, le cadre ou le texte, un mouvement, un clignotement, une liste de textes) : le symbole est là comme il a été dessiné, et la règle est signalée quand sa variable est une variable simple,
* une courbe de Bézier est dessinée en lignes droites entre ses points, et un élément pivoté n'est pas pivoté,
* la taille de la page, que l'export ne contient pas : la page est aussi grande que l'élément le plus extérieur, plus une marge,
* un texte de plus de 40 caractères est coupé, et les cadrans sont des nombres, pas des cadrans.

Les styles de texte, les polices et les couleurs du style CODESYS sont ceux de HotLoop : l'écran suit le thème de HotLoop.

## Comment il lit le fichier

CODESYS documente que l'export natif existe et qu'il est en XML, et ne documente pas ce qu'il contient. Le lecteur d'ici suit ce que l'IDE écrit lui-même (CODESYS 3.5 SP22, Visualization 4.10) : chaque élément stocke ses réglages comme une liste de membres numérotés, et le numéro est le CRC-32 du chemin du membre dans la description de l'élément, comme `m_StaticPosition.iX`, que l'IDE installe à côté de lui. Les arbres d'éléments de l'IDE listent chaque chemin avec son id (`ITypeNode.CompletePath` et `CRCIdNumber`) ; les ids de la variable d'invisibilité (`m_pStateVariables..State.bInvisible`, 2880254039) et de la variable de changement de couleur (`m_pColorVariables..ToggleColor`, 1999528970) viennent de là, et le premier est l'id sous lequel l'exemple Refrigerator de CODESYS stocke le `NOT Glob_Var.DoorOpen` de son groupe. Les tests contiennent des valeurs lues dans l'export de l'IDE lui-même. Un réglage qui porte une variable et n'est pas lu est signalé comme ci-dessus, si bien qu'un écran n'est jamais importé comme complet quand il ne l'est pas.

## L'étape suivante

Ouvrez l'écran, comparez les afficheurs avec l'usine et placez les cartes de consigne et de bouton là où vos opérateurs les attendent. Un écran construit à la main et un écran importé sont la même chose à partir de là : il s'exporte comme un [fichier d'écran](/fr/iot/screen-file/), se versionne à chaque enregistrement et passe à une autre installation de la même façon.

## Visualisations TwinCAT (.TcVIS)

Un fichier `.TcVIS` de TwinCAT est la même visualisation dans le XML d'archive d'objets de l'IDE, avec les mêmes types d'éléments et les mêmes ids de membres, donc il passe par le même convertisseur. Vérifié avec le vrai exemple PackML de TwinCAT.

- Boutons : chaque affectation simple dans l'action d'entrée d'un bouton (`X := 5`, `X := TRUE`, `X := E_PMLCommand.ePMLCommand_Start`) devient une carte bouton qui écrit cette valeur dans X, et la légende passe comme libellé. Une entrée Toggle configurée devient la paire de boutons, marche et arrêt. Le code qui est plus qu'une affectation (une condition, un appel, un calcul) est signalé avec son texte.
- Énumérations : les membres OMAC PackML (`E_PMLCommand`, `E_PMLUnitMode`) sont connus, avec les numéros de la configuration PackML_HMI_Example de Beckhoff et de la déclaration `E_PMLUnitMode` de SPT-Libraries. Toute autre énumération va dans les `enums` de l'import (`{"E_Own.eOwn_Go": 7}`). Un membre sans numéro connu est écrit par son nom et le rapport le dit.
- Expressions : la variable d'un voyant et une variable d'invisibilité peuvent être une comparaison d'un tag avec un nombre, TRUE, FALSE ou un membre d'énumération (`=`, `<>`, `<`, `<=`, `>`, `>=`), NOT, AND et OR, avec des parenthèses. Elles deviennent une règle de symbole (voir DASHBOARDS.md : la règle `lit` d'un voyant, les règles `show` et `colors` d'un symbole, qui peuvent combiner des règles avec `all` et `any`). Une comparaison de deux tags, un calcul et des appels ne peuvent pas être exprimés et sont signalés avec la partie qui n'a pas pu l'être.
- Cadres : un cadre montre une autre visualisation. Envoyez les autres fichiers du projet avec le premier (`codesysRelated` dans l'API ; dans la boîte de dialogue, choisissez plusieurs fichiers et le premier est l'écran). La visualisation du cadre est placée dans le cadre, chaque entrée qu'elle prend étant liée à la variable donnée au cadre (le `HMI` de V_Module devient `MAIN.VFFSDemo.Sealer.PackMLBaseModule_HMI`). Un cadre dont la visualisation ne figure pas parmi les fichiers est signalé avec son nom.

L'ensemble PackML (V_Main avec V_Module et V_MachineModule) : 60 éléments mappés, aucun non mappé.
