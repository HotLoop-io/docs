---
title: "Versionshinweise: HotLoop core 4.19.4"
description: "Was HotLoop core 4.19.4 bringt, was sich beim Update ändert und was Sie lesen sollten, bevor Sie eine laufende Anlage anfassen."
sidebar:
  label: "4.19.4"
---

4.19.0, 4.19.1, 4.19.2 und 4.19.3 wurden getaggt und nie veröffentlicht, daher existiert nichts, was einen dieser Namen trägt, und `stable` wurde nie auf eine davon gesetzt. Dies ist die erste Version mit allem, was ihre Hinweise auflisten, und dazu gehört eine Neuerung seit 4.19.1: Die Charts kennen `hostNetwork`.

- 4.19.1 brachte die Korrektur dafür und eine weitere (ein Discovery-Listener, der meldete, er sei bereit, bevor er hören konnte, siehe unten) und wurde übersprungen, bevor sie erschien.
- 4.19.2 brachte `hostNetwork`.
- Beides ist unten behoben.
- Alles aus den Hinweisen zur 4.19.0 (MCP, skalierte Schreibzugriffe, die Store-Anmeldung, CODESYS, der Kafka-Ereignisstrom, OPC UA PubSub über UADP und die Korrekturen) steht in den folgenden Hinweisen.

Neu seit 4.19.1: Die Charts haben eine Einstellung `hostNetwork`.

## hostNetwork

Jedes HotLoop-Chart mit einem Pod (die Charts für Gateway, IoT und Edge sowie das des Edge Relay) kennt `hostNetwork: true`. Es ist standardmäßig aus, und ausgeschaltet rendert das Chart genau das, was das der 4.19.1 renderte.

- **Wofür es da ist.** Für einen Pod, der hören muss, was sein Node hört: UDP-Multicast auf dem Loopback des Nodes (eine SPS-Runtime auf derselben Box, die OPC UA PubSub an eine Multicast-Gruppe über Loopback veröffentlicht) oder eine zweite Netzwerkkarte. Ein Pod-Netzwerk trägt keines von beiden.
- **Was es tut.** Das Deployment bekommt `hostNetwork: true` und `dnsPolicy: ClusterFirstWithHostNet`, sodass die DNS-Namen des Clusters weiter aufgelöst werden.
- **Was es für den Pod bedeutet.** Er nutzt die Adressen und Ports des Nodes: Die Seite antwortet auf jeder Adresse des Nodes an `service.targetPort`. Wählen Sie also einen Port, den nichts auf dem Node benutzt, und lassen Sie die Authentifizierung an. Eine NetworkPolicy gilt für einen Host-Network-Pod nicht (das Netzwerk-Plugin des Clusters ignoriert sie). Pinnen Sie den Pod mit `nodeSelector` an seinen Node.
- **Ein Listener auf dem Loopback.** Der OPC-UA-PubSub-Subscriber tritt einer Gruppe auf einer benannten Karte per Name oder Adresse bei: `"interface": "127.0.0.1"` in den Optionen des Geräts tritt auf der Loopback-Karte bei.
- **Sonst nichts.** Der Code ist der, den die 4.19.1 ausgeliefert hätte. Der Release-Guard rendert jetzt jedes Chart mit und ohne die Einstellung und schlägt fehl, wenn eines der beiden Renderings falsch ist.

---

Der Rest dieser Version, aus 4.19.0 und 4.19.1:

Zwei Dinge in der 4.19.4 ändern, was eine bestehende Anlage tut, lesen Sie sie also, bevor Sie eine laufende anfassen. Agenten über MCP können jetzt schreiben, und der MCP-Endpunkt hat immer einen Token. Und ein Wert, den Sie in ein skaliertes Tag schreiben, landet endlich so im Register, wie Sie es meinten, was bedeutet, dass jeder, der das alte Verhalten umgangen hat, damit aufhören muss. Alles danach ist neu oder eine Korrektur.

Die vollständigen Hinweise stehen im README: Was sich in 4.19.4 geändert hat.

### MCP ist an, es schreibt, und es hat immer einen Token

