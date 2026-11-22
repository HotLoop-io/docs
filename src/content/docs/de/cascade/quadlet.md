---
title: "Cascade mit Podman Quadlet"
description: "Cascade als systemd-Dienste mit Podman Quadlet betreiben, auf SQLite oder mit Postgres und eigenem Worker, mit einem Update-Fenster, das Sie selbst bestimmen."
---

Es gibt zwei Wege, Cascade zu betreiben. Beide brauchen Podman 5.0 oder neuer und eine Installation als root, damit sie beim Hochfahren starten, auch wenn niemand angemeldet ist. Beide folgen `ghcr.io/hotloop-io/hotloop-cascade:stable`, führen es schreibgeschützt und ohne Root-Rechte aus, mit allen Capabilities entzogen, und lassen systemd es neu starten. Updates und ihr Rollback stehen am Ende.

## Ein Rechner, SQLite

`hotloop-cascade.container` und `hotloop-cascade-data.volume`. Die Datenbank ist eine Datei im Volume, neben dem Schlüssel, der die gespeicherten Zugangsdaten verschlüsselt.

```sh
sudo cp hotloop-cascade.container hotloop-cascade-data.volume /etc/containers/systemd/
sudo install -D -m 600 /dev/null /etc/hotloop-cascade/cascade.env
sudo systemctl daemon-reload
sudo systemctl start hotloop-cascade
```

Öffnen Sie `http://this-box:8080`. Wer es als Erstes öffnet, legt das erste Konto an. Tun Sie das also, bevor Sie die Adresse weitergeben.

## PostgreSQL, ein Server und Worker

`postgres/`. Die Datenbank, der Server und, wenn Sie wollen, weitere Worker. Postgres ist die Warteschlange, also holen sich die Worker ihre Arbeit aus derselben Quelle. Die Datenbank liegt in einem eigenen Netzwerk und veröffentlicht keinen Port.

Zuerst drei Geheimnisse, die Sie einmal anlegen. Die Befehle stehen ganz oben in `postgres/hotloop-cascade.container`. Der Schlüssel ist am wichtigsten: Geht er verloren, sind alle gespeicherten Zugangsdaten unlesbar. Bewahren Sie eine Kopie an einem Ort auf, der nicht dieser Rechner ist.

```sh
cd postgres
sudo cp hotloop-cascade.network hotloop-cascade-db.container hotloop-cascade-db.volume \
  hotloop-cascade-data.volume hotloop-cascade.container /etc/containers/systemd/
sudo install -D -m 600 /dev/null /etc/hotloop-cascade/cascade.env
sudo systemctl daemon-reload
sudo systemctl start hotloop-cascade
```

Weitere Worker: `hotloop-cascade-worker.container`. Worker teilen sich das Datenvolume, also müssen sie auf demselben Rechner laufen. Über einen Rechner hinaus nehmen Sie das Helm-Chart.

## Einstellungen

`/etc/hotloop-cascade/cascade.env`, ein `NAME=value` pro Zeile, und die Datei muss existieren, auch wenn sie leer ist (die `install`-Zeile legt sie an). Die, die Sie am ehesten brauchen:

| Einstellung | Was sie bewirkt |
|---|---|
| `HOTLOOP_CASCADE_PUBLIC_URL` | Die Adresse, unter der Cascade erreichbar ist. Daraus werden die Links für Webhooks und OAuth-Callbacks gebaut. Solange Sie sie nicht setzen, ist sie `http://localhost:8080`, was nur vom Rechner selbst aus funktioniert. |
| `HOTLOOP_CASCADE_METRICS_TOKEN` | Verlangt `Authorization: Bearer` auf `/metrics`. |
| `HOTLOOP_CASCADE_FILES_DIR` | Schaltet die Dateischritte in diesem Verzeichnis ein. Binden Sie es auch in den Container ein. |

Die Units setzen nur das Datenverzeichnis, die Ports und den Schlüssel, und ein Wert in einer Unit gilt vor dem in der env-Datei, also lassen Sie diese in Ruhe. Nach einer Änderung: `sudo systemctl restart hotloop-cascade`.

## Prüfen

```sh
sudo podman healthcheck run hotloop-cascade
curl -s http://127.0.0.1:8081/readyz
sudo podman exec hotloop-cascade /usr/local/bin/hotloop-cascade workflows import - < workflow.yaml
```

Health und Metriken liegen auf Port 8081, der nur auf dem Loopback veröffentlicht ist. Belegt schon etwas anderes 8080 oder 8081, ändern Sie die linke Seite der `PublishPort=`-Zeilen.

## Aktualisieren

