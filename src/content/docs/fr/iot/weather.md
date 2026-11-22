---
title: "Météo"
description: "Une station météo de toit en une seule entité, avec point de rosée, indice de chaleur et refroidissement éolien calculés sur le boîtier, sans service cloud."
---

Une station météo sur le toit de l'usine, comme une seule chose à l'écran. HotLoop n'appelle personne pour savoir qu'il pleut. C'est la station qui le dit : une Ecowitt ou une Tempest en MQTT, une Davis ou une Vaisala en Modbus, n'importe laquelle en OPC UA. Une mesure de l'une d'elles est déjà un tag, et une entité météo, ce sont les tags d'une station, chacun dans son rôle : la température, l'humidité, la pression, le vent, la pluie et l'ensoleillement.

Pas de service météo, pas de clé d'API, pas d'internet. Un site dont la liaison montante est tombée il y a trois semaines affiche toujours la température de son propre toit. (Pour savoir où est le soleil, voir [le soleil](/fr/iot/sun/) ; il est calculé à partir de la latitude et de la longitude du site et n'a besoin d'aucune station.)

## La construire

Une entité météo se construit comme un moteur (voir [Entités](/fr/iot/entities/#composite-equipment)) : un administrateur nomme les tags. Sur l'écran Entités, Nouvel équipement, Météo. Ou par l'API :

```json
POST /api/entities
{
  "domain": "weather",
  "name": "Roof station",
  "bindings": [
    {"role": "temperature", "device_id": "roof", "tag_name": "Temp"},
    {"role": "humidity",    "device_id": "roof", "tag_name": "Humidity"},
    {"role": "wind_speed",  "device_id": "roof", "tag_name": "Wind"},
    {"role": "wind_bearing","device_id": "roof", "tag_name": "Bearing"}
  ]
}
```

Seul `temperature` est obligatoire. Une station sans pluviomètre n'a pas de `rain_rate` et n'affiche pas de ligne de pluie. Chaque rôle prend un tag numérique, et aucun n'est écrit : une station se lit, elle ne se commande jamais, donc aucun tag n'a besoin d'être armé et l'entité n'accepte aucun service.

| Rôle | <span class="sr-only">Details</span> | Attribut produit |
|---|---|---|
| `temperature` | obligatoire, l'état | `unit_of_measurement` |
| `humidity` | humidité relative, en pourcentage | `humidity` |
| `pressure` | pression de l'air, dans l'unité du tag | `pressure` |
| `wind_speed` | vent moyen | `wind_speed` |
| `wind_gust` | la rafale récente la plus forte | `wind_gust` |
| `wind_bearing` | d'où vient le vent, de 0 à 360 degrés | `wind_bearing` |
| `rain_rate` | l'intensité de la pluie en ce moment | `rain_rate` |
| `rain_today` | la pluie depuis minuit | `rain_today` |
| `solar_radiation` | le rayonnement solaire sur le capteur, en général en W/m² | `solar_radiation` |
| `uv_index` | l'indice UV | `uv_index` |

Chaque attribut porte aussi `<name>_unit` avec l'unité de son tag, de sorte qu'un écran n'a jamais à deviner si la pression est en hPa ou en inHg.

## Ce qui est calculé sur le boîtier

Trois valeurs qu'une station envoie rarement, calculées à partir de ses propres mesures :

| Attribut | À partir de | Comment |
|---|---|---|
| `dew_point` | température, humidité | La formule de Magnus (Sonntag 1990), vérifiée sur les tables psychrométriques de 0 à 30 °C |
| `heat_index` | température, humidité | La régression de Rothfusz du National Weather Service avec ses deux ajustements publiés. Il n'existe qu'à partir de 80 °F (26,7 °C), car c'est là que le NWS cesse de l'utiliser |
| `wind_chill` | température, vitesse du vent | L'indice NWS de 2001. Il n'existe qu'à 50 °F (10 °C) ou moins avec un vent de plus de 3 mph, la plage sur laquelle il a été ajusté |

Ils reviennent dans l'unité propre de la température, donc une station en degrés Fahrenheit obtient un point de rosée en degrés Fahrenheit. Les unités de température que HotLoop convertit sont °C, °F et K, et celles du vent m/s, km/h, mph, nœuds et ft/s, lues dans l'unité du tag. Un tag de température sans unité n'est pas converti au hasard : le `unit_of_measurement` de l'entité elle-même peut dire de quoi il s'agit, et sans l'un ni l'autre, rien n'est calculé à partir de lui.

L'absence de l'indice de chaleur ou du refroidissement éolien n'est pas une panne. En dessous de 80 °F il n'y a pas d'indice de chaleur, et par air calme ou chaud il n'y a pas de refroidissement éolien, donc la carte n'a pas de ligne pour eux.

## Une mesure absente n'est pas zéro

Une entité météo n'est jamais optimiste, et ne comble jamais un trou avec un nombre.

* Un capteur qui n'est pas lié n'est pas une ligne.
* Un capteur lié mais illisible pour le moment (son tag est mauvais, son appareil est hors service, rien n'est encore arrivé) est laissé hors des attributs et nommé dans `unavailable`. La carte affiche **Indisponible** là où serait son nombre.
* Une mesure qui ne peut pas être une mesure est traitée de la même façon : une humidité au-dessus de 105 pour cent, un cap en dehors de 0 à 360 degrés, une pluie ou une vitesse de vent négative. Une humidité de 101 ou 102, qu'un capteur lit dans le brouillard, est affichée comme
  100. La petite mesure négative d'un pyranomètre la nuit est affichée comme 0.
* Une valeur calculée à partir d'une mesure indisponible est elle aussi indisponible, et nommée : sans humidité, pas de `dew_point` ni de `heat_index`.
* Si la température est illisible, l'état est `unknown` (ou `unavailable` quand l'appareil est hors service), avec la qualité habituelle, et le reste de la carte montre toujours ce que disent les autres capteurs.

## À l'écran

Sur l'écran Entités, une station météo est une seule tuile : la température en gros caractères, et dessous une ligne pour chaque mesure que donne la station, dans un ordre fixe (humidité, pression, vent, direction du vent, rafales, intensité de pluie, pluie du jour, ensoleillement, indice UV, point de rosée, indice de chaleur, refroidissement éolien). La température a la courbe de tendance habituelle. La carte se lit dans toutes les langues de l'interface et se dispose de droite à gauche en arabe.

## MCP

Les agents lisent et construisent une station avec les outils que toute entité possède, et avec un outil qui leur dit ce qu'une station accepte :

| Outil | Fait |
|---|---|
| `list_composite_entities` | Lit ce que `create_entity` peut créer, chaque domaine avec ses rôles, ceux qui sont obligatoires et ceux qu'un service écrit. La météo a dix rôles, un obligatoire, et aucun service |
| `create_entity` | Construit une station à partir de tags, comme `POST /api/entities`. Il faut un motif et l'interrupteur d'écriture MCP, comme pour tout changement |
| `get_states` | En lit une : l'état est la température, et le texte que lit un modèle énumère tous les attributs à côté, `unavailable` compris |
| `list_entities` | Trouve les stations avec `domain: weather` |
| `delete_entity` | En supprime une |

`call_service` sur une entité météo est refusé : elle n'accepte aucun service.

## Ce qu'elle ne fait pas

* Elle ne prévoit pas. Il n'y a pas de prévision sans demander à quelqu'un d'autre, et HotLoop ne le fait pas.
* Elle ne journalise pas la température d'une station sous forme de lignes de journal, comme aucun capteur. L'historique est celui du tag : la courbe de tendance de la tuile est celle du tag de température, et chaque autre tag est dans l'historian comme n'importe quel autre.
* Elle ne lit pas une station à votre place. La station arrive d'abord sous forme de tags : ajoutez son appareil (MQTT, Modbus ou OPC UA), puis liez les tags.
