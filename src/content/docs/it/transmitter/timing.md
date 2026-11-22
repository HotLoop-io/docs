---
title: "Cosa aggiunge Transmitter al task del PLC"
description: "Il costo misurato del publisher su un task ciclico da 20 ms, e cosa dice e non dice su un controllore fisico."
---

Misurato sulla 1.1.0 con i timestamp attivi. Il runtime è CODESYS Control for Linux SL 4.22.0.0 in modalità demo, con un task ciclico da 20 ms vincolato a quattro core. La prova di pubblicazione ha due publisher, uno Variant e uno RawData, ciascuno con circa 1,1 KB ogni 100 ms, quindi un messaggio parte ogni cinque cicli. Le statistiche sono state azzerate 45 s dopo l'avvio del runtime e lette 240 s dopo.

| Misura | riferimento (senza publisher) | due publisher, timestamp attivi |
|---|---|---|
| Tempo medio in `PLC_PRG` per ciclo | 103 ns | 9 584 ns |
| Tempo massimo in `PLC_PRG` nella finestra | 1 us | 81 us |
| Cicli sotto i 10 us | 11 997 su 11 997 | 9 580 su 11 976 |
| Cicli da 10 a 50 us | 0 | 2 299 |
| Cicli da 50 a 100 us | 0 | 97 |
| Cicli da 100 us o più | 0 | 0 |
| Messaggi inviati / rifiutati / slot saltati | 0 / 0 / 0 | 2 849 / 0 / 3 |

Cosa dice:

* **Un ciclo che invia costa da 10 a 100 us.** Circa 2 400 cicli nella finestra hanno inviato (uno su cinque), quindi i cicli di invio sono tutto il costo: il 96 per cento di essi ha impiegato da 10 a 50 us e il 4 per cento da 50 a 100 us, per due messaggi da circa 1,16 KB. I cicli intermedi costano quanto il riferimento.
* **Il costo medio aggiunto è di circa 9,5 us per ciclo da 20 ms**, lo 0,05 per cento del task. Il timestamp è una lettura di orologio e 17 byte in più per messaggio, e questa prova non mostra alcun costo per esso.
* **Nessun invio è stato rifiutato.** Tre slot di pubblicazione sono stati saltati, quindi il task ha ritardato tre volte. Il blocco non aspetta mai la rete, anche se un invio può essere lento quando il kernel è occupato: legga il valore più lungo come un limite della misura e metta il publisher in un task a bassa priorità tutto suo se quello principale è al limite.

Cosa non dice: il costo sul vostro controllore. Questi numeri vengono da un container su un host generico. Una piccola CPU ARM può essere da dieci a cento volte più lenta, e il costo cresce con la dimensione della lista di campi. Lo misuri sul target con `udiLastCallUs`, `udiMaxCallUs`, `udiMaxEncodeUs` e `udiMaxSendUs` del blocco, che sono lì per questo.
