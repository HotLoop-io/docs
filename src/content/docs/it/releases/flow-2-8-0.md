---
title: "Note di rilascio: HotLoop Flow 2.8.0"
description: "Cosa porta HotLoop Flow 2.8.0, cosa cambia con l'aggiornamento e cosa leggere prima di toccare un impianto in funzione."
sidebar:
  label: "2.8.0"
---

HotLoop Flow 2.8.0 aggiunge quattro cose a FlowLab, la scheda dei diagrammi per banchi di prova e data logger: nodi di analisi, un nodo di acquisizione dati per l'hardware NI, un'uscita MQTT che conserva ciò che il broker perde e un log TDMS. I flow funzionano esattamente come prima, un file di flow che hai oggi si carica e si salva byte per byte, e una scheda che non è un diagramma non vede nulla di tutto questo.

## Novità

**Analisi.** Quattro nodi lavorano su un array di letture: statistiche (media, RMS, minimo, massimo e deviazione standard), integrale (l'area sotto l'array con la regola del trapezio, come un solo numero o come area cumulata), derivata (la pendenza a ogni campione) e un filtro Butterworth di ordine da 1 a 10 come passa-basso, passa-alto, passa-banda o elimina-banda, con la frequenza di taglio in hertz.

**Un nodo di acquisizione dati.** `read DAQ task` legge campioni da hardware NI, come uno chassis CompactDAQ, tramite il Device Server gRPC di NI. Il client è il più piccolo possibile: l'HTTP/2 di Go con messaggi scritti a mano, così il binario non ha preso una libreria gRPC.

**Un'uscita MQTT che non perde nulla.** `mqtt out` pubblica tramite il broker configurato dal file di flow, la stessa connessione usata dai nodi MQTT. Contrassegnala come durevole e un messaggio che il broker perde viene scritto su disco prima che il nodo finisca e inviato, il più vecchio per primo, quando il broker torna, anche dopo un riavvio. Nulla supera ciò che aspetta davanti. La sua uscita di invio dice se il messaggio è partito subito.

**Un log TDMS.** `log to TDMS file` aggiunge un record a un file TDMS, un canale per campo, e il file si apre negli strumenti che un laboratorio ha già. Un file la cui ultima scrittura è stata interrotta da un'interruzione di corrente si legge comunque fino all'ultimo valore completo.

## Cosa è cambiato

- Ora ci sono 28 tipi di nodo nella sezione FlowLab della tavolozza, contro 21, e il README lo dice.
- Un passaggio che una volta è fallito nell'esecuzione della 2.7.1 non ha stampato nulla, e la causa era il test del collettore che confrontava un intervallo prima che il log che legge lo contenesse tutto; ora aspetta l'intervallo intero. Altri due test sono stati fatti aspettare ciò che controllano. Niente di tutto questo viene distribuito.
- Le immagini del README sono state rifatte perché la barra in alto dica v2.8.0.
- Le dimensioni del binario e dell'immagine nel README sono state rilette per questa versione.

## Nuove impostazioni

Nessuna.

## Aggiornamento

Su amd64, un semplice `helm upgrade` all'immagine e al chart 2.8.0, oppure il nuovo tag nella tua unità Quadlet. Su arm64, resta dove sei fino alla 2.8.1, che è questa versione con arm64 in più e nient'altro. Al primo avvio non succede nulla e non c'è nulla da migrare.

Immagine: `ghcr.io/hotloop-io/hotloop-flow:2.8.0`, solo linux/amd64. Costruiamo prima l'amd64, lo lasciamo consolidare come stabile in produzione e poi una piccola 2.8.1 senza altro aggiunge l'arm64. Fino ad allora, il tag `2` contiene la nuova immagine amd64 e l'immagine arm64 della 2.7.1, quindi una macchina arm64 che segue `2` o `2.7` mantiene ciò che ha, e una macchina fissata a `2.8.0` ha bisogno di amd64. Chart: `https://hotloop.io/hotloop-flow/`. Il README di questo tag ha il resto, con le immagini: https://github.com/HotLoop-io/hotloop-flow/blob/v2.8.0/README.md
