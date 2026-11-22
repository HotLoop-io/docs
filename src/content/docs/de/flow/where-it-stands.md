---
title: "Wo Flow steht"
description: "Gegen welche echte Ausrüstung Flow geprüft wurde, und woher es kam, bevor es HotLoop Flow hieß."
---

**Es läuft.** Es startet, liefert die API und den Editor aus, lädt Flows vom Volume, bewegt Nachrichten und kommt nach einem Neustart mit seinen Flows, Zugangsdaten und seinem Kontext zurück. Das Chart stellt es in allen drei Netzwerkmodi bereit, und die gesamte Veröffentlichungskette löst sich auf. Es läuft in einer echten Fertigung.

**Gegen echte Infrastruktur geprüft**: Mosquitto, InfluxDB und PostgreSQL. Der InfluxDB-Tag-Wert kam aus einer echten Datenbank als `press 01,west` zurück, mit Leerzeichen und Komma unversehrt. Das ist der Escape-Fehler, der sonst eine Serie unbemerkt zerstückelt und jemanden einen Tag kostet, bis er gefunden ist.

**Cookies und Multipart antworten so, wie es die eigenen Bibliotheken von Node-RED tun**, weil sie dagegen geprüft wurden, in über hundert Fällen, und die Antworten in eine Golden-Datei geflossen sind, die die Tests über echte Sockets abspielen. Das schließt die hässlichen Fälle ein: Ein UTF-8-Dateiname kommt genau so verstümmelt heraus, wie der Node-RED-Stack ihn verstümmelt, und ein Cookie namens `value` verliert seinen Wert in `msg.responseCookies`, genau wie dort. Die Fehler nachzubilden ist der Punkt. Ein Flow, der sich auf einen davon verlässt, bricht an dem Tag, an dem er verschwindet.

**Auf echter Hardware gelaufen (2026-11-17):** die Knoten S7 und EtherNet/IP, dauerhafte Verbindungen (Store and Forward und die Plattenschreibvorgänge) und Plugins, mit ihren Fallen und Ablehnungen und einem signierten Plugin in einem echten Cluster. Die Zahlen für Plattenschreibvorgänge und pro Aufruf bleiben mit dem Ort beschriftet, an dem sie gemessen wurden.

Was als Nächstes gebaut wird und in welcher Reihenfolge, steht in [der Roadmap](/de/flow/roadmap/).

## Bevor es HotLoop Flow hieß

Es hieß Emberwire, und `v0.1.0` liegt noch dort, wo es war, unter `ghcr.io/embernet-ai/emberwire:0.1.0`. `2.0.0` war das erste Release unter diesem Namen, und 2.x liest nichts, was der alte Name geschrieben hat: Die Variablen `EMBERWIRE_*`, die beiden Datenbank-Knotentypen `emberwire-`, ein gegen die alten Exporte gebautes WASM-Modul und die Zugangsdaten-Datei von 0.1.0 müssen alle neu gemacht werden. Das ist ein bewusster sauberer Schnitt. Niemand hatte auf 0.1.0 aufgebaut, und eine Übergangsschicht für null Nutzer ist nur mehr Code, der falsch sein kann. Seit 2.0.1 bekommt eine alte Zugangsdaten-Datei eine klare Meldung, die die Datei nennt, sagt, dass Emberwire sie geschrieben hat, und Sie bittet, sie beiseitezulegen und die Zugangsdaten neu einzugeben.