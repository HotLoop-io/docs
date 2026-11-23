---
title: "Riferimento di Edge Relay"
description: "Il nodo Sparkplug B senza interfaccia che interroga e inoltra: cosa fa, ogni impostazione, la coda su disco, la configurazione di flotta e come si distribuisce."
---

L'Edge Relay, dalla 4.6.0, è un secondo binario e funziona da solo: un nodo edge Sparkplug B che interroga e inoltra, senza database, senza interfaccia web, senza autenticazione e senza percorso di scrittura. È fatto per girare su un Pi o su un piccolo PC industriale in periferia e inoltra tutto ciò che legge a un Gateway completo, che gira altrove con un vero database, tramite lo stesso publisher Sparkplug B aggiunto dalla 4.5.0.

La nota della 4.5.0 lo diceva già: la pubblicazione edge esisteva come funzione attivabile dentro il processo del Gateway completo, "non ancora l'edizione Edge Relay autonoma e più leggera". Questa è quell'edizione.

## Che cosa non è

**Non è un Gateway più piccolo con meno opzioni.** È un binario diverso, con un insieme di dipendenze molto più ridotto. Non ha database, interfaccia web, autenticazione, server o client MCP, motore di automazione né registro delle entità.

**Non può servire un'interfaccia, accettare una scrittura o rispondere a una chiamata di strumento MCP.** Tutte e tre richiedono ciò che questo binario non ha di proposito: un'identità autenticata a cui attribuire l'azione. Un edge relay non decide nulla e non conferma nulla a una persona; legge e inoltra.

**Non si configura tramite database e non ha una propria API di configurazione.** Dispositivi e tag arrivano da un file JSON locale letto all'avvio, o da un file che il Gateway invia tramite il broker e che si applica in diretta (vedi [Invio della configurazione](#invio-della-configurazione-480)). Sul relay nulla resta in ascolto di una nuova configurazione: l'unico ingresso è la connessione al broker che già apre verso l'esterno.

## Come si incastra tutto

Al suo interno riusa il vero motore di interrogazione del Gateway, non una reimplementazione: lo stesso worker, la stessa riconnessione con backoff e lo stesso ciclo di interrogazione che girano in produzione nel Gateway girano qui invariati. Ciò che cambia è *dove vanno configurazione e storico*.

Tutto ciò che segue un'interrogazione, il driver, il bus dei tag, il publisher Sparkplug e la coda di inoltro su disco, è esattamente il codice che il Gateway usa quando `HOTLOOP_EDGE_PUBLISH_ENABLED` è impostata. La pagina Edge publish spiega cosa fa quel publisher: birth, numeri di sequenza, buffer durante un'interruzione, riproduzione alla riconnessione. Nulla di questo è cambiato; questo binario è solo un altro modo di arrivare alla stessa chiamata `Offer()`.

## Il file dei dispositivi

```json
{
  "devices": [
    {
      "id": "press-01",
      "name": "Press 1",
      "protocol": "opcua",
      "address": "opc.tcp://press-01.local:4840",
      "enabled": true,
      "pollIntervalMs": 1000
    }
  ],
  "tags": [
    {
      "deviceId": "press-01",
      "name": "Zone1_Temp",
      "address": "ns=2;s=Zone1.Temp",
      "dataType": "float",
      "enabled": true
    }
  ]
}
```

