---
title: "Energía"
description: "Medidores en tramos de 15 minutos, una tarifa que pone precio a cada tramo al crearse, un cargo por demanda, turnos y el coste de cada unidad fabricada."
---

Lo que consume la planta y lo que cuesta: kilovatios hora, gas, agua, aire comprimido y el coste de cada unidad fabricada, en una sola pantalla, pensada para una planta de producción. Sin hardware nuevo y sin protocolo nuevo. Un medidor es un tag que HotLoop ya lee, y esto es la contabilidad que se monta encima: lo que contó el tag, guardado en la base de datos y con precio.

## Un medidor

Un medidor lee un tag como una cantidad consumida. Tiene uno de dos modos.

| Modo | El tag es | Lo consumido es |
|---|---|---|
| `counter` | una cuenta acumulada: un registro de kWh, un totalizador de gas, los pulsos de un contador de agua | cuánto avanzó, multiplicado por el `factor` del medidor |
| `power` | un caudal de energía: los kW que se consumen ahora, en `W`, `kW` o `MW` | la media de dos lecturas durante el tiempo que hay entre ellas |

`factor` es lo que vale un paso del contador en la unidad del medidor: `0.001` convierte un registro en Wh a kWh, `0.01` significa que un pulso es una centésima de metro cúbico. Si se omite es 1. Un medidor de potencia no lleva factor: su `power_unit` y su `unit` (`Wh`, `kWh` o `MWh`) dicen cómo convertir.

| Tipo | Para | Unidad habitual |
|---|---|---|
| `electricity` | kWh | kWh |
| `gas` | gas | m³ |
| `water` | agua | m³ |
| `air` | aire comprimido | m³ |
| `heat` | vapor, agua caliente, calor | kWh |
| `production` | unidades fabricadas | unidades |

Un medidor `production` cuenta lo que fabricó la línea. No tiene tarifa, y es por lo que se divide el coste de una unidad.

