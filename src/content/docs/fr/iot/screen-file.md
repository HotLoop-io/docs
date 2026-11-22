---
title: "Fichiers d'écran"
description: "Exportez un tableau de bord vers un fichier et importez-le ailleurs, avec chaque tag, appareil et script listé et une correspondance pour les noms différents."
---

Un écran appartient au client, et il voyage sous forme de fichier. Exportez un tableau de bord depuis une installation, importez-le dans une autre, et rien de lui ne vit dans le code de HotLoop : ni la mise en page, ni les noms des tags, ni le texte. Le même fichier fonctionne dans HotLoop IoT, Edge et Gateway, car ils exécutent un seul jeu de tableaux de bord ([Tableaux de bord](/fr/iot/dashboards/)).

Edge Relay n'a ni interface ni écrans. Le tableau de bord de Flow fait partie de ses flux, qui ont leur propre Importer et Exporter. Pour HotLoop for CODESYS, les écrans sont ceux d'Edge.

## L'utiliser

Sur l'écran Tableaux de bord, **Exporter** (à côté de Modifier, pour le tableau de bord affiché) enregistre `<id>.hotloop-screen.json`. **Importer** (dans la barre à côté de Nouveau tableau de bord) lit un fichier, vous dit ce dont il a besoin et ce qui manque ici, vous laisse associer chaque tag, appareil, entité, script ou recette manquant à un qui existe, vérifie à nouveau et l'enregistre. L'import demande `dashboards.write`, c'est donc l'affaire d'un administrateur. L'export demande `dashboards.read` et le tableau de bord doit en être un qu'on vous propose.

Par l'API, [`GET /api/dashboards/{id}/export`](/fr/iot/api/#get-apidashboardsidexport) et [`POST /api/dashboards/import`](/fr/iot/api/#post-apidashboardsimport), ce que l'écran appelle. Un import n'enregistre jamais ce que la construction du même tableau de bord refuserait.

## Le fichier

JSON en UTF-8, jusqu'à 4 MiB.

```json
{
  "format": "hotloop-screen",
  "formatVersion": 1,
  "exported": { "product": "edge", "version": "4.22.1", "at": "2026-11-19T16:00:00Z" },
  "screen": {
    "id": "line-2",
    "name": "Line 2",
    "kind": "cards",
    "roles": ["operator", "admin"],
    "homeFor": ["operator"],
    "screens": ["line-2-panel"],
    "position": 1,
    "cards": [
      { "id": "temp", "type": "gauge", "title": "Zone 1", "w": 3, "h": 3, "config": { "tag": "press-01/Zone1_Temp" } }
    ]
  },
  "requires": {
    "tags": [ { "key": "press-01/Zone1_Temp", "dataType": "float", "unit": "C", "writable": false } ],
    "entities": [], "scripts": [], "recipes": [], "devices": [], "equipment": []
  }
}
```

**`format` et `formatVersion`.** `format` vaut toujours `hotloop-screen`. `formatVersion` est un nombre entier à partir de 1. Un HotLoop lit sa propre version et les plus anciennes, et refuse une plus récente en disant quelle version est le fichier et laquelle il lit. Un champ ajouté au fichier est une nouvelle version, car un lecteur refuse un champ qu'il ne connaît pas : un champ abandonné sans un mot est pire qu'un refus. Ceci est la version 1.

**`exported`.** Quel produit et quelle version l'ont écrit, et quand. Pour la personne qui lit le fichier. Rien n'en est décidé : ce sont les types de cartes qui décident si un HotLoop peut afficher l'écran, et un type de carte inconnu est refusé par son nom.

**`screen`.** Le tableau de bord tel que l'API des tableaux de bord le conserve, sans la comptabilité propre à l'installation (`version`, `updatedBy`, `createdAt`, `updatedAt`). `description` est omise quand elle est vide. Les cartes sont dans l'ordre de lecture, chacune avec sa taille (`w` sur 12 colonnes, `h` en lignes) et son `config`, exactement comme [Tableaux de bord](/fr/iot/dashboards/#les-cartes) décrit chaque type. La mise en page, c'est cela : un flux de cartes, jamais des coordonnées en pixels. Une carte de symboles place ses symboles au pixel sur sa propre page, dans son config.

**Les ressources sont à l'intérieur.** Un plan sur une carte de plan et l'arrière-plan d'une carte de symboles sont des URL de données PNG en base64 dans le `config` de la carte, donc un seul fichier est l'écran entier, et l'envoyer, c'est aussi envoyer l'image. Les limites sont celles du tableau de bord : 700 Ko par image et 2 MiB par écran.

