---
title: "Das automatische Update :stable"
description: "Jedes Gerät folgt dem Tag stable. Was ein Update tut, was ein Rollback nicht rückgängig macht und wie Sie Updates bis zu Ihrer Freigabe anhalten."
---

Jedes Gerät folgt `:stable`, und Podman aktualisiert es. Das ist die Regel für alle vier Produkte, und deshalb legt keine Unit hier eine Versionsnummer fest: Ein auf `4.17.0` festgelegtes Gerät ist genau so alt wie der Tag, an dem es jemand installiert hat, und niemand fährt zurück in die Anlage, um ein Tag zu ändern. Jedes Release-Tag verschiebt `:stable`, und ein Release, dessen Units ihm nicht folgen, wird abgelehnt.

Schalten Sie den Timer einmal pro Gerät ein:

```sh
sudo systemctl enable --now podman-auto-update.timer
```

## Was ein Update tut

Podman lädt `:stable`, wenn der Timer auslöst, und startet die Unit der Anwendung auf dem neuen Image neu, sobald sich der Digest geändert hat. Nur die der Anwendung: Der Datenbank-Container wird nicht angefasst, ein Update unterbricht also den Historian nicht. Die Unit hat einen Healthcheck, der keine Shell braucht (das Image hat keine): `hotloop healthcheck` fragt den eigenen `/readyz` der Anwendung ab, der nur antwortet, solange die Datenbank antwortet. Die Unit bleibt in "activating", bis er besteht, sodass Podman ein Update, das wieder oben ist, von einem unterscheiden kann, das es nicht ist; kommt das neue Image nie hoch, setzt Podman das vorherige wieder unter `:stable` und startet es.

Beim Start des neuen Images laufen zuerst seine Migrationen, auf der bereits vorhandenen Datenbank, und eine große Datenbank braucht dafür Zeit. Die Unit gibt der Anwendung 15 Minuten, um zu antworten, bevor sie das Update als gescheitert wertet, und Fehler in den ersten fünf Minuten zählen nicht, denn eine Migration ist kein Fehler.

Zwei Dinge wurden beim Ausführen gefunden, nicht beim Lesen, und die Units enthalten für jedes die Korrektur. Ein einfacher `HealthCmd`-String läuft über `/bin/sh -c`, und das Image hat keine Shell, der Check konnte also nie bestehen: Er ist ein JSON-Array. Und ältere Quadlet-Versionen lesen `Notify=healthy` als einfaches `true` und übergeben `--sdnotify=conmon`, was die Anwendung für oben erklärt, sobald ihr Container startet: Ein Update, das nicht starten konnte, wurde als Erfolg gemeldet, und nichts wurde zurückgesetzt. Die Units setzen `--sdnotify=healthy` selbst.

## Warum es keinen Pod gibt

Anwendung und Datenbank teilten sich früher einen Pod. Das kostete das Rollback, und es wurde durch Ausführen gefunden, nicht durch das Handbuch. Bei einem Container in einem Pod startet das Auto-Update von Podman die Unit **des Pods** neu, und die Unit des Pods kommt problemlos hoch, was auch immer mit der Anwendung darin nicht stimmt. Ein Release, das nicht starten konnte, wurde als `UPDATED true` gemeldet, die Anwendung geriet damit in eine Absturzschleife (zwanzig Neustarts in den ersten Minuten), und `:stable` auf dem Gerät war das defekte Image. Außerdem wurde bei jedem Update der Anwendung die Datenbank neu gestartet. Mit einem Netzwerk statt eines Pods ist die Anwendung eine eigene Unit, Podman startet diese neu, und die Unit bleibt in "activating", bis die Anwendung `/readyz` beantwortet: Dasselbe Release kam als `UPDATED rolled back` zurück.

## Was ein Rollback nicht rückgängig machen kann

Eine Migration. Wenn ein Release die Datenbank migriert und dann seinen Healthcheck nicht besteht, setzt Podman das vorherige Release zurück, und es startet auf dem Schema, das das gescheiterte hinterlassen hat. Das ist sicher, und es wird auf drei Wegen sicher gehalten ([Migrationen fügen nur hinzu](/de/iot/migrations/) hat die Einzelheiten):

