---
title: "Gestione della flotta"
description: "Segui ogni Edge Relay dalle sue nascite e morti Sparkplug e invia rebirth, riavvio o un nuovo file dei dispositivi senza andare fino al box."
---

La gestione della flotta, dalla 4.7.0, permette al Gateway di tenere traccia degli edge relay registrati, di sapere se sono vivi e, per un operatore autorizzato, di chiedere a uno di fare rebirth, riavviarsi o adottare una configurazione appena inviata. Disattivata per impostazione predefinita (`HOTLOOP_FLEET_ENABLED`): un'installazione senza edge relay non ha un broker a cui puntarla.

## Che cosa non è

La gestione della flotta ha una propria connessione MQTT, separata, e risponde a un'altra domanda: se un edge relay *registrato* è vivo, non quale valore ha uno dei suoi tag. Agganciarla al driver che interroga i tag avrebbe costretto a configurare un Dispositivo compatibile solo per vedere la flotta, oppure a mettere mano alla contabilità privata per nodo di quel pacchetto, che non è mai stata pensata per essere condivisa.

**Non è automatica.** Un edge relay che compare sul broker non diventa per questo membro della flotta. L'appartenenza si dichiara, con una riga in `fleet_members` creata tramite `POST /api/fleet`, la stessa distinzione che questa applicazione già fa tra un tag scoperto da un driver e un tag configurato da una persona. Un NBIRTH di un gruppo o nodo che nessuno ha registrato viene scritto a livello debug e per il resto ignorato.

## Come si incastra tutto

- **Presenza**, da NBIRTH e NDEATH. Solo in uscita dal lato del relay: chiama il broker, come fa sempre per pubblicare le letture, quindi funziona attraverso il NAT senza alcuna connessione in ingresso verso il relay.

I comandi viaggiano nell'altro verso su Sparkplug NCMD, estendendo ciò che un relay già gestisce:

