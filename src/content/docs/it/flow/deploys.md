---
title: "Ogni distribuzione lascia un registro"
description: "Chi, quando, perché e i byte esatti di ogni distribuzione, confrontati nodo per nodo in API, CLI e git, con un ripristino che conserva le credenziali."
---

«Che cosa è cambiato, chi l'ha cambiato, rimettetelo a posto» è la prima cosa che chiede chiunque dopo che una linea si è fermata. Tre file `.bak` non rispondono a nulla di tutto ciò. Non sanno chi, si ricicliano dopo tre salvataggi, e quello che serve è sempre il quarto.

Per questo ogni distribuzione scrive un record immutabile in `data/deployments/`: chi l'ha distribuita (dal suo token, mai da ciò che il client dichiara), da dove, quando, la nota che ha lasciato, la revisione che ha sostituito, il file del flusso byte per byte e le credenziali così come erano dopo la distribuzione, cifrate esattamente come il file delle credenziali. I record sono solo in aggiunta. Il registro conserva gli ultimi 100 per impostazione predefinita (`history.retain`, e 0 li conserva tutti) e non elimina mai il più recente, perché il più recente è quello in esecuzione.

```bash
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:1880/deployments
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:1880/deployments/42/flows > flows-42.json
```

Una nota entra con la distribuzione, come `"note"` nel documento avvolto (`{"rev": ..., "flows": [...], "note": "..."}`) o come intestazione `HotLoop-Flow-Deployment-Note`. La forma documento esiste perché un browser non mette nulla fuori da Latin-1 in un'intestazione, e le persone scrivono le note nella propria lingua.

Fa due cose che si noterebbero solo quando ci si scotta:

- **Una modifica a mano viene scoperta.** Se il file del flusso su disco non è l'ultima cosa registrata dal registro, perché qualcuno l'ha modificato mentre il processo era fermo, l'avvio lo registra come una voce `baseline` che lo dice. Lo stesso al primo avvio con un file di flusso già presente. Altrimenti una modifica a mano diventa in silenzio un passato che nessuno ha annotato.
- **Un registro che non si può scrivere non ferma la linea.** A quel punto il file del flusso è già salvato, quindi rifiutare la distribuzione lascerebbe disco e flussi in esecuzione in disaccordo fino al riavvio successivo. La distribuzione prosegue, e la risposta e il registro dicono, a parole, che questa non ha un record.

L'API non consegna mai le credenziali di un record, cifrate o no. Sono tenute per un solo scopo, rimetterle a posto, e un endpoint della cronologia non è un modo per portarle via.

## Il diff si legge come una revisione

Un diff riga per riga di un file di flusso è onesto e inutile. Trascinate un nodo di venti pixel ed è una modifica. Cambiate una soglia ed è una modifica. Chi rivede non può dire quale delle due sta per fermare una pressa. Per questo Flow confronta nodo per nodo:

```
1 changed, 2 moved

Tab "Line 3" (t1)
  ~ switch "Pressure check" (sw1)
      rules[1].v: "7.5" -> "8.0"
      wire added: port 1 -> change "set alarm" (alarm1)

Moved on the canvas only
  mqtt in "press 01" (in1)
  debug "ok" (ok1)
```

Aggiunti, rimossi e modificati, proprietà per proprietà con il valore vecchio e quello nuovo, quali collegamenti si sono spostati per porta di uscita, e **il layout tenuto separato dalla logica**: spostare, ridimensionare o nascondere un'etichetta è «spostato sulla tela», mai una modifica, così un riordino si legge come un riordino. Una credenziale si legge come «impostata» o «modificata», mai con il suo valore. Le modifiche dentro un sottoflusso compaiono sul sottoflusso, e trascinare una sua porta è anch'esso layout.

La stessa risposta ovunque, da un solo pacchetto del motore:

- `GET /deployments/{from}/diff/{to}` confronta due distribuzioni.
- `POST /flows/diff` confronta ciò che è in esecuzione con un documento che nessuno ha ancora distribuito, cioè ciò che si guarda prima di premere distribuisci.
- `hotloop-flow diff old.json new.json` da riga di comando. `-json` per un programma. Esce con 1 quando qualcosa differisce, come `diff`.
- **Dentro git.** Lo si rende il driver di diff di git per i file di flusso e `git diff`, `git log -p` e `git show` stampano il diff semantico invece di un blocco JSON:

  ```bash
  git config diff.hotloop-flow.command 'hotloop-flow diff'
  echo 'flows.json diff=hotloop-flow' >> .gitattributes
  ```

  Oppure come difftool: `git config difftool.hotloop-flow.cmd 'hotloop-flow diff "$LOCAL" "$REMOTE"'`, poi `git difftool -t hotloop-flow`.

Un flusso confrontato con se stesso non è alcuna modifica, per qualsiasi documento che il parser accetti.

## Rimetterlo a posto

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "HotLoop-Flow-Deployment-Rev: $CURRENT_REV" \
  -d '{"note":"42 broke the label printer"}' \
  http://localhost:1880/deployments/41/rollback
```

Un ripristino distribuisce di nuovo un vecchio record **come un nuovo record**. La cronologia resta solo in aggiunta: la distribuzione 41 non viene toccata, e il ripristino è una voce a sé che dice «ripristino alla distribuzione 41», chi l'ha fatto e perché. Il file del flusso torna byte per byte, quindi è la stessa revisione di allora.

**Tornano anche le credenziali.** Ogni record le porta così com'erano, quindi un nodo che avete eliminato torna con la password del suo broker invece di tornare e non riuscire ad accedere. È provato contro un vero Mosquitto che rifiuta i client anonimi: si elimina il sottoscrittore, si distribuisce, si ripristina, e accede di nuovo e i messaggi scorrono.

Rifiuta in tre modi, prima che venga scritto qualcosa. Un `HotLoop-Flow-Deployment-Rev` obsoleto riceve lo stesso 409 che riceverebbe una distribuzione, perché un ripristino in corsa con la distribuzione di qualcun altro resta una corsa. Una distribuzione che la conservazione ha già rimosso è un 404. E un record le cui credenziali non si possono decifrare con il segreto delle credenziali attuale è un 422, perché flussi che non riescono ad accedere a nulla sono un ripristino che sembra riuscito e basta.

## Nell'editor

**Deploy non distribuisce.** Apre una revisione: il diff del motore rispetto a ciò che è in esecuzione, disegnato sulla tela ed elencato a parole, con una casella per la nota. Il verde è aggiunto, l'ambra è modificato, il blu è solo spostato, e fantasmi rossi occupano il posto dei nodi e dei collegamenti rimossi. Una scheda con qualcosa di cambiato riceve un puntino. Il secondo pulsante Deploy è quello che distribuisce, e la nota va nel registro. Modificate qualsiasi cosa con la revisione aperta e si chiude, perché la revisione di qualcosa che avete cambiato nel frattempo è una bugia su ciò che state per inviare.

**Il pannello della cronologia** elenca ogni distribuzione con chi, quando e la nota. *Changes* apre quella distribuzione su una tela di sola lettura con ciò che ha cambiato disegnato sopra, sopra la vostra copia di lavoro, che resta esattamente come l'avete lasciata. *Roll back* chiede perché, avvisa se state per perdere modifiche non salvate, e la distribuisce.

**Un conflitto di distribuzione mostra che cosa ha fatto l'altra persona.** Era un `confirm()` del browser che chiedeva di sovrascrivere il lavoro dell'altro o perdere il vostro senza dire che cosa fosse il suo. Ora dice chi ha distribuito, quando, la sua nota e la sua modifica nodo per nodo, poi permette di caricare la sua, sovrascrivere con la vostra o continuare a modificare.

**Copia, taglia e incolla funzionano come ci si aspetta, e parlano il file di flusso.** Selezionate dei nodi, Ctrl+C, e negli appunti c'è lo stesso JSON che legge ogni altro strumento di flussi, quindi lo si può incollare in una chat, in un ticket o su un'altra macchina. Incollare lo mette dove si trova il puntatore, con nuovi id ogni volta, quindi incollare due volte dà due copie e mai una collisione. Un collegamento verso qualcosa che non avete copiato viene tagliato invece di restare puntato sul nulla, e un nodo di configurazione usato dai nodi viene con loro. Se quel nodo di configurazione è già nel flusso in cui incollate, la copia lo condivide invece di aprire una seconda connessione verso qualcosa che le conta. Le credenziali non vanno mai negli appunti. Una password in un buffer di incolla è il modo in cui finisce in un rapporto di bug.

**Import ed Export** fanno lo stesso per una selezione, un flusso o tutto, con una casella da cui copiare, un pulsante Download e un selettore di file in ingresso. Il materiale sbagliato riceve un motivo («l'id a compare due volte», «la voce 1 non ha un id») e la finestra resta aperta. Un tipo di nodo che questo runtime non ha entra in grigio e tratteggiato, e l'importazione dice quali, perché un nodo scartato in silenzio è peggio di uno rumoroso.

Una schermata fa parte di quel file. Il dashboard che un flusso disegna (`ui_tab`, `ui_group` e i widget) è fatto di nodi del flusso, quindi le schermate di un cliente viaggiano con i suoi flussi tramite Export e Import, e nessuna vive in HotLoop Flow stesso.

**I sottoflussi si modificano su una tela propria.** Premete *+ subflow* e si apre con le sue porte di ingresso e uscita. Collegatele ai nodi interni come qualsiasi altra cosa. *Subflow properties* imposta il nome, il colore, quante uscite ha e le proprietà che un'istanza può impostare. Le istanze nei flussi seguono quando la forma cambia, e la palette elenca ogni sottoflusso così da poterne trascinare uno. Doppio clic su un'istanza per darle un nome proprio e un proprio valore per ogni proprietà. Un sottoflusso non può essere inserito dentro se stesso né dentro uno che lo contiene, e uno ancora in uso non può essere eliminato. L'editor lo dice invece di lasciarlo scoprire alla distribuzione successiva.

**Dalla selezione a un sottoflusso.** Selezionate dei nodi e premete *Selection to subflow*. Passano in un sottoflusso a sé e un'istanza prende il loro posto. Ogni collegamento che attraversava il bordo della selezione diventa una porta: l'unica via d'ingresso è l'ingresso del sottoflusso, e ogni uscita di un nodo selezionato che andava altrove è un'uscita del sottoflusso, così il flusso fa ciò che faceva. Un sottoflusso ha un solo ingresso, quindi se la selezione è collegata a due nodi diversi lo dice e non cambia nulla, perché alimentare entrambi da entrambi sarebbe un altro flusso. Selezionate un gruppo e viene con tutto ciò che contiene. Un nodo di configurazione che appartiene al flusso e che usa solo la selezione passa nel sottoflusso con essa, insieme a ciò a cui punta. Uno che usa anche qualcosa rimasto fuori diventa globale, in modo che le due estremità continuino a condividere la stessa connessione, perché una seconda connessione al broker su una macchina che le conta è il genere di sorpresa che non rilasciamo. Le variabili d'ambiente lette dai nodi spostati (di tipo env, come `${NAME}` o `$(NAME)` in una stringa, o `env.get`) e dichiarate dal flusso diventano proprietà del sottoflusso che rimandano al flusso, così il valore continua a venire da dove veniva e l'istanza può sostituirlo. Ctrl+Z annulla tutto.

**Flussi.** Doppio clic su una scheda, o premete *Flow properties*, per rinominarla o eliminarla. Eliminare chiede conferma, porta via ogni nodo del flusso, e taglia i collegamenti e i link che altri flussi avevano verso di esso, così il file non resta puntato sul nulla. Toglie inoltre i nodi eliminati da qualsiasi ambito Catch, Status o Complete che li nominava. Un Catch o uno Status la cui intera lista è stata eliminata conserva il suo ultimo id, perché una lista vuota significa tutto il flusso e non faremo passare un nodo dal sorvegliare una cosa al sorvegliare tutto alle vostre spalle. Ctrl+Z la riporta indietro fino alla distribuzione. L'ultimo flusso non può essere eliminato, perché un runtime senza flussi non ha dove mettere un nodo.

**I nodi di configurazione** sono nella palette sotto *configuration*. Non stanno su nessuna tela, quindi si fa doppio clic sul tipo, si compila la finestra e viene aggiunto all'elenco sotto *configuration in use*, dove un doppio clic lo modifica e la croce lo elimina. Uno che un nodo usa ancora non si elimina, e dice quanti lo usano. È lì che vi manda «Add one from the palette first» nella finestra di un nodo.

**Eliminare un collegamento.** Alt-clic. Un clic semplice non fa nulla, quindi sfiorare un collegamento durante la selezione non può rompere un flusso. Ctrl+Z lo rimette.

**Collegamenti durevoli.** Doppio clic su un collegamento. Spuntate *Durable* e viene disegnato più spesso e blu, e il nodo da cui parte riceve `ew_durable` nel file. Il segno è sulla coppia di nodi, quindi vale per ogni collegamento tra di loro. È cablaggio verso il runtime, quindi marcarne uno non riavvia mai il nodo.

**Gruppi.** Ctrl+G avvolge la selezione, Ctrl+Maiusc+G la scioglie. Doppio clic sulla barra del titolo per dargli nome e colore. Trascinate un gruppo e tutto ciò che contiene va con lui. Trascinate un nodo in un gruppo e vi entra, trascinatelo fuori e ne esce. I gruppi si annidano. Eliminare un gruppo elimina ciò che contiene, e Ctrl+Z rimette tutto.

**La ricerca** (Ctrl+F, o il pulsante) guarda in tutti i flussi e sottoflussi insieme: nomi, tipi, id e ogni impostazione, compresa una riga in mezzo al corpo di una funzione. Un risultato porta alla scheda giusta con il nodo selezionato e al centro della vista. Compaiono anche i nodi di configurazione, e il loro risultato apre la loro finestra, dato che non hanno posto su una tela.

**Filtro del debug.** Restringete la barra laterale a un flusso, ai nodi selezionati, a una parola o solo agli errori. Si applica a ciò che è già nel registro, non solo a ciò che arriva dopo, quindi restringere non fa mai sparire la riga che stavate guardando.

Tutto questo viene percorso con i clic in un vero browser a ogni pull request, contro il vero binario con l'editor incorporato. Comprende ogni finestra di nodo che il runtime offre: l'elenco viene da `GET /nodes`, quindi un nodo aggiunto il mese prossimo è nel test il mese prossimo senza che nessuno ricordi di aggiungerlo. Scrivendo quei test abbiamo trovato due cose che in Chromium non avevano mai funzionato: il doppio clic su un nodo per aprirne la finestra e il trascinamento di un collegamento su un nodo. La tela trattiene il puntatore per tutto il trascinamento, quindi il bersaglio dell'evento era sempre la tela e un collegamento rilasciato sopra un nodo non trovava mai il nodo. Due bug imbarazzanti quanto possono esserlo in un editor visuale. Entrambi corretti.

## I flussi come codice

Il repository è il posto dove i flussi vengono rivisti, quindi il repository dovrebbe poterli distribuire. Tenete il file del flusso in git, configurate il driver di diff qui sopra perché la pull request si legga come una revisione, e lasciate che il merge lo distribuisca:

```bash
hotloop-flow export -o flows.json          # the live file, byte for byte, to commit
hotloop-flow deploy -file flows.json -note "PR #12: line 3 pressure check"
```

`deploy` stampa il diff rispetto a ciò che è in esecuzione, lo stesso testo di ovunque, poi distribuisce rispetto alla revisione da cui quel diff è stato fatto. Se qualcuno distribuisce nel frattempo, è un 409 e una pipeline rossa, non una sovrascrittura silenziosa. `-expect-rev` lo vincola alla revisione su cui è stato fatto un piano rivisto, e `-dry-run` stampa il diff e non distribuisce nulla. Un file senza nulla da cambiare non distribuisce nulla e non aggiunge nulla alla cronologia, così un merge che non ha toccato i flussi non sporca il registro. Un nodo che non si avvia viene distribuito e fa comunque fallire il job, perché il resto del flusso è in esecuzione e qualcuno deve guardare. `export -deployment 41` riporta fuori dalla cronologia qualsiasi distribuzione.

**Una pipeline non tiene mai una password di amministratore.** Riceve un token API:

```bash
hotloop-flow token -name ci
```

stampa un token, una sola volta, per il deposito dei segreti della pipeline, e l'hash da dare al runtime: `HOTLOOP_FLOW_DEPLOY_TOKEN_HASH` per un token di distribuzione, oppure `auth.tokens` nel file di configurazione per qualsiasi altro. Il runtime tiene sempre e solo l'hash, come con una password. Un token di distribuzione può leggere i flussi e distribuire, il che include il ripristino, e nient'altro: niente impostazioni, niente inject, niente editor. Entrambi i comandi leggono il token da `HOTLOOP_FLOW_TOKEN` (o `-token-file`) e l'istanza da `HOTLOOP_FLOW_URL` (o `-url`), mai un token sulla riga di comando, dove finirebbe nell'elenco dei processi e in ogni log di pipeline che ripete il comando. La cronologia mostra il token come autore della distribuzione, `token:ci`, con la nota passata dalla pipeline.

Le credenziali non viaggiano mai così. Non sono nel file del flusso, quindi una distribuzione da git lascia ogni password del broker esattamente dov'era.

## Uno specchio git, se lo volete

Il registro delle distribuzioni vive sulla macchina. Un repository è il posto dove tutti gli altri già guardano: ha una vista web, il blame, i backup e persone che sanno leggerlo. Puntate Flow a uno e ogni distribuzione diventa un commit del file del flusso su un ramo su cui scrive solo Flow, **con autore chi l'ha distribuita**, all'ora in cui l'ha distribuita, con la sua nota come messaggio:

```yaml
history:
  git:
    url: https://git.plant.example/line3/flows.git
    branch: main              # one nobody else pushes to
    path: flows.json
    emailDomain: plant.example  # dana deploys, the commit is from dana@plant.example
