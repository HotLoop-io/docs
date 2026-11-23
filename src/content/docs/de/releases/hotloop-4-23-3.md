---
title: "Versionshinweise: HotLoop core 4.23.3"
description: "Was HotLoop core 4.23.3 bringt, was sich beim Update ändert und was Sie lesen sollten, bevor Sie eine laufende Anlage anfassen."
sidebar:
  label: "4.23.3"
---

Ein WebVisu-Bildschirm behält beim Übernehmen sein Ausblenden und seine Alarmfarben, und jedes Symbol auf jedem Bildschirm kann jetzt durch eine Regel auf einem Tag angezeigt und eingefärbt werden. Eine kleine Korrektur der Backup-Liste fährt mit. Nur für amd64 gebaut; der Multi-Arch-Build folgt als nächste Version.

## Was sich geändert hat

- **Ein Symbol kann durch Regeln angezeigt und eingefärbt werden.** `show` zeichnet ein Symbol nur, solange eine Regel auf einem Tag gilt, sodass eine Tür, ein Schutz oder eine Pumpe, die für einen Zustand gezeichnet sind, nur in diesem Zustand da sind. `colors` sind bis zu vier Regeln, jede mit einem Ton (`ok`, `warn`, `bad` oder `info`): Die erste, die gilt, färbt das Symbol in diesem Ton, und wenn keine gilt, wird es gezeichnet wie zuvor. Eine Regel ist ein Tag und ein Vergleich (`on`, `off`, `eq`, `ne`, `gt`, `ge`, `lt`, `le`). Eine Regel, deren Tag keinen guten Messwert hat, gilt für nichts und versteckt nichts, sodass eine verlorene Verbindung nie ein Symbol verschwinden lässt. Das Symbolformular im Builder hat beides, und eine Bildschirmdatei listet und verschiebt die Tags der Regeln mit dem Rest. Siehe [Dashboards](/de/iot/dashboards/).
- **Der CODESYS-Bildschirmimport übernimmt Invisible und Toggle color.** Die Variable Invisible eines Elements (und die seiner Gruppe) wird zu einer `show`-Regel, mit `NOT x` zum Umdrehen, und seine Variable Toggle color wird zu einer `colors`-Regel im Ton, der der eigenen Alarmfarbe des Elements am nächsten ist. Sie werden an den IDs gefunden, die die eigenen Elementbäume der CODESYS-IDE ihnen geben. Was er nicht übernehmen kann, wird im Import gesagt, mit der Variable: diese beiden an einer Form, die ins Hintergrundbild gezeichnet ist (ein Rohr, ein Behälter, ein Rahmen), weil das Bild ein einziges Bild ist, und jede andere variablengesteuerte Einstellung (eine Füllung, eine Rahmen- oder Textfarbe, eine Bewegung, ein Blinken, eine Textliste). Siehe [Import a CODESYS screen](/de/iot/codesys-screen-import/).
- **Die Backup-Liste scheitert nicht, während ein Backup aufgeräumt wird.** Das geplante Backup räumt alte Backups in einer eigenen Goroutine auf, und eine Auflistung, die mittendrin landete, scheiterte an der fehlenden Datei, was die API als Serverfehler beantwortete. Ein Backup, das weg ist, wird jetzt aus der Liste weggelassen.

## Migrationen

Keine.

## API-Änderungen

Die Konfiguration eines Symbols nimmt `show` und `colors`. Keine Route hat sich geändert. Siehe [die HTTP-API](/de/iot/api/).

## Update von 4.23.2

Ein einfaches `helm upgrade`. Keine Migration und kein neues Secret. Ein Symbol ohne eine der beiden Regeln wird wie bisher gezeichnet.

## Was nicht bewiesen ist

- Der CODESYS-Import wurde gegen den eigenen Export der IDE einer Visualisierung und die Gruppenvariable des CODESYS-Beispiels Refrigerator bewiesen. Ein Bildschirm aus einem anderen Projekt kann mehr auflisten, das er nicht platzieren konnte.
- Die neuen Symbolregeln wurden durch die Tests der Suite bewiesen, nicht auf dem Bildschirm einer Anlage.
