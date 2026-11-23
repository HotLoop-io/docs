---
title: "Veikart for Transmitter"
description: "Hva HotLoop Transmitter allerede har bygget, hva som kommer neste og hva som bevisst ikke er planlagt."
---

Hva som er i pakken i dag, hva som kommer neste og hva som bevisst ikke er planlagt. En linje flyttes til «Levert» først når den har kjørt på den ekte 4.22.0.0-kjøretiden og en mottaker har lest den.

## Levert i 1.2.0

* HotLoop Alarms, et bibliotek som leser de aktive, ventende og kvitterte alarmene i CODESYS sin alarmbehandler inn i enkle variabler og utfører kvitteringen HotLoop skriver tilbake. Det kjørte på den ekte 4.22.0.0-runtimen, og alarmlisten i HotLoop leste det.

## Levert i 1.1.0

* Tidsstempler i DataSetMessage og NetworkMessage fra PLS-ens sanntidsklokke, på som standard; `bTimestamp` slår dem av.
* Biblioteket som CODESYS `.package`, installert gjennom CODESYS Installer.

## Levert i 1.0.0

* Én publisher-blokk, `FB_HLTX_Publisher`: én NetworkMessage per publiseringsintervall, én DataSetMessage, en Data Key Frame, UADP over UDP, fra Structured Text over SysSocket.
* Feltkodingene Variant og RawData.
* Feltene BOOL, SINT, USINT, INT, UINT, DINT, UDINT, LINT, ULINT, REAL, LREAL, STRING og TIME, og matriser av alle unntatt STRING, i begge kodinger.
* Unicast- og multicast-mål, publisher id, writer group id, dataset writer id, publiseringsintervall, gruppeversjon og konfigurasjonsversjon, alle satt som innganger på blokken.
* En ikke-blokkerende sending, begrenset kostnad per kall, tellere for sendt, avvist og hoppet over, og en feiltilstand som aldri får applikasjonen til å feile.

## Neste

* Tidsstempler under ett sekund. Stempelet i 1.1.0 er sanntidsklokkens hele sekunder.
* Flere DataSetMessages i én NetworkMessage (Sizes-matrisen), slik at ett datagram kan bære mer enn én writer.
* Data Delta Frames og KeepAlive-meldinger, for å kutte bytene i et stort sett stabilt datasett.
* WSTRING-felt.
* En status per felt, slik at en Bad-verdi kan sendes som Bad.

## Ikke planlagt

* Meldingssikkerhet (signering og kryptering). Blokken sender i klartekst, på et nettverk anlegget allerede stoler på.
* Oppdelte NetworkMessages. En melding som ikke får plass i en ramme på 1500 byte avvises, ikke deles.
* Subscriber-siden. HotLoop core abonnerer på UADP; dette biblioteket publiserer.
* MQTT-transport. UDP er det en CODESYS-kjøretid når uten flere biblioteker.