- Una spinta innocua e idempotente.
- **Riavvio** (`Node Control/Reboot`, il nome che usa la stessa specifica Sparkplug, non uno inventato da questa applicazione): il relay pubblica il proprio NDEATH ordinato ed esce; il suo supervisore (il `Restart=always` di un'unità Quadlet, o il `restartPolicy: Always` predefinito di un Deployment) lo rimette in piedi con ciò che c'è su disco in quel momento. Nessun nuovo percorso di arresto: è la stessa uscita pulita che il relay già segue con il suo `SIGTERM`.

Poiché i comandi viaggiano sulla stessa connessione MQTT che il relay già apre verso l'esterno, inviarne uno non richiede nemmeno una connessione in ingresso verso il relay.

Un relay che risulta online può essere comandato, senza eccezioni. Ogni relay si sottoscrive al proprio topic NCMD, e attende la conferma del broker, prima di pubblicare una nascita, a ogni connessione, così "Online" non è mai in anticipo su "raggiungibile". Il gestore si impone la stessa regola dal proprio lato: non si dichiara avviato finché le sottoscrizioni NBIRTH e NDEATH non sono confermate, quindi un relay che nasce nell'istante in cui il Gateway parte non viene perso. Se l'ACL del broker rifiuta la sottoscrizione dell'uno o dell'altro lato, quel lato si rifiuta di avviarsi e lo dice, invece di funzionare mezzo sordo.

## Invio della configurazione

Inviare ciò che un relay interroga non passa da NCMD, perché una metrica Sparkplug non è dimensionata per un intero file dei dispositivi: va su un **topic MQTT semplice e retained** per relay: `hotloop/edge-relay-config/<group>/<node>`. La consegna retained è ciò che fa funzionare tutto senza una richiesta a parte di "aggiornami": ciò che è stato pubblicato per ultimo viene consegnato subito a qualsiasi client che si sottoscrive, compreso un relay che si riconnette dopo essere stato offline o che parte per la prima volta.

Il relay convalida di nuovo alla ricezione: questa applicazione non può dare per scontato che solo il Gateway pubblichi su quel topic, ma solo che essa stessa deve rifiutarsi di pubblicare qualcosa di rotto.

**Un file dei dispositivi può contenere credenziali, e un invio lo pubblica.** Il blocco `config` di un dispositivo contiene ciò con cui il suo driver accede, come `username` e `password` OPC UA (4.15.0), e il file viene pubblicato così com'è, retained. Chiunque possa sottoscriversi a `hotloop/edge-relay-config/#` può leggerlo, quindi il broker ha bisogno di TLS e di un'ACL su quel topic prima che si invii un file con credenziali. L'API del Gateway nasconde le credenziali dei dispositivi a tutti i ruoli dalla 4.15.1, ma un file inviato non è dietro l'API e questo non lo cambia. Vedi il [riferimento Edge Relay](/it/edge-relay/reference/#credentials-in-the-device-file-4150) e [Autenticazione e utenti](/it/iot/authentication/#dove-le-credenziali-restano-in-chiaro).

**Un invio si applica dal vivo e non riavvia mai nulla.** Fino alla 4.17 un invio si limitava a preparare il file, e per renderlo effettivo serviva una seconda azione, un `POST /api/fleet/{id}/restart`, che interrompeva la sessione del relay con il broker e tutte le sessioni dei dispositivi che teneva, per cambiare un solo tag. Ora:

- **Un relay in funzione** convalida il file, lo salva e lo applica sul posto: i dispositivi nuovi si connettono, quelli rimossi si disconnettono, quelli modificati si riconnettono, e ogni dispositivo rimasto uguale mantiene la sua sessione. La sessione Sparkplug e la coda di inoltro restano attive per tutto il tempo. Il nodo fa rebirth con il nuovo insieme di metriche e prima azzera quelle che ha tolto, così un host non continua a mostrare l'ultimo valore buono di un dispositivo rimosso. Il [riferimento Edge Relay](/it/edge-relay/reference/#what-a-live-apply-keeps-and-what-it-changes) dice esattamente che cosa passa sul cavo e perché.
- **Un file che il relay rifiuta** (non si analizza, non si convalida, non si può salvare) non cambia nulla sul relay, e il `/status` del relay lo dice sotto `config.rejected`. `GET /api/fleet` lo mostra per ogni membro con uno `statusUrl`, accanto all'impronta del file che sta eseguendo, così "l'ho inviato" e "lo sta eseguendo" sono due cose che si possono verificare, non una che si presume. Anche il Gateway convalida prima di pubblicare, quindi in pratica si tratta di un relay di una versione più recente o più vecchia che non concorda sulle regole, o di qualcosa che non è il Gateway che pubblica sul topic.
- **Un relay offline** riceve l'invio retained appena si connette. All'avvio lo aspetta un paio di secondi prima di caricare il proprio file locale, così parte con l'elenco inviato invece di partire con il vecchio e poi cambiare.

Un file inviato finisce nel volume dati del relay, non sopra il suo file locale dei dispositivi, e prevale su quello locale finché l'invio non viene cancellato. Il [riferimento Edge Relay](/it/edge-relay/reference/#where-a-pushed-file-lives-and-which-file-wins) ha le regole di precedenza e il bug della 4.16.0 che le ha rese necessarie.

**Ritirare un invio** è `DELETE /api/fleet/{id}/config` (`fleet.config`, come inviare). Pubblica un messaggio retained vuoto sul topic di configurazione del membro, che è il modo in cui MQTT elimina un valore retained, così nessun avvio successivo applica l'invio. Un relay connesso in quel momento scarta il file inviato e torna a quello locale dal vivo, come si applica un invio, a meno che il suo file locale non si carichi, nel qual caso tiene quello inviato e lo dice. Un relay che era offline non sente mai la cancellazione (un messaggio vuoto non viene conservato), quindi inviala di nuovo quando il relay è tornato.

## Che cosa esegue ogni relay, e come si aggiorna

Ogni relay mette la sua versione e l'impronta della sua immagine in ogni nascita, e lo stesso fa un Edge o un Gateway con la pubblicazione edge attiva, quindi un box registrato qui come membro mostra le stesse cose (metriche di tipo stringa chiamate `Node Info/Version` e `Node Info/ImageDigest`, senza alias, così un host Sparkplug che non le conosce le ignora). `GET /api/fleet` le mostra come `release` su ogni membro: `version`, `imageDigest` e `since`, quando il Gateway ha sentito per la prima volta quella build. Un relay precedente non ne riporta nessuna, e il Gateway non ne dice nulla invece di inventare una "build sconosciuta".

Quando la build di un membro cambia, il Gateway la scrive nel log di sistema come evento `config` su quel membro, con la vecchia e la nuova versione e impronta nel dettaglio (`{"kind":"fleet.release",...}`). Viene registrata anche la prima build che sente, come riferimento con cui misurare la successiva. Sopravvive al riavvio del Gateway, perché l'ultimo record viene riletto dal log: un riavvio non inventa mai un aggiornamento. È la traccia di audit di ogni aggiornamento che un relay riceve, per qualunque via (il timer di Podman, un'approvazione, `helm upgrade`, qualcuno sul box), perché il Gateway non causa un aggiornamento e può solo segnalarlo. Un tag mobile è il modo in cui si aggiorna `:stable`, quindi viene registrata anche un'impronta diversa sotto la stessa versione, come "un'immagine diversa della stessa versione".

`POST /api/fleet/{id}/update` (`fleet.update`, solo amministratori) approva l'aggiornamento che un relay trattiene. Fa qualcosa solo su un relay impostato per trattenere gli aggiornamenti; qualsiasi altro relay registra di averlo ignorato. La richiesta non nomina alcuna immagine. Ciò che questo fa e non fa per ogni tipo di installazione è nel [riferimento Edge Relay](/it/edge-relay/reference/#updating-a-relay).

## Autorizzazione dei comandi

Due livelli, volutamente non uno solo:

- **Nell'API**, un operatore ha bisogno di `fleet.rebirth` per richiedere un rebirth; riavviare, approvare un aggiornamento o inviare una configurazione richiedono rispettivamente `fleet.restart`, `fleet.update` e `fleet.config`, concessi solo all'amministratore. Un riavvio disturba un ciclo di interrogazione in corso più di una spinta di rebirth, e inviare ciò che un relay interroga è trattato allo stesso modo, la stessa restrizione che `alarms.ack` e `automations.trigger` modellano già per altre azioni "fallo adesso".
- **Sul broker**, questa applicazione non può imporre nulla: la pubblicazione NCMD e il topic di configurazione devono essere entrambi limitati, dalle ACL del broker, alle credenziali MQTT del Gateway stesso. Senza questo, chiunque raggiunga il broker e conosca il gruppo e il nodo di un relay può pubblicare lo stesso comando o la stessa configurazione di questa funzione. Configuralo al momento del deployment; non è facoltativo solo perché sta fuori dal codice di questa applicazione.

## API

| Rotta | Permesso | <span class="sr-only">Dettagli</span> |
|---|---|---|
| `GET /api/fleet` | `fleet.read` | Ogni membro registrato, con la presenza dal vivo e, dove configurato, uno `/status` interrogato |
| `POST /api/fleet` | `fleet.write` | Crea o aggiorna un membro (un corpo con un `id` esistente lo aggiorna) |
| `DELETE /api/fleet/{id}` | `fleet.write` | Rimuove un membro registrato |
| `POST /api/fleet/{id}/rebirth` | `fleet.rebirth` | Pubblica `Node Control/Rebirth` |
| `POST /api/fleet/{id}/restart` | `fleet.restart` | Pubblica `Node Control/Reboot` |
| `POST /api/fleet/{id}/update` | `fleet.update` | Approva l'aggiornamento dell'immagine che un relay trattiene (non fa nulla su uno che non la trattiene) |
| `POST /api/fleet/{id}/config` | `fleet.config` | Invia un nuovo file dei dispositivi (corpo JSON grezzo, convalidato prima della pubblicazione); un relay in funzione lo applica dal vivo |
| `DELETE /api/fleet/{id}/config` | `fleet.config` | Cancella l'invio, così il relay torna al suo file locale dei dispositivi, dal vivo se è connesso |

## Configurazione

| Variabile | Predefinito | <span class="sr-only">Dettagli</span> |
|---|---|---|
| `HOTLOOP_FLEET_ENABLED` | `false` | La funzione è disattivata finché non viene impostata |
| `HOTLOOP_FLEET_BROKER` | n/a | Obbligatoria se attiva. Un host semplice, `host:port` o un URL completo |
| `HOTLOOP_FLEET_USER` / `_PASSWORD` | n/a | Credenziali del broker |
| `HOTLOOP_FLEET_TLS` | `false` | |
| `HOTLOOP_FLEET_TLS_SKIP_VERIFY` | `false` | Da attivare per singolo deployment; non impostarlo mai come predefinito |

## Che cosa è stato verificato e che cosa no

HotLoop è stato eseguito su apparecchiature e server reali, e su hardware reale il 2026-11-17.
