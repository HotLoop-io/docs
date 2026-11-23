---
title: "Der eingebettete MQTT-Broker"
description: "Ein Broker im selben Prozess, sodass eine kleine Box die ganze Installation sein kann, mit seinen Listenern, Konten und den Einstellungen, die ihn einschalten."
---

HotLoop kann seit 4.11.0 seinen eigenen MQTT-Broker im Prozess betreiben, sodass eine kleine HotLoop-Installation auf einer einzigen Maschine nichts Zusätzliches bereitstellen muss. Standardmäßig an (`HOTLOOP_BROKER_ENABLED`), in der Binärdatei und im Helm-Chart. Er lauscht auf :1883; wenn dieser Port von einem anderen Broker auf der Maschine belegt ist, bleibt der eingebettete Broker untätig und sagt das im Log, und HotLoop startet (setzen Sie `HOTLOOP_BROKER_LISTEN_ADDR` auf eine freie Adresse oder schalten Sie ihn aus). Ein von Ihnen gewählter Port, der nicht gebunden werden kann, bleibt ein Fehler: Eine Bereitstellung, die schon Mosquitto oder EMQX betreibt, hat nichts, worauf sie das richten könnte, und einen zweiten Broker neben einem bereits vorhandenen zu starten ist kein sicherer Standard, den man erraten sollte.

## Warum es ihn gibt

Edge Publish (das Gateway als Sparkplug-Edge-Node) und Flottenverwaltung (die Verfolgung registrierter Edge Relays) verbinden sich beide *nach außen* über `BrokerAddress` mit einem MQTT-Broker und haben nie selbst einen betrieben. Das ist in Ordnung, wenn eine Installation schon einen Broker hat, sei es eine bestehende Mosquitto-Instanz oder eine, die aus anderen Gründen neben HotLoop läuft. Als *einzige* Option ist es nicht in Ordnung: Dieses Projekt existiert, um die Zahl der beweglichen Teile zu senken, von denen ein Werk abhängt, und eine zweite Infrastrukturkomponente nur zu verlangen, um einen Sparkplug-Hub für ein Gateway zu bekommen, hieße, ein bewegliches Teil durch die Hintertür wieder einzubauen.

Mit `HOTLOOP_BROKER_ENABLED=true` lauscht derselbe Prozess an seiner eigenen Adresse auf MQTT-Verbindungen. Edge Publish, die Flottenverwaltung oder das `HOTLOOP_EDGE_PUBLISH_BROKER` eines externen Edge Relays können alle auf `localhost:1883` zeigen (im Cluster auf die Service-Adresse des Gateways selbst).

## Wann man ihn nutzt und wann nicht

**Nutzen Sie ihn** für ein einzelnes Gateway, eine Handvoll Edge Relays und Verkehrsmengen, die ein eingebetteter Broker, der sich einen Prozess mit dem Historian, der Alarm-Engine und der HTTP-API teilt, bequem verkraftet, der Normalfall, auf den dieses ganze Projekt zielt: ein Werk, eine Box, minimale Infrastruktur.

**Nutzen Sie ihn nicht** als Ersatz für einen produktionsreifen Broker im echten Maßstab: mehrere unabhängige Sparkplug-Host-Anwendungen, sehr hohes Fan-out, Brücken zwischen Standorten oder Lasten, die Clustering, horizontale Skalierung oder die eigenen Betriebswerkzeuge eines Brokers brauchen (detaillierte Metriken, dynamische ACLs, Plugin-Ökosysteme), sind alle echte Gründe, Mosquitto, EMQX oder einen anderen dedizierten Broker zu betreiben und die eigenen `EdgePublishConfig`/`FleetConfig` des Gateways darauf zu richten, wie es jede andere Installation schon kann. Dieses Paket konkurriert nicht mit diesem Anwendungsfall; es ist für Installationen da, die sonst gar keinen Broker hätten.

## Anmeldungen und was jede berühren darf

Drei Arten von Anmeldungen kommen hinein, und sie sind nicht gleich.

**In HotLoop angelegte Anmeldungen** (Settings, MQTT, oder `/api/broker/logins` in [Die HTTP-API](/de/iot/api/)) tragen Regeln: die Topics, auf die die Anmeldung veröffentlichen darf, und die Topics, die sie abonnieren darf. `%u` in einer Regel ist der eigene Name der Anmeldung und `%p` das Discovery-Präfix. Sie beginnen mit einem Profil und können danach von Ihnen bearbeitet werden:

| Profil | Veröffentlichen | Abonnieren | Für |
|---|---|---|---|
| `shelly` | `%u/#`, `shellies/announce` | `%u/#`, `shellies/command`, `%p/status` | einen Shelly Gen2 oder neuer, Anmeldung nach dem Präfix seines MQTT-Topics benannt |
| `esphome` | `%u/#`, `%p/+/%u/+/config`, `esphome/discover/%u` | `%u/#`, `%p/status`, `esphome/discover` | einen ESPHome-Knoten, Anmeldung nach dem Knoten benannt |
| `tasmota` | `tele/%u/#`, `stat/%u/#`, `tasmota/discovery/+/config`, `tasmota/discovery/+/sensors` | `cmnd/%u/#`, `cmnd/tasmotas/#` | ein Tasmota-Gerät, Anmeldung nach seinem Topic benannt |
| `zigbee2mqtt` | `%u/#`, `%p/#` | `%u/#`, `%p/status` | eine Zigbee2MQTT-Bridge, Anmeldung nach ihrem Basis-Topic benannt |
| `integration` | nichts | `#` | ein Dashboard, ein Historian, Sie mit MQTT Explorer |
| `full` | `#` | `#` | alles, das ganze Werk |

Benennen Sie die Anmeldung eines Shelly nach seinem Topic-Präfix, und er kann sich ankündigen und als er selbst berichten, mehr nicht. Er kann nicht auf `cmnd/boiler/POWER` veröffentlichen, kein Gerät im Namen eines anderen ankündigen und nicht `#` abonnieren, um das Werk zu lesen. Der Broker prüft jede Veröffentlichung, jedes Abonnement und jede Nachricht auf dem Weg zu einem Abonnenten, sodass sich eine Regel nicht mit einem klugen Platzhalter dehnen lässt. Auch ein Last Will wird beim Verbinden des Clients geprüft: Die Broker-Bibliothek veröffentlicht Wills, ohne jemanden zu fragen, daher kommt eine Anmeldung nicht hinein, deren Will dorthin zeigt, wo sie nicht veröffentlichen darf. Sonst könnte eine billige Steckdose ein gehaltenes `ON` auf dem Heizkessel hinterlassen und sich selbst den Stecker ziehen.

Eine Änderung an einer Anmeldung gilt ab dem nächsten Paket dieses Clients. Schränken Sie eine Anmeldung ein, verliert das verbundene Gerät die Topics sofort; löschen Sie eine, kann der noch verbundene Client gar nichts mehr tun und sich nicht erneut verbinden. Passwörter sind bcrypt-Hashes in `broker_logins`, das in jedem Backup enthalten ist; die API antwortet nie mit einem von beiden.

Zigbee2MQTT ist der Sonderfall: Eine Bridge kündigt jedes Gerät auf ihrem Funk an, daher darf ihr Profil überall unter dem Präfix veröffentlichen. Das ist die Aufgabe der Bridge, und deshalb zeigt der Bildschirm Discovered, wer was angekündigt hat.

**`HOTLOOP_BROKER_USERS`** ist die alte Liste von `user:password`-Paaren (nur der erste Doppelpunkt trennt, ein Passwort darf also einen enthalten). Diese dürfen alles, auf jedem Topic, genau wie in 4.16 und 4.17. Das ist Absicht: Niemand aktualisiert in ein Werk, dessen Sparkplug-Verkehr plötzlich an einer ACL abprallt, die er nie geschrieben hat. Es bedeutet auch, dass jede dieser Anmeldungen ein Schlüssel zum ganzen Werk ist. Stellen Sie Geräte auf in HotLoop angelegte Anmeldungen um und behalten Sie die aus den Umgebungsvariablen für das, was wirklich alles braucht: die Flotte, ein Edge Relay, den Edge Publisher. In konstanter Zeit geprüft; ein Benutzername mit falschem Passwort wird abgewiesen.

**Anonym** (`HOTLOOP_BROKER_ALLOW_ANONYMOUS`, Standard `false`) darf alles, für jeden, der den Port erreichen kann. Es ist ein Opt-in pro Installation für ein vertrauenswürdiges LAN oder einen Prüfaufbau, nie etwas, das dieser Prozess von sich aus für in Ordnung hält, und der Bildschirm Discovered sagt es in Rot, solange es an ist. Es lockert nichts für einen Client, der einen Benutzernamen sendet: Ein falsches Passwort bleibt ein falsches Passwort.

Ein Broker ohne `HOTLOOP_BROKER_USERS` und mit ausgeschaltetem anonymem Zugang startet problemlos. Bis jemand in HotLoop eine Anmeldung anlegt, kann sich nur HotLoop selbst verbinden.

Andere Broker sind ihre eigene Sache. Bei Mosquitto oder EMQX setzt dieser Broker die ACLs durch, dieselbe Grenze, die die [Flottenverwaltung](/de/gateway/fleet/) zieht, und die [MQTT-Erkennung](/de/iot/mqtt-discovery/) hat dort eine ACL für HotLoops eigene Anmeldung.

## Erkennung und HotLoops eigene Anmeldung

