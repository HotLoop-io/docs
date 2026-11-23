---
title: "Dashboard per ruolo"
description: "Pagine di schede per ruolo o per schermo: indicatori, andamenti, elenchi di entità e pulsanti, con lo stesso layout su PC da pannello, portatile e telefono."
---

Una dashboard è una pagina di schede che qualcuno ha costruito. Indicatori, andamenti, elenchi di entità, un pulsante che avvia la pompa, una planimetria con le temperature messe dove sono le zone. Costruiscine quante ne servono allo stabilimento, assegna ciascuna ai ruoli che ne hanno bisogno o all'unico schermo su cui vive, e la vecchia Board è solo una di esse.

Si trova in HotLoop IoT, Edge e Gateway. L'Edge Relay non ha interfaccia né dashboard. L'HMI di Edge è costruita con questa pagina e nient'altro, ed è per questo che il resto è com'è.

## Perché è costruita così

**Una scheda non comanda nulla.** La prima domanda di progetto per qualsiasi pagina di pulsanti è se la pagina sia un secondo modo di condurre lo stabilimento. Non lo è. Una scheda nomina un tag, un'entità, uno script o una ricetta, e il browser ne fa ciò che ne fa ogni altra schermata. Un pulsante di scrittura invia `POST /api/write`. I controlli di un'entità chiamano `POST /api/services`. Un pulsante di script apre la richiesta di esecuzione della schermata Script e una scheda ricetta apre il pannello di applicazione della schermata Ricette. Ognuna di queste azioni ha il proprio permesso e incontra il cancello di scrittura, quindi nemmeno una dashboard può essere un modo per aggirarlo. Ciò che protegge `dashboards.write` è chi decide che cosa sono i pulsanti, che è una scelta da ingegnere ed è riservata agli amministratori per lo stesso motivo per cui lo è scrivere uno script.

La conseguenza: una dashboard salvata da un amministratore non fa nulla finché un operatore non preme qualcosa, e ciò che fa la pressione è esattamente ciò che fa premerlo su qualsiasi altra schermata, fino alla riga di audit.

**Un layout è un flusso, non coordinate.** Le schede vanno in ordine di lettura. Ognuna dice quanto è larga su dodici colonne e quanto è alta in righe, e non sa nulla di dove finisce. Dodici colonne su un PC da pannello, sei su un portatile con un'altra finestra accanto, due su un tablet, una su un telefono. Un layout di posizioni in pixel è giusto esattamente sullo schermo su cui è stato disegnato, e l'HMI di Edge deve essere giusta su qualunque schermo abbia la macchina.

La conseguenza: nessuno costruisce mai la versione per telefono. Non esiste.

**I salvataggi nominano la versione.** Due persone che modificano la stessa dashboard è una cosa che succede al cambio turno. Un salvataggio porta la `version` a cui è stato aperto, e uno obsoleto viene rifiutato con un `409` che dice chi è arrivato prima. Senza questo, la seconda persona che preme Salva cancella il pomeriggio della prima senza che nessuna delle due lo veda.

## Il modello

```json
{
  "id": "line-2",
  "name": "Line 2",
  "description": "The extruder, for the floor.",
  "kind": "cards",
  "roles": ["operator", "admin"],
  "homeFor": ["operator"],
  "screens": ["line-2-panel"],
  "position": 1,
  "version": 3,
  "cards": [
    {"id": "temp", "type": "gauge", "title": "Zone 1", "w": 3, "h": 3,
     "config": {"tag": "press-01/Zone1_Temp"}},
    {"id": "go", "type": "button", "w": 3, "h": 1,
     "config": {"tag": "line-02/Speed", "value": 250, "label": "Run at 250", "confirm": true}}
  ]
}
```

- **`id`** è composto da lettere minuscole, cifre, trattini e trattini bassi, e inizia con una lettera. Sta nell'indirizzo e non cambia mai. `wall` è quello della bacheca a muro.
- **`kind`** è `cards`, oppure `wall` per la bacheca a muro.
- **`roles`** sono i ruoli a cui viene offerta la dashboard. Vuoto significa tutti i ruoli. Chi possiede `dashboards.write` vede ogni dashboard qualunque cosa dica, perché deve poter sistemare quella che nessun altro riesce ad aprire. Un ruolo a cui non ne viene offerta una riceve un `404` per quel nome, così l'elenco di ciò che esiste non è qualcosa che un visualizzatore possa scoprire chiedendo.
- **`homeFor`** sono i ruoli per cui si apre quando entrano senza un indirizzo che chieda qualcosa. Un ruolo ne ha al massimo una; la dashboard deve essere offerta ai ruoli di cui è la pagina iniziale.
- **`screens`** sono gli schermi fisici a cui è destinata. Un nome di schermo appartiene a una sola dashboard.
- **`position`** ordina il selettore. Le nuove vanno per ultime.
- **`cards`** sono in ordine di lettura, fino a 60 per dashboard, 2 MB in tutto.
- **`version`** aumenta di uno a ogni salvataggio.

