---
title: "API di HotLoop Transmitter"
description: "Ogni ingresso, uscita e metodo del function block publisher di HotLoop Transmitter."
---

Tutto è nel namespace `HLTX`. Il blocco è `HLTX.FB_HLTX_Publisher`.

## Ingressi

| Ingresso | Tipo | Predefinito | Significato |
|---|---|---|---|
| `bEnable` | BOOL | FALSE | TRUE apre il socket e inizia a pubblicare. FALSE lo chiude e riporta il blocco a `Disabled`, il che cancella anche un `ConfigError` |
| `sDestination` | STRING(15) | `127.0.0.1` | indirizzo IPv4 puntato: un host unicast, o un gruppo multicast da 224.0.0.0 a 239.255.255.255 |
| `uiPort` | UINT | 4840 | porta UDP di destinazione. 4840 è quella registrata da OPC UA |
| `sLocalAddress` | STRING(15) | vuoto | solo multicast: l'indirizzo dell'interfaccia da cui inviare. Vuoto lascia scegliere al sistema operativo |
| `usiMulticastTTL` | USINT | 1 | time to live multicast |
| `uiPublisherId` | UINT | 1 | PublisherId, inviato come UInt16 |
| `uiWriterGroupId` | UINT | 1 | WriterGroupId |
| `uiDataSetWriterId` | UINT | 1 | DataSetWriterId |
| `tPublishingInterval` | TIME | T#100MS | tempo tra i messaggi. Minimo T#1MS. Il blocco può inviare solo in un ciclo, quindi la frequenza reale è l'intervallo arrotondato per eccesso a un numero intero di cicli del task che lo chiama |
| `eEncoding` | `E_HLTX_Encoding` | `Variant` | `Variant` o `RawData`. Lo cambi a blocco disabilitato |
| `udiGroupVersion` | UDINT | 1 | GroupVersion nell'intestazione di gruppo |
| `udiConfigMajor`, `udiConfigMinor` | UDINT | 1, 0 | ConfigurationVersion del DataSet. Incrementi il major ogni volta che cambia la lista di campi |
| `bTimestamp` | BOOL | TRUE | marca ogni messaggio con l’orologio del PLC, nel NetworkMessage e nel DataSetMessage (al millisecondo, vedi `WIRE-FORMAT.md`). FALSE invia i byte della 1.0.0, 17 byte in meno |
| `bDeltaFrames` | BOOL | FALSE | Solo codifica Variant. Invia un Data Delta Frame (solo i campi cambiati, ciascuno con il suo indice) tra i frame chiave, e un KeepAlive quando nulla è cambiato. FALSE invia ogni volta un frame chiave completo, che ogni sottoscrittore legge. Un sottoscrittore che scarta i frame delta mostra una modifica al frame chiave successivo |
| `uiKeyFrameEvery` | UINT | 10 | con `bDeltaFrames`: un frame chiave completo ogni tanti messaggi, così un sottoscrittore arrivato in ritardo ha il quadro completo entro quel tempo |
| `bHighResTimestamp` | BOOL | TRUE | marca con l’ora in millisecondi dell’orologio quando il runtime la ha. FALSE marca i secondi interi, come faceva la 1.1.0 |
| `tRetry` | TIME | T#2S | quanto attendere prima di riaprire il socket dopo dieci invii consecutivi falliti |

## Uscite

