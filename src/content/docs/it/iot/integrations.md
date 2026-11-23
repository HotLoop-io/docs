---
title: "Integrazioni"
description: "Puntate HotLoop su un dispositivo di cui avete l'indirizzo, vedete cosa c'è davvero e tenete i punti voluti. SNMP, BACnet/IP e OPC UA, sola lettura."
---

Un'integrazione è il modo di puntare HotLoop su un tipo di dispositivo di cui conoscete l'indirizzo, rispondere ad alcune domande, vedere cosa c'è davvero e tenere i punti che volete. Crea il dispositivo e i suoi tag. Le entità seguono dai tag come per qualsiasi tag, quindi i nuovi punti sono nell'API delle entità, nelle automazioni e sulle dashboard un minuto dopo.

Un dispositivo può entrare in HotLoop in tre modi, pensati per convivere:

| <span class="sr-only">Details</span> | Chi la avvia | Cosa serve |
|---|---|---|
| [Rilevamento MQTT](/it/iot/mqtt-discovery/) | Il dispositivo, annunciandosi su un broker | Un publisher che parli uno dei formati |
| [Rilevamento di rete](/it/iot/network-discovery/) | La rete, perché viene ascoltata | Nulla dal dispositivo; vi dice cosa ha sentito e come HotLoop potrebbe parlargli |
| **Integrazioni** (questa pagina) | Voi, con un indirizzo | Un dispositivo che risponda al proprio protocollo |

Un'integrazione non scrive mai sul dispositivo, e nulla di ciò che crea è armato. Un punto trovato è un punto su cui nessuno ha ancora deciso che possa essere comandato, quindi ogni tag creato da una configurazione è in sola lettura finché qualcuno non lo arma, uno alla volta, nell'editor dei tag, come un tag di qualsiasi altra origine.

## Cosa c'è

