---
title: "Note di rilascio: HotLoop Flow 2.2.0"
description: "Cosa porta HotLoop Flow 2.2.0, cosa cambia con l'aggiornamento e cosa leggere prima di toccare un impianto in funzione."
sidebar:
  label: "2.2.0"
---

HotLoop Flow 2.2.0 è la versione in cui Flow parla con i PLC, ricorda ciò che sapeva quando si riavvia e ti mostra dove è passato un messaggio. È anche la prima versione sotto la Business Source License di HotLoop, e lo metto per primo perché è la parte che devi leggere.

## La licenza è cambiata

La 2.2.0 e tutte le versioni successive sono sotto la Business Source License 1.1 di HotLoop, la stessa licenza del resto di HotLoop. Non è una licenza open source e non farò finta che lo sia. Il sorgente di Flow resta pubblico, quindi puoi leggere ogni riga che esegui.

- L'uso domestico e di laboratorio è gratuito.
- Scuole e istituti di istruzione accreditati, organizzazioni non profit ed enti pubblici lo usano gratuitamente per le proprie attività e la propria missione.
- L'uso aziendale è gratuito quando passa da [EmberNet](https://embernet.ai). È l'unica strada aziendale.
- Ospitare Flow come servizio, rivenderlo e incorporarlo in un prodotto che vendi non sono concessi.
- Ogni versione diventa GPL-3.0 o successiva quattro anni dopo la prima pubblicazione.

`LICENSE` è il testo legale, byte per byte quello di HotLoop-io/HotLoop-io. La 2.1.0 e tutto ciò che la precede restano sotto la licenza con cui sono uscite. Nulla cambia in quelle versioni. I file portati da Node-RED mantengono le intestazioni di licenza e i crediti originali, quindi il testo della loro licenza ora è distribuito in `LICENSES/` accanto a `NOTICE`, e l'immagine porta entrambi in `/usr/share/doc/hotloop-flow/`. `NOTICE` copre anche la copia con patch di gos7 che Flow ora include (più avanti).

## Novità

**Tracciamento e replay**
- Ogni messaggio ha una traccia limitata. Fai clic su un messaggio di debug e l'editor illumina il percorso che ha fatto, con tempi e payload a ogni passaggio, attraverso split, join e sottoflussi.
- Una traccia diventa un test di flusso, oppure si riproduce in una bozza così puoi provare una correzione sul messaggio che ha causato il problema.
- Ogni passaggio può andare a un collector OpenTelemetry come span (`trace.otlp.endpoint`).

**Stato che sopravvive a un riavvio**
- Il contesto di flusso, globale e di nodo vive in un file SQLite, `state.db`, sul volume dei dati. Un riavvio non lo cancella più.
- Collegamenti durevoli. Segna un collegamento come durevole e, finché il nodo all'altro capo sta al passo, è un collegamento normale e non scrive nulla. Quando quel nodo smette di accettare messaggi, il collegamento riversa nello stesso file in ordine e si svuota quando la destinazione torna. L'abbiamo provato contro un vero InfluxDB fermato per dieci minuti, con il runtime terminato con `kill -9` a metà dell'interruzione e a metà dello svuotamento: nessuno perso, nessuno duplicato.

**Nodi di impianto**
- Lettura e scrittura Modbus TCP, lettura, scrittura e sottoscrizione OPC UA, lettura e scrittura S7, lettura e scrittura EtherNet/IP, e Sparkplug B come nodo edge e come host. Flow ora può parlare con ciò che trova `scan`.
- Sparkplug gestisce nascite, last will, `bdSeq`, richieste di rebirth e comandi come richiede la specifica. L'abbiamo verificato contro un'implementazione Sparkplug indipendente in entrambe le direzioni, nodo edge e host.
- Un dispositivo silenzioso fa fallire la richiesta entro il timeout e il messaggio successivo si riconnette. Una sottoscrizione OPC UA si accorge di essere caduta, lo dice una volta sola e si riprende da sola.

**L'editor**
- Copia e incolla, importazione ed esportazione di una selezione, sottoflussi con una propria tela, gruppi annidati, ricerca in tutti i flussi, filtri di debug, Alt+clic per eliminare un collegamento. Un test nel browser percorre ogni finestra di dialogo dei nodi dall'elenco che serve il runtime, così un nodo nuovo è coperto dal giorno in cui esce.
- Trascinare un collegamento su un nodo non ha mai funzionato in Chromium. Ora funziona.

**Controlli**
- Un nodo il cui nodo di configurazione non è nel file (un broker eliminato che un sottoflusso nomina ancora, o un riferimento a una scheda o al tipo sbagliato di nodo di configurazione) viene segnalato all'importazione, al caricamento e al deploy, e non parte. Prima semplicemente non funzionava mai.
- Eliminare un flusso o un nodo toglie il suo id dagli ambiti di Catch, Status e Complete che lo nominavano.

