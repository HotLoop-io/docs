---
title: "Språk i nettgrensesnittet"
description: "Nettgrensesnittet på engelsk og tretten språk til, med arabisk satt fra høyre mot venstre, valgt i toppfeltet eller på innloggingskortet."
---

:::note[Tar med det som kommer]
Denne siden tar også med noen ting som er nyere enn HotLoop core 4.24.0, den siste utgivelsen. Deler av det er kanskje ikke i det du har installert. [Utgivelsesnotatene](/nb/releases/) sier hva som har endret seg.
:::

Nettgrensesnittet til HotLoop IoT, Edge og Gateway (og HotLoop for CODESYS, som kjører Edge-grensesnittet) finnes på engelsk og 13 språk til: spansk (es), fransk (fr), italiensk (it), tysk (de), norsk bokmål (nb), bulgarsk (bg), gresk (el), koreansk (ko), japansk (ja), vietnamesisk (vi), hindi (hi), forenklet kinesisk (zh-Hans) og arabisk (ar, satt fra høyre mot venstre).

Velg ett i språkboksen i toppfeltet, eller på innloggingskortet. Valget huskes i denne nettleseren. Er ikke noe valgt, bruker siden det første av nettleserens språk som HotLoop har, og engelsk hvis ingen passer. Et språk står i valglisten bare når filen er komplett.

Det som følger språket: hvert ord på hver skjerm, rekkefølgen og tegnene i tall (desimalkomma på tysk, fransk og spansk), datoer og klokkeslett (24-timersklokke), flertallsformer (arabisk har seks) og retningen på siden. Produkt- og protokollnavn (HotLoop, Modbus, OPC UA, MQTT, Sparkplug, CODESYS, UniFi) står som de er skrevet. Verdier fra anlegget, som tagnavn, enhetsnavn, alarmmeldinger noen har skrevet og feiltekst sendt tilbake av serveren, vises som de er.

## Bygget for dem som bruker det

* Hver skjerm tegnes fra én melding per setning, så et språk aldri er en halv side med egne ord og en halv side engelsk. Et språk vises i velgeren bare når hver skjerm er komplett.
* Flertall følger Unicode CLDR-reglene for hvert språk, så "1 enhet", "2 enheter" og arabisk sine seks former leses slik en morsmålsbruker forventer.
* Tall og datoer kommer fra nettleserens egen formatering for språket du valgte, så en tysk leser ser 1.234,5 og en amerikansk leser ser 1,234.5.
* Å bytte språk tegner alle skjermer om på én gang, uten å laste på nytt. Engelsk er en del av siden og lastes med den; hvert annet språk hentes bare når noen velger det, så et anlegg som kjører på ett språk aldri laster ned de tolv andre.
* Oppsettet snur seg av seg selv for arabisk: marger, justering og avstand snur med språket.

En nettlesertest i hele suiten beviser det på den virkelige siden. Den åpner HotLoop på hvert språk i skrivebords- og telefonbredde og går gjennom hver skjerm. Retningen er riktig, ingenting ruller sideveis, ingen melding vises som plassholder, tall leses slik språket vil ha dem, og valget overlever en omlasting.

## Det som ikke oversettes

* Tekst serveren sender: feilmeldinger fra API-et, varslings- og alarmmeldinger, og CLI-en. Grensesnittet viser dem slik de kommer.
* Dokumentasjonen, navnene til OPC UA-serveren, MQTT-brokeren og Helm-chartets verdier.
