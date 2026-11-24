---
title: "Versionshinweise: HotLoop Cascade 1.6.0"
description: "Was HotLoop Cascade 1.6.0 bringt, was sich beim Update ändert und was Sie lesen sollten, bevor Sie eine laufende Anlage anfassen."
sidebar:
  label: "1.6.0"
---

## Worum es geht

1.6.0 ist die Version, in der Cascade aufhört, nur ein Ort zu sein, an dem Workflows laufen, und zu einem Ort wird, an dem Menschen, Modelle und andere Server mitmachen. Ein Lauf kann anhalten und eine Person auf dem Handy fragen. Ein Lauf kann ein Modell fragen, das Ihnen gehört. Ihre Workflows können in Git leben, und eine Produktionsinstanz kann sich weigern, von Hand bearbeitet zu werden. Und jede Web-API kann aus einer Datei zu Schritten werden. Die Engine, das Dateiformat und alles andere sind das von 1.5.1.

## Eine Person fragen, vom Handy aus

Der neue Schritt Freigabe anfordern hält den Lauf an und wartet. Legen Sie `execution.approvalUrl` in eine Push-Benachrichtigung, und wer sie bekommt, tippt darauf, liest, was Sie geschrieben haben, füllt ein kleines Formular aus, falls Sie eines gebaut haben, und tippt auf Freigeben oder Ablehnen. Die Seite ist schlicht, schnell, verlangt keine Anmeldung, es sei denn, Sie wollen sie, und spricht in allen vierzehn Sprachen die Sprache des Browsers. Der Lauf geht über Freigegeben oder Abgelehnt weiter, mit Angabe, wer geantwortet hat, wann und was. Jede Antwort ist ein Eintrag: im Editor am Lauf, in der API unter `GET /api/v1/approvals`, im MCP-Server als `list_approvals` und im Audit-Protokoll. Lassen Sie den Schritt ein angemeldetes Konto verlangen, nimmt er nur Antworten der Konten an, die Sie auflisten. Ein Link funktioniert einmal. Warten kostet nichts, eine Antwort kann also eine Woche später kommen und jeden Neustart überstehen.

## Ein Modell fragen

Zwei neue Schritte, KI: ein Modell fragen und KI: einen Agenten ausführen. Das Modell gehört Ihnen: Zugangsdaten zeigen auf einen Server, den Sie betreiben (Ollama, vLLM, llama.cpp), oder auf einen gehosteten Dienst, für den Sie einen Schlüssel haben, über das OpenAI-Protokoll oder das von Anthropic. Nichts geht dorthin, wo die Zugangsdaten es nicht nennen, es gibt keinen gehosteten Dienst, und jeder Aufruf läuft wie jeder andere durch die Egress-Richtlinie. Ein Modell fragen legt die Antwort auf das Element, als Text oder als JSON-Objekt, das einem von Ihnen vorgegebenen Schema entspricht. Einen Agenten ausführen gibt dem Modell ein Ziel und eine Liste von Werkzeugen, in der jedes Werkzeug ein anderer Ihrer Workflows ist. Das Modell fordert eines an, Cascade führt es aus, gibt das Ergebnis zurück, und das wiederholt sich, bis das Modell antwortet oder keine Runden mehr hat. Zwischen den Runden wartet der Lauf in der Datenbank, ein langsames Werkzeug kostet also keinen Worker.

## Workflows in Git

Verbinden Sie ein Projekt mit einem Repository, einem Branch und einem Ordner und pushen oder pullen Sie. Push schreibt eine Datei pro Workflow, nach ihm benannt und mit seiner ID, und committet als die Person, die gepusht hat, mit der Nachricht, die sie angegeben hat. Pull gleicht das Projekt mit dem Repository ab: Neue Dateien werden zu Workflows (ausgeschaltet, bis Sie sie einschalten), geänderte Dateien werden zu neuen Versionen, IDs bleiben erhalten, damit ein Workflow auf jeder Instanz derselbe ist, und eine auf beiden Seiten gemachte Änderung wird gemeldet und unangetastet gelassen, solange Sie nicht sagen, wer gewinnt. Löschungen passieren nur, wenn Sie es verlangen. Es gibt eine Karte an jedem Projekt, sechs API-Routen und sechs MCP-Werkzeuge. Es spricht HTTPS mit einem Benutzernamen und einem Token oder Passwort aus dem Tresor, durch die Egress-Richtlinie.

## Geschützte Instanzen

Geben Sie einer Instanz einen Namen (Entwicklung, Staging, Produktion), und er erscheint in einem Abzeichen oben auf jedem Bildschirm. Schützen Sie sie, über die Einstellungen oder mit `HOTLOOP_CASCADE_PROTECTED` (der Wert `protected` des Charts, den keine Einstellung rückgängig machen kann), und ihre Workflows lassen sich im Editor, in der API und über MCP nicht von Hand anlegen, bearbeiten, wiederherstellen oder löschen. Sie kommen per Pull aus Git. Zugangsdaten, Variablen, Läufe und das Ein- und Ausschalten eines Workflows bleiben offen, weil sie sich zwischen den Umgebungen unterscheiden. Eine geschützte Instanz pullt und pusht nicht.

## Konnektoren als Dateien

Ein Konnektor ist eine Datei, die sagt, wo eine API ist, wie man sich anmeldet und was jeder Aufruf annimmt und zurückgibt. Legen Sie sie in `HOTLOOP_CASCADE_CONNECTORS_DIR` (der Ordner `connectors` im Datenverzeichnis), und jede Operation ist ein Schritt, mit Formular, eigenem Zugangsdatentyp, Seitenumbruch und Wiederholungen, so sortiert, wie es die eingebauten Konnektoren tun. Das Format ist veröffentlicht, versioniert und hat ein JSON Schema (`hotloop-cascade connector schema`). Die Werkzeuge zum Schreiben eines Konnektors stecken im Binary: `connector init`, `validate`, `call` (eine Operation gegen die echte API ausprobieren) sowie `index` und `install` zum Teilen, wobei ein Index aus statischen Dateien mit je einem Hash besteht. Cascade lädt nie einen Index, den Sie nicht genannt haben. Der MCP-Server hat jetzt 91 Werkzeuge.

## Zurückgehen

Dieses Release fügt drei Tabellen hinzu (Freigaben und zwei für Git), und Migrationen gehen nur vorwärts. Der Weg zurück zu 1.5.1 braucht also die Sicherung, die Sie vor dem Update gemacht haben, nicht nur das alte Image. Nichts Bestehendes ändert seine Form.
