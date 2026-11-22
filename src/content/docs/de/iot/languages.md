---
title: "Sprachen der Weboberfläche"
description: "Die Weboberfläche auf Englisch und dreizehn weiteren Sprachen, Arabisch von rechts nach links gesetzt, wählbar in der oberen Leiste oder auf der Anmeldekarte."
---

Die Weboberfläche von HotLoop IoT, Edge und Gateway (und von HotLoop for CODESYS, das die Edge-Oberfläche ausführt) gibt es auf Englisch und in 13 weiteren Sprachen: Spanisch (es), Französisch (fr), Italienisch (it), Deutsch (de), Norwegisch Bokmål (nb), Bulgarisch (bg), Griechisch (el), Koreanisch (ko), Japanisch (ja), Vietnamesisch (vi), Hindi (hi), vereinfachtes Chinesisch (zh-Hans) und Arabisch (ar, von rechts nach links gesetzt).

Wählen Sie eine im Sprachfeld in der oberen Leiste oder auf der Anmeldekarte. Die Wahl wird in diesem Browser gespeichert. Ohne Wahl nimmt die Seite die erste Sprache des Browsers, die HotLoop hat, und Englisch, wenn keine passt. Eine Sprache erscheint in der Auswahl nur, wenn ihre Datei vollständig ist.

Was der Sprache folgt: jedes Wort auf jedem Bildschirm, die Reihenfolge und Zeichen der Zahlen (ein Dezimalkomma im Deutschen, Französischen und Spanischen), Datum und Uhrzeit (24-Stunden-Uhr), die Pluralformen (Arabisch hat sechs) und die Richtung der Seite. Produkt- und Protokollnamen (HotLoop, Modbus, OPC UA, MQTT, Sparkplug, CODESYS, UniFi) bleiben, wie sie geschrieben sind. Werte aus der Anlage, etwa Tag-Namen, Gerätenamen, von jemandem getippte Alarmmeldungen und vom Server zurückgesandter Fehlertext, werden so angezeigt, wie sie sind.

## So funktioniert es

* [i18next](https://www.i18next.com/) 27 sucht die Meldung heraus, füllt `{{name}}` und wählt die Pluralform. Es fragt das `Intl.PluralRules` des Browsers selbst, die Pluralregeln sind also die von Unicode CLDR. Zahlen und Datumsangaben nutzen `Intl.NumberFormat` und `Intl.DateTimeFormat` über `web/src/lib/format.ts`.
* Die Meldungen liegen in `web/src/i18n/locales/<language>.json`, flach, ein Schlüssel pro Meldung. `en.json` ist die Quelle. Jede andere Datei hat genau dieselben Schlüssel.
* In einem Template oder Skript schreiben Sie `tl('area.key')` oder `tl('area.key', { name })`. Eine Meldung mit einer Anzahl hat einen Schlüssel pro Pluralform (`key_one`, `key_other`, und `key_few`, `key_many`, `key_two`, `key_zero`, wo eine Sprache sie hat) und wird mit dem bloßen Schlüssel und `count` abgefragt: `tl('overview.tags_count', { count: n })`.
* Englisch ist Teil der Seite. Eine andere Sprache ist eine eigene Datei, die geladen wird, wenn jemand sie wählt.
* `web/src/i18n/index.svelte.ts` hält die Sprache; sie zu ändern zeichnet jeden Bildschirm neu. Ein Wort, das in einer Konstante am Anfang einer `.ts`-Datei steht, wird einmal beim Laden der Datei gelesen und nicht übersetzt: Schreiben Sie es als Getter (`get label() { return tl('x.y'); }`) oder behalten Sie den Schlüssel und rufen Sie `tl()` dort auf, wo es gezeichnet wird.
* Die Seite setzt `<html lang dir>`. Das CSS nutzt logische Eigenschaften (`margin-inline-start`, `inset-inline-end`, `text-align: start`), das Layout dreht sich für Arabisch also von selbst um.

## Ein Wort hinzufügen oder ändern

1. Fügen Sie die Meldung zu `en.json` hinzu und schreiben Sie sie im Code mit `tl()`.
2. Fügen Sie sie jeder anderen Sprachdatei hinzu, geschrieben von jemandem, der diese Sprache liest, nach der gemeinsamen Begriffsbasis im Codex (`work/notes/i18n/glossary/`). Kurze, einfache Sätze. Produkt- und Protokollnamen bleiben Englisch.
3. Führen Sie `cd web && npm run check:i18n` aus. Es schlägt fehl, wenn in einer Sprachdatei ein Schlüssel fehlt, ein anderes `{{placeholder}}` als im Englischen steht oder eine Pluralform fehlt, die ihre Sprache braucht; wenn ein Schlüssel nicht benutzt wird; und wenn Englisch in einem Template oder im Code steht, ohne durch `tl()` zu gehen. Es läuft vor jedem `npm run build` und in `npm run typecheck`, die komplette Suite und der Release-Build bleiben also daran stehen. Englisch, das bleiben soll (ein Name, ein Codebeispiel), kommt mit der Begründung in `web/i18n/allow.json`.

Setzen Sie `HOTLOOP_TEST_BROWSER_GALLERY` und `HOTLOOP_TEST_BROWSER_ARTIFACTS`, um von jeder einen Screenshot aufzubewahren.

## Was nicht übersetzt wird

* Text, den der Server sendet: Fehlermeldungen der API, Benachrichtigungs- und Alarmmeldungen sowie die CLI. Die Oberfläche zeigt sie, wie sie ankommen.
* Die Dokumentation, die Namen des OPC-UA-Servers, der MQTT-Broker und die Werte des Helm-Charts.
