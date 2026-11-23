---
title: "Integrasjoner"
description: "Pek HotLoop mot en enhet du kjenner adressen til, se hva som faktisk er der, og behold punktene du vil ha. SNMP, BACnet/IP og OPC UA, skrivebeskyttet."
---

En integrasjon er måten du peker HotLoop mot en type enhet du kjenner adressen til, svarer på noen spørsmål, ser hva som faktisk finnes på den, og beholder punktene du vil ha. Den lager enheten og taggene dens. Entiteter følger av taggene slik de gjør for alle tags, så de nye punktene finnes i entitets-API-et, i automasjoner og på dashbord et minutt senere.

Det finnes tre måter en enhet kommer inn i HotLoop på, og de er laget for å fungere side om side:

| <span class="sr-only">Details</span> | Hvem som starter den | Hva den trenger |
|---|---|---|
| [MQTT-oppdagelse](/nb/iot/mqtt-discovery/) | Enheten, ved å melde seg på en broker | En publisher som snakker ett av formatene |
| [Nettverksoppdagelse](/nb/iot/network-discovery/) | Nettverket, ved å bli lyttet til | Ingenting fra enheten; den forteller deg hva den hørte og hvordan HotLoop kunne snakke med den |
| **Integrasjoner** (denne siden) | Du, med en adresse | En enhet som svarer på sin egen protokoll |

En integrasjon skriver aldri til enheten, og ingenting den lager er armert. Et punkt som er funnet, er et punkt ingen ennå har bestemt skal kunne styres, så hver tag et oppsett lager, er skrivebeskyttet til noen armerer den, én om gangen, i tag-editoren, akkurat som en tag fra en hvilken som helst annen kilde.

## Hva som finnes

