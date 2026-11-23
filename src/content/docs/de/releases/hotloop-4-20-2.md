---
title: "Versionshinweise: HotLoop core 4.20.2"
description: "Was HotLoop core 4.20.2 bringt, was sich beim Update ändert und was Sie lesen sollten, bevor Sie eine laufende Anlage anfassen."
sidebar:
  label: "4.20.2"
---

Zwei Korrekturen auf der [4.20.1](/de/releases/hotloop-4-20-1/) und die Lizenz. Dies ist die erste Core-Version unter der EmberNet Source License 1.0 (`LicenseRef-EmberNet-Source-1.0`): LICENSE, NOTICE, das README, die Chart-Annotationen und die Image-Labels sagen es.

- **EtherNet/IP mit mehr als einem Tag in einem Batch.** Der Treiber bat `ReadMulti` der Bibliothek um einen Batch, das ein Struct mit getaggten Feldern oder eine Map erwartet, und ein einfacher Tag-Name lässt es in reflect in Panik geraten, bevor ein Byte hinausgeht. Also geriet jedes EtherNet/IP-Gerät mit zwei oder mehr Tags in einem Batch bei seiner Abfrage in Panik (Batches haben standardmäßig zwanzig). Niemand sah es in einem Test, weil kein Test je einen Batch gegen einen Server gestellt hatte. Jetzt lassen die Tests einen EtherNet/IP-Server und einen S7-Server im Prozess laufen, die Treiber lesen sie über TCP, und der Batch geht durch `ReadList`. Ein Controller, der mit offenem Socket verstummt, ist innerhalb einer Abfrage plus seines Timeouts ausgefallen, wie vorgesehen, und wird nicht mehr Tag für Tag erneut gefragt, was die Abfrage einen Timeout pro Tag aufhielt. S7comm und EtherNet/IP sind noch nicht gegen eine physische SPS bewiesen.
- **`version` ist ein Wort.** `podman run ghcr.io/hotloop-io/hotloop:4.20.1 version` starb mit „database password is not set“, weil vor dem Lesen der Konfiguration nur `--version` behandelt wurde. `version` gibt die Version jetzt mit leerer Umgebung aus, für Gateway, Edge und IoT und für den Edge Relay.

- Keine Migrationen, keine neuen Secrets, keine API-Änderungen. Ein normales `helm upgrade` oder das Quadlet-Auto-Update nimmt sie mit.
- Alle vier Charts (`hotloop`, `hotloop-iot`, `hotloop-edge`, `hotloop-edge-relay`) stehen auf 4.20.2, mit jeder früheren Version weiter im Index.
- Dieser Build ist nur amd64, und `stable` behält die arm-Images, die es hält. Die nächste Version ist eine kleine Versionserhöhung, die die arm-Images baut.
