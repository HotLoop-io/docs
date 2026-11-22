---
title: "Wetter"
description: "Eine Dachwetterstation als eine Entität, mit Taupunkt, Hitzeindex und Windchill auf der Box berechnet und ohne Cloud-Dienst."
---

Eine Wetterstation auf dem Dach der Anlage, als eine einzige Sache auf dem Bildschirm. HotLoop ruft niemanden an, um zu erfahren, dass es regnet. Das sagt die Station: eine Ecowitt oder eine Tempest über MQTT, eine Davis oder eine Vaisala über Modbus, jede beliebige über OPC UA. Ein Messwert von einer davon ist schon ein Tag, und eine Wetter-Entität sind die Tags einer Station, jedes in seiner Rolle: die Temperatur, die Luftfeuchtigkeit, der Luftdruck, der Wind, der Regen und das Sonnenlicht.

Kein Wetterdienst, kein API-Schlüssel, kein Internet. Ein Standort, dessen Uplink vor drei Wochen ausgefallen ist, zeigt trotzdem die Temperatur auf seinem eigenen Dach. (Wo die Sonne steht, steht unter [Die Sonne](/de/iot/sun/); das wird aus Breiten- und Längengrad des Standorts berechnet und braucht gar keine Station.)

## Anlegen

Eine Wetter-Entität wird so angelegt wie ein Motor (siehe [Entitäten](/de/iot/entities/#composite-equipment)): Ein Administrator benennt die Tags. Auf dem Bildschirm Entitäten, Neue Anlage, Wetter. Oder über die API:

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

Nur `temperature` ist Pflicht. Eine Station ohne Regenmesser hat kein `rain_rate` und zeigt keine Regenzeile. Jede Rolle nimmt ein Zahlen-Tag, und keines wird beschrieben: Eine Station wird gelesen, nie befehligt, also muss kein Tag scharf geschaltet werden, und die Entität nimmt keinen Service an.

| Rolle | <span class="sr-only">Details</span> | Attribut, das entsteht |
|---|---|---|
| `temperature` | Pflicht, der Zustand | `unit_of_measurement` |
| `humidity` | relative Luftfeuchtigkeit, in Prozent | `humidity` |
| `pressure` | Luftdruck, in der Einheit des Tags | `pressure` |
| `wind_speed` | mittlerer Wind | `wind_speed` |
| `wind_gust` | stärkste jüngste Böe | `wind_gust` |
| `wind_bearing` | woher der Wind kommt, 0 bis 360 Grad | `wind_bearing` |
| `rain_rate` | wie stark es gerade regnet | `rain_rate` |
| `rain_today` | Regen seit Mitternacht | `rain_today` |
| `solar_radiation` | Sonnenlicht am Sensor, meist in W/m² | `solar_radiation` |
| `uv_index` | der UV-Index | `uv_index` |

Jedes Attribut trägt außerdem `<name>_unit` mit der Einheit seines Tags, damit ein Bildschirm nie raten muss, ob der Druck in hPa oder inHg angegeben ist.

## Was auf der Box berechnet wird

Drei Werte, die eine Station selten sendet, aus ihren eigenen Messwerten berechnet:

| Attribut | Aus | Wie |
|---|---|---|
| `dew_point` | Temperatur, Luftfeuchtigkeit | Die Magnus-Formel (Sonntag 1990), gehalten an den psychrometrischen Tabellen von 0 bis 30 °C |
| `heat_index` | Temperatur, Luftfeuchtigkeit | Die Rothfusz-Regression des National Weather Service mit ihren zwei veröffentlichten Anpassungen. Es gibt ihn erst ab 80 °F (26,7 °C), denn ab da verwendet ihn der NWS |
| `wind_chill` | Temperatur, Windgeschwindigkeit | Der NWS-Index von 2001. Es gibt ihn nur bei 50 °F (10 °C) oder darunter mit Wind über 3 mph, dem Bereich, für den er angepasst wurde |

Sie kommen in der eigenen Einheit der Temperatur zurück, eine Station in Grad Fahrenheit bekommt also einen Taupunkt in Grad Fahrenheit. Die Temperatureinheiten, die HotLoop umrechnet, sind °C, °F und K, die Windeinheiten m/s, km/h, mph, Knoten und ft/s, gelesen aus der Einheit des Tags. Ein Temperatur-Tag ohne Einheit wird nicht durch Raten umgerechnet: Das `unit_of_measurement` der Entität selbst kann sagen, was es ist, und ohne eines von beiden wird daraus nichts berechnet.

Dass Hitzeindex und Windchill fehlen, ist kein Fehler. Unter 80 °F gibt es keinen Hitzeindex, und bei ruhiger oder warmer Luft keinen Windchill, die Karte hat also keine Zeile dafür.

## Ein fehlender Messwert ist nicht null

Eine Wetter-Entität ist nie optimistisch und füllt nie eine Lücke mit einer Zahl.

* Ein Sensor, der nicht gebunden ist, ist keine Zeile.
* Ein Sensor, der gebunden ist und gerade nicht gelesen werden kann (sein Tag ist schlecht, sein Gerät ist ausgefallen, noch ist nichts angekommen), wird aus den Attributen ausgelassen und in `unavailable` genannt. Die Karte zeigt **Nicht verfügbar**, wo seine Zahl stünde.
* Ein Messwert, der keine Messung sein kann, wird genauso behandelt: eine Luftfeuchtigkeit über 105 Prozent, eine Richtung außerhalb von 0 bis 360 Grad, ein negativer Regen oder eine negative Windgeschwindigkeit. Eine Luftfeuchtigkeit von 101 oder 102, die ein Sensor im Nebel liest, wird angezeigt als
  100. Der kleine negative Messwert eines Pyranometers in der Nacht wird als 0 angezeigt.
* Ein Wert, der aus einem nicht verfügbaren Messwert berechnet wird, ist ebenfalls nicht verfügbar und wird genannt: ohne Luftfeuchtigkeit kein `dew_point` und kein `heat_index`.
* Lässt sich die Temperatur nicht lesen, ist der Zustand `unknown` (oder `unavailable`, wenn das Gerät ausgefallen ist), mit der üblichen Qualität, und der Rest der Karte zeigt weiter, was die anderen Sensoren sagen.

## Auf dem Bildschirm

Auf dem Bildschirm Entitäten ist eine Wetterstation eine Kachel: die Temperatur in großer Schrift, darunter eine Zeile für jeden Messwert, den die Station liefert, in fester Reihenfolge (Luftfeuchtigkeit, Luftdruck, Wind, Windrichtung, Böen, Regenrate, Regen heute, Sonnenlicht, UV-Index, Taupunkt, Hitzeindex, Windchill). Die Temperatur hat die übliche Trendlinie. Die Karte ist in jeder Sprache der Oberfläche lesbar und wird im Arabischen von rechts nach links gesetzt.

## MCP

Agenten lesen und bauen eine Station mit den Werkzeugen, die jede Entität hat, und einem, das ihnen sagt, was eine Station annimmt:

| Werkzeug | Tut |
|---|---|
| `list_composite_entities` | Liest, was `create_entity` anlegen kann, jede Domäne mit ihren Rollen, welche Pflicht sind und welche ein Service schreibt. Wetter hat zehn Rollen, eine Pflicht, und keine Services |
| `create_entity` | Baut eine Station aus Tags, wie `POST /api/entities`. Es braucht einen Grund und den MCP-Schreibschalter wie jede Änderung |
| `get_states` | Liest eine: Der Zustand ist die Temperatur, und der Text, den ein Modell liest, listet alle Attribute daneben auf, `unavailable` eingeschlossen |
| `list_entities` | Findet Stationen mit `domain: weather` |
| `delete_entity` | Entfernt eine |

`call_service` auf einer Wetter-Entität wird abgelehnt: Sie nimmt keinen Service an.

## Was es nicht tut

* Es macht keine Vorhersage. Eine Vorhersage gibt es nicht, ohne jemand anderen zu fragen, und HotLoop tut das nicht.
* Es schreibt die Temperatur einer Station nicht als Logbuchzeilen, wie es kein Sensor tut. Der Verlauf ist der des Tags: Die Trendlinie auf der Kachel gehört zum Temperatur-Tag, und jedes andere Tag liegt im Historian wie jedes andere.
* Es liest eine Station nicht für Sie. Die Station kommt zuerst als Tags an: Fügen Sie ihr Gerät hinzu (MQTT, Modbus oder OPC UA) und binden Sie dann die Tags.
