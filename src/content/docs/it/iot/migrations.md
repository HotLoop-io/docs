---
title: "Le migrazioni aggiungono soltanto"
description: "Perché una migrazione non elimina, non rinomina e non cambia mai il tipo di nulla, così un aggiornamento fallito torna all'ultima versione senza perdere righe."
---

Una migrazione aggiunge. Non elimina, non rinomina e non cambia mai il tipo di nulla, non irrigidisce mai una colonna o un vincolo su cui scrive la versione precedente, e non cancella mai dati. Questa è tutta la regola, e un test fa fallire la build quando una migrazione la viola.

## Perché

Ogni scatola segue `:stable` e l'aggiornamento automatico di Podman la sposta. Quando una versione migra il database e poi fallisce il controllo di integrità, l'aggiornamento viene annullato e la versione precedente parte sullo schema lasciato dalla nuova. Una migrazione non si può annullare insieme a lei. Quindi la versione precedente deve funzionare sul nuovo schema, e l'unico modo per promettere questo è che il nuovo schema contenga tutto ciò che conteneva il vecchio, nella stessa forma, accettando le stesse scritture.

Aggiungete una colonna e la versione precedente non la guarda mai. Eliminatene una e la prima query della versione precedente è un errore, in un impianto, alle tre di notte, senza più nulla a cui tornare.

Il chart Helm ha lo stesso problema: `helm rollback` rimette l'immagine vecchia e lascia il database dove l'ha portato la nuova.

## Le modifiche che sembrano richiedere di più

Non si può eliminare, quindi una modifica che sembra richiederlo si fa aggiungendo e poi lasciando in pace la cosa vecchia.

- **Rinominare una colonna.** Aggiungete la nuova colonna con un valore predefinito. La nuova versione legge la nuova e scrive in entrambe. La vecchia colonna resta, inutilizzata, per sempre.
- **Cambiare un tipo.** Lo stesso: una nuova colonna del nuovo tipo, la nuova versione scrive in entrambe, la vecchia colonna resta.
- **Una colonna che ora deve essere NOT NULL.** Si impone nell'applicazione. Se un vincolo serve davvero, va su una tabella nuova.
- **Ritirare una tabella.** Si smette di usarla. Resta.
- **Pulire i vecchi dati.** Lo fa l'applicazione a runtime (la conservazione lo fa già), non una migrazione.

Le colonne morte costano qualche byte. Una migrazione che non si può annullare mentre la versione a cui appartiene si può annullare costa un impianto.

## La protezione: un'applicazione rifiuta uno schema di cui non ci si può fidare

Aggiungere è sicuro per una versione, non per sempre. Una versione è stata provata solo sullo schema subito successivo, quindi l'applicazione conta di quanto il database è avanti.

`schema_migrations` registra, accanto a ogni migrazione, quale versione l'ha applicata (`app_version`). All'avvio, prima di toccare qualsiasi cosa, l'applicazione confronta le migrazioni del database con quelle incorporate:

| Il database contiene | Cosa succede |
|---|---|
| Niente che questa versione non conosca | Parte |
| Migrazioni di una versione più recente | Parte, con un avviso che nomina entrambe le versioni. È un aggiornamento annullato. Non migra nulla, e la versione più recente trova il proprio schema già a posto quando torna |
| Migrazioni di due o più versioni più recenti | Si rifiuta di partire, nominando questa versione, la migrazione più recente che conosce, la più recente nel database e le versioni che le hanno scritte |

Il rifiuto si legge così:

```
refusing to start: this database's schema is more than one release ahead of
HotLoop 4.18.10. 0022_x.sql is the newest migration this release knows, and the
database has 2 it does not (up to 0024_z.sql), written by 4.19.0 and 4.20.0.
Only the release right after this one is known to work on that schema. Start
HotLoop 4.20.0 or newer against this database (an update to :stable gets
there), or restore a backup taken by HotLoop 4.18.10 or earlier
```

Su una scatola che segue `:stable` l'aggiornamento successivo lo risolve, perché `:stable` passa alla versione più recente, che conosce ogni migrazione. L'unità resta quindi in «activating». È voluto: una scatola ferma che dice perché è meglio di una scatola in funzione e sbagliata.

La protezione agisce che l'avvio migri o no (`HOTLOOP_DB_MIGRATE`), e in un ripristino, che apre il database nello stesso modo. Un database precedente alla protezione non ha la colonna `app_version` e non può contenere una migrazione più recente della versione che lo legge, quindi parte; la colonna viene aggiunta al primo avvio di una versione che ha la protezione.

## Dimostrarlo per una versione reale

Prima che una versione esca, la versione precedente viene avviata sul database migrato dalla nuova e le si fa eseguire l'accesso, leggere dispositivi e tag, scrivere attraverso la porta e leggere lo storico. Se non ci riesce, la versione non esce.
