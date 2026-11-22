---
title: "Netzwerk-Erkennung"
description: "HotLoop lauscht per mDNS, SSDP und DHCP und zeigt, was im Werksnetz ist, und sendet nichts, solange Sie kein Netzwerk zum Sondieren angeben."
---

HotLoop lauscht im Werksnetz und sagt Ihnen, was darin ist: den ESPHome-Knoten im Hof, den Shelly am Kompressor, den OPC-UA-Server an Linie 3, die UPnP-Box, die jemand angesteckt und vergessen hat, das Ding, das gerade eine Adresse angefragt hat. Jedes erscheint unter Devices, Discovered, unter den Geräten, die sich über MQTT angekündigt haben ([MQTT-Erkennung](/de/iot/mqtt-discovery/)), mit dem, was es ist und wie HotLoop mit ihm sprechen könnte.

Dann entscheidet ein Mensch. Nichts, was im Netz gehört wird, wird je von selbst hinzugefügt, und nichts wird je scharfgeschaltet.

## Lauschen, nicht scannen

In einem OT-Netz, das Sie lesen, scannt man nicht. Ein Portscan hat schon mehr als eine SPS umgeworfen, die ein Paket beantwortete, das sie nie erwartet hatte, und »es ist ja nur Erkennung« tröstet um drei Uhr nachts niemanden. Deshalb sendet HotLoop standardmäßig überhaupt nichts:

- **mDNS** (an): Geräte kündigen ihre Dienste beim Start an, und jede Antwort auf die Frage von irgendjemandem geht per Multicast an das ganze Segment. Ein Handy, das eine App öffnet, oder ein Laptop, der einen Drucker sucht, fragt; HotLoop hört mit.
- **SSDP** (an): UPnP-Geräte senden per Multicast `NOTIFY ssdp:alive`, wenn sie beitreten und danach alle paar Minuten. HotLoop hört auch diese mit.
- **DHCP** (aus, siehe unten): Ein Gerät, das dem Netz beitritt, sendet per Broadcast eine Adressanfrage mit seiner MAC und meist seinem Namen.

Fragen ist **Sondieren**, und es wird pro Netz durch die Installation eingeschaltet, nie durch eine Schaltfläche:

| Variable | Standard | <span class="sr-only">Details</span> |
|---|---|---|
| `HOTLOOP_NETDISC_MDNS` | `true` | auf mDNS lauschen |
| `HOTLOOP_NETDISC_SSDP` | `true` | auf SSDP lauschen |
| `HOTLOOP_NETDISC_DHCP` | `false` | auf DHCP-Anfragen an UDP 67 lauschen |
| `HOTLOOP_NETDISC_PROBE_NETWORKS` | leer | die Netze, für die das Sondieren an ist, als CIDRs: `10.20.0.0/24,192.168.7.0/24` |
| `HOTLOOP_NETDISC_PROBE_INTERVAL` | `15m` | wie oft dort eine Sondierung läuft |

In einem aufgeführten Netz sendet eine Sondierung eine mDNS-Frage für jeden Diensttyp und für die, die HotLoop kennt, fragt erneut nach jedem aufgetauchten Typ, sendet ein `M-SEARCH` per SSDP und liest die Beschreibung jedes UPnP-Geräts (Name, Hersteller und Modell) vom Gerät. In jedem anderen Netz sendet es nichts, und die Schaltfläche Probe now wird abgelehnt, wo nichts aufgeführt ist. Führen Sie die Netze auf, die Sie meinen: Ein /8 sind 16 Millionen Adressen, und HotLoop fragt dort, wenn Sie es ihm sagen.

## Womit es sprechen kann

