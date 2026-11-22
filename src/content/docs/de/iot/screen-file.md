---
title: "Bildschirmdateien"
description: "Ein Dashboard in eine Datei exportieren und anderswo importieren, mit allen Tags, Geräten und Skripten aufgelistet und einer Zuordnung für abweichende Namen."
---

Ein Bildschirm gehört dem Kunden und reist als Datei. Exportieren Sie ein Dashboard aus einer Installation, importieren Sie es in eine andere, und nichts davon steckt im Code von HotLoop: weder das Layout noch die Tag-Namen noch der Text. Dieselbe Datei funktioniert in HotLoop IoT, Edge und Gateway, weil sie einen gemeinsamen Satz Dashboards betreiben ([Dashboards](/de/iot/dashboards/)).

Das Edge Relay hat keine Oberfläche und keine Bildschirme. Das Dashboard von Flow ist Teil seiner Flows, die ihr eigenes Importieren und Exportieren haben. Bei HotLoop for CODESYS sind die Bildschirme die von Edge.

## So geht es

Auf dem Bildschirm Dashboards speichert **Exportieren** (neben Bearbeiten, für das angezeigte Dashboard) `<id>.hotloop-screen.json`. **Importieren** (in der Leiste neben Neues Dashboard) liest eine Datei, sagt Ihnen, was sie braucht und was hier fehlt, lässt Sie jedes fehlende Tag, Gerät, jede fehlende Entität, jedes Skript und Rezept einem vorhandenen zuordnen, prüft erneut und speichert es. Das Importieren braucht `dashboards.write` und ist damit Sache eines Administrators. Das Exportieren braucht `dashboards.read`, und das Dashboard muss eines sein, das Ihnen angeboten wird.

