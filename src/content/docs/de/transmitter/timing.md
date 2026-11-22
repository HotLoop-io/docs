---
title: "Was Transmitter zur SPS-Task hinzufügt"
description: "Die gemessenen Kosten des Publishers auf einer zyklischen 20-ms-Task und was das über eine echte Steuerung aussagt und was nicht."
---

Gemessen mit 1.1.0 und eingeschalteten Zeitstempeln. Die Runtime ist CODESYS Control for Linux SL 4.22.0.0 im Demomodus, mit einer zyklischen 20-ms-Task, die auf vier Kerne festgelegt ist. Der Veröffentlichungslauf hat zwei Publisher, einen Variant und einen RawData, die jeweils etwa 1,1 KB alle 100 ms senden, sodass in jedem fünften Zyklus eine Nachricht hinausgeht. Die Statistik wurde 45 s nach dem Start der Runtime zurückgesetzt und 240 s später gelesen.

| Messgröße | Basis (kein Publisher) | zwei Publisher, Zeitstempel an |
|---|---|---|
| Mittlere Zeit in `PLC_PRG` pro Zyklus | 103 ns | 9 584 ns |
| Längste Zeit in `PLC_PRG` im Fenster | 1 us | 81 us |
| Zyklen unter 10 us | 11 997 von 11 997 | 9 580 von 11 976 |
| Zyklen von 10 bis 50 us | 0 | 2 299 |
| Zyklen von 50 bis 100 us | 0 | 97 |
| Zyklen ab 100 us | 0 | 0 |
| Nachrichten gesendet / abgelehnt / Slots übersprungen | 0 / 0 / 0 | 2 849 / 0 / 3 |

Was das aussagt:

* **Ein Zyklus, der sendet, kostet 10 bis 100 us.** Rund 2 400 Zyklen im Fenster haben gesendet (jeder fünfte), die Sendezyklen sind also die gesamten Kosten: 96 Prozent davon brauchten 10 bis 50 us und 4 Prozent 50 bis 100 us, für zwei Nachrichten von etwa 1,16 KB. Die Zyklen dazwischen kosten so viel wie die Basis.
* **Die mittleren Zusatzkosten liegen bei etwa 9,5 us pro 20-ms-Zyklus**, 0,05 Prozent der Task. Der Zeitstempel ist ein Uhrenlesezugriff und 17 Byte mehr pro Nachricht, und dieser Lauf zeigt dafür keine Kosten.
* **Kein Senden wurde abgelehnt.** Drei Veröffentlichungs-Slots wurden übersprungen, die Task lief also dreimal zu spät. Der Baustein wartet nie auf das Netz, auch wenn ein Senden bei ausgelastetem Kernel langsam sein kann. Lesen Sie den längsten Wert daher als Grenze der Messung und legen Sie den Publisher in eine eigene Task mit niedriger Priorität, wenn die Haupttask knapp ist.

Was das nicht aussagt: die Kosten auf Ihrer Steuerung. Diese Zahlen stammen aus einem Container auf einem Allzweck-Host. Eine kleine ARM-CPU kann zehn- bis hundertmal langsamer sein, und die Kosten wachsen mit der Größe der Feldliste. Messen Sie es auf dem Zielsystem mit `udiLastCallUs`, `udiMaxCallUs`, `udiMaxEncodeUs` und `udiMaxSendUs` am Baustein, die genau dafür da sind.
