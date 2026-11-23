---
title: "Meteorología"
description: "Una estación meteorológica de tejado como una sola entidad, con punto de rocío, índice de calor y sensación térmica calculados en la caja, sin nube."
---

Una estación meteorológica en el tejado de la planta, como una sola cosa en pantalla. HotLoop no llama a nadie para saber que llueve. Lo dice la estación: una Ecowitt o una Tempest por MQTT, una Davis o una Vaisala por Modbus, cualquiera por OPC UA. Una lectura de cualquiera de ellas ya es un tag, y una entidad meteorológica son los tags de una estación, cada uno en su función: la temperatura, la humedad, la presión, el viento, la lluvia y la luz solar.

Sin servicio meteorológico, sin clave de API, sin internet. Un sitio cuyo enlace de subida cayó hace tres semanas sigue mostrando la temperatura de su propio tejado. (Para saber dónde está el sol, vea [el sol](/es/iot/sun/); se calcula a partir de la latitud y la longitud del sitio y no necesita ninguna estación.)

## Cómo crearla

Una entidad meteorológica se crea como se crea un motor (vea [Entidades](/es/iot/entities/#equipos-compuestos)): un administrador nombra los tags. En la pantalla Entidades, Nuevo equipo, Meteorología. O por la API:

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

Solo `temperature` es obligatoria. Una estación sin pluviómetro no tiene `rain_rate` y no muestra fila de lluvia. Cada función admite un tag numérico y ninguna se escribe: una estación se lee, nunca se manda, así que no hace falta armar ningún tag y la entidad no admite servicios.

| Función | <span class="sr-only">Detalles</span> | Atributo que genera |
|---|---|---|
| `temperature` | obligatoria, el estado | `unit_of_measurement` |
| `humidity` | humedad relativa, en porcentaje | `humidity` |
| `pressure` | presión del aire, en la unidad del tag | `pressure` |
| `wind_speed` | viento medio | `wind_speed` |
| `wind_gust` | la racha más fuerte reciente | `wind_gust` |
| `wind_bearing` | de dónde viene el viento, de 0 a 360 grados | `wind_bearing` |
| `rain_rate` | con qué intensidad llueve ahora | `rain_rate` |
| `rain_today` | lluvia desde medianoche | `rain_today` |
| `solar_radiation` | luz solar sobre el sensor, normalmente en W/m² | `solar_radiation` |
| `uv_index` | el índice UV | `uv_index` |

Cada atributo lleva además `<name>_unit` con la unidad de su tag, de modo que una pantalla nunca tiene que adivinar si la presión está en hPa o en inHg.

## Lo que se calcula en la caja

Tres valores que una estación rara vez envía, calculados a partir de sus propias lecturas:

| Atributo | De | Cómo |
|---|---|---|
| `dew_point` | temperatura, humedad | La fórmula de Magnus (Sonntag 1990), contrastada con las tablas psicrométricas de 0 a 30 °C |
| `heat_index` | temperatura, humedad | La regresión de Rothfusz del Servicio Meteorológico Nacional con sus dos ajustes publicados. Solo existe a partir de 80 °F (26,7 °C), porque ahí es donde el NWS deja de usarlo |
| `wind_chill` | temperatura, velocidad del viento | El índice de 2001 del NWS. Solo existe a 50 °F (10 °C) o menos con viento de más de 3 mph, el rango al que se ajustó |

Se devuelven en la unidad propia de la temperatura, así que una estación en grados Fahrenheit obtiene un punto de rocío en grados Fahrenheit. Las unidades de temperatura que HotLoop convierte son °C, °F y K, y las de viento m/s, km/h, mph, nudos y ft/s, leídas de la unidad del tag. Un tag de temperatura sin unidad no se convierte adivinando: el `unit_of_measurement` de la propia entidad puede decir cuál es, y sin ninguno de los dos no se calcula nada a partir de él.

Que falten el índice de calor y la sensación térmica por viento no es un fallo. Por debajo de 80 °F no hay índice de calor, y con aire en calma o cálido no hay sensación térmica por viento, así que la tarjeta no tiene fila para ellos.

## Una lectura que falta no es cero

Una entidad meteorológica nunca es optimista y nunca rellena un hueco con un número.

* Un sensor que no está enlazado no es una fila.
* Un sensor que está enlazado y no se puede leer ahora mismo (su tag es mala, su dispositivo está caído, aún no ha llegado nada) se deja fuera de los atributos y se nombra en `unavailable`. La tarjeta dice **No disponible** donde iría su número.
* Una lectura que no puede ser una medida se trata igual: una humedad por encima del 105 por ciento, un rumbo fuera de 0 a 360 grados, una lluvia o una velocidad de viento negativas. Una humedad de 101 o 102, que lee un sensor en la niebla, se muestra como
  100. La pequeña lectura negativa de un piranómetro por la noche se muestra como 0.
* Un valor calculado a partir de una lectura no disponible también está no disponible, y se nombra: sin humedad no hay `dew_point` ni `heat_index`.
* Si no se puede leer la temperatura, el estado es `unknown` (o `unavailable` cuando el dispositivo está caído), con la calidad habitual, y el resto de la tarjeta sigue mostrando lo que dicen los demás sensores.

## En pantalla

En la pantalla Entidades una estación meteorológica es un solo mosaico: la temperatura en letra grande y, debajo, una fila por cada lectura que da la estación, en un orden fijo (humedad, presión, viento, dirección del viento, rachas, intensidad de lluvia, lluvia de hoy, luz solar, índice UV, punto de rocío, índice de calor, sensación térmica por viento). La temperatura tiene la línea de tendencia habitual. La tarjeta se lee en todos los idiomas de la interfaz y se maqueta de derecha a izquierda en árabe.

## MCP

Los agentes leen y crean una estación con las herramientas que tiene toda entidad, y con una que les dice qué admite una estación:

| Herramienta | Qué hace |
|---|---|
| `list_composite_entities` | Lee lo que `create_entity` puede crear, cada dominio con sus funciones, cuáles son obligatorias y cuáles escribe un servicio. Meteorología tiene diez funciones, una obligatoria, y ningún servicio |
| `create_entity` | Crea una estación a partir de tags, como `POST /api/entities`. Necesita un motivo y el interruptor de escritura de MCP como todo cambio |
| `get_states` | Lee una: el estado es la temperatura, y el texto que lee un modelo enumera todos los atributos junto a ella, `unavailable` incluido |
| `list_entities` | Busca estaciones con `domain: weather` |
| `delete_entity` | Elimina una |

`call_service` sobre una entidad meteorológica se rechaza: no admite servicios.

## Lo que no hace

* No pronostica. No hay pronóstico sin preguntarle a otro, y HotLoop no lo hace.
* No registra la temperatura de una estación como filas del registro, igual que ningún sensor. El historial es el del tag: la línea de tendencia del mosaico es la del tag de temperatura, y cada uno de los demás tags está en el historian como cualquier otro.
* No lee una estación por usted. La estación llega primero como tags: añada su dispositivo (MQTT, Modbus u OPC UA) y luego enlace los tags.
