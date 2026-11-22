---
title: "API de HotLoop Transmitter"
description: "Todas las entradas, salidas y métodos del bloque de función publicador de HotLoop Transmitter."
---

Todo está en el espacio de nombres `HLTX`. El bloque es `HLTX.FB_HLTX_Publisher`.

## Entradas

| Entrada | Tipo | Por defecto | Significado |
|---|---|---|---|
| `bEnable` | BOOL | FALSE | TRUE abre el socket y empieza a publicar. FALSE lo cierra y devuelve el bloque a `Disabled`, lo que también borra un `ConfigError` |
| `sDestination` | STRING(15) | `127.0.0.1` | dirección IPv4 con puntos: un host unicast, o un grupo multicast de 224.0.0.0 a 239.255.255.255 |
| `uiPort` | UINT | 4840 | puerto UDP de destino. 4840 es el que registra OPC UA |
| `sLocalAddress` | STRING(15) | vacío | solo multicast: la dirección de la interfaz desde la que enviar. Vacío deja que elija el sistema operativo |
| `usiMulticastTTL` | USINT | 1 | tiempo de vida multicast |
| `uiPublisherId` | UINT | 1 | PublisherId, enviado como UInt16 |
| `uiWriterGroupId` | UINT | 1 | WriterGroupId |
| `uiDataSetWriterId` | UINT | 1 | DataSetWriterId |
| `tPublishingInterval` | TIME | T#100MS | tiempo entre mensajes. Mínimo T#1MS. El bloque solo puede enviar en un ciclo, así que la tasa real es el intervalo redondeado hacia arriba a un número entero de ciclos de la tarea que lo llama |
| `eEncoding` | `E_HLTX_Encoding` | `Variant` | `Variant` o `RawData`. Cámbielo con el bloque deshabilitado |
| `udiGroupVersion` | UDINT | 1 | GroupVersion en la cabecera de grupo |
| `udiConfigMajor`, `udiConfigMinor` | UDINT | 1, 0 | ConfigurationVersion del DataSet. Incremente el major siempre que cambie la lista de campos |
| `bTimestamp` | BOOL | TRUE | marca cada mensaje con el reloj del PLC, en el NetworkMessage y en el DataSetMessage (segundos completos, vea [Qué va por el cable](/es/transmitter/wire-format/)). FALSE envía los bytes de 1.0.0, 17 bytes más cortos |
| `tRetry` | TIME | T#2S | cuánto esperar antes de reabrir el socket tras diez envíos seguidos fallidos |

## Salidas

| Salida | Tipo | Significado |
|---|---|---|
| `eState` | `E_HLTX_State` | `Disabled`, `Running`, `Backoff` (esperando para reabrir el socket) o `ConfigError` (vea `eError`; no se envía nada) |
| `eError` | `E_HLTX_Error` | `None`, `NoFields`, `BadInterval`, `BadAddress`, `SocketCreate`, `SocketOption`, `TooBig`, `BadField` |
| `bActive` | BOOL | TRUE mientras salen mensajes |
| `udiSent` | UDINT | mensajes entregados a la red |
| `udiSendErrors` | UDINT | envíos que el sistema operativo rechazó o cortó |
| `udiSkipped` | UDINT | ranuras de publicación perdidas porque la tarea llegó tarde |
| `uiMessageSize` | UINT | bytes del último mensaje |
| `diLastSocketResult` | UDINT | el último código de error del runtime en una llamada de socket, 0 es correcto |
| `diLastClockResult` | UDINT | el último resultado de leer el reloj del PLC para una marca de tiempo, 0 es correcto. Cuando no es 0 el mensaje sale sin marca |
| `udiLastCallUs`, `udiMaxCallUs` | UDINT | microsegundos empleados en la última llamada del bloque, y el máximo desde que se habilitó o desde `Clear()` |
| `udiMaxEncodeUs`, `udiMaxSendUs` | UDINT | el mayor tiempo empleado en construir un mensaje, y en la propia llamada de envío, desde que se habilitó o desde `Clear()` |

## Métodos

Añada los campos una vez, antes de la primera llamada, en el orden en que un receptor debe leerlos. Cada método devuelve TRUE cuando el campo fue aceptado. Hasta 128 campos.

| Método | Añade |
|---|---|
| `AddBool(pValue)`, `AddSInt`, `AddUSInt`, `AddInt`, `AddUInt`, `AddDInt`, `AddUDInt`, `AddLInt`, `AddULInt`, `AddReal`, `AddLReal`, `AddTime` | un escalar. `pValue` es `ADR(variable)` |
| `AddString(pValue, uiMaxLen)` | una STRING. `uiMaxLen` es la N de `STRING(N)` |
| `AddArray(pFirst, eType, uiCount)` | un array de `uiCount` elementos de cualquier tipo salvo STRING. `pFirst` es `ADR(array[first])` |
| `AddField(pData, eType, uiCount, uiMaxLen)` | la forma general a la que llaman los demás |
| `Clear()` | olvida la lista de campos y el tiempo máximo de llamada |

El bloque conserva las direcciones que usted le da, así que tras un cambio en línea que mueva variables, llame a `Clear()` y añada los campos de nuevo. WORD, DWORD y LWORD entran como UINT, UDINT y ULINT mediante el método del mismo tamaño.

## Cómo llamarlo

Llame a la instancia una vez por ciclo desde una sola tarea. No llame a una instancia desde dos tareas. Varios publicadores en un mismo programa no son problema y cada uno tiene su propio socket; dé a cada uno su propio writer group id y dataset writer id.
