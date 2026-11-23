---
title: "Note di rilascio: HotLoop core 4.16.0"
description: "Cosa porta HotLoop core 4.16.0, cosa cambia all'aggiornamento e cosa leggere prima di toccare un impianto in funzione."
sidebar:
  label: "4.16.0"
---

La prima versione pubblicata dalla 4.3.1 di agosto. Tutto da 4.4.0 a 4.15.3 è stato integrato ma mai pubblicato, quindi se sei alla 4.3.1 ricevi tutto in una volta, con un nome nuovo, un'immagine nuova, un chart nuovo e una licenza nuova. **Partendo dalla 4.3.1 non basta un semplice `helm upgrade`.** Leggi «Aggiornare dalla 4.3.1» più sotto prima di toccare un impianto in funzione.

Le note complete sono nel README: Cosa è cambiato nella 4.16.0 e, sotto, ogni versione fino alla 4.4.0.

## In breve

- **HotLoop Core: le entità.** Ogni tag è un'entità con un id stabile, collocata in un albero di apparecchiature ISA-95. Motori, valvole, anelli PID e il resto sono composti costruiti dai loro tag, ogni allarme è un'entità e ogni comando di un'entità passa dalla stessa porta di scrittura di una scrittura di tag. Gli agenti (MCP), le automazioni e le nuove schermate Entities e Plant le usano tutti. Una chiamata di servizio si può chiedere prima con `?dry_run=true`, e il prompt del comando ti dice «Would be refused: ...» prima che tu confermi.
- **Notifiche che arrivano sul telefono:** ntfy e il bot Discord con un pulsante Acknowledge, Gotify e un webhook Discord, con limiti di frequenza che riuniscono un diluvio in un solo riepilogo.
- **Correzioni che contano su un impianto in funzione:** togliere il rinvio (unshelve) poteva cancellare un allarme non riconosciuto; una sottoscrizione OPC UA poteva restare muta per sempre mentre la sessione diceva connesso; un dispositivo Modbus silenzioso impiegava fino a 15 minuti per risultare giù; un webhook fallito registrava il proprio URL, che per Discord e ntfy è la password; il ripristino caricava le colonne per posizione; ogni nuovo deploy sostituiva il certificato del server OPC UA, così Ignition smetteva di fidarsi; Discover tags importava ogni nodo OPC UA come float; la schermata Settings nominava variabili di polling che nessuno legge.
- **Ignition 8.3.9 legge il nostro server OPC UA**, verificato da un capo all'altro, e il server ora dichiara `HotLoop` come produttore.
- **L'Edge Relay arriva** con la sua immagine e il suo chart, in sincronia con il Gateway. TimescaleDB 2.30.1, e l'estensione ora si aggiorna da sola.

### Modifiche all'API

- Le liste vuote sono `[]`, mai `null`, ovunque, stream compresi.
- Gli intervalli di `/api/history` senza una lettura valida sono `null` (un vuoto), e le letture errate restano fuori dalle medie.
- Un errore che l'API non sa classificare è un 500 con un riferimento di log, non un 400. Un dispositivo che dà errore in scrittura o in esplorazione è un 502.
- Un servizio che un'entità di allarme non accetta (`alarm.turn_on`) è un 400. Prima rispondeva che andava bene e non faceva niente.
- Togliere il rinvio a un allarme che non è rinviato è un 409.
- Il JSON di un tag contiene sempre `minValue`, `maxValue` e `hasRange`.
- Novità: `?dry_run=true` su `POST /api/services/{domain}/{service}`. Solo `true` o `false`; qualsiasi altro valore è un 400.

### Aggiornare dalla 4.3.1

- Immagine `ghcr.io/hotloop-io/hotloop` (prima `ghcr.io/embernet-ai/industrial-iot`), repository dei chart `https://hotloop.io/hotloop`, chart `hotloop` (prima `industrial-iot`), e ogni variabile `IIOT_` diventa `HOTLOOP_`.
- Il nome del chart è nei selettori dei carichi di lavoro, che Kubernetes non cambia sul posto. Mantieni il nome della release e il namespace, poi: fai un `pg_dump` del database; elimina il vecchio Deployment (`<release>`) e lo StatefulSet (`<release>-postgresql`), che lasciano il volume del database dov'è; esegui `helm upgrade <release> hotloop/hotloop -f your-4.3.1-values.yaml`. Non con `--reuse-values`. Rinomina ogni `IIOT_` in `extraEnv` e togli un override di `image.repository`. Il nuovo pod del database monta il vecchio volume e il Gateway lo migra in avanti all'avvio.
- Licenza: i termini propri di HotLoop, non quelli che accompagnavano la 4.3.1. Gratis per uso domestico e di laboratorio; le aziende si registrano gratis tramite EmberNet. I termini attuali sono in LICENSE.
- C'è un login, le scritture sono disattivate per impostazione predefinita, e un fuso orario che non si carica ferma l'avvio invece di proseguire in UTC.