- **Agenten können jetzt schreiben, wo ein Operator es konnte.** MCP ist in jedem HotLoop-Produkt an und liest und schreibt. `allowMcpWrites` steht im Code und in allen drei Charts standardmäßig auf true. Ein Deployment, das `allowWrites` an hat und nie `allowMcpWrites` gesetzt hat, bekommt nach diesem Update Agenten-Schreibzugriffe, durch dasselbe Tor wie der Bildschirm: Die Rechte des Benutzers, die Beschreibbar-Markierung des Tags und sein Bereich gelten weiterhin.
- **`allowWrites` hat sich nicht geändert.** Es bleibt standardmäßig aus und entscheidet weiterhin, ob irgendetwas schreiben kann, Oberfläche und Agenten gleichermaßen. Ist es aus, schreibt nichts, MCP eingeschlossen.
- **Ein Deployment, das `allowMcpWrites: false` gespeichert hat, bleibt aus.** Das schließt eines ein, das aus dem App Store installiert wurde, der jede Antwort speichert. Schalten Sie es um, wenn Agenten schreiben sollen.
- **Der Endpunkt ist nie offen.** Die Charts setzen immer einen MCP-Token. Ein HotLoop, das ohne `HOTLOOP_MCP_TOKEN` gestartet wurde (eine Quadlet-Unit, ein nacktes Binary), lieferte `/mcp` an jeden aus, der den Port erreichen konnte, und schrieb nur eine Warnung ins Log. Jetzt erzeugt es beim ersten Start einen Token von 24 Byte und behält ihn in seiner Datenbank, sodass jedes Replikat und jede Wiederherstellung denselben trägt. Ein Aufruf ohne den Token ist ein `401`. Ein von Ihnen konfigurierter Token wird nie ersetzt.
- **So kommen Sie bei einer nackten oder Quadlet-Installation an den Token:** `hotloop mcp-token` gibt ihn aus. Wenn Sie einen Agenten auf `/mcp` einer solchen Installation ohne Token gerichtet haben, funktioniert er ab diesem Update nicht mehr, bis Sie ihm diesen Token geben. Das ist Absicht.
- **Wer den Aufruf gemacht hat.** Ein statischer Token sagt, welcher Client aufgerufen hat, nie welche Person. Mit eingeschalteten OIDC-Einstellungen sorgt eine Vord-Anmeldung oder eine Hub-Assertion an `/mcp` dafür, dass das Audit die Person nennt (`mcp:pat@example.com`), und eine optionale Schreibrolle schränkt Schreibzugriffe pro Aufrufer zusätzlich zu den obigen Schaltern ein. Sie ist aus, solange Sie sie nicht setzen, und der Token funktioniert daneben weiter. [Die MCP-Seite](/de/iot/mcp/) beschreibt die Einrichtung.

### Schreibzugriffe auf ein skaliertes Tag

