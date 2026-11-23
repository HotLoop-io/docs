---
title: "Podman Quadlet auf dem Pi"
description: "HotLoop als echte systemd-Dienste auf einem Pi oder kleinen Industrie-PC mit Podman Quadlet betreiben, ohne Docker, ohne Compose und ohne Cluster."
---

Für einen Pi oder einen kleinen Industrie-PC, der **nicht** zu einem k3s-Cluster gehört. Gehört er dazu, nehmen Sie stattdessen das Chart des Produkts. Dieses Verzeichnis und die Charts sind die zwei unterstützten Wege, HotLoop zu betreiben.

Kein Docker und kein loses `podman run` aus einer Shell, die mit der Sitzung stirbt. Quadlet macht aus den Containern echte systemd-Dienste: Sie starten beim Hochfahren ohne angemeldeten Benutzer, starten bei einem Fehler neu und schreiben ins journald.

| Verzeichnis | Produkt | Image |
|---|---|---|
| `iot/` | HotLoop IoT, mit PostgreSQL 17 | `ghcr.io/hotloop-io/hotloop-iot` |
| `edge/` | HotLoop Edge, mit TimescaleDB | `ghcr.io/hotloop-io/hotloop-edge` |
| `gateway/` | HotLoop Gateway, mit TimescaleDB | `ghcr.io/hotloop-io/hotloop` |
| dieses Verzeichnis | HotLoop Edge Relay, ohne Datenbank | `ghcr.io/hotloop-io/hotloop-edge-relay` |

[Die Produktseite](/de/products/) sagt Ihnen, welches Sie brauchen.

