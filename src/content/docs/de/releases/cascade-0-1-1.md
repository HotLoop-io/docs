---
title: "Versionshinweise: HotLoop Cascade 0.1.1"
description: "Was HotLoop Cascade 0.1.1 bringt, was sich beim Update ändert und was Sie lesen sollten, bevor Sie eine laufende Anlage anfassen."
sidebar:
  label: "0.1.1"
---

## Worum es geht

0.1.1 ist die erste Version, die kein Kandidat ist. Es gab ein Tag 0.1.0, das nie etwas veröffentlicht hat: Es wurde abgebrochen, bevor etwas die Registry erreichte. Ein Tag bleibt, wo es ist, also ist das derselbe Code, jetzt veröffentlicht.

Was es ist: die Workflow-Engine, die wir für eine Anlage haben wollten. Ein einziges statisches Go-Binary, SQLite auf einer Maschine oder Postgres mit Workern, wenn es mehr sein muss, und der Editor ist ins Binary eingebaut, sodass nichts weiter laufen muss.

## Was drin ist

Die Engine, in der jeder Schritt per Checkpoint gesichert wird, sodass ein `kill -9` mitten in einem Lauf dort weitermacht, wo er stand. Dauerhafte Wartezeiten, Wiederholungen, Fehlerports und Fehler-Workflows. Ausdrücke und ein Code-Schritt, der JavaScript isoliert in einem eigenen Prozess ausführt.

Webhooks mit dauerhaftem Posteingang, Zeitpläne, die jeden Slot genau einmal auslösen, egal wie viele Hauptknoten hinschauen, MQTT und ein Trigger für Dateien, die in einem Verzeichnis ankommen. Ein HTTP-Schritt für alles mit API und Konnektoren für HotLoop, Postgres, EmberOps, E-Mail, ntfy, Gotify und Discord. Keine weiteren, mit Absicht.

Ein Tresor für Zugangsdaten mit Schlüsselrotation, OAuth2 für jeden Grant, den eine Anlage braucht, Anmeldung mit Passwort, TOTP, Passkeys oder Ihrem OpenID-Connect-Anbieter, erzwungene MFA, Projekte und Rollen, ein überprüfbares Audit-Protokoll, jede Speicherung als Version aufbewahrt und eine API mit Scopes samt OpenAPI-Dokument. Metriken, Traces und Probes, damit außer mir noch jemand erkennt, wann etwas hängt.

## Betrieb

Das Image gibt es für amd64 und arm64. Ziehen Sie es über den oben genannten Digest, wenn Sie ein Deployment wollen, das sich nicht verschieben kann.

Auf k3s: das Helm-Chart, einzeln oder aufgeteilt in Server und Worker.

Auf einer normalen Maschine: die Quadlet-Units unter `deploy/quadlet`, SQLite auf einer Maschine oder Postgres mit zusätzlichen Workern. Sie folgen `:stable`, und Podmans Auto-Update-Timer bewegt sie. Ein Update, das nicht gesund startet, wird auf das Image zurückgesetzt, das lief. Wir haben das echt laufen lassen, beide Varianten, auf Podman 5.8.7 unter systemd: Der Start wartet auf gesund, ein beendeter Container kommt zurück, ein gutes Update landet, ein schlechtes wird zurückgerollt, und danach läuft jeweils ein Workflow.

## Was Sie wissen müssen

Migrationen gehen nur vorwärts. Ein Rollback bringt das alte Image zurück, macht aber die Migration Ihrer Datenbank nicht rückgängig. Machen Sie also ein Backup, bevor Sie Updates einschalten.

Die Registry war für diese Version privat, deshalb war zuerst ein `podman login ghcr.io` als root nötig. Image und Chart sind ab 0.1.2 öffentlich und lassen sich ohne Anmeldung ziehen.

Wenn Sie den Schlüssel verlieren, der gespeicherte Zugangsdaten versiegelt, sind alle gespeicherten Zugangsdaten unlesbar. Bewahren Sie eine Kopie an einem Ort auf, der nicht die Maschine ist.

## Lizenz

Cascade steht unter der Business Source License 1.1 (`BUSL-1.1`) von HotLoop, wie der Rest der HotLoop-Familie. Es ist nicht Open Source, und ich tue auch nicht so. Jede Version wird vier Jahre nach ihrer ersten Veröffentlichung zu GPL-3.0 oder später. Die Nutzung zu Hause und im Labor ist kostenlos, ebenso die Produktionsnutzung durch Schulen, gemeinnützige Organisationen und Behörden. Die geschäftliche Nutzung läuft über EmberNet, wo die Anmeldung kostenlos ist und die geschäftliche Nutzung ebenfalls. Nicht gewährt werden das Hosten als Dienst für andere, der Weiterverkauf und das Einbetten in etwas, das Sie verkaufen. Die Datei `LICENSE` ist der Rechtstext und gewinnt jeden Streit mit diesem Absatz.

## Was noch fehlt

SAML, LDAP, SCIM, Umgebungen, der HA-Scheduler mit Leases, mehr Konnektoren, KI-Schritte. Das kommt ab 0.2.0 und steht alles in der Roadmap.