Una scheda è `id` (unico nella sua dashboard, generato dalla pagina), `type`, un `title` facoltativo, `w` (da 1 a 12) e `h` (da 1 a 8), e un `config` che dipende dal tipo. Ometti `w` e `h` e viene usato il valore predefinito del tipo. Un config viene controllato rigorosamente: una chiave che il tipo non ha è un errore, e ciò che viene memorizzato ha tutti i valori predefiniti compilati. Una scheda che nomina un tag, un'entità, uno script o una ricetta che non esiste viene rifiutata al salvataggio della dashboard. Anche un pulsante su un tag non marcato come scrivibile, o un pulsante il cui numero è fuori dall'intervallo del tag, viene rifiutato: il cancello rifiuterebbe ogni pressione, e a sentirlo deve essere chi lo costruisce, non chi preme.

## Le schede

| Tipo | Che cos'è | Config | Dimensione predefinita |
|---|---|---|---|
| `status` | Dispositivi attivi, tag che riportano, allarmi, historian, tempo di attività: la striscia della Board | nessuna | 12 x 1 |
| `gauge` | Un tag come il quadrante della Board, con il suo intervallo e i limiti di allarme segnati | `tag` | 3 x 3 |
| `value` | Un tag come un numero grande, colorato in base al suo stato di allarme | `tag`, `decimals` | 3 x 2 |
| `trend` | Fino a sei tag da 15 minuti a una settimana | `tags`, `minutes`, `labels` | 6 x 3 |
| `entities` | Le entità che scegli, come riquadri propri con controlli propri | `entities` (fino a 30) | 6 x 3 |
| `alarms` | L'elenco degli allarmi, con Riconosci per chi può | `outstanding`, `limit`, `devices`, `equipment` | 6 x 3 |
| `button` | Scrive un valore in un tag, dopo aver chiesto | `tag`, `value`, `label`, `confirm` | 3 x 1 |
| `script` | Esegue uno script tramite la richiesta della schermata Script | `script`, `label` | 3 x 1 |
| `recipe` | Sceglie una tra al massimo otto ricette e apre il suo pannello di applicazione | `recipes` | 4 x 2 |
| `markdown` | Testo: titoli, elenchi, grassetto, corsivo, codice, link http(s) | `text` | 4 x 2 |
| `camera` | Un'istantanea che si aggiorna, o un flusso JPEG di movimento | `url`, `stream`, `refreshSec` | 6 x 4 |
| `map` | Una planimetria con tag in tempo reale posizionati sopra | `image`, `markers` | 6 x 5 |
| `setpoint` | Un numero inserito per un tag, con limiti, un'unità e una conferma, e ciò che il dispositivo riporta | `tag`, `label`, `min`, `max`, `step`, `unit`, `decimals`, `confirm` | 3 x 3 |
| `symbols` | Un'immagine di una macchina: simboli posizionati al pixel su uno sfondo, disegnati dai loro tag | `image`, `width`, `height`, `symbols` | 8 x 5 |

Cose da sapere su quelle meno ovvie:

