---
title: "Versionshinweise: HotLoop Cascade 1.3.0"
description: "Was HotLoop Cascade 1.3.0 bringt, was sich beim Update ändert und was Sie lesen sollten, bevor Sie eine laufende Anlage anfassen."
sidebar:
  label: "1.3.0"
---

## Worum es geht

1.3.0 bringt den Editor in 14 Sprachen: Englisch, Spanisch, Französisch, Italienisch, Deutsch, Norwegisch Bokmål, Bulgarisch, Griechisch, Koreanisch, Japanisch, Vietnamesisch, Hindi, vereinfachtes Chinesisch und Arabisch. Die Engine, das Dateiformat der Workflows, die REST-API und der MCP-Server sind die von 1.2.1.

## Die Sprachen

- Eine Sprachauswahl sitzt in der oberen Leiste des Editors und auf der Anmeldeseite. Die Wahl wird im Browser gespeichert, und ein erster Besuch folgt der Sprache des Browsers.
- Jeder Bildschirm ist übersetzt: Workflows, Läufe, Insights, Variablen, Zugangsdaten, Projekte, Benutzer, Rollen, das Audit-Protokoll, Einstellungen, Ihr Konto, Geheimnisse, Log-Streaming und der Schritt-Editor. Ebenso die Schritttitel und ihre Hilfe, die Zugangsdatentypen und die Ablehnungen, die der Server schickt, wenn ein Speichern, Löschen oder eine Anmeldung abgelehnt wird.
- Datumsangaben, Zahlen, Dauern und Listen kommen aus der eigenen Formatierung des Browsers für die gewählte Sprache. Arabisch wird von rechts nach links geschrieben, wobei Arbeitsfläche, Code und Ausdrücke weiterhin von links nach rechts laufen. Arabisch verwendet die Ziffern 0 bis 9 und den gregorianischen Kalender.
- Produktnamen, Knotennamen, Protokollnamen und Beispielwerte bleiben in jeder Sprache Englisch. Eine Meldung darüber, wie die Person, die die Instanz betreibt, ein Verzeichnis, einen SAML- oder OpenID-Anbieter, einen Geheimnisspeicher oder eine Schlüsseldatei eingerichtet hat, wird so angezeigt, wie der Server sie geschrieben hat, weil der Betreiber nach diesem Text sucht.
- Die Wörter stammen aus dem gemeinsamen HotLoop-Glossar. Die Zeilen, die ein Muttersprachler zuerst bestätigen sollte, stehen in der `_review.json` jeder Sprache unter `web/src/i18n/locales`. Noch hat sie niemand geprüft, der diese Sprachen als Muttersprache liest.
- Eine Sprache wird nur angeboten, wenn jede ihrer Zeilen da ist. Der Build prüft, dass jede Sprache jeden englischen Schlüssel hat, dass Platzhalter und Tags erhalten bleiben und dass Pluralformen stimmen. Ein Go-Test hält die englischen Schrittwörter und Servermeldungen gleich mit dem, was der Server sagen kann, sodass kein neuer Schritt und keine neue Ablehnung ohne eine zu übersetzende Zeile erscheinen kann.

## Außerdem in dieser Version

- Der Editor-Test, der prüft, dass die gebauten Dateien nie auf einen anderen Host zeigen, erlaubt jetzt vier Beispieladressen (`https://ntfy.sh`, `https://example.com`, `https://hotloop.plant` und `http://hotloop:8080`). Sie stehen im Hilfetext der Schritte, der jetzt für jede Sprache im Editor ausgeliefert wird, und sind Wörter in einem Satz, die nichts abruft. Der Browser-Test schlägt weiterhin fehl, wenn der Editor irgendetwas von einem anderen Host anfordert.
- Der Test-Browser hat die Noto-Schriften für Koreanisch, Japanisch, Chinesisch und Hindi, sodass diese Bildschirme Buchstaben statt leerer Kästchen zeichnen.
- Der OpenBao-Testhelfer versucht einen Schreibvorgang erneut, solange OpenBao meldet, dass ein neuer Key-Value-Mount noch aktualisiert wird (26e1e13).
- HotLoop LLC ist als Lizenzgeber und Maintainer von Cascade genannt (0ea9cd5).

## Nur amd64, und warum

Diese Version wird nur für amd64 gebaut. Multi-Arch kommt in einem eigenen Lauf, also ist die Version nach dieser ein kleiner Versionssprung, der beide baut. `stable`, `latest`, `1.3` und `1` führen das neue amd64-Image neben dem arm64-Image auf, auf das sie schon zeigten.

## Ein bekanntes Problem

In der geteilten Installation (Server-, Worker- und Webhook-Pods auf PostgreSQL) starten die Pods, bevor der Name der Datenbank aufgelöst wird, und starten zwei- oder dreimal neu, bevor sie bereit sind. Sie kommen hoch und die Installation besteht, aber es ist laut. 1.2.1 verhält sich genauso, also ist es nicht neu. Der Fix ist, mit Wiederholung zu verbinden, bis die Datenbank bereit ist, und er kommt in der nächsten Version.

## Upgrade und zurück

Keine Migrationen. `helm upgrade` auf 1.3.0, oder lassen Sie `:stable` die Quadlet-Units weiterbewegen. 1.2.1 zurückzuspielen ist sicher, weil sich in der Datenbank nichts geändert hat. Die gewählte Sprache liegt im Browser, deshalb geht beim Zurückgehen nur die Auswahl verloren.
