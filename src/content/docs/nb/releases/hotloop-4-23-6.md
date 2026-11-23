---
title: "Utgivelsesnotater: HotLoop core 4.23.6"
description: "Hva HotLoop core 4.23.6 gir deg, hva som endrer seg ved oppgradering og hva du bør lese før du rører et anlegg i drift."
sidebar:
  label: "4.23.6"
---

Rutene i veikartet for Protect, Access og strømbokser får kode, Shelly-enheten snakker direkte med Shelly, og OPC UA PubSub får meldingssikkerhet og metadata. Bygd bare for amd64; multi-arch-bygget følger som neste versjon.

## Hva som er endret

- **UniFi Protect, som enhet.** Protokoll `unifi-protect`, med en API-nøkkel fra konsollens Integrations-side, forseglet som et konsollpassord og med sertifikatet festet. Kameraer, sensorer, lys og sirener er tagger som legger seg til selv. Et kameras bevegelse og smarte deteksjoner (person, kjøretøy, pakke, bilskilt, ansikt, dyr) kommer fra hendelses-websocketen og leses dårlige mens den er nede, aldri «ingen bevegelse». En sirene kan armeres til å spille, og `alarm.<trigger>.fire` sender alarmbehandlerens webhook så en HotLoop-alarm får kameraene til å ta opp. Et kameras snapshot er én rute. Hver hendelse er i logbook. Se [UniFi Network](/nb/iot/unifi/#unifi-protect).
- **UniFi Access, som enhet.** Protokoll `unifi-access`, med et API-token. Hver dørs posisjon og lås er tagger, holdt à jour av varslings-websocketen, og hver endring er i logbook. Å låse opp er en skriving en person armerer, gjennom skriveporten, revidert. Se [UniFi Network](/nb/iot/unifi/#unifi-access).
- **SmartPower PDU-uttak.** Et uttaks relé, effekt, strøm, spenning og effektfaktor er tagger på UniFi Network-enheten, og en PDUs totale forbruk er én. Å skrive `on` til et uttak slår det på og beholder navnet på hvert annet uttak; `cycle` slår det av, venter og slår det på igjen, høyst én gang per 15 minutter, og ender alltid på. Se [UniFi Network](/nb/iot/unifi/#smartpower-pdu-uttak).
- **En Shelly-enhet.** Protokoll `shelly`: Gen2 og senere RPC med enhetens egen digest-innlogging, tagger for hver komponent den melder, skrivinger for en bryter, et lys, en gardin og en termostat. Gen1 avvises med en melding som sender den til MQTT.
- DataSetMetaData- og discovery-svar, i biter når de er store, lest fra fangede meldinger fra en Siemens-publisher. Publisheren kunngjør metadataene sine hvert tiende intervall som standard (`HOTLOOP_UADP_PUBLISH_METADATA_EVERY`, 0 slår det av). Se [Protokoller og drivere](/nb/iot/protocols/).
- **Tømmeren av videresendingskøen ser etter igjen, og sier når den feiler.** Et gjennomløp som ikke sendte noe mens målinger ventet, ventet før på et dytt en stille polling aldri sender, og et mislykket gjennomløp trakk seg tilbake et halvt minutt uten noen linje i loggen.
- **Tester venter på det de venter på.** Seks energitester venter på riggens målinger i stedet for en fast pause.

- **En taus Modbus-enhet leses dårlig på hvert punkt.** På en seriell linje brukte en forespørsel som tidsavbrøt, hele pollingfristen, så bare den første blokken ble dårlig og hvert senere punkt beholdt sin siste gode verdi så lenge kabelen var trukket. Nå markerer en enhet som ikke svarer noe, hvert punkt som dårlig i samme polling. Se [Protokoller og drivere](/nb/iot/protocols/).
- **Ferdige funksjoner leveres på.** I Helm-chartet og i binærfilen: den innebygde MQTT-megleren (loginene lages i HotLoop), OPC UA-serveren (autentisering på, med en generert `opcua-reader`-innlogging som Settings viser en admin), planlagte rapporter, den daglige lokale sikkerhetskopien (hver 24. time, 5 Gi-volum), ServiceMonitor (rendret bare der Prometheus-operatorens CRD-er finnes, så en klynge uten dem installeres som før), og en Ingress uten vertsnavn, som svarer på hver vert klassen betjener til `ingress.hosts[0].host` settes. Rapporter, sikkerhetskopier, OPC UA-sertifikatene og edge-køen bruker som standard en skrivbar katalog under HotLoops datakatalog, og en port en annen tjeneste allerede holder, står uvirksom og sier det. Chartene `hotloop` og de genererte IoT- og Edge-chartene bærer det.
- **Alarmkanalene og edge-publisheren er på, og venter på et mål.** Kanalene webhook, e-post, ntfy, Gotify, Discord-webhook og Discord-bot, og `edgePublish`, er på fra første oppstart. En uten sted å sende lenger stopper ikke installasjonen eller oppstarten: den venter og sier det. En admin legger inn hvert mål under Settings, «Where alarms and readings go», og det som lagres der, går foran chartets verdier. Alarmkanalene gjelder ved lagring; edge-publisherens mål gjelder ved neste omstart. Settings har også et OPC UA-serverkort med endepunktet og den genererte innloggingen.
- **Kafka-målet venter på at en megler plasserer et nytt topic.** En enkelt megler som en travel vert avgrenser et øyeblikk, fikk det første blikket til å feile med `INVALID_REPLICATION_FACTOR`; målet venter nå til tiden går ut og sier hva megleren svarte.
- **Tømmeren av videresendingskøen ser etter igjen, og sier når den feiler.** Et gjennomløp som ikke sendte noe mens målinger ventet, ventet før på et dytt en stille polling aldri sender, og et mislykket gjennomløp trakk seg tilbake et halvt minutt uten noen linje i loggen.

- **Videreført fra 4.23.4 og 4.23.5.** TwinCAT `.TcVIS`- og cds-text-sync- og codescribe-skjermer importeres med knappene, rammene, lampene og uttrykksreglene sine, og UniFi-skjermens oppdatering venter på visningen som lastes. Ingen av versjonene ble utgitt, så begge er her. Se [4.23.4](/nb/releases/hotloop-4-23-4/) og [4.23.5](/nb/releases/hotloop-4-23-5/).

## Migreringer

Ingen.

## API-endringer

`GET /api/unifi-protect/{id}/cameras/{camera}/snapshot` gir kameraets gjeldende JPEG. Protokolllisten har `unifi-protect` og `unifi-access`. Se [HTTP-API-et](/nb/iot/api/).

## Oppgradere fra 4.23.5

En vanlig `helm upgrade`. Ingen migrering og ingen ny secret. 4.23.4 og 4.23.5 ble tagget, og release-kjøringene deres feilet i testjobben før noe ble utgitt, så den siste versjonen før denne er 4.23.3, og denne bærer begges endringer. En verdifil som setter noen av funksjonene over, går fortsatt foran; sett én til `false`, og den rendrer ingen listener, Service, volum eller Ingress.

## Hva som ikke er bevist

- Protect, Access og PDU-ens uttak ble bygd fra de utgitte API-ene og holdt mot stand-in-konsoller som holder tilstand. Ingen har vært på en ekte konsoll eller PDU, så rutene deres i veikartet er ikke avkrysset.
- Et snapshot festet til et alarmvarsel er ikke bygd.
- PubSub: en Security Key Service er ikke bygd (nøklene er statiske), og ingen Siemens-, CODESYS- eller Beckhoff-publisher har vært på en benk.
- Deaktivering av UniFi-porter venter fortsatt på forespørselen fra webgrensesnittet til en ekte 10.6-konsoll.