Un tag accetta tutto ciò che accettano quelli del Gateway, `noData` incluso: un elenco di valori grezzi che significano "nessuna misura" (lo 0x8005 di un registratore), ciascuno con il suo motivo, così un canale morto risulta errato sul relay e nel flusso Sparkplug invece di apparire come un numero. Vedi [Valori senza dati](/it/iot/protocols/#no-data-values).

Tutti e sette i driver di protocollo del Gateway sono compilati: OPC UA, Modbus, MQTT/Sparkplug B, EtherNet/IP, S7comm, MTConnect e HTTP. Nulla nel formato del file dei dispositivi è specifico dell'edge relay.

### Discovery (4.18.10)

Un relay può ascoltare un broker MQTT per trovare dispositivi che si annunciano da soli, come fa il Gateway (vedi [Rilevamento MQTT](/it/iot/mqtt-discovery/)), e leggere e inoltrare ciò che sente. Indichi i broker nel file dei dispositivi:

```json
{
  "devices": [],
  "tags": [],
  "discovery": [
    {
      "id": "yard",
      "broker": "10.0.0.5:1883",
      "username": "hotloop",
      "password": "...",
      "prefix": "homeassistant",
      "listenOnly": true,
      "tasmota": true,
      "shelly": true
    }
  ]
}
```

`id` è composto da 1 a 63 lettere minuscole, cifre e `-`, e non è `embedded`. `broker`, `username`, `password`, `useTls` e `insecureSkipVerify` sono ciò che accettano le impostazioni MQTT del Gateway, verificate dallo stesso codice. `prefix` vale `homeassistant` per impostazione predefinita, e `tasmota` e `shelly` sono attivi. Un file che non nomina alcun broker non cambia nulla nel funzionamento di un relay.

Ciò che sente diventa dispositivi e tag, creati dallo stesso codice che esegue il Gateway (il formato `homeassistant/`, quello di Tasmota, gli stati di Shelly), e vengono interrogati e inoltrati via Sparkplug come tutti gli altri. L'id di un dispositivo nasce dall'id del broker e da chi dice di essere il dispositivo, sempre uguale (`disc-<identity>-<hash>`), così un relay che si riavvia nomina le sue metriche allo stesso modo. Un dispositivo compare un paio di secondi dopo l'annuncio, uno ritirato esce dal birth del nodo con un rebirth, e nessuno dei due costa la sessione Sparkplug o la coda di inoltro. Anche un file inviato che aggiunge o rimuove un broker si applica in diretta.

**Nulla di ciò che rileva può essere armato.** Non perché lo dica un controllo. Ogni tag creato dal rilevamento è di sola lettura, come sul Gateway; ogni dispositivo creato non è accettato; su un relay non c'è nessuno che possa accettarne uno; e un relay non ha alcun percorso di scrittura, quindi un comando verso un punto rilevato, o verso qualsiasi punto, viene rifiutato prima di avvicinarsi a un dispositivo. Il test chiede a un relay con scritture consentite di commutare una pompa rilevata e verifica che il topic di comando della pompa sia rimasto muto.

Un dispositivo che si può comandare arriva a un relay per la strada opposta: lo accetta su un Gateway, arma i punti che intende e invia il file. Quando un file contiene un dispositivo che il relay sente anche (stesso id di broker, o stesso indirizzo, e stessa identità), vince il file e la copia rilevata non viene creata, quindi un dispositivo non viene mai inoltrato due volte.

`listenOnly` è attivo se non lo disattiva, e allora il relay non pubblica nulla su quel broker: né il messaggio di birth che fa riannunciare un publisher, né lo `status_update` di uno Shelly, né la richiesta di potenza di un Tasmota. Un dispositivo che parla solo quando cambia risulta sconosciuto finché non lo fa. Se lo disattiva, sono le uniche cose che invia, ai topic che DISCOVERY.md nomina.

Un relay non conserva nulla di ciò che ha sentito. Le configurazioni `homeassistant/` e Tasmota sono retained sul loro broker e tornano all'avvio; uno Shelly dice i suoi stati ogni volta che qualcosa cambia, quindi un dispositivo rimasto in silenzio dall'avvio del relay non c'è finché non parla. Questo, e l'assenza di un database dove ricordare un dispositivo accettato, è la differenza rispetto al Gateway.

`/status` indica, sotto `discovery`, per ogni broker: se è in ascolto e connesso, quanti messaggi ha ricevuto, scartato e rifiutato, quanti problemi ha, e il numero di dispositivi e tag creati dal rilevamento. Non dice dove si trova un broker né su quale topic è comparso un problema.

### Credenziali nel file dei dispositivi (4.15.0)

Il driver OPC UA del relay è quello del Gateway, quindi un dispositivo può portare uno `username` e una `password` OPC UA (e le opzioni di sicurezza di [Protocolli e driver](/it/iot/protocols/#opc-ua-security-and-credentials)) nel suo blocco `config`, e lo stesso vale per un dispositivo di qualsiasi altro protocollo (password MQTT e HTTP, header HTTP, credenziali in un indirizzo). Sono in chiaro nel file dei dispositivi, e il relay non ha un'API dietro cui nasconderle (la redazione dell'API aggiunta al Gateway nella 4.15.1 qui non si applica; vedi [Autenticazione e utenti](/it/iot/authentication/#dove-le-credenziali-restano-in-chiaro)), quindi conta dove sta il file:

- **Nel chart Helm, usi `devicesSecret`.** I dispositivi impostati nei valori `devices` e `tags` del chart vengono resi in un ConfigMap, che può leggere chiunque possa leggere i ConfigMap nel namespace, e restano nel registro della release Helm. Per dispositivi con credenziali, metta l'intero file dei dispositivi in un Secret con la chiave `devices.json` e lo nomini in `devicesSecret`; il Secret viene montato al posto del ConfigMap, che allora non viene creato.
- **Anche un file dei dispositivi inviato le contiene.** Un file inviato con `POST /api/fleet/{id}/config` viene pubblicato, retained, su un topic MQTT, quindi il broker deve usare TLS e limitare chi può leggere `hotloop/edge-relay-config/#`, altrimenti chiunque possa sottoscriverlo legge ogni credenziale al suo interno. Il relay scrive un file inviato con modo `0600` sul suo volume dati (`/data/pushed-devices.json` nel chart e nell'unità Quadlet), quindi si trova anche sul PVC, non in un Secret.
- **Un dispositivo OPC UA protetto conserva un certificato e un trust store.** Stanno sotto `/data/opcua-client-pki` (`HOTLOOP_OPCUA_CLIENT_PKI_DIR`), sullo stesso volume di persistenza della coda di inoltro. Con la persistenza del chart disattivata è un emptyDir, quindi ogni nuovo pod crea un nuovo certificato e ogni server protetto deve fidarsene di nuovo (vedi "Persistence off" più avanti); un dispositivo anonimo su un canale non protetto non se ne cura. Approvare il certificato di un server è lo stesso gesto che sul Gateway, da `rejected/` a `trusted/`, fatto sul volume del relay.

## Comandi remoti (4.7.0)

Due comandi Sparkplug NCMD, entrambi sulla stessa connessione che questo relay già apre verso l'esterno, senza connessione in ingresso:

- **Restart** (`Node Control/Reboot`), dalla 4.7.0: il relay pubblica il proprio NDEATH ordinato ed esce, contando sul suo supervisore (il `Restart=always` di un'unità Quadlet, o il `restartPolicy: Always` predefinito di un Deployment) per riavviarlo.

- **Update** (`Node Control/Update`): un operatore che approva l'aggiornamento dell'immagine che un relay sta trattenendo. Fa qualcosa solo su un relay impostato per trattenere gli aggiornamenti; vedi [Aggiornare un relay](#aggiornare-un-relay).

Nulla sul lato del relay decide chi può inviarli; vedi la pagina di gestione della flotta per il gestore di flotta lato Gateway che li invia, e il requisito ACL del broker, che è il vero confine di autorizzazione.

## Aggiornare un relay

Un relay non viene aggiornato dal Gateway. Non può: il Gateway non ha modo di entrare nella macchina, e il relay non può sostituire il proprio container, quindi "aggiornamento remoto" significa cose diverse per i due modi di installarlo, e questa pagina dice quale, perché una promessa che la piattaforma non può mantenere è peggio di nessuna.

**La regola è quella che segue ogni box HotLoop: seguire `:stable`, mai fissare.** Un relay fissato a `4.17.0` ha esattamente l'età del giorno in cui qualcuno lo ha installato, e nessuno si ricorda di tornare in reparto ad aggiornarlo. L'immagine che un relay segue è quindi `ghcr.io/hotloop-io/hotloop-edge-relay:stable`, e ogni release sposta quel tag. Cambia chi riavvia il relay su di essa.

### Quadlet (un Pi o un piccolo PC industriale): si aggiorna da solo

L'unità in [`deploy/quadlet`](/it/install/quadlet/) segue `:stable` e porta l'etichetta che cerca l'aggiornamento automatico di Podman. Attivi il timer una volta per macchina:

```sh
sudo systemctl enable --now podman-auto-update.timer
```

Quando il timer scatta, Podman scarica `:stable` e, se il digest è cambiato, riavvia l'unità sulla nuova immagine. Tre cose rendono sicuro lasciarla da sola, e tutte e tre sono state provate eseguendole, non leggendo:

- **Un relay che non riesce a tornare su viene rimesso a posto.** L'unità ha un healthcheck (`/edge-relay --healthcheck`, perché l'immagine non ha shell né curl per eseguirne uno) e dice a systemd di non essere attiva finché non passa. Se la nuova immagine non lo supera mai, Podman rimette l'immagine precedente sotto `:stable` e avvia quella. Una release che non parte costa qualche minuto su un box, non un relay che resta giù. Su Podman 4.9 (Ubuntu 24.04) `Notify=healthy` da solo non lo fa: viene letto come un semplice `true`, il relay è considerato attivo appena parte il suo container e Podman segnala l'aggiornamento come riuscito mentre il relay è morto. L'unità imposta quindi esplicitamente `--sdnotify=healthy`.
- **Il Gateway vede ogni aggiornamento.** Un relay mette la sua versione e il digest della sua immagine in ogni birth. L'elenco di flotta del Gateway mostra entrambi per relay e scrive una riga nel log di sistema quando uno cambia: cos'era, cos'è ora e i due digest. È la traccia di audit, e copre un aggiornamento da qualsiasi causa, compreso un operatore sul box.
- **Un aggiornamento lascia i dati in pace.** La coda di inoltro e un file dei dispositivi inviato stanno sul volume dati, che una nuova immagine non tocca. Si perde l'interrogazione mentre il relay si riavvia, al massimo qualche secondo.

Il digest che un relay riporta è ciò che `podman image inspect --format '{{.Digest}}'` stampa su quel box, ovvero ciò che segue l'aggiornamento automatico. Podman può conoscere un'immagine con più di un digest (li elenca sotto `RepoDigests`) quando un registry memorizza un formato di manifest diverso da quello che usa, quindi lo confronti allo stesso modo su ogni relay, non con l'header di un registry.

### Quadlet, trattenere gli aggiornamenti finché un operatore approva (facoltativo)

Alcuni siti preferiscono decidere quando: un relay su una linea che non può sfarfallare durante un turno. È `edge-relay-hold.conf`, un drop-in di systemd, e non è mai l'impostazione predefinita. Con esso il relay riporta `"updateMode": "approve"`, il timer è spento e nulla si aggiorna finché un admin non invia `POST /api/fleet/{id}/update` dal Gateway. Il relay esce allora con stato 75, systemd lo riavvia sull'immagine che ha, e un job separato aspetta che sia sano ed esegue `podman auto-update`: la nuova immagine se c'è, con lo stesso rollback, e un relay che ha sfarfallato per niente se non c'è. Provato con un aggiornamento reale trattenuto 30 secondi mentre il relay girava indisturbato, poi applicato all'approvazione.

Sappia cosa costa. Il timer deve essere spento per tutta la macchina, perché l'aggiornamento automatico di Podman agisce su ogni container etichettato e non si può dirgli di saltarne uno; un box che deve usarlo per altro non può trattenere questo relay. E il Gateway non può dirle che un aggiornamento è in attesa, solo cosa esegue ora ogni relay, quindi confronti l'elenco di flotta con ciò che è `:stable` prima di approvare. Un'approvazione non porta un'immagine: al relay si può solo dire di aggiornarsi a ciò che segue la sua unità.

### Helm: si esegue `helm upgrade`

Un pod non può sostituire se stesso, e un Deployment è di Helm, quindi per il chart non esiste un aggiornamento remoto. L'`image.tag` del chart ha come valore predefinito la sua `appVersion`, che è la release, quindi:

```sh
helm repo update
helm upgrade edge-relay hotloop/hotloop-edge-relay --reuse-values
```

porta il pod sulla nuova release. La strategia del chart ferma il vecchio pod prima di avviare il nuovo (`maxSurge: 0`, perché la coda di inoltro è un file a scrittore singolo su un volume), quindi c'è un vuoto mentre sale. Il Gateway vede comunque la nuova versione nel birth successivo del relay e registra il cambio. Con Helm un relay non riporta il digest dell'immagine (un container non vede il proprio e Kubernetes non glielo passa), solo la versione. `Node Control/Update` qui non fa nulla e il relay lo dice nel suo log; Helm è l'approvazione.

### Cosa non c'è, e perché

- **Immagini firmate e allowlist di digest.** Il Gateway non può imporre né l'una né l'altra su un box a cui non ha accesso, e un controllo che il relay esegue su se stesso è uno che un relay compromesso salta. Podman può verificare le firme al pull (`policy.json`), che è il posto in cui funziona; nulla qui configura quella policy per lei, e `:stable` è fidato come lo è qualsiasi tag.
- **Rollout a scaglioni.** Ogni relay su un box segue lo stesso tag con il proprio timer, quindi una flotta si aggiorna secondo la dispersione del timer, non a ondate, e il rollback sopra è ciò che limita una release difettosa. Per scaglionare di proposito, trattenga i siti che devono aspettare con il drop-in di blocco e li approvi nell'ordine voluto.

## Invio della configurazione (4.8.0)

Un nuovo file dei dispositivi può essere inviato su un topic MQTT separato, semplice (non Sparkplug) e retained. Vedi la sezione "Config push" della pagina di gestione della flotta per il lato Gateway. Fino alla 4.17 un invio si limitava a preparare il file e il relay continuava a interrogare la vecchia lista finché qualcosa non lo riavviava. Ogni modifica a ciò che un relay interroga diventava un riavvio del relay, della sua sessione broker e di ogni sessione di dispositivo, su un box che dovrebbe restare mesi senza essere toccato. Ora un invio si applica nel momento in cui arriva.

- Inviato mentre questo relay è **in esecuzione**: i byte vengono validati con le stesse regole che `LoadDeviceFile` applica all'avvio, salvati in `HOTLOOP_EDGE_RELAY_PUSHED_FILE` (o sopra `HOTLOOP_EDGE_RELAY_DEVICES_FILE` quando non è impostato; vedi sotto) e applicati in diretta. Salvato prima, di proposito: una lista che ha funzionato ma non è mai stata salvata tornerebbe in silenzio indietro al riavvio successivo.
- **Un invio errato viene rifiutato e la vecchia lista continua a funzionare.** Uno che non si analizza, non si valida (un dispositivo duplicato, un tag su un dispositivo che nessuno ha dichiarato, un protocollo sconosciuto) o non si può salvare non cambia nulla: né i dispositivi in esecuzione né il file su disco. Il log dice perché, e lo dice anche `/status` sotto `config.rejected`, da dove lo prende la schermata di flotta del Gateway.
- Inviato mentre il relay era **offline**: non c'è nulla che lo riceva fino all'avvio successivo, e allora il relay dà a un invio retained un paio di secondi per arrivare *prima* di caricare il suo file dei dispositivi locale, così parte direttamente con esso. Un invio che arriva dopo quei due secondi si applica in diretta come ogni altro.
- Il broker restituisce l'invio retained a ogni riconnessione. Il relay riconosce il file che esegue dal suo sha256, quindi gli stessi byte che arrivano di nuovo non cambiano nulla.

### Cosa conserva un'applicazione in diretta e cosa cambia

Il relay calcola cosa è cambiato tra il file che esegue e quello nuovo, dispositivo per dispositivo, e tocca solo quello:

- **Un dispositivo invariato conserva la sua sessione.** Stessa connessione TCP verso il PLC, stessa sottoscrizione OPC UA, nessun vuoto nelle sue letture.
- **Un dispositivo modificato** (indirizzo, protocollo, intervallo di interrogazione, timeout, blocco di configurazione o tag) viene riconnesso con la nuova definizione.
- **Un nuovo dispositivo** viene connesso e inizia a essere interrogato.
- **Un dispositivo rimosso** (o ora `"enabled": false`) viene disconnesso.
- **La sessione Sparkplug resta attiva.** Nessun NDEATH, nessuna riconnessione, stesso bdSeq, e la coda di inoltro non viene toccata. Un ricaricamento durante un'interruzione del broker lascia nella coda ogni lettura accumulata; si svuotano quando il broker torna, come senza ricaricamento.

Sul filo, secondo Sparkplug B. Il relay è un nodo edge e ogni tag è una metrica del nodo chiamata `device/tag`, quindi ciò che cambia è l'insieme di metriche del nodo, e Sparkplug dà a un nodo un solo modo per cambiarlo: un nuovo NBIRTH, che sostituisce interamente l'ultimo. Quindi:

- **Le metriche scomparse** (un dispositivo rimosso, un tag rimosso o disattivato) vengono inviate ancora una volta in un NDATA come null, poi il nodo rifà il birth senza di esse: stessa sessione, stesso bdSeq, seq di nuovo a 0, lo stesso rebirth di `Node Control/Rebirth`. Il null c'è perché un host può tenere l'ultimo valore di una metrica che un nuovo birth omette, e l'host Sparkplug del Gateway fa esattamente questo. Senza il null, una valvola tolta dal relay resterebbe per sempre sull'ultima lettura buona, con l'aria sana.
- **Le metriche nuove** entrano in un birth alla prima interrogazione del loro dispositivo, come ogni metrica all'avvio. Un birth non nomina mai una metrica prima che ci sia una lettura dietro.
- **Le letture di un tag rimosso ancora nella coda di inoltro** vengono scartate quando la coda si svuota, con una riga di log che le conta. Il birth del nodo non porta più quella metrica, e Sparkplug non ha un modo lecito di inviarne una che non porta; inviarle significherebbe usare un alias di cui nessun host è mai stato informato.

Modificare a mano il file dei dispositivi locale richiede ancora un riavvio: il relay lo legge all'avvio e quando un invio viene cancellato, e non lo sorveglia. Con il chart è comunque ciò che fa un `helm upgrade` che cambia `devices`.

### Dove sta un file inviato e quale file vince

Entrambe le installazioni supportate montano il file dei dispositivi locale in sola lettura: il chart da un ConfigMap (o Secret), l'unità Quadlet come bind `:ro`, ed entrambe su un filesystem root in sola lettura. Fino alla 4.16.0 il relay scriveva un invio proprio accanto a quel file, quindi su entrambe le installazioni ogni singolo invio falliva con

```
a pushed config was rejected; keeping the current one and continuing to run
error="write /etc/edge-relay/devices.json.tmp: open /etc/edge-relay/devices.json.tmp: read-only file system"
```

e il relay continuava a interrogare la vecchia lista. Il Gateway diceva `config pushed`, il riavvio andava a buon fine e nulla cambiava. È corretto dando all'invio una casa propria:

- **`HOTLOOP_EDGE_RELAY_PUSHED_FILE`** è dove viene scritto un invio. Il chart lo imposta su `/data/pushed-devices.json` sul PVC (`pushedDevicesFile` in values.yaml), e l'unità Quadlet imposta lo stesso percorso sul suo volume dati con nome. Entrambi sopravvivono al container, e il PVC sopravvive a una riprogrammazione. Quest'ultimo punto è voluto: un emptyDir sarebbe scrivibile anch'esso, ma sparisce appena il pod si sposta, e un relay che torna in silenzio alla vecchia lista di dispositivi dopo un drain del nodo è lo stesso bug con passaggi in più.
- **Il file inviato vince.** All'avvio il relay carica il file inviato se esiste, e quello locale solo se non esiste. Vale dopo un riavvio, dopo una riprogrammazione, dopo che il broker ha perso l'invio retained (un riavvio di Mosquitto senza persistenza) e dopo un `helm upgrade` che cambia `devices` o `tags`. L'invio è la modifica più recente e deliberata, e il broker restituirebbe comunque la copia retained all'avvio successivo, quindi far vincere il file locale durerebbe solo un riavvio. Le prime righe del log dicono da quale file è partito: `booting from the pushed device file; the local one is ignored until the push is cleared`.
- **Tornare al file locale** (i `devices` del chart, o `/etc/edge-relay/devices.json` con Quadlet) significa `DELETE /api/fleet/{id}/config` sul Gateway. La cancellazione elimina l'invio retained sul broker, quindi nessun avvio successivo lo applica, e un relay connesso in quel momento carica il suo file locale, cancella il suo file inviato, registra `the config push was cleared; the local device file takes over` e applica il file locale in diretta, come si applica un invio. Se il file locale non si carica, il relay mantiene il file inviato in esecuzione e su disco e lo dice nel log e in `/status`: cancellarlo prima lascerebbe un relay che al riavvio successivo parte con un file rotto. Corregga il file locale e invii di nuovo la cancellazione. La faccia mentre il relay è **online**. Una cancellazione non è retained, quindi un relay offline in quel momento non lo sa mai e tiene il suo file inviato; lo riporti su e invii di nuovo la cancellazione. Si può ripetere senza rischi.
- Un file inviato che esiste ma non si carica (un guasto del disco, o una release successiva con regole più rigide) viene registrato come errore e il relay parte dal file locale invece di restare fermo per questo.
- Con `HOTLOOP_EDGE_RELAY_PUSHED_FILE` non impostata, un invio sovrascrive `HOTLOOP_EDGE_RELAY_DEVICES_FILE` stesso, il comportamento della 4.8.0. Va bene solo per un binario nudo con un file dei dispositivi scrivibile, e allora non c'è una copia separata che una cancellazione possa scartare.

Se un invio "non ha preso", guardi il log del relay prima di ogni altra cosa. O dice da quale file è partito, o dice perché l'invio è stato rifiutato.

## La superficie HTTP

Due endpoint, entrambi senza autenticazione, entrambi di sola lettura:

- `GET /healthz`: il processo è attivo. Nient'altro; un dispositivo disconnesso non significa che questo processo non sia sano.
- `GET /status`, un'istantanea: conteggio dei dispositivi per stato di connessione, numero di tag, profondità attuale della coda di inoltro, elenco dei protocolli compilati e `uplink`: se il broker è connesso, se è in corso una riproduzione, e cosa contiene la coda di inoltro, quanto pesa su disco e quanto ha scartato al suo limite (vedi la pagina Edge publish, "When the uplink is down"). Nessun valore dei tag, nessun indirizzo dei dispositivi, nessuna configurazione: è una superficie di monitoraggio, non una copia ridotta della dashboard del Gateway. `version`, `imageDigest` e `updateMode` dicono che build è e se trattiene gli aggiornamenti. Dice anche, sotto `config`, quale file dei dispositivi è in esecuzione: `source` (`local` o `pushed`), `path`, il suo `digest` sha256, `appliedAt` e `rejected`, l'ultimo file che il relay ha rifiutato e perché, finché non se ne applica uno successivo. Il digest, non il file: il Gateway può confrontarlo con ciò che ha inviato senza che indirizzi e credenziali del file escano su una porta non autenticata. Con un broker `discovery` nel file dice anche, sotto `discovery`, come sta andando ciascuno e quanti dispositivi ha trovato (vedi [Discovery](#discovery-41810)).

Deliberatamente nessuna autenticazione davanti a nessuno dei due: un edge relay non ha database utenti, archivio di sessioni né sistema di identità da cui costruirne una, e aggiungere un singolo token condiviso sarebbe teatro più che sicurezza per due endpoint che non espongono nulla di sensibile. Lo esegua dietro il perimetro di rete del dispositivo stesso, la stessa aspettativa che la modalità `auth.insecure` del Gateway già documenta per un deployment dietro un proxy fidato.

## Configurazione

| Variabile | Predefinito | <span class="sr-only">Details</span> |
|---|---|---|
| `HOTLOOP_EDGE_RELAY_DEVICES_FILE` | n/a | Obbligatoria. Percorso del file dei dispositivi descritto sopra |
| `HOTLOOP_EDGE_RELAY_PUSHED_FILE` | unset | Dove si conserva un file dei dispositivi inviato; vince su quello sopra finché esiste. Deve essere scrivibile e persistente; il chart e l'unità Quadlet usano `/data/pushed-devices.json`. Vedi [Dove sta un file inviato](#dove-sta-un-file-inviato-e-quale-file-vince) |
| `HOTLOOP_EDGE_RELAY_LISTEN_ADDR` | `:8081` | Il server di `/healthz` e `/status` |
| `HOTLOOP_EDGE_RELAY_UPDATE_MODE` | `auto` | `auto` lascia l'aggiornamento al supervisore e ignora un'approvazione dal Gateway; `approve` trattiene gli aggiornamenti finché ne arriva una. Vedi [Aggiornare un relay](#aggiornare-un-relay) |
| `HOTLOOP_IMAGE_DIGEST` | unset | Il digest dell'immagine da cui gira questo relay, come lo conosce il suo supervisore. L'unità Quadlet lo imposta prima di ogni avvio. Riportato in `/status` e in ogni birth; vuoto va bene |
| `HOTLOOP_LOG_LEVEL` | `info` | |
| `HOTLOOP_POLL_INTERVAL` | `5s` | Intervallo di interrogazione predefinito; il `pollIntervalMs` proprio di un dispositivo lo sostituisce |
| `HOTLOOP_MIN_POLL_INTERVAL` | `100ms` | Minimo imposto a ogni dispositivo, qualunque sia la sua impostazione |
| `HOTLOOP_POLL_TIMEOUT` | `10s` | Timeout predefinito per interrogazione; il `timeoutMs` proprio di un dispositivo lo sostituisce |
| `HOTLOOP_MAX_CONCURRENT_POLLS` | `32` | Dispositivi che possono essere contemporaneamente in mezzo a un'interrogazione |
| `HOTLOOP_RECONNECT_MIN` / `HOTLOOP_RECONNECT_MAX` | `1s` / `60s` | Limiti di backoff tra i tentativi di riconnessione, con jitter |
| `HOTLOOP_RING_SIZE` | `120` | Campioni per tag conservati per la diagnostica vicina a `/status` |
| `HOTLOOP_OPCUA_CLIENT_PKI_DIR` | `/data/opcua-client-pki` | Il certificato del driver OPC UA e i suoi archivi `trusted/` e `rejected/`; il `pkiDir` proprio di un dispositivo lo sostituisce. Lo tocca solo un dispositivo OPC UA protetto |

Nomi di variabile e valori predefiniti identici a quelli della `RuntimeConfig` del Gateway; vedi la sua sezione "Polling" nella pagina k3s e Helm per le stesse impostazioni espresse come valori Helm, perché entrambi i binari caricano questa configurazione con la stessa funzione `config.LoadRuntimeConfig()`, non con due copie che potrebbero divergere.

Più ogni variabile `HOTLOOP_EDGE_PUBLISH_*` che la pagina Edge publish documenta, con una differenza: `HOTLOOP_EDGE_PUBLISH_ENABLED` viene ignorata e l'inoltro è sempre attivo; pubblicare ciò che legge è l'intero scopo di questo binario, non una funzione opzionale come sul Gateway.

## Cosa è stato verificato e cosa no

HotLoop è stato eseguito su apparecchiature reali e server reali, e su hardware reale il 2026-11-17.

## Distribuzione

Due percorsi supportati, entrambi con container, nessun `podman run` isolato lanciato da una shell che muore con la sessione, e niente Docker:

- **`charts/hotloop-edge-relay`**, un chart Helm per k3s, separato dal chart del Gateway (`charts/hotloop`), perché un edge relay è un artefatto davvero diverso che spesso gira in un cluster diverso e più piccolo di quello del Gateway a cui inoltra. Dispositivi e tag si dichiarano in `values.yaml` e vengono resi in un ConfigMap; la coda di inoltro sta su un piccolo PVC (vedi "Persistence off" più avanti prima di disattivarlo).
- **`deploy/quadlet`**, un'unità Podman Quadlet per un Pi o un piccolo PC industriale che non fa parte di alcun cluster k3s. Quadlet trasforma il container in un vero servizio systemd: parte all'avvio, riparte in caso di errore, scrive su journald; vedi il README di quella directory per l'installazione.

Entrambi usano la stessa immagine e le stesse variabili d'ambiente documentate sopra.

Ogni release pubblica entrambi, dalla 4.16.0. L'immagine è `ghcr.io/hotloop-io/hotloop-edge-relay`, con tag della versione della release (più `major.minor`, `major`, `latest` e `stable`; l'unità Quadlet segue `stable`, vedi [Aggiornare un relay](#aggiornare-un-relay)). È amd64 e arm64, e arm a 32 bit (arm/v7) dalla prima release dopo la 4.17.0, perché un Pi 3 o un'installazione Pi OS a 32 bit è proprio il box dove finisce un relay. Il chart è nello stesso repository Helm di quello del Gateway:

```sh
helm repo add hotloop https://hotloop.io/hotloop/
helm install edge-relay hotloop/hotloop-edge-relay \
  --namespace hotloop --create-namespace \
  --set edgePublish.broker=tcp://gateway.example.local:1883 \
  --set edgePublish.group=Plant1
```

### Persistence off

`persistence.enabled=false` le dà un relay che gira senza PVC, e esattamente questo. Sulla 4.16.0 non girava nemmeno: niente era montato su `/data`, la root è in sola lettura e il relay moriva all'avvio con `open forward queue at /data/forward.db: no such file or directory`. Ora `/data` è un emptyDir, limitato a `persistence.size`, e tutto ciò che il relay scrive finisce lì.

Un emptyDir vive quanto il pod. Un riavvio del container nello stesso pod lo mantiene. Un nuovo pod no, e si ottiene un nuovo pod con un drain del nodo, la morte di un nodo, uno sfratto, un `kubectl delete pod` e qualsiasi `helm upgrade` che rinnovi il Deployment. Ogni volta si perde:

- **La coda di inoltro.** Ogni lettura accumulata mentre il broker era giù sparisce, e nulla sul lato Gateway sa che manca.
- **Un file dei dispositivi inviato.** Il relay riparte dai `devices` del chart senza lamentarsi, finché il Gateway non invia di nuovo o il broker non riproduce un invio retained. È esattamente il guasto che il PVC serve a prevenire, e disattivarlo la espone di nuovo.
- **Il certificato client OPC UA e il trust store.** Ogni server protetto deve fidarsi del nuovo certificato, e l'operatore deve approvare di nuovo il certificato di ogni server.

Riempire il tetto, cosa che una coda illimitata (`queueMaxBytes: 0`; il predefinito è 64 MiB) farà in un'interruzione abbastanza lunga, fa sfrattare il pod e perdere tutti e tre insieme. È comunque meglio che riempire il disco del nodo sotto tutto il resto. Le note di installazione stampano un avviso quando la persistenza è disattivata. Va bene per una prova. Per un relay le cui letture contano, gli dia il PVC.

### Dall'App Store EmberNet

Lo store elenca il relay come HotLoop Edge Relay, uno per nodo. Un deploy dallo store passa al chart tre cose: il nome visualizzato (il nome della release), un selettore di nodo e le etichette del tenant. Non ha un modulo per chiedere altro, e il relay non può girare senza un broker e un gruppo Sparkplug. Quindi un deploy del relay dallo store si ferma al rendering, di proposito, con un errore nel log del job helm-install che nomina ciò che manca e stampa il comando esatto per rimediare.

Non gli abbiamo dato un broker predefinito, perché non ne esiste uno vero per lo stabilimento di qualcuno, e un relay puntato a un indirizzo inventato sembrerebbe distribuito mentre non inoltra nulla. Non può nemmeno restare ad aspettare un file dei dispositivi inviato: un invio arriva sulla connessione al broker che non ha ancora.

La soluzione è mettere i due valori in ciò che lo store ha scritto, e l'installazione riprova da sola:

```sh
# a node on the local cluster: add them under spec.valuesContent
kubectl -n default edit helmchart hotloop-edge-relay-<node>

# a tenant on its own cluster (Fleet): add them under spec.helm.values
kubectl -n fleet-default edit helmop hotloop-edge-relay-<node>
```

```yaml
edgePublish:
  broker: tcp://<gateway-or-broker>:1883
  group: <sparkplug group id>
```

Una volta attivo compare in App in esecuzione con il nome dato dallo store, con l'icona HotLoop, limitato al tenant che l'ha distribuito, e senza pulsante AVVIA. Quest'ultimo punto è voluto: il chart lo etichetta `embernet.ai/gui-type: none`, perché `/healthz` e `/status` servono a una sonda e al curl di un operatore, non a una pagina in un iframe.

Il relay e il Gateway condividono un numero di versione. Una release non parte se entrambi i chart non portano la versione del tag e se l'unità Quadlet del relay non segue `:stable`, quindi il relay riceve una nuova versione a ogni release, sia che il suo codice sia cambiato o no. È voluto: un solo numero a cui chiedere, e nessun chart di relay che punta a un'immagine di relay che nessuno ha pubblicato. L'unità Quadlet un tempo fissava il numero di release, il contrario di come funziona un box che si aggiorna da solo.
