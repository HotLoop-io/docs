---
title: "Notas de versión: HotLoop Cascade 1.6.0"
description: "Qué trae HotLoop Cascade 1.6.0, qué cambia al actualizar y qué conviene leer antes de tocar una planta en marcha."
sidebar:
  label: "1.6.0"
---

## Qué es esto

1.6.0 es la versión en la que Cascade deja de ser solo un lugar donde se ejecutan workflows y pasa a ser un lugar donde participan personas, modelos y otros servidores. Una ejecución puede detenerse y preguntar a una persona en su teléfono. Una ejecución puede preguntar a un modelo que es tuyo. Tus workflows pueden vivir en Git y una instancia de producción puede negarse a que la editen a mano. Y cualquier API web puede convertirse en pasos desde un archivo. El motor, el formato de archivo y todo lo demás son los de 1.5.1.

## Preguntar a una persona, desde un teléfono

El nuevo paso Pedir aprobación detiene la ejecución y espera. Pon `execution.approvalUrl` en una notificación push, y quien la recibe la toca, lee lo que escribiste, rellena un formulario pequeño si hiciste uno y pulsa Aprobar o Rechazar. La página es sencilla, rápida, no pide iniciar sesión salvo que lo pidas, y habla el idioma del navegador en los catorce. La ejecución sigue por Aprobada o Rechazada con quién respondió, cuándo y qué dijo. Cada respuesta es un registro: en el editor, en la ejecución, en la API en `GET /api/v1/approvals`, en el servidor MCP como `list_approvals` y en el registro de auditoría. Haz que el paso exija una cuenta con sesión iniciada y solo acepta respuestas de las cuentas que indiques. Un enlace funciona una sola vez. Esperar no cuesta nada, así que una respuesta puede llegar una semana después y sobrevivir a cualquier reinicio.

## Preguntar a un modelo

Dos pasos nuevos, IA: preguntar a un modelo e IA: ejecutar un agente. El modelo es tuyo: una credencial apunta a un servidor que ejecutas tú (Ollama, vLLM, llama.cpp) o a un servicio alojado para el que tienes una clave, con el protocolo de OpenAI o el de Anthropic. Nada sale hacia donde la credencial no indique, no hay servicio alojado y cada llamada pasa por la política de salida como cualquier otra. Preguntar a un modelo pone la respuesta en el elemento, como texto o como un objeto JSON que cumple un esquema que das. Ejecutar un agente le da al modelo un objetivo y una lista de herramientas en la que cada herramienta es otro workflow tuyo. El modelo pide una, Cascade la ejecuta, devuelve el resultado, y esto se repite hasta que el modelo responde o se queda sin turnos. Entre turnos la ejecución espera en la base de datos, así que una herramienta lenta no ocupa ningún worker.

## Workflows en Git

Conecta un proyecto a un repositorio, una rama y una carpeta, y haz push o pull. Push escribe un archivo por workflow, con su nombre y su id, y lo confirma como la persona que hizo push con el mensaje que dio. Pull hace que el proyecto coincida con el repositorio: los archivos nuevos se convierten en workflows (desactivados hasta que los actives), los archivos cambiados se convierten en versiones nuevas, los ids se conservan para que un workflow sea el mismo en cada instancia, y un cambio hecho en ambos lados se informa y se deja intacto salvo que digas quién gana. Las eliminaciones solo ocurren cuando las pides. Hay una tarjeta en cada proyecto, seis rutas de la API y seis herramientas MCP. Habla HTTPS con un usuario y un token o contraseña guardados en la bóveda, a través de la política de salida.

## Instancias protegidas

Ponle nombre a una instancia (desarrollo, preproducción, producción) y aparece en una insignia en la parte superior de cada pantalla. Protégela, desde Ajustes o con `HOTLOOP_CASCADE_PROTECTED` (el valor `protected` del chart, que ningún ajuste puede deshacer), y sus workflows no se pueden crear, editar, restaurar ni eliminar a mano en el editor, la API ni MCP. Llegan haciendo pull desde Git. Las credenciales, las variables, las ejecuciones y activar o desactivar un workflow siguen abiertos, porque cambian de un entorno a otro. Una instancia protegida hace pull y no hace push.

## Conectores como archivos

Un conector es un archivo que dice dónde está una API, cómo iniciar sesión y qué recibe y qué devuelve cada llamada. Ponlo en `HOTLOOP_CASCADE_CONNECTORS_DIR` (la carpeta `connectors` del directorio de datos) y cada operación es un paso, con su formulario, un tipo de credencial propio, paginación y reintentos ordenados como ordenan los conectores integrados. El formato está publicado, tiene versión y un JSON Schema (`hotloop-cascade connector schema`). Las herramientas para escribir uno vienen en el binario: `connector init`, `validate`, `call` (probar una operación contra la API real) e `index` e `install` para compartir, donde un índice son archivos estáticos con un hash cada uno. Cascade nunca descarga un índice que no hayas indicado. El servidor MCP ahora tiene 91 herramientas.

## Volver atrás

Esta versión añade tres tablas (aprobaciones y dos para Git) y las migraciones solo van hacia delante, así que volver a 1.5.1 requiere la copia de seguridad que hiciste antes de actualizar, no solo la imagen anterior. Nada de lo existente cambia de forma.
