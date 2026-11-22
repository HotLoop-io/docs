---
title: "La palette dei nodi"
description: "Ogni tipo di nodo fornito da Flow, etichettato completo, parziale, divergente o solo di Flow, con la differenza rispetto a Node-RED scritta per esteso."
---

**117 tipi di nodo per i messaggi e altri 39 per i diagrammi FlowLab.**

| Categoria | Nodi |
|---|---|
| Comuni | inject, debug, complete, catch, status, link in, link out, comment, junction |
| Funzione | function, switch, change, range, template, delay, trigger, exec, rbe |
| Rete | ntfy out, gotify out, discord out, discord bot out, kafka out, mqtt in/out, http in, http response, http request, websocket in/out, tcp in/out, tcp request, udp in/out, modbus read/write, s7 read/write, ethernetip read/write, opcua read/write/subscribe, sparkplug in/out/command, hotloop in/state/script/recipe, mcp tool/result/client, e-mail, e i nodi modbus-read/getter/flex-getter/write/flex-write/server di Node-RED |
| Sequenza | split, join, sort, batch |
| Parser | csv, html, json, xml, yaml |
| Archiviazione | file, file in, watch, influxdb out, postgres, postgresql |
| Dashboard | ui_text, ui_numeric, ui_button, ui_switch, ui_text_input, ui_led, ui_gauge, ui_chart, ui_template, e i ui_base, ui_tab, ui_group, ui_link e ui_spacer che impaginano la pagina |
| Scoperta | scan, netinfo, per fare l'inventario di un segmento OT |
| Configurazione | hotloop-flow-ntfy, hotloop-flow-gotify, hotloop-flow-discord-bot, hotloop-flow-kafka, mqtt-broker, websocket-listener, websocket-client, influxdb, postgres, modbus, s7, ethernetip, opcua, sparkplug, hotloop, mcp-server, modbus-client, postgreSQLConfig |
| FlowLab | constant, math, compare, logic, wait, bundle, field, build array, while loop, for loop, body in, body out, serial port, serial read, serial write, parse reading, stable value, log to text file, log to TDMS file, statistics, integral, derivative, filter, read DAQ task, mqtt out, postgres out, control, indicator, chart |

La riga FlowLab è un altro tipo di nodo. Gira su una scheda che è un diagramma, dove un nodo viene eseguito una volta quando ogni ingresso ha un valore, e non riceve mai un messaggio. Cos'è FlowLab, e come funzionano i suoi cicli, il filo d'errore, il pannello e il debugger, è in [FlowLab](/it/flow/flowlab/). Un file di flusso, e quindi un insieme di diagrammi, può essere inviato a ogni installazione di Flow che un tenant esegue in EmberNet, ciascuna controllata e quella fallita ripristinata: [Invio alle stazioni di un tenant](/it/flow/stations/). Due installazioni possono condividere il lavoro di una, con un lease e una barriera su ogni scrittura verso le apparecchiature in modo che scriva una sola: [Uno standby a caldo con un lease](/it/flow/failover/).

## Avvisare le persone, e Kafka

Cinque nodi inviano altrove ciò che porta un messaggio e lo passano oltre: **ntfy out**, **gotify out**, **discord out** (un webhook), **discord bot out** e **kafka out**. Usano le stesse impostazioni con cui il core di HotLoop invia i propri allarmi ed eventi, quindi uno stabilimento che ha già un topic ntfy, un'applicazione Gotify, un webhook Discord o un cluster Kafka punta Flow agli stessi.

- **ntfy.** Un nodo di configurazione del server (indirizzo, poi un token di accesso o nome utente e password, oppure niente per un server che lascia pubblicare chiunque), e per nodo un topic, un titolo, una priorità (da min a max, o `msg.priority`), tag e un indirizzo di clic. Un topic o un titolo vuoto prende `msg.topic` o `msg.title`. Su un server pubblico il topic è l'unico segreto che esiste, quindi resta fuori da ogni errore e stato.
- **Gotify.** Un nodo di configurazione del server con il token dell'applicazione, e per nodo un titolo e una priorità da 0 a 10.
- **Webhook Discord.** L'URL del webhook è l'intera credenziale, sul nodo, e non compare mai in uno stato, in un log o in un errore, nemmeno in un errore di rete che nomina l'indirizzo. Un titolo o un colore trasforma il messaggio in un embed. Il contenuto è troncato a 2,000 caratteri e la descrizione di un embed a 4,096, contati come li conta Discord, e nulla in un messaggio può menzionare qualcuno.
- **Bot Discord.** Un nodo di configurazione del bot con il suo token, e per nodo un ID canale (o `msg.channel`). Pubblica come il bot e richiede che il bot sia nel canale con il permesso di inviare.
- **Kafka out.** Un nodo di configurazione del cluster (broker, SASL PLAIN o SCRAM-SHA-256 o SCRAM-SHA-512, TLS), e per nodo un topic e una chiave facoltativa. Il valore è `msg.payload`, come testo, o come JSON quando non è testo, e il messaggio viene passato quando il cluster lo ha confermato da tutte le repliche sincronizzate. Usa franz-go, il client usato dall'output Kafka del core.

Un server che rifiuta dice perché nell'errore del nodo, senza nulla di ciò che è stato inviato. Un limite di frequenza viene atteso una volta, per il tempo indicato dal server fino a un minuto, poi il messaggio fallisce. Non esiste un nodo Slack né Teams, né un nodo UADP: HotLoop riceve UADP e Flow legge quei valori attraverso i nodi HotLoop.

Provato contro un vero ntfy, un vero Gotify e un vero Redpanda: il nodo pubblica e si chiede al server cosa contiene. I nodi Discord seguono l'API documentata di Discord per webhook e bot.

`scan` esplora un intervallo CIDR e identifica gli endpoint Modbus ed EtherNet/IP, e `netinfo` riporta le interfacce che il runtime può effettivamente vedere, che in modalità macvlan è il modo in cui un flusso scopre il proprio indirizzo sulla VLAN OT. I nodi Modbus TCP, S7, EtherNet/IP, OPC UA e Sparkplug B ora possono parlare con ciò che trova `scan`, e sono la sezione successiva.

Un descrittore Go per tipo di nodo dichiara le sue proprietà, porte, valori predefiniti e testo di aiuto, e l'editor genera la finestra di dialogo da esso, quindi un nodo non può essere rilasciato con una finestra che non concorda con il suo runtime.
