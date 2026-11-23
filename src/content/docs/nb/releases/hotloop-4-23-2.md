---
title: "Utgivelsesnotater: HotLoop core 4.23.2"
description: "Hva HotLoop core 4.23.2 gir deg, hva som endrer seg ved oppgradering og hva du bør lese før du rører et anlegg i drift."
sidebar:
  label: "4.23.2"
---

En CODESYS-skjerm kommer nå over som en HotLoop-skjerm, boksen melder sin egen helse til EmberNet-dashbordet, og en energimåler kan bære en effektavgift. Det er også en opprydding av testpakkens feil på trege noder, hver en ekte venting eller et ekte kappløp rettet. Bygd bare for amd64; multi-arch-bygget følger som neste versjon.

## Hva som er endret

- **En CODESYS-visualisering importeres som en skjerm.** Eksporter den fra IDE-en (Project, Export, den opprinnelige `.export`-filen, ikke PLCopenXML), og Import på Dashboards-skjermen leser den som en HotLoop-skjerm på PLS-ens variabler. Hver tag skjermen leser som denne installasjonen mangler, listes, med en enhetstilordning, og hvert element HotLoop ikke kunne plassere, listes med årsaken før noe lagres. En knapp eller et settpunkt på en tag som ikke er skrivbar, avvises, som ved et bygg. Se [Import a CODESYS screen](/nb/iot/codesys-screen-import/).
- **Bokshelse for EmberNet-dashbordet.** En enhet oppkalt etter Kubernetes-noden publiserer boksens CPU-, minne-, disk- og datavolumbruk, og sanntidsjitteren til tre kjerner når en agent skriver filen for den. Verdier som ikke kan leses, har dårlig kvalitet med årsaken, aldri null. OPC UA-serveren serverer historikken deres. Se [OPC UA-serveren](/nb/edge/opc-ua-server/#maskinhelse-for-embernet-dashbordet) og [Protokoller og drivere](/nb/iot/protocols/#boksens-helse).
- **En innlogging som kan lese og ingenting annet.** Et deployment kan lage én konto med akkurat `tags.read` og `values.read` (`HOTLOOP_READER_USER` og `HOTLOOP_READER_PASSWORD_HASH`). Chartet lager `embernet-dashboard-read` ved første installasjon, holder passordet i Secret `<release>-opcua-dashboard` og roterer det aldri ved oppgradering.
- **Dashbordets sertifikat stoles på fra en Secret.** Chartet monterer `<release>-opcua-trust` (valgfri), og OPC UA-serveren holder sin trusted-mappe i takt: et nytt sertifikat legges til innen 30 sekunder, ett som forlater Secret, tas ut, og en fil en operatør la dit for hånd, røres aldri. Serveren tar fortsatt bare Basic256Sha256 SignAndEncrypt, ingen anonyme sesjoner, ingen trust-all. Versjonens Service lister nå port 4840 når serveren er på.
- **Energi: en effektavgift og skift.** En måler i Wh, kWh eller MWh tar en `demand_price`, hva ett kilowatt av dens høyeste kvarter i et vindu koster, og oppsummeringen viser toppen, når den startet og hvor mye av det kvarteret som ble lest. Et skift er et vindu, `shift:06:00-14:00` for det siste som har startet og `last_shift:06:00-14:00` for det før. Energy-skjermen har en Shift-boks og en effektpris, på alle tretten språk.
- **En kostnad per produsert enhet leses ikke lenger som gratis.** Når ting er produsert og ingen prismåler har talt forbruk ennå, er svaret ingen, med årsaken `nothing_counted`, ikke null.
- **CODESYS-runtimer i testing, skrevet ned.** OPC UA-serveren til en ekte runtime gjøres sikker med PLS-shell-kommandoene CODESYS dokumenterer, og en Basic256Sha256 SignAndEncrypt-lesing er bevist mot den. En ekte alarm utløses, kvitteres og forsvinner etter det en kjørende PLS melder. Hva en enhet gjør når to-timers demovinduet til en ulisensiert runtime tar slutt, er notert, med tidslinjeskriptet. Dette er tester og notater i [Protokoller og drivere](/nb/iot/protocols/); driveren er uendret.
- **Rettinger testpakken fant.** Energimotoren leser ikke lenger en måler mens den slettes eller endres (databasen brøt fastlåsingen ved å la slettingen feile). En sikkerhetskopis manifest skrives med et midlertidig navn og døpes om på plass, så en oppføring aldri ser en halv fil. Historians innhenting venter til alt opp til et merke er skrevet. Resten er tester som nå venter på det de påstår, på en belastet node, i stedet for et fast antall sekunder.

## Boksens helse er på som standard

Chartet monterer vertens rot på `/host` og dens `/proc` på `/host/proc`, begge skrivebeskyttet, og legger til ingen privilegier: bare en statfs og CPU- og minnetellerne leses. En klynge som håndhever restricted-profilen i Pod Security, avviser en hostPath. Der setter du `opcuaServer.dashboard.boxHealth.enabled: false` (ingen enhet, ingen mounts) eller `hostMount: false` (enheten, med boksens disk og CPU lest som dårlige og med beskjed om hva som skal monteres). Quadlet-drop-in er `deploy/quadlet/opcua-dashboard.conf`.

## Migreringer

Én, og den legger bare til: `0030_energy_demand` (en `demand_price`-kolonne på målere og bøttene deres, standard 0, så ingenting som allerede er talt eller prissatt, endrer seg). En sikkerhetskopi tatt på 4.23.1 gjenopprettes her, og en tatt her gjenopprettes ikke på en eldre versjon.

## API-endringer

`demand_price` i tariffen til en energimåler, en `demand`-blokk i en oppsummeringsrad, `shift:` og `last_shift:` som energiperiode, og `reason` på `cost_per_unit` når den er null. `POST /api/dashboards/import` tar `codesys` og `visualization` i stedet for `file`, og rapporten bærer en `conversion`. Se [HTTP-API-et](/nb/iot/api/).

## Oppgradere fra 4.23.1

En vanlig `helm upgrade`. Migreringen kjører ved første oppstart. Chartet lager den skrivebeskyttede kontoen og dens Secret ved første installasjon av denne versjonen og roterer den aldri; ingenting som allerede er på boksen, endrer seg.

## Hva som ikke er bevist

- Elementer den ikke kjenner, listes og utelates, aldri gjettes, og en skjerm fra et annet prosjekt kan liste flere.
- Sanntidsjitter-taggene trenger en agent som skriver filen, og ingen installeres av denne versjonen.
- Den skrivebeskyttede innloggingen og sertifikattilliten ble bevist mot HotLoops egen klient. EmberNet-dashbordets side er sin egen versjon.
- Det sikre CODESYS-endepunktet ble bevist i testing på én runtimeversjon. HotLoops driver endret seg ikke for det, og ingen oppsettskjerm for det sikre endepunktet er en del av denne versjonen.
- Effekttariffer ble sjekket mot innspilte målinger, ikke mot et nettselskaps regning.
