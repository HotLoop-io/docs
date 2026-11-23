---
title: "Versionshinweise: HotLoop Cascade 1.2.0"
description: "Was HotLoop Cascade 1.2.0 bringt, was sich beim Update ändert und was Sie lesen sollten, bevor Sie eine laufende Anlage anfassen."
sidebar:
  label: "1.2.0"
---

## Worum es geht

1.2.0 vervollständigt die Tool-Liste des MCP-Servers. Die Engine, das Dateiformat der Workflows, die Bildschirme und die REST-API sind die von 1.1.1.

## Die vier Tools

Jeder MCP der HotLoop-Familie liest und schreibt, und bei dem von Cascade fehlten vier Routen, die ein Schlüssel aufrufen darf. Es sind jetzt Tools, insgesamt 83:

- `list_keys` und `revoke_key`: die Schlüssel der Person, der der Schlüssel gehört, und das Widerrufen eines davon. Ein Schlüssel kann sich selbst widerrufen, was der Inhaber eines geleakten Schlüssels als Erstes können sollte. Die eigenen Prüfungen der Route entscheiden, wessen Schlüssel ein Aufrufer widerrufen darf, genau wie im Editor.
- `listen_workflow`: öffnet die Test-Webhook-URL eines Workflows für einen Aufruf, für 1 bis 600 Sekunden.
- `start_oauth`: liefert die Adresse, die eine Person öffnet, um sich für Zugangsdaten vom Typ OAuth2 anzumelden. Die Person muss trotzdem zustimmen.

Jedes läuft über seine Route, sodass Berechtigungsprüfung, Validierung und Audit-Zeile die der Route sind, und ein Schreibvorgang verlangt einen Grund wie jedes andere Schreib-Tool.

## Was draußen bleibt

Zehn Routen weisen einen Schlüssel selbst ab, weil sie eine angemeldete Person wollen: einen API-Schlüssel oder einen Dienstkonto-Schlüssel anlegen, ein SCIM-Token anlegen, einen Geheimnisanbieter oder ein Log-Ziel hinzufügen, ändern oder löschen, und Ihr eigenes Passwort. Ein Schlüssel, der Schlüssel erzeugen oder ändern könnte, wohin das Audit-Protokoll geht, ist ein geleakter Schlüssel, der sich selbst am Leben hält. Die MCP-Seite hat die Liste und den Grund.

## Nur amd64, und warum

Diese Version wird nur für amd64 gebaut. Multi-Arch kommt in einem eigenen Lauf, also ist die Version nach dieser ein kleiner Versionssprung, der beide baut.

## Upgrade und zurück

Keine Migrationen. `helm upgrade` auf 1.2.0, oder lassen Sie `:stable` die Quadlet-Units weiterbewegen. 1.1.1 zurückzuspielen ist sicher, weil sich in der Datenbank nichts geändert hat. Was ein Rollback nicht rückgängig machen kann, ist das, was ein Agent bereits mit den neuen Tools getan hat.