| Integrazione | Protocollo | Verificata con |
|---|---|---|
| Server OPC UA (`opcua`) | [OPC UA](/it/iot/protocols/#opc-ua) | Un vero server OPC UA |
| Dispositivo SNMP (`snmp`) | [SNMP](/it/iot/protocols/#snmp) | Un vero agente SNMP, v1, v2c e v3 |
| Dispositivo BACnet/IP (`bacnet`) | [BACnet/IP](/it/iot/protocols/#bacnetip) | Uno stack BACnet indipendente |
| PLC CODESYS (`codesys`) | [CODESYS](/it/iot/protocols/#codesys) | CODESYS Control for Linux SL 4.22.0.0, con due veri programmi PLC, uno molto più grande |

Altre si aggiungono su questa struttura man mano che si possono provare su un vero server.

## Nell'altra direzione

Un'integrazione porta dentro un dispositivo. Per inviare le letture e gli eventi di HotLoop a un broker Kafka, vedere [il flusso di eventi dell'API Kafka](/it/iot/historian-targets/#api-kafka-flusso-di-eventi) nelle destinazioni dell'historian: Apache Kafka e Redpanda, TLS e SASL, le letture su un topic e il log di sistema su un altro. Per inviarli come OPC UA PubSub (UADP su UDP), o per leggere quelli di un publisher, vedere [OPC UA PubSub](/it/iot/protocols/#opc-ua-pubsub-uadp): leggerne uno significa un dispositivo con il protocollo `opcua-pubsub`, senza flusso di configurazione, perché un datagramma porta posizioni di campi e non nomi.

## SNMP

Per uno switch, un UPS, una PDU, un misuratore di energia o qualsiasi cosa che esegua un agente SNMP. Le domande seguono la versione: v2c chiede una community, v3 chiede un utente e solo le passphrase che il suo livello di sicurezza richiede. Non esiste una community predefinita.

La sonda percorre il gruppo system, le tabelle delle interfacce, le risorse dell'host, la tabella del carico e le uscite extend di un agente SNMP, gli oggetti che HotLoop sa nominare, e mostra ciascuno con ciò che l'agente ha detto di contenere in questo momento. **Suggerisce** quelli che vuole chi punta a un dispositivo nuovo: nome, posizione e uptime del dispositivo (in secondi, non nei centesimi dell'agente), stato operativo e conteggio errori di ogni interfaccia, i suoi contatori di byte (quelli a 64 bit dove l'agente li ha), i carichi medi e le righe extend. Nelle note dice quanti dei punti suggeriti sono contatori, perché un contatore su un grafico richiede un tasso.

Tutto il resto che l'agente possiede resta leggibile: configuratelo a mano come un tag il cui indirizzo è l'OID. Vedere [il driver SNMP](/it/iot/protocols/#snmp) per cosa diventa un tag, cosa fa un oggetto mancante e perché una community v2c sbagliata sembra un dispositivo morto.

Qui SNMP è sempre in sola lettura. HotLoop non invia SET.

## BACnet/IP

Per un controllore di automazione degli edifici, un contatore, un termostato: qualsiasi cosa sulla rete IP che parli BACnet. Le domande sono l'indirizzo del dispositivo, l'istanza del dispositivo se la conoscete (e allora HotLoop rifiuta che risponda un dispositivo diverso a quell'indirizzo) e da quale scheda di rete inviare se la macchina ne ha due.

La sonda chiede al dispositivo chi è, legge la sua lista di oggetti e legge ogni oggetto analogico, binario e multistato che trova (e i valori interi, analogici grandi, accumulatori e stringhe di caratteri): nome, descrizione, unità, valore corrente e flag di stato. Mostra ciascuno con ciò che ha letto in questo momento e suggerisce i primi cento. Le unità arrivano come etichetta e, dove ne indicano una, come classe di dispositivo, quindi un ingresso `degrees-celsius` è una temperatura in `°C`.

Nelle note dice quanti oggetti segnalano un guasto (leggono errato finché il dispositivo non lo cancella) e quanti sono fuori servizio (leggono incerto, perché il valore è quello che vi è stato scritto). La descrizione di un oggetto multistato elenca i suoi stati, e il suo campione mostra lo stato oltre al numero.

Qui BACnet è sempre in sola lettura. HotLoop non scrive una proprietà e non raggiunge un dispositivo dietro un router BACnet: vedere [il driver BACnet/IP](/it/iot/protocols/#bacnetip) per cosa è coperto e cosa no.

## CODESYS

Per un PLC che esegue un runtime CODESYS Control. Le domande sono quelle di OPC UA (indirizzo, sicurezza, nome utente e password se la gestione utenti del PLC è attiva) e, solo se servono, la parte dell'applicazione da elencare, i nomi del PLC e dell'applicazione e quanti elementi di un array elencare.

La sonda si connette al server OPC UA del runtime, trova il PLC e la sua applicazione ed elenca le variabili che l'applicazione esporta (la sua Symbol Configuration) con i nomi scritti dal programmatore, con i loro tipi e se ciascuna è scrivibile. Suggerisce le variabili proprie dell'applicazione, non gli elementi dei suoi buffer, e dice nelle note quanti array ha elencato solo in parte. A un PLC senza nulla di esportato viene spiegato come esportare qualcosa.

Un dispositivo CODESYS viene letto una volta al secondo, ed è la frequenza con cui il driver chiede al server OPC UA del runtime di osservare ogni variabile, quindi una schermata è al massimo un secondo indietro rispetto al PLC. Il valore predefinito del runtime stesso è cinque secondi, che è lento per una schermata: una pompa parte e la pagina lo dice cinque secondi dopo. Cambiate l'intervallo di polling del dispositivo, o il suo `samplingIntervalMs`, per chiedere di più; il minimo a cui è sottoposto ogni dispositivo e gli OperationLimits del server continuano ad applicarsi.

Configurate con `"dashboard": true` nella richiesta e i punti che tenete ricevono anche una dashboard con il nome del dispositivo: un'intestazione, un trend dei numeri che si muovono, gli allarmi del dispositivo e una scheda di valore per ogni punto sotto un'intestazione per la sua lista di variabili. È una prima schermata costruita dal programma così com'è, e si modifica come qualsiasi dashboard. Nulla su di essa comanda nulla, e ogni tag resta in sola lettura finché non viene armato.

Un PLC con un runtime che si riavvia o un nuovo programma scaricato viene ripreso da solo: vedere [il driver CODESYS](/it/iot/protocols/#codesys).

## Il flusso

Tre chiamate, in ordine, e le prime due non salvano nulla.

1. **Chiedere.** `GET /api/integrations` elenca ogni integrazione e le sue domande. Ogni domanda ha un tipo (`text`, `number`, `bool`, `choice` o `secret`), un valore predefinito, l'indicazione se è obbligatoria e, quando conta solo dopo un'altra risposta, `showWhen`. Una schermata viene disegnata da questo e nient'altro, ed è per questo che una nuova integrazione non richiede una nuova schermata.
2. **Guardare.** `POST /api/integrations/{id}/probe` prende le risposte, le controlla, si connette al dispositivo vero con il driver proprio dell'integrazione e riporta cos'è e cosa ha: un nome suggerito, cosa dice di sé, note da leggere e ogni punto trovato come record a forma di tag con un `sample` di ciò che ha letto, così potete confrontarlo con il numero sul display della macchina stessa.
3. **Tenere.** `POST /api/integrations/{id}/setup` prende le stesse risposte e i nomi dei punti da tenere (se non ne è indicato nessuno tiene quelli marcati `suggested`), crea il dispositivo e i suoi tag e ricarica il runtime. Il dispositivo è abilitato e in polling. Un'integrazione che può preparare una prima dashboard (CODESYS) lo fa quando la richiesta contiene `"dashboard": true`, e risponde con l'id della dashboard.

La configurazione guarda di nuovo il dispositivo invece di fidarsi della sonda. Ciò che un client crede di aver trovato un minuto fa è un'affermazione, e i punti vengono controllati rispetto al dispositivo così com'è quando viene creato. Un nome che non c'è è un `400`, non un punto saltato, perché qualcuno lo ha chiesto per nome.

Una configurazione che fallisce a metà (il dispositivo salvato, i tag no) rimuove il dispositivo appena creato. Un dispositivo che esiste già viene rifiutato con un `400` invece di essere sovrascritto: per aggiungere punti a un dispositivo che avete, usate il suo Browse e Import.

## Le risposte vengono controllate prima di tentare qualsiasi cosa

La struttura controlla ogni risposta rispetto alla sua domanda prima che un'integrazione la veda e riporta tutti i problemi insieme, così un modulo si corregge una volta sola:

* una domanda obbligatoria lasciata vuota dà "X is required";
* un numero deve essere intero e nell'intervallo della domanda, una scelta deve essere una delle sue scelte, un bool deve essere un bool;
* una risposta a una domanda che l'integrazione non pone viene rifiutata, non ignorata, perché un `pasword` scritto male e scartato senza una parola è un dispositivo che non riesce ad accedere senza alcun indizio sul perché;
* un segreto non può essere il segnaposto `[redacted]` che l'API mostra al posto di uno salvato. Rimandarlo indietro salverebbe il segnaposto come password;
* una domanda che non viene mostrata (`showWhen`) viene ignorata e non è obbligatoria.

Le credenziali sono custodite come quelle di un dispositivo: sigillate a riposo quando HotLoop ha una chiave di sigillo, e nascoste in ogni risposta dell'API e in ogni errore. Una sonda non salva mai ciò che le è stato dato.

## Quando il dispositivo non risponde

`502`, con ciò che è andato storto: "could not reach the device: ..." quando nulla si è connesso, "connected, but could not list its points: ..." quando si è connesso e poi non ha risposto. È la risposta del dispositivo da leggere, non un difetto di HotLoop né una richiesta sbagliata. Una porta chiusa, una community sbagliata o un firewall finiscono tutti qui, e il messaggio è quello del driver stesso.

## Dove si colloca nel prodotto

La sonda e la configurazione attraversano la rete dalla macchina HotLoop, quindi entrambe richiedono `devices.write`, come salvare un dispositivo. Elencare richiede `devices.read`. Ogni prodotto le include. Le route sono nell'[API HTTP](/it/iot/api/#integrazioni).

## Aggiungerne una

* `Info()` dice cos'è: id, nome, protocollo del driver, come chiedere l'indirizzo e le domande;
* `Configure()` trasforma le risposte controllate in un indirizzo e nel blocco di configurazione proprio del driver, e rifiuta ciò che una domanda non può esprimere;
* `Discover()` raggiunge il dispositivo vero e riporta cosa c'è su di esso.

All'avvio la struttura rifiuta un'integrazione che non può essere una voce del catalogo: un id duplicato, un protocollo che il modello non dichiara, una domanda senza etichetta, una scelta senza opzioni, un valore predefinito che non è una risposta valida, o uno `showWhen` che nomina una domanda inesistente. Un test impone inoltre a ogni integrazione un protocollo con un driver compilato.

Dove non c'è un vero server da eseguire, non c'è integrazione, e la [roadmap](/it/roadmap/) dice quali aspettano hardware.