- **Migrationen fügen nur hinzu.** Eine Tabelle, eine Spalte mit Standardwert, einen Index. Nie ein Löschen, Umbenennen oder eine Typänderung, sodass das vorherige Release alles, was es kannte, dort findet, wo es war, und das Hinzugefügte nie ansieht.
- **Eine Anwendung lehnt ein Schema ab, dem sie nicht trauen kann.** Die Datenbank vermerkt, welches Release jede Migration angewendet hat. Ein zurückgesetztes Release, das einen Schritt zurückliegt, startet und sagt das in seinem Log. Eines, das zwei oder mehr Releases zurückliegt, startet nicht und nennt den Grund mit beiden Versionen. Das ist der Fall, in dem ein Gerät ein Update nicht besteht, zurückrollt, ein weiteres nicht besteht und die Datenbank nun zweimal weitergerückt ist. Die Anwendung beendet sich sofort mit der Meldung in `journalctl -u hotloop`, und das `Restart=always` der Unit versucht es weiter und wird weiter abgelehnt. Abhilfe schafft ein Release, das das Schema kennt: das neueste, also das, was `:stable` ist (`sudo podman auto-update`, oder ziehen und neu starten). Oder spielen Sie eine Sicherung zurück, die das Release erstellt hat, das Sie gerade betreiben ([Sicherung und Wiederherstellung](/de/iot/backup/)).

Ein Rollback hat also keinen Vorbehalt in den Release Notes mehr. Was es weiterhin nicht rückgängig machen kann, sind Daten: Das gescheiterte Release kann Zeilen geschrieben haben, die das alte ignoriert. Erstellen Sie eine Sicherung, bevor Sie Updates einschalten; sie ist das Einzige zwischen einem schlechten Release und einer Wiederherstellung.

## Warum die Datenbank nicht `:stable` folgt

Die Anwendung trägt das Label für Auto-Update. Der Datenbank-Container nicht, und sein `Image=` ist ein exaktes Tag. Der Grund: Updates der Anwendung lassen sich zurücknehmen, die der Datenbank nicht.

