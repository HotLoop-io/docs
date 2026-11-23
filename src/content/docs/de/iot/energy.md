---
title: "Energie"
description: "Zähler in 15-Minuten-Abschnitten, ein Tarif, der jeden Abschnitt beim Anlegen bepreist, ein Leistungspreis, Schichten und die Kosten einer gefertigten Einheit."
---

Was das Werk verbraucht und was es kostet: Kilowattstunden, Gas, Wasser, Druckluft und die Kosten einer gefertigten Einheit, auf einem Bildschirm, gemacht für eine Fertigungshalle. Keine neue Hardware und kein neues Protokoll. Ein Zähler ist ein Tag, das HotLoop schon liest, und das hier ist die Buchhaltung darüber: was das Tag gezählt hat, in der Datenbank gehalten und bepreist.

## Ein Zähler

Ein Zähler liest ein Tag als verbrauchte Menge. Er hat einen von zwei Modi.

| Modus | Das Tag ist | Was verbraucht wurde, ist |
|---|---|---|
| `counter` | ein kumulierter Zählerstand: ein kWh-Register, ein Gas-Totalisator, die Impulse eines Wasserzählers | wie weit er sich bewegt hat, mal dem `factor` des Zählers |
| `power` | eine Rate: die gerade bezogenen kW, in `W`, `kW` oder `MW` | der Mittelwert zweier Messwerte über die Zeit zwischen ihnen |

`factor` ist das, was ein Schritt eines Zählers in der Einheit des Zählers wert ist: `0.001` macht aus einem Register in Wh kWh, `0.01` bedeutet, ein Impuls ist ein Hundertstel Kubikmeter. Fehlt er, ist er 1. Ein Leistungszähler hat keinen Faktor: Sein `power_unit` und sein `unit` (`Wh`, `kWh` oder `MWh`) sagen, wie umzurechnen ist.

| Art | Für | Übliche Einheit |
|---|---|---|
| `electricity` | kWh | kWh |
| `gas` | Gas | m³ |
| `water` | Wasser | m³ |
| `air` | Druckluft | m³ |
| `heat` | Dampf, Warmwasser, Wärme | kWh |
| `production` | gefertigte Einheiten | Einheiten |

Ein `production`-Zähler zählt, was die Linie gefertigt hat. Er hat keinen Tarif, und er ist das, wodurch die Kosten einer Einheit geteilt werden.

