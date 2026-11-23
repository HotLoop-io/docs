---
title: "Der Cascade-Editor"
description: "Der Editor steckt in der Cascade-Binärdatei: Ordner, Arbeitsfläche, Ausführungen Schritt für Schritt, Zugangsdaten, Projekte, Benutzer, Audit und Einstellungen."
---

Der Editor steckt in der Binärdatei, also gibt es nichts weiter zu starten, und er lädt nichts von irgendwoher nach: Öffnen Sie die Adresse, auf der der Server lauscht, und melden Sie sich an. Es ist eine Astro-App mit Svelte-Islands, beim Bauen des Images zu statischen Dateien gebaut, in denselben Farben und derselben Schrift wie jeder andere HotLoop-Bildschirm, hell oder dunkel nach Ihrem System, bis Sie wählen.

![Workflows in Ordnern](/synced/cascade/docs/screenshots/workflows.png)

Workflows liegen in Projekten, und die Workflows eines Projekts liegen in Ordnern, die so tief verschachtelt sein können wie Ihre Anlage: Bereich, Linie, Zelle. Ein Workflow wechselt den Ordner über seine eigene Zeile.

![Die Arbeitsfläche, ein Schritt ausgewählt und seine Einstellungen daneben](/synced/cascade/docs/screenshots/editor.png)
![Dasselbe im Dunkelmodus](/synced/cascade/docs/screenshots/editor-dark.png)

Die Arbeitsfläche ist dort, wo sie immer war: von einem Ausgang zu einem Eingang ziehen, einen Schritt verschieben, `Ctrl+S` zum Speichern, `Delete`, um einen Schritt zu entfernen. Bis hierher ausführen führt aus, was auf dem Bildschirm steht, ungespeichert, bis zum gewählten Schritt und zeigt dessen Ausgabe als Tabelle, als Felder oder als JSON, und Sie können diese Ausgabe anheften, damit der Schritt nicht mehr läuft, während Sie die folgenden bauen. Jedes Feld nimmt einen Ausdruck an und zeigt, was er beim letzten Testlauf ergibt. Ein Speichern über das von jemand anderem wird gemeldet, nicht durchgesetzt.

![Eine fehlgeschlagene Ausführung, so gezeichnet, wie sie lief](/synced/cascade/docs/screenshots/run.png)

Eine Ausführung wird mit dem Ergebnis jedes Schritts gezeichnet. Wiederholen Sie sie ab dem fehlgeschlagenen Schritt, ab einem beliebigen Schritt, oder debuggen Sie sie im Editor gegen Änderungen: Die Schritte vor dem, den Sie erneut ausführen, behalten, was sie getan haben, sodass ein Schreibvorgang, der schon stattgefunden hat, nicht zweimal stattfindet. Eine Person kann nachträglich einen Daumen hoch oder runter, eine Notiz und Tags an einer Ausführung hinterlassen, und die Liste der Ausführungen findet Ausführungen anhand davon.

![Ausführungen, mit dem, was Leute darüber gesagt haben](/synced/cascade/docs/screenshots/executions.png)
![Auswertungen der letzten sieben Tage](/synced/cascade/docs/screenshots/insights.png)
![Rollen](/synced/cascade/docs/screenshots/roles.png)
![Schwärzungsrichtlinien](/synced/cascade/docs/screenshots/redaction.png)

Der Rest der Governance-Arbeit liegt unter Einstellungen: Rollen und wer sie hat, Schwärzungsrichtlinien (ein Workflow wählt in seinen Einstellungen eine aus, vom Editor aus), externe Geheimnisspeicher, Protokollweiterleitung sowie Anmeldung und SCIM. Ein Eigentümer oder Admin ändert diese; alle anderen lesen, was sie dürfen, bekommen nie eine Schaltfläche angeboten, die der Server ablehnen wird, und der Server lehnt sie trotzdem ab.

Vier Bildschirme stehen neben den Workflows. Zugangsdaten werden in ihrem eigenen Projekt angelegt, geöffnet, geändert, mit anderen Projekten geteilt und gelöscht; ein geheimes Feld wird einmal eingegeben, und der Bildschirm sagt danach nur noch, dass es gesetzt ist. Projekte zeigt, wer in welchem Projekt ist und in welcher Rolle, und die Dienstkonto-Schlüssel, mit denen sich eine dauerhafte Integration anmeldet. Ihr Konto (die Adresse in der oberen Leiste) erstellt und widerruft Ihre API-Schlüssel, mit denen sich die REST-API und der MCP-Server anmelden, und ändert Ihr Passwort. Für Eigentümer und Administratoren enthält Einstellungen die allgemeinen Einstellungen (zweiter Faktor, der Fehler-Workflow), Benutzer legt Personen an, schaltet sie ab und lässt einen Eigentümer eine Person löschen (ihre Anmeldungen und Schlüssel verschwinden, ihre Workflows bleiben), und das Audit-Protokoll wird dort gelesen, gefiltert und auf Manipulation geprüft. Die Anmeldung ist derselbe Editor, unter `/login`, und behält Single Sign-on, Verzeichnisanmeldung, Passkeys und Wiederherstellungscodes.

![Zugangsdaten, das Geheimnis wird nie angezeigt](/synced/cascade/docs/screenshots/credentials.png)
![Projekte und wer in einem ist](/synced/cascade/docs/screenshots/projects.png)
![Das Audit-Protokoll und die Prüfung, dass es unversehrt ist](/synced/cascade/docs/screenshots/audit.png)
![Ihr Konto und seine API-Schlüssel](/synced/cascade/docs/screenshots/account.png)

Was das für Sie bedeutet: Alles, was Cascade kann, können Sie auf diesem Bildschirm tun, auf einem Anlagenrechner ohne Internet, ohne eine Zeile curl.

Der Editor spricht die Sprache dessen, der davorsteht. Die Auswahl in der oberen Leiste (und auf der Anmeldeseite) listet jede Sprache mit ihrem eigenen Namen auf, merkt sich die Wahl in diesem Browser und startet beim ersten Mal in der Sprache Ihres Browsers. Schritttitel und ihre Hilfe, Zugangsdatentypen, die Schaltflächen, die Ablehnungen des Servers, Datumsangaben, Zahlen und Dauern erscheinen alle in der gewählten Sprache, und Arabisch läuft von rechts nach links, wobei die Workflow-Arbeitsfläche wie für alle weiter von links nach rechts gezeichnet wird. Eine Sprache wird nur angeboten, wenn jedes ihrer Wörter da ist: `web/src/i18n/check.mjs` lässt den Build scheitern, wenn ihr eine Zeile, ein Platzhalter oder eine Pluralform fehlt, und `web/scripts/i18n-scan.mjs` lässt ihn bei direkt in einen Bildschirm getipptem Text scheitern. Die Wörter liegen in `web/src/i18n/locales/<language>/`, und ein Schritttyp oder eine Ablehnung, die der Server neu bekommt, wird von einem Go-Test dagegen geprüft. Die eigene Ausgabe einer Ausführung und alles, was ein von einem Schritt aufgerufenes Programm gesagt hat, wird so angezeigt, wie es aufgezeichnet wurde.

Was das für Sie bedeutet: Ihre Bediener lesen den Bildschirm in ihrer eigenen Sprache, und ein neuer Bildschirm kann nicht mit einer Zeile Englisch erscheinen, die niemand übersetzt hat.
