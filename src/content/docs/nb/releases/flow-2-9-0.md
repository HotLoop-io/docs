---
title: "Utgivelsesnotater: HotLoop Flow 2.9.0"
description: "Hva HotLoop Flow 2.9.0 gir deg, hva som endres ved oppgradering og hva du bør lese før du rører et anlegg i drift."
sidebar:
  label: "2.9.0"
---

HotLoop Flow 2.9.0 legger til innebygde koblingsnoder for en ekte anleggsmigrering. Den kjører Node-RED-nodene et anleggs flows bygger på, Modbus, dashbordet, PostgreSQL og e-post, pluss `Buffer` og `setInterval` som funksjonsnodene rundt dem kaller. En flow fanget fra en Node-RED-maskin som bruker dem, lastes, kjører og lagres uendret. Den lar også én Flow ha én fane for hver maskin på en boks der den ene porten bærer ett VLAN for hver, selv når alle VLAN har samme subnett og samme enhetsadresser.

## Nytt

- **Node-RED Modbus.** `modbus-client`, `modbus-read`, `modbus-getter`, `modbus-flex-getter`, `modbus-write`, `modbus-flex-write`, `modbus-server` og den passive `modbustcp-server`. Utdataene er de samme som fellesskapsnodene sender: `msg.payload` som listen med verdier, `msg.responseBuffer` som `{data, buffer}`, `msg.input`, og feil ut på den andre utgangen.
- **Dashbordet.** `ui_base`, `ui_tab`, `ui_group`, `ui_link`, `ui_spacer`, `ui_text`, `ui_numeric`, `ui_button`, `ui_switch`, `ui_text_input`, `ui_led`, `ui_gauge`, `ui_chart` og `ui_template`, servert på `/ui` fra selve binærfilen, uten at noe hentes utenfra anlegget. Det en operatør gjør på siden, kommer ut av noden som en melding. `ui_template` kjører delmengden i AngularJS-stil som anlegg bruker: `{{ }}`, `ng-click`, `ng-class`, `ng-init`, `ng-show`, `ng-hide`, `ng-if`, `ng-bind`, `scope.$watch`, `scope.send`.
- **PostgreSQL.** `postgreSQLConfig` og `postgresql`. Forbindelsen åpnes ved den første spørringen, slik at en database som ikke er oppe ennå, ikke stopper flowen.
- **E-post.** Utdatanoden `e-mail` over SMTP, med STARTTLS, en sertifikatbryter og XOAUTH2.
- **`Buffer`, `setInterval` og `setTimeout` i funksjonsnoden.** Tidtakerne går på nodens klokke, hver tilbakekalling har samme CPU-grense som en melding, og alle tidtakere stoppes når flowen stoppes eller distribueres på nytt.
- **Et nettverksgrensesnitt for hver klient.** En node, en fane eller en klientkonfigurasjon kan oppgi grensesnittet forbindelsene bindes til (`SO_BINDTODEVICE`), slik at en fane for tørker 14 bare når `192.168.1.5` på VLAN 14. På fanen settes det med miljøvariabelen `FLOW_NETWORK_INTERFACE` på fanen, som hver klientnode på den arver. Det finnes på nodene for Modbus, PostgreSQL, e-post, TCP-forespørsel, UDP ut og HTTP-forespørsel.

README-en har en ny seksjon, `docs/node-red-types.md` sier hva som kjører og hvordan det skiller seg, og `docs/compatibility.md` genereres på nytt fra registeret.

## Hva som er endret

- Funksjonsnoden hadde med vilje ikke `Buffer`, `setTimeout` og `setInterval`, og to tester låste det. De er der nå, fordi et anleggs funksjoner bruker dem. Ellers er ikke sandkassen endret: det finnes fortsatt ingen `require`, ingen `process` og ingen standardbibliotek fra Node.
- Med kroken usatt oppfører den seg som upstream. NOTICE og `HOTLOOP_PATCH.txt` sier hva som er endret.
- Grunnen er de innebygde Node-RED-koblingsnodene for en ekte anleggsmigrering.

## Nye innstillinger

- `HOTLOOP_FLOW_UI_PATH`, standard `/ui`: hvor dashbordet serveres.
- `FLOW_NETWORK_INTERFACE`, en miljøvariabel for fane, underflyt eller prosess: grensesnittet klientene i den fanen binder seg til. Tom som standard, som lar verten velge, som før.
- Et felt **Nettverksgrensesnitt** på hver klientnode og konfigurasjon.
- Chart-verdi `bindToInterface.netRaw`, standard `false`. Å binde en socket til et grensesnitt krever ingen capability på Linux 5.7 og nyere. På en eldre kjerne krever det `CAP_NET_RAW`, og å sette den til `true` legger til akkurat den ene capabilityen i poden og ingenting mer. Poden trenger også vertens nettverk (`network.mode: host`) for å se et VLAN-grensesnitt.

## Oppgradering

En vanlig `helm upgrade` til 2.9.0-avbildet og -chartet, eller den nye taggen i Quadlet-enheten din. Ingenting skjer ved første oppstart, ingenting må migreres, og en flow som ikke brukte noen av de nye typene, kjører som før. En flow som allerede har disse typene (en fanget Node-RED-fil), starter dem nå, der den før meldte hver av dem som en ukjent nodetype.

## En endring i NOTICE og lisensene

NOTICE får oppføringen for Modbus-biblioteket, som nå er en endret kopi. Ingen ny tredjepartsmodul ligger i avbildet.

Avbilde: `ghcr.io/hotloop-io/hotloop-flow:2.9.0`, først linux/amd64, med arm64 som følger i 2.9.1. Chart: `https://hotloop.io/hotloop-flow/`. README-en ved denne taggen har resten, med bilder: https://github.com/HotLoop-io/hotloop-flow/blob/v2.9.0/README.md
