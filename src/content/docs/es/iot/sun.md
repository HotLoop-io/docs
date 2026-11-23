---
title: "El sol"
description: "Amanecer, atardecer, alba, crepúsculo y posición del sol calculados en la caja con latitud y longitud, sin servicio meteorológico ni internet."
---

Dígale a HotLoop dónde está la planta y sabrá dónde está el sol. Amanecer, atardecer, alba, crepúsculo, mediodía solar, la altura del sol y su rumbo, todo calculado en la propia caja a partir de una latitud y una longitud. Sin servicio meteorológico, sin clave de API, sin internet. Un sitio cuyo enlace de subida cayó hace tres semanas sigue encendiendo las luces del patio al anochecer, y esa es toda la razón por la que esto no es una llamada a la nube de otro.

## Configuración

Dos variables, en grados decimales, con el norte y el este positivos:

| Variable | Ejemplo | <span class="sr-only">Detalles</span> |
|---|---|---|
| `HOTLOOP_SITE_LATITUDE` | `41.4993` | norte positivo |
| `HOTLOOP_SITE_LONGITUDE` | `-81.6944` | este positivo, así que todo el continente americano es negativo |

En el chart son `plant.latitude` y `plant.longitude`. Las dos o ninguna. Media ubicación, un número fuera del planeta o `41°29'58"N` detienen HotLoop al arrancar y nombran la variable, porque un amanecer calculado a partir de un error de tecleo se equivoca por horas y en pantalla parece perfectamente razonable. Saque los números de cualquier mapa: clic derecho, copiar las coordenadas.

Si las omite, no hay entidades del sol, y una regla con disparador solar no queda armada (el registro del sistema dice qué dos variables definir). La pantalla Ajustes muestra ambas, en solo lectura. Un amanecer es algo en lo que se disparan las reglas, así que cambia con un despliegue revisado.

## Las entidades

| Entidad | Estado | <span class="sr-only">Detalles</span> |
|---|---|---|
| `binary_sensor.sun_up` | `on` desde el amanecer hasta el atardecer | atributos `next_dawn`, `next_sunrise`, `next_noon`, `next_sunset`, `next_dusk`, en la zona horaria del sitio |
| `sensor.sun_elevation` | grados sobre el horizonte, negativo por debajo | grados enteros |
| `sensor.sun_azimuth` | grados en sentido horario desde el norte verdadero, 90 es el este | grados enteros |

Son de la plataforma `sun`, se leen y no admiten servicios. `sun_up` se calcula con exactitud, así que cambia en el mismo segundo en que se disparan los disparadores de amanecer y atardecer, y no según la elevación redondeada.

La elevación y el acimut van en grados enteros a propósito. El sol se mueve un cuarto de grado por minuto. Con una décima de grado eso sería un estado nuevo, una fila en el registro y un punto de historial cada 24 segundos, todo el día, todos los días, por cada sensor, para una precisión sobre la que nadie automatiza. Una regla que quiere «el sol está a más de 10 grados» la obtiene al grado.

Bajo el sol de medianoche o en la noche polar, el próximo atardecer o amanecer puede estar a semanas, y el atributo dice cuándo. Si no hay ninguno dentro de un año, dice `none within a year` en lugar de omitirse en silencio.

## Disparadores

```json
{"type": "sun", "event": "sunset", "offsetSec": -1800}
```

`dawn`, `sunrise`, `noon`, `sunset` o `dusk`, desplazados por `offsetSec` (negativo es antes, como máximo seis horas hacia cada lado). Vea [Automatizaciones](/es/iot/automations/#disparadores-solares). `binary_sensor.sun_up` funciona también con un disparador `state` normal, y con `states['binary_sensor.sun_up'] == 'off'` en una condición, para «solo después de oscurecer».

## Qué significan los números

- **Amanecer y atardecer** son el momento en que el borde superior del sol está en el horizonte, con la corrección habitual por la curvatura de la luz en el aire: el centro a 0,833 grados bajo el horizonte. Eso es lo que significa amanecer en todos los almanaques y en todos los teléfonos.
- **Alba y crepúsculo** son el crepúsculo civil, con el centro 6 grados por debajo. Es la línea en torno a la cual se escribe la iluminación exterior: después del crepúsculo civil hacen falta luces para trabajar fuera.
- **El mediodía solar** es cuando el sol está justo al sur (justo al norte, al sur del ecuador) y en su punto más alto. Rara vez son las 12:00 del reloj; en el borde occidental de una zona horaria, en verano, es bastante después de la una.
- **La elevación** es dónde se ve el sol, corregida por la refracción. El acimut se mide desde el norte verdadero, no el magnético.

La salvedad del horizonte plano: estos valores son para un horizonte a nivel del mar. Una planta en un valle pierde el sol tras la cresta antes del atardecer, y HotLoop no conoce la cresta. Ponga un desplazamiento en el disparador.

## Cómo sabemos que es correcto

Las matemáticas son las de NOAA: las ecuaciones detrás de la calculadora solar del Global Monitoring Laboratory (gml.noaa.gov/grad/solcalc), que son las de *Astronomical Algorithms* de Jean Meeus. Portadas tal cual, con la rareza incluida (el mediodía solar de NOAA lee la ecuación del tiempo hacia la medianoche UT y no al mediodía, cuestión de segundos, y se mantiene así para coincidir con NOAA al segundo).

La prueba lee las 4.380 celdas de amanecer y atardecer y mantiene cada cruce dentro del minuto que NOAA publicó, más dos segundos, y cada uno de los 2.190 mediodías a menos de un segundo. Alrededor del 97 por ciento se redondea exactamente al mismo minuto; el resto está a un segundo o así de la media hora, que son dos calculadoras discrepando en el último dígito, no sobre el sol. Todos los días en que NOAA dice que no hay amanecer o no hay atardecer, HotLoop dice lo mismo.

NOAA no publica una tabla de crepúsculos, así que el alba y el crepúsculo se comprueban contra su definición: en el momento en que HotLoop dice que es el crepúsculo, la misma matemática de posición pone el centro del sol 6 grados por debajo, con una precisión de una quincuagésima de grado.

NOAA dice que su método es bueno hasta un minuto entre los círculos polares y empeora hacia los polos, donde el sol roza el horizonte y un error diminuto en su altura son minutos en el reloj. Utqiagvik pasa la misma vara que cualquier otro sitio. En los propios polos, el método día a día puede perderse el único amanecer del año; si dirige una planta en el Polo Sur, ponga un horario.
