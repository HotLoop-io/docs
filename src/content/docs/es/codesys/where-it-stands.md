---
title: "Estado de HotLoop for CODESYS"
description: "Contra qué se ha ejecutado HotLoop for CODESYS en hardware real, y qué está publicado."
sidebar:
  label: "Estado"
editUrl: false
---

Esta página es lo que está publicado, y hasta dónde se ha ejecutado HotLoop for CODESYS.

## Qué hay publicado

- **El chart.** `hotloop-codesys` 0.3.8 está en el índice en `https://hotloop.io/hotloop-codesys/`, publicado el 2026-11-19, con todas las versiones anteriores todavía a su lado. Envuelve HotLoop 4.22.0. Instale la 0.3.8: [las notas de la versión](/es/releases/codesys-0-3-5/) dicen qué cambió cada chart.
- **La imagen del provisioner.** `ghcr.io/hotloop-io/hotloop-provision` en 0.3.3 se descarga sin iniciar sesión, para amd64 y para arm64, y el chart la ejecuta.
- **La ficha del App Store.** Está en el App Store de EmberCORE, y EmberNet la instala en su tenant.

## Hasta dónde se ha ejecutado

El chart en un nodo k3s con valores con la forma del Store, un runtime real CODESYS Control for Linux SL 4.22.0.0 en el mismo nodo ejecutando un programa de demostración, y una imagen de HotLoop Edge.

- El dispositivo, sus tags (ninguno escribible), su alarma y su pantalla aparecieron sin ningún paso manual.
- Todos los valores se leyeron bien y se movieron.
- Los pods volvieron tras borrar un pod.
- La instalación se leyó como mala con el motivo "the PLC's runtime is not answering" durante un reinicio del runtime, y se recuperó sola unos 88 segundos después.
- Un inicio de sesión firmado desde el panel inició sesión a una persona como operador o como administrador, y una aplicación equivocada, un tenant equivocado, uno caducado, un emisor equivocado y uno manipulado fueron rechazados cada uno.
- El chart publicado se renderiza desde el índice en vivo con Helm.

El conector que hay debajo, el driver CODESYS de HotLoop core, está verificado en vivo contra un runtime CODESYS Control for Linux SL 4.22.0.0, para lecturas y escrituras, y en hardware sin sistema operativo (2026-11-17). Las escrituras existen en el conector, y este producto nunca las activa.

Todo ello se ha ejecutado también en hardware sin sistema operativo (2026-11-17).

## Lo que un perfil todavía no puede hacer

Un perfil crea una pantalla. Crea un dispositivo a partir de `device`, o varios de cualquier protocolo a partir de `devices`, y no hay forma de marcar una variable como escribible desde él, a propósito.
