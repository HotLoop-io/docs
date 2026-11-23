---
title: "Versionshinweise: HotLoop Flow 2.4.0"
description: "Was HotLoop Flow 2.4.0 bringt, was sich beim Update ändert und was Sie lesen sollten, bevor Sie eine laufende Anlage anfassen."
sidebar:
  label: "2.4.0"
---

HotLoop Flow 2.4.0 lässt das EmberCORE-Dashboard Personen bei Flow anmelden. Wer Flow aus dem Dashboard öffnet, ist mit der Rolle drin, die sein Tenant ihm gegeben hat, voller Zugriff oder nur lesend, ohne zweite Anmeldung. Es ist aus, solange der Schlüssel des Dashboards nicht konfiguriert ist, und nichts, was vorher funktionierte, ändert sich.

## Neu

**Anmeldung aus dem EmberCORE-Dashboard**
- Das Dashboard setzt ein von ihm signiertes Token in `X-Embernet-Assertion` auf jede Anfrage, die es an Flow weiterreicht, einschließlich des Websockets des Editors. Flow prüft es mit dem öffentlichen Schlüssel des Dashboards: die Signatur (ES256), den Aussteller (`embernet-dashboard`), dass es für dieses Flow in diesem Tenant erstellt wurde (die Audience ist `<tenant>/<release>`, ein Token für eine andere App öffnet hier also nichts) und sein Ablaufdatum, etwa eine Minute. Ein Token, das in einem davon falsch ist, wird abgelehnt, und nichts sonst an der Anfrage rettet es.
- Die Rolle kommt aus der Rollenzuordnung des Tenants im Dashboard. `*` ist jede Berechtigung. `read` sind die Flows, die Palette, die Einstellungen und der Status, und nichts, was sie ändert: kein Deploy, kein Inject, kein Deploy-Log. Operatoren und Betrachter bekommen standardmäßig `read`. Eine Rolle, die keines von beiden ist, oder keine, bedeutet keinen Zugriff. Wer sich so anmeldet, erscheint im Deploy-Log und im Audit-Trail als `dashboard:<email>`.
- Es gibt keine Sitzung. Das Dashboard sendet bei jeder Anfrage ein frisches Token, sodass eine dort geänderte Rolle bei der nächsten Anfrage greift und nichts zu widerrufen ist.
- Der Editor sagt „Öffnen Sie dies aus dem EmberCORE-Dashboard“, statt ein eigenes Anmeldeformular anzubieten, und lässt den Button „Abmelden“ weg, wenn das Dashboard Sie angemeldet hat. `GET /auth/mode` ist, wie er das fragt, bevor sich jemand angemeldet hat.
- Das Chart nimmt es unter `embernetSignin` auf. Der App Store reicht den öffentlichen Schlüssel des Dashboards weiter; das Chart bindet ihn ein, schreibt die Einstellungen, startet den Pod neu und annotiert den Service, damit das Dashboard weiß, dass es Personen anmelden soll.

## Was sich geändert hat

Nichts, solange Sie den Schlüssel nicht setzen. Ohne Schlüsseldatei liest Flow den Header gar nicht, und ein `helm template` der Standardwerte ist, was es war.

## Upgrade

Ein schlichtes `helm upgrade` auf das Image und Chart von 2.4.0. Beim ersten Start passiert nichts.

Zur manuellen Nutzung binden Sie den öffentlichen Schlüssel des Dashboards (eine PEM-Datei) ein und setzen `auth.assertion.publicKeyFile` und `auth.assertion.audience` oder `HOTLOOP_FLOW_ASSERTION_PUBLIC_KEY_FILE` und `HOTLOOP_FLOW_ASSERTION_AUDIENCE`. Flow weigert sich zu starten, wenn es einen Schlüssel nicht lesen kann oder keine Audience hat. Die weiteren Einstellungen sind `auth.assertion.issuer` (`embernet-dashboard`), `header` (`X-Embernet-Assertion`) und `hideLogin` (`true`).

Der Admin-Login und die API-Tokens funktionieren daneben weiter. Sie sind der Notzugang für Personal und Automatisierung, und dass das Formular des Editors wegfällt, berührt sie nicht.

Image: `ghcr.io/hotloop-io/hotloop-flow:2.4.0`, linux/amd64 und linux/arm64. Chart: `https://hotloop.io/hotloop-flow/`. Die README zu diesem Tag enthält den Rest: https://github.com/HotLoop-io/hotloop-flow/blob/v2.4.0/README.md