Über die API sind es [`GET /api/dashboards/{id}/export`](/de/iot/api/#get-apidashboardsidexport) und [`POST /api/dashboards/import`](/de/iot/api/#post-apidashboardsimport), was der Bildschirm aufruft. Ein Import speichert nie etwas, das der Aufbau desselben Dashboards ablehnen würde.

## Die Datei

UTF-8-JSON, bis zu 4 MiB.

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

**`format` und `formatVersion`.** `format` ist immer `hotloop-screen`. `formatVersion` ist eine ganze Zahl ab 1. Ein HotLoop liest seine eigene Version und ältere und lehnt eine neuere ab, indem es sagt, welche Version die Datei hat und welche es liest. Ein der Datei hinzugefügtes Feld ist eine neue Version, denn ein Leser lehnt ein Feld ab, das er nicht kennt: Ein Feld, das kommentarlos weggelassen wird, ist schlimmer als eine Ablehnung. Dies ist Version 1.

**`exported`.** Welches Produkt und welche Version die Datei geschrieben hat, und wann. Für die Person, die die Datei liest. Daraus wird nichts entschieden: Die Kartentypen entscheiden, ob ein HotLoop den Bildschirm anzeigen kann, und ein unbekannter Kartentyp wird mit Namen abgelehnt.

**`screen`.** Das Dashboard, wie es die Dashboard-API hält, ohne die eigene Buchführung der Installation (`version`, `updatedBy`, `createdAt`, `updatedAt`). `description` entfällt, wenn sie leer ist. Die Karten stehen in Leserichtung, jede mit ihrer Größe (`w` von 12 Spalten, `h` in Zeilen) und ihrem `config`, genau wie [Dashboards](/de/iot/dashboards/#the-cards) jeden Typ beschreibt. Das Layout ist das: ein Fluss von Karten, nie Pixelkoordinaten. Eine Symbolkarte setzt ihre Symbole pixelgenau auf ihrer eigenen Seite, innerhalb ihres Configs.

**Die Ressourcen sind enthalten.** Ein Grundriss auf einer Kartenkarte und der Hintergrund einer Symbolkarte sind Base64-PNG-Daten-URLs im `config` der Karte, eine Datei ist also der ganze Bildschirm, und sie zu senden heißt, auch das Bild zu senden. Die Grenzen sind die des Dashboards: 700 KB pro Bild und 2 MiB pro Bildschirm.

**`requires`.** Was der Bildschirm von der Installation braucht, auf der er landet, aus den Karten berechnet: jedes Tag, das er liest (mit dem Typ und der Einheit, die es dort hatte, wo es exportiert wurde, und ob eine Schaltfläche oder ein Sollwert darauf schreibt) und die IDs der Entitäten, Skripte, Rezepte, Geräte und Anlagen, die die Karten nennen. Das ist für Menschen und für Werkzeuge, die vor dem Import nachsehen wollen. Der Import berechnet es aus den Karten neu und traut diesem Block nie. Weicht der Typ eines Tags in der Datei vom Tag ab, auf dem es landet, ist das eine Warnung.

**Die Wandtafel wird nicht exportiert.** Sie ist die angepinnte Anzeigengruppe einer Installation, kein Layout. Sie zu exportieren ergibt ein `400`, und eine Datei, deren `kind` `wall` ist, wird abgelehnt.

**Zuweisungen.** `roles`, `homeFor`, `screens` und `position` stehen in der Datei, damit ein Bildschirm so zurückkommt, wie er ging. Sie sind auch der Teil, der am engsten an eine Installation gebunden ist: Der Name eines Panels gehört auf einer Installation zu einem Dashboard, und eine Rolle hat einen Startbildschirm. Ein Import wendet sie an und sagt es (`assignment`), wenn diese Installation diesen Bildschirmnamen oder den Startbildschirm dieser Rolle schon einem anderen Dashboard gibt. **Zuweisungen überspringen** lässt `screens` und `homeFor` weg und behält `roles`.

## Importieren

Die Prüfungen laufen in dieser Reihenfolge, und nichts wird gespeichert, bevor alle bestanden sind:

1. **Die Datei.** JSON, das richtige `format`, eine Version, die dieser Build liest, kein Feld, das er nicht kennt, Art `cards`.
2. **Ihre Änderungen daran.** Eine neue ID oder ein neuer Name, keine Zuweisungen und die **Zuordnung**: `tags` (ganzer Schlüssel auf ganzen Schlüssel, wie die Datei das Tag nennt oder wie es sich liest, nachdem das Gerät umgezogen ist), `devices` (ID auf ID; verschiebt auch den Geräteteil jedes Tags, das die `tags`-Zuordnung nicht nennt, einen Bildschirm von einer SPS auf eine andere zu bringen ist also ein Eintrag), `entities`, `scripts`, `recipes` und `equipment` (IDs sind Zahlen, die nur dort etwas bedeuten, wo sie entstanden sind, sie werden also einzeln zugeordnet). Der Legendentext eines Trends zieht mit seinem Tag um. Ein Zuordnungseintrag, den keine Karte verwendet hat, ist eine Warnung, denn eine Zuordnung, die nichts bewirkt hat, ist die Art, wie ein Bildschirm am Ende auf das Alte zeigt.
3. **Die eigenen Regeln des Dashboards.** ID, Name, das Config jeder Karte, Größen, die Bytegrenze, in der gespeicherten Form.
4. **Alles, was die Karten nennen, ausnahmslos.** Jedes fehlende Tag, jede fehlende Entität, jedes Skript, Rezept, Gerät und jede Anlagen-ID wird aufgelistet, nicht nur die erste, sodass ein Durchlauf sagt, was zuzuordnen ist. Eine Schaltfläche oder ein Sollwert auf einem nicht beschreibbaren Tag ist `writable`. Ein Schaltflächenwert oder eine Sollwertgrenze außerhalb des Bereichs des Tags und eine Rolle, die nicht existiert, sind `screen`.
5. **Die ID und die Zuweisungen.** Eine vergebene ID ist `exists`, es sei denn, Sie haben **Ersetzen** verlangt, was über dieses Dashboard in der Version speichert, die es jetzt hat (ein Speichern, das während Ihres Hinsehens erfolgte, ist also ein `409`, kein Überschreiben).

Ein Probelauf macht all das und speichert nichts. Der Import wird als `config`-Ereignis am Dashboard protokolliert: wer, aus welchem Produkt und welcher Version, wie viele Karten.

## Einen Bildschirm umziehen

Exportieren Sie auf der ersten Installation. Stellen Sie auf der zweiten sicher, dass die Geräte und Tags existieren, die der Bildschirm liest (sie tragen Adressen, die zur Anlage gehören, eine Bildschirmdatei trägt sie also nicht). Importieren Sie. Weichen die Tag-Namen ab, ordnen Sie sie im Dialog zu, oder ordnen Sie das Gerät zu, wenn nur das abweicht. Der Bildschirm öffnet sich auf der zweiten Installation so, wie er auf der ersten war.

## Eine CODESYS-Visualisierung

Derselbe Import liest eine CODESYS-Visualisierung (den nativen Export der IDE) und macht daraus den Bildschirm, wobei er sagt, was er ausgelassen hat: [Einen CODESYS-Bildschirm importieren](/de/iot/codesys-screen-import/).

## Was nicht in Version 1 ist

Die Geräte und Tags, die ein Bildschirm liest (ihre Adressen gehören der Anlage, nicht dem Bildschirm), die Wandtafel, mehrere Bildschirme in einer Datei und eine Signatur auf der Datei. Eine Datei ist schlichtes JSON: Lesen Sie sie, bevor Sie eine importieren, die man Ihnen geschickt hat.
