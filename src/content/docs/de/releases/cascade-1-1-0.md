---
title: "Versionshinweise: HotLoop Cascade 1.1.0"
description: "Was HotLoop Cascade 1.1.0 bringt, was sich beim Update ändert und was Sie lesen sollten, bevor Sie eine laufende Anlage anfassen."
sidebar:
  label: "1.1.0"
---

## Worum es geht

1.1.0 gibt Cascade einen MCP-Server und die Bildschirme, die dem Editor fehlten, und verlegt die Anmeldung in den Editor. Die Engine, das Dateiformat der Workflows und die REST-API sind die von 1.0.2.

## Der MCP-Server

Er liegt unter `/mcp`, auf derselben Adresse wie die API, wird eingeschaltet ausgeliefert und schreibt. Jeder MCP der HotLoop-Familie liest und schreibt, und Cascade war der letzte ganz ohne MCP.

Ein Agent meldet sich mit einem API-Schlüssel an und bekommt, was der Inhaber dieses Schlüssels tun könnte, eingeschränkt auf die Scopes des Schlüssels. Es gibt 79 Tools, und jedes ist eine Route der REST-API: Ein Aufruf geht durch den eigenen Handler der Route, sodass Berechtigungsprüfung, Validierung, Schreibvorgang und Audit-Zeile die der Route sind. Nichts wurde in den MCP-Server kopiert, also kann nichts auseinanderlaufen, und nichts wurde ausgelassen, also wird nichts übersprungen.

- Ein Tool, das etwas ändert, verlangt einen `reason`, und das Audit-Protokoll bewahrt ihn neben der Änderung auf, mit dem Schlüssel und dem Namen, den sich der Client gegeben hat.
- Das Geheimnis von Zugangsdaten kommt nie zurück, an niemanden. Über MCP angelegte Zugangsdaten haben ihre Geheimnisse versiegelt, sobald sie ankommen.
- `HOTLOOP_CASCADE_MCP` und `HOTLOOP_CASCADE_MCP_WRITES` sind die Schalter des Deployments, beide standardmäßig an. Kein Tool und keine API-Route kann sie ändern, sodass ein Agent, der die Einstellungen der Instanz bearbeiten kann, Schreibzugriffe trotzdem nicht wieder einschalten kann.
- Die Routen, die einen Schlüssel selbst abweisen (API-Schlüssel, SCIM-Tokens, Geheimnisanbieter und Log-Ziele anlegen), sind keine Tools, denn ein Schlüssel, der Schlüssel erzeugen könnte, ist ein geleakter Schlüssel, der sich selbst am Leben hält. Die MCP-Seite listet sie mit jedem Tool und der Berechtigung auf, die es verlangt.

## Die Bildschirme

Zugangsdaten, Projekte, Ihr Konto und für Eigentümer und Admins Einstellungen, Benutzer und das Audit-Protokoll. Jeder folgt denselben Berechtigungen wie die API: Jeder Person wird nur angeboten, was ihre Rolle erlaubt, und der Server lehnt den Rest weiterhin ab.

- **Zugangsdaten** werden angelegt, geöffnet, geändert, mit anderen Projekten geteilt und gelöscht. Ein Geheimnis wird einmal eingegeben, und der Bildschirm sagt nur, dass es gesetzt ist.
- **Projekte** hat Mitglieder und ihre Rollen sowie die Dienstkonto-Schlüssel, mit denen sich eine dauerhafte Integration anmeldet, einmalig angezeigt.
- **Konto** erstellt und widerruft Ihre API-Schlüssel, mit denen sich API und MCP anmelden, und ändert Ihr Passwort.
- **Benutzer** legt Personen an und schaltet sie aus oder an. Das **Audit-Protokoll** wird gelesen, gefiltert und auf Manipulation geprüft. **Einstellungen** hat die Pflicht zum zweiten Faktor und den Fehler-Workflow.

Die Anmeldung ist jetzt die eigene Seite des Editors unter `/login`, in den Farben des Editors, hell und dunkel, auf einem Telefon ebenso wie am Schreibtisch. Sie kann alles, was die alte Seite konnte: Ersteinrichtung, Passwörter, Verzeichniskonten, Single Sign-on, Passkeys, den zweiten Faktor und Wiederherstellungscodes.

## Nur amd64, und warum

Diese Version wird nur für amd64 gebaut. Multi-Arch kommt in einem eigenen Lauf, also ist die Version nach dieser ein kleiner Versionssprung, der beide baut. Bis dahin führen `stable`, `latest` und die kurzen Tags dieses amd64-Image neben dem arm64-Image auf, auf das sie schon zeigten, sodass eine arm-Maschine weiter ziehen kann. Das Versions-Tag `1.1.0` ist nur amd64.

## Upgrade und zurück

Keine Migrationen. `helm upgrade` auf 1.1.0, oder lassen Sie `:stable` die Quadlet-Units weiterbewegen. 1.0.2 zurückzuspielen ist sicher, weil sich in der Datenbank nichts geändert hat. Was ein Rollback nicht rückgängig machen kann, ist das, was ein Agent schon getan hat: Seine Änderungen bleiben gemacht, und die Audit-Zeilen, die er geschrieben hat, bleiben mit dem Akteurstyp `mcp` im Protokoll. Ein Backup vor jedem Update bleibt eine gute Gewohnheit.
