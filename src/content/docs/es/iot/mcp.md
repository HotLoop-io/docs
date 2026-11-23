---
title: "MCP para agentes"
description: "Deje que un agente lea toda la planta y toque solo lo que usted armó, a través de la puerta de escritura, con el motivo de cada escritura registrado."
---

El gateway habla MCP en ambos sentidos: los agentes pueden leer y manejar la planta, y una regla de automatización puede llamar a una herramienta en otro lugar.

La regla de diseño es que **un agente es un llamante como cualquier otro**. Las herramientas leen a través de la misma caché que lee la interfaz y escriben a través de la misma puerta por la que escribe la interfaz. No hay un camino privilegiado, ni un bypass, ni una política aparte. Una escritura que se le negaría a un operador se niega; una escritura que prospera cae en la misma tabla de auditoría con `mcp:` delante del actor.

## Servicio

### Por HTTP

Habilitado por defecto en `/mcp` en el puerto de la aplicación, protegido por un token bearer que el chart genera en el Secret de la release.

```bash
kubectl -n hotloop get secret <release> \
  -o jsonpath='{.data.mcp-token}' | base64 -d
```

Dentro del clúster, el endpoint es:

```
http://<release>.<namespace>.svc.cluster.local:8080/mcp
```

La comprobación del token está delante del manejador, así que un llamante sin autenticar ni siquiera puede enumerar lo que existe. Dejar `mcp.token` vacío hace que el chart genere uno, el despliegue por defecto no es por accidente el abierto. Combínelo con la NetworkPolicy; un token es una segunda línea de defensa, no la única.

El endpoint nunca está abierto. Ejecute el binario sin `HOTLOOP_MCP_TOKEN` (una unidad Quadlet, un `hotloop` a secas) y crea un token en su primer arranque y lo guarda en su base de datos, de modo que vuelve el mismo tras un reinicio, en cada réplica y tras una restauración. `hotloop mcp-token` lo imprime (el registro dice que creó uno, y nunca cuál es). Defina `HOTLOOP_MCP_TOKEN` para elegir el suyo; con `HOTLOOP_MCP_OIDC_*` definido el endpoint acepta un inicio de sesión y no guarda token propio. Un cliente que antes se conectaba a un binario desnudo sin nada ahora recibe un `401` hasta que envía `Authorization: Bearer <that token>`.

### Con un inicio de sesión de Vord o una aserción del hub

El token estático dice qué cliente llamó; no puede decir qué persona. Con OIDC definido, `/mcp` también acepta `Authorization: Bearer <jwt>`, y el correo de la persona verificada pasa a ser el actor de auditoría: una escritura queda como `mcp:pat@example.com` en lugar de `mcp:<client name>`. El comportamiento sin él no cambia, y el token estático sigue funcionando a su lado (sin token estático definido, solo entra un JWT verificado).

| Variable | Valor del chart | Función |
|---|---|---|
| `HOTLOOP_MCP_OIDC_ISSUER` | `mcp.oidc.issuer` | la URL del realm de Vord; acepta sus tokens de acceso |
| `HOTLOOP_MCP_OIDC_AUDIENCE` | `mcp.oidc.audience` | el `aud` que debe llevar todo token; obligatorio con cualquiera de estos dos |
| `HOTLOOP_MCP_OIDC_HUB_JWKS_URL` | `mcp.oidc.hubJwksUrl` | las claves de aserción del hub de identidad; acepta sus aserciones |
| `HOTLOOP_MCP_OIDC_REQUIRED_ROLE` | `mcp.oidc.requiredRole` | un rol del realm que debe tener el llamante |
| `HOTLOOP_MCP_OIDC_WRITE_ROLE` | `mcp.oidc.writeRole` | limita las escrituras por llamante, véase abajo |

Un token de acceso de Vord se comprueba contra el JWKS del emisor (hallado mediante su documento de descubrimiento, en caché diez minutos, vuelto a pedir ante un `kid` desconocido): solo RS256 o ES256, `iss` igual al emisor, `aud` que contenga la audiencia, `exp` y `nbf` con 30 s de margen, y una reclamación `email` (o `preferred_username`). Vord pone por defecto solo `account` en `aud`; dé al alcance del cliente un mapeador de audiencia para la audiencia que defina.

Una aserción del hub es `typ` `fb-assert+jwt`, EdDSA, `iss` `fireball-hub`, `aud` la audiencia configurada (el módulo Hub envía `hotloop`), no caducada, firmada por una clave del JWKS del Hub. No hay caché de repetición de `jti`: una llamada a una herramienta son varias peticiones HTTP (initialize, luego la llamada) que llevan la misma aserción, que vive 60 s. Cuando el Hub dice que la llamada actúa por otra persona (`acting_as`), el actor se lee `mcp:<email> for <acting_as email>`.

Las escrituras siguen necesitando `HOTLOOP_ALLOW_WRITES`, el interruptor general; un token nunca lo amplía. `HOTLOOP_MCP_OIDC_WRITE_ROLE` las restringe por llamante: `hotloop:hotloop.write` significa el rol de cliente de Vord `hotloop.write` en el cliente `hotloop` (`resource_access.hotloop.roles`), un nombre a secas significa un rol del realm, y una aserción del Hub debe llevar el nombre del rol en `abilities`. Un llamante sin él puede leer, pero `write_tag`, `call_service`, `run_script`, `apply_recipe`, `trigger_automation` y toda herramienta que cambie la configuración se niegan. El token estático no está limitado por él.

### Por stdio

El mismo binario sirve MCP por stdin y stdout con `--mcp-stdio`, para un cliente que lo lance directamente. Todo lo demás arranca también, de modo que el agente ve una planta viva y no un servidor hueco.

