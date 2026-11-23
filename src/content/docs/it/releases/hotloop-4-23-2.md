---
title: "Note di rilascio: HotLoop core 4.23.2"
description: "Cosa porta HotLoop core 4.23.2, cosa cambia all'aggiornamento e cosa leggere prima di toccare un impianto in funzione."
sidebar:
  label: "4.23.2"
---

Una schermata CODESYS ora arriva come schermata HotLoop, il box riferisce la propria salute alla dashboard EmberNet e un contatore di energia può portare un costo di potenza. È anche una ripulita dei fallimenti da nodo lento della suite di test, ciascuno un'attesa o una corsa reale corretta. Costruita solo per amd64; la build multi-architettura segue come versione successiva.

## Cosa è cambiato

- **Una visualizzazione CODESYS si importa come schermata.** Esportala dall'IDE (Project, Export, il file nativo `.export`, non PLCopenXML), e l'Import della schermata Dashboards la legge come schermata HotLoop sulle variabili del PLC. Ogni tag che la schermata legge e che questa installazione non ha viene elencato, con una mappatura dei dispositivi, e ogni elemento che HotLoop non ha potuto collocare viene elencato con il motivo prima di salvare qualsiasi cosa. Un pulsante o setpoint su un tag non scrivibile viene rifiutato, come per una costruzione. Vedi [Import a CODESYS screen](/it/iot/codesys-screen-import/).
- **Salute del box per la dashboard EmberNet.** Un dispositivo che prende il nome dal nodo Kubernetes pubblica l'uso di CPU, memoria, disco e volume dati del box, e il jitter in tempo reale di tre core quando un agente scrive il file per esso. I valori che non si possono leggere hanno qualità cattiva con il motivo, mai zero. Il server OPC UA serve il loro storico. Vedi [il server OPC UA](/it/edge/opc-ua-server/#stato-di-salute-della-macchina-per-la-dashboard-embernet) e [Protocolli e driver](/it/iot/protocols/#stato-di-salute-della-macchina).
- **Un login che può leggere e nient'altro.** Un deployment può creare un account con esattamente `tags.read` e `values.read` (`HOTLOOP_READER_USER` e `HOTLOOP_READER_PASSWORD_HASH`). Il chart crea `embernet-dashboard-read` alla prima installazione, tiene la sua password nel Secret `<release>-opcua-dashboard` e non la ruota mai negli aggiornamenti.
- **Il certificato della dashboard è considerato fidato da un Secret.** Il chart monta `<release>-opcua-trust` (facoltativo) e il server OPC UA tiene allineata la sua cartella dei fidati: un nuovo certificato viene aggiunto entro 30 secondi, uno che esce dal Secret viene tolto, e un file messo a mano da un operatore non viene mai toccato. Il server accetta ancora solo Basic256Sha256 SignAndEncrypt, nessuna sessione anonima, nessuna fiducia generale. Il Service della versione ora elenca la porta 4840 quando il server è attivo.
- **Energia: un costo di potenza e i turni.** Un contatore in Wh, kWh o MWh accetta un `demand_price`, ciò che costa un chilowatt del suo quarto d'ora più alto in una finestra, e il riepilogo mostra il picco, quando è iniziato e quanto di quel quarto d'ora è stato letto. Un turno è una finestra, `shift:06:00-14:00` per l'ultimo iniziato e `last_shift:06:00-14:00` per quello prima. La schermata Energy ha un campo Shift e un prezzo di potenza, in tutte e tredici le lingue.
- **Un costo per unità prodotta non si legge più come gratuito.** Quando sono state prodotte cose e nessun contatore con prezzo ha ancora contato consumo, la risposta è nessuna, con il motivo `nothing_counted`, non zero.
- **I runtime CODESYS nei test, messi per iscritto.** Il server OPC UA di un runtime reale viene reso sicuro con i comandi shell del PLC che documenta CODESYS, e contro di esso è provata una lettura Basic256Sha256 SignAndEncrypt. Un vero allarme scatta, viene riconosciuto e si cancella in base a ciò che riporta un PLC in funzione. Ciò che fa un dispositivo quando finisce la finestra demo di due ore di un runtime senza licenza è registrato, con lo script della cronologia. Sono test e note in [Protocolli e driver](/it/iot/protocols/); il driver non è cambiato.
- **Correzioni trovate dalla suite.** Il motore dell'energia non legge più un contatore mentre viene eliminato o modificato (il database spezzava il deadlock facendo fallire l'eliminazione). Il manifest di un backup viene scritto con un nome temporaneo e rinominato al suo posto, così un elenco non vede mai mezzo file. Il recupero dell'historian aspetta di aver scritto tutto fino a un segno. Il resto sono test che ora aspettano ciò che affermano, su un nodo carico, invece di un numero fisso di secondi.

## La salute della box è attiva per impostazione predefinita

Il chart monta la radice dell'host su `/host` e il suo `/proc` su `/host/proc`, entrambi in sola lettura, e non aggiunge privilegi: si leggono solo uno statfs e i contatori di CPU e memoria. Un cluster che applica il profilo restricted di Pod Security rifiuta un hostPath. Lì, imposta `opcuaServer.dashboard.boxHealth.enabled: false` (né dispositivo né mount) o `hostMount: false` (il dispositivo, con disco e CPU del box che risultano cattivi e dicono cosa montare). Il drop-in di Quadlet è `deploy/quadlet/opcua-dashboard.conf`.

## Migrazioni

Una, e aggiunge soltanto: `0030_energy_demand` (una colonna `demand_price` sui contatori e sui loro intervalli, predefinita 0, così nulla di già contato o con prezzo cambia). Un backup preso sulla 4.23.1 si ripristina qui, e uno preso qui non si ripristina su una versione precedente.

## Modifiche all'API

`demand_price` nella tariffa di un contatore di energia, un blocco `demand` in una riga di riepilogo, `shift:` e `last_shift:` come periodo di energia, e `reason` su `cost_per_unit` quando è null. `POST /api/dashboards/import` accetta `codesys` e `visualization` al posto di `file`, e il suo report porta una `conversion`. Vedi [l'API HTTP](/it/iot/api/).

## Aggiornare dalla 4.23.1

Un normale `helm upgrade`. La migrazione viene eseguita al primo avvio. Il chart crea l'account in sola lettura e il suo Secret alla prima installazione di questa versione e non lo ruota mai; nulla di ciò che è già sul box cambia.

## Cosa non è provato

- Gli elementi che non conosce vengono elencati e lasciati fuori, mai indovinati, e una schermata di un altro progetto può elencarne di più.
- I tag di jitter in tempo reale richiedono un agente che scriva il file, e questa versione non ne installa nessuno.
- L'accesso di sola lettura e la fiducia nel certificato sono stati dimostrati con il client di HotLoop. Il lato della dashboard EmberNet è una sua versione.
- L'endpoint sicuro di CODESYS è stato provato nei test su una versione di runtime. Il driver di HotLoop non è cambiato per questo, e nessuna schermata di configurazione dell'endpoint sicuro fa parte di questa versione.
- Le tariffe di potenza sono state verificate su letture registrate, non sulla bolletta di un fornitore.
