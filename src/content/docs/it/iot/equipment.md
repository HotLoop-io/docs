---
title: "L'albero delle apparecchiature e le etichette"
description: "Un unico albero ISA-95 dall'impresa all'apparecchiatura, più etichette, perché regole e agenti parlino della pompa e non del registro 40001."
---

Un impianto ha già un suo modo di organizzarsi, e lo usano tutti i SCADA, MES e historian che possiede: ISA-95. Impresa, sito, area, linea, cella, unità, apparecchiatura. È quello che usa HotLoop, un unico albero, e non un elenco per i piani, un altro per le aree e un terzo per i dispositivi. Vedi [Entità](/it/iot/entities/) per ciò che vi è collegato.

## Livelli

| Livello | Che cosa è di solito |
|---|---|
| `enterprise` | L'azienda |
| `site` | Uno stabilimento |
| `area` | Un reparto o un edificio: Confezionamento, Servizi ausiliari, Parco serbatoi |
| `line` | Una linea di produzione |
| `cell` | Una cella di lavoro su una linea, o una cella di processo in un impianto a lotti |
| `unit` | Un'unità di produzione: un reattore, un refrigeratore, un forno |
| `equipment` | Una macchina o una sua parte: una pompa, uno skid, un motore |

Un figlio è sempre di un livello inferiore al suo genitore, quindi un sito non va mai sotto una linea. Può saltare dei livelli: un'unità direttamente sotto un'area va bene, e così una linea direttamente sotto un sito in un impianto senza aree. L'unica eccezione è `equipment` dentro `equipment`, perché uno skid contiene pompe e una pompa contiene un motore, e ISA-95 smette di dare nomi ai livelli molto prima che un impianto smetta di annidare le cose. Un nodo può stare alla radice a qualsiasi livello; la maggior parte degli impianti parte da `site`.

Due fratelli con lo stesso livello e lo stesso nome sono lo stesso luogo, quindi l'albero rifiuta il secondo.

Un nodo non può mai diventare il proprio antenato: spostare un nodo sotto sé stesso o sotto uno qualsiasi dei suoi discendenti viene rifiutato. L'unico modo per ottenere un ciclo è modificare a mano la tabella `equipment`. Se qualcuno lo fa, nulla di ciò che percorre l'albero si blocca, e la modifica di un nodo del ciclo viene rifiutata con un messaggio che nomina i nodi e dice di mettere a NULL il `parent_id` di uno di essi.

## Il testo di sito, area e linea funziona ancora

Ogni dispositivo ha campi di testo libero `site`, `area` e `line` da prima che esistesse l'albero. Non spariscono. L'editor dei dispositivi della 4.15 li scrive, `list_devices` e `describe_device` li leggono, e lo stesso fanno tutti gli agenti e gli script scritti da qualcuno contro di essi. Perciò il testo e l'albero sono mantenuti allineati, in entrambe le direzioni, nella stessa transazione della modifica:

**Salvare un dispositivo con il testo e senza `equipmentId`** trova il sito, l'area e la linea che il testo nomina, oppure li crea, ognuno sotto il precedente, e mette il dispositivo su quello più profondo. Due dispositivi con lo stesso testo finiscono sullo stesso nodo; non si duplica mai nulla. Il testo che avete inviato è esattamente quello che viene memorizzato: un client che non sa nulla dell'albero riceve ciò che ha sempre ricevuto, più un `equipmentId` che può ignorare.

**Salvare un dispositivo con un `equipmentId` che lo sposta** prende il testo dal percorso del nodo, qualunque sia il testo arrivato con esso. Mettete un dispositivo su una cella sotto `Plant A / Packing / Line 2` e il suo testo diventa `Plant A`, `Packing`, `Line 2`.

Due dettagli lo rendono sicuro per i client che non conoscono l'albero:

- Un testo che dice ancora ciò che dice il nodo attuale del dispositivo lascia il dispositivo dov'è. Il testo ha solo tre colonne, quindi un dispositivo su una cella o su una macchina sotto la sua linea può dire soltanto la linea. Salvarlo con lo stesso testo non lo fa salire alla linea.
- Un client che legge un dispositivo e lo rimanda per intero, `equipmentId` compreso, con il testo modificato, ottiene la modifica del testo. L'`equipmentId` che ha rimandato è quello che il dispositivo aveva già, quindi non è uno spostamento, e decide il testo.

Un sito viene trovato ovunque si trovi, non solo alla radice, quindi mettere `Plant A` sotto un'impresa non fa sì che il dispositivo successivo che dice `Plant A` ne crei un secondo.

**Rinominare o spostare un nodo** riscrive il testo di ogni dispositivo che si trova su quel nodo o sotto di esso, nella stessa transazione. Se qualcosa di tutto questo fallisce, non è successo nulla: un albero che dice una cosa e un testo di dispositivo che ne dice un'altra è esattamente ciò che l'allineamento dei due doveva impedire. La risposta e il log di sistema elencano ogni dispositivo il cui testo è cambiato.

