---
title: "Energi"
description: "Målere i 15-minuttersbolker, en tariff som setter pris på hver bolk når den lages, effektavgift, skift og kostnaden for én enhet produsert."
---

Hva anlegget bruker og hva det koster: kilowattimer, gass, vann, trykkluft og kostnaden for én enhet produsert, på én skjerm, laget for en produksjonshall. Ingen ny maskinvare og ingen ny protokoll. En måler er en tag HotLoop allerede leser, og dette er regnskapet oppå: det taggen talte, lagret i databasen og prissatt.

## En måler

En måler leser én tag som en mengde brukt. Den har én av to moduser.

| Modus | Taggen er | Det som ble brukt er |
|---|---|---|
| `counter` | en kumulativ telling: et kWh-register, en gasstotalisator, pulsene fra en vannmåler | hvor langt den har flyttet seg, ganger målerens `factor` |
| `power` | en rate: kW som trekkes akkurat nå, i `W`, `kW` eller `MW` | gjennomsnittet av to avlesninger over tiden mellom dem |

`factor` er hva ett steg på en teller er verdt i målerens enhet: `0.001` gjør et register i Wh om til kWh, `0.01` betyr at en puls er en hundredel kubikkmeter. Utelatt er den 1. En effektmåler tar ingen faktor: `power_unit` og `unit` (`Wh`, `kWh` eller `MWh`) forteller hvordan det skal regnes om.

| Type | For | Vanlig enhet |
|---|---|---|
| `electricity` | kWh | kWh |
| `gas` | gass | m³ |
| `water` | vann | m³ |
| `air` | trykkluft | m³ |
| `heat` | damp, varmtvann, varme | kWh |
| `production` | produserte enheter | enheter |

En `production`-måler teller det linja har produsert. Den har ingen tariff, og det er den kostnaden for én enhet deles på.