- **`button`** invia `value` con il tipo con cui è stato salvato. Un numero è un numero, `true` è un booleano, una stringa è testo. `1` e `1.0` sono scritture diverse su un PLC e il cancello decide in base al tipo JSON, quindi la scheda non trasforma l'uno nell'altro. `confirm` è attivo a meno che sia disattivato, e allora chiede «questo comanda apparecchiature reali» con il valore attuale e un motivo che va nella traccia di audit (`dashboard <id> / <card>` se lasciato vuoto). Disattivarlo è per un pannello in cui tenere premuto il pulsante è il punto; è una scelta da ingegnere e «Conferma prima di scrivere» della schermata Impostazioni lo riattiva.
- **`alarms`** elenca gli allarmi dell'intero stabilimento a meno che tu la indirizzi altrove. `devices` è un elenco di id di dispositivo. `equipment` è un elenco di id di nodi apparecchiatura da `GET /api/equipment`, a qualunque livello (una sede, un'area, una linea, una cella), e un nodo rappresenta ogni dispositivo posto in esso o sotto di esso, così la pagina di un'area può mostrare gli allarmi dell'area e di nessun altro. Con entrambi, un allarme viene elencato quando è su uno dei due. Ometti entrambi, o lasciali vuoti, e la scheda copre l'intero stabilimento, che è ciò che faceva ogni scheda salvata prima di questi campi. Il limite conta ciò che resta dopo il filtro, e `outstanding` continua a scartare ciò che è tornato alla normalità e riconosciuto. Una scheda limitata a un posto senza allarmi dice «qui» perché nessuno la legga come uno stabilimento tranquillo, e una scheda la cui apparecchiatura è stata nel frattempo eliminata lo dice invece di mostrare un elenco vuoto. L'apparecchiatura è memorizzata come id del nodo, quindi rinominare o spostare un nodo non rompe la scheda. La dashboard viene rifiutata al salvataggio se un dispositivo o un nodo non esiste. Nel costruttore digiti il percorso (`Plant 2 / Scrubbers / Kettle 3`) e lui conserva l'id. Questa scheda legge l'albero, quindi un ruolo ha bisogno di `equipment.read` (ce l'hanno operatori e visualizzatori).

  ```json
  {
    "id": "kettle-alarms", "type": "alarms", "title": "Scrubber alarms", "w": 6, "h": 3,
    "config": { "outstanding": true, "limit": 10, "equipment": [14], "devices": ["oven-1"] }
  }
  ```
- **`trend`** disegna la finestra che hai chiesto, che termina adesso, e non solo l'intervallo che le letture hanno coperto: `minutes: 480` è un asse delle ultime otto ore con un segno a ogni ora piena, nel fuso orario di chi guarda. Un tag che non si è mosso è una linea piatta alla sua ultima lettura buona, perché è così che appare un mulino fermo o una valvola chiusa, e l'historian conserva una lettura solo quando un valore supera la sua banda morta, quindi può esserci una lettura nella finestra, o nessuna. Nulla sulla linea è inventato. Ciò che il tag teneva quando la finestra è iniziata è la sua ultima lettura buona precedente (`GET /api/history` lo dice con `carry=true`), e la linea è quel valore dall'inizio della finestra alla prima lettura al suo interno. Dopo l'ultima lettura viene mantenuta fino all'ultima volta in cui si è sentito il tag, mai oltre adesso. Non c'è linea prima della prima lettura che qualcuno abbia, e un tag la cui ultima lettura prima della finestra era cattiva non ha alcun riporto, perché ciò che teneva non è noto. Un tratto di letture cattive è un buco, come è sempre stato. Una lettura sola è una linea fino a ora, o un punto se non c'è dove tracciarla.

  La legenda nomina ogni linea con il nome proprio del tag, lo stesso nome che mostra la scheda numerica, senza il dispositivo davanti. Due linee con lo stesso nome da dispositivi diversi conservano i loro id completi così puoi distinguerle. `labels` è un oggetto facoltativo da un tag in `tags` al testo che vuoi al suo posto, da 1 a 80 caratteri, e un'etichetta per un tag che non viene tracciato viene rifiutata. Il suggerimento al passaggio del mouse porta sempre l'id completo accanto all'etichetta.

  ```json
  {
    "id": "mills", "type": "trend", "title": "Mill temperatures", "w": 6, "h": 3,
    "config": {
      "tags": ["plant-5-temperatures/Large Sand Mill Temperature", "plant-5-temperatures/Small Sand Mill Temperature"],
      "minutes": 480,
      "labels": { "plant-5-temperatures/Large Sand Mill Temperature": "Large mill" }
    }
  }
  ```
- **`camera`** carica l'indirizzo nel browser, non sul server. Il config di una scheda è leggibile da ogni ruolo che apre la dashboard, quindi un indirizzo con un login o un token dentro viene rifiutato al salvataggio della dashboard. Usa un indirizzo della rete dello stabilimento che non ne richieda, oppure un proxy che aggiunga il login. Un'immagine fissa viene richiesta di nuovo ogni `refreshSec` secondi con un parametro di query `_hl` perché il browser non mostri la prima per sempre.
- **`map`** è un'immagine e dei marcatori. L'immagine è un indirizzo http(s) o una caricata nella scheda (png, jpeg, webp o gif, fino a 500 KB, memorizzata nella scheda). I marcatori sono tag, posizionati in percentuale della larghezza e dell'altezza dell'immagine così restano dove sono stati messi a qualunque dimensione. Questa è una planimetria, non una mappa stradale: una mappa a tessere richiede un server di tessere su internet, e il PC da pannello di uno stabilimento di solito non può raggiungerne uno.
- **`setpoint`** è per un numero che qualcuno digita: una temperatura, una velocità, un livello. Il campo conosce l'unità del tag (o la `unit` della scheda) e i suoi limiti: `min` e `max` insieme, oppure l'intervallo proprio del tag quando la scheda non ne dà. Una scheda può solo restringere l'intervallo del tag, mai allargarlo, perché il cancello di scrittura rifiuta un valore fuori dall'intervallo del tag qualunque cosa dica una scheda; una scheda che ne offre di più viene rifiutata al salvataggio della dashboard, e così una scheda su un tag che contiene testo o un interruttore (per quelli usa un `button`). Fuori dai limiti, fuori dallo `step`, o non un numero, l'inserimento lo dice sotto il campo e **Imposta** resta disattivato. **Imposta** chiede prima, con il valore attuale e un motivo per la traccia di audit, a meno che la scheda sia stata costruita con `confirm` disattivato e le Impostazioni non lo annullino, poi passa da `POST /api/write`: l'interruttore generale di scrittura, il flag di scrivibilità del tag, il permesso del ruolo e la riga di audit sono gli stessi di ogni altra scrittura. La scheda poi aspetta che la lettura del dispositivo mostri il valore e lo osserva per altri due secondi, e dice che cosa tiene il dispositivo: «Riletto 70 C dal dispositivo: è il valore inviato»; oppure, se il PLC ha preso la scrittura e l'ha riportata al proprio limite, «Il dispositivo ha preso 70 C e poi l'ha cambiato in 60 C»; oppure, se la lettura non l'ha mai mostrato, «Il dispositivo riporta 60 C, non 70 C». La riga «nel dispositivo adesso» è sempre la lettura in tempo reale, quindi mostra anche un programma PLC che sovrascrive il valore più tardi. Finché il dispositivo non ha una lettura buona (un PLC spento o irraggiungibile) il campo e Imposta sono disattivati e la scheda dice che il dispositivo non risponde, perché una scrittura potrebbe solo essere rifiutata.
- **`symbols`** è un'immagine di una macchina. `width` e `height` sono la dimensione propria della pagina in pixel (800 per 450 se omessi), `image` è uno sfondo facoltativo (un indirizzo http(s), o un'immagine caricata nella scheda, come per `map`), e `symbols` è un elenco di elementi posizionati al pixel dall'angolo in alto a sinistra: `{"id": "p1", "type": "pump", "x": 120, "y": 300, "tag": "plc/bPumpRun"}`. La pagina viene disegnata come un'unica immagine scalata, così ogni simbolo mantiene il suo posto a qualunque dimensione della scheda e su un telefono. I tipi sono `pump`, `motor` e `fan` (girano finché il tag è attivo), `valve` (aperta o chiusa), `tank` (riempito tra `min` e `max`, o l'intervallo del tag, o da 0 a 100), `heater` e `lamp` (accesi finché attivo), `pipe` (ciò che contiene si muove finché il suo tag facoltativo è attivo), `readout` (il numero, con `unit` e `decimals`) e `label` (testo fisso). `invert` legge un tag al contrario, e il `tone` di una lampada (`ok`, `warn`, `bad` o `info`) è il colore in cui si accende: una lampada di marcia è verde e una di guasto è rossa, e il tag dice solo quando è accesa. Un simbolo dice il suo stato a parole oltre che con il colore (una didascalia e un titolo), è disegnato rosso o caldo quando il suo tag è in allarme o ne è tornato, ed è attenuato con «nessuna lettura» quando il tag non ha una lettura buona. Il movimento si ferma quando la persona ha chiesto al proprio sistema meno movimento. I simboli sono disegnati da HotLoop per HotLoop; nessuno è preso in prestito. Un simbolo con un tag apre quel tag quando viene cliccato, come una puntina su una planimetria. Non comanda nulla: per quello affianca una scheda `setpoint` o `button`. Nel costruttore un simbolo si afferra e si sposta con il puntatore, o con i tasti freccia (Maiusc sposta di dieci pixel), oppure si danno i suoi pixel con un numero.
- **`markdown`** viene costruito in nodi DOM e mai in HTML, così nulla di ciò che vi si digita può diventare markup o uno script.
- **`gauge`, `value`, `map`, `setpoint`** mostrano «non più su questo gateway» se il loro tag viene eliminato dopo il salvataggio della dashboard, invece di un quadrante che non si muove mai.

## La bacheca a muro

La bacheca a muro è la dashboard `wall`, di tipo `wall`. C'è sempre, non può essere eliminata e non ha schede: i suoi indicatori sono i tag fissati nella schermata Board, conservati nell'impostazione propria della bacheca dove sono sempre stati. `GET` e `PUT /api/board`, l'indirizzo `#board`, il selettore dei fissati e il trascinamento per disporre sono intatti.

Ciò che ottiene dall'essere una dashboard è il selettore (è la prima pillola in ogni dashboard e anche la Board ha la barra) e le assegnazioni: può essere offerta ad alcuni ruoli, essere la pagina iniziale di un ruolo ed essere quella di uno schermo fisico. Un televisore a parete apre `/?screen=wall-tv` e ottiene la Board senza intestazione né schede.

## Ruoli e schermi

**Per ruolo.** `roles` decide a chi viene offerta una dashboard. `homeFor` decide dove atterra un ruolo. Un operatore la cui pagina iniziale è `line-2` apre HotLoop sulla Linea 2. Con un frammento di URL nell'indirizzo (`#alarms`) la pagina si apre dove dice l'indirizzo.

**Per schermo.** Uno schermo è un display fisico. Apri HotLoop su `/?screen=<name>` e mostra la dashboard il cui `screens` ha quel nome, senza intestazione, senza schede e con bersagli touch più grandi, perché chi passa davanti a un PC da pannello non ha bisogno di una via d'uscita dalla pagina. Un nome che nessuna dashboard ha lo dice invece di mostrare qualcos'altro.

**Un pannello fa accedere le persone, non sé stesso.** Senza nessuno connesso mostra un solo campo «PIN o badge». Un operatore digita il suo PIN, o passa il suo badge (un lettore di tipo tastiera lo digita nel campo), e il pannello apre la dashboard. Il suo nome e un pulsante **Esci** stanno nell'angolo, dato che l'intestazione che li mostrerebbe non c'è. Ogni scrittura che un pulsante di quella dashboard fa passa dal cancello di scrittura come quella persona, e la traccia di audit e il registro di bordo la nominano: «olga ha scritto 250 in line-02/Speed», non «panel-3». Dopo quindici minuti in cui nessuno tocca lo schermo (un'impostazione) il pannello la disconnette e torna al campo, e una scrittura inviata dopo viene rifiutata. Un amministratore dà a ogni persona un codice in **Impostazioni, Utenti**. Tutto il resto, che cos'è un badge, come viene memorizzato il codice e che cosa non fa, è in [Autenticazione e utenti](/it/iot/authentication/#pannelli-kiosk-pin-o-badge-e-disconnessione-per-inattività).

