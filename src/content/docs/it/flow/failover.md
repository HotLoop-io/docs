---
title: "Standby caldo con un lease"
description: "Due installazioni di Flow condividono un compito: un lease in PostgreSQL e una barriera su ogni scrittura verso le apparecchiature, ne scrive una sola."
---

Due installazioni di Flow possono condividere il lavoro di una. Una è quella che scrive: è l'unica che invia qualcosa alle apparecchiature. L'altra è lo standby: esegue gli stessi flussi, legge, si sottoscrive e tiene caldo il proprio contesto, ma trattiene ogni scrittura verso le apparecchiature finché non prende il posto di chi scrive. Se chi scrive muore, si blocca o perde il collegamento, lo standby subentra in circa la durata di un lease, e quella che scriveva non può scrivere di nuovo finché non riconquista il lease.

Questo serve quando un riavvio non è abbastanza rapido e un secondo scrittore è peggio di una breve attesa. Se un riavvio è abbastanza rapido, un'unica installazione e una riprogrammazione di Kubernetes sono più semplici ed è ciò che fa il chart per impostazione predefinita.

## Come funziona

Il lease è una riga in un PostgreSQL raggiungibile da entrambe le installazioni. Chi scrive lo rinnova ogni pochi secondi. Lo standby lo richiede con lo stesso ritmo e lo ottiene solo dopo che è scaduto. Ogni volta che il titolare cambia, il numero di fencing sulla riga aumenta, e Flow lo riporta.

Ogni scrittura verso le apparecchiature pone la stessa domanda subito prima di inviare: ho il lease, con più tempo rimasto di quanto ne serve a una scrittura? In caso contrario, la scrittura viene rifiutata con un errore conteggiato che arriva al nodo Catch del flusso, e non viene inviato nulla, nemmeno una connessione. Quel controllo, fatto nel momento di ogni scrittura, è ciò che impedisce a due installazioni di scrivere insieme:

- Il titolare conta il proprio lease dal momento in cui lo ha richiesto, mai dal momento in cui è arrivata la risposta, quindi non crede mai di avere più tempo del database.
- Il titolare smette di scrivere quando gli resta meno lease di quanto serve a una scrittura (`writeMargin`), cioè prima che il lease scada. Lo standby può prendere il lease solo dopo che è scaduto. Quindi c'è un intervallo, e nessuna sovrapposizione.
- Un titolare che viene congelato e poi scongelato, o isolato e poi riconnesso, trova il proprio lease perso, rifiuta le proprie scritture e chiede il lease come chiunque altro.
- L'orologio del database decide quando finisce il lease, quindi due macchine con orologi discordanti concordano comunque su chi lo detiene.

Le scritture che pongono la domanda sono quelle che possono comandare un'apparecchiatura: `modbus write`, `s7 write`, `opcua write` e `ethernetip write`, direttamente o tramite il write gate di HotLoop, i nodi `hotloop script` e `hotloop recipe`, e in un diagramma FlowLab la scrittura seriale, un comando di strumento che scrive (insieme all'interruttore di scrittura dello strumento stesso) e la scrittura HotLoop. Inviare un messaggio a un broker MQTT, a un database o una notifica non ha barriera: non è un comando a un'apparecchiatura, e ripeterlo è innocuo dove un setpoint ripetuto potrebbe non esserlo. Un test di flusso sostituisce il mondo esterno e non viene mai trattenuto.

## Cosa costa e cosa non vi dà

- **Il tempo di subentro** è circa la durata del lease. Con i valori predefiniti (lease di 15 secondi, rinnovato ogni 5 secondi, margine di 5 secondi) uno standby è subentrato 14,7 secondi dopo l'interruzione brutale di chi scriveva. Con un lease di 6 secondi, 5,7 secondi. Uno scrittore che si ferma in modo pulito cede il lease, e lo standby è subentrato in 0,35 secondi.
- **Una scrittura che dura più di `writeMargin`** può sopravvivere al lease. Tenete i timeout di protocollo dei nodi che scrivono al di sotto. Una scrittura già in volo quando un processo viene congelato ha già superato il controllo e può ancora arrivare.
- **Almeno una volta.** Un PLC che ha accettato una scrittura il cui riscontro è andato perso può vedere il nuovo scrittore inviarla di nuovo. Per un setpoint è sicuro, per un impulso o un incremento no, quindi scrivete setpoint, non delta.
- **Le code restano locali.** I fili durevoli e il contesto stanno sul disco di ciascuna installazione. Ciò che era in coda su uno scrittore morto non è sullo standby.
- **Il database è una dipendenza.** Uno scrittore che non lo raggiunge non può rinnovare, e smette di scrivere quando il suo lease si accorcia troppo. Mettete il lease su un database almeno altrettanto disponibile delle apparecchiature che protegge.

