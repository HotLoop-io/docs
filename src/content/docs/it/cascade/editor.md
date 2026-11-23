---
title: "L'editor di Cascade"
description: "L'editor è incluso nel binario di Cascade: cartelle, canvas con esecuzione fin qui, esecuzioni tracciate passo per passo, credenziali, progetti, utenti, audit."
---

:::note[Comprende ciò che sta arrivando]
Questa pagina comprende anche alcune cose più recenti di HotLoop Cascade 1.4.2, l'ultima versione rilasciata. Una parte potrebbe non essere in ciò che hai installato. Le [note di rilascio](/it/releases/) dicono cosa è cambiato.
:::

L'editor è incluso nel binario, quindi non c'è nient'altro da eseguire e non scarica nulla da nessuna parte: si apre l'indirizzo su cui il server è in ascolto e si accede. È un'app Astro con isole Svelte, compilata in file statici durante la creazione dell'immagine, con gli stessi colori e lo stesso carattere di ogni altra schermata HotLoop, chiara o scura secondo il sistema finché non si sceglie.

![Flussi di lavoro, in cartelle](/synced/cascade/docs/screenshots/workflows.png)

I flussi di lavoro stanno nei progetti, e quelli di un progetto stanno in cartelle che si annidano tanto in profondità quanto l'impianto: area, linea, cella. Un flusso di lavoro si sposta tra le cartelle dalla propria riga.

![Il canvas, con un passaggio selezionato e le sue impostazioni accanto](/synced/cascade/docs/screenshots/editor.png)
![Lo stesso, in scuro](/synced/cascade/docs/screenshots/editor-dark.png)

Il canvas è dove è sempre stato: si trascina da un'uscita a un ingresso, si sposta un passaggio, `Ctrl+S` per salvare, `Delete` per togliere un passaggio. Esegui fin qui esegue ciò che è sullo schermo, senza salvare, fino al passaggio scelto e mostra ciò che ha prodotto come tabella, campi o JSON, e si può bloccare quell'output perché il passaggio smetta di girare mentre si costruiscono quelli successivi. Ogni campo accetta un'espressione e mostra a cosa corrisponde con l'ultima esecuzione di prova. Un salvataggio sopra quello di qualcun altro viene segnalato, non imposto.

![Un'esecuzione non riuscita, disegnata com'è andata](/synced/cascade/docs/screenshots/run.png)

Un'esecuzione viene disegnata con l'esito di ogni passaggio. La si può riprovare dal passaggio che è fallito, da qualsiasi passaggio, oppure sottoporla a debug nell'editor rispetto alle modifiche: i passaggi prima di quello che si riesegue mantengono ciò che hanno fatto, quindi una scrittura già avvenuta non avviene due volte. Una persona può lasciare a posteriori un pollice su o giù, una nota e dei tag su un'esecuzione, e l'elenco delle esecuzioni trova le esecuzioni tramite questi.

![Esecuzioni, con ciò che le persone ne hanno detto](/synced/cascade/docs/screenshots/executions.png)
![Analisi degli ultimi sette giorni](/synced/cascade/docs/screenshots/insights.png)
![Ruoli](/synced/cascade/docs/screenshots/roles.png)
![Criteri di oscuramento](/synced/cascade/docs/screenshots/redaction.png)

Il resto del lavoro di governance è in Impostazioni: i ruoli e chi li ha, i criteri di oscuramento (un flusso di lavoro ne sceglie uno nelle proprie impostazioni, dall'editor), i provider di segreti esterni, l'invio dei log, e accesso e SCIM. Le modifiche le fa un proprietario o un amministratore; tutti gli altri leggono ciò che possono, non vedono mai un pulsante che il server rifiuterebbe, e il server lo rifiuta comunque.

Quattro schermate affiancano i workflow. Le credenziali si creano, si aprono, si modificano, si condividono con altri progetti e si eliminano nel loro progetto; un campo segreto si inserisce una sola volta e la schermata dice soltanto che è impostato. Progetti contiene chi c'è in ciascuno e con quale ruolo, e le chiavi dell'account di servizio con cui accede un'integrazione permanente. Il tuo account (l'indirizzo nella barra in alto) crea e revoca le tue chiavi API, con cui accedono l'API REST e il server MCP, e cambia la tua password. Per proprietari e amministratori, Impostazioni contiene le impostazioni generali (secondo fattore, il workflow di errore), Utenti crea le persone, le disattiva e permette a un proprietario di eliminarne una (i suoi accessi e le sue chiavi spariscono, i suoi workflow restano), e il registro di controllo si legge, si filtra e si verifica contro le manomissioni lì. L'accesso è lo stesso editor, su `/login`, e mantiene l'accesso unico, l'accesso con directory, le passkey e i codici di recupero.

![Credenziali, con il segreto mai mostrato](/synced/cascade/docs/screenshots/credentials.png)
![Progetti, e chi ne fa parte](/synced/cascade/docs/screenshots/projects.png)
![Il registro di controllo, e la verifica che sia integro](/synced/cascade/docs/screenshots/audit.png)
![Il proprio account e le sue chiavi API](/synced/cascade/docs/screenshots/account.png)

Che cosa significa in pratica: tutto ciò che Cascade sa fare lo si può fare da questa schermata, su un computer d'impianto senza internet, senza una riga di curl.

L'editor parla la lingua di chi lo ha davanti. Il selettore nella barra in alto (e nella pagina di accesso) elenca ogni lingua con il suo nome, ricorda la scelta in quel browser e la prima volta parte nella lingua del browser. I titoli dei passaggi e la loro guida, i tipi di credenziale, i pulsanti, i rifiuti inviati dal server, le date, i numeri e le durate compaiono tutti nella lingua scelta, e l'arabo va da destra a sinistra, con il canvas del flusso di lavoro disegnato comunque da sinistra a destra come per tutti. Una lingua viene offerta solo quando ci sono tutte le sue parole: `web/src/i18n/check.mjs` fa fallire la compilazione quando le manca una riga, un segnaposto o una forma plurale, e `web/scripts/i18n-scan.mjs` la fa fallire per il testo scritto direttamente in una schermata. Le parole stanno in `web/src/i18n/locales/<language>/`, e un test Go verifica rispetto a esse ogni tipo di passaggio o rifiuto che il server acquisisce. L'output di un'esecuzione, e qualsiasi cosa abbia detto un programma chiamato da un passaggio, viene mostrato com'è stato registrato.

Che cosa significa in pratica: gli operatori leggono la schermata nella propria lingua, e una nuova schermata non può uscire con una riga di inglese che nessuno ha tradotto.
