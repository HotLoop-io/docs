---
title: "Protokolle und Treiber"
description: "OPC UA, Modbus, MQTT und Sparkplug B, EtherNet/IP, S7comm, MTConnect und HTTP, mit dem Nachweis, wie weit jeder Treiber an echten Anlagen erprobt ist."
---

:::note[Enthält, was kommt]
Diese Seite behandelt auch einige Dinge, die neuer sind als HotLoop core 4.24.0, die aktuelle Version. Manches davon ist möglicherweise nicht in dem enthalten, was Sie installiert haben. Die [Versionshinweise](/de/releases/) sagen, was sich geändert hat.
:::

Dieses Dokument sagt genau, was das Gateway spricht, wie weit jeder Treiber verifiziert wurde und was bei allem anderen zu tun ist. Es ist das Erste, was Sie lesen sollten, und das, auf das Sie sich verlassen, wenn etwas davon abweicht.

Die Liste der nativen Protokolle wird aus den in die Binärdatei einkompilierten Treibern abgeleitet: `/api/protocols`, die Protokolle-Ansicht und das MCP-Werkzeug `describe_protocol` lesen alle dieselbe Registry. Der Katalog kann kein Protokoll bewerben, das die Binärdatei nicht hat.

## Verifizierungsstatus

Jedes Protokoll, das HotLoop nativ spricht, hat echte Werte von einem echten Server oder Gerät bewegt und lief auf echter Hardware (2026-11-17). Wo eine unabhängige Implementierung existiert, wurde HotLoop in beide Richtungen dagegen betrieben.

| Protokoll | Nativ | Status |
|---|---|---|
| Modbus TCP/RTU | ja | **live verifiziert** |
| OPC UA | ja | **live verifiziert**, einschließlich Ignition 8.3.9 in beide Richtungen mit Benutzername und Passwort über einen gesicherten Kanal |
| MQTT / Sparkplug B | ja | **live verifiziert** |
| MTConnect | ja | **live verifiziert** |
| HTTP / REST | ja | **live verifiziert** |
| S7comm | ja | **live verifiziert** (echte Hardware, 2026-11-17) |
| EtherNet/IP | ja | **live verifiziert** (echte Hardware, 2026-11-17) |
| UniFi Network | ja | **live verifiziert**, nur lesend, an echten Konsolen und Switches, einschließlich WAN-Verbindungen und Failover |
| SNMP | ja | **live verifiziert**, nur lesend, über v1, v2c und v3 auf jeder Sicherheitsstufe |
| CODESYS | ja | **live verifiziert**, Lesen und Schreiben, einschließlich eines Programms mit über 100.000 Variablen, das in 2,4 Sekunden gelesen wurde |
| BACnet/IP | ja | **live verifiziert**, nur lesend |
| OPC UA PubSub (UADP) | ja | **live verifiziert**, in beide Richtungen |
| Kafka-API (Ausgang) | ja | **live verifiziert** gegen Apache Kafka und Redpanda, mit TLS und einer SASL-Anmeldung |

Hersteller unterscheiden sich bei ihren Standardwerten: welche Zertifikate und Token-Richtlinien ein OPC-UA-Server anbietet, was ein BACnet-Controller in seine Objektliste schreibt, welche MIBs ein SNMP-Gerät bereitstellt, wie eine SPS ihre Daten nummeriert. Ein neues Gerät an einem neuen Standort bleibt Inbetriebnahmearbeit. Vergleichen Sie also einen bekannten Wert an der Sonde der Integration mit der Anzeige des Geräts selbst, bevor Sie einer Ansicht vertrauen.

## Native Protokolle

### OPC UA

Bevorzugen Sie dieses, wenn ein Gerät die Wahl lässt. Es browst, ist ordentlich abgesichert und abonniert.

Der Treiber **abonniert, statt abzufragen**. Der Server sendet einen Wert, wenn er sich ändert, in einem Takt, den er leisten kann, statt in jedem Zyklus dieselbe Frage von einem Client gestellt zu bekommen, der nicht weiß, ob sich etwas bewegt hat. Lehnt ein Server ein Abonnement ab, fällt der Treiber auf gebündelte Lesevorgänge zurück, statt das Gerät scheitern zu lassen.

Er fällt auch zurück, wenn ein Abonnement gar nichts liefert. Ein Server sendet den aktuellen Wert jedes Knotens in seiner ersten Veröffentlichung und danach erst wieder, wenn er sich ändert; eine verlorene erste Veröffentlichung bedeutet also einen Sollwert, der so lange als schlecht gelesen wird, wie die Sitzung dauert. Vergehen zehn Veröffentlichungsintervalle (mindestens fünf Sekunden) ohne einen Wert aus dem Abonnement, protokolliert der Treiber eine Warnung, löscht das Abonnement und liest die Tags bei jeder Abfrage, bis sich das Gerät erneut verbindet. Die OPC-UA-Clientbibliothek, auf der dieser Treiber aufbaut, kann ihre Veröffentlichungsschleife auf einem ausgelasteten Host pausiert starten und nie eine Veröffentlichungsanfrage senden; für diesen Fall gibt es das.

Er fällt auch zurück, wenn ein Abonnement stoppt, nachdem Werte angekommen sind. Die Bibliothek behält ihre Keep-Alives für sich, sodass eine angehaltene Veröffentlichungsschleife genauso aussieht wie eine Anlage, in der sich nichts ändert. Ist ein Abonnement zehn Veröffentlichungsintervalle lang still gewesen (mindestens dreißig Sekunden), liest der Treiber jeden Knoten einmal und vergleicht ihn mit dem, was das Abonnement zuletzt geliefert hat. Weicht ein Knoten in Wert oder Qualität ab, hält der Server etwas zurück, das er gesendet hätte, also protokolliert der Treiber eine Warnung, löscht das Abonnement und liest bei jeder Abfrage, bis sich das Gerät erneut verbindet. Stimmen sie überein, macht er weiter und prüft nach derselben Stille erneut. Ein gesundes stilles Abonnement kostet alle dreißig Sekunden einen gebündelten Lesevorgang.

**Adressieren Sie die Knoten über den Namespace-URI.** Das ist wichtiger, als es aussieht:

```
nsu=http://opcua.edge.server;s=Zone1_Temperature    good
ns=3;s=Zone1_Temperature                            works until it doesn't
```

Ein Namespace-*Index* wird in der Reihenfolge vergeben, in der der Server seine Namespaces lädt. Fügen Sie einen Namespace hinzu, aktualisieren die Firmware, und Index 3 wird unbemerkt zu etwas anderem: Jede Messung ist dann falsch, ohne dass irgendwo ein Fehler erscheint. Der URI ist Teil des Modells und bewegt sich nicht. `Browse` liefert genau deshalb die URI-Form zurück.

Eine einfache Zeichenkette wird als Adresse abgelehnt. Als `ns=0;s=Temperature` gelesen, würde ein Tippfehler problemlos als ein Knoten geparst, der nicht existiert, und der Tag würde für immer als schlecht gelesen. Eine explizite Form ist vorgeschrieben, damit der Fehler beim Speichern auffällt.

**Tags entdecken deklariert jeden Tag mit dem Typ, den der Server für den Knoten angibt**: Boolean ist `bool`, die Ganzzahltypen behalten ihre Breite (`int16`, `uint16`, `int32`, `uint32`, `int64`, `uint64`; SByte und Byte nehmen die nächstgrößere Größe), Float und Double sind `float`, und String, DateTime, LocalizedText und die anderen Typen, die der Treiber als Text liest, sind `string`. Ein Typ, den der Server nicht nennt, oder einer ohne besseren Namen (eine Aufzählung, eine Struktur), bleibt `float`. Bis zur unten beschriebenen Ignition-Arbeit war jeder entdeckte Tag `float`. Der Treiber las den Text eines String-Knotens trotzdem, aber der Tag sagte float, und der OPC-UA-Server des Gateways selbst veröffentlicht einen Tag mit dem Typ, mit dem er deklariert ist; ein Client dieses Servers bekam also `Bad_TypeMismatch`. Ignition zeigte Emberburns `System_Status` genau so. Vor der Korrektur importierte Tags behalten ihren Typ: Stellen Sie einen Text-Tag von Hand auf `string` um.

