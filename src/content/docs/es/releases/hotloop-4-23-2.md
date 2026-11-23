---
title: "Notas de versión: HotLoop core 4.23.2"
description: "Qué trae HotLoop core 4.23.2, qué cambia al actualizar y qué leer antes de tocar una planta en marcha."
sidebar:
  label: "4.23.2"
---

Una pantalla de CODESYS ahora llega como una pantalla de HotLoop, el equipo informa de su propia salud al panel de EmberNet y un medidor de energía puede llevar un cargo por demanda. También es un barrido de los fallos de nodo lento de la suite de pruebas, cada uno una espera o una carrera real corregida. Compilada solo para amd64; la compilación multiarquitectura sigue como la siguiente versión.

## Qué cambió

- **Una visualización de CODESYS se importa como pantalla.** Expórtala desde el IDE (Project, Export, el archivo nativo `.export`, no PLCopenXML), y el Import de la pantalla Dashboards la lee como una pantalla de HotLoop sobre las variables del PLC. Cada tag que lee la pantalla y que esta instalación no tiene se lista, con una correspondencia de dispositivos, y cada elemento que HotLoop no pudo colocar se lista con el motivo antes de guardar nada. Un botón o consigna sobre un tag que no es escribible se rechaza, igual que una construcción. Mira [Import a CODESYS screen](/es/iot/codesys-screen-import/).
- **Salud del equipo para el panel de EmberNet.** Un dispositivo con el nombre del nodo de Kubernetes publica el uso de CPU, memoria, disco y volumen de datos del equipo, y el jitter de tiempo real de tres núcleos cuando un agente escribe el archivo para él. Los valores que no se pueden leer tienen calidad mala con el motivo, nunca cero. El servidor OPC UA sirve su historial. Mira [el servidor OPC UA](/es/edge/opc-ua-server/#salud-del-equipo-para-el-panel-de-embernet) y [Protocolos y drivers](/es/iot/protocols/#salud-del-equipo).
- **Un inicio de sesión que puede leer y nada más.** Un despliegue puede crear una cuenta con exactamente `tags.read` y `values.read` (`HOTLOOP_READER_USER` y `HOTLOOP_READER_PASSWORD_HASH`). El chart crea `embernet-dashboard-read` en la primera instalación, guarda su contraseña en el Secret `<release>-opcua-dashboard` y nunca la rota al actualizar.
- **El certificado del panel se confía desde un Secret.** El chart monta `<release>-opcua-trust` (opcional) y el servidor OPC UA mantiene su carpeta de confianza al día: un certificado nuevo se añade en 30 segundos, el que sale del Secret se retira, y un archivo que un operador puso a mano nunca se toca. El servidor sigue aceptando solo Basic256Sha256 SignAndEncrypt, sin sesiones anónimas ni confiar en todo. El Service de la versión ahora lista el puerto 4840 cuando el servidor está activado.
- **Energía: un cargo por demanda y turnos.** Un medidor en Wh, kWh o MWh acepta un `demand_price`, lo que cuesta un kilovatio de su cuarto de hora más alto en una ventana, y el resumen muestra el pico, cuándo empezó y cuánto de ese cuarto de hora se leyó. Un turno es una ventana, `shift:06:00-14:00` para el último que ha empezado y `last_shift:06:00-14:00` para el anterior. La pantalla Energy tiene un cuadro Shift y un precio de demanda, en los trece idiomas.
- **Un coste por unidad fabricada ya no se lee como gratis.** Cuando se fabricó algo y ningún medidor con precio ha contado consumo todavía, la respuesta es ninguna, con el motivo `nothing_counted`, no cero.
- **Runtimes de CODESYS en pruebas, por escrito.** El servidor OPC UA de un runtime real se hace seguro con los comandos de shell del PLC que documenta CODESYS, y se prueba contra él una lectura Basic256Sha256 SignAndEncrypt. Una alarma real se dispara, se reconoce y se despeja según lo que informa un PLC en marcha. Lo que hace un dispositivo cuando termina la ventana de demostración de dos horas de un runtime sin licencia queda registrado, con el script de la cronología. Son pruebas y notas en [Protocolos y drivers](/es/iot/protocols/); el driver no cambia.
- **Correcciones que encontró la suite.** El motor de energía ya no lee un medidor mientras se borra o se cambia (la base de datos rompía el interbloqueo haciendo fallar el borrado). El manifiesto de una copia de seguridad se escribe con un nombre temporal y se renombra en su sitio, así que un listado nunca ve medio archivo. La puesta al día del historian espera hasta haber escrito todo hasta una marca. El resto son pruebas que ahora esperan lo que afirman, en un nodo cargado, en lugar de un número fijo de segundos.

## La salud de la caja está activa por defecto

El chart monta la raíz del host en `/host` y su `/proc` en `/host/proc`, ambos de solo lectura, y no añade privilegios: solo se lee un statfs y los contadores de CPU y memoria. Un clúster que aplica el perfil restricted de Pod Security rechaza un hostPath. Ahí, define `opcuaServer.dashboard.boxHealth.enabled: false` (ni dispositivo ni montajes) o `hostMount: false` (el dispositivo, con el disco y la CPU del equipo leyéndose mal y diciendo qué montar). El drop-in de Quadlet es `deploy/quadlet/opcua-dashboard.conf`.

## Migraciones

Una, y solo añade: `0030_energy_demand` (una columna `demand_price` en los medidores y en sus tramos, por defecto 0, así que nada ya contado o con precio cambia). Una copia tomada en la 4.23.1 se restaura aquí, y una tomada aquí no se restaura en una versión anterior.

## Cambios en la API

`demand_price` en la tarifa de un medidor de energía, un bloque `demand` en una fila de resumen, `shift:` y `last_shift:` como periodo de energía, y `reason` en `cost_per_unit` cuando es null. `POST /api/dashboards/import` acepta `codesys` y `visualization` en lugar de `file`, y su informe lleva una `conversion`. Mira [la API HTTP](/es/iot/api/).

## Actualizar desde 4.23.1

Un `helm upgrade` normal. La migración se ejecuta en el primer arranque. El chart crea la cuenta de solo lectura y su Secret en la primera instalación de esta versión y nunca la rota; nada de lo que ya hay en el equipo cambia.

## Qué no está probado

- Los elementos que no conoce se listan y se dejan fuera, nunca se adivinan, y una pantalla de otro proyecto puede listar más.
- Las etiquetas de jitter de tiempo real necesitan un agente que escriba el archivo, y esta versión no instala ninguno.
- El inicio de sesión de solo lectura y la confianza del certificado se demostraron con el cliente propio de HotLoop. El lado del panel de EmberNet es su propia versión.
- El endpoint seguro de CODESYS se probó en pruebas en una versión de runtime. El driver de HotLoop no cambió por ello, y ninguna pantalla de configuración del endpoint seguro forma parte de esta versión.
- Los cargos por demanda se comprobaron con lecturas grabadas, no con la factura de una compañía eléctrica.
