---
title: "Die Admin-API"
description: "Die HTTP- und Websocket-Aufrufe, die der Editor und die Kommandozeile nutzen, was jeder braucht und was er zurückgibt."
---

| Methode und Pfad | Berechtigung | Hinweise |
|---|---|---|
| `GET /health` | keine | Liveness. Der Kubelet trägt kein Token, und eine Authentifizierung auf dieser Route würde den Pod für immer im Kreis neu starten. |
| `GET /ready` | keine | Bereitschaft, getrennt gemeldet, damit eine Laufzeit, die nicht starten konnte, den Service verlässt, ohne dass der Kubelet den Pod beendet. |
| `POST /auth/token` | keine | Anmelden. Ein 429 mit `Retry-After` während einer Sperre. |
| `POST /auth/revoke` | keine | Abmelden. |
| `GET /auth/mode` | ohne Anmeldung | Ob diese Laufzeit aus dem EmberCORE-Dashboard geöffnet wird: `{"dashboard": bool, "hideLogin": bool}`. Der Editor fragt das, bevor sich jemand angemeldet hat. |
| `GET /auth/mfa`, `POST /auth/mfa/setup`, `/confirm`, `/disable` | ein angemeldeter Benutzer | Ihre eigene Zwei-Faktor-Anmeldung. Setup liefert den Schlüssel, den `otpauth://`-Link und den QR-Code. Confirm und disable nehmen `{"code": ...}`. |
| `POST /auth/mfa/reset` | `auth.admin` | Schaltet die Zwei-Faktor-Anmeldung eines anderen ab: `{"username": ...}`. |
| `GET /metrics` | keine | Prometheus. Nur Zähler und Knoten-IDs, nie Nachrichteninhalte oder Konfiguration. |
| `GET /settings` | `settings.read` | |
| `GET /nodes` | `nodes.read` | Die Registry, die die Palette des Editors und seine Dialoge speist. |
| `GET /plugins` | `nodes.read` | Die geladenen Plugins, was jedes anfordert und bekommen hat, und die abgelehnten mit dem Grund. |
| `GET /flows` | `flows.read` | |
| `GET /flows/export` | `flows.read` | Die Flow-Datei genau so, wie sie auf der Platte liegt, für Git. |
| `POST /flows` | `flows.write` | Deployen. Nimmt eine optionale Notiz für das Deployment-Protokoll. |
| `GET /deployments` | `flows.read` | Das Deployment-Protokoll, neueste zuerst, ohne die Nutzdaten. `?limit=N` begrenzt es. |
| `GET /audit` | `audit.read` | Wer was von wo getan hat, neueste zuerst. `?event=`, `?user=`, `?since=`, `?limit=`. |
| `GET /deployments/{seq}` | `flows.read` | Ein Eintrag mit seinen geparsten Flows. Nie seine Zugangsdaten. |
| `GET /deployments/{seq}/flows` | `flows.read` | Die Flow-Datei dieses Deployments, Byte für Byte. |
| `GET /deployments/{from}/diff/{to}` | `flows.read` | Knoten-für-Knoten-Differenz zwischen zwei Deployments, strukturiert und als Text. |
| `POST /flows/diff` | `flows.read` | Die Differenz zwischen dem Laufenden und dem Dokument im Body. Deployt nichts. |
| `POST /flows/types` | `flows.read` | Die Prüfung typisierter Verbindungen, die ein Deployment macht, auf das Dokument im Body: `{"wires": [...]}`, leer, wenn nichts falsch ist. Der Editor zeichnet die Antwort. Deployt nichts. |
| `POST /deployments/{seq}/rollback` | `flows.write` | Deployt die Flows und Zugangsdaten dieses Eintrags erneut als neues Deployment. Nimmt den Rev-Header und ein optionales `{"note": ...}`. |
| `GET /tests` | `flows.read` | Die neben der Flow-Datei gehaltene Flow-Testsuite, ihr Dateiname und ob Deployments davon abhängen. |
| `PUT /tests` | `flows.write` | Ersetzt die Suite. Der Body ist das YAML; eines, das sich nicht parsen lässt, ergibt ein 400 mit dem Grund. |
| `POST /tests/run` | `flows.read` | Führt die Suite oder `"tests"` aus dem Body gegen `"flows"` aus dem Body oder das Laufende aus. Gibt den Bericht zurück. Deployt nichts. |
| `POST /tests/from-debug` | `flows.read` | Entwirft einen Test aus `{"node", "msgId"}`, einer Nachricht, die ein Debug-Knoten gezeigt hat. Speichert nichts. |
| `POST /tests/cases` | `flows.write` | Hängt die Tests im Body, eine eigene Testdatei, ans Ende der Suite an. |
| `GET /traces` | `flows.read` | Die behaltenen Verfolgungen, neueste zuerst, mit dem Inhalt des Puffers und seinen Grenzen. `?limit=N`. 404 bei `trace.enabled: false`. |
| `GET /traces/find` | `flows.read` | Die Verfolgung, in der eine Nachricht war, aus `?msgId=` und `?node=`, der ID und dem Debug-Knoten, die die Seitenleiste zeigt. Gibt jede Station und den Weg zur gesuchten zurück. |
| `GET /traces/{id}` | `flows.read` | Eine Verfolgung, jede Station mit ihrem Zeitverhalten und der Nachricht, wie der Knoten sie bekam. |
| `POST /traces/{id}/test` | `flows.read` | Entwirft einen Flow-Test aus der Verfolgung. Speichert nichts. |
| `POST /traces/{id}/replay` | `flows.read` | Gibt die Nachricht, die die Verfolgung gestartet hat, in `"flows"` aus dem Body oder das Laufende in einem Kindprozess und liefert, wo sie landet im Vergleich zu dort, wo sie gelandet war. Deployt nichts. |
| `GET /runtime/stats` | `status.read` | |
| `POST /inject/{id}` | `inject.write` | Löst einen Inject-Knoten aus. |
| `GET /comms` | `status.read` | Der Status- und Debug-Websocket des Editors. Senden Sie das Token als Subprotokoll `hotloop-flow.bearer.<token>`, angeboten neben `hotloop-flow`. Das tut der Editor. `?access_token=<token>` in der URL funktioniert weiterhin für Skripte, die es schon nutzen, und protokolliert für jede Verbindung, die es tut, eine Warnung, weil eine URL in Proxy- und Zugriffsprotokollen landet. |
| `POST /mcp` (und `GET` und `DELETE`, für die älteren Protokollrevisionen) | `mcp.call` | Der [MCP-Endpunkt](/de/flow/mcp/), über den Flows als Werkzeuge bereitgestellt werden. Ein Sitzungs- oder API-Token wie jedes andere. Die Werkzeuge, die einem Aufrufer angeboten werden und die er aufrufen darf, sind die, die seine Berechtigungen erreichen. 403 bei abgeschalteter Authentifizierung. |

