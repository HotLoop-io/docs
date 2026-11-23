---
title: "Utgivelsesnotater: HotLoop core 4.23.1"
description: "Hva HotLoop core 4.23.1 gir deg, hva som endrer seg ved oppgradering og hva du bør lese før du rører et anlegg i drift."
sidebar:
  label: "4.23.1"
---

Denne versjonen bærer alt notatene for 4.23.0 lister. Vær og energi, webgrensesnittet på tretten språk til, skjermer som flyttes mellom installasjoner som filer, og de første kommandoene til en UniFi-konsoll. Bygd bare for amd64; multi-arch-bygget følger som neste versjon.

## Hva som er endret

- **En værstasjon er én entitet.** Bygd av taggene en takstasjon allerede publiserer (temperatur, fuktighet, trykk, vind, regn, sol), med duggpunkt, varmeindeks og vindkjøling regnet ut på boksen. En sensor stasjonen ikke fikk, har ingen rad, og en som sluttet å svare, leses Unavailable, aldri null. Ingen skytjeneste kalles. Se [Weather](/nb/iot/weather/).
- **Energimålere.** En måler er en tag lest som en forbrukt mengde (en kumulativ teller som kWh, gass, vann eller luft, eller en effekt). Det som er brukt, holdes i 15-minuttersbøtter, så en omstart mister ingenting og et skift, en dag eller en måned er en sum. En tariff gir hver bøtte en kostnad når bøtta lages, så en pris endret senere ikke endrer hva forrige måned kostet, og kostnaden for en produsert enhet regnes ut fra en produksjonsmåler. Det finnes en Energy-skjerm, API-et og MCP-verktøy. Se [Energy](/nb/iot/energy/).
- **Webgrensesnittet kommer på tretten språk til** ved siden av engelsk: spansk, fransk, italiensk, tysk, norsk, bulgarsk, gresk, koreansk, japansk, vietnamesisk, hindi, forenklet kinesisk og arabisk, lagt ut fra høyre mot venstre. Velg ett i topplinjen eller på innloggingskortet. Se [Languages](/nb/iot/languages/).
- **Et dashbord eksporteres til en fil og importeres i en annen installasjon.** En kundes skjermer er deres og aldri en del av produktet: filen lister hver tag, enhet, skript og oppskrift den nevner, og en import melder alle problemer på én gang, med en tilordning for navn som er forskjellige, før noe lagres. Export og Import er knapper på Dashboards-skjermen, og `screen_export` og `screen_import` er MCP-verktøy. Se [Screen files](/nb/iot/screen-file/).
- **MCP-lesinger som hører til skrivingene**, redigerernes tørrkjøringer og CODESYS-alarmimporten.
- **De første kommandoene til en UniFi-konsoll.** Fem typer punkter kan kommanderes, hver skrivebeskyttet til en person armerer den taggen, gjennom skriveporten som enhver tag: en enhets lokaliserings-LED, en enhets omstart, PoE-strømsyklusen til en svitsjport, et trådløst nett på eller av, en overvåket klient blokkert eller sluppet inn igjen, og en ports PoE-modus. En strømsyklus holdes til en nedkjøling på 15 minutter som lagres i databasen, så en omstart ikke glemmer den, og en port som bærer nettverket (en uplink, en svitsj, en gateway, en 5G-backup, en peer konsollen ikke lister) blir aldri syklet. Konsollkontoen HotLoop logger inn med, må være lokal Administrator for disse; en View Only-konto avvises av konsollen, og HotLoop sier det. En innebygd blueprint sykler porten til en taus enhet én gang og utløser så en alarm. Se [UniFi Network](/nb/iot/unifi/).
- **OPC UA-serveren svarer på HistoryRead** fra historikken Gateway holder, rå og bearbeidet.
- **OPC UA PubSub delta-rammer, som valg.** `HOTLOOP_UADP_PUBLISH_DELTA_FRAMES=true` sender bare feltene som endret seg mellom key-rammer. Av som standard.
- **Et bildekort på en panelside passer i kortet sitt** og setter ikke lenger radhøyden.
- **Database-oppgraderingsenheten til en Quadlet-installasjon hopper over seg selv** når volumet ikke har noe å oppgradere, fordi Podman 5.7 ikke starter en container uten noe å kjøre, og navnet på den medfølgende databasen er tilpasset de 52 tegnene et StatefulSet kan ha.
- **Chartene beholder legitimasjons-Secret ved avinstallering**, som databasens volum: en ominstallasjon med samme navn pleide å generere et nytt passord som den beholdte databasen avviste. For å starte rent, slett Secret for hånd sammen med volumet.
- **Kafka-utgangen venter** på megleren på et topic laget et øyeblikk siden så lenge tilkoblingen tillater, og Edge Relays dokumenterte tall for avbruddskøen er de målte (omtrent to minutter ved 2,000 målinger i sekundet).
- Rettinger testpakken fant: OPC UA-testbrukerne hashes med bcrypts laveste kostnad, så en innlogging i pakken ikke lenger overskrider det testklienten venter på en treg runner (serveren og innloggingen er uendret), direktefeeden glemmer det den sendte i det siste siden går, OPC UA-serveren sier når lytteren holder porten, og flere tester sover ikke lenger på ting som skjer i sin egen tid.

## Migreringer

To, hver legger bare til: `0028_unifi_port_cycles` (når hver svitsjport sist ble strømsyklet) og `0029_energy` (tre tabeller for målere og bøttene deres). Begge er i sikkerhetskopier. En sikkerhetskopi tatt på 4.22.1 gjenopprettes her, og en tatt her gjenopprettes ikke på en eldre versjon.

## API-endringer

Nye ruter: `GET /api/energy/meters`, `POST /api/energy/meters`, `GET`, `PUT` og `DELETE /api/energy/meters/{id}`, `GET /api/energy/summary` og `/api/energy/summary/{period}`, `GET /api/energy/series` og `/api/energy/series/{meter}/{period}/{step}`, `GET /api/dashboards/{id}/export`, `POST /api/dashboards/import` og `GET /api/entities/composites`. To nye rettigheter: `energy.read`, som hver rolle har, og `energy.write`, som en admin har. Nye MCP-verktøy for hver. En værstasjon er et nytt entitetsdomene, `weather`. Se [HTTP-API-et](/nb/iot/api/).

## Oppgradere fra 4.22.1

En vanlig `helm upgrade`. Migreringene kjører ved første oppstart og legger til tabeller; ingen ny secret. Ingenting som var av, slås på.

## Hva som ikke er bevist

- De andre kommandoene er ikke kjørt mot en ekte konsoll.
- Vær og energi ble kjørt mot opptak, en Modbus-rigg og Emberburns simulerte tellere, ikke mot en ekte takstasjon eller et anleggs målere.
- De tretten nye språkkatalogene ble skrevet fra den delte ordlisten, og ingen morsmålsbruker har sett over dem.
