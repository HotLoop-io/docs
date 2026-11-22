---
title: "HotLoop Flow mit Podman oder Helm einrichten"
description: "HotLoop Flow {{flow}} mit Podman oder Quadlet, auf Kubernetes mit Helm oder aus dem Quellcode. Es startet gesperrt, setzen Sie zuerst ein Admin-Passwort."
sidebar:
  label: "Installation"
---

HotLoop Flow {{flow}} ist aktuell. Es wird als `ghcr.io/hotloop-io/hotloop-flow:{{flow}}` ausgeliefert, ein Image für amd64 und arm64 (das amd64-Image maß in 2.8.0 laut Podman 45.64 MB), dazu ein Helm-Chart und der Quellcode zum Selberbauen. 2.9.0, 2.9.1, 2.10.0, 2.11.0, 2.12.0, 2.13.0, 2.14.0, 2.15.0, 2.16.0, 2.16.2, 2.16.3, 2.16.4, 2.16.5 und {{flow}} gibt es nur für amd64, und 2.10.2, 2.11.1, 2.12.1, 2.13.1, 2.14.1, 2.15.1 und 2.16.1 sind für amd64 und arm64 gebaut (2.10.1 hat ein Chart, aber kein Image, also pinnen Sie es nie), sodass ein Pi oder eine arm64-Maschine, die bei 2.13.1 geblieben ist, auf 2.16.1 wechseln kann. Das Image ist Distroless, läuft als Nicht-Root-Benutzer und hat keine Shell, also gibt es nichts, wohinein man wechseln könnte, weder für Sie noch für jemanden, der dort nichts verloren hat. Auf dieser Seite gibt es keinen Docker- oder Compose-Weg: Podman für eine Maschine, Quadlet, um daraus einen Dienst zu machen, Helm für einen Cluster.

Flow startet gesperrt. Es weigert sich zu laufen ohne ein Administratorkonto, weil ein Flow Befehle ausführen kann. Und es weigert sich zu laufen ohne ein Zugangsdaten-Geheimnis, das jedes Broker- und Datenbankpasswort verschlüsselt, das mit Ihren Flows gespeichert wird. Jeder Weg unten setzt beides.

Ab 2.2.0 liegen Kontext und dauerhafte Verbindungen in einer SQLite-Datei, `state.db`, auf dem Datenvolume, sodass ein Neustart sie nicht mehr löscht. Behalten Sie dieses Volume. Mit `persistence.enabled` auf false im Chart überlebt sie den Neustart eines Containers, aber nicht den Austausch eines Pods.

## Podman

Erzeugen Sie zuerst einen Passwort-Hash. Das Image hat keine Shell, also ist das Hashen ein Unterbefehl des Binarys selbst, und er lehnt alles unter acht Zeichen ab.

```bash
podman run --rm ghcr.io/hotloop-io/hotloop-flow:{{flow}} hash-password -password 'something-long'
```

Erzeugen Sie dann das Zugangsdaten-Geheimnis und speichern Sie es dort, wo Sie es in einem Jahr noch finden:

```bash
openssl rand -hex 32
```

Starten Sie es dann. Beide Werte kommen in einfache Anführungszeichen, weil ein bcrypt-Hash voller Dollarzeichen ist und Ihre Shell sie sonst frisst.

```bash
podman run -d --name hotloop-flow -p 1880:1880 -v hotloop-flow-data:/data \
  -e HOTLOOP_FLOW_ADMIN_USER=admin \
  -e HOTLOOP_FLOW_ADMIN_PASSWORD_HASH='<the hash>' \
  -e HOTLOOP_FLOW_CREDENTIAL_SECRET='<the secret>' \
  ghcr.io/hotloop-io/hotloop-flow:{{flow}}
```

Öffnen Sie `http://localhost:1880/` und melden Sie sich als `admin` an. `/health` antwortet mit der Version, sobald der Prozess läuft, und `/ready` sagt, ob die Runtime wirklich gestartet ist.

