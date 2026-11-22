---
title: "Tracciamento e replay"
description: "Clicca un messaggio di debug e vedi dove è andato, riproducilo in una bozza, trasforma una traccia in test e invia gli span a OpenTelemetry."
---

Un valore va storto alle 2 di notte e il pannello di debug ti dice il valore. Non ti dice quale dei nove nodi attraversati lo ha cambiato, quanto tempo lo ha trattenuto quello lento, né che aspetto aveva in ingresso. Lo scopri sparpagliando nodi Debug nel flusso, facendo il deploy, aspettando che riaccada e togliendoli.

Per questo ogni messaggio che entra nel flusso riceve una traccia. Ogni messaggio di debug nel pannello ha un pulsante **Trace**, e un clic illumina sulla tela il percorso fatto da quel messaggio: i nodi attraversati, i fili percorsi, e tutto ciò che non ha mai toccato attenuato. Ogni nodo del percorso indica per quanto tempo ha avuto il messaggio (`8.3 µs`, oppure `8.3 µs ×3` quando ne ha gestito tre pezzi), e il pannello Trace accanto elenca ogni passaggio in ordine con il messaggio così come quel nodo lo ha ricevuto. Clicca una riga e sei sul nodo. Un passaggio fallito è rosso, con l'errore sotto.

Segue il messaggio dove va davvero:

- **Attraverso uno Split.** Una lettura diventa tre, e tutte e tre sono nella traccia, ciascuna come passaggio proprio in ogni nodo dopo la divisione.
- **Attraverso un Join.** Il passaggio dopo un Join ha come genitori tutti i messaggi che il Join ha accolto per lui, non solo quello arrivato per ultimo. I tre rami che lo hanno alimentato sono tutti illuminati.
- **Attraverso un sottoflusso.** I nodi all'interno girano come copie con id propri, e i passaggi sono annotati sotto quegli id. La tela illumina l'istanza del sottoflusso, perché è il nodo della scheda che stai guardando.
- **Dentro un Catch.** Il nodo che ha fallito ha l'errore sul suo passaggio, e il Catch che lo ha ricevuto è il passaggio successivo, segnato come raggiunto da un errore.

La traccia viaggia con il messaggio ma non è nel messaggio. Nessun flusso può leggerla o romperla con `msg = {...}`, e non compare mai in un nodo Debug, in un test o in un payload sul filo.

## Non può crescere

Gira sulla linea che sorveglia, quindi ogni direzione ha un limite, e i limiti sono sotto `trace:` nella [configurazione](/it/flow/configuration/):

| Limite | Predefinito |
|---|---|
| Tracce conservate, le più recenti | 256 |
| Passaggi che una traccia conserva, così un ciclo non può annotarsi all'infinito | 512 |
| Messaggio più grande di cui un passaggio conserva una copia | 16 KiB |
| Tutto insieme, contato in modo approssimativo, si dimentica prima il più vecchio | 16 MiB |
| Nuove tracce avviate in un secondo | 1,000 |

Un messaggio oltre i 16 KiB conserva i suoi tempi ed è segnato come troppo grande per essere mostrato, e non può essere riprodotto né trasformato in test. Oltre le 1,000 nuove tracce al secondo, i messaggi restanti di quel secondo restano senza traccia, perché un sensore che parla centomila volte al secondo altrimenti pagherebbe una traccia per ciascuno. Un messaggio saltato, o la cui traccia è stata espulsa mentre era ancora in viaggio, resta senza traccia per il resto del suo percorso; avviare una nuova traccia a metà strada riempirebbe il buffer solo con le code di viaggi di cui non esistono più le teste. Tutto è contato su `/metrics`, così puoi vedere quando succede.