Sul tuo computer nulla di questo si applica: sei connesso con la tua password, la scrittura di un pulsante passa direttamente dal cancello e registra te, e non c'è uscita per inattività. Un pannello che era connesso con un account operatore permanente, come un pannello doveva essere gestito prima dei PIN, funziona ancora e scrive ancora come quell'account. Non dare a un pannello condiviso un accesso del genere.

Questo è ciò che è l'HMI di Edge: una dashboard con `screens` impostato, su una macchina che apre quell'indirizzo, con le persone che vi accedono con PIN o badge.

## Costruire

Chi possiede `dashboards.write` (gli amministratori) vede **Modifica** su una dashboard e **Nuova dashboard** nella barra. Durante la modifica:

- le schede sono inerti, quindi afferrare un pulsante per spostarlo non può premerlo;
- trascina una scheda su un'altra per metterla lì, oppure usa le frecce nella sua barra degli strumenti, che sono ciò che ha un telefono, perché un touchscreen non avvia un trascinamento;
- trascina l'angolo per ridimensionare: la larghezza si aggancia a una colonna su dodici, l'altezza a una riga;
- l'ingranaggio modifica la scheda, il pulsante copia la duplica, la croce la elimina;
- **Impostazioni** sono il nome, a chi viene offerta, per chi si apre per prima, i suoi schermi fisici e il suo posto nel selettore.

