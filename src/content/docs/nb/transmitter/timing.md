---
title: "Hva Transmitter legger til PLS-oppgaven"
description: "Den målte kostnaden for publisheren på en syklisk 20 ms-oppgave, og hva det sier og ikke sier om en fysisk kontroller."
---

Målt på 1.1.0 med tidsstempel på. Kjøretiden er CODESYS Control for Linux SL 4.22.0.0 i demomodus, med en syklisk 20 ms-oppgave festet til fire kjerner. Publiseringskjøringen har to publishere, én Variant og én RawData, som hver sender omtrent 1,1 KB hvert 100. ms, slik at en melding går ut hver femte syklus. Statistikken ble nullstilt 45 s etter at kjøretiden startet og lest 240 s senere.

| Mål | grunnlinje (ingen publisher) | to publishere, tidsstempel på |
|---|---|---|
| Gjennomsnittlig tid i `PLC_PRG` per syklus | 103 ns | 9 584 ns |
| Lengste tid i `PLC_PRG` i vinduet | 1 us | 81 us |
| Sykluser under 10 us | 11 997 av 11 997 | 9 580 av 11 976 |
| Sykluser fra 10 til 50 us | 0 | 2 299 |
| Sykluser fra 50 til 100 us | 0 | 97 |
| Sykluser på 100 us eller mer | 0 | 0 |
| Meldinger sendt / avvist / spor hoppet over | 0 / 0 / 0 | 2 849 / 0 / 3 |

Hva det sier:

* **En syklus som sender koster 10 til 100 us.** Omtrent 2 400 sykluser i vinduet sendte (hver femte), så sendesyklusene er hele kostnaden: 96 prosent av dem tok 10 til 50 us og 4 prosent tok 50 til 100 us, for to meldinger på omtrent 1,16 KB. Syklusene imellom koster det grunnlinjen koster.
* **Den gjennomsnittlige tilleggskostnaden er omtrent 9,5 us per 20 ms-syklus**, 0,05 prosent av oppgaven. Tidsstempelet er én klokkelesing og 17 byte mer per melding, og denne kjøringen viser ingen kostnad for det.
* **Ingen sending ble avvist.** Tre publiseringsspor ble hoppet over, så oppgaven kom for sent tre ganger. Blokken venter aldri på nettverket, selv om en sending kan være treg når kjernen er opptatt, så les det lengste tallet som en grense for målingen, og legg publisheren i en egen oppgave med lav prioritet hvis hovedoppgaven er presset.

Hva dette ikke sier: kostnaden på kontrolleren din. Disse tallene er fra en container på en generell vert. En liten ARM-CPU kan være ti til hundre ganger tregere, og kostnaden vokser med størrelsen på feltlisten. Mål den på målet med `udiLastCallUs`, `udiMaxCallUs`, `udiMaxEncodeUs` og `udiMaxSendUs` på blokken, som er der for det formålet.