Cree uno en la pantalla Energía (Nuevo medidor) o con `POST /api/energy/meters` (consulte [la API HTTP](/es/iot/api/#energía)). Solo un administrador crea, cambia o quita un medidor (`energy.write`); todos leen (`energy.read`). El tag debe existir y ser un número. Si el tag se borra después, el medidor dice que está esperando, y recoge el tag de nuevo cuando se vuelve a crear.

## Cómo cuenta

Cada diez segundos el motor lee el tag de cada medidor desde la misma caché que lee toda pantalla, y calcula lo que añade cada lectura nueva. Lo que añade va a tramos de 15 minutos, en la base de datos, en la misma transacción que la última lectura del medidor. Así un reinicio no pierde nada y no cuenta nada dos veces.

* **Un contador** suma lo que avanzó desde la última lectura, repartido en el tiempo entre las dos lecturas en proporción al tiempo de cada tramo.
* **Un contador que retrocede** se reinició o se sustituyó. Nada dice cuánto se consumió, así que no se suma nada: el valor nuevo es el nuevo punto de partida, y el medidor cuenta el reinicio (`status.resets`).
* **Un contador que siguió contando mientras HotLoop estaba apagado.** El avance es real y se conserva entero, repartido uniformemente por el intervalo, y cada tramo que toca se marca como **estimado**. Un intervalo son más de diez minutos entre dos lecturas.
* **Una potencia** es la media de dos lecturas durante el tiempo entre ellas. Para un intervalo de más de diez minutos no hay nada: el medidor no inventa una potencia para un tiempo que nadie leyó, y el intervalo se cuenta (`status.gap_seconds`). Cada tramo dice cuántos de sus 900 segundos tienen lectura (`covered_seconds`), y la pantalla dice «Leído durante el 63 % del periodo» cuando un medidor de potencia no se leyó durante parte de él. Una lectura de potencia que no consumió nada sigue cubriendo su tiempo.
* **Una lectura mala** (la calidad del tag no es buena) no suma nada, y el medidor lo dice en su ficha con el motivo. Un contador que no se leyó y vuelve cuenta lo que avanzó entretanto, como un intervalo.
* **Una lectura que no se pudo guardar** se vuelve a calcular en el siguiente ciclo desde el mismo punto de partida.

## Lo que cuesta

Una tarifa pone precio a cada tramo al crearse: un `price` fijo por unidad y, opcionalmente, `bands` para una tarifa por franjas horarias. Una franja es `from` y `to` en un cuarto de hora del reloj del propio sitio (un `to` anterior al `from` pasa de medianoche), los `days` en que rige (`mon` a `sun`, todos los días si se omite) y un `price`. Gana la primera franja que rige en ese momento; fuera de todas las franjas rige el precio fijo. Un tramo se valora en el punto medio del tiempo que cubre cada lectura.

Como el coste se guarda con el tramo, **un precio cambiado después no cambia lo que costó el mes pasado.** Cambiar la tarifa de un medidor cambia lo que cuenta a partir de entonces.

`currency` es un código o un símbolo. Los costes en dos monedas nunca se suman: el resumen tiene un coste para cada una.

### Un cargo por demanda

Un medidor de electricidad en `Wh`, `kWh` o `MWh` puede tener un `demand_price` en su tarifa: lo que cuesta un kilovatio del cuarto de hora más alto de la planta. En una ventana, la demanda de un tramo son los kilovatios que promedió (un cuarto de hora que consumió 25 kWh promedió 100 kW) y su cargo es eso por el precio de demanda que tenía el medidor cuando se creó el tramo. El cargo de la ventana es el más alto de ellos, que para un solo precio es el pico por el precio. El resumen da a cada uno de esos medidores un `demand` con el pico en kW, cuándo empezó y el cargo, y mete el cargo en el coste de la ventana y en el coste de una unidad fabricada. El `cost` del propio medidor sigue siendo lo que costó la energía.

Igual que el precio de la energía, el precio de la demanda se guarda con cada tramo cuando se crea (migración 0030), así que **cambiar un precio de demanda cambia lo que se cuenta a partir de entonces y nunca el mes ya cerrado.** Los tramos creados antes de que el medidor tuviera un precio de demanda no llevan ninguno: muestran un pico y ningún cargo.

Una compañía eléctrica factura la demanda por su mes de facturación, así que pida `this_month` o `last_month` para ver la línea de la factura; una ventana más corta da el cargo del cuarto de hora más alto que hay dentro de ella. Si el cuarto de hora pico no se leyó entero (`peak_covered_seconds` por debajo de 900), el pico está subestimado, y la pantalla lo dice. Los sensores `Today` de abajo cuentan solo energía: un cargo por demanda es una línea de la factura del mes, no algo que se devengue durante todo el día.

## El coste de una unidad fabricada

El coste en una ventana de los medidores con precio que usted elija, dividido por lo que contó un medidor de producción en la misma ventana. El resumen da uno por cada medidor de producción y moneda. Cuando no se fabricó nada, el coste por unidad es `null` con el `reason` `nothing_made`, y la pantalla dice «No se fabricó nada»: eso es no tener respuesta, no cero ni una división por cero. Lo mismo cuando se fabricó algo y ningún medidor con precio ha contado todavía ningún consumo (`nothing_counted`, «Aún no se ha contado energía»): los medidores se leen uno tras otro, así que un registro que aún no se ha movido no es un producto gratis. Un medidor que contó algo a un precio de cero sigue contando, y da un coste de cero.

`GET /api/energy/summary?period=today&meters=line2-electricity,line2-air&per=line2-parts` lo calcula para una línea: `meters` nombra los medidores cuyo coste entra, `per` el medidor de producción. Sin ellos, son todos los medidores con precio entre todos los medidores de producción.

## Ventanas

`period` es `today`, `yesterday`, `this_week` (las semanas empiezan en lunes), `last_week`, `this_month`, `last_month`, `last_7_days` o `last_30_days`, un turno, o indique `from` y `to` en RFC 3339 (400 días como máximo). Los días, las semanas y los meses son los **del sitio**, en su propia zona horaria (`HOTLOOP_TIMEZONE`): la medianoche es la medianoche de la planta, y el día de 23 o 25 horas es el día real. Un turno se escribe `shift:06:00-14:00`, de y a en un cuarto de hora del reloj del sitio, y un `to` que no es posterior al `from` pasa de medianoche (`shift:22:00-06:00`). `shift:` es el último que ha empezado, que es el que está en curso cuando hay uno, y `last_shift:` es el anterior. Un turno se construye a partir del día natural, así que la noche del cambio de hora dura lo que duró de verdad. La pantalla tiene un cuadro Turno junto a los periodos, y los mismos nombres van en el periodo de las herramientas MCP. Las series se cortan en pasos de `quarter` (8 días como máximo), `hour`, `day` o `month`.

## En la pantalla

La pantalla Energía (grupo Planta) tiene un selector de periodo, el coste del periodo, el coste por unidad fabricada de cada medidor de producción y una ficha por cada medidor: lo que consumió, lo que costó, una barra por cada hora (o día) y, cuando procede, si se está leyendo, si parte de él es estimada y durante cuánto del periodo se leyó un medidor de potencia. Una barra con contorno discontinuo es estimada. Un medidor que no se puede leer dice por qué. Cada palabra está en los 14 idiomas.

## Entidades

Cada medidor da sensores que puede usar cualquier pantalla y regla:

| Entidad | Estado |
|---|---|
| `sensor.<meter>_today` | lo que consumió el medidor desde la medianoche del sitio, en su unidad |
| `sensor.<meter>_cost_today` | lo que costó (un medidor con precio) |
| `sensor.<production meter>_cost_per_unit_today` | el coste de hoy entre las unidades fabricadas hoy. `unknown` hasta que se fabrica algo, y cuando los medidores tienen precio en dos monedas |

Son de la plataforma `energy`, leen, y no admiten ningún servicio. Un medidor que dejó de responder sigue siendo lo que consumió hasta entonces, con calidad `uncertain` y `meter_status` diciendo por qué.

## MCP

Los agentes leen y gestionan medidores por las mismas rutas:

| Herramienta | Hace |
|---|---|
| `list_energy_meters`, `get_energy_meter` | los medidores, cómo se lee cada uno, y el consumo y el coste de hoy |
| `get_energy_summary` | lo que consumió y costó cada medidor en un periodo con nombre, el coste en cada moneda y el coste de una unidad fabricada |
| `get_energy_series` | el consumo de un medidor en un periodo con nombre, por pasos |
| `create_energy_meter`, `update_energy_meter`, `delete_energy_meter` | crear, cambiar y quitar un medidor. Cada uno necesita un motivo y se audita |

Los filtros `meters` y `per` del coste por unidad son parámetros de consulta REST.

## Copia de seguridad y actualizaciones

Lo guardan tres tablas (migración 0029): `energy_meters`, `energy_meter_state` y `energy_buckets`, todas en la copia de seguridad. La migración 0030 añade el precio de demanda a los medidores y a cada tramo. Las migraciones solo añaden. Un tramo ocupa unos 100 bytes, así que un medidor son unos 3,5 MB al año.

## Lo que no hace

* **No conoce sus turnos.** Un turno se nombra en la petición, como `shift:06:00-14:00`; no hay una lista de los turnos de la planta donde elegir, y se rechaza un turno que no cae en un cuarto de hora porque los tramos son de cuarto de hora.
* **No le factura la demanda.** El cargo es el cuarto de hora más alto de la ventana por el precio; los escalonamientos, las demandas mínimas y los cargos por factor de potencia de una compañía eléctrica no están incluidos.
* **No lee un medidor por usted.** Primero llega el tag: añada el dispositivo (Modbus, MQTT, OPC UA o Emberburn para uno simulado) y después cree el medidor.
