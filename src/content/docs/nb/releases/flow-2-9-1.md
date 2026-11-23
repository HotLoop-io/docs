---
title: "Utgivelsesnotater: HotLoop Flow 2.9.1"
description: "Hva HotLoop Flow 2.9.1 gir deg, hva som endres ved oppgradering og hva du bør lese før du rører et anlegg i drift."
sidebar:
  label: "2.9.1"
---

HotLoop Flow 2.9.1 lar noden `modbus-server` lytte på grensesnittet til ett VLAN, slik at én Flow kan kjøre én server på hvert VLAN på en port, med samme adresse og samme port.

## Nytt

- **`modbus-server` tar et nettverksgrensesnitt.** Lyttesocketen bindes til grensesnittet (`SO_BINDTODEVICE`) før den begynner å lytte, så to servere på `192.168.1.9:10502` på to VLAN kolliderer ikke lenger. Innstillingen er den samme som på hver klient: nodens eget **Nettverksgrensesnitt**, ellers `FLOW_NETWORK_INTERFACE` i miljøvariablene til fanen. Med ingen av dem lytter den som alltid, og to servere på samme adresse og port kolliderer fortsatt, nå med en feil som sier at hver trenger et grensesnitt.

## Hva som er endret

- Usatt oppfører den seg som upstream. NOTICE og `HOTLOOP_PATCH.txt` sier hva som er endret.

## Nye innstillinger

Ingenting utover feltet **Nettverksgrensesnitt** på `modbus-server`. Chart-verdien `bindToInterface.netRaw` og kravet om vertsnettverk fra 2.9.0 gjelder for den som for klientene.

## Oppgradering

En vanlig `helm upgrade` til 2.9.1-avbildet og -chartet, eller den nye taggen i Quadlet-enheten din. Ingenting skjer ved første oppstart, og ingenting må migreres. En flow som ikke setter noe grensesnitt, oppfører seg nøyaktig som den gjorde på 2.9.0.

Avbilde: `ghcr.io/hotloop-io/hotloop-flow:2.9.1`, først linux/amd64, med arm64 som følger i 2.9.2. Chart: `https://hotloop.io/hotloop-flow/`. README-en ved denne taggen har resten, med bilder: https://github.com/HotLoop-io/hotloop-flow/blob/v2.9.1/README.md
