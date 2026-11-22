---
title: "Archivos de pantalla"
description: "Exporte un panel a un archivo e impórtelo en otra instalación, con cada tag, dispositivo y script listado y una asignación para los nombres que difieren."
---

Una pantalla es del cliente, y viaja como un archivo. Exporte un panel de una instalación, impórtelo en otra, y nada de él vive en el código de HotLoop: ni la maquetación, ni los nombres de los tags, ni el texto. El mismo archivo funciona en HotLoop IoT, Edge y Gateway, porque ejecutan un solo conjunto de paneles ([Paneles](/es/iot/dashboards/)).

Edge Relay no tiene interfaz ni pantallas. El panel de Flow forma parte de sus flujos, que tienen su propio Importar y Exportar. En HotLoop for CODESYS las pantallas son las de Edge.

## Cómo usarlo

En la pantalla Paneles, **Exportar** (junto a Editar, para el panel que está en pantalla) guarda `<id>.hotloop-screen.json`. **Importar** (en la barra junto a Nuevo panel) lee un archivo, le dice qué necesita y qué falta aquí, le deja asignar cada tag, dispositivo, entidad, script o receta que falta a uno que exista, vuelve a comprobar y lo guarda. Importar requiere `dashboards.write`, así que es cosa de un administrador. Exportar requiere `dashboards.read` y el panel tiene que ser uno de los que se le ofrecen.