Nulla viene salvato finché non premi **Salva**. **Annulla** butta via le modifiche. Un `409` al salvataggio significa che qualcuno ha salvato prima: la pagina offre di caricare la sua.

**Esporta** (accanto a Modifica) salva la dashboard sullo schermo come file, e **Importa** (nella barra accanto a Nuova dashboard, per chi possiede `dashboards.write`) ne carica una in questa installazione, così uno schermo è un dato del cliente e si sposta tra installazioni senza che nessuno lo ricostruisca. Vedi [File di schermo](/it/iot/screen-file/).

## Layout

| Larghezza | Colonne | Una scheda di `w` occupa |
|---|---|---|
| Oltre 1100 px | 12 | `w` |
| Da 700 a 1100 px | 6 | metà di `w`, arrotondata per eccesso |
| Da 480 a 700 px | 2 | una, o entrambe quando `w` supera 4 |
| Sotto 480 px | 1 | tutto |

Le righe sono alte 76 px con uno spazio di 16 px nei layout larghi. Su un telefono una scheda è alta quanto il suo contenuto con un minimo dato dalle sue righe, così nulla viene tagliato. Il selettore scorre lateralmente al proprio interno e la pagina non lo fa mai.

## Su un telefono

L'interfaccia web si installa su un telefono e si apre senza connessione. È la stessa pagina con un manifest, icone e un service worker, servita da HotLoop stesso, quindi non c'è nulla da costruire e nulla da installare sul server.

