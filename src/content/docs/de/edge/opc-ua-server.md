---
title: "Der OPC-UA-Server"
description: "Veröffentlicht konfigurierte Geräte und Tags als schreibgeschützten OPC-UA-Adressraum, damit Ihr SCADA jeden Tag ohne neuen Treiber sieht."
---

Der OPC-UA-Server von HotLoop veröffentlicht seit 4.13.0 die im Gateway konfigurierten Geräte und Tags als OPC-UA-Adressraum. Ein OPC-UA-Client eines Drittanbieters, ein SCADA-Paket, ein HMI, ein Historian oder ein Testwerkzeug wie UaExpert kann so die Live-Tags des Gateways lesen, ohne dass jemand einen HotLoop-Treiber für die Gegenseite schreiben muss.

Standardmäßig eingeschaltet (`HOTLOOP_OPCUA_SERVER_ENABLED`), im Binary und im Helm-Chart. Er startet mit eingeschalteter HotLoop-Authentifizierung und einer eigenen Anmeldung, `opcua-reader`, die HotLoop mit einem generierten Passwort anlegt, das die Einstellungen einem Admin zeigen (`GET /api/opcua/server`); sie kann Tags und Werte lesen und sonst nichts. Ist die HotLoop-Authentifizierung aus, gibt es keine Benutzer zum Anmelden, also wartet der Server und meldet das (er verweigert den Start nicht). Belegt ein anderer OPC-UA-Server auf dem Gerät bereits 4840, wartet er und meldet das; ein Port, den Sie gewählt haben und der sich nicht öffnen lässt, ist ein Fehler: Einen Listener in einem Werksnetz zu öffnen ist etwas, das ein Deployment bewusst tut. Standardport 4840.

