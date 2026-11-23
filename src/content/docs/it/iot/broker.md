---
title: "Il broker MQTT integrato"
description: "Un broker nello stesso processo, così una piccola macchina può essere l'intera installazione, con listener, account e le impostazioni che lo attivano."
---

HotLoop può eseguire un proprio broker MQTT nel processo, da 4.11.0, così un'installazione HotLoop piccola, su una sola macchina, non ha nulla in più da distribuire. Attivo per impostazione predefinita (`HOTLOOP_BROKER_ENABLED`), nel binario e nel chart Helm. Ascolta su :1883; se quella porta è occupata da un altro broker sulla macchina, il broker incorporato resta inattivo e lo dice nel log, e HotLoop si avvia (imposta `HOTLOOP_BROKER_LISTEN_ADDR` a un indirizzo libero, oppure disattivalo). Una porta che hai scelto e che non si può aprire resta un errore: un deployment che esegue già Mosquitto o EMQX non ha nulla a cui puntare questo, e avviare un secondo broker accanto a uno che esiste già non è un'impostazione predefinita sicura da indovinare.

## Perché esiste

La pubblicazione edge (il Gateway che agisce da nodo edge Sparkplug) e la gestione della flotta (il tracciamento degli edge relay registrati) si connettono entrambe *verso l'esterno* a un broker MQTT tramite `BrokerAddress`, e non ne hanno mai eseguito uno da sole. Va benissimo quando un'installazione ha già un broker, che sia un'istanza Mosquitto esistente o una eseguita accanto a HotLoop per altri motivi. Non va bene come *unica* opzione: questo progetto esiste per ridurre il numero di parti in movimento da cui dipende uno stabilimento, e richiedere un secondo pezzo di infrastruttura solo per avere un hub Sparkplug per un Gateway significherebbe rimettere una parte in movimento dalla porta di servizio.

Con `HOTLOOP_BROKER_ENABLED=true`, questo stesso processo ascolta le connessioni MQTT sul proprio indirizzo. La pubblicazione edge, la gestione della flotta o l'`HOTLOOP_EDGE_PUBLISH_BROKER` di un edge relay esterno possono tutti puntare a `localhost:1883` (nel cluster, l'indirizzo del Service del Gateway stesso).

## Quando usarlo e quando no

**Usatelo** per un solo Gateway, una manciata di edge relay e volumi di traffico che un broker integrato, che condivide un processo con l'historian, il motore degli allarmi e l'API HTTP, può assorbire comodamente, il caso comune a cui punta tutto questo progetto: uno stabilimento, una macchina, infrastruttura minima.

**Non usatelo** come sostituto di un broker di livello produzione su scala reale: più applicazioni host Sparkplug indipendenti, un fan-out molto alto, il bridging tra siti, o carichi che richiedono clustering, scalabilità orizzontale o gli strumenti operativi dedicati di un broker (metriche dettagliate, ACL dinamiche, ecosistemi di plugin) sono tutti motivi reali per eseguire Mosquitto, EMQX o un altro broker dedicato, e per puntare a esso gli `EdgePublishConfig`/`FleetConfig` del Gateway come può già fare qualsiasi altra installazione. Questo pacchetto non compete con quel caso d'uso; esiste per le installazioni che altrimenti non avrebbero alcun broker.

## Login, e cosa può toccare ciascuno

Entrano tre tipi di login, e non sono uguali.