**Installarla.** Su Android, il menu di Chrome ha **Installa app**. Su un iPhone, il foglio Condividi di Safari ha **Aggiungi alla schermata Home**. Si apre a schermo intero, con il nome dello stabilimento, e su Android una pressione prolungata sulla sua icona offre Allarmi e Dashboard. Un browser installa una pagina ed esegue un service worker solo su **https**, o su `localhost`. Su un semplice indirizzo `http://` di uno stabilimento HotLoop si apre ancora in una scheda esattamente come sempre, ma non può essere installato e non funzionerà offline. Metti un certificato davanti per i telefoni (l'ingress o il reverse proxy che hai già). Il browser ti dice perché non installa: strumenti per sviluppatori di Chrome, Application, Manifest.

**Che cosa conserva.** La pagina stessa, e l'ultima risposta alle letture che una persona guarda: l'elenco degli allarmi, le dashboard, le letture e gli stati delle entità, i dispositivi e i tag, lo stato, l'albero delle apparecchiature e la board. Finché la pagina è aperta e connessa le richiede una volta al minuto così c'è qualcosa a cui aprirsi, e non mentre il telefono è in tasca. Aprila senza connessione e la pagina si carica, l'elenco degli allarmi e le dashboard mostrano ciò che il telefono ha visto l'ultima volta, e una barra in fondo lo dice, con l'ora:

```
Offline. This is what this phone last saw as of 10/22/2026, 05:42:23. Nothing you
do here is sent until the connection is back.
```

Quando la connessione torna, entro pochi secondi, la barra sparisce, la schermata si aggiorna con risposte in tempo reale e il flusso in tempo reale si riconnette.

**Offline e mai connesso.** Un telefono che ha l'app ma non è connesso (non lo è mai stato, o è uscito, il che svuota ciò che aveva conservato) non ha nulla da mostrare senza connessione, quindi mostra la schermata di accesso e dice perché: HotLoop non risponde da qui, e continua a provare. Nel momento in cui HotLoop risponde, la pagina si ricarica da sola nell'accesso vero. Non mostra mai un'app senza nulla dentro.

**Che cosa non fa mai.** Nulla che cambi qualcosa viene inviato da una pagina offline. Una scrittura, che sia un valore a un tag, uno script, una ricetta o un riconoscimento, viene rifiutata prima di lasciare la pagina, con il motivo:

```
You are offline, so nothing was sent. Everything here is as of 10/22/2026, 05:42:23.
Try again when the connection is back.
```

Il service worker non risponde a una scrittura, non la conserva e non la mette in coda, e non ha sincronizzazione in background. Un comando a un'apparecchiatura viene inviato solo da una persona che guarda una risposta in tempo reale, e un pulsante premuto senza connessione non resta in attesa da qualche parte per partire più tardi. Riconoscere da una notifica è una cosa separata e richiede la rete allo stesso modo: l'app ntfy preme il proprio pulsante.

**Che cosa non conserva.** Il flusso in tempo reale, gli andamenti e la cronologia, il registro di bordo, le impostazioni, gli utenti, la politica di escalation e qualsiasi cosa riguardi le notifiche. Alcuni sono troppo grandi e diversi ogni volta per valere la pena di essere conservati, e altri contengono cose (gli argomenti ntfy delle persone, gli account) che non appartengono alla cache di un telefono, quindi quelle schermate richiedono che HotLoop risponda.

**Sul telefono.** Ciò che viene conservato vive nell'archiviazione cache del browser di quel telefono, al massimo 200 risposte, scartando prima le più vecchie. **Uscire lo svuota**, e lo fa anche una sessione scaduta o revocata (il primo `401` lo svuota). Viene conservata solo una sessione connessa, quindi un telefono offline non si apre mai sui dati di qualcun altro. Una nuova versione di HotLoop ottiene una cache di pagine propria e quella vecchia viene eliminata; la pagina viene richiesta in tempo reale ogni volta che c'è connessione, quindi una nuova versione o uno stabilimento rinominato compare alla successiva apertura.

Lo stesso test toglie il server, per la pagina e il worker allo stesso modo, e ricarica: la pagina si apre, l'elenco degli allarmi e una dashboard mostrano ciò che è stato conservato, una scrittura a un tag e un Riconosci sono entrambi rifiutati, l'allarme è ancora non riconosciuto e l'audit delle scritture vuoto quando la connessione torna, e uscire svuota ciò che era stato conservato. Eseguito su hardware reale (2026-11-17), compresa l'installazione su un telefono vero, Safari su un iPhone, e il Wi-Fi di uno stabilimento vero che cade.

## Permessi

| Permesso | Visualizzatore | Operatore | Amministratore |
|---|---|---|---|
| `dashboards.read` | sì | sì | sì |
| `dashboards.write` | no | no | sì |

Leggere è di ogni ruolo, filtrato da `roles`. Scrivere è dell'amministratore. Ciò che una scheda può fare quando viene premuta sono i permessi della persona che preme: un visualizzatore vede un pulsante di scrittura disattivato, e il server lo rifiuterebbe se passasse oltre.

## L'API

| Metodo | Route | Permesso |
|---|---|---|
| `GET` | `/api/dashboards` | `dashboards.read` |
| `POST` | `/api/dashboards` | `dashboards.write` |
| `GET` | `/api/dashboards/{id}` | `dashboards.read` |
| `PUT` | `/api/dashboards/{id}` | `dashboards.write` |
| `DELETE` | `/api/dashboards/{id}` | `dashboards.write` |
| `GET` | `/api/dashboards/{id}/export` | `dashboards.read` |
| `POST` | `/api/dashboards/import` | `dashboards.write` |

Il riferimento con corpi ed errori è in [l'API HTTP](/it/iot/api/#dashboards). Ogni creazione, salvataggio ed eliminazione è a registro come evento `config` sul soggetto `dashboard:<id>`, così il registro di bordo dice chi ha cambiato ciò che mostra un pannello.

La tabella è `dashboards`, aggiunta nella migrazione 0023 per PostgreSQL, TimescaleDB e SQLite. Aggiunge soltanto ([Le migrazioni aggiungono soltanto](/it/iot/migrations/)). La riga della bacheca a muro viene creata dall'applicazione la prima volta che viene richiesta, non dalla migrazione, così un database ripristinato da un backup precedente alle dashboard la ritrova.

## Che cosa non c'è

- **Layout esatti al pixel.** Di proposito, vedi sopra. Se l'HMI di una macchina ha davvero bisogno di un controllo in un punto fisso, quella è una schermata costruita per quella macchina, e non è ciò che è questa.
- **Visibilità per scheda.** Una dashboard viene offerta ai ruoli; una scheda no. Due pubblici con schede diverse sono due dashboard.
- **Una mappa a tessere.** Vedi la scheda `map`.
- **Tenere premuto un pulsante.** Un pulsante scrive una volta alla pressione. Un controllo momentaneo che scrive alla pressione e di nuovo al rilascio è un'altra scheda e non è costruito.
- **Dashboard nell'Edge Relay.** Non ha interfaccia.
