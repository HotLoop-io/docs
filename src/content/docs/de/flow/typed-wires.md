---
title: "Typisierte Leitungen"
description: "Setzen Sie ein JSON Schema auf den json-Knoten und prüfen Sie Nachrichten auf der Leitung: Eine falsche Form landet im Catch-Knoten, der jedes Feld nennt."
---

Eine Nachricht mit der falschen Form ist der Fehler, den wir auf einer laufenden Linie am wenigsten wollen. Eine Temperatur, die als Zeichenkette `"hot"` ankommt, eine fehlende `id`, eine Zahl, wo eine Liste sein sollte: Nichts stürzt ab, der Flow läuft weiter, und etwas weiter unten tut leise das Falsche. Flow bringt JSON Schema in drei Schritten an dieses Problem.

## Schema am `json`-Knoten

Geben Sie dem `json`-Knoten in seinen Einstellungen ein Schema, und jeder Wert, den er verarbeitet, wird dagegen geprüft. Ein passender Wert geht weiter. Ein nicht passender Wert geht an einen Catch-Knoten, läuft nicht weiter die Leitung entlang, und der Fehler nennt jedes fehlerhafte Feld:

```
does not match the schema: payload.temp: got string, want number; payload.id: missing property "id"
```

`msg.schemaError` trägt dasselbe als Liste von `{path, keyword, message}`-Objekten, für einen Catch-Knoten, der danach verzweigen will. Pfade lesen sich so, wie ein Change-Knoten sie schreibt: `payload.sensors[2].temp`.

Hat der Knoten in seinen Einstellungen kein Schema und eine Nachricht trägt `msg.schema`, validiert der Knoten dagegen, so wie es der `json`-Knoten von Node-RED tut. Eine Nachricht, die besteht, verliert ihr `msg.schema`. Eine, die durchfällt, behält es. Das Schema in den Einstellungen gewinnt, wenn beide da sind.

- Das Schema ist JSON Schema Draft 2020-12, es sei denn, es nennt mit `$schema` einen anderen Draft. Die Drafts 4, 6, 7 und 2019-09 werden akzeptiert.
- Ein ungültiges Schema in den Einstellungen lässt das Deploy mit der Begründung des Validators scheitern. Ein ungültiges `msg.schema` ist ein Fehler an dieser Nachricht.
- Ein Schema ist in sich geschlossen. Ein `$ref` auf eine andere URL oder eine Datei wird abgelehnt, nicht abgerufen, sodass sich eine Edge-Box ohne Weg nach draußen wie jede andere verhält.
- `format` wird für die Formate geprüft, die der Validator kennt, und für den Rest ignoriert, wie bei den meisten Validatoren.
- Ein Flow ohne irgendein Schema verhält sich genau wie zuvor.

Alles andere in Flow, das einen Wert gegen ein Schema prüfen muss, nutzt dasselbe Paket.

## Schemas an Ports

Jeder Knoten kann deklarieren, was er annimmt und was jeder Ausgangsport verspricht. Zwei optionale Schlüssel am Knoten, beide in der Flow-Datei, beide von jedem anderen Werkzeug, das sie liest, ignoriert, sodass ein Flow, der sie trägt, weiterhin Byte für Byte hin und zurück geht:

```json
{"id":"sensor","type":"function","outputs":2,"wires":[["limit"],[]],
 "ew_outSchemas":[{"type":"object","properties":{"payload":{"type":"object",
   "required":["temp"],"properties":{"temp":{"type":"number"}}}}}, null]},
{"id":"limit","type":"switch","wires":[[],[]],
 "ew_inSchema":{"type":"object","required":["topic"]}}
```

`ew_inSchema` ist das, was der Knoten annimmt. `ew_outSchemas` ist eine Liste mit einem Schema oder `null` für jeden Ausgangsport. Ein Schema beschreibt die ganze Nachricht, der Payload ist also `properties.payload`. Schlüssel, die mit einem Unterstrich beginnen, `_msgid` und die übrige interne Buchführung der Runtime, bleiben aus dem heraus, was es sieht, sodass ein geschlossenes Schema sie nicht nennen muss. Es sind JSON Schemas wie das des `json`-Knotens, und dasselbe Paket prüft sie.

**Eine Unstimmigkeit, die der Editor sehen kann, wird beim Deploy abgelehnt.** Wenn beide Enden einer Leitung ein Schema deklarieren und keine Nachricht beide erfüllen könnte, wird das Deploy abgelehnt, bevor ein einziges Byte geschrieben ist, wie beim Test-Gate: ein 422, nichts neu gestartet, nichts gespeichert, und ein Eintrag im Audit als `deploy.refused` mit dem Grund `typed wires`.

```
the deploy was refused because of 1 typed wire problem, and the flows already running are untouched; junction "sensor" (sensor) output 1 -> "limit" (limit): payload.temp: the sender sends string and the receiver takes number
```

