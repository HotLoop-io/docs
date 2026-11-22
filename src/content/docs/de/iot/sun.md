---
title: "Die Sonne"
description: "Sonnenaufgang, Sonnenuntergang, Dämmerung und Sonnenstand, auf der Box aus Breiten- und Längengrad berechnet, ohne Wetterdienst und ohne Internet."
---

Sagen Sie HotLoop, wo die Anlage steht, und es weiß, wo die Sonne steht. Sonnenaufgang, Sonnenuntergang, Morgen- und Abenddämmerung, Sonnenhöchststand, die Höhe der Sonne und ihre Richtung, alles auf der Box aus Breiten- und Längengrad berechnet. Kein Wetterdienst, kein API-Schlüssel, kein Internet. Ein Standort, dessen Uplink vor drei Wochen ausgefallen ist, schaltet das Hoflicht trotzdem bei Einbruch der Dunkelheit ein, und genau deshalb ist das kein Anruf bei der Cloud eines anderen.

## Einrichten

Zwei Variablen, Dezimalgrad, Nord und Ost positiv:

| Variable | Beispiel | <span class="sr-only">Details</span> |
|---|---|---|
| `HOTLOOP_SITE_LATITUDE` | `41.4993` | Nord positiv |
| `HOTLOOP_SITE_LONGITUDE` | `-81.6944` | Ost positiv, ganz Amerika ist also negativ |

Im Chart heißen sie `plant.latitude` und `plant.longitude`. Beide oder keine. Ein halber Standort, eine Zahl von jenseits des Planeten oder `41°29'58"N` stoppen HotLoop beim Start und nennen die Variable, denn ein Sonnenaufgang, der aus einem Tippfehler berechnet wurde, liegt um Stunden daneben und sieht auf dem Bildschirm trotzdem völlig plausibel aus. Nehmen Sie die Zahlen aus einer beliebigen Karte: Rechtsklick, Koordinaten kopieren.

Lassen Sie sie weg, gibt es keine Sonnen-Entitäten, und eine Regel mit Sonnen-Auslöser wird nicht scharf geschaltet (das Systemprotokoll nennt die beiden Variablen, die zu setzen sind). Der Bildschirm Einstellungen zeigt beide, nur lesbar. Ein Sonnenaufgang ist etwas, worauf Regeln auslösen, deshalb ändert er sich mit einem geprüften Deployment.

## Die Entitäten

| Entität | Zustand | <span class="sr-only">Details</span> |
|---|---|---|
| `binary_sensor.sun_up` | `on` von Sonnenaufgang bis Sonnenuntergang | Attribute `next_dawn`, `next_sunrise`, `next_noon`, `next_sunset`, `next_dusk`, in der Zeitzone des Standorts |
| `sensor.sun_elevation` | Grad über dem Horizont, negativ darunter | ganze Grad |
| `sensor.sun_azimuth` | Grad im Uhrzeigersinn von geografisch Nord, 90 ist Ost | ganze Grad |

Sie gehören zur Plattform `sun`, sie werden gelesen und nehmen keine Services an. `sun_up` wird exakt berechnet, es wechselt also in derselben Sekunde, in der die Auslöser für Sonnenaufgang und Sonnenuntergang feuern, und nicht anhand der gerundeten Elevation.

Elevation und Azimut sind absichtlich ganze Grad. Die Sonne wandert etwa ein Viertelgrad pro Minute. Bei einem Zehntelgrad wäre das alle 24 Sekunden ein neuer Zustand, eine Logbuchzeile und ein Verlaufspunkt, den ganzen Tag, jeden Tag, pro Sensor, für eine Genauigkeit, auf die niemand automatisiert. Eine Regel, die »die Sonne steht mehr als 10 Grad hoch« will, bekommt das auf das Grad genau.

Unter der Mitternachtssonne oder in der Polarnacht kann der nächste Sonnenuntergang oder Sonnenaufgang Wochen entfernt sein, und das Attribut sagt, wann. Gibt es innerhalb eines Jahres keinen, steht dort `none within a year`, statt dass es stillschweigend fehlt.

## Auslöser

```json
{"type": "sun", "event": "sunset", "offsetSec": -1800}
```