**I login creati in HotLoop** (Settings, MQTT, oppure `/api/broker/logins` in [L'API HTTP](/it/iot/api/)) portano regole: i topic su cui il login può pubblicare e quelli a cui può iscriversi. `%u` in una regola è il nome del login stesso e `%p` il prefisso di rilevamento. Partono da un profilo e poi potete modificarli:

| Profilo | Pubblica | Iscrizione | Per |
|---|---|---|---|
| `shelly` | `%u/#`, `shellies/announce` | `%u/#`, `shellies/command`, `%p/status` | uno Shelly Gen2 o successivo, con il login chiamato come il prefisso del suo topic MQTT |
| `esphome` | `%u/#`, `%p/+/%u/+/config`, `esphome/discover/%u` | `%u/#`, `%p/status`, `esphome/discover` | un nodo ESPHome, con il login chiamato come il nodo |
| `tasmota` | `tele/%u/#`, `stat/%u/#`, `tasmota/discovery/+/config`, `tasmota/discovery/+/sensors` | `cmnd/%u/#`, `cmnd/tasmotas/#` | un dispositivo Tasmota, con il login chiamato come il suo topic |
| `zigbee2mqtt` | `%u/#`, `%p/#` | `%u/#`, `%p/status` | un bridge Zigbee2MQTT, con il login chiamato come il suo topic base |
| `integration` | niente | `#` | una dashboard, un historian, voi con MQTT Explorer |
| `full` | `#` | `#` | qualsiasi cosa, l'intero stabilimento |

Dategli il nome del prefisso del topic come login e uno Shelly può annunciarsi e riferire come se stesso, e basta. Non può pubblicare su `cmnd/boiler/POWER`, non può annunciare un dispositivo a nome di un altro e non può iscriversi a `#` per leggere lo stabilimento. Il broker controlla ogni pubblicazione, ogni iscrizione e ogni messaggio in uscita verso un sottoscrittore, quindi una regola non si può allargare con un carattere jolly ingegnoso. Anche il last will viene controllato, quando il client si connette: la libreria del broker pubblica i will senza chiedere a nessuno, quindi un login il cui will punta dove non può pubblicare non entra. Altrimenti una presa economica potrebbe lasciare un `ON` retained sulla caldaia e staccarsi da sola la spina.

Una modifica a un login vale dal pacchetto successivo di quel client. Restringete un login e il dispositivo connesso perde subito i topic; cancellatene uno e il client ancora agganciato non può fare più nulla e non può riconnettersi. Le password sono hash bcrypt in `broker_logins`, che è in ogni backup; l'API non risponde mai con nessuno dei due.

Zigbee2MQTT è il caso particolare: un bridge annuncia ogni dispositivo sulla sua radio, quindi il suo profilo può pubblicare ovunque sotto il prefisso. È il compito del bridge, ed è per questo che la schermata Discovered mostra chi ha annunciato cosa.

**`HOTLOOP_BROKER_USERS`** è la vecchia lista di coppie `user:password` (solo i primi due punti dividono, quindi una password può contenerne uno). Questi possono fare qualsiasi cosa, su ogni topic, esattamente come in 4.16 e 4.17. È voluto: nessuno aggiorna in uno stabilimento il cui traffico Sparkplug improvvisamente sbatte contro una ACL che non ha mai scritto. Significa anche che ognuno di quei login è una chiave dell'intero stabilimento. Spostate i dispositivi su login creati in HotLoop e tenete quelli delle variabili d'ambiente per le cose che hanno davvero bisogno di tutto: la flotta, un edge relay, il publisher edge. Controllati in tempo costante; un nome utente con la password sbagliata viene rifiutato.

**Anonimo** (`HOTLOOP_BROKER_ALLOW_ANONYMOUS`, predefinito `false`) è qualsiasi cosa, per chiunque possa raggiungere la porta. È un'opzione per singola installazione per una LAN fidata o un banco di prova, mai qualcosa che questo processo decide da solo sia accettabile, e la schermata Discovered lo dice in rosso finché è attivo. Non allenta nulla per un client che invia un nome utente: una password sbagliata resta una password sbagliata.

Un broker senza `HOTLOOP_BROKER_USERS` e con l'anonimo disattivato si avvia senza problemi. Finché qualcuno non crea un login in HotLoop, l'unica cosa che può connettersi è HotLoop.

Gli altri broker sono affare loro. Su Mosquitto o EMQX le ACL le applica quel broker, lo stesso confine tracciato dalla [gestione della flotta](/it/gateway/fleet/), e il [rilevamento MQTT](/it/iot/mqtt-discovery/) dà una ACL per il login di HotLoop stesso lì.

## Rilevamento, e il login di HotLoop stesso

Con il broker attivo, HotLoop vi ascolta i dispositivi che si annunciano (vedere il [rilevamento MQTT](/it/iot/mqtt-discovery/)). Il broker annota quale login e quale client ha pubblicato ogni configurazione di rilevamento. La schermata Discovered lo mostra, e un dispositivo accettato da un login che viene annunciato da un altro resta trattenuto per una persona, con un avviso nel log ("Kitchen re-announced by login garage-node; it was accepted from kitchen-node"). O qualcuno ha spostato il dispositivo su un nuovo login, o un login si finge un dispositivo che non è. Decide una persona.

Il client proprio di HotLoop su questo broker (il listener di rilevamento e i driver dei dispositivi rilevati) accede con un login che il broker crea a ogni avvio e tiene solo in memoria. Può fare qualsiasi cosa. Non c'è nulla da configurare, nulla su disco e nulla in un backup; è un login diverso dopo ogni riavvio.

## TLS

Un listener TCP in chiaro (`HOTLOOP_BROKER_LISTEN_ADDR`, predefinito `:1883`) è sempre disponibile una volta attivato il broker. Impostare `HOTLOOP_BROKER_TLS_ENABLED=true` con `HOTLOOP_BROKER_TLS_CERT_FILE` e `HOTLOOP_BROKER_TLS_KEY_FILE` aggiunge un secondo listener indipendente (`HOTLOOP_BROKER_TLS_LISTEN_ADDR`, predefinito `:8883`) terminato con quel certificato. Entrambi i listener sono attivi insieme quando TLS è abilitato, nulla chiude quello in chiaro, quindi un operatore che vuole raggiungibilità solo TLS lo impone a livello di rete (una NetworkPolicy, una regola di firewall), nello stesso modo in cui questo chart lascia già le decisioni più ampie di esposizione di rete a `networkPolicy.ingress` invece di far decidere all'applicazione quali delle sue porte si possano raggiungere.

A differenza dell'upgrade STARTTLS in banda di una singola connessione del canale SMTP, il listener TLS del broker è un secondo socket separato, la stessa forma che usano Mosquitto, EMQX e la maggior parte dei broker MQTT per una porta in chiaro accanto a una TLS, e il più naturale per MQTT, che (a differenza di SMTP) non ha un upgrade in banda diffusamente implementato.

Questo pacchetto non genera un certificato proprio, autofirmato o altro, perché nulla a valle finirebbe per fidarsi di uno che si fosse inventato, quindi un certificato vero (da una CA interna, da `cert-manager` o da qualsiasi altra fonte) lo fornisce sempre l'operatore.

## Configurazione

| Variabile | Predefinito | <span class="sr-only">Dettagli</span> |
|---|---|---|
| `HOTLOOP_BROKER_ENABLED` | `false` | La funzione è disattivata finché non viene impostata |
| `HOTLOOP_BROKER_LISTEN_ADDR` | `:1883` | Il listener TCP in chiaro |
| `HOTLOOP_BROKER_TLS_ENABLED` | `false` | Aggiunge un secondo listener TLS indipendente |
| `HOTLOOP_BROKER_TLS_LISTEN_ADDR` | `:8883` | Usato solo quando TLS è abilitato |
| `HOTLOOP_BROKER_TLS_CERT_FILE` / `_KEY_FILE` | n/a | Richiesti quando TLS è abilitato |
| `HOTLOOP_BROKER_ALLOW_ANONYMOUS` | `false` | Opzione per singola installazione; non attivatela mai per impostazione predefinita |
| `HOTLOOP_BROKER_USERS` | nessuno | `user:password,user2:password2`. Ciascuno può fare qualsiasi cosa; vedere sopra. I login con regole si creano in HotLoop |
| `HOTLOOP_BROKER_DISCOVERY` | `true` | Ascolta i dispositivi che si annunciano; vedere il [rilevamento MQTT](/it/iot/mqtt-discovery/) |
| `HOTLOOP_BROKER_DISCOVERY_PREFIX` | `homeassistant` | Il prefisso di topic sotto cui arrivano gli annunci |

## Cosa è stato verificato e cosa no

HotLoop è stato eseguito su apparecchiature reali e server reali, e su hardware reale il 2026-11-17.
