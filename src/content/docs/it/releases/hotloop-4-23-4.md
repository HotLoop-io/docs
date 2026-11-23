---
title: "Note di rilascio: HotLoop core 4.23.4"
description: "Cosa porta HotLoop core 4.23.4, cosa cambia all'aggiornamento e cosa leggere prima di toccare un impianto in funzione."
sidebar:
  label: "4.23.4"
---

L'importazione delle schermate passa da CODESYS a TwinCAT. Un file `.TcVIS`, e gli export di cds-text-sync e codescribe, arrivano come schermata HotLoop con i loro pulsanti, cornici e spie, e ciò che non è potuto arrivare viene elencato con il suo testo prima di salvare qualsiasi cosa.

## Cosa è cambiato

- **Le schermate TwinCAT si importano.** Un file TwinCAT `.TcVIS` è la stessa visualizzazione nell'XML d'archivio dell'IDE, quindi passa dal convertitore CODESYS. Verificato sul vero esempio TwinCAT PackML (tre schermate, MIT, licenza conservata accanto): 60 elementi mappati, nessuno non mappato. Vedi [Import a CODESYS screen](/it/iot/codesys-screen-import/).
- **Pulsanti.** Ogni assegnazione semplice nell'azione di input di un pulsante (`X := 5`, `X := TRUE`, un membro di enumerazione) diventa una card pulsante che scrive quel valore, con la didascalia come etichetta. Un input Toggle configurato diventa un pulsante di accensione e uno di spegnimento. Il codice che è più di un'assegnazione (una condizione, una chiamata, aritmetica) viene riportato con il suo testo. Le enumerazioni OMAC PackML sono note; qualsiasi altra va in `enums` dell'importazione, e un membro senza numero noto viene scritto per nome e lo si dice.
- **Spie e occultamento tramite un'espressione.** La variabile di una spia o una variabile di invisibilità può essere un confronto di un tag con un numero, TRUE, FALSE o un membro di enumerazione, uniti con NOT, AND e OR e parentesi. Un confronto di due tag, l'aritmetica e le chiamate non possono essere portati e vengono riportati.
- **Cornici.** Una cornice mostra un'altra visualizzazione. Invia gli altri file del progetto insieme al primo (`codesysRelated`; nella finestra di dialogo, scegli più file e il primo è la schermata) e la visualizzazione della cornice viene collocata nella cornice con ogni input legato alla variabile data alla cornice.
- **Le regole dei simboli si combinano.** Una regola `show` o `colors` può essere `{"all": [...]}` o `{"any": [...]}`, l'AND e l'OR di un PLC, a tre livelli di profondità e otto parti, e un tag perso fa sì che un `all` non valga mentre un `any` vale grazie agli altri. Una spia può portare una regola `lit` al posto del suo tag. Vedi [Dashboard](/it/iot/dashboards/).
- **Test.** Il test del contatore di energia limita ciò che i contatori hanno contato in base al tempo realmente trascorso, non a dieci secondi fissi.

## Migrazioni

Nessuna.

## Modifiche all'API

`POST /api/dashboards/import` accetta `codesysRelated` e `enums` accanto a `codesys`. Nessuna route è cambiata. Vedi [l'API HTTP](/it/iot/api/).

## Aggiornare dalla 4.23.3

Un normale `helm upgrade`. Nessuna migrazione e nessun nuovo segreto.

## Cosa non è provato

- Gli importatori sono stati provati contro l'esempio TwinCAT PackML e gli export di esempio di cds-text-sync e codescribe, non contro il progetto proprio di un cliente. Un progetto che usa più del linguaggio di visualizzazione elencherà di più ciò che non ha potuto collocare.
- Le espressioni sono confronti di un tag con una costante uniti da NOT, AND e OR. Tutto il resto viene riportato, non indovinato.