| Uscita | Tipo | Significato |
|---|---|---|
| `eState` | `E_HLTX_State` | `Disabled`, `Running`, `Backoff` (in attesa di riaprire il socket) o `ConfigError` (vedi `eError`; non si invia nulla) |
| `eError` | `E_HLTX_Error` | `None`, `NoFields`, `BadInterval`, `BadAddress`, `SocketCreate`, `SocketOption`, `TooBig`, `BadField` |
| `bActive` | BOOL | TRUE finché i messaggi partono |
| `udiSent` | UDINT | messaggi consegnati alla rete |
| `udiSendErrors` | UDINT | invii che il sistema operativo ha rifiutato o troncato |
| `udiSkipped` | UDINT | slot di pubblicazione persi perché il task era in ritardo |
| `uiMessageSize` | UINT | byte dell'ultimo messaggio |
| `diLastSocketResult` | UDINT | l'ultimo codice di errore del runtime da una chiamata di socket, 0 va bene |
| `diLastClockResult` | UDINT | l'ultimo risultato della lettura dell'orologio del PLC per un timestamp, 0 va bene. Quando non è 0 il messaggio parte senza timestamp |
| `bDeltaActive` | BOOL | TRUE mentre i frame delta sono in uso: `bDeltaFrames` è attivo, il DataSet è Variant e i campi stanno nella copia di 4096 byte dei valori precedenti |
| `udiDeltaSent`, `udiKeepAliveSent` | UDINT | Data Delta Frame e messaggi KeepAlive inviati |
| `bStampHighRes` | BOOL | TRUE quando la marca dell’ultimo messaggio portava l’ora in millisecondi dell’orologio, FALSE quando è tornata ai secondi interi o è partita senza marca |
| `udiLastCallUs`, `udiMaxCallUs` | UDINT | microsecondi trascorsi nell'ultima chiamata del blocco, e il massimo da abilitazione o da `Clear()` |
| `udiMaxEncodeUs`, `udiMaxSendUs` | UDINT | il tempo massimo impiegato a costruire un messaggio e nella chiamata di invio stessa, da abilitazione o da `Clear()` |

## Metodi

Aggiunga i campi una volta, prima della prima chiamata, nell'ordine in cui un ricevitore deve leggerli. Ogni metodo restituisce TRUE quando il campo è stato accettato. Fino a 128 campi.

| Metodo | Aggiunge |
|---|---|
| `AddBool(pValue)`, `AddSInt`, `AddUSInt`, `AddInt`, `AddUInt`, `AddDInt`, `AddUDInt`, `AddLInt`, `AddULInt`, `AddReal`, `AddLReal`, `AddTime` | uno scalare. `pValue` è `ADR(variable)` |
| `AddString(pValue, uiMaxLen)` | una STRING. `uiMaxLen` è la N di `STRING(N)` |
| `AddWString(pValue, uiMaxLen)` | un WSTRING, inviato come UTF-8. `uiMaxLen` è la N di `WSTRING(N)` |
| `AddDataSet(uiWriterId, udiConfigMajor)` | avvia un altro DataSet nello stesso NetworkMessage: i campi aggiunti dopo gli appartengono. A ogni intervallo di pubblicazione un NetworkMessage porta quindi un DataSetMessage per DataSet, così più writer condividono un datagramma. Fino a 8 DataSet; i frame delta sono disattivati quando ce n’è più di uno |
| `SetStatus(pStatus)` | dà all’ultimo campo aggiunto uno stato. `pStatus` è `ADR` di un UDINT con uno StatusCode OPC UA. Finché non è 0, il campo esce come quello StatusCode al posto del suo valore (codifica Variant), e un ricevitore lo legge come qualità cattiva. 0 invia il valore. RawData non ha stato, quindi un publisher RawData continua a inviare il valore |
| `AddArray(pFirst, eType, uiCount)` | un array di `uiCount` elementi di qualsiasi tipo tranne STRING e WSTRING. `pFirst` è `ADR(array[first])` |
| `AddField(pData, eType, uiCount, uiMaxLen)` | la forma generale che gli altri chiamano |
| `Clear()` | dimentica la lista dei campi e il tempo massimo di chiamata |

Il blocco conserva gli indirizzi che gli dà, quindi dopo una modifica online che sposta le variabili, chiami `Clear()` e aggiunga di nuovo i campi. WORD, DWORD e LWORD entrano come UINT, UDINT e ULINT tramite il metodo della stessa dimensione.

## Come chiamarlo

Chiami l'istanza una volta per ciclo da un solo task. Non chiami un'istanza da due task. Più publisher in un programma vanno bene e ognuno ha il proprio socket; dia a ciascuno il proprio writer group id e dataset writer id.
