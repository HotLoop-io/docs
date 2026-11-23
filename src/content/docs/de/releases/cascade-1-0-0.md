---
title: "Versionshinweise: HotLoop Cascade 1.0.0"
description: "Was HotLoop Cascade 1.0.0 bringt, was sich beim Update ändert und was Sie lesen sollten, bevor Sie eine laufende Anlage anfassen."
sidebar:
  label: "1.0.0"
---

## Worum es geht

1.0.0 bringt die Identitäts- und Governance-Arbeit und einen neuen Editor in einer Version. Alles aus 0.1.2 ist noch da und funktioniert wie zuvor: die Engine, die Konnektoren, der Importer, das Helm-Chart, die Quadlet-Units und das Dateiformat der Workflows. Neu ist, was eine Anlage mit einer Instanz tun kann und wie sie dabei aussieht.

Wir nennen es 1.0.0, weil der Editor das letzte Stück war, das wir haben wollten, bevor wir unseren Namen unter die Nummer setzen. Jeder Bildschirm arbeitet gegen die echte API, und jede Funktion unten wurde gegen den echten Server getestet, mit dem sie spricht, nicht gegen einen Ersatz.

## Der neue Editor

Er ist mit Astro und Svelte-Islands neu gebaut, in HotLoops eigenen Farben und Schriften, und folgt dem hellen oder dunklen Modus Ihres Systems, bis Sie einen wählen. Er ist weiterhin ins Binary eingebaut und lädt nirgendwoher etwas nach, sodass eine Maschine ohne Internet ihn genauso ausführt wie eine mit. Jeder Bildschirm des alten Editors ist da und tut, was er tat, die Arbeitsfläche eingeschlossen: Wir haben seinen Code übernommen, statt ihn neu zu schreiben, und jeden Bildschirm, jede Schaltfläche, jedes Feld und jeden API-Aufruf vorher und nachher gezählt, damit nichts fehlt.

Die URLs, die Sie gespeichert haben, funktionieren weiter. `#/w/<id>`, `#/x/<id>`, `#/executions` und die Debug-Links öffnen dieselben Bildschirme, und `/app/main.js` und `/app/main.css` antworten weiterhin.

## Was neu ist

SAML, gegen Keycloak getestet, nur mit signierten Antworten. LDAP und Active Directory, gegen OpenLDAP und einen Samba-Domänencontroller getestet, mit Rollen aus Gruppen. SCIM, gegen scim2-tester getestet, damit ein Anbieter Konten anlegt und abschaltet, ohne dass jemand einen Bildschirm anfasst. Eigene Rollen, aus den Projektberechtigungen gebaut. Externe Geheimnisse in OpenBao oder HashiCorp Vault, sodass das Passwort der Zugangsdaten im Speicher liegt und dort rotiert. Log-Streaming des Audit-Protokolls und beendeter Läufe an syslog (TCP, UDP oder TLS) und OTLP, gegen einen echten syslog-Server und Loki getestet. Variablen, Ordner, Insights, Annotationen an Läufen, Schwärzungsrichtlinien und S3- und Azure-Blob-Speicher, gegen Garage und Azurite getestet.

Der Editor hat für jedes davon einen Bildschirm: Variablen, Insights und unter Einstellungen Rollen, Schwärzung, Externe Geheimnisse, Log-Streaming sowie Anmeldung und SCIM. Jeder Person wird nur angeboten, was ihre Rolle erlaubt, und der Server lehnt den Rest weiterhin ab.

## Die EmberOps-Schritte sind weg

Wir haben den EmberOps-Konnektor entfernt. Die neun Schritte (`erpnext.trigger`, `getList`, `getDoc`, `create`, `update`, `delete`, `submit`, `cancel` und `call`), der Trigger "Wenn ein EmberOps-Dokument erstellt oder geändert wird", der EmberOps-Zugangsdatentyp sowie die Bildschirme und Dokumente, die sie anboten, gibt es in 1.0.0 nicht mehr. Wenn Sie EmberOps erreichen müssen, ruft der HTTP-Schritt seine REST-API mit Zugangsdaten auf, und das funktioniert heute.

