---
title: "Importare una schermata CODESYS"
description: "Esportate una visualizzazione CODESYS dall'IDE e importatela come schermata HotLoop sulle variabili del PLC, con gli elementi non collocati in testa."
---

I vostri operatori hanno già una schermata CODESYS. Esportatela dall'IDE, importatela in HotLoop e si apre come schermata HotLoop sulle variabili dello stesso PLC. È la via per uscire da WebVisu: il PLC continua a eseguire il suo programma, HotLoop lo legge tramite il connettore OPC UA e la schermata è di HotLoop. HotLoop for CODESYS esegue Edge, quindi questa è anche la sua importazione.

## Come si usa

Nell'IDE CODESYS selezionate la visualizzazione nell'albero del progetto e usate **Progetto, Esporta** (l'esportazione nativa di CODESYS, un file `.export`). Non **Esporta PLCopenXML**: quel file non contiene alcuna visualizzazione, e HotLoop lo dice se lo scegliete.

Nella schermata Dashboard, **Importa**, scegliete il file `.export`, **Leggi il file**. Vi dice:

* la visualizzazione trovata (un file con più visualizzazioni vi chiede quale),
* ogni tag che la schermata legge e che questa installazione non ha. Le variabili arrivano come `plc/<GVL>.<variable>`: associate il dispositivo `plc` al dispositivo HotLoop su cui si trova il PLC e tutti i tag si spostano insieme, oppure associate i tag uno per uno,
* **da controllare**: ogni elemento che non ha potuto mettere sulla schermata, con il motivo, prima che qualcosa venga salvato.

Nulla viene salvato finché c'è qualcosa di mezzo. Importare richiede `dashboards.write`, e un pulsante o un setpoint su un tag non marcato come scrivibile viene rifiutato qui, come in una costruzione, così la schermata non ha mai un comando che la porta rifiuterebbe.

Tramite l'API è `POST /api/dashboards/import` con `codesys` (il testo del file) al posto di `file`, e `visualization` per indicarne una tra più:

```json
{"codesys": "<ExportFile>...", "visualization": "Overview", "dryRun": true,
 "remap": {"devices": {"plc": "line-3"}}}
```

Il rapporto ha i consueti `problems`, `warnings` e `remapped`, e un `conversion` con `mapped` (ogni elemento e in cosa è diventato) e `unmapped` (ogni elemento e perché no).

## Cosa passa

| Elemento CODESYS | In HotLoop |
|---|---|
| Rettangolo, rettangolo arrotondato, ellisse con testo e una variabile (`Temperature: %2.1f C`) | una lettura: il tag della variabile, il testo prima come didascalia, il testo dopo come unità, i decimali dal formato |
| Lo stesso con testo e senza variabile | un'etichetta |
| Lampada | una lampada, accesa dalla variabile e colorata dal colore proprio della lampada (rosso è un guasto, giallo un avviso, blu un'informazione, qualsiasi altro una lampada di marcia). `NOT x` legge il tag al contrario |
| Indicatore, potenziometro | una lettura della variabile. Una manopola che impostava un valore ottiene anche una scheda setpoint con la scala del quadrante come limiti |
| Interruttore a bilanciere, interruttore a levetta, pulsante | una lampada che mostra lo stato e una scheda pulsante: acceso e spento per un interruttore, il valore unico per un tocco |
| Poligono, polilinea e forme senza testo e senza variabile (le tubazioni, il serbatoio, le cornici) | l'immagine dietro i simboli, disegnata dai loro punti e colori |
| Gruppo | i suoi membri, posizionati a partire dall'angolo del gruppo |

Ogni elemento mantiene la sua posizione in pixel: la pagina è la scheda dei simboli, disegnata come un'unica immagine scalata, quindi la schermata mantiene la sua forma a qualsiasi dimensione e su un telefono.

## Cosa non passa

Detto nell'importazione, una riga ciascuno, mai scartato in silenzio:

* un tipo di elemento senza simbolo HotLoop (un grafico di tracce, una tabella, un cursore, un elemento immagine e il resto della casella degli strumenti),
* una variabile che è un'espressione (`Temp * 2`, `a AND b`, un elemento di array): HotLoop mostra un tag, quindi aggiungete un tag per l'espressione e puntate una lettura su di esso,
* una regola di visibilità, colore o movimento guidata da un valore del PLC: il simbolo è sempre lì e non cambia colore,
* una curva di Bézier viene disegnata come linee rette tra i suoi punti, e un elemento ruotato non viene ruotato,
* la dimensione della pagina, che l'esportazione non contiene: la pagina è grande quanto l'elemento più esterno, più un margine,
* il testo più lungo di 40 caratteri viene tagliato, e i quadranti sono numeri, non quadranti.

Gli stili di testo, i caratteri e i colori dello stile CODESYS sono quelli di HotLoop: la schermata segue il tema di HotLoop.

## Come legge il file

CODESYS documenta che l'esportazione nativa esiste ed è XML, e non documenta cosa contiene. Il lettore qui segue ciò che scrive l'IDE stesso (CODESYS 3.5 SP22, Visualization 4.10): ogni elemento memorizza le sue impostazioni come un elenco di membri numerati, e il numero è il CRC-32 del percorso del membro nella descrizione dell'elemento, come `m_StaticPosition.iX`, che l'IDE installa accanto a sé. I test contengono valori letti dall'esportazione dell'IDE stesso. Un'impostazione che porta una variabile e non viene letta viene segnalata come sopra, così una schermata non viene mai importata come completa quando non lo è.

## Il passo successivo

Aprite la schermata, controllate le letture rispetto all'impianto e mettete le schede setpoint e pulsante dove i vostri operatori se le aspettano. Una schermata costruita a mano e una importata sono la stessa cosa da qui in poi: si esporta come [file di schermata](/it/iot/screen-file/), si versiona a ogni salvataggio e passa a un'altra installazione allo stesso modo.
