---
title: "Back-pressure, in piena vista"
description: "Un tetto su ogni coda, una regola per ciò che accade al tetto e un grafico di ogni messaggio che non ci è stato, prima che diventi un arresto per memoria."
---

Questo è l'intero progetto. Il guasto tipico di un motore di flussi su un box edge è un pod che si gonfia in silenzio finché il kubelet lo uccide, e il log che lascia non spiega nulla a chi ha il cercapersone in mano. Per questo ogni punto in cui un messaggio o un byte può accumularsi ha un tetto, e ogni tetto è una decisione scritta e documentata in [Compatibilità con Node-RED](/it/flow/compatibility/), non un limite che abbiamo scelto senza mai citarlo.

| Cosa può accumularsi | Cosa lo ferma |
|---|---|
| La casella in ingresso di un nodo | Un tetto (1024 per impostazione predefinita) e una di quattro politiche di overflow |
| Code di ritardo e di limitazione della frequenza | Un tetto; oltre quello il messaggio è rifiutato verso un nodo Catch |
| Timer di Trigger | Un tetto |
| Output di `exec` | Limitato per stream; il troncamento solleva un errore |
| Processi `exec` | Un limite di concorrenza; oltre quello vengono rifiutati |
| Letture di file | Limitate, con modalità per riga e a blocchi |
| Corpi delle richieste HTTP | Limitati |
| Attesa di una risposta HTTP | Un 504 dopo un timeout |
| Connessioni e frame TCP | Delimitati |
| Code di invio WebSocket | Delimitate; un client lento viene disconnesso |

Le politiche di overflow, impostate globalmente e modificabili per nodo:

| Politica | Cosa succede |
|---|---|
| `block` | Il mittente attende che ci sia spazio, fino a `blockTimeout`. La back-pressure risale a monte, che è quasi sempre la risposta giusta. |
| `drop-newest` | Il messaggio in arrivo viene scartato. Contato e annunciato. |
| `drop-oldest` | La testa della coda esce per fare spazio. Contato e annunciato. Per "conta solo l'ultima lettura". |
| `error` | L'invio è rifiutato e sollevato a un nodo Catch, così decide il flusso. |

Niente viene buttato via in silenzio. Ogni scarto è contato, inviato all'editor come evento ed esportato come metrica su cui puoi impostare un allarme. Quando un limite morde, lo scopri da un grafico, non da un operatore.

## Una goroutine per nodo

Ogni istanza di nodo ha la propria goroutine e la propria casella in ingresso. Ordinato dentro un nodo, parallelo tra i nodi. Un nodo Function che fa lavoro vero occupa un core mentre l'editor, l'API, il websocket e tutti gli altri flussi continuano a muoversi.

## Ogni destinatario riceve la propria copia

Quando un filo si dirama, ogni nodo all'altra estremità riceve la propria copia del messaggio, così due rami che credono di possederlo non possono corromperlo a vicenda, e un ramo non si comporta mai in modo diverso dai suoi gemelli solo per l'ordine in cui li hai collegati. È un bug che si riproduce i martedì, e qui non esiste.

Non è gratis. Copiare un messaggio piccolo (una lettura e un topic) costa da 411 a 453 ns e 680 byte, e una catena di cinque nodi sposta un messaggio ogni 1,14 o 1,40 µs, copie incluse. Dove copiare fa male è con un grande payload binario: un buffer da 1 MiB costa da 128 a 156 µs e un altro megabyte sull'heap per ogni destinatario. Quindi i grandi payload binari viaggiano come `ImmutableBytes`, che condivide il buffer invece di copiarlo: **da 250 a 279 ns e 360 byte per lo stesso messaggio da 1 MiB.** I nodi file e HTTP consegnano già così i payload binari, quindi lo ottieni senza chiederlo.

## Un contesto che sa contare

Il contesto di flusso e quello globale hanno `get` e `set`, e anche `CompareAndSwap`, `Increment` e `Update`. Due rami che fanno get-modify-set su un solo contatore si contendono il valore e perdono aggiornamenti, e con get e set soltanto non c'è nulla da fare. Con `Increment` non c'è nulla da contendere.

E sopravvive a un riavvio. Il contesto di flusso, globale e di nodo vive in un file SQLite sul volume, caricato la prima volta che si usa un ambito e scritto in differita, così un contatore o un latch in un flusso è dove l'hai lasciato quando il pod torna. Le operazioni atomiche sono lo stesso codice di prima. Le modifiche sono raggruppate in una scrittura ogni trenta secondi e un valore impostato a ciò che era già non scrive nulla, perché ci importa di più di cosa questo fa a una scheda SD che di fare i furbi. Un arresto pulito scrive tutto; un `kill -9` perde fino a quei trenta secondi, e `store.context.flushInterval` è la manopola. I dettagli, e cosa costa a una scheda, sono in [docs/durable](/it/flow/durable-state/).
