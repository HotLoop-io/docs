---
title: "Utgivelsesnotater: HotLoop Transmitter 1.2.0"
description: "HotLoop Alarms blir med i utgivelsen: et bibliotek som legger PLS-ens egne alarmer der HotLoop leser dem. Utgiveren er uendret."
---

Denne utgivelsen legger til HotLoop Alarms, et andre bibliotek som legger PLS-ens egne alarmer der HotLoop leser dem, og leverer Transmitter som 1.2.0.0 med samme utgiver som i 1.1.0.

Hva det betyr for deg: alarmene CODESYS-prosjektet ditt allerede utløser vises i HotLoops alarmliste, og å kvittere en i HotLoop kvitterer den i PLS-en. Bruker du bare utgiveren, er det ingenting å endre.

## Hva som endres for et prosjekt som bruker 1.1.0

* **HotLoop Alarms 1.0.0.0, ny.** `HotLoopAlarms-1.0.0.0.library` og `.compiled-library` er med i utgivelsen. Blokken, `HLAL.FB_HLAL_Alarms`, er en klient av CODESYS alarmbehandler. Kalt én gang per syklus kopierer den de aktive, ventende og kvitterte alarmene til en tabell med vanlige variabler (`aAlarms`, 64 rader) som runtimens OPC UA-server eksporterer som alle andre variabler. `udiChanges` teller opp når tabellen endret seg, og `uiDropped` teller de aktive alarmene som ikke fikk plass i stedet for å miste dem i det stille. Den trenger ikke noe generert alarmkoblingsbibliotek, bare prosjektets egen Alarm Configuration.
* **Kvitteringen kommer tilbake.** En skriving til kommandovariablene (`uiAckGroupId`, `uiAckAlarmId`, `udiAckInternalId` eller `bAckAll`, så et nytt tall i `udiAckRequest`) får blokken til å kvittere den alarmen, eller alle, gjennom alarmbehandleren. HotLoop 4.23.6 og senere finner blokken ut fra det den inneholder og gjør alt dette for deg.
* **Transmitter-utgiveren endret seg ikke.** Feltlisten og nettformatet flyttet seg ikke, og `bTimestamp` virker som før. Biblioteket bygges på nytt som 1.2.0.0, og `.package` har det med.
* **Lisensen er HotLoop Source License Agreement 1.0,** den samme som for alle HotLoop-produkter.

## Hva jeg kjørte, og hva det viste

Alt i laboratoriet, mot CODESYS Control for Linux SL 4.22.0.0 i en container.

* Transmitter-biblioteket bygges med 0 feil og 0 advarsler i CODESYS 3.5.22.30, og det samme gjør eksempelapplikasjonene bygget mot det.
* Laboratoriet: to utgivere, Variant og RawData, 114 meldinger dekodet fra hver, hver verdi lik det PLS-en rapporterer over sin egen OPC UA-server, ingen hull i sekvensnumrene, begge tidsstemplene i hver melding, og bytene fra 1.0.0 med `bTimestamp := FALSE`. En uavhengig OPC UA PubSub-implementasjon leser verdiene og tidsstemplene i hver melding. 128 kontroller bestått og ingen feilet.
* HotLoop core sin UADP-abonnent leser begge utgiverne mot en levende runtime: hver verdi lik, begge tellerne går, 62 key frames mottatt og ingen avvist.
* `.package` installeres med `PackageManagerCLI --install`, biblioteket dukker opp i System-depotet, og eksempelet bygges mot det med 0 feil og 0 advarsler.
* HotLoop Alarms: mot en ekte runtime med en Alarm Configuration på to alarmer vises en utløsning i PLS-en i HotLoop, en kvittering i HotLoop setter PLS-ens tabell til kvittert med klokkeslett, en tilbakestilling setter den til venter på bekreftelse, og en bekreftelse i HotLoop tømmer PLS-ens tabell. Den andre alarmen går i motsatt rekkefølge, og kvitter alle kvitterte begge aktive alarmer.
* Kostnad for utgiveren på en 20 ms-oppgave, to utgivere, festet til fire kjerner: omtrent 15 us lagt til per syklus i snitt og lengste syklus 144 us, uten hoppet publiseringsslot og uten avvist sending. Et 1.1.0-bibliotek bygget på nytt i samme time målte 15,2 us og 261 us.

## Hva jeg ikke kjørte

* Noen fysisk kontroller, noen CODESYS-runtime annet enn Control for Linux SL 4.22.0.0, og noen annen CPU enn x86-64.
* HotLoop Alarms med en alarmklasse annet enn den som kvitterer og ber om bekreftelse, eller med mer enn 64 aktive alarmer samtidig.
* `.package` i vinduet til CODESYS Installer. Den ble installert uten grensesnitt med PackageManagerCLI.
* En kontroller der sanntidsklokken er uinnstilt eller feil, multicast, en runtime som mister og får tilbake nettet sitt, og slutten på det to timers demovinduet.

## Ikke med i denne utgivelsen

KeepAlive og Delta Frames, mer enn én DataSetMessage per NetworkMessage, WSTRING, en status per felt, tidsstempler under ett sekund, meldingssikkerhet og abonnentsiden. [Veikartet](/nb/transmitter/roadmap/) sier hva som kommer neste.

## Gå tilbake

Et PLS-prosjekt festet til 1.1.0 fortsetter å virke og sender de samme bytene. HotLoop Alarms er et eget bibliotek: et prosjekt som ikke legger det til, berøres ikke.

## Filer

Last dem ned fra https://hotloop.io/hotloop-transmitter/1.2.0/HotLoopTransmitter-1.2.0.library, og sjekk dem mot `SHA256SUMS` i samme mappe.

```
e68cfc88e599ddcf278eb208ff500f4f78d3faf74edf12e38f308a009f478594  HotLoopAlarms-1.0.0.0.compiled-library
68f704fc5662bbc67ec097016a741065d705af01913a2746296c17f9e6991118  HotLoopAlarms-1.0.0.0.library
a404f20fc35c4a3d804aa194f29def3f8193e26e696357899d3ae5b3d44948c1  HotLoopTransmitter-1.2.0.compiled-library
05200d0279ac120fd69d2dc3eeba99d9b40cb76eba2d15d1431b94c5e8f3fc32  HotLoopTransmitter-1.2.0.library
d6b6606a5919e18d2d6d31a5529af4d76bc7058003fb26032ec1a578f78ea57d  HotLoopTransmitter-1.2.0.package
```