```json
{
  "mcpServers": {
    "hotloop": {
      "command": "/usr/local/bin/hotloop",
      "args": ["--mcp-stdio"],
      "env": {
        "HOTLOOP_DB_HOST": "timescale.plant.local",
        "HOTLOOP_DB_PASSWORD": "…"
      }
    }
  }
}
```

En modo stdio todo el registro va a stderr. Cualquier cosa escrita en stdout corrompería el flujo del protocolo.

## Herramientas

Ciento setenta y una: veintisiete que leen la planta y la comandan, sesenta y nueve que cambian su configuración ([abajo](#cambiar-la-configuración)), treinta y tres lecturas y simulaciones que las acompañan ([abajo](#lecturas-y-simulaciones)) y cuarenta y dos de administración ([abajo](#administración)).

| Herramienta | Qué hace |
|---|---|
| `get_plant_status` | dispositivos en línea, alarmas pendientes, si las escrituras están habilitadas |
| `list_devices` | cada dispositivo con protocolo, dirección, estado, número de tags |
| `describe_device` | un dispositivo en detalle, con sus tags y estadísticas de sondeo |
| `list_tags` | busca en el catálogo por dispositivo, nombre o descripción |
| `read_tag` | valores actuales, con calidad |
| `query_history` | lecturas históricas, en bruto o agrupadas |
| `write_tag` | **ordena un tag** |
| `list_alarms` | alarmas y sus estados ISA-18.2 |
| `ack_alarm` | reconoce en nombre de un operador |
| `list_automations` | reglas, número de ejecuciones, último resultado |
| `trigger_automation` | ejecuta una regla ahora |
| `describe_protocol` | lo que esta compilación habla realmente |
| `recent_events` | el registro del sistema, para deducir qué pasó y en qué orden |
| `list_entities` | busca entidades por dominio, nodo de equipo o etiqueta, con los servicios que acepta cada una |
| `get_states` | estado actual de una o más entidades, con calidad y atributos |
| `call_service` | **ordena una entidad**: `switch.turn_on`, `number.set_value` |
| `get_logbook` | una sola línea de tiempo de cambios de estado, escrituras, alarmas, ejecuciones y cambios de configuración, por entidad, nodo de equipo, actor o tipo |
| `list_scripts` | los scripts de la planta, los campos que toma cada uno, si se está ejecutando, su última ejecución |
| `run_script` | **ejecuta un script**, o pregunta con `dryRun` qué haría ahora mismo |
| `list_recipes` | las recetas de la planta: objetivos en orden, parámetros, precondición, versión, última aplicación |
| `validate_recipe` | ¿se aplicaría una receta ahora mismo? todos los motivos por los que se rechazaría; no se escribe nada |
| `apply_recipe` | **aplica una receta**: comprobada entera, escrita en orden, leída de vuelta |
| `list_blueprints` | los blueprints que la gente rellena para crear reglas, sus entradas y versiones |
| `preview_blueprint` | la regla que crearía un blueprint con unas entradas dadas, y lo que haría ahora; no crea nada |
| `find_network_client` | dónde está un dispositivo en la red de la planta: su puerto del switch, si el puerto tiene enlace, cuándo lo vio por última vez la consola UniFi |
| `get_network_topology` | la red de la planta tal como la dibuja la consola UniFi: qué está enchufado a qué, el estado de cada dispositivo, y los dispositivos HotLoop que pierden su red si cae |
| `get_network_events` | los eventos más recientes que ha informado una consola UniFi, y si su websocket de eventos está activo |

### Entidades

Una entidad es lo que la gente llama una cosa de la planta, `sensor.zone_1_temperature` o `switch.conveyor_run`, que envuelve uno o más tags. Véase [Entidades](/es/iot/entities/). Para un agente suelen ser el mejor asidero: el nombre significa algo, y la entidad sabe qué se le puede hacer.

`list_entities` filtra por `domain`, por `equipment` (un nodo del árbol de equipos por id, nombre o ruta de nombres como `Plant A/Packing`, que coincide con todo lo que esté en él o debajo, y el lugar propio de una entidad gana sobre el de su dispositivo), por `label` (label_id o nombre; una entidad coincide si lleva la etiqueta o su dispositivo la lleva) y por `query`, una subcadena del entity_id o del nombre. Cada resultado lleva su estado actual y calidad y los servicios que acepta, como `domain.service`. Una entidad sin servicios es de solo lectura. Los servicios vienen de la capa de entidades, así que un dominio que gane uno allí aparece aquí sin ningún cambio.

`get_states` toma `entity_ids` y responde a cada una con su estado, calidad, atributos y `last_changed`. Mantiene la misma línea que `read_tag`: un estado `unknown` o `unavailable` se responde con una nota que dice que no es un valor, una entidad deshabilitada dice que está deshabilitada en lugar de decir que falta, y la mala calidad se detalla.

`call_service` toma `domain`, `service`, `entity_id`, `data` y un `reason` **obligatorio**:

```
> call_service domain=number service=set_value entity_id=number.press_01_sp
    data={"value": 212.5} reason="operator asked for 212.5 on zone 1"
Called number.set_value on number.press_01_sp (was 210). Writes: 212.5 to press-01/Setpoint: written
```

Pasa por `entity.Services`, el mismo ejecutor que usa `POST /api/services/...`, que convierte la llamada en escrituras a través de la puerta de escritura. Véase [Escritura](#escritura).

### La red

`find_network_client` responde a la primera pregunta sobre un PLC que se ha quedado callado: ¿es el PLC o su puerto de switch? Dele `deviceId` y sigue el enlace confirmado de ese dispositivo hasta su cliente UniFi; dele `query` (una MAC, una IP o parte de un nombre) y busca en todas las consolas que lee HotLoop. Lee la última lectura del driver UniFi, nunca la consola, así que un agente que pregunta en bucle no cuesta nada a la consola. Eso también significa que un ayudante `--mcp-stdio` responde que en su proceso no se lee ninguna consola: nunca inicia sesión en una, porque el Gateway que tiene al lado ya mantiene la sesión. Pregunte al endpoint del Gateway. Véase [UniFi Network](/es/iot/unifi/).

`get_network_topology` es el mapa: cada switch, punto de acceso y gateway bajo aquel al que está enchufado, con el puerto en ambos extremos, el enlace, cuántos clientes hay en él y los dispositivos HotLoop enlazados a un cliente por debajo. Esa última parte es el radio de impacto: nombra los PLC que pierden su red si ese switch cae. Un switch que la consola lista como enchufado a nada lo dice y no se cuelga del gateway. `get_network_events` son los eventos más recientes de la consola, primero el más nuevo, con su propia frase, un indicador de advertencia donde la consola lo califica de negativo, y si el websocket de eventos está activo. Ambos toman el `deviceId` de la consola, que puede omitirse cuando HotLoop lee solo una, y ambos leen la última lectura del driver como `find_network_client`, así que no cuestan nada a la consola y dicen lo mismo en un ayudante `--mcp-stdio`: en ese proceso no se lee ninguna consola. Los eventos más antiguos están en `get_logbook`, archivados bajo el switch o punto de acceso al que se referían.

### El libro de registro

`get_logbook` es la línea de tiempo que sirve `GET /api/logbook` (véase [El libro de registro](/es/iot/logbook/)): cambios de estado, escrituras, transiciones de alarma, ejecuciones de automatizaciones y cambios de configuración, primero lo más nuevo. Se acota por `entity`, por `equipment` (id, nombre o ruta, y todo lo que haya debajo; un nombre que coincide con dos nodos es un error que lista ambos), por `actor` (parte de él: `mcp:` encuentra todo lo que hizo cualquier agente), por `kinds`, y por `minutes` hacia atrás (por defecto un día). Una página con más a continuación termina diciendo qué pasar como `before` para la siguiente. Para "qué pasó antes de que esto fallara" es el mejor `recent_events`: los propios cambios de estado del equipo están en él, y las líneas de la puerta de escritura no están dos veces.

### Scripts

Un script es una secuencia con nombre de pasos que alguien escribió una vez, el ciclo CIP o la purga de línea, de modo que un agente ejecuta el procedimiento propio de la planta en lugar de inventar uno. Véase [Scripts](/es/iot/scripts/). `list_scripts` dice qué toma cada uno. `run_script` toma `scriptId`, `fields`, un `reason` **obligatorio**, y dos interruptores:

- `dryRun: true` recorre el script contra la planta tal como está y dice, paso a paso, qué se escribiría y lo primero que rechazaría la puerta, con las palabras de la puerta. No se escribe ni se audita nada. Pregunte esto primero.
- `wait: true` responde cuando ha terminado la ejecución, con su resultado y su traza. Sin él la respuesta es el id de la ejecución, y `list_scripts` o `get_logbook` con `kinds: ["script"]` dice cómo terminó.

La ejecución es del script, como `script:<id>`, con el origen `mcp`, de modo que cada escritura que hace se encuentra con la puerta exactamente como `write_tag`. Con las escrituras desactivadas (`HOTLOOP_ALLOW_WRITES`), `run_script` rechaza antes de que se ejecute nada, igual que `trigger_automation`; una simulación sigue respondiéndose, y dice que el interruptor es el motivo.

### Recetas

Una receta es un conjunto de consignas que la planta aplica juntas, un grado de producto o un cambio de formato, de modo que un agente carga los números propios de la planta en lugar de escribirlos uno a uno. Véase [Recetas](/es/iot/recipes/). `list_recipes` muestra los objetivos de cada una en orden y los parámetros que toma. `validate_recipe` pregunta si una se aplicaría ahora mismo y da todos los motivos por los que no, sin escribir nada. `apply_recipe` toma `recipeId`, `params`, un `version` opcional y un `reason` **obligatorio**.

Se comprueba entera primero y se rechaza entera, sin escribir nada, si algún valor fuese rechazado; los valores fuera de rango se rechazan, nunca se ajustan. Después los objetivos salen en orden bajo un único id de llamada, el primero que falla detiene al resto, y nada se deshace. La respuesta dice, objetivo por objetivo, qué salió y si el dispositivo leyó de vuelta el valor. Las escrituras son del agente, con el origen `mcp`, así que la puerta se aplica a cada una; con las escrituras desactivadas (`HOTLOOP_ALLOW_WRITES`), `apply_recipe` rechaza antes de comprobar nada. Una receta que nombra su propio permiso de aplicación es para las personas a las que se les concede, y un agente no es una de ellas.

### Blueprints

Un blueprint es una regla escrita una vez con huecos tipados: qué motor, cuánto tiempo, qué límite. Véase [Blueprints](/es/iot/blueprints/). `list_blueprints` dice qué toma cada uno. `preview_blueprint` toma `blueprintId`, `automationId` e `inputs`, y responde la regla que crearía y lo que haría esa regla si se disparase ahora mismo, con cada escritura sometida a las comprobaciones de la puerta. Las entradas se comprueban exactamente como las comprueba la pantalla: fuera de rango se rechaza, no se ajusta.

`instantiate_blueprint` crea la regla, por la ruta que usa la pantalla Blueprints: las mismas comprobaciones, y la regla cae en el libro de registro con el agente como quien la creó. Una regla es una orden permanente de comandar equipos cada vez que se dispara su disparador, así que un agente mira primero: `preview_blueprint` no almacena nada ni escribe nada, y se responde estén o no activadas las escrituras. Cada escritura que la regla creada pasa a hacer se encuentra con la puerta de escritura, como con una regla creada por una persona. Véase [Cambiar la configuración](#cambiar-la-configuración).

## Cambiar la configuración

Todo lo que un agente puede leer, lo puede cambiar. Las herramientas de arriba que leen la planta tienen contrapartes que la cambian, sesenta y nueve, y ninguna es una segunda implementación: cada una es una ruta de la API REST, y una llamada se ejecuta a través del manejador propio de esa ruta. La validación, la comprobación de permisos, la recarga del runtime y la línea de auditoría son de la ruta, con el agente como actor (`mcp:<client>`, o `mcp:<email>` con un inicio de sesión de Vord), de modo que un dispositivo sin driver, una regla que no compila, una entrada de blueprint fuera de rango o un tag para el que el dispositivo descubierto no ha sido aceptado se rechazan con las palabras que muestra la pantalla, y nada cambió.

Cada una toma los valores de ruta por nombre (`id`, `device`, `name`...), `body`, el mismo JSON que toma la API ([La API HTTP](/es/iot/api/) tiene cada body), y un `reason` **obligatorio**. El motivo se registra como una línea `config` en el registro del sistema junto a la de la propia ruta, contra lo que se cambió.

```
> save_tag reason="the setpoint, writable between 0 and 100" body={"deviceId":"press-01",
    "name":"Setpoint","address":"holding:5:uint16","dataType":"int16","enabled":true,
    "writable":true,"hasRange":true,"minValue":0,"maxValue":100}
save_tag done.
{ ...the tag as stored... }
```

Lo que está delante de ellas es lo que está delante de `write_tag`, menos el interruptor general, porque las pantallas tampoco lo necesitan para cambiar la configuración:

1. `HOTLOOP_ALLOW_MCP_WRITES`, activado por defecto, debe estar activado.
2. Un llamante con `HOTLOOP_MCP_OIDC_WRITE_ROLE` definido debe tenerlo.
3. La llamada lleva un permiso, el que pide su ruta (la tercera columna de abajo), y nada más. Una ruta responde a un agente como responde a una persona sin ese permiso, y una prueba obliga a cada fila de la tabla a corresponder con una ruta real y con el permiso que esa ruta pide.
4. Un motivo.

Comandar equipos sigue siendo `write_tag`, `call_service`, `run_script`, `apply_recipe` y `trigger_automation` con `HOTLOOP_ALLOW_WRITES` activado y con la marca de escribible y el rango del tag por cumplir. Hacer escribible un tag, una regla, un script o una receta es configuración: no comanda nada hasta que se usa, y lo que comanda entonces pasa por la puerta.

Las funciones propias del administrador también son herramientas, bajo [Administración](#administración) más abajo. Aceptar un dispositivo descubierto está aquí, como en la pantalla; los puntos que contiene todavía deben armarse para escritura uno a uno.

Las herramientas existen también en `--mcp-stdio`: el proceso construye el mismo servidor de API y nunca abre su puerto.

**Dispositivos y tags**

| Herramienta | Ruta | Permiso |
|---|---|---|
| `save_device` | `POST /api/devices` | `devices.write` |
| `delete_device` | `DELETE /api/devices/{id}` | `devices.write` |
| `set_device_enabled` | `POST /api/devices/{id}/enabled` | `devices.write` |
| `import_device_tags` | `POST /api/devices/{id}/import` | `tags.write` |
| `save_tag` | `POST /api/tags` | `tags.write` |
| `delete_tag` | `DELETE /api/tags/{device}/{name}` | `tags.write` |
| `set_device_labels` | `PUT /api/devices/{id}/labels` | `equipment.write` |
| `set_device_network` | `PUT /api/devices/{id}/network` | `devices.write` |
| `clear_device_network` | `DELETE /api/devices/{id}/network` | `devices.write` |

**Descubrimiento y brokers**

| Herramienta | Ruta | Permiso |
|---|---|---|
| `accept_discovered_device` | `POST /api/discovery/{source}/{key}/accept` | `devices.write` |
| `ignore_discovered_device` | `POST /api/discovery/{source}/{key}/ignore` | `devices.write` |
| `unignore_discovered_device` | `POST /api/discovery/{source}/{key}/unignore` | `devices.write` |
| `apply_discovery_review` | `POST /api/discovery/{source}/{key}/review/apply` | `devices.write` |
| `reject_discovery_review` | `POST /api/discovery/{source}/{key}/review/reject` | `devices.write` |
| `accept_network_find` | `POST /api/network-discovery/{key}/accept` | `devices.write` |
| `ignore_network_find` | `POST /api/network-discovery/{key}/ignore` | `devices.write` |
| `unignore_network_find` | `POST /api/network-discovery/{key}/unignore` | `devices.write` |
| `probe_network` | `POST /api/network-discovery/probe` | `devices.write` |
| `create_mqtt_broker` | `POST /api/mqtt/brokers` | `devices.write` |
| `update_mqtt_broker` | `PUT /api/mqtt/brokers/{id}` | `devices.write` |
| `delete_mqtt_broker` | `DELETE /api/mqtt/brokers/{id}` | `devices.write` |
| `probe_integration` | `POST /api/integrations/{id}/probe` | `devices.write` |
| `setup_integration` | `POST /api/integrations/{id}/setup` | `devices.write` |

**UniFi**

| Herramienta | Ruta | Permiso |
|---|---|---|
| `mark_unifi_network_ot` | `PUT /api/unifi/{id}/networks/{network}` | `devices.write` |
| `accept_unifi_known_device` | `PUT /api/unifi/{id}/networks/{network}/known/{mac}` | `devices.write` |
| `forget_unifi_known_device` | `DELETE /api/unifi/{id}/networks/{network}/known/{mac}` | `devices.write` |
| `accept_all_unifi_known_devices` | `POST /api/unifi/{id}/networks/{network}/accept-all` | `devices.write` |
| `create_unifi_starter_alarms` | `POST /api/unifi/{id}/starter-alarms` | `alarms.write` |

**Entidades, helpers, equipos, etiquetas**

| Herramienta | Ruta | Permiso |
|---|---|---|
| `create_entity` | `POST /api/entities` | `entities.write` |
| `update_entity` | `PUT /api/entities/{entity_id}` | `entities.write` |
| `delete_entity` | `DELETE /api/entities/{entity_id}` | `entities.write` |
| `create_energy_meter` | `POST /api/energy/meters` | `energy.write` |
| `update_energy_meter` | `PUT /api/energy/meters/{id}` | `energy.write` |
| `delete_energy_meter` | `DELETE /api/energy/meters/{id}` | `energy.write` |
| `create_helper` | `POST /api/helpers` | `entities.write` |
| `update_helper` | `PUT /api/helpers/{entity_id}` | `entities.write` |
| `delete_helper` | `DELETE /api/helpers/{entity_id}` | `entities.write` |
| `create_equipment` | `POST /api/equipment` | `equipment.write` |
| `update_equipment` | `PUT /api/equipment/{id}` | `equipment.write` |
| `delete_equipment` | `DELETE /api/equipment/{id}` | `equipment.write` |
| `create_label` | `POST /api/labels` | `equipment.write` |
| `update_label` | `PUT /api/labels/{label_id}` | `equipment.write` |
| `delete_label` | `DELETE /api/labels/{label_id}` | `equipment.write` |

**Alarmas**

| Herramienta | Ruta | Permiso |
|---|---|---|
| `save_alarm` | `POST /api/alarms` | `alarms.write` |
| `delete_alarm` | `DELETE /api/alarms/{id}` | `alarms.write` |
| `shelve_alarm` | `POST /api/alarms/{id}/shelve` | `alarms.ack` |
| `unshelve_alarm` | `POST /api/alarms/{id}/unshelve` | `alarms.ack` |

**Automatizaciones y blueprints**

| Herramienta | Ruta | Permiso |
|---|---|---|
| `save_automation` | `POST /api/automations` | `automations.write` |
| `delete_automation` | `DELETE /api/automations/{id}` | `automations.write` |
| `set_automation_enabled` | `POST /api/automations/{id}/enabled` | `automations.write` |
| `upgrade_blueprint_automation` | `POST /api/automations/{id}/blueprint-upgrade` | `blueprints.apply` |
| `instantiate_blueprint` | `POST /api/blueprints/{id}/instantiate` | `blueprints.apply` |
| `create_blueprint` | `POST /api/blueprints` | `blueprints.write` |
| `update_blueprint` | `PUT /api/blueprints/{id}` | `blueprints.write` |
| `delete_blueprint` | `DELETE /api/blueprints/{id}` | `blueprints.write` |

**Scripts y recetas**

| Herramienta | Ruta | Permiso |
|---|---|---|
| `create_script` | `POST /api/scripts` | `scripts.write` |
| `update_script` | `PUT /api/scripts/{id}` | `scripts.write` |
| `delete_script` | `DELETE /api/scripts/{id}` | `scripts.write` |
| `stop_script` | `POST /api/scripts/{id}/stop` | `scripts.run` |
| `create_recipe` | `POST /api/recipes` | `recipes.write` |
| `capture_recipe` | `POST /api/recipes/capture` | `recipes.write` |
| `update_recipe` | `PUT /api/recipes/{id}` | `recipes.write` |
| `delete_recipe` | `DELETE /api/recipes/{id}` | `recipes.write` |

**Paneles y el tablero**

| Herramienta | Ruta | Permiso |
|---|---|---|
| `create_dashboard` | `POST /api/dashboards` | `dashboards.write` |
| `update_dashboard` | `PUT /api/dashboards/{id}` | `dashboards.write` |
| `delete_dashboard` | `DELETE /api/dashboards/{id}` | `dashboards.write` |
| `save_board` | `PUT /api/board` | `board.write` |

**Importaciones**

| Herramienta | Ruta | Permiso |
|---|---|---|
| `import_codesys_alarms` | `POST /api/alarms/import/codesys` | `alarms.write` |
| `screen_import` | `POST /api/dashboards/import` | `dashboards.write` |

`import_codesys_alarms` toma el archivo que escribió Export Alarms del IDE de CODESYS, como `contentBase64` (los bytes tal como están en disco, que el IDE escribe en UTF-16) o como `content` (el texto, si lo tiene como texto), con el `deviceId` al que pertenecen las alarmas y, si las quiere, `application` y `defaultPriority`. Si se deja así solo hace una vista previa: dice qué alarmas pasarían y cuáles no, no guarda nada y no necesita motivo. Con `apply` true las guarda como definiciones de alarma, y entonces necesita un motivo y el interruptor de escritura MCP como toda herramienta que cambia la configuración.

`screen_export` responde un panel como un archivo de pantalla de HotLoop ([Archivos de pantalla](/es/iot/screen-file/)), y `screen_import` recibe uno, en esta instalación o en otra. Pregunta primero: `dryRun` es true salvo que diga false, y una simulación no guarda nada y responde con el informe con cada problema listado y las referencias para `remap`. Una importación real necesita `dryRun` false, un motivo y el interruptor de escritura MCP, y un id que ya existe se rechaza salvo que `replace` sea true. La pantalla son datos del cliente, así que el archivo es la forma en que se mueve entre instalaciones, nunca código.

### Lecturas y simulaciones

Un agente que puede cambiar un panel, un broker o un nodo del árbol de equipos tiene que poder leer primero lo que hay, de modo que cada objeto que cambia una herramienta de arriba tiene aquí una lectura, y las simulaciones de los editores también son herramientas. Cada una es una ruta ejecutada por su propio manejador con el permiso de lectura que esa ruta pide. Una lectura responde sin motivo y sin el interruptor de escritura, y un llamante que el rol de escritura deja fuera aun así puede hacerlas, porque llevan un permiso de lectura y nada más. Las tres simulaciones (`validate_automation`, `validate_script` y `browse_device`) no cambian nada; las dos que comprueban un cuerpo llevan el permiso de escritura que pide su ruta, así que quedan detrás del rol de escritura.

| Herramienta | Ruta | Permiso |
|---|---|---|
| `list_alarm_definitions` | `GET /api/alarms` | `alarms.read` |
| `list_composite_entities` | `GET /api/entities/composites` | `entities.read` |
| `list_energy_meters` | `GET /api/energy/meters` | `energy.read` |
| `get_energy_meter` | `GET /api/energy/meters/{id}` | `energy.read` |
| `get_energy_summary` | `GET /api/energy/summary/{period}` | `energy.read` |
| `get_energy_series` | `GET /api/energy/series/{meter}/{period}/{step}` | `energy.read` |
| `list_alarm_events` | `GET /api/alarms/events` | `alarms.read` |
| `screen_export` | `GET /api/dashboards/{id}/export` | `dashboards.read` |
| `list_dashboards` | `GET /api/dashboards` | `dashboards.read` |
| `get_dashboard` | `GET /api/dashboards/{id}` | `dashboards.read` |
| `get_board` | `GET /api/board` | `values.read` |
| `list_equipment` | `GET /api/equipment` | `equipment.read` |
| `get_equipment` | `GET /api/equipment/{id}` | `equipment.read` |
| `list_labels` | `GET /api/labels` | `equipment.read` |
| `get_label` | `GET /api/labels/{label_id}` | `equipment.read` |
| `list_discovered_devices` | `GET /api/discovery` | `devices.read` |
| `get_discovered_device` | `GET /api/discovery/{source}/{key}` | `devices.read` |
| `list_network_finds` | `GET /api/network-discovery` | `devices.read` |
| `get_network_find` | `GET /api/network-discovery/{key}` | `devices.read` |
| `list_integrations` | `GET /api/integrations` | `devices.read` |
| `list_mqtt_brokers` | `GET /api/mqtt/brokers` | `devices.read` |
| `get_blueprint` | `GET /api/blueprints/{id}` | `blueprints.read` |
| `get_script` | `GET /api/scripts/{id}` | `scripts.read` |
| `list_automation_runs` | `GET /api/runs` | `automations.read` |
| `list_script_runs` | `GET /api/scripts/{id}/runs` | `scripts.read` |
| `list_unifi_consoles` | `GET /api/unifi/consoles` | `devices.read` |
| `list_unifi_networks` | `GET /api/unifi/{id}/networks` | `devices.read` |
| `list_unifi_known_devices` | `GET /api/unifi/{id}/known` | `devices.read` |
| `get_device_network` | `GET /api/devices/{id}/network` | `devices.read` |
| `get_diagnostics` | `GET /api/diagnostics` | `status.read` |
| `browse_device` | `POST /api/devices/{id}/browse` | `devices.read` |
| `validate_automation` | `POST /api/automations/validate` | `automations.write` |
| `validate_script` | `POST /api/scripts/validate` | `scripts.write` |

### Administración

Las cuentas de usuario, los ajustes, las copias de seguridad, la política de escalado, los destinos del historiador, los accesos al broker, la flota de edge relays y los informes programados son del administrador, y también son herramientas: cuarenta y dos, con el mismo patrón que las demás. Cada una es una ruta ejecutada por su propio manejador con el permiso que esa ruta pide (`users.manage`, `settings.write`, `backup.run`, `fleet.restart`...), un motivo para cada cambio y el agente en la línea de auditoría. Una ruta que rechaza rechaza a un agente con las mismas palabras. Las lecturas (las herramientas `list_` y `get_`) no necesitan motivo ni interruptor de escritura, y siguen necesitando el rol de escritura del llamante cuando hay uno definido, porque el permiso que llevan es de administrador. Las herramientas de flota y de informes existen solo en un producto que tenga la función.

Dos cosas son propias de las rutas y conviene conocerlas antes de fiarse de una herramienta:

- **Los interruptores de escritura no tienen ruta.** `safety.allowWrites` y `safety.allowMcpWrites` son del despliegue (`HOTLOOP_ALLOW_WRITES`, `HOTLOOP_ALLOW_MCP_WRITES`), y `PUT /api/settings` los rechaza por estar definidos por el despliegue. Así que `save_settings` cambia lo que la pantalla de Ajustes puede cambiar y responde ese rechazo para los interruptores, con esas palabras. Un agente no puede activar el interruptor del que dependen sus propias escrituras.
- **La contraseña de un usuario pasa por la llamada.** `create_user`, `reset_user_password` y las herramientas de PIN toman un secreto en sus argumentos, como la API. La línea de auditoría nombra el cambio y el motivo y nunca el secreto.

**Cuentas de usuario**

| Herramienta | Ruta | Permiso |
|---|---|---|
| `list_users` | `GET /api/users` | `users.manage` |
| `create_user` | `POST /api/users` | `users.manage` |
| `update_user` | `PUT /api/users/{username}` | `users.manage` |
| `delete_user` | `DELETE /api/users/{username}` | `users.manage` |
| `reset_user_password` | `POST /api/users/{username}/password` | `users.manage` |
| `unlock_user` | `DELETE /api/users/{username}/lockout` | `users.manage` |
| `set_user_pin` | `PUT /api/users/{username}/pin` | `users.manage` |
| `clear_user_pin` | `DELETE /api/users/{username}/pin` | `users.manage` |
| `list_opcua_certificates` | `GET /api/opcua/certificates` | `users.manage` |
| `list_user_certificates` | `GET /api/users/{username}/certificates` | `users.manage` |
| `add_user_certificate` | `POST /api/users/{username}/certificates` | `users.manage` |
| `revoke_user_certificate` | `POST /api/users/{username}/certificates/{thumbprint}/revoke` | `users.manage` |
| `delete_user_certificate` | `DELETE /api/users/{username}/certificates/{thumbprint}` | `users.manage` |

**Ajustes, copias de seguridad, notificaciones**

| Herramienta | Ruta | Permiso |
|---|---|---|
| `get_settings` | `GET /api/settings` | `settings.read` |
| `save_settings` | `PUT /api/settings` | `settings.write` |
| `list_backups` | `GET /api/backup` | `backup.read` |
| `run_backup` | `POST /api/backup` | `backup.run` |
| `get_escalation` | `GET /api/notify/escalation` | `notify.escalation` |
| `save_escalation` | `PUT /api/notify/escalation` | `notify.escalation` |
| `send_test_notification` | `POST /api/notify/test` | `notify.test` |

**Destinos del historiador y accesos al broker**

| Herramienta | Ruta | Permiso |
|---|---|---|
| `list_historian_targets` | `GET /api/historian/targets` | `settings.read` |
| `create_historian_target` | `POST /api/historian/targets` | `settings.write` |
| `update_historian_target` | `PUT /api/historian/targets/{id}` | `settings.write` |
| `delete_historian_target` | `DELETE /api/historian/targets/{id}` | `settings.write` |
| `list_broker_logins` | `GET /api/broker/logins` | `users.manage` |
| `create_broker_login` | `POST /api/broker/logins` | `users.manage` |
| `update_broker_login` | `PUT /api/broker/logins/{name}` | `users.manage` |
| `delete_broker_login` | `DELETE /api/broker/logins/{name}` | `users.manage` |

**La flota de edge relays (Gateway)**

| Herramienta | Ruta | Permiso |
|---|---|---|
| `list_fleet` | `GET /api/fleet` | `fleet.read` |
| `register_relay` | `POST /api/fleet` | `fleet.write` |
| `delete_relay` | `DELETE /api/fleet/{id}` | `fleet.write` |
| `rebirth_relay` | `POST /api/fleet/{id}/rebirth` | `fleet.rebirth` |
| `restart_relay` | `POST /api/fleet/{id}/restart` | `fleet.restart` |
| `update_relay` | `POST /api/fleet/{id}/update` | `fleet.update` |
| `set_relay_config` | `POST /api/fleet/{id}/config` | `fleet.config` |
| `clear_relay_config` | `DELETE /api/fleet/{id}/config` | `fleet.config` |

**Informes programados (Gateway)**

| Herramienta | Ruta | Permiso |
|---|---|---|
| `list_reports` | `GET /api/reports` | `reports.read` |
| `get_report` | `GET /api/reports/{id}` | `reports.read` |
| `create_report` | `POST /api/reports` | `reports.write` |
| `update_report` | `PUT /api/reports/{id}` | `reports.write` |
| `delete_report` | `DELETE /api/reports/{id}` | `reports.write` |
| `run_report` | `POST /api/reports/{id}/run` | `reports.run` |

## Recursos

| URI | Contenido |
|---|---|
| `iiot://devices` | el árbol de dispositivos con tags, como JSON |
| `iiot://tags` | el catálogo de tags con valores actuales |
| `iiot://alarms` | definiciones de alarma, estado en vivo y una referencia de estados |
| `iiot://protocols` | protocolos soportados, a partir de los drivers compilados |

Los recursos existen para que un cliente pueda traer todo el espacio de nombres en una sola lectura en lugar de descubrirlo llamada a herramienta por llamada.

## Lo que las herramientas no harán

Las herramientas están escritas para que un modelo no pueda redondear la incertidumbre por accidente.

**Un tag sin lectura no es un tag que lee cero.** `read_tag` dice `no reading has been taken for this tag yet`, o `this tag is not configured` si no existe. Ninguno devuelve un valor.

**La mala calidad se declara, no se insinúa.** Las lecturas vuelven como `[quality: bad (the value is NOT known; do not treat it as a measurement)]`. Las instrucciones del servidor lo repiten. No promedie lecturas malas y no informe de una como si fuera una medición.

**`describe_protocol` no puede mentir.** La disponibilidad sale de los drivers compilados en el binario, así que la herramienta no puede afirmar un protocolo que el gateway no tiene.

**Un rechazo es una respuesta, no un fallo de transporte.** Una escritura rechazada vuelve como resultado de herramienta con `isError`, lo que significa que la llamada estaba bien formada y fue declinada deliberadamente. No es un error de protocolo que reintentar.

## Escritura

MCP lee y escribe: comanda equipos, y cambia la configuración ([arriba](#cambiar-la-configuración)). `write_tag` mueve equipos reales, así que lo mismo que se interpone entre el clic de un operador y una máquina se interpone entre la llamada de una herramienta y una máquina:

1. `HOTLOOP_ALLOW_WRITES`, el interruptor general de todo el despliegue, debe estar activado. Con él desactivado nada escribe: ni la interfaz, ni la API, ni un agente.
2. El tag debe estar marcado como escribible. Los tags son de solo lectura hasta que alguien diga otra cosa, uno a uno.
3. El valor debe estar dentro del rango configurado del tag. Se **rechaza, no se recorta**: enviar 400 cuando alguien pidió 500 es hacer en silencio algo distinto de lo que se pidió.

Se **requiere un motivo** y se registra junto a la escritura. Una fila de auditoría que nadie puede interpretar seis meses después es apenas mejor que ninguna.

`call_service` recibe exactamente las mismas tres, porque no es más que escrituras a través de la misma puerta, y luego las comprobaciones propias de la entidad por encima (el paso y el rango más estrecho de un número, el patrón de un texto, que la entidad no esté deshabilitada). Un rechazo en cualquiera de ellas se audita contra la entidad además del tag: origen `mcp`, el cliente por nombre, el entity_id, el servicio y el id de llamada, la misma fila que deja un `write_tag` rechazado más la entidad. Una llamada sin motivo se rechaza antes de intentar nada, como `write_tag`.

`trigger_automation` está sujeto a la misma puerta, porque las acciones de una regla pueden comandar equipos; de lo contrario sería una forma de esquivar las comprobaciones que encuentra `write_tag`.

```
> write_tag tag=press-01/Zone1_Temp value=99 reason="testing"
write refused: press-01/Zone1_Temp: this tag is not marked writable
```

Cuando las escrituras están desactivadas, las instrucciones del servidor lo dicen desde el principio, para que un agente no pierda un turno descubriéndolo.

## Llamar hacia fuera

La acción `mcp_call` de una automatización invoca una herramienta en otro servidor MCP. Configure los servidores en el chart:

```yaml
mcp:
  outboundServers:
    - name: maintenance
      url: http://maintenance-mcp.default.svc.cluster.local:8080/mcp
      existingSecret: maintenance-mcp-token
      secretKey: token
```

Las sesiones se agrupan y se reutilizan; conectar en cada llamada supondría un handshake, un initialize y un listado de herramientas cada vez que se dispara una regla. Una sesión que ha muerto se reconecta en la siguiente llamada y no con un temporizador, porque la siguiente llamada es el primer momento en que a alguien le importa. Un servidor configurado que está caído no impide que la planta se siga monitorizando, no se marca nada hasta que una regla lo necesita.

La pantalla MCP muestra cada servidor configurado, si está conectado y las herramientas que anuncia.

## Federar sitios

Un gateway por planta es como está pensado que se ejecute. Cada sitio conserva su propia base de datos, su propio tablero y su propio nombre, y ninguno depende de que un enlace a otro lugar siga activo, una planta no deja de monitorizarse porque cayó la WAN.

Ver todos a la vez usa el protocolo que los sitios ya hablan. Configure un gateway en la nube con los sitios como servidores MCP salientes, exactamente como para la acción `mcp_call`:

```
HOTLOOP_MCP_SERVER_1_NAME=akron
HOTLOOP_MCP_SERVER_1_URL=https://akron.example/mcp
HOTLOOP_MCP_SERVER_1_TOKEN=…
HOTLOOP_MCP_SERVER_2_NAME=ashtabula
HOTLOOP_MCP_SERVER_2_URL=https://ashtabula.example/mcp
HOTLOOP_MCP_SERVER_2_TOKEN=…
```

La pantalla Sitios entonces llama a `get_plant_status` en cada uno en paralelo y consolida las respuestas. No hay nada que desplegar en un sitio para que aparezca, ningún sitio tiene que saber que está federado, y nada se conecta hacia dentro de una red de planta.

Dos comportamientos son deliberados y conviene fiarse de ellos:

- Un sitio que no responde se muestra como **inalcanzable, con el motivo**, y se deja fuera de la consolidación. Contar una planta a la que no se llega como cero alarmas es lo peor que podría hacer una pantalla así.
- Los números que un sitio informó por última vez nunca se muestran. Parecen actuales y no lo son.

Cada sitio tiene su propio plazo corto, de modo que una planta con un enlace caído no puede retener a las que están activas.

## Qué conviene decirle a un agente

Las propias instrucciones del servidor cubren esto, pero para quien escriba un prompt alrededor de ello:

- Los estados de alarma siguen ISA-18.2. `rtn-unack` significa una alarma que se despejó sola antes de que nadie la viera, sigue mereciendo ser informada, y es el estado que demuestra que el reconocimiento y la vuelta a la normalidad son independientes.
- `query_history` con agrupaciones, no en bruto, para cualquier cosa de más de unos minutos. Un día de datos de un segundo son 86 400 puntos por tag. Las agrupaciones siguen la regla de calidad: las lecturas malas e inciertas se cuentan en `badReadings`, nunca se promedian, y una agrupación sin nada bueno tiene un promedio nulo.
- `recent_events` es la manera de reconstruir un incidente: conexiones de dispositivos, escrituras, transiciones de alarma, ejecuciones de automatizaciones y cambios de configuración, en orden, cada uno con el actor que lo causó.
