---
title: "Instalar HotLoop"
description: "Cómo se instala cada producto HotLoop: Helm sobre k3s o Kubernetes, o Podman Quadlet en un equipo que sigue la etiqueta stable y se actualiza solo."
sidebar:
  label: "Instalación"
---

Hay dos maneras de ejecutar un producto HotLoop de verdad: Helm sobre k3s o cualquier Kubernetes, o Podman con Quadlet en un equipo que no está en un clúster. Sin Docker, sin Compose y sin un `podman run` suelto desde una shell que muere con la sesión. Un `podman run` sencillo sirve para probar, y la página de Flow lo dice, pero no es una instalación.

## Elija la vía

| Usted tiene | Use | Página |
|---|---|---|
| Un clúster k3s o Kubernetes | Helm | [k3s y Helm](/es/install/helm/) |
| Una Pi, un NUC o un PC industrial pequeño, sin clúster | Podman Quadlet | [Podman Quadlet](/es/install/quadlet/) |
| Cualquiera de los dos, y quiere saber cómo se comportan las actualizaciones | | [La actualización automática de :stable](/es/install/auto-update/) |

## Lo que puede instalar hoy

| Producto | Última versión | Helm | Quadlet | Empiece aquí |
|---|---|---|---|---|
| [HotLoop IoT](/es/iot/overview/) | {{hotloop}} | Sí | Sí | [Instalar IoT](/es/iot/install/) |
| [HotLoop Edge](/es/edge/overview/) | {{hotloop}} | Sí | Sí | [Instalar Edge](/es/edge/install/) |
| [HotLoop Gateway](/es/gateway/overview/) | {{hotloop}} | Sí | Sí | [Instalar el Gateway](/es/gateway/install/) |
| [HotLoop Edge Relay](/es/edge-relay/overview/) | {{hotloop}} | Sí | Sí | [Instalar el Edge Relay](/es/edge-relay/install/) |
| [HotLoop Flow](/es/flow/overview/) | {{flow}} | Sí | Sí | [Instalar Flow](/es/flow/install/) |
| [HotLoop Cascade](/es/cascade/overview/) | {{cascade}} | Sí, sin inicio de sesión | Sí, sin inicio de sesión, vea [Cascade con Podman Quadlet](/es/cascade/quadlet/) | [Ejecutar Cascade](/es/cascade/running/) |
| [HotLoop for CODESYS](/es/codesys/overview/) | {{codesys}} | Sí, o la App Store de EmberCORE | No | [Instalar HotLoop for CODESYS](/es/codesys/install/) |
| [HotLoop Transmitter](/es/transmitter/overview/) | 1.2.0 | No, es una biblioteca CODESYS | No, es una biblioteca CODESYS | [Instalar Transmitter](/es/transmitter/install/) |

HotLoop IoT, Edge, Gateway y Edge Relay salen de una misma etiqueta, en bloque, así que comparten número de versión. Flow, Cascade, HotLoop for CODESYS y Transmitter tienen el suyo. Las unidades Quadlet de IoT, Edge y Gateway necesitan Podman 5.0 o superior, y la del relay se ejecutó en Podman 4.9.3. Raspberry Pi OS Bookworm trae la 4.3, que no tiene Quadlet, así que una Pi necesita Trixie o posterior.

## Instalar desde el App Store de EmberNet

En EmberNet, la instalación es el App Store. Ejecuta por usted el mismo chart de Helm, en el nodo que elija, así que no hay chart que añadir, ni archivo de valores, ni línea de comandos. Lo cronometramos en un nodo real: 1 minuto y 10 segundos desde que se abre el App Store hasta ver lecturas en vivo en el tablero.

<figure>
<video controls preload="none" playsinline width="1920" height="1080" poster="/embernet-install/poster.webp" aria-label="Instalación de HotLoop Gateway desde el App Store de EmberNet, del inicio a los datos en vivo en 1 minuto y 10 segundos" style="width:100%;height:auto;aspect-ratio:16/9">
<source src="/embernet-install/install-hotloop-on-embernet.mp4" type="video/mp4" />
<source src="/embernet-install/install-hotloop-on-embernet.webm" type="video/webm" />
Su navegador no puede reproducir este vídeo. <a href="/embernet-install/install-hotloop-on-embernet.mp4">Descargarlo</a>.
</video>
<figcaption>Una sola toma, en tiempo real. El reloj corre desde que se abre el App Store hasta que HotLoop lee datos, y la espera de la instalación se muestra a cuatro veces la velocidad.</figcaption>
</figure>

1. En EmberCORE, abra el **App Store**.

   ![El App Store de EmberCORE con los filtros de categoría, publicador y orden](/embernet-install/hotloop-install-01-app-store.webp)

2. Elija la categoría **HotLoop** y pulse **Desplegar** en HotLoop Gateway. Cada producto de HotLoop tiene su propia tarjeta en esta categoría.

   ![El App Store filtrado por la categoría HotLoop, con las tarjetas de HotLoop Cascade, Edge, Edge Relay, Flow, Gateway e IoT](/embernet-install/hotloop-install-02-hotloop-apps.webp)

3. Elija el nodo y pulse **Desplegar** otra vez.

   ![El cuadro de diálogo para desplegar HotLoop Gateway con un nodo elegido](/embernet-install/hotloop-install-03-choose-node.webp)

4. EmberCORE confirma la instalación, y HotLoop Gateway aparece en **Aplicaciones en ejecución** con su versión y su dirección de Flux.

   ![El aviso de EmberCORE de que HotLoop Gateway se está instalando en el nodo](/embernet-install/hotloop-install-04-installing.webp)

   ![Aplicaciones en ejecución con HotLoop Gateway en marcha, su versión, su dirección de Flux en línea y los botones Iniciar, Abrir, Shell del pod, Shell del dispositivo y Quitar](/embernet-install/hotloop-install-05-running.webp)

5. Pulse **Iniciar**. EmberCORE le da acceso, y HotLoop se abre con el estado de la propia máquina ya en lectura, así que lo primero que ve son datos en vivo.

   ![HotLoop Gateway abierto en EmberCORE y con la sesión iniciada, con un dispositivo, 4 de 4 etiquetas informando y sin alarmas](/embernet-install/hotloop-install-06-hotloop-signed-in.webp)

6. Fije las etiquetas que le importan y se convierten en indicadores en vivo en el tablero.

   ![El cuadro para fijar etiquetas en el tablero, con las etiquetas de CPU, memoria y disco del nodo](/embernet-install/hotloop-install-07-pin-a-tag.webp)

   ![El tablero de HotLoop con indicadores en vivo de CPU, memoria y disco del nodo](/embernet-install/hotloop-install-08-board-live.webp)

La documentación de EmberNet recorre la misma instalación página por página: [HotLoop Gateway en EmberNet](https://docs.embernet.ai/docs/app-store/hotloop).

## Antes de ponerlo en una planta real

- Lea [la compuerta de escritura](/es/gateway/write-gate/). Es igual en todos los productos, y es la razón por la que nada mueve una máquina que usted no armó.
- Ponga la base de datos en un SSD USB y no en la tarjeta SD, si es una Pi. El historial escribe todo el día, todos los días, y las tarjetas SD mueren justo por eso.
- Haga copia de la clave de contraseñas de dispositivos. No está en la base de datos ni en una copia de seguridad, así que forma parte de sus datos. [Copias de seguridad](/es/iot/backup/) explica cómo.
- Haga una copia de seguridad antes de subir un sitio a otro producto o de actualizar entre versiones, y llévela fuera del equipo.
