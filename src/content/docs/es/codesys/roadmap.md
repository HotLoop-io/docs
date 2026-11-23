---
title: "Hoja de ruta de HotLoop for CODESYS"
description: "Lo que HotLoop for CODESYS tiene construido, publicado y ejecutado en hardware real."
sidebar:
  label: "Hoja de ruta"
editUrl: false
---

Esta es la lista de lo que está hecho y lo que falta, en el orden en que se hace. No promete nada que no esté en el código o en un plan de pruebas, y [Estado](/es/codesys/where-it-stands/) dice hasta dónde se ha ejecutado.

## Construido

- [x] Un chart alrededor de HotLoop Edge con valores predeterminados para un runtime en un nodo: SQLite, una réplica, tolerancias que conservan ambos pods ante la pérdida del plano de control.
- [x] Un provisioner que aplica un perfil y lo mantiene correcto, con una revisión que protege lo que una persona cambió.
- [x] Un perfil que lleva una lista de dispositivos de cualquier protocolo que HotLoop habla, de modo que un listener vuelve configurado sin necesidad de PLC.
- [x] El dispositivo, los tags, la alarma y la pantalla creados sin pasos manuales, contra un runtime CODESYS Control for Linux SL 4.22.0.0 en un contenedor.
- [x] Recuperación tras un reinicio del runtime sin intervención, en unos 88 segundos.
- [x] Un inicio de sesión firmado desde el panel de EmberCORE, con sus rechazos.

## Publicado

- [x] HotLoop 4.22.0, la versión que envuelve el chart.
- [x] El chart publicado en `https://hotloop.io/hotloop-codesys/`, siendo 0.3.8 el más reciente.
- [x] La imagen del provisioner pública, para que se descargue sin iniciar sesión, 0.3.3.
- [x] Una imagen multiarquitectura del provisioner, amd64 y arm64, desde 0.3.3 y el chart 0.3.8.
- [x] Dos listeners OPC UA PubSub en un mismo puerto UDP, con HotLoop 4.22.0 y el chart 0.3.7.
- [x] [Notas de la versión](/es/releases/codesys-0-3-10/) de cada chart, de 0.3.0 a 0.3.10.

## Probado en hardware sin sistema operativo

- [x] Ejecutado en hardware sin sistema operativo (2026-11-17), incluida una instalación desde la página real del App Store tal como la hace el personal, k3s v1.35.7, un nodo que realmente pierde su enlace con el plano de control manteniendo los pods, una descarga desde el IDE de CODESYS con el runtime en marcha, un runtime en la red propia del host junto al pod de HotLoop en un nodo, y un runtime con gestión de usuarios activada y un endpoint OPC UA protegido con certificado.

## Por construir

- [ ] Más de una pantalla en un perfil.
