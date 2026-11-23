---
title: "Versionshinweise: HotLoop Cascade 1.5.0"
description: "Was HotLoop Cascade 1.5.0 bringt, was sich beim Update ändert und was Sie lesen sollten, bevor Sie eine laufende Anlage anfassen."
sidebar:
  label: "1.5.0"
---

## Worum es geht

1.5.0 lässt einen Eigentümer eine Person löschen. Die Engine, das Dateiformat und alle anderen Bildschirme sind die von 1.4.2, und nichts wird migriert.

## Eine Person löschen

Bisher ließ sich ein Konto nur ausschalten, und es blieb für immer in der Liste. Jetzt hat Benutzer neben Ausschalten einen Löschen-Button, der Eigentümern für alle außer sie selbst angezeigt wird und vor jeder Aktion nachfragt. Derselbe Aufruf steckt in der REST-API, `DELETE /api/v1/users/{user}`, und im MCP-Server als `delete_user`, mit derselben Regel: nur ein Instanz-Eigentümer, nie das eigene Konto und nie der letzte Eigentümer.

Das Konto, seine Sitzungen, Passkeys, Anmeldeidentitäten und API-Schlüssel verschwinden sofort, sodass alles, was noch als diese Person angemeldet ist, bei der nächsten Anfrage nicht mehr funktioniert. Das Audit-Protokoll vermerkt, wer wen gelöscht hat, mit E-Mail, Rolle und der Zahl der entfernten Sitzungen und Schlüssel, und seine Kette lässt sich weiterhin verifizieren.

Ihre Arbeit bleibt. Ihr persönliches Projekt wird zu einem gemeinsamen Projekt, das nach ihnen benannt ist und "(removed)" dahinter trägt, und es enthält jeden Workflow, jede Zugangsdaten und jeden Lauf, die es hatte. Eigentümer und Admins können alles davon in ein anderes Projekt verschieben oder jemandem geben. Dieselbe E-Mail kann später für ein neues Konto verwendet werden, das mit einem eigenen Projekt beginnt.

Ausschalten bleibt unverändert und ist die richtige Wahl, wenn Sie das Konto behalten wollen. Eine Person, die Ihr Identitätsanbieter über SCIM entfernt, wird weiterhin ausgeschaltet und ausgeblendet, nicht gelöscht.

## Zurückgehen

Es gibt keine Migration, also läuft das vorherige Image auf denselben Daten. Ein gelöschtes Konto kommt nicht zurück; spielen Sie das Backup ein, das Sie vor dem Löschen gemacht haben, wenn Sie es brauchen.

## Nur amd64, und warum

Diese Version wird nur für amd64 gebaut. Multi-Arch kommt in einem eigenen Lauf, also ist die Version nach dieser ein kleiner Versionssprung, der beide baut. `stable`, `latest`, `1.5` und `1` führen das neue amd64-Image neben dem arm64-Image auf, auf das sie schon zeigten.
