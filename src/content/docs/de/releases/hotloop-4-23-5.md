---
title: "Versionshinweise: HotLoop core 4.23.5"
description: "Was HotLoop core 4.23.5 bringt, was sich beim Update ändert und was Sie lesen sollten, bevor Sie eine laufende Anlage anfassen."
sidebar:
  label: "4.23.5"
---

Nur für amd64 gebaut.

Der UniFi-Bildschirm fragt HotLoop im Vier-Sekunden-Takt erneut, und ein Takt, der feuerte, während die Frage, die jemand gedrückt hatte, noch unterwegs war, nahm den Platz der Antwort ein, sodass die Ansicht auch für die ganze Frage des Taktes auf ihrem Skelett blieb, und ein weiterer Takt konnte es wiederholen. Der Takt wartet jetzt auf die Frage, die unterwegs ist. Ein Browsertest hält jede UniFi-Antwort drei Sekunden lang fest und zählt die Fragen, die für einen Druck hinausgehen: zwei vor der Korrektur, eine danach, wieder zwei mit entfernter Korrektur.

## Was sich geändert hat

- **Die Aktualisierung des UniFi-Bildschirms wartet auf die Ansicht, die gerade lädt.** Eine Ansicht, die länger als den Vier-Sekunden-Takt zum Antworten braucht, wird einmal gefragt, nicht einmal pro Takt.

Seit 4.23.4, hier übernommen:

Der Bildschirmimport geht von CODESYS zu TwinCAT. Eine `.TcVIS`-Datei und die Exporte von cds-text-sync und codescribe kommen als HotLoop-Bildschirm mit ihren Schaltflächen, Rahmen und Lampen an, und was nicht übernommen werden konnte, wird mit seinem Text aufgelistet, bevor irgendetwas gespeichert wird. Nur für amd64 gebaut; der Multi-Arch-Build folgt als nächste Version.

- **TwinCAT-Bildschirme werden importiert.** Eine TwinCAT-`.TcVIS`-Datei ist dieselbe Visualisierung im Archiv-XML der IDE, sie geht also durch den CODESYS-Konverter. Geprüft am echten TwinCAT-PackML-Beispiel (drei Bildschirme, MIT, Lizenz daneben aufbewahrt): 60 Elemente zugeordnet, keines nicht zugeordnet. Siehe [Import a CODESYS screen](/de/iot/codesys-screen-import/).
- **Schaltflächen.** Jede einfache Zuweisung in der Eingabeaktion einer Schaltfläche (`X := 5`, `X := TRUE`, ein Aufzählungsmitglied) wird zu einer Schaltflächenkarte, die diesen Wert schreibt, mit der Beschriftung als Label. Ein konfigurierter Toggle-Eingang wird zu einer Ein- und einer Aus-Schaltfläche. Code, der mehr als eine Zuweisung ist (eine Bedingung, ein Aufruf, Arithmetik), wird mit seinem Text gemeldet. Die OMAC-PackML-Aufzählungen sind bekannt; jede andere kommt in `enums` des Imports, und ein Mitglied ohne bekannte Nummer wird mit Namen geschrieben, und das wird gesagt.
- **Lampen und Ausblenden durch einen Ausdruck.** Die Variable einer Lampe oder eine Unsichtbar-Variable kann ein Vergleich eines Tags mit einer Zahl, TRUE, FALSE oder einem Aufzählungsmitglied sein, verbunden mit NOT, AND und OR und Klammern. Ein Vergleich zweier Tags, Arithmetik und Aufrufe lassen sich nicht übernehmen und werden gemeldet.
- **Rahmen.** Ein Rahmen zeigt eine andere Visualisierung. Senden Sie die anderen Dateien des Projekts mit der ersten (`codesysRelated`; im Dialog mehrere Dateien wählen, und die erste ist der Bildschirm), und die Visualisierung des Rahmens wird im Rahmen platziert, jeder Eingang an die Variable gebunden, die dem Rahmen gegeben wurde.
- **Symbolregeln lassen sich kombinieren.** Eine `show`- oder `colors`-Regel kann `{"all": [...]}` oder `{"any": [...]}` sein, das AND und OR einer SPS, drei Ebenen tief und acht Teile, und ein verlorenes Tag lässt ein `all` nicht gelten, während ein `any` durch die anderen gilt. Eine Lampe kann anstelle ihres Tags eine `lit`-Regel tragen. Siehe [Dashboards](/de/iot/dashboards/).
- **Tests.** Der Test des Energiezählers begrenzt, was die Zähler gezählt haben, durch die wirklich vergangene Zeit, nicht durch feste zehn Sekunden.

## Migrationen

Keine.

## API-Änderungen

`POST /api/dashboards/import` nimmt `codesysRelated` und `enums` neben `codesys`. Keine Route hat sich geändert. Siehe [die HTTP-API](/de/iot/api/).

## Update von 4.23.3

Ein normales `helm upgrade`. Keine Migration und kein neues Secret. Die 4.23.4 wurde nie veröffentlicht.

## Was nicht bewiesen ist

- Die Importer wurden am TwinCAT-PackML-Beispiel und an den Beispielexporten von cds-text-sync und codescribe bewiesen, nicht am eigenen Projekt eines Kunden. Ein Projekt, das mehr von der Visualisierungssprache nutzt, listet mehr auf, das es nicht platzieren konnte.
- Ausdrücke sind Vergleiche eines Tags mit einer Konstante, verbunden durch NOT, AND und OR. Alles andere wird gemeldet, nicht geraten.
