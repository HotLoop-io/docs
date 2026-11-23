---
title: "Note di rilascio: HotLoop core 4.23.6"
description: "Cosa porta HotLoop core 4.23.6, cosa cambia all'aggiornamento e cosa leggere prima di toccare un impianto in funzione."
sidebar:
  label: "4.23.6"
---

Le caselle della roadmap Protect, Access e box di alimentazione ricevono codice, il dispositivo Shelly parla direttamente con lo Shelly, e OPC UA PubSub riceve sicurezza dei messaggi e metadati. Costruita solo per amd64; la build multi-architettura segue come versione successiva.

## Cosa è cambiato

- **UniFi Protect, come dispositivo.** Protocollo `unifi-protect`, con una chiave API dalla pagina Integrations della console, sigillata come una password della console e con il certificato fissato. Telecamere, sensori, luci e sirene sono tag che si aggiungono da soli. Il movimento e i rilevamenti intelligenti di una telecamera (persona, veicolo, pacco, targa, volto, animale) arrivano dal websocket degli eventi e si leggono cattivi mentre è giù, mai «nessun movimento». Una sirena può essere armata per suonare, e `alarm.<trigger>.fire` invia il webhook del gestore di allarmi così un allarme HotLoop fa registrare le telecamere. Lo snapshot di una telecamera è una route. Ogni evento è nel logbook. Vedi [UniFi Network](/it/iot/unifi/#unifi-protect).
- **UniFi Access, come dispositivo.** Protocollo `unifi-access`, con un token API. La posizione e il blocco di ogni porta sono tag, tenuti aggiornati dal websocket delle notifiche, e ogni cambiamento è nel logbook. Sbloccare è una scrittura che una persona arma, attraverso la porta di scrittura, con audit. Vedi [UniFi Network](/it/iot/unifi/#unifi-access).
- **Prese della PDU SmartPower.** Il relè, la potenza, la corrente, la tensione e il fattore di potenza di una presa sono tag del dispositivo UniFi Network, e l'assorbimento totale di una PDU è uno. Scrivere `on` su una presa la commuta e mantiene il nome di ogni altra presa; `cycle` la spegne, aspetta e la riaccende, al massimo una volta ogni 15 minuti, e finisce sempre accesa. Vedi [UniFi Network](/it/iot/unifi/#prese-della-pdu-smartpower).
- **Un dispositivo Shelly.** Protocollo `shelly`: RPC Gen2 e successivi con il login digest del dispositivo stesso, tag per ogni componente che riporta, scritture per uno switch, una luce, una tapparella e un termostato. Il Gen1 viene rifiutato con un messaggio che lo manda a MQTT.
- Risposte DataSetMetaData e di discovery, a pezzi quando sono grandi, lette dai messaggi catturati di un publisher Siemens. Il publisher annuncia i suoi metadati ogni dieci intervalli per impostazione predefinita (`HOTLOOP_UADP_PUBLISH_METADATA_EVERY`, 0 lo disattiva). Vedi [Protocolli e driver](/it/iot/protocols/).
- **Lo svuotatore della coda di inoltro guarda di nuovo, e dice quando fallisce.** Un passaggio che non inviava nulla mentre c'erano letture in attesa aspettava una spinta che un polling tranquillo non invia mai, e un passaggio fallito arretrava di mezzo minuto senza alcuna riga nel log.
- **I test aspettano ciò che stanno aspettando.** Sei test di energia aspettano le letture del banco al posto di una pausa fissa.

- **Un dispositivo Modbus silenzioso si legge cattivo su ogni punto.** Su una linea seriale una richiesta che scadeva usava l'intera scadenza del polling, così solo il primo blocco diventava cattivo e ogni punto successivo manteneva l'ultimo buon valore finché il cavo restava scollegato. Ora un dispositivo che non risponde nulla segna cattivo ogni punto nello stesso polling. Vedi [Protocolli e driver](/it/iot/protocols/).
- **Le funzioni finite escono attive.** Nel chart Helm e nel binario: il broker MQTT integrato (i suoi login si creano in HotLoop), il server OPC UA (autenticazione attiva, con un login `opcua-reader` generato che Settings mostra a un amministratore), i report programmati, il backup locale giornaliero (ogni 24 ore, volume da 5 Gi), il ServiceMonitor (reso solo dove esistono le CRD dell'operatore Prometheus, così un cluster senza di esse si installa come prima), e un Ingress senza nome host, che risponde a qualsiasi host serva la classe finché non si imposta `ingress.hosts[0].host`. Report, backup, certificati OPC UA e la coda edge usano per impostazione predefinita una directory scrivibile sotto la directory dati di HotLoop, e una porta che un altro servizio già tiene resta inattiva e lo dice. I chart `hotloop` e i chart generati di IoT ed Edge lo portano.
- **I canali di allarme e il publisher edge sono attivi, e aspettano una destinazione.** I canali webhook, e-mail, ntfy, Gotify, webhook Discord e bot Discord, e `edgePublish`, sono attivi dal primo avvio. Uno senza dove inviare non ferma più l'installazione né l'avvio: aspetta e lo dice. Un amministratore inserisce ogni destinazione in Settings, «Where alarms and readings go», e ciò che viene salvato lì prevale sui valori del chart. I canali di allarme si applicano al salvataggio; la destinazione del publisher edge si applica al riavvio successivo. Settings ha anche una card del server OPC UA con l'endpoint e il login generato.
- **La destinazione Kafka aspetta che un broker collochi un nuovo topic.** Un singolo broker che un host occupato isola per un momento faceva fallire la prima occhiata con `INVALID_REPLICATION_FACTOR`; la destinazione ora aspetta finché il suo tempo scade e dice cosa ha risposto il broker.
- **Lo svuotatore della coda di inoltro guarda di nuovo, e dice quando fallisce.** Un passaggio che non inviava nulla mentre c'erano letture in attesa aspettava una spinta che un polling tranquillo non invia mai, e un passaggio fallito arretrava di mezzo minuto senza alcuna riga nel log.

- **Riportato dalla 4.23.4 e dalla 4.23.5.** Le schermate TwinCAT `.TcVIS` e quelle di cds-text-sync e codescribe si importano con i loro pulsanti, cornici, spie e regole di espressione, e l'aggiornamento della schermata UniFi aspetta la vista che si sta caricando. Nessuna delle due versioni è stata pubblicata, quindi sono qui entrambe. Vedi [4.23.4](/it/releases/hotloop-4-23-4/) e [4.23.5](/it/releases/hotloop-4-23-5/).

## Migrazioni

Nessuna.

## Modifiche all'API

`GET /api/unifi-protect/{id}/cameras/{camera}/snapshot` restituisce il JPEG corrente della telecamera. L'elenco dei protocolli ha `unifi-protect` e `unifi-access`. Vedi [l'API HTTP](/it/iot/api/).

## Aggiornare dalla 4.23.5

Un normale `helm upgrade`. Nessuna migrazione e nessun nuovo segreto. La 4.23.4 e la 4.23.5 sono state taggate e le loro esecuzioni di release sono fallite nel job dei test prima che qualcosa fosse pubblicato, quindi l'ultima release prima di questa è la 4.23.3, e questa porta le modifiche di entrambe. Un file di valori che imposta una delle funzioni sopra prevale ancora; impostane una a `false` e non rende alcun listener, Service, volume o Ingress.

## Cosa non è provato

- Protect, Access e le prese della PDU sono stati costruiti dalle API pubblicate e confrontati con console fittizie che mantengono lo stato. Nessuno è stato su una console o una PDU reale, quindi le loro caselle nella roadmap non sono spuntate.
- Uno snapshot allegato a una notifica di allarme non è realizzato.
- PubSub: un Security Key Service non è realizzato (le chiavi sono statiche), e nessun publisher Siemens, CODESYS o Beckhoff è stato su un banco.
- La disattivazione delle porte UniFi aspetta ancora la richiesta dell'interfaccia web di una vera console 10.6.