Es lehnt nur ab, was es beweisen kann. Verschiedene Typen im selben Feld, ein Wert außerhalb des `enum` oder Bereichs des anderen Endes, ein Feld, das der Empfänger verlangt und das das geschlossene Schema des Senders ausschließt, ein Feld, das der Sender immer schickt und das das geschlossene Schema des Empfängers verweigert. Ein Sender, der ein vom Empfänger verlangtes Feld einfach nicht erwähnt, wird nicht abgelehnt, weil die Nachricht es sehr wohl tragen kann, und ein Schema, das `$ref`, `allOf`, `anyOf`, `oneOf`, `not` oder `if` nutzt, wird in diesem Teil nicht angezweifelt. Eine falsche Ablehnung hält ein Deploy umsonst auf, und was es nicht beweisen kann, wird zur Laufzeit trotzdem gefangen. Ein Schema, das nicht kompiliert, oder ein `ew_outSchemas`, das länger ist als die Ausgänge des Knotens, wird auf dieselbe Weise abgelehnt. Rollbacks werden nicht geprüft, aus dem Grund, aus dem sie nicht durch Tests geschützt sind.

**Die Literale eines Inject-Knotens zählen als Typ.** Ein Inject hat kein eigenes Schema, aber was er sicher setzt, ist so gut wie eines. Wenn ein Inject direkt mit einem Knoten mit `ew_inSchema` verbunden ist, werden der literale Payload und jede andere literale Eigenschaft, die er setzt, beim Deploy gegen dieses Schema geprüft, und ein Literal, das der Empfänger nie annehmen kann, wird auf dieselbe Weise abgelehnt, mit demselben 422 und demselben `deploy.refused` im Audit:

```
inject "reading" (i1) output 1 -> "limit" (l1): payload: the inject sets "hot", which the receiver does not take: got string, want number
```

Geprüft wird nur ein Literal: eine Zeichenkette, eine Zahl, ein Boolean oder JSON. Ein Zeitstempel, eine Umgebungsvariable, der Flow- oder globale Kontext, eine andere Nachrichteneigenschaft, JSONata, ein Buffer oder ein regulärer Ausdruck ist erst bekannt, wenn der Knoten feuert, wird also übersprungen, nie geraten. Eine verlangte Eigenschaft, die der Inject nicht setzt, ist ebenfalls kein Konflikt, weil ein nicht statischer Wert sie setzen kann. Beurteilt wird nur die Leitung vom Inject zum Knoten: Ein Literal, das zuerst durch einen anderen Knoten geht, bleibt der Laufzeitprüfung überlassen. Der Editor zeichnet denselben Konflikt auf dieser Leitung.

**Eine, die er nicht sehen kann, geht an einen Catch-Knoten und an eine Metrik.** Eine Nachricht, die an einem Knoten ankommt und sein `ew_inSchema` verletzt, erreicht den Knoten nie. Eine Nachricht, die einen Port verlässt und sein Schema verletzt, wird beim Sender gestoppt und nie zugestellt. In beiden Fällen wird sie als Fehler des Knotens ausgelöst, der das Schema hielt, und der Catch-Knoten bekommt sie mit dem Pfad jedes fehlerhaften Feldes in `msg.error.message` und als Liste in `msg.error.violations`, jeweils `{path, keyword, message}`:

```
the message does not match the schema of output 1: payload.temp: got string, want number
```

`hotloop_flow_node_schema_mismatches_total` zählt sie pro Knoten und zählt auch die Abweichungen des `json`-Knotens. Ein Knoten ohne Schemas kostet eine nil-Prüfung, und ein Flow ohne Schemas verhält sich genau wie zuvor.

## Typen an den Leitungen, im Editor

Eine Leitung mit einem Typ an einem der beiden Enden trägt ihn. Der Editor schreibt den Typ auf die Leitung, in die Mitte der Kurve: den des Senders, in wenigen Zeichen (`payload {temp: number}`), und die ganze Geschichte, wenn Sie über die Leitung fahren.

- **Beide Enden deklarieren einen Typ und stimmen überein:** grüne Umrandung, der Typ des Senders.
- **Nur ein Ende deklariert einen:** gestrichelt und abgedunkelt, damit Sie sehen, wo eine Leitung noch untypisiert ist.
- **Beide deklarieren einen und können nie übereinstimmen:** Die Leitung und ihr Label werden rot und nennen das Feld, `≠ payload.temp`, und der Tooltip enthält die Begründung der Runtime. Das Deploy würde es ablehnen, und jetzt sehen Sie es, bevor Sie auf Deploy drücken.

Das Rot ist nicht der Editor, der rät. Er fragt die Runtime, `POST /flows/types`, die dieselbe Prüfung ausführt, mit der das Deploy ablehnt, sodass Zeichenfläche und Deploy nicht auseinanderlaufen können. Der Editor fragt nur, wenn etwas auf der Zeichenfläche ein Schema hat, kurz nach der letzten Änderung. Ein Flow ohne Schemas macht keinen Aufruf und zeichnet nichts Neues.

Setzen Sie die Typen im Dialog eines Knotens unter **Types**: ein Eingangsschema und eines für jeden Ausgangsport. Leer bedeutet kein Typ, und ein Knoten, den Sie nie typisiert haben, bekommt die Schlüssel nicht. Etwas zu schreiben, das kein JSON oder kein Objekt ist, wird im Dialog abgelehnt.
