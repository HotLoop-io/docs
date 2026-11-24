---
title: "Note di rilascio: HotLoop Transmitter 1.3.0"
description: "Marche temporali al millisecondo, campi WSTRING, stato per campo, più DataSet in un NetworkMessage e frame delta con KeepAlive, disattivati di default."
---

HotLoop Transmitter mette sulla rete i valori del tuo PLC come OPC UA PubSub, da una libreria che inserisci nel progetto CODESYS. La 1.3.0 aggiunge marche temporali al millisecondo, campi WSTRING, uno stato per campo perché un valore cattivo parta come cattivo, più DataSet in un NetworkMessage, e Data Delta Frame con messaggi KeepAlive. È la libreria 1.3.0.0, e HotLoop Alarms 1.0.0.0 la accompagna invariata.

Cosa significa per te: un progetto PLC che usa già la 1.2.0 invia gli stessi byte di prima, con una differenza visibile, la marca temporale ora ha i millisecondi. Tutto il resto si attiva con una chiamata o un ingresso.

## Novità

* **Marche temporali al millisecondo.** Sia il NetworkMessage sia il DataSetMessage portano i millisecondi dell’orologio, così un sottoscrittore vede quando ogni messaggio è stato costruito e non il secondo in cui cade. `bStampHighRes` indica quale orologio ha usato l’ultimo messaggio.
* **Campi WSTRING.** `AddWString(ADR(wName), N)` pubblica un `WSTRING(N)` come String OPC UA, in Variant e in RawData. Il testo esce come UTF-8: un carattere oltre U+FFFF, che nel PLC è una coppia surrogata, esce come un carattere di quattro byte, e un surrogato isolato esce come U+FFFD, così ciò che legge un sottoscrittore è sempre testo valido. In RawData il MaxStringLength del campo è `3 * N` byte.
* **Uno stato per campo.** Dopo aver aggiunto un campo, `SetStatus(ADR(udiStatus))` lo lega a un UDINT che contiene uno StatusCode OPC UA. Finché quella variabile non è 0, il campo esce come lo StatusCode invece del suo valore, e un sottoscrittore lo legge come qualità cattiva. Rimettila a 0 e il valore esce di nuovo. Un publisher RawData continua a inviare il valore, perché RawData non ha modo di portare uno stato.
* **Più DataSet in un NetworkMessage.** `AddDataSet(uiWriterId, udiConfigMajor)` avvia un altro DataSet nello stesso blocco: i campi che aggiungi dopo gli appartengono. A ogni intervallo di pubblicazione un NetworkMessage porta un DataSetMessage per DataSet, con l’array Sizes che chiede la Parte 14, così più di un writer condivide un datagramma. Fino a 8 DataSet. Se non la chiami mai, il messaggio è quello che inviava la 1.2.0.
* **Data Delta Frame e KeepAlive.** Un dataset stabile non deve più inviare ogni campo a ogni intervallo. Con i frame delta attivi, un publisher invia prima un frame chiave completo e poi, ogni `uiKeyFrameEvery` messaggi, un Data Delta Frame con i soli campi cambiati nel frattempo, e un KeepAlive quando nulla è cambiato. `bDeltaActive`, `udiDeltaSent` e `udiKeepAliveSent` mostrano cosa sta facendo.

## Cosa cambia per un progetto che usa la 1.2.0

* L’elenco dei campi e il formato sul cavo non sono cambiati. L’unica differenza sul cavo è la parte in millisecondi della marca temporale.
* HotLoop Alarms 1.0.0.0 è nella versione, invariato.

## Impostazioni e valori predefiniti

* `bHighResTimestamp` è `TRUE`: marca con i millisecondi dell’orologio. Impostalo a `FALSE` per marcare i secondi interi, esattamente come la 1.2.0. Se il runtime non può dare i millisecondi, il blocco marca da solo i secondi interi.
* `bDeltaFrames` è `FALSE`. I frame delta sono un’impostazione che attivi su un publisher, non qualcosa che il blocco fa da solo, così tutti i sottoscrittori che hai continuano a leggere frame chiave completi. Per attivarlo per un writer, imposta `bDeltaFrames := TRUE` su quel publisher e, se vuoi una spaziatura diversa dei frame chiave, `uiKeyFrameEvery` (10 se non lo cambi). Ogni publisher decide per sé, quindi un writer può inviare delta mentre gli altri no. Un sottoscrittore che scarta i frame delta mostra una modifica al frame chiave successivo, quindi attivalo per sottoscrittori che li leggono. Vale per i publisher Variant con un DataSet; un publisher RawData, o un blocco con più di un DataSet, invia frame chiave.
* `AddDataSet`, `AddWString` e `SetStatus` sono chiamate che fai una volta all’avvio, come le altre chiamate `Add`. Senza di esse non cambia nulla.

## Aggiornamento

Installa `HotLoopTransmitter-1.3.0.library` (o apri il `.package` con il CODESYS Installer), cambia la versione della libreria nel Library Manager del progetto in 1.3.0.0 e compila. Nulla nel tuo codice deve cambiare. Aggiungi le nuove chiamate quando vuoi ciò che fanno.

## Tornare indietro

Un progetto bloccato sulla 1.2.0 continua a funzionare e invia gli stessi byte di prima, con marche temporali in secondi interi. HotLoop Alarms è una libreria separata e non è interessata.

## Non incluso in questa versione

Sicurezza dei messaggi, NetworkMessage frammentati, il lato sottoscrittore e il trasporto MQTT.

## File

```
e68cfc88e599ddcf278eb208ff500f4f78d3faf74edf12e38f308a009f478594  HotLoopAlarms-1.0.0.0.compiled-library
68f704fc5662bbc67ec097016a741065d705af01913a2746296c17f9e6991118  HotLoopAlarms-1.0.0.0.library
5be90a88e9e0aae1de421628fb6ca8e810dda96b4562566df345d451ecd859cf  HotLoopTransmitter-1.3.0.compiled-library
0410b98578fd55775a97b27023a0b5f30111cac0587120894354d9edca1248fc  HotLoopTransmitter-1.3.0.library
3e791358e6dc628a2d2aae760e0c49c89f1c4490f0637b65864c335fcbb3e9a0  HotLoopTransmitter-1.3.0.package
```
