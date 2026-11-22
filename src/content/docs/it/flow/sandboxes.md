---
title: "Due sandbox in HotLoop Flow"
description: "Come sono recintati il nodo Function e la sandbox WebAssembly, che cosa può toccare ciascuno e come gira un plugin nella seconda."
---

Il nodo Function gira sull'interprete JavaScript (vedere [Postura di sicurezza](/it/flow/security/)). Una chiamata costa da 11.6 a 13.7 µs. Non è un confine rispetto alla memoria: una funzione che alloca in un ciclo fa crescere l'heap di Go finché il pod muore, e tutto ciò che l'interprete JavaScript può fare è un timeout a tempo reale.

Costa da 184 a 196 µs a chiamata, da quindici a sedici volte una chiamata all'interprete JavaScript. Vale la pena esattamente quando si esegue codice di cui non ci si fida del tutto, e non altrimenti.

Un flusso esegue un guest WASM tramite un plugin: un modulo firmato con un descrittore da cui l'editor disegna la propria finestra, che non ottiene alcun accesso all'host se non lo chiede e non si risponde di sì. La memoria ha un tetto per nodo, un messaggio ha un timeout, e un guest che supera uno dei due si interrompe, arriva a un nodo Catch con il motivo e non trascina giù nient'altro. Tutto è in [Plugin senza npm](/it/flow/plugins/), compreso come ci si fida della chiave di un editore e che cosa dicono i rifiuti. Che cosa significa per chi lo usa: ciò per cui Node-RED richiede npm e un'intera installazione di Node.js, Flow lo esegue come un file isolato che si può verificare prima del caricamento.

Un plugin può essere scritto in Rust, TinyGo, Zig o AssemblyScript invece che in JavaScript, così l'elaborazione del segnale che un flusso OT vuole davvero gira compilata, con un tetto di memoria con cui non si discute.

L'ABI del guest è fatta di tre export, due dei quali sono hook dell'allocatore, ed è piccola di proposito. Ogni export è superficie d'attacco, e una cosa in più che ogni autore di guest deve fare bene.

| Export | Firma | Obbligatorio |
|---|---|---|
| `hotloop_flow_process` | `(ptr i32, len i32) -> i64` | sì |
| `hotloop_flow_alloc` | `(size i32) -> i32` | sì |
| `hotloop_flow_free` | `(ptr i32, size i32)` | no |

Il risultato `i64` impacchetta un offset nei 32 bit alti e una lunghezza nei 32 bassi, e punta a una risposta JSON nella memoria del guest stesso. Tutto attraversa come JSON, quindi un guest in qualsiasi linguaggio può produrlo senza un compilatore di schemi condiviso.

I limiti sono piccoli di proposito. Questo gira su hardware edge accanto ai flussi che contano davvero, e un nodo che ha bisogno di più dovrebbe doverlo dire:

| Limite | l'interprete JavaScript | WASM |
|---|---|---|
| Timeout per chiamata | 5 s | 5 s |
| Tetto di memoria | nessuno applicabile | 16 MiB a nodo salvo diversa indicazione del plugin, 64 MiB al massimo salvo che si alzi `plugins.maxMemoryMiB`, rigido |
| Output massimo | 16 MiB | 8 MiB |

Entrambi i runtime sono Go puro, senza cgo.