Konfiguration: Die Sicherheits-, Identitäts- und Zertifikatsoptionen sind unter [OPC UA: Sicherheit und Zugangsdaten](#opc-ua-sicherheit-und-zugangsdaten) beschrieben. Die übrigen sind `subscribe`, `publishIntervalMs`, `samplingIntervalMs`, `queueSize`, `sessionTimeoutMs`, `browseMaxNodes`, `browseRoot` und `browseServerNodes`. Ein Optionsname, den der Treiber nicht kennt, ist ein Fehler, der die bekannten auflistet, keine still ignorierte Einstellung: Ein Tippfehler in `securityMode` würde sonst völlig ohne Sicherheit verbinden und genau wie ein funktionierendes Gerät aussehen.

**Tags entdecken lässt das eigene `Server`-Objekt des Servers weg** (`i=2253`: sein Status, seine Fähigkeiten, Diagnose, das Namespace-Array und die Konfiguration). Jeder OPC-UA-Server hat eines, und es können Hunderte von Variablen sein, die sich mit denen der Anlage mischen. Setzen Sie `browseServerNodes` am Gerät auf `true`, um sie zurückzubekommen, oder setzen Sie `browseRoot` auf `i=2253`, um bewusst hineinzuschauen; ein Browse, der dort beginnt, durchläuft ihn trotzdem.

### OPC UA: Sicherheit und Zugangsdaten

Bis 4.15.0 konnte der Treiber nur eine anonyme, ungesicherte Verbindung herstellen, und nicht zu jedem Server, der der Spezifikation folgt: Er fragte den Server nie, welche Identity-Token-Richtlinien er anbot, und schickte daher eine leere Token-Richtlinien-ID, die ein konformer Server ablehnt. Das schloss den OPC-UA-Server von HotLoop selbst ein. Der Treiber ermittelt jetzt die Endpoints des Servers, wählt einen passenden zum Gerät und gibt die Richtlinien-ID zurück, die dieser Endpoint aufgeführt hat.

#### Geräteoptionen

| Option | Standard | Was sie bewirkt |
|---|---|---|
| `securityMode` | `None` | `None`, `Sign` oder `SignAndEncrypt`. Weggelassen bei einer `securityPolicy` ungleich `None`, ist es `SignAndEncrypt`. |
| `securityPolicy` | die beste, die der Server für den Modus anbietet | `None`, `Basic256Sha256`, `Aes128_Sha256_RsaOaep` oder `Aes256_Sha256_RsaPss`. `Basic128Rsa15` und `Basic256` werden abgelehnt. |
| `username`, `password` | anonym | Authentifizierung mit Benutzernamen. |
| `userCertificate`, `userPrivateKey` | keine | X.509-Benutzerauthentifizierung: Die Sitzung meldet sich als der Benutzer an, dem der Server dieses Zertifikat zuordnet, ohne Passwort. Beide als PEM, gemeinsam zu setzen. Der Schlüssel ist RSA (die OPC-UA-Bibliothek signiert nur mit RSA; ein EC-Schlüssel wird mit entsprechender Meldung abgelehnt) und ist ein Geheimnis wie das Passwort: im Ruhezustand versiegelt, in jeder API-Antwort geschwärzt, nie protokolliert. Das Zertifikat ist das des Benutzers, nicht das Client-Anwendungszertifikat in `certFile`. Ist zusätzlich ein `username` gesetzt, wird das Zertifikat verwendet. Beim eigenen Server von HotLoop muss das Zertifikat zuerst einem Benutzer zugeordnet werden ([Der OPC UA Server](/de/edge/opc-ua-server/#x509-benutzerzertifikate)). |
| `allowInsecureCredentials` | `false` | Erlaubt, ein Passwort über einen ungesicherten Kanal (`securityMode` `None`) zu senden, oder wenn nichts es verschlüsselt. |
| `certFile`, `keyFile` | erzeugt | Das Anwendungszertifikat dieses Clients und sein RSA-Schlüssel, für einen gesicherten Modus. Setzen Sie beide oder keines. |
| `pkiDir` | `HOTLOOP_OPCUA_CLIENT_PKI_DIR` (`/data/opcua-client-pki`) | Wo das erzeugte Zertifikat und die Speicher `trusted/` und `rejected/` liegen. |
| `serverCertThumbprints` | keine | SHA-1- (40 Hexziffern) oder SHA-256-Fingerabdrücke (64) von Serverzertifikaten, denen ohne Datei in `trusted/` vertraut wird. Doppelpunkte und Leerzeichen werden ignoriert. |
| `insecureSkipVerify` | `false` | Akzeptiert jedes Serverzertifikat. |

Ein Gerät ohne eine dieser Optionen ist, was es immer war: anonym, über einen ungesicherten Kanal.

#### Wie der Treiber einen Endpoint wählt

Der Treiber fragt den Server über einen ungesicherten Kanal nach seinen Endpoints, was die Spezifikation von Servern für die Erkennung zu erlauben verlangt und nichts Geheimes transportiert, da die Endpoint-Liste von Natur aus öffentlich ist. Er behält die Endpoints, deren Sicherheitsmodus und Richtlinie zum Gerät passen, und unter diesen die Token-Richtlinie für die Identität des Geräts (anonym oder Benutzername, wenn ein `username` gesetzt ist). Das Identity-Token, das er danach sendet, trägt die Richtlinien-ID, die dieser Endpoint aufgeführt hat; er sendet nie eine leere.

- **Er wählt nie `Basic128Rsa15` oder `Basic256`.** Beide sind von der OPC Foundation als veraltet eingestuft. Das gilt auch, wenn eine davon die höchste Sicherheitsstufe der Liste hat, so ordnen Server sie ein, und wenn eine das Einzige ist, was der Server anbietet; dann scheitert die Verbindung mit einem Fehler, der das sagt. Ein Gerät lässt sich nicht so konfigurieren, dass es eine davon nutzt, und eine Token-Richtlinie, die ein Passwort mit einer davon verschlüsseln würde, wird ebenfalls abgelehnt. Der eigene Server von HotLoop bietet beide neben den modernen Richtlinien an und kann sie nicht abschalten; das wird also gegen einen echten Server geprüft, und die Tests stellen sicher, dass der URI keiner der beiden Richtlinien in dem auftaucht, was der Treiber sendet.
- **Nennt das Gerät keine Richtlinie, bevorzugt er `Basic256Sha256`, dann `Aes128_Sha256_RsaOaep`, dann `Aes256_Sha256_RsaPss`**, welche Sicherheitsstufe der Server ihnen auch gibt. Die Reihenfolge richtet sich danach, wie weit jede verbreitet ist, nicht nach ihrer Stärke. Manche Server können mit `Aes256_Sha256_RsaPss` keinen Kanal öffnen und schließen die Verbindung, ohne zu sagen, warum; sie wird deshalb nur verwendet, wenn ein Gerät sie nennt.
- **Passt nichts, listet der Fehler auf, was der Server tatsächlich anbietet**, mit Richtlinie und Token-Richtlinien-ID jedes Endpoints, sodass sich die Konfiguration allein anhand der Meldung korrigieren lässt.

#### Das eigene Zertifikat des Clients

Jeder gesicherte Modus braucht ein Anwendungszertifikat. Nennt das Gerät ein `certFile` und ein `keyFile`, werden sie nach Prüfungen unverändert verwendet (RSA, mindestens 2048 Bit, nicht abgelaufen). Andernfalls wird bei der ersten Verwendung ein selbstsigniertes erzeugt und im PKI-Verzeichnis abgelegt: RSA-2048, fünf Jahre, die Anwendungs-URI `urn:hotloop:client:<host name>` in den Subject Alternative Names, der Schlüssel mit Modus `0600`, das Zertifikat mit Modus `0644` und die Verzeichnisse mit `0750`. Das Layout spiegelt das des OPC-UA-Servers:

```
own/cert.pem, own/key.pem   this client's certificate
trusted/                    server certificates an operator has approved
rejected/                   server certificates the driver turned away
```

Es wird bei einem normalen Start nicht neu erzeugt, sodass einem Server, dem gesagt wurde, ihm zu vertrauen, das nicht erneut gesagt werden muss. Es wird, mit einer Warnung, dass jeder Server das neue genehmigen muss, nur ersetzt, wenn es nicht gelesen werden kann, kein RSA mit mindestens 2048 Bit ist oder weniger als 30 Tage Restlaufzeit hat. Geräte, die zum selben Zeitpunkt starten, teilen sich ein Zertifikat, statt dass jedes sein eigenes schreibt.

Das Verzeichnis muss beschreibbar und persistent sein. Im Helm-Chart ist das `opcuaClient.persistence.enabled` (standardmäßig aus, weil es einer bestehenden Installation ein Volume hinzufügt); am Edge Relay ist es das vorhandene Volume `/data`. Ohne beschreibbares Verzeichnis meldet ein gesichertes Gerät einen Fehler, der die zu setzende Variable nennt, statt mit Zertifikaten zu verbinden, die beim nächsten Neustart verloren wären.

Der **Server** muss diesem Zertifikat ebenfalls vertrauen, was eine Einstellung des Servers selbst ist. Beim eigenen Server von HotLoop ist es derselbe Handgriff: Das Zertifikat des Treibers erscheint nach dem ersten abgelehnten Versuch im Verzeichnis `rejected/` des Servers, und das Verschieben nach `trusted/` genehmigt es. Schließt ein Server die Verbindung, während der gesicherte Kanal geöffnet wird, so weisen viele Server ein Zertifikat ab, dem sie nicht vertrauen; der Fehler nennt dann die Zertifikatsdatei dieses Clients und ihren Fingerabdruck, damit der Bediener weiß, wonach er am Server suchen muss.

#### Das Zertifikat eines Servers genehmigen

Für einen gesicherten Modus oder für ein Passwort, das mit dem Schlüssel des Servers verschlüsselt werden soll, **akzeptiert der Treiber nicht jedes Zertifikat, das der Server vorlegt.** Er vertraut dem Zertifikat nur, wenn es in `serverCertThumbprints` des Geräts angeheftet oder genau das Zertifikat in `trusted/` ist. Alles andere wird nach `rejected/<thumbprint>.der` geschrieben, und die Verbindung scheitert, bevor irgendeine Zugangsdate gesendet wird, mit einer Meldung wie dieser:

```
opcua: the server at opc.tcp://plc-01:4840 presented a certificate that is not
trusted (subject "CN=PLC01", SHA-1 thumbprint 5A6DB35A..., expires 2031-09-18).
It has been saved to /data/opcua-client-pki/rejected/5A6DB35A....der. To approve
it, first check that the thumbprint matches the one the server shows, then move
that file into /data/opcua-client-pki/trusted (the next connection attempt picks
it up; no restart is needed). Alternatively pin it by adding the thumbprint to
this device's serverCertThumbprints. Until then this device will not connect
```

Prüfen Sie den Fingerabdruck an der eigenen Anzeige des Servers, bevor Sie genehmigen: Dieser Vergleich ist die gesamte Vertrauensentscheidung. Verschieben Sie die Datei dann mit `mv` nach `trusted/` (PEM- und DER-Dateien werden beide gelesen), und das Gerät verbindet sich beim nächsten Versuch, der innerhalb des Wiederverbindungsintervalls der Runtime liegt. Einige Einzelheiten:

- Vertraut wird dem exakten Zertifikat, nicht einer Kette. Ein Server, dessen Zertifikat von einer CA ausgestellt ist, wird genehmigt, indem das eigene Zertifikat dieses Servers in `trusted/` abgelegt wird, genau wie bei einem selbstsignierten. Einer CA zu vertrauen wird nicht unterstützt.
- Ein abgelaufenes, aber von einem Bediener genehmigtes Zertifikat gilt weiterhin als vertrauenswürdig, mit einer Warnung im Log bei jeder Verbindung. Eines abzulehnen, das ein Bediener absichtlich genehmigt hat, triebe ihn nur zu `insecureSkipVerify`.
- Eine Datei in `trusted/`, die kein Zertifikat ist, wird übersprungen und gemeldet und macht die anderen genehmigten Server nicht unerreichbar.
- `rejected/` enthält höchstens 256 Dateien, sodass ein Server, der bei jeder Verbindung ein anderes Zertifikat vorlegt, die Platte nicht füllen kann. Darüber hinaus wird die Verbindung weiterhin abgelehnt, und die Meldung sagt, dass die Datei nicht behalten wurde und wie sich das Zertifikat trotzdem genehmigen lässt.
- `insecureSkipVerify` schaltet die Prüfung ab. Eine Partei auf dem Weg kann dann den Server vortäuschen und mitlesen, was an ihn gesendet wird, auch das Passwort. Es ist standardmäßig aus und warnt bei jeder Verbindung mit dem Fingerabdruck des Zertifikats.

Ein anonymes Gerät auf einem ungesicherten Kanal braucht nichts davon, weil nichts mit dem Schlüssel des Servers signiert oder verschlüsselt wird.

#### Zugangsdaten

Ein Passwort wird vor dem Senden abgelehnt, es sei denn, der Kanal ist gesichert und etwas verschlüsselt das Passwort. Was der Treiber entscheidet, anhand dessen, was der Server für den passenden Endpoint anbietet:

| Kanal | Benutzernamen-Token-Richtlinie des Servers | Ergebnis |
|---|---|---|
| `SignAndEncrypt` | verschlüsselt das Passwort (der übliche Fall) | verbindet |
| `SignAndEncrypt` | tut es nicht | verbindet: Der verschlüsselte Kanal trägt es, und das Log sagt es |
| `Sign` | verschlüsselt das Passwort | verbindet |
| `Sign` | tut es nicht | **abgelehnt**, außer mit `allowInsecureCredentials`. `Sign` authentifiziert Nachrichten, verbirgt sie aber nicht. |
| `None` | verschlüsselt das Passwort | **abgelehnt**, außer mit `allowInsecureCredentials`. Auf einem ungesicherten Kanal stammt der Schlüssel, mit dem das Passwort verschlüsselt wird, aus einer Antwort, die nichts authentifiziert; jeder, der den Verkehr verändern kann, kann es also wiederherstellen. Mit dem Opt-in verbindet es, mit einer Warnung. |
| `None` | tut es nicht | **abgelehnt**, außer mit `allowInsecureCredentials` |

**Ein Benutzername über `securityMode` `None` wird auch dann abgelehnt, wenn die Token-Richtlinie des Servers das Passwort verschlüsselt.** Eine Verschlüsselung, deren Schlüssel ein Angreifer wählen kann, schützt nicht vor diesem Angreifer, und auf einem ungesicherten Kanal wird das Zertifikat, mit dem das Passwort verschlüsselt wird, der Antwort des Servers auf `CreateSession` entnommen, die nichts authentifiziert (der Test unten tauscht ein Zertifikat aus und gewinnt das Passwort zurück). Der Fehler sagt das und nennt die Lösung, `securityMode` `SignAndEncrypt`. Anonyme Sitzungen sind nicht betroffen.

`allowInsecureCredentials` ist der einzige Schalter, der ein Passwort unter diesen Bedingungen hinausgehen lässt. Er ist standardmäßig aus und warnt bei jeder Verbindung, wenn er es ist, der die Verbindung erlaubt hat. Wo die Token-Richtlinie das Passwort verschlüsselt, ändert er, was ein Lauscher lesen kann, nicht, was eine Partei kann, die den Verkehr verändert: siehe [was im Netzwerk übertragen wird](#was-im-netzwerk-übertragen-wird). Auch mit ihm muss das Zertifikat des Servers zuerst genehmigt werden, wenn das Passwort damit verschlüsselt wird.

Das Passwort ist überall ein Geheimnis, wo der Treiber und die API damit umgehen:

- **API-Antworten.** Es wird in jeder Antwort, die ein Gerät zurückgibt (`GET /api/devices`, `GET /api/devices/{id}` und die Antwort auf ein Speichern), durch `[redacted]` ersetzt, sodass ein Viewer, der `devices.read` besitzt, es nicht lesen kann. Ab 4.15.1 gilt das für jede Rolle, auch den Administrator, und für die Zugangsdaten jedes Protokolls, nicht nur dieses. Wird ein Gerät mit dem Platzhalter zurückgespeichert, bleibt das gespeicherte Passwort erhalten; ein neuer Wert ersetzt es; eine leere Zeichenkette löscht es; der Platzhalter für ein Gerät ohne Passwort wird abgelehnt, statt gespeichert zu werden. Das Weglassen des Felds behält es nun (in 4.15.0 löschte es). Die vollständigen Regeln stehen unter [Authentifizierung und Benutzer](/de/iot/authentication/#gerätezugangsdaten-sind-nur-schreibbar). Der Geräteeditor der Web-Oberfläche zeigt die Konfiguration so, wie die API sie zurückgibt, und speichert, was er zeigt, womit das umgegangen wird; das Bearbeiten eines Geräts verliert also sein Passwort nicht. (Die Tests prüfen das über die API, nicht über einen Browser.)
- **Logs und Fehler.** Weder die Logzeilen des Treibers noch irgendein Fehler, den er zurückgibt, tragen das Passwort: Die Meldungen werden aus Statuscodes und den nicht geheimen Einstellungen des Geräts gebaut. Die Tests erfassen das Prozess-Log, das Log des Servers und die Fehler und durchsuchen alle nach dem Passwort.
- **MCP-Werkzeuge und -Ressourcen, der Live-Ereignisstrom, das Systemlog.** Keines gibt die Konfiguration eines Geräts zurück (jedes beschreibt ein Gerät über einen festen Satz von Feldern), und die Tests rufen jedes Werkzeug und jede Ressource auf, öffnen den Strom und lesen das Systemlog bei konfiguriertem Passwort und finden es nirgends.
- **Die Datenbank und Backups.** Das Passwort wird in der Spalte `config` des Geräts gespeichert, wie die der anderen Treiber. Bis 4.16.0 liegt es dort im Klartext, und ein Backup enthält es. Ab 4.17.0 ist es mit einem Schlüssel verschlüsselt, der außerhalb der Datenbank liegt (siehe "Encrypted at rest" weiter unten), sodass ein Dump oder Backup Chiffretext enthält. In beiden Fällen siehe [Backups und Wiederherstellung](/de/iot/backup/#sicherungsdateien-schützen) und schützen Sie die Datenbank und das Backup-Volume entsprechend.
- **Das Edge Relay.** Auch eine Gerätedatei trägt das Passwort. Legen Sie im Helm-Chart eine Gerätedatei mit Zugangsdaten in ein Secret und benennen Sie es in `devicesSecret`; Geräte, die direkt in den Werten des Charts gesetzt sind, landen in einer ConfigMap. Eine Gerätedatei, die per Fleet-Config-Push gesendet wird, wird retained auf einem MQTT-Topic veröffentlicht, sodass der Broker TLS verwenden und einschränken muss, wer dieses Topic lesen darf.

Ein falsches Passwort ist ein klarer Fehler, in einem Versuch, ohne Hängen und ohne Wiederholung im Treiber:

```
opcua: authentication rejected: the server at opc.tcp://plc-01:4840 rejected the
user name and password for "svc-hotloop" (StatusBadUserAccessDenied). ...
```

Die Runtime wartet dann **zehn Minuten** (mit Jitter zwischen fünf und zehn), bevor sie es erneut versucht, statt ihr übliches Wiederverbindungs-Backoff (`HOTLOOP_RECONNECT_MAX`, standardmäßig 60 Sekunden) zu durchlaufen. Zwei Dinge machen eine abgelehnte Anmeldung teurer in der Wiederholung als einen Netzwerkfehler. Ein Server, der ein Konto nach wenigen Fehlern sperrt, macht jeden schnellen Wiederholungsversuch zu einem Ausfall für alle anderen, die dieses Konto nutzen. Und jede abgelehnte Anmeldung kann eine **Sitzung hinterlassen, die erstellt und nie aktiviert wurde**, auf dem Server, die gegen sein Sitzungslimit zählt, bis sie abläuft (die Bibliothek fragt zwanzig Minuten an; `sessionTimeoutMs` ändert das): Gegen den eigenen Server von HotLoop füllte ein Gerät mit falschem Passwort, das alle paar Sekunden neu versuchte, dessen Standardlimit von zwanzig Sitzungen, danach lehnte der Server jeden anderen Client mit `BadTooManySessions` ab. Ein Controller mit einer kleinen Sitzungstabelle ist noch stärker gefährdet. Das Gerät hört nicht auf, es zu versuchen; ein Server, dessen Passwort auf seiner Seite korrigiert wird, erholt sich also innerhalb von zehn Minuten, ohne dass jemand HotLoop anfasst; das Korrigieren des Passworts am Gerät oder das Aus- und Einschalten startet einen neuen Worker, der sofort einen Versuch macht.

#### Was im Netzwerk übertragen wird

Gemessen, nicht geschlussfolgert: Die Tests setzen einen aufzeichnenden Proxy zwischen den Treiber und einen Server und durchsuchen jedes Byte in beide Richtungen. Die Suche findet Bytes, von denen bekannt ist, dass sie da sind (die Endpoint-Liste des Servers, im Klartext gesendet), woran sich zeigt, dass der Proxy die Unterhaltung aufgezeichnet hat.

| Konfiguration | Passwort | Benutzername | Knoten-IDs und Werte der Tags |
|---|---|---|---|
| `SignAndEncrypt` | nicht sichtbar | nicht sichtbar | nicht sichtbar |
| `Sign` | nicht sichtbar (die Token-Richtlinie verschlüsselt es) | **lesbar** | **lesbar** |
| `None`, Benutzername, Token-Richtlinie des Servers verschlüsselt (braucht `allowInsecureCredentials`) | nicht sichtbar | **lesbar** | **lesbar** |
| `None`, anonym | nicht zutreffend | nicht zutreffend | **lesbar** |
| ein Server, der ein unverschlüsseltes Passwort anbietet, mit `allowInsecureCredentials` | **lesbar** | **lesbar** | hängt vom Modus ab |

Die letzte Zeile wird gegen einen Server geprüft, der das in Wirklichkeit nicht anbietet: Eine Partei vor einem echten Server schreibt dessen Endpoint-Liste so um, dass sie sagt, das Passwort sei unverschlüsselt, auf dem Kanal, den die Erkennung nutzt und den nichts authentifiziert. So zeigen die Tests auch die Ablehnung: Ohne das Opt-in lehnt der Treiber ab, öffnet nur die Erkennungsverbindung, und keine Zugangsdaten gehen über die Leitung. Die Endpoint-Liste ist genau das, was eine Partei auf dem Weg umschreiben kann, weshalb die Regel des Treibers auf das angewendet wird, was ihm gesagt wird, und nicht dem Server zur Durchsetzung überlassen bleibt.

Ein ungesicherter Kanal mit einem Passwort hat eine Grenze, die die Tabelle nicht zeigt und ein Test schon; deshalb lehnt der Treiber diese Kombination ohne das Opt-in ab. Das Passwort wird mit dem Zertifikat des Servers verschlüsselt, was es vor einem Lauscher schützt, und der Treiber sendet es erst, wenn dieses Zertifikat genehmigt ist. Aber das Zertifikat, mit dem die OPC-UA-Bibliothek verschlüsselt, ist das in der Antwort des Servers beim Erstellen der Sitzung, und auf einem ungesicherten Kanal ist diese Antwort nicht authentifiziert. Eine Partei, die den Verkehr verändern kann, setzt ihr eigenes Zertifikat ein, und das Passwort wird dann mit dem Schlüssel dieser Partei verschlüsselt: Der Test tut das, entschlüsselt das Passwort mit dem ausgetauschten Schlüssel und bekommt es zurück. **Über `Sign` oder `SignAndEncrypt` kann dieselbe Partei das nicht**, weil die Antwort durch Schlüssel geschützt ist, die sie nicht hat. Ohne `allowInsecureCredentials` weigert sich der Treiber, das Passwort überhaupt zu senden, und der Test zeigt, dass dieselbe Partei dann nichts bekommt; mit ihm warnt der Treiber bei jeder Verbindung. Verwenden Sie `SignAndEncrypt`, wo immer der Server es anbietet; ein ungesicherter Kanal mit einem Passwort, per Opt-in zugelassen, schützt vor einem Lauscher und nicht mehr.

#### Wiederverbindung

Die eigene Wiederverbindung der OPC-UA-Bibliothek ist abgeschaltet, und die Runtime verbindet neu. Die Bibliothek öffnet, sobald eine Sitzung verloren ist, eine neue mit den Zugangsdaten, die sie bekommen hat, und versucht es, wenn der Server sie ablehnt, sofort ohne jede Verzögerung erneut: Gemessen wurden etwa zwanzig abgelehnte Anmeldungen in zwölf Sekunden, gegen einen Server, dessen Passwort geändert worden war. So wird ein Konto für alle gesperrt, die es teilen. Jetzt lässt eine verlorene Sitzung `Poll` einen Fehler melden, der Worker der Runtime schließt den Treiber und öffnet einen neuen, und der neue ermittelt die Endpoints, prüft das Zertifikat des Servers und meldet sich erneut an, mit dem Jitter-Backoff der Runtime und dem Zehn-Minuten-Warten nach einem Authentifizierungsfehler. Ein Neustart des Servers wird auf dieselbe Weise überstanden: Das Gerät liest nach dem Neustart den neuen Wert, nachdem es sich erneut angemeldet hat, was die Tests prüfen, indem sie die Anmeldungen des Servers zählen und den Wert nach dem Neustart ändern.

Ein Gerät ohne Tags hat nichts zu lesen, und bis 4.15.2 hieß das, dass seine Abfrage überhaupt nichts sendete. Der Server schloss die ruhende Sitzung nach seinem Sitzungs-Timeout, das Gerät meldete sich weiter als verbunden, weil niemand dem Server etwas gefragt hatte, und jeder Browse scheiterte mit `BadSessionIDInvalid`, bis der Prozess neu gestartet wurde. Das trifft jedes Gerät genau in dem Moment, in dem jemand es hinzufügt und auf Tags entdecken klickt. Ignition hat es erwischt. Jetzt liest ein Gerät ohne Tags bei jeder Abfrage den Zustand des Servers, was die Sitzung am Leben hält und bemerkt, wenn sie stirbt, und ein Browse, der die Sitzung weg findet, meldet das, damit die Runtime neu verbindet.

Ein Tag, der sich seit vor Beginn der Sitzung nicht geändert hat, liest jetzt seinen aktuellen Wert mit guter Qualität. Zuvor war die Platzhalter-Messung, die beim Warten auf den ersten Wert gemeldet wurde, neuer als der Quellzeitstempel des Werts selbst, und die Runtime behält die neueste Messung und verwarf den Wert, sodass ein stabiler Tag als schlecht gelesen wurde, bis er sich das nächste Mal änderte.

#### Was getestet wurde und was nicht

OPC UA wurde gegen Ignition 8.3.9 und gegen unabhängige OPC-UA-Server betrieben, mit anonymer Anmeldung und mit Benutzername und Passwort über `None`, `Sign` und `SignAndEncrypt`, und am 2026-11-17 auf echter Hardware. Jeder Produktionsserver hat seine eigenen Gewohnheiten, welche Richtlinien er anbietet und wie er ein Zertifikat abweist; behandeln Sie die erste Verbindung zu einem Server eines neuen Herstellers daher als Inbetriebnahme.

Was Sie wissen sollten:

- Jede Verbindung fragt jetzt zuerst den Server nach seinen Endpoints, und ein Gerät ohne Sicherheitsoptionen braucht einen ungesicherten Endpoint, der eine anonyme Token-Richtlinie mit einer ID aufführt. Ein Server, der anonyme Sitzungen akzeptierte, ohne eine aufzuführen, wird mit einem Fehler abgelehnt, der auflistet, was er anbietet.
- X.509-Zertifikats- und Issued-Token-Benutzerauthentifizierung ist für den Treiber nicht implementiert. Das `certFile` eines Geräts ist sein Anwendungszertifikat.
- Vertraut wird dem exakten Zertifikat. Einer Zertifizierungsstelle zu vertrauen und Zertifikatssperrung werden nicht unterstützt.
- Sicherheitsrichtlinien mit elliptischen Kurven werden nicht unterstützt, ebenso wenig Server, die die Erkennung auf einem ungesicherten Kanal ablehnen.
- Ein Netzwerkpfad, der wegfällt, ohne dass eine der beiden Seiten das Schließen sieht, lässt das Gerät auf seinen letzten Werten, bis das Betriebssystem die Verbindung aufgibt.
- Manche Server können mit `Aes256_Sha256_RsaPss` keinen Kanal öffnen.
- Der eigene Server von HotLoop akzeptiert Passwörter bis zu 72 Bytes. Ein anderer Server kann sein eigenes Limit haben.

#### Ignition 8.3

Verifiziert gegen **Ignition 8.3.9**, die aktuelle stabile Version, im eigenen Container-Image von Inductive Automation: der Treiber von HotLoop als Client, der OPC-UA-Server von Ignition am anderen Ende, `Basic256Sha256` mit `SignAndEncrypt`, angemeldet mit Benutzername und Passwort. Browse fand die Tags von Ignition unter `nsu=urn:inductiveautomation:ignition:opcua:tags`, und die Tags `[System]/Gateway` für Uhr, CPU, Speicher und Laufzeit wurden importiert und mit guter Qualität gelesen, per Abonnement geliefert.

Ein serienmäßiges Ignition-8.3-Gateway hält Sie viermal auf, bevor HotLoop ein Wort sagen kann:

1. **Sein OPC-UA-Server lauscht nur auf localhost.** Ab Werk bindet 8.3 Port 62541 an `localhost`, sodass ein HotLoop anderswo "Verbindung abgelehnt" bekommt und sonst nichts. Setzen Sie im Gateway unter den Einstellungen des OPC-UA-Servers Bind Addresses auf `0.0.0.0`. Wir haben außerdem den Hostnamen, den HotLoop anwählt, zu Endpoint Addresses hinzugefügt; ob der Treiber das braucht, wurde nicht getestet.
2. **Tags sind standardmäßig nicht über OPC UA verfügbar.** Schalten Sie Expose Tag Providers ein, sonst findet ein Browse nur die eigene Diagnose des Servers und die Geräteordner.
3. **Zertifikate, in beide Richtungen.** HotLoop lehnt das Zertifikat von Ignition ab, bis Sie es genehmigen, wie oben. Ignition lehnt das von HotLoop ab, bis Sie ihm in den Zertifikaten des OPC-UA-Servers des Gateways vertrauen. Auf der Platte bedeutet das, es von `data/config/local/com.inductiveautomation.opcua/server/security/pki/rejected/certs` nach `.../trusted/certs` zu verschieben, ohne Neustart. **Ignition benennt diese Datei nicht nach dem SHA-1-Fingerabdruck, den HotLoop protokolliert.** Öffnen Sie das Zertifikat und vergleichen Sie seinen Fingerabdruck; der Dateiname wird nicht passen, und das ist kein Zeichen für einen Betrüger.
4. **Die OPC-UA-Anmeldung ist `opcuauser` / `password`** in der Benutzerquelle `opcua-module`, bei jeder frischen Installation. Ändern Sie sie, bevor sich etwas Echtes verbindet.

In dieser Richtung wurde nur geprüft, was der Server von 8.3 ab Werk anbietet: `Basic256Sha256` und `SignAndEncrypt`.

**Auch die andere Richtung ist verifiziert: Der OPC-UA-Client von Ignition 8.3.9 liest den OPC-UA-Server von HotLoop**, angemeldet als HotLoop-Viewer, über jede Sicherheitsrichtlinie und jeden Modus, die Ignition anbietet. Einrichtung, Zertifikatsvertrauen in beide Richtungen, Stolpersteine und die Richtlinienmatrix stehen unter [Der OPC UA Server](/de/edge/opc-ua-server/#ignition-83-als-client). Dabei wurden zwei HotLoop-Fehler gefunden, beide behoben: Der Server erzeugte bei jedem Neuanlegen seines Containers ein neues Zertifikat, was das Vertrauen von Ignition nach jedem Upgrade brach, und Tags entdecken deklarierte jeden Tag als float, sodass ein Text-Tag als `Bad_TypeMismatch` bei Ignition ankam (oben).

Der Sparkplug-Edge-Node von HotLoop und das Edge Relay gegen die MQTT Engine von Ignition sind als Nächstes dran und nicht erledigt.

### OPC UA PubSub (UADP)

Das andere OPC UA: nicht ein Client, der einen Server fragt, sondern ein Publisher, der DataSets als UDP-Datagramme an alle sendet, die zuhören, per Unicast oder Multicast (OPC 10000-14, die UADP-Kodierung). HotLoop abonniert als Gerät und veröffentlicht als Einstellung.

**Abonnieren.** Fügen Sie ein Gerät mit dem Protokoll `opcua-pubsub` hinzu. Die Adresse ist, worauf gehört wird: `udp://239.0.0.1:4840` tritt einer Multicast-Gruppe bei, `udp://:4840` lauscht auf Unicast. Die Adresse eines Tags ist `<DataSetWriterId>/<field index>`, die Position des Felds im DataSet des Publishers, ab 0 gezählt: `1000/3` ist das vierte Feld, das Writer 1000 veröffentlicht. UADP trägt keine Feldnamen (sie liegen in einem DataSetMetaData, das der Publisher auf anderem Weg bereitstellt oder gar nicht), die Position ist also das, was ein Datagramm sagen kann. Ein Feld, das ein Array ist, wird Element für Element gelesen: `1000/3[17]` ist der achtzehnte Wert des Arrays, das das vierte Feld ist. Browse listet die gehörten Felder mit ihren Typen auf und ein Array als seine Elemente (die ersten 1000).

```json
{"publisherId":"2234","writerGroupId":100,"interface":"eth0","timeoutMs":30000,
 "dataSets":[{"writerId":62541,"types":["Float","UInt16","Boolean","Int32","Double"]}]}
```

- `publisherId` und `writerGroupId` beschränken ein Gerät auf einen Publisher und eine Gruppe. Leer und null nehmen alles. So teilen sich mehrere Geräte eine Adresse: Ein Publisher, der zwei WriterGroups an `udp://:4840` sendet, sind dort zwei Geräte, eines mit `"writerGroupId":1` und eines mit `"writerGroupId":2`.
- Geräte können sich Adresse und Port teilen. HotLoop öffnet dafür einen Socket (einen Beitritt, bei einer Multicast-Gruppe auf einer Karte) und reicht jedes Datagramm an jedes Gerät darauf weiter. Jedes Gerät wendet dann seine eigenen `publisherId`, `writerGroupId` und `dataSets` an, sodass jedes den vollständigen Strom seines Publishers sieht und keiner zwischen Geräten aufgeteilt wird. Der Socket schließt, wenn das letzte Gerät darauf entfernt oder gestoppt wird, und das nächste, das startet, öffnet ihn erneut. Geräte werden über die Adresse wie geschrieben zugeordnet: `udp://:4840`, `udp://0.0.0.0:4840` und `udp://[::]:4840` sind für HotLoop drei Adressen, und ob sie nebeneinander bestehen können, hängt wie immer vom Betriebssystem ab. Eine Multicast-Gruppe, der auf zwei verschiedenen Karten beigetreten wird, sind zwei Sockets. Für ein Gerät, das allein an seiner Adresse ist, ändert sich nichts.
- Gruppe, Port und Karte gehören dem Gerät: Nichts ist in HotLoop fest verdrahtet. `udp://239.192.0.1:4850` mit `"interface":"eth0"` tritt dieser Gruppe auf dieser Karte bei, und `udp://127.0.0.1:4842` lauscht auf einen Publisher auf derselben Maschine. Mehrere Geräte können gleichzeitig auf verschiedenen Gruppen und Ports lauschen oder auf derselben.
- `interface` ist die Netzwerkkarte, auf der einer Multicast-Gruppe beigetreten wird, per Name (`eth0`, `lo`) oder über eine ihrer IPv4-Adressen (`127.0.0.1`). Eine Maschine mit mehr als einer Karte braucht es. Ein Publisher auf derselben Maschine, der per Loopback an eine Gruppe sendet (`IP_MULTICAST_IF` 127.0.0.1, TTL 0, Loopback an, keine Route), wird von einem Gerät mit `"interface":"lo"` oder `"127.0.0.1"` gehört; ohne genannte Schnittstelle und ohne Route schlägt der Beitritt mit `no such device` fehl und sagt das.
- `dataSets` gilt nur für RawData, das keine Typen auf der Leitung trägt: die Feldtypen des Publishers, in Reihenfolge, damit die Bytes gelesen werden können. Variant- und DataValue-Nachrichten tragen ihre eigenen. Jeder Eintrag ist ein Typname (`"Float"`) und kann auch angeben, wie ein Block von Werten angeordnet ist: `"Float*250"` sind 250 Felder hintereinander ohne vorangestellte Länge, so schreibt es eine SPS, die einen Block REALs als einzelne Felder sendet; `"Float[250]"` ist ein Array-Feld mit höchstens 250 Werten, so geschrieben, wie der OPC-Foundation-Stack ein RawData-Array schreibt (ein Int32-Zähler, die Werte und Nullauffüllung bis 250); und `"String(40)"` ist ein auf 40 Bytes aufgefüllter String, allein oder als `"String(40)[4]"`.
- Key Frames ersetzen die Felder eines DataSets; Delta Frames ändern die, die sie nennen; Keep Alives belegen, dass der Publisher lebt. Eine verlorene Nachricht (eine Lücke in den Sequenznummern) markiert die Tags dieses DataSetWriters bis zu seinem nächsten Key Frame als **unsicher**, da ein Delta mit ihr verloren gegangen sein kann. Eine Änderung der Konfigurationsversion des DataSets lässt alle Felder vergessen, bis ein Key Frame sagt, was sie jetzt bedeuten.
- Ein Writer, der `timeoutMs` lang schweigt (30 Sekunden, wenn nicht gesetzt), wird **schlecht** gelesen, mit dieser Angabe, und ein Gerät, von dessen Publisher innerhalb des Timeouts nichts gehört wurde, ist ausgefallen. Ein Feld, das der Publisher als Bad markiert, ist schlecht, und eines, das er als Uncertain markiert, ist unsicher; der Grund ist der Statuscode.
- Die Zeit der Messung ist die des Publishers, aus dem Feld, der DataSetMessage oder der NetworkMessage, wenn sie gesetzt ist und nicht mehr als eine Minute dieser Uhr voraus liegt, andernfalls die Ankunftszeit.
- Arrays werden in Variant- und DataValue-Nachrichten gelesen (ein Int32-Zähler und die Werte, OPC 10000-6 5.2.2.16; ein mehrdimensionales kommt flach, Zeile für Zeile) und, mit einem Layout, in RawData. Ein Zähler, den das Datagramm nicht fassen kann, wird abgelehnt, bevor dafür irgendetwas angelegt wird.
- Nur lesend. Nachrichtensicherheit (signierte oder verschlüsselte NetworkMessages), fragmentierte Nachrichten, Discovery-Nachrichten, Ereignisse und Strukturfelder werden nicht unterstützt; ein Datagramm mit einem davon wird abgelehnt, nach Grund gezählt und nie erraten.

**Veröffentlichen.** Aus, bis `HOTLOOP_UADP_PUBLISH_ENABLED` gesetzt ist, in Edge und Gateway (den Produkten mit dem OPC-UA-Server). Es sendet die Tags, die ein Layout nennt:

```json
{"dataSets":[{"writerId":1,"name":"press","configMajor":1,"fields":[
  {"device":"press-01","tag":"Zone1_Temp","type":"Float"},
  {"device":"press-01","tag":"Cycle","type":"UInt32"}]}]}
```

| Variable | Standard | <span class="sr-only">Details</span> |
|---|---|---|
| `HOTLOOP_UADP_PUBLISH_ADDRESS` | | `udp://239.0.0.1:4840` für eine Multicast-Gruppe, `udp://host:4840` für einen einzelnen Abonnenten |
| `HOTLOOP_UADP_PUBLISH_LAYOUT_FILE` oder `_LAYOUT` | | das Layout von oben, als Datei oder inline (die Datei gewinnt) |
| `HOTLOOP_UADP_PUBLISH_PUBLISHER_ID` | `1` | eine Zahl oder ein Text |
| `HOTLOOP_UADP_PUBLISH_WRITER_GROUP_ID` | `1` | |
| `HOTLOOP_UADP_PUBLISH_INTERVAL` | `1s` | |
| `HOTLOOP_UADP_PUBLISH_KEY_FRAME_EVERY` | `10` | höchstens so viele Intervalle zwischen Key Frames |
| `HOTLOOP_UADP_PUBLISH_DATAVALUE` | `false` | DataValue-Felder (Wert, Status, Zeit) statt Variants |
| `HOTLOOP_UADP_PUBLISH_DELTA_FRAMES` | `false` | ein DataSet, das sich geändert hat, geht zwischen Key Frames als Delta Frame hinaus (nur die geänderten Felder) |
| `HOTLOOP_UADP_PUBLISH_METADATA_EVERY` | `10` | die Feldnamen und Typen jedes DataSets werden alle so viele Intervalle angekündigt; `0` sendet keine |
| `HOTLOOP_UADP_PUBLISH_INTERFACE`, `_TTL` | die des Systems, `1` | die Karte, über die Multicast hinausgeht, und sein Hop-Limit |

Jedes DataSet geht über seinen eigenen DataSetWriter hinaus, je eine NetworkMessage. Ein DataSet, dessen Werte sich geändert haben, geht als Key Frame hinaus (jedes Feld), eines, das sich nicht geändert hat, als Keep Alive, und ein Key Frame mindestens alle `KEY_FRAME_EVERY` Intervalle, damit ein spät beigetretener Subscriber konvergiert. Ein Key Frame ist vollständig, ein verlorenes Datagramm kostet also ein Intervall und keinen falschen Wert. Mit `HOTLOOP_UADP_PUBLISH_DELTA_FRAMES=true` geht ein DataSet, das sich geändert hat, stattdessen als Delta Frame hinaus, der nur die seit der letzten Nachricht geänderten Felder und ihre Positionen trägt, und der Key Frame kommt weiterhin mindestens alle `KEY_FRAME_EVERY` Intervalle; ein verlorenes Delta kostet dann bis zu so viele Intervalle mit einem veralteten Feld, das ist der Preis einer kleineren Nachricht auf einer langsamen Verbindung. Der eigene Subscriber von HotLoop liest Delta Frames. value. Ein schlechtes Tag wird als sein Status veröffentlicht und nie als sein letzter Wert; eines, von dem noch nichts gelesen wurde, als `BadWaitingForInitialData`. Werte werden auf ihren veröffentlichten Typ begrenzt, nicht umgebrochen. Nachrichtensicherheit wird nicht unterstützt, das gehört also in ein Netz, dem das Werk vertraut. Die Tags desselben Layouts kann der eigene Subscriber von HotLoop auf einer anderen Maschine lesen.

**Was bewiesen wurde.** Ein unabhängiger OPC-UA-PubSub-Stack veröffentlicht an den Subscriber von HotLoop und abonniert den Publisher von HotLoop per Multicast, und der Publisher von HotLoop wird vom eigenen Subscriber von HotLoop korrekt gelesen. **Nachrichtensicherheit.** Ein Subscriber-Gerät kann verlangen, dass die NetworkMessages seines Publishers signiert oder signiert und verschlüsselt sind (OPC 10000-14 7.2.4.4.3), mit den beiden Richtlinien, die die Spezifikation definiert, `PubSub-Aes128-CTR` und `PubSub-Aes256-CTR`:

```json
{"publisherId":"2234","security":{"mode":"signAndEncrypt","policy":"PubSub-Aes128-CTR",
 "keys":[{"keyId":1,"signingKey":"<64 hex digits>","encryptingKey":"<32 hex digits>","keyNonce":"<8 hex digits>"}]}}
```

Die Schlüssel sind statisch: auf beiden Seiten unter einer SecurityTokenId (`keyId`) gesetzt, in Hex oder Base64. Sie sind Geheimnisse, werden als `[redacted]` angezeigt und beim Speichern beibehalten. Ein Gerät, das zwei Schlüssel hält, nimmt einen Publisher an, der von einem zum anderen wechselt. Bei gesetztem `security` wird eine Nachricht, die nicht signiert ist (oder nicht verschlüsselt, unter `signAndEncrypt`), die mit einem anderen Schlüssel signiert ist oder die unterwegs verändert wurde, abgelehnt und gezählt (`unsecured`, `signature`, `security_key`), bevor irgendetwas darin gelesen wird. Ein Security Key Service (GetSecurityKeys, rotierende Schlüssel) ist nicht implementiert. Der Publisher signiert mit `HOTLOOP_UADP_PUBLISH_SECURITY_MODE` (`sign` oder `signAndEncrypt`), `_POLICY`, `_KEY_ID`, `_SIGNING_KEY`, `_ENCRYPTING_KEY` und `_KEY_NONCE`.

**Metadaten und Discovery.** Ein Publisher kündigt an, wie seine DataSets heißen und woraus sie bestehen, als Discovery-Antwort mit einem DataSetMetaData, in Chunks, wenn sie groß ist (7.2.4.4.4, 7.2.4.6). Ein Subscriber-Gerät liest sie: Die Felder werden in Browse benannt (`writer1001_<field name>`), ein RawData-DataSet braucht keine `dataSets`-Typen in der Konfiguration, weil die Metadaten es auslegen, und ein DataSet, das seine Konfigurationsversion ändert, beginnt mit seinem nächsten Key Frame von vorn. Die `dataSets` der Konfiguration gelten weiterhin, wenn beide da sind. Die Discovery-Anfrage eines Subscribers wird nicht gesendet, und ein Publisher beantwortet keine.

**Strukturfelder, Ereignisse.** Ein Feld, das laut Metadaten eine Struktur ist, wird als seine Member gelesen, die ein Tag als `1001/0.Value` adressiert (und `1001/7[2].Angle` für ein Element eines Arrays von Strukturen); eine in einem Variant gesendete Struktur wird gelesen, wenn die Metadaten sie beschreiben. Strukturen mit optionalen Feldern und Unions werden namentlich gemeldet, nicht geraten. Eine Event-DataSetMessage wird wie die Felder angewandt, die sie trägt, und lässt den Rest in Ruhe (`Events` in den Statistiken des Geräts); ihr Layout ist das eines Key Frames (7.2.4.5.7), aus der Spezifikation gelesen und nicht gegen einen anderen Stack geprüft. Manche Publisher schreiben einen FieldCount vor einen RawData-Key-Frame, was die Spezifikation nicht tut; dem Gerät wird das mit `"rawFieldCount":true` gesagt.

### CODESYS

Eine SPS, die eine CODESYS-Control-Runtime ausführt (Linux SL, ARM64, Raspberry Pi, Windows, die virtuelle SPS), gelesen und beschrieben über die Namen, die ihr Programmierer den Variablen gegeben hat: `Application.GVL_Line.rTemp`, nicht eine Knoten-ID. Es ist der OPC-UA-Treiber mit dem, was eine CODESYS-SPS zusätzlich braucht, sodass alles unter [OPC UA: Sicherheit und Zugangsdaten](#opc-ua-sicherheit-und-zugangsdaten) für ihn gilt und seine Optionen diese Optionen sind.

**Die eigenen Alarme der SPS.** Ein Projekt mit einer Alarm Configuration hält seine Alarme im Alarm Manager der SPS. Mit dem Block der Bibliothek HotLoop Alarms im Projekt (siehe CODESYS alarms) zeigt HotLoop diese Alarme in seiner Alarmliste, ab dem Moment, in dem das Gerät verbunden ist, und eine in HotLoop vorgenommene Quittierung geht an den Alarm Manager zurück. Live gegen eine echte CODESYS-Control-for-Linux-SL-4.22.0.0-Runtime verifiziert: Auslösen, Quittieren, Zurücksetzen und Bestätigen. Die eigenen Textlisten des Alarm Managers und eine andere Klasse als die beiden erprobten sind nicht verifiziert.

**Warum der OPC-UA-Server, und was das für die SPS bedeutet.** CODESYS dokumentiert einen einzigen Weg, wie ein Dritter die Variablen eines Controllers lesen kann, und das ist der OPC-UA-Server der Runtime selbst: Die Symbol Configuration der Anwendung (oder, ab CODESYS 3.5 SP18, ein IEC Symbol Set unter dem Communication Manager) sagt, welche Variablen mit welchem Zugriff veröffentlicht werden, und der Server stellt sie bereit. Das Kanalprotokoll des CODESYS Gateways ist für Dritte nicht dokumentiert, und dieser Treiber spricht es nicht. Die SPS muss also veröffentlichen, was Sie sehen wollen:

1. Fügen Sie in der IDE der Anwendung eine **Symbol Configuration** hinzu, mit eingeschaltetem *Support OPC UA features*, und haken Sie die Variablen an, oder markieren Sie sie in der Deklaration mit `{attribute 'symbol' := 'readwrite'}` (`'read'` für nur lesend).
2. Laden Sie herunter. Eine SPS ohne Symbol Configuration beantwortet die Einrichtung mit einer Meldung, die sagt, dass eine hinzugefügt werden muss.
3. Eine Variable ist von HotLoop aus nur beschreibbar, wenn ihr Symbol `readwrite` ist und der Benutzer, als der sie verbindet, sie schreiben darf (die *Symbol Rights* des Geräts). HotLoop liest die Zugriffsstufe und sagt, welches von beiden einen Schreibvorgang abgelehnt hat.

Quellen: [CODESYS help, Symbol Configuration](https://content.helpme-codesys.com/en/CODESYS%20Communication/_cds_symbolconfiguration.html) und [IEC Symbol Set](https://content.helpme-codesys.com/en/CODESYS%20Communication/_comm_symbol_configuration.html) (der Symbolname ist `<application>.<POU>.<variable>`, der Zugriff ist Lesen, Schreiben oder Ausführen pro Symbol, die Rechte der Gruppen stehen im Reiter Symbol Rights des Geräts, und OPC UA braucht ein Zertifikat auf dem Controller); das [PLCopen OPC UA information model for IEC 61131-3](https://plcopen.org/system/files/downloads/plcopen_opc_ua_information_model_for_iec61131-3_version1.02.pdf) (Version 1.02, das Layout unten); OPC UA Part 5 (OperationLimits). Die Knoten-IDs sind die, die eine 4.22.0.0-Runtime beantwortet hat, gegen die dieser Treiber geschrieben wurde; die genaue Schreibweise von `|var|` ist die der Runtime, kein veröffentlichter Vertrag, weshalb ein Tag über das Symbol adressiert wird und der Treiber die Knoten-ID baut.

**Layout.** Die Runtime veröffentlicht im `DeviceSet` von OPC UA Device Integration ein Gerät für die SPS, darunter `Resources` und darunter die Anwendung, mit `GlobalVars` (den Variablenlisten) und `Programs` darunter. Der Knoten einer Variablen ist `ns=<n>;s=|var|<device>.<application>.<list or program>.<variable>` im Namespace `CODESYSSPV3/3S/IecVarAccess`. Der Treiber findet Gerät und Anwendung durch Browsen, sodass ein Tag überlebt, wenn das Projekt umbenannt wird.

**Adressen.** Ein IEC-Symbol, mit oder ohne die Anwendung:

```
Application.GVL_Line.rTemp        a variable of a variable list
GVL_Line.rTemp                    the same; the application is assumed
Application.PLC_PRG.nCount        a program's variable
GVL.motors[2].speed               a field of an element of an array of structures
nsu=CODESYSSPV3/3S/IecVarAccess;s=|var|CODESYS Control for Linux SL.Application.GVL.x
                                  a node id, if you have one
```

**Tags entdecken** listet auf, was die Anwendung exportiert, mit den Typen, die sie hat: Ein STRING ist `string`, ein BYTE `uint16`, eine TIME `int64` (Millisekunden), eine Aufzählung `int32`, die Ganzzahlbreiten behalten ihre, REAL und LREAL sind `float`. Die Runtime sagt, dass ein STRING, BYTE oder eine TIME ein Typ des PLCopen-Modells ist (zum Beispiel `ns=3;i=3013`); der Treiber folgt seinen `HasSubtype`-Referenzen bis zum Standardtyp, von dem er eine Art ist, wodurch auch ein Schreibvorgang auf ein BYTE als Byte gesendet wird. Jede Variable trägt den Zugriff, den ihr Symbol bekommen hat. Eine Struktur und ein Array werden durchlaufen: ein Punkt pro Feld und pro Element. Er lässt die eigenen Eigenschaften der Runtime (`|vprop|`), die Taskliste und das Server-Objekt weg.

Ein Array listet seine ersten 32 Elemente (`arrayElements`), weil ein Puffer mit tausend Elementen nicht tausend Dinge für ein Dashboard ist und ein Tag ohnehin jedes Element über sein Symbol adressieren kann. Die Liste endet bei `browseMaxNodes` und sagt das; `browseRoot` auf ein Symbol gesetzt (`Application.GVL_Demo`) listet einen Teil der Anwendung. Das Browsen erfolgt breitenorientiert, sodass die Variablen einer Liste vor den Elementen ihrer Arrays kommen, und die Antworten werden auf eine Größe begrenzt, die die Runtime akzeptiert (sie schließt die Verbindung bei einer Antwort aus hundert Arrays mit tausend Elementen).

Konfiguration: die OPC-UA-Optionen, und `device` (der Name der SPS, nur wenn die Runtime mehr als eine auflistet), `application` (nur wenn keine Application heißt), `arrayElements`, `alarmSymbol` (der Block HotLoop Alarms, nur um seine Suche zu überspringen). Eine falsch geschriebene Option ist ein Fehler, der die gültigen auflistet. Das Passwort ist ein Geheimnis, gespeichert und geschwärzt wie jedes Gerätegeheimnis.

**Was die Runtime von einem Client verlangt.** Sie veröffentlicht `OperationLimits` von 100 für Lesevorgänge, Browses und überwachte Elemente pro Anfrage und lehnt eine größere mit `BadTooManyOperations` ab. Der Treiber liest diese Limits beim Verbinden und schneidet jede Anfrage darauf zu, für jedes OPC-UA-Gerät (eine CODESYS-Runtime war die erste, bei der das wichtig wurde: Davor meldete der Treiber jeden entdeckten Tag als float und las keinen der Tags eines Geräts mit mehr als 100). Das Sampling steht standardmäßig auf einer Sekunde und die Queue auf einem Element, weil eine SPS einen Zyklus einzuhalten hat und ein Ignition-Gateway, das sie schon liest, sie nicht weggenommen bekommen soll; setzen Sie `samplingIntervalMs`, um mehr anzufordern.

**Downloads, Neustarts und eine verlorene Verbindung.** Ein Neustart der Runtime oder ein neu geladenes Programm beendet die Sitzung. Das Gerät wird getrennt, jeder Tag wird mit dem Grund "die Runtime der SPS antwortet nicht" als schlecht gelesen, und HotLoop verbindet sich von selbst mit Backoff neu und liest die Symbole, wie sie jetzt sind. Ein Symbol, das gelesen wurde und zweimal hintereinander als verschwunden abgelehnt wird, gilt als Download, bei dem die Runtime die Sitzung behalten hat, und die Sitzung wird für dieselbe Wiederverbindung aufgegeben. Ein Tag für eine Variable, die das Programm nicht hat, wird mit dem Grund des Servers als schlecht gelesen und löst keine Wiederverbindung aus.

**Den OPC-UA-Server der Runtime absichern.** Eine CODESYS-Control-Runtime bietet nur ungesicherte Endpoints an, bis ihr OPC-UA-Server ein Zertifikat hat, und dann auch die Richtlinien ihrer `CommunicationPolicy` (standardmäßig AES128-SHA256-RSAOAEP, Basic256Sha256, AES256-SHA256-RSAPSS) mit Sign und SignAndEncrypt. CODESYS dokumentiert, wie man dieses Zertifikat im Security Screen erstellt (CODESYS Security Agent, Devices, der Controller, OPC UA Server) und einem Client vertraut, indem man sein Zertifikat von "Certificates in Quarantine" nach "Trusted Certificates" verschiebt. Die PLC-Shell der Linux-Runtime tut dasselbe ohne die IDE, mit Befehlen, die CODESYS für die PLC-Shell des Geräteeditors auflistet (`cert-getapplist`, `cert-genselfsigned <n>`, `cert-getcertlist quarantine`, `cert-export`, `cert-import trusted`), über den Unix-Socket, den die Linux-Runtime dafür dokumentiert (`/var/opt/codesyscontrolapi/plcshell.sock`, "Accessing the PLC Shell"). Stellen Sie das Gerät auf `securityMode` `SignAndEncrypt` mit einer `securityPolicy`, verbinden Sie einmal (das eigene Zertifikat von HotLoop landet in der Quarantäne der Runtime, und die Verbindung wird mit einer Meldung abgelehnt, die das sagt), vertrauen Sie diesem Zertifikat, und das Gerät liest. Nicht gezeigt: der Security Screen der IDE, ein von einer CA signiertes Zertifikat, Benutzerverwaltung mit einer gesicherten Runtime.

**Eine Runtime ohne Lizenz stoppt sich selbst.** Eine CODESYS-Control-Runtime ohne Lizenz läuft im Demomodus und fährt nach etwa zwei Stunden herunter (das Log der Runtime sagt bei jedem Start `no runtime license - running in demo mode(~2 hours)`). Von der Seite von HotLoop aus ist das ein Neustart der Runtime wie jeder andere: Das Gerät wird getrennt mit "die Runtime der SPS antwortet nicht" und kommt von selbst zurück, sobald etwas die Runtime wieder startet (die Neustartrichtlinie eines Containers, eine systemd-Unit). Nichts in HotLoop zählt die zwei Stunden oder behandelt das Stoppen anders, und nichts startet die Runtime für Sie neu; eine Runtime, die nicht wieder gestartet wird, bleibt getrennt. Ausgeführt gegen eine 4.22.0.0-Runtime in einem Container ohne Lizenz: Sie stoppte sich selbst 2 Stunden 5 Minuten nach dem Start, mit Exit-Code 0; die Neustartrichtlinie des Containers startete sie 31 Sekunden später erneut, ihre Anwendung lief 82 Sekunden danach, und das Gerät las 35 Sekunden nach dem Start der Anwendung wieder gut (2 Minuten 28 Sekunden nach dem Stopp), ohne Handgriff.

**Schreibvorgänge.** Ein Tag ist nur lesend, bis jemand ihn als beschreibbar markiert, wie bei jedem Gerät, und nichts, was eine Einrichtung anlegt, ist es. Dann gilt das Schreibtor wie bei OPC UA, mit dem Teil der SPS davor: Ein Schreibvorgang auf ein Symbol, das nur lesend exportiert ist oder das der Benutzer nicht schreiben darf, wird in den Worten der SPS abgelehnt und nie gesendet.

**Einrichtung über den Integrationsablauf** (`codesys`): die Adresse der Runtime, die OPC-UA-Sicherheitsfragen und optional ein erstes Dashboard der gespeicherten Punkte (die Ansicht, die WebVisu gewesen wäre; siehe [Integrationen](/de/iot/integrations/#codesys)). Verifiziert gegen eine 4.22.0.0-Runtime in einem Container; siehe die Statustabelle dafür, was das nicht abdeckt.

### Modbus TCP/RTU

Das Arbeitstier von 1979. SPSen, Frequenzumrichter, Energiezähler, RTUs und der Rückfall jedes Gateways, das nichts Besseres hat.

```
holding:100:float32:CDAB    a float across registers 100-101, word-swapped
holding:40:bit3             bit 3 of register 40
holding:200:string16        16 characters from register 200
input:12:int16              a signed input register
coil:5                      a single coil
```

**Die Wortreihenfolge** ist die Einstellung, die man am häufigsten falsch macht, und ein mit falscher Reihenfolge gelesener float ist auf einem Bildschirm nicht offensichtlich falsch, sondern eine plausible Zahl, die nicht der Wahrheit entspricht. Alle vier Permutationen werden unter den Namen unterstützt, die die Herstellerhandbücher drucken: `ABCD`, `CDAB`, `BADC`, `DCBA`. Setzen Sie einen Gerätestandard mit `byteOrder` und überschreiben Sie ihn pro Tag mit dem vierten Adressfeld.

**Die Adressierung** ist roh und nullbasiert. Wenn Ihre Zeichnungen die traditionelle Nummerierung im Stil von 40001 verwenden, setzen Sie `oneBased: true` und schreiben Sie die Nummern aus den Zeichnungen. Um eins daneben zu liegen, ist der älteste Modbus-Fehler überhaupt.

Lesevorgänge werden zu Blöcken zusammengefasst: benachbarte und fast benachbarte Register werden zu einer Anfrage. `maxGap` steuert, wie viele ungenutzte Register sich zu lesen lohnen, um einen zweiten Round Trip zu vermeiden (Standard 8), `maxBlock` begrenzt eine einzelne Anfrage (Standard 120, Protokollgrenze 125).

Das Schreiben eines einzelnen Bits eines Holding-Registers ist ein Read-Modify-Write, weil Modbus dort kein atomares Bit-Setzen kennt. Die anderen fünfzehn Bits bleiben erhalten.

### MQTT und Sparkplug B

Einfaches MQTT oder Sparkplug B als **vollständige primäre Host-Anwendung**.

Einfache Topics:
```
mqtt:plant/line1/temperature              a scalar payload
mqtt:plant/line1/state|data.temperature   JSON, extracted by path
mqtt:plant/+/flow                         wildcards work
```

Sparkplug-Metriken:
```
spb:GroupId|EdgeNodeId|DeviceId|Metric/Name
spb:Plant|Edge1||Node/Uptime               empty device = a node-level metric
```

Als primärer Host tut der Treiber, was die Spezifikation verlangt und die meisten Integrationen auslassen:

- Veröffentlicht eine retained `STATE`-Geburt mit passendem Will, damit Edge-Nodes den Ausfall des Hosts sehen, statt ihn aus einem Timeout zu erschließen. Standardmäßig die Sparkplug-3.0-Form (`spBv1.0/STATE/<host>` mit JSON); setzen Sie `legacyState` für die String-Form `ONLINE`/`OFFLINE` vor 3.0.
- Verfolgt die laufende Sequenznummer jedes Nodes und bittet einen Node um einen Rebirth, wenn er eine überspringt, weil eine Lücke bedeutet, dass Nachrichten verpasst wurden und der Alias-Tabelle nicht mehr zu trauen ist.
- Fordert nach seiner eigenen Wiederverbindung einen Rebirth an. Ein Host, der weg war, hat keine Ahnung, was sich geändert hat, während er fort war.
- Ordnet `NDEATH` über `bdSeq` dem `NBIRTH` zu, sodass ein Todeszertifikat, das von einer früheren Sitzung übrig ist, die aktuelle nicht beenden kann.

Die Nachrichtenreihenfolge wird erzwungen. Das gleichzeitige Zustellen von Sparkplug-Nachrichten ordnet sie um, was einen gesunden Node aussehen lässt, als verliere er Nachrichten, und einen Rebirth-Sturm auslöst.

### EtherNet/IP (CIP)

Allen-Bradley ControlLogix, CompactLogix und Micro820. Tags haben Namen, sodass der Controller gefragt werden kann, was er enthält.

```
Temperature                    type from the tag's declared dataType
Speed:dint                     an explicit type wins
Program:MainProgram.Speed      a program-scoped tag, the colon is part of the path
Zones[0].Heater.On:bool        array elements and UDT members
```

CIP ist stark typisiert, und der Controller lehnt einen Lesevorgang ab, dessen deklarierter Typ nicht passt, sodass der Typ von irgendwoher kommen muss. Er wird dem `dataType` des Tags entnommen oder einem Suffix `:type`, das Vorrang hat. Unbekanntes fällt auf `REAL` zurück, was die meisten Prozesswerte sind.

Lesevorgänge werden zu Multi-Service-Anfragen gebündelt und fallen auf einzelne Lesevorgänge zurück, wenn ein Bündel scheitert, damit ein fehlerhafter Tag-Pfad nicht die anderen neunzehn blind macht.

### S7comm

Siemens S7-300, 400, 1200 und 1500, über ISO-on-TCP nach Rack und Slot.

```
db1:0:real        a REAL at DB1.DBD0
db1:4:dint        a DINT at DB1.DBD4
db1:8.3:bool      bit 3 of DB1.DBB8
db2:20:string32   a 32-character STRING
m:10:word         merker word MW10
i:0.1:bool        input I0.1
q:2:byte          output byte QB2
```

Der Typ ist für alles erforderlich, was breiter als ein Byte ist. Das Protokoll kann nicht sagen, ob vier Bytes ein REAL oder ein DINT sind, das ist eine Tatsache über das SPS-Programm, nicht über die Leitung.

Standard ist Rack 0, Slot 1 (S7-1200/1500). S7-300/400 sind meist Slot 2. `connectType` ist standardmäßig 3 (S7 Basic), damit das Gateway nicht den PG-Verbindungsslot belegt, den ein Ingenieur für TIA Portal haben möchte.

Es gibt kein Browsen. Eine S7-CPU veröffentlicht nicht das Layout ihrer Datenbausteine, das liegt im TIA-Portal-Projekt.

### MTConnect

Nur lesende Telemetrie von Werkzeugmaschinen. MTConnect hat keinen Befehlskanal, und dieser Treiber tut nicht so, als wäre es anders.

Adressieren Sie über `dataItemId` oder über den Namen; Agents sind uneinheitlich darin, welches stabil ist, und die Maschinendokumentation zeigt das eine oder das andere.

Zwei Details, die eine funktionierende Integration von einer bloß plausiblen trennen: `UNAVAILABLE` ist der Agent, der ausdrücklich sagt, dass er keinen Messwert hat; es wird zu schlechter Qualität, nicht zum Text "UNAVAILABLE" und nicht zu null. Und die Bedeutung einer Condition ist ihr Elementname (`Normal`, `Warning`, `Fault`, `Unavailable`), nicht ihre Zeichendaten, die meist leer sind.

`Browse` liest `/probe` und durchläuft den Komponentenbaum in beliebiger Tiefe.

### HTTP / REST

Der Auffangbehälter, für Energiezähler, Umgebungssensoren, OEM-Controller und die REST-Seite eines Gateways, das darunter etwas Proprietäres spricht.

```
power.kw                      nested fields
readings[0].value             array indexing
zones[name=Zone1].temp        select an array element by a field value
$.data.temperature            a leading $. is accepted
```

Diese dritte Form ist die, auf die es ankommt: Diese APIs liefern gern ein ungeordnetes Array von `{name, value}`-Objekten, und das Indizieren nach Position ist ein Fehler, der auf ein Firmware-Update wartet.

Eine Anfrage bedient jeden Tag am Gerät. `Browse` durchläuft das Dokument und meldet jeden Skalar mit dem Pfad, der zu ihm führt.

### Zustand der Box

Die Maschine, auf der HotLoop läuft, als schreibgeschütztes Gerät: `cpu_util_pct` (nicht im Leerlauf verbrachte CPU-Zeit seit dem letzten Lesen), `mem_util_pct` (MemTotal gegenüber MemAvailable), `disk_util_pct` (die Platte der Maschine, ein statfs der schreibgeschützt in `diskPath` eingehängten Wurzel des Hosts, standardmäßig `/host`), `data_util_pct` (das Volume unter `dataPath`, `/data`, oder der nächste darüberliegende vorhandene Ordner, wenn dort noch nichts eingehängt ist), und `rtos_jitter_core1_us` bis `core3_us`, wenn `jitterFile` die JSON-Datei `{"core1_us":3.2,"core2_us":2.9,"core3_us":4.1}` nennt, die ein Echtzeit-Agent neu schreibt (eine Datei, die älter als fünf Minuten ist, liest sich als schlecht). CPU und Speicher kommen aus `procRoot` (`/proc`, oder `/host/proc`, wenn das des Hosts eingehängt ist). Ein Wert, der nicht gelesen werden kann, hat schlechte Qualität mit dem Grund, nie null. Das Gerät wird von `HOTLOOP_BOX_HEALTH_NODE` angelegt ([Der OPC-UA-Server](/de/edge/opc-ua-server/#gerätezustand-für-das-embernet-dashboard)).

### Shelly

Ein Shelly jeder Generation, mit dem direkt gesprochen wird, ohne Broker dazwischen. Siehe SHELLY.md. Fügen Sie ein Gerät mit dem Protokoll `shelly` und der Adresse des Geräts hinzu; hat es ein Login, `{"password":"..."}` (der Benutzer ist `admin`; ein Gerät ab Gen2 wird mit seiner SHA-256-Digest-Challenge beantwortet, ein Gen1-Gerät mit Basic). `/shelly` sagt, welche Generation es ist. Ein Gen2-, Gen3- oder Gen4-Gerät wird mit `Shelly.GetStatus` (`POST /rpc`) gelesen, und jede Komponente, die es meldet, wird zu Tags, die sich selbst hinzufügen, schreibgeschützt, bis eine Person sie scharf macht: `switch:0.output`, `switch:0.apower`, `switch:0.aenergy.total`, `switch:0.temperature.tC`, `input:0.state`, `cover:0.current_pos`, `pm1:0.apower`, `em:0.total_act_power`, `temperature:100.tC`, `humidity:100.rh`, sowie `sys.uptime` und `wifi.rssi` des Geräts. Ein Feld, das das Gerät nicht gesendet hat, wird kein Tag. Der Ausgang eines Switches (`Switch.Set`), Ausgang und Helligkeit eines Lichts, die Position einer Abdeckung (`Cover.GoToPosition`) und der Sollwert eines Thermostats können zum Schreiben scharf gemacht werden.

Ein Gerät ab Gen2 bekommt außerdem einen Websocket (`ws://<device>/rpc`): Der Treiber sendet einen Anfrage-Frame mit einem `src`, wie es die Seite zum RPC-Kanal von Shelly verlangt, bevor ein Gerät benachrichtigt, beantwortet einen 401-Frame mit dem dokumentierten `auth`-Objekt (SHA-256 über `dummy_method:dummy_uri`) und faltet `NotifyStatus` und `NotifyFullStatus` in seine Kopie des Status ein, sodass eine Änderung sofort das Tag erreicht und die Abfrage dazwischen die Kopie statt des Geräts liest. `NotifyEvent` (ein Tastendruck, eine Konfigurationsänderung) wird im Logbuch unter dem Gerät abgelegt. Wenn der Websocket unten ist oder den Status in letzter Zeit nicht bestätigt hat (45 Sekunden ohne Frame oder Pong, 2 Minuten ohne vollständiges Lesen), liest die Abfrage das Gerät über HTTP.

Ein Gen1-Gerät (`/status` und einfache GET-Steuerpfade, Basic-Login) bekommt aus seinen eigenen Worten dieselbe Form von Tags: `relay:0.output`, `meter:0.power`, `meter:0.total` (Wattminuten umgerechnet in Wh), `light:0.output` und `.brightness`, `roller:0.current_pos`, `input:0.state`, `temperature:0.tC`, und für Energiezähler und Sensoren `emeter:0.power`, `humidity:0.rh`, `flood:0.alarm`. Ein Relais wird mit `/relay/<id>?turn=on|off` geschrieben, ein Licht mit `/light/<id>?turn=&brightness=`, ein Rollladen mit `/roller/<id>?go=to_pos&roller_pos=`. Gebaut aus der veröffentlichten Shelly-Dokumentation für Gen1 und Gen2 und getestet gegen Aufzeichnungen echter Geräte (ein Plus 1, ein Plug S und eine Vintage-Lampe); noch nicht gegen ein Gerät auf dem Prüfstand. Die Felder für Energiezähler, Feuchte, Batterie und Wasser bei Gen1 stammen aus der Dokumentation und haben keine Aufzeichnung dahinter.

### Firmata

Ein Arduino oder jede Platine mit Firmata-Firmware, über USB-Seriell oder TCP, ohne Hostprogramm dazwischen. Siehe FIRMATA.md. Fügen Sie ein Gerät mit dem Protokoll `firmata` und dem seriellen Port (`/dev/ttyACM0`, `serial:/dev/ttyUSB0`) oder `host:port` hinzu; Optionen `{"baudRate":57600,"samplingMs":19,"bootWaitMs":5000}`. Der Treiber wartet auf die Protokollversion der Platine (er fragt alle 300 ms), fragt ihre Firmware, ihre Fähigkeiten und ihre Analogzuordnung ab und legt für jeden digitalen Pin und analogen Eingang der Platine ein schreibgeschütztes Tag an. Die Adresse eines Tags sagt, was mit einem Pin geschehen soll: `D13`, `D2:in`, `D2:pullup`, `D13:out`, `D9:pwm`, `D10:servo`, `A0`, `I2C:0x48:0x00:2`. Der digitale Eingang ist der Port-Report, den die Platine bei einer Änderung sendet, der analoge ist der Report in jedem Abtastintervall, und jede Abfrage fragt die Protokollversion ab, sodass eine verschwundene Platine innerhalb einer Abfrage auffällt; ein unaufgefordert eintreffender Firmware-Report ist eine Platine, die neu gestartet hat. Ein Pin, den die Tags nicht erwähnen, wird nicht angefasst, und ein einfaches `D<n>`-Tag setzt seinen Pin auf Eingang, wenn der Treiber sich verbindet, und beim ersten Schreiben auf Ausgang. Gebaut nach Protokoll 2.8.0 (protocol.md und i2c.md in github.com/firmata/protocol) und gegen StandardFirmata 2.5.9 auf einem simulierten ATmega328P ausgeführt: Seine digitalen Pins, Pull-ups, analogen Eingänge bei 0, 2,5 und 5 V, PWM-Vergleichsregister, der Pin eines Servos und die Register eines I2C-Geräts wurden jeweils vom Chip zurückgelesen, nicht vom Treiber. Nicht auf einer physischen Platine ausgeführt.

### ONVIF

Eine IP-Kamera, ein Encoder oder ein NVR. Siehe ONVIF.md. Fügen Sie ein Gerät mit dem Protokoll `onvif`, der Adresse der Kamera und `{"username":"...","password":"..."}` hinzu. Der Treiber liest zuerst GetSystemDateAndTime und stempelt sein WS-Security-UsernameToken mit der eigenen Uhr der Kamera (Core Specification 5.12: Der Digest ist `base64(SHA-1(nonce + created + password))`), liest GetDeviceInformation und GetServices (GetCapabilities bei einer älteren Kamera), nutzt Media2, wenn die Kamera es auflistet, und Media, wenn nicht, und liest Encoder, Auflösung, Stream-Adresse und Snapshot-Adresse jedes Profils. Eine Kamera, die HTTP Digest oder Basic beim SOAP-Post will, wird damit beantwortet. Dienstadressen werden unter dem Host erreicht, mit dem das Gerät hinzugefügt wurde, außer bei `"keepXAddrHosts":true`. Ein PTZ-Profil fügt `ptz.<token>.pan`, `.tilt`, `.zoom` und `.moving` aus GetStatus hinzu sowie die scharf machbaren Befehle `.move` (ContinuousMove, mit optionalem Timeout), `.absolute` (AbsoluteMove), `.goto_preset` (GotoPreset, per Token oder Name), `.stop` und `.home`. Ereignisse kommen von einem Pull Point (CreatePullPointSubscription, PullMessages, Renew, Unsubscribe) und werden zu Tags `event.<topic>|<source>|<item>`, die sich selbst hinzufügen, mit jeder Änderung im Logbuch. Ein Snapshot ist `GET /api/onvif/<device>/profiles/<token>/snapshot`, und die Erkennung ist `POST /api/onvif/discover` (WS-Discovery, ein Multicast-Probe für `NetworkVideoTransmitter`).

Gebaut nach den Spezifikationen ONVIF Core, Media, Media2, PTZ und Event (onvif.org/specs). Jede Anfrage, die es sendet, ist gegen die WSDL- und XSD-Dateien von ONVIF gültig (xmllint, mit den 33 Typen und einem Element, die libxml2 wegen eindeutiger Partikelzuordnung ablehnt, gelockert, von denen keines in einer Anfrage vorkommt), und es läuft gegen onvif_srvd, einen unabhängigen ONVIF-Stack, der den WS-Security-Header parst, ihn aber nicht prüft, sodass der Digest des Logins stattdessen an dem von zeep 4.3.3 gemessen wird. Der Ereignisdienst und WS-Discovery haben nur nach der Spezifikation geschriebene Skripte, gegen die sie laufen. Nicht auf einer physischen Kamera ausgeführt.

### UniFi Network

Das Anlagennetzwerk als Gerät: ein Standort auf einer UniFi-Konsole, seine Switches, jeder Switch-Port, PoE-Leistung, die WAN-Verbindungen und der Zustand des Standorts, als Tags, die sich selbst anlegen, wenn Geräte adoptiert werden, nur lesend, bis es scharf geschaltet wird. Eine Anmeldung pro Konsole, das Zertifikat angeheftet und das Konsolenpasswort in der Datenbank verschlüsselt. Es ändert die Konsole nur über die wenigen Befehls-Tags, die eine Person scharf schaltet (eine Locate-LED, ein Neustart, ein PoE-Power-Cycle eines Ports; siehe UNIFI.md). Es lauscht außerdem auf den Events-Websocket der Konsole, sodass ein ausfallender Switch im Logbuch steht, wenn es passiert, wobei die Abfrage darunter die Wahrheit bleibt, und der UniFi-Reiter zeichnet die Übersicht, die Karte, die Frontansichten, die Clients, die Netzwerke und das WLAN. Alles dazu steht unter [UniFi Network](/de/iot/unifi/).

### UniFi Protect

Kameras, Sensoren, Lichter und Sirenen eines Protect-NVR, über die Protect Integration API mit einem API-Schlüssel von der Seite Integrations der Konsole (der Schlüssel kommt in `{"apiKey":"..."}`, versiegelt wie ein Konsolenpasswort, und das Zertifikat wird mit `certFingerprint` angeheftet wie bei UniFi Network). Fügen Sie ein Gerät mit dem Protokoll `unifi-protect` und der Adresse der Konsole hinzu. Tags fügen sich selbst hinzu, schreibgeschützt, bis sie scharf gemacht werden: `cam.<id>.online`, `.motion` und `.smart_person`, `.smart_vehicle`, `.smart_package`, `.smart_licensePlate`, `.smart_face` und `.smart_animal` für die Arten, die eine Kamera unterstützt; `sen.<id>.online`, `.open`, `.motion`, `.leak`, `.tamper`, `.temp_c`, `.humidity_pct`, `.light_lux`; `light.<id>.online`, `.on`, `.motion`; `siren.<id>.online`. Bewegung und intelligente Erkennungen einer Kamera kommen vom Events-Websocket der Konsole, da der REST-Datensatz keine hat, also lesen sie sich als schlecht, nie als "keine Bewegung", solange er unten ist. Jedes Ereignis steht im Logbuch unter dem Gerät. Das `.play` einer Sirene ist zum Schreiben scharf gemacht (`true` spielt, `false` stoppt), ebenso `alarm.<trigger>.fire`, das den Webhook des Alarm Managers für die Trigger-ID sendet, die die Person in Protect angelegt hat, sodass ein HotLoop-Alarm, der es schreibt, die Kameras aufzeichnen lässt. Der Snapshot einer Kamera ist `GET /api/unifi-protect/<device>/cameras/<camera>/snapshot`, ein bei Anforderung geholtes JPEG. Gebaut nach dem OpenAPI-Dokument von Ubiquiti für Protect 7.4.102; noch nicht gegen eine Konsole ausgeführt. Siehe [UniFi Network](/de/iot/unifi/#unifi-protect).

### UniFi Access

Die Türen einer Access-Konsole, über die Access-Entwickler-API auf Port 12445 mit einem API-Token aus ihren erweiterten Einstellungen (`{"token":"..."}`, versiegelt). Fügen Sie ein Gerät mit dem Protokoll `unifi-access` und der Adresse der Konsole hinzu. Pro Tür `door.<id>.open` (der Positionssensor; eine Tür ohne einen liest sich als schlecht, nie als geschlossen), `door.<id>.unlocked` (das Schlossrelais) und `door.<id>.unlock`, das eine Person scharf macht und das die Tür entriegelt, wenn `true` geschrieben wird, durch das Schreib-Tor und auditiert wie jeder Schreibzugriff; die Konsole verriegelt sie nach ihrer eigenen Regel wieder. Der Notifications-Websocket hält Position und Schloss zwischen den Abfragen aktuell, und jede Änderung ("1F - Front: opened", "unlocked") steht im Logbuch unter dem Gerät. Gebaut nach der API, wie sie der gepflegte offene Client (py-unifi-access, MIT) spricht; noch nicht gegen eine Konsole ausgeführt. Siehe [UniFi Network](/de/iot/unifi/#unifi-access).

### SNMP

Alles mit einem SNMP-Agent: Switches, USVs, PDUs, Energiezähler und jede Linux-Maschine, die einen SNMP-Agent ausführt. Nur lesend. HotLoop sendet nie ein SNMP SET, weil ein SET die Konfiguration eines Switches ändern kann und der Sinn dieses Treibers darin besteht, das Anlagennetzwerk zu sehen, nicht es zu betreiben.

```
1.3.6.1.2.1.1.5.0             sysName
.1.3.6.1.2.1.1.3.0            sysUpTime, a leading dot is accepted
1.3.6.1.2.1.2.2.1.8.2         ifOperStatus of the interface with ifIndex 2
```

Die Adresse eines Tags ist die OID einer Instanz, durch Punkte getrennte Zahlen. Ein Skalar endet auf `.0`; eine Tabellenzelle endet auf den Index ihrer Zeile. Der `dataType` des Tags entscheidet, was daraus wird:

* Eine Zahl, die der Agent gesendet hat (Integer, Gauge32, Counter32, Counter64, TimeTicks), ist diese Zahl. Skalierung und Offset werden wie überall angewendet.
* Ein OCTET STRING ist Text, es sei denn, der Tag ist eine Zahl, dann wird er geparst. So kommt eine Lastzahl (`laLoad` ist der Text `0.15`) oder eine Temperatur hinter einem Agent an. Text, der keine Zahl ist, ist ein schlechter Messwert, der das sagt, nie null.
* Ein OCTET STRING, der nicht druckbar ist (eine MAC-Adresse), ist `0x` und Hex.

**Zähler sind roh.** Ein Counter32 oder Counter64 steigt nur und läuft über. Der Tag hält, was der Agent gesendet hat, und eine Rate ist Sache dessen, was den Tag liest. Counter64 wird als float gehalten, der bis 2^53 exakt ist; ein Port mit Leitungsgeschwindigkeit braucht Jahrzehnte, um dorthin zu kommen.

**TimeTicks sind Hundertstelsekunden**, sodass `sysUpTime`, als einfacher Tag gelesen, in 1/100 s steht. Die Integration skaliert es für Sie auf Sekunden; ein von Hand angelegter Tag sollte `scale` auf `0.01` setzen.

**Ein Objekt, das der Agent nicht hat, ist ein schlechter Messwert mit Grund**, und die anderen in derselben Anfrage werden trotzdem gelesen: v2c und v3 sagen, welche fehlten, und bei v1, das ein fehlendes Objekt mit einem Fehler für die ganze Anfrage beantwortet, nimmt der Treiber dieses heraus und fragt den Rest erneut an. Eine für den Agent zu große Antwort wird in Hälften erneut angefragt.

Geräteoptionen (`config`):

| Option | Bedeutung |
|---|---|
| `version` | `1`, `2c` oder `3`. Standard `2c` |
| `community` | Die Community für v1 und v2c. Für diese erforderlich, und **es gibt keinen Standard**: `public` ist, wie die Switches einer Anlage von jedem gelesen werden, der fragt. Ein Geheimnis |
| `username` | Der v3-Benutzer |
| `securityLevel` | `noAuthNoPriv`, `authNoPriv` oder `authPriv`. Standard: `authPriv` mit einer Privacy-Passphrase, `authNoPriv` mit nur einer Authentifizierungs-Passphrase, sonst `noAuthNoPriv` |
| `authProtocol` | `MD5`, `SHA`, `SHA224`, `SHA256`, `SHA384` oder `SHA512`. Standard `SHA` |
| `authPassword` | Die Authentifizierungs-Passphrase. Ein Geheimnis |
| `privProtocol` | `DES`, `AES`, `AES192`, `AES256`, `AES192C` oder `AES256C`. Standard `AES` |
| `privPassword` | Die Privacy-Passphrase. Ein Geheimnis |
| `contextName` | Der v3-Kontext. Fast immer leer |
| `transport` | `udp` (Standard) oder `tcp` |
| `retries` | Wie oft eine Anfrage ohne Antwort erneut gesendet wird, 0 bis 10. Standard 1 |
| `maxRepetitions` | Zeilen pro GETBULK bei einem Walk. Standard 10, was die kleinsten Agents beantworten |
| `browseRoots` | OIDs, die beim Entdecken von Punkten durchlaufen werden. Standard: system, die Interface-Tabellen, host resources, die Lasttabelle und die extend-Ausgaben eines SNMP-Agents |
| `browseMaxNodes` | Wo ein Browse aufhört. Standard 2000 |

Die Adresse ist `host` oder `host:port`, standardmäßig Port 161.

**Eine falsche Community bekommt keine Antwort.** Ein SNMPv1- oder v2c-Agent verwirft eine Anfrage mit einer Community, die er nicht kennt, sodass eine falsche Community, ein falscher Port, eine Firewall und ein ausgefallener Agent alle wie ein Timeout aussehen, und die Meldung von HotLoop nennt alle vier. SNMPv3 unterscheidet sie: Eine falsche Passphrase oder ein unbekannter Benutzer wird als solcher abgelehnt (`ErrAuthRejected`), und HotLoop wartet lange, bevor es dieselben Zugangsdaten erneut versucht.

`Browse` durchläuft die Teilbäume, die HotLoop benennen kann, und gibt jedem Objekt einen Namen: den der MIB, wie `sysName`, `ifOperStatus.2`, `ifHCInOctets.2`, `laLoad.1`, oder die OID als `oid.1.3.6.1...` für eines, das es nicht kennt. Die Namen und die dahinterstehenden OIDs, Typen und Einheiten stammen aus den MIBs, die sie definieren: SNMPv2-MIB (RFC 3418), IF-MIB (RFC 2863), HOST-RESOURCES-MIB (RFC 2790) und UCD-SNMP-MIB und NET-SNMP-EXTEND-MIB eines SNMP-Agents. Alles andere, was der Agent hat, lässt sich weiterhin lesen; fügen Sie es per OID als Tag hinzu.

Die Integration (siehe [Integrationen](/de/iot/integrations/#snmp)) übernimmt das Fragen für Sie.

### BACnet/IP

Ein Gebäudeautomations-Controller, ein Zähler, ein Thermostat: alles im IP-Netzwerk, das BACnet spricht. Nur lesend. HotLoop schreibt nie eine BACnet-Eigenschaft, weil ein Schreibvorgang über ein Prioritäts-Array auf einem ansteuerbaren Ausgang landet und eine gesetzt gelassene Priorität die Anlage dort hält, wo sie hingestellt wurde, lange nachdem derjenige, der sie gesetzt hat, nach Hause gegangen ist. Das ist ein Merkmal, das man mit Absicht entwirft, nicht eines, das man herumliegen lässt.

Es wird an Frames gemessen, die von einem echten Gerät aufgezeichnet wurden, dekodiert von Tests, die immer laufen, und im Test an diesem Gerät.

```
analog-input:1                present value of analog input 1
ai:1                          the same, abbreviated
av:3.units                    a property other than the present value, by name
analog-input:1.117            or by number
multi-state-value:2           present value of a multi-state value
```

Die Adresse eines Tags ist das Objekt, `<type>:<instance>`, und ein Punkt und eine Eigenschaft, wenn es nicht der Present Value ist. Die Typen, per Name oder Abkürzung: `analog-input` (`ai`), `analog-output` (`ao`), `analog-value` (`av`), `binary-input` (`bi`), `binary-output` (`bo`), `binary-value` (`bv`), `multi-state-input` (`msi`), `multi-state-output` (`mso`), `multi-state-value` (`msv`), `accumulator` (`acc`), `integer-value` (`iv`), `positive-integer-value` (`piv`), `large-analog-value` (`lav`) und `characterstring-value` (`csv`). Die Eigenschaften per Name sind `present-value`, `object-name`, `description`, `units`, `status-flags`, `out-of-service`, `reliability`, `number-of-states`, `state-text`, `object-type`, `object-identifier`, `object-list`, `vendor-name`, `vendor-identifier`, `model-name`, `firmware-revision` und `application-software-version`; jede andere Eigenschaft ist ihre Nummer.

Was ein Tag wird, richtet sich nach seinem `dataType`: Eine Zahl, die das Gerät gesendet hat (real, double, unsigned, signed, enumerated, boolean), ist diese Zahl, und das `active` eines binären Objekts ist 1 und das `inactive` 0; eine Zeichenkette ist Text oder eine Zahl, wenn der Tag eine ist und der Text eine Zahl ist; ein Present Value von `null` ist ein schlechter Messwert, der sagt, dass das Gerät nichts zu melden hat. Eine Eigenschaft, die mehr als einen Wert enthält (eine Objektliste), kann kein Tag sein.

**Status-Flags sind Teil des Messwerts.** Jede Abfrage fragt die Status-Flags eines Objekts in derselben Anfrage wie seinen Present Value ab, und ein Objekt, dessen **Fault**-Flag gesetzt ist, wird **schlecht** gelesen, mit Grund. Eines, das **außer Betrieb** oder **überschrieben** ist, wird **unsicher** gelesen: Sein Present Value ist etwas, das eine Person oder ein Programm dort hingesetzt hat, keine Messung, und die Trenddiagramme und Berichte lassen unsichere Messwerte wie schlechte weg (die Qualitätsregel). **Im Alarm** allein ist ein guter Messwert eines Punkts, der im Alarm ist.

**Was das Gerät nicht hat, ist ein schlechter Messwert mit Grund, und der Rest wird trotzdem gelesen.** ReadPropertyMultiple beantwortet jede Eigenschaft für sich, sodass ein Objekt, das nicht da ist (`unknown-object`), oder eine Eigenschaft, die es nicht hat (`unknown-property`), diesen Tag scheitern lässt und keinen anderen. Ein Gerät, das ReadPropertyMultiple ablehnt, wird von da an eine Eigenschaft nach der anderen gelesen.

**Nichts wird segmentiert.** Der Client sagt dem Gerät, dass er keine segmentierte Antwort annehmen kann. Ein Gerät, dessen Antwort nicht in einen Frame passen würde, bricht ab (`segmentation-not-supported`), und HotLoop fragt halb so viele Objekte auf einmal an; ein Gerät, dessen Objektliste zu groß ist, um sie ganz zu senden, wird ein Element nach dem anderen gelesen.

Geräteoptionen (`config`):

| Option | Bedeutung |
|---|---|
| `deviceInstance` | Die Instanznummer, die das Gerät an dieser Adresse haben soll. Ist sie gesetzt und das Gerät nennt eine andere, wird die Verbindung abgelehnt: Ein anderes Gerät, das an einer wiederverwendeten Adresse antwortet, oder ein getauschter Controller ist, wie eine Anlage zu einer sauber aussehenden falschen Zahl kommt |
| `localAddress` | Die Adresse der Netzwerkkarte dieser Maschine, von der gesendet wird, für einen Host mit mehr als einer. Meist leer |
| `retries` | Wie oft eine Anfrage ohne Antwort erneut gesendet wird, 0 bis 10. Standard 1 |
| `browseMaxObjects` | Wo ein Browse aufhört. Standard 1000 |

Die Adresse ist `host` oder `host:port`, standardmäßig Port 47808. In BACnet/IP ist nichts eine Zugangsdate, es gibt also keine zu verbergen.

**Beim Verbinden wird das Gerät gefragt, wer es ist.** HotLoop sendet dem Gerät ein Unicast-Who-Is und entnimmt seine Geräteinstanz dem I-Am. Ein Gerät, das darauf nicht antwortet, wird nach seinem eigenen Geräteobjekt unter der Wildcard-Instanz (4194303) gefragt, auf die ein Gerät laut Standard als es selbst antwortet. Ein Gerät, das auf keines von beiden antwortet, wird mit beiden Versuchen gemeldet, weil die üblichen Gründe gleich aussehen: eine falsche Adresse oder ein falscher Port, eine Firewall, ein ausgefallenes Gerät oder ein Gerät in einem Netzwerk hinter einem Router.

**Routing ist nicht gebaut.** HotLoop spricht mit einem Gerät, an das es ein UDP-Datagramm senden kann. Ein Controller an einem MS/TP-Trunk hinter einem BACnet-Router oder in einem anderen BACnet-Netzwerk ist nicht erreichbar, ebenso wenig ein Gerät, das nur ein BBMD erreichen kann (Foreign-Device-Registrierung). Adressieren Sie die BACnet/IP-Seite des Routers selbst oder setzen Sie ein Gateway davor: siehe [Gateway-Modus](#alles-andere-gateway-modus).

`Browse` liest das eigene Objekt des Geräts (seinen Namen, Hersteller, sein Modell und seine Firmware), seine Objektliste und jedes Objekt, das HotLoop liest: Name, Beschreibung, Einheiten, Present Value und Status-Flags und den Statustext eines Multi-State-Objekts. Ein Tag wird nach dem eigenen Namen des Objekts benannt, mit der Adresse zusätzlich, wenn zwei Objekte ihn teilen. Einheiten werden zu einem Label und, wo sie eine bedeuten, zu einer Entitätsklasse: Grad Celsius ist `°C` und `temperature`, Prozent relative Feuchte ist `%` und `humidity`, Kilowattstunden ist `kWh` und `energy`. Eine Einheit, für die HotLoop kein Label hat, bleibt ohne Label und wird in der Beschreibung mit ihrer Nummer genannt. Die Nummern und Namen dieser Einheiten sind an einem echten Gerät geprüft, das die Nummer sendet, die seine eigene Tabelle jedem Namen gibt. Die Integration (siehe [Integrationen](/de/iot/integrations/#bacnetip)) übernimmt das Fragen für Sie.

## Nach draußen: die Kafka-API

Alles oben holt die Werte eines Geräts herein. HotLoop kann sie auch als Ereignisstrom an einen Kafka-Broker senden: jeden Messwert, den der Historian aufbewahrt, und jede Zeile des Systemlogs (Alarme, ausfallende und wiederkehrende Geräte, Änderungen), als JSON auf Topics, die Sie benennen. Es ist ein Historian-Ziel, eingerichtet unter Einstellungen, Verlaufsziele, und es nimmt Apache Kafka, Redpanda und alles andere, das die Kafka-API spricht, über TLS mit einer SASL-Anmeldung. Die Satzformate, was "mindestens einmal" hier bedeutet und was belegt ist und was nicht, stehen unter [Historian-Ziele](/de/iot/historian-targets/#kafka-api-ereignisstrom). Der Client ist [franz-go](https://github.com/twmb/franz-go).

## Alles andere: Gateway-Modus

**PROFINET · EtherCAT · HART · DNP3 · FINS · MELSEC/SLMP · CANopen · FANUC FOCAS**

Diese werden nicht nativ gesprochen, und es gibt keinen Treiber dafür. Das ist eine bewusste Entscheidung, keine Lücke, die darauf wartet, mit einem Stub gefüllt zu werden.

Standorte, die diese Protokolle nutzen, haben fast immer schon ein Gateway, das auf OPC UA oder Modbus neu veröffentlicht: einen PROFINET-IO-Controller mit einem OPC-UA-Server, einen HART-Multiplexer mit einer Modbus-Map. Richten Sie ein Gerät auf diesen Endpoint und konfigurieren Sie es als OPC UA oder Modbus.

Acht weitere Treiber zu schreiben, die jeweils das duplizieren, was das vorhandene Gateway eines Standorts schon tut, würde acht weitere Dinge hinzufügen, bei denen sich subtile Fehler einschleichen, für Protokolle, bei denen die Anlagen am schwersten zu testen sind. Wenn ein Standort wirklich kein Gateway hat und eines davon nativ braucht, ist das echte Arbeit, die eingeplant werden muss, keine Datei, die man hinzufügt und die "not implemented" protokolliert.

**In diesem Baum gibt es keine Platzhaltertreiber.** Ein Protokoll hat entweder eine funktionierende Implementierung oder steht in diesem Abschnitt. Ein Test erzwingt, dass jedes vom Modell deklarierte Protokoll einen einkompilierten Treiber hat und umgekehrt.

## Zugangsdaten von Geräten

`config` und `address` eines Geräts sind der Ort, an dem ein Treiber findet, womit er sich anmeldet. Das sind die Zugangsdaten, die jedes Protokoll liest, und alle sind über die API nur schreibbar (4.15.1): Sie erscheinen für jede Rolle als `[redacted]`, ein Speichern, das den Platzhalter sendet oder den Schlüssel weglässt, behält den gespeicherten Wert, und eine neue Zeichenkette ersetzt ihn. Die Regeln und was nicht über die API läuft, stehen unter [Authentifizierung und Benutzer](/de/iot/authentication/#gerätezugangsdaten-sind-nur-schreibbar).

| Protokoll | Zugangsdaten in der Konfiguration | Zugangsdaten in der Adresse |
|---|---|---|
| OPC UA | `password` (mit `username`) | keine: Benutzerinformationen in der Adresse werden verborgen, und der Treiber ignoriert sie |
| MQTT / Sparkplug B | `password` (mit `username`) | `mqtt://user:pass@host`, was der Client verwendet |
| HTTP / REST | `password` (mit `username`, als Basic Auth gesendet); jeder Wert in `headers` außer einfachen wie `Accept` und `Content-Type`, dort gehört ein API-Schlüssel oder ein `Authorization`-Header hin; `body` und `writeBody`, wenn sie eine Zugangsdate erwähnen | `http://user:pass@host` und Query-Werte im Stil von `?api_key=`, in der Adresse und in `writeUrl` |
| MTConnect | `password` (mit `username`); jeder Wert in `headers`, mit denselben Ausnahmen | `http://user:pass@host` und Query-Werte |
| UniFi Network | `password` (mit `username`). Nur verschlüsselt gespeichert: Ohne Schlüssel (unten) lässt sich das Gerät nicht speichern | keine: Die Adresse ist die `https://`-URL der Konsole |
| BACnet/IP | keine | keine: Die Adresse ist `host` oder `host:port` |
| CODESYS | `password` (mit `username`), wie bei OPC UA | keine: Benutzerinformationen in der Adresse werden verborgen, und der Treiber ignoriert sie |
| SNMP | `community` (v1, v2c); `authPassword` und `privPassword` (v3), mit `username` | keine: Die Adresse ist `host` oder `host:port` |
| Modbus, S7comm, EtherNet/IP | keine | keine: Benutzerinformationen in der Adresse werden verborgen, und der Treiber ignoriert sie |

**Verschlüsselt im Ruhezustand.** Mit gesetztem `HOTLOOP_SECRET_KEY_FILE` (das Chart setzt es, mit einem Schlüssel, den es erzeugt) wird jede Zugangsdate in der obigen Konfigurationsspalte in der Datenbank mit diesem Schlüssel verschlüsselt, der außerhalb der Datenbank liegt, sodass ein Dump oder Backup Chiffretext enthält. Der Rest von HotLoop und die Treiber sehen den Unterschied nie. Eine Zugangsdate, die in eine URL (`mqtt://user:pass@host`, `?api_key=`) oder in Freitext wie einen HTTP-`body` geschrieben ist, wird ebenfalls verschlüsselt: Die ganze Adresse oder Option wird versiegelt und kommt genau so zurück, wie sie eingegeben wurde, und eine URL ohne etwas Geheimes bleibt lesbar. Die Option `password` bleibt der ordentlichere Ort dafür. Siehe [Backups und Wiederherstellung](/de/iot/backup/#gerätezugangsdaten-und-der-geheime-schlüssel).

Jede andere Option, deren Name nach einer Zugangsdate aussieht (er enthält `password`, `token`, `secret`, `apikey`, `authorization`, `private`, `passphrase`, endet auf `key` oder hat ein ganzes Wort wie `pass`, `pw`, `auth`, `cred` oder `sig`, unter anderem), wird ebenfalls verborgen, in welchem Protokoll auch immer, sodass eine später zu einem Treiber hinzugefügte Option verborgen bleibt, bis jemand entscheidet, dass sie es nicht sein soll. Ein Test durchläuft die Optionen jedes Treibers und scheitert, bis jede in der Liste der Zugangsdaten oder in der Liste der bekanntermaßen unkritischen Optionen steht. Siehe [Authentifizierung und Benutzer](/de/iot/authentication/#gerätezugangsdaten-sind-nur-schreibbar) für die vollständigen Regeln.

## Ein Gerät hinzufügen

1. **Geräte → Gerät hinzufügen.** Wählen Sie das Protokoll, geben Sie ihm eine Adresse.
2. **Tags entdecken**, wo das Protokoll es unterstützt: OPC UA, EtherNet/IP, MTConnect, MQTT (nach einer Sparkplug-Geburt), HTTP, SNMP, BACnet/IP, CODESYS. Modbus und S7comm können ihre eigenen Punkte nicht aufzählen, deklarieren Sie diese also anhand der Gerätedokumentation.
3. Importierte Tags werden **nur lesend** angelegt. Ein Punkt, den das Gerät zufällig bereitstellt, ist kein Punkt, von dem jemand entschieden hat, dass er angesteuert werden darf. Markieren Sie Tags einzeln und bewusst als beschreibbar.
4. Setzen Sie `scale` und `offset` für Rohwerte: `engineering = raw × scale + offset`. Sendet das Messgerät einen Code, wenn ein Kanal tot oder außerhalb des Bereichs ist, tragen Sie ihn unter [Werte ohne Daten](#werte-ohne-daten) ein, damit er als schlecht gelesen wird statt als Zahl.
5. Setzen Sie ein `deadband` auf alles, was rauscht. Es unterdrückt Historian-Schreibvorgänge bei Änderungen, die zu klein sind, um zu zählen, und ohne es schreibt ein 12-Bit-Sensor, der in seinem letzten Bit zittert, für immer in jedem Zyklus eine Zeile.

## Werte ohne Daten

Ein Schreiber mit durchgebranntem Thermoelement wird nicht still. Er antwortet weiter, und was er ins Register schreibt, ist ein Code: 0x8005 für "undefined", 0x7FFF für "over range". Als int16 mit einer Skalierung von 0,1 gelesen, sind 0x8005 -3276,3 Grad, und bevor wir das behoben haben, kam das mit **guter** Qualität zurück, ging als echte Temperatur in den Historian und blieb dort, damit die Alarme darüber urteilten. Ein toter Sensor sah aus wie ein kalter.

Ein Tag kann also die Rohwerte auflisten, die "keine Messung" bedeuten. Jeder hat einen Grund. Steht der Rohwert eines Messwerts auf der Liste, ist der Messwert **schlecht**, der Grund steht dabei, und Skalierung und Offset berühren ihn nie.

```json
{
  "deviceId": "dx-1", "name": "ch01", "address": "input:1:int16",
  "dataType": "float", "unit": "C", "scale": 0.1, "enabled": true,
  "noData": [
    {"raw": "0x7FFF", "reason": "+over"},
    {"raw": "0x8001", "reason": "-over"},
    {"raw": "0x8002", "reason": "skip"},
    {"raw": "0x8004", "reason": "error"},
    {"raw": "0x8005", "reason": "undefined"},
    {"raw": "0x7F7F", "reason": "power fail"},
    {"raw": "0x7FFA", "reason": "burnout up"},
    {"raw": "0x8006", "reason": "burnout down"}
  ]
}
```

Diese acht sind die Codes der Yokogawa-DX-Familie, aus dem Kommunikationshandbuch des DX (IM 04L41B01-17E, Abschnitt 4.3, Seite 4-35). Sie sind nichts Besonderes für HotLoop: Es ist dasselbe Feld an jedem Tag jedes Protokolls, und die DX-Liste ist nur die, die uns zuerst erwischt hat. Jeder steht am Tag, sodass ein Schreiberkanal, der in einer anderen Einheit wirklich 0x7F7F lesen kann, ihn als Messwert behält.

| Feld | <span class="sr-only">Details</span> |
|---|---|
| `raw` | Der Code des Geräts, so geschrieben, wie sein Handbuch ihn druckt: `"0x8005"` (hex), `"-32763"` oder `32773` (dezimal). Eine Zeichenkette oder eine einfache Zahl. Erforderlich |
| `reason` | Was die Qualität des Messwerts sagt. Bis zu 120 Zeichen. Weggelassen lautet er `raw value 0x8005 means no measurement`, sodass ein Messwert nie schlecht wird, ohne zu sagen, warum |

Im Tag-Editor ist es das Feld **Werte ohne Daten**: ein Code pro Zeile, der Code, ein Leerzeichen, der Grund.

### Welche Zahl Sie schreiben

Bei einem registergestützten Modbus-Punkt ist der Code die Ganzzahl, die das Gerät hält, nachdem die Byte- und Wortreihenfolge des Punkts angewendet wurde. Das ist dieselbe Zahl, zu der der Punkt dekodiert, sodass ein Handbuch, das sagt "das Messgerät liefert 8005h", hier genau `"0x8005"` bedeutet.

- **int16 und die anderen vorzeichenbehafteten Typen.** `0x8005` und `-32763` sind dasselbe Register, und `32773` ebenfalls. Schreiben Sie, was das Handbuch schreibt; alle drei passen. Ein Code, der nicht in den Typ passt (`0x10000` bei einem int16), wird beim Verbinden des Geräts abgelehnt, weil eine Liste, die nie passen kann, schlimmer ist als ein Fehler. Zwei Schreibweisen desselben Werts an einem Tag werden ebenfalls abgelehnt.
- **uint16 und die anderen vorzeichenlosen Typen.** `0` bis zum Maximum des Typs. Eine negative Zahl wird abgelehnt.
- **int32, uint32, int64, uint64.** Dieselben Regeln bei 32 und 64 Bit. `0x7FFFFFFF` bei einem int32 mit Wortreihenfolge `CDAB` ist der Wert, nachdem die Wörter richtig herum gelegt wurden, nicht die Reihenfolge, in der sie von der Leitung kamen.
- **float32 und float64.** Der Code ist das Bitmuster des Registers, er muss also hex sein: `0x7FC00000` für ein stilles NaN. Eine Dezimalzahl wird abgelehnt, weil 32773 als float und 32773 als Bitmuster verschiedene Dinge sind und wir nicht raten.
- **Bits, Coils, Discrete Inputs und Strings.** Keine Rohzahl zum Vergleichen, daher wird `noData` bei einem davon beim Verbinden des Geräts abgelehnt.

Die Prüfung erfolgt auf den Rohbits, vor dem Dekodieren, vor der Skalierung, vor dem Offset.

### Andere Protokolle

Jeder Treiber, der eine bereits dekodierte Zahl liefert, prüft dieselbe Liste: S7comm, EtherNet/IP, OPC UA, HTTP und MQTT (einschließlich entdeckter Geräte). Verglichen wird diese dekodierte Zahl als ganze Zahl, schreiben Sie sie also als die Zahl, die sie ist. Ein S7-INT mit 0x8005 ist -32763, schreiben Sie also `-32763`. Hex ist hier nur eine andere Schreibweise derselben Zahl, weil eine dekodierte Zahl ihre Breite verloren hat und nicht als Bitmuster zurückgelesen werden kann. Ein Bruchwert passt nie. Die Liste lohnt sich nur dort, wo das Gerät solche Codes sendet; das meiste, was MTConnect und UniFi melden, tut das nie.

### Was ein Sentinel bewirkt

- Die **Qualität** ist `bad`, und der Messwert trägt den Grund. Er erscheint in `GET /api/values` und im Live-Strom (`reason`), neben der Qualität in der Tags-Ansicht, und an den Entitäten des Tags als Attribut `quality_reason`.
- Der **Wert** ist leer, nicht null und nicht der skalierte Code. Skalierung und Offset werden nicht angewendet.
- Der **Historian** zeichnet die Qualität als schlecht auf, wie bei jedem anderen schlechten Messwert, und seine Wertspalte enthält nichts Aussagekräftiges. Ein Bucket ohne einen guten Messwert zeigt sich als Lücke im Trend, wie bei jedem schlechten Messwert.
- **Alarme.** Ein schlechter Messwert löst nie einen Wertalarm aus: hoch, niedrig, gleich, Änderungsrate behalten alle ihren vorherigen Zustand, wie bei jedem schlechten Messwert. Ein `bad-quality`-Alarm am Tag wird dagegen ausgelöst, und seine Standardmeldung trägt den Grund (`dx-1/ch01 bad-quality: undefined`). Verwenden Sie `{reason}` in Ihrer eigenen Meldung, um ihn dort einzusetzen.
- Das **Logbuch** zeichnet auf, dass die Entität des Tags schlecht wird, und der Grund ist das Attribut `quality_reason` der Entität.

### Wo es liegt

Am Tag, mit ihm gespeichert. Über die API ist es die Liste `noData` bei `POST /api/tags` (siehe [die HTTP-API](/de/iot/api/#post-apitags)), im Editor ist es das Feld oben, und in einem Edge Relay ist es dasselbe JSON im Tag der Gerätedatei (siehe [Edge-Relay-Referenz](/de/edge-relay/reference/)). Das Speichern des Tags lädt das laufende Gerät neu, sodass eine Änderung bei der nächsten Abfrage wirksam wird und nichts von Hand neu gestartet wird. Eine erneute Entdeckung lässt die Liste eines Tags unangetastet.

## Qualität

Jeder Messwert trägt `good`, `uncertain` oder `bad`.

**Schlecht heißt, dass der Wert nicht bekannt ist. Es heißt nicht null.** Ein Treiber, der einen Punkt nicht lesen kann, gibt trotzdem einen Messwert aus, als schlecht markiert, weil Stille von einem Wert, der sich nicht geändert hat, nicht zu unterscheiden ist, und in einem Trend ist der Unterschied zwischen "der Sensor liest 0" und "der Sensor antwortet nicht mehr" der Unterschied zwischen einem Prozessproblem und einem Instrumentenproblem.

Die Alarmauswertung behält bei einem schlechten Messwert ihren vorherigen Zustand, statt ihn auszuwerten. Ein Sensor, der auf null ausfällt, würde sonst jeden Niedrigalarm der Einheit auslösen und wie ein Prozessereignis aussehen.
