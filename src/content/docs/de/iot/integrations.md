---
title: "Integrationen"
description: "Richten Sie HotLoop auf ein Gerät mit bekannter Adresse, sehen Sie, was darauf ist, und behalten Sie die Punkte. SNMP, BACnet/IP, OPC UA, nur lesend."
---

Eine Integration ist der Weg, HotLoop auf eine Art Gerät zu richten, dessen Adresse Sie kennen, ein paar Fragen zu beantworten, zu sehen, was tatsächlich darauf ist, und die gewünschten Punkte zu behalten. Sie legt das Gerät und seine Tags an. Die Entitäten ergeben sich aus den Tags wie bei jedem Tag, sodass die neuen Punkte eine Minute später in der Entitäten-API, in Automatisierungen und auf Dashboards erscheinen.

Es gibt drei Wege, wie ein Gerät in HotLoop gelangt, und sie sind dafür gedacht, nebeneinander zu bestehen:

| <span class="sr-only">Details</span> | Wer es startet | Was es braucht |
|---|---|---|
| [MQTT-Erkennung](/de/iot/mqtt-discovery/) | Das Gerät, indem es sich an einem Broker ankündigt | Einen Publisher, der eines der Formate spricht |
| [Netzwerk-Erkennung](/de/iot/network-discovery/) | Das Netzwerk, indem es abgehört wird | Nichts vom Gerät; sie sagt Ihnen, was sie gehört hat und wie HotLoop mit ihm sprechen könnte |
| **Integrationen** (diese Seite) | Sie, mit einer Adresse | Ein Gerät, das sein eigenes Protokoll beantwortet |

Eine Integration schreibt nie auf das Gerät, und nichts, was sie anlegt, ist scharf. Ein gefundener Punkt ist ein Punkt, bei dem noch niemand entschieden hat, dass er angesteuert werden darf, daher ist jeder Tag, den eine Einrichtung anlegt, schreibgeschützt, bis jemand ihn scharfschaltet, einzeln, im Tag-Editor, genau wie bei einem Tag aus jeder anderen Quelle.

## Was es gibt

