---
title: "Profilen"
description: "Den ene inndataen til HotLoop for CODESYS: en JSON-fil med en revisjon, enheten og variablene, alarmene og ett skjermbilde, og hvordan klargjøreren bruker den."
sidebar:
  label: "Profilen"
---

En profil er én JSON-fil i en Secret i installasjonens namespace, under nøkkelen `profile.json`. Den ligger ikke i chartet eller i klargjørerens image, så begge er generiske og offentlige, og ingenting i noen av dem nevner noens variabler. Den som installerer appen, leverer den. På EmberNet skriver Store den som `<release>-profile`.

Klargjøreren leser den på nytt ved hver runde, slik at en nyere profil når en installasjon som kjører, uten omstart.

## Formen

| Nøkkel | Hva den inneholder |
|---|---|
| `revision` | Et heltall fra 1. Skjermbildet og alarmene erstattes bare når det er høyere enn revisjonen som laget dem. |
| `device` | `id`, `name`, `options` (koblingens alternativer, som `browseRoot`, `arrayElements` og `browseMaxNodes`) og `points`, variabelnavnene HotLoop beholder fra PLS-en. |
| `alarms` | HotLoop-alarmdefinisjoner, hver med en `id`. |
| `dashboard` | Ett HotLoop-skjermbilde, med en `id`. Et [dashbord](/nb/iot/dashboards/) er en liste med kort. |

En profil lager ett skjermbilde. Den lager én enhet fra `device`, eller flere fra `devices`, som beskrives neste. 

## En liste med enheter

En profil kan ha `devices` ved siden av `device` eller i stedet for den. Hver oppføring er kroppen til HotLoops `POST /api/devices` (`id`, `name`, `protocol`, `address`, `enabled`, `pollIntervalMs`, `timeoutMs` og `config`, protokollens egen blokk) med sine `tags`, beskrivelsene HotLoop importerer for enheten: `name`, `address`, `dataType` og eventuelt `unit`, `description` og `deviceClass`. Det dekker en OPC UA PubSub (UADP)-lytter med sine RawData-`dataSets`, en OPC UA-klient og flere enheter i én profil. Ved hver runde:

- en enhet HotLoop mangler, lages, og en den har, blir latt være, slik at en persons endring blir stående til profilens `revision` er høyere enn den som lagde enheten;
- hver tag i profilen som enheten mangler, importeres, skrivebeskyttet;
- ingenting av dette venter på nodens OPC UA-server, så en lytter bare lytter, og en kjøretid som er nede eller starter på nytt, holder ikke noe annet tilbake (den enkelte `device` leser fortsatt kjøretiden, og en runde med den nede sier det og prøver igjen);
- uten `devices` virker profilen akkurat som før, og med begge til stede gjelder begge.

Hva det betyr for deg: en PubSub-lytter, som en matet av [HotLoop Transmitter](/nb/transmitter/overview/), kommer tilbake konfigurert av seg selv uten PLS å lese fra.

## Et eksempel

Dette er profilen bak skjermbildene på [oversikten](/nb/codesys/overview/), mot HotLoops demoprogram. `GVL_Demo` er demoprogrammets variabelliste, og etikettene er diktet opp.

```json
{
  "revision": 2,
  "device": {
    "id": "line-2",
    "name": "Line 2 PLC",
    "options": {"browseRoot": "Application.GVL_Demo", "arrayElements": 4, "browseMaxNodes": 500},
    "points": ["GVL_Demo.bRun", "GVL_Demo.rTemp", "GVL_Demo.udiCycles", "GVL_Demo.nEcho", "GVL_Demo.rEcho", "GVL_Demo.rReadOnly"]
  },
  "alarms": [
    {"id": "line-2-mixer-hot", "name": "Mixer temperature high", "tagName": "GVL_Demo.rTemp", "condition": "hi", "limit": 20, "deadband": 0.5, "priority": 2, "message": "{device}/{tag} at {value}, limit {limit}"}
  ],
  "dashboard": {
    "id": "line-2-screen", "name": "Line 2", "description": "The Line 2 screen.", "kind": "cards", "roles": [], "homeFor": [], "screens": [],
    "cards": [
      {"id": "t", "type": "value", "title": "Mixer temperature", "w": 3, "h": 2, "config": {"tag": "line-2/GVL_Demo.rTemp", "decimals": 1}},
      {"id": "tr", "type": "trend", "title": "Mixer temperature, last 15 minutes", "w": 6, "h": 3, "config": {"tags": ["line-2/GVL_Demo.rTemp"], "minutes": 15}},
      {"id": "al", "type": "alarms", "title": "Line 2 alarms", "w": 6, "h": 3, "config": {"outstanding": true, "limit": 8}}
    ]
  }
}
```

Et korts `tag` er enhets-id-en, en skråstrek og punktets navn. Korttypene, alarmbetingelsene og resten av et skjermbildes nøkler er de samme som i HotLoops [dashbord](/nb/iot/dashboards/) og [HTTP-API-et](/nb/iot/api/).

## Hva klargjøreren gjør med den

- **Den lager enheten** hvis det ikke finnes en, og legger til hver variabel i `points` som PLS-en har og enheten ikke har.
- **Den skriver aldri til PLS-en.** Hver tag den lager, er skrivebeskyttet, og en profil har ingen måte å merke en som skrivbar.
- **Den lager alarmene og skjermbildet** når de mangler, og erstatter dem bare når `revision` er høyere enn den som lagde dem. En endring en person har gjort i skjermbildet i HotLoop, overlever derfor til en nyere profil blir sluppet med vilje.
- **Den fortsetter å se etter.** Hvert femte minutt, og tidligere etter en runde som ikke kunne bli ferdig, fordi kjøretiden eller HotLoop ikke svarte ennå.