Ist der Broker an, lauscht HotLoop darauf nach Geräten, die sich ankündigen (siehe [MQTT-Erkennung](/de/iot/mqtt-discovery/)). Der Broker vermerkt, welche Anmeldung und welcher Client jede Discovery-Konfiguration veröffentlicht hat. Der Bildschirm Discovered zeigt es, und ein von einer Anmeldung akzeptiertes Gerät, das von einer anderen angekündigt wird, wird für einen Menschen zurückgehalten, mit einer Warnung im Log ("Kitchen re-announced by login garage-node; it was accepted from kitchen-node"). Entweder hat jemand das Gerät auf eine neue Anmeldung umgezogen, oder eine Anmeldung gibt sich als ein Gerät aus, das sie nicht ist. Ein Mensch entscheidet, was zutrifft.

Der eigene Client von HotLoop an diesem Broker (der Discovery-Listener und die Treiber der erkannten Geräte) meldet sich mit einer Anmeldung an, die der Broker bei jedem Start erzeugt und nur im Speicher hält. Sie darf alles. Dafür gibt es nichts zu konfigurieren, nichts auf der Platte und nichts in einem Backup; nach jedem Neustart ist es eine andere.

## TLS

Ein TCP-Listener im Klartext (`HOTLOOP_BROKER_LISTEN_ADDR`, Standard `:1883`) steht immer zur Verfügung, sobald der Broker aktiviert ist. Das Setzen von `HOTLOOP_BROKER_TLS_ENABLED=true` mit `HOTLOOP_BROKER_TLS_CERT_FILE` und `HOTLOOP_BROKER_TLS_KEY_FILE` fügt einen zweiten, unabhängigen Listener hinzu (`HOTLOOP_BROKER_TLS_LISTEN_ADDR`, Standard `:8883`), der mit diesem Zertifikat terminiert. Beide Listener laufen gleichzeitig, wenn TLS aktiviert ist, nichts schließt den Klartext-Listener, daher setzt ein Betreiber, der nur TLS-Erreichbarkeit will, das auf der Netzwerkebene durch (eine NetworkPolicy, eine Firewall-Regel), so wie dieses Chart die weitergehenden Entscheidungen zur Netzwerkfreigabe schon jetzt `networkPolicy.ingress` überlässt, statt die Anwendung selbst entscheiden zu lassen, welche ihrer Ports erreichbar sind.

Anders als das STARTTLS-Upgrade einer einzelnen Verbindung beim SMTP-Kanal ist der TLS-Listener des Brokers ein zweiter, getrennter Socket, dieselbe Form, die Mosquitto, EMQX und die meisten MQTT-Broker für einen Klartext-Port neben einem TLS-Port nutzen, und die natürlichere Lösung für MQTT, das (anders als SMTP) kein weit verbreitetes Upgrade innerhalb der Verbindung kennt.

Dieses Paket erzeugt kein eigenes Zertifikat, weder selbstsigniert noch anderweitig, weil nachgelagert niemand einem selbst erfundenen vertrauen würde, daher stellt der Betreiber immer ein echtes Zertifikat bereit (aus einer internen CA, `cert-manager` oder jeder anderen Quelle).

## Konfiguration

| Variable | Standard | <span class="sr-only">Details</span> |
|---|---|---|
| `HOTLOOP_BROKER_ENABLED` | `false` | Die Funktion ist aus, bis dies gesetzt wird |
| `HOTLOOP_BROKER_LISTEN_ADDR` | `:1883` | Der TCP-Listener im Klartext |
| `HOTLOOP_BROKER_TLS_ENABLED` | `false` | Fügt einen zweiten, unabhängigen TLS-Listener hinzu |
| `HOTLOOP_BROKER_TLS_LISTEN_ADDR` | `:8883` | Wird nur verwendet, wenn TLS aktiviert ist |
| `HOTLOOP_BROKER_TLS_CERT_FILE` / `_KEY_FILE` | n/a | Erforderlich, wenn TLS aktiviert ist |
| `HOTLOOP_BROKER_ALLOW_ANONYMOUS` | `false` | Opt-in pro Installation; setzen Sie dies nie als Standard |
| `HOTLOOP_BROKER_USERS` | keine | `user:password,user2:password2`. Jeder darf alles; siehe oben. Anmeldungen mit Regeln werden in HotLoop angelegt |
| `HOTLOOP_BROKER_DISCOVERY` | `true` | Lauscht auf Geräte, die sich ankündigen; siehe [MQTT-Erkennung](/de/iot/mqtt-discovery/) |
| `HOTLOOP_BROKER_DISCOVERY_PREFIX` | `homeassistant` | Das Topic-Präfix, unter dem die Ankündigungen eintreffen |

## Was verifiziert ist und was nicht

HotLoop wurde mit echten Geräten und echten Servern betrieben, und am 2026-11-17 auf echter Hardware.