Ein Workflow, den Sie mit einem dieser Schritte gespeichert haben, wird weder verworfen noch stillschweigend geändert. Er besteht die Validierung nicht und startet nicht, und die Meldung nennt den Schritt und sagt, dass EmberOps-Schritte in 1.0.0 entfernt wurden. Löschen Sie den Schritt oder ersetzen Sie ihn durch einen HTTP-Schritt, dann läuft er wieder. Zugangsdaten vom Typ EmberOps bleiben ungenutzt in Ihrer Liste, und Sie können sie löschen. Der Importer übernimmt keinen EmberOps-Knoten mehr, er kommt deaktiviert an, mit seinen Einstellungen in den Notizen, wie jeder Knoten, für den er keinen Schritt hat.

## Upgrade von 0.1.2

`helm upgrade` auf 1.0.0, oder lassen Sie `:stable` die Quadlet-Units weiterbewegen. Beim Hochziehen laufen acht Migrationen (0018 bis 0025). Sie legen Tabellen für Rollen, Variablen, Ordner, Annotationen, Schwärzungsrichtlinien, SCIM, Geheimnisanbieter und Log-Ziele an und fügen eine Spalte hinzu: den Ordner, in dem ein Workflow liegt. Sie berühren nichts von dem, was Sie haben, daher liegen Ihre Workflows, Zugangsdaten und Läufe, wo sie waren, und der Schlüssel öffnet sie weiterhin. SAML, LDAP, SCIM und die Blob-Speicher sind aus, bis Sie ihre `HOTLOOP_CASCADE_*`-Einstellungen setzen, die in `docs/IDENTITY.md` und `docs/GOVERNANCE.md` stehen. Für eine Instanz, die keine davon setzt, ändert sich nichts, außer ein Workflow von Ihnen nutzt einen EmberOps-Schritt (siehe oben).

## Was Sie wissen müssen

Migrationen gehen nur vorwärts. Ein Rollback bringt das alte Image zurück, macht aber die Migration Ihrer Datenbank nicht rückgängig. Machen Sie also vor dem Update ein Backup und behandeln Sie es als den Weg zurück. Nichts in diesen Migrationen ändert oder entfernt Vorhandenes, aber wir haben das alte Image nicht auf dem neuen Schema laufen lassen und versprechen es deshalb nicht.

Externe Geheimnisse brauchen erlaubte Pfade. Ein Anbieter ohne Pfade wird mit Absicht abgelehnt, weil das Token des Speichers meist weit mehr lesen kann, als jemand benennen können sollte, der Zugangsdaten bearbeitet.

SCIM zeigt einem Anbieter nie den Instanz-Eigentümer, und ein DELETE von einem Anbieter schaltet ein Konto ab und blendet es aus, statt es zu löschen, damit ein Anbieter nicht die letzte Person entfernen kann, die sich anmelden kann. Ein erneutes Anlegen bringt dasselbe Konto zurück.

Variablen sind keine Geheimnisse. Wer ein Projekt lesen kann, liest seine Variablen, und der Wert wird in den Laufdaten nicht geschwärzt. Passwörter gehören in Zugangsdaten oder in einen externen Speicher.

## Lizenz

Cascade steht unter der Business Source License 1.1 (`BUSL-1.1`) von HotLoop, wie der Rest der HotLoop-Familie. Es ist nicht Open Source, und ich tue auch nicht so. Jede Version wird vier Jahre nach ihrer ersten Veröffentlichung zu GPL-3.0 oder später. Die Nutzung zu Hause und im Labor ist kostenlos, ebenso die Produktionsnutzung durch Schulen, gemeinnützige Organisationen und Behörden. Die geschäftliche Nutzung läuft über EmberNet, wo die Anmeldung kostenlos ist und die geschäftliche Nutzung ebenfalls. Nicht gewährt werden das Hosten als Dienst für andere, der Weiterverkauf und das Einbetten in etwas, das Sie verkaufen. Die Datei `LICENSE` ist der Rechtstext und gewinnt jeden Streit mit diesem Absatz.
