---
title: "Note di rilascio: HotLoop Flow 2.7.0"
description: "Cosa porta HotLoop Flow 2.7.0, cosa cambia con l'aggiornamento e cosa leggere prima di toccare un impianto in funzione."
sidebar:
  label: "2.7.0"
---

HotLoop Flow 2.7.0 è il primo taglio di FlowLab, un secondo modo di eseguire una scheda per banchi di prova e data logger. I flussi girano esattamente come prima, e un file di flussi che hai oggi si carica e si salva byte per byte. FlowLab parte solo quando gli aggiungi una scheda, quindi se non lo fai, l'unica cosa che cambia per te è la correzione delle sessioni, l'ultima voce qui sotto.

## Novità

**Diagrammi FlowLab.** Un diagramma è una scheda in cui ogni nodo viene eseguito una volta, quando ogni ingresso collegato ha un valore, e due nodi senza collegamento tra loro girano nello stesso momento. Aggiungine uno con il nuovo pulsante FlowLab accanto al pulsante del sottoflusso. Riceve una barra sopra la tela con Esegui e Ferma, e tutto ciò che disegna sta sui collegamenti: l'ultimo valore su ogni collegamento dopo un'esecuzione, una sonda su qualsiasi collegamento che conserva gli ultimi 100 valori e un breakpoint su un nodo o un collegamento. Pausa, entra, supera ed esci funzionano nodo per nodo, ed evidenzia esecuzione la rallenta quanto basta per seguirla e si spegne da sola dopo dieci minuti. Niente del debug cambia ciò che fa un'esecuzione, e un test verifica che un'esecuzione con una sonda finisca con lo stesso valore su ogni collegamento di una senza.

**Cosa c'è nella scatola.** Cicli while e for con valori portati da un passaggio al successivo, un ciclo for su un conteggio o un array, e un collegamento di errore: un nodo che riceve un errore non fa nulla e lo passa oltre, e un errore collegato a un ciclo lo ferma con l'origine e un codice sull'uscita di errore del ciclo. Un collegamento `after` stabilisce l'ordine di due nodi che non condividono dati. Ci sono 21 tipi di nodo nella nuova sezione FlowLab della tavolozza: costante, matematica, confronto, logica, attesa, raggruppa, campo, costruisci array, i due cicli con il loro ingresso e uscita del corpo, una porta seriale con lettura e scrittura, un analizzatore di letture, un rilevatore di valore stabile, un log su file di testo, e un controllo, un indicatore e un grafico per il pannello. docs/diagrams.md li descrive tutti.

**Un pannello che un operatore può aprire sul telefono.** `/panel/<diagram id>` fa accedere come l'editor e mostra i controlli, gli indicatori e i grafici del diagramma mentre un'esecuzione è attiva. Un grafico conserva gli ultimi 1.024 punti a meno che tu non lo cambi e conta ciò che ha lasciato andare. Un controllo viene verificato sul server rispetto al suo tipo, intervallo e scelte, e chi lo ha impostato finisce nel registro di audit.

**Una porta seriale che sopravvive a un cavo staccato.** Una lettura che non riceve nulla, o una porta che scompare, è un guasto sul collegamento di errore. La lettura successiva prova a riaprire la porta una volta al secondo, e conta la perdita e il ritorno. L'esempio in `examples/diagram-scale-logger` legge una bilancia, analizza peso e unità, dice quando le ultime cinque letture concordano, mostra tutto sul pannello con un grafico di andamento e lo aggiunge a un file CSV. Imposta `autostart` sulla scheda e gira senza nessun browser aperto, e di nuovo dopo ogni deploy.

**Nuova API.** `GET /diagrams`, `GET /diagrams/{id}`, e `POST` per `run`, `stop` e `debug`, `PUT` per `controls/{node}`, `breakpoints` e `probes`. La lettura richiede `status.read`. Eseguire, fermare, impostare un controllo e fare debug richiedono un nuovo permesso, `diagram.run`, e ognuno finisce nel registro di audit con chi l'ha fatto.

**Le sessioni non vengono sovrascritte da una lettura fallita.** Un file di sessioni che esiste ma non si può leggere, un errore di I/O o un volume comparso in ritardo, non viene più sostituito dall'accesso successivo, e un file con JSON illeggibile viene conservato accanto all'originale invece di andare perso.

## Cosa è cambiato

- Una scheda che porta `ew_diagram` resta fuori dal runtime dei messaggi. Ogni altra scheda gira come prima. Le nuove chiavi sono `ew_diagram` sulla scheda e `ew_in` su un nodo, e entrambe sopravvivono al ciclo di andata e ritorno, che due nuovi test e quello vecchio verificano.
- Il README contava 79 tipi di nodo e "circa 36.000 righe di Go", ed erano entrambi superati. Ora dice 79 tipi di nodo per i messaggi e 21 per FlowLab.
- Il test del nodo client MCP di HotLoop ora scrive attraverso il blocco di HotLoop, perché HotLoop distribuisce le sue scritture MCP attive.
- Un deploy riavvia l'esecuzione di ogni diagramma, anche di uno che non ha modificato.
- FlowLab ha aggiunto circa 370 KB al binario, misurati su una macchina prima e dopo. Il binario è di 41,4 MB e l'immagine amd64 di 45,34 MB.
- Le immagini del README sono state rifatte per il nuovo pulsante e la nuova sezione della tavolozza.

## Nuove impostazioni

Nessuno. Il permesso `diagram.run` è nuovo. Un utente la cui lista di permessi è `["*"]` lo ha. Chi ha una lista esplicita può leggere un diagramma e il suo pannello con `status.read` e non può eseguirne uno finché non aggiungi `diagram.run`.

## Aggiornamento

Su amd64, un semplice `helm upgrade` all'immagine e al chart della 2.7.0; su arm64 resta dove sei fino alla 2.7.1, oppure usa il nuovo tag nella tua unità Quadlet. Al primo avvio non succede nulla, non c'è niente da migrare, e i tuoi flussi, i record di deploy e le credenziali non vengono toccati. Se torni indietro dopo aver salvato un file di flussi con un diagramma, la build precedente conserva il file byte per byte e dice `unknown node type` per ogni nodo FlowLab, che quindi non girano. L'abbiamo verificato contro la build precedente a questa.

Immagine: `ghcr.io/hotloop-io/hotloop-flow:2.7.0`, solo linux/amd64. Costruiamo prima l'amd64, lo lasciamo consolidare come stabile in produzione e poi una piccola 2.7.1 senza altro aggiunge l'arm64. Fino ad allora, il tag `2` contiene la nuova immagine amd64 e l'immagine arm64 della 2.6.0, quindi una macchina arm64 che segue `2` o `2.6` mantiene ciò che ha, e una macchina fissata a `2.7.0` ha bisogno di amd64. Chart: `https://hotloop.io/hotloop-flow/`. Il README di questo tag ha il resto, con le immagini: https://github.com/HotLoop-io/hotloop-flow/blob/v2.7.0/README.md
