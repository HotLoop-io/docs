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
| Et elements **Invisible**-variabel (`bInvisible`), eller gruppens | en `show`-regel på symbolet: det tegnes bare mens variabelen sier at elementet ville være synlig (`NOT x` snur det) |
| Et elements **Toggle color**-variabel | en `colors`-regel på symbolet: mens variabelen er på, males det i tonen nærmest elementets egen alarmfarge (rødt er `bad`, gult og oransje `warn`, blått `info`, grønt `ok`; et element uten egen alarmfarge er `bad`, siden CODESYS sin standard alarmramme er rød) |

Hvert element beholder pikselplassen sin: siden er symbolkortet, tegnet som ett skalert bilde, så skjermen holder formen i alle størrelser og på en telefon.

## Hva som ikke kommer med

Sagt i importen, én linje hver, aldri droppet i det stille:

* en elementtype uten HotLoop-symbol (en trend, en tabell, en glidebryter, et bildeelement og resten av verktøykassa),
* en variabel som er et uttrykk (`Temp * 2`, `a AND b`, et matriseelement): HotLoop viser en tag, så legg til en tag for uttrykket og pek en avlesning på den,
* en variabel for usynlig eller skiftende farge på en form som er tegnet inn i bakgrunnsbildet (et rør, en beholder, en ramme): bildet er ett bilde, så formen er alltid der og beholder fargen sin. Sies i importen, med variabelen,
* enhver annen innstilling styrt av en PLS-verdi (en fargevariabel for fyll, ramme eller tekst, en bevegelse, en blink, en tekstliste): symbolet er der slik det ble tegnet, og regelen rapporteres når variabelen er en vanlig variabel,
* en Bézier-kurve tegnes som rette linjer mellom punktene sine, og et rotert element blir ikke rotert,
* sidestørrelsen, som eksporten ikke inneholder: siden er like stor som det ytterste elementet, pluss en marg,
* tekst lengre enn 40 tegn kuttes, og skivene er tall, ikke skiver.

Tekststilene, skriftene og fargene i CODESYS-stilen er HotLoops: skjermen følger HotLoops tema.

## Hvordan den leser filen

CODESYS dokumenterer at den native eksporten finnes og er XML, og dokumenterer ikke hva som er i den. Leseren her følger det IDE-et selv skriver (CODESYS 3.5 SP22, Visualization 4.10): hvert element lagrer innstillingene sine som en liste med nummererte medlemmer, og nummeret er CRC-32 av medlemmets sti i elementets beskrivelse, for eksempel `m_StaticPosition.iX`, som IDE-et installerer ved siden av seg. IDE-ets egne elementtrær lister hver sti med sin id (`ITypeNode.CompletePath` og `CRCIdNumber`); id-ene til usynlig-variabelen (`m_pStateVariables..State.bInvisible`, 2880254039) og fargeskifte-variabelen (`m_pColorVariables..ToggleColor`, 1999528970) kommer derfra, og den første er id-en CODESYS-eksemplet Refrigerator lagrer gruppens `NOT Glob_Var.DoorOpen` på. Testene har verdier lest fra IDE-ets egen eksport. En innstilling som bærer en variabel og ikke leses, rapporteres som over, så en skjerm importeres aldri som komplett når den ikke er det.

## Neste steg

Åpne skjermen, sjekk avlesningene mot anlegget og legg settpunkt- og knappekortene der operatørene dine venter dem. En skjerm du bygde for hånd og en du importerte er det samme herfra: den eksporteres som en [skjermfil](/nb/iot/screen-file/), får ny versjon ved hver lagring og går til en annen installasjon på samme måte.

## TwinCAT-visualiseringer (.TcVIS)

En TwinCAT-fil `.TcVIS` er den samme visualiseringen i IDE-ets objektarkiv-XML, med de samme elementtypene og de samme medlems-id-ene, så den går gjennom den samme konverteren. Sjekket mot det virkelige PackML-eksemplet fra TwinCAT.

- Knapper: hver enkel tilordning i en knapps inndatahandling (`X := 5`, `X := TRUE`, `X := E_PMLCommand.ePMLCommand_Start`) blir et knappekort som skriver den verdien til X, og teksten kommer over som etikett. Et konfigurert Toggle-input blir paret med knapper, på og av. Kode som er mer enn en tilordning (en betingelse, et kall, aritmetikk) rapporteres med teksten sin.
- Enumerasjoner: OMAC PackML-medlemmene (`E_PMLCommand`, `E_PMLUnitMode`) er kjent, med numrene fra Beckhoffs PackML_HMI_Example-konfigurasjon og `E_PMLUnitMode`-deklarasjonen fra SPT-Libraries. Enhver annen enumerasjon går i importens `enums` (`{"E_Own.eOwn_Go": 7}`). Et medlem uten kjent nummer skrives med navnet sitt og rapporten sier det.
- Uttrykk: variabelen til en lampe og en usynlig-variabel kan være en sammenligning av én tag med et tall, TRUE, FALSE eller et enumerasjonsmedlem (`=`, `<>`, `<`, `<=`, `>`, `>=`), NOT, AND og OR, med parenteser. De blir en symbolregel (se DASHBOARDS.md: `lit`-regelen til en lampe, `show`- og `colors`-reglene til et symbol, som kan kombinere regler med `all` og `any`). En sammenligning av to tagger, aritmetikk og kall kan ikke uttrykkes og rapporteres med delen som ikke lot seg gjøre.
- Rammer: en ramme viser en annen visualisering. Send prosjektets andre filer sammen med den første (`codesysRelated` i API-et; i dialogen velger du flere filer og den første er skjermen). Rammens visualisering plasseres i rammen, med hver inngang den tar bundet til variabelen rammen fikk (V_Modules `HMI` blir `MAIN.VFFSDemo.Sealer.PackMLBaseModule_HMI`). En ramme hvis visualisering ikke er blant filene rapporteres med navnet sitt.

PackML-settet (V_Main med V_Module og V_MachineModule): 60 elementer tilordnet, ingen utilordnet.
