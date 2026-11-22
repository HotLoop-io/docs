---
title: "Nodepaletten"
description: "Hver nodetype Flow leveres med, merket full, delvis, avvikende eller bare i Flow, med forskjellen fra Node-RED skrevet ned."
---

**117 nodetyper for meldinger og 39 til for FlowLab-diagrammer.**

| Kategori | Noder |
|---|---|
| Vanlige | inject, debug, complete, catch, status, link in, link out, comment, junction |
| Funksjon | function, switch, change, range, template, delay, trigger, exec, rbe |
| Nettverk | ntfy out, gotify out, discord out, discord bot out, kafka out, mqtt in/out, http in, http response, http request, websocket in/out, tcp in/out, tcp request, udp in/out, modbus read/write, s7 read/write, ethernetip read/write, opcua read/write/subscribe, sparkplug in/out/command, hotloop in/state/script/recipe, mcp tool/result/client, e-mail, og Node-REDs noder modbus-read/getter/flex-getter/write/flex-write/server |
| Sekvens | split, join, sort, batch |
| Parser | csv, html, json, xml, yaml |
| Lagring | file, file in, watch, influxdb out, postgres, postgresql |
| Dashbord | ui_text, ui_numeric, ui_button, ui_switch, ui_text_input, ui_led, ui_gauge, ui_chart, ui_template, og ui_base, ui_tab, ui_group, ui_link og ui_spacer som legger opp siden |
| Oppdagelse | scan, netinfo, for å kartlegge et OT-segment |
| Konfigurasjon | hotloop-flow-ntfy, hotloop-flow-gotify, hotloop-flow-discord-bot, hotloop-flow-kafka, mqtt-broker, websocket-listener, websocket-client, influxdb, postgres, modbus, s7, ethernetip, opcua, sparkplug, hotloop, mcp-server, modbus-client, postgreSQLConfig |
| FlowLab | constant, math, compare, logic, wait, bundle, field, build array, while loop, for loop, body in, body out, serial port, serial read, serial write, parse reading, stable value, log to text file, log to TDMS file, statistics, integral, derivative, filter, read DAQ task, mqtt out, postgres out, control, indicator, chart |

FlowLab-raden er en annen slags node. Den kjører på en fane som er et diagram, der en node kjører én gang når hver inngang har en verdi, og aldri tar imot en melding. Hva FlowLab er, og hvordan løkkene, feilkoblingen, panelet og feilsøkeren fungerer, står i [FlowLab](/nb/flow/flowlab/). Én flytfil, og dermed ett sett med diagrammer, kan skyves til hver Flow-installasjon en leietaker kjører i EmberNet, hver sjekket og en som feiler satt tilbake: [Skyve til en leietakers stasjoner](/nb/flow/stations/). To installasjoner kan dele jobben til én, med en leieavtale og en sperre på hver skriving til utstyr slik at bare én skriver: [En varm reserve med leieavtale](/nb/flow/failover/).

## Varsle folk, og Kafka

Fem noder sender det en melding bærer et annet sted hen og sender meldingen videre: **ntfy out**, **gotify out**, **discord out** (en webhook), **discord bot out** og **kafka out**. De bruker de samme innstillingene som HotLoop-kjernen sender alarmer og hendelser med, så et anlegg som allerede har et ntfy-emne, et Gotify-program, en Discord-webhook eller en Kafka-klynge peker Flow mot de samme.

- **ntfy.** En serverkonfigurasjonsnode (adresse, så et tilgangstoken eller et brukernavn og passord, eller ingenting for en server som lar hvem som helst publisere), og per node et emne, en tittel, en prioritet (min til maks, eller `msg.priority`), tagger og en klikkadresse. Et tomt emne eller en tom tittel tar `msg.topic` eller `msg.title`. På en offentlig server er emnet den eneste hemmeligheten som finnes, så det holdes utenfor alle feil og statuser.
- **Gotify.** En serverkonfigurasjonsnode med programmets token, og per node en tittel og en prioritet fra 0 til 10.
- **Discord-webhook.** Webhook-URL-en er hele legitimasjonen, på noden, og vises aldri i en status, en logg eller en feil, ikke engang i en nettverksfeil som nevner adressen. En tittel eller en farge gjør meldingen til en embed. Innhold kuttes ved 2,000 tegn og en embeds beskrivelse ved 4,096, telt slik Discord teller, og ingenting i en melding kan pinge noen.
- **Discord-bot.** En botkonfigurasjonsnode med token, og per node en kanal-ID (eller `msg.channel`). Den poster som boten og krever at boten er i kanalen med tillatelse til å sende.
- **Kafka out.** En klyngekonfigurasjonsnode (brokere, SASL PLAIN eller SCRAM-SHA-256 eller SCRAM-SHA-512, TLS), og per node et emne og en valgfri nøkkel. Verdien er `msg.payload`, som tekst, eller som JSON når den ikke er tekst, og meldingen sendes videre når klyngen har bekreftet den fra alle synkroniserte replikaer. Den bruker franz-go, klienten kjernens Kafka-utgang bruker.

En server som nekter, sier hvorfor i nodens feil, uten noe av det som ble sendt. En hastighetsgrense ventes ut én gang, så lenge serveren sier, opptil ett minutt, og deretter feiler meldingen. Det finnes ingen Slack- eller Teams-node og ingen UADP-node: HotLoop tar imot UADP og Flow leser disse verdiene gjennom HotLoop-nodene.

Bevist mot en ekte ntfy, en ekte Gotify og en ekte Redpanda: noden publiserer og serveren spørres om hva den inneholder. Discord-nodene følger Discords dokumenterte API for webhooks og boter.

`scan` skanner et CIDR-område og identifiserer Modbus- og EtherNet/IP-endepunkter, og `netinfo` melder grensesnittene kjøretiden faktisk kan se, som i macvlan-modus er hvordan en flyt oppdager sin egen adresse på OT-VLAN-et. Modbus TCP-, S7-, EtherNet/IP-, OPC UA- og Sparkplug B-nodene kan nå snakke med det `scan` finner, og de er neste seksjon.

Én Go-beskrivelse per nodetype deklarerer egenskaper, porter, standardverdier og hjelpetekst, og editoren lager dialogen fra den, så en node kan ikke leveres med en dialog som er uenig med kjøretiden.