Lag en på skjermen Energi (Ny måler) eller med `POST /api/energy/meters` (se [HTTP-API-et](/nb/iot/api/#energi)). Bare en administrator lager, endrer eller fjerner en måler (`energy.write`); alle leser (`energy.read`). Taggen må finnes og være et tall. Hvis taggen slettes senere, sier måleren at den venter, og tar opp taggen igjen når den lages på nytt.

## Hvordan den teller

Hvert tiende sekund leser motoren taggen til hver måler fra den samme hurtigbufferen som hver skjerm leser, og regner ut hva hver ny avlesning legger til. Det den legger til, går i bolker på 15 minutter, i databasen, i samme transaksjon som målerens siste avlesning. Så en omstart mister ingenting og teller ingenting to ganger.

* **En teller** legger til hvor langt den har flyttet seg siden forrige avlesning, fordelt over tiden mellom de to avlesningene i forhold til tiden i hver bolk.
* **En teller som går baklengs** ble nullstilt eller byttet. Ingenting sier hvor mye som ble brukt, så ingenting legges til: den nye verdien er det nye startpunktet, og måleren teller nullstillingen (`status.resets`).
* **En teller som fortsatte å telle mens HotLoop var av.** Bevegelsen er ekte og alt beholdes, fordelt jevnt over gapet, og hver bolk den berørte merkes som **estimert**. Et gap er mer enn ti minutter mellom to avlesninger.
* **En effekt** er gjennomsnittet av to avlesninger over tiden mellom dem. For et gap på mer enn ti minutter er det ingenting: måleren dikter ikke opp en effekt for tid ingen leste, og gapet telles (`status.gap_seconds`). Hver bolk sier hvor mange av de 900 sekundene sine som har avlesninger (`covered_seconds`), og skjermen sier «Lest for 63 % av perioden» når en effektmåler ikke ble lest for en del av den. En effektavlesning som ikke brukte noe, dekker likevel tiden sin.
* **En dårlig avlesning** (taggens kvalitet er ikke god) legger ikke til noe, og måleren sier det på kortet sitt med årsaken. En teller som ikke ble lest og kommer tilbake, teller det den har flyttet seg i mellomtiden, som et gap.
* **En avlesning som ikke kunne lagres** regnes ut på nytt ved neste takt fra samme startpunkt.

## Hva det koster

En tariff setter pris på hver bolk når den lages: en fast `price` per enhet og eventuelt `bands` for en tidsdifferensiert tariff. Et bånd er `from` og `to` på et kvarter i lokasjonens egen klokke (et `to` før `from` går over midnatt), `days` det gjelder på (`mon` til `sun`, hver dag hvis utelatt) og en `price`. Det første båndet som gjelder i øyeblikket, vinner; utenfor alle bånd gjelder den faste prisen. En bolk prises midt i tiden hver avlesning dekker.

Fordi kostnaden lagres sammen med bolken, **endrer ikke en pris som endres senere hva forrige måned kostet.** Å endre tariffen til en måler endrer det den teller fra da av.

`currency` er en kode eller et symbol. Kostnader i to valutaer legges aldri sammen: sammendraget har en kostnad for hver.

### En effektavgift

En strømmåler i `Wh`, `kWh` eller `MWh` kan ha en `demand_price` i tariffen sin: hva ett kilowatt av anleggets høyeste kvarter koster. Over et vindu er en bolks effekt kilowattene den hadde i snitt (et kvarter som brukte 25 kWh hadde i snitt 100 kW) og avgiften er det ganger effektprisen måleren hadde da bolken ble laget. Vinduets avgift er den høyeste av dem, som for én pris er toppen ganger prisen. Sammendraget gir hver slik måler en `demand` med toppen i kW, når den startet og avgiften, og legger avgiften inn i vinduets kostnad og i kostnaden for én enhet produsert. Målerens egen `cost` forblir det energien kostet.

Som energiprisen lagres effektprisen sammen med hver bolk når den lages (migrering 0030), så **å endre en effektpris endrer det som telles fra da av og aldri måneden som er over.** Bolker laget før måleren hadde en effektpris, har ingen: de viser en topp og ingen avgift.

Et kraftselskap fakturerer effekt over faktureringsmåneden sin, så be om `this_month` eller `last_month` for å se linja på fakturaen; et kortere vindu gir avgiften for det høyeste kvarteret inni det. Hvis toppkvarteret ikke ble lest hele veien (`peak_covered_seconds` under 900), er toppen undervurdert, og skjermen sier det. `Today`-sensorene under teller bare energi: en effektavgift er en linje på månedens faktura, ikke noe som påløper hele dagen.

## Kostnaden for én enhet produsert

Kostnaden over et vindu for de prissatte målerne du velger, delt på det en produksjonsmåler talte i samme vindu. Sammendraget gir én for hver produksjonsmåler og valuta. Når ingenting ble produsert, er kostnaden per enhet `null` med `reason` `nothing_made`, og skjermen sier «Ingenting produsert»: det er ikke noe svar, ikke null og ikke en deling på null. Det samme når noe ble produsert og ingen prissatt måler har talt noe forbruk ennå (`nothing_counted`, «Ingen energi talt ennå»): målerne leses etter hverandre, så et register som ikke har beveget seg ennå, er ikke et gratis produkt. En måler som talte noe til prisen null, teller likevel, og gir en kostnad på null.

`GET /api/energy/summary?period=today&meters=line2-electricity,line2-air&per=line2-parts` regner det ut for én linje: `meters` nevner målerne hvis kostnad tas med, `per` produksjonsmåleren. Uten dem er det alle prissatte målere over alle produksjonsmålere.

## Vinduer

`period` er `today`, `yesterday`, `this_week` (uker starter på mandag), `last_week`, `this_month`, `last_month`, `last_7_days` eller `last_30_days`, et skift, eller oppgi `from` og `to` som RFC 3339 (høyst 400 dager). Dager, uker og måneder er **lokasjonens**, i dens egen tidssone (`HOTLOOP_TIMEZONE`): midnatt er anleggets midnatt, og dagen på 23 eller 25 timer er den virkelige dagen. Et skift skrives `shift:06:00-14:00`, fra og til på et kvarter i lokasjonens klokke, og et `to` som ikke er etter `from` går over midnatt (`shift:22:00-06:00`). `shift:` er det siste som har startet, som er det som går nå når et gjør det, og `last_shift:` er det før. Et skift bygges ut fra kalenderdagen, så natten klokka skifter er like lang som den virkelig var. Skjermen har en Skift-boks ved siden av periodene, og de samme navnene brukes i perioden til MCP-verktøyene. Serier kuttes i steg på `quarter` (høyst 8 dager), `hour`, `day` eller `month`.

## På skjermen

Skjermen Energi (gruppen Anlegg) har en periodevelger, kostnaden for perioden, kostnaden per enhet produsert for hver produksjonsmåler og et kort for hver måler: hva den brukte, hva det kostet, en stolpe for hver time (eller dag) og, når det gjelder, om den leses, om deler av den er estimert og hvor mye av perioden en effektmåler ble lest for. En stolpe med stiplet kant er estimert. En måler som ikke kan leses, sier hvorfor. Hvert ord finnes på alle 14 språk.

## Entiteter

Hver måler gir sensorer som hver skjerm og regel kan bruke:

| Entitet | Tilstand |
|---|---|
| `sensor.<meter>_today` | det måleren har brukt siden lokasjonens midnatt, i sin enhet |
| `sensor.<meter>_cost_today` | det det kostet (en prissatt måler) |
| `sensor.<production meter>_cost_per_unit_today` | dagens kostnad delt på dagens produserte enheter. `unknown` til noe er produsert, og når målere er prissatt i to valutaer |

De er plattformen `energy`, de leser, og tar ingen tjeneste. En måler som sluttet å svare, er fortsatt det den brukte så langt, med kvaliteten `uncertain` og `meter_status` som sier hvorfor.

## MCP

Agenter leser og administrerer målere gjennom de samme rutene:

| Verktøy | Gjør |
|---|---|
| `list_energy_meters`, `get_energy_meter` | målerne, hvordan hver leses, og dagens forbruk og kostnad |
| `get_energy_summary` | hva hver måler brukte og kostet over en navngitt periode, kostnaden i hver valuta og kostnaden for én enhet produsert |
| `get_energy_series` | én måleres forbruk over en navngitt periode i steg |
| `create_energy_meter`, `update_energy_meter`, `delete_energy_meter` | lage, endre og fjerne en måler. Hver krever en begrunnelse og blir gransket |

Filtrene `meters` og `per` for kostnad per enhet er REST-spørringsparametere.

## Sikkerhetskopi og oppdateringer

Tre tabeller holder det (migrering 0029): `energy_meters`, `energy_meter_state` og `energy_buckets`, alle i sikkerhetskopien. Migrering 0030 legger effektprisen til målerne og til hver bolk. Migreringene legger bare til. En bolk er rundt 100 byte, så en måler er rundt 3,5 MB i året.

## Hva den ikke gjør

* **Den kjenner ikke skiftene dine.** Et skift navngis i forespørselen, som `shift:06:00-14:00`; det finnes ingen liste over anleggets skift å velge fra, og et skift som ikke ligger på et kvarter, avvises fordi bolkene er kvarter.
* **Den fakturerer ikke effekt for deg.** Avgiften er det høyeste kvarteret i vinduet ganger prisen; et kraftselskaps trinn, minimumseffekter og avgifter for effektfaktor er ikke med.
* **Den leser ikke en måler for deg.** Taggen kommer først: legg til enheten (Modbus, MQTT, OPC UA, eller Emberburn for en simulert), og lag så måleren.