- **Was falsch war.** Ein Tag mit einer Skalierung, sagen wir 0.1 auf einem Temperaturregister, das Zehntelgrad hält, zeigt Ihnen den technischen Wert: Das Register sagt 555 und der Bildschirm 55.5. Das Schreiben ging ohne dieselbe Sorgfalt in die andere Richtung. Sie tippten 55.5 als Sollwert, und HotLoop legte 55 ins Register, das dann als 5.5 zurückgelesen wurde. Es war auf jedem Bildschirm gleich, über die API, aus einer Automatisierung, einem Skript, einem Rezept, einem Regelkreis und über MCP, weil alle durch dasselbe Schreibtor gehen. Die Audit-Zeile sagte die ganze Zeit 55.5, also sah im Log nichts falsch aus.
- **Was sich ändert.** Die Zahl, die Sie schreiben, steht in den eigenen Einheiten des Tags, genau wie die, die Sie lesen. HotLoop nimmt Skalierung und Offset vor dem Senden wieder heraus: 55.5 auf einem Tag mit Skalierung 0.1 legt 555 ins Register und wird als 55.5 zurückgelesen. Ein Tag ohne Skalierung und ohne Offset wird gar nicht angefasst. Bits, Coils, Strings und Sparkplug- und MQTT-Schreibzugriffe eines Flags werden ebenfalls nicht skaliert.
- **Wenn Sie es umgangen haben, hören Sie damit auf.** Wenn jemand rohe Zählwerte in ein skaliertes Tag getippt hat, um die richtige Zahl zu bekommen, also 555 getippt hat, um 55.5 zu erhalten, sendet das jetzt 5550 und wird als 555 zurückgelesen. Tippen Sie den technischen Wert. Sehen Sie sich Ihre skalierten Tags vor dem Update an: Jedes Tag mit einer Skalierung ungleich 1 oder mit Offset, in das jemand von Hand, aus einer Automatisierung oder aus einem Rezept schreibt, ist einen Blick wert. Rezepte und Automatisierungen, die Zählwerte geschrieben haben, brauchen ihre Zahlen als technische Werte im selben Schritt wie das Update.
- **Ein Wert, den das Register nicht halten kann, wird abgelehnt.** Nach dem Entfernen der Skalierung wird ein Zählwert, der nicht ins Register passt, 7000 bei einem `uint16` mit Skalierung 0.1, mit einer klaren Meldung abgelehnt, die Zählwert und Register nennt, und nichts wird gesendet. Früher lief er still über: 70000 in einem 16-Bit-Register ging als 4464 hinaus. Das gilt für die Ganzzahltypen von Modbus, S7, EtherNet/IP und OPC UA.
- **Ein Rezept mit einem Wert, der nicht passt, wird ganz abgelehnt.** Vor seinem ersten Schreibzugriff wird jedes Ziel geprüft, ein Rezept wird also nie halb angewendet und dann abgelehnt. Bei Modbus, S7 und EtherNet/IP kennt die Prüfung den Registertyp jedes Tags aus seiner Adresse. Bei OPC UA, dem Weg zu einer CODESYS-Runtime, nutzt sie den Typ, mit dem die letzte Messung des Tags ankam. Ein Tag, das seit dem Start von HotLoop nie gelesen wurde, hat noch keinen Typ zum Prüfen, daher wird ein Rezept, das es anvisiert, erst beim Schreibzugriff auf dieses Tag abgelehnt, nachdem die Ziele davor geschrieben wurden, und die Anwendung protokolliert, welche. Es einmal zu lesen, was die Abfrage innerhalb einer Sekunde nach dem Verbinden tut, behebt das.
- **Ein Bruchteil eines Zählwerts wird abgeschnitten.** Ein Register hält ganze Zählwerte, also hält 12.34 auf einem Register mit Zehntel-Skalierung 12.3, wie es immer war.
- **Was sich nicht geändert hat.** Die Bereichsprüfung eines Tags und die Audit-Zeile verwenden die Zahl, die Sie getippt haben. Das Schreibtor, die Berechtigungen und die Ablehnungsregeln sind dieselben.

### Eine Store-Installation meldet Sie als Sie selbst an

Das Chart erzeugte ein zufälliges Admin-Passwort in einem Secret, das der Tenant nicht lesen kann, sodass eine Store-Installation auf einer Anmeldung ohne Ausweg landete. Ist der öffentliche Schlüssel des Dashboards konfiguriert, meldet eine Anfrage mit einer gültigen signierten Assertion für diesen Tenant und diesen Service diese Person an, legt beim ersten Mal ihren Benutzer an, hält ihre Rolle im Gleichschritt mit dem, was das Dashboard gesendet hat, und die Audit-Spur nennt sie. Eine schlechte, abgelaufene Assertion oder eine für den falschen Tenant oder die falsche App wird abgelehnt, und die lokale Anmeldung bleibt unberührt. Es ist aus, solange kein Schlüssel gesetzt ist, und die drei Produkt-Charts nehmen den Schlüssel aus dem Store. [Authentifizierung und Benutzer](/de/iot/authentication/) hat die Einstellungen.

### CODESYS, mit den Namen, die der Programmierer den Variablen gegeben hat

HotLoop liest und schreibt eine CODESYS-SPS über den eigenen OPC-UA-Server der Runtime, so wie CODESYS es dokumentiert: die Symbol Configuration der Anwendung, veröffentlicht unter dem PLCopen-IEC-61131-3-Modell. Die Discovery listet auf, was die Anwendung exportiert, mit den Typen und dem Zugriff, den der Programmierer ihnen gegeben hat, und geht in Arrays und Strukturen hinein, und ein Tag ist ein IEC-Symbol, das man unter dem findet, wie das Projekt seine SPS und seine Anwendung nennt. Ein Neustart, ein Download oder eine verlorene Verbindung liest sich als schlecht mit dem Grund und kommt ohne Zutun zurück. Wir haben es im Test gegen eine echte Runtime 4.22.0.0 bewiesen, auf der unser eigenes Programm lief, mit einem Schreibzugriff, den die Logik der SPS selbst beantwortet, und gegen ein zweites Programm mit über hunderttausend Variablen, gelesen in 2.4 Sekunden.