## Configurazione

Installate Flow due volte, come due release Helm o due unità Quadlet, ciascuna con il proprio volume, e puntate entrambe allo stesso lease. Date alla seconda lo stesso file di flussi della prima e mantenetelo così con un invio alle stazioni ([Invio alle stazioni di un tenant](/it/flow/stations/)), perché Flow non copia i flussi tra le due.

| Impostazione | Ambiente | Cos'è |
|---|---|---|
| `failover.urlFile` | `HOTLOOP_FLOW_FAILOVER_URL_FILE` | Un file con l'URL PostgreSQL del database del lease. Impostarlo attiva il failover. |
| `failover.name` | `HOTLOOP_FLOW_FAILOVER_NAME` | Il lease. Lo stesso su entrambe. Predefinito `flow`. |
| `failover.holder` | `HOTLOOP_FLOW_FAILOVER_HOLDER` | Il nome di questa installazione. Deve essere diverso tra le due, e per impostazione predefinita è il nome host. |
| `failover.ttl` | `HOTLOOP_FLOW_FAILOVER_TTL` | Quanto dura una concessione, e quindi circa il tempo di subentro. Predefinito `15s`. |
| `failover.renewEvery` | `HOTLOOP_FLOW_FAILOVER_RENEW_EVERY` | Ogni quanto il titolare lo richiede di nuovo. Predefinito un terzo del ttl. |
| `failover.writeMargin` | `HOTLOOP_FLOW_FAILOVER_WRITE_MARGIN` | Quanto lease deve restare a una scrittura. Predefinito `5s`. |

Flow rifiuta di avviarsi quando le impostazioni farebbero scendere il titolare sotto il proprio margine tra un rinnovo e l'altro, per esempio un margine lungo quanto il ttl.

Nel chart sono `failover.urlSecret` (un Secret la cui chiave contiene l'URL, montato come file e mai messo nel ConfigMap), `failover.name`, `failover.ttl`, `failover.renewEvery` e `failover.writeMargin`. Con Quadlet sono le variabili d'ambiente qui sopra, e l'URL è un segreto Podman montato come file:

```ini
Environment=HOTLOOP_FLOW_FAILOVER_URL_FILE=/run/secrets/flow-lease-url
Environment=HOTLOOP_FLOW_FAILOVER_NAME=line3
Secret=hotloop-flow-lease-url,type=mount,target=flow-lease-url
```

## Come vederlo

- `GET /failover` (e lo strumento MCP `get_failover`) dice se questa installazione è `active`, `standby` o `lost`, chi detiene il lease, il numero di fencing che detiene e quante scritture ha trattenuto, in base a cosa stava scrivendo. Richiede `status.read` ed esiste solo quando il failover è configurato.
- L'editor mostra un banner su uno standby e su un titolare che ha perso il lease.
- L'endpoint delle metriche ha `hotloop_flow_failover_active`, `hotloop_flow_failover_epoch`, `hotloop_flow_failover_takeovers_total` e `hotloop_flow_failover_refused_total{op}`.
- Entrambe le installazioni registrano quando prendono il lease e quando viene loro tolto.

## Cosa è dimostrato e cosa no

Dimostrato su due veri processi Flow contro un vero PostgreSQL e un server Modbus TCP che registra ogni scrittura, con ciascuna installazione che scrive un valore etichettato ogni 200 ms: con chi scriveva interrotto bruscamente a flusso in corso, lo standby è subentrato dopo un lease, e nessuna scrittura dello standby è arrivata prima dell'ultima di chi scriveva né dopo di essa (0 e 0); con chi scriveva congelato più a lungo del lease e poi scongelato, non ha più scritto; con chi scriveva fermato in modo pulito, lo standby è subentrato in 0,35 secondi. Un test per ciascun percorso di scrittura sopra mostra che la scrittura di uno standby o di un titolare scaduto viene rifiutata prima che venga inviato qualcosa, e mostra che la stessa scrittura viene inviata quando il gate è aperto.

Non dimostrato: il comportamento di un PLC reale davanti a una scrittura ripetuta, un failover del database sotto il lease e una rete interrotta in una sola direzione. Il server Modbus è un simulatore che parla il protocollo. Il failover non è provato su un cluster, e i valori del chart e le righe Quadlet sono renderizzati e controllati, non installati. I testi del banner dell'editor non hanno avuto la revisione di un madrelingua.