La prova di resistenza: **un milione di messaggi attraverso cinque nodi, 2026-10-18**, sulla stessa macchina dei [numeri qui sopra](/it/flow/overview/#i-numeri). Heap dopo un GC forzato, rilevato ogni centomila messaggi:

| Tracciamento | Heap, a ogni punto di controllo | Messaggi al secondo |
|---|---|---|
| Tracciamento disattivato | **1.3 MiB** | 192,596 |
| Tracciamento di ogni messaggio (`perSecond: 0`) | **2.7 MiB** | 115,770 |
| Limiti predefiniti | **4.0 MiB** | 195,199 |

È lo stesso numero in tutti e dieci i punti di controllo. Il tracciatore ha tenuto 808,448 byte in 256 tracce dal primo punto di controllo all'ultimo, ha dimenticato 999,744 messaggi del milione lungo la strada, e non si è mai avvicinato ai suoi 16 MiB. Tracciare ogni messaggio ha un costo: ha portato questa catena da 192k al secondo a 116k. È per questo che esiste il limite predefinito. A 1,000 tracce al secondo il costo si perde nel rumore, e sotto quella soglia una traccia pesa circa 3 KB. Se vuoi comunque ogni messaggio, imposta `perSecond: 0` e leggi la prima riga di quella tabella prima di decidere. Riproducilo con:

Se l'heap smette di essere piatto, il test fallisce.

## Riproducilo in una bozza

Hai trovato il valore sbagliato, pensi di conoscere la correzione e hai cambiato un nodo sulla tela. Non fare il deploy per scoprirlo. **Replay into draft** prende il messaggio che ha avviato la traccia, lo immette nel flusso così com'è ora sulla tua tela, distribuito o no, e ti dice dove finisce rispetto a dove era finito la prima volta.

"Finisce" indica i luoghi in cui il messaggio si è fermato: un nodo Debug, un MQTT Out, uno Switch che non ha trovato corrispondenza, un Join ancora in attesa. Per ciascuno il confronto dice che è uguale, oppure quali proprietà sono cambiate (`payload: "HIGH" -> "CRITICAL"`), oppure che l'originale è finito lì e il replay no, o il contrario. Il percorso del replay stesso è illuminato sulla tela, così vedi dove lo ha mandato la bozza. **Back to the original trace** rimette la prima.

Gira come gira un [test di flusso](/it/flow/tests/), in un processo figlio con il vero runtime e i veri nodi, e per lo stesso motivo: la tua bozza avvia ogni nodo e nulla può toccare l'impianto. Significa che un nodo che avrebbe chiamato un servizio web risponde con niente, quindi un flusso la cui uscita dipende da una risposta emerge come una differenza. È il risultato onesto. Non fingerà di aver parlato con un PLC con cui non ha mai parlato.

## Una traccia diventa un test

**Make test** nel pannello Trace redige un [test di flusso](/it/flow/tests/#test-dalleditor) dall'intera traccia: il messaggio che l'ha avviata, immesso nella sorgente da cui è entrato, e ogni punto in cui è finito che un test può osservare, con ciò che quel nodo ha ricevuto atteso lì. Sono gli stessi due clic di un test da un messaggio di debug, ed è meglio per i flussi complicati, perché una traccia ricorda ogni estremità raggiunta da un messaggio. Una divisione in tre nodi Debug sono tre attese, dove un messaggio di debug era una.

Dice il perché quando non può. Una traccia nata dentro un sottoflusso, dalla seconda uscita di una sorgente o da un messaggio troppo grande per essere conservato non può essere rimessa come serve a un test. E un messaggio scartato da uno Switch non finisce in nessun luogo osservabile da un test, quindi viene rifiutato invece di essere scritto come test vuoto, perché un test senza nulla da verificare passa.

## OpenTelemetry

Puntalo a un collettore e ogni passaggio esce come span:

```yaml
trace:
  otlp:
    endpoint: http://collector:4318   # OTLP over HTTP; /v1/traces is added
    headers: {x-api-key: ...}         # if the collector wants one
    serviceName: hotloop-flow
```

Una traccia è una traccia OpenTelemetry e un passaggio è uno span, con il passaggio che ha inviato il messaggio come genitore. Lo span di un Join ha il primo come genitore e gli altri come collegamenti. Ogni span porta l'id del nodo, il tipo di nodo, l'id del messaggio, quanti messaggi il nodo ha inviato e la porta di uscita da cui è stato raggiunto, e un errore è uno span con stato di errore. **I messaggi non escono mai.** Un payload è il dato di un impianto e un collettore è il server di qualcun altro, quindi ciò che esce è la forma del percorso e i suoi tempi.

Parla OTLP/HTTP con la codifica JSON definita dalla specifica, scritta a mano in un solo file, invece di includere l'SDK OpenTelemetry con il suo protobuf e gRPC per fare lo stesso singolo POST. Il binario ha un budget di dimensione e non lo spendiamo per questo. Ogni id di span, genitore, collegamento, nome, attributo e stato di errore deve corrispondere. In quel test non c'è alcun mock. Se il collettore è fuori uso, l'esportazione scarta gli span e li conta, e il flusso non se ne accorge; `hotloop_flow_otlp_spans_failed_total` che supera zero è il modo in cui lo scopri.
