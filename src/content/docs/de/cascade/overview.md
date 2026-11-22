---
title: "HotLoop Cascade: Workflows für die Anlage"
description: "Workflows, die die Anlage mit allem anderen verbinden. Mit Checkpoints ist ein Wiederholungsversuch eine Datenbankzeile. Eine statische Go-Binärdatei."
---

Cascade bringt die Anlage mit allem anderen ins Gespräch. Ein Alarm, ein Webhook, ein Zeitplan, eine neue Zeile oder ein MQTT-Schwall wird zu einem Stapel von Elementen, und die Elemente laufen durch Schritte, die echte Systeme mit echten Zugangsdaten aufrufen. Fällt eine API aus oder startet der Rechner mittendrin neu, wird der Auftrag trotzdem fertig, denn jeder Schritt hat einen Checkpoint, und ein Wiederholungsversuch ist eine Zeile in der Datenbank.

Es ist eine einzige statische Go-Binärdatei. SQLite auf einem Raspberry Pi oder Postgres mit so vielen Workern, wie Sie wollen, auf k3s. Postgres ist auch die Warteschlange, also gibt es kein Redis, das Sie in einem Anlagen-Cluster beaufsichtigen müssen.

## Was es nicht tut

**Es schreibt nicht auf Ihre Anlagen.** Cascade liest und abonniert. Alles, was ein Ventil bewegt oder einen Sollwert ändert, läuft durch das Write Gate von HotLoop, sodass das Audit des Gates jeden Schreibvorgang sieht, egal welcher Workflow ihn gestartet hat. Eine Workflow-Engine mit einer Hintertür zur SPS ist der Weg, auf dem ein Audit-Trail unehrlich wird.

**Es führt kein JavaScript in Ihren Feldern aus.** Feldausdrücke nutzen expr, dieselbe kleine Sprache wie die Automatisierungen von HotLoop. Sie können weder das Betriebssystem noch das Netzwerk noch das Dateisystem berühren und enden immer. JavaScript lebt an genau einer Stelle, dem Code-Schritt, und der läuft in einem eigenen, abgeschotteten Prozess ohne Geheimnisse, ohne Netzwerk und ohne Dateisystem. Es aus allen anderen Feldern herauszuhalten, hält dort auch die Remotecodeausführung heraus.

**Es sperrt nichts.** SSO, erzwungene MFA, RBAC, Audit, Versionsverlauf, API-Schlüssel mit begrenztem Umfang und HA-Worker stecken alle in der einen Binärdatei. Im gesamten Code gibt es keine Lizenzprüfung.

**Es telefoniert nicht nach Hause.** Kein Lizenzserver, keine Cloud-Abhängigkeit. Telemetrie ist Opt-in, standardmäßig aus und wird bis auf Feldebene dokumentiert, sobald sie kommt.

## Wie es weitergeht

[Cascade betreiben](/de/cascade/running/), mit [Podman Quadlet](/de/cascade/quadlet/) betreiben oder [die Cascade-Roadmap](/de/cascade/roadmap/) lesen. Im Einsatz in einer Anlage? [HotLoop im Unternehmen nutzen](/de/business/) behandelt Lizenzierung und wie Sie uns erreichen.