| Gehört | Es ist | Beim Akzeptieren |
|---|---|---|
| mDNS `_opcua-tcp._tcp` | ein OPC-UA-Server (OPC 10000-12 Anhang C: Der Endpoint ist Adresse und Port des SRV plus der `path` des TXT) | legt ein OPC-UA-Gerät an diesem Endpoint an, anfangs anonym und ungesichert, ohne Tags. Durchsuchen Sie es mit Discover tags und stellen Sie seine Sicherheit ein, bevor es etwas Wichtiges trägt |
| mDNS `_shelly._tcp`, oder `_http._tcp` mit `gen` | ein Shelly, Gen2 oder neuer (sein TXT `gen`, `app` und `ver`) | legt ein HTTP-Gerät an, das `http://<it>/rpc/Shelly.GetStatus` liest, Shellys eigenen Statusaufruf, schreibgeschützt, ohne Tags. Discover tags listet jeden Wert auf. Ein Shelly mit aktivierter Anmeldung will Digest-Authentifizierung, die der HTTP-Treiber nicht kann |
| mDNS `_esphomelib._tcp` | ein ESPHome-Knoten (sein TXT: `friendly_name`, `version`, `mac`, `platform`, `board`, `network`) | vermerkt ihn als bekannt und legt nichts an. HotLoop liest ESPHome über MQTT: Geben Sie dem Knoten einen `mqtt:`-Block, der auf den Broker von HotLoop zeigt, dann kündigt er sich an, und die Karte sagt es (über die MAC zugeordnet) |
| mDNS `_mqtt._tcp` | ein MQTT-Broker | vermerkt ihn. Fügen Sie ihn unter Settings, MQTT hinzu, um zu hören, was sich darauf ankündigt |
| mDNS `_http._tcp`, alles andere | eine Webseite oder ein Dienst, für den HotLoop kein Wort hat | vermerkt ihn |
| SSDP | ein UPnP-Gerät, nach seiner uuid: Gerätetypen, `SERVER` und, bei eingeschaltetem Sondieren, seine Beschreibung | vermerkt es |
| DHCP | ein Gerät, das eine Adresse anfragt: MAC, Hostname, Vendor Class | vermerkt es |

»Vermerkt es« ist trotzdem einen Klick wert. In einem Werksnetz sollte jede Box eine sein, von der jemand weiß, und ein akzeptierter Fund ist eine Entscheidung mit Namen und Uhrzeit. Das nächste unbekannte Ding fällt auf.

Eine Karte sagt, wann zwei Funde dieselbe Box sind: die mDNS-MAC eines ESPHome-Knotens und seine MQTT-Ankündigung, eine DHCP-Anfrage und ein mDNS-Host auf derselben Adresse.

Akzeptieren schaltet nichts scharf. Ein Gerät, das durch das Akzeptieren entsteht, hat keine Tags, bis jemand sie auswählt, und jeder Punkt darauf ist schreibgeschützt, bis jemand ihn im Tag-Editor scharfschaltet, über dasselbe Schreib-Gate wie alles andere. Die Adresse im Vorschlag stammt aus der eigenen Ankündigung des Geräts, und der Akzeptieren-Dialog zeigt sie, damit Sie prüfen können, ob es die Box ist, die Sie meinen.

**Ignore** blendet einen Fund aus und hält ihn ausgeblendet, wenn er wieder gehört wird. **Un-ignore** holt ihn zurück.

## Alles ist nicht vertrauenswürdig

Jeder, der ein Paket auf das Segment legen kann, kann behaupten, alles Mögliche zu sein. Deshalb:

- jede Zeichenkette wird gekürzt und von Steuerzeichen befreit, und der Bildschirm setzt sie als Text auf die Seite, nie als HTML;
- eine UPnP-Beschreibung wird nur von der Adresse gelesen, von der die Ankündigung kam, nur in einem Sondierungsnetz, nie über eine Weiterleitung und nie mehr als 64 KiB. Ein gefälschtes `NOTIFY`, das `LOCATION` auf die Webseite einer SPS oder auf HotLoop selbst zeigen lässt, bewirkt, dass nichts abgerufen wird;
- jeder Listener nimmt 500 Datagramme pro Sekunde an und verwirft und zählt den Rest;
- der Bestand hält 1.024 Funde. Neue darüber hinaus werden verworfen und gezählt, bis sich jemand um einige gekümmert hat, und der Bildschirm sagt es;
- eine Frage auf der Leitung ist die Frage von jemandem, keine Ankündigung: Die bekannten Antworten, die sie trägt, sind die Annahmen des Fragenden, und damit wird nichts gemacht.