Behalten Sie dieses Geheimnis. Alles, was Flow auf dem Volume verschlüsselt, ist nur damit lesbar. Erstellen Sie den Container mit einem anderen neu, ist jedes gespeicherte Broker-Passwort weg, und es sieht genau wie ein sauberer Start aus, bis MQTT sich nicht mehr authentifiziert.

## Quadlet

Für einen Dienst, der beim Booten startet und sich selbst neu startet. Er braucht Podman 4.4 oder neuer. Legen Sie die Geheimnisse in eine Datei, die nur Sie lesen können:

```bash
mkdir -p ~/.config/hotloop-flow ~/.config/containers/systemd
umask 077
cat > ~/.config/hotloop-flow/hotloop-flow.env <<'EOF'
HOTLOOP_FLOW_ADMIN_USER=admin
HOTLOOP_FLOW_ADMIN_PASSWORD_HASH=<the hash>
HOTLOOP_FLOW_CREDENTIAL_SECRET=<the secret>
EOF
```

Beschreiben Sie dann den Container für systemd. Speichern Sie dies als `~/.config/containers/systemd/hotloop-flow.container`:

```ini
[Unit]
Description=HotLoop Flow
After=network-online.target
Wants=network-online.target

[Container]
Image=ghcr.io/hotloop-io/hotloop-flow:{{flow}}
ContainerName=hotloop-flow
PublishPort=1880:1880
Volume=hotloop-flow-data:/data
EnvironmentFile=%h/.config/hotloop-flow/hotloop-flow.env

[Service]
Restart=always

[Install]
WantedBy=default.target
```

```bash
systemctl --user daemon-reload
systemctl --user start hotloop-flow
```

Ein Benutzerdienst startet nur beim Booten und überlebt nur Ihre Abmeldung, wenn Lingering für Ihr Konto aktiviert ist: `loginctl enable-linger`. Lassen Sie das aus, und er läuft einwandfrei, bis Sie sich abmelden oder die Maschine neu startet.

## Helm

Das Chart funktioniert auf jedem Kubernetes, k3s eingeschlossen.

```bash
helm repo add hotloop-flow https://hotloop.io/hotloop-flow/
helm install line3-flows hotloop-flow/hotloop-flow
```

Das Chart erzeugt das Admin-Passwort und das Zugangsdaten-Geheimnis bei der ersten Installation und liest beide bei jedem Upgrade aus dem vorhandenen Secret zurück, sodass ein Upgrade das Geheimnis nie unter Ihren gespeicherten Zugangsdaten austauscht. Die Installationshinweise zeigen, wie man das Passwort ausliest. Für das Release oben:

```bash
kubectl get secret line3-flows-auth -o jsonpath='{.data.admin-password}' | base64 -d
kubectl port-forward svc/line3-flows 1880:8080
```

Der Benutzer ist `admin`. Vor 2.0.2 funktionierte dieses generierte Passwort nie, weil der Hash, den die App prüfte, aus einem anderen Zufallspasswort erzeugt wurde als dem, das das Chart speicherte. Ein Upgrade eines so installierten Releases behebt das an Ort und Stelle, und weder das Passwort noch das Zugangsdaten-Geheimnis ändert sich.

Ein Release ist eine Instanz, und das Chart setzt `replicaCount: 1` absichtlich fest. Jede Instanz hält den Flow-Zustand und Live-Verbindungen zu Brokern und SPS. Zwei Pods hinter einem Service würden beide abonnieren und beide schreiben, und InfluxDB würde jeden Messwert stillschweigend doppelt speichern. Um mehr zu betreiben, installieren Sie ein weiteres Release mit eigenen Flows. Zwei Releases können sich auch eine Aufgabe teilen, mit einer Lease, die immer nur einem von ihnen das Schreiben auf Anlagen erlaubt: [ein Warm-Standby mit Lease](/de/flow/failover/).

