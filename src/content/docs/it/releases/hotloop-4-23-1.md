---
title: "Note di rilascio: HotLoop core 4.23.1"
description: "Cosa porta HotLoop core 4.23.1, cosa cambia all'aggiornamento e cosa leggere prima di toccare un impianto in funzione."
sidebar:
  label: "4.23.1"
---

Questa versione porta tutto ciò che elencano le note della 4.23.0. Meteo ed energia, l'interfaccia web in tredici lingue in più, schermate che passano da un'installazione all'altra come file e i primi comandi a una console UniFi. Costruita solo per amd64; la build multi-architettura segue come versione successiva.

## Cosa è cambiato

- **Una stazione meteo è una sola entità.** Costruita dai tag che una stazione sul tetto già pubblica (temperatura, umidità, pressione, vento, pioggia, solare), con punto di rugiada, indice di calore e wind chill calcolati sul box. Un sensore che la stazione non ha ricevuto non ha riga, e uno che ha smesso di rispondere si legge Unavailable, mai zero. Non viene chiamato alcun servizio cloud. Vedi [Weather](/it/iot/weather/).
- **Contatori di energia.** Un contatore è un tag letto come quantità consumata (un contatore cumulativo come kWh, gas, acqua o aria, o una potenza). Ciò che è stato consumato è conservato in intervalli da 15 minuti, così un riavvio non perde nulla e un turno, un giorno o un mese è una somma. Una tariffa dà a ogni intervallo un costo quando l'intervallo viene creato, così un prezzo cambiato dopo non cambia ciò che è costato il mese scorso, e il costo di un'unità prodotta si calcola da un contatore di produzione. C'è una schermata Energy, l'API e strumenti MCP. Vedi [Energy](/it/iot/energy/).
- **L'interfaccia web arriva in tredici lingue in più** accanto all'inglese: spagnolo, francese, italiano, tedesco, norvegese, bulgaro, greco, coreano, giapponese, vietnamita, hindi, cinese semplificato e arabo, disposto da destra a sinistra. Scegline una nella barra in alto o sulla card di accesso. Vedi [Languages](/it/iot/languages/).
- **Una dashboard si esporta in un file e si importa in un'altra installazione.** Le schermate di un cliente sono sue e non fanno mai parte del prodotto: il file elenca ogni tag, dispositivo, script e ricetta che nomina, e un'importazione segnala tutti i problemi insieme, con una mappatura per i nomi che differiscono, prima di salvare qualsiasi cosa. Export e Import sono pulsanti nella schermata Dashboards, e `screen_export` e `screen_import` sono strumenti MCP. Vedi [Screen files](/it/iot/screen-file/).
- **Letture MCP che accompagnano le sue scritture**, le prove a secco degli editor e l'importazione degli allarmi CODESYS.
- **I primi comandi a una console UniFi.** Si possono comandare cinque tipi di punto, ciascuno in sola lettura finché una persona non arma quel tag, attraverso la porta di scrittura come qualsiasi tag: il LED di localizzazione di un dispositivo, il riavvio di un dispositivo, il ciclo di alimentazione PoE di una porta di switch, una rete wireless attivata o disattivata, un client osservato bloccato o riammesso, e la modalità PoE di una porta. Un ciclo di alimentazione è soggetto a un raffreddamento di 15 minuti conservato nel database, così un riavvio non lo dimentica, e una porta che porta la rete (un uplink, uno switch, un gateway, un backup 5G, un peer che la console non elenca) non viene mai ciclata. L'account della console con cui accede HotLoop deve essere Administrator locale per questi; un account View Only viene rifiutato dalla console e HotLoop lo dice. Un blueprint integrato cicla una volta la porta di un dispositivo silenzioso e poi solleva un allarme. Vedi [UniFi Network](/it/iot/unifi/).
- **Il server OPC UA risponde a HistoryRead** dallo storico che il Gateway conserva, grezzo ed elaborato.
- **Frame delta OPC UA PubSub, come opzione.** `HOTLOOP_UADP_PUBLISH_DELTA_FRAMES=true` invia solo i campi cambiati tra i frame key. Disattivato per impostazione predefinita.
- **Una card immagine in una pagina pannello si adatta alla sua card** e non fissa più l'altezza della riga.
- **L'unità di aggiornamento del database di un'installazione Quadlet salta se stessa** quando il volume non ha nulla da aggiornare, perché Podman 5.7 non avvia un container senza nulla da eseguire, e il nome del database incluso è adattato ai 52 caratteri che può avere uno StatefulSet.
- **I chart conservano il loro Secret delle credenziali alla disinstallazione**, come il volume del database: una reinstallazione con lo stesso nome generava una nuova password che il database conservato rifiutava. Per ripartire da zero, elimina il Secret a mano insieme al volume.
- **L'output Kafka aspetta** il broker per un topic creato un attimo fa per quanto lo permette la sua connessione, e le cifre documentate della coda di interruzione dell'Edge Relay sono quelle misurate (circa due minuti a 2,000 letture al secondo).
- Correzioni trovate dalla suite di test: gli utenti di test OPC UA sono sottoposti a hash al costo più basso di bcrypt, così un login nella suite non supera più ciò che il client di test aspetta su un runner lento (il server e il suo login non cambiano), il feed in diretta dimentica ciò che ha inviato nel momento in cui parte la sua ultima pagina, il server OPC UA dice quando il suo listener tiene la porta, e diversi test non dormono più per cose che avvengono con i propri tempi.

## Migrazioni

Due, ciascuna aggiunge soltanto: `0028_unifi_port_cycles` (quando ogni porta di switch ha avuto l'ultimo ciclo di alimentazione) e `0029_energy` (tre tabelle per i contatori e i loro intervalli). Entrambe sono nei backup. Un backup preso sulla 4.22.1 si ripristina qui, e uno preso qui non si ripristina su una versione precedente.

## Modifiche all'API

Nuove route: `GET /api/energy/meters`, `POST /api/energy/meters`, `GET`, `PUT` e `DELETE /api/energy/meters/{id}`, `GET /api/energy/summary` e `/api/energy/summary/{period}`, `GET /api/energy/series` e `/api/energy/series/{meter}/{period}/{step}`, `GET /api/dashboards/{id}/export`, `POST /api/dashboards/import` e `GET /api/entities/composites`. Due nuovi permessi: `energy.read`, che ha ogni ruolo, e `energy.write`, che ha un amministratore. Nuovi strumenti MCP per ciascuna. Una stazione meteo è un nuovo dominio di entità, `weather`. Vedi [l'API HTTP](/it/iot/api/).

## Aggiornare dalla 4.22.1

Un normale `helm upgrade`. Le migrazioni vengono eseguite al primo avvio e aggiungono tabelle; nessun nuovo segreto. Nulla di ciò che era disattivato viene attivato.

## Cosa non è provato

- Gli altri comandi non sono stati eseguiti contro una console reale.
- Meteo ed energia sono stati eseguiti contro registrazioni, un banco Modbus e i contatori simulati di Emberburn, non contro una vera stazione sul tetto né i contatori di un impianto.
- I tredici nuovi cataloghi di lingue sono stati scritti dal glossario condiviso e nessun madrelingua li ha rivisti.
