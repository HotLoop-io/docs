---
title: "File di schermata"
description: "Esportate una dashboard in un file e importatela in un'altra installazione, con ogni tag, dispositivo e script elencato e una mappatura per i nomi diversi."
---

Una schermata è del cliente, e viaggia come file. Esportate una dashboard da un'installazione, importatela in un'altra, e nulla di essa vive nel codice di HotLoop: né il layout, né i nomi dei tag, né il testo. Lo stesso file funziona in HotLoop IoT, Edge e Gateway, perché eseguono un unico insieme di dashboard ([Dashboard](/it/iot/dashboards/)).

Edge Relay non ha interfaccia né schermate. La dashboard di Flow fa parte dei suoi flussi, che hanno i propri Importa ed Esporta. Per HotLoop for CODESYS le schermate sono quelle di Edge.

## Come si usa

Nella schermata Dashboard, **Esporta** (accanto a Modifica, per la dashboard a schermo) salva `<id>.hotloop-screen.json`. **Importa** (nella barra accanto a Nuova dashboard) legge un file, vi dice cosa serve e cosa manca qui, vi lascia associare ogni tag, dispositivo, entità, script o ricetta mancante a uno che esiste, ricontrolla e la salva. Importare richiede `dashboards.write`, quindi spetta a un amministratore. Esportare richiede `dashboards.read` e la dashboard deve essere una di quelle che vi vengono offerte.

Tramite l'API, [`GET /api/dashboards/{id}/export`](/it/iot/api/#get-apidashboardsidexport) e [`POST /api/dashboards/import`](/it/iot/api/#post-apidashboardsimport), che è ciò che la schermata chiama. Un'importazione non salva mai qualcosa che la costruzione della stessa dashboard rifiuterebbe.

## Il file

JSON in UTF-8, fino a 4 MiB.

```json
{
  "format": "hotloop-screen",
  "formatVersion": 1,
  "exported": { "product": "edge", "version": "4.22.1", "at": "2026-11-19T16:00:00Z" },
  "screen": {
    "id": "line-2",
    "name": "Line 2",
    "kind": "cards",
    "roles": ["operator", "admin"],
    "homeFor": ["operator"],
    "screens": ["line-2-panel"],
    "position": 1,
    "cards": [
      { "id": "temp", "type": "gauge", "title": "Zone 1", "w": 3, "h": 3, "config": { "tag": "press-01/Zone1_Temp" } }
    ]
  },
  "requires": {
    "tags": [ { "key": "press-01/Zone1_Temp", "dataType": "float", "unit": "C", "writable": false } ],
    "entities": [], "scripts": [], "recipes": [], "devices": [], "equipment": []
  }
}
```

**`format` e `formatVersion`.** `format` è sempre `hotloop-screen`. `formatVersion` è un numero intero da 1. Un HotLoop legge la propria versione e quelle precedenti, e rifiuta una più recente dicendo quale versione è il file e quale legge. Un campo aggiunto al file è una nuova versione, perché un lettore rifiuta un campo che non conosce: un campo scartato senza dire nulla è peggio di un rifiuto. Questa è la versione 1.

**`exported`.** Quale prodotto e quale versione l'hanno scritto, e quando. Per la persona che legge il file. Nulla viene deciso da esso: sono i tipi di scheda a decidere se un HotLoop può mostrare la schermata, e un tipo di scheda sconosciuto viene rifiutato per nome.

**`screen`.** La dashboard così come la tiene l'API delle dashboard, senza la contabilità propria dell'installazione (`version`, `updatedBy`, `createdAt`, `updatedAt`). `description` viene omessa quando è vuota. Le schede sono in ordine di lettura, ciascuna con la sua dimensione (`w` su 12 colonne, `h` in righe) e il suo `config`, esattamente come [Dashboard](/it/iot/dashboards/#le-schede) descrive ogni tipo. Il layout è questo: un flusso di schede, mai coordinate in pixel. Una scheda di simboli colloca i suoi simboli al pixel sulla propria pagina, dentro il suo config.

**Le risorse sono all'interno.** Una pianta su una scheda mappa e lo sfondo di una scheda di simboli sono URL di dati PNG in base64 nel `config` della scheda, quindi un solo file è l'intera schermata, e inviarlo significa inviare anche l'immagine. I limiti sono quelli della dashboard: 700 KB per immagine e 2 MiB per schermata.

**`requires`.** Ciò che la schermata richiede dall'installazione su cui arriva, calcolato dalle schede: ogni tag che legge (con il tipo e l'unità che aveva dove è stato esportato, e se un pulsante o un setpoint vi scrive) e gli id di entità, script, ricette, dispositivi e apparecchiature che le schede nominano. Serve alle persone e agli strumenti che vogliono guardare prima di importare. L'importazione lo ricalcola dalle schede e non si fida mai di questo blocco. Dove il tipo di un tag nel file differisce da quello del tag su cui arriva, è un avviso.