### L'aggiornamento

La migrazione `0006_hierarchy.sql` costruisce l'albero dal testo che ogni dispositivo esistente già porta: un sito per ogni nome di sito distinto, un'area per ogni nome di area distinto sotto il suo sito, una linea per ogni linea distinta sotto la sua area, e ogni dispositivo sul nodo più profondo che il suo testo nomina. Un dispositivo con un'area e senza sito riceve un'area alla radice; uno con una linea e senza area riceve una linea direttamente sotto il suo sito. Un testo fatto solo di spazi non nomina nulla. Il testo viene usato esattamente come è memorizzato, spazi e maiuscole compresi, perché i nomi dell'albero sono ciò da cui il testo verrà riscritto in seguito, e togliere gli spazi durante l'aggiornamento sarebbe un cambio di nome silenzioso per ogni dispositivo che aveva uno spazio in più. Nessun testo di dispositivo cambia con l'aggiornamento.

Il lato Go colloca un dispositivo con le stesse regole, e un test tiene allineati i due lati: ogni dispositivo collocato dall'aggiornamento, salvato di nuovo senza toccarlo, resta dov'è e non fa crescere l'albero di nulla.

## Eliminare un nodo

**Un nodo con qualcosa sotto viene rifiutato**: nodi figli, o dispositivi collocati su di esso. Spostateli prima. Il rifiuto dice che cosa è di ostacolo.

L'alternativa era riassegnare i figli al genitore del nodo eliminato. Questo sposta ogni dispositivo sottostante e ne riscrive il testo, sotto un nodo che nessuno ha toccato, e può mettere una linea direttamente sotto un sito senza nessuna area in mezzo, un albero che nessuno ha disegnato. Togliere la collocazione ai dispositivi lascerebbe il loro testo a nominare un luogo che non esiste più, e il salvataggio successivo di uno qualsiasi di essi ricreerebbe il nodo senza avvisare. Entrambe le cose sorprendono. Un rifiuto che dice che cosa spostare no.

Le entità collocate su un nodo eliminato perdono la collocazione e tornano a seguire il proprio dispositivo.

## Le entità nell'albero

Ogni risposta di un'entità porta ora tre campi in più:

| Campo | Che cosa |
|---|---|
| `equipment_id` | Dove è collocata l'entità stessa, oppure null quando va semplicemente dove va il suo dispositivo |
| `area_id` | L'`area` più vicina al nodo dell'entità o sopra di esso, oppure il nodo del suo dispositivo quando non ne ha uno. Tutto ciò che raggruppa per area legge questo campo. Null quando non c'è nessuna area sopra |
| `labels` | I label_id dell'entità |

Il posto proprio di un'entità prevale su quello del suo dispositivo. Conta per un dispositivo che è un intero PLC: il suo tag di temperatura appartiene al forno, il suo tag del refrigeratore ai Servizi ausiliari. Collocate un'entità con `PUT /api/entities/{entity_id}`:

```json
{ "equipment_id": 42, "labels": ["critical"] }
```

`"equipment_id": null` la fa tornare a seguire il dispositivo. `labels` sostituisce l'intero insieme. Entrambi richiedono `entities.write`, come ogni altro campo del registro.

## Etichette

Un'etichetta è un tag nel senso comune: `critical`, `line 1 utilities`, `calibrate quarterly`. Dispositivi ed entità ne portano quante se ne vuole.

Un'etichetta ha un `label_id` e un `name`. Il `label_id` viene ricavato dal nome la prima volta (lettere minuscole, cifre e trattini bassi, `_2`, `_3` in caso di collisione) e non cambia mai, perché è ciò a cui si riferiscono automazioni e schermate. Il nome può cambiare quando volete. Potete anche scegliere voi il `label_id` quando ne create una.

Eliminare un'etichetta la toglie da tutto ciò che la porta.

Le etichette di un dispositivo si impostano con `PUT /api/devices/{id}/labels`, non con `POST /api/devices`. Ogni client che oggi salva un dispositivo invia il dispositivo intero senza etichette, e le cancellerebbe a ogni salvataggio.

## API

Gli endpoint di apparecchiature ed etichette usano nomi di campo in snake_case, come gli endpoint delle entità, perché l'albero è il registro delle aree del modello delle entità ed è fatto per gli stessi consumatori. Il nuovo campo del dispositivo è `equipmentId`, in camelCase, come il resto dell'API dei dispositivi.