Die App-Units folgen `:stable` und tragen `AutoUpdate=registry`. Schalten Sie den Timer von Podman einmal pro Rechner ein:

```sh
sudo systemctl enable --now podman-auto-update.timer
```

Wenn er auslöst, lädt Podman `:stable`, und hat sich der Digest geändert, startet es die Unit mit dem neuen Image neu. Die Unit gilt erst als gestartet, wenn der Container seinen Health-Check besteht (`Notify=healthy`; der Check ist das Binary, das sein eigenes `/readyz` abfragt, als JSON-Array, weil das Image keine Shell hat). Erreicht das neue Image das nie, setzt Podman das vorherige wieder unter `:stable` und startet es. Die Wartezeit beträgt bis zu 15 Minuten, weil ein neues Image beim Hochfahren die Datenbank migriert.

Um Updates zurückzuhalten, bis Sie es sagen, lassen Sie den Timer aus und führen `sudo podman auto-update` aus, wenn Sie bereit sind. Damit sie nur in einem Zeitfenster stattfinden, installieren Sie `update-window.conf` (die Kopfzeilen erklären, wie).

Zwei Dinge, die ein Rollback nicht rückgängig machen kann. Migrationen gehen nur vorwärts, also sichern Sie vorher, bevor Sie Updates einschalten. Ändert ein Release eine Tabelle so, dass das alte sie nicht mehr lesen kann, steht das in seinen Release Notes. Und die Datenbank: Ihr Image ist auf einen exakten Tag festgelegt und trägt absichtlich kein Update-Label. Ein neuer Server, der nicht startet, wird rückgängig gemacht, indem das alte Image zurückkommt. Ein neues Datenbank-Image kann dagegen starten, das Datenverzeichnis ändern und sich erst danach als Fehler erweisen. Innerhalb von PostgreSQL 18 ist das eine Änderung des Tags, nach den Release Notes und einer Sicherung.

In der PostgreSQL-Variante sind der Server und jeder Worker eigene Units, also macht ein Update, das nicht startet, nur diese eine Unit rückgängig und nicht die daneben.

## Was getestet wurde

Die Units liefen wirklich auf Podman 6.1.3, rootless unter systemd, mit einer lokalen Registry anstelle von ghcr.io und den ausgelieferten Units unverändert bis auf die Host-Ports. Eigenständig und PostgreSQL gleichermaßen: ein erster Start, der auf einen gesunden Container wartet; ein Update auf einen neuen Digest, der gesund zurückkam, mit intakten Daten und, in der PostgreSQL-Variante, mit unberührtem Datenbank-Container; und ein Update auf ein Image, das beim Start beendet, was `podman auto-update` als `rolled back` meldete, mit dem vorherigen Digest wieder gesund und dem früheren Workflow weiter laufend. Als Root-Installation auf Podman 4.9.3 starteten und restarteten die früheren Units unter systemd; und `Notify=healthy` wird von Quadlet 4.9 nicht beachtet, weshalb die Units zusätzlich `--sdnotify=healthy` tragen.

Dann beide Varianten noch einmal als Root-Installation, so wie die Units es vorsehen, auf Podman 5.8.7 unter systemd in einem privilegierten Wegwerf-Container, mit derselben lokalen Registry anstelle von ghcr.io als Mirror und den Units unverändert. Eigenständig: Der Start wartete auf einen gesunden Container, ein beendeter Container kam gesund zurück, ein Update auf ein gutes Image kam gesund auf dem neuen Digest hoch, ein Update auf ein Image, das beim Start beendet, wurde als `rolled back` gemeldet, mit dem guten wieder im Betrieb, und nach jedem Schritt lief ein Workflow. PostgreSQL, mit dem Server und einem zusätzlichen Worker: `systemctl start` auf dem Server wartete, bis erst die Datenbank und dann der Server gesund waren, ein beendeter Server kam zurück, ein Update auf ein gutes Image verschob Server und Worker und ließ den Datenbank-Container in Ruhe, ein Update auf ein Image, das beim Start beendet, kam als `rolled back` zurück, mit beiden wieder auf dem guten Image und der Datenbank unberührt, und ein Workflow lief davor, dazwischen und danach. Eines sollten Sie beim Lesen dieser Ausgabe wissen: Server und Worker teilen sich ein Image, und als der erste zurückgerollt wurde, zeigte der andere stattdessen `true`, mit einem Neustart, und landete trotzdem auf dem guten Image. Welcher zuerst zurückrollt, änderte sich von Lauf zu Lauf.

Auf Bare Metal ausgeführt (2026-11-17), auf einem echten Raspberry Pi und mit einem Quadlet-Auto-Update gegen ghcr.io selbst.