**La bacheca a parete non viene esportata.** È l'insieme degli indicatori fissati di un'installazione, non un layout. Esportarla dà un `400`, e un file il cui `kind` è `wall` viene rifiutato.

**Assegnazioni.** `roles`, `homeFor`, `screens` e `position` sono nel file in modo che una schermata torni com'era partita. Sono anche la parte più legata a un'installazione: il nome di un pannello appartiene a una sola dashboard su un'installazione, e un ruolo ha una sola home. Un'importazione le applica, e lo dice (`assignment`) quando questa installazione dà già quel nome di schermata o la home di quel ruolo a un'altra dashboard. **Salta le assegnazioni** lascia fuori `screens` e `homeFor` e mantiene `roles`.

## Importare

I controlli girano in quest'ordine, e nulla viene salvato finché non passano tutti:

1. **Il file.** JSON, il `format` giusto, una versione che questa build legge, nessun campo che non conosca, tipo `cards`.
2. **Le vostre modifiche.** Un nuovo id o nome, nessuna assegnazione, e la **mappa**: `tags` (chiave intera a chiave intera, come il file nomina il tag o come si legge una volta spostato il dispositivo), `devices` (id a id; sposta anche la parte dispositivo di ogni tag che la mappa `tags` non nomina, quindi spostare una schermata da un PLC a un altro è una sola voce), `entities`, `scripts`, `recipes` e `equipment` (gli id sono numeri che significano qualcosa solo dove sono stati creati, quindi si associano uno per uno). Il testo della legenda di un trend si sposta con il suo tag. Una voce di mappa che nessuna scheda ha usato è un avviso, perché una mappatura che non ha fatto nulla è il modo in cui una schermata finisce per puntare alla cosa vecchia.
3. **Le regole proprie della dashboard.** Id, nome, il config di ogni scheda, dimensioni, il limite di byte, nella forma in cui è memorizzata.
4. **Tutto ciò che le schede nominano, senza eccezioni.** Ogni tag, entità, script, ricetta, dispositivo e id di apparecchiatura mancante viene elencato, non solo il primo, così un solo passaggio dice cosa mappare. Un pulsante o un setpoint su un tag non scrivibile è `writable`. Un valore di pulsante o un limite di setpoint fuori dall'intervallo del tag e un ruolo che non esiste sono `screen`.
5. **L'id e le assegnazioni.** Un id già preso è `exists`, a meno che non abbiate chiesto di **sostituirlo**, il che salva sopra quella dashboard alla versione che ha ora (quindi un salvataggio fatto mentre guardavate è un `409`, non una sovrascrittura).

Una prova a secco fa tutto questo e non salva nulla. L'importazione viene registrata come evento `config` sulla dashboard: chi, da quale prodotto e versione, quante schede.

## Spostare una schermata

Esportate sulla prima installazione. Sulla seconda, assicuratevi che i dispositivi e i tag che la schermata legge esistano (portano indirizzi che appartengono all'impianto, quindi un file di schermata non li porta). Importate. Se i nomi dei tag differiscono, mappateli nella finestra di dialogo, oppure mappate il dispositivo se differisce solo quello. La schermata si apre sulla seconda installazione com'era sulla prima.

## Una visualizzazione CODESYS

La stessa importazione legge una visualizzazione CODESYS (l'esportazione nativa dell'IDE) e ne ricava la schermata, dicendo cosa ha lasciato fuori: [Importare una schermata CODESYS](/it/iot/codesys-screen-import/).

## Cosa non c'è nella versione 1

I dispositivi e i tag che una schermata legge (i loro indirizzi sono dell'impianto, non della schermata), la bacheca a parete, più schermate in un file e una firma sul file. Un file è JSON semplice: leggetelo prima di importarne uno che vi è stato inviato.
