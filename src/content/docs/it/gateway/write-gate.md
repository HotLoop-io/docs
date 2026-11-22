---
title: "Il write gate: scritture sicure"
description: "Ogni scrittura, da schermata, API, regola, script, ricetta o agente, passa da una sola funzione. Cosa controlla e cosa rispondono i rifiuti."
sidebar:
  label: "Il write gate"
---

Questo sistema può muovere macchinari. Ecco quindi esattamente cosa si frappone tra una richiesta e un dispositivo, nell'ordine in cui lo esegue il codice.

Ogni valore diretto a un dispositivo passa da **una sola funzione che non si può aggirare**: un clic su una schermata, `POST /api/write`, una chiamata a un servizio di entità, un'automazione, uno script, una ricetta, un agente via MCP. La policy vive lì e solo lì, perché un controllo copiato in sei punti è un controllo che qualcuno dimentica di aggiungere al settimo, e il settimo è sempre quello che scrive sulla pressa in produzione. Un test fa fallire la build se qualcosa nel runtime può raggiungere la scrittura di un dispositivo senza passare dal gate, e dimostra di poter fallire piantando quattro tipi di bypass in una copia del pacchetto e intercettandoli tutti.

Preferisce sentirlo invece di leggerlo? [hotloop.io ha una versione interattiva](https://hotloop.io/gateway/#the-gate). Azioni gli interruttori, invii un setpoint e veda esattamente dove rimbalza.

## I controlli, in ordine

1. **Il chiamante può scrivere.** Succede alla porta dell'API, prima del gate. Un utente autenticato ha bisogno di `values.write` per chiamare `POST /api/write`: operatori e amministratori ce l'hanno, i visualizzatori no, e senza di esso l'API risponde 403. La porta di un agente è il token bearer MCP, e senza di esso riceve un 401 e non vede nemmeno l'elenco degli strumenti. In entrambi i casi il gate non ne sa nulla, quindi non compare nell'audit delle scritture. (Una chiamata a un servizio di entità funziona diversamente, [più sotto](#ogni-porta-lo-stesso-gate).)
2. **Le scritture sono attive.** `safety.allowWrites`, l'interruttore generale. Disattivato per impostazione predefinita dalla 4.4.0.
3. **Le scritture degli agenti sono attive.** `safety.allowMcpWrites`, controllato solo quando la richiesta è arrivata via MCP. Restringe l'interruttore generale e non può mai aggirarlo: con le scritture attive e questo disattivato, un operatore può comandare un tag e un agente no. Se lo si attiva con `safety.allowWrites` disattivato, il Gateway si rifiuta di avviarsi, invece di lasciarla indovinare quale dei due prevalga.
4. **Il tag è armato.** Ogni tag è in sola lettura finché qualcuno non lo marca `writable`, uno alla volta e di proposito. Un'importazione per esplorazione di 4.000 tag non ne arma nessuno. Anche un tag che non esiste viene rifiutato qui.
5. **Il valore è nell'intervallo.** Quando il tag ha un intervallo e il valore è un numero, un valore fuori intervallo viene **rifiutato, mai troncato**. Chi ha digitato 500 su un tag che arriva al massimo a 400 ha commesso un errore e deve saperlo. Inviare 400 in silenzio significa fare qualcosa che nessuno ha chiesto, senza che nessuno se ne accorga.
6. **Il controllo proprio del chiamante passa.** Un'entità aggiunge ciò che solo lei sa: il passo e l'intervallo più stretto di un numero, il pattern e la lunghezza di un testo, le opzioni di una selezione, l'uscita di un anello rifiutata a meno che l'anello non sia in manuale in questo momento, l'entità disattivata o eliminata a metà chiamata. Viene eseguito dentro il gate, dopo la policy e l'intervallo del tag perché un operatore senta sempre prima del tag, e prima della riga di audit perché il rifiuto di un'entità sia registrato esattamente come quello di un tag. Può solo rifiutare. Non può cambiare il valore né lasciar passare ciò che il gate avrebbe fermato.
7. **Il dispositivo è in funzione.** HotLoop ha un worker attivo per lui. Un dispositivo disattivato, o mai avviato, viene rifiutato con `the device is not connected` invece di lanciare un valore nel vuoto.

**Solo allora si apre la riga di audit, e solo allora il valore parte.** Se la riga non può essere scritta, la scrittura non viene inviata affatto. Una scrittura senza audit è una scrittura di cui nessuno può rendere conto dopo, e su un impianto che si muove non è un compromesso accettabile. La riga viene chiusa con il risultato e la latenza in un contesto staccato dalla richiesta, così una scrittura che scade o viene annullata registra comunque cosa è successo.

Ogni rifiuto dal controllo 2 in poi viene registrato nell'audit come rifiuto: una riga con l'attore, la sorgente, il valore richiesto, il valore che avrebbe sostituito e `refused:` con il motivo, più un avviso nel log di sistema. Chi tenta ripetutamente di comandare un tag che non gli è consentito è invisibile se non viene scritto, e un ingegnere deve poterlo trovare a posteriori. Il controllo 1 non è nell'audit delle scritture, perché il gate non l'ha mai visto.

### Perché quest'ordine

La policy gira prima dell'apertura della riga di audit, quindi un rifiuto viene registrato come rifiuto e non come un tentativo fallito per caso. La riga di audit si apre prima che il valore raggiunga il cavo, quindi una scrittura che si blocca, o che porta giù il processo, ha comunque lasciato traccia del tentativo. In uno stabilimento, "non sappiamo se quel comando è partito" è la risposta peggiore possibile.

### Una cosa che il controllo 7 non intercetta

Il controllo 7 chiede se il dispositivo ha un worker, non se la sua sessione è attiva in questo preciso istante. Un dispositivo uscito dalla rete e in riconnessione lo supera. La riga di audit si apre, il driver non ha sessione e la scrittura fallisce come `the device is not connected`, registrata come tentativo fallito e non come rifiuto. In entrambi i casi non arriva nulla al dispositivo. La [prova a secco](#chiedere-prima-di-inviare-la-prova-a-secco) controlla anche la sessione, e lo dice subito.

## Cosa risponde ogni rifiuto

Il codice di stato dice di chi è il problema, perché è così che lo legge un operatore.

| Cosa è successo | L'errore dice | HTTP |
|---|---|---|
| Nessuna autorizzazione, alla porta | `<user> does not have the "values.write" permission` | 403 |
| Le scritture sono disattivate | `writes are disabled on this deployment` | 403 |
| Le scritture degli agenti sono disattivate | `writes from MCP clients are disabled on this deployment` | 403 |
| Il tag non è armato | `this tag is not marked writable` | 403 |
| L'entità è disattivata | `the entity is disabled` | 403 |
| Il tag non esiste | il tag, e `not found` | 404 |
| L'entità è sparita a metà chiamata, o non è in uno stato che lo consente (un anello non in manuale) | cosa è cambiato | 409 |
| Il valore è fuori dall'intervallo del tag | `value is outside the tag's configured range` | 422 |
| L'entità non accetta il valore (passo, pattern, opzioni, il suo intervallo) | `the value is not one this entity accepts`, e perché | 422 |
| Il dispositivo non è connesso | `the device is not connected` | 503 |
| Il dispositivo ha risposto di no | le parole del dispositivo stesso | 502 |
| La scrittura non ha potuto essere registrata nell'audit, o qualunque altra cosa che l'API non sa collocare | `internal error (ref …)`, con il dettaglio nel log del server sotto quel riferimento | 500 |

Tutto ciò che l'API non sa collocare è un 500. Prima era un 400, il che significava che un guasto del database diceva a un operatore di aver digitato qualcosa di sbagliato, e lui andava a caccia di un refuso che non c'era.

Via MCP non ci sono codici di stato. Un rifiuto torna come risultato dello strumento contrassegnato `isError`, con le parole del gate stesso:

```
> write_tag tag=press-01/Zone1_Temp value=99 reason="testing"
write refused: press-01/Zone1_Temp: this tag is not marked writable
```

È una risposta, non un guasto di trasporto. La chiamata è stata capita e deliberatamente rifiutata, e ripeterla dà la stessa risposta.

## Chiedere prima di inviare: la prova a secco

Il gate ha un secondo punto d'ingresso che chiede senza fare. Esegue gli stessi controlli, nello stesso ordine, e dà lo stesso testo d'errore per un rifiuto. Non apre alcuna riga di audit, non genera eventi, non conta nulla e non raggiunge mai il dispositivo. Va anche un passo oltre la scrittura vera: un dispositivo il cui worker è attivo ma la cui sessione è caduta viene segnalato come non connesso, invece di "questo partirebbe".

Dove trovarla:

- **Chiamate ai servizi di entità**: `POST /api/services/{domain}/{service}?dry_run=true`. Risponde 200 con il verdetto: ogni scrittura che farebbe come `would_write`, o la prima che sarebbe rifiutata come `not_sent`, con il motivo parola per parola. Una richiesta che non si è nemmeno potuta pianificare (entità inesistente, un servizio che il dominio non prevede, dati errati) risponde con lo stesso stato della chiamata vera. `dry_run` accetta `true` o `false` e nient'altro, e `yes` dà un 400, perché indovinare nel verso sbagliato trasforma una domanda in un comando.
- **Il prompt dei comandi** chiede mentre si digita e mostra "Would be refused: ..." prima che qualcuno confermi.
- **Script**, novità della 4.17.0: `POST /api/scripts/{id}/run?dry_run=true`, **Check first** nel pannello di esecuzione, o `run_script` di MCP con `dryRun`. Ogni passo viene percorso contro l'impianto così com'è adesso, e la prima scrittura che sarebbe rifiutata chiude il percorso con le parole del gate. Vedi [Script](/it/iot/scripts/).
- **Ricette**, novità della 4.17.0: ogni destinazione è sottoposta a questi controlli prima che parta il primo valore, e un solo valore sbagliato rifiuta l'intera ricetta senza scrivere nulla. `POST /api/recipes/{id}/validate` e `validate_recipe` di MCP chiedono senza applicare. Vedi [Ricette](/it/iot/recipes/).
- **Blueprint**, novità della 4.17.0: **Check first** mostra cosa farebbe la regola se scattasse adesso, con ogni scrittura sottoposta a questi controlli, prima che la regola esista. Vedi [Blueprint](/it/iot/blueprints/).

Una prova a secco pulita è un consiglio, non una promessa. Il gate decide comunque alla scrittura vera, perché un dispositivo può cadere, o qualcuno può disarmare un tag, tra la sua domanda e il suo comando.

:::caution[Ancora sulla 4.16.0? Il prompt può inghiottire un Set]
Nella 4.16.0 il verdetto della prova a secco arriva circa un quarto di secondo dopo che si smette di digitare, proprio mentre il mouse va verso Set, e il prompt si allarga o si restringe sotto di esso. Set si sposta di circa 30 px, quindi il clic cade nel vuoto, oppure sullo sfondo e chiude il prompt. L'operatore lo vede chiudersi, pensa che il setpoint sia partito e non è stato scritto nulla. Corretto nella 4.17.0: il verdetto sta accanto ai pulsanti e nulla si muove. Finché non [aggiorna](/it/gateway/upgrading/), controlli che il valore sia davvero cambiato dopo aver premuto Set.
:::

## Ogni porta, lo stesso gate

- **Le schermate e `POST /api/write`.** L'attore è il nome utente autenticato, non un'intestazione che chiunque potrebbe impostare.
- **Servizi di entità**, `POST /api/services/{domain}/{service}`. `switch.turn_on` su `switch.press_01_pump` è una scrittura di tag attraverso questo gate, registrata nell'audit sull'entità con il suo entity_id, il servizio e un id di chiamata. La pressione di un pulsante sono due scritture sotto lo stesso id di chiamata. Un utente senza `values.write` qui non viene fermato alla porta: il permesso mancante è consegnato al gate come controllo proprio del chiamante, così una chiamata di entità negata è registrata nell'audit sull'entità, con il valore richiesto, come qualunque altro rifiuto, e risponde comunque 403.
- **Le automazioni** scrivono come `automation:<rule-id>`. Una regola non ha più privilegi di una persona. Vedi [Automazioni](/it/iot/automations/).
- **Gli script**, novità della 4.17.0, scrivono come `script:<id>` e mantengono la sorgente di chi li ha avviati, così uno script avviato da un agente si scontra con l'interruttore degli agenti esattamente come il `write_tag` dell'agente stesso.
- **Le ricette**, novità della 4.17.0, scrivono ogni destinazione sotto lo stesso id di chiamata, quindi `GET /api/writes?call=<id>` è l'intera applicazione nella traccia di audit.
- **Gli agenti** scrivono come `mcp:<client name>`. `write_tag` e `call_service` passano gli stessi controlli di un operatore, ed entrambi si rifiutano di girare senza un motivo dichiarato, che finisce nel log di sistema accanto alla scrittura. Una riga di audit che nessuno sa spiegare sei mesi dopo è solo un timestamp con la coscienza sporca. `trigger_automation` si rifiuta del tutto finché le scritture degli agenti sono disattivate, e così `run_script` e `apply_recipe`, perché una regola, uno script o una ricetta possono comandare apparecchiature e sarebbero altrimenti un modo di aggirare l'interruttore. Vedi [Model Context Protocol](/it/iot/mcp/).

## Perché le scritture sono disattivate di default

Prima della 4.4.0, `safety.allowWrites` e `safety.allowMcpWrites` erano `true` di default. Ora sono `false`. Un tag è sempre stato in sola lettura finché non armato, ma un'installazione nuova non dovrebbe essere a un flag `writable` di distanza dal comandare apparecchiature prima che qualcuno l'abbia guardata.

Sopra il gate, `safety.confirmWrites` (attivo di default) fa sì che le schermate chiedano conferma prima di inviare qualunque cosa. È un prompt nel browser, non un controllo nel gate, ed è l'unica impostazione di sicurezza che si può cambiare dalla schermata Impostazioni. `safety.allowWrites` e `safety.allowMcpWrites` lì sono in sola lettura di proposito: il controllo principale su cosa questo processo può comandare non deve stare dietro la stessa sessione del browser che emette le scritture.

## Attivare le scritture, deliberatamente

1. Aggiunga il dispositivo e scopra i suoi tag dove il protocollo sa elencarli. Modbus e S7comm non possono enumerare i propri punti, quindi li dichiari dalla documentazione del dispositivo.
2. Marchi i tag come scrivibili uno alla volta, e solo quelli che intende.
3. Imposti `safety.allowWrites: true` nel suo file dei valori ed esegua `helm upgrade`. Finché non lo fa, nulla nei passi 1 e 2 può muovere una valvola.
4. Solo se anche gli agenti devono comandare apparecchiature, imposti `safety.allowMcpWrites: true`.

## Cosa non fa

L'applicazione non può imporre tutto, ed è meglio dirlo che lasciarlo dare per scontato.

- **Non è un interblocco.** Uno scatto che protegge le persone o l'impianto appartiene al PLC, cablato dove deve stare, non a qualcosa che gira su una rete.
- **Non controlla il suo broker.** Se invia comandi di nodo agli edge relay via MQTT, il controllo accessi del broker stesso deve limitare alle credenziali del Gateway chi può pubblicarli.
- **Il server OPC UA non può scrivere affatto.** È in sola lettura, senza gestore di scrittura né impostazione che ne aggiunga uno, quindi lo SCADA che lo legge non può comandare nulla attraverso di esso.
