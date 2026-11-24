---
title: "Roadmap von Cascade"
description: "Was Cascade schon gebaut hat, was jedes Release gebracht hat und was weder gebaut noch geplant ist."
---

Nirgendwo im Code gibt es eine Lizenzprüfung. Jede Phase endet, wenn ihre „echte“ Liste gegen echte Systeme abgearbeitet ist, nicht wenn der Code kompiliert.

## 0.1.0, das MVP

Gebaut. Die Engine, dauerhafte Ausführungen, die Postgres-Warteschlange und Worker, Ausdrücke, der Code-Schritt in seinem Käfig, der Tresor für Zugangsdaten und OAuth2, Webhooks, Zeitpläne und MQTT, Benutzer mit erzwungener MFA, OIDC, Projekte und RBAC, Audit, Versionsverlauf, die API, der Editor, die Konnektoren der freigegebenen Liste, Workflow-Import, Metriken und Traces, das Helm-Chart und die Quadlet-Units. Veröffentlicht mit `RELEASE_CHECKLIST.md`, nicht früher.

## 0.2.0, Identität und Governance

Gebaut und mit dem neuen Editor in 1.0.0 ausgeliefert. SAML, LDAP und AD, SCIM, benutzerdefinierte Rollen, externe Geheimnisse, Log-Streaming, Variablen, Ordner, Insights, Ausführungsanmerkungen, die Blob-Backends für S3 und Azure und Schwärzungsrichtlinien für Ausführungen. Jedes wird gegen den echten Server erprobt, mit dem es spricht, und jedes hat seinen Bildschirm im Editor.

## Was 1.0.x gebracht hat

1.0.0 ist 0.1.0 plus 0.2.0 plus der neue Editor, alles in einem Release. Der Editor war das letzte Stück, das wir haben wollten, bevor wir unseren Namen unter die Nummer setzen.

1.0.1 behob einen Fehler bei der Anmeldung: Eine nicht lesbare Datenbank beantwortete die Anfrage mit „nicht angemeldet“ und löschte das Cookie, sodass ein kurzer Ausfall alle abmeldete und einen richtigen zweiten Faktor in einen falschen Code verwandeln konnte. Jetzt kommt „bitte erneut versuchen“, und die Sitzung bleibt erhalten. 1.0.2 ließ einen Code-Schritt mit einem als Zugangsdaten gespeicherten HMAC-Schlüssel signieren und prüfen und ließ einen Webhook die Web-Origins nennen, die ihn aus einem Browser aufrufen dürfen. Zwischen 1.0.0 und 1.0.2 gab es nichts zu migrieren.

Woran sich ein gespeicherter Workflow heute hält: Die Datei sagt, in welcher Version ihres Formats sie ist (`cascade: 1`), jeder Schritt trägt seine eigene Version, und ein Workflow, der einen nicht mehr vorhandenen Schritt nennt, besteht die Validierung nicht und startet nicht, statt stillschweigend geändert zu werden. So wurden die EmberOps-Schritte in 1.0.0 entfernt. Jedes Release wird vor der Auslieferung auf den Daten des vorigen gestartet: Der Workflow ist noch da und die Zugangsdaten öffnen sich noch.

## 1.3.0, der Editor in 14 Sprachen

Gebaut. Englisch, Spanisch, Französisch, Italienisch, Deutsch, Norwegisch Bokmål, Bulgarisch, Griechisch, Koreanisch, Japanisch, Vietnamesisch, Hindi, Vereinfachtes Chinesisch und Arabisch. Eine Sprachauswahl in der oberen Leiste und auf der Anmeldeseite; jeder Bildschirm, die Schritttitel und die Hilfe sowie die Ablehnungen des Servers sind übersetzt; Datumsangaben, Zahlen und Dauern richten sich nach der Sprache; Arabisch wird von rechts nach links geschrieben, mit Canvas und Code von links nach rechts. Jede Sprache wird auf jedem Bildschirm in Desktop- und Telefonbreite in einem echten Browser geprüft, und der Build weist eine Sprache ab, in der eine Zeile fehlt. Die Wörter stammen aus dem gemeinsamen HotLoop-Glossar.

## 1.5.0, eine Person löschen

Gebaut. Ein Eigentümer der Instanz kann eine Person über Benutzer, die REST-API (`DELETE /api/v1/users/{user}`) oder den MCP-Server (`delete_user`) löschen. Ihr Konto, ihre Sitzungen, Passkeys, Anmeldeidentitäten und API-Schlüssel verschwinden, und das Audit-Protokoll hält fest, wer es getan hat und was gegangen ist. Ihre Workflows, Zugangsdaten und Ausführungen bleiben: Das persönliche Projekt wird zu einem gemeinsamen Projekt, das nach ihr benannt ist und "(removed)" trägt, damit ein Eigentümer oder Administrator die Arbeit verschiebt oder weitergibt. Niemand kann sein eigenes Konto löschen, und der letzte Eigentümer kann nicht gelöscht werden. Jemanden abzuschalten gibt es weiterhin, für den Fall, dass Sie das Konto behalten wollen.

