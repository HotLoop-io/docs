---
title: "Meteo"
description: "Una stazione meteo sul tetto come un'unica entità, con punto di rugiada, indice di calore e temperatura percepita calcolati sulla scatola, senza servizi cloud."
---

Una stazione meteo sul tetto dell'impianto, come un'unica cosa sullo schermo. HotLoop non telefona a nessuno per sapere che piove. Lo dice la stazione: una Ecowitt o una Tempest via MQTT, una Davis o una Vaisala via Modbus, qualsiasi altra via OPC UA. Una lettura di una qualsiasi di queste è già un tag, e un'entità meteo sono i tag di una stazione, ciascuno nel suo ruolo: la temperatura, l'umidità, la pressione, il vento, la pioggia e la luce solare.

Nessun servizio meteo, nessuna chiave API, nessuna internet. Un sito il cui uplink è caduto tre settimane fa mostra comunque la temperatura sul proprio tetto. (Per sapere dov'è il sole, vedi [il sole](/it/iot/sun/); si calcola da latitudine e longitudine del sito e non richiede alcuna stazione.)

## Come crearla

Un'entità meteo si crea come si crea un motore (vedi [Entità](/it/iot/entities/#apparecchiature-composite)): un amministratore indica i tag. Nella schermata Entità, Nuova apparecchiatura, Meteo. Oppure tramite l'API:

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

Solo `temperature` è obbligatorio. Una stazione senza pluviometro non ha `rain_rate` e non mostra la riga della pioggia. Ogni ruolo accetta un tag numerico e nessuno viene scritto: una stazione si legge, non si comanda mai, quindi nessun tag va armato e l'entità non accetta servizi.

| Ruolo | <span class="sr-only">Details</span> | Attributo che genera |
|---|---|---|
| `temperature` | obbligatorio, lo stato | `unit_of_measurement` |
| `humidity` | umidità relativa, in percentuale | `humidity` |
| `pressure` | pressione dell'aria, nell'unità del tag | `pressure` |
| `wind_speed` | vento medio | `wind_speed` |
| `wind_gust` | la raffica recente più forte | `wind_gust` |
| `wind_bearing` | da dove viene il vento, da 0 a 360 gradi | `wind_bearing` |
| `rain_rate` | quanto piove adesso | `rain_rate` |
| `rain_today` | pioggia da mezzanotte | `rain_today` |
| `solar_radiation` | luce solare sul sensore, di solito in W/m² | `solar_radiation` |
| `uv_index` | l'indice UV | `uv_index` |

Ogni attributo porta anche `<name>_unit` con l'unità del suo tag, così una schermata non deve mai indovinare se la pressione è in hPa o in inHg.

## Cosa viene calcolato sulla scatola

Tre valori che una stazione invia di rado, calcolati dalle sue stesse letture:

| Attributo | Da | Come |
|---|---|---|
| `dew_point` | temperatura, umidità | La formula di Magnus (Sonntag 1990), verificata sulle tabelle psicrometriche da 0 a 30 °C |
| `heat_index` | temperatura, umidità | La regressione di Rothfusz del National Weather Service con i suoi due aggiustamenti pubblicati. Esiste solo da 80 °F (26,7 °C) in su, perché è lì che l'NWS smette di usarlo |
| `wind_chill` | temperatura, velocità del vento | L'indice NWS del 2001. Esiste solo a 50 °F (10 °C) o meno con vento oltre 3 mph, l'intervallo su cui è stato tarato |

Tornano nell'unità propria della temperatura, quindi una stazione in gradi Fahrenheit ottiene un punto di rugiada in gradi Fahrenheit. Le unità di temperatura che HotLoop converte sono °C, °F e K, e quelle del vento m/s, km/h, mph, nodi e ft/s, lette dall'unità del tag. Un tag di temperatura senza unità non viene convertito a intuito: il `unit_of_measurement` dell'entità stessa può dire che cos'è, e senza nessuno dei due non si calcola nulla da esso.

Se mancano l'indice di calore e la temperatura percepita non è un guasto. Sotto gli 80 °F non c'è indice di calore, e con aria calma o calda non c'è temperatura percepita, quindi la scheda non ha una riga per loro.

## Una lettura mancante non è zero

Un'entità meteo non è mai ottimista e non riempie mai un vuoto con un numero.

* Un sensore non associato non è una riga.
* Un sensore associato che non si può leggere in questo momento (il suo tag è cattivo, il suo dispositivo è fermo, non è ancora arrivato nulla) viene lasciato fuori dagli attributi e nominato in `unavailable`. La scheda dice **Non disponibile** dove ci sarebbe il suo numero.
* Una lettura che non può essere una misura è trattata allo stesso modo: un'umidità sopra il 105 per cento, una direzione fuori da 0 a 360 gradi, una pioggia o una velocità del vento negative. Un'umidità di 101 o 102, che un sensore legge nella nebbia, viene mostrata come
  100. La piccola lettura negativa di un piranometro di notte viene mostrata come 0.
* Anche un valore calcolato da una lettura non disponibile è non disponibile, e viene nominato: senza umidità non ci sono `dew_point` né `heat_index`.
* Se la temperatura non si può leggere, lo stato è `unknown` (o `unavailable` quando il dispositivo è fermo), con la solita qualità, e il resto della scheda mostra comunque ciò che dicono gli altri sensori.

## Sullo schermo

Nella schermata Entità una stazione meteo è un unico riquadro: la temperatura a caratteri grandi e, sotto, una riga per ogni lettura che la stazione fornisce, in ordine fisso (umidità, pressione, vento, direzione del vento, raffiche, intensità della pioggia, pioggia di oggi, luce solare, indice UV, punto di rugiada, indice di calore, temperatura percepita). La temperatura ha la solita linea di tendenza. La scheda si legge in tutte le lingue dell'interfaccia e si dispone da destra a sinistra in arabo.

## MCP

Gli agenti leggono e creano una stazione con gli strumenti che ha ogni entità, e con uno che dice loro che cosa accetta una stazione:

| Strumento | Cosa fa |
|---|---|
| `list_composite_entities` | Legge ciò che `create_entity` può creare, ogni dominio con i suoi ruoli, quali sono obbligatori e quali scrive un servizio. Meteo ha dieci ruoli, uno obbligatorio, e nessun servizio |
| `create_entity` | Crea una stazione dai tag, come `POST /api/entities`. Servono un motivo e l'interruttore di scrittura MCP come per ogni modifica |
| `get_states` | Ne legge una: lo stato è la temperatura, e il testo che legge un modello elenca accanto tutti gli attributi, `unavailable` compreso |
| `list_entities` | Trova le stazioni con `domain: weather` |
| `delete_entity` | Ne rimuove una |

`call_service` su un'entità meteo viene rifiutato: non accetta servizi.

## Cosa non fa

* Non fa previsioni. Non c'è previsione senza chiedere a qualcun altro, e HotLoop non lo fa.
* Non registra la temperatura di una stazione come righe del registro, come nessun sensore. Lo storico è quello del tag: la linea di tendenza sul riquadro è quella del tag di temperatura, e ogni altro tag è nell'historian come qualsiasi altro.
* Non legge una stazione al posto vostro. La stazione arriva prima come tag: aggiungete il suo dispositivo (MQTT, Modbus o OPC UA), poi associate i tag.
