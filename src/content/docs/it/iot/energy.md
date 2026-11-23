---
title: "Energia"
description: "Contatori in intervalli da 15 minuti, una tariffa che prezza ogni intervallo alla sua creazione, una quota di potenza, i turni e il costo di un'unità prodotta."
---

Ciò che l'impianto consuma e ciò che costa: chilowattora, gas, acqua, aria compressa e costo di un'unità prodotta, su un'unica schermata, pensata per un reparto produttivo. Nessun hardware nuovo e nessun protocollo nuovo. Un contatore è un tag che HotLoop già legge, e questa è la contabilità costruita sopra: ciò che il tag ha contato, conservato nel database e prezzato.

## Un contatore

Un contatore legge un tag come una quantità consumata. Ha una di due modalità.

| Modalità | Il tag è | Ciò che è stato consumato è |
|---|---|---|
| `counter` | un conteggio cumulativo: un registro di kWh, un totalizzatore di gas, gli impulsi di un contatore d'acqua | di quanto si è mosso, moltiplicato per il `factor` del contatore |
| `power` | una portata: i kW assorbiti adesso, in `W`, `kW` o `MW` | la media di due letture sul tempo che le separa |

`factor` è ciò che vale un passo del contatore nell'unità del contatore: `0.001` trasforma un registro in Wh in kWh, `0.01` significa che un impulso è un centesimo di metro cubo. Se omesso è 1. Un contatore di potenza non ha fattore: il suo `power_unit` e il suo `unit` (`Wh`, `kWh` o `MWh`) dicono come convertire.

| Tipo | Per | Unità abituale |
|---|---|---|
| `electricity` | kWh | kWh |
| `gas` | gas | m³ |
| `water` | acqua | m³ |
| `air` | aria compressa | m³ |
| `heat` | vapore, acqua calda, calore | kWh |
| `production` | unità prodotte | unità |

Un contatore `production` conta ciò che la linea ha prodotto. Non ha tariffa, ed è ciò per cui si divide il costo di un'unità.

