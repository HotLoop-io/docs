---
title: "Versionshinweise: HotLoop Cascade 1.0.1"
description: "Was HotLoop Cascade 1.0.1 bringt, was sich beim Update ändert und was Sie lesen sollten, bevor Sie eine laufende Anlage anfassen."
sidebar:
  label: "1.0.1"
---

## Worum es geht

1.0.1 behebt einen Fehler darin, wie die Anmeldung mit einer nicht lesbaren Datenbank umgeht. Sonst hat sich gegenüber 1.0.0 nichts geändert.

## Der Fix

Wenn die Datenbank kurz aussetzte, las Cascade "ich konnte das nicht nachschlagen" als "das ist ungültig" und antwortete mit 401. Eine Sitzungsprüfung, ein API-Schlüssel, ein SCIM-Token und der Benutzer eines Schlüssels taten das alle, und die Sitzungsprüfung löschte außerdem das Cookie, sodass ein kurzer Ausfall alle abmeldete. Jetzt ist nur noch eine Sitzung, die nicht existiert oder einem deaktivierten Benutzer gehört, ein 401. Ein nicht lesbarer Speicher antwortet mit 503 und einem Retry-After, und das Cookie bleibt.

Der zweite Faktor hatte dasselbe Problem. Bei einem Ausfall wurde ein korrekter Authenticator-Code, Wiederherstellungscode oder Passkey als falscher Code beantwortet, was jemanden aus dem eigenen Konto aussperren kann. Diese Schritte antworten jetzt bei einem Speicher- oder Serverfehler mit 503 und behalten 401 nur für eine echte Ablehnung: ein falscher Code, ein fehlgeschlagener Passkey, eine abgelaufene Anfrage. Die Passkey-Anmeldung liest außerdem eine fehlgeschlagene Benutzersuche nicht mehr als "kein Konto hat diesen Passkey".

## Upgrade und zurück

Keine Migrationen. `helm upgrade` auf 1.0.1, oder lassen Sie `:stable` die Quadlet-Units weiterbewegen. Da sich in der Datenbank nichts ändert, ist es sicher, 1.0.0 zurückzuspielen. Ein Backup vor jedem Update bleibt eine gute Gewohnheit.
