---
title: "HotLoop IoT {{hotloop}} installieren"
description: "HotLoop IoT {{hotloop}} auf k3s mit Helm oder auf einem Pi oder kleinen PC als systemd-Dienste mit Podman Quadlet installieren, mit PostgreSQL oder SQLite."
sidebar:
  label: "Installation"
---

HotLoop IoT erschien erstmals in 4.18.10. Das Image ist `ghcr.io/hotloop-io/hotloop-iot:{{hotloop}}`, gebaut für amd64, arm64 und arm/v7, und das Chart ist `hotloop-iot` im selben Helm-Repository wie der Rest der Produktreihe. Beides lässt sich ohne Anmeldung laden. Es gibt absichtlich keinen Docker- oder Compose-Weg, und ein bloßes `podman run` aus einer Shell, die mit der Sitzung stirbt, ist keine Installation.

Zwei Wege. Ein Cluster nimmt Helm. Ein Pi, ein NUC oder ein kleiner Industrie-PC ohne Cluster nimmt Podman Quadlet. So oder so wählen Sie die Datenbank einmal: PostgreSQL 17 (der Standard) oder eine SQLite-Datei ganz ohne Datenbank-Container.

## Helm

```bash
helm repo add hotloop https://hotloop.io/hotloop
helm repo update
helm install hotloop hotloop/hotloop-iot --version {{hotloop}} \
  --namespace hotloop --create-namespace
```

Nennen Sie das Release `hotloop`, egal welches Produkt. Nach dem Release-Namen sind das Datenbank-Volume, die Secrets und der Service benannt, und wenn Sie ihn beibehalten, kann ein Standort später auf ein größeres Produkt wechseln.

Das deployt IoT samt PostgreSQL 17.11 daneben, auf einem Volume von 10 Gi, mit 30 Tagen Verlauf. Das Chart erzeugt das Datenbankpasswort, das MCP-Token und ein Administratorpasswort im Release-Secret und verwendet sie bei jedem Upgrade wieder, sodass ein `helm upgrade` nie ein Passwort hinter Ihrem Rücken austauscht.

Für eine SQLite-Datei und keinen Datenbank-Pod verlangen Sie sie bei der Installation:

```bash
helm install hotloop hotloop/hotloop-iot --version {{hotloop}} \
  --namespace hotloop --create-namespace \
  --set database.type=sqlite
```

SQLite ist ein Schreiber auf einer lokalen Platte, also ein Replikat, und das Volume gehört auf lokalen Speicher, nie auf NFS. Ein Standort mit Jahren an Verlauf im Sekundentakt will PostgreSQL. Das IoT-Chart akzeptiert `postgresql` oder `sqlite` und sonst nichts: `timescaledb` zu verlangen lässt die Installation fehlschlagen. Der spätere Wechsel zwischen beiden ist eine Sicherung und eine Wiederherstellung, keine Wertänderung, weil die neue Datenbank leer startet. [Sicherungen](/de/iot/backup/) hat die Wiederherstellung.

### Sichern Sie den Schlüssel