- Eine **PostgreSQL-Hauptversion** (16 auf 17) ist kein Neustart. Die Versionierungsrichtlinie von PostgreSQL sagt, dass das Datenverzeichnis über Hauptversionen hinweg nicht abwärtskompatibel gehalten werden kann und ein Dump und Neuladen oder `pg_upgrade` nötig ist ([postgresql.org/support/versioning](https://www.postgresql.org/support/versioning/)). Ein Tag, das über Hauptversionen schwimmt, würde das dem Historian einer Anlage bei einem unbeteiligten Neustart antun. Die Hauptversion festzulegen ist das Minimum und kein "Endpoint-Pin" im Sinne der Regel oben. Der einzige Sprung, den HotLoop gemacht hat, 16 auf 17, ist `hotloop-db-upgrade.container`, bewusst ausgeführt, wenn Sie die neuen Units kopieren.
- Ein **Minor-Release** (16.14 auf 16.15) braucht weder Dump noch Wiederherstellung. Dieselbe Seite fügt hinzu, dass manche "zusätzliche Schritte erfordern können, lesen Sie daher immer zuerst die Release Notes". Ein unbeaufsichtigtes Gerät liest keine Release Notes.
- **TimescaleDB** (der Gateway und der Edge) ist die andere Hälfte. Die Anwendung führt `ALTER EXTENSION timescaledb UPDATE` beim Start nach einem neueren Image selbst aus, und ein Extension-Update ist eine Einbahnänderung an der Datenbank: Das ältere Image danach wieder einzusetzen macht sie nicht rückgängig. Ein schwimmendes Timescale-Tag würde das umkehrbare Update der Anwendung ein unumkehrbares hinter sich herziehen lassen.
- Ein neues Datenbank-Image, das startet und läuft, ist noch kein gesundes. Der Healthcheck kann einen Container, der nicht startet, von einem unterscheiden, der startet, und mehr nicht. Ob ein Historian ein Engine-Upgrade überstanden hat, beantwortet `pg_isready` nicht.

Das Datenbank-Tag bewegt sich daher mit einem HotLoop-Release, das dagegen getestet wurde. `release_guard.sh` hält jedes `hotloop-db.container` gleich der Datenbank seines Charts, sodass ein Quadlet-Gerät und eine Chart-Installation desselben Produkts dieselbe ausführen, und lehnt ein `AutoUpdate=` darauf ab. Der Preis: Die Patch-Releases von PostgreSQL erreichen ein Gerät, wenn ein Release sie mitbringt oder wenn Sie das Tag von Hand ändern. Innerhalb derselben Hauptversion ist das eine Änderung an `hotloop-db.container`, ein `daemon-reload` und ein Neustart des Pods, nach dem Lesen der Release Notes und einer Sicherung. Eine Hauptversion bedeutet `pg_upgrade`, das HotLoop für 16 auf 17 ausführt und das Sie für jede andere selbst ausführen oder in das Sie zurückspielen.

## Updates anhalten, bis Sie es freigeben

Standardmäßig gibt es keinen Halt: Updates laufen, wenn der Timer auslöst. Ein Standort, der eine Person entscheiden lassen will, hat zwei Wege, und keiner setzt voraus, dass die Anwendung erreichbar ist.

- **Anhalten.** Lassen Sie `podman-auto-update.timer` aus. Nichts wird aktualisiert. Wenn Sie bereit sind, führen Sie `sudo podman auto-update` aus: Das ist die Freigabe, mit demselben Healthcheck und demselben Rollback. Podman aktualisiert beim Ausführen alle gelabelten Container der Maschine, nicht nur diese, und lässt sich nicht anweisen, einen zu überspringen; ein Gerät, das den Timer für andere Container laufen lassen muss, kann diese hier daher nicht zugleich anhalten.
- **Ein Zeitfenster.** `update-window.conf` ist ein Drop-in für den Timer, das festlegt, wann er auslösen darf, etwa sonntags um 03:00, statt der Voreinstellung täglich um Mitternacht:

  ```sh
  sudo mkdir -p /etc/systemd/system/podman-auto-update.timer.d
  sudo cp update-window.conf /etc/systemd/system/podman-auto-update.timer.d/
  sudo systemctl daemon-reload && sudo systemctl restart podman-auto-update.timer
  ```

Der Edge Relay ist in einem Punkt anders: Ein Gateway kann sein Update über die Flottenansicht freigeben, weil ein Relay ohnehin auf Befehle des Gateways lauscht, an den es weiterleitet. IoT, Edge und Gateway haben keinen solchen Kanal, und einen zu bauen würde einen Knopf "dieses Gerät neu starten" auf eine Weboberfläche setzen, für eine Funktion, die `sudo podman auto-update` schon ist. Den Halt des Relays und `edge-relay-hold.conf` finden Sie in der [Edge-Relay-Referenz](/de/edge-relay/reference/#ein-relay-aktualisieren).

## Was der Gateway sieht

`GET /api/status` bei einem der drei nennt seine `version` und seinen `imageDigest`, wenn die Unit ihn mitgeteilt hat (sie tut es, vor jedem Start). Ein Edge oder Gateway mit aktivierter Edge-Veröffentlichung ist ein Sparkplug-Knoten wie ein Relay und legt dieselben zwei Angaben in jede Birth-Nachricht, sodass ein Gateway, der ihn in seiner Flottenliste hat, Version und Digest anzeigt und die Änderung protokolliert, wenn ein Auto-Update ihn bewegt ([Flottenverwaltung](/de/gateway/fleet/)). IoT hat keinen Upstream, daher steht sein Digest auf seinem eigenen `/api/status` und sonst nirgends.

## Unter Helm

Ein Pod kann sich nicht selbst ersetzen, daher gibt es für die Charts kein unbeaufsichtigtes Update: `helm upgrade` ist das Update, und das `image.tag` des Charts hat als Standard sein `appVersion`, also das Release.