| Integrasjon | Protokoll | Verifisert mot |
|---|---|---|
| OPC UA-server (`opcua`) | [OPC UA](/nb/iot/protocols/#opc-ua) | En ekte OPC UA-server |
| SNMP-enhet (`snmp`) | [SNMP](/nb/iot/protocols/#snmp) | En ekte SNMP-agent, v1, v2c og v3 |
| BACnet/IP-enhet (`bacnet`) | [BACnet/IP](/nb/iot/protocols/#bacnetip) | En uavhengig BACnet-stack |
| CODESYS PLS (`codesys`) | [CODESYS](/nb/iot/protocols/#codesys) | CODESYS Control for Linux SL 4.22.0.0, med to ekte PLS-programmer, ett av dem mye større |

Flere legges til på dette rammeverket etter hvert som de kan bevises mot en ekte server.

## Den andre veien

En integrasjon henter en enhet inn. For å sende HotLoops målinger og hendelser ut til en Kafka-broker, se [Kafka API-hendelsesstrømmen](/nb/iot/historian-targets/#kafka-api-hendelsesstrøm) under historian-mål: Apache Kafka og Redpanda, TLS og SASL, målinger på ett topic og systemloggen på et annet. For å sende dem som OPC UA PubSub (UADP over UDP), eller for å lese en publishers, se [OPC UA PubSub](/nb/iot/protocols/#opc-ua-pubsub-uadp): å lese en er en enhet med protokollen `opcua-pubsub`, uten oppsettsflyt, siden en datagram bærer feltposisjoner og ikke navn.

## SNMP

For en svitsj, en UPS, en PDU, en strømmåler eller alt som kjører en SNMP-agent. Spørsmålene følger versjonen: v2c spør om en community, v3 spør om en bruker og bare passfrasene sikkerhetsnivået krever. Det finnes ingen standard community.

Proben går gjennom system-gruppen, grensesnitttabellene, vertsressursene, lasttabellen og extend-utdataene til en SNMP-agent, altså objektene HotLoop kan navngi, og viser hvert med det agenten sa at det inneholder akkurat nå. Den **foreslår** de en person som peker mot en ny enhet vil ha: enhetens navn, plassering og oppetid (vist i sekunder, ikke agentens hundredeler), hvert grensesnitts driftstilstand og feiltall, bytetellerne (de 64-biters der agenten har dem), lastgjennomsnittene og eventuelle extend-rader. I notatene sine sier den hvor mange av de foreslåtte punktene som er tellere, fordi en teller i en graf trenger en rate.

Alt annet agenten har, er fortsatt lesbart: sett det opp for hånd som en tag med OID-en som adresse. Se [SNMP-driveren](/nb/iot/protocols/#snmp) for hva en tag blir, hva et manglende objekt gjør, og hvorfor en feil v2c-community ser ut som en død enhet.

SNMP er alltid skrivebeskyttet her. HotLoop sender ikke SET.

## BACnet/IP

For en bygningsautomasjonskontroller, en måler, en termostat: alt på IP-nettverket som snakker BACnet. Spørsmålene er enhetens adresse, enhetsinstansen hvis du kjenner den (og da avviser HotLoop at en annen enhet svarer på den adressen), og hvilket nettverkskort det skal sendes fra hvis maskinen har to.

Proben spør enheten hvem den er, leser objektlisten og leser hvert analoge, binære og multi-state-objekt den finner (og heltalls-, store analog-, akkumulator- og tegnstrengverdiene): navn, beskrivelse, enheter, nåverdi og statusflagg. Den viser hvert med det den leste akkurat nå og foreslår de første hundre. Enheter kommer med som en etikett og, der de betyr en, en enhetsklasse, så en `degrees-celsius`-inngang er en temperatur i `°C`.

I notatene sier den hvor mange objekter som rapporterer en feil (de leser dårlig til enheten fjerner den) og hvor mange som er ute av drift (de leser usikkert, fordi verdien er den som ble skrevet til dem). Beskrivelsen til et multi-state-objekt lister tilstandene, og eksempelet viser tilstanden i tillegg til tallet.

BACnet er alltid skrivebeskyttet her. HotLoop skriver ingen egenskap og når ingen enhet bak en BACnet-ruter: se [BACnet/IP-driveren](/nb/iot/protocols/#bacnetip) for hva som er dekket og ikke.

## CODESYS

For en PLS som kjører en CODESYS Control-runtime. Spørsmålene er de samme som for OPC UA (adresse, sikkerhet, brukernavn og passord hvis PLS-ens brukeradministrasjon er på) og, bare hvis du trenger dem, hvilken del av applikasjonen som skal listes, navnene på PLS-en og applikasjonen, og hvor mange elementer av en array som skal listes.

Proben kobler til runtimens OPC UA-server, finner PLS-en og applikasjonen, og lister variablene applikasjonen eksporterer (Symbol Configuration) med navnene programmereren skrev, med typene og om hver kan skrives. Den foreslår applikasjonens egne variabler, ikke elementene i bufferne, og sier i notatene hvor mange arrayer den bare listet delvis. En PLS uten noe eksportert får vite hvordan man eksporterer noe.

En CODESYS-enhet leses én gang i sekundet, som er hvor ofte driveren ber runtimens OPC UA-server om å se på hver variabel, så et skjermbilde ligger omtrent ett sekund bak PLS-en og ikke mer. Runtimens egen standard er fem sekunder, noe som er tregt for et skjermbilde: en pumpe starter, og siden sier det fem sekunder senere. Endre enhetens pollingintervall, eller dens `samplingIntervalMs`, for å be om mer; gulvet hver enhet holdes til og serverens OperationLimits gjelder fortsatt.

Sett opp med `"dashboard": true` i forespørselen, så får punktene du beholder også et dashbord oppkalt etter enheten: en overskrift, en trend av tallene som beveger seg, enhetens alarmer og et verdikort for hvert punkt under en overskrift for variabellisten. Det er et første skjermbilde laget av programmet slik det er, og det redigeres som alle dashbord. Ingenting på det styrer noe, og hver tag er fortsatt skrivebeskyttet til den armeres.

En PLS med en runtime som starter på nytt eller et nytt program som lastes ned, tas opp igjen av seg selv: se [CODESYS-driveren](/nb/iot/protocols/#codesys).

## Flyten

Tre kall, i rekkefølge, og de to første lagrer ingenting.

1. **Spør.** `GET /api/integrations` lister hver integrasjon og spørsmålene dens. Hvert spørsmål har en type (`text`, `number`, `bool`, `choice` eller `secret`), en standardverdi, om det er påkrevd og, når det bare betyr noe etter et annet svar, `showWhen`. Et skjermbilde tegnes ut fra dette og ingenting annet, og derfor trenger en ny integrasjon ikke et nytt skjermbilde.
2. **Se.** `POST /api/integrations/{id}/probe` tar svarene, sjekker dem, kobler til den ekte enheten med integrasjonens egen driver og melder hva den er og hva den har: et foreslått navn, hva den sier om seg selv, notater verdt å lese og hvert punkt den fant som en tag-formet post med en `sample` av det den leste, så du kan sammenligne med tallet på maskinens eget display.
3. **Behold.** `POST /api/integrations/{id}/setup` tar de samme svarene og navnene på punktene som skal beholdes (ingen navngitt beholder de som er markert `suggested`), lager enheten og taggene og laster runtimen på nytt. Enheten er aktivert og pollet. En integrasjon som kan legge ut et første dashbord (CODESYS) gjør det når forespørselen har `"dashboard": true`, og svarer med dashbordets id.

Oppsettet ser på enheten igjen i stedet for å stole på proben. Hva en klient tror den fant for et minutt siden, er en påstand, og punktene sjekkes mot enheten slik den er når enheten lages. Et navn som ikke finnes på den, er en `400`, ikke et punkt som hoppes over, fordi noen ba om det ved navn.

Et oppsett som feiler halvveis (enheten lagret, taggene ikke) fjerner enheten det nettopp lagde. En enhet som allerede finnes, avvises med en `400` i stedet for å overskrives: for å legge til punkter på en enhet du har, bruk Browse og Import.

## Svar sjekkes før noe prøves

Rammeverket sjekker hvert svar mot spørsmålet før en integrasjon ser det, og melder alle problemer samtidig, så et skjema rettes én gang:

* et påkrevd spørsmål som er tomt, gir "X is required";
* et tall må være et heltall innenfor spørsmålets område, et valg må være ett av valgene, en bool må være en bool;
* et svar på et spørsmål integrasjonen ikke stiller, avvises, ikke ignoreres, fordi et feilstavet `pasword` som forkastes uten et ord, er en enhet som ikke får logget inn uten noen pekepinn på hvorfor;
* en hemmelighet kan ikke være plassholderen `[redacted]` som API-et viser i stedet for en lagret. Å sende den tilbake ville lagre plassholderen som passord;
* et spørsmål som ikke vises (`showWhen`), ignoreres og er ikke påkrevd.

Legitimasjon oppbevares som en enhets: forseglet i hvile når HotLoop har en forseglingsnøkkel, og skjult i hvert API-svar og hver feil. En probe lagrer aldri det den fikk.

## Når enheten ikke svarer

`502`, med det som gikk galt: "could not reach the device: ..." når ingenting koblet til, "connected, but could not list its points: ..." når den koblet til og så ikke svarte. Det er enhetens svar som skal leses, ikke en feil i HotLoop og ikke en dårlig forespørsel. En lukket port, en feil community eller en brannmur ender alle her, og meldingen er driverens egen.

## Hvor den sitter i produktet

Probe og oppsett når over nettverket fra HotLoop-boksen, så begge trenger `devices.write`, det samme som å lagre en enhet. Å liste trenger `devices.read`. Alle produkter har dem. Rutene står i [HTTP-API-et](/nb/iot/api/#integrasjoner).

## Legge til en

* `Info()` sier hva den er: id, navn, driverens protokoll, hvordan det spørres om adressen og spørsmålene;
* `Configure()` gjør sjekkede svar om til en adresse og driverens egen konfigurasjonsblokk, og avviser det et spørsmål ikke kan uttrykke;
* `Discover()` når den ekte enheten og melder hva som er på den.

Rammeverket avviser ved oppstart en integrasjon som ikke kan være en katalogpost: en duplisert id, en protokoll modellen ikke deklarerer, et spørsmål uten etikett, et valg uten alternativer, en standardverdi som ikke er et gyldig svar, eller en `showWhen` som navngir et spørsmål som ikke finnes. En test holder også hver integrasjon til en protokoll med en driver kompilert inn.

Der det ikke finnes noen ekte server å kjøre, finnes det ingen integrasjon, og [veikartet](/nb/roadmap/) sier hvilke som venter på maskinvare.