Jedes der ersten drei hat außerdem ein Verzeichnis `sqlite/`: dasselbe Produkt mit der Datenbank als Datei und ohne Datenbank-Container. Siehe [SQLite statt PostgreSQL](#sqlite-statt-postgresql).

## IoT, Edge und das Gateway

Jedes Verzeichnis hat dieselben Units und ein Skript:

- **`hotloop.network`**: das Netzwerk, das die App und ihre Datenbank teilen. Die App erreicht die Datenbank über den Namen (`hotloop-db:5432`) und sonst nichts auf dem Gerät, weil die Datenbank keinen Port veröffentlicht. Veröffentlicht wird nur der Port 8080 der App.
- **`hotloop.container`**: die App. Der Kopf der Datei enthält die Installationsschritte; lesen Sie ihn, bevor Sie etwas kopieren.
- **`hotloop-db.container`**: die Datenbank, dasselbe Image und dieselbe Version, die das Chart dieses Produkts betreibt. Sie meldet sich als gestartet, sobald sie antwortet, damit die App auf eine nutzbare Datenbank wartet.
- **`hotloop-db-upgrade.container`** und **`hotloop-db-upgrade.sh`**: der Wechsel der Datenbank von PostgreSQL 16 auf 17, einmalig. Er läuft vor der Datenbank-Unit und nur, wenn das Volume noch 16er-Daten enthält; bei einem neuen Volume oder einem, das schon auf 17 ist, überspringt systemd ihn. Siehe [PostgreSQL 16 auf 17](#postgresql-16-auf-17).
- **`hotloop-db.volume`** und **`hotloop-data.volume`**: die Datenbank und alles, was die App unter `/data` schreibt (Backups, Zertifikate, die Weiterleitungswarteschlange, Berichte). Benannte Podman-Volumes, die `podman system prune` in Ruhe lässt.

Drei Podman-Secrets halten, was nicht in eine Datei gehört: `hotloop-db-password`, `hotloop-secret-key` (verschlüsselt die Gerätepasswörter in der Datenbank; bewahren Sie eine Kopie außerhalb des Geräts auf) und `hotloop-admin-password-hash` (der bcrypt-Hash des Passworts des ersten Administrators, nie das Passwort).

**Podman 5.0 oder neuer.** Raspberry Pi OS Bookworm liefert Podman 4.3 mit, das gar kein Quadlet hat: Nutzen Sie Raspberry Pi OS Trixie (Podman 5.4) oder neuer. Die Updates weiter unten liefen auf Podman 6.1.3; die Unit des Edge Relay, die dieselben Schlüssel nutzt, auf 4.9.3. Und legen Sie das Datenbank-Volume auf eine USB-SSD, nicht auf die SD-Karte. Der Verlauf schreibt den ganzen Tag, und genau daran sterben SD-Karten.

### Warum alle Produkte dieselben Namen verwenden

Die Namen der Units, der Volumes und der Secrets sind in `iot/`, `edge/` und `gateway/` absichtlich identisch. Ein Gerät auf das nächsthöhere Produkt zu heben heißt, die `hotloop.container` und die `hotloop-db.container` des größeren Produkts über Ihre zu kopieren:

```sh
sudo cp gateway/hotloop.container gateway/hotloop-db.container \
  gateway/hotloop-db-upgrade.container gateway/hotloop-db-upgrade.sh /etc/containers/systemd/
sudo systemctl daemon-reload
sudo systemctl restart hotloop.service hotloop-db.service
```

Die Volumes und die Secrets bleiben, und mit ihnen jedes Gerät, jeder Tag, jeder Alarm, jeder Benutzer und jede Stunde Verlauf. Machen Sie trotzdem vorher ein Backup (`POST /api/backup`). Dieser Schritt wurde ausgeführt, von IoT auf Edge und auf das Gateway mit demselben Satz Volumes. Ein Schritt zurück auf ein kleineres Produkt ist nichts für ein Gerät, an dem Ihnen etwas liegt.

Es bedeutet auch ein HotLoop pro Gerät. Zwei würden sich ohnehin um den Port 8080 streiten.

### Geprüft

Die ausgelieferten Dateien für IoT, Edge und Gateway erzeugen unverändert mit dem Generator `quadlet` aus Podman 6.1.3 dieselbe Struktur: Die App benötigt die Datenbank und das Netzwerk, veröffentlicht ihren eigenen Port und trägt das Label für das automatische Update, während die Datenbank keines trägt und nichts veröffentlicht.

Danach liefen die Units des Gateways wirklich: rootless, unter systemd, mit einer lokalen Registry anstelle von ghcr.io und dem eigenen `podman auto-update` der Produkte. Ein erster Start mit gesunder Datenbank und danach gesunder App; ein Update auf eine Version, die einer von der App schon genutzten Tabelle eine Migration hinzufügt, durchgeführt mit dem vorhandenen Gerät und seinen intakten Daten und ohne den Datenbank-Container je neu zu starten; und ein Update auf eine Version, die die Datenbank migriert und dann nicht starten kann, das Podman zurückgerollt hat, wobei die vorherige Version gesund auf der Datenbank startete, die die fehlgeschlagene schon migriert hatte. Edge und IoT laufen mit denselben Units und wurden unter systemd auf einem echten Pi ausgeführt, auf Bare Metal (2026-11-17).

## PostgreSQL 16 auf 17

Die Datenbank von HotLoop ist ab dieser Version PostgreSQL 17. Ein Gerät, das eine frühere Version betrieb, hat PostgreSQL-16-Daten, die PostgreSQL 17 nicht öffnet, deshalb ist der Wechsel eine Unit, die vor der Datenbank läuft. Legen Sie die neuen Dateien ab und starten Sie die Datenbank neu, mehr ist nicht nötig:

```sh
sudo cp hotloop-db.container hotloop-db-upgrade.container hotloop-db-upgrade.sh \
  /etc/containers/systemd/
sudo systemctl daemon-reload
sudo systemctl restart hotloop-db.service
journalctl -u hotloop-db-upgrade.service      # what it did
```

`hotloop-db.container` benötigt die Upgrade-Unit, daher startet ein Gerät, auf das nur die neue Datenbank-Unit kopiert wurde, nicht auf 16er-Daten, und das Journal nennt den Grund. Die Upgrade-Unit führt `pg_upgrade` im Kopiermodus in ein neues Verzeichnis neben dem alten aus, startet den neuen Server einmal, um zu beweisen, dass er sich öffnet, und tauscht erst dann die Namen; die alten Daten bleiben als `pgdata.pg16` auf dem Volume. Das PostgreSQL-16-Image wird nur geladen, wenn das Volume es braucht. Ein Fehler lässt die 16er-Daten, wie sie waren, und die Datenbank ungestartet. Die vollständige Beschreibung, den Weg zurück und wie Sie `pgdata.pg16` löschen finden Sie unter [k3s und Helm](/de/install/helm/#postgresql-17). Bei einer rootless-Installation ist der Skriptpfad in der Unit `~/.config/containers/systemd`, aus `%E`.

## SQLite statt PostgreSQL

Die Datenbank ist eine Einstellung, kein Image (die Seite zu k3s und Helm, "SQLite"). Unter Quadlet heißt das ein zweiter Satz Dateien, kein zweites Image. Das Verzeichnis `sqlite/` jedes Produkts hat zwei:

- **`sqlite/hotloop.container`**: nur die App. Kein `Requires=` auf eine Datenbank, kein Netzwerk, kein Datenbankpasswort, und `HOTLOOP_DB_TYPE=sqlite` mit der Datei unter `HOTLOOP_DB_PATH=/data/hotloop.db`. Sie folgt `:stable` und rollt ein schlechtes Update genau wie die PostgreSQL-Unit zurück: derselbe Healthcheck, dasselbe `--sdnotify=healthy`.
- **`sqlite/hotloop-data.volume`**: das Volume `hotloop-data`, auf dem die Datenbankdatei und ihre `-wal` und `-shm` liegen. Es ist derselbe Volume-Name wie bei den PostgreSQL-Dateien, also dasselbe Datenvolume, falls Sie je wechseln.

| Verzeichnis | Installation | Secrets |
|---|---|---|
| `iot/`, `edge/`, `gateway/` | `hotloop.network`, `hotloop.container`, `hotloop-db.container`, `hotloop-db.volume`, `hotloop-data.volume` | drei |
| `iot/sqlite/`, `edge/sqlite/`, `gateway/sqlite/` | `hotloop.container`, `hotloop-data.volume` | zwei: `hotloop-secret-key` und `hotloop-admin-password-hash` |

Installieren Sie den einen Satz oder den anderen, nie beide: Sie nutzen dieselben Unit-Namen. Der Kopf von `sqlite/hotloop.container` enthält die genauen Schritte. Kurz gesagt:

```sh
cd iot/sqlite        # or edge/sqlite, gateway/sqlite
sudo cp hotloop.container hotloop-data.volume /etc/containers/systemd/
# make hotloop-secret-key and hotloop-admin-password-hash as the header says
sudo systemctl daemon-reload
sudo systemctl start hotloop.service
curl -s localhost:8080/api/status
```

Ein paar Dinge sollten Sie vor der Wahl wissen. SQLite ist ein Schreiber auf einer lokalen Platte: Ein Pi legt das Volume auf eine USB-SSD, und Netzwerkspeicher ist keine Option, weil SQLite darauf beschädigt wird. Der Verlauf ist eine Tabelle mit einem Index, keine Partitionen und keine Hypertable, deshalb will ein Standort mit Jahren an Verlauf im Sekundentakt die PostgreSQL-Dateien. Und der Wechsel eines Geräts zwischen SQLite und PostgreSQL ist ein Backup und eine Wiederherstellung ([Backups und Wiederherstellung](/de/iot/backup/)), kein Austausch von Units: Die neue Datenbank beginnt leer. Kopieren Sie keine `sqlite/hotloop.container` über eine laufende PostgreSQL-Installation, um zu "wechseln"; sie liest die Daten des PostgreSQL-Volumes nicht.

Reines PostgreSQL auf Edge oder dem Gateway ist die TimescaleDB-Unit mit `Environment=HOTLOOP_HISTORIAN_TIMESCALE=false`, ergänzt in `hotloop.container`. Die Unit von IoT ist bereits reines PostgreSQL, und IoT hat gar keine TimescaleDB-Unit.

### Geprüft (SQLite)

`iot/sqlite/hotloop.container` und sein Volume liefen rootless auf Podman 4.9.3 unter systemd (`systemctl --user`) aus den eingecheckten Dateien, geändert nur bei den Namen, dem Port, dem Image (aus demselben Baum gebaut) und dem Laufzeitverzeichnis, das ein Benutzer-Manager braucht. Die Unit kam gesund hoch, `/healthz` und `/readyz` antworteten mit 200, der Administrator meldete sich mit dem Hash-Secret an, `/api/status` antwortete, `hotloop.db`, `hotloop.db-wal` und `hotloop.db-shm` erschienen auf dem Volume, und ein Neustart wendete keine Migrationen an und meldete den Administrator wieder an. Die `sqlite/`-Units von Edge und Gateway sind dieselbe Datei bis auf das Image und den Standardwert der Aufbewahrung und liefen unter systemd als root auf einem echten Pi, auf Bare Metal (2026-11-17).

## Edge Relay

- **`edge-relay-hold.conf`**: optional: hält Image-Updates zurück, bis ein Bediener sie freigibt. Ein systemd-Drop-in, nicht Teil einer Standardinstallation.
- **`edge-relay.container`**, der Dienst selbst. Die vollständigen Installationsschritte stehen im Kommentar in seinem eigenen Kopf; lesen Sie ihn, bevor Sie etwas kopieren.
- **`edge-relay-data.volume`**, ein benanntes Podman-Volume für die Weiterleitungswarteschlange, damit gepufferte Messwerte einen Neustart des Containers überleben. Podman legt es beim ersten Start des Dienstes automatisch an.
- **`devices.example.json`**, ein Ausgangspunkt für die Gerätedatei. Kopieren Sie sie nach `/etc/edge-relay/devices.json` und passen Sie sie an die tatsächlichen Geräte an diesem Standort an; das vollständige Format steht in [der Referenz zum Edge Relay](/de/edge-relay/reference/).

### Schnellstart

```sh
sudo mkdir -p /etc/containers/systemd /etc/edge-relay
sudo cp edge-relay.container edge-relay-data.volume /etc/containers/systemd/
sudo cp devices.example.json /etc/edge-relay/devices.json   # then edit it
sudo "$EDITOR" /etc/containers/systemd/edge-relay.container  # broker, group, node

# Skip this if the broker takes anonymous connections.
printf '%s' 'your-broker-password' | sudo podman secret create edge-relay-broker-password -

sudo systemctl daemon-reload
sudo systemctl start edge-relay.service
sudo systemctl status edge-relay.service
curl localhost:8081/status
```

**Updates.** Die Unit folgt `:stable` und aktualisiert sich selbst, sobald der Timer von Podman läuft:

```sh
sudo systemctl enable --now podman-auto-update.timer
```

Besteht ein neues Image seinen Healthcheck nicht, stellt Podman das alte wieder her. Die Flottenliste des Gateways zeigt Version und Image-Digest jedes Relays und protokolliert jede Änderung. Um Updates zurückzuhalten, bis ein Administrator sie am Gateway freigibt, installieren Sie `edge-relay-hold.conf`, wie der Kommentar am Anfang dieser Datei es sagt, und schalten Sie den Timer aus. Alles, was das leistet, und was nicht, steht in [der Referenz zum Edge Relay](/de/edge-relay/reference/#ein-relay-aktualisieren).

Um eine Änderung an der lokalen Datei zu übernehmen: bearbeiten Sie sie und führen Sie dann `sudo systemctl restart edge-relay.service` aus. Das Relay liest diese Datei beim Start und überwacht sie nicht.

Eine vom Gateway gepushte Gerätedatei braucht nichts davon: Sie greift live, ohne Neustart. Sie kann nicht nach `/etc/edge-relay/devices.json` geschrieben werden (das ist auf einem schreibgeschützten Root-Dateisystem `:ro` eingehängt), also liegt sie auf dem Daten-Volume als `/data/pushed-devices.json`, und solange sie existiert, führt das Relay sie aus und startet damit. Ihre Änderungen an der lokalen Datei bleiben ungenutzt, bis Sie den Push löschen: `DELETE /api/fleet/{id}/config` am Gateway, während das Relay läuft, und es wechselt sofort zur lokalen Datei zurück. Das Journal sagt, welche Datei aktiv ist, schauen Sie also dort nach, bevor Sie an Ihrem JSON zweifeln.

Geprüft gegen die echte `quadlet`-Binärdatei (`/usr/libexec/podman/quadlet -dryrun` aus `podman-5.8.6`): Beide Units werden fehlerfrei geparst und erzeugen den erwarteten `podman run`-Aufruf, mit der Volume-Abhängigkeit und dem Secret automatisch eingebunden.