Das berührt einen Treiber, den Anlagen betreiben, also klar gesagt: Der OPC-UA-Treiber fragte 200 Nodes pro Anfrage ab und las nie, was der Server erlaubt. Eine CODESYS-Runtime veröffentlicht OperationLimits von 100 und lehnt mehr ab, und der Treiber antwortete darauf, indem er jedes entdeckte Tag zum float erklärte und kein Tag eines Geräts mit mehr als hundert las. Anfragen werden jetzt an die Grenzen geschnitten, die der Server beim Verbinden veröffentlicht, und halbiert, wenn ein Server, der keine veröffentlicht, sagt, es seien zu viele. Ein Datentyp, der ein Untertyp eines Standardtyps ist (ein CODESYS-STRING, -BYTE oder -TIME), wird bis zum Standardtyp verfolgt, also als dieser typisiert und geschrieben. Jedes OPC-UA-Gerät bekommt das, nicht nur CODESYS-Geräte.

### Ein Kafka-Ereignisstrom

- **Was es ist.** HotLoop kann seine Messwerte und sein Systemlog an jeden Broker senden, der die Kafka-API spricht: Apache Kafka, Redpanda und den Rest dieser Familie. Es ist eine neue Art Historian-Ziel unter Settings, Historian targets, hat also die Warteschlange, das Nachholen aus HotLoops eigenem Verlauf und den Status, den diese haben. Messwerte gehen in ein Topic und das Systemlog (Alarme, Geräte, die aus- und eingehen, Änderungen) in ein anderes, als JSON.
- **TLS und SASL.** SCRAM-SHA-256, SCRAM-SHA-512 und PLAIN (PLAIN nur über TLS), mit Ihrer eigenen CA, wenn das Zertifikat des Brokers nicht von einer öffentlichen stammt. Client-Zertifikate, Kerberos und OAuth-Anmeldungen werden noch nicht unterstützt.
- **Es ist mindestens einmal.** Ein Messwert kann nach einem Ausfall zweimal ankommen, weil das Nachholen absichtlich überlappt, was schon hinausgegangen ist. `deviceId`, `tag` und `ts` benennen ein Duplikat. Ereignisse sind der Live-Feed und haben keinen Verlauf zum Nachholen, ein Ereignis, das erzeugt wird, während der Broker fort ist, geht daher verloren, und der Status des Ziels zählt es.
- **Ein Broker, der mitten im Schreiben verschwindet.** Das Ziel geht innerhalb von 25 Sekunden auf ausgefallen, und die Messwerte dieses Schreibvorgangs sind geschuldet, statt dass es oben bleibt und seine Warteschlange überläuft.
- **Ein gerade erst angelegtes Topic.** Der erste Blick auf ein Topic, das eben angelegt wurde, von Ihnen oder vom letzten Versuch des Ziels selbst, wartet darauf, dass es existiert und einen Leader hat, statt das Ziel als ausgefallen zu melden.
- **Was es kostet.** Etwa 5 MiB am Binary jedes Produkts mit einer Datenbank. Der Edge Relay hat keine Historian-Ziele und trägt es nicht. Der Client ist franz-go, genannt in `NOTICE`.
- **Update.** Die Migration 0026 fügt den Historian-Zielen eine Spalte `options` hinzu, leer für jedes bestehende Ziel. Für sie ändert sich nichts. [Historian-Ziele](/de/iot/historian-targets/#kafka-api-ereignisstrom) hat die Satzformate und was bewiesen ist und was nicht.

### OPC UA PubSub über UADP

- **Abonnieren.** Ein Gerät mit dem Protokoll `opcua-pubsub` hört auf die DataSets eines Publishers, die als UADP über UDP gesendet werden, Unicast oder Multicast. Die Adresse eines Tags ist `<DataSetWriterId>/<field index>`. Variant-, DataValue- und RawData-Felder, Key-, Delta- und Keep-Alive-Frames. Eine verlorene Nachricht markiert die Tags dieses Writers als unsicher bis zu seinem nächsten Key-Frame, und ein stummer Writer liest sich als schlecht.
- **Veröffentlichen.** Edge und Gateway können die Tags, die ein Layout nennt, als UADP veröffentlichen, aus, bis `HOTLOOP_UADP_PUBLISH_ENABLED` gesetzt ist. Key-Frames, wenn sich Werte ändern, und Keep-Alives, wenn nicht. Ein schlechtes Tag wird als sein Status veröffentlicht, nie als sein letzter Wert.
- **Noch nicht.** Nachrichtensicherheit (signierte oder verschlüsselte Nachrichten) wird namentlich abgelehnt, ebenso wie segmentierte Nachrichten, Discovery, Ereignisse und Strukturfelder. Delta-Frames werden gelesen, aber nicht gesendet.
- **Arrays.** Ein Feld, das ein Array ist, wird in Variant- und DataValue-Nachrichten gelesen, und in RawData, wenn das DataSet des Geräts sagt, wie es angelegt ist (`"Float[250]"` für ein Array mit seiner Anzahl, `"Float*250"` für 250 einzelne Felder). Ein Tag nennt ein Element, `1000/3[17]`, und Browse listet sie auf.
- **Wo es hört.** Gruppe, Port und Netzwerkkarte gehören dem Gerät. Eine Multicast-Gruppe auf einer benannten Karte und ein Unicast-Port auf dieser Maschine funktionieren beide.
- [Protokolle und Treiber](/de/iot/protocols/#opc-ua-pubsub-uadp) hat die Einrichtung und die Grenzen.

### Images und ein zweiter Satz Bildschirme

- **Diesmal nur amd64.** Die Images der 4.19.4 sind für amd64 gebaut. Das Versions-Tag listet allein amd64, und `stable` und `latest` tragen das neue amd64-Image neben den arm64- und arm/v7-Images, die sie schon hatten und die die der vorigen Version sind. Eine arm-Box, die `stable` folgt, zieht weiter und betreibt weiter, was sie betrieben hat. Die nächste Version baut wieder jede Architektur und ist eine Versionserhöhung ohne sonst etwas.
- **Die neuen Bildschirme liegen unter `/next`.** Eine neu gebaute Web-Oberfläche steckt in jedem Image hinter der alten, die unter `/` weiterhin das ist, was Sie bekommen. Probieren Sie sie unter `/next` auf jeder Installation aus; an der Vorgabe ändert sich nichts.

### Korrekturen

- **Ein Prozess stoppt den nächsten Lauf eines Skripts nicht mehr mit seinem eigenen, zu ihm zurückkehrenden Stopp.** Das Stoppen eines Skripts wird an jeden Prozess gemeldet, auch an den, der es ausgelöst hat, und die einen Moment später erneut gehörte Meldung brach den dann laufenden Lauf dieses Skripts ab: Unter Last wurde ein erwarteter Lauf 8 ms nach seinem Beginn abgebrochen, und ein anderer wurde nie fertig. Ein Prozess ignoriert den Stopp, den er selbst gemeldet hat, und ein Stopp, den ein anderer Prozess gemeldet hat, stoppt ihn weiterhin.
- **Ein Discovery-Listener ist bereit, wenn der Broker seine Abonnements beantwortet hat, und erst dann.** Ein abgelaufenes Warten zählte als Antwort, ebenso eine Antwort auf einer inzwischen getrennten Verbindung; beides zählt nicht mehr, und eine Antwort, die spät kommt, zählt weiterhin.
- **Ein Discovery-Listener meldet sich bereit, wenn er hören kann.** Die MQTT-Sitzung zählte sich in dem Moment als verbunden, in dem der Broker sie annahm, und setzte erst danach ihre Abonnements ab und wartete, bis der Broker sie gewährte. Ein Listener, der darauf „bereit“ meldete, sendete die nächste Nachricht in die Lücke, und ein nicht gehaltener Status oder eine Konfiguration eines Geräts ging verloren. Er meldet sich jetzt bereit, wenn die Abonnements gewährt sind, bei der ersten Verbindung und bei jedem Wiederverbinden.
- **Ein Pin auf dem Board löscht das Board nicht mehr.** Die Seite las das Board nur, wenn der Board-Bildschirm geöffnet wurde, sodass ein Neuladen auf dem Tag-Bildschirm eine leere Liste hielt und der erste Pin das gespeicherte Board durch dieses eine Tag ersetzte. Die Seite liest das Board jetzt beim Start, ein Pin wird abgelehnt, bis sie es getan hat, und ein Speichern trägt das `rev` des Boards, sodass der Server ein Speichern auf einem Board, das sich seit dem Lesen geändert hat, mit `409` beantwortet. Das `rev` ist in der API optional: Lassen Sie es weg, und das Speichern wird nicht geprüft.
- **Ein hängendes OPC-UA-Abonnement wird bemerkt.** Die Bibliothek behält ihre Keep-Alives für sich, sodass eine stehengebliebene Publish-Schleife wie eine ruhige Anlage aussah und ihre letzten Werte als gut auslieferte. Nach zehn Publishing-Intervallen Ruhe (mindestens dreißig Sekunden) liest der Treiber die Nodes einmal, vergleicht sie mit dem, was er hält, und fällt auf Lesen zurück, wenn eines abweicht.
- **Eine SPS, die mit offenem Socket verstummt, ist ausgefallen, nicht beeinträchtigt.** Modbus, S7 und EtherNet/IP behielten ihre letzten Werte, bis TCP aufgab, weil die Abfrage zurückkehrte, bevor sie die Sitzung beurteilte. Jetzt beurteilen sie sie. Im Test hängt noch kein S7- oder CIP-Server am Kabel, und die Roadmap sagt das.
- **Eine in eine URL oder Freitext getippte Zugangsangabe wird im Ruhezustand verschlüsselt.** Jeder Bildschirm verbarg `mqtt://user:pass@host` und `?token=` schon vor Menschen, aber die Datenbank und die Backups hielten sie wie getippt. Eine Zeichenkette, die eines trägt, nach demselben Test, nach dem die Schwärzung es verbirgt, wird als Ganzes versiegelt und kommt genau wie geschrieben zurück, sodass der Treiber weiterhin die URL bekommt, die ihm gegeben wurde. Ein später eingeschalteter Schlüssel versiegelt, was vorher gespeichert wurde, und eine Wiederherstellung fragt nur dann nach dem Schlüssel, wenn nur eine Adresse ihn braucht.
- **Jede Zeit, die die API schreibt, ist UTC.** Eine Anlage mit New York schrieb `-04:00`, wo eine mit UTC `Z` schrieb, über etwa dreißig Felder: `created_at`, `updated_at`, das `raisedAt` eines Alarms, die Zeit eines Ereignisses, das `lastPoll` eines Geräts, der Zeitstempel eines Tags, ein Logbook-Eintrag, der nächste Lauf eines Berichts. Sie lesen sich jetzt auf beiden gleich. Wenn Sie diese in einem Skript parsen, das Ihren lokalen Versatz erwartete, bekommt es jetzt `Z`.
- **Monatliche Partitionen wurden am 31. übersprungen.** Die Verlaufs- und Logbook-Tabellen legten ihre nächste Partition an, indem sie dem heutigen Tag einen Monat hinzufügten, und am 31. übersprang das einen Monat, sodass die Zeilen eines Monats in der Standardpartition lagen. Jetzt beginnen sie beim Ersten des Monats.
- **Das UniFi-Ereignislog ist danach geordnet, wann das Ereignis stattfand,** nicht danach, wann der Frame hier ankam, sodass ein Replay nach einem Wiederverbinden nicht mehr obenauf liegt.
- **Die Frontplatte eines Switches passt auf ein Handy.** Acht Ports waren breiter als ein 390-Pixel-Bildschirm, und die Seite scrollte um 113 Pixel zur Seite. Die Ports sind jetzt enge Kacheln, mit den PoE-Watt im Detail des Ports, und eine Frontplatte, die ihre Karte noch überragt, scrollt in ihr.
- **Ein Handy ohne Sitzung und ohne Verbindung bekommt den Anmeldebildschirm und den Grund** statt einer leeren App und lädt neu, wenn HotLoop antwortet.
- **Ein Rollback ist ein einziger Befehl.** Der Chart-Index wird in den Live-Index gemergt, statt aus den eigenen Charts der Version neu gebaut zu werden, sodass eine ältere Version weiter aufgelöst wird.

### Update von 4.18.11

- Lesen Sie die ersten beiden Abschnitte oben, bevor Sie irgendetwas an einer laufenden Anlage tun.
- Die Migration 0026 ist die einzige. Sie ist additiv, und jede bestehende Zeile funktioniert weiter.
- Eine nackte oder Quadlet-Installation bekommt beim ersten Start einen MCP-Token. `hotloop mcp-token` gibt ihn aus.
- `helm upgrade` wie gewohnt. Quadlet-Units folgen `:stable` und brauchen nichts. `helm rollback` auf 4.18.11 ist für diese Version in Ordnung: Die Datenbank ist schon PostgreSQL 17, und nichts hier ändert sie.
