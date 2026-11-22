---
title: "Hva som ble kjørt"
description: "Hva biblioteket ble bygget med, kjørt på og lest tilbake av, og det ene stedet der to lesere er uenige."
---

Denne siden er kjøringen av 1.0.0. Kjøringen av 1.1.0, med tidsstempler og `.package`, står i [utgivelsesnotatene for 1.1.0](/nb/releases/transmitter-1-1-0/). Biblioteket er siden kjørt på bare metal (2026-11-17).

## Byggingen

* Bibliotek: kompilerer med 0 feil og 0 advarsler i ScriptEngine i CODESYS 3.5.22.30 (SP22 Patch 3).
* Eksempelapplikasjon, bygget mot det installerte biblioteket, for enheten CODESYS Control for Linux SL (4102, 0000 0005, 4.20.0.0): 0 feil, 0 advarsler, klar for nedlasting.

## Kjøretiden

CODESYS Control for Linux SL 4.22.0.0 laster applikasjonen som oppstartsprosjekt og melder `Application started`, `CODESYS Control ready`. Den kjører i demomodus, fordi det ikke finnes noen kjøretidslisens.

## Hva som gikk over ledningen, og hvem som leste det

Eksempelapplikasjonen har to publishere: writer group 1 og dataset writer 1 i Variant-koding (1142 byte), og writer group 2 og dataset writer 2 i RawData-koding (1144 byte). Sytten felt hver: ett av hver type biblioteket støtter, en REAL-matrise med 250 elementer, en INT-matrise med 4 elementer og to tellere.

Fire uavhengige lesere leste det.

| Leser | Hva det er | Variant | RawData |
|---|---|---|---|
| En dekoder skrevet fra spesifikasjonen | skrevet kun fra OPC 10000-14 og 10000-6, og leser også de samme variablene fra kjøretidens OPC UA-server og sammenligner | hvert felt likt PLS-ens, ingen hull i sekvensnumrene for NetworkMessage og DataSetMessage over opptaket | det samme |
| En uavhengig OPC UA PubSub-stack | en subscriber med DataSet-metadata for de 17 feltene | alle 15 kontrollerte verdier er like, inkludert strengen, begge matrisene og TIME | de 11 numeriske skalarene er like. Den stacken leser ikke RawData-strenger av noen lengde eller RawData-matriser i det hele tatt |
| HotLoop cores UADP-subscriber | driveren i HotLoop core 4.19.4 og alle utgivelser etter den, kjørt mot en levende kjøretid og fortalt RawData-oppsettet i DataSet-typene sine | 21 verdier kontrollert like, inkludert strengen, TIME og element 0, 1, 124 og 249 av REAL-matrisen på 250 og alle fire i INT-matrisen, og begge tellerne økte mellom to lesinger med 3 sekunders mellomrom | de samme 21 verdiene og de samme to tellerne. 62 key frames mottatt, ingen avvist |
| En andre dekoder | UADP-dekoderen i vår egen mottakerkode, kjørt på 222 opptatte datagrammer med oppsettet for de 17 feltene | alle 111 meldinger dekodet, hver kontrollerte verdi riktig | alle 111 meldinger dekodet, hver kontrollerte verdi riktig, matrisene med Int32-lengden og utfyllingen |

## RawData-matriser og -strenger

Dette biblioteket skriver et Int32-elementantall før hver RawData-matrise, og en streng som en Int32-lengde, bytene og så nullutfylling opp til MaxStringLength. Det er det OPC Foundations referansestack gjør, og det følger spesifikasjonsteksten: OPC 10000-14 7.2.4.5.11 ("handled like a Structure DataType", utfylling "to the maximum size indicated by ArrayDimensions or MaxStringLength") med OPC 10000-6 5.2.5 ("One dimensional Arrays are encoded as a sequence of elements preceded by the number of elements encoded as an Int32 value").

HotLoop cores subscriber og den andre dekoderen leser begge RawData-matrisene på denne måten, med lengden og utfyllingen, og begge dekoder dette bibliotekets RawData.

En forskjell fra referansestacken: der den kaster et unntak når en streng er lengre enn MaxStringLength, kutter dette biblioteket den ved en tegngrense, fordi en PLS-oppgave ikke har noe sted å kaste til.

## Hva du bør vite

* Kjøringen var på CODESYS Control for Linux SL 4.22.0.0 på x86-64. Biblioteket er Structured Text, og håndteringen av byterekkefølge for et big endian-mål er skrevet, men du sjekker den på din egen kontroller.
* Multicast: blokken setter TTL, loopback og sendegrensesnitt for en multicast-gruppe. Sjekk gruppen på ditt eget nettverk.
* Blokken teller sendefeil og venter når nettverket forsvinner eller en adresse ikke finnes, og programmet fortsetter å skanne.
* I demomodus stopper kjøretiden ved slutten av to-timersvinduet sitt, slik CODESYS sier at den gjør.
