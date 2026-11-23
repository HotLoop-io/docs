---
title: "Note di rilascio: HotLoop core 4.23.3"
description: "Cosa porta HotLoop core 4.23.3, cosa cambia all'aggiornamento e cosa leggere prima di toccare un impianto in funzione."
sidebar:
  label: "4.23.3"
---

Una schermata WebVisu mantiene la sua occultazione e i suoi colori di allarme quando arriva, e qualsiasi simbolo di qualsiasi schermata ora può essere mostrato e colorato da una regola su un tag. Una piccola correzione all'elenco dei backup viaggia con essa. Costruita solo per amd64; la build multi-architettura segue come versione successiva.

## Cosa è cambiato

- **Un simbolo può essere mostrato e colorato da regole.** `show` disegna un simbolo solo finché vale una regola su un tag, così una porta, una protezione o una pompa disegnate per uno stato ci sono solo in quello stato. `colors` sono fino a quattro regole, ciascuna con un tono (`ok`, `warn`, `bad` o `info`): la prima che vale colora il simbolo in quel tono, e quando nessuna vale viene disegnato com'era. Una regola è un tag e un confronto (`on`, `off`, `eq`, `ne`, `gt`, `ge`, `lt`, `le`). Una regola il cui tag non ha una buona lettura non vale per nulla e non nasconde nulla, così una connessione persa non fa mai sparire un simbolo. Il modulo dei simboli nel builder ha entrambe, e un file di schermata elenca e sposta i tag delle regole insieme al resto. Vedi [Dashboard](/it/iot/dashboards/).
- **L'importazione di schermate CODESYS porta Invisible e Toggle color.** La variabile Invisible di un elemento (e quella del suo gruppo) diventa una regola `show`, con `NOT x` che la rovescia, e la sua variabile Toggle color diventa una regola `colors` nel tono più vicino al colore di allarme dell'elemento stesso. Si trovano agli id che danno gli alberi di elementi dell'IDE CODESYS stesso. Ciò che non può portare è detto nell'importazione, con la variabile: queste due su una forma disegnata nell'immagine di sfondo (un tubo, un recipiente, una cornice), perché l'immagine è un'unica immagine, e ogni altra impostazione guidata da variabile (un riempimento, un colore di cornice o di testo, un movimento, un lampeggio, un elenco di testi). Vedi [Import a CODESYS screen](/it/iot/codesys-screen-import/).
- **L'elenco dei backup non fallisce mentre un backup viene eliminato.** Il backup programmato elimina i vecchi backup nella sua goroutine, e un elenco che cadeva nel mezzo falliva sul file mancante, cosa che l'API risponde come errore del server. Un backup andato ora viene lasciato fuori dall'elenco.

## Migrazioni

Nessuna.

## Modifiche all'API

La configurazione di un simbolo accetta `show` e `colors`. Nessuna route è cambiata. Vedi [l'API HTTP](/it/iot/api/).

## Aggiornare dalla 4.23.2

Un semplice `helm upgrade`. Nessuna migrazione e nessun nuovo secret. Un simbolo senza nessuna delle due regole viene disegnato come prima.

## Cosa non è provato

- L'importazione CODESYS è stata provata contro l'export dell'IDE stesso di una visualizzazione e la variabile di gruppo dell'esempio Refrigerator di CODESYS. Una schermata di un altro progetto può elencare di più che non ha potuto collocare.
- Le nuove regole dei simboli sono state provate dai test della suite, non sulla schermata di un impianto.
