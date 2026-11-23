---
title: "Utgivelsesnotater: HotLoop core 4.20.2"
description: "Hva HotLoop core 4.20.2 gir deg, hva som endrer seg ved oppgradering og hva du bør lese før du rører et anlegg i drift."
sidebar:
  label: "4.20.2"
---

To rettinger oppå [4.20.1](/nb/releases/hotloop-4-20-1/), og lisensen. Dette er den første kjerneversjonen under EmberNet Source License 1.0 (`LicenseRef-EmberNet-Source-1.0`): LICENSE, NOTICE, README, chart-annotasjonene og image-etikettene sier det.

- **EtherNet/IP med mer enn én tag i en batch.** Driveren ba bibliotekets `ReadMulti` om en batch, som tar en struct av taggede felt eller en map, og et vanlig tagnavn får den til å gå i panikk i reflect før en byte har gått ut. Så hver EtherNet/IP-enhet med to eller flere tagger i en batch fikk pollingen sin til å gå i panikk (batcher er tjue som standard). Ingen så det i en test, fordi ingen test noen gang hadde satt en batch mot en server. Nå kjører testene en EtherNet/IP-server og en S7-server i prosessen, driverne leser dem over TCP, og batchen går gjennom `ReadList`. En kontroller som blir taus med socketen åpen, er nede innen en polling pluss timeouten sin, slik det var ment, og blir ikke lenger spurt på nytt tag for tag, noe som holdt pollingen igjen én timeout per tag. S7comm og EtherNet/IP er fortsatt ikke bevist mot en fysisk PLS.
- **`version` er et ord.** `podman run ghcr.io/hotloop-io/hotloop:4.20.1 version` døde med «database password is not set», fordi bare `--version` ble håndtert før konfigurasjonen ble lest. `version` skriver nå ut versjonen med et tomt miljø, for Gateway, Edge og IoT, og for Edge Relay.

- Ingen migreringer, ingen nye secrets, ingen API-endringer. En vanlig `helm upgrade` eller Quadlet-auto-update tar den.
- Alle fire chartene (`hotloop`, `hotloop-iot`, `hotloop-edge`, `hotloop-edge-relay`) er på 4.20.2, med hver tidligere versjon fortsatt i indeksen.
- Dette bygget er bare amd64, og `stable` beholder arm-imagene det har. Neste versjon er en liten versjonsøkning som bygger arm-imagene.