`dawn`, `sunrise`, `noon`, `sunset` oder `dusk`, verschoben um `offsetSec` (negativ heißt davor, höchstens sechs Stunden in jede Richtung). Siehe [Automatisierungen](/de/iot/automations/#sun-triggers). `binary_sensor.sun_up` funktioniert auch mit einem gewöhnlichen `state`-Auslöser und mit `states['binary_sensor.sun_up'] == 'off'` in einer Bedingung, für »erst nach Einbruch der Dunkelheit«.

## Was die Zahlen bedeuten

- **Sonnenaufgang und Sonnenuntergang** sind der Moment, in dem der obere Rand der Sonne am Horizont steht, mit der üblichen Zugabe dafür, dass die Luft das Licht beugt: der Mittelpunkt 0,833 Grad unter dem Horizont. Das meint jeder Almanach und jedes Telefon mit Sonnenaufgang.
- **Morgen- und Abenddämmerung** sind die bürgerliche Dämmerung, der Mittelpunkt 6 Grad darunter. Das ist die Linie, um die Außenbeleuchtung geschrieben wird: nach der bürgerlichen Abenddämmerung braucht man Licht, um draußen zu arbeiten.
- **Der Sonnenhöchststand** ist, wenn die Sonne genau im Süden steht (genau im Norden südlich des Äquators) und am höchsten. Es ist selten 12:00 Uhr auf der Uhr; am Westrand einer Zeitzone ist es im Sommer deutlich nach eins.
- **Die Elevation** ist, wo die Sonne zu sein scheint, korrigiert um die Refraktion. Der Azimut wird von geografisch Nord gemessen, nicht von magnetisch Nord.

Der Vorbehalt des flachen Horizonts: Die Werte gelten für einen Horizont auf Meereshöhe. Eine Anlage in einem Tal verliert die Sonne vor Sonnenuntergang hinter dem Kamm, und HotLoop kennt den Kamm nicht. Setzen Sie einen Versatz auf den Auslöser.

## Woher wir wissen, dass es stimmt

Die Mathematik stammt von der NOAA: die Gleichungen hinter dem Sonnenrechner des Global Monitoring Laboratory (gml.noaa.gov/grad/solcalc), die auf *Astronomical Algorithms* von Jean Meeus beruhen. So übernommen, wie sie sind, samt der Eigenheit (der Sonnenhöchststand der NOAA liest die Zeitgleichung um Mitternacht UT statt am Mittag, eine Sache von Sekunden, und bleibt so, damit wir die NOAA auf die Sekunde treffen).

Der Test liest alle 4.380 Zellen für Sonnenaufgang und Sonnenuntergang und hält jeden Durchgang auf die von der NOAA gedruckte Minute plus zwei Sekunden, und jeden der 2.190 Mittage auf eine Sekunde genau. Etwa 97 Prozent runden auf genau dieselbe Minute; der Rest liegt etwa eine Sekunde neben einer halben Minute, das sind zwei Rechner, die in der letzten Stelle uneins sind, nicht über die Sonne. An jedem Tag, an dem die NOAA keinen Sonnenaufgang oder keinen Sonnenuntergang angibt, sagt HotLoop dasselbe.

Die NOAA veröffentlicht keine Dämmerungstabelle, deshalb werden Morgen- und Abenddämmerung an ihrer Definition gemessen: In dem Moment, in dem HotLoop sagt, es ist Abenddämmerung, setzt dieselbe Positionsrechnung den Mittelpunkt der Sonne 6 Grad tiefer, auf ein Fünfzigstel Grad genau.

Die NOAA sagt, ihr Verfahren sei zwischen den Polarkreisen auf etwa eine Minute genau und werde zu den Polen hin schlechter, wo die Sonne den Horizont streift und ein winziger Fehler in ihrer Höhe Minuten auf der Uhr ausmacht. Utqiagvik besteht dieselbe Prüfung wie jeder andere Ort. An den Polen selbst kann das Tag-für-Tag-Verfahren den einen Sonnenaufgang des Jahres verpassen; wenn Sie eine Anlage am Südpol betreiben, legen Sie einen Zeitplan darauf.