| Integration | Protokoll | Geprüft mit |
|---|---|---|
| OPC-UA-Server (`opcua`) | [OPC UA](/de/iot/protocols/#opc-ua) | Einem echten OPC-UA-Server |
| SNMP-Gerät (`snmp`) | [SNMP](/de/iot/protocols/#snmp) | Einem echten SNMP-Agenten, v1, v2c und v3 |
| BACnet/IP-Gerät (`bacnet`) | [BACnet/IP](/de/iot/protocols/#bacnetip) | Einem unabhängigen BACnet-Stack |
| CODESYS-SPS (`codesys`) | [CODESYS](/de/iot/protocols/#codesys) | CODESYS Control for Linux SL 4.22.0.0, mit zwei echten SPS-Programmen, eines davon sehr viel größer |

Weitere kommen auf diesem Gerüst hinzu, sobald sie sich gegen einen echten Server beweisen lassen.

## In die andere Richtung

Eine Integration holt ein Gerät herein. Um die Messwerte und Ereignisse von HotLoop an einen Kafka-Broker zu senden, siehe [den Kafka-API-Ereignisstrom](/de/iot/historian-targets/#kafka-api-ereignisstrom) unter den Historian-Zielen: Apache Kafka und Redpanda, TLS und SASL, die Messwerte auf einem Topic und das Systemlog auf einem anderen. Um sie als OPC UA PubSub (UADP über UDP) zu senden oder die eines Publishers zu lesen, siehe [OPC UA PubSub](/de/iot/protocols/#opc-ua-pubsub-uadp): Eines zu lesen heißt, ein Gerät mit dem Protokoll `opcua-pubsub` anzulegen, ohne Einrichtungsablauf, denn ein Datagramm trägt Feldpositionen und keine Namen.

## SNMP

Für einen Switch, eine USV, eine PDU, einen Energiezähler oder alles, was einen SNMP-Agenten ausführt. Die Fragen richten sich nach der Version: v2c fragt nach einer Community, v3 nach einem Benutzer und nur den Passphrasen, die seine Sicherheitsstufe braucht. Es gibt keine Standard-Community.

Die Sonde durchläuft die system-Gruppe, die Schnittstellentabellen, die Host-Ressourcen, die Lasttabelle und die extend-Ausgaben eines SNMP-Agenten, also die Objekte, die HotLoop benennen kann, und zeigt jedes mit dem, was der Agent als aktuellen Inhalt angab. Sie **schlägt** die vor, die jemand haben will, der auf ein neues Gerät zeigt: Name, Standort und Betriebszeit des Geräts (in Sekunden, nicht in den Hundertsteln des Agenten), Betriebszustand und Fehlerzahlen jeder Schnittstelle, ihre Byte-Zähler (die 64-Bit-Zähler, wo der Agent sie hat), die Lastmittelwerte und alle extend-Zeilen. In ihren Hinweisen steht, wie viele der vorgeschlagenen Punkte Zähler sind, denn ein Zähler in einem Diagramm braucht eine Rate.

Alles andere, was der Agent hat, ist weiterhin lesbar: Richten Sie es von Hand als Tag ein, dessen Adresse die OID ist. Siehe [den SNMP-Treiber](/de/iot/protocols/#snmp), was ein Tag wird, was ein fehlendes Objekt bewirkt und warum eine falsche v2c-Community wie ein totes Gerät aussieht.

SNMP ist hier immer schreibgeschützt. HotLoop sendet kein SET.

## BACnet/IP

Für einen Gebäudeautomations-Controller, einen Zähler, einen Thermostat: alles im IP-Netzwerk, das BACnet spricht. Die Fragen sind die Adresse des Geräts, die Geräteinstanz, falls Sie sie kennen (HotLoop weist dann ein anderes Gerät ab, das unter dieser Adresse antwortet), und von welcher Netzwerkkarte aus gesendet wird, wenn die Maschine zwei hat.

Die Sonde fragt das Gerät, wer es ist, liest seine Objektliste und liest jedes analoge, binäre und Multi-State-Objekt, das sie findet (und die Integer-, Large-Analog-, Accumulator- und Zeichenketten-Werte): Name, Beschreibung, Einheiten, aktueller Wert und Statusflags. Sie zeigt jedes mit dem, was sie gerade gelesen hat, und schlägt die ersten hundert vor. Einheiten kommen als Bezeichnung und, wo sie eine bedeuten, als Geräteklasse an, sodass ein Eingang `degrees-celsius` eine Temperatur in `°C` ist.

In ihren Hinweisen steht, wie viele Objekte einen Fehler melden (sie lesen schlecht, bis das Gerät ihn löscht) und wie viele außer Betrieb sind (sie lesen unsicher, weil der Wert der ist, der ihnen geschrieben wurde). Die Beschreibung eines Multi-State-Objekts listet seine Zustände auf, und sein Beispiel zeigt den Zustand zusätzlich zur Zahl.

BACnet ist hier immer schreibgeschützt. HotLoop schreibt keine Eigenschaft und erreicht kein Gerät hinter einem BACnet-Router: Siehe [den BACnet/IP-Treiber](/de/iot/protocols/#bacnetip), was abgedeckt ist und was nicht.

## CODESYS

Für eine SPS, die eine CODESYS-Control-Runtime ausführt. Die Fragen sind die von OPC UA (Adresse, Sicherheit, Benutzername und Passwort, wenn die Benutzerverwaltung der SPS aktiv ist) und, nur falls Sie sie brauchen, der aufzulistende Teil der Anwendung, die Namen von SPS und Anwendung und wie viele Elemente eines Arrays aufgelistet werden.

Die Sonde verbindet sich mit dem OPC-UA-Server der Runtime, findet die SPS und ihre Anwendung und listet die Variablen auf, die die Anwendung exportiert (ihre Symbol Configuration), unter den Namen, die der Programmierer geschrieben hat, mit ihren Typen und ob jede beschreibbar ist. Sie schlägt die eigenen Variablen der Anwendung vor, nicht die Elemente ihrer Puffer, und sagt in ihren Hinweisen, wie viele Arrays sie nur teilweise aufgelistet hat. Eine SPS, die nichts exportiert, bekommt gesagt, wie man etwas exportiert.

Ein CODESYS-Gerät wird einmal pro Sekunde gelesen, so oft, wie der Treiber den OPC-UA-Server der Runtime bittet, jede Variable zu beobachten, sodass ein Bildschirm der SPS höchstens etwa eine Sekunde hinterherhinkt. Der Standard der Runtime selbst sind fünf Sekunden, was für einen Bildschirm langsam ist: Eine Pumpe startet, und die Seite sagt es fünf Sekunden später. Ändern Sie das Abfrageintervall des Geräts oder sein `samplingIntervalMs`, um mehr zu verlangen; die Untergrenze, an die jedes Gerät gebunden ist, und die OperationLimits des Servers gelten weiterhin.

Richten Sie mit `"dashboard": true` in der Anfrage ein, und die Punkte, die Sie behalten, bekommen außerdem ein nach dem Gerät benanntes Dashboard: eine Überschrift, einen Trend der Zahlen, die sich bewegen, die Alarme des Geräts und eine Wertkarte für jeden Punkt unter einer Überschrift für seine Variablenliste. Es ist ein erster Bildschirm, gebaut aus dem Programm, wie es ist, und er wird wie jedes Dashboard bearbeitet. Nichts darauf steuert irgendetwas, und jeder Tag bleibt schreibgeschützt, bis er scharfgeschaltet wird.

Eine SPS, deren Runtime neu startet oder auf die ein neues Programm geladen wird, wird von selbst wieder aufgenommen: Siehe [den CODESYS-Treiber](/de/iot/protocols/#codesys).

## Der Ablauf

Drei Aufrufe, der Reihe nach, und die ersten beiden speichern nichts.

1. **Fragen.** `GET /api/integrations` listet jede Integration und ihre Fragen auf. Jede Frage hat eine Art (`text`, `number`, `bool`, `choice` oder `secret`), einen Standardwert, die Angabe, ob sie erforderlich ist, und, wenn sie erst nach einer anderen Antwort zählt, `showWhen`. Ein Bildschirm wird daraus und aus nichts sonst gezeichnet, weshalb eine neue Integration keinen neuen Bildschirm braucht.
2. **Ansehen.** `POST /api/integrations/{id}/probe` nimmt die Antworten, prüft sie, verbindet sich mit dem echten Gerät über den eigenen Treiber der Integration und meldet, was es ist und was es hat: einen vorgeschlagenen Namen, was es über sich selbst sagt, lesenswerte Hinweise und jeden gefundenen Punkt als Tag-förmigen Datensatz mit einem `sample` des Gelesenen, sodass Sie ihn mit der Zahl auf dem Display der Maschine selbst vergleichen können.
3. **Behalten.** `POST /api/integrations/{id}/setup` nimmt dieselben Antworten und die Namen der zu behaltenden Punkte (ohne Nennung behält es die als `suggested` markierten), legt das Gerät und seine Tags an und lädt die Runtime neu. Das Gerät ist aktiviert und wird abgefragt. Eine Integration, die ein erstes Dashboard anlegen kann (CODESYS), tut das, wenn die Anfrage `"dashboard": true` enthält, und antwortet mit der ID des Dashboards.

Die Einrichtung sieht sich das Gerät erneut an, statt der Sonde zu trauen. Was ein Client vor einer Minute gefunden zu haben glaubt, ist eine Behauptung, und die Punkte werden gegen das Gerät geprüft, wie es beim Anlegen ist. Ein Name, den es nicht gibt, ist ein `400`, kein übersprungener Punkt, weil jemand ihn ausdrücklich verlangt hat.

Eine Einrichtung, die auf halbem Weg scheitert (das Gerät gespeichert, die Tags nicht), entfernt das Gerät, das sie gerade angelegt hat. Ein bereits vorhandenes Gerät wird mit einem `400` abgelehnt, statt überschrieben zu werden: Um einem vorhandenen Gerät Punkte hinzuzufügen, nutzen Sie sein Browse und Import.

## Antworten werden geprüft, bevor etwas versucht wird

Das Gerüst prüft jede Antwort gegen ihre Frage, bevor eine Integration sie sieht, und meldet alle Probleme auf einmal, sodass ein Formular nur einmal korrigiert werden muss:

* eine erforderliche Frage, die leer ist, ergibt "X is required";
* eine Zahl muss eine ganze Zahl im Bereich der Frage sein, eine Auswahl muss eine ihrer Möglichkeiten sein, ein bool muss ein bool sein;
* eine Antwort auf eine Frage, die die Integration nicht stellt, wird abgelehnt, nicht ignoriert, denn ein falsch geschriebenes `pasword`, das wortlos verworfen wird, ist ein Gerät, das sich nicht anmelden kann, ohne dass es einen Hinweis gibt, warum;
* ein Geheimnis darf nicht der Platzhalter `[redacted]` sein, den die API anstelle eines gespeicherten zeigt. Ihn zurückzusenden würde den Platzhalter als Passwort speichern;
* eine Frage, die nicht angezeigt wird (`showWhen`), wird ignoriert und ist nicht erforderlich.

Zugangsdaten werden so gehalten wie die eines Geräts: im Ruhezustand versiegelt, wenn HotLoop einen Siegelschlüssel hat, und in jeder API-Antwort und jedem Fehler verborgen. Eine Sonde speichert nie, was ihr gegeben wurde.

## Wenn das Gerät nicht antwortet

`502`, mit dem, was schiefging: "could not reach the device: ..." wenn nichts verbunden wurde, "connected, but could not list its points: ..." wenn es verbunden war und dann nicht antwortete. Das ist die Antwort des Geräts, die es zu lesen gilt, kein Fehler in HotLoop und keine fehlerhafte Anfrage. Ein geschlossener Port, eine falsche Community oder eine Firewall enden alle hier, und die Meldung stammt vom Treiber selbst.

## Wo es im Produkt sitzt

Sonde und Einrichtung greifen von der HotLoop-Box aus über das Netzwerk, daher brauchen beide `devices.write`, genau wie das Speichern eines Geräts. Das Auflisten braucht `devices.read`. Jedes Produkt bringt sie mit. Die Routen stehen in [der HTTP-API](/de/iot/api/#integrations).

## Eine hinzufügen

* `Info()` sagt, was sie ist: ID, Name, das Protokoll des Treibers, wie nach der Adresse gefragt wird, und die Fragen;
* `Configure()` macht aus geprüften Antworten eine Adresse und den eigenen Konfigurationsblock des Treibers und weist zurück, was eine Frage nicht ausdrücken kann;
* `Discover()` erreicht das echte Gerät und meldet, was darauf ist.

Das Gerüst weist beim Start eine Integration ab, die kein Katalogeintrag sein kann: eine doppelte ID, ein Protokoll, das das Modell nicht deklariert, eine Frage ohne Bezeichnung, eine Auswahl ohne Möglichkeiten, einen Standardwert, der keine gültige Antwort ist, oder ein `showWhen`, das eine nicht vorhandene Frage benennt. Ein Test verpflichtet außerdem jede Integration auf ein Protokoll mit einkompiliertem Treiber.

Wo es keinen echten Server zum Ausführen gibt, gibt es keine Integration, und die [Roadmap](/de/roadmap/) sagt, welche auf Hardware warten.