## 1.4.2, die Anmeldeseite

Gebaut. Die Anmeldeseite ist eine zentrierte Karte auf einer ruhigen Seite, mit dem Produktzeichen und -namen darüber, der Hauptschaltfläche in HotLoop-Orange und den anderen Wegen hinein (ein Passkey, Single Sign-on) als schlichte Schaltflächen daneben, in hell und dunkel und auf einem Telefon. Die Single-Sign-on-Schaltfläche trägt das Symbol ihres Anbieters, wenn der Anbieter Vord ist. Jedes Feld, jede ID und jeder Anmeldepfad ist, was er war.

## 1.4.1, die Seite Einstellungen

Gebaut. Die Seite Einstellungen setzt ein Feld nicht mehr zurück, wenn die Antwort auf ein Speichern erst eintrifft, nachdem die Person es geändert hat: Ein Feld, das noch enthält, was gesendet wurde, übernimmt den Wert des Servers, und ein seither bearbeitetes behält die Bearbeitung. Und die Review-Listen in den Sprachordnern sind weg.

## 1.4.0, Warten, Aufbewahrung, Limits und Sicherung

Gebaut. Ein Pod, der vor seiner Datenbank startet, was das Chart in der geteilten Form tut, wartet jetzt auf sie und sagt es, statt zwei- oder dreimal neu zu starten (die Installation zeigte im Chart-Test keine Neustarts). Und Aufbewahrung: eine Einstellung, wie viele Tage beendete Ausführungen behalten werden, standardmäßig aus, und ein stündlicher Durchlauf, der die älteren samt ihren Schrittdaten entfernt. Derselbe Durchlauf entfernt die Dateien im Blob-Speicher, auf die keine Ausführung mehr zeigt: Ausgaben, die für die Datenbank zu groß waren, und Anhänge, eine gemeinsam genutzte Datei erst, wenn die letzte Ausführung, die sie nutzt, weg ist. Und ein Ratenlimit für jeden API-Schlüssel, über die API und MCP, standardmäßig aus, beantwortet mit 429 und der Angabe, wie lange zu warten ist. (Ein Webhook hat sein eigenes Limit, und ein Konto sperrt sich nach wiederholt falschen Passwörtern, wie zuvor.) Und `hotloop-cascade backup` und `restore`: die SQLite-Datenbank, der Schlüssel und die Blob-Dateien mit einem Manifest aus Hashes, und für PostgreSQL der Schlüssel und die Blobs plus der `pg_dump`-Befehl für die Datenbankhälfte.

## 1.2.0, die letzten vier Werkzeuge des MCP-Servers

Gebaut. Dem MCP-Server fehlten vier Routen, die ein Schlüssel aufrufen darf: die eigenen Schlüssel auflisten und widerrufen, den Test-Webhook eines Workflows öffnen und eine OAuth2-Anmeldung starten. Es sind jetzt Werkzeuge, 83 insgesamt, jedes über seine Route, sodass dieselben Berechtigungsprüfungen gelten wie im Editor. Die zehn Routen, die eine angemeldete Person verlangen (Schlüssel, SCIM-Token, Geheimnisanbieter und Log-Ziele erstellen sowie das eigene Passwort), bleiben außen vor, denn ein Schlüssel, der sie erstellen könnte, könnte sich selbst am Leben halten; die MCP-Seite sagt, welche und warum.

## 1.1.0, MCP und die fehlenden Bildschirme

Gebaut, und das ist das Release. Der MCP-Server unter `/mcp`: 79 Werkzeuge, jedes eine Route der REST-API, sodass der Handler der Route selbst die Berechtigung prüft, den Body validiert, die Änderung vornimmt und die Audit-Zeile schreibt. Er wird eingeschaltet ausgeliefert, mit Lesen und Schreiben, wie jeder MCP der HotLoop-Familie, und die beiden Schalter dafür gehören dem Deployment (`HOTLOOP_CASCADE_MCP`, `HOTLOOP_CASCADE_MCP_WRITES`), die kein Werkzeug und keine Route ändern kann. Die MCP-Seite listet jedes Werkzeug und was es verlangt.

Und die Bildschirme, die dem Editor fehlten: Zugangsdaten, Projekte (Mitglieder und Dienstkonten), Benutzer, das Audit-Log, Einstellungen und eine Kontoseite mit API-Schlüsseln, jeder mit denselben Berechtigungen wie die API und in einem echten Browser mit jeder Rolle erprobt. Die Anmeldeseite gehört jetzt zum Editor, in seinen Farben und seiner Schrift, und nicht mehr die alte Go-Seite.

## 1.6.0, Freigaben, KI, Git und Konnektoren

Fertig. Vier Dinge, die auf dieser Seite als nicht gebaut standen, kommen in einem Release: Formulare mit menschlichen Freigabeschritten, KI-Schritte, Git-Versionsverwaltung mit Umgebungen und geschützten Instanzen sowie die deklarative Konnektor-Spezifikation mit den Werkzeugen drumherum. Jedes hat unten seinen eigenen Abschnitt.

