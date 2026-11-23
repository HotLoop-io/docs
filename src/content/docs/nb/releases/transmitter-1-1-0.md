---
title: "Utgivelsesnotater: HotLoop Transmitter 1.1.0"
description: "Hver melding bærer et tidsstempel fra PLS-klokken, og biblioteket installeres fra en CODESYS-pakke: hva som endret seg, hva som er kjørt og hva som ikke er det."
---

Hver melding bærer nå et tidsstempel fra PLS-klokken, og biblioteket installeres nå fra en CODESYS `.package`.

Hva det betyr for deg: en abonnent som vil vite når en verdi ble samplet, får det fra pakken i stedet for å gjette ut fra når den kom, og du kan installere biblioteket med CODESYS Installer som alle andre tillegg.

## Hva som endres for et prosjekt som bruker 1.0.0

* **Tidsstempler, på som standard.** NetworkMessage og DataSetMessage bærer hver et Timestamp (del 14, 7.2.4.4.2 og 7.2.4.5.4), det samme DateTime, lest fra PLS-ens sanntidsklokke én gang per melding. ExtendedFlags1 går fra `01` til `21`, DataSetFlags1 fra `69` eller `6B` til `E9` eller `EB`, og en DataSetFlags2-byte `10` legges til. En melding er 17 byte lengre. Feltlisten og verdiene endret seg ikke, og `udiConfigMajor` er den samme.
* **`bTimestamp := FALSE` sender nøyaktig bytene fra 1.0.0.** Fest den hvis en mottaker hos deg avviser tidsstempler. Det er sjekket: meldinger på 1142 og 1144 byte, ingen med tidsstempel, størrelsene 1.0.0 sendte.
* **Oppløsningen er ett sekund.** Klokken leses med `SysTimeRtcGet`, som gir hele sekunder, så en mottaker ser samme tidsstempel på hver melding innenfor et sekund, og det kan ligge opptil ett sekund bak øyeblikket meldingen ble bygget. Tidsstempler under ett sekund står på veikartet.
* **En ny utgang, `diLastClockResult`.** Hvis klokken ikke kan leses, går meldingen ut uten tidsstempel, noe del 14 tillater, og denne sier hvorfor.
* **Et nytt systembibliotek, SysTimeRtc.** Biblioteket nevner det som plassholder, som SysSocket, og runtime leverer det. Control for Linux SL 4.22.0.0 gjør det. Et mål uten det kan ikke bruke 1.1.0 med tidsstempler; bli på 1.0.0.
* **`.package`.** `HotLoopTransmitter-1.1.0.package` ble laget av CODESYS sin egen PackageManagerCLI og legger det samme biblioteket i bibliotekdepotet via Installer. Se [installasjonssiden](/nb/transmitter/install/).

## Hva vi kjørte, og hva det viste

Alt mot CODESYS Control for Linux SL 4.22.0.0, på filene under.

* Biblioteket bygges med 0 feil og 0 advarsler i CODESYS 3.5.22.30. Eksempelapplikasjonen bygges mot det med 0 feil og 0 advarsler.
* To utgivere, Variant og RawData, med tidsstempler. En uavhengig dekoder skrevet fra spesifikasjonen dekoder hver melding, og hver verdi er lik det PLS-en rapporterer over sin egen OPC UA-server. Hver melding har begge tidsstemplene, de er samme øyeblikk, de går aldri bakover, de ligger innenfor helsekundstoleransen til klokken opptaket gikk på, og over et opptak på 11 sekunder flyttet stempelet seg 11 sekunder. Containeren deler vertens klokke, så dette viser at stempelet er avlesningen av PLS-klokken og ikke et oppdiktet; det tester ikke en kontroller med feil klokke.
* En uavhengig PubSub-stakk leser Timestamp i NetworkMessage og DataSetMessage for alle 113 meldingene fra hver writer med sine egne headerdekodere, og dekoder verdiene som for 1.0.0.
* HotLoop core sin abonnent (fra main-grenen da dette ble kjørt, og i HotLoop core 4.19.4 og alle utgivelser etter) leser begge utgiverne mot en levende runtime: 21 verdier hver, begge tellerne går, ingenting avvist. Hver avlesning bærer utgiverens helsekunds tidsstempel som sin tid, og tidsstempelet fulgte PLS-klokken over en ventetid på 3 sekunder.
* `.package` installeres med `PackageManagerCLI --install`, biblioteket dukker opp i System-depotet (det var ikke der før), og eksempelet bygges mot biblioteket slik Installer la det der, med 0 feil og 0 advarsler.
* Kostnad på en 20 ms-oppgave, to utgivere: omtrent 9,6 us lagt til per syklus i snitt, 10 til 100 us på syklusene som sender, og den lengste syklusen i kjøringen 81 us. Tre publiseringsslots ble hoppet over i den kjøringen, og ingen sending ble avvist. Selve tidsstempelet er ikke synlig i tallene. [Tidssiden](/nb/transmitter/timing/) har tabellen.

## Hva du bør sjekke på kontrolleren din

* Håndteringen av byterekkefølge for et big endian-mål er skrevet, så sjekk den på din egen kontroller.
* Multicast: blokken setter TTL, loopback og sendegrensesnitt for gruppen, så sjekk gruppen på ditt eget nett.
* Hvis nettet forsvinner eller en adresse ikke finnes, teller blokken feilen og venter lenger mellom forsøkene, og programmet fortsetter å skanne.
* I demomodus stopper runtime ved slutten av sitt to timers vindu, slik CODESYS sier.
* En kontroller der sanntidsklokken er uinnstilt eller feil, vil stemple det klokken sier.

## Ikke med i denne utgivelsen

KeepAlive og Delta Frames, mer enn én DataSetMessage per NetworkMessage, WSTRING, en status per felt, tidsstempler under ett sekund, meldingssikkerhet og abonnentsiden. [Veikartet](/nb/transmitter/roadmap/) sier hva som kommer neste.

## Gå tilbake

Et PLS-prosjekt festet til 1.0.0 fortsetter å virke og sende bytene fra 1.0.0. Innenfor 1.1.0 gir `bTimestamp := FALSE` de samme bytene.

## Filer

Last dem ned fra https://hotloop.io/hotloop-transmitter/1.1.0/, og sjekk dem mot `SHA256SUMS` i samme mappe.

```
5ec021b23f5d57460016834a03b2b196d6dbc83aeb5d0ad60ace8d7b4fbbb4a7  HotLoopTransmitter-1.1.0.library
e172f4674f6cbfce2aeaf017d5a6c733245b1b9aa3e527369c753bf07b6ce0c2  HotLoopTransmitter-1.1.0.compiled-library
b3686bdebd052f1ddea46d1f1ff409f3b6c9a016ca5f3e8f4cd6f7922ccb479c  HotLoopTransmitter-1.1.0.package
```