Es ist auch absichtlich klein. Das Standard-`resources.preset` ist `small` und fordert 10m CPU und 64Mi Speicher an. Der Flow-Prozess maß im Leerlauf 16.6 MiB resident, also wird er auf einem Edge-Knoten mit 64Mi Reserve eingeplant, wo die Standardanforderung von 512Mi des node-red-Charts in Pending hängen würde.

Der Pod läuft mit uid 65532 auf einem schreibgeschützten Root-Dateisystem, ohne Rechteausweitung, mit seccomp `RuntimeDefault` und allen entfernten Linux-Capabilities, Discovery eingeschlossen. Bis 2.0.4 fügte das Chart `NET_RAW` und `NET_ADMIN` hinzu, sobald Discovery aktiv war, für ARP-Scans, die nie jemand geschrieben hat. 2.0.5 hat damit aufgehört, und Sie müssen nichts ändern, was Sie gesetzt haben.

Das Chart hat drei Netzwerkmodi:

| Modus | Was er bekommt | Instanzen pro Knoten |
|---|---|---|
| `cluster` | Eine ClusterIP und alles, was der Cluster routet. Der Standard und die richtige Antwort, solange Sie Layer 2 nicht brauchen. | Unbegrenzt |
| `host` | Die Schnittstellen, die ARP-Tabelle und die Broadcast-Domäne des Hosts. | Eine, da der Port dem Knoten gehört |
| `macvlan` | Eine eigene MAC und IP im Ziel-VLAN, direkt im Segment mit den SPS. Braucht Multus. | Unbegrenzt |

