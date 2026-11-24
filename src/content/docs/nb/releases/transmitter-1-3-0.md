---
title: "Utgivelsesnotater: HotLoop Transmitter 1.3.0"
description: "Tidsstempler på millisekundet, WSTRING-felt, status per felt, flere DataSet i én NetworkMessage og deltarammer med KeepAlive, av som standard."
---

HotLoop Transmitter legger PLS-ens verdier ut på nettverket som OPC UA PubSub, fra et bibliotek du legger inn i CODESYS-prosjektet. 1.3.0 legger til tidsstempler på millisekundet, WSTRING-felt, en status per felt slik at en dårlig verdi går ut som dårlig, flere DataSet i én NetworkMessage, og Data Delta Frames med KeepAlive-meldinger. Det er bibliotek 1.3.0.0, og HotLoop Alarms 1.0.0.0 følger med uendret.

Hva det betyr for deg: et PLS-prosjekt som allerede bruker 1.2.0 sender de samme byte-ene som før, med én synlig forskjell, tidsstempelet har nå millisekunder. Alt annet slår du på med et kall eller en inngang.

## Nytt

* **Tidsstempler på millisekundet.** Både NetworkMessage og DataSetMessage bærer klokkens millisekunder, slik at en abonnent ser når hver melding ble bygget, ikke sekundet den falt i. `bStampHighRes` forteller hvilken klokke siste melding brukte.
* **WSTRING-felt.** `AddWString(ADR(wName), N)` publiserer en `WSTRING(N)` som en OPC UA String, i Variant og i RawData. Teksten går ut som UTF-8: et tegn over U+FFFF, som i PLS-en er et surrogatpar, går ut som ett fire-byte-tegn, og en enslig surrogat går ut som U+FFFD, så det en abonnent leser alltid er gyldig tekst. I RawData er feltets MaxStringLength `3 * N` byte.
* **En status per felt.** Etter at du har lagt til et felt, knytter `SetStatus(ADR(udiStatus))` det til en UDINT som holder en OPC UA StatusCode. Så lenge variabelen ikke er 0, går feltet ut som StatusCode i stedet for verdien, og en abonnent leser det som dårlig kvalitet. Sett den tilbake til 0 og verdien går ut igjen. En RawData-publisher sender fortsatt verdien, fordi RawData ikke kan bære en status.
* **Flere DataSet i én NetworkMessage.** `AddDataSet(uiWriterId, udiConfigMajor)` starter et nytt DataSet i samme blokk: feltene du legger til etterpå hører til det. Hvert publiseringsintervall bærer én NetworkMessage én DataSetMessage per DataSet, med Sizes-arrayen del 14 ber om, slik at mer enn én writer deler et datagram. Opptil 8 DataSet. Hvis du aldri kaller den, er meldingen den 1.2.0 sendte.
* **Data Delta Frames og KeepAlive.** Et jevnt datasett trenger ikke lenger sende hvert felt i hvert intervall. Med deltarammer på sender en publisher først en full nøkkelramme og så hver `uiKeyFrameEvery` melding, og imellom en Data Delta Frame med bare feltene som endret seg, og en KeepAlive når ingenting endret seg. `bDeltaActive`, `udiDeltaSent` og `udiKeepAliveSent` viser hva den gjør.

## Hva som endres for et prosjekt som bruker 1.2.0

* Feltlisten og trådformatet ditt endret seg ikke. Den eneste forskjellen på tråden er millisekunddelen av tidsstempelet.
* HotLoop Alarms 1.0.0.0 er med i utgivelsen, uendret.

## Innstillinger og standardverdier

* `bHighResTimestamp` er `TRUE`: stempler med klokkens millisekunder. Sett den til `FALSE` for å stemple hele sekunder, nøyaktig som 1.2.0. Hvis runtime ikke kan gi millisekunder, stempler blokken hele sekunder av seg selv.
* `bDeltaFrames` er `FALSE`. Deltarammer er en innstilling du slår på for en publisher, ikke noe blokken gjør uoppfordret, så alle abonnentene du har fortsetter å lese fulle nøkkelrammer. For å slå det på for en writer, sett `bDeltaFrames := TRUE` på den publisheren og, hvis du vil ha et annet nøkkelrammeavstand, `uiKeyFrameEvery` (10 hvis du ikke setter den). Hver publisher bestemmer selv, så én writer kan sende deltaer mens de andre ikke gjør det. En abonnent som forkaster deltarammer viser en endring ved neste nøkkelramme, så slå det på for abonnenter som leser dem. Det gjelder Variant-publishere med ett DataSet; en RawData-publisher, eller en blokk med mer enn ett DataSet, sender nøkkelrammer.
* `AddDataSet`, `AddWString` og `SetStatus` er kall du gjør én gang ved oppstart, som de andre `Add`-kallene. Uten dem endres ingenting.

## Oppgradering

Installer `HotLoopTransmitter-1.3.0.library` (eller åpne `.package` med CODESYS Installer), bytt bibliotekversjonen i prosjektets Library Manager til 1.3.0.0 og kompiler. Ingenting i koden din må endres. Legg til de nye kallene når du vil ha det de gjør.

## Gå tilbake

Et prosjekt som er festet til 1.2.0 fortsetter å virke og sender de samme byte-ene som før, med tidsstempler i hele sekunder. HotLoop Alarms er et eget bibliotek og påvirkes ikke.

## Ikke med i denne utgivelsen

Meldingssikkerhet, oppdelte NetworkMessages, abonnentsiden og MQTT-transport.

## Filer

```
e68cfc88e599ddcf278eb208ff500f4f78d3faf74edf12e38f308a009f478594  HotLoopAlarms-1.0.0.0.compiled-library
68f704fc5662bbc67ec097016a741065d705af01913a2746296c17f9e6991118  HotLoopAlarms-1.0.0.0.library
5be90a88e9e0aae1de421628fb6ca8e810dda96b4562566df345d451ecd859cf  HotLoopTransmitter-1.3.0.compiled-library
0410b98578fd55775a97b27023a0b5f30111cac0587120894354d9edca1248fc  HotLoopTransmitter-1.3.0.library
3e791358e6dc628a2d2aae760e0c49c89f1c4490f0637b65864c335fcbb3e9a0  HotLoopTransmitter-1.3.0.package
```