## Wo HotLoop sitzen muss, um etwas zu hören

Multicast und Broadcast überqueren weder einen Router noch ein NAT noch ein Container-Netz. HotLoop hört das Segment, in dem es sitzt, und sonst nichts:

- **Eine Box im Werksnetz** (das Binary oder Podman mit `--network host`): hört alles.
- **Kubernetes mit Pod-Netz**: hört nichts vom Werk. Der Bildschirm Discovered zeigt die Schnittstellen, auf denen es lauscht, so finden Sie es heraus. Geben Sie dem Pod `hostNetwork: true` oder eine zweite Schnittstelle im Werkssegment (Multus mit macvlan), dann hört es das Werk. Das Chart tut keines von beidem für Sie: Einen Pod ins Netz des Hosts zu setzen ist eine Entscheidung über den Knoten, kein Standard.

mDNS (5353) und SSDP (1900) sind gewöhnliche Ports über 1024 und brauchen daher keine Rechte. HotLoop teilt sie mit allem, was sie schon hält, einschließlich eines avahi-daemon auf dem Host.

## DHCP

Machbar, ehrlich gesagt, aber es braucht zwei Dinge, die ein Container standardmäßig nicht bekommt, weshalb es aus ist:

1. **Die Broadcasts des Werks.** Eine DHCP-Anfrage geht an 255.255.255.255, also muss HotLoop im Segment sein: Host-Netz oder eine Schnittstelle darin, wie oben.
2. **UDP-Port 67**, der unter 1024 liegt. Das Image von HotLoop läuft als uid 65532. Geben Sie entweder dem Binary `CAP_NET_BIND_SERVICE` (`setcap cap_net_bind_service=+ep /hotloop`), oder setzen Sie das `net.ipv4.ip_unprivileged_port_start` des Hosts auf 67 oder weniger. In Kubernetes macht das Hinzufügen von `NET_BIND_SERVICE` zu den Capabilities eines Non-Root-Containers sie nicht von allein wirksam; das tun die Datei-Capability oder das Sysctl.

Es braucht nie einen Raw-Socket oder einen privilegierten Container: Ein gewöhnlicher UDP-Socket auf Port 67 empfängt die Broadcasts. Es antwortet nie, bietet nie eine Adresse an, sendet nie ein Byte. Es teilt sich den Port, sodass ein DHCP-Server auf demselben Host, der ihn ebenfalls teilt, weiterläuft; einer, der den Port für sich allein hält, lässt den Listener von HotLoop scheitern, und der Bildschirm sagt warum, ohne den Server anzufassen.

Was es nicht sehen kann: Erneuerungen, die per Unicast an den Server gehen. HotLoop hört ein Gerät, wenn es beitritt, nicht jede Stunde danach.

## Mehrere Replikate

Nur das Replikat, das die Sperre der Netzwerk-Erkennung hält, lauscht und sondiert; die anderen versuchen es alle 30 Sekunden erneut, sodass eines übernimmt, wenn der Halter ausfällt. Zwei, die sondieren, würden jedes Gerät zweimal fragen.

## Backups

`net_finds` ist in jedem Backup: was gehört wurde und wer was akzeptiert oder ignoriert hat. Die Entscheidungen sind der Teil, den das Netz nie wieder sagt.

## Wie es getestet wird

Die Erkennung wurde in echten Netzen gegen echte Ankündiger betrieben, ESPHome-, Shelly- und OPC-UA-Knoten, einen UPnP-Medienserver und DHCP-Clients, und am 2026-11-17 auf echter Hardware.
