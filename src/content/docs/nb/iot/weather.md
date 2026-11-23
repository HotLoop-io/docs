---
title: "Vær og værstasjon"
description: "En værstasjon på taket som én entitet, med duggpunkt, varmeindeks og vindkjøling regnet ut på boksen, uten skytjeneste."
---

En værstasjon på taket av anlegget, som én ting på skjermen. HotLoop ringer ingen for å finne ut at det regner. Stasjonen sier det: en Ecowitt eller en Tempest over MQTT, en Davis eller en Vaisala over Modbus, hva som helst over OPC UA. En måling fra en av dem er allerede en tag, og en vær-entitet er taggene til én stasjon, hver i sin rolle: temperaturen, fuktigheten, trykket, vinden, regnet og sollyset.

Ingen værtjeneste, ingen API-nøkkel, ikke noe internett. Et anlegg som mistet oppkoblingen for tre uker siden viser fortsatt temperaturen på sitt eget tak. (For hvor solen står, se [solen](/nb/iot/sun/); den regnes ut fra anleggets breddegrad og lengdegrad og trenger ingen stasjon i det hele tatt.)

## Slik bygger du en

En vær-entitet lages på samme måte som en motor (se [Entiteter](/nb/iot/entities/#sammensatt-utstyr)): en administrator navngir taggene. På Entiteter-skjermen, Nytt utstyr, Vær. Eller over API-et:

```json
POST /api/entities
{
  "domain": "weather",
  "name": "Roof station",
  "bindings": [
    {"role": "temperature", "device_id": "roof", "tag_name": "Temp"},
    {"role": "humidity",    "device_id": "roof", "tag_name": "Humidity"},
    {"role": "wind_speed",  "device_id": "roof", "tag_name": "Wind"},
    {"role": "wind_bearing","device_id": "roof", "tag_name": "Bearing"}
  ]
}
```

Bare `temperature` er påkrevd. En stasjon uten regnmåler har ingen `rain_rate` og viser ingen regnrad. Hver rolle tar en tall-tag, og ingen av dem skrives: en stasjon leses, den kommanderes aldri, så ingen tag må armeres og entiteten tar ingen tjeneste.

| Rolle | <span class="sr-only">Detaljer</span> | Attributt den lager |
|---|---|---|
| `temperature` | påkrevd, tilstanden | `unit_of_measurement` |
| `humidity` | relativ fuktighet, i prosent | `humidity` |
| `pressure` | lufttrykk, i taggens enhet | `pressure` |
| `wind_speed` | gjennomsnittlig vind | `wind_speed` |
| `wind_gust` | sterkeste nylige vindkast | `wind_gust` |
| `wind_bearing` | hvor vinden kommer fra, 0 til 360 grader | `wind_bearing` |
| `rain_rate` | hvor hardt det regner nå | `rain_rate` |
| `rain_today` | regn siden midnatt | `rain_today` |
| `solar_radiation` | sollys på sensoren, vanligvis i W/m² | `solar_radiation` |
| `uv_index` | UV-indeksen | `uv_index` |

Hvert attributt har også `<name>_unit` med enheten til taggen sin, så en skjerm aldri må gjette om trykket er i hPa eller inHg.

## Hva som regnes ut på boksen

Tre verdier en stasjon sjelden sender, regnet ut fra egne målinger:

| Attributt | Fra | Hvordan |
|---|---|---|
| `dew_point` | temperatur, fuktighet | Magnus-formelen (Sonntag 1990), holdt mot de psykrometriske tabellene fra 0 til 30 °C |
| `heat_index` | temperatur, fuktighet | Rothfusz-regresjonen til National Weather Service med de to publiserte justeringene. Den finnes bare fra 80 °F (26,7 °C) og opp, fordi det er der NWS slutter å bruke den |
| `wind_chill` | temperatur, vindhastighet | NWS-indeksen fra 2001. Den finnes bare ved 50 °F (10 °C) eller lavere med vind over 3 mph, området den ble tilpasset |

De kommer tilbake i temperaturens egen enhet, så en stasjon i grader Fahrenheit får et duggpunkt i grader Fahrenheit. Temperaturenhetene HotLoop konverterer er °C, °F og K, og vindenhetene m/s, km/h, mph, knop og ft/s, lest fra taggens enhet. En temperatur-tag uten enhet konverteres ikke ved å gjette: entitetens egen `unit_of_measurement` kan si hva den er, og uten noen av delene regnes ingenting ut fra den.

Det er ikke en feil at varmeindeksen og vindkjølingen mangler. Under 80 °F finnes det ingen varmeindeks, og i stille eller varm luft finnes det ingen vindkjøling, så kortet har ingen rad for dem.

## En manglende måling er ikke null

En vær-entitet er aldri optimistisk, og fyller aldri et hull med et tall.

* En sensor som ikke er bundet, er ikke en rad.
* En sensor som er bundet, men ikke kan leses akkurat nå (taggen er dårlig, enheten er nede, ingenting har kommet ennå), utelates fra attributtene og nevnes i `unavailable`. Kortet sier **Utilgjengelig** der tallet ville stått.
* En måling som ikke kan være en måling, behandles på samme måte: en fuktighet over 105 prosent, en retning utenfor 0 til 360 grader, et negativt regn eller en negativ vindhastighet. En fuktighet på 101 eller 102, som en sensor i tåke leser, vises som
  100. En pyranometers lille negative måling om natten vises som 0.
* En verdi som regnes ut fra en utilgjengelig måling, er også utilgjengelig, og nevnes: ingen fuktighet betyr ingen `dew_point` og ingen `heat_index`.
* Kan ikke temperaturen leses, er tilstanden `unknown` (eller `unavailable` når enheten er nede), med vanlig kvalitet, og resten av kortet viser fortsatt det de andre sensorene sier.

## På skjermen

På Entiteter-skjermen er en værstasjon én flis: temperaturen i stor skrift, og under den en rad for hver måling stasjonen gir, i fast rekkefølge (fuktighet, trykk, vind, vindretning, vindkast, regnrate, regn i dag, sollys, UV-indeks, duggpunkt, varmeindeks, vindkjøling). Temperaturen har den vanlige trendlinjen. Kortet leses på alle språkene grensesnittet har, og settes opp fra høyre mot venstre på arabisk.

## MCP

Agenter leser og bygger en stasjon med verktøyene hver entitet har, og ett som forteller dem hva en stasjon tar:

| Verktøy | Gjør |
|---|---|
| `list_composite_entities` | Leser hva `create_entity` kan lage, hvert domene med rollene sine, hvilke som er påkrevd og hvilke en tjeneste skriver. Vær har ti roller, én påkrevd, og ingen tjenester |
| `create_entity` | Bygger en stasjon fra tagger, som `POST /api/entities`. Den trenger en begrunnelse og MCP-skrivebryteren som alle endringer |
| `get_states` | Leser én: tilstanden er temperaturen, og teksten en modell leser lister alle attributtene ved siden av, `unavailable` inkludert |
| `list_entities` | Finner stasjoner med `domain: weather` |
| `delete_entity` | Fjerner én |

`call_service` på en vær-entitet avvises: den tar ingen tjeneste.

## Hva den ikke gjør

* Den lager ikke værvarsel. Det finnes ikke noe varsel uten å spørre noen andre, og det gjør ikke HotLoop.
* Den logger ikke temperaturen til en stasjon som loggbokrader, slik ingen sensor gjør. Historikken er taggens: trendlinjen på flisen er temperatur-taggens, og alle andre tagger ligger i historian som alle andre.
* Den leser ikke en stasjon for deg. Stasjonen kommer først som tagger: legg til enheten (MQTT, Modbus eller OPC UA), og bind så taggene.
