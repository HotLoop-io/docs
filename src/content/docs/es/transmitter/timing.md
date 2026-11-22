---
title: "Qué añade Transmitter a la tarea del PLC"
description: "El coste medido del publicador en una tarea cíclica de 20 ms, y lo que eso dice y no dice sobre un controlador físico."
---

Medido en 1.1.0 con marcas de tiempo activadas. El runtime es CODESYS Control for Linux SL 4.22.0.0 en modo demo, con una tarea cíclica de 20 ms fijada a cuatro núcleos. La ejecución con publicación tiene dos publicadores, uno Variant y otro RawData, cada uno enviando unos 1,1 KB cada 100 ms, de modo que sale un mensaje cada cinco ciclos. Las estadísticas se reiniciaron 45 s después de arrancar el runtime y se leyeron 240 s más tarde.

| Medida | referencia (sin publicador) | dos publicadores, marcas de tiempo activadas |
|---|---|---|
| Tiempo medio en `PLC_PRG` por ciclo | 103 ns | 9 584 ns |
| Mayor tiempo en `PLC_PRG` en la ventana | 1 us | 81 us |
| Ciclos por debajo de 10 us | 11 997 de 11 997 | 9 580 de 11 976 |
| Ciclos de 10 a 50 us | 0 | 2 299 |
| Ciclos de 50 a 100 us | 0 | 97 |
| Ciclos de 100 us o más | 0 | 0 |
| Mensajes enviados / rechazados / ranuras omitidas | 0 / 0 / 0 | 2 849 / 0 / 3 |

Lo que eso dice:

* **Un ciclo que envía cuesta de 10 a 100 us.** Unos 2 400 ciclos de la ventana enviaron (uno de cada cinco), así que los ciclos de envío son todo el coste: el 96 por ciento de ellos tardó de 10 a 50 us y el 4 por ciento de 50 a 100 us, para dos mensajes de unos 1,16 KB. Los ciclos intermedios cuestan lo que cuesta la referencia.
* **El coste medio añadido es de unos 9,5 us por ciclo de 20 ms**, el 0,05 por ciento de la tarea. La marca de tiempo es una lectura de reloj y 17 bytes más por mensaje, y esta ejecución no muestra un coste por ella.
* **Ningún envío fue rechazado.** Se omitieron tres ranuras de publicación, así que la tarea llegó tarde tres veces. El bloque nunca espera a la red, aunque un envío puede ser lento cuando el kernel está ocupado, así que lea la cifra más larga como un límite de la medición y ponga el publicador en su propia tarea de baja prioridad si la principal va justa.

Lo que esto no dice: el coste en su controlador. Estas cifras provienen de un contenedor en un host de propósito general. Una CPU ARM pequeña puede ser de diez a cien veces más lenta, y el coste crece con el tamaño de la lista de campos. Mídalo en el destino con `udiLastCallUs`, `udiMaxCallUs`, `udiMaxEncodeUs` y `udiMaxSendUs` del bloque, que están para eso.
