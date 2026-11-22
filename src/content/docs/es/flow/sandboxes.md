---
title: "Dos sandboxes en HotLoop Flow"
description: "Cómo se acotan el nodo Function y el sandbox de WebAssembly, qué puede tocar cada uno y cómo se ejecuta un plugin en el segundo."
---

El nodo Function se ejecuta en el intérprete de JavaScript (vea [Postura de seguridad](/es/flow/security/)). Una llamada cuesta de 11.6 a 13.7 µs. No es un límite frente a la memoria: una función que reserva memoria en un bucle hace crecer el heap de Go hasta que el pod muere, y lo único que el intérprete de JavaScript puede hacer al respecto es un tiempo límite de reloj.

Eso cuesta de 184 a 196 µs por llamada, quince o dieciséis veces una llamada al intérprete de JavaScript. Merece la pena justo cuando ejecuta código en el que no confía del todo, y no en otro caso.

Un flujo ejecuta un invitado WASM mediante un plugin: un módulo firmado con un descriptor a partir del cual el editor dibuja su cuadro de diálogo, que no obtiene acceso al host salvo que lo pida y usted diga que sí. La memoria está limitada por nodo, un mensaje tiene un tiempo límite, y un invitado que supera cualquiera de los dos se interrumpe, llega a un nodo Catch con el motivo y no se lleva nada más por delante. Todo está en [Plugins sin npm](/es/flow/plugins/), incluido cómo se confía en la clave de un editor y qué dicen los rechazos. Lo que significa para usted: aquello para lo que Node-RED necesita npm y una instalación completa de Node.js, Flow lo ejecuta como un archivo aislado que puede verificar antes de cargarlo.

Un plugin puede escribirse en Rust, TinyGo, Zig o AssemblyScript en lugar de JavaScript, de modo que el procesamiento de señal que un flujo de OT realmente quiere se ejecuta compilado, con un techo de memoria con el que no se puede discutir.

La ABI del invitado son tres exportaciones, dos de ellas ganchos del asignador, y es tan pequeña a propósito. Cada exportación es superficie de ataque, y una cosa más que cada autor de invitados tiene que hacer bien.

| Exportación | Firma | Obligatoria |
|---|---|---|
| `hotloop_flow_process` | `(ptr i32, len i32) -> i64` | sí |
| `hotloop_flow_alloc` | `(size i32) -> i32` | sí |
| `hotloop_flow_free` | `(ptr i32, size i32)` | no |

El resultado `i64` empaqueta un desplazamiento en los 32 bits altos y una longitud en los 32 bajos, y apunta a una respuesta JSON en la memoria del propio invitado. Todo cruza como JSON, de modo que un invitado en cualquier lenguaje puede producirlo sin un compilador de esquemas compartido.

Los límites son pequeños a propósito. Esto se ejecuta en hardware de borde junto a los flujos que de verdad importan, y un nodo que necesita más debería tener que decirlo:

| Límite | el intérprete de JavaScript | WASM |
|---|---|---|
| Tiempo límite por llamada | 5 s | 5 s |
| Techo de memoria | ninguno exigible | 16 MiB por nodo salvo que el plugin diga otra cosa, 64 MiB como máximo salvo que suba `plugins.maxMemoryMiB`, estricto |
| Salida máxima | 16 MiB | 8 MiB |

Ambos entornos de ejecución son Go puro, sin cgo.
