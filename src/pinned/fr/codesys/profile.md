---
title: "Le profil"
description: "La seule entrée de HotLoop for CODESYS : un JSON avec révision, l'appareil et ses variables, les alarmes et un écran, et comment le provisionneur l'applique."
sidebar:
  label: "Le profil"
---

Un profil est un fichier JSON dans un Secret du namespace de l'installation, sous la clé `profile.json`. Il n'est ni dans le chart ni dans l'image du provisionneur, donc les deux sont génériques et publics, et rien dans l'un ni dans l'autre ne nomme les variables de qui que ce soit. C'est la personne qui installe l'application qui le fournit. Sur EmberNet, le Store l'écrit sous le nom `<release>-profile`.

Le provisionneur le relit à chaque passage, donc un profil plus récent atteint une installation en cours sans redémarrage.

## La forme

| Clé | Ce qu'elle contient |
|---|---|
| `revision` | Un entier à partir de 1. L'écran et les alarmes ne sont remplacés que lorsqu'il est supérieur à la révision qui les a créés. |
| `device` | `id`, `name`, `options` (les options du connecteur, comme `browseRoot`, `arrayElements` et `browseMaxNodes`) et `points`, les noms de variables que HotLoop garde de l'automate. |
| `alarms` | Des définitions d'alarmes HotLoop, chacune avec un `id`. |
| `dashboard` | Un écran HotLoop, avec un `id`. Un [tableau de bord](/fr/iot/dashboards/) est une liste de cartes. |

Un profil produit un écran. Il produit un appareil à partir de `device`, ou plusieurs à partir de `devices`, décrit ensuite.

## Une liste d'appareils

Un profil peut porter `devices` à côté de `device` ou à sa place. Chaque entrée est le corps du `POST /api/devices` de HotLoop (`id`, `name`, `protocol`, `address`, `enabled`, `pollIntervalMs`, `timeoutMs` et `config`, le bloc propre au protocole) avec ses `tags`, les descripteurs que HotLoop importe pour l'appareil : `name`, `address`, `dataType` et, en option, `unit`, `description` et `deviceClass`. Cela couvre un écouteur OPC UA PubSub (UADP) avec ses `dataSets` RawData, un client OPC UA et plusieurs appareils dans un même profil. À chaque passage :

- un appareil que HotLoop n'a pas est créé, et un qu'il a est laissé tel quel, de sorte que la modification d'une personne reste jusqu'à ce que la `revision` du profil soit supérieure à celle qui a créé l'appareil ;
- chaque tag du profil qui manque à l'appareil est importé, en lecture seule ;
- rien de tout cela n'attend le serveur OPC UA du nœud, donc un écouteur ne fait qu'écouter, et un runtime à l'arrêt ou en redémarrage ne retient rien d'autre (le `device` unique lit toujours le runtime, et un passage avec lui à l'arrêt le dit et réessaie) ;
- sans `devices`, le profil fonctionne exactement comme avant, et avec les deux présents, les deux s'appliquent.

Ce que cela signifie pour vous : un écouteur PubSub, comme un alimenté par [HotLoop Transmitter](/fr/transmitter/overview/), revient configuré tout seul sans aucun automate à lire.

## Un exemple

Voici le profil derrière les captures de la [vue d'ensemble](/fr/codesys/overview/), avec le programme de démonstration de HotLoop. `GVL_Demo` est la liste de variables du programme de démonstration, et les libellés sont inventés.

```json
{
  "revision": 2,
  "device": {
    "id": "line-2",
    "name": "Line 2 PLC",
    "options": {"browseRoot": "Application.GVL_Demo", "arrayElements": 4, "browseMaxNodes": 500},
    "points": ["GVL_Demo.bRun", "GVL_Demo.rTemp", "GVL_Demo.udiCycles", "GVL_Demo.nEcho", "GVL_Demo.rEcho", "GVL_Demo.rReadOnly"]
  },
  "alarms": [
    {"id": "line-2-mixer-hot", "name": "Mixer temperature high", "tagName": "GVL_Demo.rTemp", "condition": "hi", "limit": 20, "deadband": 0.5, "priority": 2, "message": "{device}/{tag} at {value}, limit {limit}"}
  ],
  "dashboard": {
    "id": "line-2-screen", "name": "Line 2", "description": "The Line 2 screen.", "kind": "cards", "roles": [], "homeFor": [], "screens": [],
    "cards": [
      {"id": "t", "type": "value", "title": "Mixer temperature", "w": 3, "h": 2, "config": {"tag": "line-2/GVL_Demo.rTemp", "decimals": 1}},
      {"id": "tr", "type": "trend", "title": "Mixer temperature, last 15 minutes", "w": 6, "h": 3, "config": {"tags": ["line-2/GVL_Demo.rTemp"], "minutes": 15}},
      {"id": "al", "type": "alarms", "title": "Line 2 alarms", "w": 6, "h": 3, "config": {"outstanding": true, "limit": 8}}
    ]
  }
}
```

Le `tag` d'une carte est l'id de l'appareil, une barre oblique et le nom du point. Les types de cartes, les conditions d'alarme et le reste des clés d'un écran sont les mêmes que dans les [tableaux de bord](/fr/iot/dashboards/) de HotLoop et [l'API HTTP](/fr/iot/api/).

## Ce que le provisionneur en fait

- **Il crée l'appareil** s'il n'y en a pas, et ajoute toute variable de `points` que l'automate a et que l'appareil n'a pas.
- **Il n'écrit jamais dans l'automate.** Chaque tag qu'il crée est en lecture seule, et un profil n'a aucun moyen d'en marquer un comme modifiable.
- **Il crée les alarmes et l'écran** quand ils manquent, et ne les remplace que lorsque `revision` est supérieure à celle qui les a créés. Un changement qu'une personne a fait à l'écran dans HotLoop survit donc jusqu'à la sortie volontaire d'un profil plus récent.
- **Il continue de regarder.** Toutes les cinq minutes, et plus tôt après un passage qui n'a pas pu se terminer, parce que le runtime ou HotLoop ne répondait pas encore.