Das Chart erzeugt auch `<release>-secret-key` (`hotloop-secret-key` mit den Befehlen oben). Er enthält den Schlüssel, der jedes Passwort verschlüsselt, das HotLoop für ein Gerät speichert. Der Schlüssel ist nie in der Datenbank und nie in einer Sicherung, er gehört also zu Ihren Daten: Eine Sicherung stellt Zugangsdaten nur dort wieder her, wo dieser Schlüssel eingehängt ist. Das Chart behält das Secret über ein `helm uninstall` hinaus. Sichern Sie ihn woanders als neben Ihren Sicherungen, denn ein Schlüssel neben den Sicherungen, die er schützt, schützt nichts. [Das Gateway installieren](/de/gateway/install/#sichern-sie-den-schlüssel-bevor-sie-ihn-brauchen) erzählt die ganze Geschichte, und es ist derselbe Schlüssel.

### Anmelden

Der Benutzer ist `admin`. Die Installationshinweise geben den Befehl aus, der das Passwort wieder ausliest:

```bash
kubectl -n hotloop get secret hotloop \
  -o jsonpath='{.data.admin-password}' | base64 -d
kubectl -n hotloop port-forward svc/hotloop 8080:8080
```

Öffnen Sie `http://localhost:8080`. Dieses Admin-Konto ist ein Bootstrap, kein Zurücksetzen-Schalter: Sobald es existiert, bewirkt eine Änderung von `auth.admin.password` samt Upgrade nichts, sodass ein Passwort, das jemand in der Oberfläche gesetzt hat, vom nächsten Deploy nie überschrieben wird.

Fügen Sie nun ein Gerät hinzu, entdecken Sie seine Tags und versuchen Sie, auf eines zu schreiben. Das geht nicht. Schreibzugriffe sind ab Werk aus, jeder Tag ist schreibgeschützt, bis jemand ihn scharf schaltet, und `safety.allowWrites` bleibt `false`, bis Sie entscheiden, dass diese Installation Maschinen bewegen darf. [Das Schreib-Gate](/de/gateway/write-gate/) hat jede Prüfung, der Reihe nach.

### Was Sie einstellen, bevor ein echtes Werk es sieht

Tragen Sie diese in eine Values-Datei ein und installieren Sie mit `-f`.

| Wert | Standard | Warum Sie ihn ändern |
|---|---|---|
| `plant.name`, `plant.siteId` | `HotLoop`, leer | Wie das Werk auf Bildschirmen, in Seiten und für andere Standorte heißt. |
| `plant.latitude`, `plant.longitude` | leer | Wo das Werk liegt, in Dezimalgrad. [Die Sonne](/de/iot/sun/) wird daraus auf der Box berechnet. Beide oder keiner. |
| `global.timezone` | `America/New_York` | Zeitpläne und Schichtwechsel laufen danach. Es muss ein echter Zonenname sein, denn einer, der sich nicht laden lässt, stoppt den Start. |
| `publicUrl` | leer | Die Adresse, unter der ein Telefon im Werks-WLAN HotLoop erreicht. Ohne sie haben Benachrichtigungen keinen Link zurück, und ntfy bekommt keinen Quittieren-Knopf. |
| `safety.allowWrites` | `false` | Der Hauptschalter. Aus, schreibt nichts auf eine Maschine, von nirgendwo. |
| `safety.allowMcpWrites` | `true` | Lässt Agenten durch dasselbe Gate schreiben, seit 4.19.4 an. Er folgt dem Hauptschalter: Ist `safety.allowWrites` aus, schreibt nichts, auch keine Agenten. Setzen Sie ihn auf `false`, und Agenten können weiter die ganze Anlage lesen und nie schreiben. |
| `historian.retentionDays` | `30` | Tage an gespeichertem Verlauf. Das Gateway und Edge behalten 90, weil die Platte eines Pi klein ist. |
| `logbook.retentionDays` | `90` | Tage an Zustandsänderungen von Entitäten, die das [Logbuch](/de/iot/logbook/) behält. |
| `database.postgresql.persistence.size` | `10Gi` | Hier lebt Ihr Verlauf. Dimensionieren Sie es nach Ihrer Tag-Anzahl und der Aufbewahrung oben. |
| `secretKey.existingSecret` | leer | Ein Secret, das Sie selbst verwalten und das den Schlüssel für die Gerätepasswörter enthält. Setzen Sie es, wenn Sie das Chart mit `helm template` rendern, das keinen stabilen Schlüssel erzeugen kann. |
| `opcuaClient.persistence.enabled` | `false` | Schalten Sie es ein, bevor Sie ein gesichertes OPC-UA-Gerät hinzufügen, damit die Zertifikate des Clients einen Neustart überstehen. |
| `ingress` | aus | Nur, wenn es von außerhalb des Clusters über einen Namen erreichbar sein soll. |

## Podman Quadlet

Für eine Box, die nicht in einem Cluster steckt. Quadlet macht aus den Containern echte systemd-Dienste: Sie starten beim Booten, ohne dass jemand angemeldet ist, starten neu, wenn sie sterben, und schreiben ins Journal. Es braucht **Podman 5.0 oder neuer**. Raspberry Pi OS Bookworm liefert 4.3, das gar kein Quadlet hat, also braucht ein Pi Trixie oder neuer. Legen Sie das Datenbank-Volume auf eine USB-SSD und nicht auf die SD-Karte, denn der Verlauf schreibt den ganzen Tag, und genau daran sterben SD-Karten.

Die Units liegen im Verzeichnis `iot/` des HotLoop-Repositorys, unter `deploy/quadlet/`. [Podman Quadlet](/de/install/quadlet/) erklärt, was jede Datei ist. Die Kurzfassung für PostgreSQL:

```bash
sudo cp hotloop.network hotloop.container hotloop-db.container \
  hotloop-db.volume hotloop-data.volume /etc/containers/systemd/

openssl rand -hex 24 | sudo podman secret create hotloop-db-password -
sudo podman run --rm ghcr.io/hotloop-io/hotloop-iot:stable gen-secret-key \
  | sudo podman secret create hotloop-secret-key -
printf '%s' 'a long admin password' \
  | sudo podman run --rm -i ghcr.io/hotloop-io/hotloop-iot:stable hash-password \
  | sudo podman secret create hotloop-admin-password-hash -

sudo systemctl daemon-reload
sudo systemctl start hotloop.service
sudo systemctl status hotloop.service hotloop-db.service
curl -s localhost:8080/api/status
```

Öffnen Sie dann `http://<this box>:8080` und melden Sie sich als `admin` an. Die drei Secrets sind das Datenbankpasswort, der Schlüssel, der die Gerätepasswörter verschlüsselt (verlieren Sie ihn, muss jedes neu eingegeben werden, also bewahren Sie eine Kopie an einem Ort auf, der nicht diese Box ist), und der bcrypt-Hash des Administratorpassworts, nie das Passwort selbst.

Für eine SQLite-Datei stattdessen nehmen Sie die Dateien in `iot/sqlite/` und nichts aus dem Verzeichnis darüber. Sie haben dieselben Unit-Namen, also gilt der eine Satz oder der andere, nie beide. Es sind zwei Dateien, `hotloop.container` und `hotloop-data.volume`, und zwei Secrets, `hotloop-secret-key` und `hotloop-admin-password-hash`. Die Datenbank ist `/data/hotloop.db` auf dem Volume `hotloop-data`.

Die Unit folgt `:stable`, und Podman zieht sie nach, sobald der Timer an ist:

```bash
sudo systemctl enable --now podman-auto-update.timer
```

Ein neues Image migriert beim Hochfahren die Datenbank, und wenn es nicht starten kann, setzt Podman das vorherige zurück. Der Datenbank-Container folgt `:stable` absichtlich nicht. [Das automatische Update von :stable](/de/install/auto-update/) sagt, was ein Update tut, was ein Rollback nicht rückgängig machen kann und wie Sie Updates anhalten, bis Sie es sagen. Machen Sie eine Sicherung, bevor Sie Updates einschalten.

## Auf ein größeres Produkt wechseln

Von IoT zu Edge zum Gateway bleibt jedes Gerät, jeder Tag, jede Entität, Automatisierung, jeder Alarm, Benutzer und jede Stunde Verlauf erhalten, und [die Produktübersicht](/de/products/) sagt, wie. Der Wechsel wurde auf Quadlet und als `helm upgrade` auf einem echten Cluster ausgeführt. Zurück auf ein kleineres Produkt ist kein Wechsel für eine Box, an der Ihnen etwas liegt, also machen Sie vorher eine Sicherung.

## Wie weit es erprobt ist

Die Quadlet-Units von IoT für SQLite und für PostgreSQL wurden unter systemd rootless aus den eingecheckten Dateien ausgeführt, und ein echter Pi unter systemd als root sowie die 32-Bit-arm-Images wurden auf echter Hardware ausgeführt, auf Bare Metal (2026-11-17).

## Lizenz

HotLoop IoT steht unter dem HotLoop Source License Agreement 1.0. Es ist kostenlos und quelloffen einsehbar, aber keine Open Source im Sinne der OSI. Die Nutzung zu Hause und im Labor ist kostenlos, ebenso die Nutzung durch Schulen, gemeinnützige Organisationen und Behörden für ihren eigenen Betrieb. Siehe [die Lizenzseite](/de/license/) und [HotLoop im Unternehmen nutzen](/de/business/).