## Formulare mit menschlichen Freigabeschritten

Fertig. Der Schritt Freigabe anfordern hält einen Lauf an und fragt eine Person. Sie öffnet den Freigabelink des Laufs auf dem Handy, liest, was Sie geschrieben haben, füllt ein Formular aus, falls es eines gibt, und tippt auf Freigeben oder Ablehnen; der Lauf geht über Freigegeben oder Abgelehnt weiter, mit Angabe, wer geantwortet hat, wann und was, und Cascade bewahrt die Antwort als Eintrag auf, den Sie im Editor, in der API (`GET /api/v1/approvals`) und im MCP-Server (`list_approvals`) lesen können, mit je einer Audit-Zeile. Die Seite ist schlichtes HTML ohne Skript, in den vierzehn Sprachen des Editors. Sie nennt die freigebende Person mit dem Namen, den sie eintippt, oder mit ihrem angemeldeten Konto.

## Git-Versionsverwaltung, Umgebungen und geschützte Instanzen

Fertig. Die Workflows eines Projekts liegen in einem Git-Repository, je eine Datei, benannt nach dem Workflow und mit seiner ID. Push schreibt sie und committet als die Person, die gepusht hat; Pull gleicht das Projekt mit dem Repository ab, behält die IDs, lässt neue Workflows ausgeschaltet, macht aus geänderten neue Versionen und lässt eine auf beiden Seiten gemachte Änderung unangetastet, solange Sie nicht sagen, wer gewinnt. Es ist ein Bildschirm am Projekt, sechs API-Routen und sechs MCP-Werkzeuge. Eine Instanz kann einen Namen bekommen, der oben auf jedem Bildschirm steht, und eine geschützte Instanz lässt es nicht zu, dass ihre Workflows im Editor, in der API oder über MCP von Hand angelegt, bearbeitet, wiederhergestellt oder gelöscht werden: Sie kommen per Pull aus Git, und Zugangsdaten, Variablen, Läufe und das Ein- und Ausschalten eines Workflows bleiben offen.

## Skalierung

Aus dieser Phase gebaut: die Webhook-Rolle (ein eigenes Deployment in der geteilten Form des Charts), ein Parallelitätslimit pro Workflow und viele Mains gegen eine Datenbank. Was wir nicht gemacht haben, ist der Test, den wir für diese Phase gesetzt haben: einen Main während eines minutengenauen Zeitplans beenden und über eine Stunde keine doppelte und keine verpasste Ausführung finden.

## Konnektoren

Die gebauten Konnektoren der freigegebenen Liste sind drin: HTTP, ntfy, Discord, Gotify, E-Mail, HotLoop, MQTT, Datenbanken, Dateien und die Blob-Speicher für S3 und Azure. Der EmberOps-Konnektor war in 0.1.x und ist in 1.0.0 entfallen.

Und ein Konnektor kann jetzt eine Datei sein: Die deklarative Konnektor-Spezifikation ist veröffentlicht (ein versioniertes Format mit einem JSON Schema), und jede API, die eine Datei beschreibt, wird zu Schritten ohne Code. Die Werkzeuge zum Schreiben, Ausprobieren, Veröffentlichen und Installieren stecken im Binary (`connector init`, `validate`, `call`, `index` und `install`), und ein Index ist eine statische Datei, die jeder hosten kann, mit einem Hash für jede Datei.

## KI-Schritte

Fertig. Ein Modell fragen und Einen Agenten ausführen. Das Modell ist Ihr eigenes, ein lokaler Server wie Ollama oder ein gehosteter Dienst mit Ihrem Schlüssel, benannt durch Zugangsdaten, und sowohl das OpenAI- als auch das Anthropic-Protokoll werden gesprochen. Ein Agent nutzt andere Workflows als Werkzeuge und wartet zwischen den Runden in der Datenbank.

Nicht gebaut, nicht geplant: ein Assistent, der Workflows mit Ihrem Modell schreibt. Es gibt keinen gehosteten Dienst und es wird keinen geben. (Der MCP-Server, mit dem ein Agent Cascade von außen bedienen kann, ist gebaut: siehe 1.1.0.)

## Die neue Editor-Oberfläche

Gebaut, und in 1.0.0. Der Editor ist in Astro mit Svelte-Islands neu geschrieben, zu statischen Assets gebaut und wie der alte in die Go-Binärdatei eingebettet, also dieselbe Geschichte mit einer einzigen Binärdatei und nichts Neuem, das laufen muss. Farben, Schrift und Logo kommen aus den HotLoop-Markendateien, und er folgt dem hellen oder dunklen Modus des Systems. Jeder Bildschirm des alten Editors ist darin und tut, was er tat (der Canvas-Code kam unverändert herüber), die Funktionen aus 0.2.0 haben ihre Bildschirme, und ein Browsertest steuert jeden davon gegen den echten Server in einem echten Chrome. Nichts davon hat die API, das Dateiformat oder die Go-Seite geändert.
