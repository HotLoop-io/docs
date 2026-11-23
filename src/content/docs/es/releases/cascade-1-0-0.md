---
title: "Notas de versión: HotLoop Cascade 1.0.0"
description: "Qué trae HotLoop Cascade 1.0.0, qué cambia al actualizar y qué conviene leer antes de tocar una planta en marcha."
sidebar:
  label: "1.0.0"
---

## Qué es esto

1.0.0 es el trabajo de identidad y gobernanza y un editor nuevo, en una sola versión. Todo lo de 0.1.2 sigue aquí y funciona igual: el motor, los conectores, el importador, el chart de Helm, las unidades Quadlet y el formato de archivo de los flujos de trabajo. Lo que cambia es lo que una planta puede hacer con una instancia, y su aspecto mientras lo hace.

La llamamos 1.0.0 porque el editor es la última pieza que queríamos antes de poner nuestro nombre bajo ese número. Cada pantalla funciona contra la API real, y cada función de abajo se probó contra el servidor real con el que habla, no contra un sustituto.

## El nuevo editor

Está reconstruido con Astro y islas de Svelte, con los colores y la tipografía propios de HotLoop, y sigue el modo claro u oscuro del sistema hasta que usted elija. Sigue integrado en el binario y no descarga nada de ningún sitio, así que una máquina sin internet lo ejecuta igual que una con conexión. Todas las pantallas del editor anterior siguen aquí y hacen lo mismo, el lienzo incluido: trasladamos su código en lugar de reescribirlo, y contamos cada pantalla, botón, campo y llamada a la API antes y después para asegurarnos de que no faltara nada.

Las URL que guardó siguen funcionando. `#/w/<id>`, `#/x/<id>`, `#/executions` y los enlaces de depuración abren las mismas pantallas, y `/app/main.js` y `/app/main.css` siguen respondiendo.

## Qué hay de nuevo

SAML, contra Keycloak, solo con respuestas firmadas. LDAP y Active Directory, contra OpenLDAP y un controlador de dominio Samba, con roles a partir de grupos. SCIM, contra scim2-tester, para que un proveedor cree y desactive cuentas sin que nadie toque una pantalla. Roles personalizados, creados a partir de los permisos del proyecto. Secretos externos en OpenBao o HashiCorp Vault, de modo que la contraseña de una credencial vive en el almacén y rota allí. Transmisión del registro de auditoría y de las ejecuciones terminadas a syslog (TCP, UDP o TLS) y OTLP, probada contra un servidor syslog real y Loki. Variables, carpetas, informes, anotaciones en las ejecuciones, políticas de redacción y almacenes de blobs en S3 y Azure, probados contra Garage y Azurite.

El editor tiene una pantalla para cada uno: Variables, Informes y, en Ajustes, Roles, Redacción, Secretos externos, Transmisión de registros, e Inicio de sesión y SCIM. A cada persona solo se le ofrece lo que su rol permite, y el servidor sigue rechazando el resto.

## Los pasos de EmberOps desaparecen

Quitamos el conector de EmberOps. Los nueve pasos (`erpnext.trigger`, `getList`, `getDoc`, `create`, `update`, `delete`, `submit`, `cancel` y `call`), el disparador "Cuando se crea o cambia un documento de EmberOps", el tipo de credencial de EmberOps y las pantallas y la documentación que los ofrecían ya no están en 1.0.0. Si necesita llegar a EmberOps, el paso HTTP llama a su API REST con una credencial, y eso funciona hoy.

Un flujo de trabajo guardado con alguno de esos pasos no se descarta ni se cambia en silencio. No pasa la validación y no arranca, y el mensaje nombra el paso y dice que los pasos de EmberOps se eliminaron en 1.0.0. Elimine el paso, o sustitúyalo por un paso HTTP, y vuelve a ejecutarse. Una credencial de tipo EmberOps permanece en su lista, sin usarse, y puede eliminarla. El importador ya no traslada un nodo de EmberOps, así que entra desactivado con su configuración en las notas, como cualquier nodo para el que no tiene paso.

## Actualizar desde 0.1.2

Ejecute `helm upgrade` a 1.0.0, o deje que `:stable` actualice las unidades Quadlet. Durante la subida se ejecutan ocho migraciones (0018 a 0025). Crean tablas para roles, variables, carpetas, anotaciones, políticas de redacción, SCIM, proveedores de secretos y destinos de registro, y añaden una columna: la carpeta en la que está un flujo de trabajo. No tocan lo que ya tiene, así que sus flujos de trabajo, credenciales y ejecuciones siguen donde estaban y la clave sigue abriéndolos. SAML, LDAP, SCIM y los almacenes de blobs están desactivados hasta que defina sus ajustes `HOTLOOP_CASCADE_*`, que están en `docs/IDENTITY.md` y `docs/GOVERNANCE.md`. Nada cambia para una instancia que no defina ninguno, salvo que un flujo suyo use un paso de EmberOps (véase arriba).

## Qué debe saber

Las migraciones solo avanzan. Una reversión devuelve la imagen anterior, pero no deshace la migración de su base de datos, así que haga una copia de seguridad antes de actualizar y trátela como el camino de vuelta. Nada en estas migraciones cambia ni elimina lo que había, pero no hemos ejecutado la imagen anterior sobre el esquema nuevo, así que no lo prometemos.

Los secretos externos necesitan rutas permitidas. Un proveedor sin ninguna se rechaza, a propósito, porque el token del almacén suele poder leer mucho más de lo que debería poder nombrar quien edita credenciales.

SCIM nunca muestra al propietario de la instancia a un proveedor, y un DELETE de un proveedor desactiva y oculta la cuenta en lugar de borrarla, de modo que un proveedor no puede eliminar a la última persona que puede iniciar sesión. Volver a crearla devuelve la misma cuenta.

Las variables no son secretos. Quien puede leer un proyecto lee sus variables, y el valor no se oculta en los datos de ejecución. Las contraseñas van en credenciales o en un almacén externo.

## Licencia

Cascade usa la Business Source License 1.1 (`BUSL-1.1`) de HotLoop, igual que el resto de la familia HotLoop. No es código abierto y no voy a fingir que lo es. Cada versión pasa a GPL-3.0 o posterior cuatro años después de hacerse pública por primera vez. El uso doméstico y de laboratorio es gratuito, igual que el uso en producción de escuelas, organizaciones sin ánimo de lucro y gobiernos. El uso empresarial pasa por EmberNet, donde registrarse es gratis y el uso empresarial también. No se concede alojarlo como servicio para terceros, revenderlo ni integrarlo en algo que usted venda. El archivo `LICENSE` es el texto legal y prevalece sobre este párrafo.