Dass `/metrics` und `/health` nicht authentifiziert sind, ist eine Entscheidung und kein Versehen. Ein Prometheus-Scraper trägt kein Bearer-Token, also bedeutet eines zu verlangen entweder, Ihrem Monitoring eine Zugangsberechtigung zu geben, oder kein Monitoring zu haben.

Ein Benutzer mit aktivierter Zwei-Faktor-Anmeldung sendet `"code"` zusammen mit Benutzername und Passwort an `POST /auth/token`. Ohne ihn lautet die Antwort 401 mit `"mfa": "required"`.

Berechtigungen sind `"*"` für alles, eine exakte Zeichenfolge wie `flows.read` oder eine Präfixfreigabe wie `flows.*`. Ein Agent, der Flows als MCP-Werkzeuge aufruft, braucht `mcp.call`. Ein Nur-Lese-Konto für ein Dashboard, das nur den Flow-Status anzeigen will, ist `["flows.read", "status.read"]` und nichts weiter.

Deployments nehmen einen optionalen Header `HotLoop-Flow-Deployment-Rev`. Senden Sie die Revision, die Sie zuletzt gelesen haben, und ein Deployment, das mit einem anderen Editor konkurriert, wird mit einem 409 abgelehnt, statt die Arbeit eines anderen stillschweigend zu überschreiben, ein Fehler, von dem man nur von dem erfährt, der seinen Nachmittag verloren hat.

Ein Deployment startet nur neu, was Sie geändert haben. Ein Knoten bleibt oben, wenn sich nichts bewegt hat, worauf er sich stützt: seine Einstellungen, sein Tab, seine Gruppe, seine Umgebung, seine Zugangsdaten und jeder Konfigurationsknoten, den er nennt. Ihn über die Zeichenfläche zu ziehen oder neu zu verdrahten zählt nicht, denn neue Verbindungen kommen an den laufenden Knoten. So wirft das Korrigieren eines Tippfehlers in einem Function-Knoten nicht mehr jede MQTT-Sitzung der Box ab, und ein Delay-Knoten, der zehn Minuten Messwerte hält, hält sie weiter. Das ist der ganze Grund, warum es das gibt: Wenn jedes Speichern die Anlage zurückwirft, hören Bediener während einer Schicht auf zu speichern, und die Korrektur wartet bis Samstag.

Wählen Sie mit einem Header `HotLoop-Flow-Deployment-Type`, wie viel neu startet. Node-REDs `Node-RED-Deployment-Type` funktioniert ebenfalls, sodass ein vorhandenes Deployment-Skript den Neustart bekommt, den es anfordert.

| Typ | Was neu startet |
|---|---|
| `nodes` (Standard) | Die Knoten, die Sie geändert haben, plus alles, was einen geänderten Konfigurationsknoten nennt. |
| `flows` | Jeder Knoten in jedem Flow, in dem sich etwas geändert hat. |
| `full` | Alles. Dasselbe wie den Prozess neu zu starten. |

Die Antwort sagt, was sie getan hat: `type`, `started`, `restarted`, `stopped` und `unchanged`. Nichts, was unterwegs ist, geht auf dem Weg verloren. Arbeit, die an einem zu ersetzenden Knoten schon in der Warteschlange steht, wird auf der alten Instanz fertig, alles, was während des Austauschs eintrifft, wartet auf die neue, und eine Nachricht an einen gelöschten Knoten wird gezählt und erscheint als Verwurf, statt zu verschwinden.