Createne uno nella schermata Energia (Nuovo contatore) o con `POST /api/energy/meters` (vedi [l'API HTTP](/it/iot/api/#energia)). Solo un amministratore crea, modifica o rimuove un contatore (`energy.write`); tutti leggono (`energy.read`). Il tag deve esistere ed essere un numero. Se il tag viene eliminato in seguito, il contatore dice che è in attesa, e riprende il tag quando viene ricreato.

## Come conta

Ogni dieci secondi il motore legge il tag di ogni contatore dalla stessa cache che legge ogni schermata, e calcola ciò che ogni nuova lettura aggiunge. Ciò che aggiunge va in intervalli da 15 minuti, nel database, nella stessa transazione dell'ultima lettura del contatore. Quindi un riavvio non perde nulla e non conta nulla due volte.

* **Un contatore cumulativo** aggiunge di quanto si è mosso dall'ultima lettura, distribuito sul tempo tra le due letture in proporzione al tempo in ciascun intervallo.
* **Un contatore che torna indietro** è stato azzerato o sostituito. Nulla dice quanto è stato consumato, quindi non si aggiunge nulla: il nuovo valore è il nuovo punto di partenza, e il contatore conta l'azzeramento (`status.resets`).
* **Un contatore che ha continuato a contare mentre HotLoop era spento.** Il movimento è reale e viene conservato per intero, distribuito uniformemente sul vuoto, e ogni intervallo toccato è contrassegnato come **stimato**. Un vuoto è più di dieci minuti tra due letture.
* **Una potenza** è la media di due letture sul tempo che le separa. Per un vuoto di più di dieci minuti non c'è nulla: il contatore non inventa una potenza per un tempo che nessuno ha letto, e il vuoto viene contato (`status.gap_seconds`). Ogni intervallo dice quanti dei suoi 900 secondi hanno una lettura (`covered_seconds`), e la schermata dice «Letto per il 63% del periodo» quando un contatore di potenza non è stato letto per una parte di esso. Una lettura di potenza che non ha consumato nulla copre comunque il suo tempo.
* **Una lettura errata** (la qualità del tag non è buona) non aggiunge nulla, e il contatore lo dice sulla sua scheda con il motivo. Un contatore cumulativo che non veniva letto e torna conta ciò che si è mosso nel frattempo, come un vuoto.
* **Una lettura che non ha potuto essere memorizzata** viene ricalcolata al ciclo successivo dallo stesso punto di partenza.

## Quanto costa

Una tariffa prezza ogni intervallo alla sua creazione: un `price` fisso per unità e, facoltativamente, `bands` per una tariffa a fasce orarie. Una fascia è `from` e `to` su un quarto d'ora dell'orologio proprio del sito (un `to` precedente al `from` supera la mezzanotte), i `days` in cui vale (da `mon` a `sun`, tutti i giorni se omesso) e un `price`. Vince la prima fascia che vale in quel momento; fuori da ogni fascia vale il prezzo fisso. Un intervallo viene prezzato a metà del tempo che ogni lettura copre.

Poiché il costo è memorizzato con l'intervallo, **un prezzo cambiato dopo non cambia quanto è costato il mese scorso.** Cambiare la tariffa di un contatore cambia ciò che conta da quel momento in poi.

`currency` è un codice o un simbolo. I costi in due valute non vengono mai sommati: il riepilogo ha un costo per ciascuna.

### Una quota di potenza

Un contatore di elettricità in `Wh`, `kWh` o `MWh` può avere un `demand_price` nella sua tariffa: quanto costa un chilowatt del quarto d'ora più alto dell'impianto. Su una finestra, la potenza impegnata di un intervallo sono i chilowatt che ha avuto in media (un quarto d'ora che ha consumato 25 kWh ha avuto una media di 100 kW) e il suo addebito è quel valore per il prezzo di potenza che il contatore aveva quando l'intervallo è stato creato. L'addebito della finestra è il più alto tra questi, che per un solo prezzo è il picco per il prezzo. Il riepilogo dà a ciascuno di questi contatori un `demand` con il picco in kW, quando è iniziato e l'addebito, e mette l'addebito nel costo della finestra e nel costo di un'unità prodotta. Il `cost` del contatore resta ciò che l'energia è costata.

Come il prezzo dell'energia, il prezzo di potenza viene conservato con ogni intervallo alla creazione (migrazione 0030), quindi **cambiare un prezzo di potenza cambia ciò che viene contato da quel momento e mai il mese concluso.** Gli intervalli creati prima che il contatore avesse un prezzo di potenza non ne portano alcuno: mostrano un picco e nessun addebito.

Un fornitore fattura la potenza sul suo mese di fatturazione, quindi chiedete `this_month` o `last_month` per vedere la riga della bolletta; una finestra più breve dà l'addebito del quarto d'ora più alto al suo interno. Se il quarto d'ora di picco non è stato letto per intero (`peak_covered_seconds` sotto 900), il picco è sottostimato, e la schermata lo dice. I sensori `Today` qui sotto contano solo energia: un addebito di potenza è una riga della bolletta del mese, non qualcosa che matura per tutto il giorno.

## Il costo di un'unità prodotta

Il costo su una finestra dei contatori prezzati che scegliete, diviso per ciò che un contatore di produzione ha contato nella stessa finestra. Il riepilogo ne dà uno per ogni contatore di produzione e valuta. Quando non è stato prodotto nulla, il costo per unità è `null` con il `reason` `nothing_made`, e la schermata dice «Nulla prodotto»: non è una risposta, non è zero e non è una divisione per zero. Lo stesso quando è stato prodotto qualcosa e nessun contatore prezzato ha ancora contato alcun consumo (`nothing_counted`, «Ancora nessuna energia contata»): i contatori vengono letti uno dopo l'altro, quindi un registro che non si è ancora mosso non è un prodotto gratuito. Un contatore che ha contato qualcosa a un prezzo di zero conta comunque, e dà un costo di zero.

`GET /api/energy/summary?period=today&meters=line2-electricity,line2-air&per=line2-parts` lo calcola per una linea: `meters` nomina i contatori il cui costo entra, `per` il contatore di produzione. Senza di essi, sono tutti i contatori prezzati su tutti i contatori di produzione.

## Finestre

`period` è `today`, `yesterday`, `this_week` (le settimane iniziano di lunedì), `last_week`, `this_month`, `last_month`, `last_7_days` o `last_30_days`, un turno, oppure indicate `from` e `to` in RFC 3339 (al massimo 400 giorni). I giorni, le settimane e i mesi sono quelli **del sito**, nel suo fuso orario (`HOTLOOP_TIMEZONE`): la mezzanotte è la mezzanotte dell'impianto, e il giorno di 23 o 25 ore è il giorno reale. Un turno si scrive `shift:06:00-14:00`, da e a su un quarto d'ora dell'orologio del sito, e un `to` che non è successivo al `from` supera la mezzanotte (`shift:22:00-06:00`). `shift:` è l'ultimo iniziato, cioè quello in corso quando ce n'è uno, e `last_shift:` è quello prima. Un turno è costruito a partire dal giorno di calendario, quindi la notte del cambio d'ora dura quanto è durata davvero. La schermata ha una casella Turno accanto ai periodi, e gli stessi nomi vanno nel periodo degli strumenti MCP. Le serie vengono tagliate a passi di `quarter` (al massimo 8 giorni), `hour`, `day` o `month`.

## Sullo schermo

La schermata Energia (gruppo Impianto) ha un selettore del periodo, il costo del periodo, il costo per unità prodotta di ogni contatore di produzione e una scheda per ogni contatore: ciò che ha consumato, ciò che è costato, una barra per ogni ora (o giorno) e, quando serve, se viene letto, se una parte è stimata e per quanta parte del periodo un contatore di potenza è stato letto. Una barra con contorno tratteggiato è stimata. Un contatore che non può essere letto dice perché. Ogni parola è nelle 14 lingue.

## Entità

Ogni contatore fornisce sensori che ogni schermata e ogni regola possono usare:

| Entità | Stato |
|---|---|
| `sensor.<meter>_today` | ciò che il contatore ha consumato dalla mezzanotte del sito, nella sua unità |
| `sensor.<meter>_cost_today` | ciò che è costato (un contatore prezzato) |
| `sensor.<production meter>_cost_per_unit_today` | il costo di oggi diviso per le unità prodotte oggi. `unknown` finché non viene prodotto qualcosa, e quando i contatori sono prezzati in due valute |

Sono della piattaforma `energy`, leggono e non accettano alcun servizio. Un contatore che ha smesso di rispondere resta ciò che ha consumato finora, con qualità `uncertain` e `meter_status` che dice perché.

## MCP

Gli agenti leggono e gestiscono i contatori tramite le stesse rotte:

| Strumento | Fa |
|---|---|
| `list_energy_meters`, `get_energy_meter` | i contatori, come viene letto ciascuno, e il consumo e il costo di oggi |
| `get_energy_summary` | ciò che ogni contatore ha consumato e costato in un periodo con nome, il costo in ogni valuta e il costo di un'unità prodotta |
| `get_energy_series` | il consumo di un contatore in un periodo con nome, a passi |
| `create_energy_meter`, `update_energy_meter`, `delete_energy_meter` | creare, modificare e rimuovere un contatore. Ognuno richiede un motivo ed è sottoposto ad audit |

I filtri `meters` e `per` del costo per unità sono parametri di query REST.

## Backup e aggiornamenti

Lo conservano tre tabelle (migrazione 0029): `energy_meters`, `energy_meter_state` e `energy_buckets`, tutte nel backup. La migrazione 0030 aggiunge il prezzo di potenza ai contatori e a ogni intervallo. Le migrazioni si limitano ad aggiungere. Un intervallo pesa circa 100 byte, quindi un contatore pesa circa 3,5 MB all'anno.

## Che cosa non fa

* **Non conosce i vostri turni.** Un turno viene indicato nella richiesta, come `shift:06:00-14:00`; non c'è un elenco dei turni dell'impianto da cui scegliere, e un turno che non cade su un quarto d'ora viene rifiutato perché gli intervalli sono quarti d'ora.
* **Non fattura la potenza per voi.** L'addebito è il quarto d'ora più alto della finestra per il prezzo; i meccanismi a scatto, le potenze minime e gli addebiti per fattore di potenza di un fornitore non ci sono.
* **Non legge un contatore per voi.** Prima arriva il tag: aggiungete il dispositivo (Modbus, MQTT, OPC UA, oppure Emberburn per uno simulato), poi create il contatore.
