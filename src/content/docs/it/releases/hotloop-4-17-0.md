---
title: "Note di rilascio: HotLoop core 4.17.0"
description: "Cosa porta HotLoop core 4.17.0, cosa cambia all'aggiornamento e cosa leggere prima di toccare un impianto in funzione."
sidebar:
  label: "4.17.0"
---

La fase 2 della base di automazione, UniFi in sola lettura e le password dei dispositivi cifrate a riposo. Partendo dalla 4.16.0 basta un normale `helm upgrade`, ma le password dei tuoi dispositivi vengono cifrate al primo avvio e da quel momento la chiave fa parte dei tuoi dati. Leggi «Aggiornare dalla 4.16.0» più sotto prima di toccare un impianto in funzione.

Le note complete sono nel README: Cosa è cambiato nella 4.17.0.

## In breve

- **La base di automazione, fase 2.** Helper (i valori di proprietà delle persone dell'impianto, rifiutati e mai troncati), il logbook (un'unica cronologia di cambi di stato, scritture, allarmi, esecuzioni e configurazione), passi di condizione, attesa e arresto e `forSec` su un trigger di stato, script (scrivi il ciclo CIP una volta e lancialo da ovunque), ricette (tutti i setpoint di una qualità partono insieme o non parte nessuno, riletti dal dispositivo) e blueprint (una regola scritta una volta, compilata per ogni pompa, fissata alla sua versione finché qualcuno non rivede l'aggiornamento). MCP passa da 16 a 25 strumenti.
- **UniFi Network, in sola lettura.** Switch, porte, PoE, WAN e client come tag, un login per console, certificato fissato. Il cassetto di un PLC silenzioso dice a quale porta dello switch è collegato e se il link è attivo, e un estraneo su una rete marcata OT fa scattare un allarme. Provato in sola lettura su console reali. **Non ancora provato:** un vero cavo staccato su un dispositivo sorvegliato e un telefono che entra in una rete marcata OT. Quei due allarmi sono provati nei test e da nessun'altra parte finché qualcuno non fa entrambe le cose al rack.
- **Le password dei dispositivi sono cifrate** nel database e nei backup, con una chiave che il chart genera in `<release>-secret-key` e conserva.
- **Correzioni in cui un impianto in 4.16.0 può inciampare:** un Edge Relay del chart o dell'unità Quadlet ignorava ogni configurazione inviata, e uno con la persistenza disattivata non si avviava; una modifica manuale nell'editor delle regole azzerava il budget di esecuzioni della regola; il verdetto del prompt del comando poteva spostare Set da sotto il clic; un aggiornamento in ritardo poteva riportare la schermata Entities indietro nel tempo; una regola mai eseguita diceva di essere stata eseguita 739887 giorni fa; i deploy dell'App Store non portavano nessun tenant.

### Modifiche all'API

- Un orario che non è ancora arrivato viene omesso, non inviato come `0001-01-01T00:00:00Z`: `lastRun`, `lastPoll`, `lastGood`, `clearedAt`, `ackedAt`, `shelvedUntil`, `raisedAt` e il resto, anche sul feed in tempo reale.
- Nuove route: `/api/helpers`, `/api/logbook`, `/api/scripts`, `/api/recipes`, `/api/blueprints`, `POST /api/automations/{id}/blueprint-upgrade`, `/api/devices/{id}/network`, `/api/unifi/{id}/...` e `DELETE /api/fleet/{id}/config`. Tutte in docs/API.md.
- Nuovi permessi, e il ruolo operatore li ha: `helpers.write`, `scripts.run`, `recipes.apply`, `blueprints.apply`. Scrivere script, ricette e blueprint spetta all'amministratore.
- I tag portano `deviceClass`; le regole portano `blueprintId`, `blueprintVersion` e `blueprintInputs`.

### Aggiornare dalla 4.16.0

- `helm upgrade <release> hotloop/hotloop --version 4.17.0 --reset-then-reuse-values`. Non con `--reuse-values`, che perde i nuovi valori predefiniti e fallisce il rendering. Selettori e volume claim non cambiano; l'unico oggetto nuovo è il Secret della chiave.
- Le migrazioni da 0009 a 0015 vengono eseguite all'avvio (helper, logbook, script, classe di dispositivo dei tag, ricette, blueprint, UniFi). Tutte additive. Fai prima un `pg_dump`.
- `HOTLOOP_SECRET_KEY_FILE`: il chart genera la chiave con questo aggiornamento e il Gateway cifra a quell'avvio ogni password di dispositivo salvata. Senza la chiave in seguito, quei dispositivi restano giù con un errore che nomina la chiave. Un backup fatto dopo l'aggiornamento si ripristina solo con quella chiave, o con `--restore-keep-unreadable-credentials`, che lascia quei dispositivi giù finché qualcuno non reinserisce le password. Conserva il Secret separato dai tuoi backup. Tornare alla 4.16.0 significa ripristinare il dump fatto prima dell'aggiornamento.
- Generi il chart con `helm template` invece di installarlo? Porta la tua chiave in `secretKey.existingSecret`, altrimenti ogni rendering ne crea una nuova.
- Edge Relay: un file di dispositivi inviato sta in `/data/pushed-devices.json` e vince sui `devices` del chart finché esiste; `DELETE /api/fleet/{id}/config` lo cancella. Un invio fallito sulla 4.16.0 resta trattenuto sul broker e arriva al primo avvio della 4.17.0. Chi usa Quadlet prende la nuova unità. Con `persistence.enabled=false` ora si avvia, ma perde la coda di inoltro, ogni file inviato e il certificato OPC UA a ogni sostituzione del pod.
