---
title: "Instalar HotLoop Transmitter"
description: "Instale la biblioteca en el repositorio de bibliotecas de CODESYS, añádala a un proyecto y vea qué hacer cuando el bloque informa de un error."
---

Necesita un sistema de desarrollo CODESYS 3.5 SP22 o posterior, y un runtime cuyo destino tenga los componentes SysSocket y SysTimeRtc, que los runtimes CODESYS Control para Linux SL incluyen (el segundo es nuevo en 1.1.0, por la marca de tiempo).

## Desde el CODESYS Installer

Desde 1.1.0 la versión incluye también `HotLoopTransmitter-1.1.0.package`, en https://hotloop.io/hotloop-transmitter/1.1.0/HotLoopTransmitter-1.1.0.package. Instálelo con el CODESYS Installer (en el IDE: Tools, CODESYS Installer), o sin ventana con su línea de comandos, `PackageManagerCLI.exe --profile="<your profile>" --install=<file>.package --targetProfiles="<your profile>"`. El Installer coloca la biblioteca en el repositorio de bibliotecas de ese perfil, bajo la empresa HotLoop, y usted pasa al paso 3 de abajo. El paquete es la misma biblioteca que el archivo `.library`, en un ZIP que lee el Installer, así que las dos vías dan la misma biblioteca.

## Desde el archivo de la biblioteca

1. Descargue `HotLoopTransmitter-1.1.0.library` desde https://hotloop.io/hotloop-transmitter/1.1.0/HotLoopTransmitter-1.1.0.library y compruébelo con `SHA256SUMS` de la misma carpeta (`sha256sum -c SHA256SUMS`).
2. En el IDE de CODESYS: Tools, Library Repository, Install, y elija el archivo. Ya está en el repositorio bajo la empresa HotLoop.
3. En su proyecto, abra el Library Manager de la aplicación, Add Library, y elija HotLoop Transmitter. SysSocket, SysTimeRtc y sus bibliotecas de interfaz vienen con ella como dependencias y no necesitan nada de usted.
4. Declare un `HLTX.FB_HLTX_Publisher`, añada sus campos y llámelo en cada ciclo (el README tiene el ejemplo).
5. Descargue al controlador. El destino debe ser alcanzable desde la red del controlador; para multicast, los switches de la red deben transportar el grupo.

El archivo `.compiled-library` es la misma biblioteca sin su código fuente. Instale ese si no quiere que el Structured Text sea visible en el Library Manager. Está en la misma carpeta, como `HotLoopTransmitter-1.1.0.compiled-library`.

Para comprobar lo que llega, sirve cualquier receptor UDP en el puerto de destino. Un programa pequeño en Go que escuche en un puerto o se una a un grupo multicast e imprima cada datagrama como una línea de JSON con su hexadecimal funciona bien.

## Si el bloque informa de un error

| `eError` | Significado | Qué hacer |
|---|---|---|
| `NoFields` | no se añadió ningún campo | llame a un método `Add` antes de habilitar |
| `BadInterval` | `tPublishingInterval` es menor de 1 ms | defínalo |
| `BadAddress` | `sDestination` no es una dirección IPv4 con puntos | corríjala |
| `SocketCreate`, `SocketOption` | el runtime rechazó una llamada de socket; `diLastSocketResult` tiene su código | el bloque reintenta por sí solo tras `tRetry` |
| `TooBig` | los campos no caben en 1472 bytes | publique menos, o use dos publicadores con distintos writer id |
| `BadField` | se borró una dirección guardada | `Clear()` y añada los campos de nuevo |
