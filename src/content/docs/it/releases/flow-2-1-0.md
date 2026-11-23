---
title: "Note di rilascio: HotLoop Flow 2.1.0"
description: "Cosa porta HotLoop Flow 2.1.0, cosa cambia con l'aggiornamento e cosa leggere prima di toccare un impianto in funzione."
sidebar:
  label: "2.1.0"
---

HotLoop Flow 2.1.0 comprende le fasi da 0 a 2 della [roadmap](/it/flow/roadmap/) più le lacune di ogni giorno che impedivano di mettere in produzione un flusso vero. Ogni deploy è ora un record che puoi confrontare, testare, rivedere e ripristinare. Un flusso può avere test che girano prima che arrivi un deploy sbagliato. Un salvataggio riavvia i nodi che hai modificato e lascia in pace il resto dell'impianto.

Niente in questa versione cambia il modo in cui un file di flussi viene letto o scritto. Il ciclo di andata e ritorno byte per byte resta intatto, quindi un `flows.json` che girava sulla 2.0.5 gira sulla 2.1.0.

## Novità

**Deploy**
- Ogni deploy è un record: chi, da dove, quando, la nota, la revisione sostituita, il file di flussi byte per byte e le credenziali cifrate così com'erano. `GET /deployments` li legge. `history.retain` tiene gli ultimi 100 per impostazione predefinita.
- Un confronto che si legge come una revisione: nodo per nodo, proprietà per proprietà, con il layout separato dalla logica e le credenziali mai mostrate. Nell'API, da riga di comando (`hotloop-flow diff`) e come driver di diff di git stesso.
- Il rollback rimette un vecchio record come nuovo deploy, flussi e credenziali insieme, così un nodo eliminato torna con la password del suo broker.
- Deploy parziale: un salvataggio riavvia i nodi che sono cambiati. Le sessioni MQTT, i listener e le code Delay di tutto il resto continuano a girare. `HotLoop-Flow-Deployment-Type` (o l'intestazione di Node-RED) sceglie nodi, flussi o completo.
- L'editor rivede prima di fare il deploy, con il confronto disegnato sulla tela e una nota, e mostra la cronologia con un pulsante di rollback.
- Flussi come codice: `hotloop-flow deploy` stampa la differenza rispetto a ciò che è in esecuzione e fa il deploy sulla revisione da cui è partito, così una corsa critica diventa una pipeline rossa. `hotloop-flow export` restituisce il file in esecuzione byte per byte. `hotloop-flow token` crea un token API e l'hash da configurare per esso.
- Mirror git facoltativo: con `history.git` impostato, ogni deploy è un commit firmato da chi lo ha eseguito.

**Test**
- Test dei flussi: `flows.test.yaml` accanto a `flows.json`, eseguito da `hotloop-flow test` (JUnit con `-junit`) sul runtime vero e sui nodi veri. Delay, Trigger, Inject, Join e Batch girano su un orologio che il test sposta, così cinque minuti di Delay sono un solo passo. Tutto ciò che parla con il mondo esterno, MQTT, HTTP, PostgreSQL, InfluxDB, TCP, UDP, WebSocket, file, exec, viene sostituito, e il test controlla che cosa sarebbe uscito.
- Il blocco del deploy: attiva `tests.gate` e un deploy i cui flussi falliscono la suite restituisce un 422 con il rapporto completo. I rollback non passano dal blocco, perché un rollback è la via d'uscita.
- L'editor trasforma un messaggio di debug in un test e lo esegue.

**Nodi e protocolli**
- JSONata, verificato con la suite pubblicata di jsonata-js 2.2.2: passano 1673 casi su 1686, e i 13 che non passano sono fissati per nome con il motivo.
- Inject scatta su un crontab, nello stesso minuto in cui lo farebbe Node-RED, con i cambi d'ora di sei fusi verificati.
- MQTT 5 (proprietà, opzioni di sottoscrizione, scadenza della sessione) e il last will. MQTT 3.1.1 funziona ancora.
- TLS su TCP, sulla richiesta HTTP e su MQTT tramite un nodo `tls-config`. Il listener e il client WebSocket partono, e il client usa TLS.
- Cookie e multipart su HTTP, verificati con le librerie che usa Node-RED.
- Split, Join e Batch funzionano come quelli di Node-RED: streaming, timeout, riduzione, intervalli. Link Call e la modalità di ritorno di Link Out.
- Una password può stare in un Secret montato invece che nel flusso. Il chart Helm ottiene `secrets.mounts`.

**Accesso**
- Accesso in due passaggi (TOTP), gratuito, per chiunque lo attivi dall'editor.
- Blocchi, sessioni che sopravvivono a un riavvio e un registro di audit di chi ha fatto cosa e da dove (`GET /audit`, `audit.read`).

## Cosa è cambiato

- Il blocco è attivo per impostazione predefinita: 5 errori per un account da un indirizzo, o 20 da un indirizzo, lo bloccano per 15 minuti con un 429. `auth.lockout` cambia i numeri.
- Le sessioni sono conservate in `data/sessions.json` come hash e seguono la configurazione a ogni richiesta, quindi togliere un permesso o un utente dalla configurazione ha effetto alla richiesta successiva.
- Un rollback è un riavvio completo, a meno che tu non ne chieda meno.
- L'immagine include `LICENSE`, `NOTICE` e `THIRD_PARTY_LICENSES` in `/usr/share/doc/hotloop-flow/`. `THIRD_PARTY_LICENSES` elenca ogni modulo Go e pacchetto npm nel binario con la sua versione e il testo della licenza, generato in fase di build. La build fallisce con una dipendenza GPL, AGPL o LGPL o che nessuno sa identificare.
- `NOTICE` era sbagliato. Diceva che qui dentro non c'era codice di Node-RED. Cron, Split, Join, Batch, Link Call, tls-config e il lavoro su cookie e multipart HTTP sono porting, e ora elenca ogni file portato con la sua provenienza, chi detiene il copyright e la licenza, con il testo ISC completo per cronosjs e quello MIT per il resto. Ogni file portato dice lo stesso in testa.
- Un deploy rifiutato non elimina più le credenziali in memoria, e il doppio clic su un nodo in Chromium apre la sua finestra. Entrambi i problemi sono emersi durante questo lavoro.

## Note di aggiornamento

Dalla 2.0.5 basta cambiare l'immagine (`helm upgrade`, o il nuovo tag nella tua unità Quadlet). Nessuna migrazione, nessun flag.

- Il primo avvio crea `sessions.json`, `audit.log` e una directory `deployments` sotto `data.dir`. Prima le sessioni erano in memoria, quindi dopo l'aggiornamento tutti accedono una volta.
- Tutto ciò che è nuovo nella configurazione è facoltativo e disattivato o innocuo per impostazione predefinita. Niente di ciò che hai smette di funzionare.
- Token WebSocket: l'editor ora invia il suo token come sottoprotocollo, `hotloop-flow.bearer.<token>`, offerto accanto a `hotloop-flow`. È il modo preferito per tutto ciò che si collega a `/comms`. Uno script che invia `?access_token=` nell'URL continua a funzionare, e il server registra un avviso per ogni connessione di questo tipo, spiegando che il token finisce nei log di proxy e di accesso e che cosa inviare invece. L'URL non viene mai scritto nel log di Flow né nella traccia di audit. La rimozione della forma con URL aspetta una futura versione maggiore.

## Nuove impostazioni

| YAML | Ambiente | Predefinito |
|---|---|---|
| `tests.gate` | `HOTLOOP_FLOW_TESTS_GATE` | `false`. `true` rifiuta un deploy i cui flussi falliscono `flows.test.yaml`. |
| `tests.timeout` | | `2m`, il tempo reale massimo di un'esecuzione dei test. Un'esecuzione che non riesce a finire rifiuta il deploy. |
| `secrets.allowedPaths` | `HOTLOOP_FLOW_SECRET_ALLOWED_PATHS` | vuoto. Alberi aggiuntivi da cui si può leggere un `tls-config` o un file di credenziali, oltre a `data.dir`. Non è l'ambito dei nodi file: un nodo File In non può ancora leggerli. |
| `secrets.mounts` (chart) | | vuoto. Secret di Kubernetes montati in sola lettura, ciascuno aggiunto all'ambito dei secret. |
| `auth.tokens` | `HOTLOOP_FLOW_DEPLOY_TOKEN_HASH` | nessuno. Token API per le macchine, conservati come hash. La variabile d'ambiente crea un token `deploy` che può leggere e fare il deploy e nient'altro. Creane uno con `hotloop-flow token`. |
| `auth.lockout` | | `attempts: 5`, `perAddress: 20`, `window: 15m`, `duration: 15m` |
| `history.retain` | | `100`. `0` conserva ogni record. |
| `history.git` | `HOTLOOP_FLOW_GIT_URL`, `HOTLOOP_FLOW_GIT_USERNAME`, `HOTLOOP_FLOW_GIT_PASSWORD` | disattivato. |
| `audit.maxBytes`, `audit.keep` | | 16 MiB, 4 file. |

Immagine: `ghcr.io/hotloop-io/hotloop-flow:2.1.0`, linux/amd64 e linux/arm64. Chart: `https://hotloop.io/hotloop-flow/`. Il README di questo tag contiene il resto: https://github.com/HotLoop-io/hotloop-flow/blob/v2.1.0/README.md
