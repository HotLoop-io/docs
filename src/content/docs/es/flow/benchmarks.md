---
title: "Pruebas de rendimiento"
description: "Arranque, memoria, rendimiento y latencia medidos de Flow en un escritorio y en una Raspberry Pi 5, lo que esas cifras no son y cómo repetir la prueba."
---

Solo cifras absolutas. Una tabla comparativa se mueve cada vez que cambia el equipo y acaba describiendo más lo otro que esto.

Flow responde unas 15 000 solicitudes por segundo en un equipo de escritorio y unas 13 000 por segundo en una Raspberry Pi 5, con menos de 30 MiB de memoria en el escritorio y 42 MiB en la Pi. Ese es todo el sentido de un motor de flujos lo bastante pequeño para la caja que está en la planta.

## El flujo

Cinco nodos: un endpoint HTTP, tres ediciones de propiedades y una respuesta. Nada en él es rápido a propósito. Es la forma de un flujo real pequeño, que es de lo que debe tratar una prueba de rendimiento de un motor de flujos. El generador de carga es de bucle cerrado: cada cliente envía la siguiente solicitud cuando vuelve la anterior, así que mide lo que el otro extremo puede absorber y no puede producir la latencia engañosa que informa un generador de bucle abierto cuando el destino se queda atrás.

## Pruébelo usted mismo

`hotloop-flow bench` viene en el binario. `-launch` inicia el binario, mide cuánto tarda en responder el flujo (arranque en frío), lee la memoria residente del proceso dos segundos después (en reposo) y luego la muestrea durante la carga y conserva el pico. `-target` sin `-launch` maneja una instancia que ya está en ejecución, un contenedor o un pod, por HTTP, para medir rendimiento y latencia.

```bash
hotloop-flow bench -mode http -launch ./hotloop-flow -target http://127.0.0.1:18897 -path /bench -duration 30s -warmup 5s -connections 8
hotloop-flow bench -mode engine -chain 5 -messages 200000
```

## Resultados

Medido en un equipo de escritorio x86 (24 CPU), con el binario estático nativo, tres ejecuciones de cada una.

| <span class="sr-only">Detalles</span> | Ejecución 1 | Ejecución 2 | Ejecución 3 |
|---|---|---|---|
| Arranque en frío | 0.05 s | 0.05 s | 0.05 s |
| RSS, en reposo | 16.7 MiB | 16.7 MiB | 16.4 MiB |
| RSS, pico bajo carga | 26.4 MiB | 26.4 MiB | 28.5 MiB |
| Rendimiento HTTP | 15.0k req/s | 15.3k req/s | 13.0k req/s |
| Latencia HTTP p50 / p95 / p99 | 0.39 / 1.22 / 1.82 ms | 0.39 / 1.20 / 1.78 ms | 0.41 / 1.49 / 4.03 ms |
| Motor, por mensaje | 2.61 µs | 3.11 µs | 2.20 µs |
| Motor, memoria asignada por mensaje | 3,868 bytes | 3,869 bytes | 3,868 bytes |

## Resultados en una Raspberry Pi 5

Medido en una Raspberry Pi 5 de 8 GB, con el reloj limitado a 2.0 GHz, como un pod en k3s, sin nada más en el nodo. El mismo flujo, tres ejecuciones, cada una en un pod nuevo.

| <span class="sr-only">Detalles</span> | Ejecución 1 | Ejecución 2 | Ejecución 3 |
|---|---|---|---|
| Arranque en frío | 0.46 s | 0.15 s | 0.10 s |
| RSS, pico bajo carga | 40.3 MiB | 40.5 MiB | 40.3 MiB |
| Rendimiento HTTP | 13.2k req/s | 13.4k req/s | 13.3k req/s |
| Latencia HTTP p50 / p95 / p99 | 0.48 / 1.45 / 2.78 ms | 0.48 / 1.42 / 2.72 ms | 0.48 / 1.44 / 2.74 ms |
| Motor, por mensaje | 8.15 µs | 7.74 µs | 7.89 µs |

Mantenido durante 600 segundos, el mismo comando en la misma placa se estabiliza en 11.4k req/s con p50 de 0.58 ms y p99 de 3.00 ms. La placa funciona con un disipador pasivo sin ventilador y se limita con tanta carga, así que esa es la cifra honesta para un equipo que se mantiene cargado.

### Lo que estas cifras no son

**El rendimiento HTTP incluye la pila HTTP.** A propósito: es lo que percibe un cliente de su flujo. No es una medición del planificador. Las filas del motor sí lo son, sin ninguna E/S en el camino.

**Una forma de flujo, un tamaño de carga útil, una concurrencia.** Un flujo con E/S real, una publicación MQTT o una escritura en una base de datos, está dominado por esa E/S. Estas cifras son la sobrecarga propia del entorno de ejecución, no una promesa sobre cada carga de trabajo.

**La cola se mueve más que la mediana.** En saturación todo hace cola y la cola manda en p99. La mediana es donde se ve el costo de atender una solicitud.

**Este es el flujo de prueba, no los cables durables.** Nada aquí mide el almacén detrás de un cable durable ni las escrituras en tarjeta SD.

## Memoria

RSS es la memoria residente del propio proceso, leída de `/proc`. No es lo que informa `podman stats`, que muestra lo que el kernel carga al contenedor y puede marcar mucho menos de lo que el proceso realmente retiene.