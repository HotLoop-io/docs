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
| La variabile **Invisible** di un elemento (`bInvisible`), o quella del suo gruppo | una regola `show` sul simbolo: viene disegnato solo finché la variabile dice che l'elemento sarebbe visibile (`NOT x` lo capovolge) |
| La variabile **Toggle color** di un elemento | una regola `colors` sul simbolo: finché la variabile è attiva viene dipinto con il tono più vicino al colore di allarme dell'elemento (il rosso è `bad`, il giallo e l'arancione `warn`, il blu `info`, il verde `ok`; un elemento senza un proprio colore di allarme è `bad`, come la cornice di allarme predefinita di CODESYS è rossa) |

Ogni elemento mantiene la sua posizione in pixel: la pagina è la scheda dei simboli, disegnata come un'unica immagine scalata, quindi la schermata mantiene la sua forma a qualsiasi dimensione e su un telefono.

## Cosa non passa

Detto nell'importazione, una riga ciascuno, mai scartato in silenzio:

* un tipo di elemento senza simbolo HotLoop (un grafico di tracce, una tabella, un cursore, un elemento immagine e il resto della casella degli strumenti),
* una variabile che è un'espressione (`Temp * 2`, `a AND b`, un elemento di array): HotLoop mostra un tag, quindi aggiungete un tag per l'espressione e puntate una lettura su di esso,
* una variabile di invisibilità o di cambio colore su una forma disegnata nell'immagine di sfondo (una tubazione, un recipiente, una cornice): l'immagine è una sola, quindi la forma c'è sempre e mantiene il suo colore. Detto nell'importazione, con la variabile,
* qualsiasi altra impostazione guidata da un valore del PLC (una variabile di colore per riempimento, cornice o testo, un movimento, un lampeggio, un elenco di testi): il simbolo c'è com'era disegnato, e la regola viene segnalata quando la sua variabile è una variabile semplice,
* una curva di Bézier viene disegnata come linee rette tra i suoi punti, e un elemento ruotato non viene ruotato,
* la dimensione della pagina, che l'esportazione non contiene: la pagina è grande quanto l'elemento più esterno, più un margine,
* il testo più lungo di 40 caratteri viene tagliato, e i quadranti sono numeri, non quadranti.

Gli stili di testo, i caratteri e i colori dello stile CODESYS sono quelli di HotLoop: la schermata segue il tema di HotLoop.

## Come legge il file

CODESYS documenta che l'esportazione nativa esiste ed è XML, e non documenta cosa contiene. Il lettore qui segue ciò che scrive l'IDE stesso (CODESYS 3.5 SP22, Visualization 4.10): ogni elemento memorizza le sue impostazioni come un elenco di membri numerati, e il numero è il CRC-32 del percorso del membro nella descrizione dell'elemento, come `m_StaticPosition.iX`, che l'IDE installa accanto a sé. Gli alberi degli elementi dell'IDE elencano ogni percorso con il suo id (`ITypeNode.CompletePath` e `CRCIdNumber`); gli id della variabile di invisibilità (`m_pStateVariables..State.bInvisible`, 2880254039) e della variabile di cambio colore (`m_pColorVariables..ToggleColor`, 1999528970) vengono da lì, e il primo è l'id con cui l'esempio Refrigerator di CODESYS memorizza il `NOT Glob_Var.DoorOpen` del suo gruppo. I test contengono valori letti dall'esportazione dell'IDE stesso. Un'impostazione che porta una variabile e non viene letta è segnalata come sopra, così una schermata non viene mai importata come completa quando non lo è.

## Il passo successivo

Aprite la schermata, controllate le letture rispetto all'impianto e mettete le schede setpoint e pulsante dove i vostri operatori se le aspettano. Una schermata costruita a mano e una importata sono la stessa cosa da qui in poi: si esporta come [file di schermata](/it/iot/screen-file/), si versiona a ogni salvataggio e passa a un'altra installazione allo stesso modo.

## Visualizzazioni TwinCAT (.TcVIS)

Un file `.TcVIS` di TwinCAT è la stessa visualizzazione nell'XML d'archivio degli oggetti dell'IDE, con gli stessi tipi di elemento e gli stessi id dei membri, quindi passa per lo stesso convertitore. Verificato con il vero esempio PackML di TwinCAT.

- Pulsanti: ogni semplice assegnazione nell'azione di input di un pulsante (`X := 5`, `X := TRUE`, `X := E_PMLCommand.ePMLCommand_Start`) diventa una scheda pulsante che scrive quel valore in X, e la didascalia passa come etichetta. Un input Toggle configurato diventa la coppia di pulsanti, acceso e spento. Il codice che è più di un'assegnazione (una condizione, una chiamata, un calcolo) viene segnalato con il suo testo.
- Enumerazioni: i membri OMAC PackML (`E_PMLCommand`, `E_PMLUnitMode`) sono noti, con i numeri della configurazione PackML_HMI_Example di Beckhoff e della dichiarazione `E_PMLUnitMode` di SPT-Libraries. Qualsiasi altra enumerazione va negli `enums` dell'importazione (`{"E_Own.eOwn_Go": 7}`). Un membro senza numero noto viene scritto con il suo nome e il rapporto lo dice.
- Espressioni: la variabile di una lampada e una variabile di invisibilità possono essere un confronto di un tag con un numero, TRUE, FALSE o un membro di enumerazione (`=`, `<>`, `<`, `<=`, `>`, `>=`), NOT, AND e OR, con parentesi. Diventano una regola del simbolo (vedi DASHBOARDS.md: la regola `lit` di una lampada, le regole `show` e `colors` di un simbolo, che possono combinare regole con `all` e `any`). Un confronto tra due tag, un calcolo e le chiamate non si possono esprimere e vengono segnalati con la parte che non si è potuta.
- Cornici: una cornice mostra un'altra visualizzazione. Invia gli altri file del progetto insieme al primo (`codesysRelated` nell'API; nella finestra di dialogo, scegli più file e il primo è la schermata). La visualizzazione della cornice viene collocata nella cornice, con ogni input che prende collegato alla variabile data alla cornice (l'`HMI` di V_Module diventa `MAIN.VFFSDemo.Sealer.PackMLBaseModule_HMI`). Una cornice la cui visualizzazione non è tra i file viene segnalata con il suo nome.

L'insieme PackML (V_Main con V_Module e V_MachineModule): 60 elementi mappati, nessuno non mappato.
