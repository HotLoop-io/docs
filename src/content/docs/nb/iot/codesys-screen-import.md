---
title: "Importer en CODESYS-skjerm"
description: "Eksporter en CODESYS-visualisering fra IDE-en og importer den som en HotLoop-skjerm på PLS-ens variabler, med elementer som ikke kunne plasseres først."
---

Operatørene dine har allerede en CODESYS-skjerm. Eksporter den fra IDE-en, importer den i HotLoop, og den åpnes som en HotLoop-skjerm på variablene til den samme PLS-en. Dette er veien bort fra WebVisu: PLS-en fortsetter å kjøre programmet sitt, HotLoop leser det gjennom OPC UA-koblingen, og skjermen er HotLoops. HotLoop for CODESYS kjører Edge, så dette er også importen dens.

## Slik bruker du den

I CODESYS-IDE-en velger du visualiseringen i prosjekttreet og bruker **Prosjekt, Eksporter** (CODESYS sin egen eksport, en `.export`-fil). Ikke **Eksporter PLCopenXML**: den filen har ingen visualisering i seg, og HotLoop sier fra hvis du velger den.

På Dashbord-skjermen velger du **Importer**, velger `.export`-filen og **Les filen**. Den forteller deg:

* visualiseringen den fant (en fil med flere spør deg hvilken),
* hver tag skjermen leser som denne installasjonen ikke har. Variablene kommer som `plc/<GVL>.<variable>`: koble enheten `plc` til HotLoop-enheten PLS-en står på, så flytter alle taggene seg samtidig, eller koble taggene én og én,
* **verdt å se på**: hvert element den ikke kunne legge på skjermen, med årsaken, før noe lagres.

Ingenting lagres før ingenting står i veien. Import krever `dashboards.write`, og en knapp eller et settpunkt på en tag som ikke er merket skrivbar, avvises her, akkurat som i et bygg, så skjermen aldri har en kontroll porten ville avvist.

Gjennom API-et er det `POST /api/dashboards/import` med `codesys` (teksten i filen) i stedet for `file`, og `visualization` for å navngi én av flere:

```json
{"codesys": "<ExportFile>...", "visualization": "Overview", "dryRun": true,
 "remap": {"devices": {"plc": "line-3"}}}
```

Rapporten har de vanlige `problems`, `warnings` og `remapped`, og en `conversion` med `mapped` (hvert element og hva det ble til) og `unmapped` (hvert element og hvorfor ikke).

## Hva som kommer med

| CODESYS-element | I HotLoop |
|---|---|
| Rektangel, avrundet rektangel, ellipse med tekst og en variabel (`Temperature: %2.1f C`) | en avlesning: variabelens tag, teksten foran som bildetekst, teksten bak som enhet, desimalene fra formatet |
| Det samme med tekst og uten variabel | en etikett |
| Lampe | en lampe, tent av variabelen og farget etter lampens egen farge (rødt er en feil, gult en advarsel, blått informasjon, alt annet en driftslampe). `NOT x` leser taggen motsatt vei |
| Måler, potensiometer | en avlesning av variabelen. En knapp som satte en verdi får også et settpunktkort med skalaen på skiven som grenser |
| Vippebryter, tippebryter, trykknapp | en lampe som viser tilstanden og et knappekort: på og av for en bryter, den ene verdien for et trykk |
| Polygon, polylinje og former uten tekst og uten variabel (rørene, tanken, rammene) | bildet bak symbolene, tegnet fra punktene og fargene deres |
| Gruppe | medlemmene, plassert fra gruppens hjørne |

Hvert element beholder pikselplassen sin: siden er symbolkortet, tegnet som ett skalert bilde, så skjermen holder formen i alle størrelser og på en telefon.

## Hva som ikke kommer med

Sagt i importen, én linje hver, aldri droppet i det stille:

* en elementtype uten HotLoop-symbol (en trend, en tabell, en glidebryter, et bildeelement og resten av verktøykassa),
* en variabel som er et uttrykk (`Temp * 2`, `a AND b`, et matriseelement): HotLoop viser en tag, så legg til en tag for uttrykket og pek en avlesning på den,
* en regel for synlighet, farge eller bevegelse styrt av en PLS-verdi: symbolet er der hele tiden og skifter ikke farge,
* en Bézier-kurve tegnes som rette linjer mellom punktene sine, og et rotert element blir ikke rotert,
* sidestørrelsen, som eksporten ikke inneholder: siden er like stor som det ytterste elementet, pluss en marg,
* tekst lengre enn 40 tegn kuttes, og skivene er tall, ikke skiver.

Tekststilene, skriftene og fargene i CODESYS-stilen er HotLoops: skjermen følger HotLoops tema.

## Hvordan den leser filen

CODESYS dokumenterer at den egne eksporten finnes og er XML, men ikke hva som står i den. Leseren her følger det IDE-en selv skriver (CODESYS 3.5 SP22, Visualization 4.10): hvert element lagrer innstillingene sine som en liste med nummererte medlemmer, og nummeret er CRC-32 av medlemmets sti i elementets beskrivelse, for eksempel `m_StaticPosition.iX`, som IDE-en installerer ved siden av seg. Testene inneholder verdier lest fra IDE-ens egen eksport. En innstilling som bærer en variabel og ikke leses, rapporteres som ovenfor, så en skjerm importeres aldri som komplett når den ikke er det.

## Neste steg

Åpne skjermen, sjekk avlesningene mot anlegget og legg settpunkt- og knappekortene der operatørene dine venter dem. En skjerm du bygde for hånd og en du importerte er det samme herfra: den eksporteres som en [skjermfil](/nb/iot/screen-file/), får ny versjon ved hver lagring og går til en annen installasjon på samme måte.