Por la API, [`GET /api/dashboards/{id}/export`](/es/iot/api/#get-apidashboardsidexport) y [`POST /api/dashboards/import`](/es/iot/api/#post-apidashboardsimport), que es lo que llama la pantalla. Una importación nunca guarda algo que la construcción del mismo panel rechazaría.

## El archivo

JSON en UTF-8, de hasta 4 MiB.

```json
{
  "format": "hotloop-screen",
  "formatVersion": 1,
  "exported": { "product": "edge", "version": "4.22.1", "at": "2026-11-19T16:00:00Z" },
  "screen": {
    "id": "line-2",
    "name": "Line 2",
    "kind": "cards",
    "roles": ["operator", "admin"],
    "homeFor": ["operator"],
    "screens": ["line-2-panel"],
    "position": 1,
    "cards": [
      { "id": "temp", "type": "gauge", "title": "Zone 1", "w": 3, "h": 3, "config": { "tag": "press-01/Zone1_Temp" } }
    ]
  },
  "requires": {
    "tags": [ { "key": "press-01/Zone1_Temp", "dataType": "float", "unit": "C", "writable": false } ],
    "entities": [], "scripts": [], "recipes": [], "devices": [], "equipment": []
  }
}
```

**`format` y `formatVersion`.** `format` es siempre `hotloop-screen`. `formatVersion` es un número entero desde 1. Un HotLoop lee su propia versión y las anteriores, y rechaza una más nueva diciendo qué versión es el archivo y cuál lee. Un campo añadido al archivo es una versión nueva, porque un lector rechaza un campo que no conoce: un campo descartado sin decir nada es peor que un rechazo. Esta es la versión 1.

**`exported`.** Qué producto y versión lo escribió, y cuándo. Para la persona que lee el archivo. No se decide nada a partir de él: los tipos de tarjeta deciden si un HotLoop puede mostrar la pantalla, y un tipo de tarjeta desconocido se rechaza por su nombre.

**`screen`.** El panel tal como lo guarda la API de paneles, sin la contabilidad propia de la instalación (`version`, `updatedBy`, `createdAt`, `updatedAt`). `description` se omite cuando está vacía. Las tarjetas van en orden de lectura, cada una con su tamaño (`w` de 12 columnas, `h` en filas) y su `config`, exactamente como [Paneles](/es/iot/dashboards/#the-cards) describe cada tipo. La maquetación es eso: un flujo de tarjetas, nunca coordenadas en píxeles. Una tarjeta de símbolos coloca sus símbolos por píxel en su propia página, dentro de su config.

**Los recursos van dentro.** Un plano en una tarjeta de mapa y el fondo de una tarjeta de símbolos son URL de datos PNG en base64 dentro del `config` de la tarjeta, así que un solo archivo es la pantalla entera, y enviarlo es enviar también la imagen. Los límites son los del panel: 700 KB por imagen y 2 MiB por pantalla.

**`requires`.** Lo que la pantalla necesita de la instalación donde aterriza, calculado a partir de las tarjetas: cada tag que lee (con el tipo y la unidad que tenía donde se exportó, y si un botón o una consigna escribe en él) y los ids de entidades, scripts, recetas, dispositivos y equipos que nombran las tarjetas. Es para personas y para herramientas que quieran mirar antes de importar. La importación lo vuelve a calcular a partir de las tarjetas y nunca se fía de este bloque. Cuando el tipo de un tag en el archivo difiere del tag en el que aterriza, es una advertencia.

**El tablero mural no se exporta.** Es el conjunto de indicadores fijados de una instalación, no una maquetación. Exportarlo da un `400`, y se rechaza un archivo cuyo `kind` sea `wall`.

**Asignaciones.** `roles`, `homeFor`, `screens` y `position` van en el archivo para que una pantalla vuelva como se fue. También son la parte más ligada a una instalación: el nombre de un panel pertenece a un solo panel en una instalación, y un rol tiene un solo inicio. Una importación las aplica, y lo dice (`assignment`) cuando esta instalación ya da ese nombre de pantalla o el inicio de ese rol a otro panel. **Omitir las asignaciones** deja fuera `screens` y `homeFor` y conserva `roles`.

## Importar

Las comprobaciones se ejecutan en este orden, y no se guarda nada hasta que pasan todas:

1. **El archivo.** JSON, el `format` correcto, una versión que esta compilación lee, ningún campo que no conozca, tipo `cards`.
2. **Sus cambios al archivo.** Un id o nombre nuevo, sin asignaciones, y el **mapa**: `tags` (clave completa a clave completa, tal como el archivo nombra el tag o como se lee una vez movido el dispositivo), `devices` (id a id; también mueve la parte de dispositivo de todo tag que el mapa `tags` no nombre, de modo que pasar una pantalla de un PLC a otro es una sola entrada), `entities`, `scripts`, `recipes` y `equipment` (los ids son números que significan algo solo donde se crearon, así que se asignan uno por uno). El texto de la leyenda de una tendencia se mueve con su tag. Una entrada del mapa que ninguna tarjeta usó es una advertencia, porque una asignación que no hizo nada es como una pantalla acaba apuntando a lo viejo.
3. **Las reglas propias del panel.** Id, nombre, el config de cada tarjeta, tamaños, el límite de bytes, en la forma en que se guarda.
4. **Todo lo que nombran las tarjetas, sin excepción.** Cada tag, entidad, script, receta, dispositivo e id de equipo que falta se enumera, no solo el primero, de modo que una pasada dice qué asignar. Un botón o una consigna sobre un tag que no es escribible es `writable`. Un valor de botón o un límite de consigna fuera del rango del tag y un rol que no existe son `screen`.
5. **El id y las asignaciones.** Un id que está en uso es `exists`, a menos que pidiera **reemplazarlo**, lo que guarda sobre ese panel en la versión que tiene ahora (así que un guardado hecho mientras miraba es un `409`, no una sobrescritura).

Una prueba en seco hace todo esto y no guarda nada. La importación se registra como un evento `config` en el panel: quién, desde qué producto y versión, cuántas tarjetas.

## Mover una pantalla

Exporte en la primera instalación. En la segunda, asegúrese de que existen los dispositivos y tags que lee la pantalla (llevan direcciones que pertenecen a la planta, así que un archivo de pantalla no los lleva). Importe. Si los nombres de los tags difieren, asígnelos en el cuadro de diálogo, o asigne el dispositivo si solo difiere eso. La pantalla se abre en la segunda instalación tal como estaba en la primera.

## Una visualización de CODESYS

La misma importación lee una visualización de CODESYS (la exportación nativa del IDE) y construye la pantalla a partir de ella, diciendo qué dejó fuera: [Importar una pantalla de CODESYS](/es/iot/codesys-screen-import/).

## Lo que no está en la versión 1

Los dispositivos y tags que lee una pantalla (sus direcciones son de la planta, no de la pantalla), el tablero mural, varias pantallas en un archivo y una firma en el archivo. Un archivo es JSON sin más: léalo antes de importar uno que le hayan enviado.