## Cosa è cambiato

- Il contesto persiste per impostazione predefinita. `store.context.persist` è attivo, quindi un valore impostato prima di un riavvio c'è ancora dopo, mentre prima ogni riavvio partiva vuoto. Un flusso che contava su un contesto vuoto all'avvio ora deve azzerare ciò che si aspetta vuoto. Imposta `persist` su `false` per il comportamento di prima.
- Il tracciamento è attivo per impostazione predefinita e limitato in ogni senso: 256 percorsi, 512 passaggi ciascuno, 16 MiB in tutto, 1000 nuovi percorsi al secondo. Sta solo in memoria, quindi un riavvio ricomincia l'elenco. `trace.enabled: false` lo disattiva.
- gos7 stampava una riga grezza sul logger globale di Go a ogni timeout S7, e niente sul nodo poteva spegnerla.
- La coda durevole conta un messaggio come in attesa dopo che è su disco, non prima.
- L'immagine è costruita e pubblicata con Podman, non con Docker. Stessa immagine, stessi tag (`2.2.0`, `2.2`, `2`), sempre linux/amd64 e linux/arm64.

## Note di aggiornamento

Dalla 2.1.0 basta cambiare l'immagine (`helm upgrade`, o il nuovo tag nella tua unità Quadlet). Nessuna migrazione, nessun flag. Un `flows.json` e un file di configurazione che giravano sulla 2.1.0 girano sulla 2.2.0, e il ciclo di andata e ritorno byte per byte del file di flussi resta intatto.

- Il primo avvio crea `state.db` in `data.dir`, sul volume. Con `persistence.enabled` false nel chart sopravvive al riavvio del container ma non alla sostituzione del pod.
- Tornare alla 2.1.0 lascia `state.db` dov'è. La 2.1.0 non ha codice che lo legga.
- Ogni scrittura su `state.db` è una scrittura su una scheda SD o un SSD, quindi i valori predefiniti raggruppano. Le modifiche di contesto aspettano `flushInterval` (30 secondi) e vengono scritte insieme, e un valore impostato a ciò che era già non scrive nulla. Un `kill -9` può perdere quell'intervallo. `docs/durable/README.md` ha i numeri e quanto costa a una scheda.

## Nuove impostazioni

| YAML | Ambiente | Predefinito |
|---|---|---|
| `store.path` | `HOTLOOP_FLOW_STORE_PATH` | vuoto, cioè `state.db` in `data.dir` |
| `store.synchronous` | `HOTLOOP_FLOW_STORE_SYNCHRONOUS` | `normal`. `full` fa fsync a ogni commit e consuma la scheda. |
| `store.context.persist` | `HOTLOOP_FLOW_CONTEXT_PERSIST` | `true` |
| `store.context.flushInterval` | `HOTLOOP_FLOW_CONTEXT_FLUSH_INTERVAL` | `30s`. `0s` scrive ogni modifica prima che il flusso proceda. |
| `store.durable.maxBytes` | `HOTLOOP_FLOW_DURABLE_MAX_BYTES` | 256 MiB per tutti i collegamenti durevoli insieme |
| `store.durable.ackFlush` | `HOTLOOP_FLOW_DURABLE_ACK_FLUSH` | `100ms`. `0s` segna ogni messaggio prima che venga inviato il successivo. |
| `trace.enabled`, `trace.traces`, `trace.maxHops`, `trace.maxMessageBytes`, `trace.maxBytes`, `trace.perSecond` | | `true`, 256, 512, 16384, 16 MiB, 1000. `perSecond: 0` traccia ogni messaggio. |
| `trace.otlp.endpoint`, `trace.otlp.serviceName`, `trace.otlp.interval` | `HOTLOOP_FLOW_TRACE_OTLP_ENDPOINT` | vuoto (nessuna esportazione), `hotloop-flow`, `2s` |
| `trace.otlp.headersSecret` (chart) | `HOTLOOP_FLOW_TRACE_OTLP_HEADERS` | nessuno. Una chiave di Secret con coppie `Name=value` separate da virgole, per la chiave API di un collector ospitato. |

Il chart ha tutto questo sotto `store` e `trace` in `values.yaml`.

Immagine: `ghcr.io/hotloop-io/hotloop-flow:2.2.0`, linux/amd64 e linux/arm64. Chart: `https://hotloop.io/hotloop-flow/`. Il README di questo tag contiene il resto: https://github.com/HotLoop-io/hotloop-flow/blob/v2.2.0/README.md