Legen Sie einen auf dem Bildschirm Energie an (Neuer Zähler) oder mit `POST /api/energy/meters` (siehe [die HTTP-API](/de/iot/api/#energie)). Nur ein Administrator legt einen Zähler an, ändert oder entfernt ihn (`energy.write`); alle lesen (`energy.read`). Das Tag muss existieren und eine Zahl sein. Wird das Tag später gelöscht, sagt der Zähler, dass er wartet, und nimmt das Tag wieder auf, wenn es neu angelegt wird.

## Wie er zählt

Alle zehn Sekunden liest die Engine das Tag jedes Zählers aus demselben Cache, den jeder Bildschirm liest, und berechnet, was jeder neue Messwert hinzufügt. Was er hinzufügt, geht in Abschnitte von 15 Minuten, in der Datenbank, in derselben Transaktion wie der letzte Messwert des Zählers. Ein Neustart verliert also nichts und zählt nichts doppelt.

* **Ein kumulierter Zähler** addiert, wie weit er sich seit dem letzten Messwert bewegt hat, verteilt auf die Zeit zwischen den beiden Messwerten im Verhältnis zur Zeit in jedem Abschnitt.
* **Ein Zähler, der rückwärts geht,** wurde zurückgesetzt oder ersetzt. Nichts sagt, wie viel verbraucht wurde, also wird nichts addiert: Der neue Wert ist der neue Ausgangspunkt, und der Zähler zählt das Zurücksetzen mit (`status.resets`).
* **Ein Zähler, der weitergezählt hat, während HotLoop aus war.** Die Bewegung ist echt und wird ganz behalten, gleichmäßig über die Lücke verteilt, und jeder berührte Abschnitt wird als **geschätzt** markiert. Eine Lücke sind mehr als zehn Minuten zwischen zwei Messwerten.
* **Eine Leistung** ist der Mittelwert zweier Messwerte über die Zeit zwischen ihnen. Für eine Lücke von mehr als zehn Minuten gibt es nichts: Der Zähler erfindet keine Leistung für eine Zeit, die niemand gelesen hat, und die Lücke wird gezählt (`status.gap_seconds`). Jeder Abschnitt sagt, für wie viele seiner 900 Sekunden Messwerte vorliegen (`covered_seconds`), und der Bildschirm sagt „Für 63 % des Zeitraums gelesen“, wenn ein Leistungszähler für einen Teil davon nicht gelesen wurde. Ein Leistungsmesswert, der nichts verbraucht hat, deckt trotzdem seine Zeit ab.
* **Ein schlechter Messwert** (die Qualität des Tags ist nicht gut) addiert nichts, und der Zähler sagt das auf seiner Karte mit dem Grund. Ein kumulierter Zähler, der nicht gelesen wurde und zurückkommt, zählt, was er sich inzwischen bewegt hat, als Lücke.
* **Ein Messwert, der nicht gespeichert werden konnte,** wird im nächsten Takt vom selben Ausgangspunkt aus neu berechnet.

## Was es kostet

Ein Tarif bepreist jeden Abschnitt beim Anlegen: einen festen `price` pro Einheit und optional `bands` für einen zeitvariablen Tarif. Ein Band ist `from` und `to` auf einer Viertelstunde der eigenen Uhr des Standorts (ein `to` vor dem `from` läuft über Mitternacht), die `days`, an denen es gilt (`mon` bis `sun`, jeder Tag, wenn weggelassen) und ein `price`. Das erste Band, das im Moment gilt, gewinnt; außerhalb jedes Bandes gilt der feste Preis. Ein Abschnitt wird in der Mitte der Zeit bepreist, die jeder Messwert abdeckt.

Weil die Kosten mit dem Abschnitt gespeichert werden, **ändert ein später geänderter Preis nicht, was der letzte Monat gekostet hat.** Den Tarif eines Zählers zu ändern, ändert, was er von da an zählt.

`currency` ist ein Code oder ein Symbol. Kosten in zwei Währungen werden nie addiert: Die Zusammenfassung hat für jede ein Kostenfeld.

### Ein Leistungspreis

Ein Stromzähler in `Wh`, `kWh` oder `MWh` kann in seinem Tarif einen `demand_price` haben: was ein Kilowatt der höchsten Viertelstunde des Werks kostet. Über ein Fenster ist die Leistung eines Abschnitts die Kilowatt, die er im Mittel hatte (eine Viertelstunde mit 25 kWh Verbrauch hatte im Mittel 100 kW), und seine Gebühr ist das mal dem Leistungspreis, den der Zähler hatte, als der Abschnitt angelegt wurde. Die Gebühr des Fensters ist die höchste davon, was bei einem Preis die Spitze mal dem Preis ist. Die Zusammenfassung gibt jedem solchen Zähler ein `demand` mit der Spitze in kW, wann sie begann, und der Gebühr, und rechnet die Gebühr in die Kosten des Fensters und in die Kosten einer gefertigten Einheit ein. Die `cost` des Zählers bleibt das, was die Energie gekostet hat.

Wie der Energiepreis wird der Leistungspreis beim Anlegen mit jedem Abschnitt gespeichert (Migration 0030), also **ändert eine Änderung des Leistungspreises, was von da an gezählt wird, und nie den abgeschlossenen Monat.** Abschnitte, die angelegt wurden, bevor der Zähler einen Leistungspreis hatte, tragen keinen: Sie zeigen eine Spitze und keine Gebühr.

Ein Versorger rechnet die Leistung über seinen Abrechnungsmonat ab, fragen Sie also `this_month` oder `last_month` ab, um die Zeile der Rechnung zu sehen; ein kürzeres Fenster gibt die Gebühr für die höchste Viertelstunde darin. Wurde die Spitzen-Viertelstunde nicht ganz gelesen (`peak_covered_seconds` unter 900), ist die Spitze zu niedrig angegeben, und der Bildschirm sagt das. Die `Today`-Sensoren unten zählen nur Energie: Ein Leistungspreis ist eine Zeile der Monatsrechnung, nichts, was den ganzen Tag aufläuft.

## Die Kosten einer gefertigten Einheit

Die Kosten über ein Fenster der bepreisten Zähler, die Sie wählen, geteilt durch das, was ein Produktionszähler im selben Fenster gezählt hat. Die Zusammenfassung gibt eine für jeden Produktionszähler und jede Währung. Wurde nichts gefertigt, sind die Kosten pro Einheit `null` mit dem `reason` `nothing_made`, und der Bildschirm sagt „Nichts gefertigt“: Das ist keine Antwort, nicht null und keine Division durch null. Dasselbe, wenn etwas gefertigt wurde und noch kein bepreister Zähler Verbrauch gezählt hat (`nothing_counted`, „Noch keine Energie gezählt“): Die Zähler werden nacheinander gelesen, ein Register, das sich noch nicht bewegt hat, ist also kein kostenloses Produkt. Ein Zähler, der etwas zu einem Preis von null gezählt hat, zählt trotzdem und gibt Kosten von null.

`GET /api/energy/summary?period=today&meters=line2-electricity,line2-air&per=line2-parts` berechnet es für eine Linie: `meters` nennt die Zähler, deren Kosten einfließen, `per` den Produktionszähler. Ohne sie sind es alle bepreisten Zähler über alle Produktionszähler.

## Fenster

`period` ist `today`, `yesterday`, `this_week` (Wochen beginnen am Montag), `last_week`, `this_month`, `last_month`, `last_7_days` oder `last_30_days`, eine Schicht, oder geben Sie `from` und `to` als RFC 3339 an (höchstens 400 Tage). Tage, Wochen und Monate sind die **des Standorts**, in dessen eigener Zeitzone (`HOTLOOP_TIMEZONE`): Mitternacht ist die Mitternacht des Werks, und der Tag mit 23 oder 25 Stunden ist der wirkliche Tag. Eine Schicht wird `shift:06:00-14:00` geschrieben, von und bis auf einer Viertelstunde der Uhr des Standorts, und ein `to`, das nicht nach dem `from` liegt, läuft über Mitternacht (`shift:22:00-06:00`). `shift:` ist die zuletzt begonnene, also die laufende, wenn eine läuft, und `last_shift:` ist die davor. Eine Schicht wird aus dem Kalendertag aufgebaut, die Nacht der Zeitumstellung ist also so lang, wie sie wirklich war. Der Bildschirm hat neben den Zeiträumen ein Feld Schicht, und dieselben Namen kommen in den Zeitraum der MCP-Werkzeuge. Reihen werden in Schritten von `quarter` (höchstens 8 Tage), `hour`, `day` oder `month` geschnitten.

## Auf dem Bildschirm

Der Bildschirm Energie (Gruppe Werk) hat eine Zeitraumauswahl, die Kosten des Zeitraums, die Kosten pro gefertigter Einheit für jeden Produktionszähler und eine Karte für jeden Zähler: was er verbraucht hat, was es gekostet hat, einen Balken für jede Stunde (oder jeden Tag) und, wo es zutrifft, ob er gelesen wird, ob ein Teil davon geschätzt ist und für wie viel des Zeitraums ein Leistungszähler gelesen wurde. Ein Balken mit gestricheltem Rand ist geschätzt. Ein Zähler, der nicht gelesen werden kann, sagt, warum. Jedes Wort steht in allen 14 Sprachen.

## Entitäten

Jeder Zähler liefert Sensoren, die jeder Bildschirm und jede Regel verwenden kann:

| Entität | Zustand |
|---|---|
| `sensor.<meter>_today` | was der Zähler seit Mitternacht des Standorts verbraucht hat, in seiner Einheit |
| `sensor.<meter>_cost_today` | was das gekostet hat (ein bepreister Zähler) |
| `sensor.<production meter>_cost_per_unit_today` | die Kosten von heute geteilt durch die heute gefertigten Einheiten. `unknown`, bis etwas gefertigt wird, und wenn Zähler in zwei Währungen bepreist sind |

Sie gehören zur Plattform `energy`, sie lesen und nehmen keinen Dienst an. Ein Zähler, der aufgehört hat zu antworten, bleibt das, was er bis dahin verbraucht hat, mit der Qualität `uncertain` und `meter_status`, das sagt, warum.

## MCP

Agenten lesen und verwalten Zähler über dieselben Routen:

| Werkzeug | Tut |
|---|---|
| `list_energy_meters`, `get_energy_meter` | die Zähler, wie jeder gelesen wird, und der Verbrauch und die Kosten von heute |
| `get_energy_summary` | was jeder Zähler über einen benannten Zeitraum verbraucht und gekostet hat, die Kosten in jeder Währung und die Kosten einer gefertigten Einheit |
| `get_energy_series` | den Verbrauch eines Zählers über einen benannten Zeitraum in Schritten |
| `create_energy_meter`, `update_energy_meter`, `delete_energy_meter` | einen Zähler anlegen, ändern und entfernen. Jedes braucht eine Begründung und wird protokolliert |

Die Filter `meters` und `per` der Kosten pro Einheit sind REST-Abfrageparameter.

## Sicherung und Updates

Drei Tabellen halten es (Migration 0029): `energy_meters`, `energy_meter_state` und `energy_buckets`, alle in der Sicherung. Migration 0030 fügt den Leistungspreis den Zählern und jedem Abschnitt hinzu. Die Migrationen fügen nur hinzu. Ein Abschnitt hat etwa 100 Byte, ein Zähler also etwa 3,5 MB im Jahr.

## Was es nicht tut

* **Es kennt Ihre Schichten nicht.** Eine Schicht wird in der Anfrage genannt, als `shift:06:00-14:00`; es gibt keine Liste der Schichten des Werks zur Auswahl, und eine Schicht, die nicht auf einer Viertelstunde liegt, wird abgelehnt, weil die Abschnitte Viertelstunden sind.
* **Es rechnet den Leistungspreis nicht für Sie ab.** Die Gebühr ist die höchste Viertelstunde im Fenster mal dem Preis; Staffelungen, Mindestleistungen und Blindleistungsgebühren eines Versorgers sind darin nicht enthalten.
* **Es liest keinen Zähler für Sie.** Zuerst kommt das Tag: Fügen Sie das Gerät hinzu (Modbus, MQTT, OPC UA oder Emberburn für ein simuliertes), dann legen Sie den Zähler an.