```

La password è un token di accesso del server git, e va in `HOTLOOP_FLOW_GIT_PASSWORD` da un Secret, mai nel file (funzionano anche `HOTLOOP_FLOW_GIT_URL` e `HOTLOOP_FLOW_GIT_USERNAME`). Un URL con una password dentro viene rifiutato all'avvio, così l'URL si può sempre registrare nel log. Solo `http://` e `https://`: l'immagine non ha un binario git per `file://` né chiavi per `ssh://`, e uno specchio che fallisce a ogni push è peggio di uno che rifiuta di avviarsi. I ripristini e le basi di avvio dicono che cosa sono nel commit, e ogni commit porta un trailer `Flow-Deployment: N`, ed è così che un processo riavviato, o uno il cui clone è stato cancellato, riprende esattamente da dove il repository dice che era arrivato, senza duplicati.

**Non trattiene mai una distribuzione.** Il push avviene sulla sua goroutine. Un server git spento, lento o che rifiuta il push non costa nulla a una distribuzione: i commit aspettano in un clone locale sotto `data/git-mirror` e partono al successivo push che funziona, riprovato ogni minuto. `GET /deployments` dice fin dove è arrivato lo specchio e l'ultimo errore, e `hotloop_flow_git_mirror_behind_deployments` è il numero su cui allertare. Provato contro il server smart-HTTP di git dietro autenticazione basic: tre distribuzioni fanno tre commit di tre autori, un push che il server rifiuta aspetta e recupera quando smette di rifiutare, e una distribuzione con un server git che impiega dieci secondi a dire no torna in millisecondi.

È Go puro (go-git), quindi il binario resta statico. Costa circa 3.8 MB di binario, ed è per questo che è misurato e non presunto. Il binario era di 48,083,106 byte prima dei cataloghi.