| Endpoint | Autorizzazione | Che cosa |
|---|---|---|
| `GET /api/equipment` | `equipment.read` | Ogni nodo, con il suo `path` di nomi dalla radice. Filtro: `?level=` |
| `GET /api/equipment/{id}` | `equipment.read` | `{"equipment", "children", "devices", "entities"}`: il nodo, i nodi direttamente sotto di esso e ciò che è collocato direttamente su di esso |
| `POST /api/equipment` | `equipment.write` | `{"parent_id", "level", "name", "description"}` |
| `PUT /api/equipment/{id}` | `equipment.write` | Uno qualsiasi tra `name`, `description`, `level`, `parent_id` (null per la radice). Risponde `{"equipment", "devices_rewritten"}` |
| `DELETE /api/equipment/{id}` | `equipment.write` | Rifiutato con 409 finché c'è qualcosa sotto |
| `GET /api/labels` | `equipment.read` | Ogni etichetta |
| `GET /api/labels/{label_id}` | `equipment.read` | `{"label", "devices", "entities"}` che la portano |
| `POST /api/labels` | `equipment.write` | `{"label_id"?, "name", "color", "icon", "description"}` |
| `PUT /api/labels/{label_id}` | `equipment.write` | Nome, colore, icona, descrizione. Mai il label_id |
| `DELETE /api/labels/{label_id}` | `equipment.write` | La toglie da tutto |
| `PUT /api/devices/{id}/labels` | `equipment.write` | `{"labels": [...]}`, l'intero insieme |
| `POST /api/devices` | `devices.write` | Acquisisce l'`equipmentId` facoltativo, come sopra |
| `GET /api/devices/{id}` | `devices.read` | Acquisisce `labels` accanto a `device` e `tags` |

Ogni ruolo ha `equipment.read`: dove stanno le cose è ciò che il sito e l'area di un dispositivo già dicevano a chi guarda. Solo l'amministratore ha `equipment.write`, perché rinominare o spostare un nodo riscrive sito, area e linea di ogni dispositivo sottostante, e questa è configurazione.

Ogni modifica finisce nel log di sistema, categoria `config`, oggetto `equipment:<id>` o `label:<label_id>`.

## MCP

`list_devices` e `describe_device` rispondono dal testo, come sempre, e il loro output non cambia. Un test lo fissa byte per byte a ciò che rispondeva la versione prima dell'albero, poi riorganizza l'albero attorno al dispositivo (un'impresa sopra il suo sito, una cella sotto la sua linea, un'etichetta) e verifica che nulla di ciò che vede un agente si sia mosso. Quando l'albero cambia il testo, per esempio con una ridenominazione, l'agente vede il testo nuovo, come se qualcuno lo avesse digitato nel dispositivo. `list_entities` è il punto in cui gli agenti vedono l'albero: filtra per un nodo e tutto ciò che sta sotto, e dà il posto di ogni entità. Vedi [MCP](/it/iot/mcp/#entities).

## Backup e ripristino

`equipment`, `labels`, `entity_labels` e `device_labels` sono nel backup, e così le nuove colonne `equipment_id`. `equipment` fa riferimento a sé stessa (`parent_id`), cosa che un ripristino non può ordinare: dopo lo spostamento di un nodo, un genitore può benissimo essere memorizzato dopo il suo figlio. Il vincolo è `DEFERRABLE INITIALLY DEFERRED`, quindi viene verificato quando il ripristino fa il commit, con tutte le righe ormai dentro, e lo stesso vale per qualsiasi altra cosa che riscriva l'albero in più di un'istruzione. Il test di guardia del backup consente a una tabella di fare riferimento a sé stessa solo quando quel vincolo è differito, e il test di andata e ritorno memorizza apposta un figlio prima del suo genitore.

Un backup fatto prima di questa versione si ripristina ancora. I suoi file `devices` e `entities` hanno una colonna in meno; il ripristino li carica nelle prime colonne della tabella (una colonna nuova viene sempre aggiunta in fondo) e quella nuova prende il suo valore predefinito. Poi, nella stessa transazione, colloca ogni dispositivo ripristinato nell'albero in base al suo testo, come avrebbe fatto l'aggiornamento.

## La schermata Impianto

L'albero, sul lato, con una scheda per il nodo scelto: il suo percorso, i dispositivi che vi si trovano, le entità collocate su di esso e ciò che sta sotto. Un amministratore può aggiungere un nodo alla radice o sotto quello scelto, rinominarlo, cambiarne il livello, spostarlo, eliminarlo, collocarvi un dispositivo o toglierne uno, e impostare le etichette di un dispositivo. L'elenco dei livelli offre solo i livelli che le regole consentono, sia rispetto al genitore sia rispetto ai figli già presenti sotto, e uno spostamento offre solo i genitori sotto cui può andare un nodo di quel livello, mai il nodo stesso né nulla che stia sotto di esso. Il server ricontrolla tutto, e un rifiuto (un'eliminazione con qualcosa ancora sotto, per esempio) viene mostrato esattamente come l'ha scritto. Spostare un dispositivo è lo stesso salvataggio che fa l'editor dei dispositivi, con un `equipmentId`, quindi il testo segue l'albero come descritto sopra.

Le etichette si gestiscono in fondo alla schermata: un nome, un colore e una descrizione, con il `label_id` scelto una volta per tutte. Le entità ricevono il loro posto e le loro etichette dal loro pannello nella schermata Entità.

Tutti gli altri vedono la stessa schermata senza nulla da premere.
