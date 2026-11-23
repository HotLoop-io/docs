---
title: "Il registro delle attività"
description: "Cambi di stato, scritture, allarmi, esecuzioni di regole e modifiche di configurazione su un'unica linea del tempo, per l'impianto, un'area o un'entità."
---

Un'unica linea del tempo di ciò che è successo nell'impianto, dal più recente: la pompa si è avviata, qualcuno ha scritto 180 nel setpoint della zona 1, l'allarme di temperatura alta è scattato ed è stato riconosciuto, è stata eseguita l'automazione di raffreddamento, un dispositivo è stato riconfigurato. Per tutto l'impianto, un punto dell'albero delle apparecchiature e tutto ciò che sta sotto, o una sola entità. È la scheda Registro, una sezione del pannello di ogni entità, `GET /api/logbook` (vedi [l'API HTTP](/it/iot/api/#registro-eventi)) e lo strumento MCP `get_logbook` (vedi [MCP](/it/iot/mcp/)).

La prima domanda quando qualcosa va storto è «che cosa è successo subito prima?», e finora la risposta stava in cinque posti: l'audit delle scritture, lo storico degli allarmi, le esecuzioni delle automazioni, il log di sistema e la memoria di nessuno su ciò che ha fatto l'apparecchiatura stessa. Il registro delle attività è quei cinque in un'unica lista.

## Che cosa contiene

| Tipo | Da | Che cosa dice una riga |
|---|---|---|
| `state` | `entity_state_log` | lo stato di un'entità è cambiato: `changed to on (was off)` |
| `write` | `write_audit` | una scrittura su un tag, riuscita, rifiutata o fallita, da chi e attraverso quale porta |
| `alarm` | `alarm_events` | un allarme scattato, riconosciuto, azzerato, sospeso, con la nota data |
| `automation` | `automation_runs` | una regola è stata eseguita, come è finita, che cosa l'ha avviata |
| `event` | `events` | modifiche di configurazione, riepiloghi delle chiamate di servizio e motivi dati per le scritture, e ciò che una console UniFi segnala nell'istante in cui accade, archiviato sotto lo switch o l'access point a cui si riferisce (uno switch che perde il contatto è un avviso) |
| `script` | `script_runs` | uno [script](/it/iot/scripts/) è stato eseguito, come è finito, chi l'ha avviato e che cosa l'ha chiamato |
| `recipe` | `recipe_applications` | una [ricetta](/it/iot/recipes/) è stata applicata o rifiutata: quale versione, da chi, quanti target hanno ricevuto il valore e sono stati riletti |

Solo `state` è nuovo. Gli altri vengono letti dove già si trovano, al momento della query, e uniti. Nulla viene scritto due volte, quindi nulla può contraddire la traccia da cui proviene, e ogni traccia mantiene la propria conservazione (sotto).

Dal log di sistema il registro prende la categoria `config` e le righe proprie della categoria `write`: il riepilogo di una chiamata di servizio, una chiamata di servizio di un allarme, il motivo dato per una scrittura. Le righe «wrote ...» e «write of ... refused» del write gate stesso vengono escluse, perché dicono esattamente ciò che l'audit delle scritture già contiene e altrimenti ogni scrittura comparirebbe due volte.

### Che cosa non contiene di proposito

**Le letture numeriche.** Un sensore, un numero, un anello o un contatore PLC cambia a ogni interrogazione, e ogni lettura è già nello storico. Registrarle di nuovo seppellirebbe ogni riga che qualcuno vuole leggere sotto un milione al giorno che nessuno vuole. Ricavatene invece i trend.

**I pulsanti.** Lo stato di un pulsante è l'ora della sua ultima pressione, e ogni pressione è già una scrittura nell'audit. Inoltre torna a sconosciuto a ogni riavvio, il che sarebbe una riga per pulsante per riavvio senza dire nulla.

**Gli stati delle entità di allarme.** La storia propria dell'allarme è nel registro come righe `alarm`, con più contenuto (il valore, la nota, chi l'ha riconosciuto).

Tutto il resto viene registrato: sensori binari, interruttori, testo, selezioni, motori, valvole, helper e script man mano che arrivano.

**Gli helper vengono registrati da chi li ha cambiati.** La modifica di un helper viene scritta nel registro nella stessa transazione del suo valore, dal processo che ha fatto la modifica, con chi l'ha fatta, da dove e con quale id di chiamata, e senza limiti di frequenza. Il registratore lascia stare gli helper: gira solo nel Gateway, quindi la modifica di un agente tramite `--mcp-stdio` gli sfuggirebbe, e ogni processo che detiene l'helper vede la modifica, quindi verrebbe registrata una volta per processo. La pianificazione è l'eccezione, perché nessuno la imposta e la muove l'orologio: il registratore la annota come qualsiasi altra entità.

## Rimbalzo

Un contatto che rimbalza a 10 Hz è un solo fatto («ha rimbalzato, tante volte»), non trentaseimila righe all'ora. Ogni entità ha dieci cambi di seguito, poi uno ogni due secondi. Un cambio oltre questo non viene registrato, e viene contato nella riga successiva dell'entità:

```
changed to closed (was open); 14 changes before this not logged, it was changing faster than the logbook records
```

Il conteggio è esatto: le righe più i loro conteggi sono tutti i cambi che l'entità ha fatto. Quando il rimbalzo cessa, lo stato finale dell'entità viene sempre registrato, entro due secondi, così il registro non finisce mai su uno stato che l'apparecchiatura ha lasciato. Il numero soppresso dall'avvio è `suppressed` in `/api/diagnostics`, sotto `logbook`.

## last_changed sopravvive a un riavvio

Lo stato di un'entità è calcolato dai tag in tempo reale e mai memorizzato, quindi prima del registro ogni riavvio faceva sembrare ogni entità appena cambiata. Il registro conserva lo stato più recente di ogni entità tracciata e quando è cambiato l'ultima volta (`entity_last_state`), e il motore delle entità lo legge all'avvio. Un'entità il cui stato torna uguale mantiene il suo `last_changed`.

Un riavvio visto dall'interno appare così: un dispositivo non è ancora connesso, quindi le sue entità diventano non disponibili, poi sconosciute, poi mostrano la loro lettura. Questi passaggi sono questo processo che si mette in pari, non l'impianto che cambia, quindi si aspetta che passino. Uno stato che è davvero cambiato mentre il Gateway era fermo riceve un `last_changed` nuovo e una riga che dice com'era prima. Per lo stesso motivo il registro trattiene un cambio a non disponibile o sconosciuto per il primo minuto dopo un avvio: un dispositivo ancora fermo dopo quel tempo viene registrato allora, all'ora in cui è stato visto fermo la prima volta.

## Filtri

- **Dove:** un nodo dell'albero delle apparecchiature e tutto ciò che sta sotto. Un luogo viene trasformato in tutti i nomi con cui le tracce lo conoscono: le entità che vi si trovano (per il loro posto o, in mancanza, quello del loro dispositivo, la stessa regola della schermata Entità), i dispositivi che vi si trovano e ogni tag che portano, gli allarmi su quei tag, le automazioni con un trigger su uno qualsiasi di essi e il nodo stesso per le sue modifiche di configurazione. Anche l'esecuzione di un'automazione è in un luogo se vi ha scritto mentre girava, qualunque cosa l'abbia avviata. Gli eventi di una console UniFi si trovano tramite la rete, non tramite qualcosa che una persona ha collocato nell'albero: lo switch a cui è appeso un dispositivo collegato, e ogni switch tra lui e il gateway, così uno switch che cade compare sotto ogni riga che alimenta. Una console collocata nell'albero trova gli eventi su tutto ciò che ha adottato. Vedi [UniFi Network](/it/iot/unifi/#eventi).
- **Entità:** lo stesso, per una sola entità: i suoi cambi di stato, le scritture su di essa e sui suoi tag, i suoi allarmi, le regole che innesca o che hanno scritto su di essa, e le modifiche di configurazione su di essa o sui suoi tag. Un'entità eliminata nel frattempo si trova ancora con il nome che aveva.
- **Chi:** parte dell'attore, senza distinguere maiuscole: `alice`, `automation:cooldown` (le esecuzioni della regola e ogni scrittura che ha fatto), `mcp:` (tutto ciò che ha fatto un agente). Un cambio di stato fatto dall'apparecchiatura da sola non ha attore.
- **Tipi:** uno qualsiasi dei cinque.
- **Quando:** `from` e `to`.

La paginazione avviene tramite cursore, l'ora, il tipo e l'id dell'ultima riga, così una pagina non viene mai spostata dalle righe aggiunte dopo la precedente.

La schermata si aggiorna dal vivo. Il flusso dal vivo guarda le tracce una volta al secondo mentre qualcuno sta guardando, e invia un evento `logbook` che nomina i tipi con qualcosa di nuovo; la schermata chiede quindi di nuovo la sua pagina. Osserva le tabelle, non questo processo, quindi una scrittura fatta da un agente tramite `--mcp-stdio`, che è un altro processo, compare comunque.

## Per quanto tempo conserva

`entity_state_log` è partizionata per mese, in entrambe le modalità di storico (è una normale tabella partizionata PostgreSQL che `tag_history` sia o no una hypertable), e un mese viene eliminato per intero quando ogni riga al suo interno è più vecchia di `HOTLOOP_LOGBOOK_RETENTION_DAYS`. Predefinito **90**. Eliminare un mese è istantaneo; eliminarne le righe una a una no, ed è per questo che è partizionata. Quindi una riga viene conservata tra 90 giorni e 90 giorni più un mese. `0` conserva tutto, e il Gateway lo dice all'avvio, perché la tabella cresce allora finché il volume non si riempie.

La manutenzione propria del registro fa questo, una volta all'avvio e poi ogni giorno. Crea in anticipo la partizione del mese scorso e quelle dei tre mesi successivi, così una riga ha sempre dove cadere; una riga di un mese senza partizione cade nella partizione predefinita, e la manutenzione le sposta nel loro mese quando lo crea (ed è ciò che accade dopo un ripristino, vedi [Backup e ripristino](/it/iot/backup/)) oppure le elimina quando superano la conservazione.

Le altre tracce conservano ciò che hanno sempre conservato:

| Traccia | Conservato |
|---|---|
| `write_audit` | tutto, finché qualcuno non lo riduce |
| `alarm_events` | tutto, finché qualcuno non lo riduce |
| `automation_runs` | le 500 esecuzioni più recenti di ogni automazione |
| `events` | le 100.000 righe più recenti |

Quindi, in un impianto molto attivo, le scritture e gli allarmi del registro possono risalire più indietro dei suoi cambi di stato, e le sue esecuzioni di automazioni e modifiche di configurazione meno. Il registro mostra ciò che hanno le tracce.

## Registra un solo processo

Registra il Gateway. Un secondo processo avviato con `--mcp-stdio` (l'helper di un agente accanto al Gateway) legge il registro e la sua linea di base, così ciò che dice su `last_changed` concorda con quello del Gateway, ma non scrive nulla e non mantiene nulla: due registratori annoterebbero ogni cambio due volte.

Il registratore è un hook sul motore delle entità che si limita ad accodare. Una volta al secondo, una goroutine trasforma ciò che è in coda in righe, applica il limite di frequenza e le scrive con un `COPY` e un upsert degli stati più recenti, in una transazione. La coda contiene 50.000 cambi; oltre, i più vecchi vengono scartati e contati. Un database fermo mantiene le righe in coda, fino allo stesso limite, ed entrano quando torna. `/api/diagnostics` mostra tutto sotto `logbook`:

```json
{"recording":true,"retentionDays":90,"queued":0,"dropped":0,"written":212,"suppressed":36,"writeErrors":0}
```

`dropped` sopra zero significa che nel registro mancano dei cambi; `queued` che continua a crescere significa che il database non regge il ritmo; `lastError` dice perché l'ultima scrittura è fallita.

## Backup

Entrambe le tabelle sono in ogni backup: `entity_last_state` dopo le tabelle delle entità, `entity_state_log` subito prima di `tag_history`. Vedi [Backup e ripristino](/it/iot/backup/).
