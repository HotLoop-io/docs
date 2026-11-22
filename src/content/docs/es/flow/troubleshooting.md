---
title: "Cuando Flow se niega a arrancar"
description: "Los errores de arranque que Flow da a propósito, qué significa cada uno y la solución de una línea."
---

Más allá de los errores de configuración simples (un error tipográfico en el YAML, un puerto fuera de rango), se niega a arrancar por cinco motivos, todos a propósito. Cada uno imprime la solución en lugar de una traza de pila, porque quien lo lee está mirando un CrashLoopBackOff y no necesita mis rutas de Go.

| Rechazo | Solución |
|---|---|
| La autenticación está desactivada | Configure un usuario. O, si la red de verdad está aislada y ha decidido asumirlo, defina `HOTLOOP_FLOW_INSECURE=true` en el entorno. `auth.enabled: false` en el archivo no basta por sí solo. (Hasta 2.0.4 inclusive la variable no hacía nada y se obtenía este rechazo igualmente. Corregido en 2.0.5.) |
| La autenticación está activada sin usuarios | Defina `auth.users`, o `HOTLOOP_FLOW_ADMIN_USER` y `HOTLOOP_FLOW_ADMIN_PASSWORD_HASH`. |
| Un `passwordHash` que no es bcrypt | Ejecute `hotloop-flow hash-password`. Esta comprobación existe para que una contraseña en texto plano nunca acabe en un ConfigMap por accidente. |
| Sin secreto de credenciales | Defina `HOTLOOP_FLOW_CREDENTIAL_SECRET`. O `HOTLOOP_FLOW_ALLOW_PLAINTEXT_CREDENTIALS=true` si esta instancia no guarda ningún secreto. |
| `discovery` o `exec` activados con una lista de permitidos vacía | Enumere lo que se permite, o desactive la función. Una lista de permitidos vacía leída de forma permisiva es exactamente cómo una capacidad estrecha se convierte en un shell. |

Lo que *no* hará es negarse a arrancar por un solo nodo defectuoso. Un flujo con un único nodo roto ejecuta todos los demás nodos y registra el fallo, porque parar una línea por un error tipográfico en un cuadro de diálogo es peor que ejecutar 40 nodos de 41 y decirlo. Lo mismo con una lista de permitidos de exec que nombra algo que aún no está en el `PATH`: avisa al arrancar y lo resuelve de nuevo cuando un flujo lo usa, ya que un contenedor de inicio o un volumen montado pueden traerlo legítimamente después del arranque.

Si el archivo del flujo no se puede analizar, prueba las copias de respaldo de la más reciente a la más antigua, guarda el archivo corrupto a su lado como `.corrupt` y registra exactamente a qué copia recurrió. Si tampoco se puede analizar ninguna de ellas, se detiene ahí, en lugar de arrancar vacío y parecer sano mientras todos sus flujos han desaparecido. Y un despliegue escribe el archivo del flujo *antes* de detener el runtime anterior, de modo que si el guardado falla, sus flujos anteriores siguen funcionando en lugar de que la línea se pare por un mal guardado. Ese orden no es el obvio, no es un accidente, y una prueba falla si alguien lo cambia.