**`requires`.** Ce dont l'écran a besoin de l'installation où il atterrit, calculé à partir des cartes : chaque tag qu'il lit (avec le type et l'unité qu'il avait là où il a été exporté, et si un bouton ou une consigne y écrit) et les ids d'entités, de scripts, de recettes, d'appareils et d'équipements que les cartes citent. C'est pour les personnes et pour les outils qui veulent regarder avant d'importer. L'import le recalcule à partir des cartes et ne se fie jamais à ce bloc. Quand le type d'un tag dans le fichier diffère de celui du tag où il atterrit, c'est un avertissement.

**Le tableau mural n'est pas exporté.** C'est l'ensemble des jauges épinglées d'une installation, pas une mise en page. L'exporter donne un `400`, et un fichier dont le `kind` est `wall` est refusé.

**Affectations.** `roles`, `homeFor`, `screens` et `position` sont dans le fichier pour qu'un écran revienne comme il est parti. Ils sont aussi la partie la plus liée à une installation : le nom d'un panneau appartient à un seul tableau de bord sur une installation, et un rôle a un seul accueil. Un import les applique, et le dit (`assignment`) quand cette installation donne déjà ce nom d'écran ou l'accueil de ce rôle à un autre tableau de bord. **Ignorer les affectations** laisse de côté `screens` et `homeFor` et garde `roles`.

## Importer

Les vérifications s'exécutent dans cet ordre, et rien n'est enregistré tant qu'elles ne sont pas toutes passées :

1. **Le fichier.** JSON, le bon `format`, une version que cette build lit, aucun champ qu'elle ne connaît pas, type `cards`.
2. **Vos modifications.** Un nouvel id ou nom, pas d'affectations, et la **correspondance** : `tags` (clé entière vers clé entière, telle que le fichier nomme le tag ou telle qu'elle se lit une fois l'appareil déplacé), `devices` (id vers id ; déplace aussi la partie appareil de tout tag que la correspondance `tags` ne nomme pas, donc faire passer un écran d'un automate à un autre tient en une entrée), `entities`, `scripts`, `recipes` et `equipment` (les ids sont des nombres qui n'ont de sens que là où ils ont été créés, donc ils sont associés un par un). Le texte de légende d'une tendance suit son tag. Une entrée de correspondance qu'aucune carte n'a utilisée est un avertissement, car une correspondance qui n'a rien fait est la façon dont un écran finit par pointer vers l'ancien.
3. **Les règles propres au tableau de bord.** Id, nom, le config de chaque carte, les tailles, la limite d'octets, sous la forme où il est stocké.
4. **Tout ce que les cartes citent, sans exception.** Chaque tag, entité, script, recette, appareil et id d'équipement manquant est listé, pas seulement le premier, de sorte qu'une passe dit quoi associer. Un bouton ou une consigne sur un tag non inscriptible est `writable`. Une valeur de bouton ou une limite de consigne hors de la plage du tag et un rôle qui n'existe pas sont `screen`.
5. **L'id et les affectations.** Un id déjà pris est `exists`, sauf si vous avez demandé de le **remplacer**, ce qui enregistre par-dessus ce tableau de bord à la version qu'il a maintenant (donc un enregistrement fait pendant que vous regardiez est un `409`, pas un écrasement).

Un essai à blanc fait tout cela et n'enregistre rien. L'import est journalisé comme un événement `config` sur le tableau de bord : qui, depuis quel produit et quelle version, combien de cartes.

## Déplacer un écran

Exportez sur la première installation. Sur la seconde, assurez-vous que les appareils et les tags que l'écran lit existent (ils portent des adresses qui appartiennent à l'usine, donc un fichier d'écran ne les emporte pas). Importez. Si les noms de tags diffèrent, associez-les dans la boîte de dialogue, ou associez l'appareil si seul cela diffère. L'écran s'ouvre sur la seconde installation tel qu'il était sur la première.

## Une visualisation CODESYS

Le même import lit une visualisation CODESYS (l'export natif de l'IDE) et en fait l'écran, en disant ce qu'il a laissé de côté : [Importer un écran CODESYS](/fr/iot/codesys-screen-import/).

## Ce qui n'est pas dans la version 1

Les appareils et les tags que lit un écran (leurs adresses sont celles de l'usine, pas de l'écran), le tableau mural, plusieurs écrans dans un fichier et une signature sur le fichier. Un fichier est du JSON simple : lisez-le avant d'en importer un qu'on vous a envoyé.