`macvlan` ist der Grund, warum es die Modi gibt, denn einen SPS-Netzwerkbereich zu scannen ist sinnlos von einem Pod aus, der nur sieht, was der Cluster ihm routet. Er ist mehrinstanzensicher und sitzt direkt in diesem Segment, ohne Portkollisionen, weil jede Instanz ihre eigene Adresse trägt. Das [Flow-README](https://github.com/HotLoop-io/hotloop-flow#deploying-on-kubernetes) behandelt die Modi und die Ressourcen-Presets vollständig.

:::note[Wo das Chart gelaufen ist]
Das Chart wurde auf einem Vier-Knoten-k3s-Cluster im Standard-Netzwerkmodus `cluster` installiert und erprobt: Anmeldung, ein über die API bereitgestellter Flow, dieser Flow übersteht einen Pod-Neustart, Upgrades und ein Deployment aus dem EmberNet App Store über Fleet. Die Modi `host` und `macvlan` rendern, bestehen Lint und werden bei Fehlkonfiguration abgelehnt, und sie sind auf echter Hardware gelaufen (2026-11-17).
:::

## Ein VLAN pro Tab

2.9.0 lässt einen Tab, einen Subflow oder einen einzelnen Knoten seine Verbindungen an eine Netzwerkschnittstelle binden, sodass ein Flow für jede Maschine einen Tab halten kann, auf einem Gerät, dessen einziger Port für jede ein VLAN führt, selbst wenn jedes VLAN dasselbe Subnetz und dieselben Geräteadressen hat. Der Weg pro Tab ist die Umgebungsvariable `FLOW_NETWORK_INTERFACE` am Tab, und jeder Client-Knoten darauf erbt sie. 2.9.1 fügt dasselbe Feld dem Knoten `modbus-server` hinzu, sodass zwei Server auf derselben Adresse und demselben Port lauschen können, einer pro VLAN.

Der Pod muss die VLAN-Schnittstelle sehen, also starten Sie ihn mit dem Netzwerk des Hosts: `network.mode: host` im Chart oder `Network=host` in einer Quadlet-Unit. Einen Socket an eine Schnittstelle zu binden braucht unter Linux 5.7 und neuer keine Capability. Auf einem älteren Kernel braucht es `CAP_NET_RAW`, und der Chart-Wert `bindToInterface.netRaw` (Standard `false`) fügt genau diese eine Capability hinzu und sonst nichts. Es wurde in einem Labor aus zwei Netzwerk-Namespaces belegt, die sich `192.168.1.0/24` teilen, und nichts lief im eigenen Netzwerk einer Anlage.

## Aus dem EmberNet App Store

Sie brauchen das nicht, und es gibt nirgends einen EmberNet-Schritt, um Flow zu betreiben. Aber das Chart trägt die Labels, nach denen der EmberNet App Store sucht, sodass Flow, wenn Sie EmberCORE schon betreiben, in dessen Katalog steht und als Kachel erscheint.

Für einen Tenant auf einem eigenen Cluster stellt EmberCORE es über Fleet bereit, was EmberCORE 4.9.37 oder neuer braucht. Frühere Versionen erzeugten ein Fleet-Bundle, das nichts installierte. Ab Flow 2.0.3 setzt das Chart die Tenant-Labels von EmberCORE auf alles, was es erzeugt.

Ab 2.0.4 bekommt die bereitgestellte Kachel Namen und Symbol richtig. Der Pod und der Service tragen die Annotation `embernet.ai/app-icon`, die standardmäßig das eigene Symbol des Charts ist, sodass EmberCORE aufhört, ein Symbol aus dem Release-Namen zu raten, was nie passte. Setzen Sie `embernet.appIcon`, um Ihr eigenes zu verwenden, und liefern Sie es mit `Access-Control-Allow-Origin` aus, sonst bleibt die Kachel leer. Das Label `embernet.ai/app-name` ist jetzt der Chart-Name, nicht der Release-Name. Die Instanz steht weiter in `app.kubernetes.io/instance` und im Service-Namen, und kein Selektor hat sich geändert, ein Upgrade an Ort und Stelle ist also unproblematisch.

Die [Release Notes](https://hotloop.io/releases/flow/) haben jede Version bis zurück zu 0.1.0.

## Aus dem Quellcode

Sie brauchen Go und Node. Der Editor wird zuerst gebaut und mit `go:embed` ins Binary eingebettet, sodass ein Go-Build ohne ihn an einem fehlenden Muster scheitert, statt Ihnen ein Binary ohne Editor zu liefern.

```bash
git clone https://github.com/HotLoop-io/hotloop-flow.git
cd hotloop-flow
(cd web && npm ci && npm run build)
go build -o hotloop-flow ./cmd/hotloop-flow
```

Das Standard-Datenverzeichnis ist `/data`, was in einem Container richtig und auf Ihrem Laptop wahrscheinlich nicht das ist, was Sie wollen, also zeigen Sie es woandershin:

```bash
export HOTLOOP_FLOW_DATA_DIR=./data
export HOTLOOP_FLOW_ADMIN_USER=admin
export HOTLOOP_FLOW_ADMIN_PASSWORD_HASH="$(./hotloop-flow hash-password -password 'something-long')"
export HOTLOOP_FLOW_CREDENTIAL_SECRET='<the secret>'
./hotloop-flow
```

## Wenn Sie von Emberwire 0.1.0 kommen

2.x ist ein bewusster sauberer Schnitt: 0.1.0 hatte keine Nutzer, die man brechen konnte, und eine Kompatibilitätsschicht ohne Nutzer ist nur ein Ort, an dem Fehler leben. Die Variablen `EMBERWIRE_*` heißen jetzt `HOTLOOP_FLOW_*`, die beiden Datenbank-Konfigurationsknotentypen sind `hotloop-flow-influxdb` und `hotloop-flow-postgres`, WASM-Module exportieren `hotloop_flow_*`, die Metriken sind `hotloop_flow_*`, und der Deployment-Header ist `HotLoop-Flow-Deployment-Rev`.

Eine Zugangsdaten-Datei aus 0.1.0 kann nicht gelesen werden. Seit 2.0.1 sagt Flow das beim Start: Es nennt die Datei, sagt, dass Emberwire sie geschrieben hat, und fordert Sie auf, sie beiseitezulegen und die Zugangsdaten neu einzugeben. Das 0.1.0-Image liegt weiterhin unter `ghcr.io/embernet-ai/emberwire:0.1.0`, und die [Release Notes](https://hotloop.io/releases/flow/) führen jeden Bruch auf.
