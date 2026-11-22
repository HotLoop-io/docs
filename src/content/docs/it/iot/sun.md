---
title: "Il sole"
description: "Alba, tramonto, crepuscolo e posizione del sole calcolati sulla scatola da latitudine e longitudine, senza servizio meteo e senza internet."
---

Dite a HotLoop dove si trova l'impianto e saprà dov'è il sole. Alba, tramonto, crepuscolo, mezzogiorno solare, l'altezza del sole e la sua direzione, tutto calcolato sulla scatola da una latitudine e una longitudine. Nessun servizio meteo, nessuna chiave API, nessuna internet. Un sito il cui uplink è caduto tre settimane fa accende comunque le luci del piazzale al tramonto, ed è l'unico motivo per cui questa non è una chiamata al cloud di qualcun altro.

## Impostazione

Due variabili, in gradi decimali, con nord ed est positivi:

| Variabile | Esempio | <span class="sr-only">Details</span> |
|---|---|---|
| `HOTLOOP_SITE_LATITUDE` | `41.4993` | nord positivo |
| `HOTLOOP_SITE_LONGITUDE` | `-81.6944` | est positivo, quindi tutte le Americhe sono negative |

Nel chart sono `plant.latitude` e `plant.longitude`. Tutte e due o nessuna. Mezza posizione, un numero fuori dal pianeta o `41°29'58"N` fermano HotLoop all'avvio nominando la variabile, perché un'alba calcolata da un errore di battitura sbaglia di ore e sullo schermo sembra del tutto ragionevole. Prendete i numeri da una mappa qualsiasi: clic destro, copia le coordinate.

Se le omettete, non ci sono entità del sole e una regola con un trigger solare non viene armata (il registro di sistema dice quali due variabili impostare). La schermata Impostazioni mostra entrambe, in sola lettura. Un'alba è qualcosa su cui scattano le regole, quindi cambia con un deploy rivisto.

## Le entità

| Entità | Stato | <span class="sr-only">Details</span> |
|---|---|---|
| `binary_sensor.sun_up` | `on` dall'alba al tramonto | attributi `next_dawn`, `next_sunrise`, `next_noon`, `next_sunset`, `next_dusk`, nel fuso orario del sito |
| `sensor.sun_elevation` | gradi sopra l'orizzonte, negativo sotto | gradi interi |
| `sensor.sun_azimuth` | gradi in senso orario dal nord vero, 90 è l'est | gradi interi |

Sono di piattaforma `sun`, si leggono e non accettano servizi. `sun_up` è calcolato esattamente, quindi cambia nello stesso secondo in cui scattano i trigger di alba e tramonto, non in base all'elevazione arrotondata.

Elevazione e azimut sono in gradi interi di proposito. Il sole si muove di circa un quarto di grado al minuto. A un decimo di grado sarebbe un nuovo stato, una riga di registro e un punto di storico ogni 24 secondi, tutto il giorno, ogni giorno, per ogni sensore, per una precisione su cui nessuno automatizza. Una regola che vuole «il sole è sopra i 10 gradi» la ottiene al grado.

Sotto il sole di mezzanotte o nella notte polare, il prossimo tramonto o la prossima alba possono essere a settimane di distanza, e l'attributo dice quando. Se non ce n'è uno entro un anno, riporta `none within a year` invece di essere omesso in silenzio.

## Trigger

```json
{"type": "sun", "event": "sunset", "offsetSec": -1800}
```

`dawn`, `sunrise`, `noon`, `sunset` o `dusk`, spostati di `offsetSec` (negativo è prima, al massimo sei ore per parte). Vedi [Automazioni](/it/iot/automations/#sun-triggers). `binary_sensor.sun_up` funziona anche con un normale trigger `state`, e con `states['binary_sensor.sun_up'] == 'off'` in una condizione, per «solo dopo il buio».

## Cosa significano i numeri

- **Alba e tramonto** sono il momento in cui il bordo superiore del sole è sull'orizzonte, con la correzione standard per la luce piegata dall'aria: il centro a 0,833 gradi sotto l'orizzonte. È ciò che ogni almanacco e ogni telefono intende per alba.
- **Alba civile e crepuscolo** sono il crepuscolo civile, con il centro 6 gradi sotto. È la linea attorno a cui si scrive l'illuminazione esterna: dopo il crepuscolo civile servono luci per lavorare all'aperto.
- **Il mezzogiorno solare** è quando il sole è esattamente a sud (a nord, a sud dell'equatore) e più alto. Raramente sono le 12:00 dell'orologio; sul bordo occidentale di un fuso orario in estate è ben dopo l'una.
- **L'elevazione** è dove appare il sole, corretta per la rifrazione. L'azimut è misurato dal nord vero, non da quello magnetico.

L'avvertenza dell'orizzonte piatto: questi valori valgono per un orizzonte a livello del mare. Un impianto in una valle perde il sole dietro la cresta prima del tramonto, e HotLoop non conosce la cresta. Mettete uno scostamento sul trigger.

## Come sappiamo che è giusto

La matematica è quella della NOAA: le equazioni dietro il calcolatore solare del Global Monitoring Laboratory (gml.noaa.gov/grad/solcalc), che sono quelle di *Astronomical Algorithms* di Jean Meeus. Portate così come sono, stranezza compresa (il mezzogiorno solare della NOAA legge l'equazione del tempo intorno a mezzanotte UT invece che a mezzogiorno, questione di secondi, e resta così per coincidere con la NOAA al secondo).

Il test legge tutte le 4.380 celle di alba e tramonto e tiene ogni passaggio al minuto stampato dalla NOAA, più due secondi, e ciascuno dei 2.190 mezzogiorni entro un secondo. Circa il 97 per cento si arrotonda esattamente allo stesso minuto; il resto è a un secondo circa dal punto di mezzo minuto che decide l'arrotondamento, cioè due calcolatori in disaccordo sull'ultima cifra, non sul sole. Ogni giorno in cui la NOAA dice che non c'è alba o non c'è tramonto, HotLoop dice lo stesso.

La NOAA non pubblica una tabella del crepuscolo, quindi alba civile e crepuscolo sono verificati sulla loro definizione: nel momento in cui HotLoop dice che è il crepuscolo, la stessa matematica di posizione mette il centro del sole 6 gradi sotto, a un cinquantesimo di grado.

La NOAA dice che il suo metodo è buono entro circa un minuto tra i circoli polari e peggiora verso i poli, dove il sole sfiora l'orizzonte e un minimo errore sulla sua altezza vale minuti sull'orologio. Utqiagvik supera la stessa soglia di ogni altro posto. Ai poli stessi il metodo giorno per giorno può mancare l'unica alba dell'anno; se gestite un impianto al Polo Sud, mettete un programma orario.