**Er ist schreibgeschützt.** Siehe [Warum er schreibgeschützt ist](#warum-er-schreibgeschützt-ist). Er liefert auch den Verlauf jedes Tags: siehe [Verlauf](#verlauf).

## Was bereitgestellt wird

Ein **Object**-Knoten pro aktiviertem Gerät, direkt unter dem Standardordner *Objects*, und ein **Variable**-Knoten pro aktiviertem Tag darunter. Ausgeschaltete Geräte und Tags werden nicht veröffentlicht: Sie haben keinen Worker und keinen Messwert, und ihre Veröffentlichung würde einem Client nur einen dauerhaft schlechten Knoten (Bad) vorsetzen. Der Adressraum ist genau das, was die Runtime abfragt.

Alles liegt in einem einzigen Namespace, `urn:hotloop:ua:gateway`. Die Namespace-URI ist eine Konstante und wird weder aus dem Hostnamen noch aus der Anwendungs-URI abgeleitet: Ein Client speichert einen Knoten als URI plus Bezeichner und findet den Namespace-Index bei jeder Verbindung neu, und eine URI, die sich mit einem Pod-Namen änderte, würde jedes in einem SCADA-Projekt konfigurierte Abonnement verwaisen lassen. Lösen Sie den Index über die Namespace-Liste des Servers per URI auf, wie es ein echter Client tut; nehmen Sie nicht `ns=2` an.

### NodeIds

Die Bezeichner sind Zeichenketten und stabil:

| Knoten | NodeId-Bezeichner |
|---|---|
| Gerät | `<deviceId>` |
| Tag | `<deviceId>/<tagName>` |
| Die Eigenschaft `EngineeringUnits` / `EURange` eines Tags | `~EngineeringUnits/<deviceId>/<tagName>` und `~EURange/…` |

Die Tag-Form ist `model.TagKey.String()`, die `device/tag`-Schreibweise, die der Rest des Codes ohnehin verwendet, sodass sich eine NodeId und ein Tag-Schlüssel mit `model.ParseTagKey` ineinander umwandeln lassen. Ein Trennzeichen `.` hätte nicht funktioniert: Geräte-IDs können Punkte enthalten, also könnte `a.b.c` das Gerät `a` mit dem Tag `b.c` oder das Gerät `a.b` mit dem Tag `c` sein. Eine Geräte-ID kann keinen Schrägstrich enthalten, daher ist der erste Schrägstrich immer die Grenze, und ein Tag-Name mit Schrägstrichen (OPC-UA-Browsepfade und MQTT-Topics haben welche) wird trotzdem dem richtigen Gerät zugeordnet. Eigenschafts-IDs beginnen mit `~`, was eine Geräte-ID nicht kann, daher kann eine Eigenschaft nie mit einem Tag kollidieren, egal wie der Tag heißt.

### Attribute

| Attribut | Wert |
|---|---|
| `BrowseName` | die Geräte-ID / der Tag-Name, im HotLoop-Namespace |
| `DisplayName` | der Name des Geräts / der Name des Tags |
| `Description` | die Beschreibung des Geräts oder Tags |
| `DataType` | siehe unten |
| `ValueRank` | skalar (-1) |
| `AccessLevel`, `UserAccessLevel` | nur `CurrentRead` (0x01) |
| `MinimumSamplingInterval` | das effektive Abfrageintervall des Geräts in ms; Werte können sich nicht schneller ändern, als die Runtime sie abfragt, daher wird eine vom Client gewünschte schnellere Abtastrate auf dieses Intervall angehoben |
| `Historizing` | false |

Ein Tag mit Einheit erhält eine Eigenschaft `EngineeringUnits` (`EUInformation`, Einheiten-ID -1 = „kein UNECE-Code“, der Einheitentext in `DisplayName`), und ein Tag mit Bereich erhält eine Eigenschaft `EURange`. Ein Tag mit keinem von beidem hat auch keine Eigenschaft.

### Datentypen

Die Runtime reduziert jeden numerischen Messwert auf einen float64 in technischen Einheiten, daher ist der deklarierte Typ eine Darstellungsentscheidung, die in `kindForTag` fällt, und er muss ein Typ sein, in dem sich der Wert immer ausdrücken lässt:

| `dataType` des Tags | OPC-UA-Typ |
|---|---|
| `bool`, `boolean`, `bit`, `coil`, `discrete` | Boolean |
| `string`, `text`, `char` | String |
| `int16` | Int16 |
| `uint16`, `word` | UInt16 |
| `int32`, `dint` | Int32 |
| `uint32`, `dword` | UInt32 |
| `uint64` | UInt64 |
| `int`, `int64` | Int64 (der breiteste vorzeichenbehaftete Typ, damit nichts überläuft) |
| alles andere, einschließlich `float` | Double |
| **jeder Ganzzahltyp mit Skalierung oder Offset** | **Double** |

Die letzte Zeile ist wichtig: Ein `int16`-Register mit Skalierung 0,1 liest 23,4, und das Abschneiden auf Int16 würde dem Client eine 23 mit Status Good liefern. Ein Wert, der nicht in seinen deklarierten Typ passt, etwa ein `int16`-Tag, das 70000 liefert, wird als `BadOutOfRange` ohne Wert gemeldet, nie umgebrochen oder auf etwas gekappt, das plausibel aussieht. Ein numerischer Tag, dessen Messwert Text enthält, ist `BadTypeMismatch`.

### Wert, Qualität und Zeitstempel

Jeder Lesezugriff (und jede Abonnement-Stichprobe) wird aus dem Live-Cache der Runtime beantwortet, derselben Quelle, die `/api/values` bedient, nie aus der Datenbank. Der Statuscode ergibt sich aus diesem Messwert **und dem Zustand der Geräteverbindung dahinter**, denn der Cache allein genügt nicht: Er behält den letzten Messwert, den ein Gerät geliefert hat, und ein Gerät, das inzwischen aus dem Netz gefallen ist, hat dort immer noch einen letzten Messwert, der völlig gut aussieht.

| Geräteverbindung | Messwert | Status | Wert |
|---|---|---|---|
| Verbunden, in dieser Sitzung mindestens eine Abfrage geliefert | gut | **Good** | gesendet |
| | unsicher | Uncertain | gesendet |
| | schlecht oder nicht erkannte Qualität | Bad | keiner |
| Verbunden, in dieser Sitzung noch keine Abfrage geliefert | beliebig | BadWaitingForInitialData | keiner |
| Verbunden, gar nichts im Cache | n/a | BadWaitingForInitialData | keiner |
| Eingeschränkt (Sitzung steht, Abfragen schlagen fehl oder sind unvollständig) | gut | **UncertainLastUsableValue** | gesendet |
| | unsicher | Uncertain | gesendet |
| | schlecht | Bad | keiner |
| Getrennt, wird verbunden, deaktiviert | beliebig | **BadNoCommunication** | keiner |
| Kein Worker für das Gerät | beliebig | BadOutOfService | keiner |
| Tag oder Gerät entfernt | n/a | BadNodeIdUnknown | keiner |

Good wird nur für ein verbundenes Gerät gemeldet, bei einer Abfrage der aktuellen Sitzung, deren Messwert gut ist. Ein Tag auf einem getrennten Gerät liest Bad, nicht seinen letzten Wert mit Status Good.

Das Alter spielt absichtlich keine Rolle. Ereignisgesteuerte Quellen (ein MQTT/Sparkplug-Tag, ein OPC-UA-Abonnement) halten legitim stundenlang einen Wert, weil sich nichts geändert hat, und ihn nach der Uhr als veraltet zu bezeichnen wäre falsch; ob ein Gerät noch liefert, ist Sache der Verbindung.

Der **Quellzeitstempel** ist der eigene Zeitstempel des Messwerts, der Zeitpunkt, an dem zuletzt vom Gerät gehört wurde, und er wird auch bei Status Bad gemeldet. Der **Serverzeitstempel** ist der Zeitpunkt, an dem der Lesezugriff beantwortet wurde. Beide sind in UTC.

## Abonnements

Clients können Abonnements und überwachte Elemente auf Tag-Variablen anlegen und Datenänderungs-Benachrichtigungen erhalten, so konsumieren SCADA-Clients Tags tatsächlich. In dieser Bibliothek erfolgt die Überwachung durch Abtastung: Der Server liest jedes überwachte Element in seinem Abtastintervall (mindestens 100 ms und mindestens das Abfrageintervall des Geräts) über denselben Handler wie ein Lesezugriff und meldet, wenn sich Wert oder Status ändern. Eine Änderung der *Qualität*, etwa ein Gerät, das ausfällt, wird also genauso gemeldet wie eine Wertänderung.

Ein überwachtes Element auf einem entfernten Tag bleibt nicht hängen: Es erhält `BadNodeIdUnknown`.

## Was ein Client sieht, während sich die Konfiguration ändert

Wird ein Tag entfernt, erhalten Lesezugriffe und überwachte Elemente darauf sofort `BadNodeIdUnknown`, und er verschwindet sofort aus dem Browsen seines Geräts. Der Knoten selbst bleibt danach etwa 5 Sekunden in der Knotentabelle des Servers, unerreichbar, und wird dann gelöscht. Ein entferntes Gerät verhält sich unter dem Ordner Objects genauso.

Eine Änderung hinterlässt nie eine Lücke. Ein geänderter Tag oder ein geändertes Gerät wird in einem Schritt unter derselben NodeId durch seine neue Version ersetzt, sodass ein Lesezugriff oder Browse in diesem Moment die alte oder die neue Version sieht, nie „unbekannt“. Abonnements darauf laufen weiter.

Die Verzögerung vor dem Löschen ist keine Dekoration. Das Browse der Bibliothek liest die Referenzliste eines Knotens und schlägt dann jedes Ziel nach, ohne zwischen beiden eine Sperre zu halten, und wenn ein Ziel dazwischen verschwunden ist, schlägt das Browsen des *übergeordneten* Knotens mit `BadNodeIdUnknown` fehl, als gäbe es das Gerät oder den Ordner Objects nicht. Früher haben wir Knoten sofort gelöscht, und ein Client, der ein Gerät durchsuchte, während ein Tag entfernt wurde, oder einen Tag las, während sein Gerät bearbeitet wurde, konnte gesagt bekommen, ein völlig reeller Knoten existiere nicht.

## Warum er schreibgeschützt ist

Diese Ausbaustufe implementiert keine Schreibzugriffe und sagt das an drei Stellen zugleich, damit keine einzelne Änderung sie unbemerkt hinzufügen kann:

- Jeder veröffentlichte Knoten hat `AccessLevel = CurrentRead | HistoryRead`, und es ist kein Schreib-Handler installiert, sodass ein Schreibzugriff mit `BadNotWritable` abgelehnt wird und ein Client schon vor dem Versuch sehen kann, dass der Knoten nicht beschreibbar ist;
- Die Tests schreiben auf einen Tag als viewer, operator und admin und prüfen, dass die Antwort `BadNotWritable` ist **und dass sich das Register auf dem Gerät hinter dem Tag nicht geändert hat**.

Ein OPC-UA-Schreibpfad müsste durch dieses Tor gehen, seinen Principal in den Audit-Trail tragen und den Hauptschalter beachten. Das ist eine Änderung mit eigener Prüfung und nichts, das als Nebenprodukt der Tag-Veröffentlichung entsteht, und es gibt in dieser Version absichtlich keine Einstellung, die es aktiviert.

## Verlauf

Jeder Tag-Knoten wird historisiert und trägt die Zugriffsstufe HistoryRead. Der Server beantwortet den OPC-UA-Dienst HistoryRead aus dem eigenen Verlauf von HotLoop, denselben Messwerten, die `/api/history` liefert, sodass ein Client am anderen Ende einer OPC-UA-Verbindung liest, was das Gateway gespeichert hat, ohne eine zweite Datenbank. Ein Benutzer braucht, was auch ein Wert-Lesezugriff braucht (`tags.read` und `values.read`), geprüft wie bei einem Wert-Lesezugriff, für den Benutzer der Sitzung und nicht nur einmal bei der Anmeldung.

- **Raw** (`ReadRawModifiedDetails`): die Messwerte in einem Fenster, jeder mit seiner eigenen Qualität als Status und seinem eigenen Zeitstempel. Ein Start vor dem Ende liest vorwärts, ein Start nach dem Ende liest rückwärts, neueste zuerst. Der Start ist eingeschlossen und das Ende ausgeschlossen (OPC UA 10000-11, Abschnitt 4.6), es sei denn, der Client verlangt Grenzwerte, dann kommen der Messwert am oder vor dem Start und der erste Messwert außerhalb des Fensters am Ende hinzu. `NumValuesPerNode` gibt an, wie viele ein Aufruf für einen Knoten liefert; mehr als das, oder mehr als 10.000, kommt seitenweise, jede Seite mit einem Fortsetzungspunkt, der fünf Minuten und für eine einmalige Verwendung gilt (höchstens 1.000 gleichzeitig gehalten). Ein Fenster ohne Inhalt ist `Good_NoData`. Veränderter Verlauf wird abgelehnt (`BadHistoryOperationUnsupported`): Hier wird nie etwas verändert oder gelöscht.
- **Processed** (`ReadProcessedDetails`): Average, Minimum, Maximum, Count, Start, End und Total, über Intervalle von `ProcessingInterval` ab der Startzeit, nach der Qualitätsregel (README, „The quality rule“): Es zählen nur gute Messwerte mit endlicher Zahl. Ein Intervall ohne solche ist `Good_NoData` (Count sagt 0), und eines mit ausgelassenen Messwerten liest `Uncertain_DataSubNormal`, sodass die Zahl nie besser ist als das, was darin war. Ein anderes Aggregat wird für diesen Knoten abgelehnt (`BadAggregateNotSupported`), ein String-Tag hat keines, und ein Fenster mit mehr als 10.000 Intervallen oder 500.000 Messwerten wird abgelehnt (`BadTooManyOperations`), statt abgeschnitten zu werden. Beantwortet wird nur ein Vorwärtsfenster mit beiden Enden.
- **At time** (`ReadAtTimeDetails`): was der Tag zu jedem Zeitpunkt hatte, also sein letzter Messwert zu diesem Zeitpunkt oder davor, mit dem angefragten Zeitpunkt als Zeitstempel. Es interpoliert nie, denn ein Messwert ist ein Wert, den jemand genommen hat; ein Zeitpunkt vor dem ersten Messwert des Tags ist `Bad_NoData`.
- **Ereignisse** werden nicht geliefert: `BadHistoryOperationUnsupported`. Auch ein Gerät oder ein anderes Objekt hat keinen Verlauf, und ein Eigenschaftsknoten (`EngineeringUnits`, `EURange`) trägt kein HistoryRead.

Der Historian speichert einen Messwert, wenn er die Totzone verlässt, nicht bei jeder Abfrage, daher hat ein ruhiger Tag wenige Zeilen: Lesen Sie At time oder ein Processed-Fenster um den letzten Messwert eines Tags, wenn Sie wissen wollen, was er hatte und nicht nur, wann er sich änderte. `HistoryServerCapabilities` sagt, dass der Verlauf gelesen werden kann und dass ein Aufruf höchstens 10.000 Werte liefert.

## Gerätezustand für das EmberNet-Dashboard

Der Task-Manager des Dashboards liest CPU, Arbeitsspeicher, Datenträger und Echtzeit-Jitter einer Maschine von der Maschine selbst: HotLoop veröffentlicht sie als Gerät, und der Server liefert ihren Verlauf ([Verlauf](#verlauf)), sodass das Dashboard dafür nie seine eigene Datenbank liest. Was gebaut ist und wie es eingeschaltet wird:

* **Das Gerät.** Mit gesetztem `HOTLOOP_BOX_HEALTH_NODE` (das Chart setzt es auf den Namen des Kubernetes-Knotens) legt HotLoop ein Gerät an, dessen ID genau dieser Name ist, mit dem Protokoll `boxhealth` ([Protokolle und Treiber](/de/iot/protocols/#zustand-der-box)). Seine Tags sind `cpu_util_pct`, `mem_util_pct`, `disk_util_pct` (der eigene Datenträger der Maschine), `data_util_pct` (das Volume, auf dem HotLoop seine Daten hält) und, nur wenn `HOTLOOP_BOX_HEALTH_JITTER_FILE` die JSON-Datei nennt, die ein Echtzeit-Agent schreibt, `rtos_jitter_core1_us`, `rtos_jitter_core2_us` und `rtos_jitter_core3_us`. Ihre OPC-UA-Knoten-IDs liegen im Namespace `urn:hotloop:ua:gateway` mit dem String-Bezeichner `<device id>/<tag>`.
* **Die Zahlen der Maschine.** Das Chart bindet das Root des Hosts unter `/host` und dessen `/proc` unter `/host/proc` ein, beides schreibgeschützt, und setzt den Knotennamen, **standardmäßig** (`opcuaServer.dashboard.boxHealth.enabled: true`), sodass der Task-Manager des Dashboards funktioniert, sobald HotLoop installiert ist. Gelesen werden nur ein statfs von `/host` sowie die CPU- und Speicherzähler, und es wird kein Privileg hinzugefügt. Ein Cluster, der das eingeschränkte Pod-Security-Profil erzwingt, lehnt einen hostPath ab: Setzen Sie dort `enabled: false` (kein Gerät, keine Mounts) oder `hostMount: false` (das Gerät, aber Datenträger und CPU der Maschine lesen Bad und sagen, was einzubinden ist). Das Gerät braucht den OPC-UA-Server nicht.
* **Ein Zugang, der lesen kann und sonst nichts.** Das Chart legt bei der ersten Installation den Benutzer `embernet-dashboard-read` mit genau `tags.read` und `values.read` an (eine explizite Berechtigungsliste, nie eine Rolle) und hält sein erzeugtes Passwort im Secret `<release>-opcua-dashboard` (Schlüssel `username`, `password` und `password-hash`). Ein Upgrade rotiert es nie. Ein bestehendes Konto wird durch einen Neustart nie verändert.
* **Das Zertifikat des Dashboards.** Das Dashboard legt das Secret `<release>-opcua-trust` an, ein Schlüssel pro Zertifikat mit dem Namen `<sha1 thumbprint>.crt`. Das Chart bindet es optional unter `/etc/hotloop/opcua-trust` ein, und der Server hält diese Dateien in `trusted/` (`HOTLOOP_OPCUA_SERVER_TRUST_DIR`): Beim Start und alle 30 Sekunden wird eine neue Datei hinzugefügt, eine geänderte neu geschrieben und eine, die das Secret verlässt, wieder entfernt. Eine Datei, die ein Bediener in `trusted/` gelegt hat, wird nie angefasst und hat Vorrang vor einem Secret-Schlüssel gleichen Namens.
* **Der Port.** Der eigene Service des Releases (den das Dashboard entdeckt) führt den OPC-UA-Port 4840 auf, wenn der Server eingeschaltet ist, neben dem eigenen Service des OPC-UA-Servers.

Der Server bleibt, wie er war: Basic256Sha256 SignAndEncrypt, keine anonymen Sitzungen, kein Vertrauen in alles.

## Sicherheitsmodell

### Transport

Sichere Kanäle nutzen die Richtlinien der Bibliothek in Sign und SignAndEncrypt. **`Basic256Sha256` wird in beiden Modi angeboten**, und das sollte ein Client wählen.

**Die Sicherheitsrichtlinie None ist eine ausdrückliche Aktivierung** (`HOTLOOP_OPCUA_SERVER_ALLOW_INSECURE`, standardmäßig false), mit einer Warnung beim Start, wenn sie an ist. Ist sie aus, wird kein None-Endpunkt angekündigt, und ein Client, der trotzdem einen None-Kanal öffnet, kann nur Discovery ausführen: Jeder andere Dienst wird abgelehnt. Auch mit ihr bleiben Benutzername und Passwort in einem verschlüsselten Token (die Token-Richtlinie ist `Basic256Sha256`, nie None), auch wenn jeder Wert, den ein Client danach liest, ungeschützt ist.

**Die veralteten Richtlinien sind standardmäßig aus.** Die OPC Foundation hat `Basic128Rsa15` (RSA mit PKCS#1-v1.5-Padding) und `Basic256` (SHA-1) für veraltet erklärt. In früheren Releases wurden beide in jeder Endpunktliste angeboten, ohne Möglichkeit, sie zu entfernen. `HOTLOOP_OPCUA_SERVER_ALLOW_DEPRECATED_POLICIES` (Chart: `opcuaServer.allowDeprecatedPolicies`, standardmäßig `false`) entscheidet:

- **Aus (der Standard, bei Neuinstallationen und Upgrades).** Keine der beiden Richtlinien steht in einem Endpunkt, der einem Client genannt wird, und ein Client, der trotzdem einen sicheren Kanal mit einer von ihnen öffnet, wird beim Öffnen des Kanals abgelehnt, vor jeder Sitzung und Anmeldung. Clients mit `Basic256Sha256`, `Aes128_Sha256_RsaOaep` oder `Aes256_Sha256_RsaPss` sind nicht betroffen.
- **An.** Beide werden wieder in Sign und SignAndEncrypt angeboten, für einen Altclient, der nichts Neueres spricht, mit einer Warnung beim Start. Schalten Sie sie nur ein, bis dieser Client aktualisiert ist.

Ein Client, der nach dem Upgrade nicht mehr verbindet und eine dieser beiden Richtlinien verwendet, zeigt, dass der Kanal abgelehnt wird; setzen Sie die Einstellung oder stellen Sie den Client auf `Basic256Sha256` um.

### Serverzertifikat

Wenn `HOTLOOP_OPCUA_SERVER_CERT_FILE` und `_KEY_FILE` gesetzt sind, wird dieses RSA-Paar unverändert verwendet. Andernfalls wird beim ersten Start ein **selbstsigniertes Anwendungsinstanz-Zertifikat erzeugt und gespeichert**, unter `HOTLOOP_OPCUA_SERVER_PKI_DIR` (`own/cert.pem`, `own/key.pem`, Schlüssel mit Modus 0600), sodass der nächste Start dasselbe Zertifikat vorlegt und ein Client, dem einmal gesagt wurde, ihm zu vertrauen, nicht erneut gefragt wird. Bei jedem Start wird, solange das Zertifikat selbstsigniert ist, eine Warnung mit seinem SHA-1-Fingerabdruck protokolliert, der Form, die OPC-UA-Werkzeuge zeigen, damit ein Bediener ihn mit dem vergleichen kann, was ein Client anzeigt.

Das Zertifikat sagt, was OPC-UA-Clients prüfen, was ein gewöhnliches TLS-Zertifikat nicht tut: die **Anwendungs-URI** (`HOTLOOP_OPCUA_SERVER_APPLICATION_URI`, standardmäßig `urn:hotloop:gateway`, plus `:<siteId>`, wenn eine konfiguriert ist) in den URI-Subject-Alternative-Names, die Hostnamen und Adressen, die Clients verwenden (der Endpunkt-Host, `HOTLOOP_OPCUA_SERVER_CERT_HOSTS`, `localhost`, Loopback, der Hostname dieser Maschine) als DNS- und IP-SANs, und die Schlüsselverwendungen, die Teil 6 für eine Anwendungsinstanz aufführt. RSA-2048, fünf Jahre.

Ein gespeichertes Zertifikat wird, mit einer Warnung, dass Clients dem neuen vertrauen müssen, nur ersetzt, wenn es seine Aufgabe nicht mehr erfüllen kann: weniger als 30 Tage Restlaufzeit, eine Anwendungs-URI, die nicht mehr zur Konfiguration passt, ein konfigurierter Host, den es nicht abdeckt, oder ein Schlüssel, der nicht gelesen werden kann.

**Der Hostname der Maschine ist kein konfigurierter Host.** Er fließt in ein neues Zertifikat ein, aber ein gespeichertes Zertifikat bleibt erhalten, wenn sich der Hostname ändert. In einem Container ist der Hostname die ID des Containers, in Kubernetes der Name des Pods, er ändert sich also bei jedem Redeploy. Bis das behoben wurde, zählte er, und jedes Upgrade eines containerisierten Gateways erzeugte ein neues Zertifikat: Ignition, dem gesagt worden war, dem alten zu vertrauen, lehnte den Server mit `Bad_SecurityChecksFailed` ab, bis jemand ihm wieder vertraute, auf jedem Client, nach jedem Deployment. Clients erreichen den Server über `HOTLOOP_OPCUA_SERVER_ENDPOINT_HOST` und `_CERT_HOSTS`; setzen Sie diese, und das Zertifikat lebt, bis sein Ablauf naht. (Ein Gateway ohne gesetzten Endpunkt-Host verwendet den Hostnamen der Maschine als Endpunkt-Host, und dieser zählt, da er den Clients genannt wird. Ein weiterer Grund, ihn zu setzen.)

**Ein Schlüssel kann unbrauchbar sein, und der Server lehnt ihn ab.** Etwa jeder zwanzigste RSA-Schlüssel kann keine verschlüsselte OPC-UA-Anmeldung tragen, und jede verschlüsselte Anmeldung mit diesem Schlüssel schlägt dann immer fehl, wobei der Client nur „der sichere Kanal wurde geschlossen“ sieht. Anonyme und unverschlüsselte Sitzungen sind nicht betroffen, und genau das macht die Fehlersuche leicht irreführend. Ein erzeugter Schlüssel wird so lange neu gezogen, bis er keiner dieser Schlüssel ist; ein vom Bediener gelieferter Schlüssel, der einer ist, wird beim Start mit einem Fehler abgelehnt, der den Grund nennt.

### Anwendungszertifikate der Clients

OPC UA authentifiziert die Anwendung ebenso wie den Benutzer. Der Server führt eine Vertrauensliste in `<PKI_DIR>/trusted/`: Ein Client, dessen Zertifikat dort nicht steht, wird am sicheren Kanal abgelehnt, und sein Zertifikat wird nach `<PKI_DIR>/rejected/` geschrieben. **Um einen Client zu genehmigen, verschieben Sie sein Zertifikat von `rejected/` nach `trusted/`**, ohne Neustart; das Verzeichnis wird bei jeder Verbindung gelesen. `<PKI_DIR>/issuers/` und `<PKI_DIR>/crl` werden für CA-ausgestellte Client-Zertifikate durchgereicht.

`HOTLOOP_OPCUA_SERVER_TRUST_ALL_CLIENT_CERTS` (standardmäßig false, mit einer Warnung beim Start) überspringt diesen Schritt. Es entfernt nur die Authentifizierung der Anwendung: Ein Benutzer muss sich weiterhin mit einem HotLoop-Benutzernamen und Passwort authentifizieren.

### Wer sich anmelden darf

**Benutzername und Passwort, gegen die eigenen Benutzer von HotLoop.** Es gibt eine einzige Benutzerdatenbank und keinen zweiten Speicher für Zugangsdaten: Der Authentifikator sucht den Benutzer mit demselben `store.User` wie die HTTP-Anmeldung, vergleicht mit denselben bcrypt-Hashes (`auth.CheckPassword`), normalisiert den Benutzernamen genauso (Kleinbuchstaben, ohne Leerraum an den Rändern), führt einen bcrypt-Vergleich aus, ob der Benutzer existiert oder nicht, damit die Antwortzeit nicht verrät, welche Namen echt sind, und lehnt ein deaktiviertes Konto ab. Unbekannter Benutzer, falsches Passwort, deaktivierter Benutzer und Benutzer ohne die Berechtigung erhalten alle dieselbe Antwort, `BadUserAccessDenied`.

**Ein Benutzer darf Tags nur lesen, wenn seine Rolle `tags.read` und `values.read` gewährt**, dasselbe Paar, mit dem die HTTP-API `/api/tags` und `/api/values` schützt, aufgelöst über dieselben `auth.Permissions` und `auth.Allows`, sodass sich eine integrierte Rolle und eine explizite Berechtigungsliste genau wie dort verhalten. Beide sind nötig, weil ein OPC-UA-Client die Tag-Liste durchsucht und Werte über eine einzige Verbindung liest, und ein Benutzer mit nur einem der beiden sonst das andere gratis bekäme. Jede integrierte Rolle mit `values.read` hat auch `tags.read`; das greift nur bei einem Benutzer mit expliziter Berechtigungsliste.

**Berechtigungen werden bei der Nutzung geprüft, nicht nur bei der Anmeldung.** Die Bibliothek fragt bei jedem Browse, Lesezugriff und jeder Abonnement-Stichprobe die Rollen einer Sitzung ab; sie werden aus einem kurzlebigen Cache (10 s) der Benutzerdatenbank beantwortet. Ein Benutzer, der deaktiviert oder gelöscht wird oder Berechtigungen verliert, verliert den Zugriff auf einer laufenden Sitzung innerhalb dieses Intervalls, wobei seine überwachten Elemente auf Bad gehen, und nicht erst, wenn sich sein Client das nächste Mal verbindet. Eine fehlgeschlagene Abfrage zählt als „nein“.

**Anonyme Sitzungen sind aus** (`HOTLOOP_OPCUA_SERVER_ALLOW_ANONYMOUS`), und es wird kein anonymes Token angeboten, wenn man es nicht aktiviert, mit einer Warnung beim Start. X.509-Benutzeridentitätstoken sind ebenfalls aus und werden angeboten, wenn `HOTLOOP_OPCUA_SERVER_ALLOW_X509` gesetzt ist (siehe [X.509-Benutzerzertifikate](#x509-benutzerzertifikate)). Ist die eigene Authentifizierung von HotLoop aus (`HOTLOOP_AUTH_INSECURE`), gibt es keine Benutzer zum Anmelden, und der Server weigert sich zu starten, sofern nicht anonymer Zugriff aktiviert ist.

Eine erfolgreiche Anmeldung wird im Systemprotokoll vermerkt wie eine HTTP-Anmeldung. Fehlgeschlagene Anmeldungen werden nur im Prozessprotokoll vermerkt, mit dem Grund, damit ein nicht authentifizierter Aufrufer den Audit-Trail nicht füllen kann. Höchstens vier Passwortprüfungen laufen gleichzeitig, da jede ein absichtlich langsamer bcrypt-Vergleich ist und OPC UA kein Gegenstück zum Ratenbegrenzer vor HTTP hat; darüber hinaus gibt es weder Sperre noch Ratenbegrenzung, genau wie bei der HTTP-Anmeldung.

Die Bibliothek hält die entschlüsselte Benutzeridentität, Passwort eingeschlossen, im Sitzungsobjekt, solange die Sitzung lebt. Sie liegt nur im Speicher und wird nie protokolliert, aber ein Heap-Dump eines laufenden Gateways würde die Passwörter der gerade verbundenen Benutzer enthalten.

**Passwörter jeder Länge, die HotLoop akzeptiert, bis zu 72 Bytes (dem Limit von bcrypt), melden sich an.** In früheren Releases konnte sich ein Passwort mit 65 bis 72 Bytes an der Web-Oberfläche anmelden, aber hier nicht (`BadIdentityTokenRejected`). Die Länge zählte das Passwort plus die 32-Byte-Server-Nonce, sodass das Passwort bei 64 Bytes endete. Nichts in RSA oder in der Spezifikation verlangt das: Das Token wird in so vielen Blöcken verschlüsselt, wie es braucht, und der Decoder liest bereits alle. Die Prüfung lautet jetzt, dass die Länge mindestens 32 beträgt und nicht größer ist als die tatsächlich entschlüsselten Bytes, was die Prüfung ohnehin sicherstellen sollte, da sie den danach angelegten Puffer bemisst. Eine Länge, die mehr behauptet, als ankam, wird weiterhin abgelehnt, sodass ein Client den Server nicht dazu bringen kann, etwas zu reservieren, das er nicht gesendet hat. Der Upstream-Zweig `main` (geprüft am 2026-11-16) hat die Grenze noch; die Änderung wird upstream als Pull-Request von HotLoop-io/opcua angeboten.

### X.509-Benutzerzertifikate

Ein Client kann sich mit einem Zertifikat statt mit einem Passwort anmelden. Standardmäßig aus: Setzen Sie `HOTLOOP_OPCUA_SERVER_ALLOW_X509=true` (Chart `opcuaServer.allowX509`), und der Server bietet das Benutzertoken Certificate an seinen gesicherten Endpunkten an und meldet das beim Start. Ohne das bietet kein Endpunkt eines an, und eine Zertifikatsanmeldung wird abgelehnt.

**Wie ein Zertifikat einem Benutzer zugeordnet wird.** Ein Admin hängt das Zertifikat an einen HotLoop-Benutzer: Einstellungen, OPC-UA-Zertifikate, Zertifikat anhängen (oder die API, `POST /api/users/{username}/certificates`, oder das MCP-Werkzeug `add_user_certificate`). Das Register hält das öffentliche Zertifikat, seinen SHA-256-Fingerabdruck, wer es angehängt hat und wann, ob es widerrufen ist und wann es sich zuletzt angemeldet hat. Ein Client, der es vorlegt und nachweist, den privaten Schlüssel zu besitzen, meldet sich **als dieser Benutzer** an. Sonst wird nichts konfiguriert, und dem Zertifikat selbst wird nichts vertraut: Der Common Name wird nicht angesehen, es gibt keine CA zu betreiben, und ein Zertifikat, das niemand angehängt hat, bewirkt nichts.

**Was das Token trägt.** Ein Client darf sein Zertifikat gefolgt von denen senden, die es ausgestellt haben; das erste ist das Zertifikat, das angehängt wurde, die übrigen werden ignoriert.

**Schlüsselnachweis.** Die Bibliothek prüft die Signatur des Tokens über das Serverzertifikat und die Sitzungs-Nonce, die nur der Besitzer des privaten Schlüssels erzeugen kann; ein Zertifikat, das mit der Signatur eines anderen Schlüssels vorgelegt wird, wird abgelehnt.

**Was es darf.** Genau das, was der Benutzer darf. Die Anmeldung setzt voraus, dass der Benutzer aktiviert ist und `tags.read` und `values.read` hat, dasselbe Paar wie bei einer Passwortanmeldung, und die Sitzung wird wie eine solche alle 10 Sekunden geprüft: Ein Benutzer, der deaktiviert wird oder die Berechtigung verliert, verliert eine laufende Zertifikatssitzung innerhalb dieses Intervalls. Sie ist schreibgeschützt wie jede Sitzung hier; eine Zertifikatssitzung kann nicht schreiben, egal welche Rolle der Benutzer hat.

**Abgelehnt, mit dem Grund im Protokoll.** Ein Zertifikat, das nicht registriert, widerrufen, abgelaufen oder noch nicht gültig ist oder dessen Benutzer fehlt, deaktiviert ist oder die Berechtigung nicht hat, erhält `BadUserAccessDenied`, für alle dieselbe Antwort, sodass ein Client nichts darüber erfährt, welcher Fall vorliegt. Der Grund geht ins Prozessprotokoll und in den Audit-Trail.

**Widerrufen.** Widerrufen Sie es auf demselben Bildschirm (oder mit `POST .../{thumbprint}/revoke`). Es meldet sich sofort nicht mehr an, und eine damit geöffnete Sitzung endet innerhalb von 10 Sekunden. Ein widerrufenes Zertifikat bleibt aufgelistet, mit Angabe, wer es wann widerrufen hat, sodass eine abgelehnte Anmeldung „widerrufen“ und nicht „unbekannt“ sagt; löschen Sie es, um es zu vergessen. Backups enthalten das Register samt Widerrufen.

**Audit.** Jede Zertifikatsanmeldung ist ein Logbuch-Eintrag (Kategorie auth), der den Benutzer, den Fingerabdruck und das Subject des Zertifikats und die Client-Anwendung nennt. Jede Ablehnung ist ebenfalls einer, mit dem Grund. Ein Client, der dieselbe Ablehnung wiederholt, schreibt pro Minute einen Eintrag für dieses Zertifikat und diesen Grund, nicht einen pro Versuch; jede Ablehnung steht trotzdem im Prozessprotokoll. Anhängen, Widerrufen und Löschen eines Zertifikats sind Einträge mit dem Namen dessen, der es getan hat. Der private Schlüssel steht in keinem davon, und HotLoop hat nie einen: Es werden nur öffentliche Zertifikate gesendet oder gespeichert.

**Nicht die Vertrauensliste der Anwendungen.** Ein Client-Anwendungszertifikat in `<PKI_DIR>/trusted/` lässt den Client einen sicheren Kanal öffnen; es ist keine Anmeldung. Ein Benutzerzertifikat ist ein anderes Objekt: das einer Person, an einen Benutzer angehängt. Ein Zertifikat kann auf der Client-Seite für beides dienen, aber der Server behandelt es als zwei Vorgänge.

**Auch der eigene Client von HotLoop** meldet sich so an: siehe `userCertificate` und `userPrivateKey` in [Protokolle und Treiber](/de/iot/protocols/#opc-ua).

Nicht gebaut: eine Zertifizierungsstelle, der man zutraut, für Client-Zertifikate zu bürgen, und eine Namensregel, die sie Benutzern zuordnet. Das Register deckt ein Werk ab, das seine Client-Zertifikate einzeln anhängt; eine CA wäre eine Ergänzung dazu, kein Ersatz.

**RsaEncryptedSecret, das Format, das OPC UA über 64 Byte verlangt.** OPC 10000-4 7.40.4 sagt, dass ein Client ein Passwort über 64 Byte bei einer RSA-Sicherheitsrichtlinie als RsaEncryptedSecret (7.40.2.4) verschlüsselt, nicht im alten Format. Der eigene Client der OPC Foundation macht genau das, und der OPC-UA-Client von HotLoop jetzt auch. Der Server liest beides. Er schaut zuerst auf den Anfang des Tokens: Bei einem RsaEncryptedSecret werden Sicherheitsrichtlinie, Zertifikat, Signaturzeit, Signatur, Padding und die Nonce der Sitzung geprüft, und das Passwort wird nur herausgegeben, wenn alles stimmt; alles andere geht an den alten Decoder, sodass sich ein Client, der das alte Format über 64 Byte sendet, weiterhin anmeldet. Abgedeckt sind alle RSA-Richtlinien, `Basic256Sha256`, `Aes128_Sha256_RsaOaep` und `Aes256_Sha256_RsaPss`, sowie `Basic128Rsa15` und `Basic256`, wenn sie eingeschaltet sind. Bewiesen gegen den Reference Server und den ConsoleReferenceClient der OPC Foundation (UA-.NETStandard 2.0.2) in beide Richtungen, mit einem Benutzer, dessen Passwort 10, 64, 65, 72, 100 und 200 Byte lang ist.

### Server-Diagnose ist entfernt

Die Diagnoseknoten pro Sitzung der Bibliothek würden jedem angemeldeten Benutzer erlauben, den Benutzernamen und die Client-Adresse jeder anderen Sitzung zu durchsuchen, daher sind sie ausgeschaltet, und das Objekt `Server/ServerDiagnostics` ist aus dem Adressraum entfernt (die Bibliothek schreibt ihre Zähler außerdem ohne Sperre).

## Änderungen am Adressraum zur Laufzeit

Geräte und Tags werden hinzugefügt, bearbeitet und entfernt, während das Gateway läuft, und der Adressraum folgt ohne Neustart. **Mechanismus: ein Runtime-Callback plus ein Timer als Sicherheitsnetz.**

- `runtime.Manager.OnReload` ruft nach jedem erfolgreichen `Reload` zurück. Jede Geräte- und Tag-Änderung der API endet in einem `Reload`, sodass eine über die Oberfläche oder API gemachte Änderung binnen Momenten veröffentlicht wird. Der Callback signalisiert nur eine Abgleich-Goroutine; er erledigt die Arbeit nie selbst, sodass ein langsamer Abgleich die API-Anfrage, die ihn auslöste, nicht blockieren kann.
- Ein periodischer Abgleich (`HOTLOOP_OPCUA_SERVER_RECONCILE_INTERVAL`, standardmäßig 30 s) fängt alles auf, was die Konfiguration ohne `Reload` ändert.

Beide führen denselben idempotenten Abgleich gegen die aktivierten Geräte und Tags in der Datenbank aus. Er fasst nur an, was abweicht: Ein bearbeiteter Tag wird ersetzt, ein entfernter gelöscht, und alles andere, einschließlich der überwachten Elemente, die Clients darauf halten, bleibt genau, wie es war. Die Knoten eines neuen Geräts kommen in einem Aufruf in den Raum, sodass ein Client, der mitten im Abgleich browst, ein Gerät mit allen seinen Tags sieht oder gar keines.

Ein Callback wurde dem alleinigen Polling vorgezogen, weil die Runtime bereits das eine saubere Signal (`Reload`) hat und es eine Änderung in Millisekunden sichtbar macht statt erst nach einem vollen Intervall; der Timer bleibt, weil der Adressraum nicht davon abhängen soll, dass jeder künftige Schreiber von Konfiguration ans Neuladen denkt.

## Einen Client verbinden

Der Endpunkt ist `opc.tcp://<HOTLOOP_OPCUA_SERVER_ENDPOINT_HOST>:<port>`. In einem Cluster setzt das Chart den Host standardmäßig auf den DNS-Namen des Release-Service; außerhalb setzen Sie ihn auf den Namen oder die Adresse, die Clients tatsächlich verwenden (eine LoadBalancer-Adresse, ein DNS-Eintrag): Er wird in jeder Endpunkt-URL angekündigt und in das erzeugte Zertifikat geschrieben. Er ist **nicht**, woran der Server bindet: Die Bibliothek lauscht auf allen Schnittstellen und nimmt nur einen Port.

Mit UaExpert oder einem anderen Client:

1. Fügen Sie den Server mit dieser URL hinzu und wählen Sie `Basic256Sha256` / `Sign & Encrypt`.
2. Wählen Sie *Username* und melden Sie sich mit einem HotLoop-Benutzer an, der `tags.read` und `values.read` hat; oder wählen Sie, wenn `HOTLOOP_OPCUA_SERVER_ALLOW_X509` an ist, *Certificate* und geben Sie das Benutzerzertifikat und den Schlüssel an, die ein Admin an einen Benutzer angehängt hat.
3. Die erste Verbindung wird abgelehnt, weil der Server dem Zertifikat des Clients noch nicht vertraut. Suchen Sie es in `<PKI_DIR>/rejected/` (im Cluster auf dem PKI-Volume), verschieben Sie es nach `trusted/` und verbinden Sie erneut.
4. Beim ersten Mal fragt der Client, ob dem Zertifikat des Servers vertraut werden soll; vergleichen Sie den Fingerabdruck mit dem im Startprotokoll.
5. Browsen Sie *Objects* → das Gerät → seine Tags und ziehen Sie Tags in die Datenzugriffsansicht; sie abonnieren.

## Ignition 8.3 als Client

**Am 2026-09-27 gegen Ignition 8.3.9 verifiziert**, das aktuelle stabile Release, im offiziellen Container-Image von Inductive Automation (`inductiveautomation/ignition:8.3.9`, Standard-Edition im Testzeitraum), gegen ein HotLoop-Gateway, dessen Demogerät `extruder-1` von einem Simulator gespeist wird. Was durchgängig gezeigt wurde:

- eine OPC-UA-Verbindung von Ignition zu `opc.tcp://<gateway>:4840` mit `Basic256Sha256` und `SignAndEncrypt`, angemeldet als HotLoop-**viewer**;
- das Zertifikatsvertrauen in beide Richtungen, wie unten;
- OPC-Tags im `[default]`-Provider von Ignition, die auf HotLoop-Knoten zeigen, mit Qualität Good gelesen und sich ändernd, während der Simulator läuft. Jeder von Ignition gezeigte Wert war einer, den `/api/values` von HotLoop gehalten hatte: Derselbe Double geht unverändert über die Leitung, sodass sie auf Gleichheit verglichen werden, nicht auf Nähe. Ein in HotLoop als `string` deklarierter Text-Tag las „RUNNING“ in einem String-Tag von Ignition;
- ein abgelehnter Schreibzugriff von Ignition: Ignition sendete den Schreibzugriff, HotLoop antwortete `Bad_NotWritable` (auf der Leitung über einen reinen Sign-Kanal abgelesen, wo die Antwort signiert, aber nicht verschlüsselt ist), und der Wert von HotLoop bewegte sich nicht;
- jede Sicherheitsrichtlinie und jeder Modus, den Ignition anbietet, unten.

### Einrichtung

Auf der HotLoop-Seite, vor Ignition:

1. Schalten Sie den Server ein und setzen Sie `HOTLOOP_OPCUA_SERVER_ENDPOINT_HOST` auf den Namen, unter dem Ignition das Gateway erreicht. Dieser Name steht in jeder Endpunkt-URL, die der Server ankündigt, und in seinem Zertifikat.
2. Legen Sie für Ignition einen HotLoop-Benutzer mit der Rolle **viewer** an (ein Admin macht das mit `POST /api/users`; siehe [Authentifizierung und Benutzer](/de/iot/authentication/)). Jede Rolle mit `tags.read` und `values.read` meldet sich an; mehr wird nicht angeboten, da der Server schreibgeschützt ist.

Im Ignition-Gateway (die Weboberfläche auf Port 8088):

3. Legen Sie auf der Seite **OPC Connections** unter Connections (`/app/connections/opc-client-connections`) eine **OPC UA**-Verbindung an. Endpunkt-URL `opc.tcp://<gateway>:4840`; wählen Sie den Endpunkt `Basic256Sha256` / `SignAndEncrypt`; Authentifizierung **Username**, mit dem HotLoop-Benutzer und Passwort. Die Verbindung geht sofort auf Faulted, was erwartet ist: Schritt 4.
4. **Genehmigen Sie Ignition in HotLoop.** Das Client-Zertifikat von Ignition liegt jetzt im `<PKI_DIR>/rejected/` des Gateways (`/data/opcua-pki/rejected` im Container und im Chart), benannt nach seinem SHA-1-Fingerabdruck, `<thumbprint>.crt`. Vergleichen Sie den Fingerabdruck mit dem eigenen OPC-UA-Client-Zertifikat von Ignition, das auf der Seite der OPC-Zertifikate angezeigt wird (`/app/connections/opc/security/certificates`). Verschieben Sie dann die Datei nach `trusted/`. Auf keiner Seite ein Neustart. HotLoop protokolliert die Ablehnung nicht; die Datei ist das einzige Zeichen.
5. **Genehmigen Sie HotLoop in Ignition.** Die Verbindung scheitert jetzt in der anderen Richtung: Der Status lautet `Bad_SecurityChecksFailed ... unable to find valid certification path`. Das Zertifikat von HotLoop liegt in den abgelehnten **Client**-Zertifikaten von Ignition, auf derselben Seite. Prüfen Sie seinen Fingerabdruck gegen den, den HotLoop beim Start protokolliert (`generated a self-signed OPC UA application certificate ... thumbprint=`), und vertrauen Sie ihm. Kein Neustart; die Verbindung steht binnen Sekunden.
6. **Tags.** Legen Sie OPC-Tags mit der Verbindung als OPC-Server an, mit Elementpfaden in der Namespace-URI-Form, die Ignition unverändert akzeptiert:

   ```
   nsu=urn:hotloop:ua:gateway;s=extruder-1/Emberburn_Temperature
   ```

   Deklarieren Sie jeden als das, was HotLoop veröffentlicht (siehe [Datentypen](#datentypen)): Float8 für einen float, Boolean, String, Int2 für einen `int16`, Int4 für einen `uint16` oder `int32`, Int8 für die breiteren Ganzzahlen. Sie abonnieren mit der Rate der Tag-Gruppe, und HotLoop hebt eine schnellere Abtastrate auf das Abfrageintervall des Geräts an.

Dasselbe, als Dateien oder über die REST-API:

- Die Verbindung ist die Ressource `data/config/resources/core/ignition/opc-connection/<name>/config.json`, Profiltyp `com.inductiveautomation.OpcUaServerType`, oder `POST /data/api/v1/resources/ignition/opc-connection`. Zwei Dinge darin sind nicht offensichtlich. Das Passwort ist ein eingebettetes Secret, ein JWE, das `POST /data/api/v1/encryption/encrypt` aus dem Klartext erzeugt; ein einfacher String wird nicht akzeptiert. Und der Block `security` braucht den Alias des Client-Schlüsselspeichers des Gateways und sein Passwort: Lässt man ihn weg, scheitert die Verbindung mit einer NullPointerException, bei leerem Alias mit `Unable to retrieve KeyPair for alias 'client'`. Kopieren Sie den Block aus der mitgelieferten Loopback-Verbindung `Ignition OPC UA Server`, die beides trägt.
- Die Zertifikate liegen unter `data/config/local/com.inductiveautomation.opcua/client/security/pki/` (`rejected/certs`, `trusted/certs`), oder über `GET /data/opc-ua/api/v1/client/pki/certificates/rejected` und `POST .../trusted/<sha1>` per API. **Ignition benennt die Dateien nicht nach dem Fingerabdruck**; das Feld `signature` der API ist der SHA-1-Fingerabdruck, und er stimmt mit dem überein, was HotLoop protokolliert.
- Tags werden mit `POST /data/api/v1/tags/import?provider=default&type=json` importiert.
- Jeder API-Aufruf braucht einen API-Schlüssel (die Seite API Keys, `/app/platform/security/api-keys`), und ein Schlüssel kommt nur durch, wenn eine seiner Sicherheitsstufen in den Lese- oder Schreibberechtigungen des Gateways steht (die Ressource `security-properties`).

### Was zu erwarten ist

- **`Bad_SecurityChecksFailed` bedeutet zwei verschiedene Dinge.** Ignition zeigt denselben Status, wenn HotLoop das Zertifikat von Ignition ablehnt (Schritt 4; die Meldung nennt keinen Grund) und wenn Ignition das von HotLoop ablehnt (Schritt 5; die Meldung sagt *unable to find valid certification path*). Schauen Sie zuerst in das `rejected/` von HotLoop.
- **Ein Redeploy von HotLoop behält sein Zertifikat.** Bis 4.15.3 war das nicht so: Das Zertifikat musste den Hostnamen des Containers abdecken, der sich ändert, sooft der Container neu erstellt wird, sodass jedes Upgrade ein neues Zertifikat erzeugte und Ignition den Server ablehnte, bis jemand ihm wieder vertraute. Siehe [Serverzertifikat](#serverzertifikat). Das Zertifikat ändert sich weiterhin, wenn das PKI-Volume verloren geht.
- **Ein als numerisch deklarierter Text-Tag liest `Bad_TypeMismatch`.** HotLoop veröffentlicht einen Tag als den Typ, als der er deklariert ist, und ein `float`-Tag mit „RUNNING“ kann kein Double sein. Von Discover tags bis 4.15.3 angelegte Tags waren alle als `float` deklariert; siehe [Protokolle und Treiber](/de/iot/protocols/#opc-ua). Deklarieren Sie sie als `string`.
- **Schreibzugriffe werden abgelehnt, und Ignition verwischt den Grund.** HotLoop antwortet `Bad_NotWritable`. Der eigene OPC-UA-Server von Ignition gibt, wenn man ihn denselben Tag beschreiben lässt, nur ein generisches `Bad` (0x80000000) weiter. Der Wert des Ignition-Tags ändert sich nicht.
- **Die veralteten Richtlinien funktionieren nur, wenn sie eingeschaltet sind.** Ignition bietet `Basic128Rsa15` und `Basic256` an. Wählen Sie in der Verbindung `Basic256Sha256` oder eine der `Aes`-Richtlinien.
- **Der Testzeitraum.** Ein nicht lizenziertes 8.3-Gateway läuft zwei Stunden und führt dann nichts mehr aus, bis der Test in der Weboberfläche des Gateways zurückgesetzt wird. Tags veralten, wenn er abläuft; das ist Ignition, nicht die Verbindung.

### Richtlinienmatrix

Jede Zeile ist eine frische Sitzung mit dieser Richtlinie und diesem Modus, die Live-Werte liest. Die beiden veralteten Zeilen wurden mit eingeschaltetem `HOTLOOP_OPCUA_SERVER_ALLOW_DEPRECATED_POLICIES` gemessen; ist es aus, wie standardmäßig, werden diese beiden Richtlinien nicht angeboten, und ein Kanal, der eine verlangt, wird abgelehnt:

| Richtlinie | SignAndEncrypt | Sign |
|---|---|---|
| `Basic256Sha256` | funktioniert | funktioniert |
| `Aes128_Sha256_RsaOaep` | funktioniert | funktioniert |
| `Aes256_Sha256_RsaPss` | funktioniert | funktioniert |
| `Basic256` (veraltet) | funktioniert | funktioniert |
| `Basic128Rsa15` (veraltet) | funktioniert | funktioniert |

`None` wird nicht angeboten, sofern `HOTLOOP_OPCUA_SERVER_ALLOW_INSECURE` nicht gesetzt ist, und wurde nicht ausprobiert.

## Konfiguration

| Variable | Standard | <span class="sr-only">Details</span> |
|---|---|---|
| `HOTLOOP_OPCUA_SERVER_ENABLED` | `true` | Im Binary und im Chart an; `false` schaltet den Server aus |
| `HOTLOOP_OPCUA_SERVER_PORT` | `4840` | TCP-Port, auf allen Schnittstellen |
| `HOTLOOP_OPCUA_SERVER_ENDPOINT_HOST` | der Hostname dieser Maschine | Womit sich Clients verbinden sollen; wird auch in ein erzeugtes Zertifikat geschrieben. **Setzen Sie das.** |
| `HOTLOOP_OPCUA_SERVER_APPLICATION_URI` | `urn:hotloop:gateway[:<siteId>]` | Muss über Neustarts stabil bleiben; muss eine URI sein |
| `HOTLOOP_OPCUA_SERVER_PKI_DIR` | `/data/opcua-pki` | Zertifikat, Schlüssel, `trusted/`, `rejected/`. Mit einem Volume hinterlegen |
| `HOTLOOP_OPCUA_SERVER_CERT_FILE` / `_KEY_FILE` | n/a | Dieses RSA-Paar statt eines erzeugten verwenden; beide setzen oder keines |
| `HOTLOOP_OPCUA_SERVER_CERT_HOSTS` | n/a | Zusätzliche DNS-Namen / IPs für ein erzeugtes Zertifikat |
| `HOTLOOP_OPCUA_SERVER_ALLOW_INSECURE` | `false` | Die Sicherheitsrichtlinie None anbieten. Warnung beim Start |
| `HOTLOOP_OPCUA_SERVER_ALLOW_ANONYMOUS` | `false` | Sitzungen ohne Identität akzeptieren. Warnung beim Start |
| `HOTLOOP_OPCUA_SERVER_TRUST_ALL_CLIENT_CERTS` | `false` | Die Genehmigung von Client-Zertifikaten überspringen. Warnung beim Start |
| `HOTLOOP_OPCUA_SERVER_ALLOW_X509` | `false` | Das Benutzertoken Certificate anbieten: Ein Client meldet sich mit einem an einen Benutzer angehängten Zertifikat an ([X.509-Benutzerzertifikate](#x509-benutzerzertifikate)). Hinweis beim Start |
| `HOTLOOP_OPCUA_SERVER_ALLOW_DEPRECATED_POLICIES` | `false` | Die veralteten Richtlinien `Basic128Rsa15` und `Basic256` für einen Altclient anbieten ([Transport](#transport)). Warnung beim Start |
| `HOTLOOP_OPCUA_SERVER_MAX_SESSIONS` | `20` | 0 = unbegrenzt |
| `HOTLOOP_OPCUA_SERVER_MAX_SUBSCRIPTIONS` | `200` | 0 = unbegrenzt |
| `HOTLOOP_OPCUA_SERVER_RECONCILE_INTERVAL` | `30s` | Der Zeitraum des Sicherheitsnetz-Abgleichs |

Der Server wird im Modus `--mcp-stdio` nicht gestartet: Dort startet ein Agent diese Binärdatei als Helfer, und dass ein zweiter Prozess mit dem echten Gateway um Port 4840 konkurriert, soll nicht möglich sein.

### Helm

`opcuaServer.*` in `charts/hotloop/values.yaml`. Das Einschalten fügt einen Service hinzu (`<release>-opcua`, standardmäßig ClusterIP; LoadBalancer oder NodePort ist eine bewusste Wahl für einen Client außerhalb des Clusters), einen PVC für das PKI-Verzeichnis (`opcuaServer.persistence`; geht er verloren, muss jeder Client einem neuen Zertifikat vertrauen), den Container-Port und, damit `networkPolicy.enabled` und `opcuaServer.enabled` zusammen nicht stillschweigend einen lauschenden Server hinterlassen, den niemand erreicht, den Port in der Ingress-Regel der Standard-NetworkPolicy. Eine eigene `networkPolicy.ingress` ersetzt diese Regel, wie beim Broker, und muss den Port dann selbst aufführen. `opcuaServer.tls.existingSecret` liefert ein Secret `kubernetes.io/tls` statt eines erzeugten Zertifikats.

## Was verifiziert ist und was nicht

HotLoop wurde mit echten Geräten und echten Servern betrieben, und am 2026-11-17 auf echter Hardware.
